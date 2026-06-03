window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcna-cloud-native/cncf-ecosystem'] = {
  theory: `# CNCF Ecosystem

## Exam Relevance
> The CNCF ecosystem is directly tested in KCNA (~14% Cloud Native Architecture). You need to know major CNCF projects, the landscape categories, and which maturity levels (Sandbox, Incubating, Graduated) projects can be at.

## CNCF Overview

The **Cloud Native Computing Foundation (CNCF)** is part of the Linux Foundation and hosts the cloud native ecosystem. It provides:
- Governance and oversight for cloud native projects
- Certification programs (CKA, CKAD, CKS, KCNA, KCSA)
- The CNCF Landscape — a map of cloud native technologies

Website: cncf.io | Landscape: landscape.cncf.io

## CNCF Project Maturity Levels

| Level | Meaning | Examples |
|-------|---------|---------|
| **Graduated** | Production-ready, widely adopted, stable API | Kubernetes, Prometheus, Envoy, Fluentd, Jaeger, containerd |
| **Incubating** | Growing adoption, proven use cases | Argo, OpenTelemetry, KEDA, Falco, Harbor |
| **Sandbox** | Early-stage, experimental | Various new projects |

Projects progress: Sandbox → Incubating → Graduated

## Key CNCF Projects by Category

### Orchestration
- **Kubernetes** (Graduated) — Container orchestration platform

### Container Runtime
- **containerd** (Graduated) — Industry-standard container runtime
- **CRI-O** (Incubating) — Lightweight OCI-compliant runtime for Kubernetes

### Networking
- **CoreDNS** (Graduated) — DNS-based service discovery
- **Envoy** (Graduated) — Cloud native proxy, service mesh data plane
- **Cilium** (Graduated) — eBPF-based networking, security, observability
- **Contour** (Incubating) — Ingress controller for Kubernetes

### Monitoring & Observability
- **Prometheus** (Graduated) — Metrics collection and alerting
- **Grafana** (not CNCF but common pair)
- **Jaeger** (Graduated) — Distributed tracing
- **OpenTelemetry** (Incubating) — Unified observability framework (metrics, logs, traces)
- **Fluentd** (Graduated) — Unified logging layer
- **Fluent Bit** — Lightweight log processor and forwarder

### Service Mesh
- **Istio** (Graduated) — Feature-rich service mesh
- **Linkerd** (Graduated) — Lightweight service mesh

### Security
- **Falco** (Incubating) — Runtime security and threat detection
- **OPA/Gatekeeper** (Graduated) — Policy engine

### CI/CD & GitOps
- **Argo CD** (Incubating) — GitOps continuous delivery
- **Flux** (Incubating) — GitOps toolkit
- **Tekton** (Incubating) — Cloud native CI/CD

### Storage
- **Rook** (Graduated) — Cloud native storage orchestrator
- **Longhorn** (Incubating) — Distributed block storage

### Package Management
- **Helm** (Graduated) — Kubernetes package manager

### Serverless
- **Knative** (Incubating) — Serverless workloads on Kubernetes
- **KEDA** (Incubating) — Event-driven autoscaling

## The CNCF Landscape

The CNCF Landscape (landscape.cncf.io) categorizes over 1000 cloud native projects and products across:

\`\`\`
App Definition & Image Build → Runtime → Orchestration → Platform
Observability → Service Mesh → Networking → Security → Storage
\`\`\`

## OCI — Open Container Initiative

OCI standards ensure container interoperability:

| Spec | What it defines |
|------|----------------|
| **Image Spec** | Container image format (layers, manifest, config) |
| **Runtime Spec** | How to run a container (from image to process) |
| **Distribution Spec** | How to push/pull images from registries |

OCI means: Docker images run on containerd, CRI-O, and any OCI-compliant runtime.

## CNCF Certifications

| Certification | Level | Focus |
|--------------|-------|-------|
| KCNA | Associate | Cloud native fundamentals |
| KCSA | Associate | Kubernetes & cloud native security |
| CKA | Professional | Kubernetes administration |
| CKAD | Professional | Kubernetes application development |
| CKS | Professional | Kubernetes security |
`,
  quiz: [
    {
      question: 'What are the three CNCF project maturity levels in order?',
      options: [
        'Alpha, Beta, Stable',
        'Sandbox, Incubating, Graduated',
        'Experimental, Active, Complete',
        'Draft, Review, Approved'
      ],
      correct: 1,
      explanation: 'CNCF projects progress through: Sandbox (early stage) → Incubating (growing adoption) → Graduated (production-ready, widely adopted). Kubernetes is the most prominent Graduated project.',
      reference: 'CNCF Project Maturity Levels table in theory.'
    },
    {
      question: 'Which CNCF project is the standard for metrics collection and alerting in cloud native environments?',
      options: [
        'Grafana',
        'Prometheus',
        'Jaeger',
        'OpenTelemetry'
      ],
      correct: 1,
      explanation: 'Prometheus (CNCF Graduated) is the de-facto standard for metrics collection. It scrapes /metrics endpoints, stores time-series data, and triggers alerts. Grafana visualizes Prometheus data. Jaeger is for distributed tracing.',
      reference: 'Key CNCF Projects — Monitoring & Observability section.'
    },
    {
      question: 'What does the OCI (Open Container Initiative) define?',
      options: [
        'Kubernetes API standards',
        'Container image format, runtime behavior, and distribution protocol (registry push/pull)',
        'Cloud provider interoperability standards',
        'CNCF project graduation criteria'
      ],
      correct: 1,
      explanation: 'OCI defines 3 specs: Image (how images are structured in layers), Runtime (how to run an OCI image as a container), and Distribution (how to push/pull images from registries). This ensures Docker images work on any OCI-compliant runtime.',
      reference: 'OCI — Open Container Initiative section in theory.'
    },
    {
      question: 'Which CNCF project is used for GitOps continuous delivery on Kubernetes?',
      options: [
        'Tekton',
        'Argo CD',
        'Flux',
        'Both B and C are correct'
      ],
      correct: 3,
      explanation: 'Both Argo CD and Flux are CNCF projects for GitOps-based continuous delivery. Argo CD uses a declarative approach with a UI. Flux uses a controller-based approach. Both are valid GitOps tools for Kubernetes.',
      reference: 'Key CNCF Projects — CI/CD & GitOps section.'
    },
    {
      question: 'What is containerd?',
      options: [
        'A Kubernetes-specific container format',
        'A CNCF Graduated project — the industry-standard container runtime',
        'A container image building tool',
        'A container registry'
      ],
      correct: 1,
      explanation: 'containerd is a CNCF Graduated project and the most widely used container runtime. It implements the Container Runtime Interface (CRI) and manages the full container lifecycle. It is the default runtime in most Kubernetes distributions.',
      reference: 'Key CNCF Projects — Container Runtime section.'
    },
    {
      question: 'Kubernetes was donated to CNCF by which company?',
      options: [
        'Amazon Web Services',
        'Microsoft',
        'Google',
        'Red Hat'
      ],
      correct: 2,
      explanation: 'Google created Kubernetes internally (as "Borg") and open-sourced it in 2014, donating it to the CNCF as the founding project. This is a key piece of Kubernetes history often tested in KCNA.',
      reference: 'CNCF Overview — Kubernetes is the founding CNCF project.'
    },
    {
      question: 'What does Helm provide in the Kubernetes ecosystem?',
      options: [
        'Container runtime management',
        'Network policy enforcement',
        'Kubernetes package management — installing, upgrading, and managing applications',
        'Service mesh traffic routing'
      ],
      correct: 2,
      explanation: 'Helm (CNCF Graduated) is the Kubernetes package manager. It bundles Kubernetes manifests into "charts" that can be installed, upgraded, and rolled back with a single command. It handles complex applications with dependencies.',
      reference: 'Key CNCF Projects — Package Management section.'
    },
    {
      question: 'What is the difference between Jaeger and Prometheus?',
      options: [
        'Jaeger is for metrics; Prometheus is for logs',
        'Jaeger is for distributed tracing; Prometheus is for metrics collection',
        'Jaeger is commercial; Prometheus is open source',
        'They are the same tool with different names'
      ],
      correct: 1,
      explanation: 'Jaeger (CNCF Graduated) provides distributed tracing — following a request across multiple microservices to identify latency. Prometheus (CNCF Graduated) collects time-series metrics (CPU, memory, custom). Both are part of the observability stack.',
      reference: 'Key CNCF Projects — Monitoring & Observability section.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 3 CNCF maturity levels? Give a Graduated example.',
      back: 'Sandbox → Incubating → Graduated\n\nGraduated projects (production-ready, widely adopted):\n- Kubernetes\n- Prometheus\n- Envoy\n- Jaeger\n- Fluentd\n- containerd\n- CoreDNS\n- Helm\n- Rook\n- Istio\n- Linkerd'
    },
    {
      front: 'Name 3 key CNCF projects for each category: Observability, Service Mesh, CI/CD',
      back: 'Observability:\n- Prometheus (metrics)\n- Jaeger (tracing)\n- OpenTelemetry (unified obs framework)\n- Fluentd/Fluent Bit (logging)\n\nService Mesh:\n- Istio (full-featured)\n- Linkerd (lightweight)\n- Envoy (data plane proxy)\n\nCI/CD & GitOps:\n- Argo CD\n- Flux\n- Tekton'
    },
    {
      front: 'What 3 specifications does OCI (Open Container Initiative) define?',
      back: '1. Image Spec — how container images are structured (layers, manifest, config)\n2. Runtime Spec — how to run an OCI image as a container process\n3. Distribution Spec — how to push/pull images from registries\n\nImportance: ensures portability — Docker images run on containerd, CRI-O, or any OCI runtime.'
    },
    {
      front: 'What are the 5 Kubernetes certifications from CNCF?',
      back: 'KCNA — Kubernetes and Cloud Native Associate (fundamentals)\nKCSA — Kubernetes and Cloud Native Security Associate\nCKA — Certified Kubernetes Administrator\nCKAD — Certified Kubernetes Application Developer\nCKS — Certified Kubernetes Security Specialist\n\nKCNA/KCSA are associate-level (multiple choice)\nCKA/CKAD/CKS are professional-level (hands-on)'
    },
    {
      front: 'What is the CNCF Landscape?',
      back: 'A curated map at landscape.cncf.io showing 1000+ cloud native projects and products.\n\nCategories include:\n- App Definition & Image Build\n- Runtime (container, storage, networking)\n- Orchestration & Management\n- Platform (Kubernetes distributions)\n- Observability\n- Security\n- Serverless\n\nHelps understand the full cloud native ecosystem beyond Kubernetes.'
    }
  ],
  lab: {
    scenario: 'Exploring the CNCF ecosystem helps you understand which tools to use for different cloud native challenges. This lab explores real CNCF projects running in your cluster.',
    objective: 'Identify CNCF projects running in your cluster and understand their roles in the ecosystem.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Identify CNCF Projects in Your Cluster',
        instruction: `Explore which CNCF projects are already running in your cluster:

1. List all pods in kube-system and identify CNCF projects
2. Check the container runtime version (containerd is a CNCF project)
3. Find CoreDNS (CNCF Graduated project)
4. Check if Prometheus or other observability tools are installed`,
        hints: [
          'kubectl get pods -n kube-system shows CoreDNS, kube-proxy, metrics-server',
          'kubectl get nodes -o wide shows container runtime',
          'kubectl get pods -A shows all namespaces — look for monitoring namespace',
          'helm list -A shows installed Helm charts'
        ],
        solution: `\`\`\`bash
# List all system pods
kubectl get pods -n kube-system

# Identify CNCF projects:
# - coredns-* = CoreDNS (CNCF Graduated)
# - metrics-server-* = Metrics Server (CNCF project)
# - kube-proxy-* = part of Kubernetes (CNCF Graduated)

# Check container runtime (containerd = CNCF Graduated)
kubectl get nodes -o wide
# CONTAINER-RUNTIME column shows: containerd://X.X.X

# Look for other CNCF projects in all namespaces
kubectl get pods -A | grep -iE "prometheus|grafana|jaeger|cilium|calico|istio|argo|flux"

# Check Helm (CNCF Graduated) — might be installed
which helm && helm version 2>/dev/null

# List Helm releases if Helm is available
helm list -A 2>/dev/null
\`\`\``,
        verify: `\`\`\`bash
# CoreDNS should be running (CNCF Graduated)
kubectl get pods -n kube-system -l k8s-app=kube-dns
# Expected: Running

# Container runtime should be shown
kubectl get nodes -o wide | grep CONTAINER
\`\`\``
      },
      {
        title: 'Explore Prometheus Metrics (if available)',
        instruction: `If Prometheus is installed, explore the metrics it collects. If not, check what metrics-server provides:

1. Check if Prometheus is running (often in a "monitoring" namespace)
2. If available, port-forward to access Prometheus UI
3. As an alternative, use kubectl top to see Metrics Server data
4. Understand the difference: Metrics Server (real-time, for HPA) vs Prometheus (long-term, for dashboards)`,
        hints: [
          'kubectl get pods -n monitoring or kubectl get pods -n prometheus',
          'kubectl port-forward svc/prometheus-operated 9090:9090 -n monitoring',
          'kubectl top nodes && kubectl top pods to see Metrics Server',
          'Prometheus stores historical data; Metrics Server only has current values'
        ],
        solution: `\`\`\`bash
# Check for Prometheus
kubectl get pods -A | grep prometheus
kubectl get ns | grep -E "monitoring|prometheus|observ"

# If monitoring namespace exists, port-forward Prometheus
if kubectl get ns monitoring 2>/dev/null; then
  kubectl get pods -n monitoring
  kubectl port-forward svc/prometheus-operated 9090:9090 -n monitoring &
  echo "Prometheus available at http://localhost:9090"
fi

# Regardless, Metrics Server provides real-time metrics
kubectl top nodes 2>/dev/null || echo "Metrics Server not available"
kubectl top pods -A 2>/dev/null | head -10

# Observe difference:
# kubectl top → current point-in-time (Metrics Server)
# Prometheus → historical, queryable with PromQL
echo "Metrics Server gives current usage only"
echo "Prometheus stores history for trend analysis"
\`\`\``,
        verify: `\`\`\`bash
# Metrics Server test
kubectl top nodes 2>/dev/null && echo "Metrics Server working" || echo "Metrics Server not available"
\`\`\``
      },
      {
        title: 'Install and Use Helm (CNCF Graduated)',
        instruction: `Practice with Helm, the Kubernetes package manager (CNCF Graduated):

1. Verify Helm is installed or check its version
2. Add a Helm chart repository
3. Search for an nginx chart
4. Explore the chart structure without installing`,
        hints: [
          'helm version to check if Helm is installed',
          'helm repo add bitnami https://charts.bitnami.com/bitnami',
          'helm search repo nginx to find charts',
          'helm show values bitnami/nginx to see configurable options'
        ],
        solution: `\`\`\`bash
# Check Helm version
helm version 2>/dev/null || echo "Helm not installed"

if which helm >/dev/null 2>&1; then
  # Add a public chart repository
  helm repo add bitnami https://charts.bitnami.com/bitnami
  helm repo update

  # Search for nginx charts
  helm search repo nginx | head -5

  # Show chart metadata
  helm show chart bitnami/nginx | head -10

  # Show configurable values (without installing)
  helm show values bitnami/nginx | head -20

  # Dry-run install (shows what would be created)
  helm install my-nginx bitnami/nginx --dry-run | head -30
fi
\`\`\``,
        verify: `\`\`\`bash
helm version 2>/dev/null | grep -o "v[0-9]*\.[0-9]*"
# Expected: v3.x version number
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Understanding CNCF Project Graduation Status',
      difficulty: 'easy',
      symptom: 'Team is uncertain whether to adopt a CNCF project for production use. Need to evaluate project maturity.',
      diagnosis: `Check the project's CNCF maturity level:

\`\`\`bash
# Visit: landscape.cncf.io or cncf.io/projects

# Also check:
# - GitHub stars, contributors, and commit activity
# - Production adoption (who uses it in prod)
# - CNCF TOC vote for graduation
# - Security audits completed
# - Stable API version (not v0.x.y for core APIs)
\`\`\``,
      solution: `**Decision framework based on maturity:**

**Sandbox**: Use for experimentation only
- Early-stage, APIs may change
- Not recommended for production
- Evaluate for future adoption

**Incubating**: Evaluate for production
- Proven use cases exist
- Growing community
- Assess your specific requirements

**Graduated**: Generally safe for production
- Wide adoption confirmed
- Stable API
- Security audit completed
- Strong community

**Examples for decision:**
- New monitoring project in Sandbox → pilot only
- ArgoCD (Incubating) → production-ready for most teams
- Prometheus (Graduated) → standard choice for production`
    }
  ]
};
