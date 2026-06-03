window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['argocd-fundamentals/argocd-architecture'] = {
  theory: `
# ArgoCD — Architecture & Components

## Relevance
ArgoCD is the most widely adopted GitOps tool for Kubernetes, being a **Graduated** CNCF project. Mastering its architecture is essential for any DevOps/SRE professional working with continuous delivery on Kubernetes. ArgoCD is frequently covered in interviews and is a fundamental part of the modern GitOps workflow.

## Fundamental Concepts

### What is GitOps?

GitOps is an operational paradigm where Git is the **single source of truth** for infrastructure and applications. The fundamental principles are:

1. **Declarative**: the entire system is described declaratively (YAML/JSON)
2. **Versioned**: the desired state is stored in Git
3. **Automated**: approved changes are applied automatically
4. **Continuous reconciliation**: agents ensure actual state = desired state

### Push vs Pull GitOps

| Aspect | Push (CI-driven) | Pull (ArgoCD) |
|--------|-------------------|---------------|
| **Flow** | CI runs kubectl apply | ArgoCD watches Git and applies |
| **Credentials** | CI needs kubeconfig | Only ArgoCD has cluster access |
| **Security** | Credentials in CI pipeline | Credentials isolated in cluster |
| **Drift detection** | None | Automatic and continuous |
| **Auditing** | CI logs | Git history + ArgoCD UI |

### ArgoCD Architecture

\`\`\`
+-------------------+     +--------------------+     +------------------+
|   Git Repository  |     |   ArgoCD Server    |     |  Kubernetes      |
|   (Source of      |<----|   (Control Plane)   |---->|  Cluster(s)      |
|    Truth)         |     |                    |     |  (Target)        |
+-------------------+     +--------------------+     +------------------+
                          |  API Server        |
                          |  Repo Server       |
                          |  Application Ctrl  |
                          |  Redis Cache       |
                          |  Dex (SSO)         |
                          |  Notifications Ctrl|
                          +--------------------+
\`\`\`

### Main Components

| Component | Function | Pod |
|-----------|----------|-----|
| **API Server** | Exposes REST and gRPC API, serves UI, manages authentication | argocd-server |
| **Repository Server** | Clones Git repos, generates manifests (Helm/Kustomize/plain YAML) | argocd-repo-server |
| **Application Controller** | Monitors apps, compares desired vs actual state, reconciles | argocd-application-controller |
| **Redis** | Cache for app state and repo data | argocd-redis |
| **Dex** | OIDC/SSO authentication (optional) | argocd-dex-server |
| **ApplicationSet Controller** | Automatically generates Applications from templates | argocd-applicationset-controller |
| **Notifications Controller** | Sends notifications (Slack, Email, Webhook) | argocd-notifications-controller |

### Reconciliation Flow

\`\`\`
1. Application Controller detects diff (every 3 min by default)
2. Repo Server clones the repo and generates manifests
3. Controller compares manifests with current cluster state (kubectl diff)
4. If OutOfSync:
   a. Auto-sync enabled → applies automatically
   b. Manual sync → marks as OutOfSync in UI
5. After sync → checks health status of resources
6. Updates status in UI/API
\`\`\`

## Essential Commands

### Installation

\`\`\`bash
# Standard installation (argocd namespace)
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# HA installation (production)
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/ha/install.yaml

# Verify pods
kubectl get pods -n argocd
# NAME                                               READY   STATUS
# argocd-application-controller-0                    1/1     Running
# argocd-repo-server-xxx                             1/1     Running
# argocd-server-xxx                                  1/1     Running
# argocd-redis-xxx                                   1/1     Running
# argocd-dex-server-xxx                              1/1     Running
# argocd-applicationset-controller-xxx               1/1     Running
# argocd-notifications-controller-xxx                1/1     Running
\`\`\`

### CLI (argocd)

\`\`\`bash
# Install CLI
curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x argocd && sudo mv argocd /usr/local/bin/

# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d

# Login
argocd login localhost:8080 --username admin --password <password>

# Change password
argocd account update-password

# List apps
argocd app list

# List registered clusters
argocd cluster list

# Add external cluster
argocd cluster add <context-name>
\`\`\`

### UI Access

\`\`\`bash
# Port-forward (development)
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Or expose via Ingress
# Requires --insecure flag on argocd-server for TLS termination at ingress
\`\`\`

## YAML Examples

### Installation via Helm (recommended for production)

\`\`\`yaml
# values.yaml for argo-cd Helm chart
global:
  image:
    tag: v2.10.0

server:
  replicas: 2
  ingress:
    enabled: true
    hostname: argocd.example.com
    tls: true
  extraArgs:
    - --insecure  # TLS terminated at ingress

controller:
  replicas: 1
  resources:
    requests:
      cpu: 250m
      memory: 512Mi
    limits:
      cpu: "1"
      memory: 1Gi

repoServer:
  replicas: 2
  resources:
    requests:
      cpu: 100m
      memory: 256Mi

redis:
  resources:
    requests:
      cpu: 100m
      memory: 128Mi

configs:
  params:
    server.insecure: true
    controller.repo.server.timeout.seconds: "120"
    controller.self.heal.timeout.seconds: "5"
  cm:
    timeout.reconciliation: 180s  # reconciliation interval (default 3m)
    resource.customizations.health.argoproj.io_Application: |
      hs = {}
      hs.status = "Healthy"
      return hs
\`\`\`

### Main ConfigMap (argocd-cm)

\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cm
  namespace: argocd
data:
  # Repositories
  repositories: |
    - url: https://github.com/org/repo.git
      type: git
    - url: https://charts.example.com
      type: helm
      name: example-charts

  # Reconciliation timeout
  timeout.reconciliation: 180s

  # Resource tracking method
  application.resourceTrackingMethod: annotation

  # Health check customizations
  resource.customizations.health.apps_Deployment: |
    hs = {}
    if obj.status ~= nil then
      if obj.status.readyReplicas == obj.status.replicas then
        hs.status = "Healthy"
      else
        hs.status = "Progressing"
      end
    end
    return hs
\`\`\`

## Common Mistakes

1. **Not changing the default admin password**: The initial password is generated in a Secret. If not changed, anyone with namespace access can retrieve it.
2. **Using non-HA installation in production**: The default installation uses replicas=1. In production, always use the HA manifest or configure replicas via Helm.
3. **Not configuring resource limits**: Without limits, the repo-server can consume excessive resources when generating manifests from large repos.
4. **Exposing UI without TLS**: Never expose the ArgoCD server without HTTPS. Use Ingress with TLS or port-forward.
5. **Too short reconciliation interval**: The default (3 min) is adequate for most cases. Reducing too much overloads the cluster API.
6. **Not configuring ArgoCD RBAC**: The default admin has full access. Configure projects and RBAC to restrict access per team.

## Killer.sh Style Challenge

**Scenario:** Install ArgoCD on a Kubernetes cluster and configure initial access.

**Tasks:**
1. Install ArgoCD in the \`argocd\` namespace
2. Retrieve the initial admin password
3. Login via CLI
4. Change the admin password
5. Configure ArgoCD server to be accessible via Ingress with TLS

**Tips:**
- The initial password is in the \`argocd-initial-admin-secret\` Secret
- Use \`argocd login\` with \`--insecure\` when using port-forward with HTTPS
- For Ingress, add \`--insecure\` to argocd-server args for TLS termination at the ingress
`,
  quiz: [
    {
      question: 'Which ArgoCD component is responsible for cloning Git repositories and generating Kubernetes manifests?',
      options: [
        'Application Controller',
        'API Server',
        'Repository Server',
        'Redis'
      ],
      correct: 2,
      explanation: 'The Repository Server (argocd-repo-server) is responsible for cloning Git repositories and generating the final Kubernetes manifests. It supports Helm templates, Kustomize overlays, and plain YAML, generating the manifests that the Application Controller uses to compare with the current cluster state.',
      reference: 'Related concept: argocd-applications — the Repo Server generates manifests for each Application based on the configured source.'
    },
    {
      question: 'What is the main difference between Push (CI-driven) and Pull (ArgoCD) models in GitOps?',
      options: [
        'Push is more secure because it uses pipelines',
        'In the Pull model, the agent (ArgoCD) runs inside the cluster and pulls changes from Git, eliminating cluster credentials in CI',
        'In the Push model, Git is not required',
        'There is no significant difference'
      ],
      correct: 1,
      explanation: 'In the Pull model, ArgoCD runs inside the Kubernetes cluster and continuously compares Git state with the cluster. This eliminates the need to distribute kubeconfig/credentials to CI pipelines, improving security. Additionally, the Pull model detects drift automatically.',
      reference: 'Related concept: argocd-sync-strategies — the Pull model enables auto-sync and self-heal for automatic drift correction.'
    },
    {
      question: 'Which ArgoCD component monitors application state and executes reconciliation?',
      options: [
        'API Server',
        'Repository Server',
        'Application Controller',
        'Dex Server'
      ],
      correct: 2,
      explanation: 'The Application Controller is the heart of ArgoCD. It continuously monitors the state of Applications, compares the desired state (Git) with the actual state (cluster), and executes reconciliation (sync) when needed. It runs as a StatefulSet to ensure consistency.',
      reference: 'Related concept: argocd-sync-strategies — the Controller manages sync policies, auto-sync, and self-heal.'
    },
    {
      question: 'What is the default reconciliation interval in ArgoCD?',
      options: [
        '30 seconds',
        '1 minute',
        '3 minutes',
        '10 minutes'
      ],
      correct: 2,
      explanation: 'The default reconciliation interval is 3 minutes (180 seconds). This means ArgoCD checks Git and cluster state every 3 minutes. It can be configured via timeout.reconciliation in the argocd-cm ConfigMap. Git webhooks can trigger immediate reconciliation.',
      reference: 'Related concept: argocd-sync-strategies — Git webhooks can complement polling for faster sync.'
    },
    {
      question: 'How do you retrieve the initial ArgoCD admin password?',
      options: [
        'It is "admin" by default',
        'Extract from the argocd-initial-admin-secret Secret in the argocd namespace',
        'It is defined during Helm installation',
        'There is no default password, SSO must be configured'
      ],
      correct: 1,
      explanation: 'The initial admin password is automatically generated and stored in the argocd-initial-admin-secret Secret in the argocd namespace. To retrieve it: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath=\'{.data.password}\' | base64 -d. It should be changed after the first login.',
      reference: 'Related concept: argocd-projects — configure RBAC and SSO for secure production access.'
    },
    {
      question: 'Which ArgoCD component is responsible for SSO/OIDC authentication?',
      options: [
        'API Server',
        'Application Controller',
        'Dex Server',
        'Redis'
      ],
      correct: 2,
      explanation: 'The Dex Server (argocd-dex-server) is an identity service that provides OIDC/SSO authentication. It supports integration with GitHub, GitLab, LDAP, SAML, and other identity providers. It is an optional component — ArgoCD also supports local authentication and direct OIDC.',
      reference: 'Related concept: argocd-projects — ArgoCD RBAC integrates with SSO users/groups.'
    },
    {
      question: 'Why is the HA installation of ArgoCD recommended for production?',
      options: [
        'Because it is faster to install',
        'Because it uses fewer resources',
        'Because it runs components with multiple replicas, avoiding single point of failure',
        'Because it supports more Git repositories'
      ],
      correct: 2,
      explanation: 'The HA installation runs multiple replicas of the API Server, Repo Server, and uses Redis HA with Sentinel. This avoids single point of failure — if one pod fails, the others continue serving. The Application Controller uses leader election to ensure only one active instance is reconciling.',
      reference: 'Related concept: argocd-advanced — multi-cluster and HA are essential for production environments.'
    },
    {
      question: 'What is the role of Redis in ArgoCD?',
      options: [
        'Store Git manifests',
        'Cache application state and repository data for performance',
        'Execute application reconciliation',
        'Manage user authentication'
      ],
      correct: 1,
      explanation: 'Redis serves as a cache for ArgoCD, storing application state and repository data. This reduces the load on the Kubernetes API server and Repo Server, significantly improving performance, especially in environments with many applications.',
      reference: 'Related concept: argocd-architecture — in HA mode, Redis uses Sentinel for cache high availability.'
    }
  ],
  flashcards: [
    {
      front: 'What are the main ArgoCD components and their functions?',
      back: '1. **API Server** — exposes REST/gRPC API, serves UI, authentication\n2. **Repo Server** — clones Git repos, generates manifests (Helm/Kustomize/YAML)\n3. **Application Controller** — monitors apps, compares desired vs actual, reconciles\n4. **Redis** — cache for state and repo data\n5. **Dex** — SSO/OIDC authentication (optional)\n6. **ApplicationSet Controller** — generates Applications from templates\n7. **Notifications Controller** — sends notifications (Slack, Email, Webhook)'
    },
    {
      front: 'What is GitOps and what are its 4 principles?',
      back: '**GitOps** = operational paradigm where Git is the single source of truth.\n\n**4 Principles:**\n1. **Declarative** — entire system described in YAML/JSON\n2. **Versioned** — desired state stored in Git\n3. **Automated** — approved changes applied automatically\n4. **Continuous reconciliation** — agents ensure actual state = desired\n\n**Benefits:** audit via git log, rollback via git revert, review via PR.'
    },
    {
      front: 'Push vs Pull GitOps — which is more secure and why?',
      back: '**Pull (ArgoCD)** is more secure:\n- Cluster credentials stay ONLY in ArgoCD (inside the cluster)\n- CI/CD does NOT need kubeconfig\n- Automatic and continuous drift detection\n- Complete audit via Git history\n\n**Push (CI-driven):**\n- CI needs kubeconfig (exposed credentials)\n- No automatic drift detection\n- If CI fails, state becomes inconsistent\n\nIn secure environments, always prefer Pull-based GitOps.'
    },
    {
      front: 'How does ArgoCD detect and correct drift?',
      back: '**Detection (every 3 min by default):**\n1. Application Controller requests manifests from Repo Server\n2. Repo Server clones repo and generates manifests\n3. Controller diffs with current cluster state\n4. If different → marks as **OutOfSync**\n\n**Correction:**\n- **Manual:** user clicks Sync in UI or uses CLI\n- **Auto-sync:** ArgoCD applies automatically\n- **Self-heal:** reverts manual changes in cluster\n\nConfig: \`timeout.reconciliation: 180s\` in argocd-cm'
    },
    {
      front: 'How to install ArgoCD on a Kubernetes cluster?',
      back: '**Basic installation:**\n```bash\nkubectl create namespace argocd\nkubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml\n```\n\n**Initial password:**\n```bash\nkubectl -n argocd get secret argocd-initial-admin-secret \\\n  -o jsonpath=\'{.data.password}\' | base64 -d\n```\n\n**Access:**\n```bash\nkubectl port-forward svc/argocd-server -n argocd 8080:443\nargocd login localhost:8080\n```\n\n**Production:** use HA installation or Helm chart.'
    },
    {
      front: 'What is the difference between ArgoCD and FluxCD?',
      back: '| Aspect | ArgoCD | FluxCD |\n|--------|--------|--------|\n| **UI** | Rich native UI | No UI (needs Weave GitOps) |\n| **Architecture** | Centralized (server) | Distributed (controllers) |\n| **CRDs** | Application | Kustomization, HelmRelease |\n| **Multi-cluster** | Native | Via remote Kustomization |\n| **CNCF** | Graduated | Graduated |\n| **Best for** | Teams wanting UI | Teams preferring pure YAML |\n\nBoth are valid. ArgoCD is more popular in enterprises due to the UI.'
    },
    {
      front: 'What are the production requirements for ArgoCD?',
      back: '1. **HA:** use HA manifest or Helm with replicas > 1\n2. **TLS:** never expose without HTTPS (Ingress + cert-manager)\n3. **SSO:** configure Dex with OIDC (GitHub, Google, LDAP)\n4. **RBAC:** Projects to isolate teams\n5. **Resource limits:** define CPU/memory for all pods\n6. **Backup:** argocd-cm and argocd-rbac-cm are critical\n7. **Monitoring:** Prometheus metrics at /metrics\n8. **Password:** change admin password and delete initial Secret'
    }
  ],
  lab: {
    scenario: 'You need to install and configure ArgoCD on a Kubernetes cluster, access the UI, login via CLI, and explore the components.',
    objective: 'Install ArgoCD, retrieve credentials, access the UI via port-forward, and explore the component architecture.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Install ArgoCD',
        instruction: `Install ArgoCD in a dedicated namespace.

\`\`\`bash
# Create namespace
kubectl create namespace argocd

# Install ArgoCD (stable version)
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for all pods to be Running
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=120s
\`\`\``,
        hints: [
          'The namespace must be "argocd" for the standard installation',
          'Use kubectl wait to wait for pods to be ready',
          'The installation creates 7 main pods'
        ],
        solution: `\`\`\`bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=120s
\`\`\``,
        verify: `\`\`\`bash
# Verify ArgoCD pods
kubectl get pods -n argocd
# Expected output: all pods Running (argocd-server, argocd-repo-server, argocd-application-controller, argocd-redis, argocd-dex-server, argocd-applicationset-controller, argocd-notifications-controller)

# Verify services
kubectl get svc -n argocd
# Expected output: argocd-server with port 443
\`\`\``
      },
      {
        title: 'Access ArgoCD and Login',
        instruction: `Retrieve the initial admin password, configure port-forward, and login via CLI.

\`\`\`bash
# 1. Get initial password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d && echo

# 2. Port-forward (in another terminal or background)
kubectl port-forward svc/argocd-server -n argocd 8080:443 &

# 3. Install CLI (if not installed)
curl -sSL -o /usr/local/bin/argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x /usr/local/bin/argocd

# 4. Login
argocd login localhost:8080 --username admin --password <password> --insecure
\`\`\``,
        hints: [
          'The --insecure flag is needed when the certificate is self-signed (port-forward)',
          'The initial password is base64 encoded in the Secret',
          'The UI is accessible at https://localhost:8080'
        ],
        solution: `\`\`\`bash
# Get password
ARGOCD_PWD=\$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d)

# Port-forward
kubectl port-forward svc/argocd-server -n argocd 8080:443 &

# Login
argocd login localhost:8080 --username admin --password \$ARGOCD_PWD --insecure
\`\`\``,
        verify: `\`\`\`bash
# Verify successful login
argocd account get-user-info
# Expected output: loggedIn: true, username: admin

# List clusters
argocd cluster list
# Expected output: at least the in-cluster (https://kubernetes.default.svc)
\`\`\``
      },
      {
        title: 'Explore Components and CRDs',
        instruction: `Examine the installed components and ArgoCD Custom Resource Definitions.

\`\`\`bash
# List ArgoCD CRDs
kubectl get crd | grep argo

# Describe the Application CRD
kubectl explain application.spec --api-version=argoproj.io/v1alpha1

# View ArgoCD resources
kubectl api-resources | grep argo

# Examine the main ConfigMap
kubectl get cm argocd-cm -n argocd -o yaml

# Examine the RBAC configuration
kubectl get cm argocd-rbac-cm -n argocd -o yaml

# View ServiceAccounts
kubectl get sa -n argocd
\`\`\``,
        hints: [
          'ArgoCD installs 5 main CRDs: Application, AppProject, ApplicationSet, etc.',
          'The argocd-cm ConfigMap contains the main configuration',
          'The argocd-rbac-cm defines access policies'
        ],
        solution: `\`\`\`bash
# CRDs
kubectl get crd | grep argo

# API resources
kubectl api-resources | grep argo

# ConfigMaps
kubectl get cm argocd-cm -n argocd -o yaml
kubectl get cm argocd-rbac-cm -n argocd -o yaml

# ServiceAccounts
kubectl get sa -n argocd
\`\`\``,
        verify: `\`\`\`bash
# Verify installed CRDs
kubectl get crd | grep argoproj | wc -l
# Expected output: 3 or more (applications, appprojects, applicationsets)

# Verify default project exists
argocd proj list
# Expected output: list containing "default"
\`\`\``
      },
      {
        title: 'Verify Metrics and Health',
        instruction: `Verify component health and explore Prometheus metrics exposed by ArgoCD.

\`\`\`bash
# Health check for ArgoCD server
kubectl exec -n argocd deploy/argocd-server -- curl -s http://localhost:8082/healthz

# Application Controller metrics
kubectl exec -n argocd sts/argocd-application-controller -- curl -s http://localhost:8082/metrics | head -20

# ArgoCD Server metrics
kubectl exec -n argocd deploy/argocd-server -- curl -s http://localhost:8083/metrics | head -20

# Check version
argocd version
\`\`\``,
        hints: [
          'ArgoCD exposes Prometheus metrics on /metrics endpoints',
          'Metrics include information about sync status, health, and latency',
          'Use these metrics to monitor ArgoCD with Prometheus/Grafana'
        ],
        solution: `\`\`\`bash
# Health
kubectl exec -n argocd deploy/argocd-server -- curl -s http://localhost:8082/healthz

# Version
argocd version --client

# General status
argocd app list
\`\`\``,
        verify: `\`\`\`bash
# Verify ArgoCD is healthy
argocd version --client
# Expected output: ArgoCD CLI version

# Verify connectivity
argocd cluster list
# Expected output: cluster with STATUS "Successful"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ArgoCD server does not start — CrashLoopBackOff',
      difficulty: 'easy',
      symptom: 'The argocd-server pod is stuck in CrashLoopBackOff after installation.',
      diagnosis: `\`\`\`bash
# View pod logs
kubectl logs -n argocd deploy/argocd-server --previous

# Check events
kubectl describe pod -n argocd -l app.kubernetes.io/name=argocd-server

# Check if Redis is running
kubectl get pod -n argocd -l app.kubernetes.io/name=argocd-redis

# Check resources
kubectl top pod -n argocd
\`\`\``,
      solution: `**Common causes:**

1. **Redis not available:** argocd-server depends on Redis. If Redis is not running, the server won't start.
\`\`\`bash
kubectl get pod -n argocd -l app.kubernetes.io/name=argocd-redis
# If not Running, check Redis logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-redis
\`\`\`

2. **Port already in use:** If another service uses port 8080/8083, the server fails.

3. **TLS misconfiguration:** If argocd-server is configured with --insecure but the cert doesn't exist, it may fail. Check the args:
\`\`\`bash
kubectl get deploy argocd-server -n argocd -o jsonpath='{.spec.template.spec.containers[0].args}'
\`\`\`

4. **Insufficient resources:** The server needs at least 256Mi of memory. Check with kubectl top pod.`
    },
    {
      title: 'Repo Server cannot clone private repository',
      difficulty: 'medium',
      symptom: 'Applications show error "rpc error: code = Unknown desc = authentication required" when trying to sync.',
      diagnosis: `\`\`\`bash
# Check repo-server logs
kubectl logs -n argocd deploy/argocd-repo-server | grep -i "error\\|auth\\|clone"

# List configured repositories
argocd repo list

# Test repository connection
argocd repo get https://github.com/org/private-repo.git
\`\`\``,
      solution: `**Solution:**

1. **Add repository credentials:**
\`\`\`bash
# Via CLI — HTTPS with token
argocd repo add https://github.com/org/repo.git --username oauth2 --password <token>

# Via CLI — SSH key
argocd repo add git@github.com:org/repo.git --ssh-private-key-path ~/.ssh/id_rsa
\`\`\`

2. **Via Secret (GitOps-friendly):**
\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: repo-private
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repository
type: Opaque
stringData:
  url: https://github.com/org/repo.git
  username: oauth2
  password: ghp_xxxxxxxxxxxx
  type: git
\`\`\`

3. **Credential templates (for entire org):**
\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: github-creds
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repo-creds
type: Opaque
stringData:
  url: https://github.com/org
  username: oauth2
  password: ghp_xxxxxxxxxxxx
  type: git
\`\`\``
    },
    {
      title: 'Application Controller with high reconciliation latency',
      difficulty: 'hard',
      symptom: 'ArgoCD takes more than 10 minutes to detect changes in Git. Manual sync works quickly, but automatic detection is slow.',
      diagnosis: `\`\`\`bash
# Check controller metrics
kubectl exec -n argocd sts/argocd-application-controller -- curl -s http://localhost:8082/metrics | grep argocd_app_reconcile

# Check number of apps
argocd app list | wc -l

# Check resource usage
kubectl top pod -n argocd -l app.kubernetes.io/name=argocd-application-controller

# Check reconciliation config
kubectl get cm argocd-cm -n argocd -o jsonpath='{.data.timeout\\.reconciliation}'
\`\`\``,
      solution: `**Causes and solutions:**

1. **Too many applications:** Each app is reconciled sequentially by the controller. With 100+ apps, the full cycle can take a long time.
\`\`\`yaml
# Increase controller workers
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cmd-params-cm
  namespace: argocd
data:
  controller.status.processors: "50"
  controller.operation.processors: "25"
\`\`\`

2. **Webhooks not configured:** Without webhooks, ArgoCD relies on polling (3 min). Configure Git webhooks:
\`\`\`bash
# ArgoCD listens for webhooks at /api/webhook
# Configure in GitHub: Settings > Webhooks > https://argocd.example.com/api/webhook
\`\`\`

3. **Slow Repo Server:** Large repos take time to clone. Configure shallow clones:
\`\`\`yaml
# In argocd-cmd-params-cm
data:
  reposerver.git.request.timeout: "120"
\`\`\`

4. **Redis cache full:** Redis without sufficient memory discards cache, forcing re-clone.
\`\`\`bash
kubectl exec -n argocd deploy/argocd-redis -- redis-cli info memory
\`\`\``
    }
  ]
};
