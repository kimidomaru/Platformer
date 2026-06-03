window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcsa-security-overview/4c-security-model'] = {
  theory: `# The 4C Security Model

## Exam Relevance
> The 4Cs are a foundational KCSA concept. Expect questions identifying which security layer addresses which threat, and understanding that each layer builds on the security of the outer layers.

## Overview

The **4Cs of Cloud Native Security** is a layered defense-in-depth model:

\`\`\`
┌─────────────────────────────────────┐
│              CLOUD                  │  ← Provider infrastructure
│   ┌─────────────────────────────┐   │
│   │          CLUSTER            │   │  ← Kubernetes control plane & nodes
│   │   ┌─────────────────────┐   │   │
│   │   │      CONTAINER      │   │   │  ← Container images & runtime
│   │   │   ┌─────────────┐   │   │   │
│   │   │   │    CODE     │   │   │   │  ← Application source code
│   │   │   └─────────────┘   │   │   │
│   │   └─────────────────────┘   │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
\`\`\`

> **Key principle**: Each inner layer relies on the security of the outer layers. A compromise at the Cloud layer undermines all inner security.

## 1. Code Security

The innermost layer — securing the application itself.

### Threats
- Insecure dependencies (CVEs in libraries)
- Injection attacks (SQL, command injection)
- Insecure deserialization
- Hardcoded secrets
- Broken authentication/authorization

### Controls
- **SAST** (Static Application Security Testing) — code scanning (SonarQube, Semgrep)
- **DAST** (Dynamic Application Security Testing) — runtime testing (OWASP ZAP)
- **SCA** (Software Composition Analysis) — dependency scanning (Snyk, OWASP Dependency-Check)
- **Secrets detection** — detect hardcoded credentials (GitLeaks, detect-secrets)
- **Secure coding practices** — OWASP Top 10
- **Code review** — mandatory PR reviews
- **Dependency pinning** — pin to specific versions, not floating tags

### OWASP Top 10 (most relevant to containers)
1. Broken Access Control
2. Cryptographic Failures
3. Injection
4. Insecure Design
5. Security Misconfiguration

## 2. Container Security

Securing the container image and runtime.

### Threats
- Vulnerable base images (unpatched CVEs)
- Running as root
- Privileged containers
- Image tampering
- Sensitive data in image layers

### Controls
- **Minimal base images** — distroless, Alpine, Scratch
- **Non-root user** — \`USER nonroot\` in Dockerfile
- **Image scanning** — Trivy, Grype, Clair, Snyk Container
- **Image signing** — Cosign (Sigstore), Notary
- **No sensitive data** — don't copy secrets into images
- **Multi-stage builds** — strip build tools from final image
- **Read-only filesystem** — \`readOnlyRootFilesystem: true\`
- **Drop capabilities** — \`capabilities.drop: ["ALL"]\`

### Dockerfile Best Practices
\`\`\`dockerfile
# Use minimal base
FROM gcr.io/distroless/static-debian11

# Don't run as root
USER 65532:65532

# Don't include secrets
COPY --chown=65532:65532 app /app

# Don't expose unnecessary ports
EXPOSE 8080
\`\`\`

## 3. Cluster Security

Securing the Kubernetes cluster itself.

### Threats
- Unauthorized API access
- Overly permissive RBAC
- Network traffic between pods (lateral movement)
- Privileged workloads escalating to node
- Exposed etcd

### Controls
- **RBAC** — least-privilege access control
- **NetworkPolicy** — restrict pod communication
- **PodSecurity** (Pod Security Standards) — restrict privileged workloads
- **API server hardening** — disable anonymous auth, enable audit logging
- **etcd encryption** — encrypt secrets at rest
- **Node hardening** — CIS Kubernetes Benchmark
- **Admission controllers** — OPA/Gatekeeper, Kyverno
- **Audit logging** — track all API calls

### Cluster Security Controls Checklist
\`\`\`
✅ Disable anonymous auth on API server
✅ Enable RBAC (--authorization-mode=RBAC)
✅ Encrypt secrets at rest (EncryptionConfiguration)
✅ Enable audit logging
✅ Apply NetworkPolicy to all namespaces
✅ Use Pod Security Standards (restricted)
✅ Restrict access to etcd (cert-based auth only)
✅ Regular CIS Benchmark scanning (kube-bench)
\`\`\`

## 4. Cloud Security

Securing the underlying cloud infrastructure.

### Threats
- Compromised cloud credentials (IAM)
- Overly permissive IAM roles
- Misconfigured firewalls/security groups
- Exposed cloud provider metadata service
- Unencrypted data at rest/transit

### Controls
- **IAM** — least-privilege cloud roles (no cluster-admin via cloud IAM)
- **Network isolation** — VPCs, private subnets, security groups
- **Metadata service protection** — restrict access (block IMDS from pods)
- **Encryption** — disk encryption, KMS for secrets
- **Audit logging** — CloudTrail, GCP Audit Logs, Azure Monitor
- **Vulnerability scanning** — cloud posture management (CSPM)

### Cloud Metadata Service Attack
A container that can reach the cloud metadata service (169.254.169.254) can steal node IAM credentials:
\`\`\`bash
# Attack vector: from inside a compromised container
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/
# Returns temporary AWS credentials!
\`\`\`

**Mitigation**: Use NetworkPolicy or IMDSv2 (token-required) + hop limit to block metadata from pods.

## The Layered Security Principle

| Layer | "If this fails..." | Impact |
|-------|-------------------|--------|
| Cloud | Attacker controls infrastructure | All other layers compromised |
| Cluster | Attacker can access all workloads | Containers and code exposed |
| Container | Attacker runs arbitrary code | Code layer exposed |
| Code | Attacker exploits app vulnerability | Data breached, lateral movement |

**Defense in depth**: Even if one layer is breached, others limit the blast radius.

## Common Mistakes

- Focusing only on Code security and ignoring infrastructure
- Assuming cloud provider handles all security (shared responsibility model)
- Not applying NetworkPolicy (default allow-all between pods)
- Running containers as root (easy container escape to node)
- Not scanning images before deployment
`,
  quiz: [
    {
      question: 'What does the "4C" in "4Cs of Cloud Native Security" stand for?',
      options: [
        'Code, Container, Cluster, Cloud',
        'Control, Compliance, Configuration, Credentials',
        'CoreDNS, CRI, CNI, CSI',
        'Certificate, CORS, CI/CD, Container'
      ],
      correct: 0,
      explanation: 'The 4Cs are Code (application security), Container (image/runtime security), Cluster (Kubernetes security), and Cloud (infrastructure security). They form nested security layers.',
      reference: 'Review "Overview" section — the nested diagram.'
    },
    {
      question: 'A container can reach the cloud provider metadata service at 169.254.169.254. What is the security risk?',
      options: [
        'The container can steal IAM credentials from the node\'s metadata service',
        'The container can modify cluster DNS via the metadata service',
        'The container can access other pods\' secrets through the metadata service',
        'The container can escalate to cluster-admin via the metadata service API'
      ],
      correct: 0,
      explanation: 'Cloud metadata services expose the node\'s IAM role credentials. A compromised container reaching this service can steal credentials and escalate to cloud-level access. Mitigate with NetworkPolicy or IMDSv2.',
      reference: 'Review "Cloud Metadata Service Attack" section.'
    },
    {
      question: 'Which layer of the 4Cs model does running containers as root violate?',
      options: [
        'Container security',
        'Code security',
        'Cluster security',
        'Cloud security'
      ],
      correct: 0,
      explanation: 'Running as root is a Container security issue. Root inside a container can break out to the node if the container runtime has vulnerabilities. Controls: USER nonroot in Dockerfile, runAsNonRoot: true in pod spec.',
      reference: 'Review "Container Security" section — Controls.'
    },
    {
      question: 'What is the key principle behind the 4Cs layered security model?',
      options: [
        'Each inner layer relies on the outer layers being secure; a compromise at outer layer undermines all inner layers',
        'Security controls at each layer are completely independent',
        'Code security is most important; cloud security is optional for containerized apps',
        'Each layer must be secured by a different team in the organization'
      ],
      correct: 0,
      explanation: 'The layers are nested — a cloud compromise defeats all cluster, container, and code controls. Defense in depth means multiple independent layers, so breaching one doesn\'t automatically compromise all.',
      reference: 'Review "The Layered Security Principle" table.'
    },
    {
      question: 'Which control addresses vulnerable dependencies in application libraries?',
      options: [
        'SCA (Software Composition Analysis)',
        'RBAC (Role-Based Access Control)',
        'NetworkPolicy',
        'PodSecurityStandards'
      ],
      correct: 0,
      explanation: 'SCA tools (Snyk, OWASP Dependency-Check) scan application dependencies for known CVEs. This is a Code layer control. RBAC, NetworkPolicy, and PSS are Cluster layer controls.',
      reference: 'Review "Code Security" section — Controls (SCA).'
    },
    {
      question: 'Which tool is used to scan container images for CVE vulnerabilities?',
      options: [
        'Trivy',
        'kube-bench',
        'Falco',
        'OPA Gatekeeper'
      ],
      correct: 0,
      explanation: 'Trivy (by Aqua Security) is the most popular open-source container image scanner. It scans OS packages and language libraries. kube-bench checks CIS benchmarks; Falco detects runtime threats; OPA enforces policies.',
      reference: 'Review "Container Security" section — Image scanning controls.'
    },
    {
      question: 'What is the "shared responsibility model" in cloud security?',
      options: [
        'Cloud provider secures the infrastructure; customer secures workloads and data on top of it',
        'Security responsibilities are shared equally between Dev and Ops teams',
        'All cloud security is handled by the cloud provider, the customer has no security responsibilities',
        'Customer handles infrastructure; cloud provider handles application security'
      ],
      correct: 0,
      explanation: 'The shared responsibility model: cloud provider secures hardware, facilities, and infrastructure software. The customer secures OS, runtime, data, identity, and workloads. Kubernetes security is always the customer\'s responsibility.',
      reference: 'Review "Cloud Security" section — Common Mistakes.'
    },
    {
      question: 'Which 4C layer does enabling audit logging in the Kubernetes API server address?',
      options: [
        'Cluster',
        'Code',
        'Container',
        'Cloud'
      ],
      correct: 0,
      explanation: 'API server audit logging is a Cluster security control. It records all API requests (who did what, when). Cloud audit logs (CloudTrail, etc.) are Cloud layer controls.',
      reference: 'Review "Cluster Security" section — Controls checklist.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4Cs of Cloud Native Security?',
      back: 'Code (application vulnerabilities), Container (image and runtime security), Cluster (Kubernetes control plane and workload security), Cloud (infrastructure and provider-level security). Each layer builds on the outer layer\'s security.'
    },
    {
      front: 'What is the security risk of running containers as root?',
      back: 'Root inside a container can potentially escape to the node if the container runtime has vulnerabilities. This violates the Container security layer. Fix: USER nonroot in Dockerfile, runAsNonRoot: true in securityContext.'
    },
    {
      front: 'What is the cloud metadata service attack?',
      back: 'If a pod can reach 169.254.169.254 (cloud metadata endpoint), it can steal IAM credentials from the node. This can escalate to cloud-level access. Mitigation: NetworkPolicy to block metadata service, or IMDSv2 with hop limit.'
    },
    {
      front: 'What is SAST vs DAST vs SCA in Code security?',
      back: 'SAST: static code analysis (scans source code for vulnerabilities). DAST: dynamic testing (runs app and tests it). SCA: software composition analysis (scans dependencies/libraries for CVEs). All are Code layer controls.'
    },
    {
      front: 'What is the shared responsibility model for Kubernetes security?',
      back: 'Cloud provider secures physical infrastructure, virtualization, and managed services. Customer secures: Kubernetes configuration, RBAC, NetworkPolicy, container images, application code, and data. K8s security is always the customer\'s responsibility.'
    },
    {
      front: 'What Cluster security controls protect against lateral movement?',
      back: 'NetworkPolicy (restrict pod-to-pod traffic), RBAC (least-privilege API access), PodSecurity (prevent privileged escalation), Admission controllers (enforce security policies). Without NetworkPolicy, compromised pod has full cluster network access.'
    }
  ],
  lab: {
    scenario: 'Explore the 4C security model in a real cluster by checking controls at each layer — from code to cloud.',
    objective: 'Identify and verify security controls at each layer of the 4C model.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Audit Container layer security',
        instruction: `Check whether pods in the cluster are running as root or using privileged mode. This represents a Container layer security audit. Look for pods with security misconfigurations in the default namespace.`,
        hints: [
          'kubectl get pods -o json | jq to extract security context',
          'Look for runAsUser: 0 or privileged: true',
          'kubectl get pods -o jsonpath can filter specific fields'
        ],
        solution: `\`\`\`bash
# Check pods running as root (uid=0)
kubectl get pods --all-namespaces -o json | \\
  python3 -c "
import json, sys
pods = json.load(sys.stdin)
for p in pods['items']:
    ns = p['metadata']['namespace']
    name = p['metadata']['name']
    containers = p['spec'].get('containers', [])
    for c in containers:
        sc = c.get('securityContext', {})
        psc = p['spec'].get('securityContext', {})
        uid = sc.get('runAsUser', psc.get('runAsUser', 'unset'))
        priv = sc.get('privileged', False)
        if uid == 0 or priv:
            print(f'{ns}/{name}/{c[\"name\"]}: runAsUser={uid}, privileged={priv}')
  "

# Simpler check with kubectl
kubectl get pods --all-namespaces -o jsonpath='{range .items[*]}{.metadata.namespace}/{.metadata.name}{"\t"}{.spec.securityContext}{"\n"}{end}' | head -20
\`\`\``,
        verify: `\`\`\`bash
# Check if any pods are explicitly privileged
kubectl get pods --all-namespaces -o json | grep -c '"privileged": true'
# Note the count — 0 is best in production

# Check runAsNonRoot enforcement
kubectl get pods -n default -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].securityContext.runAsNonRoot}{"\n"}{end}'
# Ideally all should be "true"
\`\`\``
      },
      {
        title: 'Audit Cluster layer security — RBAC and NetworkPolicy',
        instruction: `Check cluster-level RBAC: look for overly broad bindings (anyone with cluster-admin). Also check if NetworkPolicy is being used in the default namespace.`,
        hints: [
          'kubectl get clusterrolebindings | grep cluster-admin',
          'kubectl get networkpolicies --all-namespaces',
          'If no NetworkPolicy exists in a namespace, all traffic is allowed (default allow)'
        ],
        solution: `\`\`\`bash
# Check who has cluster-admin
kubectl get clusterrolebindings -o json | \\
  python3 -c "
import json, sys
crbs = json.load(sys.stdin)
for crb in crbs['items']:
    if crb.get('roleRef', {}).get('name') == 'cluster-admin':
        subjects = crb.get('subjects', [])
        for s in subjects:
            print(f'{crb[\"metadata\"][\"name\"]}: {s[\"kind\"]} {s.get(\"name\",\"\")} {s.get(\"namespace\",\"\")}')
"

# Check NetworkPolicy usage
kubectl get networkpolicies --all-namespaces
echo "---"
echo "Namespaces WITHOUT NetworkPolicy:"
kubectl get ns -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | while read ns; do
  count=$(kubectl get networkpolicies -n $ns 2>/dev/null | wc -l)
  if [ "$count" -le "1" ]; then
    echo "  - $ns (no NetworkPolicy)"
  fi
done
\`\`\``,
        verify: `\`\`\`bash
# Verify RBAC is enabled
kubectl api-resources | grep -i "clusterrole"
# Expected: shows ClusterRole and ClusterRoleBinding

# Check audit logging status (if accessible)
kubectl get pods -n kube-system | grep -i "api" | head -5
# In most clusters, the kube-apiserver is not a pod but configured via static manifests
\`\`\``
      },
      {
        title: 'Test a Code layer threat: block metadata service access',
        instruction: `Create a NetworkPolicy that blocks pods in the \`default\` namespace from reaching the cloud metadata service (169.254.169.254). This is a Cluster-layer control defending against a Cloud-layer attack.`,
        hints: [
          'Use a NetworkPolicy with egress rules',
          'Block egress to 169.254.169.254/32 on port 80',
          'Apply to all pods in the default namespace with podSelector: {}'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-metadata-service
  namespace: default
spec:
  podSelector: {}        # applies to ALL pods in namespace
  policyTypes:
    - Egress
  egress:
    - to:
      - ipBlock:
          cidr: 0.0.0.0/0
          except:
            - 169.254.169.254/32  # block cloud metadata service
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get networkpolicy block-metadata-service -n default
# Expected: NetworkPolicy created

kubectl describe networkpolicy block-metadata-service -n default
# Expected: shows egress rules blocking 169.254.169.254/32

# Cleanup
kubectl delete networkpolicy block-metadata-service -n default
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Container running as root — remediation',
      difficulty: 'easy',
      symptom: 'Security scan shows containers running as root (uid 0). Need to enforce non-root execution without breaking the application.',
      diagnosis: `\`\`\`bash
# Check current running user
kubectl exec <pod-name> -- id
# Expected problem: uid=0(root)

# Check if Dockerfile has a USER directive
kubectl get pod <pod-name> -o yaml | grep -A5 securityContext

# Check Pod Security Standards enforcement
kubectl get namespace <ns> -o yaml | grep pod-security
\`\`\``,
      solution: `Fix at the Pod level with securityContext:
\`\`\`yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
  containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
\`\`\`

If the app requires root (e.g., for port < 1024 binding), fix properly:
\`\`\`yaml
# Add NET_BIND_SERVICE capability instead of running as root
securityContext:
  capabilities:
    add: ["NET_BIND_SERVICE"]
    drop: ["ALL"]
  runAsUser: 1000
\`\`\``
    },
    {
      title: 'Cluster layer drift: RBAC policy too permissive',
      difficulty: 'medium',
      symptom: 'Security audit finds a ServiceAccount with cluster-admin ClusterRoleBinding. This is a Cluster layer misconfiguration that violates the principle of least privilege.',
      diagnosis: `\`\`\`bash
# Find all cluster-admin bindings
kubectl get clusterrolebindings -o json | \\
  grep -B5 '"name": "cluster-admin"' | grep "name"

# Check what the SA actually needs
kubectl logs deployment/<app> -n <ns> 2>&1 | grep "forbidden"
# Look for "is forbidden: User ... cannot ..."

# List minimal required permissions
kubectl auth can-i --list \\
  --as=system:serviceaccount:<ns>:<sa> \\
  -n <ns>
\`\`\``,
      solution: `Replace cluster-admin with a minimal Role:

1. Find what the app actually needs (check logs for forbidden errors)
2. Create a minimal Role with only those permissions:
\`\`\`bash
kubectl create role minimal-role \\
  --verb=get,list,watch \\
  --resource=pods,services \\
  -n <namespace>

kubectl create rolebinding minimal-binding \\
  --role=minimal-role \\
  --serviceaccount=<namespace>:<sa-name> \\
  -n <namespace>
\`\`\`

3. Remove the cluster-admin binding:
\`\`\`bash
kubectl delete clusterrolebinding <binding-name>
\`\`\`

4. Test that the app still works with minimal permissions.`
    }
  ]
};
