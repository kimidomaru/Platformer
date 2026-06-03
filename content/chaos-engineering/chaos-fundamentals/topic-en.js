window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['chaos-engineering/chaos-fundamentals'] = {
  theory: `
# Chaos Engineering Fundamentals

## Relevance
Chaos Engineering is the discipline of experimenting on distributed systems to build confidence in the system's capability to withstand turbulent conditions in production. In the Kubernetes ecosystem, where pod, node, and network failures are inevitable, chaos engineering validates that resilience mechanisms (replicas, health checks, PDBs, circuit breakers) actually work.

## Core Concepts

### What is Chaos Engineering?

Chaos Engineering is NOT "breaking things in production." It is a scientific approach:

\`\`\`
Chaos Engineering Scientific Method:

1. Define steady state
   → Which metrics indicate the system is healthy?

2. Formulate hypothesis
   → "If we kill a pod, the service continues responding in < 500ms"

3. Introduce variable (controlled failure)
   → Kill pod, inject latency, corrupt network

4. Observe difference
   → Did steady state hold? Was the hypothesis confirmed?

5. Document and fix
   → If it failed, fix it. If it passed, expand the blast radius.
\`\`\`

### Chaos Engineering Principles (Netflix)

\`\`\`
┌──────────────────────────────────────────────────────┐
│           Chaos Engineering Principles               │
│                                                      │
│  1. Build hypothesis around steady state             │
│     → Define measurable normal behavior              │
│                                                      │
│  2. Vary real-world events                           │
│     → Simulate failures that actually happen         │
│     → Crashes, latency, network partitions            │
│                                                      │
│  3. Run experiments in production                    │
│     → Staging does not replicate real behavior        │
│     → Start with small blast radius                  │
│                                                      │
│  4. Automate to run continuously                    │
│     → Chaos as part of CI/CD                         │
│     → Regular Game Days                              │
│                                                      │
│  5. Minimize blast radius                           │
│     → Start small, expand gradually                  │
│     → Have automatic abort mechanism                 │
└──────────────────────────────────────────────────────┘
\`\`\`

### Steady State — Normal Behavior

\`\`\`
Typical Steady State Metrics:

Infrastructure:
  - Pods Running/Ready ratio = 100%
  - Node CPU < 80%
  - Available memory > 20%
  - p99 latency < 500ms

Application:
  - HTTP 5xx error rate < 0.1%
  - Throughput = X req/s (± 10%)
  - Average response time < 200ms
  - Queue depth < threshold

Business:
  - Checkout success rate > 99.5%
  - Orders processed / minute = Y
  - Revenue per minute = Z
\`\`\`

### Blast Radius

\`\`\`
Blast Radius — Impact Scope

Level 1 (Smallest):  1 pod / 1 container
Level 2:             All pods of a Deployment
Level 3:             1 entire node
Level 4:             1 availability zone
Level 5 (Largest):   Entire region / Cluster

Rule: ALWAYS start with the smallest blast radius.
Expand only when the previous level is resilient.

┌─────────────────────────────────────────┐
│           Ideal Progression             │
│                                         │
│  Kill 1 pod ────→ OK                    │
│  Kill N pods ───→ OK                    │
│  Drain 1 node ──→ OK                    │
│  Network delay ─→ OK                    │
│  AZ failure ────→ OK                    │
│  Region failover → OK                   │
│                                         │
│  Each level validates the previous one. │
└─────────────────────────────────────────┘
\`\`\`

### Types of Chaos Experiments

\`\`\`
┌────────────────────┬──────────────────────────────────┐
│ Category           │ Experiments                      │
├────────────────────┼──────────────────────────────────┤
│ Pod/Container      │ - Kill pod                       │
│                    │ - Kill container                  │
│                    │ - CPU stress                      │
│                    │ - Memory stress                   │
│                    │ - Disk fill                       │
├────────────────────┼──────────────────────────────────┤
│ Network            │ - Latency (delay)                │
│                    │ - Packet loss                     │
│                    │ - Network partition               │
│                    │ - DNS failure                     │
│                    │ - Bandwidth throttle              │
├────────────────────┼──────────────────────────────────┤
│ Node/Infra         │ - Node drain                     │
│                    │ - Node shutdown                   │
│                    │ - Clock skew                      │
│                    │ - Disk I/O stress                 │
├────────────────────┼──────────────────────────────────┤
│ Application        │ - HTTP error injection           │
│                    │ - gRPC fault injection            │
│                    │ - Database connection kill        │
│                    │ - Cache invalidation              │
├────────────────────┼──────────────────────────────────┤
│ K8s Platform       │ - etcd leader election           │
│                    │ - API server restart              │
│                    │ - Kubelet restart                  │
│                    │ - CoreDNS failure                 │
└────────────────────┴──────────────────────────────────┘
\`\`\`

### Game Day — Structured Exercise

\`\`\`
Game Day — Planning

Before:
  ☐ Define clear objectives
  ☐ Identify steady state and metrics
  ☐ Prepare rollback runbook
  ☐ Inform stakeholders
  ☐ Ensure observability (dashboards, alerts)
  ☐ Define maximum blast radius
  ☐ Have abort mechanism (kill switch)

During:
  ☐ Monitor metrics in real time
  ☐ Document observations
  ☐ Escalate blast radius gradually
  ☐ Abort if impact exceeds threshold

After:
  ☐ Experiment post-mortem
  ☐ Document findings
  ☐ Create fix tickets
  ☐ Update runbooks
  ☐ Plan next Game Day
\`\`\`

### Chaos Engineering on Kubernetes

\`\`\`
K8s Resilience Mechanisms that Chaos validates:

1. ReplicaSet / Deployment
   Experiment: Kill pod → new pod should come up automatically
   Validation: Desired replicas = current replicas in < 30s

2. Health Checks (liveness/readiness)
   Experiment: Hang application → K8s should restart
   Validation: Pod restarted, service no downtime

3. PodDisruptionBudget (PDB)
   Experiment: Drain node → PDB should prevent quorum loss
   Validation: minAvailable respected during drain

4. Horizontal Pod Autoscaler (HPA)
   Experiment: CPU stress → HPA should scale
   Validation: New pods created, latency stabilizes

5. Pod Anti-Affinity
   Experiment: Kill node → distributed pods survive
   Validation: Service remains available

6. Network Policies
   Experiment: Compromised pod → cannot access other services
   Validation: Network segmentation works

7. Circuit Breaker (Istio/app-level)
   Experiment: Slow backend → circuit breaker opens
   Validation: Requests fail-fast instead of timeout
\`\`\`

### Chaos Tools for Kubernetes

| Tool | Type | Characteristics |
|------|------|----------------|
| LitmusChaos | CNCF | Native CRDs, ChaosHub, workflows, probes |
| Chaos Mesh | CNCF | Native CRDs, web dashboard, physicalmachine chaos |
| Gremlin | SaaS | Enterprise, web interface, free tier |
| Chaos Toolkit | OSS | CLI, extensible, JSON experiments |
| PowerfulSeal | OSS | Interactive + autonomous, policies |
| kube-monkey | OSS | Simple, Netflix Chaos Monkey style |
| Pumba | OSS | Container-level, Docker/containerd |

### Chaos Maturity Model

\`\`\`
Level 0 — Ad Hoc
  - Reactive chaos (incidents teach)
  - No formal practices

Level 1 — Initial
  - Manual experiments in staging
  - Basic pod kill
  - No automation

Level 2 — Managed
  - Chaos tool adopted
  - Documented experiments
  - Quarterly Game Days
  - Coverage: pod kill + network delay

Level 3 — Defined
  - Chaos integrated into CI/CD
  - Automated experiments post-deploy
  - Resilience metrics tracked
  - Monthly Game Days

Level 4 — Optimized
  - Continuous chaos in production
  - Automatic abort based on SLOs
  - Multi-layer failure coverage
  - Resilience culture across the org
\`\`\`

### Resilience Metrics

\`\`\`
Metrics for evaluating Chaos results:

1. MTTR (Mean Time to Recovery)
   Average time to recover from an injected failure
   Target: < 5 minutes for pod failures

2. Recovery Rate
   % of experiments where the system recovered automatically
   Target: > 95%

3. Blast Radius Tolerance
   Largest blast radius supported without SLO impact
   Target: Tolerance for 1 node failure

4. Detection Time
   Time for alerts to fire after failure injection
   Target: < 1 minute

5. Experiment Coverage
   % of critical services with chaos experiments
   Target: > 80% of Tier-1 services
\`\`\`

### Common Mistakes

1. **Chaos without observability** — Without metrics/alerts, chaos is just destruction
2. **Starting with large blast radius** — Always start with the smallest scope possible
3. **Chaos without hypothesis** — Every experiment needs a falsifiable hypothesis
4. **Ignoring negative results** — Failures found by chaos should generate action items
5. **Chaos only in staging** — Staging does not replicate real production behavior
6. **No abort mechanism** — Always have a kill switch to stop the experiment

## Killer.sh Style Challenge

> **Scenario:** Plan a Game Day to validate the resilience of a microservice on Kubernetes. Define: (1) steady state with specific metrics, (2) 3 hypotheses with progressive experiments (pod kill → node drain → network delay), (3) success criteria for each experiment, (4) abort mechanism.
`,
  quiz: [
    {
      question: 'What is the first step in the Chaos Engineering scientific method?',
      options: [
        'Inject failures in production',
        'Define the steady state (measurable normal behavior)',
        'Install chaos tools',
        'Create a Game Day'
      ],
      correct: 1,
      explanation: 'The first step is to define the steady state — metrics that indicate normal system behavior (latency, error rate, throughput). Without this, you cannot tell if the system recovered after the failure.',
      reference: 'Related concept: Steady state can include infrastructure, application, and business metrics.'
    },
    {
      question: 'What is "blast radius" in Chaos Engineering?',
      options: [
        'The cluster size',
        'The impact scope of a chaos experiment (from 1 pod to an entire region)',
        'The number of tools used',
        'The experiment duration'
      ],
      correct: 1,
      explanation: 'Blast radius defines the impact scope: 1 pod, N pods, 1 node, 1 AZ, 1 region. The rule is to always start with the smallest blast radius and expand only when the previous level is validated.',
      reference: 'Related concept: Ideal progression: pod → deployment → node → AZ → region.'
    },
    {
      question: 'Which K8s mechanism does Chaos Engineering validate when killing pods?',
      options: [
        'NetworkPolicy',
        'ReplicaSet/Deployment — new pod should come up automatically',
        'ConfigMap',
        'PersistentVolume'
      ],
      correct: 1,
      explanation: 'When a pod is terminated, the ReplicaSet (via Deployment) detects the discrepancy between desired and current replicas and creates a new pod automatically. Chaos validates that this mechanism works correctly.',
      reference: 'Related concept: PDB (PodDisruptionBudget) protects against simultaneous evictions.'
    },
    {
      question: 'What should happen BEFORE running a chaos experiment?',
      options: [
        'Just inform the DevOps team',
        'Define hypothesis, steady state, blast radius, abort mechanism, and ensure observability',
        'Update the cluster to the latest version',
        'Disable alerts to avoid false positives'
      ],
      correct: 1,
      explanation: 'Before an experiment: define a clear hypothesis, establish steady state with metrics, limit blast radius, prepare abort mechanism (kill switch), and ensure dashboards and alerts are working.',
      reference: 'Related concept: Game Day is the structured format for executing chaos with planning.'
    },
    {
      question: 'What is the difference between Chaos Engineering and stress testing?',
      options: [
        'There is no difference',
        'Chaos Engineering focuses on failures (kill pod, network partition); stress testing focuses on load (high throughput)',
        'Stress testing is more advanced',
        'Chaos Engineering is only for production'
      ],
      correct: 1,
      explanation: 'Stress testing validates behavior under high load. Chaos Engineering validates behavior under unexpected failures (crash, network issues, disk full). They are complementary — a system may handle load but fail with a pod kill.',
      reference: 'Related concept: Chaos + load testing together validate resilience under realistic conditions.'
    },
    {
      question: 'At which Chaos Maturity Model level is chaos integrated into CI/CD?',
      options: [
        'Level 1 (Initial)',
        'Level 3 (Defined) — automated chaos post-deploy and tracked metrics',
        'Level 0 (Ad Hoc)',
        'Level 2 (Managed)'
      ],
      correct: 1,
      explanation: 'At Level 3 (Defined), chaos is integrated into CI/CD with automated experiments after deploy, resilience metrics are tracked, and Game Days happen monthly.',
      reference: 'Related concept: Level 4 (Optimized) has continuous chaos in production with automatic abort based on SLOs.'
    },
    {
      question: 'Why is chaos in staging not enough?',
      options: [
        'Staging is too expensive',
        'Staging does not replicate real production behavior (traffic, data, integrations, scale)',
        'Staging does not support chaos tools',
        'It is not possible to monitor staging'
      ],
      correct: 1,
      explanation: 'Staging does not faithfully replicate production: real traffic, data volume, third-party integrations, specific configurations, and actual scale. Chaos in production (with controlled blast radius) validates real behavior.',
      reference: 'Related concept: Start in staging to learn, but validate in production for real confidence.'
    }
  ],
  flashcards: [
    {
      front: 'What is Chaos Engineering and what is its goal?',
      back: '**Chaos Engineering** is the discipline of experimenting on distributed systems to build resilience confidence.\n\n**Scientific method:**\n1. Define steady state (normal metrics)\n2. Formulate hypothesis\n3. Inject controlled failure\n4. Observe if steady state held\n5. Document and fix\n\n**It is NOT:**\n- Breaking things randomly\n- Stress testing\n- Only in staging\n\n**Goal:**\nDiscover weaknesses BEFORE they cause real incidents.'
    },
    {
      front: 'What is steady state and how to define it?',
      back: '**Steady state** = measurable normal behavior.\n\n**Infrastructure metrics:**\n- Pods Running = 100%\n- CPU < 80%, Mem > 20%\n- p99 latency < 500ms\n\n**Application metrics:**\n- HTTP 5xx < 0.1%\n- Throughput = X req/s (±10%)\n- Response time < 200ms\n\n**Business metrics:**\n- Checkout rate > 99.5%\n- Orders/min = Y\n\n**Rule:** Without defined steady state, chaos is just destruction without learning.'
    },
    {
      front: 'What is blast radius and how to progress?',
      back: '**Blast radius** = impact scope of the experiment.\n\n**Levels (smallest → largest):**\n1. 1 pod / 1 container\n2. All pods of a Deployment\n3. 1 entire node\n4. 1 availability zone\n5. Entire region / Cluster\n\n**Golden rule:**\nALWAYS start at the smallest level.\nExpand only when the previous level is resilient.\n\n**Abort mechanism:**\nHave a kill switch to stop the experiment at any time if impact exceeds threshold.'
    },
    {
      front: 'What types of chaos experiments exist?',
      back: '**Pod/Container:**\n- Kill pod/container\n- CPU/memory stress\n- Disk fill\n\n**Network:**\n- Latency (delay)\n- Packet loss\n- Network partition\n- DNS failure\n\n**Node/Infra:**\n- Node drain/shutdown\n- Clock skew\n- Disk I/O stress\n\n**Application:**\n- HTTP error injection\n- Database connection kill\n- Cache invalidation\n\n**K8s Platform:**\n- etcd leader election\n- API server restart\n- CoreDNS failure'
    },
    {
      front: 'What is a Game Day and how to plan one?',
      back: '**Game Day** = structured chaos exercise.\n\n**Before:**\n- Define objectives and hypotheses\n- Identify steady state and metrics\n- Prepare rollback runbook\n- Inform stakeholders\n- Ensure observability\n- Define max blast radius\n- Have kill switch\n\n**During:**\n- Monitor in real time\n- Document observations\n- Escalate gradually\n- Abort if necessary\n\n**After:**\n- Post-mortem\n- Document findings\n- Create action items\n- Plan next Game Day'
    },
    {
      front: 'Which K8s mechanisms does chaos engineering validate?',
      back: '**1. ReplicaSet/Deployment:**\nKill pod → new pod comes up automatically\n\n**2. Health Checks:**\nApp hangs → K8s restarts via liveness probe\n\n**3. PodDisruptionBudget:**\nDrain node → PDB prevents quorum loss\n\n**4. HPA:**\nCPU stress → HPA scales automatically\n\n**5. Anti-Affinity:**\nKill node → distributed pods survive\n\n**6. Network Policies:**\nCompromised pod → segmentation works\n\n**7. Circuit Breaker:**\nSlow backend → fail-fast instead of timeout'
    },
    {
      front: 'What chaos tools exist for Kubernetes?',
      back: '**CNCF:**\n- LitmusChaos: CRDs, ChaosHub, workflows, probes\n- Chaos Mesh: CRDs, web dashboard, multi-fault\n\n**SaaS:**\n- Gremlin: Enterprise, web interface, free tier\n\n**Open Source:**\n- Chaos Toolkit: CLI, JSON experiments\n- PowerfulSeal: Interactive + autonomous\n- kube-monkey: Netflix Chaos Monkey style\n- Pumba: Container-level\n\n**Choose based on:**\n- Team maturity\n- K8s integration (CRDs vs CLI)\n- Enterprise vs OSS\n- Required failure types'
    }
  ],
  lab: null,
  troubleshooting: [
    {
      title: 'Chaos experiment causes longer downtime than expected',
      difficulty: 'medium',
      symptom: 'After killing 1 pod, the service is unavailable for several minutes instead of recovering in seconds.',
      diagnosis: `\`\`\`bash
# 1. Check if the Deployment has enough replicas
kubectl get deployment my-app -o jsonpath='{.spec.replicas}'
# If replicas=1, there is no redundancy

# 2. Check if readinessProbe is configured
kubectl get deployment my-app -o yaml | grep readinessProbe -A5

# 3. Check app startup time
kubectl describe pod my-app-xxx | grep -E "Started|Pulling|Created"

# 4. Check PDB
kubectl get pdb -o wide

# 5. Check if HPA is configured
kubectl get hpa my-app
\`\`\``,
      solution: `**Causes and solutions:**

1. **Only 1 replica:** Increase replicas to minimum 2 (preferably 3). With 1 replica, any kill causes total downtime.

2. **No readinessProbe:** Without readiness probe, the Service sends traffic to the new pod before it is ready. Configure readinessProbe with adequate initialDelaySeconds.

3. **Slow startup:** If the app takes 60s to start, downtime will be at least 60s. Use startupProbe for slow apps. Optimize startup time.

4. **No PDB:** Create a PodDisruptionBudget with minAvailable to protect against simultaneous disruptions.

5. **Slow image pull:** If the image needs to be downloaded (imagePullPolicy: Always), recovery time increases. Use imagePullPolicy: IfNotPresent and pre-pull images.`
    },
    {
      title: 'Chaos does not reveal problems — false confidence',
      difficulty: 'hard',
      symptom: 'All chaos experiments pass but real incidents keep happening. Chaos is not finding the actual weaknesses.',
      diagnosis: `\`\`\`bash
# 1. Review types of experiments executed
# If only "kill pod", it does not cover network, disk, etc. failures

# 2. Check experiment blast radius
# If always 1 pod, expand to node, AZ

# 3. Check if steady state is well defined
# Superficial metrics (pod count) vs business metrics (orders/min)

# 4. Check service coverage
# If chaos only covers frontend, backend may be fragile

# 5. Analyze real incidents
# What type of failure caused the incident? Did chaos cover this scenario?
\`\`\``,
      solution: `**Causes and solutions:**

1. **Superficial coverage:** Expand experiment types beyond pod kill — include network delay, DNS failure, disk pressure, dependency failure.

2. **Blast radius too small:** If you always test 1 pod, you never discover cascading failure problems. Expand to multi-pod, node drain, AZ failure.

3. **Superficial steady state:** Monitor business metrics (orders/min, checkout rate), not just infrastructure metrics (pod count). A pod can be Running but returning errors.

4. **Missing dependency chaos:** Simulate database failure, cache (Redis), message queue (Kafka), external services. Dependency failures are the most common in production.

5. **Chaos only in staging:** Behavior in staging differs from production. Run chaos in production with controlled blast radius.

6. **Predictable chaos:** If the team knows exactly when chaos will occur, they may be artificially prepared. Run random chaos (Chaos Monkey style) in addition to planned Game Days.`
    }
  ]
};
