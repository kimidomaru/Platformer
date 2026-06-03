window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['sre-operations/sre-oncall'] = {
  theory: `
# On-Call & Runbooks — SRE On-Call Practices

## Relevance
On-call is the front line of reliability. A well-structured on-call process ensures incidents are responded to quickly without burning out the team. Runbooks transform tribal knowledge into reproducible procedures, reducing MTTI and allowing anyone on the team to respond effectively.

## Core Concepts

### On-Call Structure

\`\`\`
Typical rotation:
  Primary On-Call  -> responds first
  Secondary On-Call -> backup if primary doesn't respond in 5min
  Escalation       -> manager/lead if both fail

Common cycles:
  Weekly: 7 consecutive days (most common)
  Bi-weekly: 14 days
  Follow-the-sun: timezone rotation (24h coverage)
\`\`\`

**Healthy on-call rules:**
1. Minimum 2 people on the team for rotation
2. Maximum 25% of time on-call (1 week out of 4)
3. Compensation for on-call (time off, extra pay)
4. On-call should not be interrupted by project work
5. If on-call is too active, the service needs improvements
6. Every page must have an associated runbook

### Runbooks

Runbooks are operational documents with step-by-step procedures for responding to alerts and incidents.

**Runbook structure:**
\`\`\`markdown
# Runbook: [Alert Name]

## Overview
What this alert means and potential impact.

## Severity
SEV2 — core functionality degraded

## Diagnosis Steps
1. Check X
2. Check Y
3. Check Z

## Mitigation
### Option A: [quick action]
Commands and procedures

### Option B: [if A doesn't work]
Alternative procedures

## Escalation
When to escalate and to whom.

## History
Links to related past incidents.
\`\`\`

**Kubernetes runbook example:**
\`\`\`markdown
# Runbook: HighPodRestartRate

## Overview
Service pods are restarting frequently,
indicating crash loops or health check failures.

## Severity
SEV2 if critical service, SEV3 if secondary.

## Diagnosis
1. Identify affected pods:
   kubectl get pods -n <ns> --sort-by='.status.containerStatuses[0].restartCount'

2. Check last crash logs:
   kubectl logs <pod> -n <ns> --previous

3. Check events:
   kubectl describe pod <pod> -n <ns> | grep -A10 Events

4. Check resources:
   kubectl top pod <pod> -n <ns>

## Mitigation
### Option A: OOMKilled — increase limits
kubectl patch deployment <name> -n <ns> --type=json \\
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/resources/limits/memory","value":"512Mi"}]'

### Option B: CrashLoopBackOff — rollback
kubectl rollout undo deployment/<name> -n <ns>

### Option C: Liveness probe failing
Check health endpoint and adjust timeouts:
kubectl edit deployment <name> -n <ns>
# Increase initialDelaySeconds and timeoutSeconds

## Escalation
If not resolved in 30 minutes, escalate to @sre-lead.
\`\`\`

### Alerting Best Practices for On-Call

\`\`\`
Alert categories:

Pageable (wakes person up):
  - SLO burn rate > 14.4x
  - Service completely down
  - Data loss
  -> Requires IMMEDIATE action

Non-pageable (ticket/Slack):
  - Disk > 85%
  - Certificate expiring < 7 days
  - High pod restart rate
  -> Requires action NEXT BUSINESS DAY

Informational (dashboard):
  - Metrics outside baseline
  - Old version detected
  -> No immediate action required
\`\`\`

**Alert anti-patterns:**
\`\`\`
Bad:   Alert on CPU > 80% (can be normal under load)
Good:  Alert on high SLO burn rate

Bad:   Alert on each pod restart
Good:  Alert when restart rate > threshold

Bad:   Alert without runbook
Good:  Every alert has linked runbook

Bad:   50+ alerts per day
Good:  < 5 pages per on-call shift
\`\`\`

### On-Call Handoff

\`\`\`
Handoff checklist (transition between on-calls):

1. Active incidents and current status
2. Alerts that fired in the last week
3. Recent changes (deploys, config changes)
4. Pending action items from postmortems
5. Known issues
6. Updated escalation contacts
7. Tools and access verified
\`\`\`

### On-Call Health Metrics

\`\`\`
Pages per shift:
  Healthy: 0-2 pages
  Acceptable: 3-5 pages
  Problematic: 5+ pages -> service needs investment

After-hours interruptions:
  Ideal: 0 (alerts only during business hours)
  Acceptable: 1-2 per week
  Problematic: daily

Time to acknowledge:
  Target: < 5 minutes
  If consistently > 15 min, review process

False positives:
  Target: < 10% of pages
  If > 30%, review alerts urgently
\`\`\`

## Implementation in Kubernetes

### PagerDuty Integration with AlertManager

\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-main
  namespace: monitoring
stringData:
  alertmanager.yaml: |
    global:
      resolve_timeout: 5m

    route:
      receiver: default
      group_by: [alertname, namespace, service]
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
      routes:
        # SEV1/Critical -> PagerDuty (wakes up)
        - match:
            severity: critical
          receiver: pagerduty-critical
          repeat_interval: 1h
          continue: false

        # SEV2/Warning -> Slack channel
        - match:
            severity: warning
          receiver: slack-warning
          repeat_interval: 4h

    receivers:
      - name: default
        slack_configs:
          - channel: '#alerts-info'
            send_resolved: true

      - name: pagerduty-critical
        pagerduty_configs:
          - routing_key: '<pagerduty-integration-key>'
            severity: critical
            description: '{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}'
            details:
              namespace: '{{ (index .Alerts 0).Labels.namespace }}'
              runbook: '{{ (index .Alerts 0).Annotations.runbook_url }}'

      - name: slack-warning
        slack_configs:
          - channel: '#alerts-warning'
            send_resolved: true
            title: '{{ .GroupLabels.alertname }}'
            text: '{{ .CommonAnnotations.summary }}'
\`\`\`

### Alert with linked runbook

\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: oncall-alerts
  namespace: monitoring
spec:
  groups:
    - name: oncall.rules
      rules:
        - alert: HighPodRestartRate
          expr: |
            increase(kube_pod_container_status_restarts_total[1h]) > 5
          for: 10m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: "Pod {{ \$labels.pod }} in {{ \$labels.namespace }} restarted {{ \$value }} times in 1h"
            runbook_url: "https://wiki.internal/runbooks/high-pod-restart-rate"

        - alert: PVCNearlyFull
          expr: |
            kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes > 0.85
          for: 15m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: "PVC {{ \$labels.persistentvolumeclaim }} in {{ \$labels.namespace }} is {{ \$value | humanizePercentage }} full"
            runbook_url: "https://wiki.internal/runbooks/pvc-nearly-full"
\`\`\`

## Essential Commands

\`\`\`bash
# Quick triage for on-call
kubectl get nodes -o wide
kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded | head -20
kubectl top nodes --sort-by=cpu
kubectl top pods -A --sort-by=memory | head -10
kubectl get events -A --sort-by='.lastTimestamp' --field-selector type=Warning | tail -15

# Investigate problematic pod
kubectl describe pod <pod> -n <ns>
kubectl logs <pod> -n <ns> --previous --tail=50
kubectl get events -n <ns> --field-selector involvedObject.name=<pod>

# Quick mitigation actions
kubectl rollout undo deployment/<name> -n <ns>
kubectl scale deployment/<name> -n <ns> --replicas=<N>
kubectl delete pod <pod> -n <ns>  # force restart
kubectl cordon <node>              # prevent scheduling
\`\`\`

## Common Mistakes

1. **On-call without rotation**: One person permanently on-call leads to burnout. Minimum 2 people in rotation.
2. **Alerts without runbook**: Someone paged at 3 AM needs to know exactly what to do.
3. **No formal handoff**: Without structured transition, context is lost between shifts.
4. **On-call is reactive only**: On-call should include time to improve runbooks and reduce toil, not just fight fires.
5. **No on-call metrics**: If you don't measure pages/shift and false positives, you don't know if the process is healthy.
6. **Escalating too late**: If you can't resolve in 30 min, escalate. Pride is not mitigation.

## Killer.sh Style Challenge

**Scenario:** Configure a complete on-call process with alerts, runbooks, and escalation.

**Tasks:**
1. Configure AlertManager with severity-based routing
2. Create alerts with linked runbook_url
3. Write a runbook for HighPodRestartRate
4. Configure automatic escalation
5. Define on-call health metrics
`,
  quiz: [
    {
      question: 'What is the maximum recommended time a person should be on-call?',
      options: [
        '50% of the time (2 weeks out of 4)',
        '100% — permanent on-call is acceptable',
        '25% of the time (1 week out of 4) — minimum 2 people in rotation',
        '10% of the time (1 day out of 10)'
      ],
      correct: 2,
      explanation: 'Google SRE recommends a maximum of 25% of time on-call (1 week out of 4, with minimum 2 people). More than that leads to burnout, quality reduction, and increased errors. If on-call is very active (5+ pages per shift), the service needs reliability investment.',
      reference: 'Related concept: sre-toil-automation — reducing toil decreases on-call burden.'
    },
    {
      question: 'What should every pageable alert have associated with it?',
      options: [
        'A Grafana dashboard',
        'A runbook with diagnosis and mitigation procedures',
        'A Jira ticket',
        'A fixed responsible person'
      ],
      correct: 1,
      explanation: 'Every alert that wakes a person (page) must have a linked runbook with: what the alert means, diagnosis steps, mitigation procedures, and when to escalate. Someone woken at 3 AM should not have to figure out what to do — the runbook guides the response.',
      reference: 'Related concept: sre-incident-mgmt — runbooks reduce MTTI during incidents.'
    },
    {
      question: 'What is an on-call handoff and what should it include?',
      options: [
        'Just passing the phone to the next person',
        'A structured transition including active incidents, recent alerts, changes, pending action items, and known issues',
        'Sending an email with the on-call schedule',
        'Nothing — the next person checks the dashboard on their own'
      ],
      correct: 1,
      explanation: 'On-call handoff is a formal transition between shifts that includes: active incidents and status, alerts from the last week, recent changes (deploys, config changes), pending action items, known issues, and tools/access verification. Without handoff, critical context is lost.',
      reference: 'Related concept: sre-oncall — use a standardized checklist for handoffs.'
    },
    {
      question: 'How many pages per on-call shift is considered healthy?',
      options: [
        '10-20 — active on-call is normal',
        '0-2 pages per shift',
        'The quantity does not matter',
        '5-10 pages per shift'
      ],
      correct: 1,
      explanation: '0-2 pages per shift is healthy, 3-5 is acceptable, 5+ is problematic and indicates the service needs reliability investment. If on-call receives many pages, the team spends time firefighting instead of improving the system — creating a vicious cycle.',
      reference: 'Related concept: sre-principles — error budget can be used to justify reliability investment.'
    },
    {
      question: 'What is the most critical anti-pattern in on-call alerts?',
      options: [
        'Having too many alerts (50+/day) that cause alert fatigue and lead the team to ignore real alerts',
        'Having too few alerts',
        'Using PagerDuty instead of Slack',
        'Alerting only during business hours'
      ],
      correct: 0,
      explanation: 'Alert fatigue is the most dangerous anti-pattern: when the team receives many alerts (especially false positives), they start ignoring them. A real alert goes unnoticed and causes a larger incident. The solution is: every alert must have a runbook and require action; if no action is required, it is not an alert.',
      reference: 'Related concept: sre-observability — migrate to SLO-based alerting to reduce alert volume.'
    },
    {
      question: 'When should you escalate during an incident if you cannot resolve it?',
      options: [
        'After 2 hours of trying',
        'Never — always resolve it yourself',
        'After 30 minutes without progress, escalate to the next level',
        'Only if the manager asks'
      ],
      correct: 2,
      explanation: 'The general rule is to escalate after 30 minutes without significant progress. Escalating is not weakness — it is responsibility. The goal is to restore service as quickly as possible, and someone with more context or expertise can help. Waiting too long to escalate prolongs user impact.',
      reference: 'Related concept: sre-incident-mgmt — IC should proactively decide on escalation.'
    },
    {
      question: 'How does the runbook_url annotation help the on-call process?',
      options: [
        'It is just documentation — no practical use',
        'It allows the alert in PagerDuty/Slack to include a direct link to the runbook, giving on-call immediate response instructions',
        'It blocks the alert until the runbook is read',
        'It automatically emails the runbook'
      ],
      correct: 1,
      explanation: 'The runbook_url annotation in PrometheusRule is propagated by AlertManager to the destination (PagerDuty, Slack). When on-call receives the page, they see a direct link to the runbook with diagnosis and mitigation instructions. This drastically reduces MTTI — the person doesn\'t need to search for documentation.',
      reference: 'Related concept: sre-oncall — every pageable alert must have runbook_url.'
    }
  ],
  flashcards: [
    {
      front: 'On-call rotation structure?',
      back: '**Roles:**\n- Primary: responds first\n- Secondary: backup (5 min SLA)\n- Escalation: manager/lead\n\n**Cycles:**\n- Weekly (most common)\n- Bi-weekly\n- Follow-the-sun (by timezone)\n\n**Healthy rules:**\n- Min 2 people in rotation\n- Max 25% of time on-call\n- Compensation (time off/pay)\n- On-call != project work\n- Every page has runbook\n\n**Metrics:**\n- 0-2 pages/shift = healthy\n- 5+ pages/shift = problematic\n- < 10% false positives\n- MTTA < 5 minutes'
    },
    {
      front: 'Runbook structure?',
      back: '**1. Overview:**\nWhat the alert means\n\n**2. Severity:**\nSEV1-4 and potential impact\n\n**3. Diagnosis (steps):**\n```bash\nkubectl get pods -n <ns>\nkubectl logs <pod> --previous\nkubectl describe pod <pod>\nkubectl top pod <pod>\n```\n\n**4. Mitigation:**\n- Option A: quick action\n- Option B: alternative\n- Option C: workaround\n\n**5. Escalation:**\nWhen and to whom to escalate\n\n**6. History:**\nLinks to previous incidents\n\n**Rule:** outdated runbook\nis worse than no runbook'
    },
    {
      front: 'Alert categories for on-call?',
      back: '**Pageable (wakes person up):**\n- SLO burn rate > 14.4x\n- Service completely down\n- Imminent data loss\n-> IMMEDIATE action\n-> MUST have runbook\n\n**Non-pageable (ticket/Slack):**\n- Disk > 85%\n- Cert expiring < 7 days\n- High pod restart rate\n-> NEXT BUSINESS DAY\n\n**Informational (dashboard):**\n- Metrics outside baseline\n- Old version detected\n-> No immediate action\n\n**Anti-patterns:**\n- CPU > 80% as page X\n- Alert without runbook X\n- 50+ alerts/day X'
    },
    {
      front: 'On-call handoff checklist?',
      back: '**Transition between shifts must include:**\n\n1. **Active incidents** and current status\n\n2. **Recent alerts** that fired\n   in the last week\n\n3. **Recent changes** (deploys,\n   config changes, infra changes)\n\n4. **Pending action items** from\n   postmortems\n\n5. **Known issues** — known\n   problems without fix yet\n\n6. **Escalation contacts**\n   updated\n\n7. **Tools and access**\n   verified (VPN, kubectl, etc.)\n\n**Format:** 15 min meeting\nor shared document'
    },
    {
      front: 'AlertManager severity routing?',
      back: '**Structured config:**\n```yaml\nroute:\n  receiver: default\n  routes:\n    # Critical -> PagerDuty\n    - match:\n        severity: critical\n      receiver: pagerduty\n      repeat_interval: 1h\n\n    # Warning -> Slack\n    - match:\n        severity: warning\n      receiver: slack\n      repeat_interval: 4h\n```\n\n**Alert with runbook:**\n```yaml\nannotations:\n  summary: "Pod restarting"\n  runbook_url: "https://wiki/runbook"\n```\n\n**Receivers:**\n- PagerDuty: critical pages\n- Slack: warnings and info\n- Email: daily summary'
    },
    {
      front: 'On-call anti-patterns?',
      back: '**1. Permanent on-call:**\n- One person always on-call\n- Causes burnout\n-> Fix: min 2 people, rotation\n\n**2. Alerts without runbook:**\n- Paged at 3 AM with no instructions\n-> Fix: mandatory runbook\n\n**3. No handoff:**\n- Context lost between shifts\n-> Fix: transition checklist\n\n**4. Reactive only:**\n- Only fights fires, never improves\n-> Fix: 50% time on improvements\n\n**5. Alert fatigue:**\n- 50+ alerts/day = ignored\n-> Fix: < 5 pages/shift\n\n**6. Late escalation:**\n- Pride > restoring service\n-> Fix: escalate after 30 min'
    }
  ],
  lab: {
    scenario: 'You need to configure the on-call process for an SRE team: alert routing, runbooks, and on-call health metrics.',
    objective: 'Configure AlertManager with severity-based routing, create alerts with linked runbooks, and define on-call metrics.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Configure AlertManager Routing',
        instruction: `Configure AlertManager with separate routing by severity.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-oncall-config
  namespace: monitoring
type: Opaque
stringData:
  alertmanager.yaml: |
    global:
      resolve_timeout: 5m
    route:
      receiver: default
      group_by: [alertname, namespace]
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
      routes:
        - match:
            severity: critical
          receiver: critical-alerts
          repeat_interval: 1h
        - match:
            severity: warning
          receiver: warning-alerts
          repeat_interval: 4h
    receivers:
      - name: default
        webhook_configs:
          - url: http://webhook-logger:8080/default
      - name: critical-alerts
        webhook_configs:
          - url: http://webhook-logger:8080/critical
      - name: warning-alerts
        webhook_configs:
          - url: http://webhook-logger:8080/warning
EOF
\`\`\``,
        hints: [
          'Routing separates alerts by severity to different channels',
          'Critical goes to PagerDuty (simulated with webhook), warning to Slack',
          'repeat_interval defines how long to wait before re-alerting'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-oncall-config
  namespace: monitoring
stringData:
  alertmanager.yaml: |
    route:
      receiver: default
      routes:
        - match: {severity: critical}
          receiver: critical-alerts
    receivers:
      - name: default
        webhook_configs: [{url: "http://webhook:8080/default"}]
      - name: critical-alerts
        webhook_configs: [{url: "http://webhook:8080/critical"}]
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify Secret created
kubectl get secret alertmanager-oncall-config -n monitoring
# Expected output: NAME                          TYPE     DATA   AGE
#                   alertmanager-oncall-config   Opaque   1      Xs

# Verify content (decoded)
kubectl get secret alertmanager-oncall-config -n monitoring -o jsonpath='{.data.alertmanager\\.yaml}' | base64 -d | head -10
# Expected output: AlertManager YAML configuration
\`\`\``
      },
      {
        title: 'Create Alerts with Runbook URL',
        instruction: `Create alerts that include a link to the runbook.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: oncall-runbook-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: oncall.runbooks
      rules:
        - alert: HighPodRestartRate
          expr: |
            increase(kube_pod_container_status_restarts_total[1h]) > 5
          for: 10m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: "Pod {{ \$labels.pod }} restarted {{ \$value }} times in 1h"
            runbook_url: "https://wiki.internal/runbooks/high-pod-restart-rate"

        - alert: PVCAlmostFull
          expr: |
            kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes > 0.85
          for: 15m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: "PVC {{ \$labels.persistentvolumeclaim }} is {{ \$value | humanizePercentage }} full"
            runbook_url: "https://wiki.internal/runbooks/pvc-almost-full"

        - alert: NodeNotReady
          expr: |
            kube_node_status_condition{condition="Ready",status="true"} == 0
          for: 5m
          labels:
            severity: critical
            team: platform
          annotations:
            summary: "Node {{ \$labels.node }} is NotReady"
            runbook_url: "https://wiki.internal/runbooks/node-not-ready"
EOF
\`\`\``,
        hints: [
          'runbook_url is propagated by AlertManager to PagerDuty/Slack',
          'Use annotations for dynamic information (summary, description)',
          'Labels severity and team define routing and ownership'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: oncall-runbook-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: oncall.runbooks
      rules:
        - alert: HighPodRestartRate
          expr: increase(kube_pod_container_status_restarts_total[1h]) > 5
          for: 10m
          labels:
            severity: warning
          annotations:
            runbook_url: "https://wiki.internal/runbooks/high-pod-restart-rate"
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify PrometheusRule created
kubectl get prometheusrule oncall-runbook-alerts -n monitoring
# Expected output: NAME                      AGE
#                   oncall-runbook-alerts     Xs

# Verify all alerts have runbook_url
kubectl get prometheusrule oncall-runbook-alerts -n monitoring -o yaml | grep -c runbook_url
# Expected output: 3 (one per alert)
\`\`\``
      },
      {
        title: 'Create Runbook as ConfigMap',
        instruction: `Store a complete runbook as a ConfigMap in the cluster.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: runbook-high-pod-restart
  namespace: monitoring
  labels:
    type: runbook
    alert: HighPodRestartRate
data:
  runbook.md: |
    # Runbook: HighPodRestartRate

    ## Overview
    Pods are restarting frequently, indicating crash loops
    or health check failures.

    ## Severity
    - Critical service: SEV2
    - Non-critical: SEV3

    ## Diagnosis
    1. Identify affected pods:
       kubectl get pods -n <ns> --sort-by='.status.containerStatuses[0].restartCount'

    2. Check last crash logs:
       kubectl logs <pod> --previous

    3. Check events:
       kubectl describe pod <pod> | grep -A10 Events

    4. Check resource usage:
       kubectl top pod <pod>

    ## Mitigation
    ### Option A: OOMKilled
    kubectl set resources deployment/<name> --limits=memory=512Mi

    ### Option B: CrashLoopBackOff
    kubectl rollout undo deployment/<name>

    ### Option C: Liveness probe failing
    Increase initialDelaySeconds and timeoutSeconds

    ## Escalation
    If not resolved in 30 min, escalate to @sre-lead
EOF
\`\`\``,
        hints: [
          'ConfigMaps with label type=runbook can be easily searched',
          'The runbook should be clear and executable by anyone on the team',
          'Include mitigation options in order of probability'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: runbook-high-pod-restart
  namespace: monitoring
  labels:
    type: runbook
data:
  runbook.md: |
    # Runbook: HighPodRestartRate
    ## Diagnosis: kubectl logs <pod> --previous
    ## Mitigation: rollback or increase resources
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify runbook created
kubectl get cm runbook-high-pod-restart -n monitoring
# Expected output: NAME                        DATA   AGE
#                   runbook-high-pod-restart    1      Xs

# List all runbooks
kubectl get cm -n monitoring -l type=runbook
# Expected output: list of runbooks

# Verify content
kubectl get cm runbook-high-pod-restart -n monitoring -o jsonpath='{.data.runbook\\.md}' | head -5
# Expected output: first lines of the runbook
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'On-call receiving too many false pages (alert fatigue)',
      difficulty: 'medium',
      symptom: 'On-call receives 10+ pages per shift, mostly false positives. The team started ignoring alerts and response to real incidents is slow.',
      diagnosis: `\`\`\`bash
# Count alerts by type
kubectl port-forward svc/alertmanager -n monitoring 9093:9093 &
curl -s http://localhost:9093/api/v2/alerts | jq '.[].labels.alertname' | sort | uniq -c | sort -rn | head -10

# Check alert history
curl -s 'http://localhost:9090/api/v1/query?query=ALERTS{alertstate="firing"}' | jq '.data.result | length'

# Check silences
curl -s http://localhost:9093/api/v2/silences | jq '[.[] | select(.status.state=="active")] | length'
\`\`\``,
      solution: `**Reduction strategy:**

1. **Audit each alert:**
   - Has runbook? If not, create or remove
   - Requires action? If not, downgrade to ticket
   - Fires frequently? Adjust threshold

2. **Classify alerts:**
\`\`\`
Page: SLO burn rate, service down
Ticket: disk, cert, pod restarts
Dashboard: CPU, memory baseline
\`\`\`

3. **Increase thresholds:**
\`\`\`yaml
# Before: too sensitive
for: 1m
expr: cpu > 70

# After: realistic
for: 15m
expr: cpu > 90
\`\`\`

4. **Migrate to SLO-based:** A single burn rate alert replaces dozens of symptom alerts.

5. **Target:** < 2 pages/shift, < 10% false positives`
    },
    {
      title: 'Missed handoff — on-call has no context',
      difficulty: 'easy',
      symptom: 'The new on-call doesn\'t know there is an ongoing incident or a recent change that could cause problems. There was no formal handoff.',
      diagnosis: `\`\`\`bash
# Check for active incidents
kubectl get cm -n production -l type=postmortem --sort-by=.metadata.creationTimestamp | tail -3

# Check recent deploys
kubectl get deployments -n production -o jsonpath='{range .items[*]}{.metadata.name}: {.metadata.annotations.deployment\\.kubernetes\\.io/revision}{"\n"}{end}'

# Check recent events
kubectl get events -A --sort-by='.lastTimestamp' --field-selector type=Warning | tail -10
\`\`\``,
      solution: `**Implement formal handoff:**

1. **Automated checklist:** Create a handoff script/dashboard:
\`\`\`bash
#!/bin/bash
echo "=== ON-CALL HANDOFF ==="
echo "\\n--- Active Incidents ---"
kubectl get cm -n production -l type=postmortem --sort-by=.metadata.creationTimestamp | tail -3
echo "\\n--- Active Alerts ---"
curl -s http://alertmanager:9093/api/v2/alerts | jq '.[].labels.alertname'
echo "\\n--- Recent Deploys (24h) ---"
kubectl get events -A --field-selector reason=ScalingReplicaSet --sort-by='.lastTimestamp' | tail -5
echo "\\n--- Known Issues ---"
kubectl get cm -n production -l type=known-issue
\`\`\`

2. **15-minute meeting** between on-calls during transition

3. **Shared document** updated continuously (Google Doc, Notion)

4. **Automation:** Configure Slack bot that posts shift summary automatically`
    },
    {
      title: 'Outdated runbook causes wrong mitigation',
      difficulty: 'hard',
      symptom: 'On-call followed the runbook for an alert, but commands failed because the service changed (new namespace, new architecture). The wrong mitigation made the incident worse.',
      diagnosis: `\`\`\`bash
# Check when runbook was last updated
kubectl get cm -n monitoring -l type=runbook -o jsonpath='{range .items[*]}{.metadata.name}: {.metadata.creationTimestamp}{"\n"}{end}'

# Check if service changed
kubectl get deployment -n production -o yaml | grep -i "image\\|namespace" | head -10

# Check change history
kubectl rollout history deployment/<name> -n production
\`\`\``,
      solution: `**Prevention:**

1. **Periodic review:** Schedule runbook review every 30 days. Runbooks not reviewed in 90 days should be marked as "unverified".

2. **Game days:** Execute runbooks periodically as exercises:
   - Simulate the alert in staging environment
   - Execute the runbook steps
   - Update if anything changed

3. **Version control:** Keep runbooks in Git with the code:
\`\`\`
repo/
  docs/runbooks/
    high-pod-restart-rate.md
    pvc-almost-full.md
    node-not-ready.md
\`\`\`

4. **Ownership:** Each runbook has an owner. When the service changes, the owner updates the runbook in the same PR.

5. **Feedback loop:** After each use in an incident, on-call reports whether the runbook was correct and suggests improvements.`
    }
  ]
};
