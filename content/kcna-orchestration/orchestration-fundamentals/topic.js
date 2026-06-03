window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcna-orchestration/orchestration-fundamentals'] = {

  theory: `# Container Orchestration Fundamentals

## Relevancia no KCNA
> O dominio "Container Orchestration" vale **22%** do KCNA. Entender POR QUE orquestracao e necessaria e os conceitos fundamentais e essencial.

---

## Por que Orquestracao?

Sem orquestracao, gerenciar containers em producao exige:
- Deploy manual em cada servidor
- Monitoramento manual de saude
- Balanceamento de carga manual
- Sem recuperacao automatica de falhas
- Escalonamento manual

---

## Funcionalidades de Orquestracao

| Funcionalidade | Descricao |
|---------------|-----------|
| **Scheduling** | Decidir em qual node executar cada container |
| **Self-healing** | Reiniciar containers que falham, substituir nodes |
| **Scaling** | Aumentar/diminuir replicas (manual e automatico) |
| **Service Discovery** | Encontrar servicos pelo nome (DNS interno) |
| **Load Balancing** | Distribuir trafego entre replicas |
| **Rolling Updates** | Atualizar sem downtime |
| **Config Management** | ConfigMaps, Secrets, env vars |
| **Storage Orchestration** | Montar volumes de diversos backends |

---

## Desired State vs Actual State

O modelo declarativo do Kubernetes:

\`\`\`text
Voce declara:           Kubernetes garante:
"Quero 3 replicas"  --> Controller verifica continuamente
                    --> Se 2 rodando, cria mais 1
                    --> Se 4 rodando, remove 1
\`\`\`

### Control Loop (Reconciliation)

\`\`\`text
Observe --> Compare --> Act
   |          |          |
Actual    Desired    Create/Update/Delete
State     State      resources
\`\`\`

Controllers rodam em loop infinito reconciliando estado atual com o desejado.

---

## Declarativo vs Imperativo

| Aspecto | Imperativo | Declarativo |
|---------|-----------|-------------|
| Como | "Crie 3 pods" | "Quero 3 pods rodando" |
| Comando | kubectl create/run | kubectl apply -f |
| Resultado | Executa uma vez | Reconcilia continuamente |
| GitOps | Dificil | Natural |

---

## Kubernetes vs Alternativas

| Plataforma | Status | Diferencial |
|-----------|--------|-------------|
| **Kubernetes** | Padrao da industria | Extensivel, CNCF, ecossistema rico |
| **Docker Swarm** | Simplicidade | Integrado ao Docker, mais simples |
| **Apache Mesos** | Deprecated | Multi-workload (containers + big data) |
| **HashiCorp Nomad** | Ativo | Multi-runtime (containers + VMs + binarios) |
| **Amazon ECS** | Ativo | AWS nativo, mais simples que K8s |

---

## Kubernetes Managed vs Self-Managed

| Aspecto | Managed (EKS/GKE/AKS) | Self-Managed |
|---------|----------------------|-------------|
| Control Plane | Cloud provider gerencia | Voce gerencia |
| Updates | Automatizados | Manuais (kubeadm) |
| SLA | Garantido pelo provider | Sua responsabilidade |
| Custo | Mais caro | Mais barato (infra propria) |
| Flexibilidade | Limitada | Total |

---

## Conceito de Federation

Cluster Federation permite gerenciar multiplos clusters como um so:

\`\`\`text
Federation Control Plane
    |
    +-- Cluster A (us-east)
    +-- Cluster B (eu-west)
    +-- Cluster C (ap-southeast)
\`\`\`

Usado para: alta disponibilidade global, compliance regional, disaster recovery.
`,

  quiz: [
    {
      question: 'Qual o principal problema que orquestracao de containers resolve?',
      options: ['Criar imagens de container', 'Gerenciar containers em producao de forma automatizada e confiavel', 'Compilar aplicacoes', 'Monitorar redes'],
      correct: 1,
      explanation: 'Orquestracao automatiza: scheduling, self-healing, scaling, service discovery, rolling updates. Sem ela, tudo e manual e propenso a erros.',
      reference: 'Conceito relacionado: Por que orquestracao — problemas resolvidos.'
    },
    {
      question: 'O que significa "desired state" no Kubernetes?',
      options: ['O estado atual do cluster', 'O estado que voce declarou que quer e que o Kubernetes mantém continuamente', 'O estado ideal calculado pelo scheduler', 'O estado antes de updates'],
      correct: 1,
      explanation: 'Desired state e o estado declarado pelo usuario (ex: 3 replicas). O Kubernetes continuamente reconcilia o actual state com o desired state via control loops.',
      reference: 'Conceito relacionado: Desired state vs actual state.'
    },
    {
      question: 'O que e um Control Loop (reconciliation loop)?',
      options: ['Um loop de autenticacao', 'Loop que observa o estado atual, compara com o desejado e toma acao para reconciliar', 'Um loop de backup', 'Um loop de deploy'],
      correct: 1,
      explanation: 'Control loops (observe-compare-act) sao o padrao fundamental do Kubernetes. Controllers rodam continuamente verificando e corrigindo desvios do estado desejado.',
      reference: 'Conceito relacionado: Control loops — reconciliation.'
    },
    {
      question: 'Qual a diferenca entre abordagem declarativa e imperativa?',
      options: [
        'Declarativa e mais rapida',
        'Imperativa diz O QUE fazer uma vez, declarativa descreve o estado desejado e o sistema reconcilia',
        'Nao ha diferenca pratica',
        'Imperativa e mais segura'
      ],
      correct: 1,
      explanation: 'Imperativo: "crie 3 pods" (executa uma vez). Declarativo: "deve haver 3 pods" (sistema garante continuamente). Kubernetes favorece declarativo (kubectl apply).',
      reference: 'Conceito relacionado: Declarativo vs imperativo.'
    },
    {
      question: 'Qual funcionalidade de orquestracao reinicia containers que falham?',
      options: ['Scheduling', 'Self-healing', 'Load Balancing', 'Service Discovery'],
      correct: 1,
      explanation: 'Self-healing reinicia containers que falham, substitui pods em nodes problematicos e mata containers que nao passam nos health checks.',
      reference: 'Conceito relacionado: Self-healing — recuperacao automatica.'
    },
    {
      question: 'Qual alternativa ao Kubernetes suporta multiplos runtimes (containers, VMs, binarios)?',
      options: ['Docker Swarm', 'Apache Mesos', 'HashiCorp Nomad', 'Amazon ECS'],
      correct: 2,
      explanation: 'Nomad (HashiCorp) suporta diversos runtimes: containers Docker, VMs, binarios nativos, Java JARs. E mais simples que Kubernetes mas menos feature-rich.',
      reference: 'Conceito relacionado: Kubernetes vs alternativas.'
    },
    {
      question: 'Qual a principal vantagem de managed Kubernetes (EKS, GKE, AKS)?',
      options: ['E gratuito', 'O cloud provider gerencia o control plane e garante SLA', 'Tem mais features', 'E mais rapido'],
      correct: 1,
      explanation: 'Managed K8s: o provider gerencia API Server, etcd, controllers. Voce gerencia apenas os worker nodes e workloads. SLA garantido e updates automatizados.',
      reference: 'Conceito relacionado: Managed vs self-managed Kubernetes.'
    }
  ],

  flashcards: [
    { front: 'Quais funcionalidades a orquestracao de containers fornece?', back: 'Scheduling, self-healing, scaling, service discovery, load balancing, rolling updates, config management, storage orchestration.' },
    { front: 'O que e desired state vs actual state?', back: 'Desired state: o que voce declarou (ex: 3 replicas). Actual state: o que esta rodando agora. Controllers reconciliam continuamente para que actual = desired.' },
    { front: 'O que e um control loop?', back: 'Padrao observe-compare-act. Controllers observam o estado atual, comparam com o desejado, e tomam acao (criar/atualizar/deletar) para reconciliar. Roda continuamente.' },
    { front: 'Declarativo vs imperativo no K8s?', back: 'Imperativo: kubectl create (executa uma vez). Declarativo: kubectl apply -f (define estado desejado, K8s reconcilia). Declarativo e preferido para GitOps e reproducibilidade.' },
    { front: 'Quais alternativas ao Kubernetes existem?', back: 'Docker Swarm (simples, integrado ao Docker), Nomad (multi-runtime), Amazon ECS (AWS nativo), Apache Mesos (deprecated). Kubernetes e o padrao da industria.' },
    { front: 'O que e managed vs self-managed K8s?', back: 'Managed (EKS/GKE/AKS): provider gerencia control plane, SLA garantido, updates automatizados. Self-managed: voce gerencia tudo com kubeadm, mais flexivel mas mais trabalho.' },
    { front: 'O que e cluster federation?', back: 'Gerenciar multiplos clusters como um so. Usado para HA global, compliance regional, disaster recovery. Permite distribuir workloads entre clusters em diferentes regioes.' }
  ],

  lab: {
    scenario: 'Voce esta explorando conceitos fundamentais de orquestracao observando como o Kubernetes gerencia o estado desejado.',
    objective: 'Observar control loops, self-healing e reconciliation do Kubernetes em acao.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Observar Reconciliation',
        instruction: 'Crie um Deployment e observe como o Kubernetes reconcilia o estado desejado quando voce deleta pods.',
        hints: ['Crie deployment com 3 replicas', 'Delete um pod manualmente', 'Observe como um novo pod e criado automaticamente'],
        solution: '```bash\n# Criar Deployment\nkubectl create deployment reconcile-test --image=nginx:1.25-alpine --replicas=3\n\n# Observar pods\nkubectl get pods -w &\n\n# Deletar um pod\nPOD=$(kubectl get pods -l app=reconcile-test -o jsonpath=\"{.items[0].metadata.name}\")\nkubectl delete pod $POD\n\n# Observar: novo pod criado automaticamente\n# Ctrl+C para parar o watch\n```',
        verify: '```bash\nkubectl get deployment reconcile-test\n# Saida esperada: READY 3/3 (mesmo apos deletar pod)\n\nkubectl get pods -l app=reconcile-test | grep -c Running\n# Saida esperada: 3\n```'
      },
      {
        title: 'Self-Healing em Acao',
        instruction: 'Observe o self-healing matando o processo principal de um container e vendo o Kubernetes reinicia-lo.',
        hints: ['Use kubectl exec para matar o processo do nginx', 'Observe RESTARTS aumentar', 'Verifique com kubectl get pods'],
        solution: '```bash\n# Matar processo principal do container\nPOD=$(kubectl get pods -l app=reconcile-test -o jsonpath=\"{.items[0].metadata.name}\")\nkubectl exec $POD -- kill 1\n\n# Observar restart\nsleep 5\nkubectl get pods -l app=reconcile-test\n# RESTARTS deve ser >= 1 para o pod afetado\n```',
        verify: '```bash\nkubectl get pods -l app=reconcile-test\n# Saida esperada: todos Running, pelo menos 1 com RESTARTS > 0\n\nkubectl get deployment reconcile-test\n# Saida esperada: READY 3/3 (auto-recuperado)\n```'
      },
      {
        title: 'Scaling Declarativo',
        instruction: 'Escale o Deployment de 3 para 5 replicas e depois para 2, observando como o Kubernetes reconcilia.',
        hints: ['Use kubectl scale', 'Observe pods sendo criados/removidos', 'Verifique o estado final'],
        solution: '```bash\n# Scale up\nkubectl scale deployment reconcile-test --replicas=5\nkubectl get pods -l app=reconcile-test\n\n# Scale down\nkubectl scale deployment reconcile-test --replicas=2\nsleep 5\nkubectl get pods -l app=reconcile-test\n```',
        verify: '```bash\nkubectl get deployment reconcile-test\n# Saida esperada: READY 2/2\n\nkubectl get pods -l app=reconcile-test | grep -c Running\n# Saida esperada: 2\n```'
      }
    ]
  },

  troubleshooting: []
};
