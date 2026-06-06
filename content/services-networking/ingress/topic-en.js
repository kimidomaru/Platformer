window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['services-networking/ingress'] = {
  theory: `
# Ingress & Gateway API

## Exam Relevance
> Ingress is tested in CKA (Services & Networking — 20%) and CKAD. Expect tasks creating Ingress rules for path-based and host-based routing, configuring TLS, and troubleshooting connectivity.

## Core Concepts

**Ingress** is a Kubernetes API object that manages **external HTTP/HTTPS access** to services inside the cluster. It acts as a smart router sitting in front of your services.

### Without Ingress vs With Ingress

\`\`\`
Without Ingress:
  Internet → NodePort/LoadBalancer → Service (one LB per service = expensive)

With Ingress:
  Internet → Ingress Controller (one LB) → Ingress Rules → Service → Pods
\`\`\`

### Ingress vs Ingress Controller

| Object | Purpose |
|--------|---------|
| **Ingress** | Kubernetes resource defining routing rules |
| **Ingress Controller** | Pod running the actual proxy (nginx, traefik, envoy...) |

> **Important**: An Ingress resource alone does nothing. You need an Ingress Controller deployed in your cluster.

### Routing Types

**Host-based routing** — different hostnames to different services:
\`\`\`
api.example.com  → api-service:80
app.example.com  → frontend-service:80
\`\`\`

**Path-based routing** — different URL paths to different services:
\`\`\`
example.com/api   → api-service:80
example.com/app   → frontend-service:80
\`\`\`

### Path Types

| pathType | Behavior |
|----------|----------|
| **Prefix** | Matches if URL starts with path (most common) |
| **Exact** | Matches only exact URL |
| **ImplementationSpecific** | Controller-specific behavior |

## Essential Commands

\`\`\`bash
# Create Ingress (imperative)
kubectl create ingress myapp \\
  --rule="myapp.example.com/api*=api-svc:80" \\
  --rule="myapp.example.com/=frontend-svc:80"

# Create Ingress with TLS
kubectl create ingress myapp-tls \\
  --rule="myapp.example.com/*=frontend-svc:443,tls=myapp-tls-secret"

# List ingresses
kubectl get ingress -A

# Describe ingress (see rules, backend IPs)
kubectl describe ingress myapp

# Test connectivity (from inside cluster)
curl -H "Host: myapp.example.com" http://<ingress-controller-ip>/api
\`\`\`

## Complete YAML Examples

### Simple Ingress (single service)

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: simple-ingress
  namespace: prod
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx         # specify which controller handles this
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-svc
            port:
              number: 80
\`\`\`

### Multi-service Path-based Routing

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: multi-path
  namespace: prod
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  ingressClassName: nginx
  rules:
  - host: platform.example.com
    http:
      paths:
      - path: /api(/|$)(.*)
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080
      - path: /app(/|$)(.*)
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 3000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: home-service
            port:
              number: 80
\`\`\`

### Host-based Routing (multi-host)

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: multi-host
  namespace: prod
spec:
  ingressClassName: nginx
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80
  - host: admin.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: admin-service
            port:
              number: 80
\`\`\`

### TLS Ingress

\`\`\`yaml
# First, create the TLS secret:
# kubectl create secret tls myapp-tls \\
#   --cert=tls.crt --key=tls.key

apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tls-ingress
  namespace: prod
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - secure.example.com
    secretName: myapp-tls          # TLS secret with cert + key
  rules:
  - host: secure.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: secure-service
            port:
              number: 443
\`\`\`

### Default Backend

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: with-default
  namespace: prod
spec:
  ingressClassName: nginx
  defaultBackend:                  # handles requests that don't match any rule
    service:
      name: fallback-service
      port:
        number: 80
  rules:
  - host: example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80
\`\`\`

## Common Annotations (nginx controller)

\`\`\`yaml
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /           # rewrite URL path
  nginx.ingress.kubernetes.io/ssl-redirect: "true"       # force HTTPS
  nginx.ingress.kubernetes.io/proxy-body-size: "10m"     # max upload size
  nginx.ingress.kubernetes.io/rate-limit: "100"          # requests per minute
  nginx.ingress.kubernetes.io/use-regex: "true"          # enable regex in paths
\`\`\`

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Ingress returns 404 for all paths | No Ingress Controller deployed | Install nginx/traefik ingress controller |
| 503 Service Unavailable | Backend service/pods unreachable | Check service selector labels, pod health |
| TLS certificate error | Wrong secret name or namespace | Verify secret exists in same namespace |
| Rule never matches | Wrong pathType or host mismatch | Use \`Exact\` vs \`Prefix\` correctly; check Host header |
| \`ingressClass\` not found | ingressClassName doesn't exist | Check: \`kubectl get ingressclass\` |

## Killer.sh Style Challenge

> **Scenario**: Create an Ingress named \`exam-ingress\` in namespace \`exam\` that routes:
> - \`exam.local/api\` → service \`api-svc\` on port 8080 (Prefix)
> - \`exam.local/app\` → service \`app-svc\` on port 80 (Prefix)
> - Use IngressClass \`nginx\`

\`\`\`bash
kubectl create ingress exam-ingress -n exam \\
  --rule="exam.local/api*=api-svc:8080" \\
  --rule="exam.local/app*=app-svc:80" \\
  --class=nginx

kubectl describe ingress exam-ingress -n exam
\`\`\`
`,
  quiz: [
    {
      question: 'You created an Ingress resource but traffic still reaches the old service directly. What is the most likely cause?',
      options: [
        'The Ingress rules have wrong path types',
        'No Ingress Controller is deployed in the cluster',
        'The Ingress is in the wrong namespace',
        'The Service type must be NodePort for Ingress to work'
      ],
      correct: 1,
      explanation: 'An Ingress resource is just configuration — it does nothing without an Ingress Controller (nginx, traefik, envoy, etc.) running in the cluster. The controller reads Ingress objects and configures the actual proxy.',
      reference: 'Ingress = routing rules. Ingress Controller = the actual proxy that implements them.'
    },
    {
      question: 'Which `pathType` matches all URLs that start with `/api`, including `/api/v1/users`?',
      options: [
        'Exact',
        'ImplementationSpecific',
        'Prefix',
        'Wildcard'
      ],
      correct: 2,
      explanation: '`Prefix` matches any URL that starts with the given path. `/api` with Prefix matches `/api`, `/api/`, `/api/v1/users`, etc. `Exact` would only match the literal string `/api`.',
      reference: 'Use Prefix for API routes. Use Exact for specific endpoints where you need strict matching.'
    },
    {
      question: 'You need to route `api.example.com` → service A and `admin.example.com` → service B. Which Ingress feature handles this?',
      options: [
        'Path-based routing with pathType: Prefix',
        'Host-based routing using the `host` field in Ingress rules',
        'TLS routing with different certificate SNI',
        'Default backend configuration'
      ],
      correct: 1,
      explanation: 'Host-based routing uses the `host` field in Ingress rules to route different hostnames to different backend services. Each rule can have its own hostname and set of path rules.',
      reference: 'Two routing methods: host-based (different hostnames) and path-based (same host, different URL paths).'
    },
    {
      question: 'How does a TLS Ingress get the certificate and private key?',
      options: [
        'From the Ingress Controller\'s default certificate',
        'From a Kubernetes Secret of type `kubernetes.io/tls` referenced in `spec.tls[].secretName`',
        'From a ConfigMap containing the TLS data',
        'From annotations on the Ingress resource'
      ],
      correct: 1,
      explanation: 'TLS certificates are stored in a `kubernetes.io/tls` Secret with keys `tls.crt` and `tls.key`. The Ingress references this Secret by name in `spec.tls[].secretName`. The Secret must be in the same namespace as the Ingress.',
      reference: 'Create TLS secret: kubectl create secret tls my-tls --cert=cert.pem --key=key.pem'
    },
    {
      question: 'An Ingress has no `ingressClassName` set. Which controller handles it?',
      options: [
        'All controllers handle it simultaneously',
        'The controller marked as the cluster default IngressClass (if any)',
        'No controller handles it — ingressClassName is mandatory',
        'The first controller deployed in the cluster'
      ],
      correct: 1,
      explanation: 'If `ingressClassName` is not set, the Ingress is handled by the controller that has been marked as the cluster default (annotation `ingressclass.kubernetes.io/is-default-class: "true"`). If no default exists, no controller claims it.',
      reference: 'Check: kubectl get ingressclass — look for the "(default)" marker.'
    },
    {
      question: 'What does the `defaultBackend` in an Ingress serve?',
      options: [
        'The primary service for all traffic',
        'Requests that do not match any defined rule or path',
        'The fallback when the Ingress Controller is down',
        'The health check endpoint for the Ingress Controller'
      ],
      correct: 1,
      explanation: '`defaultBackend` handles all requests that do not match any rule defined in the Ingress. Typically used to serve a custom 404 page or catch-all response.',
      reference: 'Each Ingress Controller also has its own cluster-level default backend for unmatched requests.'
    },
    {
      question: 'You get a 503 error when accessing a path defined in your Ingress. The Ingress Controller is running. What should you check next?',
      options: [
        'Whether the Ingress has the correct ingressClassName',
        'Whether the backend Service exists and its selector matches running pods',
        'Whether the TLS secret is correctly formatted',
        'Whether the Ingress has a defaultBackend configured'
      ],
      correct: 1,
      explanation: '503 typically means the Ingress Controller can find the Service but cannot reach any healthy backend pod. Check: Service exists, selector labels match pod labels, pods are Running and passing readiness probes.',
      reference: 'Debug chain: Ingress → Service (selector labels?) → Endpoints (any IP?) → Pods (running?)'
    },
    {
      question: 'Which command creates an Ingress routing `app.example.com/` to service `frontend` on port 80 using ingressClass `nginx`?',
      options: [
        'kubectl create ingress myapp --host=app.example.com --service=frontend:80 --class=nginx',
        'kubectl create ingress myapp --rule="app.example.com/=frontend:80" --class=nginx',
        'kubectl apply ingress myapp --url=app.example.com --backend=frontend:80',
        'kubectl expose ingress myapp --host=app.example.com --port=80 --class=nginx'
      ],
      correct: 1,
      explanation: 'The correct imperative syntax uses `--rule="host/path=service:port"` and `--class=ingressClassName`. This is a common exam task — memorize this syntax.',
      reference: 'kubectl create ingress --rule format: "host/path=service:port[,tls=secret]"'
    }
  ],
  flashcards: [
    {
      front: 'What is the difference between an Ingress and an Ingress Controller?',
      back: '**Ingress**: Kubernetes API object (YAML) defining HTTP routing rules.\n\n**Ingress Controller**: The actual proxy Pod (nginx, traefik, HAProxy, envoy...) that reads Ingress objects and implements the routing.\n\nWithout a Controller, Ingress objects have no effect. The Controller must be installed separately.'
    },
    {
      front: 'What are the two main types of Ingress routing?',
      back: '**Host-based**: Routes based on the HTTP `Host` header\n```yaml\nrules:\n- host: api.example.com  → api-service\n- host: app.example.com  → frontend-service\n```\n\n**Path-based**: Routes based on the URL path\n```yaml\nrules:\n- host: example.com\n  paths:\n  - /api  → api-service\n  - /app  → frontend-service\n```'
    },
    {
      front: 'What are the 3 pathType values and how do they differ?',
      back: '**Prefix**: Matches URLs that *start with* the path\n- `/api` matches `/api`, `/api/v1`, `/api/users`\n\n**Exact**: Matches *only* the exact URL\n- `/api` matches ONLY `/api` (not `/api/`)\n\n**ImplementationSpecific**: Behavior defined by the controller\n- Use Prefix for most cases; Exact for strict matching'
    },
    {
      front: 'How do you configure TLS in an Ingress?',
      back: '1. Create a TLS Secret:\n```bash\nkubectl create secret tls my-tls \\\n  --cert=cert.pem --key=key.pem\n```\n\n2. Reference in Ingress:\n```yaml\nspec:\n  tls:\n  - hosts: [secure.example.com]\n    secretName: my-tls\n  rules:\n  - host: secure.example.com\n    ...\n```\nSecret must be in the same namespace as the Ingress.'
    },
    {
      front: 'What is `ingressClassName` and when is it required?',
      back: '`spec.ingressClassName` specifies which **Ingress Controller** should handle this Ingress.\n\n```yaml\nspec:\n  ingressClassName: nginx\n```\n\nIf omitted: the cluster default IngressClass handles it (if one exists).\n\nCheck available classes: `kubectl get ingressclass`\n\nSet default: annotation `ingressclass.kubernetes.io/is-default-class: "true"`'
    },
    {
      front: 'What is the `defaultBackend` in an Ingress?',
      back: 'A fallback service that handles requests that **do not match any rule**.\n\n```yaml\nspec:\n  defaultBackend:\n    service:\n      name: fallback-404\n      port:\n        number: 80\n  rules:\n  - host: example.com\n    ...\n```\n\nUse for: custom 404 pages, catch-all handlers.'
    },
    {
      front: 'A 503 error appears when accessing an Ingress path. What is the debugging sequence?',
      back: '```bash\n# 1. Check Ingress rules are correct\nkubectl describe ingress <name> -n <ns>\n\n# 2. Check Service exists and has correct selector\nkubectl get svc <name> -n <ns>\nkubectl describe svc <name> -n <ns>\n\n# 3. Check endpoints (pods reachable?)\nkubectl get endpoints <name> -n <ns>\n# If empty → selector mismatch or no running pods\n\n# 4. Check pods are Running and Ready\nkubectl get pods -l <selector> -n <ns>\n```'
    },
    {
      front: 'What is the imperative command to create an Ingress with two path rules?',
      back: '```bash\nkubectl create ingress my-ingress \\\n  --rule="app.example.com/api*=api-svc:8080" \\\n  --rule="app.example.com/app*=app-svc:80" \\\n  --class=nginx \\\n  -n my-namespace\n```\n\nRule format: `"host/path=service:port"`\nFor TLS: append `,tls=secret-name` to a rule'
    }
  ],
  lab: {
    scenario: 'You need to expose multiple microservices through a single Ingress Controller, using both path-based and host-based routing with TLS.',
    objective: 'Create Ingress resources for path-based routing, host-based routing, and TLS termination.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create Services and Path-based Ingress',
        instruction: `In namespace **webapps**, deploy two services:
1. **api-service** (ClusterIP, port 8080) backed by image \`hashicorp/http-echo\` with args \`["-text=API Response"]\`
2. **frontend-service** (ClusterIP, port 80) backed by image \`nginx\`

Then create an Ingress **path-router** using class \`nginx\` that routes:
- \`webapp.local/api\` → api-service:8080 (Prefix)
- \`webapp.local/\` → frontend-service:80 (Prefix)`,
        hints: [
          'Create the namespace and deploy simple apps first',
          'Use \`kubectl create deployment\` then \`kubectl expose\` to create services',
          'Then \`kubectl create ingress\` with --rule flags',
          'Check ingress with \`kubectl describe ingress path-router -n webapps\`'
        ],
        solution: `\`\`\`bash
kubectl create namespace webapps

# Deploy API service
kubectl create deployment api-app -n webapps \\
  --image=hashicorp/http-echo -- -text="API Response"
kubectl expose deployment api-app -n webapps \\
  --name=api-service --port=8080 --target-port=5678

# Deploy frontend service
kubectl create deployment frontend -n webapps \\
  --image=nginx
kubectl expose deployment frontend -n webapps \\
  --name=frontend-service --port=80

# Create Ingress
kubectl create ingress path-router -n webapps \\
  --rule="webapp.local/api*=api-service:8080" \\
  --rule="webapp.local/*=frontend-service:80" \\
  --class=nginx

kubectl describe ingress path-router -n webapps
\`\`\``,
        verify: `\`\`\`bash
kubectl get ingress path-router -n webapps
# Expected: ingress listed with ADDRESS (IP of ingress controller)

kubectl describe ingress path-router -n webapps
# Expected: 2 rules: /api* → api-service:8080, /* → frontend-service:80

kubectl get endpoints api-service -n webapps
# Expected: at least one IP:5678 endpoint listed

kubectl get endpoints frontend-service -n webapps
# Expected: at least one IP:80 endpoint listed
\`\`\``
      },
      {
        title: 'Configure TLS for the Ingress',
        instruction: `Add TLS to the **path-router** Ingress in namespace **webapps**:
1. Generate a self-signed certificate for \`webapp.local\`
2. Create a Secret \`webapp-tls\` of type \`kubernetes.io/tls\`
3. Update the Ingress to use TLS with the secret

After updating, the Ingress should redirect HTTP to HTTPS.`,
        hints: [
          'Use openssl to generate a self-signed cert',
          'Use \`kubectl create secret tls\` to create the secret',
          'Edit the ingress to add the \`spec.tls\` section',
          'Add annotation \`nginx.ingress.kubernetes.io/ssl-redirect: "true"\`'
        ],
        solution: `\`\`\`bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
  -keyout /tmp/webapp.key \\
  -out /tmp/webapp.crt \\
  -subj "/CN=webapp.local"

# Create TLS secret
kubectl create secret tls webapp-tls -n webapps \\
  --cert=/tmp/webapp.crt \\
  --key=/tmp/webapp.key

# Update Ingress with TLS
kubectl edit ingress path-router -n webapps
# Add under spec:
# tls:
# - hosts: [webapp.local]
#   secretName: webapp-tls
# Add annotation: nginx.ingress.kubernetes.io/ssl-redirect: "true"

# Or re-create with TLS rule:
kubectl delete ingress path-router -n webapps
kubectl create ingress path-router -n webapps \\
  --rule="webapp.local/api*=api-service:8080,tls=webapp-tls" \\
  --rule="webapp.local/*=frontend-service:80,tls=webapp-tls" \\
  --class=nginx

kubectl describe ingress path-router -n webapps
\`\`\``,
        verify: `\`\`\`bash
kubectl get secret webapp-tls -n webapps
# Expected: TYPE=kubernetes.io/tls

kubectl describe ingress path-router -n webapps | grep -A3 "TLS:"
# Expected: TLS section showing webapp-tls secret and webapp.local host

kubectl get ingress path-router -n webapps -o yaml | grep -A5 "tls:"
# Expected: tls config present with secretName: webapp-tls
\`\`\``
      },
      {
        title: 'Debug an Ingress that Returns 503',
        instruction: `An Ingress named \`broken-ingress\` in namespace \`debug\` was created but all requests return 503. Debug and fix it.

The Ingress routes \`debug.local/\` to service \`web-service:80\`. The service selector is \`app=web\` but the Deployment uses label \`app=webapp\`.`,
        hints: [
          'Check if endpoints exist for the service',
          'Empty endpoints list means the selector does not match any pods',
          'Use \`kubectl describe svc web-service -n debug\` to see the selector',
          'Fix: either update the service selector or update the deployment labels'
        ],
        solution: `\`\`\`bash
kubectl create namespace debug

# Create the broken setup
kubectl create deployment web -n debug --image=nginx
kubectl expose deployment web -n debug \\
  --name=web-service --port=80 \\
  --selector="app=web"  # wrong selector!

kubectl create ingress broken-ingress -n debug \\
  --rule="debug.local/*=web-service:80" \\
  --class=nginx

# Diagnose
kubectl get endpoints web-service -n debug
# Empty! No pods match selector "app=web"

kubectl get pods -n debug --show-labels
# Pods have label "app=web" (kubectl create deployment sets this)

kubectl describe svc web-service -n debug | grep Selector
# Selector: app=web vs pod label app=web — actually matches!
# In real broken scenario: selector would be "app=wrong"

# Fix: patch the service selector to match pod labels
kubectl patch svc web-service -n debug \\
  -p '{"spec":{"selector":{"app":"web"}}}'

# Verify endpoints appear
kubectl get endpoints web-service -n debug
\`\`\``,
        verify: `\`\`\`bash
kubectl get endpoints web-service -n debug
# Expected: at least one endpoint IP:80 (NOT empty/none)

kubectl get pods -n debug -l app=web
# Expected: pod Running

kubectl describe ingress broken-ingress -n debug
# Expected: rules show web-service:80 backend with correct configuration
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'All Ingress paths return 404',
      difficulty: 'easy',
      symptom: 'Accessing any URL through the Ingress returns 404 or the Ingress Controller\'s default 404 page, even for paths that are clearly defined in the Ingress rules.',
      diagnosis: `\`\`\`bash
# Check if an Ingress Controller is running
kubectl get pods -A | grep -i ingress

# Check if IngressClass exists
kubectl get ingressclass

# Check Ingress rules
kubectl describe ingress <name> -n <namespace>
# Look for: "Default backend", rules section, ingressClassName

# Check if ingressClassName in Ingress matches deployed controller
kubectl get ingress <name> -n <namespace> -o yaml | grep ingressClassName

# Check controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
\`\`\``,
      solution: `**Case 1: No Ingress Controller deployed**
\`\`\`bash
# Install nginx ingress controller (quick install)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
# Wait for controller pod
kubectl wait --namespace ingress-nginx \\
  --for=condition=ready pod \\
  --selector=app.kubernetes.io/component=controller \\
  --timeout=120s
\`\`\`

**Case 2: ingressClassName mismatch**
\`\`\`bash
# Check available classes
kubectl get ingressclass
# NAME    CONTROLLER
# nginx   k8s.io/ingress-nginx

# Update the Ingress to use correct class
kubectl patch ingress <name> -n <namespace> \\
  -p '{"spec":{"ingressClassName":"nginx"}}'
\`\`\`

**Case 3: Host header not matching**
When testing locally, you must send the correct Host header:
\`\`\`bash
# Test with correct Host header
curl -H "Host: myapp.example.com" http://<ingress-ip>/
\`\`\``
    },
    {
      title: 'Ingress returns 503 for specific path — empty endpoints',
      difficulty: 'medium',
      symptom: '`/api` path returns 503, but `/app` path works fine. Both are defined in the same Ingress.',
      diagnosis: `\`\`\`bash
# Check Ingress description
kubectl describe ingress <name> -n <namespace>
# Look at backends section for /api path

# Check if api-service exists
kubectl get svc api-service -n <namespace>

# Check endpoints — this is the key check
kubectl get endpoints api-service -n <namespace>
# If ENDPOINTS is <none>, no pods are ready

# Check service selector
kubectl describe svc api-service -n <namespace> | grep -E "Selector|Endpoints"

# Check pods for the service
kubectl get pods -n <namespace> -l <service-selector-label>
# Are they running? Do they pass readiness probes?
\`\`\``,
      solution: `The service has no ready endpoints. Most likely cause: **label selector mismatch** between Service and Pods, or **pods are not Ready**.

\`\`\`bash
# Check what labels the pods have
kubectl get pods -n <namespace> --show-labels | grep api

# Check what selector the service uses
kubectl get svc api-service -n <namespace> -o jsonpath='{.spec.selector}'

# Fix: Update service selector to match pod labels
kubectl patch svc api-service -n <namespace> \\
  -p '{"spec":{"selector":{"app":"api"}}}'  # use correct label

# Alternative: Update deployment labels to match service selector
kubectl patch deployment api-deploy -n <namespace> \\
  -p '{"spec":{"template":{"metadata":{"labels":{"app":"api"}}}}}'

# Verify endpoints appear
kubectl get endpoints api-service -n <namespace>
# Should now show pod IPs

# Test Ingress
curl -H "Host: myapp.example.com" http://<ingress-ip>/api
\`\`\``
    },
    {
      title: 'HTTPS not working: invalid certificate or plain-text connection',
      difficulty: 'medium',
      symptom: 'Accessing via https:// returns a certificate error (e.g. "Kubernetes Ingress Controller Fake Certificate"), the browser complains about an invalid cert, or port 443 does not respond, even though HTTP works.',
      diagnosis: `\`\`\`bash
# 1. Does the Ingress have a tls section referencing the right Secret?
kubectl get ingress my-ingress -o jsonpath='{.spec.tls}'
# Expected: [{"hosts":["app.local"],"secretName":"app-tls"}]

# 2. Does the Secret exist, of the right type, in the SAME namespace as the Ingress?
kubectl get secret app-tls -o jsonpath='{.type}'
# Expected: kubernetes.io/tls  (must have tls.crt and tls.key)

# 3. Does the certificate host match the accessed host (CN/SAN)?
kubectl get secret app-tls -o jsonpath='{.data.tls\\.crt}' | base64 -d | openssl x509 -noout -subject -ext subjectAltName

# 4. Did the controller load the certificate? (otherwise it uses the "Fake Certificate")
kubectl logs -n ingress-nginx deploy/ingress-nginx-controller | grep -i 'ssl\\|certificate\\|app-tls'

# 5. Test bypassing validation to isolate
curl -kv https://app.local --resolve app.local:443:INGRESS_IP 2>&1 | head -20
\`\`\``,
      solution: `**Causes and fixes:**

1. **Secret missing/in the wrong namespace** — the TLS Secret must be in the **same namespace** as the Ingress. Recreate it there:
\`\`\`bash
kubectl create secret tls app-tls --cert=tls.crt --key=tls.key -n <ingress-ns>
\`\`\`

2. **nginx "Fake Certificate"** — means the controller did not find the Secret referenced in \`spec.tls\`. Confirm \`secretName\` matches the real name and the Secret is of type \`kubernetes.io/tls\`.

3. **Host outside the certificate** — the cert CN/SAN must cover the accessed host. Generate a cert with the correct SAN (or use cert-manager to automate).

4. **TLS not declared** — without the \`spec.tls\` section, nginx serves HTTPS only with the default certificate. Add:
\`\`\`yaml
spec:
  tls:
    - hosts: [app.local]
      secretName: app-tls
\`\`\`

**Prevention:** use **cert-manager** to issue/renew certificates automatically and avoid manual Secrets expiring.`
    },
    {
      title: 'Path routing broken: 404 on subpaths or incorrect rewrite',
      difficulty: 'hard',
      symptom: 'The root route works, but subpaths return 404, OR the application receives a different path than expected (e.g. backend sees /api/users instead of /users), typically after using rewrite-target.',
      diagnosis: `\`\`\`bash
# 1. Check the pathType of each rule (Prefix vs Exact vs ImplementationSpecific)
kubectl get ingress my-ingress -o jsonpath='{range .spec.rules[*].http.paths[*]}{.path}{" -> "}{.pathType}{"\\n"}{end}'

# 2. Check rewrite annotations
kubectl get ingress my-ingress -o jsonpath='{.metadata.annotations}' | tr ',' '\\n' | grep -i rewrite

# 3. See how the backend receives the path (app logs)
kubectl logs deploy/api --tail=20 | grep -i 'GET\\|path'

# 4. Test each path explicitly
curl -H "Host: app.local" http://INGRESS_IP/api/users -v
\`\`\``,
      solution: `**Understanding the problem:**

- **pathType Exact** only matches the identical path — \`/api\` does NOT match \`/api/users\`. Use \`Prefix\` to match subpaths.
- **rewrite-target with capture** — when using \`rewrite-target: /$2\` with a regex path, you need the correct capture group:

\`\`\`yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  rules:
    - host: app.local
      http:
        paths:
          - path: /api(/|$)(.*)   # $2 captures the rest
            pathType: ImplementationSpecific
            backend:
              service:
                name: api
                port:
                  number: 80
\`\`\`

With this, \`/api/users\` reaches the backend as \`/users\`.

**Quick fixes:**
- 404 on subpath → change \`pathType: Exact\` to \`Prefix\`.
- Backend receives wrong path → review the path regex + the group in \`rewrite-target\`.
- No rewrite and want to preserve the path → simply do not use the rewrite-target annotation.

**Prevention:** prefer \`pathType: Prefix\` without rewrite when the backend already expects the full path; reserve rewrite for when you really need to strip the prefix.`
    }
  ]
};
