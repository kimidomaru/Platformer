window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['troubleshooting/monitoring'] = {
  theory: `# Monitoring & Logging

## Exam Relevance
> Monitoring and logging appear in both CKA and CKAD exams (~13% troubleshooting domain in CKA). You must know how to retrieve logs from pods and containers, check node/pod resource usage with kubectl top, and use kubectl events to understand cluster state. Advanced observability tools (Prometheus, Grafana) are conceptual — not hands-on in the exam.

## The Observability Stack (Conceptual)

\`\`\`
Logs     → What happened? (application output, events)
Metrics  → How is it performing? (CPU, memory, latency)
Traces   → Where did time go? (distributed request flow)
Events   → What did Kubernetes do? (resource state changes)
\`\`\`

## Pod Logs — kubectl logs

\`\`\`bash
# Basic pod logs
kubectl logs <pod-name>

# Logs from specific container (multi-container pod)
kubectl logs <pod-name> -c <container-name>

# Follow logs in real time (-f flag)
kubectl logs <pod-name> -f

# Show last 50 lines
kubectl logs <pod-name> --tail=50

# Show logs since a time period
kubectl logs <pod-name> --since=1h
kubectl logs <pod-name> --since=30m

# Show logs from a previous container run (crash analysis)
kubectl logs <pod-name> --previous
kubectl logs <pod-name> -c <container> --previous

# Logs for ALL pods in a deployment (via label selector)
kubectl logs -l app=myapp --all-containers=true

# Add timestamps to log lines
kubectl logs <pod-name> --timestamps
\`\`\`

## Node and Pod Resource Usage — kubectl top

\`\`\`bash
# Node resource usage
kubectl top nodes
# NAME     CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
# node01   450m         11%    1800Mi          23%

# Pod resource usage (current namespace)
kubectl top pods

# All namespaces
kubectl top pods -A
kubectl top pods --all-namespaces

# Sort by CPU usage
kubectl top pods --sort-by=cpu

# Sort by memory usage
kubectl top pods --sort-by=memory

# Specific pod
kubectl top pod <pod-name>

# With containers breakdown
kubectl top pod <pod-name> --containers
\`\`\`

**Prerequisite**: Metrics Server must be installed for \`kubectl top\` to work.

## Kubernetes Events

Events record state changes and describe **what Kubernetes has done or is trying to do**.

\`\`\`bash
# All events in current namespace
kubectl get events

# All events cluster-wide
kubectl get events -A

# Events for a specific resource
kubectl describe pod <pod-name>  # Events section at the bottom

# Sort events by time (most recent first)
kubectl get events --sort-by='.lastTimestamp'

# Filter by type (Warning events only)
kubectl get events --field-selector type=Warning

# Filter for a specific resource
kubectl get events --field-selector involvedObject.name=<pod-name>

# Watch events in real time
kubectl get events -w
\`\`\`

## Reading Events: Normal vs Warning

\`\`\`
LAST SEEN   TYPE      REASON              OBJECT           MESSAGE
5m          Normal    Scheduled           Pod/myapp        Successfully assigned to node01
5m          Normal    Pulling             Pod/myapp        Pulling image "myapp:v2"
4m          Normal    Pulled              Pod/myapp        Successfully pulled image
4m          Normal    Created             Pod/myapp        Created container
4m          Normal    Started             Pod/myapp        Started container
2m          Warning   BackOff             Pod/myapp        Back-off restarting failed container
1m          Warning   OOMKilling          Pod/myapp        OOM kill: memory limit exceeded
\`\`\`

## Container Runtime Debugging with crictl

For nodes where the container runtime needs direct inspection:

\`\`\`bash
# SSH to the node first
ssh node01

# List running containers
crictl ps

# List all containers (including stopped)
crictl ps -a

# Container logs
crictl logs <container-id>

# Container details
crictl inspect <container-id>

# List pods known to the runtime
crictl pods

# Image list
crictl images
\`\`\`

## Metrics Server and Resource Monitoring

\`\`\`bash
# Check Metrics Server status
kubectl get pods -n kube-system | grep metrics-server

# Verify metrics work
kubectl top nodes
kubectl top pods -A

# If metrics-server is not installed:
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
\`\`\`

## Application Performance Analysis

\`\`\`bash
# Find the most CPU-hungry pod
kubectl top pods -A --sort-by=cpu | head -10

# Find the most memory-hungry pod
kubectl top pods -A --sort-by=memory | head -10

# Find nodes under pressure
kubectl top nodes
# High CPU% or Memory% → potential scheduling issues

# Check node conditions for resource pressure
kubectl describe node <node-name> | grep -A5 Conditions
# Look for: DiskPressure, MemoryPressure, PIDPressure = True
\`\`\`

## Prometheus & Grafana (Conceptual)

In production, monitoring uses:
- **Prometheus**: Time-series metrics database. Scrapes endpoints via \`/metrics\`
- **Grafana**: Visualization. Dashboards for cluster health
- **AlertManager**: Sends alerts when thresholds are exceeded
- **kube-state-metrics**: Exposes Kubernetes object state as Prometheus metrics
- **node-exporter**: Exposes node hardware/OS metrics

\`\`\`bash
# Access Prometheus (if installed via kube-prometheus-stack)
kubectl get svc -n monitoring
kubectl port-forward svc/prometheus-operated 9090:9090 -n monitoring

# Access Grafana
kubectl port-forward svc/grafana 3000:80 -n monitoring
\`\`\`

## Log Aggregation (Conceptual)

Production log collection pattern:
\`\`\`
Pods (stdout/stderr)
  → DaemonSet log collector (Fluentd/Fluent Bit)
  → Log aggregation (Elasticsearch, Loki)
  → Visualization (Kibana, Grafana)
\`\`\`

\`\`\`bash
# In the exam: application logs go to stdout/stderr
# Access via kubectl logs, NOT file system

# A container writing logs to a file (anti-pattern):
# Use a sidecar to tail the file and write to stdout
# OR configure the app to log to stdout
\`\`\`

## Common Errors

1. **kubectl top not working** — Metrics Server not installed
2. **kubectl logs "container not found"** — wrong container name; use \`-c\` with exact name from \`kubectl get pod -o yaml\`
3. **Events disappear** — events are kept for ~1 hour by default in the cluster
4. **No previous logs** — container never restarted; \`--previous\` only works with restarted containers
5. **OOMKilled shown in events** — memory limit too low; increase in resources.limits.memory

## Killer.sh Style Challenge

**Task**:
1. Find which pod in namespace \`production\` is consuming the most CPU
2. Show the last 100 lines of logs from that pod, with timestamps
3. Find all Warning events in the cluster from the last 10 minutes
4. Check if any nodes are under memory pressure
`,
  quiz: [
    {
      question: 'How do you view logs from a container that has already crashed and restarted?',
      options: [
        'kubectl logs <pod> --crashed',
        'kubectl logs <pod> --previous',
        'kubectl describe pod <pod> | grep Logs',
        'kubectl exec <pod> -- cat /var/log/app.log'
      ],
      correct: 1,
      explanation: 'The --previous flag retrieves logs from the previous container run (before the restart). Without --previous, kubectl logs shows the current run, which starts empty after a restart. Essential for debugging CrashLoopBackOff.',
      reference: 'Pod Logs section — "kubectl logs <pod> --previous" for crash analysis.'
    },
    {
      question: 'What must be installed for kubectl top pods to work?',
      options: [
        'Prometheus and Grafana',
        'The Metrics Server',
        'The kube-state-metrics DaemonSet',
        'The resource-quota controller'
      ],
      correct: 1,
      explanation: 'kubectl top relies on the Metrics Server, which collects real-time resource metrics from kubelets. Without it, kubectl top returns "error: metrics not available". Prometheus is for historical/long-term metrics.',
      reference: 'Node and Pod Resource Usage section — Prerequisites: Metrics Server.'
    },
    {
      question: 'Which kubectl command shows events ONLY for a specific pod?',
      options: [
        'kubectl events --pod=<name>',
        'kubectl get events --field-selector involvedObject.name=<pod-name>',
        'kubectl describe events <pod-name>',
        'kubectl logs <pod-name> --events'
      ],
      correct: 1,
      explanation: 'kubectl get events --field-selector involvedObject.name=<name> filters events for a specific resource. Alternatively, kubectl describe pod <name> includes events at the bottom of the output.',
      reference: 'Kubernetes Events section in theory.'
    },
    {
      question: 'How do you stream pod logs in real time?',
      options: [
        'kubectl watch logs <pod>',
        'kubectl logs <pod> --live',
        'kubectl logs <pod> -f',
        'kubectl logs <pod> --stream'
      ],
      correct: 2,
      explanation: 'The -f flag (--follow) streams logs continuously, similar to "tail -f". New log lines appear as the application generates them. Press Ctrl+C to stop following.',
      reference: 'Pod Logs section — kubectl logs <pod> -f'
    },
    {
      question: 'A pod shows OOMKilling in its events. What does this mean and how do you fix it?',
      options: [
        'The pod is trying to use too many file handles; increase the ulimit',
        'The pod exceeded its memory limit and was killed by the kernel OOM killer; increase memory limits',
        'The pod disk is full; expand the PersistentVolume',
        'The pod has too many processes; increase PID limits'
      ],
      correct: 1,
      explanation: 'OOMKill (Out Of Memory Kill) occurs when a container exceeds its memory limit. The Linux kernel kills the process. Fix: increase resources.limits.memory, or optimize memory usage in the application.',
      reference: 'Events section — OOMKilling shown in warning events.'
    },
    {
      question: 'How do you find the pod consuming the most CPU in all namespaces?',
      options: [
        'kubectl get pods -A --cpu',
        'kubectl top pods -A --sort-by=cpu',
        'kubectl describe nodes | grep CPU',
        'kubectl metrics pods --by=cpu'
      ],
      correct: 1,
      explanation: '"kubectl top pods -A --sort-by=cpu" sorts all pods across all namespaces by CPU consumption, showing the highest consumers first. Add "| head -5" to limit output.',
      reference: 'Application Performance Analysis section in theory.'
    },
    {
      question: 'What does kubectl get events --field-selector type=Warning show?',
      options: [
        'All events from the Warning severity class',
        'Only Warning-type events (issues, failures) — excluding Normal events',
        'Events from the last 24 hours only',
        'Events from Warning resources (Pods in Warning state)'
      ],
      correct: 1,
      explanation: 'Events have two types: Normal (routine operations) and Warning (potential issues, failures, errors). Filtering by type=Warning shows only problematic events, making it easier to spot issues in a noisy cluster.',
      reference: 'Kubernetes Events section — field-selector for Warning events.'
    },
    {
      question: 'What does crictl ps -a show that kubectl get pods does not?',
      options: [
        'Pods in all namespaces including kube-system',
        'Container-level information including stopped containers, regardless of pod state',
        'Historical pod data from the past 24 hours',
        'Container images and their sizes'
      ],
      correct: 1,
      explanation: 'crictl operates at the container runtime level (CRI), not the Kubernetes API level. It shows all containers including exited ones that kubectl may not show. Useful when the API server is down or a node has orphaned containers.',
      reference: 'Container Runtime Debugging with crictl section in theory.'
    }
  ],
  flashcards: [
    {
      front: 'What kubectl logs flags do you need to know for the exam?',
      back: 'kubectl logs <pod>                    # basic\nkubectl logs <pod> -c <container>     # specific container\nkubectl logs <pod> -f                  # follow (stream)\nkubectl logs <pod> --tail=100          # last 100 lines\nkubectl logs <pod> --previous          # crashed container\nkubectl logs <pod> --since=1h          # last hour\nkubectl logs <pod> --timestamps        # add timestamps\nkubectl logs -l app=myapp -f           # all pods with label'
    },
    {
      front: 'What is the difference between Normal and Warning events?',
      back: 'Normal: routine Kubernetes operations (Scheduled, Pulled, Created, Started)\n\nWarning: potential problems (BackOff, Failed, OOMKilling, Evicted, FailedMount)\n\nFilter warnings: kubectl get events --field-selector type=Warning\nUsually sort by time: kubectl get events --sort-by=.lastTimestamp'
    },
    {
      front: 'How do you find the most resource-hungry pods?',
      back: '# Most CPU-hungry\nkubectl top pods -A --sort-by=cpu | head -10\n\n# Most memory-hungry\nkubectl top pods -A --sort-by=memory | head -10\n\n# Node-level view\nkubectl top nodes\n\nRequires Metrics Server: kubectl get pods -n kube-system | grep metrics-server'
    },
    {
      front: 'What does kubectl logs --previous do?',
      back: 'Shows logs from the PREVIOUS container run — the container before it was restarted.\n\nEssential for debugging CrashLoopBackOff:\n1. kubectl get pod <name> → shows restart count\n2. kubectl logs <name> --previous → shows why it crashed\n\nIf a container has never restarted, --previous returns an error.'
    },
    {
      front: 'What command shows events for a specific pod?',
      back: 'Option 1: kubectl describe pod <pod-name>\n  → Events section at the bottom\n\nOption 2: kubectl get events --field-selector involvedObject.name=<pod-name>\n  → Shows only events for that resource\n\nOption 3: kubectl get events --sort-by=.lastTimestamp | grep <pod-name>'
    },
    {
      front: 'What tools are used for container-level debugging on a node?',
      back: 'crictl — Container Runtime Interface CLI:\ncrictl ps         # running containers\ncrictl ps -a      # all containers (including stopped)\ncrictl logs <id>  # container logs\ncrictl inspect <id> # container details\ncrictl pods       # pod sandbox list\ncrictl images     # local images\n\nRequires SSH to the node. Alternative: kubectl debug node/<name>'
    },
    {
      front: 'What is the difference between Metrics Server and Prometheus for monitoring?',
      back: 'Metrics Server:\n- Real-time resource metrics (CPU, Memory)\n- Short retention (~30s-2min)\n- Powers kubectl top and HPA\n- Lightweight, required for basic autoscaling\n\nPrometheus:\n- Long-term time-series storage\n- Custom metrics, historical analysis\n- Alerting via AlertManager\n- Full observability stack (not in exam hands-on)'
    },
    {
      front: 'An OOMKilled event appears for a pod. What are the diagnostic steps?',
      back: '1. kubectl describe pod <name> | grep -A5 "OOM\|Limits"\n2. kubectl top pod <name> — see current memory usage\n3. kubectl get pod <name> -o yaml | grep -A5 limits — check memory limit\n4. Check if memory usage was trending up (memory leak)\n\nFix: increase resources.limits.memory\nOr optimize app memory usage\nOr check for memory leaks with: kubectl exec <pod> -- ps aux'
    }
  ],
  lab: {
    scenario: 'The operations team reports degraded application performance. You must investigate the cluster health using monitoring and logging tools to identify the root cause.',
    objective: 'Practice kubectl logs (including --previous), kubectl top, kubectl events, and crictl for comprehensive cluster observability.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Analyze Pod Logs and Crash Diagnostics',
        instruction: `Create a pod that crashes and practice log analysis:

\`\`\`bash
kubectl run crasher --image=busybox:1.36 \
  --restart=OnFailure \
  -- sh -c "echo 'starting...'; sleep 2; echo 'ERROR: critical failure'; exit 1"
\`\`\`

1. Wait for the pod to crash and restart
2. Use kubectl logs to see the current run output
3. Use --previous to see why it crashed in the last run
4. Use --timestamps to see exact crash times`,
        hints: [
          'kubectl get pod crasher -w to watch it crash and restart',
          'kubectl logs crasher shows current run (may be empty if just restarted)',
          'kubectl logs crasher --previous shows the crashed run',
          'kubectl describe pod crasher shows restart count and last state'
        ],
        solution: `\`\`\`bash
# Create crashing pod
kubectl run crasher --image=busybox:1.36 \
  --restart=OnFailure \
  -- sh -c "echo 'starting...'; sleep 2; echo 'ERROR: critical failure'; exit 1"

# Watch it start, crash, and restart
kubectl get pod crasher -w
# STATUS will cycle: Running → Error → CrashLoopBackOff

# Check restart count
kubectl get pod crasher
# RESTARTS column should increase

# See current run (may be brief)
kubectl logs crasher
kubectl logs crasher --timestamps

# See the previous crashed run
kubectl logs crasher --previous
kubectl logs crasher --previous --timestamps

# Describe shows last state (exit code, reason)
kubectl describe pod crasher | grep -A15 "Last State:"

# Cleanup
kubectl delete pod crasher
\`\`\``,
        verify: `\`\`\`bash
# Pod should show restarts
kubectl get pod crasher
# Expected: RESTARTS > 0

# Previous logs should show the error message
kubectl logs crasher --previous 2>/dev/null
# Expected: "starting..." then "ERROR: critical failure"

# Describe shows exit code 1
kubectl describe pod crasher | grep "Exit Code"
# Expected: Exit Code: 1
\`\`\``
      },
      {
        title: 'Use kubectl top and Events for Performance Analysis',
        instruction: `Create some workloads and practice resource monitoring:

1. Deploy an nginx deployment with 3 replicas
2. Use kubectl top to find resource usage
3. Check events for the deployment to see what Kubernetes did
4. Sort events to find the most recent ones`,
        hints: [
          'kubectl top pods shows current CPU/Memory (requires Metrics Server)',
          'kubectl top pods --sort-by=cpu to find high consumers',
          'kubectl get events --sort-by=.lastTimestamp shows newest events last',
          'kubectl get events --field-selector type=Warning for problem events'
        ],
        solution: `\`\`\`bash
# Create some workloads
kubectl create deployment web --image=nginx:1.25 --replicas=3
kubectl rollout status deployment/web

# Check resource usage (if metrics-server is available)
kubectl top pods -l app=web
kubectl top pods --sort-by=cpu
kubectl top nodes

# View events
kubectl get events --sort-by='.lastTimestamp'

# Filter Warning events only
kubectl get events --field-selector type=Warning

# Events for the web deployment pods
kubectl get events --field-selector involvedObject.kind=Pod | grep web

# Events in describe
kubectl describe deployment web | tail -20

# Cleanup
kubectl delete deployment web
\`\`\``,
        verify: `\`\`\`bash
# Deployment should be running
kubectl get deployment web
# Expected: READY = 3/3

# Events should show scheduling and creation
kubectl get events --sort-by='.lastTimestamp' | grep web | tail -5
# Expected: Scheduled, Pulled, Created, Started events for web pods

# If Metrics Server is available:
kubectl top pods 2>/dev/null | head -5 || echo "Metrics Server not available - install it first"
\`\`\``
      },
      {
        title: 'Log Filtering and Multi-Container Log Analysis',
        instruction: `Practice advanced log filtering for a multi-container pod:

1. Create a multi-container pod with two containers producing different logs
2. Use kubectl logs -c to view each container's logs separately
3. Use --since and --tail to filter logs
4. Use -l to aggregate logs from multiple pods`,
        hints: [
          'Without -c flag, kubectl logs defaults to first container',
          '--since=5m shows logs from last 5 minutes',
          '--tail=20 shows last 20 lines',
          'kubectl logs -l app=myapp --all-containers=true for all pods'
        ],
        solution: `\`\`\`bash
# Create multi-container pod
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: multi-log
  labels:
    app: multi-log
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c", "while true; do echo \"[APP] request processed at \$(date)\"; sleep 3; done"]
  - name: monitor
    image: busybox:1.36
    command: ["sh", "-c", "while true; do echo \"[MONITOR] health check ok at \$(date)\"; sleep 5; done"]
EOF

# Wait for pod to start
kubectl get pod multi-log -w

# View logs from first container (default)
kubectl logs multi-log

# View logs from specific containers
kubectl logs multi-log -c app
kubectl logs multi-log -c monitor

# Follow specific container
kubectl logs multi-log -c app -f &

# Filter last 5 lines with timestamps
kubectl logs multi-log -c app --tail=5 --timestamps

# View logs from last 30 seconds
kubectl logs multi-log --since=30s --all-containers=true

# Aggregate logs from pods with a label
kubectl logs -l app=multi-log --all-containers=true

# Kill the background follow
kill %1 2>/dev/null; true

# Cleanup
kubectl delete pod multi-log
\`\`\``,
        verify: `\`\`\`bash
# Pod should be Running with 2/2 containers
kubectl get pod multi-log
# Expected: READY = 2/2, STATUS = Running

# Each container should produce distinct logs
kubectl logs multi-log -c app | grep "\[APP\]"
# Expected: [APP] request processed at... lines

kubectl logs multi-log -c monitor | grep "\[MONITOR\]"
# Expected: [MONITOR] health check ok at... lines

# --all-containers shows both streams
kubectl logs multi-log --all-containers=true --tail=6
# Expected: mix of [APP] and [MONITOR] lines
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'kubectl logs Returns Empty Output',
      difficulty: 'easy',
      symptom: 'Running kubectl logs <pod-name> returns nothing (empty output). The pod is Running and the container restart count is 0.',
      diagnosis: `\`\`\`bash
# Check pod status and container count
kubectl get pod <pod-name>
kubectl get pod <pod-name> -o yaml | grep -E "containerStatuses|name:|state:"

# Check if pod has multiple containers
kubectl get pod <pod-name> -o jsonpath='{.spec.containers[*].name}'
# If multiple containers, you need -c flag

# Check if the application writes to stdout vs a file
kubectl exec <pod-name> -- ls /var/log/ 2>/dev/null

# Try with previous flag (if container restarted)
kubectl logs <pod-name> --previous 2>&1

# Check container state
kubectl describe pod <pod-name> | grep -A5 "State:"
\`\`\``,
      solution: `**Cause A: Multi-container pod — need -c flag**
\`\`\`bash
# List containers in the pod
kubectl get pod <pod-name> -o jsonpath='{.spec.containers[*].name}'

# Get logs from specific container
kubectl logs <pod-name> -c <container-name>
\`\`\`

**Cause B: App writes to file instead of stdout**
\`\`\`bash
# Check inside the container
kubectl exec <pod-name> -- ls /var/log/
kubectl exec <pod-name> -- cat /var/log/app.log

# Kubernetes only captures stdout/stderr in kubectl logs
# For exam: application should be configured to log to stdout
\`\`\`

**Cause C: Container just started and hasn't produced output yet**
\`\`\`bash
# Follow logs to see when they appear
kubectl logs <pod-name> -f
# Or wait a few seconds and try again
\`\`\``
    },
    {
      title: 'kubectl top pods Returns ServiceUnavailable Error',
      difficulty: 'medium',
      symptom: 'Running kubectl top pods returns: "Error from server (ServiceUnavailable): the server is currently unable to handle the request (get pods.metrics.k8s.io)".',
      diagnosis: `\`\`\`bash
# Check if Metrics Server is installed
kubectl get pods -n kube-system | grep metrics-server

# Check Metrics Server health
kubectl describe pod -n kube-system -l k8s-app=metrics-server 2>/dev/null
kubectl logs -n kube-system -l k8s-app=metrics-server 2>/dev/null

# Check the APIService for metrics
kubectl get apiservice v1beta1.metrics.k8s.io -o yaml | grep -A5 status
# Should show: Available = True

# Check Metrics Server service
kubectl get svc -n kube-system | grep metrics-server
\`\`\``,
      solution: `**Cause A: Metrics Server not installed**
\`\`\`bash
kubectl get pods -n kube-system | grep metrics
# Shows nothing

# Install Metrics Server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Wait for it to be ready
kubectl rollout status deployment/metrics-server -n kube-system

# Test
kubectl top nodes
\`\`\`

**Cause B: Metrics Server TLS certificate issue (common in lab environments)**
\`\`\`bash
kubectl logs -n kube-system -l k8s-app=metrics-server | grep -i "certificate\|TLS\|x509"
# Shows TLS/certificate errors

# Fix: add --kubelet-insecure-tls flag
kubectl patch deployment metrics-server -n kube-system \
  --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

kubectl rollout status deployment/metrics-server -n kube-system
kubectl top nodes
\`\`\``
    }
  ]
};
