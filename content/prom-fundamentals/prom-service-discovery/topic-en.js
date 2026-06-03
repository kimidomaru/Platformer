window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['prom-fundamentals/prom-service-discovery'] = {
  theory: `
# Prometheus Service Discovery

## Relevance
In dynamic environments like Kubernetes, pods and services are constantly created and destroyed. Manually configuring targets is impractical. Prometheus automatic service discovery solves this problem by automatically discovering new targets to monitor.

## Core Concepts

### What is Service Discovery?
Service discovery is the mechanism by which Prometheus automatically discovers which targets (endpoints) to scrape. Instead of listing each IP manually, Prometheus queries a source of truth (Kubernetes API, Consul, DNS, etc.) to get the updated list of targets.

### Supported Discovery Mechanisms

| Mechanism | Description | Primary Use |
|-----------|-------------|-------------|
| \`kubernetes_sd_configs\` | Discovers pods, services, endpoints, nodes, and ingresses in K8s | Kubernetes clusters |
| \`static_configs\` | Fixed list of targets | Development, external targets |
| \`consul_sd_configs\` | Discovers services in Consul | Consul environments |
| \`dns_sd_configs\` | Resolves DNS SRV/A records | DNS service discovery environments |
| \`file_sd_configs\` | Reads targets from JSON/YAML files | Integration with external tools |
| \`ec2_sd_configs\` | Discovers EC2 instances on AWS | AWS environments |
| \`gce_sd_configs\` | Discovers GCE instances on GCP | GCP environments |
| \`azure_sd_configs\` | Discovers VMs on Azure | Azure environments |

### Kubernetes Service Discovery

Prometheus discovers 5 types of objects in Kubernetes:

| Role | What It Discovers | Meta Labels |
|------|-------------------|-------------|
| \`node\` | Cluster nodes | \`__meta_kubernetes_node_name\`, \`__meta_kubernetes_node_label_*\` |
| \`pod\` | Individual pods | \`__meta_kubernetes_pod_name\`, \`__meta_kubernetes_pod_namespace\`, \`__meta_kubernetes_pod_container_port_number\` |
| \`service\` | Services | \`__meta_kubernetes_service_name\`, \`__meta_kubernetes_service_namespace\` |
| \`endpoints\` | Service endpoints | Combines service + pod labels |
| \`ingress\` | Ingress resources | \`__meta_kubernetes_ingress_name\`, \`__meta_kubernetes_ingress_host\` |

### Kubernetes Service Discovery Configuration

\`\`\`yaml
# prometheus.yml
scrape_configs:
  # Discover and scrape Pods with annotations
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      # Only scrape pods with annotation prometheus.io/scrape=true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true

      # Use the path defined in the annotation, or /metrics by default
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)

      # Use the port defined in the annotation
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\\d+)?;(\\d+)
        replacement: \$1:\$2
        target_label: __address__

      # Preserve useful labels
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: pod
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: replace
        target_label: app
\`\`\`

### Relabeling — The Service Discovery Engine

Relabeling is the process of transforming, filtering, and renaming labels during scraping. It is Prometheus's most powerful mechanism for controlling which targets to scrape and how to organize metrics.

#### Relabel Actions

| Action | Description | Example |
|--------|-------------|---------|
| \`keep\` | Keep only targets matching the regex | Filter by annotation |
| \`drop\` | Remove targets matching the regex | Exclude namespaces |
| \`replace\` | Replace a label's value | Rename labels |
| \`labelmap\` | Copy labels matching the regex | Copy annotations as labels |
| \`labeldrop\` | Remove labels matching the regex | Clean meta labels |
| \`labelkeep\` | Keep only labels matching the regex | Keep selected labels |
| \`hashmod\` | Calculate modular hash of the label | Target sharding |

#### Relabeling Examples

\`\`\`yaml
relabel_configs:
  # KEEP: only scrape pods with annotation
  - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
    action: keep
    regex: "true"

  # DROP: exclude system namespaces
  - source_labels: [__meta_kubernetes_namespace]
    action: drop
    regex: "kube-system|kube-public"

  # REPLACE: create "namespace" label from meta label
  - source_labels: [__meta_kubernetes_namespace]
    target_label: namespace

  # LABELMAP: copy all pod labels to metrics
  - action: labelmap
    regex: __meta_kubernetes_pod_label_(.+)

  # REPLACE with regex: extract image version
  - source_labels: [__meta_kubernetes_pod_container_image]
    target_label: image_version
    regex: ".*:(.+)"
    replacement: "\$1"
\`\`\`

### metric_relabel_configs vs relabel_configs

| Aspect | \`relabel_configs\` | \`metric_relabel_configs\` |
|--------|-------------------|--------------------------|
| **When** | Before scrape (filters targets) | After scrape (filters metrics) |
| **Affects** | Which targets are scraped | Which metrics are stored |
| **Use** | Filter/organize targets | Remove unnecessary metrics |

\`\`\`yaml
scrape_configs:
  - job_name: 'myapp'
    # Before scrape — decides WHICH targets to scrape
    relabel_configs:
      - source_labels: [__meta_kubernetes_namespace]
        action: keep
        regex: "production"

    # After scrape — decides WHICH metrics to store
    metric_relabel_configs:
      - source_labels: [__name__]
        action: drop
        regex: "go_.*"  # Remove Go runtime internal metrics
\`\`\`

### Annotations for Service Discovery

Standard annotations pattern for pod auto-discovery:
\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  annotations:
    prometheus.io/scrape: "true"     # Enable scraping
    prometheus.io/port: "8080"       # /metrics endpoint port
    prometheus.io/path: "/metrics"   # Endpoint path (default: /metrics)
    prometheus.io/scheme: "https"    # Scheme (default: http)
\`\`\`

### ServiceMonitor (Prometheus Operator)

If you use the Prometheus Operator, service discovery is done via CRDs:
\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp-monitor
  namespace: monitoring
  labels:
    release: prometheus  # Label the Prometheus Operator watches
spec:
  selector:
    matchLabels:
      app: myapp
  namespaceSelector:
    matchNames:
      - production
      - staging
  endpoints:
    - port: http-metrics
      path: /metrics
      interval: 30s
      scrapeTimeout: 10s
\`\`\`

### PodMonitor (Prometheus Operator)
\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: myapp-pods
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: myapp
  podMetricsEndpoints:
    - port: metrics
      path: /metrics
      interval: 15s
\`\`\`

## Common Mistakes

1. **Annotation typo**: \`prometheus.io/scrap: "true"\` (missing 'e') — the pod is not discovered.
2. **Wrong port in annotation**: The port in the annotation must be the one exposing /metrics, not necessarily the service port.
3. **Insufficient RBAC**: The Prometheus ServiceAccount needs permissions to list pods, services, endpoints, and nodes.
4. **Unmonitored namespace**: If the Prometheus Operator only monitors specific namespaces, new namespaces are not automatically included.
5. **relabel_configs in wrong order**: Rule order matters. A drop before keep can remove targets you want to keep.
6. **Confusing relabel_configs with metric_relabel_configs**: relabel filters targets, metric_relabel filters metrics after scraping.

## Killer.sh Style Challenge

**Scenario:** Configure service discovery for a Kubernetes cluster with Prometheus.

**Tasks:**
1. Configure kubernetes_sd_configs to discover pods with annotation prometheus.io/scrape=true
2. Use relabel_configs to preserve namespace, pod, and app labels
3. Exclude pods from the kube-system namespace from scraping
4. Create a ServiceMonitor for an application in the production namespace

**Solutions:**
\`\`\`yaml
# 1-3. Complete pod discovery configuration
- job_name: 'k8s-pods'
  kubernetes_sd_configs:
    - role: pod
  relabel_configs:
    - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
      action: keep
      regex: true
    - source_labels: [__meta_kubernetes_namespace]
      action: drop
      regex: kube-system
    - source_labels: [__meta_kubernetes_namespace]
      target_label: namespace
    - source_labels: [__meta_kubernetes_pod_name]
      target_label: pod
    - source_labels: [__meta_kubernetes_pod_label_app]
      target_label: app

# 4. ServiceMonitor
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: myapp
  namespaceSelector:
    matchNames: [production]
  endpoints:
    - port: metrics
      interval: 30s
\`\`\`
`,
  quiz: [
    {
      question: 'Which kubernetes_sd_configs role is used to discover individual Pods?',
      options: ['node', 'service', 'pod', 'endpoints'],
      correct: 2,
      explanation: 'The "pod" role discovers all pods in the cluster, exposing meta labels like __meta_kubernetes_pod_name, __meta_kubernetes_pod_namespace, etc. The "endpoints" role can also discover pods, but through Service endpoints.',
      reference: 'Related concept: prom-architecture — targets and the Prometheus scraping model.'
    },
    {
      question: 'What is the difference between relabel_configs and metric_relabel_configs?',
      options: [
        'There is no difference, they are synonyms',
        'relabel_configs acts before scraping (filters targets), metric_relabel_configs acts after scraping (filters metrics)',
        'relabel_configs is for metrics, metric_relabel_configs is for targets',
        'relabel_configs only works with Kubernetes, metric_relabel_configs works with any SD'
      ],
      correct: 1,
      explanation: 'relabel_configs is applied BEFORE scraping — it decides which targets to scrape and how to organize target labels. metric_relabel_configs is applied AFTER scraping — it decides which collected metrics will be stored or discarded.',
      reference: 'Related concept: prom-exporters — use metric_relabel_configs to filter unnecessary exporter metrics.'
    },
    {
      question: 'Which standard annotation enables automatic scraping of a pod by Prometheus?',
      options: [
        'prometheus.io/enabled: "true"',
        'prometheus.io/scrape: "true"',
        'monitoring/scrape: "yes"',
        'prometheus.io/target: "true"'
      ],
      correct: 1,
      explanation: 'The annotation prometheus.io/scrape: "true" is the de facto standard to indicate that a pod should be scraped. Other common annotations include prometheus.io/port and prometheus.io/path.',
      reference: 'Related concept: prom-exporters — exporters usually already include these annotations in their manifests.'
    },
    {
      question: 'What does the "keep" action do in relabel_configs?',
      options: [
        'Keeps the original label value',
        'Keeps only targets whose source_label matches the regex, discarding all others',
        'Preserves all meta labels after scraping',
        'Keeps the target even if scraping fails'
      ],
      correct: 1,
      explanation: 'The "keep" action filters targets: only targets whose source_labels value matches the specified regex are kept. All other targets are discarded and will not be scraped. It is the opposite of the "drop" action.',
      reference: 'Related concept: prom-service-discovery — combine keep/drop for fine control over which targets to monitor.'
    },
    {
      question: 'Which Prometheus Operator CRD is used to configure service discovery for a Service?',
      options: [
        'PrometheusRule',
        'ServiceMonitor',
        'ScrapeConfig',
        'TargetGroup'
      ],
      correct: 1,
      explanation: 'ServiceMonitor is the Prometheus Operator CRD that defines how to discover and scrape endpoints of a Kubernetes Service. It replaces manual scrape_configs configuration in prometheus.yml.',
      reference: 'Related concept: prom-architecture — the Prometheus Operator manages Prometheus configuration via CRDs.'
    },
    {
      question: 'What is the main advantage of automatic service discovery over static_configs?',
      options: [
        'It is faster',
        'Automatically discovers and adapts to new and removed targets in dynamic environments',
        'Uses less memory',
        'Does not need authentication'
      ],
      correct: 1,
      explanation: 'In dynamic environments like Kubernetes, pods are constantly created and destroyed. Automatic service discovery adapts to these changes without manual intervention, while static_configs requires manual updates on every change.',
      reference: 'Related concept: prom-architecture — the Prometheus scraping cycle depends on an updated list of targets.'
    },
    {
      question: 'What does the "labelmap" action do in relabel_configs?',
      options: [
        'Creates a map of all labels',
        'Copies meta labels matching a regex to regular labels',
        'Removes all labels from a target',
        'Maps labels between different metrics'
      ],
      correct: 1,
      explanation: 'labelmap applies a regex to the NAME of all labels. Labels whose names match are copied, with the name replaced by the regex capture group. Example: __meta_kubernetes_pod_label_app -> app.',
      reference: 'Related concept: promql-basics — labels created via relabeling are available for PromQL queries.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 5 role types in kubernetes_sd_configs?',
      back: '1. **node** — discovers cluster nodes\n2. **pod** — discovers individual pods\n3. **service** — discovers Services\n4. **endpoints** — discovers Service endpoints (backing pods)\n5. **ingress** — discovers Ingress resources\n\nEach role exposes different meta labels (e.g., __meta_kubernetes_pod_name for role: pod).'
    },
    {
      front: 'What is the difference between relabel_configs and metric_relabel_configs?',
      back: '**relabel_configs**: applies BEFORE scraping\n- Decides WHICH targets to scrape\n- Filters/organizes discovery labels\n- Use for: keep/drop targets, rename labels\n\n**metric_relabel_configs**: applies AFTER scraping\n- Decides WHICH metrics to store\n- Filters already collected metrics\n- Use for: removing unnecessary metrics (go_*, process_*)'
    },
    {
      front: 'What are the 4 standard annotations for pod service discovery?',
      back: '```yaml\nprometheus.io/scrape: "true"   # Enable scraping\nprometheus.io/port: "8080"     # /metrics port\nprometheus.io/path: "/metrics" # Path (default: /metrics)\nprometheus.io/scheme: "https"  # Scheme (default: http)\n```\n\nThese annotations are used in relabel_configs to auto-discover and configure pod scraping.'
    },
    {
      front: 'What are the most common relabeling actions?',
      back: '- **keep**: keep targets matching regex\n- **drop**: remove targets matching regex\n- **replace**: replace label value (default)\n- **labelmap**: copy meta labels via name regex\n- **labeldrop**: remove labels by name (regex)\n- **labelkeep**: keep only labels by name\n- **hashmod**: target sharding via hash\n\nOrder matters! Rules are evaluated sequentially.'
    },
    {
      front: 'What is a ServiceMonitor and when should you use it?',
      back: 'ServiceMonitor is a **Prometheus Operator** CRD that defines how to scrape endpoints of a K8s Service.\n\n```yaml\napiVersion: monitoring.coreos.com/v1\nkind: ServiceMonitor\nspec:\n  selector:\n    matchLabels: { app: myapp }\n  endpoints:\n    - port: metrics\n      interval: 30s\n```\n\n**When to use:** When the cluster uses Prometheus Operator (kube-prometheus-stack). Replaces manual prometheus.yml configuration.\n\nAlternative: **PodMonitor** for pods without a Service.'
    },
    {
      front: 'What RBAC permissions does Prometheus need for K8s service discovery?',
      back: 'The Prometheus ServiceAccount needs:\n\n```yaml\napiGroups: [""]\nresources: [nodes, pods, services, endpoints]\nverbs: [get, list, watch]\n\napiGroups: [networking.k8s.io]\nresources: [ingresses]\nverbs: [get, list, watch]\n```\n\nWithout these permissions, service discovery fails silently and no targets are discovered.'
    },
    {
      front: 'How does file_sd_configs work?',
      back: 'file_sd_configs reads targets from JSON or YAML files on disk:\n\n```yaml\nscrape_configs:\n  - job_name: external\n    file_sd_configs:\n      - files: ["/etc/prometheus/targets/*.json"]\n        refresh_interval: 5m\n```\n\nFile format:\n```json\n[{"targets": ["host1:9090"], "labels": {"env": "prod"}}]\n```\n\n**When to use:** Integrate with external tools (Ansible, Terraform) that generate target lists.'
    }
  ],
  lab: {
    scenario: 'You need to configure service discovery for a Kubernetes cluster with Prometheus. The cluster has applications across multiple namespaces and you need to ensure all correct pods are monitored automatically.',
    objective: 'Configure kubernetes_sd_configs with relabel_configs for automatic pod discovery, set up annotations for service discovery, and create ServiceMonitors with the Prometheus Operator.',
    duration: '20-30 minutes',
    steps: [
      {
        title: 'Verify Current Targets and RBAC',
        instruction: `Before configuring service discovery, verify current targets and Prometheus permissions.

\`\`\`bash
# Check current targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, instance: .labels.instance, health: .health}'

# Check Prometheus ServiceAccount
kubectl get sa -n monitoring

# Check RBAC permissions
kubectl auth can-i list pods --as=system:serviceaccount:monitoring:prometheus -n default
kubectl auth can-i list services --as=system:serviceaccount:monitoring:prometheus -n default
kubectl auth can-i list nodes --as=system:serviceaccount:monitoring:prometheus
\`\`\``,
        hints: ['If RBAC is incorrect, service discovery fails silently', 'The ServiceAccount must have list/watch permission on pods, services, endpoints, and nodes', 'Check the Prometheus ClusterRole and ClusterRoleBinding'],
        solution: `\`\`\`bash
# List targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'

# Check RBAC
kubectl get clusterrole prometheus -o yaml
kubectl get clusterrolebinding prometheus -o yaml

# If RBAC doesn't exist, create it:
kubectl create clusterrole prometheus --verb=get,list,watch --resource=pods,services,endpoints,nodes
kubectl create clusterrolebinding prometheus --clusterrole=prometheus --serviceaccount=monitoring:prometheus
\`\`\``,
        verify: `\`\`\`bash
# Verify active targets exist
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'
# Expected output: number > 0

# Verify permissions
kubectl auth can-i list pods --as=system:serviceaccount:monitoring:prometheus --all-namespaces
# Expected output: yes
\`\`\``
      },
      {
        title: 'Configure Annotations and Test Discovery',
        instruction: `Create a test pod with service discovery annotations and verify Prometheus discovers it automatically.

\`\`\`yaml
# test-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: metrics-test
  namespace: default
  labels:
    app: metrics-test
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    prometheus.io/path: "/metrics"
spec:
  containers:
    - name: app
      image: prom/prometheus:latest
      ports:
        - containerPort: 8080
          name: metrics
\`\`\`

\`\`\`bash
kubectl apply -f test-pod.yaml
\`\`\`

After the pod starts, verify it appears in Prometheus targets.`,
        hints: ['Prometheus takes at least 1 scrape_interval to discover new pods', 'Check Status > Targets in the Prometheus UI', 'If the pod does not appear, check relabel_configs in prometheus.yml'],
        solution: `\`\`\`bash
kubectl apply -f test-pod.yaml
kubectl wait --for=condition=ready pod/metrics-test --timeout=60s
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.pod=="metrics-test")'
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod metrics-test -o jsonpath='{.status.phase}'
# Expected output: Running

kubectl get pod metrics-test -o jsonpath='{.metadata.annotations}'
# Expected output: contains prometheus.io/scrape: "true"
\`\`\``
      },
      {
        title: 'Create ServiceMonitor (Prometheus Operator)',
        instruction: `If the cluster uses Prometheus Operator, create a ServiceMonitor to discover an application.

\`\`\`yaml
# service-monitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp-monitor
  namespace: monitoring
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app: myapp
  namespaceSelector:
    matchNames:
      - default
      - production
  endpoints:
    - port: http-metrics
      path: /metrics
      interval: 30s
      scrapeTimeout: 10s
\`\`\`

\`\`\`bash
kubectl apply -f service-monitor.yaml
kubectl get servicemonitor -n monitoring
\`\`\``,
        hints: ['The "release: prometheus" label must match what the Prometheus Operator expects', 'Check serviceMonitorSelector in the Prometheus Operator resource', 'namespaceSelector defines in which namespaces to look for Services'],
        solution: `\`\`\`bash
kubectl get crd | grep monitoring.coreos.com
kubectl apply -f service-monitor.yaml
kubectl get servicemonitor -n monitoring myapp-monitor -o yaml
kubectl get prometheus -n monitoring -o jsonpath='{.items[0].spec.serviceMonitorSelector}'
\`\`\``,
        verify: `\`\`\`bash
kubectl get crd servicemonitors.monitoring.coreos.com
# Expected output: CRD with creation date

kubectl get servicemonitor -n monitoring
# Expected output: myapp-monitor in the list
\`\`\``
      },
      {
        title: 'Use metric_relabel_configs to Filter Metrics',
        instruction: `Configure metric_relabel_configs to remove unnecessary metrics that consume TSDB space.

\`\`\`yaml
scrape_configs:
  - job_name: 'kubernetes-pods'
    metric_relabel_configs:
      # Remove Go runtime internal metrics
      - source_labels: [__name__]
        action: drop
        regex: "go_.*"

      # Remove process metrics
      - source_labels: [__name__]
        action: drop
        regex: "process_.*"

      # Remove Prometheus debug metrics
      - source_labels: [__name__]
        action: drop
        regex: "promhttp_.*"
\`\`\`

Compare the metric count before and after applying the filters.`,
        hints: ['metric_relabel_configs acts AFTER scraping', 'Use with care: filtering too much can remove important metrics', 'Start with dropping metrics you know you don\'t need (go_*, process_*)'],
        solution: `\`\`\`bash
curl -s 'http://localhost:9090/api/v1/label/__name__/values' | jq '.data | length'
curl -X POST http://localhost:9090/-/reload
curl -s 'http://localhost:9090/api/v1/label/__name__/values' | jq '.data | length'
\`\`\``,
        verify: `\`\`\`bash
curl -s http://localhost:9090/api/v1/status/config | jq '.data.yaml' | grep "metric_relabel"
# Expected output: contains metric_relabel_configs
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Targets not appearing in Prometheus (service discovery not working)',
      difficulty: 'easy',
      symptom: 'You configured kubernetes_sd_configs but no targets appear on the Status > Targets page in Prometheus.',
      diagnosis: `\`\`\`bash
kubectl auth can-i list pods --as=system:serviceaccount:monitoring:prometheus --all-namespaces
kubectl logs -l app=prometheus -n monitoring --tail=30 | grep -i "error\\|discovery\\|sd"
curl -s http://localhost:9090/api/v1/status/config | jq '.data.yaml' | head -50
\`\`\``,
      solution: `**Common causes:**

1. **Insufficient RBAC:** Create a ClusterRole with get, list, watch on nodes, pods, services, endpoints.

2. **kubernetes_sd_configs not configured:** Verify a scrape_config with role: pod exists.

3. **relabel_configs with too restrictive "keep":** A keep that matches no targets removes all of them.
\`\`\`bash
# Check dropped targets (discovered but removed by relabel)
curl -s http://localhost:9090/api/v1/targets | jq '.data.droppedTargets | length'
\`\`\``
    },
    {
      title: 'Pod with prometheus.io/scrape annotation but not being scraped',
      difficulty: 'medium',
      symptom: 'The pod has the prometheus.io/scrape: "true" annotation, but does not appear in Prometheus targets. Other pods with the same annotation are scraped normally.',
      diagnosis: `\`\`\`bash
kubectl get pod <name> -o jsonpath='{.metadata.annotations}'
curl -s http://localhost:9090/api/v1/targets | jq '.data.droppedTargets[] | select(.discoveredLabels.__meta_kubernetes_pod_name=="<name>")'
kubectl port-forward pod/<name> 8080:8080 &
curl -s http://localhost:8080/metrics | head -5
\`\`\``,
      solution: `**Common causes:**

1. **Annotation as boolean instead of string:**
\`\`\`yaml
# WRONG — YAML interprets as boolean
prometheus.io/scrape: true

# CORRECT — must be string
prometheus.io/scrape: "true"
\`\`\`

2. **Wrong port in annotation:** Must be the container port exposing /metrics.

3. **Namespace excluded by relabel_configs:** Check for a drop rule on the namespace.

4. **Pod not Ready:** Non-Ready pods may be filtered depending on configuration.`
    },
    {
      title: 'ServiceMonitor not generating targets in Prometheus Operator',
      difficulty: 'hard',
      symptom: 'You created a ServiceMonitor but it does not appear in Prometheus targets. The Prometheus Operator is running.',
      diagnosis: `\`\`\`bash
kubectl get servicemonitor -n monitoring
kubectl get prometheus -n monitoring -o jsonpath='{.items[0].spec.serviceMonitorSelector}'
kubectl get servicemonitor <name> -n monitoring -o jsonpath='{.metadata.labels}'
kubectl logs -l app.kubernetes.io/name=prometheus-operator -n monitoring --tail=30
\`\`\``,
      solution: `**Common causes:**

1. **Label selector mismatch:** The ServiceMonitor must have the label the Prometheus Operator expects (usually release: prometheus).

2. **namespaceSelector doesn't include the namespace:** Ensure matchNames includes the target namespace, or use any: true.

3. **Service doesn't exist or labels don't match:** Verify the Service exists with the correct labels and has the referenced port.

4. **Prometheus lacks namespace permissions:** Check RBAC for the target namespace.`
    }
  ]
};
