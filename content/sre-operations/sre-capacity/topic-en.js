window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['sre-operations/sre-capacity'] = {
  theory: `
# Capacity Planning & Performance — Sizing and Optimization

## Relevance
Capacity planning is the art of ensuring sufficient resources for your service to run reliably without wasting money on over-provisioning. In Kubernetes, this involves requests/limits, autoscaling, rightsizing, and forecasting — essential skills for any SRE.

## Core Concepts

### Requests vs Limits

\`\`\`
Requests: resources GUARANTEED to the container
  - Used by the scheduler to decide where to place the pod
  - Container will always have at least this much

Limits: MAXIMUM resources the container can use
  - CPU: throttled (not killed) if exceeded
  - Memory: OOMKilled if exceeded

Rule of thumb:
  requests = average usage (p50)
  limits = peak usage (p99) + margin
\`\`\`

### QoS Classes

\`\`\`yaml
# Guaranteed: requests == limits (highest priority)
resources:
  requests:
    cpu: 500m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 256Mi

# Burstable: requests < limits (medium priority)
resources:
  requests:
    cpu: 250m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

# BestEffort: no requests or limits (first to die)
# Not recommended for production!
\`\`\`

| QoS Class | Eviction Priority | When to use |
|-----------|-------------------|-------------|
| **Guaranteed** | Last to be evicted | Critical services (DB, main API) |
| **Burstable** | Second | Services with variable load |
| **BestEffort** | First | Dev/test only, never production |

### LimitRange and ResourceQuota

\`\`\`yaml
# LimitRange: default limits per container in namespace
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
# ResourceQuota: total limits for the namespace
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

VPA automatically adjusts requests/limits based on actual usage.

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
    updateMode: "Off"  # Off = only recommends, doesn't apply
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

**VPA Modes:**

| Mode | Action |
|------|--------|
| **Off** | Only generates recommendations (safe for production) |
| **Initial** | Applies when creating pods, doesn't update existing ones |
| **Auto** | Applies and restarts pods to adjust (careful in prod!) |

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
Pod pending (no node with resources)
  → Cluster Autoscaler adds a node
  → Pod is scheduled on the new node

Node underutilized (< 50% usage)
  → Cluster Autoscaler removes node
  → Pods are rescheduled on other nodes
\`\`\`

### Load Testing

\`\`\`bash
# k6 — basic load test
k6 run --vus 50 --duration 5m script.js

# hey — HTTP load generator
hey -n 10000 -c 100 -z 5m http://api.example.com/endpoint

# Inside the cluster
kubectl run load-test --image=williamyeh/hey --rm -it -- \\
  -n 10000 -c 50 http://api-server.production.svc.cluster.local/api
\`\`\`

### Rightsizing Workflow

\`\`\`
1. Collect usage metrics (7-30 days)
2. Analyze p50 (average) and p99 (peak)
3. Set requests = p50 + 20% margin
4. Set limits = p99 + 30% margin
5. Apply and monitor for 7 days
6. Adjust if necessary
7. Repeat quarterly
\`\`\`

**Goldilocks (rightsizing tool):**
\`\`\`bash
# Install Goldilocks
helm install goldilocks fairwinds-stable/goldilocks --namespace goldilocks --create-namespace

# Enable for namespace
kubectl label namespace production goldilocks.fairwinds.com/enabled=true

# Access dashboard
kubectl port-forward svc/goldilocks-dashboard -n goldilocks 8080:80
\`\`\`

### Capacity Forecasting

\`\`\`
Techniques:
  Linear regression:  project growth based on trend
  Seasonal patterns:  adjust for known peaks (Black Friday, etc.)
  Buffer planning:    maintain 30-40% headroom for spikes

PromQL for forecasting:
  # Project disk usage in 7 days
  predict_linear(node_filesystem_free_bytes[7d], 7*24*3600)

  # Project CPU usage in 30 days
  predict_linear(node_cpu_seconds_total[30d], 30*24*3600)
\`\`\`

### Cost Optimization

\`\`\`
Strategies:
  1. Rightsizing: adjust requests/limits to actual usage
  2. Spot/Preemptible nodes: interruption-tolerant workloads
  3. Node pools: separate by workload type
  4. Bin-packing: maximize node utilization
  5. Namespace quotas: limit consumption per team
  6. Idle resources: identify and remove
\`\`\`

## Essential Commands

\`\`\`bash
# Cluster resources
kubectl top nodes
kubectl describe nodes | grep -A5 "Allocated resources"

# Pod resources
kubectl top pods -n production --sort-by=cpu
kubectl top pods -n production --sort-by=memory

# Check requests/limits
kubectl get pods -n production -o jsonpath='{range .items[*]}{.metadata.name}: cpu={.spec.containers[0].resources.requests.cpu}, mem={.spec.containers[0].resources.requests.memory}{"\\n"}{end}'

# Check quotas
kubectl get resourcequota -n production
kubectl describe resourcequota production-quota -n production

# Check LimitRange
kubectl get limitrange -n production
kubectl describe limitrange default-limits -n production

# VPA recommendations
kubectl get vpa -n production
kubectl describe vpa api-vpa -n production

# HPA status
kubectl get hpa -n production
kubectl describe hpa api-hpa -n production
\`\`\`

## Common Mistakes

1. **No requests/limits**: Pods without requests may be scheduled on saturated nodes. Without limits, they can consume all node resources.
2. **Requests too high**: Over-provisioning wastes money. Use real data to size properly.
3. **Limits too low**: Causes OOMKilled and excessive throttling. Monitor and adjust.
4. **HPA + VPA together**: VPA Auto + HPA on the same metric (CPU) conflict. Use VPA Off + HPA, or VPA on memory + HPA on CPU.
5. **No headroom**: Cluster without room for spikes causes pod pending. Maintain 30-40% headroom.
6. **No load testing**: Without load testing, you don't know the service's limit until it breaks in production.

## Killer.sh Style Challenge

**Scenario:** Size and optimize resources for a production service in Kubernetes.

**Tasks:**
1. Configure LimitRange and ResourceQuota for the namespace
2. Set up VPA in Off mode to get recommendations
3. Configure HPA with custom metrics
4. Run load test and adjust resources based on results
5. Configure capacity alerts (disk, memory, CPU)
`,
  quiz: [
    {
      question: 'What is the difference between requests and limits in Kubernetes?',
      options: [
        'They are the same thing — just different names',
        'Requests are guaranteed resources (used by scheduler); limits are the maximum a container can use',
        'Requests are for CPU, limits are for memory',
        'Requests are optional, limits are mandatory'
      ],
      correct: 1,
      explanation: 'Requests are guaranteed resources — the scheduler uses them to decide which node to place the pod on. Limits are the maximum: CPU is throttled (slowed down) and memory causes OOMKilled if the limit is exceeded. Rule of thumb: requests = average usage (p50), limits = peak (p99) + margin.',
      reference: 'Related concept: sre-capacity — QoS class is determined by the relationship between requests and limits.'
    },
    {
      question: 'Which QoS class has the highest priority and is last to be evicted?',
      options: [
        'BestEffort',
        'Burstable',
        'Guaranteed — when requests == limits for all containers',
        'Premium'
      ],
      correct: 2,
      explanation: 'Guaranteed QoS is assigned when requests == limits for both CPU and memory in all containers of the pod. It is the last to be evicted under resource pressure. Burstable (requests < limits) is second, BestEffort (no requests/limits) is first to be evicted.',
      reference: 'Related concept: sre-capacity — use Guaranteed for critical services like databases.'
    },
    {
      question: 'What happens when a container exceeds its CPU limit?',
      options: [
        'The pod is restarted (OOMKilled)',
        'The container is throttled — its processing speed is reduced, but it is not killed',
        'The node is restarted',
        'Nothing happens'
      ],
      correct: 1,
      explanation: 'CPU limit causes throttling: the container has its CPU time limited, resulting in slower processing. Unlike memory, where exceeding the limit causes OOMKilled (the container is killed). For this reason, many teams remove CPU limits and keep only requests.',
      reference: 'Related concept: sre-capacity — CPU throttling can cause unexpected latency.'
    },
    {
      question: 'Which VPA mode is safe to use in production initially?',
      options: [
        'Auto — applies and restarts pods automatically',
        'Initial — applies only when creating new pods',
        'Off — only generates recommendations without changing anything, allowing analysis before applying',
        'Recreate — recreates all pods'
      ],
      correct: 2,
      explanation: 'VPA in Off mode only generates recommendations based on actual usage without changing anything. It is the safest mode to start with in production — analyze the recommendations, compare with current values, and apply manually. Auto mode restarts pods to apply changes, which can cause disruption.',
      reference: 'Related concept: sre-toil-automation — VPA Off + manual application is semi-automation.'
    },
    {
      question: 'Why do HPA and VPA (Auto mode) on the same metric (CPU) conflict?',
      options: [
        'They do not conflict — they can be used together',
        'Because VPA changes CPU requests, which changes the HPA utilization calculation, creating an unstable feedback loop',
        'Because Kubernetes does not allow both in the same namespace',
        'Because HPA automatically disables VPA'
      ],
      correct: 1,
      explanation: 'If VPA increases CPU request from 100m to 200m, HPA calculates utilization as lower (same usage / larger request = lower %). This can cause HPA to scale down. This creates an unstable loop. Solution: use VPA Off + HPA, or VPA on memory + HPA on CPU.',
      reference: 'Related concept: sre-capacity — combine HPA and VPA carefully using different metrics.'
    },
    {
      question: 'What is the purpose of ResourceQuota?',
      options: [
        'Defines default limits per container',
        'Defines total resource limits that an entire namespace can consume, preventing a team from monopolizing the cluster',
        'Defines CPU limits per node',
        'Defines the maximum number of clusters'
      ],
      correct: 1,
      explanation: 'ResourceQuota defines aggregate limits for the namespace: total CPU requests/limits, memory, number of pods, PVCs, etc. It prevents one namespace/team from consuming all cluster resources. LimitRange defines per-container limits (default, min, max). Both are complementary.',
      reference: 'Related concept: sre-capacity — LimitRange defines per container, ResourceQuota defines per namespace.'
    },
    {
      question: 'What is the purpose of predict_linear in PromQL for capacity planning?',
      options: [
        'Calculates the average of a metric',
        'Projects the future value of a metric based on the current linear trend, allowing prediction of when a resource will be exhausted',
        'Automatically creates alerts',
        'Compares metrics between clusters'
      ],
      correct: 1,
      explanation: 'predict_linear(metric[range], seconds) extrapolates the linear trend of the metric and projects the future value. Example: predict_linear(node_filesystem_free_bytes[7d], 30*24*3600) projects disk space in 30 days. Essential for alerting about resource exhaustion before it happens.',
      reference: 'Related concept: sre-observability — use predict_linear in proactive capacity alerts.'
    }
  ],
  flashcards: [
    {
      front: 'Requests vs Limits in Kubernetes?',
      back: '**Requests (guaranteed):**\n- Scheduler uses to position pod\n- Container will always have these resources\n- Size: p50 (average usage) + 20%\n\n**Limits (maximum):**\n- CPU: throttled if exceeded (not killed)\n- Memory: OOMKilled if exceeded\n- Size: p99 (peak) + 30%\n\n**QoS Classes:**\n- Guaranteed: requests == limits\n- Burstable: requests < limits\n- BestEffort: no requests/limits\n\n**Rule:** always set requests.\nCPU limits are optional\n(many teams remove CPU limits).'
    },
    {
      front: 'LimitRange vs ResourceQuota?',
      back: '**LimitRange (per container):**\n```yaml\nspec:\n  limits:\n    - type: Container\n      default:\n        cpu: 500m\n        memory: 256Mi\n      defaultRequest:\n        cpu: 100m\n      max:\n        cpu: \"2\"\n      min:\n        cpu: 50m\n```\nDefines default, min, and max\n\n**ResourceQuota (per namespace):**\n```yaml\nspec:\n  hard:\n    requests.cpu: \"20\"\n    requests.memory: 40Gi\n    pods: \"100\"\n```\nLimits namespace total\n\n**Complementary:**\nLimitRange = per container\nResourceQuota = namespace total'
    },
    {
      front: 'VPA — modes and when to use?',
      back: '**Off (recommended initially):**\n- Only generates recommendations\n- Does not change anything\n- Safe for production\n\n**Initial:**\n- Applies when creating new pods\n- Does not update existing pods\n- Moderately safe\n\n**Auto:**\n- Applies and RESTARTS pods\n- Can cause disruption\n- Careful in production\n\n**HPA+VPA conflict:**\n- VPA Auto + HPA on same metric\n  = unstable loop\n- Solution: VPA Off + HPA\n  or VPA (mem) + HPA (cpu)\n\n**Recommendation:**\nStart with Off, analyze,\napprove manually'
    },
    {
      front: 'HPA behavior policies?',
      back: '**ScaleUp (fast):**\n```yaml\nbehavior:\n  scaleUp:\n    stabilizationWindowSeconds: 30\n    policies:\n      - type: Percent\n        value: 100  # doubles at once\n        periodSeconds: 60\n```\n\n**ScaleDown (slow):**\n```yaml\n  scaleDown:\n    stabilizationWindowSeconds: 300\n    policies:\n      - type: Percent\n        value: 10  # max -10% at a time\n        periodSeconds: 120\n```\n\n**Metrics:**\n- Resource: CPU, memory\n- Pods: custom metrics per pod\n- Object: metrics from another object\n- External: external metrics'
    },
    {
      front: 'Rightsizing workflow?',
      back: '**Steps:**\n1. Collect metrics (7-30 days)\n2. Analyze p50 and p99\n3. requests = p50 + 20% margin\n4. limits = p99 + 30% margin\n5. Apply and monitor for 7 days\n6. Adjust if necessary\n7. Repeat quarterly\n\n**Tools:**\n- VPA (Off mode) for recommendations\n- Goldilocks for visual dashboard\n- kubectl top for current usage\n\n**PromQL for analysis:**\n```\n# Average CPU usage (p50)\nquantile(0.5,\n  rate(container_cpu_usage[24h]))\n\n# Peak memory (p99)\nquantile(0.99,\n  container_memory_working_set_bytes)\n```'
    },
    {
      front: 'Capacity forecasting with PromQL?',
      back: '**predict_linear:**\nProjects future value based\non linear trend\n\n**Disk full in 30 days?**\n```promql\npredict_linear(\n  node_filesystem_free_bytes[7d],\n  30*24*3600\n) < 0\n```\n\n**Proactive alert:**\n```yaml\n- alert: DiskWillFillIn30Days\n  expr: |\n    predict_linear(\n      node_filesystem_free_bytes[7d],\n      30*24*3600\n    ) < 0\n  for: 1h\n  labels:\n    severity: warning\n```\n\n**Headroom:**\nMaintain 30-40% free space\nto absorb spikes and growth'
    },
    {
      front: 'Cost optimization in K8s?',
      back: '**1. Rightsizing:**\nAdjust requests/limits to actual usage\n→ Eliminate over-provisioning\n\n**2. Spot/Preemptible nodes:**\nInterruption-tolerant workloads\n→ 60-80% cheaper\n\n**3. Node pools:**\nSeparate by workload type\n→ CPU-intensive vs memory-intensive\n\n**4. Bin-packing:**\nMaximize node utilization\n→ Reduce idle nodes\n\n**5. Namespace quotas:**\nLimit consumption per team\n→ Accountability\n\n**6. Idle resources:**\n- Deployments with 0 replicas\n- Unused PVCs\n- Inactive dev namespaces'
    }
  ],
  lab: {
    scenario: 'You need to properly size the resources of a production service and configure autoscaling to ensure adequate capacity.',
    objective: 'Configure LimitRange, ResourceQuota, VPA, and HPA for a production service.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Configure Resource Governance',
        instruction: `Configure LimitRange and ResourceQuota for the production namespace.

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
          'LimitRange defines default values — pods without requests/limits receive these values',
          'ResourceQuota limits the namespace total — prevents resource monopoly',
          'LimitRange min and max reject pods outside those limits'
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
# Expected output: NAME                CREATED AT
#                  production-limits   ...

kubectl describe resourcequota production-quota -n production
# Expected output: Used vs Hard for each resource
\`\`\``
      },
      {
        title: 'Configure VPA for Recommendations',
        instruction: `Set up VPA in Off mode to get rightsizing recommendations.

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
          'Off mode is safe — it only recommends, never changes pods',
          'After installing, wait 24h for accurate recommendations',
          'VPA requires the VPA controller installed in the cluster'
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
# Expected output: NAME      MODE   CPU   MEM   PROVIDED   AGE
#                  api-vpa   Off    ...   ...   True       Xs

# View recommendations (may take a few minutes)
kubectl describe vpa api-vpa -n production | grep -A10 "Recommendation"
# Expected output: Target, LowerBound, UpperBound for CPU and Memory
\`\`\``
      },
      {
        title: 'Configure Capacity Alerts',
        instruction: `Create proactive capacity alerts using predict_linear.

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
        # Disk will fill in 7 days
        - alert: DiskWillFillIn7Days
          expr: |
            predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[7d], 7*24*3600) < 0
          for: 1h
          labels:
            severity: warning
          annotations:
            summary: "Disk on {{ \$labels.instance }} will fill in 7 days"
            runbook_url: "https://wiki/runbooks/disk-capacity"

        # Namespace using > 80% of CPU quota
        - alert: NamespaceQuotaNearLimit
          expr: |
            kube_resourcequota{type="used"} / kube_resourcequota{type="hard"} > 0.8
          for: 15m
          labels:
            severity: warning
          annotations:
            summary: "Namespace {{ \$labels.namespace }} using > 80% of {{ \$labels.resource }} quota"

        # Cluster with low available resources
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
          'predict_linear projects future trends based on historical data',
          'Proactive alerts allow you to act BEFORE running out of resources',
          'Combine with ResourceQuota alerts for namespace governance'
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
# Expected output: NAME               AGE
#                  capacity-alerts    Xs

kubectl get prometheusrule capacity-alerts -n monitoring -o jsonpath='{.spec.groups[0].rules[*].alert}'
# Expected output: DiskWillFillIn7Days NamespaceQuotaNearLimit ClusterCPUHighUtilization
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pods in constant OOMKilled',
      difficulty: 'medium',
      symptom: 'Pods are being restarted with OOMKilled status. The service is unstable with CrashLoopBackOff.',
      diagnosis: `\`\`\`bash
# Check pod status
kubectl describe pod <pod> -n production | grep -A5 "Last State"

# Check current limits
kubectl get pod <pod> -n production -o jsonpath='{.spec.containers[0].resources}'

# Check actual memory usage
kubectl top pod <pod> -n production

# Check VPA recommendation
kubectl describe vpa api-vpa -n production | grep -A5 "Target"
\`\`\``,
      solution: `**Solutions:**

1. **Increase memory limit:**
\`\`\`bash
kubectl set resources deployment/<name> -n production --limits=memory=512Mi
\`\`\`

2. **Use VPA to find correct value:**
\`\`\`bash
kubectl describe vpa api-vpa -n production
# Use "Target" as new request and "Upper Bound" as limit
\`\`\`

3. **Investigate memory leak:** If usage grows continuously, there may be a leak in the application. Use profiling.

4. **Set appropriate requests:** requests should be p50 of actual usage, limits p99 + margin.`
    },
    {
      title: 'Pods Pending — no resources in cluster',
      difficulty: 'easy',
      symptom: 'New pods remain in Pending state with event "Insufficient cpu" or "Insufficient memory". The cluster has no capacity.',
      diagnosis: `\`\`\`bash
# Check pod events
kubectl describe pod <pod> -n production | grep -A5 Events

# Check available resources on nodes
kubectl describe nodes | grep -A5 "Allocated resources"

# Check cluster utilization
kubectl top nodes
\`\`\``,
      solution: `**Solutions:**

1. **Add nodes:** If there is no Cluster Autoscaler, add nodes manually.

2. **Cluster Autoscaler:** Configure to scale automatically:
\`\`\`bash
# Cluster Autoscaler adds nodes when there are Pending pods
\`\`\`

3. **Rightsizing:** If nodes have allocated resources but little actual use, requests are too high. Use VPA to adjust.

4. **Evict BestEffort pods:** Pods without requests/limits can be evicted to free space:
\`\`\`bash
kubectl get pods -A -o json | jq '.items[] | select(.status.qosClass=="BestEffort") | .metadata.name'
\`\`\`

5. **ResourceQuota:** If the namespace is at quota limit, increase or redistribute.`
    },
    {
      title: 'Over-provisioning — cluster with low utilization but high cost',
      difficulty: 'hard',
      symptom: 'The cluster has average utilization of only 20-30% but costs are high. Many nodes are underutilized.',
      diagnosis: `\`\`\`bash
# Check actual vs allocated utilization
kubectl top nodes
kubectl describe nodes | grep -E "cpu|memory" | head -20

# Check requests vs actual usage
kubectl top pods -A --sort-by=cpu | head -20

# Calculate efficiency
# (actual usage / requests) * 100 = efficiency %
\`\`\``,
      solution: `**Optimization strategy:**

1. **VPA for rightsizing:** Use VPA in Off mode to get recommendations and adjust requests:
\`\`\`bash
kubectl get vpa -A -o yaml | grep -A3 "target"
\`\`\`

2. **Goldilocks:** Install for dashboard visualization of recommendations.

3. **Cluster Autoscaler:** Configure to remove underutilized nodes:
   - scale-down-utilization-threshold: 0.5
   - scale-down-delay-after-add: 10m

4. **Spot nodes for tolerant workloads:** Use spot/preemptible nodes for batch jobs, CronJobs, and dev/staging.

5. **Quarterly review:** Schedule rightsizing review every 3 months.`
    }
  ]
};
