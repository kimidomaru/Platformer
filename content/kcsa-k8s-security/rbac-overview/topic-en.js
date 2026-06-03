window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcsa-k8s-security/rbac-overview'] = {
  theory: `# RBAC Overview

## Exam Relevance
> KCSA tests RBAC concepts, creating Roles and RoleBindings, identifying privilege escalation risks, and the principle of least privilege. This is one of the most important security topics in Kubernetes.

## What is RBAC?

**Role-Based Access Control (RBAC)** controls who can perform which operations on which Kubernetes resources.

**RBAC answers**: *Can user X perform action Y on resource Z?*

Enabled with: \`--authorization-mode=RBAC\` (default since Kubernetes 1.6)

## RBAC Building Blocks

\`\`\`
SUBJECT         ROLE/CLUSTERROLE       BINDING
─────────       ────────────────       ───────
Who?     +      What can they do? =    RoleBinding / ClusterRoleBinding
\`\`\`

### Subjects
| Type | Example | Scope |
|------|---------|-------|
| **User** | alice, system:admin | External (certificates, OIDC) |
| **Group** | developers, system:masters | External (cert O field, OIDC groups) |
| **ServiceAccount** | my-sa (namespace-scoped) | Kubernetes-native identity |

### Roles (namespace-scoped)
\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: production
rules:
  - apiGroups: [""]           # "" = core API group
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list"]
\`\`\`

### ClusterRoles (cluster-scoped)
\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-reader
rules:
  - apiGroups: [""]
    resources: ["nodes"]       # nodes are cluster-scoped
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods"]        # ClusterRoles can also grant namespace permissions
    verbs: ["get", "list"]
\`\`\`

### RoleBinding and ClusterRoleBinding
\`\`\`yaml
# RoleBinding: bind a Role (or ClusterRole) in a specific namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-reader-binding
  namespace: production
subjects:
  - kind: User
    name: alice
    apiGroup: rbac.authorization.k8s.io
  - kind: ServiceAccount
    name: my-app-sa
    namespace: production
roleRef:
  kind: Role              # or ClusterRole
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
\`\`\`

\`\`\`yaml
# ClusterRoleBinding: grants cluster-wide permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: node-reader-global
subjects:
  - kind: Group
    name: operations
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: node-reader
  apiGroup: rbac.authorization.k8s.io
\`\`\`

## API Groups and Resources

\`\`\`bash
# List all API groups and resources
kubectl api-resources -o wide

# Core group (""): pods, services, configmaps, secrets, nodes, events
# apps: deployments, replicasets, daemonsets, statefulsets
# batch: jobs, cronjobs
# rbac.authorization.k8s.io: roles, rolebindings, clusterroles, clusterrolebindings
# networking.k8s.io: ingresses, networkpolicies
\`\`\`

## Verbs

| Verb | HTTP Method | Description |
|------|-------------|-------------|
| **get** | GET | Get a specific resource |
| **list** | GET | List all resources of a type |
| **watch** | GET + watch | Watch for changes |
| **create** | POST | Create a new resource |
| **update** | PUT | Replace an existing resource |
| **patch** | PATCH | Partially modify a resource |
| **delete** | DELETE | Delete a resource |
| **deletecollection** | DELETE | Delete multiple resources |
| **exec** | POST | Execute a command in a pod |
| **bind** | POST | Bind a role |
| **escalate** | POST | Escalate privileges |

## Quick CLI Commands

\`\`\`bash
# Create Role with kubectl
kubectl create role pod-reader \\
  --verb=get,list,watch \\
  --resource=pods \\
  -n production

# Create ClusterRole
kubectl create clusterrole node-reader \\
  --verb=get,list,watch \\
  --resource=nodes

# Create RoleBinding
kubectl create rolebinding pod-reader-binding \\
  --role=pod-reader \\
  --user=alice \\
  -n production

# Create ClusterRoleBinding
kubectl create clusterrolebinding node-reader-binding \\
  --clusterrole=node-reader \\
  --group=operations

# Check permissions
kubectl auth can-i get pods -n production        # check your own permissions
kubectl auth can-i get pods --as=alice -n production  # check alice's permissions
kubectl auth can-i --list -n production          # list all your permissions

# Impersonate a ServiceAccount
kubectl auth can-i list secrets \\
  --as=system:serviceaccount:production:my-app-sa \\
  -n production
\`\`\`

## Built-in ClusterRoles

| ClusterRole | Permissions |
|-------------|-------------|
| **cluster-admin** | All permissions on all resources |
| **admin** | Full access to namespace resources (not cluster) |
| **edit** | Read/write to most namespace resources (not RBAC) |
| **view** | Read-only to most namespace resources |
| **system:node** | Node-level permissions (used by kubelets) |

## Dangerous RBAC Patterns

### Wildcard permissions (cluster-admin equivalent)
\`\`\`yaml
rules:
  - apiGroups: ["*"]    # all API groups
    resources: ["*"]    # all resources
    verbs: ["*"]        # all verbs
\`\`\`

### Privilege escalation paths
\`\`\`
Create pods → create privileged pod → node escape
Exec into pods → access app data, potentially SA tokens
Get secrets → read all secrets in namespace
Bind/escalate verbs → grant yourself more permissions
\`\`\`

### Overly Broad Role Examples to Avoid
\`\`\`yaml
# BAD: No reason for a dev to list secrets cluster-wide
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list"]   # list = see all secrets!

# BETTER: Only get specific secrets they need
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get"]
    resourceNames: ["app-config"]   # only this specific secret!
\`\`\`

## Principle of Least Privilege

1. **Start with no permissions** and add only what's needed
2. **Use namespace-scoped roles** unless cluster resources are needed
3. **Avoid wildcard verbs and resources**
4. **Use resourceNames** to restrict to specific instances
5. **Regularly audit** RBAC bindings
6. **Never** grant cluster-admin to application ServiceAccounts

## RBAC Audit Commands

\`\`\`bash
# Find all cluster-admin bindings
kubectl get clusterrolebindings -o json | \\
  python3 -c "import json,sys; [print(x['metadata']['name']) for x in json.load(sys.stdin)['items'] if x.get('roleRef',{}).get('name')=='cluster-admin']"

# Find all bindings for a specific user/SA
kubectl get rolebindings,clusterrolebindings --all-namespaces -o json | \\
  python3 -c "import json,sys; [print(x['metadata']['name']) for x in json.load(sys.stdin)['items'] for s in x.get('subjects',[]) if s.get('name')=='alice']"

# What can a specific SA do?
kubectl auth can-i --list \\
  --as=system:serviceaccount:default:my-sa \\
  -n default
\`\`\`
`,
  quiz: [
    {
      question: 'What is the difference between a Role and a ClusterRole in Kubernetes RBAC?',
      options: [
        'Role grants permissions in a specific namespace; ClusterRole grants permissions cluster-wide or can be bound to a namespace',
        'Role grants read permissions; ClusterRole grants read and write permissions',
        'Role is for users; ClusterRole is for ServiceAccounts',
        'Role can only be used with RoleBinding; ClusterRole can only be used with ClusterRoleBinding'
      ],
      correct: 0,
      explanation: 'Role is namespace-scoped — permissions are limited to the namespace where the Role is created. ClusterRole grants cluster-wide permissions (e.g., nodes) and can also be bound to namespaces via RoleBinding.',
      reference: 'Review "Roles (namespace-scoped)" and "ClusterRoles (cluster-scoped)" sections.'
    },
    {
      question: 'What command verifies whether user "alice" can list pods in namespace "production"?',
      options: [
        'kubectl auth can-i list pods --as=alice -n production',
        'kubectl rbac check alice list pods -n production',
        'kubectl get rolebindings -n production | grep alice',
        'kubectl describe role -n production | grep "alice:list"'
      ],
      correct: 0,
      explanation: 'kubectl auth can-i <verb> <resource> --as=<user> -n <namespace> is the built-in way to check permissions. Returns "yes" or "no". Use --as-group for group impersonation.',
      reference: 'Review "Quick CLI Commands" section.'
    },
    {
      question: 'What is the RBAC apiGroup for core resources like pods and services?',
      options: [
        '"" (empty string)',
        '"core"',
        '"kubernetes.io"',
        '"v1"'
      ],
      correct: 0,
      explanation: 'The core API group (pods, services, configmaps, secrets, nodes, events, namespaces, endpoints) is referenced with an empty string "". Apps group (deployments, daemonsets) uses "apps".',
      reference: 'Review "API Groups and Resources" section.'
    },
    {
      question: 'A ClusterRoleBinding grants a ClusterRole to a Group. What scope do those permissions apply?',
      options: [
        'Cluster-wide — across all namespaces',
        'Only in the namespace where the ClusterRoleBinding is created',
        'Only in namespaces where the group has members',
        'Only for the specific resources listed in the ClusterRole'
      ],
      correct: 0,
      explanation: 'ClusterRoleBinding grants cluster-wide permissions. Unlike RoleBinding (which scopes even ClusterRoles to a single namespace), ClusterRoleBinding gives the permissions globally.',
      reference: 'Review "ClusterRoleBinding" section.'
    },
    {
      question: 'Why is the "list" verb on Secrets particularly dangerous?',
      options: [
        'It allows enumerating and reading the values of ALL secrets in the namespace',
        'It allows creating new secrets',
        'It counts as a write operation and can log all secret access',
        'It gives access to secret metadata only, not the values'
      ],
      correct: 0,
      explanation: 'list on secrets returns ALL secrets including their data (base64-encoded values). Even "get" alone is dangerous, but list returns ALL secrets at once. Use resourceNames to restrict to specific secrets.',
      reference: 'Review "Dangerous RBAC Patterns" — Overly Broad Role Examples.'
    },
    {
      question: 'What is the "resourceNames" field in RBAC rules used for?',
      options: [
        'Restricting the RBAC rule to specific named resource instances',
        'Listing which namespaces the rule applies to',
        'Defining custom resource names for CRDs',
        'Specifying which API group resources belong to'
      ],
      correct: 0,
      explanation: 'resourceNames limits an RBAC rule to specific named instances (e.g., only get the "app-config" ConfigMap, not all ConfigMaps). More restrictive than allowing the entire resource type.',
      reference: 'Review "Dangerous RBAC Patterns" — BETTER example with resourceNames.'
    },
    {
      question: 'Which RBAC verbs allow a user to escalate their own privileges?',
      options: [
        '"bind" and "escalate" — allow binding roles and escalating permissions',
        '"create" and "update" — allow modifying RBAC resources',
        '"patch" and "delete" — allow modifying and removing restrictions',
        '"exec" and "portforward" — allow bypassing RBAC checks'
      ],
      correct: 0,
      explanation: '"bind" allows creating RoleBindings/ClusterRoleBindings — you could bind cluster-admin to yourself. "escalate" allows creating Roles with permissions you don\'t currently have. These are dangerous verbs to grant.',
      reference: 'Review "Verbs" table — bind and escalate.'
    },
    {
      question: 'What is the system:masters group in Kubernetes?',
      options: [
        'Members of this group get cluster-admin permissions that CANNOT be overridden by RBAC',
        'A group for Kubernetes cluster operators with admin permissions via RBAC',
        'The built-in group for control plane components',
        'A group for node admission that allows joining the cluster'
      ],
      correct: 0,
      explanation: 'system:masters is a special group that bypasses RBAC entirely — it\'s handled at the authentication level and always gets full cluster-admin. Use with extreme caution — usually only for emergency break-glass certificates.',
      reference: 'Review "Built-in ClusterRoles" and implied in the RBAC model.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4 RBAC resources and how are they related?',
      back: 'Role (namespace permissions), ClusterRole (cluster permissions), RoleBinding (grants Role/ClusterRole in a namespace to a subject), ClusterRoleBinding (grants ClusterRole cluster-wide to a subject).'
    },
    {
      front: 'How do you check if a ServiceAccount can perform a specific action?',
      back: 'kubectl auth can-i <verb> <resource> --as=system:serviceaccount:<namespace>:<sa-name> [-n <namespace>]. Also: kubectl auth can-i --list --as=... to see all permissions.'
    },
    {
      front: 'What is the apiGroup for Deployments and other apps resources?',
      back: '"apps" — use in RBAC rules: apiGroups: ["apps"], resources: ["deployments"]. Core resources (pods, services, etc.) use: apiGroups: [""].'
    },
    {
      front: 'What makes "cluster-admin" dangerous to assign to application ServiceAccounts?',
      back: 'cluster-admin = all verbs on all resources. A compromised app pod with a cluster-admin SA can delete all resources, read all secrets, escalate to node, and cause complete cluster takeover. Use least-privilege roles instead.'
    },
    {
      front: 'How does RoleBinding differ from ClusterRoleBinding when referencing a ClusterRole?',
      back: 'RoleBinding + ClusterRole = ClusterRole permissions scoped to the binding\'s namespace only. ClusterRoleBinding + ClusterRole = ClusterRole permissions cluster-wide. RoleBinding limits scope even when using ClusterRole.'
    },
    {
      front: 'What is the resourceNames field in RBAC and when to use it?',
      back: 'Restricts a rule to specific resource instances by name. Example: grant "get" on secret "db-password" only, not all secrets. Use when you know exactly which resources an app needs access to.'
    }
  ],
  lab: {
    scenario: 'Practice creating minimal RBAC rules for a multi-tier application with different permission needs per component.',
    objective: 'Apply the principle of least privilege by creating precisely scoped RBAC roles.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create least-privilege roles for application components',
        instruction: `In namespace \`rbac-lab\`, create ServiceAccounts and Roles for: 1) \`frontend-sa\` — needs only ConfigMap reads; 2) \`backend-sa\` — needs Pod reads and Secret get (specific secret "db-secret" only); 3) \`monitor-sa\` — needs to get/list pods across all namespaces.`,
        hints: [
          'For monitor-sa: need a ClusterRole (cross-namespace)',
          'For backend-sa: use resourceNames to restrict to "db-secret"',
          'kubectl create role/clusterrole is faster than writing YAML'
        ],
        solution: `\`\`\`bash
kubectl create namespace rbac-lab

# Frontend SA — read ConfigMaps only
kubectl create serviceaccount frontend-sa -n rbac-lab
kubectl create role frontend-role \\
  --verb=get,list \\
  --resource=configmaps \\
  -n rbac-lab
kubectl create rolebinding frontend-binding \\
  --role=frontend-role \\
  --serviceaccount=rbac-lab:frontend-sa \\
  -n rbac-lab

# Backend SA — read pods + get specific secret
kubectl create serviceaccount backend-sa -n rbac-lab
cat <<EOF | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: backend-role
  namespace: rbac-lab
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get"]
    resourceNames: ["db-secret"]   # specific secret only!
EOF

kubectl create rolebinding backend-binding \\
  --role=backend-role \\
  --serviceaccount=rbac-lab:backend-sa \\
  -n rbac-lab

# Monitor SA — read pods cluster-wide (needs ClusterRole)
kubectl create serviceaccount monitor-sa -n rbac-lab
kubectl create clusterrole pod-monitor \\
  --verb=get,list,watch \\
  --resource=pods
kubectl create clusterrolebinding pod-monitor-binding \\
  --clusterrole=pod-monitor \\
  --serviceaccount=rbac-lab:monitor-sa
\`\`\``,
        verify: `\`\`\`bash
# Frontend: can read configmaps?
kubectl auth can-i list configmaps \\
  --as=system:serviceaccount:rbac-lab:frontend-sa -n rbac-lab
# Expected: yes

# Frontend: can read pods? (NO — least privilege)
kubectl auth can-i list pods \\
  --as=system:serviceaccount:rbac-lab:frontend-sa -n rbac-lab
# Expected: no

# Backend: can get specific secret?
kubectl auth can-i get secrets \\
  --as=system:serviceaccount:rbac-lab:backend-sa -n rbac-lab
# Expected: yes

# Backend: can list ALL secrets? (NO — resourceNames restricts this)
kubectl auth can-i list secrets \\
  --as=system:serviceaccount:rbac-lab:backend-sa -n rbac-lab
# Expected: no

# Monitor: can list pods in different namespace?
kubectl auth can-i list pods \\
  --as=system:serviceaccount:rbac-lab:monitor-sa -n kube-system
# Expected: yes (cluster-wide)
\`\`\``
      },
      {
        title: 'Audit RBAC for over-permissioned bindings',
        instruction: `Find all ClusterRoleBindings in the cluster. Identify any that grant cluster-admin or broad permissions to non-system subjects. Practice identifying RBAC risks.`,
        hints: [
          'kubectl get clusterrolebindings -o wide',
          'Look for roleRef.name == cluster-admin with non-system subjects',
          'kubectl auth can-i --list --as=system:serviceaccount:... shows all permissions'
        ],
        solution: `\`\`\`bash
# List all ClusterRoleBindings with their roles and subjects
kubectl get clusterrolebindings -o custom-columns="NAME:.metadata.name,ROLE:.roleRef.name,SUBJECTS:.subjects[*].name" 2>/dev/null | head -20

# Find cluster-admin bindings
kubectl get clusterrolebindings -o json | \\
  python3 -c "
import json, sys
crbs = json.load(sys.stdin)
for crb in crbs['items']:
    role = crb.get('roleRef', {}).get('name', '')
    subjects = crb.get('subjects', []) or []
    for s in subjects:
        if role in ['cluster-admin', 'admin'] or '*' in role:
            print(f'RISK: {crb[\"metadata\"][\"name\"]} → {role} → {s.get(\"kind\")}/{s.get(\"name\")}')
"

# Check a specific SA's permissions
kubectl auth can-i --list \\
  --as=system:serviceaccount:rbac-lab:backend-sa \\
  -n rbac-lab | head -20
\`\`\``,
        verify: `\`\`\`bash
# Verify you see system-level cluster-admin bindings (expected)
kubectl get clusterrolebindings | grep -E "cluster-admin|NAME" | head -10
# Expected: shows system: subjects with cluster-admin

# Verify rbac-lab SAs only have minimal permissions
kubectl auth can-i --list \\
  --as=system:serviceaccount:rbac-lab:frontend-sa \\
  -n rbac-lab | grep "yes"
# Expected: only configmaps get/list

# Cleanup
kubectl delete namespace rbac-lab
kubectl delete clusterrole pod-monitor
kubectl delete clusterrolebinding pod-monitor-binding
\`\`\``
      },
      {
        title: 'Test permission boundary: RoleBinding with ClusterRole',
        instruction: `Demonstrate that using a RoleBinding (not ClusterRoleBinding) with a ClusterRole scopes the permissions to a single namespace. Create a ClusterRole that allows listing pods, but bind it with a RoleBinding in just one namespace.`,
        hints: [
          'Create a ClusterRole "pod-lister"',
          'Create RoleBinding (NOT ClusterRoleBinding) in namespace "ns-a"',
          'Test: can list pods in ns-a (yes), kube-system (no)'
        ],
        solution: `\`\`\`bash
kubectl create namespace ns-a 2>/dev/null || true
kubectl create serviceaccount scoped-sa -n ns-a

# ClusterRole with pod list permission
kubectl create clusterrole pod-lister \\
  --verb=get,list,watch \\
  --resource=pods

# RoleBinding (namespace-scoped) using the ClusterRole
kubectl create rolebinding pod-lister-ns-a \\
  --clusterrole=pod-lister \\
  --serviceaccount=ns-a:scoped-sa \\
  -n ns-a    # scoped to ns-a only!
\`\`\``,
        verify: `\`\`\`bash
# Can list pods in ns-a?
kubectl auth can-i list pods \\
  --as=system:serviceaccount:ns-a:scoped-sa \\
  -n ns-a
# Expected: yes

# Can list pods in kube-system? (NO — RoleBinding restricts to ns-a)
kubectl auth can-i list pods \\
  --as=system:serviceaccount:ns-a:scoped-sa \\
  -n kube-system
# Expected: no

# Can list pods cluster-wide? (NO)
kubectl auth can-i list pods \\
  --as=system:serviceaccount:ns-a:scoped-sa
# Expected: no

echo "Key lesson: RoleBinding restricts ClusterRole to one namespace!"

# Cleanup
kubectl delete namespace ns-a
kubectl delete clusterrole pod-lister
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Application getting "forbidden" errors — RBAC debugging',
      difficulty: 'easy',
      symptom: 'Application pod logs show: "configmaps is forbidden: User \"system:serviceaccount:production:app-sa\" cannot list resource \"configmaps\" in API group \"\" in the namespace \"production\""',
      diagnosis: `\`\`\`bash
# Confirm the SA exists
kubectl get serviceaccount app-sa -n production

# Check current permissions
kubectl auth can-i list configmaps \\
  --as=system:serviceaccount:production:app-sa \\
  -n production
# Expected: no

# See all bindings for this SA
kubectl get rolebindings -n production -o json | \\
  python3 -c "import json,sys; [print(b['metadata']['name']) for b in json.load(sys.stdin)['items'] for s in b.get('subjects',[]) if s.get('name')=='app-sa']"
\`\`\``,
      solution: `Create a Role with the required permissions and bind it:
\`\`\`bash
# Option 1: kubectl commands (quick)
kubectl create role app-configmap-reader \\
  --verb=get,list,watch \\
  --resource=configmaps \\
  -n production

kubectl create rolebinding app-configmap-binding \\
  --role=app-configmap-reader \\
  --serviceaccount=production:app-sa \\
  -n production

# Verify fix
kubectl auth can-i list configmaps \\
  --as=system:serviceaccount:production:app-sa \\
  -n production
# Expected: yes
\`\`\``
    },
    {
      title: 'Identifying and removing excessive ClusterRoleBinding',
      difficulty: 'medium',
      symptom: 'Security audit finds: a developer\'s ServiceAccount has cluster-admin ClusterRoleBinding created during debugging. This must be removed and replaced with least-privilege access.',
      diagnosis: `\`\`\`bash
# Find the problematic binding
kubectl get clusterrolebindings | grep -i dev
kubectl describe clusterrolebinding <name>

# Understand what the SA actually needs
kubectl logs deployment/<app> -n <ns> | grep "forbidden\|Unauthorized"

# Check what the SA can currently do (too much!)
kubectl auth can-i --list \\
  --as=system:serviceaccount:<ns>:<sa>
\`\`\``,
      solution: `1. **Identify minimum required permissions** from application logs and code review.

2. **Create a minimal Role/ClusterRole**:
\`\`\`bash
kubectl create role app-minimal \\
  --verb=get,list \\
  --resource=pods,configmaps \\
  -n <namespace>
\`\`\`

3. **Remove the cluster-admin binding**:
\`\`\`bash
kubectl delete clusterrolebinding <excessive-binding-name>
\`\`\`

4. **Create the minimal binding**:
\`\`\`bash
kubectl create rolebinding app-minimal-binding \\
  --role=app-minimal \\
  --serviceaccount=<namespace>:<sa-name> \\
  -n <namespace>
\`\`\`

5. **Test the application** still works with minimal permissions.

6. **Document the incident** and add controls to prevent future cluster-admin bindings for app SAs (use OPA Gatekeeper or Kyverno policy).`
    }
  ]
};
