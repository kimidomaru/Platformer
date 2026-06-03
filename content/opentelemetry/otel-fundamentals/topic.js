window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['opentelemetry/otel-fundamentals'] = {
  theory: `
# OpenTelemetry Fundamentals

## Relevancia
OpenTelemetry (OTel) e o projeto CNCF de observabilidade que unifica a coleta de traces, metricas e logs em um unico framework. E o segundo projeto CNCF mais ativo (atras do Kubernetes) e o padrao de facto para instrumentacao de aplicacoes cloud-native. Substitui OpenTracing e OpenCensus.

## Conceitos Fundamentais

### O que e OpenTelemetry?

OpenTelemetry e um framework de observabilidade vendor-neutral que fornece APIs, SDKs e ferramentas para instrumentar, gerar, coletar e exportar dados de telemetria:

\`\`\`
┌─────────────────────────────────────────────────┐
│              OpenTelemetry                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Traces  │  │ Metrics  │  │   Logs   │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│       │              │              │           │
│       ▼              ▼              ▼           │
│  ┌─────────────────────────────────────┐       │
│  │          OTel SDK / API             │       │
│  └──────────────┬──────────────────────┘       │
│                 │                               │
│                 ▼                               │
│  ┌─────────────────────────────────────┐       │
│  │        OTel Collector               │       │
│  │  Receivers → Processors → Exporters │       │
│  └──────────────┬──────────────────────┘       │
│                 │                               │
│       ┌─────────┼─────────┐                    │
│       ▼         ▼         ▼                    │
│    Jaeger    Prometheus   Loki                 │
│    Tempo     Datadog      Elastic              │
│    Zipkin    New Relic    Splunk               │
└─────────────────────────────────────────────────┘
\`\`\`

### Os Tres Sinais (Pillars) de Observabilidade

| Sinal | O que mede | Exemplo |
|-------|-----------|---------|
| **Traces** | Fluxo de uma requisicao atraves de servicos | Request path: API → Auth → DB → Response |
| **Metrics** | Valores numericos ao longo do tempo | request_count, latency_p99, cpu_usage |
| **Logs** | Eventos discretos com contexto | "Error: connection refused to database" |

### OTLP — OpenTelemetry Protocol

OTLP e o protocolo nativo do OpenTelemetry para transmitir dados de telemetria:

\`\`\`
┌──────────┐    OTLP/gRPC (4317)    ┌───────────┐
│  App +   │ ──────────────────────→ │   OTel    │
│  OTel SDK│    OTLP/HTTP (4318)    │ Collector │
└──────────┘ ──────────────────────→ └───────────┘
\`\`\`

**Portas padrao:**
- 4317: OTLP/gRPC
- 4318: OTLP/HTTP

### Traces — Distributed Tracing

\`\`\`
Trace (TraceID: abc123)
│
├── Span: HTTP GET /api/orders (Root Span)
│   ├── SpanID: span-1
│   ├── Duration: 250ms
│   ├── Status: OK
│   ├── Attributes: http.method=GET, http.url=/api/orders
│   │
│   ├── Span: auth.validate (Child Span)
│   │   ├── SpanID: span-2, ParentID: span-1
│   │   ├── Duration: 15ms
│   │   └── Attributes: user.id=42
│   │
│   └── Span: db.query (Child Span)
│       ├── SpanID: span-3, ParentID: span-1
│       ├── Duration: 45ms
│       └── Attributes: db.system=postgresql, db.statement=SELECT...
\`\`\`

**Conceitos de Tracing:**
- **Trace:** Jornada completa de uma requisicao
- **Span:** Unidade de trabalho dentro de um trace
- **SpanContext:** TraceID + SpanID (propagado entre servicos)
- **Attributes:** Key-value pairs com metadata
- **Events:** Logs associados a um span
- **Status:** OK, ERROR, UNSET

### Context Propagation

\`\`\`
Service A                   Service B                  Service C
┌──────────┐  HTTP Header  ┌──────────┐  HTTP Header  ┌──────────┐
│ Span A   │──────────────→│ Span B   │──────────────→│ Span C   │
│ TraceID:x│  traceparent  │ TraceID:x│  traceparent  │ TraceID:x│
│ SpanID:1 │  00-x-1-01   │ SpanID:2 │  00-x-2-01   │ SpanID:3 │
└──────────┘               └──────────┘               └──────────┘

W3C Trace Context Header:
traceparent: 00-{trace-id}-{span-id}-{trace-flags}
\`\`\`

### Metrics

OpenTelemetry suporta varios tipos de metricas:

| Tipo | Descricao | Exemplo |
|------|-----------|---------|
| Counter | Valor que so sobe | request_total |
| UpDownCounter | Valor que sobe e desce | active_connections |
| Histogram | Distribuicao de valores | request_duration_seconds |
| Gauge | Valor pontual atual | cpu_temperature |

\`\`\`
# Exemplos de metricas OTel
http.server.request.duration{http.method="GET", http.route="/api/orders"}
http.server.active_requests{service.name="order-service"}
process.runtime.go.goroutines{service.name="order-service"}
\`\`\`

### Logs

OpenTelemetry unifica logs com traces e metricas adicionando correlacao:

\`\`\`
LogRecord:
  Timestamp: 2024-01-15T10:30:00Z
  SeverityText: ERROR
  SeverityNumber: 17
  Body: "Failed to process order"
  Attributes:
    order.id: "ORD-123"
    error.type: "DatabaseConnectionError"
  TraceID: abc123       ← Correlacao com trace!
  SpanID: span-3        ← Correlacao com span!
  Resource:
    service.name: "order-service"
    service.version: "1.2.0"
    k8s.pod.name: "order-service-7b9f4-xk2p"
\`\`\`

### Resource e Semantic Conventions

\`\`\`
Resource: metadata que identifica a origem dos dados
  service.name: "order-service"
  service.version: "1.2.0"
  service.namespace: "production"
  deployment.environment: "production"
  host.name: "pod-abc123"
  k8s.namespace.name: "production"
  k8s.pod.name: "order-service-7b9f4"
  k8s.node.name: "node-1"

Semantic Conventions: nomes padronizados
  http.request.method: "GET"
  http.response.status_code: 200
  url.path: "/api/orders"
  db.system: "postgresql"
  db.statement: "SELECT * FROM orders"
  rpc.system: "grpc"
  rpc.method: "GetOrder"
\`\`\`

### Instrumentacao

\`\`\`
┌─────────────────────────────────────────┐
│        Tipos de Instrumentacao          │
├─────────────────────────────────────────┤
│                                         │
│  Automatica (zero-code):                │
│  - Java Agent (-javaagent:otel.jar)     │
│  - Python (opentelemetry-instrument)    │
│  - Node.js (@opentelemetry/auto-*)      │
│  - .NET (auto-instrumentation)          │
│                                         │
│  Manual:                                │
│  - SDK para criar spans customizados    │
│  - Adicionar attributes e events        │
│  - Instrumentar codigo de negocio       │
│                                         │
│  Bibliotecas de instrumentacao:         │
│  - HTTP, gRPC, SQL, Redis, Kafka        │
│  - Instrumentam frameworks populares    │
│                                         │
└─────────────────────────────────────────┘
\`\`\`

### Arquitetura do OTel SDK

\`\`\`
Application Code
     │
     ▼
┌──────────────┐
│   OTel API   │  ← Interface estavel (vendor-neutral)
├──────────────┤
│   OTel SDK   │  ← Implementacao (configuravel)
│  ┌────────┐  │
│  │Sampler │  │  ← Decide se trace e amostrado
│  ├────────┤  │
│  │SpanProc│  │  ← Processa spans (batch, filter)
│  ├────────┤  │
│  │Exporter│  │  ← Envia dados (OTLP, console, etc)
│  └────────┘  │
└──────────────┘
\`\`\`

### Sampling

| Estrategia | Descricao | Uso |
|-----------|-----------|-----|
| AlwaysOn | Amostrar 100% | Dev/staging |
| AlwaysOff | Nao amostrar | Desabilitar tracing |
| TraceIdRatio | Amostrar X% | Producao (ex: 10%) |
| ParentBased | Seguir decisao do pai | Propagacao consistente |
| Tail-based | Decidir apos trace completo | Collector (manter erros) |

### Erros Comuns

1. **Instrumentar tudo** — amostragem e essencial em producao (nao 100%)
2. **Ignorar semantic conventions** — nomes nao padronizados dificultam consultas
3. **Nao propagar contexto** — traces ficam fragmentados entre servicos
4. **SDK sem batch processor** — enviar cada span individualmente sobrecarrega
5. **Nao adicionar resource attributes** — sem service.name nao da pra identificar origem
6. **Confundir API com SDK** — API e a interface, SDK e a implementacao

## Killer.sh Style Challenge

> **Cenario:** Instrumente um microservico Go com OpenTelemetry: (1) traces com HTTP e gRPC spans, (2) metricas customizadas de negocio, (3) correlacao de logs com TraceID, (4) exportacao via OTLP para um Collector.
`,
  quiz: [
    {
      question: 'Quais sao os tres sinais (pillars) do OpenTelemetry?',
      options: [
        'CPU, Memoria, Disco',
        'Traces, Metrics, Logs',
        'HTTP, gRPC, GraphQL',
        'Prometheus, Grafana, Loki'
      ],
      correct: 1,
      explanation: 'Os tres sinais sao: Traces (fluxo de requisicoes entre servicos), Metrics (valores numericos ao longo do tempo) e Logs (eventos discretos com contexto). OTel unifica a coleta dos tres.',
      reference: 'Conceito relacionado: Logs podem ser correlacionados com Traces via TraceID e SpanID.'
    },
    {
      question: 'O que e OTLP?',
      options: [
        'Um banco de dados de observabilidade',
        'O protocolo nativo do OpenTelemetry para transmitir dados de telemetria',
        'Uma ferramenta de monitoramento',
        'Um formato de log'
      ],
      correct: 1,
      explanation: 'OTLP (OpenTelemetry Protocol) e o protocolo padrao para transmitir traces, metricas e logs. Suporta gRPC (porta 4317) e HTTP (porta 4318).',
      reference: 'Conceito relacionado: OTLP e vendor-neutral — qualquer backend que suporte OTLP pode receber dados.'
    },
    {
      question: 'O que e um Span no contexto de distributed tracing?',
      options: [
        'Uma metrica de latencia',
        'Uma unidade de trabalho dentro de um trace, com inicio, fim, attributes e relacao pai-filho',
        'Um log de erro',
        'Uma conexao de rede'
      ],
      correct: 1,
      explanation: 'Um Span representa uma operacao (HTTP request, query DB, chamada RPC). Tem SpanID, TraceID, duration, status, attributes e pode ter child spans. O Root Span e o primeiro span do trace.',
      reference: 'Conceito relacionado: SpanContext (TraceID + SpanID) e propagado via headers HTTP (W3C Trace Context).'
    },
    {
      question: 'Como o OpenTelemetry propaga contexto entre servicos?',
      options: [
        'Via banco de dados compartilhado',
        'Via headers HTTP padronizados (W3C Trace Context: traceparent)',
        'Via arquivo de configuracao',
        'Via DNS'
      ],
      correct: 1,
      explanation: 'O W3C Trace Context usa o header traceparent (formato: 00-{trace-id}-{span-id}-{trace-flags}) para propagar TraceID e SpanID entre servicos, mantendo o trace conectado.',
      reference: 'Conceito relacionado: Baggage e outro header que propaga key-value pairs customizados.'
    },
    {
      question: 'Qual a diferenca entre instrumentacao automatica e manual?',
      options: [
        'Automatica e mais precisa',
        'Automatica instrumenta frameworks/libs sem mudar codigo; manual cria spans customizados no codigo de negocio',
        'Manual e deprecated',
        'Nao ha diferenca'
      ],
      correct: 1,
      explanation: 'Auto-instrumentacao (ex: Java Agent) captura HTTP, gRPC, DB automaticamente. Instrumentacao manual usa o SDK para criar spans customizados em logica de negocio (ex: "processar pedido").',
      reference: 'Conceito relacionado: Combine ambas — auto para frameworks, manual para logica especifica.'
    },
    {
      question: 'Por que amostragem (sampling) e importante em producao?',
      options: [
        'Para reduzir custos e overhead — coletar 100% de traces e inviavel em alto volume',
        'Para melhorar a precisao dos dados',
        'Para compatibilidade com backends antigos',
        'Nao e importante, deve-se coletar tudo'
      ],
      correct: 0,
      explanation: 'Em producao com alto volume, coletar 100% de traces gera overhead de CPU/rede e custos de storage. Amostragem (ex: 10%) reduz volume mantendo representatividade. Tail-based sampling no Collector permite manter 100% dos erros.',
      reference: 'Conceito relacionado: ParentBased + TraceIdRatio e a combinacao mais comum em producao.'
    },
    {
      question: 'O que sao Semantic Conventions no OpenTelemetry?',
      options: [
        'Regras de formatacao de logs',
        'Nomes padronizados para attributes e resources que garantem consistencia entre instrumentacoes',
        'Tipos de metricas',
        'Protocolos de rede'
      ],
      correct: 1,
      explanation: 'Semantic Conventions definem nomes padrao como http.request.method, db.system, service.name. Garantem que instrumentacoes diferentes usem os mesmos nomes, facilitando consultas e dashboards.',
      reference: 'Conceito relacionado: Semantic Conventions cobrem HTTP, DB, RPC, messaging, cloud resources, K8s, etc.'
    }
  ],
  flashcards: [
    {
      front: 'O que e OpenTelemetry e qual sua relacao com OpenTracing/OpenCensus?',
      back: '**OpenTelemetry (OTel)** = framework CNCF para observabilidade.\n\n**Unifica:** APIs, SDKs e ferramentas para traces, metricas e logs.\n\n**Historico:**\n- OpenTracing → tracing API padrao\n- OpenCensus → tracing + metricas (Google)\n- OpenTelemetry → merge dos dois (2019)\n\n**Caracteristicas:**\n- Vendor-neutral\n- Protocolo OTLP padrao\n- Semantic conventions\n- Auto-instrumentacao\n- Segundo projeto CNCF mais ativo'
    },
    {
      front: 'O que sao Traces, Spans e SpanContext?',
      back: '**Trace:** Jornada completa de uma requisicao por todos os servicos. Identificado por TraceID.\n\n**Span:** Unidade de trabalho dentro do trace.\n- SpanID unico\n- ParentSpanID (relacao pai-filho)\n- Start/End time\n- Status (OK/ERROR)\n- Attributes (key-value)\n- Events (logs no span)\n\n**SpanContext:** TraceID + SpanID propagados entre servicos via headers (W3C traceparent).\n\n**Root Span:** Primeiro span do trace (sem parent).'
    },
    {
      front: 'Quais tipos de metricas o OpenTelemetry suporta?',
      back: '| Tipo | Descricao | Exemplo |\n|------|-----------|--------|\n| **Counter** | So sobe | request_total |\n| **UpDownCounter** | Sobe e desce | active_requests |\n| **Histogram** | Distribuicao | request_duration |\n| **Gauge** | Valor pontual | temperature |\n\n**Diferenca do Prometheus:**\n- OTel usa nomes diferentes (http.server.request.duration)\n- OTel segue Semantic Conventions\n- OTel exporta para qualquer backend via OTLP\n- Prometheus e um backend possivel'
    },
    {
      front: 'Como funciona a correlacao de Logs com Traces?',
      back: '**Correlacao:** Cada LogRecord pode incluir TraceID e SpanID.\n\n**Beneficio:** Ao investigar um trace com erro, voce pode ver os logs exatos daquele request.\n\n**Como implementar:**\n1. SDK injeta TraceID/SpanID no LogRecord\n2. Ou: log framework (logrus, zap) com OTel bridge\n3. Logs exportados com TraceID via OTLP\n\n**Consulta:** No Grafana, clique em um trace para ver logs correlacionados (Tempo → Loki).'
    },
    {
      front: 'O que e o OTel Collector e por que usar?',
      back: '**Collector** = proxy/pipeline para dados de telemetria.\n\n**Por que usar (em vez de enviar direto):**\n- Desacoplamento (app nao precisa saber o backend)\n- Batching e retry\n- Processamento (filtragem, enriquecimento)\n- Multi-export (enviar para varios backends)\n- Reduz carga na aplicacao\n\n**Componentes:**\n- Receivers: recebem dados (OTLP, Prometheus, etc)\n- Processors: transformam (batch, filter, enrich)\n- Exporters: enviam para backends\n\n**Portas:** 4317 (gRPC), 4318 (HTTP)'
    },
    {
      front: 'Quais estrategias de Sampling existem?',
      back: '**Head-based (SDK):**\n- AlwaysOn: 100% (dev)\n- AlwaysOff: 0%\n- TraceIdRatio: X% (ex: 10%)\n- ParentBased: segue decisao do pai\n\n**Tail-based (Collector):**\n- Decide APOS trace completo\n- Pode manter todos os traces com erro\n- Requer mais memoria no Collector\n\n**Recomendacao producao:**\n- ParentBased + TraceIdRatio(0.1) no SDK\n- Tail-based no Collector para erros\n- Resultado: ~10% normal + 100% erros'
    },
    {
      front: 'O que sao Semantic Conventions e Resource Attributes?',
      back: '**Semantic Conventions:**\nNomes padronizados para attributes:\n- http.request.method, http.response.status_code\n- db.system, db.statement\n- rpc.system, rpc.method\n- messaging.system, messaging.destination\n\n**Resource Attributes:**\nMetadata da origem dos dados:\n- service.name (OBRIGATORIO)\n- service.version\n- deployment.environment\n- k8s.namespace.name\n- k8s.pod.name\n- cloud.provider, cloud.region\n\n**Por que importa:** Consistencia em queries e dashboards.'
    }
  ],
  lab: {
    scenario: 'Voce precisa entender os conceitos basicos do OpenTelemetry: traces, metricas, logs e o protocolo OTLP.',
    objective: 'Aprender a estrutura de traces/spans, tipos de metricas, correlacao de logs e configuracao basica do SDK.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Analisar a estrutura de um Trace',
        instruction: `Dado o cenario: um servico API recebe um HTTP GET /api/orders, chama um servico Auth e depois consulta o banco PostgreSQL. Desenhe (em YAML/texto) a estrutura do trace com:
1. Root Span: HTTP GET /api/orders (200ms)
2. Child Span: auth.validate (20ms)
3. Child Span: db.query SELECT * FROM orders (50ms)
Inclua TraceID, SpanIDs, ParentIDs e attributes relevantes seguindo Semantic Conventions.`,
        hints: [
          'Root Span nao tem ParentSpanID',
          'Child Spans referenciam o SpanID do pai como ParentSpanID',
          'Todos os spans compartilham o mesmo TraceID',
          'Use Semantic Conventions: http.request.method, db.system, db.statement'
        ],
        solution: `\`\`\`yaml
# Estrutura do Trace
trace:
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736"

  spans:
    - spanId: "00f067aa0ba902b7"
      parentSpanId: null
      name: "HTTP GET /api/orders"
      kind: SERVER
      startTime: "2024-01-15T10:30:00.000Z"
      endTime: "2024-01-15T10:30:00.200Z"
      status: { code: OK }
      attributes:
        http.request.method: "GET"
        url.path: "/api/orders"
        http.response.status_code: 200
        service.name: "order-service"

    - spanId: "a1b2c3d4e5f60001"
      parentSpanId: "00f067aa0ba902b7"
      name: "auth.validate"
      kind: CLIENT
      startTime: "2024-01-15T10:30:00.010Z"
      endTime: "2024-01-15T10:30:00.030Z"
      status: { code: OK }
      attributes:
        rpc.system: "grpc"
        rpc.method: "Validate"
        user.id: "42"

    - spanId: "a1b2c3d4e5f60002"
      parentSpanId: "00f067aa0ba902b7"
      name: "db.query"
      kind: CLIENT
      startTime: "2024-01-15T10:30:00.040Z"
      endTime: "2024-01-15T10:30:00.090Z"
      status: { code: OK }
      attributes:
        db.system: "postgresql"
        db.statement: "SELECT * FROM orders WHERE user_id = 42"
        db.name: "orders"
\`\`\``,
        verify: `\`\`\`bash
# Verificar a estrutura do trace:
# 1. Todos os spans tem o mesmo traceId? SIM
# 2. Root span tem parentSpanId: null? SIM
# 3. Child spans referenciam o parentSpanId correto? SIM
# 4. Attributes seguem Semantic Conventions? SIM
# 5. Duracoes sao consistentes (children < parent)? SIM
echo "Trace structure validated"
\`\`\``
      },
      {
        title: 'Definir metricas com tipos corretos',
        instruction: `Para um servico order-service, defina as seguintes metricas usando os tipos corretos do OpenTelemetry:
1. Total de pedidos processados (so sobe)
2. Pedidos ativos em processamento (sobe e desce)
3. Duracao do processamento de pedidos (distribuicao)
4. Valor total em reais dos pedidos processados (so sobe)
Para cada metrica, especifique: nome (seguindo semantic conventions), tipo OTel, unit e labels.`,
        hints: [
          'Counter para valores que so sobem',
          'UpDownCounter para valores que sobem e descem',
          'Histogram para distribuicoes (latencia)',
          'Nomes devem ser descritivos: orders.processed.total'
        ],
        solution: `\`\`\`yaml
metrics:
  - name: orders.processed.total
    type: Counter
    unit: "{order}"
    description: Total de pedidos processados
    labels:
      - status: [success, failure]
      - payment_method: [credit_card, pix, boleto]

  - name: orders.active
    type: UpDownCounter
    unit: "{order}"
    description: Pedidos em processamento no momento
    labels:
      - priority: [normal, high]

  - name: orders.processing.duration
    type: Histogram
    unit: "ms"
    description: Duracao do processamento de pedidos
    buckets: [10, 50, 100, 250, 500, 1000, 5000]
    labels:
      - payment_method: [credit_card, pix, boleto]

  - name: orders.revenue.total
    type: Counter
    unit: "BRL"
    description: Valor total dos pedidos processados
    labels:
      - payment_method: [credit_card, pix, boleto]
\`\`\``,
        verify: `\`\`\`bash
# Verificar as metricas definidas:
# 1. Counter para valores monotonicos? SIM (processed.total, revenue.total)
# 2. UpDownCounter para valores variaveis? SIM (orders.active)
# 3. Histogram para distribuicoes? SIM (processing.duration)
# 4. Labels fazem sentido para cardinalidade? SIM (baixa cardinalidade)
echo "Metrics definition validated"
\`\`\``
      },
      {
        title: 'Configurar variaveis de ambiente do SDK',
        instruction: `Configure as variaveis de ambiente para o OpenTelemetry SDK de uma aplicacao:
1. Service name: order-service
2. Service version: 1.2.0
3. Environment: production
4. Exporter: OTLP via gRPC para otel-collector.observability:4317
5. Sampling: 10% (TraceIdRatio)
6. Propagators: W3C tracecontext e baggage`,
        hints: [
          'OTEL_SERVICE_NAME define o nome do servico',
          'OTEL_EXPORTER_OTLP_ENDPOINT define o endpoint do collector',
          'OTEL_TRACES_SAMPLER e OTEL_TRACES_SAMPLER_ARG configuram sampling',
          'OTEL_PROPAGATORS define os propagators'
        ],
        solution: `\`\`\`bash
# Variaveis de ambiente do OTel SDK
export OTEL_SERVICE_NAME="order-service"
export OTEL_RESOURCE_ATTRIBUTES="service.version=1.2.0,deployment.environment=production"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://otel-collector.observability:4317"
export OTEL_EXPORTER_OTLP_PROTOCOL="grpc"
export OTEL_TRACES_SAMPLER="parentbased_traceidratio"
export OTEL_TRACES_SAMPLER_ARG="0.1"
export OTEL_PROPAGATORS="tracecontext,baggage"
export OTEL_LOGS_EXPORTER="otlp"
export OTEL_METRICS_EXPORTER="otlp"
\`\`\`

\`\`\`yaml
# Equivalente em Kubernetes Deployment
env:
  - name: OTEL_SERVICE_NAME
    value: "order-service"
  - name: OTEL_RESOURCE_ATTRIBUTES
    value: "service.version=1.2.0,deployment.environment=production"
  - name: OTEL_EXPORTER_OTLP_ENDPOINT
    value: "http://otel-collector.observability:4317"
  - name: OTEL_EXPORTER_OTLP_PROTOCOL
    value: "grpc"
  - name: OTEL_TRACES_SAMPLER
    value: "parentbased_traceidratio"
  - name: OTEL_TRACES_SAMPLER_ARG
    value: "0.1"
  - name: OTEL_PROPAGATORS
    value: "tracecontext,baggage"
\`\`\``,
        verify: `\`\`\`bash
# Verificar variaveis de ambiente
echo \$OTEL_SERVICE_NAME
# Saida esperada: order-service

echo \$OTEL_EXPORTER_OTLP_ENDPOINT
# Saida esperada: http://otel-collector.observability:4317

echo \$OTEL_TRACES_SAMPLER
# Saida esperada: parentbased_traceidratio

echo \$OTEL_TRACES_SAMPLER_ARG
# Saida esperada: 0.1
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Traces nao aparecem no backend (Jaeger/Tempo)',
      difficulty: 'easy',
      symptom: 'A aplicacao esta instrumentada com OpenTelemetry mas nenhum trace aparece no Jaeger ou Grafana Tempo.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o SDK esta configurado
# Checar variaveis de ambiente
env | grep OTEL
# OTEL_SERVICE_NAME e OTEL_EXPORTER_OTLP_ENDPOINT devem estar setadas

# 2. Verificar conectividade com o Collector
curl -v http://otel-collector.observability:4318/v1/traces
# Deve responder (mesmo com erro 405 — significa que o endpoint existe)

# 3. Verificar se o Collector esta recebendo
kubectl logs -n observability deploy/otel-collector | grep -i "traces"

# 4. Verificar sampling
# Se OTEL_TRACES_SAMPLER_ARG=0.01, so 1% dos traces sao amostrados
# Aumentar para 1.0 para teste
\`\`\``,
      solution: `**Causas e solucoes:**

1. **SDK nao configurado:** Verificar que OTEL_SERVICE_NAME e OTEL_EXPORTER_OTLP_ENDPOINT estao definidos. Sem endpoint, o SDK descarta os dados.

2. **Collector nao acessivel:** Verificar que o Service do Collector esta correto e acessivel do pod da aplicacao. Testar com curl.

3. **Sampling muito baixo:** Aumentar OTEL_TRACES_SAMPLER_ARG para 1.0 temporariamente para confirmar que traces chegam. Depois ajustar para producao.

4. **Exporter errado:** Se o endpoint usa gRPC (porta 4317), OTEL_EXPORTER_OTLP_PROTOCOL deve ser "grpc". Se HTTP (4318), deve ser "http/protobuf".

5. **Collector nao exporta para o backend:** Verificar a configuracao do Collector — o exporter deve apontar para Jaeger/Tempo.`
    },
    {
      title: 'Traces fragmentados — spans nao se conectam',
      difficulty: 'medium',
      symptom: 'Os traces aparecem no backend mas estao fragmentados — spans de servicos diferentes aparecem como traces separados em vez de um unico trace.',
      diagnosis: `\`\`\`bash
# 1. Verificar se context propagation esta habilitado
# Checar OTEL_PROPAGATORS em todos os servicos
env | grep OTEL_PROPAGATORS
# Deve ser: tracecontext,baggage

# 2. Verificar headers HTTP na comunicacao entre servicos
# No servico receptor, logar os headers recebidos
# O header "traceparent" deve estar presente

# 3. Verificar se o HTTP client esta instrumentado
# Auto-instrumentacao deve cobrir o HTTP client
# Se manual, verificar que o context e injetado nos requests

# 4. Verificar se todos os servicos usam o mesmo formato
# Misturar W3C com B3 (Zipkin) causa fragmentacao
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Context propagation nao configurado:** Todos os servicos devem ter OTEL_PROPAGATORS=tracecontext,baggage. Sem isso, o TraceID nao e propagado via headers.

2. **HTTP client nao instrumentado:** A auto-instrumentacao geralmente cobre HTTP clients, mas verificar que a biblioteca esta incluida. Se manual, injetar context no header antes de cada request.

3. **Formato de propagacao inconsistente:** Todos os servicos devem usar o mesmo formato (W3C tracecontext). Misturar com B3 (Zipkin) causa fragmentacao.

4. **Proxies/gateways removem headers:** Verificar se proxies, API gateways ou load balancers nao estao removendo o header traceparent. Configurar para preservar.

5. **Async/messaging:** Para comunicacao assincrona (Kafka, RabbitMQ), injetar context nos headers da mensagem. A auto-instrumentacao de messaging geralmente faz isso.`
    },
    {
      title: 'Alta latencia e uso de memoria pelo SDK',
      difficulty: 'hard',
      symptom: 'Apos instrumentar com OpenTelemetry, a aplicacao apresenta aumento significativo de latencia e uso de memoria.',
      diagnosis: `\`\`\`bash
# 1. Verificar sampling rate
echo \$OTEL_TRACES_SAMPLER_ARG
# Se 1.0 (100%), muito alto para producao

# 2. Verificar batch processor
# O SDK deve usar BatchSpanProcessor, nao SimpleSpanProcessor
# SimpleSpanProcessor e sincrono e bloqueia

# 3. Verificar quantidade de attributes por span
# Muitos attributes customizados = mais memoria

# 4. Verificar se metricas tem alta cardinalidade
# Labels com user_id, request_id = explosao de series temporais

# 5. Monitorar o SDK
# Metricas internas do SDK (se habilitadas)
# otel.sdk.span.exported, otel.sdk.span.dropped
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Sampling 100%:** Reduzir para 10-20% com parentbased_traceidratio. Usar tail-based sampling no Collector para manter traces com erro.

2. **SimpleSpanProcessor:** Trocar para BatchSpanProcessor. Configurar: OTEL_BSP_MAX_QUEUE_SIZE=2048, OTEL_BSP_MAX_EXPORT_BATCH_SIZE=512.

3. **Muitos attributes:** Limitar attributes por span. O padrao e 128. Remover attributes desnecessarios ou de alta cardinalidade.

4. **Alta cardinalidade em metricas:** Nunca usar user_id, request_id como labels. Usar labels de baixa cardinalidade (method, status_code, endpoint).

5. **Exporter sincrono:** Verificar que o OTLP exporter usa gRPC (mais eficiente) e nao HTTP. Configurar retry e timeout adequados.`
    }
  ]
};
