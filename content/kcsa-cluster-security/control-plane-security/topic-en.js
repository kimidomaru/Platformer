window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcsa-cluster-security/control-plane-security'] = {
  theory: `# Control Plane Security

## Exam Relevance
> KCSA tests knowledge of securing Kubernetes control plane components. Expect questions about API server hardening, etcd security, authentication methods, and what happens when these are misconfigured.

## Control Plane Components

\`\`\`
kube-apiserver    ← entry point for all cluster operations
kube-scheduler    ← assigns pods to nodes
kube-controller-manager ← runs controllers (deployment, node, etc.)
etcd              ← key-value store for ALL cluster state
cloud-controller-manager ← (optional) cloud provider integration
\`\`\`

## API Server Security

The API server is the most critical component — all cluster operations go through it.

### Authentication Methods
\`\`\`
Client Certificate  ← most common for admin access (kubeconfig)
Bearer Token        ← ServiceAccount tokens, OIDC tokens
OIDC                ← enterprise SSO (Google, Azure AD, Okta)
Webhook Auth        ← external auth system
\`\`\`

### Critical API Server Flags

\`\`\`bash
# /etc/kubernetes/manifests/kube-apiserver.yaml

# Authentication
--anonymous-auth=false               # DISABLE anonymous auth
--client-ca-file=/etc/k8s/ca.crt    # certificate-based auth

# Authorization
--authorization-mode=Node,RBAC       # enable RBAC + Node authz

# Admission
--enable-admission-plugins=NodeRestriction,...

# Audit logging
--audit-log-path=/var/log/kubernetes/audit.log
--audit-policy-file=/etc/kubernetes/audit-policy.yaml

# Secure communications
--tls-cert-file=...
--tls-private-key-file=...
--kubelet-certificate-authority=...

# Other hardening
--profiling=false                    # disable profiling endpoint
--service-account-lookup=true        # verify SA tokens against etcd
\`\`\`

### What Anonymous Auth Enables (and Why It's Dangerous)
- \`--anonymous-auth=true\` allows unauthenticated requests
- These are assigned to: \`system:anonymous\` user, \`system:unauthenticated\` group
- If any RBAC binding grants permissions to these = open cluster!

### Audit Logging

Audit logs record every API request:
\`\`\`yaml
# /etc/kubernetes/audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  # Log secret access at RequestResponse level
  - level: RequestResponse
    resources:
    - group: ""
      resources: ["secrets"]
  # Log pod exec
  - level: RequestResponse
    verbs: ["create"]
    resources:
    - group: ""
      resources: ["pods/exec", "pods/portforward", "pods/proxy"]
  # Log everything else at Metadata level
  - level: Metadata
    omitStages:
      - "RequestReceived"
\`\`\`

**Audit levels:**
| Level | What's recorded |
|-------|----------------|
| None | Nothing |
| Metadata | Request metadata (user, resource, verb) — no body |
| Request | + request body |
| RequestResponse | + request AND response body |

## etcd Security

etcd stores ALL Kubernetes state, including Secrets. Its security is paramount.

### etcd Security Requirements
\`\`\`bash
# etcd flags
--cert-file=/etc/etcd/etcd.crt
--key-file=/etc/etcd/etcd.key
--client-cert-auth=true           # require client certs
--trusted-ca-file=/etc/etcd/ca.crt
--peer-cert-file=...              # for etcd cluster peers
--peer-client-cert-auth=true      # require certs for peer communication
\`\`\`

### Encryption at Rest for Secrets

\`\`\`yaml
# /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - aescbc:         # AES-CBC encryption
          keys:
            - name: key1
              secret: <base64-encoded-32-byte-key>
      - identity: {}    # fallback (plaintext) — put LAST
\`\`\`

\`\`\`bash
# Generate an encryption key
head -c 32 /dev/urandom | base64
\`\`\`

### Verifying etcd Encryption
\`\`\`bash
# Create a secret
kubectl create secret generic test --from-literal=password=secure

# Check directly in etcd (should NOT be plaintext after encryption)
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/healthcheck-client.crt \\
  --key=/etc/kubernetes/pki/etcd/healthcheck-client.key \\
  get /registry/secrets/default/test | hexdump -C | head -5
# Encrypted: shows k8s:enc:aescbc:v1: prefix
# NOT encrypted: shows recognizable plaintext
\`\`\`

## Controller Manager Security

\`\`\`bash
# Key flags
--use-service-account-credentials=true  # each controller uses its own SA
--service-account-private-key-file=...  # for SA token signing
--profiling=false                       # disable profiling
--bind-address=127.0.0.1               # only listen locally
\`\`\`

## Scheduler Security

\`\`\`bash
# Key flags
--profiling=false
--bind-address=127.0.0.1              # only listen locally, not on all interfaces
\`\`\`

## CIS Kubernetes Benchmark

The CIS (Center for Internet Security) Benchmark provides prescriptive security guidelines for Kubernetes. Key sections:

- **1.x API Server** — flags for auth, authz, audit, TLS
- **2.x etcd** — cert auth, encryption
- **3.x Controller Manager** — secure flags
- **4.x Scheduler** — secure flags
- **5.x Worker Nodes** — kubelet security

### kube-bench
\`\`\`bash
# Run CIS benchmark checks
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
kubectl logs job/kube-bench

# Output example:
# [PASS] 1.2.1 Ensure that the --anonymous-auth argument is set to false
# [FAIL] 1.2.6 Ensure that the --kubelet-certificate-authority argument is set
\`\`\`

## Common Control Plane Misconfigurations

| Misconfiguration | Risk | Fix |
|-----------------|------|-----|
| anonymous-auth=true | Unauthenticated access | Set to false |
| etcd without cert auth | Anyone can read all Secrets | Enable --client-cert-auth |
| No audit logging | No incident investigation trail | Enable audit policy |
| API server on 0.0.0.0 | Exposed to all interfaces | Restrict with firewall/allowlist |
| Unencrypted Secrets in etcd | Plaintext Secrets if etcd is accessed | Enable EncryptionConfiguration |
| Profiling endpoints enabled | Performance/info leak | Set --profiling=false |
| No admission controllers | Bypass policy enforcement | Enable NodeRestriction, + others |
`,
  quiz: [
    {
      question: 'What is the risk of setting --anonymous-auth=true on the Kubernetes API server?',
      options: [
        'Unauthenticated requests are allowed and assigned to system:anonymous — any RBAC binding for this user becomes a vulnerability',
        'Anonymous users get full cluster-admin access by default',
        'etcd becomes accessible without credentials',
        'Node communication bypasses TLS verification'
      ],
      correct: 0,
      explanation: 'With anonymous-auth=true, unauthenticated requests are treated as system:anonymous user. If any ClusterRoleBinding gives permissions to system:unauthenticated group, unauthorized users can access the cluster.',
      reference: 'Review "What Anonymous Auth Enables" section.'
    },
    {
      question: 'Which flag on the API server enables encryption of Secrets in etcd?',
      options: [
        '--encryption-provider-config pointing to an EncryptionConfiguration file',
        '--enable-admission-plugins=SecretEncryption',
        '--secret-encryption=aes256',
        '--etcd-secret-encryption=true'
      ],
      correct: 0,
      explanation: 'The --encryption-provider-config flag points to an EncryptionConfiguration YAML file that defines which resources to encrypt and with which provider (aescbc, secretbox, kms). Without this, Secrets are only base64-encoded in etcd.',
      reference: 'Review "Encryption at Rest for Secrets" section.'
    },
    {
      question: 'What does the audit level "RequestResponse" record?',
      options: [
        'Request metadata, request body, AND response body',
        'Only the user, resource, and verb (no bodies)',
        'Only failed requests',
        'Only requests from ServiceAccounts'
      ],
      correct: 0,
      explanation: 'RequestResponse is the highest audit level — records request metadata, the request body, AND the response body. Most verbose but provides complete audit trail. Use for high-sensitivity operations like secret access.',
      reference: 'Review "Audit levels" table.'
    },
    {
      question: 'What is kube-bench used for?',
      options: [
        'Running CIS Kubernetes Benchmark checks to identify security misconfigurations',
        'Benchmarking Kubernetes API server performance under load',
        'Testing network throughput between pods',
        'Scanning container images for CVE vulnerabilities'
      ],
      correct: 0,
      explanation: 'kube-bench is an open-source tool by Aqua Security that checks Kubernetes components against CIS Benchmark recommendations, outputting PASS/FAIL/WARN for each check.',
      reference: 'Review "kube-bench" section.'
    },
    {
      question: 'What is the correct authorization-mode flag for a production Kubernetes API server?',
      options: [
        '--authorization-mode=Node,RBAC',
        '--authorization-mode=AlwaysAllow',
        '--authorization-mode=ABAC',
        '--authorization-mode=Webhook'
      ],
      correct: 0,
      explanation: 'Node,RBAC is the recommended combination. Node authorization allows kubelets to access resources for their node. RBAC handles all other authorization. AlwaysAllow is dangerous (no authorization enforcement).',
      reference: 'Review "Critical API Server Flags" section.'
    },
    {
      question: 'How do you verify that etcd encryption at rest is working correctly?',
      options: [
        'Read the encrypted value directly from etcd with etcdctl and confirm it shows "k8s:enc:aescbc:" prefix',
        'Check kubectl get secrets -o yaml shows encrypted content',
        'Run kubectl encrypt --verify',
        'Check the API server logs for "encryption active" messages'
      ],
      correct: 0,
      explanation: 'Use etcdctl to read directly from etcd (bypassing the API server). Encrypted secrets show a binary prefix like "k8s:enc:aescbc:v1:". Plaintext secrets show recognizable text like "password".',
      reference: 'Review "Verifying etcd Encryption" section.'
    },
    {
      question: 'Why should --bind-address=127.0.0.1 be set for the controller manager and scheduler?',
      options: [
        'To prevent these components from accepting external connections — they should only be reachable locally',
        'To improve performance by using loopback interface',
        'To allow the API server to communicate with them on localhost',
        'To prevent conflict with other services on port 10252 and 10251'
      ],
      correct: 0,
      explanation: 'The controller manager and scheduler don\'t need to be reachable from outside the node. Binding to 127.0.0.1 prevents exposure to the network, reducing attack surface (CIS Benchmark recommendation).',
      reference: 'Review "Controller Manager Security" and "Scheduler Security" sections.'
    },
    {
      question: 'What does the --use-service-account-credentials flag do for the controller manager?',
      options: [
        'Each controller uses its own ServiceAccount credentials instead of sharing the controller manager\'s credentials',
        'Enables ServiceAccount token auto-creation for new Namespaces',
        'Uses the default ServiceAccount for all controller operations',
        'Enables webhook authentication for ServiceAccount tokens'
      ],
      correct: 0,
      explanation: 'With --use-service-account-credentials=true, each controller (deployment, node, job, etc.) uses its own ServiceAccount with limited permissions. This implements least privilege for controllers rather than sharing a single powerful identity.',
      reference: 'Review "Controller Manager Security" section.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 5 Kubernetes control plane components?',
      back: 'kube-apiserver (API entry point), kube-scheduler (assigns pods to nodes), kube-controller-manager (runs controllers), etcd (cluster state store), cloud-controller-manager (optional, cloud provider integration).'
    },
    {
      front: 'What authentication methods does the Kubernetes API server support?',
      back: 'Client certificates (X.509), Bearer tokens (ServiceAccount JWT), OIDC tokens (enterprise SSO), Webhook (external auth system), Bootstrap tokens (node join). Most common for admins: X.509 certificates in kubeconfig.'
    },
    {
      front: 'What flags are critical for API server hardening?',
      back: '--anonymous-auth=false, --authorization-mode=Node,RBAC, --audit-log-path=..., --audit-policy-file=..., --profiling=false, --service-account-lookup=true, --enable-admission-plugins=NodeRestriction,...'
    },
    {
      front: 'How do you enable encryption at rest for Kubernetes Secrets?',
      back: 'Create an EncryptionConfiguration YAML file with providers (aescbc, secretbox, kms). Add --encryption-provider-config=/path/to/file to the API server. Then re-create secrets to encrypt existing ones.'
    },
    {
      front: 'What are the 4 audit log levels?',
      back: 'None (no logging), Metadata (user/resource/verb only), Request (+ request body), RequestResponse (+ request AND response body). Use RequestResponse for secrets and exec. Use Metadata for most operations.'
    },
    {
      front: 'How do you check etcd certificate security?',
      back: 'etcdctl requires --cert, --key, --cacert flags to connect. If you can connect WITHOUT certs, etcd is open. Check: --client-cert-auth=true in etcd config, and firewall rules allowing only API server to port 2379.'
    }
  ],
  lab: {
    scenario: 'Audit a Kubernetes control plane for security misconfigurations and apply fixes. Practice etcd access verification and API server hardening.',
    objective: 'Identify and remediate common control plane security issues.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Audit API server security configuration',
        instruction: `On a kubeadm cluster, check the API server manifest for critical security flags. Identify which hardening flags are present and which are missing.`,
        hints: [
          'API server manifest: /etc/kubernetes/manifests/kube-apiserver.yaml',
          'Look for: --anonymous-auth, --authorization-mode, --audit-log-path, --profiling',
          'kubectl get pods -n kube-system | grep apiserver to verify it\'s running'
        ],
        solution: `\`\`\`bash
# Check API server is running
kubectl get pods -n kube-system -l component=kube-apiserver

# View current API server flags (if node access available)
# cat /etc/kubernetes/manifests/kube-apiserver.yaml | grep -E "anonymous|authorization|audit|profil"

# Alternative: check via the running process
kubectl exec -n kube-system $(kubectl get pods -n kube-system -l component=kube-apiserver -o name | head -1) \\
  -- kube-apiserver --help 2>&1 | grep -E "anonymous-auth|authorization-mode|audit-log" || \\
  echo "Direct exec not available — check manifest file on control plane node"

# Check effective security via RBAC
kubectl auth can-i list secrets --as=system:anonymous
# Should be: no (anonymous auth disabled or no permissions for anonymous)
\`\`\``,
        verify: `\`\`\`bash
# Test anonymous auth
kubectl auth can-i list pods --as=system:anonymous
# Expected: no (if properly hardened)

# Test that Node authorization mode is active
kubectl get nodes
# Expected: Nodes visible = Node authz is working

# Test that RBAC is active
kubectl auth can-i list secrets -n kube-system
# Expected: depends on your permissions, not "yes" for everyone
\`\`\``
      },
      {
        title: 'Verify etcd requires authentication',
        instruction: `Check if etcd requires certificate-based authentication. Attempt to connect without certificates to verify the protection is in place.`,
        hints: [
          'etcd is typically at https://127.0.0.1:2379',
          'Try: etcdctl --endpoints=http://127.0.0.1:2379 get / (without certs)',
          'Proper response: error (connection refused or auth required)'
        ],
        solution: `\`\`\`bash
# Check etcd service status
kubectl get pod -n kube-system -l component=etcd

# Try connecting without certs (should fail)
# This requires running on the control plane node:
# ETCDCTL_API=3 etcdctl --endpoints=http://127.0.0.1:2379 get / 2>&1
# Expected: connection refused or authentication error

# Show how to connect WITH certs (proper authenticated access)
kubectl get pod -n kube-system -l component=etcd -o jsonpath='{.items[0].spec.containers[0].command}' | tr ',' '\\n' | grep -E "cert|key|ca|endpoints"
\`\`\``,
        verify: `\`\`\`bash
# Check etcd configuration from pod spec
kubectl get pod -n kube-system $(kubectl get pods -n kube-system -l component=etcd -o name | head -1 | cut -d/ -f2) \\
  -o jsonpath='{.spec.containers[0].command}' 2>/dev/null | tr ',' '\\n' | grep -E "client-cert-auth|cert-file|key-file"
# Expected: shows cert-related flags

# Verify etcd is not accessible without auth from inside the cluster
kubectl run etcd-test --image=curlimages/curl --rm -it --restart=Never \\
  -- curl -sk --connect-timeout 3 http://10.96.0.1:2379/ 2>&1 || echo "etcd not accessible (expected)"
\`\`\``
      },
      {
        title: 'Create and test an audit policy',
        instruction: `Create an audit policy that logs Secret access at RequestResponse level and all other events at Metadata level. Understand how audit logs help in security investigation.`,
        hints: [
          'Audit policy is a YAML file referenced by --audit-policy-file on the API server',
          'In a lab, you can show the policy file structure',
          'Test by creating a secret and observing what would be logged'
        ],
        solution: `\`\`\`bash
# Create a sample audit policy
cat <<EOF > /tmp/audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  # Do not log read-only URL paths
  - level: None
    nonResourceURLs:
      - /healthz
      - /readyz
      - /livez
      - /metrics

  # Log secret access at RequestResponse
  - level: RequestResponse
    resources:
    - group: ""
      resources: ["secrets"]

  # Log pod exec at RequestResponse
  - level: RequestResponse
    verbs: ["create"]
    resources:
    - group: ""
      resources: ["pods/exec", "pods/portforward"]

  # Log everything else at Metadata
  - level: Metadata
    omitStages:
      - RequestReceived
EOF

cat /tmp/audit-policy.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify the policy YAML is valid
cat /tmp/audit-policy.yaml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin); print('Valid YAML')"

# Check if audit logging is already configured on the API server
kubectl get pod -n kube-system $(kubectl get pods -n kube-system -l component=kube-apiserver -o name | head -1 | cut -d/ -f2) \\
  -o jsonpath='{.spec.containers[0].command}' 2>/dev/null | tr ',' '\\n' | grep audit || echo "No audit config found in API server pod"

# Simulate what would be logged: create a secret (would generate RequestResponse log)
kubectl create secret generic audit-test --from-literal=key=value
kubectl delete secret audit-test
echo "In a cluster with audit logging, both operations would be logged at RequestResponse level"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'API server not starting after enabling encryption config',
      difficulty: 'hard',
      symptom: 'After adding --encryption-provider-config to the API server manifest, the kube-apiserver pod fails to start. kubectl commands return "connection refused".',
      diagnosis: `\`\`\`bash
# Check kubelet logs for static pod errors (on control plane node)
journalctl -u kubelet --no-pager | tail -30

# Check if the file is referenced correctly
cat /etc/kubernetes/manifests/kube-apiserver.yaml | grep encryption

# Verify the encryption config file exists and is valid YAML
cat /etc/kubernetes/encryption-config.yaml

# Check volume mounts — the config file must be mounted into the container
grep -A5 "volumeMounts\|volumes" /etc/kubernetes/manifests/kube-apiserver.yaml
\`\`\``,
      solution: `Common issues:

1. **File not mounted into container**: The encryption config file must be available inside the API server container:
\`\`\`yaml
# In kube-apiserver.yaml, add:
volumeMounts:
- mountPath: /etc/kubernetes/encryption-config.yaml
  name: encryption-config
  readOnly: true

volumes:
- hostPath:
    path: /etc/kubernetes/encryption-config.yaml
    type: File
  name: encryption-config
\`\`\`

2. **Invalid base64 key**: The encryption key must be exactly 32 bytes, base64-encoded:
\`\`\`bash
head -c 32 /dev/urandom | base64  # generates valid key
echo -n "mykey" | base64           # this is wrong — not 32 bytes!
\`\`\`

3. **providers list must end with identity**: Or secrets created before encryption are unreadable:
\`\`\`yaml
providers:
  - aescbc:
      keys:
        - name: key1
          secret: <key>
  - identity: {}   # MUST be last for backward compatibility
\`\`\``
    },
    {
      title: 'etcd accessible without authentication',
      difficulty: 'medium',
      symptom: 'Security scan finds etcd is accessible via HTTP (not HTTPS) or without client certificate requirement. Anyone on the network can read all cluster secrets.',
      diagnosis: `\`\`\`bash
# Check etcd flags on the etcd manifest
cat /etc/kubernetes/manifests/etcd.yaml | grep -E "client-cert-auth|cert-file|key-file|trusted-ca|listen-client"

# Try connecting without certs (on control plane node)
ETCDCTL_API=3 etcdctl --endpoints=http://127.0.0.1:2379 endpoint health 2>&1
# If this SUCCEEDS, etcd is open!
\`\`\``,
      solution: `Add certificate authentication flags to etcd:
\`\`\`yaml
# /etc/kubernetes/manifests/etcd.yaml
command:
  - etcd
  - --cert-file=/etc/kubernetes/pki/etcd/server.crt
  - --key-file=/etc/kubernetes/pki/etcd/server.key
  - --client-cert-auth=true
  - --trusted-ca-file=/etc/kubernetes/pki/etcd/ca.crt
  - --listen-client-urls=https://127.0.0.1:2379  # NOT http://0.0.0.0
  - --advertise-client-urls=https://127.0.0.1:2379
\`\`\`

After update: etcd pod restarts automatically (static pod). Verify:
\`\`\`bash
# Connection without certs should now fail
ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 endpoint health 2>&1
# Expected: Error: dial tcp: ... TLS handshake failure (certs required)

# Connection with proper certs should work
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/healthcheck-client.crt \\
  --key=/etc/kubernetes/pki/etcd/healthcheck-client.key \\
  endpoint health
\`\`\``
    }
  ]
};
