window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-runtime-security/audit-logging'] = {
  theory: `# Kubernetes Audit Logging (Deep Dive)

## Exam Relevance
> CKS expects you to write audit policies, configure the API server with audit logging, and read/interpret audit log entries. High-priority CKS topic, appears in both Cluster Setup and Runtime Security domains (~12%).

## Audit Log Architecture

\`\`\`
Client Request → API Server
                    ↓
              Authentication
                    ↓
              Authorization
                    ↓
              Admission Control
                    ↓
              Audit Logger ←── audit-policy.yaml
                    ↓
              Log File / Webhook
\`\`\`

Every request to the API server passes through audit logging at up to **4 stages**:

| Stage | When |
|-------|------|
| RequestReceived | Immediately when request is received |
| ResponseStarted | After response headers sent (streaming) |
| ResponseComplete | After full response body sent |
| Panic | Internal server error/panic |

## Audit Policy

\`\`\`yaml
# /etc/kubernetes/audit/policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy

# Omit the RequestReceived stage (reduces duplicate entries)
omitStages:
- RequestReceived

rules:
# --- Rule 1: Log everything about secrets at highest detail ---
- level: RequestResponse
  resources:
  - group: ""
    resources: ["secrets"]

# --- Rule 2: Log exec/attach/portforward requests in full ---
- level: RequestResponse
  verbs: ["create"]
  resources:
  - group: ""
    resources:
    - pods/exec
    - pods/attach
    - pods/portforward

# --- Rule 3: Skip health check endpoints ---
- level: None
  nonResourceURLs:
  - /healthz
  - /readyz
  - /livez
  - /metrics

# --- Rule 4: Skip noisy internal controller requests ---
- level: None
  users:
  - system:kube-controller-manager
  - system:kube-scheduler
  - system:apiserver
  userGroups:
  - system:serviceaccounts:kube-system

# --- Rule 5: Skip read-only operations on events ---
- level: None
  verbs: ["get", "list", "watch"]
  resources:
  - group: ""
    resources: ["events"]

# --- Rule 6: Metadata for all other RBAC changes ---
- level: RequestResponse
  resources:
  - group: "rbac.authorization.k8s.io"
  verbs: ["create", "update", "patch", "delete"]

# --- Rule 7: Catch-all rule (everything else at Metadata) ---
- level: Metadata
  omitStages:
  - RequestReceived
\`\`\`

## Log Levels Detail

\`\`\`yaml
None:            # Do not log
Metadata:        # Log: user, verb, resource, status code, source IP
                 # NOT: request/response body
Request:         # Metadata + request body
                 # NOT: response body
RequestResponse: # Metadata + request body + response body
                 # Most verbose, highest storage cost
\`\`\`

## API Server Configuration

\`\`\`yaml
# /etc/kubernetes/manifests/kube-apiserver.yaml
spec:
  containers:
  - command:
    - kube-apiserver
    # Audit policy and log file
    - --audit-policy-file=/etc/kubernetes/audit/policy.yaml
    - --audit-log-path=/var/log/kubernetes/audit/audit.log

    # Log rotation settings
    - --audit-log-maxage=30        # days to retain log files
    - --audit-log-maxbackup=10     # number of backup files
    - --audit-log-maxsize=100      # max size in MB before rotation

    # Optional: send to external SIEM via webhook
    - --audit-webhook-config-file=/etc/kubernetes/audit/webhook.yaml
    - --audit-webhook-mode=batch   # batch | blocking
    - --audit-webhook-batch-max-size=400

    volumeMounts:
    - mountPath: /etc/kubernetes/audit
      name: audit-config
      readOnly: true
    - mountPath: /var/log/kubernetes/audit
      name: audit-log

  volumes:
  - name: audit-config
    hostPath:
      path: /etc/kubernetes/audit
      type: DirectoryOrCreate
  - name: audit-log
    hostPath:
      path: /var/log/kubernetes/audit
      type: DirectoryOrCreate
\`\`\`

## Audit Log Entry Format

Each entry is a JSON object (one per line):

\`\`\`json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "RequestResponse",
  "auditID": "a2b3c4d5-...",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/production/secrets/db-password",
  "verb": "get",
  "user": {
    "username": "admin",
    "uid": "...",
    "groups": ["system:masters", "system:authenticated"]
  },
  "sourceIPs": ["192.168.1.100"],
  "userAgent": "kubectl/v1.29.0",
  "objectRef": {
    "resource": "secrets",
    "namespace": "production",
    "name": "db-password",
    "apiVersion": "v1"
  },
  "responseStatus": {
    "code": 200
  },
  "requestReceivedTimestamp": "2024-01-15T10:00:00.000Z",
  "stageTimestamp": "2024-01-15T10:00:00.005Z",
  "annotations": {
    "authorization.k8s.io/decision": "allow",
    "authorization.k8s.io/reason": "RBAC: allowed by..."
  }
}
\`\`\`

## Reading Audit Logs

\`\`\`bash
# Read and pretty-print the latest entries
tail -f /var/log/kubernetes/audit/audit.log | \
  while read line; do echo "$line" | python3 -m json.tool; done

# Filter for specific user
cat /var/log/kubernetes/audit/audit.log | \
  python3 -c "
import json, sys
for line in sys.stdin:
  try:
    e = json.loads(line)
    if e.get('user', {}).get('username') == 'system:anonymous':
      print(f\"{e['verb']} {e['requestURI']} -> {e.get('responseStatus', {}).get('code')}\")
  except: pass
"

# Filter for failed authentication
grep '"code":401' /var/log/kubernetes/audit/audit.log | \
  python3 -c "import json,sys; [print(json.loads(l)['sourceIPs']) for l in sys.stdin]" 2>/dev/null

# Find Secret access events
grep '"resource":"secrets"' /var/log/kubernetes/audit/audit.log | \
  python3 -c "
import json, sys
for line in sys.stdin:
  e = json.loads(line)
  user = e['user']['username']
  verb = e['verb']
  obj = e.get('objectRef', {})
  print(f'{user} {verb} secret {obj.get(\"namespace\")}/{obj.get(\"name\")}')
" 2>/dev/null

# Find exec events
grep 'pods/exec' /var/log/kubernetes/audit/audit.log | wc -l
\`\`\`

## Audit Webhook Configuration

Send audit events to an external SIEM (Elasticsearch, Splunk, Falco):

\`\`\`yaml
# /etc/kubernetes/audit/webhook.yaml
apiVersion: v1
kind: Config
clusters:
- name: log-aggregator
  cluster:
    server: https://siem.company.com/audit
    certificate-authority: /etc/kubernetes/pki/audit-ca.crt
users:
- name: log-aggregator
  user:
    client-certificate: /etc/kubernetes/pki/audit-client.crt
    client-key: /etc/kubernetes/pki/audit-client.key
contexts:
- context:
    cluster: log-aggregator
    user: log-aggregator
  name: log-aggregator
current-context: log-aggregator
\`\`\`

## Dynamic Audit Sinks (v1.13+, deprecated)

\`\`\`yaml
# AuditSink CRD (beta, removed in 1.27)
# Prefer --audit-webhook-config-file instead
\`\`\`

## Analyzing Security Events

Key events to monitor:

\`\`\`bash
# 1. Anonymous access attempts
grep '"username":"system:anonymous"' /var/log/kubernetes/audit/audit.log

# 2. Secrets accessed/listed
grep '"resource":"secrets"' /var/log/kubernetes/audit/audit.log | grep '"verb":"list"'

# 3. Privilege escalation (binding to cluster-admin)
grep '"clusterrolebindings"' /var/log/kubernetes/audit/audit.log | grep '"verb":"create"'

# 4. Pod exec (interactive access to pods)
grep '"pods/exec"' /var/log/kubernetes/audit/audit.log

# 5. Changes to NetworkPolicy
grep '"networkpolicies"' /var/log/kubernetes/audit/audit.log | grep '"verb":"delete"'

# 6. Failed authorization (403)
grep '"code":403' /var/log/kubernetes/audit/audit.log | python3 -c "
import json, sys
for l in sys.stdin:
  e = json.loads(l)
  print(e['user']['username'], e['verb'], e.get('objectRef',{}).get('resource'))
" 2>/dev/null | sort | uniq -c | sort -rn
\`\`\`

## Retention and Compliance

\`\`\`bash
# Current log size
du -sh /var/log/kubernetes/audit/

# Compressed backups (log rotation creates .1, .2, ... files)
ls -lh /var/log/kubernetes/audit/audit.log*

# Archive old logs
tar -czf audit-$(date +%Y%m%d).tar.gz /var/log/kubernetes/audit/
# Then upload to S3/GCS for long-term retention

# CIS Benchmark requires:
# --audit-log-maxage=30     (30 days minimum)
# --audit-log-maxbackup=10  (10 rotated files)
# --audit-log-maxsize=100   (100MB per file)
\`\`\`

## Common Mistakes

- **Missing volume mount**: Audit log directory must be mounted as hostPath or logs go to container ephemeral storage (lost on pod restart)
- **Policy order**: First matching rule wins — put specific rules before catch-all
- **RequestReceived stage noise**: Omit RequestReceived to avoid duplicate entries (each request also logs at ResponseComplete)
- **RequestResponse on everything**: Extremely high storage and CPU cost — use for targeted resources only

## Killer.sh Style Challenge

> **Scenario**: Configure the API server with an audit policy that: (1) logs all Secret accesses at RequestResponse level, (2) logs pod exec at Request level, (3) logs nothing for get/list/watch on events, (4) logs everything else at Metadata level.
`,

  quiz: [
    {
      question: 'What are the 4 audit stages in order of when they occur?',
      options: [
        'RequestReceived → ResponseStarted → ResponseComplete → Panic',
        'RequestSent → RequestProcessed → ResponseSent → ResponseComplete',
        'AuthN → AuthZ → Admission → Execute',
        'Receive → Validate → Authorize → Complete'
      ],
      correct: 0,
      explanation: 'The 4 stages are: RequestReceived (when the request arrives), ResponseStarted (headers sent, used for streaming), ResponseComplete (full response sent), and Panic (internal server error). Most policies omit RequestReceived to reduce duplicate entries.',
      reference: 'Kubernetes Audit Logging — Audit Log Architecture section.'
    },
    {
      question: 'An audit policy rule is: level: None, verbs: [get, list, watch], resources: [events]. What does this do?',
      options: [
        'Prevents GET/LIST/WATCH requests to events from being logged — reduces noise from event watchers',
        'Blocks all access to events from controllers',
        'Only logs requests that are denied for event resources',
        'Logs events at minimum detail (metadata only)'
      ],
      correct: 0,
      explanation: 'level: None means "do not log." Combined with specific verbs and resources, this exempts high-frequency read operations on events from being logged. Event watchers (controllers, dashboards) make many get/list/watch calls that would create excessive log volume.',
      reference: 'Kubernetes Audit Logging — Audit Policy section.'
    },
    {
      question: 'After configuring audit logging in the API server, the audit log file is empty. What is the most likely cause?',
      options: [
        'The audit log directory is not mounted as a hostPath volume — logs are written inside the container (lost)',
        'The audit policy file has a syntax error',
        'Audit logging requires a restart of etcd',
        'The audit log path requires absolute path starting with /var/log'
      ],
      correct: 0,
      explanation: 'The API server runs in a container. If the --audit-log-path directory is not mounted via hostPath volume, logs are written inside the container\'s filesystem. When the pod restarts, logs are lost and you see no file on the host. Always mount the log directory.',
      reference: 'Kubernetes Audit Logging — API Server Configuration section.'
    },
    {
      question: 'What audit level should you use to log both the request body AND response body for Secret operations?',
      options: [
        'RequestResponse',
        'Request',
        'Metadata',
        'Full'
      ],
      correct: 0,
      explanation: 'RequestResponse logs the full request body (what data was sent) and the full response body (what data was returned). This is the most detailed level. For Secrets, this lets you see exactly what value was read or written.',
      reference: 'Kubernetes Audit Logging — Log Levels Detail section.'
    },
    {
      question: 'Which audit log field indicates which user made the request?',
      options: [
        'user.username in the audit event JSON',
        'sourceIPs in the audit event JSON',
        'requestURI in the audit event JSON',
        'annotations.user in the audit event JSON'
      ],
      correct: 0,
      explanation: 'The audit event JSON has a "user" object with "username", "uid", and "groups" fields. For ServiceAccounts, the username is in format "system:serviceaccount:namespace:name". For OIDC users, it\'s the email or configured claim.',
      reference: 'Kubernetes Audit Logging — Audit Log Entry Format section.'
    },
    {
      question: 'An audit policy has two rules: (1) level: None for secrets, (2) level: RequestResponse for all resources. What level are Secrets logged at?',
      options: [
        'None — the first matching rule wins',
        'RequestResponse — the more specific rule wins',
        'Metadata — conflicting rules default to the lowest level',
        'An error is raised for conflicting rules'
      ],
      correct: 0,
      explanation: 'Audit policy rules are evaluated in order, and the FIRST matching rule applies. If rule 1 says level: None for secrets and rule 2 is a catch-all, Secrets will not be logged. Order matters critically.',
      reference: 'Kubernetes Audit Logging — Audit Policy section.'
    },
    {
      question: 'The CIS benchmark requires specific audit log rotation flags. Which set is correct?',
      options: [
        '--audit-log-maxage=30, --audit-log-maxbackup=10, --audit-log-maxsize=100',
        '--audit-log-retention=30d, --audit-log-files=10, --audit-log-size=100mb',
        '--audit-retention-days=30, --audit-max-files=10, --audit-file-size=100',
        '--log-maxage=30, --log-maxbackup=10, --log-maxsize=100'
      ],
      correct: 0,
      explanation: 'CIS Benchmark checks: 1.2.20 (--audit-log-maxage=30), 1.2.21 (--audit-log-maxbackup=10), 1.2.22 (--audit-log-maxsize=100). These must be set on the kube-apiserver. maxage is days, maxsize is MB.',
      reference: 'Kubernetes Audit Logging — Retention and Compliance section.'
    },
    {
      question: 'How do you send Kubernetes audit events to an external SIEM in real-time?',
      options: [
        'Use --audit-webhook-config-file pointing to a kubeconfig-format file specifying the SIEM endpoint',
        'Configure fluentd to tail the audit.log file and forward to the SIEM',
        'Enable --audit-siem-endpoint flag on the API server',
        'Use kubectl audit stream to pipe events to the SIEM'
      ],
      correct: 0,
      explanation: 'The API server supports audit webhook (--audit-webhook-config-file) which sends audit events to an HTTP endpoint in real-time. The config is a kubeconfig-format file specifying the server URL and optionally TLS client auth.',
      reference: 'Kubernetes Audit Logging — Audit Webhook Configuration section.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 4 audit log levels and what do they record?',
      back: 'None: nothing (skip this request entirely)\n\nMetadata: who/what/when/result (no body)\n  - user.username, verb, resource, namespace\n  - responseStatus.code, sourceIPs\n\nRequest: Metadata + request body\n  - includes what was sent (CREATE body, UPDATE body)\n  - NOT response body\n\nRequestResponse: Metadata + request + response body\n  - Most complete, highest cost\n  - Use sparingly (Secrets, RBAC changes, exec)'
    },
    {
      front: 'Write a minimal but complete audit policy for CKS',
      back: 'apiVersion: audit.k8s.io/v1\nkind: Policy\nomitStages: [RequestReceived]\nrules:\n# Highest detail for security-critical resources\n- level: RequestResponse\n  resources:\n  - group: ""\n    resources: ["secrets"]\n# Pod exec/attach detail\n- level: Request\n  verbs: ["create"]\n  resources:\n  - group: ""\n    resources: ["pods/exec", "pods/portforward"]\n# Skip noise\n- level: None\n  verbs: ["get", "list", "watch"]\n  resources:\n  - group: ""\n    resources: ["events"]\n# Catch-all\n- level: Metadata'
    },
    {
      front: 'What 2 volume mounts are required in kube-apiserver.yaml for audit logging?',
      back: '1. Policy file mount:\n   volumeMounts:\n   - mountPath: /etc/kubernetes/audit\n     name: audit-config\n     readOnly: true\n   volumes:\n   - name: audit-config\n     hostPath:\n       path: /etc/kubernetes/audit\n       type: DirectoryOrCreate\n\n2. Log directory mount:\n   volumeMounts:\n   - mountPath: /var/log/kubernetes/audit\n     name: audit-log\n   volumes:\n   - name: audit-log\n     hostPath:\n       path: /var/log/kubernetes/audit\n       type: DirectoryOrCreate\n\nWithout #2: log file lost on pod restart!'
    },
    {
      front: 'How do you find audit events for Secret access?',
      back: '# All Secret access:\ngrep \'"resource":"secrets"\' /var/log/kubernetes/audit/audit.log\n\n# With user info:\ngrep \'"resource":"secrets"\' audit.log | python3 -c "\nimport json,sys\nfor l in sys.stdin:\n  e = json.loads(l)\n  print(e[\'user\'][\'username\'], e[\'verb\'], e.get(\'objectRef\',{}).get(\'name\'))\n"\n\n# Just list operations (concerning):\ngrep \'"resource":"secrets"\' audit.log | grep \'"verb":"list"\'\n\n# Failed access:\ngrep \'"resource":"secrets"\' audit.log | grep \'"code":403\''
    },
    {
      front: 'What is the audit policy rule evaluation order?',
      back: 'Rules are evaluated TOP to BOTTOM.\nFIRST matching rule wins.\n\nExample:\nrule1: level: None for secrets\nrule2: level: RequestResponse for all resources\n\nResult: Secrets are NOT logged (rule1 matched first)\n\nBest practice order:\n1. Skip rules (level: None) for noisy/low-value resources\n2. High-detail rules (RequestResponse) for sensitive resources\n3. Catch-all (level: Metadata) as last rule\n\nomitStages: [RequestReceived] at Policy level applies globally'
    },
    {
      front: 'What CIS benchmark flags must be set for audit logging retention?',
      back: '--audit-policy-file=<path>    # required (1.2.19)\n--audit-log-path=<path>       # required (1.2.19)\n--audit-log-maxage=30         # days to retain (1.2.20)\n--audit-log-maxbackup=10      # number of backup files (1.2.21)\n--audit-log-maxsize=100       # MB per file before rotation (1.2.22)\n\nAll must be on kube-apiserver static pod\nLog directory must be hostPath mounted\nkube-bench checks all of these in section 1.2'
    }
  ],

  lab: {
    scenario: 'The cluster has no audit logging configured. A security incident occurred and there\'s no trace of who deleted a critical Secret. Configure audit logging to capture all Secret operations and verify it works.',
    objective: 'Configure Kubernetes audit logging on the API server, write a meaningful audit policy, and verify audit events are captured.',
    duration: '25-35 minutes',
    steps: [
      {
        title: 'Create the audit policy and directory',
        instruction: `Create the audit configuration directory and policy file.

\`\`\`bash
# Create audit directories on the control plane node
sudo mkdir -p /etc/kubernetes/audit
sudo mkdir -p /var/log/kubernetes/audit

# Create the audit policy
sudo tee /etc/kubernetes/audit/policy.yaml <<'EOF'
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages:
- RequestReceived
rules:
# Log all secret operations in full detail
- level: RequestResponse
  resources:
  - group: ""
    resources: ["secrets"]

# Log pod exec at Request level
- level: Request
  verbs: ["create"]
  resources:
  - group: ""
    resources: ["pods/exec", "pods/portforward", "pods/attach"]

# Skip noisy health checks
- level: None
  nonResourceURLs: ["/healthz", "/readyz", "/livez", "/metrics"]

# Skip frequent reads on events
- level: None
  verbs: ["get", "list", "watch"]
  resources:
  - group: ""
    resources: ["events"]

# Catch-all: Metadata for everything else
- level: Metadata
EOF

# Verify
sudo cat /etc/kubernetes/audit/policy.yaml
\`\`\``,
        hints: [
          'omitStages: [RequestReceived] at policy level applies to ALL rules',
          'Rules are evaluated top-to-bottom, first match wins',
          'Catch-all rule must be LAST'
        ],
        solution: `\`\`\`bash
sudo mkdir -p /etc/kubernetes/audit /var/log/kubernetes/audit
sudo tee /etc/kubernetes/audit/policy.yaml <<'EOF'
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages: [RequestReceived]
rules:
- level: RequestResponse
  resources:
  - group: ""
    resources: ["secrets"]
- level: Metadata
EOF
\`\`\``,
        verify: `\`\`\`bash
sudo ls /etc/kubernetes/audit/
# Expected: policy.yaml

sudo python3 -c "import yaml; yaml.safe_load(open('/etc/kubernetes/audit/policy.yaml'))" && echo "Valid YAML"
# Expected: Valid YAML
\`\`\``
      },
      {
        title: 'Configure the API server',
        instruction: `Edit the API server manifest to enable audit logging.

Edit \`/etc/kubernetes/manifests/kube-apiserver.yaml\`:

**Add to spec.containers[0].command:**
\`\`\`
- --audit-policy-file=/etc/kubernetes/audit/policy.yaml
- --audit-log-path=/var/log/kubernetes/audit/audit.log
- --audit-log-maxage=30
- --audit-log-maxbackup=10
- --audit-log-maxsize=100
\`\`\`

**Add to spec.containers[0].volumeMounts:**
\`\`\`yaml
- mountPath: /etc/kubernetes/audit
  name: audit-config
  readOnly: true
- mountPath: /var/log/kubernetes/audit
  name: audit-log
\`\`\`

**Add to spec.volumes:**
\`\`\`yaml
- name: audit-config
  hostPath:
    path: /etc/kubernetes/audit
    type: DirectoryOrCreate
- name: audit-log
  hostPath:
    path: /var/log/kubernetes/audit
    type: DirectoryOrCreate
\`\`\`

\`\`\`bash
# Watch for API server restart
watch kubectl get pods -n kube-system | grep apiserver
\`\`\``,
        hints: [
          'ALWAYS backup: sudo cp /etc/kubernetes/manifests/kube-apiserver.yaml /tmp/backup.yaml',
          'If API server crashes, restore: sudo cp /tmp/backup.yaml /etc/kubernetes/manifests/kube-apiserver.yaml',
          'Both volume mounts (config + log dir) are required'
        ],
        solution: `\`\`\`bash
# After manually editing the file, check it restarted:
kubectl get pods -n kube-system | grep apiserver
# Should show Running with RESTARTS = 1
\`\`\``,
        verify: `\`\`\`bash
# API server must be Running
kubectl get pods -n kube-system | grep apiserver
# Expected: Running

# Audit log file must exist
sudo ls -la /var/log/kubernetes/audit/audit.log
# Expected: file with non-zero size

# Verify flags
kubectl get pod -n kube-system -l component=kube-apiserver -o yaml | grep "audit"
# Expected: --audit-policy-file and --audit-log-path present
\`\`\``
      },
      {
        title: 'Verify audit logging captures events',
        instruction: `Create and delete a Secret, then find those operations in the audit log.

\`\`\`bash
# Perform some operations that should be audited
kubectl create secret generic audit-test --from-literal=key=secretvalue
kubectl get secret audit-test
kubectl delete secret audit-test

# Read the audit log
sudo tail -100 /var/log/kubernetes/audit/audit.log | python3 -c "
import json, sys
for line in sys.stdin:
  try:
    e = json.loads(line)
    if e.get('objectRef', {}).get('resource') == 'secrets':
      print(f\"{e['user']['username']} {e['verb']} {e.get('objectRef',{}).get('namespace')}/{e.get('objectRef',{}).get('name')} -> {e.get('responseStatus',{}).get('code')}\")
  except:
    pass
"
\`\`\``,
        hints: [
          'Look for create, get, and delete verbs for the "audit-test" secret',
          'The user.username should match who you\'re logged in as (e.g., kubernetes-admin)',
          'Each entry is a JSON line — use python3 -m json.tool to pretty-print individual entries'
        ],
        solution: `\`\`\`bash
kubectl create secret generic audit-test --from-literal=key=test
kubectl delete secret audit-test
sudo grep '"audit-test"' /var/log/kubernetes/audit/audit.log | tail -5
\`\`\``,
        verify: `\`\`\`bash
# Secret operations should be in the log
sudo grep '"secrets"' /var/log/kubernetes/audit/audit.log | grep '"audit-test"' | wc -l
# Expected: >= 2 (create and delete events)

# Verify the log has the expected level
sudo grep '"audit-test"' /var/log/kubernetes/audit/audit.log | \
  python3 -c "import json,sys; [print(json.loads(l).get('level'), json.loads(l).get('verb')) for l in sys.stdin]"
# Expected: RequestResponse create
#           RequestResponse delete
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Audit log file exists but is empty despite creating resources',
      difficulty: 'medium',
      symptom: 'The audit.log file was created but no entries are written even after creating Secrets.',
      diagnosis: `\`\`\`bash
# Check the API server flags are set
kubectl get pod -n kube-system -l component=kube-apiserver -o yaml | grep audit

# Check for errors in API server logs
kubectl logs -n kube-system -l component=kube-apiserver | grep -i "audit"

# Verify the policy file is accessible from inside the pod
kubectl exec -n kube-system kube-apiserver-$(hostname) -- cat /etc/kubernetes/audit/policy.yaml

# Check the audit policy syntax
sudo python3 -c "import yaml; yaml.safe_load(open('/etc/kubernetes/audit/policy.yaml'))" && echo "YAML valid"
\`\`\``,
      solution: `**Common causes:**

1. **Policy file path wrong**: The path in --audit-policy-file must match the volumeMount path
\`\`\`bash
grep "audit-policy-file" /etc/kubernetes/manifests/kube-apiserver.yaml
grep "mountPath.*audit" /etc/kubernetes/manifests/kube-apiserver.yaml
# Both paths must resolve to the same location in the container
\`\`\`

2. **Policy has "level: None" catch-all first:**
\`\`\`yaml
# WRONG - skips everything:
rules:
- level: None    # this matches ALL requests first!
- level: RequestResponse
  resources: [...]

# CORRECT - specific rules first:
rules:
- level: RequestResponse
  resources: [...]
- level: None    # or skip entirely, use Metadata as catch-all
- level: Metadata
\`\`\`

3. **Volume not mounting from correct host path**: Verify hostPath.path matches where you created the policy file.`
    },
    {
      title: 'Audit logs growing too large, filling disk',
      difficulty: 'medium',
      symptom: 'The audit log volume is consuming 50GB+ and growing rapidly. Other cluster operations are failing with "no space left on device".',
      diagnosis: `\`\`\`bash
# Check disk usage
df -h /var/log/kubernetes/audit/

# Check log sizes
ls -lh /var/log/kubernetes/audit/

# Find which resources generate most events
cat /var/log/kubernetes/audit/audit.log | \
  python3 -c "
from collections import Counter
import json, sys
c = Counter()
for l in sys.stdin:
  try:
    e = json.loads(l)
    r = e.get('objectRef',{}).get('resource') or e.get('requestURI','?')[:50]
    c[e.get('verb','?')+'_'+r] += 1
  except: pass
for op, n in c.most_common(15): print(n, op)
"
\`\`\``,
      solution: `**Reduce audit log volume:**

\`\`\`yaml
# Add more None rules in the audit policy
rules:
# Skip all reads (biggest noise source)
- level: None
  verbs: ["get", "list", "watch"]

# Skip system components
- level: None
  users:
  - system:kube-controller-manager
  - system:kube-scheduler
  userGroups:
  - system:nodes

# Skip health checks
- level: None
  nonResourceURLs: ["/healthz", "/readyz", "/livez", "/metrics", "/apis"]

# Keep RequestResponse only for critical resources
- level: RequestResponse
  resources:
  - group: ""
    resources: ["secrets"]

# Reduce catch-all to None for non-critical operations
- level: None
  verbs: ["get", "list", "watch"]

# Minimal catch-all
- level: Metadata
\`\`\`

\`\`\`bash
# Apply the updated policy (API server hot-reloads audit policy)
# Also rotate current log
sudo mv /var/log/kubernetes/audit/audit.log /var/log/kubernetes/audit/audit.log.old
# API server creates a new file automatically
\`\`\``
    }
  ]
};
