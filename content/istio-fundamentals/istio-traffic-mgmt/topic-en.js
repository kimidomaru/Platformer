window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['istio-fundamentals/istio-traffic-mgmt'] = {
  theory: `
# Istio Traffic Management

## Relevance
Traffic management is the most used Istio feature. It allows you to control how requests are routed between services, implement canary deployments, inject faults for resilience testing, and configure retries and timeouts — all without code changes.

## Core Concepts

### VirtualService

VirtualService defines **how** traffic is routed to a service. It intercepts requests and applies routing rules.

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - match:
        - headers:
            end-user:
              exact: jason
      route:
        - destination:
            host: reviews
            subset: v2     # user "jason" goes to v2
    - route:
        - destination:
            host: reviews
            subset: v1     # everyone else goes to v1
\`\`\`

### DestinationRule

DestinationRule defines **policies** applied to traffic AFTER routing. It configures subsets (versions), load balancing and connection pools.

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        h2UpgradePolicy: DEFAULT
        http1MaxPendingRequests: 100
  subsets:
    - name: v1
      labels:
        version: v1
    - name: v2
      labels:
        version: v2
    - name: v3
      labels:
        version: v3
      trafficPolicy:
        connectionPool:
          http:
            http1MaxPendingRequests: 50
\`\`\`

### Traffic Shifting (Canary)

Distribute traffic between versions using weights:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 90       # 90% of traffic
        - destination:
            host: reviews
            subset: v2
          weight: 10       # 10% of traffic (canary)
\`\`\`

### Retries and Timeouts

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ratings
spec:
  hosts:
    - ratings
  http:
    - route:
        - destination:
            host: ratings
      timeout: 3s
      retries:
        attempts: 3
        perTryTimeout: 1s
        retryOn: 5xx,reset,connect-failure,retriable-4xx
\`\`\`

### Fault Injection

Inject faults to test resilience:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ratings
spec:
  hosts:
    - ratings
  http:
    - fault:
        delay:
          percentage:
            value: 50
          fixedDelay: 5s
        abort:
          percentage:
            value: 10
          httpStatus: 503
      route:
        - destination:
            host: ratings
\`\`\`

### Circuit Breaker

Configured via DestinationRule:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  trafficPolicy:
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
        maxRequestsPerConnection: 10
\`\`\`

### Request Mirroring

Mirror traffic to a version without affecting the response:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 100
      mirror:
        host: reviews
        subset: v2
      mirrorPercentage:
        value: 100.0
\`\`\`

### Common Mistakes

1. **VirtualService without DestinationRule** — subsets referenced in VS must exist in DR
2. **Wrong host** — the hosts field must match the Kubernetes Service name
3. **Weights don't sum to 100** — traffic shifting weights must total 100
4. **Order matters** — match rules are evaluated top to bottom, first match wins

## Killer.sh Style Challenge

> **Scenario:** Configure a canary deployment with 80/20 traffic split between v1 and v2 of the \`productpage\` service. Add 3 retry attempts with 2s timeout per attempt. Inject a 3s delay on 20% of requests to v2 to test resilience.
`,
  quiz: [
    {
      question: 'Which Istio CRD defines how traffic is routed to a service?',
      options: ['DestinationRule', 'VirtualService', 'Gateway', 'ServiceEntry'],
      correct: 1,
      explanation: 'VirtualService defines routing rules that determine how traffic is directed to different service versions, based on headers, URI, percentage, etc.',
      reference: 'Related concept: DestinationRule defines post-routing policies (subsets, load balancing).'
    },
    {
      question: 'In traffic shifting (canary), the route weights must:',
      options: ['Be equal', 'Sum to 100', 'Be greater than 50', 'Value doesn\'t matter'],
      correct: 1,
      explanation: 'The weight fields of all destinations in an HTTP route must sum to exactly 100. For example, 90/10, 80/20, or 50/50.',
      reference: 'Related concept: Progressive delivery with gradual weight increase (1% -> 5% -> 25% -> 100%).'
    },
    {
      question: 'Which VirtualService field configures automatic retry?',
      options: ['spec.http.retry', 'spec.http.retries', 'spec.http.fault.retry', 'spec.retryPolicy'],
      correct: 1,
      explanation: 'The retries field within spec.http configures attempts (number of retries), perTryTimeout (timeout per attempt) and retryOn (conditions that trigger retry).',
      reference: 'Related concept: retryOn accepts values like 5xx, reset, connect-failure, retriable-4xx.'
    },
    {
      question: 'What is the difference between fault delay and fault abort in Istio?',
      options: [
        'delay adds latency, abort returns HTTP error',
        'delay returns error, abort adds latency',
        'delay affects TCP, abort affects HTTP',
        'There is no functional difference'
      ],
      correct: 0,
      explanation: 'fault.delay injects an artificial delay in the request (simulates slowness). fault.abort terminates the request prematurely returning an HTTP error code (simulates failure).',
      reference: 'Related concept: Chaos engineering with fault injection for resilience validation.'
    },
    {
      question: 'What does outlierDetection in DestinationRule do?',
      options: [
        'Detects services outside the mesh',
        'Implements circuit breaker by ejecting failing endpoints',
        'Monitors endpoint latency',
        'Blocks traffic from unknown IPs'
      ],
      correct: 1,
      explanation: 'outlierDetection implements circuit breaking: if an endpoint returns consecutive errors, it is ejected from the load balancing pool for a period (baseEjectionTime).',
      reference: 'Related concept: consecutive5xxErrors, interval and maxEjectionPercent.'
    },
    {
      question: 'What is request mirroring in Istio?',
      options: [
        'Duplicating the service in another namespace',
        'Sending a copy of traffic to another version without affecting the original response',
        'Mirroring metrics between clusters',
        'Replicating configuration between namespaces'
      ],
      correct: 1,
      explanation: 'Request mirroring (or traffic shadowing) sends a copy of each request to an additional destination. The mirror response is discarded — only the primary route response is returned to the client.',
      reference: 'Related concept: Useful for testing a new version with real traffic without impact.'
    },
    {
      question: 'In what order does Istio evaluate match rules in a VirtualService?',
      options: [
        'Alphabetical order',
        'Top to bottom (first match wins)',
        'Most specific first (longest match)',
        'Random with weight'
      ],
      correct: 1,
      explanation: 'The http rules in VirtualService are evaluated sequentially from top to bottom. The first rule whose match corresponds to the request is applied. Therefore, more specific rules should come before more generic ones.',
      reference: 'Related concept: The last rule without match serves as default/catch-all.'
    }
  ],
  flashcards: [
    {
      front: 'What is the difference between VirtualService and DestinationRule?',
      back: '**VirtualService** — defines HOW to route:\n- Match by header, URI, weight\n- Retries, timeouts\n- Fault injection\n- Routing to subsets\n\n**DestinationRule** — defines post-routing policies:\n- Defines subsets (versions)\n- Load balancing (ROUND_ROBIN, RANDOM, LEAST_CONN)\n- Connection pool\n- Circuit breaker (outlierDetection)\n- mTLS settings'
    },
    {
      front: 'How to implement canary deployment with Istio?',
      back: '1. Create DestinationRule with subsets (v1, v2)\n2. Create VirtualService with weight:\n\n\`\`\`yaml\nhttp:\n  - route:\n      - destination:\n          host: app\n          subset: v1\n        weight: 90\n      - destination:\n          host: app\n          subset: v2\n        weight: 10\n\`\`\`\n\nWeights must sum to 100. Adjust gradually.'
    },
    {
      front: 'What types of fault injection does Istio support?',
      back: '1. **Delay** — injects artificial latency:\n   - fixedDelay: delay time\n   - percentage: % of requests affected\n\n2. **Abort** — returns HTTP error:\n   - httpStatus: error code (e.g., 503)\n   - percentage: % of requests affected\n\nBoth can be combined and applied per route.'
    },
    {
      front: 'What is circuit breaking in Istio and how to configure it?',
      back: 'Circuit breaking ejects failing endpoints from the load balancing pool.\n\nConfigured via **DestinationRule.trafficPolicy.outlierDetection**:\n- consecutive5xxErrors: errors before ejection\n- interval: evaluation window\n- baseEjectionTime: time out of pool\n- maxEjectionPercent: max % of ejected endpoints\n\nAlso includes connectionPool to limit simultaneous connections.'
    },
    {
      front: 'What is request mirroring and when to use it?',
      back: '**Mirroring** sends a copy of real traffic to another destination without affecting the client response.\n\n**When to use:**\n- Test new version with production traffic\n- Validate performance before canary\n- Compare responses between versions\n\n**Configuration:** \`mirror\` and \`mirrorPercentage\` fields in VirtualService.'
    },
    {
      front: 'What conditions can trigger retry in Istio?',
      back: 'retryOn field accepts:\n- **5xx** — any 500+ error\n- **reset** — connection reset\n- **connect-failure** — connection failure\n- **retriable-4xx** — retryable 4xx errors (409)\n- **gateway-error** — 502, 503, 504\n- **refused-stream** — refused stream\n\nConfigure with attempts (max retries) and perTryTimeout.'
    },
    {
      front: 'What is the relationship between subsets and Pod labels?',
      back: 'Subsets in DestinationRule map to Pods via labels:\n\n\`\`\`yaml\nsubsets:\n  - name: v1\n    labels:\n      version: v1  # selects Pods with version=v1\n  - name: v2\n    labels:\n      version: v2  # selects Pods with version=v2\n\`\`\`\n\nVirtualService routes to subsets.\nDestinationRule defines which Pods belong to each subset.'
    }
  ],
  lab: {
    scenario: 'You have two Deployments of a reviews service (v1 and v2) and need to implement canary deployment with traffic control, retries and fault injection.',
    objective: 'Configure traffic shifting, retries, timeouts and fault injection using VirtualService and DestinationRule.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Deployments and DestinationRule',
        instruction: `Create two Deployments (v1 and v2) of the reviews service and a DestinationRule with subsets.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: reviews-v1
spec:
  replicas: 2
  selector:
    matchLabels:
      app: reviews
      version: v1
  template:
    metadata:
      labels:
        app: reviews
        version: v1
    spec:
      containers:
        - name: reviews
          image: docker.io/istio/examples-bookinfo-reviews-v1:1.18.0
          ports:
            - containerPort: 9080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: reviews-v2
spec:
  replicas: 1
  selector:
    matchLabels:
      app: reviews
      version: v2
  template:
    metadata:
      labels:
        app: reviews
        version: v2
    spec:
      containers:
        - name: reviews
          image: docker.io/istio/examples-bookinfo-reviews-v2:1.18.0
          ports:
            - containerPort: 9080
---
apiVersion: v1
kind: Service
metadata:
  name: reviews
spec:
  selector:
    app: reviews
  ports:
    - port: 9080
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  subsets:
    - name: v1
      labels:
        version: v1
    - name: v2
      labels:
        version: v2
EOF
\`\`\``,
        hints: [
          'Both Deployments share the label app: reviews for the Service',
          'The version label differentiates v1 from v2 in the subsets',
          'The DestinationRule must exist before the VirtualService that references the subsets'
        ],
        solution: `\`\`\`bash
kubectl apply -f reviews-setup.yaml
kubectl get deploy | grep reviews
kubectl get destinationrule reviews -o yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify Deployments
kubectl get deploy reviews-v1 reviews-v2
# Expected: reviews-v1 2/2, reviews-v2 1/1

# Verify DestinationRule
kubectl get destinationrule reviews
# Expected: reviews   reviews   Xs

# Verify subsets
kubectl get destinationrule reviews -o jsonpath='{.spec.subsets[*].name}'
# Expected: v1 v2
\`\`\``
      },
      {
        title: 'Configure Traffic Shifting and Retries',
        instruction: `Create a VirtualService with 80/20 canary and retry configuration.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 80
        - destination:
            host: reviews
            subset: v2
          weight: 20
      timeout: 5s
      retries:
        attempts: 3
        perTryTimeout: 2s
        retryOn: 5xx,reset,connect-failure
EOF
\`\`\``,
        hints: [
          'Weights must sum to 100 (80 + 20 = 100)',
          'The overall timeout (5s) should be greater than perTryTimeout * attempts',
          'retryOn defines which errors trigger automatic retry'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 80
        - destination:
            host: reviews
            subset: v2
          weight: 20
      timeout: 5s
      retries:
        attempts: 3
        perTryTimeout: 2s
        retryOn: 5xx,reset,connect-failure
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify VirtualService
kubectl get virtualservice reviews
# Expected: reviews   ["reviews"]   Xs

# Verify weights
kubectl get vs reviews -o jsonpath='{.spec.http[0].route[*].weight}'
# Expected: 80 20

# Verify retries
kubectl get vs reviews -o jsonpath='{.spec.http[0].retries.attempts}'
# Expected: 3
\`\`\``
      },
      {
        title: 'Add Fault Injection for Testing',
        instruction: `Update the VirtualService adding fault injection to test resilience.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - match:
        - headers:
            test-fault:
              exact: "true"
      fault:
        delay:
          percentage:
            value: 100
          fixedDelay: 3s
        abort:
          percentage:
            value: 20
          httpStatus: 503
      route:
        - destination:
            host: reviews
            subset: v2
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 80
        - destination:
            host: reviews
            subset: v2
          weight: 20
      timeout: 5s
      retries:
        attempts: 3
        perTryTimeout: 2s
        retryOn: 5xx,reset,connect-failure
EOF
\`\`\``,
        hints: [
          'The fault injection rule uses header match to be activated on demand',
          'More specific rules (with match) should come before generic ones',
          'The header test-fault: true activates fault injection'
        ],
        solution: `\`\`\`bash
kubectl apply -f reviews-vs-fault.yaml

# Test with header
kubectl exec deploy/sleep -c sleep -- curl -s -H "test-fault: true" http://reviews:9080/reviews/1 -w "\\nHTTP_CODE:%{http_code}\\nTIME:%{time_total}\\n"
\`\`\``,
        verify: `\`\`\`bash
# Verify updated VirtualService
kubectl get vs reviews -o yaml | grep -A5 fault
# Expected: delay and abort configured

# Verify analysis
istioctl analyze
# Expected: no errors

# Verify proxy received config
POD=\$(kubectl get pod -l app=reviews,version=v2 -o jsonpath='{.items[0].metadata.name}')
istioctl proxy-config routes \$POD | grep reviews
# Expected: routes configured for reviews
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'VirtualService not working - traffic not routed',
      difficulty: 'medium',
      symptom: 'The VirtualService was created but traffic continues to be distributed equally between all versions, ignoring the routing rules.',
      diagnosis: `\`\`\`bash
# Verify VirtualService is correct
kubectl get vs reviews -o yaml

# Verify DestinationRule exists with subsets
kubectl get dr reviews -o yaml

# Verify Pod labels match subsets
kubectl get pods -l app=reviews --show-labels

# Analyze configuration
istioctl analyze

# Verify proxy received config
istioctl proxy-config routes \$(kubectl get pod -l app=reviews -o jsonpath='{.items[0].metadata.name}')
\`\`\``,
      solution: `**Common causes:**

1. **Missing DestinationRule:** The VirtualService references subsets that don't exist in the DestinationRule. Create the DR with matching subsets.

2. **Incorrect labels:** Pod labels must exactly match the labels defined in the DestinationRule subsets.

3. **Wrong host:** The \`hosts\` field in VS must be the exact Kubernetes Service name (or FQDN).

4. **No sidecar:** If Pods don't have the Envoy sidecar, Istio rules are not applied:
\`\`\`bash
kubectl get pods -l app=reviews -o jsonpath='{.items[*].spec.containers[*].name}'
# Must include istio-proxy
\`\`\``
    },
    {
      title: 'Retries causing load amplification',
      difficulty: 'hard',
      symptom: 'During failures, Istio retries generate request amplification that overloads the target service, worsening the situation.',
      diagnosis: `\`\`\`bash
# Verify retry configuration
kubectl get vs <name> -o jsonpath='{.spec.http[0].retries}'

# Verify retry metrics in Envoy
kubectl exec <pod> -c istio-proxy -- pilot-agent request GET /stats | grep upstream_rq_retry

# Verify request rate at destination
kubectl exec <pod> -c istio-proxy -- pilot-agent request GET /stats | grep upstream_rq_total
\`\`\``,
      solution: `**Strategies to avoid retry storms:**

1. **Limit attempts:** Use at most 2-3 attempts with adequate perTryTimeout.

2. **Configure circuit breaker** together with retries:
\`\`\`yaml
trafficPolicy:
  outlierDetection:
    consecutive5xxErrors: 3
    interval: 10s
    baseEjectionTime: 30s
\`\`\`

3. **Retry budget:** Envoy limits retries to 20% of active requests by default. Avoid increasing this value.

4. **Adequate timeout:** Total timeout must be > perTryTimeout * attempts to allow all retries.

5. **Don't retry non-idempotent operations:** POST/PUT that create resources can duplicate data with retry.`
    },
    {
      title: 'Traffic shifting shows incorrect percentages',
      difficulty: 'easy',
      symptom: 'Configured canary 90/10 but actual distribution appears different (e.g., 70/30 or 50/50).',
      diagnosis: `\`\`\`bash
# Verify configured weights
kubectl get vs <name> -o jsonpath='{.spec.http[0].route}'

# Verify if there are multiple VirtualServices for the same host
kubectl get vs --all-namespaces | grep <host>

# Test with multiple requests
for i in \$(seq 1 100); do
  kubectl exec deploy/sleep -c sleep -- curl -s http://reviews:9080/reviews/1 -o /dev/null -w "%{http_code}\\n"
done | sort | uniq -c
\`\`\``,
      solution: `**Common causes:**

1. **Small sample:** With few requests, distribution may appear different. Test with at least 100+ requests.

2. **Sticky sessions:** If the client reuses connections, requests may go to the same endpoint. Add \`maxRequestsPerConnection: 1\` in DestinationRule.

3. **Multiple VirtualServices:** Two VirtualServices for the same host cause conflict. There should be only one per host.

4. **DNS cache:** Envoy may cache DNS resolution. Verify with proxy-config.`
    }
  ]
};
