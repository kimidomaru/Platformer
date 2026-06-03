window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['security-tooling/external-secrets'] = {
  theory: `
# External Secrets Operator (ESO)

## Relevance
The External Secrets Operator (ESO) synchronizes secrets from external providers to native Kubernetes Secrets. It supports AWS Secrets Manager, HashiCorp Vault, Azure Key Vault, GCP Secret Manager, and others. The main advantage is decoupling secret storage from the cluster while maintaining centralized compliance and auditing.

## Core Concepts

### ESO Architecture

\`\`\`
   ┌──────────────────────────────────────────┐
   │         External Provider                │
   │  (AWS SM, Vault, Azure KV, GCP SM)       │
   └──────────────────┬───────────────────────┘
                      │
   ┌──────────────────▼───────────────────────┐
   │     External Secrets Operator            │
   │  ┌──────────────┐  ┌──────────────────┐  │
   │  │ SecretStore / │  │ ExternalSecret   │  │
   │  │ ClusterSecret │  │ (sync config)    │  │
   │  │ Store         │  │                  │  │
   │  └──────────────┘  └──────────────────┘  │
   └──────────────────┬───────────────────────┘
                      │
   ┌──────────────────▼───────────────────────┐
   │     Kubernetes Secret (native)           │
   │     (created/updated by ESO)             │
   └──────────────────────────────────────────┘
\`\`\`

### Main CRDs

| CRD | Scope | Function |
|-----|-------|----------|
| SecretStore | Namespace | Provider connection in that namespace |
| ClusterSecretStore | Cluster | Shared connection cluster-wide |
| ExternalSecret | Namespace | Defines which secrets to sync |
| ClusterExternalSecret | Cluster | Syncs across multiple namespaces |
| PushSecret | Namespace | Pushes secrets FROM cluster TO provider |

### Installation

\`\`\`bash
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

helm install external-secrets external-secrets/external-secrets \\
  --namespace external-secrets --create-namespace

kubectl rollout status deployment external-secrets -n external-secrets
\`\`\`

### SecretStore with AWS Secrets Manager

\`\`\`yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secretsmanager
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        secretRef:
          accessKeyIDSecretRef:
            name: aws-credentials
            key: access-key
          secretAccessKeySecretRef:
            name: aws-credentials
            key: secret-key
\`\`\`

### SecretStore with HashiCorp Vault

\`\`\`yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-store
  namespace: production
spec:
  provider:
    vault:
      server: "http://vault.vault.svc:8200"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "eso-role"
          serviceAccountRef:
            name: external-secrets-sa
\`\`\`

### ExternalSecret — Synchronize Secrets

\`\`\`yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-secrets
  namespace: production
spec:
  refreshInterval: 1h                    # sync frequency
  secretStoreRef:
    name: aws-secretsmanager
    kind: SecretStore
  target:
    name: myapp-k8s-secret               # K8s Secret name created
    creationPolicy: Owner                 # ESO manages the lifecycle
    deletionPolicy: Retain                # keep Secret if ExternalSecret is deleted
  data:
    - secretKey: db-password              # key in K8s Secret
      remoteRef:
        key: production/myapp/database    # path in provider
        property: password                # specific JSON field
    - secretKey: api-key
      remoteRef:
        key: production/myapp/api
        property: key
\`\`\`

### ExternalSecret with Template

\`\`\`yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-config
  namespace: production
spec:
  refreshInterval: 30m
  secretStoreRef:
    name: vault-store
    kind: SecretStore
  target:
    name: myapp-config-secret
    template:
      type: Opaque
      data:
        config.yaml: |
          database:
            host: {{ .db_host }}
            port: {{ .db_port }}
            username: {{ .db_user }}
            password: {{ .db_pass }}
  data:
    - secretKey: db_host
      remoteRef:
        key: secret/data/myapp/db
        property: host
    - secretKey: db_port
      remoteRef:
        key: secret/data/myapp/db
        property: port
    - secretKey: db_user
      remoteRef:
        key: secret/data/myapp/db
        property: username
    - secretKey: db_pass
      remoteRef:
        key: secret/data/myapp/db
        property: password
\`\`\`

### PushSecret — Push from Cluster to Provider

\`\`\`yaml
apiVersion: external-secrets.io/v1alpha1
kind: PushSecret
metadata:
  name: push-to-vault
  namespace: production
spec:
  secretStoreRefs:
    - name: vault-store
      kind: SecretStore
  selector:
    secret:
      name: my-local-secret
  data:
    - match:
        secretKey: api-key
        remoteRef:
          remoteKey: production/pushed-secrets
          property: api-key
\`\`\`

### Supported Providers

| Provider | Auth Methods |
|----------|-------------|
| AWS Secrets Manager | IAM, IRSA, Access Keys |
| AWS Parameter Store | IAM, IRSA, Access Keys |
| HashiCorp Vault | Token, Kubernetes, AppRole |
| Azure Key Vault | Managed Identity, SP, Workload Identity |
| GCP Secret Manager | Service Account, Workload Identity |
| IBM Cloud SM | API Key |
| Oracle Vault | Auth token |
| Kubernetes | ServiceAccount |

### Common Mistakes

1. **refreshInterval too short** — can cause rate limiting on the provider; use 1h+ in production
2. **Expired credentials in SecretStore** — verify provider auth is active
3. **Wrong property** — if the provider secret is JSON, property must be the exact field name
4. **ClusterSecretStore vs SecretStore** — ClusterSecretStore needs conditions to restrict access

## Killer.sh Style Challenge

> **Scenario:** Configure ESO to sync secrets from AWS Secrets Manager: (1) create SecretStore with credentials, (2) create ExternalSecret that syncs db credentials and api key, (3) verify the Kubernetes Secret was created with correct values.
`,
  quiz: [
    {
      question: 'What is the difference between SecretStore and ClusterSecretStore?',
      options: [
        'SecretStore supports more providers',
        'SecretStore is limited to one namespace, ClusterSecretStore is shared cluster-wide',
        'ClusterSecretStore is more secure',
        'No functional difference'
      ],
      correct: 1,
      explanation: 'SecretStore configures the provider connection for a specific namespace. ClusterSecretStore is cluster-scoped and can be used by ExternalSecrets in any namespace.',
      reference: 'Related concept: Use conditions in ClusterSecretStore to restrict which namespaces can use it.'
    },
    {
      question: 'What does the ExternalSecret create in Kubernetes?',
      options: [
        'A ConfigMap',
        'A native Kubernetes Secret synchronized with the external provider',
        'A persistent volume',
        'A ServiceAccount'
      ],
      correct: 1,
      explanation: 'The ExternalSecret makes ESO create and keep updated a native Kubernetes Secret, periodically syncing values from the external provider (AWS SM, Vault, etc.).',
      reference: 'Related concept: target.name defines the K8s Secret name, refreshInterval defines sync frequency.'
    },
    {
      question: 'What is the purpose of PushSecret?',
      options: [
        'To force secret synchronization',
        'To send secrets FROM Kubernetes TO the external provider',
        'To notify about secret changes',
        'To create secrets in the provider'
      ],
      correct: 1,
      explanation: 'PushSecret does the opposite of ExternalSecret: it sends secrets from the Kubernetes cluster to the external provider (Vault, AWS SM, etc.). Useful for migrations or backup.',
      reference: 'Related concept: PushSecret is v1alpha1, still under active development.'
    },
    {
      question: 'Which field defines the synchronization frequency in ExternalSecret?',
      options: [
        'syncInterval',
        'refreshInterval',
        'pollInterval',
        'updateFrequency'
      ],
      correct: 1,
      explanation: 'refreshInterval defines how often ESO checks the external provider for changes and updates the Kubernetes Secret. Example: "1h" checks every hour.',
      reference: 'Related concept: In production, use 1h+ to avoid rate limiting. For dev, 5m is acceptable.'
    },
    {
      question: 'How does ESO authenticate with HashiCorp Vault?',
      options: [
        'Only via static token',
        'Via Kubernetes auth (ServiceAccount), token, or AppRole',
        'Via username/password',
        'Via TLS certificate only'
      ],
      correct: 1,
      explanation: 'ESO supports multiple Vault auth methods: Kubernetes (using cluster ServiceAccount), static token, and AppRole. Kubernetes auth is the most recommended in clusters.',
      reference: 'Related concept: auth.kubernetes.role defines the Vault role for authentication.'
    },
    {
      question: 'Which creationPolicy indicates that ESO fully manages the Secret lifecycle?',
      options: [
        'Merge',
        'Owner',
        'None',
        'Managed'
      ],
      correct: 1,
      explanation: 'creationPolicy: Owner means ESO is the exclusive owner of the Secret and manages its complete lifecycle. If the ExternalSecret is deleted, the Secret will also be deleted (unless deletionPolicy: Retain).',
      reference: 'Related concept: creationPolicy: Merge preserves existing keys in the Secret, Owner replaces everything.'
    },
    {
      question: 'How do you reference a specific field within a JSON secret in the provider?',
      options: [
        'Using data.field',
        'Using remoteRef.property with the field name',
        'Using jsonPath',
        'Not possible, need the full JSON'
      ],
      correct: 1,
      explanation: 'The remoteRef.property field allows extracting a specific field from a JSON secret in the provider. For example, if the secret is {"user":"admin","pass":"123"}, property: "pass" extracts only "123".',
      reference: 'Related concept: Without property, the entire value (full JSON) is synchronized.'
    }
  ],
  flashcards: [
    {
      front: 'What are the External Secrets Operator CRDs?',
      back: '| CRD | Function |\n|-----|----------|\n| **SecretStore** | Provider connection (namespace) |\n| **ClusterSecretStore** | Shared connection (cluster) |\n| **ExternalSecret** | Sync provider -> K8s Secret |\n| **ClusterExternalSecret** | Sync across multiple namespaces |\n| **PushSecret** | Sync K8s Secret -> provider |\n\n**Flow:** SecretStore + ExternalSecret = K8s Secret\n**Direction:** ExternalSecret (pull), PushSecret (push)'
    },
    {
      front: 'Which providers does ESO support?',
      back: '| Provider | Auth Methods |\n|----------|-------------|\n| **AWS Secrets Manager** | IAM, IRSA, Access Keys |\n| **AWS Parameter Store** | IAM, IRSA, Access Keys |\n| **HashiCorp Vault** | Token, K8s, AppRole |\n| **Azure Key Vault** | MI, SP, Workload Identity |\n| **GCP Secret Manager** | SA, Workload Identity |\n| **1Password** | Connect Token |\n| **Kubernetes** | ServiceAccount |\n| **Oracle Vault** | Auth token |\n\nAll configured via SecretStore/ClusterSecretStore.'
    },
    {
      front: 'How does refreshInterval work?',
      back: '**refreshInterval** defines the sync frequency.\n\n**How it works:**\n1. ESO checks the provider at each interval\n2. If value changed, updates K8s Secret\n3. If unchanged, no action\n\n**Recommendations:**\n- Dev/staging: 5m-15m\n- Production: 1h+ (avoid rate limiting)\n- Critical secrets: 15m-30m\n\n**Considerations:**\n- Provider rate limits (AWS: 10k/s, Vault: depends)\n- Each ExternalSecret makes one call per interval\n- Many ExternalSecrets + short interval = many calls'
    },
    {
      front: 'What is the difference between creationPolicy Owner and Merge?',
      back: '**Owner:**\n- ESO is exclusive owner of the Secret\n- Deletes Secret if ExternalSecret is removed\n- Replaces all keys in the Secret\n- Use: when ESO manages 100% of the Secret\n\n**Merge:**\n- ESO adds/updates keys in existing Secret\n- Does NOT delete keys it does not manage\n- Preserves manually added keys\n- Use: when Secret has keys from multiple sources\n\n**None:**\n- ESO does not create the Secret (must exist)\n- Only updates existing keys'
    },
    {
      front: 'How to use templates in ExternalSecret?',
      back: '**Templates** allow transforming secrets into custom formats:\n\n\`\`\`yaml\ntarget:\n  template:\n    type: Opaque\n    data:\n      config.yaml: |\n        db_host: {{ .host }}\n        db_pass: {{ .password }}\n\`\`\`\n\n**Available functions:**\n- {{ .key }} — secret value\n- {{ .key | b64enc }} — base64 encode\n- {{ .key | b64dec }} — base64 decode\n- {{ .key | upper }} — uppercase\n- {{ .key | lower }} — lowercase\n\nUseful for generating config files, connection strings, etc.'
    },
    {
      front: 'ESO vs Vault Agent Injector vs CSI Driver — when to use each?',
      back: '**ESO (External Secrets Operator):**\n- Creates native K8s Secrets\n- Works with any provider\n- No sidecar or special volume\n- Best for: teams wanting standard K8s Secrets\n\n**Vault Agent Injector:**\n- Sidecar in the Pod\n- Vault only\n- Advanced Go templates\n- Automatic rotation\n- Best for: apps reading files\n\n**CSI Driver:**\n- CSI volume\n- Vault, AWS, Azure, GCP\n- No sidecar\n- Best for: smallest footprint'
    },
    {
      front: 'How to diagnose sync failures in ESO?',
      back: '**Diagnostic checklist:**\n\n1. **ExternalSecret status:**\nkubectl get externalsecret -o wide\n(check STATUS: SecretSynced or error)\n\n2. **Events:**\nkubectl describe externalsecret <name>\n\n3. **SecretStore status:**\nkubectl get secretstore -o wide\n(check STATUS: Valid)\n\n4. **Operator logs:**\nkubectl logs -n external-secrets deploy/external-secrets\n\n5. **Credentials:**\nVerify auth in SecretStore is still valid\n\n**Common errors:** 403 (permission), 404 (wrong path), timeout (network)'
    }
  ],
  lab: {
    scenario: 'You need to configure the External Secrets Operator to sync secrets from HashiCorp Vault to native Kubernetes Secrets.',
    objective: 'Install ESO, configure SecretStore with Vault, create ExternalSecret, and verify synchronization.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Install External Secrets Operator',
        instruction: `Install ESO via Helm and verify the components.

\`\`\`bash
# Install ESO
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

helm install external-secrets external-secrets/external-secrets \\
  --namespace external-secrets --create-namespace

# Wait for Pods
kubectl rollout status deployment external-secrets -n external-secrets
kubectl rollout status deployment external-secrets-webhook -n external-secrets
kubectl rollout status deployment external-secrets-cert-controller -n external-secrets
\`\`\``,
        hints: [
          'ESO has 3 components: controller, webhook, and cert-controller',
          'The cert-controller manages TLS certificates for the webhook',
          'Verify CRDs with kubectl get crd | grep external-secrets'
        ],
        solution: `\`\`\`bash
helm repo add external-secrets https://charts.external-secrets.io
helm repo update
helm install external-secrets external-secrets/external-secrets --namespace external-secrets --create-namespace
\`\`\``,
        verify: `\`\`\`bash
# Verify Pods
kubectl get pods -n external-secrets
# Expected output: external-secrets, external-secrets-webhook, external-secrets-cert-controller all Running

# Verify CRDs
kubectl get crd | grep external-secrets
# Expected output: externalsecrets, secretstores, clustersecretstores, etc.

# Verify API resources
kubectl api-resources | grep external-secrets
# Expected output: externalsecrets, secretstores, clustersecretstores, pushsecrets
\`\`\``
      },
      {
        title: 'Configure SecretStore with Vault',
        instruction: `Configure a SecretStore that connects to HashiCorp Vault (assuming Vault is already installed from the previous lab).

\`\`\`bash
# Create ServiceAccount for ESO
kubectl create serviceaccount eso-vault-sa

# Configure role in Vault for ESO
kubectl exec -n vault vault-0 -- vault write auth/kubernetes/role/eso-role \\
  bound_service_account_names=eso-vault-sa \\
  bound_service_account_namespaces=default \\
  policies=myapp-policy \\
  ttl=1h

# Create SecretStore
kubectl apply -f - <<EOF
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-store
  namespace: default
spec:
  provider:
    vault:
      server: "http://vault.vault.svc:8200"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "eso-role"
          serviceAccountRef:
            name: eso-vault-sa
EOF
\`\`\``,
        hints: [
          'The SecretStore needs valid credentials to connect to the provider',
          'For Vault, kubernetes auth is the most secure method in a cluster',
          'The Vault role must allow reading on the paths the ExternalSecret will access'
        ],
        solution: `\`\`\`bash
kubectl create serviceaccount eso-vault-sa
kubectl exec -n vault vault-0 -- vault write auth/kubernetes/role/eso-role bound_service_account_names=eso-vault-sa bound_service_account_namespaces=default policies=myapp-policy ttl=1h
kubectl apply -f vault-secretstore.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify SecretStore
kubectl get secretstore vault-store
# Expected output: vault-store   Valid   Xs

# Verify details
kubectl describe secretstore vault-store | grep -A5 "Status"
# Expected output: Type: Ready, Status: True
\`\`\``
      },
      {
        title: 'Create ExternalSecret and Verify Sync',
        instruction: `Create an ExternalSecret that syncs secrets from Vault and verify the Kubernetes Secret created.

\`\`\`bash
# Ensure secrets exist in Vault
kubectl exec -n vault vault-0 -- vault kv put secret/myapp/config \\
  db_host="postgres.production.svc" \\
  db_user="myapp" \\
  db_pass="SuperSecr3t!" \\
  api_key="ak-1234567890"

# Create ExternalSecret
kubectl apply -f - <<EOF
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-external
  namespace: default
spec:
  refreshInterval: 5m
  secretStoreRef:
    name: vault-store
    kind: SecretStore
  target:
    name: myapp-synced-secret
    creationPolicy: Owner
  data:
    - secretKey: DB_HOST
      remoteRef:
        key: secret/data/myapp/config
        property: db_host
    - secretKey: DB_USER
      remoteRef:
        key: secret/data/myapp/config
        property: db_user
    - secretKey: DB_PASS
      remoteRef:
        key: secret/data/myapp/config
        property: db_pass
    - secretKey: API_KEY
      remoteRef:
        key: secret/data/myapp/config
        property: api_key
EOF
\`\`\``,
        hints: [
          'The remoteRef.key must include secret/data/ for Vault KV v2',
          'property extracts a specific field from the JSON stored in Vault',
          'The Kubernetes Secret will be created automatically by ESO'
        ],
        solution: `\`\`\`bash
kubectl exec -n vault vault-0 -- vault kv put secret/myapp/config db_host="postgres" db_user="myapp" db_pass="SuperSecr3t!" api_key="ak-1234567890"
kubectl apply -f myapp-external-secret.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify ExternalSecret
kubectl get externalsecret myapp-external
# Expected output: myapp-external   vault-store   SecretSynced   True   Xs

# Verify Kubernetes Secret created
kubectl get secret myapp-synced-secret
# Expected output: myapp-synced-secret   Opaque   4   Xs

# Verify synchronized values
kubectl get secret myapp-synced-secret -o jsonpath='{.data.DB_HOST}' | base64 -d
# Expected output: postgres.production.svc

kubectl get secret myapp-synced-secret -o jsonpath='{.data.DB_PASS}' | base64 -d
# Expected output: SuperSecr3t!

# Verify all 4 fields are present
kubectl get secret myapp-synced-secret -o jsonpath='{.data}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d.keys()))"
# Expected output: ['API_KEY', 'DB_HOST', 'DB_PASS', 'DB_USER']
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ExternalSecret not syncing — status SecretSyncedError',
      difficulty: 'easy',
      symptom: 'The ExternalSecret shows status SecretSyncedError and the Kubernetes Secret is not created.',
      diagnosis: `\`\`\`bash
# Check ExternalSecret status
kubectl get externalsecret <name> -o wide

# Check detailed events
kubectl describe externalsecret <name>

# Check SecretStore status
kubectl get secretstore <name> -o wide
kubectl describe secretstore <name>

# Check ESO logs
kubectl logs -n external-secrets deploy/external-secrets --tail=30
\`\`\``,
      solution: `**Common causes:**

1. **Invalid SecretStore:** Verify the SecretStore has Status Valid. If not, credentials may be wrong.

2. **Wrong path in remoteRef:** For Vault KV v2, the path must be \`secret/data/myapp/config\`, not \`secret/myapp/config\`.

3. **Non-existent property:** If the provider secret is JSON and the property doesn't exist in that JSON, sync fails.

4. **Insufficient permission:** The provider policy must allow reading on the specified path.`
    },
    {
      title: 'SecretStore shows Invalid status',
      difficulty: 'medium',
      symptom: 'The SecretStore was created but status shows Invalid. ExternalSecrets referencing it fail.',
      diagnosis: `\`\`\`bash
# Check SecretStore
kubectl describe secretstore <name>

# Check referenced credentials
kubectl get secret <auth-secret-name> -o yaml

# Check provider connectivity
kubectl exec -n external-secrets deploy/external-secrets -- curl -s <provider-url>

# Check ServiceAccount (if using kubernetes auth)
kubectl get serviceaccount <sa-name>
kubectl create token <sa-name>
\`\`\``,
      solution: `**Causes and solutions:**

1. **Invalid credentials:** The Secret referenced by SecretStore must contain valid credentials. Check access keys, tokens, or certificates.

2. **Unreachable provider:** ESO needs to connect to the provider over the network. Check DNS, firewall, and Service endpoints.

3. **Wrong ServiceAccount (Vault):** The referenced ServiceAccount must exist and have permission in the Vault role.

4. **Vault sealed:** If Vault is sealed, the SecretStore cannot validate the connection.`
    },
    {
      title: 'Secret out of sync — old values after provider update',
      difficulty: 'medium',
      symptom: 'Updated the secret in the provider (Vault/AWS) but the Kubernetes Secret still shows old values.',
      diagnosis: `\`\`\`bash
# Check refreshInterval
kubectl get externalsecret <name> -o jsonpath='{.spec.refreshInterval}'

# Check last sync time
kubectl get externalsecret <name> -o jsonpath='{.status.refreshTime}'

# Check conditions
kubectl get externalsecret <name> -o jsonpath='{.status.conditions}'

# Force resync
kubectl annotate externalsecret <name> force-sync=\$(date +%s) --overwrite
\`\`\``,
      solution: `**Causes and solutions:**

1. **refreshInterval too long:** If the interval is 1h, it may take up to 1 hour for the new value to appear. Reduce temporarily or force resync.

2. **Provider cache:** Some providers have internal caching. ESO may receive the cached value.

3. **Force resync:**
\`\`\`bash
# Add annotation to trigger sync
kubectl annotate externalsecret <name> force-sync=\$(date +%s) --overwrite
\`\`\`

4. **Secret version (Vault KV v2):** Verify the latest secret version is being read. By default, ESO reads the latest version.`
    }
  ]
};
