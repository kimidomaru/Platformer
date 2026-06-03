window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['observability/probes'] = {
  theory: `
# Probes & Health Checks

## Exam Relevance
> Probes are tested in CKAD (Application Observability and Maintenance — 15%) and CKA. Expect tasks configuring liveness, readiness, and startup probes, and debugging probe-related failures.

## The Three Probe Types

| Probe | Purpose | Action when fails |
|-------|---------|-------------------|
| **livenessProbe** | Is the container alive? | Container is **restarted** |
| **readinessProbe** | Is the container ready to serve traffic? | Pod is **removed from Service endpoints** |
| **startupProbe** | Has the container finished starting? | Container is **restarted** (liveness/readiness disabled until startupProbe succeeds) |

### When to use each

\`\`\`
startupProbe  → Slow-starting apps (JVM, large databases)
                Prevents liveness from killing slow-starting containers

livenessProbe → Detect deadlocks, infinite loops, stuck processes
                Container should be restarted to recover

readinessProbe → Temporary unavailability (warming up cache, loading data)
                 Traffic is withheld until ready; no restart
\`\`\`

## Probe Mechanisms

### HTTP GET

\`\`\`yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
    httpHeaders:
    - name: Custom-Header
      value: Awesome
\`\`\`

### TCP Socket

\`\`\`yaml
readinessProbe:
  tcpSocket:
    port: 3306    # checks if port is open (no data exchange)
\`\`\`

### Exec (command)

\`\`\`yaml
livenessProbe:
  exec:
    command:
    - cat
    - /tmp/healthy    # file must exist for probe to pass
\`\`\`

### gRPC (K8s 1.24+)

\`\`\`yaml
livenessProbe:
  grpc:
    port: 2379
    service: ""    # optional service name for health check
\`\`\`

## Probe Configuration Parameters

\`\`\`yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 15    # wait before first probe (app startup time)
  periodSeconds: 20          # probe every 20 seconds
  timeoutSeconds: 1          # probe times out after 1 second
  successThreshold: 1        # consecutive successes to mark healthy
  failureThreshold: 3        # consecutive failures before action
\`\`\`

| Parameter | Default | Description |
|-----------|---------|-------------|
| \`initialDelaySeconds\` | 0 | Seconds to wait after container start |
| \`periodSeconds\` | 10 | How often to probe |
| \`timeoutSeconds\` | 1 | Probe timeout |
| \`successThreshold\` | 1 | Min consecutive successes |
| \`failureThreshold\` | 3 | Min consecutive failures before action |

## Complete YAML Examples

### Production-ready probe configuration

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: production-app
spec:
  containers:
  - name: app
    image: myapp:1.0
    ports:
    - containerPort: 8080
    startupProbe:
      httpGet:
        path: /startup
        port: 8080
      failureThreshold: 30      # 30 * 10s = 5 minutes for startup
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 10
      failureThreshold: 3
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8080
      initialDelaySeconds: 15
      periodSeconds: 20
      timeoutSeconds: 3
      failureThreshold: 3
\`\`\`

### TCP probe for a database

\`\`\`yaml
livenessProbe:
  tcpSocket:
    port: 5432
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  exec:
    command:
    - pg_isready
    - -U
    - postgres
  initialDelaySeconds: 5
  periodSeconds: 5
\`\`\`

### File-based liveness (useful for long-running batch jobs)

\`\`\`yaml
livenessProbe:
  exec:
    command:
    - test
    - -f
    - /tmp/healthy
  periodSeconds: 30
\`\`\`

## Probe Failure Diagnosis

\`\`\`bash
# Check probe configuration
kubectl describe pod <pod> | grep -A20 "Liveness:\|Readiness:\|Startup:"

# Check probe failure events
kubectl describe pod <pod> | grep -A3 "Events:"
# "Liveness probe failed: ..." or "Readiness probe failed: ..."

# Check restart count (liveness failures cause restarts)
kubectl get pod <pod>
# RESTARTS column

# Check why probe is failing (from container perspective)
kubectl exec <pod> -- curl -v http://localhost:8080/healthz
kubectl exec <pod> -- cat /tmp/healthy
\`\`\`

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Pod restarts repeatedly | Liveness probe too aggressive | Increase failureThreshold or initialDelaySeconds |
| Service 503, pod Running | Readiness probe failing | Fix app or check probe endpoint |
| Slow app killed before start | No startupProbe | Add startupProbe with high failureThreshold |
| Probe timeout | App too slow to respond | Increase timeoutSeconds |
| Pod always Ready immediately | No readiness probe defined | Add readinessProbe for proper traffic management |

## Killer.sh Style Challenge

> **Task**: A pod is running but users get 503 errors occasionally. The app takes 30 seconds to load data on startup. Configure probes so:
> 1. Liveness checks \`/health\` on port 8080 every 30 seconds
> 2. Readiness checks \`/ready\` on port 8080, only after 30 seconds initial delay
> 3. The pod is not killed during startup

\`\`\`yaml
startupProbe:
  httpGet:
    path: /ready
    port: 8080
  failureThreshold: 6    # 6 * 10s = 60s to start
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  periodSeconds: 10
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  periodSeconds: 30
\`\`\`
`,
  quiz: [
    {
      question: 'A liveness probe fails 3 consecutive times (failureThreshold: 3). What happens to the container?',
      options: [
        'The pod is deleted and re-created',
        'The container is restarted (but the pod object remains)',
        'The pod is removed from service endpoints',
        'The pod transitions to Failed state'
      ],
      correct: 1,
      explanation: 'A liveness probe failure causes the container to be restarted (by the kubelet). The pod itself is NOT deleted. The restart count increments and the pod may enter CrashLoopBackOff if it keeps failing.',
      reference: 'Liveness = restart container. Readiness = remove from endpoints. Different actions!'
    },
    {
      question: 'A pod has a readiness probe that fails. What happens to traffic from a Service?',
      options: [
        'Traffic is still sent to the pod, but with lower priority',
        'The pod is removed from the service\'s endpoints and receives no traffic',
        'The pod is restarted to recover readiness',
        'The pod\'s replicas are scaled up to compensate'
      ],
      correct: 1,
      explanation: 'A failing readiness probe removes the pod from the Service\'s endpoint list. No new traffic is routed to it. The pod continues running — it is not restarted. When the probe passes again, it is re-added to endpoints.',
      reference: 'Use readiness for: warm-up time, temporary maintenance mode, circuit breakers.'
    },
    {
      question: 'An app takes 3 minutes to start (loads large dataset). Without a startupProbe, what happens if you set `livenessProbe.initialDelaySeconds: 10` and `failureThreshold: 3`?',
      options: [
        'The pod waits 3 minutes then starts probing',
        'The liveness probe fails during startup and restarts the container in a loop',
        'The pod stays in Pending until the app is ready',
        'Kubernetes automatically detects slow startups and pauses probing'
      ],
      correct: 1,
      explanation: 'The liveness probe starts 10 seconds after container start. If the app isn\'t ready after 10s + 3 failures × periodSeconds, kubelet kills and restarts the container → CrashLoopBackOff. startupProbe solves this by disabling liveness until startup succeeds.',
      reference: 'startupProbe pattern: failureThreshold × periodSeconds = max startup time allowed.'
    },
    {
      question: 'What is the correct probe type to check if a TCP port is open?',
      options: [
        'httpGet with port',
        'exec with netcat command',
        'tcpSocket with port',
        'grpc with port'
      ],
      correct: 2,
      explanation: '`tcpSocket` probe attempts a TCP connection to the specified port. If the connection succeeds (port is open), the probe passes. No data is sent — it\'s purely a connectivity check.',
      reference: 'tcpSocket is ideal for: databases (MySQL:3306, PostgreSQL:5432), caches (Redis:6379).'
    },
    {
      question: 'What is the maximum startup time allowed with this startupProbe: `failureThreshold: 12, periodSeconds: 5`?',
      options: [
        '12 seconds',
        '5 minutes',
        '60 seconds',
        '12 minutes'
      ],
      correct: 2,
      explanation: 'Max startup time = failureThreshold × periodSeconds = 12 × 5 = 60 seconds. The probe fails 12 times before giving up. During this window, liveness and readiness probes are disabled.',
      reference: 'Calculate: failureThreshold × periodSeconds = total allowed startup window.'
    },
    {
      question: 'A pod is Running but the Service shows 0 endpoints. The pod has no readiness probe configured. What happens?',
      options: [
        'Without a readiness probe, the pod is never added to endpoints',
        'Without a readiness probe, the pod is immediately considered Ready and added to endpoints',
        'The pod waits for a default 10-second readiness check',
        'The Service endpoints are always empty unless a LoadBalancer is used'
      ],
      correct: 1,
      explanation: 'If no readiness probe is configured, the pod is immediately considered Ready as soon as all containers start. It is added to service endpoints right away. Readiness probes are optional but recommended for production.',
      reference: 'No readiness probe → always Ready. Empty endpoints → probe failing OR selector mismatch.'
    },
    {
      question: 'What does `successThreshold: 3` in a readiness probe mean?',
      options: [
        'The probe must succeed at least 3 times total during the pod lifetime',
        'After being marked not-ready, the probe must succeed 3 consecutive times before the pod is marked Ready again',
        'The first 3 probe successes are ignored',
        'Success threshold only applies to liveness probes'
      ],
      correct: 1,
      explanation: '`successThreshold` defines how many consecutive successes are needed to mark a container as healthy after it was unhealthy. Default is 1 for liveness (1 success re-marks healthy); for readiness, >1 means the pod needs multiple consecutive successes before getting traffic.',
      reference: 'successThreshold for liveness must always be 1. For readiness, higher values prevent flapping.'
    },
    {
      question: 'Which probe type is most appropriate for checking if a Java application has finished initializing (typically takes 60-90 seconds)?',
      options: [
        'livenessProbe with initialDelaySeconds: 90',
        'readinessProbe with initialDelaySeconds: 90',
        'startupProbe with failureThreshold: 18 and periodSeconds: 5',
        'Both A and B together'
      ],
      correct: 2,
      explanation: 'startupProbe is designed for slow-starting apps. With failureThreshold:18 × periodSeconds:5 = 90 seconds max startup time. During this window, liveness won\'t kill the pod. After startup succeeds, liveness and readiness take over.',
      reference: 'startupProbe replaces high initialDelaySeconds — more precise and more reliable.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 3 probe types and what action does each take on failure?',
      back: '| Probe | Failure Action |\n|-------|----------------|\n| **livenessProbe** | Restart container |\n| **readinessProbe** | Remove from Service endpoints |\n| **startupProbe** | Restart container (blocks liveness/readiness until success) |\n\nKey: liveness = restart, readiness = no traffic, startup = slow apps'
    },
    {
      front: 'What are the 4 probe mechanisms?',
      back: '1. **httpGet**: HTTP request to path+port (expects 2xx-3xx)\n2. **tcpSocket**: TCP connection attempt to port (just checks if open)\n3. **exec**: Runs command inside container (exit code 0 = success)\n4. **grpc**: gRPC health check protocol (K8s 1.24+)\n\nMost common: httpGet for web apps, tcpSocket for databases, exec for files.'
    },
    {
      front: 'What is the maximum allowed startup time formula for startupProbe?',
      back: '**Max startup time = failureThreshold × periodSeconds**\n\nExample:\n```yaml\nstartupProbe:\n  failureThreshold: 30  # 30 failures\n  periodSeconds: 10     # every 10 seconds\n  # Max startup = 30 × 10 = 300 seconds (5 minutes)\n```\n\nDuring startupProbe: liveness and readiness probes are **disabled**.\nAfter startupProbe succeeds: liveness and readiness activate.'
    },
    {
      front: 'What are the 5 configurable probe parameters and their defaults?',
      back: '| Parameter | Default | Purpose |\n|-----------|---------|--------|\n| initialDelaySeconds | 0 | Wait before first probe |\n| periodSeconds | 10 | Probe interval |\n| timeoutSeconds | 1 | Probe timeout |\n| successThreshold | 1 | Consecutive successes needed |\n| failureThreshold | 3 | Consecutive failures before action |\n\n**Common exam mistake**: timeoutSeconds default is 1 second — too short for slow apps!'
    },
    {
      front: 'A pod is Running but has 503 errors. How do you check if a readiness probe is causing the issue?',
      back: '```bash\n# Check probe configuration and status\nkubectl describe pod <pod> | grep -A10 "Readiness:"\n# Look for: "Readiness probe failed:"\n\n# Check endpoints\nkubectl get endpoints <service-name>\n# If empty → pod not ready (probe failing)\n\n# Check restart count and events\nkubectl get pods  # RESTARTS column\nkubectl describe pod <pod> | tail -20  # Events\n\n# Test probe manually\nkubectl exec <pod> -- curl http://localhost:8080/ready\n```'
    },
    {
      front: 'When should you use startupProbe vs initialDelaySeconds?',
      back: '**initialDelaySeconds**: Simple delay before first probe — fixed wait time\n- ❌ Wastes time if app starts faster\n- ❌ May fail if app sometimes starts slower\n\n**startupProbe**: Dynamic — keeps trying until success or max time\n- ✅ App starts faster = ready faster\n- ✅ App starts slower = still works (up to max time)\n- ✅ Prevents liveness probe from killing slow-starting app\n\nPrefer startupProbe for all production apps with variable startup time.'
    },
    {
      front: 'What HTTP status codes cause a httpGet probe to pass?',
      back: 'Status codes **>= 200 and < 400** are considered success.\n\n| Code | Result |\n|------|--------|\n| 200 OK | ✅ Pass |\n| 204 No Content | ✅ Pass |\n| 301 Redirect | ✅ Pass |\n| 400 Bad Request | ❌ Fail |\n| 404 Not Found | ❌ Fail |\n| 500 Server Error | ❌ Fail |\n\nDesign health endpoints to return 200 when healthy, 503 when not.'
    },
    {
      front: 'What is the difference between liveness and readiness failure for a multi-replica Deployment?',
      back: '**Liveness failure (1 pod)**:\n- That pod\'s container is restarted\n- RESTARTS count increases\n- Other replicas unaffected\n- Pod may enter CrashLoopBackOff\n\n**Readiness failure (1 pod)**:\n- That pod is removed from Service endpoints\n- Traffic goes to remaining Ready pods\n- Pod is NOT restarted\n- Pod re-joins endpoints when probe passes again\n\nReadiness = zero-downtime traffic management. Liveness = crash recovery.'
    }
  ],
  lab: {
    scenario: 'Configure health checks for a web application that has a slow startup time, needs traffic management during load spikes, and should recover automatically from deadlocks.',
    objective: 'Add startup, liveness, and readiness probes with appropriate parameters and observe their behavior.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Add Liveness and Readiness Probes',
        instruction: `Create a Pod **health-app** with image \`nginx\` that has:
- **readinessProbe**: HTTP GET \`/\` on port 80, every 5 seconds, initially after 5s
- **livenessProbe**: HTTP GET \`/\` on port 80, every 30 seconds, initially after 15s, timeout 3s

Verify the pod becomes Ready and observe the probe configuration.`,
        hints: [
          'Both probes use httpGet.path and httpGet.port',
          'readiness uses shorter intervals (5s) than liveness (30s)',
          'kubectl describe shows probe config under container details',
          'Check READY column to confirm readiness probe is passing'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: health-app
spec:
  containers:
  - name: nginx
    image: nginx
    ports:
    - containerPort: 80
    readinessProbe:
      httpGet:
        path: /
        port: 80
      initialDelaySeconds: 5
      periodSeconds: 5
      failureThreshold: 3
    livenessProbe:
      httpGet:
        path: /
        port: 80
      initialDelaySeconds: 15
      periodSeconds: 30
      timeoutSeconds: 3
      failureThreshold: 3
EOF

kubectl get pod health-app -w
# Watch until READY shows 1/1
kubectl describe pod health-app | grep -A10 "Readiness:\|Liveness:"
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod health-app
# Expected: READY 1/1, STATUS Running

kubectl describe pod health-app | grep -A5 "Liveness:"
# Expected: liveness probe config visible with correct params

kubectl describe pod health-app | grep -A5 "Readiness:"
# Expected: readiness probe config visible

kubectl describe pod health-app | grep "Restart Count"
# Expected: 0 (probes passing, no restarts)
\`\`\``
      },
      {
        title: 'Simulate Probe Failure and Recovery',
        instruction: `Demonstrate readiness probe failure:
1. Create a Pod with a readiness probe checking for file \`/tmp/ready\`
2. Observe the pod is NOT Ready initially (file doesn't exist)
3. Create the file inside the container
4. Observe the pod becomes Ready
5. Then delete the file to see it become NotReady again`,
        hints: [
          'Use exec probe: command: [test, -f, /tmp/ready]',
          'kubectl exec to create the file: touch /tmp/ready',
          'Watch the READY column: kubectl get pod probe-test -w',
          'Use kubectl exec to delete: rm /tmp/ready'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: probe-test
spec:
  containers:
  - name: app
    image: busybox
    command: ["sleep", "3600"]
    readinessProbe:
      exec:
        command:
        - test
        - -f
        - /tmp/ready
      periodSeconds: 5
      failureThreshold: 1
EOF

# Pod NOT Ready (file doesn't exist)
kubectl get pod probe-test
# Expected: READY 0/1

# Create the file → pod becomes Ready
kubectl exec probe-test -- touch /tmp/ready
sleep 10
kubectl get pod probe-test
# Expected: READY 1/1

# Delete the file → pod becomes NotReady
kubectl exec probe-test -- rm /tmp/ready
sleep 10
kubectl get pod probe-test
# Expected: READY 0/1 again
\`\`\``,
        verify: `\`\`\`bash
# After creating /tmp/ready:
kubectl get pod probe-test
# Expected: READY 1/1

kubectl describe pod probe-test | grep Events -A5
# Look for: Readiness probe succeeded / failed events

# After removing /tmp/ready:
sleep 10
kubectl get pod probe-test
# Expected: READY 0/1

kubectl describe pod probe-test | tail -10
# Expected: "Readiness probe failed" event
\`\`\``
      },
      {
        title: 'Configure startupProbe for Slow-Starting App',
        instruction: `Create a Pod **slow-start** that simulates a slow-starting app:
- Container: busybox running \`sleep 30 && touch /tmp/ready && sleep 3600\` (30s startup time)
- **startupProbe**: exec test -f /tmp/ready, failureThreshold 6, periodSeconds 5 (= 30s max)
- **readinessProbe**: same exec check, periodSeconds 5
- **livenessProbe**: exec test -f /tmp/ready, periodSeconds 10

Verify the pod eventually starts without being killed during the 30-second startup.`,
        hints: [
          'failureThreshold × periodSeconds = 6 × 5 = 30s max startup window',
          'Without startupProbe, liveness would kill the pod before it finishes starting',
          'The startupProbe blocks liveness/readiness until it succeeds',
          'Watch kubectl get pod slow-start -w to see the transition'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: slow-start
spec:
  containers:
  - name: app
    image: busybox
    command:
    - /bin/sh
    - -c
    - "sleep 30 && touch /tmp/ready && sleep 3600"
    startupProbe:
      exec:
        command: [test, -f, /tmp/ready]
      failureThreshold: 6
      periodSeconds: 5
    readinessProbe:
      exec:
        command: [test, -f, /tmp/ready]
      periodSeconds: 5
    livenessProbe:
      exec:
        command: [test, -f, /tmp/ready]
      periodSeconds: 10
EOF

# Watch the pod — it takes ~30s to become Ready
kubectl get pod slow-start -w
# Expected: stays 0/1 for ~30s, then becomes 1/1
\`\`\``,
        verify: `\`\`\`bash
# Wait ~35 seconds
kubectl get pod slow-start
# Expected: READY 1/1, STATUS Running, RESTARTS 0

kubectl describe pod slow-start | grep -A5 "Startup\|Readiness\|Liveness"
# Expected: all 3 probes configured

kubectl describe pod slow-start | grep "Restart Count:"
# Expected: Restart Count: 0
# (without startupProbe, this would be 1+ due to liveness killing during startup)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pod restarting every 30 seconds — overly strict liveness',
      difficulty: 'easy',
      symptom: 'A pod keeps restarting (RESTARTS count keeps increasing) every 30 seconds. The app seems fine between restarts but crashes suddenly.',
      diagnosis: `\`\`\`bash
# Check restart count
kubectl get pod <pod>
# RESTARTS column incrementing

# Check liveness probe configuration
kubectl describe pod <pod> | grep -A10 "Liveness:"
# Look for: timeoutSeconds, failureThreshold, periodSeconds

# Check events for probe failures
kubectl describe pod <pod> | grep -A5 "Events:"
# "Liveness probe failed: ..."

# Check app response time
kubectl exec <pod> -- curl -w "%{time_total}s" http://localhost:8080/health
# If > timeoutSeconds → probe is timing out
\`\`\``,
      solution: `The liveness probe timeoutSeconds is too low — the app responds but too slowly.

\`\`\`bash
# Fix: increase timeoutSeconds and/or failureThreshold
kubectl edit pod <pod>   # if editable
# OR for a Deployment:
kubectl edit deployment <name>

# Change in containers.livenessProbe:
# timeoutSeconds: 5    (from 1)
# failureThreshold: 5  (from 3)
# initialDelaySeconds: 30  (give more startup time)

# OR use kubectl patch
kubectl patch deployment <name> \\
  --type=json \\
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/livenessProbe/timeoutSeconds","value":5}]'

# Verify no more unexpected restarts
kubectl get pod -l app=<name> -w
\`\`\``
    },
    {
      title: 'Service has endpoints but returns 503 — readiness probe misconfigured',
      difficulty: 'medium',
      symptom: 'Service endpoints are populated (kubectl get endpoints shows pod IPs), but clients still get 503 errors for some requests.',
      diagnosis: `\`\`\`bash
# Confirm endpoints exist
kubectl get endpoints <svc-name>
# Shows pod IPs — so selector is correct

# Check pod readiness status more carefully
kubectl get pods -l <selector> -o wide
# Check: READY column — are all pods 1/1?
# A pod might be 0/1 (not ready) but still have an IP in endpoints (race condition)

# Actually check the endpoints matches ready pods
kubectl get endpoints <svc-name> -o yaml
# NotReadyAddresses vs Addresses

# Describe the pod with 503 errors
kubectl describe pod <pod>
# Check readiness probe: is the probe endpoint correct?
# Is the port matching the container's actual port?

# Test the probe endpoint manually
kubectl exec <pod> -- curl http://localhost:<port><path>
\`\`\``,
      solution: `The readiness probe endpoint or port is wrong, causing pods to show as not-ready even though they serve traffic on the correct port.

\`\`\`bash
# Check what port the app actually listens on
kubectl exec <pod> -- ss -tlnp
# Or: kubectl exec <pod> -- netstat -tlnp

# Check probe configuration
kubectl describe pod <pod> | grep -A5 "Readiness:"

# Common fix: correct the readiness probe port or path
kubectl edit deployment <name>
# Fix readinessProbe.httpGet.port or readinessProbe.httpGet.path

# Example fix:
# readinessProbe:
#   httpGet:
#     path: /health    ← correct path (was /ready which doesn't exist)
#     port: 8080       ← correct port (was 80)

# After fix, trigger rolling restart
kubectl rollout restart deployment/<name>

# Verify pods become Ready
kubectl get pods -l app=<name> -w
\`\`\``
    }
  ]
};
