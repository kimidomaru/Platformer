window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['sre-operations/sre-toil-automation'] = {
  theory: `
# Toil Elimination & Automation — Reducing Operational Work

## Relevance
Toil is the silent enemy of SRE productivity. Without actively measuring and reducing toil, teams spend more time firefighting than building reliable systems. Progressive automation is the main tool for eliminating toil and scaling operations.

## Core Concepts

### The 5 Characteristics of Toil

\`\`\`
1. MANUAL       — a human executes (not a machine)
2. REPETITIVE   — the same task, multiple times
3. AUTOMATABLE  — a machine could do it
4. NO LASTING VALUE — tactical, not strategic
5. GROWS WITH SERVICE — O(n), not O(1)
\`\`\`

### Toil Targets

\`\`\`
Google SRE:    max 50% of time on toil
Mature teams:  < 30% of time on toil
Remainder:     engineering projects, automation, improvements
\`\`\`

### Measuring Toil

| Method | Description | When to use |
|--------|-------------|-------------|
| **Survey** | Periodic team questionnaire | Monthly/quarterly |
| **Time tracking** | Record time spent on tasks | Continuously |
| **Ticket analysis** | Categorize tickets by type | Monthly review |
| **Interrupt tracking** | Count on-call interrupts | Per shift |

### Automation Pyramid

\`\`\`
         [Self-Healing]         <- system corrects itself
        /              \\
     [Fully Automated]          <- zero human intervention
    /                  \\
  [Semi-Automated]              <- human approves, machine executes
 /                    \\
[Documented]                    <- written runbook
/                      \\
[Manual]                        <- human does everything ad-hoc
\`\`\`

### Automation in Kubernetes

**HPA — Horizontal Pod Autoscaler:**
\`\`\`yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
\`\`\`

**CronJob for operational tasks:**
\`\`\`yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup-old-data
  namespace: production
spec:
  schedule: "0 3 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: cleanup
              image: bitnami/kubectl:latest
              command:
                - /bin/sh
                - -c
                - |
                  kubectl delete pods -n production \\
                    --field-selector=status.phase==Succeeded
          restartPolicy: OnFailure
          serviceAccountName: cleanup-sa
\`\`\`

**Self-healing with probes:**
\`\`\`yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
\`\`\`

**GitOps as toil elimination:**
\`\`\`
Without GitOps (toil):
  1. Dev merges PR
  2. Dev runs kubectl apply manually
  3. Dev checks if deploy worked
  4. Dev notifies the team

With GitOps (automated):
  1. Dev merges PR
  2. ArgoCD detects change automatically
  3. ArgoCD applies change and verifies health
  4. Automatic notification via Slack
\`\`\`

### Automation ROI

\`\`\`
Time saved = frequency x manual_time x period
Cost to automate = dev_hours x hourly_rate

Positive ROI when:
  Time saved > Cost to automate

Rule of thumb:
  If done 5x/day and takes 5 min each:
    5 x 5 = 25 min/day = ~10h/month
    Automate if it costs < 10h of dev time
\`\`\`

## Essential Commands

\`\`\`bash
# HPA
kubectl get hpa -n production
kubectl describe hpa api-hpa -n production
kubectl autoscale deployment api-server --min=3 --max=20 --cpu-percent=70

# CronJobs
kubectl get cronjob -n production
kubectl get jobs -n production --sort-by='.status.startTime'
kubectl create job --from=cronjob/cleanup-old-data manual-cleanup -n production

# Probes / Self-healing
kubectl get pods -n production -o jsonpath='{range .items[*]}{.metadata.name}: restarts={.status.containerStatuses[0].restartCount}{"\\n"}{end}'
kubectl get events -n production --field-selector reason=Unhealthy
\`\`\`

## Common Mistakes

1. **Automating without documenting first**: Document the manual process before automating. Automating a wrong process amplifies errors.
2. **Automating too much too early**: Start with semi-automation (script + approval). Full automation without confidence is risky.
3. **Not measuring toil**: If you don't measure, you don't know if you're improving. Implement toil tracking.
4. **HPA without adequate limits**: HPA without maxReplicas can scale infinitely and cause excessive costs.
5. **CronJobs without monitoring**: Silently failing CronJobs create operational debt. Monitor with alerts.
6. **Ignoring toil because "it's always been this way"**: Accepted toil is the biggest barrier to improvement.
`,
  quiz: [
    {
      question: 'What are the 5 characteristics that define toil?',
      options: [
        'Important, urgent, complex, strategic, innovative',
        'Manual, repetitive, automatable, no lasting value, grows with the service',
        'Fast, easy, simple, cheap, predictable',
        'Technical, operational, administrative, managerial, financial'
      ],
      correct: 1,
      explanation: 'Toil has 5 characteristics: Manual (human executes), Repetitive (same task multiple times), Automatable (machine could do it), No lasting value (tactical, not strategic), and Grows with the service (O(n), not O(1)). If a task has all these characteristics, it is toil.',
      reference: 'Related concept: sre-principles — Google SRE toil target is max 50% of time.'
    },
    {
      question: 'What is the Google SRE target for time spent on toil?',
      options: [
        'Zero toil — all work should be automated',
        'Maximum 50% of time on toil, mature teams stay below 30%',
        'No limit — toil is a natural part of work',
        'Maximum 90% of time on toil'
      ],
      correct: 1,
      explanation: 'Google SRE establishes that at most 50% of time should be spent on toil. The rest should be invested in engineering projects, automation, and improvements. Mature teams keep toil below 30%. If toil exceeds 50%, the team is under-invested.',
      reference: 'Related concept: sre-oncall — very active on-call is a sign of excessive toil.'
    },
    {
      question: 'What are the levels of the automation pyramid, from most basic to most advanced?',
      options: [
        'Script, API, Pipeline, Cloud, Serverless',
        'Manual, Documented, Semi-automated, Fully automated, Self-healing',
        'Dev, Test, Staging, Production, DR',
        'Code, Build, Test, Deploy, Monitor'
      ],
      correct: 1,
      explanation: 'The automation pyramid goes from Manual (ad-hoc, tribal knowledge) -> Documented (written runbook) -> Semi-automated (script + approval) -> Fully automated (CronJob, Operator, zero intervention) -> Self-healing (auto-remediation). Each level eliminates more toil.',
      reference: 'Related concept: sre-toil-automation — start documenting before automating.'
    },
    {
      question: 'What does the HPA behavior field control?',
      options: [
        'Only the maximum number of replicas',
        'The speed and stability of scale-up and scale-down, including stabilization windows and scaling policies',
        'The type of metric used for scaling',
        'The container image to be scaled'
      ],
      correct: 1,
      explanation: 'The HPA behavior field (v2) controls how scaling happens: stabilizationWindowSeconds prevents flapping (rapidly scaling up and down), policies define the speed (e.g., max 50% scale-up per minute, max 10% scale-down). This avoids oscillations and excessive costs.',
      reference: 'Related concept: sre-capacity — HPA is a key tool for automatic capacity planning.'
    },
    {
      question: 'How does GitOps eliminate deployment toil?',
      options: [
        'GitOps has no relation to toil',
        'By automating the push-to-deploy cycle: changes in Git are detected, applied, and verified automatically by ArgoCD/Flux, without manual intervention',
        'By using Git as a manifest backup',
        'By allowing developers direct kubectl access'
      ],
      correct: 1,
      explanation: 'Without GitOps, deployment is toil: running kubectl apply manually, checking status, notifying the team. With GitOps (ArgoCD/Flux), the cycle is automated: merge in Git -> automatic detection -> apply -> health check -> notification. This eliminates deployment toil and ensures consistency.',
      reference: 'Related concept: argocd-architecture — ArgoCD is the most popular GitOps tool for K8s.'
    },
    {
      question: 'When is the ROI of automating a task positive?',
      options: [
        'Always — every task should be automated',
        'When the time saved over time exceeds the development cost of the automation',
        'When the manager authorizes',
        'Never — automation is too expensive'
      ],
      correct: 1,
      explanation: 'ROI is positive when: time_saved (frequency x manual_time x period) > automation_cost (dev_hours x hourly_rate). But also consider: reduction of human errors, consistency, speed, and scalability. A 5-minute task done 5x/day = ~10h/month. If automating costs < 10h, it is worth it.',
      reference: 'Related concept: sre-toil-automation — use the xkcd 1205 rule to decide when to automate.'
    },
    {
      question: 'Which Kubernetes probe is responsible for restarting containers that hang?',
      options: [
        'readinessProbe',
        'startupProbe',
        'livenessProbe — restarts the container when it fails repeatedly',
        'healthProbe'
      ],
      correct: 2,
      explanation: 'livenessProbe checks if the container is alive. If it fails beyond the failureThreshold, the kubelet automatically restarts the container. This is self-healing: it eliminates the toil of manually restarting pods. readinessProbe controls traffic (does not restart). startupProbe protects slow-starting containers.',
      reference: 'Related concept: sre-observability — probes are part of the observability and self-healing strategy.'
    }
  ],
  flashcards: [
    {
      front: 'The 5 characteristics of toil?',
      back: '**1. Manual:** human executes\n**2. Repetitive:** same task, multiple times\n**3. Automatable:** machine could do it\n**4. No lasting value:** tactical, not strategic\n**5. Grows with service:** O(n)\n\n**Targets:**\n- Google SRE: max 50% on toil\n- Mature teams: < 30%\n- Remainder: engineering & automation\n\n**Toil examples:**\n- Manual pod restarts\n- Manual scaling\n- Manual cert rotation\n- Manual log cleanup\n\n**NOT toil:**\n- Writing automation\n- Code review\n- Postmortem'
    },
    {
      front: 'Automation pyramid?',
      back: '**5 levels (base -> top):**\n\n1. **Manual:**\n   Ad-hoc, tribal knowledge\n\n2. **Documented:**\n   Written, reproducible runbook\n\n3. **Semi-automated:**\n   Script + human approval\n   Ex: pipeline with manual gate\n\n4. **Fully automated:**\n   Zero human intervention\n   Ex: CronJob, Operator, CI/CD\n\n5. **Self-healing:**\n   System corrects itself\n   Ex: liveness probe, HPA, auto-restart\n\n**Rule:** go up one level at a time\nDocument before automating'
    },
    {
      front: 'HPA behavior policies?',
      back: '**ScaleUp:**\n```yaml\nbehavior:\n  scaleUp:\n    stabilizationWindowSeconds: 60\n    policies:\n      - type: Percent\n        value: 50\n        periodSeconds: 60\n```\n\n**ScaleDown:**\n```yaml\n  scaleDown:\n    stabilizationWindowSeconds: 300\n    policies:\n      - type: Percent\n        value: 10\n        periodSeconds: 60\n```\n\n**stabilizationWindow:**\nPrevents flapping\n\n**Rule of thumb:**\nScale up fast, scale down slow'
    },
    {
      front: 'Automation ROI — when to automate?',
      back: '**Formula:**\n```\nTime saved =\n  frequency x manual_time x period\n\nCost = dev_hours x hourly_rate\n\nPositive ROI when:\n  Time saved > Cost\n```\n\n**Example:**\n- Task: 5 min, 5x/day\n- Savings: 25 min/day = ~10h/month\n- If automating costs < 10h -> worth it\n\n**Factors beyond time:**\n- Reduced human errors\n- Consistency (machine = always the same)\n- Speed (automation is faster)\n- Scalability (10 or 10,000)\n\n**Rule:** automate what you do\n> 3x/week and takes > 5 min each'
    },
    {
      front: 'Self-healing patterns in K8s?',
      back: '**1. Liveness Probe:**\n- Restarts container if it hangs\n- httpGet, exec, tcpSocket\n\n**2. Readiness Probe:**\n- Removes pod from Service if not ready\n- Prevents traffic to unhealthy pod\n\n**3. HPA:**\n- Scales automatically\n- Based on CPU/mem/custom metrics\n\n**4. PodDisruptionBudget:**\n- Ensures minimum pods during drain\n```yaml\nspec:\n  minAvailable: 2\n```\n\n**5. Anti-affinity:**\n- Distributes pods across nodes\n- Resilience to node failure\n\n**6. Restart policy:**\n- Always (default for Deployments)\n- OnFailure (for Jobs)'
    },
    {
      front: 'GitOps eliminates which toil?',
      back: '**Without GitOps (toil):**\n1. Dev runs kubectl apply manually\n2. Dev checks status manually\n3. Dev notifies team manually\n4. Manual rollback if fails\n\n**With GitOps (automated):**\n1. Dev merges PR\n2. ArgoCD detects change\n3. ArgoCD applies + health check\n4. Automatic notification\n5. Automatic rollback if fails\n\n**Toil eliminated:**\n- Manual deploy\n- Status verification\n- Deploy notification\n- Manual rollback\n- Drift detection\n\n**Tools:** ArgoCD, Flux, Jenkins X'
    }
  ],
  lab: {
    scenario: 'Your team spends 40% of time on repetitive operational tasks: manually scaling pods, cleaning old data, and restarting services that hang. You need to automate these tasks.',
    objective: 'Configure HPA for auto-scaling, CronJob for automatic cleanup, and probes for self-healing.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Configure HPA with Behavior Policies',
        instruction: `Configure an HPA with fast scale-up and conservative scale-down policies.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 15
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 120
EOF
\`\`\``,
        hints: ['Fast scaleUp responds to traffic spikes', 'Slow scaleDown avoids removing pods during temporary fluctuations', 'stabilizationWindowSeconds is the wait time before acting'],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 15
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get hpa api-hpa -n production
# Expected output: NAME      REFERENCE               TARGETS   MINPODS   MAXPODS
#                   api-hpa   Deployment/api-server   ...       3         15
\`\`\``
      },
      {
        title: 'Create CronJob for Automatic Cleanup',
        instruction: `Create a CronJob that automatically cleans up old resources.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup-completed-pods
  namespace: production
spec:
  schedule: "0 4 * * *"
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: cleanup
              image: bitnami/kubectl:latest
              command:
                - /bin/sh
                - -c
                - |
                  echo "Cleaning up completed pods..."
                  kubectl delete pods -n production --field-selector=status.phase==Succeeded --ignore-not-found
                  echo "Cleanup complete"
          restartPolicy: OnFailure
EOF
\`\`\``,
        hints: ['ServiceAccount needs permissions to delete resources', 'successfulJobsHistoryLimit keeps only N completed jobs', 'Use --ignore-not-found to avoid errors when there are no pods to clean'],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup-completed-pods
  namespace: production
spec:
  schedule: "0 4 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: cleanup
              image: bitnami/kubectl:latest
              command: ["/bin/sh", "-c", "kubectl delete pods --field-selector=status.phase==Succeeded -n production"]
          restartPolicy: OnFailure
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get cronjob cleanup-completed-pods -n production
# Expected output: NAME                      SCHEDULE    SUSPEND   ACTIVE
#                   cleanup-completed-pods    0 4 * * *   False     0
\`\`\``
      },
      {
        title: 'Configure Self-Healing with Probes',
        instruction: `Configure complete probes for automatic self-healing.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: self-healing-app
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: self-healing-app
  template:
    metadata:
      labels:
        app: self-healing-app
    spec:
      containers:
        - name: app
          image: nginx:alpine
          ports:
            - containerPort: 80
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: self-healing-pdb
  namespace: production
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: self-healing-app
EOF
\`\`\``,
        hints: ['livenessProbe restarts container if it fails (self-healing)', 'readinessProbe removes pod from traffic if not ready', 'PodDisruptionBudget ensures minimum pods during maintenance'],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: self-healing-app
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: self-healing-app
  template:
    metadata:
      labels:
        app: self-healing-app
    spec:
      containers:
        - name: app
          image: nginx:alpine
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 10
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployment self-healing-app -n production
# Expected output: READY 3/3

kubectl get pdb self-healing-pdb -n production
# Expected output: MIN AVAILABLE: 2
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'HPA not scaling — metrics not available',
      difficulty: 'medium',
      symptom: 'HPA shows "unknown" in TARGETS and does not scale pods, even under high load.',
      diagnosis: `\`\`\`bash
kubectl describe hpa api-hpa -n production
kubectl get pods -n kube-system | grep metrics-server
kubectl top pods -n production
\`\`\``,
      solution: `**Common causes:**

1. **Metrics Server not installed:**
\`\`\`bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
\`\`\`

2. **Container without requests defined:** HPA needs resources.requests to calculate utilization:
\`\`\`yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
\`\`\`

3. **Custom metrics without adapter:** For custom metrics, install prometheus-adapter.`
    },
    {
      title: 'CronJob fails silently',
      difficulty: 'easy',
      symptom: 'Cleanup CronJob is configured but old resources are not being cleaned. No visible errors.',
      diagnosis: `\`\`\`bash
kubectl get jobs -n production --sort-by='.status.startTime' | tail -5
kubectl logs job/\$(kubectl get jobs -n production -o name | tail -1 | cut -d/ -f2) -n production
kubectl auth can-i delete pods -n production --as=system:serviceaccount:production:cleanup-sa
\`\`\``,
      solution: `**Causes and solutions:**

1. **ServiceAccount without permissions:** CronJob needs proper RBAC.

2. **CronJob suspended:**
\`\`\`bash
kubectl patch cronjob cleanup-completed-pods -n production -p '{"spec":{"suspend":false}}'
\`\`\`

3. **Wrong schedule:** Check cron expression (UTC timezone by default).

4. **Job completing but no effect:** Test manually:
\`\`\`bash
kubectl create job --from=cronjob/cleanup-completed-pods test-manual -n production
kubectl logs job/test-manual -n production
\`\`\``
    },
    {
      title: 'Team with 60%+ toil but no budget to automate',
      difficulty: 'hard',
      symptom: 'The SRE team spends 60%+ of time on toil. No engineering budget allocated for automation because the team is always busy with operations.',
      diagnosis: `\`\`\`bash
kubectl get events -A --field-selector type=Warning --sort-by='.lastTimestamp' | wc -l
kubectl get pods -A --field-selector=status.phase!=Running | wc -l
\`\`\``,
      solution: `**Escape strategy:**

1. **Measure and document:** Track toil for 2 weeks with categories. Present concrete data: "We spend X hours/week on Y repetitive tasks."

2. **Quick wins first:** Identify tasks that take < 2h to automate: CronJob for cleanup, HPA for scaling, Probes for self-healing.

3. **20% rule:** Reserve 20% of weekly time for automation, even without formal approval. Quick wins justify the investment.

4. **Calculate ROI:** "Automating X saves Y hours/month. In 3 months, it pays for itself."

5. **Escalate the problem:** If toil > 50% persistently, it's an organizational problem. Escalate to leadership with error budget impact data.

6. **Toil budget:** Negotiate a "toil cap" — if toil > 50%, features stop automatically until toil is reduced.`
    }
  ]
};
