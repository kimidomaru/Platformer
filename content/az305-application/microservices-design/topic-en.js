window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-application/microservices-design'] = {
  theory: `# Microservices Design on Azure (AZ-305)

## Exam Relevance
> Estimated weight **10-15%** in AZ-305. Questions about choosing a container platform (AKS, Container Apps, ACI), service discovery, and inter-service communication.

## Microservices Platforms on Azure

\`\`\`
Control          AKS             Container Apps       ACI
    ↑          Kubernetes          Serverless K8s       Simple
    |          managed            (built on K8s)        no orch.
    |          Full control        KEDA autoscale        burst
    ↓          Complex ops         Simple ops            jobs
Simplicity
\`\`\`

### When to use each platform

| Scenario | Platform |
|----------|---------|
| Multiple teams, heterogeneous workloads, full control | AKS |
| Serverless microservices, KEDA, without managing K8s | Azure Container Apps |
| Short-lived containers, CI/CD runners, batch | ACI |
| Long-running stateful apps, maximum control | AKS with StatefulSets |

## Azure Container Apps — Design

\`\`\`yaml
# Container App with HTTP autoscaling
apiVersion: 2023-05-01
kind: ContainerApp
properties:
  configuration:
    ingress:
      external: true
      targetPort: 8080
      traffic:
        - latestRevision: true
          weight: 90
        - revisionName: myapp--v2
          weight: 10      # canary 10%
  scale:
    minReplicas: 0        # scale to zero
    maxReplicas: 20
    rules:
      - name: http-rule
        http:
          metadata:
            concurrentRequests: 100
  template:
    containers:
      - name: myapp
        image: myacr.azurecr.io/myapp:v3
        resources:
          cpu: 0.5
          memory: 1Gi
        env:
          - name: DB_CONNECTION
            secretRef: db-connection
\`\`\`

### Dapr Integration in Container Apps

\`\`\`bash
# Enable Dapr in Container App
az containerapp update \
  --name myapp \
  --resource-group myRG \
  --enable-dapr true \
  --dapr-app-id myapp \
  --dapr-app-port 8080 \
  --dapr-app-protocol http

# With Dapr, services communicate by logical name:
# POST http://localhost:3500/v1.0/invoke/payment-service/method/pay
# (Dapr resolves the real address automatically)
\`\`\`

## Pattern: Service Discovery

### AKS — Native Kubernetes DNS

\`\`\`
Service A → http://payment-service.payments.svc.cluster.local:8080
            ↑ service name ↑ namespace ↑ k8s domain
\`\`\`

### Container Apps — Service Discovery via Container Apps Environment

\`\`\`bash
# Containers in the same Environment communicate by app name
# POST http://payment-service/pay
# (no port, no namespace)
\`\`\`

## Pattern: Circuit Breaker

\`\`\`python
# Circuit Breaker with Resilience4j (Python: tenacity + custom)
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=30)
def call_payment_service(order_id):
    response = requests.post(
        "http://payment-service/pay",
        json={"orderId": order_id},
        timeout=5
    )
    response.raise_for_status()
    return response.json()

# If 5 failures in 30s → circuit OPEN → returns fast error
# After 30s → circuit HALF-OPEN → tries again
\`\`\`

## Pattern: Health Checks & Readiness

\`\`\`yaml
# Kubernetes health probes
livenessProbe:
  httpGet:
    path: /health/live
    port: 8080
  initialDelaySeconds: 30
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 8080
  initialDelaySeconds: 5
  failureThreshold: 3
  # Endpoint returns 200 only when:
  # - DB connection ok
  # - External dependencies ok
  # - Cache warm (if needed)
\`\`\`

## Common Design Mistakes

1. **Microservices too granular**: one microservice per table is an anti-pattern. Define by bounded context (domain).
2. **Excessive synchronous communication**: chains of synchronous HTTP calls increase latency and coupling. Use async where possible.
3. **No health checks**: without liveness/readiness, Kubernetes does not know when to restart or remove a pod from the pool.
4. **Container Apps for stateful workloads**: Container Apps do not natively support complex persistent volumes — use AKS with PVs.
5. **Ignoring circuit breaker**: external dependencies that fail cause cascading failures without a circuit breaker.

## Killer.sh Style Challenge (AZ-305)

> An e-learning platform has: authentication (100k req/hour), courses (10k req/hour), video (streaming, 1M req/hour), payments (5k req/hour, critical ACID). Design the microservices platform.
>
> **Answer**: Azure Container Apps Environment for auth, courses, payments (serverless, scale-to-zero, KEDA). AKS for the video streaming service (I/O intensive, requires node pool tuning). Dapr for inter-service communication. Circuit breaker in the payment service. Application Gateway + WAF in front. Azure Front Door for video CDN.
`,

  quiz: [
    {
      question: 'When should you choose Azure Container Apps instead of Azure Kubernetes Service (AKS)?',
      options: [
        'Container Apps is always cheaper than AKS',
        'Container Apps is ideal for microservices that benefit from serverless (scale-to-zero, KEDA, Dapr) without the operational complexity of Kubernetes',
        'Container Apps supports more workloads than AKS',
        'AKS does not support autoscaling, so Container Apps is required'
      ],
      correct: 1,
      explanation: 'Azure Container Apps abstracts Kubernetes (it is built on K8s) and offers: automatic scale-to-zero, native KEDA for scaling by queue/event metrics, integrated Dapr for service mesh/invocation, and revisions/traffic for canary deployments — without you needing to manage nodes, node pools, or K8s upgrades. Use AKS when you need full control: custom node configurations, GPUs, advanced networking, or workloads that do not fit the Container Apps model.',
      reference: 'Platform table — Container Apps = serverless K8s for microservices; AKS = managed K8s for complex workloads.'
    },
    {
      question: 'What is the Circuit Breaker pattern and why is it essential in microservices?',
      options: [
        'It is an authentication mechanism between microservices',
        'It prevents cascading failures: when a dependent service fails repeatedly, the circuit breaker "opens" and returns a fast error without calling the failing service, protecting the system',
        'It is a load balancer between instances of a microservice',
        'It is the blue-green deployment strategy for microservices'
      ],
      correct: 1,
      explanation: 'Without Circuit Breaker: Service A calls Service B (which is slow) → A waits → threads are exhausted → A becomes slow too → the entire system cascades and fails. With Circuit Breaker: after N failures, the circuit OPENS, Service A returns immediate error without waiting for B, preserving resources. After a timeout, it tries again (HALF-OPEN). This limits the blast radius of failures from dependent services.',
      reference: 'Circuit Breaker section — implement with Istio, Dapr, or libraries such as tenacity (Python) or Polly (.NET).'
    }
  ],

  flashcards: [
    {
      front: 'What are the fundamental principles of microservices design?',
      back: '1. **Single Responsibility**: each service does one thing well (Bounded Context)\n2. **Own your data**: each service has its own database (database per service)\n3. **API-first**: explicit contracts (OpenAPI, gRPC)\n4. **Fail gracefully**: circuit breakers, timeouts, fallbacks\n5. **Design for failure**: any dependency can fail\n6. **Observable**: health checks, distributed tracing, structured logs\n7. **Independently deployable**: deploy without coordinating other teams\n\n**Anti-patterns**: shared database, too granular microservices, long sync chains'
    },
    {
      front: 'How does Azure Container Apps implement canary deployment natively?',
      back: '**Container Apps Revisions** = each deploy creates a new immutable revision.\n\n**Traffic splitting**:\n```bash\naz containerapp ingress traffic set \\\n  --name myapp --resource-group myRG \\\n  --revision-weight \\\n    latest=90 \\\n    myapp--previous-revision=10\n# 90% new, 10% old\n```\n\n**Full promotion**:\n```bash\n--revision-weight latest=100\n```\n\n**Rollback**:\n```bash\n--revision-weight myapp--previous-revision=100\n```\n\nNo Argo Rollouts, no Helm — native in Container Apps.'
    }
  ],

  lab: {
    scenario: 'Create a Container App with autoscaling and traffic splitting to simulate canary deployment.',
    objective: 'Explore Azure Container Apps, revision management, and traffic splitting.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Container Apps Environment and first app',
        instruction: 'Create a Container Apps Environment and deploy a test container.',
        hints: ['az containerapp env create', 'az containerapp create --image'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-microservices-lab --location eastus

# Create Environment
az containerapp env create \
  --name microservices-env \
  --resource-group rg-microservices-lab \
  --location eastus

# Deploy first app (nginx as placeholder)
az containerapp create \
  --name webapp \
  --resource-group rg-microservices-lab \
  --environment microservices-env \
  --image nginx:alpine \
  --target-port 80 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 5 \
  --cpu 0.25 --memory 0.5Gi

URL=$(az containerapp show --name webapp --resource-group rg-microservices-lab --query "properties.configuration.ingress.fqdn" -o tsv)
echo "App URL: https://$URL"
echo "SUFFIX=\${SUFFIX}" > /tmp/microlab.sh
\`\`\``,
        verify: `\`\`\`bash
az containerapp show --name webapp --resource-group rg-microservices-lab \
  --query "{Name:name,FQDN:properties.configuration.ingress.fqdn,Status:properties.provisioningState}" -o table
# Expected: webapp, URL available, Succeeded
\`\`\``
      },
      {
        title: 'Simulate canary with traffic splitting',
        instruction: 'Deploy a new version and split traffic 80/20 between v1 and v2.',
        hints: ['az containerapp update creates a new revision', 'az containerapp ingress traffic set for split'],
        solution: `\`\`\`bash
# Deploy new version (nginx:1.25 as v2)
az containerapp update \
  --name webapp \
  --resource-group rg-microservices-lab \
  --image nginx:1.25 \
  --revision-suffix v2

# List available revisions
az containerapp revision list \
  --name webapp \
  --resource-group rg-microservices-lab \
  --query "[].{Name:name,Active:properties.active,Traffic:properties.trafficWeight}" -o table

# Split traffic 80% v1 / 20% v2 (canary)
LATEST_REVISION=$(az containerapp revision list \
  --name webapp --resource-group rg-microservices-lab \
  --query "[?properties.active].name | [0]" -o tsv)

PREV_REVISION=$(az containerapp revision list \
  --name webapp --resource-group rg-microservices-lab \
  --query "[-2].name" -o tsv)

az containerapp ingress traffic set \
  --name webapp --resource-group rg-microservices-lab \
  --revision-weight "$LATEST_REVISION=20" "$PREV_REVISION=80"

echo "Canary active: 20% v2, 80% v1"
\`\`\``,
        verify: `\`\`\`bash
az containerapp ingress traffic show \
  --name webapp --resource-group rg-microservices-lab \
  --query "[].{Revision:revisionName,Weight:weight}" -o table
# Expected: two entries, summing to 100%

az group delete --name rg-microservices-lab --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Container App not scaling to zero despite min-replicas=0',
      difficulty: 'easy',
      symptom: 'A Container App configured with min-replicas=0 keeps at least 1 active replica even with no traffic, generating unnecessary cost.',
      diagnosis: `\`\`\`bash
az containerapp show --name myapp --resource-group myRG \
  --query "properties.template.scale.{Min:minReplicas,Max:maxReplicas,Rules:rules}" -o json
\`\`\``,
      solution: `**Common causes**:

1. **External ingress without scaling rule**: Container Apps needs an HTTP scale rule to know when to scale to zero:
\`\`\`bash
az containerapp update --name myapp --resource-group myRG \
  --scale-rule-name http-scaling \
  --scale-rule-http-concurrency 100
\`\`\`

2. **HTTP scale rule not configured but Ingress enabled**: when creating the app with ingress but no scale rule, Container Apps keeps 1 replica to ensure responsiveness.

3. **Dapr sidecar enabled**: Dapr may keep a process active. Check whether it is needed for this app.

4. **min-replicas was updated but not applied**: verify that the update command was successful:
\`\`\`bash
az containerapp revision list --name myapp --resource-group myRG --query "[?properties.active]"
\`\`\``
    }
  ]
};
