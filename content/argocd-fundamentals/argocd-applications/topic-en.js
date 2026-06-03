window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['argocd-fundamentals/argocd-applications'] = {
  theory: `
# ArgoCD Applications

## Relevance
The Application resource is the central object in ArgoCD. It defines **what** to deploy (source — Git repo or Helm chart) and **where** to deploy (destination — cluster and namespace). Understanding how to create, configure, and manage Applications is fundamental for day-to-day ArgoCD operations.

## Fundamental Concepts

### What is an Application?

An Application is an ArgoCD CRD (Custom Resource Definition) that maps a **source** (Git repository, Helm chart) to a **destination** (cluster + namespace). ArgoCD monitors this Application and ensures the actual state in the cluster matches the state defined in the source.

### Application Structure

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd          # ALWAYS in the argocd namespace
  finalizers:
    - resources-finalizer.argocd.argoproj.io  # deletes resources when App is removed
spec:
  project: default           # AppProject (access control)
  source:                    # WHERE manifests come FROM
    repoURL: https://github.com/org/repo.git
    targetRevision: HEAD     # branch, tag, or commit
    path: k8s/overlays/prod  # path within the repo
  destination:               # WHERE TO deploy
    server: https://kubernetes.default.svc  # cluster
    namespace: production    # target namespace
  syncPolicy:                # HOW to synchronize
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
\`\`\`

### Source Types

ArgoCD supports multiple manifest sources:

| Source Type | Description | Relevant Fields |
|------------|-------------|-----------------|
| **Directory (plain YAML)** | Folder with YAML/JSON manifests | \`path\`, \`directory.recurse\` |
| **Helm** | Helm chart from repo or Git | \`chart\`, \`helm.values\`, \`helm.parameters\` |
| **Kustomize** | Kustomize overlays | \`path\`, \`kustomize.images\`, \`kustomize.namePrefix\` |
| **Jsonnet** | Jsonnet templates | \`path\`, \`directory.jsonnet\` |
| **Plugin** | Config Management Plugin | \`plugin.name\`, \`plugin.env\` |

### Source: Directory (plain YAML)

\`\`\`yaml
spec:
  source:
    repoURL: https://github.com/org/repo.git
    targetRevision: main
    path: manifests/production
    directory:
      recurse: true           # include subdirectories
      exclude: '*.test.yaml'  # exclude test files
\`\`\`

### Source: Helm Chart (from Helm repo)

\`\`\`yaml
spec:
  source:
    repoURL: https://charts.bitnami.com/bitnami  # Helm repo
    chart: nginx                                   # chart name
    targetRevision: 15.0.0                         # chart version
    helm:
      releaseName: my-nginx
      values: |
        replicaCount: 3
        service:
          type: ClusterIP
      parameters:
        - name: image.tag
          value: "1.25"
\`\`\`

### Source: Helm Chart (from Git repo)

\`\`\`yaml
spec:
  source:
    repoURL: https://github.com/org/charts.git
    targetRevision: main
    path: charts/my-app       # folder with Chart.yaml
    helm:
      releaseName: my-app
      valueFiles:
        - values.yaml
        - values-prod.yaml    # per-environment override
      parameters:
        - name: image.tag
          value: "v1.2.3"
\`\`\`

### Source: Kustomize

\`\`\`yaml
spec:
  source:
    repoURL: https://github.com/org/repo.git
    targetRevision: main
    path: overlays/production
    kustomize:
      namePrefix: prod-
      images:
        - name: my-app
          newTag: v1.2.3
      commonLabels:
        env: production
\`\`\`

### Multiple Sources (v2.6+)

Starting with ArgoCD 2.6, you can use multiple sources in a single Application:

\`\`\`yaml
spec:
  sources:                    # note the plural "sources"
    - repoURL: https://charts.bitnami.com/bitnami
      chart: nginx
      targetRevision: 15.0.0
      helm:
        releaseName: nginx
        valueFiles:
          - \$values/envs/production/values.yaml  # reference to second source
    - repoURL: https://github.com/org/config.git
      targetRevision: main
      ref: values              # reference used above as \$values
\`\`\`

### Sync Status and Health Status

| Sync Status | Meaning |
|------------|---------|
| **Synced** | Actual state = desired state (Git) |
| **OutOfSync** | Actual state != desired state |
| **Unknown** | Unable to determine state |

| Health Status | Meaning |
|--------------|---------|
| **Healthy** | All resources are working |
| **Progressing** | Resources are being updated |
| **Degraded** | One or more resources have failed |
| **Suspended** | Resources are paused (e.g., Deployment paused) |
| **Missing** | Resources defined in Git do not exist in cluster |
| **Unknown** | Health cannot be determined |

### Destination

\`\`\`yaml
spec:
  destination:
    # Option 1: Cluster by URL (required for external clusters)
    server: https://kubernetes.default.svc

    # Option 2: Cluster by name (if registered in ArgoCD)
    # name: production-cluster

    namespace: my-namespace
\`\`\`

### Finalizers

\`\`\`yaml
metadata:
  finalizers:
    # Deletes cluster resources when the Application is removed
    - resources-finalizer.argocd.argoproj.io

    # Foreground deletion — waits for child resources to be deleted first
    # - resources-finalizer.argocd.argoproj.io/foreground
\`\`\`

## Essential Commands

### Application Management

\`\`\`bash
# Create Application via CLI
argocd app create my-app \\
  --repo https://github.com/org/repo.git \\
  --path k8s/production \\
  --dest-server https://kubernetes.default.svc \\
  --dest-namespace production \\
  --sync-policy automated \\
  --auto-prune \\
  --self-heal

# List Applications
argocd app list

# View Application details
argocd app get my-app

# View diff (what would change on sync)
argocd app diff my-app

# Manual sync
argocd app sync my-app

# Sync with prune (delete orphaned resources)
argocd app sync my-app --prune

# Sync specific resources
argocd app sync my-app --resource :Deployment:nginx

# Rollback to previous revision
argocd app rollback my-app <revision-id>

# Delete Application (keep resources in cluster)
argocd app delete my-app --cascade=false

# Delete Application (remove resources from cluster)
argocd app delete my-app

# View sync history
argocd app history my-app

# View Application pod logs
argocd app logs my-app
\`\`\`

### Repository Management

\`\`\`bash
# Add repository (HTTPS)
argocd repo add https://github.com/org/repo.git --username user --password token

# Add repository (SSH)
argocd repo add git@github.com:org/repo.git --ssh-private-key-path ~/.ssh/id_rsa

# Add Helm repo
argocd repo add https://charts.bitnami.com/bitnami --type helm --name bitnami

# List repositories
argocd repo list
\`\`\`

## Common Mistakes

1. **Application in wrong namespace**: Applications must be created in the \`argocd\` namespace, not in the target application namespace.
2. **Empty targetRevision**: If not specified, uses HEAD. But for production, always pin to a tag or branch.
3. **Forgetting finalizer**: Without the finalizer, deleting the Application in ArgoCD does NOT delete the resources in the cluster.
4. **Inline Helm values too large**: For complex values, use \`valueFiles\` pointing to files in the repo.
5. **Wrong source path**: The path is relative to the repo root. A wrong path results in "No manifests found".
6. **Not using CreateNamespace**: If the target namespace doesn't exist, sync fails. Add \`CreateNamespace=true\` to syncOptions.

## Killer.sh Style Challenge

**Scenario:** Create Applications to deploy a complete microservices stack.

**Tasks:**
1. Create an Application that deploys plain YAML manifests from a Git directory
2. Create an Application that deploys a Helm chart from a public Helm repository
3. Create an Application using Kustomize with production image override
4. Configure auto-sync with prune and self-heal on all Applications

**Tips:**
- Use \`syncOptions: [CreateNamespace=true]\` to create namespaces automatically
- For Helm charts, use \`helm.releaseName\` to define the release name
- Always add the finalizer for automatic cleanup
`,
  quiz: [
    {
      question: 'In which namespace should an ArgoCD Application be created?',
      options: [
        'In the target application namespace',
        'In the argocd namespace (where ArgoCD is installed)',
        'In the default namespace',
        'In any namespace'
      ],
      correct: 1,
      explanation: 'ArgoCD Applications must be created in the argocd namespace (where ArgoCD is installed). The destination.namespace field defines the target namespace where resources will be deployed, but the Application itself always resides in the argocd namespace.',
      reference: 'Related concept: argocd-projects — AppProjects control which namespaces/clusters an Application can use as destination.'
    },
    {
      question: 'Which field in an Application defines where Kubernetes manifests come from?',
      options: [
        'destination',
        'source',
        'syncPolicy',
        'project'
      ],
      correct: 1,
      explanation: 'The source field defines where manifests come from: Git repository (repoURL + path) or Helm chart (repoURL + chart). It supports plain YAML, Helm, Kustomize, Jsonnet, and plugins. Starting with ArgoCD 2.6, you can use "sources" (plural) for multiple sources.',
      reference: 'Related concept: argocd-sync-strategies — syncPolicy defines HOW manifests from the source are applied.'
    },
    {
      question: 'What happens when deleting an Application WITHOUT the resources-finalizer.argocd.argoproj.io finalizer?',
      options: [
        'Cluster resources are automatically deleted',
        'The Application and resources are both deleted',
        'Only the Application is removed from ArgoCD, resources remain in the cluster',
        'ArgoCD prevents the deletion'
      ],
      correct: 2,
      explanation: 'Without the finalizer, deleting the Application in ArgoCD only removes the Application object. The deployed Kubernetes resources (Deployments, Services, etc.) continue to exist in the cluster as orphans. The finalizer ensures automatic resource cleanup when removing the Application.',
      reference: 'Related concept: argocd-sync-strategies — prune in auto-sync works similarly, removing orphaned resources.'
    },
    {
      question: 'How do you deploy a Helm chart from a public Helm repository with ArgoCD?',
      options: [
        'Using source.path pointing to the chart URL',
        'Using source.repoURL with the Helm repo URL, source.chart with chart name, and source.targetRevision with the version',
        'Using destination.helm with the parameters',
        'ArgoCD does not support Helm charts from public repos'
      ],
      correct: 1,
      explanation: 'For Helm charts from Helm repositories: repoURL points to the repo (e.g., https://charts.bitnami.com/bitnami), chart defines the chart name (e.g., nginx), targetRevision defines the version (e.g., 15.0.0). Values can be inline (helm.values) or parameterized (helm.parameters).',
      reference: 'Related concept: argocd-applications — compare source types: directory vs Helm vs Kustomize.'
    },
    {
      question: 'Which sync status indicates the cluster state differs from the state defined in Git?',
      options: [
        'Synced',
        'OutOfSync',
        'Degraded',
        'Missing'
      ],
      correct: 1,
      explanation: 'OutOfSync indicates the actual state of resources in the cluster differs from the desired state defined in Git. Synced means they match. Degraded and Missing are health statuses, not sync statuses — Degraded indicates failed resources, Missing indicates resources that don\'t exist in the cluster.',
      reference: 'Related concept: argocd-sync-strategies — auto-sync can correct OutOfSync automatically.'
    },
    {
      question: 'What is the "Multiple Sources" (sources) feature in ArgoCD 2.6+?',
      options: [
        'Support for multiple clusters',
        'Ability to define multiple manifest sources in a single Application (e.g., Helm chart + values from another repo)',
        'Multiple copies of the same application',
        'Support for multiple projects'
      ],
      correct: 1,
      explanation: 'Multiple Sources allows an Application to use manifests from multiple sources. The most common use case is separating the Helm chart from values: the chart comes from a Helm repo, and values come from a separate Git repo. This allows platform and development teams to manage configs independently.',
      reference: 'Related concept: argocd-app-of-apps — ApplicationSets offer another approach for managing multiple Applications.'
    },
    {
      question: 'Which field should be configured for ArgoCD to automatically create the namespace if it does not exist?',
      options: [
        'destination.createNamespace: true',
        'syncPolicy.syncOptions with CreateNamespace=true',
        'source.namespace: auto',
        'project.allowNamespaceCreation: true'
      ],
      correct: 1,
      explanation: 'The CreateNamespace=true option must be added to syncPolicy.syncOptions. Without it, if the target namespace doesn\'t exist, sync will fail with an error. This is a common practice in environments where namespaces are created by ArgoCD as part of the deployment.',
      reference: 'Related concept: argocd-projects — the AppProject must allow the namespace in the destinations list.'
    },
    {
      question: 'Which health status indicates that Application resources are being updated?',
      options: [
        'Healthy',
        'Progressing',
        'Degraded',
        'Suspended'
      ],
      correct: 1,
      explanation: 'Progressing indicates resources are being updated (e.g., Deployment performing rollout, Pod initializing). It is a transient state that normally evolves to Healthy (success) or Degraded (failure). ArgoCD continuously monitors and updates the health status.',
      reference: 'Related concept: argocd-sync-strategies — sync waves and hooks allow controlling the update order.'
    }
  ],
  flashcards: [
    {
      front: 'What source types does ArgoCD support?',
      back: '1. **Directory** — plain YAML/JSON (path + directory.recurse)\n2. **Helm** — Charts from Helm repo or Git (chart + helm.values)\n3. **Kustomize** — Kustomize overlays (path + kustomize.images)\n4. **Jsonnet** — Jsonnet templates (path + directory.jsonnet)\n5. **Plugin** — Custom Config Management Plugins\n6. **Multiple Sources** (v2.6+) — combine multiple sources\n\nArgoCD automatically detects the type based on files (Chart.yaml = Helm, kustomization.yaml = Kustomize).'
    },
    {
      front: 'What is the difference between Sync Status and Health Status?',
      back: '**Sync Status** (Git vs Cluster):\n- **Synced** — actual state = Git\n- **OutOfSync** — actual state != Git\n- **Unknown** — not determined\n\n**Health Status** (are resources working?):\n- **Healthy** — all good\n- **Progressing** — updating\n- **Degraded** — resource failure\n- **Suspended** — paused\n- **Missing** — resource doesn\'t exist in cluster\n\nSync = "is it up to date?", Health = "is it working?"'
    },
    {
      front: 'How to use Multiple Sources in ArgoCD?',
      back: 'Multiple Sources (v2.6+) allows combining sources:\n\n```yaml\nspec:\n  sources:  # plural!\n    - repoURL: https://charts.bitnami.com/bitnami\n      chart: nginx\n      targetRevision: 15.0.0\n      helm:\n        valueFiles:\n          - $values/envs/prod/values.yaml\n    - repoURL: https://github.com/org/config.git\n      targetRevision: main\n      ref: values  # reference\n```\n\n**Use case:** Helm chart from one repo, values from another Git repo (separation of concerns).'
    },
    {
      front: 'What does the resources-finalizer.argocd.argoproj.io finalizer do?',
      back: '**With finalizer:**\nWhen deleting the Application, ArgoCD first deletes ALL Kubernetes resources created by it (Deployments, Services, etc.) and only then removes the Application.\n\n**Without finalizer:**\nWhen deleting the Application, only the Application object is removed. Cluster resources remain as "orphans".\n\n**Foreground variant:**\n\`resources-finalizer.argocd.argoproj.io/foreground\`\nWaits for child resources to be deleted before removing the parent.\n\n**Best practice:** always use finalizer in production.'
    },
    {
      front: 'How to create an ArgoCD Application via CLI?',
      back: '```bash\nargocd app create my-app \\\n  --repo https://github.com/org/repo.git \\\n  --path k8s/production \\\n  --dest-server https://kubernetes.default.svc \\\n  --dest-namespace production \\\n  --sync-policy automated \\\n  --auto-prune \\\n  --self-heal\n```\n\n**Common operations:**\n- \`argocd app list\` — list apps\n- \`argocd app get my-app\` — details\n- \`argocd app sync my-app\` — manual sync\n- \`argocd app diff my-app\` — view diff\n- \`argocd app delete my-app\` — delete\n- \`argocd app history my-app\` — history'
    },
    {
      front: 'How to configure an Application with Helm values from a Git repo?',
      back: '```yaml\nspec:\n  source:\n    repoURL: https://github.com/org/charts.git\n    targetRevision: main\n    path: charts/my-app\n    helm:\n      releaseName: my-app\n      valueFiles:\n        - values.yaml\n        - values-prod.yaml\n      parameters:\n        - name: image.tag\n          value: "v1.2.3"\n        - name: replicaCount\n          value: "3"\n```\n\n**Precedence:** parameters > valueFiles (last wins) > inline values\n\n**Tip:** use valueFiles for per-environment config (dev/staging/prod).'
    }
  ],
  lab: {
    scenario: 'You need to deploy an application using ArgoCD with different source types: plain YAML, Helm chart, and Kustomize.',
    objective: 'Create Applications in ArgoCD using different source types, understand sync/health status, and manage the Application lifecycle.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Application with plain YAML',
        instruction: `Create an Application that deploys YAML manifests from a public Git repository.

\`\`\`bash
# Create Application via CLI
argocd app create guestbook \\
  --repo https://github.com/argoproj/argocd-example-apps.git \\
  --path guestbook \\
  --dest-server https://kubernetes.default.svc \\
  --dest-namespace guestbook \\
  --sync-option CreateNamespace=true

# Or via YAML
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: guestbook
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: guestbook
  destination:
    server: https://kubernetes.default.svc
    namespace: guestbook
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
EOF
\`\`\``,
        hints: [
          'The argocd-example-apps repository is public and contains official examples',
          'CreateNamespace=true creates the namespace if it does not exist',
          'The Application starts OutOfSync until the first sync'
        ],
        solution: `\`\`\`bash
argocd app create guestbook \\
  --repo https://github.com/argoproj/argocd-example-apps.git \\
  --path guestbook \\
  --dest-server https://kubernetes.default.svc \\
  --dest-namespace guestbook \\
  --sync-option CreateNamespace=true
\`\`\``,
        verify: `\`\`\`bash
# Verify Application created
argocd app get guestbook
# Expected output: Status Sync: OutOfSync, Health: Missing

# Verify via kubectl
kubectl get application guestbook -n argocd
# Expected output: Application with SYNC STATUS
\`\`\``
      },
      {
        title: 'Sync and Verify Status',
        instruction: `Sync the Application and observe the sync and health statuses.

\`\`\`bash
# View diff before sync
argocd app diff guestbook

# Execute sync
argocd app sync guestbook

# Check status
argocd app get guestbook

# View created resources
argocd app resources guestbook

# View pods
kubectl get pods -n guestbook
\`\`\``,
        hints: [
          'The diff shows exactly what will be created/modified',
          'After sync, status should change to Synced + Healthy',
          'Use "argocd app resources" to see all managed resources'
        ],
        solution: `\`\`\`bash
# Sync
argocd app sync guestbook

# Verify
argocd app get guestbook

# Resources
kubectl get all -n guestbook
\`\`\``,
        verify: `\`\`\`bash
# Verify sync status
argocd app get guestbook -o json | jq '.status.sync.status'
# Expected output: "Synced"

# Verify health status
argocd app get guestbook -o json | jq '.status.health.status'
# Expected output: "Healthy"

# Verify pods
kubectl get pods -n guestbook --no-headers | wc -l
# Expected output: number > 0
\`\`\``
      },
      {
        title: 'Create Application with Helm Chart',
        instruction: `Create an Application that deploys a Helm chart from a public Helm repository.

\`\`\`bash
# Add Helm repo (if needed)
argocd repo add https://charts.bitnami.com/bitnami --type helm --name bitnami

# Create Application with Helm
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: nginx-helm
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://charts.bitnami.com/bitnami
    chart: nginx
    targetRevision: 15.0.0
    helm:
      releaseName: nginx-prod
      values: |
        replicaCount: 2
        service:
          type: ClusterIP
  destination:
    server: https://kubernetes.default.svc
    namespace: nginx-helm
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
EOF
\`\`\``,
        hints: [
          'For Helm repos, use chart instead of path',
          'targetRevision is the chart version',
          'Auto-sync with selfHeal will sync automatically'
        ],
        solution: `\`\`\`bash
# The Application with auto-sync syncs automatically
argocd app get nginx-helm
\`\`\``,
        verify: `\`\`\`bash
# Verify Application
argocd app get nginx-helm -o json | jq '{sync: .status.sync.status, health: .status.health.status}'
# Expected output: {"sync": "Synced", "health": "Healthy" or "Progressing"}

# Verify nginx pods
kubectl get pods -n nginx-helm
# Expected output: 2 nginx pods running (replicaCount: 2)
\`\`\``
      },
      {
        title: 'Test Drift Detection and Self-Heal',
        instruction: `Manually change a managed resource and observe ArgoCD detect and correct the drift.

\`\`\`bash
# Manually change replicas (intentional drift)
kubectl scale deployment nginx-prod-nginx -n nginx-helm --replicas=5

# Check status immediately
argocd app get nginx-helm

# Wait for self-heal (ArgoCD should revert to 2 replicas)
# Self-heal acts within seconds

# Verify it went back to 2 replicas
kubectl get deployment nginx-prod-nginx -n nginx-helm -o jsonpath='{.spec.replicas}'
\`\`\``,
        hints: [
          'With selfHeal enabled, ArgoCD reverts manual changes automatically',
          'Self-heal checks every few seconds',
          'Without selfHeal, ArgoCD would only mark it as OutOfSync'
        ],
        solution: `\`\`\`bash
# Force drift
kubectl scale deployment nginx-prod-nginx -n nginx-helm --replicas=5

# Wait for self-heal (5-10 seconds)
sleep 10

# Verify correction
kubectl get deployment nginx-prod-nginx -n nginx-helm -o jsonpath='{.spec.replicas}'
\`\`\``,
        verify: `\`\`\`bash
# Verify replicas returned to Git value
kubectl get deployment nginx-prod-nginx -n nginx-helm -o jsonpath='{.spec.replicas}'
# Expected output: 2 (value defined in Helm values)

# Verify Application synced
argocd app get nginx-helm -o json | jq '.status.sync.status'
# Expected output: "Synced"
\`\`\``
      },
      {
        title: 'Cleanup — Delete Applications',
        instruction: `Remove the Applications and verify behavior with and without finalizer.

\`\`\`bash
# Delete guestbook WITHOUT finalizer (resources stay in cluster)
argocd app delete guestbook --cascade=false -y

# Verify resources still exist
kubectl get pods -n guestbook

# Delete nginx-helm WITH finalizer (resources are removed)
argocd app delete nginx-helm -y

# Verify resources were removed
kubectl get pods -n nginx-helm
\`\`\``,
        hints: [
          '--cascade=false preserves resources in the cluster',
          'With finalizer, ArgoCD deletes resources before removing the Application',
          'Without --cascade flag, behavior depends on the finalizer in the Application'
        ],
        solution: `\`\`\`bash
argocd app delete guestbook --cascade=false -y
kubectl get pods -n guestbook  # resources still exist

argocd app delete nginx-helm -y
kubectl get pods -n nginx-helm  # resources removed
\`\`\``,
        verify: `\`\`\`bash
# Verify guestbook no longer exists in ArgoCD
argocd app list | grep guestbook
# Expected output: no lines

# Verify guestbook resources still exist
kubectl get pods -n guestbook --no-headers | wc -l
# Expected output: number > 0 (orphans)

# Clean up orphaned resources
kubectl delete namespace guestbook
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Application stuck in "OutOfSync" even after sync',
      difficulty: 'medium',
      symptom: 'The Application remains OutOfSync even after executing sync successfully. The sync completes without errors but the status doesn\'t change to Synced.',
      diagnosis: `\`\`\`bash
# View detailed diff
argocd app diff my-app --local

# Check resources with diff
argocd app get my-app -o json | jq '.status.resources[] | select(.status != "Synced")'

# Check if mutable fields are being modified by the cluster
argocd app diff my-app 2>&1 | head -50
\`\`\``,
      solution: `**Common causes:**

1. **Mutable fields (defaulting):** Kubernetes adds default fields after apply (e.g., strategy, resources). ArgoCD sees this as a diff.
\`\`\`yaml
# Ignore differences in specific fields
spec:
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas  # ignore if HPA controls replicas
    - group: ""
      kind: Service
      jqPathExpressions:
        - .spec.clusterIP  # field assigned by cluster
\`\`\`

2. **Webhook/admission controller modifying resources:** Admission controllers may add/modify fields after apply.

3. **Resource tracking method:** Switch to annotation-based:
\`\`\`bash
kubectl edit cm argocd-cm -n argocd
# Add: application.resourceTrackingMethod: annotation
\`\`\``
    },
    {
      title: 'Error "No manifests found" when syncing',
      difficulty: 'easy',
      symptom: 'Sync fails with error "rpc error: code = Unknown desc = No manifests found at path" or the Application shows 0 resources.',
      diagnosis: `\`\`\`bash
# Check configured path
argocd app get my-app -o json | jq '.spec.source.path'

# Check repo content at path
argocd repo get https://github.com/org/repo.git

# List files at path
# (locally, clone the repo and verify)
git ls-tree -r HEAD --name-only | grep "^path/"
\`\`\``,
      solution: `**Common causes:**

1. **Wrong path:** The path is relative to the repo root. Verify the path exists and contains manifests.

2. **Wrong branch:** targetRevision may point to a branch that doesn't have the path.
\`\`\`bash
argocd app get my-app -o json | jq '.spec.source.targetRevision'
\`\`\`

3. **Helm Chart without Chart.yaml:** If the path is a Helm chart, it must have Chart.yaml at the root.

4. **Kustomize without kustomization.yaml:** If the path uses Kustomize, it must have kustomization.yaml.

5. **Wrong file extension:** ArgoCD only processes .yaml, .yml, and .json by default.

6. **Overly broad directory.exclude:** Check if the exclude is filtering out all files.`
    },
    {
      title: 'Application Degraded — pods in CrashLoopBackOff',
      difficulty: 'hard',
      symptom: 'The Application syncs successfully (Synced) but health status stays Degraded. Application pods are in CrashLoopBackOff.',
      diagnosis: `\`\`\`bash
# View detailed health
argocd app get my-app --show-operation

# View resources with issues
argocd app resources my-app | grep -v Healthy

# View logs from problematic pod
argocd app logs my-app --name <pod-name>

# View pod events
kubectl describe pod <pod-name> -n <namespace>

# View previous logs (pre-crash)
kubectl logs <pod-name> -n <namespace> --previous
\`\`\``,
      solution: `**Investigation flow:**

1. **Sync OK but app doesn't work:** Sync applies manifests successfully, but the application fails to start. This is an application issue, not an ArgoCD issue.

2. **Check ConfigMaps/Secrets:** The application may depend on ConfigMaps or Secrets that were not included in Git.
\`\`\`bash
kubectl get events -n <namespace> --sort-by=.lastTimestamp | tail -10
\`\`\`

3. **Check image:** The image tag may not exist or the registry may be inaccessible.

4. **Check resources:** Limits set too low can cause OOMKill.

5. **Check probes:** Overly aggressive liveness probes can restart the pod before it's ready.

**Important:** Synced != Healthy. Synced means manifests were applied. Healthy means resources are working. Always investigate health issues as application problems, not ArgoCD problems.`
    }
  ]
};
