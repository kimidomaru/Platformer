window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cilium-fundamentals/cilium-hubble'] = {
  theory: `
# Hubble — Network Observability with eBPF

## Relevance
Hubble is Cilium's observability component, offering complete visibility into network flows, service maps, metrics, and DNS queries in real-time — all without sidecar proxies. It is essential for debugging, security, and network troubleshooting in Cilium clusters.

## Core Concepts

### Hubble Architecture

\`\`\`
┌──────────────────────────────────────┐
│           hubble CLI                  │
│    (queries via Relay or local)      │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│         Hubble Relay                  │
│   (Deployment — aggregates flows     │
│    from all nodes via gRPC)          │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│         Hubble UI                     │
│   (web interface — service maps,     │
│    flow table, namespace view)       │
└──────────────────────────────────────┘
               │
┌──────────────▼───────────────────────┐
│    Hubble Server (on each Agent)      │
│   (collects eBPF datapath flows)     │
│   ┌─────────────────────────────┐    │
│   │  eBPF datapath events       │    │
│   │  (L3/L4/L7 flows)          │    │
│   └─────────────────────────────┘    │
└──────────────────────────────────────┘
\`\`\`

### Hubble CLI

\`\`\`bash
# Observe flows in real-time
hubble observe

# Filter by namespace
hubble observe --namespace production

# Filter by pod
hubble observe --pod production/api-server

# Filter by verdict (allowed/dropped)
hubble observe --verdict DROPPED
hubble observe --verdict ALLOWED

# Filter by type
hubble observe --type l7
hubble observe --type drop
hubble observe --type trace

# Filter by protocol
hubble observe --protocol tcp
hubble observe --protocol http

# Filter by HTTP
hubble observe --http-method GET
hubble observe --http-path "/api/.*"
hubble observe --http-status 500

# Combine filters
hubble observe --namespace production --verdict DROPPED --protocol http

# JSON output
hubble observe -o json

# Compact output
hubble observe -o compact

# Follow flows (streaming)
hubble observe -f
\`\`\`

### Hubble Metrics for Prometheus

\`\`\`yaml
# Enable Hubble metrics via Helm values:
hubble:
  enabled: true
  metrics:
    enabled:
      - dns
      - drop
      - tcp
      - flow
      - icmp
      - http
    serviceMonitor:
      enabled: true  # if using Prometheus Operator
\`\`\`

**Exported metrics:**

| Metric | Description |
|--------|-------------|
| hubble_flows_processed_total | Total flows processed |
| hubble_drop_total | Drops by reason |
| hubble_dns_queries_total | DNS queries |
| hubble_dns_responses_total | DNS responses |
| hubble_http_requests_total | HTTP requests (with status) |
| hubble_http_request_duration_seconds | HTTP latency |
| hubble_tcp_flags_total | TCP flags by type |

### Hubble UI — Service Map

\`\`\`bash
# Access Hubble UI
kubectl port-forward -n kube-system svc/hubble-ui 12000:80

# Open in browser
# http://localhost:12000
\`\`\`

**UI Features:**
- Visual service dependency map
- Flow table with filters
- Namespace view
- L3/L4/L7 flow details
- Policy verdict indicators (allowed/denied)

### Hubble Use Cases

\`\`\`
1. Connectivity Debug:
   hubble observe --pod <pod> --verdict DROPPED
   → Identifies blocked packets and why

2. DNS Audit:
   hubble observe --type dns
   → Shows all DNS queries and responses

3. L7 Monitoring:
   hubble observe --type l7 --protocol http
   → Shows HTTP requests with status codes

4. Service Dependency:
   Hubble UI → service map
   → Visualizes service dependencies

5. Security Audit:
   hubble observe --verdict DROPPED --namespace production
   → Identifies blocked access attempts

6. Latency:
   hubble observe --type l7 --protocol http -o json | jq '.flow.l7.latency'
   → Measures per-request latency
\`\`\`

### Hubble Flows — Anatomy

\`\`\`
A Hubble flow contains:
  Timestamp:       when the event occurred
  Source:           source pod/identity
  Destination:     destination pod/identity
  Verdict:         FORWARDED, DROPPED, AUDIT, ERROR
  Type:            L3/L4, L7, DNS, drop
  IP:              IP addresses
  L4:              port and protocol
  L7:              HTTP method/path/status, DNS query
  Policy:          which policy caused the verdict
  Drop reason:     reason for drop (if applicable)
  Node:            node where it occurred
\`\`\`

## Essential Commands

\`\`\`bash
# Status
hubble status
hubble list nodes

# Real-time flows
hubble observe -f --namespace production
hubble observe --pod default/nginx --verdict DROPPED

# DNS
hubble observe --type dns --namespace production

# HTTP
hubble observe --protocol http --http-status 5xx
hubble observe --protocol http --http-method POST

# Drops
hubble observe --verdict DROPPED -o json

# Service map
kubectl port-forward svc/hubble-ui -n kube-system 12000:80

# Metrics
curl -s localhost:9965/metrics | grep hubble_
\`\`\`

## Common Mistakes

1. **Hubble disabled**: Hubble is not enabled by default in all installations. Check helm values.
2. **Relay not connecting**: Hubble Relay needs gRPC between agents. Check port 4244/TCP.
3. **UI without data**: Hubble UI needs Relay working. Check hubble-relay pod and service.
4. **Missing metrics**: Metrics need to be explicitly enabled in Helm (hubble.metrics.enabled).
5. **Buffer overflow**: In high-traffic clusters, flows can be lost. Increase ring buffer size.

## Killer.sh Style Challenge

**Scenario:** Use Hubble to diagnose and monitor a connectivity issue in production.

**Tasks:**
1. Find all DROPPED flows for a specific pod
2. Identify failing DNS queries in a namespace
3. Analyze HTTP latency between two services
4. Configure Hubble metrics for Prometheus
`,
  quiz: [
    {
      question: 'What is Hubble in the context of Cilium?',
      options: [
        'A load balancer for services',
        'Cilium\'s observability component that provides network flow visibility, DNS, metrics, and service maps using eBPF datapath data',
        'An alternative CNI to Cilium',
        'A sidecar proxy for service mesh'
      ],
      correct: 1,
      explanation: 'Hubble is integrated into the Cilium Agent and collects data directly from the eBPF datapath without adding sidecar proxy overhead. It provides L3/L4/L7 visibility, DNS queries, policy verdicts, service dependency maps, and exports metrics to Prometheus.',
      reference: 'Related concept: cilium-architecture — Hubble is integrated with the Agent, not a separate component.'
    },
    {
      question: 'What is the function of Hubble Relay?',
      options: [
        'Route traffic between pods',
        'Aggregate flow data from all Cilium Agents via gRPC, enabling centralized querying by CLI and UI',
        'Store policies in etcd',
        'Load balance DNS'
      ],
      correct: 1,
      explanation: 'Hubble Relay is a Deployment that connects to all Cilium Agents via gRPC and aggregates their data. Without Relay, the CLI can only see flows from the local node. With Relay, you see flows from the entire cluster. Hubble UI depends on Relay to function.',
      reference: 'Related concept: cilium-hubble — Relay needs port 4244/TCP between agents.'
    },
    {
      question: 'How do you filter only DROPPED packets in Hubble?',
      options: [
        'hubble observe --filter drop',
        'hubble observe --verdict DROPPED shows only flows that were denied by policies or other reasons',
        'hubble observe --type error',
        'hubble observe --show-drops'
      ],
      correct: 1,
      explanation: 'hubble observe --verdict DROPPED filters only flows with DROPPED verdict. Other verdicts include FORWARDED (allowed), AUDIT (monitored), and ERROR. You can combine with --namespace or --pod for more specificity. Add -o json for details including drop reason.',
      reference: 'Related concept: cilium-network-policies — drops usually indicate policies blocking traffic.'
    },
    {
      question: 'What metrics can Hubble export to Prometheus?',
      options: [
        'Only pod CPU metrics',
        'DNS queries/responses, drops by reason, HTTP requests with status and latency, TCP flags, and total flows processed',
        'Only node network metrics',
        'Only pod counts'
      ],
      correct: 1,
      explanation: 'Hubble exports rich metrics: hubble_dns_queries_total, hubble_drop_total (by reason), hubble_http_requests_total (with status code), hubble_http_request_duration_seconds, hubble_tcp_flags_total, and hubble_flows_processed_total. They need to be enabled via Helm.',
      reference: 'Related concept: sre-observability — Hubble metrics complement kube-state-metrics.'
    },
    {
      question: 'How do you access the Hubble UI?',
      options: [
        'Via kubectl exec into the Hubble pod',
        'Via port-forward: kubectl port-forward svc/hubble-ui -n kube-system 12000:80, then access localhost:12000',
        'Via default NodePort on port 30000',
        'Through Grafana'
      ],
      correct: 1,
      explanation: 'Hubble UI is accessed via port-forward to port 80 of the hubble-ui service. It shows service dependency maps, flow tables with filters, namespace view, and L3/L4/L7 flow details. Requires hubble-ui and hubble-relay enabled in Helm.',
      reference: 'Related concept: cilium-hubble — UI depends on Relay to show cluster-wide data.'
    },
    {
      question: 'What does a Hubble flow contain?',
      options: [
        'Only source and destination IP',
        'Timestamp, source/dest pod and identity, verdict, type (L3/L4/L7/DNS), IP, port, protocol, L7 details, applied policy, and drop reason',
        'Only the service name',
        'Only throughput metrics'
      ],
      correct: 1,
      explanation: 'Hubble flows are rich in context: they include identity information (pod labels), policy verdict with which policy caused it, L7 details (HTTP method/path/status or DNS query/response), and drop reason when applicable. All without sidecar overhead.',
      reference: 'Related concept: cilium-hubble — use -o json to see all flow fields.'
    },
    {
      question: 'How do you monitor DNS queries with Hubble?',
      options: [
        'hubble observe --protocol dns',
        'hubble observe --type dns shows all DNS queries and responses, including domain, record type, and response code',
        'hubble observe --port 53',
        'hubble dns list'
      ],
      correct: 1,
      explanation: 'hubble observe --type dns specifically filters DNS events. It shows the queried domain, record type (A, AAAA, CNAME), response, and returned IPs. Essential for debugging DNS resolution issues and auditing which domains pods access.',
      reference: 'Related concept: cilium-network-policies — DNS visibility helps define FQDN policies.'
    }
  ],
  flashcards: [
    {
      front: 'Hubble architecture?',
      back: '**Hubble Server (on each Agent):**\n- Collects flows from eBPF datapath\n- Stores in local ring buffer\n- L3/L4/L7/DNS events\n\n**Hubble Relay (Deployment):**\n- Aggregates flows from ALL agents\n- Centralized gRPC API\n- CLI and UI connect here\n\n**Hubble UI (Deployment):**\n- Web interface\n- Service dependency map\n- Flow table with filters\n- Namespace view\n\n**Hubble CLI:**\n- hubble observe (flows)\n- hubble status (health)\n- hubble list nodes\n\n**No sidecar!**\nData comes from eBPF directly'
    },
    {
      front: 'Main hubble observe filters?',
      back: '**By scope:**\n```bash\n--namespace production\n--pod prod/api-server\n```\n\n**By verdict:**\n```bash\n--verdict DROPPED\n--verdict ALLOWED\n```\n\n**By type:**\n```bash\n--type l7\n--type dns\n--type drop\n```\n\n**By HTTP:**\n```bash\n--http-method GET\n--http-path "/api/.*"\n--http-status 500\n```\n\n**Output:**\n```bash\n-o json    # detailed\n-o compact # summary\n-f         # streaming\n```'
    },
    {
      front: 'Hubble metrics for Prometheus?',
      back: '**Enable via Helm:**\n```yaml\nhubble:\n  metrics:\n    enabled:\n      - dns\n      - drop\n      - tcp\n      - flow\n      - http\n```\n\n**Metrics:**\n- hubble_flows_processed_total\n- hubble_drop_total (by reason)\n- hubble_dns_queries_total\n- hubble_dns_responses_total\n- hubble_http_requests_total\n- hubble_http_request_duration_seconds\n- hubble_tcp_flags_total\n\n**ServiceMonitor:**\n```yaml\nserviceMonitor:\n  enabled: true\n```'
    },
    {
      front: 'Hubble UI features?',
      back: '**Access:**\n```bash\nkubectl port-forward \\\n  svc/hubble-ui \\\n  -n kube-system 12000:80\n# http://localhost:12000\n```\n\n**Features:**\n- Visual service dependency map\n- Flow table with filters\n- Namespace view\n- L3/L4/L7 details\n- Policy verdicts\n  (allowed/denied visualized)\n\n**Requirements:**\n- hubble.ui.enabled=true\n- hubble.relay.enabled=true\n- Relay must be running\n\n**Ideal for:**\n- Understanding dependencies\n- Visual flow debugging\n- Presentations/demos'
    },
    {
      front: 'Hubble use cases?',
      back: '**1. Debug connectivity:**\n```bash\nhubble observe --pod <pod> \\\n  --verdict DROPPED\n```\n\n**2. DNS audit:**\n```bash\nhubble observe --type dns\n```\n\n**3. HTTP monitoring:**\n```bash\nhubble observe --type l7 \\\n  --protocol http\n```\n\n**4. Service map:**\nHubble UI → visual\n\n**5. Security audit:**\n```bash\nhubble observe \\\n  --verdict DROPPED \\\n  --namespace production\n```\n\n**6. Latency:**\n```bash\nhubble observe --type l7 \\\n  -o json | jq .flow.l7.latency\n```'
    },
    {
      front: 'Anatomy of a Hubble flow?',
      back: '**Flow fields:**\n- **Timestamp**: when it occurred\n- **Source**: source pod/identity\n- **Destination**: dest pod/identity\n- **Verdict**: FORWARDED/DROPPED/AUDIT\n- **Type**: L3/L4, L7, DNS, drop\n- **IP**: addresses\n- **L4**: port and protocol\n- **L7**: HTTP method/path/status\n       DNS query/response\n- **Policy**: which policy caused it\n- **Drop reason**: reason for drop\n- **Node**: event node\n\n**View complete:**\n```bash\nhubble observe -o json | jq .\n```'
    }
  ],
  lab: {
    scenario: 'You need to use Hubble to diagnose connectivity issues and monitor network traffic in real-time.',
    objective: 'Use hubble observe to filter flows, identify drops, monitor DNS, and access Hubble UI.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Verify Hubble Status',
        instruction: `Verify that Hubble is enabled and working correctly.

\`\`\`bash
# Hubble status
hubble status

# List nodes
hubble list nodes

# Check Hubble pods
kubectl get pods -n kube-system -l app.kubernetes.io/name=hubble-relay
kubectl get pods -n kube-system -l app.kubernetes.io/name=hubble-ui
\`\`\``,
        hints: [
          'If Hubble is not enabled, use: helm upgrade cilium --set hubble.enabled=true',
          'Relay needs to be Running for CLI to work with cluster-wide data',
          'Without Relay, hubble observe only shows local node flows'
        ],
        solution: `\`\`\`bash
hubble status
hubble list nodes
kubectl get pods -n kube-system -l app.kubernetes.io/part-of=cilium
\`\`\``,
        verify: `\`\`\`bash
hubble status
# Expected output: Healthcheck (via localhost:4245): Ok
#                  Max Flows: XXXX

hubble list nodes
# Expected output: list of nodes with "Connected" status
\`\`\``
      },
      {
        title: 'Observe Flows and Diagnose Drops',
        instruction: `Use hubble observe to monitor traffic and identify blocked packets.

\`\`\`bash
# Generate test traffic
kubectl create namespace hubble-demo
kubectl create deployment web --image=nginx -n hubble-demo
kubectl expose deployment web --port=80 -n hubble-demo

# Observe all flows in the namespace
hubble observe --namespace hubble-demo -f &

# Generate traffic
kubectl run curl-test --image=curlimages/curl --rm -it -n hubble-demo -- curl -s http://web

# Observe drops
hubble observe --namespace hubble-demo --verdict DROPPED

# Observe DNS
hubble observe --namespace hubble-demo --type dns
\`\`\``,
        hints: [
          'Use -f for real-time streaming',
          'DROPPED flows indicate policy blocking or routing issues',
          'DNS type shows domain, record type, and response'
        ],
        solution: `\`\`\`bash
kubectl create namespace hubble-demo
kubectl create deployment web --image=nginx -n hubble-demo
kubectl expose deployment web --port=80 -n hubble-demo
hubble observe --namespace hubble-demo --last 10
\`\`\``,
        verify: `\`\`\`bash
# Verify flows are visible
hubble observe --namespace hubble-demo --last 5
# Expected output: flows showing source, destination, verdict

# Verify flow verdicts
hubble observe --namespace hubble-demo --verdict FORWARDED --last 3
# Expected output: flows with FORWARDED verdict
\`\`\``
      },
      {
        title: 'Access Hubble UI',
        instruction: `Configure port-forward to access Hubble UI and visualize service maps.

\`\`\`bash
# Port-forward to Hubble UI
kubectl port-forward svc/hubble-ui -n kube-system 12000:80 &

# Open in browser: http://localhost:12000

# Select hubble-demo namespace in UI
# Visualize service map and flows
\`\`\``,
        hints: [
          'Hubble UI shows visual service map with dependencies',
          'Select the desired namespace in the dropdown',
          'Flows appear in real-time in the table below the map'
        ],
        solution: `\`\`\`bash
kubectl port-forward svc/hubble-ui -n kube-system 12000:80 &
echo "Open http://localhost:12000 in browser"
\`\`\``,
        verify: `\`\`\`bash
# Verify hubble-ui service exists
kubectl get svc hubble-ui -n kube-system
# Expected output: hubble-ui   ClusterIP   ...   80/TCP

# Verify pod is running
kubectl get pods -n kube-system -l app.kubernetes.io/name=hubble-ui
# Expected output: hubble-ui-xxxxx   Running
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Hubble CLI shows "connection refused"',
      difficulty: 'easy',
      symptom: 'Running hubble observe returns "connection refused" or "unable to connect to Hubble Relay" error.',
      diagnosis: `\`\`\`bash
# Check if Relay is running
kubectl get pods -n kube-system -l app.kubernetes.io/name=hubble-relay

# Check Relay service
kubectl get svc hubble-relay -n kube-system

# Check Relay logs
kubectl logs -n kube-system -l app.kubernetes.io/name=hubble-relay --tail=20

# Check port
kubectl get svc hubble-relay -n kube-system -o jsonpath='{.spec.ports[*].port}'
\`\`\``,
      solution: `**Solutions:**

1. **Relay not installed:** Enable in Helm:
\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set hubble.enabled=true \\
  --set hubble.relay.enabled=true
\`\`\`

2. **Port-forward to Relay:**
\`\`\`bash
# If CLI can't find it automatically
kubectl port-forward svc/hubble-relay -n kube-system 4245:80 &
hubble observe --server localhost:4245
\`\`\`

3. **Relay pod crashloop:** Check resources and logs — may need more memory.`
    },
    {
      title: 'Hubble UI without data / services',
      difficulty: 'medium',
      symptom: 'Hubble UI opens but shows no service map or flows. Page is empty or shows "No data".',
      diagnosis: `\`\`\`bash
# Check Relay connectivity
hubble status

# Check UI pods
kubectl logs -n kube-system -l app.kubernetes.io/name=hubble-ui --tail=20

# Check if Relay has data
hubble observe --last 5

# Check namespace selected in UI
\`\`\``,
      solution: `**Solutions:**

1. **Select correct namespace** in the UI dropdown — it doesn't show all by default.

2. **Generate traffic:** UI only shows data when there are recent flows:
\`\`\`bash
kubectl run curl-test --image=curlimages/curl --rm -it -- curl -s http://some-service
\`\`\`

3. **Check Relay:** UI depends on Relay. If hubble status shows error, fix Relay first.

4. **Backend URL:** Check if UI can reach Relay:
\`\`\`bash
kubectl logs -n kube-system deploy/hubble-ui --tail=20 | grep -i relay
\`\`\``
    },
    {
      title: 'Hubble metrics not appearing in Prometheus',
      difficulty: 'medium',
      symptom: 'Prometheus does not show hubble_* metrics despite being configured.',
      diagnosis: `\`\`\`bash
# Check if metrics are enabled
helm get values cilium -n kube-system | grep -A10 metrics

# Check metrics endpoint
kubectl get pods -n kube-system -l k8s-app=cilium -o wide
kubectl exec -n kube-system <cilium-pod> -- curl -s localhost:9965/metrics | grep hubble

# Check ServiceMonitor
kubectl get servicemonitor -n kube-system | grep hubble
\`\`\``,
      solution: `**Solutions:**

1. **Enable metrics in Helm:**
\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set hubble.metrics.enabled="{dns,drop,tcp,flow,http}"
\`\`\`

2. **ServiceMonitor for Prometheus Operator:**
\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set hubble.metrics.serviceMonitor.enabled=true
\`\`\`

3. **Check scraping:** If not using ServiceMonitor, add a manual job in prometheus.yml pointing to port 9965 of cilium agents.`
    }
  ]
};
