window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-microservice-vuln/runtime-sandboxing'] = {
  theory: `# Runtime Sandboxing (gVisor & Kata Containers)

## Exam Relevance
> CKS expects you to understand RuntimeClass, configure gVisor/Kata, and know when to use sandboxed runtimes. Appears in Minimize Microservice Vulnerabilities domain (~8%).

## Why Runtime Sandboxing?

Standard containers share the host kernel. If an attacker escapes the container, they access the host OS directly.

\`\`\`
Standard Containers:
Pod → Container Runtime (containerd) → Host Linux Kernel
                                             ↑
                             (shared — kernel exploit = full compromise)

Sandboxed Containers:
Pod → Container Runtime → Sandbox (gVisor/Kata) → Host Linux Kernel
                              ↑
              (intercepted — kernel syscalls blocked/filtered)
\`\`\`

## gVisor (runsc)

**gVisor** is a user-space kernel developed by Google. It implements Linux system calls in Go, intercepting container syscalls before they reach the host kernel.

\`\`\`
Container syscall → gVisor (Sentry/Gofer) → limited host kernel access
                    (user-space kernel)
\`\`\`

**Pros:**
- Strong isolation — syscalls intercepted in user space
- Low overhead compared to VMs
- Supports most Linux applications
- Default in Google Cloud Run

**Cons:**
- Incompatible with some syscalls/features
- Slightly higher latency
- Not all container features work (e.g., some /proc paths)

## Kata Containers

**Kata Containers** run each container (or pod) in a lightweight virtual machine with its own kernel.

\`\`\`
Container → Kata runtime → Guest VM (lightweight kernel) → Host hypervisor → Host kernel
                                (hardware virtualization)
\`\`\`

**Pros:**
- Full hardware-level isolation
- Each pod has its own kernel
- Compatible with all Linux features

**Cons:**
- Higher resource overhead (separate kernel per pod)
- Longer startup time
- Requires hardware virtualization support

## RuntimeClass

Kubernetes **RuntimeClass** is the API to select which container runtime a pod uses:

\`\`\`yaml
# 1. Create a RuntimeClass
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor              # referenced by pods
handler: runsc              # name of the OCI runtime on the node

---
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: kata-containers
handler: kata-qemu           # or kata-fc (Firecracker), kata-clh (Cloud Hypervisor)

---
# 2. Use in a Pod
apiVersion: v1
kind: Pod
spec:
  runtimeClassName: gvisor   # must match RuntimeClass.metadata.name
  containers:
  - name: app
    image: nginx
\`\`\`

## Node-Level Setup

For gVisor, the node must have the \`runsc\` binary installed and containerd configured:

\`\`\`bash
# Install gVisor on the node
curl -fsSL https://gvisor.dev/archive.key | sudo gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" | sudo tee /etc/apt/sources.list.d/gvisor.list
sudo apt-get update && sudo apt-get install -y runsc

# Configure containerd (/etc/containerd/config.toml)
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc]
  runtime_type = "io.containerd.runsc.v1"

# Restart containerd
sudo systemctl restart containerd
\`\`\`

For Kata Containers:
\`\`\`bash
# Install Kata
sudo apt-get install kata-containers

# Configure containerd for Kata
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.kata-qemu]
  runtime_type = "io.containerd.kata.v2"

# Restart containerd
sudo systemctl restart containerd
\`\`\`

## RuntimeClass with Scheduling

Target specific nodes that have the sandbox runtime installed:

\`\`\`yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
scheduling:
  nodeSelector:
    runtime: gvisor           # only schedule on nodes with this label
  tolerations:
  - key: runtime
    operator: Equal
    value: gvisor
    effect: NoSchedule
\`\`\`

\`\`\`bash
# Label nodes that have gVisor installed
kubectl label node worker-1 runtime=gvisor
\`\`\`

## Verifying the Runtime

\`\`\`bash
# Check which runtime a pod is using
kubectl get pod <name> -o yaml | grep runtimeClassName

# Verify inside the pod (gVisor shows different dmesg)
kubectl exec <pod> -- dmesg | head -5
# gVisor shows: [    0.000000] Starting gVisor...

# Check container runtime on the node
# (as node admin)
sudo crictl info | grep runtimeType
sudo crictl inspect <container-id> | grep "runtimeType\|ociVersion"

# Compare kernel versions
# Regular pod:
kubectl exec regular-pod -- uname -r
# Output: 5.15.0-76-generic (host kernel)

# gVisor pod:
kubectl exec gvisor-pod -- uname -r
# Output: 4.4.0 (gVisor virtual kernel)
\`\`\`

## Use Cases

| Scenario | Recommended Runtime |
|----------|-------------------|
| Multi-tenant cluster | gVisor or Kata |
| Untrusted code execution | gVisor or Kata |
| High-performance workloads | Standard (runc) |
| Legacy apps with complex syscalls | Kata (better compat) |
| Cloud-native apps | gVisor (lower overhead) |
| CI/CD runners | gVisor (isolation from each other) |
| Compliance: strict isolation | Kata (VM-level guarantee) |

## OPA/Kyverno Policy for RuntimeClass

Enforce that specific namespaces must use a sandboxed runtime:

\`\`\`yaml
# Kyverno policy
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-sandboxed-runtime
spec:
  validationFailureAction: Enforce
  rules:
  - name: check-runtime-class
    match:
      any:
      - resources:
          kinds: ["Pod"]
          namespaces: ["untrusted"]
    validate:
      message: "Pods in 'untrusted' namespace must use sandboxed runtime (gvisor or kata)"
      pattern:
        spec:
          runtimeClassName: "gvisor | kata-containers"
\`\`\`

## Comparison Table

| Feature | runc (standard) | gVisor | Kata Containers |
|---------|----------------|--------|----------------|
| Isolation | Namespace/cgroup | User-space kernel | VM per pod |
| Syscall interception | No | Yes (all) | VM boundary |
| Performance overhead | Minimal | Low (~10%) | Medium (~15-20%) |
| Compatibility | Full | ~90% | ~98% |
| Hardware requirement | None | None | VT-x/AMD-V |
| K8s native | Yes | Yes (RuntimeClass) | Yes (RuntimeClass) |

## Common Mistakes

- **RuntimeClass handler must match containerd config**: The handler name must exactly match the runtime configuration in containerd
- **Not checking node compatibility**: Pods with runtimeClassName fail to schedule if no node has the handler configured
- **Expecting 100% compatibility with gVisor**: Some syscalls are not implemented — test before deploying production workloads
- **Missing scheduling rules**: Without nodeSelector, pods may schedule on nodes without the runtime

## Killer.sh Style Challenge

> **Scenario**: Create a RuntimeClass named "safe" that uses gVisor (handler: runsc). Update the Deployment "webapp" in namespace "sandbox" to use this RuntimeClass.
`,

  quiz: [
    {
      question: 'What is the main security benefit of using gVisor for containers?',
      options: [
        'Container syscalls are intercepted by gVisor\'s user-space kernel before reaching the host kernel, reducing attack surface',
        'gVisor encrypts all container network traffic automatically',
        'gVisor prevents containers from using more CPU than their limits',
        'gVisor scans container images for vulnerabilities at runtime'
      ],
      correct: 0,
      explanation: 'gVisor implements a user-space kernel (Sentry) that intercepts Linux syscalls from containers. Instead of syscalls going directly to the host kernel, gVisor evaluates and filters them. This means a kernel exploit in the container is contained within gVisor.',
      reference: 'Runtime Sandboxing — gVisor section.'
    },
    {
      question: 'What Kubernetes resource do you create to make a pod use gVisor?',
      options: [
        'RuntimeClass (node.k8s.io/v1) with handler: runsc, then set spec.runtimeClassName in the Pod',
        'SecurityContext with runtimeProfile: gvisor in the Pod spec',
        'A ConfigMap in kube-system with runtime selection rules',
        'A NodeSelector label with runtime=gvisor on the Pod'
      ],
      correct: 0,
      explanation: 'RuntimeClass is the Kubernetes API for selecting a container runtime. You create a RuntimeClass with the handler pointing to the runtime binary (runsc for gVisor), then reference it in Pod.spec.runtimeClassName.',
      reference: 'Runtime Sandboxing — RuntimeClass section.'
    },
    {
      question: 'What is the key difference between gVisor and Kata Containers isolation?',
      options: [
        'gVisor intercepts syscalls in user space; Kata runs each pod in a separate lightweight VM with its own kernel',
        'gVisor uses eBPF filters; Kata uses seccomp profiles',
        'gVisor runs on ARM only; Kata runs on x86 only',
        'gVisor provides network isolation; Kata provides filesystem isolation'
      ],
      correct: 0,
      explanation: 'gVisor implements a user-space kernel that intercepts syscalls — no separate VM needed. Kata Containers use hardware virtualization to run each pod in a lightweight VM (QEMU, Firecracker) with a dedicated Linux kernel, providing VM-level isolation.',
      reference: 'Runtime Sandboxing — Comparison Table.'
    },
    {
      question: 'A RuntimeClass is created with handler: kata-qemu. What must be configured on the worker nodes?',
      options: [
        'containerd must have a runtime configuration for kata-qemu and the Kata Containers binaries must be installed',
        'Only the RuntimeClass CRD needs to exist — Kubernetes handles runtime selection automatically',
        'Each worker node needs a kube-bench configuration for Kata',
        'A DaemonSet must deploy Kata agents on each node'
      ],
      correct: 0,
      explanation: 'The RuntimeClass handler name must match a runtime configured in containerd\'s config.toml. The corresponding runtime binary (e.g., kata-qemu) must also be installed on the node. Without this, pods using the RuntimeClass will fail to start.',
      reference: 'Runtime Sandboxing — Node-Level Setup section.'
    },
    {
      question: 'How do you verify that a running pod is actually using gVisor instead of runc?',
      options: [
        'kubectl exec into the pod and run "dmesg | head" — gVisor shows "Starting gVisor..." in kernel messages',
        'kubectl describe pod shows "Runtime: gVisor" in the annotations',
        'kubectl get pod -o yaml shows runtimeClass.status: active',
        'Check the node\'s /proc/1/status for the runtime indicator'
      ],
      correct: 0,
      explanation: 'Inside a gVisor pod, dmesg shows the gVisor virtual kernel messages ("Starting gVisor..."). You can also check uname -r — gVisor reports an older kernel version (4.4.0) from its virtual kernel, different from the host kernel version.',
      reference: 'Runtime Sandboxing — Verifying the Runtime section.'
    },
    {
      question: 'Why should RuntimeClass include scheduling.nodeSelector?',
      options: [
        'To ensure pods only schedule on nodes where the required runtime binary is installed',
        'To improve performance by placing gVisor pods on high-memory nodes',
        'To comply with network security policies for sandboxed workloads',
        'To prevent multiple RuntimeClasses from conflicting on the same node'
      ],
      correct: 0,
      explanation: 'If a pod uses runtimeClassName: gvisor but is scheduled on a node without gVisor installed, the pod fails to start. The RuntimeClass scheduling.nodeSelector ensures pods are only placed on nodes that have the corresponding runtime installed.',
      reference: 'Runtime Sandboxing — RuntimeClass with Scheduling section.'
    },
    {
      question: 'Which scenario is most appropriate for using Kata Containers over gVisor?',
      options: [
        'Running legacy applications that use complex or unusual syscalls that gVisor doesn\'t support',
        'Running lightweight, stateless microservices that start frequently',
        'Running applications in the kube-system namespace',
        'Running applications that need maximum network bandwidth'
      ],
      correct: 0,
      explanation: 'Kata Containers have ~98% Linux syscall compatibility because they use a real Linux kernel in a VM. gVisor implements about 90% of syscalls. For legacy apps with complex syscall usage (database engines, low-level network tools), Kata is more compatible.',
      reference: 'Runtime Sandboxing — Use Cases table.'
    },
    {
      question: 'What does the "handler" field in a RuntimeClass specify?',
      options: [
        'The name of the OCI runtime as configured in containerd — must match the containerd runtime configuration key',
        'The Kubernetes node where the runtime is installed',
        'The Docker image used to run the sandbox environment',
        'The namespace where the runtime operator is deployed'
      ],
      correct: 0,
      explanation: 'The handler field maps to a runtime name in containerd\'s config.toml. For example, handler: runsc means containerd must have [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc] configured. The names must match exactly.',
      reference: 'Runtime Sandboxing — RuntimeClass section.'
    }
  ],

  flashcards: [
    {
      front: 'What are gVisor and Kata Containers and how do they improve security?',
      back: 'gVisor (runsc):\n- User-space kernel written in Go\n- Intercepts ALL container syscalls\n- Attack: can\'t directly exploit host kernel\n- Low overhead, ~90% syscall compat\n\nKata Containers:\n- Lightweight VM per pod (QEMU/Firecracker)\n- Each pod has own Linux kernel\n- Hardware-level isolation\n- Higher overhead, ~98% compat, needs VT-x\n\nBoth: container syscall → sandbox → (filtered) → host kernel'
    },
    {
      front: 'How do you create a RuntimeClass and use it in a Pod?',
      back: '# Create RuntimeClass:\napiVersion: node.k8s.io/v1\nkind: RuntimeClass\nmetadata:\n  name: gvisor\nhandler: runsc      # must match containerd config\n\n# Use in Pod:\nspec:\n  runtimeClassName: gvisor  # references RuntimeClass.metadata.name\n  containers:\n  - name: app\n    image: nginx\n\n# Verify:\nkubectl get pod <name> -o yaml | grep runtimeClassName'
    },
    {
      front: 'How do you verify a pod is running under gVisor?',
      back: '# Check runtimeClassName in pod spec:\nkubectl get pod <name> -o yaml | grep runtimeClassName\n# Expected: runtimeClassName: gvisor\n\n# Check from inside the pod:\nkubectl exec <pod> -- uname -r\n# gVisor: returns "4.4.0" (virtual kernel)\n# runc: returns host kernel version (e.g., "5.15.0")\n\nkubectl exec <pod> -- dmesg | head -3\n# gVisor: "Starting gVisor..." in output'
    },
    {
      front: 'What does a RuntimeClass scheduling section do?',
      back: 'Ensures pods using this RuntimeClass only schedule on nodes with the runtime installed.\n\napiVersion: node.k8s.io/v1\nkind: RuntimeClass\nmetadata:\n  name: gvisor\nhandler: runsc\nscheduling:\n  nodeSelector:\n    runtime: gvisor     # only nodes with this label\n  tolerations:          # if nodes are tainted\n  - key: runtime\n    value: gvisor\n    effect: NoSchedule\n\n# Label the node:\nkubectl label node worker-1 runtime=gvisor'
    },
    {
      front: 'What must be configured on a node to support a RuntimeClass handler "runsc"?',
      back: '1. Install gVisor binary:\n   apt-get install runsc\n\n2. Configure containerd (/etc/containerd/config.toml):\n   [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc]\n     runtime_type = "io.containerd.runsc.v1"\n\n3. Restart containerd:\n   systemctl restart containerd\n\n4. Label the node for RuntimeClass scheduling:\n   kubectl label node <node> runtime=gvisor\n\nIf handler is "kata-qemu", install kata-containers and configure similarly.'
    },
    {
      front: 'What are the trade-offs between gVisor and Kata Containers?',
      back: '           gVisor        Kata Containers\nIsolation  User-space   VM (hardware)\nCompatibility ~90%       ~98%\nOverhead   ~10%         ~15-20%\nStartup    Fast         Slower (VM boot)\nHW req     None         VT-x/AMD-V\nUsed by    GCloud Run   OpenStack, IBM Cloud\n\nChoose gVisor: cloud-native apps, low overhead needed\nChoose Kata: legacy apps, strict compliance, full compat'
    }
  ],

  lab: {
    scenario: 'The security team requires all pods in the "sandbox" namespace to use gVisor for stronger isolation. Set up the RuntimeClass and configure a Deployment to use it.',
    objective: 'Create a RuntimeClass for gVisor, configure namespace-level default, and verify pod isolation.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create the RuntimeClass',
        instruction: `Define a RuntimeClass for gVisor (assuming gVisor is installed on the nodes).

\`\`\`bash
# Create the RuntimeClass
cat <<EOF | kubectl apply -f -
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
EOF

# For an environment WITHOUT gVisor, create a test RuntimeClass
# using the default runtime (for practice purposes):
cat <<EOF | kubectl apply -f -
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: sandbox
handler: runc
EOF

# List RuntimeClasses
kubectl get runtimeclass
\`\`\``,
        hints: [
          'In the CKS exam, gVisor will already be installed on the cluster nodes',
          'For practice without gVisor, use handler: runc (default runtime) to test the RuntimeClass mechanics',
          'The RuntimeClass is a cluster-scoped resource — no namespace needed'
        ],
        solution: `\`\`\`bash
cat <<'EOF' | kubectl apply -f -
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
EOF
kubectl get runtimeclass
\`\`\``,
        verify: `\`\`\`bash
kubectl get runtimeclass gvisor
# Expected: gvisor   runsc   <time>

kubectl get runtimeclass gvisor -o yaml | grep handler
# Expected: handler: runsc
\`\`\``
      },
      {
        title: 'Deploy a sandboxed application',
        instruction: `Create a Deployment that uses the gVisor RuntimeClass.

\`\`\`yaml
# sandbox-app.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sandboxed-app
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sandboxed-app
  template:
    metadata:
      labels:
        app: sandboxed-app
    spec:
      runtimeClassName: gvisor    # use gVisor runtime
      containers:
      - name: app
        image: nginx:alpine
        resources:
          limits:
            cpu: "100m"
            memory: "64Mi"
\`\`\`

\`\`\`bash
kubectl apply -f sandbox-app.yaml
kubectl rollout status deployment/sandboxed-app
\`\`\``,
        hints: [
          'If the pod fails with "runtimeclass not found", verify the RuntimeClass exists',
          'If the pod fails with "failed to create containerd task", gVisor is not installed on the node'
        ],
        solution: `\`\`\`bash
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sandboxed-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sandboxed-app
  template:
    metadata:
      labels:
        app: sandboxed-app
    spec:
      runtimeClassName: gvisor
      containers:
      - name: app
        image: nginx:alpine
EOF
kubectl rollout status deployment/sandboxed-app --timeout=60s
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -l app=sandboxed-app
# Expected: sandboxed-app-xxx   1/1   Running

# Verify the runtimeClassName is set
kubectl get pod -l app=sandboxed-app -o yaml | grep runtimeClassName
# Expected: runtimeClassName: gvisor

# If gVisor is installed, verify isolation:
POD=$(kubectl get pods -l app=sandboxed-app -o jsonpath='{.items[0].metadata.name}')
kubectl exec $POD -- uname -r 2>&1
# With real gVisor: shows gVisor kernel version (not host kernel)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod fails to schedule with "RuntimeClass not found"',
      difficulty: 'easy',
      symptom: 'A Pod with spec.runtimeClassName: gvisor fails with event "RuntimeClass gvisor not found".',
      diagnosis: `\`\`\`bash
# Check if the RuntimeClass exists
kubectl get runtimeclass

# Check exact name (case-sensitive)
kubectl get runtimeclass gvisor -o yaml

# Check pod events
kubectl describe pod <pod-name> | grep -A5 Events
\`\`\``,
      solution: `**The RuntimeClass must exist before pods reference it.**

\`\`\`bash
# Create the RuntimeClass
cat <<EOF | kubectl apply -f -
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor      # must EXACTLY match pod's runtimeClassName
handler: runsc
EOF

# Verify spelling (case-sensitive, must match exactly)
kubectl get runtimeclass
\`\`\`

If the pod is stuck, delete and recreate it after creating the RuntimeClass:
\`\`\`bash
kubectl rollout restart deployment <deployment-name>
\`\`\``
    },
    {
      title: 'Pod scheduled but stuck in ContainerCreating with "failed to create containerd task"',
      difficulty: 'hard',
      symptom: 'Pod using RuntimeClass gvisor is scheduled but stays in ContainerCreating. describe shows "failed to create containerd task: failed to create shim: OCI runtime create failed: runc: invalid argument".',
      diagnosis: `\`\`\`bash
# Check pod events
kubectl describe pod <pod-name> | grep -A20 Events

# SSH to the node where pod is scheduled
kubectl get pod <pod-name> -o wide  # get node name

# On the node:
# Check if runsc is installed
which runsc 2>&1
runsc version 2>&1

# Check containerd config for runsc
sudo cat /etc/containerd/config.toml | grep -A5 runsc

# Check containerd logs
sudo journalctl -u containerd -n 50 | grep -i "runsc\|gvisor\|error"
\`\`\``,
      solution: `**gVisor (runsc) is not properly installed on the node.**

\`\`\`bash
# Install runsc on the node
sudo apt-get install -y runsc
# OR: wget and install binary from gvisor.dev

# Configure containerd to use runsc
sudo tee -a /etc/containerd/config.toml <<EOF

[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc]
  runtime_type = "io.containerd.runsc.v1"
EOF

sudo systemctl restart containerd

# Verify
sudo crictl info | grep -A3 runsc
\`\`\`

**If gVisor can't be installed on that node**, add a nodeSelector to the RuntimeClass:
\`\`\`yaml
scheduling:
  nodeSelector:
    runtime: gvisor
\`\`\`
And label only nodes that have gVisor: kubectl label node <node> runtime=gvisor`
    }
  ]
};
