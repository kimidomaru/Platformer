window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-cluster-setup/cis-benchmarks'] = {
  theory: `# CIS Kubernetes Benchmark

## Exam Relevance
> CIS Benchmarks are a core CKS topic — expect to run kube-bench, interpret its output, and manually fix failing controls. Covers ~15% of the CKS exam (Cluster Setup domain).

## What is the CIS Kubernetes Benchmark?

The **Center for Internet Security (CIS) Kubernetes Benchmark** is a set of prescriptive configuration recommendations for securing Kubernetes clusters. Each recommendation is classified as:

- **Level 1** — Practical, will not degrade functionality, should be applied universally
- **Level 2** — Defense in depth, may impact functionality, for security-sensitive environments

## Benchmark Structure

| Section | Topic |
|---------|-------|
| 1 | Control Plane Components |
| 1.1 | Master Node Configuration Files |
| 1.2 | API Server |
| 1.3 | Controller Manager |
| 1.4 | Scheduler |
| 2 | Etcd |
| 3 | Control Plane Configuration |
| 3.1 | Authentication and Authorization |
| 3.2 | Logging |
| 4 | Worker Nodes |
| 4.1 | Worker Node Configuration Files |
| 4.2 | Kubelet |
| 5 | Policies |
| 5.1 | RBAC and Service Accounts |
| 5.2 | Pod Security Standards |
| 5.3 | Network Policies |
| 5.4 | Secrets Management |
| 5.5 | Extensible Admission Control |
| 5.7 | General Policies |

## kube-bench

**kube-bench** is the primary tool for automated CIS Benchmark assessment. It reads the benchmark checks from YAML config files and runs them against a live cluster.

### Installation & Usage

\`\`\`bash
# Run as a Job in-cluster (recommended)
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml

# Check results
kubectl logs job/kube-bench

# Run locally on a control plane node
kube-bench run --targets master
kube-bench run --targets node
kube-bench run --targets etcd
kube-bench run --targets policies

# Specify benchmark version
kube-bench run --version 1.23
kube-bench run --benchmark cis-1.8
\`\`\`

### Output Format

\`\`\`
[INFO] 1 Control Plane Security Configuration
[INFO] 1.2 API Server
[PASS] 1.2.1 Ensure that the --anonymous-auth argument is set to false
[FAIL] 1.2.6 Ensure that the --kubelet-certificate-authority argument is set
[WARN] 1.2.11 Ensure that the admission control plugin AlwaysPullImages is set
[INFO] == Remediations master ==
1.2.6 Edit the API server pod specification file /etc/kubernetes/manifests/kube-apiserver.yaml
      and set the below parameter:
      --kubelet-certificate-authority=<path/to/ca-file>
== Summary master ==
42 checks PASS
9 checks FAIL
11 checks WARN
0 checks INFO
\`\`\`

## Critical CIS Controls to Know

### API Server (Section 1.2)

\`\`\`yaml
# /etc/kubernetes/manifests/kube-apiserver.yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --anonymous-auth=false                           # 1.2.1
    - --token-auth-file                                # must NOT exist — 1.2.2
    - --kubelet-https=true                             # 1.2.4
    - --kubelet-client-certificate=/etc/kubernetes/pki/apiserver-kubelet-client.crt  # 1.2.5
    - --kubelet-client-key=/etc/kubernetes/pki/apiserver-kubelet-client.key          # 1.2.5
    - --kubelet-certificate-authority=/etc/kubernetes/pki/ca.crt                     # 1.2.6
    - --authorization-mode=Node,RBAC                   # 1.2.7
    - --enable-admission-plugins=NodeRestriction,...   # 1.2.10
    - --audit-log-path=/var/log/apiserver/audit.log    # 1.2.19
    - --audit-log-maxage=30                            # 1.2.20
    - --audit-log-maxbackup=10                         # 1.2.21
    - --audit-log-maxsize=100                          # 1.2.22
    - --request-timeout=300s                           # 1.2.23
    - --service-account-lookup=true                    # 1.2.24
    - --service-account-key-file=/etc/kubernetes/pki/sa.pub  # 1.2.25
    - --etcd-cafile=/etc/kubernetes/pki/etcd/ca.crt    # 1.2.29
    - --etcd-certfile=/etc/kubernetes/pki/apiserver-etcd-client.crt  # 1.2.29
    - --etcd-keyfile=/etc/kubernetes/pki/apiserver-etcd-client.key   # 1.2.29
    - --tls-cert-file=/etc/kubernetes/pki/apiserver.crt  # 1.2.30
    - --tls-private-key-file=/etc/kubernetes/pki/apiserver.key       # 1.2.30
    - --client-ca-file=/etc/kubernetes/pki/ca.crt      # 1.2.31
    - --profiling=false                                # 1.2.17
\`\`\`

### Controller Manager (Section 1.3)

\`\`\`yaml
- --profiling=false                           # 1.3.2
- --use-service-account-credentials=true      # 1.3.3
- --service-account-private-key-file=...      # 1.3.4
- --root-ca-file=...                          # 1.3.5
- --bind-address=127.0.0.1                    # 1.3.7
\`\`\`

### Scheduler (Section 1.4)

\`\`\`yaml
- --profiling=false    # 1.4.1
- --bind-address=127.0.0.1  # 1.4.2
\`\`\`

### Etcd (Section 2)

\`\`\`yaml
- --cert-file=/etc/kubernetes/pki/etcd/server.crt  # 2.1
- --key-file=/etc/kubernetes/pki/etcd/server.key   # 2.1
- --client-cert-auth=true                          # 2.2
- --auto-tls=false                                 # 2.3
- --peer-cert-file=...                             # 2.4
- --peer-key-file=...                              # 2.4
- --peer-client-cert-auth=true                     # 2.5
- --peer-auto-tls=false                            # 2.6
- --trusted-ca-file=...                            # 2.7
\`\`\`

### Kubelet (Section 4.2)

\`\`\`yaml
# /var/lib/kubelet/config.yaml
authentication:
  anonymous:
    enabled: false           # 4.2.1
  webhook:
    enabled: true            # 4.2.2
  x509:
    clientCAFile: /etc/kubernetes/pki/ca.crt
authorization:
  mode: Webhook              # 4.2.2
readOnlyPort: 0              # 4.2.4
protectKernelDefaults: true  # 4.2.6
streamingConnectionIdleTimeout: 4h  # 4.2.5 (not 0)
eventRecordQPS: 5            # 4.2.9 (not 0)
rotateCertificates: true     # 4.2.11
\`\`\`

### File Permissions (Section 1.1 & 4.1)

\`\`\`bash
# Check control plane file permissions
stat -c "%a %U:%G" /etc/kubernetes/manifests/kube-apiserver.yaml
# Should be 644 root:root

stat -c "%a %U:%G" /etc/kubernetes/pki/apiserver.key
# Should be 600 root:root

# Fix permissions
chmod 644 /etc/kubernetes/manifests/kube-apiserver.yaml
chmod 600 /etc/kubernetes/pki/*.key
chown root:root /etc/kubernetes/manifests/kube-apiserver.yaml

# Worker node kubelet config
stat -c "%a %U:%G" /var/lib/kubelet/config.yaml
# Should be 644 root:root

stat -c "%a %U:%G" /etc/kubernetes/kubelet.conf
# Should be 644 root:root
\`\`\`

## Policies Section (Section 5)

### RBAC Best Practices (5.1)
- Do not use wildcard permissions
- Minimize ServiceAccount token automounting
- Use dedicated service accounts per workload
- Avoid cluster-admin ClusterRoleBindings for users/service accounts

### Network Policies (5.3)
Every namespace should have a default deny policy:
\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
\`\`\`

### Secrets (5.4)
- Prefer external secrets management (Vault, ESO)
- Enable etcd encryption at rest
- Never store secrets in environment variables if avoidable (prefer volume mounts)

## Fixing Failed Controls

### Workflow for CKS Exam

1. Run kube-bench to identify failures
2. Read the **Remediation** section in the output
3. Edit the appropriate manifest or config file
4. Wait for the static pod to restart (for control plane)
5. Verify the fix

\`\`\`bash
# After editing /etc/kubernetes/manifests/kube-apiserver.yaml
# The kubelet detects the change and restarts the pod automatically
# Watch the restart:
watch kubectl get pods -n kube-system

# Verify a flag is set
kubectl get pods -n kube-system kube-apiserver-<node> -o yaml | grep -A1 "profiling"

# Verify kubelet config
ssh <node> "sudo cat /var/lib/kubelet/config.yaml | grep anonymous"
\`\`\`

## Common Mistakes

- **Editing wrong file**: kube-bench shows the exact file path — use it
- **Not waiting for restart**: Static pods take 10-30 seconds to restart after manifest changes
- **Breaking the API server**: Always verify the API server comes back up after changes
- **Confusing level 1 vs level 2**: The exam focuses on Level 1 (required); Level 2 is optional
- **Ignoring WARN**: WARN means "check manually" — may still need action

## Killer.sh Style Challenge

> **Scenario**: kube-bench reports FAIL for check 1.2.1 (anonymous-auth), 1.3.2 (controller-manager profiling), and 4.2.1 (kubelet anonymous auth). Fix all three.

**Solution approach:**
1. Edit \`/etc/kubernetes/manifests/kube-apiserver.yaml\` → add \`--anonymous-auth=false\`
2. Edit \`/etc/kubernetes/manifests/kube-controller-manager.yaml\` → add \`--profiling=false\`
3. SSH to the worker node → edit \`/var/lib/kubelet/config.yaml\` → set \`authentication.anonymous.enabled: false\` → \`systemctl restart kubelet\`
`,

  quiz: [
    {
      question: 'What does kube-bench do?',
      options: [
        'Runs CIS Kubernetes Benchmark checks against a live cluster',
        'Benchmarks Kubernetes API server performance',
        'Scans container images for vulnerabilities',
        'Validates Kubernetes YAML manifests for syntax errors'
      ],
      correct: 0,
      explanation: 'kube-bench is an open-source tool by Aqua Security that implements the CIS Kubernetes Benchmark checks, running automated tests against cluster components and reporting PASS/FAIL/WARN results.',
      reference: 'CIS Benchmarks — see kube-bench usage section.'
    },
    {
      question: 'Which kube-bench output status means "check manually — may need action"?',
      options: ['INFO', 'WARN', 'SKIP', 'MANUAL'],
      correct: 1,
      explanation: 'WARN means the check cannot be automatically verified and requires manual inspection. It does NOT mean the check passed — it means human review is needed.',
      reference: 'CIS Benchmarks — kube-bench output format section.'
    },
    {
      question: 'A CIS check fails because the API server is missing --profiling=false. Which file do you edit?',
      options: [
        '/etc/kubernetes/manifests/kube-apiserver.yaml',
        '/etc/kubernetes/apiserver.conf',
        '/var/lib/kubelet/config.yaml',
        '/etc/systemd/system/kube-apiserver.service'
      ],
      correct: 0,
      explanation: 'The API server runs as a static pod. Its configuration is in /etc/kubernetes/manifests/kube-apiserver.yaml. Editing this file causes the kubelet to automatically restart the API server static pod.',
      reference: 'CIS Benchmarks — API Server section (1.2).'
    },
    {
      question: 'CIS check 4.2.1 requires kubelet anonymous authentication to be disabled. Which file and field controls this?',
      options: [
        '/var/lib/kubelet/config.yaml → authentication.anonymous.enabled: false',
        '/etc/kubernetes/manifests/kube-apiserver.yaml → --anonymous-auth=false',
        '/etc/kubernetes/kubelet.conf → anonymousAuth: false',
        '/etc/systemd/system/kubelet.service → --anonymous-auth=false'
      ],
      correct: 0,
      explanation: 'The kubelet configuration file at /var/lib/kubelet/config.yaml has the authentication.anonymous.enabled field. After changing it, systemctl restart kubelet is required to apply.',
      reference: 'CIS Benchmarks — Kubelet section (4.2).'
    },
    {
      question: 'What is the recommended way to run kube-bench against a production cluster?',
      options: [
        'As a Kubernetes Job (kubectl apply -f job.yaml)',
        'SSH to the master node and run kube-bench directly',
        'Run it from a developer workstation with kubeconfig',
        'Use helm install kube-bench'
      ],
      correct: 0,
      explanation: 'Running kube-bench as a Kubernetes Job is recommended for production because it runs inside the cluster with proper access to node files through hostPath mounts, and the results are captured in pod logs.',
      reference: 'CIS Benchmarks — kube-bench installation section.'
    },
    {
      question: 'CIS check 1.2.2 says "--token-auth-file must NOT exist". What is the risk of token auth files?',
      options: [
        'Static tokens never expire and cannot be revoked without restarting the API server',
        'Token files use weak SHA1 hashing',
        'Token files are readable by all pods in the cluster',
        'Token files do not support TLS encryption'
      ],
      correct: 0,
      explanation: 'Static token authentication files (--token-auth-file) are a security risk because tokens never expire and revocation requires a full API server restart. RBAC + ServiceAccount tokens or OIDC are preferred.',
      reference: 'CIS Benchmarks — API Server authentication section.'
    },
    {
      question: 'After editing /etc/kubernetes/manifests/kube-apiserver.yaml, how long should you wait before verifying the change?',
      options: [
        '10-60 seconds for the kubelet to detect and restart the static pod',
        'You must manually run systemctl restart kube-apiserver',
        'The change takes effect immediately with no restart needed',
        '5 minutes for the kube-controller-manager to sync the change'
      ],
      correct: 0,
      explanation: 'Static pods are managed by the kubelet, which polls for manifest changes. After editing, the kubelet typically detects the change within seconds and restarts the pod. Watch with: watch kubectl get pods -n kube-system.',
      reference: 'CIS Benchmarks — Fixing Failed Controls section.'
    },
    {
      question: 'What CIS level should ALL Kubernetes clusters implement at minimum?',
      options: [
        'Level 1 — practical controls that do not degrade functionality',
        'Level 2 — defense in depth controls for all environments',
        'Level 0 — baseline logging only',
        'Level 3 — NSA hardening guidelines'
      ],
      correct: 0,
      explanation: 'CIS Level 1 controls are the mandatory baseline. They are practical, cannot degrade normal cluster functionality, and should be applied universally. Level 2 is additional hardening for security-sensitive environments.',
      reference: 'CIS Benchmarks — Benchmark Structure section.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 5 sections of the CIS Kubernetes Benchmark?',
      back: '1. Control Plane Components (API server, controller-manager, scheduler)\n2. Etcd\n3. Control Plane Configuration (auth, logging)\n4. Worker Nodes (config files, kubelet)\n5. Policies (RBAC, PSS, NetworkPolicies, Secrets, Admission Control)'
    },
    {
      front: 'What do PASS, FAIL, and WARN mean in kube-bench output?',
      back: 'PASS: control is correctly configured\nFAIL: control is misconfigured and needs remediation\nWARN: cannot be automatically tested — requires manual review (may still need action)\nINFO: informational message, no action required'
    },
    {
      front: 'How do you run kube-bench only against the API server checks?',
      back: 'kube-bench run --targets master\n\nOr more specifically, for just API server:\nkube-bench run --check 1.2\n\nFor worker nodes: kube-bench run --targets node\nFor etcd: kube-bench run --targets etcd'
    },
    {
      front: 'What is the required file permission for kube-apiserver.yaml per CIS?',
      back: 'Permissions: 644 (or more restrictive)\nOwner: root:root\n\nCheck: stat -c "%a %U:%G" /etc/kubernetes/manifests/kube-apiserver.yaml\nFix: chmod 644 /etc/kubernetes/manifests/kube-apiserver.yaml && chown root:root /etc/kubernetes/manifests/kube-apiserver.yaml'
    },
    {
      front: 'Which kubelet fields disable anonymous auth and enable webhook authorization (CIS 4.2.1, 4.2.2)?',
      back: '# /var/lib/kubelet/config.yaml\nauthentication:\n  anonymous:\n    enabled: false    # 4.2.1\n  webhook:\n    enabled: true\nauthorization:\n  mode: Webhook       # 4.2.2\n\nAfter change: systemctl restart kubelet'
    },
    {
      front: 'What does CIS check 1.2.7 require for --authorization-mode?',
      back: 'Must include both Node and RBAC:\n--authorization-mode=Node,RBAC\n\nNOT: AlwaysAllow (denies nothing)\nNOT: ABAC (deprecated, hard to manage)\nNode authorizer restricts kubelet permissions\nRBAC provides fine-grained access control'
    },
    {
      front: 'What does --service-account-lookup=true do (CIS 1.2.24)?',
      back: 'Forces the API server to validate that a ServiceAccount token exists in etcd before accepting it. Without this, deleted ServiceAccount tokens can still be used until expiry.\n\nDefault in modern K8s: true\nCIS requires it explicitly set to true'
    },
    {
      front: 'What audit flags does CIS require on the API server (1.2.19-1.2.22)?',
      back: '--audit-log-path=/var/log/audit.log   (1.2.19 — must be set)\n--audit-log-maxage=30                  (1.2.20 — days to retain)\n--audit-log-maxbackup=10               (1.2.21 — number of backups)\n--audit-log-maxsize=100                (1.2.22 — MB per file)'
    }
  ],

  lab: {
    scenario: 'You have access to a Kubernetes cluster where kube-bench has identified multiple CIS benchmark failures. Your task is to run kube-bench, identify the failing controls, and fix them.',
    objective: 'Run CIS Benchmark assessment with kube-bench and remediate at least 3 failing controls on a control-plane node.',
    duration: '25-35 minutes',
    steps: [
      {
        title: 'Run kube-bench as a Kubernetes Job',
        instruction: `Deploy kube-bench as a Job and examine its output to identify failing controls.

\`\`\`bash
# Apply the kube-bench job manifest
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml

# Wait for completion
kubectl wait --for=condition=complete job/kube-bench --timeout=120s

# View results
kubectl logs job/kube-bench | head -100
\`\`\``,
        hints: [
          'If you cannot reach the internet, run kube-bench directly on the control-plane node: ssh <node> "kube-bench run --targets master"',
          'Look for [FAIL] lines — these are the controls you need to fix',
          'Each FAIL has a Remediation section that tells you exactly what to change'
        ],
        solution: `\`\`\`bash
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
kubectl wait --for=condition=complete job/kube-bench --timeout=120s
kubectl logs job/kube-bench | grep -E "\\[FAIL\\]|\\[PASS\\]|== Summary"
\`\`\``,
        verify: `\`\`\`bash
# Job should be in Completed state
kubectl get job kube-bench
# Expected: COMPLETIONS: 1/1

# Should see FAIL entries
kubectl logs job/kube-bench | grep -c "\\[FAIL\\]"
# Expected: > 0 (some number of failures)
\`\`\``
      },
      {
        title: 'Fix API Server profiling (CIS 1.2.17)',
        instruction: `The CIS benchmark requires --profiling=false on the API server. Edit the static pod manifest to fix this.

\`\`\`bash
# SSH to control plane node (adjust node name)
# Edit the API server manifest
sudo vi /etc/kubernetes/manifests/kube-apiserver.yaml

# Add this line in the command section:
# - --profiling=false

# Save and exit — kubelet will restart the pod automatically
\`\`\``,
        hints: [
          'Look for other --profiling flags already in the file as a pattern for where to add it',
          'The command section lists all flags starting with --, add the new flag in alphabetical order',
          'After saving, watch: kubectl get pods -n kube-system | grep apiserver'
        ],
        solution: `\`\`\`bash
# On the control-plane node:
# Edit /etc/kubernetes/manifests/kube-apiserver.yaml
# In the spec.containers[0].command array, add:
# - --profiling=false

# Monitor restart
watch kubectl get pods -n kube-system

# Verify the flag is active
kubectl get pod -n kube-system kube-apiserver-$(hostname) -o yaml | grep profiling
\`\`\``,
        verify: `\`\`\`bash
# Verify pod is Running
kubectl get pods -n kube-system | grep apiserver
# Expected: kube-apiserver-<node>   1/1   Running   1   <time>

# Verify flag is present
kubectl get pod -n kube-system -l component=kube-apiserver -o yaml | grep "profiling"
# Expected: - --profiling=false
\`\`\``
      },
      {
        title: 'Fix Kubelet Anonymous Authentication (CIS 4.2.1)',
        instruction: `The kubelet should not allow anonymous authentication. Edit the kubelet config to disable it.

\`\`\`bash
# SSH to a worker node
# Edit kubelet configuration
sudo vi /var/lib/kubelet/config.yaml

# Ensure this section exists:
# authentication:
#   anonymous:
#     enabled: false
#   webhook:
#     enabled: true
# authorization:
#   mode: Webhook

# Restart kubelet
sudo systemctl restart kubelet
sudo systemctl status kubelet
\`\`\``,
        hints: [
          'The kubelet config is NOT a static pod manifest — changes require systemctl restart kubelet',
          'Check if anonymous is already disabled: grep -A3 "anonymous" /var/lib/kubelet/config.yaml',
          'After restart, give it 10 seconds then check: kubectl get node — it should still show Ready'
        ],
        solution: `\`\`\`bash
# On the worker node:
# Check current state
cat /var/lib/kubelet/config.yaml | grep -A5 authentication

# Edit to add/modify:
# authentication:
#   anonymous:
#     enabled: false

sudo systemctl restart kubelet
sudo systemctl is-active kubelet
\`\`\``,
        verify: `\`\`\`bash
# On worker node:
grep -A3 "anonymous" /var/lib/kubelet/config.yaml
# Expected:
# anonymous:
#   enabled: false

# Node should still be Ready
kubectl get nodes
# Expected: <worker-node>   Ready   ...

# Verify anonymous auth is rejected (should return 401)
# On worker node:
curl -sk https://localhost:10250/pods
# Expected: Unauthorized (401)
\`\`\``
      },
      {
        title: 'Verify fixes with kube-bench re-run',
        instruction: `Run kube-bench again to confirm the fixes resolved the failing controls.

\`\`\`bash
# Delete the previous job
kubectl delete job kube-bench

# Re-run
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
kubectl wait --for=condition=complete job/kube-bench --timeout=120s

# Check the specific controls you fixed
kubectl logs job/kube-bench | grep -E "1.2.17|4.2.1|4.2.2"
\`\`\``,
        hints: [
          'You can also use: kubectl logs job/kube-bench | grep FAIL | wc -l to compare failure counts',
          'Some controls require changes on all worker nodes — fix all nodes for a complete remediation'
        ],
        solution: `\`\`\`bash
kubectl delete job kube-bench
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
kubectl wait --for=condition=complete job/kube-bench --timeout=120s
kubectl logs job/kube-bench | grep -E "\\[PASS\\].*1.2.17|\\[PASS\\].*4.2.1"
\`\`\``,
        verify: `\`\`\`bash
kubectl logs job/kube-bench | grep "1.2.17"
# Expected: [PASS] 1.2.17 Ensure that the --profiling argument is set to false

kubectl logs job/kube-bench | grep "4.2.1"
# Expected: [PASS] 4.2.1 Ensure that the --anonymous-auth argument is set to false
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'API Server fails to restart after CIS remediation',
      difficulty: 'medium',
      symptom: 'After editing /etc/kubernetes/manifests/kube-apiserver.yaml, kubectl commands return "connection refused" and the API server pod is not running.',
      diagnosis: `\`\`\`bash
# Check if the static pod container is crashing
sudo crictl ps -a | grep apiserver

# Check kubelet logs for errors
sudo journalctl -u kubelet -n 50 | grep -i "apiserver\\|error\\|fail"

# Check the manifest for syntax errors
sudo python3 -c "import yaml; yaml.safe_load(open('/etc/kubernetes/manifests/kube-apiserver.yaml'))" 2>&1

# Look at the pod log directly
sudo crictl logs $(sudo crictl ps -a | grep apiserver | awk '{print $1}')
\`\`\``,
      solution: `**Most common causes:**

1. **YAML indentation error** — the most frequent issue
   - Open the file and check indentation carefully
   - All \`- --flag=value\` entries must be at the same indent level
   - Use: sudo python3 -c "import yaml; yaml.safe_load(open('/etc/kubernetes/manifests/kube-apiserver.yaml'))"

2. **Invalid flag value** — e.g., typo in the flag name
   - Compare your addition with existing flags in the file
   - Check kube-bench remediation text for exact flag syntax

3. **Conflicting flags** — duplicate or conflicting authorization modes
   - Run: grep "authorization-mode" /etc/kubernetes/manifests/kube-apiserver.yaml
   - Should appear only once

**Recovery:**
If you have a backup:
\`\`\`bash
sudo cp /etc/kubernetes/manifests/kube-apiserver.yaml.bak /etc/kubernetes/manifests/kube-apiserver.yaml
\`\`\`

If no backup, restore from original:
\`\`\`bash
# On kubeadm clusters, you can re-generate manifests
kubeadm init phase control-plane apiserver --config=/etc/kubernetes/kubeadm-config.yaml
\`\`\``
    },
    {
      title: 'kube-bench WARN for controls that appear correctly configured',
      difficulty: 'easy',
      symptom: 'kube-bench shows WARN for check 1.2.11 (AlwaysPullImages) even though you believe the cluster is correctly configured for your environment.',
      diagnosis: `\`\`\`bash
# Check what WARN means for this control
kubectl logs job/kube-bench | grep -A5 "1.2.11"

# Check current admission plugins
kubectl get pod -n kube-system kube-apiserver-$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}') -o yaml | grep "enable-admission"

# Read the full remediation text
kubectl logs job/kube-bench | grep -A10 "Remediations"
\`\`\``,
      solution: `**Understanding WARN status:**

WARN does NOT mean the control failed. It means kube-bench cannot automatically determine if the configuration is correct for your environment. The check requires a human decision.

**For AlwaysPullImages (1.2.11):**
- This admission plugin ensures images are always pulled from the registry, preventing use of cached images from other containers
- CIS recommends it but notes it increases load and requires registry availability
- Decision: Enable it if you need to ensure latest images are always used, skip if registry availability is a concern

**Resolution options:**
1. **Accept the WARN** — document why it's intentionally not configured
2. **Enable the plugin** — add to --enable-admission-plugins if you want this control
3. **Acknowledge in audit** — note WARN controls in your compliance report

For CKS exam: WARN controls typically don't need remediation unless explicitly asked. Focus on FAIL controls first.`
    }
  ]
};
