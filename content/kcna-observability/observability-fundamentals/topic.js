window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcna-observability/observability-fundamentals'] = {

  theory: `# Observability Fundamentals

## Relevancia no KCNA
> O dominio "Observability" vale **8%** do KCNA. Entenda os tres pilares da observabilidade, ferramentas CNCF e como monitorar clusters Kubernetes.

---

## Os Tres Pilares da Observabilidade

| Pilar | O que responde | Exemplo |
|-------|---------------|---------|
| **Logs** | O que aconteceu? | "Error: connection refused at 10:32:15" |
| **Metrics** | Quanto? Quando? | CPU 85%, memoria 2.3Gi, 500 req/s |
| **Traces** | Como o request fluiu? | Request -> API -> DB -> Cache -> Response (230ms) |

### Logs

Registros textuais de eventos:

\`\`\`text
Tipos de logs no K8s:
  +-- Container logs (stdout/stderr)
  +-- Node logs (kubelet, container runtime)
  +-- Cluster logs (API Server, etcd, scheduler)
  +-- Application logs (sua aplicacao)
\`\`\`

\`\`\`bash
# Logs de um pod
kubectl logs <pod>

# Logs de um container especifico
kubectl logs <pod> -c <container>

# Logs em tempo real
kubectl logs -f <pod>

# Logs anteriores (container que reiniciou)
kubectl logs <pod> --previous
\`\`\`

### Metrics

Dados numericos ao longo do tempo (time series):

\`\`\`text
Tipos de metricas:
  +-- Counter: apenas incrementa (total_requests)
  +-- Gauge: sobe e desce (cpu_usage, memory_usage)
  +-- Histogram: distribuicao (request_duration)
  +-- Summary: percentis (p50, p90, p99)
\`\`\`

### Traces (Distributed Tracing)

Rastreia requests atraves de multiplos servicos:

\`\`\`text
Trace (request completo):
  Span A: API Gateway (5ms)
    +-- Span B: Auth Service (15ms)
    +-- Span C: Order Service (100ms)
          +-- Span D: Database (50ms)
          +-- Span E: Cache (2ms)
  Total: 172ms
\`\`\`

Conceitos:
- **Trace**: caminho completo de um request
- **Span**: operacao individual dentro do trace
- **Context Propagation**: propagar trace ID entre servicos

---

## Prometheus

Sistema de monitoramento e alertas — **CNCF Graduated**:

\`\`\`text
Arquitetura:
  Targets (pods/nodes) --scrape--> Prometheus Server --query--> Grafana
                                        |
                                   TSDB (time series)
                                        |
                                   AlertManager --> Slack/Email/PagerDuty
\`\`\`

### Caracteristicas

| Feature | Descricao |
|---------|-----------|
| **Pull model** | Prometheus faz scrape dos targets |
| **PromQL** | Linguagem de query para metricas |
| **TSDB** | Time Series Database integrada |
| **Service Discovery** | Descobre targets automaticamente no K8s |
| **AlertManager** | Gerencia alertas e notificacoes |

### PromQL Basico

\`\`\`text
# Uso de CPU do container
container_cpu_usage_seconds_total

# Taxa de requests por segundo
rate(http_requests_total[5m])

# 95th percentil de latencia
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
\`\`\`

---

## Grafana

Plataforma de visualizacao — **CNCF (nao e graduated, e um projeto separado)**:

| Feature | Descricao |
|---------|-----------|
| **Dashboards** | Visualizacao de metricas em graficos |
| **Data Sources** | Prometheus, Loki, Tempo, Elasticsearch |
| **Alerting** | Alertas baseados em condicoes |
| **Plugins** | Extensivel com plugins da comunidade |

---

## Fluentd & Fluent Bit

Coleta e roteamento de logs — **Fluentd e CNCF Graduated**:

\`\`\`text
Logs Pipeline:
  Containers --> Fluent Bit (node) --> Fluentd (aggregator) --> Elasticsearch/Loki
                 (leve, coleta)        (pesado, processa)       (armazena)
\`\`\`

| Tool | Uso | Recurso |
|------|-----|---------|
| **Fluentd** | Aggregator, processamento complexo | Ruby, plugins ricos |
| **Fluent Bit** | Agent leve no node | C, baixo consumo |

---

## Jaeger

Distributed tracing — **CNCF Graduated**:

| Componente | Funcao |
|-----------|--------|
| **Agent** | Recebe spans dos servicos |
| **Collector** | Processa e armazena spans |
| **Query** | API e UI para consultar traces |
| **Storage** | Elasticsearch, Cassandra, Kafka |

---

## OpenTelemetry (OTel)

Framework unificado de observabilidade — **CNCF Incubating** (caminhando para Graduated):

\`\`\`text
OpenTelemetry unifica:
  Logs    ---|
  Metrics ---|---> OTel SDK ---> OTel Collector ---> Backend
  Traces  ---|                       |
                              +------+------+
                              |      |      |
                           Jaeger  Prom  Elasticsearch
\`\`\`

| Componente | Funcao |
|-----------|--------|
| **SDK** | Instrumentacao no codigo da aplicacao |
| **Collector** | Recebe, processa e exporta telemetria |
| **OTLP** | Protocolo padrao para enviar telemetria |

OpenTelemetry substitui OpenTracing + OpenCensus em um unico projeto.

---

## Monitoramento no Kubernetes

### metrics-server

Componente que coleta metricas de CPU/memoria dos nodes e pods:

\`\`\`bash
# Prerequisito para kubectl top e HPA
kubectl top nodes
kubectl top pods
kubectl top pods --containers
\`\`\`

### Probes (Health Checks)

| Probe | Funcao | Falha |
|-------|--------|-------|
| **livenessProbe** | Container esta vivo? | Reinicia o container |
| **readinessProbe** | Container aceita trafego? | Remove do Service |
| **startupProbe** | Container iniciou? | Mata o container |

Tipos de probe: httpGet, tcpSocket, exec, gRPC.

### Observability Stack Completa

\`\`\`text
Metricas: Prometheus + Grafana
Logs:     Fluentd/Fluent Bit + Loki/Elasticsearch
Traces:   Jaeger/Tempo + OpenTelemetry
Alertas:  AlertManager + PagerDuty/Slack
\`\`\`
`,

  quiz: [
    {
      question: 'Quais sao os tres pilares da observabilidade?',
      options: ['CPU, memoria, disco', 'Logs, metrics e traces', 'Alertas, dashboards e reports', 'Uptime, latencia e throughput'],
      correct: 1,
      explanation: 'Os tres pilares sao: Logs (o que aconteceu), Metrics (quanto/quando) e Traces (como o request fluiu entre servicos). Juntos fornecem visibilidade completa.',
      reference: 'Conceito relacionado: Tres pilares — logs, metrics, traces.'
    },
    {
      question: 'Qual ferramenta CNCF graduated e o padrao para monitoramento e metricas no Kubernetes?',
      options: ['Grafana', 'Prometheus', 'Datadog', 'Nagios'],
      correct: 1,
      explanation: 'Prometheus e CNCF graduated e o padrao para monitoramento no K8s. Usa pull model (scrape), PromQL para queries e TSDB para armazenar time series.',
      reference: 'Conceito relacionado: Prometheus — arquitetura e PromQL.'
    },
    {
      question: 'O que distributed tracing permite rastrear?',
      options: ['Uso de CPU dos nodes', 'O caminho de um request atraves de multiplos servicos', 'Logs de containers', 'Versoes de imagens'],
      correct: 1,
      explanation: 'Distributed tracing rastreia o caminho completo de um request (trace) com cada operacao (span). Permite identificar gargalos e latencia entre servicos.',
      reference: 'Conceito relacionado: Traces — spans e context propagation.'
    },
    {
      question: 'O que OpenTelemetry (OTel) unifica?',
      options: ['Kubernetes e Docker', 'Logs, metrics e traces em um unico framework de observabilidade', 'CI e CD', 'Rede e storage'],
      correct: 1,
      explanation: 'OpenTelemetry (CNCF incubating) unifica coleta de logs, metricas e traces com SDK, Collector e protocolo OTLP. Substitui OpenTracing + OpenCensus.',
      reference: 'Conceito relacionado: OpenTelemetry — framework unificado.'
    },
    {
      question: 'Qual o modelo de coleta do Prometheus?',
      options: ['Push (aplicacoes enviam metricas)', 'Pull (Prometheus faz scrape dos targets)', 'Streaming (tempo real)', 'Polling via SNMP'],
      correct: 1,
      explanation: 'Prometheus usa pull model: ele faz scrape (HTTP GET) nos endpoints /metrics dos targets em intervalos regulares. Service discovery no K8s descobre targets automaticamente.',
      reference: 'Conceito relacionado: Prometheus — pull model vs push.'
    },
    {
      question: 'Qual probe do Kubernetes remove um pod do Service quando falha?',
      options: ['livenessProbe', 'readinessProbe', 'startupProbe', 'healthProbe'],
      correct: 1,
      explanation: 'readinessProbe: se falha, o pod e removido dos endpoints do Service (nao recebe trafego). livenessProbe: se falha, o container e reiniciado.',
      reference: 'Conceito relacionado: Probes — liveness vs readiness vs startup.'
    },
    {
      question: 'Qual e a diferenca entre Fluentd e Fluent Bit?',
      options: ['Sao a mesma ferramenta', 'Fluentd e aggregator pesado, Fluent Bit e agent leve para coleta nos nodes', 'Fluent Bit e mais antigo', 'Fluentd so funciona com Elasticsearch'],
      correct: 1,
      explanation: 'Fluent Bit: agent leve em C, roda nos nodes coletando logs. Fluentd: aggregator em Ruby, processa e roteia logs. Pattern: Fluent Bit (coleta) -> Fluentd (processa) -> Backend.',
      reference: 'Conceito relacionado: Fluentd vs Fluent Bit — roles diferentes.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os tres pilares da observabilidade?', back: 'Logs: o que aconteceu (texto/eventos). Metrics: quanto/quando (time series). Traces: como o request fluiu (spans entre servicos). Juntos dao visibilidade completa do sistema.' },
    { front: 'O que e Prometheus e como funciona?', back: 'Sistema de monitoramento CNCF graduated. Pull model: faz scrape dos targets via /metrics. PromQL para queries. TSDB integrada. AlertManager para alertas. Service discovery nativo no K8s.' },
    { front: 'O que e distributed tracing?', back: 'Rastreia requests entre multiplos servicos. Trace = caminho completo. Span = operacao individual. Context propagation = propagar trace ID entre servicos. Ferramentas: Jaeger (CNCF graduated), Tempo.' },
    { front: 'O que e OpenTelemetry?', back: 'Framework CNCF que unifica logs, metrics e traces. SDK para instrumentacao. Collector para receber/processar/exportar. OTLP como protocolo padrao. Substitui OpenTracing + OpenCensus.' },
    { front: 'Qual a diferenca entre Fluentd e Fluent Bit?', back: 'Fluent Bit: agent leve (C), roda como DaemonSet nos nodes, coleta logs. Fluentd: aggregator (Ruby), processa e roteia logs. Fluentd e CNCF graduated. Ambos do projeto Fluent.' },
    { front: 'Quais sao os tipos de probes no K8s?', back: 'livenessProbe: container vivo? (falha = reinicia). readinessProbe: aceita trafego? (falha = remove do Service). startupProbe: iniciou? (falha = mata). Tipos: httpGet, tcpSocket, exec, gRPC.' },
    { front: 'O que e metrics-server?', back: 'Componente que coleta metricas de CPU/memoria de nodes e pods. Prerequisito para kubectl top e HPA. Nao armazena historico (apenas metricas atuais). Para historico, usar Prometheus.' },
    { front: 'Qual a observability stack completa no K8s?', back: 'Metricas: Prometheus + Grafana. Logs: Fluent Bit/Fluentd + Loki/Elasticsearch. Traces: Jaeger/Tempo + OpenTelemetry. Alertas: AlertManager + PagerDuty/Slack.' }
  ],

  lab: {
    scenario: 'Voce esta explorando as capacidades de observabilidade do Kubernetes.',
    objective: 'Entender como monitorar pods, coletar logs e verificar health checks no Kubernetes.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Explorar Logs do Cluster',
        instruction: 'Colete e analise logs de pods e componentes do cluster.',
        hints: ['Use kubectl logs para ver logs de pods', 'Verifique logs dos componentes do kube-system', 'Use --previous para logs de containers reiniciados'],
        solution: '```bash\n# Criar pod de teste\nkubectl run log-test --image=busybox --restart=Never -- sh -c "echo \'App started\'; sleep 3600"\n\n# Ver logs do pod\nkubectl logs log-test\n\n# Ver logs de componentes do cluster\nkubectl logs -n kube-system -l component=kube-apiserver --tail=5 2>/dev/null || echo "Sem acesso direto aos logs do API Server"\n\n# Ver logs do CoreDNS\nkubectl logs -n kube-system -l k8s-app=kube-dns --tail=10\n```',
        verify: '```bash\nkubectl logs log-test\n# Saida esperada: "App started"\n\nkubectl logs -n kube-system -l k8s-app=kube-dns --tail=3\n# Saida esperada: logs do CoreDNS\n```'
      },
      {
        title: 'Verificar Metricas (metrics-server)',
        instruction: 'Use kubectl top para verificar consumo de recursos dos nodes e pods.',
        hints: ['kubectl top nodes mostra CPU/memoria dos nodes', 'kubectl top pods mostra CPU/memoria dos pods', 'metrics-server precisa estar instalado'],
        solution: '```bash\n# Verificar se metrics-server esta instalado\nkubectl get pods -n kube-system | grep metrics-server\n\n# Metricas dos nodes\nkubectl top nodes\n\n# Metricas dos pods\nkubectl top pods -A | head -10\n\n# Metricas por container\nkubectl top pods --containers | head -10\n```',
        verify: '```bash\nkubectl top nodes 2>/dev/null && echo "metrics-server funcionando" || echo "metrics-server nao instalado"\n# Saida esperada: metricas de CPU/memoria dos nodes (se metrics-server instalado)\n```'
      },
      {
        title: 'Testar Health Checks (Probes)',
        instruction: 'Crie um pod com liveness e readiness probes e observe o comportamento quando falham.',
        hints: ['livenessProbe reinicia o container quando falha', 'readinessProbe remove do Service', 'Use httpGet probe para testar endpoint HTTP'],
        solution: '```bash\n# Criar pod com probes\nkubectl run probe-test --image=nginx:1.25-alpine --port=80\n\n# Verificar que o pod esta saudavel\nkubectl describe pod probe-test | grep -A 10 "Conditions"\n\n# Ver eventos relacionados a probes\nkubectl describe pod probe-test | grep -A 5 "Events"\n\n# Ver status de readiness\nkubectl get pod probe-test -o jsonpath="{.status.conditions[?(@.type==\'Ready\')].status}"\necho ""\n```',
        verify: '```bash\nkubectl get pod probe-test -o jsonpath="{.status.conditions[?(@.type==\'Ready\')].status}"\n# Saida esperada: True\n\nkubectl get pod probe-test\n# Saida esperada: Running, READY 1/1\n```'
      }
    ]
  },

  troubleshooting: []
};
