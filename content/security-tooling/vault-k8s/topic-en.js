window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['security-tooling/vault-k8s'] = {
  theory: `
# HashiCorp Vault & Kubernetes

## Relevance
HashiCorp Vault is the most widely adopted solution for centralized secrets management in Kubernetes environments. It provides dynamic secrets, automatic rotation, PKI, encryption as a service, and complete auditing. Integration with Kubernetes via Agent Injector or CSI Driver allows applications to consume secrets transparently.

## Core Concepts

### Vault + Kubernetes Architecture

\`\`\`
                    ┌──────────────────────────┐
                    │      Vault Server        │
                    │  ┌────────────────────┐  │
                    │  │  Secrets Engines   │  │
                    │  │  KV, PKI, AWS, DB  │  │
                    │  └────────────────────┘  │
                    │  ┌────────────────────┐  │
                    │  │  Auth Methods      │  │
                    │  │  Kubernetes, OIDC  │  │
                    │  └────────────────────┘  │
                    └──────────┬───────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼─────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │ Agent Injector │  │ CSI Driver  │  │ Vault API   │
    │ (sidecar)      │  │ (volume)    │  │ (SDK/HTTP)  │
    └────────────────┘  └─────────────┘  └─────────────┘
\`\`\`

### Kubernetes Auth Method

Vault authenticates Kubernetes workloads using ServiceAccount tokens:

\`\`\`bash
# Enable kubernetes auth method in Vault
vault auth enable kubernetes

# Configure cluster endpoint
vault write auth/kubernetes/config \\
  kubernetes_host="https://kubernetes.default.svc:443" \\
  token_reviewer_jwt=\$(cat /var/run/secrets/kubernetes.io/serviceaccount/token) \\
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

# Create role for application
vault write auth/kubernetes/role/myapp \\
  bound_service_account_names=myapp-sa \\
  bound_service_account_namespaces=production \\
  policies=myapp-policy \\
  ttl=1h
\`\`\`

### Secrets Engine — KV (Key-Value)

\`\`\`bash
# Enable KV v2
vault secrets enable -path=secret kv-v2

# Create secret
vault kv put secret/myapp/config \\
  db_host=postgres.production.svc \\
  db_user=myapp \\
  db_pass=s3cur3P@ss

# Read secret
vault kv get secret/myapp/config

# Access policy
vault policy write myapp-policy - <<EOF
path "secret/data/myapp/*" {
  capabilities = ["read"]
}
EOF
\`\`\`

### Agent Injector (Sidecar)

The Vault Agent Injector injects secrets via annotations on the Pod:

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    metadata:
      annotations:
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "myapp"
        vault.hashicorp.com/agent-inject-secret-config: "secret/data/myapp/config"
        vault.hashicorp.com/agent-inject-template-config: |
          {{- with secret "secret/data/myapp/config" -}}
          export DB_HOST="{{ .Data.data.db_host }}"
          export DB_USER="{{ .Data.data.db_user }}"
          export DB_PASS="{{ .Data.data.db_pass }}"
          {{- end }}
    spec:
      serviceAccountName: myapp-sa
      containers:
        - name: myapp
          image: myapp:v1
          command: ["/bin/sh", "-c", "source /vault/secrets/config && ./start.sh"]
\`\`\`

Secrets are placed at \`/vault/secrets/<name>\` inside the container.

### Vault CSI Provider

Alternative to Agent Injector using CSI volumes:

\`\`\`yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: vault-myapp
spec:
  provider: vault
  parameters:
    vaultAddress: "http://vault.vault.svc:8200"
    roleName: "myapp"
    objects: |
      - objectName: "db-password"
        secretPath: "secret/data/myapp/config"
        secretKey: "db_pass"
  secretObjects:
    - secretName: myapp-db-creds
      type: Opaque
      data:
        - objectName: db-password
          key: password
\`\`\`

### Dynamic Secrets

Vault can generate ephemeral credentials for databases:

\`\`\`bash
# Enable database secrets engine
vault secrets enable database

# Configure PostgreSQL connection
vault write database/config/mydb \\
  plugin_name=postgresql-database-plugin \\
  connection_url="postgresql://{{username}}:{{password}}@postgres:5432/mydb?sslmode=disable" \\
  allowed_roles="myapp-role" \\
  username="vault_admin" \\
  password="admin_pass"

# Create role with dynamic credentials
vault write database/roles/myapp-role \\
  db_name=mydb \\
  creation_statements="CREATE ROLE \\"{{name}}\\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \\"{{name}}\\";" \\
  default_ttl="1h" \\
  max_ttl="24h"

# Generate dynamic credentials
vault read database/creds/myapp-role
\`\`\`

### PKI — Internal Certificates

\`\`\`bash
# Enable PKI
vault secrets enable pki
vault secrets tune -max-lease-ttl=87600h pki

# Generate Root CA
vault write -field=certificate pki/root/generate/internal \\
  common_name="example.com" \\
  ttl=87600h > CA_cert.crt

# Configure issuing role
vault write pki/roles/internal-certs \\
  allowed_domains="svc.cluster.local" \\
  allow_subdomains=true \\
  max_ttl="72h"

# Issue certificate
vault write pki/issue/internal-certs \\
  common_name="myapp.production.svc.cluster.local" \\
  ttl="24h"
\`\`\`

### Common Mistakes

1. **Expired ServiceAccount token** — Kubernetes 1.24+ uses bound tokens; configure tokenReviewer in Vault
2. **Permission denied** — check policy path (KV v2 uses \`secret/data/...\` not \`secret/...\`)
3. **Agent Injector not injecting** — check webhook, annotations, and ServiceAccount
4. **Vault sealed** — Vault needs to be unsealed after restart; use auto-unseal in production

## Killer.sh Style Challenge

> **Scenario:** Configure Vault in Kubernetes with: (1) kubernetes auth method, (2) KV secret engine with database credentials, (3) Agent Injector to inject secrets into a Deployment, (4) policy allowing only read access on the application path.
`,
  quiz: [
    {
      question: 'What are the two main ways to integrate Vault with Kubernetes workloads?',
      options: [
        'ConfigMap and Secret',
        'Agent Injector (sidecar) and CSI Provider (volume)',
        'Init Container and CronJob',
        'Webhook and DaemonSet'
      ],
      correct: 1,
      explanation: 'The Agent Injector uses a sidecar mutating webhook to inject secrets as files into the Pod. The CSI Provider mounts secrets as volumes using the Secrets Store CSI Driver.',
      reference: 'Related concept: Agent Injector uses vault.hashicorp.com/* annotations on the Pod template.'
    },
    {
      question: 'How does Vault authenticate Kubernetes workloads?',
      options: [
        'Via container username/password',
        'Via the Pod ServiceAccount JWT token, validated by the Kubernetes API',
        'Via Pod IP',
        'Via node TLS certificate'
      ],
      correct: 1,
      explanation: 'The Kubernetes auth method uses the Pod ServiceAccount JWT token to authenticate with Vault. Vault validates the token against the Kubernetes API.',
      reference: 'Related concept: bound_service_account_names and bound_service_account_namespaces in the role.'
    },
    {
      question: 'What is the correct path for reading secrets in KV v2?',
      options: [
        'secret/myapp/config',
        'secret/data/myapp/config',
        'kv/myapp/config',
        'vault/secret/myapp/config'
      ],
      correct: 1,
      explanation: 'In KV v2, the actual path includes /data/ between the mount point and the secret path. Therefore, secret/data/myapp/config is the correct path for API access and policies.',
      reference: 'Related concept: Metadata is at secret/metadata/myapp/config.'
    },
    {
      question: 'What are dynamic secrets in Vault?',
      options: [
        'Secrets that change names automatically',
        'Ephemeral credentials generated on demand with TTL and automatic rotation',
        'Secrets stored in dynamic volumes',
        'Secrets that are dynamically encrypted'
      ],
      correct: 1,
      explanation: 'Dynamic secrets are credentials generated on demand by Vault (e.g., temporary database user/password) with defined TTL and automatic revocation after expiration.',
      reference: 'Related concept: database secrets engine generates PostgreSQL, MySQL, MongoDB credentials etc.'
    },
    {
      question: 'Where are secrets injected by Vault Agent Injector located inside the Pod?',
      options: [
        '/etc/vault/secrets',
        '/vault/secrets/<secret-name>',
        '/var/run/vault',
        '/tmp/vault'
      ],
      correct: 1,
      explanation: 'The Agent Injector mounts rendered secrets at /vault/secrets/ by default. The filename corresponds to the name defined in the agent-inject-secret-<name> annotation.',
      reference: 'Related concept: Use agent-inject-template to customize the file format.'
    },
    {
      question: 'Why does Vault need to be "unsealed" after restart?',
      options: [
        'To update certificates',
        'To decrypt the master key that protects stored data',
        'To connect to Kubernetes',
        'To synchronize with other Vault nodes'
      ],
      correct: 1,
      explanation: 'Vault encrypts all data at rest. When starting, it is "sealed" and needs unseal keys (Shamir shares) to reconstruct the master key and decrypt the data.',
      reference: 'Related concept: Auto-unseal with KMS (AWS, GCP, Azure) eliminates the need for manual unsealing.'
    },
    {
      question: 'What is the advantage of Vault CSI Provider over Agent Injector?',
      options: [
        'Supports more secret types',
        'Does not require a sidecar, reducing resource consumption and complexity',
        'Is more secure',
        'Supports more clouds'
      ],
      correct: 1,
      explanation: 'The CSI Provider does not add a sidecar container to the Pod, reducing resource overhead. It mounts secrets as CSI volumes and can sync with Kubernetes Secrets for use as env vars.',
      reference: 'Related concept: SecretProviderClass with secretObjects creates K8s Secrets automatically.'
    }
  ],
  flashcards: [
    {
      front: 'What are the most commonly used Vault Secrets Engines?',
      back: '| Engine | Function |\n|--------|----------|\n| **KV (v2)** | Key-value with versioning |\n| **Database** | Dynamic credentials (PostgreSQL, MySQL, MongoDB) |\n| **PKI** | Internal X.509 certificates |\n| **AWS/GCP/Azure** | Dynamic cloud credentials |\n| **Transit** | Encryption as a service |\n| **SSH** | Dynamic SSH credentials |\n\nEach engine is mounted at a path: vault secrets enable -path=<path> <engine>'
    },
    {
      front: 'How does the Vault Kubernetes Auth Method work?',
      back: '1. Pod sends request to Vault with ServiceAccount JWT\n2. Vault sends JWT to Kubernetes TokenReview API\n3. Kubernetes validates token and returns identity\n4. Vault checks if SA and namespace are in the role\n5. Vault issues access token with policies\n\n**Configuration:**\n- vault auth enable kubernetes\n- vault write auth/kubernetes/config ...\n- vault write auth/kubernetes/role/<role> ...\n\n**Role fields:** bound_service_account_names, bound_service_account_namespaces, policies, ttl'
    },
    {
      front: 'Agent Injector vs CSI Provider — when to use each?',
      back: '**Agent Injector (Sidecar):**\n- Renders custom templates\n- Automatic secret rotation\n- Higher resource consumption (sidecar)\n- Works with any volume\n\n**CSI Provider (Volume):**\n- No sidecar, less overhead\n- Can create K8s Secrets (env vars)\n- Does not require mutating webhook\n- Rotation depends on CSI volumes\n\n**Recommendation:**\n- Agent Injector for complex templates and rotation\n- CSI Provider for simplicity and smaller footprint'
    },
    {
      front: 'What are Dynamic Secrets and why are they more secure?',
      back: '**Dynamic Secrets** = credentials generated on demand\n\n**Flow:**\n1. App requests credential from Vault\n2. Vault generates temporary user/pass in the database\n3. Credential has TTL (e.g., 1h)\n4. Vault revokes automatically after expiration\n\n**Why more secure:**\n- Unique credentials per consumer\n- Short TTL limits exposure\n- Automatic revocation\n- Audit trail of who accessed\n- No hardcoded or shared secrets'
    },
    {
      front: 'Which annotations control the Vault Agent Injector?',
      back: '| Annotation | Function |\n|------------|----------|\n| vault.hashicorp.com/agent-inject: "true" | Enable injection |\n| vault.hashicorp.com/role | Vault role for auth |\n| vault.hashicorp.com/agent-inject-secret-<name> | Secret path |\n| vault.hashicorp.com/agent-inject-template-<name> | Go template |\n| vault.hashicorp.com/agent-pre-populate-only | Init only (no sidecar) |\n| vault.hashicorp.com/agent-inject-status | "injected" to skip |\n\nSecrets are at /vault/secrets/<name>'
    },
    {
      front: 'How does Vault PKI work for internal certificates?',
      back: '1. **Enable PKI engine:**\nvault secrets enable pki\n\n2. **Generate Root CA:**\nvault write pki/root/generate/internal common_name="example.com"\n\n3. **Create issuing role:**\nvault write pki/roles/my-role allowed_domains="svc.cluster.local" allow_subdomains=true\n\n4. **Issue certificate:**\nvault write pki/issue/my-role common_name="app.ns.svc.cluster.local"\n\n**Integration:** Can be used with cert-manager via Vault Issuer.'
    },
    {
      front: 'What is Auto-Unseal and why use it in production?',
      back: '**Problem:** Sealed Vault after restart requires manual unseal keys (Shamir shares).\n\n**Auto-Unseal:** Uses external KMS for automatic unsealing:\n- AWS KMS\n- GCP Cloud KMS\n- Azure Key Vault\n- HSM (Hardware Security Module)\n\n**Advantage:**\n- No manual intervention on restarts\n- No need to distribute unseal keys\n- Audit trail in KMS\n\n**Configuration:**\nseal "awskms" { kms_key_id = "..." }'
    }
  ],
  lab: {
    scenario: 'You need to configure HashiCorp Vault in Kubernetes to provide database secrets to an application via Agent Injector.',
    objective: 'Install Vault via Helm, configure Kubernetes auth, create secrets, and inject them into a Deployment.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Install Vault in Kubernetes',
        instruction: `Install HashiCorp Vault using Helm and initialize the server.

\`\`\`bash
# Add Vault Helm repo
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update

# Install Vault in dev mode (for lab)
helm install vault hashicorp/vault \\
  --namespace vault --create-namespace \\
  --set "server.dev.enabled=true" \\
  --set "injector.enabled=true"

# Wait for Pods to be ready
kubectl rollout status statefulset vault -n vault

# Check status
kubectl exec -n vault vault-0 -- vault status
\`\`\``,
        hints: [
          'Dev mode auto-unseals and initializes with root token "root"',
          'In production, use raft storage and auto-unseal with KMS',
          'The injector is a mutating webhook that monitors vault.* annotations'
        ],
        solution: `\`\`\`bash
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update
helm install vault hashicorp/vault --namespace vault --create-namespace --set "server.dev.enabled=true" --set "injector.enabled=true"
kubectl rollout status statefulset vault -n vault
\`\`\``,
        verify: `\`\`\`bash
# Verify Vault Pod running
kubectl get pods -n vault
# Expected output: vault-0 Running, vault-agent-injector-* Running

# Verify status (should be unsealed in dev mode)
kubectl exec -n vault vault-0 -- vault status | grep Sealed
# Expected output: Sealed          false

# Verify injector webhook
kubectl get mutatingwebhookconfigurations | grep vault
# Expected output: vault-agent-injector-cfg
\`\`\``
      },
      {
        title: 'Configure Auth and Secrets',
        instruction: `Configure the Kubernetes auth method and create secrets in the KV engine.

\`\`\`bash
# Enter the Vault Pod
kubectl exec -it -n vault vault-0 -- /bin/sh

# Inside the Vault Pod:
# Enable Kubernetes auth
vault auth enable kubernetes

# Configure Kubernetes endpoint
vault write auth/kubernetes/config \\
  kubernetes_host="https://kubernetes.default.svc:443"

# Create secret in KV v2
vault kv put secret/myapp/config \\
  db_host="postgres.production.svc.cluster.local" \\
  db_user="myapp" \\
  db_pass="SuperSecr3t!" \\
  db_name="appdb"

# Create read policy
vault policy write myapp-policy - <<EOF
path "secret/data/myapp/*" {
  capabilities = ["read"]
}
EOF

# Create role bound to ServiceAccount
vault write auth/kubernetes/role/myapp \\
  bound_service_account_names=myapp-sa \\
  bound_service_account_namespaces=default \\
  policies=myapp-policy \\
  ttl=1h

# Exit the Pod
exit
\`\`\``,
        hints: [
          'In dev mode the root token is "root"',
          'KV v2 stores at secret/data/... but the CLI uses secret/...',
          'The role binds ServiceAccount + namespace to a Vault policy'
        ],
        solution: `\`\`\`bash
kubectl exec -n vault vault-0 -- vault auth enable kubernetes
kubectl exec -n vault vault-0 -- vault write auth/kubernetes/config kubernetes_host="https://kubernetes.default.svc:443"
kubectl exec -n vault vault-0 -- vault kv put secret/myapp/config db_host="postgres" db_user="myapp" db_pass="SuperSecr3t!"
\`\`\``,
        verify: `\`\`\`bash
# Verify auth method
kubectl exec -n vault vault-0 -- vault auth list | grep kubernetes
# Expected output: kubernetes/   kubernetes   ...

# Verify secret
kubectl exec -n vault vault-0 -- vault kv get secret/myapp/config
# Expected output: db_host, db_user, db_pass with values

# Verify policy
kubectl exec -n vault vault-0 -- vault policy read myapp-policy
# Expected output: path "secret/data/myapp/*" { capabilities = ["read"] }

# Verify role
kubectl exec -n vault vault-0 -- vault read auth/kubernetes/role/myapp
# Expected output: bound_service_account_names=[myapp-sa]
\`\`\``
      },
      {
        title: 'Inject Secrets via Agent Injector',
        instruction: `Create a Deployment that receives secrets from Vault automatically via annotations.

\`\`\`bash
# Create ServiceAccount
kubectl create serviceaccount myapp-sa

# Create Deployment with Vault Agent Injector annotations
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
      annotations:
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "myapp"
        vault.hashicorp.com/agent-inject-secret-db-config: "secret/data/myapp/config"
        vault.hashicorp.com/agent-inject-template-db-config: |
          {{- with secret "secret/data/myapp/config" -}}
          DB_HOST={{ .Data.data.db_host }}
          DB_USER={{ .Data.data.db_user }}
          DB_PASS={{ .Data.data.db_pass }}
          DB_NAME={{ .Data.data.db_name }}
          {{- end }}
    spec:
      serviceAccountName: myapp-sa
      containers:
        - name: myapp
          image: busybox
          command: ["sh", "-c", "cat /vault/secrets/db-config && sleep 3600"]
EOF
\`\`\``,
        hints: [
          'The Agent Injector adds an init-container and a sidecar automatically',
          'Secrets are placed at /vault/secrets/<name-in-annotation>',
          'Use agent-inject-template to customize the file format'
        ],
        solution: `\`\`\`bash
kubectl create serviceaccount myapp-sa
kubectl apply -f myapp-deployment.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify Pod with injected sidecar
kubectl get pods -l app=myapp -o jsonpath='{range .items[*]}{.metadata.name}{" containers="}{range .spec.containers[*]}{.name}{","}{end}{"\\n"}{end}'
# Expected output: myapp-xxx containers=myapp,vault-agent,

# Verify injected secrets
kubectl exec deploy/myapp -c myapp -- cat /vault/secrets/db-config
# Expected output:
# DB_HOST=postgres.production.svc.cluster.local
# DB_USER=myapp
# DB_PASS=SuperSecr3t!
# DB_NAME=appdb

# Verify vault-agent logs
kubectl logs deploy/myapp -c vault-agent | tail -5
# Expected output: authentication and template rendering logs
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Agent Injector not injecting secrets into Pod',
      difficulty: 'medium',
      symptom: 'The Pod has vault.hashicorp.com/* annotations but no vault-agent sidecar is added and /vault/secrets does not exist.',
      diagnosis: `\`\`\`bash
# Check if injector webhook is registered
kubectl get mutatingwebhookconfigurations | grep vault

# Check injector logs
kubectl logs -n vault deploy/vault-agent-injector --tail=20

# Check Pod annotations
kubectl get pod <pod> -o jsonpath='{.metadata.annotations}' | python3 -m json.tool

# Check if namespace has conflicting label
kubectl get namespace <ns> --show-labels
\`\`\``,
      solution: `**Common causes:**

1. **Webhook not registered:** The vault-agent-injector Pod needs to be running and the webhook registered. Reinstall the Helm chart.

2. **Annotation on Pod, not template:** Annotations must be in spec.template.metadata.annotations of the Deployment, not in the Deployment metadata.

3. **Excluded namespace:** Check if the namespace has a label that excludes the webhook.

4. **Non-existent ServiceAccount:** The serviceAccountName in the Pod must match what is defined in the Vault role.`
    },
    {
      title: 'Permission denied when accessing secrets',
      difficulty: 'medium',
      symptom: 'The vault-agent starts but fails with "permission denied" when trying to read secrets. Logs show 403 error.',
      diagnosis: `\`\`\`bash
# Check vault-agent logs
kubectl logs <pod> -c vault-agent-init

# Check policy in Vault
kubectl exec -n vault vault-0 -- vault policy read <policy-name>

# Check role
kubectl exec -n vault vault-0 -- vault read auth/kubernetes/role/<role>

# Test login manually
SA_TOKEN=\$(kubectl create token <sa-name>)
kubectl exec -n vault vault-0 -- vault write auth/kubernetes/login role=<role> jwt=\$SA_TOKEN
\`\`\``,
      solution: `**Causes and solutions:**

1. **Wrong path in policy:** KV v2 uses \`secret/data/...\` in the policy, not \`secret/...\`. Fix the path.

2. **Wrong ServiceAccount or namespace in role:** Check bound_service_account_names and bound_service_account_namespaces.

3. **Policy not associated with role:** Verify the role has the correct policy with \`vault read auth/kubernetes/role/<role>\`.

4. **Expired token:** Kubernetes 1.24+ uses bound tokens with expiration. Check ttl in the role.`
    },
    {
      title: 'Vault sealed after Pod restart',
      difficulty: 'hard',
      symptom: 'After cluster or Vault Pod restart, the server stays sealed and all applications lose access to secrets.',
      diagnosis: `\`\`\`bash
# Check Vault status
kubectl exec -n vault vault-0 -- vault status

# Check if auto-unseal is configured
kubectl get statefulset vault -n vault -o yaml | grep -A10 "VAULT_SEAL"

# Check Vault logs
kubectl logs -n vault vault-0 | grep -i "seal\\|unseal\\|barrier"

# Check PersistentVolume
kubectl get pvc -n vault
\`\`\``,
      solution: `**Actions to resolve:**

1. **Manual unseal (temporary):**
\`\`\`bash
# Use unseal keys saved during initialization
kubectl exec -n vault vault-0 -- vault operator unseal <key1>
kubectl exec -n vault vault-0 -- vault operator unseal <key2>
kubectl exec -n vault vault-0 -- vault operator unseal <key3>
\`\`\`

2. **Configure auto-unseal (recommended for production):**
Use cloud provider KMS for auto-unseal:
- AWS KMS: seal "awskms" { kms_key_id = "..." }
- GCP: seal "gcpckms" { ... }
- Azure: seal "azurekeyvault" { ... }

3. **Use dev mode only for testing:** Dev mode does not persist data and auto-unseals. Never use in production.

4. **HA with Raft:** In production, use Raft storage with 3+ replicas for high availability.`
    }
  ]
};
