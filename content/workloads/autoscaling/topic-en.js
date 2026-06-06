window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['workloads/autoscaling'] = {
  theory: `# Autoscaling & Self-Healing

## Exam Relevance
> Autoscaling appears in both CKA and CKAD exams. HPA (Horizontal Pod Autoscaler) is the most commonly tested type. You must be able to create an HPA, understand how it scales based on metrics, and know the difference between HPA (pod count), VPA (pod resources), and Cluster Autoscaler (nodes).

## Types of Autoscaling

| Type | What Scales | Metric Source | Common Use |
|------|------------|---------------|------------|
| HPA | Pod replicas | CPU, Memory, Custom | Variable load |
| VPA | Pod resource requests | Historical usage | Right-sizing |
| KEDA | Pod replicas | External sources | Event-driven |
| Cluster Autoscaler | Node count | Unschedulable pods | Cloud environments |

## Horizontal Pod Autoscaler (HPA)

HPA automatically adjusts the number of pod replicas based on observed metrics.

### Prerequisites

The Metrics Server must be deployed in the cluster for CPU/Memory HPA:

\`\`\`bash
# Check if metrics-server is running
kubectl get pods -n kube-system | grep metrics-server

# Check if metrics are available
kubectl top pods
kubectl top nodes
\`\`\`

### Creating an HPA

\`\`\`bash
# Imperative — quick creation
kubectl autoscale deployment myapp --cpu-percent=50 --min=2 --max=10

# Verify HPA
kubectl get hpa
kubectl describe hpa myapp
\`\`\`

\`\`\`yaml
# Declarative — v2 API
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50    # Target 50% CPU utilization
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 70   # Target 70% memory utilization
\`\`\`

### HPA Scaling Algorithm

\`\`\`
desired_replicas = ceil(current_replicas × (current_metric / target_metric))

Example:
- current replicas: 4
- current CPU: 80%
- target CPU: 50%
- desired = ceil(4 × 80/50) = ceil(6.4) = 7 replicas → scale UP
\`\`\`

### Scale Up and Scale Down Behavior

\`\`\`yaml
spec:
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0     # Scale up immediately
      policies:
      - type: Pods
        value: 4
        periodSeconds: 60               # Add max 4 pods per minute
    scaleDown:
      stabilizationWindowSeconds: 300   # Wait 5 min before scaling down
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
\`\`\`

Default stabilization:
- **Scale up**: no waiting (responds to spikes immediately)
- **Scale down**: 5-minute window to prevent flapping

### HPA Status and Monitoring

\`\`\`bash
# Check current state
kubectl get hpa myapp-hpa
# NAME       REFERENCE           TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
# myapp-hpa  Deployment/myapp   45%/50%   2         10        4          5m

# Detailed status
kubectl describe hpa myapp-hpa
# Shows: last scaling event, current metrics, conditions

# Watch HPA changes
kubectl get hpa -w
\`\`\`

## Resource Requests Required for CPU HPA

**HPA cannot calculate CPU utilization without resource requests.**

\`\`\`yaml
containers:
- name: app
  image: myapp:1.0
  resources:
    requests:
      cpu: 200m       # REQUIRED for CPU-based HPA
      memory: 256Mi   # REQUIRED for memory-based HPA
    limits:
      cpu: 500m
      memory: 512Mi
\`\`\`

## Vertical Pod Autoscaler (VPA)

VPA adjusts resource requests and limits automatically. It does NOT scale replicas.

\`\`\`yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: myapp-vpa
spec:
  targetRef:
    apiVersion: "apps/v1"
    kind: Deployment
    name: myapp
  updatePolicy:
    updateMode: "Auto"   # Auto, Recreate, Initial, Off
  resourcePolicy:
    containerPolicies:
    - containerName: app
      minAllowed:
        cpu: 100m
        memory: 50Mi
      maxAllowed:
        cpu: 1
        memory: 500Mi
\`\`\`

**VPA modes:**
- **Off** — recommends only (kubectl describe vpa to see suggestions)
- **Initial** — sets resources only at pod creation
- **Recreate** — updates by evicting and recreating pods
- **Auto** — same as Recreate currently

⚠️ **HPA and VPA conflict**: Do NOT use both on CPU/Memory simultaneously. HPA scales replicas; VPA changes resource requests → triggers pod recreation → HPA sees different utilization → instability.

## Self-Healing

Kubernetes self-healing is built into the ReplicaSet/Deployment controller:

\`\`\`bash
# If a pod dies, the ReplicaSet creates a replacement
kubectl delete pod <pod-name>  # Pod is immediately recreated

# Check that the replacement was created
kubectl get pods -w

# ReplicaSet events show the self-healing
kubectl describe replicaset <rs-name> | grep -A5 Events
\`\`\`

## Liveness Probe + Self-Healing

When a liveness probe fails, kubelet **restarts the container** automatically:

\`\`\`yaml
spec:
  containers:
  - name: app
    livenessProbe:
      httpGet:
        path: /health
        port: 8080
      initialDelaySeconds: 15
      periodSeconds: 20
      failureThreshold: 3    # 3 failures → container restart
\`\`\`

## Common Errors

1. **HPA shows \`<unknown>\` for metrics** — Metrics Server not installed or not working
2. **HPA stuck at minReplicas** — resource requests not set on containers
3. **Rapid scale up/down (thrashing)** — stabilization window too short; increase \`scaleDown.stabilizationWindowSeconds\`
4. **HPA and Deployment conflict** — HPA controls replicas; manual \`kubectl scale\` changes are overridden by HPA
5. **VPA + HPA on same metric** — causes instability; use different metrics for each

## Killer.sh Style Challenge

**Task**: Deploy a CPU-intensive app named \`stress-app\` with 100m CPU requests. Create an HPA that:
- Targets 50% CPU utilization
- Scales between 2 and 8 replicas
- Use autoscaling/v2 API

Generate load using a busybox pod running \`stress\` and observe HPA scaling up.
`,
  quiz: [
    {
      question: 'What must be configured on a container for CPU-based HPA to work?',
      options: [
        'A liveness probe',
        'CPU resource requests',
        'A Service with ClusterIP',
        'The metrics-server annotation'
      ],
      correct: 1,
      explanation: 'HPA calculates CPU utilization as "current CPU usage / CPU request". Without CPU requests defined, the denominator is unknown and HPA cannot calculate utilization — it shows <unknown> in the TARGETS column.',
      reference: 'Resource Requests Required for CPU HPA section in theory.'
    },
    {
      question: 'What is the HPA scaling formula?',
      options: [
        'desired = current_replicas + (current_metric - target_metric)',
        'desired = ceil(current_replicas × (current_metric / target_metric))',
        'desired = target_metric / current_metric',
        'desired = current_replicas × target_metric%'
      ],
      correct: 1,
      explanation: 'desired = ceil(current_replicas × current_metric / target_metric). Example: 4 pods at 80% CPU with 50% target → ceil(4 × 80/50) = ceil(6.4) = 7 pods.',
      reference: 'HPA Scaling Algorithm section in theory.'
    },
    {
      question: 'A pod in a Deployment is deleted manually. What happens?',
      options: [
        'The pod stays deleted until the Deployment is manually scaled up',
        'The ReplicaSet controller creates a replacement pod automatically (self-healing)',
        'The node marks itself as NotReady',
        'The HPA scales up to compensate'
      ],
      correct: 1,
      explanation: 'Self-healing is built into ReplicaSet. The ReplicaSet controller continuously reconciles actual vs desired replica count. When a pod is deleted, it creates a replacement immediately — no manual intervention needed.',
      reference: 'Self-Healing section in theory.'
    },
    {
      question: 'Why should you NOT use HPA (on CPU) and VPA together on the same Deployment?',
      options: [
        'They use different API versions and are incompatible',
        'VPA changes CPU requests, which changes the denominator for HPA → HPA sees different utilization → scaling instability',
        'Kubernetes does not allow two controllers on the same resource',
        'VPA always overrides HPA decisions'
      ],
      correct: 1,
      explanation: 'VPA changes resource requests (the denominator HPA uses for % calculation). When VPA updates requests, HPA recalculates utilization differently, potentially triggering unwanted scaling. This causes feedback loops and instability.',
      reference: 'Vertical Pod Autoscaler section — the VPA+HPA conflict warning.'
    },
    {
      question: 'What does the HPA stabilization window for scale-down prevent?',
      options: [
        'Prevents scaling below minReplicas',
        'Prevents rapid oscillation (thrashing) by requiring the metric to stay low for the full window before scaling down',
        'Prevents concurrent scale-up and scale-down operations',
        'Prevents HPA from overriding manual kubectl scale commands'
      ],
      correct: 1,
      explanation: 'The scale-down stabilization window (default 5 minutes) requires the metric to consistently be below the target for the entire window before scaling down. This prevents the load spike → scale up → spike gone → scale down → new spike pattern.',
      reference: 'Scale Up and Scale Down Behavior section in theory.'
    },
    {
      question: 'What imperative command creates an HPA with min=2, max=10, CPU target=60%?',
      options: [
        'kubectl create hpa myapp --min=2 --max=10 --cpu=60',
        'kubectl autoscale deployment myapp --min=2 --max=10 --cpu-percent=60',
        'kubectl apply hpa myapp --replicas=2:10 --cpu=60%',
        'kubectl scale hpa myapp --min=2 --max=10 --threshold=60'
      ],
      correct: 1,
      explanation: '"kubectl autoscale deployment <name> --cpu-percent=N --min=N --max=N" is the correct imperative command for creating an HPA. The target is deployment name, not pod name.',
      reference: 'Creating an HPA section in theory — imperative command.'
    },
    {
      question: 'HPA shows TARGETS as <unknown>/50%. What is the most likely cause?',
      options: [
        'The HPA maxReplicas is set too low',
        'The Metrics Server is not installed or not running',
        'The Deployment has no pods running',
        'The HPA is using the wrong API version'
      ],
      correct: 1,
      explanation: '<unknown> in TARGETS means HPA cannot get metrics. The most common cause is Metrics Server not being installed. Check: kubectl get pods -n kube-system | grep metrics-server and kubectl top pods.',
      reference: 'Common Errors #1 and HPA Prerequisites in theory.'
    },
    {
      question: 'You manually run kubectl scale deployment myapp --replicas=5, but HPA is configured with min=2, max=10. What happens?',
      options: [
        'The manual scale overrides HPA permanently',
        'HPA overrides the manual scale on its next evaluation cycle (every ~15 seconds)',
        'Both changes are applied — resulting in 5 replicas as a new minimum',
        'Kubernetes rejects the manual scale command'
      ],
      correct: 1,
      explanation: 'HPA continuously reconciles the replica count based on metrics. After the next evaluation cycle (~15 seconds), HPA will set replicas to whatever the algorithm calculates — overriding the manual scale. Manual scaling and HPA are not compatible on the same Deployment.',
      reference: 'Common Errors #4 — HPA and Deployment conflict in theory.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 3 types of Kubernetes autoscaling?',
      back: '1. HPA (Horizontal Pod Autoscaler) — scales pod REPLICAS based on CPU/Memory/custom metrics\n2. VPA (Vertical Pod Autoscaler) — scales pod RESOURCE REQUESTS (no replica change)\n3. Cluster Autoscaler — scales NODE count based on unschedulable pods\n\nAlso: KEDA (event-driven, external metrics)'
    },
    {
      front: 'What is the minimum requirement for CPU-based HPA to work?',
      back: '1. Metrics Server must be running in kube-system\n2. Containers must have CPU resource REQUESTS defined\n\nHPA formula: current% = actual CPU / CPU request × 100\nWithout requests, the denominator is unknown → TARGETS shows <unknown>'
    },
    {
      front: 'What is the HPA scaling formula?',
      back: 'desired_replicas = ceil(current_replicas × (current_metric / target_metric))\n\nExample:\n- 4 pods, 80% CPU actual, 50% target\n- desired = ceil(4 × 80/50) = ceil(6.4) = 7 pods\n\nHPA will scale UP to 7 replicas.'
    },
    {
      front: 'What is the default scale-down stabilization window in HPA?',
      back: '300 seconds (5 minutes).\n\nHPA waits 5 minutes of consistently low metric values before scaling down. This prevents "thrashing" — rapid oscillation caused by temporary load spikes.\n\nScale-UP has no stabilization delay by default (responds immediately).'
    },
    {
      front: 'How do you create an HPA imperatively?',
      back: 'kubectl autoscale deployment <name> --cpu-percent=50 --min=2 --max=10\n\nThis creates an HPA targeting 50% CPU utilization, scaling between 2 and 10 replicas.\n\nVerify: kubectl get hpa\nDetails: kubectl describe hpa <name>'
    },
    {
      front: 'Can you use HPA and VPA together?',
      back: 'Not safely on the same metric (CPU or Memory). VPA changes resource requests → changes the denominator HPA uses → HPA recalculates utilization differently → unstable scaling.\n\nSafe combination: HPA on CPU + VPA on Memory (different metrics)\nOr: VPA in "Off" mode (recommendations only) + HPA for replica scaling.'
    },
    {
      front: 'What is Kubernetes self-healing?',
      back: 'The ReplicaSet controller continuously reconciles desired vs actual pod count. If a pod dies, crashes, or is deleted, a new pod is created automatically.\n\nNo manual intervention needed. Works for:\n- Node failures (pods rescheduled elsewhere)\n- Container crashes (liveness probe triggers restart)\n- Manual deletion (replacement created)'
    },
    {
      front: 'What does TARGETS <unknown>/50% mean in kubectl get hpa?',
      back: 'HPA cannot retrieve metrics. Most common causes:\n1. Metrics Server not installed: kubectl get pods -n kube-system | grep metrics-server\n2. Container has no CPU requests defined\n3. Metrics Server is unhealthy: kubectl top pods (should work)\n\nFix: deploy metrics-server or add resource requests to containers.'
    }
  ],
  lab: {
    scenario: 'A web application experiences variable traffic and needs autoscaling to handle peak loads efficiently. You will configure HPA to automatically scale pods based on CPU utilization.',
    objective: 'Practice creating HPAs, understanding the scaling algorithm, and observing automatic scale-up and scale-down behavior.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Verify Metrics Server and Create HPA',
        instruction: `First verify the Metrics Server is running, then create a Deployment with resource requests and an HPA:

1. Check if Metrics Server is running and kubectl top works
2. Create Deployment \`cpu-app\` with \`nginx:1.25\`, 2 replicas, CPU request=100m, limit=200m
3. Create an HPA targeting 50% CPU utilization with min=1 and max=5 replicas
4. Verify the HPA shows real metrics (not \`<unknown>\`)`,
        hints: [
          'kubectl get pods -n kube-system | grep metrics to check metrics-server',
          'kubectl top pods verifies metrics are working',
          'CPU request is REQUIRED for HPA: resources.requests.cpu: 100m',
          'kubectl autoscale deployment cpu-app --cpu-percent=50 --min=1 --max=5'
        ],
        solution: `\`\`\`bash
# Check Metrics Server
kubectl get pods -n kube-system | grep metrics
kubectl top pods --all-namespaces | head -5

# Create Deployment with CPU requests
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cpu-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cpu-app
  template:
    metadata:
      labels:
        app: cpu-app
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
        resources:
          requests:
            cpu: 100m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 128Mi
EOF

kubectl rollout status deployment/cpu-app

# Create HPA
kubectl autoscale deployment cpu-app --cpu-percent=50 --min=1 --max=5

# Check HPA (wait 30 seconds for first metrics)
sleep 30
kubectl get hpa cpu-app
\`\`\``,
        verify: `\`\`\`bash
# HPA should show actual metrics (not <unknown>)
kubectl get hpa cpu-app
# Expected: TARGETS shows X%/50% (not <unknown>/50%)

# Deployment should be running
kubectl get deployment cpu-app
# Expected: READY = 2/2

# Verify CPU requests are set
kubectl get deployment cpu-app -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}'
# Expected: 100m
\`\`\``
      },
      {
        title: 'Create HPA with Declarative YAML (autoscaling/v2)',
        instruction: `Delete the existing HPA and recreate it using the autoscaling/v2 API with both CPU and memory metrics:

1. Delete the existing HPA: \`kubectl delete hpa cpu-app\`
2. Create a new HPA named \`cpu-app-hpa\` using autoscaling/v2 with:
   - CPU target: 50% utilization
   - Memory target: 70% utilization
   - Min replicas: 1, Max replicas: 8
3. Verify the HPA shows metrics for both CPU and memory`,
        hints: [
          'apiVersion: autoscaling/v2 (not v1)',
          'scaleTargetRef points to the Deployment',
          'Each metric has: type: Resource, resource.name: cpu/memory, target.type: Utilization',
          'kubectl describe hpa cpu-app-hpa shows both metrics'
        ],
        solution: `\`\`\`bash
kubectl delete hpa cpu-app

cat <<EOF | kubectl apply -f -
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: cpu-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cpu-app
  minReplicas: 1
  maxReplicas: 8
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
        type: Utilization
        averageUtilization: 70
EOF

kubectl get hpa cpu-app-hpa
kubectl describe hpa cpu-app-hpa
\`\`\``,
        verify: `\`\`\`bash
# HPA should exist and use v2 API
kubectl get hpa cpu-app-hpa -o yaml | grep "apiVersion"
# Expected: apiVersion: autoscaling/v2

# Both metrics should be tracked
kubectl describe hpa cpu-app-hpa | grep -A5 "Metrics:"
# Expected: both cpu and memory metrics listed

# Current replicas should be between min and max
kubectl get hpa cpu-app-hpa
# Expected: MINPODS=1, MAXPODS=8, shows TARGETS for both metrics
\`\`\``
      },
      {
        title: 'Observe HPA Scaling (Scale Up and Down)',
        instruction: `Simulate CPU load to trigger HPA scale-up, then observe scale-down:

1. Create a load generator pod that runs for 2 minutes
2. Watch the HPA scale up the cpu-app deployment
3. After load stops, watch the HPA scale back down (may take 5+ minutes due to stabilization window)

Note: If your cluster doesn't allow real CPU load generation, observe the HPA status and understand the behavior theoretically.`,
        hints: [
          'Load generator: kubectl run load --image=busybox:1.36 --rm -it -- sh -c "while true; do wget -q -O- http://cpu-app; done"',
          'Watch HPA: kubectl get hpa cpu-app-hpa -w',
          'Watch pods: kubectl get pods -l app=cpu-app -w',
          'Scale down takes 5+ minutes (300s stabilization window by default)'
        ],
        solution: `\`\`\`bash
# First, create a Service for the cpu-app (load generator needs to reach it)
kubectl expose deployment cpu-app --port=80 --name=cpu-svc

# Watch HPA in one terminal
kubectl get hpa cpu-app-hpa -w &

# Watch pods in another
kubectl get pods -l app=cpu-app -w &

# Generate load (runs for ~2 minutes)
kubectl run load-gen --image=busybox:1.36 --restart=Never -- \
  sh -c "for i in \$(seq 1 500); do wget -q -O- http://cpu-svc; done"

# Wait and observe HPA increase replicas
sleep 60
kubectl get hpa cpu-app-hpa
kubectl get pods -l app=cpu-app

# After load pod completes:
kubectl get pod load-gen
# STATUS = Completed

# Wait for scale down (5 minutes stabilization window)
# Watch: kubectl get hpa cpu-app-hpa -w
echo "Wait 5+ minutes for scale-down..."

# Cleanup
kubectl delete pod load-gen 2>/dev/null; kubectl delete svc cpu-svc
\`\`\``,
        verify: `\`\`\`bash
# After load: HPA should have scaled up (replicas > 1)
kubectl get hpa cpu-app-hpa
# Expected: REPLICAS > 1 when load was active

# After load stops (wait 5+ minutes): HPA should scale back to min
kubectl get hpa cpu-app-hpa
# Expected: REPLICAS = 1 (back to minimum after stabilization)

# HPA events show scaling actions
kubectl describe hpa cpu-app-hpa | grep -A10 "Events:"
# Expected: ScalingActive, SuccessfulRescale events
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'HPA Shows <unknown> for CPU Metrics',
      difficulty: 'easy',
      symptom: 'kubectl get hpa shows TARGETS as <unknown>/50%. The HPA exists and references a running Deployment, but it never scales.',
      diagnosis: `\`\`\`bash
# Check if Metrics Server is running
kubectl get pods -n kube-system | grep metrics

# Try to get pod metrics
kubectl top pods
# If this fails: "Error from server (ServiceUnavailable): the server is currently unable to handle the request"
# → Metrics Server is not installed or not ready

# Check if containers have CPU requests
kubectl get deployment <name> -o yaml | grep -A5 resources
# Look for: requests: cpu: XXX

# Check HPA events for specific error
kubectl describe hpa <name> | grep -A5 "Conditions:"
\`\`\``,
      solution: `**Cause A: Metrics Server not installed**
\`\`\`bash
# Install Metrics Server (for exam clusters, it may already be available)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# If in a self-signed cert environment, add --kubelet-insecure-tls
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# Verify metrics-server is running
kubectl get pods -n kube-system | grep metrics
kubectl top pods  # Should work after 1-2 minutes
\`\`\`

**Cause B: Container missing CPU requests**
\`\`\`bash
# Add CPU requests to the Deployment
kubectl set resources deployment myapp \
  --requests=cpu=100m,memory=64Mi \
  --limits=cpu=500m,memory=256Mi

# Wait for HPA to update metrics (~30 seconds)
kubectl get hpa myapp -w
\`\`\``
    },
    {
      title: 'HPA Not Scaling Despite High CPU',
      difficulty: 'medium',
      symptom: 'kubectl top pods shows pods at 90% CPU but the HPA (targeting 50%) is not scaling up. REPLICAS stays at the current count.',
      diagnosis: `\`\`\`bash
# Check HPA status and conditions
kubectl describe hpa <name>
# Look for:
# - Conditions: AbleToScale, ScalingActive, ScalingLimited
# - Events for recent scale actions

# Check if at maxReplicas
kubectl get hpa <name>
# MAXPODS column — if REPLICAS = MAXPODS, it cannot scale further

# Check if there are Pending pods (resource constraints)
kubectl get pods -l <selector>
# Pending pods = cannot schedule → maxReplicas effectively limited by cluster capacity

# Check node capacity
kubectl describe nodes | grep -A5 "Allocated resources"
\`\`\``,
      solution: `**Cause A: Already at maxReplicas**
\`\`\`bash
kubectl get hpa <name>
# MAXPODS = REPLICAS — HPA can't scale further

# Fix: increase maxReplicas
kubectl patch hpa <name> -p '{"spec":{"maxReplicas":20}}'
\`\`\`

**Cause B: Pods can't schedule (insufficient node resources)**
\`\`\`bash
# HPA creates pods but they stay Pending
kubectl get pods
# Shows Pending pods

kubectl describe pod <pending-pod> | grep -A5 Events
# Shows: Insufficient cpu or Insufficient memory

# Fix: add nodes or reduce resource requests
# For exam purposes: check if there are spare nodes
kubectl get nodes
kubectl describe node <node> | grep -A5 "Allocated resources"
\`\`\`

**Cause C: Metric not matching — wrong target name**
\`\`\`bash
# HPA references deployment "myapp" but deployment is named "my-app"
kubectl get hpa <name> -o yaml | grep -A5 scaleTargetRef
# Verify name matches actual deployment name

kubectl get deployment  # Compare with scaleTargetRef.name
\`\`\``
    },
    {
      title: 'Pods Pending and the Cluster Autoscaler does not add nodes',
      difficulty: 'hard',
      symptom: 'Several Pods stay Pending with the event "0/3 nodes are available: Insufficient cpu". The Cluster Autoscaler is installed, but no new node is provisioned even after several minutes.',
      diagnosis: `\`\`\`bash
# 1. Confirm the Pending reason (must be lack of resource/scheduling)
kubectl describe pod <pending-pod> | grep -A10 Events
# Expected: "Insufficient cpu/memory" or "didn't match node selector"

# 2. See the Cluster Autoscaler logs/decisions
kubectl -n kube-system logs deploy/cluster-autoscaler --tail=50 | grep -i 'scale\\|node group\\|max'

# 3. See the CA status (records why it did NOT scale)
kubectl -n kube-system get configmap cluster-autoscaler-status -o yaml

# 4. Check node group limits (max already reached?)
# (in cloud) check the ASG/MIG/node pool minSize/maxSize

# 5. Does the Pod fit on ANY new node type?
kubectl get pod <pod> -o jsonpath='{.spec.containers[*].resources.requests}'
\`\`\``,
      solution: `The Cluster Autoscaler **only adds a node if the Pending Pod could be scheduled on it**. Common "does not scale" causes:

1. **Node group already at maxSize** — the CA respects the group \`--max-nodes\`/maxSize. Raise the node group limit (ASG/MIG/pool) in the cloud.

2. **Pod requests larger than any available node** — if the Pod asks for 8 CPU and the largest node has 4, no new node accommodates it. The CA does not scale. Reduce requests or use a node group with bigger instances.

3. **Constraints no new node satisfies** — nodeSelector/affinity/taints that no node in the scalable group meets. The CA only creates nodes from the group template; if the template lacks the required label/taint, it does not help.

4. **Pods marked not safe to evict** that the CA respects via annotation:
\`\`\`bash
# CA ignores pods with this annotation when deciding scale-up/down
# "cluster-autoscaler.kubernetes.io/safe-to-evict": "false"
kubectl get pod <pod> -o jsonpath='{.metadata.annotations}'
\`\`\`

5. **Misconfigured expander/node group** — no eligible node group (\`--nodes=min:max:asgName\` missing or wrong cloud tag).

\`\`\`bash
# Typical action: raise the group ceiling (conceptual example)
# AWS:   aws autoscaling update-auto-scaling-group --max-size 6 ...
# Then watch the CA decide the scale-up:
kubectl -n kube-system logs deploy/cluster-autoscaler -f | grep -i 'scale_up\\|final'
\`\`\`

**Key difference (exam favorite):** the **HPA** changes the number of **Pods**; the **Cluster Autoscaler** changes the number of **nodes**. Pods Pending due to lack of CPU are a CA problem, not an HPA one.

**Prevention:** set realistic requests, size the node group maxSize for peak, and alert on long-standing Pending Pods.`
    }
  ]
};
