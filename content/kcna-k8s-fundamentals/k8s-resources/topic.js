window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcna-k8s-fundamentals/k8s-resources'] = {

  theory: `# Core Kubernetes Resources

## Relevancia no KCNA
> O dominio "Kubernetes Fundamentals" vale **46%** do KCNA. Conhecer os recursos fundamentais do Kubernetes e essencial. Voce deve entender QUANDO e POR QUE usar cada recurso.

---

## Workload Resources

### Pod
A menor unidade deployavel. Um ou mais containers que compartilham rede e storage.

### Deployment
Gerencia ReplicaSets e fornece atualizacoes declarativas para Pods. Suporta rolling updates e rollbacks.

### ReplicaSet
Garante que um numero especificado de replicas de Pod esteja rodando. Gerenciado pelo Deployment.

### StatefulSet
Para aplicacoes stateful. Garante identidade de rede estavel, storage persistente e ordem de deploy/scale.

### DaemonSet
Garante que um Pod rode em cada node (ou subset). Usado para agents de monitoramento, log collection, CNI.

### Job / CronJob
**Job**: executa task ate completar. **CronJob**: agenda Jobs periodicamente (ex: backups diarios).

---

## Service & Networking

### Service Types

| Tipo | Descricao | Acesso |
|------|-----------|--------|
| **ClusterIP** | IP interno do cluster (padrao) | Apenas dentro do cluster |
| **NodePort** | Expoe porta em cada node (30000-32767) | Externo via \`<NodeIP>:<NodePort>\` |
| **LoadBalancer** | Provisiona load balancer externo (cloud) | Externo via IP publico |
| **ExternalName** | Alias DNS para servico externo | Redireciona via CNAME |

### Ingress
Gerencia acesso HTTP/HTTPS externo aos Services. Suporta routing baseado em host/path, TLS termination.

---

## Configuration

### ConfigMap
Armazena configuracoes nao-sensiveis como key-value pairs. Consumido como env vars ou volumes.

### Secret
Similar ao ConfigMap mas para dados sensiveis (senhas, tokens). Armazenado em base64 (nao encriptado por padrao).

---

## Storage

### PersistentVolume (PV)
Recurso de armazenamento provisionado pelo admin. Independente do ciclo de vida do Pod.

### PersistentVolumeClaim (PVC)
Solicitacao de armazenamento por um usuario. Vincula a um PV disponivel.

### StorageClass
Define tipos de armazenamento para provisionamento dinamico.

---

## Namespace
Isolamento logico de recursos no cluster. Recursos padrao: default, kube-system, kube-public, kube-node-lease.

---

## Resumo Visual

\`\`\`text
Deployment --> ReplicaSet --> Pods
StatefulSet --> Pods (com identidade)
DaemonSet --> Pods (um por node)
Job --> Pods (ate completar)

Service (ClusterIP/NodePort/LB) --> Pods
Ingress --> Service --> Pods

ConfigMap/Secret --> Pods (env/volume)
PVC --> PV --> Storage Backend
\`\`\`

---

## Quando Usar Cada Recurso

| Cenario | Recurso |
|---------|---------|
| App web stateless | Deployment |
| Banco de dados | StatefulSet |
| Agent em cada node | DaemonSet |
| Tarefa batch | Job |
| Backup diario | CronJob |
| Expor internamente | Service ClusterIP |
| Expor externamente HTTP | Ingress |
| Expor externamente TCP | Service NodePort/LoadBalancer |
`,

  quiz: [
    {
      question: 'Qual e a menor unidade deployavel no Kubernetes?',
      options: ['Container', 'Pod', 'Deployment', 'ReplicaSet'],
      correct: 1,
      explanation: 'O Pod e a menor unidade deployavel. Um Pod pode conter um ou mais containers que compartilham rede e storage.',
      reference: 'Conceito relacionado: Pod — unidade basica do Kubernetes.'
    },
    {
      question: 'Qual recurso garante que um Pod rode em cada node do cluster?',
      options: ['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet'],
      correct: 2,
      explanation: 'DaemonSet garante que uma copia do Pod rode em cada node (ou nodes selecionados). Usado para agents de monitoring, logging e networking.',
      reference: 'Conceito relacionado: DaemonSet — deploy por node.'
    },
    {
      question: 'Qual tipo de Service cria um load balancer externo no cloud provider?',
      options: ['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'],
      correct: 2,
      explanation: 'LoadBalancer provisiona automaticamente um load balancer externo no cloud provider (AWS ELB, GCP GLB, Azure LB) e expoe o Service via IP publico.',
      reference: 'Conceito relacionado: Service types — LoadBalancer.'
    },
    {
      question: 'Qual a diferenca principal entre Deployment e StatefulSet?',
      options: [
        'Deployment e mais rapido',
        'StatefulSet garante identidade de rede estavel e storage persistente por Pod',
        'Deployment nao suporta replicas',
        'StatefulSet nao suporta updates'
      ],
      correct: 1,
      explanation: 'StatefulSet garante que cada Pod tenha identidade de rede estavel (pod-0, pod-1), storage persistente dedicado e ordem de deploy/termination. Deployment trata Pods como intercambiaveis.',
      reference: 'Conceito relacionado: Deployment vs StatefulSet.'
    },
    {
      question: 'Qual recurso e usado para armazenar dados sensiveis como senhas?',
      options: ['ConfigMap', 'Secret', 'PersistentVolume', 'Annotation'],
      correct: 1,
      explanation: 'Secret armazena dados sensiveis (senhas, tokens, chaves) como key-value pairs em base64. Pode ser consumido como env var ou volume.',
      reference: 'Conceito relacionado: Secrets — dados sensiveis.'
    },
    {
      question: 'O que um CronJob faz no Kubernetes?',
      options: [
        'Executa containers continuamente',
        'Agenda a execucao de Jobs periodicamente usando sintaxe cron',
        'Monitora cron do sistema operacional',
        'Gerencia rotacao de logs'
      ],
      correct: 1,
      explanation: 'CronJob cria Jobs em horarios agendados usando sintaxe cron (ex: "0 2 * * *" para diariamente as 2h). Util para backups, cleanups e tarefas periodicas.',
      reference: 'Conceito relacionado: CronJob — tarefas agendadas.'
    },
    {
      question: 'Qual o papel de um Namespace no Kubernetes?',
      options: [
        'Isolar a rede entre containers',
        'Fornecer isolamento logico de recursos e controle de acesso',
        'Criar clusters separados',
        'Gerenciar DNS'
      ],
      correct: 1,
      explanation: 'Namespaces fornecem isolamento logico de recursos, permitindo separar ambientes (dev/staging/prod) e aplicar RBAC, ResourceQuotas e LimitRanges por namespace.',
      reference: 'Conceito relacionado: Namespaces — isolamento logico.'
    }
  ],

  flashcards: [
    { front: 'O que e um Pod?', back: 'Menor unidade deployavel no K8s. Um ou mais containers que compartilham rede (mesmo IP) e storage. Efemero por natureza.' },
    { front: 'Qual a diferenca entre Deployment e StatefulSet?', back: 'Deployment: pods stateless intercambiaveis, rolling updates. StatefulSet: pods com identidade estavel (pod-0, pod-1), storage dedicado, ordem garantida de deploy/delete.' },
    { front: 'Quais sao os 4 tipos de Service?', back: 'ClusterIP (interno, padrao), NodePort (porta em cada node, 30000-32767), LoadBalancer (LB externo do cloud), ExternalName (alias DNS CNAME).' },
    { front: 'O que e um DaemonSet?', back: 'Garante que um Pod rode em cada node (ou subset via nodeSelector). Usado para: monitoring agents, log collectors, CNI plugins, security agents.' },
    { front: 'Qual a diferenca entre ConfigMap e Secret?', back: 'ConfigMap: dados nao-sensiveis (configs, properties). Secret: dados sensiveis (senhas, tokens) em base64. Ambos podem ser consumidos como env vars ou volumes.' },
    { front: 'O que sao PV e PVC?', back: 'PersistentVolume (PV): recurso de storage provisionado. PersistentVolumeClaim (PVC): solicitacao de storage por um Pod. PVC vincula a um PV disponivel que atenda os requisitos.' },
    { front: 'Quando usar Ingress vs LoadBalancer Service?', back: 'Ingress: acesso HTTP/HTTPS com routing por host/path, TLS, um LB para multiplos Services. LoadBalancer: acesso TCP/UDP, um LB por Service (mais caro).' },
    { front: 'Quais Namespaces existem por padrao?', back: 'default (recursos sem namespace especificado), kube-system (componentes do sistema), kube-public (dados publicos), kube-node-lease (heartbeats de nodes).' }
  ],

  lab: {
    scenario: 'Voce esta explorando os recursos fundamentais de um cluster Kubernetes para entender como eles se relacionam.',
    objective: 'Explorar e entender os principais recursos do Kubernetes e seus relacionamentos.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Explorar Recursos do Cluster',
        instruction: 'Liste todos os tipos de recursos disponiveis no cluster e identifique os recursos core.',
        hints: ['Use kubectl api-resources', 'Filtre por namespaced vs cluster-scoped', 'Identifique os mais comuns'],
        solution: '```bash\n# Listar todos os recursos\nkubectl api-resources\n\n# Apenas recursos core (sem grupo)\nkubectl api-resources --api-group=\"\"\n\n# Recursos namespaced\nkubectl api-resources --namespaced=true | head -20\n\n# Recursos cluster-scoped\nkubectl api-resources --namespaced=false\n```',
        verify: '```bash\nkubectl api-resources | wc -l\n# Saida esperada: numero > 50 (muitos tipos de recursos)\n\nkubectl api-resources | grep -c \"true\"\n# Saida esperada: numero de recursos namespaced\n```'
      },
      {
        title: 'Criar e Explorar Deployment com Service',
        instruction: 'Crie um Deployment com nginx e exponha via Service para entender o relacionamento entre os recursos.',
        hints: ['Use kubectl create deployment', 'Use kubectl expose para criar Service', 'Use kubectl get all para ver tudo'],
        solution: '```bash\n# Criar Deployment\nkubectl create deployment web --image=nginx:1.25-alpine --replicas=3\n\n# Expor como Service\nkubectl expose deployment web --port=80 --type=ClusterIP\n\n# Ver todos os recursos criados\nkubectl get all\n\n# Ver detalhes do Deployment\nkubectl describe deployment web\n\n# Ver o ReplicaSet criado automaticamente\nkubectl get replicaset\n```',
        verify: '```bash\n# Verificar Deployment\nkubectl get deployment web\n# Saida esperada: web 3/3\n\n# Verificar Service\nkubectl get svc web\n# Saida esperada: web ClusterIP\n\n# Verificar Pods\nkubectl get pods -l app=web\n# Saida esperada: 3 pods Running\n```'
      },
      {
        title: 'Explorar Namespaces e Isolamento',
        instruction: 'Explore os namespaces do cluster e entenda como os recursos sao isolados.',
        hints: ['Use kubectl get namespaces', 'Use -n para ver recursos em namespaces especificos', 'Compare recursos entre namespaces'],
        solution: '```bash\n# Listar namespaces\nkubectl get namespaces\n\n# Ver recursos no kube-system\nkubectl get all -n kube-system\n\n# Ver recursos em todos os namespaces\nkubectl get pods -A\n\n# Criar namespace e recurso isolado\nkubectl create namespace test-ns\nkubectl run isolated-pod --image=nginx:1.25-alpine -n test-ns\n\n# Pod no default NAO ve o pod no test-ns\nkubectl get pods\nkubectl get pods -n test-ns\n```',
        verify: '```bash\n# Verificar namespaces\nkubectl get ns\n# Saida esperada: default, kube-system, kube-public, kube-node-lease, test-ns\n\n# Verificar isolamento\nkubectl get pods -n test-ns\n# Saida esperada: isolated-pod\n\nkubectl get pods -n default | grep isolated\n# Saida esperada: nenhuma linha (isolado por namespace)\n```'
      }
    ]
  },

  troubleshooting: []
};
