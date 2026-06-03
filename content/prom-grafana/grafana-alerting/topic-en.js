window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['prom-grafana/grafana-alerting'] = {
  theory: `
# Grafana Alerting

## Relevance
Grafana has its own alerting system that complements (or replaces) Prometheus Alertmanager. Grafana Alerting allows you to define alerts via a graphical interface, manage notifications, and create silences in a more accessible way than manual Alertmanager configuration.

## Fundamental Concepts

### Grafana Alerting vs Prometheus Alertmanager

| Aspect | Grafana Alerting | Prometheus Alertmanager |
|--------|-----------------|----------------------|
| **Configuration** | Via graphical UI | Via YAML |
| **Multi-datasource** | Yes (Prometheus, Loki, etc.) | Prometheus only |
| **Persistence** | Grafana database | Configuration files |
| **Integration** | Native in Grafana | Requires separate config |
| **GitOps** | Provisioning YAML/JSON | Native YAML |
| **Recommended for** | Teams using Grafana as their hub | Purely Prometheus environments |

### Grafana Alerting Architecture

\`\`\`
+------------------+     +-------------------+     +------------------+
| Alert Rules      |     | Alert Manager     |     | Contact Points   |
| (PromQL/LogQL)   |---->| (Grafana internal) |---->| (Slack, Email,   |
| Evaluation       |     | Routing           |     |  PagerDuty,      |
| Conditions       |     | Grouping          |     |  Webhook)        |
+------------------+     | Silencing         |     +------------------+
                          +-------------------+
\`\`\`

### Main Components

| Component | Description |
|-----------|-----------|
| **Alert Rule** | Alert condition definition (query + threshold + evaluation) |
| **Contact Point** | Notification destination (Slack, Email, PagerDuty, Webhook) |
| **Notification Policy** | Routing rules (which alert goes to which contact point) |
| **Silence** | Temporary alert suppression |
| **Mute Timing** | Recurring schedules when alerts should not notify |
| **Alert Group** | Alert grouping by labels |

### Creating Alert Rules

**Via UI:**
\`\`\`
Alerting > Alert rules > New alert rule

1. Rule name: HighCPUUsage
2. Rule type: Grafana managed
3. Query:
   - Data source: Prometheus
   - PromQL: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100
4. Expression:
   - Reduce: Last value
   - Threshold: IS ABOVE 80
5. Evaluation:
   - Folder: Infrastructure
   - Group: node-alerts
   - Evaluate every: 1m
   - For: 5m (pending duration)
6. Labels:
   - severity: warning
   - team: infra
7. Annotations:
   - summary: High CPU on node {{ $labels.instance }}
   - description: CPU at {{ $value }}%
\`\`\`

**Via Provisioning (YAML):**
\`\`\`yaml
# /etc/grafana/provisioning/alerting/rules.yaml
apiVersion: 1
groups:
  - orgId: 1
    name: infrastructure
    folder: Infrastructure
    interval: 1m
    rules:
      - uid: high-cpu
        title: HighCPUUsage
        condition: C
        data:
          - refId: A
            relativeTimeRange:
              from: 600
              to: 0
            datasourceUid: prometheus
            model:
              expr: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100
              refId: A
          - refId: B
            relativeTimeRange:
              from: 0
              to: 0
            datasourceUid: __expr__
            model:
              type: reduce
              expression: A
              reducer: last
              refId: B
          - refId: C
            relativeTimeRange:
              from: 0
              to: 0
            datasourceUid: __expr__
            model:
              type: threshold
              expression: B
              conditions:
                - evaluator:
                    type: gt
                    params: [80]
              refId: C
        for: 5m
        labels:
          severity: warning
          team: infra
        annotations:
          summary: "High CPU on node {{ $labels.instance }}"
\`\`\`

### Configuring Contact Points

**Slack:**
\`\`\`
Alerting > Contact points > New contact point

Name: slack-infra
Type: Slack
Webhook URL: https://hooks.slack.com/services/xxx/yyy/zzz
Channel: #alerts-infra
Title: {{ .CommonLabels.alertname }}
Text: |
  {{ range .Alerts }}
  *{{ .Labels.severity }}*: {{ .Annotations.summary }}
  {{ end }}
\`\`\`

**Email:**
\`\`\`
Name: email-oncall
Type: Email
Addresses: oncall@company.com
Subject: [{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}
\`\`\`

**Webhook (generic):**
\`\`\`
Name: webhook-custom
Type: Webhook
URL: https://api.internal/alerts
HTTP Method: POST
\`\`\`

**Via Provisioning:**
\`\`\`yaml
# /etc/grafana/provisioning/alerting/contactpoints.yaml
apiVersion: 1
contactPoints:
  - orgId: 1
    name: slack-infra
    receivers:
      - uid: slack-1
        type: slack
        settings:
          url: https://hooks.slack.com/services/xxx/yyy/zzz
          recipient: "#alerts-infra"
          title: '{{ template "slack.default.title" . }}'
          text: '{{ template "slack.default.text" . }}'
\`\`\`

### Notification Policies (Routing)

Notification policies define how alerts are routed to contact points:

\`\`\`
Alerting > Notification policies > Edit

Default policy:
  Contact point: slack-general
  Group by: [alertname, namespace]
  Group wait: 30s
  Group interval: 5m
  Repeat interval: 4h

Child policies:
  - Match: severity = critical
    Contact point: pagerduty-oncall
    Repeat interval: 1h

  - Match: severity = warning
    Contact point: slack-infra
    Repeat interval: 8h

  - Match: team = dev
    Contact point: slack-dev
\`\`\`

**Via Provisioning:**
\`\`\`yaml
# /etc/grafana/provisioning/alerting/policies.yaml
apiVersion: 1
policies:
  - orgId: 1
    receiver: slack-general
    group_by: ['alertname', 'namespace']
    group_wait: 30s
    group_interval: 5m
    repeat_interval: 4h
    routes:
      - receiver: pagerduty-oncall
        matchers:
          - severity = critical
        repeat_interval: 1h
      - receiver: slack-infra
        matchers:
          - severity = warning
        repeat_interval: 8h
\`\`\`

### Silences and Mute Timings

**Silences (temporary):**
\`\`\`
Alerting > Silences > New silence

Duration: 2h
Matchers:
  - alertname = HighCPUUsage
  - instance = node-1:9100
Comment: "Planned maintenance on node-1"
\`\`\`

**Mute Timings (recurring):**
\`\`\`yaml
# Do not notify outside business hours
apiVersion: 1
muteTimes:
  - orgId: 1
    name: outside-business-hours
    time_intervals:
      - weekdays: ['saturday', 'sunday']
      - times:
          - start_time: '18:00'
            end_time: '09:00'
\`\`\`

### Multi-dimensional Alert Rule Evaluation

Grafana supports alerts that evaluate multiple series simultaneously:

\`\`\`
Query A: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

Reduce B: Last (input: A)
  -> Generates one value per instance

Threshold C: IS ABOVE 80 (input: B)
  -> Evaluates each instance separately
  -> node-1: 85% -> FIRING
  -> node-2: 45% -> OK
  -> node-3: 92% -> FIRING
\`\`\`

This generates individual alerts per series, each with its own labels.

### Notification Templates

\`\`\`go
{{ define "custom.title" }}
[{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}
{{ end }}

{{ define "custom.text" }}
{{ range .Alerts }}
*Severity:* {{ .Labels.severity }}
*Instance:* {{ .Labels.instance }}
*Summary:* {{ .Annotations.summary }}
*Value:* {{ .Values.B }}
---
{{ end }}
{{ end }}
\`\`\`

## Common Mistakes

1. **Not configuring "for" (pending period)**: Without a pending period, alerts flap on momentary spikes.
2. **Contact point without testing**: Configuring Slack/Email without sending a test results in silent failure when the alert fires.
3. **Overly simple routing**: Sending all alerts to the same channel causes alert fatigue. Differentiate by severity/team.
4. **Silences without expiration**: Forgetting to set a duration on silences can cause alerts to be suppressed indefinitely.
5. **Not using provisioning**: Configuring alerts only via UI makes it impossible to version and replicate across environments.
6. **Inconsistent labels**: Using different labels between Grafana and Prometheus alerts makes unified routing difficult.

## Killer.sh Style Challenge

**Scenario:** Configure complete alerting in Grafana for a Kubernetes cluster.

**Tasks:**
1. Create an alert rule for CPU > 80% for more than 5 minutes
2. Configure contact points for Slack (warning) and PagerDuty (critical)
3. Define notification policies with routing by severity
4. Create a silence for a 2-hour maintenance window on a specific node

**Tips:**
- Use the evaluation group "infrastructure" to group alert rules
- Configure a pending period of at least 5 minutes to avoid flapping
- Test contact points before relying on them
`,
  quiz: [
    {
      question: 'What is the main advantage of Grafana Alerting over Prometheus Alertmanager?',
      options: [
        'It is faster',
        'It supports multiple data sources (Prometheus, Loki, etc.) and graphical UI configuration',
        'It has more Kubernetes integration',
        'It does not need Prometheus'
      ],
      correct: 1,
      explanation: 'Grafana Alerting supports queries from multiple data sources (not just Prometheus) and offers configuration via a graphical UI, making it easier to create and manage alerts without directly editing YAML files.',
      reference: 'Related concept: prom-alerting — compare Grafana Alerting with Prometheus Alertmanager to choose the best for your scenario.'
    },
    {
      question: 'What is a Contact Point in Grafana Alerting?',
      options: [
        'The Prometheus endpoint',
        'The notification destination (Slack, Email, PagerDuty, Webhook) where alerts are sent',
        'The dashboard that shows alerts',
        'The monitored metric'
      ],
      correct: 1,
      explanation: 'A Contact Point is the configuration of the alert notification destination. It defines how and where notifications are sent (Slack, Email, PagerDuty, Webhook, Teams, etc.). Each contact point can have multiple receivers.',
      reference: 'Related concept: prom-alerting — Contact Points in Grafana are analogous to Receivers in Alertmanager.'
    },
    {
      question: 'What is the difference between Silence and Mute Timing in Grafana?',
      options: [
        'They are the same thing',
        'Silence is temporary (e.g., 2h for maintenance), Mute Timing is recurring (e.g., outside business hours)',
        'Silence is for critical alerts, Mute Timing is for warnings',
        'Silence suppresses notifications, Mute Timing disables alerts'
      ],
      correct: 1,
      explanation: 'A Silence is a temporary suppression with a defined duration (e.g., 2h during maintenance). A Mute Timing is a recurring rule that defines schedules when notifications should not be sent (e.g., weekends, outside business hours). Both suppress notifications, neither disables alerts.',
      reference: 'Related concept: prom-alerting — Silences in Grafana work similarly to those in Alertmanager.'
    },
    {
      question: 'How does multi-dimensional alert evaluation work in Grafana?',
      options: [
        'It evaluates all series as a single metric',
        'The query returns multiple series, Reduce generates one value per series, and Threshold evaluates each one separately',
        'It creates a separate alert for each dashboard',
        'It only works with single-node metrics'
      ],
      correct: 1,
      explanation: 'Grafana evaluates each time series separately: the query returns N series (e.g., one per node), Reduce extracts the last value from each, and Threshold evaluates whether each exceeds the limit. This generates individual alerts per series, each with its own labels.',
      reference: 'Related concept: promql-basics — by() aggregations control how many series are returned.'
    },
    {
      question: 'What is a Notification Policy in Grafana Alerting?',
      options: [
        'Grafana\'s privacy policy',
        'Rules that define how alerts are routed to Contact Points, including grouping and repeat interval',
        'The server email configuration',
        'Permissions for who can create alerts'
      ],
      correct: 1,
      explanation: 'Notification Policies define routing: which alert goes to which contact point, how to group alerts (group_by), how long to wait before sending (group_wait), and when to repeat (repeat_interval). They work hierarchically with default + child policies.',
      reference: 'Related concept: prom-alerting — Notification Policies are analogous to the Alertmanager route tree.'
    },
    {
      question: 'What is the best practice for configuring the pending period ("for") in Grafana alert rules?',
      options: [
        'Always use 0 for immediate alerts',
        'At least 2-5 minutes for critical and 5-15 minutes for warning, to avoid flapping',
        'Always use 1 hour to avoid false positives',
        'Do not use a pending period'
      ],
      correct: 1,
      explanation: 'The pending period defines how long the condition must be true before the alert fires. Without it (or with a very short value), momentary spikes cause flapping. Recommended values: 2-5m for critical (urgent action but no noise), 5-15m for warning.',
      reference: 'Related concept: prom-alerting — the "for" concept is identical in Prometheus and Grafana.'
    },
    {
      question: 'Why is it recommended to use YAML provisioning for Grafana alerts?',
      options: [
        'Because the Grafana UI does not work for alerts',
        'To version alerts in Git, replicate across environments, and review via pull requests',
        'Because YAML is faster than the UI',
        'Because Grafana only supports alerts via YAML'
      ],
      correct: 1,
      explanation: 'YAML provisioning allows storing alert configurations in Git (versioning), replicating across environments (dev/staging/prod), reviewing via PRs, and reverting changes. Alerts configured only via UI can be lost or impossible to replicate.',
      reference: 'Related concept: grafana-dashboards — Dashboard as Code follows the same provisioning principle.'
    }
  ],
  flashcards: [
    {
      front: 'What are the main components of Grafana Alerting?',
      back: '1. **Alert Rule** — alert condition (query + threshold + evaluation)\n2. **Contact Point** — notification destination (Slack, Email, PagerDuty)\n3. **Notification Policy** — routing (which alert -> which contact point)\n4. **Silence** — temporary alert suppression\n5. **Mute Timing** — recurring schedules without notification\n6. **Alert Group** — grouping by labels'
    },
    {
      front: 'Grafana Alerting vs Prometheus Alertmanager — when to use each?',
      back: '**Grafana Alerting:**\n- When Grafana is the central observability hub\n- For multi-datasource alerts (Prometheus + Loki + etc.)\n- When the team prefers UI-based configuration\n- For smaller teams without YAML expertise\n\n**Prometheus Alertmanager:**\n- Purely Prometheus environments\n- When GitOps is essential (native YAML)\n- When Alertmanager infrastructure already exists\n- For high scale (Alertmanager HA with clustering)\n\nNote: both can coexist in the same environment.'
    },
    {
      front: 'How does the Grafana Alert Rule evaluation flow work?',
      back: '1. **Query (A)**: executes PromQL and returns time series\n2. **Reduce (B)**: extracts one value from each series (last, mean, max, etc.)\n3. **Threshold (C)**: evaluates whether each value exceeds the limit\n4. **Pending (for)**: waits X minutes with condition true\n5. **Firing**: alert is sent to the internal Alertmanager\n6. **Routing**: notification policy directs to the contact point\n7. **Notification**: message sent (Slack, Email, etc.)\n\nEach series generates an individual alert with its own labels.'
    },
    {
      front: 'What is Mute Timing and how to configure it?',
      back: 'Mute Timing defines recurring schedules when notifications are NOT sent (alerts continue evaluating but do not notify).\n\nExample — outside business hours:\n```yaml\nmuteTimes:\n  - name: outside-business-hours\n    time_intervals:\n      - weekdays: [saturday, sunday]\n      - times:\n          - start_time: "18:00"\n            end_time: "09:00"\n```\n\nDifference from Silence:\n- Silence: temporary (e.g., 2h)\n- Mute Timing: recurring (e.g., every weekend)'
    },
    {
      front: 'How to provision Grafana alerts via YAML?',
      back: 'Files in /etc/grafana/provisioning/alerting/:\n\n**rules.yaml** — Alert Rules\n```yaml\napiVersion: 1\ngroups:\n  - orgId: 1\n    name: infrastructure\n    rules: [...]\n```\n\n**contactpoints.yaml** — Contact Points\n```yaml\napiVersion: 1\ncontactPoints:\n  - name: slack-infra\n    receivers: [...]\n```\n\n**policies.yaml** — Notification Policies\n```yaml\napiVersion: 1\npolicies:\n  - receiver: default\n    routes: [...]\n```\n\nBenefits: Git versioning, replication across environments, PR reviews.'
    },
    {
      front: 'What are the best practices to avoid alert fatigue in Grafana?',
      back: '1. **Adequate pending period**: 2-5m critical, 5-15m warning\n2. **Routing by severity**: critical -> pager, warning -> Slack\n3. **Grouping**: group_by [alertname, namespace] to consolidate\n4. **Mute Timings**: do not notify outside business hours for warnings\n5. **Consistent labels**: severity, team, service across all alerts\n6. **Test contact points**: verify before relying on them\n7. **Golden rule**: if it does not require action, it is not an alert — it is a log or dashboard'
    }
  ],
  lab: {
    scenario: 'You need to configure a complete alerting system in Grafana for a Kubernetes cluster. Grafana is connected to Prometheus and you need to create alert rules, contact points, and notification policies.',
    objective: 'Configure Grafana Alerting end-to-end: create alert rules, configure contact points, define notification policies with routing by severity, and create silences for maintenance.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create Contact Points',
        instruction: `Configure notification destinations before creating alert rules.

1. Go to Alerting > Contact points > New contact point
2. Create the following contact points:

**Contact Point 1: Test Webhook**
- Name: webhook-test
- Type: Webhook
- URL: https://webhook.site/unique-url (use webhook.site for testing)
- HTTP Method: POST

**Contact Point 2: Slack (if available)**
- Name: slack-alerts
- Type: Slack
- Webhook URL: (your webhook URL)
- Channel: #alerts

3. Test each contact point by clicking "Test"

\`\`\`bash
# Verify contact points via API
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/contact-points | jq '.[].name'
\`\`\``,
        hints: [
          'Use webhook.site to create a free test endpoint',
          'Always test contact points before relying on them',
          'Contact points can have multiple receivers (e.g., Slack + Email)'
        ],
        solution: `\`\`\`bash
# Create contact point via API
curl -X POST http://admin:admin@localhost:3000/api/v1/provisioning/contact-points \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "webhook-test",
    "type": "webhook",
    "settings": {
      "url": "https://webhook.site/test",
      "httpMethod": "POST"
    }
  }'

# List contact points
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/contact-points | jq '.[].name'
\`\`\``,
        verify: `\`\`\`bash
# Verify created contact points
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/contact-points | jq '. | length'
# Expected output: number > 0

# Verify specific contact point
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/contact-points | jq '.[].name'
# Expected output: list containing "webhook-test"
\`\`\``
      },
      {
        title: 'Create Alert Rules',
        instruction: `Create alert rules to monitor the cluster infrastructure.

1. Go to Alerting > Alert rules > New alert rule
2. Create the following rules:

**Rule 1: High CPU Usage**
- Name: HighCPUUsage
- Query A (Prometheus): (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100
- Expression B (Reduce): Last value of A
- Expression C (Threshold): B IS ABOVE 80
- Folder: Infrastructure
- Evaluation group: node-alerts
- Evaluate every: 1m
- For: 5m
- Labels: severity=warning, team=infra

**Rule 2: Node Down**
- Name: NodeDown
- Query A: up{job="node-exporter"} == 0
- Expression B (Reduce): Last value of A
- Expression C (Threshold): B IS ABOVE 0
- For: 3m
- Labels: severity=critical, team=infra`,
        hints: [
          'The query -> reduce -> threshold chain is mandatory in Grafana Alerting',
          'Use "for" of at least 2 minutes to avoid flapping',
          'Labels added to the rule are used by notification policy routing'
        ],
        solution: `\`\`\`bash
# Create alert rule via API (simplified example)
curl -X POST http://admin:admin@localhost:3000/api/v1/provisioning/alert-rules \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "HighCPUUsage",
    "ruleGroup": "node-alerts",
    "folderUID": "infrastructure",
    "for": "5m",
    "labels": {"severity": "warning", "team": "infra"},
    "annotations": {"summary": "High CPU on {{ $labels.instance }}"},
    "condition": "C",
    "data": [
      {
        "refId": "A",
        "datasourceUid": "prometheus",
        "model": {"expr": "(1 - avg by(instance) (rate(node_cpu_seconds_total{mode=\\"idle\\"}[5m]))) * 100"}
      }
    ]
  }'
\`\`\``,
        verify: `\`\`\`bash
# Verify created alert rules
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/alert-rules | jq '.[].title'
# Expected output: list containing "HighCPUUsage"

# Verify alert state
curl -s http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/alerts | jq '. | length'
# Expected output: number >= 0
\`\`\``
      },
      {
        title: 'Configure Notification Policies',
        instruction: `Define how alerts are routed to contact points.

1. Go to Alerting > Notification policies
2. Configure the default policy:

**Default Policy:**
- Contact point: webhook-test
- Group by: alertname, namespace
- Group wait: 30s
- Group interval: 5m
- Repeat interval: 4h

3. Add child policies:

**Child Policy 1 (Critical):**
- Matcher: severity = critical
- Contact point: (pagerduty or webhook-test)
- Repeat interval: 1h

**Child Policy 2 (Warning):**
- Matcher: severity = warning
- Contact point: slack-alerts (or webhook-test)
- Repeat interval: 8h`,
        hints: [
          'The default policy catches all alerts that do not match any child policy',
          'Child policies are evaluated in order — the first match is used',
          'Group by [alertname] groups alerts of the same type into one notification'
        ],
        solution: `\`\`\`bash
# Configure notification policy via API
curl -X PUT http://admin:admin@localhost:3000/api/v1/provisioning/policies \\
  -H "Content-Type: application/json" \\
  -d '{
    "receiver": "webhook-test",
    "group_by": ["alertname", "namespace"],
    "group_wait": "30s",
    "group_interval": "5m",
    "repeat_interval": "4h",
    "routes": [
      {
        "receiver": "webhook-test",
        "matchers": ["severity=critical"],
        "repeat_interval": "1h"
      },
      {
        "receiver": "webhook-test",
        "matchers": ["severity=warning"],
        "repeat_interval": "8h"
      }
    ]
  }'
\`\`\``,
        verify: `\`\`\`bash
# Verify notification policies
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/policies | jq '.receiver'
# Expected output: default contact point name

# Verify routes
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/policies | jq '.routes | length'
# Expected output: number > 0
\`\`\``
      },
      {
        title: 'Create Silence and Test Pipeline',
        instruction: `Create a silence to simulate maintenance and test the complete alerting pipeline.

**Create Silence:**
1. Go to Alerting > Silences > New silence
2. Configure:
   - Duration: 2h
   - Matchers: alertname = HighCPUUsage, instance = node-1:9100
   - Comment: "Planned maintenance on node-1"
3. Save the silence

**Test Pipeline:**
1. Check active alerts in Alerting > Alert rules
2. Verify notifications on the contact point (webhook.site)
3. Verify that silenced alerts did not generate notifications

\`\`\`bash
# Create silence via API
curl -X POST http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/silences \\
  -H "Content-Type: application/json" \\
  -d '{
    "matchers": [
      {"name": "alertname", "value": "HighCPUUsage", "isRegex": false},
      {"name": "instance", "value": "node-1:9100", "isRegex": false}
    ],
    "startsAt": "2024-01-01T00:00:00Z",
    "endsAt": "2024-01-01T02:00:00Z",
    "comment": "Planned maintenance",
    "createdBy": "admin"
  }'
\`\`\``,
        hints: [
          'Silences have a defined duration and expire automatically',
          'Use specific matchers to avoid silencing too many alerts',
          'Check alerts in Alerting > Alert rules to see the state (Normal, Pending, Firing)'
        ],
        solution: `\`\`\`bash
# List active silences
curl -s http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/silences | jq '.[] | select(.status.state=="active") | {id: .id, comment: .comment}'

# Verify active alerts
curl -s http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/alerts | jq '.[] | {alertname: .labels.alertname, status: .status.state}'

# Remove silence
curl -X DELETE http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/silence/<silence-id>
\`\`\``,
        verify: `\`\`\`bash
# Verify that silences exist
curl -s http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/silences | jq '. | length'
# Expected output: number > 0

# Verify overall alerting state
curl -s http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/status | jq '.cluster.status'
# Expected output: "ready" or similar
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Alert rule stays in "Normal" even with condition violated',
      difficulty: 'easy',
      symptom: 'You created an alert rule but it remains in "Normal" state even when the query returns values above the threshold.',
      diagnosis: `\`\`\`bash
# Test the query directly in Prometheus
curl -s 'http://localhost:9090/api/v1/query?query=(1-avg%20by(instance)(rate(node_cpu_seconds_total{mode=%22idle%22}[5m])))*100' | jq '.data.result'

# Check the evaluation in Grafana
# Alerting > Alert rules > your rule > view "State history"

# Verify if the evaluation interval is working
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/alert-rules | jq '.[0].execErrState'
\`\`\``,
      solution: `**Common causes:**

1. **Incorrect Reduce+Threshold chain:** Grafana requires the chain Query -> Reduce -> Threshold. If Reduce is missing, the Threshold does not evaluate correctly.

2. **Wrong reducer:** If using "Mean" instead of "Last", the average value may be below the threshold even with spikes.

3. **Wrong data source:** Verify the alert rule uses the correct Prometheus data source.

4. **Misconfigured expression:** The "condition" must point to the Threshold refId (usually "C").

5. **No data:** If the query returns no data, the default state is "Normal" (or "NoData" depending on config). Check the "No data state" in the rule settings.`
    },
    {
      title: 'Notifications are not sent even with firing alerts',
      difficulty: 'medium',
      symptom: 'Alert rules are in "Firing" state in Grafana, but no notifications are received on Slack/Email/Webhook.',
      diagnosis: `\`\`\`bash
# Verify firing alerts
curl -s http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/alerts | jq '.[] | select(.status.state=="active")'

# Check active silences
curl -s http://admin:admin@localhost:3000/api/alertmanager/grafana/api/v2/silences | jq '.[] | select(.status.state=="active")'

# Check Grafana logs
kubectl logs -l app.kubernetes.io/name=grafana -n monitoring --tail=30 | grep -i "alert\\|notif\\|error"
\`\`\``,
      solution: `**Common causes:**

1. **Active silence:** A silence may be suppressing notifications. Check in Alerting > Silences.

2. **Notification policy does not match:** The default policy may point to a non-functional contact point. Check the routing.

3. **Misconfigured contact point:** Invalid webhook URL, expired Slack token, email without SMTP configured.
\`\`\`bash
# Test contact point
curl -X POST http://admin:admin@localhost:3000/api/alertmanager/grafana/config/api/v1/receivers/test \\
  -H "Content-Type: application/json" \\
  -d '{"receivers": [{"name": "webhook-test"}]}'
\`\`\`

4. **repeat_interval not expired:** If the alert was already notified, it needs to wait for the repeat_interval (e.g., 4h) before resending.

5. **Active mute timing:** Check if there are mute timings configured that suppress notifications at the current time.`
    },
    {
      title: 'Duplicate alerts between Grafana and Prometheus Alertmanager',
      difficulty: 'hard',
      symptom: 'The team receives duplicate notifications: the same alert is sent by both Grafana Alerting and Prometheus Alertmanager.',
      diagnosis: `\`\`\`bash
# Check for duplicate alert rules
# In Grafana
curl -s http://admin:admin@localhost:3000/api/v1/provisioning/alert-rules | jq '.[].title'

# In Prometheus
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.type=="alerting") | .name'

# Check if Grafana is using external Alertmanager
curl -s http://admin:admin@localhost:3000/api/v1/ngalert | jq '.'
\`\`\``,
      solution: `**Strategies to resolve:**

1. **Choose a single source:** Decide whether alerts will be managed by Grafana OR Prometheus. Avoid duplication.

2. **If using Prometheus Alertmanager:**
   - Disable internal Grafana Alerting
   - Configure Grafana to only visualize Alertmanager alerts
   - Grafana > Configuration > Alertmanager > select external Alertmanager

3. **If using Grafana Alerting:**
   - Remove duplicate alerting rules from Prometheus
   - Keep only recording rules in Prometheus
   - Use Grafana as the single source for alert rules

4. **If both are needed:**
   - Differentiate by scope: Prometheus for core infrastructure alerts, Grafana for application alerts
   - Use distinct labels to avoid duplicate routing
   - Configure different contact points for each source`
    }
  ]
};
