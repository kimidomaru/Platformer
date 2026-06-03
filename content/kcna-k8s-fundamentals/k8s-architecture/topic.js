window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcna-k8s-fundamentals/k8s-architecture'] = {

  theory: `# Kubernetes Architecture Overview

## Relevancia no KCNA
> O dominio "Kubernetes Fundamentals" vale **46%** do exame KCNA — e o maior peso. Entender a arquitetura do Kubernetes, seus componentes e como interagem e absolutamente essencial. O KCNA e um exame **teorico** (multipla escolha).

---

## Visao Geral da Arquitetura

O Kubernetes segue uma arquitetura **client-server** com dois planos:

\`\`\`
┌────────────────────────────────────────────────────────┐
│                    CONTROL PLANE                        │
│                                                         │
│  ┌──────────┐  ┌───────────┐  ┌────────────────────┐   │
│  │   etcd   │  │    API    │  │ Controller Manager  │   │
│  │          │◄─┤  Server   │  │                     │   │
│  └──────────┘  └─────┬─────┘  └────────────────────┘   │
│                      │         ┌────────────────────┐   │
│                      │         │    Scheduler        │   │
│                      │         └────────────────────┘   │
│                      │         ┌────────────────────┐   │
│                      │         │ Cloud Controller    │   │
│                      │         │ Manager (opcional)  │   │
│                      │         └────────────────────┘   │
└──────────────────────┼──────────────────────────────────┘
                       │ API (HTTPS)
┌──────────────────────┼──────────────────────────────────┐
│                 WORKER NODES                             │
│                      │                                   │
│  ┌───────────┐  ┌────▼─────┐  ┌────────────────────┐   │
│  │  kube-    │  │ kubelet  │  │  Container Runtime  │   │
│  │  proxy    │  │          │──│  (containerd/CRI-O) │   │
│  └───────────┘  └──────────┘  └────────────────────┘   │
│                                                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                      │
│  │ Pod │ │ Pod │ │ Pod │ │ Pod │                        │
│  └─────┘ └─────┘ └─────┘ └─────┘                      │
└─────────────────────────────────────────────────────────┘
\`\`\`

---

## Control Plane (Master)

O Control Plane e o "cerebro" do cluster. Toma decisoes globais (scheduling, deteccao de eventos) e gerencia o estado desejado.

### API Server (kube-apiserver)

O **API Server** e o componente central — **todos** os outros componentes se comunicam atraves dele. Funciona como um gateway RESTful.

| Caracteristica | Detalhe |
|---------------|---------|
| **Funcao** | Frontend do control plane, unico ponto de acesso |
| **Protocolo** | HTTPS REST API |
| **Autenticacao** | Certificates, tokens, OIDC |
| **Autorizacao** | RBAC (padrao), ABAC, Webhook |
| **Admission** | Mutating -> Validating admission controllers |
| **Persistencia** | Grava estado no etcd |

**Fluxo de uma requisicao:**
\`\`\`
kubectl apply → Authentication → Authorization → Admission Control → etcd (persist)
                                                                       │
                                                    Controller Manager ←┘ (watch)
                                                           │
                                                     Scheduler (assign node)
                                                           │
                                                      Kubelet (run pod)
\`\`\`

### etcd

**etcd** e o banco de dados key-value distribuido que armazena TODO o estado do cluster.

| Caracteristica | Detalhe |
|---------------|---------|
| **Tipo** | Key-value store distribuido |
| **Protocolo** | Raft consensus |
| **Dados** | Todos os objetos K8s (pods, services, secrets, configmaps) |
| **Acesso** | Apenas via API Server (nunca diretamente) |
| **Backup** | Essencial para disaster recovery |
| **Porta** | 2379 (client), 2380 (peer) |

**Importante para o KCNA:**
- etcd e o **unico** componente stateful do control plane
- Perder o etcd sem backup = perder o cluster inteiro
- etcd nao e acessado diretamente por kubelet ou kubectl — sempre via API Server

### Scheduler (kube-scheduler)

O **Scheduler** decide em qual node cada Pod novo sera executado.

| Fase | Descricao |
|------|-----------|
| **Filtering** | Elimina nodes que nao atendem requisitos (recursos, taints, affinity) |
| **Scoring** | Pontua nodes validos por preferencias (spread, resources, affinity) |
| **Binding** | Atribui o Pod ao node com maior pontuacao |

**Fatores de decisao:**
- Recursos disponiveis (CPU, memoria)
- Taints e tolerations
- Node affinity e anti-affinity
- Pod affinity e anti-affinity
- Resource requests e limits

### Controller Manager (kube-controller-manager)

O **Controller Manager** executa os loops de controle que monitoram e reconciliam o estado do cluster.

| Controller | Funcao |
|-----------|--------|
| **ReplicaSet Controller** | Garante numero correto de replicas |
| **Deployment Controller** | Gerencia rollouts e rollbacks |
| **Node Controller** | Monitora saude dos nodes |
| **Job Controller** | Gerencia execucao de Jobs |
| **Service Account Controller** | Cria ServiceAccounts default |
| **Endpoint Controller** | Popula Endpoints de Services |

**Padrao Reconciliation Loop:**
\`\`\`
  ┌──────────────┐
  │ Estado Atual  │
  │ (Observed)    │
  └──────┬───────┘
         │ compara
  ┌──────▼───────┐     ┌──────────────┐
  │  Diferenca?   │────►│ Toma Acao    │
  │  (Drift)      │ sim │ (Reconcile)  │
  └──────┬───────┘     └──────────────┘
         │ nao
    ┌────▼────┐
    │  OK     │
    │ (idle)  │
    └─────────┘
\`\`\`

### Cloud Controller Manager

Componente **opcional** que integra o cluster com APIs de provedores de nuvem (AWS, GCP, Azure):

- **Node Controller**: Detecta quando VMs sao deletadas no provider
- **Route Controller**: Configura rotas na infraestrutura de rede
- **Service Controller**: Cria load balancers para Services tipo LoadBalancer

---

## Worker Nodes

Os Worker Nodes executam os workloads (Pods) e reportam status ao Control Plane.

### Kubelet

O **kubelet** e o agente que roda em cada node e garante que os containers estao rodando conforme especificado.

| Funcao | Detalhe |
|--------|---------|
| **Registrar node** | Registra o node no API Server |
| **Watch pods** | Observa PodSpecs atribuidos ao seu node |
| **Gerenciar containers** | Comunica com container runtime via CRI |
| **Health checks** | Executa liveness, readiness e startup probes |
| **Reportar status** | Envia status do node e pods ao API Server |

**Kubelet NAO gerencia containers que nao foram criados pelo Kubernetes** (containers Docker manuais, por exemplo).

### Kube-proxy

O **kube-proxy** gerencia as regras de rede em cada node para permitir comunicacao com os Services.

| Modo | Descricao |
|------|-----------|
| **iptables** | Regras iptables para roteamento (padrao) |
| **IPVS** | IP Virtual Server, melhor performance em grande escala |
| **userspace** | Legado, nao recomendado |

**Funcao principal:** Traduzir Service IPs (ClusterIP) para Pod IPs reais.

### Container Runtime

O **Container Runtime** executa os containers propriamente ditos. Deve implementar a interface **CRI** (Container Runtime Interface).

| Runtime | Status | Nota |
|---------|--------|------|
| **containerd** | CNCF Graduated, mais usado | Extraido do Docker, CRI nativo |
| **CRI-O** | CNCF, alternativa | Otimizado para K8s, Red Hat |
| **Docker** | Removido na v1.24 | dockershim removido, Docker Engine nao implementa CRI |

**Importante:** Docker foi removido como runtime na v1.24. Imagens Docker continuam funcionando (sao OCI-compliant), mas o Docker Engine como runtime nao e mais suportado.

---

## Objetos Fundamentais do Kubernetes

### Pod

O **Pod** e a menor unidade deployavel no Kubernetes. Contém um ou mais containers que compartilham:
- Namespace de rede (mesmo IP)
- Volumes de armazenamento
- Namespace de IPC

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  containers:
  - name: app
    image: nginx:1.25
    ports:
    - containerPort: 80
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 256Mi
\`\`\`

### Workload Resources

| Recurso | Funcao | Caso de Uso |
|---------|--------|-------------|
| **Deployment** | Gerencia ReplicaSets, rolling updates | Apps stateless |
| **StatefulSet** | Pods com identidade estavel e storage persistente | Bancos de dados |
| **DaemonSet** | Um Pod por node | Agents de monitoramento, log collectors |
| **Job** | Executa ate completar com sucesso | Tarefas batch |
| **CronJob** | Jobs agendados | Backups periodicos |
| **ReplicaSet** | Mantem N replicas de um Pod | Gerenciado pelo Deployment (nao usar direto) |

### Services

Services fornecem **descoberta e balanceamento de carga** para um conjunto de Pods.

| Tipo | Descricao | Acesso |
|------|-----------|--------|
| **ClusterIP** | IP interno do cluster (padrao) | Apenas dentro do cluster |
| **NodePort** | Expoe em uma porta de cada node (30000-32767) | Externo via node IP:porta |
| **LoadBalancer** | Provisiona load balancer externo (cloud) | Externo via LB IP |
| **ExternalName** | Alias DNS para servico externo | DNS CNAME |

### Namespaces

**Namespaces** sao particoes logicas do cluster para isolamento e organizacao.

Namespaces padrao:
- \`default\` — namespace padrao
- \`kube-system\` — componentes do sistema (CoreDNS, kube-proxy)
- \`kube-public\` — recursos publicos (cluster-info ConfigMap)
- \`kube-node-lease\` — heartbeats dos nodes

---

## Comunicacao no Cluster

### Pod-to-Pod

Todos os Pods podem se comunicar diretamente entre si sem NAT (requisito do modelo de rede K8s). Implementado por **CNI plugins** (Calico, Cilium, Flannel, Weave).

### Pod-to-Service

Pods acessam Services via DNS:
\`\`\`
<service-name>.<namespace>.svc.cluster.local
\`\`\`

Resolvido pelo **CoreDNS** (CNCF Graduated) que roda como Deployment no kube-system.

### External-to-Service

Trafego externo entra via:
- **Ingress** — roteamento HTTP/HTTPS baseado em host/path
- **LoadBalancer** Services — L4 load balancing
- **NodePort** Services — acesso direto via porta do node

---

## Modelo Declarativo

Kubernetes usa um **modelo declarativo**: voce declara o estado desejado (desired state) e o sistema trabalha para alcanca-lo.

\`\`\`
Imperativo:  "Crie 3 pods nginx"        → kubectl run
Declarativo: "Deve haver 3 pods nginx"  → kubectl apply -f deployment.yaml
\`\`\`

| Aspecto | Imperativo | Declarativo |
|---------|-----------|-------------|
| **Comando** | kubectl run, kubectl create | kubectl apply |
| **Idempotencia** | Nao | Sim |
| **Versionamento** | Dificil | Facil (YAML no Git) |
| **Producao** | Nao recomendado | Recomendado |

---

## Design Principles do Kubernetes

1. **Declarativo sobre imperativo** — declare o estado desejado, nao os passos
2. **Reconciliation loops** — controllers observam e corrigem desvios
3. **API-centric** — tudo e um recurso acessivel via API
4. **Extensibilidade** — CRDs, operators, plugins
5. **Portabilidade** — roda em qualquer infraestrutura (cloud, on-prem, edge)
6. **Automacao** — self-healing, auto-scaling, rolling updates

---

## kubectl — A Ferramenta CLI

**kubectl** e a CLI oficial para interagir com o Kubernetes via API Server.

| Comando | Funcao |
|---------|--------|
| \`kubectl get\` | Listar recursos |
| \`kubectl describe\` | Detalhes de um recurso |
| \`kubectl apply -f\` | Criar/atualizar declarativamente |
| \`kubectl delete\` | Remover recurso |
| \`kubectl logs\` | Ver logs de container |
| \`kubectl exec\` | Executar comando em container |
| \`kubectl port-forward\` | Encaminhar porta local para pod |

### Contexts e kubeconfig

O arquivo \`~/.kube/config\` (kubeconfig) define:
- **Clusters** — endereco do API Server e CA
- **Users** — credenciais (certificados, tokens)
- **Contexts** — combinacao cluster + user + namespace

\`\`\`bash
kubectl config get-contexts        # Listar contexts
kubectl config use-context <name>  # Mudar de context
kubectl config current-context     # Ver context atual
\`\`\`

---

## Erros Comuns no KCNA

1. **Achar que kubectl fala direto com etcd** — kubectl fala com API Server, que fala com etcd
2. **Confundir Scheduler com Controller Manager** — Scheduler ATRIBUI pods a nodes; Controller Manager RECONCILIA estado
3. **Achar que Docker ainda e o runtime padrao** — Docker (dockershim) foi removido na v1.24; containerd e o padrao
4. **Confundir Pod com Container** — Pod pode ter multiplos containers; Pod e a unidade minima, nao container
5. **Nao saber que etcd e o unico stateful** — se etcd morre sem backup, o cluster perde todo o estado
6. **Confundir ClusterIP com NodePort** — ClusterIP e interno; NodePort expoe externamente
`,

  quiz: [
    {
      question: 'Qual componente do Kubernetes armazena todo o estado do cluster?',
      options: ['API Server', 'etcd', 'Controller Manager', 'Scheduler'],
      correct: 1,
      explanation: 'etcd e o banco de dados key-value distribuido que armazena TODO o estado do cluster (pods, services, secrets, configmaps, etc.). O API Server e o unico componente que acessa o etcd diretamente.',
      reference: 'etcd = unico stateful. API Server = frontend/gateway. Controller Manager = reconciliation.'
    },
    {
      question: 'Qual e a funcao do kube-scheduler?',
      options: [
        'Gerenciar os loops de controle que reconciliam estado',
        'Armazenar estado do cluster em formato key-value',
        'Decidir em qual node cada Pod novo sera executado',
        'Gerenciar regras de rede para Services'
      ],
      correct: 2,
      explanation: 'O Scheduler decide em qual node um Pod sera executado usando duas fases: Filtering (elimina nodes inadequados) e Scoring (pontua e escolhe o melhor). Controller Manager reconcilia estado. etcd armazena. kube-proxy gerencia rede.',
      reference: 'Scheduler: Filtering -> Scoring -> Binding. Controller Manager: reconciliation loops.'
    },
    {
      question: 'Qual container runtime substituiu o Docker como padrao no Kubernetes 1.24+?',
      options: ['CRI-O', 'containerd', 'rkt', 'Docker Engine'],
      correct: 1,
      explanation: 'containerd (CNCF Graduated) e o container runtime mais usado apos a remocao do dockershim na v1.24. CRI-O e uma alternativa. Docker Engine nao implementa CRI diretamente. rkt foi descontinuado.',
      reference: 'containerd = padrao pos-1.24. CRI-O = alternativa. Docker removido (dockershim). Imagens Docker continuam funcionando (OCI).'
    },
    {
      question: 'Como os Pods se comunicam entre si no Kubernetes?',
      options: [
        'Via NAT configurado pelo kube-proxy',
        'Diretamente via IP, sem NAT — requisito do modelo de rede implementado por CNI plugins',
        'Apenas atraves de Services ClusterIP',
        'Via mensagens no etcd'
      ],
      correct: 1,
      explanation: 'O modelo de rede do Kubernetes exige que todos os Pods possam se comunicar diretamente sem NAT. Isso e implementado por CNI plugins (Calico, Cilium, Flannel). Services adicionam service discovery e load balancing sobre essa comunicacao.',
      reference: 'Pod-to-Pod: direto sem NAT (CNI). Pod-to-Service: DNS (CoreDNS). Externo: Ingress/LB/NodePort.'
    },
    {
      question: 'Qual afirmacao sobre o kubelet e CORRETA?',
      options: [
        'Roda apenas no control plane e gerencia o API Server',
        'E um agente em cada worker node que gerencia containers via CRI e reporta status',
        'E o mesmo que kube-proxy',
        'Gerencia o etcd e seus backups'
      ],
      correct: 1,
      explanation: 'O kubelet roda em cada node (inclusive control plane nodes). Ele observa PodSpecs atribuidos ao seu node, comunica com o container runtime via CRI, executa health checks e reporta status ao API Server.',
      reference: 'kubelet = agente no node, gerencia pods via CRI. kube-proxy = regras de rede. etcd = API Server gerencia.'
    },
    {
      question: 'Qual tipo de Service expoe um aplicativo para acesso externo via porta do node?',
      options: ['ClusterIP', 'NodePort', 'ExternalName', 'InternalLB'],
      correct: 1,
      explanation: 'NodePort expoe o Service em uma porta estatica (30000-32767) de cada node, permitindo acesso externo via <nodeIP>:<nodePort>. ClusterIP e interno. ExternalName e alias DNS. LoadBalancer provisiona um LB externo.',
      reference: 'ClusterIP = interno. NodePort = porta no node. LoadBalancer = LB externo. ExternalName = DNS CNAME.'
    },
    {
      question: 'Qual e a diferenca entre o modelo imperativo e declarativo no Kubernetes?',
      options: [
        'Imperativo usa YAML, declarativo usa comandos CLI',
        'Imperativo diz "o que fazer agora", declarativo diz "como deve ser o estado" e o sistema reconcilia',
        'Nao ha diferenca — sao sinonimos',
        'Imperativo e para producao, declarativo e para desenvolvimento'
      ],
      correct: 1,
      explanation: 'No modelo imperativo voce diz "crie 3 pods" (kubectl run). No declarativo voce diz "deve haver 3 pods" (kubectl apply -f). O declarativo e idempotente, versionavel e recomendado para producao.',
      reference: 'Imperativo: kubectl run/create. Declarativo: kubectl apply -f. Producao = declarativo + GitOps.'
    },
    {
      question: 'Qual componente resolve nomes DNS de Services dentro do cluster?',
      options: ['kube-proxy', 'CoreDNS', 'etcd', 'Ingress Controller'],
      correct: 1,
      explanation: 'CoreDNS (CNCF Graduated) roda como Deployment no kube-system e resolve nomes de Services no formato <service>.<namespace>.svc.cluster.local. kube-proxy gerencia regras de rede, nao DNS.',
      reference: 'CoreDNS = DNS interno do cluster. kube-proxy = regras de rede (iptables/IPVS). Ingress = HTTP routing externo.'
    },
    {
      question: 'Um Deployment no Kubernetes gerencia diretamente qual recurso?',
      options: ['Pods', 'ReplicaSets', 'Services', 'Nodes'],
      correct: 1,
      explanation: 'Um Deployment gerencia ReplicaSets (nao Pods diretamente). O ReplicaSet e quem cria e mantem os Pods. Ao fazer um rolling update, o Deployment cria um novo ReplicaSet e escala o antigo para zero.',
      reference: 'Deployment -> ReplicaSet -> Pods. Rolling update = novo RS sobe, antigo RS desce.'
    },
    {
      question: 'Qual namespace padrao do Kubernetes contem os componentes de sistema como CoreDNS e kube-proxy?',
      options: ['default', 'kube-system', 'kube-public', 'kube-node-lease'],
      correct: 1,
      explanation: 'kube-system contem componentes do sistema: CoreDNS, kube-proxy, metrics-server, etc. default e o namespace padrao para workloads. kube-public tem recursos publicos. kube-node-lease tem heartbeats dos nodes.',
      reference: 'kube-system = sistema. default = workloads. kube-public = publico. kube-node-lease = heartbeats.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os componentes do Control Plane?', back: 'API Server (gateway REST), etcd (key-value store), Scheduler (atribui pods a nodes), Controller Manager (reconciliation loops), Cloud Controller Manager (opcional, integra com cloud providers).' },
    { front: 'Quais sao os componentes de um Worker Node?', back: 'kubelet (agente que gerencia pods via CRI), kube-proxy (regras de rede para Services), Container Runtime (containerd/CRI-O, executa containers).' },
    { front: 'O que e etcd e por que e critico?', back: 'Banco de dados key-value distribuido (protocolo Raft) que armazena TODO o estado do cluster. E o unico componente stateful. Perder etcd sem backup = perder o cluster. Acessado APENAS via API Server.' },
    { front: 'Qual e o fluxo de uma requisicao kubectl apply?', back: 'kubectl -> API Server -> Authentication -> Authorization (RBAC) -> Admission Controllers (Mutating + Validating) -> etcd (persist). Controller Manager observa, Scheduler atribui node, kubelet executa.' },
    { front: 'Quais sao os 4 tipos de Service?', back: 'ClusterIP (IP interno, padrao), NodePort (porta 30000-32767 em cada node), LoadBalancer (LB externo via cloud), ExternalName (alias DNS CNAME para servico externo).' },
    { front: 'O que o kube-scheduler faz em 3 fases?', back: 'Filtering (elimina nodes que nao atendem requisitos), Scoring (pontua nodes por preferencias), Binding (atribui Pod ao node vencedor). Fatores: recursos, taints, affinity, requests/limits.' },
    { front: 'Qual a diferenca entre Deployment, StatefulSet e DaemonSet?', back: 'Deployment = apps stateless (rolling updates). StatefulSet = apps stateful (identidade estavel, storage persistente). DaemonSet = 1 pod por node (agents, log collectors).' },
    { front: 'O que e um Pod?', back: 'Menor unidade deployavel no K8s. Contem 1+ containers que compartilham IP de rede, volumes e namespace IPC. Pods sao efemeros — nao sao reutilizados apos morrer.' },
    { front: 'O que e CRI e por que Docker foi removido?', back: 'CRI = Container Runtime Interface, padrao para runtimes no K8s. Docker Engine nao implementa CRI (usava dockershim como adaptador). dockershim removido na v1.24. containerd e CRI-O implementam CRI nativamente.' },
    { front: 'Declarativo vs Imperativo no Kubernetes?', back: 'Imperativo: "crie 3 pods" (kubectl run/create). Declarativo: "deve haver 3 pods" (kubectl apply -f). Declarativo e idempotente, versionavel (GitOps) e recomendado para producao.' }
  ],

  lab: {
    scenario: 'Voce tem acesso a um cluster Kubernetes e precisa explorar sua arquitetura, identificar componentes do control plane e worker nodes, e entender como se comunicam.',
    objective: 'Identificar componentes do cluster, entender a arquitetura e navegar pelos recursos basicos.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Explorar os componentes do Control Plane',
        instruction: 'Liste os pods do namespace kube-system e identifique os componentes do control plane.',
        hints: ['kubectl get pods -n kube-system', 'Procure: kube-apiserver, etcd, kube-scheduler, kube-controller-manager'],
        solution: '```bash\n# Listar pods do control plane\nkubectl get pods -n kube-system\n\n# Componentes esperados:\n# etcd-<node>                    -> banco de dados key-value\n# kube-apiserver-<node>          -> API Server\n# kube-scheduler-<node>          -> Scheduler\n# kube-controller-manager-<node> -> Controller Manager\n# coredns-*                      -> DNS do cluster\n# kube-proxy-*                   -> Proxy de rede\n```',
        verify: '```bash\n# Deve listar pelo menos etcd, apiserver, scheduler, controller-manager\nkubectl get pods -n kube-system --no-headers | grep -E "etcd|apiserver|scheduler|controller" | wc -l\n# Deve retornar >= 4\n```'
      },
      {
        title: 'Verificar informacoes dos nodes',
        instruction: 'Liste os nodes do cluster, identifique quais sao control plane e workers, e verifique o container runtime.',
        hints: ['kubectl get nodes -o wide', 'Nodes de control plane tem o label node-role.kubernetes.io/control-plane'],
        solution: '```bash\n# Listar nodes com detalhes\nkubectl get nodes -o wide\n\n# Saida inclui:\n# NAME, STATUS, ROLES, AGE, VERSION, INTERNAL-IP, OS-IMAGE, KERNEL, CONTAINER-RUNTIME\n\n# Ver labels dos nodes\nkubectl get nodes --show-labels\n\n# Ver detalhes de um node especifico\nkubectl describe node <node-name> | head -30\n```',
        verify: '```bash\n# Deve mostrar pelo menos 1 node Ready\nkubectl get nodes --no-headers | grep Ready | wc -l\n# Deve retornar >= 1\n\n# Verificar container runtime\nkubectl get nodes -o jsonpath=\'{.items[*].status.nodeInfo.containerRuntimeVersion}\'\n# Deve mostrar containerd:// ou cri-o://\n```'
      },
      {
        title: 'Explorar o modelo declarativo com Deployments',
        instruction: 'Crie um Deployment simples e observe como o Kubernetes gerencia o estado desejado automaticamente.',
        hints: ['kubectl create deployment nginx --image=nginx:1.25 --replicas=3', 'kubectl get deploy,rs,pods'],
        solution: '```bash\n# Criar deployment\nkubectl create deployment nginx-test --image=nginx:1.25-alpine --replicas=3\n\n# Observar a hierarquia: Deployment -> ReplicaSet -> Pods\nkubectl get deployment nginx-test\nkubectl get replicaset -l app=nginx-test\nkubectl get pods -l app=nginx-test\n\n# Testar self-healing: deletar um Pod e ver que outro e criado\nkubectl delete pod $(kubectl get pods -l app=nginx-test -o jsonpath=\'{.items[0].metadata.name}\')\nkubectl get pods -l app=nginx-test\n# Deve voltar a ter 3 pods (reconciliation loop do ReplicaSet controller)\n\n# Limpar\nkubectl delete deployment nginx-test\n```',
        verify: '```bash\n# Enquanto deployment existe, deve ter 3 pods\nkubectl get deployment nginx-test -o jsonpath=\'{.status.readyReplicas}\'\n# Deve retornar 3\n\n# Apos limpar\nkubectl get deployment nginx-test 2>&1 | grep "not found"\n```'
      }
    ]
  },

  troubleshooting: []
};
