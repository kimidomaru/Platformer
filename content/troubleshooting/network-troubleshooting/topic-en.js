window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['troubleshooting/network-troubleshooting'] = {
  theory: `# Service & Network Troubleshooting

## Exam Relevance
> Network troubleshooting is one of the highest-weighted areas of the CKA exam (~13% troubleshooting domain). You must be able to diagnose why a service does not reach pods, why a pod cannot reach another pod, and why DNS resolution fails. This topic requires methodical debugging — tools like kubectl exec, nslookup, curl, and netstat are essential.

## Mental Model: Request Path

When a client accesses a Service, the request flows through:

\`\`\`
Client → Service (ClusterIP) → kube-proxy (iptables/ipvs) → Pod (matched by selector)
\`\`\`

Each step can fail. Always debug **from the pod backward**:
1. Is the pod running?
2. Does the service exist and select the pod?
3. Are there Endpoints?
4. Does DNS resolve the service?
5. Can you reach the pod directly (bypassing service)?

## Step 1 — Check Pod Health

\`\`\`bash
# Pod must be Running AND Ready
kubectl get pods -l app=myapp
# READY column must show 1/1 (or N/N for multi-container)

# If not ready, check events
kubectl describe pod <pod-name>

# Check readiness probe if READY shows 0/1
kubectl get pod <pod-name> -o yaml | grep -A10 readinessProbe
\`\`\`

## Step 2 — Check Service Definition

\`\`\`bash
# Service must exist in the correct namespace
kubectl get svc myapp-service -n <namespace>

# Check selector matches pod labels
kubectl describe svc myapp-service
# Look for: Selector: app=myapp

# Compare with pod labels
kubectl get pods --show-labels
# pod labels must contain: app=myapp
\`\`\`

## Step 3 — Check Endpoints (Most Important)

\`\`\`bash
# If Endpoints is empty (<none>), the selector does NOT match any pod
kubectl get endpoints myapp-service
# Expected: ENDPOINTS = 10.244.1.5:8080,10.244.2.3:8080

# If empty:
kubectl describe endpoints myapp-service
# Shows "No endpoints found" — selector mismatch

# Verify the port matches
kubectl get pod <pod-name> -o yaml | grep containerPort
kubectl get svc myapp-service -o yaml | grep targetPort
\`\`\`

**Empty Endpoints = Selector mismatch.** This is the #1 cause of Service failures.

## Step 4 — Test DNS Resolution

\`\`\`bash
# Run a debug pod in the same namespace
kubectl run debug --image=busybox:1.36 --rm -it -- sh

# Inside the debug pod:
nslookup myapp-service
# Expected: Address: 10.96.0.100 (ClusterIP)

# Full DNS name (cross-namespace):
nslookup myapp-service.production.svc.cluster.local

# Check CoreDNS pods are running
kubectl get pods -n kube-system -l k8s-app=kube-dns
\`\`\`

DNS format: \`<service>.<namespace>.svc.<cluster-domain>\`

## Step 5 — Test Connectivity

\`\`\`bash
# From within the cluster, curl the service
kubectl run curl-test --image=curlimages/curl:8.4.0 --rm -it -- \
  curl http://myapp-service:8080

# Test directly to pod IP (bypass service/kube-proxy)
kubectl get pod <pod-name> -o wide   # get pod IP
kubectl run curl-test --image=curlimages/curl:8.4.0 --rm -it -- \
  curl http://10.244.1.5:8080

# If pod direct works but service doesn't → kube-proxy or selector issue
# If pod direct fails → pod itself is broken
\`\`\`

## Step 6 — Check Port Configuration

The most common port confusion:

| Field | Meaning |
|-------|---------|
| \`port\` | Port exposed on the Service (what clients connect to) |
| \`targetPort\` | Port on the Pod that traffic is forwarded to |
| \`containerPort\` | Declarative port on the container (informational only) |
| \`nodePort\` | Port on the Node (NodePort/LoadBalancer services) |

\`\`\`yaml
# Service port mapping example:
spec:
  ports:
  - port: 80          # Client connects to :80 on ClusterIP
    targetPort: 8080  # Traffic forwarded to pod port 8080
    nodePort: 30080   # Accessible on Node:30080 (NodePort only)
\`\`\`

\`\`\`bash
# Check if pod is actually listening on targetPort
kubectl exec <pod-name> -- netstat -tlnp
# OR
kubectl exec <pod-name> -- ss -tlnp
\`\`\`

## Service Types and Access

| Type | Accessible From | Use Case |
|------|----------------|----------|
| ClusterIP | Within cluster only | Internal microservice communication |
| NodePort | NodeIP:NodePort from outside | Dev/test external access |
| LoadBalancer | External LB IP | Production external access (cloud) |
| ExternalName | DNS CNAME redirect | Map service to external DNS |

## NetworkPolicy Impact

\`\`\`bash
# Check if NetworkPolicies are blocking traffic
kubectl get networkpolicy -A

# If policies exist, check if they affect the namespace/pod
kubectl describe networkpolicy <name> -n <namespace>

# A NetworkPolicy selects pods and RESTRICTS traffic — verify:
# 1. Does the policy select the source pod?
# 2. Does the policy allow egress to the destination?
# 3. Does the policy select the destination pod?
# 4. Does the policy allow ingress from the source?
\`\`\`

## CoreDNS Debugging

\`\`\`bash
# Check CoreDNS is running
kubectl get pods -n kube-system -l k8s-app=kube-dns
# Expected: 2/2 Running (typically 2 CoreDNS replicas)

# Check CoreDNS logs for errors
kubectl logs -n kube-system -l k8s-app=kube-dns

# Check CoreDNS ConfigMap
kubectl get configmap coredns -n kube-system -o yaml

# From a debug pod, verify /etc/resolv.conf
kubectl run debug --image=busybox:1.36 --rm -it -- cat /etc/resolv.conf
# Expected: nameserver 10.96.0.10 (CoreDNS ClusterIP)
#           search default.svc.cluster.local svc.cluster.local cluster.local
\`\`\`

## Common Failure Scenarios

1. **Empty endpoints** — label selector doesn't match pod labels (typo, wrong key/value)
2. **Wrong targetPort** — service sends to port 80 but pod listens on 8080
3. **Readiness probe failing** — pod is Running but NOT Ready, so excluded from endpoints
4. **Wrong namespace** — service and pod are in different namespaces, DNS query uses wrong namespace
5. **NetworkPolicy blocking** — egress deny-all or ingress deny-all preventing traffic
6. **CoreDNS down** — nslookup fails, DNS resolution broken cluster-wide
7. **Service type mismatch** — using ClusterIP when external access needed

## Killer.sh Style Challenge

**Task**: The application in namespace \`prod\` cannot reach the database. Service \`db-service\` exists but returns connection refused. Diagnose and fix:
1. Check pod health in the \`prod\` namespace
2. Verify endpoints for \`db-service\`
3. Test DNS resolution from an app pod
4. Identify the root cause and fix it
`,
  quiz: [
    {
      question: 'You run kubectl get endpoints myapp-svc and the output shows <none>. What is the most likely cause?',
      options: [
        'The service has no pods in the cluster',
        'The service selector does not match any running pod labels',
        'The service port is misconfigured',
        'kube-proxy is not running on the node'
      ],
      correct: 1,
      explanation: 'Empty endpoints means the service selector does not match any pod labels. This is the #1 cause of Service failures. Check: kubectl describe svc vs kubectl get pods --show-labels.',
      reference: 'Step 3 — Check Endpoints in theory. Empty Endpoints = Selector mismatch.'
    },
    {
      question: 'What is the correct DNS name to resolve a service named "api" in namespace "backend" from another namespace?',
      options: [
        'api.svc.cluster.local',
        'api.backend',
        'api.backend.svc.cluster.local',
        'backend.api.svc.cluster.local'
      ],
      correct: 2,
      explanation: 'The full DNS format is <service>.<namespace>.svc.<cluster-domain>. From within the same namespace, just "api" works. Cross-namespace requires the full FQDN: api.backend.svc.cluster.local.',
      reference: 'Step 4 — Test DNS Resolution in theory. DNS format: service.namespace.svc.cluster-domain.'
    },
    {
      question: 'A pod shows READY 0/1 but STATUS Running. Why would it be excluded from Service endpoints?',
      options: [
        'It would not be excluded — Running pods are always in endpoints',
        'The readiness probe is failing, so Kubernetes does not add it to endpoints',
        'The pod needs a restart to join endpoints',
        'The service must be deleted and recreated to pick up the pod'
      ],
      correct: 1,
      explanation: 'Kubernetes only adds pods to endpoints when they are Ready (readiness probe passes). A Running but not Ready pod (0/1) is excluded from endpoints to prevent sending traffic to an unhealthy pod.',
      reference: 'Step 1 — Check Pod Health. The READY column must show N/N for inclusion in endpoints.'
    },
    {
      question: 'What is the difference between Service port and targetPort?',
      options: [
        'port is for external traffic; targetPort is for internal traffic within the cluster',
        'port is what clients connect to on the ClusterIP; targetPort is the port on the Pod',
        'port is the NodePort; targetPort is the ContainerPort',
        'They are identical — both refer to the same port on the pod'
      ],
      correct: 1,
      explanation: 'port is the port exposed on the Service ClusterIP (what clients use). targetPort is the port the traffic is forwarded to on the actual Pod. They often differ (e.g., port:80, targetPort:8080).',
      reference: 'Step 6 — Check Port Configuration table in theory.'
    },
    {
      question: 'You run curl http://myservice from inside a pod and get "connection refused". But curl http://10.244.1.5:8080 (direct pod IP) works. What is the most likely issue?',
      options: [
        'The pod is running on the wrong node',
        'The service targetPort does not match the pod port (80 vs 8080)',
        'NetworkPolicy is blocking the pod',
        'The pod needs a restart'
      ],
      correct: 1,
      explanation: 'If direct pod IP:port works but service does not, the issue is in the Service layer. The service likely has port:80 but targetPort defaults to 80, while the pod listens on 8080. Fix: set targetPort: 8080.',
      reference: 'Step 5 — Test Connectivity. If pod direct works but service doesn\'t → kube-proxy or selector issue.'
    },
    {
      question: 'How do you run a quick debug pod for network troubleshooting that auto-deletes when you exit?',
      options: [
        'kubectl create pod debug --image=busybox --restart=Never',
        'kubectl run debug --image=busybox:1.36 --rm -it -- sh',
        'kubectl debug node/node01 --image=busybox',
        'kubectl exec -it -- busybox sh'
      ],
      correct: 1,
      explanation: 'kubectl run with --rm deletes the pod when the command exits, -it attaches stdin/tty for interactive use, and -- sh starts a shell. This is the standard pattern for ad-hoc network debugging.',
      reference: 'Step 4 and Step 5 in theory — debug pod pattern for DNS and connectivity testing.'
    },
    {
      question: 'CoreDNS pods are down. What symptom do you observe in application pods?',
      options: [
        'All pods are evicted from their nodes',
        'Services stop working but pod-to-pod IP communication still works',
        'NetworkPolicies stop being enforced',
        'All pods enter CrashLoopBackOff'
      ],
      correct: 1,
      explanation: 'CoreDNS provides DNS resolution. When it is down, service names cannot be resolved, but direct IP-to-IP communication still works. Applications using service names (most apps) will fail; those using pod IPs directly will still work.',
      reference: 'CoreDNS Debugging section in theory.'
    },
    {
      question: 'Which command checks what port a process inside a pod is actually listening on?',
      options: [
        'kubectl get pod <name> -o yaml | grep port',
        'kubectl exec <pod> -- netstat -tlnp',
        'kubectl describe pod <name> | grep Port',
        'kubectl port-forward <pod> :0'
      ],
      correct: 1,
      explanation: 'netstat -tlnp (or ss -tlnp) inside the pod shows active listening ports. This confirms whether the app is actually listening on the port specified in targetPort — a common cause of "connection refused" errors.',
      reference: 'Step 6 — Check Port Configuration. Verify the pod is listening on the targetPort.'
    }
  ],
  flashcards: [
    {
      front: 'What is the #1 cause of a Service returning no traffic?',
      back: 'Empty Endpoints — the service label selector does not match any running pod labels. Check: kubectl get endpoints <svc-name>. If <none>, compare selector in service vs labels in pods with kubectl get pods --show-labels.'
    },
    {
      front: 'What is the debugging sequence for a Service that cannot reach pods?',
      back: '1. Check pod is Running AND Ready (READY = N/N)\n2. Check service selector matches pod labels\n3. kubectl get endpoints — must not be empty\n4. Test DNS: nslookup service-name from a debug pod\n5. Test direct pod IP to isolate service vs pod issue\n6. Check port (port vs targetPort) and NetworkPolicies'
    },
    {
      front: 'What DNS name format do pods use to reach services in other namespaces?',
      back: '<service-name>.<namespace>.svc.cluster.local\n\nExample: db-service.production.svc.cluster.local\n\nSame-namespace pods can use just the service name: db-service\nThe search domains in /etc/resolv.conf handle the short-name resolution.'
    },
    {
      front: 'What is the difference between Service port and targetPort?',
      back: 'port: the port exposed on the Service ClusterIP — what clients connect to\ntargetPort: the port on the Pod that receives forwarded traffic\n\nExample: port: 80, targetPort: 8080 means clients connect to ClusterIP:80 but traffic arrives at pod port 8080.'
    },
    {
      front: 'A pod is Running but READY 0/1. Will it receive Service traffic?',
      back: 'No. Kubernetes only adds pods to Service Endpoints when they are Ready (readiness probe passes). A Running but not Ready pod is excluded from Endpoints to prevent sending traffic to an unhealthy instance. Fix the readiness probe or the health check endpoint.'
    },
    {
      front: 'How do you test DNS resolution from inside the cluster?',
      back: 'kubectl run debug --image=busybox:1.36 --rm -it -- sh\n# Then inside:\nnslookup myservice\nnslookup myservice.mynamespace.svc.cluster.local\n\nThis creates a temporary debug pod that auto-deletes when you exit (--rm flag).'
    },
    {
      front: 'What does kubectl get endpoints show for a correctly configured service?',
      back: 'A list of pod IPs and ports: ENDPOINTS = 10.244.1.5:8080,10.244.2.3:8080\n\nIf it shows <none>, the selector does not match any pod. If it shows IPs but traffic fails, check targetPort, NetworkPolicy, or pod readiness.'
    },
    {
      front: 'How does direct pod IP testing help in network troubleshooting?',
      back: 'curl <pod-IP>:<port> bypasses the Service and kube-proxy entirely.\n\n- If pod IP works but Service does not → issue is in the Service layer (selector, targetPort, kube-proxy)\n- If pod IP also fails → the issue is in the pod itself (app not listening, NetworkPolicy ingress, wrong port)'
    }
  ],
  lab: {
    scenario: 'An e-commerce application has a frontend deployment that cannot connect to the backend service. You must systematically diagnose and fix multiple networking issues.',
    objective: 'Practice the complete network troubleshooting methodology: endpoints, DNS, ports, selectors, and pod readiness.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Diagnose and Fix a Label Selector Mismatch',
        instruction: `Create the following broken scenario and fix it:

\`\`\`bash
# Create a backend pod with label app=backend
kubectl run backend --image=nginx:1.25 --labels="app=backend" --port=80

# Create a service that selects app=api (WRONG label)
kubectl expose pod backend --name=backend-svc --port=80 --selector="app=api"
\`\`\`

Diagnose why the service has no endpoints, fix the selector, and verify connectivity.`,
        hints: [
          'kubectl get endpoints backend-svc to see if endpoints are empty',
          'kubectl describe svc backend-svc to see the selector',
          'kubectl get pod backend --show-labels to see the actual pod label',
          'You can patch the service selector: kubectl patch svc backend-svc -p \'{"spec":{"selector":{"app":"backend"}}}\''
        ],
        solution: `\`\`\`bash
# Create broken scenario
kubectl run backend --image=nginx:1.25 --labels="app=backend" --port=80
kubectl expose pod backend --name=backend-svc --port=80 --selector="app=api"

# Diagnose
kubectl get endpoints backend-svc
# Expected: <none> — PROBLEM FOUND

kubectl describe svc backend-svc | grep Selector
# Shows: Selector: app=api

kubectl get pod backend --show-labels
# Shows: app=backend (mismatch!)

# Fix: patch the service selector
kubectl patch svc backend-svc -p '{"spec":{"selector":{"app":"backend"}}}'

# Verify fix
kubectl get endpoints backend-svc
# Now shows: ENDPOINTS = <pod-ip>:80

# Test connectivity
kubectl run test --image=busybox:1.36 --rm -it -- wget -qO- http://backend-svc
\`\`\``,
        verify: `\`\`\`bash
# Endpoints should now have the pod IP
kubectl get endpoints backend-svc
# Expected: NAME         ENDPOINTS          AGE
#           backend-svc  <pod-ip>:80       1m

# DNS and connectivity test
kubectl run verify --image=busybox:1.36 --rm -it -- sh -c "nslookup backend-svc && wget -qO- http://backend-svc"
# Expected: nslookup resolves → nginx welcome page downloaded
\`\`\``
      },
      {
        title: 'Fix a Port Mismatch (port vs targetPort)',
        instruction: `Create a deployment where the service has a wrong targetPort:

\`\`\`bash
# App listens on port 8080
kubectl create deployment myapp --image=kennethreitz/httpbin --port=8080

# Service exposes port 80 and forwards to port 80 (WRONG — app is on 8080)
kubectl expose deployment myapp --port=80 --target-port=80 --name=myapp-svc
\`\`\`

Diagnose the port mismatch, fix the targetPort, and verify the service works.`,
        hints: [
          'kubectl get endpoints myapp-svc — endpoints exist but connections fail',
          'kubectl exec into a pod and run netstat -tlnp to see what port the app uses',
          'kubectl edit svc myapp-svc to change targetPort',
          'Use curl to test: kubectl run test --image=curlimages/curl:8.4.0 --rm -it -- curl http://myapp-svc/get'
        ],
        solution: `\`\`\`bash
# Create broken scenario
kubectl create deployment myapp --image=kennethreitz/httpbin --port=8080
kubectl expose deployment myapp --port=80 --target-port=80 --name=myapp-svc

# Wait for pod
kubectl rollout status deployment myapp

# Diagnose: endpoints exist (selector matches) but connectivity fails
kubectl get endpoints myapp-svc
# Shows IPs — endpoints are NOT empty

kubectl run test --image=curlimages/curl:8.4.0 --rm -it -- curl http://myapp-svc/get
# Connection refused or timeout

# Check what port the pod actually listens on
POD=$(kubectl get pod -l app=myapp -o jsonpath='{.items[0].metadata.name}')
kubectl exec $POD -- netstat -tlnp 2>/dev/null || kubectl exec $POD -- ss -tlnp
# Shows LISTEN on 0.0.0.0:8080

# Fix: update targetPort in the service
kubectl patch svc myapp-svc -p '{"spec":{"ports":[{"port":80,"targetPort":8080}]}}'

# Verify
kubectl run test --image=curlimages/curl:8.4.0 --rm -it -- curl -s http://myapp-svc/get
\`\`\``,
        verify: `\`\`\`bash
# Check service port mapping
kubectl get svc myapp-svc -o yaml | grep -A5 ports
# Expected: port: 80, targetPort: 8080

# Test connectivity — should return JSON response
kubectl run verify --image=curlimages/curl:8.4.0 --rm -it -- curl -s http://myapp-svc/get | head -5
# Expected: JSON response with "url": "http://myapp-svc/get"
\`\`\``
      },
      {
        title: 'Debug DNS Resolution Failure',
        instruction: `Simulate and diagnose a scenario where DNS does not resolve a service from a pod in another namespace:

1. Create namespace \`app-ns\` with a pod that tries to reach service \`db-svc\` in namespace \`db-ns\`
2. Create \`db-ns\` with a service named \`db-svc\` backed by an nginx pod
3. From the app pod, test DNS resolution using both short name and FQDN
4. Identify why the short name fails and the FQDN works`,
        hints: [
          'Short names only resolve within the same namespace (search domain)',
          'Cross-namespace: use service.namespace.svc.cluster.local',
          'kubectl exec <pod> -n <ns> -- nslookup db-svc (short name — fails)',
          'kubectl exec <pod> -n <ns> -- nslookup db-svc.db-ns.svc.cluster.local (FQDN — works)'
        ],
        solution: `\`\`\`bash
# Setup namespaces
kubectl create ns app-ns
kubectl create ns db-ns

# Create DB service in db-ns
kubectl run db-pod -n db-ns --image=nginx:1.25 --labels="app=db" --port=80
kubectl expose pod db-pod -n db-ns --name=db-svc --port=80

# Create app pod in app-ns
kubectl run app-pod -n app-ns --image=busybox:1.36 -- sleep 3600

# Wait for pods
kubectl get pod -n app-ns
kubectl get pod -n db-ns

# Test DNS from app-pod (wrong namespace)
kubectl exec -n app-ns app-pod -- nslookup db-svc
# FAILS: "server can't find db-svc"

# Test with FQDN (correct)
kubectl exec -n app-ns app-pod -- nslookup db-svc.db-ns.svc.cluster.local
# SUCCEEDS: resolves to ClusterIP

# Test connectivity via FQDN
kubectl exec -n app-ns app-pod -- wget -qO- http://db-svc.db-ns.svc.cluster.local
# Returns nginx welcome page

# Cleanup
kubectl delete ns app-ns db-ns
\`\`\``,
        verify: `\`\`\`bash
# Short name should fail (expected for cross-namespace)
kubectl exec -n app-ns app-pod -- nslookup db-svc 2>&1 | grep -i "can't find\|NXDOMAIN"
# Expected: error message (correct — short name doesn't work cross-namespace)

# FQDN should succeed
kubectl exec -n app-ns app-pod -- nslookup db-svc.db-ns.svc.cluster.local
# Expected: Name: db-svc.db-ns.svc.cluster.local, Address: <ClusterIP>

# Connectivity via FQDN should work
kubectl exec -n app-ns app-pod -- wget -qO- http://db-svc.db-ns.svc.cluster.local 2>/dev/null | head -3
# Expected: nginx welcome HTML
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Service Returns 503 or Connection Refused — Empty Endpoints',
      difficulty: 'medium',
      symptom: 'An application cannot connect to a service. curl http://myservice returns "Connection refused" or "503 Service Unavailable". kubectl get endpoints shows <none>.',
      diagnosis: `\`\`\`bash
# 1. Check if endpoints are empty
kubectl get endpoints myservice -n <namespace>
# If ENDPOINTS = <none>, selector is the problem

# 2. Check the service selector
kubectl describe svc myservice -n <namespace> | grep Selector

# 3. Check pod labels
kubectl get pods -n <namespace> --show-labels
# Compare the label values with the selector

# 4. Check pod readiness
kubectl get pods -n <namespace> -l <selector-label>
# READY column must be N/N — if 0/N, readiness probe is failing
\`\`\``,
      solution: `Two root causes for empty endpoints:

**Cause A: Label mismatch**
\`\`\`bash
# Service selector: app=myapp
# Pod label: app=my-app (hyphen vs no hyphen — typo!)

# Fix: patch the service selector or update pod labels
kubectl patch svc myservice -p '{"spec":{"selector":{"app":"my-app"}}}'

# Or fix deployment pod template labels
kubectl patch deployment myapp --type=json \
  -p='[{"op":"replace","path":"/spec/template/metadata/labels/app","value":"myapp"}]'
\`\`\`

**Cause B: Readiness probe failing**
\`\`\`bash
# Pod is Running but READY = 0/1
kubectl describe pod <pod-name> | grep -A10 "Readiness"
# Shows probe failure reason

# Check the endpoint the probe is hitting
kubectl exec <pod> -- curl -s localhost:8080/healthz
# If this fails, the app health endpoint is broken

# Temporary fix: remove readiness probe (for debugging only!)
kubectl edit deployment myapp
# Remove the readinessProbe section
\`\`\``
    },
    {
      title: 'Pod Cannot Reach Another Pod by Service Name — DNS Failure',
      difficulty: 'hard',
      symptom: 'A pod returns "Name or service not known" when trying to reach a service by name. nslookup or curl using the service FQDN also fails. Other connectivity seems fine.',
      diagnosis: `\`\`\`bash
# 1. Check CoreDNS pods are running
kubectl get pods -n kube-system -l k8s-app=kube-dns
# Should show 2 pods in Running state, READY 1/1

# 2. Check CoreDNS logs for errors
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50

# 3. From the affected pod, check /etc/resolv.conf
kubectl exec <pod> -- cat /etc/resolv.conf
# Should show: nameserver 10.96.0.10 (or your cluster DNS IP)
# Should show: search default.svc.cluster.local svc.cluster.local cluster.local

# 4. Test nslookup directly
kubectl exec <pod> -- nslookup kubernetes.default.svc.cluster.local
# If this fails, DNS is completely broken

# 5. Check CoreDNS service
kubectl get svc kube-dns -n kube-system
\`\`\``,
      solution: `**Scenario A: CoreDNS pods are down**
\`\`\`bash
kubectl get pods -n kube-system | grep dns
# Shows 0/2 Running

# Check why CoreDNS is not starting
kubectl describe pod -n kube-system <coredns-pod>

# Restart CoreDNS deployment
kubectl rollout restart deployment/coredns -n kube-system
\`\`\`

**Scenario B: Wrong nameserver in resolv.conf**
\`\`\`bash
# The pod's /etc/resolv.conf points to wrong DNS IP
# This can happen with custom dnsConfig or broken kubelet config

kubectl get svc kube-dns -n kube-system -o jsonpath='{.spec.clusterIP}'
# Get the correct DNS ClusterIP

# Fix: verify kubelet clusterDNS config on node
ssh <node>
sudo cat /var/lib/kubelet/config.yaml | grep clusterDNS
# Must match the kube-dns service ClusterIP
\`\`\`

**Scenario C: NetworkPolicy blocking DNS**
\`\`\`bash
# If a deny-all egress policy exists and doesn't allow UDP:53
kubectl get networkpolicy -n <namespace>

# Fix: add DNS egress rule to the policy
kubectl edit networkpolicy <policy-name> -n <namespace>
# Add:
# egress:
# - ports:
#   - protocol: UDP
#     port: 53
#   - protocol: TCP
#     port: 53
\`\`\``
    }
  ]
};
