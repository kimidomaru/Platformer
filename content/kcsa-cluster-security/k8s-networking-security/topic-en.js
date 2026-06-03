window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcsa-cluster-security/k8s-networking-security'] = {
  theory: `# Kubernetes Networking Security

## Exam Relevance
> KCSA tests network security concepts including NetworkPolicy, service mesh security, Ingress TLS, and DNS security. Expect questions about default network behavior, how to restrict traffic, and mTLS.

## Default Kubernetes Network Behavior

**By default, Kubernetes has no network isolation between pods**:
- Any pod can communicate with any other pod
- Any pod can communicate with any service
- There is no default-deny rule

This is the "flat network model" — enabling applications to work without configuration, but creating significant lateral movement risk.

\`\`\`
Without NetworkPolicy:
Pod A (compromised) ──→ Database Pod
Pod A (compromised) ──→ Payment Service
Pod A (compromised) ──→ Admin Service
\`\`\`

## NetworkPolicy

NetworkPolicy is the Kubernetes-native way to restrict pod traffic.

### NetworkPolicy Fundamentals
- Policies are **namespaced** resources
- Policies are **additive** — multiple policies combine (union of allows)
- Pods with NO matching policy: **allow all traffic**
- Pods with ANY matching policy: **only explicitly allowed traffic**

### Default Deny All Policy

\`\`\`yaml
# Deny all ingress AND egress for all pods in namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}      # match ALL pods
  policyTypes:
    - Ingress
    - Egress
\`\`\`

### Allow Specific Traffic

\`\`\`yaml
# Allow frontend to connect to backend on port 8080
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend          # policy applies to "backend" pods
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend  # allow from "frontend" pods
      ports:
        - port: 8080
          protocol: TCP
\`\`\`

### Cross-Namespace NetworkPolicy

\`\`\`yaml
# Allow access from specific namespace
ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: monitoring  # only from "monitoring" namespace
      podSelector:
        matchLabels:
          app: prometheus   # AND only prometheus pods
\`\`\`

### Allow DNS Resolution (Critical!)

\`\`\`yaml
# If you use default-deny-all, pods can't resolve DNS
# Add this to allow DNS:
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
\`\`\`

> **Important**: NetworkPolicy requires a CNI plugin that supports it (Calico, Cilium, Weave). Flannel does NOT support NetworkPolicy.

## Service Mesh Security (mTLS)

A service mesh adds encryption and authentication to pod-to-pod communication.

### Mutual TLS (mTLS)
Standard TLS: client verifies server identity.
mTLS: both client AND server verify each other's identity.

\`\`\`
Standard TLS:   client ──[verify server cert]──→ server
mTLS:           client ←─[mutual cert verify]──→ server
\`\`\`

### Service Mesh Architecture

\`\`\`
App Container ← sidecar → Envoy Proxy ──[mTLS]──→ Envoy Proxy → App Container
\`\`\`

The sidecar proxy (Envoy, Linkerd-proxy) intercepts all traffic and handles TLS transparently to the application.

### Istio Security Features
- **mTLS** — encrypted, authenticated pod-to-pod communication
- **AuthorizationPolicy** — L7 access control (which service can call which endpoint)
- **PeerAuthentication** — enforce mTLS mode (STRICT/PERMISSIVE)

\`\`\`yaml
# Enforce mTLS for all pods in namespace
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: enforce-mtls
  namespace: production
spec:
  mtls:
    mode: STRICT    # only mTLS connections allowed

---
# L7 Authorization: only allow GET to /api
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: api-auth
  namespace: production
spec:
  selector:
    matchLabels:
      app: backend
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/default/sa/frontend"]
  - to:
    - operation:
        methods: ["GET"]
        paths: ["/api/*"]
\`\`\`

## Ingress TLS Security

\`\`\`yaml
# Ingress with TLS
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secure-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
    - hosts:
        - myapp.example.com
      secretName: tls-secret      # contains tls.crt and tls.key
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: myapp
                port:
                  number: 80
\`\`\`

### TLS Certificate Management
\`\`\`bash
# Manual: create TLS secret
kubectl create secret tls tls-secret \\
  --cert=path/to/tls.crt \\
  --key=path/to/tls.key

# Automated: cert-manager (CNCF project)
# Automatically provisions and renews TLS certs from Let's Encrypt or internal CA
\`\`\`

## DNS Security

### CoreDNS Security
- CoreDNS runs in kube-system and handles all cluster DNS
- DNS poisoning can redirect pod traffic to malicious endpoints

\`\`\`bash
# Check CoreDNS is running
kubectl get pods -n kube-system -l k8s-app=kube-dns

# CoreDNS ConfigMap (modify DNS behavior)
kubectl get configmap coredns -n kube-system -o yaml
\`\`\`

### DNS Exfiltration Prevention
Attackers can use DNS queries for data exfiltration:
\`\`\`
exfiltrated-data.attacker-controlled.com → DNS query carries data
\`\`\`

Mitigation: NetworkPolicy restricting DNS to cluster DNS only, or using DNS filtering.

## Network Security Architecture Best Practices

\`\`\`
External Traffic:
  Internet → WAF → Cloud Load Balancer → Ingress Controller
  ↓ TLS termination at Ingress

Internal Traffic:
  Frontend → NetworkPolicy allow → Backend
  Backend → NetworkPolicy allow → Database

  All other: denied by default-deny NetworkPolicy

Pod-to-Pod:
  mTLS (Istio/Linkerd) encrypts and authenticates all service communication
\`\`\`

## Common Network Security Mistakes

- **No NetworkPolicy** — default allow all allows lateral movement
- **Missing DNS egress exception** — pods can't resolve service names after default-deny
- **Too broad namespaceSelector** — allow from any namespace with label
- **No TLS on Ingress** — HTTP in production
- **Using Flannel** — doesn't support NetworkPolicy (need Calico, Cilium, Weave)
- **No mTLS** — service-to-service traffic is unencrypted
`,
  quiz: [
    {
      question: 'What is the default network behavior in Kubernetes when no NetworkPolicy exists?',
      options: [
        'All pod-to-pod and pod-to-service traffic is allowed',
        'All traffic is blocked by default',
        'Only traffic within the same namespace is allowed',
        'Only traffic from pods in the same Deployment is allowed'
      ],
      correct: 0,
      explanation: 'Without NetworkPolicy, Kubernetes allows all pod-to-pod and pod-to-service communication regardless of namespace. This is the "flat network model" — easy to use but creates lateral movement risks.',
      reference: 'Review "Default Kubernetes Network Behavior" section.'
    },
    {
      question: 'A NetworkPolicy with podSelector: {} and policyTypes: [Ingress, Egress] and no rules does what?',
      options: [
        'Denies ALL ingress and egress traffic for all pods in the namespace (default deny all)',
        'Allows all traffic (same as no policy)',
        'Blocks only external traffic but allows pod-to-pod traffic',
        'Blocks traffic between namespaces but allows within namespace'
      ],
      correct: 0,
      explanation: 'An empty podSelector matches all pods. Empty ingress/egress rules with policyTypes specified means no traffic is explicitly allowed — so all traffic is denied. This is the "default deny all" pattern.',
      reference: 'Review "Default Deny All Policy" section.'
    },
    {
      question: 'Why is it critical to add a DNS egress policy when using default-deny NetworkPolicy?',
      options: [
        'Without DNS egress allowed, pods cannot resolve service names and application communication fails',
        'CoreDNS requires special cluster-level permissions to respond to queries',
        'DNS resolution is handled by the API server, not CoreDNS, under strict policies',
        'DNS uses TCP/IP directly, bypassing network policy rules'
      ],
      correct: 0,
      explanation: 'DNS queries (UDP/TCP port 53) are blocked by default-deny egress. Without DNS, kubectl exec and pod-to-pod communication by service name fails. Always add a DNS egress exception when using default-deny.',
      reference: 'Review "Allow DNS Resolution (Critical!)" section.'
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
      explanation: 'Flannel is a simple overlay network that doesn\'t support NetworkPolicy enforcement. For NetworkPolicy support, use Calico, Cilium, Weave, or other compatible CNI plugins.',
      reference: 'Review "Important" note about NetworkPolicy requirements.'
    },
    {
      question: 'What is mutual TLS (mTLS) and how does it differ from standard TLS?',
      options: [
        'Both client and server verify each other\'s certificates (vs standard TLS where only the server is verified)',
        'mTLS uses a mutual key exchange algorithm different from standard TLS',
        'mTLS only encrypts traffic but doesn\'t use certificates',
        'mTLS is a lighter version of TLS designed for microservices'
      ],
      correct: 0,
      explanation: 'Standard TLS: client verifies server identity. mTLS: both parties verify each other with certificates. This provides both encryption AND mutual authentication — preventing unauthorized services from connecting.',
      reference: 'Review "Mutual TLS (mTLS)" section.'
    },
    {
      question: 'What does Istio PeerAuthentication with mode: STRICT enforce?',
      options: [
        'All traffic to selected pods must use mTLS — plain HTTP connections are rejected',
        'Pods must authenticate with username/password before connecting',
        'Only pods from the same namespace can connect',
        'TLS certificates must be renewed every 24 hours'
      ],
      correct: 0,
      explanation: 'STRICT mode in PeerAuthentication means only mTLS connections are accepted by the selected pods. Plain HTTP connections are rejected. PERMISSIVE mode accepts both mTLS and plain HTTP (for migration).',
      reference: 'Review "Istio Security Features" section.'
    },
    {
      question: 'What is the correct way to allow access from pods in a specific namespace using NetworkPolicy?',
      options: [
        'Use namespaceSelector with the namespace\'s label AND optional podSelector',
        'Use namespaceName field with the namespace name',
        'Reference the namespace directly with namespace: <name> in the from block',
        'Use clusterSelector with the namespace and pod labels'
      ],
      correct: 0,
      explanation: 'namespaceSelector uses label selectors (not names) to select source namespaces. The label kubernetes.io/metadata.name is automatically added to all namespaces and equals the namespace name.',
      reference: 'Review "Cross-Namespace NetworkPolicy" section.'
    },
    {
      question: 'What is DNS exfiltration and how can it be prevented?',
      options: [
        'Encoding data in DNS queries to exfiltrate it to an attacker-controlled domain; prevent with DNS filtering or restrictive NetworkPolicy',
        'Stealing DNS configuration files from nodes',
        'Redirecting cluster DNS to attacker\'s server',
        'Exhausting DNS cache to cause service disruption'
      ],
      correct: 0,
      explanation: 'DNS exfiltration: attackers encode stolen data as subdomain labels (data.attacker.com) in DNS queries. The query reaches attacker\'s server, exfiltrating data even through firewall restrictions. Mitigate with DNS filtering or NetworkPolicy restricting external DNS.',
      reference: 'Review "DNS Exfiltration Prevention" section.'
    }
  ],
  flashcards: [
    {
      front: 'What is the default Kubernetes network policy (without NetworkPolicy)?',
      back: 'Allow all — any pod can communicate with any other pod or service regardless of namespace. This is the flat network model. NetworkPolicy creates exceptions to this default-allow behavior.'
    },
    {
      front: 'How do NetworkPolicies work — are they additive or restrictive?',
      back: 'Additive. Once any NetworkPolicy selects a pod, only explicitly allowed traffic is permitted. Multiple policies are combined as a union (OR). An empty policy applied to a pod = deny all for that pod.'
    },
    {
      front: 'What CNI plugins support Kubernetes NetworkPolicy?',
      back: 'Calico, Cilium, Weave, Canal, Antrea. Flannel does NOT support NetworkPolicy. AWS VPC CNI supports NetworkPolicy with Calico add-on. Choose your CNI based on whether you need NetworkPolicy.'
    },
    {
      front: 'What is the service mesh value proposition for security?',
      back: 'mTLS: encrypted pod-to-pod traffic automatically (no app changes). Authentication: verify service identity via certificates. L7 authorization: control which service can call which API endpoint. Observability: traffic metrics and traces.'
    },
    {
      front: 'What must you allow when applying default-deny-all NetworkPolicy?',
      back: 'DNS egress (port 53 UDP/TCP to kube-dns), API server access if app needs it, and specific app-to-app communication. Without DNS egress, pod service name resolution fails and applications break.'
    },
    {
      front: 'What is the difference between namespaceSelector and podSelector in NetworkPolicy from clause?',
      back: 'podSelector: selects pods by label within the SAME namespace. namespaceSelector: selects ALL pods in matching namespaces. Combined (same from list item): select specific pods in specific namespaces.'
    }
  ],
  lab: {
    scenario: 'Implement network security for a multi-tier application using NetworkPolicy. Start with a default-deny policy and progressively add allow rules.',
    objective: 'Practice creating NetworkPolicy rules to control pod-to-pod traffic in a realistic scenario.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Set up the application and verify unrestricted traffic',
        instruction: `Create a namespace \`netpol-lab\` with a frontend (nginx) and a backend (nginx). Verify they can communicate before any NetworkPolicy is applied.`,
        hints: [
          'Create pods with different labels (app=frontend, app=backend)',
          'Expose backend as a Service',
          'Verify frontend can curl backend service'
        ],
        solution: `\`\`\`bash
kubectl create namespace netpol-lab

# Backend
kubectl run backend --image=nginx --labels=app=backend -n netpol-lab
kubectl expose pod backend --port=80 --name=backend-svc -n netpol-lab

# Frontend
kubectl run frontend --image=curlimages/curl --labels=app=frontend \\
  -n netpol-lab --restart=Never -- sleep 3600

kubectl wait pod/backend --for=condition=Ready -n netpol-lab --timeout=60s
kubectl wait pod/frontend --for=condition=Ready -n netpol-lab --timeout=60s

# Test: frontend can reach backend (should succeed before NetworkPolicy)
kubectl exec frontend -n netpol-lab -- curl -s http://backend-svc/ | head -3
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -n netpol-lab
# Expected: backend and frontend both Running

kubectl exec frontend -n netpol-lab -- curl -s --connect-timeout 3 http://backend-svc/ 2>&1 | grep -c "Welcome to nginx"
# Expected: 1 (connection succeeds — no NetworkPolicy yet)

kubectl get networkpolicies -n netpol-lab
# Expected: No resources found (no policies yet)
\`\`\``
      },
      {
        title: 'Apply default-deny and break connectivity',
        instruction: `Apply a default-deny-all NetworkPolicy to the \`netpol-lab\` namespace. Verify that frontend can no longer reach backend. Also verify that DNS stops working (if you block all egress).`,
        hints: [
          'podSelector: {} selects all pods',
          'Empty rules with policyTypes specified = deny all',
          'Try curl after applying — it should fail with connection timeout'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: netpol-lab
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
EOF

# Test: frontend should now FAIL to reach backend
kubectl exec frontend -n netpol-lab -- curl -s --connect-timeout 3 http://backend-svc/ 2>&1 || echo "Connection BLOCKED (expected)"
\`\`\``,
        verify: `\`\`\`bash
kubectl get networkpolicies -n netpol-lab
# Expected: default-deny-all NetworkPolicy listed

kubectl exec frontend -n netpol-lab -- curl -s --connect-timeout 3 http://backend-svc/ 2>&1
# Expected: curl: (28) Connection timed out (blocked)

kubectl exec frontend -n netpol-lab -- curl -s --connect-timeout 3 http://google.com/ 2>&1
# Expected: timed out (DNS also blocked, or DNS resolves but TCP blocked)
\`\`\``
      },
      {
        title: 'Allow specific traffic: DNS + frontend-to-backend',
        instruction: `Add two NetworkPolicies: one to allow DNS resolution, and one to allow frontend to access backend on port 80. Verify the application works again while other traffic remains blocked.`,
        hints: [
          'DNS egress: port 53 UDP/TCP to kube-dns pods or all IPs',
          'Backend ingress: allow from pods with app=frontend label',
          'Frontend egress: allow to pods with app=backend label on port 80'
        ],
        solution: `\`\`\`bash
# Allow DNS for all pods
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: netpol-lab
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
EOF

# Allow frontend → backend on port 80
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-backend
  namespace: netpol-lab
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - port: 80
EOF

# Also allow frontend egress to backend port 80
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-egress
  namespace: netpol-lab
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: backend
      ports:
        - port: 80
    - ports:  # DNS
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get networkpolicies -n netpol-lab
# Expected: 3 NetworkPolicies

kubectl exec frontend -n netpol-lab -- curl -s http://backend-svc/ 2>&1 | grep -c "Welcome to nginx"
# Expected: 1 (connection succeeds again!)

# Backend should not be able to reach frontend (only frontend→backend is allowed)
kubectl exec backend -n netpol-lab -- curl -s --connect-timeout 3 http://frontend/ 2>&1
# Expected: connection blocked (backend can't reach frontend)

# Cleanup
kubectl delete namespace netpol-lab
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pods cannot resolve DNS after applying default-deny NetworkPolicy',
      difficulty: 'easy',
      symptom: 'After applying a default-deny NetworkPolicy, pods get "Name or service not known" errors when trying to connect to services. DNS resolution is broken.',
      diagnosis: `\`\`\`bash
# Test DNS resolution from a pod
kubectl exec <pod> -n <namespace> -- nslookup kubernetes.default

# Check if NetworkPolicy blocks port 53
kubectl get networkpolicies -n <namespace>

# If default-deny is applied, there should be a DNS egress policy
kubectl get networkpolicies -n <namespace> | grep dns
\`\`\``,
      solution: `Add a NetworkPolicy that explicitly allows DNS egress (port 53 UDP and TCP):
\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns-egress
  namespace: <namespace>
spec:
  podSelector: {}        # all pods
  policyTypes:
    - Egress
  egress:
    - ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
\`\`\`

\`\`\`bash
kubectl apply -f allow-dns-egress.yaml

# Verify DNS works now
kubectl exec <pod> -n <namespace> -- nslookup kubernetes.default
# Expected: resolves to 10.96.0.1 (or cluster IP)
\`\`\``
    },
    {
      title: 'NetworkPolicy not enforced — wrong CNI plugin',
      difficulty: 'medium',
      symptom: 'Created NetworkPolicy to restrict traffic but pods can still reach each other. The policies are applied but traffic flows freely.',
      diagnosis: `\`\`\`bash
# Check which CNI plugin is installed
kubectl get daemonsets -n kube-system
# Look for: calico-node, cilium, weave-net, etc. OR flannel (does NOT support NetworkPolicy)

# Check the pods description for CNI info
kubectl describe pod <pod-name> | grep -i "cni\|flannel\|calico\|cilium"

# Check CNI config on a node
# ls /etc/cni/net.d/
# cat /etc/cni/net.d/10-*.conf | grep type

# Verify NetworkPolicy was created but not enforced
kubectl get networkpolicies -n <namespace>
kubectl exec <pod-a> -- curl -s <pod-b>  # if this succeeds, CNI doesn't enforce NP
\`\`\``,
      solution: `If using Flannel, it does NOT support NetworkPolicy. You need to switch CNI or add a NetworkPolicy-aware CNI alongside:

Option 1: **Replace Flannel with Calico** (major change, requires cluster reinstall or careful migration)

Option 2: **Add Calico to Flannel** (use Canal = Flannel networking + Calico policy):
\`\`\`bash
kubectl apply -f https://docs.projectcalico.org/manifests/canal.yaml
\`\`\`

Option 3: **Use Cilium** (modern, eBPF-based):
\`\`\`bash
cilium install
\`\`\`

After switching CNI, verify NetworkPolicy is enforced:
\`\`\`bash
kubectl apply -f default-deny.yaml
kubectl exec <pod-a> -- curl --connect-timeout 3 <pod-b>
# Expected: timed out (now enforced)
\`\`\``
    }
  ]
};
