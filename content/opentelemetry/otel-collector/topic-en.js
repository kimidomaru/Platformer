window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['opentelemetry/otel-collector'] = {
  theory: `
# OTel Collector & Pipelines

## Relevance
The OpenTelemetry Collector is the central component of a modern observability architecture. It acts as a proxy and pipeline to receive, process, and export telemetry data (traces, metrics, logs). It is vendor-neutral and highly configurable.

## Core Concepts

### Collector Architecture

\`\`\`
┌─────────────────────────────────────────────────────┐
│                  OTel Collector                     │
│                                                     │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐    │
│  │ Receivers │──→│Processors │──→│ Exporters │    │
│  └───────────┘   └───────────┘   └───────────┘    │
│                                                     │
│  Receivers:    Where data enters                    │
│  Processors:   Transformations in the middle        │
│  Exporters:    Where data goes                      │
│                                                     │
│  Pipeline = Receiver(s) → Processor(s) → Exporter(s)│
└─────────────────────────────────────────────────────┘
\`\`\`

### Collector Distributions

| Distribution | Contents | Use Case |
|-------------|---------|----------|
| Core | Essential components | Minimum for OTLP |
| Contrib | Core + 100+ community components | Production (most cases) |
| Custom | Custom build (ocb) | Enterprise/security |

### Basic Configuration

\`\`\`yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

  prometheus:
    config:
      scrape_configs:
        - job_name: 'kubernetes-pods'
          kubernetes_sd_configs:
            - role: pod
          relabel_configs:
            - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
              action: keep
              regex: true

processors:
  batch:
    timeout: 5s
    send_batch_size: 1024
    send_batch_max_size: 2048

  memory_limiter:
    check_interval: 1s
    limit_mib: 512
    spike_limit_mib: 128

  resource:
    attributes:
      - key: environment
        value: production
        action: upsert
      - key: cluster
        value: production-us-east-1
        action: upsert

exporters:
  otlp/tempo:
    endpoint: tempo.observability:4317
    tls:
      insecure: true

  prometheusremotewrite:
    endpoint: http://prometheus.observability:9090/api/v1/write

  loki:
    endpoint: http://loki.observability:3100/loki/api/v1/push

  debug:
    verbosity: detailed

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/tempo, debug]

    metrics:
      receivers: [otlp, prometheus]
      processors: [memory_limiter, batch]
      exporters: [prometheusremotewrite]

    logs:
      receivers: [otlp]
      processors: [memory_limiter, resource, batch]
      exporters: [loki]

  telemetry:
    logs:
      level: info
    metrics:
      address: 0.0.0.0:8888
\`\`\`

### Receivers — Where Data Enters

\`\`\`yaml
receivers:
  # OTLP — OTel standard (traces, metrics, logs)
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

  # Filelog — collect logs from files (DaemonSet)
  filelog:
    include:
      - /var/log/pods/*/*/*.log
    operators:
      - type: container
        id: container-parser
      - type: json_parser
        if: body matches "^\\\\{"
      - type: severity_parser
        parse_from: attributes.level

  # Kubernetes Events
  k8s_events:
    namespaces: []  # empty = all

  # Host Metrics (node)
  hostmetrics:
    collection_interval: 30s
    scrapers:
      cpu: {}
      memory: {}
      disk: {}
      filesystem: {}
      network: {}

  # Prometheus scraping
  prometheus:
    config:
      scrape_configs:
        - job_name: 'otel-collector'
          scrape_interval: 10s
          static_configs:
            - targets: ['0.0.0.0:8888']
\`\`\`

### Processors — Transformations

\`\`\`yaml
processors:
  # Batch — group data for efficient delivery
  batch:
    timeout: 5s
    send_batch_size: 1024

  # Memory Limiter — protect against OOM
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
    spike_limit_mib: 128

  # Resource — add/modify resource attributes
  resource:
    attributes:
      - key: environment
        value: production
        action: upsert

  # K8s Attributes — enrich with K8s metadata
  k8sattributes:
    auth_type: "serviceAccount"
    extract:
      metadata:
        - k8s.namespace.name
        - k8s.pod.name
        - k8s.pod.uid
        - k8s.deployment.name
        - k8s.node.name
      labels:
        - tag_name: app
          key: app.kubernetes.io/name
        - tag_name: version
          key: app.kubernetes.io/version
    pod_association:
      - sources:
          - from: resource_attribute
            name: k8s.pod.ip

  # Filter — remove unnecessary data
  filter:
    error_mode: ignore
    traces:
      span:
        - 'attributes["http.target"] == "/healthz"'
        - 'attributes["http.target"] == "/readyz"'
    metrics:
      metric:
        - 'name == "go_gc_duration_seconds"'

  # Transform — modify data
  transform:
    trace_statements:
      - context: span
        statements:
          - 'set(status.code, 1) where attributes["http.response.status_code"] >= 400'

  # Tail Sampling — sample at the collector
  tail_sampling:
    decision_wait: 10s
    num_traces: 100000
    policies:
      - name: errors
        type: status_code
        status_code:
          status_codes: [ERROR]
      - name: slow-traces
        type: latency
        latency:
          threshold_ms: 1000
      - name: probabilistic
        type: probabilistic
        probabilistic:
          sampling_percentage: 10
\`\`\`

### Exporters — Where Data Goes

\`\`\`yaml
exporters:
  # OTLP — for backends that support OTLP
  otlp/tempo:
    endpoint: tempo.observability:4317
    tls:
      insecure: true
    headers:
      X-Scope-OrgID: "production"
    retry_on_failure:
      enabled: true
      initial_interval: 5s
      max_interval: 30s
      max_elapsed_time: 300s

  # Prometheus Remote Write
  prometheusremotewrite:
    endpoint: http://mimir.observability:9090/api/v1/write
    resource_to_telemetry_conversion:
      enabled: true

  # Loki — for logs
  loki:
    endpoint: http://loki.observability:3100/loki/api/v1/push
    default_labels_enabled:
      exporter: false
      job: true

  # Debug — for development
  debug:
    verbosity: detailed
    sampling_initial: 5
    sampling_thereafter: 200

  # OTLP/HTTP — for SaaS (Datadog, New Relic, etc)
  otlphttp/datadog:
    endpoint: https://api.datadoghq.com
    headers:
      DD-API-KEY: "\${env:DD_API_KEY}"
\`\`\`

### Pipelines — Connecting Everything

\`\`\`yaml
service:
  pipelines:
    # Traces pipeline
    traces:
      receivers: [otlp]
      processors: [memory_limiter, k8sattributes, filter, tail_sampling, batch]
      exporters: [otlp/tempo]

    # Metrics pipeline
    metrics:
      receivers: [otlp, prometheus, hostmetrics]
      processors: [memory_limiter, k8sattributes, batch]
      exporters: [prometheusremotewrite]

    # Logs pipeline
    logs:
      receivers: [otlp, filelog]
      processors: [memory_limiter, k8sattributes, resource, batch]
      exporters: [loki]

    # K8s events logs pipeline
    logs/k8s-events:
      receivers: [k8s_events]
      processors: [memory_limiter, batch]
      exporters: [loki]
\`\`\`

### Deployment Patterns

\`\`\`
Pattern 1: DaemonSet (Agent)
┌─────────────┐
│   Node 1    │
│ ┌─────────┐ │
│ │Collector│ │ ← Collects logs, host metrics
│ │DaemonSet│ │
│ └─────────┘ │
│ ┌───┐ ┌───┐ │
│ │App│ │App│ │
│ └───┘ └───┘ │
└─────────────┘

Pattern 2: Deployment (Gateway)
┌───────────┐     ┌───────────────┐     ┌─────────┐
│ App Pods  │────→│   Collector   │────→│ Backend │
│ (OTel SDK)│     │  Deployment   │     │(Tempo,  │
└───────────┘     │  (Gateway)    │     │ Prom)   │
                  └───────────────┘     └─────────┘

Pattern 3: Sidecar
┌─────────────────┐
│      Pod        │
│ ┌─────┐ ┌─────┐│
│ │ App │ │OTel ││
│ │     │→│Side ││ ← Sidecar per pod
│ │     │ │car  ││
│ └─────┘ └─────┘│
└─────────────────┘

Pattern 4: Agent + Gateway (recommended)
Nodes                    Central
┌─────────┐         ┌───────────┐     ┌─────────┐
│DaemonSet│────────→│  Gateway  │────→│ Backend │
│(Agent)  │         │Deployment │     │         │
└─────────┘         └───────────┘     └─────────┘
  Local                  Centralized       Storage
  collection             processing
\`\`\`

### Extensions

\`\`\`yaml
extensions:
  health_check:
    endpoint: 0.0.0.0:13133

  pprof:
    endpoint: 0.0.0.0:1777

  zpages:
    endpoint: 0.0.0.0:55679

service:
  extensions: [health_check, pprof, zpages]
\`\`\`

### Common Mistakes

1. **No memory_limiter** — Collector can OOM during traffic spikes
2. **Batch too large** — high latency before exporting
3. **No retry** — data lost on transient backend failures
4. **Single pipeline for everything** — separate by data type (traces, metrics, logs)
5. **Debug exporter in production** — generates excessive logs
6. **Tail sampling without enough memory** — needs to keep traces in memory

## Killer.sh Style Challenge

> **Scenario:** Configure an OTel Collector with: (1) OTLP + filelog receivers, (2) k8sattributes + tail_sampling + batch processors, (3) exporters for Tempo (traces), Mimir (metrics), and Loki (logs), (4) deploy as DaemonSet + Gateway.
`,
  quiz: [
    {
      question: 'What are the three main components of an OTel Collector pipeline?',
      options: [
        'Input, Transform, Output',
        'Receivers, Processors, Exporters',
        'Source, Filter, Sink',
        'Ingress, Middleware, Egress'
      ],
      correct: 1,
      explanation: 'An OTel Collector pipeline consists of: Receivers (data ingress), Processors (transformations), and Exporters (output to backends). Pipelines are defined per signal type (traces, metrics, logs).',
      reference: 'Related concept: Each pipeline can have multiple receivers and exporters.'
    },
    {
      question: 'What is the purpose of the memory_limiter processor?',
      options: [
        'Limit disk usage',
        'Protect the Collector against OOM (Out of Memory) during traffic spikes',
        'Limit the number of traces',
        'Compress data in memory'
      ],
      correct: 1,
      explanation: 'The memory_limiter monitors Collector memory usage and starts rejecting data when the limit is reached, preventing OOM. It should be the FIRST processor in every pipeline.',
      reference: 'Related concept: Configure limit_mib and spike_limit_mib based on the pod available memory.'
    },
    {
      question: 'What is the difference between tail_sampling and head-based sampling?',
      options: [
        'There is no difference',
        'Head-based decides at the start (SDK); tail-based decides after the trace completes (Collector), allowing error retention',
        'Tail sampling is faster',
        'Head sampling works at the Collector'
      ],
      correct: 1,
      explanation: 'Head-based (SDK) decides BEFORE the trace — fast but does not know the outcome. Tail-based (Collector) waits for the trace to complete — can retain 100% of errors and slow traces, but requires more memory.',
      reference: 'Related concept: Use head-based in the SDK (10%) + tail-based in the Collector (retain errors).'
    },
    {
      question: 'Which receiver collects container logs in Kubernetes?',
      options: [
        'otlp',
        'filelog (reading /var/log/pods/*/*/*.log)',
        'prometheus',
        'hostmetrics'
      ],
      correct: 1,
      explanation: 'The filelog receiver reads log files from disk. In Kubernetes, container logs are stored at /var/log/pods/. Used with DaemonSet to collect logs from all pods on the node.',
      reference: 'Related concept: Use operators (container, json_parser) to parse structured logs.'
    },
    {
      question: 'What is the recommended deployment pattern for the OTel Collector?',
      options: [
        'Sidecar only',
        'Agent (DaemonSet) + Gateway (Deployment) — local collection and centralized processing',
        'Central Deployment only',
        'One per namespace'
      ],
      correct: 1,
      explanation: 'Agent (DaemonSet) collects logs and metrics locally on each node. Gateway (Deployment) centralizes processing (tail sampling, enrichment) and exports to backends. Combines local efficiency with centralized processing.',
      reference: 'Related concept: Agent is lightweight (no heavy processing), Gateway has more resources for processing.'
    },
    {
      question: 'What does the k8sattributes processor do?',
      options: [
        'Creates Kubernetes resources',
        'Enriches telemetry with Kubernetes metadata (pod name, namespace, deployment, labels)',
        'Filters data by namespace',
        'Exports to Kubernetes API'
      ],
      correct: 1,
      explanation: 'The k8sattributes processor queries the Kubernetes API to add metadata such as k8s.pod.name, k8s.namespace.name, k8s.deployment.name, and custom labels to telemetry data.',
      reference: 'Related concept: Requires a ServiceAccount with read permission on the K8s API.'
    },
    {
      question: 'Which exporter sends metrics in Prometheus format?',
      options: [
        'otlp',
        'prometheusremotewrite',
        'debug',
        'loki'
      ],
      correct: 1,
      explanation: 'The prometheusremotewrite exporter sends metrics via the Prometheus Remote Write protocol to backends like Prometheus, Mimir, Thanos, or Cortex. It is the standard for integrating OTel with the Prometheus ecosystem.',
      reference: 'Related concept: resource_to_telemetry_conversion converts resource attributes to Prometheus labels.'
    }
  ],
  flashcards: [
    {
      front: 'What are the components of an OTel Collector pipeline?',
      back: '**Receivers:** Where data enters\n- otlp (gRPC/HTTP)\n- filelog (log files)\n- prometheus (scraping)\n- hostmetrics (CPU, mem, disk)\n- k8s_events\n\n**Processors:** Transformations\n- memory_limiter (OOM protection)\n- batch (grouping)\n- k8sattributes (K8s metadata)\n- filter (remove data)\n- tail_sampling (sampling)\n\n**Exporters:** Where data goes\n- otlp (Tempo, Jaeger)\n- prometheusremotewrite (Prometheus)\n- loki (logs)\n- debug (development)'
    },
    {
      front: 'What are the Collector deployment patterns?',
      back: '**1. DaemonSet (Agent):**\n- One per node\n- Collects logs and host metrics\n- Lightweight, no heavy processing\n\n**2. Deployment (Gateway):**\n- Centralized\n- Heavy processing (tail sampling)\n- Scales horizontally\n\n**3. Sidecar:**\n- One per pod\n- Full isolation\n- More resources consumed\n\n**4. Agent + Gateway (RECOMMENDED):**\n- DaemonSet for local collection\n- Deployment for central processing\n- Best of both worlds'
    },
    {
      front: 'How does the tail_sampling processor work?',
      back: '**Tail-based sampling** decides AFTER the trace completes.\n\n**Configuration:**\n- decision_wait: time to wait for spans\n- num_traces: max traces in memory\n- policies: sampling rules\n\n**Common policies:**\n- status_code: ERROR → retain 100%\n- latency: > 1000ms → retain\n- probabilistic: 10% of the rest\n\n**Advantage:** Keep all errors and slow traces.\n\n**Cost:** Requires memory for pending traces.\n\n**Where to run:** Gateway (Deployment), NOT on the Agent.'
    },
    {
      front: 'How does the filelog receiver collect logs in Kubernetes?',
      back: '**Configuration:**\n\`\`\`yaml\nfilelog:\n  include:\n    - /var/log/pods/*/*/*.log\n  operators:\n    - type: container\n    - type: json_parser\n    - type: severity_parser\n\`\`\`\n\n**Deploy:** DaemonSet with volume mount of /var/log/pods\n\n**Operators:**\n- container: parses container log format\n- json_parser: parses JSON\n- severity_parser: extracts log level\n\n**Advantage over Fluentd/Fluent Bit:**\nNative OTel, correlation with traces.'
    },
    {
      front: 'What does the k8sattributes processor add?',
      back: '**Metadata added:**\n- k8s.namespace.name\n- k8s.pod.name\n- k8s.pod.uid\n- k8s.deployment.name\n- k8s.node.name\n- Custom labels (app, version)\n\n**How it works:**\n1. Receives telemetry with pod IP\n2. Queries K8s API for metadata\n3. Adds as resource attributes\n\n**Requirements:**\n- ServiceAccount with read access\n- ClusterRole: pods, namespaces, nodes\n\n**Benefit:** All signals enriched with K8s context.'
    },
    {
      front: 'Which processors are mandatory in production?',
      back: '**1. memory_limiter (FIRST in pipeline):**\n- Protects against OOM\n- limit_mib based on pod memory\n- spike_limit_mib for spikes\n\n**2. batch:**\n- Groups data for efficient delivery\n- timeout: 5s (max wait)\n- send_batch_size: 1024\n\n**Recommended:**\n- k8sattributes (K8s metadata)\n- resource (add env, cluster)\n- filter (remove health checks)\n\n**Pipeline order:**\nmemory_limiter → k8sattributes → filter → batch'
    },
    {
      front: 'How to send data to multiple backends?',
      back: '**One exporter per backend:**\n\`\`\`yaml\nexporters:\n  otlp/tempo:\n    endpoint: tempo:4317\n  otlp/jaeger:\n    endpoint: jaeger:4317\n  prometheusremotewrite:\n    endpoint: http://mimir:9090/api/v1/write\n\`\`\`\n\n**Pipeline with multiple exporters:**\n\`\`\`yaml\npipelines:\n  traces:\n    exporters: [otlp/tempo, otlp/jaeger]\n  metrics:\n    exporters: [prometheusremotewrite]\n\`\`\`\n\n**Use names with / to differentiate:**\notlp/tempo, otlp/jaeger, otlphttp/datadog'
    }
  ],
  lab: {
    scenario: 'You need to configure a full OTel Collector with pipelines for traces, metrics, and logs on Kubernetes.',
    objective: 'Learn how to configure receivers, processors, and exporters for the OTel Collector and deploy it on Kubernetes.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Configure Collector with OTLP receiver and traces pipeline',
        instruction: `Create an \`otel-collector-config.yaml\` with:
1. OTLP Receiver (gRPC port 4317 and HTTP port 4318)
2. Processors: memory_limiter (512 MiB) and batch (5s timeout)
3. OTLP Exporter for Tempo at \`tempo.observability:4317\`
4. Traces pipeline connecting everything
5. Health check extension on port 13133`,
        hints: [
          'memory_limiter must be the first processor in the pipeline',
          'Named exporters use / (otlp/tempo)',
          'Extensions are defined in service.extensions'
        ],
        solution: `\`\`\`yaml
# otel-collector-config.yaml
extensions:
  health_check:
    endpoint: 0.0.0.0:13133

receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
    spike_limit_mib: 128

  batch:
    timeout: 5s
    send_batch_size: 1024

exporters:
  otlp/tempo:
    endpoint: tempo.observability:4317
    tls:
      insecure: true

  debug:
    verbosity: basic

service:
  extensions: [health_check]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/tempo, debug]
\`\`\``,
        verify: `\`\`\`bash
# Validate configuration (if otelcol installed)
otelcol validate --config=otel-collector-config.yaml
# Expected output: Config is valid

# Verify structure
grep -E "receivers:|processors:|exporters:|pipelines:" otel-collector-config.yaml
# Expected output: all sections present

# Verify memory_limiter comes before batch
grep -A5 "traces:" otel-collector-config.yaml | grep "processors:"
# Expected output: [memory_limiter, batch]
\`\`\``
      },
      {
        title: 'Add metrics and logs pipelines',
        instruction: `Expand the configuration to include:
1. **Prometheus** receiver that scrapes pods with annotation prometheus.io/scrape=true
2. **Filelog** receiver to collect logs from /var/log/pods
3. **Prometheusremotewrite** exporter to Mimir at http://mimir.observability:9090/api/v1/write
4. **Loki** exporter to http://loki.observability:3100/loki/api/v1/push
5. Metrics pipeline (otlp + prometheus → prometheusremotewrite)
6. Logs pipeline (otlp + filelog → loki)`,
        hints: [
          'Each pipeline can have multiple receivers',
          'filelog uses include for paths and operators for parsing',
          'All pipelines should have memory_limiter and batch'
        ],
        solution: `\`\`\`yaml
# Add to existing receivers:
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

  prometheus:
    config:
      scrape_configs:
        - job_name: 'k8s-pods'
          kubernetes_sd_configs:
            - role: pod
          relabel_configs:
            - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
              action: keep
              regex: true

  filelog:
    include:
      - /var/log/pods/*/*/*.log
    operators:
      - type: container
        id: container-parser

# Add to exporters:
exporters:
  otlp/tempo:
    endpoint: tempo.observability:4317
    tls:
      insecure: true

  prometheusremotewrite:
    endpoint: http://mimir.observability:9090/api/v1/write

  loki:
    endpoint: http://loki.observability:3100/loki/api/v1/push

  debug:
    verbosity: basic

# Complete pipelines:
service:
  extensions: [health_check]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/tempo]

    metrics:
      receivers: [otlp, prometheus]
      processors: [memory_limiter, batch]
      exporters: [prometheusremotewrite]

    logs:
      receivers: [otlp, filelog]
      processors: [memory_limiter, batch]
      exporters: [loki]
\`\`\``,
        verify: `\`\`\`bash
# Verify all 3 pipelines are defined
grep -c "receivers:" otel-collector-config.yaml
# Expected output: 4 (1 global + 3 in pipelines)

# Verify receivers per pipeline
grep -A3 "traces:" otel-collector-config.yaml
grep -A3 "metrics:" otel-collector-config.yaml
grep -A3 "logs:" otel-collector-config.yaml
# Expected output: each pipeline with its receivers and exporters
\`\`\``
      },
      {
        title: 'Deploy Collector as DaemonSet on Kubernetes',
        instruction: `Create the Kubernetes manifest to deploy the OTel Collector as a DaemonSet:
1. Namespace: observability
2. ConfigMap with the collector configuration
3. DaemonSet with image otel/opentelemetry-collector-contrib:latest
4. Volume mounts for config and /var/log/pods (for filelog)
5. ServiceAccount with permissions for K8s API
6. Service exposing ports 4317 and 4318`,
        hints: [
          'ConfigMap mounts the config at /etc/otelcol-contrib/',
          'hostPath volume for /var/log/pods (readOnly)',
          'ServiceAccount needs ClusterRole for pods, namespaces, nodes'
        ],
        solution: `\`\`\`yaml
apiVersion: v1
kind: Namespace
metadata:
  name: observability
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-config
  namespace: observability
data:
  config.yaml: |
    # (configuration content from previous steps)
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
      filelog:
        include:
          - /var/log/pods/*/*/*.log
        operators:
          - type: container
    processors:
      memory_limiter:
        check_interval: 1s
        limit_mib: 512
        spike_limit_mib: 128
      batch:
        timeout: 5s
    exporters:
      otlp/tempo:
        endpoint: tempo.observability:4317
        tls:
          insecure: true
      debug:
        verbosity: basic
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [otlp/tempo]
        logs:
          receivers: [filelog]
          processors: [memory_limiter, batch]
          exporters: [debug]
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: otel-collector-agent
  namespace: observability
spec:
  selector:
    matchLabels:
      app: otel-collector-agent
  template:
    metadata:
      labels:
        app: otel-collector-agent
    spec:
      serviceAccountName: otel-collector
      containers:
        - name: collector
          image: otel/opentelemetry-collector-contrib:0.96.0
          args: ["--config=/etc/otelcol-contrib/config.yaml"]
          ports:
            - containerPort: 4317
              name: otlp-grpc
            - containerPort: 4318
              name: otlp-http
            - containerPort: 13133
              name: health
          volumeMounts:
            - name: config
              mountPath: /etc/otelcol-contrib/
            - name: varlogpods
              mountPath: /var/log/pods
              readOnly: true
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /
              port: 13133
          readinessProbe:
            httpGet:
              path: /
              port: 13133
      volumes:
        - name: config
          configMap:
            name: otel-collector-config
        - name: varlogpods
          hostPath:
            path: /var/log/pods
---
apiVersion: v1
kind: Service
metadata:
  name: otel-collector
  namespace: observability
spec:
  selector:
    app: otel-collector-agent
  ports:
    - name: otlp-grpc
      port: 4317
      targetPort: 4317
    - name: otlp-http
      port: 4318
      targetPort: 4318
\`\`\``,
        verify: `\`\`\`bash
# Apply manifests
kubectl apply -f otel-collector-daemonset.yaml

# Verify DaemonSet
kubectl get daemonset -n observability otel-collector-agent
# Expected output: DESIRED = CURRENT = READY (1 per node)

# Verify pods
kubectl get pods -n observability -l app=otel-collector-agent
# Expected output: pods Running on each node

# Verify health
kubectl exec -n observability ds/otel-collector-agent -- wget -qO- http://localhost:13133/
# Expected output: {"status":"Server available"...}

# Verify service
kubectl get svc -n observability otel-collector
# Expected output: ports 4317 and 4318
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Collector restarts with OOM (Out of Memory)',
      difficulty: 'medium',
      symptom: 'The OTel Collector pod restarts frequently with OOMKilled status. Logs show memory usage spikes.',
      diagnosis: `\`\`\`bash
# 1. Check if memory_limiter is configured
kubectl get configmap otel-collector-config -n observability -o yaml | grep memory_limiter

# 2. Check pod memory limits
kubectl describe pod -n observability -l app=otel-collector | grep -A3 "Limits:"

# 3. Check if tail_sampling is enabled
# Tail sampling keeps traces in memory — high consumption
kubectl get configmap otel-collector-config -n observability -o yaml | grep tail_sampling

# 4. Check received data volume
kubectl logs -n observability -l app=otel-collector | grep "spans\\|metrics\\|logs" | tail -10
\`\`\``,
      solution: `**Causes and solutions:**

1. **memory_limiter not configured:** Add memory_limiter as the FIRST processor in ALL pipelines. Set limit_mib = 80% of pod memory limit.

2. **Tail sampling with too many traces:** Reduce num_traces or decision_wait. Or move tail sampling to a Gateway with more memory.

3. **Batch too large:** Reduce send_batch_max_size. Default 8192 may be too much.

4. **Data volume too high:** Add filter processor to remove health checks and unnecessary metrics. Enable sampling in the SDK (head-based) to reduce volume.

5. **Increase resources:** If volume is legitimate, increase pod memory limits and memory_limiter proportionally.`
    },
    {
      title: 'Metrics not appearing in Prometheus/Mimir',
      difficulty: 'medium',
      symptom: 'The Collector receives metrics via OTLP but they do not appear in Prometheus or Mimir. No errors in Collector logs.',
      diagnosis: `\`\`\`bash
# 1. Check if exporter is correct
kubectl get configmap otel-collector-config -n observability -o yaml | grep prometheusremotewrite -A5

# 2. Check backend connectivity
kubectl exec -n observability ds/otel-collector-agent -- wget -qO- http://mimir.observability:9090/ready

# 3. Check Collector internal metrics
kubectl exec -n observability ds/otel-collector-agent -- wget -qO- http://localhost:8888/metrics | grep exporter

# 4. Check if metrics pipeline exists
kubectl get configmap otel-collector-config -n observability -o yaml | grep -A5 "metrics:"
\`\`\``,
      solution: `**Causes and solutions:**

1. **Metrics pipeline missing:** Verify that a metrics: pipeline exists in service.pipelines with the correct exporter.

2. **Incorrect endpoint:** prometheusremotewrite requires /api/v1/write in the endpoint. Check the full URL.

3. **Authentication:** If the backend requires authentication (Mimir multi-tenant), add headers: X-Scope-OrgID.

4. **Resource to telemetry:** Enable resource_to_telemetry_conversion: enabled: true to convert resource attributes to Prometheus labels.

5. **Incompatible format:** Verify the backend supports Prometheus Remote Write. Not all Prometheus backends support it.`
    },
    {
      title: 'Filelog receiver does not collect logs from new pods',
      difficulty: 'hard',
      symptom: 'The filelog receiver collects logs from existing pods but does not detect logs from newly created pods.',
      diagnosis: `\`\`\`bash
# 1. Check if /var/log/pods volume is mounted
kubectl exec -n observability ds/otel-collector-agent -- ls /var/log/pods/
# Should list pod directories

# 2. Check permissions
kubectl exec -n observability ds/otel-collector-agent -- ls -la /var/log/pods/NAMESPACE_PODNAME/

# 3. Check include pattern
# /var/log/pods/*/*/*.log should cover new pods

# 4. Check collector logs for filelog errors
kubectl logs -n observability -l app=otel-collector | grep -i "filelog\\|error" | tail -20

# 5. Check if the new pod is on the same node as the DaemonSet
kubectl get pods -o wide | grep NEW_POD_NAME
\`\`\``,
      solution: `**Causes and solutions:**

1. **Volume not updated:** The hostPath /var/log/pods must be mounted without subPath. New pods create new subdirectories that should be visible automatically.

2. **Pattern too restrictive:** Verify the include pattern is generic enough: /var/log/pods/*/*/*.log (3 levels: namespace_pod/container/*.log).

3. **Poll interval:** The filelog receiver uses polling. If poll_interval is too high, new logs take time to appear. Default is 200ms.

4. **Start position:** If start_at: end (default), only collects NEW logs after the Collector starts. For old logs, use start_at: beginning (beware of volume).

5. **Different node:** DaemonSet only collects logs from the node it runs on. Verify the new pod is on the same node. If the DaemonSet is not on all nodes, check tolerations.`
    }
  ]
};
