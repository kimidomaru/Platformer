window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcna-k8s-fundamentals/k8s-architecture'] = {
  theory: `# Kubernetes Architecture

## Exam Relevance
> Kubernetes architecture is a core KCNA topic (~46% of the exam is Kubernetes Fundamentals). You must understand the control plane components, node components, and how they interact. This is primarily conceptual — no hands-on configuration is required for KCNA.

## High-Level Architecture

\`\`\`
┌────────────────────────────────────┐
│          CONTROL PLANE             │
│  kube-apiserver  ←→  etcd          │
│  kube-scheduler                    │
│  kube-controller-manager           │
│  cloud-controller-manager          │
└──────────────┬─────────────────────┘
               │ (API calls)
┌──────────────▼─────────────────────┐
│           WORKER NODES             │
│  kubelet  →  container runtime     │
│  kube-proxy                        │
│  CNI plugin (pod networking)       │
└────────────────────────────────────┘
\`\`\`

## Control Plane Components

### kube-apiserver
- The **single entry point** to the cluster — all components talk through it
- Exposes the Kubernetes REST API
- Handles authentication, authorization (RBAC), and admission control
- Stateless — stores all state in etcd

### etcd
- **Distributed key-value store** — the cluster's source of truth
- Stores all cluster state: pods, services, secrets, configs, RBAC rules
- Uses Raft consensus algorithm for high availability
- Production clusters use at least 3 etcd nodes (odd number for quorum)

### kube-scheduler
- **Decides WHICH node a pod should run on**
- Considers: resource requests, node selectors, affinity rules, taints/tolerations, priority
- Does NOT actually start the pod — just marks which node it goes to
- Phase 1: Filtering (removes ineligible nodes)
- Phase 2: Scoring (ranks remaining nodes)

### kube-controller-manager
- Runs all the **built-in controllers** in a single process
- Each controller watches the API server and reconciles desired vs actual state
- Key controllers: ReplicationController, Deployment, Node, Service, Job, Namespace, ServiceAccount

### cloud-controller-manager
- Integrates Kubernetes with cloud provider APIs (AWS, GCP, Azure)
- Manages: cloud load balancers, cloud storage volumes, node lifecycle in cloud

## Worker Node Components

### kubelet
- **Runs on every node** — the node agent
- Receives pod specs from kube-apiserver (via PodSpec)
- Ensures containers are running as specified
- Reports node and pod status back to the API server
- Manages container lifecycle via the container runtime

### kube-proxy
- **Runs on every node** — implements Service networking
- Maintains network rules (iptables or IPVS) for Service-to-pod routing
- Routes traffic from Service ClusterIP to actual pod IPs
- NOT a proxy in the traditional sense — mostly just manages iptables rules

### Container Runtime
- The software that **actually runs containers**: containerd, CRI-O, Docker (via shim)
- Implements the Container Runtime Interface (CRI)
- Pulls images, creates containers, manages container lifecycle
- Kubernetes is runtime-agnostic via CRI

## The Reconciliation Loop

Kubernetes works through **declarative** desired state and continuous reconciliation:

\`\`\`
User declares desired state (e.g., 3 replicas)
         ↓
Kubernetes stores in etcd
         ↓
Controller watches for mismatch
         ↓
Controller takes action (create/delete pods)
         ↓
kubelet executes on the node
         ↓
State updated in etcd
         ↓
(Loop continues forever)
\`\`\`

## Control Plane HA

For production, the control plane should be highly available:
- Multiple API server instances (behind a load balancer)
- etcd cluster (3 or 5 nodes for quorum)
- kube-scheduler and controller-manager in leader-election mode (only one active at a time)

## kubectl and API Communication

\`\`\`bash
# kubectl communicates ONLY with kube-apiserver
# Config: ~/.kube/config (kubeconfig)

# Everything goes through the API server:
kubectl get pods
# → kubectl → kube-apiserver → etcd (reads pod list)

kubectl apply -f deployment.yaml
# → kubectl → kube-apiserver → etcd (writes desired state)
# → deployment-controller sees change → creates ReplicaSet
# → replicaset-controller → creates Pods
# → scheduler → assigns Pods to nodes
# → kubelet → starts containers
\`\`\`

## Add-ons

Additional components that extend Kubernetes:

| Add-on | Purpose |
|--------|---------|
| CoreDNS | DNS for service discovery |
| CNI plugins (Calico, Flannel, Cilium) | Pod network |
| Ingress Controller (nginx, traefik) | External HTTP routing |
| Metrics Server | Resource metrics for HPA/kubectl top |
| Dashboard | Web UI |

## Common Exam Questions

- Which component stores the cluster state? → **etcd**
- Which component decides where pods run? → **kube-scheduler**
- Which component runs on every node? → **kubelet** and **kube-proxy**
- Which component is the API entry point? → **kube-apiserver**
- What ensures a desired number of replicas? → **ReplicaSet controller** (in kube-controller-manager)
`,
  quiz: [
    {
      question: 'Which Kubernetes component is responsible for deciding on which node a new pod will run?',
      options: [
        'kube-controller-manager',
        'kubelet',
        'kube-scheduler',
        'kube-apiserver'
      ],
      correct: 2,
      explanation: 'The kube-scheduler watches for unscheduled pods and selects the best node based on resource availability, constraints, and policies. It writes the node assignment back to the API server, then kubelet on that node starts the pod.',
      reference: 'kube-scheduler section in theory.'
    },
    {
      question: 'Where does Kubernetes store all cluster state (pods, services, secrets, etc.)?',
      options: [
        'In a SQL database on the control plane node',
        'In etcd, a distributed key-value store',
        'In the kube-apiserver memory',
        'In files on each worker node'
      ],
      correct: 1,
      explanation: 'etcd is the only persistent storage in Kubernetes. All cluster state — object definitions, configurations, secrets, RBAC rules — is stored in etcd. The kube-apiserver is stateless and reads/writes to etcd for all state.',
      reference: 'etcd section in theory.'
    },
    {
      question: 'Which component runs on EVERY node (both control plane and workers)?',
      options: [
        'kube-apiserver',
        'etcd',
        'kube-scheduler',
        'kubelet'
      ],
      correct: 3,
      explanation: 'The kubelet runs on every node — it is the node agent. It receives pod specs from the API server and ensures containers are running as specified. kube-apiserver, etcd, and kube-scheduler only run on control plane nodes.',
      reference: 'Worker Node Components — kubelet section in theory.'
    },
    {
      question: 'What is the role of kube-proxy?',
      options: [
        'Proxies kubectl commands from users to the API server',
        'Maintains iptables/IPVS rules to route Service traffic to pod IPs',
        'Acts as a reverse proxy for ingress traffic',
        'Manages TLS certificates for secure communication'
      ],
      correct: 1,
      explanation: 'kube-proxy runs on each node and maintains networking rules (iptables or IPVS) that implement Service abstraction — routing traffic from a Service ClusterIP to the actual backend pod IPs.',
      reference: 'kube-proxy section in theory.'
    },
    {
      question: 'The kube-controller-manager contains which key controller for maintaining pod replica counts?',
      options: [
        'The Pod controller',
        'The Replica controller (ReplicaSet controller)',
        'The Node controller',
        'The Deployment controller'
      ],
      correct: 1,
      explanation: 'The ReplicaSet controller (inside kube-controller-manager) continuously watches the actual number of pods vs the desired count and creates/deletes pods to match. The Deployment controller manages ReplicaSets.',
      reference: 'kube-controller-manager section in theory.'
    },
    {
      question: 'In a Kubernetes declarative model, what happens when you run kubectl apply -f deployment.yaml?',
      options: [
        'kubectl directly instructs kubelet to create containers',
        'The desired state is written to etcd, then controllers reconcile actual state toward it',
        'The scheduler immediately assigns pods to nodes',
        'kubelet downloads and runs the containers directly'
      ],
      correct: 1,
      explanation: 'kubectl sends the desired state to kube-apiserver, which stores it in etcd. Then the Deployment controller creates a ReplicaSet, the ReplicaSet controller creates Pods, the scheduler assigns them to nodes, and kubelet on each node starts the containers.',
      reference: 'kubectl and API Communication section in theory.'
    },
    {
      question: 'For etcd high availability, what is the minimum recommended node count?',
      options: [
        '1 (single node is sufficient)',
        '2 (primary + backup)',
        '3 (odd number for quorum)',
        '5 (always use 5)'
      ],
      correct: 2,
      explanation: 'etcd uses the Raft consensus algorithm which requires a majority (quorum) to agree on writes. With 3 nodes, you can tolerate 1 failure. With 5 nodes, you can tolerate 2. Always use an odd number to ensure a clear majority.',
      reference: 'etcd section — "at least 3 etcd nodes for quorum".'
    },
    {
      question: 'Which component integrates Kubernetes with AWS, GCP, or Azure cloud APIs?',
      options: [
        'kube-apiserver with cloud plugins',
        'cloud-controller-manager',
        'kubelet cloud extension',
        'kube-scheduler cloud provider'
      ],
      correct: 1,
      explanation: 'The cloud-controller-manager abstracts cloud-specific logic (creating load balancers, attaching cloud volumes, managing node lifecycle on cloud VMs) from the core Kubernetes components.',
      reference: 'cloud-controller-manager section in theory.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4 core control plane components?',
      back: '1. kube-apiserver — REST API entry point, authenticates/authorizes all requests\n2. etcd — distributed KV store, stores ALL cluster state\n3. kube-scheduler — decides which node pods run on\n4. kube-controller-manager — runs all built-in controllers (Deployment, ReplicaSet, Node, etc.)\n\nOptional: cloud-controller-manager (for cloud providers)'
    },
    {
      front: 'What are the 3 core worker node components?',
      back: '1. kubelet — node agent, ensures pods are running as specified\n2. kube-proxy — manages iptables/IPVS rules for Service routing\n3. Container runtime — runs containers (containerd, CRI-O)\n\nAlso CNI plugin for pod networking (Calico, Flannel, Cilium)'
    },
    {
      front: 'What is the Kubernetes reconciliation loop?',
      back: 'Kubernetes uses a declarative model with continuous reconciliation:\n\n1. User declares desired state (e.g., 3 replicas)\n2. Stored in etcd\n3. Controller watches → sees actual ≠ desired\n4. Controller takes corrective action\n5. kubelet executes\n6. State updated in etcd\n7. Loop repeats forever\n\nThis is the "control loop" or "reconciliation loop" pattern.'
    },
    {
      front: 'What does the kube-scheduler do exactly?',
      back: 'Selects the best node for unscheduled pods in 2 phases:\n1. Filtering — removes nodes that don\'t meet requirements (resource constraints, taints, affinity rules)\n2. Scoring — ranks remaining eligible nodes\n\nKey point: kube-scheduler only DECIDES — it does NOT start the container. kubelet does that.'
    },
    {
      front: 'What is etcd and why does it need odd numbers of nodes?',
      back: 'etcd: distributed key-value store using the Raft consensus algorithm.\n\nAll Kubernetes state is stored here (pods, services, secrets, RBAC, etc.).\n\nOdd numbers for quorum:\n- 1 node: no HA, can\'t tolerate failures\n- 3 nodes: tolerates 1 failure (2/3 = majority)\n- 5 nodes: tolerates 2 failures (3/5 = majority)\n\nEven numbers (2, 4) provide no extra fault tolerance over lower odd numbers.'
    },
    {
      front: 'Which Kubernetes components are stateless?',
      back: 'kube-apiserver — stateless, all state in etcd\nkube-scheduler — stateless, reads from API server\nkube-controller-manager — stateless, reads from API server\n\nOnly etcd is stateful (stores cluster data).\n\nThis means: if the API server restarts, no data is lost. etcd is the critical data store — must be backed up!'
    },
    {
      front: 'What is the Container Runtime Interface (CRI)?',
      back: 'CRI is the API between kubelet and the container runtime. It makes Kubernetes runtime-agnostic.\n\nCRI-compliant runtimes:\n- containerd (most common today)\n- CRI-O (lightweight, OCI-compliant)\n- Docker (via dockershim — removed in K8s 1.24)\n\nkubelet calls CRI to: pull images, create/start/stop/delete containers, get container status.'
    },
    {
      front: 'What is the difference between kubectl and the kube-apiserver?',
      back: 'kubectl: client-side CLI tool that communicates with the API server\n- Reads kubeconfig (~/.kube/config) for connection details\n- Converts commands to HTTP REST calls to the API server\n\nkube-apiserver: the server-side component running in the control plane\n- Validates and processes all API requests\n- Authenticates users/service accounts\n- Authorizes with RBAC\n- Writes to etcd\n- Notifies controllers of changes'
    }
  ],
  lab: {
    scenario: 'Understanding Kubernetes architecture is essential for diagnosing cluster issues and designing solutions. In this lab, you explore the actual running components in a cluster.',
    objective: 'Identify and inspect all Kubernetes control plane and node components in a running cluster.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Inspect Control Plane Components',
        instruction: `Explore the running control plane components in the kube-system namespace:

1. List all pods in kube-system
2. Identify which pods correspond to each control plane component
3. Check the static pod manifests on the control plane node
4. Verify etcd is running and check which port it listens on`,
        hints: [
          'kubectl get pods -n kube-system',
          'Control plane components run as static pods in kube-system',
          'Static pod manifests are at /etc/kubernetes/manifests/ on control plane node',
          'kubectl describe pod etcd-controlplane -n kube-system shows configuration'
        ],
        solution: `\`\`\`bash
# List all control plane components
kubectl get pods -n kube-system
# Look for: etcd-*, kube-apiserver-*, kube-controller-manager-*, kube-scheduler-*

# Identify by component
kubectl get pods -n kube-system --show-labels | grep -E "component="

# Check static pod manifests (on control plane node)
ls /etc/kubernetes/manifests/
# Expected: etcd.yaml, kube-apiserver.yaml, kube-controller-manager.yaml, kube-scheduler.yaml

# Inspect etcd static pod
kubectl describe pod etcd-$(hostname) -n kube-system | grep -E "Port|Image:"
# Shows etcd listens on 2379 (client) and 2380 (peer)

# Check API server version
kubectl get pod kube-apiserver-$(hostname) -n kube-system \
  -o jsonpath='{.spec.containers[0].image}'
\`\`\``,
        verify: `\`\`\`bash
# All 4 control plane components should be Running
kubectl get pods -n kube-system | grep -E "etcd|apiserver|controller-manager|scheduler"
# Expected: all STATUS = Running

# Static pod manifests exist
ls /etc/kubernetes/manifests/
# Expected: etcd.yaml, kube-apiserver.yaml, kube-controller-manager.yaml, kube-scheduler.yaml
\`\`\``
      },
      {
        title: 'Inspect Worker Node Components',
        instruction: `Explore the node-level components:

1. Check the kubelet service status on the current node
2. List nodes and check their status
3. Find the kube-proxy DaemonSet (runs on every node)
4. Identify the container runtime in use`,
        hints: [
          'systemctl status kubelet to check kubelet service',
          'kubectl get nodes shows node status',
          'kubectl get daemonset -n kube-system for kube-proxy',
          'kubectl get node <name> -o yaml | grep containerRuntimeVersion'
        ],
        solution: `\`\`\`bash
# Check kubelet service
systemctl status kubelet | head -10
# Expected: Active: active (running)

# List nodes with K8s version
kubectl get nodes
kubectl get nodes -o wide  # Shows IP and container runtime

# Check kube-proxy DaemonSet
kubectl get daemonset kube-proxy -n kube-system
# DESIRED = NUMBER OF NODES (runs on every node)

kubectl describe daemonset kube-proxy -n kube-system | grep "Image:"

# Check container runtime
kubectl get node $(hostname) -o jsonpath='{.status.nodeInfo.containerRuntimeVersion}'
# Expected: containerd://X.X.X or cri-o://X.X.X

# CNI plugin (network)
ls /etc/cni/net.d/
\`\`\``,
        verify: `\`\`\`bash
# kubelet must be running
systemctl is-active kubelet
# Expected: active

# kube-proxy should run on all nodes
kubectl get daemonset kube-proxy -n kube-system
# Expected: DESIRED = CURRENT = NUMBER OF NODES

# Container runtime should be reported
kubectl get nodes -o wide | grep "CONTAINER-RUNTIME"
\`\`\``
      },
      {
        title: 'Trace a kubectl Command Through the Architecture',
        instruction: `Understand how a kubectl command flows through all components:

1. Run kubectl get pods and observe what happens
2. Check the audit log or API server to understand the request path
3. Create a pod and watch events to trace scheduler and kubelet involvement
4. Use kubectl get events to see the full lifecycle`,
        hints: [
          'kubectl get pods sends GET to /api/v1/namespaces/default/pods',
          'kubectl run test --image=nginx creates a pod spec in etcd',
          'kubectl get events --sort-by=.lastTimestamp shows scheduler and kubelet events',
          'kubectl describe pod shows "Scheduled" event from scheduler'
        ],
        solution: `\`\`\`bash
# Show the actual API call kubectl makes
kubectl get pods -v=6 2>&1 | head -20
# Shows: GET https://kube-apiserver:6443/api/v1/namespaces/default/pods

# Create a pod and watch events
kubectl run trace-test --image=nginx:1.25
kubectl get events --sort-by='.lastTimestamp' | grep trace-test

# Events show the full lifecycle:
# Scheduled: Successfully assigned default/trace-test to node01 (kube-scheduler)
# Pulling: Pulling image "nginx:1.25" (kubelet)
# Pulled: Successfully pulled image (kubelet)
# Created: Created container (kubelet)
# Started: Started container (kubelet)

kubectl describe pod trace-test | grep -A10 "Events:"

# Cleanup
kubectl delete pod trace-test
\`\`\``,
        verify: `\`\`\`bash
# Verbose kubectl shows API server communication
kubectl get pods -v=4 2>&1 | grep "GET\|POST"
# Expected: lines showing HTTPS calls to kube-apiserver

# Events should show scheduler + kubelet involvement
kubectl run arch-test --image=nginx:1.25
kubectl get events | grep arch-test | grep -E "Scheduled|Pulled|Started"
# Expected: all 3 event types present
kubectl delete pod arch-test
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Control Plane Component Not Starting After Cluster Init',
      difficulty: 'medium',
      symptom: 'After kubeadm init or a node restart, kubectl commands fail or a control plane component (e.g., kube-scheduler) is not running in kube-system.',
      diagnosis: `\`\`\`bash
# Check static pods in kube-system
kubectl get pods -n kube-system
# Look for missing or failing components

# Check static pod manifest directory
ls /etc/kubernetes/manifests/
# All 4 yaml files must exist

# Check kubelet logs for static pod errors
journalctl -u kubelet | grep -i "error\|failed" | tail -30

# Check if the static pod manifest is valid YAML
cat /etc/kubernetes/manifests/kube-scheduler.yaml

# Check container runtime
systemctl status containerd  # or cri-o
crictl ps -a | grep scheduler
\`\`\``,
      solution: `**Cause A: Static pod manifest missing or corrupt**
\`\`\`bash
# If manifest is missing, restore from backup or regenerate
kubeadm init phase control-plane scheduler

# If manifest has syntax errors, fix with a YAML linter
cat /etc/kubernetes/manifests/kube-scheduler.yaml | python3 -m yaml.checker
# (or use kubeadm to regenerate)
\`\`\`

**Cause B: kubelet not running**
\`\`\`bash
systemctl start kubelet
systemctl enable kubelet
systemctl status kubelet

journalctl -u kubelet -f  # Watch for errors
\`\`\`

**Cause C: Container runtime down**
\`\`\`bash
systemctl start containerd
systemctl status containerd
crictl ps  # Should show running containers
\`\`\``
    },
    {
      title: 'etcd Cluster Unhealthy',
      difficulty: 'hard',
      symptom: 'kubectl commands fail with "connection refused" or "etcdserver: request timed out". The cluster is completely unresponsive.',
      diagnosis: `\`\`\`bash
# Check etcd pod
kubectl get pod etcd-$(hostname) -n kube-system 2>/dev/null
# May fail if API server itself is down

# Check etcd directly
ETCDCTL_API=3 etcdctl endpoint health \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Check etcd static pod manifest
cat /etc/kubernetes/manifests/etcd.yaml

# Check etcd logs
crictl logs $(crictl ps | grep etcd | awk '{print $1}')
\`\`\``,
      solution: `**Cause A: etcd data corruption — restore from backup**
\`\`\`bash
# Stop etcd by removing static pod manifest temporarily
mv /etc/kubernetes/manifests/etcd.yaml /tmp/etcd.yaml.bak

# Restore from snapshot
ETCDCTL_API=3 etcdctl snapshot restore /opt/etcd-backup.db \
  --data-dir=/var/lib/etcd-restored

# Update manifest to use new data dir
sed -i 's|/var/lib/etcd|/var/lib/etcd-restored|g' /tmp/etcd.yaml.bak

# Restore manifest
mv /tmp/etcd.yaml.bak /etc/kubernetes/manifests/etcd.yaml
\`\`\`

**Cause B: Wrong data directory in manifest**
\`\`\`bash
# Check --data-dir flag in etcd.yaml matches the volume mount hostPath
cat /etc/kubernetes/manifests/etcd.yaml | grep -E "data-dir|hostPath"
# Both must point to the same directory
\`\`\``
    }
  ]
};
