window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['app-environment/requests-limits'] = {
  theory: `# Requests, Limits e Quotas no Kubernetes

## Unidades de Recursos

### CPU
- Medida em **cores** ou **millicores (m)**
- 1 core = 1000m
- Exemplos: \`500m\` (meio core), \`1\` (1 core), \`2.5\` (2.5 cores)
- CPU e um recurso **compressivel**: pode ser throttled sem matar o container
- 1 CPU = 1 vCPU = 1 AWS vCPU = 1 GCP Core = 1 Azure vCore = 1 Hyperthread

### Memoria
- Medida em bytes com sufixos binarios ou decimais:

| Sufixo | Valor | Equivalente |
|--------|-------|-------------|
| Ki | 1024 bytes | Kibibyte |
| Mi | 1024 Ki | Mebibyte |
| Gi | 1024 Mi | Gibibyte |
| Ti | 1024 Gi | Tebibyte |
| K | 1000 bytes | Kilobyte |
| M | 1000 K | Megabyte |
| G | 1000 M | Gigabyte |

- Exemplos: \`128Mi\` (128 mebibytes), \`1Gi\` (1 gibibyte), \`256M\` (256 megabytes)
- Memoria e um recurso **incompressivel**: exceder o limit causa OOMKilled

---

## Requests vs Limits

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: resource-demo
spec:
  containers:
  - name: app
    image: nginx:1.25
    resources:
      requests:
        cpu: "250m"
        memory: "128Mi"
      limits:
        cpu: "500m"
        memory: "256Mi"
\`\`\`

| Campo | Funcao | Impacto |
|-------|--------|---------|
| requests | Quantidade **garantida** ao container | Usada pelo scheduler para encontrar Node com capacidade |
| limits | Quantidade **maxima** que o container pode usar | Enforced pelo kernel via cgroups |

- O scheduler usa **requests** para decidir em qual Node colocar o Pod
- Um container que excede o **limit de CPU** e throttled (mais lento, nao morre)
- Um container que excede o **limit de memoria** e **terminado** (OOMKilled)

---

## CPU Throttling vs OOMKill

### CPU Throttling (recurso compressivel)

Quando um container tenta usar mais CPU do que o seu limit, o kernel CFS (Completely Fair Scheduler) aplica throttling:

\`\`\`
Container limite: 500m
Container tentando usar: 800m
Resultado: CPU eh limitada a 500m, processos ficam mais lentos
Container NAO morre, apenas fica mais lento
\`\`\`

\`\`\`bash
# Verificar uso atual de CPU
kubectl top pod <pod-name> --containers

# Verificar throttling via metricas (se Prometheus disponivel)
# Metrica: container_cpu_cfs_throttled_periods_total / container_cpu_cfs_periods_total
# > 25% de throttled periods indica problema de CPU limit muito baixo

# Ver throttling nos cgroups diretamente (no node)
cat /sys/fs/cgroup/cpu/kubepods/pod<pod-uid>/<container-id>/cpu.stat
# throttled_time: tempo em nanosegundos que o container ficou throttled
\`\`\`

**Sinais de throttling excessivo**:
- Latencia alta nas respostas
- Timeouts internos na aplicacao
- Health checks falhando por demora

### OOMKill (recurso incompressivel)

Quando um container excede o memory limit, o kernel Linux termina o processo:

\`\`\`
Container limite: 256Mi
Container tentando usar: 300Mi
Resultado: kernel envia SIGKILL ao processo (exit code 137)
Container eh terminado e reiniciado (conforme restartPolicy)
\`\`\`

\`\`\`bash
# Identificar OOMKilled
kubectl get pod <pod-name>
# STATUS: OOMKilled ou CrashLoopBackOff

# Verificar detalhes
kubectl describe pod <pod-name>
# Buscar em "Last State":
#   Reason: OOMKilled
#   Exit Code: 137

# Ver quanto de memoria o container estava usando antes de morrer
kubectl top pod <pod-name> --containers

# Exit codes relacionados a memoria:
# 137 = 128 + 9 (SIGKILL pelo kernel OOM killer)
# 1 = aplicacao saiu com erro (pode ser OOM interno da JVM, etc)
\`\`\`

---

## Classes de QoS (Quality of Service)

O Kubernetes classifica Pods em 3 classes de QoS baseado em requests e limits. A classe determina a ordem de eviction quando o Node esta com pressao de recursos.

### Guaranteed (melhor protecao)

**Regra**: TODOS os containers do Pod tem requests == limits, para CPU E memoria. Nenhum campo pode estar ausente.

\`\`\`yaml
resources:
  requests:
    cpu: "500m"
    memory: "256Mi"
  limits:
    cpu: "500m"    # igual ao request
    memory: "256Mi" # igual ao request
\`\`\`

- Ultimo a ser eliminado em situacao de pressao de recursos no Node
- Ideal para workloads criticos de producao (bancos de dados, APIs core)
- Nao sofre throttling de CPU (tem garantia de recursos)
- Para verificar: \`kubectl get pod <nome> -o jsonpath="{.status.qosClass}"\`

### Burstable (protecao media)

**Regra**: pelo menos um container tem requests definido, MAS requests != limits em pelo menos um recurso

\`\`\`yaml
resources:
  requests:
    cpu: "200m"
    memory: "128Mi"
  limits:
    cpu: "1"        # diferente do request
    memory: "512Mi" # diferente do request
\`\`\`

- Pode usar mais recursos que o solicitado quando disponivel no Node (burst)
- Eliminado antes de Guaranteed quando Node esta sob pressao
- Adequado para a maioria das aplicacoes com variacao de carga

### BestEffort (sem protecao)

**Regra**: NENHUM container do Pod tem requests ou limits definidos (completamente ausentes)

\`\`\`yaml
# Sem campo resources - nao recomendado em producao
spec:
  containers:
  - name: app
    image: nginx:1.25
    # resources: ausente completamente
\`\`\`

- Primeiro a ser eliminado em situacao de pressao de recursos
- Recebe recursos apenas quando sobrarem no Node
- Nunca use em producao

### Tabela Resumo de QoS

| Classe | Criterio | Prioridade de Eviction | Uso Tipico |
|--------|----------|------------------------|------------|
| Guaranteed | requests == limits (todos containers) | Ultima (protegida) | Producao critica |
| Burstable | requests definido mas != limits | Media | A maioria das apps |
| BestEffort | Sem resources definidos | Primeira (eliminada) | Batch jobs nao criticos |

\`\`\`bash
# Verificar QoS de todos os Pods no namespace
kubectl get pods -o custom-columns='NAME:.metadata.name,QOS:.status.qosClass'

# Verificar QoS de um Pod especifico
kubectl get pod meu-pod -o jsonpath="{.status.qosClass}"
\`\`\`

---

## LimitRange

Define limites e defaults para containers e Pods em um namespace. Util para garantir que todos os Pods tenham resources definidos.

\`\`\`yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: resource-limits
  namespace: dev
spec:
  limits:
  - type: Container
    default:          # limit padrao se nao especificado
      cpu: "500m"
      memory: "256Mi"
    defaultRequest:   # request padrao se nao especificado
      cpu: "100m"
      memory: "128Mi"
    min:              # minimo permitido (requests e limits devem ser >= min)
      cpu: "50m"
      memory: "64Mi"
    max:              # maximo permitido (requests e limits devem ser <= max)
      cpu: "2"
      memory: "2Gi"
    maxLimitRequestRatio:  # max ratio entre limit e request
      cpu: "4"             # limit nao pode ser mais de 4x o request
  - type: Pod           # soma de todos os containers do Pod
    max:
      cpu: "4"
      memory: "4Gi"
  - type: PersistentVolumeClaim
    max:
      storage: "10Gi"
    min:
      storage: "1Gi"
\`\`\`

### Como LimitRange interage com Pods

1. **Pod sem resources**: LimitRange aplica \`default\` como limit e \`defaultRequest\` como request
2. **Pod com apenas limits**: LimitRange aplica \`defaultRequest\` como request
3. **Pod com apenas requests**: LimitRange aplica \`default\` como limit
4. **Pod com requests ou limits fora de min/max**: Pod e REJEITADO

\`\`\`bash
# Verificar LimitRange de um namespace
kubectl describe limitrange resource-limits -n dev

# Verificar LimitRanges de todos os namespaces
kubectl get limitrange -A

# Ver o que foi aplicado automaticamente a um Pod
kubectl get pod meu-pod -o jsonpath='{.spec.containers[*].resources}'
\`\`\`

---

## ResourceQuota

Limita o consumo total de recursos em um namespace. Afeta a criacao de novos objetos (nao objetos existentes).

\`\`\`yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: namespace-quota
  namespace: dev
spec:
  hard:
    # Objetos (contagem)
    pods: "20"
    services: "10"
    secrets: "50"
    configmaps: "30"
    persistentvolumeclaims: "10"
    # Recursos computacionais (soma de requests de todos os Pods)
    requests.cpu: "4"
    requests.memory: "8Gi"
    # Recursos computacionais (soma de limits de todos os Pods)
    limits.cpu: "8"
    limits.memory: "16Gi"
    # Storage total
    requests.storage: "50Gi"
    # Storage class especifica
    standard.storageclass.storage.k8s.io/requests.storage: "20Gi"
\`\`\`

### Comportamento importante do ResourceQuota

- **Verificacao no momento da criacao**: se a quota seria excedida, o objeto e rejeitado
- **Objetos existentes nao sao afetados**: ResourceQuota nao evicta Pods existentes
- **Se ha ResourceQuota no namespace**: Pods SEM resources definidos sao rejeitados (a menos que haja LimitRange com defaults)

\`\`\`bash
# Verificar uso atual da quota
kubectl describe resourcequota namespace-quota -n dev
# Saida mostra: Resource | Used | Hard

# Listar todas as quotas
kubectl get resourcequota -A

# Aumentar quota (requer permissao de admin)
kubectl patch resourcequota namespace-quota -n dev \
  --type=merge \
  -p '{"spec":{"hard":{"requests.memory":"16Gi"}}}'
\`\`\`

---

## Eviction e Pressao de Recursos no Node

Quando um Node fica sob pressao de recursos, o kubelet inicia o processo de eviction:

### Tipos de pressao

| Condicao | Trigger | Acao do kubelet |
|----------|---------|-----------------|
| MemoryPressure | Memoria disponivel < threshold | Evicar Pods BestEffort, Burstable |
| DiskPressure | Disco disponivel < threshold | Evicar Pods com mais uso de disco |
| PIDPressure | PIDs disponiveis < threshold | Evicar Pods |

### Ordem de eviction por QoS

1. **BestEffort**: evictados primeiro (sem protecao)
2. **Burstable**: evictados se necessario, por ordem de uso vs request
3. **Guaranteed**: evictados por ultimo, apenas em casos extremos

\`\`\`bash
# Verificar pressao de recursos no Node
kubectl describe node <nome-do-node>
# Buscar: Conditions (MemoryPressure, DiskPressure, PIDPressure)

# Ver Node Allocatable (recursos disponiveis para Pods)
kubectl get node <nome> -o jsonpath='{.status.allocatable}'

# Node capacity vs allocatable:
# capacity: total de recursos do hardware
# allocatable: capacity - reservado para sistema e kubelet
# kubectl get node <nome> -o jsonpath='{.status.capacity}'
\`\`\`

---

## Node Allocatable e Overcommit

### Node Allocatable

O Node nao usa 100% dos seus recursos para Pods. Parte e reservada para o sistema:

\`\`\`
Node Capacity (hardware total)
  - kube-reserved (recursos para kubelet e componentes K8s)
  - system-reserved (recursos para o OS)
  - eviction-threshold (buffer para eviction)
  = Node Allocatable (disponivel para Pods)
\`\`\`

\`\`\`bash
# Ver capacity e allocatable de todos os nodes
kubectl get nodes -o custom-columns=\
'NAME:.metadata.name,CPU-CAP:.status.capacity.cpu,CPU-ALLOC:.status.allocatable.cpu,MEM-CAP:.status.capacity.memory,MEM-ALLOC:.status.allocatable.memory'
\`\`\`

### Overcommit

Kubernetes permite **overcommit** de recursos: a soma dos **limits** de todos os Pods pode exceder a capacidade do Node. Isso e possivel porque na pratica poucos containers usam seus limits simultaneamente.

**Riscos do overcommit**:
- OOMKill de containers quando varios competem por memoria simultaneamente
- Degradacao de performance por CPU throttling
- Cascata de falhas em momentos de pico

**Boas praticas**:
- Overcommit de CPU e geralmente seguro (throttling nao mata containers)
- Overcommit de memoria e arriscado (OOMKill pode causar CrashLoopBackOff)
- Monitore com \`kubectl top nodes\` e alerte em > 80% de uso

---

## Pod Priority e Preemption

Quando o scheduler nao consegue agendar um Pod por falta de recursos, pode **preemptar** (remover) Pods de menor prioridade para abrir espaco.

\`\`\`yaml
# 1. Criar PriorityClass
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000000          # valor maior = maior prioridade
globalDefault: false    # se true, aplicado a Pods sem priorityClassName
description: "Prioridade alta para workloads criticos"
---
# 2. Usar no Pod
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

\`\`\`bash
# Ver PriorityClasses existentes
kubectl get priorityclass

# PriorityClasses do sistema (nao remover):
# system-node-critical (2000001000) - componentes do node
# system-cluster-critical (2000000000) - componentes do cluster
\`\`\`

**Processo de preemption**:
1. Scheduler nao encontra Node para o Pod de alta prioridade
2. Scheduler identifica Nodes onde remover Pods de baixa prioridade liberaria espaco
3. Pods de baixa prioridade sao evictados (recebem SIGTERM, depois SIGKILL)
4. Pod de alta prioridade e agendado no Node liberado

---

## Exemplo Completo: Namespace com Controles de Recurso

\`\`\`yaml
# 1. Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: producao
---
# 2. LimitRange para defaults automaticos
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: producao
spec:
  limits:
  - type: Container
    default:
      cpu: "500m"
      memory: "256Mi"
    defaultRequest:
      cpu: "100m"
      memory: "128Mi"
    max:
      cpu: "2"
      memory: "2Gi"
    min:
      cpu: "50m"
      memory: "32Mi"
---
# 3. ResourceQuota para limitar o namespace
apiVersion: v1
kind: ResourceQuota
metadata:
  name: producao-quota
  namespace: producao
spec:
  hard:
    pods: "50"
    requests.cpu: "20"
    requests.memory: "40Gi"
    limits.cpu: "40"
    limits.memory: "80Gi"
    persistentvolumeclaims: "20"
    requests.storage: "200Gi"
\`\`\`

---

## Boas Praticas para Requests e Limits

| Recomendacao | Motivo |
|--------------|--------|
| Sempre definir requests | Permite scheduling correto e QoS Burstable |
| Requests = uso medio esperado | Scheduler usa requests para decisoes |
| Limits = pico maximo aceitavel | Protege o Node de containers com vazamento |
| Memory: requests proximos dos limits | Evita OOMKill surpresa |
| CPU: limits podem ser maiores que requests | Throttling e seguro, melhora utilizacao |
| Use LimitRange em cada namespace | Garante que todo Pod tenha resources |
| Monitore com kubectl top | Ajuste baseado em dados reais de uso |
| Evite limits de CPU muito baixos | Causa throttling excessivo e latencia |
`,

  quiz: [
    {
      question: 'Um container esta configurado com requests.cpu=200m e limits.cpu=200m e requests.memory=256Mi e limits.memory=256Mi. Qual e a classe de QoS desse Pod?',
      options: ['BestEffort', 'Burstable', 'Guaranteed', 'Limited'],
      correct: 2,
      explanation: 'Quando requests == limits para CPU e memoria em todos os containers, o Pod recebe a classe QoS Guaranteed. Essa e a melhor classe, pois o Pod e o ultimo a ser eliminado em situacao de pressao de recursos.'
    },
    {
      question: 'O que acontece quando um container excede seu memory limit?',
      options: [
        'O container e throttled e fica mais lento',
        'O container e terminado com status OOMKilled (exit code 137)',
        'O Pod e evictado do Node',
        'O Kubernetes aumenta o limit automaticamente'
      ],
      correct: 1,
      explanation: 'Memoria e um recurso incompressivel. Quando um container excede o memory limit, o kernel Linux termina o processo com OOMKill (exit code 137). CPU, por outro lado, apenas sofre throttling sem matar o container.'
    },
    {
      question: 'Qual recurso Kubernetes define valores padrao de CPU e memoria para containers em um namespace?',
      options: ['ResourceQuota', 'LimitRange', 'NetworkPolicy', 'PodDisruptionBudget'],
      correct: 1,
      explanation: 'LimitRange define defaults (defaultRequest e default), valores minimos e maximos para containers e Pods em um namespace. ResourceQuota limita o total de recursos consumidos no namespace, mas nao define defaults por container.'
    },
    {
      question: 'Um namespace tem ResourceQuota com limits.memory: 10Gi. Dois Pods ja estao rodando com limits.memory: 4Gi cada. Um novo Pod com limits.memory: 3Gi e criado. O que acontece?',
      options: [
        'O Pod e criado normalmente pois 4+4+3=11 sera permitido',
        'O Pod e rejeitado pois 4+4+3=11Gi ultrapassa a quota de 10Gi',
        'O Pod e criado mas fica em Pending',
        'Um dos Pods existentes e evictado para abrir espaco'
      ],
      correct: 1,
      explanation: 'ResourceQuota e verificada no momento da criacao. 4+4+3=11Gi > 10Gi, entao o novo Pod sera rejeitado com erro "exceeded quota". Os Pods existentes nao sao afetados pois ResourceQuota nao evicta objetos ja criados.'
    },
    {
      question: 'Qual e a unidade de 0.5 CPU em millicores?',
      options: ['5m', '50m', '500m', '5000m'],
      correct: 2,
      explanation: '1 CPU core = 1000 millicores. Portanto, 0.5 CPU = 500m. Voce pode usar tanto "0.5" quanto "500m" no manifesto - sao equivalentes. 1 CPU corresponde a 1 vCPU em cloud providers.'
    },
    {
      question: 'Um Pod sem nenhum campo resources definido tem qual classe de QoS?',
      options: ['Guaranteed', 'Burstable', 'BestEffort', 'Unlimited'],
      correct: 2,
      explanation: 'Pods sem requests ou limits definidos recebem a classe BestEffort. Sao os primeiros a ser eliminados pelo kubelet quando o Node esta com pressao de recursos (MemoryPressure ou DiskPressure). Nunca use BestEffort em producao.'
    },
    {
      question: 'Qual campo do LimitRange define automaticamente um limit para containers que nao especificam resources?',
      options: ['defaultRequest', 'default', 'max', 'min'],
      correct: 1,
      explanation: 'O campo "default" em LimitRange define o limit automatico aplicado a containers sem limits especificados. "defaultRequest" define o request automatico. "max" e "min" definem os limites permitidos para requests/limits explicitos.'
    },
    {
      question: 'O que e Node Allocatable e como difere de Node Capacity?',
      options: [
        'Sao a mesma coisa, apenas nomes diferentes para o mesmo valor',
        'Allocatable = Capacity - recursos reservados para kubelet, OS e eviction threshold',
        'Allocatable e o total usado pelos Pods, Capacity e o total do hardware',
        'Capacity e o maximo que um Pod pode usar, Allocatable e o que esta livre'
      ],
      correct: 1,
      explanation: 'Node Allocatable = Capacity (hardware total) - kube-reserved (kubelet/componentes K8s) - system-reserved (OS) - eviction-threshold. E o espaco real disponivel para Pods. O scheduler usa Allocatable, nao Capacity, para decidir onde agendar Pods.'
    },
    {
      question: 'Qual e a ordem de eviction de Pods quando um Node esta sob MemoryPressure?',
      options: [
        'Pods mais antigos primeiro, independente de QoS',
        'BestEffort primeiro, depois Burstable (por uso vs request), depois Guaranteed por ultimo',
        'Guaranteed primeiro por usar mais recursos, BestEffort por ultimo',
        'A ordem e aleatoria entre todos os Pods do Node'
      ],
      correct: 1,
      explanation: 'A ordem de eviction por pressao de memoria e: 1) BestEffort (sem protecao), 2) Burstable (por ordem de quanto estao excedendo seu request), 3) Guaranteed (ultimo recurso). Pods Guaranteed so sao evictados se a pressao for extrema e nao houver outras opcoes.'
    },
    {
      question: 'Para que serve o PriorityClass no Kubernetes em relacao a recursos?',
      options: [
        'Define a ordem de inicializacao de containers em um Pod',
        'Permite que Pods de alta prioridade preemptem (removam) Pods de baixa prioridade para conseguir recursos',
        'Aumenta automaticamente os limits de CPU de Pods prioritarios',
        'Garante que Pods prioritarios recebam a classe QoS Guaranteed'
      ],
      correct: 1,
      explanation: 'PriorityClass define a prioridade de um Pod para scheduling e preemption. Quando o scheduler nao encontra espaco para um Pod de alta prioridade, pode remover Pods de menor prioridade do Node para liberar recursos. Isso e independente de QoS class (que controla eviction pelo kubelet, nao scheduling).'
    }
  ],

  flashcards: [
    {
      front: 'Qual e a diferenca entre requests e limits de recursos?',
      back: 'Requests: quantidade GARANTIDA, usada pelo scheduler para encontrar Node com capacidade suficiente.\nLimits: quantidade MAXIMA que o container pode usar.\nExceder limit de CPU -> throttling (mais lento, nao morre).\nExceder limit de memoria -> OOMKilled (exit 137).'
    },
    {
      front: 'Quais sao as 3 classes de QoS e suas regras?',
      back: 'Guaranteed: requests == limits em TODOS os containers (ultima a ser eliminada)\nBurstable: pelo menos um container com requests != limits ou requests definido mas limit ausente (eliminada antes de Guaranteed)\nBestEffort: NENHUM container com requests ou limits (primeira a ser eliminada)'
    },
    {
      front: 'O que e OOMKilled e qual e o exit code?',
      back: 'OOMKilled (Out Of Memory Killed) ocorre quando um container excede seu memory limit. O kernel Linux termina o processo com SIGKILL. Exit code: 137 (128 + sinal 9). Verificar com: kubectl describe pod e procurar por "OOMKilled" em Last State e "Exit Code: 137".'
    },
    {
      front: 'Qual a diferenca entre LimitRange e ResourceQuota?',
      back: 'LimitRange: define defaults/min/max POR CONTAINER ou POR POD. Automaticamente aplica defaults a containers sem resources.\nResourceQuota: limita o TOTAL DE RECURSOS de um namespace inteiro (soma de todos os Pods). Rejeita novos objetos que excederiam o limite.'
    },
    {
      front: 'Como converter unidades de CPU e memoria?',
      back: 'CPU: 1 core = 1000m (millicores). Exemplos: 500m = 0.5 cores, 250m = 0.25 cores.\nMemoria (binario): 1Ki = 1024 bytes, 1Mi = 1024Ki, 1Gi = 1024Mi.\nMemoria (decimal): 1K = 1000 bytes, 1M = 1000K.\nPrefira sufixos binarios (Mi, Gi) para evitar confusao.'
    },
    {
      front: 'O que acontece quando um container excede o limit de CPU vs o limit de memoria?',
      back: 'CPU (compressivel): container e THROTTLED pelo kernel CFS scheduler. Fica mais lento mas NAO e terminado. Nao gera alertas no kubectl describe.\nMemoria (incompressivel): container e TERMINADO com OOMKill (exit 137). O kubelet pode reinicia-lo dependendo da restartPolicy. Aparece como OOMKilled no kubectl describe.'
    },
    {
      front: 'Se um namespace tem ResourceQuota, o que acontece com Pods que nao definem resources?',
      back: 'Se houver ResourceQuota no namespace, Pods sem resources definidos sao REJEITADOS na criacao com erro "must specify limits". Para resolver: configure um LimitRange com defaultRequest e default, que aplica recursos automaticamente a Pods sem definicao.'
    },
    {
      front: 'O que e Node Allocatable e por que importa para o scheduler?',
      back: 'Node Allocatable = Capacity total do hardware - kube-reserved - system-reserved - eviction-threshold.\nO scheduler usa Allocatable (nao Capacity) para decidir se um Pod cabe no Node.\nPode ser bem menor que a Capacity real (ex: Node 8Gi pode ter apenas 6.5Gi alocavel).\nVer com: kubectl get node -o jsonpath="{.status.allocatable}"'
    },
    {
      front: 'O que e CPU throttling e como identificar?',
      back: 'Throttling ocorre quando um container tenta usar mais CPU que seu limit. O kernel CFS limita o tempo de CPU. Identificar:\n- Latencia alta na aplicacao\n- kubectl top pod mostrando uso proximo do limit\n- Metrica Prometheus: container_cpu_cfs_throttled_periods_total > 25% do total\nSolucao: aumentar limits.cpu ou otimizar a aplicacao.'
    },
    {
      front: 'O que e PriorityClass e como afeta recursos?',
      back: 'PriorityClass define prioridade de scheduling (valor numerico, maior = mais prioritario). Quando um Pod de alta prioridade nao cabe no cluster, o scheduler pode PREEMPTAR (remover) Pods de menor prioridade para liberar espaco. PriorityClasses do sistema: system-node-critical (2000001000) e system-cluster-critical (2000000000). Criar: apiVersion: scheduling.k8s.io/v1, kind: PriorityClass.'
    },
    {
      front: 'Como o kubelet decide quais Pods evicar sob MemoryPressure?',
      back: 'Ordem de eviction por MemoryPressure:\n1. BestEffort: evictados primeiro (sem protecao de recursos)\n2. Burstable: evictados por ordem de uso vs request (quem mais excede o request vai primeiro)\n3. Guaranteed: evictados por ultimo em casos extremos\n\nDentro da mesma classe, Pods com maior uso de memoria em relacao ao request tem prioridade de eviction.'
    },
    {
      front: 'Como configurar LimitRange para aplicar defaults automaticos?',
      back: 'LimitRange com type: Container:\n- default: limit automatico se container nao especifica limits\n- defaultRequest: request automatico se container nao especifica requests\n- min/max: valores minimos e maximos permitidos\n\nSe o namespace tem ResourceQuota, configure LimitRange com defaults para evitar rejeicao de Pods sem resources definidos.'
    }
  ],

  lab: {
    scenario: 'Uma equipe de desenvolvimento esta consumindo recursos excessivos em um namespace compartilhado, afetando outras equipes. Voce precisa implementar controles de recursos com LimitRange e ResourceQuota, validar o comportamento de QoS classes, e diagnosticar um cenario de OOMKill.',
    objective: 'Configurar LimitRange e ResourceQuota em um namespace, validar as classes de QoS, observar o comportamento de OOMKill e CPU throttling, e entender o impacto de Node Allocatable.',
    steps: [
      {
        title: 'Criar namespace com LimitRange e ResourceQuota',
        instruction: `Crie um namespace chamado \`resource-lab\` e configure:
1. Um **LimitRange** com defaults de 100m CPU e 128Mi memoria, e maximos de 1 CPU e 512Mi memoria
2. Uma **ResourceQuota** limitando o namespace a: 10 Pods, 2 CPU total (requests) e 1Gi memoria total (requests)

Verifique os recursos criados com kubectl describe.`,
        hints: [
          'LimitRange e ResourceQuota sao recursos separados aplicados ao namespace',
          'kubectl describe limitrange e kubectl describe resourcequota para verificar',
          'LimitRange afeta criacao de novos Pods; ResourceQuota limita o total'
        ],
        solution: `\`\`\`bash
# Criar namespace
kubectl create namespace resource-lab

cat <<EOF > resource-controls.yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: resource-lab
spec:
  limits:
  - type: Container
    default:
      cpu: "200m"
      memory: "128Mi"
    defaultRequest:
      cpu: "100m"
      memory: "64Mi"
    max:
      cpu: "1"
      memory: "512Mi"
    min:
      cpu: "50m"
      memory: "32Mi"
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: namespace-quota
  namespace: resource-lab
spec:
  hard:
    pods: "10"
    requests.cpu: "2"
    requests.memory: "1Gi"
    limits.cpu: "4"
    limits.memory: "2Gi"
EOF

kubectl apply -f resource-controls.yaml

# Verificar
kubectl describe limitrange default-limits -n resource-lab
kubectl describe resourcequota namespace-quota -n resource-lab
\`\`\``
      },
      {
        title: 'Verificar QoS classes de diferentes Pods',
        instruction: `Crie 2 Pods demonstrando classes de QoS diferentes:
1. **Pod Guaranteed**: requests == limits para CPU e memoria
2. **Pod Burstable**: requests definido mas diferente dos limits

Verifique a QoS class de cada Pod usando jsonpath e custom-columns.

Lembre que o namespace tem LimitRange, entao Pods sem resources recebem defaults automaticamente (resultando em Burstable pois default limit != default request).`,
        hints: [
          'kubectl get pod <nome> -n resource-lab -o jsonpath="{.status.qosClass}"',
          'Para Guaranteed, requests e limits devem ser identicos em TODOS os containers',
          'Use kubectl get pods -o custom-columns para ver todos os QoS de uma vez'
        ],
        solution: `\`\`\`bash
# Pod Guaranteed (requests == limits)
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: guaranteed-pod
  namespace: resource-lab
spec:
  containers:
  - name: app
    image: nginx:1.25
    resources:
      requests:
        cpu: "200m"
        memory: "128Mi"
      limits:
        cpu: "200m"
        memory: "128Mi"
EOF

# Pod Burstable (requests != limits)
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: burstable-pod
  namespace: resource-lab
spec:
  containers:
  - name: app
    image: nginx:1.25
    resources:
      requests:
        cpu: "100m"
        memory: "64Mi"
      limits:
        cpu: "500m"
        memory: "256Mi"
EOF

# Aguardar Pods ficarem prontos
kubectl wait --for=condition=Ready pod/guaranteed-pod pod/burstable-pod \
  -n resource-lab --timeout=60s

# Verificar QoS class de cada Pod
echo "=== QoS Classes ==="
kubectl get pods -n resource-lab \
  -o custom-columns='NAME:.metadata.name,QOS:.status.qosClass'

# Verificar resources que foram aplicados (incluindo defaults do LimitRange)
echo "=== Resources do Pod Guaranteed ==="
kubectl get pod guaranteed-pod -n resource-lab \
  -o jsonpath='{.spec.containers[*].resources}' | python3 -m json.tool
\`\`\``
      },
      {
        title: 'Simular violacao de ResourceQuota',
        instruction: `Tente criar Pods ate que a quota de memoria seja atingida e observe a mensagem de erro retornada pelo Kubernetes.

Verifique o estado atual da quota antes e depois, e observe que os Pods existentes nao sao afetados quando a quota e atingida.`,
        hints: [
          'A quota de requests.memory e 1Gi (1024Mi). Com Pods de 64Mi cada, serao necessarios varios Pods',
          'kubectl describe resourcequota mostra used vs hard para cada recurso',
          'A mensagem de erro inclui: "exceeded quota: namespace-quota"'
        ],
        solution: `\`\`\`bash
# Ver estado atual da quota
kubectl describe resourcequota namespace-quota -n resource-lab

# Criar varios Pods para consumir a quota (cada um usa 200Mi de request de memoria)
for i in $(seq 1 5); do
  cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: quota-test-$i
  namespace: resource-lab
spec:
  containers:
  - name: app
    image: nginx:1.25
    resources:
      requests:
        cpu: "100m"
        memory: "200Mi"
      limits:
        cpu: "200m"
        memory: "300Mi"
EOF
done

# Verificar estado da quota apos criacao
kubectl describe resourcequota namespace-quota -n resource-lab
# Observar: requests.memory: ~1200Mi/1Gi (quota ja excedida)

# Tentar criar mais um Pod (deve ser rejeitado por memoria)
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: quota-overflow
  namespace: resource-lab
spec:
  containers:
  - name: app
    image: nginx:1.25
    resources:
      requests:
        cpu: "100m"
        memory: "200Mi"
      limits:
        cpu: "200m"
        memory: "300Mi"
EOF
# Esperado: Error from server (Forbidden): exceeded quota: namespace-quota,
#           requested: requests.memory=200Mi, used: ..., limited: requests.memory=1Gi

# Verificar que Pods existentes continuam rodando
kubectl get pods -n resource-lab
\`\`\``
      },
      {
        title: 'Diagnosticar e resolver OOMKilled',
        instruction: `Crie um Pod que simula OOMKill usando a imagem \`polinux/stress\` com um memory limit baixo. O container vai tentar usar mais memoria do que o permitido e sera terminado.

Diagnostique o problema usando kubectl describe, identifique o exit code, e entenda como o restart policy afeta o comportamento.`,
        hints: [
          'Use: command: ["stress"], args: ["--vm", "1", "--vm-bytes", "200M", "--vm-keep"]',
          'Configure memory limit de 100Mi (menor que os 200M que o stress vai tentar usar)',
          'kubectl describe pod mostrara OOMKilled em Last State e Exit Code 137',
          'O Pod vai para CrashLoopBackOff porque restartPolicy: Always (padrao) tenta reiniciar'
        ],
        solution: `\`\`\`bash
cat <<EOF > oom-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: oom-demo
  namespace: resource-lab
spec:
  restartPolicy: Always   # Padrao: tenta reiniciar apos OOMKill
  containers:
  - name: stress
    image: polinux/stress:latest
    command: ["stress"]
    args: ["--vm", "1", "--vm-bytes", "200M", "--vm-keep", "-t", "120"]
    resources:
      requests:
        memory: "50Mi"
        cpu: "100m"
      limits:
        memory: "100Mi"   # limite de 100Mi, stress vai tentar 200M -> OOMKill
        cpu: "200m"
EOF

kubectl apply -f oom-pod.yaml

# Aguardar o OOMKill (deve ocorrer em segundos)
kubectl get pod oom-demo -n resource-lab -w
# Observar: Running -> OOMKilled -> CrashLoopBackOff

# Diagnostico completo
kubectl describe pod oom-demo -n resource-lab
# Buscar em "Containers > stress > Last State":
#   Reason:       OOMKilled
#   Exit Code:    137
# Buscar em "Containers > stress > State":
#   Reason:       CrashLoopBackOff (se ja reiniciou varias vezes)

# Ver contagem de restarts
kubectl get pod oom-demo -n resource-lab
# Coluna RESTARTS mostra quantas vezes o container foi reiniciado

# Solucao: aumentar o memory limit criando um novo Pod
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: oom-demo-fixed
  namespace: resource-lab
spec:
  containers:
  - name: stress
    image: polinux/stress:latest
    command: ["stress"]
    args: ["--vm", "1", "--vm-bytes", "200M", "--vm-keep", "-t", "30"]
    resources:
      requests:
        memory: "150Mi"
        cpu: "100m"
      limits:
        memory: "300Mi"   # agora suficiente para 200M + overhead
        cpu: "200m"
EOF

kubectl get pod oom-demo-fixed -n resource-lab -w
# Esperado: Running sem OOMKill

# Limpar o Pod com problema
kubectl delete pod oom-demo -n resource-lab
\`\`\``
      },
      {
        title: 'Verificar Node Allocatable e impacto no scheduling',
        instruction: `Verifique os recursos disponiveis no cluster comparando Node Capacity vs Node Allocatable. Entenda como os requests dos Pods afetam a capacidade disponivel para novos Pods.

Em seguida, verifique o consumo atual e calcule quantos Pods ainda cabem no namespace com base na ResourceQuota e nos recursos do Node.`,
        hints: [
          'kubectl get nodes -o custom-columns para comparar capacity vs allocatable',
          'kubectl describe node mostra "Allocated resources" com % de uso',
          'kubectl top nodes mostra o uso atual real (requer metrics-server)'
        ],
        solution: `\`\`\`bash
# Ver capacity vs allocatable de todos os nodes
kubectl get nodes -o custom-columns=\
'NAME:.metadata.name,CPU-CAP:.status.capacity.cpu,CPU-ALLOC:.status.allocatable.cpu,MEM-CAP:.status.capacity.memory,MEM-ALLOC:.status.allocatable.memory'

# Ver detalhes de um node especifico
NODE=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')
kubectl describe node $NODE | grep -A 10 "Allocated resources"
# Saida mostra: Resource, Requests (%), Limits (%)

# Ver uso atual (requer metrics-server instalado)
kubectl top nodes 2>/dev/null || echo "metrics-server nao disponivel"

# Verificar estado atual da quota do namespace
kubectl describe resourcequota namespace-quota -n resource-lab
# Calcular: hard - used = disponivel para novos Pods

# Ver todos os Pods do namespace e seus requests
kubectl get pods -n resource-lab -o json | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
for pod in data['items']:
  name = pod['metadata']['name']
  for c in pod['spec']['containers']:
    r = c.get('resources', {}).get('requests', {})
    print(f'{name}: cpu={r.get(\"cpu\",\"0\")}, memory={r.get(\"memory\",\"0\")}')
"

# Limpar o namespace apos o lab
kubectl delete namespace resource-lab
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod em OOMKilled repetindo - CrashLoopBackOff por falta de memoria',
      symptom: 'Pod reinicia repetidamente com status OOMKilled. kubectl describe mostra "Exit Code: 137" em Last State. A aplicacao funcionava antes de um aumento de carga ou apos uma nova versao.',
      diagnosis: `\`\`\`bash
# Confirmar OOMKilled
kubectl describe pod <pod-name> -n <namespace>
# Buscar em "Containers > <nome> > Last State":
#   Reason:    OOMKilled
#   Exit Code: 137

# Verificar o limit atual de memoria
kubectl get pod <pod-name> -n <namespace> \
  -o jsonpath='{.spec.containers[*].resources}'

# Ver consumo atual de memoria (se metrics-server disponivel)
kubectl top pod <pod-name> -n <namespace> --containers

# Ver consumo historico nos logs antes do crash
kubectl logs <pod-name> -n <namespace> --previous | tail -50

# Verificar se ha LimitRange que limita o namespace
kubectl describe limitrange -n <namespace>

# Verificar se ResourceQuota impede aumentar o limit
kubectl describe resourcequota -n <namespace>

# Ver quantas vezes o Pod foi reiniciado
kubectl get pod <pod-name> -n <namespace>
# Coluna RESTARTS indica frequencia dos crashes
\`\`\`

Causas comuns:
- Memory limit muito baixo para a carga atual
- Memory leak na aplicacao (uso crescente ao longo do tempo)
- LimitRange impoem um max menor que o necessario
- Pico de carga que excede o memory limit configurado`,
      solution: `**Solucao 1**: Aumentar o memory limit no Deployment:
\`\`\`bash
kubectl set resources deployment/<deploy-name> \\
  --containers=<container-name> \\
  --limits=memory=512Mi \\
  --requests=memory=256Mi \\
  -n <namespace>

# Acompanhar o rollout
kubectl rollout status deployment/<deploy-name> -n <namespace>
\`\`\`

**Solucao 2**: Editar diretamente o Deployment:
\`\`\`bash
kubectl edit deployment <deploy-name> -n <namespace>
# Alterar spec.template.spec.containers[0].resources.limits.memory
\`\`\`

**Solucao 3**: Se o LimitRange impede aumentar o limit, atualizar o LimitRange:
\`\`\`bash
kubectl edit limitrange default-limits -n <namespace>
# Aumentar o valor de max.memory
\`\`\`

**Investigacao de memory leak**:
\`\`\`bash
# Monitorar consumo ao longo do tempo
watch kubectl top pod <pod-name> --containers -n <namespace>

# Se uso cresce continuamente (sem estabilizar), e um leak
# Verificar metricas da aplicacao se disponivel
kubectl port-forward pod/<pod-name> 8080:8080 -n <namespace>
curl localhost:8080/metrics | grep -i memory

# Em producao: configure alertas quando uso > 80% do limit
\`\`\``
    },
    {
      title: 'Pod nao consegue ser criado - namespace sem recursos suficientes',
      symptom: 'kubectl apply retorna "Error from server (Forbidden): pods is forbidden: exceeded quota: namespace-quota, requested: requests.memory=512Mi, used: requests.memory=900Mi, limited: requests.memory=1Gi"',
      diagnosis: `\`\`\`bash
# Ver o estado atual da quota
kubectl describe resourcequota -n <namespace>
# Saida mostra: Resource | Used | Hard
# Identificar qual recurso foi excedido

# Identificar quais Pods estao consumindo mais requests
kubectl get pods -n <namespace> -o json | python3 -c "
import json, sys
data = json.load(sys.stdin)
pods = []
for pod in data['items']:
  mem = 0
  for c in pod['spec']['containers']:
    r = c.get('resources', {}).get('requests', {}).get('memory', '0')
    # converter Mi para inteiro
    if r.endswith('Mi'):
      mem += int(r[:-2])
  pods.append((pod['metadata']['name'], mem))
for name, mem in sorted(pods, key=lambda x: -x[1]):
  print(f'{name}: {mem}Mi')
"

# Verificar uso real vs requests (se metrics-server disponivel)
kubectl top pods -n <namespace> --sort-by=memory
\`\`\`

Causas comuns:
- Requests superestimados em relacao ao uso real
- Muitos Pods de desenvolvimento esquecidos rodando
- ResourceQuota subdimensionada para o crescimento da equipe`,
      solution: `**Opcao 1**: Deletar Pods que nao estao sendo usados:
\`\`\`bash
# Identificar Pods nao utilizados
kubectl get pods -n <namespace>

# Deletar Pods desnecessarios
kubectl delete pod <pod-nao-utilizado> -n <namespace>

# Verificar nova situacao da quota
kubectl describe resourcequota -n <namespace>
\`\`\`

**Opcao 2**: Reducir requests de Pods existentes (se superestimados):
\`\`\`bash
kubectl set resources deployment/<nome> \\
  --containers=<container> \\
  --requests=memory=256Mi \\
  -n <namespace>

kubectl rollout status deployment/<nome> -n <namespace>
\`\`\`

**Opcao 3**: Aumentar a quota (requer permissao de admin):
\`\`\`bash
kubectl patch resourcequota namespace-quota -n <namespace> \\
  --type=merge \\
  -p '{"spec":{"hard":{"requests.memory":"2Gi","limits.memory":"4Gi"}}}'

# Verificar quota atualizada
kubectl describe resourcequota namespace-quota -n <namespace>
\`\`\``
    },
    {
      title: 'Aplicacao lenta sem OOMKill - CPU throttling excessivo',
      symptom: 'Aplicacao responde muito lentamente, health checks ocasionalmente falham, mas o Pod continua em Running sem reiniciar. kubectl top mostra uso de CPU proximo ao limit configurado.',
      diagnosis: `\`\`\`bash
# Verificar uso atual de CPU
kubectl top pod <pod-name> -n <namespace> --containers
# Se uso esta sempre proximo do limit, ha throttling

# Verificar o limit configurado
kubectl get pod <pod-name> -n <namespace> \
  -o jsonpath='{.spec.containers[*].resources.limits}'

# Comparar uso vs limit
kubectl top pod <pod-name> -n <namespace> --containers
# Se cpu usa ~480m e o limit e 500m, o container esta sendo throttled

# Verificar eventos recentes do Pod
kubectl describe pod <pod-name> -n <namespace> | grep -A 5 Events

# Se Prometheus disponivel: verificar metrica de throttling
# container_cpu_cfs_throttled_periods_total / container_cpu_cfs_periods_total
# > 25% indica throttling significativo

# Verificar se ha picos de carga correlacionados com lentidao
kubectl logs <pod-name> -n <namespace> | grep -i "timeout\\|slow\\|latency"
\`\`\`

O throttling de CPU nao aparece claramente no kubectl describe (sem eventos de erro). O sintoma e puramente de performance - latencia alta sem crashes.`,
      solution: `**Solucao 1**: Aumentar o CPU limit:
\`\`\`bash
# Verificar quanto de CPU os outros Pods do namespace usam
kubectl top pods -n <namespace> --sort-by=cpu

# Verificar ResourceQuota antes de aumentar
kubectl describe resourcequota -n <namespace>

# Aumentar o CPU limit no Deployment
kubectl set resources deployment/<deploy-name> \\
  --containers=<container-name> \\
  --limits=cpu=1 \\
  --requests=cpu=500m \\
  -n <namespace>

kubectl rollout status deployment/<deploy-name> -n <namespace>
\`\`\`

**Solucao 2**: Aumentar numero de replicas para distribuir a carga:
\`\`\`bash
kubectl scale deployment/<deploy-name> --replicas=3 -n <namespace>

# Verificar distribuicao de carga entre Pods
kubectl top pods -l app=<nome-da-app> -n <namespace>
\`\`\`

**Solucao 3**: Se LimitRange impede aumentar o limit de CPU:
\`\`\`bash
# Ver o max permitido pelo LimitRange
kubectl describe limitrange -n <namespace>

# Atualizar LimitRange (requer permissao de admin)
kubectl patch limitrange default-limits -n <namespace> \
  --type=json \
  -p '[{"op":"replace","path":"/spec/limits/0/max/cpu","value":"2"}]'
\`\`\``
    }
  ]
};
