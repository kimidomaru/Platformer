window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['argocd-fundamentals/argocd-projects'] = {
  theory: `
# ArgoCD Projects & RBAC

## Relevance
AppProjects are ArgoCD's multi-tenancy mechanism. They restrict which repositories, clusters, and namespaces an Application can access, and combined with RBAC, enable secure isolation between teams. Essential for enterprise environments with multiple teams sharing the same ArgoCD instance.

## Fundamental Concepts

### What is an AppProject?

An AppProject is an ArgoCD CRD that defines **boundaries** for Applications:

- **Which repositories** can be used as source
- **Which clusters/namespaces** can be used as destination
- **Which resources** can be created (whitelisted/blacklisted)
- **Which roles** have access and what actions they can perform

### Default Project

ArgoCD comes with a \`default\` project that allows everything:
\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: default
  namespace: argocd
spec:
  sourceRepos:
    - '*'              # any repository
  destinations:
    - namespace: '*'   # any namespace
      server: '*'      # any cluster
  clusterResourceWhitelist:
    - group: '*'
      kind: '*'        # any cluster-scoped resource
\`\`\`

### Restricted Project (Production)

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: team-backend
  namespace: argocd
spec:
  description: "Project for the backend team"
  sourceRepos:
    - 'https://github.com/myorg/backend-*'
    - 'https://charts.bitnami.com/bitnami'
  destinations:
    - namespace: 'backend-*'
      server: https://kubernetes.default.svc
    - namespace: 'backend-*'
      server: https://prod-cluster.example.com
  namespaceResourceWhitelist:
    - group: ''
      kind: ConfigMap
    - group: ''
      kind: Secret
    - group: ''
      kind: Service
    - group: apps
      kind: Deployment
    - group: apps
      kind: StatefulSet
    - group: networking.k8s.io
      kind: Ingress
    - group: batch
      kind: Job
    - group: batch
      kind: CronJob
  clusterResourceWhitelist: []
  namespaceResourceBlacklist:
    - group: ''
      kind: ResourceQuota
    - group: ''
      kind: LimitRange
  syncWindows:
    - kind: allow
      schedule: '0 8-18 * * 1-5'
      duration: 10h
      applications: ['*']
    - kind: deny
      schedule: '0 0 * * 0'
      duration: 24h
      applications: ['*']
  roles:
    - name: developer
      description: "Read-only access + manual sync"
      policies:
        - p, proj:team-backend:developer, applications, get, team-backend/*, allow
        - p, proj:team-backend:developer, applications, sync, team-backend/*, allow
      groups:
        - backend-developers
    - name: admin
      description: "Full project access"
      policies:
        - p, proj:team-backend:admin, applications, *, team-backend/*, allow
      groups:
        - backend-leads
  orphanedResources:
    warn: true
\`\`\`

### ArgoCD RBAC

RBAC is configured in the \`argocd-rbac-cm\` ConfigMap:

\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.default: role:readonly
  policy.csv: |
    # Admins — full access
    p, role:admin, applications, *, */*, allow
    p, role:admin, clusters, *, *, allow
    p, role:admin, repositories, *, *, allow
    p, role:admin, projects, *, *, allow

    # Developers — sync and get only
    p, role:developer, applications, get, */*, allow
    p, role:developer, applications, sync, */*, allow
    p, role:developer, repositories, get, *, allow
    p, role:developer, projects, get, *, allow

    # DevOps — manage apps and repos
    p, role:devops, applications, *, */*, allow
    p, role:devops, repositories, *, *, allow
    p, role:devops, projects, get, *, allow

    # Map SSO groups to roles
    g, admin-team, role:admin
    g, dev-team, role:developer
    g, devops-team, role:devops

  scopes: '[groups, email]'
\`\`\`

### RBAC Policy Format

\`\`\`
p, <role/user/group>, <resource>, <action>, <object>, <allow/deny>

Resources: applications, clusters, repositories, projects, accounts, certificates, gpgkeys, logs, exec
Actions: get, create, update, delete, sync, override, action/<action-name>, *
Object: <project>/<application> or * for all
\`\`\`

### Sync Windows (Deploy Windows)

\`\`\`yaml
spec:
  syncWindows:
    - kind: allow
      schedule: '0 8 * * 1-5'
      duration: 10h
      applications: ['*']
      manualSync: true
    - kind: deny
      schedule: '0 12 * * *'
      duration: 1h
      applications: ['critical-*']
    - kind: deny
      schedule: '0 0 * * 0,6'
      duration: 24h
      applications: ['*']
\`\`\`

## Essential Commands

\`\`\`bash
# List projects
argocd proj list

# Create project
argocd proj create team-backend \\
  --src 'https://github.com/org/backend-*' \\
  --dest 'https://kubernetes.default.svc,backend-*' \\
  --description "Backend team project"

# Add source repo
argocd proj add-source team-backend https://github.com/org/new-repo.git

# Add destination
argocd proj add-destination team-backend https://kubernetes.default.svc backend-prod

# View project details
argocd proj get team-backend

# Add role
argocd proj role create team-backend developer

# Add policy to role
argocd proj role add-policy team-backend developer \\
  --action get --permission allow --object 'team-backend/*'

# Add SSO group to role
argocd proj role add-group team-backend developer backend-developers

# Add sync window
argocd proj windows add team-backend \\
  --kind allow --schedule '0 8-18 * * 1-5' --duration 10h --applications '*'
\`\`\`

## Common Mistakes

1. **Using the default project in production**: The default project allows everything. Always create specific projects with adequate restrictions.
2. **Overly restrictive whitelist**: Not including all needed resources (e.g., ServiceAccount, RoleBinding) causes partial sync failure.
3. **Forgetting clusterResourceWhitelist**: Without defining it, no cluster-scoped resources can be created (Namespace, ClusterRole, etc.).
4. **Sync windows blocking urgent deploys**: Configure \`manualSync: true\` on deny windows to allow emergency manual sync.
5. **Too permissive policy.default**: Default should be \`role:readonly\` or empty. Never use \`role:admin\` as default.
6. **Not mapping SSO groups**: Configuring SSO without mapping groups to roles leaves users without access (or with default access only).

## Killer.sh Style Challenge

**Scenario:** Configure multi-tenancy in ArgoCD for two teams.

**Tasks:**
1. Create an AppProject "team-frontend" restricted to frontend repo and frontend-* namespaces
2. Create an AppProject "team-backend" restricted to backend repo and backend-* namespaces
3. Configure roles: developer (read + sync), admin (full access)
4. Configure sync windows: allow deploy only Mon-Fri 8am-6pm
5. Configure global RBAC with policy.default: role:readonly
`,
  quiz: [
    {
      question: 'What is the main function of an AppProject in ArgoCD?',
      options: [
        'Group Git repositories',
        'Define boundaries for Applications: which repos, clusters, and namespaces can be accessed',
        'Manage Helm chart versions',
        'Monitor pod health'
      ],
      correct: 1,
      explanation: 'AppProjects define security boundaries: which repositories can be used as source, which clusters/namespaces as destination, which resources can be created, and which roles/users have access. They are ArgoCD\'s multi-tenancy mechanism.',
      reference: 'Related concept: argocd-applications — every Application must belong to a project.'
    },
    {
      question: 'What is the recommended policy.default setting for ArgoCD RBAC in production?',
      options: ['role:admin', 'role:readonly', 'role:developer', 'No default defined'],
      correct: 1,
      explanation: 'In production, policy.default should be role:readonly. This ensures authenticated users (via SSO) have read-only access by default, requiring explicit permission for actions like sync, create, or delete. Using role:admin as default is a critical security risk.',
      reference: 'Related concept: argocd-projects — roles within the project refine access beyond global RBAC.'
    },
    {
      question: 'What happens if clusterResourceWhitelist is empty in an AppProject?',
      options: [
        'All cluster-scoped resources are allowed',
        'No cluster-scoped resources can be created (Namespace, ClusterRole, etc.)',
        'Only Namespaces are allowed',
        'The project is invalid'
      ],
      correct: 1,
      explanation: 'With an empty clusterResourceWhitelist, no cluster-scoped resources can be created by the project. This includes Namespace, ClusterRole, ClusterRoleBinding, etc. If the Application needs to create namespaces, include Namespace in the whitelist or use syncOptions: CreateNamespace=true.',
      reference: 'Related concept: argocd-sync-strategies — CreateNamespace=true in syncOptions can work around the Namespace restriction.'
    },
    {
      question: 'How does a "deny" type sync window work in ArgoCD?',
      options: [
        'Allows sync only during the defined schedule',
        'Blocks any automatic or manual sync during the defined schedule',
        'Deletes Applications during the schedule',
        'Disables ArgoCD during the period'
      ],
      correct: 1,
      explanation: 'A deny window blocks syncs during the defined period. By default, it blocks both auto-sync and manual sync. Configure manualSync: true on the window to allow emergency manual sync during the deny period.',
      reference: 'Related concept: argocd-sync-strategies — sync windows complement auto-sync for deploy control.'
    },
    {
      question: 'How do you map an SSO group (e.g., GitHub team) to an ArgoCD role?',
      options: [
        'Via argocd-cm ConfigMap only',
        'Using the "g" (group) directive in policy.csv of argocd-rbac-cm',
        'Via command line only',
        'Not possible — only individual users'
      ],
      correct: 1,
      explanation: 'The "g" (group) directive in policy.csv maps groups to roles: "g, github-team-name, role:developer". This works with any OIDC provider (GitHub, GitLab, LDAP). Groups are extracted from OIDC claims defined in scopes.',
      reference: 'Related concept: argocd-architecture — the Dex Server manages OIDC/SSO authentication.'
    },
    {
      question: 'What is the precedence between namespaceResourceWhitelist and namespaceResourceBlacklist?',
      options: [
        'Whitelist takes precedence',
        'Blacklist takes precedence — resources in the blacklist are blocked even if in the whitelist',
        'They are mutually exclusive',
        'Depends on YAML order'
      ],
      correct: 1,
      explanation: 'namespaceResourceBlacklist takes precedence over namespaceResourceWhitelist. If a resource is in both lists, it will be blocked. This allows creating a broad whitelist and using the blacklist for specific exceptions.',
      reference: 'Related concept: argocd-projects — use blacklist to block dangerous resources like ResourceQuota or LimitRange.'
    },
    {
      question: 'What are orphaned resources in ArgoCD and how to monitor them?',
      options: [
        'Resources belonging to another cluster',
        'Resources in the Application namespace not managed by ArgoCD — can be monitored via orphanedResources in the project',
        'Applications without a project',
        'Resources deleted from Git'
      ],
      correct: 1,
      explanation: 'Orphaned resources are resources in the Application namespace not managed by any ArgoCD Application. Configuring orphanedResources.warn: true in the project generates alerts when orphaned resources are detected.',
      reference: 'Related concept: argocd-sync-strategies — prune removes orphaned resources that WERE managed.'
    }
  ],
  flashcards: [
    {
      front: 'What restrictions can an AppProject define?',
      back: '1. **sourceRepos** — which Git repos are allowed\n2. **destinations** — which clusters + namespaces are allowed\n3. **namespaceResourceWhitelist** — allowed NS-scoped resources\n4. **namespaceResourceBlacklist** — blocked NS-scoped resources\n5. **clusterResourceWhitelist** — allowed cluster-scoped resources\n6. **syncWindows** — when sync is allowed/blocked\n7. **roles** — who can do what\n8. **orphanedResources** — monitor unmanaged resources\n\nBlacklist > Whitelist (blacklist takes precedence)'
    },
    {
      front: 'How does ArgoCD RBAC work?',
      back: '**Casbin format:**\n```\np, <subject>, <resource>, <action>, <object>, allow/deny\ng, <group>, <role>\n```\n\n**Example:**\n```\np, role:dev, applications, get, */*, allow\np, role:dev, applications, sync, */*, allow\ng, github-devs, role:dev\n```\n\n**ConfigMap:** argocd-rbac-cm\n**Default:** policy.default: role:readonly\n\n**Resources:** applications, clusters, repositories, projects\n**Actions:** get, create, update, delete, sync, *'
    },
    {
      front: 'What are sync windows and how to configure them?',
      back: '**Sync Windows** control WHEN sync is allowed:\n\n**allow:** permits sync during the period\n**deny:** blocks sync during the period\n\n```yaml\nsyncWindows:\n  - kind: allow\n    schedule: "0 8 * * 1-5"  # cron\n    duration: 10h\n    applications: ["*"]\n    manualSync: true  # allow manual in deny\n```\n\n**Examples:**\n- Allow only business hours\n- Block weekends\n- Block peak hours (12pm-1pm)\n\n**manualSync: true** allows manual sync in deny windows (emergency).'
    },
    {
      front: 'What is the difference between global RBAC and project roles?',
      back: '**Global RBAC (argocd-rbac-cm):**\n- Affects ALL Applications and projects\n- Defined by ArgoCD admin\n- Uses policy.csv with Casbin format\n- Maps SSO groups → roles\n\n**Project Roles (AppProject.spec.roles):**\n- Affects only Applications IN the project\n- Defined by project admin\n- Scoped to the specific project\n- Complements (does not replace) global RBAC\n\n**Precedence:** global RBAC → project → default policy\n\n**Best practice:** global RBAC for general roles, project for specific roles.'
    },
    {
      front: 'How to configure SSO with GitHub in ArgoCD?',
      back: '**1. Configure Dex (argocd-cm):**\n```yaml\ndex.config: |\n  connectors:\n    - type: github\n      id: github\n      name: GitHub\n      config:\n        clientID: $dex.github.clientID\n        clientSecret: $dex.github.clientSecret\n        orgs:\n          - name: my-org\n```\n\n**2. Create OAuth App on GitHub:**\nSettings → Developer → OAuth Apps\nCallback: https://argocd.example.com/api/dex/callback\n\n**3. Map groups (argocd-rbac-cm):**\n```\ng, my-org:team-name, role:developer\n```\n\n**4. Define scopes:**\n```yaml\nscopes: "[groups, email]"\n```'
    },
    {
      front: 'Security best practices for ArgoCD in production?',
      back: '1. **Never use default project** — create projects per team\n2. **policy.default: role:readonly** — least privilege\n3. **Mandatory SSO** — disable local login in production\n4. **Restrictive clusterResourceWhitelist** — avoid ClusterRole creation\n5. **Sync windows** — block deploys outside hours\n6. **Audit logging** — enable audit logs\n7. **Per-team RBAC** — specific roles in project\n8. **Restricted source repos** — don\'t use * in production\n9. **Namespace isolation** — each team in their namespaces\n10. **External secrets** — use External Secrets or Vault'
    }
  ],
  lab: {
    scenario: 'You are the ArgoCD admin in a company with two teams (frontend and backend). You need to configure secure multi-tenancy with projects, RBAC, and sync windows.',
    objective: 'Create AppProjects with source/destination restrictions, configure RBAC with per-team roles, and define sync windows to control deploy schedules.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Restricted AppProject',
        instruction: `Create an AppProject for the backend team with source and destination restrictions.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: team-backend
  namespace: argocd
spec:
  description: "Backend team project"
  sourceRepos:
    - 'https://github.com/argoproj/argocd-example-apps.git'
  destinations:
    - namespace: 'backend-*'
      server: https://kubernetes.default.svc
  namespaceResourceWhitelist:
    - group: ''
      kind: ConfigMap
    - group: ''
      kind: Service
    - group: apps
      kind: Deployment
  clusterResourceWhitelist: []
EOF
\`\`\``,
        hints: [
          'sourceRepos accepts wildcards (*) for URLs',
          'destinations defines allowed clusters and namespaces',
          'Empty clusterResourceWhitelist blocks all cluster-scoped resources'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: team-backend
  namespace: argocd
spec:
  description: "Backend team project"
  sourceRepos:
    - 'https://github.com/argoproj/argocd-example-apps.git'
  destinations:
    - namespace: 'backend-*'
      server: https://kubernetes.default.svc
  namespaceResourceWhitelist:
    - group: ''
      kind: ConfigMap
    - group: ''
      kind: Service
    - group: apps
      kind: Deployment
  clusterResourceWhitelist: []
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify project created
argocd proj get team-backend
# Expected output: project details with restrictions

# List projects
argocd proj list
# Expected output: list containing "team-backend"
\`\`\``
      },
      {
        title: 'Test Project Restrictions',
        instruction: `Create an Application in the project and test that restrictions work.

\`\`\`bash
# This should work (repo and namespace allowed)
kubectl create namespace backend-dev
argocd app create backend-app \\
  --project team-backend \\
  --repo https://github.com/argoproj/argocd-example-apps.git \\
  --path guestbook \\
  --dest-server https://kubernetes.default.svc \\
  --dest-namespace backend-dev

# This should fail (namespace not allowed)
argocd app create frontend-app \\
  --project team-backend \\
  --repo https://github.com/argoproj/argocd-example-apps.git \\
  --path guestbook \\
  --dest-server https://kubernetes.default.svc \\
  --dest-namespace frontend-dev
\`\`\``,
        hints: [
          'The namespace backend-dev matches the pattern backend-*',
          'The namespace frontend-dev does NOT match the pattern backend-*',
          'ArgoCD rejects Applications that violate project restrictions'
        ],
        solution: `\`\`\`bash
kubectl create namespace backend-dev
argocd app create backend-app \\
  --project team-backend \\
  --repo https://github.com/argoproj/argocd-example-apps.git \\
  --path guestbook \\
  --dest-server https://kubernetes.default.svc \\
  --dest-namespace backend-dev
\`\`\``,
        verify: `\`\`\`bash
# Verify backend-app was created in correct project
argocd app get backend-app -o json | jq '.spec.project'
# Expected output: "team-backend"

# Verify frontend-app was rejected (error in previous output)
argocd app list | grep frontend-app
# Expected output: no lines (app not created)
\`\`\``
      },
      {
        title: 'Configure Global RBAC',
        instruction: `Configure RBAC in ArgoCD to define roles with different access levels.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.default: role:readonly
  policy.csv: |
    p, role:developer, applications, get, */*, allow
    p, role:developer, applications, sync, */*, allow
    p, role:developer, repositories, get, *, allow
    p, role:developer, projects, get, *, allow

    p, role:devops, applications, *, */*, allow
    p, role:devops, repositories, *, *, allow
    p, role:devops, projects, get, *, allow
    p, role:devops, clusters, get, *, allow
EOF
\`\`\``,
        hints: [
          'policy.default defines default access for authenticated users',
          'role:readonly allows only viewing — no actions',
          'Policies use Casbin format: p, subject, resource, action, object, effect'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.default: role:readonly
  policy.csv: |
    p, role:developer, applications, get, */*, allow
    p, role:developer, applications, sync, */*, allow
    p, role:developer, repositories, get, *, allow
    p, role:developer, projects, get, *, allow
    p, role:devops, applications, *, */*, allow
    p, role:devops, repositories, *, *, allow
    p, role:devops, projects, get, *, allow
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify RBAC configured
kubectl get cm argocd-rbac-cm -n argocd -o jsonpath='{.data.policy\\.default}'
# Expected output: role:readonly

# Verify policies
kubectl get cm argocd-rbac-cm -n argocd -o jsonpath='{.data.policy\\.csv}'
# Expected output: Casbin policies defined
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: `Remove the resources created during the lab.

\`\`\`bash
# Delete Application
argocd app delete backend-app -y

# Delete namespace
kubectl delete namespace backend-dev

# Keep project for reference or delete
argocd proj delete team-backend
\`\`\``,
        hints: [
          'Projects with active Applications cannot be deleted',
          'Delete Applications first, then the project',
          'The RBAC ConfigMap can be kept or reverted'
        ],
        solution: `\`\`\`bash
argocd app delete backend-app -y
kubectl delete namespace backend-dev
argocd proj delete team-backend
\`\`\``,
        verify: `\`\`\`bash
# Verify project was deleted
argocd proj list | grep team-backend
# Expected output: no lines

# Verify Application was deleted
argocd app list | grep backend-app
# Expected output: no lines
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Application rejected — "application destination is not allowed"',
      difficulty: 'easy',
      symptom: 'When creating or syncing an Application, the error "application destination {server, namespace} is not permitted in project" is returned.',
      diagnosis: `\`\`\`bash
# Check allowed destinations in project
argocd proj get <project-name> -o json | jq '.spec.destinations'

# Check Application destination
argocd app get <app-name> -o json | jq '.spec.destination'

# Compare — destination must match project pattern
\`\`\``,
      solution: `**Solutions:**

1. **Add destination to project:**
\`\`\`bash
argocd proj add-destination <project> https://kubernetes.default.svc <namespace>
\`\`\`

2. **Use wildcard in namespace:**
\`\`\`yaml
destinations:
  - namespace: 'team-*'
    server: https://kubernetes.default.svc
\`\`\`

3. **Verify server URL:** The cluster URL must match exactly. Use \`argocd cluster list\` to see registered URLs.`
    },
    {
      title: 'Sync blocked by sync window',
      difficulty: 'medium',
      symptom: 'Sync (automatic or manual) fails with error "sync not allowed by sync window" or Application stays OutOfSync without syncing.',
      diagnosis: `\`\`\`bash
# Check project sync windows
argocd proj windows list <project-name>

# Check window status
argocd proj get <project-name> -o json | jq '.spec.syncWindows'

# Check current time vs windows
date
\`\`\``,
      solution: `**Solutions:**

1. **Emergency manual sync:** If manualSync: true is configured on the window:
\`\`\`bash
argocd app sync <app-name>
\`\`\`

2. **Modify sync window:**
\`\`\`bash
# Remove restrictive window
argocd proj windows delete <project> <window-index>

# Add new window
argocd proj windows add <project> --kind allow --schedule '* * * * *' --duration 24h
\`\`\`

3. **Add manualSync to deny windows:**
\`\`\`yaml
- kind: deny
  schedule: '0 0 * * 0'
  duration: 24h
  manualSync: true  # allow manual sync in emergency
\`\`\``
    },
    {
      title: 'RBAC not working after configuring SSO',
      difficulty: 'hard',
      symptom: 'Users authenticated via SSO (GitHub/OIDC) cannot perform actions allowed by the RBAC policy. Everyone only has readonly access.',
      diagnosis: `\`\`\`bash
# Check logged-in user info
argocd account get-user-info

# Check if groups are being passed
# (In Grafana/ArgoCD UI, check OIDC token claims)

# Check configured scopes
kubectl get cm argocd-rbac-cm -n argocd -o jsonpath='{.data.scopes}'

# Check policies
kubectl get cm argocd-rbac-cm -n argocd -o yaml
\`\`\``,
      solution: `**Common causes:**

1. **Incorrect scopes:** The scopes field must include "groups" to map SSO groups:
\`\`\`yaml
data:
  scopes: '[groups, email]'
\`\`\`

2. **Wrong group name:** The group name in policy.csv must exactly match what the OIDC provider returns. For GitHub: "org:team-name".
\`\`\`yaml
g, my-org:backend-team, role:developer
\`\`\`

3. **Dex not configured for teams:** The GitHub connector needs to request the "read:org" scope:
\`\`\`yaml
dex.config: |
  connectors:
    - type: github
      config:
        loadAllGroups: true
\`\`\`

4. **Cache:** After changing RBAC, you may need to restart argocd-server:
\`\`\`bash
kubectl rollout restart deployment argocd-server -n argocd
\`\`\``
    }
  ]
};
