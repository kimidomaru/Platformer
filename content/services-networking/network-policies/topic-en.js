window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['services-networking/network-policies'] = {
  theory: `
# Network Policies

## Exam Relevance
> Network Policies appear in CKA (Services & Networking — 20%) and CKS. Expect tasks creating policies to isolate namespaces, restrict pod-to-pod communication, and allow specific traffic flows.

## Core Concepts

By default, Kubernetes has **no network restrictions** — all pods can communicate with all other pods across namespaces.

**NetworkPolicy** is a namespaced resource that defines rules for **ingress** (incoming) and **egress** (outgoing) traffic to/from pods.

> **Important**: NetworkPolicy requires a **CNI plugin that supports it** (Calico, Cilium, Weave Net). kube-proxy and the basic CNI plugin do NOT enforce policies. **Flannel does NOT support NetworkPolicy**.

### Default Behavior

\`\`\`
No NetworkPolicy → All traffic allowed (open cluster)
One NetworkPolicy selects a pod → Only matched traffic allowed; all else DENIED
\`\`\`

NetworkPolicies are **additive** — multiple policies for the same pod are ORed together.

### Key Components

\`\`\`yaml
spec:
  podSelector:        # which pods this policy applies to
  policyTypes:        # [Ingress, Egress, or both]
  ingress:            # rules for incoming traffic
  egress:             # rules for outgoing traffic
\`\`\`

### Selectors in Rules

| Selector | Purpose |
|----------|---------|
| \`podSelector\` | Select pods (within the same namespace by default) |
| \`namespaceSelector\` | Select pods from specific namespaces |
| \`ipBlock\` | Select traffic from IP CIDR ranges |

## Policy Patterns

### 1. Default Deny All Ingress

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}        # {} = applies to ALL pods in namespace
  policyTypes:
  - Ingress              # no ingress rules = deny all ingress
\`\`\`

### 2. Default Deny All (Ingress + Egress)

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
\`\`\`

### 3. Allow Specific Pod-to-Pod Traffic

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend          # policy applies TO backend pods
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend     # only allow FROM frontend pods
    ports:
    - protocol: TCP
      port: 8080
\`\`\`

### 4. Allow Traffic from Specific Namespace

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-monitoring
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          purpose: monitoring    # namespace must have this label
\`\`\`

### 5. Allow from Namespace AND specific pods (AND logic)

\`\`\`yaml
# Single from entry with BOTH selectors = AND (must match both)
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        env: prod
    podSelector:           # NOTE: same "-" entry as namespaceSelector
      matchLabels:
        role: api
\`\`\`

### 6. Allow from Namespace OR specific pods (OR logic)

\`\`\`yaml
# Separate from entries = OR (match either)
ingress:
- from:
  - namespaceSelector:    # entry 1
      matchLabels:
        env: prod
  - podSelector:          # entry 2 (separate "-")
      matchLabels:
        role: api
\`\`\`

> **Critical exam distinction**: Same \`from\` entry (AND) vs separate \`from\` entries (OR)

### 7. Egress Policy

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-egress-to-db
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432
  - to:                    # also allow DNS (important!)
    - namespaceSelector: {}  # all namespaces
    ports:
    - protocol: UDP
      port: 53
\`\`\`

### 8. Allow All Ingress (explicit allow-all)

\`\`\`yaml
ingress:
- {}    # empty rule = allow all ingress
\`\`\`

## Namespace Labels

\`\`\`bash
# Label a namespace for policy selectors
kubectl label namespace monitoring purpose=monitoring
kubectl label namespace production env=prod

# View namespace labels
kubectl get namespaces --show-labels
\`\`\`

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Policy has no effect | CNI doesn't support NetworkPolicy (Flannel) | Switch to Calico/Cilium |
| DNS stops working after egress deny-all | DNS (UDP:53 to kube-dns) blocked | Add egress rule for UDP:53 to kube-system |
| Cross-namespace traffic blocked | namespaceSelector not configured | Add namespaceSelector with namespace labels |
| AND/OR confusion | Wrong from/to structure | Separate entries = OR, same entry = AND |
| All traffic blocked unexpectedly | podSelector {} selects all pods | Check for unintended policy scope |

## Killer.sh Style Challenge

> **Task**: In namespace \`secure\`:
> 1. Deny all ingress to pods with label \`tier=db\`
> 2. Allow only pods with label \`tier=backend\` to reach \`tier=db\` on port 5432
> 3. Allow only pods from namespace \`monitoring\` (labeled \`purpose=monitoring\`) to reach \`tier=db\` on port 9187 (metrics)

\`\`\`bash
# Both rules apply to tier=db pods
# Use two separate NetworkPolicies or combine in one
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-access
  namespace: secure
spec:
  podSelector:
    matchLabels:
      tier: db
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: backend
    ports:
    - port: 5432
  - from:
    - namespaceSelector:
        matchLabels:
          purpose: monitoring
    ports:
    - port: 9187
EOF
\`\`\`
`,
  quiz: [
    {
      question: 'A NetworkPolicy with `podSelector: {}` and `policyTypes: [Ingress]` but no `ingress` rules is applied to namespace `production`. What happens to all pods in that namespace?',
      options: [
        'Nothing changes — empty ingress rules means allow all',
        'All ingress traffic to ALL pods in the namespace is denied',
        'Only pods without labels are affected',
        'The policy is invalid and ignored'
      ],
      correct: 1,
      explanation: '`podSelector: {}` selects ALL pods. `policyTypes: [Ingress]` with no `ingress` rules means deny all ingress. This is the standard "default deny ingress" pattern. Once any NetworkPolicy selects a pod, only explicitly allowed traffic passes.',
      reference: 'Pattern: podSelector: {} + policyTypes: [Ingress] + no ingress rules = deny all ingress to all pods.'
    },
    {
      question: 'What is the difference between two separate `from` entries vs one `from` entry with both `podSelector` and `namespaceSelector`?',
      options: [
        'No difference — both produce the same result',
        'Separate entries = OR logic; Same entry = AND logic (must satisfy both)',
        'Separate entries = AND logic; Same entry = OR logic',
        'Only one `from` entry is allowed per policy'
      ],
      correct: 1,
      explanation: 'This is a critical YAML structure distinction. Two separate entries in the `from` list are OR conditions. A single `from` entry with both selectors is AND (traffic must come from a pod that satisfies BOTH the namespace AND pod selector).',
      reference: 'Exam trap: from: [{namespaceSelector:...},{podSelector:...}] = OR; from: [{namespaceSelector:..., podSelector:...}] = AND'
    },
    {
      question: 'After applying a deny-all egress policy, DNS stops working for pods in the namespace. Why?',
      options: [
        'The policy blocks UDP traffic which DNS uses',
        'DNS queries use port 53 UDP and are blocked by the egress deny',
        'The CoreDNS service selector is affected by the policy',
        'Both A and B'
      ],
      correct: 3,
      explanation: 'DNS resolution uses UDP port 53. A deny-all egress policy blocks all outbound traffic including DNS queries to CoreDNS. Always add an explicit egress rule allowing UDP:53 to kube-dns when creating egress restrictions.',
      reference: 'Always allow DNS egress: to port 53 UDP, usually to kube-system namespace where CoreDNS runs.'
    },
    {
      question: 'You want to allow ingress to pod `tier=db` from pods in namespace `staging` (label `env=staging`) AND those pods must have label `role=app`. Which structure is correct?',
      options: [
        'Two separate from entries: one with namespaceSelector, one with podSelector',
        'One from entry with both namespaceSelector and podSelector at the same level',
        'A single matchExpressions combining both conditions',
        'podSelector can only use labels from the same namespace'
      ],
      correct: 1,
      explanation: 'For AND logic (must satisfy both namespace AND pod label), both selectors must be in the SAME `from` entry (not separate entries). Separate entries create OR conditions.',
      reference: 'AND = same from entry. OR = separate from entries. This is one of the most tested NetworkPolicy concepts.'
    },
    {
      question: 'You apply a NetworkPolicy in a cluster using Flannel CNI. No traffic restrictions appear. What is happening?',
      options: [
        'The policy syntax is wrong',
        'The pods need to be restarted to pick up the policy',
        'Flannel does not support NetworkPolicy enforcement',
        'NetworkPolicy only works with NodePort services'
      ],
      correct: 2,
      explanation: 'Flannel is a basic CNI plugin that provides pod networking but does NOT enforce NetworkPolicy. You need a CNI that supports NetworkPolicy: Calico, Cilium, Weave Net, or Antrea.',
      reference: 'For CKS/CKA: know which CNIs support NetworkPolicy. Calico is the most common in exam environments.'
    },
    {
      question: 'A NetworkPolicy selects pods with `app=frontend`. It has one ingress rule allowing traffic from `app=gateway`. What happens to traffic from `app=loadbalancer` pods?',
      options: [
        'Traffic is allowed because it is from within the same cluster',
        'Traffic is denied because the policy only allows `app=gateway`',
        'Traffic is allowed if on the correct port',
        'Traffic is allowed unless there is a separate deny policy'
      ],
      correct: 1,
      explanation: 'Once a pod is selected by a NetworkPolicy, only explicitly allowed traffic passes. Since `app=loadbalancer` is not listed in the ingress rules, all traffic from it is blocked.',
      reference: 'NetworkPolicy is additive — if a pod is selected, only allowed traffic passes. No "allow by default" for selected pods.'
    },
    {
      question: 'How do you label namespace `monitoring` so that a NetworkPolicy `namespaceSelector` can select it?',
      options: [
        'kubectl annotate namespace monitoring purpose=monitoring',
        'kubectl label namespace monitoring purpose=monitoring',
        'Add metadata.labels to the namespace in NetworkPolicy spec',
        'kubectl patch namespace monitoring --type=json -p \'[{"op":"add","path":"/spec/selector","value":{"purpose":"monitoring"}}]\''
      ],
      correct: 1,
      explanation: '`kubectl label namespace <name> key=value` adds a label to the namespace. NetworkPolicy `namespaceSelector.matchLabels` then matches namespaces with that label. You cannot define namespace labels within the NetworkPolicy itself.',
      reference: 'Always pre-label namespaces before creating NetworkPolicies that reference them.'
    },
    {
      question: 'Which NetworkPolicy allows ALL ingress traffic to selected pods (overrides a deny-all)?',
      options: [
        'A NetworkPolicy with no `ingress` field',
        'A NetworkPolicy with `ingress: [{}]` (empty rule)',
        'A NetworkPolicy with `policyTypes: []`',
        'Deleting the deny-all NetworkPolicy is the only way'
      ],
      correct: 1,
      explanation: 'An empty ingress rule `ingress: [{}]` means "allow ingress from anywhere on any port." Combined with a `policyTypes: [Ingress]`, this explicitly allows all ingress. You can also add it alongside a deny-all to selectively allow certain pods.',
      reference: 'ingress: [{}] = allow all ingress. ingress: [] (or no ingress field) with policyType Ingress = deny all.'
    }
  ],
  flashcards: [
    {
      front: 'What happens by default to pod traffic with NO NetworkPolicy in the cluster?',
      back: '**All traffic is allowed by default.**\n\nKubernetes has no network restrictions unless a NetworkPolicy is applied. Any pod can communicate with any other pod, any service, and any external IP.\n\nOnce a NetworkPolicy selects a pod, that pod enters "deny by default" mode — only explicitly allowed traffic passes.'
    },
    {
      front: 'How do you create a "default deny all ingress" policy for a namespace?',
      back: '```yaml\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: default-deny-ingress\n  namespace: production\nspec:\n  podSelector: {}     # selects ALL pods\n  policyTypes:\n  - Ingress           # no ingress rules = deny all\n```\n\nNote: `podSelector: {}` (empty) = selects ALL pods in the namespace.'
    },
    {
      front: 'What is the AND vs OR logic in NetworkPolicy from/to entries?',
      back: '**OR**: Separate entries in the from/to list\n```yaml\nfrom:\n- podSelector: {matchLabels: {a: b}}   # OR\n- namespaceSelector: {matchLabels: {x: y}}\n```\n\n**AND**: Both selectors in the SAME from entry\n```yaml\nfrom:\n- podSelector: {matchLabels: {a: b}}   # AND\n  namespaceSelector: {matchLabels: {x: y}}\n```\n\nThis is one of the most tested NetworkPolicy concepts!'
    },
    {
      front: 'Why do you need to allow UDP port 53 in egress NetworkPolicies?',
      back: 'DNS resolution uses **UDP port 53** to contact CoreDNS.\n\nIf you create a deny-all egress policy, DNS queries are blocked → pods cannot resolve service names → all service-to-service communication breaks.\n\nAlways add this egress rule:\n```yaml\negress:\n- to:\n  - namespaceSelector: {}  # or specific kube-system\n  ports:\n  - protocol: UDP\n    port: 53\n```'
    },
    {
      front: 'Which CNI plugins support NetworkPolicy enforcement?',
      back: '**Supports NetworkPolicy**: ✅\n- Calico\n- Cilium\n- Weave Net\n- Antrea\n\n**Does NOT support NetworkPolicy**: ❌\n- Flannel (basic networking only)\n- Kubenet\n\nIf NetworkPolicy has no effect → check CNI:\n```bash\nkubectl get pods -n kube-system | grep -E "calico|cilium|weave|flannel"\n```'
    },
    {
      front: 'How do you allow ingress to pods from a specific namespace only?',
      back: '1. Label the source namespace:\n```bash\nkubectl label namespace staging env=staging\n```\n\n2. Create the NetworkPolicy:\n```yaml\nspec:\n  podSelector:\n    matchLabels:\n      app: api\n  policyTypes: [Ingress]\n  ingress:\n  - from:\n    - namespaceSelector:\n        matchLabels:\n          env: staging  # namespace must have this label\n```\n\nWithout the namespace label, `namespaceSelector` cannot find it.'
    },
    {
      front: 'How do you write a NetworkPolicy that allows ALL ingress (allow-all)?',
      back: '```yaml\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-all-ingress\nspec:\n  podSelector: {}    # all pods\n  ingress:\n  - {}               # empty rule = allow all ingress\n  policyTypes:\n  - Ingress\n```\n\nCompare with deny-all: no `ingress` field = deny all; `ingress: [{}]` = allow all.'
    },
    {
      front: 'A pod has two NetworkPolicies selecting it. How are they combined?',
      back: '**NetworkPolicies are additive (OR combined)**.\n\nIf Policy A allows ingress from namespace A, and Policy B allows ingress from namespace B, then the pod allows ingress from BOTH namespaces.\n\nThere is no way to have a "deny" rule in a NetworkPolicy — only "allow" rules. To restrict traffic, remove the policy or narrow the selectors.\n\nAll policies selecting a pod are unioned together.'
    }
  ],
  lab: {
    scenario: 'You need to implement a defense-in-depth network segmentation strategy for a multi-tier application with frontend, backend, and database tiers.',
    objective: 'Create NetworkPolicies to isolate tiers, allow only required traffic flows, and verify policies work correctly.',
    duration: '30-35 minutes',
    steps: [
      {
        title: 'Default Deny and Allow Frontend Only',
        instruction: `In namespace **netpol-lab**, set up:
1. Deploy pods: **frontend** (label: \`app=frontend\`), **backend** (label: \`app=backend\`), **database** (label: \`app=database\`)
2. Apply a **default deny all ingress** policy to the namespace
3. Create a NetworkPolicy allowing ingress to **backend** only from **frontend** on port 8080
4. Verify frontend can reach backend but NOT database directly`,
        hints: [
          'Use \`kubectl create deployment\` to create each tier',
          'Default deny: podSelector: {} with policyTypes: [Ingress] and no ingress rules',
          'Then create specific allow policy for backend',
          'Test connectivity from frontend pod: kubectl exec frontend -- wget backend:8080'
        ],
        solution: `\`\`\`bash
kubectl create namespace netpol-lab

# Deploy tiers
kubectl create deployment frontend -n netpol-lab --image=nginx
kubectl create deployment backend -n netpol-lab --image=nginx
kubectl create deployment database -n netpol-lab --image=nginx

# Expose services
kubectl expose deployment backend -n netpol-lab --port=8080 --target-port=80
kubectl expose deployment database -n netpol-lab --port=5432 --target-port=80

# Default deny all ingress
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: netpol-lab
spec:
  podSelector: {}
  policyTypes: [Ingress]
EOF

# Allow frontend to backend
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-backend
  namespace: netpol-lab
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get networkpolicy -n netpol-lab
# Expected: 2 policies: default-deny and allow-frontend-backend

# Test from frontend pod (should succeed to backend)
FRONTEND=$(kubectl get pod -n netpol-lab -l app=frontend -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n netpol-lab $FRONTEND -- wget -qO- http://backend:8080 --timeout=3
# Expected: nginx response (allowed)

# Test from frontend to database (should fail)
kubectl exec -n netpol-lab $FRONTEND -- wget -qO- http://database:5432 --timeout=3
# Expected: timeout or connection refused (denied)
\`\`\``
      },
      {
        title: 'Cross-namespace Traffic — Allow Monitoring',
        instruction: `In namespace **netpol-lab**, allow pods in namespace **monitoring** (labeled \`purpose=monitoring\`) to reach the **database** pod on port 9187 (metrics endpoint).

1. Create namespace \`monitoring\` and label it
2. Deploy a \`prometheus\` pod in monitoring namespace
3. Create a NetworkPolicy on the database pod allowing this cross-namespace access`,
        hints: [
          'Label the monitoring namespace: kubectl label namespace monitoring purpose=monitoring',
          'Use namespaceSelector in the ingress from rule',
          'The database NetworkPolicy already exists (from step 1) — you need to add a new one or update it',
          'Test with: kubectl exec -n monitoring prometheus -- wget -qO- http://database.netpol-lab.svc.cluster.local:9187'
        ],
        solution: `\`\`\`bash
kubectl create namespace monitoring
kubectl label namespace monitoring purpose=monitoring

kubectl run prometheus -n monitoring --image=busybox --command -- sleep 3600

# Create policy to allow monitoring namespace to reach database metrics
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-monitoring-to-db
  namespace: netpol-lab
spec:
  podSelector:
    matchLabels:
      app: database
  policyTypes: [Ingress]
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          purpose: monitoring
    ports:
    - protocol: TCP
      port: 9187
EOF

kubectl get networkpolicy -n netpol-lab
\`\`\``,
        verify: `\`\`\`bash
kubectl get namespace monitoring --show-labels
# Expected: purpose=monitoring label present

kubectl get networkpolicy allow-monitoring-to-db -n netpol-lab -o yaml
# Expected: namespaceSelector with purpose=monitoring

kubectl get networkpolicy -n netpol-lab
# Expected: 3 policies total

# Verify label on namespace
kubectl get ns monitoring -o jsonpath='{.metadata.labels.purpose}'
# Expected: monitoring
\`\`\``
      },
      {
        title: 'Egress Policy — Restrict Outbound Traffic',
        instruction: `Apply an egress policy to **backend** pods in namespace **netpol-lab** that:
1. Allows egress ONLY to **database** pods on port 5432
2. Allows DNS queries (UDP port 53) to CoreDNS
3. Blocks all other outbound traffic

Verify the backend can reach the database but cannot reach the internet.`,
        hints: [
          'Use policyTypes: [Egress] in the spec',
          'DNS must be explicitly allowed in egress (to kube-system namespace or any namespace)',
          'The CoreDNS namespace is kube-system',
          'Test internet block: kubectl exec backend -- wget --timeout=3 google.com'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-egress
  namespace: netpol-lab
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes: [Egress]
  egress:
  # Allow to database pods
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432
  # Allow DNS
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
    ports:
    - protocol: UDP
      port: 53
EOF

kubectl get networkpolicy backend-egress -n netpol-lab
\`\`\``,
        verify: `\`\`\`bash
kubectl get networkpolicy backend-egress -n netpol-lab -o yaml | grep -A20 "egress:"
# Expected: 2 egress rules (database:5432 and DNS:53)

BACKEND=$(kubectl get pod -n netpol-lab -l app=backend -o jsonpath='{.items[0].metadata.name}')

# Test DB connectivity (should succeed - if within same ns pod selector)
kubectl exec -n netpol-lab $BACKEND -- wget --timeout=3 -qO- http://database
# Expected: nginx response OR connection timeout to 5432

# Test internet block
kubectl exec -n netpol-lab $BACKEND -- wget --timeout=3 -qO- http://8.8.8.8
# Expected: timeout (egress blocked to external IPs)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'NetworkPolicy has no effect — CNI not supporting it',
      difficulty: 'easy',
      symptom: 'NetworkPolicy is applied and shows up in `kubectl get networkpolicy`, but traffic that should be blocked continues to flow freely.',
      diagnosis: `\`\`\`bash
# Check which CNI is running
kubectl get pods -n kube-system | grep -E "flannel|calico|cilium|weave|antrea"

# If Flannel is running → it does NOT support NetworkPolicy
# Flannel provides overlay networking but no policy enforcement

# Verify the policy is in the right namespace
kubectl get networkpolicy -A

# Verify the podSelector matches the pods
kubectl get networkpolicy <name> -n <ns> -o yaml
kubectl get pods -n <ns> --show-labels
# Check: do pod labels match the policy podSelector?

# Try a simple connectivity test
kubectl exec -n <ns> <pod> -- wget --timeout=2 http://<target>
\`\`\``,
      solution: `**Root cause**: Flannel (or another non-NetworkPolicy-aware CNI) is installed.

**Fix options**:
\`\`\`bash
# Option 1: Replace CNI with Calico (requires cluster reinstall or CNI swap)
# This is a significant change — best done during cluster setup

# Option 2: Add Calico as a NetworkPolicy-only enforcement layer
# Install Calico for NetworkPolicy only (without replacing Flannel for routing)
kubectl apply -f https://projectcalico.docs.tigera.io/manifests/canal.yaml

# Option 3: If using kubeadm, reinstall cluster with Calico CNI
kubeadm reset
kubeadm init --pod-network-cidr=192.168.0.0/16
kubectl apply -f https://projectcalico.docs.tigera.io/manifests/calico.yaml
\`\`\`

For CKA exam: the exam environment uses a CNI that supports NetworkPolicy (Calico/Cilium). If policies don't work in the exam, verify the namespace and pod labels first.`
    },
    {
      title: 'DNS broken after applying egress policy',
      difficulty: 'medium',
      symptom: 'After applying an egress NetworkPolicy to a namespace, pods can no longer resolve service names. `nslookup` and `curl` with service names fail, but curl with direct pod IPs still works.',
      diagnosis: `\`\`\`bash
# Test DNS from an affected pod
kubectl exec -it <pod> -n <ns> -- nslookup kubernetes
# Expected if broken: timeout or "server can't find"

# Check if DNS server (CoreDNS) is reachable
kubectl exec -it <pod> -n <ns> -- wget --timeout=2 -qO- http://10.96.0.10:53
# 10.96.0.10 is usually kube-dns ClusterIP

# Check the egress policy
kubectl get networkpolicy -n <ns> -o yaml | grep -A20 "egress:"
# Look for: is there a rule allowing UDP:53?

# Get the kube-dns service IP
kubectl get svc kube-dns -n kube-system
\`\`\``,
      solution: `The egress policy blocks DNS traffic (UDP port 53 to CoreDNS).

\`\`\`bash
# Get kube-system namespace labels
kubectl get namespace kube-system --show-labels
# Check for: kubernetes.io/metadata.name=kube-system

# Update the NetworkPolicy to allow DNS
kubectl edit networkpolicy <policy-name> -n <ns>
# Add this egress rule:
# egress:
# - to:
#   - namespaceSelector:
#       matchLabels:
#         kubernetes.io/metadata.name: kube-system
#   ports:
#   - protocol: UDP
#     port: 53
#   - protocol: TCP
#     port: 53       # TCP fallback for large DNS responses

# OR allow DNS to any namespace (simpler but less restrictive):
# egress:
# - ports:
#   - protocol: UDP
#     port: 53

# Verify DNS works
kubectl exec -it <pod> -n <ns> -- nslookup kubernetes
# Expected: resolves to kubernetes service IP
\`\`\`

**Remember**: \`kubernetes.io/metadata.name\` is automatically added to all namespaces as of K8s 1.21+. Use it in namespaceSelectors for reliable namespace targeting.`
    }
  ]
};
