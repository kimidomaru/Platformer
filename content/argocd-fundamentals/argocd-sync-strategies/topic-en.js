window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['argocd-fundamentals/argocd-sync-strategies'] = {
  theory: `
# ArgoCD Sync Strategies

## Relevance
ArgoCD sync strategies define **how** and **when** Git changes are applied to the cluster. Correctly configuring auto-sync, prune, self-heal, sync waves, and hooks is crucial for a reliable and safe GitOps pipeline in production.

## Fundamental Concepts

### Manual vs Automated Sync

| Mode | Behavior | When to Use |
|------|----------|-------------|
| **Manual** | Requires UI click or CLI command for sync | Critical environments, production with approval |
| **Automated** | ArgoCD applies changes automatically | Staging, dev environments, pure GitOps |
| **Automated + Prune** | Auto-sync + removes orphaned resources | Environments where Git is 100% source of truth |
| **Automated + Self-Heal** | Auto-sync + reverts manual changes | Prevent drift in production |

### Complete Sync Policy

\`\`\`yaml
spec:
  syncPolicy:
    automated:
      prune: true          # deletes resources not in Git
      selfHeal: true       # reverts manual changes in cluster
      allowEmpty: false    # do NOT sync if Git is empty (safety)
    retry:
      limit: 5             # retry attempts
      backoff:
        duration: 5s       # initial time between retries
        factor: 2          # multiplier (5s, 10s, 20s, 40s, 80s)
        maxDuration: 3m    # max time between retries
    syncOptions:
      - CreateNamespace=true        # creates namespace if it doesn't exist
      - PrunePropagationPolicy=foreground  # waits for children before deleting parents
      - PruneLast=true              # prune orphans after syncing new resources
      - ApplyOutOfSyncOnly=true     # only applies OutOfSync resources (performance)
      - ServerSideApply=true        # uses K8s server-side apply (better for large CRDs)
      - Validate=true               # validates manifests before applying
      - RespectIgnoreDifferences=true  # respects ignoreDifferences in auto-sync
      - Replace=false               # uses apply (not replace) by default
\`\`\`

### Prune (Orphaned Resource Removal)

Prune removes resources from the cluster that are no longer defined in Git:

\`\`\`
Git (source of truth):         Cluster (actual state):
- Deployment/app              - Deployment/app         ✅ kept
- Service/app-svc             - Service/app-svc        ✅ kept
                              - ConfigMap/old-config   ❌ PRUNED (not in Git)
                              - Service/legacy-svc     ❌ PRUNED (not in Git)
\`\`\`

**Protection against accidental prune:**
\`\`\`yaml
# Annotate resources that should NEVER be pruned
metadata:
  annotations:
    argocd.argoproj.io/sync-options: Prune=false
\`\`\`

### Self-Heal (Drift Correction)

Self-heal reverts any manual changes made directly in the cluster:

\`\`\`
1. Admin runs: kubectl scale deployment app --replicas=10
2. ArgoCD detects: replicas (10) != Git (3) → OutOfSync
3. Self-heal acts: reverts to replicas=3
4. Result: cluster returns to Git state
\`\`\`

### Sync Waves (Deployment Order)

Sync waves control the **order** in which resources are deployed. Resources with lower waves are created first:

\`\`\`yaml
# Wave 0 — Namespace and RBAC (first)
apiVersion: v1
kind: Namespace
metadata:
  name: my-app
  annotations:
    argocd.argoproj.io/sync-wave: "0"

---
# Wave 1 — ConfigMaps and Secrets
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  annotations:
    argocd.argoproj.io/sync-wave: "1"

---
# Wave 2 — Deployments and Services
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
  annotations:
    argocd.argoproj.io/sync-wave: "2"

---
# Wave 3 — Ingress (after everything else)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    argocd.argoproj.io/sync-wave: "3"
\`\`\`

**Sync waves flow:**
\`\`\`
Wave 0: Namespace → wait for Healthy
Wave 1: ConfigMap, Secret → wait for Healthy
Wave 2: Deployment, Service → wait for Healthy
Wave 3: Ingress → wait for Healthy
→ Sync complete!
\`\`\`

### Sync Hooks (Pre/Post Sync Tasks)

Hooks execute Jobs or Pods at specific moments in the sync cycle:

| Hook | When Executed | Use Case |
|------|--------------|----------|
| **PreSync** | Before sync | Database migration, backup |
| **Sync** | During sync (alongside normal resources) | Normal resources |
| **PostSync** | After sync complete + healthy | Smoke tests, notifications |
| **SyncFail** | When sync fails | Failure notification, rollback |
| **Skip** | Never synced | Placeholder, documentation |

\`\`\`yaml
# Migration Job (PreSync)
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: my-app:v1.2.3
          command: ["./migrate.sh"]
      restartPolicy: Never

---
# Smoke test Job (PostSync)
apiVersion: batch/v1
kind: Job
metadata:
  name: smoke-test
  annotations:
    argocd.argoproj.io/hook: PostSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      containers:
        - name: test
          image: curlimages/curl:latest
          command: ["curl", "-sf", "http://app-svc:8080/health"]
      restartPolicy: Never
\`\`\`

### Hook Delete Policies

| Policy | Behavior |
|--------|----------|
| **HookSucceeded** | Deletes the hook if it completes successfully |
| **HookFailed** | Deletes the hook if it fails |
| **BeforeHookCreation** | Deletes previous hook before creating new one (idempotent) |

### Per-Resource Sync Options

\`\`\`yaml
metadata:
  annotations:
    # Do not prune this resource
    argocd.argoproj.io/sync-options: Prune=false

    # Use replace instead of apply
    argocd.argoproj.io/sync-options: Replace=true

    # Do not validate this resource
    argocd.argoproj.io/sync-options: Validate=false

    # Force sync (delete + create)
    argocd.argoproj.io/sync-options: Force=true

    # Server-side apply for this resource
    argocd.argoproj.io/sync-options: ServerSideApply=true
\`\`\`

### Ignore Differences

\`\`\`yaml
spec:
  ignoreDifferences:
    # Ignore replicas (controlled by HPA)
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas

    # Ignore annotations added by cluster
    - group: ""
      kind: Service
      jqPathExpressions:
        - .metadata.annotations["service.beta.kubernetes.io/aws-load-balancer-type"]

    # Ignore all status
    - group: "*"
      kind: "*"
      managedFieldsManagers:
        - kube-controller-manager
\`\`\`

## Essential Commands

\`\`\`bash
# Manual sync
argocd app sync my-app

# Sync with prune
argocd app sync my-app --prune

# Force sync (even if Synced)
argocd app sync my-app --force

# Sync specific resource
argocd app sync my-app --resource :Deployment:nginx

# Sync dry-run (without applying)
argocd app sync my-app --dry-run

# View diff
argocd app diff my-app

# Enable auto-sync
argocd app set my-app --sync-policy automated

# Enable prune
argocd app set my-app --auto-prune

# Enable self-heal
argocd app set my-app --self-heal

# Disable auto-sync
argocd app set my-app --sync-policy none

# View sync history
argocd app history my-app

# Rollback
argocd app rollback my-app <revision>
\`\`\`

## Common Mistakes

1. **Enabling prune without understanding the impact**: Prune deletes actual cluster resources. If a resource is removed from Git by mistake, it will be deleted from the cluster.
2. **Self-heal conflicting with HPA**: HPA changes replicas, ArgoCD reverts. Solution: use \`ignoreDifferences\` for /spec/replicas.
3. **Sync waves without waiting for health**: If a resource in wave 1 never becomes Healthy, subsequent waves never execute. Set adequate timeout.
4. **Hooks without delete policy**: Hook Jobs accumulate and cause "already exists" error on next sync. Use BeforeHookCreation.
5. **allowEmpty: true in production**: If the Git repo is accidentally emptied, ALL resources will be deleted. Keep false in production.
6. **Not using retry**: Transient failures (slow API server, quota reached) can be automatically resolved with retry.

## Killer.sh Style Challenge

**Scenario:** Configure a complete deployment strategy with ArgoCD using sync waves, hooks, and policies.

**Tasks:**
1. Configure an Application with auto-sync, prune, and self-heal
2. Define sync waves for: Namespace (0) → ConfigMap (1) → Deployment (2) → Ingress (3)
3. Add a PreSync hook for database migration
4. Add a PostSync hook for smoke testing
5. Configure ignoreDifferences for replicas (controlled by HPA)

**Tips:**
- Use \`argocd.argoproj.io/sync-wave\` to control the order
- Use \`argocd.argoproj.io/hook\` for Pre/Post hooks
- Always use \`hook-delete-policy: BeforeHookCreation\` for idempotency
`,
  quiz: [
    {
      question: 'What happens when prune is enabled and a resource is removed from the Git repository?',
      options: [
        'The resource remains in the cluster as an orphan',
        'ArgoCD deletes the resource from the cluster automatically',
        'ArgoCD marks the resource as deprecated',
        'The resource is moved to another namespace'
      ],
      correct: 1,
      explanation: 'With prune enabled, when a resource is removed from Git (source of truth), ArgoCD automatically deletes that resource from the cluster on the next sync. Without prune, the resource would remain as an orphan in the cluster. Care must be taken with prune — accidental removal from Git causes real deletion.',
      reference: 'Related concept: argocd-applications — the finalizer controls cleanup when deleting the entire Application.'
    },
    {
      question: 'What is the function of self-heal in ArgoCD?',
      options: [
        'Restart failed pods',
        'Automatically revert manual changes made in the cluster to match Git',
        'Fix syntax errors in manifests',
        'Update the ArgoCD version automatically'
      ],
      correct: 1,
      explanation: 'Self-heal continuously monitors the cluster and reverts any changes made directly (e.g., kubectl scale, kubectl edit). If someone changes a Deployment manually, ArgoCD detects the divergence and applies the Git state automatically, preventing drift.',
      reference: 'Related concept: argocd-applications — use ignoreDifferences for fields that should be allowed to change (e.g., HPA replicas).'
    },
    {
      question: 'What are sync waves used for in ArgoCD?',
      options: [
        'To parallelize resource deployment',
        'To control the deployment order of resources — lower waves are applied first',
        'To distribute resources across clusters',
        'For manifest versioning'
      ],
      correct: 1,
      explanation: 'Sync waves define deployment order: resources with wave 0 are created first, then wave 1, etc. ArgoCD waits for resources in one wave to become Healthy before proceeding to the next. Useful for ensuring dependencies (Namespace, ConfigMap) exist before Deployments.',
      reference: 'Related concept: argocd-sync-strategies — hooks (PreSync/PostSync) complement waves for tasks like migrations.'
    },
    {
      question: 'Which ArgoCD hook is executed BEFORE resource synchronization?',
      options: [
        'PostSync',
        'Sync',
        'PreSync',
        'SyncFail'
      ],
      correct: 2,
      explanation: 'PreSync hooks execute BEFORE any resources are synchronized. They are used for tasks that must happen before deployment, such as database migration, backup, or validation. Sync only proceeds after the hook completes successfully.',
      reference: 'Related concept: argocd-sync-strategies — combine PreSync + sync waves for complex deployments.'
    },
    {
      question: 'Which hook-delete-policy should be used to ensure idempotency in hooks?',
      options: [
        'HookSucceeded',
        'HookFailed',
        'BeforeHookCreation',
        'AfterHookCompletion'
      ],
      correct: 2,
      explanation: 'BeforeHookCreation deletes the previous hook before creating a new one. This ensures idempotency — if sync is run again, there will be no "already exists" conflict. It is the most recommended policy for most hooks.',
      reference: 'Related concept: argocd-sync-strategies — without a delete policy, hooks accumulate and cause errors.'
    },
    {
      question: 'How do you prevent self-heal from conflicting with HPA (Horizontal Pod Autoscaler)?',
      options: [
        'Disable HPA',
        'Disable self-heal for the entire Application',
        'Configure ignoreDifferences for /spec/replicas on the Deployment',
        'Increase the reconciliation interval'
      ],
      correct: 2,
      explanation: 'HPA changes the number of replicas automatically, and self-heal tries to revert to the Git value. The solution is to use ignoreDifferences with jsonPointers: ["/spec/replicas"] so ArgoCD ignores differences in that specific field, allowing HPA to control replicas.',
      reference: 'Related concept: argocd-applications — ignoreDifferences is also useful for Kubernetes default fields.'
    },
    {
      question: 'What does the PruneLast option do in ArgoCD?',
      options: [
        'Only prune the last resource',
        'Ensures orphaned resources are deleted AFTER all new resources are successfully synced',
        'Prune only in the last wave',
        'Disables prune for the last sync'
      ],
      correct: 1,
      explanation: 'PruneLast ensures orphaned resource removal only happens after all new resources have been successfully applied. This prevents resources from being deleted before new ones are ready, preventing downtime during transitions.',
      reference: 'Related concept: argocd-sync-strategies — combine PruneLast with sync waves for safe deployments.'
    }
  ],
  flashcards: [
    {
      front: 'What are the ArgoCD sync modes?',
      back: '**Manual:** requires explicit action (UI or CLI)\n**Automated:** applies changes automatically from Git\n\n**Automated options:**\n- **prune: true** — deletes resources removed from Git\n- **selfHeal: true** — reverts manual changes\n- **allowEmpty: false** — protects against empty repo\n\n**Retry:** automatic retries on failure\n```yaml\nretry:\n  limit: 5\n  backoff:\n    duration: 5s\n    factor: 2\n    maxDuration: 3m\n```'
    },
    {
      front: 'How do sync waves work?',
      back: 'Sync waves control deployment order:\n\n```yaml\nargocd.argoproj.io/sync-wave: "0"  # first\nargocd.argoproj.io/sync-wave: "1"  # second\nargocd.argoproj.io/sync-wave: "2"  # third\n```\n\n**Flow:**\n1. Apply wave 0 resources\n2. Wait for all to become Healthy\n3. Apply wave 1 resources\n4. Wait for all to become Healthy\n5. Continue...\n\n**Typical pattern:**\nWave 0: Namespace, RBAC\nWave 1: ConfigMap, Secret\nWave 2: Deployment, Service\nWave 3: Ingress'
    },
    {
      front: 'What are ArgoCD hooks and when does each execute?',
      back: '| Hook | When | Use |\n|------|------|-----|\n| **PreSync** | Before sync | DB migration, backup |\n| **Sync** | During sync | Normal resources |\n| **PostSync** | After sync + healthy | Smoke test, notification |\n| **SyncFail** | When sync fails | Failure alert |\n| **Skip** | Never | Placeholder |\n\n**Delete Policies:**\n- BeforeHookCreation (recommended)\n- HookSucceeded\n- HookFailed'
    },
    {
      front: 'What is the HPA + self-heal problem and how to solve it?',
      back: '**Problem:**\n- HPA scales replicas: 3 → 8\n- Self-heal detects drift: 8 != 3 (Git)\n- Self-heal reverts: 8 → 3\n- HPA scales again: 3 → 8\n- Infinite loop!\n\n**Solution — ignoreDifferences:**\n```yaml\nspec:\n  ignoreDifferences:\n    - group: apps\n      kind: Deployment\n      jsonPointers:\n        - /spec/replicas\n```\n\nThis makes ArgoCD ignore replica changes, allowing HPA to control scaling.'
    },
    {
      front: 'What are the most important syncOptions?',
      back: '```yaml\nsyncOptions:\n  - CreateNamespace=true      # create namespace\n  - PruneLast=true            # prune after sync\n  - ApplyOutOfSyncOnly=true   # performance\n  - ServerSideApply=true      # large CRDs\n  - Validate=true             # validate manifests\n  - Replace=false             # apply vs replace\n  - RespectIgnoreDifferences=true\n```\n\n**Per-resource (annotation):**\n```yaml\nargocd.argoproj.io/sync-options: Prune=false\nargocd.argoproj.io/sync-options: Replace=true\n```'
    },
    {
      front: 'What is the difference between Prune and Delete in ArgoCD context?',
      back: '**Prune (auto-sync):**\n- Removes resources from cluster NOT in Git anymore\n- Happens automatically during sync (if prune: true)\n- Protection: Prune=false annotation on resource\n\n**Delete (Application):**\n- Removes ALL resources when deleting the Application\n- Controlled by finalizer\n- --cascade=false preserves resources\n\n**PruneLast:** ensures prune occurs AFTER new resources are created\n\n**allowEmpty: false:** prevents total prune if Git is empty'
    },
    {
      front: 'How to perform rollback in ArgoCD?',
      back: '**Via CLI:**\n```bash\n# View history\nargocd app history my-app\n\n# Rollback to specific revision\nargocd app rollback my-app 3\n```\n\n**Via Git (recommended):**\n```bash\ngit revert HEAD\ngit push\n# ArgoCD detects and applies automatically\n```\n\n**Important:**\n- CLI rollback temporarily disables auto-sync\n- Git revert is preferred (maintains history)\n- With auto-sync, next Git commit will be applied\n- Rollback is NOT an undo — it deploys the previous revision'
    }
  ],
  lab: {
    scenario: 'You need to configure advanced sync strategies in ArgoCD including auto-sync, sync waves, hooks, and drift protection.',
    objective: 'Configure Application with auto-sync/prune/self-heal, implement sync waves for ordered deployment, create Pre/Post sync hooks, and configure ignoreDifferences.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create Application with Auto-Sync',
        instruction: `Create an Application with automated sync, prune, and self-heal enabled.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: sync-demo
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: guestbook
  destination:
    server: https://kubernetes.default.svc
    namespace: sync-demo
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    retry:
      limit: 3
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 1m
    syncOptions:
      - CreateNamespace=true
      - PruneLast=true
      - ApplyOutOfSyncOnly=true
EOF
\`\`\``,
        hints: [
          'With automated, sync occurs automatically after ArgoCD detects changes',
          'prune: true deletes resources not in Git',
          'selfHeal: true reverts manual changes in the cluster'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: sync-demo
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: guestbook
  destination:
    server: https://kubernetes.default.svc
    namespace: sync-demo
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify Application
argocd app get sync-demo -o json | jq '{sync: .status.sync.status, health: .status.health.status}'
# Expected output: {"sync": "Synced", "health": "Healthy"}

# Verify auto-sync enabled
argocd app get sync-demo -o json | jq '.spec.syncPolicy.automated'
# Expected output: {"prune": true, "selfHeal": true}
\`\`\``
      },
      {
        title: 'Test Self-Heal',
        instruction: `Make a manual change in the cluster and observe ArgoCD correcting it automatically.

\`\`\`bash
# Check current replicas
kubectl get deployment -n sync-demo -o jsonpath='{.items[0].spec.replicas}'

# Force drift — manually change replicas
kubectl scale deployment -n sync-demo --all --replicas=5

# Check immediately
kubectl get deployment -n sync-demo -o jsonpath='{.items[0].spec.replicas}'

# Wait for self-heal (5-15 seconds)
sleep 15

# Verify it returned to Git value
kubectl get deployment -n sync-demo -o jsonpath='{.items[0].spec.replicas}'
\`\`\``,
        hints: [
          'Self-heal checks state continuously',
          'Correction usually occurs within 5-15 seconds',
          'Check Application events to see self-heal in action'
        ],
        solution: `\`\`\`bash
kubectl scale deployment -n sync-demo --all --replicas=5
sleep 15
kubectl get deployment -n sync-demo -o jsonpath='{.items[0].spec.replicas}'
\`\`\``,
        verify: `\`\`\`bash
# Verify replicas returned to original value
kubectl get deployment -n sync-demo -o jsonpath='{.items[0].spec.replicas}'
# Expected output: 1 (original Git value)

# Verify sync status
argocd app get sync-demo -o json | jq '.status.sync.status'
# Expected output: "Synced"
\`\`\``
      },
      {
        title: 'Create Application with Sync Waves',
        instruction: `Create an Application with manifests that use sync waves to control deployment order.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: waves-demo
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: sync-waves
  destination:
    server: https://kubernetes.default.svc
    namespace: waves-demo
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
EOF

# Sync and observe the order
argocd app sync waves-demo
\`\`\``,
        hints: [
          'The argocd-example-apps repo has sync-waves examples',
          'Observe the resource order in the sync output',
          'Resources with lower wave numbers are created first'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: waves-demo
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: sync-waves
  destination:
    server: https://kubernetes.default.svc
    namespace: waves-demo
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
EOF

argocd app sync waves-demo
\`\`\``,
        verify: `\`\`\`bash
# Verify Application was synced
argocd app get waves-demo -o json | jq '.status.sync.status'
# Expected output: "Synced"

# Verify resources in namespace
kubectl get all -n waves-demo
# Expected output: resources created in correct order
\`\`\``
      },
      {
        title: 'Configure ignoreDifferences',
        instruction: `Configure ignoreDifferences to prevent conflicts with HPA or Kubernetes default fields.

\`\`\`bash
# Edit sync-demo Application to ignore replicas
kubectl patch application sync-demo -n argocd --type merge -p '{
  "spec": {
    "ignoreDifferences": [
      {
        "group": "apps",
        "kind": "Deployment",
        "jsonPointers": ["/spec/replicas"]
      }
    ]
  }
}'

# Now changing replicas won't cause OutOfSync
kubectl scale deployment -n sync-demo --all --replicas=5

# Verify status remains Synced
argocd app get sync-demo
\`\`\``,
        hints: [
          'ignoreDifferences tells ArgoCD to not consider differences in specific fields',
          'jsonPointers uses RFC 6901 to reference fields',
          'Essential when HPA, VPA, or external controllers manage fields'
        ],
        solution: `\`\`\`bash
kubectl patch application sync-demo -n argocd --type merge -p '{
  "spec": {
    "ignoreDifferences": [
      {
        "group": "apps",
        "kind": "Deployment",
        "jsonPointers": ["/spec/replicas"]
      }
    ]
  }
}'
\`\`\``,
        verify: `\`\`\`bash
# Verify ignoreDifferences configured
argocd app get sync-demo -o json | jq '.spec.ignoreDifferences'
# Expected output: array with replicas configuration

# Change replicas and verify no OutOfSync
kubectl scale deployment -n sync-demo --all --replicas=5
sleep 5
argocd app get sync-demo -o json | jq '.status.sync.status'
# Expected output: "Synced" (ignores replica differences)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Self-heal causes infinite loop with HPA',
      difficulty: 'medium',
      symptom: 'The Application keeps alternating between Synced and OutOfSync continuously. Pods are scaled by HPA, reverted by self-heal, and scaled again.',
      diagnosis: `\`\`\`bash
# Check if there's an HPA in the namespace
kubectl get hpa -n <namespace>

# Check frequent sync events
argocd app get my-app -o json | jq '.status.operationState.operation.sync.revision'

# Check Deployment replicas vs Git
kubectl get deployment -n <namespace> -o jsonpath='{.items[0].spec.replicas}'
\`\`\``,
      solution: `**Solution:**

Configure ignoreDifferences for the replicas field:
\`\`\`yaml
spec:
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
\`\`\`

Also add the syncOption to respect in auto-sync:
\`\`\`yaml
spec:
  syncPolicy:
    syncOptions:
      - RespectIgnoreDifferences=true
\`\`\`

**Important:** remove the \`replicas\` field from the manifest in Git if HPA is the source of truth for scaling.`
    },
    {
      title: 'Sync waves stuck — resource never becomes Healthy',
      difficulty: 'hard',
      symptom: 'Sync gets stuck at a specific wave. Resources in the following wave are never created because ArgoCD waits for the previous ones to become Healthy.',
      diagnosis: `\`\`\`bash
# View detailed sync status
argocd app get my-app --show-operation

# View resources and their status
argocd app resources my-app

# Check which wave is stuck
argocd app get my-app -o json | jq '.status.resources[] | select(.health.status != "Healthy") | {kind: .kind, name: .name, status: .health.status}'

# View events for problematic resource
kubectl describe <resource> -n <namespace>
\`\`\``,
      solution: `**Common causes:**

1. **Misconfigured probe:** Deployment with liveness/readiness probe that never passes. The resource stays in Progressing indefinitely.

2. **Image not found:** If the image doesn't exist, the pod gets stuck in ImagePullBackOff → Degraded. Following waves don't execute.

3. **Circular dependency:** Wave 1 depends on a service that's only created in wave 2.

**Solutions:**
\`\`\`bash
# Partial sync — skip the stuck wave
argocd app sync my-app --resource :Deployment:healthy-app

# Custom timeout (there's no native wave timeout)
# Consider using sync hooks instead of waves for complex dependencies

# Check and fix the problematic resource
kubectl logs -n <namespace> <pod-with-issue>
\`\`\``
    },
    {
      title: 'PreSync hook fails and blocks entire sync',
      difficulty: 'medium',
      symptom: 'Sync never completes because a PreSync Job (e.g., database migration) fails repeatedly.',
      diagnosis: `\`\`\`bash
# View hook status
argocd app get my-app -o json | jq '.status.operationState.syncResult.resources[] | select(.hookPhase != null)'

# View hook Job logs
kubectl logs job/db-migrate -n <namespace>

# View Job state
kubectl get job db-migrate -n <namespace> -o yaml
\`\`\``,
      solution: `**Solutions:**

1. **Fix the Job:** Check logs and fix the issue in the migration script.

2. **Delete policy:** Use BeforeHookCreation to avoid conflict with previous Job:
\`\`\`yaml
metadata:
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation
\`\`\`

3. **Clean up manually and re-sync:**
\`\`\`bash
# Delete failed Job
kubectl delete job db-migrate -n <namespace>

# Re-sync
argocd app sync my-app
\`\`\`

4. **Add retry to the Job:**
\`\`\`yaml
spec:
  backoffLimit: 3  # try up to 3 times
  template:
    spec:
      restartPolicy: OnFailure
\`\`\``
    }
  ]
};
