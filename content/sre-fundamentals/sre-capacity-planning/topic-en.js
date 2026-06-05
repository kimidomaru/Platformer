window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['sre-fundamentals/sre-capacity-planning'] = {
  theory: `# Capacity Planning & Demand Forecasting

## Relevance
> Capacity planning is one of the core SRE functions — it avoids both over-provisioning (cost) and under-provisioning (unavailability). It is tested in senior SRE interviews and in cloud certifications.

## The Capacity Planning Process

\`\`\`
1. MEASURE → collect current utilization data
2. MODEL → project future growth
3. PLAN → when/how much to provision
4. PROVISION → adjust capacity
5. MONITOR → validate forecast vs reality
\`\`\`

### Essential Capacity Metrics

| Resource | Primary Metric | Warning Signal |
|----------|---------------|----------------|
| CPU | avg utilization % + p95 | > 70% sustained |
| Memory | Working set + cache | OOM kills > 0 |
| Storage | Growth/day + IOPS | > 80% filled |
| Network | Mbps + packet loss | > 80% bandwidth |
| Database | QPS + latency + connections | Query time degradation |

## Demand Forecasting

### Growth Models

**Linear**: traffic grows proportionally to time (e.g., stable company)
\`\`\`
required_capacity = current_capacity + (monthly_growth × months)
\`\`\`

**Exponential**: accelerated growth (e.g., hypergrowth startup)
\`\`\`
required_capacity = current_capacity × (1 + growth_rate)^n
\`\`\`

**Seasonal**: predictable peaks (Black Friday, start of fiscal year)
\`\`\`
# Maintain at least 2 cycles of history to identify patterns
peak_multiplier = max(peak_traffic) / avg(normal_traffic)
\`\`\`

### PromQL Queries for Capacity Planning

\`\`\`promql
# CPU growth rate (last 4 weeks, projected for 4 weeks)
predict_linear(
  avg(rate(container_cpu_usage_seconds_total[5m]))[4w:1h],
  4 * 7 * 24 * 3600  # 4 weeks in seconds
)

# When will the disk fill? (days remaining)
predict_linear(
  node_filesystem_avail_bytes{mountpoint="/"}[7d],
  0
) / 86400

# Pod growth in namespace (30-day forecast)
predict_linear(
  count(kube_pod_info{namespace="production"})[30d:1d],
  30 * 86400
)
\`\`\`

## Right-Sizing in Kubernetes

### Identifying poorly allocated resources

\`\`\`bash
# VPA (Vertical Pod Autoscaler) in Recommendation mode
kubectl describe vpa myapp-vpa -n production
# Checks: recommendation vs current request

# Check under-utilized pods
kubectl top pods -n production | sort -k3 -n
# Compare with requests configured in Deployment

# Check OOM kills (under-allocated memory)
kubectl get events -n production | grep OOMKilled
\`\`\`

\`\`\`yaml
# VPA in recommendation mode (does not change automatically)
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: myapp-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  updatePolicy:
    updateMode: "Off"        # Only recommends, does not change
  resourcePolicy:
    containerPolicies:
      - containerName: myapp
        minAllowed:
          cpu: 50m
          memory: 64Mi
        maxAllowed:
          cpu: 2
          memory: 2Gi
\`\`\`

## Load Testing as a Capacity Tool

\`\`\`bash
# k6 — load test to validate capacity
cat > capacity-test.js << 'EOF'
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // ramp up to 100 VUs
    { duration: '5m', target: 100 },   // sustain at 100 VUs (baseline)
    { duration: '2m', target: 500 },   // ramp up to peak
    { duration: '5m', target: 500 },   // sustain at 500 VUs (stress)
    { duration: '2m', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // < 1% errors
  },
};

export default function () {
  const res = http.get('https://myapp.example.com/api/products');
  check(res, { 'status 200': (r) => r.status === 200 });
}
EOF

k6 run capacity-test.js
\`\`\`

## Common Mistakes

1. **Planning only for CPU**: forgetting memory, network, storage, file descriptors — any of them can be the bottleneck.
2. **Using averages without p99**: the average hides peaks. Plan for p95/p99.
3. **Not including seasonality**: e-commerce systems that do not plan for Black Friday.
4. **Insufficient headroom**: planning for 100% of capacity — any spike breaks it. Maintain 30-40% headroom.
`,

  quiz: [
    {
      question: 'Which PromQL function is used to predict when a resource (such as disk) will reach its limit?',
      options: [
        'forecast_linear()',
        'predict_linear()',
        'extrapolate()',
        'project_growth()'
      ],
      correct: 1,
      explanation: 'predict_linear(series[period], future_time) uses linear regression to project a series value in the future. To predict when the disk will fill: predict_linear(node_filesystem_avail_bytes[7d], 0) returns the Unix timestamp when the value will reach 0. Dividing by 86400 converts to days.',
      reference: 'PromQL Queries section — predict_linear is fundamental for proactive capacity planning.'
    },
    {
      question: 'What is the purpose of the VPA (Vertical Pod Autoscaler) in "Off" mode (updateMode: Off)?',
      options: [
        'It completely disables the VPA with no effect',
        'It generates resource recommendations without automatically changing pods',
        'It scales vertically only during maintenance windows',
        'It works the same as Auto mode but without eviction'
      ],
      correct: 1,
      explanation: 'With updateMode: Off, the VPA monitors actual consumption and generates recommendations (visible in kubectl describe vpa), but does NOT automatically change pods. This is ideal for capacity planning: you understand what the VPA would recommend, validate it, and apply manually when convenient. It is the safest mode to start with.',
      reference: 'Right-Sizing section — use updateMode: Off for recommendations without the risk of interruption.'
    },
    {
      question: 'Why is planning capacity based only on average CPU utilization problematic?',
      options: [
        'The average is inaccurate in containerized environments',
        'The average hides peaks — if the p95 of CPU is 3x the average, the system will break at peaks even within the "normal average"',
        'CPU average is not available in Prometheus',
        'CPU averages include only system processes, not application processes'
      ],
      correct: 1,
      explanation: 'Averages hide peaks. If average CPU is 40% but p95 is 85%, 5% of requests occur under overload conditions. Capacity planning must be based on high percentiles (p95, p99) and consider additional headroom (30-40%) to absorb unexpected peaks without degradation.',
      reference: 'Demand Forecasting section — plan for p95/p99 and maintain 30-40% headroom.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 5 steps of the Capacity Planning process?',
      back: '1. **MEASURE** → collect current utilization data (CPU, memory, network, storage, QPS)\n2. **MODEL** → project growth (linear, exponential, seasonal)\n3. **PLAN** → define when and how much to provision (with 30-40% headroom)\n4. **PROVISION** → adjust capacity (HPA, VPA, new nodes, more storage)\n5. **MONITOR** → compare forecast vs reality, adjust the model\n\nThe cycle repeats — each iteration improves the model accuracy.'
    },
    {
      front: 'How do you use predict_linear in PromQL for capacity planning?',
      back: '```promql\n# Predict CPU usage in 30 days\npredict_linear(\n  avg(rate(cpu_usage[5m]))[7d:1h],\n  30 * 86400\n)\n\n# Predict when disk fills (days)\npredict_linear(\n  node_filesystem_avail_bytes[7d],\n  0\n) / -86400\n\n# Pod growth (30 days)\npredict_linear(\n  count(kube_pod_info)[30d:1d],\n  30 * 86400\n)\n```\n\nParameters: `predict_linear(series[lookback], future_seconds)`'
    }
  ],

  lab: {
    scenario: 'Analyze resource utilization in a cluster and generate right-sizing recommendations.',
    objective: 'Use VPA in recommendation mode and PromQL to identify over/under-provisioned pods.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Analyze current utilization',
        instruction: 'Use kubectl top and events to identify pods with poorly allocated resources.',
        hints: ['kubectl top shows real usage', 'OOM kills indicate insufficient memory'],
        solution: `\`\`\`bash
# View current pod utilization
kubectl top pods -A --sort-by=cpu | head -20

# View OOM kills (insufficient memory)
kubectl get events -A --field-selector reason=OOMKilling

# Compare resource requests vs real usage
kubectl get pods -n production -o json | \
  jq '.items[] | {name: .metadata.name, requests: .spec.containers[].resources.requests}'
\`\`\``,
        verify: `\`\`\`bash
# Verify kubectl top is working
kubectl top nodes
# Expected: CPU and MEMORY usage per node
\`\`\``
      },
      {
        title: 'Create VPA in recommendation mode',
        instruction: 'Create a VPA for the nginx deployment in Off mode (recommendations only).',
        hints: ['updateMode: Off does not change pods', 'Verify with kubectl describe vpa'],
        solution: `\`\`\`bash
# Check if VPA is installed
kubectl get crd | grep verticalpodautoscaler

# Create test namespace
kubectl create namespace capacity-test
kubectl create deployment nginx --image=nginx -n capacity-test
kubectl scale deployment nginx --replicas=3 -n capacity-test

# Create VPA
cat << 'EOF' | kubectl apply -f -
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: nginx-vpa
  namespace: capacity-test
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nginx
  updatePolicy:
    updateMode: "Off"
EOF

# Wait for recommendation (may take a few minutes)
sleep 60
kubectl describe vpa nginx-vpa -n capacity-test | grep -A20 "Recommendation:"
\`\`\``,
        verify: `\`\`\`bash
kubectl get vpa -n capacity-test
# Expected: nginx-vpa  Off  ...

# Check if recommendation was generated
kubectl describe vpa nginx-vpa -n capacity-test | grep "Target:"
# Expected (after a few minutes): Target: cpu, memory recommendations

# Cleanup
kubectl delete namespace capacity-test
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pods being OOMKilled repeatedly despite "sufficient" memory limits',
      difficulty: 'medium',
      symptom: 'Pods restart frequently with OOMKilled. The memory limit seems high enough (512Mi) but the kills continue.',
      diagnosis: `\`\`\`bash
# Check OOM kill history
kubectl describe pod myapp-xxx -n production | grep -i "oom\|kill\|memory\|restart"

# View real memory usage (working set vs limit)
kubectl top pod myapp-xxx -n production

# View detailed metrics in Prometheus
# container_memory_working_set_bytes vs container_spec_memory_limit_bytes
\`\`\``,
      solution: `**Common causes**:

1. **Memory leak in the application**: the pod grows until the limit. Solution: identify the leak with profiling.

2. **JVM does not respect container limits**: JVM uses host memory by default. Solution: \`-XX:MaxRAMPercentage=75.0\` or \`-Xmx400m\` (for 512Mi limit).

3. **Requests much smaller than limits**: if requests=64Mi and limits=512Mi, the scheduler can place many pods on the same node, which then compete for memory.

**Solution**:
\`\`\`bash
# Adjust requests close to limit (avoid extreme bursting)
kubectl set resources deployment myapp \
  --requests=memory=384Mi \
  --limits=memory=512Mi \
  -n production

# Use VPA to get recommendations based on real usage
kubectl apply -f vpa-myapp.yaml
\`\`\``
    }
  ]
};
