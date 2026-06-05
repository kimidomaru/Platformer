window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['platform-engineering/platform-metrics'] = {
  theory: `# Platform Metrics: DORA, SPACE & Developer Experience

## Relevance
> Platform engineers need to measure the platform's impact on team productivity. DORA metrics are the industry standard — they appear in Staff/Principal Engineer interviews and in frameworks such as SPACE and DevOps Research.

## DORA Metrics — The Industry Standard

Developed by DORA (DevOps Research and Assessment), these 4 metrics differentiate high-performing teams:

| Metric | What it measures | Elite | High | Medium | Low |
|--------|-----------------|-------|------|--------|-----|
| **Deployment Frequency** | How often deploys to production | Multiple times/day | 1x/week to 1x/month | 1x/month to 1x/6months | < 6 months |
| **Lead Time for Changes** | From commit to production | < 1 hour | 1 day to 1 week | 1 week to 1 month | > 6 months |
| **Change Failure Rate** | % of deploys that cause an incident | < 5% | 5-10% | 10-15% | > 15% |
| **Time to Restore (MTTR)** | Time to recover from an incident | < 1 hour | < 1 day | 1 day to 1 week | > 6 months |

### Collecting DORA with Prometheus + DORA Metrics Exporter

\`\`\`yaml
# Helm values for dora-metrics exporter
config:
  deploymentFrequency:
    source: github
    repositories:
      - org/repo-frontend
      - org/repo-backend
    branch: main

  leadTime:
    enabled: true
    pipelineIntegration: github-actions

  changeFailureRate:
    incidentSource: pagerduty
    deploymentSource: github
\`\`\`

\`\`\`promql
# DORA: Deployment Frequency (last 7 days)
sum(increase(deployments_total{environment="production"}[7d]))

# DORA: Change Failure Rate
rate(deployments_total{status="failed"}[7d])
/ rate(deployments_total{environment="production"}[7d]) * 100

# DORA: MTTR (average incident resolution time)
avg(incident_resolution_duration_seconds{severity!="low"})
\`\`\`

## SPACE Framework

SPACE is a more comprehensive framework than DORA, covering 5 dimensions:

| Dimension | Example Metrics |
|-----------|----------------|
| **S**atisfaction & wellbeing | Developer NPS, eNPS, burnout scores |
| **P**erformance | Delivery quality, code review velocity |
| **A**ctivity | Commits, PRs, builds, deploy frequency |
| **C**ommunication & collaboration | PR review time, code ownership, team coupling |
| **E**fficiency & flow | Wait time, WIP items, flow efficiency |

## Platform Health Metrics

Beyond DORA, internal platforms need to measure their own health:

\`\`\`promql
# Platform adoption (namespaces using the golden path vs total)
count(kube_namespace_labels{label_platform_version!=""})
/ count(kube_namespace_info) * 100

# Self-service success rate (portal requests that succeeded)
rate(backstage_scaffold_task_completed_total[7d])
/ rate(backstage_scaffold_task_created_total[7d]) * 100

# Cognitive load: how many different tools devs need to access per deploy
# (qualitative metric, collected in periodic survey)

# Average onboarding time for a new dev until first deploy
avg(time_to_first_deploy_seconds)
\`\`\`

### Developer Satisfaction Survey (periodic)

\`\`\`yaml
# Example questions from Developer Experience Survey (quarterly)
questions:
  - "I can deploy without needing help from another team? (1-5)"
  - "My project's build time is acceptable? (1-5)"
  - "I know where to find the documentation I need? (1-5)"
  - "The platform helps me meet security requirements without friction? (1-5)"
  - "What frustrates you most about the platform today? (open)"
\`\`\`

## Common Mistakes in Platform Metrics

1. **Measuring only activity**: number of commits/PRs does not indicate productivity — teams with more rework have more commits.
2. **Gamifying metrics**: teams that know they are measured by deploy frequency start making trivial deploys.
3. **Ignoring qualitative metrics**: DORA without developer survey is incomplete — you can have high deployment frequency with a terrible developer experience.
4. **Not defining a baseline**: before improving, measure where you are. Without a baseline, there is no way to prove improvement.
`,

  quiz: [
    {
      question: 'Which of the 4 DORA metrics measures system stability (not delivery speed)?',
      options: [
        'Deployment Frequency and Lead Time for Changes',
        'Change Failure Rate and Time to Restore (MTTR)',
        'Lead Time for Changes and Time to Restore',
        'Deployment Frequency and Change Failure Rate'
      ],
      correct: 1,
      explanation: 'DORA divides the metrics into two groups: speed (Deployment Frequency, Lead Time for Changes) and stability (Change Failure Rate, Time to Restore/MTTR). Elite teams manage to be both fast AND stable at the same time — contradicting the belief that speed and stability are trade-offs.',
      reference: 'DORA Metrics table — the first two measure throughput, the last two measure stability.'
    },
    {
      question: 'A team has a Change Failure Rate of 25%. What does this indicate and what is the DORA level?',
      options: [
        '25% of deploys fail; Elite level (acceptable for high frequency)',
        '25% of deploys cause production incidents; Low level (below Medium which is 10-15%)',
        '25% of changes arrive late; Medium level',
        'A CFR of 25% is within acceptable range for large teams'
      ],
      correct: 1,
      explanation: 'Change Failure Rate > 15% is classified as Low level in DORA. It means 1 in every 4 deploys causes an incident requiring a hotfix or rollback. This indicates: lack of automated tests, no canary/feature flags, or insufficient code review process. The target for Elite teams is < 5%.',
      reference: 'DORA Metrics table — ideal CFR < 5% (Elite) or 5-10% (High).'
    },
    {
      question: 'Why is measuring only activity metrics (number of commits, merged PRs) insufficient to evaluate development productivity?',
      options: [
        'Because commits and PRs do not automatically appear in JIRA',
        'Because teams with a lot of rework have more commits, masking low quality — activity is not productivity',
        'Because activity metrics are easily manipulated only by managers',
        'Because commit measurement tools are expensive and difficult to implement'
      ],
      correct: 1,
      explanation: 'Activity metrics measure volume, not value. A team may have many commits because it is rewriting buggy code, or many PRs because granularity is too fine by imposition. The SPACE framework emphasizes that productivity is multidimensional: satisfaction + performance + activity + communication + flow efficiency.',
      reference: 'SPACE Framework section — activity (A) is only one of the 5 dimensions.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 4 DORA metrics and what does each measure?',
      back: '1. **Deployment Frequency** — how often you deploy to production (Elite target: multiple times/day)\n\n2. **Lead Time for Changes** — from commit to running in production (Elite target: < 1 hour)\n\n3. **Change Failure Rate** — % of deploys that cause an incident (Elite target: < 5%)\n\n4. **Time to Restore (MTTR)** — average time to recover from an incident (Elite target: < 1 hour)\n\nSpeed: DF + LT | Stability: CFR + MTTR'
    },
    {
      front: 'How do you measure the impact of an internal platform on the developer experience?',
      back: '**Quantitative metrics**:\n- Time to first deploy (new dev → first deploy)\n- Self-service success rate (portal without manual tickets)\n- Platform adoption rate (teams using the golden path)\n- Deployment frequency per team (improved after adopting platform?)\n\n**Qualitative metrics**:\n- Developer NPS (Net Promoter Score)\n- Quarterly developer survey (1-5 per dimension)\n- Support tickets opened about the platform\n- Number of documented "workarounds"\n\n**Rule**: combine quantitative + qualitative for the complete picture.'
    }
  ],

  lab: {
    scenario: 'Create a basic DORA metrics dashboard using Kubernetes cluster metrics.',
    objective: 'Understand how to measure Deployment Frequency and Change Failure Rate using data from the cluster itself.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create deployment metrics with standardized labels',
        instruction: 'Configure deployments with version labels to track changes and failures.',
        hints: ['Labels app.kubernetes.io/version tracks versions', 'Annotation deployment-time for lead time'],
        solution: `\`\`\`bash
# Create demo namespace
kubectl create namespace dora-demo

# Deploy with standardized DORA labels
cat << 'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
  namespace: dora-demo
  labels:
    app: webapp
    app.kubernetes.io/version: "1.2.3"
    team: platform
  annotations:
    deployment.kubernetes.io/timestamp: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    deployment.kubernetes.io/change-id: "pr-456"
spec:
  replicas: 2
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
        version: "1.2.3"
    spec:
      containers:
        - name: webapp
          image: nginx:alpine
EOF

echo "Deploy with DORA labels created"
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployment webapp -n dora-demo \
  -o jsonpath='{.metadata.labels}' | jq .
# Expected: labels with app.kubernetes.io/version

kubectl get deployment webapp -n dora-demo \
  -o jsonpath='{.metadata.annotations}' | jq .
# Expected: annotations with deployment timestamp
\`\`\``
      },
      {
        title: 'Simulate deployment frequency and Change Failure Rate',
        instruction: 'Simulate multiple deploys (successful and failed) and calculate the metrics manually.',
        hints: ['kubectl rollout status with timeout detects failure', 'History with kubectl rollout history'],
        solution: `\`\`\`bash
# Simulate 5 deploys (4 success, 1 failure)
for version in 1.2.4 1.2.5 1.2.6; do
  echo "Deploying version $version..."
  kubectl set image deployment/webapp webapp=nginx:alpine \
    -n dora-demo && \
  kubectl rollout status deployment/webapp -n dora-demo --timeout=60s && \
  echo "Deploy $version: SUCCESS"
done

# Simulate a failed deploy (non-existent image)
kubectl set image deployment/webapp webapp=nginx:nonexistent-tag -n dora-demo
sleep 10
if ! kubectl rollout status deployment/webapp -n dora-demo --timeout=30s; then
  echo "Deploy FAILED - rolling back"
  kubectl rollout undo deployment/webapp -n dora-demo
fi

# View rollout history
kubectl rollout history deployment/webapp -n dora-demo

# Manually calculate Change Failure Rate
echo "Total deploys: 4 | Failed deploys: 1 | CFR: 25% (above ideal!)"

# Cleanup
kubectl delete namespace dora-demo
\`\`\``,
        verify: `\`\`\`bash
kubectl rollout history deployment/webapp -n dora-demo 2>/dev/null || \
  echo "Namespace cleaned - check before deletion"
# Expected: history with multiple revisions
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'DORA metrics show high Deployment Frequency but MTTR is also high',
      difficulty: 'medium',
      symptom: 'The team has a Deployment Frequency of 5x/day (Elite) but an average MTTR of 4 hours (Low). Leadership questions whether the speed is causing instability.',
      diagnosis: `\`\`\`bash
# Correlate deploys with incidents in Prometheus
# Check if incidents occur close to deploys
rate(deployments_total{environment="production"}[1h])
# vs
rate(incidents_created_total[1h])

# Check Change Failure Rate
rate(deployments_total{status="failed"}[30d])
/ rate(deployments_total[30d]) * 100
\`\`\``,
      solution: `**Diagnosis**: high deploy frequency with high MTTR generally indicates:

1. **Deploys without canary/feature flags**: each deploy exposes 100% of users immediately.

2. **No automatic smoke tests post-deploy**: failures take too long to be detected.

3. **Slow rollback process**: manual rollback that takes too long.

**Actions**:
1. Implement canary deployment (expose 10% first)
2. Add automatic smoke tests post-deploy with automatic rollback on failure
3. Define and test rollback runbook (target: < 15 minutes)
4. Configure error rate alerts with threshold < 1% for rollback trigger

**Target**: maintain high deploy frequency AND improve MTTR to < 1 hour.`
    }
  ]
};
