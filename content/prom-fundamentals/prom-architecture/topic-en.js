window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['prom-fundamentals/prom-architecture'] = {
  theory: `
# Prometheus Architecture & Components

## Relevance
Prometheus is the de facto standard for monitoring in Kubernetes and cloud-native environments. Understanding its architecture is essential for any DevOps/SRE engineer.

## Core Concepts

### What is Prometheus?
Prometheus is an open-source monitoring and alerting system, originally built at SoundCloud and now a CNCF graduated project. It uses a **pull-based** (scraping) model to collect metrics from configured targets.

### Architecture Overview

\`\`\`
+-------------------+     +------------------+     +----------------+
|   Targets         |     |  Prometheus      |     | Alertmanager   |
| (exporters, apps) |<----|  Server          |---->|                |
+-------------------+     |  - Scraper       |     +----------------+
                          |  - TSDB          |
+-------------------+     |  - Rule Engine   |     +----------------+
| Service Discovery |---->|  - HTTP Server   |     | Grafana        |
| (K8s, Consul,DNS) |     +------------------+     | (visualization)|
+-------------------+            |                  +----------------+
                                 |                        ^
                          +------v------+                 |
                          | Storage     |--- PromQL ----->|
                          | (local TSDB)|
                          +-------------+
\`\`\`

### Main Components

| Component | Role |
|-----------|------|
| **Prometheus Server** | Collects, stores, and queries metrics |
| **TSDB** | Local time-series database |
| **Alertmanager** | Manages and routes alerts |
| **Pushgateway** | Receives metrics from batch jobs (push) |
| **Exporters** | Expose metrics from systems (node, mysql, etc.) |
| **Client Libraries** | Application instrumentation |

### Data Model

Each metric is a **time series** identified by:
- **Metric name**: \`http_requests_total\`
- **Labels**: \`{method="GET", status="200", handler="/api"}\`
- **Timestamp + Value**: point in time with float64 value

### Metric Types

| Type | Description | Example |
|------|-------------|---------|
| **Counter** | Value that only increases (or resets) | \`http_requests_total\` |
| **Gauge** | Value that goes up and down | \`node_memory_available_bytes\` |
| **Histogram** | Distribution across buckets | \`http_request_duration_seconds_bucket\` |
| **Summary** | Pre-calculated quantiles | \`go_gc_duration_seconds\` |

## Essential Commands

### Installation via Helm (kube-prometheus-stack)

\`\`\`bash
# Add repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack (Prometheus + Grafana + Alertmanager)
helm install monitoring prometheus-community/kube-prometheus-stack \\
  --namespace monitoring --create-namespace

# Verify pods
kubectl get pods -n monitoring

# Port-forward to access Prometheus UI
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090

# Port-forward for Grafana
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
\`\`\`

### Checking Targets

\`\`\`bash
# Via Prometheus API
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# Via promtool
promtool check config prometheus.yml
\`\`\`

## YAML Examples

### Basic Prometheus Configuration

\`\`\`yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  scrape_timeout: 10s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  - job_name: "node-exporter"
    static_configs:
      - targets: ["node1:9100", "node2:9100"]

  - job_name: "kubernetes-pods"
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
\`\`\`

### ServiceMonitor (Prometheus Operator)

\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app-monitor
  namespace: monitoring
  labels:
    release: monitoring
spec:
  selector:
    matchLabels:
      app: my-app
  namespaceSelector:
    matchNames:
      - default
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
\`\`\`

## Common Mistakes

1. **ServiceMonitor not discovered**: \`release\` label doesn't match the Prometheus Operator selector
2. **Targets DOWN**: Firewall blocking exporter port, or Service without endpoints
3. **Metrics lost after restart**: Local TSDB without persistence — use a PVC
4. **High cardinality**: Labels with unique values (user_id, request_id) cause series explosion
5. **scrape_timeout > scrape_interval**: Timeout must be less than the interval

## Killer.sh Style Challenge

> Install the kube-prometheus-stack via Helm in the \`monitoring\` namespace. Configure a ServiceMonitor to collect metrics from a deployment called \`web-app\` in the \`default\` namespace that exposes metrics on port \`8080\` at path \`/metrics\`. Verify the target appears as UP in Prometheus.
`,
  quiz: [
    {
      question: 'What collection model does Prometheus use by default?',
      options: ['Push-based (agents send metrics)', 'Pull-based (Prometheus scrapes targets)', 'Streaming via gRPC', 'Polling via SNMP'],
      correct: 1,
      explanation: 'Prometheus uses the pull-based model, scraping (HTTP GET) the /metrics endpoint of configured targets at regular intervals.',
      reference: 'Concept: Prometheus Architecture — pull vs push model'
    },
    {
      question: 'Which Prometheus metric type can only increase or reset to zero?',
      options: ['Gauge', 'Counter', 'Histogram', 'Summary'],
      correct: 1,
      explanation: 'Counter is a metric type that only increments (or resets to 0 on restart). It is used for cumulative counts like total requests.',
      reference: 'Metric types — Counter vs Gauge'
    },
    {
      question: 'Which Prometheus component is responsible for managing and routing alerts?',
      options: ['Prometheus Server', 'Pushgateway', 'Alertmanager', 'Grafana'],
      correct: 2,
      explanation: 'Alertmanager receives alerts from Prometheus Server, deduplicates, groups, silences, and routes them to configured channels (email, Slack, PagerDuty, etc.).',
      reference: 'Components — Alertmanager'
    },
    {
      question: 'What uniquely identifies a time series in Prometheus?',
      options: ['Only the metric name', 'Metric name + set of labels', 'Metric name + timestamp', 'Job name + instance'],
      correct: 1,
      explanation: 'A time series is uniquely identified by the combination of metric name and its set of labels. For example: http_requests_total{method="GET", status="200"} is a different series than http_requests_total{method="POST", status="200"}.',
      reference: 'Data model — time series'
    },
    {
      question: 'Which Prometheus Operator resource is used to configure which Services should be monitored?',
      options: ['PrometheusRule', 'AlertmanagerConfig', 'ServiceMonitor', 'PodMonitor'],
      correct: 2,
      explanation: 'ServiceMonitor is a CRD from the Prometheus Operator that defines which Services (and their ports/paths) should be scraped by Prometheus.',
      reference: 'Prometheus Operator — ServiceMonitor CRD'
    },
    {
      question: 'Which component should be used to collect metrics from short-lived batch jobs?',
      options: ['Exporter', 'Pushgateway', 'ServiceMonitor', 'Federation'],
      correct: 1,
      explanation: 'Pushgateway allows batch jobs to push metrics, since they may terminate before the next Prometheus scrape.',
      reference: 'Pushgateway — when to use'
    },
    {
      question: 'What is TSDB in the Prometheus context?',
      options: ['A target discovery service', 'The local time-series database', 'A communication protocol', 'A query language'],
      correct: 1,
      explanation: 'TSDB (Time Series Database) is the embedded database in Prometheus that stores all collected metrics. It is optimized for high-rate writes and time-range queries.',
      reference: 'TSDB — local storage'
    },
    {
      question: 'What problem is caused by high-cardinality labels in Prometheus?',
      options: ['Duplicate alerts', 'Time series explosion and high memory usage', 'Data loss in TSDB', 'Service Discovery failure'],
      correct: 1,
      explanation: 'Labels with unique values (like user_id or request_id) create a time series for each unique value, causing cardinality explosion that consumes excessive memory and disk.',
      reference: 'Common mistakes — high cardinality'
    }
  ],
  flashcards: [
    { front: 'What is the Prometheus collection model?', back: 'Pull-based (scraping): Prometheus makes HTTP GET requests to the /metrics endpoint of targets at regular intervals (scrape_interval).' },
    { front: 'What are the 4 Prometheus metric types?', back: 'Counter (only increases), Gauge (goes up and down), Histogram (distribution across buckets), Summary (pre-calculated quantiles).' },
    { front: 'What is Alertmanager?', back: 'Component that receives alerts from Prometheus, deduplicates, groups, silences, and routes notifications to channels like email, Slack, and PagerDuty.' },
    { front: 'What is a ServiceMonitor?', back: 'A Prometheus Operator CRD that defines which Services should be monitored, specifying label selectors, ports, and metric paths.' },
    { front: 'When should you use Pushgateway?', back: 'Only for short-lived batch jobs that may terminate before the next scrape. Do NOT use as a general metrics proxy.' },
    { front: 'What identifies a time series in Prometheus?', back: 'The unique combination of metric name + set of labels. E.g.: http_requests_total{method="GET", status="200"}' },
    { front: 'What is kube-prometheus-stack?', back: 'Helm chart that installs Prometheus Operator + Prometheus + Alertmanager + Grafana + node-exporter + kube-state-metrics + pre-configured dashboards and rules.' },
    { front: 'What is high cardinality and why is it a problem?', back: 'Labels with many unique values (user_id, request_id) create thousands of time series, consuming excessive memory/disk and degrading performance.' }
  ],
  lab: {
    scenario: 'You need to install the Prometheus monitoring stack in a Kubernetes cluster and configure monitoring for an application.',
    objective: 'Install kube-prometheus-stack, verify components, create a ServiceMonitor, and validate metrics collection.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Install kube-prometheus-stack via Helm',
        instruction: `Install the \`kube-prometheus-stack\` chart in the \`monitoring\` namespace:

\`\`\`bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack --namespace monitoring --create-namespace
\`\`\``,
        hints: ['Use helm repo add to add the repository', 'Use --create-namespace to create the namespace automatically'],
        solution: `\`\`\`bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack --namespace monitoring --create-namespace
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -n monitoring
# Expected output: prometheus-server, alertmanager, grafana, node-exporter, kube-state-metrics all Running
helm list -n monitoring
# Expected output: monitoring with STATUS deployed
\`\`\``
      },
      {
        title: 'Verify Prometheus Targets',
        instruction: `Port-forward to Prometheus and verify active targets:

\`\`\`bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
\`\`\`

Access http://localhost:9090/targets in your browser.`,
        hints: ['The Prometheus service follows the pattern <release>-kube-prometheus-prometheus', 'Use the /api/v1/targets API to verify via CLI'],
        solution: `\`\`\`bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090 &
curl -s http://localhost:9090/api/v1/targets | python3 -m json.tool | head -50
\`\`\``,
        verify: `\`\`\`bash
curl -s http://localhost:9090/api/v1/targets | grep -o '"health":"up"' | wc -l
# Expected output: number > 0 (healthy targets)
\`\`\``
      },
      {
        title: 'Deploy Application with Metrics',
        instruction: `Create a Deployment and Service for an application that exposes Prometheus metrics:

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-app
  namespace: default
  labels:
    app: sample-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sample-app
  template:
    metadata:
      labels:
        app: sample-app
    spec:
      containers:
      - name: sample
        image: quay.io/brancz/prometheus-example-app:v0.5.0
        ports:
        - containerPort: 8080
          name: metrics
---
apiVersion: v1
kind: Service
metadata:
  name: sample-app
  namespace: default
  labels:
    app: sample-app
spec:
  selector:
    app: sample-app
  ports:
  - port: 8080
    targetPort: metrics
    name: metrics
\`\`\``,
        hints: ['The prometheus-example-app image exposes metrics at /metrics on port 8080', 'The Service needs the label app: sample-app for the ServiceMonitor to find it'],
        solution: `\`\`\`bash
kubectl apply -f sample-app.yaml
kubectl get pods -l app=sample-app
kubectl get svc sample-app
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -l app=sample-app -o wide
# Expected output: pod Running
kubectl port-forward svc/sample-app 8080:8080 &
curl -s http://localhost:8080/metrics | head -10
# Expected output: metrics in Prometheus format (# HELP, # TYPE, values)
\`\`\``
      },
      {
        title: 'Create ServiceMonitor',
        instruction: `Create a ServiceMonitor so Prometheus collects metrics from the application:

\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: sample-app-monitor
  namespace: monitoring
  labels:
    release: monitoring
spec:
  selector:
    matchLabels:
      app: sample-app
  namespaceSelector:
    matchNames:
      - default
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
\`\`\`

**Important**: The \`release: monitoring\` label must match the Helm release name.`,
        hints: ['The release label must match the Helm release name (monitoring)', 'namespaceSelector defines which namespace to look for Services in'],
        solution: `\`\`\`bash
kubectl apply -f servicemonitor.yaml
kubectl get servicemonitor -n monitoring
\`\`\``,
        verify: `\`\`\`bash
kubectl get servicemonitor sample-app-monitor -n monitoring
# Expected output: ServiceMonitor listed
# After ~30s, check in Prometheus:
curl -s http://localhost:9090/api/v1/targets | grep sample-app
# Expected output: sample-app target with health: up
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ServiceMonitor not appearing in Prometheus targets',
      difficulty: 'easy',
      symptom: 'You created a ServiceMonitor but the target does not appear on the /targets page of Prometheus.',
      diagnosis: `\`\`\`bash
# Check ServiceMonitor labels
kubectl get servicemonitor -n monitoring -o yaml | grep -A5 labels

# Check the Prometheus Operator selector
kubectl get prometheus -n monitoring -o yaml | grep -A10 serviceMonitorSelector

# Check if the Service exists and has correct labels
kubectl get svc -l app=sample-app
\`\`\``,
      solution: 'The most common issue is the ServiceMonitor label not matching the Prometheus serviceMonitorSelector. In kube-prometheus-stack, add the label release: <helm-release-name>. Also verify that namespaceSelector includes the target Service namespace.'
    },
    {
      title: 'Prometheus restarting with OOMKilled',
      difficulty: 'medium',
      symptom: 'The Prometheus pod is in CrashLoopBackOff with reason OOMKilled.',
      diagnosis: `\`\`\`bash
# Check pod events
kubectl describe pod -n monitoring -l app.kubernetes.io/name=prometheus | grep -A5 "Last State"

# Check memory usage
kubectl top pod -n monitoring -l app.kubernetes.io/name=prometheus

# Check number of time series
curl -s http://localhost:9090/api/v1/status/tsdb | jq '.data.seriesCountByMetricName[:10]'
\`\`\``,
      solution: 'Increase Prometheus memory limits in the Helm values.yaml: prometheus.prometheusSpec.resources.limits.memory. If the issue is high cardinality, identify metrics with many unique labels using the tsdb status query and add metric_relabel_configs to drop unnecessary metrics.'
    },
    {
      title: 'Metrics disappear after Prometheus restart',
      difficulty: 'hard',
      symptom: 'After restarting the Prometheus pod, all historical metrics disappear.',
      diagnosis: `\`\`\`bash
# Check if PVC is configured
kubectl get pvc -n monitoring | grep prometheus

# Check storageSpec in the Prometheus CR
kubectl get prometheus -n monitoring -o yaml | grep -A10 storage

# Check if volume is mounted
kubectl describe pod -n monitoring -l app.kubernetes.io/name=prometheus | grep -A5 Volumes
\`\`\``,
      solution: 'Prometheus needs persistent storage to keep data across restarts. Configure storageSpec in the Helm values.yaml: prometheus.prometheusSpec.storageSpec.volumeClaimTemplate with an appropriate PVC. Also set retention (default 15d) and retentionSize to control disk usage.'
    }
  ]
};
