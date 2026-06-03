window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcna-orchestration/networking-concepts'] = {
  theory: `# Kubernetes Networking Concepts

## Exam Relevance
> Networking is a key topic in KCNA (~22% Orchestration). You need to understand the Kubernetes networking model, service types, DNS, ingress, and network policies at a conceptual level.

## The Kubernetes Networking Model

Four fundamental requirements:

1. **Every pod gets its own IP** — pods communicate directly without NAT
2. **All pods can communicate with all other pods** — flat network
3. **Agents on a node can communicate with all pods on that node**
4. **Pods think they are on the same network** — no port remapping needed

This is implemented by **CNI plugins** (Container Network Interface): Calico, Flannel, Cilium, Weave.

## Pod Networking

\`\`\`
Node A                    Node B
┌──────────────────┐      ┌──────────────────┐
│ Pod 10.244.1.5   │      │ Pod 10.244.2.5   │
│ Pod 10.244.1.6   │      │ Pod 10.244.2.6   │
└──────────────────┘      └──────────────────┘
      ↑↓ direct                 ↑↓ direct
   (same node)              (same node)
         ↑↓ via node network (CNI overlay/routes)
\`\`\`

Each node has a CIDR block (e.g., 10.244.1.0/24). Pods get IPs from this block. CNI routes traffic between nodes.

## Services

Services provide stable endpoints for pods (ephemeral IPs) via label selectors:

\`\`\`
Client → Service ClusterIP → kube-proxy → Pod IP
\`\`\`

**Service types**:
- **ClusterIP** — internal only (default)
- **NodePort** — exposes on NodeIP:30000-32767
- **LoadBalancer** — cloud load balancer (external)
- **ExternalName** — DNS CNAME redirect

## Ingress

Routes HTTP/HTTPS traffic from outside the cluster to Services:

\`\`\`
Internet → LoadBalancer → Ingress Controller → Ingress Rules → Service → Pod
\`\`\`

An **Ingress Controller** (nginx, traefik, Haproxy) must be installed separately.

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service: { name: api-svc, port: { number: 80 } }
      - path: /
        pathType: Prefix
        backend:
          service: { name: frontend-svc, port: { number: 80 } }
\`\`\`

## DNS (CoreDNS)

Every Service and Pod gets a DNS name:

\`\`\`
Service: <name>.<namespace>.svc.cluster.local
Pod:     <pod-ip>.<namespace>.pod.cluster.local  (with dots replaced by dashes)
\`\`\`

DNS allows services to find each other by name, not IP. CoreDNS runs as a Deployment in kube-system.

## Network Policy

By default: **all pods can communicate with all pods**. NetworkPolicy adds restrictions:

\`\`\`yaml
# Allow only frontend pods to reach backend port 8080
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
spec:
  podSelector:
    matchLabels:
      app: backend
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
\`\`\`

NetworkPolicy requires a CNI plugin that supports it (Calico, Cilium, Weave — NOT Flannel).

## Service Mesh

A service mesh adds traffic management at the network level via sidecar proxies:

| Feature | Service Mesh |
|---------|-------------|
| mTLS between services | ✅ |
| Traffic routing (canary, A/B) | ✅ |
| Observability (traces, metrics) | ✅ |
| Circuit breaking | ✅ |
| Rate limiting | ✅ |

**Popular service meshes**: Istio (CNCF Graduated), Linkerd (CNCF Graduated), Consul Connect.

## Gateway API (Future of Ingress)

The Gateway API is the next generation after Ingress:
- More expressive routing (header-based, weight-based)
- Role-oriented design (infra operator, app developer)
- Official Kubernetes SIG project

Resources: GatewayClass, Gateway, HTTPRoute, TCPRoute
`,
  quiz: [
    {
      question: 'What is the fundamental networking requirement for pods in Kubernetes?',
      options: [
        'All pods share the same IP address',
        'Every pod gets its own unique IP and can communicate with all other pods without NAT',
        'Pods can only communicate via Services',
        'Pods must use port forwarding to communicate'
      ],
      correct: 1,
      explanation: 'Kubernetes requires every pod to have its own IP and all pods to be able to communicate with each other directly (no NAT). This "flat network" model simplifies application development and networking.',
      reference: 'The Kubernetes Networking Model section in theory.'
    },
    {
      question: 'What is the role of a CNI plugin?',
      options: [
        'Managing container images',
        'Implementing pod networking — assigning IPs to pods and routing traffic between nodes',
        'Providing DNS for services',
        'Load balancing between pods'
      ],
      correct: 1,
      explanation: 'CNI (Container Network Interface) plugins implement pod networking. They assign IP addresses to pods from the node CIDR and route traffic between pods on different nodes. Examples: Calico, Cilium, Flannel, Weave.',
      reference: 'Pod Networking section in theory.'
    },
    {
      question: 'What is a service mesh used for in Kubernetes?',
      options: [
        'Replacing Kubernetes Services',
        'Adding advanced networking features (mTLS, traffic management, observability) via sidecar proxies without changing application code',
        'Providing a GUI for network monitoring',
        'Replacing CoreDNS for service discovery'
      ],
      correct: 1,
      explanation: 'A service mesh (Istio, Linkerd) adds sidecar proxies to pods that handle mTLS encryption, traffic routing, circuit breaking, and observability. Application code doesn\'t change — the proxy intercepts all traffic.',
      reference: 'Service Mesh section in theory.'
    },
    {
      question: 'Which Service type requires an Ingress Controller to function?',
      options: [
        'ClusterIP',
        'NodePort',
        'Ingress (not a Service type but requires an Ingress Controller)',
        'LoadBalancer'
      ],
      correct: 2,
      explanation: 'Ingress is not a Service type — it\'s a separate resource. An Ingress Controller (nginx, traefik) must be installed to process Ingress resources and route HTTP/HTTPS traffic to Services.',
      reference: 'Ingress section in theory.'
    },
    {
      question: 'What is the default NetworkPolicy behavior in Kubernetes?',
      options: [
        'All traffic is denied by default',
        'All pods can communicate with all other pods (open by default)',
        'Only pods in the same namespace can communicate',
        'Only pods with the same labels can communicate'
      ],
      correct: 1,
      explanation: 'By default, Kubernetes has no network isolation — all pods can communicate with all other pods. NetworkPolicy resources add restrictions. When no NetworkPolicy selects a pod, the pod allows all ingress and egress.',
      reference: 'Network Policy section in theory.'
    },
    {
      question: 'What is the DNS name for a Service named "api" in namespace "production"?',
      options: [
        'api.cluster.local',
        'api.production.svc.cluster.local',
        'production.api.svc.cluster.local',
        'api.svc.production.local'
      ],
      correct: 1,
      explanation: 'The DNS format for Services is: <service>.<namespace>.svc.<cluster-domain>. So "api" in "production" is: api.production.svc.cluster.local. From within the same namespace, just "api" works.',
      reference: 'DNS section in theory.'
    },
    {
      question: 'What is the Gateway API and how does it relate to Ingress?',
      options: [
        'The Gateway API is the same as Ingress — just renamed',
        'The Gateway API is the next-generation replacement for Ingress with more expressive routing and role-oriented design',
        'The Gateway API manages cloud provider load balancers only',
        'The Gateway API is a security feature for network policies'
      ],
      correct: 1,
      explanation: 'The Gateway API (SIG-Network) is designed to replace the Ingress API. It has more expressive routing (header-based, weight-based), role separation (infra operators vs app developers), and supports TCP/UDP routes alongside HTTP.',
      reference: 'Gateway API section in theory.'
    },
    {
      question: 'Which CNI plugin does NOT support NetworkPolicy enforcement?',
      options: [
        'Calico',
        'Cilium',
        'Flannel',
        'Weave Net'
      ],
      correct: 2,
      explanation: 'Flannel only provides basic pod-to-pod connectivity and does NOT implement NetworkPolicy. To use NetworkPolicies, you need a CNI with policy support: Calico, Cilium, Weave (with policy support), or Canal (Flannel + Calico policies).',
      reference: 'Network Policy section in theory.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4 requirements of the Kubernetes networking model?',
      back: '1. Every pod gets its own unique IP address\n2. All pods can communicate with all other pods (no NAT)\n3. Node agents can communicate with all pods on that node\n4. Pods see a flat network (no port remapping)\n\nImplemented by CNI plugins: Calico, Cilium, Flannel, Weave.'
    },
    {
      front: 'What is the difference between Ingress and a Service?',
      back: 'Service: stable network endpoint for pods. Layer 4 (TCP/UDP).\nTypes: ClusterIP, NodePort, LoadBalancer, ExternalName.\n\nIngress: HTTP/HTTPS routing rules based on host/path. Layer 7.\nRequires an Ingress Controller (nginx, traefik) to be installed.\nRoutes: app.example.com/api → api-service → pods\n\nUse Service for TCP; Ingress for HTTP with path-based routing.'
    },
    {
      front: 'What is a service mesh? Name two CNCF Graduated service meshes.',
      back: 'Service mesh: adds sidecar proxies to every pod that handle:\n- mTLS (mutual TLS between services)\n- Traffic routing (canary, A/B, retries)\n- Observability (traces, metrics per service)\n- Circuit breaking, rate limiting\n\nCNCF Graduated:\n- Istio: full-featured, complex\n- Linkerd: lightweight, simpler\n\nBoth use Envoy (or equivalent) as the data plane proxy.'
    },
    {
      front: 'What is the default NetworkPolicy behavior?',
      back: 'DEFAULT: no NetworkPolicies → all traffic allowed (open)\n\nOnce you create a NetworkPolicy that selects a pod:\n- Only traffic explicitly allowed by matching policies is permitted\n- All other traffic is DENIED\n\nCommon pattern:\n1. Apply default-deny policy\n2. Add specific allow policies for required traffic\n3. Always allow DNS (UDP:53) in egress policies'
    },
    {
      front: 'What is the Gateway API?',
      back: 'Next-generation Ingress API developed by Kubernetes SIG-Network.\n\nAdvantages over Ingress:\n- More expressive routing (headers, weights, methods)\n- Role-oriented (GatewayClass for infra, Gateway for ops, HTTPRoute for devs)\n- Supports TCP, UDP routes (Ingress only does HTTP)\n- Portable across implementations\n\nResources: GatewayClass, Gateway, HTTPRoute, TCPRoute'
    }
  ],
  lab: {
    scenario: 'Understanding Kubernetes networking helps diagnose connectivity issues and design secure application topologies.',
    objective: 'Practice Service types, Ingress rules, and NetworkPolicy with hands-on scenarios.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Explore Pod-to-Pod Communication',
        instruction: `Verify the flat pod network — direct communication between pods:

1. Create two pods in different namespaces
2. Test direct pod-to-pod communication using pod IPs
3. Confirm pods can communicate across namespaces without Services`,
        hints: [
          'kubectl get pod -o wide shows pod IP',
          'kubectl exec pod1 -- curl <pod2-ip> to test connectivity',
          'This works because Kubernetes requires flat pod networking'
        ],
        solution: `\`\`\`bash
kubectl create ns net-a
kubectl create ns net-b

kubectl run pod-a -n net-a --image=nginx:1.25
kubectl run pod-b -n net-b --image=curlimages/curl:8.4.0 -- sleep 3600

kubectl get pod -n net-a -o wide  # Note pod-a IP
kubectl get pod -n net-b -o wide  # Note pod-b IP

POD_A_IP=$(kubectl get pod -n net-a pod-a -o jsonpath='{.status.podIP}')
echo "Pod A IP: $POD_A_IP"

# Direct pod-to-pod communication across namespaces
kubectl exec -n net-b pod-b -- curl -s http://$POD_A_IP | head -3
# Expected: nginx HTML (flat network works!)

kubectl delete ns net-a net-b
\`\`\``,
        verify: `\`\`\`bash
echo "Test: direct pod-to-pod communication"
\`\`\``
      },
      {
        title: 'Create NetworkPolicy to Restrict Traffic',
        instruction: `Implement a deny-all NetworkPolicy and then allow specific traffic:

1. Create a backend pod with a label
2. Apply a deny-all ingress NetworkPolicy
3. Verify traffic is blocked
4. Add a specific allow rule for a frontend pod
5. Verify the frontend can now reach the backend`,
        hints: [
          'A NetworkPolicy selecting a pod with empty podSelector blocks all ingress by default',
          'Add an ingress rule with podSelector to allow specific source',
          'Test with kubectl exec -- curl to verify block/allow',
          'Remember: you need a CNI that supports NetworkPolicy (not Flannel)'
        ],
        solution: `\`\`\`bash
# Create backend
kubectl run backend --image=nginx:1.25 --labels="app=backend" --port=80
kubectl expose pod backend --port=80 --name=backend-svc

# Deny all ingress to backend
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-backend
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes: [Ingress]
  ingress: []  # Empty = deny all
EOF

# Test: this should be blocked (or timeout)
kubectl run test-blocked --image=curlimages/curl:8.4.0 --rm -it \
  --labels="app=other" -- curl -m 3 http://backend-svc || echo "BLOCKED"

# Allow frontend
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 80
EOF

# Test: frontend should succeed
kubectl run test-frontend --image=curlimages/curl:8.4.0 --rm -it \
  --labels="app=frontend" -- curl -s http://backend-svc | head -3
# Expected: nginx HTML

kubectl delete pod backend
kubectl delete svc backend-svc
kubectl delete networkpolicy deny-all-backend allow-frontend
\`\`\``,
        verify: `\`\`\`bash
kubectl get networkpolicy
# Expected: deny-all-backend and allow-frontend policies
\`\`\``
      },
      {
        title: 'Configure Ingress Routing',
        instruction: `Create an Ingress resource with path-based routing (if an Ingress Controller is available):

1. Create two services: api-svc and web-svc
2. Create an Ingress that routes /api to api-svc and / to web-svc
3. Inspect the Ingress resource and understand the routing rules`,
        hints: [
          'kubectl get ingressclass to check if an Ingress Controller is installed',
          'Ingress requires pathType: Prefix or Exact',
          'kubectl describe ingress shows the routing rules',
          'If no controller, create the Ingress and inspect it conceptually'
        ],
        solution: `\`\`\`bash
# Create backend services
kubectl create deployment api-app --image=nginx:1.25
kubectl create deployment web-app --image=nginx:1.25
kubectl expose deployment api-app --port=80 --name=api-svc
kubectl expose deployment web-app --port=80 --name=web-svc

# Check if Ingress Controller exists
kubectl get ingressclass 2>/dev/null || echo "No IngressClass found"

# Create Ingress (works even without controller for KCNA study)
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-svc
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-svc
            port:
              number: 80
EOF

kubectl describe ingress app-ingress

kubectl delete deployment api-app web-app
kubectl delete svc api-svc web-svc
kubectl delete ingress app-ingress
\`\`\``,
        verify: `\`\`\`bash
kubectl get ingress app-ingress 2>/dev/null
# Expected: ingress resource created with rules
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'NetworkPolicy Blocks All Traffic After Apply',
      difficulty: 'medium',
      symptom: 'After applying a NetworkPolicy, pods that should still communicate are getting connection refused or timeout. Even the DNS resolution stops working.',
      diagnosis: `\`\`\`bash
# Check which NetworkPolicies exist
kubectl get networkpolicy -n <namespace>
kubectl describe networkpolicy <name>

# Check if DNS traffic is explicitly allowed
# DNS = UDP:53 and TCP:53 to kube-system

# Test DNS from affected pod
kubectl exec <pod> -- nslookup kubernetes.default 2>&1
\`\`\``,
      solution: `**Cause: Egress deny-all policy blocking DNS (port 53)**

\`\`\`yaml
# Add DNS egress to your policy:
spec:
  egress:
  - ports:                    # Allow DNS
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
  - to:                       # Allow intended traffic
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - port: 8080
\`\`\`

**Key rules for NetworkPolicy:**
1. Always allow DNS (UDP:53, TCP:53) in egress policies
2. Ingress and Egress are independent
3. Empty \`ingress: []\` = deny all ingress
4. Empty \`egress: []\` = deny all egress (breaks DNS!)`
    }
  ]
};
