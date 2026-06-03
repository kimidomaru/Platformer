window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['loki/loki-fundamentals'] = {
  theory: `# Loki — Fundamentals

## Exam Relevance
> Loki is covered in observability and platform operations certifications (advanced CKA, KCNA, KubeAstronaut). Topics include logging architecture, Kubernetes deployment, and basic LogQL queries.

## Core Concepts

### What is Loki?
Loki is a horizontally scalable, highly available, multi-tenant log aggregation system inspired by Prometheus. Developed by Grafana Labs, the key difference from Elasticsearch is the **indexing strategy**: Loki indexes **only metadata (labels)**, not log content.

### Loki vs Elasticsearch
| Feature | Loki | Elasticsearch |
|---------|------|---------------|
| Indexing | Labels only | Full-text complete |
| Storage cost | Low | High |
| Compute cost | Low | High |
| Full-text search | Limited (grep) | Powerful |
| Grafana integration | Native | Via plugin |
| Complexity | Low | High |
| Ideal use | Cloud-native / K8s | Complex enterprise logs |

### PLG Stack Architecture
The **PLG** stack (Promtail + Loki + Grafana) is Kubernetes' equivalent of the ELK stack:

\`\`\`
┌─────────────────────────────────────────────────────┐
│                  Kubernetes Cluster                  │
│                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │ Pod App  │    │ Pod App  │    │ Pod App  │      │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘      │
│       │               │               │              │
│  ┌────▼───────────────▼───────────────▼─────┐      │
│  │         Promtail (DaemonSet)              │      │
│  │   Collects logs from /var/log/pods/*      │      │
│  └───────────────────┬───────────────────────┘      │
│                      │ Push (HTTP)                   │
│  ┌───────────────────▼───────────────────────┐      │
│  │              Loki (StatefulSet)            │      │
│  │   Ingest → Compress → Store               │      │
│  └───────────────────┬───────────────────────┘      │
│                      │ Query (LogQL)                 │
│  ┌───────────────────▼───────────────────────┐      │
│  │            Grafana (Deployment)            │      │
│  │   Dashboards + Alerting                   │      │
│  └───────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
\`\`\`

### Loki Components

**Distributor**: Receives log streams and distributes to ingesters. Validates labels and enforces rate limiting.

**Ingester**: Stores logs in memory (chunks) and periodically flushes to the storage backend.

**Querier**: Executes LogQL queries, consulting ingesters (recent data) and storage (historical data).

**Query Frontend**: Optimizes queries, caches results, and splits large queries into smaller parts.

**Compactor**: Compacts index files to reduce storage usage.

**Ruler**: Evaluates LogQL-based alerting rules.

### Labels: The Heart of Loki
Labels are the key to performance. Bad labels = high cost.

\`\`\`yaml
# Good labels (low cardinality)
{namespace="production", app="api", pod_template_hash="abc123"}

# Bad labels (high cardinality - AVOID)
{pod="api-7d9f8b-xk2j9"}   # changes on every restart
{ip="10.0.0.42"}            # unique per pod
{user_id="12345"}           # infinite cardinality
\`\`\`

### Promtail — The Collection Agent
Promtail is a DaemonSet that:
1. Automatically discovers pods via Kubernetes SD
2. Reads logs from \`/var/log/pods/\`
3. Enriches with Kubernetes labels (namespace, app, container)
4. Sends to Loki via HTTP push

\`\`\`yaml
# Promtail processing pipeline
scrape_configs:
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
    pipeline_stages:
      - cri: {}           # Parse CRI-O/containerd format
      - labeldrop:
          - filename      # Remove unnecessary label
\`\`\`

### Deploy Modes

**Single Binary (Monolithic)**: All components in a single process. Ideal for dev/small clusters.

**Simple Scalable**: Separates write path (distributor+ingester) and read path (querier+frontend). Recommended for production.

**Microservices**: Each component separate. For maximum scale.

## Essential Commands

### Deploy with Helm
\`\`\`bash
# Add Grafana repository
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install full stack (Loki + Promtail + Grafana)
helm install loki-stack grafana/loki-stack \\
  --namespace monitoring \\
  --create-namespace \\
  --set grafana.enabled=true \\
  --set promtail.enabled=true \\
  --set loki.persistence.enabled=true \\
  --set loki.persistence.size=10Gi

# Verify installation
kubectl get pods -n monitoring
kubectl get svc -n monitoring

# View Loki logs
kubectl logs -n monitoring -l app=loki -f

# Access Grafana (port-forward)
kubectl port-forward -n monitoring svc/loki-stack-grafana 3000:80
# Default password:
kubectl get secret -n monitoring loki-stack-grafana -o jsonpath='{.data.admin-password}' | base64 -d
\`\`\`

### Check Loki Status
\`\`\`bash
# Check ring members (hash ring)
kubectl exec -n monitoring -it loki-0 -- \\
  wget -qO- http://localhost:3100/ring

# Check Loki metrics
kubectl exec -n monitoring -it loki-0 -- \\
  wget -qO- http://localhost:3100/metrics | grep loki_ingester

# View current configuration
kubectl exec -n monitoring -it loki-0 -- \\
  wget -qO- http://localhost:3100/config

# Ready check
kubectl exec -n monitoring -it loki-0 -- \\
  wget -qO- http://localhost:3100/ready
\`\`\`

### Promtail - Verification
\`\`\`bash
# View Promtail status
kubectl exec -n monitoring -it ds/promtail -- \\
  wget -qO- http://localhost:9080/targets

# View scraping metrics
kubectl logs -n monitoring -l app=promtail --tail=50

# Verify processing pipelines
kubectl exec -n monitoring -it ds/promtail -- \\
  wget -qO- http://localhost:9080/metrics | grep promtail_targets
\`\`\`

## YAML Examples

### Loki with S3 Storage (Production)
\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
  namespace: monitoring
data:
  loki.yaml: |
    auth_enabled: false

    server:
      http_listen_port: 3100
      grpc_listen_port: 9096

    common:
      path_prefix: /tmp/loki
      storage:
        s3:
          endpoint: s3.amazonaws.com
          region: us-east-1
          bucketnames: my-loki-logs
          access_key_id: \${AWS_ACCESS_KEY_ID}
          secret_access_key: \${AWS_SECRET_ACCESS_KEY}
      replication_factor: 1

    schema_config:
      configs:
        - from: 2024-01-01
          store: tsdb
          object_store: s3
          schema: v13
          index:
            prefix: loki_index_
            period: 24h

    limits_config:
      reject_old_samples: true
      reject_old_samples_max_age: 168h
      ingestion_rate_mb: 16
      ingestion_burst_size_mb: 32
      max_streams_per_user: 10000
      max_label_names_per_series: 30

    compactor:
      working_directory: /tmp/loki/boltdb-shipper-compactor
      retention_enabled: true
      retention_delete_delay: 2h
      delete_request_store: s3

    ruler:
      storage:
        type: local
        local:
          directory: /etc/loki/rules
\`\`\`

### Promtail ConfigMap
\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: promtail-config
  namespace: monitoring
data:
  promtail.yaml: |
    server:
      http_listen_port: 9080
      grpc_listen_port: 0

    positions:
      filename: /tmp/positions.yaml

    clients:
      - url: http://loki:3100/loki/api/v1/push
        tenant_id: default
        backoff_config:
          min_period: 500ms
          max_period: 5m
          max_retries: 10

    scrape_configs:
      - job_name: kubernetes-pods
        kubernetes_sd_configs:
          - role: pod

        pipeline_stages:
          - cri: {}
          - match:
              selector: '{app="nginx"}'
              stages:
                - regex:
                    expression: '(?P<method>GET|POST|PUT|DELETE) (?P<path>[^ ]+) HTTP/[\\d.]+ (?P<status>\\d+)'
                - labels:
                    method:
                    status:
          - labeldrop:
              - filename
              - stream

        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app]
            target_label: app
          - source_labels: [__meta_kubernetes_namespace]
            target_label: namespace
          - source_labels: [__meta_kubernetes_pod_name]
            target_label: pod
          - source_labels: [__meta_kubernetes_pod_container_name]
            target_label: container
\`\`\`

### Promtail DaemonSet
\`\`\`yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: promtail
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: promtail
  template:
    metadata:
      labels:
        app: promtail
    spec:
      serviceAccountName: promtail
      tolerations:
        - key: node-role.kubernetes.io/control-plane
          operator: Exists
          effect: NoSchedule
      containers:
        - name: promtail
          image: grafana/promtail:3.0.0
          args:
            - -config.file=/etc/promtail/promtail.yaml
          env:
            - name: HOSTNAME
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
          ports:
            - containerPort: 9080
              name: http
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
            readOnlyRootFilesystem: true
            runAsGroup: 0
          volumeMounts:
            - name: config
              mountPath: /etc/promtail
            - name: run
              mountPath: /run/promtail
            - name: containers
              mountPath: /var/lib/docker/containers
              readOnly: true
            - name: pods
              mountPath: /var/log/pods
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: promtail-config
        - name: run
          hostPath:
            path: /run/promtail
        - name: containers
          hostPath:
            path: /var/lib/docker/containers
        - name: pods
          hostPath:
            path: /var/log/pods
\`\`\`

## Common Mistakes

### 1. Cardinality Explosion
**Problem**: High cardinality labels cause OOM and severe slowdowns.
**Cause**: Using pod name, IP, user_id, or request_id as labels.
**Fix**: Keep labels static — only namespace, app, environment, job.

### 2. Chunk Encoding Error
**Problem**: \`error: entry out of order\`
**Cause**: Promtail sending logs out of order (old timestamps).
**Fix**: Set \`reject_old_samples: true\` and verify NTP synchronization on nodes.

### 3. Rate Limiting
**Problem**: \`ingestion rate limit exceeded\`
**Cause**: Log bursts exceeding \`ingestion_burst_size_mb\`.
**Fix**: Increase limits or add Promtail filters to reduce volume.

### 4. Promtail not collecting logs from new pods
**Cause**: ServiceAccount without pod listing permissions.
**Fix**: Verify Promtail ClusterRole (needs \`list\`, \`watch\` on pods).

### 5. Storage full
**Cause**: Compactor not enabled or retention not configured.
**Fix**: Enable \`retention_enabled: true\` in compactor and define \`retention_period\`.

## Killer.sh Style Challenge

**Context**: The production cluster is losing logs. The SRE team reports that logs from pods in the \`payments\` namespace haven't appeared in Grafana for 2 hours.

**Tasks**:
1. Verify Promtail is running on all nodes (should be a DaemonSet)
2. Identify if Loki is receiving streams from the \`payments\` namespace
3. Check for rate limiting errors in Loki logs
4. Inspect Promtail configuration and confirm the \`payments\` namespace isn't being dropped by some rule
5. Execute a LogQL query to confirm log absence: \`{namespace="payments"}\`

**Hint**: The most common issue is a \`pipeline_stages\` with \`match\` and \`action: drop\` incorrectly set in the Promtail ConfigMap.`,

  quiz: [
    {
      question: 'What is the key architectural difference between Loki and Elasticsearch for log indexing?',
      options: [
        'Loki indexes only labels (metadata), not log content',
        'Loki uses full inverted indexes like Elasticsearch',
        'Loki stores logs in JSON format while Elasticsearch uses binary',
        'Loki has no indexing, always doing full scans'
      ],
      correct: 0,
      explanation: "Loki's core philosophy is to index ONLY labels/metadata, not log content. This drastically reduces storage and compute costs, as there's no need to tokenize and index every word in the log.",
      reference: 'Core concept: Labels in Loki — study the "Labels: The Heart of Loki" section in theory.'
    },
    {
      question: 'In the PLG stack, which component is responsible for collecting logs from Kubernetes pods?',
      options: [
        'Grafana Agent',
        'Fluentd',
        'Promtail',
        'Logstash'
      ],
      correct: 2,
      explanation: 'Promtail is the official PLG stack agent. It runs as a DaemonSet, discovers pods via Kubernetes SD, reads logs from /var/log/pods/ and sends them to Loki via HTTP push.',
      reference: 'Related topic: Promtail DaemonSet — see the YAML example in theory.'
    },
    {
      question: 'Which of the following labels has HIGH cardinality and should be AVOIDED in Loki?',
      options: [
        '{namespace="production"}',
        '{app="api-gateway"}',
        '{pod="api-7d9f8b-xk2j9"}',
        '{environment="staging"}'
      ],
      correct: 2,
      explanation: 'The pod name (pod="api-7d9f8b-xk2j9") has high cardinality because it changes on every restart/redeploy. High cardinality labels cause cardinality explosion — each unique value creates a new series in Loki\'s index, causing OOM and slowdowns.',
      reference: 'Concept: High cardinality labels — re-read the "Labels: The Heart of Loki" section.'
    },
    {
      question: 'Which Loki deployment mode is recommended for medium-scale production environments?',
      options: [
        'Single Binary (Monolithic)',
        'Simple Scalable',
        'Microservices',
        'Serverless'
      ],
      correct: 1,
      explanation: 'Simple Scalable mode separates the write path (distributor + ingester) from the read path (querier + query frontend), allowing each part to scale independently. It\'s the ideal balance between simplicity and scalability for production.',
      reference: 'Architecture: Loki deployment modes — "Deploy Modes" section in theory.'
    },
    {
      question: 'Which Loki component is responsible for evaluating LogQL-based alerting rules?',
      options: [
        'Compactor',
        'Query Frontend',
        'Ruler',
        'Distributor'
      ],
      correct: 2,
      explanation: 'The Ruler is responsible for periodically evaluating alerting and recording rules defined in LogQL, working similarly to the Prometheus Ruler. It can also send alerts to Alertmanager.',
      reference: 'Related topic: LogQL & Alerting — next topic in the Loki track.'
    },
    {
      question: 'When installing Loki with Helm, which flag enables data persistence?',
      options: [
        '--set loki.storage.enabled=true',
        '--set loki.persistence.enabled=true',
        '--set loki.pvc.create=true',
        '--set loki.stateful=true'
      ],
      correct: 1,
      explanation: 'The correct flag is --set loki.persistence.enabled=true, which instructs the Helm chart to create a PersistentVolumeClaim for the Loki StatefulSet. Without this, data stays in an emptyDir volume and is lost on restarts.',
      reference: 'Practical: Loki Helm deployment — see commands in "Essential Commands" section.'
    },
    {
      question: 'What happens when Promtail encounters a log with a timestamp older than reject_old_samples_max_age?',
      options: [
        'The log is stored with the timestamp corrected to the current time',
        'The log is sent to a separate retry queue',
        'The log is rejected with "entry out of order"',
        'The log is stored in a special "late data" partition'
      ],
      correct: 2,
      explanation: 'When reject_old_samples is enabled, Loki rejects logs with timestamps earlier than the configured reject_old_samples_max_age limit. Promtail logs the "entry out of order" error and the log is discarded. This protects index ordering.',
      reference: 'Troubleshooting: Chunk Encoding Error — "Common Mistakes" section.'
    },
    {
      question: 'Which Promtail pipeline stage correctly parses the containerd/CRI-O log format in Kubernetes?',
      options: [
        '- docker: {}',
        '- cri: {}',
        '- json: {}',
        '- kubernetes: {}'
      ],
      correct: 1,
      explanation: 'The "cri: {}" stage parses the CRI (Container Runtime Interface) format used by containerd and CRI-O, which is the standard format in modern Kubernetes clusters. The docker: {} format was used with the legacy Docker runtime.',
      reference: 'Config: Promtail pipeline_stages — see the ConfigMap example in theory.'
    }
  ],

  flashcards: [
    {
      front: 'What is the PLG stack?',
      back: 'PLG = Promtail + Loki + Grafana. The Kubernetes logging stack:\n- Promtail: DaemonSet agent that collects pod logs\n- Loki: log storage and indexing (indexes labels only)\n- Grafana: visualization and alerting via LogQL'
    },
    {
      front: 'Why avoid high cardinality labels in Loki?',
      back: "Each unique label value creates a new series in the index. Labels like pod_name, IP, user_id create millions of series, causing:\n- OOM in Loki (memory exhausted)\n- Slow queries\n- High storage cost\n\nOnly use static labels: namespace, app, environment, job"
    },
    {
      front: 'What is the difference between Loki and Elasticsearch?',
      back: 'Loki:\n- Indexes ONLY labels (metadata)\n- Low storage and CPU cost\n- Full-text search via grep (slower)\n- Native for Kubernetes\n\nElasticsearch:\n- Full-text indexing (tokenizes every word)\n- High compute cost\n- Powerful full-text search\n- More complex to operate'
    },
    {
      front: 'What does the Compactor do in Loki?',
      back: 'The Compactor:\n1. Compacts index files to reduce storage\n2. Applies retention policies (retention_period)\n3. Removes expired logs from storage\n4. Reduces number of fragmented index files\n\nMust be enabled in production: retention_enabled: true'
    },
    {
      front: 'How does Promtail automatically discover new pods?',
      back: 'Via Kubernetes Service Discovery (kubernetes_sd_configs):\n1. Watches Kubernetes API for new pods (role: pod)\n2. Uses relabel_configs to extract pod labels (app, namespace, etc.)\n3. Detects log path at /var/log/pods/<namespace>_<pod>_<uid>/<container>/\n4. Starts automatic scraping without restart\n\nRequires ServiceAccount with list/watch permissions on pods'
    },
    {
      front: 'What are the 3 Loki deployment modes and when to use each?',
      back: 'Single Binary (Monolithic):\n- All components in 1 process\n- Dev/testing, small clusters\n\nSimple Scalable:\n- Separates write path and read path\n- Medium-scale production (recommended)\n\nMicroservices:\n- Each component separate\n- High scale, maximum flexibility\n- More complex to operate'
    },
    {
      front: 'What is the Ruler in Loki?',
      back: 'The Ruler evaluates alerting and recording rules based on LogQL:\n- Executes LogQL queries periodically\n- Fires alerts to Alertmanager when conditions are met\n- Supports the same PrometheusRule format\n- Allows alerting on error counts, log patterns, etc.\n\nExample: alert when count_over_time({level="error"}[5m]) > 100'
    },
    {
      front: 'How to verify Loki is healthy after deployment?',
      back: 'Verification commands:\n\n# Ready endpoint\nwget -qO- http://loki:3100/ready\n# Returns "ready" if OK\n\n# Ring members (distribution)\nwget -qO- http://loki:3100/ring\n\n# Ingestion metrics\nwget -qO- http://loki:3100/metrics | grep loki_ingester_streams_created_total\n\n# Via kubectl\nkubectl get pods -n monitoring -l app=loki\nkubectl logs -n monitoring loki-0 --tail=50'
    }
  ],

  lab: {
    scenario: 'You need to configure a complete logging stack for a development Kubernetes cluster, using Loki + Promtail + Grafana via Helm, and verify that logs from a test application are collected and queryable.',
    objective: 'Deploy the full PLG stack, verify log collection via Promtail, and execute basic queries in Grafana.',
    duration: '25-35 minutes',
    steps: [
      {
        title: 'Deploy PLG Stack with Helm',
        instruction: `Add the Grafana Helm repository and install the complete Loki stack in the \`monitoring\` namespace. Use the \`loki-stack\` chart which includes Loki, Promtail and Grafana.

After installation, wait for all pods to be \`Running\` and get the Grafana password.`,
        hints: [
          'The monitoring namespace needs to be created — use --create-namespace',
          'Enable grafana.enabled=true and promtail.enabled=true in the helm install',
          'The Grafana password is in a Secret named loki-stack-grafana'
        ],
        solution: `\`\`\`bash
# Add repository
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install stack
helm install loki-stack grafana/loki-stack \\
  --namespace monitoring \\
  --create-namespace \\
  --set grafana.enabled=true \\
  --set promtail.enabled=true \\
  --set loki.persistence.enabled=true \\
  --set loki.persistence.size=5Gi

# Wait for pods
kubectl wait --for=condition=ready pod \\
  -l app=loki -n monitoring --timeout=120s
kubectl wait --for=condition=ready pod \\
  -l app=promtail -n monitoring --timeout=120s

# Get Grafana password
kubectl get secret -n monitoring loki-stack-grafana \\
  -o jsonpath='{.data.admin-password}' | base64 -d && echo
\`\`\``,
        verify: `\`\`\`bash
# Verify all pods running
kubectl get pods -n monitoring
# Expected output:
# loki-stack-0                    1/1     Running   0          2m
# loki-stack-grafana-xxx          1/1     Running   0          2m
# loki-stack-promtail-xxx (node1) 1/1     Running   0          2m

# Verify Loki ready endpoint
kubectl exec -n monitoring loki-stack-0 -- \\
  wget -qO- http://localhost:3100/ready
# Expected output: ready

# Verify Promtail is collecting targets
kubectl exec -n monitoring -it ds/loki-stack-promtail -- \\
  wget -qO- http://localhost:9080/metrics | \\
  grep promtail_targets_active_total
# Expected output: promtail_targets_active_total X (X > 0)
\`\`\``
      },
      {
        title: 'Deploy Test Application and Verify Log Collection',
        instruction: `Deploy a log generator pod in the \`default\` namespace and verify that Promtail is collecting its logs.

Use the \`busybox\` image with a loop that generates logs every second with ERROR and INFO levels. After 30 seconds, verify logs via the Loki API.`,
        hints: [
          'Use kubectl run with --image=busybox and command to continuously generate logs',
          'The Loki API accepts queries via HTTP: /loki/api/v1/query_range',
          'Use port-forward to access Loki locally'
        ],
        solution: `\`\`\`bash
# Create log generator pod
kubectl run log-generator \\
  --image=busybox \\
  --restart=Never \\
  -- sh -c 'i=0; while true; do
    echo "$(date) INFO request processed id=\$i status=200";
    echo "$(date) ERROR failed to connect to database retry=\$i";
    i=$((i+1));
    sleep 1;
  done'

# Wait for pod to be running
kubectl wait --for=condition=ready pod/log-generator --timeout=30s

# Port-forward to Loki
kubectl port-forward -n monitoring svc/loki-stack 3100:3100 &

# Wait 10 seconds to collect logs
sleep 10

# Query logs via API
curl -s "http://localhost:3100/loki/api/v1/query_range" \\
  --data-urlencode 'query={pod="log-generator"}' \\
  --data-urlencode "start=$(date -d '5 minutes ago' +%s)000000000" \\
  --data-urlencode "end=$(date +%s)000000000" \\
  --data-urlencode "limit=10" | jq '.data.result[0].values[:3]'
\`\`\``,
        verify: `\`\`\`bash
# Verify pod running
kubectl get pod log-generator
# Expected: log-generator   1/1   Running   0   Xs

# Check pod logs
kubectl logs log-generator --tail=5
# Expected: lines with INFO and ERROR

# Verify in Loki (with port-forward active)
curl -s "http://localhost:3100/loki/api/v1/labels" | jq '.data'
# Expected: list including "pod", "namespace", "app"

# Verify Loki has streams for the pod
curl -s "http://localhost:3100/loki/api/v1/series" \\
  --data-urlencode 'match[]={pod="log-generator"}' | jq '.data | length'
# Expected: 1 (or more if multiple containers)
\`\`\``
      },
      {
        title: 'Configure Data Source in Grafana and Explore Logs',
        instruction: `Access Grafana via port-forward and verify that Loki is already configured as a data source (the loki-stack chart configures this automatically).

Use Grafana Explore to execute a LogQL query and filter only ERROR logs from the generator pod. Also configure basic retention in Loki.`,
        hints: [
          'Grafana runs on port 80, but port-forward to 3000 is more convenient',
          'The Loki data source is already pre-configured by the Helm chart',
          'In Explore, use the label browser to build the query visually',
          'To edit Loki configuration, edit the ConfigMap and do a rollout restart'
        ],
        solution: `\`\`\`bash
# Port-forward Grafana
kubectl port-forward -n monitoring svc/loki-stack-grafana 3000:80 &

# Open in browser: http://localhost:3000
# Login: admin / (password obtained in step 1)

# Verify data source via Grafana API
curl -s -u admin:\$(kubectl get secret -n monitoring loki-stack-grafana \\
  -o jsonpath='{.data.admin-password}' | base64 -d) \\
  http://localhost:3000/api/datasources | jq '.[].name'
# Expected output: "Loki" (among data sources)

# LogQL queries to test in Explore:
# 1. All logs from generator:
#    {pod="log-generator"}
#
# 2. Errors only:
#    {pod="log-generator"} |= "ERROR"
#
# 3. Error rate per minute:
#    rate({pod="log-generator"} |= "ERROR" [1m])

# Configure retention in Loki ConfigMap
kubectl edit configmap -n monitoring loki-stack
# Add under limits_config:
#   retention_period: 7d
# Add under compactor:
#   retention_enabled: true

# Apply change
kubectl rollout restart statefulset/loki-stack -n monitoring
\`\`\``,
        verify: `\`\`\`bash
# Verify Loki data source via API
GRAFANA_PASS=\$(kubectl get secret -n monitoring loki-stack-grafana \\
  -o jsonpath='{.data.admin-password}' | base64 -d)

curl -s -u "admin:\$GRAFANA_PASS" \\
  http://localhost:3000/api/datasources | jq '.[].type'
# Expected output: "loki" (should appear in the list)

# Test Loki query via HTTP API
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query=count_over_time({pod="log-generator"}[5m])' | \\
  jq '.data.result[0].value[1]'
# Expected output: number > "0" (log count in last 5min)

# Verify rollout restart complete
kubectl rollout status statefulset/loki-stack -n monitoring
# Expected output: statefulset rolling update complete
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Promtail not collecting logs from new pods',
      difficulty: 'easy',
      symptom: 'Newly created pods don\'t appear in Grafana/Loki. Old pods continue appearing normally. The Promtail DaemonSet is Running on all nodes.',
      diagnosis: `\`\`\`bash
# Check Promtail ServiceAccount permissions
kubectl get clusterrolebinding -l app=promtail -o yaml

# Check if Promtail can list pods
kubectl auth can-i list pods \\
  --as=system:serviceaccount:monitoring:promtail-serviceaccount

# View Promtail errors
kubectl logs -n monitoring ds/loki-stack-promtail --tail=50 | grep -i error

# Verify active targets
kubectl exec -n monitoring -it ds/loki-stack-promtail -- \\
  wget -qO- http://localhost:9080/targets | grep -i "health"

# Check for drop rules in pipeline
kubectl get configmap -n monitoring loki-stack-promtail -o yaml | \\
  grep -A5 "action: drop"
\`\`\``,
      solution: `**Cause**: Promtail ServiceAccount without adequate ClusterRole or pipeline_stage with overly broad "action: drop".

**Fix 1 - RBAC Permissions**:
\`\`\`bash
# Create correct ClusterRole
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: promtail
rules:
  - apiGroups: [""]
    resources: ["nodes", "services", "pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get", "list", "watch"]
EOF

# Bind to ServiceAccount
kubectl create clusterrolebinding promtail \\
  --clusterrole=promtail \\
  --serviceaccount=monitoring:loki-stack-promtail

# Restart Promtail
kubectl rollout restart ds/loki-stack-promtail -n monitoring
\`\`\`

**Fix 2 - Incorrect drop pipeline stage**:
\`\`\`bash
# Edit ConfigMap and remove/fix drop rule
kubectl edit configmap -n monitoring loki-stack-promtail
# Remove or adjust: action: drop with too broad a selector

kubectl rollout restart ds/loki-stack-promtail -n monitoring
\`\`\``
    },
    {
      title: 'Loki OOMKilled — Cardinality Explosion',
      difficulty: 'hard',
      symptom: 'Loki pod restarts with OOMKilled. Before dying, logs show "level=warn msg=\\"runtime out of memory\\"". Metrics show loki_ingester_streams_created_total growing exponentially.',
      diagnosis: `\`\`\`bash
# Check OOM events
kubectl describe pod -n monitoring loki-stack-0 | grep -A5 "OOMKilled"

# Check number of active streams
kubectl exec -n monitoring loki-stack-0 -- \\
  wget -qO- http://localhost:3100/metrics | \\
  grep loki_ingester_streams_created_total

# Identify high cardinality labels
kubectl exec -n monitoring loki-stack-0 -- \\
  wget -qO- http://localhost:3100/metrics | \\
  grep loki_ingester_memory_streams

# Check labels being sent by Promtail
kubectl exec -n monitoring -it ds/loki-stack-promtail -- \\
  wget -qO- http://localhost:9080/metrics | \\
  grep promtail_sent_bytes_total

# Check Promtail ConfigMap for problematic labels
kubectl get configmap -n monitoring loki-stack-promtail -o yaml | \\
  grep -A3 "target_label"

# Check Loki limits configuration
kubectl get configmap -n monitoring loki-stack -o yaml | \\
  grep -A10 "limits_config"
\`\`\``,
      solution: `**Cause**: High cardinality labels (pod name, IP, request_id) are being added as Loki labels, creating thousands of unique streams per minute.

**Immediate fix — Limit cardinality in Loki**:
\`\`\`bash
# Edit Loki ConfigMap
kubectl edit configmap -n monitoring loki-stack

# Add limits under limits_config:
# limits_config:
#   max_streams_per_user: 10000
#   max_label_names_per_series: 15
#   max_label_value_length: 2048

kubectl rollout restart statefulset/loki-stack -n monitoring
\`\`\`

**Definitive fix — Remove high cardinality labels in Promtail**:
\`\`\`bash
kubectl edit configmap -n monitoring loki-stack-promtail

# In pipeline_stages, add labeldrop for problematic labels:
# pipeline_stages:
#   - labeldrop:
#       - pod          # high cardinality — use pod_template_hash or remove
#       - filename     # unnecessary in most cases
#       - stream       # unnecessary in most cases

# Keep only: namespace, app, container, environment
\`\`\`

**Temporarily increase resources**:
\`\`\`bash
# Patch resources while fixing root cause
kubectl patch statefulset loki-stack -n monitoring \\
  --type='json' \\
  -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources/limits/memory", "value": "2Gi"}]'
\`\`\``
    },
    {
      title: 'Delayed Logs — High Ingestion Latency',
      difficulty: 'medium',
      symptom: 'Logs appear in Grafana with 5-10 minute delays. The application is generating logs in real-time but Loki doesn\'t show recent data.',
      diagnosis: `\`\`\`bash
# Check ingestion latency
kubectl exec -n monitoring loki-stack-0 -- \\
  wget -qO- http://localhost:3100/metrics | \\
  grep loki_ingester_chunk_flush_duration_seconds

# Check if ingesters have delayed chunk flushes
kubectl exec -n monitoring loki-stack-0 -- \\
  wget -qO- http://localhost:3100/metrics | \\
  grep loki_ingester_chunks_flushed_total

# Check for rate limiting
kubectl logs -n monitoring loki-stack-0 --tail=100 | \\
  grep -i "rate limit\\|ingestion rate"

# Check chunk target size configuration
kubectl get configmap -n monitoring loki-stack -o yaml | \\
  grep -A5 "ingester"
\`\`\``,
      solution: `**Cause**: Chunks too large or high \`chunk_target_size\` causing Loki to wait for more data before flushing.

**Fix**:
\`\`\`bash
kubectl edit configmap -n monitoring loki-stack

# Adjust ingester settings:
# ingester:
#   chunk_idle_period: 30m    # reduce to 5m in dev
#   chunk_target_size: 1048576  # 1MB default
#   max_chunk_age: 1h           # reduce to 10m in dev
#   flush_check_period: 30s

# For development, more aggressive config:
# ingester:
#   chunk_idle_period: 5m
#   max_chunk_age: 10m
#   flush_check_period: 10s

kubectl rollout restart statefulset/loki-stack -n monitoring
\`\`\``
    }
  ]
};
