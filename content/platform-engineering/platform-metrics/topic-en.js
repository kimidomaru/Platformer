window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['platform-engineering/platform-metrics'] = {
  theory: `# Platform Metrics: DORA, SPACE & Developer Experience

## Relevance
> Platform engineers must **prove value**: did the platform cut lead time? Increase deploy frequency? Reduce friction? Without metrics you manage by opinion. DORA and SPACE are the two industry-reference frameworks, and they come up in Staff/Principal interviews and in leadership conversations about investing in the platform.

## DORA Metrics — The Industry Standard

Developed by Google's **DORA (DevOps Research and Assessment)** program, these 4 metrics consistently separate high and low performers. The core insight: **speed and stability are NOT a trade-off** — elite teams have both.

| Metric | What it measures | Category | Elite | High | Medium | Low |
|--------|------------------|----------|-------|------|--------|-----|
| **Deployment Frequency** | How often you deploy to production | Throughput | Multiple/day | 1/wk-1/mo | 1/mo-1/6mo | < 6 months |
| **Lead Time for Changes** | From commit to running in production | Throughput | < 1 hour | 1 day-1 wk | 1 wk-1 mo | > 6 months |
| **Change Failure Rate** | % of deploys that cause an incident | Stability | < 5% | 5-10% | 10-15% | > 15% |
| **Time to Restore (MTTR)** | Time to recover from an incident | Stability | < 1 hour | < 1 day | 1 day-1 wk | > 6 months |

> **In 2023 DORA added a 5th metric: Reliability** (how well the service meets user expectations — availability, performance), recognizing that speed without reliability is not sustainable.

### Why these 4?
- **Throughput (DF + LT)** measures how fast value reaches the user.
- **Stability (CFR + MTTR)** measures the quality of the delivery flow.
- Measuring only one side drives bad behavior: optimizing speed alone breeds instability; optimizing stability alone breeds paralysis.

### Collecting DORA with Prometheus
\`\`\`promql
# Deployment Frequency (production deploys in the last 7 days)
sum(increase(deployments_total{environment="production"}[7d]))

# Change Failure Rate (% of deploys that failed)
sum(rate(deployments_total{status="failed",environment="production"}[7d]))
/ sum(rate(deployments_total{environment="production"}[7d])) * 100

# MTTR (avg incident resolution time, in minutes)
avg(incident_resolution_duration_seconds{severity!="low"}) / 60

# Lead Time (P50 of commit -> production time, via pipeline labels)
histogram_quantile(0.5, sum(rate(pipeline_lead_time_seconds_bucket[30d])) by (le))
\`\`\`

Ready-made tools: **DevLake (Apache)**, **Four Keys (Google)**, **dora-metrics exporter**, or **Backstage** itself (DORA plugin). All correlate CI/CD events (deploys) with incidents (PagerDuty/Opsgenie).

## SPACE Framework — Going Beyond DORA

DORA measures the **delivery system**. SPACE (Nicole Forsgren et al., 2021) measures **developer productivity holistically**, recognizing that productivity is not a single dimension. The golden rule: **pick at least 1 metric from 3 different dimensions**, and always combine **perception (surveys)** with **system data**.

| Dimension | What it captures | Example metrics |
|-----------|------------------|-----------------|
| **S — Satisfaction & wellbeing** | How satisfied and healthy devs are | Developer NPS/eNPS, burnout score, retention |
| **P — Performance** | Outcome/quality of work | Change Failure Rate, PR quality, MTTR, SLOs met |
| **A — Activity** | Volume of actions (careful: volume != value) | Commits, PRs, builds, deploys, tickets closed |
| **C — Communication & collaboration** | How the team works together | PR review time, doc discoverability, onboarding time |
| **E — Efficiency & flow** | Ability to flow without interruption | Wait time, WIP, % of deep-work time, handoffs |

### Why NOT to measure Activity alone
Activity (commits/PRs) is the easiest metric to collect and the most dangerous in isolation: a team doing lots of **rework** generates more commits; forcing tiny PRs inflates the PR count. SPACE exists precisely to keep "busy" from being mistaken for "productive". **Activity alone becomes a gameable target** (Goodhart's Law).

## Platform Health & Adoption Metrics

Beyond measuring client teams, the platform must measure its **own health and adoption** (it is a product):
\`\`\`promql
# Adoption rate: % of namespaces using the golden path
count(kube_namespace_labels{label_platform_version!=""})
/ count(kube_namespace_created) * 100

# Self-service success rate (portal templates completing without a ticket)
sum(rate(backstage_scaffold_task_completed_total[7d]))
/ sum(rate(backstage_scaffold_task_created_total[7d])) * 100

# Time to first deploy (median, new dev -> first prod deploy)
histogram_quantile(0.5, sum(rate(onboarding_first_deploy_seconds_bucket[90d])) by (le))

# Manual support tickets against the platform (we want this dropping)
sum(increase(platform_support_tickets_total[30d]))
\`\`\`

### Developer Experience Survey (quarterly)
System metrics do not capture perceived friction. Combine with a short survey (1-5 scale):
\`\`\`yaml
questions:
  - "Can I deploy without depending on another team? (1-5)"
  - "Is my project build time acceptable? (1-5)"
  - "Do I know where to find the documentation I need? (1-5)"
  - "Does the platform help me meet security without friction? (1-5)"
  - "What frustrates you most about the platform today? (open)"
\`\`\`

## Common Mistakes in Platform Metrics
1. **Measuring only activity**: number of commits/PRs does not indicate productivity — more rework = more commits.
2. **Gaming metrics**: once a team knows it is measured by deployment frequency, it starts doing trivial deploys (Goodhart's Law: "when a measure becomes a target, it ceases to be a good measure").
3. **Ignoring the qualitative**: DORA without a developer survey is blind to real day-to-day friction.
4. **No baseline**: before improving, measure where you are. Without a baseline you cannot prove improvement nor justify investment.
5. **Vanity vs actionable**: "10k commits/month" is a vanity metric; "lead time dropped from 3 days to 4 hours" is actionable and tied to business outcome.
6. **Comparing teams against each other**: DORA/SPACE are for a team to measure its **own** evolution over time, not to rank teams (which breeds dysfunction).

## Killer.sh Style Challenge
Leadership wants a dashboard proving the new platform improved delivery. You have Prometheus + Grafana in the cluster. Define: (1) which of the 4 DORA metrics you instrument first and where each event comes from (deploy, incident); (2) one SPACE **perception** metric to complement; (3) one platform **adoption** metric. Implement the PromQL queries and build a panel with baseline (month 0) vs current, defending why each metric is actionable and not vanity.`,
  quiz: [
    {
      question: 'Which of the 4 DORA metrics measure STABILITY (not throughput)?',
      options: [
        'Deployment Frequency and Lead Time for Changes',
        'Change Failure Rate and Time to Restore (MTTR)',
        'Lead Time for Changes and Time to Restore',
        'Deployment Frequency and Change Failure Rate'
      ],
      correct: 1,
      explanation: 'DORA splits the metrics into throughput (Deployment Frequency, Lead Time) and stability (Change Failure Rate, MTTR). The core insight is that elite teams are fast AND stable at once — speed and stability are not a trade-off.',
      reference: 'DORA Metrics table — the Category column separates Throughput from Stability.'
    },
    {
      question: 'A team has a Change Failure Rate of 25%. What does that indicate and which DORA level?',
      options: [
        '25% of deploys fail; Elite level (acceptable for high frequency)',
        '25% of deploys cause a production incident; Low level (above the 15% threshold)',
        '25% of changes arrive late; Medium level',
        'A 25% CFR is acceptable for large teams'
      ],
      correct: 1,
      explanation: 'CFR > 15% is classified as Low. It means 1 in 4 deploys causes an incident requiring a hotfix/rollback — a symptom of missing automated tests, no canary/feature flags, or insufficient review. The Elite target is < 5%.',
      reference: 'DORA Metrics table — ideal CFR < 5% (Elite), Low is > 15%.'
    },
    {
      question: 'Why is measuring only Activity (commits, PRs) insufficient and even dangerous?',
      options: [
        'Because commits and PRs do not appear in JIRA automatically',
        'Because volume is not value: rework generates more commits, and Activity in isolation becomes a gameable target (Goodhart law)',
        'Because activity metrics can only be collected by managers',
        'Because commit-measuring tools are expensive'
      ],
      correct: 1,
      explanation: 'Activity measures volume, not value. A buggy team rewrites code (more commits); forced fine-grained PRs inflate the count. SPACE includes Activity as just 1 of 5 dimensions precisely to avoid mistaking "busy" for "productive".',
      reference: 'SPACE Framework section — Why NOT to measure Activity alone.'
    },
    {
      question: 'What is the recommended practical rule when using the SPACE framework?',
      options: [
        'Measure all 5 dimensions with a single system metric each',
        'Pick at least 1 metric from 3 different dimensions, combining perception (survey) with system data',
        'Use only the Performance dimension, since it encompasses the others',
        'Replace DORA entirely, since SPACE is superior'
      ],
      correct: 1,
      explanation: 'SPACE recommends covering at least 3 different dimensions and always cross-referencing objective data (system) with perception (surveys). It is not about collecting everything, but about avoiding a one-dimensional picture of productivity.',
      reference: 'SPACE Framework section — the golden rule of 3 dimensions + perception.'
    },
    {
      question: 'What does the 5th metric DORA added in 2023, Reliability, capture?',
      options: [
        'How often the team deploys to production',
        'How well the service meets user expectations (availability, performance, SLOs)',
        'Infrastructure cost per deploy',
        'The number of developers per team'
      ],
      correct: 1,
      explanation: 'Reliability measures how well the service meets users operational expectations (availability, latency, SLO attainment). It was added to recognize that delivery throughput and stability are not enough if the service itself is not reliable.',
      reference: 'DORA Metrics section — note on the 5th metric (2023).'
    },
    {
      question: 'What is Goodhart law in the context of platform metrics?',
      options: [
        'The more metrics you collect, the more accurate the evaluation',
        'When a measure becomes a target, it ceases to be a good measure (the team optimizes the number, not the outcome)',
        'Stability metrics always beat speed metrics',
        'The cost of collecting metrics grows linearly with the number of teams'
      ],
      correct: 1,
      explanation: 'Goodhart law explains why gaming metrics is dangerous: turning deployment frequency into a target makes the team do trivial deploys to "hit the number", destroying the metric informational value. That is why metrics should inform conversations, not become isolated targets.',
      reference: 'Common Mistakes section — item 2 (gaming metrics).'
    },
    {
      question: 'For an internal platform (treated as a product), which metric measures ADOPTION in an actionable way?',
      options: [
        'Total number of pods running in the cluster',
        '% of namespaces using the golden path vs total namespaces',
        'CPU consumed by Prometheus',
        'Number of engineers on the platform team'
      ],
      correct: 1,
      explanation: 'Adoption rate (golden-path namespaces / total) shows whether teams actually use the platform. It is actionable: low adoption triggers investigation into friction or missing features. Total pods or Prometheus CPU are vanity metrics that do not measure adoption.',
      reference: 'Platform Health & Adoption Metrics section — adoption rate query.'
    }
  ],
  flashcards: [
    { front: 'What are the 4 DORA metrics and their Elite targets?', back: 'Deployment Frequency (multiple/day), Lead Time for Changes (< 1h), Change Failure Rate (< 5%), Time to Restore/MTTR (< 1h). Throughput = DF+LT; Stability = CFR+MTTR.' },
    { front: 'Are speed and stability a trade-off?', back: 'No. The DORA core finding is that elite teams have both at once — those who ship fast with quality also recover fast. Optimizing only one side degrades the other.' },
    { front: 'What does SPACE stand for and what is the usage rule?', back: 'Satisfaction, Performance, Activity, Communication/collaboration, Efficiency/flow. Rule: pick >=1 metric from 3 different dimensions and combine survey (perception) with system data.' },
    { front: 'Why is Activity alone a bad metric?', back: 'Volume != value. Rework generates more commits; forced fine PRs inflate the count. In isolation it becomes a gameable target (Goodhart law). It is just 1 of the 5 SPACE dimensions.' },
    { front: 'How do you measure the platform impact on DevEx?', back: 'Quantitative: time-to-first-deploy, self-service success rate, adoption rate, falling support tickets. Qualitative: developer NPS, quarterly 1-5 survey, number of workarounds. Combine both.' },
    { front: 'What is Goodhart law and why does it matter for metrics?', back: '"When a measure becomes a target, it ceases to be a good measure." That is why DORA/SPACE should inform conversations and measure a team own evolution over time — never become a gameable target or a cross-team ranking.' }
  ],
  lab: {
    scenario: 'You have a cluster with kube-prometheus-stack (Prometheus + Grafana) installed. Leadership wants to see DORA metrics. You will expose deploy events as metrics, simulate successful and failed deploys, and build the queries that feed a panel.',
    objective: 'Instrument Deployment Frequency and Change Failure Rate from real cluster deploy events, write the PromQL queries, and validate the results in Prometheus.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Install the observability stack (Prometheus + Grafana)',
        instruction: 'Install kube-prometheus-stack via Helm and confirm Prometheus and Grafana are Running. This stack ships an optional Pushgateway for batch/event metrics.',
        hints: ['Helm repo: https://prometheus-community.github.io/helm-charts', 'Enable the pushgateway with --set prometheus-pushgateway.enabled=true', 'kubectl get pods -n monitoring'],
        solution: '```bash\nhelm repo add prometheus-community https://prometheus-community.github.io/helm-charts\nhelm repo update\nhelm install kps prometheus-community/kube-prometheus-stack \\\n  --namespace monitoring --create-namespace \\\n  --set prometheus-pushgateway.enabled=true\n\nkubectl get pods -n monitoring\n```',
        verify: '```bash\nkubectl get pods -n monitoring | grep -E "prometheus|grafana|pushgateway"\n# Expected: prometheus, grafana and pushgateway pods Running\nkubectl get svc -n monitoring | grep pushgateway\n# Expected: pushgateway service (port 9091)\n```'
      },
      {
        title: 'Emit a deploy event as a metric (Deployment Frequency)',
        instruction: 'Use the Pushgateway to record a successful production deploy event as the `deployments_total` metric. In production this would come from your CI/CD pipeline; here you simulate it with curl.',
        hints: ['Pushgateway accepts POST at /metrics/job/<job>', 'Use environment and status labels on the metric', 'port-forward the pushgateway service to localhost:9091'],
        solution: '```bash\nkubectl port-forward -n monitoring svc/kps-prometheus-pushgateway 9091:9091 &\nsleep 3\n\n# Record a SUCCESSFUL production deploy\ncat <<EOF | curl --data-binary @- http://localhost:9091/metrics/job/deploy/env/production/status/success\n# TYPE deployments_total counter\ndeployments_total 1\nEOF\n\n# Check the Pushgateway\ncurl -s http://localhost:9091/metrics | grep deployments_total\n```',
        verify: '```bash\ncurl -s http://localhost:9091/metrics | grep \'deployments_total\'\n# Expected: deployments_total{...environment...status="success"...} 1\n```'
      },
      {
        title: 'Simulate failed deploys and compute Change Failure Rate',
        instruction: 'Record a few more deploys (including a failure) and write the Change Failure Rate PromQL query. Validate the result by querying Prometheus.',
        hints: ['Repeat the push with status/failed for a bad deploy', 'CFR = failed / total * 100', 'Query the Prometheus API at /api/v1/query'],
        solution: '```bash\n# 3 successful deploys + 1 failed\nfor i in 1 2 3; do\n  echo \'deployments_total 1\' | curl --data-binary @- \\\n    http://localhost:9091/metrics/job/deploy/env/production/status/success\ndone\necho \'deployments_total 1\' | curl --data-binary @- \\\n  http://localhost:9091/metrics/job/deploy/env/production/status/failed\n\n# port-forward Prometheus\nkubectl port-forward -n monitoring svc/kps-kube-prometheus-stack-prometheus 9090:9090 &\nsleep 3\n\n# Change Failure Rate query (%)\ncurl -s \'http://localhost:9090/api/v1/query\' --data-urlencode \\\n  \'query=sum(deployments_total{status=\"failed\"}) / sum(deployments_total) * 100\'\n```',
        verify: '```bash\ncurl -s \'http://localhost:9090/api/v1/query\' --data-urlencode \\\n  \'query=sum(deployments_total{status=\"failed\"}) / sum(deployments_total) * 100\' | grep -o \'\"value\".*\'\n# Expected: value close to 25 (1 failure in 4 deploys = 25% CFR)\n```'
      }
    ]
  },
  troubleshooting: [
    {
      title: 'High Deployment Frequency but MTTR also high',
      difficulty: 'medium',
      symptom: 'The team has DF of 5x/day (Elite) but average MTTR of 4 hours (Low). Leadership questions whether speed is causing instability.',
      diagnosis: '```promql\n# Correlate deploys with incidents in the same window\nrate(deployments_total{environment="production"}[1h])\nrate(incidents_created_total[1h])\n\n# Check the Change Failure Rate\nsum(rate(deployments_total{status="failed"}[30d]))\n/ sum(rate(deployments_total[30d])) * 100\n```',
      solution: 'High DF with high MTTR usually means: (1) deploys without canary/feature flags (each deploy hits 100% of users at once), (2) no post-deploy smoke tests (failures take long to detect), (3) slow manual rollback. Actions: implement canary (10% first), automated smoke tests with auto-rollback, a tested rollback runbook (target < 15 min), and an error-rate alert with a threshold to trigger rollback. Goal: keep frequency high AND bring MTTR down to < 1h.'
    },
    {
      title: 'SPACE Activity metrics rise, but devs complain about productivity',
      difficulty: 'medium',
      symptom: 'Commits and PRs per dev went up, but the quarterly developer survey shows falling satisfaction and teams say they are actually slower.',
      diagnosis: '```text\n1. Cross Activity (commits/PRs) with Efficiency & flow (wait time, WIP, review time).\n2. Look at PR size: are PRs getting smaller/more numerous due to process pressure?\n3. Check rework: % of commits that revert/fix recent changes.\n4. Read the survey open responses (qualitative signal of real friction).\n```',
      solution: 'Activity in isolation is misleading (Goodhart law). More commits/PRs may be rework or forced granularity, not more value delivered. Rebalance the SPACE picture: add Efficiency & flow metrics (wait time, WIP) and Performance (CFR, quality), and treat the satisfaction survey as a first-class signal. Stop using Activity as a target; use it only as context. The goal is not more activity, it is more flow with quality.'
    },
    {
      title: 'DORA dashboard with no Lead Time data',
      difficulty: 'hard',
      symptom: 'Deployment Frequency and Change Failure Rate show up on the panel, but Lead Time for Changes is empty or shows absurd values (negative / way too many hours).',
      diagnosis: '```promql\n# Is the lead-time metric being collected?\ncount(pipeline_lead_time_seconds_bucket)\n\n# Are the commit and deploy timestamps correct?\n# Lead time = deploy_time - first_commit_time of the change\nhistogram_quantile(0.5, sum(rate(pipeline_lead_time_seconds_bucket[30d])) by (le))\n```',
      solution: 'Lead Time is the hardest DORA metric to instrument because it requires correlating the **first commit** of a change with the **moment it deploys** to production. Common causes: the pipeline only records the deploy timestamp (no commit one), or uses the merge timestamp instead of the first commit (underestimates), or there is timezone/clock skew (produces negatives). Fix: capture in the pipeline the commit SHA + first-commit timestamp of the PR and the deploy timestamp, compute the difference at deploy time, and export it as a histogram. Tools like DevLake and Four Keys already do this correlation via the Git API + deploy events.'
    }
  ]
};
