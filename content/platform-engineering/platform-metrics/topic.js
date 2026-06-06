window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['platform-engineering/platform-metrics'] = {
  theory: `# Platform Metrics: DORA, SPACE & Developer Experience

## Relevancia
> Platform engineers precisam **provar valor**: a plataforma reduziu lead time? Aumentou a frequencia de deploy? Diminuiu o atrito? Sem metricas voce gerencia por opiniao. DORA e SPACE sao os dois frameworks de referencia da industria e aparecem em entrevistas de Staff/Principal e em conversas com lideranca sobre investimento na plataforma.

## DORA Metrics — O Padrao da Industria

Desenvolvidas pelo programa **DORA (DevOps Research and Assessment)** do Google, estas 4 metricas separam consistentemente times de alto e baixo desempenho. O insight central: **velocidade e estabilidade NAO sao trade-off** — times de elite tem as duas.

| Metrica | O que mede | Categoria | Elite | High | Medium | Low |
|---------|-----------|-----------|-------|------|--------|-----|
| **Deployment Frequency** | Com que frequencia implanta em producao | Throughput | Multiplas/dia | 1x/sem-1x/mes | 1x/mes-1x/6m | < 6 meses |
| **Lead Time for Changes** | Do commit ate rodar em producao | Throughput | < 1 hora | 1 dia-1 sem | 1 sem-1 mes | > 6 meses |
| **Change Failure Rate** | % de deploys que causam incidente | Estabilidade | < 5% | 5-10% | 10-15% | > 15% |
| **Time to Restore (MTTR)** | Tempo para recuperar de um incidente | Estabilidade | < 1 hora | < 1 dia | 1 dia-1 sem | > 6 meses |

> **Em 2023 o DORA adicionou uma 5a metrica: Reliability** (o quanto o servico cumpre as expectativas dos usuarios — disponibilidade, performance), reconhecendo que velocidade sem confiabilidade nao e sustentavel.

### Por que essas 4?
- **Throughput (DF + LT)** mede quao rapido valor chega ao usuario.
- **Estabilidade (CFR + MTTR)** mede a qualidade do fluxo de entrega.
- Medir so um lado leva a comportamento ruim: otimizar so velocidade gera instabilidade; otimizar so estabilidade gera paralisia.

### Coletando DORA com Prometheus
\`\`\`promql
# Deployment Frequency (deploys de producao nos ultimos 7 dias)
sum(increase(deployments_total{environment="production"}[7d]))

# Change Failure Rate (% de deploys que falharam)
sum(rate(deployments_total{status="failed",environment="production"}[7d]))
/ sum(rate(deployments_total{environment="production"}[7d])) * 100

# MTTR (media de tempo de resolucao de incidentes, em minutos)
avg(incident_resolution_duration_seconds{severity!="low"}) / 60

# Lead Time (P50 do tempo commit -> producao, via labels do pipeline)
histogram_quantile(0.5, sum(rate(pipeline_lead_time_seconds_bucket[30d])) by (le))
\`\`\`

Ferramentas prontas: **DevLake (Apache)**, **Four Keys (Google)**, **dora-metrics exporter**, ou o proprio **Backstage** (plugin DORA). Todas correlacionam eventos de CI/CD (deploys) com incidentes (PagerDuty/Opsgenie).

## Framework SPACE — Indo Alem do DORA

DORA mede o **sistema de entrega**. SPACE (criado por Nicole Forsgren et al., 2021) mede a **produtividade de desenvolvimento de forma holistica**, reconhecendo que produtividade nao e uma unica dimensao. A regra de ouro: **escolha pelo menos 1 metrica de 3 dimensoes diferentes**, e sempre combine **percepcao (surveys)** com **dados do sistema**.

| Dimensao | O que captura | Exemplos de metricas |
|----------|---------------|----------------------|
| **S — Satisfaction & wellbeing** | Quao satisfeitos e saudaveis estao os devs | Developer NPS/eNPS, burnout score, retencao |
| **P — Performance** | Resultado/qualidade do trabalho | Change Failure Rate, qualidade de PR, MTTR, SLOs cumpridos |
| **A — Activity** | Volume de acoes (cuidado: volume != valor) | Commits, PRs, builds, deploys, tickets fechados |
| **C — Communication & collaboration** | Como o time trabalha junto | PR review time, descoberta de docs, onboarding time |
| **E — Efficiency & flow** | Capacidade de fluir sem interrupcao | Wait time, WIP, % de tempo em deep work, handoffs |

### Por que NAO medir so Activity
Activity (commits/PRs) e a metrica mais facil de coletar e a mais perigosa isolada: um time com muito **retrabalho** gera mais commits; impor PRs minusculas infla a contagem de PRs. SPACE existe justamente para evitar que "ocupado" seja confundido com "produtivo". **Activity sozinha vira meta gamificavel** (Lei de Goodhart).

## Platform Health & Adoption Metrics

Alem de medir os times-cliente, a plataforma precisa medir a **propria saude e adocao** (ela e um produto):
\`\`\`promql
# Adoption rate: % de namespaces usando o golden path
count(kube_namespace_labels{label_platform_version!=""})
/ count(kube_namespace_created) * 100

# Self-service success rate (templates do portal que concluiram sem ticket)
sum(rate(backstage_scaffold_task_completed_total[7d]))
/ sum(rate(backstage_scaffold_task_created_total[7d])) * 100

# Time to first deploy (mediana, novo dev -> primeiro deploy em prod)
histogram_quantile(0.5, sum(rate(onboarding_first_deploy_seconds_bucket[90d])) by (le))

# Tickets manuais abertos contra a plataforma (queremos isso caindo)
sum(increase(platform_support_tickets_total[30d]))
\`\`\`

### Developer Experience Survey (trimestral)
Metricas de sistema nao capturam atrito percebido. Combine com survey curta (escala 1-5):
\`\`\`yaml
perguntas:
  - "Consigo fazer deploy sem depender de outra equipe? (1-5)"
  - "O tempo de build do meu projeto e aceitavel? (1-5)"
  - "Sei onde encontrar a documentacao de que preciso? (1-5)"
  - "A plataforma me ajuda a cumprir seguranca sem atrito? (1-5)"
  - "O que mais te frustra na plataforma hoje? (aberta)"
\`\`\`

## Erros Comuns em Platform Metrics
1. **Medir so atividade**: numero de commits/PRs nao indica produtividade — mais retrabalho = mais commits.
2. **Gamificar metricas**: quando o time sabe que e medido por deployment frequency, comeca a fazer deploys triviais (Lei de Goodhart: "quando uma medida vira meta, deixa de ser boa medida").
3. **Ignorar o qualitativo**: DORA sem developer survey e cego para o atrito real do dia a dia.
4. **Sem baseline**: antes de melhorar, meca onde voce esta. Sem baseline nao ha como provar melhoria nem justificar investimento.
5. **Vaidade vs acionavel**: "10k commits/mes" e vanity metric; "lead time caiu de 3 dias para 4 horas" e acionavel e ligado a resultado de negocio.
6. **Comparar times entre si**: DORA/SPACE servem para um time medir sua **propria** evolucao no tempo, nao para ranking entre equipes (gera disfuncao).

## Killer.sh Style Challenge
A lideranca quer um dashboard que prove que a nova plataforma melhorou a entrega. Voce tem Prometheus + Grafana no cluster. Defina: (1) quais das 4 metricas DORA voce instrumenta primeiro e de onde vem cada evento (deploy, incidente); (2) uma metrica SPACE de **percepcao** para complementar; (3) uma metrica de **adocao** da plataforma. Implemente as queries PromQL e monte um painel com baseline (mes 0) vs atual, defendendo por que cada metrica e acionavel e nao vanity.`,
  quiz: [
    {
      question: 'Quais das 4 metricas DORA medem ESTABILIDADE (nao throughput)?',
      options: [
        'Deployment Frequency e Lead Time for Changes',
        'Change Failure Rate e Time to Restore (MTTR)',
        'Lead Time for Changes e Time to Restore',
        'Deployment Frequency e Change Failure Rate'
      ],
      correct: 1,
      explanation: 'DORA divide as metricas em throughput (Deployment Frequency, Lead Time) e estabilidade (Change Failure Rate, MTTR). O insight central e que times de elite sao rapidos E estaveis ao mesmo tempo — velocidade e estabilidade nao sao trade-off.',
      reference: 'Tabela DORA Metrics — coluna Categoria separa Throughput de Estabilidade.'
    },
    {
      question: 'Um time tem Change Failure Rate de 25%. O que isso indica e qual nivel DORA?',
      options: [
        '25% dos deploys falham; nivel Elite (aceitavel para frequencia alta)',
        '25% dos deploys causam incidente em producao; nivel Low (acima do limite de 15%)',
        '25% das mudancas chegam com atraso; nivel Medium',
        'CFR de 25% esta dentro do aceitavel para times grandes'
      ],
      correct: 1,
      explanation: 'CFR > 15% e classificado como Low. Significa que 1 em cada 4 deploys causa incidente que exige hotfix/rollback — sintoma de falta de testes automatizados, ausencia de canary/feature flags ou review insuficiente. A meta Elite e < 5%.',
      reference: 'Tabela DORA Metrics — CFR ideal < 5% (Elite), Low e > 15%.'
    },
    {
      question: 'Por que medir apenas metricas de Activity (commits, PRs) e insuficiente e ate perigoso?',
      options: [
        'Porque commits e PRs nao aparecem no JIRA automaticamente',
        'Porque volume nao e valor: retrabalho gera mais commits, e Activity isolada vira meta gamificavel (Lei de Goodhart)',
        'Porque metricas de atividade so podem ser coletadas por gerentes',
        'Porque ferramentas de medicao de commits sao caras'
      ],
      correct: 1,
      explanation: 'Activity mede volume, nao valor. Um time com bugs reescreve codigo (mais commits); PRs impostas finas inflam a contagem. SPACE inclui Activity como apenas 1 de 5 dimensoes justamente para evitar confundir "ocupado" com "produtivo".',
      reference: 'Secao Framework SPACE — Por que NAO medir so Activity.'
    },
    {
      question: 'Qual a regra pratica recomendada ao usar o framework SPACE?',
      options: [
        'Medir as 5 dimensoes com uma unica metrica de sistema cada',
        'Escolher ao menos 1 metrica de 3 dimensoes diferentes, combinando percepcao (survey) com dados do sistema',
        'Usar apenas a dimensao Performance, pois engloba as outras',
        'Substituir DORA inteiramente, pois SPACE e superior'
      ],
      correct: 1,
      explanation: 'SPACE recomenda cobrir pelo menos 3 dimensoes diferentes e sempre cruzar dados objetivos (sistema) com percepcao (surveys). Nao se trata de coletar tudo, mas de evitar um retrato unidimensional da produtividade.',
      reference: 'Secao Framework SPACE — a regra de ouro de 3 dimensoes + percepcao.'
    },
    {
      question: 'O que a 5a metrica adicionada ao DORA em 2023, Reliability, captura?',
      options: [
        'A frequencia com que o time faz deploy em producao',
        'O quanto o servico cumpre as expectativas dos usuarios (disponibilidade, performance, SLOs)',
        'O custo de infraestrutura por deploy',
        'O numero de desenvolvedores por equipe'
      ],
      correct: 1,
      explanation: 'Reliability mede o quanto o servico atende as expectativas operacionais dos usuarios (disponibilidade, latencia, cumprimento de SLO). Foi adicionada para reconhecer que throughput e estabilidade de entrega nao bastam se o servico em si nao e confiavel.',
      reference: 'Secao DORA Metrics — nota sobre a 5a metrica (2023).'
    },
    {
      question: 'O que e a Lei de Goodhart no contexto de platform metrics?',
      options: [
        'Quanto mais metricas voce coleta, mais precisa fica a avaliacao',
        'Quando uma medida vira meta, ela deixa de ser uma boa medida (o time otimiza o numero, nao o resultado)',
        'Metricas de estabilidade sempre superam metricas de velocidade',
        'O custo de coletar metricas cresce linearmente com o numero de times'
      ],
      correct: 1,
      explanation: 'A Lei de Goodhart explica por que gamificar metricas e perigoso: ao transformar deployment frequency em meta, o time faz deploys triviais para "bater o numero", destruindo o valor informativo da metrica. Por isso metricas devem informar conversas, nao virar targets isolados.',
      reference: 'Secao Erros Comuns — item 2 (gamificar metricas).'
    },
    {
      question: 'Para uma plataforma interna (tratada como produto), qual metrica mede ADOCAO de forma acionavel?',
      options: [
        'Numero total de pods rodando no cluster',
        '% de namespaces usando o golden path vs total de namespaces',
        'Quantidade de CPU consumida pelo Prometheus',
        'Numero de engenheiros na equipe de plataforma'
      ],
      correct: 1,
      explanation: 'Adoption rate (namespaces no golden path / total) mostra se os times realmente usam a plataforma. E acionavel: se a adocao esta baixa, investiga-se atrito ou falta de funcionalidade. Total de pods ou CPU do Prometheus sao vanity metrics, nao medem adocao.',
      reference: 'Secao Platform Health & Adoption Metrics — query de adoption rate.'
    }
  ],
  flashcards: [
    { front: 'Quais sao as 4 metricas DORA e suas metas Elite?', back: 'Deployment Frequency (multiplas/dia), Lead Time for Changes (< 1h), Change Failure Rate (< 5%), Time to Restore/MTTR (< 1h). Throughput = DF+LT; Estabilidade = CFR+MTTR.' },
    { front: 'Velocidade e estabilidade sao trade-off?', back: 'Nao. O achado central do DORA e que times de elite tem ambos ao mesmo tempo — quem entrega rapido com qualidade tambem se recupera rapido. Otimizar so um lado degrada o outro.' },
    { front: 'O que significa SPACE e qual a regra de uso?', back: 'Satisfaction, Performance, Activity, Communication/collaboration, Efficiency/flow. Regra: escolha >=1 metrica de 3 dimensoes diferentes e combine survey (percepcao) com dados de sistema.' },
    { front: 'Por que Activity isolada e uma ma metrica?', back: 'Volume != valor. Retrabalho gera mais commits; PRs finas impostas inflam contagem. Isolada vira meta gamificavel (Lei de Goodhart). E so 1 das 5 dimensoes do SPACE.' },
    { front: 'Como medir o impacto da plataforma na DevEx?', back: 'Quantitativo: time-to-first-deploy, self-service success rate, adoption rate, tickets de suporte caindo. Qualitativo: developer NPS, survey trimestral 1-5, numero de workarounds. Combine os dois.' },
    { front: 'O que e a Lei de Goodhart e por que importa em metricas?', back: '"Quando uma medida vira meta, deixa de ser uma boa medida." Por isso DORA/SPACE devem informar conversas e medir a evolucao do proprio time no tempo — nunca virar target gamificavel nem ranking entre times.' }
  ],
  lab: {
    scenario: 'Voce tem um cluster com kube-prometheus-stack (Prometheus + Grafana) instalado. A lideranca quer ver DORA metrics. Voce vai expor eventos de deploy como metricas, simular deploys com sucesso e falha, e montar as queries que alimentam um painel.',
    objective: 'Instrumentar Deployment Frequency e Change Failure Rate a partir de eventos reais de deploy do cluster, escrever as queries PromQL e validar os resultados no Prometheus.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Instalar o stack de observabilidade (Prometheus + Grafana)',
        instruction: 'Instale o kube-prometheus-stack via Helm e confirme que Prometheus e Grafana estao Running. Esse stack ja traz o Pushgateway opcional para metricas de batch/eventos.',
        hints: ['Repo Helm: https://prometheus-community.github.io/helm-charts', 'Habilite o pushgateway com --set prometheus-pushgateway.enabled=true', 'kubectl get pods -n monitoring'],
        solution: '```bash\nhelm repo add prometheus-community https://prometheus-community.github.io/helm-charts\nhelm repo update\nhelm install kps prometheus-community/kube-prometheus-stack \\\n  --namespace monitoring --create-namespace \\\n  --set prometheus-pushgateway.enabled=true\n\nkubectl get pods -n monitoring\n```',
        verify: '```bash\nkubectl get pods -n monitoring | grep -E "prometheus|grafana|pushgateway"\n# Saida esperada: pods prometheus, grafana e pushgateway em Running\nkubectl get svc -n monitoring | grep pushgateway\n# Saida esperada: service do pushgateway (porta 9091)\n```'
      },
      {
        title: 'Emitir um evento de deploy como metrica (Deployment Frequency)',
        instruction: 'Use o Pushgateway para registrar um evento de deploy de producao bem-sucedido como a metrica `deployments_total`. Em producao isso viria do seu pipeline CI/CD; aqui voce simula via curl.',
        hints: ['Pushgateway aceita POST em /metrics/job/<job>', 'Use labels environment e status na metrica', 'port-forward do service pushgateway para localhost:9091'],
        solution: '```bash\nkubectl port-forward -n monitoring svc/kps-prometheus-pushgateway 9091:9091 &\nsleep 3\n\n# Registrar um deploy de producao com SUCESSO\ncat <<EOF | curl --data-binary @- http://localhost:9091/metrics/job/deploy/env/production/status/success\n# TYPE deployments_total counter\ndeployments_total 1\nEOF\n\n# Conferir no Pushgateway\ncurl -s http://localhost:9091/metrics | grep deployments_total\n```',
        verify: '```bash\ncurl -s http://localhost:9091/metrics | grep \'deployments_total\'\n# Saida esperada: deployments_total{...environment...status="success"...} 1\n```'
      },
      {
        title: 'Simular deploys com falha e calcular Change Failure Rate',
        instruction: 'Registre mais alguns deploys (incluindo uma falha) e escreva a query PromQL de Change Failure Rate. Valide o resultado consultando o Prometheus.',
        hints: ['Repita o push com status/failed para um deploy ruim', 'CFR = failed / total * 100', 'Consulte a API do Prometheus em /api/v1/query'],
        solution: '```bash\n# 3 deploys com sucesso + 1 com falha\nfor i in 1 2 3; do\n  echo \'deployments_total 1\' | curl --data-binary @- \\\n    http://localhost:9091/metrics/job/deploy/env/production/status/success\ndone\necho \'deployments_total 1\' | curl --data-binary @- \\\n  http://localhost:9091/metrics/job/deploy/env/production/status/failed\n\n# port-forward do Prometheus\nkubectl port-forward -n monitoring svc/kps-kube-prometheus-stack-prometheus 9090:9090 &\nsleep 3\n\n# Query de Change Failure Rate (%)\ncurl -s \'http://localhost:9090/api/v1/query\' --data-urlencode \\\n  \'query=sum(deployments_total{status=\"failed\"}) / sum(deployments_total) * 100\'\n```',
        verify: '```bash\ncurl -s \'http://localhost:9090/api/v1/query\' --data-urlencode \\\n  \'query=sum(deployments_total{status=\"failed\"}) / sum(deployments_total) * 100\' | grep -o \'\"value\".*\'\n# Saida esperada: valor proximo de 25 (1 falha em 4 deploys = CFR 25%)\n```'
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Alta Deployment Frequency mas MTTR tambem alto',
      difficulty: 'medium',
      symptom: 'O time tem DF de 5x/dia (Elite) mas MTTR medio de 4 horas (Low). A lideranca questiona se a velocidade esta causando instabilidade.',
      diagnosis: '```promql\n# Correlacionar deploys com incidentes na mesma janela\nrate(deployments_total{environment="production"}[1h])\nrate(incidents_created_total[1h])\n\n# Conferir o Change Failure Rate\nsum(rate(deployments_total{status="failed"}[30d]))\n/ sum(rate(deployments_total[30d])) * 100\n```',
      solution: 'Alta DF com alto MTTR geralmente significa: (1) deploys sem canary/feature flags (cada deploy atinge 100% dos usuarios de uma vez), (2) ausencia de smoke tests pos-deploy (falha demora a ser detectada), (3) rollback manual e lento. Acoes: implementar canary (10% primeiro), smoke tests automaticos com rollback automatico, runbook de rollback testado (meta < 15 min) e alerta de error rate com threshold para disparar rollback. Objetivo: manter a frequencia alta E baixar MTTR para < 1h.'
    },
    {
      title: 'Metricas SPACE de Activity sobem, mas devs reclamam de produtividade',
      difficulty: 'medium',
      symptom: 'Os numeros de commits e PRs por dev aumentaram, mas o developer survey trimestral mostra queda de satisfacao e os times dizem estar mais lentos na pratica.',
      diagnosis: '```text\n1. Cruzar Activity (commits/PRs) com Efficiency & flow (wait time, WIP, review time).\n2. Olhar PR size: PRs estao ficando menores/mais numerosas por imposicao de processo?\n3. Conferir retrabalho: % de commits que revertem/corrigem mudancas recentes.\n4. Ler as respostas abertas do survey (sinal qualitativo do atrito real).\n```',
      solution: 'Activity isolada e enganosa (Lei de Goodhart). O aumento de commits/PRs pode ser retrabalho ou granularidade forcada, nao mais valor entregue. Re-equilibre o quadro SPACE: adicione metricas de Efficiency & flow (wait time, WIP) e de Performance (CFR, qualidade), e trate o survey de satisfacao como sinal de primeira classe. Pare de usar Activity como meta; use-a so como contexto. O objetivo nao e mais atividade, e mais fluxo com qualidade.'
    },
    {
      title: 'Dashboard DORA sem dados de Lead Time',
      difficulty: 'hard',
      symptom: 'Deployment Frequency e Change Failure Rate aparecem no painel, mas Lead Time for Changes fica vazio ou com valores absurdos (negativos / horas demais).',
      diagnosis: '```promql\n# Existe a metrica de lead time sendo coletada?\ncount(pipeline_lead_time_seconds_bucket)\n\n# Os timestamps de commit e de deploy estao corretos?\n# Lead time = deploy_time - first_commit_time do change\nhistogram_quantile(0.5, sum(rate(pipeline_lead_time_seconds_bucket[30d])) by (le))\n```',
      solution: 'Lead Time e a metrica DORA mais dificil de instrumentar porque exige correlacionar o **primeiro commit** de uma mudanca com o **momento do deploy** dela em producao. Causas comuns: o pipeline so registra o timestamp do deploy (sem o do commit), ou usa o timestamp do merge em vez do primeiro commit (subestima), ou ha fuso/relogio inconsistente (gera negativos). Solucao: capturar no pipeline o commit SHA + timestamp do primeiro commit do PR e o timestamp do deploy, calcular a diferenca no momento do deploy e exportar como histograma. Ferramentas como DevLake e Four Keys ja fazem essa correlacao via API do Git + eventos de deploy.'
    }
  ]
};
