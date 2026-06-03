window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['observability/debugging'] = {
  theory: `# Debugging & API Deprecations

## Exam Relevance
> Debugging skills are essential across all Kubernetes certifications. CKAD focuses on application-level debugging (exec, port-forward, ephemeral containers). CKA adds node/cluster debugging. API deprecations appear in both — you must know how to identify deprecated API versions and migrate manifests.

## Core Debugging Toolkit

\`\`\`bash
# 1. Describe — the most useful debugging command
kubectl describe pod <name>
kubectl describe node <name>
kubectl describe deployment <name>

# 2. Logs — application output
kubectl logs <pod> [-c container] [--previous] [-f]

# 3. Exec — shell into a running container
kubectl exec -it <pod> -- bash
kubectl exec -it <pod> -c <container> -- sh

# 4. Events — what Kubernetes is doing
kubectl get events --sort-by='.lastTimestamp'

# 5. Top — resource usage
kubectl top pods
kubectl top nodes
\`\`\`

## kubectl exec — Interactive Debugging

\`\`\`bash
# Open a shell in a running container
kubectl exec -it mypod -- bash
kubectl exec -it mypod -- sh          # when bash not available

# Run a one-off command
kubectl exec mypod -- cat /etc/config/app.yaml
kubectl exec mypod -- env | grep DATABASE
kubectl exec mypod -- curl -s http://localhost:8080/health

# Exec into specific container in multi-container pod
kubectl exec -it mypod -c sidecar -- sh

# Exec as a specific user (if container supports it)
kubectl exec -it mypod -- su -s /bin/sh nobody
\`\`\`

## kubectl port-forward — Local Access to In-Cluster Services

\`\`\`bash
# Forward local port to pod port
kubectl port-forward pod/mypod 8080:8080

# Forward to a service (round-robins to a pod)
kubectl port-forward svc/myservice 8080:80

# Forward to a deployment
kubectl port-forward deployment/myapp 8080:8080

# Bind to all interfaces (accessible from outside localhost)
kubectl port-forward svc/myservice 8080:80 --address=0.0.0.0

# In background
kubectl port-forward svc/myservice 8080:80 &
curl http://localhost:8080/health
\`\`\`

## Ephemeral Debug Containers (kubectl debug)

When a container is already running (or crashed) and doesn't have debugging tools, use ephemeral containers:

\`\`\`bash
# Attach an ephemeral debug container to a running pod
kubectl debug -it mypod --image=busybox:1.36 --target=app

# Add a debug container to a pod with image override
kubectl debug mypod -it --image=ubuntu --share-processes -- bash

# Debug a node directly (creates a privileged pod on the node)
kubectl debug node/node01 -it --image=ubuntu

# Create a copy of a pod with debug tools (modified pod)
kubectl debug mypod -it --image=ubuntu --copy-to=mypod-debug
\`\`\`

## Debugging Strategies by Symptom

### Pod in CrashLoopBackOff
\`\`\`bash
# 1. Check logs from the crashed run
kubectl logs <pod> --previous

# 2. Describe to see restart count and last state
kubectl describe pod <pod> | grep -A10 "Last State:"

# 3. Check exit code
kubectl describe pod <pod> | grep "Exit Code:"
# Exit 0 = intentional stop, Exit 1 = error, Exit 137 = OOMKill/SIGKILL

# 4. Temporarily override command to debug
kubectl debug <pod> --copy-to=debug-pod --image=<same-image> -- sleep 3600
kubectl exec -it debug-pod -- bash   # explore filesystem
\`\`\`

### Pod in Pending State
\`\`\`bash
kubectl describe pod <pod> | grep -A5 "Events:"
# Look for:
# - "Insufficient cpu/memory" → resource request too high
# - "No nodes are available" → all nodes tainted/cordoned
# - "node(s) didn't match Pod's node affinity" → affinity mismatch
# - "persistentvolumeclaim not bound" → PVC issue
\`\`\`

### Service Not Reaching Pods
\`\`\`bash
# Quick 3-step check
kubectl get endpoints <svc>          # 1. endpoints not empty?
kubectl get pod -l <selector>        # 2. pod label matches?
kubectl exec <pod> -- curl localhost  # 3. app actually listening?
\`\`\`

## API Deprecations

Kubernetes deprecates API versions when newer, stable versions become available.

### Check Deprecated APIs in Use

\`\`\`bash
# Check what API versions are available
kubectl api-versions | grep apps
kubectl api-resources | grep deployment

# Check API version of an existing resource
kubectl get deployment myapp -o yaml | head -5
# apiVersion: apps/v1  ← current/stable

# Find resources using old/deprecated APIs
# Install kubectl-convert plugin or use:
kubectl get <resource> -o yaml | grep "apiVersion"
\`\`\`

### Common API Version History

| Resource | Deprecated | Current |
|----------|-----------|---------|
| Deployment | apps/v1beta1, apps/v1beta2, extensions/v1beta1 | **apps/v1** |
| Ingress | networking.k8s.io/v1beta1, extensions/v1beta1 | **networking.k8s.io/v1** |
| NetworkPolicy | extensions/v1beta1 | **networking.k8s.io/v1** |
| HPA | autoscaling/v1 (basic) | **autoscaling/v2** |
| CronJob | batch/v1beta1 | **batch/v1** |
| PodSecurityPolicy | policy/v1beta1 | **Removed in v1.25** |

### kubectl convert — Migrate Manifests

\`\`\`bash
# Install kubectl-convert plugin
kubectl krew install convert

# Convert a manifest to the latest API version
kubectl convert -f old-deployment.yaml | kubectl apply -f -

# Convert all yamls in a directory
kubectl convert -f ./manifests/ --output-version apps/v1
\`\`\`

### Using --dry-run to Validate

\`\`\`bash
# Test if a manifest is valid without applying
kubectl apply -f my-manifest.yaml --dry-run=client
kubectl apply -f my-manifest.yaml --dry-run=server  # Server-side validation (more accurate)

# Validate against the cluster's current API
kubectl apply -f my-manifest.yaml --dry-run=server --validate=true
\`\`\`

## kubectl diff — Preview Changes

\`\`\`bash
# See what would change before applying
kubectl diff -f my-deployment.yaml
# + lines: new content
# - lines: removed content
\`\`\`

## Checking kubectl and Server Versions

\`\`\`bash
kubectl version
# Shows both client (kubectl) and server (API server) versions

# JSON output for scripting
kubectl version -o json | jq '.serverVersion.gitVersion'

# Check supported API versions for a resource
kubectl explain deployment --api-version=apps/v1
kubectl explain pod.spec.containers.securityContext
\`\`\`

## Common Errors

1. **exec: no command given** — forgot \`--\` before the command: \`kubectl exec pod -- sh\`
2. **unable to upgrade connection** — node network issue or wrong kubeconfig context
3. **API version not found** — using deprecated/removed API; update apiVersion field
4. **port-forward fails** — pod not Running, or port not listening inside container
5. **ephemeral containers not enabled** — cluster version < 1.23 (now stable in 1.23+)

## Killer.sh Style Challenge

**Task**: A pod \`crasher\` in namespace \`debug-ns\` is in CrashLoopBackOff:
1. Identify the exit code and cause without looking at logs from the current run
2. Use kubectl debug to create a copy of the pod with a sleep command for investigation
3. From inside the debug copy, identify the misconfiguration and fix the original pod
`,
  quiz: [
    {
      question: 'What flag do you need when running "kubectl exec" to get an interactive shell?',
      options: [
        '--interactive only (-i)',
        '--tty only (-t)',
        'Both -it (interactive + TTY)',
        '--shell (-s)'
      ],
      correct: 2,
      explanation: '-i (--stdin) keeps stdin open for interactive use. -t (--tty) allocates a pseudo-TTY for terminal-like behavior. Both are needed for an interactive shell: kubectl exec -it mypod -- bash.',
      reference: 'kubectl exec section in theory. -it is the standard flag combination for interactive shells.'
    },
    {
      question: 'A container exits with code 137. What does this mean?',
      options: [
        'The application exited cleanly with success',
        'The container was OOMKilled (killed by kernel due to memory limit exceeded)',
        'The container image was not found',
        'The liveness probe failed 3 times'
      ],
      correct: 1,
      explanation: 'Exit code 137 = 128 + 9 (SIGKILL). This is the OOMKill exit code — the kernel sent SIGKILL because the container exceeded its memory limit. Fix: increase memory limits in resources.limits.memory.',
      reference: 'Debugging Strategies by Symptom — CrashLoopBackOff section. Exit 137 = OOMKill/SIGKILL.'
    },
    {
      question: 'What is the purpose of kubectl port-forward?',
      options: [
        'Permanently exposes a service outside the cluster',
        'Forwards traffic from a local port to a pod/service port within the cluster (temporary, for debugging)',
        'Creates a NodePort service automatically',
        'Sets up a VPN tunnel to the cluster'
      ],
      correct: 1,
      explanation: 'kubectl port-forward creates a temporary tunnel from a local port to a pod or service port inside the cluster. It is used for debugging and testing — not for production traffic. The tunnel closes when the command is stopped.',
      reference: 'kubectl port-forward section in theory.'
    },
    {
      question: 'A production container crashed and has no debugging tools. How do you debug it without disrupting it?',
      options: [
        'kubectl exec into the running container and install tools',
        'kubectl debug with an ephemeral container using a debug image',
        'Restart the container with --debug flag',
        'Use kubectl attach to connect to the process'
      ],
      correct: 1,
      explanation: 'kubectl debug -it <pod> --image=busybox:1.36 --target=<container> attaches an ephemeral debug container to the running pod. The ephemeral container shares the pod\'s namespaces (network, process) without disrupting the main container.',
      reference: 'Ephemeral Debug Containers section in theory.'
    },
    {
      question: 'Which API version is the current stable version for Deployments?',
      options: [
        'extensions/v1beta1',
        'apps/v1beta2',
        'apps/v1',
        'apps/v2'
      ],
      correct: 2,
      explanation: '"apps/v1" is the current stable API version for Deployments (since Kubernetes 1.9). The older versions (extensions/v1beta1, apps/v1beta1, apps/v1beta2) are all removed. Always use apps/v1.',
      reference: 'Common API Version History table in theory.'
    },
    {
      question: 'What does kubectl apply --dry-run=server do differently from --dry-run=client?',
      options: [
        'They are identical',
        'Server-side validation checks against the actual cluster (admission webhooks, API validation); client-side is local only',
        'Server dry-run applies changes permanently; client dry-run is just a preview',
        'Server dry-run requires cluster admin permissions; client dry-run does not'
      ],
      correct: 1,
      explanation: '--dry-run=client performs basic schema validation locally. --dry-run=server sends the request to the API server, which runs admission webhooks, validates against CRDs, and applies server-side validation — much more accurate.',
      reference: 'Using --dry-run to Validate section in theory.'
    },
    {
      question: 'What kubectl command shows you what would CHANGE before running kubectl apply?',
      options: [
        'kubectl apply --preview',
        'kubectl diff -f my-manifest.yaml',
        'kubectl compare -f my-manifest.yaml',
        'kubectl apply --dry-run=client -o yaml'
      ],
      correct: 1,
      explanation: 'kubectl diff shows the delta between the current cluster state and the manifest, using standard diff format (+/- lines). This is essential before applying changes to production.',
      reference: 'kubectl diff section in theory.'
    },
    {
      question: 'A pod is in Pending state. What is the first command to run to diagnose it?',
      options: [
        'kubectl logs <pod>',
        'kubectl describe pod <pod>',
        'kubectl top pod <pod>',
        'kubectl exec <pod> -- ps aux'
      ],
      correct: 1,
      explanation: 'kubectl describe pod is the go-to command for Pending pods. The Events section at the bottom shows exactly why scheduling failed: insufficient resources, node affinity mismatch, taint without toleration, unbound PVC, etc.',
      reference: 'Debugging Strategies — Pod in Pending State section in theory.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 5 essential debugging commands in order of use?',
      back: '1. kubectl describe pod <name> — events, conditions, container state\n2. kubectl logs <pod> [--previous] — application output\n3. kubectl exec -it <pod> -- sh — interactive shell\n4. kubectl get events --sort-by=.lastTimestamp — cluster events\n5. kubectl top pod/node — resource usage\n\nFor services: kubectl get endpoints <svc>'
    },
    {
      front: 'What do exit codes 0, 1, and 137 mean for containers?',
      back: 'Exit code 0 → clean exit (intentional)\nExit code 1 → generic application error\nExit code 2 → misuse of shell/command\nExit code 137 → SIGKILL (OOMKill or force kill)\nExit code 143 → SIGTERM (graceful shutdown requested)\n\nCheck: kubectl describe pod <name> | grep "Exit Code"'
    },
    {
      front: 'How do you debug a crashed container with no debugging tools?',
      back: 'Use ephemeral containers:\nkubectl debug -it <pod> --image=busybox:1.36 --target=<container>\n\nOr create a copy with debugging tools:\nkubectl debug <pod> --copy-to=debug-pod --image=ubuntu -- sleep 3600\nkubectl exec -it debug-pod -- bash\n\nOr override entrypoint (delete + recreate with different command).'
    },
    {
      front: 'What is kubectl port-forward used for?',
      back: 'Creates a temporary tunnel from a LOCAL port to a pod/service port inside the cluster.\n\nkubectl port-forward pod/mypod 8080:8080  → localhost:8080 → pod:8080\nkubectl port-forward svc/myservice 8080:80 → localhost:8080 → service:80\n\nUsed for: testing, debugging, accessing admin UIs. NOT for production traffic.'
    },
    {
      front: 'What is the current stable API version for: Deployment, Ingress, HPA, CronJob?',
      back: 'Deployment: apps/v1\nIngress: networking.k8s.io/v1\nHPA: autoscaling/v2 (autoscaling/v1 still works but limited)\nCronJob: batch/v1\nNetworkPolicy: networking.k8s.io/v1\n\nOld versions (extensions/v1beta1, apps/v1beta1, etc.) are removed — always use current stable.'
    },
    {
      front: 'How do you preview changes before kubectl apply?',
      back: 'kubectl diff -f manifest.yaml\n→ shows +/- diff of what would change\n\nkubectl apply -f manifest.yaml --dry-run=client\n→ validates locally, shows what would be created/updated\n\nkubectl apply -f manifest.yaml --dry-run=server\n→ full server-side validation (admission webhooks, CRDs)\nMore accurate than client — use this for production changes.'
    },
    {
      front: 'A pod is in CrashLoopBackOff. What is the debugging sequence?',
      back: '1. kubectl get pod <name> — note RESTARTS count\n2. kubectl describe pod <name> | grep -A10 "Last State:" — exit code\n3. kubectl logs <name> --previous — logs from crashed run\n4. If no clues: kubectl debug <name> --copy-to=debug --image=<same> -- sleep 3600\n5. kubectl exec -it debug -- bash — explore filesystem\n6. Fix the root cause (bad command, missing config, OOM, etc.)'
    },
    {
      front: 'What does kubectl explain do?',
      back: 'Shows the API documentation for a resource or field:\n\nkubectl explain pod.spec.containers\nkubectl explain deployment.spec.strategy\nkubectl explain ingress.spec.rules\n\nWith API version override:\nkubectl explain deployment --api-version=apps/v1\n\nEssential for: discovering field names/types without leaving the terminal.'
    }
  ],
  lab: {
    scenario: 'You are on-call and receive alerts about broken applications in the cluster. Using systematic debugging techniques, you must identify and fix each issue.',
    objective: 'Master kubectl exec, describe, logs --previous, port-forward, and the debug pod pattern for real-world troubleshooting.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Debug a CrashLoopBackOff Pod',
        instruction: `Create and debug a crashing pod:

\`\`\`bash
kubectl run bad-app --image=nginx:1.25 \
  --overrides='{"spec":{"containers":[{"name":"bad-app","image":"nginx:1.25","command":["sh","-c","echo starting; exit 1"]}]}}'
\`\`\`

1. Identify the exit code from kubectl describe
2. Get logs from the previous run
3. Create a debug copy that stays alive to explore
4. Fix the pod by recreating with correct command`,
        hints: [
          'kubectl describe pod bad-app | grep "Exit Code"',
          'kubectl logs bad-app --previous to see crashed run logs',
          'kubectl debug bad-app --copy-to=debug-app --image=nginx:1.25 -- sleep 3600',
          'kubectl exec -it debug-app -- bash to explore'
        ],
        solution: `\`\`\`bash
# Create the crashing pod
kubectl run bad-app --image=nginx:1.25 \
  --overrides='{"spec":{"containers":[{"name":"bad-app","image":"nginx:1.25","command":["sh","-c","echo starting; exit 1"]}]}}'

# Watch it crash
kubectl get pod bad-app -w

# Check exit code
kubectl describe pod bad-app | grep "Exit Code"
# Expected: Exit Code: 1

# Get logs from previous run
kubectl logs bad-app --previous
# Expected: "starting"

# Create a debug copy (replaces command with sleep)
kubectl debug bad-app --copy-to=debug-app -- sleep 3600

# Explore the debug copy
kubectl exec -it debug-app -- bash
# Inside: ls, env, cat /etc/nginx/nginx.conf, etc.
# Type exit when done

# Fix: recreate with correct command (no explicit command = use image default)
kubectl delete pod bad-app
kubectl run bad-app --image=nginx:1.25
kubectl get pod bad-app

# Cleanup debug pod
kubectl delete pod debug-app
\`\`\``,
        verify: `\`\`\`bash
# Fixed pod should be Running
kubectl get pod bad-app
# Expected: STATUS = Running

# Describe should show Exit Code from previous run
kubectl describe pod bad-app | grep "Last State" -A5
# Expected: shows Exit Code 1 for previous (bad) run

# Current run should have no exit code (still running)
kubectl describe pod bad-app | grep "State:" -A3
# Expected: State: Running
\`\`\``
      },
      {
        title: 'Use port-forward to Debug a Service',
        instruction: `Create a deployment with a service, then use port-forward to test it locally:

1. Create deployment \`api-server\` with \`nginx:1.25\` and expose it as ClusterIP on port 80
2. Use kubectl port-forward to access the service locally on port 9090
3. Verify the service responds with curl http://localhost:9090
4. Use exec to test connectivity from inside the cluster`,
        hints: [
          'kubectl create deployment api-server --image=nginx:1.25 --port=80',
          'kubectl expose deployment api-server --port=80',
          'kubectl port-forward svc/api-server 9090:80 & (run in background)',
          'curl http://localhost:9090 to test'
        ],
        solution: `\`\`\`bash
# Create deployment and service
kubectl create deployment api-server --image=nginx:1.25 --port=80
kubectl expose deployment api-server --port=80
kubectl rollout status deployment/api-server

# Port-forward in background
kubectl port-forward svc/api-server 9090:80 &
PF_PID=$!

# Wait a moment for port-forward to establish
sleep 2

# Test from localhost
curl -s http://localhost:9090 | head -5
# Expected: nginx welcome HTML

# Also test from inside the cluster (exec into any pod)
kubectl run test-client --image=curlimages/curl:8.4.0 --rm -it -- \
  curl -s http://api-server | head -5

# Stop port-forward
kill $PF_PID 2>/dev/null

# Cleanup
kubectl delete deployment api-server
kubectl delete svc api-server
\`\`\``,
        verify: `\`\`\`bash
# Service should exist
kubectl get svc api-server
# Expected: ClusterIP service exists

# Port-forward test
kubectl port-forward svc/api-server 9090:80 &
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://localhost:9090
# Expected: 200
kill %1 2>/dev/null; true
\`\`\``
      },
      {
        title: 'Validate Manifests with dry-run and diff',
        instruction: `Practice validating manifests before applying them:

1. Create a deployment manifest with an intentional API version error (use apps/v1beta1)
2. Run --dry-run=server to see the validation error
3. Fix the API version to apps/v1
4. Use kubectl diff to see what would change vs current cluster state
5. Apply and verify`,
        hints: [
          'kubectl apply -f broken.yaml --dry-run=server will show the API error',
          'Change apiVersion: apps/v1beta1 to apiVersion: apps/v1',
          'kubectl diff -f manifest.yaml shows changes before apply',
          'kubectl explain deployment shows the correct apiVersion'
        ],
        solution: `\`\`\`bash
# Create a manifest with wrong API version
cat <<'EOF' > /tmp/broken-deploy.yaml
apiVersion: apps/v1beta1
kind: Deployment
metadata:
  name: test-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: test-app
  template:
    metadata:
      labels:
        app: test-app
    spec:
      containers:
      - name: app
        image: nginx:1.25
EOF

# Validate with dry-run=server (shows the API error)
kubectl apply -f /tmp/broken-deploy.yaml --dry-run=server
# Expected: error about apps/v1beta1 not found

# Fix the API version
sed -i 's/apps\/v1beta1/apps\/v1/' /tmp/broken-deploy.yaml

# Validate again
kubectl apply -f /tmp/broken-deploy.yaml --dry-run=server
# Expected: deployment/test-app configured (dry run)

# Check diff (nothing to diff since not yet applied)
kubectl apply -f /tmp/broken-deploy.yaml
kubectl diff -f /tmp/broken-deploy.yaml
# Expected: no diff (matches current state)

# Modify replicas and diff
sed -i 's/replicas: 2/replicas: 4/' /tmp/broken-deploy.yaml
kubectl diff -f /tmp/broken-deploy.yaml
# Expected: shows - replicas: 2, + replicas: 4

# Apply the change
kubectl apply -f /tmp/broken-deploy.yaml
kubectl get deployment test-app
kubectl delete deployment test-app
rm /tmp/broken-deploy.yaml
\`\`\``,
        verify: `\`\`\`bash
# After fix: dry-run should succeed
kubectl apply -f /tmp/broken-deploy.yaml --dry-run=server 2>/dev/null || echo "file cleaned up"

# Deployment should have correct apiVersion
kubectl get deployment test-app -o yaml 2>/dev/null | grep "apiVersion" | head -1
# Expected: apiVersion: apps/v1

# kubectl explain shows correct API
kubectl explain deployment | grep "VERSION:"
# Expected: VERSION: v1
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'kubectl exec Fails — "unable to upgrade connection"',
      difficulty: 'medium',
      symptom: 'Running kubectl exec -it mypod -- bash fails with: "Error from server: error dialing backend: dial tcp: connect: connection refused" or "unable to upgrade connection: pod does not exist".',
      diagnosis: `\`\`\`bash
# Check pod status — must be Running
kubectl get pod <pod-name>
# If not Running: fix the pod first

# Check if the container is Ready
kubectl get pod <pod-name>
# READY column must be N/N

# Check kubelet on the node
kubectl describe pod <pod-name> | grep "Node:"
# SSH to the node and check kubelet
# systemctl status kubelet

# Check if the container has a shell installed
kubectl describe pod <pod-name> | grep "Image:"
# Distroless images (e.g., gcr.io/distroless/...) have NO shell
\`\`\``,
      solution: `**Cause A: Pod not Running**
\`\`\`bash
# Fix the pod first, then retry exec
kubectl get pod <pod-name>
# Wait for STATUS = Running
\`\`\`

**Cause B: Distroless/minimal image with no shell**
\`\`\`bash
# Use an ephemeral debug container instead
kubectl debug -it <pod-name> --image=busybox:1.36 --target=<container-name>

# Or copy the pod with a different image
kubectl debug <pod-name> --copy-to=debug-pod --image=ubuntu -- sleep 3600
kubectl exec -it debug-pod -- bash
\`\`\`

**Cause C: Network issue to node**
\`\`\`bash
# Check node status
kubectl get node <node-name>
# Must be Ready

# Check if kubelet is running on the node
kubectl describe node <node-name> | grep Conditions -A20
\`\`\``
    },
    {
      title: 'Deprecated API Version Causes Upgrade Failure',
      difficulty: 'easy',
      symptom: 'After a cluster upgrade, existing manifests or Helm charts fail with: "no matches for kind Deployment in version apps/v1beta1" or "... has been removed in Kubernetes v1.X".',
      diagnosis: `\`\`\`bash
# Check what API versions are supported
kubectl api-versions | grep apps
kubectl api-versions | grep networking

# Try to apply the manifest with server dry-run
kubectl apply -f manifest.yaml --dry-run=server
# Shows exact error for unsupported API

# Check all resources in a namespace for old API versions
kubectl get all -n <namespace> -o yaml | grep "apiVersion" | sort -u

# Check Helm chart (if used)
helm get manifest <release-name> | grep "^apiVersion"
\`\`\``,
      solution: `**Fix: Update the apiVersion field in the manifest**
\`\`\`bash
# Deployment: apps/v1beta1 → apps/v1
# Ingress: networking.k8s.io/v1beta1 → networking.k8s.io/v1
# CronJob: batch/v1beta1 → batch/v1

# For Ingress (v1 requires pathType field):
# Old:
# rules:
# - http:
#     paths:
#     - path: /
#       backend:
#         serviceName: myservice
#         servicePort: 80

# New (v1 format):
# rules:
# - http:
#     paths:
#     - path: /
#       pathType: Prefix
#       backend:
#         service:
#           name: myservice
#           port:
#             number: 80

# Verify after fix
kubectl apply -f updated-manifest.yaml --dry-run=server
kubectl apply -f updated-manifest.yaml
\`\`\``
    }
  ]
};
