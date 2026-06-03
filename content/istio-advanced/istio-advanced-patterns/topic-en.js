window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['istio-advanced/istio-advanced-patterns'] = {
  theory: `
# Advanced Traffic Patterns in Istio

## Relevance
Advanced traffic patterns are essential for large-scale production operations. Progressive canary, circuit breaking, locality-aware load balancing, service entry, and multi-cluster are tools that an SRE must master to ensure availability and performance.

## Core Concepts

### Progressive Canary with Flagger

While Istio supports manual traffic shifting via weights in VirtualService, **Flagger** automates progressive canary:

\`\`\`
Flagger Workflow:
1. Deploy new version (v2)
2. Flagger creates canary VirtualService
3. Gradually increases weight: 5% -> 10% -> 25% -> 50% -> 100%
4. Analyzes metrics (success rate, latency)
5. Automatic rollback if metrics degrade
\`\`\`

\`\`\`yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: reviews
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: reviews
  service:
    port: 9080
  analysis:
    interval: 30s
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
      - name: request-success-rate
        thresholdRange:
          min: 99
        interval: 30s
      - name: request-duration
        thresholdRange:
          max: 500
        interval: 30s
\`\`\`

### Locality-Aware Load Balancing

Istio preferentially distributes traffic to endpoints in the same zone/region:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  trafficPolicy:
    loadBalancer:
      localityLbSetting:
        enabled: true
        failover:
          - from: us-east-1
            to: us-west-2
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
\`\`\`

Priority: same node > same zone > same region > failover.

### ServiceEntry — External Services

ServiceEntry registers services outside the mesh so Istio can apply traffic policies:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: external-api
spec:
  hosts:
    - api.external-service.com
  ports:
    - number: 443
      name: https
      protocol: TLS
  resolution: DNS
  location: MESH_EXTERNAL
\`\`\`

Combined with VirtualService for fine-grained control:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: external-api
spec:
  hosts:
    - api.external-service.com
  http:
    - timeout: 3s
      retries:
        attempts: 2
        perTryTimeout: 1s
      route:
        - destination:
            host: api.external-service.com
\`\`\`

### Rate Limiting with EnvoyFilter

\`\`\`yaml
apiVersion: networking.istio.io/v1alpha3
kind: EnvoyFilter
metadata:
  name: rate-limit
  namespace: istio-system
spec:
  configPatches:
    - applyTo: HTTP_FILTER
      match:
        context: SIDECAR_INBOUND
        listener:
          filterChain:
            filter:
              name: envoy.filters.network.http_connection_manager
      patch:
        operation: INSERT_BEFORE
        value:
          name: envoy.filters.http.local_ratelimit
          typed_config:
            "@type": type.googleapis.com/udpa.type.v1.TypedStruct
            type_url: type.googleapis.com/envoy.extensions.filters.http.local_ratelimit.v3.LocalRateLimit
            value:
              stat_prefix: http_local_rate_limiter
              token_bucket:
                max_tokens: 100
                tokens_per_fill: 100
                fill_interval: 60s
              filter_enabled:
                runtime_key: local_rate_limit_enabled
                default_value:
                  numerator: 100
                  denominator: HUNDRED
\`\`\`

### Wasm Extensions

Istio supports WebAssembly extensions to customize Envoy behavior:

\`\`\`yaml
apiVersion: extensions.istio.io/v1alpha1
kind: WasmPlugin
metadata:
  name: custom-auth
  namespace: production
spec:
  selector:
    matchLabels:
      app: reviews
  url: oci://registry.example.com/wasm-plugins/custom-auth:v1
  phase: AUTHN
  pluginConfig:
    header: "x-custom-auth"
    required: true
\`\`\`

### Multi-Cluster with Istio

Istio supports two multi-cluster models:

| Model | Control Plane | Network | Use Case |
|-------|---------------|---------|----------|
| Primary-Remote | 1 primary, N remote | Same or different | Simple, centralized |
| Multi-Primary | N primaries | Same or different | HA, each cluster independent |

\`\`\`bash
# Configure multi-cluster (primary-remote)
# On the primary cluster:
istioctl install --set values.global.meshID=mesh1 \\
  --set values.global.multiCluster.clusterName=cluster1 \\
  --set values.global.network=network1

# On the remote cluster:
istioctl install --set profile=remote \\
  --set values.global.remotePilotAddress=<PRIMARY_ISTIOD_IP>
\`\`\`

### Common Mistakes

1. **ServiceEntry without DNS resolution** — use \`resolution: DNS\` for external hosts with dynamic IPs
2. **EnvoyFilter version mismatch** — EnvoyFilter is coupled to the Envoy version and can break on upgrades
3. **Locality LB without outlierDetection** — locality failover requires circuit breaker configured
4. **Wasm plugin not loading** — verify the OCI image is accessible and the format is compatible

## Killer.sh Style Challenge

> **Scenario:** Configure ServiceEntry to access an external API (api.example.com:443). Apply 5s timeout and 2 retry attempts. Add circuit breaker with ejection after 3 consecutive errors and locality failover.
`,
  quiz: [
    {
      question: 'What is the purpose of ServiceEntry in Istio?',
      options: [
        'Register internal services in the mesh',
        'Register external services so Istio can apply traffic policies',
        'Create DNS entries for services',
        'Expose internal services externally'
      ],
      correct: 1,
      explanation: 'ServiceEntry registers services outside the mesh (external APIs, databases) so Istio can apply retries, timeouts, circuit breaking, and observability to egress traffic.',
      reference: 'Related concept: ServiceEntry with location MESH_EXTERNAL vs MESH_INTERNAL.'
    },
    {
      question: 'Which DestinationRule field configures locality-aware load balancing?',
      options: [
        'trafficPolicy.loadBalancer.simple',
        'trafficPolicy.loadBalancer.localityLbSetting',
        'trafficPolicy.localityAware',
        'spec.locality.enabled'
      ],
      correct: 1,
      explanation: 'localityLbSetting within trafficPolicy.loadBalancer enables locality-based (zone/region) traffic distribution with configurable failover.',
      reference: 'Related concept: outlierDetection is required for locality failover to work.'
    },
    {
      question: 'What are WasmPlugins in Istio?',
      options: [
        'Java plugins for istiod',
        'WebAssembly extensions that customize Envoy proxy behavior',
        'Python modules for observability',
        'Network drivers for the CNI'
      ],
      correct: 1,
      explanation: 'WasmPlugins allow extending the Envoy proxy with custom logic compiled to WebAssembly. They can be used for authentication, header transformation, rate limiting, and more.',
      reference: 'Related concept: Plugin phases — AUTHN, AUTHZ, STATS.'
    },
    {
      question: 'What is the difference between Primary-Remote and Multi-Primary multi-cluster models?',
      options: [
        'Primary-Remote has 1 centralized control plane; Multi-Primary has N independent control planes',
        'Primary-Remote supports only 2 clusters; Multi-Primary supports N clusters',
        'No functional difference',
        'Primary-Remote uses mTLS; Multi-Primary uses plaintext'
      ],
      correct: 0,
      explanation: 'In Primary-Remote, one primary cluster runs istiod and remote clusters connect to it. In Multi-Primary, each cluster has its own istiod and they synchronize with each other.',
      reference: 'Related concept: meshID, clusterName, and network for multi-cluster configuration.'
    },
    {
      question: 'Why does locality load balancing require outlierDetection?',
      options: [
        'To collect locality metrics',
        'To detect failing endpoints and enable automatic failover to another zone',
        'To limit connections per locality',
        'To configure DNS per region'
      ],
      correct: 1,
      explanation: 'Locality failover only occurs when local endpoints are ejected by the circuit breaker (outlierDetection). Without it, traffic continues to be sent to failing endpoints in the same zone.',
      reference: 'Related concept: consecutive5xxErrors and baseEjectionTime in outlierDetection.'
    },
    {
      question: 'What is the risk of using EnvoyFilter in production?',
      options: [
        'No risks',
        'It is coupled to the Envoy version and can break on Istio upgrades',
        'Does not support HTTPS',
        'Requires istiod restart'
      ],
      correct: 1,
      explanation: 'EnvoyFilter manipulates the internal Envoy configuration, which can change between versions. A filter that works with Envoy 1.28 may not work with 1.29. Use with caution and prefer higher-level APIs.',
      reference: 'Related concept: Prefer WasmPlugin and Telemetry API when possible.'
    },
    {
      question: 'In Flagger, what happens when canary metrics degrade below the threshold?',
      options: [
        'Weight continues increasing',
        'Flagger automatically rolls back to the previous version',
        'Deployment is paused indefinitely',
        'Flagger sends an alert but takes no action'
      ],
      correct: 1,
      explanation: 'Flagger monitors metrics (success rate, latency) during the canary. If defined thresholds in the analysis are not met after N attempts (threshold), it performs an automatic rollback.',
      reference: 'Related concept: stepWeight, maxWeight, and interval in the Canary configuration.'
    }
  ],
  flashcards: [
    {
      front: 'What is ServiceEntry and when to use it?',
      back: '**ServiceEntry** registers external services in the Istio mesh.\n\n**When to use:**\n- Access external APIs with retries/timeouts\n- Apply circuit breaker on external dependencies\n- Get egress traffic metrics\n- Control which external services are accessible\n\n**location:** MESH_EXTERNAL (outside) or MESH_INTERNAL (inside)\n**resolution:** DNS, STATIC, or NONE'
    },
    {
      front: 'How does locality-aware load balancing work?',
      back: 'Istio prioritizes endpoints by locality:\n\n1. **Same node** (highest priority)\n2. **Same zone** (e.g., us-east-1a)\n3. **Same region** (e.g., us-east-1)\n4. **Failover** (another region)\n\n**Requirements:**\n- Nodes with labels topology.kubernetes.io/zone\n- DestinationRule with localityLbSetting.enabled: true\n- outlierDetection configured (required for failover)'
    },
    {
      front: 'What are the two Istio multi-cluster models?',
      back: '**Primary-Remote:**\n- 1 cluster with istiod (primary)\n- N clusters connect to primary\n- Simple, centralized\n- Single point of failure for control plane\n\n**Multi-Primary:**\n- Each cluster has its own istiod\n- Synchronize with each other\n- High availability\n- More complex to operate'
    },
    {
      front: 'What is Flagger and how does it integrate with Istio?',
      back: '**Flagger** is a progressive delivery operator that automates canary deployments.\n\n**Integration with Istio:**\n1. Monitors target Deployment\n2. Creates VirtualService and DestinationRule\n3. Gradually increases weight (stepWeight)\n4. Analyzes Prometheus metrics\n5. Automatic rollback if metrics degrade\n\nConfigured via Canary CRD with analysis.metrics.'
    },
    {
      front: 'What is the difference between EnvoyFilter and WasmPlugin?',
      back: '**EnvoyFilter:**\n- Direct patches to Envoy config\n- Coupled to Envoy version\n- Can break on upgrades\n- More flexible but risky\n\n**WasmPlugin:**\n- Custom logic in WebAssembly\n- Stable and portable API\n- Works across versions\n- Safer for production\n- Supports OCI registry\n\nPrefer WasmPlugin when possible.'
    },
    {
      front: 'How to configure rate limiting in Istio?',
      back: '**Local Rate Limiting** (per proxy):\n- Uses EnvoyFilter with local_ratelimit\n- Configures token_bucket (max_tokens, fill_interval)\n- Simple, no external dependency\n\n**Global Rate Limiting:**\n- Uses external rate limit service (envoy ratelimit service)\n- Shares counters between proxies\n- More complex but consistent\n\nAlternative: use WasmPlugin for custom logic.'
    },
    {
      front: 'How does Istio handle traffic to external services by default?',
      back: '**ALLOW_ANY mode (default):**\n- All egress traffic is allowed\n- No observability for unregistered services\n\n**REGISTRY_ONLY mode:**\n- Only services with ServiceEntry are accessible\n- More secure but requires explicit registration\n\nConfigure via:\n\`meshConfig.outboundTrafficPolicy.mode\`\n\nRecommendation: use REGISTRY_ONLY in production for full control.'
    }
  ],
  lab: {
    scenario: 'You need to configure controlled access to an external API, with circuit breaker and locality-aware load balancing for an internal service.',
    objective: 'Configure ServiceEntry, DestinationRule with locality LB and circuit breaker, and test failover.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Configure ServiceEntry for External API',
        instruction: `Register an external API in the mesh using ServiceEntry and apply timeout and retries.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: external-api
  namespace: default
spec:
  hosts:
    - httpbin.org
  ports:
    - number: 443
      name: https
      protocol: TLS
    - number: 80
      name: http
      protocol: HTTP
  resolution: DNS
  location: MESH_EXTERNAL
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: external-api
  namespace: default
spec:
  hosts:
    - httpbin.org
  http:
    - timeout: 5s
      retries:
        attempts: 2
        perTryTimeout: 2s
        retryOn: 5xx,reset,connect-failure
      route:
        - destination:
            host: httpbin.org
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: external-api
  namespace: default
spec:
  host: httpbin.org
  trafficPolicy:
    tls:
      mode: SIMPLE
    outlierDetection:
      consecutive5xxErrors: 3
      interval: 30s
      baseEjectionTime: 60s
EOF
\`\`\``,
        hints: [
          'ServiceEntry with location: MESH_EXTERNAL registers the service as external',
          'resolution: DNS is needed for hosts with dynamic IPs',
          'VirtualService applies retries and timeout to egress traffic',
          'DestinationRule with tls.mode: SIMPLE enables TLS for the external host'
        ],
        solution: `\`\`\`bash
kubectl apply -f external-api-setup.yaml

# Test access
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://httpbin.org/get
\`\`\``,
        verify: `\`\`\`bash
# Verify ServiceEntry
kubectl get serviceentry external-api
# Expected output: external-api   ["httpbin.org"]   Xs

# Verify VirtualService
kubectl get vs external-api
# Expected output: external-api   ["httpbin.org"]   Xs

# Verify DestinationRule
kubectl get dr external-api -o jsonpath='{.spec.trafficPolicy.outlierDetection}'
# Expected output: {"baseEjectionTime":"60s","consecutive5xxErrors":3,"interval":"30s"}
\`\`\``
      },
      {
        title: 'Configure Locality-Aware Load Balancing',
        instruction: `Configure locality LB for an internal service with failover between zones.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews-locality
  namespace: default
spec:
  host: reviews
  trafficPolicy:
    loadBalancer:
      localityLbSetting:
        enabled: true
        failover:
          - from: us-east-1/us-east-1a
            to: us-east-1/us-east-1b
          - from: us-east-1
            to: us-west-2
    outlierDetection:
      consecutive5xxErrors: 3
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 100
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
          'Locality LB uses topology.kubernetes.io/zone and /region labels from nodes',
          'outlierDetection is mandatory for failover to work',
          'maxEjectionPercent: 100 allows ejecting all endpoints in a zone',
          'Failover follows the order: same zone > same region > defined region'
        ],
        solution: `\`\`\`bash
kubectl apply -f reviews-locality-dr.yaml

# Verify node locality labels
kubectl get nodes --show-labels | grep topology
\`\`\``,
        verify: `\`\`\`bash
# Verify DestinationRule
kubectl get dr reviews-locality -o yaml | grep -A10 localityLbSetting
# Expected output: enabled: true with failover configured

# Verify outlierDetection
kubectl get dr reviews-locality -o jsonpath='{.spec.trafficPolicy.outlierDetection}'
# Expected output: consecutive5xxErrors and baseEjectionTime configured

# Verify node labels
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{" zone="}{.metadata.labels.topology\\.kubernetes\\.io/zone}{"\\n"}{end}'
# Expected output: nodes with assigned zones
\`\`\``
      },
      {
        title: 'Configure Outbound Traffic Policy',
        instruction: `Configure the mesh to block unregistered egress traffic and verify that only services with ServiceEntry are accessible.

\`\`\`bash
# Check current policy
kubectl get configmap istio -n istio-system -o jsonpath='{.data.mesh}' | grep outboundTrafficPolicy

# Configure REGISTRY_ONLY (blocks unregistered traffic)
istioctl install --set profile=demo \\
  --set meshConfig.outboundTrafficPolicy.mode=REGISTRY_ONLY -y

# Test: access to httpbin.org (registered via ServiceEntry) should work
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://httpbin.org/get
# Expected: 200

# Test: access to unregistered service should fail
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://example.com
# Expected: 502 (blocked by mesh)
\`\`\``,
        hints: [
          'REGISTRY_ONLY blocks traffic to hosts without ServiceEntry',
          'ALLOW_ANY (default) allows all egress traffic',
          'After changing the policy, existing Pods need restart to apply',
          'Use ServiceEntry for each external dependency that needs to be accessible'
        ],
        solution: `\`\`\`bash
# Configure REGISTRY_ONLY
istioctl install --set profile=demo --set meshConfig.outboundTrafficPolicy.mode=REGISTRY_ONLY -y

# Restart Pods to apply
kubectl rollout restart deployment sleep

# Test access
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://httpbin.org/get
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://example.com
\`\`\``,
        verify: `\`\`\`bash
# Verify current policy
kubectl get configmap istio -n istio-system -o jsonpath='{.data.mesh}' | grep -A1 outboundTrafficPolicy
# Expected output: mode: REGISTRY_ONLY

# Verify httpbin works (has ServiceEntry)
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://httpbin.org/get
# Expected output: 200

# Verify unregistered service is blocked
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://example.com
# Expected output: 502 or connection refused
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ServiceEntry not working - egress traffic blocked',
      difficulty: 'medium',
      symptom: 'Created ServiceEntry for an external host but requests continue failing with 502 or connection refused.',
      diagnosis: `\`\`\`bash
# Check if ServiceEntry is correct
kubectl get serviceentry -o yaml

# Check if the host is resolved by the proxy
POD=\$(kubectl get pod -l app=sleep -o jsonpath='{.items[0].metadata.name}')
istioctl proxy-config clusters \$POD | grep <external-host>

# Check proxy logs
kubectl logs \$POD -c istio-proxy | grep <external-host>

# Check egress policy
kubectl get configmap istio -n istio-system -o jsonpath='{.data.mesh}' | grep outbound

# Test DNS
kubectl exec \$POD -c sleep -- nslookup <external-host>
\`\`\``,
      solution: `**Common causes:**

1. **Wrong port:** Verify the port in ServiceEntry matches the port used by the application. For HTTPS, use port 443 with protocol TLS.

2. **Wrong resolution:** For hosts with dynamic IPs, use \`resolution: DNS\`. For fixed IPs, use \`resolution: STATIC\` with addresses.

3. **TLS mode:** If the external service uses HTTPS, add a DestinationRule with \`tls.mode: SIMPLE\`:
\`\`\`yaml
trafficPolicy:
  tls:
    mode: SIMPLE
\`\`\`

4. **Namespace scope:** ServiceEntry in namespace X may not be visible in namespace Y. Use \`exportTo: ["*"]\` for global visibility.`
    },
    {
      title: 'Locality failover not working',
      difficulty: 'hard',
      symptom: 'Configured locality-aware load balancing but when endpoints in a zone fail, traffic does not failover to another zone.',
      diagnosis: `\`\`\`bash
# Check node locality labels
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{" zone="}{.metadata.labels.topology\\.kubernetes\\.io/zone}{" region="}{.metadata.labels.topology\\.kubernetes\\.io/region}{"\\n"}{end}'

# Check DestinationRule
kubectl get dr <name> -o yaml | grep -A15 localityLbSetting

# Check if outlierDetection is configured
kubectl get dr <name> -o jsonpath='{.spec.trafficPolicy.outlierDetection}'

# Check endpoint distribution by zone
istioctl proxy-config endpoints \$(kubectl get pod -l app=<app> -o jsonpath='{.items[0].metadata.name}') | grep <service>
\`\`\``,
      solution: `**Causes and solutions:**

1. **No outlierDetection:** Locality failover REQUIRES circuit breaker. Without it, failing endpoints are not ejected and failover does not happen.

2. **Missing locality labels:** Nodes must have the labels:
   - \`topology.kubernetes.io/zone\`
   - \`topology.kubernetes.io/region\`

3. **Low maxEjectionPercent:** If configured as 10%, at most 10% of endpoints are ejected. This may not be enough to trigger failover. Consider \`maxEjectionPercent: 100\`.

4. **Wrong failover order:** The from/to pairs must correspond to the actual zones of your nodes.`
    },
    {
      title: 'EnvoyFilter causes errors after Istio upgrade',
      difficulty: 'hard',
      symptom: 'After upgrading Istio, services return 503 or NR (No Route). EnvoyFilters that worked before now cause errors.',
      diagnosis: `\`\`\`bash
# List EnvoyFilters
kubectl get envoyfilter --all-namespaces

# Check proxy logs for errors
kubectl logs <pod> -c istio-proxy | grep -i "error\\|reject\\|invalid"

# Check proxy configuration
istioctl proxy-config listeners <pod> --output json | head -100

# Check Envoy version
kubectl exec <pod> -c istio-proxy -- pilot-agent request GET /server_info | grep version

# Check if the filter is valid
istioctl analyze -n <namespace>
\`\`\``,
      solution: `**Actions to resolve:**

1. **Disable EnvoyFilter temporarily:**
\`\`\`bash
kubectl delete envoyfilter <name> -n <namespace>
# Check if errors stop
\`\`\`

2. **Update the filter** for the new Envoy version. Consult the Envoy changelog for breaking changes.

3. **Migrate to higher-level APIs:** Whenever possible, replace EnvoyFilter with:
   - **WasmPlugin** for custom logic
   - **Telemetry API** for metrics and logging
   - **AuthorizationPolicy** for access control

4. **Test in staging first:** Always test Istio upgrades in non-production environments with all EnvoyFilters applied.`
    }
  ]
};
