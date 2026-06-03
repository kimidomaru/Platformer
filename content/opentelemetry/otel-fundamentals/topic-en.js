window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['opentelemetry/otel-fundamentals'] = {
  theory: `
# OpenTelemetry Fundamentals

## Relevance
OpenTelemetry (OTel) is the CNCF observability project that unifies the collection of traces, metrics, and logs in a single framework. It is the second most active CNCF project (behind Kubernetes) and the de facto standard for cloud-native application instrumentation. It replaces OpenTracing and OpenCensus.

## Fundamental Concepts

### What is OpenTelemetry?

OpenTelemetry is a vendor-neutral observability framework that provides APIs, SDKs, and tools to instrument, generate, collect, and export telemetry data:

\`\`\`
┌─────────────────────────────────────────────────┐
│              OpenTelemetry                      │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Traces  │  │ Metrics  │  │   Logs   │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│       ▼              ▼              ▼           │
│  ┌─────────────────────────────────────┐       │
│  │          OTel SDK / API             │       │
│  └──────────────┬──────────────────────┘       │
│                 ▼                               │
│  ┌─────────────────────────────────────┐       │
│  │        OTel Collector               │       │
│  │  Receivers → Processors → Exporters │       │
│  └──────────────┬──────────────────────┘       │
│       ┌─────────┼─────────┐                    │
│       ▼         ▼         ▼                    │
│    Jaeger    Prometheus   Loki                 │
│    Tempo     Datadog      Elastic              │
└─────────────────────────────────────────────────┘
\`\`\`

### The Three Signals (Pillars) of Observability

| Signal | What it measures | Example |
|--------|-----------------|---------|
| **Traces** | Flow of a request across services | Request path: API → Auth → DB → Response |
| **Metrics** | Numeric values over time | request_count, latency_p99, cpu_usage |
| **Logs** | Discrete events with context | "Error: connection refused to database" |

### OTLP — OpenTelemetry Protocol

OTLP is the native OpenTelemetry protocol for transmitting telemetry data:

\`\`\`
┌──────────┐    OTLP/gRPC (4317)    ┌───────────┐
│  App +   │ ──────────────────────→ │   OTel    │
│  OTel SDK│    OTLP/HTTP (4318)    │ Collector │
└──────────┘ ──────────────────────→ └───────────┘
\`\`\`

**Default ports:**
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
│   │   └── Duration: 15ms
│   │
│   └── Span: db.query (Child Span)
│       ├── SpanID: span-3, ParentID: span-1
│       └── Attributes: db.system=postgresql
\`\`\`

**Tracing Concepts:**
- **Trace:** Complete journey of a request
- **Span:** Unit of work within a trace
- **SpanContext:** TraceID + SpanID (propagated between services)
- **Attributes:** Key-value pairs with metadata
- **Events:** Logs associated with a span
- **Status:** OK, ERROR, UNSET

### Context Propagation

\`\`\`
Service A                   Service B
┌──────────┐  HTTP Header  ┌──────────┐
│ Span A   │──────────────→│ Span B   │
│ TraceID:x│  traceparent  │ TraceID:x│
│ SpanID:1 │  00-x-1-01   │ SpanID:2 │
└──────────┘               └──────────┘

W3C Trace Context Header:
traceparent: 00-{trace-id}-{span-id}-{trace-flags}
\`\`\`

### Metrics

| Type | Description | Example |
|------|-------------|---------|
| Counter | Only goes up | request_total |
| UpDownCounter | Goes up and down | active_connections |
| Histogram | Distribution of values | request_duration_seconds |
| Gauge | Current point-in-time value | cpu_temperature |

### Logs

OpenTelemetry unifies logs with traces and metrics by adding correlation:

\`\`\`
LogRecord:
  Timestamp: 2024-01-15T10:30:00Z
  SeverityText: ERROR
  Body: "Failed to process order"
  Attributes:
    order.id: "ORD-123"
  TraceID: abc123       ← Correlation with trace!
  SpanID: span-3        ← Correlation with span!
  Resource:
    service.name: "order-service"
\`\`\`

### Resource and Semantic Conventions

\`\`\`
Resource: metadata identifying the data origin
  service.name: "order-service"
  service.version: "1.2.0"
  deployment.environment: "production"
  k8s.namespace.name: "production"
  k8s.pod.name: "order-service-7b9f4"

Semantic Conventions: standardized names
  http.request.method: "GET"
  http.response.status_code: 200
  db.system: "postgresql"
  rpc.system: "grpc"
\`\`\`

### Instrumentation

\`\`\`
Automatic (zero-code):
  - Java Agent (-javaagent:otel.jar)
  - Python (opentelemetry-instrument)
  - Node.js (@opentelemetry/auto-*)
  - .NET (auto-instrumentation)

Manual:
  - SDK to create custom spans
  - Add attributes and events
  - Instrument business logic

Library instrumentation:
  - HTTP, gRPC, SQL, Redis, Kafka
\`\`\`

### Sampling

| Strategy | Description | Usage |
|----------|-------------|-------|
| AlwaysOn | Sample 100% | Dev/staging |
| AlwaysOff | Don't sample | Disable tracing |
| TraceIdRatio | Sample X% | Production (e.g., 10%) |
| ParentBased | Follow parent decision | Consistent propagation |
| Tail-based | Decide after complete trace | Collector (keep errors) |

### Common Mistakes

1. **Instrumenting everything** — sampling is essential in production (not 100%)
2. **Ignoring semantic conventions** — non-standard names make queries difficult
3. **Not propagating context** — traces become fragmented between services
4. **SDK without batch processor** — sending each span individually overloads
5. **Not adding resource attributes** — without service.name can't identify origin
6. **Confusing API with SDK** — API is the interface, SDK is the implementation

## Killer.sh Style Challenge

> **Scenario:** Instrument a Go microservice with OpenTelemetry: (1) traces with HTTP and gRPC spans, (2) custom business metrics, (3) log correlation with TraceID, (4) export via OTLP to a Collector.
`,
  quiz: [
    {
      question: 'What are the three signals (pillars) of OpenTelemetry?',
      options: [
        'CPU, Memory, Disk',
        'Traces, Metrics, Logs',
        'HTTP, gRPC, GraphQL',
        'Prometheus, Grafana, Loki'
      ],
      correct: 1,
      explanation: 'The three signals are: Traces (request flow across services), Metrics (numeric values over time), and Logs (discrete events with context). OTel unifies the collection of all three.',
      reference: 'Related concept: Logs can be correlated with Traces via TraceID and SpanID.'
    },
    {
      question: 'What is OTLP?',
      options: [
        'An observability database',
        'The native OpenTelemetry protocol for transmitting telemetry data',
        'A monitoring tool',
        'A log format'
      ],
      correct: 1,
      explanation: 'OTLP (OpenTelemetry Protocol) is the standard protocol for transmitting traces, metrics, and logs. Supports gRPC (port 4317) and HTTP (port 4318).',
      reference: 'Related concept: OTLP is vendor-neutral — any backend supporting OTLP can receive data.'
    },
    {
      question: 'What is a Span in the context of distributed tracing?',
      options: [
        'A latency metric',
        'A unit of work within a trace, with start, end, attributes, and parent-child relationship',
        'An error log',
        'A network connection'
      ],
      correct: 1,
      explanation: 'A Span represents an operation (HTTP request, DB query, RPC call). It has SpanID, TraceID, duration, status, attributes, and can have child spans. The Root Span is the first span of the trace.',
      reference: 'Related concept: SpanContext (TraceID + SpanID) is propagated via HTTP headers (W3C Trace Context).'
    },
    {
      question: 'How does OpenTelemetry propagate context between services?',
      options: [
        'Via shared database',
        'Via standardized HTTP headers (W3C Trace Context: traceparent)',
        'Via configuration file',
        'Via DNS'
      ],
      correct: 1,
      explanation: 'The W3C Trace Context uses the traceparent header (format: 00-{trace-id}-{span-id}-{trace-flags}) to propagate TraceID and SpanID between services, keeping the trace connected.',
      reference: 'Related concept: Baggage is another header that propagates custom key-value pairs.'
    },
    {
      question: 'What is the difference between automatic and manual instrumentation?',
      options: [
        'Automatic is more precise',
        'Automatic instruments frameworks/libs without code changes; manual creates custom spans in business logic',
        'Manual is deprecated',
        'There is no difference'
      ],
      correct: 1,
      explanation: 'Auto-instrumentation (e.g., Java Agent) captures HTTP, gRPC, DB automatically. Manual instrumentation uses the SDK to create custom spans in business logic (e.g., "process order").',
      reference: 'Related concept: Combine both — auto for frameworks, manual for specific business logic.'
    },
    {
      question: 'Why is sampling important in production?',
      options: [
        'To reduce costs and overhead — collecting 100% of traces is unfeasible at high volume',
        'To improve data accuracy',
        'For compatibility with old backends',
        'It\'s not important, everything should be collected'
      ],
      correct: 0,
      explanation: 'In production with high volume, collecting 100% of traces generates CPU/network overhead and storage costs. Sampling (e.g., 10%) reduces volume while maintaining representativeness. Tail-based sampling in the Collector allows keeping 100% of errors.',
      reference: 'Related concept: ParentBased + TraceIdRatio is the most common combination in production.'
    },
    {
      question: 'What are Semantic Conventions in OpenTelemetry?',
      options: [
        'Log formatting rules',
        'Standardized names for attributes and resources that ensure consistency across instrumentations',
        'Metric types',
        'Network protocols'
      ],
      correct: 1,
      explanation: 'Semantic Conventions define standard names like http.request.method, db.system, service.name. They ensure different instrumentations use the same names, facilitating queries and dashboards.',
      reference: 'Related concept: Semantic Conventions cover HTTP, DB, RPC, messaging, cloud resources, K8s, etc.'
    }
  ],
  flashcards: [
    {
      front: 'What is OpenTelemetry and its relationship with OpenTracing/OpenCensus?',
      back: '**OpenTelemetry (OTel)** = CNCF observability framework.\n\n**Unifies:** APIs, SDKs, and tools for traces, metrics, and logs.\n\n**History:**\n- OpenTracing → standard tracing API\n- OpenCensus → tracing + metrics (Google)\n- OpenTelemetry → merge of both (2019)\n\n**Characteristics:**\n- Vendor-neutral\n- Standard OTLP protocol\n- Semantic conventions\n- Auto-instrumentation\n- Second most active CNCF project'
    },
    {
      front: 'What are Traces, Spans, and SpanContext?',
      back: '**Trace:** Complete journey of a request across all services. Identified by TraceID.\n\n**Span:** Unit of work within the trace.\n- Unique SpanID\n- ParentSpanID (parent-child relation)\n- Start/End time\n- Status (OK/ERROR)\n- Attributes (key-value)\n- Events (logs in span)\n\n**SpanContext:** TraceID + SpanID propagated between services via headers (W3C traceparent).\n\n**Root Span:** First span of the trace (no parent).'
    },
    {
      front: 'Which metric types does OpenTelemetry support?',
      back: '| Type | Description | Example |\n|------|-------------|--------|\n| **Counter** | Only goes up | request_total |\n| **UpDownCounter** | Goes up/down | active_requests |\n| **Histogram** | Distribution | request_duration |\n| **Gauge** | Point-in-time | temperature |\n\n**Difference from Prometheus:**\n- OTel uses different names (http.server.request.duration)\n- OTel follows Semantic Conventions\n- OTel exports to any backend via OTLP\n- Prometheus is one possible backend'
    },
    {
      front: 'How does Log correlation with Traces work?',
      back: '**Correlation:** Each LogRecord can include TraceID and SpanID.\n\n**Benefit:** When investigating a trace with errors, you can see the exact logs from that request.\n\n**Implementation:**\n1. SDK injects TraceID/SpanID into LogRecord\n2. Or: log framework (logrus, zap) with OTel bridge\n3. Logs exported with TraceID via OTLP\n\n**Query:** In Grafana, click a trace to see correlated logs (Tempo → Loki).'
    },
    {
      front: 'What is the OTel Collector and why use it?',
      back: '**Collector** = proxy/pipeline for telemetry data.\n\n**Why use (instead of sending directly):**\n- Decoupling (app doesn\'t need to know backend)\n- Batching and retry\n- Processing (filtering, enrichment)\n- Multi-export (send to multiple backends)\n- Reduces app load\n\n**Components:**\n- Receivers: receive data (OTLP, Prometheus)\n- Processors: transform (batch, filter, enrich)\n- Exporters: send to backends\n\n**Ports:** 4317 (gRPC), 4318 (HTTP)'
    },
    {
      front: 'What Sampling strategies exist?',
      back: '**Head-based (SDK):**\n- AlwaysOn: 100% (dev)\n- AlwaysOff: 0%\n- TraceIdRatio: X% (e.g., 10%)\n- ParentBased: follows parent decision\n\n**Tail-based (Collector):**\n- Decides AFTER trace completion\n- Can keep all traces with errors\n- Requires more Collector memory\n\n**Production recommendation:**\n- ParentBased + TraceIdRatio(0.1) in SDK\n- Tail-based in Collector for errors\n- Result: ~10% normal + 100% errors'
    },
    {
      front: 'What are Semantic Conventions and Resource Attributes?',
      back: '**Semantic Conventions:**\nStandardized attribute names:\n- http.request.method, http.response.status_code\n- db.system, db.statement\n- rpc.system, rpc.method\n- messaging.system, messaging.destination\n\n**Resource Attributes:**\nData origin metadata:\n- service.name (REQUIRED)\n- service.version\n- deployment.environment\n- k8s.namespace.name\n- k8s.pod.name\n- cloud.provider, cloud.region\n\n**Why it matters:** Consistency in queries and dashboards.'
    }
  ],
  lab: {
    scenario: 'You need to understand the basic concepts of OpenTelemetry: traces, metrics, logs, and the OTLP protocol.',
    objective: 'Learn the structure of traces/spans, metric types, log correlation, and basic SDK configuration.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Analyze the structure of a Trace',
        instruction: `Given the scenario: an API service receives an HTTP GET /api/orders, calls an Auth service, and then queries the PostgreSQL database. Draw (in YAML/text) the trace structure with:
1. Root Span: HTTP GET /api/orders (200ms)
2. Child Span: auth.validate (20ms)
3. Child Span: db.query SELECT * FROM orders (50ms)
Include TraceID, SpanIDs, ParentIDs, and relevant attributes following Semantic Conventions.`,
        hints: [
          'Root Span has no ParentSpanID',
          'Child Spans reference the parent SpanID as ParentSpanID',
          'All spans share the same TraceID',
          'Use Semantic Conventions: http.request.method, db.system, db.statement'
        ],
        solution: `\`\`\`yaml
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

    - spanId: "a1b2c3d4e5f60001"
      parentSpanId: "00f067aa0ba902b7"
      name: "auth.validate"
      kind: CLIENT
      startTime: "2024-01-15T10:30:00.010Z"
      endTime: "2024-01-15T10:30:00.030Z"
      attributes:
        rpc.system: "grpc"
        rpc.method: "Validate"

    - spanId: "a1b2c3d4e5f60002"
      parentSpanId: "00f067aa0ba902b7"
      name: "db.query"
      kind: CLIENT
      startTime: "2024-01-15T10:30:00.040Z"
      endTime: "2024-01-15T10:30:00.090Z"
      attributes:
        db.system: "postgresql"
        db.statement: "SELECT * FROM orders WHERE user_id = 42"
\`\`\``,
        verify: `\`\`\`bash
# Verify trace structure:
# 1. All spans have same traceId? YES
# 2. Root span has parentSpanId: null? YES
# 3. Child spans reference correct parentSpanId? YES
# 4. Attributes follow Semantic Conventions? YES
echo "Trace structure validated"
\`\`\``
      },
      {
        title: 'Define metrics with correct types',
        instruction: `For an order-service, define the following metrics using correct OpenTelemetry types:
1. Total orders processed (only goes up)
2. Active orders being processed (goes up and down)
3. Order processing duration (distribution)
4. Total revenue from processed orders (only goes up)
For each metric, specify: name, OTel type, unit, and labels.`,
        hints: [
          'Counter for values that only go up',
          'UpDownCounter for values that go up and down',
          'Histogram for distributions (latency)',
          'Names should be descriptive: orders.processed.total'
        ],
        solution: `\`\`\`yaml
metrics:
  - name: orders.processed.total
    type: Counter
    unit: "{order}"
    description: Total orders processed
    labels: [status, payment_method]

  - name: orders.active
    type: UpDownCounter
    unit: "{order}"
    description: Orders currently being processed
    labels: [priority]

  - name: orders.processing.duration
    type: Histogram
    unit: "ms"
    description: Order processing duration
    buckets: [10, 50, 100, 250, 500, 1000, 5000]
    labels: [payment_method]

  - name: orders.revenue.total
    type: Counter
    unit: "BRL"
    description: Total revenue from processed orders
    labels: [payment_method]
\`\`\``,
        verify: `\`\`\`bash
# Verify metrics:
# Counter for monotonic values? YES
# UpDownCounter for variable values? YES
# Histogram for distributions? YES
# Low cardinality labels? YES
echo "Metrics definition validated"
\`\`\``
      },
      {
        title: 'Configure SDK environment variables',
        instruction: `Configure the OpenTelemetry SDK environment variables for an application:
1. Service name: order-service
2. Service version: 1.2.0
3. Environment: production
4. Exporter: OTLP via gRPC to otel-collector.observability:4317
5. Sampling: 10% (TraceIdRatio)
6. Propagators: W3C tracecontext and baggage`,
        hints: [
          'OTEL_SERVICE_NAME defines the service name',
          'OTEL_EXPORTER_OTLP_ENDPOINT defines the collector endpoint',
          'OTEL_TRACES_SAMPLER and OTEL_TRACES_SAMPLER_ARG configure sampling',
          'OTEL_PROPAGATORS defines the propagators'
        ],
        solution: `\`\`\`bash
export OTEL_SERVICE_NAME="order-service"
export OTEL_RESOURCE_ATTRIBUTES="service.version=1.2.0,deployment.environment=production"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://otel-collector.observability:4317"
export OTEL_EXPORTER_OTLP_PROTOCOL="grpc"
export OTEL_TRACES_SAMPLER="parentbased_traceidratio"
export OTEL_TRACES_SAMPLER_ARG="0.1"
export OTEL_PROPAGATORS="tracecontext,baggage"
export OTEL_LOGS_EXPORTER="otlp"
export OTEL_METRICS_EXPORTER="otlp"
\`\`\``,
        verify: `\`\`\`bash
echo \$OTEL_SERVICE_NAME
# Expected: order-service

echo \$OTEL_EXPORTER_OTLP_ENDPOINT
# Expected: http://otel-collector.observability:4317

echo \$OTEL_TRACES_SAMPLER
# Expected: parentbased_traceidratio
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Traces not appearing in backend (Jaeger/Tempo)',
      difficulty: 'easy',
      symptom: 'The application is instrumented with OpenTelemetry but no traces appear in Jaeger or Grafana Tempo.',
      diagnosis: `\`\`\`bash
# 1. Check if SDK is configured
env | grep OTEL
# OTEL_SERVICE_NAME and OTEL_EXPORTER_OTLP_ENDPOINT must be set

# 2. Check connectivity to Collector
curl -v http://otel-collector.observability:4318/v1/traces

# 3. Check if Collector is receiving
kubectl logs -n observability deploy/otel-collector | grep -i "traces"

# 4. Check sampling
# If OTEL_TRACES_SAMPLER_ARG=0.01, only 1% sampled
\`\`\``,
      solution: `**Causes and solutions:**

1. **SDK not configured:** Verify OTEL_SERVICE_NAME and OTEL_EXPORTER_OTLP_ENDPOINT are defined. Without endpoint, SDK discards data.

2. **Collector not accessible:** Verify the Collector Service is correct and accessible from the app pod. Test with curl.

3. **Sampling too low:** Increase OTEL_TRACES_SAMPLER_ARG to 1.0 temporarily to confirm traces arrive. Then adjust for production.

4. **Wrong exporter:** If endpoint uses gRPC (port 4317), OTEL_EXPORTER_OTLP_PROTOCOL must be "grpc". If HTTP (4318), use "http/protobuf".

5. **Collector not exporting to backend:** Check Collector configuration — the exporter must point to Jaeger/Tempo.`
    },
    {
      title: 'Fragmented traces — spans don\'t connect',
      difficulty: 'medium',
      symptom: 'Traces appear in the backend but are fragmented — spans from different services appear as separate traces instead of a single trace.',
      diagnosis: `\`\`\`bash
# 1. Check if context propagation is enabled
env | grep OTEL_PROPAGATORS
# Should be: tracecontext,baggage

# 2. Check HTTP headers between services
# The "traceparent" header must be present

# 3. Check if HTTP client is instrumented

# 4. Check if all services use the same format
# Mixing W3C with B3 (Zipkin) causes fragmentation
\`\`\``,
      solution: `**Causes and solutions:**

1. **Context propagation not configured:** All services must have OTEL_PROPAGATORS=tracecontext,baggage.

2. **HTTP client not instrumented:** Auto-instrumentation usually covers HTTP clients, but verify the library is included.

3. **Inconsistent propagation format:** All services must use the same format (W3C tracecontext). Mixing with B3 (Zipkin) causes fragmentation.

4. **Proxies/gateways removing headers:** Check if proxies, API gateways, or load balancers are removing the traceparent header.

5. **Async/messaging:** For async communication (Kafka, RabbitMQ), inject context in message headers.`
    },
    {
      title: 'High latency and memory usage from SDK',
      difficulty: 'hard',
      symptom: 'After instrumenting with OpenTelemetry, the application shows significant increase in latency and memory usage.',
      diagnosis: `\`\`\`bash
# 1. Check sampling rate
echo \$OTEL_TRACES_SAMPLER_ARG
# If 1.0 (100%), too high for production

# 2. Check batch processor
# SDK should use BatchSpanProcessor, not SimpleSpanProcessor

# 3. Check attribute count per span
# Too many custom attributes = more memory

# 4. Check if metrics have high cardinality
# Labels with user_id, request_id = series explosion
\`\`\``,
      solution: `**Causes and solutions:**

1. **100% sampling:** Reduce to 10-20% with parentbased_traceidratio. Use tail-based sampling in Collector to keep error traces.

2. **SimpleSpanProcessor:** Switch to BatchSpanProcessor. Configure: OTEL_BSP_MAX_QUEUE_SIZE=2048, OTEL_BSP_MAX_EXPORT_BATCH_SIZE=512.

3. **Too many attributes:** Limit attributes per span. Default is 128. Remove unnecessary or high-cardinality attributes.

4. **High cardinality metrics:** Never use user_id, request_id as labels. Use low-cardinality labels (method, status_code, endpoint).

5. **Synchronous exporter:** Verify OTLP exporter uses gRPC (more efficient). Configure appropriate retry and timeout.`
    }
  ]
};
