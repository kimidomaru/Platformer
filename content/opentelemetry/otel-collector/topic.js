window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['opentelemetry/otel-collector'] = {
  theory: `
# OTel Collector & Pipelines

## Relevancia
O OpenTelemetry Collector e o componente central de uma arquitetura de observabilidade moderna. Funciona como proxy e pipeline para receber, processar e exportar dados de telemetria (traces, metricas, logs). E vendor-neutral e altamente configuravel.

## Conceitos Fundamentais

### Arquitetura do Collector

\`\`\`
┌─────────────────────────────────────────────────────┐
│                  OTel Collector                     │
│                                                     │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐    │
│  │ Receivers │──→│Processors │──→│ Exporters │    │
│  └───────────┘   └───────────┘   └───────────┘    │
│                                                     │
│  Receivers:    Onde os dados entram                 │
│  Processors:   Transformacoes no meio              │
│  Exporters:    Para onde os dados vao              │
│                                                     │
│  Pipeline = Receiver(s) → Processor(s) → Exporter(s)│
└─────────────────────────────────────────────────────┘
\`\`\`

### Distribuicoes do Collector

| Distribuicao | Conteudo | Uso |
|-------------|---------|-----|
| Core | Componentes essenciais | Minimo para OTLP |
| Contrib | Core + 100+ componentes comunitarios | Producao (maioria dos casos) |
| Custom | Build customizado (ocb) | Enterprise/seguranca |

### Configuracao Basica

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

### Receivers — Onde os dados entram

\`\`\`yaml
receivers:
  # OTLP — padrao OTel (traces, metricas, logs)
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

  # Filelog — coletar logs de arquivos (DaemonSet)
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
    namespaces: []  # vazio = todos

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

### Processors — Transformacoes

\`\`\`yaml
processors:
  # Batch — agrupa dados para envio eficiente
  batch:
    timeout: 5s
    send_batch_size: 1024

  # Memory Limiter — protege contra OOM
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
    spike_limit_mib: 128

  # Resource — adicionar/modificar resource attributes
  resource:
    attributes:
      - key: environment
        value: production
        action: upsert

  # K8s Attributes — enriquecer com metadata K8s
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

  # Filter — remover dados desnecessarios
  filter:
    error_mode: ignore
    traces:
      span:
        - 'attributes["http.target"] == "/healthz"'
        - 'attributes["http.target"] == "/readyz"'
    metrics:
      metric:
        - 'name == "go_gc_duration_seconds"'

  # Transform — modificar dados
  transform:
    trace_statements:
      - context: span
        statements:
          - 'set(status.code, 1) where attributes["http.response.status_code"] >= 400'

  # Tail Sampling — amostrar no collector
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

### Exporters — Para onde os dados vao

\`\`\`yaml
exporters:
  # OTLP — para backends que suportam OTLP
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

  # Loki — para logs
  loki:
    endpoint: http://loki.observability:3100/loki/api/v1/push
    default_labels_enabled:
      exporter: false
      job: true

  # Debug — para desenvolvimento
  debug:
    verbosity: detailed
    sampling_initial: 5
    sampling_thereafter: 200

  # OTLP/HTTP — para SaaS (Datadog, New Relic, etc)
  otlphttp/datadog:
    endpoint: https://api.datadoghq.com
    headers:
      DD-API-KEY: "\${env:DD_API_KEY}"
\`\`\`

### Pipelines — Conectando tudo

\`\`\`yaml
service:
  pipelines:
    # Pipeline de traces
    traces:
      receivers: [otlp]
      processors: [memory_limiter, k8sattributes, filter, tail_sampling, batch]
      exporters: [otlp/tempo]

    # Pipeline de metricas
    metrics:
      receivers: [otlp, prometheus, hostmetrics]
      processors: [memory_limiter, k8sattributes, batch]
      exporters: [prometheusremotewrite]

    # Pipeline de logs
    logs:
      receivers: [otlp, filelog]
      processors: [memory_limiter, k8sattributes, resource, batch]
      exporters: [loki]

    # Pipeline de logs do K8s events
    logs/k8s-events:
      receivers: [k8s_events]
      processors: [memory_limiter, batch]
      exporters: [loki]
\`\`\`

### Deployment Patterns

\`\`\`
Padrao 1: DaemonSet (Agent)
┌─────────────┐
│   Node 1    │
│ ┌─────────┐ │
│ │Collector│ │ ← Coleta logs, host metrics
│ │DaemonSet│ │
│ └─────────┘ │
│ ┌───┐ ┌───┐ │
│ │App│ │App│ │
│ └───┘ └───┘ │
└─────────────┘

Padrao 2: Deployment (Gateway)
┌───────────┐     ┌───────────────┐     ┌─────────┐
│ App Pods  │────→│   Collector   │────→│ Backend │
│ (OTel SDK)│     │  Deployment   │     │(Tempo,  │
└───────────┘     │  (Gateway)    │     │ Prom)   │
                  └───────────────┘     └─────────┘

Padrao 3: Sidecar
┌─────────────────┐
│      Pod        │
│ ┌─────┐ ┌─────┐│
│ │ App │ │OTel ││
│ │     │→│Side ││ ← Sidecar por pod
│ │     │ │car  ││
│ └─────┘ └─────┘│
└─────────────────┘

Padrao 4: Agent + Gateway (recomendado)
Nodes                    Central
┌─────────┐         ┌───────────┐     ┌─────────┐
│DaemonSet│────────→│  Gateway  │────→│ Backend │
│(Agent)  │         │Deployment │     │         │
└─────────┘         └───────────┘     └─────────┘
  Coleta               Processamento     Storage
  local                centralizado
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

### Erros Comuns

1. **Sem memory_limiter** — Collector pode OOM com picos de trafego
2. **Batch muito grande** — latencia alta antes de exportar
3. **Sem retry** — dados perdidos em falhas transientes do backend
4. **Pipeline unica para tudo** — separar por tipo de dado (traces, metrics, logs)
5. **Debug exporter em producao** — gera logs excessivos
6. **Tail sampling sem memoria suficiente** — precisa manter traces em memoria

## Killer.sh Style Challenge

> **Cenario:** Configure um OTel Collector com: (1) receivers OTLP + filelog, (2) processors k8sattributes + tail_sampling + batch, (3) exporters para Tempo (traces), Mimir (metricas) e Loki (logs), (4) deploy como DaemonSet + Gateway.
`,
  quiz: [
    {
      question: 'Quais sao os tres componentes principais de uma pipeline do OTel Collector?',
      options: [
        'Input, Transform, Output',
        'Receivers, Processors, Exporters',
        'Source, Filter, Sink',
        'Ingress, Middleware, Egress'
      ],
      correct: 1,
      explanation: 'Uma pipeline do OTel Collector consiste em: Receivers (entrada de dados), Processors (transformacoes) e Exporters (saida para backends). Pipelines sao definidas por tipo de sinal (traces, metrics, logs).',
      reference: 'Conceito relacionado: Cada pipeline pode ter multiplos receivers e exporters.'
    },
    {
      question: 'Para que serve o processor memory_limiter?',
      options: [
        'Limitar o uso de disco',
        'Proteger o Collector contra OOM (Out of Memory) em picos de trafego',
        'Limitar o numero de traces',
        'Comprimir dados em memoria'
      ],
      correct: 1,
      explanation: 'O memory_limiter monitora o uso de memoria do Collector e comeca a rejeitar dados quando o limite e atingido, prevenindo OOM. Deve ser o PRIMEIRO processor em toda pipeline.',
      reference: 'Conceito relacionado: Configure limit_mib e spike_limit_mib baseado na memoria disponivel do pod.'
    },
    {
      question: 'Qual a diferenca entre tail_sampling e head-based sampling?',
      options: [
        'Nao ha diferenca',
        'Head-based decide no inicio (SDK); tail-based decide apos o trace completo (Collector), permitindo manter erros',
        'Tail sampling e mais rapido',
        'Head sampling funciona no Collector'
      ],
      correct: 1,
      explanation: 'Head-based (SDK) decide ANTES do trace — rapido mas nao sabe o resultado. Tail-based (Collector) espera o trace completar — pode manter 100% dos erros e traces lentos, mas requer mais memoria.',
      reference: 'Conceito relacionado: Use head-based no SDK (10%) + tail-based no Collector (manter erros).'
    },
    {
      question: 'Qual receiver coleta logs de containers no Kubernetes?',
      options: [
        'otlp',
        'filelog (lendo /var/log/pods/*/*/*.log)',
        'prometheus',
        'hostmetrics'
      ],
      correct: 1,
      explanation: 'O filelog receiver le arquivos de log do disco. No Kubernetes, os logs de containers ficam em /var/log/pods/. Usado com DaemonSet para coletar logs de todos os pods no node.',
      reference: 'Conceito relacionado: Use operators (container, json_parser) para parsear logs estruturados.'
    },
    {
      question: 'Qual o padrao de deployment recomendado para o OTel Collector?',
      options: [
        'Apenas Sidecar',
        'Agent (DaemonSet) + Gateway (Deployment) — coleta local e processamento centralizado',
        'Apenas Deployment central',
        'Um por namespace'
      ],
      correct: 1,
      explanation: 'Agent (DaemonSet) coleta logs e metricas localmente em cada node. Gateway (Deployment) centraliza o processamento (tail sampling, enrichment) e exporta para backends. Combina eficiencia local com processamento central.',
      reference: 'Conceito relacionado: Agent e leve (sem processamento pesado), Gateway tem mais recursos para processar.'
    },
    {
      question: 'O que o processor k8sattributes faz?',
      options: [
        'Cria recursos Kubernetes',
        'Enriquece telemetria com metadata do Kubernetes (pod name, namespace, deployment, labels)',
        'Filtra dados por namespace',
        'Exporta para Kubernetes API'
      ],
      correct: 1,
      explanation: 'O k8sattributes processor consulta a Kubernetes API para adicionar metadata como k8s.pod.name, k8s.namespace.name, k8s.deployment.name e labels customizados aos dados de telemetria.',
      reference: 'Conceito relacionado: Requer ServiceAccount com permissao de read no K8s API.'
    },
    {
      question: 'Qual exporter envia metricas no formato Prometheus?',
      options: [
        'otlp',
        'prometheusremotewrite',
        'debug',
        'loki'
      ],
      correct: 1,
      explanation: 'O prometheusremotewrite exporter envia metricas via Prometheus Remote Write protocol para backends como Prometheus, Mimir, Thanos ou Cortex. E o padrao para integrar OTel com o ecossistema Prometheus.',
      reference: 'Conceito relacionado: resource_to_telemetry_conversion converte resource attributes em labels Prometheus.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os componentes de uma pipeline do OTel Collector?',
      back: '**Receivers:** Onde os dados entram\n- otlp (gRPC/HTTP)\n- filelog (arquivos de log)\n- prometheus (scraping)\n- hostmetrics (CPU, mem, disk)\n- k8s_events\n\n**Processors:** Transformacoes\n- memory_limiter (protecao OOM)\n- batch (agrupamento)\n- k8sattributes (metadata K8s)\n- filter (remover dados)\n- tail_sampling (amostragem)\n\n**Exporters:** Para onde vao\n- otlp (Tempo, Jaeger)\n- prometheusremotewrite (Prometheus)\n- loki (logs)\n- debug (desenvolvimento)'
    },
    {
      front: 'Quais sao os deployment patterns do Collector?',
      back: '**1. DaemonSet (Agent):**\n- Um por node\n- Coleta logs e host metrics\n- Leve, sem processamento pesado\n\n**2. Deployment (Gateway):**\n- Centralizado\n- Processamento pesado (tail sampling)\n- Escala horizontalmente\n\n**3. Sidecar:**\n- Um por pod\n- Isolamento total\n- Mais recursos consumidos\n\n**4. Agent + Gateway (RECOMENDADO):**\n- DaemonSet coleta local\n- Deployment processa central\n- Melhor dos dois mundos'
    },
    {
      front: 'Como funciona o tail_sampling processor?',
      back: '**Tail-based sampling** decide APOS o trace completar.\n\n**Configuracao:**\n- decision_wait: tempo para esperar spans\n- num_traces: max traces em memoria\n- policies: regras de amostragem\n\n**Policies comuns:**\n- status_code: ERROR → manter 100%\n- latency: > 1000ms → manter\n- probabilistic: 10% do restante\n\n**Vantagem:** Manter todos os erros e traces lentos.\n\n**Custo:** Requer memoria para manter traces pendentes.\n\n**Onde rodar:** Gateway (Deployment), NAO no Agent.'
    },
    {
      front: 'Como o filelog receiver coleta logs no Kubernetes?',
      back: '**Configuracao:**\n\`\`\`yaml\nfilelog:\n  include:\n    - /var/log/pods/*/*/*.log\n  operators:\n    - type: container\n    - type: json_parser\n    - type: severity_parser\n\`\`\`\n\n**Deploy:** DaemonSet com volume mount de /var/log/pods\n\n**Operators:**\n- container: parseia formato de container log\n- json_parser: parseia JSON\n- severity_parser: extrai nivel de log\n\n**Vantagem vs Fluentd/Fluent Bit:**\nNativo OTel, correlacao com traces.'
    },
    {
      front: 'O que o k8sattributes processor adiciona?',
      back: '**Metadata adicionada:**\n- k8s.namespace.name\n- k8s.pod.name\n- k8s.pod.uid\n- k8s.deployment.name\n- k8s.node.name\n- Labels customizados (app, version)\n\n**Como funciona:**\n1. Recebe telemetria com pod IP\n2. Consulta K8s API para obter metadata\n3. Adiciona como resource attributes\n\n**Requisitos:**\n- ServiceAccount com read access\n- ClusterRole: pods, namespaces, nodes\n\n**Beneficio:** Todos os sinais enriquecidos com contexto K8s.'
    },
    {
      front: 'Quais processors sao obrigatorios em producao?',
      back: '**1. memory_limiter (PRIMEIRO na pipeline):**\n- Protege contra OOM\n- limit_mib baseado no pod memory\n- spike_limit_mib para picos\n\n**2. batch:**\n- Agrupa dados para envio eficiente\n- timeout: 5s (max espera)\n- send_batch_size: 1024\n\n**Recomendados:**\n- k8sattributes (metadata K8s)\n- resource (adicionar env, cluster)\n- filter (remover health checks)\n\n**Ordem na pipeline:**\nmemory_limiter → k8sattributes → filter → batch'
    },
    {
      front: 'Como enviar dados para multiplos backends?',
      back: '**Um exporter por backend:**\n\`\`\`yaml\nexporters:\n  otlp/tempo:\n    endpoint: tempo:4317\n  otlp/jaeger:\n    endpoint: jaeger:4317\n  prometheusremotewrite:\n    endpoint: http://mimir:9090/api/v1/write\n\`\`\`\n\n**Pipeline com multiplos exporters:**\n\`\`\`yaml\npipelines:\n  traces:\n    exporters: [otlp/tempo, otlp/jaeger]\n  metrics:\n    exporters: [prometheusremotewrite]\n\`\`\`\n\n**Usar nomes com / para diferenciar:**\notlp/tempo, otlp/jaeger, otlphttp/datadog'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar um OTel Collector completo com pipelines para traces, metricas e logs no Kubernetes.',
    objective: 'Aprender a configurar receivers, processors e exporters do OTel Collector e deployar no Kubernetes.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Configurar Collector com OTLP receiver e pipeline de traces',
        instruction: `Crie um \`otel-collector-config.yaml\` com:
1. Receiver OTLP (gRPC porta 4317 e HTTP porta 4318)
2. Processors: memory_limiter (512 MiB) e batch (5s timeout)
3. Exporter OTLP para Tempo em \`tempo.observability:4317\`
4. Pipeline de traces conectando tudo
5. Health check extension na porta 13133`,
        hints: [
          'memory_limiter deve ser o primeiro processor na pipeline',
          'Exporters nomeados usam / (otlp/tempo)',
          'Extensions sao definidas em service.extensions'
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
# Validar configuracao (se otelcol instalado)
otelcol validate --config=otel-collector-config.yaml
# Saida esperada: Config is valid

# Verificar estrutura
grep -E "receivers:|processors:|exporters:|pipelines:" otel-collector-config.yaml
# Saida esperada: todas as secoes presentes

# Verificar que memory_limiter vem antes de batch
grep -A5 "traces:" otel-collector-config.yaml | grep "processors:"
# Saida esperada: [memory_limiter, batch]
\`\`\``
      },
      {
        title: 'Adicionar pipelines de metricas e logs',
        instruction: `Expanda a configuracao para incluir:
1. Receiver **prometheus** que faz scrape de pods com annotation prometheus.io/scrape=true
2. Receiver **filelog** para coletar logs de /var/log/pods
3. Exporter **prometheusremotewrite** para Mimir em http://mimir.observability:9090/api/v1/write
4. Exporter **loki** para http://loki.observability:3100/loki/api/v1/push
5. Pipeline de metricas (otlp + prometheus → prometheusremotewrite)
6. Pipeline de logs (otlp + filelog → loki)`,
        hints: [
          'Cada pipeline pode ter multiplos receivers',
          'filelog usa include para definir paths e operators para parsing',
          'Todas as pipelines devem ter memory_limiter e batch'
        ],
        solution: `\`\`\`yaml
# Adicionar aos receivers existentes:
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

# Adicionar aos exporters:
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

# Pipelines completas:
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
# Verificar que todas as 3 pipelines estao definidas
grep -c "receivers:" otel-collector-config.yaml
# Saida esperada: 4 (1 global + 3 em pipelines)

# Verificar receivers por pipeline
grep -A3 "traces:" otel-collector-config.yaml
grep -A3 "metrics:" otel-collector-config.yaml
grep -A3 "logs:" otel-collector-config.yaml
# Saida esperada: cada pipeline com seus receivers e exporters
\`\`\``
      },
      {
        title: 'Deployar Collector como DaemonSet no Kubernetes',
        instruction: `Crie o manifest Kubernetes para deployar o OTel Collector como DaemonSet:
1. Namespace: observability
2. ConfigMap com a configuracao do collector
3. DaemonSet com imagem otel/opentelemetry-collector-contrib:latest
4. Volume mounts para a config e /var/log/pods (para filelog)
5. ServiceAccount com permissoes para K8s API
6. Service expondo portas 4317 e 4318`,
        hints: [
          'ConfigMap monta a config em /etc/otelcol-contrib/',
          'Volume hostPath para /var/log/pods (readOnly)',
          'ServiceAccount precisa de ClusterRole para pods, namespaces, nodes'
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
    # (conteudo da configuracao dos steps anteriores)
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
# Aplicar manifests
kubectl apply -f otel-collector-daemonset.yaml

# Verificar DaemonSet
kubectl get daemonset -n observability otel-collector-agent
# Saida esperada: DESIRED = CURRENT = READY (1 por node)

# Verificar pods
kubectl get pods -n observability -l app=otel-collector-agent
# Saida esperada: pods Running em cada node

# Verificar health
kubectl exec -n observability ds/otel-collector-agent -- wget -qO- http://localhost:13133/
# Saida esperada: {"status":"Server available"...}

# Verificar service
kubectl get svc -n observability otel-collector
# Saida esperada: portas 4317 e 4318
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Collector reinicia com OOM (Out of Memory)',
      difficulty: 'medium',
      symptom: 'O pod do OTel Collector reinicia frequentemente com status OOMKilled. Os logs mostram picos de uso de memoria.',
      diagnosis: `\`\`\`bash
# 1. Verificar se memory_limiter esta configurado
kubectl get configmap otel-collector-config -n observability -o yaml | grep memory_limiter

# 2. Verificar limites de memoria do pod
kubectl describe pod -n observability -l app=otel-collector | grep -A3 "Limits:"

# 3. Verificar se tail_sampling esta habilitado
# Tail sampling mantem traces em memoria — muito consumo
kubectl get configmap otel-collector-config -n observability -o yaml | grep tail_sampling

# 4. Verificar volume de dados recebidos
kubectl logs -n observability -l app=otel-collector | grep "spans\|metrics\|logs" | tail -10
\`\`\``,
      solution: `**Causas e solucoes:**

1. **memory_limiter nao configurado:** Adicionar memory_limiter como PRIMEIRO processor em TODAS as pipelines. Configurar limit_mib = 80% do limit do pod.

2. **Tail sampling com muitos traces:** Reduzir num_traces ou decision_wait. Ou mover tail sampling para um Gateway com mais memoria.

3. **Batch muito grande:** Reduzir send_batch_max_size. Padrao 8192 pode ser demais.

4. **Volume de dados alto demais:** Adicionar filter processor para remover health checks e metricas desnecessarias. Habilitar sampling no SDK (head-based) para reduzir volume.

5. **Aumentar resources:** Se o volume e legitimo, aumentar memory limits do pod e do memory_limiter proporcionalmente.`
    },
    {
      title: 'Metricas nao aparecem no Prometheus/Mimir',
      difficulty: 'medium',
      symptom: 'O Collector recebe metricas via OTLP mas elas nao aparecem no Prometheus ou Mimir. Nenhum erro nos logs do Collector.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o exporter esta correto
kubectl get configmap otel-collector-config -n observability -o yaml | grep prometheusremotewrite -A5

# 2. Verificar conectividade com o backend
kubectl exec -n observability ds/otel-collector-agent -- wget -qO- http://mimir.observability:9090/ready

# 3. Verificar metricas internas do Collector
kubectl exec -n observability ds/otel-collector-agent -- wget -qO- http://localhost:8888/metrics | grep exporter

# 4. Verificar se a pipeline de metricas existe
kubectl get configmap otel-collector-config -n observability -o yaml | grep -A5 "metrics:"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Pipeline de metricas ausente:** Verificar que existe uma pipeline metrics: em service.pipelines com o exporter correto.

2. **Endpoint incorreto:** prometheusremotewrite requer /api/v1/write no endpoint. Verificar URL completa.

3. **Autenticacao:** Se o backend requer autenticacao (Mimir multi-tenant), adicionar headers: X-Scope-OrgID.

4. **Resource to telemetry:** Habilitar resource_to_telemetry_conversion: enabled: true para converter resource attributes em labels Prometheus.

5. **Formato incompativel:** Verificar que o backend suporta Prometheus Remote Write. Nem todos os backends Prometheus suportam.`
    },
    {
      title: 'Filelog receiver nao coleta logs de novos pods',
      difficulty: 'hard',
      symptom: 'O filelog receiver coleta logs de pods existentes mas nao detecta logs de pods recem-criados.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o volume /var/log/pods esta montado
kubectl exec -n observability ds/otel-collector-agent -- ls /var/log/pods/
# Deve listar diretorios de pods

# 2. Verificar permissoes
kubectl exec -n observability ds/otel-collector-agent -- ls -la /var/log/pods/NAMESPACE_PODNAME/

# 3. Verificar include pattern
# /var/log/pods/*/*/*.log deve cobrir novos pods

# 4. Verificar logs do collector por erros de filelog
kubectl logs -n observability -l app=otel-collector | grep -i "filelog\|error" | tail -20

# 5. Verificar se o pod novo esta no mesmo node que o DaemonSet
kubectl get pods -o wide | grep NEW_POD_NAME
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Volume nao atualizado:** O hostPath /var/log/pods deve ser montado sem subPath. Novos pods criam novos subdiretorios que devem ser visiveis automaticamente.

2. **Pattern muito restritivo:** Verificar que include pattern e generico o suficiente: /var/log/pods/*/*/*.log (3 niveis: namespace_pod/container/*.log).

3. **Poll interval:** O filelog receiver faz polling. Se poll_interval e muito alto, novos logs demoram a aparecer. Padrao e 200ms.

4. **Start position:** Se start_at: end (padrao), so coleta logs NOVOS apos o Collector iniciar. Para logs antigos, usar start_at: beginning (cuidado com volume).

5. **Node diferente:** DaemonSet so coleta logs do node onde roda. Verificar que o pod novo esta no mesmo node. Se o DaemonSet nao esta em todos os nodes, verificar tolerations.`
    }
  ]
};
