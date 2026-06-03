window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcna-observability/observability-fundamentals'] = {
  theory: `# Observability Fundamentals

## Exam Relevance
> Observability is tested in KCNA (~8% Observability in Cloud Native). You need to understand the three pillars (metrics, logs, traces), key tools (Prometheus, Grafana, Jaeger, OpenTelemetry), and how they apply to Kubernetes.

## The Three Pillars of Observability

### 1. Metrics
Numerical measurements over time. Answer: **"How much? How many? How fast?"**

- CPU usage, memory consumption, request rate, error rate, latency
- Time-series data: (timestamp, value) pairs
- Aggregatable: average, sum, percentile (p99 latency)

**Kubernetes tools**: Metrics Server (real-time), Prometheus (long-term), kube-state-metrics

### 2. Logs
Event records from applications and systems. Answer: **"What happened?"**

- Structured (JSON) or unstructured (free-text)
- Appended over time (immutable history)
- High cardinality (one per event)

**Kubernetes tools**: kubectl logs, Fluentd, Fluent Bit → Elasticsearch/Loki → Kibana/Grafana

### 3. Distributed Traces
Follow a request as it flows through multiple services. Answer: **"Where did time go?"**

- Each request generates a trace with spans (segments of work)
- Identifies bottlenecks: which service is slow?
- Requires instrumentation in the application

**Kubernetes tools**: Jaeger, Zipkin, Tempo, OpenTelemetry

## The Observability Stack

\`\`\`
Application
   ↓ (generates)
Metrics → Prometheus → Grafana (dashboards + alerts)
Logs    → Fluentd/Fluent Bit → Loki/Elasticsearch → Grafana/Kibana
Traces  → OpenTelemetry → Jaeger/Tempo → Grafana
\`\`\`

## Prometheus

**Prometheus** (CNCF Graduated) is the standard for Kubernetes metrics:

- **Pull model**: Prometheus scrapes /metrics endpoints on a schedule
- Stores time-series data with labels (key=value)
- **PromQL**: query language for aggregations and alert conditions
- **AlertManager**: routes alerts to Slack, PagerDuty, email

\`\`\`promql
# PromQL examples
rate(http_requests_total[5m])              # Request rate over 5 min
container_memory_usage_bytes{pod="mypod"} # Memory for specific pod
avg(cpu_usage_percent) by (namespace)      # Avg CPU per namespace
\`\`\`

### kube-state-metrics
Exposes Kubernetes object state as Prometheus metrics:
- Deployment readiness (kube_deployment_status_replicas_ready)
- Pod status (kube_pod_status_phase)
- Node conditions (kube_node_status_condition)

### node-exporter
Exposes hardware/OS metrics:
- CPU, memory, disk I/O, network per node
- Runs as a DaemonSet

## Logging Architecture

\`\`\`
Container (stdout/stderr)
    ↓
kubelet writes to /var/log/containers/ on node
    ↓
DaemonSet log collector (Fluentd/Fluent Bit)
    ↓
Log aggregation (Elasticsearch, Loki, CloudWatch)
    ↓
Visualization (Kibana, Grafana)
\`\`\`

**Key principle**: Applications should log to stdout/stderr — Kubernetes captures this automatically.

## OpenTelemetry

OpenTelemetry (CNCF Incubating) is a unified observability framework:
- Single SDK for metrics, logs, and traces
- Vendor-neutral (works with Jaeger, Prometheus, Datadog, etc.)
- Auto-instrumentation for many languages

\`\`\`
App → OpenTelemetry SDK → OTEL Collector → Backend (Jaeger, Prometheus)
\`\`\`

## RED and USE Methods

Two popular approaches to what to measure:

**RED** (for services/microservices):
- **Rate**: requests per second
- **Errors**: error rate percentage
- **Duration**: request latency (p50, p95, p99)

**USE** (for infrastructure/resources):
- **Utilization**: % of time resource is busy
- **Saturation**: how much work is queued
- **Errors**: error events

## SLI, SLO, SLA

| Term | Definition | Example |
|------|-----------|---------|
| **SLI** (Service Level Indicator) | A metric that measures service quality | 99th percentile latency = 200ms |
| **SLO** (Service Level Objective) | Target value for an SLI | p99 latency < 500ms for 99.9% of requests |
| **SLA** (Service Level Agreement) | Legal contract with penalties for SLO violations | 99.95% uptime or credits issued |

## Kubernetes-Specific Metrics

\`\`\`bash
# Available via Metrics Server (kubectl top)
kubectl top nodes                  # Node CPU/memory
kubectl top pods                   # Pod CPU/memory
kubectl top pods --containers      # Per-container breakdown

# Kubernetes events as observability
kubectl get events --sort-by='.lastTimestamp'
kubectl get events --field-selector type=Warning
\`\`\`
`,
  quiz: [
    {
      question: 'What are the three pillars of observability?',
      options: [
        'CPU, Memory, Disk',
        'Metrics (measurements over time), Logs (event records), Traces (request flows across services)',
        'Prometheus, Grafana, Jaeger',
        'Monitoring, Alerting, Dashboards'
      ],
      correct: 1,
      explanation: 'The three pillars: Metrics (what is happening quantitatively), Logs (what happened in detail), Traces (how a request flows through multiple services). Each answers a different question.',
      reference: 'The Three Pillars of Observability section in theory.'
    },
    {
      question: 'How does Prometheus collect metrics — push or pull model?',
      options: [
        'Push model — applications send metrics to Prometheus',
        'Pull model — Prometheus scrapes /metrics endpoints on a schedule',
        'Event-driven — metrics are sent when values change',
        'Streaming model — continuous real-time feed'
      ],
      correct: 1,
      explanation: 'Prometheus uses a pull model: it scrapes configured /metrics endpoints at regular intervals (default 15 seconds). Applications expose their metrics at a /metrics HTTP endpoint. This simplifies architecture — no need to configure each app with the Prometheus endpoint.',
      reference: 'Prometheus section in theory.'
    },
    {
      question: 'What is distributed tracing used for?',
      options: [
        'Tracking file changes across cluster nodes',
        'Following a request as it flows through multiple microservices to identify latency and bottlenecks',
        'Monitoring container disk usage',
        'Tracing network packets through iptables rules'
      ],
      correct: 1,
      explanation: 'Distributed tracing follows a single request through multiple services, showing how long each service takes. It answers "where did time go?" — essential for diagnosing latency in microservice architectures.',
      reference: 'Distributed Traces section in theory.'
    },
    {
      question: 'What is the RED method for service observability?',
      options: [
        'Reliability, Efficiency, Durability',
        'Rate (requests/sec), Errors (error rate), Duration (latency)',
        'Resources, Events, Dashboards',
        'Running, Erroring, Degraded (service states)'
      ],
      correct: 1,
      explanation: 'RED is a framework for what to monitor in services/microservices: Rate (how many requests), Errors (how many are failing), Duration (how long they take). These three metrics together give a complete service health picture.',
      reference: 'RED and USE Methods section in theory.'
    },
    {
      question: 'What is kube-state-metrics?',
      options: [
        'A Kubernetes built-in tool for monitoring nodes',
        'A service that exposes Kubernetes object state (deployments, pods, nodes) as Prometheus metrics',
        'The metrics endpoint built into the kube-apiserver',
        'A replacement for kubectl top'
      ],
      correct: 1,
      explanation: 'kube-state-metrics queries the Kubernetes API and exposes object state as Prometheus metrics: deployment replica counts, pod phase, node conditions, etc. Distinct from Metrics Server (which provides resource usage) and node-exporter (hardware metrics).',
      reference: 'Prometheus — kube-state-metrics section in theory.'
    },
    {
      question: 'Where should containerized applications write their logs?',
      options: [
        'To files in /var/log/ inside the container',
        'To a syslog server in the cluster',
        'To stdout and stderr — Kubernetes captures and routes these automatically',
        'To a database for permanent storage'
      ],
      correct: 2,
      explanation: 'The twelve-factor app principle: applications should write logs to stdout/stderr as an event stream. Kubernetes captures these via the container runtime and stores them on the node. kubectl logs reads these captured logs.',
      reference: 'Logging Architecture section in theory.'
    },
    {
      question: 'What is the difference between SLI, SLO, and SLA?',
      options: [
        'They are synonyms for different team perspectives on the same metric',
        'SLI is the metric, SLO is the target for that metric, SLA is the legal contract with penalties',
        'SLI is for developers, SLO is for ops, SLA is for management',
        'SLO is stricter than SLA; SLA is stricter than SLI'
      ],
      correct: 1,
      explanation: 'SLI: the actual measurement (e.g., latency = 200ms). SLO: the objective/target (e.g., p99 latency < 500ms). SLA: the binding legal contract with customers that includes penalties if the SLO is violated.',
      reference: 'SLI, SLO, SLA table in theory.'
    },
    {
      question: 'What is OpenTelemetry?',
      options: [
        'A Prometheus replacement for Kubernetes metrics',
        'A CNCF project providing a unified, vendor-neutral SDK for metrics, logs, and traces',
        'A Kubernetes add-on for log aggregation',
        'A commercial observability platform'
      ],
      correct: 1,
      explanation: 'OpenTelemetry (CNCF Incubating) is a unified framework for all three observability pillars. One SDK generates metrics, logs, and traces. It is vendor-neutral — works with Prometheus, Jaeger, Datadog, New Relic, etc.',
      reference: 'OpenTelemetry section in theory.'
    }
  ],
  flashcards: [
    {
      front: 'What are the three pillars of observability and what does each answer?',
      back: 'Metrics: "How much/many/fast?" — quantitative measurements over time\n→ CPU usage, error rate, request latency\n→ Tools: Prometheus, Metrics Server\n\nLogs: "What happened?" — event records from apps/systems\n→ Error messages, audit trails, access logs\n→ Tools: Fluentd, Loki, Elasticsearch\n\nTraces: "Where did time go?" — request flows across services\n→ Latency breakdown per microservice\n→ Tools: Jaeger, Zipkin, OpenTelemetry'
    },
    {
      front: 'How does Prometheus work? What is its collection model?',
      back: 'PULL model: Prometheus scrapes /metrics endpoints on schedule (default 15s)\n\nComponents:\n- Prometheus server: scraper + time-series DB\n- AlertManager: routing alerts to Slack/PagerDuty/email\n- Grafana: visualization dashboards\n- node-exporter: hardware/OS metrics\n- kube-state-metrics: K8s object state metrics\n\nQueried with PromQL (powerful query language).'
    },
    {
      front: 'What are the RED and USE metrics methods?',
      back: 'RED (for services/microservices):\nR = Rate (requests/second)\nE = Errors (error rate %)\nD = Duration (latency p50/p95/p99)\n\nUSE (for infrastructure/resources):\nU = Utilization (% busy)\nS = Saturation (queue depth)\nE = Errors (error count)\n\nRED focuses on the user experience; USE focuses on resource health.'
    },
    {
      front: 'What is the logging architecture in Kubernetes?',
      back: 'App writes to stdout/stderr\n    ↓\nkubelet writes to node /var/log/containers/\n    ↓\nDaemonSet collector (Fluentd/Fluent Bit) on each node\n    ↓\nLog aggregator (Elasticsearch, Loki, CloudWatch)\n    ↓\nVisualization (Kibana, Grafana)\n\nKey: apps MUST write to stdout/stderr for kubectl logs to work.'
    },
    {
      front: 'What is OpenTelemetry and why is it important?',
      back: 'CNCF Incubating project providing a UNIFIED, VENDOR-NEUTRAL observability framework.\n\nBefore: different SDKs for each backend (Prometheus SDK, Jaeger SDK)\nWith OTel: one SDK → any backend\n\nCovers all 3 pillars: metrics + logs + traces\nAuto-instrumentation for Java, Python, Node.js, Go\nCollector: receives, processes, exports to any backend'
    },
    {
      front: 'What is the difference between SLI, SLO, and SLA?',
      back: 'SLI (Service Level Indicator): the actual metric being measured\n→ "99th percentile latency = 180ms"\n\nSLO (Service Level Objective): target value for the SLI\n→ "p99 latency < 500ms, 99.9% of the time"\n\nSLA (Service Level Agreement): legal contract with customers\n→ "If uptime < 99.95%, we give credits"\n\nSLOs are typically set stricter than SLAs (internal buffer).'
    }
  ],
  lab: {
    scenario: 'Observability is critical for operating Kubernetes in production. This lab sets up basic observability tools and practices collecting metrics and logs.',
    objective: 'Practice using kubectl for observability, understand the metrics pipeline, and explore log collection patterns.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Kubernetes Metrics with Metrics Server',
        instruction: `Use kubectl top for real-time observability:

1. Verify Metrics Server is running
2. Observe node resource usage
3. Find the most resource-intensive pods
4. Observe pod-level and container-level metrics`,
        hints: [
          'kubectl get pods -n kube-system | grep metrics-server',
          'kubectl top nodes for node-level metrics',
          'kubectl top pods -A --sort-by=memory for memory ranking',
          'kubectl top pod <name> --containers for per-container breakdown'
        ],
        solution: `\`\`\`bash
# Verify Metrics Server
kubectl get pods -n kube-system | grep metrics-server

# Node metrics (USE method: Utilization)
kubectl top nodes
# Shows: CPU%, MEMORY% per node

# Pod metrics (RED method: resource consumption)
kubectl top pods -A --sort-by=cpu | head -10
kubectl top pods -A --sort-by=memory | head -10

# Create a pod and observe its metrics
kubectl run metric-test --image=nginx:1.25
sleep 30  # Wait for Metrics Server to collect data
kubectl top pod metric-test
kubectl top pod metric-test --containers

kubectl delete pod metric-test
\`\`\``,
        verify: `\`\`\`bash
kubectl top nodes 2>/dev/null | head -3
# Expected: CPU and memory usage per node
\`\`\``
      },
      {
        title: 'Log Collection Patterns',
        instruction: `Practice different log collection and filtering patterns:

1. Create a pod that generates structured logs
2. Practice all kubectl logs flags
3. Simulate a log aggregation sidecar (Fluentd pattern)
4. Understand why stdout/stderr matters`,
        hints: [
          'kubectl logs -f for streaming',
          'kubectl logs --since=2m for time-based filtering',
          'kubectl logs -l app=log-test --all-containers for label-based collection',
          'A sidecar that reads a log file and writes to stdout bridges file-based apps'
        ],
        solution: `\`\`\`bash
# Create a structured log generator
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: log-generator
  labels:
    app: log-test
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c"]
    args: ['while true; do echo "{\"level\":\"info\",\"ts\":\"$(date -Iseconds)\",\"msg\":\"request processed\",\"latency_ms\":$((RANDOM % 200))}"; sleep 2; done']
EOF

kubectl get pod log-generator -w

# Practice log flags
kubectl logs log-generator                    # Current run
kubectl logs log-generator -f &               # Follow in background
kubectl logs log-generator --since=30s        # Last 30 seconds
kubectl logs log-generator --tail=5           # Last 5 lines
kubectl logs log-generator --timestamps       # With timestamps

# Stop follow
kill %1 2>/dev/null; true

# Label-based collection (collect from all pods with label)
kubectl logs -l app=log-test --all-containers=true --tail=5

kubectl delete pod log-generator
\`\`\``,
        verify: `\`\`\`bash
kubectl logs log-generator --tail=3 2>/dev/null
# Expected: JSON structured log lines
\`\`\``
      },
      {
        title: 'Implement Health Check Observability',
        instruction: `Configure probes to make application health observable:

1. Create a pod with both liveness and readiness probes
2. Observe that Kubernetes reports health via probe results
3. Simulate a health check failure and observe the response
4. Understand how this feeds into the observability stack`,
        hints: [
          'livenessProbe: restart on failure; readinessProbe: remove from endpoints',
          'kubectl describe pod shows probe configuration and events',
          'kubectl get endpoints shows pod removed when readiness fails',
          'Events show "Liveness probe failed" messages'
        ],
        solution: `\`\`\`bash
# Pod with health checks
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: healthy-app
spec:
  containers:
  - name: app
    image: nginx:1.25
    livenessProbe:
      httpGet:
        path: /
        port: 80
      initialDelaySeconds: 5
      periodSeconds: 10
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /
        port: 80
      initialDelaySeconds: 3
      periodSeconds: 5
EOF

kubectl get pod healthy-app -w
# Observe READY 0/1 then 1/1 as probes pass

# Check probe configuration
kubectl describe pod healthy-app | grep -A10 "Liveness\|Readiness"

# Expose and check endpoints (readiness affects this)
kubectl expose pod healthy-app --port=80 --name=healthy-svc
kubectl get endpoints healthy-svc
# Expected: pod IP listed (readiness passed)

kubectl delete pod healthy-app
kubectl delete svc healthy-svc
\`\`\``,
        verify: `\`\`\`bash
kubectl describe pod healthy-app | grep "Readiness\|Liveness" | head -4
# Expected: Both probes configured and passing
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'No Metrics Available — kubectl top Returns Empty',
      difficulty: 'easy',
      symptom: 'kubectl top pods or kubectl top nodes returns "error: metrics not available yet" or "no metrics available".',
      diagnosis: `\`\`\`bash
# Check Metrics Server
kubectl get pods -n kube-system | grep metrics-server
kubectl logs -n kube-system -l k8s-app=metrics-server | tail -20

# Test the metrics API
kubectl get --raw /apis/metrics.k8s.io/v1beta1 2>&1

# Check if it's just not ready yet
kubectl get apiservice v1beta1.metrics.k8s.io
\`\`\``,
      solution: `**Fix A: Metrics Server not installed**
\`\`\`bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# For clusters with self-signed certs (labs):
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
\`\`\`

**Fix B: First-time startup (wait 1-2 minutes)**
\`\`\`bash
kubectl rollout status deployment/metrics-server -n kube-system
# Wait for Available, then retry kubectl top
\`\`\``
    }
  ]
};
