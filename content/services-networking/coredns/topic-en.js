window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['services-networking/coredns'] = {
  theory: `# CoreDNS

## Exam Relevance
> CoreDNS is the default DNS server in Kubernetes since v1.13. In CKA, you need to understand how DNS resolution works within the cluster, how to debug DNS failures, and where CoreDNS is configured. DNS debugging appears in troubleshooting scenarios.

## What is CoreDNS?

CoreDNS is a flexible, extensible DNS server deployed as a Deployment in the \`kube-system\` namespace. It provides:
- **Service discovery**: resolve service names to ClusterIP addresses
- **Pod DNS**: resolve pod IPs to names (when enabled)
- **External DNS forwarding**: forward non-cluster queries to upstream resolvers

\`\`\`bash
# Check CoreDNS deployment
kubectl get deployment coredns -n kube-system

# Check CoreDNS pods
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Check CoreDNS service (kube-dns)
kubectl get service kube-dns -n kube-system
# ClusterIP is the DNS server IP that pods use
\`\`\`

## DNS Resolution Format

\`\`\`
<service>.<namespace>.svc.<cluster-domain>

Default cluster domain: cluster.local
\`\`\`

Examples:
\`\`\`bash
# Service "db" in namespace "production"
db.production.svc.cluster.local

# Short names (resolved via search domains in /etc/resolv.conf):
db                    # same namespace only
db.production         # works if in resolv.conf search list
db.production.svc     # works if in resolv.conf search list
\`\`\`

## Pod's /etc/resolv.conf

\`\`\`bash
# Check a pod's DNS configuration
kubectl exec <pod> -- cat /etc/resolv.conf

# Typical output:
# nameserver 10.96.0.10                          ← CoreDNS ClusterIP
# search default.svc.cluster.local svc.cluster.local cluster.local
# options ndots:5
\`\`\`

The **search domains** allow short name resolution:
- \`db\` → tries \`db.default.svc.cluster.local\` first
- \`db.production\` → tries \`db.production.svc.cluster.local\`

**ndots:5** means: if the name has fewer than 5 dots, append search domains before trying as an absolute name.

## CoreDNS ConfigMap

CoreDNS is configured via a ConfigMap named \`coredns\` in \`kube-system\`:

\`\`\`bash
kubectl get configmap coredns -n kube-system -o yaml
\`\`\`

\`\`\`
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health {
           lameduck 5s
        }
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
           pods insecure
           fallthrough in-addr.arpa ip6.arpa
           ttl 30
        }
        prometheus :9153
        forward . /etc/resolv.conf {          # Forward external queries to node's DNS
           max_concurrent 1000
        }
        cache 30
        loop
        reload
        loadbalance
    }
\`\`\`

Key plugins:
| Plugin | Purpose |
|--------|---------|
| \`kubernetes\` | Serves DNS for Kubernetes services and pods |
| \`forward\` | Forwards non-cluster queries to upstream DNS |
| \`cache\` | Caches responses for 30 seconds |
| \`health\` | Health check endpoint at :8080/health |
| \`ready\` | Readiness endpoint at :8181/ready |
| \`errors\` | Logs errors |

## DNS Record Types

| Resource | Record Type | Format |
|----------|------------|--------|
| Service (ClusterIP) | A | \`service.ns.svc.cluster.local → ClusterIP\` |
| Service (Headless) | A | Multiple records, one per pod IP |
| Service | SRV | \`_port._protocol.service.ns.svc.cluster.local\` |
| Pod (if enabled) | A | \`pod-ip.ns.pod.cluster.local\` |

## Headless Services and DNS

A headless Service (\`clusterIP: None\`) returns the pod IPs directly instead of a ClusterIP:

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: headless-db
spec:
  clusterIP: None          # Headless service
  selector:
    app: db
  ports:
  - port: 5432
\`\`\`

\`\`\`bash
# For headless services, DNS returns all pod IPs
nslookup headless-db.default.svc.cluster.local
# Returns: multiple A records (one per pod)
# This is used by StatefulSets for stable network identities
\`\`\`

## StatefulSet DNS

StatefulSets create stable DNS names for each pod:

\`\`\`
<pod-name>.<headless-service>.<namespace>.svc.<cluster-domain>

Example: web-0.web-headless.default.svc.cluster.local
         web-1.web-headless.default.svc.cluster.local
\`\`\`

## Custom DNS Configuration per Pod

\`\`\`yaml
spec:
  dnsPolicy: "None"           # Use custom config only
  dnsConfig:
    nameservers:
    - 8.8.8.8
    searches:
    - mycompany.com
    options:
    - name: ndots
      value: "2"
\`\`\`

**dnsPolicy options:**
| Policy | Behavior |
|--------|---------|
| \`ClusterFirst\` (default) | Use CoreDNS; forward unknowns to node DNS |
| \`ClusterFirstWithHostNet\` | Same as ClusterFirst for hostNetwork pods |
| \`Default\` | Inherit node's DNS settings (NOT CoreDNS) |
| \`None\` | Use only dnsConfig — must provide nameservers |

## Debugging DNS

\`\`\`bash
# Test DNS from inside a pod
kubectl run dns-test --image=busybox:1.36 --rm -it -- sh

# Inside the pod:
nslookup kubernetes.default            # Should resolve
nslookup kubernetes.default.svc.cluster.local  # Full FQDN
nslookup google.com                    # External DNS

# Check CoreDNS logs for errors
kubectl logs -n kube-system -l k8s-app=kube-dns

# Check CoreDNS is running
kubectl get pods -n kube-system -l k8s-app=kube-dns

# DNS lookup with dig (from a pod with dig installed)
kubectl run dig-test --image=tutum/dnsutils --rm -it -- dig kubernetes.default.svc.cluster.local
\`\`\`

## Common Errors

1. **NXDOMAIN for service name** — using short name from wrong namespace; use FQDN
2. **DNS timeout** — CoreDNS pods are down; check \`kubectl get pods -n kube-system | grep dns\`
3. **DNS broken after NetworkPolicy** — egress deny-all policy blocks UDP:53; add DNS egress rule
4. **ndots causing extra lookups** — many unnecessary search domain lookups slow DNS; use FQDN for external names
5. **Wrong CoreDNS ConfigMap** — misconfigured Corefile breaks DNS cluster-wide

## Killer.sh Style Challenge

**Task**:
1. Create a service named \`api-svc\` in namespace \`backend\`
2. From a pod in namespace \`frontend\`, resolve the service using both short name and FQDN
3. Explain why the short name fails across namespaces
4. Check CoreDNS logs to confirm queries are being processed
`,
  quiz: [
    {
      question: 'What is the full DNS name for a service named "db" in namespace "production"?',
      options: [
        'db.production.cluster.local',
        'db.production.svc.cluster.local',
        'production.db.svc.cluster.local',
        'svc.production.db.cluster.local'
      ],
      correct: 1,
      explanation: 'The Kubernetes DNS format is: <service>.<namespace>.svc.<cluster-domain>. The "svc" part is always between the namespace and the cluster domain. Default cluster domain is "cluster.local".',
      reference: 'DNS Resolution Format section in theory.'
    },
    {
      question: 'Why does nslookup myservice fail when called from a pod in a DIFFERENT namespace?',
      options: [
        'Services cannot be accessed from different namespaces',
        'The short name "myservice" uses search domains for the current namespace only — use myservice.target-namespace.svc.cluster.local',
        'DNS is disabled across namespaces by default',
        'NetworkPolicies block cross-namespace DNS resolution'
      ],
      correct: 1,
      explanation: 'Short name resolution uses the pod\'s search domains, which only include the current namespace. From namespace "frontend", searching "myservice" tries "myservice.frontend.svc.cluster.local" (not found). The FQDN "myservice.backend.svc.cluster.local" must be used.',
      reference: 'DNS Resolution Format and Pod\'s /etc/resolv.conf sections in theory.'
    },
    {
      question: 'Where is CoreDNS configured in a Kubernetes cluster?',
      options: [
        '/etc/coredns/Corefile on each node',
        'ConfigMap named "coredns" in the kube-system namespace',
        'Static pod manifest at /etc/kubernetes/manifests/coredns.yaml',
        'A Secret named "coredns-config" in the kube-system namespace'
      ],
      correct: 1,
      explanation: 'CoreDNS reads its configuration from a ConfigMap named "coredns" in the kube-system namespace. The data key is "Corefile". Changes to this ConfigMap are automatically picked up by CoreDNS (the "reload" plugin handles this).',
      reference: 'CoreDNS ConfigMap section in theory.'
    },
    {
      question: 'What does a headless Service (clusterIP: None) return for DNS queries?',
      options: [
        'The cluster DNS IP (10.96.0.10)',
        'No records — headless services cannot be resolved by DNS',
        'Multiple A records — one for each pod IP behind the service',
        'A single CNAME record pointing to the first pod'
      ],
      correct: 2,
      explanation: 'Headless services (clusterIP: None) return multiple A records — one for each pod IP. This bypasses kube-proxy and load balancing, giving direct access to individual pods. Essential for StatefulSets.',
      reference: 'Headless Services and DNS section in theory.'
    },
    {
      question: 'What is the DNS name format for a specific StatefulSet pod named "web-0"?',
      options: [
        'web-0.stateful.svc.cluster.local',
        'web-0.<headless-service>.<namespace>.svc.cluster.local',
        'web-0.default.pod.cluster.local',
        'web.0.default.svc.cluster.local'
      ],
      correct: 1,
      explanation: 'StatefulSet pods get stable DNS names in the format: <pod-name>.<headless-service>.<namespace>.svc.<cluster-domain>. Example: web-0.web-headless.default.svc.cluster.local.',
      reference: 'StatefulSet DNS section in theory.'
    },
    {
      question: 'What dnsPolicy should you use for a pod that should use the node\'s DNS settings instead of CoreDNS?',
      options: [
        'ClusterFirst',
        'Default',
        'None',
        'ClusterFirstWithHostNet'
      ],
      correct: 1,
      explanation: '"Default" policy inherits the node\'s DNS configuration, bypassing CoreDNS. Note: "Default" is misleadingly named — the actual default for pods is "ClusterFirst" (use CoreDNS).',
      reference: 'Custom DNS Configuration per Pod — dnsPolicy options table in theory.'
    },
    {
      question: 'A NetworkPolicy with deny-all egress breaks DNS resolution in pods. What must you add?',
      options: [
        'Allow TCP:8080 egress to CoreDNS',
        'Allow UDP:53 (and TCP:53) egress to the CoreDNS service or namespace',
        'Allow all egress to the kube-system namespace',
        'Disable DNS and use direct IP addresses'
      ],
      correct: 1,
      explanation: 'DNS uses UDP (and sometimes TCP) on port 53. A deny-all egress policy blocks DNS queries. You must explicitly allow egress to port 53 (UDP/TCP) for pods to resolve names.',
      reference: 'Common Errors #3 — DNS broken after NetworkPolicy in theory.'
    },
    {
      question: 'Where in a pod can you find the CoreDNS IP address configured as the nameserver?',
      options: [
        '/etc/kubernetes/dns-config',
        '/etc/resolv.conf inside the container',
        'The CoreDNS ConfigMap data field',
        'kubectl get pod <name> -o yaml | grep dnsServer'
      ],
      correct: 1,
      explanation: 'Each pod has /etc/resolv.conf injected by the kubelet with the CoreDNS ClusterIP as the nameserver. Run: kubectl exec <pod> -- cat /etc/resolv.conf to see it.',
      reference: 'Pod\'s /etc/resolv.conf section in theory.'
    }
  ],
  flashcards: [
    {
      front: 'What is the full DNS format for a Kubernetes Service?',
      back: '<service-name>.<namespace>.svc.<cluster-domain>\n\nDefault cluster domain: cluster.local\n\nExample: db.production.svc.cluster.local\n\nShort names work within the same namespace:\n- db (same ns)\n- db.production (cross-ns short — works with search domains)\n\nAlways use FQDN for cross-namespace resolution.'
    },
    {
      front: 'Why do short service names fail from a different namespace?',
      back: '/etc/resolv.conf search domains only include the pod\'s own namespace:\nsearch default.svc.cluster.local svc.cluster.local cluster.local\n\nFrom namespace "frontend", nslookup "myservice" tries:\n- myservice.frontend.svc.cluster.local → NXDOMAIN\n\nFix: use the FQDN:\nmyservice.backend.svc.cluster.local'
    },
    {
      front: 'Where is CoreDNS deployed and configured?',
      back: 'Deployed as: Deployment in kube-system namespace\nService: kube-dns (ClusterIP is the DNS nameserver IP)\n\nConfiguration:\nConfigMap "coredns" in kube-system\n→ key: Corefile\n\nEdit: kubectl edit configmap coredns -n kube-system\nChanges are auto-reloaded by the "reload" CoreDNS plugin.'
    },
    {
      front: 'What is a headless Service and what does it return for DNS?',
      back: 'Headless Service: spec.clusterIP: None\n\nDNS returns: multiple A records, one per pod IP (no virtual IP)\n\nUsed by StatefulSets to provide stable DNS per pod:\nweb-0.web-headless.default.svc.cluster.local → pod-0 IP\nweb-1.web-headless.default.svc.cluster.local → pod-1 IP\n\nBypass kube-proxy for direct pod access.'
    },
    {
      front: 'What are the dnsPolicy options for a pod?',
      back: 'ClusterFirst (default): use CoreDNS, forward unknowns to node DNS\nClusterFirstWithHostNet: same but for pods using hostNetwork\nDefault: use node\'s /etc/resolv.conf (NOT CoreDNS) — misleadingly named\nNone: use only spec.dnsConfig (must specify nameservers)\n\nFor custom DNS: dnsPolicy: "None" + dnsConfig.nameservers'
    },
    {
      front: 'How does ndots:5 in /etc/resolv.conf affect DNS queries?',
      back: 'ndots:5 means: if the hostname has fewer than 5 dots, prepend each search domain before trying it as absolute.\n\nFor "google.com" (1 dot < 5):\n1. google.com.default.svc.cluster.local → NXDOMAIN\n2. google.com.svc.cluster.local → NXDOMAIN\n3. google.com.cluster.local → NXDOMAIN\n4. google.com → success\n\nUse FQDN with trailing dot (google.com.) to skip search domains.'
    },
    {
      front: 'How do you debug DNS issues in a Kubernetes cluster?',
      back: '1. kubectl get pods -n kube-system -l k8s-app=kube-dns\n   (CoreDNS pods must be Running)\n\n2. kubectl run dns-test --image=busybox:1.36 --rm -it -- sh\n   nslookup kubernetes.default\n   nslookup google.com\n\n3. kubectl logs -n kube-system -l k8s-app=kube-dns\n   (check for errors in CoreDNS)\n\n4. kubectl exec <pod> -- cat /etc/resolv.conf\n   (verify nameserver is CoreDNS IP)'
    },
    {
      front: 'What CoreDNS plugin forwards non-cluster DNS queries?',
      back: 'The "forward" plugin:\nforward . /etc/resolv.conf {\n  max_concurrent 1000\n}\n\nForwards non-cluster queries (like google.com) to the node\'s DNS resolvers (/etc/resolv.conf on the node).\n\nCan also forward to specific DNS: forward . 8.8.8.8 1.1.1.1'
    }
  ],
  lab: {
    scenario: 'You need to validate DNS resolution across namespaces, configure a headless service for a StatefulSet, and practice CoreDNS debugging.',
    objective: 'Understand Kubernetes DNS resolution patterns, cross-namespace DNS, headless services, and how to troubleshoot DNS failures.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Explore DNS Resolution and Search Domains',
        instruction: `Create services in two namespaces and practice DNS resolution:

1. Create namespace \`ns-a\` with a Service \`svc-a\` backed by nginx
2. Create namespace \`ns-b\` with a pod for testing
3. From the pod in ns-b, try to resolve \`svc-a\` (short name — fails cross-namespace)
4. Resolve using FQDN \`svc-a.ns-a.svc.cluster.local\` (works)
5. Check /etc/resolv.conf to understand why`,
        hints: [
          'kubectl create ns ns-a && kubectl create ns ns-b',
          'kubectl run nginx -n ns-a --image=nginx:1.25 --expose --port=80 --labels="app=nginx"',
          'kubectl run test-pod -n ns-b --image=busybox:1.36 -- sleep 3600',
          'kubectl exec -n ns-b test-pod -- nslookup svc-a (fails)',
          'kubectl exec -n ns-b test-pod -- nslookup svc-a.ns-a.svc.cluster.local (works)'
        ],
        solution: `\`\`\`bash
# Create namespaces
kubectl create ns ns-a
kubectl create ns ns-b

# Create service in ns-a
kubectl run nginx -n ns-a --image=nginx:1.25 --labels="app=nginx" --port=80
kubectl expose pod nginx -n ns-a --name=svc-a --port=80 --target-port=80

# Create test pod in ns-b
kubectl run test-pod -n ns-b --image=busybox:1.36 -- sleep 3600
kubectl get pod test-pod -n ns-b -w

# Test short name (fails cross-namespace)
kubectl exec -n ns-b test-pod -- nslookup svc-a
# Expected: NXDOMAIN or "server can't find svc-a"

# Test FQDN (works)
kubectl exec -n ns-b test-pod -- nslookup svc-a.ns-a.svc.cluster.local
# Expected: resolves to ClusterIP

# Check search domains
kubectl exec -n ns-b test-pod -- cat /etc/resolv.conf
# Shows search domains include ns-b.svc.cluster.local (not ns-a)

# Cleanup
kubectl delete ns ns-a ns-b
\`\`\``,
        verify: `\`\`\`bash
# FQDN should resolve successfully
kubectl exec -n ns-b test-pod -- nslookup svc-a.ns-a.svc.cluster.local 2>/dev/null | grep "Address"
# Expected: Address: <ClusterIP of svc-a>

# Short name should fail
kubectl exec -n ns-b test-pod -- nslookup svc-a 2>&1 | grep -i "can't find\|NXDOMAIN\|server fail"
# Expected: some form of "not found" error

# /etc/resolv.conf shows ns-b in search domains
kubectl exec -n ns-b test-pod -- cat /etc/resolv.conf | grep search
# Expected: search ns-b.svc.cluster.local svc.cluster.local cluster.local
\`\`\``
      },
      {
        title: 'Check and Interpret CoreDNS',
        instruction: `Inspect the CoreDNS deployment and its configuration:

1. Check CoreDNS pods are running
2. View the CoreDNS service (kube-dns) to find its ClusterIP
3. Read the CoreDNS ConfigMap (Corefile)
4. Check CoreDNS logs for recent activity
5. From any pod, verify /etc/resolv.conf uses the CoreDNS ClusterIP`,
        hints: [
          'kubectl get pods -n kube-system -l k8s-app=kube-dns',
          'kubectl get svc kube-dns -n kube-system',
          'kubectl get configmap coredns -n kube-system -o yaml',
          'kubectl logs -n kube-system -l k8s-app=kube-dns --tail=20'
        ],
        solution: `\`\`\`bash
# Check CoreDNS pods
kubectl get pods -n kube-system -l k8s-app=kube-dns
# Expected: 2 pods Running (or 1 in smaller clusters)

# Get CoreDNS service IP
kubectl get svc kube-dns -n kube-system
# Note the CLUSTER-IP — this should match pod /etc/resolv.conf nameserver

COREDNS_IP=$(kubectl get svc kube-dns -n kube-system -o jsonpath='{.spec.clusterIP}')
echo "CoreDNS IP: $COREDNS_IP"

# Read CoreDNS Corefile
kubectl get configmap coredns -n kube-system -o jsonpath='{.data.Corefile}'

# Check CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=20

# Create a test pod and verify it uses CoreDNS IP
kubectl run verify-dns --image=busybox:1.36 --rm -it -- sh -c \
  "cat /etc/resolv.conf && nslookup kubernetes.default"
# The nameserver line should match $COREDNS_IP
\`\`\``,
        verify: `\`\`\`bash
# CoreDNS pods should be running
kubectl get pods -n kube-system -l k8s-app=kube-dns
# Expected: STATUS = Running, READY = 1/1

# CoreDNS service should have a ClusterIP
kubectl get svc kube-dns -n kube-system
# Expected: CLUSTER-IP = some 10.96.x.x IP

# CoreDNS configmap should have Corefile data
kubectl get configmap coredns -n kube-system -o jsonpath='{.data.Corefile}' | grep kubernetes
# Expected: kubernetes cluster.local... line exists
\`\`\``
      },
      {
        title: 'Simulate and Fix a DNS Outage',
        instruction: `Simulate a DNS issue and practice the debugging workflow:

1. Scale CoreDNS to 0 replicas (simulating an outage)
2. From a test pod, try to resolve a service name — observe it fails
3. Restore CoreDNS to 2 replicas
4. Verify DNS resolution works again

Note: Scale back IMMEDIATELY after testing — DNS failure affects the whole cluster.`,
        hints: [
          'kubectl scale deployment coredns --replicas=0 -n kube-system (DO THIS BRIEFLY)',
          'kubectl run test --image=busybox:1.36 --rm -it -- nslookup kubernetes.default',
          'kubectl scale deployment coredns --replicas=2 -n kube-system (restore!)',
          'After restore, DNS may take 30 seconds to become fully available'
        ],
        solution: `\`\`\`bash
# Create a long-running test pod first
kubectl run dns-test --image=busybox:1.36 -- sleep 3600
kubectl get pod dns-test -w

# Verify DNS works normally
kubectl exec dns-test -- nslookup kubernetes.default
# Expected: resolves successfully

# Simulate DNS outage (DO BRIEFLY!)
kubectl scale deployment coredns --replicas=0 -n kube-system

# Observe DNS failure (run quickly before pod DNS cache expires)
kubectl exec dns-test -- nslookup kubernetes.default
# Expected: ;; connection timed out; no servers could be reached
# Or: nslookup: can't resolve 'kubernetes.default'

# Restore CoreDNS IMMEDIATELY
kubectl scale deployment coredns --replicas=2 -n kube-system

# Wait for CoreDNS to be ready
kubectl rollout status deployment/coredns -n kube-system

# Verify DNS works again
kubectl exec dns-test -- nslookup kubernetes.default
# Expected: resolves successfully again

# Cleanup
kubectl delete pod dns-test
\`\`\``,
        verify: `\`\`\`bash
# CoreDNS should be back to 2 replicas
kubectl get deployment coredns -n kube-system
# Expected: READY = 2/2

# DNS should resolve after restore
kubectl run final-test --image=busybox:1.36 --rm -it -- nslookup kubernetes.default.svc.cluster.local
# Expected: Server: <CoreDNS IP>, Address: <kubernetes service IP>

# CoreDNS pods should be healthy
kubectl get pods -n kube-system -l k8s-app=kube-dns
# Expected: all Running, READY = 1/1
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Service Name Resolves to Wrong IP / DNS Returns Stale Result',
      difficulty: 'medium',
      symptom: 'A service was recently updated or recreated with a new ClusterIP. DNS still resolves to the old IP address, causing connection failures.',
      diagnosis: `\`\`\`bash
# Check current ClusterIP of the service
kubectl get svc <service-name>
# Note the current CLUSTER-IP

# Check what DNS returns for this service
kubectl run dns-debug --image=busybox:1.36 --rm -it -- nslookup <service-name>.<namespace>.svc.cluster.local
# Compare returned IP with actual ClusterIP

# Check CoreDNS cache TTL (default 30 seconds)
kubectl get configmap coredns -n kube-system -o yaml | grep cache
# Shows: cache 30 (seconds)

# Check if multiple services have the same name
kubectl get svc -A | grep <service-name>
\`\`\``,
      solution: `**Cause A: DNS cache not expired yet**
\`\`\`bash
# Wait for the cache TTL (30 seconds by default)
sleep 35

# Test again
kubectl run dns-debug --image=busybox:1.36 --rm -it -- nslookup <service-name>
# Should now return the new IP

# Immediate fix: restart CoreDNS to clear cache
kubectl rollout restart deployment/coredns -n kube-system
kubectl rollout status deployment/coredns -n kube-system
\`\`\`

**Cause B: Old endpoints not cleaned up**
\`\`\`bash
# Check if old endpoints still exist
kubectl get endpoints <service-name>

# Check if pods matching the selector exist
kubectl get pods -l <label-selector>

# If stale: delete and recreate the service to force endpoint refresh
kubectl delete svc <service-name>
kubectl apply -f service.yaml
\`\`\``
    },
    {
      title: 'Pod Cannot Resolve Any DNS — Complete DNS Failure',
      difficulty: 'hard',
      symptom: 'A specific pod (or all pods in a namespace) cannot resolve ANY DNS name — neither internal services nor external domains. nslookup times out for everything.',
      diagnosis: `\`\`\`bash
# Check if CoreDNS is running
kubectl get pods -n kube-system -l k8s-app=kube-dns
# If 0/2 Running → CoreDNS is down

# Check if the pod's /etc/resolv.conf is correct
kubectl exec <affected-pod> -- cat /etc/resolv.conf
# nameserver should be CoreDNS ClusterIP

# Verify the CoreDNS ClusterIP is correct
kubectl get svc kube-dns -n kube-system

# Check if NetworkPolicy is blocking port 53
kubectl get networkpolicy -n <namespace>

# Test DNS directly to CoreDNS IP
kubectl exec <affected-pod> -- nslookup kubernetes.default 10.96.0.10
# Replace with actual CoreDNS IP
\`\`\``,
      solution: `**Cause A: CoreDNS pods are down**
\`\`\`bash
kubectl get pods -n kube-system | grep dns
# 0 Running pods

kubectl describe pod -n kube-system <coredns-pod>
# Check events for why it failed

# Restart CoreDNS
kubectl rollout restart deployment/coredns -n kube-system
kubectl rollout status deployment/coredns -n kube-system

# Verify
kubectl top pods -n kube-system | grep dns  # If metrics available
kubectl logs -n kube-system -l k8s-app=kube-dns
\`\`\`

**Cause B: NetworkPolicy blocks UDP:53 egress**
\`\`\`bash
kubectl get networkpolicy -n <namespace>
kubectl describe networkpolicy <policy-name> -n <namespace>
# Check if egress allows UDP:53

# Fix: add DNS egress to the policy
kubectl edit networkpolicy <policy-name> -n <namespace>
# Add:
# egress:
# - ports:
#   - protocol: UDP
#     port: 53
#   - protocol: TCP
#     port: 53
\`\`\`

**Cause C: Wrong nameserver in /etc/resolv.conf**
\`\`\`bash
# Pod has wrong nameserver (not CoreDNS IP)
kubectl exec <pod> -- cat /etc/resolv.conf
# nameserver 1.2.3.4 (wrong — should be CoreDNS IP)

# This can happen with custom dnsPolicy or kubelet misconfiguration
# Verify kubelet config on the node
ssh <node>
sudo cat /var/lib/kubelet/config.yaml | grep clusterDNS
# Must match kube-dns service ClusterIP
\`\`\``
    }
  ]
};
