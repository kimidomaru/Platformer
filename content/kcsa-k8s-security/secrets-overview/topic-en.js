window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcsa-k8s-security/secrets-overview'] = {
  theory: `# Secrets Overview

## Exam Relevance
> KCSA tests knowledge of Kubernetes Secrets, their limitations, best practices for secrets management, and external secrets solutions. Expect questions about Secret types, how to consume them, and why they're not truly secure by default.

## What is a Kubernetes Secret?

A Secret is a Kubernetes object for storing sensitive data like passwords, tokens, and keys. Unlike ConfigMaps, Secrets are:
- Stored separately from workload configuration
- Excluded from some API server responses by default
- Marked with limited RBAC access conventions

> **Warning**: Kubernetes Secrets are base64-encoded, NOT encrypted by default. Anyone with etcd access or \`kubectl get secret\` permission can read the values.

## Secret Types

| Type | Description | Use Case |
|------|-------------|----------|
| \`Opaque\` | Generic key-value data | Passwords, API keys |
| \`kubernetes.io/tls\` | TLS certificate + key | Ingress TLS, mTLS |
| \`kubernetes.io/dockerconfigjson\` | Docker registry credentials | Image pull auth |
| \`kubernetes.io/service-account-token\` | SA token | Internal (auto-created) |
| \`kubernetes.io/basic-auth\` | Username/password | Basic auth |
| \`kubernetes.io/ssh-auth\` | SSH private key | SSH credentials |
| \`bootstrap.kubernetes.io/token\` | Bootstrap token | Node join tokens |

## Creating Secrets

\`\`\`bash
# Create from literals
kubectl create secret generic db-secret \\
  --from-literal=username=admin \\
  --from-literal=password=supersecret

# Create from file
kubectl create secret generic app-secret \\
  --from-file=config.json

# Create TLS secret
kubectl create secret tls tls-secret \\
  --cert=tls.crt \\
  --key=tls.key

# Create Docker registry secret
kubectl create secret docker-registry regcred \\
  --docker-server=registry.example.com \\
  --docker-username=user \\
  --docker-password=pass \\
  --docker-email=user@example.com
\`\`\`

## Secret Structure (YAML)

\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
  namespace: production
type: Opaque
data:
  # Values must be base64-encoded
  username: YWRtaW4=      # echo -n "admin" | base64
  password: c3VwZXJzZWNyZXQ=
stringData:               # alternative: plain text (auto-encoded)
  api-key: "raw-api-key-value"
\`\`\`

## Consuming Secrets in Pods

### Method 1: Environment Variables
\`\`\`yaml
env:
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: db-secret
        key: password
        optional: false   # pod fails to start if secret is missing

# Or all keys as env vars:
envFrom:
  - secretRef:
      name: db-secret
      prefix: "DB_"       # optional prefix
\`\`\`

### Method 2: Volume Mount (preferred for sensitive data)
\`\`\`yaml
spec:
  containers:
  - name: app
    volumeMounts:
    - name: secret-vol
      mountPath: /etc/secrets
      readOnly: true
  volumes:
  - name: secret-vol
    secret:
      secretName: db-secret
      defaultMode: 0400     # read-only for owner
      items:                # optional: select specific keys
        - key: password
          path: db.password  # mount as /etc/secrets/db.password
\`\`\`

### Method 3: imagePullSecret (for registry credentials)
\`\`\`yaml
spec:
  imagePullSecrets:
    - name: regcred
  containers:
  - name: app
    image: registry.example.com/myapp:v1
\`\`\`

## Why Secrets Aren't Truly Secure By Default

### The Problem
\`\`\`bash
# Anyone with 'kubectl get secret' permission can decode:
kubectl get secret db-secret -o jsonpath='{.data.password}' | base64 -d
# Outputs: supersecret

# In etcd (without encryption at rest):
# etcdctl get /registry/secrets/production/db-secret
# Shows base64-encoded data in the etcd dump
\`\`\`

### Risks
1. **etcd access** → read all secrets (bypass RBAC)
2. **RBAC misconfiguration** → developer can read production secrets
3. **Pod env vars** → visible in /proc/1/environ
4. **Audit logs** → may log secret values (at RequestResponse level)
5. **Git commit** → YAML secrets accidentally committed

## Securing Kubernetes Secrets

### 1. Encryption at Rest

\`\`\`yaml
# /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources: ["secrets"]
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <32-byte-base64-key>
      - identity: {}
\`\`\`

After enabling, re-encrypt existing secrets:
\`\`\`bash
kubectl get secrets --all-namespaces -o json | kubectl replace -f -
\`\`\`

### 2. Strict RBAC for Secrets

\`\`\`yaml
# Deny list on secrets (only allow get, not list)
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get"]              # get is safer than list
    resourceNames: ["app-db"]  # specific secret only
\`\`\`

\`\`\`bash
# Audit who can access secrets
kubectl auth can-i get secrets -n production --as=<user/sa>
\`\`\`

### 3. Immutable Secrets

\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-key
immutable: true    # cannot be modified after creation (requires new secret)
\`\`\`

## External Secrets Solutions

For production, use an external secrets manager instead of Kubernetes Secrets.

### HashiCorp Vault
\`\`\`
Application → Vault Agent Sidecar → Vault → Secrets
                    ↓
           Writes to shared volume or env
\`\`\`

\`\`\`yaml
# Vault annotation for auto-injection
annotations:
  vault.hashicorp.com/agent-inject: "true"
  vault.hashicorp.com/agent-inject-secret-db.txt: "secret/data/db"
\`\`\`

### External Secrets Operator (ESO)
Syncs secrets from external stores to Kubernetes Secrets:
\`\`\`yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-password
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secretsmanager
    kind: ClusterSecretStore
  target:
    name: db-secret           # K8s Secret to create
  data:
    - secretKey: password
      remoteRef:
        key: production/db-password
\`\`\`

### Sealed Secrets
Encrypts Secrets with a cluster-specific key — safe to commit to Git:
\`\`\`bash
# Seal a secret (encrypt it)
kubectl create secret generic db-secret \\
  --from-literal=password=supersecret \\
  --dry-run=client -o yaml | \\
  kubeseal --format=yaml > sealed-secret.yaml

# The SealedSecret can be committed to Git safely
kubectl apply -f sealed-secret.yaml
# Sealed Secrets controller decrypts it to a regular Secret in-cluster
\`\`\`

## Secret Rotation

\`\`\`bash
# Update a secret value
kubectl patch secret db-secret \\
  --type=json \\
  -p='[{"op":"replace","path":"/data/password","value":"'"$(echo -n 'newpassword' | base64)"'"}]'

# Or create new secret version with a new name
kubectl create secret generic db-secret-v2 --from-literal=password=newpassword

# Update deployment to use new secret
kubectl set env deployment/myapp \\
  --from=secret/db-secret-v2 \\
  --prefix=DB_
\`\`\`

## GitOps and Secrets Problem

\`\`\`
Problem: Kubernetes Secrets (base64) committed to Git = credentials leak

Solutions:
1. Sealed Secrets — commit encrypted SealedSecrets, not plain Secrets
2. SOPS — encrypt Secret YAML files (AWS KMS, GCP KMS, age, PGP)
3. External Secrets Operator — store in cloud vault, reference from Git
4. Vault Agent — dynamically inject secrets at runtime
\`\`\`

## Summary: Secrets Security Levels

| Approach | Security Level | Complexity |
|----------|----------------|------------|
| Plain Secret (default) | Low | Low |
| Encryption at rest | Medium | Medium |
| Strict RBAC | Medium | Medium |
| External Vault (HashiCorp) | High | High |
| ESO + Cloud Secrets Manager | High | Medium |
| Sealed Secrets (GitOps) | Medium-High | Medium |
`,
  quiz: [
    {
      question: 'What is the default encoding for values stored in Kubernetes Secrets?',
      options: [
        'Base64 — encoded but NOT encrypted',
        'AES-256 encryption with a cluster key',
        'SHA-256 hash (one-way)',
        'Plaintext — stored with no encoding'
      ],
      correct: 0,
      explanation: 'Kubernetes Secrets are base64-encoded by default — this is encoding, not encryption. Anyone with etcd access or kubectl get secret permission can trivially decode them with base64 -d.',
      reference: 'Review "Why Secrets Aren\'t Truly Secure By Default" section.'
    },
    {
      question: 'What is the main advantage of consuming a Secret as a volume mount over an environment variable?',
      options: [
        'Volume mounts are not visible in /proc/environ and can be automatically rotated without pod restart',
        'Volume mounts are encrypted at rest; env vars are not',
        'Volume mounts bypass RBAC restrictions on Secret access',
        'Volume mounts are supported in all Kubernetes versions; env vars are not'
      ],
      correct: 0,
      explanation: 'Env vars are visible in /proc/1/environ and can be accidentally logged. Volume-mounted secrets can be updated by rotating the Secret without restarting pods (for projected volumes). Better for sensitive data.',
      reference: 'Review "Method 2: Volume Mount (preferred)" section.'
    },
    {
      question: 'What does Sealed Secrets solve for GitOps workflows?',
      options: [
        'It encrypts Kubernetes Secrets with a cluster-specific key, making them safe to commit to Git',
        'It automatically rotates Secret values every 24 hours',
        'It moves Secret storage from etcd to a dedicated secrets vault',
        'It adds mTLS encryption to Secret API calls'
      ],
      correct: 0,
      explanation: 'Sealed Secrets uses asymmetric encryption — only the Sealed Secrets controller in the cluster can decrypt. The sealed YAML file is safe to commit to Git. When applied, the controller decrypts it to a regular Kubernetes Secret.',
      reference: 'Review "Sealed Secrets" section.'
    },
    {
      question: 'What does "immutable: true" on a Kubernetes Secret do?',
      options: [
        'Prevents the Secret from being modified — requires creating a new Secret to update values',
        'Encrypts the Secret values in etcd automatically',
        'Prevents the Secret from being deleted',
        'Makes the Secret visible only to the creating ServiceAccount'
      ],
      correct: 0,
      explanation: 'Immutable Secrets cannot be updated. To rotate credentials, create a new Secret with a new name and update pods to reference it. Benefit: prevents accidental modification and improves performance (no watches needed on immutable objects).',
      reference: 'Review "Immutable Secrets" section.'
    },
    {
      question: 'What is the External Secrets Operator (ESO)?',
      options: [
        'A Kubernetes operator that syncs secrets from external stores (Vault, AWS, GCP) to Kubernetes Secrets',
        'An admission controller that validates Secret YAML before creation',
        'A CLI tool for encrypting Secrets before committing to Git',
        'A Kubernetes controller that rotates ServiceAccount tokens'
      ],
      correct: 0,
      explanation: 'ESO watches ExternalSecret CRDs and fetches secrets from external stores (HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager, etc.), creating/updating corresponding Kubernetes Secrets automatically.',
      reference: 'Review "External Secrets Operator (ESO)" section.'
    },
    {
      question: 'Which Kubernetes Secret type stores Docker registry credentials?',
      options: [
        'kubernetes.io/dockerconfigjson',
        'kubernetes.io/registry',
        'Opaque with docker-config key',
        'kubernetes.io/image-pull'
      ],
      correct: 0,
      explanation: 'kubernetes.io/dockerconfigjson stores Docker registry credentials in the .dockerconfigjson key format. Created with kubectl create secret docker-registry and referenced in pods via imagePullSecrets.',
      reference: 'Review "Secret Types" table.'
    },
    {
      question: 'After enabling encryption at rest for Secrets, what must you do to encrypt existing Secrets?',
      options: [
        'Re-write all existing Secrets by running: kubectl get secrets --all-namespaces -o json | kubectl replace -f -',
        'Restart the API server — it automatically re-encrypts all Secrets',
        'Delete and recreate all Secrets',
        'Run kubectl encrypt secrets --all-namespaces'
      ],
      correct: 0,
      explanation: 'Enabling EncryptionConfiguration only encrypts newly written Secrets. Existing Secrets remain unencrypted until they are rewritten. Force a rewrite with kubectl replace to encrypt all existing Secrets.',
      reference: 'Review "Encryption at Rest" section — the re-encryption command.'
    },
    {
      question: 'What is SOPS in the context of Kubernetes secrets management?',
      options: [
        'A tool that encrypts YAML/JSON files using cloud KMS (AWS, GCP), age, or PGP keys — safe for Git storage',
        'A Kubernetes StorageClass for encrypted volumes',
        'A Secret admission controller that validates secret complexity',
        'An RBAC auditing tool for Kubernetes Secrets'
      ],
      correct: 0,
      explanation: 'SOPS (Secrets OPerationS) by Mozilla encrypts specific values in YAML/JSON files using cloud KMS or PGP keys. The encrypted files can be committed to Git. Used for GitOps workflows alongside Helm and Kustomize.',
      reference: 'Review "GitOps and Secrets Problem" — Solutions list.'
    }
  ],
  flashcards: [
    {
      front: 'Why are Kubernetes Secrets not truly secure by default?',
      back: 'They\'re only base64-encoded (not encrypted) in etcd. Anyone with etcd access or kubectl get secret permission can read them. Solutions: encryption at rest (EncryptionConfiguration), external vault, or Sealed Secrets.'
    },
    {
      front: 'What are the 4 main ways to consume a Kubernetes Secret?',
      back: '1. Environment variable (env.valueFrom.secretKeyRef). 2. Bulk env (envFrom.secretRef). 3. Volume mount (volumes.secret → volumeMounts). 4. imagePullSecrets (for registry credentials). Volume mount is preferred for sensitive data.'
    },
    {
      front: 'What is the difference between data: and stringData: in a Secret manifest?',
      back: 'data: requires base64-encoded values. stringData: accepts plain text — the API server base64-encodes it automatically. stringData is write-only — kubectl get secret always shows data: with base64 values.'
    },
    {
      front: 'What are the main external secrets solutions and what problems do they solve?',
      back: 'HashiCorp Vault: enterprise-grade secrets, dynamic credentials, audit trail. ESO (External Secrets Operator): sync from any cloud vault to K8s Secrets. Sealed Secrets: encrypted secrets safe for Git. SOPS: encrypt YAML files for Git storage.'
    },
    {
      front: 'How do you force-encrypt existing Kubernetes Secrets after enabling EncryptionConfiguration?',
      back: 'kubectl get secrets --all-namespaces -o json | kubectl replace -f - — reads and re-writes all secrets, triggering the new encryption provider to encrypt them on write.'
    },
    {
      front: 'What are the security risks of using env vars for Kubernetes Secrets?',
      back: 'Visible in /proc/1/environ (any process with filesystem access can read them). Can be accidentally logged by applications. Show up in kubectl describe pod. Not automatically rotated. Volume mounts are less prone to accidental exposure.'
    }
  ],
  lab: {
    scenario: 'Practice Kubernetes Secrets creation, consumption, and security verification. Understand why they\'re not truly secret by default.',
    objective: 'Create and consume Secrets using best practices, and verify the security limitations.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create and inspect Secrets',
        instruction: `Create a Secret named \`app-creds\` with username=appuser and password=p@ssw0rd. Verify the values are base64-encoded. Decode them to demonstrate the lack of encryption.`,
        hints: [
          'kubectl create secret generic app-creds --from-literal=...',
          'kubectl get secret app-creds -o yaml shows base64 values',
          'kubectl get secret app-creds -o jsonpath=... | base64 -d to decode'
        ],
        solution: `\`\`\`bash
kubectl create secret generic app-creds \\
  --from-literal=username=appuser \\
  --from-literal=password='p@ssw0rd'

# See the "secret" (base64 only!)
kubectl get secret app-creds -o yaml

# Decode the values
echo "=== Decoded values ==="
kubectl get secret app-creds -o jsonpath='{.data.username}' | base64 -d
echo ""
kubectl get secret app-creds -o jsonpath='{.data.password}' | base64 -d
echo ""
echo "=== This is why Secrets are not truly secure without encryption at rest! ==="
\`\`\``,
        verify: `\`\`\`bash
kubectl get secret app-creds
# Expected: TYPE=Opaque, DATA=2

kubectl get secret app-creds -o jsonpath='{.data.username}' | base64 -d
# Expected: appuser

# Confirm it's base64 (not encrypted)
kubectl get secret app-creds -o jsonpath='{.data.password}'
# Expected: cEBzc3cwcmQ= (base64, not binary cipher text)
\`\`\``
      },
      {
        title: 'Consume Secret as volume (preferred) vs env var',
        instruction: `Create two pods that consume \`app-creds\`: one using environment variables and one using volume mount. Compare the security implications.`,
        hints: [
          'For env var pod: use env.valueFrom.secretKeyRef',
          'For volume pod: use volumes.secret + volumeMounts',
          'Use busybox pods with sleep 3600 for inspection'
        ],
        solution: `\`\`\`bash
# Pod 1: Secret as environment variable (less secure)
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
    - name: APP_USER
      valueFrom:
        secretKeyRef:
          name: app-creds
          key: username
    - name: APP_PASS
      valueFrom:
        secretKeyRef:
          name: app-creds
          key: password
EOF

# Pod 2: Secret as volume mount (better)
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: secret-vol-pod
spec:
  containers:
  - name: app
    image: busybox
    command: ["sleep", "3600"]
    volumeMounts:
    - name: creds
      mountPath: /var/secrets
      readOnly: true
  volumes:
  - name: creds
    secret:
      secretName: app-creds
      defaultMode: 0400
EOF

kubectl wait pod/secret-env-pod --for=condition=Ready --timeout=60s
kubectl wait pod/secret-vol-pod --for=condition=Ready --timeout=60s
\`\`\``,
        verify: `\`\`\`bash
# Env var pod: secret visible in /proc/environ (security risk!)
kubectl exec secret-env-pod -- cat /proc/1/environ | tr '\\0' '\\n' | grep -E "APP_USER|APP_PASS"
# Expected: APP_USER=appuser APP_PASS=p@ssw0rd (in plaintext!)

# Volume pod: secret available as file
kubectl exec secret-vol-pod -- ls /var/secrets/
# Expected: password  username

kubectl exec secret-vol-pod -- cat /var/secrets/username
# Expected: appuser

kubectl exec secret-vol-pod -- ls -la /var/secrets/
# Expected: files with 0400 permissions (read-only by owner)

echo "Compare: env vars are in /proc, volume files have restricted permissions"
\`\`\``
      },
      {
        title: 'Create an immutable Secret and test TLS Secret',
        instruction: `Create an immutable Secret and verify it cannot be modified. Also create a TLS Secret from self-signed certificates.`,
        hints: [
          'Add immutable: true to the Secret spec',
          'kubectl patch on immutable secret should fail',
          'openssl req -x509 -nodes -days 365 to generate self-signed cert',
          'kubectl create secret tls with --cert and --key'
        ],
        solution: `\`\`\`bash
# Create immutable secret
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: immutable-config
type: Opaque
immutable: true
stringData:
  api-key: "my-api-key-v1"
EOF

# Try to modify (should fail)
kubectl patch secret immutable-config \\
  --type=merge \\
  -p '{"stringData":{"api-key":"hacked"}}' 2>&1
# Expected: error: cannot update immutable secret

# Generate and create TLS secret
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
  -keyout /tmp/tls.key \\
  -out /tmp/tls.crt \\
  -subj "/CN=example.com/O=Lab"

kubectl create secret tls lab-tls \\
  --cert=/tmp/tls.crt \\
  --key=/tmp/tls.key
\`\`\``,
        verify: `\`\`\`bash
kubectl get secret immutable-config
# Expected: Opaque secret

kubectl patch secret immutable-config --type=merge -p '{"stringData":{"key":"new"}}' 2>&1
# Expected: Forbidden error (immutable)

kubectl get secret lab-tls
# Expected: TYPE=kubernetes.io/tls

kubectl get secret lab-tls -o jsonpath='{.data}' | python3 -m json.tool | grep tls
# Expected: tls.crt and tls.key keys

# Cleanup
kubectl delete pod secret-env-pod secret-vol-pod
kubectl delete secret app-creds immutable-config lab-tls
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pod fails to start: secret not found',
      difficulty: 'easy',
      symptom: 'Pod is in CreateContainerConfigError state. kubectl describe pod shows: "Error: secret \"db-creds\" not found"',
      diagnosis: `\`\`\`bash
# Check if the secret exists in the correct namespace
kubectl get secrets -n <namespace>
kubectl get secret db-creds -n <namespace>

# Check if the pod's namespace matches the secret's namespace
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.metadata.namespace}'
\`\`\``,
      solution: `The Secret doesn't exist or is in the wrong namespace. Secrets are namespace-scoped.

1. **Create the missing secret**:
\`\`\`bash
kubectl create secret generic db-creds \\
  --from-literal=username=admin \\
  --from-literal=password=secure \\
  -n <namespace>
\`\`\`

2. **Or move the pod to the namespace where the secret exists** — or copy the secret:
\`\`\`bash
# Export and recreate in the right namespace
kubectl get secret db-creds -n source-namespace -o yaml | \\
  sed 's/namespace: source-namespace/namespace: target-namespace/' | \\
  kubectl apply -f -
\`\`\`

3. **Set optional: true** if the pod should start even without the secret:
\`\`\`yaml
env:
- name: DB_PASS
  valueFrom:
    secretKeyRef:
      name: db-creds
      key: password
      optional: true    # pod starts even if secret missing
\`\`\``
    },
    {
      title: 'Secret accidentally committed to Git',
      difficulty: 'medium',
      symptom: 'A developer committed a Kubernetes Secret YAML with plaintext credentials to the Git repository. Need to respond to this credentials leak.',
      diagnosis: `\`\`\`bash
# Assess scope of exposure
git log --all --grep="secret" --oneline
git log --diff-filter=A -- "*.yaml" --oneline

# Check if secret is already deployed and what uses it
kubectl get secret <name> -n <namespace>
kubectl get pods -n <namespace> | xargs -I{} kubectl describe pod {} | grep "From.*secret"
\`\`\``,
      solution: `Incident response for a committed secret:

1. **Immediately rotate the leaked credentials** (most important!):
\`\`\`bash
# Delete and recreate with new credentials
kubectl delete secret <name> -n <namespace>
kubectl create secret generic <name> \\
  --from-literal=password=<NEW-SECURE-PASSWORD> \\
  -n <namespace>
\`\`\`

2. **Remove from Git history** (so future clones don't contain it):
\`\`\`bash
# Use git-filter-repo (recommended over BFG)
pip install git-filter-repo
git filter-repo --path secrets.yaml --invert-paths
# Force push (coordinate with team!)
\`\`\`

3. **Prevent future occurrences**:
\`\`\`bash
# Install git-secrets or gitleaks as a pre-commit hook
pip install detect-secrets
detect-secrets scan > .secrets.baseline
detect-secrets audit .secrets.baseline

# Add to .gitignore: *-secret.yaml, *secrets.yaml
\`\`\`

4. **Adopt Sealed Secrets or SOPS** for GitOps workflows.`
    }
  ]
};
