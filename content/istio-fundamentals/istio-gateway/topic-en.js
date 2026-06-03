window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['istio-fundamentals/istio-gateway'] = {
  theory: `
# Gateways & Ingress in Istio

## Relevance
Gateways are the entry point for external traffic into the service mesh. Understanding how to configure Ingress Gateway with TLS, controlled egress, and integration with VirtualService is essential for securely exposing services in production.

## Core Concepts

### Gateway vs Kubernetes Ingress vs Gateway API

| Resource | Controller | Layer | Capabilities |
|----------|-----------|-------|-------------|
| K8s Ingress | nginx, traefik | L7 HTTP | Basic: host/path routing |
| Istio Gateway | Envoy (istio) | L4-L7 | TLS, SNI, mTLS, multi-protocol |
| Gateway API | Various (incl. Istio) | L4-L7 | Future standard, more expressive |

### Istio Gateway Resource

The Gateway configures the mesh's edge load balancer (ingress/egress):

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: bookinfo-gateway
spec:
  selector:
    istio: ingressgateway    # selects the ingress gateway Pod
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - "bookinfo.example.com"
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: bookinfo-tls-cert
      hosts:
        - "bookinfo.example.com"
\`\`\`

### Gateway + VirtualService (Binding)

The Gateway defines WHERE to listen. The VirtualService defines HOW to route:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: bookinfo
spec:
  hosts:
    - "bookinfo.example.com"
  gateways:
    - bookinfo-gateway       # bind to the Gateway
  http:
    - match:
        - uri:
            prefix: /productpage
      route:
        - destination:
            host: productpage
            port:
              number: 9080
    - match:
        - uri:
            prefix: /api/v1
      route:
        - destination:
            host: reviews
            port:
              number: 9080
\`\`\`

### TLS Termination

**Simple TLS (HTTPS):**
\`\`\`bash
# Create TLS Secret
kubectl create -n istio-system secret tls bookinfo-tls-cert \\
  --key=privkey.pem \\
  --cert=fullchain.pem
\`\`\`

\`\`\`yaml
# Gateway with TLS
servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE                    # terminates TLS at the gateway
      credentialName: bookinfo-tls-cert
    hosts:
      - "bookinfo.example.com"
\`\`\`

**Mutual TLS (client cert):**
\`\`\`yaml
servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: MUTUAL                    # requires client certificate
      credentialName: bookinfo-tls-cert
      # CA for validating client cert is inferred from credentialName
    hosts:
      - "bookinfo.example.com"
\`\`\`

**TLS Passthrough (does not terminate TLS):**
\`\`\`yaml
servers:
  - port:
      number: 443
      name: tls
      protocol: TLS
    tls:
      mode: PASSTHROUGH               # passes TLS directly to the backend
    hosts:
      - "bookinfo.example.com"
\`\`\`

### SNI-Based Routing

Route to different services based on hostname (Server Name Indication):

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: multi-host-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: app1-cert
      hosts:
        - "app1.example.com"
    - port:
        number: 443
        name: https-app2
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: app2-cert
      hosts:
        - "app2.example.com"
\`\`\`

### Egress Gateway

Controls outbound traffic from the mesh:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: egress-gateway
spec:
  selector:
    istio: egressgateway
  servers:
    - port:
        number: 443
        name: tls
        protocol: TLS
      hosts:
        - "api.external.com"
      tls:
        mode: PASSTHROUGH
---
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: external-api
spec:
  hosts:
    - api.external.com
  ports:
    - number: 443
      name: tls
      protocol: TLS
  resolution: DNS
  location: MESH_EXTERNAL
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: external-via-egress
spec:
  hosts:
    - api.external.com
  gateways:
    - mesh
    - egress-gateway
  tls:
    - match:
        - gateways:
            - mesh
          port: 443
          sniHosts:
            - api.external.com
      route:
        - destination:
            host: istio-egressgateway.istio-system.svc.cluster.local
            port:
              number: 443
    - match:
        - gateways:
            - egress-gateway
          port: 443
          sniHosts:
            - api.external.com
      route:
        - destination:
            host: api.external.com
            port:
              number: 443
\`\`\`

### Common Mistakes

1. **VirtualService without gateways field** — the VS must reference the Gateway by name
2. **Wrong credentialName** — the TLS Secret must be in the istio-system namespace
3. **Host mismatch** — the host in Gateway and VirtualService must match
4. **Conflicting port** — two servers on the same port need different hosts

## Killer.sh Style Challenge

> **Scenario:** Configure an Ingress Gateway with TLS for two domains: app1.example.com and app2.example.com, each with its own certificate. Route app1 to the frontend service and app2 to the api service.
`,
  quiz: [
    {
      question: 'What is the difference between Gateway and VirtualService in Istio?',
      options: [
        'Gateway defines routing, VirtualService defines TLS',
        'Gateway defines where to listen (ports/hosts/TLS), VirtualService defines how to route',
        'They are the same thing with different names',
        'Gateway is for ingress, VirtualService is for egress'
      ],
      correct: 1,
      explanation: 'The Gateway configures the listeners on the edge load balancer (ports, protocols, TLS). The VirtualService defines routing rules applied to traffic flowing through that Gateway.',
      reference: 'Related concept: The gateways field in VirtualService creates the binding between the two resources.'
    },
    {
      question: 'Where must the TLS Secret referenced by credentialName in the Gateway be located?',
      options: [
        'In the application namespace',
        'In the istio-system namespace',
        'In any namespace',
        'In the kube-system namespace'
      ],
      correct: 1,
      explanation: 'credentialName references a Kubernetes Secret that must be in the same namespace as the Gateway Pod (typically istio-system for the default ingress gateway).',
      reference: 'Related concept: kubectl create secret tls -n istio-system.'
    },
    {
      question: 'Which TLS mode in the Gateway passes the TLS connection directly to the backend without terminating?',
      options: ['SIMPLE', 'MUTUAL', 'PASSTHROUGH', 'ISTIO_MUTUAL'],
      correct: 2,
      explanation: 'PASSTHROUGH mode does not terminate TLS at the gateway — the encrypted connection is passed directly to the backend service, which handles TLS termination.',
      reference: 'Related concept: PASSTHROUGH requires protocol TLS (not HTTPS) in the Gateway.'
    },
    {
      question: 'How do you expose multiple domains on the same Ingress Gateway with HTTPS?',
      options: [
        'Create a separate Gateway for each domain',
        'Configure multiple servers on the same port 443 with different hosts and credentialName',
        'Not possible with Istio',
        'Use a single wildcard certificate'
      ],
      correct: 1,
      explanation: 'Istio supports SNI-based routing: multiple servers on port 443, each with its own host and credentialName. Envoy uses SNI to select the correct certificate.',
      reference: 'Related concept: SNI (Server Name Indication) allows multiple certificates on the same port.'
    },
    {
      question: 'What is the purpose of the Egress Gateway?',
      options: [
        'Block all inbound traffic',
        'Centralize and control outbound traffic from the mesh',
        'Load balance between clusters',
        'Manage TLS certificates'
      ],
      correct: 1,
      explanation: 'The Egress Gateway centralizes egress traffic, enabling auditing, security policies, and access control for external services. All outbound traffic flows through the egress gateway.',
      reference: 'Related concept: ServiceEntry + VirtualService + Egress Gateway for complete control.'
    },
    {
      question: 'How does a VirtualService connect to a specific Gateway?',
      options: [
        'By namespace name',
        'Through the spec.gateways field in the VirtualService',
        'Automatically by host match',
        'Via annotation on the Gateway'
      ],
      correct: 1,
      explanation: 'The spec.gateways field in the VirtualService lists the names of the Gateways it references. The special value "mesh" indicates internal mesh traffic (without a gateway).',
      reference: 'Related concept: gateways: ["mesh", "my-gateway"] applies rules to both internal and external traffic.'
    },
    {
      question: 'What special value in the gateways field indicates internal mesh traffic?',
      options: ['internal', 'mesh', 'cluster', 'sidecar'],
      correct: 1,
      explanation: 'The value "mesh" in the gateways field indicates that VirtualService rules apply to traffic between sidecars within the mesh, without going through a Gateway.',
      reference: 'Related concept: If gateways is not specified, the default is "mesh".'
    }
  ],
  flashcards: [
    {
      front: 'What are the available TLS modes in Istio Gateway?',
      back: '1. **SIMPLE** — terminates TLS at the gateway (server cert)\n2. **MUTUAL** — terminates TLS + requires client cert\n3. **PASSTHROUGH** — does not terminate TLS, passes through to backend\n4. **ISTIO_MUTUAL** — internal mTLS using Istio certs\n5. **AUTO_PASSTHROUGH** — auto SNI for multi-cluster'
    },
    {
      front: 'What is the relationship between Gateway and VirtualService?',
      back: '**Gateway** defines:\n- Selector (which gateway pod)\n- Ports and protocols\n- TLS config\n- Accepted hosts\n\n**VirtualService** defines:\n- Routing rules\n- Match by URI, header\n- Destinations and weights\n\n**Binding:** VS.spec.gateways references the Gateway by name.\nThe host in VS must be among the Gateway hosts.'
    },
    {
      front: 'How to configure TLS on the Istio Ingress Gateway?',
      back: '1. Create TLS Secret in istio-system namespace:\n\`\`\`bash\nkubectl create -n istio-system secret tls my-cert \\\\\n  --key=key.pem --cert=cert.pem\n\`\`\`\n\n2. Configure Gateway:\n\`\`\`yaml\ntls:\n  mode: SIMPLE\n  credentialName: my-cert\n\`\`\`\n\ncredentialName = Secret name'
    },
    {
      front: 'What is SNI and how does Istio use it?',
      back: '**SNI (Server Name Indication)** is a TLS extension that sends the hostname during the handshake.\n\n**Usage in Istio:**\n- Enables multiple HTTPS domains on the same port 443\n- Each domain has its own certificate\n- Envoy uses SNI to select the correct cert\n- Essential for multi-tenant ingress'
    },
    {
      front: 'What is the difference between Ingress Gateway and Egress Gateway?',
      back: '**Ingress Gateway:**\n- External traffic -> mesh\n- Exposes services to clients\n- TLS termination\n- Routing by host/path\n\n**Egress Gateway:**\n- Mesh traffic -> external\n- Centralizes outbound traffic\n- Auditing and compliance\n- Requires ServiceEntry + VirtualService'
    },
    {
      front: 'When to use PASSTHROUGH vs SIMPLE for TLS?',
      back: '**SIMPLE (TLS termination):**\n- Gateway terminates TLS\n- Backend receives plaintext\n- Simpler to manage\n- Gateway needs the certificate\n\n**PASSTHROUGH:**\n- Gateway does not terminate TLS\n- End-to-end TLS to the backend\n- Backend manages its own cert\n- Required for non-HTTP protocols'
    },
    {
      front: 'How does the Egress Gateway pattern work for controlling outbound traffic?',
      back: 'Three resources needed:\n\n1. **ServiceEntry** — registers external host\n2. **Gateway** (egress) — defines egress listener\n3. **VirtualService** with two matches:\n   - gateway: mesh -> routes to egress gw\n   - gateway: egress-gw -> routes to external host\n\nAll egress traffic flows through the gateway, enabling auditing and control.'
    }
  ],
  lab: {
    scenario: 'You need to expose a web application externally with HTTPS and configure controlled egress to an external API.',
    objective: 'Configure Ingress Gateway with TLS, VirtualService with routing, and Egress Gateway with ServiceEntry.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Configure Ingress Gateway with HTTPS',
        instruction: `Create a Gateway with TLS and a VirtualService to expose the application externally.

\`\`\`bash
# Create self-signed certificate for testing
openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 \\
  -subj '/O=example/CN=bookinfo.example.com' \\
  -keyout bookinfo.key -out bookinfo.crt

# Create TLS Secret in istio-system namespace
kubectl create -n istio-system secret tls bookinfo-tls \\
  --key=bookinfo.key --cert=bookinfo.crt

# Create Gateway + VirtualService
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: bookinfo-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: bookinfo-tls
      hosts:
        - "bookinfo.example.com"
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - "bookinfo.example.com"
      tls:
        httpsRedirect: true
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: bookinfo
spec:
  hosts:
    - "bookinfo.example.com"
  gateways:
    - bookinfo-gateway
  http:
    - match:
        - uri:
            prefix: /
      route:
        - destination:
            host: productpage
            port:
              number: 9080
EOF
\`\`\``,
        hints: [
          'TLS Secret must be in the istio-system namespace',
          'credentialName corresponds to the Secret name',
          'httpsRedirect: true automatically redirects HTTP to HTTPS'
        ],
        solution: `\`\`\`bash
openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 -subj '/O=example/CN=bookinfo.example.com' -keyout bookinfo.key -out bookinfo.crt
kubectl create -n istio-system secret tls bookinfo-tls --key=bookinfo.key --cert=bookinfo.crt
kubectl apply -f gateway-setup.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify Gateway
kubectl get gateway bookinfo-gateway
# Expected output: bookinfo-gateway   Xs

# Verify TLS Secret
kubectl get secret bookinfo-tls -n istio-system
# Expected output: bookinfo-tls   kubernetes.io/tls   2   Xs

# Verify VirtualService
kubectl get vs bookinfo -o jsonpath='{.spec.gateways}'
# Expected output: ["bookinfo-gateway"]

# Test HTTPS
INGRESS_IP=\$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl -sk https://bookinfo.example.com --resolve "bookinfo.example.com:443:\$INGRESS_IP" -o /dev/null -w "%{http_code}"
# Expected output: 200
\`\`\``
      },
      {
        title: 'Configure Multi-Host with SNI',
        instruction: `Add a second domain to the same Ingress Gateway with its own certificate.

\`\`\`bash
# Create certificate for the second domain
openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 \\
  -subj '/O=example/CN=api.example.com' \\
  -keyout api.key -out api.crt

kubectl create -n istio-system secret tls api-tls \\
  --key=api.key --cert=api.crt

# Update Gateway with second host
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: bookinfo-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 443
        name: https-bookinfo
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: bookinfo-tls
      hosts:
        - "bookinfo.example.com"
    - port:
        number: 443
        name: https-api
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: api-tls
      hosts:
        - "api.example.com"
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-vs
spec:
  hosts:
    - "api.example.com"
  gateways:
    - bookinfo-gateway
  http:
    - route:
        - destination:
            host: reviews
            port:
              number: 9080
EOF
\`\`\``,
        hints: [
          'Each server can have its own credentialName for different certificates',
          'Envoy uses SNI to select the correct certificate based on hostname',
          'Server names must be unique (https-bookinfo, https-api)'
        ],
        solution: `\`\`\`bash
openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 -subj '/O=example/CN=api.example.com' -keyout api.key -out api.crt
kubectl create -n istio-system secret tls api-tls --key=api.key --cert=api.crt
kubectl apply -f multi-host-gateway.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify Gateway with two servers
kubectl get gateway bookinfo-gateway -o jsonpath='{.spec.servers[*].hosts}'
# Expected output: ["bookinfo.example.com"] ["api.example.com"]

# Verify Secrets
kubectl get secrets -n istio-system | grep tls
# Expected output: bookinfo-tls and api-tls

# Test second domain
INGRESS_IP=\$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl -sk https://api.example.com --resolve "api.example.com:443:\$INGRESS_IP" -o /dev/null -w "%{http_code}"
# Expected output: 200
\`\`\``
      },
      {
        title: 'Configure Egress Gateway',
        instruction: `Configure outbound traffic control using Egress Gateway and ServiceEntry.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: httpbin-ext
spec:
  hosts:
    - httpbin.org
  ports:
    - number: 80
      name: http
      protocol: HTTP
  resolution: DNS
  location: MESH_EXTERNAL
---
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: httpbin-egress
  namespace: istio-system
spec:
  selector:
    istio: egressgateway
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - httpbin.org
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: httpbin-egress-vs
spec:
  hosts:
    - httpbin.org
  gateways:
    - mesh
    - istio-system/httpbin-egress
  http:
    - match:
        - gateways:
            - mesh
          port: 80
      route:
        - destination:
            host: istio-egressgateway.istio-system.svc.cluster.local
            port:
              number: 80
    - match:
        - gateways:
            - istio-system/httpbin-egress
          port: 80
      route:
        - destination:
            host: httpbin.org
            port:
              number: 80
EOF
\`\`\``,
        hints: [
          'Traffic from mesh goes first to egress gateway, then to the external destination',
          'VirtualService needs two matches: mesh -> egress gw, egress gw -> external',
          'The egress gateway should be in the istio-system namespace'
        ],
        solution: `\`\`\`bash
kubectl apply -f egress-setup.yaml

# Test access via egress gateway
kubectl exec deploy/sleep -c sleep -- curl -s http://httpbin.org/get -o /dev/null -w "%{http_code}"
\`\`\``,
        verify: `\`\`\`bash
# Verify ServiceEntry
kubectl get serviceentry httpbin-ext
# Expected output: httpbin-ext   ["httpbin.org"]   Xs

# Verify egress Gateway
kubectl get gateway httpbin-egress -n istio-system
# Expected output: httpbin-egress   Xs

# Verify traffic flows through egress gateway (in logs)
kubectl logs -n istio-system deploy/istio-egressgateway --tail=5 | grep httpbin
# Expected output: logs showing requests to httpbin.org
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Gateway created but traffic returns 404',
      difficulty: 'easy',
      symptom: 'The Ingress Gateway is reachable but all requests return 404 Not Found.',
      diagnosis: `\`\`\`bash
# Check if VirtualService references the Gateway
kubectl get vs -o jsonpath='{range .items[*]}{.metadata.name}{" gateways="}{.spec.gateways}{"\\n"}{end}'

# Check Gateway and VirtualService hosts
kubectl get gateway -o jsonpath='{range .items[*]}{.metadata.name}{" hosts="}{.spec.servers[*].hosts}{"\\n"}{end}'
kubectl get vs -o jsonpath='{range .items[*]}{.metadata.name}{" hosts="}{.spec.hosts}{"\\n"}{end}'

# Check routes in the ingress gateway proxy
istioctl proxy-config routes deploy/istio-ingressgateway -n istio-system

# Analyze configuration
istioctl analyze
\`\`\``,
      solution: `**Common causes:**

1. **VirtualService without gateways:** The spec.gateways field must include the Gateway name.

2. **Host mismatch:** The host in VirtualService must be among the hosts accepted by the Gateway.

3. **Gateway in different namespace:** If the Gateway is in another namespace, use \`namespace/gateway-name\` in the VS gateways field.

4. **No match in VS:** Verify that match rules (URI prefix/exact) correspond to the requests being sent.`
    },
    {
      title: 'TLS certificate not working on Gateway',
      difficulty: 'medium',
      symptom: 'The Gateway is configured with TLS but the browser shows a certificate error or the connection is refused.',
      diagnosis: `\`\`\`bash
# Check if the Secret exists in the correct namespace
kubectl get secret -n istio-system | grep tls

# Check Secret contents
kubectl get secret bookinfo-tls -n istio-system -o jsonpath='{.data.tls\\.crt}' | base64 -d | openssl x509 -text -noout | head -10

# Check ingress gateway logs
kubectl logs -n istio-system deploy/istio-ingressgateway | grep -i "secret\\|tls\\|cert"

# Test TLS connection
INGRESS_IP=\$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
openssl s_client -connect \$INGRESS_IP:443 -servername bookinfo.example.com </dev/null 2>&1 | head -20
\`\`\``,
      solution: `**Causes and solutions:**

1. **Secret in wrong namespace:** The Secret must be in istio-system (or the gateway Pod namespace).

2. **Wrong Secret type:** Must be \`kubernetes.io/tls\` with \`tls.crt\` and \`tls.key\` fields.

3. **Wrong credentialName:** Verify the name in the Gateway matches exactly the Secret name.

4. **Expired or invalid certificate:** Check validity with openssl.

5. **SDS not updated:** After creating/updating the Secret, it may take a few seconds for the proxy to reload. Check gateway logs.`
    },
    {
      title: 'Egress Gateway not routing external traffic',
      difficulty: 'hard',
      symptom: 'Configured Egress Gateway but traffic does not flow through the gateway. Requests to external services fail or go directly without passing through egress.',
      diagnosis: `\`\`\`bash
# Check if egress gateway Pod is running
kubectl get pods -n istio-system -l istio=egressgateway

# Check ServiceEntry
kubectl get serviceentry -o yaml

# Check VirtualService
kubectl get vs -o yaml | grep -A20 "gateways"

# Check if traffic goes through egress (logs)
kubectl logs -n istio-system deploy/istio-egressgateway --tail=20

# Check app proxy configuration
POD=\$(kubectl get pod -l app=sleep -o jsonpath='{.items[0].metadata.name}')
istioctl proxy-config routes \$POD | grep <external-host>
\`\`\``,
      solution: `**Common causes:**

1. **Profile without egress gateway:** The default profile does not include egress gateway. Use demo profile or install manually.

2. **Incomplete VirtualService:** Needs two matches — \`mesh\` (sidecar -> egress) and the egress gateway (egress -> external).

3. **Outbound policy ALLOW_ANY:** If the mesh allows all egress traffic, sidecars send directly. Configure REGISTRY_ONLY to force egress gateway usage.

4. **Wrong namespace:** The egress Gateway typically resides in istio-system. Reference as \`istio-system/gateway-name\` in the VirtualService.`
    }
  ]
};
