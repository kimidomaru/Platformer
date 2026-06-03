window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['workloads/autoscaling'] = {
  theory: `# Autoscaling e Self-Healing

## Diagrama: Ecossistema de Scaling no Kubernetes

\`\`\`
┌──────────────────────────────────────────────────────────────────┐
│                    SCALING NO KUBERNETES                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐        │
│  │  HORIZONTAL (numero de Pods)                         │        │
│  │                                                      │        │
│  │  ┌──────────────────────┐  ┌──────────────────────┐  │        │
│  │  │  HPA (built-in)      │  │  KEDA (externo)      │  │        │
│  │  │  CPU, Memory         │  │  Custom sources      │  │        │
│  │  │  Custom metrics      │  │  Queue, Cron, HTTP   │  │        │
│  │  └──────────┬───────────┘  └──────────────────────┘  │        │
│  │             │                                         │        │
│  │             ▼                                         │        │
│  │  ┌──────────────────────┐                            │        │
│  │  │  Deployment /        │                            │        │
│  │  │  ReplicaSet /        │  replicas: 2 → 5 → 10     │        │
│  │  │  StatefulSet         │                            │        │
│  │  └──────────────────────┘                            │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐        │
│  │  VERTICAL (recursos por Pod)                         │        │
│  │                                                      │        │
│  │  ┌──────────────────────┐                            │        │
│  │  │  VPA                 │  cpu: 100m → 500m          │        │
│  │  │  (requer instalacao) │  memory: 64Mi → 256Mi      │        │
│  │  └──────────────────────┘                            │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐        │
│  │  CLUSTER (numero de Nodes)                           │        │
│  │                                                      │        │
│  │  ┌──────────────────────┐                            │        │
│  │  │  Cluster Autoscaler  │  nodes: 3 → 5 → 10        │        │
│  │  │  (cloud provider)    │                            │        │
│  │  └──────────────────────┘                            │        │
│  └──────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────┘
\`\`\`

---

## Self-Healing com ReplicaSets

O Kubernetes mantem continuamente o numero desejado de replicas atraves dos controllers. Se um Pod falha ou e deletado, o ReplicaSet cria automaticamente um novo.

### Diagrama: Loop de Reconciliacao

\`\`\`
┌─────────────────────────────────────────────────────┐
│              RECONCILIATION LOOP                     │
│                                                      │
│   Estado Desejado          Estado Atual               │
│   (spec.replicas: 3)      (Pods rodando: ?)          │
│         │                       │                    │
│         └──────┬────────────────┘                    │
│                ▼                                     │
│        ┌──────────────┐                              │
│        │  Comparacao   │                              │
│        └──────┬───────┘                              │
│               │                                      │
│    ┌──────────┼──────────┐                           │
│    ▼          ▼          ▼                            │
│  Pods=3    Pods<3      Pods>3                        │
│  (OK)     (Criar)     (Deletar)                      │
│            novos       excesso                       │
└─────────────────────────────────────────────────────┘
\`\`\`

\`\`\`bash
# Observar o self-healing em acao
kubectl get pods -w &

# Deletar um Pod manualmente
kubectl delete pod <nome-do-pod>

# O ReplicaSet cria um novo Pod automaticamente
# Verificar os eventos
kubectl get events --sort-by=.lastTimestamp | tail -5
\`\`\`

### restartPolicy e Self-Healing

| restartPolicy | Comportamento | Uso |
|---------------|---------------|-----|
| Always (padrao) | Kubelet reinicia o container se ele falhar | Deployments, ReplicaSets |
| OnFailure | Reinicia apenas se sair com codigo de erro | Jobs |
| Never | Nao reinicia em nenhum caso | Jobs de debug |

---

## Probes de Saude

Probes sao mecanismos de verificacao de saude que o kubelet usa para saber quando um container esta pronto, saudavel ou iniciando.

### Diagrama: Lifecycle das Probes

\`\`\`
┌────────────────────────────────────────────────────────────┐
│                 LIFECYCLE DAS PROBES                        │
│                                                            │
│  Container     Startup Probe        Liveness    Readiness  │
│  Start         (se configurada)     Probe       Probe      │
│    │                                                       │
│    ▼                                                       │
│  ┌──────────────────┐                                      │
│  │ initialDelay     │                                      │
│  │ (startupProbe)   │                                      │
│  └────────┬─────────┘                                      │
│           ▼                                                │
│  ┌──────────────────┐    Falhou N vezes?                   │
│  │ Startup Probe    │───────────────────> RESTART container │
│  │ checando...      │                                      │
│  └────────┬─────────┘                                      │
│           │ Sucesso!                                       │
│           ▼                                                │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Liveness Probe   │  │ Readiness Probe  │                │
│  │ ativo            │  │ ativo            │                │
│  │                  │  │                  │                │
│  │ Falha = RESTART  │  │ Falha = REMOVE   │                │
│  │                  │  │ dos Endpoints    │                │
│  └──────────────────┘  └──────────────────┘                │
└────────────────────────────────────────────────────────────┘
\`\`\`

### Liveness Probe

Determina se o container esta VIVO. Se falhar, o kubelet reinicia o container.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
spec:
  containers:
  - name: app
    image: nginx:1.25
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3
      successThreshold: 1
\`\`\`

### Readiness Probe

Determina se o container esta PRONTO para receber trafego. Se falhar, o Pod e removido dos Endpoints do Service (sem reiniciar o container).

\`\`\`yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3
\`\`\`

### Startup Probe

Determina se o container INICIOU com sucesso. Desabilita liveness e readiness probes ate que a startup probe seja bem-sucedida. Ideal para aplicacoes que demoram para iniciar.

\`\`\`yaml
startupProbe:
  httpGet:
    path: /startup
    port: 8080
  failureThreshold: 30
  periodSeconds: 10
  # Tempo maximo = 30 x 10 = 300s (5 min)
\`\`\`

### Tipos de Probe

| Tipo | Quando usar | Exemplo |
|------|-------------|---------|
| httpGet | Apps web com endpoint de saude | /healthz, /ready |
| tcpSocket | Apps sem HTTP (DB, Redis) | Verificar porta 3306 |
| exec | Verificacoes customizadas | Script shell, arquivo |
| grpc | Apps com gRPC health check | Desde K8s 1.24 (GA 1.27) |

\`\`\`yaml
# HTTP GET
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
    httpHeaders:
    - name: Custom-Header
      value: Awesome

# TCP Socket
livenessProbe:
  tcpSocket:
    port: 3306

# Exec Command
livenessProbe:
  exec:
    command:
    - cat
    - /tmp/healthy

# gRPC (GA desde K8s 1.27)
livenessProbe:
  grpc:
    port: 9090
    service: health.Checker
\`\`\`

### Parametros das Probes

| Parametro | Padrao | Descricao |
|-----------|--------|-----------|
| initialDelaySeconds | 0 | Tempo de espera antes da primeira verificacao |
| periodSeconds | 10 | Intervalo entre verificacoes |
| timeoutSeconds | 1 | Tempo limite para cada verificacao |
| failureThreshold | 3 | Falhas consecutivas para considerar falho |
| successThreshold | 1 | Sucessos consecutivos para considerar saudavel (apenas readiness aceita >1) |

### Boas praticas para Probes

- **Liveness Probe**: endpoint simples e rapido, sem dependencias externas. Se depender de DB, uma falha de DB reinicia todos os Pods inutilmente
- **Readiness Probe**: pode verificar dependencias (DB, cache), pois apenas remove trafego
- **Startup Probe**: use para apps lentas (JVM, apps com migrations) em vez de aumentar initialDelaySeconds da liveness
- **Nunca** use a mesma probe para liveness e readiness com as mesmas configuracoes

---

## Horizontal Pod Autoscaler (HPA)

O HPA ajusta automaticamente o numero de replicas de um Deployment, ReplicaSet ou StatefulSet com base em metricas observadas.

### Diagrama: Fluxo do HPA

\`\`\`
┌────────────────────────────────────────────────────────┐
│                    HPA CONTROL LOOP                     │
│                     (a cada 15s)                        │
│                                                         │
│  ┌─────────────┐     ┌──────────────┐    ┌───────────┐ │
│  │ Metrics      │────>│ HPA          │───>│Deployment │ │
│  │ Server       │     │ Controller   │    │ .spec     │ │
│  │ (cpu/mem)    │     │              │    │ .replicas │ │
│  └─────────────┘     │  Formula:    │    └───────────┘ │
│                      │  desiredRep = │                   │
│  ┌─────────────┐     │  ceil(current │                   │
│  │ Custom       │────>│  Replicas *  │                   │
│  │ Metrics      │     │  currentMetric│                  │
│  │ (Prometheus) │     │  / target)    │                  │
│  └─────────────┘     └──────────────┘                   │
└────────────────────────────────────────────────────────┘
\`\`\`

### Formula do HPA

A formula principal do HPA e:

\`\`\`
desiredReplicas = ceil(currentReplicas * (currentMetricValue / desiredMetricValue))
\`\`\`

Exemplo pratico:
- Replicas atuais: 3
- CPU atual media: 75%
- Target CPU: 50%
- Calculo: ceil(3 * 75/50) = ceil(4.5) = **5 replicas**

### Requerimentos

- **Metrics Server** instalado no cluster
- **containers.resources.requests** definido nos Pods (obrigatorio para metricas de porcentagem)
- O HPA consulta metricas a cada **15 segundos** (configuravel via --horizontal-pod-autoscaler-sync-period)

### Criando HPA via kubectl

\`\`\`bash
# HPA baseado em CPU
kubectl autoscale deployment web-app \\
  --cpu-percent=50 \\
  --min=2 \\
  --max=10

# Verificar HPA
kubectl get hpa
kubectl describe hpa web-app

# Ver metricas em tempo real
kubectl top pods -l app=web-app
\`\`\`

### HPA via YAML (v2 API)

\`\`\`yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
  - type: Resource
    resource:
      name: memory
      target:
        type: AverageValue
        averageValue: 256Mi
\`\`\`

### HPA com metricas customizadas e behavior

\`\`\`yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: queue-consumer-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: queue-consumer
  minReplicas: 1
  maxReplicas: 20
  metrics:
  - type: External
    external:
      metric:
        name: queue_messages_ready
        selector:
          matchLabels:
            queue: worker-queue
      target:
        type: AverageValue
        averageValue: "30"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Pods
        value: 4
        periodSeconds: 60
      - type: Percent
        value: 100
        periodSeconds: 60
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Pods
        value: 2
        periodSeconds: 120
      selectPolicy: Min
\`\`\`

### Behavior - Controle Fino do Scaling

| Campo | Descricao | Padrao |
|-------|-----------|--------|
| stabilizationWindowSeconds | Janela para evitar flapping | scaleUp: 0, scaleDown: 300 |
| policies[].type | Pods (absoluto) ou Percent (%) | - |
| policies[].value | Quantidade de mudanca permitida | - |
| policies[].periodSeconds | Janela de tempo da policy | - |
| selectPolicy | Max, Min, ou Disabled | Max para scaleUp, Max para scaleDown |

### Tipos de metricas do HPA v2

| type | Descricao | Exemplo |
|------|-----------|---------|
| Resource | CPU e memoria dos containers | cpu: 50% |
| Pods | Metrica por Pod (qualquer tipo) | packets_per_second |
| Object | Metrica de um objeto K8s | Ingress requests_per_second |
| External | Metrica externa ao cluster | queue_messages_ready |

### HPA e Deployment: Conflitos

\`\`\`bash
# ATENCAO: Nao defina spec.replicas no Deployment se usar HPA
# O HPA controla as replicas automaticamente
# Se voce fizer "kubectl scale", o HPA sobrescreve em segundos

# Ver se ha conflito
kubectl describe hpa web-app-hpa
# Procurar: "ScalingReplicaSet" events
\`\`\`

---

## Vertical Pod Autoscaler (VPA)

O VPA ajusta automaticamente os requests e limits de CPU e memoria dos containers. Diferente do HPA, nao altera o numero de replicas.

### Componentes do VPA

| Componente | Funcao |
|------------|--------|
| Recommender | Analisa uso historico e calcula recomendacoes |
| Updater | Marca Pods para recriar quando necessario |
| Admission Controller | Aplica recomendacoes em novos Pods |

### Modos de operacao

| Modo | Comportamento | Risco |
|------|--------------|-------|
| Off | Apenas calcula recomendacoes, nao aplica | Nenhum |
| Initial | Aplica ao criar o Pod, nao atualiza rodando | Baixo |
| Auto | Recria Pods com novos valores quando necessario | Medio (disrupcao) |
| Recreate | Expulsa Pods fora dos limites recomendados | Medio |

\`\`\`yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: web-app-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: app
      minAllowed:
        cpu: "100m"
        memory: "50Mi"
      maxAllowed:
        cpu: "2"
        memory: "1Gi"
      controlledResources: ["cpu", "memory"]
\`\`\`

\`\`\`bash
# Ver recomendacoes do VPA
kubectl describe vpa web-app-vpa

# Output inclui:
# Target: cpu=250m, memory=128Mi     (recomendado)
# Lower Bound: cpu=100m, memory=64Mi (minimo seguro)
# Upper Bound: cpu=1, memory=512Mi   (maximo esperado)
# Uncapped Target: sem limites aplicados
\`\`\`

### VPA vs HPA

| Aspecto | HPA | VPA |
|---------|-----|-----|
| O que escala | Numero de replicas | Requests/limits por Pod |
| Built-in | Sim | Nao (instalar separado) |
| Disrupcao | Nenhuma (adiciona Pods) | Pode recriar Pods (modo Auto) |
| Uso simultaneo | Sim, mas... | NAO escalar a mesma metrica no HPA e VPA |

**Regra de ouro**: Use HPA para CPU/Memory e VPA no modo "Off" (apenas recomendacoes) para dimensionar manualmente os requests.

---

## Cluster Autoscaler

O Cluster Autoscaler ajusta o numero de **nodes** no cluster baseado em Pods Pending (sem node para agendar) ou nodes subutilizados.

### Como funciona

\`\`\`
Pod Pending (Unschedulable)
        │
        ▼
Cluster Autoscaler detecta
        │
        ▼
Adiciona novo node ao node group (cloud provider)
        │
        ▼
Pod e agendado no novo node
\`\`\`

### Scale Down

O Cluster Autoscaler remove nodes quando:
- A utilizacao de CPU e memoria esta abaixo de 50% (configuravel)
- Todos os Pods do node podem ser movidos para outros nodes
- Nao ha PDBs que seriam violados
- Nao ha Pods com local storage (emptyDir nao bloqueia, hostPath bloqueia)
- Nao ha Pods sem controller (standalone Pods)

### Annotations para controlar o Cluster Autoscaler

\`\`\`bash
# Impedir que um node seja removido pelo Cluster Autoscaler
kubectl annotate node <node-name> \\
  cluster-autoscaler.kubernetes.io/scale-down-disabled=true

# Definir prioridade de scale-down
kubectl annotate node <node-name> \\
  cluster-autoscaler.kubernetes.io/scale-down-priority="10"
\`\`\`

---

## Pod Disruption Budget (PDB)

PDB garante que um numero minimo de Pods esteja sempre disponivel durante operacoes voluntarias de disrupcao (drain, rolling updates, evictions).

### Diagrama: PDB em Acao

\`\`\`
Deployment com 5 replicas + PDB minAvailable: 3
─────────────────────────────────────────────────

Estado inicial:
[Pod1] [Pod2] [Pod3] [Pod4] [Pod5]  (5 running)

kubectl drain node-1 (tem Pod1 e Pod2):
  Pod1 pode ser evictado? 5-1=4 >= 3 ✓  → evicta Pod1
  Pod2 pode ser evictado? 4-1=3 >= 3 ✓  → evicta Pod2
  (novos Pods criados em outros nodes)

kubectl drain node-2 (tem Pod3):
  Pod3 pode ser evictado? Depende:
  - Se Pods novos ja estao Ready: 5-1=4 >= 3 ✓
  - Se Pods novos nao estao Ready: 3-1=2 < 3 ✗ → BLOCKED
\`\`\`

### minAvailable vs maxUnavailable

\`\`\`yaml
# Opcao 1: minAvailable (minimo que deve estar UP)
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web-app-pdb
spec:
  minAvailable: 2           # ou "50%"
  selector:
    matchLabels:
      app: web-app
\`\`\`

\`\`\`yaml
# Opcao 2: maxUnavailable (maximo que pode estar DOWN)
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web-app-pdb
spec:
  maxUnavailable: 1         # ou "25%"
  selector:
    matchLabels:
      app: web-app
\`\`\`

### Unhealthy Pod Eviction Policy (K8s 1.27+)

\`\`\`yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: web
  unhealthyPodEvictionPolicy: AlwaysAllow
  # AlwaysAllow: Pods unhealthy podem ser evictados sem contar no budget
  # IfHealthy (padrao): Pods unhealthy contam no budget
\`\`\`

\`\`\`bash
# Verificar PDB
kubectl get pdb
kubectl describe pdb web-app-pdb
# ALLOWED DISRUPTIONS mostra quantos Pods podem ser evictados agora
\`\`\`

---

## Comandos de Scaling

\`\`\`bash
# Escalar manualmente um Deployment
kubectl scale deployment web-app --replicas=5

# Escalar um StatefulSet
kubectl scale statefulset postgres --replicas=3

# Escalar multiplos recursos de uma vez
kubectl scale deployment/web-app deployment/api-server --replicas=3

# Ver status do rollout
kubectl rollout status deployment/web-app

# Ver HPA em acao
kubectl get hpa -w

# Gerar carga para testar HPA (em outro terminal)
kubectl run load-gen --image=busybox:1.36 --rm -it -- \\
  /bin/sh -c "while true; do wget -q -O- http://web-app; done"

# Forcar escala imediata do HPA (alterar minReplicas)
kubectl patch hpa web-app-hpa -p '{"spec":{"minReplicas":3}}'

# Ver metricas de recursos
kubectl top pods
kubectl top nodes
\`\`\`

---

## KEDA (Kubernetes Event-Driven Autoscaling)

KEDA e um componente externo que estende o HPA com event-driven scaling. Permite escalar baseado em fontes como filas, bancos de dados, metricas customizadas e cron schedules.

\`\`\`yaml
# Exemplo: ScaledObject do KEDA (nao e nativo K8s)
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: rabbitmq-consumer
spec:
  scaleTargetRef:
    name: consumer-deployment
  minReplicaCount: 0        # KEDA pode escalar para ZERO
  maxReplicaCount: 30
  triggers:
  - type: rabbitmq
    metadata:
      queueName: tasks
      host: amqp://guest:guest@rabbitmq:5672/
      queueLength: "5"
\`\`\`

Diferencial do KEDA: pode escalar para **zero replicas** (HPA nativo tem minReplicas >= 1).
`,

  quiz: [
    {
      question: 'Qual e a diferenca entre Liveness Probe e Readiness Probe?',
      options: [
        'Liveness verifica se o container e reiniciado, Readiness verifica se o Pod e deletado',
        'Liveness determina se o container esta vivo (reinicia se falhar), Readiness determina se o container esta pronto para receber trafego (remove dos Endpoints se falhar)',
        'Liveness e usada apenas no startup, Readiness e usada durante toda a vida do Pod',
        'Sao funcionalmente identicas, apenas com nomenclaturas diferentes'
      ],
      correct: 1,
      explanation: 'Liveness Probe: verifica se o container esta saudavel. Falha causa reinicio do container pelo kubelet. Readiness Probe: verifica se o container esta pronto para receber trafego. Falha remove o Pod dos Endpoints do Service, mas NAO reinicia o container. Ambas continuam checando durante toda a vida do Pod.'
    },
    {
      question: 'Para que serve a Startup Probe?',
      options: [
        'Substituir a Liveness Probe em aplicacoes simples',
        'Verificar se o node tem recursos suficientes para o Pod',
        'Dar tempo extra para aplicacoes lentas iniciarem, desabilitando Liveness/Readiness ate que o startup seja bem-sucedido',
        'Verificar se a imagem do container foi baixada corretamente'
      ],
      correct: 2,
      explanation: 'Startup Probe e ideal para aplicacoes que tem tempo de inicializacao longo (ex: apps Java/JVM). Ela desabilita Liveness e Readiness probes ate ser bem-sucedida, evitando que o container seja reiniciado prematuramente. O tempo maximo de espera e failureThreshold x periodSeconds.'
    },
    {
      question: 'Qual e a formula que o HPA usa para calcular o numero desejado de replicas?',
      options: [
        'desiredReplicas = currentReplicas + (currentMetric - targetMetric)',
        'desiredReplicas = ceil(currentReplicas * (currentMetricValue / desiredMetricValue))',
        'desiredReplicas = maxReplicas * (currentMetric / 100)',
        'desiredReplicas = minReplicas + (currentMetric / targetMetric)'
      ],
      correct: 1,
      explanation: 'A formula do HPA e: desiredReplicas = ceil(currentReplicas * (currentMetricValue / desiredMetricValue)). Por exemplo: 3 replicas com 75% CPU e target de 50% = ceil(3 * 75/50) = ceil(4.5) = 5 replicas. O HPA avalia esta formula a cada 15 segundos por padrao.'
    },
    {
      question: 'O que o HPA faz quando a utilizacao de CPU esta abaixo do threshold por um longo periodo?',
      options: [
        'Deleta o Deployment completamente',
        'Reduz o numero de replicas ate o minimo configurado, respeitando o stabilizationWindowSeconds',
        'Aumenta os limits de CPU dos containers existentes',
        'Nao faz nada, o HPA so escala para cima'
      ],
      correct: 1,
      explanation: 'O HPA tambem escala para baixo (scale down) quando a utilizacao esta abaixo do threshold. O scale down tem uma janela de estabilizacao padrao de 5 minutos (300s) para evitar flapping. O HPA respeita o minReplicas configurado e nunca escala abaixo dele.'
    },
    {
      question: 'Qual recurso garante que durante um "kubectl drain" um Deployment mantenha pelo menos 2 Pods rodando?',
      options: [
        'HorizontalPodAutoscaler com minReplicas: 2',
        'PodDisruptionBudget com minAvailable: 2',
        'ReplicaSet com replicas: 2',
        'NodeAffinity com required scheduling'
      ],
      correct: 1,
      explanation: 'PodDisruptionBudget (PDB) com "minAvailable: 2" garante que operacoes voluntarias de disrupcao (drain, evictions, rolling updates) respeitem o minimo de 2 Pods disponiveis. Se o drain causar indisponibilidade abaixo desse limite, o drain sera bloqueado.'
    },
    {
      question: 'Qual API version do HPA deve ser usada para configurar metricas de CPU e memoria simultaneamente?',
      options: [
        'autoscaling/v1',
        'autoscaling/v2beta1',
        'autoscaling/v2',
        'autoscaling/v3'
      ],
      correct: 2,
      explanation: '"autoscaling/v2" (GA desde K8s 1.26) suporta multiplas metricas simultaneamente (CPU, memoria, metricas customizadas e externas) e configuracao avancada de comportamento de scaling (behavior). O "autoscaling/v1" suporta apenas CPU.'
    },
    {
      question: 'Qual e o prerequisito para o HPA funcionar corretamente em um cluster?',
      options: [
        'VPA deve estar instalado',
        'Metrics Server deve estar instalado e os Pods devem ter resources.requests definidos',
        'Os Pods devem ter Liveness Probes configuradas',
        'O cluster deve ter pelo menos 3 nodes'
      ],
      correct: 1,
      explanation: 'O HPA requer: (1) Metrics Server instalado para coletar metricas de CPU/memoria dos Pods, e (2) resources.requests definidos nos containers, pois a porcentagem de utilizacao e calculada em relacao ao request. Sem requests, o HPA mostra "<unknown>".'
    },
    {
      question: 'Qual modo do VPA aplica recomendacoes sem reiniciar Pods ja em execucao?',
      options: [
        'Auto',
        'Recreate',
        'Initial',
        'Off'
      ],
      correct: 2,
      explanation: 'O modo "Initial" aplica as recomendacoes do VPA apenas quando novos Pods sao criados, sem afetar Pods ja em execucao. O modo "Auto" e "Recreate" podem recriar Pods em execucao para aplicar novos valores. O modo "Off" apenas calcula recomendacoes sem aplicar nada.'
    },
    {
      question: 'O que acontece se o HPA e VPA tentarem controlar a mesma metrica (ex: CPU) simultaneamente?',
      options: [
        'O HPA tem prioridade e o VPA e ignorado',
        'Os dois se complementam automaticamente',
        'Conflito: ambos podem fazer ajustes contraditorios, causando instabilidade. NAO e recomendado',
        'O VPA desabilita o HPA automaticamente'
      ],
      correct: 2,
      explanation: 'Usar HPA e VPA na mesma metrica causa conflito. O HPA escala replicas baseado na utilizacao relativa ao request, enquanto o VPA muda o request. Se o VPA aumenta o request, a porcentagem de uso cai, e o HPA reduz replicas. A recomendacao e: HPA para scaling horizontal, VPA no modo "Off" para observar recomendacoes.'
    },
    {
      question: 'O campo "behavior.scaleDown.stabilizationWindowSeconds" no HPA serve para:',
      options: [
        'Definir o intervalo de coleta de metricas',
        'Evitar flapping (scale down prematuro) olhando para os valores mais altos da janela de tempo antes de reduzir replicas',
        'Tempo de espera antes de deletar Pods durante scale down',
        'Periodo de graceful shutdown dos Pods que serao removidos'
      ],
      correct: 1,
      explanation: 'O stabilizationWindowSeconds para scale down (padrao 300s / 5 min) faz o HPA considerar o maior numero de replicas recomendado dentro da janela de tempo. Isso evita flapping onde o HPA reduziria e aumentaria replicas repetidamente em cargas oscilantes.'
    }
  ],

  flashcards: [
    {
      front: 'Quais sao os tres tipos de Probe no Kubernetes e quando usar cada um?',
      back: '1. Liveness Probe: verifica se o container esta vivo. Falha = reinicia o container. Use para detectar deadlocks e estados corrompidos.\n\n2. Readiness Probe: verifica se o container esta pronto para trafego. Falha = remove dos Endpoints. Use durante inicializacao e quando o app esta sobrecarregado.\n\n3. Startup Probe: verifica se o container iniciou. Desabilita outras probes ate ter sucesso. Use para apps com inicializacao lenta (JVM, migrations).'
    },
    {
      front: 'Como calcular o tempo maximo de inicializacao com Startup Probe?',
      back: 'Tempo maximo = failureThreshold x periodSeconds\n\nExemplo:\nstartupProbe:\n  failureThreshold: 30\n  periodSeconds: 10\n\nTempo maximo = 30 x 10 = 300 segundos (5 minutos)\n\nApos esse tempo, se ainda falhar, o container e reiniciado.\nLiveness e Readiness probes so comecam APOS a startup ter sucesso.'
    },
    {
      front: 'Qual a formula do HPA e como ela funciona na pratica?',
      back: 'Formula:\ndesiredReplicas = ceil(currentReplicas * (currentMetric / targetMetric))\n\nExemplo:\n- 3 replicas, CPU atual: 75%, target: 50%\n- ceil(3 * 75/50) = ceil(4.5) = 5 replicas\n\nO HPA avalia a cada 15 segundos.\nScale up: imediato (stabilization: 0s por padrao)\nScale down: conservador (stabilization: 300s por padrao)'
    },
    {
      front: 'Quais metricas o HPA v2 suporta?',
      back: '1. Resource: CPU e memoria dos containers (type: Resource)\n2. Pods: metricas por Pod de qualquer tipo (type: Pods)\n3. Object: metrica de um objeto K8s especifico (type: Object)\n4. External: metricas externas ao cluster via adapter (type: External)\n\nO HPA v1 suporta apenas CPU (Resource).\nMultiplas metricas: o HPA usa a que resultar em MAIS replicas.'
    },
    {
      front: 'Qual a diferenca entre minAvailable e maxUnavailable no PodDisruptionBudget?',
      back: 'minAvailable: numero ou percentagem minima de Pods que DEVEM estar disponiveis. O sistema NAO pode reduzir abaixo desse valor.\n\nmaxUnavailable: numero ou percentagem maxima de Pods que PODEM estar indisponiveis simultaneamente.\n\nExemplo: Deployment com 5 replicas:\nminAvailable: 3 = no maximo 2 Pods podem ser disruptados\nmaxUnavailable: 1 = no minimo 4 Pods devem estar up\n\nAmbos aceitam numeros absolutos ou percentuais ("50%").'
    },
    {
      front: 'O que acontece ao ReplicaSet quando um Pod falha?',
      back: 'Self-healing automatico (reconciliation loop):\n1. O controller do ReplicaSet detecta que Pods rodando < desejado\n2. Um novo Pod e criado automaticamente\n3. O scheduler decide em qual node o novo Pod sera alocado\n\nO ReplicaSet monitora continuamente via API Server.\nO loop roda constantemente (nao e polling, e watch-based).\nFunciona independentemente de HPA/VPA.'
    },
    {
      front: 'Quais sao os 4 modos de operacao do VPA?',
      back: '1. Off: Apenas gera recomendacoes, nao aplica nada (mais seguro)\n2. Initial: Aplica apenas ao criar Pods novos, nao afeta Pods rodando\n3. Auto: Aplica recomendacoes e pode recriar Pods quando necessario\n4. Recreate: Expulsa Pods que estao fora dos limites recomendados\n\nModo recomendado para producao: Off ou Initial\nNUNCA use VPA e HPA na mesma metrica (CPU/Memory)'
    },
    {
      front: 'Como criar um HPA pela linha de comando para um Deployment?',
      back: 'kubectl autoscale deployment <nome> \\\n  --cpu-percent=<porcentagem> \\\n  --min=<min-replicas> \\\n  --max=<max-replicas>\n\nExemplo:\nkubectl autoscale deployment web-app \\\n  --cpu-percent=50 \\\n  --min=2 \\\n  --max=10\n\nVerificar: kubectl get hpa\nDetalhar: kubectl describe hpa web-app\nMonitorar: kubectl get hpa -w'
    },
    {
      front: 'O que e o Cluster Autoscaler e como ele difere do HPA?',
      back: 'Cluster Autoscaler: escala o numero de NODES no cluster.\n\nScale Up: detecta Pods Pending (Unschedulable) e adiciona nodes.\nScale Down: remove nodes subutilizados (<50% uso) se os Pods podem ser redistribuidos.\n\nDiferencas do HPA:\n- HPA escala Pods, Cluster Autoscaler escala Nodes\n- HPA e built-in, CA depende do cloud provider\n- HPA reage a metricas, CA reage a Pods Pending\n- Ambos trabalham juntos na pratica'
    },
    {
      front: 'O que e o behavior do HPA e como configurar scale down conservador?',
      back: 'O campo behavior controla a velocidade e estabilidade do scaling.\n\nbehavior:\n  scaleDown:\n    stabilizationWindowSeconds: 300  # 5 min (padrao)\n    policies:\n    - type: Pods\n      value: 2           # max 2 pods por vez\n      periodSeconds: 120  # a cada 2 min\n    selectPolicy: Min     # usar a policy mais conservadora\n\nstabilizationWindow: evita flapping olhando valores passados\npolicies: limite de mudanca por periodo\nselectPolicy: Min (conservador), Max (agressivo), Disabled (sem scaling)'
    },
    {
      front: 'Por que uma Liveness Probe NAO deve verificar dependencias externas (DB, API)?',
      back: 'Se a Liveness Probe verifica o banco de dados:\n1. O banco cai temporariamente\n2. TODOS os Pods falham na liveness probe\n3. O kubelet reinicia TODOS os containers\n4. Ao reiniciar, todos tentam conectar ao DB simultaneamente\n5. Thundering herd = piora a situacao\n\nSolucao correta:\n- Liveness: endpoint simples e local (/healthz retorna 200)\n- Readiness: pode verificar dependencias (remove do Service, nao reinicia)\n\nLiveness = "o processo esta travado?"\nReadiness = "o servico esta funcional?"'
    }
  ],

  lab: {
    scenario: 'Uma aplicacao web esta em producao e precisa de autoscaling baseado em CPU, probes de saude adequadas para garantir que trafego so vai para containers prontos, e um PDB para garantir alta disponibilidade durante manutencoes.',
    objective: 'Configurar Liveness/Readiness probes, criar um HPA funcional e um PDB, gerar carga e observar o autoscaling em acao',
    steps: [
      {
        title: 'Criar Deployment com probes de saude',
        instruction: 'Crie um Deployment chamado `web-app` com 2 replicas usando a imagem `nginx:1.25`. Configure: (1) Readiness Probe HTTP GET em "/" porta 80, com initialDelaySeconds 5 e periodSeconds 5. (2) Liveness Probe HTTP GET em "/" porta 80, com initialDelaySeconds 10 e periodSeconds 10. Adicione resource requests de 100m CPU e 64Mi memoria. Exponha o Deployment com um Service ClusterIP na porta 80.',
        hints: [
          'Resources requests sao obrigatorios para o HPA funcionar',
          'A readinessProbe deve ter initialDelaySeconds menor que a livenessProbe',
          'nginx expoe a porta 80 por padrao e responde 200 em /'
        ],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web-app\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: web-app\n  template:\n    metadata:\n      labels:\n        app: web-app\n    spec:\n      containers:\n      - name: nginx\n        image: nginx:1.25\n        ports:\n        - containerPort: 80\n        resources:\n          requests:\n            cpu: "100m"\n            memory: "64Mi"\n          limits:\n            cpu: "200m"\n            memory: "128Mi"\n        readinessProbe:\n          httpGet:\n            path: /\n            port: 80\n          initialDelaySeconds: 5\n          periodSeconds: 5\n          failureThreshold: 3\n        livenessProbe:\n          httpGet:\n            path: /\n            port: 80\n          initialDelaySeconds: 10\n          periodSeconds: 10\n          failureThreshold: 3\nEOF\n\n# Criar Service\nkubectl expose deployment web-app --port=80 --target-port=80\n\n# Verificar pods e probes\nkubectl get pods -l app=web-app\nkubectl describe deployment web-app | grep -A5 "Liveness\\|Readiness"\n```'
      },
      {
        title: 'Criar HPA e PDB',
        instruction: 'Crie um HPA para o Deployment web-app com minReplicas=2, maxReplicas=8 e target de 50% de CPU. Em seguida, crie um PodDisruptionBudget que garanta no minimo 1 Pod disponivel durante disruptoes. Verifique o status de ambos.',
        hints: [
          'Use kubectl autoscale ou aplique um YAML com apiVersion: autoscaling/v2',
          'O PDB usa policy/v1 (GA desde K8s 1.21)',
          'kubectl get hpa e kubectl get pdb para verificar'
        ],
        solution: '```bash\n# Criar HPA\nkubectl autoscale deployment web-app \\\n  --cpu-percent=50 \\\n  --min=2 \\\n  --max=8\n\n# Verificar HPA\nkubectl get hpa web-app\nkubectl describe hpa web-app\n\n# Criar PDB\ncat <<EOF | kubectl apply -f -\napiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: web-app-pdb\nspec:\n  minAvailable: 1\n  selector:\n    matchLabels:\n      app: web-app\nEOF\n\n# Verificar PDB\nkubectl get pdb web-app-pdb\nkubectl describe pdb web-app-pdb\n```'
      },
      {
        title: 'Gerar carga e observar HPA escalando',
        instruction: 'Gere carga no Service web-app usando um Pod de teste com wget em loop. Em outro terminal, monitore o HPA escalando. Aguarde 2-3 minutos para ver o scale up acontecer. Depois pare a carga e observe o scale down.',
        hints: [
          'kubectl run load-gen --image=busybox:1.36 --rm -it -- /bin/sh para entrar no Pod de carga',
          'while true; do wget -q -O- http://web-app; done para gerar carga',
          'kubectl get hpa web-app -w em outro terminal para monitorar'
        ],
        solution: '```bash\n# Terminal 1: Monitorar HPA\nkubectl get hpa web-app -w\n\n# Terminal 2: Gerar carga\nkubectl run load-gen --image=busybox:1.36 --rm -it --restart=Never -- \\\n  /bin/sh -c "while true; do wget -q -O- http://web-app > /dev/null; done"\n\n# Aguardar 2-3 minutos e observar:\n# - TARGETS muda de 5%/50% para 80%/50%\n# - REPLICAS aumenta de 2 para 4, 6, 8...\n\n# Parar a carga (Ctrl+C no terminal 2)\n\n# Observar scale down apos 5 minutos (stabilizationWindow)\n# REPLICAS volta gradualmente para 2\nkubectl get hpa web-app -w\n```'
      },
      {
        title: 'Testar PDB com drain de node',
        instruction: 'Escale o Deployment para 3 replicas e verifique em quais nodes os Pods estao rodando. Tente fazer drain de um node e observe como o PDB protege a disponibilidade minima.',
        hints: [
          'kubectl get pods -o wide mostra em quais nodes os Pods estao',
          'kubectl drain precisa de --ignore-daemonsets',
          'O drain respeitara o PDB minAvailable: 1'
        ],
        solution: '```bash\n# Escalar para 3 replicas\nkubectl scale deployment web-app --replicas=3\n\n# Ver distribuicao dos Pods\nkubectl get pods -l app=web-app -o wide\n\n# Identificar node com Pod\nNODE=$(kubectl get pods -l app=web-app -o jsonpath=\'{.items[0].spec.nodeName}\')\n\n# Drain do node (PDB sera respeitado)\nkubectl drain $NODE --ignore-daemonsets --delete-emptydir-data\n\n# Verificar: Pods foram movidos, minAvailable respeitado\nkubectl get pods -l app=web-app -o wide\nkubectl get pdb web-app-pdb\n\n# Reativar o node\nkubectl uncordon $NODE\n\n# Limpar recursos\nkubectl delete deployment web-app\nkubectl delete service web-app\nkubectl delete hpa web-app\nkubectl delete pdb web-app-pdb\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'HPA mostrando "unknown" para CPU e nao escalando',
      symptom: 'O HPA foi criado mas o campo TARGETS mostra "<unknown>/50%" em vez da utilizacao real. O Deployment nao e escalado automaticamente mesmo com carga alta.',
      diagnosis: '```bash\n# Ver status do HPA\nkubectl get hpa web-app\n# TARGETS: <unknown>/50%\n\n# Descrever para ver o erro\nkubectl describe hpa web-app\n# Procurar: "unable to get metrics for resource cpu"\n# Ou: "FailedGetResourceMetric"\n\n# Verificar se o Metrics Server esta rodando\nkubectl get pods -n kube-system | grep metrics-server\n\n# Testar se metricas estao disponiveis\nkubectl top pods\nkubectl top nodes\n# Se falhar: "error: Metrics API not available"\n\n# Verificar se os Pods tem resources.requests definidos\nkubectl describe pod <nome-do-pod> | grep -A5 "Requests"\n```',
      solution: '```bash\n# Causa 1: Metrics Server nao instalado\nkubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml\n\n# Para clusters locais (certificado auto-assinado)\nkubectl patch deployment metrics-server \\\n  -n kube-system \\\n  --type=json \\\n  -p \'[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]\'\n\n# Aguardar o Metrics Server ficar pronto\nkubectl rollout status deployment metrics-server -n kube-system\n\n# Causa 2: Pods sem resources.requests\nkubectl patch deployment web-app \\\n  --type=json \\\n  -p \'[{"op":"add","path":"/spec/template/spec/containers/0/resources","value":{"requests":{"cpu":"100m","memory":"64Mi"}}}]\'\n\n# Verificar que o HPA agora mostra valores reais\nkubectl get hpa web-app\n# TARGETS deve mostrar algo como: 5%/50%\n```'
    },
    {
      title: 'Pod reiniciando continuamente (CrashLoopBackOff) por Liveness Probe',
      symptom: 'O Pod entra em CrashLoopBackOff. Os restarts aumentam a cada ciclo. A aplicacao parece funcionar quando testada manualmente. "kubectl describe pod" mostra "Liveness probe failed" nos Events.',
      diagnosis: '```bash\n# Ver restarts e status\nkubectl get pod <nome> -o wide\n\n# Descrever para ver eventos de probe\nkubectl describe pod <nome>\n# Procurar: "Liveness probe failed: HTTP probe failed"\n# Ou: "Liveness probe failed: Get http://...: dial tcp ... connection refused"\n\n# Verificar logs do container (antes do ultimo restart)\nkubectl logs <nome> --previous\n\n# Testar o endpoint manualmente\nkubectl exec <nome> -- wget -q -O- http://localhost:8080/healthz\n\n# Verificar timing: a aplicacao pode nao ter tempo de inicializar\nkubectl get pod <nome> -o jsonpath=\'{.spec.containers[0].livenessProbe}\'\n```',
      solution: '```bash\n# Causa 1: initialDelaySeconds muito baixo\n# A aplicacao nao tem tempo de inicializar antes da primeira probe\n# Solucao A: Aumentar initialDelaySeconds\nkubectl patch deployment <nome> --type=json -p \'[{"op":"replace","path":"/spec/template/spec/containers/0/livenessProbe/initialDelaySeconds","value":30}]\'\n\n# Solucao B (melhor): Adicionar Startup Probe\n# A startup probe da tempo ao app e so depois ativa a liveness\n# startupProbe:\n#   httpGet:\n#     path: /healthz\n#     port: 8080\n#   failureThreshold: 30\n#   periodSeconds: 10\n\n# Causa 2: endpoint da probe incorreto (path ou porta errada)\n# Verificar qual porta a aplicacao realmente usa\nkubectl exec <nome> -- ss -tlnp\n# Corrigir path/porta na probe\n\n# Causa 3: timeoutSeconds muito baixo para aplicacao lenta\n# Aumentar de 1s para 5-10s\n\n# Causa 4: Liveness verifica dependencia externa (anti-pattern)\n# A liveness deve ser SIMPLES e LOCAL\n# Remover checagem de DB/API externas da liveness\n# Mover para readiness probe\n```'
    },
    {
      title: 'HPA nao escala para baixo (scale down nao funciona)',
      symptom: 'O HPA escalou o Deployment para muitas replicas durante pico de carga, mas nao esta reduzindo as replicas mesmo com a carga tendo diminuido ha mais de 10 minutos.',
      diagnosis: '```bash\n# Ver status atual do HPA\nkubectl get hpa <nome>\n# Verificar TARGETS: se o uso esta abaixo do target\n\n# Descrever para ver condicoes\nkubectl describe hpa <nome>\n# Procurar:\n# - "ScaleDown: disabled" \n# - "stabilization window"\n# - "behavior policies"\n\n# Verificar se ha behavior customizado\nkubectl get hpa <nome> -o yaml | grep -A20 behavior\n\n# Verificar metricas atuais\nkubectl top pods -l app=<label>\n\n# Verificar se existem multiplas metricas\n# O HPA usa a que resultar em MAIS replicas\nkubectl get hpa <nome> -o jsonpath=\'{.spec.metrics}\'\n```',
      solution: '```bash\n# Causa 1: stabilizationWindowSeconds muito alto\n# O padrao para scale down e 300s (5 min)\n# Se configurado com valor alto, aguarde\n\n# Reduzir a janela de estabilizacao\nkubectl patch hpa <nome> --type=merge -p \'{\n  "spec": {\n    "behavior": {\n      "scaleDown": {\n        "stabilizationWindowSeconds": 120\n      }\n    }\n  }\n}\'\n\n# Causa 2: selectPolicy: Disabled no scaleDown\n# Isso DESABILITA o scale down completamente\n# Alterar para Min ou Max\n\n# Causa 3: Multiplas metricas - uma delas ainda e alta\n# O HPA usa o valor que resulta em mais replicas\n# Verificar todas as metricas individuais\nkubectl describe hpa <nome>\n\n# Causa 4: Policy limitada (ex: max 1 pod por 5 min)\n# O scale down pode estar acontecendo, mas muito devagar\n# Ajustar policies:\n# scaleDown:\n#   policies:\n#   - type: Pods\n#     value: 4\n#     periodSeconds: 60\n```'
    }
  ]
};
