window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['workloads/scheduling'] = {
  theory: `
# Pod Scheduling

## Exam Relevance
> Scheduling is 15% of the CKA exam. Expect tasks with taints/tolerations, node selectors, node affinity, and manually scheduling pods. Understanding why pods are not scheduling is also tested.

## How the Kubernetes Scheduler Works

The kube-scheduler assigns pods to nodes through two phases:
1. **Filtering**: eliminates nodes that don't meet requirements (resources, taints, selectors)
2. **Scoring**: ranks remaining nodes by priority (least loaded, preferred affinity)

The pod is assigned to the highest-scoring node.

## Node Selectors (Simplest)

\`\`\`yaml
# Label a node
kubectl label node worker-1 disktype=ssd

# Use in pod spec
spec:
  nodeSelector:
    disktype: ssd    # pod only schedules on nodes with this label
\`\`\`

Limitation: only equality matching (no "preferred" or "not in" logic).

## Node Affinity (Advanced)

Node affinity supports richer expressions with operators: \`In\`, \`NotIn\`, \`Exists\`, \`DoesNotExist\`, \`Gt\`, \`Lt\`.

### requiredDuringSchedulingIgnoredDuringExecution (hard requirement)

\`\`\`yaml
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: kubernetes.io/e2e-az-name
            operator: In
            values:
            - az1
            - az2
\`\`\`

### preferredDuringSchedulingIgnoredDuringExecution (soft preference)

\`\`\`yaml
spec:
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100             # higher weight = stronger preference
        preference:
          matchExpressions:
          - key: disktype
            operator: In
            values:
            - ssd
\`\`\`

### IgnoredDuringExecution

Current rules ignore the affinity if a node's labels change after the pod is already running. A future "RequiredDuringExecution" variant would evict running pods.

## Taints and Tolerations

**Taints** are applied to **nodes** to repel pods.
**Tolerations** are added to **pods** to allow scheduling on tainted nodes.

### Taint Effects

| Effect | Behavior |
|--------|---------|
| **NoSchedule** | New pods without toleration are NOT scheduled |
| **PreferNoSchedule** | Scheduler tries to avoid, but not guaranteed |
| **NoExecute** | New pods blocked; existing pods WITHOUT toleration are evicted |

### Taint a Node

\`\`\`bash
# Add taint
kubectl taint node worker-1 key=value:NoSchedule
kubectl taint node worker-1 dedicated=gpu:NoSchedule

# Remove taint (append -)
kubectl taint node worker-1 dedicated:NoSchedule-
kubectl taint node worker-1 dedicated=gpu:NoSchedule-

# View taints
kubectl describe node worker-1 | grep Taints
\`\`\`

### Toleration in Pod Spec

\`\`\`yaml
spec:
  tolerations:
  - key: "dedicated"
    operator: "Equal"
    value: "gpu"
    effect: "NoSchedule"

  # Tolerate ANY taint with key "dedicated" (no value check)
  - key: "dedicated"
    operator: "Exists"
    effect: "NoSchedule"

  # Tolerate ALL taints (schedule on ANY node)
  - operator: "Exists"
\`\`\`

### Master Node Taint

Control plane nodes have a default taint:
\`\`\`
node-role.kubernetes.io/control-plane:NoSchedule
\`\`\`
That's why regular pods don't schedule on control plane nodes.

## Pod Affinity and Anti-Affinity

Schedule pods **near** or **away from** other pods.

\`\`\`yaml
spec:
  affinity:
    # AFFINITY: schedule near pods with matching labels
    podAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: cache
        topologyKey: "kubernetes.io/hostname"  # same node

    # ANTI-AFFINITY: spread pods across nodes
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: frontend
          topologyKey: "kubernetes.io/hostname"  # different nodes
\`\`\`

**topologyKey** defines the unit of spreading:
- \`kubernetes.io/hostname\` → spread across nodes
- \`topology.kubernetes.io/zone\` → spread across AZs

## Manual Pod Scheduling (no scheduler)

\`\`\`yaml
# Specify node directly — bypasses the scheduler
spec:
  nodeName: worker-1    # pod goes directly to this node
\`\`\`

Use case: when kube-scheduler is down, or for testing.

## Static Pods

Static pods are managed directly by kubelet (not the API server):
- Manifests at: \`/etc/kubernetes/manifests/\`
- Kubelet automatically creates/restarts them
- Read-only from the API server (cannot delete/edit via kubectl)
- Naming: pod name = \`<manifest-name>-<node-name>\`

\`\`\`bash
# To create a static pod:
cp mypod.yaml /etc/kubernetes/manifests/

# To delete:
rm /etc/kubernetes/manifests/mypod.yaml

# Find static pod manifest dir from kubelet config
cat /var/lib/kubelet/config.yaml | grep staticPodPath
\`\`\`

## Essential Commands

\`\`\`bash
# Label a node
kubectl label node <node> <key>=<value>

# Remove node label
kubectl label node <node> <key>-

# Add taint
kubectl taint node <node> <key>=<value>:<effect>

# Remove taint
kubectl taint node <node> <key>=<value>:<effect>-

# Check why pod is not scheduling
kubectl describe pod <pod> | tail -20
# Look for "Events:" section — "FailedScheduling"

# Check node capacity and allocations
kubectl describe node <node> | grep -A10 "Allocated resources"
\`\`\`

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| \`0/3 nodes are available: 3 node(s) had untolerated taint\` | Pod needs toleration | Add matching toleration to pod |
| \`0/3 nodes are available: 3 node(s) didn't match nodeSelector\` | No node has the label | Label a node or remove nodeSelector |
| Pod on wrong node | nodeName doesn't exist or wrong | Verify node name |
| Pod Pending with no events | Scheduler stopped | Check kube-scheduler pod in kube-system |

## Killer.sh Style Challenge

> **Task**: A DaemonSet for log collection must NOT run on nodes labeled \`purpose=control-plane\`. Add a taint \`log-exempt=true:NoSchedule\` to those nodes and add the corresponding toleration—wait, the goal is the opposite: ensure the daemonset does NOT run there. Use a node label and nodeSelector or affinity to restrict it.

\`\`\`bash
# Add taint to node you want to avoid
kubectl taint node controlplane-node purpose=control-plane:NoSchedule

# DaemonSet without toleration won't schedule there
# Alternatively use nodeSelector:
#   nodeSelector:
#     purpose: worker   # only schedule on worker nodes
\`\`\`
`,
  quiz: [
    {
      question: 'A pod has `nodeSelector: disktype: ssd`. There are 3 worker nodes, but none has the label `disktype=ssd`. What is the pod status?',
      options: [
        'Running — the scheduler picks the best available node',
        'Pending — no node matches the nodeSelector',
        'Failed — invalid nodeSelector causes immediate failure',
        'Pending, then schedules after 5 minutes without the label'
      ],
      correct: 1,
      explanation: 'nodeSelector is a hard requirement. If no node has the specified label, the pod remains Pending indefinitely. The scheduler emits a "FailedScheduling" event with the reason.',
      reference: 'Debug with: kubectl describe pod <pod> | grep Events -A5 — shows "0/N nodes matched nodeSelector".'
    },
    {
      question: 'What is the difference between taint effects `NoSchedule` and `NoExecute`?',
      options: [
        'NoSchedule prevents new pods; NoExecute also evicts existing pods without toleration',
        'NoExecute prevents new pods; NoSchedule also evicts existing pods',
        'NoSchedule applies to all pods; NoExecute only to system pods',
        'They are identical — different names for the same behavior'
      ],
      correct: 0,
      explanation: 'NoSchedule blocks NEW pods from scheduling. NoExecute both blocks new pods AND evicts already-running pods that lack a matching toleration. PreferNoSchedule is the soft version of NoSchedule.',
      reference: 'NoExecute is used for node draining and node condition taints (e.g., node.kubernetes.io/not-ready).'
    },
    {
      question: 'Which affinity type allows a pod to express "I prefer to be on an SSD node, but will run anywhere if no SSD node is available"?',
      options: [
        'requiredDuringSchedulingIgnoredDuringExecution with operator Exists',
        'preferredDuringSchedulingIgnoredDuringExecution with a weight',
        'nodeSelector with disktype=ssd',
        'podAffinity with topologyKey hostname'
      ],
      correct: 1,
      explanation: '`preferredDuringSchedulingIgnoredDuringExecution` is the soft affinity — the scheduler tries to honor it but will place the pod elsewhere if no matching node is available. Required is the hard version.',
      reference: 'preferred = soft (best-effort). required = hard (must match). IgnoredDuringExecution = no eviction if labels change after scheduling.'
    },
    {
      question: 'How do you specify that a pod must be placed on a specific node, bypassing the scheduler?',
      options: [
        'nodeSelector with the node hostname',
        'spec.nodeName with the exact node name',
        'nodeAffinity with required hostname match',
        'kubectl schedule pod --node=worker-1'
      ],
      correct: 1,
      explanation: '`spec.nodeName` directly specifies the node, completely bypassing the kube-scheduler. The pod is placed on that node without any scheduling decisions. Unlike nodeSelector, it uses the exact node name.',
      reference: 'nodeName = bypass scheduler. nodeSelector = filtered scheduling. Use nodeName only for testing or when scheduler is down.'
    },
    {
      question: 'A toleration has `operator: "Exists"` with no key. What does it match?',
      options: [
        'Only taints where the value is "Exists"',
        'Any taint — the pod can be scheduled on any tainted node',
        'Only taints with no value',
        'Nothing — operator Exists without key is invalid'
      ],
      correct: 1,
      explanation: 'A toleration with `operator: Exists` and no `key` tolerates ALL taints on any node. This effectively allows the pod to be scheduled anywhere, including on nodes with any taint.',
      reference: 'Used in DaemonSets to run on all nodes: tolerations: [{operator: "Exists"}]'
    },
    {
      question: 'What is `topologyKey` used for in pod affinity and anti-affinity?',
      options: [
        'It specifies which label key to use for matching pods',
        'It defines the unit of topology for spreading (e.g., same node, same zone)',
        'It sets the priority of the affinity rule',
        'It specifies which namespace to consider for pod affinity'
      ],
      correct: 1,
      explanation: '`topologyKey` defines the boundary for the affinity rule. `kubernetes.io/hostname` = same physical node. `topology.kubernetes.io/zone` = same availability zone. The scheduler looks at the value of this label on nodes.',
      reference: 'Anti-affinity with topologyKey=hostname = spread pods one per node (good for HA).'
    },
    {
      question: 'How do you view the taints on all nodes?',
      options: [
        'kubectl get nodes -o yaml | grep taints',
        'kubectl describe nodes | grep Taints',
        'kubectl get taints --all-nodes',
        'Both A and B work'
      ],
      correct: 3,
      explanation: 'Both `kubectl get nodes -o yaml` (in YAML spec) and `kubectl describe nodes` (in the Taints section) show node taints. Use whichever is faster for the exam.',
      reference: 'Quick check: kubectl describe node <name> | grep Taints'
    },
    {
      question: 'What happens to a running pod on a node when you add a `NoExecute` taint to that node?',
      options: [
        'Nothing — NoExecute only affects new pods',
        'The pod is evicted immediately if it has no matching toleration',
        'The pod is evicted after a 5-minute grace period',
        'The pod continues running until it finishes its current request'
      ],
      correct: 1,
      explanation: 'NoExecute taints evict running pods that lack a matching toleration. You can add `tolerationSeconds` to the toleration to delay eviction by a specified number of seconds.',
      reference: 'Node draining uses NoExecute internally: kubectl drain adds NoExecute taint to trigger evictions.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4 scheduling mechanisms in order of complexity?',
      back: '1. **nodeName**: direct assignment (bypasses scheduler)\n2. **nodeSelector**: simple label equality matching\n3. **nodeAffinity**: rich label matching with operators\n4. **Taints & Tolerations**: node-level repulsion with pod opt-in\n\nAlso: **podAffinity/AntiAffinity** for pod-to-pod topology'
    },
    {
      front: 'What are the 3 taint effects and their behaviors?',
      back: '| Effect | New pods | Running pods |\n|--------|----------|--------------|\n| **NoSchedule** | Blocked | Not affected |\n| **PreferNoSchedule** | Avoided (soft) | Not affected |\n| **NoExecute** | Blocked | **Evicted** (if no toleration) |\n\nAdd taint: `kubectl taint node <node> key=value:Effect`\nRemove taint: `kubectl taint node <node> key=value:Effect-`'
    },
    {
      front: 'What is the difference between required and preferred node affinity?',
      back: '**required** (`requiredDuringSchedulingIgnoredDuringExecution`):\n- Hard requirement — pod will NOT schedule if no node matches\n- Equivalent to a strict nodeSelector with richer operators\n\n**preferred** (`preferredDuringSchedulingIgnoredDuringExecution`):\n- Soft preference with a weight (1-100)\n- Scheduler tries to honor it but will use other nodes if needed\n- Multiple preferences are combined by weight'
    },
    {
      front: 'How do you tolerate ALL taints on a node?',
      back: '```yaml\nspec:\n  tolerations:\n  - operator: "Exists"   # no key, no value = match all taints\n```\n\nThis is used in:\n- DaemonSets (to run on all nodes including control plane)\n- Critical system pods\n\nAlternatively, for specific effects:\n```yaml\n- operator: "Exists"\n  effect: "NoSchedule"  # tolerate all NoSchedule taints\n```'
    },
    {
      front: 'What is a static pod and where are its manifests?',
      back: '**Static pods** are managed directly by the **kubelet** (not the API server).\n\nManifest directory (kubeadm default):\n```bash\n/etc/kubernetes/manifests/\n```\n\nCharacteristics:\n- Cannot be deleted via kubectl (delete the manifest file)\n- kubelet auto-restarts them\n- Naming: `<pod-name>-<node-name>`\n- Control plane components (etcd, api-server, scheduler, controller-manager) are static pods'
    },
    {
      front: 'How do you use pod anti-affinity to spread pods across nodes (HA)?',
      back: '```yaml\nspec:\n  affinity:\n    podAntiAffinity:\n      preferredDuringSchedulingIgnoredDuringExecution:\n      - weight: 100\n        podAffinityTerm:\n          labelSelector:\n            matchLabels:\n              app: myapp   # avoid nodes where this pod already runs\n          topologyKey: "kubernetes.io/hostname"\n```\n\nUse `required` instead of `preferred` for strict one-per-node enforcement.'
    },
    {
      front: 'A pod is stuck in Pending. How do you find the scheduling reason?',
      back: '```bash\n# Method 1: describe pod events\nkubectl describe pod <pod> -n <ns> | tail -20\n# Look for: "Warning  FailedScheduling" event\n# Reason: "0/3 nodes available: 3 node(s) had untolerated taint"\n\n# Method 2: events for the namespace\nkubectl get events -n <ns> --sort-by=.lastTimestamp | grep FailedScheduling\n\n# Common messages:\n# "Insufficient cpu/memory" → resource constraint\n# "node(s) had untolerated taint" → missing toleration\n# "node(s) didn\'t match nodeSelector" → label missing\n# "didn\'t match Pod\'s node affinity" → affinity mismatch\n```'
    },
    {
      front: 'How do you schedule a pod on the control plane node?',
      back: 'The control plane has a taint:\n```\nnode-role.kubernetes.io/control-plane:NoSchedule\n```\n\nAdd a toleration to your pod:\n```yaml\nspec:\n  tolerations:\n  - key: "node-role.kubernetes.io/control-plane"\n    operator: "Exists"\n    effect: "NoSchedule"\n  # Also add nodeSelector/nodeName if needed:\n  nodeName: controlplane\n```\n\nOr for testing only: `kubectl taint node controlplane node-role.kubernetes.io/control-plane:NoSchedule-`'
    }
  ],
  lab: {
    scenario: 'Configure node scheduling constraints to ensure different workloads land on appropriate nodes using node selectors, taints/tolerations, and affinity rules.',
    objective: 'Apply and verify nodeSelector, taints, tolerations, and node affinity for targeted pod placement.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Node Selector and Taint/Toleration',
        instruction: `1. Label node \`worker-1\` with \`disktype=ssd\`
2. Create a pod **ssd-pod** that only schedules on SSD nodes
3. Add taint \`dedicated=gpu:NoSchedule\` to \`worker-2\`
4. Create a pod **gpu-pod** with the correct toleration to schedule on \`worker-2\`
5. Verify each pod landed on the expected node`,
        hints: [
          'If you only have one node (kind/minikube), use that node for both operations',
          'nodeSelector requires exact label match',
          'Toleration key+value+effect must match the taint exactly',
          'Use kubectl get pods -o wide to see which node each pod is on'
        ],
        solution: `\`\`\`bash
# Label worker-1 (use your actual node names)
NODE1=$(kubectl get nodes -o name | head -1 | cut -d/ -f2)
kubectl label node $NODE1 disktype=ssd

# Create SSD-targeted pod
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: ssd-pod
spec:
  nodeSelector:
    disktype: ssd
  containers:
  - name: app
    image: nginx
EOF

# Taint worker-2 (or same node for single-node clusters)
kubectl taint node $NODE1 dedicated=gpu:NoSchedule

# Create pod with toleration
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: gpu-pod
spec:
  tolerations:
  - key: "dedicated"
    operator: "Equal"
    value: "gpu"
    effect: "NoSchedule"
  containers:
  - name: app
    image: nginx
EOF

kubectl get pods -o wide
\`\`\``,
        verify: `\`\`\`bash
# ssd-pod should be Running on the labeled node
kubectl get pod ssd-pod -o wide
# Expected: Running, NODE should be the one with disktype=ssd

# gpu-pod should be Running (has toleration for the taint)
kubectl get pod gpu-pod -o wide
# Expected: Running

# A regular pod (no toleration) should be Pending
kubectl run no-toleration --image=nginx
kubectl describe pod no-toleration | tail -10
# Expected: FailedScheduling — untolerated taint

# Cleanup the taint for subsequent steps
kubectl taint node $NODE1 dedicated:NoSchedule-
kubectl delete pod no-toleration
\`\`\``
      },
      {
        title: 'Node Affinity — Hard and Soft Requirements',
        instruction: `1. Label a node with \`zone=us-east-1a\` and \`tier=premium\`
2. Create a pod **required-pod** with a **hard node affinity** requiring nodes in zone \`us-east-1a\`
3. Create a pod **preferred-pod** with a **soft node affinity** preferring \`tier=premium\` nodes but allowing any node
4. Verify both pods schedule correctly`,
        hints: [
          'requiredDuringSchedulingIgnoredDuringExecution = hard requirement',
          'preferredDuringSchedulingIgnoredDuringExecution = soft preference',
          'Use operator: In with values list for the zone check',
          'preferred needs a weight between 1 and 100'
        ],
        solution: `\`\`\`bash
NODE=$(kubectl get nodes -o name | head -1 | cut -d/ -f2)
kubectl label node $NODE zone=us-east-1a tier=premium

# Hard affinity pod
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: required-pod
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: zone
            operator: In
            values: [us-east-1a]
  containers:
  - name: app
    image: nginx
EOF

# Soft affinity pod
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: preferred-pod
spec:
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        preference:
          matchExpressions:
          - key: tier
            operator: In
            values: [premium]
  containers:
  - name: app
    image: nginx
EOF

kubectl get pods -o wide
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods required-pod preferred-pod -o wide
# Expected: both Running on the labeled node

kubectl describe pod required-pod | grep "Node-Selectors\|Affinity" -A5
# Expected: affinity rules shown

# Test: what happens with an impossible required affinity
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: impossible-pod
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: zone
            operator: In
            values: [us-west-99]  # doesn't exist
  containers:
  - name: app
    image: nginx
EOF

kubectl describe pod impossible-pod | tail -5
# Expected: FailedScheduling — node affinity
kubectl delete pod impossible-pod
\`\`\``
      },
      {
        title: 'Static Pod Creation',
        instruction: `Create a **static pod** named \`static-nginx\` by placing a pod manifest in the kubelet's static pod directory.

1. Find the static pod directory from the kubelet config
2. Create the manifest file in that directory
3. Verify the static pod appears in \`kubectl get pods\`
4. Attempt to delete it with kubectl — observe that it re-creates
5. Remove it by deleting the manifest file`,
        hints: [
          'Find staticPodPath: cat /var/lib/kubelet/config.yaml | grep staticPodPath',
          'Default path: /etc/kubernetes/manifests/',
          'Static pods appear with node name suffix: static-nginx-<nodename>',
          'Cannot be deleted via kubectl — must delete the manifest file'
        ],
        solution: `\`\`\`bash
# Find static pod path
STATIC_PATH=$(grep staticPodPath /var/lib/kubelet/config.yaml | awk '{print $2}')
echo "Static pod path: $STATIC_PATH"
# Usually: /etc/kubernetes/manifests

# Create static pod manifest
cat <<EOF > $STATIC_PATH/static-nginx.yaml
apiVersion: v1
kind: Pod
metadata:
  name: static-nginx
spec:
  containers:
  - name: nginx
    image: nginx
    ports:
    - containerPort: 80
EOF

# Wait for kubelet to pick it up (~10 seconds)
sleep 10
kubectl get pods -A | grep static-nginx

# Try to delete (it re-creates)
kubectl delete pod -A -l component=static-nginx 2>/dev/null || true

# Wait and check — it comes back
sleep 5
kubectl get pods -A | grep static-nginx

# Properly remove: delete the file
rm $STATIC_PATH/static-nginx.yaml
sleep 5
kubectl get pods -A | grep static-nginx
# Expected: no longer present
\`\`\``,
        verify: `\`\`\`bash
# After creating the manifest:
kubectl get pods -A | grep static-nginx
# Expected: pod running (name has node suffix like static-nginx-controlplane)

# Verify it is a mirror pod (read-only)
kubectl get pod -A -o wide | grep static-nginx
# Expected: Running

# After deleting the manifest:
kubectl get pods -A | grep static-nginx
# Expected: empty (pod is gone)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pod Pending — Missing Toleration for Control Plane Taint',
      difficulty: 'easy',
      symptom: 'In a single-node cluster (control plane only), pods are stuck in Pending. All pods show `0/1 nodes are available: 1 node(s) had untolerated taint`.',
      diagnosis: `\`\`\`bash
kubectl describe pod <pod-name> | grep "Events:" -A5
# Warning  FailedScheduling: 0/1 nodes are available:
# 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }

# Verify the control plane taint
kubectl describe node <node-name> | grep Taints
# Taints: node-role.kubernetes.io/control-plane:NoSchedule
\`\`\``,
      solution: `The control plane node has a NoSchedule taint to prevent workloads from running on it. In a single-node cluster or test environment, you need to either remove the taint or add a toleration.

\`\`\`bash
# Option 1: Remove the taint (allow workloads on control plane)
kubectl taint node <node-name> node-role.kubernetes.io/control-plane:NoSchedule-

# Option 2: Add toleration to the pod
# In pod spec:
# tolerations:
# - key: "node-role.kubernetes.io/control-plane"
#   operator: "Exists"
#   effect: "NoSchedule"

# Verify
kubectl get nodes
kubectl get pods
# Expected: pods now scheduling on the control plane node
\`\`\`

**Production recommendation**: Keep the taint on production control plane nodes. Only remove it in development/test single-node clusters.`
    },
    {
      title: 'Pods Uneven Distribution — No Anti-Affinity',
      difficulty: 'medium',
      symptom: 'A Deployment with 6 replicas has all pods scheduling on one node, leaving two nodes idle. The application is not highly available.',
      diagnosis: `\`\`\`bash
# Check pod distribution
kubectl get pods -o wide -l app=<label>
# All pods on same node!

# Check if nodes have equal capacity
kubectl describe nodes | grep -A5 "Allocated resources"

# Check if there is an existing pod affinity
kubectl get deployment <name> -o yaml | grep -A10 affinity
# No anti-affinity configured
\`\`\``,
      solution: `Add pod anti-affinity to spread pods across nodes.

\`\`\`bash
kubectl edit deployment <name>
# Add under spec.template.spec:

# spec:
#   affinity:
#     podAntiAffinity:
#       preferredDuringSchedulingIgnoredDuringExecution:
#       - weight: 100
#         podAffinityTerm:
#           labelSelector:
#             matchLabels:
#               app: <label>     # same as deployment selector
#           topologyKey: "kubernetes.io/hostname"

# OR use requiredDuringScheduling for strict one-per-node:
#   podAntiAffinity:
#     requiredDuringSchedulingIgnoredDuringExecution:
#     - labelSelector:
#         matchLabels:
#           app: <label>
#       topologyKey: "kubernetes.io/hostname"

# Trigger rolling restart
kubectl rollout restart deployment/<name>

# Verify distribution
kubectl get pods -o wide -l app=<label>
\`\`\`

**Note**: \`required\` anti-affinity with more replicas than nodes will cause pods to be Pending. Use \`preferred\` for resilient scheduling.`
    }
  ]
};
