window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['finops/k8s-cost-management'] = {
  theory: `# Kubernetes Cost Management

## Exam Relevance
> Cost management in Kubernetes is essential for KubeAstronaut and Platform Engineering roles. Covers everything from ResourceQuota and LimitRange to tools like Kubecost and Goldilocks for right-sizing.

## Core Concepts

### Why Are Kubernetes Costs Complex?
Unlike traditional VMs, Kubernetes introduces unique cost challenges:
- **Shared resources**: multiple workloads share nodes
- **Bin packing**: not all resources are always used
- **Over-provisioning**: the most common anti-pattern — setting requests too high
- **Under-utilization**: low requests → scheduler packs workloads on same node → OOM Kill

### Resource Requests vs Limits

\`\`\`
         CPU                    Memory
         ┌──────────────────────────────────┐
Request  │ Minimum guarantee │ Minimum guarantee │ ← used by scheduler
Limit    │ Maximum cap       │ Maximum cap        │ ← CPU: throttle | Mem: OOMKill
         └──────────────────────────────────┘
\`\`\`

**Golden rules**:
- Request = real average usage (p50 of usage)
- Limit memory = 2x the request (headroom for peaks)
- Limit CPU = can be left unset (throttling > OOMKill)
- Never set requests = 0 (scheduler can't plan)

### QoS Classes and Cost Impact

| QoS Class | Condition | Behavior under pressure |
|-----------|-----------|------------------------|
| Guaranteed | requests == limits (both set) | Last to be evicted |
| Burstable | requests < limits | Evicted by priority |
| BestEffort | no requests or limits | First to be evicted |

### LimitRange — Namespace Defaults
Sets default values and maximum limits for containers that don't specify resources:

\`\`\`yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: my-team
spec:
  limits:
    - type: Container
      default:           # Default limit if not specified
        cpu: 500m
        memory: 512Mi
      defaultRequest:    # Default request if not specified
        cpu: 100m
        memory: 128Mi
      max:               # Maximum allowed limit
        cpu: "4"
        memory: 4Gi
      min:               # Required minimum
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

### ResourceQuota — Namespace Limits
Controls total resource consumption within a namespace:

\`\`\`yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: my-team
spec:
  hard:
    # Compute
    requests.cpu: "10"      # total CPU requests
    requests.memory: 20Gi   # total memory requests
    limits.cpu: "20"
    limits.memory: 40Gi

    # Objects
    pods: "50"
    services: "10"
    services.loadbalancers: "2"
    persistentvolumeclaims: "20"
    requests.storage: 100Gi

    # Per storage class
    standard.storageclass.storage.k8s.io/requests.storage: 50Gi
    premium.storageclass.storage.k8s.io/requests.storage: 10Gi

    # Resource count by type
    count/deployments.apps: "20"
    count/configmaps: "50"
\`\`\`

### Kubecost — Cost Visibility
Kubecost is the reference tool for cost allocation in Kubernetes:

\`\`\`
Kubecost collects:
  - Real CPU/memory usage per pod
  - PVC usage and storage cost
  - Network cost (egress)
  - Node prices (spot, on-demand, reserved)

Kubecost generates:
  - Cost per namespace/deployment/label/team
  - Savings recommendations
  - Anomaly detection
  - Budget alerts
\`\`\`

### Goldilocks — Automatic Right-Sizing
Goldilocks uses VPA (Vertical Pod Autoscaler) in recommendation mode to suggest ideal resources:

\`\`\`bash
# Enable Goldilocks for a namespace
kubectl label namespace my-team goldilocks.fairwinds.com/enabled=true

# Goldilocks creates VPAs and collects recommendations
# Dashboard shows: current request vs recommended vs cost difference
\`\`\`

### Node Right-Sizing with Kubecost
\`\`\`
Kubecost cluster right-sizing:
- Analyzes packing efficiency of each node pool
- Suggests smaller instance types when utilization < 60%
- Calculates spot vs on-demand savings potential
- Integrates with Cluster Autoscaler for node group suggestions
\`\`\`

## Essential Commands

### Check Resource Usage
\`\`\`bash
# Top consumption by node
kubectl top nodes

# Top consumption by pod (all namespaces)
kubectl top pods --all-namespaces --sort-by=cpu
kubectl top pods --all-namespaces --sort-by=memory

# View requests and limits for all pods in a namespace
kubectl get pods -n my-team -o json | \\
  jq '.items[] | {
    name: .metadata.name,
    cpu_req: .spec.containers[0].resources.requests.cpu,
    mem_req: .spec.containers[0].resources.requests.memory,
    cpu_lim: .spec.containers[0].resources.limits.cpu,
    mem_lim: .spec.containers[0].resources.limits.memory
  }'

# Pods without resource requests (cost risk)
kubectl get pods --all-namespaces -o json | \\
  jq '.items[] | select(
    .spec.containers[0].resources.requests == null or
    .spec.containers[0].resources.requests.cpu == null
  ) | {ns: .metadata.namespace, name: .metadata.name}'
\`\`\`

### Check Quotas and Limits
\`\`\`bash
# View ResourceQuota and current usage
kubectl describe resourcequota -n my-team

# View LimitRange
kubectl describe limitrange -n my-team

# View all ResourceQuotas in cluster
kubectl get resourcequota --all-namespaces

# Check quota usage percentage
kubectl get resourcequota -n my-team -o json | \\
  jq '.items[0].status | {
    hard: .hard,
    used: .used
  }'
\`\`\`

### Install Kubecost
\`\`\`bash
# Via Helm
helm repo add kubecost https://kubecost.github.io/cost-analyzer
helm repo update

helm install kubecost kubecost/cost-analyzer \\
  --namespace kubecost \\
  --create-namespace \\
  --set kubecostToken="TOKEN" \\
  --set prometheus.enabled=true \\
  --set grafana.enabled=false

# Access dashboard
kubectl port-forward -n kubecost svc/kubecost-cost-analyzer 9090:9090

# View recommendations via API
curl http://localhost:9090/model/savings/requestSizing | jq '.'
\`\`\`

### Install Goldilocks
\`\`\`bash
# Install VPA (prerequisite)
helm repo add fairwinds-stable https://charts.fairwinds.com/stable
helm install vpa fairwinds-stable/vpa --namespace vpa --create-namespace

# Install Goldilocks
helm install goldilocks fairwinds-stable/goldilocks \\
  --namespace goldilocks \\
  --create-namespace

# Enable for namespace
kubectl label namespace production goldilocks.fairwinds.com/enabled=true

# Access dashboard
kubectl port-forward -n goldilocks svc/goldilocks-dashboard 8080:80
\`\`\`

## YAML Examples

### LimitRange for Development Namespace
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

### ResourceQuota per Team (Multi-tenancy)
\`\`\`yaml
# Backend team namespace
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
\`\`\`

### VPA for Right-Sizing
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
    updateMode: "Off"   # Recommendations only, no pod updates
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

## Common Mistakes

### 1. All pods BestEffort (no requests)
**Cause**: LimitRange not configured and developers don't define resources.
**Impact**: Critical workloads evicted during spikes; invisible costs.
**Fix**: Implement LimitRange with mandatory defaultRequest.

### 2. Requests too high (over-provisioning)
**Cause**: Developers "just in case" set requests 3-5x the real usage.
**Impact**: Nodes with high apparent utilization but low real usage = expensive idle nodes.
**Fix**: Use Goldilocks to recommend requests based on historical usage.

### 3. ResourceQuota blocks deployments without clear warning
**Cause**: CPU/pod quota reached; new deployment stays in Pending.
**Fix**: Monitor quota alerts (\`kubectl describe resourcequota\`) and configure alerts in Kubecost.

### 4. VPA and HPA on the same Deployment
**Cause**: VPA and HPA try to adjust the same Deployment simultaneously.
**Fix**: Don't use VPA mode "Auto" with HPA on the same Deployment. Use KEDA with HPA OR VPA in "Off" mode (recommendation only).

### 5. LimitRange doesn't apply retroactively
**Cause**: LimitRange only applies to pods created after its creation.
**Fix**: Do rollout restart on Deployments after creating LimitRange to apply defaults.

## Killer.sh Style Challenge

**Context**: The production cluster has costs growing 30% per month unexplained. As Platform Engineer, you need to:
1. Identify the 5 namespaces with highest CPU consumption
2. Identify pods without resource requests in the \`production\` namespace
3. Create a LimitRange in the \`staging\` namespace with 100m CPU and 128Mi memory requests
4. Create a ResourceQuota in the \`team-alpha\` namespace limiting to 10 CPU requests and 20Gi memory requests
5. Verify no pod in the \`critical\` namespace has BestEffort QoS`,

  quiz: [
    {
      question: 'Which QoS class is assigned to a pod that has requests equal to limits for both CPU and memory?',
      options: [
        'BestEffort',
        'Burstable',
        'Guaranteed',
        'Premium'
      ],
      correct: 2,
      explanation: 'Guaranteed is assigned when BOTH CPU and memory have requests defined AND equal to limits. These pods are the last to be evicted under node memory pressure.',
      reference: 'Concept: QoS Classes — "QoS Classes and Cost Impact" section in theory.'
    },
    {
      question: 'What is the effect of NOT defining resource requests on a container?',
      options: [
        'The container automatically gets half the node resources',
        'The container is classified as BestEffort and evicted first under pressure',
        'Kubernetes refuses to create the pod due to missing specification',
        'The container inherits namespace resources'
      ],
      correct: 1,
      explanation: 'Without requests, the pod is classified as BestEffort — the lowest priority. The kubelet will evict these pods first when a node runs out of memory. Additionally, the scheduler cannot do efficient placement, leading to over-provisioning.',
      reference: 'Concept: QoS without requests — "QoS Classes and Cost Impact" section in theory.'
    },
    {
      question: 'What does LimitRange.spec.limits[].defaultRequest do?',
      options: [
        'Defines the maximum resources a container can have',
        'Defines the default request applied to containers that don\'t specify resources',
        'Defines resources reserved for the entire namespace',
        'Configures the minimum resource request for PVCs'
      ],
      correct: 1,
      explanation: 'defaultRequest defines the resources.requests values that are automatically injected into containers that don\'t specify any request. This ensures all pods have requests defined even if the developer doesn\'t specify them.',
      reference: 'Config: LimitRange defaultRequest — "LimitRange — Namespace Defaults" section in theory.'
    },
    {
      question: 'Which tool uses VPA in recommendation mode to suggest container right-sizing?',
      options: [
        'Kubecost',
        'Prometheus',
        'Goldilocks',
        'Vertical Scaler'
      ],
      correct: 2,
      explanation: 'Goldilocks (by Fairwinds) creates VPA objects for each Deployment in enabled namespaces and collects VPA recommendations. A dashboard shows current vs recommended requests, making right-sizing easy without immediate automation.',
      reference: 'Tool: Goldilocks — "Goldilocks — Automatic Right-Sizing" section in theory.'
    },
    {
      question: 'What is the risk of using VPA mode "Auto" alongside an HPA on the same Deployment?',
      options: [
        'VPA automatically disables HPA — no conflict',
        'VPA and HPA conflict by trying to adjust the same Deployment simultaneously',
        'HPA ends up controlling only memory while VPA controls CPU',
        'No risk — VPA and HPA are complementary by design'
      ],
      correct: 1,
      explanation: 'VPA mode "Auto" restarts pods to adjust resources, which can conflict with HPA adding/removing replicas. To use both, use VPA in "Off" mode (recommendations only) and apply manually, or use KEDA which is compatible with VPA.',
      reference: 'Common mistakes: VPA + HPA — "Common Mistakes" section in theory.'
    },
    {
      question: 'In a ResourceQuota, what does "requests.cpu: 10" mean?',
      options: [
        'Maximum 10 vCPUs per pod in the namespace',
        'Total maximum CPU requests for all pods in the namespace',
        'Namespace can create at most 10 pods with any CPU',
        'Maximum CPU limit of any container in the namespace'
      ],
      correct: 1,
      explanation: 'requests.cpu in ResourceQuota limits the SUM of all cpu requests from all pods in the namespace. If the sum exceeds the defined value, new pods with defined requests will be rejected. This protects against a namespace monopolizing cluster resources.',
      reference: 'Config: ResourceQuota — "ResourceQuota — Namespace Limits" section in theory.'
    },
    {
      question: 'What happens when a LimitRange is created in a namespace with existing pods?',
      options: [
        'LimitRange is applied retroactively to all existing pods',
        'LimitRange only applies to new pods created after its creation',
        'LimitRange restarts all pods to apply the defaults',
        'LimitRange emits a warning and rejects creation if pods violate it'
      ],
      correct: 1,
      explanation: 'LimitRange does NOT apply retroactively. Pods created before LimitRange continue with their original resources (or without resources if none were defined). To apply defaults to existing pods, a rollout restart must be performed on the Deployments.',
      reference: 'Common mistakes: LimitRange retroactive — "Common Mistakes" section in theory.'
    },
    {
      question: 'Which command shows the pods consuming the most memory across all namespaces?',
      options: [
        'kubectl describe nodes | grep memory',
        'kubectl top pods --all-namespaces --sort-by=memory',
        'kubectl get pods --all-namespaces -o memory',
        'kubectl usage pods --memory --all-namespaces'
      ],
      correct: 1,
      explanation: 'kubectl top pods --all-namespaces --sort-by=memory lists all pods with their current CPU and memory consumption, sorted by highest memory usage. Requires the Metrics Server installed in the cluster.',
      reference: 'Commands: kubectl top — "Check Resource Usage" section in theory.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 3 QoS classes and their conditions?',
      back: 'Guaranteed:\n- requests == limits for CPU AND memory\n- Last to be evicted\n- Best for critical workloads\n\nBurstable:\n- requests < limits (at least 1 resource)\n- Evicted by priority\n- Most production workloads\n\nBestEffort:\n- NO requests or limits\n- First to be evicted\n- Only for non-critical fault-tolerant jobs'
    },
    {
      front: 'What does LimitRange do and what does ResourceQuota do?',
      back: 'LimitRange (per container/pod):\n- Injects defaults when container doesn\'t define resources\n- Sets max/min per container\n- Applies to NEW pods only\n- Scope: namespace → container/pod/PVC\n\nResourceQuota (per namespace):\n- Limits TOTAL namespace resources\n- Prevents creation when quota is reached\n- Scope: namespace → sum of all pods\n- Ex: requests.cpu: "10" = max 10 CPU total'
    },
    {
      front: 'What is the golden rule for defining Resource Requests and Limits?',
      back: 'Request = real average usage (p50 of historical usage)\nLimit memory = 1.5x to 2x the request\nLimit CPU = optional (throttle > OOMKill)\n\nExample:\nApp uses ~200m CPU on average:\n  requests.cpu: 200m\n  limits.cpu: 500m  # or no limit\n  requests.memory: 256Mi\n  limits.memory: 512Mi\n\nNever: requests=0 (BestEffort = evicted first)\nNever: limits too small (frequent OOMKill)'
    },
    {
      front: 'What is Goldilocks and how does it work?',
      back: 'Goldilocks (Fairwinds) does right-sizing using VPA:\n\n1. Add label to namespace:\n   kubectl label ns production goldilocks.fairwinds.com/enabled=true\n\n2. Goldilocks creates VPAs for each Deployment\n\n3. VPA collects real container usage metrics\n\n4. Goldilocks dashboard shows:\n   - Current vs Recommended vs Difference\n   - Cost/savings estimate\n   - Ready-to-copy YAML\n\nMode: VPA "Off" = recommendations only'
    },
    {
      front: 'Why is VPA "Auto" + HPA on the same Deployment problematic?',
      back: 'Conflict:\n- VPA "Auto" restarts pods to change requests\n- HPA adds/removes replicas based on load\n- Both operate on the same object simultaneously\n- Can cause restart loops and instability\n\nSolutions:\n- Use VPA mode "Off" for recommendations\n  and apply manually in maintenance windows\n\n- Use KEDA (event-driven) instead of HPA\n  — KEDA is compatible with VPA\n\n- VPA "Initial" — only applies to new pods\n  is safer with HPA'
    },
    {
      front: 'How to identify pods without resource requests in the cluster?',
      back: 'kubectl get pods --all-namespaces -o json | \\\n  jq \'.items[] | select(\n    .spec.containers[0].resources.requests == null or\n    .spec.containers[0].resources.requests.cpu == null\n  ) | {ns: .metadata.namespace, name: .metadata.name}\'\n\n# Check QoS class\nkubectl get pods -n production -o json | \\\n  jq \'.items[] | {name: .metadata.name, qos: .status.qosClass}\'\n\n# Filter BestEffort only\nkubectl get pods -A -o json | \\\n  jq \'.items[] | select(.status.qosClass=="BestEffort") | .metadata\''
    },
    {
      front: 'What does Kubecost offer for cost management?',
      back: 'Visibility:\n- Cost per namespace, deployment, label, team\n- Compute (CPU+mem) + storage + network cost\n- Real prices by instance type (spot, on-demand)\n\nRecommendations:\n- Request right-sizing based on real usage\n- Node right-sizing (smaller instance types)\n- Identify idle resources\n\nAlerts:\n- Budget alerts per namespace/team\n- Anomaly detection (abnormal cost)\n- Chargeback reports for teams\n\nAccess:\nkubectl port-forward -n kubecost svc/kubecost-cost-analyzer 9090'
    },
    {
      front: 'How to monitor ResourceQuota usage in a namespace?',
      back: '# View quota and current usage\nkubectl describe resourcequota -n my-team\n# Output shows: Resource, Used, Hard\n\n# Example output:\n# Name: team-quota\n# Resource          Used   Hard\n# --------          ----   ----\n# limits.cpu        8      20\n# limits.memory     16Gi   40Gi\n# pods              23     50\n# requests.cpu      4      10\n\n# Via JSON for scripts\nkubectl get resourcequota -n my-team -o json | \\\n  jq .items[0].status\n\n# Alert when > 80%: use Kubecost or Prometheus'
    }
  ],

  lab: {
    scenario: 'You are the Platform Engineer responsible for the company\'s multi-tenant cluster. Three teams share the cluster: backend, frontend, and data-science. You need to implement resource governance to prevent uncontrolled costs and resource conflicts.',
    objective: 'Implement LimitRange and ResourceQuota per namespace, use VPA for right-sizing recommendations, and verify impact on pods.',
    duration: '25-35 minutes',
    steps: [
      {
        title: 'Configure LimitRange and ResourceQuota per Team',
        instruction: `Create namespaces for the three teams and configure resource policies:

- **backend**: max CPU requests 20, memory 40Gi, per-container limit 2 CPU and 2Gi mem
- **frontend**: max CPU requests 10, memory 20Gi, per-container limit 500m CPU and 512Mi mem
- **data-science**: max CPU requests 50, memory 100Gi, no per-container limit (but with defaults)

For each namespace, also configure LimitRange with appropriate defaults.`,
        hints: [
          'Create the namespace before applying LimitRange/ResourceQuota',
          'LimitRange and ResourceQuota are separate objects in the same namespace',
          'defaultRequest is applied when the container doesn\'t define resources'
        ],
        solution: `\`\`\`bash
# Create namespaces
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
\`\`\``,
        verify: `\`\`\`bash
# Verify LimitRange and ResourceQuota
kubectl describe limitrange backend-limits -n backend
# Expected: Default, DefaultRequest, Max, Min configured

kubectl describe resourcequota backend-quota -n backend
# Expected: Resource, Used (0), Hard (20 CPU, 40Gi mem)

# Test that LimitRange injects defaults
kubectl run test-pod --image=nginx -n backend
kubectl get pod test-pod -n backend -o json | \\
  jq '.spec.containers[0].resources'
# Expected: requests {cpu: 100m, memory: 128Mi}
# limits {cpu: 500m, memory: 512Mi}

# Cleanup test pod
kubectl delete pod test-pod -n backend
\`\`\``
      },
      {
        title: 'Test ResourceQuota and LimitRange Enforcement',
        instruction: `Test the configured limits:
1. Try creating a pod with CPU request higher than the LimitRange max in the frontend namespace (should fail)
2. Create multiple pods to exhaust a namespace quota and verify behavior
3. Check current quota usage

Use the \`frontend\` namespace which has more restrictive limits for testing.`,
        hints: [
          'LimitRange max prevents creating containers above the limit',
          'When ResourceQuota is reached, pods enter error state "exceeded quota"',
          'kubectl describe resourcequota shows Used vs Hard in real-time'
        ],
        solution: `\`\`\`bash
# Test 1: Pod violating LimitRange max (should fail)
kubectl run oversized-pod \\
  --image=nginx \\
  --requests="cpu=1" \\
  --limits="cpu=2,memory=1Gi" \\
  -n frontend
# Expected: Error - pods "oversized-pod" is forbidden:
# [Container cpu limit ... exceeds max limit per Container]

# Test 2: Create pods until quota is reached
for i in \$(seq 1 15); do
  kubectl run pod-\$i --image=nginx -n frontend
done

# Check state
kubectl get pods -n frontend | wc -l
kubectl describe resourcequota frontend-quota -n frontend

# Create pod when pod quota = 50 is exhausted
kubectl run pod-100 --image=nginx -n frontend
# Expected: Error - exceeded quota: frontend-quota, requested: pods=1, used: pods=50, limited: pods=50
\`\`\``,
        verify: `\`\`\`bash
# Verify oversized pod was rejected
kubectl get pods -n frontend | grep oversized
# Expected: (empty — pod not created)

# Check quota usage in detail
kubectl get resourcequota frontend-quota -n frontend -o json | \\
  jq '{used: .status.used, hard: .status.hard}'
# Expected: used.pods close to hard.pods (50)

# Check QoS of created pods
kubectl get pods -n frontend -o json | \\
  jq '.items[:3] | .[] | {name: .metadata.name, qos: .status.qosClass}'
# Expected: Burstable (since LimitRange injected requests < limits)

# Cleanup test pods
kubectl delete pods --all -n frontend
\`\`\``
      },
      {
        title: 'Install Goldilocks and Get Right-Sizing Recommendations',
        instruction: `Install VPA and Goldilocks, enable right-sizing for the \`backend\` namespace, and analyze recommendations.

Deploy a sample application in the backend namespace so VPA can collect usage data and generate recommendations.`,
        hints: [
          'VPA must be installed before Goldilocks',
          'Add the label goldilocks.fairwinds.com/enabled=true to the namespace',
          'Goldilocks dashboard runs on port 8080 by default',
          'To get recommendations, VPA needs historical data — wait a few minutes'
        ],
        solution: `\`\`\`bash
# Install VPA (Vertical Pod Autoscaler)
helm repo add fairwinds-stable https://charts.fairwinds.com/stable
helm repo update

helm install vpa fairwinds-stable/vpa \\
  --namespace vpa \\
  --create-namespace

kubectl wait --for=condition=ready pod \\
  -l app.kubernetes.io/name=vpa -n vpa --timeout=120s

# Install Goldilocks
helm install goldilocks fairwinds-stable/goldilocks \\
  --namespace goldilocks \\
  --create-namespace

# Enable Goldilocks for backend namespace
kubectl label namespace backend goldilocks.fairwinds.com/enabled=true

# Deploy sample app
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
              cpu: 500m     # Intentionally high to test right-sizing
              memory: 512Mi
            limits:
              cpu: "1"
              memory: 1Gi
EOF

# Wait for VPA to collect metrics
sleep 120

# View VPA created by Goldilocks
kubectl get vpa -n backend

# View recommendations
kubectl describe vpa goldilocks-sample-api -n backend | grep -A10 "Recommendation"
\`\`\``,
        verify: `\`\`\`bash
# Verify VPA installed
kubectl get pods -n vpa
# Expected: vpa-admission-controller, vpa-recommender, vpa-updater

# Verify Goldilocks enabled on namespace
kubectl get namespace backend -o yaml | grep goldilocks
# Expected: goldilocks.fairwinds.com/enabled: "true"

# Verify VPA created for sample-api
kubectl get vpa -n backend
# Expected: goldilocks-sample-api  VerticalPodAutoscaler

# Verify VPA recommendations
kubectl get vpa goldilocks-sample-api -n backend -o json | \\
  jq '.status.recommendation.containerRecommendations[0]'
# Expected: lowerBound, target, upperBound with CPU and memory values
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod stays in Pending after creating ResourceQuota',
      difficulty: 'easy',
      symptom: 'After creating a ResourceQuota in a namespace, new pods stay in Pending state with "exceeded quota" event. Even with cluster resources available, pods aren\'t scheduled.',
      diagnosis: `\`\`\`bash
# View pod events
kubectl describe pod my-pod -n my-team | grep -A5 "Events:"

# View current quota state
kubectl describe resourcequota -n my-team

# Check if requests are defined (required when ResourceQuota limits CPU/mem)
kubectl get pod my-pod -n my-team -o yaml | \\
  grep -A10 "resources:"

# Check if LimitRange with defaults is present
kubectl get limitrange -n my-team

# Calculate current usage
kubectl get resourcequota my-quota -n my-team -o json | \\
  jq '{used: .status.used, hard: .status.hard}'
\`\`\``,
      solution: `**Cause 1**: ResourceQuota reached — namespace consumed all the limit.
\`\`\`bash
# See what's consuming most resources
kubectl top pods -n my-team --sort-by=cpu

# Check inactive/completed pods consuming quota
kubectl get pods -n my-team | grep -v Running

# Scale down non-critical deployments
kubectl scale deployment --all --replicas=0 -n my-team

# Increase quota if justified
kubectl edit resourcequota my-quota -n my-team
\`\`\`

**Cause 2**: Pod without resource requests + ResourceQuota limits requests.
\`\`\`bash
# When ResourceQuota defines requests.cpu, ALL pods MUST have requests
# Add resources to Deployment:
kubectl patch deployment my-app -n my-team --type merge \\
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","resources":{"requests":{"cpu":"100m","memory":"128Mi"}}}]}}}}'
\`\`\`

**Cause 3**: Create LimitRange with defaultRequest to fix the issue:
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
# New pods without resources will receive defaults automatically
\`\`\``
    },
    {
      title: 'VPA and HPA causing instability — pods constantly restarting',
      difficulty: 'hard',
      symptom: 'A Deployment with HPA and VPA "Auto" has pods continuously restarting. HPA adds replicas while VPA restarts pods to adjust requests. The service is intermittent.',
      diagnosis: `\`\`\`bash
# View recent events
kubectl get events -n production --sort-by=.lastTimestamp | tail -20

# Check if there\'s VPA and HPA on the same Deployment
kubectl get hpa,vpa -n production | grep my-app

# View restart history
kubectl get pods -n production -l app=my-app | awk '{print \$1, \$4}'

# View VPA recommendations vs current requests
kubectl describe vpa my-app-vpa -n production | grep -A15 "Recommendation"

# Check VPA policy
kubectl get vpa my-app-vpa -n production -o yaml | grep "updateMode"

# View HPA scaling history
kubectl describe hpa my-app-hpa -n production | grep -A10 "Events:"
\`\`\``,
      solution: `**Solution: Switch VPA to "Off" mode and use manual recommendations**:
\`\`\`bash
# Switch VPA to Off mode (recommendations only)
kubectl patch vpa my-app-vpa -n production --type merge \\
  -p '{"spec":{"updatePolicy":{"updateMode":"Off"}}}'

# Check recommendations
kubectl describe vpa my-app-vpa -n production | \\
  grep -A5 "Container Recommendations"

# Apply recommendations manually during maintenance window
kubectl patch deployment my-app -n production --type merge \\
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","resources":{"requests":{"cpu":"250m","memory":"300Mi"},"limits":{"cpu":"500m","memory":"600Mi"}}}]}}}}'
\`\`\`

**Alternative: Use VPA with controlledResources**:
\`\`\`yaml
# VPA for memory only (HPA controls CPU)
spec:
  updatePolicy:
    updateMode: "Initial"  # only new pods
  resourcePolicy:
    containerPolicies:
      - containerName: app
        controlledResources: ["memory"]  # don't touch CPU
\`\`\``
    }
  ]
};
