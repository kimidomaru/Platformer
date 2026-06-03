window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcsa-threat-model/attack-vectors'] = {
  theory: `# Attack Vectors in Kubernetes

## Exam Relevance
> KCSA tests knowledge of common Kubernetes attack paths. Expect questions about specific attack techniques, what they exploit, and which controls prevent them. Hands-on understanding of how attacks work helps identify mitigations.

## Attack Vector Categories

### 1. External Attacks
The attacker starts outside the cluster.

### 2. Internal/Lateral Attacks
The attacker has initial access (compromised pod) and moves laterally.

### 3. Insider Threats
Legitimate user misuses their access.

## Key Kubernetes Attack Vectors

### Vector 1: Exposed Kubernetes API Server

**What it is**: kube-apiserver listening on a public IP without proper authentication or authorization.

**Attack technique**:
\`\`\`bash
# Attacker scans for exposed API servers
curl -sk https://<public-ip>:6443/api/v1/namespaces
# If anonymous auth is enabled or default SA is permissive — game over
\`\`\`

**Indicators of vulnerability**:
- API server bound to 0.0.0.0
- Anonymous auth enabled (\`--anonymous-auth=true\`)
- Overly permissive system:anonymous or system:unauthenticated bindings
- No IP allowlist

**Mitigations**:
- Private cluster (API in VPC only)
- IP allowlist / firewall rules
- Disable anonymous auth
- Strong RBAC (no permissions for unauthenticated users)

---

### Vector 2: Exposed etcd

**What it is**: etcd accessible without authentication, often on port 2379.

**Attack technique**:
\`\`\`bash
# If etcd is open without certs
etcdctl --endpoints=http://<ip>:2379 get / --prefix --keys-only
etcdctl get /registry/secrets/default/db-password  # read any secret!
\`\`\`

**Why it's critical**: Bypasses the API server and all RBAC. Can read all Secrets, modify any resource.

**Mitigations**:
- Require certificate-based auth (\`--client-cert-auth=true\`)
- Firewall: only API server can reach etcd
- Encrypt data at rest (EncryptionConfiguration)

---

### Vector 3: Container Escape

**What it is**: Exploiting container misconfiguration to gain node-level access.

**Privileged container escape**:
\`\`\`bash
# Inside a privileged container
nsenter -t 1 -m -u -i -n -p -- bash
# Now you have a shell on the HOST with root access!
\`\`\`

**hostPath volume escape**:
\`\`\`bash
# A container with hostPath: /
# can read/write the entire node filesystem
ls /host-root/etc/kubernetes/pki/  # access cluster certs!
\`\`\`

**Mitigations**:
- No \`privileged: true\` in securityContext
- No \`hostPID: true\` / \`hostNetwork: true\`
- No \`hostPath\` volumes mounting sensitive directories
- Use Pod Security Standards (restricted)
- Use sandbox runtimes (gVisor, Kata Containers)

---

### Vector 4: RBAC Misconfiguration (Privilege Escalation)

**What it is**: Exploiting overly permissive RBAC roles.

**Common dangerous permissions**:
\`\`\`
Verb: create    Resource: pods     → can create privileged pods
Verb: *         Resource: *        → cluster-admin equivalent
Verb: escalate  Resource: roles    → can create new permissions
Verb: bind      Resource: roles    → can bind permissions to themselves
Verb: exec      Resource: pods     → can exec into any pod (like a backdoor)
\`\`\`

**Escalation via pod creation**:
\`\`\`yaml
# If you can create pods, you can create a privileged one:
spec:
  hostPID: true
  containers:
  - name: escape
    image: alpine
    command: ["nsenter", "-t", "1", "-m", "-u", "-i", "-n", "-p", "--", "bash"]
    securityContext:
      privileged: true
\`\`\`

**Mitigations**:
- Least-privilege RBAC (no \`*\` verbs on \`*\` resources)
- Audit RBAC regularly (RBAC tools: \`kubectl-who-can\`, \`rbac-police\`)
- PodSecurity to prevent privileged pod creation even if RBAC allows it

---

### Vector 5: Supply Chain Attack

**What it is**: Malicious code delivered through the container image or dependencies.

**Attack scenarios**:
- Compromised upstream base image (e.g., nginx:latest tagged with malware)
- Typosquatting (imaginary-corp/nginx vs legitimate nginx)
- Compromised internal build pipeline
- Malicious npm/pip package included in app

**Detection/Mitigations**:
- Image scanning before deployment (Trivy, Snyk)
- Image signing + verification (Cosign/Sigstore)
- Admission webhook to verify signatures
- Pin to specific digest: \`nginx@sha256:abc123...\` (not :latest)
- Private registry with access control

---

### Vector 6: Cloud Metadata Service Exploitation

**What it is**: A pod accesses the instance metadata service to steal cloud IAM credentials.

\`\`\`bash
# From inside a pod, steal the node's IAM role credentials:
curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/
# Then use those credentials to access S3, EC2, RDS, etc.
\`\`\`

**Mitigations**:
- NetworkPolicy blocking 169.254.169.254/32
- AWS: IMDSv2 with hop limit = 1
- Workload Identity (IRSA) to eliminate node-level cloud credentials

---

### Vector 7: Kubernetes Dashboard Attack

**What it is**: The Kubernetes Dashboard exposed without authentication.

**Historical example**: Tesla breach (2018) — dashboard exposed publicly, no auth, used for cryptomining.

**Mitigations**:
- Never expose Dashboard without authentication
- Use RBAC-limited service account for Dashboard
- Access via kubectl proxy or VPN only
- Use authentication proxy (OAuth2 Proxy)

---

### Vector 8: Secret Exposure

**What it is**: Kubernetes Secrets accessible due to misconfiguration.

**Attack paths**:
\`\`\`bash
# Via overly permissive RBAC:
kubectl get secrets --all-namespaces -o yaml | grep -A5 "data:"

# Via pod environment variables (visible in /proc):
cat /proc/1/environ | tr '\0' '\n' | grep -i "password\|secret\|token"

# Via logs (app prints secrets):
kubectl logs <pod> | grep -i "password\|token"
\`\`\`

**Mitigations**:
- Least-privilege RBAC (explicitly deny \`get\` on secrets where not needed)
- Mount secrets as files (not env vars) — harder to accidentally log
- Encryption at rest for etcd
- External secrets manager (Vault, AWS Secrets Manager)
- Audit secret access in audit logs

## Attack Chain Example

How an attacker moves from initial access to cluster takeover:

\`\`\`
1. INITIAL ACCESS
   ↓ Exploits web app vulnerability (SQL injection)
   ↓ Gets RCE in application container

2. DISCOVERY
   ↓ Reads SA token from /var/run/secrets/kubernetes.io/serviceaccount/
   ↓ Finds API server address from KUBERNETES_SERVICE_HOST env var
   ↓ Enumerates RBAC permissions: kubectl auth can-i --list

3. PRIVILEGE ESCALATION
   ↓ Found: SA can create pods
   ↓ Creates privileged pod mounting hostPath /

4. NODE COMPROMISE
   ↓ chroot /host-root — now on the node
   ↓ Reads /etc/kubernetes/pki/ca.key — cluster CA!
   ↓ Can now sign any certificate = full cluster admin

5. LATERAL MOVEMENT
   ↓ Creates new admin ServiceAccount with ClusterRoleBinding
   ↓ Deploys backdoor DaemonSet on all nodes
\`\`\`

## Indicators of Compromise (IOC)

\`\`\`bash
# Unusual pod creation in kube-system
kubectl get pods -n kube-system | grep -v "Running"

# New ClusterRoleBindings
kubectl get clusterrolebindings --sort-by='.metadata.creationTimestamp'

# Exec events in audit log
grep '"verb":"exec"' /var/log/kubernetes/audit.log

# Unexpected network connections (if Falco is running)
# Event: "A shell was spawned in a container"
\`\`\`
`,
  quiz: [
    {
      question: 'What is the most critical risk when etcd is accessible without authentication?',
      options: [
        'An attacker can read all cluster data including Secrets, bypassing RBAC completely',
        'The cluster becomes unstable due to unauthorized write operations',
        'Pod scheduling is disrupted',
        'API server certificates are automatically revoked'
      ],
      correct: 0,
      explanation: 'Unauthenticated etcd access gives an attacker direct read/write to all Kubernetes state. This bypasses the API server and RBAC — they can read any Secret and modify any resource.',
      reference: 'Review "Vector 2: Exposed etcd" section.'
    },
    {
      question: 'What Linux tool can be used inside a privileged container to escape to the host?',
      options: [
        'nsenter with PID 1 (init process) to enter host namespaces',
        'kubectl exec to access other containers',
        'ip route to change host routing tables',
        'crictl to manage the container runtime'
      ],
      correct: 0,
      explanation: 'nsenter -t 1 -m -u -i -n -p enters the host namespaces (PID 1 is init, which runs in the host namespace). From a privileged container with hostPID: true, this gives a full root shell on the node.',
      reference: 'Review "Vector 3: Container Escape" — Privileged container escape.'
    },
    {
      question: 'Which RBAC permission is particularly dangerous because it allows creating privileged pods?',
      options: [
        'verb: create, resource: pods',
        'verb: get, resource: secrets',
        'verb: list, resource: nodes',
        'verb: watch, resource: deployments'
      ],
      correct: 0,
      explanation: 'The ability to create pods is dangerous because you can create a privileged pod with hostPID or hostPath volumes that allows node escape. Even with RBAC restrictions, Pod Security Standards are needed to prevent this.',
      reference: 'Review "Vector 4: RBAC Misconfiguration" — Escalation via pod creation.'
    },
    {
      question: 'What is the safest way to pin a container image to prevent supply chain attacks?',
      options: [
        'Use the image digest: nginx@sha256:abc123... (immutable reference)',
        'Always use the :latest tag which contains the most secure version',
        'Use a private registry with automatic mirroring',
        'Use the image name without any tag (defaults to latest)'
      ],
      correct: 0,
      explanation: 'Image digests (SHA256) are immutable — the exact same bytes are always returned. Tags (including :latest) can be reassigned to point to different images. Pinning by digest is immune to tag-based supply chain attacks.',
      reference: 'Review "Vector 5: Supply Chain Attack" — Pin to specific digest.'
    },
    {
      question: 'How did the Tesla 2018 Kubernetes breach occur?',
      options: [
        'The Kubernetes Dashboard was exposed publicly without authentication and was used for cryptomining',
        'Tesla\'s etcd had a public endpoint without certificate authentication',
        'A compromised Docker image was deployed from Docker Hub',
        'An overly permissive ClusterRoleBinding was exploited'
      ],
      correct: 0,
      explanation: 'Tesla\'s Kubernetes Dashboard was exposed on the internet without password protection. Attackers found it, used it to access cluster resources, and deployed cryptomining pods. A famous real-world Kubernetes attack.',
      reference: 'Review "Vector 7: Kubernetes Dashboard Attack" section.'
    },
    {
      question: 'How can a container access the cloud metadata service to steal credentials?',
      options: [
        'By making HTTP requests to 169.254.169.254 — accessible by default from all pods',
        'By reading /etc/cloud/credentials inside the container',
        'By using kubectl to query cloud provider secrets',
        'By exploiting a vulnerability in the CNI plugin'
      ],
      correct: 0,
      explanation: 'The cloud metadata endpoint (169.254.169.254) is accessible from all pods by default. A compromised container can curl this address to retrieve the node\'s IAM role credentials and use them for cloud-level attacks.',
      reference: 'Review "Vector 6: Cloud Metadata Service Exploitation" section.'
    },
    {
      question: 'What is the first step in a typical Kubernetes attack chain after gaining RCE in a pod?',
      options: [
        'Discovery — reading SA token and enumerating RBAC permissions',
        'Lateral movement — immediately scanning other pods',
        'Privilege escalation — creating a privileged pod',
        'Persistence — creating a backdoor DaemonSet'
      ],
      correct: 0,
      explanation: 'After initial access (RCE), attackers do Discovery: read the SA token from /var/run/secrets/, find the API server address from env vars, and enumerate their RBAC permissions (kubectl auth can-i --list). Then decide on escalation path.',
      reference: 'Review "Attack Chain Example" section.'
    },
    {
      question: 'What is the purpose of Cosign (Sigstore) in Kubernetes security?',
      options: [
        'Cryptographically signing container images to verify authenticity and prevent supply chain attacks',
        'Signing Kubernetes manifest files for GitOps integrity',
        'Providing mTLS certificate rotation for service meshes',
        'Signing audit log entries to prevent tampering'
      ],
      correct: 0,
      explanation: 'Cosign (part of Sigstore project) signs container images with cryptographic signatures. Combined with an admission webhook (Kyverno, OPA), you can require that only signed images run in the cluster — preventing unsigned/malicious images.',
      reference: 'Review "Vector 5: Supply Chain Attack" — Image signing.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4 most critical Kubernetes attack vectors?',
      back: '1. Exposed API server / etcd (no auth). 2. Container escape via privileged/hostPath. 3. RBAC privilege escalation (create pods → node escape). 4. Supply chain (malicious image). Also: metadata service credentials theft, Secret exposure.'
    },
    {
      front: 'How does a container escape to the host via a privileged container?',
      back: 'nsenter -t 1 -m -u -i -n -p -- bash — enters all host namespaces from PID 1 (init). Requires privileged: true or hostPID: true. Prevention: Pod Security Standards restricted level, no privileged: true.'
    },
    {
      front: 'What is the typical Kubernetes attack chain?',
      back: 'Initial Access (exploit app) → Discovery (read SA token, RBAC enum) → Privilege Escalation (create privileged pod) → Node Compromise (nsenter / hostPath) → Persistence (DaemonSet backdoor) → Lateral Movement (cluster-wide access).'
    },
    {
      front: 'Why is pinning by digest safer than by tag for container images?',
      back: 'Tags (nginx:1.21, :latest) can be reassigned to different images. A digest (nginx@sha256:abc123) is a cryptographic hash of the image content — it\'s immutable and cannot be spoofed. Supply chain attacks often work by replacing tagged images.'
    },
    {
      front: 'What RBAC permissions are particularly dangerous?',
      back: 'verb: * / resource: * (cluster-admin equivalent). verb: create / resource: pods (can create privileged pods → node escape). verb: escalate/bind (can create new permissions). verb: exec (backdoor access to any pod).'
    },
    {
      front: 'What are Indicators of Compromise (IOC) in Kubernetes?',
      back: 'Unusual pods in kube-system, new ClusterRoleBindings with late creation timestamps, exec events in audit logs, unexpected DaemonSets, Falco alerts for shell spawned in container, pods with suspicious network connections, crypto-miner resource spikes.'
    }
  ],
  lab: {
    scenario: 'Simulate and understand Kubernetes attack vectors in a safe lab environment. Practice identifying vulnerable configurations and applying mitigations.',
    objective: 'Understand how container misconfiguration leads to host compromise, and how to prevent it.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Demonstrate: RBAC privilege escalation via pod creation',
        instruction: `Create a ServiceAccount that can only create pods (not cluster-admin). Show that with this permission, you can escalate to node access by creating a privileged pod. Then demonstrate the mitigation.`,
        hints: [
          'Create a role with only "create pods" permission',
          'Show the privileged pod YAML that would enable node escape',
          'Apply Pod Security Standards to the namespace to block the privileged pod'
        ],
        solution: `\`\`\`bash
kubectl create namespace attack-demo 2>/dev/null || true

# Create limited SA with only pod create
kubectl create serviceaccount limited-sa -n attack-demo
kubectl create role pod-creator --verb=create --resource=pods -n attack-demo
kubectl create rolebinding pod-creator-binding \\
  --role=pod-creator --serviceaccount=attack-demo:limited-sa \\
  -n attack-demo

# Show how even "limited" pod create = privilege escalation risk
cat <<EOF
=== ATTACK POD (would escape to host) ===
apiVersion: v1
kind: Pod
metadata:
  name: escape-pod
spec:
  hostPID: true          # access host PID namespace
  containers:
  - name: escape
    image: alpine
    command: ["nsenter", "-t", "1", "-m", "-u", "-i", "-n", "-p", "--", "id"]
    securityContext:
      privileged: true   # privileged container
EOF
\`\`\``,
        verify: `\`\`\`bash
# Apply Pod Security Standards to prevent this attack
kubectl label namespace attack-demo \\
  pod-security.kubernetes.io/enforce=restricted \\
  pod-security.kubernetes.io/enforce-version=latest

# Now try creating the privileged pod — it should be DENIED
kubectl run escape-pod \\
  --image=alpine \\
  --privileged \\
  -n attack-demo \\
  -- sh 2>&1 | head -5
# Expected: Error: pods "escape-pod" is forbidden: violates PodSecurity "restricted"

# Cleanup
kubectl delete namespace attack-demo
\`\`\``
      },
      {
        title: 'Demonstrate: ServiceAccount token access to API server',
        instruction: `Show how a pod can use its ServiceAccount token to query the Kubernetes API. This demonstrates the Discovery phase of an attack. Then show how to disable token automounting to mitigate.`,
        hints: [
          'kubectl run to create a pod and exec into it',
          'Inside the pod: TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)',
          'curl -sk https://kubernetes.default.svc/api/v1/namespaces -H "Authorization: Bearer $TOKEN"'
        ],
        solution: `\`\`\`bash
# Create a pod that demonstrates API access via SA token
kubectl run api-access-demo \\
  --image=curlimages/curl \\
  --restart=Never \\
  -- sleep 3600

kubectl wait pod/api-access-demo --for=condition=Ready --timeout=30s

# Show the attack: SA token is auto-mounted and can query the API
kubectl exec api-access-demo -- sh -c '
  TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
  CACERT=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
  SERVER=https://kubernetes.default.svc
  echo "=== Pod SA can query API ==="
  curl -sk --cacert $CACERT \\
    -H "Authorization: Bearer $TOKEN" \\
    $SERVER/api/v1/namespaces/default/pods 2>&1 | head -5
'
\`\`\``,
        verify: `\`\`\`bash
# Mitigation: disable automounting to prevent token exposure
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: no-token-pod
spec:
  automountServiceAccountToken: false  # SA token NOT mounted
  containers:
  - name: app
    image: curlimages/curl
    command: ["sleep", "3600"]
EOF

kubectl wait pod/no-token-pod --for=condition=Ready --timeout=30s

# Verify: no token file in the pod
kubectl exec no-token-pod -- ls /var/run/secrets/ 2>&1
# Expected: cannot access '/var/run/secrets/': No such file or directory

# Cleanup
kubectl delete pod api-access-demo no-token-pod
\`\`\``
      },
      {
        title: 'Demonstrate: Secret exposure via environment variables',
        instruction: `Create a pod with a Secret exposed as an environment variable. Show how the Secret value is visible in /proc and in pod inspect output. Then demonstrate the safer alternative: mounting as a file.`,
        hints: [
          'Create a Secret with sensitive data',
          'Pod exposes it as env var',
          'kubectl exec into pod: cat /proc/1/environ shows the secret!',
          'Alternative: volumeMount with secretKeyRef'
        ],
        solution: `\`\`\`bash
kubectl create secret generic db-secret \\
  --from-literal=DB_PASSWORD=supersecret123

# Unsafe: Secret as environment variable
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: secret-env-pod
spec:
  containers:
  - name: app
    image: busybox
    command: ["sleep", "3600"]
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: DB_PASSWORD
EOF

kubectl wait pod/secret-env-pod --for=condition=Ready --timeout=30s

# Attack vector: read from /proc
kubectl exec secret-env-pod -- cat /proc/1/environ | tr '\\0' '\\n' | grep DB_PASSWORD
# Expected: DB_PASSWORD=supersecret123 ← VISIBLE!
\`\`\``,
        verify: `\`\`\`bash
# Safer alternative: mount as file (still readable, but less likely to be logged)
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: secret-volume-pod
spec:
  containers:
  - name: app
    image: busybox
    command: ["sleep", "3600"]
    volumeMounts:
    - name: secret-vol
      mountPath: /secrets
      readOnly: true
  volumes:
  - name: secret-vol
    secret:
      secretName: db-secret
EOF

kubectl wait pod/secret-volume-pod --for=condition=Ready --timeout=30s

kubectl exec secret-volume-pod -- cat /secrets/DB_PASSWORD
# Expected: supersecret123 — still readable but NOT in /proc/environ

# Best practice: Use external secrets manager (HashiCorp Vault) to avoid K8s secrets entirely

# Cleanup
kubectl delete pod secret-env-pod secret-volume-pod
kubectl delete secret db-secret
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Detecting and removing a backdoor DaemonSet',
      difficulty: 'hard',
      symptom: 'Intrusion detected. Suspicious DaemonSet found in kube-system namespace creating pods on all nodes. Need to investigate and remediate.',
      diagnosis: `\`\`\`bash
# List all DaemonSets and look for anomalies
kubectl get daemonsets --all-namespaces
# Look for: unknown names, recently created, unexpected namespaces

# Check DaemonSet details
kubectl describe daemonset <suspicious-name> -n kube-system

# Check what the pods are doing
kubectl logs -n kube-system daemonset/<suspicious-name>

# Check for outbound connections (if network tools available)
kubectl exec -n kube-system <pod-name> -- ss -tnp 2>/dev/null || netstat -tnp

# Check for crypto-miner indicators
kubectl top pods --all-namespaces | sort -k3 -rn | head -10
# High CPU usage from unknown pods = cryptominer

# Review recent events
kubectl get events --all-namespaces --sort-by='.lastTimestamp' | tail -20
\`\`\``,
      solution: `Incident response steps:

1. **Contain**: Delete the malicious DaemonSet immediately
\`\`\`bash
kubectl delete daemonset <name> -n kube-system
kubectl get pods -n kube-system | grep <name> # should terminate
\`\`\`

2. **Revoke compromised credentials**: Delete compromised ServiceAccount tokens
\`\`\`bash
kubectl delete secret $(kubectl get secrets -n <ns> | grep <sa-name> | awk '{print $1}') -n <ns>
\`\`\`

3. **Audit RBAC**: How did the attacker create a DaemonSet in kube-system?
\`\`\`bash
kubectl get clusterrolebindings -o yaml | grep -B5 "kube-system"
\`\`\`

4. **Check for persistence**: Look for other backdoors
\`\`\`bash
kubectl get all --all-namespaces | grep -v "Running"
kubectl get clusterrolebindings --sort-by='.metadata.creationTimestamp'
\`\`\`

5. **Rotate certificates and credentials**: If node or admin credentials were compromised, rotate them.`
    },
    {
      title: 'Container reading host filesystem via hostPath',
      difficulty: 'medium',
      symptom: 'Security scan finds a pod with hostPath: / mounted. The container can read host files including /etc/kubernetes/pki/. This is a critical finding.',
      diagnosis: `\`\`\`bash
# Find pods with hostPath mounts
kubectl get pods --all-namespaces -o json | \\
  python3 -c "
import json, sys
pods = json.load(sys.stdin)
for p in pods['items']:
  vols = p['spec'].get('volumes', [])
  for v in vols:
    if 'hostPath' in v:
      print(f'{p[\"metadata\"][\"namespace\"]}/{p[\"metadata\"][\"name\"]}: hostPath={v[\"hostPath\"][\"path\"]}')
"

# Check if the pod has access to sensitive paths
kubectl exec <pod-name> -n <ns> -- ls /host-path-mount/etc/kubernetes/pki/ 2>/dev/null
\`\`\``,
      solution: `Remove the hostPath mount and replace with a safer alternative:

1. **Edit the Deployment** to remove hostPath:
\`\`\`bash
kubectl edit deployment <name> -n <namespace>
# Remove the hostPath volume and its volumeMount
\`\`\`

2. If the app needs node data, use a **downwardAPI** or specific allowed paths:
\`\`\`yaml
volumes:
- name: logs
  hostPath:
    path: /var/log/app         # limited path
    type: DirectoryOrCreate    # only this specific directory
\`\`\`

3. **Apply Pod Security Standards** to prevent future hostPath abuse:
\`\`\`bash
kubectl label namespace <ns> \\
  pod-security.kubernetes.io/enforce=restricted
\`\`\`

Note: PSS "restricted" level disallows hostPath volumes entirely.`
    }
  ]
};
