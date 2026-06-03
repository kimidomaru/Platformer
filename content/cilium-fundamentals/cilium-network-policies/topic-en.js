window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cilium-fundamentals/cilium-network-policies'] = {
  theory: `
# Cilium Network Policies — L3-L7 Security with eBPF

## Relevance
CiliumNetworkPolicy extends standard Kubernetes NetworkPolicy with L7 support (HTTP, gRPC, Kafka, DNS), FQDN-based rules, identity-aware policies, and host-level policies. Mastering these policies is fundamental for zero-trust security in Kubernetes.

## Core Concepts

### NetworkPolicy vs CiliumNetworkPolicy

\`\`\`
NetworkPolicy (K8s native):
  - L3/L4 only (IP, port, protocol)
  - Selection by labels and namespaces
  - No FQDN support
  - No L7 rules

CiliumNetworkPolicy (CNP):
  - L3/L4 + L7 (HTTP paths, methods, headers)
  - Identity-aware (labels, not IPs)
  - FQDN-based egress rules
  - DNS-aware policies
  - Host-level policies (CiliumClusterwideNetworkPolicy)
  - TLS SNI filtering
\`\`\`

### CiliumNetworkPolicy Structure

\`\`\`yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: frontend-policy
  namespace: production
spec:
  endpointSelector:
    matchLabels:
      app: frontend
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: api-gateway
      toPorts:
        - ports:
            - port: "8080"
              protocol: TCP
          rules:
            http:
              - method: GET
                path: "/api/v1/.*"
  egress:
    - toEndpoints:
        - matchLabels:
            app: backend
      toPorts:
        - ports:
            - port: "3000"
              protocol: TCP
    - toFQDNs:
        - matchPattern: "*.googleapis.com"
      toPorts:
        - ports:
            - port: "443"
              protocol: TCP
\`\`\`

### L7 Policies — HTTP

\`\`\`yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: api-l7-policy
  namespace: production
spec:
  endpointSelector:
    matchLabels:
      app: api-server
  ingress:
    - fromEndpoints:
        - matchLabels:
            role: frontend
      toPorts:
        - ports:
            - port: "8080"
              protocol: TCP
          rules:
            http:
              # Allow only GET and POST on /api/
              - method: GET
                path: "/api/.*"
              - method: POST
                path: "/api/v1/orders"
                headers:
                  - 'Content-Type: application/json'
\`\`\`

### L7 Policies — gRPC and Kafka

\`\`\`yaml
# gRPC policy
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: grpc-policy
spec:
  endpointSelector:
    matchLabels:
      app: grpc-service
  ingress:
    - toPorts:
        - ports:
            - port: "50051"
          rules:
            http:
              - method: POST
                path: "/mypackage.MyService/.*"
---
# Kafka policy
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: kafka-policy
spec:
  endpointSelector:
    matchLabels:
      app: kafka-consumer
  egress:
    - toEndpoints:
        - matchLabels:
            app: kafka
      toPorts:
        - ports:
            - port: "9092"
          rules:
            kafka:
              - apiKey: "produce"
                topic: "orders"
              - apiKey: "fetch"
                topic: "orders"
\`\`\`

### FQDN-Based Egress

\`\`\`yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: external-access
  namespace: production
spec:
  endpointSelector:
    matchLabels:
      app: payment-service
  egress:
    # Allow access only to specific external APIs
    - toFQDNs:
        - matchName: "api.stripe.com"
        - matchName: "api.paypal.com"
        - matchPattern: "*.amazonaws.com"
      toPorts:
        - ports:
            - port: "443"
              protocol: TCP
    # Allow DNS to resolve FQDNs
    - toEndpoints:
        - matchLabels:
            k8s:io.kubernetes.pod.namespace: kube-system
            k8s-app: kube-dns
      toPorts:
        - ports:
            - port: "53"
              protocol: UDP
          rules:
            dns:
              - matchPattern: "*"
\`\`\`

### CiliumClusterwideNetworkPolicy

\`\`\`yaml
# Policy that applies to the ENTIRE cluster
apiVersion: cilium.io/v2
kind: CiliumClusterwideNetworkPolicy
metadata:
  name: deny-external-by-default
spec:
  endpointSelector:
    matchLabels:
      env: production
  egress:
    - toEntities:
        - cluster
        - kube-apiserver
    - toCIDR:
        - 10.0.0.0/8
    - toFQDNs:
        - matchPattern: "*.internal.company.com"
      toPorts:
        - ports:
            - port: "443"
\`\`\`

### Entities — Destination Abstractions

\`\`\`
Cilium Entities:
  host         → The node where the pod runs
  remote-node  → Other cluster nodes
  world        → Any IP external to the cluster
  cluster      → Any endpoint in the cluster
  kube-apiserver → Kubernetes API server
  health       → Cilium health endpoints
  init         → Endpoints being initialized

Usage example:
  egress:
    - toEntities:
        - cluster       # allow everything inside cluster
        - kube-apiserver # allow API server access
    - toEntities:
        - world         # blocks if not listed
\`\`\`

### Default Deny

\`\`\`yaml
# Deny all ingress and egress for the namespace
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  endpointSelector: {}
  ingress:
    - {}
  egress:
    - {}
---
# More restrictive version: denies EVERYTHING
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: strict-deny-all
  namespace: production
spec:
  endpointSelector: {}
\`\`\`

## Essential Commands

\`\`\`bash
# List CiliumNetworkPolicies
kubectl get cnp -A
kubectl get ccnp  # cluster-wide

# Describe a policy
kubectl describe cnp <name> -n <namespace>

# Check policy enforcement
cilium endpoint list
cilium policy get

# Monitor policy verdicts
cilium monitor --type policy-verdict
cilium monitor --type drop

# Check policy on specific endpoint
cilium bpf policy get <endpoint-id>

# Identities and labels
cilium identity list
cilium identity get <identity-id>
\`\`\`

## Common Mistakes

1. **Forgetting DNS egress**: FQDN policies need explicit DNS rules allowing resolution (port 53/UDP to CoreDNS).
2. **Policy without match**: Empty endpointSelector ({}) selects ALL pods in the namespace — beware of accidental deny-all.
3. **L7 without proxy**: L7 policies (HTTP, Kafka) require Envoy proxy — verify it's enabled.
4. **Order of evaluation**: Cilium uses whitelist — if there's a policy on the endpoint, everything not explicitly allowed is denied.
5. **FQDN cache expiry**: FQDNs are resolved via DNS and cached. Short TTL can cause intermittent failures.

## Killer.sh Style Challenge

**Scenario:** Configure zero-trust security for a microservice with L3-L7 policies.

**Tasks:**
1. Apply default deny on a namespace
2. Create L7 rule allowing only GET /api/v1/products
3. Create FQDN rule for external API access
4. Verify policy verdicts with cilium monitor
`,
  quiz: [
    {
      question: 'What is the main advantage of CiliumNetworkPolicy over standard Kubernetes NetworkPolicy?',
      options: [
        'It is faster because it uses iptables',
        'L7 rule support (HTTP, gRPC, Kafka, DNS), FQDN-based egress, and identity-aware policies, beyond standard L3/L4',
        'It does not need labels to work',
        'It works without a CNI installed'
      ],
      correct: 1,
      explanation: 'CiliumNetworkPolicy extends NetworkPolicy with: L7 rules (HTTP method/path inspection, gRPC, Kafka topics), FQDN egress (allow by domain), DNS-aware filtering, and identity-based matching. All using eBPF for efficient enforcement in the kernel.',
      reference: 'Related concept: cilium-architecture — eBPF enables L7 inspection in the kernel.'
    },
    {
      question: 'What happens when you apply a CiliumNetworkPolicy to an endpoint?',
      options: [
        'All traffic continues normally',
        'Only explicitly defined traffic in the policy is allowed — the model is whitelist, everything else is denied by default',
        'Only defined traffic is blocked',
        'The pod is restarted to apply the policy'
      ],
      correct: 1,
      explanation: 'Cilium uses a whitelist model: when at least one policy is applied to an endpoint, ALL traffic not explicitly allowed is denied. This is different from a blacklist model. This is why default-deny is applied when any CNP is created for that endpoint.',
      reference: 'Related concept: cilium-network-policies — be careful when applying the first policy.'
    },
    {
      question: 'Why do FQDN policies require an explicit DNS rule?',
      options: [
        'They don\'t — FQDN works automatically',
        'Because the pod needs to resolve the domain via DNS before connecting, and without DNS egress permission (port 53) resolution fails and the connection doesn\'t happen',
        'Because Cilium uses DNS as a proxy',
        'Because FQDN is an alias for a fixed IP'
      ],
      correct: 1,
      explanation: 'FQDN policies work by intercepting DNS responses to map domains to IPs. If the pod cannot make DNS queries (port 53/UDP to CoreDNS), it cannot resolve the domain and the connection fails. Always include a DNS egress rule alongside toFQDNs rules.',
      reference: 'Related concept: cilium-network-policies — always allow DNS when using toFQDNs.'
    },
    {
      question: 'What are Entities in Cilium?',
      options: [
        'Container types',
        'Pre-defined destination abstractions like host, world, cluster, kube-apiserver, and remote-node, used in policies to simplify rules',
        'Namespace names',
        'Kubernetes service types'
      ],
      correct: 1,
      explanation: 'Entities are abstractions representing common destinations: host (local node), world (external IPs), cluster (any internal endpoint), kube-apiserver (API server), remote-node (other nodes). They simplify policies by avoiding hardcoded CIDRs.',
      reference: 'Related concept: cilium-network-policies — use entities for cleaner rules.'
    },
    {
      question: 'How do L7 HTTP policies work in Cilium?',
      options: [
        'They filter packets by payload size',
        'They use Envoy proxy to inspect HTTP traffic and apply rules by method (GET, POST), path (regex), and headers before forwarding to the pod',
        'They block all HTTP traffic automatically',
        'They redirect traffic to an external WAF'
      ],
      correct: 1,
      explanation: 'L7 policies use Envoy proxy integrated with Cilium to inspect HTTP content. You can filter by method (GET, POST, PUT), path (supports regex), and headers. Traffic passes through Envoy, which applies rules before forwarding to the destination pod.',
      reference: 'Related concept: cilium-service-mesh — Envoy is shared with service mesh features.'
    },
    {
      question: 'What is the difference between CiliumNetworkPolicy and CiliumClusterwideNetworkPolicy?',
      options: [
        'There is no difference',
        'CiliumNetworkPolicy is namespaced (applies to pods in one namespace); CiliumClusterwideNetworkPolicy has no namespace and can apply to pods in any namespace',
        'CiliumClusterwideNetworkPolicy only works with L7',
        'CiliumNetworkPolicy only works with L3'
      ],
      correct: 1,
      explanation: 'CiliumNetworkPolicy (CNP) is namespaced — it only affects pods in the namespace where it is created. CiliumClusterwideNetworkPolicy (CCNP) is cluster-scoped and can affect pods in any namespace. CCNP is ideal for global policies like default-deny or egress restrictions.',
      reference: 'Related concept: cilium-network-policies — CCNP is useful for security baselines.'
    },
    {
      question: 'How can you monitor policy verdicts in real-time in Cilium?',
      options: [
        'kubectl get events',
        'cilium monitor --type policy-verdict shows in real-time which packets were allowed or denied and by which policy',
        'cilium policy list',
        'kubectl logs cilium-agent'
      ],
      correct: 1,
      explanation: 'cilium monitor --type policy-verdict shows each policy decision in real-time: ALLOWED, DENIED, or DROPPED. It includes information about source/dest identity, port, and which policy caused the decision. Essential for policy debugging.',
      reference: 'Related concept: cilium-hubble — Hubble offers even richer flow visibility.'
    }
  ],
  flashcards: [
    {
      front: 'NetworkPolicy vs CiliumNetworkPolicy?',
      back: '**NetworkPolicy (K8s native):**\n- L3/L4 only (IP, port)\n- Selection by labels\n- No FQDN\n- No L7\n\n**CiliumNetworkPolicy:**\n- L3/L4 + L7 (HTTP, gRPC, Kafka)\n- Identity-aware\n- FQDN egress\n- DNS-aware\n- Host-level (CCNP)\n- TLS SNI filtering\n\n**Model:** Whitelist\nIf policy exists, everything not\nexplicitly allowed is denied\n\n**CRDs:**\n- CNP = namespaced\n- CCNP = cluster-wide'
    },
    {
      front: 'L7 HTTP policy in Cilium?',
      back: '**How it works:**\n- Envoy proxy inspects HTTP\n- Filters by method, path, headers\n\n**Example:**\n```yaml\ningress:\n  - fromEndpoints:\n      - matchLabels:\n          app: frontend\n    toPorts:\n      - ports:\n          - port: \"8080\"\n        rules:\n          http:\n            - method: GET\n              path: \"/api/.*\"\n            - method: POST\n              path: \"/api/orders\"\n```\n\n**Supports:**\n- HTTP methods\n- Path regex\n- Headers\n- gRPC services\n- Kafka topics/apiKeys'
    },
    {
      front: 'FQDN-based egress policies?',
      back: '**Purpose:**\nAllow egress by domain\n(not by IP)\n\n**Example:**\n```yaml\negress:\n  - toFQDNs:\n      - matchName: \"api.stripe.com\"\n      - matchPattern: \"*.aws.com\"\n    toPorts:\n      - ports:\n          - port: \"443\"\n```\n\n**REQUIRED: allow DNS!**\n```yaml\n  - toEndpoints:\n      - matchLabels:\n          k8s-app: kube-dns\n    toPorts:\n      - ports:\n          - port: \"53\"\n            protocol: UDP\n```\n\n**No DNS = FQDN won\'t work!**'
    },
    {
      front: 'Entities in Cilium?',
      back: '**Destination abstractions:**\n- **host**: node where pod runs\n- **remote-node**: other nodes\n- **world**: external IPs\n- **cluster**: internal endpoints\n- **kube-apiserver**: API server\n- **health**: health endpoints\n- **init**: initializing\n\n**Example:**\n```yaml\negress:\n  - toEntities:\n      - cluster\n      - kube-apiserver\n```\n→ Allows all internal\n→ Allows API server\n→ Blocks world implicitly\n\n**Advantage:**\nNo need to hardcode CIDRs!'
    },
    {
      front: 'Default deny in Cilium?',
      back: '**Whitelist model:**\nIf policy exists, everything not\nallowed is DENIED\n\n**Explicit deny all:**\n```yaml\napiVersion: cilium.io/v2\nkind: CiliumNetworkPolicy\nmetadata:\n  name: default-deny\nspec:\n  endpointSelector: {}\n```\n→ {} selects ALL pods\n→ No ingress/egress = deny all\n\n**Then allow selectively:**\n```yaml\nspec:\n  endpointSelector:\n    matchLabels:\n      app: api\n  ingress:\n    - fromEndpoints:\n        - matchLabels:\n            app: frontend\n```\n\n**Zero-trust = deny by default**'
    },
    {
      front: 'Commands for policy debugging?',
      back: '**List policies:**\n```bash\nkubectl get cnp -A\nkubectl get ccnp\n```\n\n**Policy verdicts:**\n```bash\ncilium monitor --type policy-verdict\ncilium monitor --type drop\n```\n\n**Policy on endpoint:**\n```bash\ncilium endpoint list\ncilium bpf policy get <ep-id>\n```\n\n**Identities:**\n```bash\ncilium identity list\ncilium identity get <id>\n```\n\n**Policy computed:**\n```bash\ncilium policy get\ncilium policy selectors\n```'
    }
  ],
  lab: {
    scenario: 'You need to implement zero-trust security for a microservice using CiliumNetworkPolicies with L3, L4, and L7 rules.',
    objective: 'Apply default deny, create L7 HTTP rules, configure FQDN egress, and validate with cilium monitor.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Apply Default Deny',
        instruction: `Create a CiliumNetworkPolicy default deny for the test namespace.

\`\`\`bash
# Create test namespace
kubectl create namespace policy-demo
kubectl label namespace policy-demo env=demo

# Test deployments
kubectl create deployment frontend --image=nginx --namespace=policy-demo
kubectl create deployment backend --image=nginx --namespace=policy-demo
kubectl expose deployment backend --port=80 --namespace=policy-demo

# Default deny
kubectl apply -f - <<EOF
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: default-deny
  namespace: policy-demo
spec:
  endpointSelector: {}
EOF
\`\`\``,
        hints: [
          'endpointSelector: {} selects all pods in the namespace',
          'Without ingress/egress rules = deny everything',
          'Test: kubectl exec frontend -- curl backend should fail'
        ],
        solution: `\`\`\`bash
kubectl create namespace policy-demo
kubectl create deployment frontend --image=nginx -n policy-demo
kubectl create deployment backend --image=nginx -n policy-demo
kubectl expose deployment backend --port=80 -n policy-demo
kubectl apply -f - <<EOF
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: default-deny
  namespace: policy-demo
spec:
  endpointSelector: {}
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get cnp -n policy-demo
# Expected output: default-deny

# Test that traffic is blocked
kubectl exec -n policy-demo deploy/frontend -- curl -s --connect-timeout 3 backend 2>&1 || echo "BLOCKED - expected"
# Expected output: timeout or connection refused
\`\`\``
      },
      {
        title: 'Create L7 HTTP Policy',
        instruction: `Create a CiliumNetworkPolicy allowing frontend to access backend with GET only on port 80.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: policy-demo
spec:
  endpointSelector:
    matchLabels:
      app: backend
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: frontend
      toPorts:
        - ports:
            - port: "80"
              protocol: TCP
          rules:
            http:
              - method: GET
                path: "/.*"
---
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: allow-frontend-egress
  namespace: policy-demo
spec:
  endpointSelector:
    matchLabels:
      app: frontend
  egress:
    - toEndpoints:
        - matchLabels:
            app: backend
      toPorts:
        - ports:
            - port: "80"
    - toEndpoints:
        - matchLabels:
            k8s:io.kubernetes.pod.namespace: kube-system
            k8s-app: kube-dns
      toPorts:
        - ports:
            - port: "53"
              protocol: UDP
          rules:
            dns:
              - matchPattern: "*"
EOF
\`\`\``,
        hints: [
          'Need rules on both backend (ingress) AND frontend (egress)',
          'L7 HTTP uses Envoy proxy — there may be a small delay on first request',
          'DNS egress is necessary for Service name resolution'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: policy-demo
spec:
  endpointSelector:
    matchLabels:
      app: backend
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: frontend
      toPorts:
        - ports:
            - port: "80"
          rules:
            http:
              - method: GET
EOF
\`\`\``,
        verify: `\`\`\`bash
# GET should work
kubectl exec -n policy-demo deploy/frontend -- curl -s --connect-timeout 5 http://backend/
# Expected output: nginx HTML page

# POST should be blocked by L7 policy
kubectl exec -n policy-demo deploy/frontend -- curl -s -X POST --connect-timeout 5 http://backend/ 2>&1
# Expected output: Access denied or 403
\`\`\``
      },
      {
        title: 'Monitor Policy Verdicts',
        instruction: `Use cilium monitor to check policy verdicts in real-time.

\`\`\`bash
# In one terminal, monitor verdicts
cilium monitor --type policy-verdict -n policy-demo

# In another terminal, generate traffic
kubectl exec -n policy-demo deploy/frontend -- curl -s http://backend/
kubectl exec -n policy-demo deploy/frontend -- curl -s -X POST http://backend/
\`\`\``,
        hints: [
          'policy-verdict shows ALLOWED and DENIED for each packet',
          'Look for "verdict: denied" to see blocking policies',
          'Use --type drop to see only dropped packets'
        ],
        solution: `\`\`\`bash
# Monitor in background
cilium monitor --type policy-verdict &

# Generate traffic
kubectl exec -n policy-demo deploy/frontend -- curl -s http://backend/
\`\`\``,
        verify: `\`\`\`bash
# List applied policies
kubectl get cnp -n policy-demo
# Expected output: default-deny, allow-frontend-to-backend, allow-frontend-egress

# Check endpoints with policy
cilium endpoint list | grep policy-demo
# Expected output: endpoints with policy enforcement ON
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pod cannot access external service after FQDN policy',
      difficulty: 'medium',
      symptom: 'After creating an FQDN policy to allow access to an external API, the pod cannot connect. Request times out.',
      diagnosis: `\`\`\`bash
# Check DNS works
kubectl exec <pod> -- nslookup api.external.com

# Check policy
kubectl describe cnp <policy-name> -n <namespace>

# Check drops
cilium monitor --type drop

# Check FQDN cache
cilium fqdn cache list
\`\`\``,
      solution: `**Most common cause: missing DNS egress rule**

Add DNS permission alongside toFQDNs:
\`\`\`yaml
egress:
  - toFQDNs:
      - matchName: "api.external.com"
    toPorts:
      - ports:
          - port: "443"
  # REQUIRED: allow DNS
  - toEndpoints:
      - matchLabels:
          k8s:io.kubernetes.pod.namespace: kube-system
          k8s-app: kube-dns
    toPorts:
      - ports:
          - port: "53"
            protocol: UDP
        rules:
          dns:
            - matchPattern: "*"
\`\`\`

Without the DNS rule, the pod cannot resolve the domain and the connection fails.`
    },
    {
      title: 'L7 policy causes high latency',
      difficulty: 'hard',
      symptom: 'After applying L7 HTTP policies, the service shows elevated latency and intermittent timeouts.',
      diagnosis: `\`\`\`bash
# Check proxy status
cilium status | grep Proxy

# Check Envoy logs
kubectl logs -n kube-system -l k8s-app=cilium -c cilium-envoy --tail=20

# Check cilium agent resources
kubectl top pods -n kube-system -l k8s-app=cilium

# Check proxy metrics
curl localhost:9964/metrics | grep envoy
\`\`\``,
      solution: `**Solutions:**

1. **Increase Cilium agent resources:** L7 policies use Envoy which consumes more CPU/memory.

2. **Limit L7 scope:** Apply L7 only where necessary — use L3/L4 for traffic that doesn't need HTTP inspection.

3. **Check rule count:** Many L7 rules on the same endpoint overload the proxy. Consolidate rules when possible.

4. **Envoy connection pool:** If there are many simultaneous connections, configure connection pooling in Envoy.`
    },
    {
      title: 'Default deny breaks DNS and CoreDNS',
      difficulty: 'easy',
      symptom: 'After applying default deny, pods cannot resolve DNS. All services become inaccessible by name.',
      diagnosis: `\`\`\`bash
# Test DNS
kubectl exec <pod> -- nslookup kubernetes.default

# Check CoreDNS
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Check DNS drops
cilium monitor --type drop | grep 53
\`\`\``,
      solution: `**Solution: add DNS egress rule to each policy**

\`\`\`yaml
egress:
  # ... your egress rules ...

  # Always allow DNS
  - toEndpoints:
      - matchLabels:
          k8s:io.kubernetes.pod.namespace: kube-system
          k8s-app: kube-dns
    toPorts:
      - ports:
          - port: "53"
            protocol: UDP
          - port: "53"
            protocol: TCP
\`\`\`

Or create a CiliumClusterwideNetworkPolicy allowing DNS for all:
\`\`\`yaml
apiVersion: cilium.io/v2
kind: CiliumClusterwideNetworkPolicy
metadata:
  name: allow-dns-all
spec:
  endpointSelector: {}
  egress:
    - toEndpoints:
        - matchLabels:
            k8s:io.kubernetes.pod.namespace: kube-system
            k8s-app: kube-dns
      toPorts:
        - ports:
            - port: "53"
\`\`\``
    }
  ]
};
