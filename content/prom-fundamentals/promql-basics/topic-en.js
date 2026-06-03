window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['prom-fundamentals/promql-basics'] = {
  theory: `
# PromQL — Fundamentals

## Relevance
PromQL (Prometheus Query Language) is the query language for Prometheus. Mastering PromQL is essential for creating dashboards, alerts, and troubleshooting in Kubernetes environments. It is a core skill for any SRE/DevOps engineer.

## Core Concepts

### What is PromQL?
PromQL is a functional query language specifically designed for time series data. It allows you to select, filter, aggregate, and transform metrics collected by Prometheus.

### Data Types in PromQL

| Type | Description | Example |
|------|-------------|---------|
| **Instant Vector** | Set of time series with a single value per series (at the current instant) | \`http_requests_total\` |
| **Range Vector** | Set of time series with values over a time range | \`http_requests_total[5m]\` |
| **Scalar** | Simple floating-point numeric value | \`42.5\` |
| **String** | Text value (rarely used) | \`"hello"\` |

### Metric Selectors

#### Simple Selector
\`\`\`promql
# Returns all series for the metric
http_requests_total
\`\`\`

#### Label Matchers
\`\`\`promql
# Exact equality
http_requests_total{method="GET"}

# Negation
http_requests_total{method!="DELETE"}

# Regex match
http_requests_total{handler=~"/api/.*"}

# Negated regex
http_requests_total{handler!~"/health|/ready"}
\`\`\`

| Operator | Meaning |
|----------|---------|
| \`=\` | Exact equality |
| \`!=\` | Not equal |
| \`=~\` | Regex match |
| \`!~\` | Negated regex |

### Range Vectors

Range vectors select values over a period of time:

\`\`\`promql
# Last 5 minutes
http_requests_total[5m]

# Last 1 hour
node_cpu_seconds_total[1h]

# Last 30 seconds
container_memory_usage_bytes[30s]
\`\`\`

**Duration suffixes:**

| Suffix | Meaning |
|--------|---------|
| \`s\` | Seconds |
| \`m\` | Minutes |
| \`h\` | Hours |
| \`d\` | Days |
| \`w\` | Weeks |
| \`y\` | Years |

### Offset Modifier

Query data from the past:
\`\`\`promql
# Request rate 1 hour ago
rate(http_requests_total[5m] offset 1h)

# Memory usage yesterday
container_memory_usage_bytes offset 1d
\`\`\`

## Essential Commands — Basic Functions

### rate() — Per-Second Rate
Calculates the average per-second rate of increase of a counter over a range:
\`\`\`promql
# Requests per second over the last 5 minutes
rate(http_requests_total[5m])

# Bytes received per second
rate(node_network_receive_bytes_total[5m])
\`\`\`

> **Rule:** Use \`rate()\` only with **counters** (metrics that only increase). Never use with gauges.

### irate() — Instantaneous Rate
Calculates the rate using only the last two data points in the range:
\`\`\`promql
# Instantaneous request rate
irate(http_requests_total[5m])
\`\`\`

> **rate vs irate:** \`rate()\` is smoother and ideal for alerts. \`irate()\` is more sensitive to spikes and better for detailed dashboards.

### increase() — Total Increase
Returns the total increase of a counter over a range:
\`\`\`promql
# Total requests in the last 30 minutes
increase(http_requests_total[30m])

# Equivalent to: rate(http_requests_total[30m]) * 1800
\`\`\`

### Arithmetic Operators

\`\`\`promql
# Memory usage percentage
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100

# Free disk space in GB
node_filesystem_avail_bytes / 1024 / 1024 / 1024
\`\`\`

| Operator | Description |
|----------|-------------|
| \`+\` | Addition |
| \`-\` | Subtraction |
| \`*\` | Multiplication |
| \`/\` | Division |
| \`%\` | Modulo |
| \`^\` | Power |

### Comparison Operators

\`\`\`promql
# Nodes with more than 80% CPU usage
100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80

# Pods using more than 1GB of memory
container_memory_usage_bytes > 1073741824
\`\`\`

| Operator | Description |
|----------|-------------|
| \`==\` | Equal |
| \`!=\` | Not equal |
| \`>\` | Greater than |
| \`<\` | Less than |
| \`>=\` | Greater or equal |
| \`<=\` | Less or equal |

## Aggregation Functions

### sum() — Sum
\`\`\`promql
# Total requests by method
sum by(method) (rate(http_requests_total[5m]))

# Total memory of all containers
sum(container_memory_usage_bytes)
\`\`\`

### avg() — Average
\`\`\`promql
# Average CPU per node
avg by(instance) (rate(node_cpu_seconds_total{mode!="idle"}[5m]))
\`\`\`

### count() — Count
\`\`\`promql
# How many targets are UP
count(up == 1)

# How many pods per namespace
count by(namespace) (kube_pod_info)
\`\`\`

### min() and max()
\`\`\`promql
# Lowest memory usage among containers
min(container_memory_usage_bytes{container!=""})

# Highest latency per service
max by(service) (http_request_duration_seconds)
\`\`\`

### topk() and bottomk()
\`\`\`promql
# Top 5 containers by memory usage
topk(5, container_memory_usage_bytes{container!=""})

# 3 slowest endpoints
topk(3, rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m]))
\`\`\`

### by and without Clauses
\`\`\`promql
# Aggregate by namespace and pod
sum by(namespace, pod) (rate(container_cpu_usage_seconds_total[5m]))

# Aggregate removing the instance label
sum without(instance) (rate(http_requests_total[5m]))
\`\`\`

> **by** keeps only the listed labels. **without** removes the listed labels and keeps the rest.

## Common Mistakes

1. **Using rate() on a gauge**: rate() only works with counters. For gauges, use \`avg_over_time()\`, \`max_over_time()\`, etc.
2. **Forgetting [range] in rate()**: \`rate(http_requests_total)\` throws an error. It needs a range vector: \`rate(http_requests_total[5m])\`.
3. **Too short range in rate()**: If scrape_interval is 15s, using \`rate(x[15s])\` may not have enough data points. Use at least 2x the scrape_interval.
4. **Not using by() in aggregation**: \`sum(rate(http_requests_total[5m]))\` aggregates everything into one number. If you want per-service, use \`sum by(service) (...)\`.
5. **Confusing rate() and increase()**: rate() returns per-second, increase() returns the total over the range.

## Killer.sh Style Challenge

**Scenario:** You have a Kubernetes cluster with Prometheus installed. You need to create PromQL queries for a monitoring dashboard.

**Tasks:**
1. Calculate the HTTP request rate per second, grouped by status code, over the last 5 minutes
2. Find the 3 namespaces with the highest memory consumption
3. Calculate the free CPU percentage on each node
4. Identify pods with memory usage above 500Mi

**Solutions:**
\`\`\`promql
# 1. Request rate by status code
sum by(status) (rate(http_requests_total[5m]))

# 2. Top 3 namespaces by memory
topk(3, sum by(namespace) (container_memory_usage_bytes{container!=""}))

# 3. Free CPU per node (percentage)
avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100

# 4. Pods with memory > 500Mi
container_memory_usage_bytes{container!=""} > 524288000
\`\`\`
`,
  quiz: [
    {
      question: 'Which PromQL function calculates the average per-second rate of a counter over a range?',
      options: ['increase()', 'rate()', 'irate()', 'avg()'],
      correct: 1,
      explanation: 'rate() calculates the average per-second rate of increase of a counter over a range vector. increase() returns the total increment, irate() calculates instantaneous rate using the last two points, and avg() is an aggregation function.',
      reference: 'Related concept: prom-architecture — understand how scrape interval affects rate calculation.'
    },
    {
      question: 'What is the difference between an Instant Vector and a Range Vector in PromQL?',
      options: [
        'Instant Vector returns strings, Range Vector returns numbers',
        'Instant Vector returns a single value per series, Range Vector returns values over a time range',
        'Instant Vector is faster than Range Vector',
        'There is no difference, they are synonyms'
      ],
      correct: 1,
      explanation: 'An Instant Vector returns a single sample per time series at the current moment. A Range Vector returns a sequence of values over a specified time range (e.g., [5m]).',
      reference: 'Related concept: promql-advanced — functions like rate() require range vectors as input.'
    },
    {
      question: 'Which label matcher operator is used for regex matching in PromQL?',
      options: ['==', '=~', '~=', 'regex()'],
      correct: 1,
      explanation: '=~ is the regex match operator in PromQL. It uses RE2 regular expressions. != is negation, !~ is negated regex.',
      reference: 'Related concept: prom-service-discovery — labels are fundamental for filtering targets.'
    },
    {
      question: 'What is the result of: sum by(namespace) (rate(container_cpu_usage_seconds_total[5m]))?',
      options: [
        'Total CPU of the entire cluster',
        'CPU per container in each namespace',
        'Per-second CPU rate, summed by namespace',
        'Average CPU per namespace'
      ],
      correct: 2,
      explanation: 'The query calculates rate() to get CPU/second for each container, then sum by(namespace) aggregates by summing all containers within each namespace. The result is the total CPU rate per namespace.',
      reference: 'Related concept: grafana-dashboards — this query is commonly used in namespace dashboards.'
    },
    {
      question: 'When should you use irate() instead of rate()?',
      options: [
        'Always, because irate() is more accurate',
        'For dashboards that need to show spikes and rapid variation',
        'For alerts that need stability',
        'When the metric is a gauge'
      ],
      correct: 1,
      explanation: 'irate() uses only the last two data points in the range, making it more sensitive to spikes. It is ideal for detailed dashboards. rate() is smoother and more stable, better for alerts. Both are exclusive to counters.',
      reference: 'Related concept: prom-alerting — rate() is preferred in alert rules for being more stable.'
    },
    {
      question: 'What happens if you use rate() on a gauge metric?',
      options: [
        'It works normally',
        'The result can be incorrect or meaningless, since rate() assumes always-increasing values',
        'Prometheus returns a syntax error',
        'The gauge is automatically converted to a counter'
      ],
      correct: 1,
      explanation: 'rate() assumes the value only increases (counter). When applied to a gauge (which can go up and down), the results are incorrect because rate() interprets drops as counter resets. Use avg_over_time(), max_over_time(), etc. for gauges.',
      reference: 'Related concept: prom-architecture — metric types (counter, gauge, histogram, summary).'
    },
    {
      question: 'What is the difference between "by" and "without" clauses in PromQL aggregations?',
      options: [
        'by is faster than without',
        'by keeps only the listed labels, without removes the listed labels',
        'by and without are synonyms',
        'without only works with sum()'
      ],
      correct: 1,
      explanation: 'by(label1, label2) keeps only the specified labels in the result. without(label1) removes the specified labels and keeps all others. Both can be used with any aggregation function.',
      reference: 'Related concept: promql-advanced — understand how labels affect vector matching.'
    },
    {
      question: 'What is the minimum recommended range for rate() if the scrape_interval is 30s?',
      options: [
        '15s — half of the scrape_interval',
        '30s — same as the scrape_interval',
        '60s — at least 2x the scrape_interval',
        '300s — always use 5 minutes'
      ],
      correct: 2,
      explanation: 'The rate() range should be at least 2x the scrape_interval to ensure there are enough data points for the calculation. With a 30s scrape_interval, use [1m] or more. Ranges that are too short may result in gaps in the graph.',
      reference: 'Related concept: prom-architecture — scrape_interval configuration in prometheus.yml.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4 data types in PromQL?',
      back: '1. **Instant Vector** — a single value per series at the current instant\n2. **Range Vector** — values over a time range [5m]\n3. **Scalar** — simple numeric value\n4. **String** — text (rarely used)'
    },
    {
      front: 'What is the difference between rate() and irate()?',
      back: '**rate()** calculates the average per-second rate using all data points in the range — smoother, ideal for alerts.\n\n**irate()** uses only the last two data points in the range — more sensitive to spikes, ideal for detailed dashboards.\n\nBoth only work with counters.'
    },
    {
      front: 'What are the 4 label matching operators in PromQL?',
      back: '- **=** exact equality\n- **!=** not equal\n- **=~** regex match (RE2)\n- **!~** negated regex\n\nExample: http_requests_total{method=~"GET|POST", handler!~"/health.*"}'
    },
    {
      front: 'What does increase() do and how does it relate to rate()?',
      back: '**increase(counter[range])** returns the total increment of the counter over the range.\n\nIt is equivalent to: rate(counter[range]) * seconds_in_range\n\nExample: increase(http_requests_total[1h]) returns the total requests in the last hour.'
    },
    {
      front: 'What is the offset modifier in PromQL for?',
      back: 'The **offset** allows querying data from the past relative to the current time.\n\nExamples:\n- rate(http_requests_total[5m] offset 1h) — rate from 1 hour ago\n- container_memory_usage_bytes offset 1d — memory from yesterday\n\nUseful for comparing current values with historical data.'
    },
    {
      front: 'What is the difference between "by" and "without" in aggregations?',
      back: '**by(labels)** — keeps ONLY the listed labels in the result\n**without(labels)** — REMOVES the listed labels and keeps all others\n\nEquivalent example:\nsum by(namespace) (metric) = sum without(pod, container, instance) (metric)\n\nUse "by" when you want few labels. Use "without" when you want to remove few labels.'
    },
    {
      front: 'What are the most common aggregation functions in PromQL?',
      back: '- **sum()** — total sum\n- **avg()** — average\n- **count()** — count of series\n- **min() / max()** — smallest / largest value\n- **topk(n, ...)** — top N series by value\n- **bottomk(n, ...)** — N smallest series\n- **stddev()** — standard deviation\n- **quantile(q, ...)** — quantile (0-1)'
    },
    {
      front: 'Why should the rate() range be >= 2x the scrape_interval?',
      back: 'rate() needs at least 2 data points to calculate the rate. If scrape_interval is 15s and you use rate(x[15s]), there might be only 1 point in the range (or none, considering delays).\n\nRule: range >= 2 * scrape_interval\n\nExample: scrape_interval=15s -> use rate(x[30s]) or more. In practice, [1m] or [5m] are the most common.'
    }
  ],
  lab: {
    scenario: 'You are responsible for monitoring a Kubernetes cluster with Prometheus. You need to write fundamental PromQL queries to understand the state of the cluster and applications.',
    objective: 'Practice basic PromQL queries: selectors, rate(), aggregations, and operators. By the end, you will have written queries ready for use in dashboards and alerts.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Explore Available Metrics',
        instruction: `Access the Prometheus web interface and explore available metrics.

1. Go to \`http://<prometheus-server>:9090\`
2. In the "Graph" tab, type simple queries to explore metrics:

\`\`\`promql
# See all series for a metric
up

# Filter by job
up{job="kubernetes-nodes"}

# See CPU metrics
node_cpu_seconds_total{mode="idle"}

# See container metrics (if kube-state-metrics is installed)
kube_pod_info
\`\`\`

3. Use autocomplete to discover available metrics
4. In "Status > Targets", check which targets are being scraped`,
        hints: [
          'The "up" metric shows 1 for healthy targets and 0 for failed targets',
          'Use Ctrl+Space to activate autocomplete in the query field',
          'kube-state-metrics exposes metrics about K8s objects (pods, deployments, etc.)'
        ],
        solution: `\`\`\`promql
# Check all targets and their status
up

# List Kubernetes targets
up{job=~"kubernetes.*"}

# See how many targets are UP
count(up == 1)

# See how many targets are DOWN
count(up == 0)
\`\`\``,
        verify: `\`\`\`bash
# Check if Prometheus is accessible
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'
# Expected output: number > 0

# Check if "up" metric returns data
curl -s 'http://localhost:9090/api/v1/query?query=up' | jq '.data.result | length'
# Expected output: number > 0

# Check node metrics
curl -s 'http://localhost:9090/api/v1/query?query=count(node_cpu_seconds_total)' | jq '.data.result[0].value[1]'
# Expected output: number > 0 (indicates node_exporter is working)
\`\`\``
      },
      {
        title: 'Calculate Rates with rate() and irate()',
        instruction: `Practice using rate() and irate() to calculate rates from counters.

\`\`\`promql
# HTTP request rate per second (last 5 min)
rate(http_requests_total[5m])

# Same metric with irate (more sensitive)
irate(http_requests_total[5m])

# CPU rate per core (using CPU counter)
rate(node_cpu_seconds_total{mode!="idle"}[5m])

# Network bytes received per second
rate(node_network_receive_bytes_total[5m])

# Total request increase in the last hour
increase(http_requests_total[1h])
\`\`\`

Compare rate() vs irate() graphs for the same metric.`,
        hints: [
          'If there are no HTTP metrics, use node metrics (node_cpu_seconds_total, node_network_receive_bytes_total)',
          'Use the "Graph" tab (not "Table") to visualize the difference between rate and irate',
          'The [5m] range is the most common in production'
        ],
        solution: `\`\`\`promql
# If you don't have HTTP metrics, use node metrics
# Total CPU in use per core
rate(node_cpu_seconds_total{mode!="idle"}[5m])

# Compare rate vs irate on the same range
rate(node_network_receive_bytes_total[5m])
irate(node_network_receive_bytes_total[5m])

# Total bytes received in the last hour
increase(node_network_receive_bytes_total[1h])
\`\`\``,
        verify: `\`\`\`bash
# Verify that rate() returns results
curl -s 'http://localhost:9090/api/v1/query?query=rate(node_cpu_seconds_total{mode="idle"}[5m])' | jq '.data.result | length'
# Expected output: number > 0 (one result per core)

# Verify that rate values are positive numbers
curl -s 'http://localhost:9090/api/v1/query?query=rate(node_cpu_seconds_total{mode="idle"}[5m])' | jq '.data.result[0].value[1]'
# Expected output: numeric value between 0 and 1 (fraction of time in idle)
\`\`\``
      },
      {
        title: 'Practice Aggregations',
        instruction: `Use aggregation functions to get consolidated views of the cluster.

\`\`\`promql
# Total CPU used per node
sum by(instance) (rate(node_cpu_seconds_total{mode!="idle"}[5m]))

# Average idle CPU per node (percentage)
avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100

# Pod count per namespace
count by(namespace) (kube_pod_info)

# Top 5 pods by memory usage
topk(5, container_memory_usage_bytes{container!=""})

# Total cluster memory
sum(node_memory_MemTotal_bytes) / 1024 / 1024 / 1024
\`\`\`

Try switching \`by\` for \`without\` to see the difference.`,
        hints: [
          'If kube-state-metrics is not installed, you won\'t have kube_pod_info metrics',
          'container!="" filters out system containers (POD sandbox containers)',
          'Use "Table" view to see exact values from topk()'
        ],
        solution: `\`\`\`promql
# CPU per node in percentage (used)
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

# Available memory per node in GB
sum by(instance) (node_memory_MemAvailable_bytes) / 1024 / 1024 / 1024

# Pods per namespace (requires kube-state-metrics)
count by(namespace) (kube_pod_info)

# Without kube-state-metrics, use container metrics
count by(namespace) (count by(namespace, pod) (container_memory_usage_bytes{container!=""}))
\`\`\``,
        verify: `\`\`\`bash
# Verify aggregation by instance works
curl -s 'http://localhost:9090/api/v1/query?query=count(sum%20by(instance)(up))' | jq '.data.result[0].value[1]'
# Expected output: number of nodes in the cluster

# Verify topk returns results
curl -s 'http://localhost:9090/api/v1/query?query=topk(3,node_memory_MemTotal_bytes)' | jq '.data.result | length'
# Expected output: 3 (or less if fewer nodes)
\`\`\``
      },
      {
        title: 'Build Composite Queries',
        instruction: `Combine operators, functions, and aggregations for more complex queries.

\`\`\`promql
# Memory usage percentage per node
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Disk usage percentage per mount point
(1 - (node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"})) * 100

# Nodes with CPU above 80%
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100 > 80

# Requests per second compared to 1 hour ago
rate(http_requests_total[5m]) / rate(http_requests_total[5m] offset 1h)
\`\`\`

Try using the \`bool\` operator to generate 0/1 instead of filtering:
\`\`\`promql
# Returns 1 if CPU > 80%, 0 otherwise
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100 > bool 80
\`\`\``,
        hints: [
          'Percentage queries use the pattern: (1 - available/total) * 100',
          'The bool operator turns comparisons into 0/1 instead of filtering series',
          'Use offset to compare current metrics with historical ones'
        ],
        solution: `\`\`\`promql
# Complete node health query
# CPU used
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

# Memory used
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Disk used (real disks only)
(1 - (node_filesystem_avail_bytes{mountpoint="/", fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{mountpoint="/", fstype!~"tmpfs|overlay"})) * 100

# Compare current rate vs 1 hour ago
sum(rate(http_requests_total[5m])) / sum(rate(http_requests_total[5m] offset 1h))
\`\`\``,
        verify: `\`\`\`bash
# Verify memory percentage query
curl -s 'http://localhost:9090/api/v1/query?query=(1-(node_memory_MemAvailable_bytes/node_memory_MemTotal_bytes))*100' | jq '.data.result[0].value[1]'
# Expected output: number between 0 and 100 (memory usage percentage)

# Verify disk query
curl -s 'http://localhost:9090/api/v1/query?query=(1-(node_filesystem_avail_bytes{mountpoint="/"}/node_filesystem_size_bytes{mountpoint="/"}))*100' | jq '.data.result[0].value[1]'
# Expected output: number between 0 and 100 (disk usage percentage)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Query returns "no data" even though metrics exist',
      difficulty: 'easy',
      symptom: 'You type a PromQL query in Prometheus but the result is empty, even though you know the metric exists.',
      diagnosis: `\`\`\`bash
# Check if the metric exists
curl -s 'http://localhost:9090/api/v1/label/__name__/values' | jq '.data[]' | grep "metric_name"

# Check available labels for the metric
curl -s 'http://localhost:9090/api/v1/series?match[]=metric_name' | jq '.data[0]'

# Check if targets are UP
curl -s 'http://localhost:9090/api/v1/targets' | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'
\`\`\``,
      solution: `**Common causes:**
1. **Typo in metric name**: Prometheus is case-sensitive. Use autocomplete.
2. **Wrong label matcher**: Check exact label values by querying without filters first.
3. **Range vector interval**: If rate(x[10s]) and scrape_interval is 30s, there aren't enough data points.
4. **Target DOWN**: The metric may exist in the catalog but the target isn't being scraped.
5. **Expired metric**: Metrics expire from TSDB after the retention period (default: 15 days).

**Step-by-step fix:**
\`\`\`promql
# 1. Query without label matchers
http_requests_total

# 2. If it returns data, add labels one by one
http_requests_total{job="myapp"}

# 3. If using rate(), increase the range
rate(http_requests_total[5m])  # instead of [30s]
\`\`\``
    },
    {
      title: 'Graphs with gaps or unrealistic spikes after pod restart',
      difficulty: 'medium',
      symptom: 'After a pod restart, the rate() graph shows a huge spike or gaps in the data. The counter went back to zero.',
      diagnosis: `\`\`\`promql
# See the raw counter value (should show reset)
http_requests_total{pod="myapp-xyz"}

# Compare rate with and without the reset interval
rate(http_requests_total{pod="myapp-xyz"}[5m])
rate(http_requests_total{pod="myapp-xyz"}[15m])
\`\`\``,
      solution: `**Explanation:** When a pod restarts, the counter resets to zero. Prometheus automatically detects counter resets in rate(), but:

1. **Gaps**: The period between the last scrape before restart and the first after can create gaps.
2. **Spikes**: If the pod changes name (new ReplicaSet), Prometheus sees it as a NEW series, not a reset.

**Solutions:**
\`\`\`promql
# Use sum to aggregate all replicas (ignores individual pods)
sum by(service) (rate(http_requests_total[5m]))

# Use a larger range to smooth out gaps
rate(http_requests_total[10m])

# Aggregate without the pod label
sum without(pod, instance) (rate(http_requests_total[5m]))
\`\`\`

**Prevention:**
- Aggregate by service/deployment, not by individual pod
- Use recording rules to pre-compute aggregations`
    },
    {
      title: 'Unexpected result when combining metrics from different sources',
      difficulty: 'hard',
      symptom: 'When dividing or multiplying metrics from different jobs, the result is empty or contains duplicate series. Example: dividing requests by capacity returns "no data".',
      diagnosis: `\`\`\`promql
# Check labels for each metric
http_requests_total{job="app"}
# Labels: {job="app", instance="10.0.1.5:8080", method="GET", ...}

container_memory_limit_bytes{container="app"}
# Labels: {job="kubelet", instance="node1", namespace="default", pod="app-xyz", ...}

# Try the division — probably returns empty
http_requests_total / container_memory_limit_bytes
\`\`\``,
      solution: `**Explanation:** PromQL performs **vector matching** based on labels. For binary operations, ALL labels must match between both sides. If the metrics come from different jobs, the labels are different and there's no match.

**Solutions:**

1. **Use on() to specify matching labels:**
\`\`\`promql
# Explicit matching by common label
rate(http_requests_total[5m]) / on(instance) group_left container_memory_limit_bytes
\`\`\`

2. **Aggregate to common labels before the operation:**
\`\`\`promql
# Aggregate both by namespace
sum by(namespace) (rate(http_requests_total[5m]))
/
sum by(namespace) (container_memory_limit_bytes{container!=""})
\`\`\`

3. **Use label_replace() to align labels:**
\`\`\`promql
# If the label has a different name but same value
label_replace(metric_a, "instance", "$1", "node", "(.*)")
\`\`\`

> This concept of vector matching is covered in depth in the promql-advanced topic.`
    }
  ]
};
