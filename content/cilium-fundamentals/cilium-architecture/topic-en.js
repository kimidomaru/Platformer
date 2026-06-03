window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cilium-fundamentals/cilium-architecture'] = {
  theory: `
# Cilium Architecture & eBPF — The CNI of the Future

## Relevance
Cilium is the most advanced CNI in the Kubernetes ecosystem, using eBPF for networking, security, and observability at the kernel level. It has replaced kube-proxy in many production clusters and is the default CNI for GKE, AKS, and EKS. Understanding Cilium is essential for any modern SRE/Platform Engineer.

## Core Concepts

### What is eBPF?

\`\`\`
eBPF (extended Berkeley Packet Filter):
  - Programs that run INSIDE the Linux kernel
  - Without modifying the kernel or loading modules
  - Secure sandbox: verifier ensures it won't crash the kernel
  - Used for: networking, security, tracing, observability

Analogy: eBPF is like JavaScript for the kernel
  - Kernel = browser
  - eBPF = scripts running in browser without modifying it
  - Verifier = browser sandbox

Pipeline:
  C code → compiler → eBPF bytecode → verifier → JIT → kernel
\`\`\`

### Cilium Architecture

\`\`\`
┌─────────────────────────────────────────────────┐
│                 Control Plane                    │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │   Cilium      │  │   Cilium Operator        │ │
│  │   Agent       │  │   (Manages CRDs, IPAM,   │ │
│  │   (DaemonSet) │  │    CiliumNodes)           │ │
│  └──────────────┘  └──────────────────────────┘ │
│                                                  │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │   Hubble      │  │   Hubble Relay           │ │
│  │   (observ.)   │  │   (aggregates flows)     │ │
│  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│                  Data Plane (eBPF)               │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │ Routing  │  │ L3/L4   │  │ L7 (Envoy)      │ │
│  │ eBPF     │  │ Policy  │  │ Policy Proxy    │ │
│  │ Programs │  │ eBPF    │  │ (when L7)       │ │
│  └─────────┘  └─────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────┘
\`\`\`

**Components:**

| Component | Type | Function |
|-----------|------|----------|
| **Cilium Agent** | DaemonSet | Manages eBPF programs, endpoints, policies |
| **Cilium Operator** | Deployment | Manages CRDs, IPAM, garbage collection |
| **Hubble** | Integrated with Agent | Network observability (flows, metrics) |
| **Hubble Relay** | Deployment | Aggregates data from all agents |
| **Hubble UI** | Deployment | Graphical interface to visualize flows |

### Identity-Based Networking

\`\`\`
Traditional model (iptables):
  Rules based on IP:port
  → IPs change, rules break
  → Thousands of rules = slow

Cilium model (eBPF):
  Rules based on IDENTITY
  → Identity = pod labels
  → Identity is numeric, efficient
  → Does not depend on IPs

Example:
  Pod with labels {app: frontend, env: prod}
  → Cilium assigns Identity ID: 12345
  → Policies reference the identity, not the IP
  → When pod changes IP, identity persists
\`\`\`

### Cilium as kube-proxy Replacement

\`\`\`
kube-proxy (iptables mode):
  - iptables rules for each Service
  - Performance degrades with many Services (O(n))
  - No advanced session affinity
  - No L7 visibility

Cilium (eBPF kube-proxy replacement):
  - eBPF map for Services (O(1) lookup)
  - Constant performance regardless of Service count
  - Maglev hashing support (consistent)
  - DSR (Direct Server Return) — response doesn't pass through LB
  - Socket-level load balancing

To enable:
  helm install cilium cilium/cilium \\
    --set kubeProxyReplacement=true
\`\`\`

### IPAM — IP Address Management

\`\`\`
IPAM modes:
  cluster-pool:  Cilium manages CIDR pool (default)
  kubernetes:    Uses Kubernetes IPAM (node.spec.podCIDR)
  multi-pool:    Multiple pools for different workloads
  azure/aws/gcp: Native cloud provider integration

Cluster Pool (default):
  --cluster-pool-ipv4-cidr=10.0.0.0/8
  --cluster-pool-ipv4-mask-size=24
  → Each node gets a /24 from the pool
\`\`\`

### Installation with Helm

\`\`\`bash
# Add repo
helm repo add cilium https://helm.cilium.io/
helm repo update

# Install Cilium (basic)
helm install cilium cilium/cilium \\
  --namespace kube-system \\
  --set kubeProxyReplacement=true \\
  --set hubble.enabled=true \\
  --set hubble.relay.enabled=true \\
  --set hubble.ui.enabled=true

# Verify status
cilium status
cilium connectivity test
\`\`\`

### Cilium CRDs

\`\`\`
Main CRDs:
  CiliumNetworkPolicy       L3-L7 network policy
  CiliumClusterwideNetworkPolicy  Cluster-wide policy
  CiliumNode                Represents a node in Cilium
  CiliumEndpoint            Represents an endpoint (pod)
  CiliumIdentity            Security identity
  CiliumExternalWorkload    External workload
  CiliumBGPPeeringPolicy    BGP configuration
  CiliumLoadBalancerIPPool  IP pool for LoadBalancer
\`\`\`

## Essential Commands

\`\`\`bash
# Cilium status
cilium status
cilium status --verbose

# List endpoints
cilium endpoint list

# Check identities
cilium identity list

# Test connectivity
cilium connectivity test

# Event monitor
cilium monitor

# BPF maps
cilium bpf ct list global
cilium bpf lb list
cilium bpf policy get <endpoint-id>

# Check health
cilium-health status
\`\`\`

## Common Mistakes

1. **Not removing kube-proxy**: When using kubeProxyReplacement=true, remove the kube-proxy DaemonSet and clean existing iptables rules.
2. **Old kernel**: Cilium requires kernel >= 4.19.57 (recommended >= 5.10). Old kernels don't support all eBPF features.
3. **IPAM conflict**: When migrating from another CNI, clean up previous CIDRs and ensure there's no overlap.
4. **Cilium Agent crashloop**: Usually caused by insufficient resources (memory) or conflict with another CNI. Check agent logs.
5. **Connectivity test fails**: Verify all required ports are open (VXLAN 8472, health 4240, Hubble 4244).

## Killer.sh Style Challenge

**Scenario:** Install and configure Cilium as the CNI for a Kubernetes cluster, replacing kube-proxy.

**Tasks:**
1. Install Cilium with kube-proxy replacement and Hubble enabled
2. Verify all nodes have OK status
3. Run connectivity test and confirm everything passes
4. Identify the identity of a specific pod
5. Check the eBPF load balancing maps
`,
  quiz: [
    {
      question: 'What is eBPF and what is its relationship with Cilium?',
      options: [
        'A network protocol used by Cilium for pod communication',
        'Programs that run inside the Linux kernel in a sandbox, used by Cilium for networking, security, and observability without modifying the kernel',
        'A database used by Cilium to store policies',
        'An alternative to Docker for running containers'
      ],
      correct: 1,
      explanation: 'eBPF (extended Berkeley Packet Filter) allows running sandboxed programs directly in the Linux kernel. The verifier ensures programs are safe. Cilium uses eBPF to implement networking (routing, load balancing), security (L3-L7 policies), and observability (Hubble) efficiently.',
      reference: 'Related concept: cilium-architecture — eBPF replaces iptables with superior performance.'
    },
    {
      question: 'What are the main components of the Cilium architecture?',
      options: [
        'Cilium Controller, Cilium Scheduler, and Cilium Proxy',
        'Cilium Agent (DaemonSet), Cilium Operator (Deployment), Hubble (observability), and Hubble Relay (aggregation)',
        'Cilium Master, Cilium Worker, and Cilium Gateway',
        'Cilium API Server, Cilium etcd, and Cilium DNS'
      ],
      correct: 1,
      explanation: 'Agent (DaemonSet on each node) manages eBPF programs and endpoints. Operator (Deployment) manages CRDs, IPAM, and garbage collection. Hubble (integrated with Agent) provides observability. Hubble Relay aggregates data from all agents for centralized querying.',
      reference: 'Related concept: cilium-hubble — Hubble is Cilium\'s observability component.'
    },
    {
      question: 'What is Identity-Based Networking in Cilium?',
      options: [
        'User authentication to access pods',
        'Network policies based on identities (pod labels) instead of IPs, allowing rules to survive IP changes',
        'TLS certificates assigned to each pod',
        'Reverse DNS to identify pods'
      ],
      correct: 1,
      explanation: 'Cilium assigns a numeric identity to each unique set of labels. Policies reference these identities, not IPs. When a pod changes IP (reschedule), the identity persists, and policies continue to work — eliminating the problem of iptables rules breaking with IP changes.',
      reference: 'Related concept: cilium-network-policies — CiliumNetworkPolicy uses identities to apply rules.'
    },
    {
      question: 'Why does Cilium replace kube-proxy with better performance?',
      options: [
        'Because it uses DNS instead of iptables',
        'Because eBPF maps have O(1) lookup vs O(n) iptables, plus support for Maglev hashing and DSR (Direct Server Return)',
        'Because it removes all Services from the cluster',
        'Because it runs in userspace with more control'
      ],
      correct: 1,
      explanation: 'kube-proxy with iptables creates linear rules — performance degrades with many Services. Cilium uses eBPF hash maps with constant O(1) lookup. Maglev hashing ensures consistent distribution. DSR allows the response to go directly from backend to client without passing through the load balancer.',
      reference: 'Related concept: cilium-bgp-lb — DSR and Maglev are essential for high-performance LB.'
    },
    {
      question: 'What is the minimum kernel requirement for running Cilium?',
      options: [
        'Kernel >= 3.10 (any modern kernel)',
        'Kernel >= 4.19.57, recommended >= 5.10 for all eBPF features',
        'Kernel >= 6.0 (only the latest kernels)',
        'No kernel requirement — works on any version'
      ],
      correct: 1,
      explanation: 'Cilium requires kernel >= 4.19.57 as minimum. Kernel >= 5.10 is recommended to support all features, including full kube-proxy replacement, bandwidth manager, and host routing. Newer kernels (5.15+, 6.x) bring additional eBPF improvements.',
      reference: 'Related concept: cilium-architecture — check kernel version before installing.'
    },
    {
      question: 'Which IPAM mode is the default in Cilium?',
      options: [
        'kubernetes — uses native Kubernetes IPAM',
        'cluster-pool — Cilium manages its own CIDR pool, assigning subnets to each node',
        'aws-eni — uses AWS ENIs',
        'host-scope — uses the host IP'
      ],
      correct: 1,
      explanation: 'cluster-pool is the default mode. Cilium defines a large CIDR (e.g., 10.0.0.0/8) and assigns subnets (e.g., /24) to each node. Other modes include kubernetes (uses node.spec.podCIDR), multi-pool (multiple pools), and cloud integrations (aws-eni, azure-ipam, gcp).',
      reference: 'Related concept: cilium-cluster-mesh — IPAM must be non-overlapping between clusters.'
    },
    {
      question: 'What does the "cilium connectivity test" command do?',
      options: [
        'Tests internet connectivity',
        'Runs a comprehensive network test suite between pods, services, network policies, and external connectivity to validate Cilium is working correctly',
        'Only checks if DNS is working',
        'Tests latency between nodes'
      ],
      correct: 1,
      explanation: 'cilium connectivity test creates test pods and runs a comprehensive suite: pod-to-pod, pod-to-service, pod-to-external, network policies, L7 policies, and more. It is the official way to validate Cilium is installed and configured correctly.',
      reference: 'Related concept: cilium-architecture — run after installation and after any changes.'
    }
  ],
  flashcards: [
    {
      front: 'What is eBPF and why does Cilium use it?',
      back: '**eBPF (extended Berkeley Packet Filter):**\n- Programs that run INSIDE the kernel\n- Secure sandbox (verifier)\n- Without modifying kernel/loading modules\n\n**Why Cilium uses eBPF:**\n- Performance: O(1) vs O(n) iptables\n- Identity-based: policies by labels\n- Observability: L3-L7 visibility\n- Security: policies in kernel\n\n**Pipeline:**\nC code → compiler → bytecode\n→ verifier → JIT → kernel\n\n**Analogy:**\neBPF : kernel :: JavaScript : browser\nRuns scripts without modifying the host'
    },
    {
      front: 'Cilium architecture components?',
      back: '**Cilium Agent (DaemonSet):**\n- Runs on each node\n- Manages eBPF programs\n- Manages endpoints and policies\n\n**Cilium Operator (Deployment):**\n- Manages CRDs and IPAM\n- Garbage collection\n- Singleton (1 replica)\n\n**Hubble (integrated with Agent):**\n- Flow observability\n- Network metrics\n\n**Hubble Relay (Deployment):**\n- Aggregates data from all agents\n- Centralized API\n\n**Hubble UI (Deployment):**\n- Graphical interface\n- Visual service map'
    },
    {
      front: 'Identity-Based Networking?',
      back: '**Traditional model (iptables):**\n- Rules by IP:port\n- IPs change → rules break\n- Thousands of rules = slow\n\n**Cilium model (eBPF):**\n- Rules by IDENTITY\n- Identity = pod labels\n- Numeric ID, efficient\n- Does not depend on IPs\n\n**Example:**\n{app:frontend, env:prod}\n→ Identity ID: 12345\n→ Policies reference 12345\n→ Pod changes IP? Identity persists!\n\n**Commands:**\n```\ncilium identity list\ncilium endpoint list\n```'
    },
    {
      front: 'Cilium vs kube-proxy?',
      back: '**kube-proxy (iptables):**\n- Linear rules O(n)\n- Performance degrades with N services\n- No advanced session affinity\n- No L7 visibility\n\n**Cilium (eBPF):**\n- Hash maps O(1) lookup\n- Constant performance\n- Maglev hashing (consistent)\n- DSR (Direct Server Return)\n- Socket-level LB\n\n**Enable:**\n```bash\nhelm install cilium cilium/cilium \\\n  --set kubeProxyReplacement=true\n```\n\n**Important:**\nRemove kube-proxy DaemonSet\nand clean old iptables rules!'
    },
    {
      front: 'Cilium IPAM modes?',
      back: '**cluster-pool (default):**\n- Cilium manages CIDR pool\n- Ex: 10.0.0.0/8 → /24 per node\n- Simplest and most flexible\n\n**kubernetes:**\n- Uses node.spec.podCIDR\n- Compatible with existing IPAM\n\n**multi-pool:**\n- Multiple pools\n- Different workloads\n\n**Cloud (aws/azure/gcp):**\n- Native integration\n- ENIs, VPC routing\n\n**Configure:**\n```\n--cluster-pool-ipv4-cidr=10.0.0.0/8\n--cluster-pool-ipv4-mask-size=24\n```'
    },
    {
      front: 'Main Cilium CRDs?',
      back: '**Networking:**\n- CiliumNetworkPolicy\n  L3-L7 policies\n- CiliumClusterwideNetworkPolicy\n  Cluster-wide policies\n\n**Nodes & Endpoints:**\n- CiliumNode\n  Represents node\n- CiliumEndpoint\n  Represents pod/endpoint\n- CiliumIdentity\n  Security identity\n\n**Advanced:**\n- CiliumExternalWorkload\n  External workloads\n- CiliumBGPPeeringPolicy\n  BGP configuration\n- CiliumLoadBalancerIPPool\n  LoadBalancer IP pool\n\n**List:**\n```bash\nkubectl api-resources | grep cilium\n```'
    },
    {
      front: 'Essential Cilium CLI commands?',
      back: '**Status:**\n```bash\ncilium status\ncilium status --verbose\n```\n\n**Endpoints:**\n```bash\ncilium endpoint list\ncilium endpoint get <id>\n```\n\n**Identities:**\n```bash\ncilium identity list\n```\n\n**Connectivity:**\n```bash\ncilium connectivity test\n```\n\n**Monitor:**\n```bash\ncilium monitor\ncilium monitor --type policy-verdict\n```\n\n**BPF maps:**\n```bash\ncilium bpf lb list\ncilium bpf ct list global\ncilium bpf policy get <id>\n```'
    }
  ],
  lab: {
    scenario: 'You need to install Cilium as the CNI in a Kubernetes cluster and validate that networking is working correctly.',
    objective: 'Install Cilium with Helm, enable Hubble, replace kube-proxy, and validate connectivity.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Install Cilium with Helm',
        instruction: `Install Cilium using Helm with kube-proxy replacement and Hubble enabled.

\`\`\`bash
# Add Cilium repo
helm repo add cilium https://helm.cilium.io/
helm repo update

# Install Cilium
helm install cilium cilium/cilium \\
  --namespace kube-system \\
  --set kubeProxyReplacement=true \\
  --set hubble.enabled=true \\
  --set hubble.relay.enabled=true \\
  --set hubble.ui.enabled=true \\
  --set ipam.mode=cluster-pool \\
  --set ipam.operator.clusterPoolIPv4PodCIDRList="10.0.0.0/8" \\
  --set ipam.operator.clusterPoolIPv4MaskSize=24
\`\`\``,
        hints: [
          'kubeProxyReplacement=true disables the need for kube-proxy',
          'Hubble needs relay to aggregate data between nodes',
          'IPAM cluster-pool is the default and most flexible mode'
        ],
        solution: `\`\`\`bash
helm repo add cilium https://helm.cilium.io/ && helm repo update
helm install cilium cilium/cilium --namespace kube-system \\
  --set kubeProxyReplacement=true \\
  --set hubble.enabled=true \\
  --set hubble.relay.enabled=true
\`\`\``,
        verify: `\`\`\`bash
# Check Cilium pods
kubectl get pods -n kube-system -l app.kubernetes.io/part-of=cilium
# Expected output: cilium-xxxxx (Running on each node), cilium-operator-xxxxx (Running)

# Check status
cilium status
# Expected output: OK on all components
\`\`\``
      },
      {
        title: 'Validate Endpoints and Identities',
        instruction: `Verify that endpoints and identities were correctly created for the cluster pods.

\`\`\`bash
# List endpoints managed by Cilium
cilium endpoint list

# List identities
cilium identity list

# Check a specific endpoint
kubectl get ciliumendpoints -A

# Check Cilium nodes
kubectl get ciliumnodes
\`\`\``,
        hints: [
          'Each pod managed by Cilium appears as an endpoint',
          'Identities are shared between pods with the same labels',
          'CiliumNodes show the IPAM allocation per node'
        ],
        solution: `\`\`\`bash
cilium endpoint list
cilium identity list
kubectl get ciliumendpoints -A
kubectl get ciliumnodes -o wide
\`\`\``,
        verify: `\`\`\`bash
# Verify endpoints exist
cilium endpoint list | grep -c "ready"
# Expected output: number > 0

# Verify CiliumNodes
kubectl get ciliumnodes
# Expected output: one CiliumNode per cluster node
\`\`\``
      },
      {
        title: 'Run Connectivity Test',
        instruction: `Run the official Cilium connectivity test to validate complete networking.

\`\`\`bash
# Run full test suite
cilium connectivity test

# For quick tests (subset)
cilium connectivity test --test pod-to-pod
cilium connectivity test --test pod-to-service
\`\`\``,
        hints: [
          'The connectivity test creates temporary pods in the cilium-test namespace',
          'Tests include pod-to-pod, pod-to-service, network policies, and L7',
          'May take several minutes on first run'
        ],
        solution: `\`\`\`bash
cilium connectivity test --test pod-to-pod,pod-to-service
\`\`\``,
        verify: `\`\`\`bash
# The connectivity test itself reports pass/fail
# Expected output: All X tests (Y checks) successful

# Check BPF LB maps (kube-proxy replacement)
cilium bpf lb list | head -20
# Expected output: list of Services mapped in eBPF
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Cilium Agent in CrashLoopBackOff',
      difficulty: 'medium',
      symptom: 'The cilium-agent pod does not start and stays in CrashLoopBackOff. No pods can communicate.',
      diagnosis: `\`\`\`bash
# Check agent logs
kubectl logs -n kube-system -l k8s-app=cilium --tail=50

# Check events
kubectl describe pod -n kube-system -l k8s-app=cilium

# Check kernel version
uname -r

# Check if another CNI is installed
ls /etc/cni/net.d/
\`\`\``,
      solution: `**Common causes and solutions:**

1. **Kernel too old:** Cilium requires >= 4.19.57. Upgrade the kernel.

2. **Conflict with another CNI:** Remove previous CNI configs:
\`\`\`bash
rm /etc/cni/net.d/10-flannel.conflist  # example
rm /etc/cni/net.d/calico-*
\`\`\`

3. **Insufficient memory:** Increase DaemonSet resources:
\`\`\`bash
helm upgrade cilium cilium/cilium --set resources.requests.memory=256Mi
\`\`\`

4. **BPFFS not mounted:**
\`\`\`bash
mount -t bpf bpf /sys/fs/bpf
\`\`\``
    },
    {
      title: 'Services not resolving after kube-proxy replacement',
      difficulty: 'hard',
      symptom: 'After enabling kubeProxyReplacement, ClusterIP Services are not accessible. Pods cannot access Services.',
      diagnosis: `\`\`\`bash
# Check if kube-proxy was actually disabled
kubectl get ds kube-proxy -n kube-system

# Check eBPF LB maps
cilium bpf lb list

# Check if old iptables rules exist
iptables -t nat -L KUBE-SERVICES | head -20

# Check kube-proxy replacement status
cilium status | grep KubeProxyReplacement
\`\`\``,
      solution: `**Solutions:**

1. **Clean kube-proxy iptables rules:**
\`\`\`bash
# Delete kube-proxy
kubectl delete ds kube-proxy -n kube-system

# Clean iptables rules on EACH node
iptables -F -t nat
iptables -F -t filter
iptables -F -t mangle
\`\`\`

2. **Verify Cilium configuration:**
\`\`\`bash
cilium config view | grep kube-proxy
# Should show: kube-proxy-replacement: true
\`\`\`

3. **Restart Cilium agents:**
\`\`\`bash
kubectl rollout restart ds/cilium -n kube-system
\`\`\`

4. **Verify eBPF maps loaded:**
\`\`\`bash
cilium bpf lb list
# Should list all cluster Services
\`\`\``
    },
    {
      title: 'Connectivity test fails on specific tests',
      difficulty: 'easy',
      symptom: 'cilium connectivity test fails on some tests, especially pod-to-external or network policy tests.',
      diagnosis: `\`\`\`bash
# Run test with verbose
cilium connectivity test --test pod-to-external -v

# Check node firewall
iptables -L INPUT -n | head -20

# Check DNS
kubectl exec -n cilium-test client -- nslookup kubernetes.default

# Check Cilium ports
ss -tlnp | grep -E "4240|4244|8472"
\`\`\``,
      solution: `**Solutions by failure type:**

1. **pod-to-external fails:** Firewall blocking outbound traffic. Open the required port or configure masquerade:
\`\`\`bash
helm upgrade cilium cilium/cilium --set enableIPv4Masquerade=true
\`\`\`

2. **Cilium ports blocked:** Open required ports:
   - 8472/UDP: VXLAN overlay
   - 4240/TCP: Health check
   - 4244/TCP: Hubble Relay

3. **DNS fails:** Verify CoreDNS is running:
\`\`\`bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
\`\`\`

4. **Network policy tests:** Check existing CiliumNetworkPolicies that may block:
\`\`\`bash
kubectl get cnp,ccnp -A
\`\`\``
    }
  ]
};
