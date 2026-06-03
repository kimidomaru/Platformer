window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['istio-fundamentals/istio-architecture'] = {
  theory: `
# Istio Architecture & Installation

## Relevance
Istio is the most widely adopted service mesh in the Kubernetes ecosystem. It provides observability, security (mTLS), and traffic control without modifying application code. Understanding its architecture is essential for any DevOps/SRE professional working with microservices in production.

## Core Concepts

### What is a Service Mesh?

A service mesh is a dedicated infrastructure layer that manages service-to-service communication. It intercepts all network traffic between microservices using sidecar proxies.

\`\`\`
Without Service Mesh:            With Service Mesh:
+-------+    +-------+          +-------+---+    +---+-------+
| App A |--->| App B |          | App A | P |--->| P | App B |
+-------+    +-------+          +-------+---+    +---+-------+
                                           \\        /
                                      Control Plane (istiod)
\`\`\`

### Istio Architecture

Istio is composed of two planes:

**Control Plane (istiod):**
- **Pilot** — distributes routing configuration to Envoy proxies
- **Citadel** — manages certificates and identities (mTLS/SPIFFE)
- **Galley** — validates and distributes configuration

Since Istio 1.5, all components were consolidated into a single binary: **istiod**.

\`\`\`
                    +-----------------+
                    |     istiod      |
                    |  (Pilot +       |
                    |   Citadel +     |
                    |   Galley)       |
                    +--------+--------+
                             |
              xDS API (config push)
                             |
         +-------------------+-------------------+
         |                   |                   |
    +----+----+         +----+----+         +----+----+
    | Envoy   |         | Envoy   |         | Envoy   |
    | Proxy   |         | Proxy   |         | Proxy   |
    +----+----+         +----+----+         +----+----+
    | App A   |         | App B   |         | App C   |
    +---------+         +---------+         +---------+
\`\`\`

**Data Plane (Envoy Proxy):**
- High-performance L4/L7 proxy
- Injected as a sidecar in each Pod
- Intercepts all inbound and outbound traffic via iptables
- Reports telemetry to the control plane

### Sidecar Injection

Istio automatically injects the Envoy container into Pods using a **mutating admission webhook**. There are two modes:

\`\`\`bash
# Enable automatic injection per namespace
kubectl label namespace default istio-injection=enabled

# Verify label
kubectl get namespace -L istio-injection

# Manual injection (for namespaces without auto-injection)
istioctl kube-inject -f deployment.yaml | kubectl apply -f -
\`\`\`

To disable injection on a specific Pod:
\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  annotations:
    sidecar.istio.io/inject: "false"
spec:
  containers:
    - name: app
      image: myapp:1.0
\`\`\`

### Installation Profiles

Istio offers pre-configured profiles:

| Profile | Components | Use Case |
|---------|------------|----------|
| default | istiod + ingress gateway | Production |
| demo | istiod + ingress + egress + tracing | Testing/Lab |
| minimal | istiod only | Minimal control |
| remote | Remote agents | Multi-cluster |
| empty | Nothing installed | Custom base |

\`\`\`bash
# Install with default profile
istioctl install --set profile=default -y

# Install with demo profile (includes more resources for lab)
istioctl install --set profile=demo -y

# View profile configuration
istioctl profile dump demo

# Compare profiles
istioctl profile diff default demo
\`\`\`

### Essential istioctl Commands

\`\`\`bash
# Verify installation status
istioctl verify-install

# Analyze mesh configuration
istioctl analyze

# Analyze a specific namespace
istioctl analyze -n production

# View proxy configuration for a Pod
istioctl proxy-config routes <pod-name> -n <namespace>

# View known clusters (upstream services)
istioctl proxy-config clusters <pod-name> -n <namespace>

# View proxy listeners
istioctl proxy-config listeners <pod-name> -n <namespace>

# Envoy admin dashboard
istioctl dashboard envoy <pod-name> -n <namespace>

# Kiali dashboard
istioctl dashboard kiali
\`\`\`

### Istio CRD Resources

Istio extends Kubernetes with specific CRDs:

| CRD | Function |
|-----|----------|
| VirtualService | Traffic routing rules |
| DestinationRule | Connection/load balancing policies |
| Gateway | Entry point for external traffic |
| ServiceEntry | External service registration |
| PeerAuthentication | mTLS policy |
| AuthorizationPolicy | L4/L7 access control |
| Sidecar | Fine-grained proxy scope control |
| EnvoyFilter | Direct Envoy customization |

### Common Mistakes

1. **Sidecar not injected** — forgot to label namespace with \`istio-injection=enabled\`
2. **503 between services** — DestinationRule with strict mTLS without matching PeerAuthentication
3. **Startup timeout** — istio-proxy init container is slow; adjust \`holdApplicationUntilProxyStarts\`
4. **Memory overhead** — each Envoy sidecar consumes ~50-100MB RAM

## Killer.sh Style Challenge

> **Scenario:** Install Istio with the demo profile on the cluster. Enable sidecar injection on the \`production\` namespace. Deploy an application with 2 replicas and verify that all Pods have 2 containers (app + istio-proxy).
`,
  quiz: [
    {
      question: 'Which Istio component is responsible for distributing routing configuration to Envoy proxies?',
      options: ['Citadel', 'Galley', 'Pilot (within istiod)', 'Mixer'],
      correct: 2,
      explanation: 'Pilot (now integrated into istiod) is responsible for converting high-level rules (VirtualService, DestinationRule) into xDS configuration that Envoy understands.',
      reference: 'Related concept: xDS API and how Pilot distributes configuration to the data plane.'
    },
    {
      question: 'How do you enable automatic Envoy sidecar injection in a namespace?',
      options: [
        'kubectl annotate namespace default sidecar=true',
        'kubectl label namespace default istio-injection=enabled',
        'istioctl inject --namespace default',
        'kubectl patch namespace default --type=merge -p \'{"spec":{"istio":"enabled"}}\''
      ],
      correct: 1,
      explanation: 'Istio uses a mutating webhook that watches for the istio-injection=enabled label on namespaces to automatically inject the Envoy sidecar into new Pods.',
      reference: 'Related concept: Mutating Admission Webhooks in Kubernetes.'
    },
    {
      question: 'Since which version did Istio consolidate Pilot, Citadel, and Galley into a single binary?',
      options: ['Istio 1.0', 'Istio 1.3', 'Istio 1.5', 'Istio 1.8'],
      correct: 2,
      explanation: 'Istio 1.5 introduced istiod, consolidating Pilot, Citadel, and Galley into a single process. This simplified installation and reduced control plane resource consumption.',
      reference: 'Related concept: Evolution of Istio architecture from microservices to monolith.'
    },
    {
      question: 'Which Istio installation profile is recommended for production environments?',
      options: ['demo', 'default', 'minimal', 'preview'],
      correct: 1,
      explanation: 'The default profile installs istiod and the ingress gateway, which is sufficient for production. The demo profile includes extra components (egress gateway, tracing) that consume more resources.',
      reference: 'Related concept: istioctl profile dump to view details of each profile.'
    },
    {
      question: 'What protocol does istiod use to send configuration to Envoy proxies?',
      options: ['gRPC REST API', 'xDS (discovery services)', 'HTTP/2 push', 'NATS messaging'],
      correct: 1,
      explanation: 'istiod uses the xDS protocol (Envoy Discovery Services) via gRPC to dynamically send configuration to Envoy proxies. This includes LDS, RDS, CDS, EDS, and SDS.',
      reference: 'Related concept: LDS (Listener), RDS (Route), CDS (Cluster), EDS (Endpoint), SDS (Secret).'
    },
    {
      question: 'Which annotation disables sidecar injection on a specific Pod?',
      options: [
        'istio.io/inject: "false"',
        'sidecar.istio.io/inject: "false"',
        'istio-injection: disabled',
        'proxy.istio.io/skip: "true"'
      ],
      correct: 1,
      explanation: 'The annotation sidecar.istio.io/inject: "false" in the Pod metadata disables Envoy sidecar injection, even if the namespace has auto-injection enabled.',
      reference: 'Related concept: Other Istio annotations like sidecar.istio.io/proxyMemoryLimit.'
    },
    {
      question: 'Which istioctl command allows analyzing mesh configuration problems?',
      options: [
        'istioctl verify-install',
        'istioctl analyze',
        'istioctl proxy-config',
        'istioctl validate'
      ],
      correct: 1,
      explanation: 'istioctl analyze examines cluster configuration and reports warnings and errors, such as VirtualServices referencing non-existent gateways or configuration conflicts.',
      reference: 'Related concept: istioctl analyze -n <namespace> for per-namespace analysis.'
    }
  ],
  flashcards: [
    {
      front: 'What are the three historic Istio components consolidated into istiod?',
      back: '1. **Pilot** — distributes routing configuration (xDS)\n2. **Citadel** — manages mTLS certificates and identities\n3. **Galley** — validates and distributes configuration\n\nSince Istio 1.5, all run as a single binary: **istiod**'
    },
    {
      front: 'What is the difference between control plane and data plane in Istio?',
      back: '**Control Plane (istiod):**\n- Manages configuration\n- Distributes certificates\n- Sends routing rules via xDS\n\n**Data Plane (Envoy proxies):**\n- Intercepts network traffic\n- Applies routing rules\n- Collects metrics and traces\n- Performs mTLS'
    },
    {
      front: 'How does the Envoy sidecar intercept Pod traffic?',
      back: 'The init container **istio-init** configures **iptables** rules that redirect all inbound traffic (port 15006) and outbound traffic (port 15001) to the Envoy proxy container.\n\nAlternatively, the Istio CNI Plugin can replace the init container, avoiding the need for NET_ADMIN capability.'
    },
    {
      front: 'What are the 5 Istio installation profiles?',
      back: '1. **default** — istiod + ingress gateway (production)\n2. **demo** — everything enabled (testing)\n3. **minimal** — istiod only\n4. **remote** — agents for multi-cluster\n5. **empty** — base for customization\n\nUsage: \`istioctl install --set profile=<name>\`'
    },
    {
      front: 'What is the xDS protocol in the context of Istio?',
      back: 'xDS is the Envoy discovery API family:\n- **LDS** — Listener Discovery Service\n- **RDS** — Route Discovery Service\n- **CDS** — Cluster Discovery Service\n- **EDS** — Endpoint Discovery Service\n- **SDS** — Secret Discovery Service\n\nistiod translates Istio CRDs (VirtualService, DestinationRule) into xDS configuration sent via gRPC to Envoy proxies.'
    },
    {
      front: 'What main CRDs does Istio add to Kubernetes?',
      back: '- **VirtualService** — routing rules\n- **DestinationRule** — connection policies\n- **Gateway** — external entry point\n- **ServiceEntry** — external services\n- **PeerAuthentication** — mTLS\n- **AuthorizationPolicy** — access control\n- **Sidecar** — proxy scope\n- **EnvoyFilter** — Envoy customization'
    },
    {
      front: 'What is the difference between istio-injection label and sidecar annotation?',
      back: '**Namespace Label:**\n\`istio-injection=enabled\`\n- Applies to all Pods in the namespace\n- Global configuration\n\n**Pod Annotation:**\n\`sidecar.istio.io/inject: "false"\`\n- Per-Pod override\n- Takes precedence over namespace label'
    }
  ],
  lab: {
    scenario: 'You need to set up Istio on a Kubernetes cluster to prepare the environment for microservices with observability and security.',
    objective: 'Install Istio, enable sidecar injection, deploy an application, and verify the mesh is working.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Install Istio and Enable Injection',
        instruction: `Install Istio with the demo profile and enable sidecar injection on the default namespace.

\`\`\`bash
# Download and install istioctl (if needed)
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=\$PWD/bin:\$PATH

# Install Istio with demo profile
istioctl install --set profile=demo -y

# Verify installation
istioctl verify-install

# Enable sidecar injection on default namespace
kubectl label namespace default istio-injection=enabled

# Verify Istio Pods
kubectl get pods -n istio-system
\`\`\``,
        hints: [
          'The demo profile installs istiod + ingress gateway + egress gateway',
          'istioctl verify-install confirms all components are healthy',
          'The istio-injection=enabled label activates the automatic injection webhook'
        ],
        solution: `\`\`\`bash
istioctl install --set profile=demo -y
istioctl verify-install
kubectl get pods -n istio-system
kubectl label namespace default istio-injection=enabled
kubectl get namespace default --show-labels
\`\`\``,
        verify: `\`\`\`bash
# Verify istiod is running
kubectl get deploy -n istio-system
# Expected: istiod, istio-ingressgateway, istio-egressgateway READY

# Verify namespace label
kubectl get namespace default -L istio-injection
# Expected: istio-injection=enabled

# Verify webhook
kubectl get mutatingwebhookconfiguration | grep istio
# Expected: istio-sidecar-injector
\`\`\``
      },
      {
        title: 'Deploy Application with Sidecar',
        instruction: `Deploy an application and verify that the Envoy sidecar was automatically injected.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbin
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: httpbin
  template:
    metadata:
      labels:
        app: httpbin
    spec:
      containers:
        - name: httpbin
          image: kennethreitz/httpbin
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: httpbin
  namespace: default
spec:
  selector:
    app: httpbin
  ports:
    - port: 8000
      targetPort: 80
EOF
\`\`\``,
        hints: [
          'Each Pod should have 2/2 containers READY (app + istio-proxy)',
          'Use kubectl describe pod to see the injected containers',
          'The istio-init container runs as an init container to set up iptables'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbin
spec:
  replicas: 2
  selector:
    matchLabels:
      app: httpbin
  template:
    metadata:
      labels:
        app: httpbin
    spec:
      containers:
        - name: httpbin
          image: kennethreitz/httpbin
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: httpbin
spec:
  selector:
    app: httpbin
  ports:
    - port: 8000
      targetPort: 80
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify Pods have 2 containers (READY 2/2)
kubectl get pods -l app=httpbin
# Expected: httpbin-xxx   2/2   Running   0   Xs

# Verify Pod containers
kubectl get pod -l app=httpbin -o jsonpath='{.items[0].spec.containers[*].name}'
# Expected: httpbin istio-proxy

# Verify init containers
kubectl get pod -l app=httpbin -o jsonpath='{.items[0].spec.initContainers[*].name}'
# Expected: istio-init
\`\`\``
      },
      {
        title: 'Analyze Proxy Configuration',
        instruction: `Use istioctl to inspect the Envoy proxy configuration and analyze the mesh.

\`\`\`bash
# Get Pod name
POD=\$(kubectl get pod -l app=httpbin -o jsonpath='{.items[0].metadata.name}')

# View configured routes in proxy
istioctl proxy-config routes \$POD

# View known clusters (upstream services)
istioctl proxy-config clusters \$POD

# View listeners
istioctl proxy-config listeners \$POD

# Analyze general mesh configuration
istioctl analyze

# View proxy status
istioctl proxy-status
\`\`\``,
        hints: [
          'proxy-config shows the actual configuration Envoy received via xDS',
          'istioctl analyze automatically detects configuration problems',
          'proxy-status shows if proxies are synchronized with istiod'
        ],
        solution: `\`\`\`bash
POD=\$(kubectl get pod -l app=httpbin -o jsonpath='{.items[0].metadata.name}')
istioctl proxy-config routes \$POD
istioctl proxy-config clusters \$POD
istioctl proxy-config listeners \$POD
istioctl analyze
istioctl proxy-status
\`\`\``,
        verify: `\`\`\`bash
# Verify proxy is synchronized
istioctl proxy-status | head -5
# Expected: NAME ... CDS ... LDS ... EDS ... RDS ... SYNCED

# Verify no analysis warnings
istioctl analyze 2>&1 | grep -c "Error"
# Expected: 0
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Sidecar not injected into Pods',
      difficulty: 'easy',
      symptom: 'After deploying, Pods have only 1 container (no istio-proxy). The Envoy sidecar was not injected.',
      diagnosis: `\`\`\`bash
# Verify namespace label
kubectl get namespace <namespace> -L istio-injection
# If it doesn't show "enabled", the webhook is not active

# Verify webhook exists
kubectl get mutatingwebhookconfiguration | grep istio

# Check Pod opt-out annotation
kubectl get pod <pod> -o jsonpath='{.metadata.annotations.sidecar\\.istio\\.io/inject}'

# Check istiod logs
kubectl logs -n istio-system deploy/istiod | grep -i "inject"
\`\`\``,
      solution: `**Causes and solutions:**

1. **Namespace without label:** Add the label:
\`\`\`bash
kubectl label namespace <namespace> istio-injection=enabled
\`\`\`

2. **Pod with opt-out:** Remove the annotation \`sidecar.istio.io/inject: "false"\` from the Pod template.

3. **Webhook not installed:** Reinstall Istio:
\`\`\`bash
istioctl install --set profile=default -y
\`\`\`

4. **Pre-existing Pods:** Pods created before the label need to be recreated:
\`\`\`bash
kubectl rollout restart deployment <name>
\`\`\``
    },
    {
      title: 'istiod not starting or CrashLoopBackOff',
      difficulty: 'medium',
      symptom: 'The istiod Pod in the istio-system namespace does not reach Running state. It may be Pending, CrashLoopBackOff, or Error.',
      diagnosis: `\`\`\`bash
# Check Pod status
kubectl get pods -n istio-system -l app=istiod

# View istiod logs
kubectl logs -n istio-system deploy/istiod --tail=50

# Check events
kubectl describe pod -n istio-system -l app=istiod

# Check resources
kubectl top pod -n istio-system

# Verify CRDs are installed
kubectl get crds | grep istio | wc -l
\`\`\``,
      solution: `**Common causes:**

1. **Insufficient resources:** istiod requires ~500Mi of memory. Check if the node has available resources.

2. **Missing CRDs:** If installation was partial:
\`\`\`bash
istioctl install --set profile=default -y --force
\`\`\`

3. **Version conflict:** Incompatible CRD and istiod versions:
\`\`\`bash
istioctl version
# client and server should be compatible
\`\`\`

4. **Webhook blocking:** If the webhook is configured but istiod is not ready, new Pods may stay pending. Temporarily disable:
\`\`\`bash
kubectl delete mutatingwebhookconfiguration istio-sidecar-injector
# Reinstall Istio after resolving the issue
\`\`\``
    },
    {
      title: 'High memory consumption by sidecars',
      difficulty: 'hard',
      symptom: 'The cluster has elevated memory consumption. Each Pod consumes significantly more RAM than expected due to the Envoy sidecar.',
      diagnosis: `\`\`\`bash
# View sidecar memory consumption
kubectl top pods -n <namespace> --containers | grep istio-proxy

# View current resource limits
kubectl get pod <pod> -o jsonpath='{.spec.containers[?(@.name=="istio-proxy")].resources}'

# Count total sidecars in cluster
kubectl get pods --all-namespaces -o jsonpath='{range .items[*]}{.spec.containers[*].name}{"\\n"}{end}' | grep -c istio-proxy

# View Envoy metrics
kubectl exec <pod> -c istio-proxy -- pilot-agent request GET /stats | grep "server.memory"
\`\`\``,
      solution: `**Optimization strategies:**

1. **Limit sidecar resources** via Pod annotation:
\`\`\`yaml
annotations:
  sidecar.istio.io/proxyMemoryLimit: "128Mi"
  sidecar.istio.io/proxyCPULimit: "200m"
  sidecar.istio.io/proxyMemory: "64Mi"
  sidecar.istio.io/proxyCPU: "50m"
\`\`\`

2. **Reduce proxy scope** with Sidecar resource:
\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: Sidecar
metadata:
  name: restrict-egress
  namespace: production
spec:
  egress:
    - hosts:
        - "./*"
        - "istio-system/*"
\`\`\`

3. **Consider ambient mesh** (Istio ambient mode) which eliminates sidecars using ztunnel at the node level.

4. **Exclude namespaces** that don't need mesh (monitoring, logging, etc.)`
    }
  ]
};
