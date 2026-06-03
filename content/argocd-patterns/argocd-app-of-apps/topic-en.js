window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['argocd-patterns/argocd-app-of-apps'] = {
  theory: `
# App of Apps & ApplicationSets

## Relevance
Managing dozens or hundreds of Applications individually does not scale. The **App of Apps** pattern and **ApplicationSets** solve this problem: they allow creating and managing multiple Applications declaratively and automatically. They are essential for environments with multiple clusters, environments (dev/staging/prod), or teams.

## Fundamental Concepts

### App of Apps Pattern

The App of Apps pattern uses a **parent Application** that manages other Applications as its resources:

\`\`\`
Application "root-app" (parent)
  |-- Application "app-frontend"
  |-- Application "app-backend"
  |-- Application "app-database"
  |-- Application "monitoring"
  +-- Application "ingress-controller"
\`\`\`

**Git Structure:**
\`\`\`
apps/
|-- Chart.yaml          # or kustomization.yaml
|-- templates/
|   |-- frontend.yaml   # Application for frontend
|   |-- backend.yaml    # Application for backend
|   |-- database.yaml   # Application for database
|   |-- monitoring.yaml # Application for monitoring
|   +-- ingress.yaml    # Application for ingress
+-- values.yaml         # shared values
\`\`\`

### Parent Application (Root App)

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root-app
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/org/gitops-config.git
    targetRevision: main
    path: apps            # folder with Application templates
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd     # child Applications are created in argocd namespace
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
\`\`\`

### ApplicationSet — The Evolution

ApplicationSets are a CRD that generates multiple Applications automatically using **generators**:

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: cluster-apps
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - cluster: dev
            url: https://dev-cluster.example.com
          - cluster: staging
            url: https://staging-cluster.example.com
          - cluster: prod
            url: https://prod-cluster.example.com
  template:
    metadata:
      name: 'myapp-{{cluster}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/app.git
        targetRevision: main
        path: 'overlays/{{cluster}}'
      destination:
        server: '{{url}}'
        namespace: myapp
\`\`\`

### Generator Types

| Generator | Description | Use Case |
|-----------|-------------|----------|
| **List** | Explicit list of values | Known clusters/environments |
| **Cluster** | Clusters registered in ArgoCD | Auto-deploy to new clusters |
| **Git Directory** | Directories in a Git repo | One app per directory |
| **Git File** | JSON/YAML files in a repo | Config per file |
| **Matrix** | Cartesian product of 2 generators | Cluster x app combinations |
| **Merge** | Merge generators with override | Base + per-env overrides |
| **Pull Request** | Open PRs from a repo | Preview environments |
| **SCM Provider** | Repos from an org (GitHub/GitLab) | Repo autodiscovery |

### Generator: Cluster

Automatically generates Applications for each cluster registered in ArgoCD:

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: monitoring-stack
  namespace: argocd
spec:
  generators:
    - clusters:
        selector:
          matchLabels:
            environment: production
  template:
    metadata:
      name: 'monitoring-{{name}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/monitoring.git
        targetRevision: main
        path: k8s
      destination:
        server: '{{server}}'
        namespace: monitoring
\`\`\`

### Generator: Git Directory

Generates one Application for each directory in the repo:

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: microservices
  namespace: argocd
spec:
  generators:
    - git:
        repoURL: https://github.com/org/microservices.git
        revision: main
        directories:
          - path: services/*
          - path: services/deprecated
            exclude: true
  template:
    metadata:
      name: '{{path.basename}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/microservices.git
        targetRevision: main
        path: '{{path}}'
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{path.basename}}'
\`\`\`

### Generator: Matrix (Combinations)

Generates the Cartesian product of two generators:

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: all-apps-all-clusters
  namespace: argocd
spec:
  generators:
    - matrix:
        generators:
          - clusters:
              selector:
                matchLabels:
                  tier: production
          - git:
              repoURL: https://github.com/org/apps.git
              revision: main
              directories:
                - path: apps/*
  template:
    metadata:
      name: '{{path.basename}}-{{name}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/apps.git
        targetRevision: main
        path: '{{path}}'
      destination:
        server: '{{server}}'
        namespace: '{{path.basename}}'
\`\`\`

### Generator: Pull Request (Preview Environments)

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: pr-previews
  namespace: argocd
spec:
  generators:
    - pullRequest:
        github:
          owner: myorg
          repo: myapp
          tokenRef:
            secretName: github-token
            key: token
        requeueAfterSeconds: 60
  template:
    metadata:
      name: 'preview-{{number}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/myorg/myapp.git
        targetRevision: '{{head_sha}}'
        path: k8s
        kustomize:
          namePrefix: 'pr-{{number}}-'
      destination:
        server: https://kubernetes.default.svc
        namespace: 'preview-{{number}}'
      syncPolicy:
        automated:
          prune: true
        syncOptions:
          - CreateNamespace=true
\`\`\`

### ApplicationSet Sync Policy

\`\`\`yaml
spec:
  syncPolicy:
    preserveResourcesOnDeletion: false  # deletes apps when removed from generator
    applicationsSync: create-update     # create-only, create-update, create-delete
  template:
    spec:
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
\`\`\`

## Essential Commands

\`\`\`bash
# List ApplicationSets
kubectl get applicationset -n argocd

# View ApplicationSet details
kubectl get applicationset microservices -n argocd -o yaml

# View generated Applications
argocd app list | grep <appset-prefix>

# Delete ApplicationSet (and generated Applications)
kubectl delete applicationset microservices -n argocd
\`\`\`

## Common Mistakes

1. **Not using finalizer on child Applications**: If the root app is deleted without finalizers on children, resources become orphaned.
2. **ApplicationSet generating duplicate names**: If two generators produce the same Application name, there's a conflict. Use templates with unique names.
3. **Matrix generator with too many combinations**: The Cartesian product can generate hundreds of Applications. Monitor the impact on the controller.
4. **preserveResourcesOnDeletion: false in production**: If an element is removed from the generator, the Application is automatically deleted. Consider \`true\` for production.
5. **PR generator without cleanup**: Without configuring PR closed detection, preview environments stay active after merge. Configure adequate requeueAfterSeconds.
6. **App of Apps without auto-sync**: If the root app doesn't have auto-sync, new Applications added to Git are not created automatically.

## Killer.sh Style Challenge

**Scenario:** Configure a GitOps system that automatically manages Applications for multiple microservices across multiple environments.

**Tasks:**
1. Create an ApplicationSet with Git Directory generator for microservices
2. Create an ApplicationSet with Matrix generator (clusters x apps)
3. Configure preview environments for Pull Requests
4. Configure automatic cleanup when PRs are closed
`,
  quiz: [
    {
      question: 'What is the main difference between App of Apps and ApplicationSet?',
      options: [
        'They are identical in functionality',
        'App of Apps uses a parent Application with manual templates, ApplicationSet generates Applications automatically via generators',
        'App of Apps is newer than ApplicationSet',
        'ApplicationSet does not support multiple clusters'
      ],
      correct: 1,
      explanation: 'App of Apps uses a parent Application whose source contains manifests of other Applications (manually defined). ApplicationSet uses generators (list, cluster, git, matrix, etc.) to generate Applications automatically based on rules. ApplicationSet is more scalable and declarative.',
      reference: 'Related concept: argocd-applications — ApplicationSets generate Applications using the same CRD.'
    },
    {
      question: 'What does the Matrix generator do?',
      options: [
        'Generates a single Application with multiple sources',
        'Generates the Cartesian product of two generators, creating an Application for each combination',
        'Combines multiple repos into one',
        'Creates a matrix of dashboards'
      ],
      correct: 1,
      explanation: 'The Matrix generator combines two generators and generates the Cartesian product. E.g., 3 clusters x 5 apps = 15 Applications. Each combination generates a unique Application. Useful for deploying all microservices across all clusters.',
      reference: 'Related concept: argocd-app-of-apps — Matrix is ideal when you need to combine clusters with applications.'
    },
    {
      question: 'Which generator is ideal for creating preview environments for Pull Requests?',
      options: [
        'List generator',
        'Cluster generator',
        'Pull Request generator',
        'Git Directory generator'
      ],
      correct: 2,
      explanation: 'The Pull Request generator creates an Application for each open PR in the repository. When the PR is closed/merged, the Application (and preview namespace) are automatically removed. Ideal for ephemeral test/review environments.',
      reference: 'Related concept: argocd-sync-strategies — use syncPolicy.automated with prune and CreateNamespace for preview environments.'
    },
    {
      question: 'What happens with preserveResourcesOnDeletion: false in an ApplicationSet?',
      options: [
        'Kubernetes resources are preserved',
        'When an element is removed from the generator, the Application AND its resources are automatically deleted',
        'The ApplicationSet is protected from deletion',
        'Only the Application is removed, resources stay in the cluster'
      ],
      correct: 1,
      explanation: 'With preserveResourcesOnDeletion: false (default), removing an element from the generator causes the ApplicationSet to delete the corresponding Application, which in turn deletes cluster resources (if it has a finalizer). In production, consider true for additional protection.',
      reference: 'Related concept: argocd-applications — the finalizer on the Application controls whether resources are deleted together.'
    },
    {
      question: 'How does the Git Directory generator decide how many Applications to create?',
      options: [
        'Based on the number of YAML files',
        'One Application for each directory matching the configured path pattern',
        'Based on labels in files',
        'Based on the number of branches'
      ],
      correct: 1,
      explanation: 'The Git Directory generator creates one Application for each directory matching the path pattern (e.g., services/*). New directories are automatically detected and generate new Applications. Directories can be excluded with exclude: true.',
      reference: 'Related concept: argocd-app-of-apps — compare Git Directory vs Git File generator for different needs.'
    },
    {
      question: 'What is the advantage of the Cluster generator over the List generator?',
      options: [
        'It is faster',
        'It automatically detects new clusters registered in ArgoCD without modifying the ApplicationSet',
        'It supports more clusters',
        'It is more secure'
      ],
      correct: 1,
      explanation: 'The Cluster generator automatically detects clusters registered in ArgoCD. When a new cluster is added (and matches the selector), the ApplicationSet automatically creates an Application for it. The List generator requires manual YAML update.',
      reference: 'Related concept: argocd-advanced — multi-cluster management is optimized with the Cluster generator.'
    },
    {
      question: 'In an App of Apps structure, where should child Applications be created?',
      options: [
        'In the target application namespace',
        'In the argocd namespace (same namespace as ArgoCD)',
        'In a dedicated namespace for apps',
        'In any namespace'
      ],
      correct: 1,
      explanation: 'Child Applications, like any ArgoCD Application, must be created in the argocd namespace. The root app has destination.namespace: argocd, and each child Application defines its own destination for the actual application namespace.',
      reference: 'Related concept: argocd-applications — Applications always reside in the argocd namespace.'
    }
  ],
  flashcards: [
    {
      front: 'App of Apps vs ApplicationSet — when to use each?',
      back: '**App of Apps:**\n- Simple, easy to understand\n- Manual control over each Application\n- Good for small number of apps (< 20)\n- Uses Helm/Kustomize for templates\n\n**ApplicationSet:**\n- Scalable, automated\n- Generators create apps automatically\n- Ideal for many apps or clusters\n- Supports preview envs (PR generator)\n- Automatic change detection\n\n**Rule:** if there\'s a repetitive pattern, use ApplicationSet. If each app is unique, use App of Apps.'
    },
    {
      front: 'What are the ApplicationSet generators?',
      back: '| Generator | Source | Use |\n|-----------|--------|-----|\n| **List** | explicit values | known clusters |\n| **Cluster** | ArgoCD clusters | auto-detect clusters |\n| **Git Directory** | dirs in repo | app per directory |\n| **Git File** | files in repo | config per file |\n| **Matrix** | 2 generators | combinations |\n| **Merge** | generators + override | base + overrides |\n| **Pull Request** | open PRs | preview envs |\n| **SCM Provider** | org repos | autodiscovery |\n\nMatrix generates Cartesian product. Merge allows per-environment overrides.'
    },
    {
      front: 'How does the Git Directory generator work?',
      back: '**Config:**\n```yaml\ngenerators:\n  - git:\n      repoURL: https://github.com/org/apps.git\n      revision: main\n      directories:\n        - path: services/*\n        - path: services/deprecated\n          exclude: true\n```\n\n**Result:**\nIf repo has:\n```\nservices/\n  frontend/\n  backend/\n  api/\n  deprecated/\n```\n\nGenerates 3 Applications: frontend, backend, api\n(deprecated excluded)\n\n**Variables:** {{path}}, {{path.basename}}'
    },
    {
      front: 'How to configure preview environments with ApplicationSet?',
      back: '```yaml\ngenerators:\n  - pullRequest:\n      github:\n        owner: myorg\n        repo: myapp\n        tokenRef:\n          secretName: github-token\n          key: token\n      requeueAfterSeconds: 60\ntemplate:\n  metadata:\n    name: "preview-{{number}}"\n  spec:\n    source:\n      targetRevision: "{{head_sha}}"\n      path: k8s\n    destination:\n      namespace: "preview-{{number}}"\n    syncPolicy:\n      automated:\n        prune: true\n      syncOptions:\n        - CreateNamespace=true\n```\n\nCreates env per PR, removes on close.'
    },
    {
      front: 'How does the Matrix generator work?',
      back: '**Concept:** Cartesian product of 2 generators\n\n**Example:** 3 clusters x 2 apps = 6 Applications\n```yaml\ngenerators:\n  - matrix:\n      generators:\n        - clusters:\n            selector:\n              matchLabels:\n                tier: production\n        - list:\n            elements:\n              - app: frontend\n              - app: backend\ntemplate:\n  metadata:\n    name: "{{app}}-{{name}}"\n```\n\n**Result:**\n- frontend-cluster1\n- frontend-cluster2\n- frontend-cluster3\n- backend-cluster1\n- backend-cluster2\n- backend-cluster3'
    },
    {
      front: 'What are the ApplicationSet-specific sync policies?',
      back: '**ApplicationSet syncPolicy:**\n```yaml\nspec:\n  syncPolicy:\n    preserveResourcesOnDeletion: false\n    applicationsSync: create-update\n```\n\n**preserveResourcesOnDeletion:**\n- false (default): deletes apps when removed from generator\n- true: preserves apps (safe for production)\n\n**applicationsSync:**\n- create-only: only creates, doesn\'t update\n- create-update: creates and updates\n- create-delete: creates and deletes (no update)\n\n**Application syncPolicy (in template):**\n```yaml\ntemplate:\n  spec:\n    syncPolicy:\n      automated:\n        prune: true\n        selfHeal: true\n```'
    }
  ],
  lab: {
    scenario: 'You need to manage multiple Applications in a scalable way using the App of Apps pattern and ApplicationSets.',
    objective: 'Create an App of Apps structure, migrate to ApplicationSet with Git Directory generator, and explore advanced generators.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create App of Apps',
        instruction: `Create a parent Application that manages multiple child Applications.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root-app
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: apps
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
EOF

argocd app sync root-app
\`\`\``,
        hints: [
          'The root app creates Applications in the argocd namespace',
          'The "apps" path contains child Application manifests',
          'Child Applications manage the actual resources in target namespaces'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root-app
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: apps
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
EOF
\`\`\``,
        verify: `\`\`\`bash
argocd app get root-app
# Expected output: Synced, Healthy

argocd app list
# Expected output: root-app + child Applications
\`\`\``
      },
      {
        title: 'Create ApplicationSet with List Generator',
        instruction: `Create an ApplicationSet that generates Applications for multiple environments using the List generator.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: multi-env
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - env: dev
            namespace: guestbook-dev
          - env: staging
            namespace: guestbook-staging
  template:
    metadata:
      name: 'guestbook-{{env}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/argoproj/argocd-example-apps.git
        targetRevision: HEAD
        path: guestbook
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{namespace}}'
      syncPolicy:
        automated:
          prune: true
        syncOptions:
          - CreateNamespace=true
EOF
\`\`\``,
        hints: [
          'The List generator creates one Application for each element in the list',
          'Variables {{env}} and {{namespace}} are replaced by element values',
          'Each Application is independent — can have its own sync status'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: multi-env
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - env: dev
            namespace: guestbook-dev
          - env: staging
            namespace: guestbook-staging
  template:
    metadata:
      name: 'guestbook-{{env}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/argoproj/argocd-example-apps.git
        targetRevision: HEAD
        path: guestbook
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{namespace}}'
      syncPolicy:
        automated:
          prune: true
        syncOptions:
          - CreateNamespace=true
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get applicationset -n argocd
# Expected output: multi-env

argocd app list | grep guestbook
# Expected output: guestbook-dev and guestbook-staging
\`\`\``
      },
      {
        title: 'Verify and Explore Generated Applications',
        instruction: `Examine the Applications generated by the ApplicationSet and verify their operation.

\`\`\`bash
argocd app get guestbook-dev
argocd app get guestbook-staging

argocd app resources guestbook-dev
argocd app resources guestbook-staging

kubectl get applicationset multi-env -n argocd -o yaml | head -40
\`\`\``,
        hints: [
          'Each generated Application is independent and has its own lifecycle',
          'The ApplicationSet owner reference links Applications to the ApplicationSet',
          'Deleting the ApplicationSet deletes all generated Applications'
        ],
        solution: `\`\`\`bash
argocd app get guestbook-dev
argocd app get guestbook-staging
\`\`\``,
        verify: `\`\`\`bash
argocd app get guestbook-dev -o json | jq '.status.sync.status'
# Expected output: "Synced"

argocd app get guestbook-staging -o json | jq '.status.sync.status'
# Expected output: "Synced"
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: `Remove the resources created during the lab.

\`\`\`bash
kubectl delete applicationset multi-env -n argocd
argocd app delete root-app -y
kubectl delete namespace guestbook-dev guestbook-staging --ignore-not-found
\`\`\``,
        hints: [
          'Deleting the ApplicationSet automatically deletes generated Applications',
          'Namespaces need to be cleaned separately if CreateNamespace was used',
          'Verify no orphaned Applications remain'
        ],
        solution: `\`\`\`bash
kubectl delete applicationset multi-env -n argocd
argocd app delete root-app -y
kubectl delete namespace guestbook-dev guestbook-staging --ignore-not-found
\`\`\``,
        verify: `\`\`\`bash
kubectl get applicationset -n argocd
# Expected output: none

argocd app list | grep guestbook
# Expected output: no lines
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ApplicationSet does not generate Applications',
      difficulty: 'easy',
      symptom: 'The ApplicationSet was created but no Applications are generated. kubectl get applicationset shows the resource but argocd app list does not show expected Applications.',
      diagnosis: `\`\`\`bash
kubectl get applicationset <name> -n argocd -o yaml | tail -20
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-applicationset-controller --tail=30
kubectl get applicationset <name> -n argocd -o json | jq '.spec.generators'
\`\`\``,
      solution: `**Common causes:**

1. **Empty generator:** The generator produces no elements. Check configuration (e.g., Git Directory with no matching directories).

2. **Template with error:** If the template has invalid fields, the controller cannot generate Applications.

3. **Controller not installed:** The ApplicationSet Controller is separate. Verify the pod exists:
\`\`\`bash
kubectl get pod -n argocd -l app.kubernetes.io/name=argocd-applicationset-controller
\`\`\`

4. **Insufficient permissions:** The controller needs permissions to create Applications in the argocd namespace.`
    },
    {
      title: 'Matrix generator creates too many Applications',
      difficulty: 'medium',
      symptom: 'The Matrix generator created hundreds of unexpected Applications, overloading the ArgoCD controller.',
      diagnosis: `\`\`\`bash
argocd app list | wc -l
kubectl get applicationset <name> -n argocd -o json | jq '.spec.generators[0].matrix.generators | .[0], .[1]'
kubectl top pod -n argocd -l app.kubernetes.io/name=argocd-application-controller
\`\`\``,
      solution: `**Solutions:**

1. **Add filters to generators:**
\`\`\`yaml
- clusters:
    selector:
      matchLabels:
        tier: production
- git:
    directories:
      - path: apps/critical-*
\`\`\`

2. **Limit the ApplicationSet:** Use applicationsSync: create-only to avoid massive updates.

3. **Split into smaller ApplicationSets:** Instead of one large Matrix, create separate ApplicationSets per team or scope.

4. **Increase controller resources:**
\`\`\`yaml
controller:
  resources:
    requests:
      cpu: "1"
      memory: 2Gi
\`\`\``
    },
    {
      title: 'Preview environments not cleaned up after PR merge',
      difficulty: 'hard',
      symptom: 'Preview namespaces (preview-123, preview-456) continue to exist even after PRs are merged/closed.',
      diagnosis: `\`\`\`bash
kubectl get applicationset pr-previews -n argocd -o json | jq '.status'
argocd app list | grep preview
kubectl get secret github-token -n argocd -o jsonpath='{.data.token}' | base64 -d | head -c 10
\`\`\``,
      solution: `**Causes and solutions:**

1. **Expired token:** The PR generator needs a valid token to query PRs. Renew the token.

2. **requeueAfterSeconds too high:** Reduce for faster detection of closed PRs:
\`\`\`yaml
requeueAfterSeconds: 30
\`\`\`

3. **preserveResourcesOnDeletion: true:** If configured, Applications are not automatically deleted:
\`\`\`yaml
syncPolicy:
  preserveResourcesOnDeletion: false
\`\`\`

4. **Clean up manually:**
\`\`\`bash
argocd app delete preview-123 -y
kubectl delete namespace preview-123
\`\`\`

5. **Add TTL:** Consider using a CronJob to clean old namespaces based on annotations with creation timestamp.`
    }
  ]
};
