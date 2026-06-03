window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['sre-fundamentals/sre-incident-mgmt'] = {
  theory: `
# Incident Management — Response, Severity & Postmortems

## Relevance
Incidents are inevitable in distributed systems. The difference between a mature SRE team and a reactive one lies in the ability to respond in a structured way, communicate effectively, and learn from each failure. Incident management is the process that transforms chaos into learning.

## Core Concepts

### Incident Lifecycle

\`\`\`
Detection -> Triage -> Response -> Mitigation -> Resolution -> Postmortem
    |          |         |            |             |            |
  Alert    Severity   IC assign   Workaround   Fix root     Learn
  received  defined   Comms up    applied      cause        and prevent
\`\`\`

### Severity Levels

| Severity | Description | Response | Example |
|----------|-------------|----------|---------|
| **SEV1 / P1** | Critical impact — service completely unavailable | Immediate, all-hands, bridge call | Payment API down |
| **SEV2 / P2** | Significant impact — core functionality degraded | Immediate, on-call + backup | Latency 10x above normal |
| **SEV3 / P3** | Minor impact — secondary functionality affected | Next business day | Admin dashboard with error |
| **SEV4 / P4** | Minimal impact — cosmetic or edge case | Normal backlog | Typo in error message |

### Roles During an Incident

\`\`\`
Incident Commander (IC):
  - Coordinates response
  - Sets priorities
  - Delegates tasks
  - Does NOT debug directly

Communications Lead:
  - Updates stakeholders
  - Posts updates to status page
  - Manages expectations
  - Maintains timeline

Operations Lead:
  - Performs technical diagnosis
  - Implements mitigation
  - Documents actions taken
  - Coordinates SMEs (Subject Matter Experts)

Scribe:
  - Documents everything in real time
  - Records decisions and rationale
  - Collects logs and evidence
  - Prepares material for postmortem
\`\`\`

### Response Process

**1. Detection and Triage (first 5 minutes):**
\`\`\`bash
# Check overall cluster status
kubectl get nodes
kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded

# Check recent events
kubectl get events -A --sort-by='.lastTimestamp' | tail -20

# Check SLO metrics
curl -s 'http://prometheus:9090/api/v1/query?query=slo:error_budget:remaining'

# Determine blast radius
kubectl get pods -n production -o wide | grep -v Running
\`\`\`

**2. Communication (first 10 minutes):**
\`\`\`
Update Template:
  [SEV2] Incident: Checkout API high latency
  Status: Investigating
  Impact: ~30% of users affected
  IC: @person
  Next update: 15 minutes
\`\`\`

**3. Mitigation (focus on restoring service):**
\`\`\`bash
# Quick rollback
kubectl rollout undo deployment/checkout-api -n production

# Scale to absorb load
kubectl scale deployment/checkout-api -n production --replicas=10

# Isolate problematic component
kubectl cordon problematic-node

# Redirect traffic
kubectl patch svc checkout-api -n production -p '{"spec":{"selector":{"version":"stable"}}}'
\`\`\`

**4. Resolution (after service restored):**
\`\`\`bash
# Confirm SLIs are back to normal
curl -s 'http://prometheus:9090/api/v1/query?query=sli:http_requests:availability_rate5m'

# Verify no residual errors
kubectl logs -n production -l app=checkout-api --since=10m | grep -c ERROR

# Document final timeline
# Prepare for postmortem
\`\`\`

### Blameless Postmortem

The blameless postmortem is the most important learning tool. The focus is on the **system**, not the people.

**Principles:**
1. **Blameless**: nobody is at fault — the system failed
2. **Honesty**: report what actually happened
3. **Focus on learning**: how to prevent, not who made the mistake
4. **Concrete action items**: each item has an owner and deadline

**Postmortem Template:**
\`\`\`markdown
# Postmortem: [Incident Title]

## Summary
Date: 2025-01-15
Duration: 45 minutes (14:30 - 15:15 UTC)
Severity: SEV2
Impact: 30% of checkout users affected
Error Budget consumed: 15 minutes (of 43 min remaining)

## Timeline
- 14:25 — Deploy v2.3.1 of checkout-api started
- 14:30 — Alert: ErrorBudgetBurnRateHigh fired
- 14:32 — IC declared, bridge call started
- 14:35 — Identified: new version with N+1 query
- 14:38 — Rollback to v2.3.0 started
- 14:42 — Rollback complete, latency normalizing
- 14:50 — SLIs within target
- 15:15 — Incident closed

## Root Cause
Version 2.3.1 introduced an N+1 query on the /checkout
endpoint causing 10x more database queries.
Pre-deploy load testing did not cover the checkout
endpoint with realistic volume.

## What Went Well
- Burn rate alert detected within 5 minutes
- Automatic rollback worked correctly
- Communication was clear and frequent

## What Can Improve
- Load test didn't cover checkout scenario
- No canary deploy to detect earlier
- SQL query review not mandatory in PR

## Action Items
1. [P1] Add load test for /checkout — @dev-lead — 2025-01-22
2. [P2] Implement canary deploy — @sre-team — 2025-02-01
3. [P2] Add mandatory SQL review — @tech-lead — 2025-01-29
4. [P3] Create per-endpoint query dashboard — @dba — 2025-02-15
\`\`\`

### Incident Management Metrics

\`\`\`
MTTD — Mean Time to Detect:
  Time between problem start and detection.
  Ideal: < 5 minutes (with good monitoring)

MTTR — Mean Time to Resolve:
  Time between detection and full resolution.
  Composed of: MTTA + MTTI + MTTM

MTTA — Mean Time to Acknowledge:
  Time between alert and someone taking ownership.
  Ideal: < 5 minutes

MTTI — Mean Time to Investigate:
  Time spent investigating root cause.

MTTM — Mean Time to Mitigate:
  Time to restore service (workaround).
  Ideal: < 30 minutes for SEV1/SEV2
\`\`\`

### Communication During Incidents

\`\`\`
Communication rules:
  1. Update every 15-30 minutes (even without news)
  2. Separate internal (technical) from external (customer) comms
  3. Use standardized templates
  4. Define who communicates (Communications Lead)
  5. Status page updated automatically

Channels:
  Slack #incident-YYYY-MM-DD — technical communication
  Bridge call (Zoom/Meet) — coordination
  Status page — external communication
  Email — executive stakeholders
\`\`\`

## Automating Incident Response in K8s

### PagerDuty/Opsgenie Integration

\`\`\`yaml
# AlertManager config for PagerDuty
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-config
  namespace: monitoring
stringData:
  alertmanager.yaml: |
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
          receiver: 'pagerduty-critical'
          repeat_interval: 1h
        - match:
            severity: warning
          receiver: 'slack-warnings'
          repeat_interval: 4h

    receivers:
      - name: 'default'
        slack_configs:
          - channel: '#alerts-default'
            api_url: 'https://hooks.slack.com/services/xxx'

      - name: 'pagerduty-critical'
        pagerduty_configs:
          - service_key: 'your-pagerduty-key'
            severity: critical

      - name: 'slack-warnings'
        slack_configs:
          - channel: '#alerts-warnings'
            api_url: 'https://hooks.slack.com/services/xxx'
\`\`\`

## Essential Commands

\`\`\`bash
# Quick triage
kubectl get nodes -o wide
kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded
kubectl get events -A --sort-by='.lastTimestamp' | tail -30
kubectl top nodes
kubectl top pods -n production --sort-by=cpu

# Mitigation
kubectl rollout undo deployment/<name> -n production
kubectl scale deployment/<name> -n production --replicas=<N>
kubectl cordon <node-name>
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# Diagnosis
kubectl describe pod <pod> -n production
kubectl logs <pod> -n production --since=30m
kubectl exec -it <pod> -n production -- /bin/sh
kubectl get events -n production --field-selector involvedObject.name=<pod>
\`\`\`

## Common Mistakes

1. **Not declaring IC early**: Without an Incident Commander, response is uncoordinated. Declare IC within the first 5 minutes.
2. **Focusing on root cause during the incident**: First mitigate (restore service), then investigate root cause.
3. **Blame culture**: Postmortems that blame people inhibit transparency and learning.
4. **Not documenting timeline**: Without a timeline, the postmortem loses critical details. Use a scribe.
5. **Action items without owner or deadline**: Vague action items are never executed.
6. **Not testing runbooks**: Outdated runbooks fail when we need them most.

## Killer.sh Style Challenge

**Scenario:** A critical service has a high error rate. Execute the complete incident management process.

**Tasks:**
1. Identify the problem and define severity
2. Assume the IC role and coordinate response
3. Execute mitigation (rollback or scaling)
4. Confirm restoration by verifying SLIs
5. Write a blameless postmortem with action items
`,
  quiz: [
    {
      question: 'What is the role of the Incident Commander (IC) during an incident?',
      options: [
        'Debug and fix the problem directly',
        'Coordinate the response, set priorities, delegate tasks, and maintain communication — without debugging directly',
        'Only communicate with external stakeholders',
        'Write the postmortem during the incident'
      ],
      correct: 1,
      explanation: 'The IC coordinates the entire incident response: sets priorities, delegates tasks to Operations Lead and SMEs, and ensures communication is flowing. The IC should NOT debug directly — that would split attention and compromise coordination. Think of it like an orchestra conductor.',
      reference: 'Related concept: sre-incident-mgmt — the 4 roles are IC, Communications Lead, Operations Lead, and Scribe.'
    },
    {
      question: 'What does "blameless postmortem" mean?',
      options: [
        'A postmortem where nobody participates',
        'A postmortem that does not identify root cause',
        'A postmortem focused on systems and processes that failed, not blaming individuals, promoting transparency and learning',
        'A postmortem written only by the management team'
      ],
      correct: 2,
      explanation: 'A blameless postmortem focuses on how the system allowed the error to happen, not on who made the error. People act rationally with the information available at the time. The goal is to improve systems and processes to prevent recurrence, which requires total honesty — impossible in a blame culture.',
      reference: 'Related concept: sre-principles — postmortems feed improvements that protect the error budget.'
    },
    {
      question: 'What is the first priority during an incident: finding root cause or restoring service?',
      options: [
        'Finding root cause — without understanding the problem, you cannot solve it',
        'Restoring service (mitigate) first, then investigate root cause',
        'It depends on the severity',
        'Communicate with stakeholders and wait for instructions'
      ],
      correct: 1,
      explanation: 'Priority number 1 is to MITIGATE — restore service for users. Rollback, scaling, failover are mitigation actions that restore service quickly. Root cause investigation happens AFTER, calmly, during the postmortem. Trying to find root cause during the incident prolongs the impact.',
      reference: 'Related concept: sre-incident-mgmt — the lifecycle is Detection -> Triage -> Mitigation -> Resolution -> Postmortem.'
    },
    {
      question: 'What is MTTR and what are its components?',
      options: [
        'Mean Time to Resolve — composed of MTTA (acknowledge), MTTI (investigate), and MTTM (mitigate)',
        'Maximum Time to Respond — maximum allowed time',
        'Mean Time to Report — time to report the incident',
        'Minimum Time to Recovery — minimum recovery time'
      ],
      correct: 0,
      explanation: 'MTTR (Mean Time to Resolve) is the average total resolution time, composed of: MTTA (time until someone takes ownership), MTTI (time investigating), and MTTM (time to mitigate/restore). Reducing each component reduces the total MTTR. MTTD (detect) happens before MTTR.',
      reference: 'Related concept: sre-observability — effective monitoring reduces MTTD.'
    },
    {
      question: 'How frequently should updates be sent during a SEV1 incident?',
      options: [
        'Only when there is news',
        'Every 15-30 minutes, even without news, to keep stakeholders informed',
        'Every hour',
        'Only at the beginning and end of the incident'
      ],
      correct: 1,
      explanation: 'Updates should be sent every 15-30 minutes during high-severity incidents, EVEN WITHOUT NEWS. The absence of communication generates anxiety and leads stakeholders to interrupt the response team asking for updates. A simple template like "Still investigating, next update in 15 min" is sufficient.',
      reference: 'Related concept: sre-incident-mgmt — the Communications Lead is responsible for maintaining update cadence.'
    },
    {
      question: 'What is a valid mitigation action during a Kubernetes incident?',
      options: [
        'Refactoring the application code during the incident',
        'Rolling back the deployment to the last stable version',
        'Deleting the namespace and recreating from scratch',
        'Upgrading Kubernetes to the latest version'
      ],
      correct: 1,
      explanation: 'Rollback is a classic mitigation action: fast, safe, and reversible. Refactoring code, deleting namespaces, or upgrading K8s are too risky during an incident. Other valid mitigations: scaling replicas, cordoning problematic nodes, redirecting traffic to another version/region.',
      reference: 'Related concept: sre-incident-mgmt — kubectl rollout undo is the most used rollback command.'
    },
    {
      question: 'What should a postmortem action item contain?',
      options: [
        'Just the action description',
        'Action description, responsible owner, deadline, and priority',
        'Just the responsible person\'s name',
        'Link to the incident ticket'
      ],
      correct: 1,
      explanation: 'Effective action items have 4 elements: clear action description, owner (responsible person), deadline (due date), and priority (P1-P4). Without these elements, action items remain vague and are never executed. Example: "[P1] Implement canary deploy — @sre-team — 2025-02-01".',
      reference: 'Related concept: sre-incident-mgmt — track action items in SLO review meetings.'
    }
  ],
  flashcards: [
    {
      front: 'Incident lifecycle?',
      back: '**6 phases:**\n\n1. **Detection** — alert received\n   (MTTD: < 5 min ideal)\n\n2. **Triage** — define severity\n   (SEV1-SEV4) and impact\n\n3. **Response** — IC declared,\n   bridge call, roles assigned\n\n4. **Mitigation** — restore service\n   (rollback, scale, failover)\n\n5. **Resolution** — permanent fix\n   applied and verified\n\n6. **Postmortem** — document,\n   learn, create action items\n\n**Rule:** mitigate BEFORE investigating root cause'
    },
    {
      front: 'Roles during an incident?',
      back: '**Incident Commander (IC):**\n- Coordinates everything\n- Sets priorities\n- Delegates tasks\n- Does NOT debug\n\n**Communications Lead:**\n- Updates stakeholders\n- Status page\n- External communication\n\n**Operations Lead:**\n- Technical diagnosis\n- Implements mitigation\n- Coordinates SMEs\n\n**Scribe:**\n- Documents timeline\n- Records decisions\n- Collects evidence\n- Prepares postmortem\n\n**Rule:** IC and Communications\nshould NEVER be the same person in SEV1'
    },
    {
      front: 'Severity levels?',
      back: '**SEV1 / P1 — Critical:**\n- Service completely down\n- Immediate response, all-hands\n- Ex: Payment API offline\n\n**SEV2 / P2 — Significant:**\n- Core functionality degraded\n- On-call + backup immediately\n- Ex: Latency 10x above normal\n\n**SEV3 / P3 — Minor:**\n- Secondary functionality affected\n- Next business day\n- Ex: Admin dashboard with error\n\n**SEV4 / P4 — Minimal:**\n- Cosmetic or edge case\n- Normal backlog\n- Ex: Typo in error message'
    },
    {
      front: 'Blameless postmortem template?',
      back: '**Required sections:**\n\n1. **Summary:** date, duration, severity,\n   impact, error budget consumed\n\n2. **Timeline:** detailed chronology\n   (minute by minute)\n\n3. **Root Cause:** technical analysis\n   of what caused the incident\n\n4. **What Went Well:** processes\n   that worked as expected\n\n5. **What Can Improve:** gaps\n   identified\n\n6. **Action Items:** each with:\n   - Clear description\n   - Responsible owner\n   - Deadline\n   - Priority (P1-P4)\n\n**Principle:** focus on the SYSTEM, not people'
    },
    {
      front: 'Incident Management metrics?',
      back: '**MTTD — Mean Time to Detect:**\n- Alert received vs problem start\n- Ideal: < 5 min\n- Improve: monitoring, SLO alerts\n\n**MTTA — Mean Time to Acknowledge:**\n- Someone took ownership\n- Ideal: < 5 min\n- Improve: on-call process\n\n**MTTI — Mean Time to Investigate:**\n- Time spent diagnosing\n- Improve: observability, runbooks\n\n**MTTM — Mean Time to Mitigate:**\n- Service restored (workaround)\n- Ideal: < 30 min for SEV1/2\n- Improve: automatic rollback\n\n**MTTR — Mean Time to Resolve:**\n- MTTR = MTTA + MTTI + MTTM'
    },
    {
      front: 'Quick mitigation commands in K8s?',
      back: '**Rollback:**\n```bash\nkubectl rollout undo deployment/<name>\nkubectl rollout status deployment/<name>\n```\n\n**Scale:**\n```bash\nkubectl scale deploy/<name> --replicas=10\n```\n\n**Isolate node:**\n```bash\nkubectl cordon <node>\nkubectl drain <node> --ignore-daemonsets\n```\n\n**Redirect traffic:**\n```bash\nkubectl patch svc <name> -p \\\n  \'{"spec":{"selector":{"version":"stable"}}}\'\n```\n\n**Verify restoration:**\n```bash\nkubectl get pods -n prod | grep -v Running\nkubectl logs -l app=<name> --since=5m | grep ERROR\n```'
    }
  ],
  lab: {
    scenario: 'A production deployment started generating 5xx errors after a recent deploy. You need to execute the complete incident management process.',
    objective: 'Practice the complete incident cycle: detection, triage, mitigation, resolution, and postmortem documentation.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Detection and Triage',
        instruction: `Simulate incident detection and execute initial triage.

\`\`\`bash
# Check pod state
kubectl get pods -n production -o wide

# Check recent events
kubectl get events -n production --sort-by='.lastTimestamp' | tail -10

# Check logs for errors
kubectl logs -n production -l app=checkout-api --since=10m --tail=50 | grep -i "error\\|fatal\\|panic"

# Check metrics (if Prometheus available)
# curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{code=~"5..",app="checkout-api"}[5m])'

# Define severity based on impact
echo "Triage complete:"
echo "- Service: checkout-api"
echo "- Impact: 5xx errors after deploy v2.3.1"
echo "- Severity: SEV2"
echo "- IC: $(whoami)"
\`\`\``,
        hints: [
          'Triage should be done in less than 5 minutes',
          'Check events, logs, and metrics quickly',
          'Define severity based on user impact, not technical cause'
        ],
        solution: `\`\`\`bash
kubectl get pods -n production -o wide
kubectl get events -n production --sort-by='.lastTimestamp' | tail -10
kubectl logs -n production -l app=checkout-api --since=10m --tail=50 | grep -i "error"
\`\`\``,
        verify: `\`\`\`bash
# Verify you could access cluster information
kubectl get pods -n production 2>/dev/null && echo "Triage: cluster access OK" || echo "Error: no cluster access"

# Verify events are accessible
kubectl get events -n production --sort-by='.lastTimestamp' 2>/dev/null | tail -3
# Expected output: list of recent events
\`\`\``
      },
      {
        title: 'Mitigation — Rollback',
        instruction: `Execute a deployment rollback to restore service quickly.

\`\`\`bash
# Check rollout history
kubectl rollout history deployment/checkout-api -n production

# Execute rollback to previous version
kubectl rollout undo deployment/checkout-api -n production

# Monitor the rollback
kubectl rollout status deployment/checkout-api -n production --timeout=120s

# Verify new pods are running
kubectl get pods -n production -l app=checkout-api -o wide
\`\`\``,
        hints: [
          'rollout undo automatically goes back to the previous revision',
          'Use rollout status to monitor progress',
          'Rollback is the fastest and safest mitigation'
        ],
        solution: `\`\`\`bash
kubectl rollout undo deployment/checkout-api -n production
kubectl rollout status deployment/checkout-api -n production --timeout=120s
\`\`\``,
        verify: `\`\`\`bash
# Verify rollback was executed
kubectl rollout history deployment/checkout-api -n production | tail -3
# Expected output: new revision in the list

# Verify pods running
kubectl get pods -n production -l app=checkout-api --no-headers | grep -c Running
# Expected output: number of configured replicas (e.g., 3)
\`\`\``
      },
      {
        title: 'Verify Restoration',
        instruction: `Confirm the service was restored by checking SLIs and logs.

\`\`\`bash
# Verify no more errors in recent logs
kubectl logs -n production -l app=checkout-api --since=5m | grep -c "ERROR"

# Verify all pods are healthy
kubectl get pods -n production -l app=checkout-api -o jsonpath='{range .items[*]}{.metadata.name} {.status.phase} {.status.containerStatuses[0].ready}{"\n"}{end}'

# Verify service endpoints
kubectl get endpoints checkout-api -n production

# If prometheus available, check SLIs
# curl -s 'http://prometheus:9090/api/v1/query?query=sli:http_requests:availability_rate5m'

echo "Service restored — updating communication"
echo "Status: MITIGATED — rollback to previous version complete"
echo "Monitoring for 30 minutes before closing incident"
\`\`\``,
        hints: [
          'Verify that log errors ceased after rollback',
          'Confirm all pods are Ready',
          'Monitor for at least 15-30 minutes before declaring resolved'
        ],
        solution: `\`\`\`bash
kubectl logs -n production -l app=checkout-api --since=5m | grep -c "ERROR"
kubectl get pods -n production -l app=checkout-api
kubectl get endpoints checkout-api -n production
\`\`\``,
        verify: `\`\`\`bash
# Verify healthy pods
kubectl get pods -n production -l app=checkout-api --no-headers 2>/dev/null | grep -v Running | wc -l
# Expected output: 0 (no pods outside Running)

# Verify endpoints exist
kubectl get endpoints checkout-api -n production 2>/dev/null | grep -v "none"
# Expected output: line with pod IPs
\`\`\``
      },
      {
        title: 'Document Postmortem',
        instruction: `Create a ConfigMap with the incident postmortem template.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: postmortem-2025-01-15
  namespace: production
  labels:
    type: postmortem
    severity: sev2
    service: checkout-api
data:
  postmortem.md: |
    # Postmortem: Checkout API High Error Rate

    ## Summary
    - Date: 2025-01-15
    - Duration: 20 minutes
    - Severity: SEV2
    - Impact: checkout errors for ~30% of users
    - Error budget consumed: 10 minutes

    ## Timeline
    - 14:30 — Deploy v2.3.1 started
    - 14:35 — Burn rate alert fired
    - 14:37 — IC declared
    - 14:40 — Rollback initiated
    - 14:45 — Rollback complete, service restored
    - 14:55 — Monitoring confirms SLIs normal
    - 15:00 — Incident closed

    ## Root Cause
    Version 2.3.1 introduced N+1 query in /checkout

    ## Action Items
    - [P1] Add load test for /checkout — owner TBD — 2025-01-22
    - [P2] Implement canary deploy — owner TBD — 2025-02-01
    - [P2] Add mandatory SQL review — owner TBD — 2025-01-29
EOF
\`\`\``,
        hints: [
          'ConfigMap labels allow searching postmortems by severity or service',
          'The postmortem should be written within the first 48 hours after the incident',
          'Action items must have defined owners and deadlines'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: postmortem-2025-01-15
  namespace: production
  labels:
    type: postmortem
    severity: sev2
data:
  postmortem.md: |
    # Postmortem: Checkout API Error Rate
    ## Root Cause: N+1 query in v2.3.1
    ## Action Items: load test, canary deploy, SQL review
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify postmortem was created
kubectl get cm postmortem-2025-01-15 -n production
# Expected output: NAME                      DATA   AGE
#                   postmortem-2025-01-15    1      Xs

# Verify labels
kubectl get cm postmortem-2025-01-15 -n production -o jsonpath='{.metadata.labels}'
# Expected output: contains type:postmortem and severity:sev2

# List all postmortems
kubectl get cm -n production -l type=postmortem
# Expected output: list of postmortems
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Incident without IC — uncoordinated response',
      difficulty: 'easy',
      symptom: 'A SEV2 incident has been ongoing for 30 minutes but nobody declared IC. Multiple people are investigating different things, there is no clear communication, and stakeholders are asking for status.',
      diagnosis: `\`\`\`bash
# Check who is in the incident channel
# (Check Slack #incidents or bridge call)

# Check if there are duplicate actions
kubectl logs -n production -l app=affected-service --since=30m | tail -20

# Check if rollback or scaling was already done
kubectl rollout history deployment/affected-service -n production
\`\`\``,
      solution: `**Immediate actions:**

1. **Declare yourself IC (or designate someone):**
   "I am the IC for this incident. @person1: communications, @person2: operations."

2. **Stop duplicate work:** Ask each person what they are doing. Redistribute.

3. **Establish communication cadence:** "Updates every 15 minutes in #incident-channel."

4. **Focus on mitigation first:** If the service is still down, rollback or scale before investigating.

5. **Prevention:** Automate IC declaration. Configure Alertmanager to create incident channel automatically and notify on-call with clear instructions.

**IC checklist when taking over:**
- [ ] Declare IC role
- [ ] Assign Communications and Operations
- [ ] Immediate status update
- [ ] Define mitigation strategy
- [ ] Schedule next update`
    },
    {
      title: 'Postmortems not generating improvements',
      difficulty: 'medium',
      symptom: 'The team writes postmortems regularly, but the same types of incidents keep happening. Action items are not executed or are too vague.',
      diagnosis: `\`\`\`bash
# List existing postmortems
kubectl get cm -n production -l type=postmortem --sort-by=.metadata.creationTimestamp

# Check if action items are documented
kubectl get cm -n production -l type=postmortem -o yaml | grep -A2 "Action Items"

# Check recurrence by service
kubectl get cm -n production -l type=postmortem -o jsonpath='{range .items[*]}{.metadata.labels.service}{"\n"}{end}' | sort | uniq -c | sort -rn
\`\`\``,
      solution: `**Solutions:**

1. **SMART action items:** Each action item should be Specific, Measurable, Achievable, Relevant, Time-bound:
   - Bad: "Improve monitoring"
   - Good: "[P1] Add burn rate alert for /checkout with threshold 14.4x — @sre-lead — 2025-02-01"

2. **Weekly action item review:** Include action item review in sprint meetings. Overdue items should be escalated.

3. **Categorize root causes:** Analyze patterns:
   - Many incidents from deploys? -> Improve CI/CD
   - Many from capacity? -> Improve autoscaling
   - Many from dependencies? -> Improve circuit breakers

4. **Effectiveness metrics:** Track:
   - % of action items completed on time
   - Recurrence rate of similar incidents
   - MTTR trend over time

5. **Executive sponsor:** Ensure someone from leadership participates in monthly postmortem reviews.`
    },
    {
      title: 'High MTTD — incidents detected by users',
      difficulty: 'hard',
      symptom: 'Incidents are frequently detected by users (via tickets or complaints) before alerts fire. Average MTTD is over 30 minutes.',
      diagnosis: `\`\`\`bash
# Check alert coverage
kubectl get prometheusrule -n monitoring
kubectl get prometheusrule -n monitoring -o yaml | grep -c "alert:"

# Check if SLO alerts exist
kubectl get prometheusrule -n monitoring -o yaml | grep -i "burnrate\\|slo\\|error.budget"

# Check if all services have ServiceMonitor
kubectl get servicemonitor -n monitoring
kubectl get svc -n production -o name | wc -l

# Check AlertManager routes
kubectl get secret alertmanager-config -n monitoring -o jsonpath='{.data.alertmanager\\.yaml}' | base64 -d | head -20
\`\`\``,
      solution: `**Strategy to reduce MTTD:**

1. **SLO-based alerting:** Implement burn rate alerts that detect degradation before full impact:
\`\`\`yaml
# Burn rate 14.4x detects in ~5 minutes
- alert: SLOBurnRateCritical
  expr: |
    (1 - sli:availability) / (1 - 0.999) > 14.4
  for: 2m
\`\`\`

2. **Complete coverage:** Ensure every critical service has:
   - ServiceMonitor configured
   - SLIs defined (availability + latency)
   - Burn rate alerts

3. **Synthetic monitoring:** Use probes that simulate user actions:
\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: Probe
metadata:
  name: checkout-probe
spec:
  prober:
    url: blackbox-exporter:9115
  targets:
    staticConfig:
      static:
        - https://checkout.example.com/health
\`\`\`

4. **Cascading alerts:** If service A depends on B, alert when B degrades BEFORE A is impacted.

5. **Canary requests:** Send synthetic requests continuously to detect failures before users.`
    }
  ]
};
