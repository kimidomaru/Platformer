window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcna-k8s-fundamentals/containers-runtime'] = {
  theory: `# Containers & Container Runtime

## Exam Relevance
> Containers and container runtimes are foundational to KCNA (~46% Kubernetes Fundamentals). You need to understand what containers are, how they differ from VMs, the OCI standard, and the container runtime landscape.

## What is a Container?

A container is a lightweight, portable, self-contained execution environment that packages:
- Application code
- Runtime dependencies (libraries, binaries)
- Configuration

**Key properties:**
- **Isolation**: processes are isolated from the host and other containers (namespaces, cgroups)
- **Portability**: same image runs on any OCI-compatible host
- **Immutability**: images don't change; changes create a new image
- **Ephemeral**: containers are designed to be replaced, not patched

## Containers vs Virtual Machines

| Aspect | Container | Virtual Machine |
|--------|-----------|-----------------|
| Isolation | Process-level (Linux namespaces) | Full OS-level (hypervisor) |
| Startup | Milliseconds to seconds | Minutes |
| Size | MB (shares host kernel) | GB (includes full OS) |
| Overhead | Minimal | Significant (hypervisor layer) |
| Density | 100s per host | 10s per host |
| Security boundary | Weaker (shared kernel) | Stronger (separate kernel) |
| Use case | Microservices, cloud native | VMs requiring OS isolation |

Both containers and VMs have valid use cases. Many production setups run **containers inside VMs**.

## Linux Primitives: How Containers Work

Containers are not a special Linux feature — they use existing kernel primitives:

### Namespaces (Isolation)
Linux namespaces isolate resources for a group of processes:
- **PID namespace** — process IDs (container sees its own PID 1)
- **Network namespace** — network interfaces, routing tables
- **Mount namespace** — filesystem mounts
- **UTS namespace** — hostname and domain name
- **IPC namespace** — inter-process communication
- **User namespace** — user/group IDs

### cgroups (Resource Limits)
Control Groups limit and account resource usage:
- CPU (throttle, shares)
- Memory (limits, OOM kill)
- Disk I/O
- Network bandwidth

Together, namespaces + cgroups = containers.

## Container Image Layers

Images are built from layered filesystems (Union FS):

\`\`\`
FROM ubuntu:22.04        → Layer 1 (base)
RUN apt-get install curl → Layer 2 (+ curl binary)
COPY app /app            → Layer 3 (+ app files)
\`\`\`

Each layer is **immutable and shared** across containers using the same base. This makes images efficient to store and transfer.

## OCI — Open Container Initiative

OCI defines standards to ensure container portability:

| Specification | What it covers |
|--------------|----------------|
| **Image Spec** | Image format: manifest, layers, config |
| **Runtime Spec** | How to create a container from an image (process isolation) |
| **Distribution Spec** | Registry push/pull protocol |

OCI compliance means: a Docker image can run on containerd, CRI-O, or any OCI-compatible runtime.

## Container Runtime Landscape

### Low-Level Runtimes (OCI runtime)
Directly create and manage containers using OS primitives:
- **runc** — reference OCI runtime (used by containerd, Docker)
- **crun** — C-based, faster than runc
- **gVisor** (runsc) — sandboxed runtime for isolation
- **Kata Containers** — VMs as containers (hardware-level isolation)

### High-Level Runtimes (CRI)
Manage images, storage, and call low-level runtimes:
- **containerd** (CNCF Graduated) — industry standard, used by Docker and Kubernetes directly
- **CRI-O** — lightweight, OCI-compliant, built specifically for Kubernetes

### Container Runtime Interface (CRI)
Kubernetes kubelet communicates with runtimes via CRI:

\`\`\`
kubelet → CRI (gRPC) → containerd → runc → container
\`\`\`

## Docker vs containerd

Docker added many layers beyond just running containers. With Kubernetes 1.24+, Docker (via dockershim) was removed:

\`\`\`
Docker Architecture:
Docker CLI → dockerd → containerd → runc

Kubernetes 1.24+ Architecture:
kubelet → containerd → runc
(Docker CLI still works for local development — but Kubernetes doesn't use it)
\`\`\`

## Container Lifecycle

\`\`\`
Image → (create) → Container → (start) → Running → (stop) → Stopped → (remove) → Deleted
\`\`\`

In Kubernetes:
1. kubelet calls CRI to pull image
2. CRI calls image store
3. kubelet creates container via CRI
4. Container runtime (runc) starts the process
5. kubelet monitors via CRI (health checks)
6. On failure: restart, delete, or evict per policy
`,
  quiz: [
    {
      question: 'What Linux kernel primitives enable container isolation?',
      options: [
        'Hypervisors and Type-2 virtualization',
        'Namespaces (process isolation) and cgroups (resource limits)',
        'SELinux and AppArmor exclusively',
        'Virtual network interfaces and iptables'
      ],
      correct: 1,
      explanation: 'Containers are built on two Linux kernel features: namespaces (isolate PID, network, mount, UTS, IPC, user) and cgroups (limit CPU, memory, I/O). No hypervisor is involved — containers share the host kernel.',
      reference: 'Linux Primitives section in theory.'
    },
    {
      question: 'What is the OCI (Open Container Initiative) and why does it matter?',
      options: [
        'A cloud provider consortium for Kubernetes certification',
        'A set of standards (Image, Runtime, Distribution specs) ensuring containers are portable across runtimes',
        'The official container image registry',
        'The Kubernetes container management protocol'
      ],
      correct: 1,
      explanation: 'OCI defines standards so Docker images can run on containerd, CRI-O, or any OCI-compliant runtime. Without OCI, each runtime would have its own incompatible image format.',
      reference: 'OCI — Open Container Initiative section in theory.'
    },
    {
      question: 'What is the Container Runtime Interface (CRI)?',
      options: [
        'A Docker plugin for Kubernetes integration',
        'The gRPC API through which kubelet communicates with container runtimes (containerd, CRI-O)',
        'A Kubernetes admission controller for container security',
        'The interface for container image building'
      ],
      correct: 1,
      explanation: 'CRI is the gRPC API Kubernetes uses to communicate with any compliant container runtime. This makes Kubernetes runtime-agnostic — it can work with containerd, CRI-O, or any future CRI-compliant runtime.',
      reference: 'Container Runtime Interface section in theory.'
    },
    {
      question: 'Why was Docker removed as a direct Kubernetes runtime in v1.24?',
      options: [
        'Docker was too slow for production workloads',
        'Docker\'s dockershim compatibility layer was deprecated; containerd (which Docker uses internally) is now used directly',
        'Docker violated OCI standards',
        'Docker became a paid product'
      ],
      correct: 1,
      explanation: 'Docker wraps containerd internally. Kubernetes 1.24 removed the dockershim compatibility shim (extra overhead) and connects directly to containerd. Docker CLI still works for local development — just not as the Kubernetes runtime.',
      reference: 'Docker vs containerd section in theory.'
    },
    {
      question: 'What key advantage do containers have over VMs in terms of density?',
      options: [
        'Containers provide stronger security isolation',
        'Containers share the host OS kernel — so 100s of containers can run on a host vs 10s of VMs',
        'Containers use hardware virtualization for better performance',
        'Containers have persistent storage by default'
      ],
      correct: 1,
      explanation: 'VMs carry a full OS kernel per VM (GBs of overhead). Containers share the host kernel and only package the application + dependencies (MBs). This enables much higher density and faster startup.',
      reference: 'Containers vs Virtual Machines table in theory.'
    },
    {
      question: 'What are OCI image layers and why are they beneficial?',
      options: [
        'Security layers that prevent unauthorized access to images',
        'Immutable filesystem layers stacked on top of each other — shared across containers with the same base, reducing storage',
        'Network layers that control container traffic',
        'Runtime layers that add capabilities to containers'
      ],
      correct: 1,
      explanation: 'Each Dockerfile instruction (RUN, COPY, ADD) creates an immutable layer. Layers are cached and shared — if 10 containers use the same base image, that base layer is stored only once. This reduces storage and speeds up image pulls.',
      reference: 'Container Image Layers section in theory.'
    },
    {
      question: 'What is gVisor (runsc) and when would you use it?',
      options: [
        'A container image scanning tool',
        'A sandboxed OCI runtime that intercepts syscalls, providing stronger isolation than runc',
        'A Kubernetes network plugin',
        'A container image building tool'
      ],
      correct: 1,
      explanation: 'gVisor intercepts container syscalls in user space, preventing direct access to the host kernel. This provides stronger isolation than runc at the cost of some performance. Use for untrusted workloads requiring sandbox-level security.',
      reference: 'Container Runtime Landscape — Low-Level Runtimes section.'
    },
    {
      question: 'Which component is responsible for pulling container images and calling runc to start them in Kubernetes?',
      options: [
        'kube-scheduler',
        'kubelet (via CRI to containerd/CRI-O)',
        'kube-apiserver',
        'kube-controller-manager'
      ],
      correct: 1,
      explanation: 'kubelet receives pod specs and calls the container runtime (via CRI) to pull images and start containers. The runtime (containerd/CRI-O) manages images and calls runc to actually create the container processes.',
      reference: 'Container Lifecycle section in theory.'
    }
  ],
  flashcards: [
    {
      front: 'What are Linux namespaces and which isolation do they provide?',
      back: 'Linux namespaces isolate specific resources:\n\nPID — each container has its own process tree (PID 1)\nNetwork — private network stack per container\nMount — private filesystem mount points\nUTS — hostname isolation\nIPC — inter-process communication isolation\nUser — user/group ID mapping\n\nNamespaces provide ISOLATION; cgroups provide RESOURCE LIMITS.'
    },
    {
      front: 'What is the difference between a container and a VM?',
      back: 'Container:\n- Shares host OS kernel (lightweight)\n- Starts in ms-seconds\n- MBs in size\n- Weaker isolation (shared kernel)\n- 100s per host\n\nVirtual Machine:\n- Full OS per VM (heavy)\n- Starts in minutes\n- GBs in size\n- Stronger isolation (separate kernel)\n- 10s per host\n\nCloud native uses containers; security-sensitive uses VMs or both.'
    },
    {
      front: 'What is the CRI (Container Runtime Interface)?',
      back: 'gRPC API between kubelet and container runtimes:\n\nkubelet → CRI → containerd → runc → container\n\nMakes Kubernetes runtime-agnostic. Any CRI-compliant runtime works:\n- containerd (default in most distros)\n- CRI-O (lightweight, OCI-focused)\n\nDocker was removed in K8s 1.24 (dockershim deprecated).'
    },
    {
      front: 'What are the 3 OCI specifications?',
      back: '1. Image Spec — how container images are structured (layers, manifest, config JSON)\n2. Runtime Spec — how to run an OCI image as a container (runc implements this)\n3. Distribution Spec — how registries handle push/pull\n\nOCI ensures portability: Docker images run on containerd, CRI-O, Podman, etc.'
    },
    {
      front: 'What is the difference between containerd and runc?',
      back: 'runc: low-level OCI runtime\n- Creates the actual container process\n- Uses namespaces + cgroups\n- Called by containerd\n\ncontainerd: high-level runtime (CNCF Graduated)\n- Manages images (pull, push, store)\n- Manages container lifecycle\n- Implements CRI for Kubernetes\n- Calls runc to start/stop containers\n\nFlow: kubelet → containerd (CRI) → runc → container'
    },
    {
      front: 'How are container image layers beneficial?',
      back: 'Each Dockerfile instruction creates an immutable layer:\nFROM ubuntu:22.04  → Layer 1 (base)\nRUN apt-get...     → Layer 2\nCOPY app /app      → Layer 3 (only this changes on code updates)\n\nBenefits:\n1. Caching: unchanged layers reused on rebuild\n2. Sharing: base layers shared across containers → less storage\n3. Fast updates: only changed layers pulled from registry'
    }
  ],
  lab: {
    scenario: 'Understanding container runtimes helps diagnose low-level container issues. This lab explores the container runtime layer directly.',
    objective: 'Use crictl to inspect containers at the runtime level, bypassing the Kubernetes API.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Inspect Containers with crictl',
        instruction: `Use crictl (the CRI-compatible CLI) to inspect containers at the runtime level:

1. Check which container runtime is in use
2. List running containers with crictl
3. Get container details
4. Compare crictl output with kubectl output`,
        hints: [
          'kubectl get nodes -o wide shows container runtime version',
          'crictl ps lists running containers (like docker ps)',
          'crictl ps -a lists all containers including stopped',
          'crictl images lists pulled images'
        ],
        solution: `\`\`\`bash
# Check container runtime
kubectl get nodes -o wide | grep CONTAINER

# Create a test pod
kubectl run crictl-test --image=nginx:1.25
kubectl get pod crictl-test -w

# Use crictl to inspect at runtime level
crictl ps | grep nginx              # Find the container ID
crictl images | grep nginx           # See pulled images
crictl pods | grep crictl-test       # See pod sandbox

# Compare kubectl vs crictl
echo "=== kubectl view ==="
kubectl describe pod crictl-test | grep -E "Container ID:|Image:|State:"

echo "=== crictl view ==="
CONTAINER_ID=$(crictl ps | grep nginx | awk '{print $1}')
crictl inspect $CONTAINER_ID | grep -E "state|image|pid" | head -10

kubectl delete pod crictl-test
\`\`\``,
        verify: `\`\`\`bash
crictl ps 2>/dev/null | head -5
# Expected: list of running containers at runtime level
\`\`\``
      },
      {
        title: 'Understand Image Layers',
        instruction: `Explore container image layers to understand the layer caching model:

1. Check the nginx image layers with crictl or kubectl
2. Create two pods with the same base image
3. Observe that image layers are shared (pulled once)
4. Check disk usage of images`,
        hints: [
          'crictl images shows locally cached images',
          'crictl inspecti <image-id> shows layer information',
          'kubectl get pod -o wide shows which node the pod runs on',
          'Second pod with same image starts faster (no pull needed)'
        ],
        solution: `\`\`\`bash
# Check locally cached images
crictl images | grep nginx

# Create two pods with the same base image
kubectl run nginx-1 --image=nginx:1.25
kubectl run nginx-2 --image=nginx:1.25
kubectl get pods -w

# Both pods use the SAME nginx:1.25 image layers on the node
# Second pod starts faster (no image pull needed)
kubectl describe pod nginx-1 | grep "Pulled"
kubectl describe pod nginx-2 | grep "Pulled"
# nginx-2 events should say: "image already present" or no Pulling event

# Check image size and layers
crictl inspecti nginx:1.25 2>/dev/null | grep -E "size|layer" | head -10

kubectl delete pod nginx-1 nginx-2
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods nginx-1 nginx-2 2>/dev/null
# Expected: both Running (both use same cached image)
\`\`\``
      },
      {
        title: 'Observe Linux Namespaces for a Container',
        instruction: `Verify that containers use Linux namespaces for isolation:

1. Create a pod and note its PID from the host perspective
2. From inside the container, observe PID 1 (the container's own namespace)
3. Verify network isolation (container has its own network namespace)
4. Compare host network vs container network`,
        hints: [
          'kubectl exec <pod> -- ps aux shows container-namespaced processes',
          'Inside container: ip addr shows container-private network interface',
          'Host network: ip addr shows all host interfaces',
          'Process IDs inside container start from 1; on host they have different PIDs'
        ],
        solution: `\`\`\`bash
# Create a pod
kubectl run ns-test --image=nginx:1.25
kubectl get pod ns-test -w

# Inside container: container sees its own namespace
kubectl exec ns-test -- ps aux
# PID 1 = nginx master process (container-namespaced PID)

kubectl exec ns-test -- ip addr
# Shows: lo + eth0 with pod IP (container network namespace)

kubectl exec ns-test -- hostname
# Shows: pod name (UTS namespace)

# From host: different PIDs for same processes
# The container's "PID 1" has a different PID on the host
NODE=$(kubectl get pod ns-test -o jsonpath='{.spec.nodeName}')
echo "Pod runs on: $NODE"
echo "From host perspective, the container process has a different PID"

kubectl delete pod ns-test
\`\`\``,
        verify: `\`\`\`bash
kubectl exec ns-test -- ps aux 2>/dev/null | head -5
# Expected: PID 1 is the main container process (nginx)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Container Runtime Issues — crictl Diagnosis',
      difficulty: 'medium',
      symptom: 'Pods are stuck in ContainerCreating state. kubectl describe shows no clear error, but the container runtime may be the issue.',
      diagnosis: `\`\`\`bash
# Check kubelet status
systemctl status kubelet

# Check container runtime (containerd)
systemctl status containerd

# Use crictl to check runtime state
crictl ps -a       # All containers including failed
crictl pods        # All pod sandboxes

# Check for disk pressure (images take space)
df -h /var/lib/containerd

# Check containerd logs
journalctl -u containerd -n 50
\`\`\``,
      solution: `**Cause A: containerd not running**
\`\`\`bash
systemctl start containerd
systemctl enable containerd
systemctl status containerd

# Restart kubelet after containerd restart
systemctl restart kubelet
\`\`\`

**Cause B: Disk full (no space for image layers)**
\`\`\`bash
df -h /var/lib/containerd
# If near 100%:

# Remove unused images
crictl rmi --prune

# Or remove specific old images
crictl images
crictl rmi <image-id>
\`\`\`

**Cause C: Image pull timeout**
\`\`\`bash
# Check registry connectivity
curl -v https://registry.hub.docker.com/v2/
# Check proxy settings if needed
systemctl show --property=Environment containerd
\`\`\``
    }
  ]
};
