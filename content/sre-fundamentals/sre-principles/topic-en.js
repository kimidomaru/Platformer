window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['sre-fundamentals/sre-principles'] = {
  theory: `
# SRE Principles — SLIs, SLOs, SLAs & Error Budgets

## Relevance
Site Reliability Engineering (SRE) is the discipline that applies software engineering to infrastructure operations. Mastering SLIs, SLOs, SLAs, and Error Budgets is essential for any DevOps/SRE professional, as they form the foundation for decisions about reliability, delivery speed, and work prioritization.

## Core Concepts

### What is SRE?

SRE is an approach created by Google for managing production systems at scale. The core principle is: **we treat operations as a software engineering problem**.

\`\`\`
SRE Pillars:
  1. Embrace risk (risk management)
  2. SLOs and Error Budgets as decision metrics
  3. Eliminate toil (repetitive operational work)
  4. Monitoring and observability
  5. Progressive automation
  6. Release engineering
  7. Simplicity
\`\`\`

### SLI — Service Level Indicator

An SLI is a **quantitative metric** that measures an aspect of the service level. It's what you measure.

\`\`\`
SLI = (good events / total events) * 100

Examples:
  Availability: successful requests / total requests
  Latency:      requests < 300ms / total requests
  Throughput:   requests processed per second
  Correctness:  correct responses / total responses
  Freshness:    data updated within < 1min / total queries
\`\`\`

**Common SLIs by service type:**

| Service Type | Primary SLIs |
|-------------|-------------|
| **API/HTTP** | Availability, Latency (p50, p95, p99), Error rate |
| **Data pipeline** | Freshness, Correctness, Throughput |
| **Storage** | Durability, Latency, Availability |
| **Streaming** | Throughput, End-to-end latency |

### SLO — Service Level Objective

An SLO is the **target** you set for an SLI. It's the goal you want to achieve.

\`\`\`
SLO Examples:
  "99.9% of HTTP requests must return 2xx within 30 days"
  "95% of requests must have latency < 300ms (p95)"
  "99.99% of stored data will not be lost"
\`\`\`

**How to define SLOs:**
1. Start with what the user perceives (user journeys)
2. Define SLIs that measure that experience
3. Analyze historical data to establish baselines
4. Set realistic targets (not 100%!)
5. Iterate — SLOs evolve over time

**SLO Window (measurement window):**
\`\`\`
Rolling window:
  - Last 30 days (most common)
  - Last 7 days
  - Last 90 days

Calendar window:
  - Current month
  - Current quarter
\`\`\`

### SLA — Service Level Agreement

An SLA is the **formal contract** with the customer. It has legal/financial consequences if violated.

\`\`\`
Relationship:
  SLI  -> What you measure
  SLO  -> The internal target you set
  SLA  -> The customer contract (SLO + consequences)

Rule of thumb:
  SLA < SLO < Actual capacity

Example:
  SLA: 99.9%  (customer contract)
  SLO: 99.95% (internal goal — safety margin)
  Real: 99.98% (measured capacity)
\`\`\`

### Error Budget

The Error Budget is the **allowed** amount of unavailability derived from the SLO. It's the mechanism that balances reliability and innovation speed.

\`\`\`
Error Budget = 100% - SLO

Example with 99.9% SLO over 30 days:
  Error Budget = 0.1%
  0.1% of 30 days = 43.2 minutes of allowed downtime
  0.1% of 1M requests = 1,000 allowed errors
\`\`\`

**Error Budget table by SLO:**

| SLO | Error Budget (30 days) | Allowed downtime |
|-----|------------------------|-----------------|
| 99% | 1% | ~7.2 hours |
| 99.5% | 0.5% | ~3.6 hours |
| 99.9% | 0.1% | ~43 minutes |
| 99.95% | 0.05% | ~22 minutes |
| 99.99% | 0.01% | ~4.3 minutes |
| 99.999% | 0.001% | ~26 seconds |

**Error Budget Policy — what happens when the budget runs out:**
\`\`\`
Budget > 50%: Normal release pace
Budget 20-50%: Caution — evaluate risk of each release
Budget < 20%:  Partial freeze — critical releases only
Budget = 0%:   Feature freeze — total focus on reliability
\`\`\`

### Toil — Operational Work

Toil is operational work that is manual, repetitive, automatable, without lasting value, and grows with service size.

\`\`\`
Is toil:                        NOT toil:
  Manual pod restarts             Writing automation
  Manual cert rotation            Architecture design
  Manual scaling                  Code review
  Running repetitive runbooks     Capacity planning
  Creating tickets manually       Postmortem and learning
\`\`\`

**Google SRE target: at most 50% of time on toil.** In practice, mature teams stay below 30%.

## Implementing SLOs in Practice

### Step 1: Define SLIs with Prometheus

\`\`\`yaml
# PrometheusRule for availability SLI
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: sli-availability
  namespace: monitoring
spec:
  groups:
    - name: sli.rules
      rules:
        # SLI: successful request rate (non-5xx)
        - record: sli:http_requests:availability
          expr: |
            sum(rate(http_requests_total{code!~"5.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))

        # SLI: p99 latency < 500ms
        - record: sli:http_requests:latency_good
          expr: |
            sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))
            /
            sum(rate(http_request_duration_seconds_count[5m]))
\`\`\`

### Step 2: Calculate consumed Error Budget

\`\`\`yaml
# Recording rule for error budget
- record: slo:error_budget:remaining
  expr: |
    1 - (
      (1 - sli:http_requests:availability)
      /
      (1 - 0.999)
    )
  # Result: 1.0 = 100% of budget remaining
  #         0.0 = budget exhausted
  #        <0.0 = SLO violated
\`\`\`

### Step 3: Alert on Error Budget consumption

\`\`\`yaml
# Alert: error budget being consumed rapidly
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: slo-alerts
  namespace: monitoring
spec:
  groups:
    - name: slo.alerts
      rules:
        # High burn rate — consuming budget too fast
        - alert: ErrorBudgetBurnRateHigh
          expr: |
            (
              1 - (sum(rate(http_requests_total{code!~"5.."}[1h]))
              / sum(rate(http_requests_total[1h])))
            )
            /
            (1 - 0.999)
            > 14.4
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Error budget burn rate is 14.4x — budget will be exhausted in ~2h"

        # Budget nearly exhausted
        - alert: ErrorBudgetNearlyExhausted
          expr: slo:error_budget:remaining < 0.20
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "Less than 20% of error budget remaining"
\`\`\`

## Essential Commands

\`\`\`bash
# Prometheus — query SLIs
# Availability over last 30 days
curl -s 'http://prometheus:9090/api/v1/query?query=avg_over_time(sli:http_requests:availability[30d])'

# Remaining error budget
curl -s 'http://prometheus:9090/api/v1/query?query=slo:error_budget:remaining'

# Kubernetes — check service uptime
kubectl get pods -n production --field-selector=status.phase!=Running
kubectl top pods -n production --sort-by=cpu

# Check recent events (instability indicators)
kubectl get events -n production --sort-by=.lastTimestamp | tail -20

# Availability metrics via kubectl
kubectl get --raw /metrics | grep apiserver_request_total
\`\`\`

## Common Mistakes

1. **Defining SLOs without historical data**: Analyze at least 30 days of metrics before setting targets.
2. **100% SLO**: No system is 100% available. A 100% SLO means zero error budget — impossible to innovate.
3. **Confusing SLO with SLA**: SLO is internal and can be more aggressive. SLA is a contract with financial consequences.
4. **No error budget policy**: Without a clear policy, the error budget has no practical effect on decisions.
5. **Measuring wrong SLIs**: SLIs should reflect user experience, not internal metrics (e.g., CPU is not an SLI).
6. **Too many SLOs**: Start with 2-3 SLOs per service. More than that dilutes focus.

## Killer.sh Style Challenge

**Scenario:** Configure SLOs and Error Budget monitoring for a production service in Kubernetes.

**Tasks:**
1. Define 2 SLIs (availability and latency) as recording rules in Prometheus
2. Calculate the remaining error budget based on a 99.9% SLO
3. Configure burn rate alerts (rapid budget consumption)
4. Create a conceptual dashboard showing SLO compliance
5. Define an error budget policy for the team
`,
  quiz: [
    {
      question: 'What is the correct relationship between SLI, SLO, and SLA?',
      options: [
        'SLA > SLO > SLI — the SLA is broader than the SLO',
        'SLI is the metric, SLO is the target for that metric, SLA is the contract with consequences if the SLO is violated',
        'SLI and SLO are the same thing, and SLA is the contract',
        'SLA defines the metric, SLO defines the target, SLI defines the consequences'
      ],
      correct: 1,
      explanation: 'SLI (Indicator) is the quantitative metric measured (e.g., % of successful requests). SLO (Objective) is the internal target for that SLI (e.g., 99.9%). SLA (Agreement) is the formal contract with the customer, usually with less aggressive SLOs and financial consequences if violated.',
      reference: 'Related concept: sre-principles — the rule of thumb is SLA < SLO < Actual capacity.'
    },
    {
      question: 'If a service has a 99.9% SLO, what is the monthly Error Budget (30 days)?',
      options: [
        '1% = 7.2 hours',
        '0.01% = 4.3 minutes',
        '0.1% = approximately 43 minutes',
        '0.5% = 3.6 hours'
      ],
      correct: 2,
      explanation: 'Error Budget = 100% - SLO = 100% - 99.9% = 0.1%. In 30 days (43,200 minutes), 0.1% = 43.2 minutes of allowed downtime. This means the service can be unavailable for up to ~43 minutes in the month without violating the SLO.',
      reference: 'Related concept: sre-principles — check the Error Budget by SLO table for quick reference.'
    },
    {
      question: 'What is "toil" in the SRE context?',
      options: [
        'All operational work',
        'Manual, repetitive, automatable work without lasting value that grows proportionally with service size',
        'Feature development work',
        'Planning and architecture design work'
      ],
      correct: 1,
      explanation: 'Toil has 5 characteristics: manual, repetitive, automatable, without lasting value (tactical, not strategic), and grows linearly with the service. Examples: manual pod restarts, manual certificate rotation, creating tickets manually. Google SRE target is to keep toil below 50% of time.',
      reference: 'Related concept: sre-toil-automation — dedicated topic on toil elimination strategies.'
    },
    {
      question: 'Why is a 100% SLO problematic?',
      options: [
        'Because Prometheus cannot measure 100%',
        'Because Kubernetes does not support 100% availability',
        'Because the error budget would be zero, making it impossible to release any change without violating the SLO',
        'Because 100% is too easy to achieve'
      ],
      correct: 2,
      explanation: 'With a 100% SLO, the error budget is 0% — any error, no matter how small, violates the SLO. This creates an environment where no changes can be made (permanent feature freeze), since every change carries some risk of error. Realistic SLOs allow a healthy balance between reliability and innovation.',
      reference: 'Related concept: sre-principles — error budget policy defines actions based on remaining budget.'
    },
    {
      question: 'What is burn rate and why is it used in SLO alerts?',
      options: [
        'It is the speed at which the error budget is being consumed; a burn rate of 1 means normal consumption over the SLO window',
        'It is the error rate per second',
        'It is the CPU percentage consumed by the service',
        'It is the speed of deploying new versions'
      ],
      correct: 0,
      explanation: 'Burn rate measures the speed of error budget consumption relative to expected. Burn rate 1 = uniform consumption (budget lasts the entire window). Burn rate 14.4 = budget will be exhausted in ~2 hours. Burn rate-based alerts are more effective than simple error rate alerts.',
      reference: 'Related concept: sre-principles — burn rate alerts are implemented as PrometheusRules.'
    },
    {
      question: 'What is the difference between rolling window and calendar window for SLO measurement?',
      options: [
        'Rolling window is fixed, calendar window is moving',
        'Rolling window uses the last N days continuously (e.g., last 30 days), calendar window uses fixed periods (e.g., current month)',
        'There is no practical difference',
        'Rolling window is for SLAs, calendar window is for SLOs'
      ],
      correct: 1,
      explanation: 'Rolling window always considers the last N days — the calculation changes at every moment. Calendar window resets at the beginning of each period (e.g., 1st of the month). Rolling window is smoother and recommended for internal SLOs; calendar window is more common in contractual SLAs.',
      reference: 'Related concept: sre-principles — most SRE teams use a 30-day rolling window.'
    },
    {
      question: 'Which SLI would be most appropriate for measuring user experience in a REST API service?',
      options: [
        'Pod CPU utilization',
        'Availability (2xx requests / total) and latency (p99 < target)',
        'Total number of running pods',
        'Database disk usage'
      ],
      correct: 1,
      explanation: 'SLIs should reflect the user experience. For a REST API, availability (% of successful requests) and latency (response time) are the most relevant SLIs. CPU, disk, and pod counts are infrastructure metrics useful for troubleshooting but do not directly measure user experience.',
      reference: 'Related concept: sre-observability — SLIs integrate with the service observability strategy.'
    },
    {
      question: 'What should happen when the error budget is fully consumed?',
      options: [
        'Nothing — the error budget is informational only',
        'The service should be shut down automatically',
        'According to the error budget policy, there should be a feature freeze with full focus on reliability improvements',
        'The SLO should be automatically reduced'
      ],
      correct: 2,
      explanation: 'When the error budget is exhausted, the error budget policy takes effect: feature freeze (no new feature deploys), full focus on reliability improvements, and only critical releases (security hotfixes). This ensures the team prioritizes reliability until the budget recovers.',
      reference: 'Related concept: sre-incident-mgmt — incidents consuming error budget should have postmortems.'
    }
  ],
  flashcards: [
    {
      front: 'SLI vs SLO vs SLA — what is the difference?',
      back: '**SLI (Service Level Indicator):**\nQuantitative metric measured\nEx: % successful requests\n\n**SLO (Service Level Objective):**\nInternal target for the SLI\nEx: 99.9% availability over 30 days\n\n**SLA (Service Level Agreement):**\nFormal contract with consequences\nEx: 99.9% or 10% credit\n\n**Rule of thumb:**\nSLA < SLO < Actual capacity\nSLA: 99.9% | SLO: 99.95% | Real: 99.98%'
    },
    {
      front: 'What is Error Budget and how to calculate it?',
      back: '**Formula:**\nError Budget = 100% - SLO\n\n**Example (SLO 99.9%, 30 days):**\n- Budget = 0.1% = 43.2 min of downtime\n- Or: 1,000 errors in 1M requests\n\n**Typical policy:**\n- Budget > 50%: normal releases\n- Budget 20-50%: caution\n- Budget < 20%: critical releases only\n- Budget = 0%: feature freeze\n\n**Burn rate:** consumption speed\n- 1x = normal consumption\n- 14.4x = budget exhausted in ~2h'
    },
    {
      front: 'What is Toil and what is the target?',
      back: '**Definition:** Operational work that is:\n- Manual (human executes)\n- Repetitive (same task multiple times)\n- Automatable (machine could do it)\n- Without lasting value (tactical)\n- Grows with service (O(n))\n\n**Toil examples:**\n- Manual pod restarts\n- Manual cert rotation\n- Manual service scaling\n- Repetitive ticket creation\n\n**Google SRE target:** max 50% time on toil\n**Mature teams:** < 30%'
    },
    {
      front: 'How to implement SLIs with Prometheus?',
      back: '**Recording rule for availability:**\n```\nrecord: sli:http_requests:availability\nexpr: |\n  sum(rate(http_requests_total{code!~"5.."}[5m]))\n  /\n  sum(rate(http_requests_total[5m]))\n```\n\n**Recording rule for latency:**\n```\nrecord: sli:http_requests:latency_good\nexpr: |\n  sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))\n  /\n  sum(rate(http_request_duration_seconds_count[5m]))\n```\n\n**Remaining error budget:**\n```\n1 - ((1 - sli:availability) / (1 - 0.999))\n```'
    },
    {
      front: 'Recommended SLIs by service type?',
      back: '**API/HTTP:**\n- Availability (% 2xx)\n- Latency (p50, p95, p99)\n- Error rate (% 5xx)\n\n**Data pipeline:**\n- Freshness (data updated within < X)\n- Correctness (% correct responses)\n- Throughput (records/second)\n\n**Storage:**\n- Durability (% data not lost)\n- Read/write latency\n- Availability\n\n**Streaming:**\n- Throughput (messages/second)\n- End-to-end latency\n- Message loss rate'
    },
    {
      front: 'Burn rate alerting — how does it work?',
      back: '**Concept:**\nBurn rate = error budget consumption speed\nrelative to expected uniform consumption\n\n**Reference values:**\n- 1x = consumes all budget in the window\n- 14.4x = consumes in ~2h (critical alert)\n- 6x = consumes in ~5h (warning alert)\n- 3x = consumes in ~10h (ticket)\n- 1x = normal pace\n\n**Multi-window approach (Google SRE):**\n```\nalert: short window (1h) + long window (6h)\n  14.4x burn in 1h AND 14.4x in 6h -> page\n  6x burn in 6h AND 6x in 3d -> ticket\n```\n\nAvoids false positives from short spikes.'
    },
    {
      front: 'The 7 pillars of Google SRE?',
      back: '1. **Embrace risk** — use error budgets\n   to balance reliability and velocity\n\n2. **SLOs** — objective reliability metrics\n   as the basis for decisions\n\n3. **Eliminate toil** — automate repetitive\n   work (target: < 50% of time)\n\n4. **Monitoring** — observability with\n   metrics, logs, and traces\n\n5. **Automation** — progressively reduce\n   human intervention\n\n6. **Release engineering** — safe,\n   reproducible, automated deploys\n\n7. **Simplicity** — simpler systems\n   are more reliable'
    }
  ],
  lab: {
    scenario: 'You are the new SRE on a team operating a REST API in Kubernetes. The service has no defined SLOs and the team does not know how much downtime is acceptable.',
    objective: 'Define SLIs and SLOs for the service, calculate error budget, and configure recording rules and alerts in Prometheus.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Recording Rules for SLIs',
        instruction: `Create PrometheusRules with recording rules to measure availability and latency SLIs.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: sli-recording-rules
  namespace: monitoring
  labels:
    release: prometheus
spec:
  groups:
    - name: sli.rules
      interval: 30s
      rules:
        # SLI: Availability (non-5xx requests / total)
        - record: sli:http_requests:availability_rate5m
          expr: |
            sum(rate(http_requests_total{code!~"5.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))

        # SLI: Latency (requests < 500ms / total)
        - record: sli:http_requests:latency_good_rate5m
          expr: |
            sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))
            /
            sum(rate(http_request_duration_seconds_count[5m]))

        # SLI: Availability rolling 30d
        - record: sli:http_requests:availability_30d
          expr: |
            avg_over_time(sli:http_requests:availability_rate5m[30d])
EOF
\`\`\``,
        hints: [
          'Recording rules pre-compute metrics for fast queries',
          'Use rate() with a 5m window to smooth spikes',
          'avg_over_time with [30d] calculates the average over the SLO window'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: sli-recording-rules
  namespace: monitoring
  labels:
    release: prometheus
spec:
  groups:
    - name: sli.rules
      interval: 30s
      rules:
        - record: sli:http_requests:availability_rate5m
          expr: |
            sum(rate(http_requests_total{code!~"5.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))
        - record: sli:http_requests:latency_good_rate5m
          expr: |
            sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))
            /
            sum(rate(http_request_duration_seconds_count[5m]))
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify PrometheusRule was created
kubectl get prometheusrule sli-recording-rules -n monitoring
# Expected output: NAME                    AGE
#                  sli-recording-rules     Xs

# Verify content
kubectl get prometheusrule sli-recording-rules -n monitoring -o jsonpath='{.spec.groups[0].rules[*].record}'
# Expected output: sli:http_requests:availability_rate5m sli:http_requests:latency_good_rate5m sli:http_requests:availability_30d
\`\`\``
      },
      {
        title: 'Configure Error Budget and Burn Rate Alerts',
        instruction: `Create burn rate-based alerts to detect rapid error budget consumption (SLO: 99.9%).

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: slo-burn-rate-alerts
  namespace: monitoring
  labels:
    release: prometheus
spec:
  groups:
    - name: slo.burn-rate
      rules:
        # Remaining error budget (SLO 99.9%)
        - record: slo:availability:error_budget_remaining
          expr: |
            1 - (
              (1 - sli:http_requests:availability_30d)
              /
              (1 - 0.999)
            )

        # Alert: critical burn rate (14.4x = budget exhausted in ~2h)
        - alert: SLOBurnRateCritical
          expr: |
            (
              1 - sli:http_requests:availability_rate5m
            ) / (1 - 0.999) > 14.4
          for: 5m
          labels:
            severity: critical
            slo: availability
          annotations:
            summary: "Critical burn rate: error budget will be exhausted in ~2 hours"
            description: "Service is consuming error budget 14.4x faster than normal"

        # Alert: high burn rate (6x = budget exhausted in ~5h)
        - alert: SLOBurnRateHigh
          expr: |
            (
              1 - sli:http_requests:availability_rate5m
            ) / (1 - 0.999) > 6
          for: 15m
          labels:
            severity: warning
            slo: availability
          annotations:
            summary: "High burn rate: error budget will be exhausted in ~5 hours"
EOF
\`\`\``,
        hints: [
          'Burn rate 14.4 means the 30-day budget will be consumed in ~2 hours',
          'Use "for" to avoid alerts from short spikes',
          'The calculation is: actual error rate / allowed error rate'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: slo-burn-rate-alerts
  namespace: monitoring
  labels:
    release: prometheus
spec:
  groups:
    - name: slo.burn-rate
      rules:
        - record: slo:availability:error_budget_remaining
          expr: |
            1 - ((1 - sli:http_requests:availability_30d) / (1 - 0.999))
        - alert: SLOBurnRateCritical
          expr: |
            (1 - sli:http_requests:availability_rate5m) / (1 - 0.999) > 14.4
          for: 5m
          labels:
            severity: critical
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify PrometheusRule was created
kubectl get prometheusrule slo-burn-rate-alerts -n monitoring
# Expected output: NAME                     AGE
#                  slo-burn-rate-alerts     Xs

# Verify defined alerts
kubectl get prometheusrule slo-burn-rate-alerts -n monitoring -o jsonpath='{.spec.groups[0].rules[*].alert}' | tr ' ' '\\n'
# Expected output:
# SLOBurnRateCritical
# SLOBurnRateHigh
\`\`\``
      },
      {
        title: 'Document Error Budget Policy',
        instruction: `Create a ConfigMap documenting the team's Error Budget Policy.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: error-budget-policy
  namespace: production
  labels:
    team: platform
    type: sre-policy
data:
  policy.md: |
    # Error Budget Policy — API Service

    ## SLO: 99.9% availability (rolling 30 days)
    ## Error Budget: 43.2 minutes/month

    ### Actions by Budget Level:

    **Budget > 50% remaining:**
    - Normal release cadence
    - Feature development proceeds
    - Experiments allowed

    **Budget 20-50% remaining:**
    - Increased review for risky changes
    - No experiments on production
    - Postmortem any incident > 5min

    **Budget < 20% remaining:**
    - Only critical bugfixes and security patches
    - All changes require SRE approval
    - Daily error budget review

    **Budget exhausted (0%):**
    - Complete feature freeze
    - All engineering effort on reliability
    - Executive review required to resume releases

    ## Review: Monthly SLO review meeting
    ## Owner: SRE Team Lead
EOF
\`\`\``,
        hints: [
          'Error budget policies must be clear and agreed upon between SRE and dev',
          'The ConfigMap can be referenced in runbooks and dashboards',
          'Policies should have defined owners and review cadence'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: error-budget-policy
  namespace: production
data:
  policy.md: |
    # Error Budget Policy
    ## SLO: 99.9% availability
    ## Budget: 43.2 min/month
    ## Actions: freeze at 0%, cautious at <20%
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify ConfigMap was created
kubectl get cm error-budget-policy -n production
# Expected output: NAME                   DATA   AGE
#                  error-budget-policy    1      Xs

# Verify content
kubectl get cm error-budget-policy -n production -o jsonpath='{.data.policy\\.md}' | head -5
# Expected output: lines from policy.md
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Error Budget consumed without visible incidents',
      difficulty: 'medium',
      symptom: 'The error budget is being consumed but no incidents have been reported. The team does not understand where the consumption is coming from.',
      diagnosis: `\`\`\`bash
# Check actual error rate
curl -s 'http://prometheus:9090/api/v1/query?query=1-sli:http_requests:availability_rate5m'

# Check which endpoints have the most errors
curl -s 'http://prometheus:9090/api/v1/query?query=topk(5,sum(rate(http_requests_total{code=~"5.."}[1h]))by(handler))'

# Check for intermittent errors
kubectl logs -n production -l app=api-service --since=1h | grep -c "ERROR"

# Check health checks
kubectl get pods -n production -o wide | grep -v Running
\`\`\``,
      solution: `**Common causes:**

1. **Intermittent errors (flapping):** Pods restarting or health checks failing generate short 5xx errors that don't trigger incident alerts but accumulate in the error budget:
\`\`\`bash
# Check restarts
kubectl get pods -n production --sort-by='.status.containerStatuses[0].restartCount'
\`\`\`

2. **Forgotten endpoints:** Deprecated APIs or health endpoints with high call rates may have unmonitored errors. Review all endpoints.

3. **Upstream dependencies:** Errors from upstream services (database timeouts, cache misses) generate 5xx in your service.

4. **Poorly defined SLI:** The SLI may be capturing traffic it shouldn't (e.g., bots, internal health checks). Filter appropriately:
\`\`\`
# Filter health checks from the SLI
sum(rate(http_requests_total{code!~"5..",handler!="/healthz"}[5m]))
\`\`\``
    },
    {
      title: 'SLO defined but no impact on team decisions',
      difficulty: 'easy',
      symptom: 'The team has defined SLOs but they do not influence priority decisions. Releases continue normally even when the error budget is low.',
      diagnosis: `\`\`\`bash
# Check if recording rules exist
kubectl get prometheusrule -n monitoring | grep sli

# Check if SLO alerts exist
kubectl get prometheusrule -n monitoring | grep slo

# Check if error budget dashboard exists
kubectl get cm -n monitoring | grep slo

# Check if error budget policy exists
kubectl get cm -n production | grep budget
\`\`\``,
      solution: `**Required actions:**

1. **Visibility:** Create a prominent error budget dashboard — visible in sprint meetings and stand-ups.

2. **Error Budget Policy:** Document the policy formally with leadership sign-off:
   - Who decides the freeze?
   - What exceptions exist?
   - How to escalate?

3. **Proactive alerts:** Configure burn rate alerts that notify before the budget runs out (20%, 50%).

4. **SLO meetings:** Schedule monthly SLO compliance reviews with product + engineering.

5. **Pipeline integration:** Add error budget gate in CI/CD — automatically block deploy when budget < 20%.

6. **Accountability:** Include SLO compliance in team metrics.`
    },
    {
      title: 'Prometheus recording rules not calculating SLIs',
      difficulty: 'medium',
      symptom: 'Recording rules for SLIs were created but return "no data" or incorrect values in Prometheus.',
      diagnosis: `\`\`\`bash
# Check if PrometheusRule was detected
kubectl get prometheusrule -n monitoring -l release=prometheus

# Check Prometheus logs for config errors
kubectl logs -n monitoring -l app.kubernetes.io/name=prometheus --tail=30 | grep -i "error\\|warn"

# Check if base metrics exist
curl -s 'http://prometheus:9090/api/v1/query?query=http_requests_total' | jq '.data.result | length'

# Check PrometheusRule label
kubectl get prometheusrule sli-recording-rules -n monitoring -o jsonpath='{.metadata.labels}'
\`\`\``,
      solution: `**Causes and solutions:**

1. **Wrong label selector:** The Prometheus Operator uses label selectors to discover PrometheusRules. Check which label is expected:
\`\`\`bash
# See which selector Prometheus uses
kubectl get prometheus -n monitoring -o jsonpath='{.items[0].spec.ruleSelector}'
# Adjust PrometheusRule labels to match
\`\`\`

2. **Base metric does not exist:** If the application does not export \`http_requests_total\`, the recording rule returns "no data":
\`\`\`bash
# List available metrics
curl -s 'http://prometheus:9090/api/v1/label/__name__/values' | jq '.data[]' | grep http
\`\`\`

3. **Wrong namespace:** PrometheusRule must be in the monitored namespace.

4. **Division by zero:** If there is no traffic, the denominator is 0. Use \`or vector(0)\` to protect:
\`\`\`
(sum(rate(http_requests_total{code!~"5.."}[5m])) or vector(0))
/
(sum(rate(http_requests_total[5m])) > 0)
\`\`\``
    }
  ]
};
