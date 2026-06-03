window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['keda/keda-fundamentals'] = {
  theory: `# KEDA — Kubernetes Event-Driven Autoscaling

## Exam Relevance
> KEDA is covered in advanced platform exams and KubeAstronaut. Focus on ScaledObject, ScaledJob, scaling triggers, and integration with native Kubernetes HPA.

## Core Concepts

### What is KEDA?
KEDA (Kubernetes Event-Driven Autoscaling) is a component that enables scaling Kubernetes workloads based on **external events** — not just CPU/memory like the standard HPA.

It enables:
- Scaling from **0 to N** pods (scale-to-zero)
- Scaling based on queues, streams, custom metrics
- Support for 60+ built-in scalers (Kafka, RabbitMQ, Redis, Azure, AWS, GCP...)

### How KEDA Works

\`\`\`
┌─────────────────────────────────────────────────────┐
│                  KEDA Architecture                   │
│                                                      │
│  External Source    KEDA Operator      K8s HPA       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ Kafka Queue  │  │  ScaledObject│  │   HPA    │  │
│  │ RabbitMQ     │→ │  (CRD)       │→ │(managed  │  │
│  │ Redis        │  │  Metrics     │  │ by KEDA) │  │
│  │ Prometheus   │  │  Adapter     │  └────┬─────┘  │
│  └──────────────┘  └──────────────┘       │         │
│                                           ↓         │
│                                    ┌──────────────┐ │
│                                    │  Deployment  │ │
│                                    │  0..N pods   │ │
│                                    └──────────────┘ │
└─────────────────────────────────────────────────────┘
\`\`\`

**Main components**:
- **keda-operator**: watches ScaledObjects, manages HPA lifecycle
- **keda-metrics-apiserver**: exposes external metrics to the K8s Metrics API
- **ScaledObject**: CRD defining how and when to scale a Deployment/StatefulSet
- **ScaledJob**: CRD for scaling Jobs (batch processing)
- **TriggerAuthentication**: CRD for securely managing trigger credentials

### ScaledObject — The Core of KEDA

\`\`\`yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: my-scaler
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1     # optional, default: apps/v1
    kind: Deployment        # Deployment, StatefulSet, etc.
    name: my-deployment

  # Replica limits
  minReplicaCount: 0        # 0 = scale-to-zero enabled!
  maxReplicaCount: 20

  # Cooldown (time before scaling down)
  cooldownPeriod: 300       # seconds (default: 300)

  # Polling interval (check frequency)
  pollingInterval: 30       # seconds (default: 30)

  # Advanced HPA configuration
  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
        scaleDown:
          stabilizationWindowSeconds: 300
          policies:
            - type: Percent
              value: 25
              periodSeconds: 60

  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka:9092
        topic: orders
        consumerGroup: my-consumer-group
        lagThreshold: "10"   # scale when lag > 10 msgs/pod
\`\`\`

### Scale-to-Zero
KEDA can reduce replicas to 0 when there are no events, saving resources:
- When events arrive → KEDA scales from 0 to minReplicaCount (minimum 1)
- When events stop → after cooldownPeriod, reduces to 0
- **Important**: when at 0 replicas, the HPA is removed and KEDA manages directly

### Main Built-in Scalers

| Scaler | Scale Trigger |
|--------|--------------|
| Kafka | Consumer group lag |
| RabbitMQ | Queue messages |
| Redis | List/Stream length |
| Prometheus | Any PromQL metric |
| CPU/Memory | Like standard HPA |
| Cron | Schedule (time-based) |
| AWS SQS | Queue messages |
| Azure Service Bus | Queue messages |
| GCP Pub/Sub | Unacked messages |
| PostgreSQL | SQL query result |
| MySQL | SQL query result |
| HTTP | Requests per second |
| GitHub Actions | Jobs awaiting runner |

### TriggerAuthentication — Managing Credentials
\`\`\`yaml
# Option 1: Direct Secret
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: kafka-auth
  namespace: default
spec:
  secretTargetRef:
    - parameter: username
      name: kafka-secret
      key: username
    - parameter: password
      name: kafka-secret
      key: password

---
# Option 2: Pod Identity (recommended for cloud)
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: aws-auth
spec:
  podIdentity:
    provider: aws-eks  # aws-eks, azure-workload, gcp-workload-identity
\`\`\`

### ScaledJob — For Batch Workloads
\`\`\`yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledJob
metadata:
  name: image-processor
  namespace: default
spec:
  jobTargetRef:
    parallelism: 1
    completions: 1
    template:
      spec:
        containers:
          - name: processor
            image: my-image-processor:latest
        restartPolicy: Never

  # Messages per Job
  maxReplicaCount: 50
  pollingInterval: 10

  # Scaling strategy
  scalingStrategy:
    strategy: accurate   # accurate | default | custom
    customScalingQueueLengthDeduction: 1
    customScalingRunningJobPercentage: "0.5"

  triggers:
    - type: rabbitmq
      metadata:
        host: amqp://rabbitmq:5672
        queueName: images-to-process
        mode: QueueLength
        value: "1"   # 1 Job per message
\`\`\`

## Essential Commands

### Installation with Helm
\`\`\`bash
# Add KEDA repository
helm repo add kedacore https://kedacore.github.io/charts
helm repo update

# Install KEDA
helm install keda kedacore/keda \\
  --namespace keda \\
  --create-namespace \\
  --version 2.14.0

# Verify installation
kubectl get pods -n keda
# Expected output:
# keda-admission-webhooks-xxx  1/1  Running
# keda-operator-xxx            1/1  Running
# keda-operator-metrics-apiserver-xxx  1/1  Running

# Verify CRDs installed
kubectl get crd | grep keda
# scaledjobs.keda.sh
# scaledobjects.keda.sh
# triggerauthentications.keda.sh
# clustertriggerauthentications.keda.sh
\`\`\`

### ScaledObject Management
\`\`\`bash
# List ScaledObjects
kubectl get scaledobjects -n default
kubectl get so -n default  # short alias

# Describe ScaledObject (see status, triggers, conditions)
kubectl describe scaledobject my-scaler -n default

# View detailed status
kubectl get scaledobject my-scaler -n default -o yaml | \\
  grep -A20 "status:"

# View HPA managed by KEDA
kubectl get hpa -n default
# Name: keda-hpa-<scaled-object-name>

# Pause scaling (useful for maintenance)
kubectl annotate scaledobject my-scaler \\
  autoscaling.keda.sh/paused-replicas="3" -n default

# Remove pause
kubectl annotate scaledobject my-scaler \\
  autoscaling.keda.sh/paused-replicas- -n default

# List ScaledJobs
kubectl get scaledjobs -n default
kubectl get sj -n default
\`\`\`

### Debug and Troubleshooting
\`\`\`bash
# View KEDA operator logs
kubectl logs -n keda -l app=keda-operator -f

# View metrics server logs
kubectl logs -n keda -l app=keda-operator-metrics-apiserver -f

# Check available external metrics
kubectl get --raw "/apis/external.metrics.k8s.io/v1beta1" | jq .

# View current value of a metric
kubectl get --raw \\
  "/apis/external.metrics.k8s.io/v1beta1/namespaces/default/s0-kafka-orders" | jq .

# Check events related to ScaledObject
kubectl get events -n default --field-selector reason=KEDAScalerFailed
kubectl get events -n default | grep -i keda
\`\`\`

## YAML Examples

### Kafka Scaler with Authentication
\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: kafka-credentials
  namespace: default
stringData:
  sasl-username: "my-user"
  sasl-password: "my-password"
  tls-ca: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----

---
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: kafka-trigger-auth
  namespace: default
spec:
  secretTargetRef:
    - parameter: sasl.user
      name: kafka-credentials
      key: sasl-username
    - parameter: sasl.password
      name: kafka-credentials
      key: sasl-password
    - parameter: ca
      name: kafka-credentials
      key: tls-ca

---
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: kafka-consumer-scaler
  namespace: default
spec:
  scaleTargetRef:
    name: order-consumer
  minReplicaCount: 1
  maxReplicaCount: 30
  pollingInterval: 15
  cooldownPeriod: 60
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: "kafka-0.kafka-headless:9093"
        consumerGroup: order-processors
        topic: orders
        lagThreshold: "20"
        activationLagThreshold: "5"
        offsetResetPolicy: latest
        allowIdleConsumers: "false"
        scaleToZeroOnInvalidOffset: "false"
        excludePersistentLag: "false"
        sasl: scram_sha256
        tls: enable
      authenticationRef:
        name: kafka-trigger-auth
\`\`\`

### Prometheus Scaler
\`\`\`yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: prometheus-scaler
  namespace: default
spec:
  scaleTargetRef:
    name: api-deployment
  minReplicaCount: 2
  maxReplicaCount: 50
  cooldownPeriod: 120
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus-operated.monitoring:9090
        metricName: http_requests_per_second
        threshold: "100"
        activationThreshold: "10"
        query: |
          sum(rate(http_requests_total{job="api-deployment"}[2m]))
        namespace: default
        ignoreNullValues: "false"
\`\`\`

### Cron Scaler (Scheduled Scaling)
\`\`\`yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: business-hours-scaler
  namespace: default
spec:
  scaleTargetRef:
    name: web-frontend
  minReplicaCount: 1
  maxReplicaCount: 20
  triggers:
    # Business hours: minimum 5 replicas
    - type: cron
      metadata:
        timezone: "America/New_York"
        start: "0 8 * * 1-5"    # Monday-Friday, 8am
        end: "0 18 * * 1-5"     # Monday-Friday, 6pm
        desiredReplicas: "5"
    # Off hours: 1 replica
    # (controlled by minReplicaCount: 1)
\`\`\`

### ScaledObject with Multiple Triggers
\`\`\`yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: multi-trigger-scaler
  namespace: default
spec:
  scaleTargetRef:
    name: worker
  minReplicaCount: 0
  maxReplicaCount: 100
  triggers:
    # Trigger 1: RabbitMQ queue
    - type: rabbitmq
      metadata:
        protocol: amqp
        queueName: tasks
        mode: QueueLength
        value: "5"
      authenticationRef:
        name: rabbitmq-auth

    # Trigger 2: CPU (fallback)
    - type: cpu
      metricType: Utilization
      metadata:
        value: "70"

    # Trigger 3: Custom metric via Prometheus
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        query: avg(pending_tasks_gauge)
        threshold: "50"
        metricName: pending_tasks
\`\`\`

## Common Mistakes

### 1. ScaledObject won't scale to zero
**Cause**: \`minReplicaCount\` not set to 0, or a manual HPA conflicting with the same Deployment.
**Fix**: Confirm \`minReplicaCount: 0\` and remove any manual HPAs targeting the same Deployment.

### 2. KEDA can't read external metrics
**Cause**: Connectivity issues with the external source (Kafka, RabbitMQ, etc.) or invalid credentials.
**Fix**: Verify TriggerAuthentication and test connectivity from the keda namespace.

### 3. HPA and KEDA conflicting
**Cause**: A manual HPA exists managing the same Deployment as the ScaledObject.
**Fix**: KEDA manages its own HPA — remove any pre-existing HPAs before creating the ScaledObject.

### 4. cooldownPeriod too high for batch workloads
**Cause**: Pods remain active too long after the queue empties.
**Fix**: Reduce \`cooldownPeriod\` (e.g., 30-60s) for fast processing workloads.

### 5. Missing activationThreshold with scale-to-zero
**Cause**: With \`minReplicaCount: 0\`, without \`activationThreshold\`, any metric > 0 activates the scaler.
**Fix**: Set \`activationThreshold\` to avoid unnecessary cold starts.

## Killer.sh Style Challenge

**Context**: An orders API has unpredictable traffic spikes. During business hours it receives ~1000 req/s; at night it drops to ~10 req/s. The team wants:
- Automatic scaling based on Prometheus metrics
- Minimum 2 pods during business hours (8am-6pm, Mon-Fri)
- Scale-to-zero allowed outside business hours
- Maximum 50 pods

Create the complete KEDA configuration for this scenario using multiple triggers.`,

  quiz: [
    {
      question: 'What is the main advantage of KEDA over native Kubernetes HPA?',
      options: [
        'KEDA supports scale-to-zero and scaling based on external events (Kafka, queues, etc.)',
        'KEDA is faster than HPA for CPU-based scaling',
        'KEDA completely replaces HPA and Metrics Server',
        'KEDA allows setting fixed replicas by time of day'
      ],
      correct: 0,
      explanation: 'Native HPA only scales based on CPU, memory, and custom metrics via the Metrics API. KEDA expands this to 60+ external sources (Kafka, RabbitMQ, Redis, Prometheus, SQS, etc.) and adds scale-to-zero — reducing to 0 replicas when there is no load.',
      reference: 'Concept: KEDA vs HPA — "What is KEDA?" section in theory.'
    },
    {
      question: 'Which KEDA CRD should be used for scaling batch processing workloads (Jobs)?',
      options: [
        'ScaledObject',
        'ScaledJob',
        'TriggerAuthentication',
        'BatchScaler'
      ],
      correct: 1,
      explanation: 'ScaledJob is the specific CRD for batch workloads — it creates new Kubernetes Jobs in response to events. ScaledObject is for continuous workloads (Deployment, StatefulSet). The key difference: ScaledJob creates new Jobs while ScaledObject adjusts replicas of existing pods.',
      reference: 'CRD: ScaledJob — "ScaledJob — For Batch Workloads" section in theory.'
    },
    {
      question: 'What happens to the HPA when a ScaledObject is configured with minReplicaCount: 0?',
      options: [
        'The HPA is kept but configured with 0 minimum replicas',
        'The HPA is removed when replicas reach 0; KEDA manages directly',
        'The HPA fails with an error when trying to scale to 0',
        'Nothing changes — HPA and KEDA operate independently'
      ],
      correct: 1,
      explanation: 'When the ScaledObject has minReplicaCount: 0 and replicas reach zero, KEDA removes the HPA (since HPA doesn\'t support 0 minimum replicas) and manages the Deployment directly. When new events arrive, KEDA scales from 0 to 1+ and recreates the HPA.',
      reference: 'Concept: scale-to-zero — "Scale-to-Zero" section in theory.'
    },
    {
      question: 'What is the purpose of the "activationThreshold" field in a KEDA trigger?',
      options: [
        'Defines the maximum number of replicas when the scaler activates',
        'Defines the minimum metric value to exit the 0-replica state',
        'Defines the wait time before starting to scale',
        'Defines the polling frequency of the external metric'
      ],
      correct: 1,
      explanation: 'activationThreshold defines the minimum metric value needed to "wake up" the deployment from 0 replicas. Without it, any value > 0 would trigger scale-up. With activationThreshold, unnecessary cold starts are avoided — for example, only wake up when Kafka lag exceeds 5 messages.',
      reference: 'Config: activationThreshold — ScaledObject examples in theory.'
    },
    {
      question: 'How do you temporarily pause automatic scaling of a ScaledObject without deleting it?',
      options: [
        'kubectl delete scaledobject my-scaler --keep-hpa',
        'kubectl annotate scaledobject my-scaler autoscaling.keda.sh/paused-replicas="N"',
        'kubectl patch scaledobject my-scaler --patch "spec.paused: true"',
        'kubectl scale scaledobject my-scaler --replicas=0'
      ],
      correct: 1,
      explanation: 'The annotation autoscaling.keda.sh/paused-replicas="N" pauses KEDA and keeps the Deployment with N fixed replicas. This is useful for maintenance, emergency deployments, or testing. To resume, remove the annotation.',
      reference: 'Commands: pause ScaledObject — "ScaledObject Management" section in theory.'
    },
    {
      question: 'Which KEDA scaler allows scaling based on any PromQL query?',
      options: [
        'metrics',
        'custom',
        'prometheus',
        'grafana'
      ],
      correct: 2,
      explanation: 'The "prometheus" scaler connects directly to Prometheus and executes any PromQL query as a scaling trigger. This allows scaling based on latency, error rates, custom queues — any metric already collected by Prometheus.',
      reference: 'Scalers: prometheus — "Main Built-in Scalers" and YAML examples in theory.'
    },
    {
      question: 'What is the difference between "pollingInterval" and "cooldownPeriod" in ScaledObject?',
      options: [
        'pollingInterval is for CPU; cooldownPeriod is for custom metrics',
        'pollingInterval defines the metric check frequency; cooldownPeriod is the wait time before scaling down',
        'Both control the same behavior — they are synonyms',
        'pollingInterval defines scale-up; cooldownPeriod defines scale-down'
      ],
      correct: 1,
      explanation: 'pollingInterval (default: 30s) defines how often KEDA queries the external source to check the metric value. cooldownPeriod (default: 300s) defines how long KEDA waits after the metric drops before reducing replicas — prevents flapping (rapid scale oscillation).',
      reference: 'Config: pollingInterval and cooldownPeriod — "ScaledObject — The Core of KEDA" section in theory.'
    },
    {
      question: 'Which KEDA CRD securely manages access credentials to external sources?',
      options: [
        'SecretProvider',
        'TriggerAuthentication',
        'ExternalSecret',
        'CredentialBinding'
      ],
      correct: 1,
      explanation: 'TriggerAuthentication is the CRD that separates credentials from the trigger definition. Supports references to Kubernetes Secrets, HashiCorp Vault, Pod Identity (AWS IRSA, Azure Workload Identity, GCP Workload Identity) — following the principle of least privilege.',
      reference: 'CRD: TriggerAuthentication — dedicated section in theory.'
    }
  ],

  flashcards: [
    {
      front: 'What is KEDA and what problem does it solve?',
      back: 'KEDA (Kubernetes Event-Driven Autoscaling) solves the limitation of native HPA:\n\nNative HPA: CPU/memory only\nKEDA: 60+ external sources\n\nKey capabilities:\n- Scale-to-zero (0 replicas with no load)\n- Event-driven: Kafka lag, RabbitMQ queue, Redis length, SQS\n- Any Prometheus metric\n- Cron scheduling\n- Batch processing with ScaledJob'
    },
    {
      front: 'What is the difference between ScaledObject and ScaledJob?',
      back: 'ScaledObject:\n- For continuous workloads (Deployment, StatefulSet)\n- Adjusts number of replicas of existing pods\n- Pods stay running waiting for work\n- Ex: always-active Kafka consumer\n\nScaledJob:\n- For batch/one-shot workloads\n- Creates new Jobs for each "unit of work"\n- Job runs, completes, and is removed\n- Ex: process each image in a separate Job'
    },
    {
      front: 'What happens with scale-to-zero in KEDA?',
      back: 'With minReplicaCount: 0:\n\n1. No events → KEDA reduces to 0 replicas after cooldownPeriod\n2. At 0 replicas → HPA is removed (HPA doesn\'t support 0)\n3. KEDA manages the Deployment directly\n4. New events arrive → KEDA scales from 0 to 1 quickly\n5. HPA is recreated to continue scaling\n\nDownside: cold start (latency to wake up)'
    },
    {
      front: 'What does TriggerAuthentication do in KEDA?',
      back: 'Separates credentials from ScaledObject:\n\nSecretTargetRef:\n- Maps K8s Secret fields to trigger parameters\n- Ex: username, password, ca-cert\n\nPodIdentity:\n- AWS EKS IRSA, Azure Workload Identity, GCP Workload Identity\n- No secrets — uses pod IAM roles\n\nNamespaced vs Cluster:\n- TriggerAuthentication: one namespace\n- ClusterTriggerAuthentication: entire cluster'
    },
    {
      front: 'How do you pause a ScaledObject without deleting it?',
      back: '# Pause with N fixed replicas\nkubectl annotate scaledobject my-scaler \\\n  autoscaling.keda.sh/paused-replicas="3"\n\n# KEDA stops scaling\n# Deployment stays with 3 static replicas\n\n# Resume automatic scaling\nkubectl annotate scaledobject my-scaler \\\n  autoscaling.keda.sh/paused-replicas-\n\nUseful for:\n- Planned maintenance\n- Emergencies (avoid scale-down during incident)\n- Controlled load tests'
    },
    {
      front: 'What are the main KEDA scalers and their triggers?',
      back: 'kafka → consumer group lag\nrabbitmq → queue messages\nredis → list/stream length\nprometheus → any PromQL\ncpu → CPU usage (like HPA)\nmemory → memory usage\ncron → scheduled time\naws-sqs-queue → SQS messages\nazure-servicebus → Service Bus messages\ngcp-pubsub → Pub/Sub messages\npostgresql → SQL query result\nhttp → requests per second\ngithub-runner → jobs waiting for runner'
    },
    {
      front: 'What are pollingInterval and cooldownPeriod?',
      back: 'pollingInterval (default: 30s):\n- How often KEDA queries the source\n- KEDA checks metric value every N seconds\n- Lower = more responsive, more load on source\n\ncooldownPeriod (default: 300s):\n- Wait time AFTER metric drops before reducing replicas\n- Prevents flapping (rapid oscillation)\n- For scale-to-zero: time to reduce to 0\n- For batch workloads: use smaller values (30-60s)'
    },
    {
      front: 'How do you check the status of a ScaledObject and its HPA?',
      back: '# View ScaledObject\nkubectl get so -n default\nkubectl describe so my-scaler -n default\n\n# View HPA managed by KEDA\nkubectl get hpa -n default\n# Name: keda-hpa-<scaled-object-name>\n\n# View current metric value\nkubectl get --raw \\\n  "/apis/external.metrics.k8s.io/v1beta1/namespaces/default/s0-kafka-orders"\n\n# View operator logs\nkubectl logs -n keda -l app=keda-operator -f'
    }
  ],

  lab: {
    scenario: 'Configure KEDA to automatically scale a queue consumer based on pending messages. Use Redis as the event source (list) and observe scale-up and scale-down behavior, including scale-to-zero.',
    objective: 'Install KEDA, configure a ScaledObject with Redis scaler, observe automatic scaling, and test scale-to-zero.',
    duration: '30-40 minutes',
    steps: [
      {
        title: 'Install KEDA and Redis in the Cluster',
        instruction: `Install KEDA via Helm in the \`keda\` namespace and deploy a simple Redis to use as an event source.

Verify all KEDA components are Running before proceeding.`,
        hints: [
          'Use the kedacore/keda Helm repository',
          'For Redis, you can use the redis:7-alpine image with a simple Deployment',
          'Check all 3 components: keda-operator, keda-operator-metrics-apiserver, and keda-admission-webhooks'
        ],
        solution: `\`\`\`bash
# Install KEDA
helm repo add kedacore https://kedacore.github.io/charts
helm repo update

helm install keda kedacore/keda \\
  --namespace keda \\
  --create-namespace

# Wait for KEDA to be ready
kubectl wait --for=condition=ready pod \\
  -l app=keda-operator -n keda --timeout=120s

# Deploy Redis
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: default
spec:
  selector:
    app: redis
  ports:
    - port: 6379
      targetPort: 6379
EOF

kubectl wait --for=condition=ready pod -l app=redis --timeout=60s
\`\`\``,
        verify: `\`\`\`bash
# Verify KEDA pods
kubectl get pods -n keda
# Expected (all Running):
# keda-admission-webhooks-xxx   1/1   Running
# keda-operator-xxx             1/1   Running
# keda-operator-metrics-apiserver-xxx  1/1  Running

# Verify CRDs installed
kubectl get crd | grep keda.sh
# Expected:
# clustertriggerauthentications.keda.sh
# scaledjobs.keda.sh
# scaledobjects.keda.sh
# triggerauthentications.keda.sh

# Verify Redis
kubectl get pods -l app=redis
# Expected: redis-xxx   1/1   Running

# Test Redis connectivity
kubectl exec -it deployment/redis -- redis-cli PING
# Expected: PONG
\`\`\``
      },
      {
        title: 'Deploy Worker and Configure ScaledObject',
        instruction: `Deploy a simple "worker" Deployment that simulates processing items from a Redis list.

Then create a ScaledObject that scales the worker based on the size of the Redis \`tasks\` list, with:
- minReplicaCount: 0 (scale-to-zero)
- maxReplicaCount: 10
- threshold: 2 (2 tasks per pod)
- cooldownPeriod: 30 (faster for the lab)`,
        hints: [
          'The worker can use busybox looping and consuming items with RPOP',
          'The Redis scaler uses listName and listLength as main parameters',
          'For scale-to-zero to work, the worker should not have fixed replicas in the Deployment'
        ],
        solution: `\`\`\`bash
# Deploy worker
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis-worker
  namespace: default
spec:
  replicas: 0  # KEDA will control this
  selector:
    matchLabels:
      app: redis-worker
  template:
    metadata:
      labels:
        app: redis-worker
    spec:
      containers:
        - name: worker
          image: redis:7-alpine
          command:
            - sh
            - -c
            - |
              while true; do
                item=\$(redis-cli -h redis RPOP tasks)
                if [ "\$item" != "" ] && [ "\$item" != "nil" ]; then
                  echo "Processing: \$item"
                  sleep 2
                else
                  echo "Queue empty, waiting..."
                  sleep 1
                fi
              done
EOF

# Create ScaledObject
kubectl apply -f - <<EOF
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: redis-worker-scaler
  namespace: default
spec:
  scaleTargetRef:
    name: redis-worker
  minReplicaCount: 0
  maxReplicaCount: 10
  cooldownPeriod: 30
  pollingInterval: 5
  triggers:
    - type: redis
      metadata:
        address: redis.default:6379
        listName: tasks
        listLength: "2"
        activationListLength: "1"
EOF

# Verify ScaledObject created
kubectl get scaledobject redis-worker-scaler
\`\`\``,
        verify: `\`\`\`bash
# Verify ScaledObject is active
kubectl get scaledobject redis-worker-scaler -n default
# Expected:
# NAME                   SCALETARGETKIND   SCALETARGETNAME  MIN  MAX  ...  ACTIVE  READY
# redis-worker-scaler    apps/Deployment   redis-worker     0    10   ...  False   True

# Verify worker has 0 replicas (no load)
kubectl get deployment redis-worker
# Expected: redis-worker   0/0   0   0

# Check HPA managed by KEDA (may not exist at 0 replicas)
kubectl get hpa -n default
# Note: with 0 replicas, HPA may not appear (expected behavior)

# Check ScaledObject events
kubectl describe scaledobject redis-worker-scaler | grep -A10 "Events:"
\`\`\``
      },
      {
        title: 'Test Scale-Up, Scale-Down and Scale-to-Zero',
        instruction: `Insert tasks into the Redis list and watch KEDA automatically scale the worker.

1. Add 20 tasks → should scale to ~10 pods (limited by max)
2. Wait for tasks to be processed → should gradually scale down
3. After queue empties + cooldown → should return to 0 replicas

Observe behavior in real-time with \`watch\`.`,
        hints: [
          'Use redis-cli LPUSH to insert tasks into the list',
          'Use watch kubectl get pods to track scaling',
          'The 30s cooldownPeriod was configured to make the lab faster',
          'KEDA checks every 5s (pollingInterval) the list size'
        ],
        solution: `\`\`\`bash
# Terminal 1: watch pods in real-time
watch kubectl get pods -l app=redis-worker

# Terminal 2: insert tasks and monitor queue

# Insert 20 tasks
kubectl exec deployment/redis -- \\
  redis-cli LPUSH tasks task-{1..20}

# Check queue size
kubectl exec deployment/redis -- redis-cli LLEN tasks
# Expected: 20

# Wait for KEDA to scale (up to pollingInterval = 5s)
kubectl get scaledobject redis-worker-scaler -w

# Watch worker replicas
kubectl get deployment redis-worker -w

# View HPA managed by KEDA
kubectl get hpa keda-hpa-redis-worker-scaler -w

# After queue empties, wait for cooldown (30s configured)
# Worker should return to 0 replicas

# Verify via Redis
kubectl exec deployment/redis -- redis-cli LLEN tasks
# Expected: 0 (after processing)

# Test new addition after scale-to-zero
sleep 40  # wait for cooldown
kubectl exec deployment/redis -- redis-cli LPUSH tasks new-task-1
# Watch scale-up from 0 to 1 pod
\`\`\``,
        verify: `\`\`\`bash
# Verify scales with load
kubectl exec deployment/redis -- redis-cli LPUSH tasks verify-{1..10}
sleep 10
kubectl get deployment redis-worker
# Expected: redis-worker   X/X  X  X  (X > 0)

# Check external metric via API
kubectl get --raw \\
  "/apis/external.metrics.k8s.io/v1beta1/namespaces/default/s0-redis-tasks" \\
  2>/dev/null | jq '.items[0].value' || echo "Metric not available (0 replicas state)"

# After tasks are processed, verify scale-to-zero
kubectl exec deployment/redis -- redis-cli DEL tasks
sleep 45  # cooldown 30s + margin
kubectl get deployment redis-worker
# Expected: redis-worker   0/0   0   0

# Check event history
kubectl get events -n default | grep -i "scaled\\|KEDA\\|replica" | tail -10
# Expected: scale-up and scale-down events recorded
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'ScaledObject not scaling — READY: False',
      difficulty: 'easy',
      symptom: 'The ScaledObject is created but the READY column shows False and the Deployment doesn\'t scale, even with events/messages at the source.',
      diagnosis: `\`\`\`bash
# Check ScaledObject status
kubectl describe scaledobject my-scaler -n default

# Check specific conditions
kubectl get scaledobject my-scaler -n default -o json | \\
  jq '.status.conditions'

# View errors in operator logs
kubectl logs -n keda -l app=keda-operator --tail=50 | \\
  grep -i "error\\|failed\\|scaler"

# Check connectivity to external source
kubectl exec -n keda deployment/keda-operator -- \\
  nc -zv kafka.default 9092 2>&1

# Check TriggerAuthentication (if used)
kubectl get triggerauthentication -n default -o yaml

# Test credentials manually
kubectl exec -n default -it debug-pod -- \\
  redis-cli -h redis -a \$PASSWORD PING
\`\`\``,
      solution: `**Cause 1**: External source unreachable (network, DNS, firewall).
\`\`\`bash
# Test from the namespace where ScaledObject is
kubectl run debug --image=redis:7-alpine --rm -it -- \\
  redis-cli -h redis.default PING
# If fails, network/DNS issue
\`\`\`

**Cause 2**: TriggerAuthentication with invalid credentials.
\`\`\`bash
# Check referenced Secret
kubectl get secret kafka-credentials -n default -o yaml

# Check mapping in TriggerAuthentication
kubectl describe triggerauthentication kafka-auth -n default

# Rotate credentials if necessary
kubectl create secret generic kafka-credentials \\
  --from-literal=username=correct-user \\
  --from-literal=password=correct-pass \\
  --dry-run=client -o yaml | kubectl apply -f -
\`\`\`

**Cause 3**: Incorrect trigger parameters.
\`\`\`bash
# See which parameters each scaler accepts
# Documentation: https://keda.sh/docs/scalers/

# Check parsing logs
kubectl logs -n keda -l app=keda-operator | \\
  grep -i "invalid\\|unknown parameter"
\`\`\``
    },
    {
      title: 'KEDA causing flapping — pods constantly oscillating',
      difficulty: 'medium',
      symptom: 'Pods keep scaling up and down rapidly (flapping). In 5 minutes, there were 20+ scale-up and scale-down events. The service is unstable.',
      diagnosis: `\`\`\`bash
# View scaling event history
kubectl get events -n default --sort-by=.lastTimestamp | \\
  grep -i "scaled\\|replica" | tail -20

# View replica count over time
kubectl describe hpa keda-hpa-my-scaler | grep -A10 "Events:"

# Check configured cooldownPeriod
kubectl get scaledobject my-scaler -o yaml | \\
  grep -i "cooldown\\|polling"

# Check lagThreshold and current metric value
kubectl get --raw \\
  "/apis/external.metrics.k8s.io/v1beta1/namespaces/default/s0-kafka-orders" | \\
  jq '.items[0].value'

# View HPA behavior
kubectl describe hpa keda-hpa-my-scaler | grep -A20 "Behavior:"
\`\`\``,
      solution: `**Cause 1**: cooldownPeriod too low — pods scale up and down too fast.
\`\`\`bash
kubectl patch scaledobject my-scaler --type merge -p '{
  "spec": {
    "cooldownPeriod": 300
  }
}'
# 300s = 5 minutes wait before scale-down
\`\`\`

**Cause 2**: threshold too close to the average metric value.
\`\`\`bash
# If metric oscillates between 8 and 12 and threshold is 10, there will be flapping
# Increase threshold to create a buffer:
kubectl patch scaledobject my-scaler --type merge -p '{
  "spec": {
    "triggers": [{
      "type": "kafka",
      "metadata": {
        "lagThreshold": "20"
      }
    }]
  }
}'
\`\`\`

**Cause 3**: Missing stabilization window in HPA behavior.
\`\`\`bash
kubectl patch scaledobject my-scaler --type merge -p '{
  "spec": {
    "advanced": {
      "horizontalPodAutoscalerConfig": {
        "behavior": {
          "scaleDown": {
            "stabilizationWindowSeconds": 300,
            "policies": [
              {"type": "Percent", "value": 25, "periodSeconds": 60}
            ]
          },
          "scaleUp": {
            "stabilizationWindowSeconds": 30
          }
        }
      }
    }
  }
}'
\`\`\``
    }
  ]
};
