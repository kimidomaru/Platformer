window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['loki/logql-alerting'] = {
  theory: `# LogQL and Alerting with Loki

## Exam Relevance
> LogQL and log-based alerting are fundamental for SRE and observability. Covers everything from basic filter queries to sophisticated alerts with PrometheusRule via the Loki Ruler.

## Core Concepts

### What is LogQL?
LogQL is Loki's query language, inspired by Prometheus' PromQL. It has two main query types:

1. **Log Queries**: return raw log lines
2. **Metric Queries**: aggregate logs into metrics (time series)

### Log Stream Selector Anatomy
\`\`\`
{namespace="production", app="api", level="error"}
     ↑                    ↑              ↑
  Label name         Label name      Label name
     =                  =               =
  Exact match       Exact match    Exact match

# Other operators:
# !=   not equal
# =~   regex match
# !~   regex no match
\`\`\`

### Log Queries — Content Filtering

\`\`\`
{app="api"} |= "error"          # contains string
{app="api"} != "debug"          # doesn't contain string
{app="api"} |~ "error|warning"  # regex match
{app="api"} !~ "health|metrics" # regex no match

# Combining filters (implicit AND)
{namespace="prod", app="api"}
  |= "error"
  != "health"
  |~ "timeout|connection refused"
\`\`\`

### Parser Stages — Extracting Fields from Logs
\`\`\`
# JSON parser (for JSON logs)
{app="api"} | json
{app="api"} | json level, message, duration_ms

# Logfmt parser (key=value format)
{app="api"} | logfmt
{app="api"} | logfmt level, method, status

# Regex parser
{app="nginx"} | regexp \`(?P<method>\\w+) (?P<path>[^ ]+) HTTP\`

# Pattern parser (simpler than regex)
{app="api"} | pattern \`<_> level=<level> msg=<message>\`

# After parse, filter by extracted field
{app="api"} | json | level = "error"
{app="api"} | logfmt | status >= 500
{app="api"} | json | duration_ms > 1000
\`\`\`

### Line Format — Transforming Lines
\`\`\`
# Reformat log line
{app="api"} | json | line_format "{{.level}} {{.message}}"

# Add derived labels
{app="api"} | json
  | label_format level=upper(level)
  | line_format "[{{.level}}] {{.message}}"
\`\`\`

### Metric Queries — Aggregations

**rate()** — lines per second rate:
\`\`\`
rate({app="api"}[5m])
rate({app="api"} |= "error" [5m])
\`\`\`

**count_over_time()** — total count in range:
\`\`\`
count_over_time({app="api"}[1h])
count_over_time({app="api"} |= "error" [5m])
\`\`\`

**bytes_over_time()** — volume in bytes:
\`\`\`
bytes_over_time({app="api"}[1h])
\`\`\`

**bytes_rate()** — bytes per second rate:
\`\`\`
bytes_rate({app="api"}[5m])
\`\`\`

**sum() by** — group by label:
\`\`\`
sum(rate({app="api"}[5m])) by (namespace)
sum(count_over_time({job="nginx"}[1h])) by (status_code)
\`\`\`

**topk/bottomk** — top N:
\`\`\`
topk(5, sum(rate({app=~".*"}[5m])) by (app))
\`\`\`

### Unwrap — Extracting Numeric Values
Allows using field values as numeric metrics:
\`\`\`
# Average request duration
avg_over_time(
  {app="api"} | json | unwrap duration_ms [5m]
) by (endpoint)

# P99 latency
quantile_over_time(0.99,
  {app="api"} | logfmt | unwrap response_time [5m]
) by (service)

# Error ratio (%)
sum(rate({app="api"} | json | status >= 500 [5m])) by (service)
/
sum(rate({app="api"} | json [5m])) by (service)
* 100
\`\`\`

### LogQL for Alerting

#### PrometheusRule with Loki
The Loki Ruler accepts PrometheusRule in the same format as Prometheus:

\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: loki-alerts
  namespace: monitoring
  labels:
    # This label makes the Loki Ruler pick up the rule
    app: kube-prometheus-stack
spec:
  groups:
    - name: loki-error-alerts
      interval: 1m
      rules:
        # Alert when error rate exceeds threshold
        - alert: HighErrorRate
          expr: |
            sum(rate({namespace="production"} |= "error" [5m])) by (app)
            > 0.1
          for: 5m
          labels:
            severity: warning
            team: backend
          annotations:
            summary: "High error rate in {{ \$labels.app }}"
            description: "App {{ \$labels.app }} has error rate {{ \$value | humanize }}/s for 5 minutes"
            runbook_url: "https://wiki.company.com/runbooks/high-error-rate"

        # Log silence alert
        - alert: NoLogsFromPayments
          expr: |
            absent(
              rate({namespace="payments", app="payment-api"}[5m])
            )
          for: 10m
          labels:
            severity: critical
            team: payments
          annotations:
            summary: "No logs from payments service"
            description: "Payment API has not produced any logs for 10 minutes"

        # Numeric value-based alert (unwrap)
        - alert: SlowAPIResponse
          expr: |
            avg_over_time(
              {app="api"} | json | unwrap duration_ms [5m]
            ) by (endpoint) > 2000
          for: 3m
          labels:
            severity: warning
          annotations:
            summary: "Slow API response in {{ \$labels.endpoint }}"
            description: "Average response time is {{ \$value }}ms"
\`\`\`

### Recording Rules with Loki
\`\`\`yaml
spec:
  groups:
    - name: loki-recording
      interval: 5m
      rules:
        # Pre-compute error rate for dashboards
        - record: job:loki_error_rate:5m
          expr: |
            sum(rate({job=~".+"} |= "error" [5m])) by (job, namespace)
\`\`\`

### Ruler Configuration
\`\`\`yaml
# In loki.yaml:
ruler:
  storage:
    type: local
    local:
      directory: /etc/loki/rules
  rule_path: /tmp/loki/rules
  alertmanager_url: http://alertmanager:9093
  ring:
    kvstore:
      store: inmemory
  enable_api: true
  enable_alertmanager_v2: true
\`\`\`

## Essential Commands

### Queries via CLI (logcli)
\`\`\`bash
# Install logcli
go install github.com/grafana/loki/cmd/logcli@latest
# or via binary: https://github.com/grafana/loki/releases

# Configure endpoint
export LOKI_ADDR=http://localhost:3100

# Basic log query
logcli query '{namespace="production",app="api"}'

# Filter by content
logcli query '{app="api"} |= "error"' --limit=100

# Time range query
logcli query '{app="api"}' --since=1h --until=30m

# Specific output format
logcli query '{app="api"} | json' --output=raw

# Instant query (current value)
logcli instant-query 'count_over_time({app="api"}[1h])'

# Range query (time series)
logcli range-query 'rate({app="api"} |= "error" [5m])' \\
  --start=2024-01-01T00:00:00Z \\
  --end=2024-01-01T01:00:00Z \\
  --step=1m

# List available labels
logcli labels

# List values for a label
logcli labels app
\`\`\`

### Direct HTTP API
\`\`\`bash
# Log query via API
curl -s "http://localhost:3100/loki/api/v1/query_range" \\
  --data-urlencode 'query={namespace="production"} |= "error"' \\
  --data-urlencode 'start=1704067200000000000' \\
  --data-urlencode 'end=1704153600000000000' \\
  --data-urlencode 'limit=100' \\
  --data-urlencode 'direction=backward' | jq .

# Instant query
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query=rate({app="api"}[5m])' \\
  --data-urlencode 'time=1704153600' | jq .

# List labels
curl -s "http://localhost:3100/loki/api/v1/labels" | jq .

# List label values
curl -s "http://localhost:3100/loki/api/v1/label/app/values" | jq .

# List series
curl -s "http://localhost:3100/loki/api/v1/series" \\
  --data-urlencode 'match[]={namespace="production"}' | jq .

# View Ruler rules
curl -s "http://localhost:3100/loki/api/v1/rules" | jq .
\`\`\`

## YAML Examples

### Grafana Dashboard via ConfigMap (Provisioning)
\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  loki-overview.json: |
    {
      "title": "Loki — Log Overview",
      "panels": [
        {
          "title": "Error Rate by Service",
          "type": "timeseries",
          "datasource": "Loki",
          "targets": [
            {
              "expr": "sum(rate({namespace=\\"production\\"} |= \\"error\\" [5m])) by (app)",
              "legendFormat": "{{app}}"
            }
          ]
        },
        {
          "title": "Log Volume by Namespace",
          "type": "timeseries",
          "datasource": "Loki",
          "targets": [
            {
              "expr": "sum(bytes_rate({job=~\\".+\\"} [5m])) by (namespace)",
              "legendFormat": "{{namespace}}"
            }
          ]
        }
      ]
    }
\`\`\`

### Complete Production Alerts
\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: loki-production-alerts
  namespace: monitoring
  labels:
    app: kube-prometheus-stack
    role: alert-rules
spec:
  groups:
    - name: application-logs
      interval: 1m
      rules:
        - alert: CriticalErrorSpike
          expr: |
            (
              sum(rate({namespace=~"production|staging"} |= "CRITICAL" [5m])) by (namespace, app)
              /
              sum(rate({namespace=~"production|staging"} [5m])) by (namespace, app)
            ) > 0.05
          for: 2m
          labels:
            severity: critical
            page: "true"
          annotations:
            summary: "Critical error spike in {{ \$labels.app }} ({{ \$labels.namespace }})"
            description: "{{ \$value | humanizePercentage }} of logs are CRITICAL errors"

        - alert: OOMKillDetected
          expr: |
            count_over_time(
              {namespace=~"production|staging"}
              |= "OOMKilled" [5m]
            ) > 0
          for: 0m
          labels:
            severity: warning
          annotations:
            summary: "OOMKill detected in namespace {{ \$labels.namespace }}"

        - alert: DatabaseConnectionPoolExhausted
          expr: |
            count_over_time(
              {app=~".*-api"} |= "connection pool exhausted" [5m]
            ) > 5
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "DB connection pool exhausted in {{ \$labels.app }}"
            description: "Detected {{ \$value }} pool exhaustion events in 5 minutes"

        - alert: SecurityAuthFailures
          expr: |
            sum(
              count_over_time(
                {app=~".*"} |~ "authentication failed|invalid token|unauthorized" [5m]
              )
            ) by (app) > 50
          for: 2m
          labels:
            severity: warning
            team: security
          annotations:
            summary: "High auth failure rate in {{ \$labels.app }}"
            description: "{{ \$value }} auth failures in 5 minutes — possible brute force"
\`\`\`

### LogQL for Performance Analysis
\`\`\`
# Top 10 slowest endpoints (P99)
topk(10,
  quantile_over_time(0.99,
    {app="api"} | json | unwrap duration_ms [1h]
  ) by (endpoint)
)

# Requests with 5xx status by service
sum(
  count_over_time(
    {namespace="production"} | json | status >= 500 [5m]
  )
) by (app)

# Relative error ratio
(
  sum(rate({namespace="production"} |= "ERROR" [5m])) by (app)
/
  sum(rate({namespace="production"} [5m])) by (app)
) * 100

# Logs by user (after JSON parse with user_id field)
# WARNING: user_id as label = cardinality explosion!
# Use as filter, NOT as label:
{app="api"} | json | user_id = "123456"
\`\`\`

## Common Mistakes

### 1. Query without log stream selector
**Problem**: \`parse error: 1:1: parse error: unexpected identifier\`
**Cause**: Starting query with filters without a stream selector.
**Fix**: Always start with \`{label="value"}\`.

### 2. Range too small in rate()
**Problem**: Extremely volatile rate values or frequent zeros.
**Cause**: Very small range (e.g. \`[30s]\`) with few logs.
**Fix**: Use ranges of at least \`[5m]\` for stability.

### 3. Complex regex takes too long
**Problem**: Regex query takes more than 30 seconds.
**Cause**: Unanchored regex applied to millions of lines.
**Fix**: Use \`|= "string"\` as a pre-filter before \`|~\`.
\`\`\`
# Slow:
{app="api"} |~ "error.*timeout|timeout.*error"

# Fast (pre-filter with exact string first):
{app="api"} |= "timeout" |~ "error.*timeout|timeout.*error"
\`\`\`

### 4. Ruler alerts not firing
**Cause**: PrometheusRule selector label doesn't match Ruler configuration.
**Fix**: Verify \`ruler.remote_write\` or \`ruler.alertmanager_url\`.

### 5. unwrap on non-numeric field
**Problem**: \`error: unwrap stage only accepts numeric values\`
**Cause**: Extracted field contains a non-numeric string.
**Fix**: Use \`| label_format\` to transform the field before unwrap.

## Killer.sh Style Challenge

**Context**: The product team wants an SLO where 99% of API requests complete in under 2000ms. You need to create:

1. A LogQL query that calculates the P99 API latency over the last 1 hour
2. An alert that fires when P99 exceeds 2000ms for more than 5 minutes
3. A "log silence" alert that fires if the API goes 10 minutes without generating logs

Logs are at \`{namespace="production", app="payment-api"}\` in JSON format with a \`duration_ms\` field.`,

  quiz: [
    {
      question: 'What is the difference between a Log Query and a Metric Query in LogQL?',
      options: [
        'Log Query returns raw log lines; Metric Query aggregates logs into time series',
        'Log Query uses labels; Metric Query uses log content',
        'Log Query is faster; Metric Query is more accurate',
        'There is no difference — they are synonyms in LogQL'
      ],
      correct: 0,
      explanation: 'Log Queries return individual log lines (text result), while Metric Queries use functions like rate(), count_over_time(), bytes_rate() to transform logs into numeric time series — the LogQL equivalent of PromQL for metrics.',
      reference: 'Concept: LogQL query types — "What is LogQL?" section in theory.'
    },
    {
      question: 'Which LogQL query calculates the error rate per second over the last 5 minutes for app "api"?',
      options: [
        'count({app="api"} |= "error")',
        'rate({app="api"} |= "error" [5m])',
        'sum({app="api"} | json | level="error")',
        'avg_rate({app="api"} |= "error", 5m)'
      ],
      correct: 1,
      explanation: 'rate() calculates the per-second line rate within the range specified in brackets [5m]. The |= "error" filter ensures only lines containing "error" are counted. This is the most used function for error rate SLOs.',
      reference: 'Function: rate() in LogQL — "Metric Queries — Aggregations" section in theory.'
    },
    {
      question: 'For parsing logs in "level=info msg=\\"request processed\\" duration=250ms" format, which LogQL parser is best?',
      options: [
        '| json',
        '| logfmt',
        '| regexp',
        '| pattern'
      ],
      correct: 1,
      explanation: 'The "key=value" format is logfmt, widely used by Go applications (including Kubernetes itself). The "| logfmt" parser automatically extracts all key=value pairs as queryable labels.',
      reference: 'Parser stages: logfmt — "Parser Stages — Extracting Fields from Logs" section in theory.'
    },
    {
      question: 'Which is the correct operator in the log stream selector to regex match a label?',
      options: [
        '~=',
        '|~',
        '=~',
        '~~'
      ],
      correct: 2,
      explanation: '=~ is the regex match operator for labels in the stream selector. Example: {app=~"api|gateway|proxy"} selects streams where the app label value matches the regex. Meanwhile |~ is used as a filter for log LINE CONTENT after the selector.',
      reference: 'Syntax: Log Stream Selector — "Log Stream Selector Anatomy" section in theory.'
    },
    {
      question: 'How do you calculate P99 latency using LogQL with JSON logs having a "duration_ms" field?',
      options: [
        'p99({app="api"} | json duration_ms [5m])',
        'quantile_over_time(0.99, {app="api"} | json | unwrap duration_ms [5m])',
        'percentile({app="api"} | json, duration_ms, 0.99)',
        'avg({app="api"} | json | duration_ms [5m]) * 0.99'
      ],
      correct: 1,
      explanation: 'quantile_over_time(φ, ...) calculates quantiles from a series of values. The "unwrap duration_ms" extracts the numeric value from the duration_ms field of each JSON line to use as the metric value. φ=0.99 = 99th percentile.',
      reference: 'Function: quantile_over_time with unwrap — "Unwrap — Extracting Numeric Values" section in theory.'
    },
    {
      question: 'What field in PrometheusRule makes the Loki Ruler pick it up for evaluation?',
      options: [
        'annotations.loki: "true"',
        'spec.ruler: loki',
        'Labels matching the Ruler\'s ruleSelector configuration',
        'namespace: loki-rules'
      ],
      correct: 2,
      explanation: 'The Loki Ruler uses a label selector (ruleSelector) configured in loki.yaml to find PrometheusRules to evaluate. By default in stacks like kube-prometheus-stack, the label is app: kube-prometheus-stack. The rule must have matching labels.',
      reference: 'Config: Ruler — "Ruler Configuration" section and PrometheusRule examples in theory.'
    },
    {
      question: 'What is the correct way to optimize a LogQL query with heavy regex?',
      options: [
        'Add more indexing to Loki',
        'Use |= "string" as a pre-filter before |~ "regex"',
        'Increase the query time range',
        'Use a secondary index in the storage backend'
      ],
      correct: 1,
      explanation: 'Loki does a full scan of log lines that pass the stream selector. Using |= "string" before |~ "regex" drastically reduces the number of lines the expensive regex needs to test, since exact string search is much faster.',
      reference: 'Optimization: string pre-filter — "Common Mistakes" section in theory.'
    },
    {
      question: 'Which LogQL query detects the absence of logs from a service (useful for alerting on a stopped service)?',
      options: [
        'rate({app="service"}[5m]) == 0',
        'absent(rate({app="service"}[5m]))',
        'count({app="service"}) < 1',
        'missing({app="service"})'
      ],
      correct: 1,
      explanation: 'absent() returns 1 when the expression inside produces no series — meaning no logs exist. Used in PrometheusRule to alert when a service stops producing logs (can indicate crash, failed deployment, etc.).',
      reference: 'Alerting: absent() for log silence — "LogQL for Alerting" section in theory.'
    }
  ],

  flashcards: [
    {
      front: 'What are the two types of queries in LogQL?',
      back: '**Log Queries**: return raw log lines\n- Use stream selector + filters\n- Result: text lines\n- Ex: {app="api"} |= "error"\n\n**Metric Queries**: aggregate into time series\n- Use rate(), count_over_time(), bytes_rate()\n- Result: graphs/alerts\n- Ex: rate({app="api"} |= "error" [5m])'
    },
    {
      front: 'What are the label operators in the Log Stream Selector?',
      back: '= → exact match: {app="api"}\n!= → not equal: {env!="dev"}\n=~ → regex match: {app=~"api|gw"}\n!~ → regex no match: {app!~"test.*"}\n\nKey difference:\n- These operators are for LABELS in the selector\n- |= |~ != !~ are filters for log LINE CONTENT'
    },
    {
      front: 'How to use unwrap for numeric metrics in LogQL?',
      back: 'unwrap extracts a numeric field from logs for aggregations:\n\n# P99 latency\nquantile_over_time(0.99,\n  {app="api"} | json | unwrap duration_ms [5m]\n) by (endpoint)\n\n# Average by endpoint\navg_over_time(\n  {app="api"} | logfmt | unwrap response_time [5m]\n) by (endpoint)\n\nThe field MUST be numeric after parsing (json/logfmt)'
    },
    {
      front: 'How to alert on absence of logs (stopped service)?',
      back: 'Use the absent() function in PrometheusRule:\n\nalert: ServiceSilent\nexpr: |\n  absent(\n    rate({app="payment-api"}[5m])\n  )\nfor: 10m\nlabels:\n  severity: critical\nannotations:\n  summary: "No logs from payment-api for 10 minutes"\n\nabsent() returns 1 when the series doesn\'t exist (no logs)'
    },
    {
      front: 'What is the difference between |= and |~ in LogQL?',
      back: '|= "string" → exact string filter (very fast)\n- Literal match: |= "error"\n- No match: != "debug"\n\n|~ "regex" → regex filter (slower)\n- Regex match: |~ "error|warning"\n- No match: !~ "health|metrics"\n\n**Optimization**: use |= before |~ to pre-filter:\n{app="api"} |= "timeout" |~ "db.*timeout"'
    },
    {
      front: 'Which log parsers does LogQL support?',
      back: '| json → full JSON parse\n| json field1, field2 → extract specific fields\n| logfmt → key=value parse (Go format)\n| regexp "(?P<name>pattern)" → named groups\n| pattern "<_> level=<level> msg=<msg>" → simple pattern\n\nAfter parse:\n| level = "error"    → filter by field\n| status >= 500      → numeric comparison\n| line_format "{{.level}} {{.message}}" → reformat'
    },
    {
      front: 'How to calculate error ratio (%) with LogQL?',
      back: 'Error ratio = errors / total * 100:\n\n(\n  sum(rate({ns="prod"} |= "ERROR" [5m])) by (app)\n  /\n  sum(rate({ns="prod"} [5m])) by (app)\n) * 100\n\nUsed in SLO alerts:\nexpr: |\n  (\n    sum(rate({ns="prod"} |= "ERROR" [5m])) by (app)\n    /\n    sum(rate({ns="prod"} [5m])) by (app)\n  ) > 0.01  # > 1% error rate'
    },
    {
      front: 'How to use logcli to query Loki?',
      back: '# Configure endpoint\nexport LOKI_ADDR=http://localhost:3100\n\n# Basic query\nlogcli query \'{app="api"}\'\n\n# Filter and limit\nlogcli query \'{app="api"} |= "error"\' --limit=100\n\n# Time range\nlogcli query \'{app="api"}\' --since=1h --until=30m\n\n# Metric query\nlogcli instant-query \'rate({app="api"}[5m])\'\n\n# List available labels\nlogcli labels\nlogcli labels app  # values for a label'
    }
  ],

  lab: {
    scenario: 'You are an SRE for an e-commerce application and need to set up complete log observability: queries for investigation, error rate alerts, and log silence alerts for the payments API.',
    objective: 'Practice LogQL for log analysis, create PrometheusRules for alerting via the Loki Ruler, and configure basic dashboards.',
    duration: '30-40 minutes',
    steps: [
      {
        title: 'Generate Sample Logs and Practice LogQL',
        instruction: `Create two log generator pods: one simulating an API with JSON logs (with level, duration_ms, status, endpoint fields) and another simulating occasional critical errors.

Then use Loki port-forward to execute LogQL queries via curl and practice filters, parsers, and aggregations.`,
        hints: [
          'Use busybox or similar to generate logs in JSON format',
          'Generate logs with different levels: INFO, WARN, ERROR',
          'Include variable duration_ms field to practice unwrap',
          'Port-forward the Loki service on port 3100 before running queries'
        ],
        solution: `\`\`\`bash
# Pod 1: API with structured JSON logs
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: api-simulator
  labels:
    app: api
    env: production
spec:
  containers:
    - name: api
      image: busybox
      command:
        - sh
        - -c
        - |
          while true; do
            dur=\$((RANDOM % 3000 + 50))
            status=\$((RANDOM % 10 > 8 ? 500 : 200))
            level=\$([ "\$status" -ge 500 ] && echo "ERROR" || echo "INFO")
            endpoint="/api/v1/\$([ \$((RANDOM % 3)) -eq 0 ] && echo "payment" || echo "product")"
            echo '{"timestamp":"'"\$(date -Iseconds)"'","level":"'"\$level"'","message":"request processed","duration_ms":'"\$dur"',"status":'"\$status"',"endpoint":"'"\$endpoint"'"}'
            sleep 0.5
          done
EOF

# Pod 2: Occasional critical errors
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: error-simulator
  labels:
    app: payment-api
    env: production
spec:
  containers:
    - name: payment
      image: busybox
      command:
        - sh
        - -c
        - |
          while true; do
            echo '{"timestamp":"'"\$(date -Iseconds)"'","level":"ERROR","message":"database connection failed","service":"payment-api","retry":true}'
            sleep 5
            echo '{"timestamp":"'"\$(date -Iseconds)"'","level":"INFO","message":"payment processed","amount":99.90}'
            sleep 2
          done
EOF

# Wait for pods
kubectl wait --for=condition=ready pod/api-simulator pod/error-simulator --timeout=30s

# Port-forward Loki
kubectl port-forward -n monitoring svc/loki-stack 3100:3100 &
sleep 15  # wait for logs to accumulate

# Query 1: All API logs
curl -s "http://localhost:3100/loki/api/v1/query_range" \\
  --data-urlencode 'query={app="api"}' \\
  --data-urlencode "start=\$(date -d '5 minutes ago' +%s)000000000" \\
  --data-urlencode "end=\$(date +%s)000000000" \\
  --data-urlencode 'limit=5' | jq '.data.result[0].values[:3]'

# Query 2: Error count
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query=count_over_time({app="api"} |= "ERROR" [5m])' \\
  --data-urlencode "time=\$(date +%s)" | jq '.data.result'

# Query 3: JSON parse and filter status >= 500
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query=count_over_time({app="api"} | json | status >= 500 [5m])' \\
  --data-urlencode "time=\$(date +%s)" | jq '.data.result'
\`\`\``,
        verify: `\`\`\`bash
# Verify pods running
kubectl get pods api-simulator error-simulator
# Expected: both Running

# Verify logs reaching Loki
curl -s "http://localhost:3100/loki/api/v1/labels" | jq '.data'
# Expected: list including "app" label

# Verify "api" and "payment-api" have streams
curl -s "http://localhost:3100/loki/api/v1/series" \\
  --data-urlencode 'match[]={app=~"api|payment-api"}' | \\
  jq '.data | length'
# Expected: 2 or more series

# Verify recent log count
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query=count_over_time({app=~"api|payment-api"}[5m])' \\
  --data-urlencode "time=\$(date +%s)" | \\
  jq '.data.result[] | .value[1]'
# Expected: numeric values > "0"
\`\`\``
      },
      {
        title: 'Create Alerts with PrometheusRule via Loki Ruler',
        instruction: `Configure the Loki Ruler by enabling it in the ConfigMap and create PrometheusRules for:
1. High error rate (> 10% for 3 minutes)
2. P99 latency above 2000ms (using unwrap)
3. payment-api log silence (absence for 5 minutes)

Then verify the Ruler loaded the rules.`,
        hints: [
          'The Ruler needs to be enabled in loki.yaml with enable_api: true',
          'PrometheusRules need labels matching the Ruler\'s ruleSelector',
          'To verify loaded rules, use the /loki/api/v1/rules endpoint',
          'The alertmanager_url should point to your cluster\'s Alertmanager'
        ],
        solution: `\`\`\`bash
# 1. Verify Ruler is enabled
kubectl get configmap -n monitoring loki-stack -o yaml | grep -A5 ruler

# If not, edit ConfigMap
kubectl edit configmap -n monitoring loki-stack
# Add to loki.yaml:
# ruler:
#   storage:
#     type: local
#     local:
#       directory: /tmp/loki/rules
#   enable_api: true
#   alertmanager_url: http://alertmanager-operated.monitoring:9093

# Restart Loki after change
kubectl rollout restart statefulset/loki-stack -n monitoring

# 2. Create PrometheusRules
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: loki-lab-alerts
  namespace: monitoring
  labels:
    app: kube-prometheus-stack
spec:
  groups:
    - name: api-logs
      interval: 1m
      rules:
        - alert: HighAPIErrorRate
          expr: |
            (
              sum(rate({app="api"} |= "ERROR" [5m]))
              /
              sum(rate({app="api"} [5m]))
            ) > 0.1
          for: 3m
          labels:
            severity: warning
          annotations:
            summary: "High API error rate detected"
            description: "Error rate is {{ \$value | humanizePercentage }}"

        - alert: SlowAPIResponse
          expr: |
            avg_over_time(
              {app="api"} | json | unwrap duration_ms [5m]
            ) > 2000
          for: 3m
          labels:
            severity: warning
          annotations:
            summary: "Slow API responses detected"
            description: "Average response time: {{ \$value }}ms"

        - alert: PaymentAPILogSilence
          expr: |
            absent(
              rate({app="payment-api"}[5m])
            )
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Payment API is not generating logs"
            description: "No logs from payment-api for 5+ minutes"
EOF

# 3. Verify rules loaded
sleep 30  # wait for Ruler to load
curl -s "http://localhost:3100/loki/api/v1/rules" | jq 'keys'
\`\`\``,
        verify: `\`\`\`bash
# Verify PrometheusRule created
kubectl get prometheusrule -n monitoring loki-lab-alerts
# Expected: loki-lab-alerts   Xm

# Verify rules via Ruler API
curl -s "http://localhost:3100/loki/api/v1/rules" | jq '.'
# Expected: JSON with rule groups (if Ruler enabled)

# Verify active alerts (if any)
curl -s "http://localhost:3100/loki/api/v1/alerts" | jq '.data.alerts'
# Expected: array (may be empty if all healthy)

# Test error rate query manually
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query=sum(rate({app="api"} |= "ERROR" [5m]))' \\
  --data-urlencode "time=\$(date +%s)" | jq '.data.result'
# Expected: array with numeric value (current error rate)
\`\`\``
      },
      {
        title: 'Create Grafana Dashboard with Log Panels',
        instruction: `Configure a dashboard in Grafana showing:
1. A Logs panel with all error logs
2. A Time Series panel with error rate by service
3. A Stat panel with total error count over the last 30 minutes

Use Grafana port-forward and the API to create the dashboard programmatically or via UI.`,
        hints: [
          'Grafana has the Loki data source pre-configured by the Helm chart',
          'The "Logs" panel type uses LogQL queries returning log lines',
          'For Time Series with Loki, use Metric Queries (rate, count_over_time)',
          'You can import JSON dashboards via the Grafana API'
        ],
        solution: `\`\`\`bash
# Port-forward Grafana (if not already active)
kubectl port-forward -n monitoring svc/loki-stack-grafana 3000:80 &

# Get password
GRAFANA_PASS=\$(kubectl get secret -n monitoring loki-stack-grafana \\
  -o jsonpath='{.data.admin-password}' | base64 -d)

# Get Loki data source UID
LOKI_DS_UID=\$(curl -s -u "admin:\$GRAFANA_PASS" \\
  http://localhost:3000/api/datasources | \\
  jq -r '.[] | select(.type=="loki") | .uid')

echo "Loki DS UID: \$LOKI_DS_UID"

# Create dashboard via API
curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -u "admin:\$GRAFANA_PASS" \\
  http://localhost:3000/api/dashboards/db \\
  -d "{
    \"dashboard\": {
      \"title\": \"Loki Lab Dashboard\",
      \"panels\": [
        {
          \"id\": 1,
          \"title\": \"Error Logs\",
          \"type\": \"logs\",
          \"gridPos\": {\"h\": 8, \"w\": 24, \"x\": 0, \"y\": 0},
          \"datasource\": {\"type\": \"loki\", \"uid\": \"\$LOKI_DS_UID\"},
          \"targets\": [{
            \"expr\": \"{app=\\\\\"api\\\\\"} |= \\\\\"ERROR\\\\\"\",
            \"refId\": \"A\"
          }]
        },
        {
          \"id\": 2,
          \"title\": \"Error Rate by App\",
          \"type\": \"timeseries\",
          \"gridPos\": {\"h\": 8, \"w\": 12, \"x\": 0, \"y\": 8},
          \"datasource\": {\"type\": \"loki\", \"uid\": \"\$LOKI_DS_UID\"},
          \"targets\": [{
            \"expr\": \"sum(rate({app=~\\\\\".+\\\\\"} |= \\\\\"ERROR\\\\\" [5m])) by (app)\",
            \"legendFormat\": \"{{app}}\",
            \"refId\": \"A\"
          }]
        }
      ],
      \"time\": {\"from\": \"now-1h\", \"to\": \"now\"},
      \"refresh\": \"30s\"
    },
    \"overwrite\": true,
    \"folderId\": 0
  }" | jq '.url'
\`\`\``,
        verify: `\`\`\`bash
# Verify dashboard created
GRAFANA_PASS=\$(kubectl get secret -n monitoring loki-stack-grafana \\
  -o jsonpath='{.data.admin-password}' | base64 -d)

curl -s -u "admin:\$GRAFANA_PASS" \\
  http://localhost:3000/api/search?query=Loki | \\
  jq '.[].title'
# Expected: "Loki Lab Dashboard"

# Verify Loki data source is healthy
LOKI_UID=\$(curl -s -u "admin:\$GRAFANA_PASS" \\
  http://localhost:3000/api/datasources | \\
  jq -r '.[] | select(.type=="loki") | .uid')

curl -s -u "admin:\$GRAFANA_PASS" \\
  "http://localhost:3000/api/datasources/proxy/uid/\$LOKI_UID/loki/api/v1/ready"
# Expected: ready

# Confirm logs appear in direct query
curl -s "http://localhost:3100/loki/api/v1/query_range" \\
  --data-urlencode 'query={app=~"api|payment-api"} |= "ERROR"' \\
  --data-urlencode "start=\$(date -d '10 minutes ago' +%s)000000000" \\
  --data-urlencode "end=\$(date +%s)000000000" \\
  --data-urlencode 'limit=3' | jq '.data.result | length'
# Expected: 1 or more (streams with error logs)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'PrometheusRule not triggering alerts in Loki Ruler',
      difficulty: 'medium',
      symptom: 'PrometheusRules were created but /loki/api/v1/alerts returns an empty array even when conditions are met. No alerts arrive at Alertmanager.',
      diagnosis: `\`\`\`bash
# Verify Ruler is enabled
kubectl exec -n monitoring loki-stack-0 -- \\
  wget -qO- http://localhost:3100/metrics | grep loki_ruler

# Check loaded rules
curl -s "http://localhost:3100/loki/api/v1/rules" | jq 'keys'
# If returns {} empty, Ruler didn't load the rules

# Check PrometheusRule labels vs Ruler ruleSelector
kubectl get prometheusrule -n monitoring loki-lab-alerts -o yaml | \\
  grep -A5 "labels:"

# Check Ruler config in ConfigMap
kubectl get configmap -n monitoring loki-stack -o yaml | \\
  grep -A20 "ruler:"

# Check Loki logs for Ruler errors
kubectl logs -n monitoring loki-stack-0 | grep -i "ruler\\|rule\\|alert" | tail -20

# Check if Ruler can read rules
kubectl exec -n monitoring loki-stack-0 -- \\
  ls /tmp/loki/rules/ 2>/dev/null || echo "Rules directory empty or missing"
\`\`\``,
      solution: `**Cause 1**: Ruler not enabled or configured in loki.yaml.
\`\`\`bash
kubectl edit configmap -n monitoring loki-stack
# Add/fix:
# ruler:
#   storage:
#     type: local
#     local:
#       directory: /tmp/loki/rules
#   rule_path: /tmp/loki/rules
#   enable_api: true
#   alertmanager_url: http://alertmanager-operated.monitoring:9093

kubectl rollout restart statefulset/loki-stack -n monitoring
\`\`\`

**Cause 2**: PrometheusRule labels don't match ruleSelector.
\`\`\`bash
# Check which label the Ruler expects
kubectl get configmap -n monitoring loki-stack -o yaml | \\
  grep -A5 "rule_selector\\|ruleSelector"

# Add correct label to PrometheusRule
kubectl patch prometheusrule loki-lab-alerts -n monitoring \\
  --type='merge' \\
  -p '{"metadata":{"labels":{"app":"kube-prometheus-stack"}}}'
\`\`\`

**Cause 3**: Rule LogQL expression returns no data.
\`\`\`bash
# Test the expression directly
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query=YOUR_ALERT_EXPR' \\
  --data-urlencode "time=\$(date +%s)" | jq '.'
# If result is [], the query returns no data — review selector and filters
\`\`\``
    },
    {
      title: 'LogQL returns "parse error" or unexpected results',
      difficulty: 'easy',
      symptom: 'LogQL queries return "parse error: unexpected identifier" or return empty data even though logs are visible in Grafana Explore.',
      diagnosis: `\`\`\`bash
# Test simple query to isolate problem
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query={app="api"}' \\
  --data-urlencode "time=\$(date +%s)" | jq '.status'
# If "error", problem in selector

# Check available labels
curl -s "http://localhost:3100/loki/api/v1/labels" | jq '.data'

# Check label values
curl -s "http://localhost:3100/loki/api/v1/label/app/values" | jq '.data'

# Test query time range (may be outside data range)
curl -s "http://localhost:3100/loki/api/v1/query_range" \\
  --data-urlencode 'query={app="api"}' \\
  --data-urlencode "start=\$(date -d '30 minutes ago' +%s)000000000" \\
  --data-urlencode "end=\$(date +%s)000000000" \\
  --data-urlencode 'limit=5' | jq '.data.result | length'

# Check log format (JSON, logfmt, plain text)
curl -s "http://localhost:3100/loki/api/v1/query_range" \\
  --data-urlencode 'query={app="api"}' \\
  --data-urlencode "start=\$(date -d '5 minutes ago' +%s)000000000" \\
  --data-urlencode "end=\$(date +%s)000000000" \\
  --data-urlencode 'limit=1' | jq '.data.result[0].values[0][1]'
\`\`\``,
      solution: `**Cause 1**: Query without log stream selector (mandatory).
\`\`\`
# Wrong:
|= "error" | json

# Correct:
{app="api"} |= "error" | json
\`\`\`

**Cause 2**: Label doesn't exist or has different value than expected.
\`\`\`bash
# See actual label values
curl -s "http://localhost:3100/loki/api/v1/label/app/values" | jq '.data'
# Use the exact returned value in your query
\`\`\`

**Cause 3**: Time range doesn't cover when logs were generated.
\`\`\`bash
# Increase range or use --since with logcli
logcli query '{app="api"}' --since=1h
\`\`\`

**Cause 4**: | json parser fails because log is not valid JSON.
\`\`\`bash
# View raw log line to check format
{app="api"} | line_format "{{.Message}}"
# If you see plain text, don't use | json — use | pattern or | regexp
\`\`\``
    }
  ]
};
