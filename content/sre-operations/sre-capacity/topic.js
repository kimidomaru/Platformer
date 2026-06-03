window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['sre-operations/sre-capacity'] = {
  theory: `
# Capacity Planning & Performance — Dimensionamento e Otimizacao

## Relevancia
Capacity planning e a arte de garantir recursos suficientes para o servico funcionar de forma confiavel, sem desperdicar dinheiro com over-provisioning. Em Kubernetes, isso envolve requests/limits, autoscaling, rightsizing e forecasting — habilidades essenciais para qualquer SRE.

## Conceitos Fundamentais

### Requests vs Limits

\`\`\`
Requests: recursos GARANTIDOS ao container
  - Usado pelo scheduler para decidir onde colocar o pod
  - Container sempre tera pelo menos isso

Limits: recursos MAXIMOS que o container pode usar
  - CPU: throttled (nao mata) se exceder
  - Memoria: OOMKilled se exceder

Regra pratica:
  requests = uso medio (p50)
  limits = uso pico (p99) + margem
\`\`\`

### QoS Classes

\`\`\`yaml
# Guaranteed: requests == limits (prioridade maxima)
resources:
  requests:
    cpu: 500m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 256Mi

# Burstable: requests < limits (prioridade media)
resources:
  requests:
    cpu: 250m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

# BestEffort: sem requests nem limits (primeiro a morrer)
# Nao recomendado para producao!
\`\`\`

| QoS Class | Eviction Priority | Quando usar |
|-----------|-------------------|-------------|
| **Guaranteed** | Ultimo a ser evicted | Servicos criticos (DB, API principal) |
| **Burstable** | Segundo | Servicos com carga variavel |
| **BestEffort** | Primeiro | Apenas dev/test, nunca producao |

### LimitRange e ResourceQuota

\`\`\`yaml
# LimitRange: limites padrao por container no namespace
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: production
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 256Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      max:
        cpu: "2"
        memory: 1Gi
      min:
        cpu: 50m
        memory: 64Mi
---
# ResourceQuota: limites totais do namespace
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
  namespace: production
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    limits.cpu: "40"
    limits.memory: 80Gi
    pods: "100"
    persistentvolumeclaims: "20"
\`\`\`

### VPA — Vertical Pod Autoscaler

VPA ajusta requests/limits automaticamente baseado no uso real.

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
    name: api-server
  updatePolicy:
    updateMode: "Off"  # Off = apenas recomenda, nao aplica
  resourcePolicy:
    containerPolicies:
      - containerName: api
        minAllowed:
          cpu: 50m
          memory: 64Mi
        maxAllowed:
          cpu: "2"
          memory: 2Gi
\`\`\`

**Modos do VPA:**

| Modo | Acao |
|------|------|
| **Off** | Apenas gera recomendacoes (seguro para producao) |
| **Initial** | Aplica ao criar pods, nao atualiza existentes |
| **Auto** | Aplica e reinicia pods para ajustar (cuidado em prod!) |

### HPA — Horizontal Pod Autoscaler

\`\`\`yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 30
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "100"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 120
\`\`\`

### Cluster Autoscaler

\`\`\`
Pod pending (sem node com recursos)
  → Cluster Autoscaler adiciona node
  → Pod e agendado no novo node

Node subutilizado (< 50% uso)
  → Cluster Autoscaler remove node
  → Pods sao re-agendados em outros nodes
\`\`\`

### Load Testing

\`\`\`bash
# k6 — load test basico
k6 run --vus 50 --duration 5m script.js

# hey — HTTP load generator
hey -n 10000 -c 100 -z 5m http://api.example.com/endpoint

# Dentro do cluster
kubectl run load-test --image=williamyeh/hey --rm -it -- \\
  -n 10000 -c 50 http://api-server.production.svc.cluster.local/api
\`\`\`

### Rightsizing Workflow

\`\`\`
1. Coletar metricas de uso real (7-30 dias)
2. Analisar p50 (medio) e p99 (pico)
3. Definir requests = p50 + 20% margem
4. Definir limits = p99 + 30% margem
5. Aplicar e monitorar por 7 dias
6. Ajustar se necessario
7. Repetir trimestralmente
\`\`\`

**Goldilocks (ferramenta de rightsizing):**
\`\`\`bash
# Instalar Goldilocks
helm install goldilocks fairwinds-stable/goldilocks --namespace goldilocks --create-namespace

# Habilitar para namespace
kubectl label namespace production goldilocks.fairwinds.com/enabled=true

# Acessar dashboard
kubectl port-forward svc/goldilocks-dashboard -n goldilocks 8080:80
\`\`\`

### Capacity Forecasting

\`\`\`
Tecnicas:
  Linear regression:  projetar crescimento baseado em tendencia
  Seasonal patterns:  ajustar para picos conhecidos (Black Friday, etc.)
  Buffer planning:    manter 30-40% headroom para picos

PromQL para forecasting:
  # Projetar uso de disco em 7 dias
  predict_linear(node_filesystem_free_bytes[7d], 7*24*3600)

  # Projetar uso de CPU em 30 dias
  predict_linear(node_cpu_seconds_total[30d], 30*24*3600)
\`\`\`

### Cost Optimization

\`\`\`
Estrategias:
  1. Rightsizing: ajustar requests/limits ao uso real
  2. Spot/Preemptible nodes: workloads tolerantes a interrupcao
  3. Node pools: separar por tipo de workload
  4. Bin-packing: maximizar utilizacao de nodes
  5. Namespace quotas: limitar consumo por time
  6. Idle resources: identificar e remover
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Recursos do cluster
kubectl top nodes
kubectl describe nodes | grep -A5 "Allocated resources"

# Recursos dos pods
kubectl top pods -n production --sort-by=cpu
kubectl top pods -n production --sort-by=memory

# Verificar requests/limits
kubectl get pods -n production -o jsonpath='{range .items[*]}{.metadata.name}: cpu={.spec.containers[0].resources.requests.cpu}, mem={.spec.containers[0].resources.requests.memory}{"\\n"}{end}'

# Verificar quotas
kubectl get resourcequota -n production
kubectl describe resourcequota production-quota -n production

# Verificar LimitRange
kubectl get limitrange -n production
kubectl describe limitrange default-limits -n production

# VPA recomendacoes
kubectl get vpa -n production
kubectl describe vpa api-vpa -n production

# HPA status
kubectl get hpa -n production
kubectl describe hpa api-hpa -n production
\`\`\`

## Erros Comuns

1. **Sem requests/limits**: Pods sem requests podem ser agendados em nodes saturados. Sem limits, podem consumir todos os recursos do node.
2. **Requests muito altos**: Over-provisioning desperdiça dinheiro. Use dados reais para dimensionar.
3. **Limits muito baixos**: Causa OOMKilled e throttling excessivo. Monitore e ajuste.
4. **HPA + VPA juntos**: VPA Auto + HPA na mesma metrica (CPU) conflitam. Use VPA Off + HPA, ou VPA em memoria + HPA em CPU.
5. **Sem headroom**: Cluster sem espaco para picos causa pod pending. Mantenha 30-40% headroom.
6. **Nao testar carga**: Sem load testing, voce nao sabe o limite do servico ate que ele quebre em producao.

## Killer.sh Style Challenge

**Cenario:** Dimensione e otimize recursos para um servico de producao em Kubernetes.

**Tarefas:**
1. Configure LimitRange e ResourceQuota para o namespace
2. Configure VPA em modo Off para obter recomendacoes
3. Configure HPA com custom metrics
4. Execute load test e ajuste recursos baseado nos resultados
5. Configure alertas de capacidade (disco, memoria, CPU)
`,
  quiz: [
    {
      question: 'Qual a diferenca entre requests e limits em Kubernetes?',
      options: [
        'Sao a mesma coisa — apenas nomes diferentes',
        'Requests sao recursos garantidos (usados pelo scheduler); limits sao o maximo que o container pode usar',
        'Requests sao para CPU, limits sao para memoria',
        'Requests sao opcionais, limits sao obrigatorios'
      ],
      correct: 1,
      explanation: 'Requests sao recursos garantidos — o scheduler usa para decidir em qual node colocar o pod. Limits sao o maximo: CPU e throttled (reduz velocidade) e memoria causa OOMKilled se exceder o limit. Regra pratica: requests = uso medio (p50), limits = pico (p99) + margem.',
      reference: 'Conceito relacionado: sre-capacity — QoS class e determinado pela relacao entre requests e limits.'
    },
    {
      question: 'Qual QoS class tem prioridade maxima e e ultimo a ser evicted?',
      options: [
        'BestEffort',
        'Burstable',
        'Guaranteed — quando requests == limits para todos os containers',
        'Premium'
      ],
      correct: 2,
      explanation: 'Guaranteed QoS e atribuido quando requests == limits para CPU e memoria em todos os containers do pod. E o ultimo a ser evicted em situacoes de pressao de recursos. Burstable (requests < limits) e segundo, BestEffort (sem requests/limits) e primeiro a ser evicted.',
      reference: 'Conceito relacionado: sre-capacity — use Guaranteed para servicos criticos como databases.'
    },
    {
      question: 'O que acontece quando um container excede o CPU limit?',
      options: [
        'O pod e reiniciado (OOMKilled)',
        'O container e throttled — sua velocidade de processamento e reduzida, mas nao e morto',
        'O node e reiniciado',
        'Nada acontece'
      ],
      correct: 1,
      explanation: 'CPU limit causa throttling: o container tem seu tempo de CPU limitado, resultando em processamento mais lento. Diferente de memoria, onde exceder o limit causa OOMKilled (o container e morto). Por isso, muitos times removem CPU limits e mantem apenas requests.',
      reference: 'Conceito relacionado: sre-capacity — CPU throttling pode causar latencia inesperada.'
    },
    {
      question: 'Qual modo do VPA e seguro para usar em producao inicialmente?',
      options: [
        'Auto — aplica e reinicia pods automaticamente',
        'Initial — aplica apenas ao criar pods novos',
        'Off — apenas gera recomendacoes sem alterar nada, permitindo analise antes de aplicar',
        'Recreate — recria todos os pods'
      ],
      correct: 2,
      explanation: 'VPA em modo Off apenas gera recomendacoes baseadas no uso real, sem alterar nada. E o modo mais seguro para comecar em producao — analise as recomendacoes, compare com valores atuais, e aplique manualmente. Auto mode reinicia pods para aplicar mudancas, o que pode causar disrupcao.',
      reference: 'Conceito relacionado: sre-toil-automation — VPA Off + aplicacao manual e semi-automacao.'
    },
    {
      question: 'Por que HPA e VPA (modo Auto) na mesma metrica (CPU) conflitam?',
      options: [
        'Nao conflitam — podem ser usados juntos',
        'Porque o VPA altera requests de CPU, o que muda o calculo de utilizacao do HPA, criando um loop de feedback instavel',
        'Porque o Kubernetes nao permite criar ambos no mesmo namespace',
        'Porque o HPA desativa o VPA automaticamente'
      ],
      correct: 1,
      explanation: 'Se VPA aumenta o CPU request de 100m para 200m, o HPA calcula a utilizacao como menor (mesmo uso / request maior = % menor) e pode escalar para baixo. Isso cria um loop instavel. Solucao: use VPA Off + HPA, ou VPA em memoria + HPA em CPU.',
      reference: 'Conceito relacionado: sre-capacity — combine HPA e VPA com cuidado usando metricas diferentes.'
    },
    {
      question: 'Para que serve o ResourceQuota?',
      options: [
        'Define limites padrao por container',
        'Define limites totais de recursos que um namespace inteiro pode consumir, prevenindo que um time monopolize o cluster',
        'Define limites de CPU por node',
        'Define o numero maximo de clusters'
      ],
      correct: 1,
      explanation: 'ResourceQuota define limites agregados para o namespace: total de CPU requests/limits, memoria, numero de pods, PVCs, etc. Previne que um namespace/time consuma todos os recursos do cluster. LimitRange define limites por container (padrao, min, max). Ambos sao complementares.',
      reference: 'Conceito relacionado: sre-capacity — LimitRange define por container, ResourceQuota define por namespace.'
    },
    {
      question: 'Qual a funcao do predict_linear no PromQL para capacity planning?',
      options: [
        'Calcula a media de uma metrica',
        'Projeta o valor futuro de uma metrica baseado na tendencia linear atual, permitindo prever quando um recurso sera esgotado',
        'Cria alertas automaticamente',
        'Compara metricas entre clusters'
      ],
      correct: 1,
      explanation: 'predict_linear(metric[range], seconds) extrapola a tendencia linear da metrica e projeta o valor futuro. Exemplo: predict_linear(node_filesystem_free_bytes[7d], 30*24*3600) projeta o espaco em disco em 30 dias. Essencial para alertar sobre esgotamento de recursos antes que aconteca.',
      reference: 'Conceito relacionado: sre-observability — use predict_linear em alertas proativos de capacidade.'
    }
  ],
  flashcards: [
    {
      front: 'Requests vs Limits em Kubernetes?',
      back: '**Requests (garantido):**\n- Scheduler usa para posicionar pod\n- Container sempre tera esses recursos\n- Dimensionar: p50 (uso medio) + 20%\n\n**Limits (maximo):**\n- CPU: throttled se exceder (nao mata)\n- Memoria: OOMKilled se exceder\n- Dimensionar: p99 (pico) + 30%\n\n**QoS Classes:**\n- Guaranteed: requests == limits\n- Burstable: requests < limits\n- BestEffort: sem requests/limits\n\n**Regra:** sempre defina requests.\nLimits de CPU sao opcionais\n(muitos times removem CPU limits).'
    },
    {
      front: 'LimitRange vs ResourceQuota?',
      back: '**LimitRange (por container):**\n```yaml\nspec:\n  limits:\n    - type: Container\n      default:\n        cpu: 500m\n        memory: 256Mi\n      defaultRequest:\n        cpu: 100m\n      max:\n        cpu: \"2\"\n      min:\n        cpu: 50m\n```\nDefine padrao, min e max\n\n**ResourceQuota (por namespace):**\n```yaml\nspec:\n  hard:\n    requests.cpu: \"20\"\n    requests.memory: 40Gi\n    pods: \"100\"\n```\nLimita total do namespace\n\n**Complementares:**\nLimitRange = por container\nResourceQuota = total do namespace'
    },
    {
      front: 'VPA — modos e quando usar?',
      back: '**Off (recomendado inicialmente):**\n- Apenas gera recomendacoes\n- Nao altera nada\n- Seguro para producao\n\n**Initial:**\n- Aplica ao criar novos pods\n- Nao atualiza pods existentes\n- Moderadamente seguro\n\n**Auto:**\n- Aplica e REINICIA pods\n- Pode causar disrupcao\n- Cuidado em producao\n\n**Conflito HPA+VPA:**\n- VPA Auto + HPA na mesma metrica\n  = loop instavel\n- Solucao: VPA Off + HPA\n  ou VPA (mem) + HPA (cpu)\n\n**Recomendacao:**\nComece com Off, analise,\naprove manualmente'
    },
    {
      front: 'HPA behavior policies?',
      back: '**ScaleUp (rapido):**\n```yaml\nbehavior:\n  scaleUp:\n    stabilizationWindowSeconds: 30\n    policies:\n      - type: Percent\n        value: 100  # dobra de uma vez\n        periodSeconds: 60\n```\n\n**ScaleDown (lento):**\n```yaml\n  scaleDown:\n    stabilizationWindowSeconds: 300\n    policies:\n      - type: Percent\n        value: 10  # max -10% por vez\n        periodSeconds: 120\n```\n\n**Metricas:**\n- Resource: CPU, memoria\n- Pods: custom metrics por pod\n- Object: metricas de outro objeto\n- External: metricas externas'
    },
    {
      front: 'Rightsizing workflow?',
      back: '**Passos:**\n1. Coletar metricas (7-30 dias)\n2. Analisar p50 e p99\n3. requests = p50 + 20% margem\n4. limits = p99 + 30% margem\n5. Aplicar e monitorar 7 dias\n6. Ajustar se necessario\n7. Repetir trimestralmente\n\n**Ferramentas:**\n- VPA (modo Off) para recomendacoes\n- Goldilocks para dashboard visual\n- kubectl top para uso atual\n\n**PromQL para analise:**\n```\n# Uso medio de CPU (p50)\nquantile(0.5,\n  rate(container_cpu_usage[24h]))\n\n# Pico de memoria (p99)\nquantile(0.99,\n  container_memory_working_set_bytes)\n```'
    },
    {
      front: 'Capacity forecasting com PromQL?',
      back: '**predict_linear:**\nProjecta valor futuro baseado\nem tendencia linear\n\n**Disco cheio em 30 dias?**\n```promql\npredict_linear(\n  node_filesystem_free_bytes[7d],\n  30*24*3600\n) < 0\n```\n\n**Alerta proativo:**\n```yaml\n- alert: DiskWillFillIn30Days\n  expr: |\n    predict_linear(\n      node_filesystem_free_bytes[7d],\n      30*24*3600\n    ) < 0\n  for: 1h\n  labels:\n    severity: warning\n```\n\n**Headroom:**\nManter 30-40% de espaco livre\npara absorver picos e crescimento'
    },
    {
      front: 'Cost optimization em K8s?',
      back: '**1. Rightsizing:**\nAjustar requests/limits ao uso real\n→ Eliminar over-provisioning\n\n**2. Spot/Preemptible nodes:**\nWorkloads tolerantes a interrupcao\n→ 60-80% mais barato\n\n**3. Node pools:**\nSeparar por tipo de workload\n→ CPU-intensive vs memory-intensive\n\n**4. Bin-packing:**\nMaximizar utilizacao de nodes\n→ Reduzir nodes ociosos\n\n**5. Namespace quotas:**\nLimitar consumo por time\n→ Accountability\n\n**6. Idle resources:**\n- Deployments com 0 replicas\n- PVCs nao usados\n- Namespaces de dev inativos'
    }
  ],
  lab: {
    scenario: 'Voce precisa dimensionar corretamente os recursos de um servico em producao e configurar autoscaling para garantir capacidade adequada.',
    objective: 'Configurar LimitRange, ResourceQuota, VPA e HPA para um servico de producao.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Configurar Governance de Recursos',
        instruction: `Configure LimitRange e ResourceQuota para o namespace production.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: LimitRange
metadata:
  name: production-limits
  namespace: production
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 256Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      max:
        cpu: "2"
        memory: 2Gi
      min:
        cpu: 50m
        memory: 64Mi
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
  namespace: production
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    limits.cpu: "40"
    limits.memory: 80Gi
    pods: "100"
    persistentvolumeclaims: "20"
EOF
\`\`\``,
        hints: [
          'LimitRange define valores padrao — pods sem requests/limits recebem esses valores',
          'ResourceQuota limita o total do namespace — previne monopolio de recursos',
          'min e max do LimitRange rejeitam pods fora desses limites'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: LimitRange
metadata:
  name: production-limits
  namespace: production
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 256Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
  namespace: production
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    pods: "100"
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get limitrange production-limits -n production
# Saida esperada: NAME                CREATED AT
#                  production-limits   ...

kubectl describe resourcequota production-quota -n production
# Saida esperada: Used vs Hard para cada recurso
\`\`\``
      },
      {
        title: 'Configurar VPA para Recomendacoes',
        instruction: `Configure o VPA em modo Off para obter recomendacoes de rightsizing.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-vpa
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  updatePolicy:
    updateMode: "Off"
  resourcePolicy:
    containerPolicies:
      - containerName: api
        minAllowed:
          cpu: 50m
          memory: 64Mi
        maxAllowed:
          cpu: "2"
          memory: 2Gi
        controlledResources: ["cpu", "memory"]
EOF
\`\`\``,
        hints: [
          'Modo Off e seguro — apenas recomenda, nunca altera pods',
          'Apos instalar, aguarde 24h para recomendacoes precisas',
          'VPA precisa do VPA controller instalado no cluster'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-vpa
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  updatePolicy:
    updateMode: "Off"
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get vpa api-vpa -n production
# Saida esperada: NAME      MODE   CPU   MEM   PROVIDED   AGE
#                  api-vpa   Off    ...   ...   True       Xs

# Ver recomendacoes (pode demorar alguns minutos)
kubectl describe vpa api-vpa -n production | grep -A10 "Recommendation"
# Saida esperada: Target, LowerBound, UpperBound para CPU e Memory
\`\`\``
      },
      {
        title: 'Configurar Alertas de Capacidade',
        instruction: `Crie alertas proativos de capacidade usando predict_linear.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: capacity-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: capacity.rules
      rules:
        # Disco vai encher em 7 dias
        - alert: DiskWillFillIn7Days
          expr: |
            predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[7d], 7*24*3600) < 0
          for: 1h
          labels:
            severity: warning
          annotations:
            summary: "Disk on {{ \$labels.instance }} will fill in 7 days"
            runbook_url: "https://wiki/runbooks/disk-capacity"

        # Namespace usando > 80% da quota de CPU
        - alert: NamespaceQuotaNearLimit
          expr: |
            kube_resourcequota{type="used"} / kube_resourcequota{type="hard"} > 0.8
          for: 15m
          labels:
            severity: warning
          annotations:
            summary: "Namespace {{ \$labels.namespace }} using > 80% of {{ \$labels.resource }} quota"

        # Cluster com poucos recursos disponiveis
        - alert: ClusterCPUHighUtilization
          expr: |
            1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) > 0.85
          for: 15m
          labels:
            severity: warning
          annotations:
            summary: "Cluster CPU utilization above 85%"
EOF
\`\`\``,
        hints: [
          'predict_linear projeta tendencia futura baseado em dados historicos',
          'Alertas proativos permitem agir ANTES de ficar sem recursos',
          'Combine com alertas de ResourceQuota para governanca de namespace'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: capacity-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: capacity.rules
      rules:
        - alert: DiskWillFillIn7Days
          expr: predict_linear(node_filesystem_avail_bytes[7d], 7*24*3600) < 0
          for: 1h
          labels:
            severity: warning
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get prometheusrule capacity-alerts -n monitoring
# Saida esperada: NAME               AGE
#                  capacity-alerts    Xs

kubectl get prometheusrule capacity-alerts -n monitoring -o jsonpath='{.spec.groups[0].rules[*].alert}'
# Saida esperada: DiskWillFillIn7Days NamespaceQuotaNearLimit ClusterCPUHighUtilization
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pods em OOMKilled constante',
      difficulty: 'medium',
      symptom: 'Pods estao sendo reiniciados com status OOMKilled. O servico fica instavel com CrashLoopBackOff.',
      diagnosis: `\`\`\`bash
# Verificar status do pod
kubectl describe pod <pod> -n production | grep -A5 "Last State"

# Verificar limites atuais
kubectl get pod <pod> -n production -o jsonpath='{.spec.containers[0].resources}'

# Verificar uso real de memoria
kubectl top pod <pod> -n production

# Verificar VPA recomendacao
kubectl describe vpa api-vpa -n production | grep -A5 "Target"
\`\`\``,
      solution: `**Solucoes:**

1. **Aumentar memory limit:**
\`\`\`bash
kubectl set resources deployment/<name> -n production --limits=memory=512Mi
\`\`\`

2. **Usar VPA para encontrar valor correto:**
\`\`\`bash
kubectl describe vpa api-vpa -n production
# Use o "Target" como novo request e "Upper Bound" como limit
\`\`\`

3. **Investigar memory leak:** Se o uso cresce continuamente, pode haver leak na aplicacao. Use profiling.

4. **Definir requests adequados:** requests devem ser p50 do uso real, limits p99 + margem.`
    },
    {
      title: 'Pods Pending — sem recursos no cluster',
      difficulty: 'easy',
      symptom: 'Novos pods ficam em estado Pending com evento "Insufficient cpu" ou "Insufficient memory". O cluster nao tem capacidade.',
      diagnosis: `\`\`\`bash
# Verificar eventos do pod
kubectl describe pod <pod> -n production | grep -A5 Events

# Verificar recursos disponiveis nos nodes
kubectl describe nodes | grep -A5 "Allocated resources"

# Verificar utilizacao do cluster
kubectl top nodes
\`\`\``,
      solution: `**Solucoes:**

1. **Adicionar nodes:** Se nao ha Cluster Autoscaler, adicione nodes manualmente.

2. **Cluster Autoscaler:** Configure para escalar automaticamente:
\`\`\`bash
# Cluster Autoscaler adiciona nodes quando ha pods Pending
\`\`\`

3. **Rightsizing:** Se nodes tem recursos alocados mas pouco usados, os requests estao muito altos. Use VPA para ajustar.

4. **Evict pods BestEffort:** Pods sem requests/limits podem ser evicted para liberar espaco:
\`\`\`bash
kubectl get pods -A -o json | jq '.items[] | select(.status.qosClass=="BestEffort") | .metadata.name'
\`\`\`

5. **ResourceQuota:** Se o namespace esta no limite da quota, aumente ou redistribua.`
    },
    {
      title: 'Over-provisioning — cluster com baixa utilizacao mas custo alto',
      difficulty: 'hard',
      symptom: 'O cluster tem utilizacao media de apenas 20-30% mas os custos sao altos. Muitos nodes estao subutilizados.',
      diagnosis: `\`\`\`bash
# Verificar utilizacao real vs alocado
kubectl top nodes
kubectl describe nodes | grep -E "cpu|memory" | head -20

# Verificar requests vs uso real
kubectl top pods -A --sort-by=cpu | head -20

# Calcular eficiencia
# (uso real / requests) * 100 = eficiencia %
\`\`\``,
      solution: `**Estrategia de otimizacao:**

1. **VPA para rightsizing:** Use VPA em modo Off para obter recomendacoes e ajustar requests:
\`\`\`bash
kubectl get vpa -A -o yaml | grep -A3 "target"
\`\`\`

2. **Goldilocks:** Instale para visualizar recomendacoes em dashboard.

3. **Cluster Autoscaler:** Configure para remover nodes subutilizados:
   - scale-down-utilization-threshold: 0.5
   - scale-down-delay-after-add: 10m

4. **Spot nodes para workloads tolerantes:** Use spot/preemptible nodes para batch jobs, CronJobs e dev/staging.

5. **Review trimestral:** Agende revisao de rightsizing a cada 3 meses.`
    }
  ]
};
