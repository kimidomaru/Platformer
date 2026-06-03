window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcna-cloud-native/cloud-native-fundamentals'] = {
  theory: `# Cloud Native Fundamentals

## Exam Relevance
> Cloud Native concepts form ~14% of the KCNA exam. You need to understand the core principles, the CNCF definition, and why cloud native approaches differ from traditional monolithic applications.

## What is Cloud Native?

The **CNCF (Cloud Native Computing Foundation)** defines cloud native as:

> "Cloud native technologies empower organizations to build and run scalable applications in modern, dynamic environments such as public, private, and hybrid clouds. Containers, service meshes, microservices, immutable infrastructure, and declarative APIs exemplify this approach."

Core properties:
1. **Scalability** — scale horizontally (more instances) rather than vertically (bigger machine)
2. **Resilience** — design for failure; expect and handle component failures
3. **Observability** — logs, metrics, traces must be built-in, not afterthought
4. **Automation** — CI/CD, auto-scaling, self-healing without manual intervention
5. **Loose coupling** — services are independent and communicate via well-defined APIs

## Cloud Native vs Traditional

| Traditional | Cloud Native |
|-------------|-------------|
| Monolithic application | Microservices |
| Long-lived servers (pets) | Ephemeral containers (cattle) |
| Manual scaling | Automatic scaling |
| Deploy infrequently | Continuous delivery |
| Mutable infrastructure | Immutable infrastructure |
| Config in application | Config via environment/ConfigMaps |
| Vertical scaling | Horizontal scaling |

## The Four Pillars of Cloud Native

### 1. Microservices
- Application broken into small, independent services
- Each service has a single responsibility
- Services communicate via APIs (REST, gRPC, messaging)
- Independent deployability and scalability per service

### 2. Containers
- Lightweight, portable execution environment
- Package code + dependencies together
- Immutable: same image runs everywhere (dev, staging, prod)
- OCI (Open Container Initiative) standard defines image format

### 3. DevOps & CI/CD
- Collaboration between development and operations teams
- Continuous Integration: automated testing on every code change
- Continuous Delivery: automated deployment pipeline
- GitOps: Git as the single source of truth for desired state

### 4. Dynamic Orchestration
- Kubernetes manages container placement, scaling, health
- Self-healing: failed containers restarted automatically
- Service discovery: services find each other via DNS
- Load balancing built-in

## Pets vs Cattle

A fundamental mental model shift in cloud native:

**Pets** (traditional servers):
- Named servers (web01, db-primary)
- If sick, you nurse them back to health
- Irreplaceable — losing one is a crisis
- Manual configuration drift over time

**Cattle** (cloud native instances):
- Numbered/anonymous (pod-abc123)
- If broken, you replace it (delete + recreate)
- Interchangeable — any instance can serve any request
- Immutable — rebuilt from scratch if needed

Kubernetes enforces the cattle model: pod names are hashes, pods are deleted and recreated, not patched.

## Twelve-Factor App

A methodology for building cloud native applications:

| Factor | Description |
|--------|------------|
| Codebase | One codebase, many deploys |
| Dependencies | Explicitly declared (requirements.txt, package.json) |
| Config | Stored in environment, not code |
| Backing services | Treated as attached resources (database, cache = swappable) |
| Build, release, run | Strict separation of stages |
| Processes | Stateless, share-nothing processes |
| Port binding | Export services via port binding |
| Concurrency | Scale out via process model |
| Disposability | Fast startup, graceful shutdown |
| Dev/prod parity | Keep environments similar |
| Logs | Treat as event streams |
| Admin processes | Run as one-off processes |

## Immutable Infrastructure

Once deployed, infrastructure is never modified — only replaced:

\`\`\`
Traditional: deploy → patch → patch → patch → unknown state
Immutable:   deploy → delete → deploy new version (clean, known state)
\`\`\`

Container images are the unit of immutability:
- Build once, deploy anywhere
- No SSH + manual config changes
- Roll back by deploying previous image version

## Cloud Native Benefits for Organizations

- **Faster time to market** — small teams deploy independently
- **Cost efficiency** — pay for what you use (auto-scale down)
- **Resilience** — no single points of failure
- **Developer productivity** — standardized platforms, less ops toil
- **Innovation** — experiment with low risk (canary deploys, A/B testing)
`,
  quiz: [
    {
      question: 'Which organization defines and promotes the Cloud Native ecosystem?',
      options: [
        'OpenStack Foundation',
        'Cloud Native Computing Foundation (CNCF)',
        'Apache Software Foundation',
        'Linux Foundation (separately from CNCF)'
      ],
      correct: 1,
      explanation: 'The CNCF (Cloud Native Computing Foundation), part of the Linux Foundation, defines cloud native computing and hosts projects like Kubernetes, Prometheus, Envoy, Fluentd, and many others.',
      reference: 'What is Cloud Native section in theory — CNCF definition.'
    },
    {
      question: 'What does the "pets vs cattle" analogy describe in cloud native computing?',
      options: [
        'The difference between managed and unmanaged Kubernetes clusters',
        'Treating servers as irreplaceable individuals (pets) vs interchangeable, replaceable instances (cattle)',
        'The difference between stateful and stateless applications',
        'A cost optimization strategy for cloud resources'
      ],
      correct: 1,
      explanation: 'Pets = named, carefully maintained servers you try to keep alive. Cattle = numbered, anonymous instances you replace when broken. Cloud native embraces the cattle model — pods are replaced, not repaired.',
      reference: 'Pets vs Cattle section in theory.'
    },
    {
      question: 'Which Twelve-Factor App principle states that configuration should NOT be stored in code?',
      options: [
        'Codebase',
        'Config — stored in environment (env vars, ConfigMaps), not in code',
        'Dependencies',
        'Dev/prod parity'
      ],
      correct: 1,
      explanation: 'The Config factor requires that anything that varies between environments (dev, staging, prod) — database URLs, credentials, feature flags — is stored in environment variables or external config systems, never hardcoded.',
      reference: 'Twelve-Factor App table in theory — Config factor.'
    },
    {
      question: 'What is immutable infrastructure?',
      options: [
        'Infrastructure that cannot be deleted',
        'Servers are never modified after deployment — changes are made by replacing with new versions',
        'Using read-only persistent volumes',
        'Locking Kubernetes RBAC permissions'
      ],
      correct: 1,
      explanation: 'Immutable infrastructure means once a server/container is deployed, it is never modified in-place. Instead, you build a new image/version and replace the old one. This eliminates configuration drift and ensures consistency.',
      reference: 'Immutable Infrastructure section in theory.'
    },
    {
      question: 'What are the four main pillars of cloud native applications?',
      options: [
        'Microservices, Containers, DevOps/CI-CD, Dynamic Orchestration',
        'Kubernetes, Docker, Prometheus, Grafana',
        'Public Cloud, Private Cloud, Hybrid Cloud, Multi-Cloud',
        'Java, Python, Go, Node.js'
      ],
      correct: 0,
      explanation: 'The CNCF identifies four core cloud native pillars: Microservices (independent services), Containers (portable execution), DevOps & CI/CD (automation), and Dynamic Orchestration (Kubernetes managing placement/scaling).',
      reference: 'The Four Pillars of Cloud Native section in theory.'
    },
    {
      question: 'How does cloud native horizontal scaling differ from traditional vertical scaling?',
      options: [
        'Horizontal scaling adds more CPU/RAM to existing machines; vertical scaling adds more instances',
        'Horizontal scaling adds more instances (scale out); vertical scaling adds more resources to existing instances (scale up)',
        'They are the same — just different terminology for the same operation',
        'Horizontal scaling is for databases; vertical scaling is for web servers'
      ],
      correct: 1,
      explanation: 'Horizontal scaling (cloud native) = add more instances (pods, VMs). Vertical scaling (traditional) = make the existing instance bigger (more CPU/RAM). Cloud native prefers horizontal scaling because it enables elasticity and resilience.',
      reference: 'Cloud Native vs Traditional table in theory.'
    },
    {
      question: 'Which Twelve-Factor App principle is directly implemented by Kubernetes liveness probes?',
      options: [
        'Codebase',
        'Processes — stateless processes',
        'Disposability — fast startup and graceful shutdown',
        'Port binding'
      ],
      correct: 2,
      explanation: 'The Disposability factor requires apps to start fast and shut down gracefully. Kubernetes liveness probes detect unhealthy containers and restart them — implementing the "fast recovery" aspect of disposability.',
      reference: 'Twelve-Factor App table — Disposability factor.'
    },
    {
      question: 'What is the difference between microservices and monolithic architecture?',
      options: [
        'Microservices use containers; monoliths use virtual machines',
        'Microservices split functionality into independent, deployable services; monoliths bundle all functionality in one deployable unit',
        'Microservices only run on Kubernetes; monoliths run on bare metal',
        'Microservices are written in Go; monoliths are written in Java'
      ],
      correct: 1,
      explanation: 'A monolith packages all application functionality into one deployable unit. Microservices decompose functionality into independent services that communicate via APIs. Microservices enable independent scaling, deployment, and technology choices per service.',
      reference: 'Microservices section in The Four Pillars of Cloud Native.'
    }
  ],
  flashcards: [
    {
      front: 'What is the CNCF definition of Cloud Native?',
      back: '"Cloud native technologies empower organizations to build and run scalable applications in modern, dynamic environments such as public, private, and hybrid clouds."\n\nKey enablers: containers, service meshes, microservices, immutable infrastructure, declarative APIs.\n\nCore properties: scalability, resilience, observability, automation, loose coupling.'
    },
    {
      front: 'What are the 4 pillars of cloud native?',
      back: '1. Microservices — small, independent services with single responsibilities\n2. Containers — portable, immutable execution environments\n3. DevOps & CI/CD — automation from code to production\n4. Dynamic Orchestration — Kubernetes manages placement, scaling, healing\n\nAll four work together to enable cloud native benefits.'
    },
    {
      front: 'What is the Pets vs Cattle analogy?',
      back: 'Pets: named servers (web01, db-master), carefully maintained, irreplaceable — if sick, you fix them\n\nCattle: numbered instances (pod-a1b2c3), anonymous, interchangeable — if broken, replace it\n\nKubernetes enforces cattle model:\n- Pods have random names\n- Failed pods are deleted and recreated\n- Never SSH to patch a pod — rebuild the image'
    },
    {
      front: 'What is immutable infrastructure?',
      back: 'Never modify deployed infrastructure — always replace:\n\nTraditional: server → patch → patch → drift → unknown state\nImmutable: build image → deploy → if change needed → build new image → replace\n\nBenefits:\n- No configuration drift\n- Identical environments (dev = staging = prod)\n- Reliable rollback (deploy previous image)'
    },
    {
      front: 'What are the key Twelve-Factor App principles for cloud native?',
      back: 'Config: store in env vars, not code\nProcesses: stateless, share-nothing\nDisposability: fast start, graceful shutdown\nLogs: treat as event streams (stdout)\nBacking services: database/cache as attached resources\nDev/prod parity: keep environments similar\nConcurrency: scale via process model (horizontal)\n\nThese principles map directly to Kubernetes features.'
    },
    {
      front: 'How does cloud native relate to Kubernetes specifically?',
      back: 'Kubernetes implements cloud native principles:\n- Microservices: each Service/Deployment is a microservice\n- Containers: pods run OCI containers\n- Immutability: pod specs declare desired image (immutable)\n- Dynamic orchestration: Kubernetes schedules, scales, heals\n- Declarative APIs: kubectl apply -f (declare desired state)\n- Observability: kubectl logs, metrics-server, Prometheus'
    }
  ],
  lab: {
    scenario: 'Understanding cloud native principles helps you make better architecture decisions. In this lab, you explore how Kubernetes implements cloud native concepts in practice.',
    objective: 'Connect abstract cloud native principles (immutability, disposability, self-healing, horizontal scaling) to concrete Kubernetes behaviors.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Observe Self-Healing (Cloud Native Resilience)',
        instruction: `Observe Kubernetes self-healing, a core cloud native principle:

1. Create a Deployment with 3 replicas of nginx
2. Delete one pod manually (simulate failure)
3. Watch Kubernetes automatically restore 3 replicas
4. This demonstrates the "cattle" model — pods are replaced, not repaired`,
        hints: [
          'kubectl create deployment selfheal --image=nginx:1.25 --replicas=3',
          'kubectl delete pod <one-of-the-pods>',
          'kubectl get pods -w to watch replacement being created',
          'The ReplicaSet controller detects 2 pods and creates a 3rd'
        ],
        solution: `\`\`\`bash
# Create deployment
kubectl create deployment selfheal --image=nginx:1.25 --replicas=3
kubectl rollout status deployment/selfheal
kubectl get pods -l app=selfheal

# Note a pod name
POD_TO_DELETE=$(kubectl get pods -l app=selfheal -o jsonpath='{.items[0].metadata.name}')
echo "Deleting: $POD_TO_DELETE"

# Delete one pod (simulating failure)
kubectl delete pod $POD_TO_DELETE &

# Watch self-healing in action
kubectl get pods -l app=selfheal -w
# You should see: old pod Terminating, new pod Pending → Running

# The new pod has a different name (cattle, not pet!)
kubectl get pods -l app=selfheal
# Expected: still 3 pods, but different names from before

kubectl delete deployment selfheal
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -l app=selfheal
# Expected: 3/3 Running after brief replacement period
\`\`\``
      },
      {
        title: 'Demonstrate Horizontal Scaling',
        instruction: `Show horizontal scaling — a key cloud native principle:

1. Create a Deployment with 1 replica
2. Scale to 5 replicas (horizontal scaling = more instances)
3. Observe all pods run simultaneously on different nodes
4. Scale back to 1 (scale down on demand)
5. Compare this to vertical scaling (which would require bigger nodes)`,
        hints: [
          'kubectl create deployment hscale --image=nginx:1.25',
          'kubectl scale deployment hscale --replicas=5',
          'kubectl get pods -o wide shows which node each pod runs on',
          'kubectl scale deployment hscale --replicas=1 to scale down'
        ],
        solution: `\`\`\`bash
# Start with 1 replica
kubectl create deployment hscale --image=nginx:1.25
kubectl get pods -l app=hscale

# Scale OUT (horizontal = add more instances)
kubectl scale deployment hscale --replicas=5
kubectl rollout status deployment/hscale

# Observe pods distributed across nodes
kubectl get pods -l app=hscale -o wide
# Shows NODENAME column — multiple nodes in use

# Scale back DOWN on demand
kubectl scale deployment hscale --replicas=1
kubectl get pods -l app=hscale

kubectl delete deployment hscale
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployment hscale
# Expected: READY = 5/5 after scale-out
\`\`\``
      },
      {
        title: 'Implement Config Separation (Twelve-Factor: Config)',
        instruction: `Implement the Twelve-Factor "Config" principle:

1. Create a ConfigMap with application configuration (not hardcoded in the image)
2. Create a Deployment that injects config via environment variables
3. Update the ConfigMap to change config without rebuilding the image
4. Observe that config changes are external to the application image`,
        hints: [
          'kubectl create configmap app-config --from-literal=APP_ENV=production --from-literal=LOG_LEVEL=info',
          'Use envFrom: configMapRef in pod spec to inject all keys as env vars',
          'kubectl exec to verify: kubectl exec <pod> -- env | grep APP_ENV',
          'Config change without image rebuild = cloud native config principle'
        ],
        solution: `\`\`\`bash
# Create external config (NOT baked into image)
kubectl create configmap app-config \
  --from-literal=APP_ENV=production \
  --from-literal=LOG_LEVEL=info \
  --from-literal=MAX_CONNECTIONS=100

# Deployment that consumes config via env vars
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: twelve-factor-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: twelve-factor
  template:
    metadata:
      labels:
        app: twelve-factor
    spec:
      containers:
      - name: app
        image: nginx:1.25
        envFrom:
        - configMapRef:
            name: app-config
EOF

kubectl rollout status deployment/twelve-factor-app

# Verify config is injected (not hardcoded)
POD=$(kubectl get pods -l app=twelve-factor -o jsonpath='{.items[0].metadata.name}')
kubectl exec $POD -- env | grep -E "APP_ENV|LOG_LEVEL|MAX_CONN"

# Change config WITHOUT rebuilding image
kubectl patch configmap app-config --type merge \
  -p '{"data":{"LOG_LEVEL":"debug","MAX_CONNECTIONS":"200"}}'

# Config change takes effect on pod restart (env vars) or ~1 min (volume mounts)
kubectl rollout restart deployment/twelve-factor-app
POD=$(kubectl get pods -l app=twelve-factor -o jsonpath='{.items[0].metadata.name}')
kubectl exec $POD -- env | grep LOG_LEVEL
# Expected: LOG_LEVEL=debug

kubectl delete deployment twelve-factor-app
kubectl delete configmap app-config
\`\`\``,
        verify: `\`\`\`bash
# Config injected as env vars
POD=$(kubectl get pods -l app=twelve-factor -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -n "$POD" ]; then
  kubectl exec $POD -- env | grep APP_ENV
  # Expected: APP_ENV=production
fi
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Application Stores State in Container Filesystem (Violates Cloud Native)',
      difficulty: 'easy',
      symptom: 'When pods restart or scale, data is lost. Application writes files locally inside the container instead of to a volume or external service.',
      diagnosis: `\`\`\`bash
# Check if app writes to container filesystem
kubectl exec <pod> -- df -h
# / (root) should be small and read-only ideally

# Find what the app writes to
kubectl exec <pod> -- find / -newer /proc/1 -type f 2>/dev/null | head -20
# Shows recently written files

# Check if data survives pod restart
kubectl delete pod <pod>
# New pod created — check if data is still there
kubectl exec <new-pod> -- ls /path/to/data
# If empty: data was NOT persisted
\`\`\``,
      solution: `**Cloud native fix: externalize state**

Option A: Use a PersistentVolumeClaim for file-based state:
\`\`\`yaml
spec:
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: app-data-pvc
  containers:
  - name: app
    volumeMounts:
    - name: data
      mountPath: /app/data
\`\`\`

Option B: Use an external service (database, object storage):
\`\`\`yaml
# Store data in a database, Redis, or S3 instead of local files
# The pod becomes truly stateless (cattle, not pet)
# Reference via environment variables:
env:
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: db-credentials
      key: url
\`\`\``
    },
    {
      title: 'Config Hardcoded in Container Image',
      difficulty: 'medium',
      symptom: 'Different environments (dev, staging, prod) require rebuilding the container image because configuration is hardcoded. Teams cannot deploy the same image to different environments.',
      diagnosis: `\`\`\`bash
# Check if config is in the image
kubectl exec <pod> -- cat /app/config.yaml
# Or check env vars set in Dockerfile (visible in image metadata)

docker inspect <image> | grep -A20 '"Env"'
# May show: APP_ENV=production hardcoded in image

# Check if Dockerfile has hardcoded values
# FROM node:20
# ENV DATABASE_URL=postgres://prod-db:5432/app  ← WRONG
\`\`\``,
      solution: `**Cloud native fix: externalize configuration (Twelve-Factor Config)**

\`\`\`bash
# Remove hardcoded config from Dockerfile
# ENV DATABASE_URL=... ← REMOVE THIS

# Create Secrets/ConfigMaps per environment
kubectl create secret generic app-secrets \
  --from-literal=DATABASE_URL=postgres://dev-db:5432/app \
  --namespace=development

kubectl create secret generic app-secrets \
  --from-literal=DATABASE_URL=postgres://prod-db:5432/app \
  --namespace=production

# Same image, different config per namespace
spec:
  containers:
  - name: app
    image: myapp:v1.0       # Same image
    envFrom:
    - secretRef:
        name: app-secrets   # Different secrets per namespace
\`\`\``
    }
  ]
};
