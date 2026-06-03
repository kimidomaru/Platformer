window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcna-k8s-fundamentals/k8s-api'] = {
  theory: `# Kubernetes API

## Exam Relevance
> The Kubernetes API is foundational to KCNA. You need to understand how the API is organized (groups, versions, resources), how kubectl interacts with it, and key API concepts like declarative configuration and API versioning.

## The Kubernetes API Model

Everything in Kubernetes is an **API resource**. All operations go through the kube-apiserver REST API.

\`\`\`
API URL pattern:
/apis/<group>/<version>/namespaces/<namespace>/<resource>/<name>

Examples:
/api/v1/namespaces/default/pods/my-pod          (core group)
/apis/apps/v1/namespaces/default/deployments/web (apps group)
/apis/networking.k8s.io/v1/namespaces/default/ingresses/my-ingress
\`\`\`

## API Groups

| Group | apiVersion | Resources |
|-------|-----------|-----------|
| Core (legacy) | v1 | Pod, Service, ConfigMap, Secret, Node, Namespace, PV, PVC |
| apps | apps/v1 | Deployment, StatefulSet, DaemonSet, ReplicaSet |
| batch | batch/v1 | Job, CronJob |
| networking | networking.k8s.io/v1 | Ingress, NetworkPolicy |
| rbac | rbac.authorization.k8s.io/v1 | Role, ClusterRole, RoleBinding, ClusterRoleBinding |
| autoscaling | autoscaling/v2 | HorizontalPodAutoscaler |
| storage | storage.k8s.io/v1 | StorageClass, VolumeAttachment |

## API Versioning

Kubernetes uses versioning to manage API stability:

| Stability | Version Pattern | Meaning |
|-----------|----------------|---------|
| Alpha | v1alpha1, v2alpha1 | Experimental, may be removed |
| Beta | v1beta1, v2beta1 | Mostly stable, backwards-compatible changes |
| Stable/GA | v1, v2 | Stable, long-term support |

\`\`\`bash
# Check available API versions
kubectl api-versions
# Shows: apps/v1, batch/v1, networking.k8s.io/v1, etc.

# List all API resources
kubectl api-resources
# Shows: NAME, SHORTNAMES, APIVERSION, NAMESPACED, KIND
\`\`\`

## Declarative vs Imperative API Usage

### Imperative (direct commands)
\`\`\`bash
kubectl run nginx --image=nginx:1.25
kubectl create deployment web --image=nginx:1.25
kubectl scale deployment web --replicas=5
kubectl expose deployment web --port=80
\`\`\`

### Declarative (desired state in YAML)
\`\`\`bash
kubectl apply -f deployment.yaml   # Create or update
kubectl delete -f deployment.yaml  # Delete
\`\`\`

**Declarative is preferred** for GitOps and production — the YAML represents the desired state.

## Resource Object Structure

Every Kubernetes object has the same structure:

\`\`\`yaml
apiVersion: apps/v1          # API group + version
kind: Deployment             # Resource type
metadata:                    # Identity
  name: my-app
  namespace: default
  labels:
    app: my-app
  annotations:
    description: "web server"
spec:                        # Desired state
  replicas: 3
  # ... resource-specific fields
status:                      # Current state (read-only, managed by K8s)
  readyReplicas: 3
  # ... reported by controllers
\`\`\`

## kubectl API Verbosity

\`\`\`bash
# See the actual API calls kubectl makes
kubectl get pods -v=6
# Shows: GET https://apiserver:6443/api/v1/namespaces/default/pods

kubectl apply -f manifest.yaml -v=8
# Shows full request body + response
\`\`\`

## API Discovery

\`\`\`bash
# Explain any resource field
kubectl explain pod
kubectl explain pod.spec
kubectl explain pod.spec.containers.resources
kubectl explain deployment.spec.strategy.rollingUpdate

# Use --api-version to specify version
kubectl explain deployment --api-version=apps/v1

# Check if a CRD exists
kubectl get crd
kubectl api-resources | grep <custom-resource>
\`\`\`

## Custom Resources (CRDs)

Users can extend the Kubernetes API with **Custom Resource Definitions (CRDs)**:

\`\`\`yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databases.example.com
spec:
  group: example.com
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
  scope: Namespaced
  names:
    plural: databases
    singular: database
    kind: Database
\`\`\`

After creating the CRD, users can create Database resources:
\`\`\`yaml
apiVersion: example.com/v1
kind: Database
metadata:
  name: my-db
spec:
  engine: postgres
  version: "15"
\`\`\`

## Server-Side Apply

Kubernetes 1.18+ supports **Server-Side Apply** (SSA), which:
- Tracks field ownership per manager
- Handles conflicts between multiple controllers
- Enabled with: \`kubectl apply --server-side\`

## API Access Control Flow

Every API request passes through:
1. **Authentication** — who is making the request? (cert, token, OIDC)
2. **Authorization** — are they allowed? (RBAC, ABAC, Webhook)
3. **Admission Control** — validate and mutate the request (webhooks, built-in)
4. **Persistence** — write to etcd
`,
  quiz: [
    {
      question: 'What is the correct apiVersion for a Deployment?',
      options: [
        'v1',
        'apps/v1',
        'core/v1',
        'kubernetes/v1'
      ],
      correct: 1,
      explanation: '"apps/v1" is the stable API version for Deployments. The "v1" (core group) is for resources like Pod, Service, ConfigMap. The apps group contains workload resources: Deployment, StatefulSet, DaemonSet, ReplicaSet.',
      reference: 'API Groups table in theory.'
    },
    {
      question: 'What do the v1alpha1, v1beta1, and v1 version suffixes mean?',
      options: [
        'alpha=latest, beta=stable, v1=legacy',
        'alpha=experimental (may change/break), beta=mostly stable, v1=stable GA release',
        'alpha=internal, beta=preview, v1=public',
        'They all mean the same — just different names used by different teams'
      ],
      correct: 1,
      explanation: 'Kubernetes API versioning signals stability: alpha (experimental, may be removed), beta (mostly stable, breaking changes possible but unlikely), stable/v1 (stable API with long-term support guarantee).',
      reference: 'API Versioning table in theory.'
    },
    {
      question: 'Every Kubernetes resource object has four top-level fields. What are they?',
      options: [
        'apiVersion, kind, metadata, spec (+ status for current state)',
        'version, resource, namespace, data',
        'kind, template, selector, replicas',
        'name, image, port, namespace'
      ],
      correct: 0,
      explanation: 'All Kubernetes objects have: apiVersion (API group/version), kind (resource type), metadata (identity: name, namespace, labels), spec (desired state). The status field is read-only and managed by Kubernetes controllers.',
      reference: 'Resource Object Structure section in theory.'
    },
    {
      question: 'What is a Custom Resource Definition (CRD)?',
      options: [
        'A way to customize existing Kubernetes resources',
        'An extension mechanism that adds new resource types to the Kubernetes API',
        'A custom YAML format for Kubernetes manifests',
        'A tool for validating Kubernetes resource definitions'
      ],
      correct: 1,
      explanation: 'CRDs allow users to extend the Kubernetes API with new resource types. After creating a CRD, users can create instances of that resource using kubectl, just like built-in resources. This powers Operators and custom controllers.',
      reference: 'Custom Resources (CRDs) section in theory.'
    },
    {
      question: 'What does kubectl explain pod.spec.containers.resources show?',
      options: [
        'The current resource usage of running pods',
        'The API documentation for the resources field of containers (requests, limits, etc.)',
        'A list of all available container resources in the cluster',
        'The resource quotas applied to pods'
      ],
      correct: 1,
      explanation: 'kubectl explain is an offline API documentation tool. It shows the schema (field names, types, descriptions) for any Kubernetes resource field without needing external documentation. Use it in the exam!',
      reference: 'API Discovery section in theory.'
    },
    {
      question: 'What is the difference between kubectl apply and kubectl create?',
      options: [
        'kubectl create is for updates; kubectl apply is for new resources',
        'kubectl apply (declarative) creates or updates; kubectl create (imperative) only creates (fails if exists)',
        'kubectl create uses YAML; kubectl apply uses JSON',
        'They are identical — just different names'
      ],
      correct: 1,
      explanation: 'kubectl apply is idempotent — creates if not exists, updates if it does. It tracks changes via annotations. kubectl create fails if the resource already exists. Use kubectl apply for GitOps/declarative workflows.',
      reference: 'Declarative vs Imperative API Usage section in theory.'
    },
    {
      question: 'What is the URL pattern for the Kubernetes REST API for a pod named "mypod" in the "default" namespace?',
      options: [
        '/api/pods/default/mypod',
        '/api/v1/namespaces/default/pods/mypod',
        '/apis/core/v1/pods/mypod',
        '/api/default/pods/v1/mypod'
      ],
      correct: 1,
      explanation: 'Core group resources (Pod, Service, etc.) use: /api/v1/namespaces/<namespace>/<resource>/<name>. Other groups use: /apis/<group>/<version>/namespaces/<namespace>/<resource>/<name>.',
      reference: 'The Kubernetes API Model section in theory.'
    },
    {
      question: 'What are the 3 steps all API requests go through before reaching etcd?',
      options: [
        'Scheduling, Binding, Execution',
        'Authentication, Authorization, Admission Control',
        'Validation, Serialization, Persistence',
        'Routing, Filtering, Processing'
      ],
      correct: 1,
      explanation: 'Authentication (who are you?), Authorization (are you allowed?), Admission Control (validate/mutate the request). Only after all three pass is the object written to etcd.',
      reference: 'API Access Control Flow section in theory.'
    }
  ],
  flashcards: [
    {
      front: 'What are the main Kubernetes API groups and their resources?',
      back: 'Core (v1): Pod, Service, ConfigMap, Secret, Node, Namespace, PV, PVC\napps/v1: Deployment, StatefulSet, DaemonSet, ReplicaSet\nbatch/v1: Job, CronJob\nnetworking.k8s.io/v1: Ingress, NetworkPolicy\nrbac.authorization.k8s.io/v1: Role, ClusterRole, RoleBinding, ClusterRoleBinding\nautoscaling/v2: HPA\nstorage.k8s.io/v1: StorageClass'
    },
    {
      front: 'What are the 4 required top-level fields in every Kubernetes manifest?',
      back: 'apiVersion: apps/v1          # API group + version\nkind: Deployment             # Resource type (PascalCase)\nmetadata:                    # Identity\n  name: my-resource\n  namespace: default         # (optional for cluster-scoped)\n  labels: {}\nspec:                        # Desired state (resource-specific)\n  ...\n\nstatus: is read-only and set by controllers (not in user manifests).'
    },
    {
      front: 'What does kubectl explain do and when should you use it?',
      back: 'Shows API field documentation without internet access:\n\nkubectl explain pod\nkubectl explain pod.spec\nkubectl explain pod.spec.containers.resources\nkubectl explain deployment.spec.strategy\n\nUse in the exam when you don\'t remember a field name or its type.\nMuch faster than searching documentation.'
    },
    {
      front: 'What is the difference between alpha, beta, and GA API versions?',
      back: 'v1alpha1: Experimental. May change or be removed. Do not use in production.\n\nv1beta1: Mostly stable. Breaking changes unlikely but possible. Getting ready for GA.\n\nv1 (GA): Stable. Long-term support. Production-ready.\n\nRule: always use the most stable available version (GA > beta > alpha).'
    },
    {
      front: 'What is kubectl apply vs kubectl create?',
      back: 'kubectl apply -f file.yaml:\n- Declarative\n- Creates if not exists, updates if exists\n- Idempotent (safe to re-run)\n- Tracks changes via annotation\n- Preferred for GitOps\n\nkubectl create -f file.yaml:\n- Imperative\n- Only creates (fails with "already exists")\n- Use for one-time creation'
    },
    {
      front: 'What is a CRD and what does it enable?',
      back: 'CustomResourceDefinition (CRD): extends the Kubernetes API with new resource types.\n\nAfter creating a CRD named "databases.example.com":\n- kubectl get databases works\n- kubectl apply -f mydb.yaml works (with kind: Database)\n- Kubernetes stores instances in etcd\n\nCRDs are the foundation of Kubernetes Operators — custom controllers managing CRD instances.'
    }
  ],
  lab: {
    scenario: 'Understanding the Kubernetes API structure helps you work efficiently in the exam and debug API-related issues.',
    objective: 'Explore the Kubernetes API groups, use kubectl explain for field discovery, and practice verbose API inspection.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Explore API Groups and Resources',
        instruction: `Explore the Kubernetes API structure:

1. List all API versions available
2. List all resource types with their API groups
3. Find the short names for commonly used resources
4. Check which resources are namespaced vs cluster-scoped`,
        hints: [
          'kubectl api-versions lists all API groups/versions',
          'kubectl api-resources --namespaced=true for namespaced resources',
          'kubectl api-resources --namespaced=false for cluster-scoped',
          'SHORTNAMES column shows abbreviations like po, svc, cm, pvc'
        ],
        solution: `\`\`\`bash
# List all API versions
kubectl api-versions | sort

# List all resources with short names
kubectl api-resources | head -20

# Namespaced resources (scoped to a namespace)
kubectl api-resources --namespaced=true | head -15
# Includes: pods, services, deployments, configmaps, secrets, pvc

# Cluster-scoped resources
kubectl api-resources --namespaced=false | head -15
# Includes: nodes, persistentvolumes, clusterroles, namespaces

# Find all resources in a specific API group
kubectl api-resources --api-group=apps
# Shows: deployments, statefulsets, daemonsets, replicasets
\`\`\``,
        verify: `\`\`\`bash
kubectl api-resources --api-group=apps
# Expected: deployments, statefulsets, daemonsets, replicasets shown
\`\`\``
      },
      {
        title: 'Use kubectl explain for Field Discovery',
        instruction: `Practice using kubectl explain to discover resource fields without internet access:

1. Get top-level documentation for a Deployment
2. Drill into spec.strategy.rollingUpdate
3. Find the resource request/limit fields
4. Check an unfamiliar field like pod.spec.dnsPolicy`,
        hints: [
          'kubectl explain deployment',
          'kubectl explain deployment.spec.strategy.rollingUpdate',
          'kubectl explain pod.spec.containers.resources.requests',
          'kubectl explain pod.spec.dnsPolicy'
        ],
        solution: `\`\`\`bash
# Top-level Deployment documentation
kubectl explain deployment | head -20

# Drill into rolling update strategy
kubectl explain deployment.spec.strategy.rollingUpdate
# Shows: maxSurge and maxUnavailable fields with descriptions

# Resource requests/limits
kubectl explain pod.spec.containers.resources
# Shows: requests and limits fields

# DNS policy options
kubectl explain pod.spec.dnsPolicy
# Shows enum values: ClusterFirst, ClusterFirstWithHostNet, Default, None

# Security context
kubectl explain pod.spec.securityContext
kubectl explain pod.spec.containers.securityContext

# Recursive mode — show all nested fields
kubectl explain deployment.spec --recursive | head -30
\`\`\``,
        verify: `\`\`\`bash
kubectl explain deployment.spec.strategy.rollingUpdate | grep "maxSurge\|maxUnavailable"
# Expected: both fields documented with descriptions
\`\`\``
      },
      {
        title: 'Inspect API Calls with Verbose Logging',
        instruction: `Observe what API calls kubectl makes under the hood:

1. Run a kubectl command with -v=6 to see the HTTP request
2. Create a pod and see the POST request
3. Get a pod and see the GET request
4. Delete a pod and see the DELETE request`,
        hints: [
          'kubectl get pods -v=6 shows the GET API URL',
          'kubectl run test --image=nginx -v=6 shows the POST request',
          'The URL pattern reveals the API group/version/resource path',
          'Response code 200 = success, 201 = created'
        ],
        solution: `\`\`\`bash
# GET request
kubectl get pods -v=6 2>&1 | grep "GET\|Response"
# Shows: GET https://...apiserver.../api/v1/namespaces/default/pods

# POST (create) request
kubectl run api-test --image=nginx:1.25 -v=6 2>&1 | grep "POST\|Response"
# Shows: POST .../api/v1/namespaces/default/pods

# Verify pod exists
kubectl get pod api-test

# GET specific pod
kubectl get pod api-test -v=6 2>&1 | grep "GET\|Response"
# Shows: GET .../api/v1/namespaces/default/pods/api-test

# DELETE request
kubectl delete pod api-test -v=6 2>&1 | grep "DELETE\|Response"
# Shows: DELETE .../api/v1/namespaces/default/pods/api-test
\`\`\``,
        verify: `\`\`\`bash
# API URL should follow the expected pattern
kubectl get pods -v=6 2>&1 | grep "/api/v1/namespaces"
# Expected: URL containing /api/v1/namespaces/default/pods
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Wrong apiVersion Causes Resource Not Found Error',
      difficulty: 'easy',
      symptom: 'kubectl apply fails with: "no matches for kind Deployment in version apps/v1beta1" or "unable to recognize: no matches for kind..."',
      diagnosis: `\`\`\`bash
# Check supported API versions
kubectl api-versions | grep apps

# Check the correct API version for a resource kind
kubectl api-resources | grep -i deployment

# Validate the manifest
kubectl apply -f manifest.yaml --dry-run=server
\`\`\``,
      solution: `**Fix: update apiVersion to the correct value**

\`\`\`bash
# Common fixes:
# Deployment: apps/v1beta1 → apps/v1
# Ingress: extensions/v1beta1 → networking.k8s.io/v1
# CronJob: batch/v1beta1 → batch/v1
# NetworkPolicy: extensions/v1beta1 → networking.k8s.io/v1

# Verify before applying:
kubectl apply -f updated.yaml --dry-run=server

# Use kubectl explain to confirm:
kubectl explain deployment | grep VERSION
# Expected: VERSION: v1
\`\`\``
    }
  ]
};
