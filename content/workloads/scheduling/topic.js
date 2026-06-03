window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['workloads/scheduling'] = {
  theory: `# Agendamento de Pods (Pod Scheduling)

## Visao Geral

O scheduler do Kubernetes e responsavel por decidir em qual node um Pod sera executado. O processo considera recursos disponiveis, restricoes definidas pelo usuario e politicas do cluster.

### Diagrama: Fluxo do kube-scheduler

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                   FLUXO DO KUBE-SCHEDULER                       │
│                                                                 │
│  Pod criado sem              ┌──────────────────┐               │
│  spec.nodeName ──────────>   │  FILTERING        │               │
│  (Pending)                   │  (Predicates)     │               │
│                              │                   │               │
│                              │  Elimina nodes    │               │
│                              │  que NAO atendem: │               │
│                              │  - Recursos       │               │
│                              │  - Taints         │               │
│                              │  - Affinity       │               │
│                              │  - Port conflicts │               │
│                              └────────┬──────────┘               │
│                                       │                         │
│                                       ▼                         │
│                              ┌──────────────────┐               │
│  Nenhum node                 │  SCORING          │               │
│  passou? ──> Pod             │  (Priorities)     │               │
│  fica Pending                │                   │               │
│                              │  Pontua nodes     │               │
│                              │  restantes por:   │               │
│                              │  - Balance de     │               │
│                              │    recursos       │               │
│                              │  - Affinity       │               │
│                              │    preference     │               │
│                              │  - Spreading      │               │
│                              └────────┬──────────┘               │
│                                       │                         │
│                                       ▼                         │
│                              ┌──────────────────┐               │
│                              │  BINDING          │               │
│                              │  Atribui o node   │               │
│                              │  com maior score  │               │
│                              │  ao Pod           │               │
│                              └──────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

### Fases do Scheduling em detalhe

| Fase | Funcao | Exemplos |
|------|--------|----------|
| Filtering | Eliminar nodes invalidos | Recursos insuficientes, taints, nodeSelector |
| Scoring | Pontuar nodes validos | Balanceamento de uso, affinity weight |
| Binding | Atribuir o Pod ao node | Cria o binding no API Server |

---

## nodeName - Atribuicao Direta

A forma mais direta de agendamento. Pula completamente o scheduler.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: fixed-node-pod
spec:
  nodeName: worker-1
  containers:
  - name: app
    image: nginx:1.25
\`\`\`

**Desvantagens do nodeName:**
- Ignora taints, affinity e todas as regras do scheduler
- Se o node nao existir, o Pod fica em Pending eternamente
- Se o node nao tiver recursos, o Pod e expulso
- Nao recomendado em producao (exceto para debug)

---

## nodeSelector

A forma mais simples de agendar Pods em nodes especificos. Usa labels do node para selecionar destinos.

\`\`\`bash
# Adicionar label a um node
kubectl label node worker-1 disktype=ssd

# Verificar labels do node
kubectl get nodes --show-labels

# Remover uma label
kubectl label node worker-1 disktype-
\`\`\`

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: ssd-pod
spec:
  nodeSelector:
    disktype: ssd
  containers:
  - name: app
    image: nginx:1.25
\`\`\`

### Labels automaticas dos nodes

O Kubernetes adiciona labels automaticamente a cada node:

| Label | Exemplo | Descricao |
|-------|---------|-----------|
| kubernetes.io/hostname | worker-1 | Nome do host |
| kubernetes.io/os | linux | Sistema operacional |
| kubernetes.io/arch | amd64 | Arquitetura CPU |
| topology.kubernetes.io/zone | us-east-1a | Zona de disponibilidade |
| topology.kubernetes.io/region | us-east-1 | Regiao |
| node.kubernetes.io/instance-type | m5.xlarge | Tipo de instancia (cloud) |

---

## Node Affinity

Mais expressiva que nodeSelector, permite regras obrigatorias e preferenciais.

### Required (obrigatoria - hard)

O Pod SO agenda se a regra for atendida. Caso contrario, fica Pending.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: topology.kubernetes.io/zone
            operator: In
            values:
            - us-east-1a
            - us-east-1b
          - key: kubernetes.io/arch
            operator: In
            values:
            - amd64
  containers:
  - name: app
    image: nginx:1.25
\`\`\`

**Nota**: Multiplos \`matchExpressions\` dentro do MESMO \`nodeSelectorTerms\` sao AND. Multiplos \`nodeSelectorTerms\` sao OR.

### Preferred (preferencial - soft)

O scheduler TENTA atender a preferencia, mas agenda em outro node se necessario.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
spec:
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 80
        preference:
          matchExpressions:
          - key: disktype
            operator: In
            values:
            - ssd
      - weight: 20
        preference:
          matchExpressions:
          - key: cpu-type
            operator: In
            values:
            - high-performance
  containers:
  - name: app
    image: nginx:1.25
\`\`\`

O \`weight\` (1-100) controla a prioridade relativa entre preferencias. Maior peso = maior influencia na decisao do scheduler.

### Operadores validos para matchExpressions

| Operador | Descricao | Requer values? |
|----------|-----------|----------------|
| In | O valor da label esta na lista | Sim |
| NotIn | O valor da label NAO esta na lista | Sim |
| Exists | A label existe (sem verificar o valor) | Nao |
| DoesNotExist | A label NAO existe | Nao |
| Gt | O valor e MAIOR que o especificado (numerico) | Sim (1 valor) |
| Lt | O valor e MENOR que o especificado (numerico) | Sim (1 valor) |

### Comparacao: nodeSelector vs nodeAffinity

| Aspecto | nodeSelector | nodeAffinity |
|---------|-------------|-------------|
| Sintaxe | Simples (key: value) | Complexa (matchExpressions) |
| Operadores | Apenas igualdade | In, NotIn, Exists, DoesNotExist, Gt, Lt |
| Regras suaves | Nao | Sim (preferred) |
| Pesos | Nao | Sim (weight 1-100) |
| Multiplas condicoes | AND apenas | AND + OR |
| Recomendacao | Labs e casos simples | Producao |

---

## Pod Affinity e Pod Anti-Affinity

Permitem agendar Pods em relacao a OUTROS Pods ja em execucao (nao em relacao a nodes).

### Diagrama: Pod Affinity vs Anti-Affinity

\`\`\`
Pod Affinity (co-localizacao):                Pod Anti-Affinity (separacao):
┌─────────────────────┐                       ┌──────────┐  ┌──────────┐
│       Node-1        │                       │  Node-1  │  │  Node-2  │
│  ┌──────┐ ┌──────┐  │                       │ ┌──────┐ │  │ ┌──────┐ │
│  │Cache │ │Backend│  │                       │ │Web-1 │ │  │ │Web-2 │ │
│  │Redis │ │App   │  │                       │ └──────┘ │  │ └──────┘ │
│  └──────┘ └──────┘  │                       └──────────┘  └──────────┘
│  "Cache PERTO do    │                       ┌──────────┐
│   Backend"          │                       │  Node-3  │
└─────────────────────┘                       │ ┌──────┐ │
                                              │ │Web-3 │ │
                                              │ └──────┘ │
                                              └──────────┘
                                              "Cada replica em
                                               node diferente"
\`\`\`

### Pod Affinity (co-localizacao)

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: cache-pod
spec:
  affinity:
    podAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
          - key: app
            operator: In
            values:
            - backend
        topologyKey: kubernetes.io/hostname
  containers:
  - name: cache
    image: redis:7
\`\`\`

### Pod Anti-Affinity (separacao)

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - web
            topologyKey: kubernetes.io/hostname
      containers:
      - name: web
        image: nginx:1.25
\`\`\`

### topologyKey - Chave para Entender

O \`topologyKey\` define o escopo da regra:

| topologyKey | Escopo | Significado |
|-------------|--------|-------------|
| kubernetes.io/hostname | Node | Mesmo/diferente node |
| topology.kubernetes.io/zone | Zona | Mesma/diferente zona AZ |
| topology.kubernetes.io/region | Regiao | Mesma/diferente regiao |

---

## Topology Spread Constraints

Controle mais granular da distribuicao de Pods entre dominios de topologia (nodes, zonas, regioes).

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-balanced
spec:
  replicas: 6
  selector:
    matchLabels:
      app: web-balanced
  template:
    metadata:
      labels:
        app: web-balanced
    spec:
      topologySpreadConstraints:
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: DoNotSchedule
        labelSelector:
          matchLabels:
            app: web-balanced
      - maxSkew: 1
        topologyKey: kubernetes.io/hostname
        whenUnsatisfiable: ScheduleAnyway
        labelSelector:
          matchLabels:
            app: web-balanced
      containers:
      - name: web
        image: nginx:1.25
\`\`\`

### Parametros do TopologySpreadConstraint

| Campo | Descricao |
|-------|-----------|
| maxSkew | Diferenca maxima entre o dominio com mais e menos Pods (1 = equilibrado) |
| topologyKey | Label do node que define o dominio de topologia |
| whenUnsatisfiable | DoNotSchedule (hard) ou ScheduleAnyway (soft) |
| labelSelector | Seleciona quais Pods contar para o calculo |
| minDomains | Numero minimo de dominios (K8s 1.25+) |
| matchLabelKeys | Usa labels do Pod para calculo (K8s 1.27+) |

### Diferenca de Pod Anti-Affinity vs TopologySpreadConstraints

| Aspecto | Pod Anti-Affinity | TopologySpreadConstraints |
|---------|-------------------|--------------------------|
| Objetivo | Separar Pods | Distribuir IGUALMENTE |
| maxSkew | Nao tem (implicitamente max 1 por dominio) | Configuravel |
| Flexibilidade | Binario (tem ou nao tem) | Numerico (tolerancia de skew) |
| Performance | Pode ser lento com muitos Pods | Mais eficiente |
| Recomendacao | Casos simples | Balanceamento preciso |

---

## Taints e Tolerations

Taints impedem que Pods sejam agendados em nodes. Tolerations permitem que Pods tolerem taints especificos.

### Diagrama: Taints e Tolerations

\`\`\`
┌──────────────────────────────────────────────────────────┐
│  Node com Taint: gpu=true:NoSchedule                     │
│                                                          │
│  Pod SEM toleration:           Pod COM toleration:       │
│  ┌──────────┐                  ┌──────────┐              │
│  │ web-app  │ ──── REJEITADO   │ ml-job   │ ── ACEITO   │
│  │          │      ✗            │ toleration│     ✓       │
│  └──────────┘                  │ gpu=true  │             │
│                                └──────────┘              │
└──────────────────────────────────────────────────────────┘
\`\`\`

### Gerenciando Taints

\`\`\`bash
# Adicionar taint a um node
kubectl taint nodes worker-2 special=gpu:NoSchedule

# Ver taints de um node
kubectl describe node worker-2 | grep Taints

# Remover taint (adicionar - no final)
kubectl taint nodes worker-2 special=gpu:NoSchedule-

# Remover todos os taints de uma chave
kubectl taint nodes worker-2 special-
\`\`\`

### Efeitos de Taint

| Efeito | Novos Pods sem toleracao | Pods existentes sem toleracao |
|--------|--------------------------|-------------------------------|
| NoSchedule | NAO sao agendados | Permanecem rodando |
| PreferNoSchedule | Scheduler TENTA evitar | Permanecem rodando |
| NoExecute | NAO sao agendados | SAO EXPULSOS (com grace period) |

### Tolerations no Pod

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-pod
spec:
  tolerations:
  # Toleration exata: Equal
  - key: "special"
    operator: "Equal"
    value: "gpu"
    effect: "NoSchedule"
  # Toleration por existencia: Exists (qualquer valor)
  - key: "node-role.kubernetes.io/control-plane"
    operator: "Exists"
    effect: "NoSchedule"
  # Toleration com NoExecute e tolerationSeconds
  - key: "node.kubernetes.io/not-ready"
    operator: "Exists"
    effect: "NoExecute"
    tolerationSeconds: 300
  containers:
  - name: app
    image: nvidia/cuda:12.0-base
\`\`\`

### tolerationSeconds

Com NoExecute, o \`tolerationSeconds\` define por quanto tempo o Pod permanece no node apos o taint ser adicionado:

\`\`\`yaml
tolerations:
- key: "node.kubernetes.io/unreachable"
  operator: "Exists"
  effect: "NoExecute"
  tolerationSeconds: 60
  # Pod fica no node por 60s apos o node ficar unreachable
  # Se o node se recuperar antes, o Pod nao e expulso
\`\`\`

### Taints automaticos do Kubernetes

| Taint | Quando | Descricao |
|-------|--------|-----------|
| node.kubernetes.io/not-ready | Node NotReady | Node perdeu comunicacao |
| node.kubernetes.io/unreachable | Node Unreachable | Node inacessivel |
| node.kubernetes.io/memory-pressure | Pouca memoria | Node com pressao de RAM |
| node.kubernetes.io/disk-pressure | Pouco disco | Node com pressao de disco |
| node.kubernetes.io/pid-pressure | Muitos PIDs | Node com pressao de PIDs |
| node.kubernetes.io/unschedulable | Cordon | Node marcado como unschedulable |
| node-role.kubernetes.io/control-plane | Control plane | Nodes do control plane |

### Taint para reservar nodes

\`\`\`bash
# Reservar nodes para workloads especificos
# 1. Adicionar taint ao node
kubectl taint nodes gpu-node-1 dedicated=gpu:NoSchedule

# 2. Adicionar label (para nodeAffinity/nodeSelector)
kubectl label nodes gpu-node-1 hardware=gpu

# 3. Pods de GPU precisam de AMBOS: toleration + nodeSelector
# toleration: passa pelo "porteiro" (taint)
# nodeSelector: direciona para o node correto
\`\`\`

---

## Cordon, Drain e Uncordon

Usados para manutencao de nodes.

\`\`\`bash
# Cordon: marca o node como unschedulable (novos Pods nao sao agendados)
kubectl cordon worker-1
# Equivale a adicionar taint: node.kubernetes.io/unschedulable:NoSchedule

# Drain: remove todos os Pods do node (exceto DaemonSets)
kubectl drain worker-1 --ignore-daemonsets --delete-emptydir-data

# Drain com timeout e force
kubectl drain worker-1 \\
  --ignore-daemonsets \\
  --delete-emptydir-data \\
  --timeout=120s \\
  --force         # Forca remocao de pods standalone (sem controller)

# Uncordon: reabilita o agendamento no node
kubectl uncordon worker-1

# Verificar status do node
kubectl get nodes worker-1
\`\`\`

### Drain e PDB

O \`kubectl drain\` respeita PodDisruptionBudgets. Se um PDB impede a eviction, o drain fica bloqueado ate que a condicao seja satisfeita ou o timeout expire.

\`\`\`bash
# Drain com disable-eviction (ignora PDB - CUIDADO!)
kubectl drain worker-1 --ignore-daemonsets --disable-eviction
# Isso DELETA os pods em vez de usar a API de eviction
# Use apenas em emergencias
\`\`\`

---

## DaemonSets e Scheduling

DaemonSets garantem que um Pod rode em cada node (ou subset de nodes).

\`\`\`yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-collector
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: log-collector
  template:
    metadata:
      labels:
        app: log-collector
    spec:
      # Toleration para rodar INCLUSIVE no control plane
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      # nodeSelector para limitar a nodes especificos (opcional)
      # nodeSelector:
      #   monitoring: enabled
      containers:
      - name: collector
        image: fluentd:v1.16
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "200m"
            memory: "256Mi"
\`\`\`

### DaemonSet com nodeSelector

Para rodar o DaemonSet apenas em nodes com uma label especifica:

\`\`\`yaml
spec:
  template:
    spec:
      nodeSelector:
        monitoring: "true"
\`\`\`

\`\`\`bash
# Ativar o DaemonSet em um node especifico
kubectl label node worker-3 monitoring=true
# O Pod do DaemonSet e criado automaticamente nesse node

# Desativar
kubectl label node worker-3 monitoring-
# O Pod e removido automaticamente
\`\`\`

---

## Priority Classes e Preempcao

\`\`\`yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000000
globalDefault: false
description: "Pods criticos do sistema"
preemptionPolicy: PreemptLowerPriority
\`\`\`

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: critical-pod
spec:
  priorityClassName: high-priority
  containers:
  - name: app
    image: nginx:1.25
    resources:
      requests:
        cpu: "500m"
        memory: "256Mi"
\`\`\`

### Priority Classes built-in

| PriorityClass | Valor | Uso |
|---------------|-------|-----|
| system-cluster-critical | 2000000000 | Componentes criticos do cluster (kube-apiserver, etc.) |
| system-node-critical | 2000001000 | Componentes criticos do node (kubelet-level) |

### Fluxo de Preempcao

\`\`\`
Pod de alta prioridade criado
        │
        ▼
Nenhum node tem recursos? ──No──> Pod agendado normalmente
        │
       Yes
        │
        ▼
Scheduler identifica nodes onde,
removendo pods de menor prioridade,
haveria recursos suficientes
        │
        ▼
Pods de menor prioridade sao
expulsos (graceful termination)
        │
        ▼
Pod de alta prioridade e agendado
\`\`\`

### preemptionPolicy

| Policy | Comportamento |
|--------|---------------|
| PreemptLowerPriority (padrao) | Pode expulsar Pods de menor prioridade |
| Never | NAO expulsa outros Pods, fica Pending ate ter recursos |

---

## Scheduling Baseado em Recursos

O scheduler considera requests de CPU e memoria para decidir onde alocar o Pod.

\`\`\`yaml
resources:
  requests:       # Usado pelo scheduler para alocacao
    cpu: "250m"
    memory: "128Mi"
  limits:         # Limite maximo de uso
    cpu: "500m"
    memory: "256Mi"
\`\`\`

\`\`\`bash
# Ver recursos disponiveis nos nodes
kubectl describe nodes | grep -A5 "Allocatable:"

# Ver recursos ALOCADOS (requests somados) por node
kubectl describe nodes | grep -A10 "Allocated resources:"

# Metricas de uso real
kubectl top nodes
kubectl top pods --sort-by=cpu
\`\`\`

### Diferenca entre Allocatable e Alocado

| Conceito | Significado |
|----------|------------|
| Capacity | Recursos totais do node |
| Allocatable | Capacity - recursos reservados para sistema |
| Allocated (requests) | Soma dos requests de todos os Pods no node |
| Uso real (top) | Consumo efetivo (pode ser menor que requests) |
`,

  quiz: [
    {
      question: 'Qual e a diferenca entre "requiredDuringSchedulingIgnoredDuringExecution" e "preferredDuringSchedulingIgnoredDuringExecution" em Node Affinity?',
      options: [
        'Required e para nodes master, Preferred e para nodes worker',
        'Required e obrigatorio (Pod nao agenda se nao atender), Preferred e uma preferencia (Pod pode ir para outro node)',
        'Required verifica durante execucao, Preferred verifica apenas no agendamento',
        'Sao sinonimos com comportamentos identicos'
      ],
      correct: 1,
      explanation: '"requiredDuringScheduling" e uma restricao dura: se nenhum node atender, o Pod ficara Pending. "preferredDuringScheduling" e uma preferencia: o scheduler tenta atender, mas agenda em outro node se necessario. O sufixo "IgnoredDuringExecution" significa que Pods ja em execucao nao sao afetados se a regra mudar.'
    },
    {
      question: 'Qual e o efeito de taint que EXPULSA Pods ja em execucao no node?',
      options: [
        'NoSchedule',
        'PreferNoSchedule',
        'NoExecute',
        'Evict'
      ],
      correct: 2,
      explanation: '"NoExecute" e o unico efeito que expulsa Pods ja em execucao no node que nao possuem a toleracao correspondente. "NoSchedule" apenas impede novos agendamentos. "PreferNoSchedule" tenta evitar o node para novos Pods, mas nao garante.'
    },
    {
      question: 'Qual comando marca um node como indisponivel para novos agendamentos SEM remover os Pods existentes?',
      options: [
        'kubectl drain worker-1',
        'kubectl cordon worker-1',
        'kubectl taint nodes worker-1 NoSchedule',
        'kubectl uncordon worker-1'
      ],
      correct: 1,
      explanation: '"kubectl cordon" marca o node como Unschedulable, impedindo novos agendamentos, mas mantem os Pods existentes rodando. "kubectl drain" vai mais longe: cordona o node E remove todos os Pods existentes (exceto DaemonSets).'
    },
    {
      question: 'O que o campo "topologyKey" define em podAffinity/podAntiAffinity?',
      options: [
        'A label do Pod alvo que deve ser co-localizado',
        'O dominio de topologia onde a regra se aplica (ex: mesmo node, mesma zona)',
        'A prioridade da regra de affinity',
        'O numero maximo de Pods por node'
      ],
      correct: 1,
      explanation: '"topologyKey" define o nivel de topologia onde a regra se aplica. Usando "kubernetes.io/hostname", a regra se aplica por node (mesmo host). Usando "topology.kubernetes.io/zone", aplica-se por zona de disponibilidade. O scheduler agrupa nodes que tem o mesmo valor para essa label.'
    },
    {
      question: 'Qual a diferenca entre TopologySpreadConstraints e Pod Anti-Affinity para distribuir Pods?',
      options: [
        'Nao ha diferenca, sao sinonimos',
        'TopologySpreadConstraints distribui IGUALMENTE com maxSkew configuravel; Anti-Affinity e binario (tem ou nao tem Pod no dominio)',
        'Anti-Affinity e mais eficiente em clusters grandes',
        'TopologySpreadConstraints so funciona com zonas, nao com nodes'
      ],
      correct: 1,
      explanation: 'TopologySpreadConstraints permite definir um maxSkew (diferenca toleravel entre dominios), distribuindo Pods de forma equilibrada. Pod Anti-Affinity e binario: impede (ou tenta evitar) que 2 Pods fiquem no mesmo dominio. Para balanceamento preciso (ex: 6 Pods em 3 zonas = 2 por zona), use TopologySpreadConstraints.'
    },
    {
      question: 'Um node de control plane tem o taint "node-role.kubernetes.io/control-plane:NoSchedule". Para rodar um DaemonSet nele, o que o Pod precisa ter?',
      options: [
        'nodeSelector com node-role.kubernetes.io/control-plane: ""',
        'Uma toleration com key "node-role.kubernetes.io/control-plane", operator "Exists", effect "NoSchedule"',
        'priorityClassName: system-cluster-critical',
        'Nao e possivel rodar DaemonSets em nodes de control plane'
      ],
      correct: 1,
      explanation: 'O Pod do DaemonSet precisa de uma toleration que corresponda ao taint do control plane. Usando operator "Exists" com o key correto e effect "NoSchedule", o Pod pode ser agendado no node do control plane. nodeSelector direciona, mas sem toleration o taint bloqueia.'
    },
    {
      question: 'Qual label de node e usada pelo topologyKey para identificar diferentes nodes fisicos?',
      options: [
        'node.kubernetes.io/name',
        'kubernetes.io/hostname',
        'topology.kubernetes.io/node',
        'node-role.kubernetes.io/worker'
      ],
      correct: 1,
      explanation: '"kubernetes.io/hostname" e a label padrao adicionada automaticamente a cada node com o seu nome de host. Usando essa label no topologyKey, garante-se que a regra de affinity/anti-affinity seja avaliada por node individual.'
    },
    {
      question: 'O que acontece quando voce define spec.nodeName diretamente no Pod?',
      options: [
        'O scheduler avalia o node e agenda se possivel',
        'O Pod pula o scheduler completamente e e atribuido diretamente ao node, ignorando taints e affinity',
        'O Pod e agendado com prioridade maxima no node',
        'O kubelet rejeita o Pod se nao houver recursos'
      ],
      correct: 1,
      explanation: 'Definir spec.nodeName pula completamente o scheduler. O Pod e atribuido diretamente ao node especificado, sem verificar taints, affinity, recursos, ou quaisquer outras restricoes do scheduler. Se o node nao existir, o Pod fica Pending. Nao recomendado em producao.'
    },
    {
      question: 'No nodeAffinity, qual a relacao logica entre multiplas matchExpressions dentro do MESMO nodeSelectorTerms?',
      options: [
        'OR - qualquer uma pode ser satisfeita',
        'AND - todas devem ser satisfeitas',
        'XOR - exatamente uma deve ser satisfeita',
        'Depende do operador usado'
      ],
      correct: 1,
      explanation: 'Dentro do MESMO nodeSelectorTerms, multiplas matchExpressions sao combinadas com AND (todas devem ser satisfeitas). Entre diferentes nodeSelectorTerms, a relacao e OR (qualquer um pode ser satisfeito). Isso permite expressar logica complexa como "(zona=a AND arch=amd64) OR (zona=b AND arch=arm64)".'
    },
    {
      question: 'Um Pod tem toleration com tolerationSeconds: 300 para o taint "node.kubernetes.io/not-ready:NoExecute". O que acontece quando o node fica NotReady?',
      options: [
        'O Pod e imediatamente expulso do node',
        'O Pod permanece no node por 300 segundos. Se o node se recuperar antes, o Pod nao e expulso. Caso contrario, e expulso apos 300s',
        'O Pod e movido para outro node imediatamente',
        'Nada acontece, o Pod ignora o taint'
      ],
      correct: 1,
      explanation: 'tolerationSeconds define um "grace period" para taints NoExecute. O Pod permanece no node pelo tempo especificado (300s = 5 min). Se o node se recuperar (taint removido) antes do timeout, o Pod continua rodando normalmente. Se o timeout expirar, o Pod e expulso.'
    }
  ],

  flashcards: [
    {
      front: 'Quais sao as 3 fases do kube-scheduler?',
      back: '1. FILTERING (Predicates): Elimina nodes que NAO atendem os requisitos (recursos, taints, affinity required, ports).\n\n2. SCORING (Priorities): Pontua os nodes restantes com base em preferencias (balanceamento, affinity preferred, spreading).\n\n3. BINDING: Atribui o Pod ao node com maior score, criando o binding no API Server.\n\nSe nenhum node passa no filtering, o Pod fica Pending.'
    },
    {
      front: 'Qual a diferenca entre nodeSelector e nodeAffinity?',
      back: 'nodeSelector: selecao simples por label, apenas igualdade exata, obrigatorio.\n\nnodeAffinity: selecao expressiva com operadores (In, NotIn, Exists, Gt, Lt), suporta regras obrigatorias (required) e preferenciais (preferred) com pesos (weight 1-100). Muito mais flexivel para cenarios complexos.\n\nMultiplas matchExpressions no mesmo nodeSelectorTerms = AND\nMultiplos nodeSelectorTerms = OR'
    },
    {
      front: 'Quais sao os tres efeitos de Taint e o que cada um faz?',
      back: '1. NoSchedule: Novos Pods sem toleracao NAO sao agendados (existentes permanecem).\n2. PreferNoSchedule: Scheduler TENTA evitar (soft), mas pode agendar se necessario.\n3. NoExecute: Novos nao agendados E existentes sem toleracao SAO EXPULSOS.\n\nNoExecute aceita tolerationSeconds para grace period antes da expulsao.'
    },
    {
      front: 'Quais sao os taints automaticos que o Kubernetes adiciona aos nodes?',
      back: '- node.kubernetes.io/not-ready: Node NotReady\n- node.kubernetes.io/unreachable: Node inacessivel\n- node.kubernetes.io/memory-pressure: Pouca RAM\n- node.kubernetes.io/disk-pressure: Pouco disco\n- node.kubernetes.io/pid-pressure: Muitos PIDs\n- node.kubernetes.io/unschedulable: kubectl cordon\n- node-role.kubernetes.io/control-plane: Control plane\n\nPods do kube-system geralmente tem tolerations para estes taints.'
    },
    {
      front: 'Como funciona o TopologySpreadConstraints e para que serve maxSkew?',
      back: 'TopologySpreadConstraints distribui Pods IGUALMENTE entre dominios de topologia.\n\nmaxSkew: diferenca maxima toleravel entre o dominio com MAIS e MENOS Pods.\nmaxSkew=1: distribuicao perfeitamente equilibrada\nmaxSkew=2: tolera 2 pods de diferenca\n\nwhenUnsatisfiable:\n- DoNotSchedule: hard (nao agenda se violar)\n- ScheduleAnyway: soft (agenda mas tenta equilibrar)\n\nMais eficiente que Pod Anti-Affinity para clusters grandes.'
    },
    {
      front: 'Sequencia correta para realizar manutencao em um node?',
      back: '1. kubectl cordon <node>  # Impede novos agendamentos\n2. kubectl drain <node> --ignore-daemonsets --delete-emptydir-data  # Remove Pods\n3. [Realizar manutencao no node]\n4. kubectl uncordon <node>  # Reabilita agendamentos\n\nDrain respeita PDBs. Use --timeout para limite de tempo.\nUse --force para pods standalone (sem controller).\nNUNCA use --disable-eviction em producao (ignora PDBs).'
    },
    {
      front: 'O que e uma PriorityClass e como a preempcao funciona?',
      back: 'PriorityClass define a prioridade de Pods com um valor numerico (maior = mais prioritario).\n\nPreempcao:\n1. Pod de alta prioridade e criado\n2. Nenhum node tem recursos suficientes\n3. Scheduler identifica Pods de menor prioridade que podem ser expulsos\n4. Pods de menor prioridade recebem graceful termination\n5. Pod de alta prioridade e agendado\n\npreemptionPolicy: Never = nao expulsa, fica Pending\nBuilt-in: system-cluster-critical (2000000000), system-node-critical (2000001000)'
    },
    {
      front: 'Taints e Tolerations vs Node Affinity: qual a diferenca?',
      back: 'Taints/Tolerations:\n- Node REJEITA Pods sem toleracao\n- E um "porteiro" que bloqueia entrada\n- Nao garante que o Pod VA para aquele node\n\nNode Affinity:\n- Pod PREFERE/EXIGE ir para nodes com labels especificas\n- E um "imo" que atrai o Pod\n- Nao impede outros Pods de ir para o mesmo node\n\nPara reservar nodes, use AMBOS:\n- Taint no node: bloqueia Pods nao autorizados\n- Affinity no Pod: direciona para o node correto'
    },
    {
      front: 'Como o Pod Anti-Affinity e usado para garantir alta disponibilidade?',
      back: 'Pod Anti-Affinity com topologyKey: kubernetes.io/hostname garante que replicas do mesmo workload sejam distribuidas em nodes diferentes.\n\nUso tipico em Deployments:\npodAntiAffinity:\n  requiredDuringSchedulingIgnoredDuringExecution:\n  - labelSelector:\n      matchLabels: {app: minha-app}\n    topologyKey: kubernetes.io/hostname\n\nCom topologyKey: topology.kubernetes.io/zone, distribui entre zonas AZ.'
    },
    {
      front: 'Qual a diferenca entre nodeName e nodeSelector?',
      back: 'nodeName:\n- Atribuicao DIRETA ao node\n- Pula o scheduler completamente\n- Ignora taints, affinity, recursos\n- Se o node nao existir, Pod fica Pending\n- Uso: debug, testes\n\nnodeSelector:\n- Passa pelo scheduler normalmente\n- Verifica labels do node (igualdade)\n- Respeita taints e restricoes\n- Pode combinar com tolerations\n- Uso: producao (para casos simples)'
    }
  ],

  lab: {
    scenario: 'Um cluster de producao tem nodes com diferentes capacidades: alguns com SSD, outros com HDD, e um node de GPU reservado. Voce deve configurar agendamento para garantir que workloads criticos vao para os nodes certos, e realizar uma simulacao de manutencao.',
    objective: 'Configurar nodeAffinity, taints/tolerations, pod anti-affinity, topology spread constraints e executar um ciclo completo de manutencao de node',
    steps: [
      {
        title: 'Configurar labels e taints nos nodes',
        instruction: 'Liste os nodes do cluster. Adicione o label "disktype=ssd" ao primeiro node worker. Adicione um taint "workload=gpu:NoSchedule" ao segundo node worker para simular um node especializado.',
        hints: [
          'Use kubectl get nodes para listar os nodes',
          'kubectl label node <nome> chave=valor para adicionar label',
          'kubectl taint nodes <nome> chave=valor:Efeito para adicionar taint'
        ],
        solution: '```bash\n# Listar nodes\nkubectl get nodes\n\n# Armazenar nomes dos nodes\nNODE1=$(kubectl get nodes --no-headers | grep -v control-plane | awk \'NR==1{print $1}\')\nNODE2=$(kubectl get nodes --no-headers | grep -v control-plane | awk \'NR==2{print $1}\')\n\necho "Node1: $NODE1"\necho "Node2: $NODE2"\n\n# Adicionar label de SSD ao primeiro node\nkubectl label node $NODE1 disktype=ssd\n\n# Adicionar taint de GPU ao segundo node\nkubectl taint nodes $NODE2 workload=gpu:NoSchedule\n\n# Verificar\nkubectl get nodes --show-labels\nkubectl describe node $NODE2 | grep Taints\n```'
      },
      {
        title: 'Criar Pod com nodeAffinity required + preferred',
        instruction: 'Crie um Pod chamado `ssd-app` que: (1) OBRIGATORIAMENTE seja agendado em um node com label "disktype=ssd" (required). (2) PREFERENCIALMENTE em um node com label "kubernetes.io/arch=amd64" com peso 50 (preferred). Verifique em qual node foi agendado.',
        hints: [
          'requiredDuringSchedulingIgnoredDuringExecution para obrigatorio',
          'preferredDuringSchedulingIgnoredDuringExecution com weight para preferencia',
          'Ambos podem ser usados simultaneamente'
        ],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: Pod\nmetadata:\n  name: ssd-app\nspec:\n  affinity:\n    nodeAffinity:\n      requiredDuringSchedulingIgnoredDuringExecution:\n        nodeSelectorTerms:\n        - matchExpressions:\n          - key: disktype\n            operator: In\n            values:\n            - ssd\n      preferredDuringSchedulingIgnoredDuringExecution:\n      - weight: 50\n        preference:\n          matchExpressions:\n          - key: kubernetes.io/arch\n            operator: In\n            values:\n            - amd64\n  containers:\n  - name: app\n    image: nginx:1.25\n    resources:\n      requests:\n        cpu: "100m"\n        memory: "64Mi"\nEOF\n\n# Verificar\nkubectl get pod ssd-app -o wide\n```'
      },
      {
        title: 'Criar Pod com toleracao para node GPU',
        instruction: 'Crie um Pod chamado `gpu-app` que tolera o taint "workload=gpu:NoSchedule" e tambem usa nodeSelector para direcionar ao node com taint. Verifique que ele foi agendado no node com taint e que Pods normais NAO sao agendados nele.',
        hints: [
          'Toleration passa pelo taint, mas nao DIRECIONA para o node',
          'Precisa de nodeSelector ou nodeAffinity para garantir que va para o node correto',
          'kubectl describe pod para verificar o agendamento'
        ],
        solution: '```bash\n# Adicionar label ao node GPU\nkubectl label node $NODE2 hardware=gpu\n\n# Criar Pod com toleracao + nodeSelector\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: Pod\nmetadata:\n  name: gpu-app\nspec:\n  nodeSelector:\n    hardware: gpu\n  tolerations:\n  - key: "workload"\n    operator: "Equal"\n    value: "gpu"\n    effect: "NoSchedule"\n  containers:\n  - name: app\n    image: nginx:1.25\n    resources:\n      requests:\n        cpu: "100m"\n        memory: "64Mi"\nEOF\n\nkubectl get pod gpu-app -o wide\n# Deve estar no NODE2\n\n# Tentar criar Pod NORMAL no node GPU (sem toleration)\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: Pod\nmetadata:\n  name: normal-pod\nspec:\n  nodeSelector:\n    hardware: gpu\n  containers:\n  - name: app\n    image: nginx:1.25\nEOF\n\n# Verificar: normal-pod fica Pending (sem toleration)\nkubectl get pod normal-pod\nkubectl describe pod normal-pod | grep -A5 Events\nkubectl delete pod normal-pod\n```'
      },
      {
        title: 'Criar Deployment com Pod Anti-Affinity e TopologySpreadConstraints',
        instruction: 'Crie um Deployment chamado `web-app` com 4 replicas usando nginx:1.25. Configure TopologySpreadConstraints com maxSkew=1 e topologyKey=kubernetes.io/hostname usando DoNotSchedule. Verifique a distribuicao dos Pods.',
        hints: [
          'topologySpreadConstraints no spec.template.spec',
          'O labelSelector deve corresponder aos labels do Pod',
          'kubectl get pods -o wide para ver distribuicao'
        ],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web-app\nspec:\n  replicas: 4\n  selector:\n    matchLabels:\n      app: web-app\n  template:\n    metadata:\n      labels:\n        app: web-app\n    spec:\n      tolerations:\n      - key: "workload"\n        operator: "Equal"\n        value: "gpu"\n        effect: "NoSchedule"\n      topologySpreadConstraints:\n      - maxSkew: 1\n        topologyKey: kubernetes.io/hostname\n        whenUnsatisfiable: ScheduleAnyway\n        labelSelector:\n          matchLabels:\n            app: web-app\n      containers:\n      - name: web\n        image: nginx:1.25\n        resources:\n          requests:\n            cpu: "100m"\n            memory: "64Mi"\nEOF\n\n# Ver distribuicao\nkubectl get pods -l app=web-app -o wide\n```'
      },
      {
        title: 'Simular manutencao de node com cordon e drain',
        instruction: 'Simule uma manutencao no primeiro node worker: execute cordon para impedir novos agendamentos, depois drain para remover os Pods. Observe o rebalanceamento. Ao final, execute uncordon para reativar o node e limpe os recursos.',
        hints: [
          'kubectl cordon <node> para impedir novos Pods',
          'kubectl drain precisa de --ignore-daemonsets --delete-emptydir-data',
          'kubectl uncordon <node> para reativar'
        ],
        solution: '```bash\n# 1. Cordon: impedir novos agendamentos\nkubectl cordon $NODE1\nkubectl get nodes $NODE1\n\n# 2. Drain: remover Pods existentes\nkubectl drain $NODE1 \\\n  --ignore-daemonsets \\\n  --delete-emptydir-data\n\n# Pods rebalanceados\nkubectl get pods -l app=web-app -o wide\n\n# 3. Reativar o node\nkubectl uncordon $NODE1\nkubectl get nodes $NODE1\n\n# Limpar todos os recursos do lab\nkubectl delete deployment web-app\nkubectl delete pod ssd-app gpu-app\nkubectl taint nodes $NODE2 workload=gpu:NoSchedule-\nkubectl label node $NODE1 disktype-\nkubectl label node $NODE2 hardware-\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod em estado Pending por restricoes de scheduling',
      symptom: 'Pod fica em estado Pending indefinidamente. "kubectl get pod" mostra STATUS=Pending. Pode ocorrer por nodeAffinity nao satisfeita, taint sem toleracao, ou recursos insuficientes.',
      diagnosis: '```bash\n# 1. Ver o Pod em Pending\nkubectl get pod <nome-do-pod> -o wide\n\n# 2. Descrever o Pod para ver o motivo\nkubectl describe pod <nome-do-pod>\n# Procurar na secao "Events":\n# "0/3 nodes are available: 3 node(s) didn\'t match Pod\'s node affinity/selector"\n# "0/3 nodes are available: 3 node(s) had untolerated taint"\n# "0/3 nodes are available: Insufficient cpu"\n# "0/3 nodes are available: 1 node(s) didn\'t match pod topology spread constraints"\n\n# 3. Verificar labels dos nodes\nkubectl get nodes --show-labels\n\n# 4. Verificar taints dos nodes\nkubectl describe nodes | grep -A3 Taints\n\n# 5. Verificar recursos disponiveis\nkubectl describe nodes | grep -A8 "Allocated resources"\nkubectl top nodes\n```',
      solution: '```bash\n# Para nodeAffinity nao satisfeita:\n# Adicionar a label necessaria ao node correto\nkubectl label node <nome-do-node> <chave>=<valor>\n\n# Para taint sem toleracao:\n# Opcao 1: Adicionar toleracao ao Pod\n# Opcao 2: Remover o taint do node\nkubectl taint nodes <nome-do-node> <chave>=<valor>:<efeito>-\n\n# Para recursos insuficientes:\nkubectl top nodes\n# Reduzir requests do Pod ou adicionar nodes\n\n# Para TopologySpreadConstraints violado:\n# Verificar distribuicao atual dos Pods\nkubectl get pods -l <label> -o wide\n# Aumentar maxSkew ou usar ScheduleAnyway\n\n# Verificar se o Pod ficou Running\nkubectl get pod <nome-do-pod> -w\n```'
    },
    {
      title: 'kubectl drain bloqueado por PodDisruptionBudget',
      symptom: 'O "kubectl drain" fica travado e nao conclui. Aparece mensagem "Cannot evict pod as it would violate the pod\'s disruption budget". O drain nao termina mesmo apos varios minutos.',
      diagnosis: '```bash\n# Ver quais PDBs existem\nkubectl get pdb --all-namespaces\n\n# Descrever PDB para ver allowed disruptions\nkubectl describe pdb <nome>\n# ALLOWED DISRUPTIONS: 0 = nenhum Pod pode ser evictado\n\n# Ver Pods no node sendo drenado\nkubectl get pods --field-selector spec.nodeName=<node> -o wide\n\n# Verificar quais Pods pertencem a cada PDB\nkubectl get pdb <nome> -o yaml | grep -A5 selector\n\n# Verificar quantos Pods do Deployment estao Ready\nkubectl get deployment <nome>\n```',
      solution: '```bash\n# Causa 1: minAvailable muito alto (ex: igual ao total de replicas)\n# Reduzir minAvailable no PDB\nkubectl patch pdb <nome> -p \'{"spec":{"minAvailable": 1}}\'\n\n# Causa 2: Pods de substituicao nao ficam Ready\n# Verificar por que novos Pods nao estao Ready\nkubectl get pods -l <label> -o wide\nkubectl describe pod <pod-not-ready>\n\n# Causa 3: Deployment com poucas replicas e PDB restritivo\n# Aumentar replicas antes do drain\nkubectl scale deployment <nome> --replicas=3\n# Esperar ficar Ready\nkubectl rollout status deployment/<nome>\n# Tentar drain novamente\n\n# EMERGENCIA: Ignorar PDB (cuidado!)\nkubectl drain <node> --ignore-daemonsets --disable-eviction\n# Isso DELETA pods em vez de usar eviction API\n# NAO respeita PDBs - use apenas em emergencia\n```'
    },
    {
      title: 'DaemonSet Pod nao e criado em determinado node',
      symptom: 'Um DaemonSet deveria ter um Pod em cada node, mas um ou mais nodes nao tem o Pod do DaemonSet. "kubectl get pods -o wide" mostra que o Pod esta ausente em determinados nodes.',
      diagnosis: '```bash\n# Ver Pods do DaemonSet e em quais nodes estao\nkubectl get pods -l <daemonset-label> -o wide\n\n# Ver o DaemonSet\nkubectl describe daemonset <nome>\n# Procurar: "Desired Number of Nodes Scheduled" vs "Current"\n# Procurar: "Pods Status" e nodes sem Pod\n\n# Verificar taints do node sem Pod\nkubectl describe node <node-sem-pod> | grep -A3 Taints\n\n# Verificar se o DaemonSet tem nodeSelector\nkubectl get daemonset <nome> -o yaml | grep -A3 nodeSelector\n\n# Verificar se o node tem a label necessaria\nkubectl get nodes --show-labels | grep <node-sem-pod>\n```',
      solution: '```bash\n# Causa 1: Node tem taint que o DaemonSet nao tolera\n# Adicionar toleration ao DaemonSet\nkubectl patch daemonset <nome> --type=json -p \'[{\n  "op": "add",\n  "path": "/spec/template/spec/tolerations/-",\n  "value": {"key":"<taint-key>","operator":"Exists","effect":"<effect>"}\n}]\'\n\n# Causa 2: DaemonSet tem nodeSelector que nao inclui o node\n# Adicionar label ao node\nkubectl label node <node> <label-key>=<label-value>\n\n# Causa 3: Node esta em SchedulingDisabled (cordoned)\nkubectl uncordon <node>\n# Nota: DaemonSets DEVEM agendar em nodes cordoned\n# Se nao esta funcionando, pode ser um bug ou restricao adicional\n\n# Causa 4: Recursos insuficientes no node\nkubectl describe node <node> | grep -A10 "Allocated resources"\n# Verificar se ha espaco para o Pod do DaemonSet\n```'
    }
  ]
};
