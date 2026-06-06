window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['istio-advanced/istio-ambient'] = {
  theory: `# Istio Ambient Mesh (sidecar-less)

## Relevance
Ambient mesh is the biggest architectural shift in Istio since the sidecar. It reached **GA in Istio 1.24 (Nov 2024)** and is the recommended direction for new adoption. Instead of injecting an Envoy proxy into every Pod, Ambient splits the mesh into **two independent layers**: a mandatory L4 layer (ztunnel) and an optional L7 layer (waypoint). This removes per-Pod CPU/memory overhead, eliminates Pod restarts to join/leave the mesh, and simplifies upgrades.

## Core Concepts

### The two layers
- **Secure Overlay (L4) - ztunnel**: a **DaemonSet** (one ztunnel per node, not per Pod) written in Rust. Handles **mTLS, identity (SPIFFE), L4 authorization, and TCP telemetry**. All traffic between mesh Pods flows through ztunnel using the **HBONE** protocol (HTTP-Based Overlay Network Environment: mTLS over HTTP/2 CONNECT on port **15008**).
- **Waypoint Proxy (L7)**: an optional **Envoy Deployment**, provisioned **per namespace or per service account**, not per Pod. Only needed when you require L7 features: HTTP routing, retries, fault injection, AuthorizationPolicy by method/path/header, weighted traffic splitting.

### Mental model
> "L4 for free, L7 when you need it." You put a namespace in the mesh and immediately get mTLS + identity with no proxy in the Pod. You only add a waypoint to namespaces that actually need L7 policy.

### How a Pod joins the mesh
There is no more sidecar injection. You label the **namespace**:
\`\`\`
kubectl label namespace default istio.io/dataplane-mode=ambient
\`\`\`
Existing Pods join the mesh **without restart**. The node redirects their traffic to the local ztunnel via eBPF/iptables managed by the Istio CNI.

## Ambient vs Sidecar

| Aspect | Sidecar | Ambient |
|---|---|---|
| L4 proxy | Envoy per Pod | ztunnel per node (DaemonSet) |
| L7 proxy | Envoy per Pod | waypoint per namespace/SA (optional) |
| Join the mesh | inject sidecar + **restart Pod** | label namespace, **no restart** |
| Per-Pod cost | ~1 Envoy (fixed CPU/mem) | ~0 (only shared L4) |
| Dataplane upgrade | restart all Pods | update ztunnel/waypoint |
| When L7 exists | always present | only where needed |

## Essential Commands
\`\`\`bash
# Install Istio with the ambient profile
istioctl install --set profile=ambient --skip-confirmation

# Expected components: istio-cni (DaemonSet), ztunnel (DaemonSet), istiod
kubectl get daemonset -n istio-system            # ztunnel + istio-cni
kubectl get pods -n istio-system

# Put a namespace in the mesh (automatic L4 mTLS, no restart)
kubectl label namespace default istio.io/dataplane-mode=ambient

# Provision an L7 waypoint for the namespace
istioctl waypoint apply -n default --enroll-namespace

# List waypoints
istioctl waypoint list -n default

# Inspect a node's ztunnel configuration
istioctl ztunnel-config workloads
istioctl ztunnel-config services

# View applied identity/policies
istioctl ztunnel-config policies
\`\`\`

## YAML Examples

### 1. Enable ambient on a namespace
\`\`\`yaml
apiVersion: v1
kind: Namespace
metadata:
  name: shop
  labels:
    istio.io/dataplane-mode: ambient
\`\`\`

### 2. Per-namespace waypoint (Gateway API)
The waypoint is modeled as a Gateway API **Gateway** using the Istio GatewayClass:
\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: waypoint
  namespace: shop
  labels:
    istio.io/waypoint-for: service   # service | workload | all | none
spec:
  gatewayClassName: istio-waypoint
  listeners:
  - name: mesh
    port: 15008
    protocol: HBONE
\`\`\`

### 3. L7 policy (only works with a waypoint present)
\`\`\`yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: only-get-reviews
  namespace: shop
spec:
  targetRefs:
  - kind: Service
    group: ""
    name: reviews
  action: ALLOW
  rules:
  - to:
    - operation:
        methods: ["GET"]      # HTTP method rule -> needs L7 -> needs waypoint
\`\`\`

### 4. L7 traffic splitting with HTTPRoute (goes through the waypoint)
\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: reviews-canary
  namespace: shop
spec:
  parentRefs:
  - group: ""
    kind: Service
    name: reviews
    port: 9080
  rules:
  - backendRefs:
    - name: reviews-v1
      port: 9080
      weight: 90
    - name: reviews-v2
      port: 9080
      weight: 10
\`\`\`

## Common Mistakes
- **Expecting L7 policy without a waypoint**: an \`AuthorizationPolicy\` with method/path/header, or a \`VirtualService\`/\`HTTPRoute\`, **only takes effect if a waypoint** is in the path. Without one you only have L4 (identity/port).
- **Pointing an L7 AuthorizationPolicy at \`selector\` instead of \`targetRefs\`**: in ambient, L7 policies attach to the waypoint via \`targetRefs\` (Service or Gateway), not a Pod selector like in sidecar mode.
- **Mixing sidecar and ambient on the same Pod**: a Pod with an injected sidecar must **not** be in an ambient namespace; pick one mode per workload.
- **Blocking port 15008**: a NetworkPolicy or node firewall that blocks HBONE (15008) breaks all mesh traffic.
- **Thinking ztunnel does L7**: ztunnel is strictly L4 (mTLS/identity/TCP). Anything HTTP-aware requires a waypoint.

## Killer.sh Style Challenge
You are given a cluster with Istio already installed in the ambient profile. In the \`shop\` namespace the team wants: (1) all pod-to-pod traffic encrypted with mTLS **without restarting Pods**; (2) the \`reviews\` Service should accept **only GET requests** coming from the \`productpage\` Service. Enable ambient on the namespace, provision a waypoint, and create the correct AuthorizationPolicy. Validate that the method rule only takes effect **after** the waypoint is Running, and prove mTLS with \`istioctl ztunnel-config workloads\`.`,
  quiz: [
    {
      question: 'In Istio Ambient, which component provides the L4 layer (mTLS, identity) and how is it deployed?',
      options: [
        'ztunnel, as a DaemonSet (one per node)',
        'Envoy, as a sidecar in every Pod',
        'waypoint, as a Deployment per namespace',
        'istiod, as a central Deployment'
      ],
      correct: 0,
      explanation: 'The L4 Secure Overlay is provided by ztunnel, a DaemonSet (one per node, not per Pod), written in Rust, responsible for mTLS, SPIFFE identity, L4 authorization, and TCP telemetry.',
      reference: 'Related concept: the two ambient layers — study the Core Concepts section.'
    },
    {
      question: 'Which protocol does ztunnel use to tunnel mTLS traffic between nodes, and on which port?',
      options: [
        'HBONE (mTLS over HTTP/2 CONNECT) on port 15008',
        'plain gRPC on port 15010',
        'WireGuard on port 51871',
        'TLS passthrough on port 443'
      ],
      correct: 0,
      explanation: 'ztunnel uses HBONE (HTTP-Based Overlay Network Environment): mTLS encapsulated in HTTP/2 CONNECT, on port 15008. Blocking that port breaks the mesh.',
      reference: 'Related concept: HBONE and port 15008 — see Common Mistakes.'
    },
    {
      question: 'When is a waypoint proxy actually required in Ambient mesh?',
      options: [
        'When you need L7 features: HTTP routing, retries, or AuthorizationPolicy by method/path/header',
        'Always, because without a waypoint there is no mTLS',
        'Only for external ingress traffic',
        'Only when the cluster has more than one node'
      ],
      correct: 0,
      explanation: 'The waypoint (Envoy per namespace/SA) is only needed for L7. mTLS, identity, and L4 policy already come from ztunnel without a waypoint. "L4 for free, L7 when you need it."',
      reference: 'Related concept: the L4/L7 mental model — see Core Concepts.'
    },
    {
      question: 'How does an existing Pod join the ambient mesh?',
      options: [
        'By labeling the namespace with istio.io/dataplane-mode=ambient, without restarting the Pod',
        'By adding an injection annotation and restarting the Pod',
        'By recreating the Deployment with a manual initContainer',
        'By installing an Envoy sidecar via istioctl kube-inject'
      ],
      correct: 0,
      explanation: 'In ambient there is no sidecar injection. Labeling the namespace with istio.io/dataplane-mode=ambient puts Pods in the mesh without restart; the Istio CNI redirects traffic to the local ztunnel.',
      reference: 'Related concept: joining the mesh without restart — see the Ambient vs Sidecar table.'
    },
    {
      question: 'An AuthorizationPolicy allowing only the GET method in an ambient namespace is having no effect. What is the most likely cause?',
      options: [
        'There is no waypoint provisioned, so there is no L7 layer to evaluate the method rule',
        'ztunnel does not support mTLS in that namespace',
        'Port 15008 is open too wide',
        'istiod must be restarted after each policy'
      ],
      correct: 0,
      explanation: 'L7 rules (method/path/header) require a waypoint in the path. Without one, ztunnel only enforces L4 (identity/port), so the GET method rule is ignored.',
      reference: 'Related concept: L7 policy requires a waypoint — see Common Mistakes.'
    },
    {
      question: 'How is the waypoint proxy modeled declaratively in Istio Ambient?',
      options: [
        'As a Gateway API Gateway resource with gatewayClassName istio-waypoint',
        'As an Envoy Deployment created manually by the user',
        'As a field inside PeerAuthentication',
        'As an annotation on the target Pod'
      ],
      correct: 0,
      explanation: 'The waypoint is a Gateway API Gateway with gatewayClassName: istio-waypoint and the istio.io/waypoint-for label. istioctl waypoint apply generates this resource.',
      reference: 'Related concept: waypoint as a Gateway — see YAML Examples.'
    },
    {
      question: 'What is the main cost advantage of Ambient over sidecar mode?',
      options: [
        'L4 is shared per node (ztunnel), eliminating ~1 Envoy of CPU/memory per Pod',
        'It removes the need for mTLS in the cluster',
        'It eliminates istiod from the control plane',
        'It runs L7 inside the kernel via eBPF with no Envoy'
      ],
      correct: 0,
      explanation: 'With sidecars every Pod carries an Envoy. In ambient, L4 is a shared per-node ztunnel and L7 (waypoint) only exists where needed, drastically reducing per-Pod overhead.',
      reference: 'Related concept: the Ambient vs Sidecar cost table.'
    }
  ],
  flashcards: [
    { front: 'What are the two layers of Istio Ambient?', back: 'L4 Secure Overlay (ztunnel, DaemonSet per node: mTLS/identity/L4) and L7 Waypoint (Envoy per namespace/SA, optional: HTTP routing, policy by method/path/header).' },
    { front: 'What is HBONE and which port does it use?', back: 'HTTP-Based Overlay Network Environment: mTLS encapsulated in HTTP/2 CONNECT, used by ztunnel to tunnel traffic between nodes on port 15008.' },
    { front: 'How do you put a namespace in the ambient mesh?', back: 'kubectl label namespace <ns> istio.io/dataplane-mode=ambient — Pods join without restart.' },
    { front: 'Does ztunnel do L7?', back: 'No. ztunnel is strictly L4 (mTLS, SPIFFE identity, port-based authorization, TCP telemetry). Any L7 (HTTP) requires a waypoint.' },
    { front: 'When do you need a waypoint?', back: 'When you need L7 features: HTTP routing, retries, fault injection, weighted traffic splitting, or AuthorizationPolicy by method/path/header.' },
    { front: 'How is the waypoint provisioned and modeled?', back: 'istioctl waypoint apply -n <ns> --enroll-namespace; it is modeled as a Gateway API Gateway with gatewayClassName: istio-waypoint.' },
    { front: 'Joining the mesh: sidecar vs ambient?', back: 'Sidecar injects an Envoy and requires a Pod restart. Ambient labels the namespace and Pods join without restart.' }
  ],
  lab: {
    scenario: 'You have a cluster with Istio installed in the ambient profile. The shop namespace runs productpage and reviews. The team wants automatic mTLS and an L7 rule that only allows GET on reviews.',
    objective: 'Enable ambient on a namespace, provision a waypoint, and apply an L7 AuthorizationPolicy, understanding the L4/L7 boundary.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Enable ambient on the namespace and validate L4 mTLS',
        instruction: 'Label the `shop` namespace to join the ambient mesh and confirm the workloads are managed by ztunnel without restarting Pods.',
        hints: ['The label is istio.io/dataplane-mode=ambient', 'ztunnel is a DaemonSet in istio-system', 'istioctl ztunnel-config workloads shows the covered workloads'],
        solution: '```bash\nkubectl label namespace shop istio.io/dataplane-mode=ambient\n\n# Pods do NOT restart; the Istio CNI redirects to the local ztunnel\nkubectl get pods -n shop -o wide\n\n# ztunnel running as a DaemonSet (one per node)\nkubectl get daemonset ztunnel -n istio-system\n```',
        verify: '```bash\n# The namespace must have the ambient label\nkubectl get ns shop --show-labels | grep dataplane-mode=ambient\n\n# shop workloads should appear covered by ztunnel (HBONE protocol)\nistioctl ztunnel-config workloads | grep shop\n# Expected output: lines with NAMESPACE=shop and PROTOCOL=HBONE\n```'
      },
      {
        title: 'Provision the namespace L7 waypoint',
        instruction: 'Create a waypoint for the `shop` namespace (required for any L7 policy/routing) and confirm it is Running.',
        hints: ['istioctl waypoint apply', 'The waypoint becomes a Gateway API Gateway (gatewayClassName istio-waypoint)', 'Wait for the waypoint Pod to be Ready before testing L7 rules'],
        solution: '```bash\nistioctl waypoint apply -n shop --enroll-namespace\n\n# Confirm the Gateway and the waypoint Deployment\nkubectl get gateway -n shop\nkubectl get pods -n shop -l gateway.networking.k8s.io/gateway-name=waypoint\n```',
        verify: '```bash\nistioctl waypoint list -n shop\n# Expected output: waypoint with PROGRAMMED=True\n\nkubectl get pods -n shop -l gateway.networking.k8s.io/gateway-name=waypoint\n# Expected output: 1 waypoint Pod Running/Ready\n```'
      },
      {
        title: 'Apply an L7 AuthorizationPolicy (GET-only on reviews)',
        instruction: 'Create an AuthorizationPolicy that allows only the GET method on the `reviews` Service, attached to the waypoint via targetRefs. Validate the method rule only applies with the waypoint present.',
        hints: ['Use action: ALLOW with operation.methods: ["GET"]', 'In ambient the L7 policy uses targetRefs (kind: Service), not a selector', 'Test a POST: should be denied; a GET: allowed'],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: security.istio.io/v1\nkind: AuthorizationPolicy\nmetadata:\n  name: only-get-reviews\n  namespace: shop\nspec:\n  targetRefs:\n  - kind: Service\n    group: ""\n    name: reviews\n  action: ALLOW\n  rules:\n  - to:\n    - operation:\n        methods: ["GET"]\nEOF\n```',
        verify: '```bash\n# From productpage, GET should pass (200) and POST should be denied (403)\nkubectl exec -n shop deploy/productpage -- curl -s -o /dev/null -w "%{http_code}\\n" http://reviews:9080/health\n# Expected output: 200\nkubectl exec -n shop deploy/productpage -- curl -s -o /dev/null -w "%{http_code}\\n" -X POST http://reviews:9080/health\n# Expected output: 403 (the L7 rule only works because the waypoint exists)\n```'
      }
    ]
  },
  troubleshooting: [
    {
      title: 'L7 AuthorizationPolicy ignored (no waypoint)',
      difficulty: 'medium',
      symptom: 'An AuthorizationPolicy restricting by HTTP method (e.g., GET only) has no effect in the ambient namespace; POSTs keep going through.',
      diagnosis: '```bash\n# Is there a waypoint in the namespace?\nistioctl waypoint list -n shop\nkubectl get gateway -n shop\n\n# Does the policy point at a Service via targetRefs?\nkubectl get authorizationpolicy -n shop -o yaml | grep -A4 targetRefs\n```',
      solution: 'L7 rules (method/path/header) are only evaluated by a waypoint. Provision one: `istioctl waypoint apply -n shop --enroll-namespace` and ensure the policy uses `targetRefs` pointing at the Service/Gateway (not `selector`). Without a waypoint, ztunnel only enforces L4 and the method rule is ignored.'
    },
    {
      title: 'Mesh traffic broken after a NetworkPolicy',
      difficulty: 'hard',
      symptom: 'After applying a restrictive NetworkPolicy, communication between ambient mesh Pods stops working with timeouts.',
      diagnosis: '```bash\n# ztunnel uses HBONE on port 15008 between nodes\nkubectl get networkpolicy -A\nistioctl ztunnel-config workloads | grep shop\n\n# ztunnel logs on the affected node\nkubectl logs -n istio-system ds/ztunnel | grep -i connect\n```',
      solution: 'The NetworkPolicy is blocking the HBONE port (15008) used by ztunnel for the inter-node mTLS tunnel. Allow traffic to port 15008 (and 15001/15006/15021 as applicable) between nodes/ztunnel, or adjust the NetworkPolicy to permit mesh identity traffic. Otherwise the secure overlay cannot establish its tunnels.'
    }
  ]
};
