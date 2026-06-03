window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['app-design-build/multi-container'] = {
  theory: `# Multi-Container Patterns

## Exam Relevance
> Multi-container pods are tested in both CKAD (design patterns) and CKA (debugging). Common scenarios include sidecar logging, init containers for setup tasks, and ambassador proxies. Expect 1-2 questions directly on this topic.

## Why Multiple Containers in One Pod?

Containers in a pod share the same:
- **Network namespace** — same IP, communicate via \`localhost\`
- **Storage** — can share \`emptyDir\` volumes
- **Lifecycle** — start and stop together (except init containers)

Use multi-container pods when containers are **tightly coupled** and must share data or network.

## Pattern 1: Sidecar

A helper container runs alongside the main container to **extend or enhance** its functionality.

**Use cases:**
- Log shipping (Fluentd collecting logs from a shared volume)
- Config reloader (watches ConfigMap and signals the main app)
- Service mesh proxy (Istio/Linkerd Envoy sidecar)

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-with-log-sidecar
spec:
  containers:
  - name: web
    image: nginx:1.25
    volumeMounts:
    - name: logs
      mountPath: /var/log/nginx
  - name: log-shipper
    image: busybox:1.36
    command: ["sh", "-c", "tail -f /logs/access.log"]
    volumeMounts:
    - name: logs
      mountPath: /logs
  volumes:
  - name: logs
    emptyDir: {}
\`\`\`

## Pattern 2: Init Container

**Init containers** run and complete **before** any regular containers start. They always run sequentially (one at a time).

**Key behaviors:**
- If an init container fails, the pod restarts the init container (not the main container)
- All init containers must succeed before app containers start
- They are defined under \`spec.initContainers\`, not \`spec.containers\`

**Use cases:**
- Wait for a database to be ready
- Pre-populate a volume with data (config files, secrets)
- Run migrations before the app starts

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-with-init
spec:
  initContainers:
  - name: wait-for-db
    image: busybox:1.36
    command: ["sh", "-c", "until nc -z db-service 5432; do echo waiting for db; sleep 2; done"]
  - name: init-data
    image: busybox:1.36
    command: ["sh", "-c", "echo 'init data' > /shared/data.txt"]
    volumeMounts:
    - name: shared-data
      mountPath: /shared
  containers:
  - name: app
    image: myapp:1.0
    volumeMounts:
    - name: shared-data
      mountPath: /app/data
  volumes:
  - name: shared-data
    emptyDir: {}
\`\`\`

## Pattern 3: Ambassador

The ambassador container **proxies network traffic** between the main container and the outside world. The main container always connects to \`localhost\`, and the ambassador handles routing.

**Use cases:**
- Database proxy (HAProxy for connection pooling)
- API gateway (local proxy routing to different backends)
- Protocol translation

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-ambassador
spec:
  containers:
  - name: main-app
    image: myapp:1.0
    env:
    - name: DB_HOST
      value: "localhost"   # Always connects to localhost
    - name: DB_PORT
      value: "5432"
  - name: db-ambassador
    image: haproxy:2.8
    # HAProxy routes localhost:5432 → actual DB cluster
\`\`\`

## Pattern 4: Adapter

The adapter container **normalizes the output** of the main container (e.g., format conversion, aggregation).

\`\`\`yaml
# Example: main app exposes non-standard metrics format
# adapter converts them to Prometheus format
spec:
  containers:
  - name: legacy-app
    image: legacy:1.0
  - name: metrics-adapter
    image: prometheus-adapter:1.0
    ports:
    - containerPort: 9090
\`\`\`

## Init vs Sidecar vs Regular Container Comparison

| Feature | Init Container | Sidecar | Regular Container |
|---------|---------------|---------|-------------------|
| Runs before app? | Yes | No | No |
| Runs after app? | No | Yes (same time) | Yes |
| Must complete? | Yes (successfully) | No | No |
| Sequential? | Yes (one at a time) | No | No |
| Can share volumes? | Yes | Yes | Yes |
| Restart on failure? | Yes (pod restarts) | Yes (pod restarts) | Yes (pod restarts) |

## Sidecar Containers (Kubernetes 1.29+)

From Kubernetes 1.29, there is an **official sidecar container** feature using \`restartPolicy: Always\` in initContainers. This ensures the sidecar lifecycle is managed independently.

\`\`\`yaml
spec:
  initContainers:
  - name: log-shipper
    image: fluentd:v1.16
    restartPolicy: Always   # Makes this a "real" sidecar (K8s 1.29+)
  containers:
  - name: app
    image: myapp:1.0
\`\`\`

## Inter-Container Communication

Since all containers in a pod share the same network namespace:

\`\`\`bash
# Container A can reach Container B via localhost
curl http://localhost:8080

# Or via 127.0.0.1
curl http://127.0.0.1:9090
\`\`\`

Use **shared emptyDir volumes** to exchange files:
\`\`\`yaml
volumes:
- name: shared
  emptyDir: {}
\`\`\`

## Errors Common

1. **Forgetting to define the shared volume** — both containers mount, but the volume is not declared in \`spec.volumes\`
2. **Init container still running** — pod shows \`Init:0/2\` — check \`kubectl logs pod -c init-container-name\`
3. **Wrong container field** — using \`spec.containers\` for init containers instead of \`spec.initContainers\`
4. **Shared volume permissions** — init container writes as root, main container reads as non-root user → use \`securityContext.fsGroup\`
5. **Forgetting -c flag in kubectl logs** — \`kubectl logs pod\` only shows the first container; use \`-c container-name\`

## Killer.sh Style Challenge

**Task**: Create a pod named \`data-processor\` in the \`production\` namespace with:
1. An init container named \`downloader\` using \`busybox:1.36\` that writes "data ready" to \`/shared/status.txt\`
2. A main container named \`processor\` using \`nginx:1.25\`
3. A sidecar container named \`monitor\` using \`busybox:1.36\` that runs \`tail -f /shared/status.txt\`
4. All containers share a volume named \`data\` mounted at \`/shared\`

Verify the init container completed successfully and the pod is Running.
`,
  quiz: [
    {
      question: 'What is the execution order when a pod has 2 init containers and 2 regular containers?',
      options: [
        'All 4 containers start simultaneously',
        'Init containers run sequentially first, then regular containers start in parallel',
        'Regular containers start first, then init containers run',
        'Init containers run in parallel, then regular containers run in parallel'
      ],
      correct: 1,
      explanation: 'Init containers always run sequentially (one at a time) and all must complete successfully before any regular container starts. Regular containers then start (potentially in parallel).',
      reference: 'Init Container behavior — see the "Init vs Sidecar vs Regular Container" comparison table in the theory section.'
    },
    {
      question: 'How do two containers in the same pod communicate via network?',
      options: [
        'Via a ClusterIP Service created automatically by Kubernetes',
        'Via localhost/127.0.0.1 since they share the same network namespace',
        'Via pod IP — each container has its own IP',
        'Via a shared environment variable containing the other container\'s IP'
      ],
      correct: 1,
      explanation: 'All containers in a pod share the same network namespace, meaning the same IP address. They communicate with each other via localhost on different ports.',
      reference: 'Inter-Container Communication section in the theory.'
    },
    {
      question: 'What happens if an init container fails?',
      options: [
        'Only the init container restarts; regular containers are unaffected',
        'The pod is deleted and recreated from scratch',
        'The pod restarts (and retries the failed init container)',
        'Kubernetes skips the failed init container and starts regular containers'
      ],
      correct: 2,
      explanation: 'If an init container fails, the pod is restarted (subject to restartPolicy). Init containers must all succeed before regular containers start — there is no skipping.',
      reference: 'Pattern 2: Init Container — Key behaviors in theory.'
    },
    {
      question: 'A pod has status Init:1/3. What does this mean?',
      options: [
        '1 of 3 regular containers is running',
        '1 of 3 init containers has completed successfully',
        '1 of 3 init containers has failed',
        'The pod is at 1/3 of its initialization progress'
      ],
      correct: 1,
      explanation: 'The Init:X/Y format shows X init containers completed out of Y total init containers. Init:1/3 means the first init container completed and the second is running or pending.',
      reference: 'Debugging command: kubectl get pod — observe the STATUS column for multi-container pods.'
    },
    {
      question: 'Which kubectl command shows logs from a specific container in a multi-container pod?',
      options: [
        'kubectl logs pod-name --container container-name',
        'kubectl logs pod-name -c container-name',
        'kubectl logs pod-name/container-name',
        'Both A and B are correct'
      ],
      correct: 3,
      explanation: 'Both --container and -c flags are valid for specifying a container. Without this flag, kubectl logs defaults to the first container defined in spec.containers.',
      reference: 'kubectl logs -c flag — essential for debugging multi-container pods.'
    },
    {
      question: 'A log shipping sidecar needs to read log files produced by the main container. What is the correct approach?',
      options: [
        'Use a PersistentVolumeClaim shared between both containers',
        'Use an emptyDir volume mounted by both containers',
        'Use environment variables to share the log content',
        'Configure network streaming from main container to sidecar'
      ],
      correct: 1,
      explanation: 'An emptyDir volume is the standard pattern for sharing files between containers in the same pod. It is created when the pod is assigned to a node and exists for the pod\'s lifetime.',
      reference: 'Pattern 1: Sidecar — the YAML example uses emptyDir for log sharing.'
    },
    {
      question: 'Which YAML section defines init containers?',
      options: [
        'spec.containers with initContainer: true',
        'spec.initContainers',
        'metadata.initContainers',
        'spec.containers[].init: true'
      ],
      correct: 1,
      explanation: 'Init containers are defined in spec.initContainers, which is a separate list from spec.containers. This is a common mistake — putting init containers in spec.containers.',
      reference: 'Pattern 2: Init Container YAML example in theory — note spec.initContainers field.'
    },
    {
      question: 'What is the Ambassador pattern in multi-container pods?',
      options: [
        'A sidecar that collects metrics and sends them to a monitoring system',
        'A proxy container that handles network traffic on behalf of the main container',
        'An init container that configures the network before the app starts',
        'A container that normalizes the output format of the main application'
      ],
      correct: 1,
      explanation: 'The Ambassador pattern uses a proxy container that the main app always connects to via localhost. The ambassador handles routing to the actual backend (e.g., database cluster, load balancer).',
      reference: 'Pattern 3: Ambassador in theory — the main container always connects to localhost.'
    }
  ],
  flashcards: [
    {
      front: 'What resources do containers in the same pod share?',
      back: 'Network namespace (same IP, communicate via localhost), storage volumes (emptyDir), and lifecycle (start/stop together). They do NOT share filesystem — each container has its own image filesystem.'
    },
    {
      front: 'What is the Sidecar pattern?',
      back: 'A helper container that runs alongside the main container to extend its functionality. Examples: log shippers (Fluentd), config reloaders, service mesh proxies (Envoy). Both run simultaneously in spec.containers.'
    },
    {
      front: 'What are init containers and when do they run?',
      back: 'Init containers run sequentially before any regular containers start. They must all complete successfully. Used for: waiting for dependencies, pre-populating volumes, running migrations. Defined in spec.initContainers.'
    },
    {
      front: 'Pod status Init:2/3 — what does it mean?',
      back: '2 out of 3 init containers have completed successfully. The third init container is currently running or waiting. Regular containers have not started yet.'
    },
    {
      front: 'What is the Ambassador pattern?',
      back: 'A proxy container that handles network routing on behalf of the main container. The main app always connects to localhost; the ambassador routes to the actual backend. Used for: database proxies, protocol translation, connection pooling.'
    },
    {
      front: 'How do you view logs from a specific container in a multi-container pod?',
      back: 'kubectl logs <pod-name> -c <container-name>\nFor init container logs: kubectl logs <pod-name> -c <init-container-name>\nWithout -c flag, kubectl defaults to the first container in spec.containers.'
    },
    {
      front: 'What type of volume is used to share files between containers in the same pod?',
      back: 'emptyDir volume. It is created when the pod is assigned to a node and deleted when the pod is removed. Both containers mount it at their respective mountPath. It is ephemeral — not for persistent data.'
    },
    {
      front: 'What is the difference between Sidecar and Adapter patterns?',
      back: 'Sidecar: extends or enhances the main container (logging, proxying). Adapter: normalizes/transforms the output of the main container (e.g., converts legacy metrics format to Prometheus). Both run alongside the main container.'
    }
  ],
  lab: {
    scenario: 'You need to build a multi-container pod system that demonstrates all three main patterns: init containers for setup, a sidecar for log collection, and inter-container communication via shared volumes.',
    objective: 'Practice creating multi-container pod manifests with init containers, sidecars, shared volumes, and debugging them with kubectl logs -c.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create a Pod with Init Container + Shared Volume',
        instruction: `Create a pod named \`webapp\` in the default namespace with:
- **Init container** \`setup\` using \`busybox:1.36\` that runs: \`echo "<h1>Hello from init</h1>" > /shared/index.html\`
- **Main container** \`server\` using \`nginx:1.25\` that mounts the same volume at \`/usr/share/nginx/html\`
- **Shared volume** named \`content\` of type \`emptyDir\`

After creating, verify the init container completed and nginx serves the init content.`,
        hints: [
          'Init containers go in spec.initContainers[], not spec.containers[]',
          'Both containers must reference the same volume name in volumeMounts',
          'The volume must be declared in spec.volumes[]',
          'Use kubectl exec to run curl inside the nginx container to verify content'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: webapp
spec:
  initContainers:
  - name: setup
    image: busybox:1.36
    command: ["sh", "-c", "echo '<h1>Hello from init</h1>' > /shared/index.html"]
    volumeMounts:
    - name: content
      mountPath: /shared
  containers:
  - name: server
    image: nginx:1.25
    volumeMounts:
    - name: content
      mountPath: /usr/share/nginx/html
  volumes:
  - name: content
    emptyDir: {}
EOF

# Watch the init container complete
kubectl get pod webapp -w

# Verify nginx serves the init-created content
kubectl exec webapp -c server -- curl -s localhost
\`\`\``,
        verify: `\`\`\`bash
# Pod should be Running (not Init:0/1)
kubectl get pod webapp
# Expected: STATUS = Running

# Init container should show Completed in describe
kubectl describe pod webapp | grep -A5 "Init Containers:"
# Expected: State: Terminated, Reason: Completed, Exit Code: 0

# Nginx should serve init content
kubectl exec webapp -c server -- curl -s localhost
# Expected: <h1>Hello from init</h1>
\`\`\``
      },
      {
        title: 'Add a Sidecar Container for Log Collection',
        instruction: `Delete and recreate \`webapp\` with an additional sidecar container:
- Keep the init container \`setup\` and main container \`server\` from step 1
- Add a new volume \`logs\` of type \`emptyDir\`
- Mount \`logs\` into \`server\` at \`/var/log/nginx\`
- Add sidecar container \`log-collector\` using \`busybox:1.36\` that runs \`tail -f /var/log/nginx/access.log\` and mounts \`logs\` at \`/var/log/nginx\`

After creating, generate some traffic and view the logs from the sidecar.`,
        hints: [
          'Delete the old pod first: kubectl delete pod webapp',
          'The sidecar uses the same command as you would in a terminal: ["sh", "-c", "tail -f /var/log/nginx/access.log"]',
          'Remember to add a --namespace flag if needed',
          'Use kubectl exec to generate traffic: curl localhost'
        ],
        solution: `\`\`\`bash
kubectl delete pod webapp

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: webapp
spec:
  initContainers:
  - name: setup
    image: busybox:1.36
    command: ["sh", "-c", "echo '<h1>Hello from init</h1>' > /shared/index.html"]
    volumeMounts:
    - name: content
      mountPath: /shared
  containers:
  - name: server
    image: nginx:1.25
    volumeMounts:
    - name: content
      mountPath: /usr/share/nginx/html
    - name: logs
      mountPath: /var/log/nginx
  - name: log-collector
    image: busybox:1.36
    command: ["sh", "-c", "tail -f /var/log/nginx/access.log"]
    volumeMounts:
    - name: logs
      mountPath: /var/log/nginx
  volumes:
  - name: content
    emptyDir: {}
  - name: logs
    emptyDir: {}
EOF

# Wait for Running
kubectl get pod webapp -w

# Generate traffic (from another terminal or exec)
kubectl exec webapp -c server -- curl -s localhost

# View sidecar logs
kubectl logs webapp -c log-collector
\`\`\``,
        verify: `\`\`\`bash
# Pod should be Running with 2/2 containers ready
kubectl get pod webapp
# Expected: READY = 2/2, STATUS = Running

# Confirm two containers exist
kubectl get pod webapp -o jsonpath='{.spec.containers[*].name}'
# Expected: server log-collector

# Generate traffic and check sidecar sees it
kubectl exec webapp -c server -- curl -s localhost
kubectl logs webapp -c log-collector
# Expected: nginx access log entry with GET / HTTP/1.1 200
\`\`\``
      },
      {
        title: 'Debug a Broken Multi-Container Pod',
        instruction: `Create the following broken pod and fix it:

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: broken-pod
spec:
  initContainers:
  - name: init-check
    image: busybox:1.36
    command: ["sh", "-c", "echo ready > /data/status && exit 1"]
    volumeMounts:
    - name: data
      mountPath: /data
  containers:
  - name: app
    image: nginx:1.25
    volumeMounts:
    - name: data
      mountPath: /app-data
  volumes:
  - name: data
    emptyDir: {}
\`\`\`

Identify why the pod never reaches Running state, fix it, and verify the pod starts correctly.`,
        hints: [
          'Check kubectl get pod broken-pod and note the status',
          'Use kubectl describe pod broken-pod to see events',
          'Use kubectl logs broken-pod -c init-check to see init container output',
          'The fix is in the init container command — it intentionally exits with code 1'
        ],
        solution: `\`\`\`bash
# Apply the broken pod
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: broken-pod
spec:
  initContainers:
  - name: init-check
    image: busybox:1.36
    command: ["sh", "-c", "echo ready > /data/status && exit 1"]
    volumeMounts:
    - name: data
      mountPath: /data
  containers:
  - name: app
    image: nginx:1.25
    volumeMounts:
    - name: data
      mountPath: /app-data
  volumes:
  - name: data
    emptyDir: {}
EOF

# Diagnose
kubectl get pod broken-pod   # Shows Init:CrashLoopBackOff or Init:Error
kubectl logs broken-pod -c init-check  # Shows "ready" then exit 1

# Fix: remove the "exit 1" — delete and recreate with correct command
kubectl delete pod broken-pod

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: broken-pod
spec:
  initContainers:
  - name: init-check
    image: busybox:1.36
    command: ["sh", "-c", "echo ready > /data/status"]
    volumeMounts:
    - name: data
      mountPath: /data
  containers:
  - name: app
    image: nginx:1.25
    volumeMounts:
    - name: data
      mountPath: /app-data
  volumes:
  - name: data
    emptyDir: {}
EOF

kubectl get pod broken-pod -w
\`\`\``,
        verify: `\`\`\`bash
# Pod should be Running
kubectl get pod broken-pod
# Expected: READY = 1/1, STATUS = Running

# Init container should show Completed
kubectl describe pod broken-pod | grep -A5 "Init Containers:"
# Expected: State: Terminated, Reason: Completed, Exit Code: 0

# Verify the file created by init is accessible in app container
kubectl exec broken-pod -c app -- cat /app-data/status
# Expected: ready
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pod Stuck in Init:CrashLoopBackOff',
      difficulty: 'easy',
      symptom: 'Pod shows status Init:CrashLoopBackOff or Init:Error and never reaches Running state. The application never starts.',
      diagnosis: `\`\`\`bash
# Check pod status
kubectl get pod <pod-name>
# STATUS will show Init:CrashLoopBackOff or Init:0/1 Error

# Get init container logs (critical — use -c flag)
kubectl logs <pod-name> -c <init-container-name>

# See events for more context
kubectl describe pod <pod-name> | grep -A20 "Events:"

# Check previous init container run (if already restarted)
kubectl logs <pod-name> -c <init-container-name> --previous
\`\`\``,
      solution: `The init container is failing (exiting with non-zero code). Common causes:

1. **Command error** — typo in the command, wrong binary, wrong path
   \`\`\`bash
   # Check the command in the pod spec
   kubectl get pod <pod-name> -o yaml | grep -A10 initContainers
   \`\`\`

2. **Dependency not ready** — waiting for a service that doesn't exist
   \`\`\`bash
   # If using nc -z service port, verify the service exists
   kubectl get svc
   \`\`\`

3. **Volume mount issue** — directory doesn't exist or permission denied
   \`\`\`bash
   # Check volumeMounts and volumes definitions
   kubectl get pod <pod-name> -o yaml | grep -A5 volumeMounts
   \`\`\`

**Fix**: Edit the pod's init container command (delete and recreate — pods are immutable):
\`\`\`bash
kubectl delete pod <pod-name>
# Fix the manifest and reapply
kubectl apply -f fixed-pod.yaml
\`\`\``
    },
    {
      title: 'Wrong Container Logs Shown / Cannot View Container Logs',
      difficulty: 'medium',
      symptom: 'Running kubectl logs shows logs from the wrong container, or returns an error: "a container name must be specified for pod X, choose one of: [container1 container2]".',
      diagnosis: `\`\`\`bash
# See which containers exist in the pod
kubectl get pod <pod-name> -o jsonpath='{.spec.containers[*].name}'
kubectl get pod <pod-name> -o jsonpath='{.spec.initContainers[*].name}'

# See full container list via describe
kubectl describe pod <pod-name> | grep -E "^  [A-Za-z].*:" | head -20

# View all containers and their status at once
kubectl get pod <pod-name> -o yaml | grep -E "name:|state:|ready:" | head -30
\`\`\``,
      solution: `Always specify the container name with -c flag in multi-container pods:

\`\`\`bash
# Correct syntax
kubectl logs <pod-name> -c <container-name>

# For init containers (use same -c flag)
kubectl logs <pod-name> -c <init-container-name>

# View previous container run (useful for CrashLoopBackOff)
kubectl logs <pod-name> -c <container-name> --previous

# Stream logs from a specific container
kubectl logs <pod-name> -c <container-name> -f

# Example with known container names
kubectl logs webapp -c log-collector
kubectl logs webapp -c init-setup --previous
\`\`\`

**Exam tip**: In multi-container pods, always identify which container you need before running kubectl logs. The error message "choose one of: [...]" helpfully lists available container names.`
    }
  ]
};
