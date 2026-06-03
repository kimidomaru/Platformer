window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['opentelemetry/otel-k8s'] = {
  theory: `
# OpenTelemetry on Kubernetes

## Relevance
Integrating OpenTelemetry natively into Kubernetes is essential for modern observability. The OTel Operator simplifies Collector deployment and management and automatic instrumentation via CRDs, while the backend ecosystem (Jaeger, Tempo, Loki, Prometheus) completes the observability stack.

## Core Concepts

### OTel Operator for Kubernetes

The OpenTelemetry Operator is a Kubernetes Operator that manages:
- **OpenTelemetryCollector** CRD — Collector deployment and configuration
- **Instrumentation** CRD — application auto-instrumentation
- Automatic sidecar injection

\`\`\`yaml
# OTel Operator installation via Helm
# helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
# helm install otel-operator open-telemetry/opentelemetry-operator \\
#   --namespace opentelemetry-operator-system \\
#   --create-namespace \\
#   --set manager.collectorImage.repository=otel/opentelemetry-collector-contrib
\`\`\`

### OpenTelemetryCollector CRD

\`\`\`yaml
apiVersion: opentelemetry.io/v1beta1
kind: OpenTelemetryCollector
metadata:
  name: otel-collector
  namespace: observability
spec:
  mode: daemonset    # daemonset | deployment | statefulset | sidecar
  image: otel/opentelemetry-collector-contrib:0.96.0
  resources:
    limits:
      cpu: 500m
      memory: 512Mi
    requests:
      cpu: 100m
      memory: 256Mi
  env:
    - name: K8S_NODE_NAME
      valueFrom:
        fieldRef:
          fieldPath: spec.nodeName
  volumes:
    - name: varlogpods
      hostPath:
        path: /var/log/pods
  volumeMounts:
    - name: varlogpods
      mountPath: /var/log/pods
      readOnly: true
  config:
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
            id: container-parser
    processors:
      memory_limiter:
        check_interval: 1s
        limit_mib: 400
        spike_limit_mib: 100
      batch:
        timeout: 5s
        send_batch_size: 1024
      k8sattributes:
        auth_type: "serviceAccount"
        extract:
          metadata:
            - k8s.namespace.name
            - k8s.pod.name
            - k8s.pod.uid
            - k8s.deployment.name
            - k8s.node.name
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
          processors: [memory_limiter, k8sattributes, batch]
          exporters: [otlp/tempo]
        logs:
          receivers: [filelog]
          processors: [memory_limiter, k8sattributes, batch]
          exporters: [debug]
\`\`\`

### Collector Deploy Modes

| Mode | CRD spec.mode | Use Case | Scale |
|------|--------------|----------|-------|
| DaemonSet | \`daemonset\` | Log/metric collection per node | 1 per node |
| Deployment | \`deployment\` | Centralized gateway, tail sampling | HPA |
| StatefulSet | \`statefulset\` | Stateful processing (tail sampling) | PVC |
| Sidecar | \`sidecar\` | Automatic injection per pod | 1 per pod |

### Auto-Instrumentation

The Operator automatically injects OTel agents into pods via admission webhook:

\`\`\`yaml
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: auto-instrumentation
  namespace: default
spec:
  exporter:
    endpoint: http://otel-collector.observability:4317
  propagators:
    - tracecontext
    - baggage
    - b3
  sampler:
    type: parentbased_traceidratio
    argument: "0.25"   # 25% sampling
  # Per-language configuration
  java:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-java:latest
    env:
      - name: OTEL_INSTRUMENTATION_JDBC_ENABLED
        value: "true"
      - name: OTEL_INSTRUMENTATION_KAFKA_ENABLED
        value: "true"
  python:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-python:latest
  nodejs:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-nodejs:latest
  dotnet:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-dotnet:latest
  go:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-go:latest
\`\`\`

### Auto-Instrumentation Annotations

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-java-app
spec:
  template:
    metadata:
      annotations:
        # Activate auto-instrumentation per language
        instrumentation.opentelemetry.io/inject-java: "true"
        # Or for other languages:
        # instrumentation.opentelemetry.io/inject-python: "true"
        # instrumentation.opentelemetry.io/inject-nodejs: "true"
        # instrumentation.opentelemetry.io/inject-dotnet: "true"
        # instrumentation.opentelemetry.io/inject-go: "true"
        #
        # Reference specific Instrumentation:
        # instrumentation.opentelemetry.io/inject-java: "my-namespace/my-instrumentation"
    spec:
      containers:
        - name: app
          image: my-java-app:latest
          # The Operator automatically injects:
          # - Init container with OTel agent
          # - OTEL_* environment variables
          # - Volume mounts for the agent
\`\`\`

**What the Operator automatically injects:**

\`\`\`yaml
# After injection, the pod will have:
spec:
  initContainers:
    - name: opentelemetry-auto-instrumentation-java
      image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-java:latest
      command: [cp, /javaagent.jar, /otel-auto-instrumentation-java/javaagent.jar]
      volumeMounts:
        - name: opentelemetry-auto-instrumentation-java
          mountPath: /otel-auto-instrumentation-java
  containers:
    - name: app
      env:
        - name: JAVA_TOOL_OPTIONS
          value: "-javaagent:/otel-auto-instrumentation-java/javaagent.jar"
        - name: OTEL_SERVICE_NAME
          value: "my-java-app"
        - name: OTEL_EXPORTER_OTLP_ENDPOINT
          value: "http://otel-collector.observability:4317"
        - name: OTEL_RESOURCE_ATTRIBUTES_POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: OTEL_RESOURCE_ATTRIBUTES_NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        - name: OTEL_TRACES_SAMPLER
          value: "parentbased_traceidratio"
        - name: OTEL_TRACES_SAMPLER_ARG
          value: "0.25"
      volumeMounts:
        - name: opentelemetry-auto-instrumentation-java
          mountPath: /otel-auto-instrumentation-java
\`\`\`

### K8s Attributes Processor — Enrichment

\`\`\`yaml
processors:
  k8sattributes:
    auth_type: "serviceAccount"
    passthrough: false
    filter:
      node_from_env_var: K8S_NODE_NAME
    extract:
      metadata:
        - k8s.namespace.name
        - k8s.pod.name
        - k8s.pod.uid
        - k8s.pod.start_time
        - k8s.deployment.name
        - k8s.statefulset.name
        - k8s.daemonset.name
        - k8s.cronjob.name
        - k8s.job.name
        - k8s.node.name
        - k8s.container.name
        - container.id
        - container.image.name
        - container.image.tag
      labels:
        - tag_name: app
          key: app.kubernetes.io/name
        - tag_name: version
          key: app.kubernetes.io/version
        - tag_name: component
          key: app.kubernetes.io/component
      annotations:
        - tag_name: team
          key: team
    pod_association:
      - sources:
          - from: resource_attribute
            name: k8s.pod.ip
      - sources:
          - from: resource_attribute
            name: k8s.pod.uid
      - sources:
          - from: connection
\`\`\`

**Required RBAC:**

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: otel-collector-k8s-reader
rules:
  - apiGroups: [""]
    resources: ["pods", "namespaces", "nodes"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets", "daemonsets", "replicasets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: otel-collector-k8s-reader
subjects:
  - kind: ServiceAccount
    name: otel-collector
    namespace: observability
roleRef:
  kind: ClusterRole
  name: otel-collector-k8s-reader
  apiGroup: rbac.authorization.k8s.io
\`\`\`

### Backend Stack — Traces

\`\`\`yaml
# Jaeger — trace visualization
# Deploy via Jaeger Operator or Helm
# helm install jaeger jaegertracing/jaeger \\
#   --namespace observability \\
#   --set collector.service.otlp.grpc.name=otlp-grpc \\
#   --set collector.service.otlp.grpc.port=4317

# Collector exporter:
exporters:
  otlp/jaeger:
    endpoint: jaeger-collector.observability:4317
    tls:
      insecure: true
\`\`\`

\`\`\`yaml
# Grafana Tempo — scalable trace backend
# Deploy via Helm
# helm install tempo grafana/tempo-distributed \\
#   --namespace observability

# Collector exporter:
exporters:
  otlp/tempo:
    endpoint: tempo-distributor.observability:4317
    tls:
      insecure: true
\`\`\`

### Backend Stack — Metrics and Logs

\`\`\`yaml
# Prometheus/Mimir — metrics
exporters:
  prometheusremotewrite:
    endpoint: http://mimir-distributor.observability:8080/api/v1/push
    resource_to_telemetry_conversion:
      enabled: true
    headers:
      X-Scope-OrgID: "production"

# Grafana Loki — logs
exporters:
  loki:
    endpoint: http://loki-gateway.observability:3100/loki/api/v1/push
    default_labels_enabled:
      exporter: false
      job: true
      instance: true
      level: true
\`\`\`

### Complete Architecture on Kubernetes

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                        │
│                                                             │
│  ┌──────────────────────────────────────────────┐           │
│  │              Application Pods                 │           │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐      │           │
│  │  │Java App │  │Node App │  │Python   │      │           │
│  │  │+OTel    │  │+OTel    │  │App+OTel │      │           │
│  │  │Agent    │  │Agent    │  │Agent    │      │           │
│  │  └────┬────┘  └────┬────┘  └────┬────┘      │           │
│  └───────┼─────────────┼───────────┼────────────┘           │
│          │  OTLP/gRPC  │           │                        │
│          ▼             ▼           ▼                        │
│  ┌──────────────────────────────────────────────┐           │
│  │         OTel Collector DaemonSet (Agent)      │           │
│  │  - Receives OTLP from apps                    │           │
│  │  - Collects filelog (/var/log/pods)            │           │
│  │  - Collects hostmetrics                        │           │
│  │  - Enriches with k8sattributes                │           │
│  └─────────────────────┬────────────────────────┘           │
│                        │ OTLP/gRPC                          │
│                        ▼                                    │
│  ┌──────────────────────────────────────────────┐           │
│  │       OTel Collector Deployment (Gateway)     │           │
│  │  - Tail sampling                              │           │
│  │  - Advanced filtering                         │           │
│  │  - Tenant routing                             │           │
│  └──────┬──────────────┬───────────────┬────────┘           │
│         │              │               │                    │
│         ▼              ▼               ▼                    │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐              │
│  │  Tempo   │  │ Prometheus/  │  │   Loki   │              │
│  │ (traces) │  │ Mimir        │  │  (logs)  │              │
│  └──────────┘  │ (metrics)    │  └──────────┘              │
│                └──────────────┘                             │
│                        │                                    │
│                        ▼                                    │
│                 ┌──────────┐                                │
│                 │ Grafana  │                                │
│                 │Dashboard │                                │
│                 └──────────┘                                │
└─────────────────────────────────────────────────────────────┘
\`\`\`

### Agent + Gateway Configuration

\`\`\`yaml
# Agent (DaemonSet) — lightweight config
apiVersion: opentelemetry.io/v1beta1
kind: OpenTelemetryCollector
metadata:
  name: otel-agent
  namespace: observability
spec:
  mode: daemonset
  config:
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
      hostmetrics:
        collection_interval: 30s
        scrapers:
          cpu: {}
          memory: {}
          disk: {}
    processors:
      memory_limiter:
        check_interval: 1s
        limit_mib: 400
        spike_limit_mib: 100
      k8sattributes:
        auth_type: "serviceAccount"
        extract:
          metadata:
            - k8s.namespace.name
            - k8s.pod.name
            - k8s.deployment.name
            - k8s.node.name
      batch:
        timeout: 5s
    exporters:
      otlp/gateway:
        endpoint: otel-gateway-collector.observability:4317
        tls:
          insecure: true
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, k8sattributes, batch]
          exporters: [otlp/gateway]
        metrics:
          receivers: [otlp, hostmetrics]
          processors: [memory_limiter, k8sattributes, batch]
          exporters: [otlp/gateway]
        logs:
          receivers: [otlp, filelog]
          processors: [memory_limiter, k8sattributes, batch]
          exporters: [otlp/gateway]
---
# Gateway (Deployment) — centralized processing
apiVersion: opentelemetry.io/v1beta1
kind: OpenTelemetryCollector
metadata:
  name: otel-gateway
  namespace: observability
spec:
  mode: deployment
  replicas: 2
  resources:
    limits:
      cpu: "1"
      memory: 2Gi
    requests:
      cpu: 500m
      memory: 1Gi
  config:
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
    processors:
      memory_limiter:
        check_interval: 1s
        limit_mib: 1536
        spike_limit_mib: 512
      tail_sampling:
        decision_wait: 10s
        num_traces: 100000
        policies:
          - name: errors
            type: status_code
            status_code:
              status_codes: [ERROR]
          - name: slow
            type: latency
            latency:
              threshold_ms: 1000
          - name: probabilistic
            type: probabilistic
            probabilistic:
              sampling_percentage: 10
      filter:
        error_mode: ignore
        traces:
          span:
            - 'attributes["http.target"] == "/healthz"'
            - 'attributes["http.target"] == "/readyz"'
      batch:
        timeout: 5s
        send_batch_size: 2048
    exporters:
      otlp/tempo:
        endpoint: tempo-distributor.observability:4317
        tls:
          insecure: true
      prometheusremotewrite:
        endpoint: http://mimir-distributor.observability:8080/api/v1/push
        resource_to_telemetry_conversion:
          enabled: true
      loki:
        endpoint: http://loki-gateway.observability:3100/loki/api/v1/push
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, filter, tail_sampling, batch]
          exporters: [otlp/tempo]
        metrics:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [prometheusremotewrite]
        logs:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [loki]
\`\`\`

### Sidecar Injection

\`\`\`yaml
# Collector configured as sidecar
apiVersion: opentelemetry.io/v1beta1
kind: OpenTelemetryCollector
metadata:
  name: otel-sidecar
  namespace: default
spec:
  mode: sidecar
  config:
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
    processors:
      batch:
        timeout: 5s
    exporters:
      otlp/gateway:
        endpoint: otel-gateway-collector.observability:4317
        tls:
          insecure: true
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [batch]
          exporters: [otlp/gateway]
---
# Pod with annotation for sidecar injection
apiVersion: v1
kind: Pod
metadata:
  name: my-app
  annotations:
    sidecar.opentelemetry.io/inject: "true"
spec:
  containers:
    - name: app
      image: my-app:latest
      env:
        - name: OTEL_EXPORTER_OTLP_ENDPOINT
          value: "http://localhost:4317"
\`\`\`

### Kubernetes Cluster Receiver

\`\`\`yaml
# Collects Kubernetes cluster metrics
receivers:
  k8s_cluster:
    collection_interval: 30s
    node_conditions_to_report:
      - Ready
      - MemoryPressure
      - DiskPressure
    allocatable_types_to_report:
      - cpu
      - memory
    metadata_collection_interval: 5m

# Collected metrics:
# - k8s.pod.phase
# - k8s.deployment.desired
# - k8s.deployment.available
# - k8s.node.condition
# - k8s.container.cpu_request
# - k8s.container.memory_limit
# - k8s.namespace.phase
\`\`\`

### Common Mistakes

1. **Instrumentation does not inject** — Check correct annotation and Instrumentation CR namespace
2. **Insufficient RBAC** — k8sattributes needs ClusterRole with read on pods, namespaces, nodes
3. **Sidecar does not appear** — Pod must be recreated after creating the Collector CR with sidecar mode
4. **Collector CRD does not accept config** — Check CRD version (v1beta1 uses inline format, not string)
5. **Traces without K8s context** — k8sattributes processor must be enabled in the correct pipeline
6. **OOM on Gateway** — tail_sampling requires significant memory; size appropriately

## Killer.sh Style Challenge

> **Scenario:** Configure a complete OTel stack on Kubernetes with: (1) OTel Operator installed, (2) Collector DaemonSet (agent) with filelog + OTLP + k8sattributes, (3) Collector Deployment (gateway) with tail_sampling, (4) Instrumentation CR to auto-instrument Java apps, (5) export traces to Tempo, metrics to Mimir, and logs to Loki.
`,
  quiz: [
    {
      question: 'What does the OpenTelemetry Operator manage in Kubernetes?',
      options: [
        'Only application deployment',
        'OpenTelemetryCollector CRD (Collectors) and Instrumentation CRD (auto-instrumentation)',
        'Only Prometheus metrics export',
        'Only Envoy sidecar injection'
      ],
      correct: 1,
      explanation: 'The OTel Operator manages two main CRDs: OpenTelemetryCollector (to deploy and configure Collectors in different modes) and Instrumentation (to inject auto-instrumentation into pods via admission webhook).',
      reference: 'Related concept: The Operator also manages sidecar injection and RBAC configuration.'
    },
    {
      question: 'Which annotation activates Java auto-instrumentation in a pod?',
      options: [
        'opentelemetry.io/inject: "java"',
        'instrumentation.opentelemetry.io/inject-java: "true"',
        'otel.io/auto-instrument: "java"',
        'sidecar.opentelemetry.io/inject-java: "true"'
      ],
      correct: 1,
      explanation: 'The annotation instrumentation.opentelemetry.io/inject-java: "true" activates Java auto-instrumentation. The Operator injects an init container with the Java agent and configures JAVA_TOOL_OPTIONS automatically.',
      reference: 'Related concept: Each language has its own annotation: inject-python, inject-nodejs, inject-dotnet, inject-go.'
    },
    {
      question: 'Which deploy modes does the OpenTelemetryCollector CRD support?',
      options: [
        'Only DaemonSet and Deployment',
        'DaemonSet, Deployment, StatefulSet, and Sidecar',
        'Only Sidecar',
        'DaemonSet and ReplicaSet'
      ],
      correct: 1,
      explanation: 'The CRD supports 4 modes via spec.mode: daemonset (agent per node), deployment (gateway), statefulset (stateful processing), and sidecar (per-pod injection).',
      reference: 'Related concept: Agent + Gateway (DaemonSet + Deployment) is the recommended pattern.'
    },
    {
      question: 'What does the k8sattributes processor need to work?',
      options: [
        'Only the pipeline configuration',
        'ServiceAccount with ClusterRole for read on pods, namespaces, and nodes',
        'Root access in the container',
        'Mounting /var/run/secrets'
      ],
      correct: 1,
      explanation: 'The k8sattributes processor queries the Kubernetes API to enrich telemetry. It requires a ServiceAccount with a ClusterRole that allows get/list/watch on pods, namespaces, nodes, deployments.',
      reference: 'Related concept: Use filter.node_from_env_var to limit queries to the local node on DaemonSet.'
    },
    {
      question: 'What is the purpose of the annotation sidecar.opentelemetry.io/inject: "true"?',
      options: [
        'Activate auto-instrumentation',
        'Inject an OTel Collector container as a sidecar in the pod',
        'Export Prometheus metrics',
        'Configure health checks'
      ],
      correct: 1,
      explanation: 'The annotation sidecar.opentelemetry.io/inject: "true" makes the Operator inject a Collector container as a sidecar in the pod. The app sends telemetry to localhost:4317 and the sidecar forwards to the backend.',
      reference: 'Related concept: Different from auto-instrumentation (instrumentation.opentelemetry.io/inject-*).'
    },
    {
      question: 'Which exporter is recommended for sending traces to Grafana Tempo?',
      options: [
        'prometheusremotewrite',
        'otlp (gRPC to the Tempo distributor)',
        'loki',
        'jaeger'
      ],
      correct: 1,
      explanation: 'Tempo natively supports OTLP via gRPC. The otlp exporter with endpoint pointing to the Tempo distributor (port 4317) is the recommended way to send traces.',
      reference: 'Related concept: Use names like otlp/tempo to differentiate from other OTLP exporters.'
    },
    {
      question: 'Which receiver collects Kubernetes cluster metrics (deployments, pods, nodes)?',
      options: [
        'hostmetrics',
        'k8s_cluster',
        'prometheus',
        'otlp'
      ],
      correct: 1,
      explanation: 'The k8s_cluster receiver collects cluster metrics via the Kubernetes API: deployment replicas, pod phases, node conditions, container resource requests/limits. Different from hostmetrics which collects node-level metrics (CPU, memory, disk).',
      reference: 'Related concept: k8s_cluster runs on Deployment, hostmetrics runs on DaemonSet.'
    }
  ],
  flashcards: [
    {
      front: 'What does the OTel Operator do and which CRDs does it manage?',
      back: '**OpenTelemetry Operator** manages OTel on K8s via CRDs:\n\n**1. OpenTelemetryCollector:**\n- Collector deployment\n- Modes: daemonset, deployment, statefulset, sidecar\n- Inline config in CRD\n- Manages Service, RBAC, volumes\n\n**2. Instrumentation:**\n- App auto-instrumentation\n- Supports: Java, Python, Node.js, .NET, Go\n- Injects via admission webhook\n- Configures sampler, propagators, exporter\n\n**Installation:**\nhelm install otel-operator open-telemetry/opentelemetry-operator'
    },
    {
      front: 'How does OTel Operator auto-instrumentation work?',
      back: '**1. Create Instrumentation CR:**\nDefines exporter endpoint, sampler, per-language images\n\n**2. Annotate the Deployment:**\ninstrumentation.opentelemetry.io/inject-java: "true"\n\n**3. The Operator automatically injects:**\n- Init container with OTel agent\n- JAVA_TOOL_OPTIONS with -javaagent\n- OTEL_* variables (service name, endpoint)\n- Volume mount for the agent\n\n**Supported languages:**\n- Java (javaagent)\n- Python (auto-instrumentation)\n- Node.js (auto-instrumentation)\n- .NET (auto-instrumentation)\n- Go (eBPF-based)\n\n**Pod needs to be recreated** after adding the annotation.'
    },
    {
      front: 'What is the difference between sidecar injection and auto-instrumentation?',
      back: '**Sidecar Injection:**\n- Annotation: sidecar.opentelemetry.io/inject: "true"\n- Injects a Collector container in the pod\n- App sends to localhost:4317\n- Sidecar forwards to backend/gateway\n- For apps that already emit OTLP\n\n**Auto-Instrumentation:**\n- Annotation: instrumentation.opentelemetry.io/inject-java: "true"\n- Injects OTel agent into the app\n- Modifies app startup (javaagent, etc)\n- Generates traces/metrics automatically\n- For apps WITHOUT manual instrumentation\n\n**Can be used together:**\nAuto-instrumentation + sidecar collector.'
    },
    {
      front: 'How to configure Agent + Gateway with the OTel Operator?',
      back: '**Agent (DaemonSet):**\n- mode: daemonset\n- Receivers: otlp, filelog, hostmetrics\n- Processors: memory_limiter, k8sattributes, batch\n- Exporter: otlp/gateway (points to gateway)\n- Lightweight, no heavy processing\n\n**Gateway (Deployment):**\n- mode: deployment\n- replicas: 2+\n- Receiver: otlp (receives from agent)\n- Processors: memory_limiter, filter, tail_sampling, batch\n- Exporters: otlp/tempo, prometheusremotewrite, loki\n- More memory for tail_sampling\n\n**Flow:**\nApp → Agent (DaemonSet) → Gateway (Deployment) → Backends'
    },
    {
      front: 'What RBAC does the k8sattributes processor need?',
      back: '**Required ClusterRole:**\n\n\`\`\`yaml\nrules:\n  - apiGroups: [""]\n    resources: [pods, namespaces, nodes]\n    verbs: [get, list, watch]\n  - apiGroups: [apps]\n    resources: [deployments, statefulsets,\n               daemonsets, replicasets]\n    verbs: [get, list, watch]\n  - apiGroups: [batch]\n    resources: [jobs, cronjobs]\n    verbs: [get, list, watch]\n\`\`\`\n\n**DaemonSet optimization:**\nUse filter.node_from_env_var: K8S_NODE_NAME\nto limit watch to the local node.\n\n**The OTel Operator creates RBAC automatically** when spec.mode is set.'
    },
    {
      front: 'Which backends compose an OTel observability stack on K8s?',
      back: '**Traces:**\n- Grafana Tempo (native OTLP, scalable)\n- Jaeger (rich UI, OTLP via collector)\n\n**Metrics:**\n- Prometheus (scraping + remote write)\n- Grafana Mimir (multi-tenant, scalable)\n- Thanos (HA Prometheus)\n\n**Logs:**\n- Grafana Loki (label-based, lightweight)\n- Elasticsearch/OpenSearch (full-text)\n\n**Visualization:**\n- Grafana (dashboards, correlation)\n  - Traces → Logs (via TraceID)\n  - Metrics → Traces (via exemplars)\n\n**OTel Exporters:**\n- otlp → Tempo/Jaeger\n- prometheusremotewrite → Prometheus/Mimir\n- loki → Loki'
    },
    {
      front: 'Which receivers collect data from Kubernetes and the node?',
      back: '**k8s_cluster (Deployment):**\n- Metrics via K8s API\n- Pod phases, deployment replicas\n- Node conditions, resource allocations\n- Collection interval: 30s\n\n**hostmetrics (DaemonSet):**\n- Node metrics\n- CPU, memory, disk, filesystem, network\n- Configurable scrapers\n\n**k8s_events (Deployment):**\n- Kubernetes events\n- Converted to OTel logs\n- Filterable by namespace\n\n**filelog (DaemonSet):**\n- Container logs\n- Path: /var/log/pods/*/*/*.log\n- Operators for parsing\n\n**kubeletstats:**\n- Kubelet metrics\n- Pod/container CPU, memory, network, filesystem'
    }
  ],
  lab: {
    scenario: 'You need to configure a complete OpenTelemetry observability stack on Kubernetes using the OTel Operator, with auto-instrumentation and Grafana backends.',
    objective: 'Learn how to use the OTel Operator to deploy Collectors, configure auto-instrumentation, and integrate with observability backends.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Install OTel Operator and create Collector DaemonSet',
        instruction: `Install the OTel Operator and create an OpenTelemetryCollector in DaemonSet mode:
1. Install the Operator via Helm in the opentelemetry-operator-system namespace
2. Create the observability namespace
3. Create an OpenTelemetryCollector CR with mode: daemonset
4. Configure receivers: otlp (gRPC + HTTP) and filelog
5. Configure processors: memory_limiter, k8sattributes, batch
6. Configure otlp exporter pointing to a gateway`,
        hints: [
          'Use the Helm chart open-telemetry/opentelemetry-operator',
          'The CRD uses apiVersion: opentelemetry.io/v1beta1',
          'Volumes for /var/log/pods must be defined in spec.volumes and spec.volumeMounts'
        ],
        solution: `\`\`\`bash
# Install OTel Operator
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm install otel-operator open-telemetry/opentelemetry-operator \\
  --namespace opentelemetry-operator-system \\
  --create-namespace \\
  --set manager.collectorImage.repository=otel/opentelemetry-collector-contrib

# Create namespace
kubectl create namespace observability
\`\`\`

\`\`\`yaml
# otel-agent.yaml
apiVersion: opentelemetry.io/v1beta1
kind: OpenTelemetryCollector
metadata:
  name: otel-agent
  namespace: observability
spec:
  mode: daemonset
  image: otel/opentelemetry-collector-contrib:0.96.0
  resources:
    limits:
      cpu: 500m
      memory: 512Mi
    requests:
      cpu: 100m
      memory: 256Mi
  env:
    - name: K8S_NODE_NAME
      valueFrom:
        fieldRef:
          fieldPath: spec.nodeName
  volumes:
    - name: varlogpods
      hostPath:
        path: /var/log/pods
  volumeMounts:
    - name: varlogpods
      mountPath: /var/log/pods
      readOnly: true
  config:
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
            id: container-parser
    processors:
      memory_limiter:
        check_interval: 1s
        limit_mib: 400
        spike_limit_mib: 100
      k8sattributes:
        auth_type: "serviceAccount"
        filter:
          node_from_env_var: K8S_NODE_NAME
        extract:
          metadata:
            - k8s.namespace.name
            - k8s.pod.name
            - k8s.deployment.name
            - k8s.node.name
      batch:
        timeout: 5s
        send_batch_size: 1024
    exporters:
      otlp/gateway:
        endpoint: otel-gateway-collector.observability:4317
        tls:
          insecure: true
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, k8sattributes, batch]
          exporters: [otlp/gateway]
        logs:
          receivers: [otlp, filelog]
          processors: [memory_limiter, k8sattributes, batch]
          exporters: [otlp/gateway]
\`\`\`

\`\`\`bash
kubectl apply -f otel-agent.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify the Operator is running
kubectl get pods -n opentelemetry-operator-system
# Expected output: otel-operator-... Running

# Verify the Collector CR was created
kubectl get opentelemetrycollectors -n observability
# Expected output: otel-agent with mode DaemonSet

# Verify DaemonSet
kubectl get daemonset -n observability
# Expected output: otel-agent-collector with DESIRED = CURRENT = READY

# Verify agent pods
kubectl get pods -n observability -l app.kubernetes.io/name=otel-agent-collector
# Expected output: pods Running on each node
\`\`\``
      },
      {
        title: 'Create Collector Gateway and configure auto-instrumentation',
        instruction: `Create:
1. OpenTelemetryCollector in deployment mode as Gateway (2 replicas)
2. Configure tail_sampling on the Gateway (keep errors and traces > 1s)
3. Exporters for Tempo (traces), Mimir (metrics), and Loki (logs)
4. Instrumentation CR to auto-instrument Java and Python apps
5. Configure parentbased_traceidratio sampler at 25%`,
        hints: [
          'The Gateway receives from the Agent via OTLP',
          'tail_sampling needs more memory — size appropriately',
          'Instrumentation CR defines per-language configuration'
        ],
        solution: `\`\`\`yaml
# otel-gateway.yaml
apiVersion: opentelemetry.io/v1beta1
kind: OpenTelemetryCollector
metadata:
  name: otel-gateway
  namespace: observability
spec:
  mode: deployment
  replicas: 2
  resources:
    limits:
      cpu: "1"
      memory: 2Gi
    requests:
      cpu: 500m
      memory: 1Gi
  config:
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
    processors:
      memory_limiter:
        check_interval: 1s
        limit_mib: 1536
        spike_limit_mib: 512
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
      batch:
        timeout: 5s
        send_batch_size: 2048
    exporters:
      otlp/tempo:
        endpoint: tempo-distributor.observability:4317
        tls:
          insecure: true
      prometheusremotewrite:
        endpoint: http://mimir-distributor.observability:8080/api/v1/push
        resource_to_telemetry_conversion:
          enabled: true
      loki:
        endpoint: http://loki-gateway.observability:3100/loki/api/v1/push
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, tail_sampling, batch]
          exporters: [otlp/tempo]
        metrics:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [prometheusremotewrite]
        logs:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [loki]
---
# auto-instrumentation.yaml
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: auto-instrumentation
  namespace: default
spec:
  exporter:
    endpoint: http://otel-agent-collector.observability:4317
  propagators:
    - tracecontext
    - baggage
  sampler:
    type: parentbased_traceidratio
    argument: "0.25"
  java:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-java:latest
  python:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-python:latest
\`\`\`

\`\`\`bash
kubectl apply -f otel-gateway.yaml
kubectl apply -f auto-instrumentation.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify Gateway
kubectl get opentelemetrycollectors -n observability
# Expected output: otel-agent (DaemonSet) and otel-gateway (Deployment)

kubectl get deployment -n observability otel-gateway-collector
# Expected output: 2/2 READY

# Verify Instrumentation
kubectl get instrumentation -n default
# Expected output: auto-instrumentation

# Verify Instrumentation details
kubectl describe instrumentation auto-instrumentation -n default
# Expected output: Java and Python configured with 25% sampler
\`\`\``
      },
      {
        title: 'Instrument an application and validate telemetry',
        instruction: `Create a test Deployment and validate auto-instrumentation:
1. Create a Deployment with a simple Java app
2. Add the Java auto-instrumentation annotation
3. Verify that the init container and OTEL variables were injected
4. Verify that traces are reaching the Collector`,
        hints: [
          'Use annotation instrumentation.opentelemetry.io/inject-java: "true"',
          'After annotating an existing Deployment, delete pods to force re-injection',
          'Check Collector logs to confirm span reception'
        ],
        solution: `\`\`\`yaml
# test-app.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: java-test-app
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: java-test-app
  template:
    metadata:
      labels:
        app: java-test-app
      annotations:
        instrumentation.opentelemetry.io/inject-java: "true"
    spec:
      containers:
        - name: app
          image: openjdk:17-slim
          command: ["sleep", "infinity"]
          ports:
            - containerPort: 8080
\`\`\`

\`\`\`bash
kubectl apply -f test-app.yaml

# Verify injection
kubectl get pod -l app=java-test-app -o jsonpath='{.items[0].spec.initContainers[*].name}'
# Expected output: opentelemetry-auto-instrumentation-java

# Verify OTEL variables
kubectl get pod -l app=java-test-app -o jsonpath='{.items[0].spec.containers[0].env[*].name}' | tr ' ' '\\n' | grep OTEL
# Expected output: OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_TRACES_SAMPLER, etc

# Verify Collector agent logs
kubectl logs -n observability -l app.kubernetes.io/name=otel-agent-collector --tail=20
\`\`\``,
        verify: `\`\`\`bash
# Verify the pod has the OTel init container
kubectl get pod -l app=java-test-app -o jsonpath='{.items[0].spec.initContainers[0].name}'
# Expected output: opentelemetry-auto-instrumentation-java

# Verify JAVA_TOOL_OPTIONS
kubectl get pod -l app=java-test-app -o jsonpath='{.items[0].spec.containers[0].env}' | grep -o "JAVA_TOOL_OPTIONS"
# Expected output: JAVA_TOOL_OPTIONS

# Verify OTEL_EXPORTER_OTLP_ENDPOINT
kubectl get pod -l app=java-test-app -o jsonpath='{.items[0].spec.containers[0].env}' | grep -o "otel-agent"
# Expected output: containing collector reference

# Verify pod is Running
kubectl get pod -l app=java-test-app
# Expected output: Running 1/1
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Auto-instrumentation does not inject into pod',
      difficulty: 'medium',
      symptom: 'After adding the annotation instrumentation.opentelemetry.io/inject-java: "true" to the Deployment, the pod has no OTel init container and no OTEL variables.',
      diagnosis: `\`\`\`bash
# 1. Check if the Operator is running
kubectl get pods -n opentelemetry-operator-system
# Should have a Running pod

# 2. Check if the Instrumentation CR exists in the app namespace
kubectl get instrumentation -n default
# Should list the CR

# 3. Check if the annotation is correct on the pod (not just the Deployment)
kubectl get pod -l app=my-app -o jsonpath='{.items[0].metadata.annotations}'

# 4. Check Operator logs
kubectl logs -n opentelemetry-operator-system -l app.kubernetes.io/name=opentelemetry-operator | tail -20

# 5. Check webhook
kubectl get mutatingwebhookconfigurations | grep opentelemetry
\`\`\``,
      solution: `**Causes and solutions:**

1. **Instrumentation CR in wrong namespace:** The CR must exist in the SAME namespace as the pod, or specify the namespace in the annotation: instrumentation.opentelemetry.io/inject-java: "namespace/instrumentation-name".

2. **Pod was not recreated:** Injection only happens at pod CREATION time. Run kubectl rollout restart deployment/my-app to force re-injection.

3. **Incorrect annotation:** Verify it is instrumentation.opentelemetry.io/inject-java (not inject-jvm or inject-spring). Each language has its specific annotation.

4. **Webhook not configured:** Verify the Operator MutatingWebhookConfiguration exists. If not, reinstall the Operator.

5. **Version conflict:** Check compatibility between the Operator version and instrumentation images.`
    },
    {
      title: 'K8sattributes shows incorrect or empty metadata',
      difficulty: 'hard',
      symptom: 'The k8sattributes processor is enabled but k8s.pod.name, k8s.namespace.name attributes arrive empty or incorrect in traces.',
      diagnosis: `\`\`\`bash
# 1. Check ServiceAccount RBAC
kubectl auth can-i list pods --as=system:serviceaccount:observability:otel-collector
kubectl auth can-i get namespaces --as=system:serviceaccount:observability:otel-collector

# 2. Check pod_association config
kubectl get configmap -n observability -l app.kubernetes.io/name=otel-agent-collector -o yaml | grep -A10 pod_association

# 3. Check if the app sends resource attributes with pod IP
# Collector logs should show the associated IP
kubectl logs -n observability -l app.kubernetes.io/name=otel-agent-collector | grep "pod_association"

# 4. Check if K8S_NODE_NAME is defined (for DaemonSet)
kubectl get daemonset -n observability -o yaml | grep K8S_NODE_NAME -A3

# 5. Check API Server connectivity
kubectl exec -n observability ds/otel-agent-collector -- wget -qO- https://kubernetes.default.svc/api/v1/namespaces --header "Authorization: Bearer \$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" --no-check-certificate 2>&1 | head -5
\`\`\``,
      solution: `**Causes and solutions:**

1. **Insufficient RBAC:** Create a ClusterRole with get/list/watch on pods, namespaces, nodes, deployments, replicasets. Bind to the Collector ServiceAccount.

2. **Incorrect pod association:** k8sattributes needs to correlate telemetry with pods. If the app does not send k8s.pod.ip as a resource attribute, use pod_association from: connection to use the connection IP.

3. **Missing filter.node_from_env_var on DaemonSet:** Without this, each agent tries to list ALL pods in the cluster. Add K8S_NODE_NAME as an env var and configure filter.node_from_env_var.

4. **Stale cache:** If pods are created quickly, the k8sattributes cache may not have the pod. Check metadata_collection_interval (default 5m may be too high).

5. **Pipeline order:** k8sattributes must come AFTER memory_limiter and BEFORE batch.`
    },
    {
      title: 'Fragmented traces — spans from different services do not correlate',
      difficulty: 'hard',
      symptom: 'Traces appear in Tempo/Jaeger but spans from different services show as separate traces instead of a single distributed trace.',
      diagnosis: `\`\`\`bash
# 1. Check if context propagation is configured
kubectl get instrumentation -n default -o yaml | grep -A3 propagators

# 2. Check propagation headers between services
# In HTTP apps, verify traceparent header is propagated
kubectl logs -l app=service-a | grep -i traceparent

# 3. Check if TraceID is the same between services
# In Tempo/Jaeger, compare TraceIDs
kubectl logs -n observability -l app.kubernetes.io/name=otel-agent-collector | grep "TraceID" | head -5

# 4. Check if sampler is discarding intermediate spans
kubectl get instrumentation -n default -o yaml | grep -A3 sampler

# 5. Check if service mesh (Istio/Linkerd) is interfering
kubectl get pods -l app=my-app -o jsonpath='{.items[0].spec.containers[*].name}'
\`\`\``,
      solution: `**Causes and solutions:**

1. **Propagators not configured:** Verify propagators include tracecontext (W3C) and/or b3 (Zipkin). All services must use the SAME propagation format.

2. **Intermediate service not propagating context:** If a non-instrumented service in the middle of the chain receives and makes new requests without propagating the traceparent header, the trace breaks. Instrument ALL services in the chain.

3. **Inconsistent sampling:** If service A's sampler decides NOT to sample but service B decides to sample, spans do not correlate. Use parentbased_traceidratio so the parent's decision is respected.

4. **Service mesh duplicating headers:** Istio/Linkerd may generate their own spans. Verify they are not creating new TraceIDs. Configure mesh to propagate OTel context.

5. **Clock skew between nodes:** If node clocks are desynchronized, spans may appear out of order. Verify NTP on the nodes.`
    }
  ]
};
