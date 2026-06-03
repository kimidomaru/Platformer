window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['app-design-build/workload-resources'] = {
  theory: `
# Jobs, CronJobs & DaemonSets

## Exam Relevance
> These workloads are tested in CKAD (Application Design and Build — 20%). Expect tasks creating Jobs for batch processing, CronJobs for scheduled tasks, and DaemonSets for per-node workloads.

## Jobs

A **Job** creates one or more pods and ensures they complete successfully. Unlike Deployments, pods are NOT restarted after completion.

### Job Completion Modes

| Field | Purpose |
|-------|---------|
| \`completions\` | Total number of pods that must succeed |
| \`parallelism\` | Max pods running simultaneously |
| \`backoffLimit\` | Max retries before marking Job failed |
| \`activeDeadlineSeconds\` | Max time the Job can run |

### Common Job Patterns

\`\`\`yaml
# One-shot job (default: 1 completion, 1 parallel)
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
spec:
  template:
    spec:
      containers:
      - name: migration
        image: myapp
        command: ["python", "migrate.py"]
      restartPolicy: Never    # must be Never or OnFailure (not Always)
  backoffLimit: 3
\`\`\`

\`\`\`yaml
# Parallel job: process 10 items, 3 at a time
spec:
  completions: 10         # run until 10 pods complete
  parallelism: 3          # max 3 running at once
  template:
    spec:
      containers:
      - name: worker
        image: worker
      restartPolicy: OnFailure
  backoffLimit: 4
  activeDeadlineSeconds: 300   # fail after 5 minutes
\`\`\`

### restartPolicy in Jobs

| Value | Behavior |
|-------|---------|
| **Never** | If pod fails, a NEW pod is created (old pod remains for debugging) |
| **OnFailure** | Container is restarted within the same pod |

**Never** creates more pod objects but preserves failure logs. **OnFailure** is cleaner.

### Job Commands

\`\`\`bash
# Create job from command
kubectl create job myjob --image=busybox -- echo "hello world"

# Create job from existing CronJob (manual trigger)
kubectl create job myjob --from=cronjob/my-cronjob

# Watch job completion
kubectl get jobs
kubectl describe job myjob

# Get logs from job pods
kubectl logs job/myjob

# Delete job (also deletes pods)
kubectl delete job myjob
\`\`\`

## CronJobs

A **CronJob** creates Jobs on a schedule (like Linux cron).

\`\`\`yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup
spec:
  schedule: "0 2 * * *"        # 2:00 AM every day
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: backup-tool
            command: ["./backup.sh"]
          restartPolicy: OnFailure
  concurrencyPolicy: Forbid     # don't run if previous job still running
  successfulJobsHistoryLimit: 3 # keep 3 successful job records
  failedJobsHistoryLimit: 1     # keep 1 failed job record
  startingDeadlineSeconds: 60   # if missed, only try for 60s
\`\`\`

### Cron Schedule Format

\`\`\`
┌───────── minute (0 - 59)
│ ┌───────── hour (0 - 23)
│ │ ┌───────── day of month (1 - 31)
│ │ │ ┌───────── month (1 - 12)
│ │ │ │ ┌───────── day of week (0 - 6, Sun=0)
│ │ │ │ │
* * * * *

Examples:
*/5 * * * *       Every 5 minutes
0 * * * *         Every hour
0 0 * * *         Every day at midnight
0 9 * * 1-5       Every weekday at 9 AM
@hourly           Shorthand for "0 * * * *"
\`\`\`

### ConcurrencyPolicy

| Policy | Behavior |
|--------|---------|
| **Allow** (default) | Multiple jobs can run simultaneously |
| **Forbid** | Skip new job if previous is still running |
| **Replace** | Kill previous job, start new one |

### CronJob Commands

\`\`\`bash
# Create CronJob
kubectl create cronjob hello --image=busybox \\
  --schedule="*/5 * * * *" \\
  -- echo "hello"

# List CronJobs and their last schedule
kubectl get cronjob

# Manually trigger a CronJob
kubectl create job manual-run --from=cronjob/hello

# Suspend a CronJob (stop scheduling)
kubectl patch cronjob hello -p '{"spec":{"suspend":true}}'

# Resume
kubectl patch cronjob hello -p '{"spec":{"suspend":false}}'
\`\`\`

## DaemonSets

A **DaemonSet** ensures one pod runs on **every node** (or selected nodes). Use for node-level infrastructure.

### Use Cases

- Log collection agents (Fluentd, Filebeat)
- Monitoring (node-exporter, Datadog agent)
- CNI network plugins
- Storage daemons (Ceph, Longhorn)
- Security agents

\`\`\`yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-collector
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app: log-collector
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
  template:
    metadata:
      labels:
        app: log-collector
    spec:
      tolerations:
      - operator: Exists    # run on ALL nodes including control plane
      containers:
      - name: fluentd
        image: fluentd:latest
        volumeMounts:
        - name: varlog
          mountPath: /var/log
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
\`\`\`

### DaemonSet Commands

\`\`\`bash
# DaemonSets don't have an imperative create command
# Use YAML or generate:
kubectl apply -f daemonset.yaml

# Check how many nodes have the daemonset pod
kubectl get daemonset log-collector
# Shows: DESIRED, CURRENT, READY, UP-TO-DATE, AVAILABLE, NODE SELECTOR

# Describe to see node selection
kubectl describe daemonset log-collector

# Check pods on each node
kubectl get pods -l app=log-collector -o wide
\`\`\`

### DaemonSet on Subset of Nodes

\`\`\`yaml
spec:
  template:
    spec:
      nodeSelector:
        node-type: gpu    # only on GPU nodes
      tolerations:
      - key: "gpu"
        operator: "Exists"
\`\`\`

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Job pod created but keeps failing | restartPolicy: Always (invalid for jobs) | Change to Never or OnFailure |
| CronJob never runs | Wrong schedule format | Verify cron syntax |
| DaemonSet missing control plane | No toleration for control-plane taint | Add \`operator: Exists\` toleration |
| Job pods pile up | backoffLimit too high + no cleanup | Set TTL or delete old jobs |

## Killer.sh Style Challenge

> **Task**: Create a CronJob \`cleanup\` that runs every minute, uses busybox image, and runs command \`echo "cleanup done"\`. Then manually trigger it once and verify the job ran.

\`\`\`bash
kubectl create cronjob cleanup \\
  --image=busybox \\
  --schedule="*/1 * * * *" \\
  -- echo "cleanup done"

kubectl create job manual-cleanup --from=cronjob/cleanup

kubectl get jobs
kubectl logs job/manual-cleanup
\`\`\`
`,
  quiz: [
    {
      question: 'Which restartPolicy values are valid for a Job?',
      options: [
        'Always and OnFailure',
        'Never and OnFailure',
        'Never, OnFailure, and Always',
        'Only Never'
      ],
      correct: 1,
      explanation: 'Jobs must use `Never` or `OnFailure`. Using `Always` would cause the container to restart even on success, making the Job never complete. The default restartPolicy in a Pod is `Always` — you MUST override it in a Job.',
      reference: 'Never: new pod per failure (more logs preserved). OnFailure: restart container in same pod.'
    },
    {
      question: 'A Job has `completions: 5` and `parallelism: 2`. How many pods can run simultaneously?',
      options: [
        '5 pods',
        '2 pods at a time, until 5 complete successfully',
        '10 pods total',
        '2 pods, then sequential'
      ],
      correct: 1,
      explanation: '`parallelism: 2` means at most 2 pods run at the same time. The Job continues until 5 pods complete successfully (completions: 5). If one fails and backoffLimit allows, a new pod starts.',
      reference: 'parallelism controls max concurrent pods. completions controls total success count needed.'
    },
    {
      question: 'What does `concurrencyPolicy: Forbid` mean in a CronJob?',
      options: [
        'The CronJob cannot run more than one job ever',
        'If the previous job is still running when the next schedule fires, the new job is skipped',
        'Jobs from this CronJob are forbidden from using concurrent pod connections',
        'The CronJob is suspended (won\'t run)'
      ],
      correct: 1,
      explanation: 'With `Forbid`, if the previously triggered job hasn\'t finished when the schedule fires again, the new job is skipped. `Allow` (default) creates a new job anyway. `Replace` kills the old job and starts a new one.',
      reference: 'Use Forbid for idempotent batch jobs, Allow for independent jobs, Replace for time-sensitive jobs.'
    },
    {
      question: 'How many pods does a DaemonSet create in a 5-node cluster (3 workers + 2 control plane nodes) by default?',
      options: [
        '3 pods (workers only)',
        '5 pods (all nodes)',
        '2 pods (control plane only)',
        '3 pods, but only if control plane has a NoSchedule taint'
      ],
      correct: 1,
      explanation: 'Without any node selector or tolerations, a DaemonSet schedules one pod on EVERY node that the pod can schedule on. Without tolerations for the control-plane taint, only 3 worker pods would run. WITH the toleration (operator: Exists), all 5 nodes get a pod.',
      reference: 'For system-level DaemonSets: add tolerations: [{operator: Exists}] to run on all nodes.'
    },
    {
      question: 'Which cron expression runs a job at 3:30 AM every Monday?',
      options: [
        '30 3 * * 1',
        '3 30 * * MON',
        '*/30 3 * * 1',
        '30 3 1 * *'
      ],
      correct: 0,
      explanation: 'Format: `minute hour day-of-month month day-of-week`. So `30 3 * * 1` means: minute=30, hour=3, any day, any month, Monday(1). `*/30` means "every 30 minutes" not "at minute 30".',
      reference: 'Cron format: M H DOM MON DOW. Days: 0=Sun, 1=Mon, ... 6=Sat.'
    },
    {
      question: 'You want to manually trigger a CronJob immediately. Which command is correct?',
      options: [
        'kubectl run job --from=cronjob/my-cron',
        'kubectl create job manual --from=cronjob/my-cron',
        'kubectl trigger cronjob my-cron',
        'kubectl apply -f cronjob.yaml --trigger'
      ],
      correct: 1,
      explanation: '`kubectl create job <name> --from=cronjob/<name>` creates a Job from a CronJob\'s jobTemplate, effectively triggering it immediately. This is useful for testing or emergency runs.',
      reference: 'Exam tip: this command appears frequently — memorize it.'
    },
    {
      question: 'A DaemonSet should only run on nodes with label `purpose=logging`. How do you configure this?',
      options: [
        'Set a nodeSelector in the DaemonSet\'s pod template',
        'Add an annotation to the nodes',
        'Set replicas equal to the number of matching nodes',
        'DaemonSets always run on all nodes — you cannot restrict them'
      ],
      correct: 0,
      explanation: 'Adding `nodeSelector: {purpose: logging}` in the pod template (`spec.template.spec.nodeSelector`) restricts the DaemonSet to nodes with that label. You can also use node affinity for more complex matching.',
      reference: 'Also ensure the nodes are labeled: kubectl label node <node> purpose=logging'
    },
    {
      question: 'What is `backoffLimit` in a Job?',
      options: [
        'Maximum time the Job can run',
        'Maximum number of pod failures before the Job is marked as failed',
        'Maximum number of pods that can run in parallel',
        'Maximum number of times a pod can be restarted'
      ],
      correct: 1,
      explanation: '`backoffLimit` sets how many pod failures are tolerated before the Job is marked as Failed. Default is 6. The backoff time between retries doubles each time (exponential backoff: 10s, 20s, 40s...).',
      reference: 'backoffLimit=0 means any failure immediately marks the Job as Failed (no retries).'
    }
  ],
  flashcards: [
    {
      front: 'What is the difference between a Deployment and a Job?',
      back: '**Deployment**: Long-running workloads\n- Pods restart on failure (restartPolicy: Always)\n- Desired state maintained indefinitely\n- Use for: web servers, APIs, databases\n\n**Job**: Batch workloads\n- Pods run to completion (restartPolicy: Never/OnFailure)\n- Job is done when completions are reached\n- Use for: database migrations, data processing, backups\n\nKey: Deployment = "always running". Job = "run until done".'
    },
    {
      front: 'What are the 3 concurrencyPolicy values for a CronJob?',
      back: '| Policy | Action when previous job still running |\n|--------|---------------------------------------|\n| **Allow** (default) | Start a new job anyway |\n| **Forbid** | Skip this run, try again at next schedule |\n| **Replace** | Terminate previous job, start new one |\n\nUse case:\n- Allow: independent tasks\n- Forbid: idempotent batch jobs (can\'t run twice)\n- Replace: time-sensitive tasks (always need latest run)'
    },
    {
      front: 'How do you manually trigger a CronJob?',
      back: '```bash\nkubectl create job <job-name> --from=cronjob/<cronjob-name>\n\n# Example:\nkubectl create job manual-backup --from=cronjob/daily-backup\n\n# Then check:\nkubectl get jobs\nkubectl logs job/manual-backup\n```\n\nThis creates a Job using the CronJob\'s jobTemplate immediately, without waiting for the schedule.'
    },
    {
      front: 'What cron schedule fields order in Kubernetes CronJobs?',
      back: '```\n┌── minute (0-59)\n│ ┌── hour (0-23)\n│ │ ┌── day of month (1-31)\n│ │ │ ┌── month (1-12)\n│ │ │ │ ┌── day of week (0=Sun, 6=Sat)\n│ │ │ │ │\n* * * * *\n```\n\nCommon examples:\n- `*/5 * * * *` — every 5 min\n- `0 2 * * *` — 2 AM daily\n- `0 9 * * 1-5` — 9 AM weekdays\n- `0 0 1 * *` — midnight, 1st of month'
    },
    {
      front: 'What is the purpose of a DaemonSet?',
      back: 'A DaemonSet ensures **exactly one pod runs on each node** (or selected nodes).\n\n**Use cases**:\n- Log collection: Fluentd, Filebeat\n- Monitoring: node-exporter, Datadog\n- CNI plugins: Calico, Cilium\n- Storage: Ceph OSD, Longhorn\n- Security: Falco, AppArmor\n\nWhen a new node is added to the cluster, the DaemonSet automatically creates a pod on it.\n\nWhen a node is removed, the pod is garbage collected.'
    },
    {
      front: 'Why must Jobs set restartPolicy to Never or OnFailure?',
      back: '`restartPolicy: Always` (default for Pods) would restart the container **even on success** — meaning the Job would never complete.\n\n**Never**: On failure, a NEW pod is created\n- Preserves old pod logs for debugging\n- Creates more pod objects\n\n**OnFailure**: On failure, the container restarts in the SAME pod\n- Fewer pod objects\n- Harder to debug (old container logs gone)\n\nExam tip: always explicitly set restartPolicy in Job templates!'
    },
    {
      front: 'How do you run a DaemonSet on ALL nodes including the control plane?',
      back: '**Add a toleration** that matches the control-plane taint:\n```yaml\nspec:\n  template:\n    spec:\n      tolerations:\n      - operator: "Exists"    # tolerate ALL taints\n      # OR specifically:\n      - key: "node-role.kubernetes.io/control-plane"\n        operator: "Exists"\n        effect: "NoSchedule"\n```\n\nWithout this toleration, the DaemonSet skips the control plane node (which has `node-role.kubernetes.io/control-plane:NoSchedule` taint).'
    },
    {
      front: 'What are `successfulJobsHistoryLimit` and `failedJobsHistoryLimit` in CronJobs?',
      back: 'These control how many completed Job objects are retained for history:\n\n```yaml\nspec:\n  successfulJobsHistoryLimit: 3  # keep 3 successful jobs (default)\n  failedJobsHistoryLimit: 1      # keep 1 failed job (default)\n```\n\n- Set to `0` to delete job records immediately\n- Retaining jobs preserves their pod logs for debugging\n- Too many retained jobs can clutter the namespace\n\nCheck history: `kubectl get jobs -l <cronjob-selector>`'
    }
  ],
  lab: {
    scenario: 'Implement batch processing workflows using Jobs and CronJobs, and deploy a node-level monitoring agent using a DaemonSet.',
    objective: 'Create Jobs with different completion patterns, schedule recurring CronJobs, and deploy a DaemonSet.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create a Parallel Job',
        instruction: `Create a Job named **parallel-job** that:
- Uses image \`busybox\`
- Runs command \`echo "processing item"\`
- Must complete **6 times** (completions: 6)
- Runs **2 pods in parallel** (parallelism: 2)
- Has a backoffLimit of 2
- Fails the entire job if not done within 60 seconds

Watch the job progress and verify all 6 completions.`,
        hints: [
          'Use Job spec with completions, parallelism, backoffLimit, activeDeadlineSeconds',
          'restartPolicy must be Never or OnFailure',
          'kubectl get jobs shows COMPLETIONS column',
          'kubectl get pods -l job-name=parallel-job shows individual pods'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: parallel-job
spec:
  completions: 6
  parallelism: 2
  backoffLimit: 2
  activeDeadlineSeconds: 60
  template:
    spec:
      containers:
      - name: worker
        image: busybox
        command: ["sh", "-c", "echo 'processing item'; sleep 2"]
      restartPolicy: Never
EOF

# Watch progress
kubectl get jobs parallel-job -w
kubectl get pods -l job-name=parallel-job
\`\`\``,
        verify: `\`\`\`bash
kubectl get jobs parallel-job
# Expected: COMPLETIONS 6/6, COMPLETE True

kubectl get pods -l job-name=parallel-job
# Expected: 6 pods in Completed state

kubectl logs -l job-name=parallel-job
# Expected: "processing item" output from multiple pods
\`\`\``
      },
      {
        title: 'Create and Trigger a CronJob',
        instruction: `Create a CronJob named **report-generator** that:
- Runs every 5 minutes (\`*/5 * * * *\`)
- Uses image busybox, command: \`date && echo "Report generated"\`
- Uses \`concurrencyPolicy: Forbid\`
- Keeps 3 successful and 1 failed job history

Then manually trigger it once immediately and verify the logs.`,
        hints: [
          'kubectl create cronjob --schedule --image then kubectl edit to add concurrencyPolicy',
          'Or use kubectl apply -f with full YAML',
          'Manually trigger: kubectl create job from-cron --from=cronjob/report-generator',
          'Check output: kubectl logs job/from-cron'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: CronJob
metadata:
  name: report-generator
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: reporter
            image: busybox
            command: ["sh", "-c", "date && echo 'Report generated'"]
          restartPolicy: OnFailure
EOF

# Verify CronJob exists
kubectl get cronjob report-generator

# Manually trigger
kubectl create job manual-report --from=cronjob/report-generator

# Check job and logs
kubectl get jobs | grep manual-report
kubectl logs job/manual-report
\`\`\``,
        verify: `\`\`\`bash
kubectl get cronjob report-generator
# Expected: SCHEDULE */5 * * * *, SUSPEND false, ACTIVE 0

kubectl get job manual-report
# Expected: COMPLETIONS 1/1

kubectl logs job/manual-report
# Expected: current date/time and "Report generated" message

kubectl describe cronjob report-generator | grep "Concurrency Policy:"
# Expected: Forbid
\`\`\``
      },
      {
        title: 'Deploy a DaemonSet for Node Monitoring',
        instruction: `Create a DaemonSet named **node-monitor** in namespace \`monitoring\`:
- Image: busybox
- Command: \`while true; do echo "Node: $NODE_NAME $(date)"; sleep 10; done\`
- Inject the node name as env var \`NODE_NAME\` from the node's metadata
- Include tolerations to run on ALL nodes (including control plane)
- Verify one pod per node`,
        hints: [
          'Use fieldRef to inject node name: valueFrom.fieldRef.fieldPath: spec.nodeName',
          'Toleration: operator: "Exists" matches all taints',
          'DaemonSets require matchLabels in selector matching pod template labels',
          'kubectl get daemonset shows DESIRED vs CURRENT vs READY'
        ],
        solution: `\`\`\`bash
kubectl create namespace monitoring 2>/dev/null || true

cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-monitor
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: node-monitor
  template:
    metadata:
      labels:
        app: node-monitor
    spec:
      tolerations:
      - operator: "Exists"     # run on all nodes including control plane
      containers:
      - name: monitor
        image: busybox
        command:
        - /bin/sh
        - -c
        - while true; do echo "Node: $NODE_NAME $(date)"; sleep 10; done
        env:
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
EOF

kubectl get daemonset node-monitor -n monitoring
kubectl get pods -n monitoring -l app=node-monitor -o wide
\`\`\``,
        verify: `\`\`\`bash
kubectl get daemonset node-monitor -n monitoring
# Expected: DESIRED == CURRENT == READY (number of nodes)

kubectl get pods -n monitoring -l app=node-monitor -o wide
# Expected: one pod per node, all Running

# Check a pod log shows the node name
POD=$(kubectl get pods -n monitoring -l app=node-monitor -o jsonpath='{.items[0].metadata.name}')
kubectl logs -n monitoring $POD | head -3
# Expected: "Node: <node-name> <timestamp>"

kubectl describe daemonset node-monitor -n monitoring | grep "Node-Selector:"
# Expected: <none> (runs on all nodes)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Job never completes — wrong restartPolicy',
      difficulty: 'easy',
      symptom: 'A Job is running but never shows in COMPLETIONS. New pods keep being created. The job seems to run forever.',
      diagnosis: `\`\`\`bash
# Check job status
kubectl get job <name>
# COMPLETIONS column stays at 0

# Check pod status
kubectl get pods -l job-name=<name>
# Pods appear in Running or Completed state but job never marks done

# Check the pod template's restartPolicy
kubectl get job <name> -o yaml | grep restartPolicy
# If: restartPolicy: Always → pods restart on success too!
\`\`\``,
      solution: `The Job's pod template has \`restartPolicy: Always\` (default Pod behavior), which restarts the container even after successful completion. The Job never counts completions.

\`\`\`bash
# Jobs MUST use Never or OnFailure
# Delete the broken job
kubectl delete job <name>

# Re-create with correct restartPolicy
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: <name>
spec:
  template:
    spec:
      containers:
      - name: worker
        image: <image>
        command: [...]
      restartPolicy: Never    ← FIX: was Always
EOF

kubectl get job <name> -w
# Expected: COMPLETIONS 1/1 quickly
\`\`\``
    },
    {
      title: 'DaemonSet shows fewer pods than expected nodes',
      difficulty: 'medium',
      symptom: 'A DaemonSet should run on all 5 nodes, but `kubectl get daemonset` shows DESIRED: 3 instead of 5.',
      diagnosis: `\`\`\`bash
# Check DaemonSet details
kubectl describe daemonset <name>
# Look for: Node-Selector, Tolerations section

# Check which nodes are matched
kubectl get nodes --show-labels
# Compare with DaemonSet's nodeSelector

# Check node taints
kubectl describe nodes | grep Taints
# Control plane nodes have: node-role.kubernetes.io/control-plane:NoSchedule

# Check DaemonSet tolerations
kubectl get daemonset <name> -o yaml | grep -A10 tolerations
\`\`\``,
      solution: `**Case 1: Control plane nodes excluded (missing toleration)**
\`\`\`bash
kubectl edit daemonset <name>
# Add under spec.template.spec:
# tolerations:
# - operator: "Exists"   # tolerate all taints including control-plane

# Verify
kubectl get daemonset <name>
# Expected: DESIRED now matches total node count
\`\`\`

**Case 2: nodeSelector restricts to labeled nodes**
\`\`\`bash
kubectl get daemonset <name> -o yaml | grep nodeSelector -A5
# Example: nodeSelector: {disktype: ssd}

# Option A: Remove nodeSelector (run on all nodes)
kubectl patch daemonset <name> --type=json \\
  -p='[{"op":"remove","path":"/spec/template/spec/nodeSelector"}]'

# Option B: Add the label to more nodes
kubectl label node <node> disktype=ssd
\`\`\``
    }
  ]
};
