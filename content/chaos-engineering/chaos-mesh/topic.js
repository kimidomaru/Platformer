window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['chaos-engineering/chaos-mesh'] = {
  theory: `
# Chaos Mesh on Kubernetes

## Relevancia
Chaos Mesh e uma plataforma de chaos engineering cloud-native, parte do CNCF (incubating). Usa CRDs nativos do Kubernetes e oferece uma interface web rica para definir e observar experimentos. Suporta injecao de falhas em pods, rede, I/O, stress, tempo (clock skew) e ate maquinas fisicas, sendo uma das ferramentas mais completas para chaos em Kubernetes.

## Conceitos Fundamentais

### Arquitetura do Chaos Mesh

\`\`\`
┌──────────────────────────────────────────────────────────┐
│                    Chaos Mesh Architecture                │
│                                                          │
│  ┌────────────────┐     ┌─────────────────────┐         │
│  │ Chaos Dashboard│     │  chaos-controller-   │         │
│  │   (Web UI)     │────→│  manager (Deployment)│         │
│  └────────────────┘     └──────────┬──────────┘         │
│                                    │                     │
│                          ┌─────────▼──────────┐         │
│                          │   chaos-daemon      │         │
│                          │   (DaemonSet)       │         │
│                          │   Privilegiado por   │         │
│                          │   node               │         │
│                          └──────────┬──────────┘         │
│                                     │                    │
│              ┌──────────────────────┼──────────┐         │
│              │                      │          │         │
│        ┌─────▼─────┐  ┌──────▼──────┐ ┌──────▼──────┐  │
│        │ Pod Chaos  │  │Network Chaos│ │Stress Chaos │  │
│        │ kill/fail  │  │delay/loss   │ │CPU/mem/IO   │  │
│        └───────────┘  └────────────┘ └────────────┘  │
└──────────────────────────────────────────────────────────┘

Componentes:
- chaos-controller-manager: Controla CRDs e orquestra experimentos
- chaos-daemon: DaemonSet privilegiado que injeta falhas nos containers
- chaos-dashboard: Interface web para gerenciar experimentos
\`\`\`

### Tipos de Chaos (CRDs)

\`\`\`
Chaos Mesh CRDs:
├── PodChaos           — Kill, failure, container kill
├── NetworkChaos       — Delay, loss, corruption, partition, bandwidth
├── StressChaos        — CPU stress, memory stress
├── IOChaos            — Latency I/O, fault I/O, attribute override
├── TimeChaos          — Clock skew (time offset)
├── DNSChaos           — DNS error, DNS random
├── HTTPChaos          — HTTP fault injection (abort, delay, replace)
├── JVMChaos           — Java bytecode injection (exception, GC, stress)
├── KernelChaos        — Kernel fault injection (slab, bio)
├── AWSChaos           — EC2 stop/restart, detach volume
├── GCPChaos           — VM stop/restart, disk loss
├── AzureChaos         — VM stop/restart, disk detach
├── PhysicalMachineChaos — Chaos em maquinas fisicas/VMs
├── Schedule           — Agendamento de chaos (cron)
└── Workflow           — Orquestracao de multiplos chaos
\`\`\`

### PodChaos — Falhas de Pod

\`\`\`yaml
# PodChaos — Kill pods
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: pod-kill-test
  namespace: default
spec:
  action: pod-kill            # pod-kill | pod-failure | container-kill
  mode: one                   # one | all | fixed | fixed-percent | random-max-percent
  selector:
    namespaces:
      - default
    labelSelectors:
      app: my-app
  duration: "60s"             # ignorado para pod-kill (instantaneo)
  gracePeriod: 0              # force kill
\`\`\`

\`\`\`yaml
# PodChaos — Pod failure (pod fica unavailable)
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: pod-failure-test
  namespace: default
spec:
  action: pod-failure
  mode: fixed-percent
  value: "50"                 # 50% dos pods selecionados
  selector:
    namespaces:
      - default
    labelSelectors:
      app: my-app
  duration: "120s"            # pod fica unavailable por 2 min
\`\`\`

### NetworkChaos — Falhas de Rede

\`\`\`yaml
# NetworkChaos — Injetar latencia
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: network-delay-test
  namespace: default
spec:
  action: delay
  mode: all
  selector:
    namespaces:
      - default
    labelSelectors:
      app: my-app
  delay:
    latency: "200ms"
    jitter: "50ms"            # variacao aleatoria
    correlation: "25"         # correlacao entre pacotes
  direction: to               # to | from | both
  target:
    selector:
      namespaces:
        - default
      labelSelectors:
        app: database
    mode: all
  duration: "60s"
\`\`\`

\`\`\`yaml
# NetworkChaos — Perda de pacotes
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: network-loss-test
  namespace: default
spec:
  action: loss
  mode: all
  selector:
    namespaces:
      - default
    labelSelectors:
      app: my-app
  loss:
    loss: "30"                # 30% packet loss
    correlation: "25"
  duration: "60s"
\`\`\`

\`\`\`yaml
# NetworkChaos — Particao de rede
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: network-partition-test
  namespace: default
spec:
  action: partition
  mode: all
  selector:
    namespaces:
      - default
    labelSelectors:
      app: frontend
  direction: both
  target:
    selector:
      namespaces:
        - default
      labelSelectors:
        app: backend
    mode: all
  duration: "30s"
\`\`\`

### StressChaos — Stress de Recursos

\`\`\`yaml
# StressChaos — CPU e memoria
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: cpu-stress-test
  namespace: default
spec:
  mode: one
  selector:
    namespaces:
      - default
    labelSelectors:
      app: my-app
  stressors:
    cpu:
      workers: 2              # 2 workers gerando carga
      load: 80                # 80% de carga por worker
    memory:
      workers: 1
      size: "256MB"           # Alocar 256MB
  duration: "120s"
\`\`\`

### IOChaos — Falhas de I/O

\`\`\`yaml
# IOChaos — Latencia de I/O
apiVersion: chaos-mesh.org/v1alpha1
kind: IOChaos
metadata:
  name: io-latency-test
  namespace: default
spec:
  action: latency             # latency | fault | attrOverride
  mode: one
  selector:
    namespaces:
      - default
    labelSelectors:
      app: database
  volumePath: /var/lib/mysql
  path: "*"
  delay: "100ms"
  percent: 50                 # 50% das operacoes
  duration: "60s"
\`\`\`

### TimeChaos — Clock Skew

\`\`\`yaml
# TimeChaos — Deslocamento de relogio
apiVersion: chaos-mesh.org/v1alpha1
kind: TimeChaos
metadata:
  name: clock-skew-test
  namespace: default
spec:
  mode: one
  selector:
    namespaces:
      - default
    labelSelectors:
      app: my-app
  timeOffset: "-2h"           # Relogio 2 horas no passado
  clockIds:
    - CLOCK_REALTIME
  containerNames:
    - app
  duration: "60s"
\`\`\`

### HTTPChaos — Falhas HTTP

\`\`\`yaml
# HTTPChaos — Injetar erro HTTP
apiVersion: chaos-mesh.org/v1alpha1
kind: HTTPChaos
metadata:
  name: http-abort-test
  namespace: default
spec:
  mode: all
  selector:
    namespaces:
      - default
    labelSelectors:
      app: my-app
  target: Response             # Request | Response
  port: 8080
  method: GET
  path: /api/*
  code: 503                    # Retornar 503
  duration: "30s"
\`\`\`

### Selectors — Selecao de Alvos

\`\`\`yaml
# Diferentes formas de selecionar alvos
selector:
  # Por namespace + labels
  namespaces:
    - production
  labelSelectors:
    app: my-app
    version: v2

  # Por annotation
  annotationSelectors:
    chaos-mesh.org/inject: "true"

  # Por node
  nodeSelectors:
    kubernetes.io/os: linux

  # Pods especificos
  pods:
    default:
      - my-app-pod-abc123
      - my-app-pod-def456

  # Por field selector
  fieldSelectors:
    metadata.name: my-specific-pod
\`\`\`

**Modos de selecao:**

| Mode | Descricao |
|------|-----------|
| one | 1 pod aleatorio |
| all | Todos os pods |
| fixed | N pods (spec.value) |
| fixed-percent | N% dos pods (spec.value) |
| random-max-percent | Ate N% aleatorio |

### Schedule — Chaos Agendado

\`\`\`yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: Schedule
metadata:
  name: scheduled-pod-kill
  namespace: default
spec:
  schedule: "*/5 * * * *"     # A cada 5 minutos
  type: PodChaos
  historyLimit: 5
  concurrencyPolicy: Forbid   # Forbid | Allow
  podChaos:
    action: pod-kill
    mode: one
    selector:
      namespaces:
        - default
      labelSelectors:
        app: my-app
\`\`\`

### Workflow — Orquestracao

\`\`\`yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: Workflow
metadata:
  name: resilience-workflow
  namespace: default
spec:
  entry: resilience-test
  templates:
    - name: resilience-test
      templateType: Serial     # Serial | Parallel | Suspend
      children:
        - pod-kill-step
        - wait-step
        - network-delay-step
        - stress-test-step

    - name: pod-kill-step
      templateType: PodChaos
      deadline: "2m"
      podChaos:
        action: pod-kill
        mode: one
        selector:
          namespaces: [default]
          labelSelectors:
            app: my-app

    - name: wait-step
      templateType: Suspend
      deadline: "30s"          # Pausa entre experimentos

    - name: network-delay-step
      templateType: NetworkChaos
      deadline: "2m"
      networkChaos:
        action: delay
        mode: all
        selector:
          namespaces: [default]
          labelSelectors:
            app: my-app
        delay:
          latency: "200ms"
        duration: "60s"

    - name: stress-test-step
      templateType: StressChaos
      deadline: "3m"
      stressChaos:
        mode: one
        selector:
          namespaces: [default]
          labelSelectors:
            app: my-app
        stressors:
          cpu:
            workers: 2
            load: 80
        duration: "120s"
\`\`\`

### Instalacao

\`\`\`bash
# Helm (recomendado)
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm install chaos-mesh chaos-mesh/chaos-mesh \\
  --namespace chaos-mesh \\
  --create-namespace \\
  --set chaosDaemon.runtime=containerd \\
  --set chaosDaemon.socketPath=/run/containerd/containerd.sock \\
  --set dashboard.securityMode=false

# Verificar instalacao
kubectl get pods -n chaos-mesh
# chaos-controller-manager, chaos-daemon (1 por node), chaos-dashboard
\`\`\`

### RBAC e Permissions

\`\`\`yaml
# Chaos Mesh usa RBAC nativo do K8s
# Por padrao, apenas cluster-admin pode criar chaos
# Para dar acesso a times especificos:
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: chaos-mesh-manager
rules:
  - apiGroups: ["chaos-mesh.org"]
    resources: ["*"]
    verbs: ["get", "list", "watch", "create", "delete", "patch", "update"]
---
# Ou restringir por namespace:
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: chaos-mesh-ns-manager
  namespace: staging
rules:
  - apiGroups: ["chaos-mesh.org"]
    resources: ["podchaos", "networkchaos", "stresschaos"]
    verbs: ["get", "list", "watch", "create", "delete"]
\`\`\`

### Erros Comuns

1. **chaos-daemon nao privilegiado** — DaemonSet precisa de privileged security context e acesso ao container runtime socket
2. **Container runtime errado** — Especificar containerd ou docker na instalacao (chaosDaemon.runtime)
3. **Selector muito amplo** — mode: all sem namespace pode afetar pods de sistema
4. **Duration muito longa sem monitoramento** — Chaos de 1 hora sem observabilidade e perigoso
5. **NetworkChaos sem direction** — Padrao e to, mas pode ser necessario both para simular particao real
6. **RBAC permissivo demais** — Restringir acesso ao chaos por namespace e tipo de CRD

## Killer.sh Style Challenge

> **Cenario:** Configure Chaos Mesh para: (1) PodChaos matando 50% dos pods do deployment "api" a cada 5 minutos (Schedule), (2) NetworkChaos com 200ms de latencia entre "frontend" e "api", (3) Workflow serial: pod-kill → wait 30s → network delay → CPU stress 80%.
`,
  quiz: [
    {
      question: 'Quais sao os componentes principais do Chaos Mesh?',
      options: [
        'Controller, Worker, Scheduler',
        'chaos-controller-manager (Deployment), chaos-daemon (DaemonSet privilegiado), chaos-dashboard (Web UI)',
        'Operator, Agent, Hub',
        'Master, Slave, Monitor'
      ],
      correct: 1,
      explanation: 'Chaos Mesh tem 3 componentes: chaos-controller-manager (controla CRDs e orquestra), chaos-daemon (DaemonSet privilegiado que injeta falhas nos containers em cada node), e chaos-dashboard (interface web).',
      reference: 'Conceito relacionado: chaos-daemon precisa de acesso privilegiado e ao socket do container runtime.'
    },
    {
      question: 'Qual CRD injeta latencia de rede entre dois servicos?',
      options: [
        'PodChaos',
        'NetworkChaos com action: delay',
        'StressChaos',
        'TimeChaos'
      ],
      correct: 1,
      explanation: 'NetworkChaos com action: delay injeta latencia de rede. Pode especificar latency, jitter, correlation, e direcionar para alvos especificos via target selector. Suporta delay, loss, corruption, partition, e bandwidth.',
      reference: 'Conceito relacionado: Use direction: both para simular latencia bidirecional.'
    },
    {
      question: 'O que o modo "fixed-percent" faz no Chaos Mesh?',
      options: [
        'Fixa o tempo do experimento',
        'Afeta uma porcentagem fixa dos pods selecionados (definida em spec.value)',
        'Garante que o percentual de sucesso e fixo',
        'Define a taxa de erro fixa'
      ],
      correct: 1,
      explanation: 'fixed-percent seleciona spec.value% dos pods que correspondem ao selector. Por exemplo, mode: fixed-percent com value: "50" afeta 50% dos pods. Outros modos: one, all, fixed (numero absoluto).',
      reference: 'Conceito relacionado: random-max-percent seleciona ate X% aleatoriamente.'
    },
    {
      question: 'Para que serve o TimeChaos?',
      options: [
        'Definir a duracao do experimento',
        'Deslocar o relogio do sistema do container (clock skew) para testar problemas com tempo',
        'Agendar experimentos',
        'Medir o tempo de recuperacao'
      ],
      correct: 1,
      explanation: 'TimeChaos injeta clock skew nos containers, deslocando o relogio do sistema. Util para testar problemas de certificados expirados, tokens JWT invalidos, caches baseados em tempo e logs desordenados.',
      reference: 'Conceito relacionado: Usa CLOCK_REALTIME; pode deslocar para futuro (+2h) ou passado (-2h).'
    },
    {
      question: 'Como agendar um experimento chaos para executar periodicamente?',
      options: [
        'Usar CronJob do Kubernetes',
        'Usar o CRD Schedule com spec.schedule no formato cron',
        'Configurar timer no Dashboard',
        'Usar repetitions no spec do chaos'
      ],
      correct: 1,
      explanation: 'O CRD Schedule permite agendar qualquer tipo de chaos no formato cron. Ex: schedule: "*/5 * * * *" executa a cada 5 minutos. Suporta historyLimit e concurrencyPolicy.',
      reference: 'Conceito relacionado: Schedule pode agendar PodChaos, NetworkChaos, ou qualquer outro tipo.'
    },
    {
      question: 'Qual a funcao do Workflow no Chaos Mesh?',
      options: [
        'Instalar o Chaos Mesh',
        'Orquestrar multiplos experimentos chaos em sequencia, paralelo ou com pausas',
        'Monitorar metricas',
        'Gerar relatorios'
      ],
      correct: 1,
      explanation: 'O Workflow orquestra multiplos experimentos chaos. Suporta templateType: Serial (sequencial), Parallel (simultaneo), Suspend (pausa) e tipos de chaos especificos. Permite criar cenarios complexos de resiliencia.',
      reference: 'Conceito relacionado: Use Suspend entre steps para dar tempo de recuperacao ao sistema.'
    },
    {
      question: 'Qual a diferenca principal entre Chaos Mesh e LitmusChaos?',
      options: [
        'Nao ha diferenca',
        'Chaos Mesh usa chaos-daemon privilegiado por node para injecao direta; LitmusChaos usa ChaosEngine + probes integradas para validacao automatica',
        'LitmusChaos e pago e Chaos Mesh e gratuito',
        'Chaos Mesh so funciona em AWS'
      ],
      correct: 1,
      explanation: 'Chaos Mesh injeta falhas diretamente via chaos-daemon (DaemonSet privilegiado), oferecendo mais tipos de falha (IOChaos, TimeChaos, KernelChaos). LitmusChaos foca em probes e ChaosHub para validacao automatica. Ambos sao CNCF.',
      reference: 'Conceito relacionado: Chaos Mesh tem dashboard web embutido; LitmusChaos tem ChaosCenter como portal.'
    }
  ],
  flashcards: [
    {
      front: 'Quais tipos de chaos (CRDs) o Chaos Mesh suporta?',
      back: '**Pod:**\n- PodChaos: kill, failure, container-kill\n\n**Rede:**\n- NetworkChaos: delay, loss, corruption, partition, bandwidth\n- DNSChaos: error, random\n- HTTPChaos: abort, delay, replace\n\n**Recursos:**\n- StressChaos: CPU, memory\n- IOChaos: latency, fault, attrOverride\n\n**Tempo:**\n- TimeChaos: clock skew\n\n**Avancado:**\n- JVMChaos: Java exception, GC\n- KernelChaos: slab, bio\n\n**Cloud:**\n- AWSChaos, GCPChaos, AzureChaos\n\n**Orquestracao:**\n- Schedule, Workflow'
    },
    {
      front: 'Como funciona o selector no Chaos Mesh?',
      back: '**Formas de selecao:**\n\n1. **Labels:**\nlabelSelectors:\n  app: my-app\n\n2. **Annotations:**\nannotationSelectors:\n  chaos-mesh.org/inject: "true"\n\n3. **Pods especificos:**\npods:\n  default: [pod-a, pod-b]\n\n4. **Nodes:**\nnodeSelectors:\n  kubernetes.io/os: linux\n\n**Modos:**\n- one: 1 pod aleatorio\n- all: todos os pods\n- fixed: N pods\n- fixed-percent: N% dos pods\n- random-max-percent: ate N%\n\n**Cuidado:** mode: all sem namespace pode afetar pods de sistema!'
    },
    {
      front: 'Como o NetworkChaos funciona?',
      back: '**Actions disponiveis:**\n- delay: latencia (ms) + jitter + correlation\n- loss: perda de pacotes (%)\n- corruption: corrupcao de pacotes\n- partition: isolamento total\n- bandwidth: limitacao de banda\n\n**Direcao:**\n- to: trafego saindo do pod\n- from: trafego chegando ao pod\n- both: bidirecional\n\n**Target:**\n- Selector para o DESTINO\n- Permite chaos ENTRE dois servicos\n\n**Exemplo:**\nfrontend → 200ms delay → backend\n\n**Usa tc (traffic control) no kernel** via chaos-daemon.'
    },
    {
      front: 'Como orquestrar multiplos chaos com Workflow?',
      back: '**Template types:**\n\n1. **Serial:** Sequencial\n   - Executa um apos o outro\n   - Espera cada terminar\n\n2. **Parallel:** Simultaneo\n   - Executa todos ao mesmo tempo\n   - Testa falhas combinadas\n\n3. **Suspend:** Pausa\n   - Espera X tempo entre steps\n   - Tempo de recuperacao\n\n**Exemplo de workflow:**\n\`\`\`\npod-kill → [pausa 30s] → network delay\n                         → CPU stress (paralelo)\n\`\`\`\n\n**Cada step tem deadline:** tempo maximo para completar.\n\n**Vantagem:** Simular cenarios realistas com multiplas falhas.'
    },
    {
      front: 'Quais sao os componentes do Chaos Mesh?',
      back: '**1. chaos-controller-manager:**\n- Deployment\n- Controla CRDs\n- Orquestra experimentos\n- Reconcilia estado\n\n**2. chaos-daemon:**\n- DaemonSet privilegiado\n- 1 por node\n- Injeta falhas nos containers\n- Acesso ao container runtime\n- Manipula rede, I/O, processos\n\n**3. chaos-dashboard:**\n- Interface web\n- Criar/monitorar chaos\n- Visualizar estado\n- RBAC integrado\n\n**Requisitos:**\n- chaos-daemon precisa de privileged\n- Acesso ao socket containerd/docker\n- RBAC para chaos-mesh.org API group'
    },
    {
      front: 'Chaos Mesh vs LitmusChaos — quando usar cada?',
      back: '**Chaos Mesh:**\n- Mais tipos de falha (IO, Time, JVM, Kernel)\n- Dashboard web integrado\n- chaos-daemon para injecao direta\n- Melhor para falhas de infra\n- CNCF Incubating\n\n**LitmusChaos:**\n- Probes integradas (HTTP, Prometheus, K8s)\n- ChaosHub com experimentos prontos\n- ChaosResult com verdict Pass/Fail\n- Melhor para validacao automatica\n- CNCF Graduated\n- Workflows com Argo\n\n**Escolha Chaos Mesh se:** precisa de IOChaos, TimeChaos, JVMChaos, KernelChaos.\n\n**Escolha LitmusChaos se:** precisa de probes automaticas e integracao CI/CD com Pass/Fail.'
    },
    {
      front: 'Como instalar e configurar RBAC do Chaos Mesh?',
      back: '**Instalacao (Helm):**\n\`\`\`bash\nhelm install chaos-mesh \\\\\n  chaos-mesh/chaos-mesh \\\\\n  --namespace chaos-mesh \\\\\n  --create-namespace \\\\\n  --set chaosDaemon.runtime=containerd \\\\\n  --set chaosDaemon.socketPath=\n    /run/containerd/containerd.sock\n\`\`\`\n\n**RBAC:**\n- apiGroup: chaos-mesh.org\n- Resources: podchaos, networkchaos, etc\n- Verbs: create, delete, get, list\n\n**Seguranca:**\n- Restringir por namespace (Role)\n- Restringir por tipo de chaos\n- Dashboard com securityMode=true\n- Annotations para opt-in'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar Chaos Mesh para executar experimentos de resiliencia incluindo pod kill, network delay e um workflow orquestrado.',
    objective: 'Aprender a instalar Chaos Mesh, criar experimentos com diferentes CRDs e orquestrar cenarios complexos.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Instalar Chaos Mesh e criar PodChaos',
        instruction: `Instale o Chaos Mesh e crie um experimento PodChaos:
1. Instalar Chaos Mesh via Helm no namespace chaos-mesh (runtime containerd)
2. Criar um Deployment "web-app" com 3 replicas e label app=web-app
3. Criar PodChaos que mata 1 pod aleatorio a cada 30 segundos por 2 minutos
4. Verificar que o Deployment se recupera automaticamente`,
        hints: [
          'Use --set chaosDaemon.runtime=containerd na instalacao',
          'PodChaos com action: pod-kill e mode: one',
          'Duration define o tempo total do experimento'
        ],
        solution: `\`\`\`bash
# Instalar Chaos Mesh
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm install chaos-mesh chaos-mesh/chaos-mesh \\
  --namespace chaos-mesh \\
  --create-namespace \\
  --set chaosDaemon.runtime=containerd \\
  --set chaosDaemon.socketPath=/run/containerd/containerd.sock \\
  --set dashboard.securityMode=false

# Verificar instalacao
kubectl get pods -n chaos-mesh
\`\`\`

\`\`\`yaml
# web-app.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: nginx
          image: nginx:1.25
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
---
# pod-kill.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: web-app-pod-kill
  namespace: default
spec:
  action: pod-kill
  mode: one
  selector:
    namespaces:
      - default
    labelSelectors:
      app: web-app
  duration: "120s"
  gracePeriod: 0
\`\`\`

\`\`\`bash
kubectl apply -f web-app.yaml
kubectl wait --for=condition=available deployment/web-app --timeout=60s
kubectl apply -f pod-kill.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar Chaos Mesh instalado
kubectl get pods -n chaos-mesh
# Saida esperada: controller-manager, daemon (1 por node), dashboard Running

# Verificar PodChaos criado
kubectl get podchaos -n default
# Saida esperada: web-app-pod-kill

# Verificar que pods estao sendo afetados
kubectl get pods -l app=web-app -w
# Saida esperada: pods sendo terminados e recriados

# Verificar eventos
kubectl get events -n default --sort-by='.lastTimestamp' | grep -i "kill\\|delete" | tail -5
# Saida esperada: eventos de pod kill

# Verificar que deployment se recupera
kubectl get deployment web-app
# Saida esperada: 3/3 READY (apos recuperacao)
\`\`\``
      },
      {
        title: 'Criar NetworkChaos com latencia e particao',
        instruction: `Crie experimentos de rede:
1. NetworkChaos com 200ms de latencia e 50ms de jitter entre pods app=web-app e direction "to"
2. Duracao de 60 segundos
3. Verificar impacto na latencia entre pods`,
        hints: [
          'action: delay para injetar latencia',
          'jitter adiciona variacao aleatoria na latencia',
          'direction: to afeta trafego saindo do pod'
        ],
        solution: `\`\`\`yaml
# network-delay.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: web-app-network-delay
  namespace: default
spec:
  action: delay
  mode: all
  selector:
    namespaces:
      - default
    labelSelectors:
      app: web-app
  delay:
    latency: "200ms"
    jitter: "50ms"
    correlation: "25"
  direction: to
  duration: "60s"
\`\`\`

\`\`\`bash
# Remover chaos anterior se ainda estiver ativo
kubectl delete podchaos web-app-pod-kill -n default --ignore-not-found

# Aplicar network delay
kubectl apply -f network-delay.yaml

# Testar latencia de dentro do cluster
kubectl run test-curl --image=curlimages/curl --rm -it -- \\
  sh -c 'for i in 1 2 3 4 5; do time curl -s -o /dev/null http://web-app.default; done'
\`\`\``,
        verify: `\`\`\`bash
# Verificar NetworkChaos criado
kubectl get networkchaos -n default
# Saida esperada: web-app-network-delay

# Verificar status
kubectl describe networkchaos web-app-network-delay -n default | grep -A5 "Status:"
# Saida esperada: status mostrando chaos ativo

# Verificar que latencia esta sendo injetada (apos 60s, o chaos expira)
kubectl get networkchaos web-app-network-delay -n default -o jsonpath='{.status.conditions}'
# Saida esperada: conditions mostrando estado do chaos
\`\`\``
      },
      {
        title: 'Criar Workflow serial com multiplos tipos de chaos',
        instruction: `Crie um Workflow que orquestra chaos em sequencia:
1. Step 1: PodChaos pod-kill de 1 pod (30s)
2. Step 2: Suspend (pausa de 30s para recuperacao)
3. Step 3: NetworkChaos delay de 200ms (60s)
4. Step 4: StressChaos CPU 80% com 2 workers (60s)
5. Todos os steps devem ter deadline`,
        hints: [
          'Workflow usa templateType: Serial para sequencial',
          'Cada step e um template com tipo especifico',
          'Suspend com deadline define o tempo de pausa'
        ],
        solution: `\`\`\`yaml
# chaos-workflow.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: Workflow
metadata:
  name: resilience-workflow
  namespace: default
spec:
  entry: full-test
  templates:
    - name: full-test
      templateType: Serial
      children:
        - pod-kill-step
        - recovery-pause
        - network-delay-step
        - cpu-stress-step

    - name: pod-kill-step
      templateType: PodChaos
      deadline: "1m"
      podChaos:
        action: pod-kill
        mode: one
        selector:
          namespaces:
            - default
          labelSelectors:
            app: web-app

    - name: recovery-pause
      templateType: Suspend
      deadline: "30s"

    - name: network-delay-step
      templateType: NetworkChaos
      deadline: "2m"
      networkChaos:
        action: delay
        mode: all
        selector:
          namespaces:
            - default
          labelSelectors:
            app: web-app
        delay:
          latency: "200ms"
          jitter: "50ms"
        duration: "60s"

    - name: cpu-stress-step
      templateType: StressChaos
      deadline: "2m"
      stressChaos:
        mode: one
        selector:
          namespaces:
            - default
          labelSelectors:
            app: web-app
        stressors:
          cpu:
            workers: 2
            load: 80
        duration: "60s"
\`\`\`

\`\`\`bash
# Remover chaos anteriores
kubectl delete networkchaos web-app-network-delay -n default --ignore-not-found

# Aplicar workflow
kubectl apply -f chaos-workflow.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar Workflow criado
kubectl get workflow -n default
# Saida esperada: resilience-workflow

# Verificar status do workflow
kubectl describe workflow resilience-workflow -n default | grep -A10 "Status:"
# Saida esperada: nodes mostrando progresso dos steps

# Verificar que o workflow esta progredindo
kubectl get workflow resilience-workflow -n default -o jsonpath='{.status.conditions}'
# Saida esperada: conditions mostrando estado

# Apos conclusao, verificar que o app se recuperou
kubectl get deployment web-app
# Saida esperada: 3/3 READY
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'chaos-daemon nao consegue injetar falhas',
      difficulty: 'medium',
      symptom: 'O CRD de chaos e criado mas nenhuma falha e injetada. Os pods alvo nao sao afetados.',
      diagnosis: `\`\`\`bash
# 1. Verificar se chaos-daemon esta rodando em todos os nodes
kubectl get pods -n chaos-mesh -l app.kubernetes.io/component=chaos-daemon -o wide
# Deve ter 1 por node

# 2. Verificar logs do chaos-daemon
kubectl logs -n chaos-mesh -l app.kubernetes.io/component=chaos-daemon --tail=20

# 3. Verificar se daemon tem acesso ao container runtime
kubectl get pods -n chaos-mesh -l app.kubernetes.io/component=chaos-daemon -o yaml | grep -A3 "socketPath"

# 4. Verificar se daemon e privilegiado
kubectl get pods -n chaos-mesh -l app.kubernetes.io/component=chaos-daemon -o yaml | grep privileged

# 5. Verificar controller-manager logs
kubectl logs -n chaos-mesh -l app.kubernetes.io/component=controller-manager --tail=20
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Runtime incorreto:** Na instalacao, especificar corretamente o runtime: --set chaosDaemon.runtime=containerd (ou docker). E o socket path correspondente.

2. **Sem acesso privilegiado:** chaos-daemon precisa de securityContext.privileged: true para manipular namespaces de rede e processos. Verificar PSP/PSA.

3. **Socket path errado:** O socket do container runtime deve ser montado corretamente. containerd: /run/containerd/containerd.sock, docker: /var/run/docker.sock.

4. **Daemon nao em todos os nodes:** Verificar tolerations do DaemonSet. Se nodes tem taints, o daemon pode nao estar schedulado.

5. **Firewall/SecurityPolicy:** Verificar se PodSecurityPolicy, PodSecurityAdmission ou OPA/Gatekeeper estao bloqueando o daemon privilegiado.`
    },
    {
      title: 'NetworkChaos afeta pods que nao deveriam ser afetados',
      difficulty: 'hard',
      symptom: 'Apos aplicar NetworkChaos, servicos nao selecionados tambem sofrem latencia ou perda de pacotes.',
      diagnosis: `\`\`\`bash
# 1. Verificar selector do NetworkChaos
kubectl get networkchaos -n default -o yaml | grep -A10 selector

# 2. Verificar quais pods correspondem ao selector
kubectl get pods -n default -l app=my-app
# Verificar que apenas os pods esperados sao listados

# 3. Verificar direction e target
kubectl get networkchaos -n default -o yaml | grep -A10 "direction\\|target"

# 4. Verificar se ha multiplos chaos ativos
kubectl get podchaos,networkchaos,stresschaos -n default

# 5. Verificar logs do daemon por pods afetados
kubectl logs -n chaos-mesh -l app.kubernetes.io/component=chaos-daemon | grep "inject\\|apply" | tail -20
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Selector muito amplo:** Verificar que labelSelectors e namespaces sao especificos o suficiente. Sem namespace, pode afetar pods em todos os namespaces.

2. **Mode all sem target:** Com mode: all e sem target selector, o chaos afeta TODO o trafego dos pods selecionados, incluindo para servicos internos do K8s (CoreDNS, API server).

3. **Direction errado:** to afeta trafego saindo do pod (pode afetar comunicacao com qualquer servico). Use target selector para limitar o destino afetado.

4. **Chaos residual:** Verificar se ha outros chaos ativos que podem estar interferindo. Usar kubectl get com todos os tipos de chaos.

5. **tc rules residuais:** Em casos raros, regras de tc (traffic control) podem ficar residuais apos o chaos. Reiniciar o chaos-daemon no node afetado.`
    },
    {
      title: 'Workflow nao progride apos o primeiro step',
      difficulty: 'medium',
      symptom: 'O Workflow executa o primeiro step mas fica parado e nao avanca para os proximos steps.',
      diagnosis: `\`\`\`bash
# 1. Verificar status do Workflow
kubectl describe workflow my-workflow -n default | grep -A20 "Status:"

# 2. Verificar se o step atual tem deadline
kubectl get workflow my-workflow -n default -o yaml | grep deadline

# 3. Verificar se o chaos do step atual terminou
kubectl get podchaos,networkchaos,stresschaos -n default

# 4. Verificar logs do controller
kubectl logs -n chaos-mesh -l app.kubernetes.io/component=controller-manager | grep workflow | tail -20

# 5. Verificar se ha erros no step atual
kubectl get events -n default | grep workflow | tail -10
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Sem deadline no step:** Cada step do workflow precisa de um deadline. Sem deadline, o controller nao sabe quando considerar o step completo e mover para o proximo.

2. **Duration maior que deadline:** Se a duration do chaos (ex: 120s) e maior que o deadline do step (ex: 60s), o step expira antes do chaos terminar. Garantir deadline > duration.

3. **Erro no chaos do step:** Se o chaos CRD do step falha (RBAC, selector invalido), o workflow fica parado. Verificar eventos e logs para o tipo de chaos especifico.

4. **Controller-manager sobrecarregado:** Se muitos workflows/chaos estao rodando simultaneamente, o controller pode demorar para reconciliar. Verificar recursos do controller-manager.

5. **Serial vs Parallel:** Verificar que templateType esta correto. Serial executa um por vez (espera terminar). Parallel executa simultaneamente.`
    }
  ]
};
