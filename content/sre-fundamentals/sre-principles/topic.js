window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['sre-fundamentals/sre-principles'] = {
  theory: `
# SRE Principles — SLIs, SLOs, SLAs & Error Budgets

## Relevancia
Site Reliability Engineering (SRE) e a disciplina que aplica engenharia de software a operacoes de infraestrutura. Dominar SLIs, SLOs, SLAs e Error Budgets e fundamental para qualquer profissional DevOps/SRE, pois sao a base para decisoes sobre confiabilidade, velocidade de entrega e priorizacao de trabalho.

## Conceitos Fundamentais

### O que e SRE?

SRE e uma abordagem criada pelo Google para gerenciar sistemas de producao em escala. O principio central e: **tratamos operacoes como um problema de engenharia de software**.

\`\`\`
Pilares do SRE:
  1. Abracar o risco (risk management)
  2. SLOs e Error Budgets como metricas de decisao
  3. Eliminar toil (trabalho operacional repetitivo)
  4. Monitoramento e observabilidade
  5. Automacao progressiva
  6. Release engineering
  7. Simplicidade
\`\`\`

### SLI — Service Level Indicator

O SLI e uma **metrica quantitativa** que mede um aspecto do nivel de servico. E o que voce mede.

\`\`\`
SLI = (eventos bons / eventos totais) * 100

Exemplos:
  Disponibilidade: requisicoes bem-sucedidas / total de requisicoes
  Latencia:        requisicoes < 300ms / total de requisicoes
  Throughput:      requisicoes processadas por segundo
  Correctness:     respostas corretas / total de respostas
  Freshness:       dados atualizados em < 1min / total de consultas
\`\`\`

**SLIs comuns por tipo de servico:**

| Tipo de Servico | SLIs Principais |
|----------------|-----------------|
| **API/HTTP** | Disponibilidade, Latencia (p50, p95, p99), Taxa de erro |
| **Pipeline de dados** | Freshness, Correctness, Throughput |
| **Storage** | Durabilidade, Latencia, Disponibilidade |
| **Streaming** | Throughput, Latencia end-to-end |

### SLO — Service Level Objective

O SLO e o **alvo** (target) que voce define para um SLI. E o objetivo que voce quer atingir.

\`\`\`
Exemplos de SLOs:
  "99.9% das requisicoes HTTP devem retornar 2xx em 30 dias"
  "95% das requisicoes devem ter latencia < 300ms (p95)"
  "99.99% dos dados armazenados nao serao perdidos"
\`\`\`

**Como definir SLOs:**
1. Comece com o que o usuario percebe (user journeys)
2. Defina SLIs que medem essa experiencia
3. Analise dados historicos para estabelecer baselines
4. Defina targets realistas (nao 100%!)
5. Itere — SLOs evoluem com o tempo

**SLO Window (janela de medicao):**
\`\`\`
Rolling window (janela movel):
  - Ultimos 30 dias (mais comum)
  - Ultimos 7 dias
  - Ultimos 90 dias

Calendar window (janela fixa):
  - Mes corrente
  - Trimestre corrente
\`\`\`

### SLA — Service Level Agreement

O SLA e o **contrato formal** com o cliente. Tem consequencias legais/financeiras se violado.

\`\`\`
Relacao:
  SLI  → O que voce mede
  SLO  → O alvo interno que voce define
  SLA  → O contrato com o cliente (SLO + consequencias)

Regra pratica:
  SLA < SLO < Capacidade real

Exemplo:
  SLA: 99.9%  (contrato com cliente)
  SLO: 99.95% (objetivo interno — margem de seguranca)
  Real: 99.98% (capacidade medida)
\`\`\`

### Error Budget — Orcamento de Erros

O Error Budget e a quantidade **permitida** de indisponibilidade derivada do SLO. E o mecanismo que equilibra confiabilidade e velocidade de inovacao.

\`\`\`
Error Budget = 100% - SLO

Exemplo com SLO de 99.9% em 30 dias:
  Error Budget = 0.1%
  0.1% de 30 dias = 43.2 minutos de downtime permitido
  0.1% de 1M requisicoes = 1.000 erros permitidos
\`\`\`

**Tabela de Error Budget por SLO:**

| SLO | Error Budget (30 dias) | Downtime permitido |
|-----|------------------------|-------------------|
| 99% | 1% | ~7.2 horas |
| 99.5% | 0.5% | ~3.6 horas |
| 99.9% | 0.1% | ~43 minutos |
| 99.95% | 0.05% | ~22 minutos |
| 99.99% | 0.01% | ~4.3 minutos |
| 99.999% | 0.001% | ~26 segundos |

**Error Budget Policy — o que acontece quando o budget acaba:**
\`\`\`
Budget > 50%: Ritmo normal de releases
Budget 20-50%: Cautela — avaliar risco de cada release
Budget < 20%:  Freeze parcial — apenas releases criticas
Budget = 0%:   Feature freeze — foco total em confiabilidade
\`\`\`

### Toil — Trabalho Operacional

Toil e trabalho operacional manual, repetitivo, automatizavel, sem valor duradouro e que cresce com o tamanho do servico.

\`\`\`
E toil:                          NAO e toil:
  Restart manual de pods           Escrever automacao
  Rotacao manual de certs          Design de arquitetura
  Escalar manualmente              Code review
  Rodar runbooks repetitivos       Planejamento de capacidade
  Criar tickets manualmente        Postmortem e aprendizado
\`\`\`

**Meta do Google SRE: no maximo 50% do tempo em toil.** Na pratica, times maduros ficam abaixo de 30%.

## Implementando SLOs na Pratica

### Passo 1: Definir SLIs com Prometheus

\`\`\`yaml
# PrometheusRule para SLI de disponibilidade
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: sli-availability
  namespace: monitoring
spec:
  groups:
    - name: sli.rules
      rules:
        # SLI: taxa de requisicoes bem-sucedidas (nao-5xx)
        - record: sli:http_requests:availability
          expr: |
            sum(rate(http_requests_total{code!~"5.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))

        # SLI: latencia p99 < 500ms
        - record: sli:http_requests:latency_good
          expr: |
            sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))
            /
            sum(rate(http_request_duration_seconds_count[5m]))
\`\`\`

### Passo 2: Calcular Error Budget consumido

\`\`\`yaml
# Recording rule para error budget
- record: slo:error_budget:remaining
  expr: |
    1 - (
      (1 - sli:http_requests:availability)
      /
      (1 - 0.999)
    )
  # Resultado: 1.0 = 100% do budget restante
  #            0.0 = budget esgotado
  #           <0.0 = SLO violado
\`\`\`

### Passo 3: Alertar sobre consumo do Error Budget

\`\`\`yaml
# Alerta: error budget sendo consumido rapidamente
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: slo-alerts
  namespace: monitoring
spec:
  groups:
    - name: slo.alerts
      rules:
        # Burn rate alto — consumindo budget rapido demais
        - alert: ErrorBudgetBurnRateHigh
          expr: |
            (
              1 - (sum(rate(http_requests_total{code!~"5.."}[1h]))
              / sum(rate(http_requests_total[1h])))
            )
            /
            (1 - 0.999)
            > 14.4
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Error budget burn rate is 14.4x — budget will be exhausted in ~2h"

        # Budget quase esgotado
        - alert: ErrorBudgetNearlyExhausted
          expr: slo:error_budget:remaining < 0.20
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "Less than 20% of error budget remaining"
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Prometheus — consultar SLIs
# Disponibilidade nos ultimos 30 dias
curl -s 'http://prometheus:9090/api/v1/query?query=avg_over_time(sli:http_requests:availability[30d])'

# Error budget restante
curl -s 'http://prometheus:9090/api/v1/query?query=slo:error_budget:remaining'

# Kubernetes — verificar uptime de servicos
kubectl get pods -n production --field-selector=status.phase!=Running
kubectl top pods -n production --sort-by=cpu

# Verificar eventos recentes (indicadores de instabilidade)
kubectl get events -n production --sort-by=.lastTimestamp | tail -20

# Metricas de disponibilidade via kubectl
kubectl get --raw /metrics | grep apiserver_request_total
\`\`\`

## Erros Comuns

1. **Definir SLOs sem dados historicos**: Analise pelo menos 30 dias de metricas antes de definir targets.
2. **SLO de 100%**: Nenhum sistema e 100% disponivel. Um SLO de 100% significa error budget zero — impossivel inovar.
3. **Confundir SLO com SLA**: SLO e interno e pode ser mais agressivo. SLA e contrato com consequencias financeiras.
4. **Nao ter error budget policy**: Sem politica clara, o error budget nao tem efeito pratico nas decisoes.
5. **Medir SLIs errados**: SLIs devem refletir a experiencia do usuario, nao metricas internas (ex: CPU nao e SLI).
6. **Muitos SLOs**: Comece com 2-3 SLOs por servico. Mais que isso dilui o foco.

## Killer.sh Style Challenge

**Cenario:** Configure SLOs e Error Budget monitoring para um servico de producao em Kubernetes.

**Tarefas:**
1. Defina 2 SLIs (disponibilidade e latencia) como recording rules no Prometheus
2. Calcule o error budget restante baseado em um SLO de 99.9%
3. Configure alertas de burn rate (consumo rapido do budget)
4. Crie um dashboard conceitual mostrando SLO compliance
5. Defina uma error budget policy para o time
`,
  quiz: [
    {
      question: 'Qual a relacao correta entre SLI, SLO e SLA?',
      options: [
        'SLA > SLO > SLI — o SLA e mais amplo que o SLO',
        'SLI e a metrica, SLO e o alvo para essa metrica, SLA e o contrato com consequencias se o SLO for violado',
        'SLI e SLO sao a mesma coisa, e SLA e o contrato',
        'SLA define a metrica, SLO define o alvo, SLI define as consequencias'
      ],
      correct: 1,
      explanation: 'SLI (Indicator) e a metrica quantitativa medida (ex: % de requisicoes bem-sucedidas). SLO (Objective) e o target interno para esse SLI (ex: 99.9%). SLA (Agreement) e o contrato formal com o cliente, geralmente com SLOs menos agressivos e consequencias financeiras se violado.',
      reference: 'Conceito relacionado: sre-principles — a regra pratica e SLA < SLO < Capacidade real.'
    },
    {
      question: 'Se um servico tem SLO de 99.9%, qual e o Error Budget mensal (30 dias)?',
      options: [
        '1% = 7.2 horas',
        '0.01% = 4.3 minutos',
        '0.1% = aproximadamente 43 minutos',
        '0.5% = 3.6 horas'
      ],
      correct: 2,
      explanation: 'Error Budget = 100% - SLO = 100% - 99.9% = 0.1%. Em 30 dias (43.200 minutos), 0.1% = 43.2 minutos de downtime permitido. Isso significa que o servico pode ficar indisponivel por ate ~43 minutos no mes sem violar o SLO.',
      reference: 'Conceito relacionado: sre-principles — consulte a tabela de Error Budget por SLO para referencia rapida.'
    },
    {
      question: 'O que e "toil" no contexto de SRE?',
      options: [
        'Todo trabalho operacional',
        'Trabalho manual, repetitivo, automatizavel, sem valor duradouro e que cresce proporcionalmente ao tamanho do servico',
        'Trabalho de desenvolvimento de features',
        'Trabalho de planejamento e design de arquitetura'
      ],
      correct: 1,
      explanation: 'Toil tem 5 caracteristicas: manual, repetitivo, automatizavel, sem valor duradouro (tatico, nao estrategico), e cresce linearmente com o servico. Exemplos: restart manual de pods, rotacao manual de certificados, criar tickets manualmente. A meta do Google SRE e manter toil abaixo de 50% do tempo.',
      reference: 'Conceito relacionado: sre-toil-automation — topico dedicado a estrategias de eliminacao de toil.'
    },
    {
      question: 'Por que um SLO de 100% e problematico?',
      options: [
        'Porque o Prometheus nao consegue medir 100%',
        'Porque o Kubernetes nao suporta 100% de disponibilidade',
        'Porque error budget seria zero, tornando impossivel lancar qualquer mudanca sem violar o SLO',
        'Porque 100% e facil demais de atingir'
      ],
      correct: 2,
      explanation: 'Com SLO de 100%, o error budget e 0% — qualquer erro, por menor que seja, viola o SLO. Isso cria um ambiente onde nenhuma mudanca pode ser feita (feature freeze permanente), pois toda mudanca carrega risco de erro. SLOs realistas permitem um equilibrio saudavel entre confiabilidade e inovacao.',
      reference: 'Conceito relacionado: sre-principles — error budget policy define acoes baseadas no budget restante.'
    },
    {
      question: 'Qual e o burn rate e por que e usado em alertas de SLO?',
      options: [
        'E a velocidade com que o error budget esta sendo consumido; um burn rate de 1 significa consumo normal ao longo da janela do SLO',
        'E a taxa de erros por segundo',
        'E o percentual de CPU consumido pelo servico',
        'E a velocidade de deploy de novas versoes'
      ],
      correct: 0,
      explanation: 'Burn rate mede a velocidade de consumo do error budget em relacao ao esperado. Burn rate 1 = consumo uniforme (budget dura a janela inteira). Burn rate 14.4 = budget sera esgotado em ~2 horas. Alertas baseados em burn rate sao mais eficazes que alertas baseados em taxa de erro simples.',
      reference: 'Conceito relacionado: sre-principles — alertas de burn rate sao implementados como PrometheusRules.'
    },
    {
      question: 'Qual a diferenca entre rolling window e calendar window para medicao de SLOs?',
      options: [
        'Rolling window e fixa, calendar window e movel',
        'Rolling window usa os ultimos N dias continuamente (ex: ultimos 30 dias), calendar window usa periodos fixos (ex: mes corrente)',
        'Nao ha diferenca pratica',
        'Rolling window e para SLAs, calendar window e para SLOs'
      ],
      correct: 1,
      explanation: 'Rolling window (janela movel) considera sempre os ultimos N dias — a cada momento o calculo muda. Calendar window (janela fixa) reseta no inicio de cada periodo (ex: dia 1 do mes). Rolling window e mais suave e recomendada para SLOs internos; calendar window e mais comum em SLAs contratuais.',
      reference: 'Conceito relacionado: sre-principles — a maioria dos times SRE usa rolling window de 30 dias.'
    },
    {
      question: 'Qual SLI seria mais apropriado para medir a experiencia do usuario em um servico de API REST?',
      options: [
        'Utilizacao de CPU dos pods',
        'Disponibilidade (requisicoes 2xx / total) e latencia (p99 < target)',
        'Numero total de pods rodando',
        'Tamanho do disco usado pelo banco de dados'
      ],
      correct: 1,
      explanation: 'SLIs devem refletir a experiencia do usuario. Para uma API REST, disponibilidade (% de requisicoes bem-sucedidas) e latencia (tempo de resposta) sao os SLIs mais relevantes. CPU, disco e contagem de pods sao metricas de infraestrutura uteis para troubleshooting, mas nao medem diretamente a experiencia do usuario.',
      reference: 'Conceito relacionado: sre-observability — SLIs se integram com a estrategia de observabilidade do servico.'
    },
    {
      question: 'O que deve acontecer quando o error budget e totalmente consumido?',
      options: [
        'Nada — o error budget e apenas informativo',
        'O servico deve ser desligado automaticamente',
        'Segundo a error budget policy, deve haver feature freeze com foco total em melhorias de confiabilidade',
        'O SLO deve ser reduzido automaticamente'
      ],
      correct: 2,
      explanation: 'Quando o error budget e esgotado, a error budget policy entra em vigor: feature freeze (sem novos deploys de features), foco total em melhorias de confiabilidade, e apenas releases criticas (hotfixes de seguranca). Isso garante que o time priorize confiabilidade ate o budget se recuperar.',
      reference: 'Conceito relacionado: sre-incident-mgmt — incidentes que consomem error budget devem ter postmortems.'
    }
  ],
  flashcards: [
    {
      front: 'SLI vs SLO vs SLA — qual a diferenca?',
      back: '**SLI (Service Level Indicator):**\nMetrica quantitativa medida\nEx: % requisicoes com sucesso\n\n**SLO (Service Level Objective):**\nAlvo interno para o SLI\nEx: 99.9% disponibilidade em 30 dias\n\n**SLA (Service Level Agreement):**\nContrato formal com consequencias\nEx: 99.9% ou credito de 10%\n\n**Regra pratica:**\nSLA < SLO < Capacidade real\nSLA: 99.9% | SLO: 99.95% | Real: 99.98%'
    },
    {
      front: 'O que e Error Budget e como calcular?',
      back: '**Formula:**\nError Budget = 100% - SLO\n\n**Exemplo (SLO 99.9%, 30 dias):**\n- Budget = 0.1% = 43.2 min de downtime\n- Ou: 1.000 erros em 1M requisicoes\n\n**Policy tipica:**\n- Budget > 50%: releases normais\n- Budget 20-50%: cautela\n- Budget < 20%: apenas releases criticas\n- Budget = 0%: feature freeze\n\n**Burn rate:** velocidade de consumo\n- 1x = consumo normal\n- 14.4x = budget acaba em ~2h'
    },
    {
      front: 'O que e Toil e qual a meta?',
      back: '**Definicao:** Trabalho operacional que e:\n- Manual (humano executa)\n- Repetitivo (mesma tarefa varias vezes)\n- Automatizavel (maquina poderia fazer)\n- Sem valor duradouro (tatico)\n- Cresce com o servico (O(n))\n\n**Exemplos de toil:**\n- Restart manual de pods\n- Rotacao manual de certs\n- Escalar servicos manualmente\n- Criar tickets repetitivos\n\n**Meta Google SRE:** max 50% do tempo em toil\n**Times maduros:** < 30%'
    },
    {
      front: 'Como implementar SLIs com Prometheus?',
      back: '**Recording rule para disponibilidade:**\n```\nrecord: sli:http_requests:availability\nexpr: |\n  sum(rate(http_requests_total{code!~"5.."}[5m]))\n  /\n  sum(rate(http_requests_total[5m]))\n```\n\n**Recording rule para latencia:**\n```\nrecord: sli:http_requests:latency_good\nexpr: |\n  sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))\n  /\n  sum(rate(http_request_duration_seconds_count[5m]))\n```\n\n**Error budget restante:**\n```\n1 - ((1 - sli:availability) / (1 - 0.999))\n```'
    },
    {
      front: 'SLIs recomendados por tipo de servico?',
      back: '**API/HTTP:**\n- Disponibilidade (% 2xx)\n- Latencia (p50, p95, p99)\n- Taxa de erro (% 5xx)\n\n**Pipeline de dados:**\n- Freshness (dados atualizados em < X)\n- Correctness (% respostas corretas)\n- Throughput (registros/segundo)\n\n**Storage:**\n- Durabilidade (% dados nao perdidos)\n- Latencia de leitura/escrita\n- Disponibilidade\n\n**Streaming:**\n- Throughput (mensagens/segundo)\n- Latencia end-to-end\n- Taxa de perda de mensagens'
    },
    {
      front: 'Burn rate alerting — como funciona?',
      back: '**Conceito:**\nBurn rate = velocidade de consumo do error budget\nrelativa ao consumo uniforme esperado\n\n**Valores de referencia:**\n- 1x = consome todo o budget na janela\n- 14.4x = consome em ~2h (alerta critical)\n- 6x = consome em ~5h (alerta warning)\n- 3x = consome em ~10h (ticket)\n- 1x = ritmo normal\n\n**Multi-window approach (Google SRE):**\n```\nalert: short window (1h) + long window (6h)\n  14.4x burn em 1h E 14.4x em 6h → page\n  6x burn em 6h E 6x em 3d → ticket\n```\n\nEvita falsos positivos de spikes curtos.'
    },
    {
      front: 'Os 7 pilares do Google SRE?',
      back: '1. **Abracar o risco** — usar error budgets\n   para equilibrar confiabilidade e velocidade\n\n2. **SLOs** — metricas objetivas de\n   confiabilidade como base de decisoes\n\n3. **Eliminar toil** — automatizar trabalho\n   repetitivo (meta: < 50% do tempo)\n\n4. **Monitoramento** — observabilidade com\n   metricas, logs e traces\n\n5. **Automacao** — reduzir intervencao humana\n   progressivamente\n\n6. **Release engineering** — deploys seguros,\n   reproduziveis e automatizados\n\n7. **Simplicidade** — sistemas mais simples\n   sao mais confiaveis'
    }
  ],
  lab: {
    scenario: 'Voce e o novo SRE de um time que opera uma API REST em Kubernetes. O servico nao tem SLOs definidos e o time nao sabe quanto downtime e aceitavel.',
    objective: 'Definir SLIs e SLOs para o servico, calcular error budget, e configurar recording rules e alertas no Prometheus.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Recording Rules para SLIs',
        instruction: `Crie PrometheusRules com recording rules para medir SLIs de disponibilidade e latencia.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: sli-recording-rules
  namespace: monitoring
  labels:
    release: prometheus
spec:
  groups:
    - name: sli.rules
      interval: 30s
      rules:
        # SLI: Disponibilidade (requisicoes nao-5xx / total)
        - record: sli:http_requests:availability_rate5m
          expr: |
            sum(rate(http_requests_total{code!~"5.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))

        # SLI: Latencia (requisicoes < 500ms / total)
        - record: sli:http_requests:latency_good_rate5m
          expr: |
            sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))
            /
            sum(rate(http_request_duration_seconds_count[5m]))

        # SLI: Disponibilidade rolling 30d
        - record: sli:http_requests:availability_30d
          expr: |
            avg_over_time(sli:http_requests:availability_rate5m[30d])
EOF
\`\`\``,
        hints: [
          'Recording rules pre-calculam metricas para consultas rapidas',
          'Use rate() com janela de 5m para suavizar spikes',
          'avg_over_time com [30d] calcula a media na janela do SLO'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: sli-recording-rules
  namespace: monitoring
  labels:
    release: prometheus
spec:
  groups:
    - name: sli.rules
      interval: 30s
      rules:
        - record: sli:http_requests:availability_rate5m
          expr: |
            sum(rate(http_requests_total{code!~"5.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))
        - record: sli:http_requests:latency_good_rate5m
          expr: |
            sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))
            /
            sum(rate(http_request_duration_seconds_count[5m]))
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o PrometheusRule foi criado
kubectl get prometheusrule sli-recording-rules -n monitoring
# Saida esperada: NAME                    AGE
#                 sli-recording-rules     Xs

# Verificar conteudo
kubectl get prometheusrule sli-recording-rules -n monitoring -o jsonpath='{.spec.groups[0].rules[*].record}'
# Saida esperada: sli:http_requests:availability_rate5m sli:http_requests:latency_good_rate5m sli:http_requests:availability_30d
\`\`\``
      },
      {
        title: 'Configurar Error Budget e Burn Rate Alerts',
        instruction: `Crie alertas baseados em burn rate para detectar consumo rapido do error budget (SLO: 99.9%).

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: slo-burn-rate-alerts
  namespace: monitoring
  labels:
    release: prometheus
spec:
  groups:
    - name: slo.burn-rate
      rules:
        # Error budget restante (SLO 99.9%)
        - record: slo:availability:error_budget_remaining
          expr: |
            1 - (
              (1 - sli:http_requests:availability_30d)
              /
              (1 - 0.999)
            )

        # Alerta: burn rate critico (14.4x = budget esgota em ~2h)
        - alert: SLOBurnRateCritical
          expr: |
            (
              1 - sli:http_requests:availability_rate5m
            ) / (1 - 0.999) > 14.4
          for: 5m
          labels:
            severity: critical
            slo: availability
          annotations:
            summary: "Burn rate critico: error budget sera esgotado em ~2 horas"
            description: "O servico esta consumindo error budget 14.4x mais rapido que o normal"

        # Alerta: burn rate alto (6x = budget esgota em ~5h)
        - alert: SLOBurnRateHigh
          expr: |
            (
              1 - sli:http_requests:availability_rate5m
            ) / (1 - 0.999) > 6
          for: 15m
          labels:
            severity: warning
            slo: availability
          annotations:
            summary: "Burn rate alto: error budget sera esgotado em ~5 horas"
EOF
\`\`\``,
        hints: [
          'Burn rate 14.4 significa que o budget de 30 dias sera consumido em ~2 horas',
          'Use "for" para evitar alertas por spikes curtos',
          'O calculo e: taxa de erro real / taxa de erro permitida'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: slo-burn-rate-alerts
  namespace: monitoring
  labels:
    release: prometheus
spec:
  groups:
    - name: slo.burn-rate
      rules:
        - record: slo:availability:error_budget_remaining
          expr: |
            1 - ((1 - sli:http_requests:availability_30d) / (1 - 0.999))
        - alert: SLOBurnRateCritical
          expr: |
            (1 - sli:http_requests:availability_rate5m) / (1 - 0.999) > 14.4
          for: 5m
          labels:
            severity: critical
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o PrometheusRule foi criado
kubectl get prometheusrule slo-burn-rate-alerts -n monitoring
# Saida esperada: NAME                     AGE
#                 slo-burn-rate-alerts     Xs

# Verificar alertas definidos
kubectl get prometheusrule slo-burn-rate-alerts -n monitoring -o jsonpath='{.spec.groups[0].rules[*].alert}' | tr ' ' '\\n'
# Saida esperada:
# SLOBurnRateCritical
# SLOBurnRateHigh
\`\`\``
      },
      {
        title: 'Documentar Error Budget Policy',
        instruction: `Crie um ConfigMap documentando a Error Budget Policy do time.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: error-budget-policy
  namespace: production
  labels:
    team: platform
    type: sre-policy
data:
  policy.md: |
    # Error Budget Policy — API Service

    ## SLO: 99.9% availability (rolling 30 days)
    ## Error Budget: 43.2 minutes/month

    ### Actions by Budget Level:

    **Budget > 50% remaining:**
    - Normal release cadence
    - Feature development proceeds
    - Experiments allowed

    **Budget 20-50% remaining:**
    - Increased review for risky changes
    - No experiments on production
    - Postmortem any incident > 5min

    **Budget < 20% remaining:**
    - Only critical bugfixes and security patches
    - All changes require SRE approval
    - Daily error budget review

    **Budget exhausted (0%):**
    - Complete feature freeze
    - All engineering effort on reliability
    - Executive review required to resume releases

    ## Review: Monthly SLO review meeting
    ## Owner: SRE Team Lead
EOF
\`\`\``,
        hints: [
          'Error budget policies devem ser claras e acordadas entre SRE e dev',
          'O ConfigMap pode ser referenciado em runbooks e dashboards',
          'Policies devem ter owner e cadencia de revisao definidos'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: error-budget-policy
  namespace: production
data:
  policy.md: |
    # Error Budget Policy
    ## SLO: 99.9% availability
    ## Budget: 43.2 min/month
    ## Actions: freeze at 0%, cautious at <20%
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o ConfigMap foi criado
kubectl get cm error-budget-policy -n production
# Saida esperada: NAME                   DATA   AGE
#                 error-budget-policy    1      Xs

# Verificar conteudo
kubectl get cm error-budget-policy -n production -o jsonpath='{.data.policy\\.md}' | head -5
# Saida esperada: linhas do policy.md
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Error Budget consumido sem incidentes visiveis',
      difficulty: 'medium',
      symptom: 'O error budget esta sendo consumido mas nao houve nenhum incidente reportado. O time nao entende de onde vem o consumo.',
      diagnosis: `\`\`\`bash
# Verificar taxa de erro real
curl -s 'http://prometheus:9090/api/v1/query?query=1-sli:http_requests:availability_rate5m'

# Verificar quais endpoints tem mais erros
curl -s 'http://prometheus:9090/api/v1/query?query=topk(5,sum(rate(http_requests_total{code=~"5.."}[1h]))by(handler))'

# Verificar se ha erros intermitentes
kubectl logs -n production -l app=api-service --since=1h | grep -c "ERROR"

# Verificar health checks
kubectl get pods -n production -o wide | grep -v Running
\`\`\``,
      solution: `**Causas comuns:**

1. **Erros intermitentes (flapping):** Pods reiniciando ou health checks falhando geram erros 5xx curtos que nao disparam alertas de incidente mas acumulam no error budget:
\`\`\`bash
# Verificar restarts
kubectl get pods -n production --sort-by='.status.containerStatuses[0].restartCount'
\`\`\`

2. **Endpoints esquecidos:** APIs deprecated ou endpoints de health com alta taxa de chamada podem ter erros nao monitorados. Revise todos os endpoints.

3. **Upstream dependencies:** Erros vindo de servicos upstream (database timeouts, cache misses) geram 5xx no seu servico.

4. **SLI mal definido:** O SLI pode estar capturando trafego que nao deveria (ex: bots, health checks internos). Filtre adequadamente:
\`\`\`
# Filtrar health checks do SLI
sum(rate(http_requests_total{code!~"5..",handler!="/healthz"}[5m]))
\`\`\``
    },
    {
      title: 'SLO definido mas sem impacto nas decisoes do time',
      difficulty: 'easy',
      symptom: 'O time tem SLOs definidos mas eles nao influenciam decisoes de prioridade. Releases continuam normalmente mesmo quando o error budget esta baixo.',
      diagnosis: `\`\`\`bash
# Verificar se recording rules existem
kubectl get prometheusrule -n monitoring | grep sli

# Verificar se alertas de SLO existem
kubectl get prometheusrule -n monitoring | grep slo

# Verificar se ha dashboard de error budget
kubectl get cm -n monitoring | grep slo

# Verificar se error budget policy existe
kubectl get cm -n production | grep budget
\`\`\``,
      solution: `**Acoes necessarias:**

1. **Visibilidade:** Crie um dashboard de error budget prominente — visivel em reunioes de sprint e stand-ups.

2. **Error Budget Policy:** Documente a politica formalmente e tenha sign-off da lideranca:
   - Quem decide o freeze?
   - Quais excecoes existem?
   - Como escalar?

3. **Alertas proativos:** Configure alertas de burn rate que notifiquem antes do budget acabar (20%, 50%).

4. **Reunioes de SLO:** Agende revisao mensal de SLO compliance com product + engineering.

5. **Integracao no pipeline:** Adicione gate de error budget no CI/CD — bloquear deploy automaticamente quando budget < 20%.

6. **Accountability:** Inclua SLO compliance nas metricas do time.`
    },
    {
      title: 'Recording rules do Prometheus nao calculando SLIs',
      difficulty: 'medium',
      symptom: 'As recording rules para SLIs foram criadas mas retornam "no data" ou valores incorretos no Prometheus.',
      diagnosis: `\`\`\`bash
# Verificar se o PrometheusRule foi detectado
kubectl get prometheusrule -n monitoring -l release=prometheus

# Verificar logs do Prometheus por erros de config
kubectl logs -n monitoring -l app.kubernetes.io/name=prometheus --tail=30 | grep -i "error\\|warn"

# Verificar se as metricas base existem
curl -s 'http://prometheus:9090/api/v1/query?query=http_requests_total' | jq '.data.result | length'

# Verificar label do PrometheusRule
kubectl get prometheusrule sli-recording-rules -n monitoring -o jsonpath='{.metadata.labels}'
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Label selector errado:** O Prometheus Operator usa label selectors para descobrir PrometheusRules. Verifique qual label e esperado:
\`\`\`bash
# Ver qual selector o Prometheus usa
kubectl get prometheus -n monitoring -o jsonpath='{.items[0].spec.ruleSelector}'
# Ajustar labels do PrometheusRule para corresponder
\`\`\`

2. **Metrica base nao existe:** Se a aplicacao nao exporta \`http_requests_total\`, a recording rule retorna "no data":
\`\`\`bash
# Listar metricas disponiveis
curl -s 'http://prometheus:9090/api/v1/label/__name__/values' | jq '.data[]' | grep http
\`\`\`

3. **Namespace errado:** PrometheusRule deve estar no namespace monitorado.

4. **Divisao por zero:** Se nao ha trafego, o denominador e 0. Use \`or vector(0)\` para proteger:
\`\`\`
(sum(rate(http_requests_total{code!~"5.."}[5m])) or vector(0))
/
(sum(rate(http_requests_total[5m])) > 0)
\`\`\``
    }
  ]
};
