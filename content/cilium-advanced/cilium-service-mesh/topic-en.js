window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cilium-advanced/cilium-service-mesh'] = {
  theory: `
# Cilium Service Mesh — Sidecar-Free Mesh

## Relevance
Cilium offers service mesh capabilities natively using eBPF, eliminating the need for sidecar proxies (like Envoy in Istio). This reduces latency, resource consumption, and operational complexity. It supports Gateway API, mTLS, traffic management, and L7 load balancing.

## Core Concepts

### Traditional Service Mesh vs Cilium

\`\`\`
Traditional Mesh (Istio/Linkerd):
  ┌─────┐    ┌─────────┐    ┌─────────┐    ┌─────┐
  │ App │───▶│ Sidecar │───▶│ Sidecar │───▶│ App │
  └─────┘    │ Envoy   │    │ Envoy   │    └─────┘
             └─────────┘    └─────────┘
  - 2 extra hops per request
  - CPU/memory overhead per pod
  - Lifecycle management complexity

Cilium Service Mesh (sidecar-free):
  ┌─────┐                              ┌─────┐
  │ App │──▶ eBPF (kernel) ───────────▶│ App │
  └─────┘   └─ Envoy (per node,       └─────┘
               only when L7 needed)
  - Zero or 1 extra hop (only for L7)
  - Envoy shared per node (not per pod)
  - Lower overhead, lower latency
\`\`\`

### Gateway API

\`\`\`yaml
# Gateway — defines the listener (entry point)
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: cilium-gateway
  namespace: production
spec:
  gatewayClassName: cilium
  listeners:
    - name: http
      protocol: HTTP
      port: 80
    - name: https
      protocol: HTTPS
      port: 443
      tls:
        mode: Terminate
        certificateRefs:
          - name: tls-secret
---
# HTTPRoute — defines routing rules
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-routes
  namespace: production
spec:
  parentRefs:
    - name: cilium-gateway
  hostnames:
    - "api.example.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api/v1
      backendRefs:
        - name: api-v1
          port: 80
          weight: 90
        - name: api-v2
          port: 80
          weight: 10
    - matches:
        - path:
            type: PathPrefix
            value: /api/v2
      backendRefs:
        - name: api-v2
          port: 80
\`\`\`

### Traffic Splitting (Canary)

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-route
  namespace: production
spec:
  parentRefs:
    - name: cilium-gateway
  hostnames:
    - "app.example.com"
  rules:
    - backendRefs:
        - name: app-stable
          port: 80
          weight: 95
        - name: app-canary
          port: 80
          weight: 5
\`\`\`

### Header-Based Routing

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: header-routing
spec:
  parentRefs:
    - name: cilium-gateway
  rules:
    # Beta users go to v2
    - matches:
        - headers:
            - name: X-User-Group
              value: beta
      backendRefs:
        - name: api-v2
          port: 80
    # Everyone else goes to v1
    - backendRefs:
        - name: api-v1
          port: 80
\`\`\`

### Mutual TLS (mTLS)

\`\`\`yaml
# Enable mTLS in Cilium
# helm values:
authentication:
  mutual:
    spiffe:
      enabled: true
      install:
        enabled: true  # auto-installs SPIRE
\`\`\`

\`\`\`
mTLS in Cilium:
  - Uses SPIFFE/SPIRE for identity
  - Automatic certificates per workload
  - Automatic rotation
  - Transparent to application (eBPF intercepts)
  - No per-service configuration

Flow:
  Pod A → eBPF → mTLS handshake → eBPF → Pod B
  (application doesn't need to know about TLS)
\`\`\`

### Comparison: Cilium vs Istio vs Linkerd

\`\`\`
| Feature          | Cilium    | Istio      | Linkerd    |
|------------------|-----------|------------|------------|
| Sidecar          | No*       | Yes        | Yes        |
| Data plane       | eBPF      | Envoy      | Linkerd    |
| mTLS             | SPIFFE    | Citadel    | Built-in   |
| L7 policies      | Yes       | Yes        | Limited    |
| Gateway API      | Yes       | Yes        | Yes        |
| Network policy   | Yes (L7)  | Yes        | No         |
| Observability    | Hubble    | Kiali      | Dashboard  |
| Overhead         | Low       | High       | Medium     |
| Complexity       | Medium    | High       | Low        |

* Cilium uses Envoy per NODE when L7 is needed,
  not per POD as a sidecar
\`\`\`

## Essential Commands

\`\`\`bash
# Gateway API
kubectl get gateways
kubectl get httproutes
kubectl describe gateway cilium-gateway

# Check Envoy in Cilium
cilium status | grep Envoy
kubectl get ciliumenvoyconfigs -A

# Check ingress controller
kubectl get ingress -A

# mTLS status
cilium identity list
cilium encrypt status

# Gateway class
kubectl get gatewayclasses
\`\`\`

## Common Mistakes

1. **GatewayClass doesn't exist**: Cilium needs to be installed with gatewayAPI.enabled=true to create the GatewayClass.
2. **Envoy not enabled**: L7 features need Envoy. Check if Envoy is enabled in Helm.
3. **mTLS without SPIRE**: mTLS requires SPIFFE/SPIRE installed. Use Cilium's integrated installer.
4. **Gateway without IP**: When using LoadBalancer, needs LB-IPAM or cloud provider LB.
5. **HTTPRoute not working**: Check parentRefs points to correct Gateway and hostnames match.

## Killer.sh Style Challenge

**Scenario:** Configure Cilium Service Mesh with Gateway API for a microservice with canary deployment.

**Tasks:**
1. Create a Gateway with HTTP and HTTPS listeners
2. Configure HTTPRoute with 90/10 traffic splitting
3. Configure header-based routing for beta users
4. Verify traffic with Hubble
`,
  quiz: [
    {
      question: 'What is the main difference between Cilium Service Mesh and a traditional mesh like Istio?',
      options: [
        'Cilium does not support mTLS',
        'Cilium uses eBPF in the kernel and shared Envoy per node (not sidecar per pod), significantly reducing overhead and latency',
        'Cilium does not support L7',
        'No difference — both use sidecars'
      ],
      correct: 1,
      explanation: 'Cilium eliminates sidecar proxies using eBPF for L3/L4 directly in the kernel and sharing Envoy instances per node (not per pod) only when L7 is needed. This reduces latency (fewer hops), CPU/memory (no per-pod proxy), and operational complexity.',
      reference: 'Related concept: cilium-architecture — eBPF enables sidecar-free mesh.'
    },
    {
      question: 'What is Gateway API in the context of Cilium?',
      options: [
        'An alternative API server',
        'The Kubernetes standard for configuring ingress, routing, and traffic management, which Cilium implements natively as an ingress controller and gateway',
        'A proprietary Cilium protocol',
        'An etcd extension'
      ],
      correct: 1,
      explanation: 'Gateway API is the successor to Ingress in Kubernetes, with features like Gateway (entry point), HTTPRoute (routing rules), traffic splitting, and header-based routing. Cilium implements the full spec, serving as both ingress controller and gateway.',
      reference: 'Related concept: cilium-service-mesh — Gateway API is more expressive than Ingress.'
    },
    {
      question: 'How does Cilium implement mTLS?',
      options: [
        'Using manual self-signed certificates',
        'Using SPIFFE/SPIRE for workload identity, with automatic certificates, automatic rotation, and transparent to the application via eBPF',
        'Each pod generates its own certificate',
        'Using TLS termination at ingress only'
      ],
      correct: 1,
      explanation: 'Cilium integrates SPIFFE/SPIRE for workload identity. SPIRE assigns SVIDs (SPIFFE Verifiable Identity Documents) to each workload. eBPF intercepts traffic and applies mTLS transparently — the application needs no changes. Certificate rotation is automatic.',
      reference: 'Related concept: cilium-service-mesh — mTLS requires SPIRE enabled in Helm.'
    },
    {
      question: 'How do you do canary deployment with Cilium and Gateway API?',
      options: [
        'Using different replicas in the Deployment',
        'Using HTTPRoute with backendRefs and weight to split traffic percentually between versions (e.g., 95% stable, 5% canary)',
        'Creating two Services with the same name',
        'Using kubectl rollout'
      ],
      correct: 1,
      explanation: 'HTTPRoute enables traffic splitting with weights in backendRefs. Configure two backends (stable and canary) with weights (95/5, 90/10). Cilium routes traffic proportionally. Combine with header-based routing to send beta users directly to canary.',
      reference: 'Related concept: cilium-service-mesh — combine weight with header routing.'
    },
    {
      question: 'Where does Envoy run in the Cilium Service Mesh model?',
      options: [
        'As a sidecar in each pod',
        'Shared per NODE (not per pod) — activated only when L7 features are needed, drastically reducing overhead',
        'In the control plane only',
        'In a separate cluster'
      ],
      correct: 1,
      explanation: 'In Cilium, Envoy is instantiated per node as part of the Cilium Agent, not as a sidecar in each pod. It is only activated when there are L7 policies or features that need HTTP proxy. L3/L4 is handled directly by eBPF without Envoy. This is significantly more efficient.',
      reference: 'Related concept: cilium-network-policies — L7 policies activate Envoy automatically.'
    },
    {
      question: 'Which Gateway API resource defines HTTP routing rules?',
      options: [
        'Gateway',
        'HTTPRoute — defines matches (path, headers, methods) and backendRefs (destination services with optional weights)',
        'GatewayClass',
        'Service'
      ],
      correct: 1,
      explanation: 'HTTPRoute defines routing rules: matches (path prefix, exact, headers) determine which traffic is affected, and backendRefs determine where it goes (services with optional weights for traffic splitting). Gateway defines listeners, GatewayClass defines the controller.',
      reference: 'Related concept: cilium-service-mesh — Gateway + HTTPRoute work together.'
    },
    {
      question: 'What is the resource overhead advantage of Cilium Service Mesh?',
      options: [
        'Uses more resources than Istio but is more secure',
        'Significantly lower overhead: no sidecar per pod, eBPF in kernel for L3/L4, and shared Envoy per node only for L7',
        'Same overhead as Istio',
        'No overhead because it has no features'
      ],
      correct: 1,
      explanation: 'In a mesh with 1000 pods, Istio would have 1000 Envoy sidecars. Cilium would have 0 sidecars — using eBPF for L3/L4 and shared Envoy per node (~10-50 instances) only when L7 is needed. CPU and memory savings are dramatic at scale.',
      reference: 'Related concept: sre-capacity — less overhead = lower cluster cost.'
    }
  ],
  flashcards: [
    {
      front: 'Cilium Service Mesh vs Traditional Mesh?',
      back: '**Traditional Mesh (Istio):**\n- Sidecar Envoy per POD\n- 2 extra hops per request\n- High CPU/mem overhead\n- 1000 pods = 1000 sidecars\n\n**Cilium Service Mesh:**\n- NO sidecar\n- eBPF in kernel (L3/L4)\n- Envoy per NODE (L7 only)\n- 1000 pods = ~10 Envoys\n\n**Result:**\n- Lower latency\n- Lower cost\n- Less complexity\n- Same L7 features\n\n**Enable:**\n```bash\nhelm install cilium cilium/cilium \\\n  --set envoyConfig.enabled=true \\\n  --set gatewayAPI.enabled=true\n```'
    },
    {
      front: 'Gateway API with Cilium?',
      back: '**GatewayClass:** defines controller\n**Gateway:** entry point (ports)\n**HTTPRoute:** routing rules\n\n**Example:**\n```yaml\napiVersion: gateway.networking.k8s.io/v1\nkind: Gateway\nmetadata:\n  name: my-gateway\nspec:\n  gatewayClassName: cilium\n  listeners:\n    - name: http\n      port: 80\n      protocol: HTTP\n---\nkind: HTTPRoute\nspec:\n  parentRefs:\n    - name: my-gateway\n  rules:\n    - matches:\n        - path:\n            value: /api\n      backendRefs:\n        - name: api-svc\n          port: 80\n```'
    },
    {
      front: 'Traffic splitting (canary) with Gateway API?',
      back: '**Canary 95/5:**\n```yaml\napiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nspec:\n  rules:\n    - backendRefs:\n        - name: app-stable\n          port: 80\n          weight: 95\n        - name: app-canary\n          port: 80\n          weight: 5\n```\n\n**Header routing (beta):**\n```yaml\n  rules:\n    - matches:\n        - headers:\n            - name: X-User-Group\n              value: beta\n      backendRefs:\n        - name: app-canary\n    - backendRefs:\n        - name: app-stable\n```\n\n**Combine both!**'
    },
    {
      front: 'mTLS in Cilium?',
      back: '**Stack:**\n- SPIFFE: identity framework\n- SPIRE: implementation\n- SVIDs: per-workload certificates\n\n**Enable:**\n```yaml\nauthentication:\n  mutual:\n    spiffe:\n      enabled: true\n      install:\n        enabled: true\n```\n\n**Features:**\n- Automatic certificates\n- Automatic rotation\n- Transparent (eBPF intercepts)\n- No app changes needed\n\n**Flow:**\nPod A → eBPF → mTLS → eBPF → Pod B\n(app doesn\'t know about TLS)'
    },
    {
      front: 'Cilium vs Istio vs Linkerd?',
      back: '**Cilium:**\n- No sidecar (eBPF)\n- Low overhead\n- L7 network policies\n- Hubble observability\n\n**Istio:**\n- Sidecar Envoy\n- High overhead\n- Feature-rich\n- Kiali observability\n\n**Linkerd:**\n- Lightweight sidecar\n- Medium overhead\n- Simple to operate\n- Built-in dashboard\n\n**When to use Cilium Mesh:**\n- Already using Cilium CNI\n- Performance critical\n- L7 policies needed\n- Want to avoid sidecars\n\n**When to use Istio:**\n- Advanced features\n- Not using Cilium CNI\n- Team already knows Istio'
    },
    {
      front: 'Envoy in Cilium — how it works?',
      back: '**Sidecar model (Istio):**\n1 Envoy per POD\n→ High overhead\n→ 2 extra hops\n\n**Cilium model:**\n1 Envoy per NODE\n→ Shared between pods\n→ Activated ONLY for L7\n→ L3/L4 = pure eBPF (no Envoy)\n\n**When Envoy is activated:**\n- L7 network policies (HTTP)\n- Gateway API routes\n- mTLS termination\n- L7 load balancing\n\n**When Envoy NOT needed:**\n- L3/L4 policies\n- Basic load balancing\n- kube-proxy replacement\n\n**CRD:**\nCiliumEnvoyConfig for\nadvanced configurations'
    }
  ],
  lab: {
    scenario: 'You need to configure Cilium as a service mesh with Gateway API to manage traffic for a microservice with canary deployment.',
    objective: 'Configure Gateway, HTTPRoute with traffic splitting and header-based routing.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Configure Gateway',
        instruction: `Create a Gateway with Cilium as the controller.

\`\`\`bash
# Check GatewayClass
kubectl get gatewayclasses

# Create Gateway
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: mesh-gateway
  namespace: default
spec:
  gatewayClassName: cilium
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: Same
EOF
\`\`\``,
        hints: [
          'GatewayClass cilium is auto-created if gatewayAPI.enabled=true',
          'allowedRoutes controls which namespaces can create HTTPRoutes',
          'If GatewayClass missing, enable: helm upgrade cilium --set gatewayAPI.enabled=true'
        ],
        solution: `\`\`\`bash
kubectl get gatewayclasses
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: mesh-gateway
spec:
  gatewayClassName: cilium
  listeners:
    - name: http
      port: 80
      protocol: HTTP
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get gateway mesh-gateway
# Expected output: NAME           CLASS    ADDRESS   PROGRAMMED   AGE
#                  mesh-gateway   cilium   ...       True         Xs

kubectl describe gateway mesh-gateway
# Expected output: Status with Accepted: True
\`\`\``
      },
      {
        title: 'Configure Canary with HTTPRoute',
        instruction: `Create deployments and configure traffic splitting with HTTPRoute.

\`\`\`bash
# Create deployments
kubectl create deployment app-stable --image=nginx
kubectl create deployment app-canary --image=nginx
kubectl expose deployment app-stable --port=80
kubectl expose deployment app-canary --port=80

# Create HTTPRoute with traffic splitting
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-route
spec:
  parentRefs:
    - name: mesh-gateway
  hostnames:
    - "app.example.com"
  rules:
    - matches:
        - headers:
            - name: X-Canary
              value: "true"
      backendRefs:
        - name: app-canary
          port: 80
    - backendRefs:
        - name: app-stable
          port: 80
          weight: 90
        - name: app-canary
          port: 80
          weight: 10
EOF
\`\`\``,
        hints: [
          'weight distributes traffic percentually between backends',
          'Header match takes priority over weight when present',
          'Use hostnames to route by domain'
        ],
        solution: `\`\`\`bash
kubectl create deployment app-stable --image=nginx
kubectl create deployment app-canary --image=nginx
kubectl expose deployment app-stable --port=80
kubectl expose deployment app-canary --port=80
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-route
spec:
  parentRefs:
    - name: mesh-gateway
  rules:
    - backendRefs:
        - name: app-stable
          port: 80
          weight: 90
        - name: app-canary
          port: 80
          weight: 10
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get httproute canary-route
# Expected output: NAME           HOSTNAMES            AGE
#                  canary-route   ["app.example.com"]  Xs

kubectl describe httproute canary-route
# Expected output: Rules with backendRefs and weights
\`\`\``
      },
      {
        title: 'Verify Traffic with Hubble',
        instruction: `Use Hubble to monitor traffic through the Gateway and validate traffic splitting.

\`\`\`bash
# Monitor HTTP traffic
hubble observe --protocol http --namespace default -f

# In another terminal, generate traffic
for i in \$(seq 1 20); do
  curl -s -H "Host: app.example.com" http://<gateway-ip>/
done

# Check distribution
hubble observe --protocol http --to-pod default/app-canary --last 20
hubble observe --protocol http --to-pod default/app-stable --last 20
\`\`\``,
        hints: [
          'Use Hubble to see actual traffic ratio between stable and canary',
          'With 20 requests and 90/10 weight, expect ~18 to stable and ~2 to canary',
          'Add -H "X-Canary: true" to force traffic to canary'
        ],
        solution: `\`\`\`bash
hubble observe --protocol http --namespace default --last 10
\`\`\``,
        verify: `\`\`\`bash
# Verify Gateway has IP
kubectl get gateway mesh-gateway -o jsonpath='{.status.addresses[0].value}'
# Expected output: Gateway IP

# Verify HTTPRoute is attached
kubectl get httproute canary-route -o jsonpath='{.status.parents[0].conditions[?(@.type=="Accepted")].status}'
# Expected output: True
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'GatewayClass cilium not found',
      difficulty: 'easy',
      symptom: 'kubectl get gatewayclasses returns nothing or does not show "cilium". Gateway stays in Pending status.',
      diagnosis: `\`\`\`bash
# Check GatewayClasses
kubectl get gatewayclasses

# Check if Gateway API is enabled
helm get values cilium -n kube-system | grep gateway

# Check Gateway API CRDs
kubectl get crd | grep gateway
\`\`\``,
      solution: `**Solutions:**

1. **Enable Gateway API in Cilium:**
\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set gatewayAPI.enabled=true
\`\`\`

2. **Install Gateway API CRDs** (if they don't exist):
\`\`\`bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/gateway-api/v1.0.0/config/crd/standard/gateway.networking.k8s.io_gatewayclasses.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/gateway-api/v1.0.0/config/crd/standard/gateway.networking.k8s.io_gateways.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/gateway-api/v1.0.0/config/crd/standard/gateway.networking.k8s.io_httproutes.yaml
\`\`\`

3. **Check Cilium Operator** is running — it creates the GatewayClass.`
    },
    {
      title: 'HTTPRoute not routing traffic',
      difficulty: 'medium',
      symptom: 'HTTPRoute created but requests do not reach backends. Returns 404 or connection refused.',
      diagnosis: `\`\`\`bash
# Check HTTPRoute status
kubectl describe httproute <name>

# Check parentRef is correct
kubectl get httproute <name> -o jsonpath='{.spec.parentRefs}'

# Check Gateway status
kubectl describe gateway <gateway-name>

# Check backends exist
kubectl get svc <backend-name>
kubectl get endpoints <backend-name>
\`\`\``,
      solution: `**Solutions:**

1. **Check parentRefs:** HTTPRoute must reference the correct Gateway by name.

2. **Check hostnames:** If HTTPRoute has hostnames, the request must include the correct Host header:
\`\`\`bash
curl -H "Host: app.example.com" http://<gateway-ip>/
\`\`\`

3. **Check backends:** Referenced Services must exist and have endpoints:
\`\`\`bash
kubectl get endpoints <service-name>
\`\`\`

4. **Check Cilium logs:**
\`\`\`bash
kubectl logs -n kube-system -l k8s-app=cilium --tail=20 | grep -i gateway
\`\`\``
    },
    {
      title: 'mTLS not working between services',
      difficulty: 'hard',
      symptom: 'After enabling mTLS, services cannot communicate. Timeouts and TLS handshake errors.',
      diagnosis: `\`\`\`bash
# Check SPIRE status
kubectl get pods -n cilium-spire

# Check identities
cilium identity list

# Check encrypt status
cilium encrypt status

# Check SPIRE logs
kubectl logs -n cilium-spire -l app=spire-agent --tail=20
\`\`\``,
      solution: `**Solutions:**

1. **SPIRE not installed:** Enable with integrated installation:
\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set authentication.mutual.spiffe.enabled=true \\
  --set authentication.mutual.spiffe.install.enabled=true
\`\`\`

2. **SPIRE agent not running:** Verify SPIRE agent is on each node:
\`\`\`bash
kubectl get pods -n cilium-spire -o wide
\`\`\`

3. **Identities not registered:** SPIRE needs time to register workloads. Wait and check:
\`\`\`bash
kubectl exec -n cilium-spire spire-server-0 -- /opt/spire/bin/spire-server entry show
\`\`\``
    }
  ]
};
