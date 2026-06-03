window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-cluster-hardening/rbac-advanced'] = {
  theory: `# Advanced RBAC for CKS

## Exam Relevance
> CKS expects deep RBAC knowledge: privilege escalation paths, dangerous permissions, ServiceAccount restrictions, impersonation, aggregated ClusterRoles, and auditing. Covers ~15% of Cluster Hardening domain.

## RBAC Privilege Escalation Paths

Understanding how an attacker escalates privileges via RBAC is critical for CKS.

### Path 1: Create Pods → Node Compromise

\`\`\`yaml
# Dangerous: create pods in kube-system
kind: Role
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["create"]
\`\`\`

**Exploit:**
\`\`\`yaml
# Attacker creates a privileged pod mounting host filesystem
apiVersion: v1
kind: Pod
metadata:
  name: escape
  namespace: kube-system
spec:
  hostPID: true
  hostNetwork: true
  containers:
  - name: pwn
    image: ubuntu
    command: ["/bin/bash", "-c", "chroot /host /bin/bash"]
    securityContext:
      privileged: true
    volumeMounts:
    - name: host
      mountPath: /host
  volumes:
  - name: host
    hostPath:
      path: /
\`\`\`

### Path 2: Get Secrets → Token Theft

\`\`\`yaml
# Dangerous: read secrets in any privileged namespace
kind: ClusterRole
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list"]
\`\`\`

**Exploit:** List secrets in kube-system, read ServiceAccount tokens, impersonate other identities.

### Path 3: Bind/Escalate → Direct Privilege Escalation

\`\`\`yaml
# bind: create RoleBindings/ClusterRoleBindings
# escalate: update Roles/ClusterRoles
kind: ClusterRole
rules:
- apiGroups: ["rbac.authorization.k8s.io"]
  resources: ["clusterroles", "clusterrolebindings"]
  verbs: ["bind", "escalate", "create", "update"]
\`\`\`

**Exploit:** Bind yourself to cluster-admin.

Kubernetes prevents this with the **RBAC escalation prevention** rule: you cannot grant permissions you don't already have — UNLESS you have the \`escalate\` verb.

### Path 4: Impersonation

\`\`\`yaml
# Dangerous: impersonate other users
kind: ClusterRole
rules:
- apiGroups: [""]
  resources: ["users", "serviceaccounts"]
  verbs: ["impersonate"]
\`\`\`

**Exploit:** kubectl --as=cluster-admin get secrets

### Path 5: Exec into Pods

\`\`\`yaml
# Allows running commands inside any pod
kind: ClusterRole
rules:
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
\`\`\`

**Exploit:** Exec into a pod running with elevated privileges or with secrets mounted.

## Dangerous Permission Combinations

| Permission | Risk | Why |
|-----------|------|-----|
| pods/exec | Critical | Execute arbitrary commands in pods |
| secrets (get/list) | Critical | Steal service account tokens |
| clusterroles (bind/escalate) | Critical | Directly become cluster-admin |
| pods (create) | High | Create privileged pods → node compromise |
| nodes (update) | High | Modify node conditions, taints |
| daemonsets (create/update) | High | Run privileged pods on every node |
| cronjobs (create) | Medium | Run periodic arbitrary code |
| configmaps (update) | Medium | Override configurations read by other pods |

## ServiceAccount Security

### Disable Automounting

By default, every pod gets a ServiceAccount token mounted at \`/var/run/secrets/kubernetes.io/serviceaccount/token\`.

\`\`\`yaml
# Disable at ServiceAccount level (affects all pods using this SA)
apiVersion: v1
kind: ServiceAccount
metadata:
  name: restricted-sa
automountServiceAccountToken: false

# Disable at pod level (overrides SA setting)
apiVersion: v1
kind: Pod
spec:
  automountServiceAccountToken: false
  serviceAccountName: restricted-sa
\`\`\`

### Default ServiceAccount Lockdown

\`\`\`bash
# The default SA in every namespace should have no permissions
# Verify:
kubectl auth can-i get pods --as=system:serviceaccount:default:default

# Check RoleBindings for the default SA
kubectl get rolebindings,clusterrolebindings -A -o json | \
  python3 -c "
import json, sys
d = json.load(sys.stdin)
for item in d.get('items', []):
  for subj in item.get('subjects', []):
    if subj.get('name') == 'default' and subj.get('kind') == 'ServiceAccount':
      print(item['metadata']['name'], '→', item['roleRef']['name'])
"
\`\`\`

### ServiceAccount Best Practices

\`\`\`yaml
# Create dedicated SA per application
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp-sa
  namespace: myapp
automountServiceAccountToken: false  # disable if not needed

---
# Grant minimum required permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: myapp-role
  namespace: myapp
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get"]
  resourceNames: ["myapp-config"]  # restrict to specific resource

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: myapp-binding
  namespace: myapp
subjects:
- kind: ServiceAccount
  name: myapp-sa
  namespace: myapp
roleRef:
  kind: Role
  name: myapp-role
  apiGroup: rbac.authorization.k8s.io
\`\`\`

## Aggregated ClusterRoles

ClusterRoles can be aggregated — permissions from matching ClusterRoles are combined:

\`\`\`yaml
# An aggregator ClusterRole pulls in permissions from matching roles
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring
aggregationRule:
  clusterRoleSelectors:
  - matchLabels:
      rbac.example.com/aggregate-to-monitoring: "true"
rules: []   # rules are auto-populated from aggregated roles

---
# This role is automatically included in "monitoring"
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring-endpoints
  labels:
    rbac.example.com/aggregate-to-monitoring: "true"
rules:
- apiGroups: [""]
  resources: ["endpoints", "pods", "services"]
  verbs: ["get", "list", "watch"]
\`\`\`

**Built-in aggregation targets:** admin, edit, view ClusterRoles aggregate labeled ClusterRoles automatically.

## RBAC Auditing

\`\`\`bash
# Who can create pods cluster-wide?
kubectl auth can-i create pods --all-namespaces --as=system:serviceaccount:default:default

# List all ClusterRoleBindings for a user
kubectl get clusterrolebindings -o json | \
  jq '.items[] | select(.subjects[]? | .name=="myuser") | {name: .metadata.name, role: .roleRef.name}'

# Find all SAs with access to secrets
kubectl get rolebindings,clusterrolebindings -A -o json | \
  jq '.items[] | select(.roleRef.name | test("secret")) | {name: .metadata.name, ns: .metadata.namespace}'

# Check specific permission
kubectl auth can-i delete secrets -n kube-system --as=system:serviceaccount:myapp:myapp-sa

# Use rbac-lookup tool (if available)
kubectl rbac-lookup admin
kubectl rbac-lookup --kind ServiceAccount

# Check who can impersonate
kubectl get clusterrolebindings -o json | \
  jq '.items[] | select(.rules[]?.verbs[] == "impersonate") | .metadata.name'
\`\`\`

## Least Privilege Patterns

### Using resourceNames

\`\`\`yaml
# Only allow access to specific named resources
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "update"]
  resourceNames: ["my-app-config", "my-app-settings"]

# Only allow access to specific secrets
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get"]
  resourceNames: ["db-password", "api-key"]
\`\`\`

**Limitation:** resourceNames cannot be used with \`list\` or \`watch\` verbs (they can't pre-filter by name).

### Time-Limited Access

\`\`\`bash
# Create a RoleBinding, set a manual reminder to delete it
kubectl create rolebinding temp-admin \
  --clusterrole=admin \
  --user=contractor@example.com \
  --namespace=staging

# Add an annotation for tracking
kubectl annotate rolebinding temp-admin \
  purpose="Contractor access until 2024-12-31" \
  owner="security-team@example.com"

# Create CronJob or external process to auto-expire
\`\`\`

## RBAC Anti-Patterns

\`\`\`yaml
# DON'T: Wildcard everything
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["*"]

# DON'T: Give view to all namespaces to service accounts
subjects:
- kind: Group
  name: system:serviceaccounts

# DON'T: Bind cluster-admin to any non-admin user
roleRef:
  kind: ClusterRole
  name: cluster-admin

# DON'T: Allow pods/exec in production namespaces for operators
rules:
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
\`\`\`

## Common Mistakes

- **ClusterRole without namespace scope**: A RoleBinding to a ClusterRole is namespace-scoped; use ClusterRoleBinding for cluster-wide access
- **Missing namespace in RoleBinding subject**: ServiceAccount subjects must include the namespace
- **Wildcard verbs on sensitive resources**: Avoid \`verbs: ["*"]\` on secrets, pods, nodes
- **Forgetting pods/exec is a separate resource**: Creating a Role for "pods" doesn't automatically grant exec access

## Killer.sh Style Challenge

> **Scenario**: A security review found the ServiceAccount "api-reader" in namespace "app" can list all secrets in the cluster. Fix it to only read the ConfigMap "app-config" in the "app" namespace.
`,

  quiz: [
    {
      question: 'Why is the ability to create pods considered a high-privilege RBAC permission?',
      options: [
        'An attacker can create a privileged pod with hostPath mounts to access the node filesystem and escape the container',
        'Pod creation requires cluster-admin credentials',
        'Pods automatically get access to all Secrets in the namespace when created',
        'Creating pods requires access to the etcd datastore directly'
      ],
      correct: 0,
      explanation: 'Pod creation allows an attacker to run a privileged container with hostPID, hostNetwork, or hostPath mounts to access the underlying node. This effectively gives node-level access and can lead to full cluster compromise.',
      reference: 'Advanced RBAC — Path 1: Create Pods section.'
    },
    {
      question: 'What Kubernetes protection prevents a user from binding a ClusterRole they don\'t already have?',
      options: [
        'RBAC escalation prevention — you cannot grant permissions you don\'t possess (unless you have the escalate verb)',
        'AdmissionController: RBACEscalation that blocks privilege escalation bindings',
        'PodSecurityStandards restriction on RBAC API access',
        'NetworkPolicy blocking access to the rbac.authorization.k8s.io API group'
      ],
      correct: 0,
      explanation: 'Kubernetes has built-in escalation prevention: when creating or updating a Role/ClusterRole or binding, the user must have all the permissions they\'re trying to grant. Without the "escalate" verb, you can only delegate permissions you already have.',
      reference: 'Advanced RBAC — Path 3: Bind/Escalate section.'
    },
    {
      question: 'Which field disables automatic ServiceAccount token mounting for all pods using that ServiceAccount?',
      options: [
        'automountServiceAccountToken: false in the ServiceAccount spec',
        'mountServiceAccountToken: false in the PodSpec',
        'tokenAutoMount: false in the ServiceAccount spec',
        'spec.volumes.serviceAccountToken.disabled: true in the Pod spec'
      ],
      correct: 0,
      explanation: 'Setting automountServiceAccountToken: false on the ServiceAccount object disables automatic token mounting for all pods that use it. Individual pods can override this with the same field in spec.automountServiceAccountToken.',
      reference: 'Advanced RBAC — Disable Automounting section.'
    },
    {
      question: 'What limitation exists when using resourceNames in RBAC rules?',
      options: [
        'resourceNames cannot be used with the list or watch verbs',
        'resourceNames only works with ClusterRoles, not Roles',
        'resourceNames cannot contain special characters or dashes',
        'resourceNames is limited to a maximum of 10 entries per rule'
      ],
      correct: 0,
      explanation: 'List and watch operations return collections and the API server cannot pre-filter by name (it would need to return all resources and filter, which breaks the API contract). resourceNames works with get, update, patch, delete.',
      reference: 'Advanced RBAC — Using resourceNames section.'
    },
    {
      question: 'How do aggregated ClusterRoles work?',
      options: [
        'A ClusterRole with an aggregationRule automatically inherits permissions from matching labeled ClusterRoles',
        'Multiple ClusterRoles can be listed in a single ClusterRoleBinding',
        'ClusterRoles aggregate permissions from all RoleBindings in a namespace',
        'Aggregation combines RBAC rules from different API groups into one ClusterRole'
      ],
      correct: 0,
      explanation: 'Aggregated ClusterRoles use label selectors in aggregationRule.clusterRoleSelectors. Any ClusterRole with matching labels automatically contributes its rules to the aggregator. Built-in ClusterRoles (view, edit, admin) use this pattern.',
      reference: 'Advanced RBAC — Aggregated ClusterRoles section.'
    },
    {
      question: 'What does kubectl auth can-i get secrets -n kube-system --as=system:serviceaccount:app:myapp-sa check?',
      options: [
        'Whether the ServiceAccount "myapp-sa" in namespace "app" is authorized to get secrets in namespace "kube-system"',
        'Whether the user "app" can get secrets as myapp-sa',
        'Whether the system account for myapp-sa has cluster-admin',
        'The list of secrets accessible to myapp-sa'
      ],
      correct: 0,
      explanation: 'The --as flag impersonates the specified identity. system:serviceaccount:app:myapp-sa is the full name format for a ServiceAccount (namespace:name). The -n flag specifies which namespace the authorization check targets.',
      reference: 'Advanced RBAC — RBAC Auditing section.'
    },
    {
      question: 'A RoleBinding binds the ClusterRole "cluster-admin" to a user in namespace "staging". What access does the user have?',
      options: [
        'Full access (cluster-admin) only within the "staging" namespace — not cluster-wide',
        'Full cluster-admin access across all namespaces',
        'Read-only access to all resources in "staging"',
        'Access to all namespaces but only for the resources defined in the staging namespace'
      ],
      correct: 0,
      explanation: 'A RoleBinding is namespace-scoped regardless of whether it binds a Role or ClusterRole. Binding cluster-admin via a RoleBinding grants cluster-admin permissions only within that namespace. For cluster-wide cluster-admin, a ClusterRoleBinding is required.',
      reference: 'Advanced RBAC — Common Mistakes section.'
    },
    {
      question: 'Which of these is the most dangerous RBAC permission combination for a ServiceAccount?',
      options: [
        'clusterroles: bind + escalate (can grant any permission to itself, including cluster-admin)',
        'pods: list + get (read pod information)',
        'configmaps: get + update (read and modify configmaps)',
        'services: create + delete (manage services)'
      ],
      correct: 0,
      explanation: 'The bind and escalate verbs on RBAC resources are the most dangerous. "bind" allows creating RoleBindings/ClusterRoleBindings to any role. "escalate" allows updating a Role to add permissions. Together, they allow full privilege escalation to cluster-admin.',
      reference: 'Advanced RBAC — Dangerous Permission Combinations table.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 5 most dangerous RBAC permissions a service account can have?',
      back: '1. pods/exec: create — run commands in any pod\n2. secrets: get/list — steal tokens and credentials\n3. clusterroles: bind/escalate — become cluster-admin\n4. pods: create in kube-system — privileged pod escape\n5. users/serviceaccounts: impersonate — act as any identity\n\nBonus: nodes: proxy — proxy to any node port'
    },
    {
      front: 'What is RBAC escalation prevention and how can it be bypassed?',
      back: 'Prevention: You cannot create/update a Role granting permissions you don\'t have.\n\nExample: if you have "get pods" only, you cannot create a Role with "delete pods".\n\nBypass: Having the "escalate" verb on clusterroles/roles resources\n\nCheck for escalation risk:\nkubectl get clusterroles -o json | jq \'.items[] | select(.rules[]?.verbs[] | test("escalate|bind"))\''
    },
    {
      front: 'How do you disable ServiceAccount token automounting and why?',
      back: 'On ServiceAccount:\nspec.automountServiceAccountToken: false\n\nOn Pod:\nspec.automountServiceAccountToken: false\n(Pod setting overrides SA setting)\n\nWhy: The default token mounted at /var/run/secrets/kubernetes.io/serviceaccount/token can be used to call the API. If the pod doesn\'t need it, disable it — reduces attack surface if pod is compromised.'
    },
    {
      front: 'What is the format for a ServiceAccount name in kubectl --as flag?',
      back: 'system:serviceaccount:<namespace>:<serviceaccount-name>\n\nExamples:\nsystem:serviceaccount:default:default\nsystem:serviceaccount:kube-system:fluentd\nsystem:serviceaccount:app:myapp-sa\n\nUsage:\nkubectl auth can-i get secrets --as=system:serviceaccount:app:myapp-sa\nkubectl get pods --as=system:serviceaccount:kube-system:coredns'
    },
    {
      front: 'How do aggregated ClusterRoles work? Give an example.',
      back: 'Aggregated ClusterRole pulls in rules from labeled ClusterRoles:\n\n# Aggregator\nkind: ClusterRole\nmetadata: {name: monitoring}\naggregationRule:\n  clusterRoleSelectors:\n  - matchLabels:\n      aggregate-to: monitoring\nrules: []  # auto-filled\n\n# Contributor\nkind: ClusterRole\nmetadata:\n  name: metrics-reader\n  labels:\n    aggregate-to: monitoring  # auto-included!\nrules:\n- apiGroups: [""]\n  resources: [pods]\n  verbs: [get, list]'
    },
    {
      front: 'What is the limitation of resourceNames in RBAC and when should you use it?',
      back: 'Limitation: Cannot be used with list or watch verbs\n(API server cannot filter collections by name pre-response)\n\nWorks with: get, update, patch, delete\n\nBest for: restricting access to a KNOWN set of specific resources\n\nExample:\nrules:\n- resources: ["configmaps"]\n  verbs: ["get", "update"]\n  resourceNames: ["app-config"]\n\nNote: User can\'t list configmaps at all with resourceNames + delete list verb'
    }
  ],

  lab: {
    scenario: 'A security audit reveals that the "app-operator" ServiceAccount in the "production" namespace has excessive permissions. It currently has ClusterRole binding to "edit" which allows it to read secrets across the cluster. Remediate to least privilege.',
    objective: 'Audit existing RBAC permissions, identify over-privileged ServiceAccounts, and implement least-privilege access controls.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Audit existing RBAC permissions',
        instruction: `Investigate what permissions exist in the cluster and identify over-privileged bindings.

\`\`\`bash
# Create the over-privileged scenario (exam setup)
kubectl create namespace production
kubectl create serviceaccount app-operator -n production

# Bind to edit ClusterRole (over-privileged)
kubectl create clusterrolebinding app-operator-edit \
  --clusterrole=edit \
  --serviceaccount=production:app-operator

# Audit the current permissions
echo "=== ClusterRoleBindings for app-operator ==="
kubectl get clusterrolebindings -o json | \
  python3 -c "
import json, sys
d = json.load(sys.stdin)
for item in d['items']:
  for s in item.get('subjects', []):
    if s.get('name') == 'app-operator':
      print(item['metadata']['name'], '->', item['roleRef']['name'])
"

echo "=== Can list secrets cluster-wide? ==="
kubectl auth can-i list secrets --all-namespaces \
  --as=system:serviceaccount:production:app-operator

echo "=== Can create pods? ==="
kubectl auth can-i create pods -n production \
  --as=system:serviceaccount:production:app-operator
\`\`\``,
        hints: [
          'The "edit" ClusterRole allows most operations including reading secrets',
          'Check what the edit ClusterRole actually contains: kubectl describe clusterrole edit',
          'Production service accounts should NEVER have access to secrets in other namespaces'
        ],
        solution: `\`\`\`bash
kubectl create namespace production
kubectl create serviceaccount app-operator -n production
kubectl create clusterrolebinding app-operator-edit --clusterrole=edit --serviceaccount=production:app-operator
kubectl auth can-i list secrets --all-namespaces --as=system:serviceaccount:production:app-operator
\`\`\``,
        verify: `\`\`\`bash
# Current state should show over-privileged access
kubectl auth can-i list secrets -n kube-system --as=system:serviceaccount:production:app-operator
# Expected: yes (THIS IS THE PROBLEM)

kubectl auth can-i create pods -n production --as=system:serviceaccount:production:app-operator
# Expected: yes (too broad)
\`\`\``
      },
      {
        title: 'Remove the excessive ClusterRoleBinding',
        instruction: `Delete the overly broad ClusterRoleBinding that gives cluster-wide access.

\`\`\`bash
# Remove the cluster-wide binding
kubectl delete clusterrolebinding app-operator-edit

# Verify it's gone
kubectl get clusterrolebindings | grep app-operator

# Verify access is now denied
kubectl auth can-i list secrets --all-namespaces \
  --as=system:serviceaccount:production:app-operator
\`\`\``,
        hints: [
          'After deleting the ClusterRoleBinding, the SA has NO permissions at all',
          'Now we need to grant the minimum necessary permissions',
          'The SA should only access resources in the "production" namespace'
        ],
        solution: `\`\`\`bash
kubectl delete clusterrolebinding app-operator-edit
kubectl auth can-i list secrets --all-namespaces --as=system:serviceaccount:production:app-operator
\`\`\``,
        verify: `\`\`\`bash
kubectl auth can-i list secrets -n kube-system --as=system:serviceaccount:production:app-operator
# Expected: no

kubectl auth can-i create pods -n production --as=system:serviceaccount:production:app-operator
# Expected: no
\`\`\``
      },
      {
        title: 'Create a least-privilege Role and RoleBinding',
        instruction: `Create a namespace-scoped Role with only the permissions the app actually needs: read configmaps and deployments in the production namespace.

\`\`\`yaml
# app-operator-role.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-operator-role
  namespace: production
rules:
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get"]
  resourceNames: ["app-config"]   # restrict to specific config
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: app-operator-binding
  namespace: production
subjects:
- kind: ServiceAccount
  name: app-operator
  namespace: production
roleRef:
  kind: Role
  name: app-operator-role
  apiGroup: rbac.authorization.k8s.io
\`\`\`

\`\`\`bash
kubectl apply -f app-operator-role.yaml

# Also disable token automounting
kubectl patch serviceaccount app-operator -n production \
  -p '{"automountServiceAccountToken": false}'
\`\`\``,
        hints: [
          'Use resourceNames to restrict to specific ConfigMaps if possible',
          'RoleBinding is namespace-scoped — it only grants access within "production"',
          'Disable automountServiceAccountToken if the app doesn\'t need to call the API'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-operator-role
  namespace: production
rules:
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get"]
EOF
kubectl create rolebinding app-operator-binding --role=app-operator-role --serviceaccount=production:app-operator -n production
\`\`\``,
        verify: `\`\`\`bash
# Should have access within production
kubectl auth can-i list deployments -n production --as=system:serviceaccount:production:app-operator
# Expected: yes

kubectl auth can-i get configmaps -n production --as=system:serviceaccount:production:app-operator
# Expected: yes

# Should NOT have access outside production
kubectl auth can-i list deployments -n default --as=system:serviceaccount:production:app-operator
# Expected: no

# Should NOT access secrets
kubectl auth can-i get secrets -n production --as=system:serviceaccount:production:app-operator
# Expected: no

# Should NOT create pods
kubectl auth can-i create pods -n production --as=system:serviceaccount:production:app-operator
# Expected: no
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Application pod fails with "403 Forbidden" after RBAC change',
      difficulty: 'medium',
      symptom: 'After reducing ServiceAccount permissions, the application pod logs show "403 Forbidden" when calling the Kubernetes API.',
      diagnosis: `\`\`\`bash
# Check what the pod is trying to access (look at the error message)
kubectl logs <pod-name> -n production | grep -E "403|Forbidden|RBAC"

# Check what SA the pod uses
kubectl get pod <pod-name> -n production -o yaml | grep serviceAccountName

# List current RoleBindings for the SA
kubectl get rolebindings,clusterrolebindings -A -o json | \
  python3 -c "
import json, sys
d = json.load(sys.stdin)
for item in d['items']:
  for s in item.get('subjects', []):
    if s.get('name') == '<sa-name>' and s.get('namespace') == 'production':
      print(f\"{item['metadata']['namespace']}/{item['metadata']['name']} -> {item['roleRef']['name']}\")
"

# Test the specific permission that's failing
kubectl auth can-i <verb> <resource> -n <namespace> \
  --as=system:serviceaccount:production:<sa-name>
\`\`\``,
      solution: `**Fix: Grant the missing permission**

\`\`\`bash
# Identify the exact API call from the error
# Common pattern: "cannot list resource X in API group Y in namespace Z"

# Add the missing permission to the existing Role
kubectl edit role app-operator-role -n production
# Add the required verb/resource

# Or patch it:
kubectl patch role app-operator-role -n production --type=json \
  -p='[{"op":"add","path":"/rules/-","value":{"apiGroups":[""],"resources":["pods"],"verbs":["get","list"]}}]'

# Verify:
kubectl auth can-i list pods -n production --as=system:serviceaccount:production:app-operator
\`\`\``
    },
    {
      title: 'Cannot find which binding grants a user excessive access',
      difficulty: 'hard',
      symptom: 'kubectl auth can-i shows that user "dev-user" can delete all secrets cluster-wide, but you cannot find the responsible ClusterRoleBinding.',
      diagnosis: `\`\`\`bash
# Check direct ClusterRoleBindings
kubectl get clusterrolebindings -o json | \
  jq '.items[] | select(.subjects[]? | .name=="dev-user") | {name: .metadata.name, role: .roleRef.name}'

# Check group memberships (user might be in a group with a binding)
kubectl get clusterrolebindings -o json | \
  jq '.items[] | select(.subjects[]? | .kind=="Group") | {name: .metadata.name, subjects: .subjects, role: .roleRef.name}'

# Check namespace-level RoleBindings
kubectl get rolebindings -A -o json | \
  jq '.items[] | select(.subjects[]? | .name=="dev-user") | {ns: .metadata.namespace, name: .metadata.name, role: .roleRef.name}'

# Check system:authenticated group (all authenticated users)
kubectl get clusterrolebindings -o json | \
  jq '.items[] | select(.subjects[]? | .name=="system:authenticated" or .name=="system:masters") | .metadata.name'
\`\`\``,
      solution: `**The access usually comes from:**

**1. Group membership** — user is in "developers" group with cluster-admin:
\`\`\`bash
kubectl get clusterrolebindings -o json | jq '.items[] | select(.subjects[]? | .kind=="Group")'
\`\`\`

**2. system:authenticated system group** — grants access to all authenticated users:
\`\`\`bash
kubectl get clusterrolebinding system:discovery -o yaml
# This is expected; check if extra permissions were added to this group
\`\`\`

**3. Aggregated ClusterRole** — permissions come from an aggregated role:
\`\`\`bash
kubectl get clusterroles -o json | jq '.items[] | select(.aggregationRule) | .metadata.name'
\`\`\`

**Fix:** Once found, delete the ClusterRoleBinding or remove the user from the group in your identity provider.`
    }
  ]
};
