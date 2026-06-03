window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['prom-grafana/grafana-dashboards'] = {
  theory: `
# Grafana Dashboards for Kubernetes

## Relevance
Grafana is the standard tool for Prometheus metrics visualization. Creating effective dashboards is essential for cluster visibility, rapid problem identification, and communicating infrastructure state to the team.

## Core Concepts

### What is Grafana?
Grafana is an open-source observability and data visualization platform. It connects to various data sources (Prometheus, Loki, Elasticsearch, etc.) and allows creating interactive dashboards with charts, tables, and alerts.

### Grafana + Prometheus Architecture

\`\`\`
+-------------------+     +-----------+     +------------------+
| Prometheus        |     | Grafana   |     | Users            |
| (stores data)     |<--->| (queries) |<--->| (view            |
+-------------------+     | PromQL    |     | dashboards)      |
                          +-----------+     +------------------+
\`\`\`

### Dashboard Components

| Component | Description |
|-----------|-------------|
| **Dashboard** | Collection of panels organized on a page |
| **Panel** | Individual visualization (chart, gauge, table, etc.) |
| **Row** | Horizontal grouping of panels |
| **Variable** | Dynamic parameter (namespace, node, pod) for filters |
| **Annotation** | Temporal marker for events (deploys, incidents) |
| **Data Source** | Data source (Prometheus, Loki, etc.) |

### Main Panel Types

| Type | Use | Best For |
|------|-----|----------|
| **Time Series** | Line charts over time | CPU, memory, requests/s |
| **Stat** | Large single value | Total pods, uptime |
| **Gauge** | Circular meter | Usage percentage (0-100%) |
| **Bar Gauge** | Horizontal/vertical bars | Comparison between nodes/pods |
| **Table** | Data table | Pod list, active alerts |
| **Heatmap** | Heat map | Latency distribution |
| **Logs** | Log viewer | Integrated with Loki |

### Creating a Basic Dashboard

**Step 1: Add Prometheus Data Source**
\`\`\`
Grafana > Configuration > Data Sources > Add data source
- Type: Prometheus
- URL: http://prometheus:9090
- Access: Server (default)
- Save & Test
\`\`\`

**Step 2: Create Dashboard**
\`\`\`
+ > Dashboard > Add new panel
\`\`\`

**Step 3: Configure Panel**
\`\`\`yaml
# PromQL query for node CPU
Query: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100
Legend: {{ instance }}
Panel Title: "CPU Usage by Node"
Unit: Percent (0-100)
\`\`\`

### Variables (Template Variables)

Variables make dashboards dynamic and reusable:

\`\`\`
Dashboard Settings > Variables > Add variable

# Variable: namespace
Name: namespace
Type: Query
Data source: Prometheus
Query: label_values(kube_pod_info, namespace)
Refresh: On time range change

# Variable: pod
Name: pod
Type: Query
Data source: Prometheus
Query: label_values(kube_pod_info{namespace="$namespace"}, pod)
Refresh: On time range change
\`\`\`

**Using variables in queries:**
\`\`\`promql
# Filter by selected namespace
container_memory_usage_bytes{namespace="$namespace"}

# Filter by pod (dependent variable)
rate(container_cpu_usage_seconds_total{namespace="$namespace", pod="$pod"}[5m])

# Multi-value (when multiple selections allowed)
container_memory_usage_bytes{namespace=~"$namespace"}
\`\`\`

**Variable Types:**
| Type | Description |
|------|-------------|
| \`Query\` | Dynamic values from a PromQL query |
| \`Custom\` | Fixed list of values |
| \`Interval\` | Time intervals (1m, 5m, 15m, 1h) |
| \`Datasource\` | Data source selection |
| \`Text box\` | Free user input |

### Essential Kubernetes Dashboards

**1. Cluster Overview**
\`\`\`promql
# Total nodes
count(kube_node_info)

# Total running pods
count(kube_pod_status_phase{phase="Running"})

# Total cluster CPU (%)
avg(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

# Total cluster memory (%)
(1 - sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes)) * 100
\`\`\`

**2. Node Dashboard**
\`\`\`promql
# CPU per node
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval]))) * 100

# Memory per node
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Disk per node
(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100

# Network I/O
rate(node_network_receive_bytes_total{device!="lo"}[$__rate_interval])
rate(node_network_transmit_bytes_total{device!="lo"}[$__rate_interval])
\`\`\`

**3. Pod/Container Dashboard**
\`\`\`promql
# CPU per pod
sum by(pod) (rate(container_cpu_usage_seconds_total{namespace="$namespace", container!=""}[$__rate_interval]))

# Memory per pod
sum by(pod) (container_memory_working_set_bytes{namespace="$namespace", container!=""})

# Restarts
kube_pod_container_status_restarts_total{namespace="$namespace"}

# Pod status
kube_pod_status_phase{namespace="$namespace"}
\`\`\`

### $__rate_interval and $__interval

Grafana provides special variables for ranges:

| Variable | Description | When to Use |
|----------|-------------|-------------|
| \`$__rate_interval\` | Safe interval for rate() (guarantees >= 4x scrape_interval) | Always with rate()/irate() |
| \`$__interval\` | Interval based on time range and panel resolution | With _over_time functions |
| \`$__range\` | Complete selected time range | With increase() for the whole period |

\`\`\`promql
# CORRECT: use $__rate_interval with rate()
rate(http_requests_total[$__rate_interval])

# AVOID: hardcoded [5m] (doesn't adapt to zoom)
rate(http_requests_total[5m])
\`\`\`

### Importing Community Dashboards

Grafana has a library of ready-made dashboards:

\`\`\`
Grafana > + > Import > Dashboard ID

# Popular IDs:
1860  — Node Exporter Full
315   — Kubernetes Cluster Monitoring
6417  — Kubernetes Cluster (Prometheus)
13105 — kube-state-metrics
\`\`\`

### Dashboard as Code (Provisioning)

\`\`\`yaml
# /etc/grafana/provisioning/dashboards/default.yaml
apiVersion: 1
providers:
  - name: 'default'
    orgId: 1
    folder: 'Kubernetes'
    type: file
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: true
\`\`\`

Dashboards can be exported as JSON and versioned in Git.

## Common Mistakes

1. **Using hardcoded [5m] instead of $__rate_interval**: The fixed interval doesn't adapt to dashboard zoom and can cause gaps.
2. **Not using variables**: Dashboards without variables are not reusable and need duplication for each namespace/cluster.
3. **Too many panels in one dashboard**: Dashboards with 30+ panels become slow and hard to read. Split into focused dashboards.
4. **Not configuring units**: Showing raw bytes without converting to MB/GB makes data unreadable.
5. **Forgetting visual thresholds**: Panels without good/bad indicators (green/yellow/red) make interpretation difficult.
6. **Not versioning dashboards**: Manually created dashboards can be lost. Use provisioning and Git.

## Killer.sh Style Challenge

**Scenario:** Create Grafana dashboards for Kubernetes cluster monitoring.

**Tasks:**
1. Create a cluster overview dashboard with stat panels for total nodes, pods, and CPU/memory usage
2. Add variables for namespace and pod
3. Create a time series panel for CPU per node using $__rate_interval
4. Import the Node Exporter Full dashboard (ID 1860)

**Tips:**
- Use \`$__rate_interval\` in all queries with rate()
- Configure units (percent, bytes, seconds) on panels
- Add thresholds: green < 60%, yellow < 80%, red > 80%
`,
  quiz: [
    {
      question: 'What is the purpose of the $__rate_interval variable in Grafana?',
      options: [
        'Defines the dashboard refresh interval',
        'Provides a safe interval for rate() that guarantees sufficient data regardless of zoom level',
        'Defines the Prometheus scrape_interval',
        'Controls the graph resolution'
      ],
      correct: 1,
      explanation: '$__rate_interval automatically calculates a safe interval for rate() (at least 4x the scrape_interval). This ensures there are always enough data points, regardless of the dashboard zoom level.',
      reference: 'Related concept: promql-basics — rate() needs at least 2x the scrape_interval to work.'
    },
    {
      question: 'Which Grafana panel type is most suitable for showing CPU usage percentage (0-100%)?',
      options: [
        'Time Series',
        'Stat',
        'Gauge',
        'Table'
      ],
      correct: 2,
      explanation: 'The Gauge panel (circular meter) is ideal for percentages with defined limits (0-100%). It allows adding visual thresholds (green/yellow/red) and clearly shows the current level. Time Series would be better for viewing evolution over time.',
      reference: 'Related concept: grafana-dashboards — choose panel type based on what you want to communicate.'
    },
    {
      question: 'How do you use template variables to make a Grafana dashboard reusable?',
      options: [
        'Create a separate dashboard for each namespace',
        'Define variables (Query type) that populate dynamically and use $variable in PromQL queries',
        'Hardcode all values directly in queries',
        'Only use community-imported dashboards'
      ],
      correct: 1,
      explanation: 'Template variables of type Query can be populated dynamically via PromQL (e.g., label_values(kube_pod_info, namespace)). Using $namespace in queries allows the dashboard to adapt to the selected value, eliminating the need to duplicate dashboards.',
      reference: 'Related concept: promql-basics — label_values() is a special function available in Grafana for populating variables.'
    },
    {
      question: 'Which community Grafana dashboard ID is recommended for complete node monitoring with node_exporter?',
      options: [
        'ID 315',
        'ID 1860',
        'ID 6417',
        'ID 13105'
      ],
      correct: 1,
      explanation: 'Dashboard ID 1860 (Node Exporter Full) is the most popular and complete for node monitoring with node_exporter. It includes CPU, memory, disk, network, and many other panels. IDs 315 and 6417 are for cluster overview, 13105 is for kube-state-metrics.',
      reference: 'Related concept: prom-exporters — node_exporter exposes the metrics this dashboard visualizes.'
    },
    {
      question: 'Why is it important to configure units on Grafana panels?',
      options: [
        'Because Grafana does not work without units',
        'So raw values (e.g., bytes) are formatted in a readable way (e.g., GB) and are comparable',
        'To improve query performance',
        'Because it is required to export dashboards'
      ],
      correct: 1,
      explanation: 'Without configured units, a value of 1073741824 bytes is unreadable. With the "bytes" unit, Grafana formats it as "1 GB". Units also ensure axes and tooltips show precise, comparable information.',
      reference: 'Related concept: prom-exporters — naming conventions use base units (bytes, seconds).'
    },
    {
      question: 'What is Dashboard as Code (provisioning) in Grafana?',
      options: [
        'Creating dashboards using command line',
        'Defining dashboards as JSON/YAML files versioned in Git and automatically loaded by Grafana',
        'Coding dashboards in JavaScript',
        'Using the Grafana API to manually create dashboards'
      ],
      correct: 1,
      explanation: 'Dashboard as Code means defining dashboards as JSON files exported from Grafana, storing them in Git, and configuring Grafana provisioning to load them automatically. This ensures reproducibility, versioning, and consistency across environments.',
      reference: 'Related concept: prom-alerting — alerting rules can also be versioned as code.'
    },
    {
      question: 'What is the difference between $__rate_interval and $__interval in Grafana?',
      options: [
        'They are the same thing',
        '$__rate_interval is safe for rate() (>= 4x scrape), $__interval adapts to panel zoom/resolution',
        '$__interval is for rate(), $__rate_interval is for avg_over_time()',
        '$__rate_interval is fixed, $__interval is dynamic'
      ],
      correct: 1,
      explanation: '$__rate_interval guarantees a minimum safe interval for rate() (at least 4x the scrape_interval). $__interval adapts to the time range and panel resolution. For rate(), always use $__rate_interval; for _over_time functions, use $__interval.',
      reference: 'Related concept: promql-basics — the rate() range must be >= 2x the scrape_interval.'
    }
  ],
  flashcards: [
    {
      front: 'What are the most commonly used Grafana panel types?',
      back: '- **Time Series** — line charts over time (CPU, memory)\n- **Stat** — large single value (total pods, uptime)\n- **Gauge** — circular meter (percentage 0-100%)\n- **Bar Gauge** — comparative bars (between nodes/pods)\n- **Table** — data table (pod list)\n- **Heatmap** — heat map (latency distribution)\n- **Logs** — log viewer (integrated with Loki)'
    },
    {
      front: 'When to use $__rate_interval vs $__interval vs $__range?',
      back: '**$__rate_interval**: for rate()/irate()\n- Guarantees >= 4x scrape_interval\n- Adapts to zoom while maintaining safety\n\n**$__interval**: for _over_time functions\n- Based on time range and panel resolution\n- Automatically adapts to zoom\n\n**$__range**: for increase() over the entire period\n- Corresponds to the selected time range (e.g., "Last 24h")\n\nRule: use $__rate_interval with rate(), $__interval with _over_time.'
    },
    {
      front: 'How to create template variables in Grafana?',
      back: 'Dashboard Settings > Variables > Add variable\n\n**Query type:**\n```\nName: namespace\nQuery: label_values(kube_pod_info, namespace)\nRefresh: On time range change\n```\n\n**With dependency:**\n```\nName: pod\nQuery: label_values(kube_pod_info{namespace="$namespace"}, pod)\n```\n\n**In PromQL query:**\n```promql\ncontainer_memory{namespace="$namespace", pod="$pod"}\n# Multi-value:\ncontainer_memory{namespace=~"$namespace"}\n```'
    },
    {
      front: 'Which community dashboards are essential for Kubernetes?',
      back: '**Popular IDs to import:**\n- **1860** — Node Exporter Full (nodes)\n- **315** — Kubernetes Cluster Monitoring\n- **6417** — Kubernetes Cluster (Prometheus)\n- **13105** — kube-state-metrics\n- **7249** — Kubernetes Cluster (kube-prometheus-stack)\n\nTo import: Grafana > + > Import > paste the ID\n\nAdjust the data source to your cluster\'s Prometheus.'
    },
    {
      front: 'What are the essential queries for a Cluster Overview dashboard?',
      back: '**Stat panels:**\n```promql\n# Total nodes\ncount(kube_node_info)\n\n# Total pods\ncount(kube_pod_status_phase{phase="Running"})\n```\n\n**Gauges:**\n```promql\n# Cluster CPU (%)\navg(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval]))) * 100\n\n# Cluster memory (%)\n(1 - sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes)) * 100\n```'
    },
    {
      front: 'What is Dashboard as Code and how to implement it?',
      back: '**Dashboard as Code** = dashboards defined as JSON files versioned in Git.\n\n**Implementation:**\n1. Export dashboard as JSON: Dashboard > Share > Export\n2. Save in Git repository\n3. Configure provisioning:\n```yaml\n# /etc/grafana/provisioning/dashboards/\napiVersion: 1\nproviders:\n  - name: default\n    type: file\n    options:\n      path: /var/lib/grafana/dashboards\n```\n4. Mount JSONs at the configured path\n\nBenefits: reproducibility, versioning, PR review.'
    }
  ],
  lab: {
    scenario: 'You need to create Grafana dashboards to monitor a Kubernetes cluster. Grafana is connected to Prometheus and you have node_exporter and kube-state-metrics installed.',
    objective: 'Create dashboards with different panel types, configure template variables, use $__rate_interval correctly, and import community dashboards.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Configure Data Source and Verify Connectivity',
        instruction: `Verify that Grafana is connected to Prometheus.

1. Access Grafana (usually http://localhost:3000)
2. Go to Configuration > Data Sources
3. Verify a Prometheus data source exists
4. Click "Save & Test" to validate the connection

\`\`\`bash
# Check Grafana is running
kubectl get svc -n monitoring | grep grafana

# Port-forward if needed
kubectl port-forward -n monitoring svc/grafana 3000:80
\`\`\``,
        hints: ['Default Grafana credentials: admin/admin (or admin/prom-operator in kube-prometheus-stack)', 'The Prometheus URL inside the cluster is usually http://prometheus-server:9090', 'Use "Server" access mode, not "Browser"'],
        solution: `\`\`\`bash
kubectl get svc -n monitoring
kubectl port-forward -n monitoring svc/grafana 3000:80 &
curl -s http://admin:admin@localhost:3000/api/datasources | jq '.[].name'
\`\`\``,
        verify: `\`\`\`bash
curl -s http://admin:admin@localhost:3000/api/datasources | jq '.[].name'
# Expected output: list containing "Prometheus"

curl -s http://admin:admin@localhost:3000/api/datasources/1/health | jq '.status'
# Expected output: "OK"
\`\`\``
      },
      {
        title: 'Create Dashboard with Variables',
        instruction: `Create a new dashboard and configure template variables.

1. Create a new dashboard: + > Dashboard
2. Go to Dashboard Settings (gear icon) > Variables
3. Add variables:

**Variable 1: namespace**
- Name: namespace
- Type: Query
- Data source: Prometheus
- Query: label_values(kube_pod_info, namespace)
- Multi-value: Yes
- Include All: Yes

**Variable 2: pod**
- Name: pod
- Type: Query
- Data source: Prometheus
- Query: label_values(kube_pod_info{namespace=~"$namespace"}, pod)
- Multi-value: Yes
- Include All: Yes

4. Save the dashboard`,
        hints: ['For Multi-value variables, use =~ instead of = in queries', 'The "pod" variable depends on "namespace" — use $namespace in the query', 'Refresh: "On time range change" ensures updated values'],
        solution: `\`\`\`bash
curl -X POST http://admin:admin@localhost:3000/api/dashboards/db \\
  -H "Content-Type: application/json" \\
  -d '{"dashboard": {"title": "K8s Overview", "templating": {"list": [{"name": "namespace", "type": "query", "query": "label_values(kube_pod_info, namespace)", "multi": true, "includeAll": true}]}, "panels": []}}'
\`\`\``,
        verify: `\`\`\`bash
curl -s http://admin:admin@localhost:3000/api/search?query=K8s | jq '.[].title'
# Expected output: contains the created dashboard title
\`\`\``
      },
      {
        title: 'Add Monitoring Panels',
        instruction: `Add panels to the dashboard with different visualization types.

**Panel 1 — Stat: Total Pods**
- Type: Stat
- Query: count(kube_pod_status_phase{namespace=~"$namespace", phase="Running"})
- Title: "Running Pods"

**Panel 2 — Gauge: Cluster CPU**
- Type: Gauge
- Query: avg(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval]))) * 100
- Title: "Cluster CPU Usage"
- Unit: Percent (0-100)
- Thresholds: 0=green, 60=yellow, 80=red

**Panel 3 — Time Series: CPU by Node**
- Type: Time Series
- Query: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval]))) * 100
- Legend: {{ instance }}
- Title: "CPU Usage by Node"

**Panel 4 — Table: Pods with Restarts**
- Type: Table
- Query: topk(10, kube_pod_container_status_restarts_total{namespace=~"$namespace"})
- Title: "Top Pod Restarts"`,
        hints: ['Use $__rate_interval instead of hardcoded [5m] in queries with rate()', 'Configure units on panels: percent for %, bytes(IEC) for memory', 'Add thresholds for visual feedback'],
        solution: `\`\`\`promql
# Stat: pods running
count(kube_pod_status_phase{namespace=~"$namespace", phase="Running"})

# Gauge: cluster CPU
avg(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval]))) * 100

# Time Series: CPU per node
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval]))) * 100

# Table: pods with restarts
sort_desc(topk(10, kube_pod_container_status_restarts_total{namespace=~"$namespace"}))
\`\`\``,
        verify: `\`\`\`bash
curl -s 'http://localhost:9090/api/v1/query?query=count(kube_pod_status_phase{phase=%22Running%22})' | jq '.data.result[0].value[1]'
# Expected output: number of running pods
\`\`\``
      },
      {
        title: 'Import Community Dashboard',
        instruction: `Import a popular community dashboard from Grafana.

1. In Grafana, go to + > Import
2. In the "Import via grafana.com" field, type the ID: **1860**
3. Click "Load"
4. Select the Prometheus data source
5. Click "Import"

This dashboard (Node Exporter Full) provides comprehensive node visualization.

Also import:
- ID **13105** for kube-state-metrics
- ID **315** for Kubernetes Cluster Monitoring

\`\`\`bash
# Import via API
curl -X POST http://admin:admin@localhost:3000/api/dashboards/import \\
  -H "Content-Type: application/json" \\
  -d '{"dashboard": {"id": 1860}, "inputs": [{"name": "DS_PROMETHEUS", "type": "datasource", "pluginId": "prometheus", "value": "Prometheus"}]}'
\`\`\``,
        hints: ['Make sure to select the correct data source when importing', 'Imported dashboards may need variable adjustments', 'Verify the required metrics exist (node_exporter installed)'],
        solution: `\`\`\`bash
curl -X POST http://admin:admin@localhost:3000/api/dashboards/import \\
  -H "Content-Type: application/json" \\
  -d '{"dashboard": {"id": 1860}, "inputs": [{"name": "DS_PROMETHEUS", "type": "datasource", "pluginId": "prometheus", "value": "Prometheus"}], "folderId": 0, "overwrite": true}'

curl -s http://admin:admin@localhost:3000/api/search | jq '.[].title'
\`\`\``,
        verify: `\`\`\`bash
curl -s http://admin:admin@localhost:3000/api/search | jq '. | length'
# Expected output: number > 0

curl -s http://admin:admin@localhost:3000/api/search?query=Node%20Exporter | jq '.[].title'
# Expected output: "Node Exporter Full" or similar
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Panel shows "No data" even though metrics exist',
      difficulty: 'easy',
      symptom: 'A Grafana panel shows "No data" or is empty, but you know the metrics exist in Prometheus.',
      diagnosis: `\`\`\`bash
curl -s 'http://localhost:9090/api/v1/query?query=YOUR_QUERY' | jq '.data.result | length'
curl -s http://admin:admin@localhost:3000/api/datasources/1/health | jq '.status'
\`\`\``,
      solution: `**Common causes:**

1. **Wrong data source:** The panel may be using the wrong data source. Check in the panel query settings.

2. **Time range too short:** If data is sparse, "Last 15 minutes" may have no data. Increase the time range.

3. **Empty variable:** If a template variable ($namespace) is empty or has an invalid value, the query returns empty.

4. **Query error:** Check the query in Query Inspector (magnifying glass icon in the panel). Syntax errors appear there.

5. **Incompatible panel type:** A Stat panel with a query returning a range vector won't work. Check compatibility.`
    },
    {
      title: 'Dashboard slow with many panels',
      difficulty: 'medium',
      symptom: 'The dashboard takes a long time to load, panels stay in loading state for several seconds, and user experience is poor.',
      diagnosis: `\`\`\`bash
# Check query response time in Grafana Query Inspector
# Check in Prometheus
curl -s 'http://localhost:9090/api/v1/query?query=YOUR_EXPENSIVE_QUERY' -w "\\n%{time_total}s"
\`\`\``,
      solution: `**Optimization strategies:**

1. **Reduce panel count:** Split dashboards with 20+ panels into smaller, focused dashboards.

2. **Use recording rules:** Pre-compute expensive queries in Prometheus.

3. **Limit series per panel:** Use topk() or filters to limit the number of series.

4. **Adjust resolution:** Reduce the panel's "Max data points" to decrease data volume.

5. **Use Grafana caching:** Configure caching on the Prometheus data source.

6. **Lazy loading:** Recent Grafana versions support lazy loading of panels outside the viewport.`
    },
    {
      title: 'Template variables not populating correctly',
      difficulty: 'medium',
      symptom: 'Dashboard variables (namespace, pod dropdowns, etc.) are empty or showing incorrect values.',
      diagnosis: `\`\`\`bash
curl -s 'http://localhost:9090/api/v1/label/namespace/values' | jq '.data'
curl -s 'http://localhost:9090/api/v1/query?query=kube_pod_info' | jq '.data.result | length'
\`\`\``,
      solution: `**Common causes:**

1. **Metric doesn't exist:** label_values(kube_pod_info, namespace) requires kube_pod_info to exist (kube-state-metrics installed).

2. **Wrong query syntax:** Use the correct function: label_values(metric, label) to list unique values of a label.

3. **Circular dependency:** If variable A depends on B and B depends on A, both remain empty. Remove the circularity.

4. **Refresh disabled:** Set Refresh to "On time range change" or "On dashboard load" to keep values updated.

5. **Wrong data source on variable:** Each variable can have its own data source. Verify it points to the correct Prometheus.`
    }
  ]
};
