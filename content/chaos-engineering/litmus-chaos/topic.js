window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['chaos-engineering/litmus-chaos'] = {
  theory: `
# LitmusChaos on Kubernetes

## Relevancia
LitmusChaos e uma plataforma de chaos engineering cloud-native, parte do CNCF (graduated). Usa CRDs nativos do Kubernetes para definir, executar e observar experimentos de chaos. Inclui ChaosHub com experimentos pre-definidos, probes para validacao automatica de steady state, e workflows para orquestrar experimentos complexos.

## Conceitos Fundamentais

### Arquitetura do LitmusChaos

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                    LitmusChaos Architecture              │
│                                                         │
│  ┌─────────────────┐     ┌──────────────────────┐      │
│  │  Litmus Portal  │     │     ChaosCenter       │      │
│  │  (Web UI)       │────→│   (Control Plane)     │      │
│  └─────────────────┘     └──────────┬───────────┘      │
│                                     │                   │
│                          ┌──────────▼───────────┐      │
│                          │   Chaos Agent         │      │
│                          │   (Subscriber)        │      │
│                          └──────────┬───────────┘      │
│                                     │                   │
│  ┌──────────┐  ┌──────────┐  ┌─────▼──────┐           │
│  │ChaosHub  │  │Chaos     │  │Chaos       │           │
│  │(Exps)    │  │Workflow  │  │Runner      │           │
│  └──────────┘  └──────────┘  └─────┬──────┘           │
│                                     │                   │
│                          ┌──────────▼───────────┐      │
│                          │   Experiment Pods     │      │
│                          │   (chaos injection)   │      │
│                          └──────────────────────┘      │
└─────────────────────────────────────────────────────────┘
\`\`\`

### CRDs do LitmusChaos

\`\`\`yaml
# 1. ChaosExperiment — Define o tipo de experimento
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosExperiment
metadata:
  name: pod-delete
  namespace: litmus
spec:
  definition:
    scope: Namespaced
    permissions:
      - apiGroups: [""]
        resources: ["pods"]
        verbs: ["delete", "list", "get"]
    image: litmuschaos/go-runner:latest
    args:
      - -name
      - pod-delete
    env:
      - name: TOTAL_CHAOS_DURATION
        value: "30"
      - name: CHAOS_INTERVAL
        value: "10"
      - name: FORCE
        value: "false"
\`\`\`

\`\`\`yaml
# 2. ChaosEngine — Vincula experimento ao alvo
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: my-app-chaos
  namespace: default
spec:
  appinfo:
    appns: default
    applabel: "app=my-app"
    appkind: deployment
  engineState: active
  chaosServiceAccount: litmus-admin
  experiments:
    - name: pod-delete
      spec:
        components:
          env:
            - name: TOTAL_CHAOS_DURATION
              value: "60"
            - name: CHAOS_INTERVAL
              value: "10"
            - name: FORCE
              value: "true"
            - name: PODS_AFFECTED_PERC
              value: "50"
        probe:
          - name: check-app-health
            type: httpProbe
            httpProbe/inputs:
              url: http://my-app.default:8080/health
              insecureSkipVerify: false
              method:
                get:
                  criteria: ==
                  responseCode: "200"
            mode: Continuous
            runProperties:
              probeTimeout: 5s
              interval: 5s
              retry: 3
\`\`\`

\`\`\`yaml
# 3. ChaosResult — Resultado do experimento (gerado automaticamente)
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosResult
metadata:
  name: my-app-chaos-pod-delete
  namespace: default
spec:
  engine: my-app-chaos
  experiment: pod-delete
status:
  experimentStatus:
    phase: Completed
    verdict: Pass    # Pass | Fail | Awaited
  probeSuccessPercentage: "100"
  history:
    passedRuns: 5
    failedRuns: 0
\`\`\`

### Tipos de Experimentos (ChaosHub)

\`\`\`
Experimentos Genericos:
├── pod-delete          — Deleta pods aleatoriamente
├── container-kill      — Mata container especifico
├── pod-cpu-hog         — Stress de CPU no pod
├── pod-memory-hog      — Stress de memoria no pod
├── pod-io-stress       — Stress de I/O no pod
├── pod-network-latency — Injeta latencia de rede
├── pod-network-loss    — Injeta perda de pacotes
├── pod-network-corruption — Corrupcao de pacotes
├── pod-network-duplication — Duplicacao de pacotes
├── pod-dns-error       — Erro de DNS
├── pod-dns-spoof       — Spoof de DNS
├── disk-fill           — Preenche disco do pod
└── node-drain          — Drain de node

Experimentos para AWS:
├── ec2-stop-by-id      — Para instancia EC2
├── ebs-loss-by-id      — Detach volume EBS
├── rds-instance-reboot — Reboot instancia RDS
└── ecs-container-kill  — Kill container ECS

Experimentos para GCP:
├── gcp-vm-instance-stop — Para VM GCP
└── gcp-vm-disk-loss     — Detach disco GCP

Experimentos para Azure:
├── azure-instance-stop  — Para VM Azure
└── azure-disk-loss      — Detach disco Azure
\`\`\`

### Probes — Validacao Automatica de Steady State

\`\`\`yaml
# HTTP Probe — Verifica endpoint de saude
probe:
  - name: app-health-check
    type: httpProbe
    httpProbe/inputs:
      url: http://my-app.default:8080/health
      method:
        get:
          criteria: ==
          responseCode: "200"
    mode: Continuous   # SOT | EOT | Edge | Continuous | OnChaos
    runProperties:
      probeTimeout: 10s
      interval: 5s
      retry: 3
      initialDelay: 2s

# CMD Probe — Executa comando e valida saida
  - name: check-replicas
    type: cmdProbe
    cmdProbe/inputs:
      command: kubectl get deployment my-app -o jsonpath='{.status.readyReplicas}'
      comparator:
        type: int
        criteria: ">="
        value: "2"
    mode: Edge          # Verifica no inicio e fim do chaos

# Prometheus Probe — Consulta metricas
  - name: check-error-rate
    type: promProbe
    promProbe/inputs:
      endpoint: http://prometheus.monitoring:9090
      query: rate(http_requests_total{status=~"5.*",app="my-app"}[1m])
      comparator:
        type: float
        criteria: "<="
        value: "0.01"
    mode: Continuous

# K8s Probe — Valida estado de recursos K8s
  - name: check-pod-status
    type: k8sProbe
    k8sProbe/inputs:
      group: ""
      version: v1
      resource: pods
      namespace: default
      fieldSelector: status.phase=Running
      labelSelector: app=my-app
      operation: present   # present | absent | create | delete
    mode: Continuous
\`\`\`

**Modos de Probe:**

| Modo | Quando executa | Uso |
|------|---------------|-----|
| SOT | Start of Test | Validar pre-condicoes |
| EOT | End of Test | Validar estado final |
| Edge | SOT + EOT | Comparar antes/depois |
| Continuous | Durante todo o chaos | Monitorar durante falha |
| OnChaos | Apenas durante a injeccao | Validar durante o chaos |

### Chaos Workflows

\`\`\`yaml
# Workflow — Orquestra multiplos experimentos
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: resilience-test-workflow
  namespace: litmus
spec:
  entrypoint: resilience-tests
  templates:
    - name: resilience-tests
      steps:
        # Step 1: Pod Delete
        - - name: pod-delete-test
            template: pod-delete-experiment
        # Step 2 (apos step 1): Network Latency
        - - name: network-latency-test
            template: network-latency-experiment
        # Step 3 (paralelo): CPU + Memory stress
        - - name: cpu-stress-test
            template: cpu-stress-experiment
          - name: memory-stress-test
            template: memory-stress-experiment

    - name: pod-delete-experiment
      container:
        image: litmuschaos/litmus-checker:latest
        args:
          - -file=/tmp/chaosengine-pod-delete.yaml
        env:
          - name: CHAOS_ENGINE
            value: pod-delete-engine

    - name: network-latency-experiment
      container:
        image: litmuschaos/litmus-checker:latest
        args:
          - -file=/tmp/chaosengine-network-latency.yaml

    - name: cpu-stress-experiment
      container:
        image: litmuschaos/litmus-checker:latest
        args:
          - -file=/tmp/chaosengine-cpu-stress.yaml

    - name: memory-stress-experiment
      container:
        image: litmuschaos/litmus-checker:latest
        args:
          - -file=/tmp/chaosengine-memory-stress.yaml
\`\`\`

### Instalacao

\`\`\`bash
# Opcao 1: Helm (recomendado)
helm repo add litmuschaos https://litmuschaos.github.io/litmus-helm/
helm install litmus litmuschaos/litmus \\
  --namespace litmus \\
  --create-namespace \\
  --set portal.frontend.service.type=NodePort

# Opcao 2: kubectl
kubectl apply -f https://litmuschaos.github.io/litmus/litmus-operator-v3.0.0.yaml

# Verificar instalacao
kubectl get pods -n litmus
# litmus-frontend, litmus-server, mongodb
\`\`\`

### ChaosServiceAccount — RBAC

\`\`\`yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: litmus-admin
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: litmus-admin-role
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "events", "replicationcontrollers"]
    verbs: ["create", "delete", "get", "list", "patch", "update"]
  - apiGroups: ["apps"]
    resources: ["deployments", "daemonsets", "replicasets", "statefulsets"]
    verbs: ["list", "get", "patch", "update"]
  - apiGroups: ["batch"]
    resources: ["jobs"]
    verbs: ["create", "list", "get", "delete"]
  - apiGroups: ["litmuschaos.io"]
    resources: ["chaosengines", "chaosexperiments", "chaosresults"]
    verbs: ["create", "list", "get", "patch", "update", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: litmus-admin-binding
subjects:
  - kind: ServiceAccount
    name: litmus-admin
    namespace: default
roleRef:
  kind: ClusterRole
  name: litmus-admin-role
  apiGroup: rbac.authorization.k8s.io
\`\`\`

### Erros Comuns

1. **RBAC insuficiente** — ChaosServiceAccount precisa de permissoes adequadas (pods, deployments, jobs)
2. **Namespace errado** — ChaosEngine deve estar no mesmo namespace do app alvo (para experimentos Namespaced)
3. **Probe mal configurada** — URL ou comando incorreto faz o probe falhar independente do chaos
4. **TOTAL_CHAOS_DURATION muito curto** — Tempo insuficiente para o sistema reagir e medir
5. **Sem observabilidade** — Executar chaos sem Prometheus/Grafana impede analise de impacto
6. **applabel incorreto** — O label selector no appinfo deve corresponder exatamente ao label do pod alvo

## Killer.sh Style Challenge

> **Cenario:** Configure LitmusChaos para executar um workflow de resiliencia: (1) pod-delete no deployment "frontend" com 50% dos pods afetados, (2) pod-network-latency de 200ms no deployment "api", (3) probes HTTP Continuous validando /health em ambos os servicos, (4) resultado deve ser Pass para considerar o sistema resiliente.
`,
  quiz: [
    {
      question: 'Quais sao os tres CRDs principais do LitmusChaos?',
      options: [
        'ChaosDeployment, ChaosService, ChaosIngress',
        'ChaosExperiment (define o experimento), ChaosEngine (vincula ao alvo), ChaosResult (resultado)',
        'ChaosTest, ChaosReport, ChaosAlert',
        'ChaosJob, ChaosCronJob, ChaosStatus'
      ],
      correct: 1,
      explanation: 'LitmusChaos usa 3 CRDs: ChaosExperiment (definicao do tipo de falha), ChaosEngine (vincula o experimento ao app alvo + probes), e ChaosResult (gerado automaticamente com o resultado Pass/Fail).',
      reference: 'Conceito relacionado: ChaosEngine e o CRD principal que o usuario cria para executar chaos.'
    },
    {
      question: 'O que sao Probes no LitmusChaos?',
      options: [
        'Health checks do Kubernetes',
        'Mecanismos de validacao automatica de steady state durante o experimento chaos',
        'Logs do experimento',
        'Metricas de performance'
      ],
      correct: 1,
      explanation: 'Probes validam automaticamente se o steady state se mantem durante o chaos. Tipos: httpProbe (endpoint), cmdProbe (comando), promProbe (Prometheus query), k8sProbe (recursos K8s). O resultado Pass/Fail depende das probes.',
      reference: 'Conceito relacionado: Modo Continuous monitora durante todo o chaos; Edge compara antes/depois.'
    },
    {
      question: 'Para que serve o campo appinfo no ChaosEngine?',
      options: [
        'Configurar o ChaosHub',
        'Identificar o aplicativo alvo do chaos (namespace, label, kind)',
        'Configurar as probes',
        'Definir o blast radius'
      ],
      correct: 1,
      explanation: 'O campo appinfo define o alvo: appns (namespace), applabel (label selector como app=my-app), e appkind (deployment, statefulset, daemonset). O LitmusChaos usa essas informacoes para encontrar os pods a serem afetados.',
      reference: 'Conceito relacionado: PODS_AFFECTED_PERC controla a porcentagem de pods afetados.'
    },
    {
      question: 'Qual a funcao do ChaosHub?',
      options: [
        'Armazenar resultados de chaos',
        'Repositorio de experimentos pre-definidos (pod-delete, network-latency, etc.) prontos para uso',
        'Dashboard de metricas',
        'Pipeline de CI/CD'
      ],
      correct: 1,
      explanation: 'O ChaosHub e um repositorio (Git-based) de experimentos pre-definidos para diferentes plataformas (Kubernetes, AWS, GCP, Azure). Usuarios podem usar experimentos do hub publico ou criar hubs privados.',
      reference: 'Conceito relacionado: Hub publico em hub.litmuschaos.io com 50+ experimentos.'
    },
    {
      question: 'Qual probe mode valida o steady state durante toda a execucao do chaos?',
      options: [
        'SOT (Start of Test)',
        'Continuous — monitora durante todo o chaos',
        'EOT (End of Test)',
        'Edge (inicio e fim)'
      ],
      correct: 1,
      explanation: 'O modo Continuous executa a probe repetidamente durante toda a duracao do chaos, verificando em intervalos se o steady state se mantem. Se qualquer verificacao falhar, o resultado sera Fail.',
      reference: 'Conceito relacionado: Edge (SOT+EOT) compara estado antes e depois; OnChaos valida apenas durante a injeccao.'
    },
    {
      question: 'O que o PODS_AFFECTED_PERC controla?',
      options: [
        'A duracao do chaos',
        'A porcentagem de pods do app alvo que serao afetados pelo experimento',
        'A taxa de erro aceitavel',
        'O numero de probes'
      ],
      correct: 1,
      explanation: 'PODS_AFFECTED_PERC define a porcentagem de pods (do app alvo) que serao afetados. Por exemplo, com 50% em um Deployment de 4 replicas, 2 pods serao deletados/afetados.',
      reference: 'Conceito relacionado: Usar valores baixos (25-50%) para comecar e aumentar gradualmente.'
    },
    {
      question: 'O que acontece se uma probe falha durante o experimento?',
      options: [
        'O experimento continua normalmente',
        'O ChaosResult recebe verdict: Fail, indicando que o sistema nao e resiliente ao cenario testado',
        'O cluster e reiniciado',
        'O probe e ignorado'
      ],
      correct: 1,
      explanation: 'Se uma probe falha (ex: HTTP retorna 500 em vez de 200), o ChaosResult recebe verdict: Fail. Isso indica que o sistema nao manteve o steady state durante o chaos — uma fraqueza foi encontrada.',
      reference: 'Conceito relacionado: probeSuccessPercentage mostra a taxa de sucesso das probes.'
    }
  ],
  flashcards: [
    {
      front: 'Quais CRDs o LitmusChaos usa e qual a funcao de cada?',
      back: '**ChaosExperiment:**\n- Define o TIPO de falha\n- Imagem do executor\n- Permissoes necessarias\n- Parametros padrao\n- Vem do ChaosHub\n\n**ChaosEngine:**\n- Vincula experimento ao APP ALVO\n- Define appinfo (ns, label, kind)\n- Configura probes\n- Override de parametros\n- Trigger: engineState: active\n\n**ChaosResult:**\n- Gerado AUTOMATICAMENTE\n- Verdict: Pass | Fail | Awaited\n- probeSuccessPercentage\n- Historico de runs\n\n**Fluxo:** ChaosExperiment + ChaosEngine → ChaosResult'
    },
    {
      front: 'Quais tipos de Probes existem no LitmusChaos?',
      back: '**httpProbe:**\n- Verifica endpoint HTTP\n- Valida response code (200)\n- URL + method (GET/POST)\n\n**cmdProbe:**\n- Executa comando shell\n- Compara saida (int, string, float)\n- Ex: kubectl get deployment\n\n**promProbe:**\n- Consulta Prometheus\n- Valida metrica (PromQL)\n- Ex: error rate < 1%\n\n**k8sProbe:**\n- Valida recursos K8s\n- present/absent/create/delete\n- fieldSelector + labelSelector\n\n**Modos:**\n- SOT: inicio | EOT: fim\n- Edge: inicio + fim\n- Continuous: durante todo chaos\n- OnChaos: apenas durante injeccao'
    },
    {
      front: 'Como funciona o fluxo de um experimento LitmusChaos?',
      back: '**1. Preparacao:**\n- Instalar LitmusChaos (Helm/kubectl)\n- Criar ServiceAccount com RBAC\n- Selecionar experimento do ChaosHub\n\n**2. Configuracao:**\n- Criar ChaosEngine com:\n  - appinfo (alvo)\n  - experiments (tipo de chaos)\n  - probes (validacao)\n  - parametros (duracao, %, etc)\n\n**3. Execucao:**\n- engineState: active → dispara\n- Runner pod criado\n- Experiment pod injeta falha\n- Probes monitoram steady state\n\n**4. Resultado:**\n- ChaosResult gerado\n- Pass = sistema resiliente\n- Fail = fraqueza encontrada\n\n**5. Cleanup:**\n- engineState: stop\n- Pods de chaos removidos'
    },
    {
      front: 'Quais experimentos populares o ChaosHub oferece?',
      back: '**Pod/Container:**\n- pod-delete: Deleta pods aleatoriamente\n- container-kill: Mata container\n- pod-cpu-hog: Stress CPU\n- pod-memory-hog: Stress memoria\n- pod-io-stress: Stress I/O\n\n**Rede:**\n- pod-network-latency: Injeta delay\n- pod-network-loss: Perda de pacotes\n- pod-network-corruption: Corrupcao\n- pod-dns-error: Falha DNS\n\n**Node:**\n- node-drain: Drain K8s node\n- disk-fill: Preenche disco\n\n**Cloud:**\n- ec2-stop-by-id (AWS)\n- gcp-vm-instance-stop (GCP)\n- azure-instance-stop (Azure)'
    },
    {
      front: 'Qual RBAC o LitmusChaos precisa?',
      back: '**ServiceAccount:** litmus-admin\n\n**ClusterRole precisa de:**\n- pods: create, delete, get, list, patch\n- deployments, daemonsets, statefulsets: list, get, patch\n- jobs: create, list, get, delete\n- chaosengines: CRUD\n- chaosexperiments: CRUD\n- chaosresults: CRUD\n- events: create, list, get\n- pods/log: get, list\n\n**Dica:** Para experimentos Namespaced, Role + RoleBinding bastam. Para cluster-wide (node-drain), usar ClusterRole.\n\n**Erro comum:** RBAC insuficiente e a causa #1 de experimentos falhando.'
    },
    {
      front: 'Como integrar LitmusChaos no CI/CD?',
      back: '**GitHub Actions:**\n1. Deploy app em staging\n2. Aplicar ChaosEngine\n3. Aguardar ChaosResult\n4. Verificar verdict == Pass\n5. Se Pass → deploy para producao\n6. Se Fail → bloquear deploy\n\n**Workflow:**\n\`\`\`yaml\nsteps:\n  - kubectl apply -f chaosengine.yaml\n  - wait for chaosresult\n  - check verdict\n  - if fail: exit 1\n\`\`\`\n\n**Litmus Workflows:**\n- Orquestra multiplos experimentos\n- Sequencial ou paralelo\n- Usa Argo Workflows engine\n- Pode ser agendado (CronWorkflow)\n\n**Maturity Level 3:** Chaos no CI/CD'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar LitmusChaos para executar experimentos de resiliencia em um aplicativo Kubernetes, com probes de validacao automatica.',
    objective: 'Aprender a instalar LitmusChaos, configurar ChaosEngine com probes, executar experimentos e interpretar resultados.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Instalar LitmusChaos e preparar ServiceAccount',
        instruction: `Instale o LitmusChaos e configure o RBAC necessario:
1. Instalar LitmusChaos via Helm no namespace litmus
2. Criar ServiceAccount litmus-admin no namespace default
3. Criar ClusterRole com permissoes para pods, deployments, jobs e CRDs do Litmus
4. Criar ClusterRoleBinding vinculando o ServiceAccount ao ClusterRole`,
        hints: [
          'Use o Helm chart litmuschaos/litmus',
          'ServiceAccount precisa de permissoes em litmuschaos.io API group',
          'Para pod-delete, precisa de delete em pods'
        ],
        solution: `\`\`\`bash
# Instalar LitmusChaos
helm repo add litmuschaos https://litmuschaos.github.io/litmus-helm/
helm install litmus litmuschaos/litmus \\
  --namespace litmus \\
  --create-namespace

# Verificar instalacao
kubectl get pods -n litmus
\`\`\`

\`\`\`yaml
# litmus-rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: litmus-admin
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: litmus-admin-role
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "events"]
    verbs: ["create", "delete", "get", "list", "patch", "update"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["list", "get", "patch", "update"]
  - apiGroups: ["batch"]
    resources: ["jobs"]
    verbs: ["create", "list", "get", "delete"]
  - apiGroups: ["litmuschaos.io"]
    resources: ["chaosengines", "chaosexperiments", "chaosresults"]
    verbs: ["create", "list", "get", "patch", "update", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: litmus-admin-binding
subjects:
  - kind: ServiceAccount
    name: litmus-admin
    namespace: default
roleRef:
  kind: ClusterRole
  name: litmus-admin-role
  apiGroup: rbac.authorization.k8s.io
\`\`\`

\`\`\`bash
kubectl apply -f litmus-rbac.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar LitmusChaos rodando
kubectl get pods -n litmus
# Saida esperada: litmus-frontend, litmus-server, mongodb Running

# Verificar ServiceAccount
kubectl get sa litmus-admin -n default
# Saida esperada: litmus-admin

# Verificar ClusterRole
kubectl get clusterrole litmus-admin-role
# Saida esperada: litmus-admin-role

# Verificar binding
kubectl get clusterrolebinding litmus-admin-binding
# Saida esperada: litmus-admin-binding
\`\`\``
      },
      {
        title: 'Criar app de teste e executar pod-delete com probes',
        instruction: `Crie um app de teste e execute o experimento pod-delete:
1. Criar Deployment "nginx-test" com 3 replicas e label app=nginx-test
2. Criar Service para o Deployment
3. Instalar ChaosExperiment pod-delete do ChaosHub
4. Criar ChaosEngine com:
   - appinfo apontando para nginx-test
   - Experimento pod-delete com TOTAL_CHAOS_DURATION=30 e PODS_AFFECTED_PERC=50
   - Probe HTTP Continuous verificando o service
5. Aguardar resultado`,
        hints: [
          'O ChaosExperiment pode ser instalado via kubectl apply -f do ChaosHub',
          'PODS_AFFECTED_PERC=50 com 3 replicas afetara 1-2 pods',
          'A probe HTTP deve apontar para o Service, nao para um pod especifico'
        ],
        solution: `\`\`\`yaml
# nginx-test.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-test
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx-test
  template:
    metadata:
      labels:
        app: nginx-test
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
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-test
  namespace: default
spec:
  selector:
    app: nginx-test
  ports:
    - port: 80
      targetPort: 80
\`\`\`

\`\`\`bash
kubectl apply -f nginx-test.yaml
kubectl wait --for=condition=available deployment/nginx-test --timeout=60s

# Instalar ChaosExperiment do ChaosHub
kubectl apply -f https://hub.litmuschaos.io/api/chaos/3.0.0?file=charts/generic/pod-delete/experiment.yaml -n default
\`\`\`

\`\`\`yaml
# chaos-engine.yaml
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: nginx-chaos
  namespace: default
spec:
  appinfo:
    appns: default
    applabel: "app=nginx-test"
    appkind: deployment
  engineState: active
  chaosServiceAccount: litmus-admin
  experiments:
    - name: pod-delete
      spec:
        components:
          env:
            - name: TOTAL_CHAOS_DURATION
              value: "30"
            - name: CHAOS_INTERVAL
              value: "10"
            - name: FORCE
              value: "true"
            - name: PODS_AFFECTED_PERC
              value: "50"
        probe:
          - name: nginx-health
            type: httpProbe
            httpProbe/inputs:
              url: http://nginx-test.default:80/
              method:
                get:
                  criteria: ==
                  responseCode: "200"
            mode: Continuous
            runProperties:
              probeTimeout: 5s
              interval: 5s
              retry: 3
\`\`\`

\`\`\`bash
kubectl apply -f chaos-engine.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o app esta rodando
kubectl get pods -l app=nginx-test
# Saida esperada: 3 pods Running

# Verificar ChaosEngine
kubectl get chaosengine nginx-chaos -n default
# Saida esperada: nginx-chaos com engineState active

# Aguardar e verificar ChaosResult
kubectl get chaosresult -n default
# Saida esperada: nginx-chaos-pod-delete

# Verificar verdict
kubectl get chaosresult nginx-chaos-pod-delete -n default -o jsonpath='{.status.experimentStatus.verdict}'
# Saida esperada: Pass (se o sistema e resiliente)

# Verificar probeSuccessPercentage
kubectl get chaosresult nginx-chaos-pod-delete -n default -o jsonpath='{.status.probeSuccessPercentage}'
# Saida esperada: 100 (todas as probes passaram)
\`\`\``
      },
      {
        title: 'Executar experimento de network latency',
        instruction: `Execute um segundo experimento de network latency:
1. Instalar ChaosExperiment pod-network-latency do ChaosHub
2. Criar ChaosEngine com:
   - appinfo apontando para nginx-test
   - Experimento pod-network-latency com NETWORK_LATENCY=200 (ms) e TOTAL_CHAOS_DURATION=30
   - Probe cmdProbe verificando que replicas >= 3
3. Verificar resultado e comparar com o pod-delete`,
        hints: [
          'Network latency e injetada via tc (traffic control) dentro do pod',
          'NETWORK_LATENCY e em milissegundos',
          'Use um ChaosEngine diferente (nome unico) para o segundo experimento'
        ],
        solution: `\`\`\`bash
# Instalar experimento do ChaosHub
kubectl apply -f https://hub.litmuschaos.io/api/chaos/3.0.0?file=charts/generic/pod-network-latency/experiment.yaml -n default
\`\`\`

\`\`\`yaml
# chaos-network.yaml
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: nginx-network-chaos
  namespace: default
spec:
  appinfo:
    appns: default
    applabel: "app=nginx-test"
    appkind: deployment
  engineState: active
  chaosServiceAccount: litmus-admin
  experiments:
    - name: pod-network-latency
      spec:
        components:
          env:
            - name: TOTAL_CHAOS_DURATION
              value: "30"
            - name: NETWORK_LATENCY
              value: "200"
            - name: PODS_AFFECTED_PERC
              value: "100"
        probe:
          - name: check-replicas
            type: cmdProbe
            cmdProbe/inputs:
              command: kubectl get deployment nginx-test -n default -o jsonpath='{.status.readyReplicas}'
              comparator:
                type: int
                criteria: ">="
                value: "3"
            mode: Continuous
            runProperties:
              probeTimeout: 10s
              interval: 5s
              retry: 2
\`\`\`

\`\`\`bash
kubectl apply -f chaos-network.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar ChaosEngine
kubectl get chaosengine nginx-network-chaos -n default
# Saida esperada: nginx-network-chaos

# Aguardar e verificar resultado
kubectl get chaosresult -n default
# Saida esperada: nginx-chaos-pod-delete E nginx-network-chaos-pod-network-latency

# Verificar verdict do network latency
kubectl get chaosresult nginx-network-chaos-pod-network-latency -n default -o jsonpath='{.status.experimentStatus.verdict}'
# Saida esperada: Pass

# Listar todos os resultados
kubectl get chaosresult -n default -o custom-columns=NAME:.metadata.name,VERDICT:.status.experimentStatus.verdict,PROBE:.status.probeSuccessPercentage
# Saida esperada: ambos com Pass e 100%
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ChaosEngine fica em estado "waiting" e nao executa',
      difficulty: 'medium',
      symptom: 'Apos criar o ChaosEngine, ele permanece em estado waiting/initializing. Nenhum pod de chaos e criado.',
      diagnosis: `\`\`\`bash
# 1. Verificar status do ChaosEngine
kubectl describe chaosengine my-chaos -n default | grep -A10 "Status:"

# 2. Verificar se o ChaosExperiment existe no namespace
kubectl get chaosexperiment -n default
# O experimento referenciado deve existir

# 3. Verificar ServiceAccount
kubectl get sa litmus-admin -n default
# Deve existir

# 4. Verificar permissoes RBAC
kubectl auth can-i create jobs --as=system:serviceaccount:default:litmus-admin
kubectl auth can-i delete pods --as=system:serviceaccount:default:litmus-admin

# 5. Verificar eventos
kubectl get events -n default --sort-by='.lastTimestamp' | grep chaos
\`\`\``,
      solution: `**Causas e solucoes:**

1. **ChaosExperiment nao instalado:** O ChaosExperiment referenciado no ChaosEngine deve existir no MESMO namespace. Instalar via ChaosHub: kubectl apply -f <hub-url>.

2. **ServiceAccount nao encontrado:** O chaosServiceAccount definido no ChaosEngine deve existir. Criar o ServiceAccount e bindings.

3. **RBAC insuficiente:** O ServiceAccount precisa de permissoes para criar jobs, deletar pods, e acessar CRDs do Litmus. Verificar ClusterRole/Role.

4. **appinfo incorreto:** applabel deve corresponder exatamente aos labels dos pods alvo. Verificar com kubectl get pods -l <label>.

5. **Litmus Operator nao instalado:** O operator/runner do Litmus deve estar rodando. Verificar pods no namespace litmus.`
    },
    {
      title: 'Probe retorna Fail mesmo sem falha real',
      difficulty: 'hard',
      symptom: 'O ChaosResult mostra verdict: Fail mas o servico estava funcionando normalmente. A probe parece estar falhando incorretamente.',
      diagnosis: `\`\`\`bash
# 1. Verificar detalhes do ChaosResult
kubectl describe chaosresult my-chaos-pod-delete -n default | grep -A20 "Probe Status"

# 2. Verificar se a URL da probe esta acessivel de dentro do cluster
kubectl run test-probe --image=curlimages/curl --rm -it -- curl -s http://my-app.default:8080/health

# 3. Verificar se o timeout da probe e adequado
# Se probeTimeout=1s mas o app responde em 2s, vai falhar

# 4. Verificar DNS
kubectl run test-dns --image=busybox --rm -it -- nslookup my-app.default

# 5. Verificar logs do chaos runner
kubectl logs -l app=chaos-runner -n default --tail=30
\`\`\``,
      solution: `**Causas e solucoes:**

1. **URL incorreta:** A URL da httpProbe deve usar o formato service.namespace:port/path. Verificar que o Service existe e esta acessivel dentro do cluster.

2. **Timeout muito curto:** Se probeTimeout e menor que o tempo de resposta do app, a probe falha. Aumentar probeTimeout para pelo menos 2x o tempo de resposta esperado.

3. **DNS nao resolve:** Se o pod de chaos nao consegue resolver o nome do servico, a probe falha. Verificar CoreDNS e o Service.

4. **Criterio muito restritivo:** Se criteria: == e responseCode: "200", qualquer 201 ou redirect falha. Considerar criteria: "contains" ou regex.

5. **Probe executando antes do app estar pronto:** Adicionar initialDelay na probe para dar tempo do app inicializar apos o chaos.`
    },
    {
      title: 'Pod-delete nao afeta pods esperados',
      difficulty: 'medium',
      symptom: 'O experimento pod-delete executa mas nao deleta os pods do app alvo. O resultado e Pass mas nenhum pod foi realmente afetado.',
      diagnosis: `\`\`\`bash
# 1. Verificar appinfo no ChaosEngine
kubectl get chaosengine my-chaos -n default -o yaml | grep -A5 appinfo

# 2. Verificar se os labels correspondem
kubectl get pods -n default -l app=my-app
# Deve retornar pods

# 3. Verificar PODS_AFFECTED_PERC
kubectl get chaosengine my-chaos -n default -o yaml | grep PODS_AFFECTED_PERC

# 4. Verificar namespace
# ChaosEngine e app devem estar no mesmo namespace

# 5. Verificar logs do experiment pod
kubectl logs -l chaosUID -n default --tail=30
\`\`\``,
      solution: `**Causas e solucoes:**

1. **applabel incorreto:** O valor de applabel deve corresponder EXATAMENTE ao label dos pods. Verificar com kubectl get pods --show-labels. Formato: "key=value".

2. **appns incorreto:** Se appns aponta para namespace errado, nenhum pod sera encontrado. Deve ser o namespace onde os pods do app estao.

3. **appkind incorreto:** Se o app e um StatefulSet mas appkind diz "deployment", a busca pode falhar. Verificar o tipo do workload.

4. **PODS_AFFECTED_PERC=0:** Se definido como 0, nenhum pod sera afetado. Valor padrao e 100%.

5. **RBAC no namespace errado:** O ServiceAccount pode ter permissoes no namespace litmus mas nao no namespace da app. Usar ClusterRole ou criar Role no namespace correto.`
    }
  ]
};
