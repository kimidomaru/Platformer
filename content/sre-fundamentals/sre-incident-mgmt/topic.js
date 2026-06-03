window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['sre-fundamentals/sre-incident-mgmt'] = {
  theory: `
# Incident Management — Resposta, Severidade & Postmortems

## Relevancia
Incidentes sao inevitaveis em sistemas distribuidos. A diferenca entre um time SRE maduro e um reativo esta na capacidade de responder de forma estruturada, comunicar efetivamente e aprender com cada falha. Incident management e o processo que transforma caos em aprendizado.

## Conceitos Fundamentais

### Ciclo de Vida de um Incidente

\`\`\`
Detection → Triage → Response → Mitigation → Resolution → Postmortem
    |          |         |            |             |            |
  Alerta   Severidade  IC assign   Workaround   Fix root     Aprender
  recebido  definida   Comms up    aplicado     cause        e prevenir
\`\`\`

### Niveis de Severidade

| Severidade | Descricao | Resposta | Exemplo |
|-----------|-----------|----------|---------|
| **SEV1 / P1** | Impacto critico — servico completamente indisponivel | Imediata, all-hands, bridge call | API de pagamentos down |
| **SEV2 / P2** | Impacto significativo — funcionalidade principal degradada | Imediata, on-call + backup | Latencia 10x acima do normal |
| **SEV3 / P3** | Impacto menor — funcionalidade secundaria afetada | Proximo dia util | Dashboard de admin com erro |
| **SEV4 / P4** | Impacto minimo — cosmético ou edge case | Backlog normal | Typo em mensagem de erro |

### Papeis durante o Incidente

\`\`\`
Incident Commander (IC):
  - Coordena a resposta
  - Define prioridades
  - Delega tarefas
  - NAO faz debugging diretamente

Communications Lead:
  - Atualiza stakeholders
  - Posta updates em status page
  - Gerencia expectativas
  - Mantem timeline

Operations Lead:
  - Executa diagnostico tecnico
  - Implementa mitigacao
  - Documenta acoes tomadas
  - Coordena SMEs (Subject Matter Experts)

Scribe:
  - Documenta tudo em tempo real
  - Registra decisoes e racional
  - Coleta logs e evidencias
  - Prepara material para postmortem
\`\`\`

### Processo de Resposta

**1. Deteccao e Triage (primeiros 5 minutos):**
\`\`\`bash
# Verificar status geral do cluster
kubectl get nodes
kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded

# Verificar eventos recentes
kubectl get events -A --sort-by='.lastTimestamp' | tail -20

# Verificar metricas de SLO
curl -s 'http://prometheus:9090/api/v1/query?query=slo:error_budget:remaining'

# Determinar blast radius
kubectl get pods -n production -o wide | grep -v Running
\`\`\`

**2. Comunicacao (primeiros 10 minutos):**
\`\`\`
Template de Update:
  [SEV2] Incidente: API de Checkout com alta latencia
  Status: Investigando
  Impacto: ~30% dos usuarios afetados
  IC: @fulano
  Proximo update: 15 minutos
\`\`\`

**3. Mitigacao (foco em restaurar servico):**
\`\`\`bash
# Rollback rapido
kubectl rollout undo deployment/checkout-api -n production

# Escalar para absorver carga
kubectl scale deployment/checkout-api -n production --replicas=10

# Isolar componente problematico
kubectl cordon node-problematico

# Redirect trafego
kubectl patch svc checkout-api -n production -p '{"spec":{"selector":{"version":"stable"}}}'
\`\`\`

**4. Resolucao (apos servico restaurado):**
\`\`\`bash
# Confirmar que SLIs voltaram ao normal
curl -s 'http://prometheus:9090/api/v1/query?query=sli:http_requests:availability_rate5m'

# Verificar que nao ha erros residuais
kubectl logs -n production -l app=checkout-api --since=10m | grep -c ERROR

# Documentar timeline final
# Preparar para postmortem
\`\`\`

### Blameless Postmortem

O postmortem blameless e a ferramenta mais importante de aprendizado. O foco e no **sistema**, nao nas pessoas.

**Principios:**
1. **Blameless**: ninguem e culpado — o sistema falhou
2. **Honestidade**: relatar o que realmente aconteceu
3. **Foco em aprendizado**: como prevenir, nao quem errou
4. **Action items concretos**: cada item tem owner e deadline

**Template de Postmortem:**
\`\`\`markdown
# Postmortem: [Titulo do Incidente]

## Resumo
Data: 2025-01-15
Duracao: 45 minutos (14:30 - 15:15 UTC)
Severidade: SEV2
Impacto: 30% dos usuarios do checkout afetados
Error Budget consumido: 15 minutos (de 43 min restantes)

## Timeline
- 14:25 — Deploy v2.3.1 do checkout-api iniciado
- 14:30 — Alerta: ErrorBudgetBurnRateHigh disparado
- 14:32 — IC declarado, bridge call iniciado
- 14:35 — Identificado: nova versao com query N+1
- 14:38 — Rollback para v2.3.0 iniciado
- 14:42 — Rollback concluido, latencia normalizando
- 14:50 — SLIs dentro do target
- 15:15 — Incidente encerrado

## Root Cause
A versao 2.3.1 introduziu uma query N+1 no endpoint
/checkout que causou 10x mais queries ao banco.
O load testing pre-deploy nao cobria o endpoint de
checkout com volume realista.

## O que deu certo
- Alerta de burn rate detectou em 5 minutos
- Rollback automatico funcionou corretamente
- Comunicacao foi clara e frequente

## O que pode melhorar
- Load test nao cobria cenario de checkout
- Nao havia canary deploy para detectar antes
- Review de queries SQL nao e obrigatorio no PR

## Action Items
1. [P1] Adicionar load test para /checkout — @dev-lead — 2025-01-22
2. [P2] Implementar canary deploy — @sre-team — 2025-02-01
3. [P2] Adicionar SQL review obrigatorio — @tech-lead — 2025-01-29
4. [P3] Criar dashboard de queries por endpoint — @dba — 2025-02-15
\`\`\`

### Metricas de Incident Management

\`\`\`
MTTD — Mean Time to Detect:
  Tempo entre o inicio do problema e a deteccao.
  Ideal: < 5 minutos (com bom monitoring)

MTTR — Mean Time to Resolve:
  Tempo entre deteccao e resolucao completa.
  Composto por: MTTA + MTTI + MTTM

MTTA — Mean Time to Acknowledge:
  Tempo entre alerta e alguem assumir o incidente.
  Ideal: < 5 minutos

MTTI — Mean Time to Investigate:
  Tempo investigando a root cause.

MTTM — Mean Time to Mitigate:
  Tempo para restaurar o servico (workaround).
  Ideal: < 30 minutos para SEV1/SEV2
\`\`\`

### Comunicacao durante Incidentes

\`\`\`
Regras de comunicacao:
  1. Update a cada 15-30 minutos (mesmo sem novidades)
  2. Separar comunicacao interna (tecnica) de externa (clientes)
  3. Usar templates padronizados
  4. Definir quem comunica (Communications Lead)
  5. Status page atualizada automaticamente

Canais:
  Slack #incident-YYYY-MM-DD — comunicacao tecnica
  Bridge call (Zoom/Meet) — coordenacao
  Status page — comunicacao externa
  Email — stakeholders executivos
\`\`\`

## Automacao de Incident Response em K8s

### PagerDuty/Opsgenie Integration

\`\`\`yaml
# AlertManager config para PagerDuty
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-config
  namespace: monitoring
stringData:
  alertmanager.yaml: |
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
          receiver: 'pagerduty-critical'
          repeat_interval: 1h
        - match:
            severity: warning
          receiver: 'slack-warnings'
          repeat_interval: 4h

    receivers:
      - name: 'default'
        slack_configs:
          - channel: '#alerts-default'
            api_url: 'https://hooks.slack.com/services/xxx'

      - name: 'pagerduty-critical'
        pagerduty_configs:
          - service_key: 'your-pagerduty-key'
            severity: critical

      - name: 'slack-warnings'
        slack_configs:
          - channel: '#alerts-warnings'
            api_url: 'https://hooks.slack.com/services/xxx'
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Triage rapido
kubectl get nodes -o wide
kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded
kubectl get events -A --sort-by='.lastTimestamp' | tail -30
kubectl top nodes
kubectl top pods -n production --sort-by=cpu

# Mitigacao
kubectl rollout undo deployment/<name> -n production
kubectl scale deployment/<name> -n production --replicas=<N>
kubectl cordon <node-name>
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# Diagnostico
kubectl describe pod <pod> -n production
kubectl logs <pod> -n production --since=30m
kubectl exec -it <pod> -n production -- /bin/sh
kubectl get events -n production --field-selector involvedObject.name=<pod>
\`\`\`

## Erros Comuns

1. **Nao declarar IC cedo**: Sem Incident Commander, a resposta e descoordenada. Declare IC nos primeiros 5 minutos.
2. **Focar em root cause durante o incidente**: Primeiro mitigue (restaure servico), depois investigue root cause.
3. **Blame culture**: Postmortems que culpam pessoas inibem transparencia e aprendizado.
4. **Nao documentar timeline**: Sem timeline, o postmortem perde detalhes criticos. Use um scribe.
5. **Action items sem owner ou deadline**: Action items vagos nunca sao executados.
6. **Nao testar runbooks**: Runbooks desatualizados falham quando mais precisamos deles.

## Killer.sh Style Challenge

**Cenario:** Um servico critico esta com alta taxa de erros. Execute o processo de incident management.

**Tarefas:**
1. Identifique o problema e defina a severidade
2. Assuma o papel de IC e coordene a resposta
3. Execute mitigacao (rollback ou scaling)
4. Confirme restauracao verificando SLIs
5. Escreva um postmortem blameless com action items
`,
  quiz: [
    {
      question: 'Qual o papel do Incident Commander (IC) durante um incidente?',
      options: [
        'Fazer o debugging e corrigir o problema diretamente',
        'Coordenar a resposta, definir prioridades, delegar tarefas e manter a comunicacao — sem fazer debugging direto',
        'Apenas comunicar com stakeholders externos',
        'Escrever o postmortem durante o incidente'
      ],
      correct: 1,
      explanation: 'O IC coordena toda a resposta ao incidente: define prioridades, delega tarefas para Operations Lead e SMEs, e garante que a comunicacao esta fluindo. O IC NAO deve fazer debugging direto — isso seria dividir atencao e comprometer a coordenacao. E como um maestro de orquestra.',
      reference: 'Conceito relacionado: sre-incident-mgmt — os 4 papeis sao IC, Communications Lead, Operations Lead e Scribe.'
    },
    {
      question: 'O que significa "blameless postmortem"?',
      options: [
        'Um postmortem onde ninguem participa',
        'Um postmortem que nao identifica root cause',
        'Um postmortem focado no sistema e processos que falharam, nao em culpar individuos, promovendo transparencia e aprendizado',
        'Um postmortem escrito apenas pelo time de management'
      ],
      correct: 2,
      explanation: 'Blameless postmortem foca em como o sistema permitiu que o erro acontecesse, nao em quem cometeu o erro. Pessoas agem racionalmente com a informacao disponivel no momento. O objetivo e melhorar sistemas e processos para prevenir recorrencia, o que requer honestidade total — impossivel em cultura de culpa.',
      reference: 'Conceito relacionado: sre-principles — postmortems alimentam melhorias que protegem o error budget.'
    },
    {
      question: 'Qual a primeira prioridade durante um incidente: encontrar root cause ou restaurar o servico?',
      options: [
        'Encontrar root cause — sem entender o problema, nao se pode resolver',
        'Restaurar o servico (mitigar) primeiro, depois investigar root cause',
        'Depende da severidade',
        'Comunicar com stakeholders e esperar instrucoes'
      ],
      correct: 1,
      explanation: 'A prioridade numero 1 e MITIGAR — restaurar o servico para os usuarios. Rollback, scaling, failover sao acoes de mitigacao que restauram o servico rapidamente. A investigacao de root cause acontece DEPOIS, com calma, durante o postmortem. Tentar encontrar root cause durante o incidente prolonga o impacto.',
      reference: 'Conceito relacionado: sre-incident-mgmt — o ciclo de vida e Detection → Triage → Mitigation → Resolution → Postmortem.'
    },
    {
      question: 'O que e MTTR e quais sao seus componentes?',
      options: [
        'Mean Time to Resolve — composto por MTTA (acknowledge), MTTI (investigate) e MTTM (mitigate)',
        'Maximum Time to Respond — tempo maximo permitido',
        'Mean Time to Report — tempo para reportar o incidente',
        'Minimum Time to Recovery — tempo minimo de recuperacao'
      ],
      correct: 0,
      explanation: 'MTTR (Mean Time to Resolve) e o tempo medio total de resolucao, composto por: MTTA (tempo ate alguem assumir), MTTI (tempo investigando), e MTTM (tempo para mitigar/restaurar). Reduzir cada componente reduz o MTTR total. MTTD (detect) acontece antes do MTTR.',
      reference: 'Conceito relacionado: sre-observability — monitoring eficaz reduz o MTTD.'
    },
    {
      question: 'Com que frequencia devem ser enviados updates durante um incidente SEV1?',
      options: [
        'Apenas quando houver novidades',
        'A cada 15-30 minutos, mesmo sem novidades, para manter stakeholders informados',
        'A cada hora',
        'Apenas no inicio e no fim do incidente'
      ],
      correct: 1,
      explanation: 'Updates devem ser enviados a cada 15-30 minutos durante incidentes de alta severidade, MESMO SEM NOVIDADES. A ausencia de comunicacao gera ansiedade e leva stakeholders a interromper a equipe de resposta pedindo updates. Um template simples como "Ainda investigando, proximo update em 15 min" e suficiente.',
      reference: 'Conceito relacionado: sre-incident-mgmt — o Communications Lead e responsavel por manter o ritmo de updates.'
    },
    {
      question: 'Qual e uma acao de mitigacao valida durante um incidente em Kubernetes?',
      options: [
        'Refatorar o codigo da aplicacao durante o incidente',
        'Executar rollback do deployment para a ultima versao estavel',
        'Deletar o namespace e recriar do zero',
        'Atualizar o Kubernetes para a versao mais recente'
      ],
      correct: 1,
      explanation: 'Rollback e uma acao de mitigacao classica: rapida, segura e reversivel. Refatorar codigo, deletar namespaces ou atualizar K8s sao acoes arriscadas demais durante um incidente. Outras mitigacoes validas: escalar replicas, cordon node problematico, redirect trafego para outra versao/regiao.',
      reference: 'Conceito relacionado: sre-incident-mgmt — kubectl rollout undo e o comando mais usado para rollback.'
    },
    {
      question: 'O que um action item de postmortem deve conter?',
      options: [
        'Apenas a descricao da acao',
        'Descricao da acao, owner responsavel, deadline e prioridade',
        'Apenas o nome do responsavel',
        'Link para o ticket de incidente'
      ],
      correct: 1,
      explanation: 'Action items eficazes tem 4 elementos: descricao clara da acao, owner (pessoa responsavel), deadline (data limite), e prioridade (P1-P4). Sem esses elementos, action items ficam vagos e nunca sao executados. Exemplo: "[P1] Implementar canary deploy — @sre-team — 2025-02-01".',
      reference: 'Conceito relacionado: sre-incident-mgmt — acompanhe action items em reunioes de revisao de SLO.'
    }
  ],
  flashcards: [
    {
      front: 'Ciclo de vida de um incidente?',
      back: '**6 fases:**\n\n1. **Detection** — alerta recebido\n   (MTTD: < 5 min ideal)\n\n2. **Triage** — definir severidade\n   (SEV1-SEV4) e impacto\n\n3. **Response** — IC declarado,\n   bridge call, papeis atribuidos\n\n4. **Mitigation** — restaurar servico\n   (rollback, scale, failover)\n\n5. **Resolution** — fix permanente\n   aplicado e verificado\n\n6. **Postmortem** — documentar,\n   aprender, criar action items\n\n**Regra:** mitigue ANTES de investigar root cause'
    },
    {
      front: 'Papeis durante um incidente?',
      back: '**Incident Commander (IC):**\n- Coordena tudo\n- Define prioridades\n- Delega tarefas\n- NAO faz debugging\n\n**Communications Lead:**\n- Updates para stakeholders\n- Status page\n- Comunicacao externa\n\n**Operations Lead:**\n- Diagnostico tecnico\n- Implementa mitigacao\n- Coordena SMEs\n\n**Scribe:**\n- Documenta timeline\n- Registra decisoes\n- Coleta evidencias\n- Prepara postmortem\n\n**Regra:** IC e Communications\nNUNCA devem ser a mesma pessoa em SEV1'
    },
    {
      front: 'Niveis de severidade?',
      back: '**SEV1 / P1 — Critico:**\n- Servico completamente down\n- Resposta imediata, all-hands\n- Ex: API de pagamentos offline\n\n**SEV2 / P2 — Significativo:**\n- Funcionalidade principal degradada\n- On-call + backup imediato\n- Ex: Latencia 10x acima do normal\n\n**SEV3 / P3 — Menor:**\n- Funcionalidade secundaria afetada\n- Proximo dia util\n- Ex: Dashboard admin com erro\n\n**SEV4 / P4 — Minimo:**\n- Cosmetico ou edge case\n- Backlog normal\n- Ex: Typo em mensagem de erro'
    },
    {
      front: 'Template de postmortem blameless?',
      back: '**Secoes obrigatorias:**\n\n1. **Resumo:** data, duracao, severidade,\n   impacto, error budget consumido\n\n2. **Timeline:** cronologia detalhada\n   (minuto a minuto)\n\n3. **Root Cause:** analise tecnica\n   do que causou o incidente\n\n4. **O que deu certo:** processos\n   que funcionaram como esperado\n\n5. **O que pode melhorar:** gaps\n   identificados\n\n6. **Action Items:** cada um com:\n   - Descricao clara\n   - Owner responsavel\n   - Deadline\n   - Prioridade (P1-P4)\n\n**Principio:** foco no SISTEMA, nao pessoas'
    },
    {
      front: 'Metricas de Incident Management?',
      back: '**MTTD — Mean Time to Detect:**\n- Alerta recebido vs inicio do problema\n- Ideal: < 5 min\n- Melhorar: monitoring, SLO alerts\n\n**MTTA — Mean Time to Acknowledge:**\n- Alguem assumiu o incidente\n- Ideal: < 5 min\n- Melhorar: on-call process\n\n**MTTI — Mean Time to Investigate:**\n- Tempo diagnosticando\n- Melhorar: observabilidade, runbooks\n\n**MTTM — Mean Time to Mitigate:**\n- Servico restaurado (workaround)\n- Ideal: < 30 min para SEV1/2\n- Melhorar: rollback automatico\n\n**MTTR — Mean Time to Resolve:**\n- MTTR = MTTA + MTTI + MTTM'
    },
    {
      front: 'Comandos de mitigacao rapida em K8s?',
      back: '**Rollback:**\n```bash\nkubectl rollout undo deployment/<name>\nkubectl rollout status deployment/<name>\n```\n\n**Escalar:**\n```bash\nkubectl scale deploy/<name> --replicas=10\n```\n\n**Isolar node:**\n```bash\nkubectl cordon <node>\nkubectl drain <node> --ignore-daemonsets\n```\n\n**Redirect trafego:**\n```bash\nkubectl patch svc <name> -p \\\n  \'{"spec":{"selector":{"version":"stable"}}}\'\n```\n\n**Verificar restauracao:**\n```bash\nkubectl get pods -n prod | grep -v Running\nkubectl logs -l app=<name> --since=5m | grep ERROR\n```'
    }
  ],
  lab: {
    scenario: 'Um deployment em producao comecou a gerar erros 5xx apos um deploy recente. Voce precisa executar o processo completo de incident management.',
    objective: 'Praticar o ciclo completo de incidente: deteccao, triage, mitigacao, resolucao e documentacao de postmortem.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Deteccao e Triage',
        instruction: `Simule a deteccao de um incidente e execute a triage inicial.

\`\`\`bash
# Verificar estado dos pods
kubectl get pods -n production -o wide

# Verificar eventos recentes
kubectl get events -n production --sort-by='.lastTimestamp' | tail -10

# Verificar logs por erros
kubectl logs -n production -l app=checkout-api --since=10m --tail=50 | grep -i "error\\|fatal\\|panic"

# Verificar metricas (se Prometheus disponivel)
# curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{code=~"5..",app="checkout-api"}[5m])'

# Definir severidade com base no impacto
echo "Triage completo:"
echo "- Servico: checkout-api"
echo "- Impacto: erros 5xx apos deploy v2.3.1"
echo "- Severidade: SEV2"
echo "- IC: $(whoami)"
\`\`\``,
        hints: [
          'Triage deve ser feito em menos de 5 minutos',
          'Verifique eventos, logs e metricas rapidamente',
          'Defina severidade com base no impacto ao usuario, nao na causa tecnica'
        ],
        solution: `\`\`\`bash
kubectl get pods -n production -o wide
kubectl get events -n production --sort-by='.lastTimestamp' | tail -10
kubectl logs -n production -l app=checkout-api --since=10m --tail=50 | grep -i "error"
\`\`\``,
        verify: `\`\`\`bash
# Verificar que voce conseguiu acessar informacoes do cluster
kubectl get pods -n production 2>/dev/null && echo "Triage: acesso ao cluster OK" || echo "Erro: sem acesso ao cluster"

# Verificar que eventos sao acessiveis
kubectl get events -n production --sort-by='.lastTimestamp' 2>/dev/null | tail -3
# Saida esperada: lista de eventos recentes
\`\`\``
      },
      {
        title: 'Mitigacao — Rollback',
        instruction: `Execute um rollback do deployment para restaurar o servico rapidamente.

\`\`\`bash
# Verificar historico de rollout
kubectl rollout history deployment/checkout-api -n production

# Executar rollback para versao anterior
kubectl rollout undo deployment/checkout-api -n production

# Monitorar o rollback
kubectl rollout status deployment/checkout-api -n production --timeout=120s

# Verificar que os novos pods estao rodando
kubectl get pods -n production -l app=checkout-api -o wide
\`\`\``,
        hints: [
          'rollout undo volta para a revisao anterior automaticamente',
          'Use rollout status para monitorar o progresso',
          'Rollback e a mitigacao mais rapida e segura'
        ],
        solution: `\`\`\`bash
kubectl rollout undo deployment/checkout-api -n production
kubectl rollout status deployment/checkout-api -n production --timeout=120s
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o rollback foi executado
kubectl rollout history deployment/checkout-api -n production | tail -3
# Saida esperada: nova revisao na lista

# Verificar pods rodando
kubectl get pods -n production -l app=checkout-api --no-headers | grep -c Running
# Saida esperada: numero de replicas configuradas (ex: 3)
\`\`\``
      },
      {
        title: 'Verificar Restauracao',
        instruction: `Confirme que o servico foi restaurado verificando SLIs e logs.

\`\`\`bash
# Verificar que nao ha mais erros nos logs recentes
kubectl logs -n production -l app=checkout-api --since=5m | grep -c "ERROR"

# Verificar que todos os pods estao healthy
kubectl get pods -n production -l app=checkout-api -o jsonpath='{range .items[*]}{.metadata.name} {.status.phase} {.status.containerStatuses[0].ready}{"\n"}{end}'

# Verificar endpoints do service
kubectl get endpoints checkout-api -n production

# Se prometheus disponivel, verificar SLIs
# curl -s 'http://prometheus:9090/api/v1/query?query=sli:http_requests:availability_rate5m'

echo "Servico restaurado — atualizando comunicacao"
echo "Status: MITIGADO — rollback para versao anterior concluido"
echo "Monitorando por 30 minutos antes de fechar incidente"
\`\`\``,
        hints: [
          'Verifique que erros nos logs cessaram apos o rollback',
          'Confirme que todos os pods estao Ready',
          'Monitore por pelo menos 15-30 minutos antes de declarar resolvido'
        ],
        solution: `\`\`\`bash
kubectl logs -n production -l app=checkout-api --since=5m | grep -c "ERROR"
kubectl get pods -n production -l app=checkout-api
kubectl get endpoints checkout-api -n production
\`\`\``,
        verify: `\`\`\`bash
# Verificar pods healthy
kubectl get pods -n production -l app=checkout-api --no-headers 2>/dev/null | grep -v Running | wc -l
# Saida esperada: 0 (nenhum pod fora de Running)

# Verificar que endpoints existem
kubectl get endpoints checkout-api -n production 2>/dev/null | grep -v "none"
# Saida esperada: linha com IPs dos pods
\`\`\``
      },
      {
        title: 'Documentar Postmortem',
        instruction: `Crie um ConfigMap com o template de postmortem do incidente.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: postmortem-2025-01-15
  namespace: production
  labels:
    type: postmortem
    severity: sev2
    service: checkout-api
data:
  postmortem.md: |
    # Postmortem: Checkout API High Error Rate

    ## Summary
    - Date: 2025-01-15
    - Duration: 20 minutes
    - Severity: SEV2
    - Impact: checkout errors for ~30% of users
    - Error budget consumed: 10 minutes

    ## Timeline
    - 14:30 — Deploy v2.3.1 started
    - 14:35 — Burn rate alert fired
    - 14:37 — IC declared
    - 14:40 — Rollback initiated
    - 14:45 — Rollback complete, service restored
    - 14:55 — Monitoring confirms SLIs normal
    - 15:00 — Incident closed

    ## Root Cause
    Version 2.3.1 introduced N+1 query in /checkout

    ## Action Items
    - [P1] Add load test for /checkout — owner TBD — 2025-01-22
    - [P2] Implement canary deploy — owner TBD — 2025-02-01
    - [P2] Add mandatory SQL review — owner TBD — 2025-01-29
EOF
\`\`\``,
        hints: [
          'Labels no ConfigMap permitem buscar postmortems por severidade ou servico',
          'O postmortem deve ser escrito nas primeiras 48 horas apos o incidente',
          'Action items devem ter owner e deadline definidos'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: postmortem-2025-01-15
  namespace: production
  labels:
    type: postmortem
    severity: sev2
data:
  postmortem.md: |
    # Postmortem: Checkout API Error Rate
    ## Root Cause: N+1 query in v2.3.1
    ## Action Items: load test, canary deploy, SQL review
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o postmortem foi criado
kubectl get cm postmortem-2025-01-15 -n production
# Saida esperada: NAME                      DATA   AGE
#                  postmortem-2025-01-15    1      Xs

# Verificar labels
kubectl get cm postmortem-2025-01-15 -n production -o jsonpath='{.metadata.labels}'
# Saida esperada: contem type:postmortem e severity:sev2

# Listar todos os postmortems
kubectl get cm -n production -l type=postmortem
# Saida esperada: lista de postmortems
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Incidente sem IC — resposta descoordenada',
      difficulty: 'easy',
      symptom: 'Um incidente SEV2 esta em andamento ha 30 minutos mas ninguem declarou IC. Multiplas pessoas estao investigando coisas diferentes, nao ha comunicacao clara e stakeholders estao perguntando status.',
      diagnosis: `\`\`\`bash
# Verificar quem esta no canal de incidente
# (Verificar canal Slack #incidents ou bridge call)

# Verificar se ha acoes duplicadas
kubectl logs -n production -l app=affected-service --since=30m | tail -20

# Verificar se rollback ou scaling ja foi feito
kubectl rollout history deployment/affected-service -n production
\`\`\``,
      solution: `**Acoes imediatas:**

1. **Declare-se IC (ou designe alguem):**
   "Eu sou o IC para este incidente. @fulano: communications, @ciclano: operations."

2. **Pare trabalho duplicado:** Pergunte a cada pessoa o que esta fazendo. Redistribua.

3. **Estabeleca ritmo de comunicacao:** "Updates a cada 15 minutos no #incident-channel."

4. **Foque em mitigacao primeiro:** Se o servico ainda esta down, rollback ou scale antes de investigar.

5. **Prevencao:** Automatize a declaracao de IC. Configure Alertmanager para criar incident channel automaticamente e notificar on-call com instrucoes claras.

**Checklist IC ao assumir:**
- [ ] Declarar papel de IC
- [ ] Atribuir Communications e Operations
- [ ] Status update imediato
- [ ] Definir estrategia de mitigacao
- [ ] Agendar proximo update`
    },
    {
      title: 'Postmortems nao geram melhorias',
      difficulty: 'medium',
      symptom: 'O time escreve postmortems regularmente, mas os mesmos tipos de incidentes continuam acontecendo. Action items nao sao executados ou sao muito vagos.',
      diagnosis: `\`\`\`bash
# Listar postmortems existentes
kubectl get cm -n production -l type=postmortem --sort-by=.metadata.creationTimestamp

# Verificar se action items estao documentados
kubectl get cm -n production -l type=postmortem -o yaml | grep -A2 "Action Items"

# Verificar recorrencia por servico
kubectl get cm -n production -l type=postmortem -o jsonpath='{range .items[*]}{.metadata.labels.service}{"\n"}{end}' | sort | uniq -c | sort -rn
\`\`\``,
      solution: `**Solucoes:**

1. **Action items SMART:** Cada action item deve ser Specific, Measurable, Achievable, Relevant, Time-bound:
   - Ruim: "Melhorar monitoring"
   - Bom: "[P1] Adicionar alerta de burn rate para /checkout com threshold 14.4x — @sre-lead — 2025-02-01"

2. **Review semanal de action items:** Inclua revisao de action items na reuniao de sprint. Itens atrasados devem ser escalados.

3. **Categorize root causes:** Analise padroes:
   - Muitos incidentes por deploy? → Melhore CI/CD
   - Muitos por capacidade? → Melhore autoscaling
   - Muitos por dependencias? → Melhore circuit breakers

4. **Metricas de eficacia:** Acompanhe:
   - % de action items concluidos no prazo
   - Taxa de recorrencia de incidentes similares
   - Trend de MTTR ao longo do tempo

5. **Executive sponsor:** Garanta que alguem da lideranca participa da revisao mensal de postmortems.`
    },
    {
      title: 'MTTD alto — incidentes detectados por usuarios',
      difficulty: 'hard',
      symptom: 'Incidentes sao frequentemente detectados por usuarios (via tickets ou reclamacoes) antes de os alertas dispararem. O MTTD medio e superior a 30 minutos.',
      diagnosis: `\`\`\`bash
# Verificar cobertura de alertas
kubectl get prometheusrule -n monitoring
kubectl get prometheusrule -n monitoring -o yaml | grep -c "alert:"

# Verificar se SLO alerts existem
kubectl get prometheusrule -n monitoring -o yaml | grep -i "burnrate\\|slo\\|error.budget"

# Verificar se todos os servicos tem ServiceMonitor
kubectl get servicemonitor -n monitoring
kubectl get svc -n production -o name | wc -l

# Verificar AlertManager routes
kubectl get secret alertmanager-config -n monitoring -o jsonpath='{.data.alertmanager\\.yaml}' | base64 -d | head -20
\`\`\``,
      solution: `**Estrategia para reduzir MTTD:**

1. **SLO-based alerting:** Implemente alertas de burn rate que detectam degradacao antes do impacto total:
\`\`\`yaml
# Burn rate 14.4x detecta em ~5 minutos
- alert: SLOBurnRateCritical
  expr: |
    (1 - sli:availability) / (1 - 0.999) > 14.4
  for: 2m
\`\`\`

2. **Cobertura completa:** Garanta que todo servico critico tem:
   - ServiceMonitor configurado
   - SLIs definidos (disponibilidade + latencia)
   - Alertas de burn rate

3. **Synthetic monitoring:** Use probes que simulam acoes do usuario:
\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: Probe
metadata:
  name: checkout-probe
spec:
  prober:
    url: blackbox-exporter:9115
  targets:
    staticConfig:
      static:
        - https://checkout.example.com/health
\`\`\`

4. **Alertas em cascata:** Se o servico A depende do B, alerte quando B degrada ANTES que A seja impactado.

5. **Canary requests:** Envie requests sinteticos continuamente para detectar falhas antes dos usuarios.`
    }
  ]
};
