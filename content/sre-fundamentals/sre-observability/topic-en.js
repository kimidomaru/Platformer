window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['sre-fundamentals/sre-observability'] = {
  theory: `
# Observability Strategy — Metrics, Logs & Traces

## Relevance
Observability is the ability to understand the internal state of a system from its outputs. For SREs, it's the primary tool for detecting, diagnosing, and resolving problems. The three pillars — metrics, logs, and traces — complement each other and together provide complete visibility.

## Core Concepts

### The Three Pillars of Observability

\`\`\`
                    OBSERVABILITY
                    /      |      \\
               Metrics   Logs   Traces
               (What?)  (Why?)  (Where?)

  Metrics: numeric, aggregated, cheap -> detect
  Logs:    textual, detailed, voluminous -> diagnose
  Traces:  individual requests, distributed -> trace
\`\`\`

### Metrics

Numeric data aggregated over time. Ideal for alerts and dashboards.

**Metric types (Prometheus):**

| Type | Description | Example |
|------|-------------|---------|
| **Counter** | Value that only increases | \`http_requests_total\` |
| **Gauge** | Value that goes up and down | \`temperature_celsius\` |
| **Histogram** | Distribution of values in buckets | \`request_duration_seconds\` |
| **Summary** | Pre-calculated quantiles | \`request_duration_quantile\` |

**USE Method (for resources — CPU, memory, disk):**
\`\`\`
U — Utilization: % of resource in use
S — Saturation:  pending work queue
E — Errors:      error count
\`\`\`

**RED Method (for services — APIs, microservices):**
\`\`\`
R — Rate:     requests per second
E — Errors:   requests with errors
D — Duration: request latency
\`\`\`

**Four Golden Signals (Google SRE):**
\`\`\`
1. Latency:    response time (separate success from error)
2. Traffic:    requests per second
3. Errors:     rate of failed requests
4. Saturation: how "full" the service is
\`\`\`

### Logs

Textual records of individual events. Essential for debugging.

**Log levels (severity):**
\`\`\`
TRACE -> DEBUG -> INFO -> WARN -> ERROR -> FATAL
  |                      |              |
  Dev only             Normal      Requires action
\`\`\`

**Structured logging (recommended format):**
\`\`\`json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "level": "ERROR",
  "service": "payment-api",
  "trace_id": "abc123def456",
  "span_id": "789ghi",
  "message": "Payment processing failed",
  "error": "timeout connecting to stripe",
  "duration_ms": 5003,
  "user_id": "user-42",
  "amount": 99.99
}
\`\`\`

**Logging in Kubernetes:**
\`\`\`bash
# Pod logs
kubectl logs <pod-name> -n <namespace>

# Follow (stream)
kubectl logs -f <pod-name>

# Specific container in multi-container pod
kubectl logs <pod-name> -c <container-name>

# Previous logs (restarted pod)
kubectl logs <pod-name> --previous

# Last N minutes
kubectl logs <pod-name> --since=30m

# All pods of a Deployment
kubectl logs -l app=my-app -n production --all-containers
\`\`\`

**Logging stack in K8s:**
\`\`\`
Pods -> stdout/stderr
  -> Node (kubelet collects logs)
    -> Fluentd/Fluent Bit (DaemonSet)
      -> Elasticsearch/Loki
        -> Kibana/Grafana (visualization)
\`\`\`

### Distributed Tracing

Tracking an individual request through multiple services.

\`\`\`
User -> API Gateway -> Auth Service -> Payment Service -> Database
  |          |              |                |               |
  +---- trace_id: abc123 ---------------------------------------->|
             |              |                |
         span_id: 001  span_id: 002    span_id: 003
         parent: -     parent: 001     parent: 002
\`\`\`

**Key concepts:**
- **Trace**: complete path of a request
- **Span**: an individual operation within the trace
- **Context propagation**: headers carrying trace_id between services

**OpenTelemetry (CNCF standard):**
\`\`\`yaml
# OpenTelemetry Collector DaemonSet
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: otel-collector
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: otel-collector
  template:
    metadata:
      labels:
        app: otel-collector
    spec:
      containers:
        - name: collector
          image: otel/opentelemetry-collector:latest
          ports:
            - containerPort: 4317  # gRPC OTLP
            - containerPort: 4318  # HTTP OTLP
          volumeMounts:
            - name: config
              mountPath: /etc/otel
      volumes:
        - name: config
          configMap:
            name: otel-collector-config
\`\`\`

### Cross-Pillar Correlation

True observability connects metrics, logs, and traces:

\`\`\`
1. Metric alerts: "error rate > 5%"
   -> Dashboard shows error spike
2. Logs filtered by spike timestamp
   -> "timeout connecting to database"
3. Trace of a request with error
   -> Database span shows 5s latency
4. Root cause: connection pool exhausted
\`\`\`

**Exemplar (linking metric to trace):**
\`\`\`yaml
# Prometheus with exemplars
# Metric with trace reference
http_request_duration_seconds_bucket{le="0.5"} 12345 # {trace_id="abc123"}
\`\`\`

### Alerting Strategy

\`\`\`
Alert Level:
  Page (PagerDuty/phone):
    - Critical SLO burn rate
    - Service completely down
    - Data corruption

  Ticket (Jira/Slack):
    - Elevated SLO burn rate
    - Latency above p99
    - Disk > 85%

  Log/Dashboard:
    - Metrics outside baseline
    - Deprecation warnings
    - Anomalous patterns
\`\`\`

## Practical Implementation in Kubernetes

### Monitoring with kube-prometheus-stack

\`\`\`bash
# Install kube-prometheus-stack (Prometheus + Grafana + AlertManager)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack \\
  --namespace monitoring --create-namespace \\
  --set grafana.adminPassword=admin \\
  --set prometheus.prometheusSpec.retention=30d
\`\`\`

### Logging with Loki + Promtail

\`\`\`bash
# Install Loki stack
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki-stack \\
  --namespace monitoring \\
  --set promtail.enabled=true \\
  --set loki.persistence.enabled=true
\`\`\`

### ServiceMonitor for custom applications

\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app-monitor
  namespace: monitoring
  labels:
    release: monitoring
spec:
  namespaceSelector:
    matchNames:
      - production
  selector:
    matchLabels:
      app: my-app
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
\`\`\`

## Essential Commands

\`\`\`bash
# Metrics
kubectl top nodes
kubectl top pods -n production --sort-by=memory
kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes

# Logs
kubectl logs -f deployment/my-app -n production --all-containers
kubectl logs --since=1h -l app=my-app -n production | grep ERROR
kubectl logs <pod> --previous  # logs from previous container

# Events
kubectl get events -n production --sort-by='.lastTimestamp'
kubectl get events --field-selector type=Warning -n production

# Debug
kubectl describe pod <pod-name> -n production
kubectl exec -it <pod-name> -n production -- /bin/sh
kubectl debug node/<node-name> --image=busybox

# Prometheus
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090
kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80
\`\`\`

## Common Mistakes

1. **Alerting on infrastructure metrics instead of SLIs**: Alert on what the user feels, not CPU/memory.
2. **Unstructured logs**: Free-text logs are hard to search. Use structured logging (JSON).
3. **Not correlating logs with traces**: Without trace_id in logs, it's impossible to trace a request across services.
4. **Too many alerts**: Alert fatigue — the team ignores real alerts. Prioritize: page only for user impact.
5. **Monitor everything, understand nothing**: Collect metrics with purpose. USE for resources, RED for services.
6. **Insufficient log retention**: Retain at least 30 days. Incidents are often investigated days later.

## Killer.sh Style Challenge

**Scenario:** Configure a complete observability stack for a service in Kubernetes.

**Tasks:**
1. Install kube-prometheus-stack with Helm
2. Configure a ServiceMonitor for your application
3. Configure logging with Loki and correlate with metrics
4. Configure alerts based on the Four Golden Signals
5. Create a Grafana dashboard with USE and RED metrics
`,
  quiz: [
    {
      question: 'What are the three pillars of observability?',
      options: [
        'CPU, Memory, and Disk',
        'Alerts, Dashboards, and Runbooks',
        'Metrics, Logs, and Traces',
        'Prometheus, Grafana, and Loki'
      ],
      correct: 2,
      explanation: 'The three pillars of observability are Metrics (aggregated numeric data — "what is happening?"), Logs (detailed textual records — "why is it happening?"), and Traces (distributed request tracking — "where is it happening?"). Each pillar has strengths and weaknesses that complement each other.',
      reference: 'Related concept: sre-principles — SLIs are based on observability metrics.'
    },
    {
      question: 'What is the difference between USE Method and RED Method?',
      options: [
        'USE is for services, RED is for resources',
        'USE (Utilization/Saturation/Errors) is for infrastructure resources; RED (Rate/Errors/Duration) is for services and APIs',
        'USE is for logs, RED is for metrics',
        'There is no difference — they are the same thing'
      ],
      correct: 1,
      explanation: 'USE Method (Utilization, Saturation, Errors) was created by Brendan Gregg for analyzing infrastructure resources (CPU, memory, disk, network). RED Method (Rate, Errors, Duration) was created by Tom Wilkie for analyzing services and microservices. Use USE for infrastructure, RED for services.',
      reference: 'Related concept: sre-observability — the Four Golden Signals from Google SRE are similar to RED.'
    },
    {
      question: 'What are the Four Golden Signals from Google SRE?',
      options: [
        'CPU, Memory, Disk, Network',
        'Latency, Traffic, Errors, Saturation',
        'Uptime, Throughput, Errors, Cost',
        'Availability, Latency, Correctness, Freshness'
      ],
      correct: 1,
      explanation: 'The Four Golden Signals are: Latency (response time), Traffic (request volume), Errors (failure rate), and Saturation (how close to maximum capacity). They are the most important metrics for monitoring any service, according to Google\'s Site Reliability Engineering book.',
      reference: 'Related concept: sre-principles — SLIs usually map to the Golden Signals.'
    },
    {
      question: 'What is structured logging and why is it important?',
      options: [
        'Logs with pretty formatting for human reading',
        'Logs in a structured format (JSON) with standardized fields, enabling automated search, filtering, and correlation',
        'Logs organized in folders by date',
        'Encrypted logs for security'
      ],
      correct: 1,
      explanation: 'Structured logging uses a consistent format (typically JSON) with standardized fields like timestamp, level, service, trace_id, message. This enables indexed search (vs grep on free text), automatic correlation with traces (via trace_id), and aggregation/analysis in tools like Elasticsearch or Loki.',
      reference: 'Related concept: sre-observability — include trace_id in logs to correlate with distributed traces.'
    },
    {
      question: 'What is Context Propagation in distributed tracing?',
      options: [
        'Sending logs from one service to another',
        'Propagating headers (like traceparent) between services to maintain trace_id and span_id throughout the entire call chain',
        'Copying metrics between clusters',
        'Syncing dashboards between environments'
      ],
      correct: 1,
      explanation: 'Context propagation is the mechanism by which trace_id and span_id are passed from service to service via HTTP headers (e.g., traceparent, b3) or gRPC metadata. Without context propagation, each service would create isolated traces and it would be impossible to correlate a request end-to-end.',
      reference: 'Related concept: sre-observability — OpenTelemetry is the CNCF standard for context propagation.'
    },
    {
      question: 'What is the role of Prometheus Exemplars in observability?',
      options: [
        'It is a type of Prometheus alert',
        'It is a visualization tool',
        'Links metrics to specific traces, allowing you to go from an aggregated metric to an individual trace for investigation',
        'It is a custom Prometheus exporter'
      ],
      correct: 2,
      explanation: 'Exemplars allow attaching a trace_id to a metric data point. When you see a spike on the dashboard, you can click and go directly to the trace of the request that caused the spike. This connects the pillars: metric (detects) -> trace (investigates) -> logs (details).',
      reference: 'Related concept: sre-observability — Grafana supports exemplar drill-down to Tempo/Jaeger.'
    },
    {
      question: 'At what level should you page an on-call team?',
      options: [
        'For any metric that goes outside baseline',
        'Only when there is direct user impact or risk of SLO violation (critical burn rate, service down)',
        'For every warning in the log',
        'For any increase in latency'
      ],
      correct: 1,
      explanation: 'Pages (alerts that wake people up) should be reserved for situations with real user impact: critical SLO burn rate, service completely down, data loss. Metrics outside baseline should generate tickets or dashboard entries, not pages. Alert fatigue (too many alerts) leads the team to ignore genuine alerts.',
      reference: 'Related concept: sre-oncall — alerting strategy is a critical part of on-call practice.'
    }
  ],
  flashcards: [
    {
      front: 'Three pillars of observability?',
      back: '**1. Metrics:**\n- Aggregated numeric data\n- Cheap to store\n- Ideal for alerts and dashboards\n- Tools: Prometheus, Datadog\n\n**2. Logs:**\n- Detailed textual records\n- Voluminous and expensive\n- Essential for debugging\n- Tools: Loki, Elasticsearch\n\n**3. Traces:**\n- Individual distributed requests\n- Show latency per service\n- Essential for microservices\n- Tools: Jaeger, Tempo, Zipkin\n\n**Connection:** metric detects, trace locates, log explains'
    },
    {
      front: 'USE vs RED vs Four Golden Signals?',
      back: '**USE Method (resources):**\n- Utilization: % in use\n- Saturation: pending queue\n- Errors: error count\n-> For: CPU, memory, disk, network\n\n**RED Method (services):**\n- Rate: req/second\n- Errors: req with errors\n- Duration: latency\n-> For: APIs, microservices\n\n**Four Golden Signals (Google):**\n- Latency\n- Traffic\n- Errors\n- Saturation\n-> Universal baseline for any service\n\n**When to use:**\nUSE for infra, RED for services'
    },
    {
      front: 'Structured logging — format and benefits?',
      back: '**Format (JSON):**\n```json\n{\n  "timestamp": "2025-01-15T10:30:00Z",\n  "level": "ERROR",\n  "service": "payment-api",\n  "trace_id": "abc123",\n  "message": "Payment failed",\n  "error": "timeout",\n  "duration_ms": 5003\n}\n```\n\n**Benefits:**\n- Indexed search (vs grep)\n- Field filtering\n- Trace correlation (trace_id)\n- Automatic aggregation\n- Programmatic parsing\n\n**Essential fields:**\ntimestamp, level, service, trace_id,\nmessage, error (if applicable)'
    },
    {
      front: 'Distributed tracing — key concepts?',
      back: '**Trace:** complete path of a request\nthrough all services\n\n**Span:** individual operation within the trace\n- Has: span_id, parent_span_id, duration\n- Root: span without parent\n\n**Context propagation:** HTTP headers\nthat carry trace_id between services\n- W3C: traceparent header\n- B3: X-B3-TraceId header\n\n**OpenTelemetry:** CNCF standard\n- Unifies metrics + logs + traces\n- SDK for instrumentation\n- Collector for processing\n- OTLP: transport protocol\n\n**Tools:** Jaeger, Tempo, Zipkin'
    },
    {
      front: 'Observability stack in Kubernetes?',
      back: '**Metrics:**\n- Prometheus (collection)\n- Grafana (visualization)\n- kube-prometheus-stack (Helm)\n- ServiceMonitor for apps\n\n**Logs:**\n- Fluent Bit/Fluentd (collection)\n- Loki (storage)\n- Grafana (visualization)\n- DaemonSet on each node\n\n**Traces:**\n- OpenTelemetry (instrumentation)\n- Jaeger or Tempo (storage)\n- Grafana (visualization)\n- Sidecar or DaemonSet\n\n**All together:**\nGrafana as single pane of glass\n-> correlated metrics + logs + traces'
    },
    {
      front: 'Alerting strategy — when to alert?',
      back: '**Page (wakes person up):**\n- Critical SLO burn rate (14.4x)\n- Service completely down\n- Imminent data loss\n- Security compromised\n\n**Ticket (next business day):**\n- Elevated burn rate (6x)\n- Latency above p99\n- Disk > 85%\n- Certificate expiring < 7d\n\n**Dashboard/Log (informational):**\n- Metrics outside baseline\n- Deprecation warnings\n- Anomalous patterns\n\n**Golden rule:**\nIf the alert requires no action,\nit should not be a page.\nEvery page must have a runbook.'
    },
    {
      front: 'Essential observability commands in K8s?',
      back: '**Metrics:**\n```bash\nkubectl top nodes\nkubectl top pods --sort-by=memory\n```\n\n**Logs:**\n```bash\nkubectl logs -f deploy/app\nkubectl logs --since=1h -l app=x\nkubectl logs <pod> --previous\nkubectl logs <pod> -c <container>\n```\n\n**Events:**\n```bash\nkubectl get events --sort-by=.lastTimestamp\nkubectl get events --field-selector type=Warning\n```\n\n**Debug:**\n```bash\nkubectl describe pod <pod>\nkubectl exec -it <pod> -- /bin/sh\nkubectl debug node/<node> --image=busybox\n```'
    }
  ],
  lab: {
    scenario: 'You need to configure complete observability for a service in Kubernetes: metrics with Prometheus, structured logs, and alerts based on the Four Golden Signals.',
    objective: 'Install and configure an observability stack with ServiceMonitor, alerts, and logging.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Configure ServiceMonitor',
        instruction: `Create a ServiceMonitor so Prometheus collects metrics from your application.

\`\`\`bash
# First, create a Service with the label and metrics port
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: my-app-metrics
  namespace: production
  labels:
    app: my-app
spec:
  selector:
    app: my-app
  ports:
    - name: metrics
      port: 8080
      targetPort: 8080
---
# ServiceMonitor for Prometheus Operator
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app-monitor
  namespace: monitoring
  labels:
    release: monitoring
spec:
  namespaceSelector:
    matchNames:
      - production
  selector:
    matchLabels:
      app: my-app
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
EOF
\`\`\``,
        hints: [
          'The label release: monitoring must match the Prometheus Operator selector',
          'namespaceSelector allows monitoring services in other namespaces',
          'The ServiceMonitor port must match the Service port name'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app-monitor
  namespace: monitoring
  labels:
    release: monitoring
spec:
  namespaceSelector:
    matchNames: [production]
  selector:
    matchLabels:
      app: my-app
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify ServiceMonitor created
kubectl get servicemonitor my-app-monitor -n monitoring
# Expected output: NAME               AGE
#                   my-app-monitor     Xs

# Verify Prometheus detected the target
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090 &
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="my-app-metrics")' | head -5
# Expected output: active target or empty if app is not running
\`\`\``
      },
      {
        title: 'Create Four Golden Signals Alerts',
        instruction: `Configure alerts based on the Google SRE Four Golden Signals.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: golden-signals-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: golden-signals
      rules:
        # 1. LATENCY: p99 > 1 second
        - alert: HighLatency
          expr: |
            histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{job="my-app"}[5m])) by (le))
            > 1.0
          for: 5m
          labels:
            severity: warning
            signal: latency
          annotations:
            summary: "P99 latency above 1 second"

        # 2. TRAFFIC: sudden traffic drop (< 50% of normal)
        - alert: TrafficDrop
          expr: |
            sum(rate(http_requests_total{job="my-app"}[5m]))
            < 0.5 * sum(rate(http_requests_total{job="my-app"}[1h] offset 1d))
          for: 10m
          labels:
            severity: warning
            signal: traffic
          annotations:
            summary: "Traffic dropped to less than 50% of yesterday"

        # 3. ERRORS: error rate > 5%
        - alert: HighErrorRate
          expr: |
            sum(rate(http_requests_total{job="my-app",code=~"5.."}[5m]))
            / sum(rate(http_requests_total{job="my-app"}[5m]))
            > 0.05
          for: 5m
          labels:
            severity: critical
            signal: errors
          annotations:
            summary: "Error rate above 5%"

        # 4. SATURATION: memory > 90%
        - alert: HighSaturation
          expr: |
            container_memory_working_set_bytes{container="my-app"}
            / container_spec_memory_limit_bytes{container="my-app"}
            > 0.9
          for: 5m
          labels:
            severity: warning
            signal: saturation
          annotations:
            summary: "Memory usage above 90% of limit"
EOF
\`\`\``,
        hints: [
          'The Four Golden Signals cover: Latency, Traffic, Errors, Saturation',
          'Use histogram_quantile to calculate latency percentiles',
          'Compare current traffic with historical data to detect drops'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: golden-signals-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: golden-signals
      rules:
        - alert: HighErrorRate
          expr: |
            sum(rate(http_requests_total{code=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m])) > 0.05
          for: 5m
          labels:
            severity: critical
        - alert: HighLatency
          expr: |
            histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 1.0
          for: 5m
          labels:
            severity: warning
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify PrometheusRule created
kubectl get prometheusrule golden-signals-alerts -n monitoring
# Expected output: NAME                      AGE
#                   golden-signals-alerts     Xs

# Verify defined alerts
kubectl get prometheusrule golden-signals-alerts -n monitoring -o jsonpath='{.spec.groups[0].rules[*].alert}'
# Expected output: HighLatency TrafficDrop HighErrorRate HighSaturation
\`\`\``
      },
      {
        title: 'Configure Log Aggregation with Loki',
        instruction: `Configure Loki to collect and aggregate pod logs.

\`\`\`bash
# Install Loki + Promtail via Helm (if not installed)
helm repo add grafana https://grafana.github.io/helm-charts
helm upgrade --install loki grafana/loki-stack \\
  --namespace monitoring \\
  --set promtail.enabled=true \\
  --set loki.persistence.enabled=false

# Verify Promtail DaemonSet is running
kubectl get daemonset -n monitoring | grep promtail

# Test LogQL query via API
kubectl port-forward svc/loki -n monitoring 3100:3100 &
curl -s 'http://localhost:3100/loki/api/v1/query?query={namespace="production"}' | jq '.data.result | length'
\`\`\``,
        hints: [
          'Promtail runs as a DaemonSet on each node to collect logs',
          'Loki indexes only labels, not log content',
          'LogQL is Loki query language (similar to PromQL)'
        ],
        solution: `\`\`\`bash
helm upgrade --install loki grafana/loki-stack --namespace monitoring --set promtail.enabled=true
\`\`\``,
        verify: `\`\`\`bash
# Verify Loki running
kubectl get pods -n monitoring -l app=loki
# Expected output: pod Running

# Verify Promtail DaemonSet
kubectl get daemonset -n monitoring -l app=promtail
# Expected output: DESIRED   CURRENT   READY
#                   N         N         N

# Verify Loki is responding
kubectl exec -n monitoring deploy/loki -- wget -qO- http://localhost:3100/ready
# Expected output: ready
\`\`\``
      },
      {
        title: 'Verify Metrics-Logs Correlation',
        instruction: `Verify that metrics and logs are correlated in Grafana.

\`\`\`bash
# Port-forward Grafana
kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80 &

# Add Loki as data source in Grafana (via API)
curl -X POST http://admin:admin@localhost:3000/api/datasources \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Loki",
    "type": "loki",
    "url": "http://loki:3100",
    "access": "proxy"
  }'

# Test LogQL query
curl -s 'http://localhost:3100/loki/api/v1/query?query={namespace="production",app="my-app"} |= "ERROR"' | jq '.data.result | length'

# Verify Prometheus has metrics for the same service
curl -s 'http://localhost:9090/api/v1/query?query=up{job="my-app"}' | jq '.data.result'
\`\`\``,
        hints: [
          'Grafana allows split view: metrics above, logs below',
          'Use consistent labels (app, namespace) between metrics and logs',
          'LogQL |= "ERROR" filters lines containing "ERROR"'
        ],
        solution: `\`\`\`bash
curl -X POST http://admin:admin@localhost:3000/api/datasources -H 'Content-Type: application/json' -d '{"name":"Loki","type":"loki","url":"http://loki:3100","access":"proxy"}'
\`\`\``,
        verify: `\`\`\`bash
# Verify data sources in Grafana
curl -s http://admin:admin@localhost:3000/api/datasources | jq '.[].name'
# Expected output: should list "Prometheus" and "Loki"

# Verify Grafana access
curl -s -o /dev/null -w "%{http_code}" http://admin:admin@localhost:3000/api/health
# Expected output: 200
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ServiceMonitor created but Prometheus not collecting metrics',
      difficulty: 'medium',
      symptom: 'The ServiceMonitor was created but the target does not appear in Prometheus. The /targets page shows the service was not discovered.',
      diagnosis: `\`\`\`bash
# Check ServiceMonitor labels
kubectl get servicemonitor my-app-monitor -n monitoring -o yaml | head -15

# Check Prometheus selector
kubectl get prometheus -n monitoring -o jsonpath='{.items[0].spec.serviceMonitorSelector}'

# Check if Service exists with correct labels
kubectl get svc -n production -l app=my-app

# Check if metrics endpoint responds
kubectl port-forward svc/my-app -n production 8080:8080 &
curl http://localhost:8080/metrics | head -5
\`\`\``,
      solution: `**Common causes:**

1. **Label mismatch:** The Prometheus Operator uses \`serviceMonitorSelector\` to discover ServiceMonitors. If the label doesn't match, the ServiceMonitor is ignored:
\`\`\`bash
# See which label Prometheus expects
kubectl get prometheus -n monitoring -o jsonpath='{.items[0].spec.serviceMonitorSelector.matchLabels}'
# Add the correct label to the ServiceMonitor
\`\`\`

2. **Namespace not allowed:** If \`serviceMonitorNamespaceSelector\` is configured, Prometheus only discovers ServiceMonitors in certain namespaces.

3. **Wrong port:** The port name in ServiceMonitor must match the port name in Service.

4. **App not exposing /metrics:** The endpoint must return metrics in Prometheus format.`
    },
    {
      title: 'Logs not appearing in Loki/Grafana',
      difficulty: 'easy',
      symptom: 'Pods are generating logs (kubectl logs shows output) but they do not appear in LogQL queries in Grafana.',
      diagnosis: `\`\`\`bash
# Check if Promtail is running on all nodes
kubectl get daemonset -n monitoring -l app=promtail

# Check Promtail logs
kubectl logs -n monitoring -l app=promtail --tail=20

# Check if Loki is receiving logs
kubectl exec -n monitoring deploy/loki -- wget -qO- 'http://localhost:3100/loki/api/v1/query?query={namespace="production"}' 2>/dev/null | head -5

# Check Promtail configuration
kubectl get cm -n monitoring -l app=promtail -o yaml | grep -A5 "scrape_configs"
\`\`\``,
      solution: `**Common causes:**

1. **Promtail not running on all nodes:** Check the DaemonSet:
\`\`\`bash
kubectl get ds -n monitoring -l app=promtail
# DESIRED should equal READY
\`\`\`

2. **Namespace not configured in Promtail:** Promtail may be filtered to collect from only certain namespaces.

3. **Loki data source not configured in Grafana:** Verify Loki is a data source:
\`\`\`bash
curl -s http://admin:admin@localhost:3000/api/datasources | jq '.[].name'
\`\`\`

4. **Loki out of space/limits:** If Loki reached ingestion or storage limits, new logs are dropped.`
    },
    {
      title: 'Alert fatigue — too many false positive alerts',
      difficulty: 'hard',
      symptom: 'The team receives dozens of alerts per day, most of which are false positives. The team started ignoring alerts and a real incident went unnoticed.',
      diagnosis: `\`\`\`bash
# Check active alerts
kubectl port-forward svc/monitoring-kube-prometheus-alertmanager -n monitoring 9093:9093 &
curl -s http://localhost:9093/api/v2/alerts | jq '.[].labels.alertname' | sort | uniq -c | sort -rn

# Check alert history in Prometheus
curl -s 'http://localhost:9090/api/v1/query?query=ALERTS{alertstate="firing"}' | jq '.data.result | length'

# Check active silences
curl -s http://localhost:9093/api/v2/silences | jq '.[].comment'
\`\`\``,
      solution: `**Reduction strategy:**

1. **Classify existing alerts:**
   - Page: requires immediate action (SLO impact)
   - Ticket: requires action on next business day
   - Informational: dashboard only (not an alert)

2. **Eliminate alerts without actions:** Every alert should have a runbook. If no action is possible, it should not be an alert.

3. **Increase thresholds and duration:**
\`\`\`yaml
# Before (too sensitive):
- alert: HighCPU
  expr: cpu_usage > 70
  for: 1m

# After (realistic):
- alert: HighCPU
  expr: cpu_usage > 90
  for: 15m
\`\`\`

4. **Migrate to SLO-based alerting:** Instead of alerting on individual symptoms, alert on error budget burn rate. A single burn rate alert replaces dozens of symptom alerts.

5. **Monthly review:** Review all alerts monthly. If an alert didn't generate action in 30 days, consider removing it.`
    }
  ]
};
