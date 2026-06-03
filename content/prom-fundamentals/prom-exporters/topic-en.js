window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['prom-fundamentals/prom-exporters'] = {
  theory: `
# Exporters and Instrumentation

## Relevance
Exporters bridge the gap between systems that don't natively expose metrics and Prometheus. Understanding which exporters to use, how to configure them, and how to instrument your own applications is essential for complete Kubernetes cluster monitoring.

## Core Concepts

### What are Exporters?
Exporters are programs that collect metrics from third-party systems and expose them in Prometheus format (plain text with name/value pairs + labels) on an HTTP endpoint (usually /metrics).

\`\`\`
Original System          Exporter              Prometheus
+---------------+    +------------------+    +-----------+
| MySQL         |--->| mysqld_exporter  |--->|           |
| Linux Node    |--->| node_exporter    |--->| Scrape    |
| Kubernetes    |--->| kube-state-metrics|--->|           |
| Your App      |--->| client library   |--->|           |
+---------------+    +------------------+    +-----------+
\`\`\`

### Essential Exporters for Kubernetes

| Exporter | Function | Key Metrics |
|----------|----------|-------------|
| **node_exporter** | Hardware and OS metrics from nodes | CPU, memory, disk, network |
| **kube-state-metrics** | K8s object state | Pods, Deployments, Nodes, PVs |
| **cAdvisor** | Container metrics (built into kubelet) | CPU, memory, IO per container |
| **blackbox_exporter** | Endpoint probing (HTTP, TCP, DNS, ICMP) | Availability, latency |
| **mysqld_exporter** | MySQL metrics | Queries, connections, replication |
| **redis_exporter** | Redis metrics | Memory, keys, commands |
| **postgres_exporter** | PostgreSQL metrics | Connections, queries, locks |

### node_exporter — Node Metrics

node_exporter exposes hardware and OS metrics:

\`\`\`bash
# Installation as DaemonSet
# Usually already included in kube-prometheus-stack
kubectl get ds -n monitoring | grep node-exporter
\`\`\`

**Key Metrics:**
\`\`\`promql
# CPU
node_cpu_seconds_total{mode="idle"}
node_cpu_seconds_total{mode="system"}
node_cpu_seconds_total{mode="user"}

# Memory
node_memory_MemTotal_bytes
node_memory_MemAvailable_bytes
node_memory_MemFree_bytes

# Disk
node_filesystem_size_bytes{mountpoint="/"}
node_filesystem_avail_bytes{mountpoint="/"}
node_disk_read_bytes_total
node_disk_written_bytes_total

# Network
node_network_receive_bytes_total
node_network_transmit_bytes_total
node_network_receive_errs_total

# Load
node_load1
node_load5
node_load15
\`\`\`

**Useful Queries:**
\`\`\`promql
# CPU used (%)
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

# Memory used (%)
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Disk used (%)
(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100

# Network bandwidth (bytes/s)
rate(node_network_receive_bytes_total{device!="lo"}[5m])
\`\`\`

### kube-state-metrics — Cluster State

kube-state-metrics exposes the state of Kubernetes objects:

\`\`\`promql
# Pods
kube_pod_status_phase{phase="Running"}
kube_pod_container_status_restarts_total
kube_pod_container_status_waiting_reason

# Deployments
kube_deployment_spec_replicas
kube_deployment_status_replicas_available
kube_deployment_status_replicas_unavailable

# Nodes
kube_node_status_condition{condition="Ready",status="true"}
kube_node_info

# PersistentVolumes
kube_persistentvolume_status_phase
kube_persistentvolumeclaim_resource_requests_storage_bytes

# Jobs/CronJobs
kube_job_status_succeeded
kube_job_status_failed
kube_cronjob_next_schedule_time
\`\`\`

**Useful Queries:**
\`\`\`promql
# Non-Running pods by namespace
count by(namespace) (kube_pod_status_phase{phase!="Running",phase!="Succeeded"})

# Deployments with unavailable replicas
kube_deployment_status_replicas_unavailable > 0

# Pods in CrashLoopBackOff
kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"} > 0

# PVCs nearly full
kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes * 100 > 80
\`\`\`

### cAdvisor — Container Metrics

cAdvisor is built into the kubelet and exposes metrics for each container:

\`\`\`promql
# Container CPU (cores)
rate(container_cpu_usage_seconds_total{container!=""}[5m])

# Container memory (bytes)
container_memory_usage_bytes{container!=""}
container_memory_working_set_bytes{container!=""}

# Network IO
container_network_receive_bytes_total
container_network_transmit_bytes_total

# Disk IO
container_fs_reads_bytes_total
container_fs_writes_bytes_total
\`\`\`

> **Important:** \`container!=""\` filters out POD (sandbox) containers that are not relevant.

### blackbox_exporter — Endpoint Probing

The blackbox_exporter tests endpoints externally (HTTP, TCP, DNS, ICMP):

\`\`\`yaml
# blackbox.yml
modules:
  http_2xx:
    prober: http
    timeout: 5s
    http:
      valid_http_versions: ["HTTP/1.1", "HTTP/2.0"]
      valid_status_codes: [200]
      method: GET
      follow_redirects: true

  tcp_connect:
    prober: tcp
    timeout: 5s

  icmp:
    prober: icmp
    timeout: 5s

  dns_lookup:
    prober: dns
    timeout: 5s
    dns:
      query_name: "kubernetes.default.svc.cluster.local"
      query_type: "A"
\`\`\`

**Prometheus Configuration:**
\`\`\`yaml
scrape_configs:
  - job_name: 'blackbox-http'
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
          - https://myapp.example.com
          - https://api.example.com/health
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115
\`\`\`

**blackbox_exporter Metrics:**
\`\`\`promql
# Is the endpoint UP? (1 = success, 0 = failure)
probe_success

# Total probe latency (seconds)
probe_duration_seconds

# DNS resolution time
probe_dns_lookup_time_seconds

# HTTP status code
probe_http_status_code

# SSL certificate expires in X seconds
probe_ssl_earliest_cert_expiry - time()
\`\`\`

### Application Instrumentation

Client libraries allow exposing metrics directly from the application:

**Go:**
\`\`\`go
import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

var httpRequests = prometheus.NewCounterVec(
    prometheus.CounterOpts{
        Name: "http_requests_total",
        Help: "Total number of HTTP requests",
    },
    []string{"method", "status", "handler"},
)

func init() {
    prometheus.MustRegister(httpRequests)
}

// In the HTTP handler:
httpRequests.WithLabelValues("GET", "200", "/api/users").Inc()

// Expose metrics
http.Handle("/metrics", promhttp.Handler())
\`\`\`

**Python:**
\`\`\`python
from prometheus_client import Counter, Histogram, start_http_server

REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'status'])
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'HTTP request latency')

@REQUEST_LATENCY.time()
def handle_request():
    REQUEST_COUNT.labels(method='GET', status='200').inc()

start_http_server(8080)  # Exposes /metrics on port 8080
\`\`\`

### Metric Naming Conventions

| Rule | Correct Example | Wrong Example |
|------|----------------|---------------|
| snake_case | \`http_requests_total\` | \`httpRequestsTotal\` |
| _total suffix for counters | \`errors_total\` | \`error_count\` |
| _bytes suffix for bytes | \`memory_usage_bytes\` | \`memory_usage_mb\` |
| _seconds suffix for time | \`request_duration_seconds\` | \`request_duration_ms\` |
| Domain prefix | \`myapp_http_requests_total\` | \`requests\` |
| Base unit (bytes, seconds) | \`size_bytes\` | \`size_kilobytes\` |

## Common Mistakes

1. **Not installing kube-state-metrics**: Without it, you have no visibility into K8s object state (deployments, pods, etc.).
2. **Confusing cAdvisor with node_exporter**: cAdvisor measures containers, node_exporter measures the entire node. Both are necessary.
3. **High cardinality labels**: Using labels like \`user_id\` or \`request_id\` explodes the number of time series and causes performance issues.
4. **Not using base units**: Exposing metrics in milliseconds or megabytes instead of seconds and bytes creates confusion.
5. **Exposing sensitive metrics**: Don't include PII data, tokens, or passwords in labels or metric names.
6. **Forgetting the /metrics endpoint**: The application exposes metrics but no /metrics route is configured.

## Killer.sh Style Challenge

**Scenario:** Configure exporters and instrumentation for complete cluster monitoring.

**Tasks:**
1. Verify that node_exporter and kube-state-metrics are running in the cluster
2. Configure blackbox_exporter to probe an HTTP endpoint
3. Write queries for: CPU per node, pods with restarts, and endpoint availability
4. Identify a container with high memory usage using cAdvisor metrics

**Solutions:**
\`\`\`bash
# 1. Verify exporters
kubectl get ds -n monitoring | grep node-exporter
kubectl get deploy -n monitoring | grep kube-state-metrics

# 2. HTTP probe
curl 'http://blackbox-exporter:9115/probe?target=https://myapp.example.com&module=http_2xx'
\`\`\`

\`\`\`promql
# 3. Queries
# CPU per node
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

# Pods with restarts
kube_pod_container_status_restarts_total > 5

# Availability
probe_success{instance="https://myapp.example.com"}

# 4. Top containers by memory
topk(5, container_memory_working_set_bytes{container!=""})
\`\`\`
`,
  quiz: [
    {
      question: 'What is the primary function of an exporter in the Prometheus ecosystem?',
      options: [
        'Export data from Prometheus to other systems',
        'Collect metrics from third-party systems and expose them in Prometheus format',
        'Convert Prometheus metrics to JSON format',
        'Send alerts to external systems'
      ],
      correct: 1,
      explanation: 'Exporters are programs that collect metrics from systems that don\'t natively expose metrics in Prometheus format. They act as translators, collecting data (e.g., from MySQL, Linux) and exposing it via HTTP in the format Prometheus understands.',
      reference: 'Related concept: prom-architecture — exporters are targets that Prometheus scrapes.'
    },
    {
      question: 'What is the difference between node_exporter and kube-state-metrics?',
      options: [
        'They are the same thing with different names',
        'node_exporter measures node hardware/OS, kube-state-metrics measures Kubernetes object state',
        'node_exporter is for Linux, kube-state-metrics is for Windows',
        'node_exporter is newer than kube-state-metrics'
      ],
      correct: 1,
      explanation: 'node_exporter exposes hardware and OS metrics (CPU, memory, disk, network of the node). kube-state-metrics exposes the state of Kubernetes objects (pods, deployments, nodes, PVs). Both are complementary and essential.',
      reference: 'Related concept: prom-service-discovery — both are discovered via kubernetes_sd_configs.'
    },
    {
      question: 'What is the blackbox_exporter used for?',
      options: [
        'Monitoring black boxes (systems without internal access)',
        'Testing endpoints externally via HTTP, TCP, DNS, or ICMP',
        'Collecting Docker container metrics',
        'Exporting system logs'
      ],
      correct: 1,
      explanation: 'The blackbox_exporter performs active probes on endpoints, checking availability (HTTP status, TCP connection), latency, and SSL certificates. It is essential for synthetic monitoring and availability SLO validation.',
      reference: 'Related concept: prom-alerting — combine probe_success with alerting rules to alert on unavailability.'
    },
    {
      question: 'Why are high cardinality labels (e.g., user_id) problematic in Prometheus?',
      options: [
        'Because Prometheus does not support text labels',
        'Because each unique label combination creates a new time series, causing cardinality explosion and performance issues',
        'Because labels with many values don\'t appear in Grafana',
        'Because it violates Prometheus naming conventions'
      ],
      correct: 1,
      explanation: 'Each unique combination of name + labels creates a separate time series in TSDB. If user_id has 100k unique values, a single metric with that label creates 100k series. This consumes a lot of memory and makes queries slow.',
      reference: 'Related concept: promql-advanced — recording rules help pre-aggregate high cardinality metrics.'
    },
    {
      question: 'Which filter is essential when using cAdvisor metrics to avoid duplicate data?',
      options: [
        'container="POD"',
        'container!=""',
        'namespace!="kube-system"',
        'pod!=""'
      ],
      correct: 1,
      explanation: 'The filter container!="" removes metrics from sandbox (POD) containers that Kubernetes creates for each pod. Without this filter, you\'ll see duplicate metrics — one for the real container and one for the sandbox.',
      reference: 'Related concept: promql-basics — label filtering is essential for accurate queries.'
    },
    {
      question: 'What is the correct naming convention for an HTTP requests counter metric?',
      options: [
        'httpRequestsCount',
        'http_requests_total',
        'http.requests.count',
        'HTTP_REQUESTS'
      ],
      correct: 1,
      explanation: 'Prometheus convention requires: snake_case, _total suffix for counters, application domain prefix, and base units (bytes, seconds). http_requests_total follows all these conventions.',
      reference: 'Related concept: prom-architecture — Prometheus metric types and conventions.'
    },
    {
      question: 'Which blackbox_exporter metric indicates whether an HTTP endpoint is available?',
      options: [
        'http_up',
        'probe_success',
        'blackbox_endpoint_up',
        'probe_http_available'
      ],
      correct: 1,
      explanation: 'probe_success returns 1 when the probe was successful (endpoint responded as expected) and 0 when it failed. It is the primary metric for availability alerts with blackbox_exporter.',
      reference: 'Related concept: prom-alerting — use probe_success in availability SLO alerts.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4 essential exporters for Kubernetes?',
      back: '1. **node_exporter** — hardware/OS metrics (CPU, memory, disk, network) per node\n2. **kube-state-metrics** — K8s object state (pods, deployments, nodes)\n3. **cAdvisor** — container metrics (CPU, memory, IO) — built into kubelet\n4. **blackbox_exporter** — external probing (HTTP, TCP, DNS, ICMP)\n\nAll are complementary — each covers a different layer.'
    },
    {
      front: 'What is the difference between container_memory_usage_bytes and container_memory_working_set_bytes?',
      back: '**container_memory_usage_bytes**: includes ALL memory (RSS + cache + swap)\n- Can be misleading as it includes page cache that can be freed\n\n**container_memory_working_set_bytes**: memory actually in use (RSS + actively used cache)\n- This is the metric Kubernetes uses for OOMKill decisions\n- Use this one for container memory alerts'
    },
    {
      front: 'How does the blackbox_exporter work for HTTP probing?',
      back: 'The blackbox_exporter performs active probes:\n\n1. Prometheus scrapes the blackbox_exporter passing the target as a parameter\n2. The blackbox_exporter makes the HTTP request to the target\n3. Returns metrics: probe_success, probe_duration_seconds, probe_http_status_code\n\nPrometheus config:\n```yaml\njob_name: blackbox\nmetrics_path: /probe\nparams:\n  module: [http_2xx]\nrelabel_configs:\n  # target -> __param_target -> instance\n```'
    },
    {
      front: 'What are the Prometheus metric naming conventions?',
      back: '- **snake_case**: http_requests_total (not camelCase)\n- **_total** for counters: errors_total\n- **_bytes** for sizes: memory_bytes\n- **_seconds** for duration: latency_seconds\n- **_info** for metadata: build_info{version="1.0"}\n- **Base unit**: always bytes (not KB/MB), seconds (not ms)\n- **Prefix**: app domain (myapp_requests_total)\n\nFollowing these conventions ensures consistency and compatibility with standard dashboards.'
    },
    {
      front: 'What is application instrumentation and when to use it?',
      back: '**Instrumentation** is adding metrics directly to application code using client libraries.\n\n**When to use:**\n- Business metrics (orders, payments, users)\n- Internal operation latency\n- Specific error counters\n- Metrics that exporters don\'t cover\n\n**Client libraries:** Go, Python, Java, Ruby, .NET\n\n**Metric types:**\n- Counter (only goes up): requests_total\n- Gauge (up/down): temperature, queue_size\n- Histogram (distribution): latency_seconds\n- Summary (pre-calculated percentiles)'
    },
    {
      front: 'Which kube-state-metrics metrics are most useful for alerts?',
      back: '**Pods:**\n- kube_pod_status_phase{phase!="Running"}\n- kube_pod_container_status_restarts_total\n- kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"}\n\n**Deployments:**\n- kube_deployment_status_replicas_unavailable > 0\n- spec_replicas != status_replicas_available\n\n**Nodes:**\n- kube_node_status_condition{condition="Ready",status!="true"}\n\n**PVs:**\n- kube_persistentvolume_status_phase{phase="Failed"}'
    },
    {
      front: 'Why are high cardinality labels dangerous?',
      back: 'Each unique combination of name + labels = 1 time series.\n\nDangerous example:\n```\nhttp_requests{user_id="..."}\n```\nIf 100k unique users: 100k series per metric!\n\n**Impact:**\n- Excessive Prometheus memory usage\n- Slow queries\n- Slow TSDB compaction\n- Can crash Prometheus\n\n**Solution:** Use low-cardinality labels (method, status, service, namespace). High-cardinality data belongs in logs, not metrics.'
    }
  ],
  lab: {
    scenario: 'You need to configure and verify essential exporters in a Kubernetes cluster, including node_exporter, kube-state-metrics, and blackbox_exporter.',
    objective: 'Install/verify exporters, query their metrics, configure blackbox probing, and understand application instrumentation.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Verify Essential Exporters',
        instruction: `Verify that essential exporters are running in the cluster.

\`\`\`bash
# Check node_exporter (usually DaemonSet)
kubectl get ds -n monitoring -l app.kubernetes.io/name=node-exporter

# Check kube-state-metrics (usually Deployment)
kubectl get deploy -n monitoring -l app.kubernetes.io/name=kube-state-metrics

# Check cAdvisor (built into kubelet)
kubectl get nodes -o wide

# Check each exporter's metrics in Prometheus
curl -s 'http://localhost:9090/api/v1/query?query=up{job=~".*node.*"}' | jq '.data.result[] | {job: .metric.job, instance: .metric.instance, value: .value[1]}'
\`\`\``,
        hints: ['node_exporter runs as a DaemonSet (one pod per node)', 'kube-state-metrics runs as a Deployment (1-2 replicas)', 'cAdvisor is built into the kubelet and needs no separate deployment'],
        solution: `\`\`\`bash
kubectl get ds,deploy -n monitoring
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job | test("node|kube-state|cadvisor")) | {job: .labels.job, health: .health}'
\`\`\``,
        verify: `\`\`\`bash
curl -s 'http://localhost:9090/api/v1/query?query=node_cpu_seconds_total' | jq '.data.result | length'
# Expected output: number > 0

curl -s 'http://localhost:9090/api/v1/query?query=kube_pod_info' | jq '.data.result | length'
# Expected output: number > 0
\`\`\``
      },
      {
        title: 'Query Node and Container Metrics',
        instruction: `Practice queries using node_exporter and cAdvisor metrics.

\`\`\`promql
# === node_exporter ===
# CPU per node (%)
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

# Memory per node (%)
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# === cAdvisor ===
# Top 5 containers by CPU
topk(5, sum by(namespace, pod, container) (rate(container_cpu_usage_seconds_total{container!=""}[5m])))

# Top 5 containers by memory
topk(5, container_memory_working_set_bytes{container!=""})

# === kube-state-metrics ===
# Non-Running pods
kube_pod_status_phase{phase!="Running", phase!="Succeeded"} == 1
\`\`\``,
        hints: ['Use container!="" to filter POD sandbox containers', 'container_memory_working_set_bytes is more accurate than usage_bytes', 'fstype!~"tmpfs|overlay" filters virtual filesystems'],
        solution: `\`\`\`promql
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100
topk(10, container_memory_working_set_bytes{container!=""} / 1024 / 1024)
\`\`\``,
        verify: `\`\`\`bash
curl -s 'http://localhost:9090/api/v1/query?query=(1-avg%20by(instance)(rate(node_cpu_seconds_total{mode=%22idle%22}[5m])))*100' | jq '.data.result | length'
# Expected output: number > 0 (one result per node)
\`\`\``
      },
      {
        title: 'Configure Blackbox Exporter',
        instruction: `Configure the blackbox_exporter to probe HTTP endpoints and verify the results.

\`\`\`yaml
# blackbox-config.yaml (ConfigMap)
apiVersion: v1
kind: ConfigMap
metadata:
  name: blackbox-config
  namespace: monitoring
data:
  blackbox.yml: |
    modules:
      http_2xx:
        prober: http
        timeout: 5s
        http:
          valid_status_codes: [200, 301, 302]
          method: GET
          follow_redirects: true
      tcp_connect:
        prober: tcp
        timeout: 5s
\`\`\`

Test the probe manually:
\`\`\`bash
curl 'http://blackbox-exporter:9115/probe?target=http://kubernetes.default.svc:443&module=http_2xx'
\`\`\``,
        hints: ['The blackbox_exporter needs a ConfigMap with module configuration', 'Test locally before configuring in Prometheus', 'probe_success=1 means success, 0 means failure'],
        solution: `\`\`\`bash
kubectl apply -f blackbox-config.yaml
kubectl port-forward -n monitoring svc/blackbox-exporter 9115:9115 &
curl -s 'http://localhost:9115/probe?target=https://kubernetes.io&module=http_2xx' | grep probe_success
\`\`\``,
        verify: `\`\`\`bash
kubectl get cm blackbox-config -n monitoring
# Expected output: ConfigMap listed
\`\`\``
      },
      {
        title: 'Analyze Metric Cardinality',
        instruction: `Analyze metric cardinality in the cluster to identify potential performance issues.

\`\`\`promql
# Total active time series
prometheus_tsdb_head_series

# Top 10 metrics by number of series
topk(10, count by(__name__) ({__name__!=""}))

# Metrics with more than 1000 series (possible high cardinality)
count by(__name__) ({__name__!=""}) > 1000

# Total series by job
count by(job) ({__name__!=""})

# Samples ingested per second
rate(prometheus_tsdb_head_samples_appended_total[5m])
\`\`\`

Identify metrics with excessive cardinality and consider filters.`,
        hints: ['Metrics with thousands of series may indicate high-cardinality labels', 'Use metric_relabel_configs to drop unnecessary metrics', 'prometheus_tsdb_head_series shows total active series'],
        solution: `\`\`\`promql
prometheus_tsdb_head_series
topk(10, count by(__name__) ({__name__!=""}))
count by(job) ({__name__!=""})
rate(prometheus_tsdb_head_samples_appended_total[5m])
\`\`\``,
        verify: `\`\`\`bash
curl -s 'http://localhost:9090/api/v1/query?query=prometheus_tsdb_head_series' | jq '.data.result[0].value[1]'
# Expected output: number (total active series)

curl -s 'http://localhost:9090/api/v1/query?query=rate(prometheus_tsdb_head_samples_appended_total[5m])' | jq '.data.result[0].value[1]'
# Expected output: number (samples per second)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'node_exporter not appearing in Prometheus targets',
      difficulty: 'easy',
      symptom: 'The node_exporter DaemonSet is running on all nodes, but no targets appear in Prometheus.',
      diagnosis: `\`\`\`bash
kubectl get ds -n monitoring -l app.kubernetes.io/name=node-exporter -o wide
kubectl get pods -n monitoring -l app.kubernetes.io/name=node-exporter
kubectl get svc -n monitoring -l app.kubernetes.io/name=node-exporter
kubectl port-forward -n monitoring ds/node-exporter 9100:9100 &
curl -s http://localhost:9100/metrics | head -5
\`\`\``,
      solution: `**Common causes:**

1. **Missing Service or ServiceMonitor:** node_exporter needs a Service or ServiceMonitor to be discovered.

2. **Incorrect port:** node_exporter uses port 9100 by default. Verify the Service points to the correct port.

3. **NetworkPolicy blocking:** If the cluster has NetworkPolicies, Prometheus may not be able to access port 9100 on the nodes.

4. **hostNetwork vs podNetwork:** node_exporter usually runs with hostNetwork: true to access host metrics. Verify the configuration is correct.`
    },
    {
      title: 'kube-state-metrics showing outdated or incomplete data',
      difficulty: 'medium',
      symptom: 'kube-state-metrics metrics don\'t reflect the current cluster state. New pods don\'t appear or deleted pods remain in the metrics.',
      diagnosis: `\`\`\`bash
kubectl get deploy -n monitoring kube-state-metrics
kubectl logs -n monitoring -l app.kubernetes.io/name=kube-state-metrics --tail=20
kubectl logs -n monitoring -l app.kubernetes.io/name=kube-state-metrics | grep -i "error\\|forbidden"
\`\`\``,
      solution: `**Common causes:**

1. **Insufficient RBAC:** kube-state-metrics needs a ClusterRole with broad permissions to read K8s objects.

2. **Outdated version:** Older kube-state-metrics versions may not support newer K8s objects.

3. **Scrape timeout:** If kube-state-metrics has many objects, scraping may exceed the timeout. Increase to 30s.

4. **Incorrect sharding:** If using sharding, each shard only exposes part of the objects.`
    },
    {
      title: 'High cardinality causing OOM in Prometheus',
      difficulty: 'hard',
      symptom: 'Prometheus is consuming too much memory and eventually gets OOM-killed. Queries are slow and the TSDB is large.',
      diagnosis: `\`\`\`promql
prometheus_tsdb_head_series
topk(20, count by(__name__) ({__name__!=""}))
count by(job) ({__name__!=""})
rate(prometheus_tsdb_head_series_created_total[5m])
rate(prometheus_tsdb_head_samples_appended_total[5m])
\`\`\``,
      solution: `**Strategies to reduce cardinality:**

1. **Identify problematic metrics:** Use topk(20, count by(__name__) ...) to find metrics with the most series.

2. **Drop unnecessary metrics via metric_relabel_configs:** Drop go_.*, process_.*, promhttp_.* patterns.

3. **Remove high-cardinality labels via labeldrop:** Drop pod_template_hash, controller_revision_hash.

4. **Reduce retention:** Set --storage.tsdb.retention.time=7d and --storage.tsdb.retention.size=10GB.

5. **Use kube-state-metrics sharding:** Split across multiple shards with --shard and --total-shards flags.`
    }
  ]
};
