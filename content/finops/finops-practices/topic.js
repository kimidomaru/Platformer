window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['finops/finops-practices'] = {
  theory: `# FinOps Practices & Chargeback em Kubernetes

## Relevância no Exame
> FinOps para Kubernetes cobre modelos de alocação de custos, chargeback/showback por time, detecção de desperdício e estratégias de otimização como Spot/Preemptible nodes.

## Conceitos Fundamentais

### O que é FinOps?
FinOps (Financial Operations) é uma prática cultural que une Engenharia, Finanças e Negócios para gerenciar custos de cloud de forma eficiente. No contexto Kubernetes:

\`\`\`
┌──────────────────────────────────────────────────────┐
│                  FinOps Framework                     │
│                                                       │
│  INFORM          OPTIMIZE          OPERATE            │
│  ┌──────────┐   ┌──────────────┐  ┌──────────────┐  │
│  │Visibilidade│  │ Right-sizing │  │Cost Allocation│ │
│  │Custo por  │  │ Spot nodes   │  │Chargeback por │ │
│  │namespace/ │  │ Idle cleanup │  │time/projeto   │ │
│  │team/label │  │ Commitments  │  │Budget alerts  │ │
│  └──────────┘   └──────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────┘
\`\`\`

### Showback vs Chargeback

| Conceito | Definição | Quando usar |
|----------|-----------|-------------|
| **Showback** | Mostra quanto cada time CUSTARIA — informativo | Early stage, cultura de custo incipiente |
| **Chargeback** | Cobra efetivamente o time pelo uso — financeiro | Orgs maduras com múltiplos business units |
| **Budget Alerts** | Notifica quando custo ultrapassa threshold | Todos os estágios |

### Modelo de Alocação de Custos no Kubernetes

**Labels como centro de custo**:
\`\`\`yaml
# Labels recomendadas para alocação
metadata:
  labels:
    team: "payments"         # time responsável
    environment: "production" # ambiente
    cost-center: "CC-123"    # centro de custo ERP
    project: "payment-v2"    # projeto/iniciativa
    owner: "alice@company.com"
\`\`\`

**Estratégia de alocação**:
1. **Label everything**: todos os workloads devem ter labels de time/projeto
2. **Namespace per team**: separe ambientes por namespace (facilita quota + billing)
3. **Node pools por workload type**: spot pool, on-demand pool, GPU pool
4. **Shared services**: ferramentas compartilhadas (monitoring, ingress) → custos divididos

### Tipos de Desperdício no Kubernetes

**1. Request over-provisioning** (mais comum):
\`\`\`
Pod requests 1 CPU, usa 100m → 900m desperdiçados
Custo: você paga por 1 CPU no node, mas usa 10%
\`\`\`

**2. Idle workloads**:
\`\`\`
Deployments com 0 requests/s (feature desativada)
Jobs que nunca mais rodam
Persistent Volumes sem pod consumindo
\`\`\`

**3. Namespaces abandonados**:
\`\`\`
Ambientes de PR/dev que não foram limpos
Namespaces com ownership desconhecida
\`\`\`

**4. Node underutilization**:
\`\`\`
Nodes com 20% de CPU usada
Nodes mantidos para poucos pods que cabem em outros nodes
\`\`\`

### Spot/Preemptible Nodes — Economia de 70-90%

\`\`\`yaml
# Node pool spot no EKS
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
nodeGroups:
  - name: spot-workers
    instancesDistribution:
      instanceTypes: ["m5.xlarge", "m5a.xlarge", "m4.xlarge"]
      onDemandBaseCapacity: 0
      onDemandPercentageAboveBaseCapacity: 0
      spotAllocationStrategy: lowest-price
    labels:
      node-type: spot
    taints:
      - key: spot
        value: "true"
        effect: NoSchedule

---
# Pod tolerando spot nodes
spec:
  tolerations:
    - key: spot
      operator: Equal
      value: "true"
      effect: NoSchedule
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          preference:
            matchExpressions:
              - key: node-type
                operator: In
                values: ["spot"]
\`\`\`

### Cluster Autoscaler vs Karpenter

| Feature | Cluster Autoscaler | Karpenter |
|---------|-------------------|-----------|
| Provider | Multi-cloud | AWS nativo (em expansão) |
| Velocidade | 1-2 min para novo node | 30-60s para novo node |
| Granularidade | Node groups pré-definidos | Any instance type dinamicamente |
| Spot support | Via node groups | Nativo, flexível |
| Consolidation | Sim (scale-down) | Consolidation proativa |
| Cost awareness | Básico | Avançado (escolhe instance type mais barato) |

### FOCUS Standard — Fatura Normalizada de Cloud
O FOCUS (FinOps Open Cost and Usage Specification) é um padrão aberto para normalizar dados de custo entre clouds:

\`\`\`
Colunas principais do FOCUS:
- BilledCost: custo cobrado
- EffectiveCost: custo com desconto/commitment aplicado
- ResourceId: identificador do recurso
- ResourceType: tipo (EC2, GKE Node Pool, etc.)
- Tags: labels/tags do recurso
- UsagePeriod: período de uso
\`\`\`

### Commitment-Based Discounts (Reserved/Savings Plans)

\`\`\`
Reserved Instances (AWS):
  - 1 ano: ~30-40% desconto vs on-demand
  - 3 anos: ~50-60% desconto
  - Uso: workloads baseline estáveis (control plane, databases)

Savings Plans (AWS):
  - Mais flexível que RI
  - Aplica a qualquer tipo de EC2 ou Fargate
  - Baseado em $/hora comprometida

Committed Use Discounts (GCP):
  - 1 ano: ~20-25% desconto
  - 3 anos: ~40-55% desconto

Regra: Commitments apenas para workloads estáveis (> 70% utilização)
\`\`\`

### Políticas de Cost Governance

\`\`\`yaml
# OPA/Gatekeeper policy: label obrigatória
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: require-cost-labels
spec:
  match:
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment", "StatefulSet"]
    namespaces: ["production", "staging"]
  parameters:
    labels:
      - key: team
        allowedRegex: "^[a-z-]+\$"
      - key: cost-center
        allowedRegex: "^CC-[0-9]+\$"
\`\`\`

## Comandos Essenciais

### Identificar Desperdício
\`\`\`bash
# Namespaces com maior consumo de CPU
kubectl top pods --all-namespaces --sort-by=cpu | head -20

# Pods com requests muito acima do uso real
# (requer Metrics Server)
kubectl get pods --all-namespaces -o json | \\
  jq '.items[] | select(
    .spec.containers[0].resources.requests.cpu != null
  ) | {
    ns: .metadata.namespace,
    name: .metadata.name,
    cpu_request: .spec.containers[0].resources.requests.cpu
  }' | head -20

# PVCs não montados em nenhum pod (possível desperdício de storage)
kubectl get pvc --all-namespaces -o json | \\
  jq '.items[] | select(.status.phase=="Bound") | {
    ns: .metadata.namespace,
    name: .metadata.name,
    size: .spec.resources.requests.storage
  }'

# Identificar deployments com 0 réplicas (ociosos)
kubectl get deployments --all-namespaces -o json | \\
  jq '.items[] | select(.spec.replicas == 0) | {
    ns: .metadata.namespace,
    name: .metadata.name
  }'

# Nodes com baixa utilização (< 30% CPU)
kubectl top nodes | awk 'NR>1 {
  gsub(/%/,"");
  if ($3 < 30) print $1, "CPU:", $3"%"
}'
\`\`\`

### Análise de Labels para Billing
\`\`\`bash
# Listar todos os deployments sem label "team"
kubectl get deployments --all-namespaces -o json | \\
  jq '.items[] | select(
    .metadata.labels.team == null
  ) | {ns: .metadata.namespace, name: .metadata.name}'

# Agregar requests por label "team"
kubectl get pods --all-namespaces -o json | \\
  jq '[.items[] | {
    team: (.metadata.labels.team // "unknown"),
    cpu: (.spec.containers[0].resources.requests.cpu // "0")
  }] | group_by(.team) | .[] | {
    team: .[0].team,
    pod_count: length
  }'
\`\`\`

## Exemplos YAML

### Namespace com Labels de Billing Completas
\`\`\`yaml
apiVersion: v1
kind: Namespace
metadata:
  name: payments-production
  labels:
    team: payments
    environment: production
    cost-center: CC-001
    business-unit: financial-services
  annotations:
    contacts/owner: "payments-lead@company.com"
    contacts/oncall: "payments-oncall@company.com"
    billing/cost-center: "CC-001"
    billing/project: "payment-platform-v3"
\`\`\`

### Karpenter NodePool com Spot
\`\`\`yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: spot-workers
spec:
  template:
    metadata:
      labels:
        billing/node-type: spot
    spec:
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot"]
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64"]
        - key: karpenter.k8s.aws/instance-category
          operator: In
          values: ["m", "c", "r"]
        - key: karpenter.k8s.aws/instance-generation
          operator: Gt
          values: ["4"]
      nodeClassRef:
        name: default
  limits:
    cpu: 1000
    memory: 4000Gi
  disruption:
    consolidationPolicy: WhenUnderutilized
    consolidateAfter: 30s
    expireAfter: 720h  # Rotate nodes a cada 30 dias
\`\`\`

### Prometheus Rules para Alertas de Custo
\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: cost-governance-alerts
  namespace: monitoring
spec:
  groups:
    - name: cost-governance
      rules:
        # Alerta quando namespace > 80% da CPU quota
        - alert: NamespaceHighCPUUsage
          expr: |
            (
              kube_resourcequota{type="used", resource="requests.cpu"}
              /
              kube_resourcequota{type="hard", resource="requests.cpu"}
            ) > 0.8
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "Namespace {{ \$labels.namespace }} at {{ \$value | humanizePercentage }} of CPU quota"

        # Pods BestEffort em namespaces de produção
        - alert: BestEffortPodsInProduction
          expr: |
            kube_pod_info{namespace=~"production|staging"}
            * on (pod, namespace)
            kube_pod_status_qos_class{qos_class="besteffort"} > 0
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "BestEffort pods detected in {{ \$labels.namespace }}"

        # Deployments sem labels obrigatórias
        - alert: DeploymentMissingCostLabels
          expr: |
            kube_deployment_labels{label_team=""} > 0
            OR
            absent(kube_deployment_labels{label_team!=""})
          for: 1h
          labels:
            severity: info
          annotations:
            summary: "Deployment {{ \$labels.deployment }} missing team label"
\`\`\`

### Relatório de Chargeback (Script)
\`\`\`bash
#!/bin/bash
# Relatório de uso por time (simplificado)
# Em produção: use Kubecost API ou FOCUS export

echo "=== Kubernetes Cost Report — $(date +%Y-%m) ==="
echo ""
echo "CPU Requests por Time:"
kubectl get pods --all-namespaces -o json | \\
  jq -r '.items[] |
    (.metadata.labels.team // "UNKNOWN") + "," +
    (.spec.containers[0].resources.requests.cpu // "0m")
  ' | sort | uniq -c | \\
  awk -F',' '{print \$2, "team:", \$3, "pods:", \$1}'

echo ""
echo "PVCs por Namespace:"
kubectl get pvc --all-namespaces -o json | \\
  jq -r '.items[] |
    .metadata.namespace + "," +
    .spec.resources.requests.storage
  ' | sort | uniq -c
\`\`\`

## Erros Comuns

### 1. Usar apenas namespace para billing sem labels de projeto
**Causa**: Um namespace pode ter múltiplos projetos/times.
**Solução**: Combinar namespace + labels (team, project, cost-center) para granularidade.

### 2. Commitments para workloads variáveis
**Causa**: Comprar Reserved Instances para cargas batch que rodam apenas de dia.
**Impacto**: Pagar por capacidade não usada à noite.
**Solução**: Commitments apenas para baseline stável (> 70% utilização).

### 3. Não limpar ambientes de desenvolvimento
**Causa**: Namespaces de branch/PR não são deletados após merge.
**Impacto**: Dezenas de ambientes ociosos consumindo recursos.
**Solução**: TTL em namespaces de desenvolvimento ou limpeza automática via CI/CD.

### 4. Spot nodes para workloads stateful
**Causa**: Usar spot para bancos de dados ou stateful services.
**Impacto**: Interrupções frequentes causam perda de dados ou indisponibilidade.
**Solução**: Spot apenas para workloads stateless; databases em on-demand/committed.

### 5. Ignorar custos de rede
**Causa**: Focar apenas em compute e esquecer egress costs.
**Impacto**: Em clusters multi-region, egress pode ser 20-30% do custo total.
**Solução**: Configurar topology-aware routing; usar compressão; auditar external traffic.

## Killer.sh Style Challenge

**Contexto**: A empresa quer implementar showback mensal para os 4 times do cluster. Você deve:
1. Criar uma política OPA que exija as labels \`team\` e \`cost-center\` em todos os Deployments de produção
2. Identificar os 3 principais namespaces sem label \`team\` nos Deployments
3. Calcular o total de CPU requests por label \`team\` no namespace production
4. Criar um PrometheusRule que alerte quando o namespace \`payments\` ultrapasse 80% da sua CPU quota
5. Gerar um relatório de PVCs não utilizados (sem pod montando) em todos os namespaces`,

  quiz: [
    {
      question: 'Qual é a diferença entre Showback e Chargeback em FinOps?',
      options: [
        'Showback mostra custos historicamente; Chargeback mostra custos em tempo real',
        'Showback é informativo (quanto custaria); Chargeback é financeiro (cobra efetivamente)',
        'Showback é para clouds públicas; Chargeback é para on-premises',
        'Não há diferença — são sinônimos no contexto FinOps'
      ],
      correct: 1,
      explanation: 'Showback apresenta relatórios de custo como informação (o time vê quanto está gastando mas não é cobrado diretamente). Chargeback efetivamente debita o custo do budget do time/business unit. Showback é o passo inicial antes de implementar Chargeback.',
      reference: 'Conceito: Showback vs Chargeback — seção dedicada na teoria.'
    },
    {
      question: 'Por que usar Spot/Preemptible nodes apenas para workloads stateless?',
      options: [
        'Spot nodes têm menor CPU disponível que on-demand',
        'Spot nodes podem ser interrompidos a qualquer momento, causando perda de estado em workloads stateful',
        'Spot nodes não suportam PersistentVolumes',
        'Spot nodes têm restrições de região que impedem uso stateful'
      ],
      correct: 1,
      explanation: 'Spot/Preemptible nodes podem ser revogados com 2 minutos de aviso (AWS) ou 30s (GCP). Para stateless (APIs, workers), isso é tolerável com graceful shutdown. Para stateful (bancos de dados, Kafka), a interrupção causa perda de dados ou split-brain — riscos inaceitáveis.',
      reference: 'Conceito: Spot nodes — seção "Spot/Preemptible Nodes" na teoria.'
    },
    {
      question: 'Qual ferramenta AWS oferece mais flexibilidade para Spot e consolidação proativa de nodes que o Cluster Autoscaler?',
      options: [
        'Node Problem Detector',
        'Karpenter',
        'AWS Auto Scaling Groups',
        'Fargate Profile'
      ],
      correct: 1,
      explanation: 'Karpenter provisiona nodes individualmente (sem node groups) em ~30-60s, escolhe dinamicamente o instance type mais barato disponível e faz consolidação proativa (bin packing) de pods em menos nodes. Cluster Autoscaler é limitado a node groups pré-configurados e mais lento.',
      reference: 'Comparativo: Karpenter vs Cluster Autoscaler — tabela na teoria.'
    },
    {
      question: 'Qual é a estratégia FinOps para usar Commitment-Based Discounts (Reserved Instances) corretamente?',
      options: [
        'Comprar commitments para todos os workloads para maximizar desconto',
        'Usar commitments apenas para workloads com > 70% de utilização constante',
        'Usar commitments apenas para workloads de desenvolvimento que rodam 24h',
        'Commitments são sempre mais caros no longo prazo — evitar'
      ],
      correct: 1,
      explanation: 'Commitments oferecem desconto em troca de uso comprometido. Se o workload usa < 70% da capacidade comprometida, você paga pela capacidade ociosa. A regra é: baseline estável (bancos de dados, control plane, APIs constantes) → commitments; variável/batch → spot ou on-demand.',
      reference: 'Conceito: Commitment-Based Discounts — seção dedicada na teoria.'
    },
    {
      question: 'Qual é o principal problema de não usar labels de billing nos workloads Kubernetes?',
      options: [
        'Os pods ficam mais lentos sem labels adequadas',
        'Impossível alocar custos por time/projeto — custos aparecem como "overhead" sem responsável',
        'O Kubernetes Scheduler ignora pods sem labels de billing',
        'Labels de billing são obrigatórias pelo Kubernetes para criar pods'
      ],
      correct: 1,
      explanation: 'Sem labels, todos os custos ficam agregados no nível do cluster sem attributability. Impossível fazer showback ou chargeback por time. Kubecost, AWS Cost Explorer e outras ferramentas dependem de tags/labels para alocar custos. É o anti-padrão mais custoso em termos de visibilidade.',
      reference: 'Conceito: Labels para billing — seção "Modelo de Alocação de Custos" na teoria.'
    },
    {
      question: 'O que é o padrão FOCUS no contexto de FinOps?',
      options: [
        'Um framework de priorização de otimizações de custo',
        'Uma especificação aberta para normalizar dados de custo entre diferentes cloud providers',
        'Um conjunto de KPIs obrigatórios para certificação FinOps',
        'Um padrão de nomenclatura de labels para Kubernetes'
      ],
      correct: 1,
      explanation: 'FOCUS (FinOps Open Cost and Usage Specification) é um padrão aberto da FinOps Foundation que define um esquema comum para dados de faturamento de cloud. Com FOCUS, é possível comparar e consolidar custos de AWS, GCP, Azure, etc. com a mesma estrutura de colunas.',
      reference: 'Conceito: FOCUS Standard — seção "FOCUS Standard" na teoria.'
    },
    {
      question: 'Qual dos seguintes é um exemplo de DESPERDÍCIO típico em clusters Kubernetes?',
      options: [
        'Usar HPA para escalar automaticamente baseado em carga',
        'Definir resource requests baseados em uso p50 histórico',
        'Manter namespaces de PR/branch que foram mergeados há meses',
        'Usar spot nodes para workloads de processamento batch'
      ],
      correct: 2,
      explanation: 'Namespaces de ambientes temporários (PR previews, branches de dev) que não foram limpos após o merge/encerramento são um dos desperdícios mais comuns. Cada namespace pode ter Deployments rodando, PVCs alocados e serviços ativos — sem nenhum uso real.',
      reference: 'Desperdício: namespaces abandonados — seção "Tipos de Desperdício" na teoria.'
    },
    {
      question: 'Qual política de governance garante que Deployments em produção tenham labels obrigatórias?',
      options: [
        'ResourceQuota com labelSelector',
        'LimitRange com requiredLabels',
        'OPA/Gatekeeper com K8sRequiredLabels constraint',
        'PodSecurityPolicy com labelRequirements'
      ],
      correct: 2,
      explanation: 'OPA Gatekeeper com a constraint K8sRequiredLabels (ou constraint customizada) valida durante a admission que Deployments/StatefulSets têm as labels obrigatórias (team, cost-center, etc.). Sem as labels, o deployment é rejeitado. É a forma de enforcement mais robusta.',
      reference: 'Governance: OPA/Gatekeeper — seção "Políticas de Cost Governance" na teoria.'
    }
  ],

  flashcards: [
    {
      front: 'Quais são as 3 fases do FinOps Framework?',
      back: 'INFORM (Informar):\n- Criar visibilidade de custos\n- Custo por namespace/team/label\n- Dashboards e relatórios\n\nOPTIMIZE (Otimizar):\n- Right-sizing com Goldilocks/VPA\n- Spot nodes para workloads adequados\n- Limpar recursos ociosos\n- Commitments para baseline\n\nOPERATE (Operacionalizar):\n- Chargeback por time\n- Budget alerts\n- Políticas de governance (OPA)\n- Processos de revisão de custo'
    },
    {
      front: 'Quais labels são recomendadas para billing em Kubernetes?',
      back: 'Labels obrigatórias:\n- team: nome do time responsável\n- environment: production/staging/dev\n- cost-center: código do centro de custo\n\nLabels recomendadas:\n- project: nome do projeto/iniciativa\n- component: api/worker/db\n- owner: email do responsável técnico\n\nNão usar como labels (alta cardinalidade):\n- version: valores únicos\n- instance: nome do pod\n\nCom OPA Gatekeeper: force labels obrigatórias em admission'
    },
    {
      front: 'Quando usar Spot vs On-demand vs Reserved instances?',
      back: 'Spot/Preemptible (desconto 70-90%):\n✓ Workloads stateless (APIs horizontais)\n✓ Processamento batch tolerante a falhas\n✓ Worker pools de CI/CD\n✗ Bancos de dados\n✗ Stateful services críticos\n\nOn-demand:\n✓ Workloads variáveis\n✓ Quando spot não disponível\n✓ Testes e desenvolvimento\n\nReserved/Commitments:\n✓ Baseline estável (> 70% utilização)\n✓ Control plane nodes\n✓ Bancos de dados de produção\n✗ Workloads variáveis ou batch'
    },
    {
      front: 'Quais são os 4 tipos principais de desperdício no Kubernetes?',
      back: '1. Request over-provisioning:\n   - requests >> uso real\n   - Paga por CPU/mem que não usa\n   - Fix: Goldilocks right-sizing\n\n2. Idle workloads:\n   - Deployments com 0 req/s\n   - PVCs sem pod consumindo\n   - Fix: auditoria mensal\n\n3. Namespaces abandonados:\n   - PRs mergeados, branches encerradas\n   - Fix: TTL ou limpeza automática no CI/CD\n\n4. Node underutilization:\n   - Nodes com < 30% de uso real\n   - Fix: Cluster Autoscaler + Karpenter consolidation'
    },
    {
      front: 'O que é o FOCUS standard e por que é importante?',
      back: 'FOCUS = FinOps Open Cost and Usage Specification\n\nProblema sem FOCUS:\n- AWS tem seu formato de billing\n- GCP tem outro formato\n- Azure tem outro formato\n- Consolidar = muito trabalho manual\n\nCom FOCUS:\n- Esquema comum de colunas\n- BilledCost, EffectiveCost, ResourceId\n- ResourceType, Tags, UsagePeriod\n- Importar qualquer cloud na mesma estrutura\n\nFerramentas: Kubecost FOCUS export, OpenCost'
    },
    {
      front: 'Qual é a diferença entre Karpenter e Cluster Autoscaler?',
      back: 'Cluster Autoscaler:\n- Node groups pré-definidos\n- 1-2 min para provisionar\n- Scale-down após 10min ocioso\n- Multi-cloud\n\nKarpenter:\n- Qualquer instance type dinamicamente\n- 30-60s para provisionar\n- Consolidation proativa (bin packing)\n- Disruption budget para scale-down controlado\n- Melhor custo: escolhe mais barato disponível\n- Principalmente AWS (em expansão)\n\nQuando usar Karpenter:\n- AWS EKS com necessidade de flexibilidade\n- Mix spot + on-demand dinâmico\n- Custo como prioridade'
    },
    {
      front: 'Como identificar namespaces e deployments sem billing labels?',
      back: '# Deployments sem label "team"\nkubectl get deployments --all-namespaces -o json | \\\n  jq \'.items[] | select(\n    .metadata.labels.team == null\n  ) | {ns: .metadata.namespace, name: .metadata.name}\'\n\n# PVCs sem pod consumindo\nkubectl get pvc --all-namespaces | grep -v "Bound"\n\n# Deployments com 0 réplicas (ociosos)\nkubectl get deployments --all-namespaces -o json | \\\n  jq \'.items[] | select(.spec.replicas == 0) | .metadata\'\n\n# Nodes com < 30% CPU\nkubectl top nodes | awk \'NR>1 {gsub(/%/,""); if ($3 < 30) print $1, $3"%"}\''
    },
    {
      front: 'Como implementar Chargeback por time em Kubernetes?',
      back: 'Passos:\n1. Labels obrigatórias: team, cost-center em todos os pods\n\n2. Ferramentas de coleta:\n   - Kubecost: API de alocação por label\n   - OpenCost: open-source Kubecost\n   - AWS Cost Explorer: tags de EC2 nodes\n\n3. Modelo de alocação:\n   - Compute = soma(requests × preço × horas)\n   - Storage = PVC size × storage class price\n   - Network = egress bytes × preço\n\n4. Shared costs:\n   - Monitoring, ingress, logging = dividir por uso ou igualmente\n\n5. Relatório mensal:\n   - Dashboard ou export CSV para Finance'
    }
  ],

  lab: {
    scenario: 'A empresa quer implementar visibilidade de custos e governance financeira no cluster. Como Platform Engineer, você deve configurar billing labels, criar alertas de custo via Prometheus e identificar desperdícios existentes.',
    objective: 'Implementar governance de labels de billing, configurar alertas de custo e criar um relatório de recursos ociosos.',
    duration: '25-35 minutos',
    steps: [
      {
        title: 'Auditoria de Labels de Billing no Cluster',
        instruction: `Execute uma auditoria completa para identificar workloads sem as labels obrigatórias de billing.

Crie um script que liste:
1. Namespaces sem label \`cost-center\`
2. Deployments sem label \`team\`
3. PVCs sem pod consumindo (possível desperdício de storage)
4. Deployments com 0 réplicas (recursos ociosos)`,
        hints: [
          'Use kubectl get -o json com jq para filtrar e formatar a saída',
          'Para PVCs não utilizados, compare com os volumes montados nos pods',
          'Deployments com spec.replicas == 0 são candidatos a limpeza'
        ],
        solution: `\`\`\`bash
echo "=== AUDITORIA DE BILLING LABELS ==="
echo ""

echo "1. Namespaces sem label cost-center:"
kubectl get namespaces -o json | \\
  jq -r '.items[] | select(
    .metadata.labels["cost-center"] == null
  ) | .metadata.name'

echo ""
echo "2. Deployments sem label team (todos namespaces):"
kubectl get deployments --all-namespaces -o json | \\
  jq -r '.items[] | select(
    .metadata.labels.team == null
  ) | .metadata.namespace + "/" + .metadata.name'

echo ""
echo "3. Deployments com 0 réplicas (ociosos):"
kubectl get deployments --all-namespaces -o json | \\
  jq -r '.items[] | select(.spec.replicas == 0) |
    .metadata.namespace + "/" + .metadata.name'

echo ""
echo "4. PVCs e seus status:"
kubectl get pvc --all-namespaces --no-headers | \\
  awk '{print \$1, \$2, \$4, \$5}'

echo ""
echo "5. Pods sem resource requests (QoS BestEffort):"
kubectl get pods --all-namespaces -o json | \\
  jq -r '.items[] | select(
    .status.qosClass == "BestEffort"
  ) | .metadata.namespace + "/" + .metadata.name'
\`\`\``,
        verify: `\`\`\`bash
# Verificar que script funciona
kubectl get namespaces -o json | \\
  jq -r '.items[] | select(
    .metadata.labels["cost-center"] == null
  ) | .metadata.name' | head -5
# Saída esperada: lista de namespaces sem cost-center

# Verificar deployments sem team label
kubectl get deployments --all-namespaces -o json | \\
  jq '[.items[] | select(.metadata.labels.team == null)] | length'
# Saída esperada: número de deployments sem label team

# Verificar QoS dos pods
kubectl get pods --all-namespaces -o json | \\
  jq '[.items[] | .status.qosClass] | group_by(.) | .[] | {class: .[0], count: length}'
# Saída esperada: distribuição de QoS classes (Guaranteed, Burstable, BestEffort)
\`\`\``
      },
      {
        title: 'Adicionar Labels de Billing e Configurar Governance',
        instruction: `Aplique labels de billing corretas em um namespace de exemplo e crie uma PrometheusRule para alertar sobre desvios de custo.

1. Crie um namespace \`team-payments\` com labels de billing completas
2. Faça deploy de uma aplicação com todas as labels obrigatórias
3. Crie alertas Prometheus para: namespace acima de 80% da quota e pods BestEffort em produção`,
        hints: [
          'Labels de namespace não são propagadas para pods automaticamente',
          'Para enforcement automático, use OPA/Gatekeeper (Kyverno é alternativa)',
          'PrometheusRule precisa de labels que batem com o ruleSelector do Prometheus'
        ],
        solution: `\`\`\`bash
# Criar namespace com labels de billing
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: team-payments
  labels:
    team: payments
    environment: production
    cost-center: CC-001
    business-unit: financial-services
  annotations:
    billing/owner: "payments-lead@company.com"
    billing/project: "payments-v3"
EOF

# Deploy com labels completas
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-api
  namespace: team-payments
  labels:
    team: payments
    cost-center: CC-001
    environment: production
    app: payment-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: payment-api
  template:
    metadata:
      labels:
        team: payments
        cost-center: CC-001
        environment: production
        app: payment-api
    spec:
      containers:
        - name: api
          image: nginx:latest
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: payments-quota
  namespace: team-payments
spec:
  hard:
    requests.cpu: "5"
    requests.memory: 10Gi
    pods: "20"
EOF

# Criar alertas de custo
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: cost-governance-alerts
  namespace: monitoring
  labels:
    app: kube-prometheus-stack
spec:
  groups:
    - name: cost-governance
      interval: 5m
      rules:
        - alert: NamespaceHighCPUQuotaUsage
          expr: |
            (
              kube_resourcequota{type="used", resource="requests.cpu"}
              /
              kube_resourcequota{type="hard", resource="requests.cpu"}
            ) > 0.8
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "Namespace {{ \$labels.namespace }} at {{ \$value | humanizePercentage }} CPU quota"
            description: "Consider requesting quota increase or optimizing resource usage"

        - alert: BestEffortPodsDetected
          expr: |
            kube_pod_status_qos_class{qos_class="besteffort", namespace=~"production|staging|team-.*"} > 0
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "BestEffort pod {{ \$labels.pod }} in {{ \$labels.namespace }}"
            description: "Pod has no resource requests — will be first evicted under pressure"
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar namespace com labels
kubectl get namespace team-payments -o yaml | grep -A10 "labels:"
# Saída esperada: team, environment, cost-center, business-unit

# Verificar deployment com labels
kubectl get deployment payment-api -n team-payments -o json | \\
  jq '.metadata.labels, .spec.template.metadata.labels'
# Saída esperada: labels presentes em ambos

# Verificar QoS dos pods
kubectl get pods -n team-payments -o json | \\
  jq '.items[] | {name: .metadata.name, qos: .status.qosClass}'
# Saída esperada: Burstable (requests < limits)

# Verificar PrometheusRule criada
kubectl get prometheusrule cost-governance-alerts -n monitoring
# Saída esperada: cost-governance-alerts   Xm

# Verificar ResourceQuota e uso
kubectl describe resourcequota payments-quota -n team-payments
# Saída esperada: Used/Hard para requests.cpu, memory, pods
\`\`\``
      },
      {
        title: 'Calcular e Gerar Relatório de Custo por Time',
        instruction: `Crie um relatório de consumo de recursos por time usando labels. Este relatório simula o showback mensal que seria enviado para os times.

Calcule:
1. CPU requests totais por label \`team\`
2. Memory requests totais por label \`team\`
3. Número de pods por namespace
4. Estimativa de custo simplificada (CPU requests × $0.048/hora)`,
        hints: [
          'Use kubectl get pods com -o json e jq para agregação',
          'CPU em milicores precisa ser convertido para cores (divida por 1000)',
          'Para custo real, use Kubecost API ou OpenCost — aqui faremos uma aproximação'
        ],
        solution: `\`\`\`bash
#!/bin/bash
# Relatório simplificado de custo por time

echo "========================================"
echo "   KUBERNETES COST REPORT (Showback)"
echo "   Data: \$(date +%Y-%m-%d)"
echo "========================================"
echo ""

echo "--- CPU REQUESTS POR TIME ---"
kubectl get pods --all-namespaces -o json 2>/dev/null | \\
  jq -r '.items[] |
    select(.status.phase == "Running") |
    (
      (.metadata.labels.team // "UNTAGGED") + " " +
      (.spec.containers[0].resources.requests.cpu // "0")
    )' | \\
  awk '{
    team = \$1
    cpu = \$2
    # Convert to millicores
    if (cpu ~ /m/) { gsub(/m/, "", cpu); }
    else { cpu = cpu * 1000; }
    total[team] += cpu
  }
  END {
    for (t in total) {
      cores = total[t] / 1000
      cost = cores * 0.048 * 720  # $/month (720h)
      printf "Team: %-20s CPU: %6.2f cores  Est. Cost/month: \$%.2f\n", t, cores, cost
    }
  }' | sort -k8 -rn

echo ""
echo "--- PODS POR NAMESPACE ---"
kubectl get pods --all-namespaces --no-headers 2>/dev/null | \\
  awk '{ns[\$1]++} END {for (n in ns) printf "%-40s %d pods\n", n, ns[n]}' | \\
  sort -k2 -rn | head -15

echo ""
echo "--- PVCs E STORAGE (possíveis custos de storage) ---"
kubectl get pvc --all-namespaces --no-headers 2>/dev/null | \\
  awk '{print \$1, \$2, \$4, \$5}' | \\
  column -t
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o script gera saída
kubectl get pods --all-namespaces -o json | \\
  jq '[.items[] | select(.status.phase=="Running") | .metadata.labels.team // "UNTAGGED"] |
    group_by(.) | .[] | {team: .[0], count: length}'
# Saída esperada: lista de times com contagem de pods

# Verificar pods por namespace
kubectl get pods --all-namespaces --no-headers | \\
  awk '{print \$1}' | sort | uniq -c | sort -rn | head -10
# Saída esperada: namespaces com contagem de pods

# Verificar PVCs
kubectl get pvc --all-namespaces | grep -c Bound
# Saída esperada: número de PVCs bound no cluster
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Custos do cluster crescendo sem explicação',
      difficulty: 'medium',
      symptom: 'Os custos do cluster aumentaram 40% no último mês. Não houve mudanças conhecidas em produção. A equipe de finanças está questionando o gasto.',
      diagnosis: `\`\`\`bash
# Ver pods que mais consomem recursos
kubectl top pods --all-namespaces --sort-by=cpu | head -20
kubectl top pods --all-namespaces --sort-by=memory | head -20

# Verificar se há namespaces novos
kubectl get namespaces --sort-by=.metadata.creationTimestamp

# Verificar deployments com alto número de réplicas
kubectl get deployments --all-namespaces -o json | \\
  jq '.items[] | select(.spec.replicas > 5) | {
    ns: .metadata.namespace,
    name: .metadata.name,
    replicas: .spec.replicas
  }'

# Verificar PVCs criados recentemente
kubectl get pvc --all-namespaces --sort-by=.metadata.creationTimestamp | tail -20

# Verificar nodes adicionados
kubectl get nodes --sort-by=.metadata.creationTimestamp

# Ver total de CPU/memory requests por namespace
kubectl get pods --all-namespaces -o json | \\
  jq '[.items[] | {
    ns: .metadata.namespace,
    cpu: (.spec.containers[0].resources.requests.cpu // "0")
  }] | group_by(.ns) | .[] | {
    namespace: .[0].ns,
    pod_count: length
  }' | head -20
\`\`\``,
      solution: `**Investigação sistemática**:

**1. Verificar HPA escalou pods demais**:
\`\`\`bash
kubectl get hpa --all-namespaces
# Compare CURRENT vs DESIRED replicas
# Se muito alto, investigar se threshold está correto
\`\`\`

**2. Verificar jobs batch não completados**:
\`\`\`bash
kubectl get jobs --all-namespaces | grep -v Complete
# Jobs stuck = custo contínuo
kubectl delete jobs --field-selector status.successful=0 -n my-namespace
\`\`\`

**3. Verificar novo namespace ou equipe sem quotas**:
\`\`\`bash
kubectl get namespaces -o json | \\
  jq -r '.items[] | select(.metadata.labels["cost-center"] == null) | .metadata.name'
# Namespaces sem quota = podem consumir recursos ilimitados
\`\`\`

**4. Verificar Cluster Autoscaler adicionou nodes demais**:
\`\`\`bash
kubectl get nodes -o json | jq '.items | length'
kubectl logs -n kube-system -l app=cluster-autoscaler | grep "scale-up" | tail -20
\`\`\`

**5. Usar Kubecost para análise de custo detalhada**:
\`\`\`bash
# Custo por namespace nos últimos 7 dias
curl "http://localhost:9090/model/allocation?window=7d&aggregate=namespace" | jq '.data'
\`\`\``
    },
    {
      title: 'Spot nodes causando falhas frequentes em workloads',
      difficulty: 'hard',
      symptom: 'Desde a migração de alguns Deployments para spot nodes para reduzir custos, há 3-5 interrupções por dia. Pods são terminados abruptamente e clientes reportam erros 503.',
      diagnosis: `\`\`\`bash
# Ver histórico de evictions
kubectl get events --all-namespaces --sort-by=.lastTimestamp | \\
  grep -i "spot\\|preempt\\|evict\\|interrupt" | tail -20

# Ver se pods têm PodDisruptionBudget
kubectl get pdb --all-namespaces

# Ver se os pods afetados têm graceful termination configurado
kubectl get deployment affected-app -o yaml | \\
  grep -A5 "terminationGracing\\|preStop\\|lifecycle"

# Ver nodes spot e quando foram criados/destruídos
kubectl get nodes -l karpenter.sh/capacity-type=spot
kubectl describe nodes -l karpenter.sh/capacity-type=spot | grep -A5 "Taints"

# Verificar se há réplicas suficientes para tolerar interrupções
kubectl get deployment affected-app -o json | \\
  jq '.spec.replicas, .status.availableReplicas'
\`\`\``,
      solution: `**Causa 1**: Workload stateful em spot node — mover para on-demand.
\`\`\`bash
# Adicionar nodeAffinity para evitar spot nodes
kubectl patch deployment affected-app --type merge -p '{
  "spec": {"template": {"spec": {
    "affinity": {
      "nodeAffinity": {
        "requiredDuringSchedulingIgnoredDuringExecution": {
          "nodeSelectorTerms": [{
            "matchExpressions": [{
              "key": "karpenter.sh/capacity-type",
              "operator": "In",
              "values": ["on-demand"]
            }]
          }]
        }
      }
    }
  }}}
}'
\`\`\`

**Causa 2**: Graceful shutdown não configurado corretamente.
\`\`\`yaml
# Adicionar ao container spec
lifecycle:
  preStop:
    exec:
      command: ["sh", "-c", "sleep 15"]  # tempo para load balancer remover
terminationGracePeriodSeconds: 30
\`\`\`

**Causa 3**: PodDisruptionBudget ausente.
\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: affected-app-pdb
spec:
  selector:
    matchLabels:
      app: affected-app
  minAvailable: 2   # sempre manter pelo menos 2 pods
EOF
\`\`\``
    }
  ]
};
