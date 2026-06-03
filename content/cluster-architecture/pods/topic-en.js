window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cluster-architecture/pods'] = {
  theory: `# Pods

## Exam Relevance
> CKA — Cluster Architecture (25%). Pods are the fundamental unit of Kubernetes. You need to master creating, inspecting, debugging, and managing pods via both imperative commands and declarative YAML.

## What is a Pod?

A Pod is the smallest deployable unit in Kubernetes. It wraps one or more containers that share the same network namespace, storage volumes, and lifecycle.

\`\`\`
Pod
├── Container A (app)       ← shares network + storage
├── Container B (sidecar)   ← same IP, can use localhost
└── Volumes                 ← shared between containers
\`\`\`

**Key concepts:**
- **Shared network**: all containers in a pod share the same IP and port space. They communicate via \`localhost\`.
- **Shared storage**: volumes mounted in a pod are accessible by all containers.
- **Shared lifecycle**: if the pod restarts, all containers restart together.

## Essential Commands

\`\`\`bash
# Create a pod imperatively (fast — use this in the exam!)
kubectl run nginx --image=nginx:alpine
kubectl run busybox --image=busybox --restart=Never -- sleep 3600

# Create with labels
kubectl run nginx --image=nginx --labels="app=web,env=prod"

# Create interactively (delete after command)
kubectl run tmp --image=busybox -it --rm --restart=Never -- sh

# Get pod details
kubectl get pods
kubectl get pods -o wide          # show node and IP
kubectl get pods -A               # all namespaces
kubectl describe pod <name>       # events, status, containers

# Access logs
kubectl logs <pod>
kubectl logs <pod> -c <container> # specific container
kubectl logs <pod> --previous     # previous container restart

# Execute commands inside pod
kubectl exec -it <pod> -- bash
kubectl exec -it <pod> -c <container> -- sh  # specific container

# Delete a pod
kubectl delete pod <pod>
kubectl delete pod <pod> --grace-period=0 --force  # immediate

# Generate YAML without creating
kubectl run nginx --image=nginx --dry-run=client -o yaml > pod.yaml
\`\`\`

## Pod YAML Structure

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
  namespace: default
  labels:
    app: my-app
    tier: frontend
spec:
  containers:
  - name: app
    image: nginx:1.25
    ports:
    - containerPort: 80
    env:
    - name: ENV_VAR
      value: "production"
    resources:
      requests:
        memory: "64Mi"
        cpu: "250m"
      limits:
        memory: "128Mi"
        cpu: "500m"
    livenessProbe:
      httpGet:
        path: /healthz
        port: 80
      initialDelaySeconds: 3
      periodSeconds: 10
  restartPolicy: Always  # Always | OnFailure | Never
\`\`\`

## Pod Lifecycle & Phases

| Phase | Description |
|-------|-------------|
| **Pending** | Pod accepted, but containers not yet running (scheduling, image pull) |
| **Running** | At least one container running |
| **Succeeded** | All containers exited with code 0 (for Jobs) |
| **Failed** | All containers exited, at least one with non-zero code |
| **Unknown** | Pod state cannot be determined (node communication issue) |

## Container States

\`\`\`bash
kubectl get pod <name> -o jsonpath='{.status.containerStatuses[0].state}'
\`\`\`

| State | Description |
|-------|-------------|
| **Waiting** | Not yet started (ImagePullBackOff, ContainerCreating) |
| **Running** | Executing |
| **Terminated** | Finished (check exit code: 0 = success) |

## Restart Policies

| Policy | Behavior | Use case |
|--------|----------|----------|
| \`Always\` | Always restart (default) | Long-running services |
| \`OnFailure\` | Restart only on failure (exit != 0) | Batch jobs |
| \`Never\` | Never restart | One-off tasks |

## Init Containers

Init containers run to completion before app containers start. Useful for setup tasks.

\`\`\`yaml
spec:
  initContainers:
  - name: wait-for-db
    image: busybox
    command: ['sh', '-c', 'until nc -z db-service 5432; do echo waiting; sleep 2; done']
  containers:
  - name: app
    image: myapp:1.0
\`\`\`

## Static Pods

Static pods are managed directly by kubelet, not by the API server. They are defined as files in \`/etc/kubernetes/manifests/\`.

\`\`\`bash
# List static pod manifests
ls /etc/kubernetes/manifests/
# kube-apiserver.yaml  kube-controller-manager.yaml  kube-scheduler.yaml  etcd.yaml

# Static pods appear in kubectl but cannot be deleted via kubectl
# To delete: remove the YAML file from the node
\`\`\`

## Common Errors

1. **ImagePullBackOff** — wrong image name, tag, or registry credentials
2. **CrashLoopBackOff** — container starts and crashes repeatedly (check logs!)
3. **OOMKilled** — container exceeded memory limit
4. **Pending forever** — no node matches the scheduling constraints
5. **ContainerCreating** — waiting for volume attachment or image pull

## Killer.sh Style Challenge

> **Scenario**: Create a pod named \`exam-pod\` in namespace \`exam-ns\` using image \`nginx:1.25\`. The container must run as user 1000, have a memory limit of 64Mi, and expose port 8080. Verify the pod is running.
`,
  quiz: [
    {
      question: 'What is the smallest deployable unit in Kubernetes?',
      options: ['Container', 'Pod', 'Deployment', 'ReplicaSet'],
      correct: 1,
      explanation: 'A Pod is the smallest deployable unit in Kubernetes. Containers do not run independently — they are always wrapped inside a Pod. A Pod can contain one or more containers that share networking and storage.',
      reference: 'Related concept: Deployments — Pods are usually managed by higher-level resources like Deployments.'
    },
    {
      question: 'How do two containers in the same Pod communicate?',
      options: [
        'Via Kubernetes Service',
        'Via localhost — they share the same network namespace',
        'They cannot communicate directly',
        'Via a shared ConfigMap'
      ],
      correct: 1,
      explanation: 'Containers in the same Pod share a network namespace, meaning they have the same IP address and can communicate with each other via localhost. For example, if container A listens on port 8080, container B can reach it at localhost:8080.',
      reference: 'See "What is a Pod?" section — the shared network concept is fundamental for sidecar patterns.'
    },
    {
      question: 'What kubectl command creates a pod quickly without writing YAML?',
      options: [
        'kubectl create pod nginx --image=nginx',
        'kubectl run nginx --image=nginx',
        'kubectl apply pod nginx --image=nginx',
        'kubectl new pod nginx --image=nginx'
      ],
      correct: 1,
      explanation: '`kubectl run <name> --image=<image>` is the imperative command to create a pod. On the CKA exam, using imperative commands saves critical time. You can also generate YAML with: kubectl run nginx --image=nginx --dry-run=client -o yaml > pod.yaml',
      reference: 'See "Essential Commands" — `kubectl run` with `--dry-run=client -o yaml` is one of the most useful exam shortcuts.'
    },
    {
      question: 'What does the pod phase "CrashLoopBackOff" indicate?',
      options: [
        'The pod is waiting for a node to be assigned',
        'The pod cannot pull the container image',
        'The container starts and crashes repeatedly',
        'The node running the pod has lost network connectivity'
      ],
      correct: 2,
      explanation: 'CrashLoopBackOff is a container state (not technically a pod phase) indicating the container repeatedly exits immediately after starting. Kubernetes backs off retrying with increasing delays. Always use `kubectl logs <pod> --previous` to see what caused the crash.',
      reference: 'See "Common Errors" — CrashLoopBackOff vs ImagePullBackOff are the two most common errors on the exam.'
    },
    {
      question: 'A pod needs to run a setup script before the main application starts. Which feature should you use?',
      options: [
        'A sidecar container running in parallel',
        'An init container that runs to completion first',
        'A postStart lifecycle hook',
        'An emptyDir volume shared between containers'
      ],
      correct: 1,
      explanation: 'Init containers run to completion before any application containers start. They are ideal for setup tasks: waiting for a dependency, initializing data, or checking configurations. Only after all init containers complete successfully do the main containers start.',
      reference: 'See "Init Containers" — understand init containers vs sidecar containers (sidecars run in parallel with the main container).'
    },
    {
      question: 'Which restartPolicy should you use for a one-time data migration job that should not restart if it fails?',
      options: [
        'Always — always restart on failure',
        'OnFailure — restart only on non-zero exit',
        'Never — never restart',
        'OnError — restart on error (not valid)'
      ],
      correct: 2,
      explanation: 'For one-time tasks that should run exactly once and not retry, use `restartPolicy: Never`. For batch jobs where you want to retry on failure, use `OnFailure`. The default `Always` is for long-running services like web servers.',
      reference: 'See "Restart Policies" — this is frequently tested. Note that Jobs use OnFailure by default.'
    },
    {
      question: 'Where are static pod manifests stored on a kubeadm cluster?',
      options: [
        '/var/lib/kubelet/pods/',
        '/etc/kubernetes/manifests/',
        '/etc/kubernetes/pki/',
        '/usr/lib/systemd/system/kube-*.service'
      ],
      correct: 1,
      explanation: '`/etc/kubernetes/manifests/` is the default directory for static pod manifests in kubeadm clusters. The kubelet watches this directory and automatically creates/updates/deletes pods based on the YAML files there. Control plane components (kube-apiserver, etcd, etc.) run as static pods.',
      reference: 'See "Static Pods" — this is critical for the CKA exam, especially when troubleshooting control plane components.'
    }
  ],
  flashcards: [
    {
      front: 'What is a Pod in Kubernetes?',
      back: 'The smallest deployable unit in Kubernetes. Wraps one or more containers that share: the same network namespace (same IP, communicate via localhost), storage volumes, and lifecycle. Pods are ephemeral — they are created and destroyed, not repaired.'
    },
    {
      front: 'What are the 5 Pod phases?',
      back: 'Pending (not yet scheduled/running), Running (at least one container running), Succeeded (all containers exited with code 0), Failed (at least one container exited non-zero), Unknown (node communication failure). Check with: kubectl get pod <name>.'
    },
    {
      front: 'How to create a pod quickly on the CKA exam?',
      back: '`kubectl run <name> --image=<image>` for immediate creation. For YAML generation: `kubectl run <name> --image=<image> --dry-run=client -o yaml > pod.yaml`. Then edit and apply. This saves significant time vs writing YAML from scratch.'
    },
    {
      front: 'What is CrashLoopBackOff and how do you debug it?',
      back: 'Container repeatedly starts and crashes. Kubernetes adds increasing delays between retries. Debug with: `kubectl logs <pod> --previous` (previous crash logs), `kubectl describe pod <pod>` (events showing exit codes), `kubectl get pod -o jsonpath={...}` (container state).'
    },
    {
      front: 'Init Containers vs Sidecar Containers',
      back: 'Init containers: run BEFORE app containers, must complete successfully (exit 0), run sequentially. Sidecars: run IN PARALLEL with the main container, share the pod lifecycle. Use init containers for setup (wait for DB, initialize data), sidecars for cross-cutting concerns (logging, proxy).'
    },
    {
      front: 'What are the 3 restartPolicy options?',
      back: 'Always (default): always restart — for web services. OnFailure: restart only if exit code != 0 — for batch jobs. Never: never restart — for one-time tasks. Note: Deployments always use Always. Jobs default to OnFailure.'
    },
    {
      front: 'What are static pods?',
      back: 'Pods managed directly by the kubelet from files in /etc/kubernetes/manifests/ (kubeadm default). Not managed by the API server — you cannot delete them via kubectl. Control plane components (apiserver, etcd, scheduler) run as static pods. To delete: remove the YAML file from the node.'
    },
    {
      front: 'How do you get a pod\'s IP and which node it runs on?',
      back: '`kubectl get pods -o wide` shows NODE and IP columns. Or: `kubectl get pod <name> -o jsonpath=\'{.status.podIP}\'`. Pod IPs are ephemeral — they change when a pod is rescheduled. Use Services for stable addressing.'
    }
  ],
  lab: {
    scenario: 'You need to create and troubleshoot pods in a cluster. Your tasks cover creating pods imperatively, inspecting their state, and debugging common failure scenarios.',
    objective: 'Master pod creation, inspection, and basic debugging — essential CKA exam skills.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Create Pods Using Imperative Commands',
        instruction: `Practice creating pods quickly using \`kubectl run\` — the fastest approach on the CKA exam.

\`\`\`bash
# Create a basic nginx pod
kubectl run web-server --image=nginx:alpine

# Create a pod that runs a command and exits
kubectl run task --image=busybox --restart=Never -- echo "Hello Kubernetes"

# Create a pod and get a shell immediately (deleted on exit)
kubectl run debug --image=busybox -it --rm --restart=Never -- sh

# Generate a YAML template (don't create yet)
kubectl run my-pod --image=nginx:1.25 --dry-run=client -o yaml > my-pod.yaml
cat my-pod.yaml
\`\`\`

Edit the YAML to add a resource limit and apply:
\`\`\`bash
# Add resources section to the container spec, then:
kubectl apply -f my-pod.yaml
\`\`\``,
        hints: [
          '\`--dry-run=client -o yaml\` is your best friend on the CKA exam — generates YAML instantly',
          'Use \`kubectl run --restart=Never\` for pods that should not restart',
          '\`-it --rm\` creates an interactive pod that deletes itself on exit'
        ],
        solution: `\`\`\`bash
kubectl run web-server --image=nginx:alpine
kubectl run task --image=busybox --restart=Never -- echo "Hello Kubernetes"
kubectl get pods

# Generate and edit YAML
kubectl run my-pod --image=nginx:1.25 --dry-run=client -o yaml > my-pod.yaml
# Add under containers.resources:
# resources:
#   limits:
#     memory: "64Mi"
#     cpu: "200m"
kubectl apply -f my-pod.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify pods exist
kubectl get pods
# NAME         READY   STATUS      RESTARTS
# web-server   1/1     Running     0
# task         0/1     Completed   0
# my-pod       1/1     Running     0

# Verify task pod output
kubectl logs task
# Expected output: Hello Kubernetes

# Verify resources on my-pod
kubectl get pod my-pod -o jsonpath='{.spec.containers[0].resources}'
\`\`\``
      },
      {
        title: 'Inspect and Debug a Pod',
        instruction: `Create a pod that will fail on purpose, then debug it using standard kubectl commands.

\`\`\`bash
# Create a pod with a wrong image (intentional failure)
kubectl run broken --image=nginx:nonexistent-tag-xyz

# Inspect the failure
kubectl get pod broken
kubectl describe pod broken

# Look for events section in describe output:
# Events:
#   Warning  Failed    ... Failed to pull image "nginx:nonexistent-tag-xyz": ...
#   Warning  Failed    ... Error: ErrImagePull

# Fix: update the pod image
kubectl delete pod broken
kubectl run broken --image=nginx:alpine

# Create a pod that crashes
kubectl run crasher --image=busybox --restart=Never -- sh -c "exit 1"

# Debug the crash
kubectl logs crasher
kubectl get pod crasher -o jsonpath='{.status.containerStatuses[0].state}'
\`\`\``,
        hints: [
          '\`kubectl describe pod\` shows Events at the bottom — this is the most useful debug tool',
          '\`kubectl logs --previous\` shows logs from the previous container crash',
          'ImagePullBackOff and ErrImagePull both indicate image issues'
        ],
        solution: `\`\`\`bash
kubectl run broken --image=nginx:nonexistent-tag-xyz
kubectl describe pod broken | grep -A 10 "Events:"

kubectl delete pod broken
kubectl run broken --image=nginx:alpine

kubectl run crasher --image=busybox --restart=Never -- sh -c "exit 1"
kubectl get pod crasher
kubectl logs crasher  # empty (exited immediately)
kubectl get pod crasher -o jsonpath='{.status.containerStatuses[0].state.terminated}'
# Shows: exitCode: 1
\`\`\``,
        verify: `\`\`\`bash
# broken pod should now be running
kubectl get pod broken
# NAME     READY   STATUS    RESTARTS
# broken   1/1     Running   0

# crasher pod should show Failed/Error
kubectl get pod crasher
# NAME      READY   STATUS   RESTARTS
# crasher   0/1     Error    0

# Verify exit code
kubectl get pod crasher -o jsonpath='{.status.containerStatuses[0].exitCode}'
# Expected: 1
\`\`\``
      },
      {
        title: 'Create a Multi-Container Pod with Init Container',
        instruction: `Build a pod that uses an init container to create a file, and a main container that reads it.

\`\`\`yaml
# multi-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: init-demo
spec:
  initContainers:
  - name: setup
    image: busybox:1.35
    command: ['sh', '-c', 'echo "Initialized by init container" > /data/message.txt']
    volumeMounts:
    - name: shared-data
      mountPath: /data
  containers:
  - name: reader
    image: busybox:1.35
    command: ['sh', '-c', 'cat /data/message.txt && sleep 3600']
    volumeMounts:
    - name: shared-data
      mountPath: /data
  volumes:
  - name: shared-data
    emptyDir: {}
\`\`\`

\`\`\`bash
kubectl apply -f multi-pod.yaml

# Watch the init container complete first
kubectl get pod init-demo -w

# Read the logs to see what the main container printed
kubectl logs init-demo -c reader
\`\`\``,
        hints: [
          'emptyDir volumes start empty but persist as long as the pod runs — perfect for inter-container communication',
          'Init containers run sequentially to completion before any app container starts',
          '\`kubectl logs -c <container>\` specifies which container\'s logs to show in multi-container pods'
        ],
        solution: `\`\`\`bash
kubectl apply -f multi-pod.yaml
kubectl get pod init-demo -w
# Init:0/1 → PodInitializing → Running

kubectl logs init-demo -c reader
# Initialized by init container
\`\`\``,
        verify: `\`\`\`bash
# Pod should be Running
kubectl get pod init-demo
# NAME        READY   STATUS    RESTARTS
# init-demo   1/1     Running   0

# Logs should show the message from init container
kubectl logs init-demo -c reader
# Expected: Initialized by init container

# Verify shared volume
kubectl exec init-demo -c reader -- cat /data/message.txt
# Expected: Initialized by init container
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pod stuck in Pending state',
      difficulty: 'easy',
      symptom: 'A pod has been in Pending state for several minutes. `kubectl get pod` shows STATUS: Pending.',
      diagnosis: `\`\`\`bash
# Check events for scheduling failures
kubectl describe pod <pod-name>
# Look for Events section:
# Warning  FailedScheduling  ... 0/3 nodes are available:
#   1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }
#   2 node(s) didn't match Pod's node affinity/selector.

# Check node availability
kubectl get nodes
kubectl describe node <node-name> | grep -A 5 "Conditions:"
kubectl describe node <node-name> | grep -A 10 "Allocated resources:"

# Check if resources are the issue
kubectl describe pod <pod-name> | grep -A 3 "Limits\|Requests"
\`\`\``,
      solution: `\`\`\`bash
# Scenario 1: Node selector mismatch
# Remove or fix the nodeSelector in the pod spec
kubectl edit pod <pod-name>  # or edit the deployment

# Scenario 2: Insufficient resources
# Check what's consuming resources
kubectl top nodes
kubectl get pods -A --sort-by='.spec.containers[0].resources.requests.memory'

# Scenario 3: All nodes have taints
# Add a toleration to the pod spec:
# tolerations:
# - key: "node-role.kubernetes.io/control-plane"
#   operator: "Exists"
#   effect: "NoSchedule"

# Quick fix for tests: remove taint from node
kubectl taint nodes <node-name> node-role.kubernetes.io/control-plane:NoSchedule-
\`\`\``
    },
    {
      title: 'CrashLoopBackOff — container keeps restarting',
      difficulty: 'medium',
      symptom: 'Pod shows STATUS: CrashLoopBackOff. RESTARTS counter keeps increasing.',
      diagnosis: `\`\`\`bash
# Step 1: Check current logs
kubectl logs <pod-name>
# If empty (crashed too fast):

# Step 2: Check previous container logs (most useful!)
kubectl logs <pod-name> --previous

# Step 3: Check exit code
kubectl describe pod <pod-name> | grep -A 5 "Last State:"
# Last State: Terminated
#   Reason: Error
#   Exit Code: 1 (or 137 = OOMKilled, 139 = SIGSEGV)

# Step 4: Check events
kubectl describe pod <pod-name> | tail -20

# Common exit codes:
# 0 = success
# 1 = general application error
# 137 = OOMKilled (memory limit exceeded)
# 139 = segmentation fault
# 143 = graceful termination (SIGTERM)
\`\`\``,
      solution: `\`\`\`bash
# If exit code 137 (OOMKilled): increase memory limit
kubectl patch deployment <deployment-name> --patch '
{"spec":{"template":{"spec":{"containers":[{"name":"<container>","resources":{"limits":{"memory":"256Mi"}}}]}}}}'

# If application error (exit 1): check application logs
kubectl logs <pod-name> --previous | tail -50

# If wrong command: fix the container command
kubectl edit deployment <deployment-name>
# Fix spec.containers[0].command

# If dependency not available: add an init container to wait
# initContainers:
# - name: wait-for-dep
#   image: busybox
#   command: ['sh', '-c', 'until nc -z dep-service 5432; do sleep 2; done']
\`\`\``
    }
  ]
};
