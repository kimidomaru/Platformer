window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cilium-advanced/cilium-cluster-mesh'] = {
  theory: `
# ClusterMesh — Multi-Cluster Networking with Cilium

## Relevance
ClusterMesh connects multiple Kubernetes clusters with transparent networking, enabling cross-cluster service discovery, shared services, failover, and network policies between clusters. Essential for multi-cluster architectures, disaster recovery, and global high availability.

## Core Concepts

### What is ClusterMesh?

\`\`\`
ClusterMesh = Cilium's native multi-cluster networking

Enables:
  - Pods from different clusters communicate directly
  - Cross-cluster service discovery (no external DNS)
  - Network policies between clusters
  - Shared services (service in one cluster accessible from others)
  - Global services (service with backends in multiple clusters)

Requirements:
  - All clusters with Cilium installed
  - Non-overlapping Pod CIDRs between clusters
  - Network connectivity between clusters (VPN, peering, etc.)
  - Compatible Cilium versions across clusters
\`\`\`

### Architecture

\`\`\`
┌─────────────────────┐     ┌─────────────────────┐
│     Cluster A        │     │     Cluster B        │
│                      │     │                      │
│  ┌────────────────┐  │     │  ┌────────────────┐  │
│  │ Cilium Agent   │  │     │  │ Cilium Agent   │  │
│  │ + ClusterMesh  │◄─┼─────┼─▶│ + ClusterMesh  │  │
│  └────────────────┘  │     │  └────────────────┘  │
│         │            │     │         │            │
│  ┌──────▼─────────┐  │     │  ┌──────▼─────────┐  │
│  │ clustermesh-   │  │     │  │ clustermesh-   │  │
│  │ apiserver      │◄─┼─────┼─▶│ apiserver      │  │
│  │ (etcd +        │  │     │  │ (etcd +        │  │
│  │  kvstoremesh)  │  │     │  │  kvstoremesh)  │  │
│  └────────────────┘  │     │  └────────────────┘  │
│                      │     │                      │
│  Pod CIDR:           │     │  Pod CIDR:           │
│  10.1.0.0/16         │     │  10.2.0.0/16         │
└─────────────────────┘     └─────────────────────┘
\`\`\`

**Components:**

| Component | Function |
|-----------|----------|
| **clustermesh-apiserver** | Exposes cluster state (services, endpoints, identities) to other clusters |
| **KVStoreMesh** | Synchronizes data between clustermesh-apiserver etcds |
| **Cilium Agent** | Consumes remote data and applies routing/policies |

### Enabling ClusterMesh

\`\`\`bash
# Cluster A
cilium clustermesh enable --service-type LoadBalancer
cilium clustermesh status

# Cluster B
cilium clustermesh enable --service-type LoadBalancer
cilium clustermesh status

# Connect clusters
cilium clustermesh connect --destination-context cluster-b
cilium clustermesh status --wait
\`\`\`

### Global Services

\`\`\`yaml
# Service with backends in MULTIPLE clusters
# Annotate the Service with shared=true
apiVersion: v1
kind: Service
metadata:
  name: api-server
  namespace: production
  annotations:
    io.cilium/global-service: "true"
spec:
  selector:
    app: api-server
  ports:
    - port: 80
      targetPort: 8080
\`\`\`

\`\`\`
Global Service:
  - Service exists in both clusters with SAME name and namespace
  - Annotation io.cilium/global-service: "true"
  - Cilium combines endpoints from both clusters
  - Traffic distributed across all backends (both clusters)

Modes:
  global (default):  traffic goes to any cluster
  preferred-local:   prefers local backends, remote fallback
\`\`\`

### Shared Services (Affinity)

\`\`\`yaml
# Service accessible from other clusters
# but with preference for local backends
apiVersion: v1
kind: Service
metadata:
  name: cache-service
  namespace: production
  annotations:
    io.cilium/global-service: "true"
    io.cilium/service-affinity: "local"
spec:
  selector:
    app: redis
  ports:
    - port: 6379
\`\`\`

\`\`\`
Service Affinity:
  "local":   prefers local cluster backends
             falls back to remote if local unavailable
  "remote":  prefers remote backends
  "none":    no preference (distributes across all)

Use cases:
  - Cache (Redis): affinity=local (avoid cross-cluster latency)
  - Critical API: affinity=none (distribute load)
  - DR: affinity=local with automatic failover
\`\`\`

### Network Policies Cross-Cluster

\`\`\`yaml
# Policy allowing traffic from pods in ANOTHER cluster
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: allow-remote-cluster
  namespace: production
spec:
  endpointSelector:
    matchLabels:
      app: api-server
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: frontend
            # Pods with this label from ANY cluster
            # are allowed (identity-based, cross-cluster)
\`\`\`

\`\`\`
Cross-cluster policies:
  - Identities are synchronized between clusters
  - Label-based policies work cross-cluster
  - No need to explicitly reference the remote cluster
  - eBPF applies policies transparently
\`\`\`

### Disaster Recovery with ClusterMesh

\`\`\`
Scenario: Cluster A (primary) fails completely

With ClusterMesh + Global Services:
  1. Client resolves DNS → Service IP
  2. Service has backends in Cluster A and B
  3. Cluster A fails → Cilium removes A's endpoints
  4. All traffic automatically goes to Cluster B
  5. Cluster A recovers → endpoints re-added
  6. Traffic redistributed

Failover time:
  - Detection: seconds (health check)
  - Convergence: < 30 seconds
  - No manual intervention
  - No DNS changes
\`\`\`

### Requirements and Limitations

\`\`\`
Requirements:
  + Non-overlapping Pod CIDRs between clusters
  + Network connectivity (VPN, VPC peering, direct connect)
  + Same or compatible Cilium version
  + Unique cluster names
  + Shared identities

Limitations:
  - Each cluster needs its own control plane
  - Pod CIDRs must be planned in advance
  - Cross-cluster latency affects performance
  - Recommended maximum: ~255 clusters
  - Requires reliable connectivity between clusters
\`\`\`

## Essential Commands

\`\`\`bash
# ClusterMesh status
cilium clustermesh status
cilium clustermesh status --wait

# Enable
cilium clustermesh enable --service-type LoadBalancer

# Connect clusters
cilium clustermesh connect --destination-context <context>

# Disconnect
cilium clustermesh disconnect --destination-context <context>

# Check global services
kubectl get svc -A -o json | jq '.items[] | select(.metadata.annotations["io.cilium/global-service"]=="true") | .metadata.name'

# Check remote endpoints
cilium service list
cilium bpf lb list

# Check remote identities
cilium identity list | grep remote
\`\`\`

## Common Mistakes

1. **Pod CIDR overlap**: Overlapping CIDRs between clusters cause routing conflicts. Plan CIDRs before creating clusters.
2. **Connectivity between clusters**: ClusterMesh requires connectivity between nodes. Check VPN/peering/firewall.
3. **Incompatible versions**: Very different Cilium versions may have compatibility issues. Keep versions close.
4. **Service not syncing**: Check clustermesh-apiserver is running and connected in both clusters.
5. **High cross-cluster latency**: Use service-affinity=local to prefer local backends and reduce cross-cluster traffic.

## Killer.sh Style Challenge

**Scenario:** Configure ClusterMesh between two clusters and create global services with automatic failover.

**Tasks:**
1. Enable ClusterMesh on both clusters
2. Connect the clusters
3. Create a global service with backends in both clusters
4. Configure service affinity to prefer local backends
5. Simulate cluster failure and validate failover
`,
  quiz: [
    {
      question: 'What is ClusterMesh in Cilium?',
      options: [
        'A tool to install Cilium on multiple clusters',
        'Native multi-cluster networking that enables transparent pod communication, cross-cluster service discovery, global services, and network policies between clusters',
        'A service mesh like Istio',
        'A backup system between clusters'
      ],
      correct: 1,
      explanation: 'ClusterMesh connects multiple Kubernetes clusters with Cilium, allowing pods to communicate directly, services to have backends in multiple clusters (global services), cross-cluster policies using synchronized identities, and automatic failover.',
      reference: 'Related concept: cilium-architecture — ClusterMesh extends the identity model to multi-cluster.'
    },
    {
      question: 'What requirement is CRITICAL for ClusterMesh to work?',
      options: [
        'Clusters must be on the same cloud provider',
        'Pod CIDRs CANNOT overlap between clusters, and there must be network connectivity between them',
        'All clusters must have the same number of nodes',
        'Clusters must use the same namespace for everything'
      ],
      correct: 1,
      explanation: 'Overlapping Pod CIDRs cause routing conflicts — each cluster MUST have a unique range. Additionally, nodes need network connectivity (VPN, VPC peering, direct connect) to exchange traffic. Cluster names must also be unique.',
      reference: 'Related concept: cilium-cluster-mesh — plan CIDRs before creating clusters.'
    },
    {
      question: 'What is a Global Service in ClusterMesh?',
      options: [
        'A service available on the internet',
        'A service with annotation io.cilium/global-service=true that combines endpoints from multiple clusters, distributing traffic across all backends',
        'A service with global NodePort',
        'A service running in all namespaces'
      ],
      correct: 1,
      explanation: 'Global Service is a Service that exists in multiple clusters with the same name and namespace, annotated with io.cilium/global-service: "true". Cilium synchronizes endpoints from all clusters and distributes traffic between them. Ideal for HA and load distribution.',
      reference: 'Related concept: cilium-cluster-mesh — global services enable automatic DR.'
    },
    {
      question: 'What does the annotation io.cilium/service-affinity: "local" do?',
      options: [
        'Blocks traffic from other clusters',
        'Makes the service prefer LOCAL cluster backends, using remote backends only as fallback when no local backends are available',
        'Forces all traffic to the remote cluster',
        'Disables the global service'
      ],
      correct: 1,
      explanation: 'service-affinity: "local" prioritizes backends from the cluster where the client pod is. If local backends become unavailable, traffic automatically falls back to remote backends. Ideal for cache (avoid latency) and DR (automatic failover).',
      reference: 'Related concept: cilium-cluster-mesh — "local" affinity reduces cross-cluster latency.'
    },
    {
      question: 'How does automatic failover work with ClusterMesh?',
      options: [
        'Requires manual DNS change',
        'When a cluster fails, Cilium automatically removes its endpoints from the global service, and all traffic goes to healthy cluster backends — no manual intervention',
        'Requires an external load balancer',
        'Failover takes hours to converge'
      ],
      correct: 1,
      explanation: 'With global services, Cilium monitors backend health across all clusters. When a cluster fails, its endpoints are automatically removed (seconds). Traffic converges to healthy clusters in < 30s. No DNS changes, no manual intervention.',
      reference: 'Related concept: sre-incident-mgmt — ClusterMesh reduces MTTR for cluster failures.'
    },
    {
      question: 'How do network policies work between clusters in ClusterMesh?',
      options: [
        'They don\'t work — policies are local only',
        'Identities are synchronized between clusters, so label-based policies automatically work for pods from any cluster',
        'They need hardcoded IPs from other clusters',
        'They need separate policies per cluster'
      ],
      correct: 1,
      explanation: 'ClusterMesh synchronizes identities (based on labels) between clusters. CiliumNetworkPolicies using endpointSelector/fromEndpoints with labels work for pods from any cluster — no need to reference the remote cluster. eBPF applies policies transparently.',
      reference: 'Related concept: cilium-network-policies — identity-based policies are cross-cluster.'
    },
    {
      question: 'Which component is responsible for exposing cluster state to other clusters?',
      options: [
        'Cilium Operator',
        'clustermesh-apiserver — exposes services, endpoints, and identities for consumption by remote clusters, using etcd and KVStoreMesh for synchronization',
        'kube-apiserver',
        'CoreDNS'
      ],
      correct: 1,
      explanation: 'clustermesh-apiserver is a dedicated component running in each cluster that exposes its state (services, endpoints, identities) via etcd/gRPC. KVStoreMesh synchronizes this data between the clustermesh-apiservers of different clusters.',
      reference: 'Related concept: cilium-cluster-mesh — apiserver needs to be accessible between clusters.'
    }
  ],
  flashcards: [
    {
      front: 'What is ClusterMesh and what does it enable?',
      back: '**ClusterMesh:**\nCilium\'s native multi-cluster\nnetworking\n\n**Enables:**\n- Cross-cluster pod communication\n- Cross-cluster service discovery\n- Global services (multi-cluster backends)\n- Network policies between clusters\n- Automatic failover\n\n**Requirements:**\n- Non-overlapping Pod CIDRs\n- Connectivity between clusters\n- Compatible Cilium versions\n- Unique cluster names\n\n**Enable:**\n```bash\ncilium clustermesh enable\ncilium clustermesh connect \\\n  --destination-context cluster-b\n```'
    },
    {
      front: 'Global Services?',
      back: '**Service with backends\nin MULTIPLE clusters:**\n```yaml\nmetadata:\n  annotations:\n    io.cilium/global-service: \"true\"\n```\n\n**Requirements:**\n- Same name and namespace\n  in both clusters\n- global-service annotation\n\n**Affinity modes:**\n- **none**: no preference\n  (distribute across all)\n- **local**: prefer local\n  (remote fallback)\n- **remote**: prefer remote\n\n**Local affinity:**\n```yaml\nannotations:\n  io.cilium/global-service: \"true\"\n  io.cilium/service-affinity: \"local\"\n```'
    },
    {
      front: 'Automatic failover with ClusterMesh?',
      back: '**Scenario:**\nCluster A fails completely\n\n**Automatic flow:**\n1. Health check detects failure\n2. Cluster A endpoints removed\n3. Traffic → Cluster B automatically\n4. Cluster A recovers → re-added\n5. Traffic redistributed\n\n**Timing:**\n- Detection: seconds\n- Convergence: < 30s\n- No DNS change\n- No manual intervention\n\n**Ideal for:**\n- Disaster Recovery\n- High availability\n- Blue/green between clusters\n- Geographic distribution'
    },
    {
      front: 'Cross-cluster network policies?',
      back: '**How it works:**\n- Identities synchronized\n  between clusters\n- Label-based policies\n  work cross-cluster\n- No need to reference\n  remote cluster\n\n**Example:**\n```yaml\napiVersion: cilium.io/v2\nkind: CiliumNetworkPolicy\nspec:\n  endpointSelector:\n    matchLabels:\n      app: api-server\n  ingress:\n    - fromEndpoints:\n        - matchLabels:\n            app: frontend\n            # works for pods\n            # from ANY cluster!\n```\n\n**eBPF applies transparently**'
    },
    {
      front: 'ClusterMesh architecture?',
      back: '**clustermesh-apiserver:**\n- Runs in each cluster\n- Exposes state (services,\n  endpoints, identities)\n- Uses internal etcd\n\n**KVStoreMesh:**\n- Syncs data between\n  clustermesh-apiservers\n\n**Cilium Agent:**\n- Consumes remote data\n- Applies routing and policies\n\n**Network requirements:**\n- Port 2379 (etcd) between\n  clustermesh-apiservers\n- Pod-to-pod connectivity\n  between clusters\n\n**Limit:**\n~255 clusters recommended'
    },
    {
      front: 'Essential ClusterMesh commands?',
      back: '**Enable:**\n```bash\ncilium clustermesh enable \\\n  --service-type LoadBalancer\n```\n\n**Connect:**\n```bash\ncilium clustermesh connect \\\n  --destination-context cluster-b\n```\n\n**Status:**\n```bash\ncilium clustermesh status\ncilium clustermesh status --wait\n```\n\n**Verify:**\n```bash\n# Global services\nkubectl get svc -A -o json | \\\n  jq \'.items[] | select(\n    .metadata.annotations[\n      \"io.cilium/global-service\"\n    ]==\"true\"\n  )\'\n\n# Remote endpoints\ncilium service list\n```'
    }
  ],
  lab: {
    scenario: 'You need to configure ClusterMesh between two clusters and create global services with automatic failover.',
    objective: 'Enable ClusterMesh, connect clusters, create global service, and test failover.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Enable ClusterMesh',
        instruction: `Enable ClusterMesh on both clusters.

\`\`\`bash
# In Cluster A context
kubectl config use-context cluster-a
cilium clustermesh enable --service-type LoadBalancer

# In Cluster B context
kubectl config use-context cluster-b
cilium clustermesh enable --service-type LoadBalancer

# Check status on both
kubectl config use-context cluster-a
cilium clustermesh status
kubectl config use-context cluster-b
cilium clustermesh status
\`\`\``,
        hints: [
          'service-type can be LoadBalancer, NodePort, or ClusterIP (depends on environment)',
          'Each cluster needs a unique cluster name',
          'Pod CIDRs CANNOT overlap between clusters'
        ],
        solution: `\`\`\`bash
# Cluster A
kubectl config use-context cluster-a
cilium clustermesh enable --service-type LoadBalancer

# Cluster B
kubectl config use-context cluster-b
cilium clustermesh enable --service-type LoadBalancer
\`\`\``,
        verify: `\`\`\`bash
# Check on both clusters
cilium clustermesh status
# Expected output: ClusterMesh is enabled
#                  Service Type: LoadBalancer

kubectl get pods -n kube-system -l app.kubernetes.io/name=clustermesh-apiserver
# Expected output: clustermesh-apiserver-xxxxx Running
\`\`\``
      },
      {
        title: 'Connect Clusters',
        instruction: `Connect the two clusters using cilium clustermesh connect.

\`\`\`bash
# From Cluster A, connect to Cluster B
kubectl config use-context cluster-a
cilium clustermesh connect --destination-context cluster-b

# Wait for connection
cilium clustermesh status --wait

# Verify both clusters see each other
cilium clustermesh status
\`\`\``,
        hints: [
          'Connect needs access to kubeconfig of both clusters',
          'The connection is bidirectional — only needs to be done from one side',
          'Use --wait to block until connection is established'
        ],
        solution: `\`\`\`bash
kubectl config use-context cluster-a
cilium clustermesh connect --destination-context cluster-b
cilium clustermesh status --wait
\`\`\``,
        verify: `\`\`\`bash
cilium clustermesh status
# Expected output: Cluster: cluster-b
#                  Status: Connected
#                  Nodes: X
#                  Identities: X (synced)
\`\`\``
      },
      {
        title: 'Create Global Service',
        instruction: `Create a deployment and global service in both clusters.

\`\`\`bash
# In both clusters, create the same deployment and service
for ctx in cluster-a cluster-b; do
  kubectl config use-context \$ctx
  kubectl create namespace global-demo
  kubectl create deployment web --image=nginx -n global-demo
  kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: global-demo
  annotations:
    io.cilium/global-service: "true"
    io.cilium/service-affinity: "local"
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
EOF
done
\`\`\``,
        hints: [
          'Service must have SAME name and namespace in both clusters',
          'The global-service: true annotation is mandatory',
          'service-affinity: local makes it prefer local cluster backends'
        ],
        solution: `\`\`\`bash
# In each cluster:
kubectl create namespace global-demo
kubectl create deployment web --image=nginx -n global-demo
kubectl expose deployment web --port=80 -n global-demo
kubectl annotate svc web -n global-demo io.cilium/global-service=true
kubectl annotate svc web -n global-demo io.cilium/service-affinity=local
\`\`\``,
        verify: `\`\`\`bash
# Verify global service
kubectl get svc web -n global-demo -o jsonpath='{.metadata.annotations}'
# Expected output: annotations with global-service: true

# Verify endpoints include remote
cilium service list | grep global-demo
# Expected output: service with local AND remote backends
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ClusterMesh not connecting between clusters',
      difficulty: 'hard',
      symptom: 'cilium clustermesh status shows remote cluster as "not connected". Global services do not work.',
      diagnosis: `\`\`\`bash
# Check detailed status
cilium clustermesh status

# Check clustermesh-apiserver
kubectl get pods -n kube-system -l app.kubernetes.io/name=clustermesh-apiserver
kubectl logs -n kube-system -l app.kubernetes.io/name=clustermesh-apiserver --tail=30

# Check connectivity
kubectl exec -n kube-system <cilium-pod> -- curl -k https://<remote-apiserver-ip>:2379/health

# Check connection secrets
kubectl get secrets -n kube-system | grep clustermesh
\`\`\``,
      solution: `**Common causes:**

1. **Firewall blocking port 2379:** clustermesh-apiserver uses etcd on port 2379. Open between clusters.

2. **Service not accessible:** If using LoadBalancer, verify external IP is reachable from other cluster:
\`\`\`bash
kubectl get svc clustermesh-apiserver -n kube-system
\`\`\`

3. **Expired certificates:** Reconnect clusters:
\`\`\`bash
cilium clustermesh disconnect --destination-context <remote>
cilium clustermesh connect --destination-context <remote>
\`\`\`

4. **Duplicate cluster names:** Each cluster MUST have a unique name. Check with cilium config view | grep cluster-name.`
    },
    {
      title: 'Global Service not showing remote endpoints',
      difficulty: 'medium',
      symptom: 'Service annotated with global-service: true but cilium service list shows only local endpoints.',
      diagnosis: `\`\`\`bash
# Check annotations
kubectl get svc <name> -n <ns> -o jsonpath='{.metadata.annotations}'

# Check ClusterMesh connected
cilium clustermesh status

# Check service exists in remote cluster
# (switch context)
kubectl config use-context <remote-cluster>
kubectl get svc <name> -n <ns>
kubectl get endpoints <name> -n <ns>

# Check remote identities
cilium identity list | grep remote
\`\`\``,
      solution: `**Solutions:**

1. **Service with same name/namespace:** The service MUST have exactly the same name and namespace in both clusters.

2. **Correct annotation:** Verify it's io.cilium/global-service (not io.cilium.global-service):
\`\`\`bash
kubectl annotate svc <name> -n <ns> io.cilium/global-service=true --overwrite
\`\`\`

3. **Endpoints exist in remote:** Verify remote deployment has running pods:
\`\`\`bash
kubectl get pods -n <ns> -l app=<label> --context <remote>
\`\`\`

4. **Wait for sync:** It may take a few seconds for remote endpoints to appear.`
    },
    {
      title: 'Pod CIDR overlap between clusters',
      difficulty: 'easy',
      symptom: 'After connecting ClusterMesh, pods from one cluster cannot access pods in the other. Routing conflicts.',
      diagnosis: `\`\`\`bash
# Check CIDRs in each cluster
kubectl get nodes -o jsonpath='{.items[*].spec.podCIDR}'

# Check Cilium IPAM
cilium config view | grep cluster-pool

# Check overlap
# If Cluster A uses 10.0.0.0/16 and Cluster B also → OVERLAP!
\`\`\``,
      solution: `**This is a planning issue — cannot be easily fixed after cluster creation.**

**Prevention:**
Plan CIDRs before creating clusters:
\`\`\`
Cluster A: 10.1.0.0/16  (pods)  10.96.0.0/16  (services)
Cluster B: 10.2.0.0/16  (pods)  10.97.0.0/16  (services)
Cluster C: 10.3.0.0/16  (pods)  10.98.0.0/16  (services)
\`\`\`

**If already overlapping:**
The only solution is to recreate the cluster with a different CIDR. There is no way to change the pod CIDR of an existing cluster without significant disruption.

**Tool:**
Use Cilium with multi-pool IPAM to plan CIDRs from the start.`
    }
  ]
};
