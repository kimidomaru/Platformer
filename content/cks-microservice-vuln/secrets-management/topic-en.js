window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-microservice-vuln/secrets-management'] = {
  theory: `# Advanced Secrets Management

## Exam Relevance
> CKS goes beyond KCSA — expect encryption at rest (EncryptionConfiguration), external secrets integration, and Secret exposure detection. Appears in Minimize Microservice Vulnerabilities (~10%) and Cluster Hardening.

## Kubernetes Secret Weaknesses

Kubernetes Secrets are **not encrypted by default** — they are base64-encoded and stored as plaintext in etcd:

\`\`\`bash
# Prove Kubernetes Secrets are NOT secure without encryption:
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/default/my-secret

# Output shows plaintext data!
\`\`\`

**Other exposure risks:**
- Printed in environment variables (\`kubectl exec -- printenv\`)
- Visible in \`/proc/1/environ\` from inside the container
- Logged by applications that print all env vars
- Accessible to anyone with \`get secrets\` permission in the namespace

## EncryptionConfiguration (Encryption at Rest)

\`\`\`yaml
# /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets                        # encrypt Secrets
  - configmaps                     # optionally encrypt ConfigMaps too
  providers:
  - aescbc:                        # AES-CBC encryption (recommended)
      keys:
      - name: key1
        secret: <32-byte-base64-key>   # generate below
  - identity: {}                   # fallback: read unencrypted (for migration)
\`\`\`

\`\`\`bash
# Generate a 32-byte key
head -c 32 /dev/urandom | base64

# Add to API server
# /etc/kubernetes/manifests/kube-apiserver.yaml:
# - --encryption-provider-config=/etc/kubernetes/encryption-config.yaml

# Mount the file
volumes:
- name: encryption-config
  hostPath:
    path: /etc/kubernetes/encryption-config.yaml
    type: File
volumeMounts:
- mountPath: /etc/kubernetes/encryption-config.yaml
  name: encryption-config
  readOnly: true
\`\`\`

### Encryption Providers

| Provider | Notes | Use Case |
|----------|-------|----------|
| identity | No encryption — plaintext | Migration fallback (READ only) |
| aescbc | AES-256-CBC | Recommended, widely supported |
| aesgcm | AES-256-GCM | Faster, but key rotation is harder |
| secretbox | NaCl secretbox | Alternative |
| kms | External KMS (Vault, AWS KMS) | Best practice for production |
| kms v2 | KMS v2 protocol | K8s 1.27+, better performance |

**Provider order matters**: first provider is used for writing; all are tried for reading.

### Force Re-encryption of Existing Secrets

\`\`\`bash
# After enabling encryption, existing Secrets are still unencrypted!
# Force re-write of all Secrets to encrypt them:
kubectl get secrets -A -o json | kubectl replace -f -

# Or for a single namespace:
kubectl get secrets -n default -o json | kubectl replace -f -

# Verify encryption worked:
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/default/my-secret | hexdump -C | head
# Should show: k8s:enc:aescbc:v1:... (encrypted prefix)
\`\`\`

## Volume Mount vs Environment Variable

### Volume Mount (Preferred)

\`\`\`yaml
spec:
  containers:
  - name: app
    image: myapp
    volumeMounts:
    - name: db-secret
      mountPath: /etc/secrets
      readOnly: true
  volumes:
  - name: db-secret
    secret:
      secretName: database-credentials
      defaultMode: 0400    # restrict permissions
\`\`\`

**Benefits:**
- Not in \`/proc/1/environ\` (not in environment)
- Can be updated without pod restart (for non-immutable secrets)
- Application reads from file — less risk of accidental logging

### Environment Variable (Avoid When Possible)

\`\`\`yaml
env:
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: database-credentials
      key: password
\`\`\`

**Risks:**
- Visible in \`kubectl exec -- printenv\`
- Captured in crash dumps
- Applications may log environment variables on startup
- Exposed in \`/proc/1/environ\`

## Immutable Secrets

\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: immutable-secret
type: Opaque
immutable: true          # prevents any updates
data:
  key: dmFsdWU=
\`\`\`

**Benefits:**
- Prevents accidental modification
- Kubernetes stops watching for changes — reduces API server load for large clusters
- Detect tampering: cannot be changed, must be deleted and recreated

## External Secrets Operator (ESO)

ESO pulls secrets from external vaults into Kubernetes Secrets:

\`\`\`yaml
# ExternalSecret (ESO CRD)
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-secret
  namespace: production
spec:
  refreshInterval: 1h                     # re-sync interval
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: database-credentials             # Kubernetes Secret to create
    creationPolicy: Owner
  data:
  - secretKey: password                    # key in K8s Secret
    remoteRef:
      key: secret/data/production/db       # path in Vault
      property: password                   # field in Vault secret

---
# ClusterSecretStore — connects to HashiCorp Vault
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: vault-backend
spec:
  provider:
    vault:
      server: https://vault.company.com
      path: secret
      version: v2
      auth:
        kubernetes:
          mountPath: kubernetes
          role: external-secrets
\`\`\`

## Sealed Secrets

Encrypt Secrets for safe storage in Git:

\`\`\`bash
# Install kubeseal CLI
wget -O kubeseal https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/kubeseal-0.24.0-linux-amd64
chmod +x kubeseal && sudo mv kubeseal /usr/local/bin/

# Seal a Secret
kubectl create secret generic my-secret \
  --dry-run=client \
  --from-literal=password=supersecret \
  -o yaml | \
  kubeseal --controller-namespace kube-system \
           --controller-name sealed-secrets-controller \
           --format yaml > sealed-secret.yaml

# Apply the SealedSecret (safe to commit to Git)
kubectl apply -f sealed-secret.yaml

# The controller decrypts it and creates the regular Secret
kubectl get secret my-secret
\`\`\`

## SOPS (Secrets OPerationS)

Encrypt secret files for GitOps:

\`\`\`bash
# Install sops
wget -O sops https://github.com/mozilla/sops/releases/download/v3.8.1/sops-v3.8.1.linux.amd64
chmod +x sops && sudo mv sops /usr/local/bin/

# Encrypt a Secret manifest with AWS KMS
sops --kms arn:aws:kms:us-east-1:123456789:key/abc-123 \
     -e secret.yaml > secret.enc.yaml

# Or with GPG
sops --pgp FINGERPRINT -e secret.yaml > secret.enc.yaml

# Decrypt and apply
sops -d secret.enc.yaml | kubectl apply -f -
\`\`\`

## Detecting Secret Exposure

\`\`\`bash
# Check if Secrets are used as env vars (security risk)
kubectl get pods -A -o json | \
  python3 -c "
import json, sys
d = json.load(sys.stdin)
for item in d['items']:
  ns = item['metadata']['namespace']
  name = item['metadata']['name']
  for container in item['spec'].get('containers', []):
    for env in container.get('env', []):
      if env.get('valueFrom', {}).get('secretKeyRef'):
        print(f'{ns}/{name}/{container[\"name\"]}: SECRET in env: {env[\"name\"]}')
"

# Check for secrets accessible to a service account
kubectl auth can-i list secrets -n production \
  --as=system:serviceaccount:production:default

# Audit Secrets access in audit logs
grep '"resource":"secrets"' /var/log/kubernetes/audit.log | \
  python3 -c "import json,sys; [print(json.loads(l)['user']['username'], json.loads(l)['verb']) for l in sys.stdin]"
\`\`\`

## Vault Integration (Brief)

HashiCorp Vault provides enterprise-grade secrets management:

\`\`\`bash
# Vault Agent Sidecar (inject secrets into pods)
# Add annotations to pod:
vault.hashicorp.com/agent-inject: "true"
vault.hashicorp.com/role: "my-app-role"
vault.hashicorp.com/agent-inject-secret-config.txt: "secret/data/production/db"
vault.hashicorp.com/agent-inject-template-config.txt: |
  {{- with secret "secret/data/production/db" -}}
  DB_PASSWORD={{ .Data.data.password }}
  {{- end -}}
\`\`\`

**Benefits over K8s Secrets:**
- Dynamic secrets (generated on request, auto-expire)
- Full audit trail (who accessed what, when)
- Fine-grained policies
- Secret leasing and renewal
- PKI, SSH, database credential management

## Common Mistakes

- **Enabling encryption but not re-encrypting existing Secrets**: Old Secrets remain unencrypted — must force re-write
- **Using only one encryption key**: No way to rotate without downtime — always have a fallback key
- **Environment variables for sensitive data**: Use volume mounts instead
- **Not restricting RBAC on secrets**: Any pod in the namespace can read secrets if RBAC is not locked down

## Killer.sh Style Challenge

> **Scenario**: Enable Secret encryption at rest on the cluster. Use aescbc with a newly generated key. After enabling, verify a newly created Secret is encrypted in etcd.
`,

  quiz: [
    {
      question: 'By default, how are Kubernetes Secrets stored in etcd?',
      options: [
        'As base64-encoded plaintext — anyone with etcd access can read the actual values',
        'AES-256 encrypted with the cluster CA key',
        'SHA-256 hashed — cannot be reversed',
        'As binary blobs inaccessible via etcdctl'
      ],
      correct: 0,
      explanation: 'Without enabling EncryptionConfiguration, Kubernetes Secrets are stored in etcd as base64-encoded data. base64 is encoding, not encryption. Anyone with etcd access (file access, etcdctl) can read all secret values by base64-decoding them.',
      reference: 'Advanced Secrets Management — Kubernetes Secret Weaknesses section.'
    },
    {
      question: 'After enabling EncryptionConfiguration on the API server, what must you do to encrypt existing Secrets?',
      options: [
        'Force re-write all existing Secrets: kubectl get secrets -A -o json | kubectl replace -f -',
        'Nothing — enabling encryption automatically re-encrypts all existing Secrets',
        'Delete and recreate all Secrets',
        'Restart the etcd pod'
      ],
      correct: 0,
      explanation: 'EncryptionConfiguration only encrypts new writes. Existing Secrets are still stored unencrypted in etcd. You must force a re-write (replace) of all Secrets to trigger re-encryption through the API server.',
      reference: 'Advanced Secrets Management — Force Re-encryption section.'
    },
    {
      question: 'In EncryptionConfiguration, the providers list order matters. Why is "identity: {}" placed last?',
      options: [
        'The first provider encrypts new writes; identity (plaintext) last means old unencrypted Secrets can still be read during migration',
        'identity must always be last alphabetically for Kubernetes to parse the config correctly',
        'identity is the fastest provider, so placing it last saves CPU',
        'The last provider is used for Secrets from system namespaces only'
      ],
      correct: 0,
      explanation: 'The first provider in the list is used for writing (encryption). Subsequent providers are used for reading. Placing "identity: {}" last ensures the API server can still read old unencrypted Secrets during migration, while writing new Secrets with the first (encrypted) provider.',
      reference: 'Advanced Secrets Management — EncryptionConfiguration section.'
    },
    {
      question: 'Why is consuming Secrets via volume mount preferable to environment variables?',
      options: [
        'Volume-mounted secrets are not visible in /proc/1/environ, less likely to be logged, and can be updated without restart',
        'Volume mounts are faster to read than environment variables',
        'Environment variables are limited to 1024 bytes; volume mounts have no limit',
        'Only volume mounts support immutable Secrets'
      ],
      correct: 0,
      explanation: 'Environment variables are accessible via /proc/1/environ (readable inside the container), captured in crash dumps, and often logged by frameworks on startup. Volume-mounted Secrets are files — less surface area for accidental exposure.',
      reference: 'Advanced Secrets Management — Volume Mount vs Environment Variable section.'
    },
    {
      question: 'What does Sealed Secrets do and how does it help with GitOps?',
      options: [
        'Encrypts Kubernetes Secrets with the cluster\'s public key — the encrypted SealedSecret can be safely stored in Git',
        'Stores Secrets in an external database and creates references in the cluster',
        'Prevents Secrets from being read by anyone including cluster admins',
        'Rotates Secret values automatically on a schedule'
      ],
      correct: 0,
      explanation: 'Sealed Secrets (Bitnami) encrypts a Secret manifest using the cluster\'s public key (via kubeseal). The resulting SealedSecret can be safely committed to Git. The Sealed Secrets controller in the cluster decrypts it using its private key and creates the regular Kubernetes Secret.',
      reference: 'Advanced Secrets Management — Sealed Secrets section.'
    },
    {
      question: 'How do you verify that a Secret is actually encrypted in etcd?',
      options: [
        'Use etcdctl get to retrieve the Secret — the value should start with "k8s:enc:aescbc:v1:" if encrypted',
        'Run kubectl get secret -o yaml — encrypted Secrets show "encrypted: true" in status',
        'Check the Secret annotations for an encryption timestamp',
        'kubectl describe secret shows the encryption key name in spec'
      ],
      correct: 0,
      explanation: 'Use etcdctl directly with the cluster certificates to fetch the raw Secret value from etcd. If encryption is working, the value begins with "k8s:enc:aescbc:v1:" (or similar for other providers). Plaintext Secrets start with the base64 of the JSON data.',
      reference: 'Advanced Secrets Management — Force Re-encryption section.'
    },
    {
      question: 'What is the External Secrets Operator (ESO) and what Kubernetes resource does it create?',
      options: [
        'ESO syncs secrets from external vaults (HashiCorp Vault, AWS Secrets Manager) into regular Kubernetes Secrets',
        'ESO creates ExternalSecret CRDs that replace Kubernetes Secrets entirely',
        'ESO encrypts Kubernetes Secrets using external KMS providers',
        'ESO manages rotation of certificates stored in Kubernetes Secrets'
      ],
      correct: 0,
      explanation: 'ESO reads from external secret stores (Vault, AWS Secrets Manager, GCP Secret Manager, etc.) and creates regular Kubernetes Secrets from the external values. This keeps sensitive data out of Kubernetes etcd while still making it available to pods.',
      reference: 'Advanced Secrets Management — External Secrets Operator section.'
    },
    {
      question: 'What is an immutable Secret and what are its security benefits?',
      options: [
        'A Secret with immutable: true cannot be updated — tampering is impossible and Kubernetes stops watching it',
        'An immutable Secret is encrypted with an immutable key that cannot be rotated',
        'An immutable Secret is automatically backed up to etcd snapshots',
        'Immutable Secrets are visible only to the pod that created them'
      ],
      correct: 0,
      explanation: 'Setting immutable: true on a Secret prevents any updates to it. This has two benefits: (1) tamper-proof — no accidental or malicious modification, and (2) performance — Kubernetes stops watching the Secret for changes, reducing API server load in clusters with many Secrets.',
      reference: 'Advanced Secrets Management — Immutable Secrets section.'
    }
  ],

  flashcards: [
    {
      front: 'How do you enable Secret encryption at rest? What are the steps?',
      back: '1. Generate a key:\n   head -c 32 /dev/urandom | base64\n\n2. Create /etc/kubernetes/encryption-config.yaml:\n   apiVersion: apiserver.config.k8s.io/v1\n   kind: EncryptionConfiguration\n   resources:\n   - resources: [secrets]\n     providers:\n     - aescbc:\n         keys:\n         - name: key1\n           secret: <key>\n     - identity: {}\n\n3. Add to API server: --encryption-provider-config=<path>\n   Mount the file as hostPath volume\n\n4. Re-encrypt existing Secrets:\n   kubectl get secrets -A -o json | kubectl replace -f -\n\n5. Verify: etcdctl get /registry/secrets/... | grep k8s:enc:'
    },
    {
      front: 'What is the difference between aescbc, aesgcm, and kms encryption providers?',
      back: 'aescbc: AES-256-CBC, symmetric key stored in config file\n  → Simple, no external dependency\n  → Key on disk = if attacker gets API server files, they get key\n\naesgcm: AES-256-GCM, faster than CBC, same security model\n  → Similar to aescbc, different cipher mode\n\nkms: Uses external KMS (AWS KMS, HashiCorp Vault, GCP KMS)\n  → Keys never leave the KMS\n  → Best for production security\n  → API server calls KMS to encrypt/decrypt\n  → Network dependency on KMS'
    },
    {
      front: 'Why should Secrets be consumed via volume mounts instead of environment variables?',
      back: 'Environment variable risks:\n- Visible in /proc/1/environ from any process in container\n- Captured in memory dumps and crash reports\n- Frameworks often log all env vars on startup (e.g., Spring Boot)\n- Child processes inherit env vars\n\nVolume mount benefits:\n- Secret is a file, not in process environment\n- Can use file permissions (0400) to restrict access\n- Can be updated without restart (for non-immutable)\n- Not accidentally logged\n\nExample:\n  volumeMounts:\n  - name: my-secret\n    mountPath: /etc/secrets\n    readOnly: true'
    },
    {
      front: 'What is the GitOps Secrets Problem and what are the solutions?',
      back: 'Problem: Cannot store encrypted Secrets in Git → no GitOps for Secrets\n\nSolutions:\n\n1. Sealed Secrets (Bitnami):\n   - kubeseal encrypts with cluster public key\n   - SealedSecret committed to Git\n   - Controller decrypts → creates K8s Secret\n\n2. SOPS + Flux/ArgoCD:\n   - sops -e secret.yaml > encrypted.yaml (with KMS/GPG)\n   - Flux/ArgoCD decrypt before applying\n\n3. External Secrets Operator:\n   - ExternalSecret references Vault/AWS SM\n   - ESO pulls and creates K8s Secret\n   - Only reference (not value) in Git\n\n4. Vault Agent Injection:\n   - Vault injects secrets directly into pod filesystem'
    },
    {
      front: 'How do you verify a Secret is encrypted in etcd?',
      back: '# Read the raw etcd value:\nETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  get /registry/secrets/default/my-secret\n\nEncrypted (good):\nStarts with: k8s:enc:aescbc:v1:key1:...\n\nNot encrypted (bad):\nStarts with: {\"kind\":\"Secret\"... or shows base64 data directly'
    },
    {
      front: 'What is an immutable Secret and how do you create one?',
      back: 'apiVersion: v1\nkind: Secret\nmetadata:\n  name: my-secret\ntype: Opaque\nimmutable: true      # prevents any updates\ndata:\n  password: dGVzdA==\n\nBenefits:\n1. Cannot be modified (tamper-proof)\n2. Kubernetes stops watching for changes → less API server load\n3. Accidental kubectl edit is rejected\n\nTo change: must delete and recreate\nNote: immutable: true cannot itself be changed to false'
    }
  ],

  lab: {
    scenario: 'You need to enable encryption at rest for Secrets in the cluster using aescbc, then verify the encryption is working by checking etcd directly.',
    objective: 'Configure EncryptionConfiguration on the API server to encrypt Secrets at rest, re-encrypt existing Secrets, and verify via etcdctl.',
    duration: '25-35 minutes',
    steps: [
      {
        title: 'Create the EncryptionConfiguration',
        instruction: `Generate a key and create the EncryptionConfiguration file.

\`\`\`bash
# Generate a 32-byte base64 key
KEY=$(head -c 32 /dev/urandom | base64)
echo "Generated key: $KEY"

# Create the encryption config (on the control plane node)
sudo tee /etc/kubernetes/encryption-config.yaml <<EOF
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: \${KEY}
  - identity: {}
EOF

# Verify the file
sudo cat /etc/kubernetes/encryption-config.yaml
\`\`\``,
        hints: [
          'The key must be exactly 32 bytes — head -c 32 /dev/urandom | base64 produces this',
          'identity: {} as the last provider allows reading existing unencrypted Secrets during migration',
          'Keep this file secure — it contains the encryption key!'
        ],
        solution: `\`\`\`bash
KEY=$(head -c 32 /dev/urandom | base64)
sudo tee /etc/kubernetes/encryption-config.yaml <<EOF
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: \${KEY}
  - identity: {}
EOF
\`\`\``,
        verify: `\`\`\`bash
sudo cat /etc/kubernetes/encryption-config.yaml
# Expected: YAML with aescbc provider and key1

sudo python3 -c "import yaml; yaml.safe_load(open('/etc/kubernetes/encryption-config.yaml'))" && echo "YAML valid"
# Expected: YAML valid
\`\`\``
      },
      {
        title: 'Enable encryption in the API server',
        instruction: `Add the encryption flag to the API server static pod manifest.

\`\`\`bash
# Backup the manifest
sudo cp /etc/kubernetes/manifests/kube-apiserver.yaml /tmp/kube-apiserver.yaml.bak

# Add to the command section of kube-apiserver.yaml:
# - --encryption-provider-config=/etc/kubernetes/encryption-config.yaml

# Add to volumeMounts:
# - mountPath: /etc/kubernetes/encryption-config.yaml
#   name: encryption-config
#   readOnly: true

# Add to volumes:
# - name: encryption-config
#   hostPath:
#     path: /etc/kubernetes/encryption-config.yaml
#     type: File

sudo vi /etc/kubernetes/manifests/kube-apiserver.yaml

# Wait for API server to restart
watch kubectl get pods -n kube-system | grep apiserver
\`\`\``,
        hints: [
          'Always backup before editing the static pod manifest',
          'The API server pod takes 30-60 seconds to restart after the manifest changes',
          'If the API server fails to start, restore the backup file'
        ],
        solution: `\`\`\`bash
# Verify the flag is in the manifest (after manual editing)
grep "encryption-provider-config" /etc/kubernetes/manifests/kube-apiserver.yaml
\`\`\``,
        verify: `\`\`\`bash
# API server should be Running
kubectl get pods -n kube-system | grep apiserver
# Expected: Running

# Verify the flag is active
kubectl get pod -n kube-system -l component=kube-apiserver -o yaml | grep "encryption"
# Expected: - --encryption-provider-config=/etc/kubernetes/encryption-config.yaml
\`\`\``
      },
      {
        title: 'Verify encryption and re-encrypt existing Secrets',
        instruction: `Create a new Secret and verify it is encrypted in etcd.

\`\`\`bash
# Create a new Secret
kubectl create secret generic test-encrypt \
  --from-literal=password=supersecret123

# Check directly in etcd (new Secret should be encrypted)
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/default/test-encrypt | hexdump -C | head -3

# The output should start with: k8s:enc:aescbc:v1:key1:

# Re-encrypt all existing Secrets
kubectl get secrets --all-namespaces -o json | kubectl replace -f -
\`\`\``,
        hints: [
          'If the output shows JSON or readable text, encryption is NOT working — check API server logs',
          'The hexdump should show unreadable bytes after the k8s:enc:aescbc:v1:key1: prefix',
          'Re-encrypting all Secrets may take a few minutes in large clusters'
        ],
        solution: `\`\`\`bash
kubectl create secret generic test-encrypt --from-literal=password=supersecret123
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/default/test-encrypt
\`\`\``,
        verify: `\`\`\`bash
# Check the raw etcd value starts with the encryption prefix
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/default/test-encrypt | strings | head -3
# Expected: First output starts with "k8s:enc:aescbc:v1:key1:"

# Verify kubectl can still read it (decryption works)
kubectl get secret test-encrypt -o jsonpath='{.data.password}' | base64 -d
# Expected: supersecret123
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'API server fails to start after adding encryption config',
      difficulty: 'hard',
      symptom: 'After adding --encryption-provider-config to kube-apiserver.yaml, the API server pod enters CrashLoopBackOff.',
      diagnosis: `\`\`\`bash
# Get API server container ID
CONTAINER=$(sudo crictl ps -a | grep apiserver | awk '{print $1}' | head -1)

# Check logs
sudo crictl logs $CONTAINER 2>&1 | tail -30

# Common errors:
# "failed to load encryption config: no provider found" — bad YAML
# "key is not 32 bytes" — wrong key length
# "no such file or directory" — file not mounted

# Verify the config file
sudo cat /etc/kubernetes/encryption-config.yaml
sudo python3 -c "import yaml; yaml.safe_load(open('/etc/kubernetes/encryption-config.yaml'))" && echo "Valid"

# Check if the file is mounted
grep "encryption-config" /etc/kubernetes/manifests/kube-apiserver.yaml
\`\`\``,
      solution: `**Fix by checking each component:**

\`\`\`bash
# 1. Validate YAML syntax
sudo python3 -c "import yaml; yaml.safe_load(open('/etc/kubernetes/encryption-config.yaml'))"

# 2. Verify key length (must be 32 bytes = 44 chars base64)
grep "secret:" /etc/kubernetes/encryption-config.yaml | awk '{print length($2)}'
# Expected: 44

# 3. Check volume mount in manifest
grep -A3 "encryption-config" /etc/kubernetes/manifests/kube-apiserver.yaml

# 4. Restore if needed
sudo cp /tmp/kube-apiserver.yaml.bak /etc/kubernetes/manifests/kube-apiserver.yaml
\`\`\``
    },
    {
      title: 'Secrets cannot be read after key rotation',
      difficulty: 'hard',
      symptom: 'After rotating the encryption key in EncryptionConfiguration, all applications fail with "error decrypting secret: no matching key found".',
      diagnosis: `\`\`\`bash
# Check the current encryption config
cat /etc/kubernetes/encryption-config.yaml

# The problem: old key was removed before Secrets were re-encrypted
# New key can write new Secrets but can't read old ones

# Check which Secrets are unreadable
kubectl get secrets -A 2>&1 | grep -i "error\|decode\|decrypt"
\`\`\``,
      solution: `**NEVER remove the old key until ALL Secrets have been re-encrypted.**

**Key rotation procedure:**

Step 1: Add NEW key as first provider, keep OLD key as second:
\`\`\`yaml
providers:
- aescbc:
    keys:
    - name: key2        # NEW key first (for writes)
      secret: <new-key>
    - name: key1        # OLD key second (for reads)
      secret: <old-key>
- identity: {}
\`\`\`

Step 2: Restart API server, then re-encrypt ALL Secrets:
\`\`\`bash
kubectl get secrets -A -o json | kubectl replace -f -
\`\`\`

Step 3: ONLY NOW remove the old key (all Secrets are re-encrypted with new key):
\`\`\`yaml
providers:
- aescbc:
    keys:
    - name: key2
      secret: <new-key>
- identity: {}
\`\`\`

**Emergency recovery if old key is gone:**
Add identity: {} as FIRST provider temporarily to read Secrets, then re-encrypt.`
    }
  ]
};
