window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['prom-fundamentals/prom-alerting'] = {
  theory: `
# Alerting com Prometheus e Alertmanager

## Relevancia
Alerting e a funcao mais critica do Prometheus em producao. Sem alertas bem configurados, problemas passam despercebidos ate causarem incidentes graves. Entender alerting rules, Alertmanager e boas praticas de SLO/SLI e essencial para qualquer SRE/DevOps.

## Conceitos Fundamentais

### Fluxo de Alerting

\`\`\`
Prometheus           Alertmanager              Receptores
+---------------+    +------------------+    +------------+
| Alerting Rules |--->| Routing          |--->| Slack      |
| (avalia PromQL)|    | Grouping         |    | PagerDuty  |
| for: duration  |    | Inhibition       |    | Email      |
| labels/annot.  |    | Silencing        |    | Webhook    |
+---------------+    +------------------+    +------------+
\`\`\`

1. **Prometheus** avalia alerting rules periodicamente
2. Quando a condicao e verdadeira por \`for\` duracao, o alerta fica **firing**
3. O alerta e enviado ao **Alertmanager**
4. Alertmanager aplica **routing**, **grouping**, **inhibition** e **silences**
5. Notificacao e enviada ao **receptor** configurado

### Estados de um Alerta

| Estado | Descricao |
|--------|-----------|
| **inactive** | A condicao nao e verdadeira |
| **pending** | A condicao e verdadeira, mas \`for\` ainda nao completou |
| **firing** | A condicao e verdadeira por pelo menos \`for\` duracao |

### Alerting Rules

\`\`\`yaml
# /etc/prometheus/rules/alerting_rules.yml
groups:
  - name: node_alerts
    rules:
      - alert: HighCPUUsage
        expr: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100 > 80
        for: 5m
        labels:
          severity: warning
          team: infra
        annotations:
          summary: "CPU alta no node {{ \$labels.instance }}"
          description: "O node {{ \$labels.instance }} esta com {{ \$value | printf \\"%.1f\\" }}% de uso de CPU ha mais de 5 minutos."
          runbook_url: "https://wiki.internal/runbooks/high-cpu"

      - alert: NodeDown
        expr: up{job="node-exporter"} == 0
        for: 2m
        labels:
          severity: critical
          team: infra
        annotations:
          summary: "Node {{ \$labels.instance }} esta DOWN"
          description: "O node_exporter em {{ \$labels.instance }} nao responde ha 2 minutos."
\`\`\`

### Componentes de uma Alerting Rule

| Campo | Obrigatorio | Descricao |
|-------|:-----------:|-----------|
| \`alert\` | Sim | Nome do alerta |
| \`expr\` | Sim | Expressao PromQL que define a condicao |
| \`for\` | Nao | Tempo que a condicao deve ser verdadeira antes de firing |
| \`labels\` | Nao | Labels adicionais (severity, team, etc.) |
| \`annotations\` | Nao | Informacoes descritivas (summary, description, runbook) |

### Boas Praticas em Alerting Rules

**Severidade:**
\`\`\`yaml
labels:
  severity: critical   # Requer acao imediata (pager)
  severity: warning    # Requer atencao em horario comercial
  severity: info       # Informativo, nao requer acao
\`\`\`

**Clausula for:**
- Evita falsos positivos causados por picos momentaneos
- **critical**: 2-5 minutos (acao urgente, mas evitar flapping)
- **warning**: 5-15 minutos (mais tolerante)
- **Nunca use for: 0** em producao (gera muito ruido)

**Annotations uteis:**
- \`summary\`: descricao curta (1 linha)
- \`description\`: detalhes com {{ \$labels.xxx }} e {{ \$value }}
- \`runbook_url\`: link para procedimento de resolucao

## Alertmanager — Configuracao

### Estrutura Basica

\`\`\`yaml
# alertmanager.yml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'alertmanager@example.com'

route:
  receiver: 'default-slack'
  group_by: ['alertname', 'namespace']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      repeat_interval: 1h
    - match:
        severity: warning
      receiver: 'slack-warnings'
      repeat_interval: 8h

receivers:
  - name: 'default-slack'
    slack_configs:
      - channel: '#alerts'
        send_resolved: true
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: 'PAGERDUTY_KEY'
        severity: '{{ .GroupLabels.severity }}'

  - name: 'slack-warnings'
    slack_configs:
      - channel: '#warnings'
        send_resolved: true

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
\`\`\`

### Conceitos do Alertmanager

**Grouping:** Agrupa alertas similares em uma unica notificacao.
\`\`\`yaml
group_by: ['alertname', 'namespace']
# Agrupa todos os alertas com mesmo nome e namespace
\`\`\`

**Inhibition:** Suprime alertas quando outro alerta mais severo esta ativo.
\`\`\`yaml
# Se um alerta CRITICAL esta ativo, suprime o WARNING correspondente
inhibit_rules:
  - source_match: { severity: 'critical' }
    target_match: { severity: 'warning' }
    equal: ['alertname', 'instance']
\`\`\`

**Silences:** Silencia alertas temporariamente (via UI do Alertmanager).
- Uteis durante manutencoes planejadas
- Definem matchers para quais alertas silenciar
- Tem duracao definida (expira automaticamente)

**Timings:**
| Parametro | Descricao | Recomendado |
|-----------|-----------|-------------|
| \`group_wait\` | Tempo para esperar novos alertas antes de enviar | 30s - 1m |
| \`group_interval\` | Tempo entre notificacoes do mesmo grupo | 5m |
| \`repeat_interval\` | Tempo antes de reenviar o mesmo alerta | 4h (warning), 1h (critical) |

## Alertas Essenciais para Kubernetes

### Infraestrutura
\`\`\`yaml
# Node sem resposta
- alert: NodeUnreachable
  expr: up{job="node-exporter"} == 0
  for: 3m
  labels:
    severity: critical

# Disco vai encher em 24h
- alert: DiskWillFillIn24h
  expr: predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[6h], 86400) < 0
  for: 10m
  labels:
    severity: warning

# Memoria alta
- alert: HighMemoryUsage
  expr: (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100 > 90
  for: 5m
  labels:
    severity: warning
\`\`\`

### Aplicacoes
\`\`\`yaml
# Taxa de erro alta (> 5% dos requests)
- alert: HighErrorRate
  expr: |
    sum by(service) (rate(http_requests_total{status=~"5.."}[5m]))
    /
    sum by(service) (rate(http_requests_total[5m]))
    > 0.05
  for: 5m
  labels:
    severity: critical

# Latencia P99 alta
- alert: HighLatencyP99
  expr: |
    histogram_quantile(0.99,
      sum by(service, le) (rate(http_request_duration_seconds_bucket[5m]))
    ) > 1
  for: 5m
  labels:
    severity: warning

# Pod em CrashLoopBackOff
- alert: PodCrashLooping
  expr: rate(kube_pod_container_status_restarts_total[15m]) * 60 * 15 > 0
  for: 5m
  labels:
    severity: warning
\`\`\`

### SLO/SLI Alerts (Burn Rate)
\`\`\`yaml
# SLO: 99.9% de disponibilidade
# Burn rate: se continuar neste ritmo, o budget acaba em X tempo

# Burn rate rapido (budget acaba em 2 horas)
- alert: SLOBurnRateCritical
  expr: |
    (
      sum(rate(http_requests_total{status=~"5.."}[5m]))
      /
      sum(rate(http_requests_total[5m]))
    ) > (14.4 * 0.001)
  for: 2m
  labels:
    severity: critical
    slo: availability

# Burn rate lento (budget acaba em 3 dias)
- alert: SLOBurnRateWarning
  expr: |
    (
      sum(rate(http_requests_total{status=~"5.."}[1h]))
      /
      sum(rate(http_requests_total[1h]))
    ) > (1 * 0.001)
  for: 1h
  labels:
    severity: warning
    slo: availability
\`\`\`

## Erros Comuns

1. **Alerta sem \`for\`**: Causa flapping (alerta dispara e resolve rapidamente em loop). Sempre use \`for\` de pelo menos 1-2 minutos.
2. **Severity unico**: Usar apenas "critical" para tudo causa alert fatigue. Diferencie critical/warning/info.
3. **Alertas sem runbook_url**: Quando o alerta dispara, o oncall nao sabe o que fazer. Sempre inclua um link para procedimento.
4. **group_wait muito curto**: Causa muitas notificacoes fragmentadas. Use pelo menos 30s.
5. **Nao usar inhibition**: Receber warning E critical para o mesmo problema gera ruido. Configure inhibit_rules.
6. **Alertas baseados em sintomas, nao causas**: Alerte sobre "taxa de erro > 5%" (sintoma), nao "CPU > 80%" (causa). Sintomas sao mais acionaveis.

## Killer.sh Style Challenge

**Cenario:** Configure alerting para um cluster de producao com Prometheus e Alertmanager.

**Tarefas:**
1. Crie uma alerting rule para quando o disco estiver > 85% cheio por mais de 10 minutos
2. Configure o Alertmanager para enviar alertas critical para PagerDuty e warning para Slack
3. Crie uma inhibition rule que suprime warnings quando o critical correspondente esta ativo
4. Escreva um alerta SLO-based que detecta quando a taxa de erro excede 14.4x o burn rate

**Solucoes:**
\`\`\`yaml
# 1. Alerta de disco
- alert: DiskSpaceCritical
  expr: (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 > 85
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Disco acima de 85% em {{ \$labels.instance }}"

# 2. Routing no Alertmanager
route:
  receiver: default
  routes:
    - match: { severity: critical }
      receiver: pagerduty
    - match: { severity: warning }
      receiver: slack

# 3. Inhibition rule
inhibit_rules:
  - source_match: { severity: critical }
    target_match: { severity: warning }
    equal: [alertname, instance]

# 4. SLO burn rate
- alert: HighBurnRate
  expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.0144
  for: 2m
  labels:
    severity: critical
\`\`\`
`,
  quiz: [
    {
      question: 'Qual a funcao da clausula "for" em uma alerting rule do Prometheus?',
      options: [
        'Define o intervalo de avaliacao da rule',
        'Define quanto tempo a condicao deve ser verdadeira antes do alerta mudar para firing',
        'Define por quanto tempo o alerta fica ativo',
        'Define o timeout do alerta'
      ],
      correct: 1,
      explanation: 'A clausula "for" define a duracao minima que a condicao expr deve ser continuamente verdadeira antes do alerta transitar de "pending" para "firing". Isso evita falsos positivos causados por picos momentaneos.',
      reference: 'Conceito relacionado: promql-basics — entenda as funcoes rate() e avg() usadas nas expressoes de alerta.'
    },
    {
      question: 'Quais sao os tres estados possiveis de um alerta no Prometheus?',
      options: [
        'active, paused, resolved',
        'inactive, pending, firing',
        'open, acknowledged, closed',
        'new, processing, sent'
      ],
      correct: 1,
      explanation: 'Os tres estados sao: inactive (condicao falsa), pending (condicao verdadeira mas "for" ainda nao completou) e firing (condicao verdadeira pelo tempo definido em "for"). O alerta so e enviado ao Alertmanager quando esta firing.',
      reference: 'Conceito relacionado: prom-architecture — o Prometheus avalia rules no seu evaluation_interval.'
    },
    {
      question: 'O que faz a funcao "inhibition" no Alertmanager?',
      options: [
        'Agrupa alertas similares em uma notificacao',
        'Silencia alertas temporariamente',
        'Suprime alertas menos severos quando um alerta mais severo correspondente esta ativo',
        'Impede que alertas sejam enviados fora do horario comercial'
      ],
      correct: 2,
      explanation: 'Inhibition suprime automaticamente alertas que correspondem a target_match quando um alerta que corresponde a source_match esta ativo, e as labels especificadas em "equal" coincidem. Exemplo: suprimir warning quando critical esta ativo para o mesmo alertname.',
      reference: 'Conceito relacionado: prom-alerting — configure inhibition junto com routing para reduzir ruido.'
    },
    {
      question: 'Qual e a pratica recomendada para definir severidade de alertas?',
      options: [
        'Usar apenas "critical" para todos os alertas',
        'Diferenciar entre critical (acao imediata/pager), warning (horario comercial) e info (informativo)',
        'Usar numeros de 1 a 10 para severidade',
        'Deixar a severidade para o Alertmanager decidir automaticamente'
      ],
      correct: 1,
      explanation: 'A pratica recomendada e usar 3 niveis: critical (requer acao imediata, dispara pager), warning (requer atencao em horario comercial) e info (apenas informativo). Usar apenas critical causa alert fatigue e torna o oncall insustentavel.',
      reference: 'Conceito relacionado: sre-practices — alerting e parte fundamental das praticas SRE (SLO/SLI/error budget).'
    },
    {
      question: 'Para que serve o parametro group_by no routing do Alertmanager?',
      options: [
        'Para filtrar alertas por grupo',
        'Para agrupar alertas similares em uma unica notificacao, reduzindo ruido',
        'Para definir a ordem de envio dos alertas',
        'Para criar grupos de receptores'
      ],
      correct: 1,
      explanation: 'group_by agrupa alertas que compartilham as mesmas labels especificadas em uma unica notificacao. Por exemplo, group_by: [alertname, namespace] agrupa todos os alertas com mesmo nome e namespace, evitando enviar dezenas de notificacoes separadas.',
      reference: 'Conceito relacionado: prom-alerting — combine grouping com timings (group_wait, group_interval) para controle fino.'
    },
    {
      question: 'O que e um alerta baseado em "burn rate" no contexto de SLO?',
      options: [
        'Um alerta que mede a temperatura do servidor',
        'Um alerta que detecta quando o error budget esta sendo consumido mais rapido que o aceitavel',
        'Um alerta que mede o consumo de CPU',
        'Um alerta que dispara quando o sistema esta sobrecarregado'
      ],
      correct: 1,
      explanation: 'Burn rate mede a velocidade com que o error budget de um SLO esta sendo consumido. Um burn rate de 1x significa que o budget sera consumido exatamente no periodo do SLO. 14.4x significa que sera consumido em ~2 horas (se o SLO e mensal). Alertas de burn rate sao mais efetivos que alertas de threshold simples.',
      reference: 'Conceito relacionado: sre-practices — SLO, SLI e error budget sao conceitos centrais de SRE.'
    },
    {
      question: 'Por que e importante incluir annotations.runbook_url em alerting rules?',
      options: [
        'E obrigatorio pelo Prometheus',
        'Para que o oncall saiba exatamente o que fazer quando o alerta dispara, reduzindo MTTR',
        'Para gerar documentacao automatica',
        'Para o Alertmanager decidir o routing'
      ],
      correct: 1,
      explanation: 'runbook_url fornece um link para um procedimento de resolucao. Quando o alerta dispara as 3h da manha, o oncall consegue seguir um passo-a-passo claro em vez de diagnosticar do zero. Isso reduz significativamente o MTTR (Mean Time To Recover).',
      reference: 'Conceito relacionado: sre-practices — runbooks sao parte da cultura de SRE para operacoes confiaveis.'
    },
    {
      question: 'Qual a diferenca entre group_wait, group_interval e repeat_interval no Alertmanager?',
      options: [
        'Sao todos sinonimos para o mesmo parametro',
        'group_wait: espera antes do primeiro envio; group_interval: entre atualizacoes do grupo; repeat_interval: antes de reenviar o mesmo alerta',
        'group_wait: intervalo de avaliacao; group_interval: timeout; repeat_interval: retentativas',
        'Todos controlam o tempo de silencio entre alertas'
      ],
      correct: 1,
      explanation: 'group_wait (30s-1m): quanto tempo esperar por novos alertas antes de enviar a primeira notificacao do grupo. group_interval (5m): tempo entre notificacoes quando novas alertas sao adicionadas ao grupo. repeat_interval (1-8h): quanto tempo antes de reenviar um alerta que ainda esta firing.',
      reference: 'Conceito relacionado: prom-alerting — ajustar timings e essencial para evitar alert fatigue.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os 3 estados de um alerta no Prometheus?',
      back: '1. **inactive** — a condicao PromQL e falsa\n2. **pending** — a condicao e verdadeira, mas o tempo "for" ainda nao passou\n3. **firing** — a condicao e verdadeira pelo tempo definido em "for"\n\nO alerta so e enviado ao Alertmanager quando esta no estado **firing**.'
    },
    {
      front: 'O que faz cada timing do Alertmanager?',
      back: '- **group_wait** (30s): tempo para coletar alertas iniciais antes de enviar a primeira notificacao\n- **group_interval** (5m): tempo entre envios quando novos alertas entram no grupo\n- **repeat_interval** (4h): tempo antes de reenviar um alerta que continua firing\n\nAjuste estes valores para equilibrar velocidade de resposta vs. alert fatigue.'
    },
    {
      front: 'O que e inhibition no Alertmanager?',
      back: 'Inhibition suprime automaticamente alertas menos severos quando um alerta mais severo correspondente esta ativo.\n\nExemplo:\n```yaml\ninhibit_rules:\n  - source_match: { severity: critical }\n    target_match: { severity: warning }\n    equal: [alertname, instance]\n```\n\nSe "NodeDown" critical esta ativo para instance X, "HighCPU" warning para a mesma instance sera suprimido.'
    },
    {
      front: 'Quais os 3 niveis de severidade recomendados para alertas?',
      back: '- **critical**: Requer acao imediata. Dispara pager/telefone. Use "for: 2-5m".\n- **warning**: Requer atencao em horario comercial. Envia para Slack/email. Use "for: 5-15m".\n- **info**: Apenas informativo, nao requer acao. Pode ser visto em dashboard.\n\nRegra: se o oncall nao precisa acordar, NAO e critical.'
    },
    {
      front: 'O que e burn rate e como calcular para SLO?',
      back: 'Burn rate mede quao rapido o error budget de um SLO esta sendo consumido.\n\n- **Burn rate 1x**: budget consumido exatamente no periodo (30 dias)\n- **Burn rate 14.4x**: budget consumido em ~2 horas\n- **Burn rate 6x**: budget consumido em ~5 dias\n\nFormula: error_rate / error_budget\nExemplo (SLO 99.9%): burn_rate = error_rate / 0.001\n\nAlerta: burn_rate > 14.4 (critical), > 6 (warning), > 1 (info)'
    },
    {
      front: 'Quais annotations sao essenciais em alerting rules?',
      back: '1. **summary**: Descricao curta (1 linha) do problema\n2. **description**: Detalhes com template variables:\n   - {{ $labels.instance }} — valor da label\n   - {{ $value }} — valor atual da expressao\n   - {{ $value | printf "%.1f" }} — formatado\n3. **runbook_url**: Link para procedimento de resolucao\n\nAnnotations sao exibidas na notificacao e ajudam o oncall a agir rapidamente.'
    },
    {
      front: 'Quais sao os alertas essenciais para um cluster Kubernetes?',
      back: '**Infraestrutura:**\n- NodeDown (up == 0)\n- HighCPU (> 80% por 5min)\n- HighMemory (> 90% por 5min)\n- DiskWillFill (predict_linear < 0 em 24h)\n\n**Aplicacao:**\n- HighErrorRate (5xx > 5%)\n- HighLatency (P99 > threshold)\n- PodCrashLooping (restarts > 0)\n\n**SLO:**\n- BurnRate critical (14.4x)\n- BurnRate warning (6x)'
    },
    {
      front: 'O que e group_by no routing do Alertmanager?',
      back: '**group_by** agrupa alertas que compartilham labels em uma unica notificacao.\n\n```yaml\nroute:\n  group_by: [alertname, namespace]\n```\n\nSem grouping: 50 pods falhando = 50 notificacoes separadas.\nCom grouping: 50 pods falhando = 1 notificacao agrupada.\n\nLabels comuns para grouping:\n- alertname: agrupa por tipo de alerta\n- namespace: agrupa por namespace K8s\n- cluster: agrupa por cluster'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar alerting para um cluster Kubernetes de producao usando Prometheus e Alertmanager. O cluster roda aplicacoes HTTP e precisa de alertas de infraestrutura, aplicacao e SLO.',
    objective: 'Configurar alerting rules no Prometheus, Alertmanager com routing e inhibition, e implementar alertas de SLO burn rate. Ao final, voce tera um sistema de alerting completo.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Criar Alerting Rules de Infraestrutura',
        instruction: `Crie um arquivo de alerting rules para monitorar a infraestrutura do cluster.

\`\`\`yaml
# /etc/prometheus/rules/infra_alerts.yml
groups:
  - name: infrastructure
    rules:
      - alert: NodeDown
        expr: up{job="node-exporter"} == 0
        for: 3m
        labels:
          severity: critical
          team: infra
        annotations:
          summary: "Node {{ \$labels.instance }} is DOWN"
          description: "node_exporter on {{ \$labels.instance }} has been unreachable for 3 minutes."
          runbook_url: "https://wiki/runbooks/node-down"

      - alert: HighCPUUsage
        expr: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100 > 80
        for: 5m
        labels:
          severity: warning
          team: infra
        annotations:
          summary: "High CPU on {{ \$labels.instance }}"
          description: "CPU usage is {{ \$value | printf \\"%.1f\\" }}% on {{ \$labels.instance }}."

      - alert: DiskSpaceLow
        expr: (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 > 85
        for: 10m
        labels:
          severity: warning
          team: infra
        annotations:
          summary: "Disk space low on {{ \$labels.instance }}"

      - alert: DiskWillFillIn24h
        expr: predict_linear(node_filesystem_avail_bytes{mountpoint="/",fstype!~"tmpfs|overlay"}[6h], 86400) < 0
        for: 30m
        labels:
          severity: warning
          team: infra
        annotations:
          summary: "Disk on {{ \$labels.instance }} will fill in 24h"
\`\`\`

Valide o arquivo com promtool.`,
        hints: [
          'Use promtool check rules para validar antes de aplicar',
          'A clausula for evita falsos positivos de picos curtos',
          'Annotations suportam templates Go: {{ $labels.xxx }} e {{ $value }}'
        ],
        solution: `\`\`\`bash
# Criar o arquivo de rules
cat > /etc/prometheus/rules/infra_alerts.yml << 'EOF'
groups:
  - name: infrastructure
    rules:
      - alert: NodeDown
        expr: up{job="node-exporter"} == 0
        for: 3m
        labels:
          severity: critical
        annotations:
          summary: "Node {{ \$labels.instance }} is DOWN"
      - alert: HighCPUUsage
        expr: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100 > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU on {{ \$labels.instance }}: {{ \$value | printf \\"%.1f\\" }}%"
EOF

# Validar
promtool check rules /etc/prometheus/rules/infra_alerts.yml

# Recarregar Prometheus
curl -X POST http://localhost:9090/-/reload
\`\`\``,
        verify: `\`\`\`bash
# Validar sintaxe das rules
promtool check rules /etc/prometheus/rules/infra_alerts.yml
# Saida esperada: SUCCESS

# Verificar que as rules foram carregadas
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[] | select(.name=="infrastructure") | .rules | length'
# Saida esperada: 4 (ou o numero de rules que voce criou)

# Verificar status dos alertas
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts | length'
# Saida esperada: numero >= 0
\`\`\``
      },
      {
        title: 'Criar Alerting Rules de Aplicacao',
        instruction: `Crie alerting rules focadas em metricas de aplicacao HTTP.

\`\`\`yaml
# /etc/prometheus/rules/app_alerts.yml
groups:
  - name: application
    rules:
      - alert: HighErrorRate
        expr: |
          sum by(service) (rate(http_requests_total{status=~"5.."}[5m]))
          /
          sum by(service) (rate(http_requests_total[5m]))
          > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ \$labels.service }}"
          description: "{{ \$value | printf \\"%.2f\\" }}% of requests are failing."

      - alert: HighLatencyP99
        expr: |
          histogram_quantile(0.99,
            sum by(service, le) (rate(http_request_duration_seconds_bucket[5m]))
          ) > 1.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High P99 latency on {{ \$labels.service }}"

      - alert: PodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total[15m]) * 60 * 15 > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Pod {{ \$labels.namespace }}/{{ \$labels.pod }} is crash looping"
\`\`\``,
        hints: [
          'Use rate() com pelo menos 5m para alertas estaveis',
          'Para taxa de erro, divida erros 5xx pelo total de requests',
          'histogram_quantile precisa de "le" preservado no sum by()'
        ],
        solution: `\`\`\`bash
# Criar arquivo de regras de aplicacao
cat > /etc/prometheus/rules/app_alerts.yml << 'EOF'
groups:
  - name: application
    rules:
      - alert: HighErrorRate
        expr: |
          sum by(service) (rate(http_requests_total{status=~"5.."}[5m]))
          /
          sum by(service) (rate(http_requests_total[5m]))
          > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Error rate > 5% on {{ \$labels.service }}"
      - alert: PodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total[15m]) * 60 * 15 > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "{{ \$labels.pod }} crash looping in {{ \$labels.namespace }}"
EOF

# Validar e recarregar
promtool check rules /etc/prometheus/rules/app_alerts.yml
curl -X POST http://localhost:9090/-/reload
\`\`\``,
        verify: `\`\`\`bash
# Validar sintaxe
promtool check rules /etc/prometheus/rules/app_alerts.yml
# Saida esperada: SUCCESS

# Verificar que as rules de aplicacao foram carregadas
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[] | select(.name=="application") | .rules[] | .name'
# Saida esperada: "HighErrorRate", "HighLatencyP99", "PodCrashLooping"
\`\`\``
      },
      {
        title: 'Configurar Alertmanager com Routing',
        instruction: `Configure o Alertmanager com routing por severidade, grouping e inhibition.

\`\`\`yaml
# /etc/alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  receiver: 'default'
  group_by: ['alertname', 'namespace']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    - match:
        severity: critical
      receiver: 'critical-channel'
      repeat_interval: 1h
      continue: false
    - match:
        severity: warning
      receiver: 'warning-channel'
      repeat_interval: 8h

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://localhost:5001/webhook'

  - name: 'critical-channel'
    webhook_configs:
      - url: 'http://localhost:5001/critical'

  - name: 'warning-channel'
    webhook_configs:
      - url: 'http://localhost:5001/warning'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
\`\`\`

Valide e aplique a configuracao do Alertmanager.`,
        hints: [
          'amtool pode validar a configuracao do Alertmanager',
          'group_by define como alertas sao agrupados na notificacao',
          'inhibit_rules reduz ruido suprimindo warnings quando critical esta ativo',
          'continue: false (padrao) para no primeiro match; true continua avaliando rotas'
        ],
        solution: `\`\`\`bash
# Validar configuracao do Alertmanager
amtool check-config /etc/alertmanager/alertmanager.yml

# Recarregar Alertmanager
curl -X POST http://localhost:9093/-/reload

# Verificar status
curl -s http://localhost:9093/api/v2/status | jq '.cluster.status'
\`\`\``,
        verify: `\`\`\`bash
# Validar configuracao
amtool check-config /etc/alertmanager/alertmanager.yml
# Saida esperada: SUCCESS (ou "found no errors")

# Verificar que o Alertmanager esta rodando
curl -s http://localhost:9093/api/v2/status | jq '.cluster.status'
# Saida esperada: "ready"

# Verificar alertas ativos no Alertmanager
curl -s http://localhost:9093/api/v2/alerts | jq '. | length'
# Saida esperada: numero >= 0
\`\`\``
      },
      {
        title: 'Testar e Verificar Alertas',
        instruction: `Teste o pipeline de alerting end-to-end: gere uma condicao de alerta e verifique que a notificacao e recebida.

\`\`\`bash
# Verificar alertas ativos no Prometheus
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | {alertname: .labels.alertname, state: .state, severity: .labels.severity}'

# Verificar rules no Prometheus
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | {name: .name, state: .state, health: .health}'

# Verificar alertas no Alertmanager
curl -s http://localhost:9093/api/v2/alerts | jq '.[] | {alertname: .labels.alertname, status: .status.state}'

# Criar um silence para teste (expira em 1 hora)
amtool silence add alertname=TestAlert --duration=1h --comment="Teste de silence"

# Listar silences ativos
amtool silence query
\`\`\``,
        hints: [
          'Alertas no estado "pending" ainda nao foram enviados ao Alertmanager',
          'Use amtool para interagir com o Alertmanager via CLI',
          'Silences expiram automaticamente apos a duracao definida'
        ],
        solution: `\`\`\`bash
# Ver todos os alertas e seus estados
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | {alert: .labels.alertname, state: .state}'

# Ver health de todas as rules
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.type=="alerting") | {name: .name, state: .state}'

# Criar silence via amtool
amtool silence add alertname="HighCPUUsage" --duration=2h --comment="Manutencao planejada" --alertmanager.url=http://localhost:9093

# Listar silences
amtool silence query --alertmanager.url=http://localhost:9093

# Remover silence
amtool silence expire <silence-id> --alertmanager.url=http://localhost:9093
\`\`\``,
        verify: `\`\`\`bash
# Verificar que rules estao saudaveis
curl -s http://localhost:9090/api/v1/rules | jq '[.data.groups[].rules[] | select(.health != "ok")] | length'
# Saida esperada: 0 (todas as rules devem estar saudaveis)

# Verificar conectividade Prometheus -> Alertmanager
curl -s http://localhost:9090/api/v1/alertmanagers | jq '.data.activeAlertmanagers | length'
# Saida esperada: numero > 0

# Verificar que o Alertmanager esta processando alertas
curl -s http://localhost:9093/api/v2/status | jq '.cluster.status'
# Saida esperada: "ready"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Alertas ficam eternamente em "pending" e nunca vao para "firing"',
      difficulty: 'easy',
      symptom: 'Uma alerting rule mostra estado "pending" no Prometheus, mas nunca transita para "firing", mesmo que a condicao esteja claramente violada.',
      diagnosis: `\`\`\`bash
# Verificar o estado da rule
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.name=="NomeDaRule") | {state: .state, lastEvaluation: .lastEvaluation, evaluationTime: .evaluationTime}'

# Verificar se a expressao retorna dados consistentemente
# Executar a mesma expressao manualmente
curl -s 'http://localhost:9090/api/v1/query?query=YOUR_EXPRESSION' | jq '.data.result'

# Verificar evaluation_interval vs "for"
curl -s http://localhost:9090/api/v1/status/config | jq '.data.yaml' | grep evaluation_interval
\`\`\``,
      solution: `**Causas comuns:**

1. **Condicao intermitente:** A metrica oscila entre verdadeiro e falso. O Prometheus reseta o timer de "for" cada vez que a condicao fica falsa.
\`\`\`promql
# Solucao: suavizar a metrica com avg_over_time ou range maior
avg_over_time(metrica[10m]) > threshold
# em vez de
metrica > threshold
\`\`\`

2. **Evaluation interval muito longo:** Se evaluation_interval e 1m e "for" e 2m, a condicao precisa ser verdadeira em 3 avaliacoes consecutivas (3 minutos efetivos).

3. **Target instavel:** Se o target fica UP/DOWN intermitente, as series sao descontinuas.

4. **Labels mudando:** Se labels como "pod" mudam (redeploy), o Prometheus trata como serie nova e reseta o "for".
\`\`\`promql
# Agregar sem labels volateis
sum by(service) (rate(metric[5m]))  # sem "pod" ou "instance"
\`\`\``
    },
    {
      title: 'Alertmanager nao envia notificacoes mesmo com alertas firing',
      difficulty: 'medium',
      symptom: 'O Prometheus mostra alertas em estado "firing", mas o Alertmanager nao esta enviando notificacoes para o canal configurado (Slack, PagerDuty, etc.).',
      diagnosis: `\`\`\`bash
# Verificar se o Prometheus esta conectado ao Alertmanager
curl -s http://localhost:9090/api/v1/alertmanagers | jq '.data.activeAlertmanagers'

# Verificar alertas recebidos pelo Alertmanager
curl -s http://localhost:9093/api/v2/alerts | jq '. | length'

# Verificar se ha silences ativos que suprimem o alerta
curl -s http://localhost:9093/api/v2/silences | jq '.[] | select(.status.state=="active") | {matchers: .matchers, createdBy: .createdBy}'

# Verificar logs do Alertmanager
kubectl logs -l app=alertmanager --tail=50 | grep -i "error\\|fail\\|notify"
\`\`\``,
      solution: `**Causas comuns:**

1. **Silence ativo:** Um silence pode estar suprimindo o alerta.
\`\`\`bash
amtool silence query --alertmanager.url=http://localhost:9093
# Se encontrar silences, expire-os:
amtool silence expire <id>
\`\`\`

2. **Inhibition rule suprimindo:** Verifique se uma inhibit_rule esta suprimindo o alerta.
\`\`\`yaml
# Revise inhibit_rules no alertmanager.yml
inhibit_rules:
  - source_match: { severity: critical }
    target_match: { severity: warning }
    equal: [alertname]  # Cuidado: "equal" muito amplo pode suprimir demais
\`\`\`

3. **Routing errado:** O alerta pode estar indo para o receiver errado.
\`\`\`bash
# Testar routing
amtool config routes test --config.file=alertmanager.yml severity=critical team=infra
\`\`\`

4. **Receptor mal configurado:** Token/URL invalido no Slack/PagerDuty.
\`\`\`bash
# Verificar logs de erro de envio
kubectl logs -l app=alertmanager | grep "error.*notify"
\`\`\`

5. **repeat_interval ainda nao passou:** O alerta ja foi enviado e repeat_interval (ex: 4h) nao expirou.`
    },
    {
      title: 'Alert fatigue — muitas notificacoes inuteis',
      difficulty: 'hard',
      symptom: 'A equipe recebe dezenas de alertas por dia, muitos irrelevantes ou duplicados. O oncall esta ignorando notificacoes, e alertas reais passam despercebidos.',
      diagnosis: `\`\`\`bash
# Contar alertas por tipo nas ultimas 24h
curl -s http://localhost:9093/api/v2/alerts | jq 'group_by(.labels.alertname) | map({alertname: .[0].labels.alertname, count: length}) | sort_by(-.count)'

# Identificar alertas que flappam (fired + resolved rapidamente)
curl -s http://localhost:9093/api/v2/alerts | jq '[.[] | select(.endsAt != null)] | map({alertname: .labels.alertname, duration: (.endsAt | sub("T.*"; "") )}) '

# Verificar grouping
grep -A5 "group_by" /etc/alertmanager/alertmanager.yml
\`\`\``,
      solution: `**Estrategias para reduzir alert fatigue:**

1. **Revisar thresholds e "for":**
\`\`\`yaml
# Antes (muito sensivel)
- alert: HighCPU
  expr: cpu_usage > 70
  for: 1m

# Depois (mais tolerante)
- alert: HighCPU
  expr: avg_over_time(cpu_usage[10m]) > 85
  for: 10m
\`\`\`

2. **Implementar grouping adequado:**
\`\`\`yaml
route:
  group_by: ['alertname', 'namespace', 'severity']
  group_wait: 1m      # mais tempo para agrupar
  group_interval: 10m  # menos atualizacoes
\`\`\`

3. **Adicionar inhibition rules:**
\`\`\`yaml
inhibit_rules:
  - source_match: { severity: critical }
    target_match: { severity: warning }
    equal: [alertname, namespace]
  - source_match: { alertname: NodeDown }
    target_match: { alertname: HighCPU }
    equal: [instance]
\`\`\`

4. **Migrar para alertas SLO-based:**
\`\`\`yaml
# Em vez de alertar em cada metrica individual:
- alert: SLOBurnRate
  expr: error_rate / error_budget > 14.4
  for: 2m
  labels:
    severity: critical
\`\`\`

5. **Regra de ouro:** Se nenhuma acao e necessaria quando o alerta dispara, **remova o alerta**. Todo alerta deve ter uma acao clara associada.`
    }
  ]
};
