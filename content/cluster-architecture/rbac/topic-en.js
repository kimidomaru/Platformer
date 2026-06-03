window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cluster-architecture/rbac'] = {
  theory: `
# RBAC — Role-Based Access Control

## Exam Relevance
> RBAC is one of the most heavily tested CKA topics (Cluster Architecture — 25%). Expect hands-on tasks creating Roles, ClusterRoles, RoleBindings, ClusterRoleBindings, and verifying permissions with \`kubectl auth can-i\`.

## Core Concepts

RBAC controls **who** can do **what** on **which** Kubernetes resources.

### The 4 RBAC Objects

| Object | Scope | Purpose |
|--------|-------|---------|
| **Role** | Namespace | Grants permissions within a namespace |
| **ClusterRole** | Cluster-wide | Grants permissions across all namespaces, or on cluster-scoped resources |
| **RoleBinding** | Namespace | Binds a Role or ClusterRole to a subject within a namespace |
| **ClusterRoleBinding** | Cluster-wide | Binds a ClusterRole to a subject across all namespaces |

### Subjects (Who)

- **User**: Human user (authenticated via certificates, OIDC, etc.)
- **Group**: Set of users
- **ServiceAccount**: Identity for in-cluster processes (Pods)

### Key Rule: Namespace Scope

\`\`\`
Role          → RoleBinding          = namespace-scoped
ClusterRole   → RoleBinding          = ClusterRole applied in ONE namespace
ClusterRole   → ClusterRoleBinding   = cluster-wide access
\`\`\`

**Important**: A ClusterRole can be bound with a RoleBinding to limit it to a specific namespace. This is a common pattern for reusable permission sets.

## Essential Commands

\`\`\`bash
# Create a Role (namespace-scoped)
kubectl create role pod-reader \\
  --verb=get,list,watch \\
  --resource=pods \\
  -n dev

# Create a RoleBinding
kubectl create rolebinding read-pods \\
  --role=pod-reader \\
  --user=alice \\
  -n dev

# Create a ClusterRole
kubectl create clusterrole node-reader \\
  --verb=get,list,watch \\
  --resource=nodes

# Create a ClusterRoleBinding
kubectl create clusterrolebinding read-nodes \\
  --clusterrole=node-reader \\
  --user=alice

# Bind ClusterRole within a namespace (via RoleBinding)
kubectl create rolebinding dev-admin \\
  --clusterrole=admin \\
  --user=bob \\
  -n dev

# Verify permissions (as yourself)
kubectl auth can-i create pods -n dev

# Verify as another user
kubectl auth can-i delete secrets --as=alice -n dev

# Verify as a ServiceAccount
kubectl auth can-i list pods \\
  --as=system:serviceaccount:default:myapp-sa

# List roles and bindings
kubectl get roles,rolebindings -n dev
kubectl get clusterroles,clusterrolebindings
\`\`\`

## Complete YAML Examples

### Role + RoleBinding

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: dev
rules:
- apiGroups: [""]         # "" = core API group (pods, services, etc.)
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: alice-pod-reader
  namespace: dev
subjects:
- kind: User
  name: alice
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
\`\`\`

### ClusterRole + ClusterRoleBinding

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-viewer
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["metrics.k8s.io"]
  resources: ["nodes"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ops-node-viewer
subjects:
- kind: Group
  name: ops-team
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: node-viewer
  apiGroup: rbac.authorization.k8s.io
\`\`\`

### ServiceAccount RBAC

\`\`\`yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-sa
  namespace: production
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-role
  namespace: production
rules:
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: app-role-binding
  namespace: production
subjects:
- kind: ServiceAccount
  name: app-sa
  namespace: production
roleRef:
  kind: Role
  name: app-role
  apiGroup: rbac.authorization.k8s.io
\`\`\`

## apiGroups Reference

| API Group | Resources |
|-----------|-----------|
| \`""\` (core) | pods, services, endpoints, configmaps, secrets, nodes, namespaces, persistentvolumes, persistentvolumeclaims |
| \`apps\` | deployments, replicasets, statefulsets, daemonsets |
| \`batch\` | jobs, cronjobs |
| \`rbac.authorization.k8s.io\` | roles, rolebindings, clusterroles, clusterrolebindings |
| \`networking.k8s.io\` | ingresses, networkpolicies |
| \`autoscaling\` | horizontalpodautoscalers |

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| \`forbidden: User cannot...\` | Missing role/binding | Create Role + RoleBinding |
| \`ClusterRole bound to wrong namespace\` | Used ClusterRoleBinding instead of RoleBinding | Change to RoleBinding with ClusterRole |
| Wrong \`apiGroups\` | Used \`"apps"\` for pods | Use \`""\` (empty string) for core resources |
| SA token not mounted | \`automountServiceAccountToken: false\` | Enable token mounting or use projected volumes |

## Killer.sh Style Challenge

> **Scenario**: Create a ServiceAccount \`ci-bot\` in namespace \`ci\`. It needs to:
> - \`list\` and \`get\` **Deployments** in namespace \`ci\` (apps API group)
> - \`create\` **Jobs** in namespace \`ci\` (batch API group)
> Verify that \`ci-bot\` can perform these actions using \`kubectl auth can-i\`.

\`\`\`bash
kubectl create namespace ci
kubectl create serviceaccount ci-bot -n ci

kubectl create role ci-role -n ci \\
  --verb=list,get --resource=deployments

# For jobs (different apiGroup - must use YAML)
# Add batch/jobs rule to the role

kubectl create rolebinding ci-bot-binding -n ci \\
  --role=ci-role --serviceaccount=ci:ci-bot

kubectl auth can-i list deployments -n ci \\
  --as=system:serviceaccount:ci:ci-bot

kubectl auth can-i create jobs -n ci \\
  --as=system:serviceaccount:ci:ci-bot
\`\`\`
`,
  quiz: [
    {
      question: 'You want user `alice` to be able to list pods in ALL namespaces. Which combination is correct?',
      options: [
        'Role (cluster-wide) + RoleBinding',
        'ClusterRole + ClusterRoleBinding',
        'ClusterRole + RoleBinding in default namespace',
        'Role in each namespace + RoleBinding in each namespace'
      ],
      correct: 1,
      explanation: 'ClusterRole defines cluster-wide permissions; ClusterRoleBinding grants those permissions across all namespaces. A RoleBinding would limit it to a single namespace.',
      reference: 'Study: ClusterRole + ClusterRoleBinding = cluster-wide; ClusterRole + RoleBinding = single namespace.'
    },
    {
      question: 'What is the correct `apiGroup` value for Pods, Services, and ConfigMaps?',
      options: [
        '"core"',
        '"v1"',
        '"kubernetes.io"',
        '""  (empty string)'
      ],
      correct: 3,
      explanation: 'Core API resources (pods, services, configmaps, secrets, nodes, namespaces, etc.) belong to the core group, which is represented by an empty string `""` in RBAC rules.',
      reference: 'apiGroups: [""] for core resources; apiGroups: ["apps"] for deployments/daemonsets.'
    },
    {
      question: 'A developer created a ClusterRole + ClusterRoleBinding. The user can now delete pods in the `production` namespace. Was this the intended behavior?',
      options: [
        'Yes — ClusterRole + ClusterRoleBinding always limits to the bound namespace',
        'No — ClusterRoleBinding grants cluster-wide access, including production',
        'Yes — ClusterRoles only apply to non-production namespaces by default',
        'No — ClusterRole cannot grant delete permissions'
      ],
      correct: 1,
      explanation: 'ClusterRoleBinding grants permissions cluster-wide across ALL namespaces. If you want to restrict a ClusterRole to a specific namespace, use a RoleBinding (not ClusterRoleBinding) referencing the ClusterRole.',
      reference: 'Security trap: ClusterRoleBinding = all namespaces. Use RoleBinding to scope to one namespace.'
    },
    {
      question: 'How do you verify that ServiceAccount `default/myapp-sa` can create ConfigMaps in namespace `staging`?',
      options: [
        'kubectl can-i create configmaps -n staging --sa=myapp-sa',
        'kubectl auth can-i create configmaps -n staging --as=system:serviceaccount:default:myapp-sa',
        'kubectl check permissions sa/myapp-sa create configmaps -n staging',
        'kubectl describe rolebinding -n staging | grep myapp-sa'
      ],
      correct: 1,
      explanation: 'ServiceAccounts are referenced in `--as` as `system:serviceaccount:<namespace>:<name>`. This is the standard format for impersonating a ServiceAccount.',
      reference: 'Format: system:serviceaccount:<sa-namespace>:<sa-name>'
    },
    {
      question: 'Which verb allows a subject to view logs of a Pod?',
      options: [
        'list on pods',
        'get on pods/logs',
        'read on pods/log',
        'get on pods/log'
      ],
      correct: 3,
      explanation: 'Pod logs are accessed via the sub-resource `pods/log`. You need `get` verb on `pods/log` in your RBAC rule: `resources: ["pods/log"]`.',
      reference: 'Sub-resources: pods/log, pods/exec, pods/portforward, deployments/scale.'
    },
    {
      question: 'You create a Role with `verbs: ["*"]` and `resources: ["*"]`. What does this grant?',
      options: [
        'Superuser access across the entire cluster',
        'All verbs on all resources in the Role\'s namespace',
        'All verbs on all resources in all namespaces',
        'Same as cluster-admin ClusterRole'
      ],
      correct: 1,
      explanation: 'A Role is always namespace-scoped. Using wildcards grants all permissions, but only within the specific namespace where the Role exists. For cluster-wide access, you need a ClusterRole.',
      reference: 'Role + wildcard = full namespace admin. ClusterRole + wildcard = cluster-admin equivalent.'
    },
    {
      question: 'What is the purpose of the built-in ClusterRole `view`?',
      options: [
        'Allows viewing all resources in the cluster including secrets',
        'Allows read-only access to most resources in a namespace, excluding secrets',
        'Allows viewing cluster-scoped resources only (nodes, PVs)',
        'Allows viewing pod logs only'
      ],
      correct: 1,
      explanation: 'The built-in `view` ClusterRole grants read-only access to most namespace-scoped resources but deliberately excludes Secrets (to prevent credential exposure). Use it with a RoleBinding.',
      reference: 'Built-in roles: view, edit, admin, cluster-admin — study their permission differences.'
    },
    {
      question: 'You need a Pod to call the Kubernetes API to list other Pods in its namespace. What is the minimal correct setup?',
      options: [
        'Mount the kubeconfig file from the host into the Pod',
        'Create a ServiceAccount with a Role + RoleBinding granting pod list access, then assign it to the Pod via spec.serviceAccountName',
        'Use the default ServiceAccount — it has all permissions by default',
        'Set KUBERNETES_SERVICE_HOST environment variable in the Pod'
      ],
      correct: 1,
      explanation: 'The correct pattern: ServiceAccount → Role (list pods) → RoleBinding → Pod spec.serviceAccountName. The default ServiceAccount has NO permissions in RBAC mode.',
      reference: 'Study: Pod identity via ServiceAccount, token auto-mount, and in-cluster API access.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4 RBAC objects in Kubernetes?',
      back: '1. **Role** — namespaced permissions\n2. **ClusterRole** — cluster-wide permissions\n3. **RoleBinding** — binds Role or ClusterRole to subjects *in a namespace*\n4. **ClusterRoleBinding** — binds ClusterRole to subjects *cluster-wide*'
    },
    {
      front: 'ClusterRole + RoleBinding vs ClusterRole + ClusterRoleBinding — what is the difference?',
      back: '**ClusterRole + RoleBinding**: ClusterRole permissions scoped to the **RoleBinding\'s namespace** only\n\n**ClusterRole + ClusterRoleBinding**: ClusterRole permissions apply **cluster-wide** (all namespaces)\n\nUse RoleBinding when you want reusable permission sets scoped to specific namespaces.'
    },
    {
      front: 'What apiGroup do you use for Pods, Services, ConfigMaps, Secrets?',
      back: '`apiGroups: [""]` — the **empty string** represents the core API group.\n\nCommon groups:\n- `""` → pods, services, configmaps, secrets, nodes\n- `"apps"` → deployments, replicasets, statefulsets, daemonsets\n- `"batch"` → jobs, cronjobs\n- `"rbac.authorization.k8s.io"` → roles, bindings'
    },
    {
      front: 'How do you impersonate a ServiceAccount in kubectl auth can-i?',
      back: '```bash\nkubectl auth can-i create pods \\\n  --as=system:serviceaccount:<namespace>:<sa-name>\n```\nExample:\n```bash\nkubectl auth can-i list secrets -n prod \\\n  --as=system:serviceaccount:prod:app-sa\n```'
    },
    {
      front: 'What sub-resource must you grant access to for `kubectl logs`?',
      back: '`pods/log` with verb `get`:\n```yaml\nrules:\n- apiGroups: [""]\n  resources: ["pods/log"]\n  verbs: ["get"]\n```\nOther sub-resources: `pods/exec`, `pods/portforward`, `deployments/scale`'
    },
    {
      front: 'What are the built-in ClusterRoles for namespace-level access?',
      back: '| Role | Permissions |\n|------|-------------|\n| `view` | Read-only (no secrets) |\n| `edit` | Read/write (no RBAC) |\n| `admin` | Full namespace admin (can manage RBAC) |\n| `cluster-admin` | Superuser (all resources, all namespaces) |\n\nBind with RoleBinding for namespace scope, ClusterRoleBinding for cluster-wide.'
    },
    {
      front: 'What is the ServiceAccount format for --as flag?',
      back: '`system:serviceaccount:<namespace>:<serviceaccount-name>`\n\nGroup format: `system:serviceaccounts:<namespace>` (all SAs in a namespace)\n\nAll SAs: `system:serviceaccounts` (group)\n\nAuthenticated users: `system:authenticated` (group)'
    },
    {
      front: 'After creating a Role and RoleBinding, how do you quickly verify the permissions are correct?',
      back: '```bash\n# Verify specific action\nkubectl auth can-i <verb> <resource> \\\n  -n <namespace> --as=<user-or-sa>\n\n# List all permissions for a subject\nkubectl auth can-i --list \\\n  -n <namespace> --as=<user-or-sa>\n\n# Check what a ServiceAccount can do\nkubectl auth can-i --list \\\n  --as=system:serviceaccount:default:mysa\n```'
    }
  ],
  lab: {
    scenario: 'You need to configure RBAC for a CI/CD system and a read-only monitoring user. You will create ServiceAccounts, Roles, ClusterRoles, and both types of bindings.',
    objective: 'Create and verify RBAC rules for ServiceAccounts and users with varying permission levels.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Namespace-scoped ServiceAccount RBAC',
        instruction: `In namespace **apps**:
1. Create ServiceAccount **deploy-bot**
2. Create a Role **deploy-role** that allows: \`get\`, \`list\`, \`patch\`, \`update\` on **deployments** (apps API group)
3. Create a RoleBinding **deploy-bot-binding** linking deploy-bot to deploy-role
4. Verify deploy-bot can patch deployments but NOT delete pods`,
        hints: [
          'Use \`kubectl create role\` with \`--resource=deployments --verb=get,list,patch,update\`',
          'For the API group, Deployments belong to \`apps\` — use \`--resource=deployments.apps\` or specify in YAML',
          'SA format for --as: system:serviceaccount:apps:deploy-bot'
        ],
        solution: `\`\`\`bash
kubectl create namespace apps

kubectl create serviceaccount deploy-bot -n apps

kubectl create role deploy-role -n apps \\
  --verb=get,list,patch,update \\
  --resource=deployments

kubectl create rolebinding deploy-bot-binding -n apps \\
  --role=deploy-role \\
  --serviceaccount=apps:deploy-bot

# Verify
kubectl auth can-i patch deployments -n apps \\
  --as=system:serviceaccount:apps:deploy-bot

kubectl auth can-i delete pods -n apps \\
  --as=system:serviceaccount:apps:deploy-bot
\`\`\``,
        verify: `\`\`\`bash
kubectl auth can-i patch deployments -n apps \\
  --as=system:serviceaccount:apps:deploy-bot
# Expected: yes

kubectl auth can-i delete pods -n apps \\
  --as=system:serviceaccount:apps:deploy-bot
# Expected: no

kubectl get rolebinding deploy-bot-binding -n apps
# Expected: binding listed
\`\`\``
      },
      {
        title: 'ClusterRole for Node Monitoring',
        instruction: `Create a ClusterRole **node-monitor** that allows \`get\`, \`list\`, \`watch\` on **nodes** and **nodes/metrics** (core API group). Bind it to user **monitor-user** using a ClusterRoleBinding so they can see nodes cluster-wide.`,
        hints: [
          'Nodes are cluster-scoped resources — must use ClusterRole',
          'Use \`kubectl create clusterrole\` and \`kubectl create clusterrolebinding\`',
          '\`nodes\` belong to core apiGroup \`""\`, \`nodes/metrics\` is a sub-resource'
        ],
        solution: `\`\`\`bash
kubectl create clusterrole node-monitor \\
  --verb=get,list,watch \\
  --resource=nodes

kubectl create clusterrolebinding monitor-binding \\
  --clusterrole=node-monitor \\
  --user=monitor-user

# Verify
kubectl auth can-i list nodes \\
  --as=monitor-user

kubectl auth can-i delete nodes \\
  --as=monitor-user
\`\`\``,
        verify: `\`\`\`bash
kubectl auth can-i list nodes --as=monitor-user
# Expected: yes

kubectl auth can-i delete nodes --as=monitor-user
# Expected: no

kubectl get clusterrolebinding monitor-binding
# Expected: binding listed
\`\`\``
      },
      {
        title: 'ClusterRole scoped to a Namespace via RoleBinding',
        instruction: `Demonstrate the difference between ClusterRoleBinding and RoleBinding when used with a ClusterRole:
1. Create ClusterRole **secret-reader** allowing \`get\`, \`list\` on **secrets**
2. Bind it to user **dev-user** using a **RoleBinding** in namespace **dev** only
3. Verify dev-user can list secrets in **dev** but NOT in **production**`,
        hints: [
          'Use \`kubectl create rolebinding\` (NOT clusterrolebinding) referencing a clusterrole with \`--clusterrole\`',
          'This scopes the ClusterRole to just the dev namespace',
          'Test both namespaces with \`kubectl auth can-i\`'
        ],
        solution: `\`\`\`bash
kubectl create namespace dev
kubectl create namespace production

kubectl create clusterrole secret-reader \\
  --verb=get,list \\
  --resource=secrets

# Bind with RoleBinding (namespace-scoped)
kubectl create rolebinding dev-secret-access \\
  -n dev \\
  --clusterrole=secret-reader \\
  --user=dev-user

# Verify
kubectl auth can-i list secrets -n dev --as=dev-user
kubectl auth can-i list secrets -n production --as=dev-user
\`\`\``,
        verify: `\`\`\`bash
kubectl auth can-i list secrets -n dev --as=dev-user
# Expected: yes

kubectl auth can-i list secrets -n production --as=dev-user
# Expected: no

kubectl get rolebinding dev-secret-access -n dev
# Expected: ClusterRole referenced in a RoleBinding in namespace dev
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pod cannot call Kubernetes API — 403 Forbidden',
      difficulty: 'medium',
      symptom: 'A Pod running a controller tries to list other Pods via the Kubernetes API and receives `403 Forbidden`. The Pod uses the default ServiceAccount.',
      diagnosis: `\`\`\`bash
# Check what ServiceAccount the pod is using
kubectl get pod <pod-name> -o jsonpath='{.spec.serviceAccountName}'
# Expected: "default"

# Check permissions of the default SA
kubectl auth can-i list pods \\
  --as=system:serviceaccount:<namespace>:default

# Check for existing role bindings on default SA
kubectl get rolebindings -n <namespace> -o yaml | grep default

# Review pod logs for the 403 error
kubectl logs <pod-name>
\`\`\``,
      solution: `The \`default\` ServiceAccount has no permissions in a properly configured RBAC cluster.

\`\`\`bash
# Create a dedicated ServiceAccount
kubectl create serviceaccount controller-sa -n <namespace>

# Grant the required permission
kubectl create role pod-lister -n <namespace> \\
  --verb=list,get,watch \\
  --resource=pods

kubectl create rolebinding controller-sa-binding -n <namespace> \\
  --role=pod-lister \\
  --serviceaccount:<namespace>:controller-sa

# Update the Pod/Deployment to use the new SA
kubectl patch deployment <name> -n <namespace> \\
  -p '{"spec":{"template":{"spec":{"serviceAccountName":"controller-sa"}}}}'

# Verify
kubectl auth can-i list pods -n <namespace> \\
  --as=system:serviceaccount:<namespace>:controller-sa
\`\`\`

**Best practice**: Always create a dedicated ServiceAccount with minimal permissions for each application (principle of least privilege).`
    },
    {
      title: 'User has more permissions than expected',
      difficulty: 'hard',
      symptom: 'User `dev-alice` can delete Secrets in the `production` namespace even though you only created a RoleBinding for her in the `dev` namespace.',
      diagnosis: `\`\`\`bash
# Audit all bindings affecting alice
kubectl get rolebindings,clusterrolebindings -A \\
  -o json | \\
  jq '.items[] | select(.subjects[]?.name=="alice")'

# More targeted check
kubectl get clusterrolebindings -o json | \\
  jq '.items[] | select(.subjects[]?.name=="alice") | .metadata.name'

# Check what groups alice belongs to
# (depends on authentication provider)

# List all permissions alice has cluster-wide
kubectl auth can-i --list --as=alice -n production
\`\`\``,
      solution: `There is a ClusterRoleBinding (not just RoleBinding) that grants alice broad permissions.

\`\`\`bash
# Find the problematic ClusterRoleBinding
kubectl get clusterrolebindings -o yaml | grep -B5 "name: alice"

# Review it
kubectl describe clusterrolebinding <binding-name>

# Fix: Delete the overly-broad ClusterRoleBinding
kubectl delete clusterrolebinding <binding-name>

# Re-create as namespace-scoped RoleBinding if needed
kubectl create rolebinding alice-dev-access \\
  -n dev \\
  --clusterrole=<appropriate-role> \\
  --user=alice

# Verify access is now limited to dev
kubectl auth can-i delete secrets -n production --as=alice
# Expected: no

kubectl auth can-i delete secrets -n dev --as=alice
# Expected: yes (if appropriate)
\`\`\`

**Key lesson**: Always audit ClusterRoleBindings when debugging unexpected access. They grant permissions in ALL namespaces.`
    }
  ]
};
