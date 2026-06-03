window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['prom-grafana/grafana-alerting'] = {
  theory: `
# Grafana Alerting

## Relevancia
O Grafana possui seu proprio sistema de alertas que complementa (ou substitui) o Alertmanager do Prometheus. Grafana Alerting permite definir alertas via interface grafica, gerenciar notificacoes e criar silences de forma mais acessivel que a configuracao manual do Alertmanager.

## Conceitos Fundamentais

### Grafana Alerting vs Prometheus Alertmanager

| Aspecto | Grafana Alerting | Prometheus Alertmanager |
|---------|-----------------|----------------------|
| **Configuracao** | Via UI grafica | Via YAML |
| **Multi-datasource** | Sim (Prometheus, Loki, etc.) | Apenas Prometheus |
| **Persistencia** | Banco do Grafana | Arquivos de configuracao |
| **Integracao** | Nativo no Grafana | Requer config separada |
| **GitOps** | Provisioning YAML/JSON | YAML nativo |
| **Recomendado para** | Times que usam Grafana como hub | Ambientes puramente Prometheus |

### Arquitetura do Grafana Alerting

\`\`\`
+------------------+     +-------------------+     +------------------+
| Alert Rules      |     | Alert Manager     |     | Contact Points   |
| (PromQL/LogQL)   |---->| (interno Grafana)  |---->| (Slack, Email,   |
| Evaluation       |     | Routing           |     |  PagerDuty,      |
| Conditions       |     | Grouping          |     |  Webhook)        |
+------------------+     | Silencing         |     +------------------+
                          +-------------------+
\`\`\`

### Componentes Principais

| Componente | Descricao |
|-----------|-----------|
| **Alert Rule** | Definicao da condicao de alerta (query + threshold + evaluation) |
| **Contact Point** | Destino da notificacao (Slack, Email, PagerDuty, Webhook) |
| **Notification Policy** | Regras de routing (qual alerta vai para qual contact point) |
| **Silence** | Supressao temporaria de alertas |
| **Mute Timing** | Horarios em que alertas nao devem notificar |
| **Alert Group** | Agrupamento de alertas por labels |

### Criando Alert Rules

**Via UI:**
\`\`\`
Alerting > Alert rules > New alert rule

1. Rule name: HighCPUUsage
2. Rule type: Grafana managed
3. Query:
   - Data source: Prometheus
   - PromQL: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100
4. Expression:
   - Reduce: Last value
   - Threshold: IS ABOVE 80
5. Evaluation:
   - Folder: Infrastructure
   - Group: node-alerts
   - Evaluate every: 1m
   - For: 5m (pending duration)
6. Labels:
   - severity: warning
   - team: infra
7. Annotations:
   - summary: CPU alta no node {{ $labels.instance }}
   - description: CPU em {{ $value }}%
\`\`\`

**Via Provisioning (YAML):**
\`\`\`yaml
# /etc/grafana/provisioning/alerting/rules.yaml
apiVersion: 1
groups:
  - orgId: 1
    name: infrastructure
    folder: Infrastructure
    interval: 1m
    rules:
      - uid: high-cpu
        title: HighCPUUsage
        condition: C
        data:
          - refId: A
            relativeTimeRange:
              from: 600
              to: 0
            datasourceUid: prometheus
            model:
              expr: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100
              refId: A
          - refId: B
            relativeTimeRange:
              from: 0
              to: 0
            datasourceUid: __expr__
            model:
              type: reduce
              expression: A
              reducer: last
              refId: B
          - refId: C
            relativeTimeRange:
              from: 0
              to: 0
            datasourceUid: __expr__
            model:
              type: threshold
              expression: B
              conditions:
                - evaluator:
                    type: gt
                    params: [80]
              refId: C
        for: 5m
        labels:
          severity: warning
          team: infra
        annotations:
          summary: "CPU alta no node {{ $labels.instance }}"
\`\`\`

### Configurando Contact Points

**Slack:**
\`\`\`
Alerting > Contact points > New contact point

Name: slack-infra
Type: Slack
Webhook URL: https://hooks.slack.com/services/xxx/yyy/zzz
Channel: #alerts-infra
Title: {{ .CommonLabels.alertname }}
Text: |
  {{ range .Alerts }}
  *{{ .Labels.severity }}*: {{ .Annotations.summary }}
  {{ end }}
\`\`\`

**Email:**
\`\`\`
Name: email-oncall
Type: Email
Addresses: oncall@company.com
Subject: [{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}
\`\`\`

**Webhook (generico):**
\`\`\`
Name: webhook-custom
Type: Webhook
URL: https://api.internal/alerts
HTTP Method: POST
\`\`\`

**Via Provisioning:**
\`\`\`yaml
# /etc/grafana/provisioning/alerting/contactpoints.yaml
apiVersion: 1
contactPoints:
  - orgId: 1
    name: slack-infra
    receivers:
      - uid: slack-1
        type: slack
        settings:
          url: https://hooks.slack.com/services/xxx/yyy/zzz
          recipient: "#alerts-infra"
          title: '{{ template "slack.default.title" . }}'
          text: '{{ template "slack.default.text" . }}'
\`\`\`

### Notification Policies (Routing)

Notification policies definem como alertas sao roteados para contact points:

\`\`\`
Alerting > Notification policies > Edit

Default policy:
  Contact point: slack-general
  Group by: [alertname, namespace]
  Group wait: 30s
  Group interval: 5m
  Repeat interval: 4h

Child policies:
  - Match: severity = critical
    Contact point: pagerduty-oncall
    Repeat interval: 1h

  - Match: severity = warning
    Contact point: slack-infra
    Repeat interval: 8h

  - Match: team = dev
    Contact point: slack-dev
\`\`\`

**Via Provisioning:**
\`\`\`yaml
# /etc/grafana/provisioning/alerting/policies.yaml
apiVersion: 1
policies:
  - orgId: 1
    receiver: slack-general
    group_by: ['alertname', 'namespace']
    group_wait: 30s
    group_interval: 5m
    repeat_interval: 4h
    routes:
      - receiver: pagerduty-oncall
        matchers:
          - severity = critical
        repeat_interval: 1h
      - receiver: slack-infra
        matchers:
          - severity = warning
        repeat_interval: 8h
\`\`\`

### Silences e Mute Timings

**Silences (temporarios):**
\`\`\`
Alerting > Silences > New silence

Duration: 2h
Matchers:
  - alertname = HighCPUUsage
  - instance = node-1:9100
Comment: "Manutencao planejada no node-1"
\`\`\`

**Mute Timings (recorrentes):**
\`\`\`yaml
# Nao notificar fora do horario comercial
apiVersion: 1
muteTimes:
  - orgId: 1
    name: outside-business-hours
    time_intervals:
      - weekdays: ['saturday', 'sunday']
      - times:
          - start_time: '18:00'
            end_time: '09:00'
\`\`\`

### Alert Rule Multi-dimensional

O Grafana suporta alertas que avaliam multiplas series simultaneamente:

\`\`\`
Query A: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

Reduce B: Last (input: A)
  -> Gera um valor por instance

Threshold C: IS ABOVE 80 (input: B)
  -> Avalia cada instance separadamente
  -> node-1: 85% -> FIRING
  -> node-2: 45% -> OK
  -> node-3: 92% -> FIRING
\`\`\`

Isso gera alertas individuais por serie, cada um com suas proprias labels.

### Templates de Notificacao

\`\`\`go
{{ define "custom.title" }}
[{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}
{{ end }}

{{ define "custom.text" }}
{{ range .Alerts }}
*Severity:* {{ .Labels.severity }}
*Instance:* {{ .Labels.instance }}
*Summary:* {{ .Annotations.summary }}
*Value:* {{ .Values.B }}
---
{{ end }}
{{ end }}
\`\`\`

## Erros Comuns

1. **Nao configurar "for" (pending period)**: Sem pending period, alertas flappam com picos momentaneos.
2. **Contact point sem testar**: Configurar Slack/Email sem enviar teste resulta em falha silenciosa quando o alerta dispara.
3. **Routing muito simples**: Enviar todos os alertas para o mesmo canal causa alert fatigue. Diferencie por severidade/time.
4. **Silences sem expiracao**: Esquecer de definir duracao em silences pode causar alertas suprimidos indefinidamente.
5. **Nao usar provisioning**: Configurar alertas apenas via UI torna impossivel versionar e replicar entre ambientes.
6. **Labels inconsistentes**: Usar labels diferentes entre alertas do Grafana e do Prometheus dificulta o routing unificado.

## Killer.sh Style Challenge

**Cenario:** Configure alerting completo no Grafana para um cluster Kubernetes.

**Tarefas:**
1. Crie um alert rule para CPU > 80% por mais de 5 minutos
2. Configure contact points para Slack (warning) e PagerDuty (critical)
3. Defina notification policies com routing por severidade
4. Crie um silence para uma manutencao de 2 horas em um node especifico

**Dicas:**
- Use o evaluation group "infrastructure" para agrupar alert rules
- Configure pending period de pelo menos 5 minutos para evitar flapping
- Teste contact points antes de confiar neles
`,
  quiz: [
    {
      question: 'Qual a principal vantagem do Grafana Alerting sobre o Prometheus Alertmanager?',
      options: [
        'E mais rapido',
        'Suporta multiplas fontes de dados (Prometheus, Loki, etc.) e configuracao via interface grafica',
        'Tem mais integracao com Kubernetes',
        'Nao precisa de Prometheus'
      ],
      correct: 1,
      explanation: 'O Grafana Alerting suporta queries de multiplas fontes de dados (nao apenas Prometheus) e oferece configuracao via UI grafica, facilitando a criacao e gerenciamento de alertas sem editar arquivos YAML diretamente.',
      reference: 'Conceito relacionado: prom-alerting — compare Grafana Alerting com Prometheus Alertmanager para escolher o melhor para seu cenario.'
    },
    {
      question: 'O que e um Contact Point no Grafana Alerting?',
      options: [
        'O endpoint do Prometheus',
        'O destino de notificacao (Slack, Email, PagerDuty, Webhook) para onde alertas sao enviados',
        'O dashboard que mostra os alertas',
        'A metrica monitorada'
      ],
      correct: 1,
      explanation: 'Contact Point e a configuracao do destino das notificacoes de alerta. Define como e para onde as notificacoes sao enviadas (Slack, Email, PagerDuty, Webhook, Teams, etc.). Cada contact point pode ter multiplos receivers.',
      reference: 'Conceito relacionado: prom-alerting — Contact Points no Grafana sao analogos a Receivers no Alertmanager.'
    },
    {
      question: 'Qual a diferenca entre Silence e Mute Timing no Grafana?',
      options: [
        'Sao a mesma coisa',
        'Silence e temporario (ex: 2h para manutencao), Mute Timing e recorrente (ex: fora do horario comercial)',
        'Silence e para alertas criticos, Mute Timing e para warnings',
        'Silence suprime notificacoes, Mute Timing desativa alertas'
      ],
      correct: 1,
      explanation: 'Silence e uma supressao temporaria com duracao definida (ex: 2h durante manutencao). Mute Timing e uma regra recorrente que define horarios em que notificacoes nao devem ser enviadas (ex: finais de semana, fora do expediente). Ambos suprimem notificacoes, nao desativam alertas.',
      reference: 'Conceito relacionado: prom-alerting — Silences no Grafana funcionam de forma similar ao Alertmanager.'
    },
    {
      question: 'Como funciona a avaliacao multi-dimensional de alertas no Grafana?',
      options: [
        'Avalia todas as series como uma unica metrica',
        'A query retorna multiplas series, Reduce gera um valor por serie, e Threshold avalia cada uma separadamente',
        'Cria um alerta separado para cada dashboard',
        'So funciona com metricas de um unico node'
      ],
      correct: 1,
      explanation: 'O Grafana avalia cada serie temporal separadamente: a query retorna N series (ex: uma por node), Reduce extrai o ultimo valor de cada, e Threshold avalia se cada uma excede o limite. Isso gera alertas individuais por serie, cada um com suas labels.',
      reference: 'Conceito relacionado: promql-basics — agregacoes by() controlam quantas series sao retornadas.'
    },
    {
      question: 'O que e Notification Policy no Grafana Alerting?',
      options: [
        'A politica de privacidade do Grafana',
        'Regras que definem como alertas sao roteados para Contact Points, incluindo grouping e repeat interval',
        'A configuracao de email do servidor',
        'As permissoes de quem pode criar alertas'
      ],
      correct: 1,
      explanation: 'Notification Policies definem o routing: qual alerta vai para qual contact point, como agrupar alertas (group_by), quanto tempo esperar antes de enviar (group_wait), e quando repetir (repeat_interval). Funcionam de forma hierarquica com default + child policies.',
      reference: 'Conceito relacionado: prom-alerting — Notification Policies sao analogas a route tree do Alertmanager.'
    },
    {
      question: 'Qual a melhor pratica para configurar o pending period ("for") em alert rules do Grafana?',
      options: [
        'Sempre usar 0 para alertas imediatos',
        'Pelo menos 2-5 minutos para critical e 5-15 minutos para warning, evitando flapping',
        'Sempre usar 1 hora para evitar falsos positivos',
        'Nao usar pending period'
      ],
      correct: 1,
      explanation: 'O pending period define quanto tempo a condicao deve ser verdadeira antes do alerta disparar. Sem ele (ou com valor muito curto), picos momentaneos causam flapping. Valores recomendados: 2-5m para critical (acao urgente mas sem ruido), 5-15m para warning.',
      reference: 'Conceito relacionado: prom-alerting — o conceito de "for" e identico no Prometheus e no Grafana.'
    },
    {
      question: 'Por que e recomendado usar provisioning YAML para alertas do Grafana?',
      options: [
        'Porque a UI do Grafana nao funciona para alertas',
        'Para versionar alertas no Git, replicar entre ambientes e fazer review via pull requests',
        'Porque YAML e mais rapido que a UI',
        'Porque o Grafana so suporta alertas via YAML'
      ],
      correct: 1,
      explanation: 'Provisioning YAML permite armazenar configuracoes de alertas no Git (versionamento), replicar entre ambientes (dev/staging/prod), fazer review via PRs, e reverter mudancas. Alertas configurados apenas via UI podem ser perdidos ou impossíveis de replicar.',
      reference: 'Conceito relacionado: grafana-dashboards — Dashboard as Code segue o mesmo principio de provisioning.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os componentes principais do Grafana Alerting?',
      back: '1. **Alert Rule** — condicao de alerta (query + threshold + evaluation)\n2. **Contact Point** — destino da notificacao (Slack, Email, PagerDuty)\n3. **Notification Policy** — routing (qual alerta -> qual contact point)\n4. **Silence** — supressao temporaria de alertas\n5. **Mute Timing** — horarios recorrentes sem notificacao\n6. **Alert Group** — agrupamento por labels'
    },
    {
      front: 'Grafana Alerting vs Prometheus Alertmanager — quando usar cada um?',
      back: '**Grafana Alerting:**\n- Quando o Grafana e o hub central de observabilidade\n- Para alertas multi-datasource (Prometheus + Loki + etc.)\n- Quando a equipe prefere configuracao via UI\n- Para times menores sem expertise em YAML\n\n**Prometheus Alertmanager:**\n- Ambientes puramente Prometheus\n- Quando GitOps e essencial (YAML nativo)\n- Quando ja existe infraestrutura de Alertmanager\n- Para alta escala (Alertmanager HA com clustering)\n\nNota: ambos podem coexistir no mesmo ambiente.'
    },
    {
      front: 'Como funciona o fluxo de avaliacao de um Alert Rule no Grafana?',
      back: '1. **Query (A)**: executa PromQL e retorna series temporais\n2. **Reduce (B)**: extrai um valor de cada serie (last, mean, max, etc.)\n3. **Threshold (C)**: avalia se cada valor excede o limite\n4. **Pending (for)**: espera X minutos com condicao verdadeira\n5. **Firing**: alerta e enviado ao Alertmanager interno\n6. **Routing**: notification policy direciona ao contact point\n7. **Notificacao**: mensagem enviada (Slack, Email, etc.)\n\nCada serie gera um alerta individual com suas labels.'
    },
    {
      front: 'O que e Mute Timing e como configurar?',
      back: 'Mute Timing define horarios recorrentes em que notificacoes NAO sao enviadas (alertas continuam avaliando mas nao notificam).\n\nExemplo — fora do expediente:\n```yaml\nmuteTimes:\n  - name: outside-business-hours\n    time_intervals:\n      - weekdays: [saturday, sunday]\n      - times:\n          - start_time: "18:00"\n            end_time: "09:00"\n```\n\nDiferente de Silence:\n- Silence: temporario (ex: 2h)\n- Mute Timing: recorrente (ex: todo fim de semana)'
    },
    {
      front: 'Como provisionar alertas do Grafana via YAML?',
      back: 'Arquivos em /etc/grafana/provisioning/alerting/:\n\n**rules.yaml** — Alert Rules\n```yaml\napiVersion: 1\ngroups:\n  - orgId: 1\n    name: infrastructure\n    rules: [...]\n```\n\n**contactpoints.yaml** — Contact Points\n```yaml\napiVersion: 1\ncontactPoints:\n  - name: slack-infra\n    receivers: [...]\n```\n\n**policies.yaml** — Notification Policies\n```yaml\napiVersion: 1\npolicies:\n  - receiver: default\n    routes: [...]\n```\n\nBeneficios: versionamento Git, replicacao entre ambientes, review via PR.'
    },
    {
      front: 'Quais sao as melhores praticas para evitar alert fatigue no Grafana?',
      back: '1. **Pending period adequado**: 2-5m critical, 5-15m warning\n2. **Routing por severidade**: critical -> pager, warning -> Slack\n3. **Grouping**: group_by [alertname, namespace] para consolidar\n4. **Mute Timings**: nao notificar fora do expediente para warnings\n5. **Labels consistentes**: severity, team, service em todos os alertas\n6. **Testar contact points**: verificar antes de confiar\n7. **Regra de ouro**: se nao requer acao, nao e um alerta — e um log ou dashboard'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar um sistema de alerting completo no Grafana para um cluster Kubernetes. O Grafana esta conectado ao Prometheus e voce precisa criar alert rules, contact points e notification policies.',
    objective: 'Configurar Grafana Alerting end-to-end: criar alert rules, configurar contact points, definir notification policies com routing por severidade, e criar silences para manutencao.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Criar Contact Points',
        instruction: `Configure os destinos de notificacao antes de criar alert rules.

1. Acesse Alerting > Contact points > New contact point
2. Crie os seguintes contact points:

**Contact Point 1: Webhook de Teste**
- Name: webhook-test
- Type: Webhook
- URL: https://webhook.site/unique-url (use webhook.site para testar)
- HTTP Method: POST

**Contact Point 2: Slack (se disponivel)**
- Name: slack-alerts
- Type: Slack
- Webhook URL: (seu webhook URL)
- Channel: #alerts

3. Teste cada contact point clicando em "Test"

\`\`\`bash
# Verificar contact points via API
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/contact-points | jq '.[].name'
\`\`\``,
        hints: [
          'Use webhook.site para criar um endpoint de teste gratuito',
          'Sempre teste contact points antes de confiar neles',
          'Contact points podem ter multiplos receivers (ex: Slack + Email)'
        ],
        solution: `\`\`\`bash
# Criar contact point via API
curl -X POST http://admin:admin@localhost:3000/api/v1/provisioning/contact-points \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "webhook-test",
    "type": "webhook",
    "settings": {
      "url": "https://webhook.site/test",
      "httpMethod": "POST"
    }
  }'

# Listar contact points
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/contact-points | jq '.[].name'
\`\`\``,
        verify: `\`\`\`bash
# Verificar contact points criados
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/contact-points | jq '. | length'
# Saida esperada: numero > 0

# Verificar contact point especifico
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/contact-points | jq '.[].name'
# Saida esperada: lista contendo "webhook-test"
\`\`\``
      },
      {
        title: 'Criar Alert Rules',
        instruction: `Crie alert rules para monitorar a infraestrutura do cluster.

1. Acesse Alerting > Alert rules > New alert rule
2. Crie as seguintes regras:

**Rule 1: High CPU Usage**
- Name: HighCPUUsage
- Query A (Prometheus): (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100
- Expression B (Reduce): Last value of A
- Expression C (Threshold): B IS ABOVE 80
- Folder: Infrastructure
- Evaluation group: node-alerts
- Evaluate every: 1m
- For: 5m
- Labels: severity=warning, team=infra

**Rule 2: Node Down**
- Name: NodeDown
- Query A: up{job="node-exporter"} == 0
- Expression B (Reduce): Last value of A
- Expression C (Threshold): B IS ABOVE 0
- For: 3m
- Labels: severity=critical, team=infra`,
        hints: [
          'A cadeia query -> reduce -> threshold e obrigatoria no Grafana Alerting',
          'Use "for" de pelo menos 2 minutos para evitar flapping',
          'Labels adicionadas na rule sao usadas pelo routing das notification policies'
        ],
        solution: `\`\`\`bash
# Criar alert rule via API (exemplo simplificado)
curl -X POST http://admin:admin@localhost:3000/api/v1/provisioning/alert-rules \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "HighCPUUsage",
    "ruleGroup": "node-alerts",
    "folderUID": "infrastructure",
    "for": "5m",
    "labels": {"severity": "warning", "team": "infra"},
    "annotations": {"summary": "High CPU on {{ $labels.instance }}"},
    "condition": "C",
    "data": [
      {
        "refId": "A",
        "datasourceUid": "prometheus",
        "model": {"expr": "(1 - avg by(instance) (rate(node_cpu_seconds_total{mode=\\"idle\\"}[5m]))) * 100"}
      }
    ]
  }'
\`\`\``,
        verify: `\`\`\`bash
# Verificar alert rules criadas
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/alert-rules | jq '.[].title'
# Saida esperada: lista contendo "HighCPUUsage"

# Verificar estado dos alertas
curl -s http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/alerts | jq '. | length'
# Saida esperada: numero >= 0
\`\`\``
      },
      {
        title: 'Configurar Notification Policies',
        instruction: `Defina como os alertas sao roteados para os contact points.

1. Acesse Alerting > Notification policies
2. Configure a policy padrao:

**Default Policy:**
- Contact point: webhook-test
- Group by: alertname, namespace
- Group wait: 30s
- Group interval: 5m
- Repeat interval: 4h

3. Adicione child policies:

**Child Policy 1 (Critical):**
- Matcher: severity = critical
- Contact point: (pagerduty ou webhook-test)
- Repeat interval: 1h

**Child Policy 2 (Warning):**
- Matcher: severity = warning
- Contact point: slack-alerts (ou webhook-test)
- Repeat interval: 8h`,
        hints: [
          'A default policy captura todos os alertas que nao correspondem a nenhuma child policy',
          'Child policies sao avaliadas em ordem — a primeira que corresponde e usada',
          'Group by [alertname] agrupa alertas do mesmo tipo em uma notificacao'
        ],
        solution: `\`\`\`bash
# Configurar notification policy via API
curl -X PUT http://admin:admin@localhost:3000/api/v1/provisioning/policies \\
  -H "Content-Type: application/json" \\
  -d '{
    "receiver": "webhook-test",
    "group_by": ["alertname", "namespace"],
    "group_wait": "30s",
    "group_interval": "5m",
    "repeat_interval": "4h",
    "routes": [
      {
        "receiver": "webhook-test",
        "matchers": ["severity=critical"],
        "repeat_interval": "1h"
      },
      {
        "receiver": "webhook-test",
        "matchers": ["severity=warning"],
        "repeat_interval": "8h"
      }
    ]
  }'
\`\`\``,
        verify: `\`\`\`bash
# Verificar notification policies
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/policies | jq '.receiver'
# Saida esperada: nome do contact point padrao

# Verificar rotas
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/policies | jq '.routes | length'
# Saida esperada: numero > 0
\`\`\``
      },
      {
        title: 'Criar Silence e Testar Pipeline',
        instruction: `Crie um silence para simular uma manutencao e teste o pipeline completo de alerting.

**Criar Silence:**
1. Acesse Alerting > Silences > New silence
2. Configure:
   - Duration: 2h
   - Matchers: alertname = HighCPUUsage, instance = node-1:9100
   - Comment: "Manutencao planejada no node-1"
3. Salve o silence

**Testar Pipeline:**
1. Verifique os alertas ativos em Alerting > Alert rules
2. Verifique notificacoes no contact point (webhook.site)
3. Verifique que alertas silenciados nao geraram notificacao

\`\`\`bash
# Criar silence via API
curl -X POST http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/silences \\
  -H "Content-Type: application/json" \\
  -d '{
    "matchers": [
      {"name": "alertname", "value": "HighCPUUsage", "isRegex": false},
      {"name": "instance", "value": "node-1:9100", "isRegex": false}
    ],
    "startsAt": "2024-01-01T00:00:00Z",
    "endsAt": "2024-01-01T02:00:00Z",
    "comment": "Manutencao planejada",
    "createdBy": "admin"
  }'
\`\`\``,
        hints: [
          'Silences tem duracao definida e expiram automaticamente',
          'Use matchers especificos para nao silenciar alertas demais',
          'Verifique os alertas em Alerting > Alert rules para ver o estado (Normal, Pending, Firing)'
        ],
        solution: `\`\`\`bash
# Listar silences ativos
curl -s http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/silences | jq '.[] | select(.status.state=="active") | {id: .id, comment: .comment}'

# Verificar alertas ativos
curl -s http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/alerts | jq '.[] | {alertname: .labels.alertname, status: .status.state}'

# Remover silence
curl -X DELETE http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/silence/<silence-id>
\`\`\``,
        verify: `\`\`\`bash
# Verificar que silences existem
curl -s http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/silences | jq '. | length'
# Saida esperada: numero > 0

# Verificar estado geral do alerting
curl -s http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/status | jq '.cluster.status'
# Saida esperada: "ready" ou similar
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Alert rule fica sempre em "Normal" mesmo com condicao violada',
      difficulty: 'easy',
      symptom: 'Voce criou uma alert rule mas ela permanece em estado "Normal" mesmo quando a query retorna valores acima do threshold.',
      diagnosis: `\`\`\`bash
# Testar a query diretamente no Prometheus
curl -s 'http://localhost:9090/api/v1/query?query=(1-avg%20by(instance)(rate(node_cpu_seconds_total{mode=%22idle%22}[5m])))*100' | jq '.data.result'

# Verificar a avaliacao no Grafana
# Alerting > Alert rules > sua rule > ver "State history"

# Verificar se o evaluation interval esta funcionando
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/alert-rules | jq '.[0].execErrState'
\`\`\``,
      solution: `**Causas comuns:**

1. **Chain Reduce+Threshold incorreta:** O Grafana exige a cadeia Query -> Reduce -> Threshold. Se faltar o Reduce, o Threshold nao avalia corretamente.

2. **Reducer errado:** Se usar "Mean" em vez de "Last", o valor medio pode estar abaixo do threshold mesmo com picos.

3. **Data source errado:** Verificar que a alert rule usa o data source Prometheus correto.

4. **Expressao mal configurada:** O "condition" deve apontar para o refId do Threshold (geralmente "C").

5. **Sem dados:** Se a query nao retorna dados, o estado padrao e "Normal" (ou "NoData" dependendo da config). Verifique o "No data state" nas configuracoes da rule.`
    },
    {
      title: 'Notificacoes nao sao enviadas mesmo com alertas firing',
      difficulty: 'medium',
      symptom: 'Alert rules estao em estado "Firing" no Grafana, mas nenhuma notificacao e recebida no Slack/Email/Webhook.',
      diagnosis: `\`\`\`bash
# Verificar alertas firing
curl -s http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/alerts | jq '.[] | select(.status.state=="active")'

# Verificar silences ativos
curl -s http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/silences | jq '.[] | select(.status.state=="active")'

# Verificar logs do Grafana
kubectl logs -l app.kubernetes.io/name=grafana -n monitoring --tail=30 | grep -i "alert\\|notif\\|error"
\`\`\``,
      solution: `**Causas comuns:**

1. **Silence ativo:** Um silence pode estar suprimindo as notificacoes. Verifique em Alerting > Silences.

2. **Notification policy nao corresponde:** A default policy pode estar apontando para um contact point que nao funciona. Verifique o routing.

3. **Contact point mal configurado:** Webhook URL invalido, token Slack expirado, email sem SMTP configurado.
\`\`\`bash
# Testar contact point
curl -X POST http://admin:admin@localhost:3000/api/alertmanager/grafana/config/api/v1/receivers/test \\
  -H "Content-Type: application/json" \\
  -d '{"receivers": [{"name": "webhook-test"}]}'
\`\`\`

4. **repeat_interval nao expirou:** Se o alerta ja foi notificado, precisa esperar o repeat_interval (ex: 4h) para reenviar.

5. **Mute timing ativo:** Verificar se ha mute timings configurados que suprimem notificacoes no horario atual.`
    },
    {
      title: 'Alertas duplicados entre Grafana e Prometheus Alertmanager',
      difficulty: 'hard',
      symptom: 'A equipe recebe notificacoes duplicadas: o mesmo alerta e enviado tanto pelo Grafana Alerting quanto pelo Prometheus Alertmanager.',
      diagnosis: `\`\`\`bash
# Verificar se ha alert rules duplicadas
# No Grafana
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/alert-rules | jq '.[].title'

# No Prometheus
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.type=="alerting") | .name'

# Verificar se Grafana esta usando Alertmanager externo
curl -s http://admin:admin@localhost:3000/api/v1/ngalert | jq '.'
\`\`\``,
      solution: `**Estrategias para resolver:**

1. **Escolher uma unica fonte:** Decida se alertas serao gerenciados pelo Grafana OU pelo Prometheus. Evite duplicar.

2. **Se usar Prometheus Alertmanager:**
   - Desative Grafana Alerting interno
   - Configure Grafana para apenas visualizar alertas do Alertmanager
   - Grafana > Configuration > Alertmanager > selecione o Alertmanager externo

3. **Se usar Grafana Alerting:**
   - Remova alerting rules duplicadas do Prometheus
   - Mantenha apenas recording rules no Prometheus
   - Use Grafana como unica fonte de alert rules

4. **Se precisar de ambos:**
   - Diferencie por escopo: Prometheus para alertas de infraestrutura core, Grafana para alertas de aplicacao
   - Use labels distintas para evitar routing duplicado
   - Configure contact points diferentes para cada fonte`
    }
  ]
};
