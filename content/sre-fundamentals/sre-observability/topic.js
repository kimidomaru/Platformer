window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['sre-fundamentals/sre-observability'] = {
  theory: `
# Estrategia de Observabilidade — Metricas, Logs & Traces

## Relevancia
Observabilidade e a capacidade de entender o estado interno de um sistema a partir de seus outputs. Para SREs, e a ferramenta principal para detectar, diagnosticar e resolver problemas. Os tres pilares — metricas, logs e traces — se complementam e juntos fornecem visibilidade completa.

## Conceitos Fundamentais

### Os Tres Pilares da Observabilidade

\`\`\`
                    OBSERVABILIDADE
                    /      |      \\
               Metricas   Logs   Traces
               (O que?)  (Por que?) (Onde?)

  Metricas: numericas, agregadas, baratas → detectar
  Logs:     textuais, detalhados, volumosos → diagnosticar
  Traces:   requests individuais, distribuidos → rastrear
\`\`\`

### Metricas

Dados numericos agregados ao longo do tempo. Ideais para alertas e dashboards.

**Tipos de metricas (Prometheus):**

| Tipo | Descricao | Exemplo |
|------|-----------|---------|
| **Counter** | Valor que so cresce | \`http_requests_total\` |
| **Gauge** | Valor que sobe e desce | \`temperature_celsius\` |
| **Histogram** | Distribuicao de valores em buckets | \`request_duration_seconds\` |
| **Summary** | Quantis pre-calculados | \`request_duration_quantile\` |

**USE Method (para recursos — CPU, memoria, disco):**
\`\`\`
U — Utilization: % do recurso em uso
S — Saturation:  fila de trabalho pendente
E — Errors:      contagem de erros
\`\`\`

**RED Method (para servicos — APIs, microservicos):**
\`\`\`
R — Rate:     requisicoes por segundo
E — Errors:   requisicoes com erro
D — Duration: latencia das requisicoes
\`\`\`

**Four Golden Signals (Google SRE):**
\`\`\`
1. Latency:    tempo de resposta (separar sucesso de erro)
2. Traffic:    requisicoes por segundo
3. Errors:     taxa de requisicoes com falha
4. Saturation: quao "cheio" o servico esta
\`\`\`

### Logs

Registros textuais de eventos individuais. Essenciais para debugging.

**Niveis de log (severidade):**
\`\`\`
TRACE → DEBUG → INFO → WARN → ERROR → FATAL
  |                      |              |
  Em dev apenas         Normal      Requer acao
\`\`\`

**Structured logging (formato recomendado):**
\`\`\`json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "level": "ERROR",
  "service": "payment-api",
  "trace_id": "abc123def456",
  "span_id": "789ghi",
  "message": "Payment processing failed",
  "error": "timeout connecting to stripe",
  "duration_ms": 5003,
  "user_id": "user-42",
  "amount": 99.99
}
\`\`\`

**Logging em Kubernetes:**
\`\`\`bash
# Logs do pod
kubectl logs <pod-name> -n <namespace>

# Follow (stream)
kubectl logs -f <pod-name>

# Container especifico em pod multi-container
kubectl logs <pod-name> -c <container-name>

# Logs anteriores (pod que reiniciou)
kubectl logs <pod-name> --previous

# Ultimos N minutos
kubectl logs <pod-name> --since=30m

# Todos os pods de um Deployment
kubectl logs -l app=my-app -n production --all-containers
\`\`\`

**Stack de logging em K8s:**
\`\`\`
Pods → stdout/stderr
  → Node (kubelet coleta logs)
    → Fluentd/Fluent Bit (DaemonSet)
      → Elasticsearch/Loki
        → Kibana/Grafana (visualizacao)
\`\`\`

### Distributed Tracing

Rastreamento de uma requisicao individual atraves de multiplos servicos.

\`\`\`
Usuario → API Gateway → Auth Service → Payment Service → Database
  |          |              |                |               |
  +---- trace_id: abc123 ---------------------------------->|
             |              |                |
         span_id: 001  span_id: 002    span_id: 003
         parent: -     parent: 001     parent: 002
\`\`\`

**Conceitos-chave:**
- **Trace**: caminho completo de uma requisicao
- **Span**: uma operacao individual dentro do trace
- **Context propagation**: headers que carregam trace_id entre servicos

**OpenTelemetry (padrao CNCF):**
\`\`\`yaml
# OpenTelemetry Collector DaemonSet
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: otel-collector
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: otel-collector
  template:
    metadata:
      labels:
        app: otel-collector
    spec:
      containers:
        - name: collector
          image: otel/opentelemetry-collector:latest
          ports:
            - containerPort: 4317  # gRPC OTLP
            - containerPort: 4318  # HTTP OTLP
          volumeMounts:
            - name: config
              mountPath: /etc/otel
      volumes:
        - name: config
          configMap:
            name: otel-collector-config
\`\`\`

### Correlacao entre Pilares

A verdadeira observabilidade conecta metricas, logs e traces:

\`\`\`
1. Metrica alerta: "taxa de erro > 5%"
   → Dashboard mostra spike de erros
2. Logs filtrados por timestamp do spike
   → "timeout connecting to database"
3. Trace de uma requisicao com erro
   → Span do database mostra 5s de latencia
4. Root cause: connection pool esgotado
\`\`\`

**Exemplar (ligando metrica a trace):**
\`\`\`yaml
# Prometheus com exemplars
# Metrica com referencia ao trace
http_request_duration_seconds_bucket{le="0.5"} 12345 # {trace_id="abc123"}
\`\`\`

### Alerting Strategy

\`\`\`
Nivel de Alerta:
  Page (PagerDuty/telefone):
    - SLO burn rate critico
    - Servico completamente down
    - Dados corrompidos

  Ticket (Jira/Slack):
    - SLO burn rate elevado
    - Latencia acima do p99
    - Disco > 85%

  Log/Dashboard:
    - Metricas fora do baseline
    - Warnings de deprecacao
    - Padroes anomalos
\`\`\`

## Implementacao Pratica em Kubernetes

### Monitoramento com kube-prometheus-stack

\`\`\`bash
# Instalar kube-prometheus-stack (Prometheus + Grafana + AlertManager)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack \\
  --namespace monitoring --create-namespace \\
  --set grafana.adminPassword=admin \\
  --set prometheus.prometheusSpec.retention=30d
\`\`\`

### Logging com Loki + Promtail

\`\`\`bash
# Instalar Loki stack
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki-stack \\
  --namespace monitoring \\
  --set promtail.enabled=true \\
  --set loki.persistence.enabled=true
\`\`\`

### ServiceMonitor para aplicacoes custom

\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app-monitor
  namespace: monitoring
  labels:
    release: monitoring
spec:
  namespaceSelector:
    matchNames:
      - production
  selector:
    matchLabels:
      app: my-app
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Metricas
kubectl top nodes
kubectl top pods -n production --sort-by=memory
kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes

# Logs
kubectl logs -f deployment/my-app -n production --all-containers
kubectl logs --since=1h -l app=my-app -n production | grep ERROR
kubectl logs <pod> --previous  # logs do container anterior

# Eventos
kubectl get events -n production --sort-by='.lastTimestamp'
kubectl get events --field-selector type=Warning -n production

# Debug
kubectl describe pod <pod-name> -n production
kubectl exec -it <pod-name> -n production -- /bin/sh
kubectl debug node/<node-name> --image=busybox

# Prometheus
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090
kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80
\`\`\`

## Erros Comuns

1. **Alertar em metricas de infraestrutura em vez de SLIs**: Alerte no que o usuario sente, nao em CPU/memoria.
2. **Logs sem estrutura**: Logs em texto livre sao dificeis de pesquisar. Use structured logging (JSON).
3. **Nao correlacionar logs com traces**: Sem trace_id nos logs, e impossivel rastrear uma requisicao entre servicos.
4. **Muitos alertas**: Alert fatigue — o time ignora alertas reais. Priorize: page apenas para impacto ao usuario.
5. **Monitorar tudo, entender nada**: Colete metricas com proposito. USE para recursos, RED para servicos.
6. **Nao reter logs suficientes**: Retenha pelo menos 30 dias. Incidentes sao frequentemente investigados dias depois.

## Killer.sh Style Challenge

**Cenario:** Configure uma stack de observabilidade completa para um servico em Kubernetes.

**Tarefas:**
1. Instale kube-prometheus-stack com Helm
2. Configure um ServiceMonitor para sua aplicacao
3. Configure logging com Loki e correlacione com metricas
4. Configure alertas baseados nos Four Golden Signals
5. Crie um dashboard Grafana com metricas USE e RED
`,
  quiz: [
    {
      question: 'Quais sao os tres pilares da observabilidade?',
      options: [
        'CPU, Memoria e Disco',
        'Alertas, Dashboards e Runbooks',
        'Metricas, Logs e Traces',
        'Prometheus, Grafana e Loki'
      ],
      correct: 2,
      explanation: 'Os tres pilares da observabilidade sao Metricas (dados numericos agregados — "o que esta acontecendo?"), Logs (registros textuais detalhados — "por que esta acontecendo?") e Traces (rastreamento de requisicoes distribuidas — "onde esta acontecendo?"). Cada pilar tem forcas e fraquezas que se complementam.',
      reference: 'Conceito relacionado: sre-principles — SLIs sao baseados em metricas de observabilidade.'
    },
    {
      question: 'Qual a diferenca entre USE Method e RED Method?',
      options: [
        'USE e para servicos, RED e para recursos',
        'USE (Utilization/Saturation/Errors) e para recursos de infraestrutura; RED (Rate/Errors/Duration) e para servicos e APIs',
        'USE e para logs, RED e para metricas',
        'Nao ha diferenca — sao a mesma coisa'
      ],
      correct: 1,
      explanation: 'USE Method (Utilization, Saturation, Errors) foi criado por Brendan Gregg para analisar recursos de infraestrutura (CPU, memoria, disco, rede). RED Method (Rate, Errors, Duration) foi criado por Tom Wilkie para analisar servicos e microservicos. Use USE para infraestrutura, RED para servicos.',
      reference: 'Conceito relacionado: sre-observability — os Four Golden Signals do Google SRE sao similares ao RED.'
    },
    {
      question: 'Quais sao os Four Golden Signals do Google SRE?',
      options: [
        'CPU, Memoria, Disco, Rede',
        'Latency, Traffic, Errors, Saturation',
        'Uptime, Throughput, Errors, Cost',
        'Availability, Latency, Correctness, Freshness'
      ],
      correct: 1,
      explanation: 'Os Four Golden Signals sao: Latency (tempo de resposta), Traffic (volume de requisicoes), Errors (taxa de falhas) e Saturation (quao proximo da capacidade maxima). Sao as metricas mais importantes para monitorar qualquer servico, segundo o livro Site Reliability Engineering do Google.',
      reference: 'Conceito relacionado: sre-principles — SLIs geralmente mapeiam para os Golden Signals.'
    },
    {
      question: 'O que e structured logging e por que e importante?',
      options: [
        'Logs com formatacao bonita para leitura humana',
        'Logs em formato estruturado (JSON) com campos padronizados, permitindo busca, filtragem e correlacao automatizadas',
        'Logs organizados em pastas por data',
        'Logs criptografados para seguranca'
      ],
      correct: 1,
      explanation: 'Structured logging usa formato consistente (tipicamente JSON) com campos padronizados como timestamp, level, service, trace_id, message. Isso permite busca indexada (vs grep em texto livre), correlacao automatica com traces (via trace_id), e agregacao/analise em ferramentas como Elasticsearch ou Loki.',
      reference: 'Conceito relacionado: sre-observability — inclua trace_id nos logs para correlacionar com distributed traces.'
    },
    {
      question: 'O que e Context Propagation em distributed tracing?',
      options: [
        'Enviar logs de um servico para outro',
        'Propagar headers (como traceparent) entre servicos para manter o trace_id e span_id ao longo de toda a cadeia de chamadas',
        'Copiar metricas entre clusters',
        'Sincronizar dashboards entre ambientes'
      ],
      correct: 1,
      explanation: 'Context propagation e o mecanismo pelo qual o trace_id e span_id sao passados de servico para servico via HTTP headers (ex: traceparent, b3) ou gRPC metadata. Sem context propagation, cada servico criaria traces isolados e seria impossivel correlacionar uma requisicao end-to-end.',
      reference: 'Conceito relacionado: sre-observability — OpenTelemetry e o padrao CNCF para context propagation.'
    },
    {
      question: 'Qual o papel do Prometheus Exemplar na observabilidade?',
      options: [
        'E um tipo de alerta do Prometheus',
        'E uma ferramenta de visualizacao',
        'Liga metricas a traces especificos, permitindo ir de uma metrica agregada a um trace individual para investigacao',
        'E um exporter custom do Prometheus'
      ],
      correct: 2,
      explanation: 'Exemplars permitem anexar um trace_id a um ponto de metrica. Quando voce ve um spike no dashboard, pode clicar e ir direto para o trace da requisicao que causou o spike. Isso conecta os pilares: metrica (detecta) → trace (investiga) → logs (detalha).',
      reference: 'Conceito relacionado: sre-observability — Grafana suporta drill-down de exemplars para Tempo/Jaeger.'
    },
    {
      question: 'Em que nivel voce deve alertar (page) uma equipe de on-call?',
      options: [
        'Para qualquer metrica que saia do baseline',
        'Apenas quando ha impacto direto ao usuario ou risco de violacao do SLO (burn rate critico, servico down)',
        'Para todo warning no log',
        'Para qualquer aumento de latencia'
      ],
      correct: 1,
      explanation: 'Pages (alertas que acordam pessoas) devem ser reservados para situacoes com impacto real ao usuario: SLO burn rate critico, servico completamente down, perda de dados. Metricas fora do baseline devem gerar tickets ou entradas em dashboard, nao pages. Alert fatigue (muitos alertas) leva o time a ignorar alertas genuinos.',
      reference: 'Conceito relacionado: sre-oncall — alerting strategy e parte critica da pratica de on-call.'
    }
  ],
  flashcards: [
    {
      front: 'Tres pilares da observabilidade?',
      back: '**1. Metricas:**\n- Dados numericos agregados\n- Baratas de armazenar\n- Ideais para alertas e dashboards\n- Ferramentas: Prometheus, Datadog\n\n**2. Logs:**\n- Registros textuais detalhados\n- Volumosos e caros\n- Essenciais para debugging\n- Ferramentas: Loki, Elasticsearch\n\n**3. Traces:**\n- Requisicoes individuais distribuidas\n- Mostram latencia por servico\n- Essenciais para microservicos\n- Ferramentas: Jaeger, Tempo, Zipkin\n\n**Conexao:** metrica detecta, trace localiza, log explica'
    },
    {
      front: 'USE vs RED vs Four Golden Signals?',
      back: '**USE Method (recursos):**\n- Utilization: % em uso\n- Saturation: fila pendente\n- Errors: contagem de erros\n→ Para: CPU, memoria, disco, rede\n\n**RED Method (servicos):**\n- Rate: req/segundo\n- Errors: req com erro\n- Duration: latencia\n→ Para: APIs, microservicos\n\n**Four Golden Signals (Google):**\n- Latency\n- Traffic\n- Errors\n- Saturation\n→ Baseline universal para qualquer servico\n\n**Quando usar:**\nUSE para infra, RED para servicos'
    },
    {
      front: 'Structured logging — formato e beneficios?',
      back: '**Formato (JSON):**\n```json\n{\n  "timestamp": "2025-01-15T10:30:00Z",\n  "level": "ERROR",\n  "service": "payment-api",\n  "trace_id": "abc123",\n  "message": "Payment failed",\n  "error": "timeout",\n  "duration_ms": 5003\n}\n```\n\n**Beneficios:**\n- Busca indexada (vs grep)\n- Filtragem por campo\n- Correlacao com traces (trace_id)\n- Agregacao automatica\n- Parsing programatico\n\n**Campos essenciais:**\ntimestamp, level, service, trace_id,\nmessage, error (se aplicavel)'
    },
    {
      front: 'Distributed tracing — conceitos-chave?',
      back: '**Trace:** caminho completo de uma\nrequisicao por todos os servicos\n\n**Span:** operacao individual dentro do trace\n- Tem: span_id, parent_span_id, duration\n- Raiz: span sem parent\n\n**Context propagation:** headers HTTP\nque carregam trace_id entre servicos\n- W3C: traceparent header\n- B3: X-B3-TraceId header\n\n**OpenTelemetry:** padrao CNCF\n- Unifica metricas + logs + traces\n- SDK para instrumentacao\n- Collector para processamento\n- OTLP: protocolo de transporte\n\n**Ferramentas:** Jaeger, Tempo, Zipkin'
    },
    {
      front: 'Stack de observabilidade em Kubernetes?',
      back: '**Metricas:**\n- Prometheus (coleta)\n- Grafana (visualizacao)\n- kube-prometheus-stack (Helm)\n- ServiceMonitor para apps\n\n**Logs:**\n- Fluent Bit/Fluentd (coleta)\n- Loki (armazenamento)\n- Grafana (visualizacao)\n- DaemonSet em cada node\n\n**Traces:**\n- OpenTelemetry (instrumentacao)\n- Jaeger ou Tempo (armazenamento)\n- Grafana (visualizacao)\n- Sidecar ou DaemonSet\n\n**Tudo junto:**\nGrafana como single pane of glass\n→ metricas + logs + traces correlacionados'
    },
    {
      front: 'Alerting strategy — quando alertar?',
      back: '**Page (acorda pessoa):**\n- SLO burn rate critico (14.4x)\n- Servico completamente down\n- Perda de dados iminente\n- Seguranca comprometida\n\n**Ticket (proximo dia util):**\n- Burn rate elevado (6x)\n- Latencia acima do p99\n- Disco > 85%\n- Certificado expirando em < 7d\n\n**Dashboard/Log (informativo):**\n- Metricas fora do baseline\n- Deprecation warnings\n- Padroes anomalos\n\n**Regra de ouro:**\nSe o alerta nao requer acao,\nnao deveria ser page.\nTodo page deve ter runbook.'
    },
    {
      front: 'Comandos essenciais de observabilidade em K8s?',
      back: '**Metricas:**\n```bash\nkubectl top nodes\nkubectl top pods --sort-by=memory\n```\n\n**Logs:**\n```bash\nkubectl logs -f deploy/app\nkubectl logs --since=1h -l app=x\nkubectl logs <pod> --previous\nkubectl logs <pod> -c <container>\n```\n\n**Eventos:**\n```bash\nkubectl get events --sort-by=.lastTimestamp\nkubectl get events --field-selector type=Warning\n```\n\n**Debug:**\n```bash\nkubectl describe pod <pod>\nkubectl exec -it <pod> -- /bin/sh\nkubectl debug node/<node> --image=busybox\n```'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar observabilidade completa para um servico em Kubernetes: metricas com Prometheus, logs estruturados e alertas baseados nos Four Golden Signals.',
    objective: 'Instalar e configurar uma stack de observabilidade com ServiceMonitor, alertas e logging.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Configurar ServiceMonitor',
        instruction: `Crie um ServiceMonitor para que o Prometheus colete metricas da sua aplicacao.

\`\`\`bash
# Primeiro, crie um Service com a label e porta de metricas
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: my-app-metrics
  namespace: production
  labels:
    app: my-app
spec:
  selector:
    app: my-app
  ports:
    - name: metrics
      port: 8080
      targetPort: 8080
---
# ServiceMonitor para Prometheus Operator
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app-monitor
  namespace: monitoring
  labels:
    release: monitoring
spec:
  namespaceSelector:
    matchNames:
      - production
  selector:
    matchLabels:
      app: my-app
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
EOF
\`\`\``,
        hints: [
          'O label release: monitoring deve corresponder ao selector do Prometheus Operator',
          'namespaceSelector permite monitorar servicos em outros namespaces',
          'A porta do ServiceMonitor deve ter o mesmo nome da porta do Service'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app-monitor
  namespace: monitoring
  labels:
    release: monitoring
spec:
  namespaceSelector:
    matchNames: [production]
  selector:
    matchLabels:
      app: my-app
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar ServiceMonitor criado
kubectl get servicemonitor my-app-monitor -n monitoring
# Saida esperada: NAME               AGE
#                  my-app-monitor     Xs

# Verificar que Prometheus detectou o target
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090 &
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="my-app-metrics")' | head -5
# Saida esperada: target ativo ou vazio se a app nao esta rodando
\`\`\``
      },
      {
        title: 'Criar Alertas Four Golden Signals',
        instruction: `Configure alertas baseados nos Four Golden Signals do Google SRE.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: golden-signals-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: golden-signals
      rules:
        # 1. LATENCY: p99 > 1 segundo
        - alert: HighLatency
          expr: |
            histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{job="my-app"}[5m])) by (le))
            > 1.0
          for: 5m
          labels:
            severity: warning
            signal: latency
          annotations:
            summary: "P99 latency above 1 second"

        # 2. TRAFFIC: queda brusca no trafego (< 50% do normal)
        - alert: TrafficDrop
          expr: |
            sum(rate(http_requests_total{job="my-app"}[5m]))
            < 0.5 * sum(rate(http_requests_total{job="my-app"}[1h] offset 1d))
          for: 10m
          labels:
            severity: warning
            signal: traffic
          annotations:
            summary: "Traffic dropped to less than 50% of yesterday"

        # 3. ERRORS: taxa de erro > 5%
        - alert: HighErrorRate
          expr: |
            sum(rate(http_requests_total{job="my-app",code=~"5.."}[5m]))
            / sum(rate(http_requests_total{job="my-app"}[5m]))
            > 0.05
          for: 5m
          labels:
            severity: critical
            signal: errors
          annotations:
            summary: "Error rate above 5%"

        # 4. SATURATION: memoria > 90%
        - alert: HighSaturation
          expr: |
            container_memory_working_set_bytes{container="my-app"}
            / container_spec_memory_limit_bytes{container="my-app"}
            > 0.9
          for: 5m
          labels:
            severity: warning
            signal: saturation
          annotations:
            summary: "Memory usage above 90% of limit"
EOF
\`\`\``,
        hints: [
          'Os Four Golden Signals cobrem: Latency, Traffic, Errors, Saturation',
          'Use histogram_quantile para calcular percentis de latencia',
          'Compare trafego atual com historico para detectar quedas'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: golden-signals-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: golden-signals
      rules:
        - alert: HighErrorRate
          expr: |
            sum(rate(http_requests_total{code=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m])) > 0.05
          for: 5m
          labels:
            severity: critical
        - alert: HighLatency
          expr: |
            histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 1.0
          for: 5m
          labels:
            severity: warning
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar PrometheusRule criado
kubectl get prometheusrule golden-signals-alerts -n monitoring
# Saida esperada: NAME                      AGE
#                  golden-signals-alerts     Xs

# Verificar alertas definidos
kubectl get prometheusrule golden-signals-alerts -n monitoring -o jsonpath='{.spec.groups[0].rules[*].alert}'
# Saida esperada: HighLatency TrafficDrop HighErrorRate HighSaturation
\`\`\``
      },
      {
        title: 'Configurar Log Aggregation com Loki',
        instruction: `Configure o Loki para coletar e agregar logs dos pods.

\`\`\`bash
# Instalar Loki + Promtail via Helm (se nao instalado)
helm repo add grafana https://grafana.github.io/helm-charts
helm upgrade --install loki grafana/loki-stack \\
  --namespace monitoring \\
  --set promtail.enabled=true \\
  --set loki.persistence.enabled=false

# Verificar que o Promtail DaemonSet esta rodando
kubectl get daemonset -n monitoring | grep promtail

# Testar consulta LogQL via API
kubectl port-forward svc/loki -n monitoring 3100:3100 &
curl -s 'http://localhost:3100/loki/api/v1/query?query={namespace="production"}' | jq '.data.result | length'
\`\`\``,
        hints: [
          'Promtail roda como DaemonSet em cada node para coletar logs',
          'Loki indexa apenas labels, nao o conteudo dos logs',
          'LogQL e a linguagem de consulta do Loki (similar a PromQL)'
        ],
        solution: `\`\`\`bash
helm upgrade --install loki grafana/loki-stack --namespace monitoring --set promtail.enabled=true
\`\`\``,
        verify: `\`\`\`bash
# Verificar Loki rodando
kubectl get pods -n monitoring -l app=loki
# Saida esperada: pod Running

# Verificar Promtail DaemonSet
kubectl get daemonset -n monitoring -l app=promtail
# Saida esperada: DESIRED   CURRENT   READY
#                  N         N         N

# Verificar que Loki esta respondendo
kubectl exec -n monitoring deploy/loki -- wget -qO- http://localhost:3100/ready
# Saida esperada: ready
\`\`\``
      },
      {
        title: 'Verificar Correlacao Metricas-Logs',
        instruction: `Verifique que metricas e logs estao correlacionados no Grafana.

\`\`\`bash
# Port-forward Grafana
kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80 &

# Adicionar Loki como data source no Grafana (via API)
curl -X POST http://admin:admin@localhost:3000/api/datasources \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Loki",
    "type": "loki",
    "url": "http://loki:3100",
    "access": "proxy"
  }'

# Testar query LogQL
curl -s 'http://localhost:3100/loki/api/v1/query?query={namespace="production",app="my-app"} |= "ERROR"' | jq '.data.result | length'

# Verificar que Prometheus tem metricas do mesmo servico
curl -s 'http://localhost:9090/api/v1/query?query=up{job="my-app"}' | jq '.data.result'
\`\`\``,
        hints: [
          'Grafana permite split view: metricas acima, logs abaixo',
          'Use labels consistentes (app, namespace) entre metricas e logs',
          'O LogQL |= "ERROR" filtra linhas contendo "ERROR"'
        ],
        solution: `\`\`\`bash
curl -X POST http://admin:admin@localhost:3000/api/datasources -H 'Content-Type: application/json' -d '{"name":"Loki","type":"loki","url":"http://loki:3100","access":"proxy"}'
\`\`\``,
        verify: `\`\`\`bash
# Verificar data sources no Grafana
curl -s http://admin:admin@localhost:3000/api/datasources | jq '.[].name'
# Saida esperada: deve listar "Prometheus" e "Loki"

# Verificar acesso ao Grafana
curl -s -o /dev/null -w "%{http_code}" http://admin:admin@localhost:3000/api/health
# Saida esperada: 200
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ServiceMonitor criado mas Prometheus nao coleta metricas',
      difficulty: 'medium',
      symptom: 'O ServiceMonitor foi criado mas o target nao aparece no Prometheus. A pagina /targets mostra que o servico nao foi descoberto.',
      diagnosis: `\`\`\`bash
# Verificar labels do ServiceMonitor
kubectl get servicemonitor my-app-monitor -n monitoring -o yaml | head -15

# Verificar selector do Prometheus
kubectl get prometheus -n monitoring -o jsonpath='{.items[0].spec.serviceMonitorSelector}'

# Verificar se o Service existe e tem labels corretas
kubectl get svc -n production -l app=my-app

# Verificar se o endpoint de metricas responde
kubectl port-forward svc/my-app -n production 8080:8080 &
curl http://localhost:8080/metrics | head -5
\`\`\``,
      solution: `**Causas comuns:**

1. **Label mismatch:** O Prometheus Operator usa \`serviceMonitorSelector\` para descobrir ServiceMonitors. Se a label nao corresponde, o ServiceMonitor e ignorado:
\`\`\`bash
# Ver qual label o Prometheus espera
kubectl get prometheus -n monitoring -o jsonpath='{.items[0].spec.serviceMonitorSelector.matchLabels}'
# Adicionar a label correta ao ServiceMonitor
\`\`\`

2. **Namespace nao permitido:** Se \`serviceMonitorNamespaceSelector\` esta configurado, o Prometheus so descobre ServiceMonitors em certos namespaces.

3. **Porta incorreta:** O nome da porta no ServiceMonitor deve corresponder ao nome da porta no Service.

4. **App nao expoe /metrics:** O endpoint deve retornar metricas no formato Prometheus.`
    },
    {
      title: 'Logs nao aparecem no Loki/Grafana',
      difficulty: 'easy',
      symptom: 'Pods estao gerando logs (kubectl logs mostra output) mas eles nao aparecem nas consultas LogQL no Grafana.',
      diagnosis: `\`\`\`bash
# Verificar se Promtail esta rodando em todos os nodes
kubectl get daemonset -n monitoring -l app=promtail

# Verificar logs do Promtail
kubectl logs -n monitoring -l app=promtail --tail=20

# Verificar se Loki esta recebendo logs
kubectl exec -n monitoring deploy/loki -- wget -qO- 'http://localhost:3100/loki/api/v1/query?query={namespace="production"}' 2>/dev/null | head -5

# Verificar configuracao do Promtail
kubectl get cm -n monitoring -l app=promtail -o yaml | grep -A5 "scrape_configs"
\`\`\``,
      solution: `**Causas comuns:**

1. **Promtail nao rodando em todos os nodes:** Verifique o DaemonSet:
\`\`\`bash
kubectl get ds -n monitoring -l app=promtail
# DESIRED deve ser igual a READY
\`\`\`

2. **Namespace nao configurado no Promtail:** O Promtail pode estar filtrado para coletar apenas de certos namespaces.

3. **Loki data source nao configurado no Grafana:** Verifique se o Loki esta como data source:
\`\`\`bash
curl -s http://admin:admin@localhost:3000/api/datasources | jq '.[].name'
\`\`\`

4. **Loki sem espaco/limites:** Se o Loki atingiu limites de ingestao ou armazenamento, logs novos sao descartados.`
    },
    {
      title: 'Alert fatigue — muitos alertas falsos positivos',
      difficulty: 'hard',
      symptom: 'O time recebe dezenas de alertas por dia, a maioria falsos positivos. O time comecou a ignorar alertas e um incidente real passou despercebido.',
      diagnosis: `\`\`\`bash
# Verificar alertas ativos
kubectl port-forward svc/monitoring-kube-prometheus-alertmanager -n monitoring 9093:9093 &
curl -s http://localhost:9093/api/v2/alerts | jq '.[].labels.alertname' | sort | uniq -c | sort -rn

# Verificar historico de alertas no Prometheus
curl -s 'http://localhost:9090/api/v1/query?query=ALERTS{alertstate="firing"}' | jq '.data.result | length'

# Verificar silences ativos
curl -s http://localhost:9093/api/v2/silences | jq '.[].comment'
\`\`\``,
      solution: `**Estrategia de reducao:**

1. **Classificar alertas existentes:**
   - Page: requer acao imediata (SLO impacto)
   - Ticket: requer acao no proximo dia util
   - Informativo: dashboard apenas (nao alerta)

2. **Eliminar alertas sem acao:** Todo alerta deve ter um runbook. Se nao ha acao possivel, nao deveria ser alerta.

3. **Aumentar thresholds e duration:**
\`\`\`yaml
# Antes (sensivel demais):
- alert: HighCPU
  expr: cpu_usage > 70
  for: 1m

# Depois (realista):
- alert: HighCPU
  expr: cpu_usage > 90
  for: 15m
\`\`\`

4. **Migrar para SLO-based alerting:** Em vez de alertar em sintomas individuais, alerte em burn rate do error budget. Um unico alerta de burn rate substitui dezenas de alertas de sintoma.

5. **Review mensal:** Revise todos os alertas mensalmente. Se um alerta nao gerou acao em 30 dias, considere remover.`
    }
  ]
};
