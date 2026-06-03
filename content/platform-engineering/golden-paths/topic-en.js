window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['platform-engineering/golden-paths'] = {
  theory: `
# Golden Paths & Self-Service

## Relevance
Golden Paths are standardized and optimized workflows offered by the internal platform that allow developers to perform common tasks (deploy, create service, provision infra) quickly, securely, and without dependencies. Self-service is the mechanism that enables these paths autonomously. Together, they are the operational core of an IDP.

## Fundamental Concepts

### What are Golden Paths?

Golden Paths (also called "Paved Roads" or "Happy Paths") are recommended and optimized paths for common development tasks:

\`\`\`
┌─────────────────────────────────────────────┐
│              Golden Paths                   │
├─────────────────────────────────────────────┤
│                                             │
│  "New Microservice"                         │
│   Template → Repo → CI/CD → Deploy → Obs   │
│                                             │
│  "New API"                                  │
│   OpenAPI → Codegen → Gateway → Docs        │
│                                             │
│  "New Database"                             │
│   Request → Provisioning → Secrets → App    │
│                                             │
│  "New Environment"                          │
│   Namespace → RBAC → Quotas → GitOps        │
│                                             │
└─────────────────────────────────────────────┘
\`\`\`

**Essential characteristics:**
- **Recommended, not mandatory** — devs can leave the path if needed
- **Secure by default** — security, compliance, and best practices built-in
- **Tested and maintained** — the platform ensures they work
- **Documented** — clear instructions, examples, and troubleshooting
- **Automated** — minimize manual steps

### Self-Service: The Engine of Golden Paths

\`\`\`
Traditional Model (Ticket-driven):
  Dev → Ticket → Approval → Ops → Execution → 3-5 days

Self-Service Model:
  Dev → Portal/CLI → Automation → Ready in minutes
\`\`\`

#### Self-Service Levels

| Level | Description | Example |
|-------|-------------|---------|
| 0. Manual | Tickets and docs | "Open a Jira to create namespace" |
| 1. Assisted | Templates + docs | "Use this Helm chart and follow guide" |
| 2. Portal | UI with forms | "Fill the form in Backstage" |
| 3. API/CLI | Programmatic | "Use \`platform create service\`" |
| 4. GitOps | Declarative | "Commit a YAML to the infra repo" |

### Anatomy of a Golden Path

A complete golden path for "Create new microservice":

\`\`\`
┌─────────────────────────────────────────────────┐
│  1. SCAFFOLDING                                 │
│     Template generates: code, Dockerfile,       │
│     CI config, Helm chart, catalog-info.yaml    │
├─────────────────────────────────────────────────┤
│  2. REPOSITORY                                  │
│     GitHub repo created automatically           │
│     Branch protection, CODEOWNERS configured    │
├─────────────────────────────────────────────────┤
│  3. CI/CD PIPELINE                              │
│     GitHub Actions / Tekton configured          │
│     Build, test, scan, push image               │
├─────────────────────────────────────────────────┤
│  4. DEPLOY                                      │
│     ArgoCD Application created                  │
│     Namespace, RBAC, quotas provisioned         │
├─────────────────────────────────────────────────┤
│  5. OBSERVABILITY                               │
│     Prometheus ServiceMonitor created           │
│     Grafana dashboard provisioned               │
│     Basic alerts configured                     │
├─────────────────────────────────────────────────┤
│  6. REGISTRATION                                │
│     Registered in Backstage Catalog             │
│     TechDocs configured                         │
│     API documented                              │
└─────────────────────────────────────────────────┘
\`\`\`

### Platform API with Crossplane

Crossplane allows exposing infrastructure abstractions as native Kubernetes APIs (custom CRDs):

\`\`\`yaml
# Define an abstraction: CompositeResourceDefinition (XRD)
apiVersion: apiextensions.crossplane.io/v1
kind: CompositeResourceDefinition
metadata:
  name: xdatabases.platform.example.com
spec:
  group: platform.example.com
  names:
    kind: XDatabase
    plural: xdatabases
  claimNames:
    kind: Database
    plural: databases
  versions:
    - name: v1alpha1
      served: true
      referenceable: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                engine:
                  type: string
                  enum: ["postgres", "mysql"]
                size:
                  type: string
                  enum: ["small", "medium", "large"]
              required:
                - engine
                - size
\`\`\`

\`\`\`yaml
# Composition: what happens when someone requests a Database
apiVersion: apiextensions.crossplane.io/v1
kind: Composition
metadata:
  name: database-aws
  labels:
    provider: aws
spec:
  compositeTypeRef:
    apiVersion: platform.example.com/v1alpha1
    kind: XDatabase
  resources:
    - name: rds-instance
      base:
        apiVersion: rds.aws.upbound.io/v1beta1
        kind: Instance
        spec:
          forProvider:
            region: us-east-1
            engine: postgres
            instanceClass: db.t3.micro
            allocatedStorage: 20
            skipFinalSnapshot: true
      patches:
        - fromFieldPath: "spec.engine"
          toFieldPath: "spec.forProvider.engine"
        - fromFieldPath: "spec.size"
          toFieldPath: "spec.forProvider.instanceClass"
          transforms:
            - type: map
              map:
                small: db.t3.micro
                medium: db.t3.medium
                large: db.t3.large
\`\`\`

\`\`\`yaml
# What the dev requests (Claim) — simple interface
apiVersion: platform.example.com/v1alpha1
kind: Database
metadata:
  name: orders-db
  namespace: team-orders
spec:
  engine: postgres
  size: medium
\`\`\`

### GitOps as Self-Service

Using ArgoCD ApplicationSet for GitOps-based self-service:

\`\`\`yaml
# ApplicationSet: auto-generates ArgoCD Apps based on folder structure
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: team-apps
  namespace: argocd
spec:
  generators:
    - git:
        repoURL: https://github.com/org/platform-config
        revision: HEAD
        directories:
          - path: 'teams/*/apps/*'
  template:
    metadata:
      name: '{{path[2]}}-{{path[4]}}'
    spec:
      project: '{{path[2]}}'
      source:
        repoURL: https://github.com/org/platform-config
        targetRevision: HEAD
        path: '{{path}}'
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{path[2]}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
\`\`\`

\`\`\`
# GitOps repo structure
platform-config/
  teams/
    team-orders/
      apps/
        order-service/
          kustomization.yaml
          deployment.yaml
          service.yaml
        payment-service/
          ...
    team-users/
      apps/
        user-service/
          ...
\`\`\`

### Namespace Self-Service with Kyverno

\`\`\`yaml
# ClusterPolicy: auto-configures namespaces created by devs
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: namespace-defaults
spec:
  rules:
    - name: add-resource-quota
      match:
        any:
          - resources:
              kinds:
                - Namespace
              selector:
                matchLabels:
                  platform.example.com/managed: "true"
      generate:
        apiVersion: v1
        kind: ResourceQuota
        name: default-quota
        namespace: "{{request.object.metadata.name}}"
        data:
          spec:
            hard:
              requests.cpu: "4"
              requests.memory: 8Gi
              limits.cpu: "8"
              limits.memory: 16Gi
              pods: "50"

    - name: add-network-policy
      match:
        any:
          - resources:
              kinds:
                - Namespace
              selector:
                matchLabels:
                  platform.example.com/managed: "true"
      generate:
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        name: default-deny-ingress
        namespace: "{{request.object.metadata.name}}"
        data:
          spec:
            podSelector: {}
            policyTypes:
              - Ingress
\`\`\`

### Platform CLI

Example CLI that abstracts common operations:

\`\`\`bash
# Platform CLI — command examples
platform create service \\
  --name order-service \\
  --team team-orders \\
  --language go \\
  --with-database postgres

platform create namespace \\
  --name team-orders-staging \\
  --team team-orders \\
  --environment staging \\
  --quota medium

platform deploy \\
  --service order-service \\
  --environment production \\
  --version v1.2.3

platform status \\
  --service order-service \\
  --all-envs
\`\`\`

### Measuring Golden Path Effectiveness

| Metric | How to measure | Target |
|--------|---------------|--------|
| Time to first deploy | Time from create to 1st deploy | < 30 min |
| Golden path adoption | % teams using golden paths | > 80% |
| Self-service ratio | Self-service vs manual tickets | > 90% |
| Developer NPS | Quarterly survey | > 40 |
| Onboarding time | New dev -> first contribution | < 1 day |
| Incidents from non-golden | Incidents from those not using golden path | Track |

### Common Mistakes

1. **Single golden path** — there is no "one size fits all"; offer variants per language/stack
2. **Outdated path** — templates generating code with outdated deps lose trust
3. **No escape hatch** — devs NEED to be able to leave the golden path when necessary
4. **Complex self-service** — if the form has 30 fields, nobody will use it
5. **No feedback loop** — not collecting usage and satisfaction metrics
6. **Security as afterthought** — security should be built into the golden path, not added later

## Killer.sh Style Challenge

> **Scenario:** Design golden paths for an organization with 3 languages (Go, Java, Python), 2 environments (staging, production), and need to provision databases. Define: (1) which golden paths to create, (2) how to implement self-service with Crossplane + ArgoCD, (3) which metrics to use to validate adoption.
`,
  quiz: [
    {
      question: 'What are Golden Paths in Platform Engineering?',
      options: [
        'Optimized network routes between pods',
        'Standardized and recommended workflows for common tasks that are secure by default but not mandatory',
        'Fixed CI/CD pipelines that everyone must follow',
        'Mandatory security policies'
      ],
      correct: 1,
      explanation: 'Golden Paths are recommended and optimized paths for tasks like creating services, deploying, provisioning infra. They are secure by default, tested and maintained by the platform, but devs can leave the path if needed.',
      reference: 'Related concept: Also called "Paved Roads" or "Happy Paths".'
    },
    {
      question: 'What is the role of Crossplane in an IDP?',
      options: [
        'Managing Docker containers',
        'Exposing infrastructure abstractions as native Kubernetes APIs (CRDs) for self-service',
        'Monitoring applications',
        'Managing DNS'
      ],
      correct: 1,
      explanation: 'Crossplane allows defining infrastructure abstractions as XRDs (CompositeResourceDefinitions) and Compositions. Devs request resources via simple Claims (e.g., Database with engine and size) and Crossplane provisions the actual infrastructure.',
      reference: 'Related concept: XRD defines the interface, Composition defines the implementation, Claim is the dev request.'
    },
    {
      question: 'How does ArgoCD ApplicationSet enable self-service?',
      options: [
        'Creating CI pipelines automatically',
        'Auto-generating ArgoCD Applications based on patterns (e.g., folder structure in GitOps repo)',
        'Provisioning Kubernetes clusters',
        'Managing Vault secrets'
      ],
      correct: 1,
      explanation: 'ApplicationSet uses generators (git, list, cluster) to auto-generate ArgoCD Applications. For example, a git generator can create an app for each folder in teams/*/apps/*, enabling self-service via commits.',
      reference: 'Related concept: Devs do self-service via Git commits — adding a folder = new app deployed.'
    },
    {
      question: 'Why should Golden Paths NOT be mandatory?',
      options: [
        'Because they are not secure',
        'Because forcing adoption creates resistance and special cases may need different approaches',
        'Because they are too expensive to maintain',
        'Because they only work with Kubernetes'
      ],
      correct: 1,
      explanation: 'Forcing adoption creates resistance and shadow IT. Golden Paths should be so good that devs WANT to use them. Additionally, special cases (ML workloads, legacy, compliance) may need approaches outside the golden path.',
      reference: 'Related concept: The principle is "attract, not mandate".'
    },
    {
      question: 'What is the highest level of self-service in a platform?',
      options: [
        'Portal with forms',
        'Programmatic CLI',
        'Declarative GitOps — commit YAML to repo and automation provisions',
        'Automated tickets'
      ],
      correct: 2,
      explanation: 'Declarative GitOps is the highest level: devs commit YAML to the infra repo and automation (ArgoCD/Flux) provisions everything. It is auditable, versioned, and reproducible without any special interface.',
      reference: 'Related concept: Levels: Manual → Assisted → Portal → API/CLI → GitOps.'
    },
    {
      question: 'What is a Crossplane Claim?',
      options: [
        'An access credential',
        'A resource request with simplified interface that the dev makes to Crossplane',
        'A type of ServiceAccount',
        'A Backstage Catalog registration'
      ],
      correct: 1,
      explanation: 'A Claim is the simplified interface the dev uses to request resources. Example: kind: Database with spec.engine: postgres and spec.size: medium. Crossplane resolves the Claim to actual resources via Composition.',
      reference: 'Related concept: Claim is namespaced, XR (Composite Resource) is cluster-scoped.'
    },
    {
      question: 'Which metric best indicates if Golden Paths are working?',
      options: [
        'Number of deployments per day',
        'Self-service ratio (percentage of provisioning via self-service vs manual tickets)',
        'Number of running pods',
        'Container sizes'
      ],
      correct: 1,
      explanation: 'The self-service ratio directly measures golden path effectiveness: if devs still open manual tickets, the golden path is not meeting needs. The typical target is > 90% of operations via self-service.',
      reference: 'Related concept: Complement with Developer NPS, time-to-first-deploy, and onboarding time.'
    }
  ],
  flashcards: [
    {
      front: 'What is a Golden Path and what are its characteristics?',
      back: '**Golden Path** = standardized and optimized workflow for common tasks.\n\n**Characteristics:**\n- Recommended, NOT mandatory\n- Secure by default (security built-in)\n- Tested and maintained by the platform\n- Documented with examples\n- Automated (minimal manual steps)\n\n**Examples:**\n- Create new microservice\n- Provision database\n- Configure CI/CD pipeline\n- Create new environment\n\n**Principle:** "Attract, not mandate"'
    },
    {
      front: 'What are the self-service levels?',
      back: '| Level | Mechanism | Example |\n|-------|-----------|--------|\n| 0. Manual | Tickets | Jira + Ops |\n| 1. Assisted | Templates + docs | Helm chart + guide |\n| 2. Portal | UI with forms | Backstage Scaffolder |\n| 3. API/CLI | Programmatic | platform CLI |\n| 4. GitOps | Declarative | Commit YAML |\n\n**Target:** Reach at least level 2-3.\n**Ideal:** Level 4 (GitOps) for infra operations.'
    },
    {
      front: 'How does Crossplane enable infra self-service?',
      back: '**3 components:**\n\n1. **XRD (CompositeResourceDefinition)**\n   Defines the interface: which fields the dev fills\n   E.g.: engine (postgres/mysql), size (small/medium/large)\n\n2. **Composition**\n   Defines the implementation: what to provision\n   E.g.: RDS Instance, SecurityGroup, Secret\n   Uses patches to map XRD fields to resources\n\n3. **Claim**\n   What the dev requests (namespaced)\n   E.g.: kind: Database, spec.engine: postgres\n\n**Result:** Dev asks for "Database postgres medium" and gets configured RDS.'
    },
    {
      front: 'How does ApplicationSet enable self-service via GitOps?',
      back: '**ApplicationSet** auto-generates ArgoCD Applications based on generators.\n\n**Example with git generator:**\n- Monitors folders in teams/*/apps/*\n- For each folder, creates an ArgoCD Application\n- Dev adds folder = new app deployed\n\n**Self-service flow:**\n1. Dev creates folder teams/my-team/apps/new-service/\n2. Adds kustomization.yaml + manifests\n3. Commit + push\n4. ApplicationSet detects new folder\n5. ArgoCD creates app and syncs\n\n**Advantage:** 100% GitOps, auditable, no portal needed.'
    },
    {
      front: 'Which metrics measure Golden Path effectiveness?',
      back: '| Metric | Target |\n|--------|--------|\n| Time to first deploy | < 30 min |\n| Golden path adoption | > 80% |\n| Self-service ratio | > 90% |\n| Developer NPS | > 40 |\n| Onboarding time | < 1 day |\n| Incidents from non-golden | Track |\n\n**How to collect:**\n- DORA metrics pipeline\n- Quarterly surveys\n- Portal/CLI usage logs\n- Manual ticket count\n- Incident tracking by origin'
    },
    {
      front: 'What is Namespace self-service with Kyverno?',
      back: '**Kyverno ClusterPolicy** can auto-configure namespaces:\n\nWhen a namespace with label managed=true is created:\n1. **ResourceQuota** generated automatically\n2. **NetworkPolicy** default-deny created\n3. **LimitRange** applied\n4. **RBAC** RoleBinding created for the team\n\n**How it works:**\n- Rules of type generate\n- Match by label selector\n- Namespace receives all defaults automatically\n\n**Result:** Dev creates namespace with a label and gets all security configuration and quotas.'
    },
    {
      front: 'What common mistakes when implementing Golden Paths?',
      back: '1. **Single golden path** — offer variants per stack\n2. **Outdated path** — templates with old deps\n3. **No escape hatch** — devs NEED to be able to leave\n4. **Complex self-service** — forms with 30 fields\n5. **No feedback loop** — not measuring usage/satisfaction\n6. **Security as afterthought** — should be built-in\n\n**Design principles:**\n- Start small (1-2 golden paths)\n- Iterate based on feedback\n- Measure and optimize\n- Security by default\n- Documentation as part of the path'
    }
  ],
  lab: {
    scenario: 'You need to implement self-service golden paths using Crossplane for infra, ArgoCD for deploy, and Kyverno for namespace automation.',
    objective: 'Create infrastructure abstractions with Crossplane, configure ApplicationSet for GitOps self-service, and namespace automation with Kyverno.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create database abstraction with Crossplane',
        instruction: `Create the Crossplane manifests for database self-service:
1. A **CompositeResourceDefinition (XRD)** called \`xdatabases.platform.example.com\` with fields: engine (enum: postgres, mysql) and size (enum: small, medium, large)
2. An example **Claim**: kind Database, engine postgres, size small, in namespace team-orders`,
        hints: [
          'XRD uses apiVersion: apiextensions.crossplane.io/v1',
          'ClaimNames defines the kind the dev uses (namespaced)',
          'The Claim uses the group and kind defined in the XRD'
        ],
        solution: `\`\`\`yaml
# xrd-database.yaml
apiVersion: apiextensions.crossplane.io/v1
kind: CompositeResourceDefinition
metadata:
  name: xdatabases.platform.example.com
spec:
  group: platform.example.com
  names:
    kind: XDatabase
    plural: xdatabases
  claimNames:
    kind: Database
    plural: databases
  versions:
    - name: v1alpha1
      served: true
      referenceable: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                engine:
                  type: string
                  enum: ["postgres", "mysql"]
                size:
                  type: string
                  enum: ["small", "medium", "large"]
              required:
                - engine
                - size
---
# claim-orders-db.yaml
apiVersion: platform.example.com/v1alpha1
kind: Database
metadata:
  name: orders-db
  namespace: team-orders
spec:
  engine: postgres
  size: small
\`\`\``,
        verify: `\`\`\`bash
# Verify the XRD
kubectl get xrd xdatabases.platform.example.com
# Expected output: XRD listed with ESTABLISHED=True

# Verify the Claim CRD was created
kubectl get crd databases.platform.example.com
# Expected output: CRD listed

# Verify the Claim
kubectl get databases -n team-orders
# Expected output: orders-db listed
\`\`\``
      },
      {
        title: 'Configure ArgoCD ApplicationSet for self-service',
        instruction: `Create an **ApplicationSet** that auto-generates ArgoCD Applications based on the GitOps repo folder structure:
- Repository: https://github.com/org/platform-config
- Folder pattern: teams/*/apps/*
- Each folder generates an app named \`{team}-{app}\`
- Namespace = team name
- SyncPolicy automated with prune and selfHeal`,
        hints: [
          'Use git generator with directories',
          'path[2] = team name, path[4] = app name',
          'syncPolicy.automated enables auto-sync'
        ],
        solution: `\`\`\`yaml
# applicationset-teams.yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: team-apps
  namespace: argocd
spec:
  generators:
    - git:
        repoURL: https://github.com/org/platform-config
        revision: HEAD
        directories:
          - path: 'teams/*/apps/*'
  template:
    metadata:
      name: '{{path[2]}}-{{path[4]}}'
      labels:
        team: '{{path[2]}}'
        app: '{{path[4]}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/platform-config
        targetRevision: HEAD
        path: '{{path}}'
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{path[2]}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        syncOptions:
          - CreateNamespace=true
\`\`\``,
        verify: `\`\`\`bash
# Apply the ApplicationSet
kubectl apply -f applicationset-teams.yaml

# Verify the ApplicationSet was created
kubectl get applicationset -n argocd team-apps
# Expected output: team-apps listed

# Verify generated apps (if folders exist in repo)
kubectl get applications -n argocd -l team
# Expected output: apps generated for each teams/*/apps/* folder
\`\`\``
      },
      {
        title: 'Create namespace automation with Kyverno',
        instruction: `Create a Kyverno **ClusterPolicy** that, when creating a namespace with the label \`platform.example.com/managed: "true"\`, automatically generates:
1. A **ResourceQuota** with CPU limits (8 cores), memory (16Gi), and pods (50)
2. A **NetworkPolicy** default-deny for ingress`,
        hints: [
          'Use rules with generate to create resources automatically',
          'Match by label selector on the namespace',
          'Each generate rule creates a resource in the newly created namespace'
        ],
        solution: `\`\`\`yaml
# policy-namespace-defaults.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: namespace-defaults
spec:
  rules:
    - name: generate-resource-quota
      match:
        any:
          - resources:
              kinds:
                - Namespace
              selector:
                matchLabels:
                  platform.example.com/managed: "true"
      generate:
        apiVersion: v1
        kind: ResourceQuota
        name: default-quota
        namespace: "{{request.object.metadata.name}}"
        synchronize: true
        data:
          spec:
            hard:
              requests.cpu: "4"
              requests.memory: 8Gi
              limits.cpu: "8"
              limits.memory: 16Gi
              pods: "50"

    - name: generate-network-policy
      match:
        any:
          - resources:
              kinds:
                - Namespace
              selector:
                matchLabels:
                  platform.example.com/managed: "true"
      generate:
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        name: default-deny-ingress
        namespace: "{{request.object.metadata.name}}"
        synchronize: true
        data:
          spec:
            podSelector: {}
            policyTypes:
              - Ingress
---
# Test: create managed namespace
apiVersion: v1
kind: Namespace
metadata:
  name: team-orders-dev
  labels:
    platform.example.com/managed: "true"
    team: team-orders
    environment: dev
\`\`\``,
        verify: `\`\`\`bash
# Apply the policy
kubectl apply -f policy-namespace-defaults.yaml

# Verify the policy is ready
kubectl get clusterpolicy namespace-defaults
# Expected output: namespace-defaults with READY=true

# Create test namespace
kubectl create namespace test-golden-path --dry-run=client -o yaml | \\
  kubectl label --local -f - platform.example.com/managed=true -o yaml | \\
  kubectl apply -f -

# Verify generated resources
kubectl get resourcequota -n test-golden-path
# Expected output: default-quota listed

kubectl get networkpolicy -n test-golden-path
# Expected output: default-deny-ingress listed
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Crossplane Claim stuck in Waiting state',
      difficulty: 'medium',
      symptom: 'The dev created a Claim (e.g., kind: Database) but the resource stays in Waiting state and never provisions.',
      diagnosis: `\`\`\`bash
# 1. Check Claim status
kubectl describe database orders-db -n team-orders
# Look for Events and Conditions

# 2. Check if compatible Composition exists
kubectl get compositions -l crossplane.io/xrd-kind=XDatabase
# Should return at least one Composition

# 3. Check if XRD is established
kubectl get xrd xdatabases.platform.example.com
# ESTABLISHED should be True

# 4. Check Crossplane logs
kubectl logs -n crossplane-system deploy/crossplane -c crossplane

# 5. Check if Provider is installed and healthy
kubectl get providers
kubectl get providerconfigs
\`\`\``,
      solution: `**Causes and solutions:**

1. **No compatible Composition:** The Claim needs a Composition that references the same XRD. Check compositeTypeRef in the Composition.

2. **Provider not installed:** The Provider (e.g., provider-aws) needs to be installed with a valid ProviderConfig. Check credentials.

3. **XRD not established:** If the XRD has a schema error, the CRD is not created. Check XRD events.

4. **Selector mismatch:** If the Composition uses labels, the Claim needs the correct compositionSelector or compositionRef.

5. **Invalid credentials:** The Provider needs valid credentials to provision cloud resources. Check the Secret referenced by ProviderConfig.`
    },
    {
      title: 'ApplicationSet not generating Applications for new folders',
      difficulty: 'medium',
      symptom: 'A dev added a new folder in teams/my-team/apps/new-service/ in the GitOps repo but ArgoCD did not create the Application automatically.',
      diagnosis: `\`\`\`bash
# 1. Check ApplicationSet status
kubectl get applicationset -n argocd team-apps -o yaml
# Check spec.generators and status

# 2. Check ApplicationSet controller logs
kubectl logs -n argocd deploy/argocd-applicationset-controller | tail -30

# 3. Verify repo is accessible
argocd repo list
# Repo should be listed with status Successful

# 4. Verify folder follows the pattern
# The path pattern in generator must match the actual structure
# E.g.: 'teams/*/apps/*' requires exactly that depth

# 5. Check if commit was to correct branch
# ApplicationSet monitors the configured revision (HEAD = default branch)
\`\`\``,
      solution: `**Causes and solutions:**

1. **Folder doesn't follow pattern:** The git generator with directories uses glob patterns. The folder must exactly match the pattern (e.g., teams/team-x/apps/service-y/ — 4 levels).

2. **Repo not registered in ArgoCD:** The repository must be registered in ArgoCD with valid credentials.

3. **Wrong branch:** If revision: HEAD, the commit must go to the default branch. If the dev pushed to a feature branch, the ApplicationSet doesn't detect it.

4. **Git polling rate limit:** ArgoCD polls the repo at intervals. It may take up to 3 minutes to detect changes. Force with: kubectl rollout restart deploy/argocd-applicationset-controller -n argocd.

5. **Empty folder or no valid manifests:** The folder needs to contain valid Kubernetes manifests or kustomization.yaml for ArgoCD to process.`
    },
    {
      title: 'Kyverno not generating resources when creating namespace',
      difficulty: 'hard',
      symptom: 'When creating a namespace with label platform.example.com/managed=true, ResourceQuota and NetworkPolicy are not generated automatically.',
      diagnosis: `\`\`\`bash
# 1. Check ClusterPolicy status
kubectl get clusterpolicy namespace-defaults
# READY should be true, BACKGROUND should be ok

# 2. Check if label is correct on namespace
kubectl get namespace team-test --show-labels
# Should have platform.example.com/managed=true

# 3. Check namespace events
kubectl describe namespace team-test
# Look for Kyverno events

# 4. Check Kyverno logs
kubectl logs -n kyverno deploy/kyverno-admission-controller | grep -i "namespace-defaults"

# 5. Check PolicyReport
kubectl get policyreport -n team-test
kubectl describe policyreport -n team-test
\`\`\``,
      solution: `**Causes and solutions:**

1. **Label applied after creation:** If the namespace was created without the label and the label was added later, the generate rule may not fire. The match evaluates at creation time. Solution: delete and recreate the namespace with the label.

2. **Kyverno webhook not configured:** Verify Kyverno webhooks are registered: kubectl get mutatingwebhookconfigurations | grep kyverno.

3. **Policy with syntax error:** Check if the policy is READY. If not, check events: kubectl describe clusterpolicy namespace-defaults.

4. **RBAC permission:** Kyverno's ServiceAccount needs permission to create ResourceQuota and NetworkPolicy in namespaces. Check ClusterRole.

5. **Conflict with other controllers:** If another controller or admission webhook intervenes, the generated resource may be blocked. Check admission logs.`
    }
  ]
};
