window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcna-cloud-native/open-standards'] = {
  theory: `# Open Standards in Cloud Native

## Exam Relevance
> KCNA tests knowledge of open standards that underpin the cloud native ecosystem. Expect questions about OCI, CNI, CSI, CRI, SMI, and the role of CNCF in standardization. Understanding why standards matter is key.

## Why Open Standards Matter

Open standards prevent **vendor lock-in** and enable **interoperability**:
- Different container runtimes can work with the same orchestrator
- Different networking plugins can use the same interface
- Different storage systems can integrate with the same API

> "Write once, run anywhere" — standards make this possible across the cloud native stack.

## OCI — Open Container Initiative

**OCI** was founded by Docker and CoreOS in 2015 under the Linux Foundation. It defines three specifications:

### OCI Specifications

| Spec | Purpose | Key Files/Concepts |
|------|---------|-------------------|
| **Image Spec** | How to build and store container images | Manifest, Config, Layers (content-addressable) |
| **Runtime Spec** | How to run containers | config.json, container lifecycle (create/start/kill/delete) |
| **Distribution Spec** | How to distribute images | Registry API (push/pull), content discovery |

### OCI Image Format
\`\`\`
Image Manifest
├── Image Config (OS, architecture, environment, entrypoint)
└── Layers (union filesystem layers, compressed tarballs)
    ├── Layer 1 (base OS)
    ├── Layer 2 (runtime dependencies)
    └── Layer 3 (application code)
\`\`\`

**Content-addressable**: each layer is identified by SHA256 digest — same content = same hash = shared storage.

### OCI-Compliant Tools
- **Runtimes**: runc, crun, kata-containers, gVisor
- **Image builders**: Docker, Podman, Buildah, Kaniko
- **Registries**: Docker Hub, GitHub Container Registry, Quay.io, Harbor

## CRI — Container Runtime Interface

**CRI** is a Kubernetes standard that defines how kubelet communicates with container runtimes.

\`\`\`
kubelet
  ↓ CRI (gRPC API)
Container Runtime (containerd, CRI-O)
  ↓ OCI Runtime Spec
Low-level runtime (runc, kata)
\`\`\`

### Why CRI Exists
Before CRI, Kubernetes had native Docker support (dockershim). CRI decoupled Kubernetes from Docker and allowed any OCI-compliant runtime to be used.

**Dockershim was removed in Kubernetes 1.24** — Docker is no longer directly supported. containerd and CRI-O are the standard runtimes.

### CRI-Compliant Runtimes
| Runtime | Description |
|---------|-------------|
| **containerd** | Graduated CNCF project, used by Docker engine too |
| **CRI-O** | Lightweight runtime from RedHat, purpose-built for K8s |
| **gVisor (runsc)** | Google's sandbox runtime with user-space kernel |
| **Kata Containers** | VM-based isolation, OCI-compatible |

## CNI — Container Network Interface

**CNI** defines how networking plugins are invoked when containers start/stop.

\`\`\`
Container runtime calls CNI plugin on container start
  ↓
CNI plugin:
  - Creates network namespace
  - Connects to network bridge/overlay
  - Assigns IP address (via IPAM plugin)
  - Sets up routes
\`\`\`

### CNI Plugins
| Plugin | Type | Features |
|--------|------|----------|
| **Flannel** | Overlay (VXLAN) | Simple, no NetworkPolicy support |
| **Calico** | Overlay + BGP | NetworkPolicy, BGP routing |
| **Cilium** | eBPF-based | NetworkPolicy, observability, service mesh |
| **Weave** | Overlay | Encryption, NetworkPolicy |
| **AWS VPC CNI** | Native VPC | AWS-native, no overlay overhead |

**Key CNI principle**: Every pod gets a unique IP, pods can communicate without NAT.

## CSI — Container Storage Interface

**CSI** standardizes how storage plugins interact with container orchestrators.

\`\`\`
Kubernetes calls CSI driver to:
  - Create/Delete volumes
  - Attach/Detach from node
  - Mount/Unmount in pod
\`\`\`

Before CSI, storage plugins were compiled into Kubernetes (in-tree). CSI moved them out-of-tree — storage vendors can release plugins independently.

### CSI Components
- **CSI Controller Plugin** — manages volume lifecycle (create, attach, snapshot)
- **CSI Node Plugin** — mounts volumes on the node (runs as DaemonSet)

### Popular CSI Drivers
| Driver | Storage |
|--------|---------|
| aws-ebs-csi-driver | AWS EBS |
| gce-pd-csi-driver | GCP Persistent Disk |
| azure-disk-csi-driver | Azure Disk |
| rook-ceph | Ceph (on-premises) |
| longhorn | Distributed block storage |
| nfs-csi-driver | NFS |

## SMI — Service Mesh Interface

**SMI** (now merged into Gateway API discussions) was a standard for service mesh behavior:
- Traffic management (traffic splitting, weighted routing)
- Access control (traffic policies)
- Observability (metrics, traces)

SMI enabled tools like Flagger to work across Istio, Linkerd, and Consul without vendor-specific code.

## Gateway API

**Gateway API** is the successor to the Ingress API, offering richer semantics:
\`\`\`
GatewayClass → Gateway → HTTPRoute/TCPRoute/GRPCRoute
\`\`\`

Supported by Istio, Envoy Gateway, Cilium, Traefik, and others — becoming the standard for L4/L7 traffic management.

## CNCF's Role in Standardization

- **TOC (Technical Oversight Committee)** governs project admission
- **SIGs (Special Interest Groups)** develop standards (sig-storage, sig-network)
- **Landscape** catalogs projects by category
- **Graduated projects** must have multiple implementations of their spec

## Key Standards Summary

| Standard | Layer | Governs |
|----------|-------|---------|
| OCI Image Spec | Container | Image format, layers |
| OCI Runtime Spec | Container | Container lifecycle |
| OCI Distribution Spec | Container | Registry API |
| CRI | Kubernetes | kubelet ↔ runtime |
| CNI | Networking | Plugin invocation |
| CSI | Storage | Volume management |
| Gateway API | Networking | L4/L7 routing |
`,
  quiz: [
    {
      question: 'What are the three OCI specifications?',
      options: [
        'Image Spec, Runtime Spec, Distribution Spec',
        'Container Spec, Registry Spec, Runtime Spec',
        'Build Spec, Run Spec, Push Spec',
        'Layer Spec, Manifest Spec, Config Spec'
      ],
      correct: 0,
      explanation: 'OCI defines three specs: Image Spec (how images are structured), Runtime Spec (how containers are run), and Distribution Spec (how images are pushed/pulled via registry APIs).',
      reference: 'Review "OCI Specifications" section.'
    },
    {
      question: 'What is the purpose of the Container Runtime Interface (CRI) in Kubernetes?',
      options: [
        'To define a standard API between kubelet and container runtimes, enabling any OCI-compliant runtime',
        'To define how containers communicate over the network',
        'To standardize container image formats across registries',
        'To provide a CLI for managing containers on nodes'
      ],
      correct: 0,
      explanation: 'CRI is a gRPC API that kubelet uses to communicate with runtimes. It decoupled Kubernetes from Docker, allowing containerd, CRI-O, and others to be used interchangeably.',
      reference: 'Review "CRI — Container Runtime Interface" section.'
    },
    {
      question: 'Which Kubernetes version removed dockershim and direct Docker support?',
      options: [
        'Kubernetes 1.24',
        'Kubernetes 1.20',
        'Kubernetes 1.18',
        'Kubernetes 1.26'
      ],
      correct: 0,
      explanation: 'Dockershim was deprecated in Kubernetes 1.20 and removed in Kubernetes 1.24. containerd and CRI-O are the standard runtimes. Docker images still work because they use OCI format.',
      reference: 'Review "Why CRI Exists" — Dockershim removal note.'
    },
    {
      question: 'What does CNI stand for and what does it govern?',
      options: [
        'Container Network Interface — how networking plugins are invoked when containers start/stop',
        'Cloud Network Integration — how cloud providers integrate with Kubernetes networking',
        'Cluster Node Interface — how nodes communicate in a cluster',
        'Container Namespace Isolation — how Linux namespaces are assigned to containers'
      ],
      correct: 0,
      explanation: 'CNI (Container Network Interface) is a standard defining how networking plugins are called by the container runtime. It ensures pod IPs are assigned and routing is set up consistently.',
      reference: 'Review "CNI — Container Network Interface" section.'
    },
    {
      question: 'What problem did CSI (Container Storage Interface) solve?',
      options: [
        'Storage plugins were in-tree (compiled into Kubernetes); CSI moved them out-of-tree for independent releases',
        'Containers couldn\'t share volumes across nodes before CSI',
        'StorageClasses didn\'t exist before CSI was introduced',
        'etcd storage was not standardized before CSI'
      ],
      correct: 0,
      explanation: 'Before CSI, storage vendor plugins were compiled into the Kubernetes binary (in-tree). CSI allows vendors to ship drivers independently as containers, without waiting for Kubernetes releases.',
      reference: 'Review "CSI — Container Storage Interface" section.'
    },
    {
      question: 'Which CNI plugin does NOT support Kubernetes NetworkPolicy?',
      options: [
        'Flannel',
        'Calico',
        'Cilium',
        'Weave'
      ],
      correct: 0,
      explanation: 'Flannel is a simple overlay network that does NOT support NetworkPolicy. Calico, Cilium, and Weave all support NetworkPolicy enforcement.',
      reference: 'Review "CNI Plugins" table in the CNI section.'
    },
    {
      question: 'What is the Gateway API in Kubernetes?',
      options: [
        'The successor to the Ingress API with richer traffic routing semantics (HTTPRoute, GRPCRoute, TCPRoute)',
        'The API used by CSI drivers to communicate with storage backends',
        'The API for managing Kubernetes API server authentication',
        'A CNCF project for managing service mesh configurations'
      ],
      correct: 0,
      explanation: 'Gateway API is the next generation Ingress replacement. It adds GatewayClass, Gateway, HTTPRoute, GRPCRoute, and TCPRoute resources for richer L4/L7 traffic management.',
      reference: 'Review "Gateway API" section.'
    },
    {
      question: 'What makes OCI images "content-addressable"?',
      options: [
        'Each layer is identified by its SHA256 digest — identical content has the same hash and can be shared',
        'Images can be addressed by their tag name across registries',
        'The OCI manifest contains the full URL of the image registry',
        'Content is addressed by creator identity (author name)'
      ],
      correct: 0,
      explanation: 'Content-addressable storage means layers are identified by SHA256 digest of their content. Same content = same digest = can be shared across images and registries, reducing storage and bandwidth.',
      reference: 'Review "OCI Image Format" section.'
    }
  ],
  flashcards: [
    {
      front: 'What are the three OCI specs and their purposes?',
      back: 'Image Spec: how images are structured (manifest, config, layers). Runtime Spec: how containers are run (config.json, lifecycle). Distribution Spec: how images are pushed/pulled (registry HTTP API).'
    },
    {
      front: 'What is CRI and why was it created?',
      back: 'Container Runtime Interface — a gRPC API between kubelet and container runtimes. Created to decouple Kubernetes from Docker (dockershim), allowing any OCI runtime (containerd, CRI-O, etc.) to be used.'
    },
    {
      front: 'What is the CRI-to-runtime chain in Kubernetes?',
      back: 'kubelet → CRI (gRPC) → containerd/CRI-O → OCI Runtime Spec → runc/kata. CRI is the kubelet-facing interface; OCI Runtime Spec is the low-level container execution standard.'
    },
    {
      front: 'What is CNI and what does a CNI plugin do?',
      back: 'Container Network Interface — standard for networking plugins. When a container starts, the plugin: creates network namespace, assigns IP via IPAM, sets up routes. Plugins: Flannel, Calico, Cilium, Weave.'
    },
    {
      front: 'What is the difference between in-tree and out-of-tree storage plugins?',
      back: 'In-tree: compiled into Kubernetes binary — updates require K8s release. Out-of-tree (CSI): separate containers deployable independently — vendors release on their own schedule. CSI enabled the move to out-of-tree.'
    },
    {
      front: 'Which CNI plugin uses eBPF for high performance and observability?',
      back: 'Cilium — uses Linux eBPF (extended Berkeley Packet Filter) for networking, NetworkPolicy enforcement, load balancing, and deep observability without iptables overhead.'
    },
    {
      front: 'What is Gateway API and how does it differ from Ingress?',
      back: 'Gateway API is the successor to Ingress with richer semantics: GatewayClass (infrastructure), Gateway (listener), HTTPRoute/GRPCRoute/TCPRoute (routing rules). Supports role-based configuration and advanced traffic splitting.'
    }
  ],
  lab: {
    scenario: 'Explore the open standards in your Kubernetes cluster by examining the installed CNI, CSI drivers, and container runtime. Understand how these components implement the standards.',
    objective: 'Identify the container runtime (CRI), networking plugin (CNI), and storage drivers (CSI) in a running cluster.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Identify the container runtime and CRI implementation',
        instruction: `Determine which container runtime is used in your cluster. Check the node status for runtime version and inspect the kubelet configuration to understand the CRI socket path.`,
        hints: [
          'kubectl get nodes -o wide shows the CONTAINER-RUNTIME column',
          'kubectl describe node shows containerRuntimeVersion',
          'The CRI socket path is typically /var/run/containerd/containerd.sock'
        ],
        solution: `\`\`\`bash
# Check runtime in node info
kubectl get nodes -o wide
# Look at CONTAINER-RUNTIME column (e.g., containerd://1.7.x)

# Get detailed runtime info
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.nodeInfo.containerRuntimeVersion}{"\n"}{end}'

# Describe a node for full info
kubectl describe node <node-name> | grep -A3 "Container Runtime"
\`\`\``,
        verify: `\`\`\`bash
kubectl get nodes -o jsonpath='{.items[0].status.nodeInfo.containerRuntimeVersion}'
# Expected: containerd://1.X.X or cri-o://X.X.X

kubectl get nodes -o jsonpath='{.items[0].status.nodeInfo.kubeletVersion}'
# Expected: v1.XX.X
\`\`\``
      },
      {
        title: 'Examine the CNI plugin',
        instruction: `Find out which CNI plugin is installed in your cluster. Check the kube-system namespace for CNI-related DaemonSets and pods. Look at the CNI configuration on a node.`,
        hints: [
          'kubectl get daemonsets -n kube-system — look for flannel, calico-node, cilium, etc.',
          'kubectl get pods -n kube-system — CNI pods usually run as DaemonSet pods',
          'CNI config is typically at /etc/cni/net.d/ on nodes'
        ],
        solution: `\`\`\`bash
# Find CNI DaemonSets
kubectl get daemonsets -n kube-system

# Find CNI pods
kubectl get pods -n kube-system -o wide | grep -E "calico|flannel|cilium|weave"

# Check CNI ConfigMap (Flannel example)
kubectl get configmap -n kube-system | grep -i cni

# Check which CNI plugin is configured (if you have node access)
# ls /etc/cni/net.d/
# cat /etc/cni/net.d/10-*.conf
\`\`\``,
        verify: `\`\`\`bash
kubectl get daemonsets -n kube-system
# Expected: shows CNI DaemonSet (e.g., kube-flannel-ds, calico-node, cilium)

kubectl get pods -n kube-system | grep -E "flannel|calico|cilium|weave"
# Expected: Running pods on each node for the CNI plugin

kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.conditions[-1].type}{"\n"}{end}'
# Expected: all nodes Ready (CNI working)
\`\`\``
      },
      {
        title: 'Explore CSI drivers and StorageClasses',
        instruction: `List available StorageClasses and identify the CSI driver behind each. Create a PVC using the default StorageClass to observe dynamic provisioning. Check if a CSI driver DaemonSet exists.`,
        hints: [
          'kubectl get storageclass shows PROVISIONER column which is the CSI driver name',
          'kubectl get pods -n kube-system | grep csi for CSI DaemonSets',
          'Look for "(default)" annotation in the StorageClass list'
        ],
        solution: `\`\`\`bash
# List StorageClasses and their provisioners
kubectl get storageclass

# Check default StorageClass
kubectl get storageclass -o jsonpath='{range .items[?(@.metadata.annotations.storageclass\\.kubernetes\\.io/is-default-class=="true")]}{.metadata.name}{"\t"}{.provisioner}{"\n"}{end}'

# Find CSI driver pods
kubectl get pods --all-namespaces | grep csi

# Create a test PVC with default StorageClass
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: csi-test-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get storageclass
# Expected: at least one StorageClass with provisioner name

kubectl get pvc csi-test-pvc
# Expected: STATUS=Bound (if default StorageClass with dynamic provisioning)
# Or: STATUS=Pending (if no dynamic provisioner — that's OK for this exploration)

kubectl get pv
# Expected: if Bound, shows the dynamically created PV

# Cleanup
kubectl delete pvc csi-test-pvc
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pods stuck in ContainerCreating — CNI not configured',
      difficulty: 'medium',
      symptom: 'Pods remain in ContainerCreating state. kubectl describe pod shows: "network plugin is not ready: cni config uninitialized"',
      diagnosis: `\`\`\`bash
# Check pod events
kubectl describe pod <pod-name> -n <namespace>
# Look for: "failed to find plugin" or "cni config uninitialized"

# Check CNI pods in kube-system
kubectl get pods -n kube-system | grep -E "cni|flannel|calico|cilium|weave"

# Check node conditions
kubectl describe node <node-name> | grep -A5 "Conditions"

# Check kubelet logs on the node (if accessible)
journalctl -u kubelet --no-pager | tail -20
\`\`\``,
      solution: `The CNI plugin is not installed or is failing. Common fixes:

1. **Install the CNI plugin** (if not yet installed after kubeadm init):
\`\`\`bash
# Flannel
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml

# Calico
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml
\`\`\`

2. **CNI pods are crashing** — check their logs:
\`\`\`bash
kubectl logs -n kube-system daemonset/<cni-daemonset>
\`\`\`

3. **Wrong pod CIDR** — check if the CNI's pod CIDR matches the cluster's:
\`\`\`bash
kubectl cluster-info dump | grep -i "cluster-cidr"
\`\`\``
    },
    {
      title: 'PVC not binding — StorageClass provisioner not available',
      difficulty: 'easy',
      symptom: 'PVC is in Pending state. kubectl describe pvc shows: "waiting for a volume to be created, either by external provisioner or manually created by system administrator"',
      diagnosis: `\`\`\`bash
# Check StorageClass
kubectl get storageclass
kubectl describe storageclass <name>
# Look at Provisioner field

# Check if the CSI driver is running
kubectl get pods --all-namespaces | grep -i <provisioner-name>

# Check StorageClass events
kubectl get events --all-namespaces | grep -i provision
\`\`\``,
      solution: `The dynamic provisioner (CSI driver) is not running or the StorageClass references a provisioner that doesn't exist.

1. **Install the CSI driver** for your storage backend:
\`\`\`bash
# Example: AWS EBS
kubectl apply -k "github.com/kubernetes-sigs/aws-ebs-csi-driver/deploy/kubernetes/overlays/stable/?ref=release-1.25"
\`\`\`

2. **Use manual (static) provisioning** if no CSI driver is available:
\`\`\`bash
# Create a PV manually first
kubectl apply -f pv.yaml  # with matching storageClassName, capacity, accessMode
\`\`\`

3. **Check if there's a default StorageClass** for PVCs without storageClassName:
\`\`\`bash
kubectl get storageclass | grep "(default)"
\`\`\``
    }
  ]
};
