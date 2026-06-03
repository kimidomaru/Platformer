window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['chaos-engineering/chaos-fundamentals'] = {
  theory: `
# Chaos Engineering Fundamentals

## Relevancia
Chaos Engineering e a disciplina de experimentar em sistemas distribuidos para construir confianca na capacidade do sistema de suportar condicoes turbulentas em producao. No ecossistema Kubernetes, onde falhas de pods, nodes e rede sao inevitaveis, chaos engineering valida que mecanismos de resiliencia (replicas, health checks, PDBs, circuit breakers) realmente funcionam.

## Conceitos Fundamentais

### O que e Chaos Engineering?

Chaos Engineering NAO e "quebrar coisas em producao". E uma abordagem cientifica:

\`\`\`
Metodo Cientifico do Chaos Engineering:

1. Definir estado estavel (steady state)
   → Quais metricas indicam que o sistema esta saudavel?

2. Formular hipotese
   → "Se matarmos um pod, o servico continua respondendo em < 500ms"

3. Introduzir variavel (falha controlada)
   → Kill pod, inject latency, corrupt network

4. Observar diferenca
   → O estado estavel se manteve? A hipotese foi confirmada?

5. Documentar e corrigir
   → Se falhou, corrigir. Se passou, expandir o blast radius.
\`\`\`

### Principios do Chaos Engineering (Netflix)

\`\`\`
┌──────────────────────────────────────────────────────┐
│         Principios do Chaos Engineering              │
│                                                      │
│  1. Construir hipotese sobre steady state            │
│     → Definir comportamento normal mensuravel        │
│                                                      │
│  2. Variar eventos do mundo real                     │
│     → Simular falhas que realmente acontecem         │
│     → Crashes, latencia, particoes de rede           │
│                                                      │
│  3. Executar experimentos em producao                │
│     → Staging nao replica comportamento real          │
│     → Comecar com blast radius pequeno               │
│                                                      │
│  4. Automatizar para executar continuamente          │
│     → Chaos como parte do CI/CD                      │
│     → Game Days regulares                            │
│                                                      │
│  5. Minimizar blast radius                           │
│     → Comecar pequeno, expandir gradualmente         │
│     → Ter mecanismo de abort automatico              │
└──────────────────────────────────────────────────────┘
\`\`\`

### Steady State — Comportamento Normal

\`\`\`
Metricas de Steady State Tipicas:

Infraestrutura:
  - Pods Running/Ready ratio = 100%
  - Node CPU < 80%
  - Memoria disponivel > 20%
  - Latencia p99 < 500ms

Aplicacao:
  - Taxa de erro HTTP 5xx < 0.1%
  - Throughput = X req/s (± 10%)
  - Tempo de resposta medio < 200ms
  - Queue depth < threshold

Negocio:
  - Checkout success rate > 99.5%
  - Orders processed / minute = Y
  - Revenue per minute = Z
\`\`\`

### Blast Radius

\`\`\`
Blast Radius — Escopo do Impacto

Nivel 1 (Menor):   1 pod / 1 container
Nivel 2:           Todos os pods de um Deployment
Nivel 3:           1 node inteiro
Nivel 4:           1 zona de disponibilidade
Nivel 5 (Maior):   Regiao inteira / Cluster

Regra: Comecar SEMPRE pelo menor blast radius.
Expandir somente quando o nivel anterior esta resiliente.

┌─────────────────────────────────────────┐
│           Progressao Ideal              │
│                                         │
│  Kill 1 pod ────→ OK                    │
│  Kill N pods ───→ OK                    │
│  Drain 1 node ──→ OK                    │
│  Network delay ─→ OK                    │
│  AZ failure ────→ OK                    │
│  Region failover → OK                   │
│                                         │
│  Cada nivel valida o anterior.          │
└─────────────────────────────────────────┘
\`\`\`

### Tipos de Experimentos Chaos

\`\`\`
┌────────────────────┬──────────────────────────────────┐
│ Categoria          │ Experimentos                     │
├────────────────────┼──────────────────────────────────┤
│ Pod/Container      │ - Kill pod                       │
│                    │ - Kill container                  │
│                    │ - CPU stress                      │
│                    │ - Memory stress                   │
│                    │ - Disk fill                       │
├────────────────────┼──────────────────────────────────┤
│ Rede               │ - Latencia (delay)               │
│                    │ - Perda de pacotes (loss)         │
│                    │ - Particao de rede               │
│                    │ - DNS failure                     │
│                    │ - Bandwidth throttle              │
├────────────────────┼──────────────────────────────────┤
│ Node/Infra         │ - Node drain                     │
│                    │ - Node shutdown                   │
│                    │ - Clock skew                      │
│                    │ - Disk I/O stress                 │
├────────────────────┼──────────────────────────────────┤
│ Aplicacao          │ - HTTP error injection           │
│                    │ - gRPC fault injection            │
│                    │ - Database connection kill        │
│                    │ - Cache invalidation              │
├────────────────────┼──────────────────────────────────┤
│ Plataforma K8s     │ - etcd leader election           │
│                    │ - API server restart              │
│                    │ - Kubelet restart                  │
│                    │ - CoreDNS failure                 │
└────────────────────┴──────────────────────────────────┘
\`\`\`

### Game Day — Exercicio Estruturado

\`\`\`
Game Day — Planejamento

Antes:
  ☐ Definir objetivos claros
  ☐ Identificar steady state e metricas
  ☐ Preparar runbook de rollback
  ☐ Informar stakeholders
  ☐ Garantir observabilidade (dashboards, alertas)
  ☐ Definir blast radius maximo
  ☐ Ter mecanismo de abort (kill switch)

Durante:
  ☐ Monitorar metricas em tempo real
  ☐ Documentar observacoes
  ☐ Escalar blast radius gradualmente
  ☐ Abortar se impacto exceder threshold

Depois:
  ☐ Post-mortem do experimento
  ☐ Documentar findings
  ☐ Criar tickets para correcoes
  ☐ Atualizar runbooks
  ☐ Planejar proximo Game Day
\`\`\`

### Chaos Engineering no Kubernetes

\`\`\`
Mecanismos de Resiliencia K8s que Chaos valida:

1. ReplicaSet / Deployment
   Experimento: Kill pod → novo pod deve subir automaticamente
   Validacao: Replicas desejadas = replicas atuais em < 30s

2. Health Checks (liveness/readiness)
   Experimento: Travar aplicacao → K8s deve reiniciar
   Validacao: Pod restartado, servico sem downtime

3. PodDisruptionBudget (PDB)
   Experimento: Drain node → PDB deve prevenir quorum loss
   Validacao: minAvailable respeitado durante drain

4. Horizontal Pod Autoscaler (HPA)
   Experimento: CPU stress → HPA deve escalar
   Validacao: Novos pods criados, latencia estabiliza

5. Pod Anti-Affinity
   Experimento: Kill node → pods distribuidos sobrevivem
   Validacao: Servico permanece disponivel

6. Network Policies
   Experimento: Pod comprometido → nao acessa outros servicos
   Validacao: Segmentacao de rede funciona

7. Circuit Breaker (Istio/app-level)
   Experimento: Backend lento → circuit breaker abre
   Validacao: Requisicoes fail-fast em vez de timeout
\`\`\`

### Ferramentas de Chaos para Kubernetes

| Ferramenta | Tipo | Caracteristicas |
|-----------|------|----------------|
| LitmusChaos | CNCF | CRDs nativos, ChaosHub, workflows, probes |
| Chaos Mesh | CNCF | CRDs nativos, dashboard web, physicalmachine chaos |
| Gremlin | SaaS | Enterprise, interface web, free tier |
| Chaos Toolkit | OSS | CLI, extensivel, JSON experiments |
| PowerfulSeal | OSS | Interativo + autonomo, politicas |
| kube-monkey | OSS | Simples, Netflix Chaos Monkey style |
| Pumba | OSS | Container-level, Docker/containerd |

### Chaos Maturity Model

\`\`\`
Nivel 0 — Ad Hoc
  - Chaos reativo (incidentes ensinam)
  - Nenhuma pratica formal

Nivel 1 — Initial
  - Experimentos manuais em staging
  - Kill pods basico
  - Sem automacao

Nivel 2 — Managed
  - Ferramenta de chaos adotada
  - Experimentos documentados
  - Game Days trimestrais
  - Cobertura: pod kill + network delay

Nivel 3 — Defined
  - Chaos integrado no CI/CD
  - Experimentos automatizados pos-deploy
  - Metricas de resiliencia rastreadas
  - Game Days mensais

Nivel 4 — Optimized
  - Chaos contínuo em producao
  - Abort automatico baseado em SLOs
  - Cobertura de falhas multi-camada
  - Cultura de resiliencia em toda a org
\`\`\`

### Metricas de Resiliencia

\`\`\`
Metricas para avaliar resultados de Chaos:

1. MTTR (Mean Time to Recovery)
   Tempo medio para se recuperar de uma falha injetada
   Alvo: < 5 minutos para pod failures

2. Recovery Rate
   % de experimentos onde o sistema se recuperou automaticamente
   Alvo: > 95%

3. Blast Radius Tolerance
   Maior blast radius suportado sem impacto em SLO
   Alvo: Tolerancia a 1 node failure

4. Detection Time
   Tempo para alertas dispararem apos injecao de falha
   Alvo: < 1 minuto

5. Experiment Coverage
   % de servicos criticos com experimentos chaos
   Alvo: > 80% dos servicos Tier-1
\`\`\`

### Erros Comuns

1. **Chaos sem observabilidade** — Se nao ha metricas/alertas, chaos e apenas destruicao
2. **Comecar com blast radius grande** — Sempre iniciar pelo menor escopo possivel
3. **Chaos sem hipotese** — Cada experimento precisa de uma hipotese falsificavel
4. **Ignorar resultados negativos** — Falhas encontradas pelo chaos devem gerar action items
5. **Chaos apenas em staging** — Staging nao replica comportamento real de producao
6. **Sem mecanismo de abort** — Sempre ter um kill switch para parar o experimento

## Killer.sh Style Challenge

> **Cenario:** Planeje um Game Day para validar a resiliencia de um microservico no Kubernetes. Defina: (1) steady state com metricas especificas, (2) 3 hipoteses com experimentos progressivos (pod kill → node drain → network delay), (3) criterios de sucesso para cada experimento, (4) mecanismo de abort.
`,
  quiz: [
    {
      question: 'Qual e o primeiro passo do metodo cientifico de Chaos Engineering?',
      options: [
        'Injetar falhas em producao',
        'Definir o steady state (comportamento normal mensuravel)',
        'Instalar ferramentas de chaos',
        'Criar um Game Day'
      ],
      correct: 1,
      explanation: 'O primeiro passo e definir o steady state — metricas que indicam comportamento normal do sistema (latencia, taxa de erro, throughput). Sem isso, nao e possivel saber se o sistema se recuperou apos a falha.',
      reference: 'Conceito relacionado: Steady state pode incluir metricas de infra, aplicacao e negocio.'
    },
    {
      question: 'O que e "blast radius" em Chaos Engineering?',
      options: [
        'O tamanho do cluster',
        'O escopo do impacto de um experimento chaos (de 1 pod ate uma regiao inteira)',
        'O numero de ferramentas usadas',
        'O tempo de duracao do experimento'
      ],
      correct: 1,
      explanation: 'Blast radius define o escopo do impacto: 1 pod, N pods, 1 node, 1 AZ, 1 regiao. A regra e sempre comecar pelo menor blast radius e expandir somente quando o nivel anterior esta validado.',
      reference: 'Conceito relacionado: Progressao ideal: pod → deployment → node → AZ → region.'
    },
    {
      question: 'Qual mecanismo K8s o Chaos Engineering valida quando faz kill de pods?',
      options: [
        'NetworkPolicy',
        'ReplicaSet/Deployment — novo pod deve subir automaticamente',
        'ConfigMap',
        'PersistentVolume'
      ],
      correct: 1,
      explanation: 'Quando um pod e terminado, o ReplicaSet (via Deployment) detecta a discrepancia entre replicas desejadas e atuais e cria um novo pod automaticamente. Chaos valida que esse mecanismo funciona corretamente.',
      reference: 'Conceito relacionado: PDB (PodDisruptionBudget) protege contra evictions simultaneas.'
    },
    {
      question: 'O que deve acontecer ANTES de executar um experimento chaos?',
      options: [
        'Apenas informar o time de DevOps',
        'Definir hipotese, steady state, blast radius, mecanismo de abort e garantir observabilidade',
        'Atualizar o cluster para ultima versao',
        'Desligar os alertas para evitar falsos positivos'
      ],
      correct: 1,
      explanation: 'Antes de um experimento: definir hipotese clara, estabelecer steady state com metricas, limitar blast radius, preparar mecanismo de abort (kill switch) e garantir que dashboards e alertas estao funcionando.',
      reference: 'Conceito relacionado: Game Day e o formato estruturado para executar chaos com planejamento.'
    },
    {
      question: 'Qual a diferenca entre Chaos Engineering e testes de stress?',
      options: [
        'Nao ha diferenca',
        'Chaos Engineering foca em falhas (kill pod, network partition); testes de stress focam em carga (alta throughput)',
        'Testes de stress sao mais avancados',
        'Chaos Engineering e apenas para producao'
      ],
      correct: 1,
      explanation: 'Testes de stress validam comportamento sob carga alta. Chaos Engineering valida comportamento sob falhas inesperadas (crash, network issues, disk full). Sao complementares — um sistema pode aguentar carga mas falhar com um pod kill.',
      reference: 'Conceito relacionado: Chaos + load testing juntos validam resiliencia sob condicoes realistas.'
    },
    {
      question: 'Em qual nivel do Chaos Maturity Model o chaos e integrado no CI/CD?',
      options: [
        'Nivel 1 (Initial)',
        'Nivel 3 (Defined) — chaos automatizado pos-deploy e metricas rastreadas',
        'Nivel 0 (Ad Hoc)',
        'Nivel 2 (Managed)'
      ],
      correct: 1,
      explanation: 'No Nivel 3 (Defined), chaos e integrado no CI/CD com experimentos automatizados apos deploy, metricas de resiliencia sao rastreadas, e Game Days acontecem mensalmente.',
      reference: 'Conceito relacionado: Nivel 4 (Optimized) tem chaos continuo em producao com abort automatico baseado em SLOs.'
    },
    {
      question: 'Por que chaos em staging nao e suficiente?',
      options: [
        'Staging e muito caro',
        'Staging nao replica comportamento real de producao (trafego, dados, integrações, escala)',
        'Staging nao suporta ferramentas de chaos',
        'Nao e possivel monitorar staging'
      ],
      correct: 1,
      explanation: 'Staging nao replica fielmente producao: trafego real, volume de dados, integracoes com terceiros, configuracoes especificas e escala real. Chaos em producao (com blast radius controlado) valida o comportamento real.',
      reference: 'Conceito relacionado: Comecar em staging para aprender, mas validar em producao para confianca real.'
    }
  ],
  flashcards: [
    {
      front: 'O que e Chaos Engineering e qual seu objetivo?',
      back: '**Chaos Engineering** e a disciplina de experimentar em sistemas distribuidos para construir confianca na resiliencia.\n\n**Metodo cientifico:**\n1. Definir steady state (metricas normais)\n2. Formular hipotese\n3. Injetar falha controlada\n4. Observar se steady state se manteve\n5. Documentar e corrigir\n\n**NAO e:**\n- Quebrar coisas aleatoriamente\n- Testes de stress\n- Apenas em staging\n\n**Objetivo:**\nDescobrir fraquezas ANTES que causem incidentes reais.'
    },
    {
      front: 'O que e steady state e como definir?',
      back: '**Steady state** = comportamento normal mensuravel.\n\n**Metricas de infra:**\n- Pods Running = 100%\n- CPU < 80%, Mem > 20%\n- Latencia p99 < 500ms\n\n**Metricas de app:**\n- HTTP 5xx < 0.1%\n- Throughput = X req/s (±10%)\n- Response time < 200ms\n\n**Metricas de negocio:**\n- Checkout rate > 99.5%\n- Orders/min = Y\n\n**Regra:** Sem steady state definido, chaos e apenas destruicao sem aprendizado.'
    },
    {
      front: 'O que e blast radius e como progredir?',
      back: '**Blast radius** = escopo do impacto do experimento.\n\n**Niveis (menor → maior):**\n1. 1 pod / 1 container\n2. Todos os pods de um Deployment\n3. 1 node inteiro\n4. 1 zona de disponibilidade\n5. Regiao inteira / Cluster\n\n**Regra de ouro:**\nSEMPRE comecar pelo menor nivel.\nExpandir somente quando o anterior esta resiliente.\n\n**Mecanismo de abort:**\nTer kill switch para parar o experimento a qualquer momento se o impacto exceder o threshold.'
    },
    {
      front: 'Quais tipos de experimentos chaos existem?',
      back: '**Pod/Container:**\n- Kill pod/container\n- CPU/memory stress\n- Disk fill\n\n**Rede:**\n- Latencia (delay)\n- Perda de pacotes (loss)\n- Particao de rede\n- DNS failure\n\n**Node/Infra:**\n- Node drain/shutdown\n- Clock skew\n- Disk I/O stress\n\n**Aplicacao:**\n- HTTP error injection\n- Database connection kill\n- Cache invalidation\n\n**Plataforma K8s:**\n- etcd leader election\n- API server restart\n- CoreDNS failure'
    },
    {
      front: 'O que e um Game Day e como planejar?',
      back: '**Game Day** = exercicio estruturado de chaos.\n\n**Antes:**\n- Definir objetivos e hipoteses\n- Identificar steady state e metricas\n- Preparar runbook de rollback\n- Informar stakeholders\n- Garantir observabilidade\n- Definir blast radius maximo\n- Ter kill switch\n\n**Durante:**\n- Monitorar em tempo real\n- Documentar observacoes\n- Escalar gradualmente\n- Abortar se necessario\n\n**Depois:**\n- Post-mortem\n- Documentar findings\n- Criar action items\n- Planejar proximo Game Day'
    },
    {
      front: 'Quais mecanismos K8s o chaos engineering valida?',
      back: '**1. ReplicaSet/Deployment:**\nKill pod → novo pod sobe automaticamente\n\n**2. Health Checks:**\nApp trava → K8s reinicia via liveness probe\n\n**3. PodDisruptionBudget:**\nDrain node → PDB previne quorum loss\n\n**4. HPA:**\nCPU stress → HPA escala automaticamente\n\n**5. Anti-Affinity:**\nKill node → pods distribuidos sobrevivem\n\n**6. Network Policies:**\nPod comprometido → segmentacao funciona\n\n**7. Circuit Breaker:**\nBackend lento → fail-fast em vez de timeout'
    },
    {
      front: 'Quais ferramentas de chaos existem para Kubernetes?',
      back: '**CNCF:**\n- LitmusChaos: CRDs, ChaosHub, workflows, probes\n- Chaos Mesh: CRDs, dashboard web, multi-fault\n\n**SaaS:**\n- Gremlin: Enterprise, interface web, free tier\n\n**Open Source:**\n- Chaos Toolkit: CLI, JSON experiments\n- PowerfulSeal: Interativo + autonomo\n- kube-monkey: Netflix Chaos Monkey style\n- Pumba: Container-level\n\n**Escolha baseada em:**\n- Maturidade do time\n- Integracao com K8s (CRDs vs CLI)\n- Enterprise vs OSS\n- Tipos de falha necessarios'
    }
  ],
  lab: null,
  troubleshooting: [
    {
      title: 'Experimento chaos causa downtime maior que o esperado',
      difficulty: 'medium',
      symptom: 'Apos kill de 1 pod, o servico fica indisponivel por varios minutos em vez de se recuperar em segundos.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o Deployment tem replicas suficientes
kubectl get deployment my-app -o jsonpath='{.spec.replicas}'
# Se replicas=1, nao ha redundancia

# 2. Verificar se readinessProbe esta configurada
kubectl get deployment my-app -o yaml | grep readinessProbe -A5

# 3. Verificar tempo de startup da app
kubectl describe pod my-app-xxx | grep -E "Started|Pulling|Created"

# 4. Verificar PDB
kubectl get pdb -o wide

# 5. Verificar se HPA esta configurado
kubectl get hpa my-app
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Apenas 1 replica:** Aumentar replicas para minimo 2 (preferencialmente 3). Com 1 replica, qualquer kill causa downtime total.

2. **Sem readinessProbe:** Sem readiness probe, o Service envia trafego para o novo pod antes dele estar pronto. Configurar readinessProbe com initialDelaySeconds adequado.

3. **Startup lento:** Se a app demora 60s para iniciar, o downtime sera pelo menos 60s. Usar startupProbe para apps lentas. Otimizar tempo de startup.

4. **Sem PDB:** Criar PodDisruptionBudget com minAvailable para proteger contra disruptions simultaneas.

5. **Imagem pull lento:** Se a imagem precisa ser baixada (imagePullPolicy: Always), o tempo de recovery aumenta. Usar imagePullPolicy: IfNotPresent e pre-pull imagens.`
    },
    {
      title: 'Chaos nao revela problemas — falsa confianca',
      difficulty: 'hard',
      symptom: 'Todos os experimentos chaos passam mas incidentes reais continuam acontecendo. O chaos nao esta encontrando as fraquezas reais.',
      diagnosis: `\`\`\`bash
# 1. Revisar tipos de experimentos executados
# Se apenas "kill pod", nao cobre falhas de rede, disk, etc.

# 2. Verificar blast radius dos experimentos
# Se sempre 1 pod, expandir para node, AZ

# 3. Verificar se steady state esta bem definido
# Metricas superficiais (pod count) vs metricas de negocio (orders/min)

# 4. Verificar cobertura de servicos
# Se chaos so cobre frontend, backend pode ser fragil

# 5. Analisar incidentes reais
# Que tipo de falha causou o incidente? O chaos cobria esse cenario?
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Cobertura superficial:** Expandir tipos de experimentos alem de pod kill — incluir network delay, DNS failure, disk pressure, dependency failure.

2. **Blast radius muito pequeno:** Se sempre testa 1 pod, nunca descobre problemas de cascading failure. Expandir para multi-pod, node drain, AZ failure.

3. **Steady state superficial:** Monitorar metricas de negocio (orders/min, checkout rate), nao apenas metricas de infra (pod count). Um pod pode estar Running mas retornando erros.

4. **Falta de chaos em dependencias:** Simular falha de banco de dados, cache (Redis), message queue (Kafka), servicos externos. Falhas de dependencia sao as mais comuns em producao.

5. **Chaos apenas em staging:** Comportamento em staging difere de producao. Executar chaos em producao com blast radius controlado.

6. **Chaos previsivel:** Se o time sabe exatamente quando o chaos vai ocorrer, eles podem estar preparados artificialmente. Executar chaos aleatorio (Chaos Monkey style) alem de Game Days planejados.`
    }
  ]
};
