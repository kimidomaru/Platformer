window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcna-orchestration/orchestration-fundamentals'] = {
  theory: `# Container Orchestration Fundamentals

## Exam Relevance
> Container orchestration is a primary topic in KCNA (~22% Kubernetes Fundamentals + Orchestration). You need to understand why orchestration is necessary, what Kubernetes solves, and key orchestration concepts.

## Why Container Orchestration?

Running containers manually (docker run) works for one host. In production, you need:

| Challenge | Kubernetes Solution |
|-----------|-------------------|
| Schedule containers across hosts | kube-scheduler |
| Restart failed containers | Self-healing (ReplicaSet) |
| Scale up/down based on load | HPA / kubectl scale |
| Distribute traffic | Service + kube-proxy |
| Store and inject config | ConfigMap / Secret |
| Rolling updates with no downtime | Deployment rollout |
| Service discovery | CoreDNS + Service |
| Health monitoring | Liveness / Readiness probes |
| Resource management | Requests, Limits, QoS |

## Core Orchestration Concepts

### Desired State vs Actual State

Kubernetes uses a **declarative model**:

\`\`\`yaml
# You declare: I want 3 nginx pods
spec:
  replicas: 3
\`\`\`

Kubernetes **continuously reconciles** actual state to match desired state:
- 2 pods running → create 1 more
- 4 pods running → delete 1
- Pod crashes → create replacement

### Controllers and the Control Loop

Every resource in Kubernetes is managed by a **controller** that runs a control loop:

\`\`\`
Watch API server for desired state
    ↓
Compare to actual state
    ↓
If different: take action
    ↓
Repeat forever
\`\`\`

Examples:
- **Deployment controller** → manages ReplicaSets
- **ReplicaSet controller** → manages Pods
- **Node controller** → manages Node status
- **Endpoint controller** → populates Service endpoints

### Scheduling

kube-scheduler places pods on nodes:

1. **Filtering**: remove nodes that don't meet requirements
   - Insufficient CPU/memory
   - Taints without matching tolerations
   - Node affinity mismatch
   - Pod anti-affinity conflict

2. **Scoring**: rank remaining nodes
   - Most available resources
   - Spreading (distribute pods evenly)
   - Affinity preferences

### Service Discovery and Load Balancing

Kubernetes provides built-in service discovery:

\`\`\`bash
# Every Service gets a stable DNS name:
# <service-name>.<namespace>.svc.cluster.local

# Kubernetes automatically load-balances across healthy pods
# kube-proxy handles traffic routing (iptables/IPVS)
\`\`\`

### Health Checks

\`\`\`yaml
livenessProbe:    # Is the app alive? → restart if fails
  httpGet:
    path: /health
    port: 8080

readinessProbe:   # Is the app ready for traffic? → remove from LB if fails
  httpGet:
    path: /ready
    port: 8080
\`\`\`

### Resource Management

\`\`\`yaml
resources:
  requests:         # Minimum needed (scheduler uses this)
    cpu: 100m
    memory: 128Mi
  limits:           # Maximum allowed (OOMKill if exceeded)
    cpu: 500m
    memory: 256Mi
\`\`\`

## Kubernetes vs Other Orchestrators

| Feature | Kubernetes | Docker Swarm | Apache Mesos |
|---------|-----------|-------------|--------------|
| Adoption | Dominant | Declining | Niche |
| Complexity | High | Low | Very High |
| Ecosystem | Vast (CNCF) | Limited | Moderate |
| Auto-scaling | Built-in (HPA) | Limited | Plugin |
| Community | Huge | Small | Declining |

Kubernetes won the container orchestration war — it is the industry standard.

## Kubernetes Distributions

Various organizations package Kubernetes:

| Distribution | Provider | Notes |
|-------------|---------|-------|
| GKE | Google | Managed, auto-upgrade |
| EKS | Amazon | Managed, AWS integration |
| AKS | Microsoft | Managed, Azure integration |
| OpenShift | Red Hat | Enterprise, opinionated |
| Rancher | SUSE | Multi-cluster management |
| k3s | Rancher | Lightweight, edge/IoT |
| kind | Kubernetes | Local development |
| minikube | Kubernetes | Local development |

## GitOps and Kubernetes

GitOps treats Git as the single source of truth:

\`\`\`
Git repo (manifests) → GitOps controller (Argo CD/Flux) → Kubernetes cluster
\`\`\`

Changes are made by:
1. Creating a PR/commit to Git
2. Automated CI validates the change
3. GitOps controller detects drift and reconciles

This enables: audit trail, rollback, disaster recovery, multi-cluster consistency.
`,
  quiz: [
    {
      question: 'What is the primary reason to use a container orchestrator like Kubernetes?',
      options: [
        'To build container images faster',
        'To manage, schedule, scale, and heal containerized applications across multiple hosts automatically',
        'To provide a container registry for storing images',
        'To monitor application performance'
      ],
      correct: 1,
      explanation: 'Container orchestration automates what would be manual work at scale: scheduling containers across nodes, restarting failures, scaling based on load, service discovery, rolling updates, and resource management.',
      reference: 'Why Container Orchestration table in theory.'
    },
    {
      question: 'What is the "desired state vs actual state" model in Kubernetes?',
      options: [
        'Kubernetes only acts when you manually request a change',
        'You declare what you want; Kubernetes continuously reconciles the actual state to match the desired state',
        'Desired state is stored in Git; actual state is in the cluster',
        'Kubernetes predicts future state based on historical data'
      ],
      correct: 1,
      explanation: 'Kubernetes uses a declarative model: you declare desired state in YAML. Controllers continuously watch for deviations and take action to reconcile. If a pod crashes, the controller creates a new one — without any human intervention.',
      reference: 'Desired State vs Actual State section in theory.'
    },
    {
      question: 'What are the two phases of Kubernetes pod scheduling?',
      options: [
        'Authentication and Authorization',
        'Filtering (remove ineligible nodes) and Scoring (rank remaining nodes)',
        'Validation and Execution',
        'Binding and Starting'
      ],
      correct: 1,
      explanation: 'kube-scheduler filters out nodes that cannot run the pod (insufficient resources, taints, affinity), then scores the remaining nodes to find the best placement based on available resources, spreading, and affinity preferences.',
      reference: 'Scheduling section in theory.'
    },
    {
      question: 'What is GitOps?',
      options: [
        'Using Git for storing container images',
        'A practice where Git is the single source of truth for desired cluster state; automated tools reconcile the cluster to match',
        'Git integration for kubectl commands',
        'Version controlling Kubernetes cluster configuration using git blame'
      ],
      correct: 1,
      explanation: 'GitOps uses Git as the source of truth. Tools like Argo CD or Flux continuously watch the Git repository and reconcile the cluster to match. Changes are made via Git commits, providing audit trail, rollback, and consistency.',
      reference: 'GitOps and Kubernetes section in theory.'
    },
    {
      question: 'Which container orchestrator has become the industry standard?',
      options: [
        'Docker Swarm',
        'Apache Mesos',
        'Kubernetes',
        'Nomad by HashiCorp'
      ],
      correct: 2,
      explanation: 'Kubernetes won the "container orchestration wars". It has the largest community, most extensive ecosystem (CNCF), and has been adopted as the default orchestration platform by all major cloud providers.',
      reference: 'Kubernetes vs Other Orchestrators table in theory.'
    },
    {
      question: 'What is the difference between a liveness probe and a readiness probe?',
      options: [
        'Liveness checks if the container is running; readiness checks resource usage',
        'Liveness probe failure triggers container RESTART; readiness probe failure removes pod from Service endpoints (no traffic)',
        'They are identical — both restart the container on failure',
        'Readiness is for init containers; liveness is for main containers'
      ],
      correct: 1,
      explanation: 'Liveness: if it fails, kubelet restarts the container (app is stuck/dead). Readiness: if it fails, the pod is removed from Service endpoints (app is alive but not ready for traffic, e.g., still initializing).',
      reference: 'Health Checks section in theory.'
    },
    {
      question: 'What is k3s?',
      options: [
        'Kubernetes version 3',
        'A lightweight Kubernetes distribution designed for edge computing and IoT',
        'A Kubernetes security tool',
        'A container build tool'
      ],
      correct: 1,
      explanation: 'k3s is a lightweight, certified Kubernetes distribution by Rancher (now SUSE). It has a smaller binary, uses SQLite instead of etcd by default, and is designed for edge, IoT, and resource-constrained environments.',
      reference: 'Kubernetes Distributions table in theory.'
    },
    {
      question: 'What does the Kubernetes controller pattern do?',
      options: [
        'Directly executes containers on nodes',
        'Runs a control loop: watches desired vs actual state, then takes corrective actions to reconcile them',
        'Manages kubectl access control',
        'Routes network traffic between pods'
      ],
      correct: 1,
      explanation: 'Controllers run continuous control loops: watch the desired state (API server), compare to actual state, and take actions if different. The Deployment controller, ReplicaSet controller, and Node controller all follow this pattern.',
      reference: 'Controllers and the Control Loop section in theory.'
    }
  ],
  flashcards: [
    {
      front: 'What are the key problems container orchestration solves?',
      back: 'Scheduling: which node to run containers on\nSelf-healing: restart failed containers automatically\nScaling: add/remove instances based on load\nService discovery: find other services by DNS name\nLoad balancing: distribute traffic across healthy pods\nRolling updates: update without downtime\nConfig management: inject ConfigMaps and Secrets\nResource management: requests and limits per container'
    },
    {
      front: 'What is the Kubernetes controller pattern?',
      back: 'A continuous reconciliation loop:\n1. Watch API server for desired state\n2. Observe actual state\n3. If actual ≠ desired: take corrective action\n4. Repeat forever\n\nExamples:\n- ReplicaSet controller: creates pods if below desired count\n- Deployment controller: creates ReplicaSet on image change\n- Node controller: marks node as NotReady if unreachable'
    },
    {
      front: 'What is GitOps and which tools implement it for Kubernetes?',
      back: 'GitOps: Git is the single source of truth for cluster desired state.\n\nWorkflow:\nCommit to Git → CI validates → GitOps tool reconciles cluster\n\nTools:\n- Argo CD: declarative GitOps, web UI, multi-cluster\n- Flux: toolkit-based, kustomize/Helm support\n\nBenefits: audit trail, rollback, disaster recovery, multi-cluster consistency'
    },
    {
      front: 'What are the main Kubernetes distributions and their use cases?',
      back: 'Cloud Managed (easiest):\n- GKE (Google), EKS (AWS), AKS (Azure)\n\nEnterprise:\n- OpenShift (Red Hat) — opinionated, includes CI/CD\n- Rancher (SUSE) — multi-cluster management\n\nLightweight/Local:\n- k3s — edge, IoT, resource-constrained\n- kind — Docker-based, local dev/CI\n- minikube — local development, multiple drivers'
    },
    {
      front: 'How does Kubernetes service discovery work?',
      back: 'Every Service gets a stable DNS name via CoreDNS:\n<service>.<namespace>.svc.cluster.local\n\nPods query this DNS name → CoreDNS resolves to ClusterIP\nkube-proxy routes ClusterIP traffic to healthy pod IPs (via iptables/IPVS)\n\nNo manual IP management needed:\nPod IPs are ephemeral; Service ClusterIPs are stable.'
    }
  ],
  lab: {
    scenario: 'Exploring orchestration concepts in a running cluster helps solidify understanding of scheduling, self-healing, and service discovery.',
    objective: 'Observe Kubernetes orchestration features: scheduling decisions, self-healing, and service discovery in action.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Observe the Scheduling Decision',
        instruction: `Observe how the kube-scheduler places pods:

1. Create a deployment with 4 replicas
2. Check which nodes the pods were scheduled on
3. Check node resource availability to understand why each pod was placed there
4. Label a node and use nodeSelector to constrain scheduling`,
        hints: [
          'kubectl get pods -o wide shows NODE column',
          'kubectl describe node <name> shows available resources',
          'kubectl label node <name> tier=frontend',
          'nodeSelector: tier: frontend in pod spec constrains scheduling'
        ],
        solution: `\`\`\`bash
# Create deployment and observe scheduling
kubectl create deployment sched-test --image=nginx:1.25 --replicas=4
kubectl get pods -o wide
# Shows which node each pod was scheduled on

# Check node resources
kubectl describe nodes | grep -A10 "Allocatable:\|Allocated resources:"

# Label a node
NODE=$(kubectl get nodes --no-headers | grep -v "control-plane" | head -1 | awk '{print $1}')
kubectl label node $NODE tier=frontend

# Create a pod constrained to this node
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: frontend-pod
spec:
  nodeSelector:
    tier: frontend
  containers:
  - name: app
    image: nginx:1.25
EOF

kubectl get pod frontend-pod -o wide
# Expected: runs on the labeled node

kubectl delete deployment sched-test
kubectl delete pod frontend-pod
kubectl label node $NODE tier-   # Remove label
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod frontend-pod -o wide 2>/dev/null | grep $NODE
# Expected: pod on the labeled node
\`\`\``
      },
      {
        title: 'Observe Self-Healing and Controller Loop',
        instruction: `Watch the controller reconciliation loop in action:

1. Create a ReplicaSet with 3 replicas directly
2. Delete all pods at once
3. Watch the controller loop recreate them immediately
4. Edit the ReplicaSet to change replica count and watch reconciliation`,
        hints: [
          'kubectl create deployment autofix --image=nginx:1.25 --replicas=3',
          'kubectl delete pods -l app=autofix to delete all at once',
          'kubectl get pods -l app=autofix -w to watch recreation',
          'kubectl scale deployment autofix --replicas=5 to trigger scaling'
        ],
        solution: `\`\`\`bash
# Create deployment
kubectl create deployment autofix --image=nginx:1.25 --replicas=3
kubectl rollout status deployment/autofix

# Delete ALL pods simultaneously (chaos test!)
kubectl delete pods -l app=autofix

# Watch controller loop recreate them
kubectl get pods -l app=autofix -w
# Expected: 0 → 3 pods again within seconds

# Controller loop reconciliation:
# ReplicaSet controller sees: desired=3, actual=0
# Action: create 3 new pods

# Observe the controller message
kubectl describe replicaset -l app=autofix | grep -A10 "Events:"
# Shows "Created pod" events

kubectl delete deployment autofix
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployment autofix
# Expected: READY = 3/3 (recovered from forced deletion)
\`\`\``
      },
      {
        title: 'Verify Service Discovery via DNS',
        instruction: `Test Kubernetes built-in service discovery:

1. Create a backend deployment and service
2. Create a frontend pod in a different namespace
3. Resolve the backend service from the frontend using DNS
4. Demonstrate that stable DNS names enable service discovery without hardcoded IPs`,
        hints: [
          'kubectl create deployment backend --image=nginx --port=80',
          'kubectl expose deployment backend --port=80 --name=backend-svc',
          'kubectl run frontend --image=busybox:1.36 -- sleep 3600',
          'kubectl exec frontend -- nslookup backend-svc.default.svc.cluster.local'
        ],
        solution: `\`\`\`bash
# Backend service
kubectl create deployment backend --image=nginx:1.25 --port=80
kubectl expose deployment backend --port=80 --name=backend-svc
kubectl rollout status deployment/backend

# Frontend consumer
kubectl run frontend --image=busybox:1.36 -- sleep 3600
kubectl get pod frontend -w

# Service discovery via DNS
kubectl exec frontend -- nslookup backend-svc.default.svc.cluster.local
# Expected: resolves to ClusterIP

# Connect to backend using service name (not IP)
kubectl exec frontend -- wget -qO- http://backend-svc | head -3
# Expected: nginx welcome HTML

# If pod IP changes (simulate):
BACKEND_POD=$(kubectl get pods -l app=backend -o jsonpath='{.items[0].metadata.name}')
kubectl delete pod $BACKEND_POD
sleep 5
# New pod has different IP but same Service name works!
kubectl exec frontend -- wget -qO- http://backend-svc | head -3

kubectl delete deployment backend
kubectl delete svc backend-svc
kubectl delete pod frontend
\`\`\``,
        verify: `\`\`\`bash
kubectl exec frontend -- nslookup backend-svc.default.svc.cluster.local 2>/dev/null
# Expected: DNS resolves to ClusterIP
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pod Stuck in Pending — Scheduling Failed',
      difficulty: 'medium',
      symptom: 'A pod stays in Pending state indefinitely. It never gets scheduled to a node.',
      diagnosis: `\`\`\`bash
kubectl describe pod <name> | grep -A10 "Events:"
# Common messages:
# "0/2 nodes are available: 2 Insufficient cpu"
# "0/2 nodes are available: 2 node(s) had untolerated taint"
# "0/2 nodes are available: 2 node(s) didn't match Pod's node affinity"
# "0/2 nodes are available: 2 node(s) had volume node affinity conflict"
\`\`\``,
      solution: `Fix based on the event message:

**Insufficient resources:**
\`\`\`bash
kubectl top nodes  # Check available resources
kubectl get pods -A | grep -v Running  # Find resource hogs
# Lower the pod's resource requests
\`\`\`

**Untolerated taint:**
\`\`\`bash
kubectl describe nodes | grep Taint
# Add toleration to the pod spec
tolerations:
- key: "node-role.kubernetes.io/control-plane"
  operator: "Exists"
  effect: "NoSchedule"
\`\`\`

**Node affinity mismatch:**
\`\`\`bash
kubectl get nodes --show-labels
# Add the required label to a node
kubectl label node <node> <key>=<value>
\`\`\``
    }
  ]
};
