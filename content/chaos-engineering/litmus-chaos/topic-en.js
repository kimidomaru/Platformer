window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['chaos-engineering/litmus-chaos'] = {
  theory: `
# LitmusChaos on Kubernetes

## Relevance
LitmusChaos is a cloud-native chaos engineering platform, part of the CNCF (graduated). It uses native Kubernetes CRDs to define, execute, and observe chaos experiments. It includes ChaosHub with pre-defined experiments, probes for automatic steady state validation, and workflows for orchestrating complex experiments.

## Core Concepts

### LitmusChaos Architecture

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                    LitmusChaos Architecture              │
│                                                         │
│  ┌─────────────────┐     ┌──────────────────────┐      │
│  │  Litmus Portal  │     │     ChaosCenter       │      │
│  │  (Web UI)       │────→│   (Control Plane)     │      │
│  └─────────────────┘     └──────────┬───────────┘      │
│                                     │                   │
│                          ┌──────────▼───────────┐      │
│                          │   Chaos Agent         │      │
│                          │   (Subscriber)        │      │
│                          └──────────┬───────────┘      │
│                                     │                   │
│  ┌──────────┐  ┌──────────┐  ┌─────▼──────┐           │
│  │ChaosHub  │  │Chaos     │  │Chaos       │           │
│  │(Exps)    │  │Workflow  │  │Runner      │           │
│  └──────────┘  └──────────┘  └─────┬──────┘           │
│                                     │                   │
│                          ┌──────────▼───────────┐      │
│                          │   Experiment Pods     │      │
│                          │   (chaos injection)   │      │
│                          └──────────────────────┘      │
└─────────────────────────────────────────────────────────┘
\`\`\`

### LitmusChaos CRDs

\`\`\`yaml
# 1. ChaosExperiment — Defines the experiment type
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosExperiment
metadata:
  name: pod-delete
  namespace: litmus
spec:
  definition:
    scope: Namespaced
    permissions:
      - apiGroups: [""]
        resources: ["pods"]
        verbs: ["delete", "list", "get"]
    image: litmuschaos/go-runner:latest
    args:
      - -name
      - pod-delete
    env:
      - name: TOTAL_CHAOS_DURATION
        value: "30"
      - name: CHAOS_INTERVAL
        value: "10"
      - name: FORCE
        value: "false"
\`\`\`

\`\`\`yaml
# 2. ChaosEngine — Binds experiment to target
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: my-app-chaos
  namespace: default
spec:
  appinfo:
    appns: default
    applabel: "app=my-app"
    appkind: deployment
  engineState: active
  chaosServiceAccount: litmus-admin
  experiments:
    - name: pod-delete
      spec:
        components:
          env:
            - name: TOTAL_CHAOS_DURATION
              value: "60"
            - name: CHAOS_INTERVAL
              value: "10"
            - name: FORCE
              value: "true"
            - name: PODS_AFFECTED_PERC
              value: "50"
        probe:
          - name: check-app-health
            type: httpProbe
            httpProbe/inputs:
              url: http://my-app.default:8080/health
              insecureSkipVerify: false
              method:
                get:
                  criteria: ==
                  responseCode: "200"
            mode: Continuous
            runProperties:
              probeTimeout: 5s
              interval: 5s
              retry: 3
\`\`\`

\`\`\`yaml
# 3. ChaosResult — Experiment result (automatically generated)
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosResult
metadata:
  name: my-app-chaos-pod-delete
  namespace: default
spec:
  engine: my-app-chaos
  experiment: pod-delete
status:
  experimentStatus:
    phase: Completed
    verdict: Pass    # Pass | Fail | Awaited
  probeSuccessPercentage: "100"
  history:
    passedRuns: 5
    failedRuns: 0
\`\`\`

### Experiment Types (ChaosHub)

\`\`\`
Generic Experiments:
├── pod-delete          — Randomly deletes pods
├── container-kill      — Kills specific container
├── pod-cpu-hog         — CPU stress on pod
├── pod-memory-hog      — Memory stress on pod
├── pod-io-stress       — I/O stress on pod
├── pod-network-latency — Injects network latency
├── pod-network-loss    — Injects packet loss
├── pod-network-corruption — Packet corruption
├── pod-network-duplication — Packet duplication
├── pod-dns-error       — DNS error
├── pod-dns-spoof       — DNS spoofing
├── disk-fill           — Fills pod disk
└── node-drain          — Node drain

AWS Experiments:
├── ec2-stop-by-id      — Stops EC2 instance
├── ebs-loss-by-id      — Detaches EBS volume
├── rds-instance-reboot — Reboots RDS instance
└── ecs-container-kill  — Kills ECS container

GCP Experiments:
├── gcp-vm-instance-stop — Stops GCP VM
└── gcp-vm-disk-loss     — Detaches GCP disk

Azure Experiments:
├── azure-instance-stop  — Stops Azure VM
└── azure-disk-loss      — Detaches Azure disk
\`\`\`

### Probes — Automatic Steady State Validation

\`\`\`yaml
# HTTP Probe — Checks health endpoint
probe:
  - name: app-health-check
    type: httpProbe
    httpProbe/inputs:
      url: http://my-app.default:8080/health
      method:
        get:
          criteria: ==
          responseCode: "200"
    mode: Continuous   # SOT | EOT | Edge | Continuous | OnChaos
    runProperties:
      probeTimeout: 10s
      interval: 5s
      retry: 3
      initialDelay: 2s

# CMD Probe — Executes command and validates output
  - name: check-replicas
    type: cmdProbe
    cmdProbe/inputs:
      command: kubectl get deployment my-app -o jsonpath='{.status.readyReplicas}'
      comparator:
        type: int
        criteria: ">="
        value: "2"
    mode: Edge          # Checks at start and end of chaos

# Prometheus Probe — Queries metrics
  - name: check-error-rate
    type: promProbe
    promProbe/inputs:
      endpoint: http://prometheus.monitoring:9090
      query: rate(http_requests_total{status=~"5.*",app="my-app"}[1m])
      comparator:
        type: float
        criteria: "<="
        value: "0.01"
    mode: Continuous

# K8s Probe — Validates K8s resource state
  - name: check-pod-status
    type: k8sProbe
    k8sProbe/inputs:
      group: ""
      version: v1
      resource: pods
      namespace: default
      fieldSelector: status.phase=Running
      labelSelector: app=my-app
      operation: present   # present | absent | create | delete
    mode: Continuous
\`\`\`

**Probe Modes:**

| Mode | When it runs | Use Case |
|------|-------------|----------|
| SOT | Start of Test | Validate preconditions |
| EOT | End of Test | Validate final state |
| Edge | SOT + EOT | Compare before/after |
| Continuous | Throughout chaos | Monitor during failure |
| OnChaos | Only during injection | Validate during chaos |

### Chaos Workflows

\`\`\`yaml
# Workflow — Orchestrates multiple experiments
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: resilience-test-workflow
  namespace: litmus
spec:
  entrypoint: resilience-tests
  templates:
    - name: resilience-tests
      steps:
        # Step 1: Pod Delete
        - - name: pod-delete-test
            template: pod-delete-experiment
        # Step 2 (after step 1): Network Latency
        - - name: network-latency-test
            template: network-latency-experiment
        # Step 3 (parallel): CPU + Memory stress
        - - name: cpu-stress-test
            template: cpu-stress-experiment
          - name: memory-stress-test
            template: memory-stress-experiment

    - name: pod-delete-experiment
      container:
        image: litmuschaos/litmus-checker:latest
        args:
          - -file=/tmp/chaosengine-pod-delete.yaml
        env:
          - name: CHAOS_ENGINE
            value: pod-delete-engine

    - name: network-latency-experiment
      container:
        image: litmuschaos/litmus-checker:latest
        args:
          - -file=/tmp/chaosengine-network-latency.yaml

    - name: cpu-stress-experiment
      container:
        image: litmuschaos/litmus-checker:latest
        args:
          - -file=/tmp/chaosengine-cpu-stress.yaml

    - name: memory-stress-experiment
      container:
        image: litmuschaos/litmus-checker:latest
        args:
          - -file=/tmp/chaosengine-memory-stress.yaml
\`\`\`

### Installation

\`\`\`bash
# Option 1: Helm (recommended)
helm repo add litmuschaos https://litmuschaos.github.io/litmus-helm/
helm install litmus litmuschaos/litmus \\
  --namespace litmus \\
  --create-namespace \\
  --set portal.frontend.service.type=NodePort

# Option 2: kubectl
kubectl apply -f https://litmuschaos.github.io/litmus/litmus-operator-v3.0.0.yaml

# Verify installation
kubectl get pods -n litmus
# litmus-frontend, litmus-server, mongodb
\`\`\`

### ChaosServiceAccount — RBAC

\`\`\`yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: litmus-admin
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: litmus-admin-role
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "events", "replicationcontrollers"]
    verbs: ["create", "delete", "get", "list", "patch", "update"]
  - apiGroups: ["apps"]
    resources: ["deployments", "daemonsets", "replicasets", "statefulsets"]
    verbs: ["list", "get", "patch", "update"]
  - apiGroups: ["batch"]
    resources: ["jobs"]
    verbs: ["create", "list", "get", "delete"]
  - apiGroups: ["litmuschaos.io"]
    resources: ["chaosengines", "chaosexperiments", "chaosresults"]
    verbs: ["create", "list", "get", "patch", "update", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: litmus-admin-binding
subjects:
  - kind: ServiceAccount
    name: litmus-admin
    namespace: default
roleRef:
  kind: ClusterRole
  name: litmus-admin-role
  apiGroup: rbac.authorization.k8s.io
\`\`\`

### Common Mistakes

1. **Insufficient RBAC** — ChaosServiceAccount needs adequate permissions (pods, deployments, jobs)
2. **Wrong namespace** — ChaosEngine must be in the same namespace as the target app (for Namespaced experiments)
3. **Misconfigured probe** — Wrong URL or command makes the probe fail regardless of chaos
4. **TOTAL_CHAOS_DURATION too short** — Insufficient time for the system to react and measure
5. **No observability** — Running chaos without Prometheus/Grafana prevents impact analysis
6. **Incorrect applabel** — The label selector in appinfo must match exactly the target pod label

## Killer.sh Style Challenge

> **Scenario:** Configure LitmusChaos to run a resilience workflow: (1) pod-delete on the "frontend" deployment with 50% pods affected, (2) pod-network-latency of 200ms on the "api" deployment, (3) HTTP Continuous probes validating /health on both services, (4) result must be Pass to consider the system resilient.
`,
  quiz: [
    {
      question: 'What are the three main CRDs of LitmusChaos?',
      options: [
        'ChaosDeployment, ChaosService, ChaosIngress',
        'ChaosExperiment (defines experiment), ChaosEngine (binds to target), ChaosResult (result)',
        'ChaosTest, ChaosReport, ChaosAlert',
        'ChaosJob, ChaosCronJob, ChaosStatus'
      ],
      correct: 1,
      explanation: 'LitmusChaos uses 3 CRDs: ChaosExperiment (failure type definition), ChaosEngine (binds experiment to target app + probes), and ChaosResult (automatically generated with Pass/Fail verdict).',
      reference: 'Related concept: ChaosEngine is the main CRD the user creates to execute chaos.'
    },
    {
      question: 'What are Probes in LitmusChaos?',
      options: [
        'Kubernetes health checks',
        'Automatic steady state validation mechanisms during the chaos experiment',
        'Experiment logs',
        'Performance metrics'
      ],
      correct: 1,
      explanation: 'Probes automatically validate whether steady state holds during chaos. Types: httpProbe (endpoint), cmdProbe (command), promProbe (Prometheus query), k8sProbe (K8s resources). The Pass/Fail result depends on probes.',
      reference: 'Related concept: Continuous mode monitors throughout chaos; Edge compares before/after.'
    },
    {
      question: 'What is the purpose of the appinfo field in ChaosEngine?',
      options: [
        'Configure the ChaosHub',
        'Identify the chaos target application (namespace, label, kind)',
        'Configure probes',
        'Define blast radius'
      ],
      correct: 1,
      explanation: 'The appinfo field defines the target: appns (namespace), applabel (label selector like app=my-app), and appkind (deployment, statefulset, daemonset). LitmusChaos uses this information to find the pods to be affected.',
      reference: 'Related concept: PODS_AFFECTED_PERC controls the percentage of pods affected.'
    },
    {
      question: 'What is the ChaosHub?',
      options: [
        'Storage for chaos results',
        'Repository of pre-defined experiments (pod-delete, network-latency, etc.) ready to use',
        'Metrics dashboard',
        'CI/CD pipeline'
      ],
      correct: 1,
      explanation: 'ChaosHub is a Git-based repository of pre-defined experiments for different platforms (Kubernetes, AWS, GCP, Azure). Users can use experiments from the public hub or create private hubs.',
      reference: 'Related concept: Public hub at hub.litmuschaos.io with 50+ experiments.'
    },
    {
      question: 'Which probe mode validates steady state throughout the entire chaos execution?',
      options: [
        'SOT (Start of Test)',
        'Continuous — monitors throughout the entire chaos',
        'EOT (End of Test)',
        'Edge (start and end)'
      ],
      correct: 1,
      explanation: 'Continuous mode runs the probe repeatedly throughout the chaos duration, checking at intervals whether steady state holds. If any check fails, the result will be Fail.',
      reference: 'Related concept: Edge (SOT+EOT) compares state before and after; OnChaos validates only during injection.'
    },
    {
      question: 'What does PODS_AFFECTED_PERC control?',
      options: [
        'Chaos duration',
        'The percentage of target app pods that will be affected by the experiment',
        'Acceptable error rate',
        'Number of probes'
      ],
      correct: 1,
      explanation: 'PODS_AFFECTED_PERC defines the percentage of (target app) pods that will be affected. For example, with 50% on a Deployment with 4 replicas, 2 pods will be deleted/affected.',
      reference: 'Related concept: Use low values (25-50%) to start and increase gradually.'
    },
    {
      question: 'What happens if a probe fails during the experiment?',
      options: [
        'The experiment continues normally',
        'The ChaosResult receives verdict: Fail, indicating the system is not resilient to the tested scenario',
        'The cluster is restarted',
        'The probe is ignored'
      ],
      correct: 1,
      explanation: 'If a probe fails (e.g., HTTP returns 500 instead of 200), the ChaosResult receives verdict: Fail. This indicates the system did not maintain steady state during chaos — a weakness was found.',
      reference: 'Related concept: probeSuccessPercentage shows the probe success rate.'
    }
  ],
  flashcards: [
    {
      front: 'Which CRDs does LitmusChaos use and what is each one for?',
      back: '**ChaosExperiment:**\n- Defines the failure TYPE\n- Executor image\n- Required permissions\n- Default parameters\n- Comes from ChaosHub\n\n**ChaosEngine:**\n- Binds experiment to TARGET APP\n- Defines appinfo (ns, label, kind)\n- Configures probes\n- Parameter overrides\n- Trigger: engineState: active\n\n**ChaosResult:**\n- Generated AUTOMATICALLY\n- Verdict: Pass | Fail | Awaited\n- probeSuccessPercentage\n- Run history\n\n**Flow:** ChaosExperiment + ChaosEngine → ChaosResult'
    },
    {
      front: 'What types of Probes exist in LitmusChaos?',
      back: '**httpProbe:**\n- Checks HTTP endpoint\n- Validates response code (200)\n- URL + method (GET/POST)\n\n**cmdProbe:**\n- Executes shell command\n- Compares output (int, string, float)\n- Ex: kubectl get deployment\n\n**promProbe:**\n- Queries Prometheus\n- Validates metric (PromQL)\n- Ex: error rate < 1%\n\n**k8sProbe:**\n- Validates K8s resources\n- present/absent/create/delete\n- fieldSelector + labelSelector\n\n**Modes:**\n- SOT: start | EOT: end\n- Edge: start + end\n- Continuous: throughout chaos\n- OnChaos: only during injection'
    },
    {
      front: 'How does a LitmusChaos experiment flow work?',
      back: '**1. Preparation:**\n- Install LitmusChaos (Helm/kubectl)\n- Create ServiceAccount with RBAC\n- Select experiment from ChaosHub\n\n**2. Configuration:**\n- Create ChaosEngine with:\n  - appinfo (target)\n  - experiments (chaos type)\n  - probes (validation)\n  - parameters (duration, %, etc)\n\n**3. Execution:**\n- engineState: active → triggers\n- Runner pod created\n- Experiment pod injects failure\n- Probes monitor steady state\n\n**4. Result:**\n- ChaosResult generated\n- Pass = system resilient\n- Fail = weakness found\n\n**5. Cleanup:**\n- engineState: stop\n- Chaos pods removed'
    },
    {
      front: 'What popular experiments does ChaosHub offer?',
      back: '**Pod/Container:**\n- pod-delete: Randomly deletes pods\n- container-kill: Kills container\n- pod-cpu-hog: CPU stress\n- pod-memory-hog: Memory stress\n- pod-io-stress: I/O stress\n\n**Network:**\n- pod-network-latency: Injects delay\n- pod-network-loss: Packet loss\n- pod-network-corruption: Corruption\n- pod-dns-error: DNS failure\n\n**Node:**\n- node-drain: K8s node drain\n- disk-fill: Fills disk\n\n**Cloud:**\n- ec2-stop-by-id (AWS)\n- gcp-vm-instance-stop (GCP)\n- azure-instance-stop (Azure)'
    },
    {
      front: 'What RBAC does LitmusChaos need?',
      back: '**ServiceAccount:** litmus-admin\n\n**ClusterRole needs:**\n- pods: create, delete, get, list, patch\n- deployments, daemonsets, statefulsets: list, get, patch\n- jobs: create, list, get, delete\n- chaosengines: CRUD\n- chaosexperiments: CRUD\n- chaosresults: CRUD\n- events: create, list, get\n- pods/log: get, list\n\n**Tip:** For Namespaced experiments, Role + RoleBinding suffice. For cluster-wide (node-drain), use ClusterRole.\n\n**Common error:** Insufficient RBAC is the #1 cause of failing experiments.'
    },
    {
      front: 'How to integrate LitmusChaos into CI/CD?',
      back: '**GitHub Actions:**\n1. Deploy app to staging\n2. Apply ChaosEngine\n3. Wait for ChaosResult\n4. Verify verdict == Pass\n5. If Pass → deploy to production\n6. If Fail → block deploy\n\n**Workflow:**\n\`\`\`yaml\nsteps:\n  - kubectl apply -f chaosengine.yaml\n  - wait for chaosresult\n  - check verdict\n  - if fail: exit 1\n\`\`\`\n\n**Litmus Workflows:**\n- Orchestrates multiple experiments\n- Sequential or parallel\n- Uses Argo Workflows engine\n- Can be scheduled (CronWorkflow)\n\n**Maturity Level 3:** Chaos in CI/CD'
    }
  ],
  lab: {
    scenario: 'You need to configure LitmusChaos to run resilience experiments on a Kubernetes application, with automatic validation probes.',
    objective: 'Learn how to install LitmusChaos, configure ChaosEngine with probes, execute experiments, and interpret results.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Install LitmusChaos and prepare ServiceAccount',
        instruction: `Install LitmusChaos and configure the required RBAC:
1. Install LitmusChaos via Helm in the litmus namespace
2. Create ServiceAccount litmus-admin in the default namespace
3. Create ClusterRole with permissions for pods, deployments, jobs, and Litmus CRDs
4. Create ClusterRoleBinding binding the ServiceAccount to the ClusterRole`,
        hints: [
          'Use the Helm chart litmuschaos/litmus',
          'ServiceAccount needs permissions on litmuschaos.io API group',
          'For pod-delete, needs delete on pods'
        ],
        solution: `\`\`\`bash
# Install LitmusChaos
helm repo add litmuschaos https://litmuschaos.github.io/litmus-helm/
helm install litmus litmuschaos/litmus \\
  --namespace litmus \\
  --create-namespace

# Verify installation
kubectl get pods -n litmus
\`\`\`

\`\`\`yaml
# litmus-rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: litmus-admin
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: litmus-admin-role
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "events"]
    verbs: ["create", "delete", "get", "list", "patch", "update"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["list", "get", "patch", "update"]
  - apiGroups: ["batch"]
    resources: ["jobs"]
    verbs: ["create", "list", "get", "delete"]
  - apiGroups: ["litmuschaos.io"]
    resources: ["chaosengines", "chaosexperiments", "chaosresults"]
    verbs: ["create", "list", "get", "patch", "update", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: litmus-admin-binding
subjects:
  - kind: ServiceAccount
    name: litmus-admin
    namespace: default
roleRef:
  kind: ClusterRole
  name: litmus-admin-role
  apiGroup: rbac.authorization.k8s.io
\`\`\`

\`\`\`bash
kubectl apply -f litmus-rbac.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify LitmusChaos running
kubectl get pods -n litmus
# Expected output: litmus-frontend, litmus-server, mongodb Running

# Verify ServiceAccount
kubectl get sa litmus-admin -n default
# Expected output: litmus-admin

# Verify ClusterRole
kubectl get clusterrole litmus-admin-role
# Expected output: litmus-admin-role

# Verify binding
kubectl get clusterrolebinding litmus-admin-binding
# Expected output: litmus-admin-binding
\`\`\``
      },
      {
        title: 'Create test app and run pod-delete with probes',
        instruction: `Create a test app and run the pod-delete experiment:
1. Create Deployment "nginx-test" with 3 replicas and label app=nginx-test
2. Create Service for the Deployment
3. Install ChaosExperiment pod-delete from ChaosHub
4. Create ChaosEngine with:
   - appinfo pointing to nginx-test
   - pod-delete experiment with TOTAL_CHAOS_DURATION=30 and PODS_AFFECTED_PERC=50
   - HTTP Continuous probe checking the service
5. Wait for result`,
        hints: [
          'ChaosExperiment can be installed via kubectl apply -f from ChaosHub',
          'PODS_AFFECTED_PERC=50 with 3 replicas will affect 1-2 pods',
          'The HTTP probe should point to the Service, not a specific pod'
        ],
        solution: `\`\`\`yaml
# nginx-test.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-test
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx-test
  template:
    metadata:
      labels:
        app: nginx-test
    spec:
      containers:
        - name: nginx
          image: nginx:1.25
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-test
  namespace: default
spec:
  selector:
    app: nginx-test
  ports:
    - port: 80
      targetPort: 80
\`\`\`

\`\`\`bash
kubectl apply -f nginx-test.yaml
kubectl wait --for=condition=available deployment/nginx-test --timeout=60s

# Install ChaosExperiment from ChaosHub
kubectl apply -f https://hub.litmuschaos.io/api/chaos/3.0.0?file=charts/generic/pod-delete/experiment.yaml -n default
\`\`\`

\`\`\`yaml
# chaos-engine.yaml
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: nginx-chaos
  namespace: default
spec:
  appinfo:
    appns: default
    applabel: "app=nginx-test"
    appkind: deployment
  engineState: active
  chaosServiceAccount: litmus-admin
  experiments:
    - name: pod-delete
      spec:
        components:
          env:
            - name: TOTAL_CHAOS_DURATION
              value: "30"
            - name: CHAOS_INTERVAL
              value: "10"
            - name: FORCE
              value: "true"
            - name: PODS_AFFECTED_PERC
              value: "50"
        probe:
          - name: nginx-health
            type: httpProbe
            httpProbe/inputs:
              url: http://nginx-test.default:80/
              method:
                get:
                  criteria: ==
                  responseCode: "200"
            mode: Continuous
            runProperties:
              probeTimeout: 5s
              interval: 5s
              retry: 3
\`\`\`

\`\`\`bash
kubectl apply -f chaos-engine.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify app is running
kubectl get pods -l app=nginx-test
# Expected output: 3 pods Running

# Verify ChaosEngine
kubectl get chaosengine nginx-chaos -n default
# Expected output: nginx-chaos with engineState active

# Wait and verify ChaosResult
kubectl get chaosresult -n default
# Expected output: nginx-chaos-pod-delete

# Verify verdict
kubectl get chaosresult nginx-chaos-pod-delete -n default -o jsonpath='{.status.experimentStatus.verdict}'
# Expected output: Pass (if system is resilient)

# Verify probeSuccessPercentage
kubectl get chaosresult nginx-chaos-pod-delete -n default -o jsonpath='{.status.probeSuccessPercentage}'
# Expected output: 100 (all probes passed)
\`\`\``
      },
      {
        title: 'Run network latency experiment',
        instruction: `Run a second network latency experiment:
1. Install ChaosExperiment pod-network-latency from ChaosHub
2. Create ChaosEngine with:
   - appinfo pointing to nginx-test
   - pod-network-latency experiment with NETWORK_LATENCY=200 (ms) and TOTAL_CHAOS_DURATION=30
   - cmdProbe verifying replicas >= 3
3. Verify result and compare with pod-delete`,
        hints: [
          'Network latency is injected via tc (traffic control) inside the pod',
          'NETWORK_LATENCY is in milliseconds',
          'Use a different ChaosEngine name for the second experiment'
        ],
        solution: `\`\`\`bash
# Install experiment from ChaosHub
kubectl apply -f https://hub.litmuschaos.io/api/chaos/3.0.0?file=charts/generic/pod-network-latency/experiment.yaml -n default
\`\`\`

\`\`\`yaml
# chaos-network.yaml
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: nginx-network-chaos
  namespace: default
spec:
  appinfo:
    appns: default
    applabel: "app=nginx-test"
    appkind: deployment
  engineState: active
  chaosServiceAccount: litmus-admin
  experiments:
    - name: pod-network-latency
      spec:
        components:
          env:
            - name: TOTAL_CHAOS_DURATION
              value: "30"
            - name: NETWORK_LATENCY
              value: "200"
            - name: PODS_AFFECTED_PERC
              value: "100"
        probe:
          - name: check-replicas
            type: cmdProbe
            cmdProbe/inputs:
              command: kubectl get deployment nginx-test -n default -o jsonpath='{.status.readyReplicas}'
              comparator:
                type: int
                criteria: ">="
                value: "3"
            mode: Continuous
            runProperties:
              probeTimeout: 10s
              interval: 5s
              retry: 2
\`\`\`

\`\`\`bash
kubectl apply -f chaos-network.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify ChaosEngine
kubectl get chaosengine nginx-network-chaos -n default
# Expected output: nginx-network-chaos

# Wait and verify result
kubectl get chaosresult -n default
# Expected output: nginx-chaos-pod-delete AND nginx-network-chaos-pod-network-latency

# Verify network latency verdict
kubectl get chaosresult nginx-network-chaos-pod-network-latency -n default -o jsonpath='{.status.experimentStatus.verdict}'
# Expected output: Pass

# List all results
kubectl get chaosresult -n default -o custom-columns=NAME:.metadata.name,VERDICT:.status.experimentStatus.verdict,PROBE:.status.probeSuccessPercentage
# Expected output: both with Pass and 100%
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ChaosEngine stays in "waiting" state and does not execute',
      difficulty: 'medium',
      symptom: 'After creating the ChaosEngine, it remains in waiting/initializing state. No chaos pod is created.',
      diagnosis: `\`\`\`bash
# 1. Check ChaosEngine status
kubectl describe chaosengine my-chaos -n default | grep -A10 "Status:"

# 2. Check if ChaosExperiment exists in the namespace
kubectl get chaosexperiment -n default
# The referenced experiment must exist

# 3. Check ServiceAccount
kubectl get sa litmus-admin -n default
# Must exist

# 4. Check RBAC permissions
kubectl auth can-i create jobs --as=system:serviceaccount:default:litmus-admin
kubectl auth can-i delete pods --as=system:serviceaccount:default:litmus-admin

# 5. Check events
kubectl get events -n default --sort-by='.lastTimestamp' | grep chaos
\`\`\``,
      solution: `**Causes and solutions:**

1. **ChaosExperiment not installed:** The ChaosExperiment referenced in the ChaosEngine must exist in the SAME namespace. Install via ChaosHub: kubectl apply -f <hub-url>.

2. **ServiceAccount not found:** The chaosServiceAccount defined in the ChaosEngine must exist. Create the ServiceAccount and bindings.

3. **Insufficient RBAC:** The ServiceAccount needs permissions to create jobs, delete pods, and access Litmus CRDs. Check ClusterRole/Role.

4. **Incorrect appinfo:** applabel must match exactly the target pod labels. Verify with kubectl get pods -l <label>.

5. **Litmus Operator not installed:** The Litmus operator/runner must be running. Check pods in the litmus namespace.`
    },
    {
      title: 'Probe returns Fail even without real failure',
      difficulty: 'hard',
      symptom: 'The ChaosResult shows verdict: Fail but the service was working normally. The probe seems to be failing incorrectly.',
      diagnosis: `\`\`\`bash
# 1. Check ChaosResult details
kubectl describe chaosresult my-chaos-pod-delete -n default | grep -A20 "Probe Status"

# 2. Check if probe URL is accessible from inside the cluster
kubectl run test-probe --image=curlimages/curl --rm -it -- curl -s http://my-app.default:8080/health

# 3. Check if probe timeout is adequate
# If probeTimeout=1s but app responds in 2s, it will fail

# 4. Check DNS
kubectl run test-dns --image=busybox --rm -it -- nslookup my-app.default

# 5. Check chaos runner logs
kubectl logs -l app=chaos-runner -n default --tail=30
\`\`\``,
      solution: `**Causes and solutions:**

1. **Incorrect URL:** The httpProbe URL must use the format service.namespace:port/path. Verify the Service exists and is accessible within the cluster.

2. **Timeout too short:** If probeTimeout is less than the app response time, the probe fails. Increase probeTimeout to at least 2x the expected response time.

3. **DNS not resolving:** If the chaos pod cannot resolve the service name, the probe fails. Check CoreDNS and the Service.

4. **Criteria too restrictive:** If criteria: == and responseCode: "200", any 201 or redirect fails. Consider criteria: "contains" or regex.

5. **Probe running before app is ready:** Add initialDelay to the probe to give the app time to initialize after chaos.`
    },
    {
      title: 'Pod-delete does not affect expected pods',
      difficulty: 'medium',
      symptom: 'The pod-delete experiment runs but does not delete the target app pods. Result is Pass but no pod was actually affected.',
      diagnosis: `\`\`\`bash
# 1. Check appinfo in ChaosEngine
kubectl get chaosengine my-chaos -n default -o yaml | grep -A5 appinfo

# 2. Check if labels match
kubectl get pods -n default -l app=my-app
# Should return pods

# 3. Check PODS_AFFECTED_PERC
kubectl get chaosengine my-chaos -n default -o yaml | grep PODS_AFFECTED_PERC

# 4. Check namespace
# ChaosEngine and app must be in the same namespace

# 5. Check experiment pod logs
kubectl logs -l chaosUID -n default --tail=30
\`\`\``,
      solution: `**Causes and solutions:**

1. **Incorrect applabel:** The applabel value must match EXACTLY the pod labels. Verify with kubectl get pods --show-labels. Format: "key=value".

2. **Incorrect appns:** If appns points to the wrong namespace, no pods will be found. Must be the namespace where the app pods are.

3. **Incorrect appkind:** If the app is a StatefulSet but appkind says "deployment", the lookup may fail. Check the workload type.

4. **PODS_AFFECTED_PERC=0:** If set to 0, no pods will be affected. Default value is 100%.

5. **RBAC in wrong namespace:** The ServiceAccount may have permissions in the litmus namespace but not in the app namespace. Use ClusterRole or create Role in the correct namespace.`
    }
  ]
};
