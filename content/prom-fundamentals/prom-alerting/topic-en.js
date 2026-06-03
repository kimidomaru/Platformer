window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['prom-fundamentals/prom-alerting'] = {
  theory: `
# Alerting with Prometheus and Alertmanager

## Relevance
Alerting is the most critical Prometheus function in production. Without properly configured alerts, problems go unnoticed until they cause severe incidents. Understanding alerting rules, Alertmanager, and SLO/SLI best practices is essential for any SRE/DevOps engineer.

## Core Concepts

### Alerting Flow

\`\`\`
Prometheus           Alertmanager              Receivers
+---------------+    +------------------+    +------------+
| Alerting Rules |--->| Routing          |--->| Slack      |
| (evaluates    )|    | Grouping         |    | PagerDuty  |
| PromQL expr   )|    | Inhibition       |    | Email      |
| for: duration  |    | Silencing        |    | Webhook    |
+---------------+    +------------------+    +------------+
\`\`\`

1. **Prometheus** evaluates alerting rules periodically
2. When the condition is true for the \`for\` duration, the alert becomes **firing**
3. The alert is sent to **Alertmanager**
4. Alertmanager applies **routing**, **grouping**, **inhibition**, and **silences**
5. Notification is sent to the configured **receiver**

### Alert States

| State | Description |
|-------|-------------|
| **inactive** | The condition is not true |
| **pending** | The condition is true, but \`for\` hasn't completed yet |
| **firing** | The condition has been true for at least the \`for\` duration |

### Alerting Rules

\`\`\`yaml
# /etc/prometheus/rules/alerting_rules.yml
groups:
  - name: node_alerts
    rules:
      - alert: HighCPUUsage
        expr: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100 > 80
        for: 5m
        labels:
          severity: warning
          team: infra
        annotations:
          summary: "High CPU on node {{ \$labels.instance }}"
          description: "Node {{ \$labels.instance }} has {{ \$value | printf \\"%.1f\\" }}% CPU usage for over 5 minutes."
          runbook_url: "https://wiki.internal/runbooks/high-cpu"

      - alert: NodeDown
        expr: up{job="node-exporter"} == 0
        for: 2m
        labels:
          severity: critical
          team: infra
        annotations:
          summary: "Node {{ \$labels.instance }} is DOWN"
          description: "node_exporter on {{ \$labels.instance }} has been unreachable for 2 minutes."
\`\`\`

### Alerting Rule Components

| Field | Required | Description |
|-------|:--------:|-------------|
| \`alert\` | Yes | Alert name |
| \`expr\` | Yes | PromQL expression defining the condition |
| \`for\` | No | How long the condition must be true before firing |
| \`labels\` | No | Additional labels (severity, team, etc.) |
| \`annotations\` | No | Descriptive information (summary, description, runbook) |

### Alerting Rules Best Practices

**Severity:**
\`\`\`yaml
labels:
  severity: critical   # Requires immediate action (pager)
  severity: warning    # Requires attention during business hours
  severity: info       # Informational, no action required
\`\`\`

**The for clause:**
- Prevents false positives from momentary spikes
- **critical**: 2-5 minutes (urgent action, but avoid flapping)
- **warning**: 5-15 minutes (more tolerant)
- **Never use for: 0** in production (generates too much noise)

**Useful annotations:**
- \`summary\`: short description (1 line)
- \`description\`: details with {{ \$labels.xxx }} and {{ \$value }}
- \`runbook_url\`: link to resolution procedure

## Alertmanager — Configuration

### Basic Structure

\`\`\`yaml
# alertmanager.yml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'alertmanager@example.com'

route:
  receiver: 'default-slack'
  group_by: ['alertname', 'namespace']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      repeat_interval: 1h
    - match:
        severity: warning
      receiver: 'slack-warnings'
      repeat_interval: 8h

receivers:
  - name: 'default-slack'
    slack_configs:
      - channel: '#alerts'
        send_resolved: true
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: 'PAGERDUTY_KEY'
        severity: '{{ .GroupLabels.severity }}'

  - name: 'slack-warnings'
    slack_configs:
      - channel: '#warnings'
        send_resolved: true

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
\`\`\`

### Alertmanager Concepts

**Grouping:** Groups similar alerts into a single notification.
\`\`\`yaml
group_by: ['alertname', 'namespace']
# Groups all alerts with the same name and namespace
\`\`\`

**Inhibition:** Suppresses alerts when another more severe alert is active.
\`\`\`yaml
# If a CRITICAL alert is active, suppress the corresponding WARNING
inhibit_rules:
  - source_match: { severity: 'critical' }
    target_match: { severity: 'warning' }
    equal: ['alertname', 'instance']
\`\`\`

**Silences:** Temporarily silence alerts (via Alertmanager UI).
- Useful during planned maintenance
- Define matchers for which alerts to silence
- Have a defined duration (expire automatically)

**Timings:**
| Parameter | Description | Recommended |
|-----------|-------------|-------------|
| \`group_wait\` | Time to wait for new alerts before sending | 30s - 1m |
| \`group_interval\` | Time between notifications for the same group | 5m |
| \`repeat_interval\` | Time before resending the same alert | 4h (warning), 1h (critical) |

## Essential Kubernetes Alerts

### Infrastructure
\`\`\`yaml
# Node unresponsive
- alert: NodeUnreachable
  expr: up{job="node-exporter"} == 0
  for: 3m
  labels:
    severity: critical

# Disk will fill in 24h
- alert: DiskWillFillIn24h
  expr: predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[6h], 86400) < 0
  for: 10m
  labels:
    severity: warning

# High memory
- alert: HighMemoryUsage
  expr: (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100 > 90
  for: 5m
  labels:
    severity: warning
\`\`\`

### Applications
\`\`\`yaml
# High error rate (> 5% of requests)
- alert: HighErrorRate
  expr: |
    sum by(service) (rate(http_requests_total{status=~"5.."}[5m]))
    /
    sum by(service) (rate(http_requests_total[5m]))
    > 0.05
  for: 5m
  labels:
    severity: critical

# High P99 latency
- alert: HighLatencyP99
  expr: |
    histogram_quantile(0.99,
      sum by(service, le) (rate(http_request_duration_seconds_bucket[5m]))
    ) > 1
  for: 5m
  labels:
    severity: warning

# Pod in CrashLoopBackOff
- alert: PodCrashLooping
  expr: rate(kube_pod_container_status_restarts_total[15m]) * 60 * 15 > 0
  for: 5m
  labels:
    severity: warning
\`\`\`

### SLO/SLI Alerts (Burn Rate)
\`\`\`yaml
# SLO: 99.9% availability
# Burn rate: at this pace, the budget runs out in X time

# Fast burn rate (budget runs out in 2 hours)
- alert: SLOBurnRateCritical
  expr: |
    (
      sum(rate(http_requests_total{status=~"5.."}[5m]))
      /
      sum(rate(http_requests_total[5m]))
    ) > (14.4 * 0.001)
  for: 2m
  labels:
    severity: critical
    slo: availability

# Slow burn rate (budget runs out in 3 days)
- alert: SLOBurnRateWarning
  expr: |
    (
      sum(rate(http_requests_total{status=~"5.."}[1h]))
      /
      sum(rate(http_requests_total[1h]))
    ) > (1 * 0.001)
  for: 1h
  labels:
    severity: warning
    slo: availability
\`\`\`

## Common Mistakes

1. **Alert without \`for\`**: Causes flapping (alert fires and resolves rapidly in a loop). Always use \`for\` of at least 1-2 minutes.
2. **Single severity**: Using only "critical" for everything causes alert fatigue. Differentiate critical/warning/info.
3. **Alerts without runbook_url**: When the alert fires, the oncall doesn't know what to do. Always include a link to the resolution procedure.
4. **group_wait too short**: Causes many fragmented notifications. Use at least 30s.
5. **Not using inhibition**: Receiving warning AND critical for the same problem creates noise. Configure inhibit_rules.
6. **Alerting on causes, not symptoms**: Alert on "error rate > 5%" (symptom), not "CPU > 80%" (cause). Symptoms are more actionable.

## Killer.sh Style Challenge

**Scenario:** Configure alerting for a production cluster with Prometheus and Alertmanager.

**Tasks:**
1. Create an alerting rule for when disk is > 85% full for more than 10 minutes
2. Configure Alertmanager to send critical alerts to PagerDuty and warnings to Slack
3. Create an inhibition rule that suppresses warnings when the corresponding critical is active
4. Write an SLO-based alert that detects when the error rate exceeds 14.4x the burn rate

**Solutions:**
\`\`\`yaml
# 1. Disk alert
- alert: DiskSpaceCritical
  expr: (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 > 85
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Disk above 85% on {{ \$labels.instance }}"

# 2. Alertmanager routing
route:
  receiver: default
  routes:
    - match: { severity: critical }
      receiver: pagerduty
    - match: { severity: warning }
      receiver: slack

# 3. Inhibition rule
inhibit_rules:
  - source_match: { severity: critical }
    target_match: { severity: warning }
    equal: [alertname, instance]

# 4. SLO burn rate
- alert: HighBurnRate
  expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.0144
  for: 2m
  labels:
    severity: critical
\`\`\`
`,
  quiz: [
    {
      question: 'What is the purpose of the "for" clause in a Prometheus alerting rule?',
      options: [
        'Defines the evaluation interval of the rule',
        'Defines how long the condition must be true before the alert transitions to firing',
        'Defines how long the alert stays active',
        'Defines the alert timeout'
      ],
      correct: 1,
      explanation: 'The "for" clause defines the minimum duration the expr condition must be continuously true before the alert transitions from "pending" to "firing". This prevents false positives from momentary spikes.',
      reference: 'Related concept: promql-basics — understand rate() and avg() functions used in alert expressions.'
    },
    {
      question: 'What are the three possible states of a Prometheus alert?',
      options: [
        'active, paused, resolved',
        'inactive, pending, firing',
        'open, acknowledged, closed',
        'new, processing, sent'
      ],
      correct: 1,
      explanation: 'The three states are: inactive (condition is false), pending (condition is true but "for" hasn\'t completed), and firing (condition has been true for the time defined in "for"). The alert is only sent to Alertmanager when in the firing state.',
      reference: 'Related concept: prom-architecture — Prometheus evaluates rules at its evaluation_interval.'
    },
    {
      question: 'What does the "inhibition" feature do in Alertmanager?',
      options: [
        'Groups similar alerts into one notification',
        'Temporarily silences alerts',
        'Suppresses less severe alerts when a more severe corresponding alert is active',
        'Prevents alerts from being sent outside business hours'
      ],
      correct: 2,
      explanation: 'Inhibition automatically suppresses alerts matching target_match when an alert matching source_match is active, and the labels specified in "equal" match. Example: suppress warning when critical is active for the same alertname.',
      reference: 'Related concept: prom-alerting — configure inhibition alongside routing to reduce noise.'
    },
    {
      question: 'What is the recommended practice for defining alert severity?',
      options: [
        'Use only "critical" for all alerts',
        'Differentiate between critical (immediate action/pager), warning (business hours), and info (informational)',
        'Use numbers from 1 to 10 for severity',
        'Let Alertmanager automatically decide severity'
      ],
      correct: 1,
      explanation: 'The recommended practice is to use 3 levels: critical (requires immediate action, triggers pager), warning (requires attention during business hours), and info (informational only). Using only critical causes alert fatigue and makes on-call unsustainable.',
      reference: 'Related concept: sre-practices — alerting is a fundamental part of SRE practices (SLO/SLI/error budget).'
    },
    {
      question: 'What is the purpose of the group_by parameter in Alertmanager routing?',
      options: [
        'To filter alerts by group',
        'To group similar alerts into a single notification, reducing noise',
        'To define the sending order of alerts',
        'To create receiver groups'
      ],
      correct: 1,
      explanation: 'group_by groups alerts sharing the same specified labels into a single notification. For example, group_by: [alertname, namespace] groups all alerts with the same name and namespace, avoiding sending dozens of separate notifications.',
      reference: 'Related concept: prom-alerting — combine grouping with timings (group_wait, group_interval) for fine control.'
    },
    {
      question: 'What is a "burn rate" alert in the context of SLOs?',
      options: [
        'An alert that measures server temperature',
        'An alert that detects when the error budget is being consumed faster than acceptable',
        'An alert that measures CPU consumption',
        'An alert that fires when the system is overloaded'
      ],
      correct: 1,
      explanation: 'Burn rate measures the speed at which an SLO\'s error budget is being consumed. A burn rate of 1x means the budget will be consumed exactly within the SLO period. 14.4x means it will be consumed in ~2 hours (if the SLO is monthly). Burn rate alerts are more effective than simple threshold alerts.',
      reference: 'Related concept: sre-practices — SLO, SLI, and error budget are central SRE concepts.'
    },
    {
      question: 'Why is it important to include annotations.runbook_url in alerting rules?',
      options: [
        'It is required by Prometheus',
        'So the oncall knows exactly what to do when the alert fires, reducing MTTR',
        'To generate automatic documentation',
        'For Alertmanager to decide routing'
      ],
      correct: 1,
      explanation: 'runbook_url provides a link to a resolution procedure. When the alert fires at 3 AM, the on-call can follow a clear step-by-step guide instead of diagnosing from scratch. This significantly reduces MTTR (Mean Time To Recover).',
      reference: 'Related concept: sre-practices — runbooks are part of SRE culture for reliable operations.'
    },
    {
      question: 'What is the difference between group_wait, group_interval, and repeat_interval in Alertmanager?',
      options: [
        'They are all synonyms for the same parameter',
        'group_wait: wait before first send; group_interval: between group updates; repeat_interval: before resending the same alert',
        'group_wait: evaluation interval; group_interval: timeout; repeat_interval: retries',
        'They all control the silence time between alerts'
      ],
      correct: 1,
      explanation: 'group_wait (30s-1m): how long to wait for new alerts before sending the first group notification. group_interval (5m): time between notifications when new alerts are added to the group. repeat_interval (1-8h): how long before resending an alert that is still firing.',
      reference: 'Related concept: prom-alerting — tuning timings is essential to avoid alert fatigue.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 3 states of a Prometheus alert?',
      back: '1. **inactive** — the PromQL condition is false\n2. **pending** — the condition is true, but the "for" time hasn\'t passed\n3. **firing** — the condition has been true for the time defined in "for"\n\nThe alert is only sent to Alertmanager when in the **firing** state.'
    },
    {
      front: 'What does each Alertmanager timing do?',
      back: '- **group_wait** (30s): time to collect initial alerts before sending the first notification\n- **group_interval** (5m): time between sends when new alerts join the group\n- **repeat_interval** (4h): time before resending an alert that continues firing\n\nAdjust these values to balance response speed vs. alert fatigue.'
    },
    {
      front: 'What is inhibition in Alertmanager?',
      back: 'Inhibition automatically suppresses less severe alerts when a more severe corresponding alert is active.\n\nExample:\n```yaml\ninhibit_rules:\n  - source_match: { severity: critical }\n    target_match: { severity: warning }\n    equal: [alertname, instance]\n```\n\nIf "NodeDown" critical is active for instance X, "HighCPU" warning for the same instance will be suppressed.'
    },
    {
      front: 'What are the 3 recommended severity levels for alerts?',
      back: '- **critical**: Requires immediate action. Triggers pager/phone. Use "for: 2-5m".\n- **warning**: Requires attention during business hours. Sends to Slack/email. Use "for: 5-15m".\n- **info**: Informational only, no action required. Can be viewed on dashboard.\n\nRule: if the on-call doesn\'t need to wake up, it\'s NOT critical.'
    },
    {
      front: 'What is burn rate and how to calculate it for SLOs?',
      back: 'Burn rate measures how fast an SLO\'s error budget is being consumed.\n\n- **Burn rate 1x**: budget consumed exactly in the period (30 days)\n- **Burn rate 14.4x**: budget consumed in ~2 hours\n- **Burn rate 6x**: budget consumed in ~5 days\n\nFormula: error_rate / error_budget\nExample (SLO 99.9%): burn_rate = error_rate / 0.001\n\nAlert: burn_rate > 14.4 (critical), > 6 (warning), > 1 (info)'
    },
    {
      front: 'What annotations are essential in alerting rules?',
      back: '1. **summary**: Short description (1 line) of the problem\n2. **description**: Details with template variables:\n   - {{ $labels.instance }} — label value\n   - {{ $value }} — current expression value\n   - {{ $value | printf "%.1f" }} — formatted\n3. **runbook_url**: Link to resolution procedure\n\nAnnotations are displayed in notifications and help on-call respond quickly.'
    },
    {
      front: 'What are the essential alerts for a Kubernetes cluster?',
      back: '**Infrastructure:**\n- NodeDown (up == 0)\n- HighCPU (> 80% for 5min)\n- HighMemory (> 90% for 5min)\n- DiskWillFill (predict_linear < 0 in 24h)\n\n**Application:**\n- HighErrorRate (5xx > 5%)\n- HighLatency (P99 > threshold)\n- PodCrashLooping (restarts > 0)\n\n**SLO:**\n- BurnRate critical (14.4x)\n- BurnRate warning (6x)'
    },
    {
      front: 'What is group_by in Alertmanager routing?',
      back: '**group_by** groups alerts sharing labels into a single notification.\n\n```yaml\nroute:\n  group_by: [alertname, namespace]\n```\n\nWithout grouping: 50 failing pods = 50 separate notifications.\nWith grouping: 50 failing pods = 1 grouped notification.\n\nCommon labels for grouping:\n- alertname: group by alert type\n- namespace: group by K8s namespace\n- cluster: group by cluster'
    }
  ],
  lab: {
    scenario: 'You need to configure alerting for a production Kubernetes cluster using Prometheus and Alertmanager. The cluster runs HTTP applications and needs infrastructure, application, and SLO alerts.',
    objective: 'Configure alerting rules in Prometheus, Alertmanager with routing and inhibition, and implement SLO burn rate alerts. By the end, you will have a complete alerting system.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create Infrastructure Alerting Rules',
        instruction: `Create an alerting rules file to monitor cluster infrastructure.

\`\`\`yaml
# /etc/prometheus/rules/infra_alerts.yml
groups:
  - name: infrastructure
    rules:
      - alert: NodeDown
        expr: up{job="node-exporter"} == 0
        for: 3m
        labels:
          severity: critical
          team: infra
        annotations:
          summary: "Node {{ \$labels.instance }} is DOWN"
          description: "node_exporter on {{ \$labels.instance }} has been unreachable for 3 minutes."
          runbook_url: "https://wiki/runbooks/node-down"

      - alert: HighCPUUsage
        expr: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100 > 80
        for: 5m
        labels:
          severity: warning
          team: infra
        annotations:
          summary: "High CPU on {{ \$labels.instance }}"
          description: "CPU usage is {{ \$value | printf \\"%.1f\\" }}% on {{ \$labels.instance }}."

      - alert: DiskSpaceLow
        expr: (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 > 85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Disk space low on {{ \$labels.instance }}"

      - alert: DiskWillFillIn24h
        expr: predict_linear(node_filesystem_avail_bytes{mountpoint="/",fstype!~"tmpfs|overlay"}[6h], 86400) < 0
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Disk on {{ \$labels.instance }} will fill in 24h"
\`\`\`

Validate the file with promtool.`,
        hints: [
          'Use promtool check rules to validate before applying',
          'The for clause prevents false positives from short spikes',
          'Annotations support Go templates: {{ $labels.xxx }} and {{ $value }}'
        ],
        solution: `\`\`\`bash
# Create the rules file
cat > /etc/prometheus/rules/infra_alerts.yml << 'EOF'
groups:
  - name: infrastructure
    rules:
      - alert: NodeDown
        expr: up{job="node-exporter"} == 0
        for: 3m
        labels:
          severity: critical
        annotations:
          summary: "Node {{ \$labels.instance }} is DOWN"
      - alert: HighCPUUsage
        expr: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100 > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU on {{ \$labels.instance }}: {{ \$value | printf \\"%.1f\\" }}%"
EOF

# Validate
promtool check rules /etc/prometheus/rules/infra_alerts.yml

# Reload Prometheus
curl -X POST http://localhost:9090/-/reload
\`\`\``,
        verify: `\`\`\`bash
# Validate rules syntax
promtool check rules /etc/prometheus/rules/infra_alerts.yml
# Expected output: SUCCESS

# Check rules were loaded
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[] | select(.name=="infrastructure") | .rules | length'
# Expected output: 4 (or the number of rules you created)

# Check alert status
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts | length'
# Expected output: number >= 0
\`\`\``
      },
      {
        title: 'Create Application Alerting Rules',
        instruction: `Create alerting rules focused on HTTP application metrics.

\`\`\`yaml
# /etc/prometheus/rules/app_alerts.yml
groups:
  - name: application
    rules:
      - alert: HighErrorRate
        expr: |
          sum by(service) (rate(http_requests_total{status=~"5.."}[5m]))
          /
          sum by(service) (rate(http_requests_total[5m]))
          > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ \$labels.service }}"
          description: "{{ \$value | printf \\"%.2f\\" }}% of requests are failing."

      - alert: HighLatencyP99
        expr: |
          histogram_quantile(0.99,
            sum by(service, le) (rate(http_request_duration_seconds_bucket[5m]))
          ) > 1.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High P99 latency on {{ \$labels.service }}"

      - alert: PodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total[15m]) * 60 * 15 > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Pod {{ \$labels.namespace }}/{{ \$labels.pod }} is crash looping"
\`\`\``,
        hints: [
          'Use rate() with at least 5m for stable alerts',
          'For error rate, divide 5xx errors by total requests',
          'histogram_quantile needs "le" preserved in sum by()'
        ],
        solution: `\`\`\`bash
# Create application rules file
cat > /etc/prometheus/rules/app_alerts.yml << 'EOF'
groups:
  - name: application
    rules:
      - alert: HighErrorRate
        expr: |
          sum by(service) (rate(http_requests_total{status=~"5.."}[5m]))
          /
          sum by(service) (rate(http_requests_total[5m]))
          > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Error rate > 5% on {{ \$labels.service }}"
      - alert: PodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total[15m]) * 60 * 15 > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "{{ \$labels.pod }} crash looping in {{ \$labels.namespace }}"
EOF

# Validate and reload
promtool check rules /etc/prometheus/rules/app_alerts.yml
curl -X POST http://localhost:9090/-/reload
\`\`\``,
        verify: `\`\`\`bash
# Validate syntax
promtool check rules /etc/prometheus/rules/app_alerts.yml
# Expected output: SUCCESS

# Check application rules were loaded
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[] | select(.name=="application") | .rules[] | .name'
# Expected output: "HighErrorRate", "HighLatencyP99", "PodCrashLooping"
\`\`\``
      },
      {
        title: 'Configure Alertmanager with Routing',
        instruction: `Configure Alertmanager with severity-based routing, grouping, and inhibition.

\`\`\`yaml
# /etc/alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  receiver: 'default'
  group_by: ['alertname', 'namespace']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    - match:
        severity: critical
      receiver: 'critical-channel'
      repeat_interval: 1h
      continue: false
    - match:
        severity: warning
      receiver: 'warning-channel'
      repeat_interval: 8h

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://localhost:5001/webhook'

  - name: 'critical-channel'
    webhook_configs:
      - url: 'http://localhost:5001/critical'

  - name: 'warning-channel'
    webhook_configs:
      - url: 'http://localhost:5001/warning'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
\`\`\`

Validate and apply the Alertmanager configuration.`,
        hints: [
          'amtool can validate Alertmanager configuration',
          'group_by defines how alerts are grouped in the notification',
          'inhibit_rules reduces noise by suppressing warnings when critical is active',
          'continue: false (default) stops at the first match; true continues evaluating routes'
        ],
        solution: `\`\`\`bash
# Validate Alertmanager configuration
amtool check-config /etc/alertmanager/alertmanager.yml

# Reload Alertmanager
curl -X POST http://localhost:9093/-/reload

# Check status
curl -s http://localhost:9093/api/v2/status | jq '.cluster.status'
\`\`\``,
        verify: `\`\`\`bash
# Validate configuration
amtool check-config /etc/alertmanager/alertmanager.yml
# Expected output: SUCCESS (or "found no errors")

# Check that Alertmanager is running
curl -s http://localhost:9093/api/v2/status | jq '.cluster.status'
# Expected output: "ready"

# Check active alerts in Alertmanager
curl -s http://localhost:9093/api/v2/alerts | jq '. | length'
# Expected output: number >= 0
\`\`\``
      },
      {
        title: 'Test and Verify Alerts',
        instruction: `Test the alerting pipeline end-to-end: generate an alert condition and verify the notification is received.

\`\`\`bash
# Check active alerts in Prometheus
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | {alertname: .labels.alertname, state: .state, severity: .labels.severity}'

# Check rules in Prometheus
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | {name: .name, state: .state, health: .health}'

# Check alerts in Alertmanager
curl -s http://localhost:9093/api/v2/alerts | jq '.[] | {alertname: .labels.alertname, status: .status.state}'

# Create a test silence (expires in 1 hour)
amtool silence add alertname=TestAlert --duration=1h --comment="Test silence"

# List active silences
amtool silence query
\`\`\``,
        hints: [
          'Alerts in "pending" state have not yet been sent to Alertmanager',
          'Use amtool to interact with Alertmanager via CLI',
          'Silences automatically expire after the defined duration'
        ],
        solution: `\`\`\`bash
# View all alerts and their states
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | {alert: .labels.alertname, state: .state}'

# View health of all rules
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.type=="alerting") | {name: .name, state: .state}'

# Create silence via amtool
amtool silence add alertname="HighCPUUsage" --duration=2h --comment="Planned maintenance" --alertmanager.url=http://localhost:9093

# List silences
amtool silence query --alertmanager.url=http://localhost:9093

# Remove silence
amtool silence expire <silence-id> --alertmanager.url=http://localhost:9093
\`\`\``,
        verify: `\`\`\`bash
# Verify rules are healthy
curl -s http://localhost:9090/api/v1/rules | jq '[.data.groups[].rules[] | select(.health != "ok")] | length'
# Expected output: 0 (all rules should be healthy)

# Verify Prometheus -> Alertmanager connectivity
curl -s http://localhost:9090/api/v1/alertmanagers | jq '.data.activeAlertmanagers | length'
# Expected output: number > 0

# Verify Alertmanager is processing alerts
curl -s http://localhost:9093/api/v2/status | jq '.cluster.status'
# Expected output: "ready"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Alerts stuck in "pending" and never transition to "firing"',
      difficulty: 'easy',
      symptom: 'An alerting rule shows "pending" state in Prometheus, but never transitions to "firing", even though the condition is clearly violated.',
      diagnosis: `\`\`\`bash
# Check the rule state
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.name=="RuleName") | {state: .state, lastEvaluation: .lastEvaluation, evaluationTime: .evaluationTime}'

# Check if the expression returns data consistently
curl -s 'http://localhost:9090/api/v1/query?query=YOUR_EXPRESSION' | jq '.data.result'

# Check evaluation_interval vs "for"
curl -s http://localhost:9090/api/v1/status/config | jq '.data.yaml' | grep evaluation_interval
\`\`\``,
      solution: `**Common causes:**

1. **Intermittent condition:** The metric oscillates between true and false. Prometheus resets the "for" timer each time the condition becomes false.
\`\`\`promql
# Solution: smooth the metric with avg_over_time or a larger range
avg_over_time(metric[10m]) > threshold
# instead of
metric > threshold
\`\`\`

2. **Evaluation interval too long:** If evaluation_interval is 1m and "for" is 2m, the condition needs to be true for 3 consecutive evaluations (3 effective minutes).

3. **Unstable target:** If the target goes UP/DOWN intermittently, the series are discontinuous.

4. **Labels changing:** If labels like "pod" change (redeploy), Prometheus treats it as a new series and resets "for".
\`\`\`promql
# Aggregate without volatile labels
sum by(service) (rate(metric[5m]))  # without "pod" or "instance"
\`\`\``
    },
    {
      title: 'Alertmanager not sending notifications despite firing alerts',
      difficulty: 'medium',
      symptom: 'Prometheus shows alerts in "firing" state, but Alertmanager is not sending notifications to the configured channel (Slack, PagerDuty, etc.).',
      diagnosis: `\`\`\`bash
# Check if Prometheus is connected to Alertmanager
curl -s http://localhost:9090/api/v1/alertmanagers | jq '.data.activeAlertmanagers'

# Check alerts received by Alertmanager
curl -s http://localhost:9093/api/v2/alerts | jq '. | length'

# Check for active silences suppressing the alert
curl -s http://localhost:9093/api/v2/silences | jq '.[] | select(.status.state=="active") | {matchers: .matchers, createdBy: .createdBy}'

# Check Alertmanager logs
kubectl logs -l app=alertmanager --tail=50 | grep -i "error\\|fail\\|notify"
\`\`\``,
      solution: `**Common causes:**

1. **Active silence:** A silence may be suppressing the alert.
\`\`\`bash
amtool silence query --alertmanager.url=http://localhost:9093
# If you find silences, expire them:
amtool silence expire <id>
\`\`\`

2. **Inhibition rule suppressing:** Check if an inhibit_rule is suppressing the alert.
\`\`\`yaml
# Review inhibit_rules in alertmanager.yml
inhibit_rules:
  - source_match: { severity: critical }
    target_match: { severity: warning }
    equal: [alertname]  # Caution: too broad "equal" can suppress too much
\`\`\`

3. **Wrong routing:** The alert may be going to the wrong receiver.
\`\`\`bash
# Test routing
amtool config routes test --config.file=alertmanager.yml severity=critical team=infra
\`\`\`

4. **Misconfigured receiver:** Invalid token/URL for Slack/PagerDuty.
\`\`\`bash
# Check notification error logs
kubectl logs -l app=alertmanager | grep "error.*notify"
\`\`\`

5. **repeat_interval hasn't elapsed:** The alert was already sent and repeat_interval (e.g., 4h) hasn't expired.`
    },
    {
      title: 'Alert fatigue — too many useless notifications',
      difficulty: 'hard',
      symptom: 'The team receives dozens of alerts per day, many irrelevant or duplicated. On-call is ignoring notifications, and real alerts go unnoticed.',
      diagnosis: `\`\`\`bash
# Count alerts by type in the last 24h
curl -s http://localhost:9093/api/v2/alerts | jq 'group_by(.labels.alertname) | map({alertname: .[0].labels.alertname, count: length}) | sort_by(-.count)'

# Identify flapping alerts (fired + resolved quickly)
curl -s http://localhost:9093/api/v2/alerts | jq '[.[] | select(.endsAt != null)] | map({alertname: .labels.alertname, duration: (.endsAt | sub("T.*"; "") )}) '

# Check grouping
grep -A5 "group_by" /etc/alertmanager/alertmanager.yml
\`\`\``,
      solution: `**Strategies to reduce alert fatigue:**

1. **Review thresholds and "for":**
\`\`\`yaml
# Before (too sensitive)
- alert: HighCPU
  expr: cpu_usage > 70
  for: 1m

# After (more tolerant)
- alert: HighCPU
  expr: avg_over_time(cpu_usage[10m]) > 85
  for: 10m
\`\`\`

2. **Implement proper grouping:**
\`\`\`yaml
route:
  group_by: ['alertname', 'namespace', 'severity']
  group_wait: 1m      # more time to group
  group_interval: 10m  # fewer updates
\`\`\`

3. **Add inhibition rules:**
\`\`\`yaml
inhibit_rules:
  - source_match: { severity: critical }
    target_match: { severity: warning }
    equal: [alertname, namespace]
  - source_match: { alertname: NodeDown }
    target_match: { alertname: HighCPU }
    equal: [instance]
\`\`\`

4. **Migrate to SLO-based alerts:**
\`\`\`yaml
# Instead of alerting on each individual metric:
- alert: SLOBurnRate
  expr: error_rate / error_budget > 14.4
  for: 2m
  labels:
    severity: critical
\`\`\`

5. **Golden rule:** If no action is needed when the alert fires, **remove the alert**. Every alert must have a clear associated action.`
    }
  ]
};
