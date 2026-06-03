window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['finops/finops-practices'] = {
  theory: `# FinOps Practices & Chargeback in Kubernetes

## Exam Relevance
> FinOps for Kubernetes covers cost allocation models, per-team chargeback/showback, waste detection, and optimization strategies like Spot/Preemptible nodes.

## Core Concepts

### What is FinOps?
FinOps (Financial Operations) is a cultural practice that brings together Engineering, Finance, and Business to efficiently manage cloud costs. In the Kubernetes context:

\`\`\`
┌──────────────────────────────────────────────────────┐
│                  FinOps Framework                     │
│                                                       │
│  INFORM          OPTIMIZE          OPERATE            │
│  ┌──────────┐   ┌──────────────┐  ┌──────────────┐  │
│  │Visibility│   │ Right-sizing │  │Cost Allocation│ │
│  │Cost per  │   │ Spot nodes   │  │Chargeback per │ │
│  │namespace/│   │ Idle cleanup │  │team/project   │ │
│  │team/label│   │ Commitments  │  │Budget alerts  │ │
│  └──────────┘   └──────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────┘
\`\`\`

### Showback vs Chargeback

| Concept | Definition | When to use |
|---------|------------|-------------|
| **Showback** | Shows how much each team WOULD cost — informational | Early stage, nascent cost culture |
| **Chargeback** | Actually bills the team for usage — financial | Mature orgs with multiple business units |
| **Budget Alerts** | Notifies when cost exceeds threshold | All stages |

### Cost Allocation Model in Kubernetes

**Labels as cost centers**:
\`\`\`yaml
# Recommended labels for allocation
metadata:
  labels:
    team: "payments"              # owning team
    environment: "production"     # environment
    cost-center: "CC-123"         # ERP cost center
    project: "payment-v2"         # project/initiative
    owner: "alice@company.com"
\`\`\`

**Allocation strategy**:
1. **Label everything**: all workloads must have team/project labels
2. **Namespace per team**: separate environments by namespace (enables quota + billing)
3. **Node pools by workload type**: spot pool, on-demand pool, GPU pool
4. **Shared services**: shared tools (monitoring, ingress) → costs split

### Types of Waste in Kubernetes

**1. Request over-provisioning** (most common):
\`\`\`
Pod requests 1 CPU, uses 100m → 900m wasted
Cost: you pay for 1 CPU on the node, but use 10%
\`\`\`

**2. Idle workloads**:
\`\`\`
Deployments with 0 req/s (disabled feature)
Jobs that never run again
Persistent Volumes with no pod consuming
\`\`\`

**3. Abandoned namespaces**:
\`\`\`
PR/dev environments not cleaned up
Namespaces with unknown ownership
\`\`\`

**4. Node underutilization**:
\`\`\`
Nodes with 20% CPU usage
Nodes maintained for few pods that fit elsewhere
\`\`\`

### Spot/Preemptible Nodes — 70-90% Savings

\`\`\`yaml
# Spot node pool on EKS
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
# Pod tolerating spot nodes
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
| Provider | Multi-cloud | AWS native (expanding) |
| Speed | 1-2 min for new node | 30-60s for new node |
| Granularity | Pre-defined node groups | Any instance type dynamically |
| Spot support | Via node groups | Native, flexible |
| Consolidation | Yes (scale-down) | Proactive consolidation |
| Cost awareness | Basic | Advanced (chooses cheapest) |

### FOCUS Standard — Normalized Cloud Billing
FOCUS (FinOps Open Cost and Usage Specification) is an open standard for normalizing cost data across clouds:

\`\`\`
Main FOCUS columns:
- BilledCost: amount charged
- EffectiveCost: cost with discount/commitment applied
- ResourceId: resource identifier
- ResourceType: type (EC2, GKE Node Pool, etc.)
- Tags: resource labels/tags
- UsagePeriod: period of use
\`\`\`

### Commitment-Based Discounts (Reserved/Savings Plans)

\`\`\`
Reserved Instances (AWS):
  - 1 year: ~30-40% discount vs on-demand
  - 3 years: ~50-60% discount
  - Use: stable baseline workloads (control plane, databases)

Savings Plans (AWS):
  - More flexible than RI
  - Applies to any EC2 or Fargate type
  - Based on $/hour committed

Committed Use Discounts (GCP):
  - 1 year: ~20-25% discount
  - 3 years: ~40-55% discount

Rule: Commitments only for stable workloads (> 70% utilization)
\`\`\`

### Cost Governance Policies

\`\`\`yaml
# OPA/Gatekeeper policy: required labels
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

## Essential Commands

### Identify Waste
\`\`\`bash
# Namespaces with highest CPU consumption
kubectl top pods --all-namespaces --sort-by=cpu | head -20

# Pods with requests far above real usage
kubectl get pods --all-namespaces -o json | \\
  jq '.items[] | select(
    .spec.containers[0].resources.requests.cpu != null
  ) | {
    ns: .metadata.namespace,
    name: .metadata.name,
    cpu_request: .spec.containers[0].resources.requests.cpu
  }' | head -20

# PVCs not mounted by any pod (possible storage waste)
kubectl get pvc --all-namespaces -o json | \\
  jq '.items[] | select(.status.phase=="Bound") | {
    ns: .metadata.namespace,
    name: .metadata.name,
    size: .spec.resources.requests.storage
  }'

# Deployments with 0 replicas (idle)
kubectl get deployments --all-namespaces -o json | \\
  jq '.items[] | select(.spec.replicas == 0) | {
    ns: .metadata.namespace,
    name: .metadata.name
  }'

# Nodes with low utilization (< 30% CPU)
kubectl top nodes | awk 'NR>1 {
  gsub(/%/,"");
  if (\$3 < 30) print \$1, "CPU:", \$3"%"
}'
\`\`\`

## YAML Examples

### Namespace with Complete Billing Labels
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

### Karpenter NodePool with Spot
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
      nodeClassRef:
        name: default
  limits:
    cpu: 1000
    memory: 4000Gi
  disruption:
    consolidationPolicy: WhenUnderutilized
    consolidateAfter: 30s
    expireAfter: 720h
\`\`\`

## Common Mistakes

### 1. Using only namespace for billing without project labels
**Cause**: A namespace can have multiple projects/teams.
**Fix**: Combine namespace + labels (team, project, cost-center) for granularity.

### 2. Commitments for variable workloads
**Cause**: Buying Reserved Instances for batch workloads that only run during daytime.
**Impact**: Paying for unused capacity at night.
**Fix**: Commitments only for stable baseline (> 70% utilization).

### 3. Not cleaning up development environments
**Cause**: Branch/PR namespaces not deleted after merge.
**Impact**: Dozens of idle environments consuming resources.
**Fix**: TTL on development namespaces or automatic cleanup via CI/CD.

### 4. Spot nodes for stateful workloads
**Cause**: Using spot for databases or stateful services.
**Impact**: Frequent interruptions cause data loss or unavailability.
**Fix**: Spot only for stateless workloads; databases on on-demand/committed.

### 5. Ignoring network costs
**Cause**: Focusing only on compute and forgetting egress costs.
**Impact**: In multi-region clusters, egress can be 20-30% of total cost.
**Fix**: Configure topology-aware routing; use compression; audit external traffic.

## Killer.sh Style Challenge

**Context**: The company wants to implement monthly showback for 4 cluster teams. You must:
1. Create an OPA policy requiring \`team\` and \`cost-center\` labels on all production Deployments
2. Identify the 3 main namespaces without \`team\` label on their Deployments
3. Calculate total CPU requests by \`team\` label in the production namespace
4. Create a PrometheusRule that alerts when the \`payments\` namespace exceeds 80% of its CPU quota
5. Generate a report of unused PVCs (no pod mounting them) in all namespaces`,

  quiz: [
    {
      question: 'What is the difference between Showback and Chargeback in FinOps?',
      options: [
        'Showback shows historical costs; Chargeback shows real-time costs',
        'Showback is informational (what it would cost); Chargeback is financial (actually bills)',
        'Showback is for public clouds; Chargeback is for on-premises',
        'There is no difference — they are synonyms in FinOps'
      ],
      correct: 1,
      explanation: 'Showback presents cost reports as information (the team sees what they\'re spending but isn\'t directly billed). Chargeback actually debits the cost from the team/business unit budget. Showback is the initial step before implementing Chargeback.',
      reference: 'Concept: Showback vs Chargeback — dedicated section in theory.'
    },
    {
      question: 'Why use Spot/Preemptible nodes only for stateless workloads?',
      options: [
        'Spot nodes have lower CPU available than on-demand',
        'Spot nodes can be interrupted at any time, causing state loss in stateful workloads',
        'Spot nodes don\'t support PersistentVolumes',
        'Spot nodes have regional restrictions preventing stateful use'
      ],
      correct: 1,
      explanation: 'Spot/Preemptible nodes can be revoked with 2 minutes notice (AWS) or 30s (GCP). For stateless (APIs, workers), this is tolerable with graceful shutdown. For stateful (databases, Kafka), the interruption causes data loss or split-brain — unacceptable risks.',
      reference: 'Concept: Spot nodes — "Spot/Preemptible Nodes" section in theory.'
    },
    {
      question: 'Which AWS tool offers more flexibility for Spot and proactive node consolidation than Cluster Autoscaler?',
      options: [
        'Node Problem Detector',
        'Karpenter',
        'AWS Auto Scaling Groups',
        'Fargate Profile'
      ],
      correct: 1,
      explanation: 'Karpenter provisions individual nodes (without node groups) in ~30-60s, dynamically chooses the cheapest available instance type, and proactively consolidates (bin packs) pods into fewer nodes. Cluster Autoscaler is limited to pre-configured node groups and is slower.',
      reference: 'Comparison: Karpenter vs Cluster Autoscaler — table in theory.'
    },
    {
      question: 'What is the FinOps strategy for using Commitment-Based Discounts (Reserved Instances) correctly?',
      options: [
        'Buy commitments for all workloads to maximize discount',
        'Use commitments only for workloads with > 70% constant utilization',
        'Use commitments only for development workloads running 24h',
        'Commitments are always more expensive long-term — avoid'
      ],
      correct: 1,
      explanation: 'Commitments offer a discount in exchange for committed use. If the workload uses < 70% of committed capacity, you pay for idle capacity. The rule: stable baseline (databases, control plane, constant APIs) → commitments; variable/batch → spot or on-demand.',
      reference: 'Concept: Commitment-Based Discounts — dedicated section in theory.'
    },
    {
      question: 'What is the main problem of not using billing labels on Kubernetes workloads?',
      options: [
        'Pods become slower without proper labels',
        'Impossible to allocate costs by team/project — costs appear as "overhead" with no owner',
        'Kubernetes Scheduler ignores pods without billing labels',
        'Billing labels are mandatory by Kubernetes to create pods'
      ],
      correct: 1,
      explanation: 'Without labels, all costs are aggregated at the cluster level without attributability. Impossible to do showback or chargeback by team. Kubecost, AWS Cost Explorer, and other tools depend on tags/labels to allocate costs. It\'s the most expensive anti-pattern in terms of visibility.',
      reference: 'Concept: Billing labels — "Cost Allocation Model" section in theory.'
    },
    {
      question: 'What is the FOCUS standard in the FinOps context?',
      options: [
        'A prioritization framework for cost optimizations',
        'An open specification for normalizing cost data across different cloud providers',
        'A set of mandatory KPIs for FinOps certification',
        'A label naming standard for Kubernetes'
      ],
      correct: 1,
      explanation: 'FOCUS (FinOps Open Cost and Usage Specification) is an open standard from the FinOps Foundation that defines a common schema for cloud billing data. With FOCUS, it\'s possible to compare and consolidate costs from AWS, GCP, Azure, etc. with the same column structure.',
      reference: 'Concept: FOCUS Standard — dedicated section in theory.'
    },
    {
      question: 'Which of the following is a typical example of WASTE in Kubernetes clusters?',
      options: [
        'Using HPA to automatically scale based on load',
        'Setting resource requests based on historical p50 usage',
        'Keeping PR/branch namespaces that were merged months ago',
        'Using spot nodes for batch processing workloads'
      ],
      correct: 2,
      explanation: 'Temporary environment namespaces (PR previews, dev branches) not cleaned up after merge/closure are one of the most common wastes. Each namespace can have running Deployments, allocated PVCs, and active services — with no real use.',
      reference: 'Waste: abandoned namespaces — "Types of Waste" section in theory.'
    },
    {
      question: 'Which governance policy ensures Deployments in production have mandatory labels?',
      options: [
        'ResourceQuota with labelSelector',
        'LimitRange with requiredLabels',
        'OPA/Gatekeeper with K8sRequiredLabels constraint',
        'PodSecurityPolicy with labelRequirements'
      ],
      correct: 2,
      explanation: 'OPA Gatekeeper with the K8sRequiredLabels constraint (or a custom constraint) validates at admission that Deployments/StatefulSets have required labels (team, cost-center, etc.). Without the labels, the deployment is rejected. It\'s the most robust enforcement approach.',
      reference: 'Governance: OPA/Gatekeeper — "Cost Governance Policies" section in theory.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 3 phases of the FinOps Framework?',
      back: 'INFORM:\n- Create cost visibility\n- Cost per namespace/team/label\n- Dashboards and reports\n\nOPTIMIZE:\n- Right-sizing with Goldilocks/VPA\n- Spot nodes for suitable workloads\n- Clean idle resources\n- Commitments for baseline\n\nOPERATE:\n- Chargeback by team\n- Budget alerts\n- Governance policies (OPA)\n- Cost review processes'
    },
    {
      front: 'Which labels are recommended for billing in Kubernetes?',
      back: 'Required labels:\n- team: name of responsible team\n- environment: production/staging/dev\n- cost-center: cost center code\n\nRecommended labels:\n- project: project/initiative name\n- component: api/worker/db\n- owner: technical owner email\n\nDo NOT use as labels (high cardinality):\n- version: unique values\n- instance: pod name\n\nWith OPA Gatekeeper: enforce required labels at admission'
    },
    {
      front: 'When to use Spot vs On-demand vs Reserved instances?',
      back: 'Spot/Preemptible (70-90% savings):\n✓ Stateless workloads (horizontal APIs)\n✓ Fault-tolerant batch processing\n✓ CI/CD worker pools\n✗ Databases\n✗ Critical stateful services\n\nOn-demand:\n✓ Variable workloads\n✓ When spot unavailable\n✓ Testing and development\n\nReserved/Commitments:\n✓ Stable baseline (> 70% utilization)\n✓ Control plane nodes\n✓ Production databases\n✗ Variable or batch workloads'
    },
    {
      front: 'What are the 4 main types of waste in Kubernetes?',
      back: '1. Request over-provisioning:\n   - requests >> real usage\n   - Pay for CPU/mem you don\'t use\n   - Fix: Goldilocks right-sizing\n\n2. Idle workloads:\n   - Deployments with 0 req/s\n   - PVCs with no pod consuming\n   - Fix: monthly audit\n\n3. Abandoned namespaces:\n   - Merged PRs, closed branches\n   - Fix: TTL or automatic cleanup in CI/CD\n\n4. Node underutilization:\n   - Nodes with < 30% real usage\n   - Fix: Cluster Autoscaler + Karpenter consolidation'
    },
    {
      front: 'What is the FOCUS standard and why does it matter?',
      back: 'FOCUS = FinOps Open Cost and Usage Specification\n\nProblem without FOCUS:\n- AWS has its billing format\n- GCP has another format\n- Azure has another format\n- Consolidating = lots of manual work\n\nWith FOCUS:\n- Common column schema\n- BilledCost, EffectiveCost, ResourceId\n- ResourceType, Tags, UsagePeriod\n- Import any cloud in the same structure\n\nTools: Kubecost FOCUS export, OpenCost'
    },
    {
      front: 'What is the difference between Karpenter and Cluster Autoscaler?',
      back: 'Cluster Autoscaler:\n- Pre-defined node groups\n- 1-2 min to provision\n- Scale-down after 10min idle\n- Multi-cloud\n\nKarpenter:\n- Any instance type dynamically\n- 30-60s to provision\n- Proactive consolidation (bin packing)\n- Disruption budget for controlled scale-down\n- Best cost: chooses cheapest available\n- Primarily AWS (expanding)\n\nWhen to use Karpenter:\n- AWS EKS needing flexibility\n- Dynamic spot + on-demand mix\n- Cost as priority'
    },
    {
      front: 'How to identify namespaces and deployments without billing labels?',
      back: '# Deployments without "team" label\nkubectl get deployments --all-namespaces -o json | \\\n  jq \'.items[] | select(\n    .metadata.labels.team == null\n  ) | {ns: .metadata.namespace, name: .metadata.name}\'\n\n# PVCs with no pod consuming\nkubectl get pvc --all-namespaces | grep -v "Bound"\n\n# Deployments with 0 replicas (idle)\nkubectl get deployments --all-namespaces -o json | \\\n  jq \'.items[] | select(.spec.replicas == 0) | .metadata\'\n\n# Nodes with < 30% CPU\nkubectl top nodes | awk \'NR>1 {gsub(/%/,""); if ($3 < 30) print $1, $3"%"}\''
    },
    {
      front: 'How to implement Chargeback by team in Kubernetes?',
      back: 'Steps:\n1. Required labels: team, cost-center on all pods\n\n2. Collection tools:\n   - Kubecost: allocation API by label\n   - OpenCost: open-source Kubecost\n   - AWS Cost Explorer: EC2 node tags\n\n3. Allocation model:\n   - Compute = sum(requests × price × hours)\n   - Storage = PVC size × storage class price\n   - Network = egress bytes × price\n\n4. Shared costs:\n   - Monitoring, ingress, logging = split by usage or equally\n\n5. Monthly report:\n   - Dashboard or CSV export to Finance'
    }
  ],

  lab: {
    scenario: 'The company wants to implement cost visibility and financial governance in the cluster. As Platform Engineer, you must configure billing labels, create cost alerts via Prometheus, and identify existing waste.',
    objective: 'Implement billing label governance, configure cost alerts, and create an idle resource report.',
    duration: '25-35 minutes',
    steps: [
      {
        title: 'Billing Label Audit of the Cluster',
        instruction: `Run a complete audit to identify workloads missing required billing labels.

Create a script that lists:
1. Namespaces without \`cost-center\` label
2. Deployments without \`team\` label
3. PVCs with no pod consuming them (possible storage waste)
4. Deployments with 0 replicas (idle resources)`,
        hints: [
          'Use kubectl get -o json with jq to filter and format output',
          'For unused PVCs, compare with volumes mounted in pods',
          'Deployments with spec.replicas == 0 are cleanup candidates'
        ],
        solution: `\`\`\`bash
echo "=== BILLING LABELS AUDIT ==="
echo ""

echo "1. Namespaces without cost-center label:"
kubectl get namespaces -o json | \\
  jq -r '.items[] | select(
    .metadata.labels["cost-center"] == null
  ) | .metadata.name'

echo ""
echo "2. Deployments without team label (all namespaces):"
kubectl get deployments --all-namespaces -o json | \\
  jq -r '.items[] | select(
    .metadata.labels.team == null
  ) | .metadata.namespace + "/" + .metadata.name'

echo ""
echo "3. Deployments with 0 replicas (idle):"
kubectl get deployments --all-namespaces -o json | \\
  jq -r '.items[] | select(.spec.replicas == 0) |
    .metadata.namespace + "/" + .metadata.name'

echo ""
echo "4. PVCs and their status:"
kubectl get pvc --all-namespaces --no-headers | \\
  awk '{print \$1, \$2, \$4, \$5}'

echo ""
echo "5. Pods without resource requests (QoS BestEffort):"
kubectl get pods --all-namespaces -o json | \\
  jq -r '.items[] | select(
    .status.qosClass == "BestEffort"
  ) | .metadata.namespace + "/" + .metadata.name'
\`\`\``,
        verify: `\`\`\`bash
# Verify script works
kubectl get namespaces -o json | \\
  jq -r '.items[] | select(
    .metadata.labels["cost-center"] == null
  ) | .metadata.name' | head -5
# Expected: list of namespaces without cost-center

# Verify deployments without team label
kubectl get deployments --all-namespaces -o json | \\
  jq '[.items[] | select(.metadata.labels.team == null)] | length'
# Expected: number of deployments without team label

# Verify pods QoS distribution
kubectl get pods --all-namespaces -o json | \\
  jq '[.items[] | .status.qosClass] | group_by(.) | .[] | {class: .[0], count: length}'
# Expected: distribution of QoS classes (Guaranteed, Burstable, BestEffort)
\`\`\``
      },
      {
        title: 'Add Billing Labels and Configure Governance',
        instruction: `Apply correct billing labels to a sample namespace and create PrometheusRules to alert on cost deviations.

1. Create a \`team-payments\` namespace with complete billing labels
2. Deploy an application with all required labels
3. Create Prometheus alerts for: namespace above 80% of quota and BestEffort pods in production`,
        hints: [
          'Namespace labels are NOT automatically propagated to pods',
          'For automatic enforcement, use OPA/Gatekeeper (Kyverno is an alternative)',
          'PrometheusRule needs labels matching the Prometheus ruleSelector'
        ],
        solution: `\`\`\`bash
# Create namespace with billing labels
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

# Deploy with complete labels
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

# Create cost alerts
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

        - alert: BestEffortPodsDetected
          expr: |
            kube_pod_status_qos_class{qos_class="besteffort", namespace=~"production|staging|team-.*"} > 0
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "BestEffort pod {{ \$labels.pod }} in {{ \$labels.namespace }}"
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify namespace with labels
kubectl get namespace team-payments -o yaml | grep -A10 "labels:"
# Expected: team, environment, cost-center, business-unit

# Verify deployment with labels
kubectl get deployment payment-api -n team-payments -o json | \\
  jq '.metadata.labels, .spec.template.metadata.labels'
# Expected: labels present in both

# Verify QoS of pods
kubectl get pods -n team-payments -o json | \\
  jq '.items[] | {name: .metadata.name, qos: .status.qosClass}'
# Expected: Burstable (requests < limits)

# Verify PrometheusRule created
kubectl get prometheusrule cost-governance-alerts -n monitoring
# Expected: cost-governance-alerts   Xm
\`\`\``
      },
      {
        title: 'Calculate and Generate Cost Report by Team',
        instruction: `Create a resource consumption report by team using labels. This report simulates the monthly showback that would be sent to teams.

Calculate:
1. Total CPU requests by \`team\` label
2. Total memory requests by \`team\` label
3. Number of pods per namespace
4. Simplified cost estimate (CPU requests × $0.048/hour)`,
        hints: [
          'Use kubectl get pods with -o json and jq for aggregation',
          'CPU in millicores needs to be converted to cores (divide by 1000)',
          'For real cost, use Kubecost API or OpenCost — here we do an approximation'
        ],
        solution: `\`\`\`bash
#!/bin/bash
# Simplified cost report by team

echo "========================================"
echo "   KUBERNETES COST REPORT (Showback)"
echo "   Date: \$(date +%Y-%m-%d)"
echo "========================================"
echo ""

echo "--- CPU REQUESTS BY TEAM ---"
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
    if (cpu ~ /m/) { gsub(/m/, "", cpu); }
    else { cpu = cpu * 1000; }
    total[team] += cpu
  }
  END {
    for (t in total) {
      cores = total[t] / 1000
      cost = cores * 0.048 * 720
      printf "Team: %-20s CPU: %6.2f cores  Est. Cost/month: \$%.2f\n", t, cores, cost
    }
  }' | sort -k8 -rn

echo ""
echo "--- PODS BY NAMESPACE ---"
kubectl get pods --all-namespaces --no-headers 2>/dev/null | \\
  awk '{ns[\$1]++} END {for (n in ns) printf "%-40s %d pods\n", n, ns[n]}' | \\
  sort -k2 -rn | head -15
\`\`\``,
        verify: `\`\`\`bash
# Verify script generates output
kubectl get pods --all-namespaces -o json | \\
  jq '[.items[] | select(.status.phase=="Running") | .metadata.labels.team // "UNTAGGED"] |
    group_by(.) | .[] | {team: .[0], count: length}'
# Expected: list of teams with pod count

# Verify pods by namespace
kubectl get pods --all-namespaces --no-headers | \\
  awk '{print \$1}' | sort | uniq -c | sort -rn | head -10
# Expected: namespaces with pod count

# Verify PVCs
kubectl get pvc --all-namespaces | grep -c Bound
# Expected: number of bound PVCs in cluster
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Cluster costs growing without explanation',
      difficulty: 'medium',
      symptom: 'Cluster costs increased 40% last month. No known production changes. The finance team is questioning the spending.',
      diagnosis: `\`\`\`bash
# View top resource consuming pods
kubectl top pods --all-namespaces --sort-by=cpu | head -20
kubectl top pods --all-namespaces --sort-by=memory | head -20

# Check for new namespaces
kubectl get namespaces --sort-by=.metadata.creationTimestamp

# Check deployments with high replica count
kubectl get deployments --all-namespaces -o json | \\
  jq '.items[] | select(.spec.replicas > 5) | {
    ns: .metadata.namespace,
    name: .metadata.name,
    replicas: .spec.replicas
  }'

# Check recently created PVCs
kubectl get pvc --all-namespaces --sort-by=.metadata.creationTimestamp | tail -20

# Check recently added nodes
kubectl get nodes --sort-by=.metadata.creationTimestamp
\`\`\``,
      solution: `**Systematic investigation**:

**1. Check if HPA scaled too many pods**:
\`\`\`bash
kubectl get hpa --all-namespaces
# Compare CURRENT vs DESIRED replicas
# If very high, investigate if threshold is correct
\`\`\`

**2. Check incomplete batch jobs**:
\`\`\`bash
kubectl get jobs --all-namespaces | grep -v Complete
# Stuck jobs = ongoing cost
kubectl delete jobs --field-selector status.successful=0 -n my-namespace
\`\`\`

**3. Check new namespace or team without quotas**:
\`\`\`bash
kubectl get namespaces -o json | \\
  jq -r '.items[] | select(.metadata.labels["cost-center"] == null) | .metadata.name'
# Namespaces without quota = can consume unlimited resources
\`\`\`

**4. Check Cluster Autoscaler added too many nodes**:
\`\`\`bash
kubectl get nodes -o json | jq '.items | length'
kubectl logs -n kube-system -l app=cluster-autoscaler | grep "scale-up" | tail -20
\`\`\`

**5. Use Kubecost for detailed cost analysis**:
\`\`\`bash
# Cost by namespace for last 7 days
curl "http://localhost:9090/model/allocation?window=7d&aggregate=namespace" | jq '.data'
\`\`\``
    },
    {
      title: 'Spot nodes causing frequent workload failures',
      difficulty: 'hard',
      symptom: 'Since migrating some Deployments to spot nodes to reduce costs, there are 3-5 interruptions per day. Pods are abruptly terminated and clients report 503 errors.',
      diagnosis: `\`\`\`bash
# View eviction history
kubectl get events --all-namespaces --sort-by=.lastTimestamp | \\
  grep -i "spot\\|preempt\\|evict\\|interrupt" | tail -20

# Check if pods have PodDisruptionBudget
kubectl get pdb --all-namespaces

# Check if affected pods have graceful termination configured
kubectl get deployment affected-app -o yaml | \\
  grep -A5 "terminationGracing\\|preStop\\|lifecycle"

# View spot nodes and when created/destroyed
kubectl get nodes -l karpenter.sh/capacity-type=spot
kubectl describe nodes -l karpenter.sh/capacity-type=spot | grep -A5 "Taints"

# Check if there are enough replicas to tolerate interruptions
kubectl get deployment affected-app -o json | \\
  jq '.spec.replicas, .status.availableReplicas'
\`\`\``,
      solution: `**Cause 1**: Stateful workload on spot node — move to on-demand.
\`\`\`bash
# Add nodeAffinity to avoid spot nodes
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

**Cause 2**: Graceful shutdown not properly configured.
\`\`\`yaml
# Add to container spec
lifecycle:
  preStop:
    exec:
      command: ["sh", "-c", "sleep 15"]  # time for load balancer to remove
terminationGracePeriodSeconds: 30
\`\`\`

**Cause 3**: Missing PodDisruptionBudget.
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
  minAvailable: 2   # always keep at least 2 pods
EOF
\`\`\``
    }
  ]
};
