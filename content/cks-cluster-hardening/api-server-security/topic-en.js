window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-cluster-hardening/api-server-security'] = {
  theory: `# API Server Security (Advanced)

## Exam Relevance
> The API server is the single entry point to the cluster. CKS expects you to harden it beyond basics — audit logging, anonymous auth, admission plugins, TLS configuration, and more. High-priority topic, ~15% of CKS Cluster Hardening domain.

## API Server as Attack Surface

The Kubernetes API server (\`kube-apiserver\`) is the most critical security boundary in a cluster. All cluster state flows through it. Compromise = cluster compromise.

**Attack vectors:**
- Anonymous access (\`--anonymous-auth=true\`)
- Weak authorization mode (\`--authorization-mode=AlwaysAllow\`)
- Exposed profiling endpoint (\`--profiling=true\`)
- Misconfigured audit logging
- Etcd without mutual TLS
- Missing admission controllers

## Authentication Configuration

\`\`\`yaml
# /etc/kubernetes/manifests/kube-apiserver.yaml
- --anonymous-auth=false                    # DISABLE anonymous access
- --client-ca-file=/etc/kubernetes/pki/ca.crt  # X.509 client cert auth

# For OIDC (production):
- --oidc-issuer-url=https://accounts.google.com
- --oidc-client-id=my-cluster
- --oidc-username-claim=email
- --oidc-groups-claim=groups

# For Webhook Token Auth:
- --authentication-token-webhook-config-file=/etc/kubernetes/webhook-auth.yaml
\`\`\`

**Never use:**
- \`--token-auth-file\` — static tokens, never expire
- \`--basic-auth-file\` — removed in K8s 1.19
- \`--authorization-mode=AlwaysAllow\` — authorizes everything

## Authorization Configuration

\`\`\`yaml
# Proper authorization chain
- --authorization-mode=Node,RBAC

# Node: Restricts kubelets to only access resources for their own node
# RBAC: Fine-grained access control for users and service accounts

# Never use:
# - AlwaysAllow (permits all requests)
# - ABAC (outdated, hard to audit, requires restart to change policies)
\`\`\`

## Admission Controller Plugins

\`\`\`yaml
# Enable security-relevant admission plugins
- --enable-admission-plugins=NodeRestriction,PodSecurity,ResourceQuota,LimitRanger,ServiceAccount,DefaultStorageClass

# NodeRestriction: Prevents kubelets from modifying node/pod objects they don't own
# PodSecurity: Enforces Pod Security Standards
# ServiceAccount: Auto-injects service account token
# ResourceQuota: Enforces namespace resource limits

# Plugins to DISABLE (no longer needed, potential issues):
- --disable-admission-plugins=AlwaysAdmit,ServiceAccount  # only disable if you manage SA manually
\`\`\`

## Audit Logging

Audit logging records every API request — who did what, when, to what resource.

### Audit Policy

\`\`\`yaml
# /etc/kubernetes/audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
# Log all requests at the Metadata level (who + what resource, no request body)
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets"]

# Log requests to sensitive resources at RequestResponse level
- level: RequestResponse
  resources:
  - group: ""
    resources: ["pods", "configmaps"]
  verbs: ["create", "update", "patch", "delete"]

# Skip noisy health-check calls
- level: None
  users: ["system:serviceaccount:kube-system:generic-garbage-collector"]

# Skip frequent get/list/watch operations for common resources
- level: None
  verbs: ["get", "list", "watch"]
  resources:
  - group: ""
    resources: ["events"]

# Catch-all: log everything else at Metadata level
- level: Metadata
  omitStages:
  - RequestReceived
\`\`\`

### Audit Log Levels

| Level | What is logged |
|-------|---------------|
| None | Nothing |
| Metadata | HTTP metadata: user, timestamp, resource, verb — no request/response body |
| Request | Metadata + request body |
| RequestResponse | Metadata + request body + response body |

### API Server Audit Flags

\`\`\`yaml
- --audit-policy-file=/etc/kubernetes/audit-policy.yaml
- --audit-log-path=/var/log/kubernetes/audit.log
- --audit-log-maxage=30        # days to retain log files
- --audit-log-maxbackup=10     # number of backup files
- --audit-log-maxsize=100      # max size in MB per file

# For webhook (send to external SIEM):
- --audit-webhook-config-file=/etc/kubernetes/audit-webhook.yaml
- --audit-webhook-batch-max-size=100
\`\`\`

**Mount the audit log directory into the static pod:**
\`\`\`yaml
# In kube-apiserver.yaml
volumeMounts:
- mountPath: /etc/kubernetes/audit-policy.yaml
  name: audit-policy
  readOnly: true
- mountPath: /var/log/kubernetes
  name: audit-log
volumes:
- name: audit-policy
  hostPath:
    path: /etc/kubernetes/audit-policy.yaml
    type: File
- name: audit-log
  hostPath:
    path: /var/log/kubernetes
    type: DirectoryOrCreate
\`\`\`

## TLS Configuration

\`\`\`yaml
# Serving certificate
- --tls-cert-file=/etc/kubernetes/pki/apiserver.crt
- --tls-private-key-file=/etc/kubernetes/pki/apiserver.key

# Client CA for mTLS
- --client-ca-file=/etc/kubernetes/pki/ca.crt

# Etcd TLS
- --etcd-cafile=/etc/kubernetes/pki/etcd/ca.crt
- --etcd-certfile=/etc/kubernetes/pki/apiserver-etcd-client.crt
- --etcd-keyfile=/etc/kubernetes/pki/apiserver-etcd-client.key

# Kubelet TLS
- --kubelet-certificate-authority=/etc/kubernetes/pki/ca.crt
- --kubelet-client-certificate=/etc/kubernetes/pki/apiserver-kubelet-client.crt
- --kubelet-client-key=/etc/kubernetes/pki/apiserver-kubelet-client.key

# Restrict TLS protocols and ciphers
- --tls-min-version=VersionTLS12
- --tls-cipher-suites=TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
\`\`\`

## Service Account Configuration

\`\`\`yaml
# Service account key for token signing/verification
- --service-account-key-file=/etc/kubernetes/pki/sa.pub
- --service-account-signing-key-file=/etc/kubernetes/pki/sa.key  # v1.20+
- --service-account-issuer=https://kubernetes.default.svc       # v1.20+
- --service-account-lookup=true   # validate SA token exists in etcd

# Bound service account tokens (v1.22+, default)
- --service-account-max-token-expiration=24h   # max TTL for bound tokens
\`\`\`

## Security-Sensitive Flags Summary

\`\`\`bash
# Flags that MUST be set (secure):
--anonymous-auth=false
--authorization-mode=Node,RBAC          # NOT AlwaysAllow
--enable-admission-plugins=NodeRestriction,...
--audit-log-path=<path>
--audit-policy-file=<path>
--service-account-lookup=true
--etcd-cafile=<path>
--kubelet-certificate-authority=<path>
--profiling=false
--request-timeout=300s                  # prevent DoS via long requests

# Flags that must NOT be set:
# --token-auth-file (static tokens)
# --insecure-port=0 (or missing) -- port 8080 insecure HTTP
# --authorization-mode=AlwaysAllow
\`\`\`

## Verifying API Server Security

\`\`\`bash
# Check current flags
kubectl get pod -n kube-system kube-apiserver-$(hostname) -o yaml | grep -A100 "command:"

# Test anonymous access (should be denied)
curl -sk https://<api-server>:6443/api/v1/namespaces --max-time 3
# Should return: 401 Unauthorized

# Test profiling endpoint (should be forbidden)
curl -sk https://<api-server>:6443/debug/pprof/ --max-time 3
# Should return: 403 Forbidden or timeout

# Check audit logs
tail -f /var/log/kubernetes/audit.log | python3 -m json.tool | grep -E '"user"|"verb"|"resource"'
\`\`\`

## Common Mistakes

- **Not mounting audit log volume**: The API server cannot write logs if the directory doesn't exist on the host
- **Audit policy too verbose**: RequestResponse level on all resources creates huge logs and CPU overhead
- **Forgetting to enable admission plugins**: Plugins must be explicitly listed — they are not all on by default
- **Not disabling profiling**: The /debug/pprof endpoint can reveal sensitive internal state

## Killer.sh Style Challenge

> **Scenario**: Enable audit logging on the API server. Log all requests to Secrets at RequestResponse level, and all other requests at Metadata level. Store logs in /var/log/k8s-audit/audit.log with 30-day retention.
`,

  quiz: [
    {
      question: 'What is the risk of --authorization-mode=AlwaysAllow on the API server?',
      options: [
        'Every authenticated request is authorized — any user or service account can do anything',
        'Only requests with a valid certificate are allowed',
        'RBAC policies are ignored and all access is logged',
        'Anonymous users are automatically given cluster-admin privileges'
      ],
      correct: 0,
      explanation: 'AlwaysAllow bypasses all authorization checks. Any authenticated user (and with --anonymous-auth=true, anonymous users too) can perform any action on the cluster. This is only acceptable for testing.',
      reference: 'API Server Security — Authorization Configuration section.'
    },
    {
      question: 'What audit log level records the request body but NOT the response body?',
      options: ['Request', 'RequestResponse', 'Metadata', 'Verbose'],
      correct: 0,
      explanation: 'The "Request" audit level records HTTP metadata + the request body. "RequestResponse" records both request and response bodies. "Metadata" records only headers (no bodies). Use "RequestResponse" sparingly due to volume.',
      reference: 'API Server Security — Audit Log Levels table.'
    },
    {
      question: 'After adding --audit-policy-file and --audit-log-path to kube-apiserver.yaml, the API server pod crashes. What is the most likely cause?',
      options: [
        'The audit log directory does not exist on the host — volume mount for the log path is missing',
        'The audit policy file format is wrong',
        'Audit logging is not supported on this Kubernetes version',
        'The API server needs a full node restart to enable audit logging'
      ],
      correct: 0,
      explanation: 'The API server runs in a container. If --audit-log-path points to /var/log/kubernetes/audit.log, the container needs both: (1) the directory to exist on the host, and (2) a hostPath volume mount mapping the host directory to the container path.',
      reference: 'API Server Security — Audit Logging section (volume mounts).'
    },
    {
      question: 'Which flag prevents the API server from accepting tokens for deleted ServiceAccounts?',
      options: [
        '--service-account-lookup=true',
        '--service-account-max-token-expiration=1h',
        '--service-account-signing-key-file=<path>',
        '--enable-admission-plugins=ServiceAccount'
      ],
      correct: 0,
      explanation: 'With --service-account-lookup=true, the API server validates that a ServiceAccount token exists in etcd before accepting it. Without this, tokens for deleted ServiceAccounts remain valid until expiry.',
      reference: 'API Server Security — Service Account Configuration section.'
    },
    {
      question: 'What does the NodeRestriction admission plugin do?',
      options: [
        'Restricts kubelets to only modify node and pod objects they are scheduled on',
        'Prevents nodes from joining the cluster without a valid bootstrap token',
        'Limits the number of pods that can run on each node',
        'Blocks nodes from accessing the etcd API directly'
      ],
      correct: 0,
      explanation: 'NodeRestriction limits what kubelets can modify via the API. Each kubelet can only update its own Node object and the pods scheduled on it. This prevents a compromised node from escalating privileges by modifying other nodes or pods.',
      reference: 'API Server Security — Admission Controller Plugins section.'
    },
    {
      question: 'How do you verify that anonymous access to the API server is disabled?',
      options: [
        'curl -sk https://<api-server>:6443/api — should return 401 Unauthorized',
        'kubectl auth can-i --as=anonymous list pods',
        'grep anonymous-auth /etc/kubernetes/manifests/kube-apiserver.yaml',
        'kubectl describe clusterrolebinding system:anonymous'
      ],
      correct: 0,
      explanation: 'The definitive test is to make an unauthenticated HTTP request to the API server. If anonymous auth is disabled, you get 401 Unauthorized. Only checking the flag in the manifest tells you the intended config, not the live behavior.',
      reference: 'API Server Security — Verifying API Server Security section.'
    },
    {
      question: 'What is the purpose of --tls-min-version=VersionTLS12?',
      options: [
        'Prevents TLS 1.0 and 1.1 connections — known weak protocols — from being accepted',
        'Sets the maximum TLS version to 1.2 for compatibility',
        'Requires mutual TLS for all connections',
        'Enables TLS 1.3 features on the API server'
      ],
      correct: 0,
      explanation: 'TLS 1.0 and 1.1 have known vulnerabilities (POODLE, BEAST). Setting --tls-min-version=VersionTLS12 forces the API server to only accept TLS 1.2 and above, rejecting weaker protocol versions.',
      reference: 'API Server Security — TLS Configuration section.'
    },
    {
      question: 'An audit policy rule with level: None and users: ["system:kube-controller-manager"] means:',
      options: [
        'Requests from the controller manager are not logged at all',
        'The controller manager is not authorized',
        'All requests are logged except from the controller manager',
        'Controller manager requests require explicit RBAC approval'
      ],
      correct: 0,
      explanation: 'level: None means "do not log these requests." Applying it to the controller manager is a common optimization to reduce audit log noise from the internal controller components that make many API calls. This is a valid trade-off but reduces visibility.',
      reference: 'API Server Security — Audit Policy section.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 3 most critical API server security flags to always set?',
      back: '1. --anonymous-auth=false\n   Denies unauthenticated requests\n\n2. --authorization-mode=Node,RBAC\n   Enables proper authorization (Node for kubelets, RBAC for users)\n\n3. --profiling=false\n   Disables /debug/pprof endpoint that can leak internal state\n\nAlso important:\n--audit-log-path=<path> (audit logging)\n--service-account-lookup=true (validate SA tokens exist)'
    },
    {
      front: 'What are the 4 audit log levels in order from least to most verbose?',
      back: 'None → Metadata → Request → RequestResponse\n\nNone: nothing logged\nMetadata: user, verb, resource, timestamp (no body)\nRequest: metadata + request body\nRequestResponse: metadata + request body + response body\n\nCKS tip: Use Metadata for most resources, RequestResponse only for critical resources like Secrets'
    },
    {
      front: 'What volumes must be mounted in the API server static pod for audit logging?',
      back: 'Two volumes needed:\n\n1. Audit policy file:\n   hostPath: /etc/kubernetes/audit-policy.yaml\n   mountPath: /etc/kubernetes/audit-policy.yaml\n   readOnly: true\n\n2. Audit log directory:\n   hostPath: /var/log/kubernetes\n   type: DirectoryOrCreate\n   mountPath: /var/log/kubernetes\n\nWithout these, the API server pod will crash (cannot find files)'
    },
    {
      front: 'What does --service-account-lookup=true do and why is it important?',
      back: 'Forces API server to check etcd that the ServiceAccount token still exists before accepting it.\n\nWithout it: A token for a deleted SA remains valid until it expires (up to 1 year for old tokens).\n\nWith it: Deleting a ServiceAccount immediately invalidates its token.\n\nDefault: true in modern Kubernetes, but CIS Benchmark requires explicit configuration.'
    },
    {
      front: 'Write a minimal but secure audit policy for CKS',
      back: 'apiVersion: audit.k8s.io/v1\nkind: Policy\nrules:\n# Log secrets fully\n- level: RequestResponse\n  resources:\n  - group: ""\n    resources: ["secrets"]\n# Log pod exec/portforward\n- level: RequestResponse\n  verbs: ["create"]\n  resources:\n  - group: ""\n    resources: ["pods/exec", "pods/portforward"]\n# Skip noise\n- level: None\n  verbs: ["get", "list", "watch"]\n  resources:\n  - group: ""\n    resources: ["events"]\n# Everything else\n- level: Metadata'
    },
    {
      front: 'What is the difference between --enable-admission-plugins and --disable-admission-plugins?',
      back: '--enable-admission-plugins: ADD plugins to the default set\n  Example: --enable-admission-plugins=NodeRestriction,PodSecurity\n\n--disable-admission-plugins: REMOVE plugins from default set\n  Example: --disable-admission-plugins=DefaultStorageClass\n\nKey: not all plugins are on by default. Check: kube-apiserver --help | grep "default enabled plugins"\n\nImportant: NodeRestriction should ALWAYS be enabled, AlwaysAdmit should NEVER be enabled'
    }
  ],

  lab: {
    scenario: 'The cluster API server lacks proper audit logging. A security incident occurred and the team cannot trace who deleted a critical Secret. Configure comprehensive audit logging to capture all Secret operations and other sensitive actions.',
    objective: 'Configure the Kubernetes API server with a proper audit policy that logs Secret operations at RequestResponse level and all other operations at Metadata level.',
    duration: '25-35 minutes',
    steps: [
      {
        title: 'Create the audit policy file',
        instruction: `Create an audit policy that logs Secret operations in detail.

\`\`\`bash
# Create directory for audit config
sudo mkdir -p /etc/kubernetes/audit

# Create the audit policy
sudo tee /etc/kubernetes/audit/policy.yaml <<EOF
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages:
- RequestReceived
rules:
# Secrets: log full request and response
- level: RequestResponse
  resources:
  - group: ""
    resources: ["secrets"]

# Pod exec and port-forward: log details
- level: RequestResponse
  verbs: ["create"]
  resources:
  - group: ""
    resources: ["pods/exec", "pods/portforward", "pods/attach"]

# Skip noisy read operations
- level: None
  verbs: ["get", "list", "watch"]
  resources:
  - group: ""
    resources: ["events", "nodes"]

# Everything else: metadata only
- level: Metadata
EOF

# Verify
cat /etc/kubernetes/audit/policy.yaml
\`\`\``,
        hints: [
          'omitStages: [RequestReceived] reduces log volume by skipping the initial stage',
          'The order of rules matters — first matching rule applies',
          'RequestResponse for secrets captures the actual secret data in logs — consider this a trade-off'
        ],
        solution: `\`\`\`bash
sudo mkdir -p /etc/kubernetes/audit /var/log/kubernetes
sudo tee /etc/kubernetes/audit/policy.yaml <<'EOF'
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages:
- RequestReceived
rules:
- level: RequestResponse
  resources:
  - group: ""
    resources: ["secrets"]
- level: Metadata
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify the file exists and is valid YAML
sudo python3 -c "import yaml; yaml.safe_load(open('/etc/kubernetes/audit/policy.yaml'))" && echo "YAML is valid"
# Expected: YAML is valid

sudo ls -la /etc/kubernetes/audit/policy.yaml
# Expected: file exists with readable permissions
\`\`\``
      },
      {
        title: 'Configure the API server with audit logging',
        instruction: `Edit the API server static pod manifest to enable audit logging.

\`\`\`bash
# Backup the manifest first
sudo cp /etc/kubernetes/manifests/kube-apiserver.yaml /etc/kubernetes/kube-apiserver.yaml.bak

# Edit the manifest
sudo vi /etc/kubernetes/manifests/kube-apiserver.yaml
\`\`\`

Add these flags to the command section:
\`\`\`
- --audit-policy-file=/etc/kubernetes/audit/policy.yaml
- --audit-log-path=/var/log/kubernetes/audit.log
- --audit-log-maxage=30
- --audit-log-maxbackup=10
- --audit-log-maxsize=100
\`\`\`

Add these volume mounts to spec.containers[0].volumeMounts:
\`\`\`yaml
- mountPath: /etc/kubernetes/audit
  name: audit-policy
  readOnly: true
- mountPath: /var/log/kubernetes
  name: audit-log
\`\`\`

Add these volumes to spec.volumes:
\`\`\`yaml
- name: audit-policy
  hostPath:
    path: /etc/kubernetes/audit
    type: DirectoryOrCreate
- name: audit-log
  hostPath:
    path: /var/log/kubernetes
    type: DirectoryOrCreate
\`\`\``,
        hints: [
          'Always backup the manifest before editing!',
          'If the API server fails to restart, restore the backup',
          'Watch the restart: watch kubectl get pods -n kube-system'
        ],
        solution: `\`\`\`bash
# Create the log directory
sudo mkdir -p /var/log/kubernetes

# The manifest changes need to be made manually in the file
# Watch for API server restart
watch kubectl get pods -n kube-system | grep apiserver
\`\`\``,
        verify: `\`\`\`bash
# Wait for API server to restart (may take 30-60 seconds)
kubectl get pods -n kube-system | grep apiserver
# Expected: Running

# Verify audit flags are active
kubectl get pod -n kube-system -l component=kube-apiserver -o yaml | grep "audit"
# Expected: Lines with --audit-policy-file and --audit-log-path

# Check if log file is being created
sudo ls -la /var/log/kubernetes/audit.log
# Expected: file exists with recent modification time
\`\`\``
      },
      {
        title: 'Verify audit logging captures Secret operations',
        instruction: `Create and delete a Secret, then verify the operations appear in the audit log.

\`\`\`bash
# Create a test secret
kubectl create secret generic test-audit \
  --from-literal=password=s3cret123

# List and delete it
kubectl get secret test-audit
kubectl delete secret test-audit

# Check the audit log
sudo tail -50 /var/log/kubernetes/audit.log | \
  python3 -m json.tool 2>/dev/null | \
  grep -E '"verb"|"resource"|"user"' | head -30

# Or use grep to find Secret events
sudo grep '"secrets"' /var/log/kubernetes/audit.log | \
  python3 -c "import sys,json; [print(json.dumps({'user': json.loads(l).get('user',{}).get('username'), 'verb': json.loads(l).get('verb'), 'resource': json.loads(l).get('objectRef',{}).get('resource')}, indent=2)) for l in sys.stdin]" 2>/dev/null | head -30
\`\`\``,
        hints: [
          'Audit log entries are JSON lines — python3 -m json.tool pretty-prints one entry',
          'Look for "verb": "create" and "verb": "delete" with "resource": "secrets"',
          'The user field shows who performed the action'
        ],
        solution: `\`\`\`bash
kubectl create secret generic test-audit --from-literal=password=test123
kubectl delete secret test-audit

# Check audit log
sudo tail -100 /var/log/kubernetes/audit.log | grep '"secrets"' | tail -5
\`\`\``,
        verify: `\`\`\`bash
# Audit log should contain Secret operations
sudo grep -c '"secrets"' /var/log/kubernetes/audit.log
# Expected: > 0 (some number, at least for our test operations)

# Specific verb should appear
sudo grep '"verb":"create"' /var/log/kubernetes/audit.log | grep '"secrets"' | wc -l
# Expected: >= 1

sudo grep '"verb":"delete"' /var/log/kubernetes/audit.log | grep '"secrets"' | wc -l
# Expected: >= 1
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'API server pod crashes after adding audit logging flags',
      difficulty: 'hard',
      symptom: 'After adding audit flags to kube-apiserver.yaml, the pod enters CrashLoopBackOff and kubectl commands fail with "connection refused".',
      diagnosis: `\`\`\`bash
# Check if static pod is starting at all
sudo crictl ps -a | grep apiserver

# Get container ID of crashed pod
CONTAINER_ID=$(sudo crictl ps -a | grep apiserver | awk '{print $1}' | head -1)

# Check the logs
sudo crictl logs $CONTAINER_ID 2>&1 | tail -30

# Common error patterns:
# "cannot create audit log file" — path doesn't exist or no permission
# "failed to load audit policy" — policy file not found or invalid YAML
# "unable to load volume" — hostPath volume mount issue

# Check if the log directory exists on the host
ls -la /var/log/kubernetes/
ls -la /etc/kubernetes/audit/policy.yaml
\`\`\``,
      solution: `**Fix based on error:**

**"cannot create audit log file":**
\`\`\`bash
sudo mkdir -p /var/log/kubernetes
sudo chmod 755 /var/log/kubernetes
# Verify the volumeMount in the manifest maps this path
\`\`\`

**"failed to load audit policy file":**
\`\`\`bash
# Check the policy file is valid
sudo cat /etc/kubernetes/audit/policy.yaml
sudo python3 -c "import yaml; yaml.safe_load(open('/etc/kubernetes/audit/policy.yaml'))" && echo "Valid"

# Check volume mount in manifest
# hostPath.path in volumes must match the directory containing the policy file
\`\`\`

**Volume mount not found:**
\`\`\`bash
# The volumeMount and volume name must match exactly
# Check in kube-apiserver.yaml:
grep -A3 "volumeMounts:" /etc/kubernetes/manifests/kube-apiserver.yaml
grep -A5 "volumes:" /etc/kubernetes/manifests/kube-apiserver.yaml
# Names must be identical (case-sensitive)
\`\`\`

**Emergency restore:**
\`\`\`bash
sudo cp /etc/kubernetes/kube-apiserver.yaml.bak /etc/kubernetes/manifests/kube-apiserver.yaml
# Wait ~30 seconds for API server to restart
\`\`\``
    },
    {
      title: 'Audit log grows too fast and fills disk',
      difficulty: 'medium',
      symptom: 'The audit log is filling disk space rapidly. kubectl commands start failing with "no space left on device" on the control plane node.',
      diagnosis: `\`\`\`bash
# Check disk usage
df -h /var/log/kubernetes/

# Check audit log size
ls -lh /var/log/kubernetes/audit*.log

# Check the audit policy — look for RequestResponse on high-traffic resources
cat /etc/kubernetes/audit/policy.yaml

# Count log events per resource type
cat /var/log/kubernetes/audit.log | python3 -c "
import sys, json
from collections import Counter
c = Counter()
for line in sys.stdin:
    try:
        obj = json.loads(line)
        c[obj.get('objectRef',{}).get('resource','unknown')] += 1
    except: pass
for r,n in c.most_common(10): print(n, r)
"
\`\`\``,
      solution: `**Fix the audit policy to be less verbose:**

\`\`\`yaml
# Replace verbose rules with efficient ones
rules:
# Skip all reads (biggest source of noise)
- level: None
  verbs: ["get", "list", "watch"]

# Skip system components
- level: None
  users:
  - "system:kube-controller-manager"
  - "system:kube-scheduler"
  - "system:serviceaccount:kube-system:endpoint-controller"

# Log secrets at Metadata (not RequestResponse) to avoid logging secret values
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets"]

# Catch-all: Metadata for everything else
- level: Metadata
\`\`\`

\`\`\`bash
# Update the policy file
sudo vi /etc/kubernetes/audit/policy.yaml

# The API server hot-reloads audit policy on file change (no restart needed)
# Verify after a minute:
ls -lh /var/log/kubernetes/audit.log
\`\`\``
    }
  ]
};
