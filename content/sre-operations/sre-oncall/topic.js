window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['sre-operations/sre-oncall'] = {
  theory: `
# On-Call & Runbooks — Praticas de Plantao SRE

## Relevancia
On-call e a linha de frente da confiabilidade. Um processo de on-call bem estruturado garante que incidentes sejam respondidos rapidamente sem queimar o time. Runbooks transformam conhecimento tribal em procedimentos reproduziveis, reduzindo MTTI e permitindo que qualquer pessoa do time responda efetivamente.

## Conceitos Fundamentais

### Estrutura de On-Call

\`\`\`
Rotacao tipica:
  Primary On-Call  → responde primeiro
  Secondary On-Call → backup se primary nao responder em 5min
  Escalation       → manager/lead se ambos falharem

Ciclos comuns:
  Semanal: 7 dias consecutivos (mais comum)
  Bi-semanal: 14 dias
  Follow-the-sun: rotacao por timezone (24h coverage)
\`\`\`

**Regras saudaveis de on-call:**
1. Minimo 2 pessoas no time para rotacao
2. Maximo 25% do tempo em on-call (1 semana a cada 4)
3. Compensacao por on-call (folga, pagamento extra)
4. On-call nao deve ser interrompido por trabalho de projeto
5. Se on-call e muito ativo, o servico precisa de melhorias
6. Toda page deve ter um runbook associado

### Runbooks

Runbooks sao documentos operacionais com procedimentos passo-a-passo para responder a alertas e incidentes.

**Estrutura de um runbook:**
\`\`\`markdown
# Runbook: [Nome do Alerta]

## Visao Geral
O que este alerta significa e qual o impacto potencial.

## Severidade
SEV2 — funcionalidade principal degradada

## Passos de Diagnostico
1. Verificar X
2. Verificar Y
3. Verificar Z

## Mitigacao
### Opcao A: [acao rapida]
Comandos e procedimentos

### Opcao B: [se A nao resolver]
Procedimentos alternativos

## Escalacao
Quando escalar e para quem.

## Historico
Links para incidentes anteriores relacionados.
\`\`\`

**Exemplo de runbook para Kubernetes:**
\`\`\`markdown
# Runbook: HighPodRestartRate

## Visao Geral
Pods do servico estao reiniciando frequentemente,
indicando crash loops ou falhas de health check.

## Severidade
SEV2 se servico critico, SEV3 se servico secundario.

## Diagnostico
1. Identificar pods afetados:
   kubectl get pods -n <ns> --sort-by='.status.containerStatuses[0].restartCount'

2. Verificar logs do ultimo crash:
   kubectl logs <pod> -n <ns> --previous

3. Verificar eventos:
   kubectl describe pod <pod> -n <ns> | grep -A10 Events

4. Verificar recursos:
   kubectl top pod <pod> -n <ns>

## Mitigacao
### Opcao A: OOMKilled — aumentar limites
kubectl patch deployment <name> -n <ns> --type=json \\
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/resources/limits/memory","value":"512Mi"}]'

### Opcao B: CrashLoopBackOff — rollback
kubectl rollout undo deployment/<name> -n <ns>

### Opcao C: Liveness probe falhando
Verificar endpoint de health e ajustar timeouts:
kubectl edit deployment <name> -n <ns>
# Aumentar initialDelaySeconds e timeoutSeconds

## Escalacao
Se nao resolver em 30 minutos, escalar para @sre-lead.
\`\`\`

### Alerting Best Practices para On-Call

\`\`\`
Categorias de alerta:

Pageable (acorda pessoa):
  - SLO burn rate > 14.4x
  - Servico completamente down
  - Perda de dados
  → Requer acao IMEDIATA

Non-pageable (ticket/Slack):
  - Disco > 85%
  - Certificado expirando < 7 dias
  - Pod restart rate alto
  → Requer acao no PROXIMO DIA UTIL

Informacional (dashboard):
  - Metricas fora do baseline
  - Versao antiga detectada
  → Nao requer acao imediata
\`\`\`

**Anti-patterns de alertas:**
\`\`\`
Ruim:  Alertar em CPU > 80% (pode ser normal sob carga)
Bom:   Alertar em SLO burn rate alto

Ruim:  Alertar em cada pod restart
Bom:   Alertar quando restart rate > threshold

Ruim:  Alertar sem runbook
Bom:   Todo alerta tem runbook linkado

Ruim:  50+ alertas por dia
Bom:   < 5 pages por turno de on-call
\`\`\`

### Handoff de On-Call

\`\`\`
Checklist de handoff (transicao entre on-calls):

1. Incidentes ativos e status atual
2. Alertas que dispararam na ultima semana
3. Mudancas recentes (deploys, config changes)
4. Action items pendentes de postmortems
5. Problemas conhecidos (known issues)
6. Contatos de escalacao atualizados
7. Ferramentas e acesso verificados
\`\`\`

### Metricas de Saude do On-Call

\`\`\`
Pages por turno:
  Saudavel: 0-2 pages
  Aceitavel: 3-5 pages
  Problematico: 5+ pages → servico precisa de investimento

Interrupcoes fora do horario:
  Ideal: 0 (alertas so durante horario comercial)
  Aceitavel: 1-2 por semana
  Problematico: diariamente

Tempo para acknowledge:
  Target: < 5 minutos
  Se consistentemente > 15 min, revisar processo

Falsos positivos:
  Target: < 10% das pages
  Se > 30%, revisar alertas urgentemente
\`\`\`

## Implementacao em Kubernetes

### PagerDuty Integration com AlertManager

\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-main
  namespace: monitoring
stringData:
  alertmanager.yaml: |
    global:
      resolve_timeout: 5m

    route:
      receiver: default
      group_by: [alertname, namespace, service]
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
      routes:
        # SEV1/Critical → PagerDuty (acorda)
        - match:
            severity: critical
          receiver: pagerduty-critical
          repeat_interval: 1h
          continue: false

        # SEV2/Warning → Slack channel
        - match:
            severity: warning
          receiver: slack-warning
          repeat_interval: 4h

    receivers:
      - name: default
        slack_configs:
          - channel: '#alerts-info'
            send_resolved: true

      - name: pagerduty-critical
        pagerduty_configs:
          - routing_key: '<pagerduty-integration-key>'
            severity: critical
            description: '{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}'
            details:
              namespace: '{{ (index .Alerts 0).Labels.namespace }}'
              runbook: '{{ (index .Alerts 0).Annotations.runbook_url }}'

      - name: slack-warning
        slack_configs:
          - channel: '#alerts-warning'
            send_resolved: true
            title: '{{ .GroupLabels.alertname }}'
            text: '{{ .CommonAnnotations.summary }}'
\`\`\`

### Runbook linkado ao alerta

\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: oncall-alerts
  namespace: monitoring
spec:
  groups:
    - name: oncall.rules
      rules:
        - alert: HighPodRestartRate
          expr: |
            increase(kube_pod_container_status_restarts_total[1h]) > 5
          for: 10m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: "Pod {{ \$labels.pod }} in {{ \$labels.namespace }} restarted {{ \$value }} times in 1h"
            runbook_url: "https://wiki.internal/runbooks/high-pod-restart-rate"

        - alert: PVCNearlyFull
          expr: |
            kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes > 0.85
          for: 15m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: "PVC {{ \$labels.persistentvolumeclaim }} in {{ \$labels.namespace }} is {{ \$value | humanizePercentage }} full"
            runbook_url: "https://wiki.internal/runbooks/pvc-nearly-full"
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Triage rapido para on-call
kubectl get nodes -o wide
kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded | head -20
kubectl top nodes --sort-by=cpu
kubectl top pods -A --sort-by=memory | head -10
kubectl get events -A --sort-by='.lastTimestamp' --field-selector type=Warning | tail -15

# Investigar pod com problemas
kubectl describe pod <pod> -n <ns>
kubectl logs <pod> -n <ns> --previous --tail=50
kubectl get events -n <ns> --field-selector involvedObject.name=<pod>

# Acoes de mitigacao rapida
kubectl rollout undo deployment/<name> -n <ns>
kubectl scale deployment/<name> -n <ns> --replicas=<N>
kubectl delete pod <pod> -n <ns>  # force restart
kubectl cordon <node>              # prevent scheduling
\`\`\`

## Erros Comuns

1. **On-call sem rotacao**: Uma pessoa fazendo on-call permanentemente leva a burnout. Minimo 2 pessoas em rotacao.
2. **Alertas sem runbook**: Quem recebe uma page as 3h da manha precisa saber exatamente o que fazer.
3. **Sem handoff formal**: Sem transicao estruturada, contexto e perdido entre turnos.
4. **On-call reativo apenas**: On-call deve incluir tempo para melhorar runbooks e reduzir toil, nao apenas apagar incendios.
5. **Sem metricas de on-call**: Se voce nao mede pages/turno e falsos positivos, nao sabe se o processo esta saudavel.
6. **Escalar tarde demais**: Se nao conseguir resolver em 30 min, escale. Orgulho nao e mitigacao.

## Killer.sh Style Challenge

**Cenario:** Configure um processo de on-call completo com alertas, runbooks e escalacao.

**Tarefas:**
1. Configure AlertManager com routing por severidade
2. Crie alertas com runbook_url linkado
3. Escreva um runbook para HighPodRestartRate
4. Configure escalacao automatica
5. Defina metricas de saude do on-call
`,
  quiz: [
    {
      question: 'Qual o maximo de tempo recomendado que uma pessoa deve estar em on-call?',
      options: [
        '50% do tempo (2 semanas a cada 4)',
        '100% — on-call permanente e aceitavel',
        '25% do tempo (1 semana a cada 4) — minimo 2 pessoas em rotacao',
        '10% do tempo (1 dia a cada 10)'
      ],
      correct: 2,
      explanation: 'A recomendacao do Google SRE e no maximo 25% do tempo em on-call (1 semana a cada 4, com minimo 2 pessoas). Mais que isso leva a burnout, reducao de qualidade e aumento de erros. Se o on-call e muito ativo (5+ pages por turno), o servico precisa de investimento em confiabilidade.',
      reference: 'Conceito relacionado: sre-toil-automation — reduzir toil diminui a carga do on-call.'
    },
    {
      question: 'O que todo alerta pageable deve ter associado?',
      options: [
        'Um dashboard no Grafana',
        'Um runbook com procedimentos de diagnostico e mitigacao',
        'Um ticket no Jira',
        'Um responsavel fixo'
      ],
      correct: 1,
      explanation: 'Todo alerta que acorda uma pessoa (page) deve ter um runbook linkado com: o que o alerta significa, passos de diagnostico, procedimentos de mitigacao, e quando escalar. Uma pessoa acordada as 3h da manha nao deveria ter que descobrir o que fazer — o runbook guia a resposta.',
      reference: 'Conceito relacionado: sre-incident-mgmt — runbooks reduzem o MTTI durante incidentes.'
    },
    {
      question: 'O que e um handoff de on-call e o que deve incluir?',
      options: [
        'Apenas passar o celular para a proxima pessoa',
        'Uma transicao estruturada que inclui incidentes ativos, alertas recentes, mudancas, action items pendentes e known issues',
        'Enviar um email com a escala de on-call',
        'Nada — a proxima pessoa acessa o dashboard e ve por conta propria'
      ],
      correct: 1,
      explanation: 'Handoff de on-call e uma transicao formal entre turnos que inclui: incidentes ativos e status, alertas da ultima semana, mudancas recentes (deploys, config changes), action items pendentes, known issues, e verificacao de ferramentas/acesso. Sem handoff, contexto critico e perdido.',
      reference: 'Conceito relacionado: sre-oncall — use um checklist padronizado para handoffs.'
    },
    {
      question: 'Quantas pages por turno de on-call e considerado saudavel?',
      options: [
        '10-20 — on-call ativo e normal',
        '0-2 pages por turno',
        'Nao importa a quantidade',
        '5-10 pages por turno'
      ],
      correct: 1,
      explanation: '0-2 pages por turno e saudavel, 3-5 e aceitavel, 5+ e problematico e indica que o servico precisa de investimento em confiabilidade. Se o on-call recebe muitas pages, o time gasta tempo apagando incendios em vez de melhorar o sistema — criando um ciclo vicioso.',
      reference: 'Conceito relacionado: sre-principles — error budget pode ser usado para justificar investimento em confiabilidade.'
    },
    {
      question: 'Qual e o anti-pattern mais critico em alertas de on-call?',
      options: [
        'Ter alertas demais (50+/dia) que causam alert fatigue e levam o time a ignorar alertas reais',
        'Ter poucos alertas',
        'Usar PagerDuty em vez de Slack',
        'Alertar apenas durante horario comercial'
      ],
      correct: 0,
      explanation: 'Alert fatigue e o anti-pattern mais perigoso: quando o time recebe muitos alertas (especialmente falsos positivos), comeca a ignora-los. Um alerta real passa despercebido e causa incidente maior. A solucao e: cada alerta deve ter runbook e requerer acao; se nao requer acao, nao e alerta.',
      reference: 'Conceito relacionado: sre-observability — migre para SLO-based alerting para reduzir volume de alertas.'
    },
    {
      question: 'Quando voce deve escalar durante um incidente se nao consegue resolver?',
      options: [
        'Depois de 2 horas tentando',
        'Nunca — sempre resolva sozinho',
        'Apos 30 minutos sem progresso, escale para o proximo nivel',
        'Apenas se o manager pedir'
      ],
      correct: 2,
      explanation: 'A regra geral e escalar apos 30 minutos sem progresso significativo. Escalar nao e fraqueza — e responsabilidade. O objetivo e restaurar o servico o mais rapido possivel, e alguem com mais contexto ou expertise pode ajudar. Esperar demais para escalar prolonga o impacto ao usuario.',
      reference: 'Conceito relacionado: sre-incident-mgmt — IC deve decidir escalacao proativamente.'
    },
    {
      question: 'Como o annotation runbook_url ajuda no processo de on-call?',
      options: [
        'E apenas documentacao — nao tem uso pratico',
        'Permite que o alerta no PagerDuty/Slack inclua link direto para o runbook, dando ao on-call instrucoes imediatas de resposta',
        'Bloqueia o alerta ate o runbook ser lido',
        'Envia o runbook por email automaticamente'
      ],
      correct: 1,
      explanation: 'O annotation runbook_url no PrometheusRule e propagado pelo AlertManager ate o destino (PagerDuty, Slack). Quando o on-call recebe a page, ve o link direto para o runbook com instrucoes de diagnostico e mitigacao. Isso reduz drasticamente o MTTI — a pessoa nao precisa procurar documentacao.',
      reference: 'Conceito relacionado: sre-oncall — todo alerta pageable deve ter runbook_url.'
    }
  ],
  flashcards: [
    {
      front: 'Estrutura de rotacao de on-call?',
      back: '**Papeis:**\n- Primary: responde primeiro\n- Secondary: backup (5 min SLA)\n- Escalation: manager/lead\n\n**Ciclos:**\n- Semanal (mais comum)\n- Bi-semanal\n- Follow-the-sun (por timezone)\n\n**Regras saudaveis:**\n- Min 2 pessoas em rotacao\n- Max 25% do tempo em on-call\n- Compensacao (folga/pagamento)\n- On-call != trabalho de projeto\n- Todo page tem runbook\n\n**Metricas:**\n- 0-2 pages/turno = saudavel\n- 5+ pages/turno = problematico\n- < 10% falsos positivos\n- MTTA < 5 minutos'
    },
    {
      front: 'Estrutura de um runbook?',
      back: '**1. Visao Geral:**\nO que o alerta significa\n\n**2. Severidade:**\nSEV1-4 e impacto potencial\n\n**3. Diagnostico (passos):**\n```bash\nkubectl get pods -n <ns>\nkubectl logs <pod> --previous\nkubectl describe pod <pod>\nkubectl top pod <pod>\n```\n\n**4. Mitigacao:**\n- Opcao A: acao rapida\n- Opcao B: alternativa\n- Opcao C: workaround\n\n**5. Escalacao:**\nQuando e para quem escalar\n\n**6. Historico:**\nLinks para incidentes anteriores\n\n**Regra:** runbook desatualizado\ne pior que nenhum runbook'
    },
    {
      front: 'Categorias de alertas para on-call?',
      back: '**Pageable (acorda pessoa):**\n- SLO burn rate > 14.4x\n- Servico completamente down\n- Perda de dados iminente\n→ Acao IMEDIATA\n→ DEVE ter runbook\n\n**Non-pageable (ticket/Slack):**\n- Disco > 85%\n- Cert expirando < 7 dias\n- Pod restart rate alto\n→ Proximo DIA UTIL\n\n**Informacional (dashboard):**\n- Metricas fora do baseline\n- Versao antiga detectada\n→ Sem acao imediata\n\n**Anti-patterns:**\n- CPU > 80% como page ✗\n- Alerta sem runbook ✗\n- 50+ alertas/dia ✗'
    },
    {
      front: 'Handoff checklist de on-call?',
      back: '**Transicao entre turnos deve incluir:**\n\n1. **Incidentes ativos** e status atual\n\n2. **Alertas recentes** que dispararam\n   na ultima semana\n\n3. **Mudancas recentes** (deploys,\n   config changes, infra changes)\n\n4. **Action items pendentes** de\n   postmortems\n\n5. **Known issues** — problemas\n   conhecidos sem fix ainda\n\n6. **Contatos de escalacao**\n   atualizados\n\n7. **Ferramentas e acesso**\n   verificados (VPN, kubectl, etc.)\n\n**Formato:** reuniao de 15 min\nou documento compartilhado'
    },
    {
      front: 'AlertManager routing por severidade?',
      back: '**Config estruturada:**\n```yaml\nroute:\n  receiver: default\n  routes:\n    # Critical → PagerDuty\n    - match:\n        severity: critical\n      receiver: pagerduty\n      repeat_interval: 1h\n\n    # Warning → Slack\n    - match:\n        severity: warning\n      receiver: slack\n      repeat_interval: 4h\n```\n\n**Alerta com runbook:**\n```yaml\nannotations:\n  summary: "Pod restarting"\n  runbook_url: "https://wiki/runbook"\n```\n\n**Receivers:**\n- PagerDuty: pages criticas\n- Slack: warnings e info\n- Email: resumo diario'
    },
    {
      front: 'Anti-patterns de on-call?',
      back: '**1. On-call permanente:**\n- Uma pessoa sempre de plantao\n- Causa burnout\n→ Fix: min 2 pessoas, rotacao\n\n**2. Alertas sem runbook:**\n- Page as 3h sem instrucoes\n→ Fix: runbook obrigatorio\n\n**3. Sem handoff:**\n- Contexto perdido entre turnos\n→ Fix: checklist de transicao\n\n**4. Apenas reativo:**\n- So apaga incendio, nunca melhora\n→ Fix: 50% tempo em melhorias\n\n**5. Alert fatigue:**\n- 50+ alertas/dia = ignorados\n→ Fix: < 5 pages/turno\n\n**6. Escalar tarde:**\n- Orgulho > restaurar servico\n→ Fix: escalar apos 30 min'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar o processo de on-call para um time SRE: routing de alertas, runbooks e metricas de saude do plantao.',
    objective: 'Configurar AlertManager com routing por severidade, criar alertas com runbook linkado, e definir metricas de on-call.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Configurar AlertManager Routing',
        instruction: `Configure o AlertManager com routing separado por severidade.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-oncall-config
  namespace: monitoring
type: Opaque
stringData:
  alertmanager.yaml: |
    global:
      resolve_timeout: 5m
    route:
      receiver: default
      group_by: [alertname, namespace]
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
      routes:
        - match:
            severity: critical
          receiver: critical-alerts
          repeat_interval: 1h
        - match:
            severity: warning
          receiver: warning-alerts
          repeat_interval: 4h
    receivers:
      - name: default
        webhook_configs:
          - url: http://webhook-logger:8080/default
      - name: critical-alerts
        webhook_configs:
          - url: http://webhook-logger:8080/critical
      - name: warning-alerts
        webhook_configs:
          - url: http://webhook-logger:8080/warning
EOF
\`\`\``,
        hints: [
          'O routing separa alertas por severidade para diferentes canais',
          'Critical vai para PagerDuty (simulado com webhook), warning para Slack',
          'repeat_interval define quanto tempo esperar antes de re-alertar'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-oncall-config
  namespace: monitoring
stringData:
  alertmanager.yaml: |
    route:
      receiver: default
      routes:
        - match: {severity: critical}
          receiver: critical-alerts
    receivers:
      - name: default
        webhook_configs: [{url: "http://webhook:8080/default"}]
      - name: critical-alerts
        webhook_configs: [{url: "http://webhook:8080/critical"}]
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar Secret criado
kubectl get secret alertmanager-oncall-config -n monitoring
# Saida esperada: NAME                          TYPE     DATA   AGE
#                  alertmanager-oncall-config   Opaque   1      Xs

# Verificar conteudo (decodificado)
kubectl get secret alertmanager-oncall-config -n monitoring -o jsonpath='{.data.alertmanager\\.yaml}' | base64 -d | head -10
# Saida esperada: configuracao YAML do AlertManager
\`\`\``
      },
      {
        title: 'Criar Alertas com Runbook URL',
        instruction: `Crie alertas que incluem link para runbook.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: oncall-runbook-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: oncall.runbooks
      rules:
        - alert: HighPodRestartRate
          expr: |
            increase(kube_pod_container_status_restarts_total[1h]) > 5
          for: 10m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: "Pod {{ \$labels.pod }} restarted {{ \$value }} times in 1h"
            runbook_url: "https://wiki.internal/runbooks/high-pod-restart-rate"

        - alert: PVCAlmostFull
          expr: |
            kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes > 0.85
          for: 15m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: "PVC {{ \$labels.persistentvolumeclaim }} is {{ \$value | humanizePercentage }} full"
            runbook_url: "https://wiki.internal/runbooks/pvc-almost-full"

        - alert: NodeNotReady
          expr: |
            kube_node_status_condition{condition="Ready",status="true"} == 0
          for: 5m
          labels:
            severity: critical
            team: platform
          annotations:
            summary: "Node {{ \$labels.node }} is NotReady"
            runbook_url: "https://wiki.internal/runbooks/node-not-ready"
EOF
\`\`\``,
        hints: [
          'runbook_url e propagado pelo AlertManager para PagerDuty/Slack',
          'Use annotations para informacoes dinamicas (summary, description)',
          'Labels severity e team definem routing e ownership'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: oncall-runbook-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: oncall.runbooks
      rules:
        - alert: HighPodRestartRate
          expr: increase(kube_pod_container_status_restarts_total[1h]) > 5
          for: 10m
          labels:
            severity: warning
          annotations:
            runbook_url: "https://wiki.internal/runbooks/high-pod-restart-rate"
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar PrometheusRule criado
kubectl get prometheusrule oncall-runbook-alerts -n monitoring
# Saida esperada: NAME                      AGE
#                  oncall-runbook-alerts     Xs

# Verificar que todos os alertas tem runbook_url
kubectl get prometheusrule oncall-runbook-alerts -n monitoring -o yaml | grep -c runbook_url
# Saida esperada: 3 (um por alerta)
\`\`\``
      },
      {
        title: 'Criar Runbook como ConfigMap',
        instruction: `Armazene um runbook completo como ConfigMap no cluster.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: runbook-high-pod-restart
  namespace: monitoring
  labels:
    type: runbook
    alert: HighPodRestartRate
data:
  runbook.md: |
    # Runbook: HighPodRestartRate

    ## Overview
    Pods are restarting frequently, indicating crash loops
    or health check failures.

    ## Severity
    - Critical service: SEV2
    - Non-critical: SEV3

    ## Diagnosis
    1. Identify affected pods:
       kubectl get pods -n <ns> --sort-by='.status.containerStatuses[0].restartCount'

    2. Check last crash logs:
       kubectl logs <pod> --previous

    3. Check events:
       kubectl describe pod <pod> | grep -A10 Events

    4. Check resource usage:
       kubectl top pod <pod>

    ## Mitigation
    ### Option A: OOMKilled
    kubectl set resources deployment/<name> --limits=memory=512Mi

    ### Option B: CrashLoopBackOff
    kubectl rollout undo deployment/<name>

    ### Option C: Liveness probe failing
    Increase initialDelaySeconds and timeoutSeconds

    ## Escalation
    If not resolved in 30 min, escalate to @sre-lead
EOF
\`\`\``,
        hints: [
          'ConfigMaps com label type=runbook podem ser facilmente buscados',
          'O runbook deve ser claro e executavel por qualquer pessoa do time',
          'Inclua opcoes de mitigacao em ordem de probabilidade'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: runbook-high-pod-restart
  namespace: monitoring
  labels:
    type: runbook
data:
  runbook.md: |
    # Runbook: HighPodRestartRate
    ## Diagnosis: kubectl logs <pod> --previous
    ## Mitigation: rollback or increase resources
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar runbook criado
kubectl get cm runbook-high-pod-restart -n monitoring
# Saida esperada: NAME                        DATA   AGE
#                  runbook-high-pod-restart    1      Xs

# Listar todos os runbooks
kubectl get cm -n monitoring -l type=runbook
# Saida esperada: lista de runbooks

# Verificar conteudo
kubectl get cm runbook-high-pod-restart -n monitoring -o jsonpath='{.data.runbook\\.md}' | head -5
# Saida esperada: primeiras linhas do runbook
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'On-call recebendo muitas pages falsas (alert fatigue)',
      difficulty: 'medium',
      symptom: 'O on-call recebe 10+ pages por turno, a maioria falsos positivos. O time comecou a ignorar alertas e a resposta a incidentes reais esta lenta.',
      diagnosis: `\`\`\`bash
# Contar alertas por tipo
kubectl port-forward svc/alertmanager -n monitoring 9093:9093 &
curl -s http://localhost:9093/api/v2/alerts | jq '.[].labels.alertname' | sort | uniq -c | sort -rn | head -10

# Verificar historico de alertas
curl -s 'http://localhost:9090/api/v1/query?query=ALERTS{alertstate="firing"}' | jq '.data.result | length'

# Verificar silences
curl -s http://localhost:9093/api/v2/silences | jq '[.[] | select(.status.state=="active")] | length'
\`\`\``,
      solution: `**Estrategia de reducao:**

1. **Auditar cada alerta:**
   - Tem runbook? Se nao, crie ou remova
   - Requer acao? Se nao, downgrade para ticket
   - Dispara frequentemente? Ajuste threshold

2. **Classificar alertas:**
\`\`\`
Page: SLO burn rate, servico down
Ticket: disco, cert, pod restarts
Dashboard: CPU, memoria baseline
\`\`\`

3. **Aumentar thresholds:**
\`\`\`yaml
# Antes: sensivel demais
for: 1m
expr: cpu > 70

# Depois: realista
for: 15m
expr: cpu > 90
\`\`\`

4. **Migrar para SLO-based:** Um alerta de burn rate substitui dezenas de alertas de sintoma.

5. **Meta:** < 2 pages/turno, < 10% falsos positivos`
    },
    {
      title: 'Handoff perdido — on-call nao tem contexto',
      difficulty: 'easy',
      symptom: 'O novo on-call nao sabe que ha um incidente em andamento ou uma mudanca recente que pode causar problemas. Nao houve handoff formal.',
      diagnosis: `\`\`\`bash
# Verificar se ha incidentes ativos
kubectl get cm -n production -l type=postmortem --sort-by=.metadata.creationTimestamp | tail -3

# Verificar deploys recentes
kubectl get deployments -n production -o jsonpath='{range .items[*]}{.metadata.name}: {.metadata.annotations.deployment\\.kubernetes\\.io/revision}{"\n"}{end}'

# Verificar eventos recentes
kubectl get events -A --sort-by='.lastTimestamp' --field-selector type=Warning | tail -10
\`\`\``,
      solution: `**Implementar handoff formal:**

1. **Checklist automatizado:** Crie um script/dashboard de handoff:
\`\`\`bash
#!/bin/bash
echo "=== ON-CALL HANDOFF ==="
echo "\\n--- Incidentes Ativos ---"
kubectl get cm -n production -l type=postmortem --sort-by=.metadata.creationTimestamp | tail -3
echo "\\n--- Alertas Ativos ---"
curl -s http://alertmanager:9093/api/v2/alerts | jq '.[].labels.alertname'
echo "\\n--- Deploys Recentes (24h) ---"
kubectl get events -A --field-selector reason=ScalingReplicaSet --sort-by='.lastTimestamp' | tail -5
echo "\\n--- Known Issues ---"
kubectl get cm -n production -l type=known-issue
\`\`\`

2. **Reuniao de 15 minutos** entre on-calls na transicao

3. **Documento compartilhado** atualizado continuamente (Google Doc, Notion)

4. **Automacao:** Configure bot no Slack que posta resumo do turno automaticamente`
    },
    {
      title: 'Runbook desatualizado causa mitigacao errada',
      difficulty: 'hard',
      symptom: 'O on-call seguiu o runbook para um alerta, mas os comandos falharam porque o servico mudou (novo namespace, nova arquitetura). A mitigacao errada piorou o incidente.',
      diagnosis: `\`\`\`bash
# Verificar quando o runbook foi atualizado
kubectl get cm -n monitoring -l type=runbook -o jsonpath='{range .items[*]}{.metadata.name}: {.metadata.creationTimestamp}{"\n"}{end}'

# Verificar se o servico mudou
kubectl get deployment -n production -o yaml | grep -i "image\\|namespace" | head -10

# Verificar historico de mudancas
kubectl rollout history deployment/<name> -n production
\`\`\``,
      solution: `**Prevencao:**

1. **Review periodico:** Agende revisao de runbooks a cada 30 dias. Runbook nao revisado em 90 dias deve ser marcado como "unverified".

2. **Game days:** Execute runbooks periodicamente como exercicio:
   - Simule o alerta em ambiente de staging
   - Execute os passos do runbook
   - Atualize se algo mudou

3. **Versionamento:** Mantenha runbooks no Git com o codigo:
\`\`\`
repo/
  docs/runbooks/
    high-pod-restart-rate.md
    pvc-almost-full.md
    node-not-ready.md
\`\`\`

4. **Ownership:** Cada runbook tem um owner. Quando o servico muda, o owner atualiza o runbook no mesmo PR.

5. **Feedback loop:** Apos cada uso em incidente, o on-call reporta se o runbook estava correto e sugere melhorias.`
    }
  ]
};
