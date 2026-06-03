window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcna-k8s-fundamentals/k8s-resources'] = {
  theory: `# Kubernetes Resources

## Exam Relevance
> Understanding core Kubernetes resource types is fundamental to KCNA (~46% Kubernetes Fundamentals). You need to know what each resource does, when to use it, and how they relate to each other.

## Resource Hierarchy

\`\`\`
Namespace
  └── Deployment
        └── ReplicaSet
              └── Pod
                    └── Container(s)
\`\`\`

## Core Workload Resources

### Pod
The smallest deployable unit. One or more containers sharing network and storage.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
  - name: app
    image: nginx:1.25
    ports:
    - containerPort: 80
\`\`\`

### ReplicaSet
Ensures a specified number of pod replicas are running. Rarely created directly — use Deployments.

### Deployment
Manages ReplicaSets for declarative updates and rollbacks.

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:             # Pod template
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app
        image: nginx:1.25
\`\`\`

### StatefulSet
Like Deployment, but for stateful applications. Provides:
- Stable, persistent pod identities (web-0, web-1, web-2)
- Ordered, graceful deployment and scaling
- Stable network identities (DNS per pod)
- Persistent storage per pod

Use for: databases (MySQL, PostgreSQL, Cassandra), message queues, Kafka.

### DaemonSet
Ensures a pod runs on **every** node (or selected nodes). Used for: log collectors, node monitoring agents, CNI plugins.

### Job
Runs a pod to completion (one-time task). Tracks successful completions.

### CronJob
Runs Jobs on a schedule (cron syntax). Like cron for Kubernetes.

## Service Resources

### Service
Stable network endpoint for a set of pods (selected by labels).

| Type | Accessibility |
|------|--------------|
| ClusterIP | Within cluster only (default) |
| NodePort | Cluster + NodeIP:Port from outside |
| LoadBalancer | External load balancer (cloud) |
| ExternalName | CNAME to external DNS |

### Ingress
HTTP/HTTPS routing rules. Routes external traffic to services based on host/path.

## Configuration Resources

### ConfigMap
Non-sensitive key-value configuration data. Injected as env vars or volume-mounted files.

### Secret
Sensitive data (passwords, tokens, keys). Base64-encoded by default; use encryption at rest for security.

## Storage Resources

### PersistentVolume (PV)
Cluster-level storage resource (provisioned by admin or dynamically).

### PersistentVolumeClaim (PVC)
Namespace-level request for storage. Binds to a matching PV.

### StorageClass
Template for dynamic PV provisioning.

## RBAC Resources

### ServiceAccount
Identity for processes running in pods (not human users).

### Role / ClusterRole
Defines permissions (what can be done: get, list, create, delete).

### RoleBinding / ClusterRoleBinding
Assigns a Role to a Subject (user, group, ServiceAccount).

## Namespace

Logical isolation of resources within a cluster. Resources in different namespaces can coexist with the same names.

\`\`\`bash
# Create namespace
kubectl create namespace staging

# Work within a namespace
kubectl get pods -n staging

# Default namespace if not specified
kubectl config set-context --current --namespace=staging
\`\`\`

## Resource Relationships

\`\`\`
Deployment → manages → ReplicaSet → manages → Pods
Service    → selects  → Pods (via label selector)
Ingress    → routes to → Service
PVC        → binds to  → PV
Pod        → uses      → ConfigMap, Secret (as env/volume)
Pod        → has       → ServiceAccount
\`\`\`

## Common kubectl Commands

\`\`\`bash
# List resources
kubectl get pods,deployments,services

# Describe resource
kubectl describe pod my-pod

# Create from YAML
kubectl apply -f manifest.yaml

# Delete resource
kubectl delete pod my-pod

# Get YAML of existing resource
kubectl get deployment my-deployment -o yaml

# Edit resource live
kubectl edit deployment my-deployment

# Scale
kubectl scale deployment my-deployment --replicas=5

# Expose a deployment as a service
kubectl expose deployment my-deployment --port=80 --type=ClusterIP
\`\`\`
`,
  quiz: [
    {
      question: 'What is the relationship between a Deployment, ReplicaSet, and Pod?',
      options: [
        'They are all identical — just different names for the same thing',
        'Deployment manages ReplicaSets; ReplicaSet manages Pods',
        'Pod manages ReplicaSet; ReplicaSet manages Deployment',
        'Deployment manages Pods directly without a ReplicaSet'
      ],
      correct: 1,
      explanation: 'Deployment manages ReplicaSets (creating a new one on each update). ReplicaSet maintains the desired pod count. Pods are the actual containers. This hierarchy enables rolling updates and rollbacks.',
      reference: 'Resource Hierarchy and Deployment section in theory.'
    },
    {
      question: 'When should you use a StatefulSet instead of a Deployment?',
      options: [
        'When you need more than 3 replicas',
        'When the application requires stable network identities, ordered scaling, and per-pod persistent storage (e.g., databases)',
        'When deploying on multiple clusters',
        'When using Helm charts'
      ],
      correct: 1,
      explanation: 'StatefulSet provides stable pod names (web-0, web-1), stable DNS per pod, and ordered startup/shutdown. Use it for stateful applications like databases, message queues, and any application where pod identity matters.',
      reference: 'StatefulSet section in theory.'
    },
    {
      question: 'What is the purpose of a DaemonSet?',
      options: [
        'Runs background jobs on a schedule',
        'Ensures exactly one pod runs on every node (or selected nodes)',
        'Manages stateful applications with stable network identities',
        'Provides horizontal pod autoscaling'
      ],
      correct: 1,
      explanation: 'DaemonSet ensures one pod runs on each node. When a new node joins the cluster, the DaemonSet automatically creates a pod on it. Used for cluster-level services like log collectors, monitoring agents, and CNI plugins.',
      reference: 'DaemonSet section in theory.'
    },
    {
      question: 'What is the difference between a ConfigMap and a Secret?',
      options: [
        'ConfigMaps are for files; Secrets are for environment variables',
        'ConfigMaps store non-sensitive config; Secrets store sensitive data (passwords, keys)',
        'ConfigMaps are cluster-scoped; Secrets are namespace-scoped',
        'They are identical — just different names'
      ],
      correct: 1,
      explanation: 'Both ConfigMap and Secret store key-value data. The key difference: ConfigMaps are for non-sensitive configuration. Secrets are for sensitive data and are base64-encoded (not encrypted by default, but can be). Access to Secrets can be restricted via RBAC.',
      reference: 'Configuration Resources section in theory.'
    },
    {
      question: 'What does a PersistentVolumeClaim (PVC) do?',
      options: [
        'Creates storage on the node filesystem',
        'A namespace-level request for persistent storage that binds to a matching PersistentVolume',
        'Claims ownership of a running container',
        'Reserves CPU and memory for a pod'
      ],
      correct: 1,
      explanation: 'A PVC is a request for storage (specifying size, access mode, StorageClass). Kubernetes binds it to a matching PersistentVolume. Pods reference the PVC — not the PV directly. This decouples the pod from storage implementation details.',
      reference: 'Storage Resources section in theory.'
    },
    {
      question: 'Which Service type makes a service accessible from outside the cluster via a cloud load balancer?',
      options: [
        'ClusterIP',
        'NodePort',
        'LoadBalancer',
        'ExternalName'
      ],
      correct: 2,
      explanation: 'LoadBalancer type provisions an external load balancer via the cloud provider. Traffic flows: Internet → LB → NodePort → ClusterIP → Pods. It is the standard way to expose services externally in cloud environments.',
      reference: 'Service Resources — Service Types table in theory.'
    },
    {
      question: 'What is the purpose of a Namespace in Kubernetes?',
      options: [
        'Provides network isolation between pods',
        'Groups and logically isolates resources within a cluster (separate environments, teams, or applications)',
        'Defines the container image to use',
        'Specifies which node a pod runs on'
      ],
      correct: 1,
      explanation: 'Namespaces provide logical isolation — resources with the same name can coexist in different namespaces (e.g., "nginx" pod in "dev" and "prod" namespaces). They also provide a scope for RBAC policies and resource quotas.',
      reference: 'Namespace section in theory.'
    },
    {
      question: 'What is the difference between a Job and a CronJob?',
      options: [
        'Jobs run continuously; CronJobs run once',
        'Jobs run once to completion; CronJobs run Jobs on a cron schedule',
        'Jobs are for databases; CronJobs are for web servers',
        'CronJobs can have more replicas than Jobs'
      ],
      correct: 1,
      explanation: 'A Job runs a pod to completion (one-time batch task). A CronJob creates Jobs according to a cron schedule (e.g., "0 1 * * *" for daily at 1am). CronJob is essentially a scheduler wrapper around Job.',
      reference: 'Job and CronJob sections in Core Workload Resources.'
    }
  ],
  flashcards: [
    {
      front: 'What is the Deployment → ReplicaSet → Pod hierarchy?',
      back: 'Deployment: manages rolling updates and rollbacks. Creates and manages ReplicaSets.\n\nReplicaSet: ensures N pod replicas are running. Creates/deletes pods to maintain count.\n\nPod: the actual running container(s).\n\nWhen you run kubectl apply with a new image → Deployment creates new ReplicaSet → new pods created → old ReplicaSet scales to 0'
    },
    {
      front: 'When do you use StatefulSet vs Deployment?',
      back: 'Deployment: stateless apps (web servers, APIs, microservices)\n- Pods are interchangeable\n- Any pod can handle any request\n\nStatefulSet: stateful apps (databases, message queues, Kafka)\n- Stable pod names: web-0, web-1, web-2\n- Ordered startup/shutdown\n- Per-pod persistent storage\n- Stable DNS: web-0.svc.default.svc.cluster.local'
    },
    {
      front: 'What are the 4 Service types and when to use each?',
      back: 'ClusterIP: internal cluster access only (default). Microservice-to-microservice.\n\nNodePort: expose on NodeIP:30000-32767. Dev/test external access.\n\nLoadBalancer: cloud LB, external access in production.\n\nExternalName: CNAME to external DNS (e.g., map "database" to "rds.amazonaws.com").'
    },
    {
      front: 'What is the difference between ConfigMap and Secret?',
      back: 'ConfigMap: non-sensitive configuration\n- App settings, feature flags, file paths\n- Stored as plain text in etcd\n\nSecret: sensitive data\n- Passwords, API keys, TLS certificates\n- Base64-encoded (not encrypted by default)\n- Can restrict access via RBAC\n- Can enable encryption at rest\n\nBoth can be injected as env vars or volume mounts.'
    },
    {
      front: 'What does a Namespace provide?',
      back: 'Logical isolation within a cluster:\n\n1. Resource scope: same name can exist in different namespaces\n2. RBAC scope: Role/RoleBinding are namespace-scoped\n3. ResourceQuota scope: limit resources per namespace\n4. Network isolation (with NetworkPolicy)\n\nSystem namespaces: kube-system, kube-public, kube-node-lease\nDefault for user workloads: default (or custom namespaces)'
    },
    {
      front: 'PersistentVolume vs PersistentVolumeClaim — what is the difference?',
      back: 'PersistentVolume (PV): cluster-level storage resource\n- Created by admin or dynamically by StorageClass\n- Defines: capacity, access modes, reclaimPolicy\n- Not namespace-scoped\n\nPersistentVolumeClaim (PVC): namespace-level storage request\n- Created by user/application\n- Binds to matching PV\n- Pod references PVC (not PV directly)\n\nFlow: PVC created → matches PV → bound → pod mounts PVC'
    }
  ],
  lab: {
    scenario: 'Understanding core Kubernetes resources is essential for all certification exams. This lab explores the most important resource types and their relationships.',
    objective: 'Create and inspect core Kubernetes resources, understanding their relationships and practical use cases.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Explore the Deployment → ReplicaSet → Pod Hierarchy',
        instruction: `Create a Deployment and explore the object hierarchy:

1. Create a Deployment with 3 replicas
2. Observe the ReplicaSet it creates
3. Observe the Pods the ReplicaSet creates
4. Delete a pod and watch the ReplicaSet self-heal`,
        hints: [
          'kubectl create deployment web --image=nginx:1.25 --replicas=3',
          'kubectl get replicasets (or kubectl get rs)',
          'kubectl get pods shows pods created by the ReplicaSet',
          'kubectl describe replicaset shows owner reference to Deployment'
        ],
        solution: `\`\`\`bash
# Create Deployment
kubectl create deployment web --image=nginx:1.25 --replicas=3
kubectl rollout status deployment/web

# View the hierarchy
kubectl get deployment web
kubectl get replicaset -l app=web
kubectl get pods -l app=web

# Show ownership chain
kubectl describe pod $(kubectl get pods -l app=web -o jsonpath='{.items[0].metadata.name}') | grep "Controlled By"
# Expected: ReplicaSet/web-XXXXXXX

kubectl describe replicaset -l app=web | grep "Controlled By"
# Expected: Deployment/web

# Delete one pod (self-healing demonstration)
POD=$(kubectl get pods -l app=web -o jsonpath='{.items[0].metadata.name}')
kubectl delete pod $POD
kubectl get pods -l app=web -w
# Watch: 2 pods, then 3 again (ReplicaSet creates replacement)

kubectl delete deployment web
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployment web
# Expected: READY = 3/3
\`\`\``
      },
      {
        title: 'Create All Core Resource Types',
        instruction: `Create one of each key resource type and observe them:

1. Create a ConfigMap with app settings
2. Create a Secret with a password
3. Create a PVC (if a StorageClass is available)
4. Create a Pod that uses ConfigMap, Secret, and PVC`,
        hints: [
          'kubectl create configmap app-config --from-literal=PORT=8080',
          'kubectl create secret generic app-secret --from-literal=password=secretpass',
          'kubectl get sc to find StorageClass',
          'Reference ConfigMap with envFrom and Secret with env.valueFrom.secretKeyRef'
        ],
        solution: `\`\`\`bash
# ConfigMap
kubectl create configmap app-config \
  --from-literal=APP_PORT=8080 \
  --from-literal=APP_ENV=development

# Secret
kubectl create secret generic app-secret \
  --from-literal=DB_PASSWORD=supersecret123

# PVC (if StorageClass available)
SC=$(kubectl get sc -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -n "$SC" ]; then
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: app-data-pvc
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: $SC
  resources:
    requests:
      storage: 100Mi
EOF
fi

# Pod using all resources
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: resource-demo
spec:
  containers:
  - name: app
    image: nginx:1.25
    envFrom:
    - configMapRef:
        name: app-config
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: app-secret
          key: DB_PASSWORD
EOF

kubectl get pod resource-demo -w

# Verify config is injected
kubectl exec resource-demo -- env | grep -E "APP_PORT|APP_ENV|DB_PASSWORD"

# Cleanup
kubectl delete pod resource-demo
kubectl delete configmap app-config
kubectl delete secret app-secret
kubectl delete pvc app-data-pvc 2>/dev/null; true
\`\`\``,
        verify: `\`\`\`bash
kubectl exec resource-demo -- env | grep APP_PORT
# Expected: APP_PORT=8080
\`\`\``
      },
      {
        title: 'Compare Service Types',
        instruction: `Create the same deployment exposed via different service types and compare access:

1. Create a Deployment with nginx
2. Expose it as ClusterIP (default)
3. Expose it as NodePort
4. Compare the differences in access`,
        hints: [
          'kubectl expose deployment nginx-svc --port=80 --type=ClusterIP --name=nginx-clusterip',
          'kubectl expose deployment nginx-svc --port=80 --type=NodePort --name=nginx-nodeport',
          'kubectl get svc shows port assignments including NodePort range',
          'ClusterIP only accessible inside cluster; NodePort accessible from NodeIP:30000+'
        ],
        solution: `\`\`\`bash
# Create deployment
kubectl create deployment nginx-svc --image=nginx:1.25

# Expose as ClusterIP (internal only)
kubectl expose deployment nginx-svc --port=80 --type=ClusterIP --name=nginx-clusterip

# Expose as NodePort (accessible from outside)
kubectl expose deployment nginx-svc --port=80 --type=NodePort --name=nginx-nodeport

# Compare services
kubectl get svc nginx-clusterip nginx-nodeport
# ClusterIP: TYPE=ClusterIP, PORT(S)=80/TCP
# NodePort: TYPE=NodePort, PORT(S)=80:3XXXX/TCP (random 30000+ port)

# Note the NodePort number
NODEPORT=$(kubectl get svc nginx-nodeport -o jsonpath='{.spec.ports[0].nodePort}')
echo "NodePort: $NODEPORT"
echo "Access via: NodeIP:$NODEPORT from outside cluster"

# Test ClusterIP (only works from inside cluster)
kubectl run test --image=curlimages/curl:8.4.0 --rm -it -- \
  curl -s http://nginx-clusterip | head -3

# Cleanup
kubectl delete deployment nginx-svc
kubectl delete svc nginx-clusterip nginx-nodeport
\`\`\``,
        verify: `\`\`\`bash
kubectl get svc nginx-clusterip nginx-nodeport 2>/dev/null
# Expected: ClusterIP type vs NodePort type visible
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Deployment Not Creating Pods',
      difficulty: 'easy',
      symptom: 'A Deployment was created but shows 0/3 READY. No pods are visible with kubectl get pods.',
      diagnosis: `\`\`\`bash
# Check Deployment status
kubectl describe deployment <name>
# Look for Events and Conditions

# Check if ReplicaSet was created
kubectl get replicaset -l app=<name>

# Check if pods were created
kubectl get pods -l app=<name>

# Check for quota violations
kubectl describe namespace <namespace> | grep -A5 "Resource Quotas"
\`\`\``,
      solution: `**Cause A: Selector mismatch (matchLabels vs template labels)**
\`\`\`bash
# spec.selector.matchLabels must match spec.template.metadata.labels
kubectl get deployment <name> -o yaml | grep -A10 "selector:\|labels:"
# Fix: ensure matchLabels = pod template labels
\`\`\`

**Cause B: ResourceQuota prevents pod creation**
\`\`\`bash
kubectl describe namespace default | grep -A10 "Resource Quotas"
# If quota.pods is at limit, no new pods can be created

# Check current usage
kubectl get resourcequota -A
\`\`\`

**Cause C: No nodes available to schedule**
\`\`\`bash
kubectl get nodes
# All nodes might be NotReady or under maintenance
kubectl describe nodes | grep -E "Taint|Ready"
\`\`\``
    }
  ]
};
