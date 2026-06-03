window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kong/kong-fundamentals'] = {
  theory: `
# Kong Gateway: Fundamentals

## Relevance
Kong Gateway is the world's most widely used open-source API Gateway, built on NGINX+OpenResty. In the Kubernetes context, the Kong Ingress Controller (KIC) allows managing inbound traffic via native Kubernetes resources (Ingress, Gateway API) as well as Kong's own CRDs. Essential knowledge for platforms with many APIs and microservices.

## Fundamental Concepts

### Kong Architecture in Kubernetes

\`\`\`
                                        Kong Ingress Controller
     ┌──────────────────────────────────────────────────────┐
     │                                                      │
     │  Kubernetes API ──── KIC (controlplane) ───────────► │
     │                           │                          │
     │                           ▼                          │
     │  Clients ───► Kong Proxy (dataplane/NGINX) ─────────►│
     │               port 80/443                    Services │
     │                                                      │
     └──────────────────────────────────────────────────────┘
\`\`\`

**Deploy modes:**
- **DBless (recommended for K8s):** Declarative configuration via ConfigMap/CRDs — no database required
- **DB-backed:** PostgreSQL as configuration store — for large clusters with Admin API

### Installation via Helm

\`\`\`bash
# Add Kong Helm repository
helm repo add kong https://charts.konghq.com
helm repo update

# Install Kong Ingress Controller (DBless mode)
helm install kong kong/ingress \\
  --namespace kong \\
  --create-namespace \\
  --set controller.ingressClass=kong \\
  --set proxy.type=LoadBalancer

# Verify pods
kubectl get pods -n kong
# Expected output: kong-controller and kong-proxy Running

# Verify LoadBalancer
kubectl get svc -n kong
# Expected output: kong-proxy with EXTERNAL-IP
\`\`\`

### Main Kong CRDs

\`\`\`
KongPlugin          — defines a plugin (rate-limit, auth, etc.)
KongClusterPlugin   — cluster-level plugin (available in all namespaces)
KongConsumer        — API user/consumer (for auth)
KongConsumerGroup   — consumer group with shared configuration
KongIngress         — overrides Ingress behavior (upstream, proxy, route)
KongUpstreamPolicy  — load balancing policy (round-robin, least-connections, etc.)
\`\`\`

### Ingress with Kong

\`\`\`yaml
# Basic Ingress — Kong routes traffic to the service
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: echo-ingress
  namespace: default
  annotations:
    konghq.com/strip-path: "true"      # Remove path prefix before forwarding
spec:
  ingressClassName: kong
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /echo
            pathType: Prefix
            backend:
              service:
                name: echo-service
                port:
                  number: 80
\`\`\`

### Gateway API with Kong (modern approach)

Kong supports the Kubernetes Gateway API — more expressive than traditional Ingress.

\`\`\`yaml
# GatewayClass — defines the controller
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: kong
  annotations:
    konghq.com/gatewayclass-unmanaged: "true"
spec:
  controllerName: konghq.com/kic-gateway-controller
---
# Gateway — entry point
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: kong-gateway
  namespace: kong
spec:
  gatewayClassName: kong
  listeners:
    - name: http
      port: 80
      protocol: HTTP
      allowedRoutes:
        namespaces:
          from: All
---
# HTTPRoute — routing rules
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: echo-route
  namespace: default
spec:
  parentRefs:
    - name: kong-gateway
      namespace: kong
  hostnames:
    - "api.example.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /echo
      backendRefs:
        - name: echo-service
          port: 80
\`\`\`

### KongPlugin — Adding Plugins to Routes

\`\`\`yaml
# Rate-limiting plugin (limit by IP)
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: rate-limit-5-per-min
  namespace: default
plugin: rate-limiting
config:
  minute: 5
  limit_by: ip
  policy: local            # local | redis | cluster
---
# Apply plugin to Ingress via annotation
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: echo-ingress
  annotations:
    konghq.com/plugins: rate-limit-5-per-min   # KongPlugin name
spec:
  # ...
\`\`\`

\`\`\`yaml
# Apply plugin to a Service (affects all routes of this service)
apiVersion: v1
kind: Service
metadata:
  name: echo-service
  annotations:
    konghq.com/plugins: rate-limit-5-per-min
spec:
  # ...
\`\`\`

### KongConsumer — Consumer Management

\`\`\`yaml
# Consumer with key-auth credentials
apiVersion: configuration.konghq.com/v1
kind: KongConsumer
metadata:
  name: my-consumer
  namespace: default
  annotations:
    kubernetes.io/ingress.class: "kong"
username: my-consumer
credentials:
  - my-consumer-key-secret   # Secret name with credential
---
# Secret with API Key
apiVersion: v1
kind: Secret
metadata:
  name: my-consumer-key-secret
  namespace: default
  labels:
    konghq.com/credential: key-auth   # Credential type
stringData:
  key: my-super-secret-api-key        # The key itself
\`\`\`

### KongIngress — Customizing Behavior

\`\`\`yaml
# KongIngress — override of advanced settings
apiVersion: configuration.konghq.com/v1
kind: KongIngress
metadata:
  name: echo-ingress-override
  namespace: default
route:
  methods:
    - GET
    - POST
  strip_path: true
  preserve_host: true
upstream:
  algorithm: round-robin    # round-robin | least-connections | consistent-hashing
  healthchecks:
    active:
      http_path: /health
      healthy:
        interval: 10
        successes: 3
      unhealthy:
        interval: 5
        http_failures: 3
proxy:
  connect_timeout: 2000     # ms
  read_timeout: 60000
  write_timeout: 60000
\`\`\`

### Common Errors

1. **Wrong ingressClassName** — Must be "kong" (or the value set in helm install); without this, KIC ignores the Ingress
2. **Plugin not applied** — The konghq.com/plugins annotation must have the EXACT name of the KongPlugin; check namespace
3. **KongConsumer without kubernetes.io/ingress.class** — Without this annotation, the consumer may not be recognized by the controller
4. **Gateway API not installed** — Gateway API CRDs need to be installed separately; check with kubectl get crds | grep gateway.networking

## Killer.sh Style Challenge

> **Scenario:** Configure Kong as Ingress Controller for an "api-service" on port 8080. The service should be accessible at /api with strip-path active, with rate limiting of 100 requests per minute per IP, and only GET and POST methods allowed.
`,
  quiz: [
    {
      question: 'What is the difference between KongPlugin and KongClusterPlugin?',
      options: [
        'KongPlugin is faster than KongClusterPlugin',
        'KongPlugin is namespaced (available only in the namespace where it was created); KongClusterPlugin is cluster-scoped (available in all namespaces)',
        'KongClusterPlugin supports more plugin types',
        'They are equivalent — just different names'
      ],
      correct: 1,
      explanation: 'KongPlugin (namespaced) can only be referenced by Ingresses/Services in the same namespace. KongClusterPlugin is a cluster-scoped resource that can be applied to any resource in any namespace — ideal for global plugins like corporate rate-limiting or default authentication.',
      reference: 'Related concept: To apply a plugin globally to ALL routes, use KongClusterPlugin with the konghq.com/plugins annotation in the kong-system namespace.'
    },
    {
      question: 'How does the Kong Ingress Controller (KIC) know which Ingresses to manage?',
      options: [
        'It manages all Ingresses in the cluster automatically',
        'Via spec.ingressClassName: kong in the Ingress or annotation kubernetes.io/ingress.class: kong',
        'Via labels on the Ingress',
        'Only via Gateway API resources'
      ],
      correct: 1,
      explanation: 'KIC monitors Ingresses with ingressClassName: kong (spec.ingressClassName) or the annotation kubernetes.io/ingress.class: "kong" (legacy). Ingresses without these fields are ignored by KIC. The class name can be customized at helm install with --set controller.ingressClass=<name>.',
      reference: 'Related concept: Multiple Ingress Controllers can coexist in the same cluster (nginx, kong, traefik) — each only processes Ingresses of its class.'
    },
    {
      question: 'What does the annotation konghq.com/strip-path: "true" do in an Ingress?',
      options: [
        'Removes all request headers',
        'Removes the path prefix configured in the Ingress before forwarding the request to the backend',
        'Redirects the request to HTTPS',
        'Removes the complete path from the request'
      ],
      correct: 1,
      explanation: 'With strip-path: true, if the Ingress has path /api and the client makes GET /api/users, Kong forwards GET /users to the backend (removes the /api prefix). Without strip-path, the backend would receive GET /api/users, which may cause 404 if the backend doesn\'t expect the prefix.',
      reference: 'Related concept: The same behavior can be configured in KongIngress.route.strip_path for more advanced configurations.'
    },
    {
      question: 'What is the advantage of DBless mode in Kong for Kubernetes?',
      options: [
        'It is faster but has fewer features',
        'Eliminates the dependency on an external database — configuration is declarative via CRDs and ConfigMaps, aligned with GitOps philosophy',
        'Supports more plugins than the database-backed mode',
        'It is more secure because it doesn\'t store configurations'
      ],
      correct: 1,
      explanation: 'DBless is ideal for Kubernetes: no PostgreSQL to manage, configuration via YAML/CRDs versionable in Git (GitOps), fast restart (reconfigures via ConfigMap), and lower operational overhead. The downside is that the Admin API becomes read-only — changes must be made through Kubernetes.',
      reference: 'Related concept: In DBless mode, you cannot use the kong admin CLI to create routes — everything must be done via kubectl and CRDs.'
    },
    {
      question: 'How to apply a KongPlugin to all requests of a specific Service?',
      options: [
        'Add the plugin directly in the Service spec',
        'Add the annotation konghq.com/plugins: <plugin-name> to the Service',
        'Create a KongIngress with the plugin configured',
        'Plugins can only be applied to Ingresses, not Services'
      ],
      correct: 1,
      explanation: 'The konghq.com/plugins annotation can be placed on both the Ingress (applies only to that route) and the Service (applies to all routes using that Service). This allows applying authentication or rate-limiting plugins at the service level, regardless of how many Ingresses point to it.',
      reference: 'Related concept: Plugins on Service have different configuration precedence than plugins on Ingress — consult Kong\'s precedence documentation.'
    },
    {
      question: 'What is the Gateway API in the Kong context?',
      options: [
        'The Kong administrative API (Admin API)',
        'A REST API to manage Kong externally',
        'An official Kubernetes standard more expressive than Ingress, using GatewayClass, Gateway and HTTPRoute to configure inbound traffic',
        'A feature exclusive to Kong Enterprise'
      ],
      correct: 2,
      explanation: 'Gateway API is an official Kubernetes standard (SIG-Network project) that overcomes Ingress limitations: supports traffic weights, header filters, multiple backends per rule, and is extensible by design. Kong supports Gateway API with GatewayClass, Gateway, HTTPRoute and GRPCRoute CRDs.',
      reference: 'Related concept: Gateway API is replacing Ingress as the recommended standard — new code should prefer HTTPRoute over Ingress for greater portability.'
    },
    {
      question: 'How to configure active healthchecks on a Kong upstream via KongIngress?',
      options: [
        'Configure readinessProbe on the Pod',
        'Using KongIngress.upstream.healthchecks.active with http_path, interval, and healthy/unhealthy criteria',
        'Create a specific Probe on the Service',
        'Active healthchecks are not supported in KIC mode'
      ],
      correct: 1,
      explanation: 'KongIngress allows configuring active healthchecks (Kong periodically probes the backend) and passive (Kong observes real errors). Criteria include: http_path for the health endpoint, interval in seconds, successes to mark as healthy, and http_failures to mark as unhealthy.',
      reference: 'Related concept: KongUpstreamPolicy is the more modern resource for configuring load balancing algorithms and healthchecks in Kong.'
    }
  ],
  flashcards: [
    {
      front: 'Kong Ingress Controller — main resources and their functions',
      back: '**Native Kubernetes:**\n- `Ingress` — routing rules (with ingressClassName: kong)\n- `Service` — backend for the proxy\n- `Secret` — consumer credentials\n\n**Kong CRDs:**\n- `KongPlugin` — namespaced plugin (rate-limit, auth, cors)\n- `KongClusterPlugin` — cluster-scoped plugin (global)\n- `KongConsumer` — API user/consumer\n- `KongConsumerGroup` — consumer group\n- `KongIngress` — advanced route/upstream/proxy override\n- `KongUpstreamPolicy` — load balancing algorithm\n\n**Gateway API (modern):**\n- `GatewayClass` — gateway type\n- `Gateway` — gateway instance\n- `HTTPRoute` — HTTP routing rules\n- `GRPCRoute` — gRPC routing rules\n\n**Key annotations:**\n- `konghq.com/plugins: plugin-name`\n- `konghq.com/strip-path: "true"`\n- `kubernetes.io/ingress.class: kong`'
    },
    {
      front: 'Kong DBless vs DB-backed — when to use each',
      back: '**DBless (recommended for K8s):**\n\`\`\`bash\nhelm install kong kong/ingress \\\n  --set env.database=off\n\`\`\`\n- ✅ No external PostgreSQL\n- ✅ Config via CRDs/YAML (GitOps)\n- ✅ Fast restart\n- ✅ Lower operational overhead\n- ❌ Admin API readonly\n- ❌ No advanced clustering\n\n**DB-backed:**\n\`\`\`bash\nhelm install kong kong/kong \\\n  --set postgresql.enabled=true\n\`\`\`\n- ✅ Full Admin API\n- ✅ Multi-pod coordination\n- ✅ Deck CLI sync\n- ❌ Requires HA PostgreSQL\n- ❌ More complex operationally\n\n**General rule:** DBless for K8s native,\nDB-backed for on-prem Kong or Konnect hybrid'
    },
    {
      front: 'Applying plugins in Kong — precedence and scopes',
      back: '**Application levels (most specific to most general):**\n1. **Route** (Ingress annotation) — affects only that route\n2. **Service** (Service annotation) — affects all routes of the service\n3. **Consumer** (KongConsumer annotation) — affects requests from that consumer\n4. **Global** (KongClusterPlugin without target) — affects everything\n\n**Annotation syntax:**\n\`\`\`yaml\nmetadata:\n  annotations:\n    konghq.com/plugins: plugin1,plugin2\n\`\`\`\n\n**Multiple plugins:**\n\`\`\`yaml\nkonghq.com/plugins: rate-limit,jwt-auth,cors\n\`\`\`\n\n**Plugin must be in the same namespace as Ingress**\n(or use KongClusterPlugin for cross-namespace)\n\n**Config precedence:**\nRoute > Service > Consumer > Global'
    },
    {
      front: 'HTTPRoute (Gateway API) vs Ingress — comparison',
      back: '**Ingress (legacy):**\n\`\`\`yaml\napiVersion: networking.k8s.io/v1\nkind: Ingress\nspec:\n  ingressClassName: kong\n  rules:\n    - host: api.example.com\n      http:\n        paths:\n          - path: /api\n            pathType: Prefix\n            backend:\n              service:\n                name: api-svc\n                port:\n                  number: 80\n\`\`\`\n\n**HTTPRoute (modern):**\n\`\`\`yaml\napiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nspec:\n  parentRefs:\n    - name: kong-gateway  # Reference to Gateway\n  rules:\n    - matches:\n        - path:\n            type: PathPrefix\n            value: /api\n      backendRefs:\n        - name: api-svc\n          port: 80\n          weight: 100    # Traffic splitting!\n\`\`\`\n\nHTTPRoute supports: weights, header filters,\nmultiple backends, query param matching'
    },
    {
      front: 'KongConsumer — API authentication',
      back: '**Create consumer with key-auth:**\n\`\`\`yaml\n# 1. Secret with credential\napiVersion: v1\nkind: Secret\nmetadata:\n  name: alice-key\n  labels:\n    konghq.com/credential: key-auth\nstringData:\n  key: alice-secret-key\n---\n# 2. KongConsumer referencing the Secret\napiVersion: configuration.konghq.com/v1\nkind: KongConsumer\nmetadata:\n  name: alice\n  annotations:\n    kubernetes.io/ingress.class: kong\nusername: alice\ncredentials:\n  - alice-key\n\`\`\`\n\n**Use the API Key in the request:**\n\`\`\`bash\ncurl -H "apikey: alice-secret-key" http://api.example.com/\n\`\`\`\n\n**Credential types:**\n- `key-auth` — API Key (header/query)\n- `basic-auth` — Username/Password\n- `jwt` — JWT tokens\n- `oauth2` — OAuth2 credentials\n- `hmac-auth` — HMAC signatures'
    },
    {
      front: 'Kong Helm install — main options',
      back: '**Install KIC (ingress controller mode):**\n\`\`\`bash\nhelm install kong kong/ingress \\\n  --namespace kong \\\n  --create-namespace\n\`\`\`\n\n**Install full Kong Gateway:**\n\`\`\`bash\nhelm install kong kong/kong \\\n  --namespace kong \\\n  --create-namespace \\\n  --set ingressController.enabled=true \\\n  --set proxy.type=LoadBalancer \\\n  --set env.database=off\n\`\`\`\n\n**Verify installation:**\n\`\`\`bash\nkubectl get pods -n kong\nkubectl get svc -n kong\nkubectl get ingressclass\n# Should show: kong\n\`\`\`\n\n**Expose for local testing:**\n\`\`\`bash\nkubectl port-forward svc/kong-proxy 8080:80 -n kong\ncurl -H "Host: api.example.com" http://localhost:8080/\n\`\`\`'
    }
  ],
  lab: {
    scenario: 'You need to configure Kong as an API Gateway for a demo application in the cluster, with rate limiting and basic access control.',
    objective: 'Install the Kong Ingress Controller, configure a route with strip-path, apply rate limiting via KongPlugin, and create a consumer with API Key authentication.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Install the Kong Ingress Controller',
        instruction: `Install the Kong Ingress Controller in the cluster using Helm:
1. Add the Kong Helm repository
2. Install Kong in the "kong" namespace in DBless mode
3. Verify that pods are Running
4. Create a test application (echo server) to use as backend`,
        hints: [
          'Use helm install kong kong/ingress for the simplified mode (KIC)',
          'The proxy may take a few minutes to get an EXTERNAL-IP if using LoadBalancer',
          'For local environments (kind/minikube), use type: NodePort or port-forward'
        ],
        solution: `\`\`\`bash
# Add Kong Helm repository
helm repo add kong https://charts.konghq.com
helm repo update

# Install the Kong Ingress Controller
helm install kong kong/ingress \\
  --namespace kong \\
  --create-namespace \\
  --set controller.ingressClass=kong \\
  --set proxy.type=LoadBalancer

# Verify installation
kubectl get pods -n kong
kubectl get svc -n kong
\`\`\`

\`\`\`yaml
# echo-app.yaml — test application
apiVersion: apps/v1
kind: Deployment
metadata:
  name: echo
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: echo
  template:
    metadata:
      labels:
        app: echo
    spec:
      containers:
        - name: echo
          image: ealen/echo-server:latest
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: echo-service
  namespace: default
spec:
  selector:
    app: echo
  ports:
    - port: 80
      targetPort: 80
\`\`\`

\`\`\`bash
kubectl apply -f echo-app.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify Kong pods
kubectl get pods -n kong
# Expected output: 2 pods Running (controller and proxy)
# controller-xxx    1/1   Running
# proxy-xxx         1/1   Running

# Verify Kong IngressClass
kubectl get ingressclass
# Expected output: kong listed

# Verify proxy service
kubectl get svc -n kong
# Expected output: kong-proxy with port 80/443

# Verify test application pod
kubectl get pods -l app=echo
# Expected output: echo-xxx Running

# Verify test service
kubectl get svc echo-service
# Expected output: echo-service ClusterIP port 80
\`\`\``
      },
      {
        title: 'Configure Ingress with strip-path and rate limiting',
        instruction: `Configure routing and apply rate limiting:
1. Create a rate-limiting KongPlugin (5 requests per minute for testing)
2. Create an Ingress with ingressClassName: kong and strip-path active
3. Apply the plugin to the Ingress via annotation
4. Test rate limiting after hitting the limit`,
        hints: [
          'KongPlugin must be in the same namespace as the Ingress',
          'The konghq.com/plugins annotation takes the KongPlugin name',
          'Use curl with -i to see X-RateLimit-Remaining-Minute headers'
        ],
        solution: `\`\`\`yaml
# kong-rate-limit.yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: rate-limit-5rpm
  namespace: default
plugin: rate-limiting
config:
  minute: 5
  limit_by: ip
  policy: local
  hide_client_headers: false  # Show rate limit headers
---
# echo-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: echo-ingress
  namespace: default
  annotations:
    konghq.com/strip-path: "true"
    konghq.com/plugins: rate-limit-5rpm
spec:
  ingressClassName: kong
  rules:
    - http:
        paths:
          - path: /echo
            pathType: Prefix
            backend:
              service:
                name: echo-service
                port:
                  number: 80
\`\`\`

\`\`\`bash
kubectl apply -f kong-rate-limit.yaml
kubectl apply -f echo-ingress.yaml

# Get Kong proxy IP/port
KONG_IP=\$(kubectl get svc kong-proxy -n kong -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
# Or for NodePort:
# KONG_PORT=\$(kubectl get svc kong-proxy -n kong -o jsonpath='{.spec.ports[0].nodePort}')

# Test the route
curl -i http://\$KONG_IP/echo
\`\`\``,
        verify: `\`\`\`bash
# Verify KongPlugin created
kubectl get kongplugin -n default
# Expected output: rate-limit-5rpm Ready

# Verify Ingress
kubectl get ingress echo-ingress
# Expected output: CLASS=kong, ADDRESS populated

# Test the route (set KONG_IP or use port-forward)
kubectl port-forward svc/kong-proxy 8080:80 -n kong &

# Make several requests to see rate limit headers
for i in 1 2 3 4 5 6; do
  echo "Request \$i:"
  curl -si http://localhost:8080/echo | grep -E "HTTP|X-RateLimit|RateLimit"
done
# Expected output for requests 1-5: X-RateLimit-Remaining-Minute decreasing
# Expected output for request 6: HTTP 429 Too Many Requests

# Verify KongPlugin is applied to the route
kubectl describe ingress echo-ingress | grep -i annotation
# Expected output: konghq.com/plugins: rate-limit-5rpm
\`\`\``
      },
      {
        title: 'Create consumer with API Key authentication',
        instruction: `Configure API Key authentication:
1. Add key-auth plugin to the Ingress
2. Create a Secret with the consumer's API Key
3. Create a KongConsumer referencing the Secret
4. Test that requests without API Key are rejected and with API Key are accepted`,
        hints: [
          'The Secret must have the label konghq.com/credential: key-auth',
          'The KongConsumer needs the annotation kubernetes.io/ingress.class: kong',
          'By default, the API Key is sent in the "apikey" header'
        ],
        solution: `\`\`\`yaml
# key-auth-plugin.yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: key-auth
  namespace: default
plugin: key-auth
config:
  key_names:
    - apikey            # Header name for the API Key
  hide_credentials: true  # Don't forward the key to the backend
\`\`\`

\`\`\`bash
# Add key-auth to the Ingress
kubectl annotate ingress echo-ingress \\
  konghq.com/plugins="rate-limit-5rpm,key-auth" \\
  --overwrite
\`\`\`

\`\`\`yaml
# consumer.yaml
apiVersion: v1
kind: Secret
metadata:
  name: alice-api-key
  namespace: default
  labels:
    konghq.com/credential: key-auth
stringData:
  key: "alice-secret-key-123"
---
apiVersion: configuration.konghq.com/v1
kind: KongConsumer
metadata:
  name: alice
  namespace: default
  annotations:
    kubernetes.io/ingress.class: "kong"
username: alice
credentials:
  - alice-api-key
\`\`\`

\`\`\`bash
kubectl apply -f key-auth-plugin.yaml
kubectl apply -f consumer.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify KongConsumer created
kubectl get kongconsumer -n default
# Expected output: alice Ready

# Test WITHOUT API Key (should be rejected)
curl -si http://localhost:8080/echo | head -5
# Expected output: HTTP/1.1 401 Unauthorized
# Body: {"message":"No API key found in request"}

# Test WITH wrong API Key
curl -si -H "apikey: wrong-key" http://localhost:8080/echo | head -5
# Expected output: HTTP/1.1 401 Unauthorized
# Body: {"message":"Invalid authentication credentials"}

# Test WITH correct API Key
curl -si -H "apikey: alice-secret-key-123" http://localhost:8080/echo | head -3
# Expected output: HTTP/1.1 200 OK

# Verify KongConsumer and Secret
kubectl get kongconsumer alice -o yaml | grep -A3 "credentials:"
# Expected output: - alice-api-key listed
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Ingress with ingressClassName: kong not processed by KIC',
      difficulty: 'easy',
      symptom: 'The Ingress was created but does not appear in ADDRESS and Kong does not create the route. Requests to the route return 404 from Kong or "no route matched".',
      diagnosis: `\`\`\`bash
# 1. Check if IngressClass "kong" exists
kubectl get ingressclass
# If "kong" doesn't appear, KIC was not installed correctly

# 2. Check if KIC is running
kubectl get pods -n kong
kubectl logs -n kong -l app=ingress-kong -c ingress-controller --tail=20

# 3. Check the Ingress in detail
kubectl describe ingress <name>
# Check: IngressClass, annotations, Events

# 4. Check for error events
kubectl get events --field-selector reason=Sync -n default

# 5. Test the proxy directly with Host header
KONG_IP=\$(kubectl get svc kong-proxy -n kong -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl -H "Host: <ingress-host>" http://\$KONG_IP/
\`\`\``,
      solution: `**Causes and solutions:**

1. **IngressClass doesn't exist:** Check if the Kong Helm install completed successfully. If there's no "kong" IngressClass, reinstall: \`helm upgrade kong kong/ingress -n kong\`.

2. **Wrong IngressClass name:** The value in spec.ingressClassName must match the IngressClass created by Kong (usually "kong"). Verify with \`kubectl get ingressclass\`.

3. **KIC not watching the namespace:** By default, KIC watches all namespaces. If installed with --watch-namespace, verify it includes the Ingress namespace.

4. **Legacy annotation conflicting:** If the Ingress has both spec.ingressClassName and the annotation kubernetes.io/ingress.class, spec takes precedence. Remove the annotation if using spec.

5. **Sync bug:** Force controller resync:
\`\`\`bash
kubectl rollout restart deployment -n kong
\`\`\``
    },
    {
      title: 'KongPlugin applied but has no effect on requests',
      difficulty: 'medium',
      symptom: 'The KongPlugin was created and annotated on the Ingress, but the expected behavior (rate limit, authentication) doesn\'t happen. Requests are accepted normally without the plugin\'s control.',
      diagnosis: `\`\`\`bash
# 1. Check if KongPlugin is Ready
kubectl get kongplugin <name> -n <namespace>
kubectl describe kongplugin <name> -n <namespace>

# 2. Check annotation on Ingress
kubectl get ingress <name> -o yaml | grep "konghq.com/plugins"
# Must show the exact name of the KongPlugin

# 3. Check if plugin and Ingress are in the SAME namespace
kubectl get kongplugin -A | grep <name>
kubectl get ingress -A | grep <name>

# 4. View controller logs for validation errors
kubectl logs -n kong -l app=ingress-kong -c ingress-controller | grep -i "plugin\\|error"

# 5. Check if the plugin is configured on the Kong route
# Via Admin API (if available):
curl http://\$KONG_ADMIN/routes
\`\`\``,
      solution: `**Causes and solutions:**

1. **Wrong plugin name in annotation:** The konghq.com/plugins annotation must have the EXACT name of the KongPlugin (case-sensitive). Ex: if the KongPlugin is named "rate-limit-5rpm", the annotation must be exactly that.

2. **Different namespace:** KongPlugin and Ingress must be in the same namespace. If the plugin is in "default" and the Ingress in "production", the plugin is not applied. Solution: move the plugin to the same namespace or use KongClusterPlugin.

3. **Incorrect plugin type:** Check the \`plugin:\` field in KongPlugin. Ex: plugin: rate-limiting (not rate-limit). Plugin names follow Kong's nomenclature, not aliases.

4. **Invalid plugin configuration:** A plugin with invalid config may be created but not applied. Check KongPlugin events:
\`\`\`bash
kubectl describe kongplugin <name>
# Look for validation errors in Events
\`\`\`

5. **Plugin on Service but Ingress without it:** Check if the annotation is in the right place (Ingress OR Service, depending on the desired scope).`
    }
  ]
};
