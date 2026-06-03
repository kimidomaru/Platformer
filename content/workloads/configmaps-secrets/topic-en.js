window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['workloads/configmaps-secrets'] = {
  theory: `
# ConfigMaps & Secrets

## Exam Relevance
> ConfigMaps and Secrets are tested in both CKA (Workloads — 15%) and CKAD (Application Environment — 25%). Expect tasks creating them imperatively, injecting them as environment variables and volume mounts, and working with Secret types.

## ConfigMaps

A **ConfigMap** stores non-sensitive configuration data as key-value pairs. Pods consume ConfigMaps via:
1. **Environment variables** (individual keys or all keys)
2. **Volume mounts** (keys become files)
3. **Command-line arguments** (via env var substitution)

### Creating ConfigMaps

\`\`\`bash
# From literal values
kubectl create configmap app-config \\
  --from-literal=LOG_LEVEL=info \\
  --from-literal=MAX_CONNECTIONS=100

# From a file (key = filename, value = file contents)
kubectl create configmap nginx-conf \\
  --from-file=nginx.conf

# From a file with custom key
kubectl create configmap nginx-conf \\
  --from-file=my-nginx=nginx.conf

# From a directory (each file becomes a key)
kubectl create configmap all-configs \\
  --from-file=/etc/app/configs/

# From an env file (.env format: KEY=VALUE per line)
kubectl create configmap env-config \\
  --from-env-file=app.env

# Dry run to generate YAML
kubectl create configmap app-config \\
  --from-literal=ENV=prod \\
  --dry-run=client -o yaml
\`\`\`

### ConfigMap YAML

\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  LOG_LEVEL: "info"
  MAX_CONNECTIONS: "100"
  config.yaml: |            # multi-line value (file content)
    server:
      port: 8080
      host: 0.0.0.0
\`\`\`

## Secrets

A **Secret** stores sensitive data (passwords, tokens, certificates). Secrets are:
- Base64-encoded (NOT encrypted by default)
- Stored in etcd (encrypt at rest with EncryptionConfiguration)
- Delivered to pods via env vars or volume mounts

### Secret Types

| Type | Use Case |
|------|----------|
| \`Opaque\` | Generic arbitrary data (default) |
| \`kubernetes.io/tls\` | TLS certificate + key |
| \`kubernetes.io/dockerconfigjson\` | Docker registry credentials |
| \`kubernetes.io/service-account-token\` | ServiceAccount tokens |
| \`kubernetes.io/basic-auth\` | Username + password |
| \`kubernetes.io/ssh-auth\` | SSH private key |

### Creating Secrets

\`\`\`bash
# Generic (Opaque) secret from literals
kubectl create secret generic db-credentials \\
  --from-literal=username=admin \\
  --from-literal=password=SuperSecret123

# TLS secret (from cert/key files)
kubectl create secret tls my-tls \\
  --cert=tls.crt \\
  --key=tls.key

# Docker registry secret
kubectl create secret docker-registry regcred \\
  --docker-server=docker.io \\
  --docker-username=myuser \\
  --docker-password=mypassword \\
  --docker-email=me@example.com

# Decode a secret value
kubectl get secret db-credentials -o jsonpath='{.data.password}' | base64 -d
\`\`\`

### Secret YAML (data is base64-encoded)

\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: default
type: Opaque
data:
  username: YWRtaW4=          # base64("admin")
  password: U3VwZXJTZWNyZXQ=  # base64("SuperSecret")
# OR use stringData (auto-encodes to base64):
stringData:
  username: admin
  password: SuperSecret
\`\`\`

## Injecting ConfigMaps and Secrets into Pods

### Method 1: Environment Variables (individual keys)

\`\`\`yaml
spec:
  containers:
  - name: app
    image: myapp
    env:
    - name: LOG_LEVEL              # env var name in container
      valueFrom:
        configMapKeyRef:
          name: app-config         # ConfigMap name
          key: LOG_LEVEL           # key in ConfigMap
    - name: DB_PASSWORD            # env var name in container
      valueFrom:
        secretKeyRef:
          name: db-credentials     # Secret name
          key: password            # key in Secret
\`\`\`

### Method 2: Environment Variables (all keys at once)

\`\`\`yaml
spec:
  containers:
  - name: app
    image: myapp
    envFrom:
    - configMapRef:
        name: app-config           # ALL keys become env vars
    - secretRef:
        name: db-credentials       # ALL keys become env vars
\`\`\`

### Method 3: Volume Mount (files)

\`\`\`yaml
spec:
  volumes:
  - name: config-vol
    configMap:
      name: app-config             # ConfigMap mounted as files
  - name: secret-vol
    secret:
      secretName: db-credentials   # Secret mounted as files
  containers:
  - name: app
    image: myapp
    volumeMounts:
    - name: config-vol
      mountPath: /etc/config       # /etc/config/LOG_LEVEL, etc.
    - name: secret-vol
      mountPath: /etc/secrets      # /etc/secrets/password, etc.
      readOnly: true               # recommended for secrets
\`\`\`

### Volume Mount: Specific keys only

\`\`\`yaml
spec:
  volumes:
  - name: nginx-conf
    configMap:
      name: nginx-config
      items:
      - key: config.yaml           # which key from ConfigMap
        path: app.yaml             # filename in the volume
\`\`\`

## Important Behaviors

| Behavior | Details |
|----------|---------|
| **Pod restart required for env vars** | Changes to ConfigMap/Secret are NOT reflected in running pods (env vars are set at start) |
| **Volume updates are eventual** | Volume-mounted ConfigMaps/Secrets update automatically (within ~1 minute) without pod restart |
| **Base64 ≠ encryption** | Secrets are just encoded — use EncryptionConfiguration for real encryption at rest |
| **Namespace scoped** | ConfigMaps and Secrets are namespace-scoped |

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| \`configmap not found\` | Wrong name or namespace | Check: \`kubectl get cm -n <namespace>\` |
| Pod in CrashLoopBackOff | Missing required env var | Check configMapKeyRef key name exactly |
| \`secret not found\` | Secret in different namespace | Ensure pod and secret are in same namespace |
| Env var shows base64 string | Used \`secretRef\` directly without decoding | Kubernetes decodes automatically; check your app |
| Volume not updated after ConfigMap change | App caches config at startup | Restart pod or use volume mount with auto-reload |

## Killer.sh Style Challenge

> **Task**: Create a ConfigMap \`app-settings\` with \`APP_ENV=production\` and \`LOG_LEVEL=warn\`. Create a Secret \`db-creds\` with \`DB_USER=admin\` and \`DB_PASS=s3cr3t\`. Create a Pod \`config-test\` that exposes all ConfigMap keys as env vars and mounts the Secret at \`/etc/db-creds\`.

\`\`\`bash
kubectl create configmap app-settings \\
  --from-literal=APP_ENV=production \\
  --from-literal=LOG_LEVEL=warn

kubectl create secret generic db-creds \\
  --from-literal=DB_USER=admin \\
  --from-literal=DB_PASS=s3cr3t

# Then create pod YAML with envFrom and volume mount
kubectl exec config-test -- env | grep APP_ENV
kubectl exec config-test -- cat /etc/db-creds/DB_USER
\`\`\`
`,
  quiz: [
    {
      question: 'What is the key difference between `env.valueFrom.configMapKeyRef` and `envFrom.configMapRef`?',
      options: [
        'configMapKeyRef injects one specific key; configMapRef injects ALL keys as env vars',
        'configMapKeyRef works with any type; configMapRef only works with Opaque type',
        'configMapRef requires the pod to restart; configMapKeyRef does not',
        'There is no difference — they produce identical results'
      ],
      correct: 0,
      explanation: '`configMapKeyRef` injects a single key with a custom env var name. `configMapRef` (via `envFrom`) injects ALL keys from the ConfigMap, using the ConfigMap keys directly as env var names.',
      reference: 'Use configMapKeyRef for specific keys with custom names; envFrom for bulk injection.'
    },
    {
      question: 'A Secret has `data.password: U3VwZXJTZWNyZXQ=`. What does the pod receive as the DB_PASSWORD env var?',
      options: [
        'U3VwZXJTZWNyZXQ= (the base64 string)',
        'SuperSecret (the decoded value)',
        'password (the key name)',
        'The pod fails because it cannot decode base64'
      ],
      correct: 1,
      explanation: 'Kubernetes automatically base64-decodes Secret values before injecting them into pods. The container receives the actual decoded string, not the base64 representation.',
      reference: 'data field = base64-encoded. stringData field = plaintext (auto-encoded). Pods always get decoded values.'
    },
    {
      question: 'You update a ConfigMap. Which statement is true about its effect on a running pod?',
      options: [
        'Env vars update immediately without pod restart',
        'Volume-mounted files update automatically; env vars do NOT update until pod restarts',
        'Both env vars and volumes require a pod restart to update',
        'Neither env vars nor volumes update until the pod is deleted and re-created'
      ],
      correct: 1,
      explanation: 'Env vars are set at pod start and are static. Volume-mounted ConfigMaps are updated by the kubelet automatically (eventual consistency, ~1 minute). This is a critical behavioral difference.',
      reference: 'For config hot-reload: use volume mounts + an app that watches file changes.'
    },
    {
      question: 'Which Secret type should you use for Docker registry credentials?',
      options: [
        'Opaque',
        'kubernetes.io/basic-auth',
        'kubernetes.io/dockerconfigjson',
        'kubernetes.io/service-account-token'
      ],
      correct: 2,
      explanation: '`kubernetes.io/dockerconfigjson` is the Secret type for Docker registry authentication. Reference it in a pod\'s `spec.imagePullSecrets` to pull images from private registries.',
      reference: 'Create with: kubectl create secret docker-registry regcred --docker-server=... --docker-username=... --docker-password=...'
    },
    {
      question: 'What is the difference between `data` and `stringData` in a Secret?',
      options: [
        'data is for binary values; stringData is for text values',
        'data stores base64-encoded values; stringData stores plaintext (automatically encoded by Kubernetes)',
        'data is immutable; stringData can be updated',
        'stringData is only for TLS certificates; data is for all other types'
      ],
      correct: 1,
      explanation: '`data` fields must contain base64-encoded values. `stringData` accepts plaintext and Kubernetes automatically base64-encodes it. In the stored Secret, all values appear under `data` as base64. `stringData` is write-only for convenience.',
      reference: 'Use stringData in YAML for readability; it is converted to data+base64 on creation.'
    },
    {
      question: 'A pod is mounting a ConfigMap as a volume at `/etc/config`. The ConfigMap has a key `app.conf`. What happens?',
      options: [
        'The key is ignored — only literal files can be volume mounted',
        'A file `/etc/config/app.conf` is created with the key\'s value as content',
        'An env var APP_CONF is created instead of a file',
        'The pod fails because dots in key names are not allowed in volume mounts'
      ],
      correct: 1,
      explanation: 'When mounting a ConfigMap as a volume, each key becomes a file in the mount directory. The key `app.conf` creates the file `/etc/config/app.conf` with the value as the file contents.',
      reference: 'Volume mount: key → filename, value → file content. Use items.path to rename files.'
    },
    {
      question: 'How do you decode a base64-encoded value from a Secret using kubectl?',
      options: [
        'kubectl get secret my-secret -o decode',
        'kubectl get secret my-secret -o jsonpath=\'{.data.password}\' | base64 -d',
        'kubectl describe secret my-secret --decode',
        'kubectl get secret my-secret --output=plaintext'
      ],
      correct: 1,
      explanation: '`kubectl get secret` returns base64-encoded data. Pipe to `base64 -d` (Linux) or `base64 --decode` to get the plaintext value. The `-d` flag decodes.',
      reference: 'Quick decode: kubectl get secret <name> -o jsonpath=\'{.data.<key>}\' | base64 -d'
    },
    {
      question: 'A ConfigMap is in namespace `staging`. A pod in namespace `production` tries to reference it. What happens?',
      options: [
        'The pod starts but the env var is empty',
        'The pod starts but logs a warning',
        'The pod fails to start — ConfigMaps are namespace-scoped and cannot be accessed cross-namespace',
        'The pod automatically switches to the correct namespace'
      ],
      correct: 2,
      explanation: 'ConfigMaps and Secrets are namespace-scoped resources. A pod can only reference ConfigMaps and Secrets in its own namespace. Cross-namespace access is not supported.',
      reference: 'Solution: create a copy of the ConfigMap in the pod\'s namespace, or use a shared configuration pattern.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 3 ways to inject ConfigMap data into a pod?',
      back: '1. **env + configMapKeyRef**: inject a single key as a named env var\n2. **envFrom + configMapRef**: inject ALL keys as env vars (key = env var name)\n3. **volume mount**: ConfigMap keys become files; value becomes file content\n\n```yaml\n# Method 3 example:\nvolumes:\n- name: conf\n  configMap:\n    name: my-config\ncontainers:\n- volumeMounts:\n  - mountPath: /etc/config\n    name: conf\n```'
    },
    {
      front: 'What is the difference between Secret `data` and `stringData`?',
      back: '**data**: stores base64-encoded values\n```yaml\ndata:\n  password: cGFzc3dvcmQ=  # base64("password")\n```\n\n**stringData**: stores plaintext (auto-encoded by K8s)\n```yaml\nstringData:\n  password: mysecretpass  # Kubernetes encodes this\n```\n\n`stringData` is write-only — it appears as `data` when you read the Secret back.'
    },
    {
      front: 'Do env vars from a ConfigMap update automatically when the ConfigMap changes?',
      back: '**No.** Environment variables are set at **pod start time** and are static.\n\nTo pick up ConfigMap changes via env vars: **restart the pod**.\n\n**Volume mounts DO update automatically** — the kubelet syncs changes within ~1 minute without a pod restart.\n\nDesign tip: use volume mounts for config that changes frequently; have the app watch the file.'
    },
    {
      front: 'How do you create a Secret and a ConfigMap from literal values imperatively?',
      back: '```bash\n# ConfigMap\nkubectl create configmap my-cm \\\n  --from-literal=KEY1=value1 \\\n  --from-literal=KEY2=value2\n\n# Secret\nkubectl create secret generic my-secret \\\n  --from-literal=username=admin \\\n  --from-literal=password=s3cr3t\n\n# Dry-run to YAML\nkubectl create secret generic my-secret \\\n  --from-literal=pass=secret \\\n  --dry-run=client -o yaml\n```'
    },
    {
      front: 'What are the main Secret types in Kubernetes?',
      back: '| Type | Use |\n|------|-----|\n| `Opaque` | Generic (default) |\n| `kubernetes.io/tls` | TLS cert + key |\n| `kubernetes.io/dockerconfigjson` | Docker registry auth |\n| `kubernetes.io/service-account-token` | SA tokens |\n| `kubernetes.io/basic-auth` | user/password |\n| `kubernetes.io/ssh-auth` | SSH private key |\n\nCreate TLS: `kubectl create secret tls <name> --cert=cert.crt --key=key.key`'
    },
    {
      front: 'How do you decode a Secret value with kubectl?',
      back: '```bash\n# Decode a specific key\nkubectl get secret my-secret \\\n  -o jsonpath=\'{.data.password}\' | base64 -d\n\n# See all secret data decoded\nkubectl get secret my-secret -o yaml\n# Values are shown base64-encoded; decode each manually\n\n# Quick one-liner for all values\nkubectl get secret my-secret -o go-template=\\\n\'{{range $k,$v := .data}}{{$k}}={{$v|base64decode}}{{\"\\n\"}}{{end}}\'\n```'
    },
    {
      front: 'How do you mount only specific keys from a ConfigMap as files?',
      back: '```yaml\nvolumes:\n- name: config\n  configMap:\n    name: my-configmap\n    items:              # select specific keys\n    - key: nginx.conf   # key from ConfigMap\n      path: nginx.conf  # filename in the volume\n    - key: app.yaml\n      path: config/app.yaml  # can create subdirectories\n```\n\nWithout `items`: all keys become files.\nWith `items`: only listed keys are mounted.'
    },
    {
      front: 'Is a Kubernetes Secret actually encrypted?',
      back: '**No — by default, Secrets are only base64-encoded, not encrypted.**\n\nBase64 is an encoding scheme, not encryption. Anyone with access to etcd can decode it.\n\nTo truly encrypt Secrets:\n1. Enable **EncryptionConfiguration** on the API server\n2. Use a KMS provider (AWS KMS, HashiCorp Vault, etc.)\n3. Use **External Secrets Operator** to store secrets in a vault\n\nCKA exam: know this distinction. KCSA exam: tested heavily.'
    }
  ],
  lab: {
    scenario: 'Configure an application to consume configuration from ConfigMaps and sensitive credentials from Secrets using multiple injection methods.',
    objective: 'Create ConfigMaps and Secrets, inject them via env vars and volume mounts, and verify the data is accessible inside the pod.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create ConfigMap and Inject as Env Vars',
        instruction: `In namespace **config-lab**:
1. Create a ConfigMap **app-settings** with keys: \`APP_ENV=production\`, \`LOG_LEVEL=info\`, \`MAX_RETRY=3\`
2. Create a Pod **env-pod** using image \`busybox\` that injects all ConfigMap keys as environment variables using \`envFrom\`
3. Verify all 3 variables are available inside the pod`,
        hints: [
          'Use \`kubectl create configmap\` with multiple \`--from-literal\` flags',
          'In the pod spec, use \`envFrom.configMapRef.name\` to inject all keys at once',
          'Verify with: kubectl exec env-pod -- env | grep APP_ENV'
        ],
        solution: `\`\`\`bash
kubectl create namespace config-lab

kubectl create configmap app-settings -n config-lab \\
  --from-literal=APP_ENV=production \\
  --from-literal=LOG_LEVEL=info \\
  --from-literal=MAX_RETRY=3

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: env-pod
  namespace: config-lab
spec:
  containers:
  - name: app
    image: busybox
    command: ["sleep", "3600"]
    envFrom:
    - configMapRef:
        name: app-settings
EOF

kubectl get pod env-pod -n config-lab
kubectl exec -n config-lab env-pod -- env | grep -E "APP_ENV|LOG_LEVEL|MAX_RETRY"
\`\`\``,
        verify: `\`\`\`bash
kubectl exec -n config-lab env-pod -- env | grep APP_ENV
# Expected: APP_ENV=production

kubectl exec -n config-lab env-pod -- env | grep LOG_LEVEL
# Expected: LOG_LEVEL=info

kubectl exec -n config-lab env-pod -- env | grep MAX_RETRY
# Expected: MAX_RETRY=3
\`\`\``
      },
      {
        title: 'Create Secret and Mount as Volume',
        instruction: `In namespace **config-lab**:
1. Create a Secret **db-creds** with \`username=dbadmin\` and \`password=SuperSecret123\`
2. Create a Pod **secret-pod** that mounts the Secret at \`/etc/db-creds\` as a read-only volume
3. Verify the credentials are available as files inside the pod`,
        hints: [
          'Use \`kubectl create secret generic\` with \`--from-literal\` flags',
          'In pod spec: volumes.secret.secretName and volumeMounts.readOnly: true',
          'Files will be named after the Secret keys: /etc/db-creds/username, /etc/db-creds/password'
        ],
        solution: `\`\`\`bash
kubectl create secret generic db-creds -n config-lab \\
  --from-literal=username=dbadmin \\
  --from-literal=password=SuperSecret123

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: secret-pod
  namespace: config-lab
spec:
  volumes:
  - name: db-secret
    secret:
      secretName: db-creds
  containers:
  - name: app
    image: busybox
    command: ["sleep", "3600"]
    volumeMounts:
    - name: db-secret
      mountPath: /etc/db-creds
      readOnly: true
EOF

kubectl exec -n config-lab secret-pod -- ls /etc/db-creds/
kubectl exec -n config-lab secret-pod -- cat /etc/db-creds/username
kubectl exec -n config-lab secret-pod -- cat /etc/db-creds/password
\`\`\``,
        verify: `\`\`\`bash
kubectl exec -n config-lab secret-pod -- ls /etc/db-creds/
# Expected: password  username

kubectl exec -n config-lab secret-pod -- cat /etc/db-creds/username
# Expected: dbadmin

kubectl exec -n config-lab secret-pod -- cat /etc/db-creds/password
# Expected: SuperSecret123  (decoded, NOT base64)
\`\`\``
      },
      {
        title: 'Mix Both — ConfigMap File Mount + Secret Env Var',
        instruction: `Create a Pod **mixed-pod** in namespace **config-lab** that:
1. Mounts ConfigMap **app-settings** as files at \`/etc/app-config\`
2. Injects only the \`password\` key from Secret **db-creds** as env var \`DB_PASSWORD\`
3. Verify both the config files and the env var are available`,
        hints: [
          'Use volumes.configMap for the file mount',
          'Use env.valueFrom.secretKeyRef for the single secret key',
          'Check files: kubectl exec mixed-pod -- ls /etc/app-config/'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: mixed-pod
  namespace: config-lab
spec:
  volumes:
  - name: app-config
    configMap:
      name: app-settings
  containers:
  - name: app
    image: busybox
    command: ["sleep", "3600"]
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-creds
          key: password
    volumeMounts:
    - name: app-config
      mountPath: /etc/app-config
EOF

kubectl exec -n config-lab mixed-pod -- ls /etc/app-config/
kubectl exec -n config-lab mixed-pod -- cat /etc/app-config/APP_ENV
kubectl exec -n config-lab mixed-pod -- env | grep DB_PASSWORD
\`\`\``,
        verify: `\`\`\`bash
kubectl exec -n config-lab mixed-pod -- ls /etc/app-config/
# Expected: APP_ENV  LOG_LEVEL  MAX_RETRY

kubectl exec -n config-lab mixed-pod -- cat /etc/app-config/APP_ENV
# Expected: production

kubectl exec -n config-lab mixed-pod -- env | grep DB_PASSWORD
# Expected: DB_PASSWORD=SuperSecret123
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pod fails to start — configMapKeyRef key not found',
      difficulty: 'easy',
      symptom: 'Pod stays in `Pending` or immediately goes to `CreateContainerConfigError`. The error mentions "key not found in ConfigMap".',
      diagnosis: `\`\`\`bash
# Check pod events
kubectl describe pod <pod-name> -n <namespace>
# Look for: "Error: couldn't find key <KEY> in ConfigMap <namespace>/<name>"

# List the actual keys in the ConfigMap
kubectl get configmap <name> -n <namespace> -o yaml
# Compare key names (case-sensitive!)

# Or more concisely:
kubectl get configmap <name> -n <namespace> \\
  -o jsonpath='{.data}' | python3 -m json.tool
\`\`\``,
      solution: `The key name in the pod's \`configMapKeyRef.key\` doesn't match any key in the ConfigMap. Keys are **case-sensitive**.

\`\`\`bash
# Example: ConfigMap has "log_level" but pod references "LOG_LEVEL"

# Fix Option 1: Update the pod spec to use correct key name
# In the pod's env section:
# - name: LOG_LEVEL
#   valueFrom:
#     configMapKeyRef:
#       name: app-config
#       key: log_level    ← match exact case

# Fix Option 2: Update the ConfigMap to add the expected key
kubectl patch configmap app-config -n <namespace> \\
  --type merge \\
  -p '{"data":{"LOG_LEVEL":"info"}}'

# Fix Option 3: Add optional: true to avoid pod failure on missing key
# env:
# - name: LOG_LEVEL
#   valueFrom:
#     configMapKeyRef:
#       name: app-config
#       key: LOG_LEVEL
#       optional: true    ← pod starts even if key missing

# Restart the pod after fixing
kubectl delete pod <pod-name> -n <namespace>
\`\`\``
    },
    {
      title: 'Environment variable shows old value after ConfigMap update',
      difficulty: 'medium',
      symptom: 'You updated a ConfigMap value, but the running pod still shows the old value when you check `env` inside the container.',
      diagnosis: `\`\`\`bash
# Confirm ConfigMap was updated
kubectl get configmap app-config -n <namespace> -o yaml
# Check the new value is there

# Check the pod's env var
kubectl exec <pod-name> -n <namespace> -- env | grep <VAR_NAME>
# Still shows old value!

# Check when pod started
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.status.startTime}'
# Pod started BEFORE the ConfigMap update
\`\`\``,
      solution: `Environment variables set from ConfigMaps are captured at **pod start time**. They do NOT update when the ConfigMap changes — the pod must be restarted.

\`\`\`bash
# Restart the pod to pick up new ConfigMap values
# If it's a standalone pod:
kubectl delete pod <pod-name> -n <namespace>
# Pod will be re-created by its controller (Deployment/ReplicaSet) with new values

# If it's managed by a Deployment:
kubectl rollout restart deployment/<name> -n <namespace>

# Verify after restart
kubectl exec <new-pod-name> -n <namespace> -- env | grep <VAR_NAME>
# Expected: new value from updated ConfigMap
\`\`\`

**Prevention**: Use **volume mounts** instead of env vars for config that changes frequently. Volume-mounted ConfigMaps update automatically within ~1 minute without pod restart.`
    }
  ]
};
