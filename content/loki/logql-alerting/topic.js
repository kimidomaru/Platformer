window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['loki/logql-alerting'] = {
  theory: `# LogQL e Alerting com Loki

## Relevância no Exame
> LogQL e alerting baseado em logs são fundamentais para SRE e observabilidade. Cobre desde queries básicas de filtragem até alertas sofisticados com PrometheusRule via Loki Ruler.

## Conceitos Fundamentais

### O que é LogQL?
LogQL é a linguagem de query do Loki, inspirada no PromQL do Prometheus. Possui dois tipos principais de queries:

1. **Log Queries**: retornam linhas de log brutas
2. **Metric Queries**: agregam logs em métricas (series temporais)

### Anatomia de um Log Stream Selector
\`\`\`
{namespace="production", app="api", level="error"}
     ↑                    ↑              ↑
  Label name         Label name      Label name
     =                  =               =
  Exact match       Exact match    Exact match

# Outros operadores:
# !=   diferente
# =~   regex match
# !~   regex não match
\`\`\`

### Log Queries — Filtragem de Conteúdo

\`\`\`
{app="api"} |= "error"          # contém string
{app="api"} != "debug"          # não contém string
{app="api"} |~ "error|warning"  # regex match
{app="api"} !~ "health|metrics" # regex não match

# Combinando filtros (AND implícito)
{namespace="prod", app="api"}
  |= "error"
  != "health"
  |~ "timeout|connection refused"
\`\`\`

### Parser Stages — Extraindo Campos dos Logs
\`\`\`
# JSON parser (para logs JSON)
{app="api"} | json
{app="api"} | json level, message, duration_ms

# Logfmt parser (key=value format)
{app="api"} | logfmt
{app="api"} | logfmt level, method, status

# Regex parser
{app="nginx"} | regexp \`(?P<method>\\w+) (?P<path>[^ ]+) HTTP\`

# Pattern parser (simpler than regex)
{app="api"} | pattern \`<_> level=<level> msg=<message>\`

# Após parse, filtrar por campo extraído
{app="api"} | json | level = "error"
{app="api"} | logfmt | status >= 500
{app="api"} | json | duration_ms > 1000
\`\`\`

### Line Format — Transformando Linhas
\`\`\`
# Reformatar linha de log
{app="api"} | json | line_format "{{.level}} {{.message}}"

# Adicionar labels derivados
{app="api"} | json
  | label_format level=upper(level)
  | line_format "[{{.level}}] {{.message}}"
\`\`\`

### Metric Queries — Agregações

**rate()** — taxa de linhas por segundo:
\`\`\`
rate({app="api"}[5m])
rate({app="api"} |= "error" [5m])
\`\`\`

**count_over_time()** — contagem total no range:
\`\`\`
count_over_time({app="api"}[1h])
count_over_time({app="api"} |= "error" [5m])
\`\`\`

**bytes_over_time()** — volume em bytes:
\`\`\`
bytes_over_time({app="api"}[1h])
\`\`\`

**bytes_rate()** — taxa de bytes por segundo:
\`\`\`
bytes_rate({app="api"}[5m])
\`\`\`

**sum() by** — agrupar por label:
\`\`\`
sum(rate({app="api"}[5m])) by (namespace)
sum(count_over_time({job="nginx"}[1h])) by (status_code)
\`\`\`

**topk/bottomk** — top N:
\`\`\`
topk(5, sum(rate({app=~".*"}[5m])) by (app))
\`\`\`

### Unwrap — Extraindo Valores Numéricos
Permite usar valores de campos como métricas numéricas:
\`\`\`
# Média de duração de requests
avg_over_time(
  {app="api"} | json | unwrap duration_ms [5m]
) by (endpoint)

# P99 de latência
quantile_over_time(0.99,
  {app="api"} | logfmt | unwrap response_time [5m]
) by (service)

# Taxa de erros (%)
sum(rate({app="api"} | json | status >= 500 [5m])) by (service)
/
sum(rate({app="api"} | json [5m])) by (service)
* 100
\`\`\`

### LogQL para Alerting

#### PrometheusRule com Loki
O Ruler do Loki aceita PrometheusRule no mesmo formato do Prometheus:

\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: loki-alerts
  namespace: monitoring
  labels:
    # Esta label faz o Loki Ruler pegar a regra
    app: kube-prometheus-stack
spec:
  groups:
    - name: loki-error-alerts
      interval: 1m
      rules:
        # Alerta quando taxa de erros ultrapassa limiar
        - alert: HighErrorRate
          expr: |
            sum(rate({namespace="production"} |= "error" [5m])) by (app)
            > 0.1
          for: 5m
          labels:
            severity: warning
            team: backend
          annotations:
            summary: "High error rate in {{ \$labels.app }}"
            description: "App {{ \$labels.app }} has error rate {{ \$value | humanize }}/s for 5 minutes"
            runbook_url: "https://wiki.company.com/runbooks/high-error-rate"

        # Alerta de ausência de logs (log silence)
        - alert: NoLogsFromPayments
          expr: |
            absent(
              rate({namespace="payments", app="payment-api"}[5m])
            )
          for: 10m
          labels:
            severity: critical
            team: payments
          annotations:
            summary: "No logs from payments service"
            description: "Payment API has not produced any logs for 10 minutes"

        # Alerta baseado em valor numérico (unwrap)
        - alert: SlowAPIResponse
          expr: |
            avg_over_time(
              {app="api"} | json | unwrap duration_ms [5m]
            ) by (endpoint) > 2000
          for: 3m
          labels:
            severity: warning
          annotations:
            summary: "Slow API response in {{ \$labels.endpoint }}"
            description: "Average response time is {{ \$value }}ms"
\`\`\`

### Recording Rules com Loki
\`\`\`yaml
spec:
  groups:
    - name: loki-recording
      interval: 5m
      rules:
        # Pré-computar error rate para dashboards
        - record: job:loki_error_rate:5m
          expr: |
            sum(rate({job=~".+"} |= "error" [5m])) by (job, namespace)
\`\`\`

### Configuração do Ruler
\`\`\`yaml
# No loki.yaml:
ruler:
  storage:
    type: local
    local:
      directory: /etc/loki/rules
  rule_path: /tmp/loki/rules
  alertmanager_url: http://alertmanager:9093
  ring:
    kvstore:
      store: inmemory
  enable_api: true
  enable_alertmanager_v2: true
\`\`\`

## Comandos Essenciais

### Queries via CLI (logcli)
\`\`\`bash
# Instalar logcli
go install github.com/grafana/loki/cmd/logcli@latest
# ou via binário: https://github.com/grafana/loki/releases

# Configurar endpoint
export LOKI_ADDR=http://localhost:3100

# Query básica de logs
logcli query '{namespace="production",app="api"}'

# Filtrar por conteúdo
logcli query '{app="api"} |= "error"' --limit=100

# Query com range de tempo
logcli query '{app="api"}' --since=1h --until=30m

# Output em formato específico
logcli query '{app="api"} | json' --output=raw

# Instant query (valor atual)
logcli instant-query 'count_over_time({app="api"}[1h])'

# Range query (série temporal)
logcli range-query 'rate({app="api"} |= "error" [5m])' \\
  --start=2024-01-01T00:00:00Z \\
  --end=2024-01-01T01:00:00Z \\
  --step=1m

# Ver labels disponíveis
logcli labels

# Ver valores de uma label
logcli labels app
\`\`\`

### API HTTP direta
\`\`\`bash
# Query de logs via API
curl -s "http://localhost:3100/loki/api/v1/query_range" \\
  --data-urlencode 'query={namespace="production"} |= "error"' \\
  --data-urlencode 'start=1704067200000000000' \\
  --data-urlencode 'end=1704153600000000000' \\
  --data-urlencode 'limit=100' \\
  --data-urlencode 'direction=backward' | jq .

# Instant query
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query=rate({app="api"}[5m])' \\
  --data-urlencode 'time=1704153600' | jq .

# Listar labels
curl -s "http://localhost:3100/loki/api/v1/labels" | jq .

# Listar valores de label
curl -s "http://localhost:3100/loki/api/v1/label/app/values" | jq .

# Listar series
curl -s "http://localhost:3100/loki/api/v1/series" \\
  --data-urlencode 'match[]={namespace="production"}' | jq .

# Ver regras do Ruler
curl -s "http://localhost:3100/loki/api/v1/rules" | jq .
\`\`\`

## Exemplos YAML

### Dashboard Grafana via ConfigMap (Provisioning)
\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  loki-overview.json: |
    {
      "title": "Loki — Log Overview",
      "panels": [
        {
          "title": "Error Rate by Service",
          "type": "timeseries",
          "datasource": "Loki",
          "targets": [
            {
              "expr": "sum(rate({namespace=\\"production\\"} |= \\"error\\" [5m])) by (app)",
              "legendFormat": "{{app}}"
            }
          ]
        },
        {
          "title": "Log Volume by Namespace",
          "type": "timeseries",
          "datasource": "Loki",
          "targets": [
            {
              "expr": "sum(bytes_rate({job=~\\".+\\"} [5m])) by (namespace)",
              "legendFormat": "{{namespace}}"
            }
          ]
        }
      ]
    }
\`\`\`

### Alertas Completos de Produção
\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: loki-production-alerts
  namespace: monitoring
  labels:
    app: kube-prometheus-stack
    role: alert-rules
spec:
  groups:
    - name: application-logs
      interval: 1m
      rules:
        - alert: CriticalErrorSpike
          expr: |
            (
              sum(rate({namespace=~"production|staging"} |= "CRITICAL" [5m])) by (namespace, app)
              /
              sum(rate({namespace=~"production|staging"} [5m])) by (namespace, app)
            ) > 0.05
          for: 2m
          labels:
            severity: critical
            page: "true"
          annotations:
            summary: "Critical error spike in {{ \$labels.app }} ({{ \$labels.namespace }})"
            description: "{{ \$value | humanizePercentage }} of logs are CRITICAL errors"

        - alert: OOMKillDetected
          expr: |
            count_over_time(
              {namespace=~"production|staging"}
              |= "OOMKilled" [5m]
            ) > 0
          for: 0m
          labels:
            severity: warning
          annotations:
            summary: "OOMKill detected in namespace {{ \$labels.namespace }}"

        - alert: DatabaseConnectionPoolExhausted
          expr: |
            count_over_time(
              {app=~".*-api"} |= "connection pool exhausted" [5m]
            ) > 5
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "DB connection pool exhausted in {{ \$labels.app }}"
            description: "Detected {{ \$value }} pool exhaustion events in 5 minutes"

        - alert: SecurityAuthFailures
          expr: |
            sum(
              count_over_time(
                {app=~".*"} |~ "authentication failed|invalid token|unauthorized" [5m]
              )
            ) by (app) > 50
          for: 2m
          labels:
            severity: warning
            team: security
          annotations:
            summary: "High auth failure rate in {{ \$labels.app }}"
            description: "{{ \$value }} auth failures in 5 minutes — possible brute force"
\`\`\`

### LogQL para Análise de Performance
\`\`\`
# Top 10 endpoints mais lentos (P99)
topk(10,
  quantile_over_time(0.99,
    {app="api"} | json | unwrap duration_ms [1h]
  ) by (endpoint)
)

# Requests com status 5xx por serviço
sum(
  count_over_time(
    {namespace="production"} | json | status >= 500 [5m]
  )
) by (app)

# Taxa de erro relativa (error ratio)
(
  sum(rate({namespace="production"} |= "ERROR" [5m])) by (app)
/
  sum(rate({namespace="production"} [5m])) by (app)
) * 100

# Logs por usuário (após parse JSON com campo user_id)
# ATENÇÃO: user_id como label = cardinality explosion!
# Use como filtro, NÃO como label:
{app="api"} | json | user_id = "123456"
\`\`\`

## Erros Comuns

### 1. Query sem log stream selector
**Problema**: \`parse error: 1:1: parse error: unexpected identifier\`
**Causa**: Começar a query com filtros sem selector de streams.
**Solução**: Sempre começar com \`{label="value"}\`.

### 2. Range muito pequeno no rate()
**Problema**: Valores de rate extremamente voláteis ou zeros frequentes.
**Causa**: Range muito pequeno (ex: \`[30s]\`) com poucos logs.
**Solução**: Usar ranges de pelo menos \`[5m]\` para estabilidade.

### 3. Regex complexo demora muito
**Problema**: Query de regex demora mais de 30 segundos.
**Causa**: Regex não ancorado aplicado em milhões de linhas.
**Solução**: Usar \`|= "string"\` como pré-filtro antes do \`|~\`.
\`\`\`
# Lento:
{app="api"} |~ "error.*timeout|timeout.*error"

# Rápido (pré-filtra com string exata primeiro):
{app="api"} |= "timeout" |~ "error.*timeout|timeout.*error"
\`\`\`

### 4. Alertas do Ruler não disparando
**Causa**: Label seletora do PrometheusRule não bate com configuração do Ruler.
**Solução**: Verificar \`ruler.remote_write\` ou \`ruler.alertmanager_url\`.

### 5. unwrap em campo não numérico
**Problema**: \`error: unwrap stage only accepts numeric values\`
**Causa**: Campo extraído contém string não conversível para número.
**Solução**: Usar \`| label_format field=\`{{ .field | replace "ms" "" }}\`\` antes do unwrap.

## Killer.sh Style Challenge

**Contexto**: O time de produto quer um SLO de que 99% dos requests da API devem ser completados em menos de 2000ms. Você precisa criar:

1. Uma query LogQL que calcule o percentil 99 de latência da API no último 1 hora
2. Um alerta que dispara quando o P99 ultrapassa 2000ms por mais de 5 minutos
3. Um alerta de "log silence" que dispara se a API ficar 10 minutos sem gerar logs

Os logs da API estão em \`{namespace="production", app="payment-api"}\` e têm formato JSON com campo \`duration_ms\`.`,

  quiz: [
    {
      question: 'Qual é a diferença entre uma Log Query e uma Metric Query no LogQL?',
      options: [
        'Log Query retorna linhas de log brutas; Metric Query agrega logs em séries temporais',
        'Log Query usa labels; Metric Query usa conteúdo dos logs',
        'Log Query é mais rápida; Metric Query é mais precisa',
        'Não há diferença — são sinônimos no LogQL'
      ],
      correct: 0,
      explanation: 'Log Queries retornam linhas de log individuais (resultado é texto), enquanto Metric Queries usam funções como rate(), count_over_time(), bytes_rate() para transformar logs em séries temporais numéricas — equivalente ao PromQL para métricas.',
      reference: 'Conceito: tipos de query no LogQL — seção "O que é LogQL?" na teoria.'
    },
    {
      question: 'Qual query LogQL calcula a taxa de erros por segundo nos últimos 5 minutos para a app "api"?',
      options: [
        'count({app="api"} |= "error")',
        'rate({app="api"} |= "error" [5m])',
        'sum({app="api"} | json | level="error")',
        'avg_rate({app="api"} |= "error", 5m)'
      ],
      correct: 1,
      explanation: 'rate() calcula a taxa de linhas por segundo dentro do range especificado entre colchetes [5m]. O filtro |= "error" garante que apenas linhas contendo "error" são contadas. Esta é a função mais usada para SLOs de taxa de erro.',
      reference: 'Função: rate() em LogQL — seção "Metric Queries — Agregações" na teoria.'
    },
    {
      question: 'Para fazer parse de logs no formato "level=info msg=\\"request processed\\" duration=250ms", qual parser do LogQL é mais adequado?',
      options: [
        '| json',
        '| logfmt',
        '| regexp',
        '| pattern'
      ],
      correct: 1,
      explanation: 'O formato "key=value" é o formato logfmt, amplamente usado por aplicações Go (como o próprio Kubernetes). O parser "| logfmt" extrai automaticamente todos os campos key=value como labels consultáveis na query.',
      reference: 'Parser stages: logfmt — seção "Parser Stages — Extraindo Campos dos Logs" na teoria.'
    },
    {
      question: 'Qual é o operador correto no log stream selector para fazer regex match em uma label?',
      options: [
        '~=',
        '|~',
        '=~',
        '~~'
      ],
      correct: 2,
      explanation: '=~ é o operador de regex match para labels no stream selector. Exemplo: {app=~"api|gateway|proxy"} seleciona streams onde o valor da label app matches o regex. Enquanto |~ é usado como filtro de CONTEÚDO da linha de log após o selector.',
      reference: 'Sintaxe: Log Stream Selector — seção "Anatomia de um Log Stream Selector" na teoria.'
    },
    {
      question: 'Como calcular o P99 de latência usando LogQL com logs JSON que têm campo "duration_ms"?',
      options: [
        'p99({app="api"} | json duration_ms [5m])',
        'quantile_over_time(0.99, {app="api"} | json | unwrap duration_ms [5m])',
        'percentile({app="api"} | json, duration_ms, 0.99)',
        'avg({app="api"} | json | duration_ms [5m]) * 0.99'
      ],
      correct: 1,
      explanation: 'quantile_over_time(φ, ...) calcula quantis de uma série de valores. O "unwrap duration_ms" extrai o valor numérico do campo duration_ms de cada linha JSON para usar como valor da métrica. φ=0.99 = percentil 99.',
      reference: 'Função: quantile_over_time com unwrap — seção "Unwrap — Extraindo Valores Numéricos" na teoria.'
    },
    {
      question: 'Qual campo na PrometheusRule faz o Loki Ruler pegar a regra para avaliação?',
      options: [
        'annotations.loki: "true"',
        'spec.ruler: loki',
        'labels que batem com a configuração ruleSelector do Ruler',
        'namespace: loki-rules'
      ],
      correct: 2,
      explanation: 'O Loki Ruler usa um seletor de labels (ruleSelector) configurado no loki.yaml para encontrar PrometheusRules que deve avaliar. Por padrão em stacks como kube-prometheus-stack, a label é app: kube-prometheus-stack. É essencial que a regra tenha as labels corretas.',
      reference: 'Config: Ruler — seção "Configuração do Ruler" e exemplos de PrometheusRule na teoria.'
    },
    {
      question: 'Qual é a maneira correta de otimizar uma query LogQL com regex pesado?',
      options: [
        'Adicionar mais indexação ao Loki',
        'Usar |= "string" como pré-filtro antes do |~ "regex"',
        'Aumentar o range de tempo da query',
        'Usar um índice secundário no storage backend'
      ],
      correct: 1,
      explanation: 'O Loki faz full scan das linhas de log que passam pelo stream selector. Usar |= "string" antes do |~ "regex" reduz drasticamente o número de linhas que precisam ser testadas pelo regex caro, pois a busca por string exata é muito mais rápida.',
      reference: 'Otimização: pré-filtro com string — seção "Erros Comuns" na teoria.'
    },
    {
      question: 'Qual query LogQL detecta ausência de logs de um serviço (útil para alertar sobre serviço parado)?',
      options: [
        'rate({app="service"}[5m]) == 0',
        'absent(rate({app="service"}[5m]))',
        'count({app="service"}) < 1',
        'missing({app="service"})'
      ],
      correct: 1,
      explanation: 'absent() retorna 1 quando a expressão dentro não produz nenhuma série — ou seja, quando não há logs. Usado em PrometheusRule para alertar quando um serviço para de produzir logs (pode indicar crash, deployment com falha, etc.).',
      reference: 'Alerting: absent() para log silence — seção "LogQL para Alerting" na teoria.'
    }
  ],

  flashcards: [
    {
      front: 'Quais são os dois tipos de queries no LogQL?',
      back: '**Log Queries**: retornam linhas de log brutas\n- Usam stream selector + filtros\n- Resultado: linhas de texto\n- Ex: {app="api"} |= "error"\n\n**Metric Queries**: agregam em séries temporais\n- Usam rate(), count_over_time(), bytes_rate()\n- Resultado: gráficos/alertas\n- Ex: rate({app="api"} |= "error" [5m])'
    },
    {
      front: 'Quais são os operadores de label no Log Stream Selector?',
      back: '= → match exato: {app="api"}\n!= → diferente: {env!="dev"}\n=~ → regex match: {app=~"api|gw"}\n!~ → regex não match: {app!~"test.*"}\n\nDiferença importante:\n- Esses operadores são para LABELS no selector\n- |= |~ != !~ são filtros de CONTEÚDO das linhas'
    },
    {
      front: 'Como usar unwrap para métricas numéricas no LogQL?',
      back: 'unwrap extrai um campo numérico dos logs para usar em agregações:\n\n# P99 de latência\nquantile_over_time(0.99,\n  {app="api"} | json | unwrap duration_ms [5m]\n) by (endpoint)\n\n# Média por endpoint\navg_over_time(\n  {app="api"} | logfmt | unwrap response_time [5m]\n) by (endpoint)\n\nO campo DEVE ser numérico após o parse (json/logfmt)'
    },
    {
      front: 'Como alertar sobre ausência de logs (serviço parado)?',
      back: 'Use a função absent() em PrometheusRule:\n\nalert: ServiceSilent\nexpr: |\n  absent(\n    rate({app="payment-api"}[5m])\n  )\nfor: 10m\nlabels:\n  severity: critical\nannotations:\n  summary: "No logs from payment-api for 10 minutes"\n\nabsent() retorna 1 quando a série não existe (sem logs)'
    },
    {
      front: 'Qual a diferença entre |= e |~ no LogQL?',
      back: '|= "string" → filtro de string exata (muito rápido)\n- Match literal: |= "error"\n- Não match: != "debug"\n\n|~ "regex" → filtro de regex (mais lento)\n- Match regex: |~ "error|warning"\n- Não match: !~ "health|metrics"\n\n**Otimização**: use |= antes de |~ para pré-filtrar:\n{app="api"} |= "timeout" |~ "db.*timeout"'
    },
    {
      front: 'Quais parsers de log o LogQL suporta?',
      back: '| json → parse completo de JSON\n| json campo1, campo2 → extrai campos específicos\n| logfmt → parse key=value (formato Go)\n| regexp "(?P<name>pattern)" → regex named groups\n| pattern "<_> level=<level> msg=<msg>" → padrão simples\n\nApós parse:\n| level = "error"    → filtrar por campo\n| status >= 500      → comparação numérica\n| line_format "{{.level}} {{.message}}" → reformatar'
    },
    {
      front: 'Como calcular error ratio (%) com LogQL?',
      back: 'Error ratio = erros / total * 100:\n\n(\n  sum(rate({ns="prod"} |= "ERROR" [5m])) by (app)\n  /\n  sum(rate({ns="prod"} [5m])) by (app)\n) * 100\n\nUsado em SLO alerts:\nexpr: |\n  (\n    sum(rate({ns="prod"} |= "ERROR" [5m])) by (app)\n    /\n    sum(rate({ns="prod"} [5m])) by (app)\n  ) > 0.01  # > 1% de erros'
    },
    {
      front: 'Como usar o logcli para queries no Loki?',
      back: '# Configurar endpoint\nexport LOKI_ADDR=http://localhost:3100\n\n# Query básica\nlogcli query \'{app="api"}\'\n\n# Filtrar e limitar\nlogcli query \'{app="api"} |= "error"\' --limit=100\n\n# Range de tempo\nlogcli query \'{app="api"}\' --since=1h --until=30m\n\n# Metric query\nlogcli instant-query \'rate({app="api"}[5m])\'\n\n# Ver labels disponíveis\nlogcli labels\nlogcli labels app  # valores de uma label'
    }
  ],

  lab: {
    scenario: 'Você é SRE de uma aplicação de e-commerce e precisa configurar observabilidade de logs completa: queries para investigação, alertas de taxa de erros e alertas de log silence para a API de pagamentos.',
    objective: 'Praticar LogQL para análise de logs, criar PrometheusRules para alerting via Loki Ruler e configurar dashboards básicos.',
    duration: '30-40 minutos',
    steps: [
      {
        title: 'Gerar Logs de Exemplo e Praticar LogQL',
        instruction: `Crie dois pods geradores de logs: um simulando uma API com logs JSON (com campos level, duration_ms, status, endpoint) e outro simulando erros críticos ocasionais.

Depois, use o port-forward do Loki para executar queries LogQL via curl e praticar filtros, parsers e agregações.`,
        hints: [
          'Use busybox ou similar para gerar logs com formato JSON',
          'Gere logs com diferentes níveis: INFO, WARN, ERROR',
          'Inclua campo duration_ms variável para praticar unwrap',
          'Port-forward o serviço Loki na porta 3100 antes das queries'
        ],
        solution: `\`\`\`bash
# Pod 1: API com logs JSON estruturados
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: api-simulator
  labels:
    app: api
    env: production
spec:
  containers:
    - name: api
      image: busybox
      command:
        - sh
        - -c
        - |
          while true; do
            dur=\$((RANDOM % 3000 + 50))
            status=\$((RANDOM % 10 > 8 ? 500 : 200))
            level=\$([ "\$status" -ge 500 ] && echo "ERROR" || echo "INFO")
            endpoint="/api/v1/\$([ \$((RANDOM % 3)) -eq 0 ] && echo "payment" || echo "product")"
            echo '{"timestamp":"'"\$(date -Iseconds)"'","level":"'"\$level"'","message":"request processed","duration_ms":'"\$dur"',"status":'"\$status"',"endpoint":"'"\$endpoint"'"}'
            sleep 0.5
          done
EOF

# Pod 2: Erros críticos ocasionais
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: error-simulator
  labels:
    app: payment-api
    env: production
spec:
  containers:
    - name: payment
      image: busybox
      command:
        - sh
        - -c
        - |
          while true; do
            echo '{"timestamp":"'"\$(date -Iseconds)"'","level":"ERROR","message":"database connection failed","service":"payment-api","retry":true}'
            sleep 5
            echo '{"timestamp":"'"\$(date -Iseconds)"'","level":"INFO","message":"payment processed","amount":99.90}'
            sleep 2
          done
EOF

# Aguardar pods
kubectl wait --for=condition=ready pod/api-simulator pod/error-simulator --timeout=30s

# Port-forward Loki
kubectl port-forward -n monitoring svc/loki-stack 3100:3100 &
sleep 15  # aguardar logs acumularem

# Query 1: Todos os logs da API
curl -s "http://localhost:3100/loki/api/v1/query_range" \\
  --data-urlencode 'query={app="api"}' \\
  --data-urlencode "start=\$(date -d '5 minutes ago' +%s)000000000" \\
  --data-urlencode "end=\$(date +%s)000000000" \\
  --data-urlencode 'limit=5' | jq '.data.result[0].values[:3]'

# Query 2: Apenas erros
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query=count_over_time({app="api"} |= "ERROR" [5m])' \\
  --data-urlencode "time=\$(date +%s)" | jq '.data.result'

# Query 3: Parse JSON e filtrar por status >= 500
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query=count_over_time({app="api"} | json | status >= 500 [5m])' \\
  --data-urlencode "time=\$(date +%s)" | jq '.data.result'
\`\`\``,
        verify: `\`\`\`bash
# Verificar pods rodando
kubectl get pods api-simulator error-simulator
# Saída esperada: ambos Running

# Verificar que logs chegam no Loki
curl -s "http://localhost:3100/loki/api/v1/labels" | jq '.data'
# Saída esperada: lista com "app" entre as labels

# Verificar que app "api" e "payment-api" têm streams
curl -s "http://localhost:3100/loki/api/v1/series" \\
  --data-urlencode 'match[]={app=~"api|payment-api"}' | \\
  jq '.data | length'
# Saída esperada: 2 ou mais series

# Verificar contagem de logs recentes
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query=count_over_time({app=~"api|payment-api"}[5m])' \\
  --data-urlencode "time=\$(date +%s)" | \\
  jq '.data.result[] | .value[1]'
# Saída esperada: valores numéricos > "0"
\`\`\``
      },
      {
        title: 'Criar Alertas com PrometheusRule via Loki Ruler',
        instruction: `Configure o Loki Ruler habilitando-o no ConfigMap e crie PrometheusRules para:
1. Taxa de erros alta (> 10% por 3 minutos)
2. Latência P99 acima de 2000ms (usando unwrap)
3. Log silence do payment-api (ausência por 5 minutos)

Depois verifique que o Ruler carregou as regras.`,
        hints: [
          'O Ruler precisa estar habilitado no loki.yaml com enable_api: true',
          'As PrometheusRules precisam de labels que batem com o ruleSelector do Ruler',
          'Para verificar regras carregadas, use o endpoint /loki/api/v1/rules',
          'O alertmanager_url deve apontar para o Alertmanager do seu cluster'
        ],
        solution: `\`\`\`bash
# 1. Verificar se Ruler está habilitado
kubectl get configmap -n monitoring loki-stack -o yaml | grep -A5 ruler

# Se não estiver, editar ConfigMap
kubectl edit configmap -n monitoring loki-stack
# Adicionar em loki.yaml:
# ruler:
#   storage:
#     type: local
#     local:
#       directory: /tmp/loki/rules
#   enable_api: true
#   alertmanager_url: http://alertmanager-operated:9093

# Reiniciar Loki após mudança
kubectl rollout restart statefulset/loki-stack -n monitoring

# 2. Criar PrometheusRules
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: loki-lab-alerts
  namespace: monitoring
  labels:
    app: kube-prometheus-stack
spec:
  groups:
    - name: api-logs
      interval: 1m
      rules:
        - alert: HighAPIErrorRate
          expr: |
            (
              sum(rate({app="api"} |= "ERROR" [5m]))
              /
              sum(rate({app="api"} [5m]))
            ) > 0.1
          for: 3m
          labels:
            severity: warning
          annotations:
            summary: "High API error rate detected"
            description: "Error rate is {{ \$value | humanizePercentage }}"

        - alert: SlowAPIResponse
          expr: |
            avg_over_time(
              {app="api"} | json | unwrap duration_ms [5m]
            ) > 2000
          for: 3m
          labels:
            severity: warning
          annotations:
            summary: "Slow API responses detected"
            description: "Average response time: {{ \$value }}ms"

        - alert: PaymentAPILogSilence
          expr: |
            absent(
              rate({app="payment-api"}[5m])
            )
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Payment API is not generating logs"
            description: "No logs from payment-api for 5+ minutes"
EOF

# 3. Verificar regras carregadas
sleep 30  # aguardar Ruler carregar
curl -s "http://localhost:3100/loki/api/v1/rules" | jq 'keys'
\`\`\``,
        verify: `\`\`\`bash
# Verificar PrometheusRule criada
kubectl get prometheusrule -n monitoring loki-lab-alerts
# Saída esperada: loki-lab-alerts   Xm

# Verificar regras via API do Ruler
curl -s "http://localhost:3100/loki/api/v1/rules" | jq '.'
# Saída esperada: JSON com grupos de regras (se Ruler habilitado)

# Verificar alertas ativos (se houver)
curl -s "http://localhost:3100/loki/api/v1/alerts" | jq '.data.alerts'
# Saída esperada: array (pode estar vazio se tudo OK)

# Testar query de error rate manualmente
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query=sum(rate({app="api"} |= "ERROR" [5m]))' \\
  --data-urlencode "time=\$(date +%s)" | jq '.data.result'
# Saída esperada: array com valor numérico (taxa atual de erros)
\`\`\``
      },
      {
        title: 'Criar Dashboard Grafana com Painéis de Logs',
        instruction: `Configure um dashboard no Grafana que mostre:
1. Painel de Logs (tipo Logs) com todos os logs de erro
2. Painel de Time Series com taxa de erros por serviço
3. Painel de Stat com contagem total de erros nos últimos 30 minutos

Use port-forward do Grafana e a API para criar o dashboard programaticamente ou via UI.`,
        hints: [
          'O Grafana tem data source Loki pré-configurado pelo Helm chart',
          'O tipo de painel "Logs" usa query LogQL que retorna log lines',
          'Para Time Series com Loki, use Metric Query (rate, count_over_time)',
          'Você pode importar dashboards JSON via API do Grafana'
        ],
        solution: `\`\`\`bash
# Port-forward Grafana (se não estiver ativo)
kubectl port-forward -n monitoring svc/loki-stack-grafana 3000:80 &

# Obter senha
GRAFANA_PASS=\$(kubectl get secret -n monitoring loki-stack-grafana \\
  -o jsonpath='{.data.admin-password}' | base64 -d)

# Obter UID do data source Loki
LOKI_DS_UID=\$(curl -s -u "admin:\$GRAFANA_PASS" \\
  http://localhost:3000/api/datasources | \\
  jq -r '.[] | select(.type=="loki") | .uid')

echo "Loki DS UID: \$LOKI_DS_UID"

# Criar dashboard via API
curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -u "admin:\$GRAFANA_PASS" \\
  http://localhost:3000/api/dashboards/db \\
  -d "{
    \"dashboard\": {
      \"title\": \"Loki Lab Dashboard\",
      \"panels\": [
        {
          \"id\": 1,
          \"title\": \"Error Logs\",
          \"type\": \"logs\",
          \"gridPos\": {\"h\": 8, \"w\": 24, \"x\": 0, \"y\": 0},
          \"datasource\": {\"type\": \"loki\", \"uid\": \"\$LOKI_DS_UID\"},
          \"targets\": [{
            \"expr\": \"{app=\\\\\"api\\\\\"} |= \\\\\"ERROR\\\\\"\",
            \"refId\": \"A\"
          }]
        },
        {
          \"id\": 2,
          \"title\": \"Error Rate by App\",
          \"type\": \"timeseries\",
          \"gridPos\": {\"h\": 8, \"w\": 12, \"x\": 0, \"y\": 8},
          \"datasource\": {\"type\": \"loki\", \"uid\": \"\$LOKI_DS_UID\"},
          \"targets\": [{
            \"expr\": \"sum(rate({app=~\\\\\".+\\\\\"} |= \\\\\"ERROR\\\\\" [5m])) by (app)\",
            \"legendFormat\": \"{{app}}\",
            \"refId\": \"A\"
          }]
        }
      ],
      \"time\": {\"from\": \"now-1h\", \"to\": \"now\"},
      \"refresh\": \"30s\"
    },
    \"overwrite\": true,
    \"folderId\": 0
  }" | jq '.url'
\`\`\``,
        verify: `\`\`\`bash
# Verificar dashboard criado
GRAFANA_PASS=\$(kubectl get secret -n monitoring loki-stack-grafana \\
  -o jsonpath='{.data.admin-password}' | base64 -d)

curl -s -u "admin:\$GRAFANA_PASS" \\
  http://localhost:3000/api/search?query=Loki | \\
  jq '.[].title'
# Saída esperada: "Loki Lab Dashboard"

# Verificar data source Loki está healthy
curl -s -u "admin:\$GRAFANA_PASS" \\
  http://localhost:3000/api/datasources/proxy/uid/\$(curl -s -u "admin:\$GRAFANA_PASS" \\
    http://localhost:3000/api/datasources | jq -r '.[] | select(.type=="loki") | .uid')/loki/api/v1/ready
# Saída esperada: ready

# Confirmar logs aparecem em query direta
curl -s "http://localhost:3100/loki/api/v1/query_range" \\
  --data-urlencode 'query={app=~"api|payment-api"} |= "ERROR"' \\
  --data-urlencode "start=\$(date -d '10 minutes ago' +%s)000000000" \\
  --data-urlencode "end=\$(date +%s)000000000" \\
  --data-urlencode 'limit=3' | jq '.data.result | length'
# Saída esperada: 1 ou mais (streams com logs de erro)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'PrometheusRule não dispara alertas no Loki Ruler',
      difficulty: 'medium',
      symptom: 'Foram criadas PrometheusRules mas o endpoint /loki/api/v1/alerts retorna array vazio, mesmo com as condições sendo atendidas. Não chegam alertas no Alertmanager.',
      diagnosis: `\`\`\`bash
# Verificar se Ruler está habilitado
kubectl exec -n monitoring loki-stack-0 -- \\
  wget -qO- http://localhost:3100/metrics | grep loki_ruler

# Verificar regras carregadas
curl -s "http://localhost:3100/loki/api/v1/rules" | jq 'keys'
# Se retornar {} vazio, Ruler não carregou as regras

# Checar labels da PrometheusRule vs ruleSelector do Ruler
kubectl get prometheusrule -n monitoring loki-lab-alerts -o yaml | \\
  grep -A5 "labels:"

# Verificar configuração do Ruler no ConfigMap
kubectl get configmap -n monitoring loki-stack -o yaml | \\
  grep -A20 "ruler:"

# Checar logs do Loki por erros do Ruler
kubectl logs -n monitoring loki-stack-0 | grep -i "ruler\\|rule\\|alert" | tail -20

# Verificar se Ruler consegue ler as regras
kubectl exec -n monitoring loki-stack-0 -- \\
  ls /tmp/loki/rules/ 2>/dev/null || echo "Rules directory empty or missing"
\`\`\``,
      solution: `**Causa 1**: Ruler não está habilitado ou configurado no loki.yaml.
\`\`\`bash
kubectl edit configmap -n monitoring loki-stack
# Adicionar/corrigir:
# ruler:
#   storage:
#     type: local
#     local:
#       directory: /tmp/loki/rules
#   rule_path: /tmp/loki/rules
#   enable_api: true
#   alertmanager_url: http://alertmanager-operated.monitoring:9093

kubectl rollout restart statefulset/loki-stack -n monitoring
\`\`\`

**Causa 2**: Labels da PrometheusRule não batem com ruleSelector.
\`\`\`bash
# Verificar qual label o Ruler espera
kubectl get configmap -n monitoring loki-stack -o yaml | \\
  grep -A5 "rule_selector\\|ruleSelector"

# Adicionar label correta à PrometheusRule
kubectl patch prometheusrule loki-lab-alerts -n monitoring \\
  --type='merge' \\
  -p '{"metadata":{"labels":{"app":"kube-prometheus-stack"}}}'
\`\`\`

**Causa 3**: Expressão LogQL da regra retorna sem dados.
\`\`\`bash
# Testar a expressão diretamente
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query=YOUR_ALERT_EXPR' \\
  --data-urlencode "time=\$(date +%s)" | jq '.'
# Se result é [], a query não retorna dados — revise o selector e filtros
\`\`\``
    },
    {
      title: 'LogQL retorna "parse error" ou resultados inesperados',
      difficulty: 'easy',
      symptom: 'Queries LogQL retornam "parse error: unexpected identifier" ou retornam dados vazios mesmo com logs presentes no Grafana Explore.',
      diagnosis: `\`\`\`bash
# Testar query simples para isolar problema
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query={app="api"}' \\
  --data-urlencode "time=\$(date +%s)" | jq '.status'
# Se "error", problema no selector

# Verificar labels disponíveis
curl -s "http://localhost:3100/loki/api/v1/labels" | jq '.data'

# Verificar valores da label app
curl -s "http://localhost:3100/loki/api/v1/label/app/values" | jq '.data'

# Testar range da query (pode estar fora do range dos dados)
curl -s "http://localhost:3100/loki/api/v1/query_range" \\
  --data-urlencode 'query={app="api"}' \\
  --data-urlencode "start=\$(date -d '30 minutes ago' +%s)000000000" \\
  --data-urlencode "end=\$(date +%s)000000000" \\
  --data-urlencode 'limit=5' | jq '.data.result | length'

# Verificar formato do log (JSON, logfmt, texto puro)
curl -s "http://localhost:3100/loki/api/v1/query_range" \\
  --data-urlencode 'query={app="api"}' \\
  --data-urlencode "start=\$(date -d '5 minutes ago' +%s)000000000" \\
  --data-urlencode "end=\$(date +%s)000000000" \\
  --data-urlencode 'limit=1' | jq '.data.result[0].values[0][1]'
\`\`\``,
      solution: `**Causa 1**: Query sem log stream selector (obrigatório).
\`\`\`
# Errado:
|= "error" | json

# Correto:
{app="api"} |= "error" | json
\`\`\`

**Causa 2**: Label não existe ou tem valor diferente do esperado.
\`\`\`bash
# Ver valores reais da label
curl -s "http://localhost:3100/loki/api/v1/label/app/values" | jq '.data'
# Use o valor exato retornado na query
\`\`\`

**Causa 3**: Range de tempo não cobre quando os logs foram gerados.
\`\`\`bash
# Aumentar o range ou usar --since no logcli
logcli query '{app="api"}' --since=1h
\`\`\`

**Causa 4**: Parser | json falha porque log não é JSON válido.
\`\`\`bash
# Ver linha de log crua para verificar formato
{app="api"} | line_format "{{.Message}}"
# Se vir texto puro, não use | json — use | pattern ou | regexp
\`\`\``
    }
  ]
};
