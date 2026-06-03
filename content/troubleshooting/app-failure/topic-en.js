window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['troubleshooting/app-failure'] = {
  theory: `
# Application Failure Troubleshooting

## Exam Relevance
> Troubleshooting is **30% of the CKA exam** — the largest single domain. Application failure troubleshooting is the most common scenario. You must diagnose and fix broken pods, services, and deployments quickly.

## Systematic Debugging Approach

Always follow this order — start from the top and work down:

\`\`\`
1. kubectl get pods         → what is the pod status?
2. kubectl describe pod     → events, conditions, resource issues
3. kubectl logs             → application output, error messages
4. kubectl exec             → shell into container, test connectivity
5. kubectl get events       → cluster-level events
\`\`\`

## Pod Status Codes — What They Mean

| Status | Meaning | Common Cause |
|--------|---------|--------------|
| **Running** | All containers running | ✅ OK |
| **Pending** | Pod not yet scheduled | No matching node, resource constraints, no PVC |
| **ContainerCreating** | Container being initialized | Image pull, volume mount |
| **CrashLoopBackOff** | Container keeps crashing | App error, wrong command, missing config |
| **ImagePullBackOff** | Cannot pull image | Wrong image name/tag, no registry credentials |
| **ErrImagePull** | Initial pull failure | Same as above |
| **OOMKilled** | Out of memory | Memory limit too low, memory leak |
| **Error** | Container exited with error | App bug, wrong entrypoint |
| **Completed** | Container exited successfully | Expected for Jobs |
| **Terminating** | Pod being deleted | Normal, unless stuck |
| **Unknown** | Node not reachable | Node failure, network issue |

## Common Failure Scenarios

### CrashLoopBackOff

\`\`\`bash
# Get logs from crashing container
kubectl logs <pod> -n <namespace>

# Get logs from PREVIOUS container instance (before crash)
kubectl logs <pod> -n <namespace> --previous

# Common causes:
# - Wrong command/entrypoint
# - Missing environment variable or config
# - Database not reachable
# - Probe misconfiguration (liveness kills healthy pod)

# Check the actual exit code
kubectl describe pod <pod> | grep -A5 "Last State:"
# Exit code 1 = application error
# Exit code 137 = OOMKilled (memory)
# Exit code 143 = SIGTERM (normal shutdown)
\`\`\`

### ImagePullBackOff

\`\`\`bash
kubectl describe pod <pod> | grep -A3 "Events:"
# Error: "Failed to pull image ... not found" → wrong tag
# Error: "authentication required" → missing imagePullSecret

# Fix wrong image
kubectl set image deployment/<name> <container>=correct-image:tag

# Fix missing registry credentials
kubectl create secret docker-registry regcred \\
  --docker-server=<server> \\
  --docker-username=<user> \\
  --docker-password=<pass>

# Add imagePullSecret to pod/deployment
kubectl patch deployment <name> -p \\
  '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"regcred"}]}}}}'
\`\`\`

### Pending — Scheduling Issues

\`\`\`bash
kubectl describe pod <pod> | grep "Events:" -A10
# "Insufficient cpu" → increase node capacity or reduce requests
# "Insufficient memory" → same
# "no nodes matched" → check taints/tolerations, node selectors
# "persistentvolumeclaim not bound" → PVC Pending

# Check available resources
kubectl describe nodes | grep -A5 "Allocated resources:"
\`\`\`

### OOMKilled

\`\`\`bash
kubectl describe pod <pod> | grep -E "OOMKilled|Last State"
# "Reason: OOMKilled"

# Fix: increase memory limit
kubectl set resources deployment/<name> \\
  -c <container> \\
  --limits=memory=512Mi
\`\`\`

## Essential Commands

\`\`\`bash
# Full diagnostic sequence
kubectl get pods -n <namespace>
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --previous    # previous container
kubectl logs <pod-name> -n <namespace> -c <container>  # specific container

# Interactive debugging
kubectl exec -it <pod-name> -n <namespace> -- /bin/sh
kubectl exec -it <pod-name> -n <namespace> -- /bin/bash

# Run a debug pod in the same namespace
kubectl run debug --image=busybox -it --rm -- /bin/sh

# Check events for a namespace
kubectl get events -n <namespace> --sort-by='.lastTimestamp'

# Check events for a specific pod
kubectl describe pod <pod> -n <namespace> | tail -20

# Port-forward to test service directly
kubectl port-forward pod/<pod-name> 8080:80 -n <namespace>
kubectl port-forward svc/<service-name> 8080:80 -n <namespace>

# Check pod resource consumption
kubectl top pod <pod-name> -n <namespace>
\`\`\`

## Service Connectivity Debugging

\`\`\`bash
# Step 1: Check if service has endpoints
kubectl get endpoints <svc-name> -n <namespace>
# If ENDPOINTS = <none> → no matching pods

# Step 2: Check service selector
kubectl describe svc <svc-name> -n <namespace> | grep Selector

# Step 3: Check pod labels
kubectl get pods -n <namespace> --show-labels

# Step 4: Test DNS from inside cluster
kubectl exec -it debug-pod -n <namespace> -- nslookup <svc-name>
kubectl exec -it debug-pod -n <namespace> -- nslookup <svc-name>.<namespace>.svc.cluster.local

# Step 5: Test HTTP from inside cluster
kubectl exec -it debug-pod -n <namespace> -- curl http://<svc-name>:<port>
kubectl exec -it debug-pod -n <namespace> -- curl http://<svc-name>.<namespace>.svc.cluster.local:<port>
\`\`\`

## Common Errors Quick Reference

| Symptom | Most Likely Cause | Quick Fix |
|---------|-------------------|-----------|
| CrashLoopBackOff | App error | Check \`kubectl logs --previous\` |
| ImagePullBackOff | Wrong image/no credentials | Fix image name or add imagePullSecret |
| Pending (Unschedulable) | No node fits | Check node resources, taints |
| OOMKilled | Memory limit too low | Increase \`limits.memory\` |
| 0/1 running, service 503 | Pod not Ready (probe failing) | Check readiness probe config |
| Service not reachable | Selector mismatch | Check \`kubectl get endpoints\` |

## Killer.sh Style Challenge

> **Scenario**: The application in namespace \`broken\` is not accessible. Pods are in CrashLoopBackOff. The service exists but has no endpoints. Find and fix all issues.

\`\`\`bash
# 1. Check pod status
kubectl get pods -n broken

# 2. Get crash reason
kubectl logs <pod> -n broken --previous

# 3. Check service endpoints
kubectl get endpoints -n broken

# 4. Compare service selector vs pod labels
kubectl describe svc <name> -n broken | grep Selector
kubectl get pods -n broken --show-labels

# 5. Fix and verify
\`\`\`
`,
  quiz: [
    {
      question: 'A pod is in CrashLoopBackOff. The container crashes immediately. Which command gives you the logs from the previous (crashed) container instance?',
      options: [
        'kubectl logs <pod> --crashed',
        'kubectl logs <pod> --previous',
        'kubectl logs <pod> --last-run',
        'kubectl describe pod <pod> --logs'
      ],
      correct: 1,
      explanation: '`kubectl logs <pod> --previous` (or `-p`) fetches the logs from the previous container run. This is critical for debugging CrashLoopBackOff since the container may restart so fast the current logs are empty.',
      reference: 'Also check: kubectl describe pod <pod> — look for "Last State: Terminated" with exit code and reason.'
    },
    {
      question: 'A pod has status `0/1 Running` and the service returns 503. What does `0/1 Running` indicate?',
      options: [
        'The pod is starting up — wait a few seconds',
        'The pod container is running but NOT Ready (readiness probe failing)',
        'The pod has 0 containers running out of 1',
        'The pod is in an error state'
      ],
      correct: 1,
      explanation: '`0/1 Running` means the container IS running but is NOT Ready. This is typically caused by a failing readiness probe. The service will not route traffic to this pod until it becomes Ready.',
      reference: 'Check: kubectl describe pod <pod> — look at the Readiness probe and its failure messages.'
    },
    {
      question: 'A Service has no endpoints (`<none>` in kubectl get endpoints). What is the most likely cause?',
      options: [
        'The Service type is set to ClusterIP instead of NodePort',
        'The Service selector labels do not match any running pod labels',
        'The Service port is wrong',
        'The pods are in a different cluster'
      ],
      correct: 1,
      explanation: 'Empty endpoints means the Service selector does not match any pod labels. The selector must exactly match the pod labels — typos and wrong values are common causes.',
      reference: 'Debug: kubectl describe svc <name> | grep Selector; kubectl get pods --show-labels'
    },
    {
      question: 'A pod exits with code 137. What happened?',
      options: [
        'The application encountered a runtime error (code 137)',
        'The container was killed by the OOM killer (Out of Memory)',
        'The pod was terminated by a liveness probe failure',
        'The container image was not found'
      ],
      correct: 1,
      explanation: 'Exit code 137 = 128 + 9 (SIGKILL). This is the OOM killer terminating the process because it exceeded the memory limit. Solution: increase `resources.limits.memory` or fix the memory leak.',
      reference: 'Common exit codes: 0=success, 1=app error, 137=OOMKilled/SIGKILL, 143=SIGTERM, 1=general error.'
    },
    {
      question: 'Which command shows cluster events sorted by most recent first?',
      options: [
        'kubectl events --sort=time',
        'kubectl get events --sort-by=.lastTimestamp',
        'kubectl get events -o chronological',
        'kubectl describe events --latest'
      ],
      correct: 1,
      explanation: '`kubectl get events --sort-by=.lastTimestamp` sorts events by the last occurrence time. Combined with `-n <namespace>` to filter. Add `--field-selector involvedObject.name=<pod>` for a specific resource.',
      reference: 'Events are namespace-scoped. Use -A or --all-namespaces to see all events.'
    },
    {
      question: 'A pod is in Pending state. `kubectl describe pod` shows "0/3 nodes are available: 3 Insufficient memory". What does this mean?',
      options: [
        'The node does not have enough total memory installed',
        'The pod\'s memory request exceeds what\'s currently available on all nodes',
        'The pod has a memory limit but no request',
        'The node memory is all used by the kernel'
      ],
      correct: 1,
      explanation: 'The pod\'s `resources.requests.memory` exceeds the available (allocatable - already requested) memory on all nodes. The scheduler cannot place the pod. Fix: reduce the memory request, free up resources, or add more nodes.',
      reference: 'Check node capacity: kubectl describe node <node> | grep -A5 "Allocated resources:"'
    },
    {
      question: 'You need to test if a service is reachable from inside the cluster without modifying any existing workload. Which is the best approach?',
      options: [
        'Use kubectl port-forward from your local machine',
        'Deploy a new pod, exec into it, and curl the service',
        'kubectl run debug --image=busybox -it --rm -- sh, then curl or nslookup the service',
        'Check service endpoints with kubectl get endpoints'
      ],
      correct: 2,
      explanation: '`kubectl run debug --image=busybox -it --rm -- sh` (or `curlimages/curl`, `nicolaka/netshoot`) creates a temporary debug pod in the cluster. This lets you test DNS, connectivity, and HTTP from inside the cluster network without touching existing workloads. `--rm` automatically removes it when you exit.',
      reference: 'Tip: use `nicolaka/netshoot` for a full debugging toolkit (curl, dig, nmap, etc.).'
    },
    {
      question: 'A Deployment rollout is stalled. New pods start but immediately go to CrashLoopBackOff while old pods remain running. What happens to the Service traffic?',
      options: [
        'Traffic stops — the Service waits for new pods to be Ready',
        'Traffic is split 50/50 between old and new pods',
        'Traffic continues routing to old pods because new pods are not Ready',
        'The Deployment automatically rolls back after 5 minutes'
      ],
      correct: 2,
      explanation: 'Services route traffic only to **Ready** pods. Since new pods are crashing (not Ready), the Service continues routing all traffic to old pods. This is why rolling updates preserve availability even when the new version is broken.',
      reference: 'Related: kubectl rollout undo deployment/<name> to roll back; rollout continues until you fix or rollback.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 5 steps of systematic pod debugging?',
      back: '1. `kubectl get pods` — identify status\n2. `kubectl describe pod <name>` — events, conditions, resources\n3. `kubectl logs <pod>` — app output\n4. `kubectl logs <pod> --previous` — previous crash logs\n5. `kubectl exec -it <pod> -- sh` — shell access\n\nBonus: `kubectl get events --sort-by=.lastTimestamp`'
    },
    {
      front: 'What causes CrashLoopBackOff and how do you debug it?',
      back: '**CrashLoopBackOff**: container starts, crashes, restarts repeatedly with increasing delays.\n\n**Causes**: App error, wrong command, missing env vars/config, dependency unreachable, OOMKilled\n\n**Debug**:\n```bash\n# Get crash logs\nkubectl logs <pod> --previous\n\n# Check exit code\nkubectl describe pod <pod> | grep -A5 "Last State:"\n```\n\nExit 137 = OOMKilled, Exit 1 = App error, Exit 143 = SIGTERM'
    },
    {
      front: 'How do you debug a Service with no endpoints?',
      back: '```bash\n# Check if endpoints exist\nkubectl get endpoints <svc-name> -n <ns>\n# <none> = no matching pods\n\n# Check service selector\nkubectl describe svc <svc-name> | grep Selector\n\n# Check pod labels\nkubectl get pods --show-labels -n <ns>\n\n# Fix: patch service selector to match pods\nkubectl patch svc <svc> \\\n  -p \'{"spec":{"selector":{"app":"correct-label"}}}\'\n```\n\nMost common cause: typo in label or mismatched app name.'
    },
    {
      front: 'What do these pod exit codes mean: 0, 1, 137, 143?',
      back: '| Exit Code | Meaning |\n|-----------|--------|\n| 0 | Success (normal exit) |\n| 1 | Application error |\n| 137 | OOMKilled (128 + SIGKILL=9) |\n| 143 | SIGTERM (128 + SIGTERM=15) — graceful shutdown |\n| 126 | Permission denied (cannot execute) |\n| 127 | Command not found |\n\nView with: `kubectl describe pod <pod> | grep "Exit Code"`'
    },
    {
      front: 'A pod shows `0/1 Running`. What does this mean and how do you fix it?',
      back: '`0/1 Running` = container is running but **not Ready**.\n\n**Cause**: readiness probe is failing.\n\n**Debug**:\n```bash\nkubectl describe pod <pod> | grep -A10 "Readiness:"\n# Look for: "FAIL" or timeout\n\nkubectl logs <pod>  # Is the app healthy?\n```\n\n**Fix options**:\n1. Fix the app so it responds to the readiness probe endpoint\n2. Adjust the probe parameters (initialDelaySeconds, timeoutSeconds)\n3. Fix probe path/port if misconfigured'
    },
    {
      front: 'How do you create a temporary debug pod in the cluster?',
      back: '```bash\n# Simple busybox shell\nkubectl run debug -it --rm \\\n  --image=busybox \\\n  --restart=Never \\\n  -- /bin/sh\n\n# With networking tools (curl, dig, nmap)\nkubectl run debug -it --rm \\\n  --image=nicolaka/netshoot \\\n  --restart=Never \\\n  -- bash\n\n# In a specific namespace\nkubectl run debug -it --rm \\\n  --image=busybox \\\n  -n <namespace> \\\n  -- sh\n```\n`--rm` deletes the pod automatically when you exit.'
    },
    {
      front: 'A pod is Pending with "3 Insufficient cpu". How do you diagnose and fix?',
      back: '**Diagnose**:\n```bash\n# Check available CPU on nodes\nkubectl describe node <node> | grep -A5 "Allocated resources:"\n\n# Check what CPU the pod requests\nkubectl describe pod <pod> | grep -A5 "Requests:"\n```\n\n**Fix options**:\n1. Reduce `resources.requests.cpu` in pod spec\n2. Free up resources (delete other workloads)\n3. Add more nodes to the cluster\n4. Check for resource quotas: `kubectl get resourcequota -n <ns>`'
    },
    {
      front: 'How do you test service DNS resolution from inside the cluster?',
      back: '```bash\n# From a debug pod:\nkubectl exec -it debug -n <ns> -- nslookup <svc-name>\n# Returns IP of the service\n\n# Full DNS name format:\n<service-name>.<namespace>.svc.cluster.local\n\n# Test HTTP connectivity\nkubectl exec -it debug -n <ns> -- \\\n  curl http://<svc-name>.<ns>.svc.cluster.local:<port>\n\n# Or use port-forward from your machine\nkubectl port-forward svc/<svc> 8080:80 -n <ns>\ncurl http://localhost:8080\n```'
    }
  ],
  lab: {
    scenario: 'You inherit a broken namespace with multiple failing applications. Each has a different type of failure. You must identify and fix all issues.',
    objective: 'Diagnose and fix CrashLoopBackOff, ImagePullBackOff, service connectivity, and scheduling failures.',
    duration: '30-40 minutes',
    steps: [
      {
        title: 'Fix CrashLoopBackOff — Wrong Command',
        instruction: `Deploy the following broken pod and fix it:

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: crash-pod
  namespace: debug-lab
spec:
  containers:
  - name: app
    image: nginx
    command: ["start-nginx"]    # wrong command
\`\`\`

The pod will crash immediately. Identify the cause and fix it so nginx runs correctly.`,
        hints: [
          'The command "start-nginx" does not exist in the nginx image',
          'Nginx starts with "nginx" or "nginx -g daemon off;"',
          'Use kubectl logs crash-pod --previous to see the crash reason',
          'Delete and re-create with correct command, or use kubectl edit'
        ],
        solution: `\`\`\`bash
kubectl create namespace debug-lab

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: crash-pod
  namespace: debug-lab
spec:
  containers:
  - name: app
    image: nginx
    command: ["start-nginx"]
EOF

# Observe crash
kubectl get pod crash-pod -n debug-lab
kubectl logs crash-pod -n debug-lab --previous

# Fix: delete and re-create without the wrong command
# (Or use kubectl edit crash-pod -n debug-lab and remove command)
kubectl delete pod crash-pod -n debug-lab

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: crash-pod
  namespace: debug-lab
spec:
  containers:
  - name: app
    image: nginx
    # No command override — use nginx default entrypoint
EOF

kubectl get pod crash-pod -n debug-lab
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod crash-pod -n debug-lab
# Expected: STATUS=Running, READY=1/1

kubectl logs crash-pod -n debug-lab
# Expected: nginx startup logs (no errors)

kubectl describe pod crash-pod -n debug-lab | grep "State:"
# Expected: State: Running
\`\`\``
      },
      {
        title: 'Fix Service Connectivity — Label Mismatch',
        instruction: `In namespace **debug-lab**, create a deployment and service with a label mismatch:

\`\`\`bash
kubectl create deployment webapp -n debug-lab --image=nginx --replicas=2
kubectl expose deployment webapp -n debug-lab --port=80 --selector="app=wrong-label"
\`\`\`

The service exists but no traffic reaches the pods. Diagnose and fix by correcting the service selector.`,
        hints: [
          'Use kubectl get endpoints to see if the service has any backends',
          'Use kubectl get pods --show-labels to see pod labels',
          'Use kubectl describe svc to see the current selector',
          'Patch the service selector to match pod labels'
        ],
        solution: `\`\`\`bash
kubectl create deployment webapp -n debug-lab --image=nginx --replicas=2
kubectl expose deployment webapp -n debug-lab --port=80 --selector="app=wrong-label"

# Diagnose
kubectl get endpoints webapp -n debug-lab
# Expected: <none> — no endpoints!

kubectl describe svc webapp -n debug-lab | grep Selector
# Selector: app=wrong-label

kubectl get pods -n debug-lab --show-labels
# Pods have label: app=webapp

# Fix: patch service selector
kubectl patch svc webapp -n debug-lab \\
  -p '{"spec":{"selector":{"app":"webapp"}}}'

# Verify endpoints now exist
kubectl get endpoints webapp -n debug-lab
\`\`\``,
        verify: `\`\`\`bash
kubectl get endpoints webapp -n debug-lab
# Expected: 2 endpoints (IPs of the 2 pods)

kubectl describe svc webapp -n debug-lab | grep Selector
# Expected: Selector: app=webapp

# Test connectivity
kubectl run test -n debug-lab --image=busybox -it --rm -- wget -qO- http://webapp
# Expected: nginx default page HTML
\`\`\``
      },
      {
        title: 'Debug OOMKilled and Pending Pod',
        instruction: `In namespace **debug-lab**, create a pod with a very low memory limit that will be OOMKilled, and a pod with impossible resource requests that will stay Pending. Diagnose both and fix them.

\`\`\`bash
# OOMKilled pod (50Mi is too low for this workload)
kubectl run oom-pod -n debug-lab \\
  --image=nginx \\
  --limits=memory=1Mi

# Pending pod (too many resources)
kubectl run pending-pod -n debug-lab \\
  --image=nginx \\
  --requests=cpu=99
\`\`\``,
        hints: [
          'OOMKilled: look for exit code 137 in kubectl describe',
          'Pending: look for "Insufficient" in kubectl describe events section',
          'Fix OOMKilled by increasing memory limit',
          'Fix Pending by reducing cpu request to something the node can satisfy'
        ],
        solution: `\`\`\`bash
# Create problem pods
kubectl run oom-pod -n debug-lab \\
  --image=nginx --limits=memory=1Mi
kubectl run pending-pod -n debug-lab \\
  --image=nginx --requests=cpu=99

# Diagnose OOMKilled
kubectl describe pod oom-pod -n debug-lab | grep -A5 "Last State:"
# Reason: OOMKilled, Exit Code: 137

# Diagnose Pending
kubectl describe pod pending-pod -n debug-lab | grep -A5 "Events:"
# Warning: Insufficient cpu

# Fix OOMKilled: delete and re-create with higher limit
kubectl delete pod oom-pod -n debug-lab
kubectl run oom-pod -n debug-lab \\
  --image=nginx --limits=memory=128Mi

# Fix Pending: delete and re-create with realistic request
kubectl delete pod pending-pod -n debug-lab
kubectl run pending-pod -n debug-lab \\
  --image=nginx --requests=cpu=100m

kubectl get pods -n debug-lab
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod oom-pod -n debug-lab
# Expected: Running (no longer OOMKilled with higher limit)

kubectl get pod pending-pod -n debug-lab
# Expected: Running (scheduled now with realistic CPU request)

kubectl describe pod oom-pod -n debug-lab | grep "memory:"
# Expected: 128Mi limit

kubectl describe pod pending-pod -n debug-lab | grep "cpu:"
# Expected: 100m request
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pod stuck in Init state — init container failing',
      difficulty: 'medium',
      symptom: 'Pod shows status `Init:0/1` or `Init:CrashLoopBackOff`. The main application container never starts.',
      diagnosis: `\`\`\`bash
# Check pod status
kubectl get pod <pod> -n <namespace>
# Shows: Init:0/1 or Init:CrashLoopBackOff

# Get init container logs
kubectl logs <pod> -n <namespace> -c <init-container-name>
# List init containers: kubectl describe pod <pod> | grep "Init Containers:" -A5

# OR get all container logs with describe
kubectl describe pod <pod> -n <namespace>
# Look at "Init Containers" section for State and exit code
\`\`\``,
      solution: `Init containers must complete successfully (exit 0) before the main container starts.

\`\`\`bash
# Common init container patterns and fixes:

# 1. Waiting for a service (service not available)
# Init container runs: until nslookup myservice; do sleep 2; done
# Fix: ensure the dependency service exists and DNS is working
kubectl get svc myservice -n <namespace>

# 2. Permissions/wrong command in init container
kubectl logs <pod> -n <namespace> -c <init-container-name>
# Read the error message and fix the init container command

# 3. Volume permissions
# Init container: chown -R 1000:1000 /data (fails if PV not mounted)
kubectl describe pvc <claim> -n <namespace>
# Ensure PVC is Bound

# 4. Missing dependency (configmap/secret)
kubectl describe pod <pod> | grep "Error"
# Fix: create the missing ConfigMap or Secret

# After fixing, delete and re-create the pod
kubectl delete pod <pod> -n <namespace>
\`\`\``
    },
    {
      title: 'Application responds slowly — resource contention',
      difficulty: 'hard',
      symptom: 'Pod is Running and Ready, but the application is very slow to respond. No crashes. kubectl top pod shows high CPU usage.',
      diagnosis: `\`\`\`bash
# Check resource usage
kubectl top pod <pod> -n <namespace>
# Shows high CPU: e.g., 900m out of 500m limit (throttled)

# Check resource limits
kubectl describe pod <pod> | grep -A5 "Limits:"
# Low limits cause CPU throttling

# Check if CPU throttling is occurring (requires metrics-server)
kubectl top pod <pod> -n <namespace> --containers

# Check events for any throttling events
kubectl get events -n <namespace> | grep <pod>

# Check if it's a liveness probe timeout issue
kubectl describe pod <pod> | grep -A10 "Liveness:"
# timeoutSeconds too low → false restarts
\`\`\``,
      solution: `Most common cause is CPU throttling — the pod exceeds its CPU limit and the kernel throttles it.

\`\`\`bash
# Fix: increase CPU limit
kubectl set resources deployment/<name> -n <namespace> \\
  -c <container> \\
  --requests=cpu=200m \\
  --limits=cpu=1000m

# Or edit the deployment
kubectl edit deployment/<name> -n <namespace>
# Find resources section and increase limits

# If it's liveness probe false-positives causing restarts:
kubectl edit deployment/<name> -n <namespace>
# Increase:
# livenessProbe:
#   timeoutSeconds: 10    (from 1-2)
#   failureThreshold: 5   (from 3)
#   initialDelaySeconds: 30  (give app time to start)

# Verify after fix
kubectl top pod -n <namespace> -l app=<name>
\`\`\`

**Key insight**: CPU requests affect scheduling; CPU limits cause throttling. Both too low → performance issues. Set limits 2-4x the typical usage.`
    }
  ]
};
