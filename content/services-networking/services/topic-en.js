window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['services-networking/services'] = {
  theory: `# Kubernetes Services

## Exam Relevance
> CKA — Services & Networking (20%). Services are critical: you must know all four types, when to use each, how to expose applications, and how to debug connectivity issues.

## Why Services Exist

Pods are ephemeral — they can be replaced at any time with a new IP address. A Service provides a stable network identity (DNS name + IP) that persists regardless of pod restarts.

\`\`\`
Without Service:                    With Service:

Pod-A: 10.244.1.5  (dies)          Service "web-svc"
Pod-B: 10.244.1.8  (new pod)       ClusterIP: 10.96.0.15  ← stable!
                                    DNS: web-svc.default.svc.cluster.local
                                    → routes to healthy pods via labels
\`\`\`

## Service Types

### ClusterIP (default)
Internal service — only accessible within the cluster.

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: web-service
spec:
  type: ClusterIP  # default if omitted
  selector:
    app: web        # selects pods with this label
  ports:
  - port: 80        # service port (clients connect here)
    targetPort: 8080  # container port
    protocol: TCP
\`\`\`

\`\`\`bash
# Create imperatively
kubectl create service clusterip web-service --tcp=80:8080

# Access from within the cluster:
curl http://web-service          # using DNS short name
curl http://web-service.default  # with namespace
curl http://web-service.default.svc.cluster.local  # FQDN
curl http://10.96.0.15           # using ClusterIP
\`\`\`

### NodePort
Exposes the service on a port on every node. Accessible from outside the cluster.

\`\`\`yaml
spec:
  type: NodePort
  selector:
    app: web
  ports:
  - port: 80          # ClusterIP port (internal)
    targetPort: 8080  # container port
    nodePort: 30080   # external port (30000-32767)
\`\`\`

\`\`\`bash
# Access from outside:
curl http://<NODE-IP>:30080

# Get node IPs
kubectl get nodes -o wide
\`\`\`

### LoadBalancer
Provisions a cloud load balancer. Extends NodePort with an external IP assigned by the cloud provider.

\`\`\`yaml
spec:
  type: LoadBalancer
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 8080
\`\`\`

\`\`\`bash
kubectl get svc
# NAME    TYPE           CLUSTER-IP    EXTERNAL-IP
# web     LoadBalancer   10.96.0.15    203.0.113.50  ← external IP from cloud
\`\`\`

### ExternalName
Maps a service to an external DNS name — no proxying, just CNAME resolution.

\`\`\`yaml
spec:
  type: ExternalName
  externalName: database.example.com
\`\`\`

## How Services Select Pods

Services use **label selectors** to find their pods. A pod must have ALL the labels specified in the selector.

\`\`\`bash
# Service selects pods with: app=web AND env=prod
spec:
  selector:
    app: web
    env: prod

# Check which pods a service selects
kubectl get pods -l app=web,env=prod

# Check service endpoints (which pod IPs are selected)
kubectl get endpoints web-service
# NAME          ENDPOINTS                   AGE
# web-service   10.244.1.5:8080,10.244.1.8:8080   5m
\`\`\`

**If endpoints are empty → pods don't match the selector!**

## DNS Resolution Inside the Cluster

\`\`\`bash
# Full FQDN format:
# <service-name>.<namespace>.svc.cluster.local

# From the same namespace:
curl http://web-service

# From a different namespace:
curl http://web-service.production

# Full FQDN (always works):
curl http://web-service.production.svc.cluster.local

# Test DNS from a pod:
kubectl run dns-test --image=busybox:1.35 -it --rm -- nslookup web-service
\`\`\`

## Headless Services

A headless service (\`clusterIP: None\`) returns the pod IPs directly instead of a single virtual IP. Used by StatefulSets.

\`\`\`yaml
spec:
  clusterIP: None
  selector:
    app: database
  ports:
  - port: 5432
\`\`\`

## Useful Commands

\`\`\`bash
# Expose a deployment as a service
kubectl expose deployment web --port=80 --target-port=8080

# Expose with specific type
kubectl expose deployment web --port=80 --type=NodePort

# Get service details
kubectl get svc
kubectl describe svc web-service
kubectl get endpoints web-service

# Test connectivity from within cluster
kubectl run curl-test --image=curlimages/curl:latest --rm -it --restart=Never -- \\
  curl http://web-service

# Port-forward for local testing (not exam use, but useful for debugging)
kubectl port-forward svc/web-service 8080:80
\`\`\`

## Common Errors

1. **Empty endpoints** — pods don't match service selector labels
2. **Connection refused** — correct port but wrong targetPort
3. **Service unreachable** — wrong service type (ClusterIP is not accessible externally)
4. **DNS not resolving** — wrong namespace or CoreDNS issue
5. **NodePort out of range** — must be 30000-32767

## Killer.sh Style Challenge

> **Scenario**: A Deployment named \`backend\` in namespace \`app\` has pods running on port 3000. Expose it as a ClusterIP service named \`backend-svc\` on port 80 targeting port 3000. Then verify connectivity from another pod in the same namespace.
`,
  quiz: [
    {
      question: 'Which Service type is accessible ONLY from within the Kubernetes cluster?',
      options: ['LoadBalancer', 'NodePort', 'ClusterIP', 'ExternalName'],
      correct: 2,
      explanation: 'ClusterIP is the default service type and is only accessible within the cluster. NodePort exposes on every node\'s IP. LoadBalancer provisions an external cloud load balancer. ExternalName maps to an external DNS name.',
      reference: 'See "Service Types" — memorize the 4 types and their scope for the exam.'
    },
    {
      question: 'A Service has no endpoints. What is the most likely cause?',
      options: [
        'The service has no pods deployed in the cluster',
        'The service is of type ExternalName',
        'The service selector labels do not match any pod labels',
        'The targetPort is incorrect'
      ],
      correct: 2,
      explanation: 'When a Service has no endpoints, the most common cause is a label selector mismatch — the labels in `spec.selector` don\'t match any running pods. Check with: `kubectl get pods -l <selector-labels>` and compare with the service selector. Also verify pods are actually Running.',
      reference: 'See "How Services Select Pods" — always check endpoints when debugging service connectivity: `kubectl get endpoints <service-name>`'
    },
    {
      question: 'What is the valid port range for a NodePort service?',
      options: ['1024-65535', '8000-9000', '30000-32767', '80-8080'],
      correct: 2,
      explanation: 'NodePort ports must be in the range 30000-32767 (by default). This range is configurable via `--service-node-port-range` on the kube-apiserver, but on the CKA exam, use the default range. Ports outside this range will be rejected by the API server.',
      reference: 'See "NodePort" section — the valid range is a common exam trick question.'
    },
    {
      question: 'From a pod in namespace "frontend", how do you connect to a service named "api" in namespace "backend"?',
      options: [
        'http://api — same DNS name works across namespaces',
        'http://api.backend — service.namespace format',
        'http://backend/api — namespace/service format',
        'Not possible — services cannot cross namespace boundaries'
      ],
      correct: 1,
      explanation: 'DNS for cross-namespace service access uses the format `<service-name>.<namespace>` or the full FQDN `<service-name>.<namespace>.svc.cluster.local`. From "frontend" namespace: `http://api.backend` reaches the "api" service in the "backend" namespace.',
      reference: 'See "DNS Resolution Inside the Cluster" — cross-namespace DNS is frequently tested.'
    },
    {
      question: 'What does `kubectl expose deployment web --port=80 --target-port=8080` do?',
      options: [
        'Creates a Deployment with nginx listening on port 8080',
        'Creates a ClusterIP Service that forwards port 80 to container port 8080',
        'Creates a NodePort Service with external port 80',
        'Creates a LoadBalancer with port 80 and health check on 8080'
      ],
      correct: 1,
      explanation: '`kubectl expose deployment` creates a Service (ClusterIP by default) matching the deployment\'s labels. The `--port` is the Service port (what clients connect to) and `--target-port` is the container port (what the app listens on). Use `--type=NodePort` or `--type=LoadBalancer` to change the service type.',
      reference: 'See "Useful Commands" — `kubectl expose` is the fastest way to create a service in the exam.'
    },
    {
      question: 'What is a Headless Service and when is it used?',
      options: [
        'A service with no ports defined',
        'A service with clusterIP: None that returns pod IPs directly',
        'A service with no selector that has manually defined endpoints',
        'An ExternalName service with no external DNS'
      ],
      correct: 1,
      explanation: 'A Headless Service has `clusterIP: None` and does not get a virtual IP. DNS queries return the actual pod IPs. Used by StatefulSets to give each pod a stable DNS name (pod-0.service.namespace.svc.cluster.local). Also used when you want to implement your own load balancing.',
      reference: 'See "Headless Services" — headless services are important for StatefulSets and distributed databases.'
    },
    {
      question: 'What is the `targetPort` field in a Service spec?',
      options: [
        'The port the Service listens on (what clients connect to)',
        'The port on the node used for NodePort access',
        'The port on the container (what the application listens on)',
        'The port used for health checks'
      ],
      correct: 2,
      explanation: 'In a Service spec: `port` is what clients connect to (the Service port), `targetPort` is the container port where the application actually listens, `nodePort` (NodePort type only) is the port on the node accessible externally. A common mistake is confusing `port` and `targetPort`.',
      reference: 'See "ClusterIP" YAML example — the three port fields (port, targetPort, nodePort) are frequently confused.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4 Service types in Kubernetes?',
      back: 'ClusterIP (default): internal only. NodePort: exposes on every node port (30000-32767). LoadBalancer: cloud load balancer with external IP. ExternalName: maps to external DNS via CNAME. For the exam: know which is accessible externally (NodePort, LoadBalancer) vs internally (ClusterIP).'
    },
    {
      front: 'How does a Service find its pods?',
      back: 'Via label selectors in `spec.selector`. The pod must have ALL labels specified. Check with: `kubectl get pods -l <labels>`. If endpoints are empty, labels don\'t match. Use `kubectl get endpoints <service>` to see which pod IPs are selected.'
    },
    {
      front: 'What is the DNS format for a Service?',
      back: 'Short (same namespace): `<service-name>`. Cross-namespace: `<service-name>.<namespace>`. Full FQDN: `<service-name>.<namespace>.svc.cluster.local`. Test DNS: `kubectl run test --image=busybox -it --rm -- nslookup <service-name>`'
    },
    {
      front: 'Difference between `port` and `targetPort` in a Service',
      back: '`port`: the Service port — what clients connect to. `targetPort`: the container port — where the app actually listens. `nodePort`: only for NodePort type — the port exposed on each node (30000-32767). Example: Service port 80 → container port 3000.'
    },
    {
      front: 'How to expose a Deployment as a Service quickly?',
      back: '`kubectl expose deployment <name> --port=<port> --target-port=<container-port>` (ClusterIP by default). Add `--type=NodePort` or `--type=LoadBalancer` as needed. This uses the deployment\'s labels as the service selector automatically.'
    },
    {
      front: 'What is a Headless Service?',
      back: '`clusterIP: None` — no virtual IP. DNS returns actual pod IPs directly. Used by StatefulSets for stable pod DNS names: `<pod-name>.<headless-svc>.<ns>.svc.cluster.local`. Also for when you want to do your own load balancing or service discovery.'
    },
    {
      front: 'How to debug "Service not reachable"?',
      back: '1. `kubectl get endpoints <svc>` — if empty, selector doesn\'t match pods. 2. `kubectl get pods -l <selector>` — verify pods exist with labels. 3. Check `port` vs `targetPort` — container listening on right port? 4. Service type — ClusterIP is not externally accessible. 5. `kubectl run curl-test --image=curlimages/curl -it --rm -- curl http://<svc>`'
    },
    {
      front: 'What does `kubectl expose` do vs creating a Service YAML?',
      back: '`kubectl expose` is the imperative shortcut — automatically copies the deployment\'s selector labels and creates a Service. Equivalent to writing a Service YAML with selector matching the deployment\'s pod template labels. Much faster on the exam. Use `--dry-run=client -o yaml` to see the generated YAML.'
    }
  ],
  lab: {
    scenario: 'You need to expose a web application running in a Deployment using three different Service types, and verify connectivity for each.',
    objective: 'Practice creating and testing ClusterIP, NodePort, and LoadBalancer services. Debug connectivity issues.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Create a Deployment and expose it as ClusterIP',
        instruction: `Create a web application deployment and expose it internally.

\`\`\`bash
# Create the deployment
kubectl create deployment web --image=nginx:alpine --replicas=2
kubectl get pods -l app=web

# Expose as ClusterIP (internal only)
kubectl expose deployment web --port=80 --target-port=80 --name=web-clusterip

# Inspect the service
kubectl get svc web-clusterip
kubectl get endpoints web-clusterip
kubectl describe svc web-clusterip
\`\`\`

Test connectivity from within the cluster:
\`\`\`bash
# Run a temporary pod to test
kubectl run curl-test --image=curlimages/curl:latest --rm -it --restart=Never -- \\
  curl http://web-clusterip
\`\`\``,
        hints: [
          'ClusterIP is not accessible from outside the cluster — only from other pods',
          'If endpoints are empty, check that deployment pods are Running with \`kubectl get pods -l app=web\`',
          'The service uses the deployment labels automatically when using \`kubectl expose deployment\`'
        ],
        solution: `\`\`\`bash
kubectl create deployment web --image=nginx:alpine --replicas=2
kubectl expose deployment web --port=80 --target-port=80 --name=web-clusterip
kubectl get svc web-clusterip
kubectl get endpoints web-clusterip
# Should show 2 endpoints (2 pod IPs:80)

kubectl run curl-test --image=curlimages/curl:latest --rm -it --restart=Never -- \\
  curl http://web-clusterip
# Should return nginx HTML page
\`\`\``,
        verify: `\`\`\`bash
# Service should exist
kubectl get svc web-clusterip
# NAME            TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)
# web-clusterip   ClusterIP   10.96.x.x    <none>        80/TCP

# Endpoints should have 2 pod IPs
kubectl get endpoints web-clusterip
# ENDPOINTS: 10.244.x.x:80,10.244.x.x:80

# Test from within cluster
kubectl run test --image=curlimages/curl --rm -it --restart=Never -- \\
  curl -s http://web-clusterip | grep -i "Welcome to nginx"
# Expected: Welcome to nginx!
\`\`\``
      },
      {
        title: 'Create a NodePort Service and access externally',
        instruction: `Expose the same deployment externally using NodePort.

\`\`\`bash
# Create NodePort service
kubectl expose deployment web --port=80 --target-port=80 \\
  --type=NodePort --name=web-nodeport

# Check the assigned nodePort
kubectl get svc web-nodeport
# Note the 5-digit port in PORT(S) column: 80:3XXXX/TCP

# Get node IP
kubectl get nodes -o wide
# Note the INTERNAL-IP column

# Access externally (from your host machine)
curl http://<NODE-IP>:<NODE-PORT>
\`\`\`

Create with a specific NodePort:
\`\`\`yaml
# nodeport-specific.yaml
apiVersion: v1
kind: Service
metadata:
  name: web-nodeport-fixed
spec:
  type: NodePort
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 80
    nodePort: 30080  # specific port (must be 30000-32767)
\`\`\``,
        hints: [
          'NodePort is accessible at <ANY-NODE-IP>:<node-port> from outside the cluster',
          'The nodePort range is 30000-32767 — ports outside this range are rejected',
          'If no nodePort is specified, Kubernetes assigns a random port in the valid range'
        ],
        solution: `\`\`\`bash
kubectl expose deployment web --port=80 --target-port=80 \\
  --type=NodePort --name=web-nodeport

kubectl get svc web-nodeport
# Will show something like: 80:31234/TCP

kubectl apply -f nodeport-specific.yaml
kubectl get svc web-nodeport-fixed
# Should show: 80:30080/TCP
\`\`\``,
        verify: `\`\`\`bash
# Service should have NodePort type
kubectl get svc web-nodeport
# TYPE should be NodePort, PORT(S) should show 80:3XXXX/TCP

# Fixed nodePort should be 30080
kubectl get svc web-nodeport-fixed -o jsonpath='{.spec.ports[0].nodePort}'
# Expected: 30080

# Verify that a port outside range is rejected
kubectl create svc nodeport bad-port --tcp=80:80 --node-port=1000 2>&1 | grep -i "invalid\|error"
# Expected: error about invalid nodePort
\`\`\``
      },
      {
        title: 'Debug a broken Service',
        instruction: `Fix a Service that is not routing traffic to pods.

\`\`\`bash
# Create a deliberately broken service (wrong selector)
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: broken-svc
spec:
  type: ClusterIP
  selector:
    app: doesnt-exist   # ← wrong label!
  ports:
  - port: 80
    targetPort: 80
EOF

# Try to access it
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never -- \\
  curl --connect-timeout 5 http://broken-svc

# Debug: check endpoints
kubectl get endpoints broken-svc

# Fix the service selector
kubectl patch svc broken-svc -p '{"spec":{"selector":{"app":"web"}}}'

# Verify again
kubectl get endpoints broken-svc
\`\`\``,
        hints: [
          '\`kubectl get endpoints <service>\` is the first thing to check when a service is unreachable',
          'Empty ENDPOINTS means no pods match the selector',
          '\`kubectl patch\` can quickly fix a service without editing YAML'
        ],
        solution: `\`\`\`bash
# Create broken service
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: broken-svc
spec:
  type: ClusterIP
  selector:
    app: doesnt-exist
  ports:
  - port: 80
    targetPort: 80
EOF

# Confirm it's broken
kubectl get endpoints broken-svc
# ENDPOINTS: <none>

# Fix it
kubectl patch svc broken-svc -p '{"spec":{"selector":{"app":"web"}}}'

# Verify
kubectl get endpoints broken-svc
# Now shows pod IPs
\`\`\``,
        verify: `\`\`\`bash
# broken-svc endpoints should now be populated
kubectl get endpoints broken-svc
# NAME         ENDPOINTS
# broken-svc   10.244.x.x:80,10.244.x.x:80

# Selector should now match
kubectl get svc broken-svc -o jsonpath='{.spec.selector}'
# Expected: {"app":"web"}

# Test connectivity
kubectl run verify-svc --image=curlimages/curl --rm -it --restart=Never -- \\
  curl -s http://broken-svc | grep -c "nginx"
# Expected: 1 (nginx HTML returned)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Service has no endpoints — pods not receiving traffic',
      difficulty: 'easy',
      symptom: 'Connecting to a Service times out or returns "Connection refused". `kubectl get endpoints <svc>` shows `<none>`.',
      diagnosis: `\`\`\`bash
# Step 1: Check endpoints
kubectl get endpoints web-service
# NAME          ENDPOINTS   AGE
# web-service   <none>      5m   ← No pods selected!

# Step 2: Check the service selector
kubectl get svc web-service -o yaml | grep -A 3 "selector:"
# selector:
#   app: web-app   ← What the service looks for

# Step 3: Check pod labels
kubectl get pods --show-labels
# NAME        LABELS
# web-6xxx    app=webapp,env=prod  ← "webapp" not "web-app"!

# Step 4: Identify the mismatch
# Service selector: app=web-app
# Pod labels:       app=webapp
# MISMATCH!
\`\`\``,
      solution: `\`\`\`bash
# Option 1: Fix the service selector to match existing pod labels
kubectl patch svc web-service -p '{"spec":{"selector":{"app":"webapp"}}}'

# Option 2: Fix the deployment labels to match the service
kubectl patch deployment web --patch '{"spec":{"template":{"metadata":{"labels":{"app":"web-app"}}}}}'

# Verify endpoints are now populated
kubectl get endpoints web-service
# NAME          ENDPOINTS
# web-service   10.244.1.5:80,10.244.1.8:80

# Test connectivity
kubectl run test --image=curlimages/curl --rm -it --restart=Never -- \\
  curl http://web-service
\`\`\``
    },
    {
      title: 'DNS resolution fails across namespaces',
      difficulty: 'medium',
      symptom: 'A pod in namespace "frontend" cannot connect to service "api" in namespace "backend". Using just `http://api` fails with "Could not resolve host".',
      diagnosis: `\`\`\`bash
# The problem: DNS short names only resolve within the same namespace
# From "frontend" namespace, "api" resolves to frontend/api (which doesn't exist)

# Verify the service exists in "backend"
kubectl get svc api -n backend

# Test DNS resolution from the frontend pod
kubectl exec -n frontend <frontend-pod> -- nslookup api
# Server: 10.96.0.10
# ** server can't find api: NXDOMAIN  ← Cannot resolve in frontend namespace

kubectl exec -n frontend <frontend-pod> -- nslookup api.backend
# Server: 10.96.0.10
# Address: 10.96.5.42  ← Resolves correctly with namespace!
\`\`\``,
      solution: `\`\`\`bash
# Use the cross-namespace DNS format: <service>.<namespace>
# Update the application configuration or environment variable:

kubectl set env deployment/frontend -n frontend API_URL=http://api.backend

# Or use the full FQDN:
kubectl set env deployment/frontend -n frontend API_URL=http://api.backend.svc.cluster.local

# Verify resolution works
kubectl exec -n frontend <frontend-pod> -- nslookup api.backend
# Should return the ClusterIP of the api service in backend namespace

# Test actual connectivity
kubectl exec -n frontend <frontend-pod> -- curl http://api.backend/health
\`\`\``
    }
  ]
};
