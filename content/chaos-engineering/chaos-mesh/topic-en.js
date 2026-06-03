window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['chaos-engineering/chaos-mesh'] = {
  theory: `
# Chaos Mesh on Kubernetes

## Relevance
Chaos Mesh is a cloud-native chaos engineering platform, part of the CNCF (incubating). It uses native Kubernetes CRDs and offers a rich web interface to define and observe experiments. It supports fault injection in pods, network, I/O, stress, time (clock skew), and even physical machines, being one of the most comprehensive chaos tools for Kubernetes.

## Core Concepts

### Chaos Mesh Architecture

\`\`\`
┌──────────────────────────────────────────────────────────┐
│                    Chaos Mesh Architecture                │
│                                                          │
│  ┌────────────────┐     ┌─────────────────────┐         │
│  │ Chaos Dashboard│     │  chaos-controller-   │         │
│  │   (Web UI)     │────→│  manager (Deployment)│         │
│  └────────────────┘     └──────────┬──────────┘         │
│                                    │                     │
│                          ┌─────────▼──────────┐         │
│                          │   chaos-daemon      │         │
│                          │   (DaemonSet)       │         │
│                          │   Privileged per     │         │
│                          │   node               │         │
│                          └──────────┬──────────┘         │
│                                     │                    │
│              ┌──────────────────────┼──────────┐         │
│              │                      │          │         │
│        ┌─────▼─────┐  ┌──────▼──────┐ ┌──────▼──────┐  │
│        │ Pod Chaos  │  │Network Chaos│ │Stress Chaos │  │
│        │ kill/fail  │  │delay/loss   │ │CPU/mem/IO   │  │
│        └───────────┘  └────────────┘ └────────────┘  │
└──────────────────────────────────────────────────────────┘

Components:
- chaos-controller-manager: Controls CRDs and orchestrates experiments
- chaos-daemon: Privileged DaemonSet that injects faults into containers
- chaos-dashboard: Web interface for managing experiments
\`\`\`

### Chaos Types (CRDs)

\`\`\`
Chaos Mesh CRDs:
├── PodChaos           — Kill, failure, container kill
├── NetworkChaos       — Delay, loss, corruption, partition, bandwidth
├── StressChaos        — CPU stress, memory stress
├── IOChaos            — I/O latency, I/O fault, attribute override
├── TimeChaos          — Clock skew (time offset)
├── DNSChaos           — DNS error, DNS random
├── HTTPChaos          — HTTP fault injection (abort, delay, replace)
├── JVMChaos           — Java bytecode injection (exception, GC, stress)
├── KernelChaos        — Kernel fault injection (slab, bio)
├── AWSChaos           — EC2 stop/restart, detach volume
├── GCPChaos           — VM stop/restart, disk loss
├── AzureChaos         — VM stop/restart, disk detach
├── PhysicalMachineChaos — Chaos on physical machines/VMs
├── Schedule           — Scheduled chaos (cron)
└── Workflow           — Orchestration of multiple chaos
\`\`\`

### PodChaos — Pod Failures

\`\`\`yaml
# PodChaos — Kill pods
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: pod-kill-test
  namespace: default
spec:
  action: pod-kill            # pod-kill | pod-failure | container-kill
  mode: one                   # one | all | fixed | fixed-percent | random-max-percent
  selector:
    namespaces:
      - default
    labelSelectors:
      app: my-app
  duration: "60s"             # ignored for pod-kill (instantaneous)
  gracePeriod: 0              # force kill
\`\`\`

\`\`\`yaml
# PodChaos — Pod failure (pod becomes unavailable)
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: pod-failure-test
  namespace: default
spec:
  action: pod-failure
  mode: fixed-percent
  value: "50"                 # 50% of selected pods
  selector:
    namespaces:
      - default
    labelSelectors:
      app: my-app
  duration: "120s"            # pod unavailable for 2 min
\`\`\`

### NetworkChaos — Network Failures

\`\`\`yaml
# NetworkChaos — Inject latency
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: network-delay-test
  namespace: default
spec:
  action: delay
  mode: all
  selector:
    namespaces:
      - default
    labelSelectors:
      app: my-app
  delay:
    latency: "200ms"
    jitter: "50ms"            # random variation
    correlation: "25"         # correlation between packets
  direction: to               # to | from | both
  target:
    selector:
      namespaces:
        - default
      labelSelectors:
        app: database
    mode: all
  duration: "60s"
\`\`\`

\`\`\`yaml
# NetworkChaos — Packet loss
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: network-loss-test
  namespace: default
spec:
  action: loss
  mode: all
  selector:
    namespaces:
      - default
    labelSelectors:
      app: my-app
  loss:
    loss: "30"                # 30% packet loss
    correlation: "25"
  duration: "60s"
\`\`\`

\`\`\`yaml
# NetworkChaos — Network partition
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: network-partition-test
  namespace: default
spec:
  action: partition
  mode: all
  selector:
    namespaces:
      - default
    labelSelectors:
      app: frontend
  direction: both
  target:
    selector:
      namespaces:
        - default
      labelSelectors:
        app: backend
    mode: all
  duration: "30s"
\`\`\`

### StressChaos — Resource Stress

\`\`\`yaml
# StressChaos — CPU and memory
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: cpu-stress-test
  namespace: default
spec:
  mode: one
  selector:
    namespaces:
      - default
    labelSelectors:
      app: my-app
  stressors:
    cpu:
      workers: 2              # 2 workers generating load
      load: 80                # 80% load per worker
    memory:
      workers: 1
      size: "256MB"           # Allocate 256MB
  duration: "120s"
\`\`\`

### IOChaos — I/O Failures

\`\`\`yaml
# IOChaos — I/O latency
apiVersion: chaos-mesh.org/v1alpha1
kind: IOChaos
metadata:
  name: io-latency-test
  namespace: default
spec:
  action: latency             # latency | fault | attrOverride
  mode: one
  selector:
    namespaces:
      - default
    labelSelectors:
      app: database
  volumePath: /var/lib/mysql
  path: "*"
  delay: "100ms"
  percent: 50                 # 50% of operations
  duration: "60s"
\`\`\`

### TimeChaos — Clock Skew

\`\`\`yaml
# TimeChaos — Clock offset
apiVersion: chaos-mesh.org/v1alpha1
kind: TimeChaos
metadata:
  name: clock-skew-test
  namespace: default
spec:
  mode: one
  selector:
    namespaces:
      - default
    labelSelectors:
      app: my-app
  timeOffset: "-2h"           # Clock 2 hours in the past
  clockIds:
    - CLOCK_REALTIME
  containerNames:
    - app
  duration: "60s"
\`\`\`

### HTTPChaos — HTTP Failures

\`\`\`yaml
# HTTPChaos — Inject HTTP error
apiVersion: chaos-mesh.org/v1alpha1
kind: HTTPChaos
metadata:
  name: http-abort-test
  namespace: default
spec:
  mode: all
  selector:
    namespaces:
      - default
    labelSelectors:
      app: my-app
  target: Response             # Request | Response
  port: 8080
  method: GET
  path: /api/*
  code: 503                    # Return 503
  duration: "30s"
\`\`\`

### Selectors — Target Selection

\`\`\`yaml
# Different ways to select targets
selector:
  # By namespace + labels
  namespaces:
    - production
  labelSelectors:
    app: my-app
    version: v2

  # By annotation
  annotationSelectors:
    chaos-mesh.org/inject: "true"

  # By node
  nodeSelectors:
    kubernetes.io/os: linux

  # Specific pods
  pods:
    default:
      - my-app-pod-abc123
      - my-app-pod-def456

  # By field selector
  fieldSelectors:
    metadata.name: my-specific-pod
\`\`\`

**Selection modes:**

| Mode | Description |
|------|-------------|
| one | 1 random pod |
| all | All pods |
| fixed | N pods (spec.value) |
| fixed-percent | N% of pods (spec.value) |
| random-max-percent | Up to N% random |

### Schedule — Scheduled Chaos

\`\`\`yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: Schedule
metadata:
  name: scheduled-pod-kill
  namespace: default
spec:
  schedule: "*/5 * * * *"     # Every 5 minutes
  type: PodChaos
  historyLimit: 5
  concurrencyPolicy: Forbid   # Forbid | Allow
  podChaos:
    action: pod-kill
    mode: one
    selector:
      namespaces:
        - default
      labelSelectors:
        app: my-app
\`\`\`

### Workflow — Orchestration

\`\`\`yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: Workflow
metadata:
  name: resilience-workflow
  namespace: default
spec:
  entry: resilience-test
  templates:
    - name: resilience-test
      templateType: Serial     # Serial | Parallel | Suspend
      children:
        - pod-kill-step
        - wait-step
        - network-delay-step
        - stress-test-step

    - name: pod-kill-step
      templateType: PodChaos
      deadline: "2m"
      podChaos:
        action: pod-kill
        mode: one
        selector:
          namespaces: [default]
          labelSelectors:
            app: my-app

    - name: wait-step
      templateType: Suspend
      deadline: "30s"          # Pause between experiments

    - name: network-delay-step
      templateType: NetworkChaos
      deadline: "2m"
      networkChaos:
        action: delay
        mode: all
        selector:
          namespaces: [default]
          labelSelectors:
            app: my-app
        delay:
          latency: "200ms"
        duration: "60s"

    - name: stress-test-step
      templateType: StressChaos
      deadline: "3m"
      stressChaos:
        mode: one
        selector:
          namespaces: [default]
          labelSelectors:
            app: my-app
        stressors:
          cpu:
            workers: 2
            load: 80
        duration: "120s"
\`\`\`

### Installation

\`\`\`bash
# Helm (recommended)
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm install chaos-mesh chaos-mesh/chaos-mesh \\
  --namespace chaos-mesh \\
  --create-namespace \\
  --set chaosDaemon.runtime=containerd \\
  --set chaosDaemon.socketPath=/run/containerd/containerd.sock \\
  --set dashboard.securityMode=false

# Verify installation
kubectl get pods -n chaos-mesh
# chaos-controller-manager, chaos-daemon (1 per node), chaos-dashboard
\`\`\`

### RBAC and Permissions

\`\`\`yaml
# Chaos Mesh uses native K8s RBAC
# By default, only cluster-admin can create chaos
# To give access to specific teams:
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: chaos-mesh-manager
rules:
  - apiGroups: ["chaos-mesh.org"]
    resources: ["*"]
    verbs: ["get", "list", "watch", "create", "delete", "patch", "update"]
---
# Or restrict by namespace:
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: chaos-mesh-ns-manager
  namespace: staging
rules:
  - apiGroups: ["chaos-mesh.org"]
    resources: ["podchaos", "networkchaos", "stresschaos"]
    verbs: ["get", "list", "watch", "create", "delete"]
\`\`\`

### Common Mistakes

1. **chaos-daemon not privileged** — DaemonSet needs privileged security context and container runtime socket access
2. **Wrong container runtime** — Specify containerd or docker during installation (chaosDaemon.runtime)
3. **Selector too broad** — mode: all without namespace can affect system pods
4. **Long duration without monitoring** — 1-hour chaos without observability is dangerous
5. **NetworkChaos without direction** — Default is "to", but "both" may be needed to simulate real partition
6. **RBAC too permissive** — Restrict chaos access by namespace and CRD type

## Killer.sh Style Challenge

> **Scenario:** Configure Chaos Mesh for: (1) PodChaos killing 50% of "api" deployment pods every 5 minutes (Schedule), (2) NetworkChaos with 200ms latency between "frontend" and "api", (3) Serial Workflow: pod-kill → wait 30s → network delay → CPU stress 80%.
`,
  quiz: [
    {
      question: 'What are the main components of Chaos Mesh?',
      options: [
        'Controller, Worker, Scheduler',
        'chaos-controller-manager (Deployment), chaos-daemon (privileged DaemonSet), chaos-dashboard (Web UI)',
        'Operator, Agent, Hub',
        'Master, Slave, Monitor'
      ],
      correct: 1,
      explanation: 'Chaos Mesh has 3 components: chaos-controller-manager (controls CRDs and orchestrates), chaos-daemon (privileged DaemonSet that injects faults into containers on each node), and chaos-dashboard (web interface).',
      reference: 'Related concept: chaos-daemon needs privileged access and container runtime socket access.'
    },
    {
      question: 'Which CRD injects network latency between two services?',
      options: [
        'PodChaos',
        'NetworkChaos with action: delay',
        'StressChaos',
        'TimeChaos'
      ],
      correct: 1,
      explanation: 'NetworkChaos with action: delay injects network latency. You can specify latency, jitter, correlation, and target specific destinations via target selector. It supports delay, loss, corruption, partition, and bandwidth.',
      reference: 'Related concept: Use direction: both to simulate bidirectional latency.'
    },
    {
      question: 'What does the "fixed-percent" mode do in Chaos Mesh?',
      options: [
        'Fixes the experiment duration',
        'Affects a fixed percentage of selected pods (defined in spec.value)',
        'Ensures the success percentage is fixed',
        'Sets a fixed error rate'
      ],
      correct: 1,
      explanation: 'fixed-percent selects spec.value% of pods matching the selector. For example, mode: fixed-percent with value: "50" affects 50% of pods. Other modes: one, all, fixed (absolute number).',
      reference: 'Related concept: random-max-percent selects up to X% randomly.'
    },
    {
      question: 'What is TimeChaos used for?',
      options: [
        'Setting experiment duration',
        'Offsetting the container system clock (clock skew) to test time-related problems',
        'Scheduling experiments',
        'Measuring recovery time'
      ],
      correct: 1,
      explanation: 'TimeChaos injects clock skew into containers, offsetting the system clock. Useful for testing expired certificates, invalid JWT tokens, time-based caches, and disordered logs.',
      reference: 'Related concept: Uses CLOCK_REALTIME; can offset to future (+2h) or past (-2h).'
    },
    {
      question: 'How do you schedule a chaos experiment to run periodically?',
      options: [
        'Use Kubernetes CronJob',
        'Use the Schedule CRD with spec.schedule in cron format',
        'Configure timer in the Dashboard',
        'Use repetitions in chaos spec'
      ],
      correct: 1,
      explanation: 'The Schedule CRD allows scheduling any type of chaos in cron format. Example: schedule: "*/5 * * * *" runs every 5 minutes. Supports historyLimit and concurrencyPolicy.',
      reference: 'Related concept: Schedule can schedule PodChaos, NetworkChaos, or any other type.'
    },
    {
      question: 'What is the purpose of Workflow in Chaos Mesh?',
      options: [
        'Install Chaos Mesh',
        'Orchestrate multiple chaos experiments in sequence, parallel, or with pauses',
        'Monitor metrics',
        'Generate reports'
      ],
      correct: 1,
      explanation: 'Workflow orchestrates multiple chaos experiments. Supports templateType: Serial (sequential), Parallel (simultaneous), Suspend (pause), and specific chaos types. Enables creating complex resilience scenarios.',
      reference: 'Related concept: Use Suspend between steps to give the system recovery time.'
    },
    {
      question: 'What is the main difference between Chaos Mesh and LitmusChaos?',
      options: [
        'There is no difference',
        'Chaos Mesh uses a privileged chaos-daemon per node for direct injection; LitmusChaos uses ChaosEngine + integrated probes for automatic validation',
        'LitmusChaos is paid and Chaos Mesh is free',
        'Chaos Mesh only works on AWS'
      ],
      correct: 1,
      explanation: 'Chaos Mesh injects faults directly via chaos-daemon (privileged DaemonSet), offering more fault types (IOChaos, TimeChaos, KernelChaos). LitmusChaos focuses on probes and ChaosHub for automatic validation. Both are CNCF.',
      reference: 'Related concept: Chaos Mesh has built-in web dashboard; LitmusChaos has ChaosCenter as a portal.'
    }
  ],
  flashcards: [
    {
      front: 'What types of chaos (CRDs) does Chaos Mesh support?',
      back: '**Pod:**\n- PodChaos: kill, failure, container-kill\n\n**Network:**\n- NetworkChaos: delay, loss, corruption, partition, bandwidth\n- DNSChaos: error, random\n- HTTPChaos: abort, delay, replace\n\n**Resources:**\n- StressChaos: CPU, memory\n- IOChaos: latency, fault, attrOverride\n\n**Time:**\n- TimeChaos: clock skew\n\n**Advanced:**\n- JVMChaos: Java exception, GC\n- KernelChaos: slab, bio\n\n**Cloud:**\n- AWSChaos, GCPChaos, AzureChaos\n\n**Orchestration:**\n- Schedule, Workflow'
    },
    {
      front: 'How does the selector work in Chaos Mesh?',
      back: '**Selection methods:**\n\n1. **Labels:**\nlabelSelectors:\n  app: my-app\n\n2. **Annotations:**\nannotationSelectors:\n  chaos-mesh.org/inject: "true"\n\n3. **Specific pods:**\npods:\n  default: [pod-a, pod-b]\n\n4. **Nodes:**\nnodeSelectors:\n  kubernetes.io/os: linux\n\n**Modes:**\n- one: 1 random pod\n- all: all pods\n- fixed: N pods\n- fixed-percent: N% of pods\n- random-max-percent: up to N%\n\n**Warning:** mode: all without namespace can affect system pods!'
    },
    {
      front: 'How does NetworkChaos work?',
      back: '**Available actions:**\n- delay: latency (ms) + jitter + correlation\n- loss: packet loss (%)\n- corruption: packet corruption\n- partition: total isolation\n- bandwidth: bandwidth limit\n\n**Direction:**\n- to: traffic leaving the pod\n- from: traffic arriving at the pod\n- both: bidirectional\n\n**Target:**\n- Selector for the DESTINATION\n- Allows chaos BETWEEN two services\n\n**Example:**\nfrontend → 200ms delay → backend\n\n**Uses tc (traffic control) in the kernel** via chaos-daemon.'
    },
    {
      front: 'How to orchestrate multiple chaos with Workflow?',
      back: '**Template types:**\n\n1. **Serial:** Sequential\n   - Runs one after another\n   - Waits for each to finish\n\n2. **Parallel:** Simultaneous\n   - Runs all at the same time\n   - Tests combined failures\n\n3. **Suspend:** Pause\n   - Waits X time between steps\n   - Recovery time\n\n**Workflow example:**\n\`\`\`\npod-kill → [pause 30s] → network delay\n                         → CPU stress (parallel)\n\`\`\`\n\n**Each step has a deadline:** maximum time to complete.\n\n**Advantage:** Simulate realistic scenarios with multiple failures.'
    },
    {
      front: 'What are the Chaos Mesh components?',
      back: '**1. chaos-controller-manager:**\n- Deployment\n- Controls CRDs\n- Orchestrates experiments\n- Reconciles state\n\n**2. chaos-daemon:**\n- Privileged DaemonSet\n- 1 per node\n- Injects faults into containers\n- Container runtime access\n- Manipulates network, I/O, processes\n\n**3. chaos-dashboard:**\n- Web interface\n- Create/monitor chaos\n- View state\n- Integrated RBAC\n\n**Requirements:**\n- chaos-daemon needs privileged\n- containerd/docker socket access\n- RBAC for chaos-mesh.org API group'
    },
    {
      front: 'Chaos Mesh vs LitmusChaos — when to use each?',
      back: '**Chaos Mesh:**\n- More fault types (IO, Time, JVM, Kernel)\n- Integrated web dashboard\n- chaos-daemon for direct injection\n- Better for infra failures\n- CNCF Incubating\n\n**LitmusChaos:**\n- Integrated probes (HTTP, Prometheus, K8s)\n- ChaosHub with ready experiments\n- ChaosResult with Pass/Fail verdict\n- Better for automatic validation\n- CNCF Graduated\n- Workflows with Argo\n\n**Choose Chaos Mesh if:** you need IOChaos, TimeChaos, JVMChaos, KernelChaos.\n\n**Choose LitmusChaos if:** you need automatic probes and CI/CD integration with Pass/Fail.'
    },
    {
      front: 'How to install and configure Chaos Mesh RBAC?',
      back: '**Installation (Helm):**\n\`\`\`bash\nhelm install chaos-mesh \\\\\n  chaos-mesh/chaos-mesh \\\\\n  --namespace chaos-mesh \\\\\n  --create-namespace \\\\\n  --set chaosDaemon.runtime=containerd \\\\\n  --set chaosDaemon.socketPath=\n    /run/containerd/containerd.sock\n\`\`\`\n\n**RBAC:**\n- apiGroup: chaos-mesh.org\n- Resources: podchaos, networkchaos, etc\n- Verbs: create, delete, get, list\n\n**Security:**\n- Restrict by namespace (Role)\n- Restrict by chaos type\n- Dashboard with securityMode=true\n- Annotations for opt-in'
    }
  ],
  lab: {
    scenario: 'You need to configure Chaos Mesh to run resilience experiments including pod kill, network delay, and an orchestrated workflow.',
    objective: 'Learn how to install Chaos Mesh, create experiments with different CRDs, and orchestrate complex scenarios.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Install Chaos Mesh and create PodChaos',
        instruction: `Install Chaos Mesh and create a PodChaos experiment:
1. Install Chaos Mesh via Helm in the chaos-mesh namespace (containerd runtime)
2. Create a Deployment "web-app" with 3 replicas and label app=web-app
3. Create PodChaos that kills 1 random pod every 30 seconds for 2 minutes
4. Verify the Deployment recovers automatically`,
        hints: [
          'Use --set chaosDaemon.runtime=containerd during installation',
          'PodChaos with action: pod-kill and mode: one',
          'Duration defines the total experiment time'
        ],
        solution: `\`\`\`bash
# Install Chaos Mesh
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm install chaos-mesh chaos-mesh/chaos-mesh \\
  --namespace chaos-mesh \\
  --create-namespace \\
  --set chaosDaemon.runtime=containerd \\
  --set chaosDaemon.socketPath=/run/containerd/containerd.sock \\
  --set dashboard.securityMode=false

# Verify installation
kubectl get pods -n chaos-mesh
\`\`\`

\`\`\`yaml
# web-app.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: nginx
          image: nginx:1.25
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
---
# pod-kill.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: web-app-pod-kill
  namespace: default
spec:
  action: pod-kill
  mode: one
  selector:
    namespaces:
      - default
    labelSelectors:
      app: web-app
  duration: "120s"
  gracePeriod: 0
\`\`\`

\`\`\`bash
kubectl apply -f web-app.yaml
kubectl wait --for=condition=available deployment/web-app --timeout=60s
kubectl apply -f pod-kill.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify Chaos Mesh installed
kubectl get pods -n chaos-mesh
# Expected output: controller-manager, daemon (1 per node), dashboard Running

# Verify PodChaos created
kubectl get podchaos -n default
# Expected output: web-app-pod-kill

# Verify pods are being affected
kubectl get pods -l app=web-app -w
# Expected output: pods being terminated and recreated

# Verify events
kubectl get events -n default --sort-by='.lastTimestamp' | grep -i "kill\\|delete" | tail -5
# Expected output: pod kill events

# Verify deployment recovers
kubectl get deployment web-app
# Expected output: 3/3 READY (after recovery)
\`\`\``
      },
      {
        title: 'Create NetworkChaos with latency and partition',
        instruction: `Create network experiments:
1. NetworkChaos with 200ms latency and 50ms jitter on app=web-app pods with direction "to"
2. Duration of 60 seconds
3. Verify latency impact between pods`,
        hints: [
          'action: delay to inject latency',
          'jitter adds random variation to latency',
          'direction: to affects traffic leaving the pod'
        ],
        solution: `\`\`\`yaml
# network-delay.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: web-app-network-delay
  namespace: default
spec:
  action: delay
  mode: all
  selector:
    namespaces:
      - default
    labelSelectors:
      app: web-app
  delay:
    latency: "200ms"
    jitter: "50ms"
    correlation: "25"
  direction: to
  duration: "60s"
\`\`\`

\`\`\`bash
# Remove previous chaos if still active
kubectl delete podchaos web-app-pod-kill -n default --ignore-not-found

# Apply network delay
kubectl apply -f network-delay.yaml

# Test latency from inside the cluster
kubectl run test-curl --image=curlimages/curl --rm -it -- \\
  sh -c 'for i in 1 2 3 4 5; do time curl -s -o /dev/null http://web-app.default; done'
\`\`\``,
        verify: `\`\`\`bash
# Verify NetworkChaos created
kubectl get networkchaos -n default
# Expected output: web-app-network-delay

# Verify status
kubectl describe networkchaos web-app-network-delay -n default | grep -A5 "Status:"
# Expected output: status showing active chaos

# Verify latency is being injected (after 60s, chaos expires)
kubectl get networkchaos web-app-network-delay -n default -o jsonpath='{.status.conditions}'
# Expected output: conditions showing chaos state
\`\`\``
      },
      {
        title: 'Create serial Workflow with multiple chaos types',
        instruction: `Create a Workflow that orchestrates chaos in sequence:
1. Step 1: PodChaos pod-kill of 1 pod (30s)
2. Step 2: Suspend (30s pause for recovery)
3. Step 3: NetworkChaos delay of 200ms (60s)
4. Step 4: StressChaos CPU 80% with 2 workers (60s)
5. All steps must have a deadline`,
        hints: [
          'Workflow uses templateType: Serial for sequential',
          'Each step is a template with a specific type',
          'Suspend with deadline defines the pause time'
        ],
        solution: `\`\`\`yaml
# chaos-workflow.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: Workflow
metadata:
  name: resilience-workflow
  namespace: default
spec:
  entry: full-test
  templates:
    - name: full-test
      templateType: Serial
      children:
        - pod-kill-step
        - recovery-pause
        - network-delay-step
        - cpu-stress-step

    - name: pod-kill-step
      templateType: PodChaos
      deadline: "1m"
      podChaos:
        action: pod-kill
        mode: one
        selector:
          namespaces:
            - default
          labelSelectors:
            app: web-app

    - name: recovery-pause
      templateType: Suspend
      deadline: "30s"

    - name: network-delay-step
      templateType: NetworkChaos
      deadline: "2m"
      networkChaos:
        action: delay
        mode: all
        selector:
          namespaces:
            - default
          labelSelectors:
            app: web-app
        delay:
          latency: "200ms"
          jitter: "50ms"
        duration: "60s"

    - name: cpu-stress-step
      templateType: StressChaos
      deadline: "2m"
      stressChaos:
        mode: one
        selector:
          namespaces:
            - default
          labelSelectors:
            app: web-app
        stressors:
          cpu:
            workers: 2
            load: 80
        duration: "60s"
\`\`\`

\`\`\`bash
# Remove previous chaos
kubectl delete networkchaos web-app-network-delay -n default --ignore-not-found

# Apply workflow
kubectl apply -f chaos-workflow.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify Workflow created
kubectl get workflow -n default
# Expected output: resilience-workflow

# Verify workflow status
kubectl describe workflow resilience-workflow -n default | grep -A10 "Status:"
# Expected output: nodes showing step progress

# Verify workflow is progressing
kubectl get workflow resilience-workflow -n default -o jsonpath='{.status.conditions}'
# Expected output: conditions showing state

# After completion, verify app recovered
kubectl get deployment web-app
# Expected output: 3/3 READY
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'chaos-daemon cannot inject faults',
      difficulty: 'medium',
      symptom: 'The chaos CRD is created but no fault is injected. Target pods are not affected.',
      diagnosis: `\`\`\`bash
# 1. Check if chaos-daemon is running on all nodes
kubectl get pods -n chaos-mesh -l app.kubernetes.io/component=chaos-daemon -o wide
# Should have 1 per node

# 2. Check chaos-daemon logs
kubectl logs -n chaos-mesh -l app.kubernetes.io/component=chaos-daemon --tail=20

# 3. Check if daemon has container runtime access
kubectl get pods -n chaos-mesh -l app.kubernetes.io/component=chaos-daemon -o yaml | grep -A3 "socketPath"

# 4. Check if daemon is privileged
kubectl get pods -n chaos-mesh -l app.kubernetes.io/component=chaos-daemon -o yaml | grep privileged

# 5. Check controller-manager logs
kubectl logs -n chaos-mesh -l app.kubernetes.io/component=controller-manager --tail=20
\`\`\``,
      solution: `**Causes and solutions:**

1. **Incorrect runtime:** During installation, correctly specify the runtime: --set chaosDaemon.runtime=containerd (or docker). And the corresponding socket path.

2. **No privileged access:** chaos-daemon needs securityContext.privileged: true to manipulate network namespaces and processes. Check PSP/PSA.

3. **Wrong socket path:** The container runtime socket must be mounted correctly. containerd: /run/containerd/containerd.sock, docker: /var/run/docker.sock.

4. **Daemon not on all nodes:** Check DaemonSet tolerations. If nodes have taints, the daemon may not be scheduled.

5. **Firewall/SecurityPolicy:** Check if PodSecurityPolicy, PodSecurityAdmission, or OPA/Gatekeeper are blocking the privileged daemon.`
    },
    {
      title: 'NetworkChaos affects pods that should not be affected',
      difficulty: 'hard',
      symptom: 'After applying NetworkChaos, non-selected services also suffer latency or packet loss.',
      diagnosis: `\`\`\`bash
# 1. Check NetworkChaos selector
kubectl get networkchaos -n default -o yaml | grep -A10 selector

# 2. Check which pods match the selector
kubectl get pods -n default -l app=my-app
# Verify only expected pods are listed

# 3. Check direction and target
kubectl get networkchaos -n default -o yaml | grep -A10 "direction\\|target"

# 4. Check if multiple chaos are active
kubectl get podchaos,networkchaos,stresschaos -n default

# 5. Check daemon logs for affected pods
kubectl logs -n chaos-mesh -l app.kubernetes.io/component=chaos-daemon | grep "inject\\|apply" | tail -20
\`\`\``,
      solution: `**Causes and solutions:**

1. **Selector too broad:** Verify labelSelectors and namespaces are specific enough. Without namespace, it can affect pods in all namespaces.

2. **Mode all without target:** With mode: all and no target selector, chaos affects ALL traffic from selected pods, including to internal K8s services (CoreDNS, API server).

3. **Wrong direction:** "to" affects traffic leaving the pod (can affect communication with any service). Use target selector to limit the affected destination.

4. **Residual chaos:** Check if other active chaos experiments are interfering. Use kubectl get with all chaos types.

5. **Residual tc rules:** In rare cases, tc (traffic control) rules may remain after chaos ends. Restart the chaos-daemon on the affected node.`
    },
    {
      title: 'Workflow does not progress after the first step',
      difficulty: 'medium',
      symptom: 'The Workflow executes the first step but stays stuck and does not advance to the next steps.',
      diagnosis: `\`\`\`bash
# 1. Check Workflow status
kubectl describe workflow my-workflow -n default | grep -A20 "Status:"

# 2. Check if current step has a deadline
kubectl get workflow my-workflow -n default -o yaml | grep deadline

# 3. Check if current step chaos has finished
kubectl get podchaos,networkchaos,stresschaos -n default

# 4. Check controller logs
kubectl logs -n chaos-mesh -l app.kubernetes.io/component=controller-manager | grep workflow | tail -20

# 5. Check for errors in current step
kubectl get events -n default | grep workflow | tail -10
\`\`\``,
      solution: `**Causes and solutions:**

1. **No deadline on step:** Each workflow step needs a deadline. Without it, the controller does not know when to consider the step complete and move to the next one.

2. **Duration longer than deadline:** If the chaos duration (e.g., 120s) is longer than the step deadline (e.g., 60s), the step expires before chaos finishes. Ensure deadline > duration.

3. **Error in step chaos:** If the step's chaos CRD fails (RBAC, invalid selector), the workflow gets stuck. Check events and logs for the specific chaos type.

4. **Overloaded controller-manager:** If many workflows/chaos are running simultaneously, the controller may be slow to reconcile. Check controller-manager resources.

5. **Serial vs Parallel:** Verify templateType is correct. Serial runs one at a time (waits to finish). Parallel runs simultaneously.`
    }
  ]
};
