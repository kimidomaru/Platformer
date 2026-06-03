window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcsa-threat-model/threat-modeling'] = {
  theory: `# Threat Modeling for Kubernetes

## Exam Relevance
> KCSA tests the ability to identify threats to Kubernetes environments and apply structured frameworks for analyzing them. Expect questions about STRIDE, attack surfaces, and mapping threats to controls.

## What is Threat Modeling?

**Threat modeling** is a structured process to:
1. Identify what assets need protection
2. Identify potential threats to those assets
3. Assess the risk of each threat
4. Define mitigations

> "Think like an attacker before an attacker thinks like you."

## The STRIDE Framework

STRIDE is a widely used threat classification model:

| Letter | Threat | Kubernetes Example |
|--------|--------|-------------------|
| **S**poofing | Claiming to be someone else | Pod impersonating a service account |
| **T**ampering | Modifying data | Corrupting etcd data, altering pod specs |
| **R**epudiation | Denying actions | No audit logs to prove who did what |
| **I**nformation Disclosure | Exposing data | Secrets exposed via environment variables |
| **D**enial of Service | Making service unavailable | Resource exhaustion, deleting critical pods |
| **E**levation of Privilege | Gaining more permissions | Container escaping to node, RBAC privilege escalation |

## Kubernetes Attack Surface

The attack surface is everything that can be targeted by an attacker:

### External Attack Surface
\`\`\`
Internet → Load Balancer/Ingress → Services → Pods
        → API Server (if exposed)
        → etcd (if exposed)
        → Kubelet API (port 10250, if exposed)
        → Node SSH
\`\`\`

### Internal Attack Surface (within the cluster)
\`\`\`
Compromised Pod → API Server (via SA token)
               → Other pods (default allow network)
               → Node metadata service
               → Cloud provider APIs
               → etcd (if accessible)
               → Kubelet API (if accessible)
\`\`\`

## Kubernetes Threat Landscape

### Threat 1: Compromised Container (most common entry point)
**How**: Exploit vulnerability in application code, supply chain attack (malicious image), misconfigured container

**Blast radius without controls**:
- Access all pod files and env vars
- Network access to all other pods
- Steal cloud credentials via metadata service
- Escalate to node if running privileged

**Mitigations**: Non-root, read-only filesystem, NetworkPolicy, no privileged mode, resource limits

---

### Threat 2: API Server Compromise
**How**: Stolen admin credentials, exploited API server vulnerability, overly permissive RBAC

**Blast radius**: Complete cluster takeover — create/delete any resource, exec into any pod

**Mitigations**: Least-privilege RBAC, audit logging, no anonymous auth, IP allowlist, MFA for admin access

---

### Threat 3: etcd Compromise
**How**: Exposed etcd (no auth), stolen client certs, physical access to nodes

**Blast radius**: Read all cluster state including Secrets, modify any resource (bypasses RBAC!)

**Mitigations**: Certificate-based auth only, no public access, encrypt data at rest, firewall to API server only

---

### Threat 4: Supply Chain Attack
**How**: Malicious image from registry, compromised build pipeline, poisoned dependencies

**Blast radius**: Malicious code runs with container permissions

**Mitigations**: Image signing (Cosign), image scanning (Trivy), admission controller (verify signatures), private registry

---

### Threat 5: Lateral Movement
**How**: Compromised pod accesses other services via unrestricted pod network

**Blast radius**: Attacker moves from low-value to high-value service (database, secrets vault)

**Mitigations**: NetworkPolicy (default deny), service mesh mTLS, namespace isolation

---

### Threat 6: Privilege Escalation
**How**: Misconfigured RBAC, privileged container escape, writable hostPath volume

**Blast radius**: Attacker escalates from pod-level to node or cluster-admin

**Mitigations**: PodSecurityStandards (restricted), RBAC least privilege, no hostPath, no privileged mode

## DREAD Risk Scoring

DREAD helps prioritize threats by scoring each dimension 1-10:

| Letter | Factor | Question |
|--------|--------|---------|
| **D**amage | How bad is the breach? | 1=minor, 10=complete takeover |
| **R**eproducibility | How easy to reproduce? | 1=requires special conditions, 10=always works |
| **E**xploitability | How easy to exploit? | 1=needs expert + special tools, 10=script kiddie |
| **A**ffected Users | How many affected? | 1=one user, 10=all users |
| **D**iscoverability | How easy to find? | 1=hidden, 10=published CVE |

### Example: etcd without authentication
- Damage: 10 (complete cluster control)
- Reproducibility: 10 (always works)
- Exploitability: 10 (just run etcdctl)
- Affected Users: 10 (all cluster users)
- Discoverability: 9 (common misconfiguration, scanners find it)
- **Total DREAD score: 49/50 — CRITICAL**

## Threat Modeling Process for Kubernetes

\`\`\`
1. DEFINE SCOPE
   What are we protecting? (cluster, namespace, specific workloads)
   What's the trust boundary?

2. CREATE DATA FLOW DIAGRAM
   Map: User → Ingress → Service → Pod → Database
   Identify: where does data flow? what are the trust boundaries?

3. IDENTIFY THREATS (STRIDE each component)
   For each component: what can go wrong?
   Use attack trees, MITRE ATT&CK for Containers

4. PRIORITIZE (DREAD or CVSS)
   Score each threat
   Focus on highest impact + likelihood

5. MITIGATE
   Map to controls (technical, process, detective)
   Assign ownership

6. VALIDATE
   Test controls work
   Red team / penetration test
\`\`\`

## MITRE ATT&CK for Containers

The MITRE ATT&CK framework has a Containers matrix:
- **Initial Access**: Exposed API, supply chain compromise, public-facing application exploit
- **Execution**: Container exec, running malicious image
- **Persistence**: Backdoor container, cron job abuse
- **Privilege Escalation**: Privileged container, hostPath volume, RBAC abuse
- **Defense Evasion**: Clear container logs, masquerade as legitimate workload
- **Credential Access**: Metadata service theft, accessing Secrets
- **Discovery**: API server enumeration, network scanning
- **Lateral Movement**: Container-to-container via network, API server abuse
- **Impact**: Data deletion, resource exhaustion, cryptomining

## Common Kubernetes Security Assumptions (That Are Wrong)

| Assumption | Reality |
|------------|---------|
| "Namespaces provide security isolation" | Namespaces are only logical separation — no network or RBAC isolation by default |
| "Internal services are safe" | Compromised pod has full cluster network access by default |
| "Docker image from Docker Hub is safe" | Images can contain malicious code — always scan |
| "RBAC is configured, so we're safe" | RBAC only controls API access, not network traffic |
| "Kubernetes handles all security" | You share responsibility — RBAC, NetworkPolicy, images are YOUR responsibility |
`,
  quiz: [
    {
      question: 'What does the "E" in STRIDE stand for, and what is an example in Kubernetes?',
      options: [
        'Elevation of Privilege — a container escaping to gain node-level access',
        'Encryption bypass — disabling TLS on the API server',
        'Exposure of Secrets — reading unencrypted etcd data',
        'Enumeration — discovering pod IPs and service names'
      ],
      correct: 0,
      explanation: 'Elevation of Privilege in Kubernetes means a workload gaining more permissions than intended — e.g., a privileged container using the node filesystem, or an RBAC misconfiguration allowing cluster-admin escalation.',
      reference: 'Review "The STRIDE Framework" table.'
    },
    {
      question: 'Which component, if compromised, gives an attacker the ability to bypass RBAC entirely?',
      options: [
        'etcd',
        'The Kubernetes API server',
        'CoreDNS',
        'The CNI plugin'
      ],
      correct: 0,
      explanation: 'etcd is the backend database for all Kubernetes state. Direct access to etcd bypasses the API server and all RBAC controls — an attacker can read Secrets, modify any resource, and create backdoors.',
      reference: 'Review "Threat 2: etcd Compromise" section.'
    },
    {
      question: 'What is "lateral movement" in a Kubernetes context?',
      options: [
        'A compromised pod using the unrestricted pod network to access other services or pods',
        'Scaling a deployment horizontally to new nodes',
        'Moving workloads between namespaces',
        'Migrating a cluster from one cloud provider to another'
      ],
      correct: 0,
      explanation: 'Lateral movement is an attacker moving from an initial foothold (compromised pod) to other systems (databases, secrets vaults, other services) via the unrestricted default pod network. NetworkPolicy is the key mitigation.',
      reference: 'Review "Threat 5: Lateral Movement" section.'
    },
    {
      question: 'Which STRIDE threat category does "no audit logs to prove who deleted a namespace" fall under?',
      options: [
        'Repudiation',
        'Information Disclosure',
        'Tampering',
        'Spoofing'
      ],
      correct: 0,
      explanation: 'Repudiation means an actor can deny they performed an action because there\'s no evidence. API server audit logging prevents repudiation by recording every action with user, time, and resource.',
      reference: 'Review "The STRIDE Framework" table — Repudiation row.'
    },
    {
      question: 'What is a supply chain attack in the context of Kubernetes?',
      options: [
        'Introducing malicious code through a container image or dependency before it reaches the cluster',
        'Disrupting the Kubernetes cluster during a rolling deployment',
        'Stealing credentials from the cluster\'s internal secret store',
        'Overloading the cluster API server with requests'
      ],
      correct: 0,
      explanation: 'A supply chain attack targets the build pipeline: using a malicious base image, compromised dependency, or tampered registry image. The attack runs inside the cluster as part of a "legitimate" workload.',
      reference: 'Review "Threat 4: Supply Chain Attack" section.'
    },
    {
      question: 'What is DREAD used for in threat modeling?',
      options: [
        'Scoring and prioritizing threats based on damage, reproducibility, exploitability, affected users, and discoverability',
        'Documenting threat actors and their motivations',
        'Categorizing threats into the six STRIDE categories',
        'Tracking which security controls address which threat'
      ],
      correct: 0,
      explanation: 'DREAD is a risk scoring framework: Damage + Reproducibility + Exploitability + Affected Users + Discoverability. Each 1-10; higher = more urgent to fix. Used to prioritize which threats to address first.',
      reference: 'Review "DREAD Risk Scoring" section.'
    },
    {
      question: 'Which common Kubernetes security assumption is FALSE?',
      options: [
        '"Namespaces provide security isolation" — namespaces are logical separation only, not security boundaries',
        '"RBAC controls API access" — RBAC does control Kubernetes API access',
        '"etcd stores cluster state" — etcd is the backing store for all K8s data',
        '"NetworkPolicy restricts pod traffic" — when a supported CNI is installed'
      ],
      correct: 0,
      explanation: 'Namespaces provide logical separation (naming, resource quotas) but NOT security isolation by default. Pods in different namespaces can communicate freely unless NetworkPolicy is applied.',
      reference: 'Review "Common Kubernetes Security Assumptions" table.'
    },
    {
      question: 'In MITRE ATT&CK for Containers, what phase does "accessing the cloud metadata service to steal credentials" fall under?',
      options: [
        'Credential Access',
        'Initial Access',
        'Privilege Escalation',
        'Lateral Movement'
      ],
      correct: 0,
      explanation: 'Stealing credentials (IAM keys, tokens) via the metadata service is classified as Credential Access in MITRE ATT&CK for Containers. Initial Access is gaining initial entry; Privilege Escalation is increasing permissions.',
      reference: 'Review "MITRE ATT&CK for Containers" section — Credential Access.'
    }
  ],
  flashcards: [
    {
      front: 'What is the STRIDE threat model and what does each letter represent?',
      back: 'S: Spoofing (fake identity), T: Tampering (modify data), R: Repudiation (deny actions), I: Information Disclosure (expose data), D: Denial of Service (make unavailable), E: Elevation of Privilege (gain more access). Framework for categorizing threats.'
    },
    {
      front: 'What is the Kubernetes attack surface?',
      back: 'External: Load balancer/Ingress, API server (if public), etcd (if exposed), Kubelet port 10250, node SSH. Internal: Pod network (default allow-all), API server via SA token, cloud metadata service 169.254.169.254.'
    },
    {
      front: 'What are the 5 most critical Kubernetes threat scenarios?',
      back: '1. Compromised container → lateral movement. 2. API server compromise → cluster takeover. 3. etcd compromise → bypasses RBAC. 4. Supply chain attack → malicious image. 5. Privilege escalation → container-to-node escape.'
    },
    {
      front: 'What is DREAD and how is it used?',
      back: 'DREAD = Damage + Reproducibility + Exploitability + Affected Users + Discoverability. Each rated 1-10. Sum = priority score. Higher score = more urgent. Used to prioritize threat mitigations.'
    },
    {
      front: 'Why does etcd compromise bypass RBAC?',
      back: 'etcd is the raw storage layer. RBAC is enforced by the API server. If you access etcd directly, there\'s no RBAC check — you can read/write all data including Secrets. Always protect etcd with cert-based auth and no public access.'
    },
    {
      front: 'What is lateral movement in Kubernetes and how to prevent it?',
      back: 'Lateral movement: compromised pod uses default-allow pod network to reach other services (databases, Vault, etc.). Prevention: NetworkPolicy with default deny egress/ingress, namespace isolation, service mesh mTLS.'
    },
    {
      front: 'What is MITRE ATT&CK for Containers?',
      back: 'A framework mapping attacker techniques to phases: Initial Access → Execution → Persistence → Privilege Escalation → Defense Evasion → Credential Access → Discovery → Lateral Movement → Impact. Used to model realistic Kubernetes attacks.'
    }
  ],
  lab: {
    scenario: 'Perform a basic threat modeling exercise on a Kubernetes cluster by identifying attack surfaces, testing default-allow network behavior, and mapping findings to STRIDE categories.',
    objective: 'Apply threat modeling thinking to a real Kubernetes cluster to understand default security gaps.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Map the attack surface — identify exposed components',
        instruction: `Enumerate the cluster's attack surface: check which ports are accessible, what services are exposed, and whether the API server is accessible from pods.`,
        hints: [
          'kubectl get svc --all-namespaces to see exposed services',
          'Try accessing the API server from a pod using the SA token',
          'kubectl get endpoints to see what\'s routable'
        ],
        solution: `\`\`\`bash
# Map external attack surface
kubectl get svc --all-namespaces | grep -v ClusterIP

# Map exposed NodePorts
kubectl get svc --all-namespaces -o jsonpath='{range .items[?(@.spec.type=="NodePort")]}{.metadata.namespace}/{.metadata.name}{": "}{.spec.ports[0].nodePort}{"\n"}{end}'

# Test API server access from inside a pod (Information Disclosure threat)
kubectl run attack-sim --image=curlimages/curl --rm -it --restart=Never -- \\
  curl -sk https://kubernetes.default.svc/api/v1/namespaces \\
  --header "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)"
# If this returns data, the default SA has too much access (STRIDE: Elevation of Privilege)
\`\`\``,
        verify: `\`\`\`bash
kubectl get svc --all-namespaces | grep -E "NodePort|LoadBalancer"
# Note: LoadBalancer and NodePort services are part of the external attack surface

kubectl get svc -n kube-system | grep "kubernetes"
# Expected: kubernetes service should be ClusterIP (not exposed externally)
\`\`\``
      },
      {
        title: 'Test lateral movement potential (default pod network)',
        instruction: `Create two pods in different namespaces and verify they can communicate by default. This demonstrates the lateral movement threat — a compromised pod can reach all other pods. Then verify the fix with NetworkPolicy.`,
        hints: [
          'kubectl create namespace attack-source and kubectl create namespace target-service',
          'Deploy nginx in target namespace and busybox in source namespace',
          'Without NetworkPolicy, the source pod can reach the target'
        ],
        solution: `\`\`\`bash
kubectl create namespace attack-source 2>/dev/null || true
kubectl create namespace target-service 2>/dev/null || true

# Deploy target service
kubectl run sensitive-db \\
  --image=nginx \\
  --namespace=target-service \\
  --labels=app=sensitive-db
kubectl expose pod sensitive-db \\
  --port=80 \\
  --namespace=target-service \\
  --name=sensitive-db-svc

# Wait for pod to start
kubectl wait pod/sensitive-db -n target-service --for=condition=Ready --timeout=60s

# Simulate lateral movement from compromised pod
TARGET_IP=$(kubectl get svc sensitive-db-svc -n target-service -o jsonpath='{.spec.clusterIP}')
kubectl run attacker --image=curlimages/curl --rm -it \\
  --namespace=attack-source --restart=Never \\
  -- curl -s --connect-timeout 5 http://$TARGET_IP/ | head -5
\`\`\``,
        verify: `\`\`\`bash
# If the curl returned nginx welcome page, lateral movement is POSSIBLE
# This is the threat we identified using STRIDE: Tampering + Lateral Movement

# Now apply NetworkPolicy to the target to block unauthorized access
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-external
  namespace: target-service
spec:
  podSelector:
    matchLabels:
      app: sensitive-db
  policyTypes:
    - Ingress
  ingress: []   # empty = deny all ingress
EOF

# Cleanup
kubectl delete namespace attack-source target-service
\`\`\``
      },
      {
        title: 'STRIDE threat classification exercise',
        instruction: `Review the cluster for findings from steps 1 and 2. Classify each finding using STRIDE. Document the mitigations for each finding.`,
        hints: [
          'Finding 1: Default SA token allows API access → which STRIDE category?',
          'Finding 2: Pod can reach pods in other namespaces → which STRIDE category?',
          'Finding 3: No audit log of who ran the attack-sim pod → which STRIDE category?'
        ],
        solution: `\`\`\`bash
# STRIDE Classification Exercise:
# Run this to generate findings:

echo "=== THREAT MODELING REPORT ==="
echo ""
echo "Finding 1: Default SA token API access"
echo "STRIDE: Elevation of Privilege + Information Disclosure"
echo "Check:"
kubectl auth can-i list pods --as=system:serviceaccount:default:default
echo ""
echo "Finding 2: Unrestricted pod-to-pod network"
echo "STRIDE: Lateral Movement risk (Tampering + Information Disclosure)"
kubectl get networkpolicies --all-namespaces | wc -l
echo "Total NetworkPolicies (0-1 = insufficient)"
echo ""
echo "Finding 3: Audit logging"
echo "STRIDE: Repudiation"
kubectl get pods -n kube-system | grep "audit" || echo "No dedicated audit pod found"
\`\`\``,
        verify: `\`\`\`bash
# Verify we've identified the STRIDE categories correctly
echo "Threats identified:"
echo "S - Spoofing: Pod impersonating another SA via stolen token"
echo "T - Tampering: Attacker modifying pod specs via permissive RBAC"
echo "R - Repudiation: No audit trail for manual kubectl changes"
echo "I - Info Disclosure: Secrets in env vars, SA token accessible"
echo "D - Denial of Service: No resource limits = resource exhaustion"
echo "E - Elevation: Privileged containers or permissive RBAC"

# Check which threats have mitigations
kubectl get networkpolicies --all-namespaces
kubectl get podsecuritypolicies 2>/dev/null || kubectl get psa 2>/dev/null || echo "Check namespace labels for Pod Security"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Identifying overly permissive RBAC (Privilege Escalation threat)',
      difficulty: 'medium',
      symptom: 'Threat model review found that application ServiceAccounts have cluster-wide permissions. Need to identify and remediate before a compromise can escalate.',
      diagnosis: `\`\`\`bash
# Find all ClusterRoleBindings (may grant excessive permissions)
kubectl get clusterrolebindings -o wide

# Check what permissions a specific SA has
kubectl auth can-i --list \\
  --as=system:serviceaccount:<namespace>:<sa-name>

# Find SAs bound to powerful ClusterRoles
kubectl get clusterrolebindings -o json | \\
  python3 -c "
import json, sys
crbs = json.load(sys.stdin)
for crb in crbs['items']:
  role = crb.get('roleRef', {}).get('name', '')
  for sub in crb.get('subjects', []):
    if sub.get('kind') == 'ServiceAccount':
      print(f'{sub[\"namespace\"]}/{sub[\"name\"]} → ClusterRole: {role}')
"
\`\`\``,
      solution: `1. Identify minimum required permissions by checking app logs for "forbidden":
\`\`\`bash
kubectl logs deployment/<app> | grep "forbidden"
\`\`\`

2. Replace cluster-wide binding with namespace-scoped Role:
\`\`\`bash
# Delete excessive ClusterRoleBinding
kubectl delete clusterrolebinding <name>

# Create minimal Role
kubectl create role app-minimal \\
  --verb=get,list \\
  --resource=configmaps \\
  -n <namespace>

kubectl create rolebinding app-minimal-binding \\
  --role=app-minimal \\
  --serviceaccount=<namespace>:<sa-name> \\
  -n <namespace>
\`\`\`

3. Validate with dry-run:
\`\`\`bash
kubectl auth can-i list configmaps \\
  --as=system:serviceaccount:<ns>:<sa> -n <ns>  # yes
kubectl auth can-i delete pods \\
  --as=system:serviceaccount:<ns>:<sa> -n <ns>  # no
\`\`\``
    },
    {
      title: 'Repudiation threat: No audit trail for security incident',
      difficulty: 'easy',
      symptom: 'After a security incident, you can\'t determine who deleted a critical deployment or modified a ConfigMap. Audit logging was not enabled.',
      diagnosis: `\`\`\`bash
# Check for audit logs in kube-system
ls /var/log/kubernetes/ 2>/dev/null || echo "No audit logs found at default path"

# Check API server manifest for audit configuration
grep -i "audit" /etc/kubernetes/manifests/kube-apiserver.yaml 2>/dev/null

# Check what you CAN find post-incident
kubectl get events --all-namespaces --sort-by='.lastTimestamp' | grep -i "delete"
# Note: Events only last ~1 hour by default — not a substitute for audit logs
\`\`\``,
      solution: `Enable audit logging by adding flags to the API server:
\`\`\`yaml
# /etc/kubernetes/audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata
    resources:
    - group: ""
      resources: ["secrets", "configmaps"]
  - level: RequestResponse
    users: ["system:admin"]
  - level: None
    resources:
    - group: ""
      resources: ["events"]
\`\`\`

Then add to kube-apiserver manifest:
\`\`\`yaml
--audit-log-path=/var/log/kubernetes/audit.log
--audit-policy-file=/etc/kubernetes/audit-policy.yaml
--audit-log-maxage=30
--audit-log-maxbackup=10
--audit-log-maxsize=100
\`\`\``
    }
  ]
};
