window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cilium-advanced/cilium-bgp-lb'] = {
  theory: `
# BGP & Load Balancing — Advanced Networking with Cilium

## Relevance
Cilium offers native BGP control plane and integrated LoadBalancer IP Address Management (LB-IPAM), eliminating the need for MetalLB in bare-metal/on-prem clusters. Combined with DSR and Maglev hashing, it provides high-performance load balancing for production environments.

## Core Concepts

### BGP Control Plane

\`\`\`
BGP (Border Gateway Protocol):
  - Routing protocol between autonomous systems
  - Cilium announces Service/Pod IPs to external routers
  - Enables external access to Services without NodePort

Flow:
  1. Pod/Service receives IP
  2. Cilium announces route via BGP to external router
  3. External router forwards traffic to correct node
  4. eBPF forwards to the pod

Without BGP (NodePort):
  Client → Router → any node → kube-proxy → pod
  (traffic may go to wrong node, extra hop)

With BGP:
  Client → Router → correct node → eBPF → pod
  (direct routing, no extra hops)
\`\`\`

### CiliumBGPPeeringPolicy

\`\`\`yaml
apiVersion: cilium.io/v2alpha1
kind: CiliumBGPPeeringPolicy
metadata:
  name: bgp-policy
spec:
  virtualRouters:
    - localASN: 65001
      exportPodCIDR: true
      neighbors:
        - peerAddress: "10.0.0.1/32"
          peerASN: 65000
          connectRetryTimeSeconds: 120
          holdTimeSeconds: 90
          keepAliveTimeSeconds: 30
          gracefulRestart:
            enabled: true
            restartTimeSeconds: 120
      serviceSelector:
        matchExpressions:
          - key: bgp
            operator: NotIn
            values:
              - exclude
  nodeSelector:
    matchLabels:
      bgp: enabled
\`\`\`

### LB-IPAM — LoadBalancer IP Address Management

\`\`\`yaml
# IP pool for LoadBalancer Services
apiVersion: cilium.io/v2alpha1
kind: CiliumLoadBalancerIPPool
metadata:
  name: production-pool
spec:
  blocks:
    - cidr: "192.168.100.0/24"
  serviceSelector:
    matchLabels:
      env: production
---
# Separate pool for staging
apiVersion: cilium.io/v2alpha1
kind: CiliumLoadBalancerIPPool
metadata:
  name: staging-pool
spec:
  blocks:
    - cidr: "192.168.200.0/24"
  serviceSelector:
    matchLabels:
      env: staging
\`\`\`

\`\`\`
How it works:
  1. LoadBalancer Service is created
  2. LB-IPAM assigns IP from configured pool
  3. BGP announces IP to external routers
  4. External traffic arrives via BGP route

Advantages over MetalLB:
  - Integrated with Cilium (no extra component)
  - Uses eBPF for load balancing (more efficient)
  - Configurable per namespace/labels via serviceSelector
  - Shares BGP peering with pod CIDR
\`\`\`

### DSR — Direct Server Return

\`\`\`
Default mode (SNAT):
  Client → LB → Backend → LB → Client
  (response goes through LB — slower)

DSR:
  Client → LB → Backend → Client
  (response goes DIRECTLY to client — faster)
  - Lower latency
  - Less load on LB
  - Preserves real client IP

Enable:
  helm install cilium cilium/cilium \\
    --set loadBalancer.mode=dsr
\`\`\`

### Maglev Hashing

\`\`\`
Round-robin (default):
  Connections distributed sequentially
  → Not sticky — same connection may go to different backends
  → HTTP session may lose state

Maglev (consistent hashing):
  Hash of (src IP, dst IP, src port, dst port, protocol)
  → Same tuple ALWAYS goes to same backend
  → If backend dies, only its connections are redistributed
  → Session affinity without overhead

Enable:
  helm install cilium cilium/cilium \\
    --set loadBalancer.algorithm=maglev
\`\`\`

### XDP Acceleration

\`\`\`
XDP (eXpress Data Path):
  - Processes packets BEFORE entering TCP/IP stack
  - Directly in NIC driver
  - Maximum possible throughput

Modes:
  Native XDP:   driver supports → maximum performance
  Generic XDP:  kernel fallback → good performance

Enable:
  helm install cilium cilium/cilium \\
    --set loadBalancer.acceleration=native

Use cases:
  - DDoS mitigation
  - High-throughput load balancing
  - High-performance packet filtering
\`\`\`

### Complete Configuration

\`\`\`bash
helm install cilium cilium/cilium \\
  --namespace kube-system \\
  --set kubeProxyReplacement=true \\
  --set bgpControlPlane.enabled=true \\
  --set loadBalancer.mode=dsr \\
  --set loadBalancer.algorithm=maglev \\
  --set loadBalancer.acceleration=native \\
  --set hubble.enabled=true \\
  --set hubble.relay.enabled=true
\`\`\`

## Essential Commands

\`\`\`bash
# BGP status
cilium bgp peers
cilium bgp routes

# LB-IPAM pools
kubectl get ciliumbgppeeringpolicies
kubectl get ciliumloadbalancerippool

# Check allocated IPs
kubectl get svc -A -o wide | grep LoadBalancer

# BPF load balancer maps
cilium bpf lb list
cilium bpf lb list --revnat

# Service backends
cilium service list

# Maglev backends
cilium bpf lb maglev list

# DSR status
cilium config view | grep dsr
\`\`\`

## Common Mistakes

1. **BGP peer not connecting**: Check ASN, peer IP, TCP port 179 open, and correct nodeSelector.
2. **Service without external IP**: LB-IPAM not configured or pool exhausted. Check CiliumLoadBalancerIPPool.
3. **DSR issues**: DSR requires nodes to see client IP. Doesn't work behind certain cloud load balancers that mask source IP.
4. **XDP not working**: NIC driver needs to support native XDP. Check with ethtool.
5. **BGP route flapping**: gracefulRestart should be enabled. Check holdTime and keepAlive.

## Killer.sh Style Challenge

**Scenario:** Configure BGP and LB-IPAM in a bare-metal cluster to expose LoadBalancer Services.

**Tasks:**
1. Configure CiliumBGPPeeringPolicy with peering to external router
2. Create CiliumLoadBalancerIPPool with IPs for production and staging
3. Create a LoadBalancer Service and verify it received an IP from the pool
4. Validate the BGP route was announced
`,
  quiz: [
    {
      question: 'What does Cilium\'s BGP control plane do?',
      options: [
        'Manages cluster DNS',
        'Announces Service and Pod IP routes to external routers via BGP, enabling direct access without NodePort',
        'Creates iptables rules',
        'Manages TLS certificates'
      ],
      correct: 1,
      explanation: 'Cilium\'s BGP control plane establishes BGP peering with external routers and announces routes for pod CIDRs and Service IPs (LoadBalancer). This allows external traffic to be routed directly to the correct node, eliminating NodePort and extra hops.',
      reference: 'Related concept: cilium-bgp-lb — BGP + LB-IPAM replace MetalLB.'
    },
    {
      question: 'What is the purpose of CiliumLoadBalancerIPPool?',
      options: [
        'Defines pod CIDRs',
        'Defines IP pools that are automatically assigned to LoadBalancer Services, with filtering by labels/namespace',
        'Defines node IPs',
        'Defines DNS entries'
      ],
      correct: 1,
      explanation: 'CiliumLoadBalancerIPPool defines IP blocks (CIDRs) that LB-IPAM uses to assign IPs to LoadBalancer Services. serviceSelector allows filtering which Services receive IPs from which pool — useful for separating production and staging.',
      reference: 'Related concept: cilium-bgp-lb — pool IPs are announced via BGP.'
    },
    {
      question: 'What is DSR (Direct Server Return)?',
      options: [
        'A DNS protocol',
        'A mode where the backend response goes DIRECTLY to the client without passing through the load balancer, reducing latency and LB load',
        'A Kubernetes Service type',
        'An etcd backup mode'
      ],
      correct: 1,
      explanation: 'In SNAT mode, response goes through LB (2 hops). In DSR, response goes directly from backend to client (1 hop). Benefits: lower latency, less LB load, and real client IP preserved. Limitation: doesn\'t work behind LBs that mask source IP.',
      reference: 'Related concept: cilium-architecture — DSR uses eBPF for direct routing.'
    },
    {
      question: 'Why is Maglev hashing better than round-robin for load balancing?',
      options: [
        'It is simpler to configure',
        'Uses consistent hashing based on 5-tuple, ensuring the same connection always goes to the same backend, with minimal redistribution when backends change',
        'Distributes equally regardless of traffic',
        'Works only with HTTP'
      ],
      correct: 1,
      explanation: 'Maglev uses consistent hash of the 5-tuple (src/dst IP, src/dst port, protocol). Same tuple = same backend. If a backend dies, only its connections are redistributed — other backends are not affected. Ideal for session affinity without cookies.',
      reference: 'Related concept: cilium-bgp-lb — Maglev improves session affinity.'
    },
    {
      question: 'What is the advantage of Cilium LB-IPAM over MetalLB?',
      options: [
        'MetalLB is faster',
        'Cilium LB-IPAM is integrated (no extra component), uses eBPF for efficient LB, and shares BGP peering with pod routing',
        'MetalLB supports more protocols',
        'No difference'
      ],
      correct: 1,
      explanation: 'Cilium LB-IPAM is integrated — no need to install/manage MetalLB separately. Uses eBPF maps (O(1)) instead of iptables. Shares BGP sessions with pod routing, simplifying configuration. serviceSelector enables granular filtering.',
      reference: 'Related concept: cilium-architecture — one solution for CNI, LB, and BGP.'
    },
    {
      question: 'What is XDP acceleration in Cilium?',
      options: [
        'A way to compress packets',
        'Packet processing directly in the NIC driver, BEFORE the TCP/IP stack, providing maximum throughput for load balancing and packet filtering',
        'A type of accelerated storage',
        'A way to cache DNS'
      ],
      correct: 1,
      explanation: 'XDP (eXpress Data Path) processes packets at the lowest possible level — directly in the network card driver. It is much faster than processing in the TCP/IP stack. Cilium uses XDP for high-throughput LB and DDoS mitigation. Requires NIC driver support.',
      reference: 'Related concept: cilium-bgp-lb — XDP + Maglev + DSR = maximum LB performance.'
    },
    {
      question: 'How do you separate LoadBalancer IP pools by environment (prod/staging)?',
      options: [
        'Not possible — one pool for all',
        'Create multiple CiliumLoadBalancerIPPool with serviceSelector using labels to direct each environment\'s Services to the correct pool',
        'Create different namespaces and one pool',
        'Use NodePort instead of LoadBalancer'
      ],
      correct: 1,
      explanation: 'Create separate CiliumLoadBalancerIPPool with distinct CIDRs and use serviceSelector with matchLabels to filter. E.g., prod pool with selector env=production, staging pool with selector env=staging. Services with matching labels receive IPs from the correct pool.',
      reference: 'Related concept: cilium-bgp-lb — serviceSelector enables IP governance.'
    }
  ],
  flashcards: [
    {
      front: 'BGP Control Plane in Cilium?',
      back: '**What it does:**\nAnnounces routes via BGP to\nexternal routers\n\n**CiliumBGPPeeringPolicy:**\n```yaml\nspec:\n  virtualRouters:\n    - localASN: 65001\n      exportPodCIDR: true\n      neighbors:\n        - peerAddress: \"10.0.0.1/32\"\n          peerASN: 65000\n```\n\n**Benefits vs NodePort:**\n- Direct routing to node\n- No extra hops\n- Real client IP preserved\n\n**Commands:**\n```bash\ncilium bgp peers\ncilium bgp routes\n```'
    },
    {
      front: 'LB-IPAM — LoadBalancer IP pools?',
      back: '**CiliumLoadBalancerIPPool:**\n```yaml\nspec:\n  blocks:\n    - cidr: \"192.168.100.0/24\"\n  serviceSelector:\n    matchLabels:\n      env: production\n```\n\n**Flow:**\n1. LB Service created\n2. LB-IPAM assigns IP from pool\n3. BGP announces IP externally\n4. Traffic arrives via BGP\n\n**vs MetalLB:**\n- Integrated (no extra component)\n- eBPF (more efficient)\n- serviceSelector by labels\n- Shares BGP peering\n\n**Multiple pools:**\nProd, staging, DMZ...\neach with its own CIDR'
    },
    {
      front: 'DSR vs SNAT?',
      back: '**SNAT (default):**\n```\nClient → LB → Backend → LB → Client\n```\n- 2 hops on response\n- LB processes both ways\n- Source IP masked\n\n**DSR (Direct Server Return):**\n```\nClient → LB → Backend → Client\n```\n- 1 hop on response\n- LB only processes request\n- Source IP preserved\n\n**Enable:**\n```bash\n--set loadBalancer.mode=dsr\n```\n\n**Limitation:**\nDoesn\'t work behind LBs\nthat mask source IP'
    },
    {
      front: 'Maglev consistent hashing?',
      back: '**Round-robin:**\n- Sequential\n- Not sticky\n- Session may change backend\n\n**Maglev:**\n- Hash of 5-tuple\n  (src IP, dst IP, ports, proto)\n- Same tuple = same backend\n- Backend dies → only its\n  connections redistributed\n- Session affinity without cookies\n\n**Enable:**\n```bash\n--set loadBalancer.algorithm=maglev\n```\n\n**Ideal for:**\n- APIs with sessions\n- WebSocket\n- gRPC streaming\n- Any stateful workload'
    },
    {
      front: 'XDP acceleration?',
      back: '**XDP (eXpress Data Path):**\nProcesses packets BEFORE\nTCP/IP stack\n→ Directly in NIC driver\n→ Maximum throughput\n\n**Modes:**\n- Native: driver supports\n  → maximum performance\n- Generic: kernel fallback\n  → good performance\n\n**Enable:**\n```bash\n--set loadBalancer.acceleration=native\n```\n\n**Use cases:**\n- DDoS mitigation\n- High-throughput LB\n- Fast packet filtering\n\n**Requirement:**\nNIC driver must support\nnative XDP (check ethtool)'
    },
    {
      front: 'Complete LB configuration?',
      back: '**Helm values:**\n```bash\nhelm install cilium cilium/cilium \\\n  --set kubeProxyReplacement=true \\\n  --set bgpControlPlane.enabled=true \\\n  --set loadBalancer.mode=dsr \\\n  --set loadBalancer.algorithm=maglev \\\n  --set loadBalancer.acceleration=native\n```\n\n**Result:**\n- kube-proxy replacement ✓\n- BGP peering ✓\n- DSR (direct response) ✓\n- Maglev (consistent hash) ✓\n- XDP (max throughput) ✓\n\n**Verify:**\n```bash\ncilium bgp peers\ncilium bpf lb list\ncilium service list\n```'
    }
  ],
  lab: {
    scenario: 'You need to configure BGP and LB-IPAM in a cluster to expose LoadBalancer Services in a bare-metal environment.',
    objective: 'Configure CiliumBGPPeeringPolicy, CiliumLoadBalancerIPPool, and validate route announcement.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Enable BGP Control Plane',
        instruction: `Check and enable the BGP control plane in Cilium.

\`\`\`bash
# Check if BGP is enabled
cilium config view | grep bgp

# If not, enable via Helm
helm upgrade cilium cilium/cilium -n kube-system \\
  --set bgpControlPlane.enabled=true \\
  --set loadBalancer.mode=dsr \\
  --set loadBalancer.algorithm=maglev

# Check BGP CRDs
kubectl get crd | grep cilium | grep bgp
\`\`\``,
        hints: [
          'bgpControlPlane.enabled=true activates the BGP speaker in Cilium Agent',
          'DSR and Maglev are optional but improve performance',
          'CRDs CiliumBGPPeeringPolicy and CiliumLoadBalancerIPPool should exist'
        ],
        solution: `\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set bgpControlPlane.enabled=true
kubectl get crd | grep cilium | grep bgp
\`\`\``,
        verify: `\`\`\`bash
cilium config view | grep bgp
# Expected output: bgp-control-plane: enabled

kubectl get crd ciliumbgppeeringpolicies.cilium.io
# Expected output: CRD exists
\`\`\``
      },
      {
        title: 'Configure LB-IPAM Pool',
        instruction: `Create an IP pool for LoadBalancer Services.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: cilium.io/v2alpha1
kind: CiliumLoadBalancerIPPool
metadata:
  name: main-pool
spec:
  blocks:
    - cidr: "192.168.100.0/28"
  serviceSelector:
    matchExpressions:
      - key: io.kubernetes.service.namespace
        operator: NotIn
        values:
          - kube-system
EOF
\`\`\``,
        hints: [
          '/28 provides 16 IPs — sufficient for testing',
          'serviceSelector can filter by namespace or labels',
          'IPs from this pool are automatically assigned to LB Services'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: cilium.io/v2alpha1
kind: CiliumLoadBalancerIPPool
metadata:
  name: main-pool
spec:
  blocks:
    - cidr: "192.168.100.0/28"
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get ciliumloadbalancerippool
# Expected output: NAME        DISABLED   CONFLICTING   IPS AVAILABLE   AGE
#                  main-pool   false      false         16              Xs
\`\`\``
      },
      {
        title: 'Create LoadBalancer Service and Validate',
        instruction: `Create a LoadBalancer Service and verify it received an IP from the pool.

\`\`\`bash
# Create deployment and service
kubectl create deployment nginx-lb --image=nginx
kubectl expose deployment nginx-lb --port=80 --type=LoadBalancer

# Check assigned IP
kubectl get svc nginx-lb

# Check eBPF maps
cilium service list | grep nginx-lb
cilium bpf lb list | grep <service-ip>
\`\`\``,
        hints: [
          'IP should come from the 192.168.100.0/28 range',
          'If EXTERNAL-IP stays pending, check pool and its events',
          'cilium service list shows all mapped services'
        ],
        solution: `\`\`\`bash
kubectl create deployment nginx-lb --image=nginx
kubectl expose deployment nginx-lb --port=80 --type=LoadBalancer
kubectl get svc nginx-lb -w
\`\`\``,
        verify: `\`\`\`bash
kubectl get svc nginx-lb
# Expected output: EXTERNAL-IP with IP from 192.168.100.x range

cilium service list | grep nginx-lb
# Expected output: Service listed with frontend IP from pool
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'LoadBalancer Service without EXTERNAL-IP',
      difficulty: 'easy',
      symptom: 'LoadBalancer Service stays with EXTERNAL-IP in <pending> indefinitely.',
      diagnosis: `\`\`\`bash
# Check pools
kubectl get ciliumloadbalancerippool
kubectl describe ciliumloadbalancerippool <pool-name>

# Check Service events
kubectl describe svc <service-name>

# Check if BGP is enabled
cilium config view | grep bgp

# Check Cilium Operator logs
kubectl logs -n kube-system -l app.kubernetes.io/name=cilium-operator --tail=20
\`\`\``,
      solution: `**Solutions:**

1. **Pool doesn't exist:** Create a CiliumLoadBalancerIPPool:
\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: cilium.io/v2alpha1
kind: CiliumLoadBalancerIPPool
metadata:
  name: default-pool
spec:
  blocks:
    - cidr: "192.168.100.0/24"
EOF
\`\`\`

2. **Pool exhausted:** Check available IPs and increase CIDR if needed.

3. **serviceSelector doesn't match:** Check pool selector matches the Service.

4. **BGP not enabled:** Enable bgpControlPlane.enabled=true in Helm.`
    },
    {
      title: 'BGP peer not establishing session',
      difficulty: 'hard',
      symptom: 'cilium bgp peers shows status "not established" or "active" (not "established"). Routes are not announced.',
      diagnosis: `\`\`\`bash
# Check BGP peers
cilium bgp peers

# Check policy
kubectl describe ciliumbgppeeringpolicy <name>

# Check connectivity to peer
kubectl exec -n kube-system <cilium-pod> -- nc -zv <peer-ip> 179

# Check logs
kubectl logs -n kube-system -l k8s-app=cilium --tail=50 | grep -i bgp
\`\`\``,
      solution: `**Common causes:**

1. **Port 179 blocked:** BGP uses TCP 179. Check firewall between nodes and router.

2. **Incorrect ASN:** localASN and peerASN must match the external router configuration.

3. **nodeSelector doesn't match:** Check nodes with BGP enabled have correct labels:
\`\`\`bash
kubectl label node <node-name> bgp=enabled
\`\`\`

4. **Graceful restart:** Enable to prevent flapping:
\`\`\`yaml
gracefulRestart:
  enabled: true
  restartTimeSeconds: 120
\`\`\``
    },
    {
      title: 'DSR causing connection issues',
      difficulty: 'medium',
      symptom: 'After enabling DSR, clients receive timeouts or connection resets in some scenarios.',
      diagnosis: `\`\`\`bash
# Check LB mode
cilium config view | grep loadbalancer

# Check if DSR is active
cilium config view | grep dsr

# Test with curl
curl -v http://<service-ip>/

# Check MTU
ip link show | grep mtu
\`\`\``,
      solution: `**Common causes and solutions:**

1. **External LB masks source IP:** DSR needs the backend to see the real client IP. If there's a front LB doing SNAT, DSR won't work. Solution: use SNAT mode in this scenario.

2. **MTU mismatch:** DSR may encapsulate packets, increasing size. Adjust MTU:
\`\`\`bash
helm upgrade cilium cilium/cilium --set mtu=1450
\`\`\`

3. **Firewall blocking direct response:** In DSR, response goes from backend directly to client with different source IP than expected. Stateful firewalls may block. Adjust rules.

4. **Fallback to SNAT:** If DSR isn't viable, use SNAT with Maglev:
\`\`\`bash
helm upgrade cilium cilium/cilium --set loadBalancer.mode=snat
\`\`\``
    }
  ]
};
