window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcsa-compliance/compliance-frameworks'] = {
  theory: `# Compliance Frameworks

## Exam Relevance
> KCSA tests awareness of compliance frameworks relevant to Kubernetes deployments. Expect questions about CIS Benchmarks, SOC 2, HIPAA, PCI DSS, NIST, and how Kubernetes features map to compliance requirements.

## Why Compliance Matters for Kubernetes

Organizations deploying Kubernetes must meet various compliance requirements depending on their industry and the types of data they handle. Kubernetes features and security controls map directly to compliance requirements.

## CIS Kubernetes Benchmark

The **Center for Internet Security (CIS) Benchmark** is the most widely-used Kubernetes security standard. It provides prescriptive guidance for hardening Kubernetes components.

### Benchmark Structure
\`\`\`
1. Control Plane Components
   1.1 Control Plane Node Configuration Files
   1.2 API Server
   1.3 Controller Manager
   1.4 Scheduler

2. etcd
   2.1 etcd Configuration

3. Control Plane Configuration
   3.1 Authentication and Authorization
   3.2 Logging

4. Worker Nodes
   4.1 Worker Node Configuration Files
   4.2 Kubelet

5. Kubernetes Policies
   5.1 RBAC and Service Accounts
   5.2 Pod Security Standards
   5.3 Network Policies and CNI
   5.4 Secrets Management
   5.5 Extensible Admission Control
   5.7 General Policies
\`\`\`

### kube-bench

\`\`\`bash
# Run CIS benchmark assessment
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
kubectl logs job/kube-bench

# Key output fields:
# [PASS] 1.2.1 Ensure that the --anonymous-auth argument is set to false
# [FAIL] 1.2.20 Ensure that the --profiling argument is set to false
# [WARN] 5.1.1 Ensure that the cluster-admin role is only used where required
# [INFO] 5.1.2 Minimize access to secrets
\`\`\`

### Sample CIS Controls → Kubernetes Config Mapping

| CIS Control | Kubernetes Implementation |
|-------------|--------------------------|
| 1.2.1 Disable anonymous auth | \`--anonymous-auth=false\` |
| 1.2.6 kubelet cert auth | \`--kubelet-certificate-authority\` |
| 1.2.20 Disable profiling | \`--profiling=false\` |
| 2.1 etcd cert auth | \`--client-cert-auth=true\` |
| 3.2.1 Audit logging | \`--audit-log-path\` + policy |
| 5.1.6 Avoid service accounts cluster-admin | RBAC review |
| 5.2.1 Ensure PSS Restricted or Baseline | Namespace PSS labels |
| 5.3.2 Default-deny NetworkPolicy | \`NetworkPolicy\` |
| 5.4.1 Secrets encryption at rest | \`EncryptionConfiguration\` |

## SOC 2 — Service Organization Control

SOC 2 is an audit framework for service providers handling customer data. Five Trust Service Criteria (TSC):

| Criteria | K8s Controls |
|----------|-------------|
| **Security** | RBAC, NetworkPolicy, Pod Security, audit logging |
| **Availability** | Multi-master HA, pod autoscaling, health probes |
| **Processing Integrity** | Admission controllers, image signing |
| **Confidentiality** | Encryption at rest/transit, Secrets management |
| **Privacy** | Data classification, access controls |

**SOC 2 Type I**: Point-in-time assessment
**SOC 2 Type II**: 6-12 month operational assessment (stronger)

## PCI DSS — Payment Card Industry Data Security Standard

Required for organizations processing payment card data.

### Key Requirements → Kubernetes Mapping

| PCI DSS Requirement | Kubernetes Control |
|--------------------|-------------------|
| 6.4.2 Apply security patches | Regular node/image updates |
| 7.1 Restrict access by need-to-know | RBAC least privilege |
| 8.6 System accounts | ServiceAccount management |
| 10.1 Implement audit trails | API server audit logging |
| 10.3 Audit log events | Audit policy configuration |
| 11.3 External/internal penetration testing | Regular security assessments |
| 12.2 Implement a risk assessment | Threat modeling |

### PCI Scope Reduction with Kubernetes
- Use namespaces to isolate payment processing workloads
- NetworkPolicy to restrict traffic to/from payment namespace
- No sensitive data in logs, ConfigMaps, or environment variables

## HIPAA — Health Insurance Portability and Accountability Act

Applies to healthcare organizations handling Protected Health Information (PHI).

### HIPAA → Kubernetes Mapping

| HIPAA Safeguard | Kubernetes Control |
|----------------|-------------------|
| Access Control | RBAC, PSS, ServiceAccounts |
| Audit Controls | API server audit logging, Falco |
| Integrity | Image signing, etcd integrity |
| Person/Entity Auth | OIDC integration, MFA |
| Transmission Security | TLS (Ingress, mTLS), NetworkPolicy |
| Workforce Training | Documentation, runbooks |
| Facility Access | Node access controls, no SSH |

### Business Associate Agreement (BAA)
If using managed Kubernetes (EKS, GKE, AKS) with PHI, ensure the cloud provider has signed a BAA.

## NIST SP 800-190 — Application Container Security

NIST's guide specifically for container security:

### Five Risk Areas
1. **Image risks** — vulnerabilities in images
2. **Registry risks** — unauthorized access, image tampering
3. **Orchestrator risks** — insecure configuration
4. **Container risks** — container breakout, lateral movement
5. **Host OS risks** — kernel vulnerabilities, node compromise

### NIST Recommendations → Kubernetes
\`\`\`
Image risks:      → Trivy scanning, minimal images, signing
Registry risks:   → Private registry, access control, immutable tags
Orchestrator:     → CIS Benchmark, RBAC, audit logging, PSS
Container risks:  → securityContext, NetworkPolicy, no privileged
Host OS risks:    → Node hardening, kubelet auth, CIS node benchmark
\`\`\`

## NIST CSF — Cybersecurity Framework

Five functions mapped to Kubernetes:

| Function | Kubernetes Activities |
|----------|----------------------|
| **Identify** | Asset inventory (pods, services, configs), threat modeling |
| **Protect** | RBAC, NetworkPolicy, encryption, PSS, admission control |
| **Detect** | Audit logging, Falco, monitoring, alerting |
| **Respond** | Incident playbooks, container forensics, RBAC revocation |
| **Recover** | etcd backup/restore, GitOps recovery, PV restoration |

## FedRAMP

US government cloud security standard. Similar to NIST SP 800-53. For GovCloud Kubernetes deployments:
- Requires FIPS-140 validated cryptography
- Specific logging and monitoring requirements
- Stricter access control
- Physical security requirements for on-premises

## Compliance Automation Tools

| Tool | Purpose |
|------|---------|
| **kube-bench** | CIS Kubernetes Benchmark assessment |
| **Trivy** | CVE scanning + Dockerfile/Helm misconfiguration |
| **Falco** | Runtime compliance monitoring |
| **OPA/Gatekeeper** | Policy enforcement (admission) |
| **Kyverno** | Policy enforcement + generation |
| **Kubescape** | Multi-framework compliance (NIST, NSA, MITRE) |
| **Checkov** | Infrastructure-as-Code scanning |
| **Prowler** | AWS + Kubernetes security assessment |

## Key Compliance Principles

1. **Separation of duties** — separate roles for developer, ops, security
2. **Least privilege** — minimal RBAC permissions
3. **Audit everything** — comprehensive audit logging
4. **Encrypt data** — at rest (etcd) and in transit (TLS)
5. **Patch promptly** — regular security updates
6. **Document controls** — evidence for auditors
7. **Test regularly** — penetration testing, CIS benchmark checks
`,
  quiz: [
    {
      question: 'What is the CIS Kubernetes Benchmark and how is it assessed?',
      options: [
        'A prescriptive security configuration guide assessed with kube-bench, which outputs PASS/FAIL for each check',
        'A compliance certification that Kubernetes clusters can achieve',
        'A set of network security rules enforced by CNI plugins',
        'An annual security audit performed by CIS auditors'
      ],
      correct: 0,
      explanation: 'CIS Benchmark provides prescriptive hardening guidance. kube-bench automates the assessment by checking API server flags, etcd config, kubelet settings, and RBAC policies against the benchmark.',
      reference: 'Review "CIS Kubernetes Benchmark" and "kube-bench" sections.'
    },
    {
      question: 'Which compliance framework is specifically required for organizations processing credit card payments?',
      options: [
        'PCI DSS (Payment Card Industry Data Security Standard)',
        'HIPAA',
        'SOC 2',
        'NIST CSF'
      ],
      correct: 0,
      explanation: 'PCI DSS is the standard for organizations that process, store, or transmit credit card data. It has specific requirements for access control, audit logging, patching, and network security that map to Kubernetes controls.',
      reference: 'Review "PCI DSS" section.'
    },
    {
      question: 'What does "SOC 2 Type II" assess compared to "SOC 2 Type I"?',
      options: [
        'Type II assesses controls over a 6-12 month operational period; Type I is a point-in-time assessment',
        'Type II assesses security only; Type I assesses all five Trust Service Criteria',
        'Type II is for cloud providers; Type I is for on-premises Kubernetes',
        'Type II requires government auditors; Type I uses self-assessment'
      ],
      correct: 0,
      explanation: 'SOC 2 Type I: assesses whether controls are suitably designed at a point in time. Type II: assesses whether controls operated effectively over a 6-12 month period. Type II is stronger evidence of security.',
      reference: 'Review "SOC 2" section.'
    },
    {
      question: 'Which NIST publication specifically addresses application container security?',
      options: [
        'NIST SP 800-190 — Application Container Security',
        'NIST SP 800-53 — Security Controls',
        'NIST CSF — Cybersecurity Framework',
        'NIST SP 800-171 — CUI Protection'
      ],
      correct: 0,
      explanation: 'NIST SP 800-190 is specifically about container security, covering five risk areas: image risks, registry risks, orchestrator risks, container risks, and host OS risks.',
      reference: 'Review "NIST SP 800-190" section.'
    },
    {
      question: 'Which NIST CSF function does Falco (runtime security) primarily support?',
      options: [
        'Detect — runtime threat detection and alerting',
        'Protect — preventing attacks from occurring',
        'Identify — discovering assets and risks',
        'Respond — automated incident response'
      ],
      correct: 0,
      explanation: 'Falco is a runtime security tool that detects unexpected behavior (syscall monitoring, process spawning, network connections). This aligns with the Detect function of NIST CSF.',
      reference: 'Review "NIST CSF" — Detect function.'
    },
    {
      question: 'What is HIPAA\'s requirement that requires a signed agreement with cloud providers handling healthcare data?',
      options: [
        'Business Associate Agreement (BAA) — required when a vendor handles Protected Health Information',
        'Data Processing Agreement (DPA)',
        'Security Service Level Agreement (SSLA)',
        'Healthcare Data Compliance Certificate (HDCC)'
      ],
      correct: 0,
      explanation: 'HIPAA requires a Business Associate Agreement with any third party (including cloud providers like AWS, GCP, Azure) that handles, processes, or stores Protected Health Information (PHI) on your behalf.',
      reference: 'Review "HIPAA" section — Business Associate Agreement.'
    },
    {
      question: 'What Kubernetes control maps to PCI DSS Requirement 10.1 "Implement audit trails"?',
      options: [
        'API server audit logging with an audit policy file',
        'RBAC least-privilege role assignments',
        'Pod Security Standards enforcement',
        'etcd encryption at rest'
      ],
      correct: 0,
      explanation: 'PCI DSS Requirement 10 is about audit logging. Kubernetes API server audit logging (--audit-log-path with an audit policy) records all API calls with who, what, when — satisfying the audit trail requirement.',
      reference: 'Review "PCI DSS" section — Key Requirements table.'
    },
    {
      question: 'What tool provides multi-framework Kubernetes compliance assessment (NIST, NSA, MITRE)?',
      options: [
        'Kubescape',
        'kube-bench',
        'Trivy',
        'Falco'
      ],
      correct: 0,
      explanation: 'Kubescape assesses Kubernetes configurations against multiple frameworks simultaneously: NIST SP 800-53, NSA Kubernetes Hardening Guide, MITRE ATT&CK for Containers. kube-bench focuses on CIS Benchmark only.',
      reference: 'Review "Compliance Automation Tools" table.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 5 major compliance frameworks for Kubernetes environments?',
      back: 'CIS Kubernetes Benchmark (hardening guide), SOC 2 (cloud service providers), PCI DSS (payment processing), HIPAA (healthcare), NIST SP 800-190 (container security) / NIST CSF (general cybersecurity). Industry determines which applies.'
    },
    {
      front: 'What does kube-bench assess?',
      back: 'kube-bench runs automated checks against the CIS Kubernetes Benchmark. It checks: API server flags (anonymous auth, profiling), etcd configuration (cert auth), kubelet settings, RBAC configurations, pod security standards. Outputs PASS/FAIL/WARN.'
    },
    {
      front: 'How do Kubernetes audit logs satisfy compliance requirements?',
      back: 'Audit logs record every API request with: who (user/SA), what (verb, resource, name), when (timestamp), and from where (IP). This satisfies: SOC 2 audit trails, PCI DSS Req 10 (audit logs), HIPAA audit controls, NIST CSF Detect function.'
    },
    {
      front: 'What is the NIST CSF "Recover" function in a Kubernetes context?',
      back: 'Kubernetes Recovery capabilities: etcd backup/restore (cluster state recovery), GitOps (redeploy cluster from Git), PV snapshots (data recovery), DRPs (Disaster Recovery Plans), runbooks for incident recovery. Key: etcd backup is the most critical.'
    },
    {
      front: 'What compliance considerations apply to managed Kubernetes (EKS/GKE/AKS)?',
      back: 'Cloud provider handles control plane security (covered by their compliance certs). Customer still responsible for: RBAC, NetworkPolicy, workload security, container images, data encryption configuration, audit logging configuration, and node-level settings for unmanaged nodes.'
    },
    {
      front: 'What is the relationship between CIS Benchmark and other frameworks?',
      back: 'CIS Benchmark is prescriptive (specific configuration instructions). Other frameworks (NIST, SOC 2, PCI) are objective-based. CIS controls often satisfy multiple framework requirements simultaneously. kube-bench covers CIS; Kubescape covers multiple frameworks.'
    }
  ],
  lab: {
    scenario: 'Run a compliance assessment against the CIS Kubernetes Benchmark and identify gaps. Practice mapping Kubernetes configurations to compliance requirements.',
    objective: 'Understand compliance assessment automation and map cluster configurations to framework requirements.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Run a compliance check with kube-bench',
        instruction: `Deploy kube-bench as a Kubernetes Job to assess the cluster against CIS Benchmark. Review the PASS/FAIL/WARN output and identify top findings.`,
        hints: [
          'kube-bench job YAML is available on GitHub',
          'kubectl logs job/kube-bench to see results',
          'Look for FAIL items — these need remediation'
        ],
        solution: `\`\`\`bash
# Run kube-bench as a Job
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml

# Wait for completion
kubectl wait job/kube-bench --for=condition=complete --timeout=120s 2>/dev/null || \\
  kubectl wait pod -l app=kube-bench --for=condition=Ready --timeout=120s 2>/dev/null || \\
  sleep 30

# View results
kubectl logs job/kube-bench 2>/dev/null || \\
  kubectl logs $(kubectl get pods -l app=kube-bench -o name | head -1) 2>/dev/null
\`\`\``,
        verify: `\`\`\`bash
# Check results summary
kubectl logs job/kube-bench 2>/dev/null | grep -E "^== Summary ==" -A 10 || \\
  kubectl logs $(kubectl get pods -l app=kube-bench -o name | head -1) 2>/dev/null | \\
  grep -E "PASS|FAIL|WARN" | tail -20

# Count findings by type
kubectl logs job/kube-bench 2>/dev/null | grep -c "^\[PASS\]" && \\
kubectl logs job/kube-bench 2>/dev/null | grep -c "^\[FAIL\]" && \\
kubectl logs job/kube-bench 2>/dev/null | grep -c "^\[WARN\]"
\`\`\``
      },
      {
        title: 'Map cluster configuration to compliance requirements',
        instruction: `Check specific Kubernetes configurations that are required by multiple compliance frameworks: audit logging, etcd encryption, anonymous auth, and RBAC. Map findings to CIS Benchmark controls.`,
        hints: [
          'Check API server flags: kubectl get pod kube-apiserver -n kube-system -o yaml',
          'Check audit log configuration',
          'Test anonymous auth: kubectl auth can-i list pods --as=system:anonymous'
        ],
        solution: `\`\`\`bash
echo "=== Compliance Assessment ==="
echo ""

# CIS 1.2.1 - Check anonymous auth
echo "CIS 1.2.1 - Anonymous Auth:"
ANON=$(kubectl auth can-i list pods --as=system:anonymous 2>&1)
echo "  Anonymous can list pods: $ANON"
if [ "$ANON" = "no" ]; then echo "  [PASS]"; else echo "  [FAIL]"; fi
echo ""

# CIS 3.2.1 - Check audit logging
echo "CIS 3.2.1 - Audit Logging:"
kubectl get pod -n kube-system -l component=kube-apiserver -o jsonpath='{.items[0].spec.containers[0].command}' 2>/dev/null | tr ',' '\n' | grep -q "audit-log-path" && echo "  [PASS] Audit log configured" || echo "  [WARN] No audit log path found"
echo ""

# CIS 5.1 - RBAC cluster-admin usage
echo "CIS 5.1.1 - Cluster-admin usage:"
CADMIN=$(kubectl get clusterrolebindings -o json 2>/dev/null | python3 -c "
import json,sys
crbs=json.load(sys.stdin)
count=0
for c in crbs['items']:
  if c.get('roleRef',{}).get('name')=='cluster-admin':
    subs=c.get('subjects',[]) or []
    for s in subs:
      if not s.get('name','').startswith('system:'):
        print(f'  Non-system cluster-admin: {s.get(\"name\")}')
        count+=1
if count==0: print('  No non-system cluster-admin bindings')
")
echo "$CADMIN"
\`\`\``,
        verify: `\`\`\`bash
# Check RBAC is enabled
kubectl api-resources | grep clusterroles | head -1
# Expected: shows ClusterRole resource (means RBAC is active)

# Check NetworkPolicy usage
NETPOL_COUNT=$(kubectl get networkpolicies --all-namespaces 2>/dev/null | wc -l)
if [ "$NETPOL_COUNT" -gt "1" ]; then
  echo "[INFO] NetworkPolicies found: $(($NETPOL_COUNT - 1)) (CIS 5.3.2 - default deny)"
else
  echo "[WARN] No NetworkPolicies found (CIS 5.3.2)"
fi

# Check PSS labels
echo "Namespace PSS labels:"
kubectl get namespaces -o json | python3 -c "
import json, sys
ns = json.load(sys.stdin)
for n in ns['items']:
  labels = n.get('metadata', {}).get('labels', {})
  pss = {k:v for k,v in labels.items() if 'pod-security' in k}
  if pss:
    print(f'{n[\"metadata\"][\"name\"]}: {pss}')
" 2>/dev/null || echo "No PSS labels found"
\`\`\``
      },
      {
        title: 'Create a compliance evidence document',
        instruction: `Generate a simple compliance evidence summary for the cluster. This demonstrates how to document Kubernetes security controls for auditors.`,
        hints: [
          'Combine all the checks from the previous steps',
          'Output in a structured format',
          'Show which compliance frameworks each control satisfies'
        ],
        solution: `\`\`\`bash
cat <<'EOF' > /tmp/compliance-evidence.txt
=== KUBERNETES COMPLIANCE EVIDENCE SUMMARY ===
Generated: $(date)
Cluster: $(kubectl config current-context 2>/dev/null)

=== CONTROL: Authentication & Authorization ===
Framework(s): CIS 1.2.1, SOC 2 Security, PCI DSS 7.1, NIST CSF Protect
Evidence:
  RBAC enabled: $(kubectl api-resources | grep -c clusterrole > /dev/null 2>&1 && echo "YES" || echo "NO")
  Anonymous auth disabled: $(kubectl auth can-i list pods --as=system:anonymous 2>&1 | grep -q "no" && echo "YES" || echo "NEEDS REVIEW")

=== CONTROL: Audit Logging ===
Framework(s): CIS 3.2.1, SOC 2 Audit, PCI DSS 10.1-10.3, HIPAA Audit Controls
Evidence:
  Audit configuration: $(kubectl get pod -n kube-system -l component=kube-apiserver -o jsonpath='{.items[0].spec.containers[0].command}' 2>/dev/null | grep -c "audit" > /dev/null 2>&1 && echo "CHECK MANUALLY" || echo "CHECK MANUALLY")

=== CONTROL: Network Segmentation ===
Framework(s): CIS 5.3, PCI DSS Network Segmentation, NIST CSF Protect
Evidence:
  NetworkPolicy count: $(kubectl get networkpolicies --all-namespaces 2>/dev/null | wc -l) policies

=== CONTROL: Pod Security ===
Framework(s): CIS 5.2, NIST SP 800-190
Evidence:
  PSS-labeled namespaces: $(kubectl get namespaces -o json 2>/dev/null | python3 -c "import json,sys; ns=json.load(sys.stdin); count=sum(1 for n in ns['items'] if any('pod-security' in k for k in n.get('metadata',{}).get('labels',{}))); print(count)" 2>/dev/null) namespaces

=== END OF EVIDENCE ===
EOF

cat /tmp/compliance-evidence.txt
\`\`\``,
        verify: `\`\`\`bash
ls -la /tmp/compliance-evidence.txt
# Expected: file exists with content

cat /tmp/compliance-evidence.txt | grep "=== CONTROL:" | wc -l
# Expected: 4 (four control sections)

echo ""
echo "Compliance Key Takeaways:"
echo "1. CIS Benchmark maps directly to kubectl-verifiable settings"
echo "2. Multiple frameworks often require the same controls"
echo "3. Documentation is as important as technical controls for audits"
echo "4. Automation (kube-bench, Kubescape) saves time during assessments"

# Cleanup
kubectl delete job kube-bench 2>/dev/null || true
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'kube-bench reporting FAIL for audit logging',
      difficulty: 'medium',
      symptom: 'kube-bench output shows: "[FAIL] 1.2.20 Ensure that the --audit-log-path argument is set". The cluster has no audit logging configured.',
      diagnosis: `\`\`\`bash
# Check API server flags for audit configuration
kubectl get pod -n kube-system -l component=kube-apiserver \\
  -o jsonpath='{.items[0].spec.containers[0].command}' | tr ',' '\n' | grep audit

# Check if audit log path flag exists
# Expected: empty = not configured (FAIL)

# Check the API server manifest (on control plane node)
# grep -i audit /etc/kubernetes/manifests/kube-apiserver.yaml
\`\`\``,
      solution: `Add audit logging to the kube-apiserver manifest (on control plane node):

1. Create audit policy:
\`\`\`bash
cat <<EOF > /etc/kubernetes/audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata
    omitStages:
      - RequestReceived
  - level: RequestResponse
    resources:
    - group: ""
      resources: ["secrets"]
EOF
\`\`\`

2. Add flags to kube-apiserver.yaml:
\`\`\`yaml
command:
  - kube-apiserver
  - --audit-log-path=/var/log/kubernetes/audit.log
  - --audit-policy-file=/etc/kubernetes/audit-policy.yaml
  - --audit-log-maxage=30
  - --audit-log-maxbackup=10
  - --audit-log-maxsize=100
\`\`\`

3. Mount the log directory and policy file in volumes:
\`\`\`yaml
volumeMounts:
  - mountPath: /var/log/kubernetes
    name: audit-log
  - mountPath: /etc/kubernetes/audit-policy.yaml
    name: audit-policy
    readOnly: true
volumes:
  - hostPath:
      path: /var/log/kubernetes
    name: audit-log
  - hostPath:
      path: /etc/kubernetes/audit-policy.yaml
      type: File
    name: audit-policy
\`\`\`

4. Verify after restart:
\`\`\`bash
ls /var/log/kubernetes/audit.log && echo "Audit logging active"
\`\`\``
    },
    {
      title: 'Preparing for SOC 2 audit — evidence collection',
      difficulty: 'easy',
      symptom: 'An upcoming SOC 2 audit requires evidence of access control, audit logging, and encryption. Need to compile Kubernetes security evidence for auditors.',
      diagnosis: `\`\`\`bash
# What evidence do auditors typically need?
# 1. List of who has cluster access (users, SAs, bindings)
kubectl get clusterrolebindings -o wide
kubectl get rolebindings --all-namespaces -o wide

# 2. Evidence of audit logging
kubectl get pod -n kube-system -l component=kube-apiserver \\
  -o jsonpath='{.items[0].spec.containers[0].command}' | tr ',' '\n' | grep audit

# 3. Evidence of encryption
# Check API server for encryption-provider-config flag

# 4. Evidence of network controls
kubectl get networkpolicies --all-namespaces
\`\`\``,
      solution: `SOC 2 evidence compilation script:
\`\`\`bash
# Generate audit evidence
EVIDENCE_DIR="/tmp/soc2-evidence-$(date +%Y%m%d)"
mkdir -p $EVIDENCE_DIR

# 1. Access Control Evidence
kubectl get clusterrolebindings -o yaml > $EVIDENCE_DIR/cluster-role-bindings.yaml
kubectl get rolebindings --all-namespaces -o yaml > $EVIDENCE_DIR/role-bindings.yaml
kubectl get serviceaccounts --all-namespaces -o yaml > $EVIDENCE_DIR/service-accounts.yaml

# 2. Network Policy Evidence
kubectl get networkpolicies --all-namespaces -o yaml > $EVIDENCE_DIR/network-policies.yaml

# 3. Pod Security Evidence
kubectl get namespaces -o json | python3 -c "
import json, sys
ns = json.load(sys.stdin)
for n in ns['items']:
    labels = n.get('metadata', {}).get('labels', {})
    pss = {k:v for k,v in labels.items() if 'pod-security' in k}
    if pss:
        print(f'{n[\"metadata\"][\"name\"]}: {pss}')
" > $EVIDENCE_DIR/pod-security-standards.txt

# 4. CIS Benchmark Results
kubectl logs job/kube-bench 2>/dev/null > $EVIDENCE_DIR/cis-benchmark.txt || echo "Run kube-bench first"

echo "Evidence collected in: $EVIDENCE_DIR"
ls $EVIDENCE_DIR/
\`\`\``
    }
  ]
};
