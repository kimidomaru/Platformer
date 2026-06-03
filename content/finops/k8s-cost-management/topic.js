window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['finops/k8s-cost-management'] = {
  theory: `# Kubernetes Cost Management

## Relevância no Exame
> Gerenciamento de custos em Kubernetes é essencial para KubeAstronaut e papéis de Platform Engineering. Cobre desde ResourceQuota e LimitRange até ferramentas como Kubecost e Goldilocks para right-sizing.

## Conceitos Fundamentais

### Por que Custos no Kubernetes São Complexos?
Ao contrário de VMs tradicionais, Kubernetes introduz desafios únicos de custo:
- **Shared resources**: múltiplos workloads compartilham nodes
- **Bin packing**: nem sempre todos os recursos são usados
- **Sobreprovisionamento**: o anti-padrão mais comum — definir requests muito altos
- **Subutilização**: requests baixos → scheduler coloca workloads no mesmo node → OOM Kill

### Resource Requests vs Limits

\`\`\`
         CPU                    Memory
         ┌──────────────────────────────────┐
Request  │ Garantia mínima │ Garantia mínima │ ← usado pelo scheduler
Limit    │ Teto máximo      │ Teto máximo     │ ← CPU: throttle | Mem: OOMKill
         └──────────────────────────────────┘
\`\`\`

**Regras de ouro**:
- Request = uso médio real (p50 de uso)
- Limit memory = 2x o request (headroom para picos)
- Limit CPU = pode ser deixado sem limit (throttling é melhor que OOMKill)
- Nunca definir requests = 0 (impossível scheduler planejar)

### QoS Classes e Impacto nos Custos

| QoS Class | Condição | Comportamento sob pressão |
|-----------|----------|--------------------------|
| Guaranteed | requests == limits (ambos definidos) | Último a ser evicted |
| Burstable | requests < limits | Evicted segundo prioridade |
| BestEffort | sem requests nem limits | Primeiro a ser evicted |

### LimitRange — Defaults por Namespace
Define valores padrão e limites máximos para containers que não especificam recursos:

\`\`\`yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: my-team
spec:
  limits:
    - type: Container
      default:           # Limit padrão se não especificado
        cpu: 500m
        memory: 512Mi
      defaultRequest:    # Request padrão se não especificado
        cpu: 100m
        memory: 128Mi
      max:               # Limite máximo permitido
        cpu: "4"
        memory: 4Gi
      min:               # Mínimo obrigatório
        cpu: 50m
        memory: 64Mi

    - type: Pod
      max:
        cpu: "8"
        memory: 8Gi

    - type: PersistentVolumeClaim
      max:
        storage: 50Gi
      min:
        storage: 1Gi
\`\`\`

### ResourceQuota — Limites por Namespace
Controla o consumo total de recursos dentro de um namespace:

\`\`\`yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: my-team
spec:
  hard:
    # Compute
    requests.cpu: "10"      # total de CPU requests
    requests.memory: 20Gi   # total de memory requests
    limits.cpu: "20"
    limits.memory: 40Gi

    # Objetos
    pods: "50"
    services: "10"
    services.loadbalancers: "2"
    persistentvolumeclaims: "20"
    requests.storage: 100Gi

    # Por storage class
    standard.storageclass.storage.k8s.io/requests.storage: 50Gi
    premium.storageclass.storage.k8s.io/requests.storage: 10Gi

    # Contagem de recursos por tipo
    count/deployments.apps: "20"
    count/configmaps: "50"
\`\`\`

### Kubecost — Visibilidade de Custos
Kubecost é a ferramenta de referência para alocação de custos em Kubernetes:

\`\`\`
Kubecost coleta:
  - Uso real de CPU/memória por pod
  - PVC usage e custo de storage
  - Custo de network (egress)
  - Preços de nós (spot, on-demand, reserved)

Kubecost gera:
  - Custo por namespace/deployment/label/team
  - Savings recommendations
  - Anomaly detection
  - Budget alerts
\`\`\`

### Goldilocks — Right-Sizing Automático
Goldilocks usa o VPA (Vertical Pod Autoscaler) em modo recomendação para sugerir recursos ideais:

\`\`\`bash
# Habilitar Goldilocks para um namespace
kubectl label namespace my-team goldilocks.fairwinds.com/enabled=true

# Goldilocks cria VPAs e coleta recomendações
# Dashboard mostra: request atual vs recomendado vs diferença de custo
\`\`\`

### Node Right-Sizing com Kubecost
\`\`\`
Kubecost cluster right-sizing:
- Analisa packing efficiency de cada node pool
- Sugere instance types menores quando utilização < 60%
- Calcula potencial de economia de spot vs on-demand
- Integra com Cluster Autoscaler para sugestões de node groups
\`\`\`

## Comandos Essenciais

### Verificar Uso de Recursos
\`\`\`bash
# Top de consumo por node
kubectl top nodes

# Top de consumo por pod (todos os namespaces)
kubectl top pods --all-namespaces --sort-by=cpu
kubectl top pods --all-namespaces --sort-by=memory

# Ver requests e limits de todos os pods de um namespace
kubectl get pods -n my-team -o json | \\
  jq '.items[] | {
    name: .metadata.name,
    cpu_req: .spec.containers[0].resources.requests.cpu,
    mem_req: .spec.containers[0].resources.requests.memory,
    cpu_lim: .spec.containers[0].resources.limits.cpu,
    mem_lim: .spec.containers[0].resources.limits.memory
  }'

# Pods sem resource requests definidos (risco de custo)
kubectl get pods --all-namespaces -o json | \\
  jq '.items[] | select(
    .spec.containers[0].resources.requests == null or
    .spec.containers[0].resources.requests.cpu == null
  ) | {ns: .metadata.namespace, name: .metadata.name}'
\`\`\`

### Verificar Quotas e Limites
\`\`\`bash
# Ver ResourceQuota e uso atual
kubectl describe resourcequota -n my-team

# Ver LimitRange
kubectl describe limitrange -n my-team

# Ver todos os ResourceQuotas no cluster
kubectl get resourcequota --all-namespaces

# Verificar se namespace usa mais do que X% da quota
kubectl get resourcequota -n my-team -o json | \\
  jq '.items[0].status | {
    hard: .hard,
    used: .used
  }'
\`\`\`

### Instalar Kubecost
\`\`\`bash
# Via Helm
helm repo add kubecost https://kubecost.github.io/cost-analyzer
helm repo update

helm install kubecost kubecost/cost-analyzer \\
  --namespace kubecost \\
  --create-namespace \\
  --set kubecostToken="TOKEN" \\
  --set prometheus.enabled=true \\
  --set grafana.enabled=false  # usar Grafana existente

# Acessar dashboard
kubectl port-forward -n kubecost svc/kubecost-cost-analyzer 9090:9090

# Ver recomendações via API
curl http://localhost:9090/model/savings/requestSizing | jq '.'
\`\`\`

### Instalar Goldilocks
\`\`\`bash
# Instalar VPA (prerequisito)
helm repo add fairwinds-stable https://charts.fairwinds.com/stable
helm install vpa fairwinds-stable/vpa --namespace vpa --create-namespace

# Instalar Goldilocks
helm install goldilocks fairwinds-stable/goldilocks \\
  --namespace goldilocks \\
  --create-namespace

# Habilitar para namespace
kubectl label namespace production goldilocks.fairwinds.com/enabled=true

# Acessar dashboard
kubectl port-forward -n goldilocks svc/goldilocks-dashboard 8080:80
\`\`\`

## Exemplos YAML

### LimitRange para Namespace de Desenvolvimento
\`\`\`yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: dev-limits
  namespace: development
spec:
  limits:
    - type: Container
      default:
        cpu: 200m
        memory: 256Mi
      defaultRequest:
        cpu: 50m
        memory: 64Mi
      max:
        cpu: "2"
        memory: 2Gi
      min:
        cpu: 10m
        memory: 32Mi
    - type: PersistentVolumeClaim
      max:
        storage: 10Gi
      min:
        storage: 100Mi
\`\`\`

### ResourceQuota por Time (Multi-tenancy)
\`\`\`yaml
# Namespace do time de Backend
apiVersion: v1
kind: ResourceQuota
metadata:
  name: backend-team-quota
  namespace: backend
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    limits.cpu: "40"
    limits.memory: 80Gi
    pods: "100"
    services: "20"
    services.loadbalancers: "3"
    persistentvolumeclaims: "50"
    requests.storage: 500Gi
    count/deployments.apps: "30"
    count/jobs.batch: "20"

---
# Namespace do time de ML (GPU-heavy)
apiVersion: v1
kind: ResourceQuota
metadata:
  name: ml-team-quota
  namespace: ml-platform
spec:
  hard:
    requests.cpu: "100"
    requests.memory: 500Gi
    limits.cpu: "200"
    limits.memory: 1000Gi
    requests.nvidia.com/gpu: "8"
    limits.nvidia.com/gpu: "8"
    pods: "50"
    requests.storage: 5Ti
\`\`\`

### VPA para Right-Sizing
\`\`\`yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-vpa
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-deployment
  updatePolicy:
    updateMode: "Off"   # Apenas recomendações, sem atualizar pods
    # "Auto" = atualiza automaticamente (cuidado em produção)
    # "Initial" = só aplica em novos pods
    # "Off" = apenas recomendações
  resourcePolicy:
    containerPolicies:
      - containerName: api
        minAllowed:
          cpu: 50m
          memory: 64Mi
        maxAllowed:
          cpu: "4"
          memory: 4Gi
        controlledResources:
          - cpu
          - memory
\`\`\`

### Namespace Budget Alert com Kubecost
\`\`\`yaml
# Kubecost Budget Alert (via Values do Helm)
kubecostProductConfigs:
  alerts:
    - type: budget
      threshold: 500    # USD por mês
      window: monthly
      aggregation: namespace
      filter: production
      slackWebhookUrl: "https://hooks.slack.com/services/..."
      ownerContact:
        - email: "platform-team@company.com"
\`\`\`

## Erros Comuns

### 1. Todos os pods BestEffort (sem requests)
**Causa**: LimitRange não configurado e developers não definem recursos.
**Impacto**: Workloads críticos evicted em picos; custo invisível.
**Solução**: Implementar LimitRange com defaultRequest obrigatório.

### 2. Requests muito altos (sobreprovisionamento)
**Causa**: Developers "por garantia" definem requests 3-5x o uso real.
**Impacto**: Nós com alta utilização aparente mas baixo uso real = nós ociosos caros.
**Solução**: Usar Goldilocks para recomendar requests baseados em uso histórico.

### 3. ResourceQuota bloqueia deployments sem aviso claro
**Causa**: Quota de CPU/pods atingida; novo deployment fica em Pending.
**Solução**: Monitorar alertas de quota (\`kubectl describe resourcequota\`) e configurar alertas no Kubecost.

### 4. VPA e HPA no mesmo Deployment
**Causa**: VPA e HPA tentam ajustar o mesmo Deployment simultaneamente.
**Solução**: Não usar VPA mode "Auto" com HPA no mesmo Deployment. Use KEDA com HPA OU VPA em modo "Off" (recomendação).

### 5. LimitRange não aplica retroativamente
**Causa**: LimitRange só aplica a pods criados depois da sua criação.
**Solução**: Fazer rollout restart nos Deployments após criar LimitRange para aplicar defaults.

## Killer.sh Style Challenge

**Contexto**: O cluster de produção tem custos crescendo 30% ao mês sem explicação. Como Platform Engineer, você precisa:
1. Identificar os 5 namespaces com maior consumo de CPU
2. Identificar pods sem resource requests no namespace \`production\`
3. Criar LimitRange no namespace \`staging\` com requests de 100m CPU e 128Mi de memória
4. Criar ResourceQuota no namespace \`team-alpha\` limitando a 10 CPU requests e 20Gi memory requests
5. Verificar que nenhum pod no namespace \`critical\` é BestEffort QoS`,

  quiz: [
    {
      question: 'Qual QoS class é atribuída a um pod que tem requests iguais aos limits para CPU e memória?',
      options: [
        'BestEffort',
        'Burstable',
        'Guaranteed',
        'Premium'
      ],
      correct: 2,
      explanation: 'Guaranteed é atribuído quando AMBOS CPU e memória têm requests definidos E iguais aos limits. Esses pods são os últimos a serem evicted sob pressão de memória no node.',
      reference: 'Conceito: QoS Classes — seção "QoS Classes e Impacto nos Custos" na teoria.'
    },
    {
      question: 'Qual é o efeito de NÃO definir resource requests em um container?',
      options: [
        'O container recebe metade dos recursos do node automaticamente',
        'O container é classificado como BestEffort e é evicted primeiro sob pressão',
        'O Kubernetes recusa criar o pod por falta de especificação',
        'O container herda os resources do namespace'
      ],
      correct: 1,
      explanation: 'Sem requests, o pod é classificado como BestEffort — a prioridade mais baixa. O kubelet vai evictar esses pods primeiro quando o node ficar sem memória. Além disso, o scheduler não consegue fazer placement eficiente, levando ao sobreprovisionamento.',
      reference: 'Conceito: QoS sem requests — seção "QoS Classes e Impacto nos Custos" na teoria.'
    },
    {
      question: 'O que o LimitRange.spec.limits[].defaultRequest faz?',
      options: [
        'Define o máximo de recursos que um container pode ter',
        'Define o request padrão aplicado a containers que não especificam recursos',
        'Define os recursos reservados para o namespace inteiro',
        'Configura o resource request mínimo para PVCs'
      ],
      correct: 1,
      explanation: 'defaultRequest define os valores de resources.requests que serão automaticamente injetados em containers que não especificam nenhum request. Isso garante que todos os pods tenham requests definidos mesmo que o desenvolvedor não especifique.',
      reference: 'Config: LimitRange defaultRequest — seção "LimitRange — Defaults por Namespace" na teoria.'
    },
    {
      question: 'Qual ferramenta usa o VPA em modo recomendação para sugerir o right-sizing de containers?',
      options: [
        'Kubecost',
        'Prometheus',
        'Goldilocks',
        'Vertical Scaler'
      ],
      correct: 2,
      explanation: 'Goldilocks (da Fairwinds) cria objetos VPA para cada Deployment nos namespaces habilitados e coleta as recomendações do VPA. Um dashboard mostra os requests atuais vs recomendados, facilitando o right-sizing sem automação imediata.',
      reference: 'Ferramenta: Goldilocks — seção "Goldilocks — Right-Sizing Automático" na teoria.'
    },
    {
      question: 'Qual é o risco de usar VPA mode "Auto" junto com um HPA no mesmo Deployment?',
      options: [
        'O VPA desabilita o HPA automaticamente — não há conflito',
        'O VPA e o HPA conflitam ao tentar ajustar o mesmo Deployment simultaneamente',
        'O HPA passa a controlar apenas memória enquanto o VPA controla CPU',
        'Não há risco — VPA e HPA são complementares por design'
      ],
      correct: 1,
      explanation: 'VPA mode "Auto" reinicia pods para ajustar recursos, o que pode conflitar com o HPA que está adicionando/removendo réplicas. Para usar ambos, use VPA em modo "Off" (apenas recomendações) e aplique manualmente, ou use KEDA que é compatível com VPA.',
      reference: 'Erros comuns: VPA + HPA — seção "Erros Comuns" na teoria.'
    },
    {
      question: 'Em um ResourceQuota, o que "requests.cpu: 10" significa?',
      options: [
        'Máximo de 10 vCPUs por pod no namespace',
        'Total máximo de CPU requests de todos os pods no namespace',
        'Namespace pode criar no máximo 10 pods com qualquer CPU',
        'CPU limit máximo de qualquer container no namespace'
      ],
      correct: 1,
      explanation: 'requests.cpu em ResourceQuota limita a SOMA de todos os cpu requests de todos os pods no namespace. Se a soma ultrapassar o valor definido, novos pods com requests definidos serão rejeitados. Isso protege contra um namespace monopolizar recursos do cluster.',
      reference: 'Config: ResourceQuota — seção "ResourceQuota — Limites por Namespace" na teoria.'
    },
    {
      question: 'O que acontece quando um LimitRange é criado em um namespace com pods existentes?',
      options: [
        'LimitRange é aplicado retroativamente a todos os pods existentes',
        'LimitRange aplica apenas a novos pods criados após sua criação',
        'LimitRange reinicia todos os pods para aplicar os defaults',
        'LimitRange emite um aviso e rejeita a criação se houver pods violando'
      ],
      correct: 1,
      explanation: 'LimitRange NÃO aplica retroativamente. Pods criados antes do LimitRange continuam com seus recursos originais (ou sem recursos se não foram definidos). Para aplicar os defaults a pods existentes, é necessário fazer rollout restart nos Deployments.',
      reference: 'Erros comuns: LimitRange retroativo — seção "Erros Comuns" na teoria.'
    },
    {
      question: 'Qual comando mostra os pods que mais consomem memória em todos os namespaces?',
      options: [
        'kubectl describe nodes | grep memory',
        'kubectl top pods --all-namespaces --sort-by=memory',
        'kubectl get pods --all-namespaces -o memory',
        'kubectl usage pods --memory --all-namespaces'
      ],
      correct: 1,
      explanation: 'kubectl top pods --all-namespaces --sort-by=memory lista todos os pods com seu consumo atual de CPU e memória, ordenados pelo maior consumo de memória. Requer o Metrics Server instalado no cluster.',
      reference: 'Comandos: kubectl top — seção "Verificar Uso de Recursos" na teoria.'
    }
  ],

  flashcards: [
    {
      front: 'Quais são as 3 QoS classes e suas condições?',
      back: 'Guaranteed:\n- requests == limits para CPU E memória\n- Último a ser evicted\n- Melhor para workloads críticos\n\nBurstable:\n- requests < limits (pelo menos 1 recurso)\n- Evicted conforme prioridade\n- Maioria dos workloads de produção\n\nBestEffort:\n- SEM requests nem limits\n- Primeiro a ser evicted\n- Somente para jobs não-críticos tolerantes a falhas'
    },
    {
      front: 'O que faz o LimitRange e o que o ResourceQuota faz?',
      back: 'LimitRange (por container/pod):\n- Injeta defaults quando container não define recursos\n- Define max/min por container\n- Aplica a NOVOS pods apenas\n- Scope: namespace → container/pod/PVC\n\nResourceQuota (por namespace):\n- Limita TOTAL de recursos do namespace\n- Impede criação quando quota é atingida\n- Scope: namespace → soma de todos os pods\n- Ex: requests.cpu: "10" = máximo 10 CPU total'
    },
    {
      front: 'Qual é a regra de ouro para definir Resource Requests e Limits?',
      back: 'Request = uso real médio (p50 de uso histórico)\nLimit memory = 1.5x a 2x do request\nLimit CPU = opcional (throttle > OOMKill)\n\nExemplo:\nAplicação usa ~200m CPU em média:\n  requests.cpu: 200m\n  limits.cpu: 500m  # ou sem limit\n  requests.memory: 256Mi\n  limits.memory: 512Mi\n\nNunca: requests=0 (BestEffort = evicted primeiro)\nNunca: limits muito pequenos (OOMKill frequente)'
    },
    {
      front: 'O que é o Goldilocks e como funciona?',
      back: 'Goldilocks (Fairwinds) faz right-sizing usando VPA:\n\n1. Adicionar label ao namespace:\n   kubectl label ns production goldilocks.fairwinds.com/enabled=true\n\n2. Goldilocks cria VPAs para cada Deployment\n\n3. VPA coleta métricas de uso real dos containers\n\n4. Dashboard Goldilocks mostra:\n   - Request atual vs Recomendado vs Diferença\n   - Estimativa de custo/economia\n   - YAML pronto para copiar e aplicar\n\nMode: VPA "Off" = apenas recomendações'
    },
    {
      front: 'Por que VPA "Auto" + HPA no mesmo Deployment é problemático?',
      back: 'Conflito:\n- VPA "Auto" reinicia pods para mudar requests\n- HPA adiciona/remove réplicas baseado em carga\n- Ambos operam no mesmo objeto simultaneamente\n- Pode causar loops de restart e instabilidade\n\nSolução:\n- Use VPA mode "Off" para recomendações\n  e aplique manualmente em janelas de manutenção\n\n- Use KEDA (event-driven) em vez de HPA\n  — KEDA é compatível com VPA\n\n- VPA "Initial" — só aplica em pods novos\n  é mais seguro com HPA'
    },
    {
      front: 'Como identificar pods sem resource requests no cluster?',
      back: 'kubectl get pods --all-namespaces -o json | \\\n  jq \'.items[] | select(\n    .spec.containers[0].resources.requests == null or\n    .spec.containers[0].resources.requests.cpu == null\n  ) | {ns: .metadata.namespace, name: .metadata.name}\'\n\n# Verificar QoS class\nkubectl get pods -n production -o json | \\\n  jq \'.items[] | {name: .metadata.name, qos: .status.qosClass}\'\n\n# Filtrar apenas BestEffort\nkubectl get pods -A -o json | \\\n  jq \'.items[] | select(.status.qosClass=="BestEffort") | .metadata\''
    },
    {
      front: 'O que o Kubecost oferece para gerenciamento de custos?',
      back: 'Visibilidade:\n- Custo por namespace, deployment, label, team\n- Custo de compute (CPU+mem) + storage + network\n- Preços reais por instance type (spot, on-demand)\n\nRecomendações:\n- Request right-sizing baseado em uso real\n- Node right-sizing (instance types menores)\n- Identificar recursos ociosos\n\nAlertas:\n- Budget alerts por namespace/team\n- Anomaly detection (custo anormal)\n- Relatórios de chargeback para times\n\nAcesso:\nkubectl port-forward -n kubecost svc/kubecost-cost-analyzer 9090'
    },
    {
      front: 'Como monitorar o uso de ResourceQuota em um namespace?',
      back: '# Ver quota e uso atual\nkubectl describe resourcequota -n my-team\n# Saída mostra: Resource, Used, Hard\n\n# Exemplo de saída:\n# Name: team-quota\n# Resource          Used   Hard\n# --------          ----   ----\n# limits.cpu        8      20\n# limits.memory     16Gi   40Gi\n# pods              23     50\n# requests.cpu      4      10\n\n# Via JSON para scripts\nkubectl get resourcequota -n my-team -o json | \\\n  jq .items[0].status\n\n# Alertar quando > 80%: use Kubecost ou Prometheus'
    }
  ],

  lab: {
    scenario: 'Você é o Platform Engineer responsável pelo cluster multi-tenant da empresa. Três times compartilham o cluster: backend, frontend e data-science. Você precisa implementar governança de recursos para evitar custos descontrolados e conflitos de recursos.',
    objective: 'Implementar LimitRange e ResourceQuota por namespace, usar VPA para recomendações de right-sizing e verificar impacto nos pods.',
    duration: '25-35 minutos',
    steps: [
      {
        title: 'Configurar LimitRange e ResourceQuota por Time',
        instruction: `Crie namespaces para os três times e configure políticas de recursos:

- **backend**: CPU requests máx 20, memory 40Gi, limite por container de 2 CPU e 2Gi mem
- **frontend**: CPU requests máx 10, memory 20Gi, limite por container de 500m CPU e 512Mi mem
- **data-science**: CPU requests máx 50, memory 100Gi, sem limite por container (mas com defaults)

Para cada namespace, configure também LimitRange com defaults adequados.`,
        hints: [
          'Crie o namespace antes de aplicar LimitRange/ResourceQuota',
          'LimitRange e ResourceQuota são objetos separados no mesmo namespace',
          'defaultRequest é aplicado quando o container não define resources'
        ],
        solution: `\`\`\`bash
# Criar namespaces
kubectl create namespace backend
kubectl create namespace frontend
kubectl create namespace data-science

# Backend: LimitRange + ResourceQuota
kubectl apply -f - <<EOF
apiVersion: v1
kind: LimitRange
metadata:
  name: backend-limits
  namespace: backend
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 512Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      max:
        cpu: "2"
        memory: 2Gi
      min:
        cpu: 10m
        memory: 32Mi
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: backend-quota
  namespace: backend
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    limits.cpu: "40"
    limits.memory: 80Gi
    pods: "100"
    services: "20"
    persistentvolumeclaims: "50"
    requests.storage: 500Gi
EOF

# Frontend: LimitRange + ResourceQuota
kubectl apply -f - <<EOF
apiVersion: v1
kind: LimitRange
metadata:
  name: frontend-limits
  namespace: frontend
spec:
  limits:
    - type: Container
      default:
        cpu: 200m
        memory: 256Mi
      defaultRequest:
        cpu: 50m
        memory: 64Mi
      max:
        cpu: 500m
        memory: 512Mi
      min:
        cpu: 10m
        memory: 32Mi
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: frontend-quota
  namespace: frontend
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "50"
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar LimitRange e ResourceQuota
kubectl describe limitrange backend-limits -n backend
# Saída esperada: Default, DefaultRequest, Max, Min configurados

kubectl describe resourcequota backend-quota -n backend
# Saída esperada: Resource, Used (0), Hard (20 CPU, 40Gi mem)

# Testar que LimitRange injeta defaults
kubectl run test-pod --image=nginx -n backend
kubectl get pod test-pod -n backend -o json | \\
  jq '.spec.containers[0].resources'
# Saída esperada: requests {cpu: 100m, memory: 128Mi}
# limits {cpu: 500m, memory: 512Mi}

# Limpar pod de teste
kubectl delete pod test-pod -n backend
\`\`\``
      },
      {
        title: 'Testar Enforcement de ResourceQuota e LimitRange',
        instruction: `Teste os limites configurados:
1. Tente criar um pod com CPU request maior que o max do LimitRange no namespace frontend (deve falhar)
2. Crie múltiplos pods para esgotar a quota de um namespace e verifique o comportamento
3. Verifique o uso atual das quotas

Use o namespace \`frontend\` que tem limites mais restritos para testar.`,
        hints: [
          'O LimitRange max impede criar containers acima do limite',
          'Quando ResourceQuota é atingida, pods ficam em estado de erro "exceeded quota"',
          'kubectl describe resourcequota mostra Used vs Hard em tempo real'
        ],
        solution: `\`\`\`bash
# Teste 1: Pod violando max do LimitRange (deve falhar)
kubectl run oversized-pod \\
  --image=nginx \\
  --requests="cpu=1" \\
  --limits="cpu=2,memory=1Gi" \\
  -n frontend
# Esperado: Error - pods "oversized-pod" is forbidden:
# [Container cpu limit ... exceeds max limit per Container]

# Teste 2: Criar pods até atingir quota
for i in \$(seq 1 15); do
  kubectl run pod-\$i --image=nginx -n frontend
done

# Verificar estado
kubectl get pods -n frontend | wc -l
kubectl describe resourcequota frontend-quota -n frontend

# Criar um pod quando quota de pods = 50 está esgotada
kubectl run pod-100 --image=nginx -n frontend
# Esperado: Error - exceeded quota: frontend-quota, requested: pods=1, used: pods=50, limited: pods=50

# Verificar uso atual de recursos
kubectl describe resourcequota -n frontend
\`\`\``,
        verify: `\`\`\`bash
# Verificar que pod oversized foi rejeitado
kubectl get pods -n frontend | grep oversized
# Saída esperada: (vazio — pod não criado)

# Verificar uso de quota em detalhe
kubectl get resourcequota frontend-quota -n frontend -o json | \\
  jq '{used: .status.used, hard: .status.hard}'
# Saída esperada: used.pods próximo de hard.pods (50)

# Verificar QoS dos pods criados
kubectl get pods -n frontend -o json | \\
  jq '.items[:3] | .[] | {name: .metadata.name, qos: .status.qosClass}'
# Saída esperada: Burstable (pois LimitRange injetou requests < limits)

# Limpar pods de teste
kubectl delete pods --all -n frontend
\`\`\``
      },
      {
        title: 'Instalar Goldilocks e Obter Recomendações de Right-Sizing',
        instruction: `Instale o VPA e o Goldilocks, habilite o right-sizing para o namespace \`backend\` e analise as recomendações.

Faça deploy de uma aplicação de exemplo no namespace backend para que o VPA colete dados de uso e gere recomendações.`,
        hints: [
          'O VPA precisa estar instalado antes do Goldilocks',
          'Adicione a label goldilocks.fairwinds.com/enabled=true ao namespace',
          'O Goldilocks dashboard roda na porta 8080 por padrão',
          'Para ter recomendações, o VPA precisa de dados históricos — aguarde alguns minutos'
        ],
        solution: `\`\`\`bash
# Instalar VPA (Vertical Pod Autoscaler)
helm repo add fairwinds-stable https://charts.fairwinds.com/stable
helm repo update

helm install vpa fairwinds-stable/vpa \\
  --namespace vpa \\
  --create-namespace

kubectl wait --for=condition=ready pod \\
  -l app.kubernetes.io/name=vpa -n vpa --timeout=120s

# Instalar Goldilocks
helm install goldilocks fairwinds-stable/goldilocks \\
  --namespace goldilocks \\
  --create-namespace

# Habilitar Goldilocks para o namespace backend
kubectl label namespace backend goldilocks.fairwinds.com/enabled=true

# Deploy de app de exemplo
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-api
  namespace: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: sample-api
  template:
    metadata:
      labels:
        app: sample-api
    spec:
      containers:
        - name: api
          image: nginx:latest
          resources:
            requests:
              cpu: 500m     # Propositalmente alto para testar right-sizing
              memory: 512Mi
            limits:
              cpu: "1"
              memory: 1Gi
EOF

# Aguardar VPA coletar métricas (pelo menos 2-3 minutos)
sleep 120

# Ver VPA criado pelo Goldilocks
kubectl get vpa -n backend

# Ver recomendações
kubectl describe vpa goldilocks-sample-api -n backend | grep -A10 "Recommendation"

# Acessar dashboard
kubectl port-forward -n goldilocks svc/goldilocks-dashboard 8080:80 &
echo "Dashboard: http://localhost:8080"
\`\`\``,
        verify: `\`\`\`bash
# Verificar VPA instalado
kubectl get pods -n vpa
# Saída esperada: vpa-admission-controller, vpa-recommender, vpa-updater

# Verificar Goldilocks habilitado no namespace
kubectl get namespace backend -o yaml | grep goldilocks
# Saída esperada: goldilocks.fairwinds.com/enabled: "true"

# Verificar VPA criado para sample-api
kubectl get vpa -n backend
# Saída esperada: goldilocks-sample-api  VerticalPodAutoscaler

# Verificar recomendações do VPA
kubectl get vpa goldilocks-sample-api -n backend -o json | \\
  jq '.status.recommendation.containerRecommendations[0]'
# Saída esperada: lowerBound, target, upperBound com valores de CPU e memória

# Verificar dashboard via API do Goldilocks
kubectl port-forward -n goldilocks svc/goldilocks-dashboard 8080:80 &>/dev/null &
sleep 3
curl -s http://localhost:8080/ | grep -c "sample-api" || echo "Dashboard respondendo"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod fica em Pending após criar ResourceQuota',
      difficulty: 'easy',
      symptom: 'Após criar uma ResourceQuota em um namespace, novos pods ficam em estado Pending com evento "exceeded quota". Mesmo com recursos disponíveis no cluster, os pods não são alocados.',
      diagnosis: `\`\`\`bash
# Ver eventos do pod
kubectl describe pod my-pod -n my-team | grep -A5 "Events:"

# Ver estado atual da quota
kubectl describe resourcequota -n my-team

# Ver se há requests definidos (necessário quando ResourceQuota limita CPU/mem)
kubectl get pod my-pod -n my-team -o yaml | \\
  grep -A10 "resources:"

# Verificar se LimitRange com defaults está presente
kubectl get limitrange -n my-team

# Calcular uso atual
kubectl get resourcequota my-quota -n my-team -o json | \\
  jq '{used: .status.used, hard: .status.hard}'
\`\`\``,
      solution: `**Causa 1**: ResourceQuota atingida — namespace consumiu todo o limite.
\`\`\`bash
# Ver o que está consumindo mais recursos
kubectl top pods -n my-team --sort-by=cpu

# Verificar pods inativos/completed consumindo quota
kubectl get pods -n my-team | grep -v Running

# Escalar down deployments não críticos
kubectl scale deployment --all --replicas=0 -n my-team

# Aumentar quota se justificado
kubectl edit resourcequota my-quota -n my-team
\`\`\`

**Causa 2**: Pod sem resource requests + ResourceQuota limita requests.
\`\`\`bash
# Quando ResourceQuota define requests.cpu, todos os pods PRECISAM ter requests
# Adicionar resources ao Deployment:
kubectl patch deployment my-app -n my-team --type merge \\
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","resources":{"requests":{"cpu":"100m","memory":"128Mi"}}}]}}}}'
\`\`\`

**Causa 3**: Criar LimitRange com defaultRequest resolve o problema:
\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: LimitRange
metadata:
  name: defaults
  namespace: my-team
spec:
  limits:
    - type: Container
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      default:
        cpu: 500m
        memory: 512Mi
EOF
# Pods novos sem resources receberão os defaults automaticamente
\`\`\``
    },
    {
      title: 'VPA e HPA causando instabilidade — pods reiniciando constantemente',
      difficulty: 'hard',
      symptom: 'Um Deployment com HPA e VPA "Auto" está com pods reiniciando continuamente. O HPA adiciona réplicas enquanto o VPA reinicia pods para ajustar requests. O serviço fica intermitente.',
      diagnosis: `\`\`\`bash
# Ver eventos recentes
kubectl get events -n production --sort-by=.lastTimestamp | tail -20

# Ver se há VPA e HPA no mesmo Deployment
kubectl get hpa,vpa -n production | grep my-app

# Ver histórico de restart
kubectl get pods -n production -l app=my-app | awk '{print \$1, \$4}'

# Ver recomendações do VPA vs requests atuais
kubectl describe vpa my-app-vpa -n production | grep -A15 "Recommendation"

# Ver policy do VPA
kubectl get vpa my-app-vpa -n production -o yaml | grep "updateMode"

# Ver scaling history do HPA
kubectl describe hpa my-app-hpa -n production | grep -A10 "Events:"
\`\`\``,
      solution: `**Solução: Mudar VPA para modo "Off" e usar recomendações manuais**:
\`\`\`bash
# Mudar VPA para modo Off (apenas recomendações)
kubectl patch vpa my-app-vpa -n production --type merge \\
  -p '{"spec":{"updatePolicy":{"updateMode":"Off"}}}'

# Verificar recomendações
kubectl describe vpa my-app-vpa -n production | \\
  grep -A5 "Container Recommendations"

# Aplicar recomendações manualmente no horário de manutenção
kubectl patch deployment my-app -n production --type merge \\
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","resources":{"requests":{"cpu":"250m","memory":"300Mi"},"limits":{"cpu":"500m","memory":"600Mi"}}}]}}}}'
\`\`\`

**Alternativa: Usar VPA com controlledResources**:
\`\`\`yaml
# VPA apenas para memória (HPA controla CPU)
spec:
  updatePolicy:
    updateMode: "Initial"  # apenas pods novos
  resourcePolicy:
    containerPolicies:
      - containerName: app
        controlledResources: ["memory"]  # não toca no CPU
\`\`\``
    }
  ]
};
