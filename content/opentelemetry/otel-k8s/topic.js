window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['opentelemetry/otel-k8s'] = {
  theory: `
# OpenTelemetry on Kubernetes

## Relevancia
Integrar OpenTelemetry nativamente no Kubernetes e essencial para observabilidade moderna. O OTel Operator simplifica o deployment e gerenciamento de Collectors e instrumentacao automatica via CRDs, enquanto o ecossistema de backends (Jaeger, Tempo, Loki, Prometheus) completa a stack de observabilidade.

## Conceitos Fundamentais

### OTel Operator para Kubernetes

O OpenTelemetry Operator e um Kubernetes Operator que gerencia:
- **OpenTelemetryCollector** CRD — deploy e configuracao de Collectors
- **Instrumentation** CRD — auto-instrumentacao de aplicacoes
- Injeccao de sidecars automatica

\`\`\`yaml
# Instalacao do OTel Operator via Helm
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

### Modos de Deploy do Collector

| Modo | CRD spec.mode | Uso | Escala |
|------|--------------|-----|--------|
| DaemonSet | \`daemonset\` | Coleta de logs/metricas por node | 1 por node |
| Deployment | \`deployment\` | Gateway centralizado, tail sampling | HPA |
| StatefulSet | \`statefulset\` | Processamento com estado (tail sampling) | PVC |
| Sidecar | \`sidecar\` | Injeccao automatica por pod | 1 por pod |

### Auto-Instrumentacao

O Operator injeta automaticamente agentes OTel em pods via webhook de admissao:

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
  # Configuracao por linguagem
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

### Anotacoes para Auto-Instrumentacao

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-java-app
spec:
  template:
    metadata:
      annotations:
        # Ativar auto-instrumentacao por linguagem
        instrumentation.opentelemetry.io/inject-java: "true"
        # Ou para outras linguagens:
        # instrumentation.opentelemetry.io/inject-python: "true"
        # instrumentation.opentelemetry.io/inject-nodejs: "true"
        # instrumentation.opentelemetry.io/inject-dotnet: "true"
        # instrumentation.opentelemetry.io/inject-go: "true"
        #
        # Referenciar Instrumentation especifico:
        # instrumentation.opentelemetry.io/inject-java: "my-namespace/my-instrumentation"
    spec:
      containers:
        - name: app
          image: my-java-app:latest
          # O Operator injeta automaticamente:
          # - Init container com agente OTel
          # - Variaveis de ambiente OTEL_*
          # - Volume mounts para o agente
\`\`\`

**O que o Operator injeta automaticamente:**

\`\`\`yaml
# Apos a injeccao, o pod tera:
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

**RBAC necessario:**

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

### Stack de Backends — Traces

\`\`\`yaml
# Jaeger — trace visualization
# Deploy via Jaeger Operator ou Helm
# helm install jaeger jaegertracing/jaeger \\
#   --namespace observability \\
#   --set collector.service.otlp.grpc.name=otlp-grpc \\
#   --set collector.service.otlp.grpc.port=4317

# Exporter no Collector:
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

# Exporter no Collector:
exporters:
  otlp/tempo:
    endpoint: tempo-distributor.observability:4317
    tls:
      insecure: true
\`\`\`

### Stack de Backends — Metricas e Logs

\`\`\`yaml
# Prometheus/Mimir — metricas
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

### Arquitetura Completa no Kubernetes

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
│  │  - Recebe OTLP das apps                      │           │
│  │  - Coleta filelog (/var/log/pods)             │           │
│  │  - Coleta hostmetrics                         │           │
│  │  - Enriquece com k8sattributes               │           │
│  └─────────────────────┬────────────────────────┘           │
│                        │ OTLP/gRPC                          │
│                        ▼                                    │
│  ┌──────────────────────────────────────────────┐           │
│  │       OTel Collector Deployment (Gateway)     │           │
│  │  - Tail sampling                              │           │
│  │  - Filtragem avancada                         │           │
│  │  - Roteamento por tenant                      │           │
│  └──────┬──────────────┬───────────────┬────────┘           │
│         │              │               │                    │
│         ▼              ▼               ▼                    │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐              │
│  │  Tempo   │  │ Prometheus/  │  │   Loki   │              │
│  │ (traces) │  │ Mimir        │  │  (logs)  │              │
│  └──────────┘  │ (metricas)   │  └──────────┘              │
│                └──────────────┘                             │
│                        │                                    │
│                        ▼                                    │
│                 ┌──────────┐                                │
│                 │ Grafana  │                                │
│                 │Dashboard │                                │
│                 └──────────┘                                │
└─────────────────────────────────────────────────────────────┘
\`\`\`

### Configuracao Agent + Gateway

\`\`\`yaml
# Agent (DaemonSet) — config leve
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
# Gateway (Deployment) — processamento centralizado
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
# Collector configurado como sidecar
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
# Pod com annotation para sidecar injection
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
# Coleta metricas do cluster Kubernetes
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

# Metricas coletadas:
# - k8s.pod.phase
# - k8s.deployment.desired
# - k8s.deployment.available
# - k8s.node.condition
# - k8s.container.cpu_request
# - k8s.container.memory_limit
# - k8s.namespace.phase
\`\`\`

### Erros Comuns

1. **Instrumentacao nao injeta** — Verificar annotation correta e namespace do Instrumentation CR
2. **RBAC insuficiente** — k8sattributes precisa de ClusterRole com read em pods, namespaces, nodes
3. **Sidecar nao aparece** — Pod deve ser recriado apos criar o Collector CR com mode sidecar
4. **Collector CRD nao aceita config** — Verificar versao do CRD (v1beta1 usa formato inline, nao string)
5. **Traces sem contexto K8s** — k8sattributes processor deve estar habilitado no pipeline correto
6. **OOM no Gateway** — tail_sampling requer memoria significativa; dimensionar adequadamente

## Killer.sh Style Challenge

> **Cenario:** Configure uma stack OTel completa no Kubernetes com: (1) OTel Operator instalado, (2) Collector DaemonSet (agent) com filelog + OTLP + k8sattributes, (3) Collector Deployment (gateway) com tail_sampling, (4) Instrumentation CR para auto-instrumentar apps Java, (5) exportar traces para Tempo, metricas para Mimir e logs para Loki.
`,
  quiz: [
    {
      question: 'O que o OpenTelemetry Operator gerencia no Kubernetes?',
      options: [
        'Apenas o deployment de aplicacoes',
        'OpenTelemetryCollector CRD (Collectors) e Instrumentation CRD (auto-instrumentacao)',
        'Apenas exportacao de metricas Prometheus',
        'Apenas injeccao de sidecars Envoy'
      ],
      correct: 1,
      explanation: 'O OTel Operator gerencia dois CRDs principais: OpenTelemetryCollector (para deployar e configurar Collectors em diferentes modos) e Instrumentation (para injetar auto-instrumentacao em pods via webhook de admissao).',
      reference: 'Conceito relacionado: O Operator tambem gerencia a injeccao de sidecars e a configuracao de RBAC.'
    },
    {
      question: 'Qual annotation ativa auto-instrumentacao Java em um pod?',
      options: [
        'opentelemetry.io/inject: "java"',
        'instrumentation.opentelemetry.io/inject-java: "true"',
        'otel.io/auto-instrument: "java"',
        'sidecar.opentelemetry.io/inject-java: "true"'
      ],
      correct: 1,
      explanation: 'A annotation instrumentation.opentelemetry.io/inject-java: "true" ativa a auto-instrumentacao Java. O Operator injeta um init container com o agente Java e configura JAVA_TOOL_OPTIONS automaticamente.',
      reference: 'Conceito relacionado: Cada linguagem tem sua annotation: inject-python, inject-nodejs, inject-dotnet, inject-go.'
    },
    {
      question: 'Quais modos de deploy o OpenTelemetryCollector CRD suporta?',
      options: [
        'Apenas DaemonSet e Deployment',
        'DaemonSet, Deployment, StatefulSet e Sidecar',
        'Apenas Sidecar',
        'DaemonSet e ReplicaSet'
      ],
      correct: 1,
      explanation: 'O CRD suporta 4 modos via spec.mode: daemonset (agent por node), deployment (gateway), statefulset (processamento com estado), e sidecar (injeccao por pod).',
      reference: 'Conceito relacionado: Agent + Gateway (DaemonSet + Deployment) e o padrao recomendado.'
    },
    {
      question: 'O que o k8sattributes processor precisa para funcionar?',
      options: [
        'Apenas a configuracao no pipeline',
        'ServiceAccount com ClusterRole para read de pods, namespaces e nodes',
        'Acesso root no container',
        'Montagem de /var/run/secrets'
      ],
      correct: 1,
      explanation: 'O k8sattributes processor consulta a Kubernetes API para enriquecer telemetria. Requer um ServiceAccount com ClusterRole que permita get/list/watch em pods, namespaces, nodes, deployments.',
      reference: 'Conceito relacionado: Use filter.node_from_env_var para limitar consultas ao node local no DaemonSet.'
    },
    {
      question: 'Para que serve a annotation sidecar.opentelemetry.io/inject: "true"?',
      options: [
        'Ativar auto-instrumentacao',
        'Injetar um container Collector OTel como sidecar no pod',
        'Exportar metricas Prometheus',
        'Configurar health checks'
      ],
      correct: 1,
      explanation: 'A annotation sidecar.opentelemetry.io/inject: "true" faz o Operator injetar um container Collector como sidecar no pod. A app envia telemetria para localhost:4317 e o sidecar encaminha para o backend.',
      reference: 'Conceito relacionado: Diferente de auto-instrumentacao (instrumentation.opentelemetry.io/inject-*).'
    },
    {
      question: 'Qual exporter e recomendado para enviar traces ao Grafana Tempo?',
      options: [
        'prometheusremotewrite',
        'otlp (gRPC para o distributor do Tempo)',
        'loki',
        'jaeger'
      ],
      correct: 1,
      explanation: 'Tempo suporta OTLP nativo via gRPC. O exporter otlp com endpoint apontando para o distributor do Tempo (porta 4317) e a forma recomendada de enviar traces.',
      reference: 'Conceito relacionado: Use nomes como otlp/tempo para diferenciar de outros exporters OTLP.'
    },
    {
      question: 'Qual receiver coleta metricas do cluster Kubernetes (deployments, pods, nodes)?',
      options: [
        'hostmetrics',
        'k8s_cluster',
        'prometheus',
        'otlp'
      ],
      correct: 1,
      explanation: 'O k8s_cluster receiver coleta metricas do cluster via Kubernetes API: deployment replicas, pod phases, node conditions, container resource requests/limits. Diferente do hostmetrics que coleta metricas do node (CPU, memoria, disco).',
      reference: 'Conceito relacionado: k8s_cluster roda em Deployment, hostmetrics roda em DaemonSet.'
    }
  ],
  flashcards: [
    {
      front: 'O que o OTel Operator faz e quais CRDs ele gerencia?',
      back: '**OpenTelemetry Operator** gerencia OTel no K8s via CRDs:\n\n**1. OpenTelemetryCollector:**\n- Deploy de Collectors\n- Modos: daemonset, deployment, statefulset, sidecar\n- Config inline no CRD\n- Gerencia Service, RBAC, volumes\n\n**2. Instrumentation:**\n- Auto-instrumentacao de apps\n- Suporta: Java, Python, Node.js, .NET, Go\n- Injeta via webhook de admissao\n- Configura sampler, propagators, exporter\n\n**Instalacao:**\nhelm install otel-operator open-telemetry/opentelemetry-operator'
    },
    {
      front: 'Como funciona a auto-instrumentacao do OTel Operator?',
      back: '**1. Criar Instrumentation CR:**\nDefine exporter endpoint, sampler, imagens por linguagem\n\n**2. Anotar o Deployment:**\ninstrumentation.opentelemetry.io/inject-java: "true"\n\n**3. O Operator injeta automaticamente:**\n- Init container com agente OTel\n- JAVA_TOOL_OPTIONS com -javaagent\n- Variaveis OTEL_* (service name, endpoint)\n- Volume mount para o agente\n\n**Linguagens suportadas:**\n- Java (javaagent)\n- Python (auto-instrumentation)\n- Node.js (auto-instrumentation)\n- .NET (auto-instrumentation)\n- Go (eBPF-based)\n\n**Pod precisa ser recriado** apos adicionar a annotation.'
    },
    {
      front: 'Qual a diferenca entre sidecar injection e auto-instrumentacao?',
      back: '**Sidecar Injection:**\n- Annotation: sidecar.opentelemetry.io/inject: "true"\n- Injeta um Collector container no pod\n- App envia para localhost:4317\n- Sidecar encaminha para backend/gateway\n- Para apps que ja emitem OTLP\n\n**Auto-Instrumentacao:**\n- Annotation: instrumentation.opentelemetry.io/inject-java: "true"\n- Injeta agente OTel na app\n- Modifica startup da app (javaagent, etc)\n- Gera traces/metricas automaticamente\n- Para apps SEM instrumentacao manual\n\n**Podem ser usados juntos:**\nAuto-instrumentacao + sidecar collector.'
    },
    {
      front: 'Como configurar Agent + Gateway com o OTel Operator?',
      back: '**Agent (DaemonSet):**\n- mode: daemonset\n- Receivers: otlp, filelog, hostmetrics\n- Processors: memory_limiter, k8sattributes, batch\n- Exporter: otlp/gateway (aponta para o gateway)\n- Leve, sem processamento pesado\n\n**Gateway (Deployment):**\n- mode: deployment\n- replicas: 2+\n- Receiver: otlp (recebe do agent)\n- Processors: memory_limiter, filter, tail_sampling, batch\n- Exporters: otlp/tempo, prometheusremotewrite, loki\n- Mais memoria para tail_sampling\n\n**Fluxo:**\nApp → Agent (DaemonSet) → Gateway (Deployment) → Backends'
    },
    {
      front: 'Qual RBAC o k8sattributes processor precisa?',
      back: '**ClusterRole necessario:**\n\n\`\`\`yaml\nrules:\n  - apiGroups: [""]\n    resources: [pods, namespaces, nodes]\n    verbs: [get, list, watch]\n  - apiGroups: [apps]\n    resources: [deployments, statefulsets,\n               daemonsets, replicasets]\n    verbs: [get, list, watch]\n  - apiGroups: [batch]\n    resources: [jobs, cronjobs]\n    verbs: [get, list, watch]\n\`\`\`\n\n**Otimizacao DaemonSet:**\nUsar filter.node_from_env_var: K8S_NODE_NAME\npara limitar watch ao node local.\n\n**O OTel Operator cria RBAC automaticamente** quando spec.mode e definido.'
    },
    {
      front: 'Quais backends compoe uma stack de observabilidade OTel no K8s?',
      back: '**Traces:**\n- Grafana Tempo (OTLP nativo, escalavel)\n- Jaeger (UI rica, OTLP via collector)\n\n**Metricas:**\n- Prometheus (scraping + remote write)\n- Grafana Mimir (multi-tenant, escalavel)\n- Thanos (HA Prometheus)\n\n**Logs:**\n- Grafana Loki (label-based, leve)\n- Elasticsearch/OpenSearch (full-text)\n\n**Visualizacao:**\n- Grafana (dashboards, correlacao)\n  - Traces → Logs (via TraceID)\n  - Metricas → Traces (via exemplars)\n\n**Exporters OTel:**\n- otlp → Tempo/Jaeger\n- prometheusremotewrite → Prometheus/Mimir\n- loki → Loki'
    },
    {
      front: 'Quais receivers coletar dados do Kubernetes e do node?',
      back: '**k8s_cluster (Deployment):**\n- Metricas via K8s API\n- Pod phases, deployment replicas\n- Node conditions, resource allocations\n- Collection interval: 30s\n\n**hostmetrics (DaemonSet):**\n- Metricas do node\n- CPU, memoria, disco, filesystem, rede\n- Scrapers configuraveis\n\n**k8s_events (Deployment):**\n- Eventos do Kubernetes\n- Convertidos em logs OTel\n- Filtravel por namespace\n\n**filelog (DaemonSet):**\n- Logs de containers\n- Path: /var/log/pods/*/*/*.log\n- Operators para parsing\n\n**kubeletstats:**\n- Metricas do kubelet\n- Pod/container CPU, memoria, rede, filesystem'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar uma stack completa de observabilidade OpenTelemetry no Kubernetes usando o OTel Operator, com auto-instrumentacao e backends Grafana.',
    objective: 'Aprender a usar o OTel Operator para deployar Collectors, configurar auto-instrumentacao e integrar com backends de observabilidade.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Instalar OTel Operator e criar Collector DaemonSet',
        instruction: `Instale o OTel Operator e crie um OpenTelemetryCollector em modo DaemonSet:
1. Instalar o Operator via Helm no namespace opentelemetry-operator-system
2. Criar namespace observability
3. Criar OpenTelemetryCollector CR com mode: daemonset
4. Configurar receivers: otlp (gRPC + HTTP) e filelog
5. Configurar processors: memory_limiter, k8sattributes, batch
6. Configurar exporter otlp apontando para um gateway`,
        hints: [
          'Use o Helm chart open-telemetry/opentelemetry-operator',
          'O CRD usa apiVersion: opentelemetry.io/v1beta1',
          'Volumes para /var/log/pods devem ser definidos em spec.volumes e spec.volumeMounts'
        ],
        solution: `\`\`\`bash
# Instalar OTel Operator
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm install otel-operator open-telemetry/opentelemetry-operator \\
  --namespace opentelemetry-operator-system \\
  --create-namespace \\
  --set manager.collectorImage.repository=otel/opentelemetry-collector-contrib

# Criar namespace
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
# Verificar que o Operator esta rodando
kubectl get pods -n opentelemetry-operator-system
# Saida esperada: otel-operator-... Running

# Verificar que o Collector CR foi criado
kubectl get opentelemetrycollectors -n observability
# Saida esperada: otel-agent com mode DaemonSet

# Verificar DaemonSet
kubectl get daemonset -n observability
# Saida esperada: otel-agent-collector com DESIRED = CURRENT = READY

# Verificar pods do agent
kubectl get pods -n observability -l app.kubernetes.io/name=otel-agent-collector
# Saida esperada: pods Running em cada node
\`\`\``
      },
      {
        title: 'Criar Collector Gateway e configurar auto-instrumentacao',
        instruction: `Crie:
1. OpenTelemetryCollector em modo deployment como Gateway (2 replicas)
2. Configurar tail_sampling no Gateway (manter erros e traces > 1s)
3. Exporters para Tempo (traces), Mimir (metricas) e Loki (logs)
4. Instrumentation CR para auto-instrumentar apps Java e Python
5. Configurar sampler parentbased_traceidratio com 25%`,
        hints: [
          'O Gateway recebe do Agent via OTLP',
          'tail_sampling precisa de mais memoria — dimensionar adequadamente',
          'Instrumentation CR define configuracao por linguagem'
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
# Verificar Gateway
kubectl get opentelemetrycollectors -n observability
# Saida esperada: otel-agent (DaemonSet) e otel-gateway (Deployment)

kubectl get deployment -n observability otel-gateway-collector
# Saida esperada: 2/2 READY

# Verificar Instrumentation
kubectl get instrumentation -n default
# Saida esperada: auto-instrumentation

# Verificar detalhes da Instrumentation
kubectl describe instrumentation auto-instrumentation -n default
# Saida esperada: Java e Python configurados com sampler 25%
\`\`\``
      },
      {
        title: 'Instrumentar uma aplicacao e validar telemetria',
        instruction: `Crie um Deployment de teste e valide a auto-instrumentacao:
1. Criar um Deployment com uma app Java simples
2. Adicionar a annotation de auto-instrumentacao Java
3. Verificar que o init container e as variaveis OTEL foram injetados
4. Verificar que traces estao chegando ao Collector`,
        hints: [
          'Use annotation instrumentation.opentelemetry.io/inject-java: "true"',
          'Apos anotar um Deployment existente, delete os pods para forcar re-injeccao',
          'Verifique os logs do Collector para confirmar recebimento de spans'
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

# Verificar injeccao
kubectl get pod -l app=java-test-app -o jsonpath='{.items[0].spec.initContainers[*].name}'
# Saida esperada: opentelemetry-auto-instrumentation-java

# Verificar variaveis OTEL
kubectl get pod -l app=java-test-app -o jsonpath='{.items[0].spec.containers[0].env[*].name}' | tr ' ' '\\n' | grep OTEL
# Saida esperada: OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_TRACES_SAMPLER, etc

# Verificar logs do Collector agent
kubectl logs -n observability -l app.kubernetes.io/name=otel-agent-collector --tail=20
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o pod tem init container OTel
kubectl get pod -l app=java-test-app -o jsonpath='{.items[0].spec.initContainers[0].name}'
# Saida esperada: opentelemetry-auto-instrumentation-java

# Verificar JAVA_TOOL_OPTIONS
kubectl get pod -l app=java-test-app -o jsonpath='{.items[0].spec.containers[0].env}' | grep -o "JAVA_TOOL_OPTIONS"
# Saida esperada: JAVA_TOOL_OPTIONS

# Verificar OTEL_EXPORTER_OTLP_ENDPOINT
kubectl get pod -l app=java-test-app -o jsonpath='{.items[0].spec.containers[0].env}' | grep -o "otel-agent"
# Saida esperada: contendo referencia ao collector

# Verificar que o pod esta Running
kubectl get pod -l app=java-test-app
# Saida esperada: Running 1/1
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Auto-instrumentacao nao injeta no pod',
      difficulty: 'medium',
      symptom: 'Apos adicionar a annotation instrumentation.opentelemetry.io/inject-java: "true" ao Deployment, o pod nao tem init container OTel e nao ha variaveis OTEL.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o Operator esta rodando
kubectl get pods -n opentelemetry-operator-system
# Deve ter pod Running

# 2. Verificar se o Instrumentation CR existe no namespace da app
kubectl get instrumentation -n default
# Deve listar o CR

# 3. Verificar se a annotation esta correta no pod (nao apenas no Deployment)
kubectl get pod -l app=my-app -o jsonpath='{.items[0].metadata.annotations}'

# 4. Verificar logs do Operator
kubectl logs -n opentelemetry-operator-system -l app.kubernetes.io/name=opentelemetry-operator | tail -20

# 5. Verificar webhook
kubectl get mutatingwebhookconfigurations | grep opentelemetry
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Instrumentation CR no namespace errado:** O CR deve existir no MESMO namespace do pod, ou especificar o namespace na annotation: instrumentation.opentelemetry.io/inject-java: "namespace/instrumentation-name".

2. **Pod nao foi recriado:** A injeccao so acontece na CRIACAO do pod. Fazer kubectl rollout restart deployment/my-app para forcar re-injeccao.

3. **Annotation incorreta:** Verificar que e instrumentation.opentelemetry.io/inject-java (nao inject-jvm ou inject-spring). Cada linguagem tem sua annotation especifica.

4. **Webhook nao configurado:** Verificar que o MutatingWebhookConfiguration do Operator existe. Se nao, reinstalar o Operator.

5. **Conflito de versao:** Verificar compatibilidade entre a versao do Operator e as imagens de instrumentacao.`
    },
    {
      title: 'K8sattributes mostra metadata incorreta ou vazia',
      difficulty: 'hard',
      symptom: 'O k8sattributes processor esta habilitado mas os attributes k8s.pod.name, k8s.namespace.name chegam vazios ou incorretos nos traces.',
      diagnosis: `\`\`\`bash
# 1. Verificar RBAC do ServiceAccount
kubectl auth can-i list pods --as=system:serviceaccount:observability:otel-collector
kubectl auth can-i get namespaces --as=system:serviceaccount:observability:otel-collector

# 2. Verificar pod_association config
kubectl get configmap -n observability -l app.kubernetes.io/name=otel-agent-collector -o yaml | grep -A10 pod_association

# 3. Verificar se a app envia resource attributes com pod IP
# Logs do collector devem mostrar o IP associado
kubectl logs -n observability -l app.kubernetes.io/name=otel-agent-collector | grep "pod_association"

# 4. Verificar se K8S_NODE_NAME esta definido (para DaemonSet)
kubectl get daemonset -n observability -o yaml | grep K8S_NODE_NAME -A3

# 5. Verificar conectividade com API Server
kubectl exec -n observability ds/otel-agent-collector -- wget -qO- https://kubernetes.default.svc/api/v1/namespaces --header "Authorization: Bearer \$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" --no-check-certificate 2>&1 | head -5
\`\`\``,
      solution: `**Causas e solucoes:**

1. **RBAC insuficiente:** Criar ClusterRole com get/list/watch em pods, namespaces, nodes, deployments, replicasets. Bind ao ServiceAccount do Collector.

2. **Pod association incorreta:** O k8sattributes precisa correlacionar telemetria com pods. Se a app nao envia k8s.pod.ip como resource attribute, usar pod_association from: connection para usar o IP de conexao.

3. **filter.node_from_env_var ausente no DaemonSet:** Sem isso, cada agent tenta listar TODOS os pods do cluster. Adicionar K8S_NODE_NAME como env var e configurar filter.node_from_env_var.

4. **Cache desatualizado:** Se pods sao criados rapidamente, o cache do k8sattributes pode nao ter o pod. Verificar metadata_collection_interval (padrao 5m pode ser muito alto).

5. **Ordem no pipeline:** k8sattributes deve vir DEPOIS de memory_limiter e ANTES de batch.`
    },
    {
      title: 'Traces fragmentados — spans de servicos diferentes nao correlacionam',
      difficulty: 'hard',
      symptom: 'Traces aparecem no Tempo/Jaeger mas spans de servicos diferentes aparecem como traces separados em vez de um trace distribuido unico.',
      diagnosis: `\`\`\`bash
# 1. Verificar se context propagation esta configurado
kubectl get instrumentation -n default -o yaml | grep -A3 propagators

# 2. Verificar headers de propagacao entre servicos
# Em apps HTTP, verificar se traceparent header e propagado
kubectl logs -l app=service-a | grep -i traceparent

# 3. Verificar se o TraceID e o mesmo entre servicos
# No Tempo/Jaeger, comparar TraceIDs
kubectl logs -n observability -l app.kubernetes.io/name=otel-agent-collector | grep "TraceID" | head -5

# 4. Verificar se sampler esta descartando spans intermediarios
kubectl get instrumentation -n default -o yaml | grep -A3 sampler

# 5. Verificar se o service mesh (Istio/Linkerd) esta interferindo
kubectl get pods -l app=my-app -o jsonpath='{.items[0].spec.containers[*].name}'
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Propagators nao configurados:** Verificar que os propagators incluem tracecontext (W3C) e/ou b3 (Zipkin). Todos os servicos devem usar o MESMO formato de propagacao.

2. **Servico intermediario nao propaga contexto:** Se um servico no meio da cadeia nao instrumentado recebe e faz novas requests sem propagar o header traceparent, o trace quebra. Instrumentar TODOS os servicos na cadeia.

3. **Sampling inconsistente:** Se o sampler do servico A decide NÃO amostrar mas o servico B decide amostrar, os spans nao correlacionam. Usar parentbased_traceidratio para que a decisao do pai seja respeitada.

4. **Service mesh duplicando headers:** Istio/Linkerd podem gerar seus proprios spans. Verificar que nao estao criando novos TraceIDs. Configurar mesh para propagar contexto OTel.

5. **Clock skew entre nodes:** Se os clocks dos nodes estao dessincronizados, spans podem parecer fora de ordem. Verificar NTP nos nodes.`
    }
  ]
};
