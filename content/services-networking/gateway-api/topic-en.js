window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['services-networking/gateway-api'] = {
  theory: `# Gateway API

## Exam Relevance
> The **Gateway API** officially entered the CKA curriculum (2025 revision) under the **Services & Networking** domain. Expect hands-on tasks: create a \`Gateway\`, expose a Service via \`HTTPRoute\`, do **traffic splitting** by weight, and enable **cross-namespace routing** with \`ReferenceGrant\`. It is the successor to the Ingress API and where the community is investing.

## Why does the Gateway API exist?

The **Ingress API** solved the basics (host/path + TLS) but got stuck on two problems:

1. **"Annotation soup"** — advanced features (rewrite, canary, rate-limit, header match) only existed via controller-specific annotations. Migrating from nginx to Traefik broke everything.
2. **No role separation** — a single \`Ingress\` object mixed infra, cluster-operation and app-development concerns.

The **Gateway API** (\`gateway.networking.k8s.io\`) is the official evolution: portable across implementations, expressive without annotations, and **role-oriented**.

> **Important:** the Gateway API does NOT replace Ingress overnight — both coexist. But all new investment (Gateway API GA since v1.0) happens here.

---

## Role Model (the core concept)

The Gateway API splits responsibility across **3 personas**, each with its own resource:

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│  Infra Provider     →  GatewayClass   (which controller)      │
│  Cluster Operator   →  Gateway        (ports, TLS, listeners)  │
│  App Developer      →  HTTPRoute      (routing rules)          │
└─────────────────────────────────────────────────────────────┘
\`\`\`

| Resource | Persona | Analogy |
|----------|---------|---------|
| **GatewayClass** | Infra / provider | Like a \`StorageClass\` — points to a controller |
| **Gateway** | Cluster operator | The load balancer / proxy instance (listeners) |
| **HTTPRoute** | App developer | The L7 rules that connect to the Service |

This lets the dev create an \`HTTPRoute\` in their namespace **without touching** the shared infrastructure.

---

## GatewayClass

Defines which implementation (controller) materializes Gateways. It is **cluster-scoped**.

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: nginx
spec:
  controllerName: gateway.nginx.org/nginx-gateway-controller
\`\`\`

\`\`\`bash
kubectl get gatewayclass
# NAME    CONTROLLER                                ACCEPTED   AGE
# nginx   gateway.nginx.org/nginx-gateway-controller  True     2m
\`\`\`

> The \`controllerName\` is fixed per implementation (nginx, Istio, Cilium, Envoy Gateway...). You usually don't create a GatewayClass on the exam — it comes pre-installed.

---

## Gateway

The data plane instance. It defines **listeners**: port, protocol, hostname and which Routes may attach.

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: prod-gateway
  namespace: infra
spec:
  gatewayClassName: nginx
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      hostname: "*.example.com"     # optional: filters by SNI/Host
      allowedRoutes:
        namespaces:
          from: All                 # Same | All | Selector
    - name: https
      protocol: HTTPS
      port: 443
      tls:
        mode: Terminate             # Terminate | Passthrough
        certificateRefs:
          - name: example-tls
            kind: Secret
      allowedRoutes:
        namespaces:
          from: Same
\`\`\`

### allowedRoutes — who can attach
| Value | Meaning |
|-------|---------|
| \`Same\` | Only Routes in the SAME namespace as the Gateway |
| \`All\` | Routes from any namespace |
| \`Selector\` | Routes from namespaces matching a \`matchLabels\` |

\`\`\`bash
kubectl get gateway prod-gateway -n infra
# NAME           CLASS   ADDRESS         PROGRAMMED   AGE
# prod-gateway   nginx   203.0.113.10    True         1m
\`\`\`

> **ADDRESS** only appears once the controller provisions the LB. **PROGRAMMED=True** = the data plane is configured.

---

## HTTPRoute

The resource the dev uses most. It attaches to a Gateway via \`parentRefs\` and routes to Services via \`backendRefs\`.

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: app-route
  namespace: apps
spec:
  parentRefs:
    - name: prod-gateway
      namespace: infra          # Gateway in another namespace (see ReferenceGrant)
  hostnames:
    - "app.example.com"
  rules:
    - matches:
        - path:
            type: PathPrefix    # PathPrefix | Exact | RegularExpression
            value: /api
      backendRefs:
        - name: api-svc
          port: 8080
\`\`\`

### Match types
\`\`\`yaml
matches:
  - path:
      type: Exact
      value: /healthz
  - headers:
      - name: x-version
        value: v2
  - queryParams:
      - name: env
        value: canary
  - method: POST
\`\`\`

> Within **one** \`match\`, all conditions are **AND**. Different items in the \`matches\` list are **OR**. (Same AND/OR logic as NetworkPolicies — a classic trap.)

---

## Traffic Splitting (weighted canary)

No annotations: just multiple \`backendRefs\` with \`weight\`. This is an exam scenario.

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-route
  namespace: apps
spec:
  parentRefs:
    - name: prod-gateway
      namespace: infra
  hostnames:
    - "app.example.com"
  rules:
    - backendRefs:
        - name: app-stable
          port: 80
          weight: 90            # 90% of traffic
        - name: app-canary
          port: 80
          weight: 10            # 10% of traffic
\`\`\`

> Weight is relative (90:10, 9:1, 3:1...). A backend with \`weight: 0\` stops receiving traffic but stays resolved.

---

## Filters (request/response manipulation)

They replace Ingress annotations with native, portable fields:

\`\`\`yaml
rules:
  - matches:
      - path: { type: PathPrefix, value: /old }
    filters:
      - type: RequestRedirect          # 3xx redirect
        requestRedirect:
          scheme: https
          statusCode: 301
  - matches:
      - path: { type: PathPrefix, value: /api/v1 }
    filters:
      - type: URLRewrite               # rewrites the path (replaces rewrite-target)
        urlRewrite:
          path:
            type: ReplacePrefixMatch
            replacePrefixMatch: /v1
      - type: RequestHeaderModifier    # add/set/remove headers
        requestHeaderModifier:
          add:
            - name: x-gateway
              value: "true"
    backendRefs:
      - name: api-svc
        port: 8080
\`\`\`

| Filter | Replaces the annotation for... |
|--------|--------------------------------|
| \`RequestRedirect\` | redirect / force-ssl |
| \`URLRewrite\` | rewrite-target |
| \`RequestHeaderModifier\` | header manipulation |
| \`RequestMirror\` | mirror / shadow traffic |
| \`ResponseHeaderModifier\` | response headers |

---

## Cross-Namespace Routing + ReferenceGrant

By default, a **cross-namespace** reference is **denied** (security model). Two cases require explicit permission via **ReferenceGrant**:

1. An \`HTTPRoute\` referencing a \`Service\` in **another** namespace.
2. A \`Gateway\` referencing a TLS \`Secret\` in **another** namespace.

The \`ReferenceGrant\` lives **in the target resource's namespace** (the one granting access):

\`\`\`yaml
# HTTPRoute in namespace 'apps' wants to route to a Service in namespace 'backend'
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: allow-apps-to-backend
  namespace: backend          # Service namespace (target)
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: apps         # who is requesting access
  to:
    - group: ""
      kind: Service           # what may be referenced
\`\`\`

> Without the \`ReferenceGrant\`, the \`HTTPRoute\` shows condition **ResolvedRefs=False / RefNotPermitted**. Memorize: the grant lives on the side of **whoever owns the referenced resource**.

---

## Other Route types

The Gateway API is not just HTTP:

| Kind | Use |
|------|-----|
| \`HTTPRoute\` | L7 HTTP/HTTPS (most common) |
| \`GRPCRoute\` | native gRPC routing |
| \`TLSRoute\` | TLS passthrough by SNI (no termination) |
| \`TCPRoute\` | generic L4 TCP |
| \`UDPRoute\` | generic L4 UDP |

---

## Status & Conditions (essential for debugging)

Always check the conditions — they tell you exactly what failed:

\`\`\`bash
kubectl describe httproute app-route -n apps
\`\`\`

| Condition | True means |
|-----------|------------|
| \`Accepted\` | The Gateway accepted attaching this Route |
| \`ResolvedRefs\` | All backendRefs/secrets were resolved |
| \`Programmed\` (on Gateway) | Data plane configured and ready |

Common failures: \`Accepted=False (NotAllowedByListeners)\` = \`allowedRoutes\`/hostname mismatch; \`ResolvedRefs=False (BackendNotFound)\` = wrong Service; \`RefNotPermitted\` = missing ReferenceGrant.

---

## Gateway API vs Ingress

| | Ingress | Gateway API |
|---|---------|-------------|
| Status | frozen (maintenance only) | GA, active |
| Advanced features | via annotations | native fields (filters) |
| Portability | low (proprietary annotations) | high |
| Role separation | none | GatewayClass / Gateway / Route |
| Cross-namespace | no | yes (ReferenceGrant) |
| Protocols | HTTP/HTTPS | HTTP, gRPC, TLS, TCP, UDP |
| Traffic split | controller annotation | native \`weight\` |

---

## Common Mistakes

1. **Forgetting the ReferenceGrant** when routing/referencing TLS across namespaces — \`RefNotPermitted\`.
2. **Restrictive \`allowedRoutes\`** — Gateway with \`from: Same\` and HTTPRoute in another namespace = never attaches.
3. **Incompatible hostname** — listener with \`hostname: *.example.com\` and Route with \`foo.other.com\` won't match.
4. **Confusing apiVersions** — \`Gateway\`/\`HTTPRoute\` are \`v1\`; \`ReferenceGrant\` is still \`v1beta1\`.
5. **Thinking GatewayClass provisions something by itself** — without an attached Gateway, nothing is provisioned.
6. **TLS Terminate without \`certificateRefs\`** — an HTTPS listener requires the certificate Secret.

## Killer.sh Style Challenge

> You have a Gateway \`web-gw\` in namespace \`gateway-system\` (class \`nginx\`, HTTP :80 listener, \`allowedRoutes: All\`). In namespace \`shop\` there are Services \`frontend\` (:80) and \`frontend-beta\` (:80).
>
> 1. Create an \`HTTPRoute\` named \`shop-route\` in namespace \`shop\`, attached to \`web-gw\`, for host \`shop.k8s.local\`.
> 2. Route \`/\` sending **80%** to \`frontend\` and **20%** to \`frontend-beta\`.
> 3. Add a second rule that matches header \`x-debug: true\` and sends 100% to \`frontend-beta\`.
> 4. Validate with \`kubectl describe httproute shop-route -n shop\` that \`Accepted=True\` and \`ResolvedRefs=True\`.
>
> Hint: \`parentRefs\` needs \`namespace: gateway-system\`; the more specific rule (header match) must come before the weighted rule.
`,

  quiz: [
    {
      question: 'In the Gateway API, which resource is typically the APP DEVELOPER\'s responsibility (not the cluster operator\'s)?',
      options: [
        'GatewayClass',
        'Gateway',
        'HTTPRoute',
        'IngressClass'
      ],
      correct: 2,
      explanation: 'The role-oriented model separates: GatewayClass (infra provider, picks the controller), Gateway (cluster operator, defines listeners/ports/TLS) and HTTPRoute (app developer, defines the L7 rules connecting to their Service). The dev edits the HTTPRoute in their own namespace without touching shared infra.',
      reference: 'Role Model section — GatewayClass/Gateway/HTTPRoute map to 3 distinct personas.'
    },
    {
      question: 'An HTTPRoute in namespace "apps" needs to route to a Service in namespace "backend". What is required for this to work?',
      options: [
        'Nothing — cross-namespace references are allowed by default',
        'A ReferenceGrant in namespace "backend" authorizing HTTPRoutes from "apps"',
        'A ReferenceGrant in namespace "apps" authorizing the Service',
        'Changing the Service to ExternalName'
      ],
      correct: 1,
      explanation: 'Cross-namespace references are denied by default. The ReferenceGrant must live in the TARGET resource\'s namespace (backend), declaring in "from" who is requesting (HTTPRoute from apps) and in "to" what may be referenced (Service). Without it: ResolvedRefs=False / RefNotPermitted.',
      reference: 'Cross-Namespace + ReferenceGrant section — the grant lives on the owner side of the referenced resource.'
    },
    {
      question: 'How do you do traffic splitting (90/10 canary) between two Services in the Gateway API?',
      options: [
        'With the nginx.ingress.kubernetes.io/canary-weight annotation',
        'By creating two Gateways and using DNS round-robin',
        'With multiple backendRefs in the HTTPRoute, each with a weight field',
        'It is only possible with a service mesh like Istio'
      ],
      correct: 2,
      explanation: 'The Gateway API has native traffic splitting: just list several backendRefs in a rule, each with a weight (e.g. 90 and 10). Weight is relative. This eliminates the Ingress "annotation soup" where canary depended on controller-proprietary annotations.',
      reference: 'Traffic Splitting section — relative weight, no annotations.'
    },
    {
      question: 'A Gateway has a listener with "allowedRoutes: { namespaces: { from: Same } }". An HTTPRoute in ANOTHER namespace points to it. What happens?',
      options: [
        'The Route attaches normally',
        'The Route does NOT attach (Accepted=False) because the listener only accepts Routes from the same namespace',
        'The Route attaches, but only for internal traffic',
        'The Gateway is automatically recreated in All mode'
      ],
      correct: 1,
      explanation: 'from: Same restricts attachment to Routes in the SAME namespace as the Gateway. A Route from another namespace gets Accepted=False (NotAllowedByListeners). To allow it, use from: All or from: Selector with labels on the source namespace.',
      reference: 'Gateway section — allowedRoutes table (Same | All | Selector).'
    },
    {
      question: 'Which Gateway API filter replaces the "nginx.ingress.kubernetes.io/rewrite-target" annotation?',
      options: [
        'RequestRedirect',
        'RequestHeaderModifier',
        'URLRewrite',
        'RequestMirror'
      ],
      correct: 2,
      explanation: 'The URLRewrite filter rewrites the path (e.g. ReplacePrefixMatch) natively and portably, replacing the rewrite-target annotation. RequestRedirect does 3xx redirects; RequestHeaderModifier edits headers; RequestMirror mirrors traffic to another backend.',
      reference: 'Filters section — equivalence table with Ingress annotations.'
    },
    {
      question: 'In an HTTPRoute, within ONE "matches" item you define path=/api AND header x-version=v2. How are these combined?',
      options: [
        'OR — only one condition needs to match',
        'AND — both must match simultaneously',
        'They are ignored; only the path counts',
        'It depends on the controller'
      ],
      correct: 1,
      explanation: 'Within the same match object, all conditions (path, headers, queryParams, method) are AND — they must match together. DIFFERENT items in the matches list are OR. This is the same AND/OR logic as NetworkPolicies, a frequent trap.',
      reference: 'HTTPRoute section — AND within a match, OR between matches.'
    },
    {
      question: 'You applied an HTTPS Gateway but ADDRESS stays empty and PROGRAMMED=False. What is the most likely interpretation?',
      options: [
        'The HTTPRoute has the wrong host',
        'The controller has not provisioned/configured the data plane yet (or there is no controller for the GatewayClass)',
        'A ReferenceGrant is missing',
        'The backend Service does not exist'
      ],
      correct: 1,
      explanation: 'PROGRAMMED=True with a populated ADDRESS means the controller materialized the Gateway. Empty/False usually means the GatewayClass controller is not running, does not recognize the class, or has not finished provisioning the LB. Check kubectl get gatewayclass and the controller logs.',
      reference: 'Status & Conditions section — PROGRAMMED on the Gateway = data plane ready.'
    },
    {
      question: 'Which statement about Gateway API vs Ingress is CORRECT?',
      options: [
        'The Gateway API has already removed the Ingress API from Kubernetes',
        'Both coexist; Ingress is in maintenance mode and the Gateway API (GA) is where new development happens',
        'The Gateway API only works with Istio',
        'Ingress supports TCP/UDP natively, the Gateway API does not'
      ],
      correct: 1,
      explanation: 'Ingress was not removed — it is frozen (maintenance only). The Gateway API is GA (v1.0+) and concentrates the evolution: native filters, role separation, cross-namespace and support for HTTP/gRPC/TLS/TCP/UDP. The two coexist during the transition.',
      reference: 'Gateway API vs Ingress section — comparison table.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 3 core Gateway API resources and each one\'s persona?',
      back: '**GatewayClass** (infra provider) — points to the controller, like a StorageClass; cluster-scoped.\n\n**Gateway** (cluster operator) — the proxy/LB instance; defines listeners (port, protocol, hostname, TLS, allowedRoutes).\n\n**HTTPRoute** (app developer) — L7 rules; connects to the Gateway via parentRefs and to the Service via backendRefs.\n\n**Role-oriented** model: each persona edits only its own resource.'
    },
    {
      front: 'What is a ReferenceGrant and where does it live?',
      back: 'Authorizes **cross-namespace** references (denied by default).\n\nTwo cases: HTTPRoute → Service in another ns, and Gateway → TLS Secret in another ns.\n\n**Lives in the TARGET resource\'s namespace** (the grantor).\n\n```yaml\nkind: ReferenceGrant\nmetadata:\n  namespace: backend   # Service ns\nspec:\n  from:\n    - kind: HTTPRoute\n      namespace: apps\n  to:\n    - kind: Service\n```\n\nWithout it: ResolvedRefs=False / RefNotPermitted.'
    },
    {
      front: 'How does traffic splitting (canary) work in the Gateway API?',
      back: 'Native, via multiple **backendRefs** with **weight** in a rule:\n\n```yaml\nbackendRefs:\n  - name: app-stable\n    port: 80\n    weight: 90\n  - name: app-canary\n    port: 80\n    weight: 10\n```\n\nWeight is **relative** (90:10). weight: 0 = backend stops receiving. No proprietary annotations.'
    },
    {
      front: 'allowedRoutes.namespaces.from — which values and what they do',
      back: '**Same** — only Routes in the same namespace as the Gateway.\n\n**All** — Routes from any namespace.\n\n**Selector** — Routes from namespaces matching a matchLabels.\n\nControls who can attach to the listener. If it doesn\'t match: HTTPRoute becomes Accepted=False (NotAllowedByListeners).'
    },
    {
      front: 'AND vs OR logic in an HTTPRoute\'s matches',
      back: '**AND** — conditions (path, headers, queryParams, method) WITHIN the same match object.\n\n**OR** — DIFFERENT items in the matches list.\n\n```yaml\nmatches:\n  - path: { type: PathPrefix, value: /api }\n    headers:\n      - name: x-version\n        value: v2          # path AND header\n  - path: { type: Exact, value: /health }  # OR this rule\n```\n\nSame logic as NetworkPolicies.'
    },
    {
      front: 'Which conditions to check when debugging Gateway API and what they mean?',
      back: '**Accepted** (HTTPRoute) — the Gateway accepted attaching the Route. False/NotAllowedByListeners = allowedRoutes/hostname mismatch.\n\n**ResolvedRefs** (HTTPRoute) — backendRefs/secrets resolved. False/BackendNotFound = wrong Service; RefNotPermitted = missing ReferenceGrant.\n\n**Programmed** (Gateway) — data plane configured; together with a populated ADDRESS = ready.\n\n`kubectl describe httproute/gateway` shows everything.'
    },
    {
      front: 'Gateway API vs Ingress — 4 key differences',
      back: '1. **Status**: Ingress frozen (maintenance only) vs Gateway API GA and active.\n2. **Advanced**: Ingress via proprietary annotations vs Gateway API with native filters (URLRewrite, RequestRedirect...).\n3. **Roles**: Ingress mixes everything vs Gateway separates GatewayClass/Gateway/Route.\n4. **Protocols**: Ingress only HTTP/S vs Gateway HTTP, gRPC, TLS, TCP, UDP. Bonus: cross-namespace with ReferenceGrant.'
    },
    {
      front: 'Difference between TLS mode Terminate and Passthrough on the Gateway',
      back: '**Terminate** — the Gateway ends TLS (decrypts). Requires certificateRefs (Secret with the certificate). Traffic continues to the backend in clear text (or re-encrypted).\n\n**Passthrough** — the Gateway does NOT decrypt; it forwards raw TLS to the backend by SNI (uses TLSRoute, not HTTPRoute). The certificate lives on the backend.\n\nAPI: HTTPS listener with `tls.mode: Terminate | Passthrough`.'
    }
  ],

  lab: {
    scenario: 'Install the Gateway API + a controller (NGINX Gateway Fabric), expose an app via HTTPRoute, do weighted canary and enable cross-namespace routing with ReferenceGrant.',
    objective: 'Master the GatewayClass → Gateway → HTTPRoute flow and the two most-tested scenarios: traffic splitting and cross-namespace.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Install Gateway API CRDs and the controller',
        instruction: 'Install the official Gateway API CRDs and NGINX Gateway Fabric. Confirm the GatewayClass becomes Accepted.',
        hints: ['CRDs do not ship by default in the cluster', 'GatewayClass should show ACCEPTED=True'],
        solution: `\`\`\`bash
# 1. Install Gateway API CRDs (standard channel)
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.1.0/standard-install.yaml

# 2. Install the controller (NGINX Gateway Fabric)
kubectl apply -f https://raw.githubusercontent.com/nginx/nginx-gateway-fabric/v1.4.0/deploy/default/deploy.yaml

# 3. Check
kubectl get gatewayclass
kubectl get pods -n nginx-gateway
\`\`\``,
        verify: `\`\`\`bash
kubectl get gatewayclass nginx
# NAME    CONTROLLER                                  ACCEPTED   AGE
# nginx   gateway.nginx.org/nginx-gateway-controller  True       1m

kubectl get crd | grep gateway.networking.k8s.io
# Expected: gateways, httproutes, referencegrants, gatewayclasses...
\`\`\``
      },
      {
        title: 'Create the Gateway and an app, expose it via HTTPRoute',
        instruction: 'Create namespace infra with a Gateway (HTTP :80, allowedRoutes: All) and an app in namespace apps exposed by an HTTPRoute.',
        hints: ['parentRefs needs the Gateway namespace', 'Use kubectl run + expose for the app'],
        solution: `\`\`\`bash
kubectl create namespace infra
kubectl create namespace apps

# Gateway
cat <<'EOF' | kubectl apply -f -
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: prod-gateway
  namespace: infra
spec:
  gatewayClassName: nginx
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: All
EOF

# App + Service in namespace apps
kubectl create deployment web --image=nginx -n apps
kubectl expose deployment web --port=80 -n apps

# HTTPRoute
cat <<'EOF' | kubectl apply -f -
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: web-route
  namespace: apps
spec:
  parentRefs:
    - name: prod-gateway
      namespace: infra
  hostnames:
    - "web.k8s.local"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: web
          port: 80
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get gateway prod-gateway -n infra
# PROGRAMMED should go to True

kubectl describe httproute web-route -n apps | grep -A3 Conditions
# Expected: Accepted=True and ResolvedRefs=True
\`\`\``
      },
      {
        title: 'Traffic splitting 80/20 (canary)',
        instruction: 'Add a canary version (web-canary) and adjust the HTTPRoute to send 80% to stable web and 20% to canary via weight.',
        hints: ['Two backendRefs with weight', 'Weight is relative'],
        solution: `\`\`\`bash
# Canary deploy
kubectl create deployment web-canary --image=nginxdemos/hello -n apps
kubectl expose deployment web-canary --port=80 -n apps

# Update the Route with weights
cat <<'EOF' | kubectl apply -f -
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: web-route
  namespace: apps
spec:
  parentRefs:
    - name: prod-gateway
      namespace: infra
  hostnames:
    - "web.k8s.local"
  rules:
    - backendRefs:
        - name: web
          port: 80
          weight: 80
        - name: web-canary
          port: 80
          weight: 20
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get httproute web-route -n apps -o jsonpath='{.spec.rules[0].backendRefs[*].weight}'
# Expected: 80 20

# (Optional) generate traffic and observe the split via the gateway address
# GW=$(kubectl get gateway prod-gateway -n infra -o jsonpath='{.status.addresses[0].value}')
# for i in $(seq 20); do curl -s -H "Host: web.k8s.local" http://$GW/ | grep -o 'Server\\|nginx'; done
\`\`\``
      },
      {
        title: 'Cross-namespace routing with ReferenceGrant',
        instruction: 'Create a Service in a third namespace (backend) and route to it from the HTTPRoute in apps. Observe the failure, then grant access with a ReferenceGrant.',
        hints: ['Without grant: ResolvedRefs=False / RefNotPermitted', 'The ReferenceGrant lives in namespace backend'],
        solution: `\`\`\`bash
kubectl create namespace backend
kubectl create deployment api --image=nginx -n backend
kubectl expose deployment api --port=80 -n backend

# Point the Route (in apps) to the api Service (in backend) -> it will FAIL first
kubectl patch httproute web-route -n apps --type=json -p '[
  {"op":"replace","path":"/spec/rules/0/backendRefs","value":[{"name":"api","namespace":"backend","port":80}]}
]'

kubectl describe httproute web-route -n apps | grep -A3 Conditions
# Expected now: ResolvedRefs=False (RefNotPermitted)

# Grant access with a ReferenceGrant in the TARGET namespace (backend)
cat <<'EOF' | kubectl apply -f -
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: allow-apps
  namespace: backend
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: apps
  to:
    - group: ""
      kind: Service
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl describe httproute web-route -n apps | grep -A3 Conditions
# Expected: ResolvedRefs=True after the ReferenceGrant

# Cleanup
kubectl delete namespace apps infra backend
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'HTTPRoute does not attach to the Gateway (Accepted=False)',
      difficulty: 'medium',
      symptom: 'The HTTPRoute was created without errors, but traffic does not reach the Service and "kubectl describe" shows Accepted=False with reason NotAllowedByListeners or NoMatchingListenerHostname.',
      diagnosis: `\`\`\`bash
# Check the Route conditions
kubectl describe httproute my-route -n apps | grep -A5 Conditions

# Compare Route namespace vs Gateway allowedRoutes
kubectl get gateway prod-gateway -n infra -o jsonpath='{.spec.listeners[*].allowedRoutes.namespaces.from}'

# Compare listener hostname vs Route hostnames
kubectl get gateway prod-gateway -n infra -o jsonpath='{.spec.listeners[*].hostname}'
kubectl get httproute my-route -n apps -o jsonpath='{.spec.hostnames}'
\`\`\``,
      solution: `**Two typical causes:**

1. **Restrictive allowedRoutes** — the listener is \`from: Same\` and the Route is in another namespace. Fix: change to \`from: All\` (or \`Selector\` with labels), or move the Route to the Gateway namespace.

2. **Incompatible hostname** — the listener has \`hostname: *.example.com\` and the Route uses \`foo.other.com\`. The domain must match (including wildcard). Adjust the Route \`hostnames\` or the listener \`hostname\`.

\`\`\`bash
# Example: allow all namespaces
kubectl patch gateway prod-gateway -n infra --type=json -p '[
  {"op":"replace","path":"/spec/listeners/0/allowedRoutes/namespaces/from","value":"All"}
]'
\`\`\`

**Prevention:** always check allowedRoutes + hostname before creating the Route; they are the listener\'s "contract".`
    },
    {
      title: 'ResolvedRefs=False with RefNotPermitted (cross-namespace)',
      difficulty: 'medium',
      symptom: 'An HTTPRoute points to a Service in another namespace and the ResolvedRefs condition is False with reason RefNotPermitted. The Service exists and is healthy.',
      diagnosis: `\`\`\`bash
kubectl describe httproute api-route -n apps | grep -A5 Conditions
# ResolvedRefs   False   RefNotPermitted

# Is there a ReferenceGrant in the TARGET namespace?
kubectl get referencegrant -n backend
\`\`\``,
      solution: `**Cause:** cross-namespace references are denied by default. A \`ReferenceGrant\` is missing in the **Service\'s namespace** (the target) authorizing the source HTTPRoute.

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: allow-apps-to-backend
  namespace: backend          # namespace of the referenced Service
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: apps         # where the HTTPRoute comes from
  to:
    - group: ""
      kind: Service
\`\`\`

**Key reminder:** the grant ALWAYS lives on the side of whoever OWNS the referenced resource, never on the requester side. The same applies to a Gateway referencing a TLS Secret in another namespace.`
    },
    {
      title: 'Gateway with no ADDRESS and PROGRAMMED=False',
      difficulty: 'hard',
      symptom: 'The Gateway was applied but never gets an ADDRESS and the Programmed condition stays False. No Route works.',
      diagnosis: `\`\`\`bash
kubectl get gateway prod-gateway -n infra
# ADDRESS empty, PROGRAMMED False

# Does the GatewayClass exist and was it accepted?
kubectl get gatewayclass

# Is the controller running?
kubectl get pods -A | grep -i gateway

# Controller logs
kubectl logs -n nginx-gateway deploy/nginx-gateway -c nginx-gateway --tail=50
\`\`\``,
      solution: `**Possible causes:**

1. **Missing/broken controller** — the GatewayClass points to a \`controllerName\` whose controller is not installed or is in CrashLoop. Without a controller, nobody materializes the Gateway. Install/repair the controller.

2. **Wrong gatewayClassName** — the field does not match any existing GatewayClass. Check \`kubectl get gatewayclass\` and fix it.

3. **No LoadBalancer available** — on bare-metal clusters without MetalLB/provider, a LoadBalancer Service stays Pending and the Gateway gets no ADDRESS. Use NodePort/MetalLB or a controller that uses hostPort.

\`\`\`bash
# Check the data plane Service (it may be Pending)
kubectl get svc -n nginx-gateway
\`\`\`

**Prevention:** validate \`gatewayclass ACCEPTED=True\` and the controller pod Running before creating Gateways.`
    }
  ]
};
