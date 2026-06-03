window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['app-environment/requests-limits'] = {
  theory: `
# Requests, Limits & Quotas

## Exam Relevance
> Resource management is tested in CKAD (App Environment — 25%) and CKA. Expect tasks setting requests/limits, creating ResourceQuotas and LimitRanges, and understanding QoS classes.

## Requests vs Limits

| Concept | Purpose | Enforced By |
|---------|---------|-------------|
| **requests** | Amount guaranteed to the container | Scheduler (for placement) |
| **limits** | Maximum the container can use | Kernel (cgroups enforcement) |

\`\`\`
requests = "I need at least this much"
limits   = "I cannot use more than this"
\`\`\`

### CPU Behavior

- **requests**: used by scheduler to find a suitable node
- **limits**: enforced via CPU throttling (cgroups). Container does NOT get killed for exceeding CPU limits — it gets throttled.
- **1 CPU** = 1000m (millicores) = 1 vCPU = 1 AWS vCPU = 1 GCP core

### Memory Behavior

- **requests**: used for scheduling
- **limits**: enforced strictly. Container exceeding memory limit is **OOMKilled** (exit code 137)

## QoS Classes (Quality of Service)

| QoS Class | Condition | Eviction Priority |
|-----------|-----------|-------------------|
| **Guaranteed** | requests == limits for ALL containers | Last to be evicted |
| **Burstable** | requests < limits for at least one container | Middle priority |
| **BestEffort** | NO requests or limits set | First to be evicted |

\`\`\`yaml
# Guaranteed QoS (all containers, requests == limits)
resources:
  requests:
    cpu: "500m"
    memory: "128Mi"
  limits:
    cpu: "500m"      # same as requests
    memory: "128Mi"  # same as requests

# Burstable QoS
resources:
  requests:
    cpu: "100m"
    memory: "64Mi"
  limits:
    cpu: "500m"      # different from requests
    memory: "256Mi"

# BestEffort (no resources set)
# resources: {}  ← or omit entirely
\`\`\`

## Essential Commands

\`\`\`bash
# Set requests and limits on a deployment
kubectl set resources deployment/nginx \\
  --requests=cpu=100m,memory=128Mi \\
  --limits=cpu=500m,memory=256Mi

# Check current resource usage
kubectl top pods -A
kubectl top nodes

# Check pod resources
kubectl describe pod <pod> | grep -A10 "Limits:\|Requests:"

# Create ResourceQuota
kubectl create quota dev-quota \\
  --hard=cpu=4,memory=8Gi,pods=20 \\
  -n dev

# Describe quota usage
kubectl describe resourcequota -n dev
\`\`\`

## Setting Resources in YAML

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: resource-demo
spec:
  containers:
  - name: app
    image: nginx
    resources:
      requests:
        cpu: "250m"         # 0.25 CPU core
        memory: "64Mi"      # 64 MiB
      limits:
        cpu: "500m"         # 0.5 CPU core
        memory: "128Mi"     # 128 MiB
\`\`\`

## LimitRange

A **LimitRange** sets default and max/min values for requests/limits in a namespace:

\`\`\`yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: dev
spec:
  limits:
  - type: Container
    default:           # default limits if not specified
      cpu: "500m"
      memory: "256Mi"
    defaultRequest:    # default requests if not specified
      cpu: "100m"
      memory: "64Mi"
    max:               # cannot exceed these
      cpu: "2"
      memory: "1Gi"
    min:               # must specify at least these
      cpu: "50m"
      memory: "32Mi"
  - type: Pod          # limits for the entire pod
    max:
      cpu: "4"
      memory: "4Gi"
  - type: PersistentVolumeClaim  # storage limits
    max:
      storage: "10Gi"
    min:
      storage: "1Gi"
\`\`\`

## ResourceQuota

A **ResourceQuota** limits total resource consumption in a namespace:

\`\`\`yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: team-a
spec:
  hard:
    # Compute
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    # Object count
    pods: "20"
    services: "10"
    configmaps: "20"
    secrets: "20"
    persistentvolumeclaims: "10"
    # Storage
    requests.storage: 100Gi
\`\`\`

## Important Behaviors

| Scenario | Result |
|----------|--------|
| Container uses > CPU limit | Throttled (still runs) |
| Container uses > memory limit | OOMKilled (exit code 137) |
| ResourceQuota + no requests set | Pod REJECTED (quota requires requests be set) |
| LimitRange exists + no resources in pod | Default values applied automatically |
| Pod requests > node available | Pod stays Pending |

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| \`exceeded quota: pods\` | Pod count quota exceeded | Delete pods or increase quota |
| \`must specify limits.cpu\` | ResourceQuota requires limits | Set resource limits in pod |
| OOMKilled | Memory limit too low | Increase \`limits.memory\` |
| Pod Pending: Insufficient cpu | CPU request exceeds available | Reduce request or add nodes |

## Killer.sh Style Challenge

> **Task**: Create a ResourceQuota in namespace \`limited\` allowing max 10 pods, 2 CPU (requests), and 4Gi memory (limits). Then create a Deployment with 3 replicas where each pod requests 100m CPU and 256Mi memory, with limits of 200m CPU and 512Mi memory.

\`\`\`bash
kubectl create namespace limited
kubectl create quota app-quota -n limited \\
  --hard=pods=10,requests.cpu=2,limits.memory=4Gi

kubectl create deployment web -n limited \\
  --image=nginx --replicas=3
kubectl set resources deployment/web -n limited \\
  --requests=cpu=100m,memory=256Mi \\
  --limits=cpu=200m,memory=512Mi
\`\`\`
`,
  quiz: [
    {
      question: 'What happens to a container that exceeds its CPU limit?',
      options: [
        'The container is OOMKilled immediately',
        'The pod is evicted from the node',
        'The container is CPU-throttled (slowed down, not killed)',
        'The container restarts automatically'
      ],
      correct: 2,
      explanation: 'CPU limits are enforced by CPU throttling via cgroups. The container continues running but cannot use more CPU than the limit — it gets "throttled" (slowed). Unlike memory, exceeding CPU limits does NOT kill the container.',
      reference: 'CPU over-limit = throttled (slow). Memory over-limit = OOMKilled (exit 137). Very different behaviors!'
    },
    {
      question: 'A pod has `requests.memory: 128Mi` and `limits.memory: 256Mi`. Which QoS class does it have?',
      options: [
        'Guaranteed',
        'Burstable',
        'BestEffort',
        'Limited'
      ],
      correct: 1,
      explanation: 'Burstable: requests and limits are both set but are not equal. Guaranteed requires requests == limits for ALL containers. BestEffort has no requests or limits.',
      reference: 'QoS class determines eviction priority: Guaranteed (last) → Burstable → BestEffort (first).'
    },
    {
      question: 'A namespace has a ResourceQuota set. A user tries to create a pod without setting any resources. What happens?',
      options: [
        'The pod is created with default values from the ResourceQuota',
        'The pod is created with zero resources',
        'The pod creation is rejected — quota requires explicit resource declarations',
        'The pod is created in BestEffort mode and may be evicted'
      ],
      correct: 2,
      explanation: 'When a ResourceQuota exists in a namespace, all pods must explicitly set requests and limits (or rely on a LimitRange for defaults). Without explicit resources, the pod creation is rejected with a quota validation error.',
      reference: 'Solution: pair ResourceQuota with a LimitRange to set defaults automatically.'
    },
    {
      question: 'What does a LimitRange `default` field set?',
      options: [
        'The maximum resources any container can request',
        'Default limit values applied to containers that don\'t specify limits',
        'The minimum resources required for any container',
        'Default requests applied when no resources are specified'
      ],
      correct: 1,
      explanation: '`default` in a LimitRange sets the default **limits** for containers that don\'t specify them. `defaultRequest` sets default **requests**. This is different from `max` (maximum allowed) and `min` (minimum required).',
      reference: 'LimitRange fields: default (default limits), defaultRequest (default requests), max, min.'
    },
    {
      question: 'A node has 4 CPUs. Pod A requests 2 CPUs. Pod B requests 2 CPUs. Pod C requests 1 CPU. Can Pod C schedule on this node?',
      options: [
        'Yes — requests are not hard limits, just hints',
        'No — the node\'s allocatable CPU is already fully claimed by A and B',
        'Yes — if Pod A or B are not using their full requested CPU',
        'It depends on the QoS class of the pods'
      ],
      correct: 1,
      explanation: 'CPU requests are used by the scheduler to determine if a pod fits on a node. If 2+2=4 CPUs are already requested on a 4-CPU node, there is no remaining allocatable CPU for Pod C\'s 1 CPU request. Pod C stays Pending.',
      reference: 'Requests = scheduling guarantee. Even if actual usage is lower, requests count toward node capacity.'
    },
    {
      question: 'What is the correct CPU unit for "250 millicores"?',
      options: [
        '0.25CPU',
        '250cpu',
        '250m',
        '0.250'
      ],
      correct: 2,
      explanation: 'CPU resources use millicore notation: `250m` = 250 millicores = 0.25 CPU. 1000m = 1 CPU. You can also write `0.25` (decimal notation). `250cpu` would be 250 full CPUs!',
      reference: 'CPU units: 1 = 1000m = 1 vCPU. Memory units: Mi (mebibytes), Gi (gibibytes).'
    },
    {
      question: 'Which LimitRange type applies limits to ALL containers in a pod combined?',
      options: [
        'type: Container',
        'type: Pod',
        'type: Namespace',
        'type: Node'
      ],
      correct: 1,
      explanation: 'LimitRange `type: Pod` sets limits for the total resource consumption of all containers in a pod combined. `type: Container` applies per-container. `type: PersistentVolumeClaim` applies to PVC storage.',
      reference: 'Pod-level limits prevent single pods from monopolizing node resources even if individual containers stay within limits.'
    },
    {
      question: 'A pod has NO requests or limits set. It is the only pod on a heavily loaded node. What happens when the node runs out of memory?',
      options: [
        'The pod is guaranteed to run — it has BestEffort QoS',
        'The pod is the FIRST to be evicted because it has BestEffort QoS',
        'The pod is evicted last because it has no limits to exceed',
        'The node automatically increases memory for the pod'
      ],
      correct: 1,
      explanation: 'BestEffort QoS (no requests or limits) pods are the FIRST to be evicted under resource pressure. The kubelet evicts in order: BestEffort → Burstable → Guaranteed (last).',
      reference: 'Never run production workloads without requests and limits — they may be evicted first under pressure.'
    }
  ],
  flashcards: [
    {
      front: 'What is the difference between requests and limits?',
      back: '**requests**: Minimum guaranteed resources\n- Used by scheduler to find a suitable node\n- Node "holds" this capacity for the container\n- Container always gets at least this amount\n\n**limits**: Maximum allowed resources\n- CPU over-limit → throttled\n- Memory over-limit → OOMKilled\n\n`requests ≤ limits` (requests cannot exceed limits)'
    },
    {
      front: 'What are the 3 QoS classes and their conditions?',
      back: '| QoS | Condition | Eviction order |\n|-----|-----------|----------------|\n| **Guaranteed** | requests == limits for ALL containers | Last |\n| **Burstable** | requests < limits OR one container has neither | Middle |\n| **BestEffort** | NO requests or limits on ANY container | First |\n\nCheck QoS: `kubectl describe pod <pod> | grep QoS`'
    },
    {
      front: 'What is the difference between LimitRange and ResourceQuota?',
      back: '**LimitRange**: Per-container/pod defaults and constraints\n- Sets default requests/limits for new pods\n- Enforces min/max per container\n- Applied when pod is created\n\n**ResourceQuota**: Aggregate namespace limits\n- Limits total resources in a namespace\n- Tracks total usage across all pods\n- Rejects pods that would exceed the quota\n\nTip: Combine both — LimitRange for defaults, ResourceQuota for totals.'
    },
    {
      front: 'How do you set requests and limits on an existing Deployment?',
      back: '```bash\n# Imperative update\nkubectl set resources deployment/myapp \\\n  --requests=cpu=100m,memory=128Mi \\\n  --limits=cpu=500m,memory=256Mi\n\n# Edit YAML\nkubectl edit deployment myapp\n# Under spec.template.spec.containers[].resources\n\n# Dry-run to verify\nkubectl set resources deployment/myapp \\\n  --requests=cpu=100m,memory=128Mi \\\n  --limits=cpu=500m,memory=256Mi \\\n  --dry-run=client -o yaml\n```'
    },
    {
      front: 'What happens when a container uses more memory than its limit?',
      back: 'The container is **OOMKilled** (Out of Memory Killed) with exit code **137**.\n\nThe container is restarted by the kubelet. If it keeps exceeding the limit, it enters **CrashLoopBackOff**.\n\nFix: increase `limits.memory` or fix the memory leak.\n\n```bash\n# Check for OOMKilled\nkubectl describe pod <pod> | grep -A5 "Last State:"\n# Reason: OOMKilled\n# Exit Code: 137\n```'
    },
    {
      front: 'What are the valid CPU and memory unit formats?',
      back: '**CPU**:\n- `250m` = 250 millicores = 0.25 CPU\n- `1` = 1 CPU core\n- `2.5` = 2.5 CPU cores\n- `1000m` = 1 CPU\n\n**Memory**:\n- `64Mi` = 64 mebibytes (1024-based) ← use this\n- `64M` = 64 megabytes (1000-based)\n- `1Gi` = 1 gibibyte\n- `1G` = 1 gigabyte\n\nExam tip: always use Mi/Gi (mebibytes/gibibytes), not M/G.'
    },
    {
      front: 'What does a ResourceQuota `requests.cpu: "4"` mean?',
      back: 'The **total sum** of `resources.requests.cpu` across all pods in the namespace cannot exceed 4 CPU cores.\n\nExample:\n- If 3 pods each request 1 CPU → 3 used, 1 remaining\n- A new pod requesting 2 CPU would be **rejected**\n\nSeparate from `limits.cpu` (which caps total limits, not requests).\n\nCheck usage:\n```bash\nkubectl describe resourcequota -n <ns>\n# Shows: Used / Hard for each resource\n```'
    },
    {
      front: 'How does LimitRange interact with ResourceQuota when creating pods?',
      back: '**Workflow**:\n1. Pod is created with no resources specified\n2. **LimitRange** injects default requests/limits\n3. **ResourceQuota** checks if total usage would be exceeded\n4. Pod is admitted or rejected\n\nWithout LimitRange:\n- Pod created without resources → ResourceQuota rejects it (no resources declared)\n\nWith LimitRange:\n- Pod gets defaults → ResourceQuota can check against them → Pod may be admitted\n\nBest practice: always pair ResourceQuota + LimitRange.'
    }
  ],
  lab: {
    scenario: 'Implement resource governance for a development namespace using LimitRange for defaults and ResourceQuota for namespace-level caps.',
    objective: 'Create LimitRange, ResourceQuota, and verify they correctly govern pod resource allocation.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create LimitRange with Defaults',
        instruction: `In namespace **resource-lab**, create a **LimitRange** named \`dev-limits\` that:
- Sets default CPU limit: 500m, default memory limit: 256Mi
- Sets default CPU request: 100m, default memory request: 64Mi
- Sets max CPU per container: 2, max memory: 1Gi

Then create a pod WITHOUT any resource spec and verify it gets the default values automatically.`,
        hints: [
          'Use \`type: Container\` for per-container limits',
          'Fields: default, defaultRequest, max, min',
          'After pod creation, kubectl describe pod should show the injected resources',
          'Check: kubectl describe limitrange -n resource-lab'
        ],
        solution: `\`\`\`bash
kubectl create namespace resource-lab

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: LimitRange
metadata:
  name: dev-limits
  namespace: resource-lab
spec:
  limits:
  - type: Container
    default:
      cpu: "500m"
      memory: "256Mi"
    defaultRequest:
      cpu: "100m"
      memory: "64Mi"
    max:
      cpu: "2"
      memory: "1Gi"
EOF

# Create pod with no resources
kubectl run no-resources -n resource-lab --image=nginx

# Check what limits were injected
kubectl describe pod no-resources -n resource-lab | grep -A8 "Limits:\|Requests:"
\`\`\``,
        verify: `\`\`\`bash
kubectl describe limitrange dev-limits -n resource-lab
# Expected: shows Container limits with default, defaultRequest, max

kubectl describe pod no-resources -n resource-lab | grep -A5 "Limits:"
# Expected: cpu: 500m, memory: 256Mi (injected defaults)

kubectl describe pod no-resources -n resource-lab | grep -A5 "Requests:"
# Expected: cpu: 100m, memory: 64Mi (injected defaults)

kubectl get pod no-resources -n resource-lab
# Expected: Running, READY 1/1
\`\`\``
      },
      {
        title: 'Create ResourceQuota and Observe Enforcement',
        instruction: `In namespace **resource-lab**, create a **ResourceQuota** named \`dev-quota\` with:
- Max 5 pods
- Max 1 CPU total (requests)
- Max 512Mi memory (limits)

Then try to create 6 pods and observe quota rejection. Also try to set resources that exceed the quota.`,
        hints: [
          'ResourceQuota fields: pods, requests.cpu, limits.memory',
          'kubectl describe resourcequota shows current usage',
          'With LimitRange defaults (100m/pod), 5 pods = 500m total — just within 1 CPU quota',
          'The 6th pod should be rejected with quota exceeded error'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ResourceQuota
metadata:
  name: dev-quota
  namespace: resource-lab
spec:
  hard:
    pods: "5"
    requests.cpu: "1"
    limits.memory: "512Mi"
EOF

# Create 5 pods (should succeed)
for i in $(seq 1 5); do
  kubectl run pod$i -n resource-lab --image=nginx
done

# Check quota usage
kubectl describe resourcequota dev-quota -n resource-lab

# Try to create 6th pod (should fail)
kubectl run pod6 -n resource-lab --image=nginx
# Expected: Error from server (Forbidden): pods "pod6" is forbidden:
# exceeded quota: dev-quota, requested: pods=1, used: pods=5, limited: pods=5
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -n resource-lab | grep "pod[0-9]"
# Expected: exactly 5 pods (pod1-pod5)

kubectl describe resourcequota dev-quota -n resource-lab
# Expected:
# Name:            dev-quota
# Resource         Used    Hard
# --------         ---     ---
# limits.memory    ...     512Mi
# pods             5       5
# requests.cpu     ...     1

kubectl run pod6 -n resource-lab --image=nginx 2>&1 | grep "forbidden\|exceeded"
# Expected: error about exceeded quota
\`\`\``
      },
      {
        title: 'Set Resources on a Deployment and Check QoS',
        instruction: `Create a Deployment **app-deployment** in namespace **resource-lab** (after cleaning up some pods to free quota) with:
- 1 replica
- Image: nginx
- requests: cpu=200m, memory=128Mi
- limits: cpu=200m, memory=128Mi (same = Guaranteed QoS)

Verify the QoS class, then change the limits to be higher than requests (making it Burstable).`,
        hints: [
          'When requests == limits, pod gets Guaranteed QoS class',
          'Use kubectl set resources to update the deployment',
          'kubectl describe pod shows: QoS Class: Guaranteed / Burstable',
          'Clean up some pods first to free quota'
        ],
        solution: `\`\`\`bash
# Clean up some pods first
kubectl delete pods -n resource-lab -l run=pod1 -l run=pod2 2>/dev/null || true
kubectl delete pod pod1 pod2 pod3 pod4 pod5 -n resource-lab 2>/dev/null || true

# Create Guaranteed QoS deployment
kubectl create deployment app-deployment -n resource-lab \\
  --image=nginx --replicas=1
kubectl set resources deployment/app-deployment -n resource-lab \\
  --requests=cpu=200m,memory=128Mi \\
  --limits=cpu=200m,memory=128Mi

# Check QoS class
POD=$(kubectl get pods -n resource-lab -l app=app-deployment -o jsonpath='{.items[0].metadata.name}')
kubectl describe pod $POD -n resource-lab | grep "QoS Class:"

# Change to Burstable (limits > requests)
kubectl set resources deployment/app-deployment -n resource-lab \\
  --requests=cpu=100m,memory=64Mi \\
  --limits=cpu=200m,memory=128Mi

# Check new QoS class after pod recreates
sleep 5
POD=$(kubectl get pods -n resource-lab -l app=app-deployment -o jsonpath='{.items[0].metadata.name}')
kubectl describe pod $POD -n resource-lab | grep "QoS Class:"
\`\`\``,
        verify: `\`\`\`bash
# Check Guaranteed QoS (requests == limits)
POD=$(kubectl get pods -n resource-lab -l app=app-deployment -o jsonpath='{.items[0].metadata.name}')
kubectl describe pod $POD -n resource-lab | grep "QoS Class:"
# Expected: QoS Class: Burstable (after the second set resources)

# Verify resources
kubectl describe pod $POD -n resource-lab | grep -A5 "Limits:"
# Expected: cpu: 200m, memory: 128Mi

kubectl describe pod $POD -n resource-lab | grep -A5 "Requests:"
# Expected: cpu: 100m, memory: 64Mi

kubectl top pod $POD -n resource-lab
# Expected: current usage (if metrics-server is running)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pod rejected with "exceeded quota" but quota shows capacity',
      difficulty: 'medium',
      symptom: 'Creating a pod fails with "exceeded quota" error even though `kubectl describe resourcequota` seems to show available capacity.',
      diagnosis: `\`\`\`bash
# Get the exact error message
kubectl create pod ... 2>&1

# Check quota details carefully
kubectl describe resourcequota <name> -n <namespace>
# Look for ALL quota items, not just the one you think is violated
# Example: "requests.cpu" vs "limits.cpu" — different fields!

# Check LimitRange
kubectl describe limitrange -n <namespace>
# LimitRange defaults may inject higher values than expected

# Calculate actual usage
kubectl get pods -n <namespace> -o json | \\
  jq '.items[].spec.containers[].resources'
\`\`\``,
      solution: `The quota field being violated might not be the one you're looking at.

**Common hidden quota violations:**

\`\`\`bash
# 1. requests.cpu is different from limits.cpu in ResourceQuota
# If quota has: requests.cpu=1, limits.cpu=2
# Check BOTH are not exceeded

# 2. LimitRange injects defaults that push over quota
# LimitRange default memory=256Mi × N pods > memory quota

# Check what the pod ACTUALLY requests after LimitRange injection
kubectl run test --image=nginx --dry-run=server -o yaml -n <ns>
# Shows actual resources with defaults injected

# 3. pods count quota
kubectl get pods -n <ns> | wc -l  # count existing pods

# Fix: either increase quota or reduce actual resource usage
kubectl patch resourcequota <name> -n <ns> \\
  --type=json \\
  -p='[{"op":"replace","path":"/spec/hard/requests.cpu","value":"4"}]'
\`\`\``
    },
    {
      title: 'Container OOMKilled repeatedly — memory leak',
      difficulty: 'hard',
      symptom: 'A pod\'s container keeps restarting with OOMKilled (exit code 137). The memory limit seems adequate but the container keeps growing.',
      diagnosis: `\`\`\`bash
# Confirm OOMKilled
kubectl describe pod <pod> -n <ns> | grep -A8 "Last State:"
# Reason: OOMKilled, Exit Code: 137

# Check current memory usage
kubectl top pod <pod> -n <ns>

# Check memory limit
kubectl describe pod <pod> | grep -A3 "Limits:"
# memory: XMi

# Check if usage is growing over time (memory leak)
# Monitor: watch -n5 kubectl top pod <pod>

# Check if limit is too low for actual usage
# Compare: actual peak usage vs limit
\`\`\``,
      solution: `**Immediate fix**: increase the memory limit to give the container room.

\`\`\`bash
# Increase limits on the deployment
kubectl set resources deployment/<name> -n <ns> \\
  --limits=memory=512Mi    # double or triple current limit

# Monitor if the increase stabilizes the pod
kubectl get pods -n <ns> -w

# Long-term fix: investigate the memory leak
# 1. Profile the application (heap dumps, memory profiles)
# 2. Set memory limit at 110-120% of expected peak usage
# 3. Consider using memory limit alerts before OOMKill

# For true memory leaks (usage grows indefinitely), the fix is in the code
# Add OOMKill metric monitoring:
# kubectl get events -n <ns> | grep OOMKilled
\`\`\`

**Prevention:**
- Set limits based on observed peak usage + 20% buffer
- Monitor with kubectl top or Prometheus
- Set alerts at 80% memory usage to catch trends before OOMKill`
    }
  ]
};
