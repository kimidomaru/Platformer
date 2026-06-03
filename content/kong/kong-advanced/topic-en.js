window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kong/kong-advanced'] = {
  theory: `
# Kong: Observability, Advanced Gateway API & Production

## Relevance
This topic covers Kong's advanced features for production: Prometheus and OpenTelemetry integration, advanced routing strategies with Gateway API (canary, blue-green, traffic splitting), configuration management with decK CLI, and high availability best practices in Kubernetes.

## Fundamental Concepts

### Observability — Prometheus and OpenTelemetry

\`\`\`yaml
# Prometheus plugin — expose metrics for scraping
apiVersion: configuration.konghq.com/v1
kind: KongClusterPlugin
metadata:
  name: prometheus
  annotations:
    kubernetes.io/ingress.class: kong
plugin: prometheus
config:
  status_code_metrics: true     # Count by HTTP status
  latency_metrics: true         # Latency histogram
  bandwidth_metrics: true       # Bytes sent/received
  upstream_health_metrics: true # Upstream health
\`\`\`

\`\`\`yaml
# ServiceMonitor for Prometheus Operator (kube-prometheus-stack)
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kong-metrics
  namespace: kong
  labels:
    release: kube-prometheus-stack   # Label for Prometheus to find
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: kong
  namespaceSelector:
    matchNames:
      - kong
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
\`\`\`

**Key Kong metrics:**
\`\`\`
kong_http_requests_total{service, route, method, status}  — Total requests per route
kong_http_status{code}                                    — Count by HTTP code
kong_latency_bucket                                       — Latency histogram
kong_bandwidth_bytes_total{type="ingress|egress"}         — Bytes transferred
kong_upstream_target_health{upstream, target, state}      — Upstream health
\`\`\`

### OpenTelemetry — Distributed Tracing

\`\`\`yaml
# OpenTelemetry plugin — send traces to Jaeger/Tempo/OTLP
apiVersion: configuration.konghq.com/v1
kind: KongClusterPlugin
metadata:
  name: opentelemetry
  annotations:
    kubernetes.io/ingress.class: kong
plugin: opentelemetry
config:
  endpoint: "http://otel-collector.observability.svc.cluster.local:4318/v1/traces"
  resource_attributes:
    service.name: "kong-gateway"
    service.version: "3.x"
    deployment.environment: "production"
  header_type: b3              # b3 | w3c | jaeger | ot | datadog
  propagation_media_type: "application/json"
  sampling_rate: 1.0           # 1.0 = 100% sampling (reduce in production)
\`\`\`

### Gateway API — Traffic Splitting and Canary

The Gateway API allows advanced traffic strategies without Kong-specific annotations.

\`\`\`yaml
# Canary deployment — 90% production, 10% canary
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-with-canary
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
            value: /api
      backendRefs:
        - name: api-stable          # Current version
          port: 80
          weight: 90                # 90% of traffic
        - name: api-canary          # Canary version
          port: 80
          weight: 10                # 10% of traffic
\`\`\`

\`\`\`yaml
# Header-based routing — route to v2 with specific header
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: header-based-routing
  namespace: default
spec:
  parentRefs:
    - name: kong-gateway
      namespace: kong
  rules:
    # Rule 1: Header X-Version: v2 goes to v2 service
    - matches:
        - headers:
            - name: X-Version
              value: v2
      backendRefs:
        - name: api-v2
          port: 80
    # Rule 2: Default goes to v1
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: api-v1
          port: 80
\`\`\`

\`\`\`yaml
# HTTPRoute with header modification (filters)
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: route-with-filters
  namespace: default
spec:
  parentRefs:
    - name: kong-gateway
      namespace: kong
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api/v1
      filters:
        - type: RequestHeaderModifier
          requestHeaderModifier:
            add:
              - name: X-API-Version
                value: "1.0"
            remove:
              - X-Debug-Header
        - type: ResponseHeaderModifier
          responseHeaderModifier:
            add:
              - name: X-Response-Version
                value: "1.0"
      backendRefs:
        - name: api-v1
          port: 80
\`\`\`

### decK CLI — Configuration Management

decK (declarative Configuration) is the official CLI to export, validate, diff, and sync Kong configurations.

\`\`\`bash
# Install decK
curl -sL https://github.com/Kong/deck/releases/latest/download/deck_linux_amd64.tar.gz | tar xz
sudo mv deck /usr/local/bin/

# Export current Kong configuration
deck gateway dump --output-file kong.yaml

# Validate a configuration file
deck gateway validate --state kong.yaml

# Compare current configuration vs file (dry-run)
deck gateway diff --state kong.yaml

# Apply configuration (sync)
deck gateway sync --state kong.yaml

# Render — expand environment variables in file
deck gateway render --state kong.yaml.j2
\`\`\`

\`\`\`yaml
# Example decK state file (kong.yaml)
_format_version: "3.0"
_transform: true

services:
  - name: my-api
    url: http://api-service.default.svc.cluster.local
    routes:
      - name: my-api-route
        paths:
          - /api
        strip_path: true
        methods:
          - GET
          - POST
    plugins:
      - name: rate-limiting
        config:
          minute: 100
          policy: local
\`\`\`

### KongUpstreamPolicy — Advanced Load Balancing

\`\`\`yaml
# Configure load balancing with active healthchecks
apiVersion: configuration.konghq.com/v1beta1
kind: KongUpstreamPolicy
metadata:
  name: my-upstream-policy
  namespace: default
spec:
  algorithm: least-connections    # round-robin | least-connections | consistent-hashing | random
  slots: 1000                     # Number of slots for consistent-hashing
  hashOn:                         # For consistent-hashing
    header: X-User-ID             # Hash based on header (sticky sessions)
  healthchecks:
    active:
      type: http
      httpPath: /health
      httpStatuses: [200, 204]
      interval: 10
      timeout: 3
      concurrency: 10
      healthy:
        successes: 3
      unhealthy:
        httpFailures: 3
        timeouts: 3
    passive:
      type: http
      healthy:
        successes: 5
      unhealthy:
        httpFailures: 5
        httpStatuses: [429, 500, 502, 503, 504]
\`\`\`

\`\`\`yaml
# Associate KongUpstreamPolicy with Service
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: default
  annotations:
    konghq.com/upstream-policy: my-upstream-policy  # Reference the policy
spec:
  selector:
    app: api
  ports:
    - port: 80
\`\`\`

### High Availability in Production

\`\`\`yaml
# HPA for Kong Proxy
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: kong-proxy-hpa
  namespace: kong
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: kong-proxy
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
\`\`\`

\`\`\`yaml
# PodDisruptionBudget — ensure availability during rolling updates
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: kong-pdb
  namespace: kong
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: kong-proxy
\`\`\`

### TLS Termination — HTTPS in Kong

\`\`\`yaml
# Ingress with TLS (cert-manager + Let's Encrypt)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tls-ingress
  namespace: default
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    konghq.com/protocols: "https"
    konghq.com/https-redirect-status-code: "301"
spec:
  ingressClassName: kong
  tls:
    - hosts:
        - api.example.com
      secretName: api-tls-cert    # cert-manager creates automatically
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 80
\`\`\`

### Common Production Errors

1. **Memory leak in Kong with many plugins** — Monitor memory via Prometheus; adjust resource limits in Kong Deployment
2. **Worker timeout on large uploads** — Increase proxy.read_timeout in KongIngress for upload routes
3. **DNS resolution fails for services** — Configure dns_resolver in Kong to correctly use kube-dns
4. **decK sync overwrites CRD configuration** — Don't mix decK with KIC in DBless mode; choose one approach
5. **Canary with wrong weight** — Weights in HTTPRoute are relative (90+10=100%), not absolute percentages; verify the sum

## Killer.sh Style Challenge

> **Scenario:** Configure a blue-green deployment for the main API using HTTPRoute with 50/50 traffic splitting initially. Add Prometheus metrics with ServiceMonitor, configure OpenTelemetry to send traces to Jaeger, and ensure HA with HPA (min 3, max 10 replicas) and PodDisruptionBudget (minAvailable 2).
`,
  quiz: [
    {
      question: 'How to implement canary deployment with 10% traffic to the new version using Gateway API in Kong?',
      options: [
        'Using annotation konghq.com/canary: "10%"',
        'Using HTTPRoute with two backendRefs: current version with weight: 90 and canary version with weight: 10',
        'Creating two separate Ingresses with nginx-split-client',
        'Canary is not natively supported in Kong'
      ],
      correct: 1,
      explanation: 'Gateway API supports native traffic splitting via HTTPRoute with multiple backendRefs and weights. Kong processes the weights automatically: weight: 90 and weight: 10 in two backendRefs in the same rule sends 90% to stable and 10% to canary. Weights are relative — the sum defines the proportions.',
      reference: 'Related concept: For gradual canary, automate weight adjustments with kubectl patch or ArgoCD Rollouts which integrates with Kong Gateway API.'
    },
    {
      question: 'What is the purpose of the decK CLI in Kong management?',
      options: [
        'It\'s a graphical interface for Kong',
        'It\'s the declarative CLI to export, validate, compare and sync Kong configurations — similar to "terraform plan/apply" for Kong',
        'It\'s used only to install Kong',
        'decK is a Kong plugin, not an external tool'
      ],
      correct: 1,
      explanation: 'decK (declarative Configuration) enables GitOps for Kong: deck gateway dump (export current state), deck gateway diff (compare file vs cluster — dry-run), deck gateway sync (apply configurations). Useful for DB-backed mode where you want to manage via versioned YAML files.',
      reference: 'Related concept: In DBless mode with KIC, don\'t use decK — configurations are already managed by Kubernetes CRDs. decK is for DB-backed mode.'
    },
    {
      question: 'How to configure sticky sessions (session affinity) in Kong?',
      options: [
        'Using annotation konghq.com/sticky: "true"',
        'Using KongUpstreamPolicy with algorithm: consistent-hashing and hashOn.header to hash a specific user header',
        'Sticky sessions are not supported in Kong',
        'Using the Kong session plugin'
      ],
      correct: 1,
      explanation: 'The consistent-hashing in KongUpstreamPolicy distributes requests from the same user to the same backend pod. By configuring hashOn.header: X-User-ID (or cookie, IP), requests with the same value always go to the same upstream. Useful for applications with server-side session state.',
      reference: 'Related concept: Combine consistent-hashing with active healthchecks to remove unhealthy pods from the pool without unnecessarily breaking sticky sessions.'
    },
    {
      question: 'What are the most important metrics from Kong\'s Prometheus plugin?',
      options: [
        'Only CPU and memory of the Kong pod',
        'kong_http_requests_total (requests per route/status), kong_latency_bucket (histogram), kong_upstream_target_health (backend health)',
        'Only total number of requests',
        'Disk and network metrics from the node'
      ],
      correct: 1,
      explanation: 'Kong\'s prometheus plugin exposes: kong_http_requests_total (with labels service, route, method, status — for error rate SLO), kong_latency_bucket (for P99/P95 latency SLO), and kong_upstream_target_health (for unhealthy backend alerts). These are the fundamental metrics for SRE work with Kong.',
      reference: 'Related concept: Create Grafana dashboards with this data for: error rate per service, P99 latency per route, and upstream availability.'
    },
    {
      question: 'How to ensure zero downtime during Kong updates in production?',
      options: [
        'Do the update outside business hours',
        'Configure HPA (min 2+ replicas), PodDisruptionBudget (minAvailable 1+), and use RollingUpdate strategy in the Kong Deployment',
        'Kong updates automatically without downtime',
        'Use only 1 replica with fast restart'
      ],
      correct: 1,
      explanation: 'For zero downtime: (1) HPA with minReplicas >= 2 ensures there\'s always a replica available; (2) PodDisruptionBudget prevents all pods from being evicted at the same time during node drain; (3) RollingUpdate ensures new pods are Ready before terminating old ones. All three measures together.',
      reference: 'Related concept: Add a preStop sleep hook in Kong pods to give time for the load balancer (cloud) to remove the pod from the pool before SIGTERM.'
    },
    {
      question: 'How to configure header-based routing with Gateway API in Kong?',
      options: [
        'Using annotation konghq.com/route-by-header',
        'Using HTTPRoute with rules[].matches[].headers specifying the header name and value to route to different backends',
        'Header-based routing is not supported by Kong',
        'Using KongIngress with header routing'
      ],
      correct: 1,
      explanation: 'HTTPRoute supports header matching: in rules[].matches[].headers specify name and value (or type: RegularExpression for regex). Requests with the matching header go to the backendRef for that rule. Useful for: routing by API version (X-API-Version: v2), A/B testing, and cookie-based blue-green.',
      reference: 'Related concept: Matching in HTTPRoute is processed in order — the first matching rule is used. Put more specific rules before more general ones.'
    },
    {
      question: 'What does the opentelemetry plugin do in Kong?',
      options: [
        'Only monitors Kong\'s internal performance',
        'Generates and propagates distributed traces (spans) for each request, sending to an OTLP collector — enables tracing a request through Kong and downstream microservices',
        'It\'s an alternative to the Prometheus plugin',
        'Collects only metrics, not traces'
      ],
      correct: 1,
      explanation: 'Kong\'s opentelemetry plugin creates a span for each request passing through the gateway, propagates the trace context via headers (W3C, B3, Jaeger), and sends traces via OTLP to a collector (Jaeger, Tempo, OTLP backend). Allows seeing Kong latency separately from downstream microservices.',
      reference: 'Related concept: Combine opentelemetry in Kong with OTEL SDK in microservices for end-to-end traces — from client to database, passing through the gateway.'
    }
  ],
  flashcards: [
    {
      front: 'Traffic splitting with HTTPRoute — weights and canary',
      back: '**50/50 Blue-Green:**\n\`\`\`yaml\nrules:\n  - matches:\n      - path:\n          type: PathPrefix\n          value: /api\n    backendRefs:\n      - name: api-blue\n        port: 80\n        weight: 50\n      - name: api-green\n        port: 80\n        weight: 50\n\`\`\`\n\n**90/10 Canary:**\n\`\`\`yaml\n    backendRefs:\n      - name: api-stable\n        port: 80\n        weight: 90\n      - name: api-canary\n        port: 80\n        weight: 10\n\`\`\`\n\n**Header-based (no weight):**\n\`\`\`yaml\n  - matches:\n      - headers:\n          - name: X-Version\n            value: canary\n    backendRefs:\n      - name: api-canary\n        port: 80\n\`\`\`\n\n**Weights are RELATIVE:**\n90+10=100 or 9+1=10 have the same effect\nThe total sum defines the proportions'
    },
    {
      front: 'decK CLI — essential commands',
      back: '**Installation:**\n\`\`\`bash\ncurl -sL https://github.com/Kong/deck/releases/latest/download/deck_linux_amd64.tar.gz | tar xz\nsudo mv deck /usr/local/bin/\n\`\`\`\n\n**GitOps flow:**\n\`\`\`bash\n# 1. Export current state\ndeck gateway dump -o kong.yaml\n\n# 2. Edit kong.yaml in Git\n\n# 3. Validate file\ndeck gateway validate --state kong.yaml\n\n# 4. View diff (dry-run)\ndeck gateway diff --state kong.yaml\n\n# 5. Apply changes\ndeck gateway sync --state kong.yaml\n\`\`\`\n\n**Useful flags:**\n`--select-tag`: filter resources by tag\n`--workspace`: specify workspace (Enterprise)\n`--kong-addr`: Admin API address\n\n**IMPORTANT:**\nDon\'t use decK with KIC in DBless mode!\nChoose: CRDs (DBless) OR decK (DB-backed)'
    },
    {
      front: 'Prometheus + Kong — metrics for SRE',
      back: '**Prometheus plugin (apply globally):**\n\`\`\`yaml\napiVersion: configuration.konghq.com/v1\nkind: KongClusterPlugin\nmetadata:\n  name: prometheus\n  annotations:\n    kubernetes.io/ingress.class: kong\nplugin: prometheus\nconfig:\n  status_code_metrics: true\n  latency_metrics: true\n\`\`\`\n\n**Essential SRE metrics:**\n\`\`\`promql\n# Error rate (SLO)\nrate(kong_http_requests_total{status=~"5.."}[5m]) /\nrate(kong_http_requests_total[5m])\n\n# P99 latency\nhistogram_quantile(0.99,\n  rate(kong_latency_bucket[5m]))\n\n# Unhealthy upstream\nkong_upstream_target_health{state="healthchecks_off"} == 0\n\`\`\`\n\n**ServiceMonitor (kube-prometheus-stack):**\nPort: metrics (8100 default)\nPath: /metrics\nInterval: 15s'
    },
    {
      front: 'KongUpstreamPolicy — load balancing algorithms',
      back: '**round-robin (default):**\n- Distributes equally among pods\n- Stateless\n- Ideal for: stateless services\n\n**least-connections:**\n- Sends to the pod with fewest active connections\n- Better for requests of varying durations\n- Ideal for: streaming, webhooks\n\n**consistent-hashing:**\n- Same hash (header/IP/cookie) → same pod\n- Sticky sessions without cookie\n- hashOn: header, consumer, ip, path, query_arg\n- Ideal for: per-user caches, sessions\n\n**random:**\n- Completely random\n- Useful for: chaos testing\n\n**Configuration:**\n\`\`\`yaml\nspec:\n  algorithm: consistent-hashing\n  hashOn:\n    header: X-User-ID\n  healthchecks:\n    active:\n      httpPath: /health\n      interval: 10\n\`\`\`'
    },
    {
      front: 'OpenTelemetry in Kong — configuration and propagation',
      back: '**OTel plugin:**\n\`\`\`yaml\nplugin: opentelemetry\nconfig:\n  endpoint: "http://otel-collector:4318/v1/traces"\n  resource_attributes:\n    service.name: "kong-gateway"\n  header_type: w3c    # b3|w3c|jaeger|ot|datadog\n  sampling_rate: 1.0  # 0.0-1.0\n\`\`\`\n\n**Propagation formats:**\n- `w3c` — W3C Trace Context (modern standard)\n- `b3` — Zipkin B3 (legacy but common)\n- `jaeger` — Jaeger proprietary\n- `datadog` — Datadog APM\n\n**Data generated per request:**\n- trace_id: unique trace ID\n- span_id: Kong span ID\n- duration: time in Kong\n- http.method, http.status_code\n- kong.service, kong.route\n\n**Suggested stack:**\nKong OTel → OTel Collector → Jaeger/Tempo\n+ Grafana for trace visualization'
    },
    {
      front: 'Kong High Availability — production checklist',
      back: '**Minimum 2 replicas:**\n\`\`\`yaml\nspec:\n  replicas: 2\n  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxUnavailable: 0   # Zero downtime\n      maxSurge: 1\n\`\`\`\n\n**HPA for scaling:**\n\`\`\`yaml\nminReplicas: 2\nmaxReplicas: 10\ntarget CPU: 70%\n\`\`\`\n\n**PodDisruptionBudget:**\n\`\`\`yaml\nspec:\n  minAvailable: 1  # Always 1 pod available\n\`\`\`\n\n**Resources (typical Kong proxy):**\n\`\`\`yaml\nresources:\n  requests:\n    cpu: 100m\n    memory: 256Mi\n  limits:\n    cpu: 1000m\n    memory: 512Mi\n\`\`\`\n\n**Affinity (multi-AZ):**\n\`\`\`yaml\ntopologySpreadConstraints:\n  - maxSkew: 1\n    topologyKey: topology.kubernetes.io/zone\n    whenUnsatisfiable: DoNotSchedule\n\`\`\`'
    }
  ],
  lab: {
    scenario: 'You need to configure full observability for Kong in production, including Prometheus metrics, advanced routing with traffic splitting, and ensure high availability.',
    objective: 'Learn to configure the Prometheus plugin, traffic splitting with HTTPRoute, KongUpstreamPolicy for healthchecks, and HPA for Kong.',
    duration: '30-35 minutes',
    steps: [
      {
        title: 'Configure Prometheus metrics in Kong',
        instruction: `Configure the Prometheus plugin in Kong:
1. Create a KongClusterPlugin prometheus applied globally
2. Verify that the /metrics endpoint is exposing data
3. Create a ServiceMonitor for Prometheus Operator to collect the metrics
4. Query basic metrics using kubectl port-forward`,
        hints: [
          'KongClusterPlugin with annotation kubernetes.io/ingress.class: kong applies globally',
          'Kong exposes metrics on port 8100 (or configurable via helm)',
          'Verify metrics without Prometheus: curl http://localhost:8100/metrics'
        ],
        solution: `\`\`\`yaml
# prometheus-plugin.yaml
apiVersion: configuration.konghq.com/v1
kind: KongClusterPlugin
metadata:
  name: prometheus
  annotations:
    kubernetes.io/ingress.class: kong
plugin: prometheus
config:
  status_code_metrics: true
  latency_metrics: true
  bandwidth_metrics: true
  upstream_health_metrics: true
\`\`\`

\`\`\`bash
kubectl apply -f prometheus-plugin.yaml
\`\`\`

\`\`\`yaml
# service-monitor.yaml (requires kube-prometheus-stack installed)
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kong-metrics
  namespace: kong
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: kong
  namespaceSelector:
    matchNames:
      - kong
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
\`\`\`

\`\`\`bash
# Apply (if kube-prometheus-stack is installed)
kubectl apply -f service-monitor.yaml 2>/dev/null || echo "ServiceMonitor CRD not available — normal without Prometheus Operator"
\`\`\``,
        verify: `\`\`\`bash
# Verify KongClusterPlugin
kubectl get kongclusterplugin prometheus
# Expected output: READY=True

# Make some requests to generate metrics
for i in 1 2 3 4 5; do
  curl -s http://localhost:8080/echo > /dev/null 2>&1 || true
done

# Check metrics endpoint (port 8100 in Kong pod)
KONG_PROXY_POD=\$(kubectl get pods -n kong -l app=kong-proxy -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || \\
  kubectl get pods -n kong -o name | grep proxy | head -1 | cut -d/ -f2)

kubectl port-forward pod/\$KONG_PROXY_POD 8100:8100 -n kong &
sleep 2

# View metrics
curl -s http://localhost:8100/metrics | grep -E "^kong_http|^kong_latency" | head -20
# Expected output: kong_http_requests_total, kong_latency_bucket metrics, etc.

# Request count
curl -s http://localhost:8100/metrics | grep "kong_http_requests_total" | head -5

# Close port-forward
kill %1 2>/dev/null || true
\`\`\``
      },
      {
        title: 'Configure traffic splitting with HTTPRoute',
        instruction: `Configure traffic splitting using Gateway API:
1. Create two Deployments and Services simulating "stable" and "canary" versions
2. Create GatewayClass and Gateway for Kong
3. Create HTTPRoute with weights 80/20 (stable/canary)
4. Verify that traffic is distributed approximately in the configured proportion`,
        hints: [
          'The two Services can have the same app but different labels (version: stable vs version: canary)',
          'Weights in HTTPRoute are relative — 80+20=100 or 8+2=10 have the same effect',
          'To verify the distribution, make many requests and count responses from each version'
        ],
        solution: `\`\`\`bash
# Create two deployments with different responses to identify the version
kubectl create deployment stable --image=nginx:alpine --replicas=1
kubectl expose deployment stable --port=80 --name=api-stable

kubectl create deployment canary --image=nginx:alpine --replicas=1
kubectl expose deployment canary --port=80 --name=api-canary
\`\`\`

\`\`\`yaml
# gateway.yaml — GatewayClass and Gateway for Kong
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: kong
  annotations:
    konghq.com/gatewayclass-unmanaged: "true"
spec:
  controllerName: konghq.com/kic-gateway-controller
---
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
\`\`\`

\`\`\`yaml
# httproute-split.yaml — Traffic splitting 80/20
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-split
  namespace: default
spec:
  parentRefs:
    - name: kong-gateway
      namespace: kong
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /split
      backendRefs:
        - name: api-stable
          port: 80
          weight: 80
        - name: api-canary
          port: 80
          weight: 20
\`\`\`

\`\`\`bash
kubectl apply -f gateway.yaml
kubectl apply -f httproute-split.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify Gateway and HTTPRoute
kubectl get gateway -n kong
# Expected output: kong-gateway Ready

kubectl get httproute -n default
# Expected output: api-split listed

# Make 20 requests to verify distribution (approximate)
STABLE=0
CANARY=0
for i in \$(seq 1 20); do
  RESPONSE=\$(curl -s http://localhost:8080/split 2>/dev/null || echo "error")
  if echo "\$RESPONSE" | grep -q "stable\\|Stable" 2>/dev/null; then
    STABLE=\$((STABLE+1))
  else
    CANARY=\$((CANARY+1))
  fi
done
echo "Stable: \$STABLE, Canary: \$CANARY"
# Expected output: approximately 16 stable and 4 canary (80/20)

# Verify HTTPRoute details
kubectl describe httproute api-split -n default | grep -A10 "Rules:"
# Expected output: backendRefs with stable (weight 80) and canary (weight 20)
\`\`\``
      },
      {
        title: 'Configure KongUpstreamPolicy with active healthchecks',
        instruction: `Configure active healthchecks on the upstream:
1. Create a KongUpstreamPolicy with active healthchecks on the /health route
2. Associate the policy with the Service via annotation
3. Simulate a backend failure to see healthchecks in action
4. Verify kong_upstream_target_health metrics via Prometheus`,
        hints: [
          'The konghq.com/upstream-policy annotation on the Service references the KongUpstreamPolicy by name',
          'Active healthchecks make periodic requests to the configured endpoint',
          'To simulate failure, scale the deployment to 0 replicas'
        ],
        solution: `\`\`\`yaml
# upstream-policy.yaml
apiVersion: configuration.konghq.com/v1beta1
kind: KongUpstreamPolicy
metadata:
  name: api-upstream-policy
  namespace: default
spec:
  algorithm: round-robin
  healthchecks:
    active:
      type: http
      httpPath: /
      httpStatuses: [200]
      interval: 5
      timeout: 2
      concurrency: 5
      healthy:
        successes: 2
      unhealthy:
        httpFailures: 2
        timeouts: 2
    passive:
      type: http
      healthy:
        successes: 3
      unhealthy:
        httpFailures: 3
        httpStatuses: [500, 502, 503, 504]
\`\`\`

\`\`\`bash
kubectl apply -f upstream-policy.yaml

# Associate policy with Service
kubectl annotate service api-stable \\
  konghq.com/upstream-policy=api-upstream-policy

# Verify policy was applied
kubectl describe service api-stable | grep "konghq.com"
\`\`\`

\`\`\`bash
# Simulate failure by scaling deployment to 0
kubectl scale deployment stable --replicas=0

# Wait for healthcheck to detect the failure
sleep 15

# View Kong logs to see healthcheck activity
kubectl logs -n kong -l app=kong-proxy --tail=20 | grep -i "health"
\`\`\``,
        verify: `\`\`\`bash
# Verify KongUpstreamPolicy
kubectl get kongupstreampolicy -n default 2>/dev/null || \\
  kubectl get kongupstreampolicies -n default 2>/dev/null || \\
  echo "CRD may vary by version — check kubectl api-resources | grep upstream"

# Verify annotation on Service
kubectl get service api-stable -o jsonpath='{.metadata.annotations}'
# Expected output: konghq.com/upstream-policy: api-upstream-policy

# Verify health metrics (if Prometheus active)
curl -s http://localhost:8100/metrics | grep "kong_upstream" | head -10
# Expected output: kong_upstream_target_health with different state after scale 0

# Restore the deployment
kubectl scale deployment stable --replicas=1
kubectl wait deployment/stable --for=condition=Available --timeout=60s

# Verify traffic is being received normally
curl -s http://localhost:8080/split
# Expected output: response from stable or canary normally
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'HTTPRoute with traffic splitting not distributing traffic correctly',
      difficulty: 'medium',
      symptom: 'The HTTPRoute has two backendRefs with different weights (90/10) but all traffic goes to a single backend. The expected distribution does not occur.',
      diagnosis: `\`\`\`bash
# 1. Check HTTPRoute status
kubectl get httproute <name> -n <namespace>
kubectl describe httproute <name> -n <namespace>

# 2. Check if GatewayClass and Gateway are correct
kubectl get gatewayclass
kubectl get gateway -n kong

# 3. Check if backend Services exist and have pods
kubectl get svc <stable-name> <canary-name> -n <namespace>
kubectl get pods -l app=<name> -n <namespace>

# 4. Check KIC logs for configuration errors
kubectl logs -n kong -l app=ingress-kong -c ingress-controller --tail=30

# 5. Confirm weights in backendRefs
kubectl get httproute <name> -o yaml | grep -A5 "backendRefs:"
\`\`\``,
      solution: `**Causes and solutions:**

1. **Kong version without Gateway API support:** Check if the Kong Ingress Controller version supports HTTPRoute with weights. Requires KIC >= 2.8 and Kong >= 3.0.

2. **GatewayClass not recognized:** The spec.controllerName field must be exactly \`konghq.com/kic-gateway-controller\`. Check with kubectl describe gatewayclass kong.

3. **Backend Service doesn't exist:** If one of the backendRefs references a non-existent Service, Kong may send everything to the valid Service or return an error. Verify both Services exist in the correct namespace.

4. **Both weights 0:** If both backendRefs have weight: 0, Kong uses the default. Check exact values with kubectl get httproute -o yaml.

5. **Kong cache:** Force controller resync:
\`\`\`bash
kubectl rollout restart deployment -n kong
\`\`\``
    },
    {
      title: 'Prometheus plugin not exposing metrics — endpoint returns 404',
      difficulty: 'easy',
      symptom: 'The KongClusterPlugin prometheus was applied but when accessing the Kong metrics port (usually 8100), the /metrics endpoint returns 404 or the connection is refused.',
      diagnosis: `\`\`\`bash
# 1. Check if KongClusterPlugin is Ready
kubectl get kongclusterplugin prometheus
kubectl describe kongclusterplugin prometheus

# 2. Check which port Kong uses for metrics
kubectl get svc -n kong
# Look for: port with name "metrics" or port 8100

# 3. Check if the metrics Service exists
kubectl get svc -n kong | grep -i metric

# 4. Test metrics port directly in the pod
KONG_POD=\$(kubectl get pods -n kong -l app=kong-proxy -o name | head -1)
kubectl exec \$KONG_POD -n kong -- curl -s localhost:8100/metrics | head -5

# 5. Check if plugin was applied globally
kubectl get kongclusterplugin -o yaml | grep -A3 "annotations:"
\`\`\``,
      solution: `**Causes and solutions:**

1. **Wrong metrics port:** The default port may vary depending on the Helm chart. Check with \`kubectl get svc -n kong\` and look for the "metrics" port. Could be 8100, 8001, or another.

2. **KongClusterPlugin without ingressClass annotation:** The KongClusterPlugin must have the annotation \`kubernetes.io/ingress.class: kong\` to be recognized by KIC. Without it, the plugin is ignored.

3. **Prometheus not enabled in Helm:** For the metrics endpoint to be available, Kong must be installed with Prometheus support. Check if the metrics Service exists.

4. **prometheus plugin vs native endpoint:** Kong has a native metrics endpoint (port 8001 in Admin mode) and the prometheus plugin adds additional metrics on the configured port. Check which is correct for the environment.

5. **Reinstall with metrics enabled:**
\`\`\`bash
helm upgrade kong kong/kong -n kong \\
  --set serviceMonitor.enabled=true \\
  --set serviceMonitor.labels.release=kube-prometheus-stack
\`\`\``
    }
  ]
};
