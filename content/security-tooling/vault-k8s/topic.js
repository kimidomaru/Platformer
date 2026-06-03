window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['security-tooling/vault-k8s'] = {
  theory: `
# HashiCorp Vault & Kubernetes

## Relevancia
O HashiCorp Vault e a solucao mais adotada para gerenciamento centralizado de secrets em ambientes Kubernetes. Ele fornece secrets dinamicos, rotacao automatica, PKI, encriptacao como servico e auditoria completa. A integracao com Kubernetes via Agent Injector ou CSI Driver permite que aplicacoes consumam secrets de forma transparente.

## Conceitos Fundamentais

### Arquitetura Vault + Kubernetes

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

O Vault autentica workloads Kubernetes usando ServiceAccount tokens:

\`\`\`bash
# Habilitar auth method kubernetes no Vault
vault auth enable kubernetes

# Configurar endpoint do cluster
vault write auth/kubernetes/config \\
  kubernetes_host="https://kubernetes.default.svc:443" \\
  token_reviewer_jwt=\$(cat /var/run/secrets/kubernetes.io/serviceaccount/token) \\
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

# Criar role para aplicacao
vault write auth/kubernetes/role/myapp \\
  bound_service_account_names=myapp-sa \\
  bound_service_account_namespaces=production \\
  policies=myapp-policy \\
  ttl=1h
\`\`\`

### Secrets Engine — KV (Key-Value)

\`\`\`bash
# Habilitar KV v2
vault secrets enable -path=secret kv-v2

# Criar secret
vault kv put secret/myapp/config \\
  db_host=postgres.production.svc \\
  db_user=myapp \\
  db_pass=s3cur3P@ss

# Ler secret
vault kv get secret/myapp/config

# Politica de acesso
vault policy write myapp-policy - <<EOF
path "secret/data/myapp/*" {
  capabilities = ["read"]
}
EOF
\`\`\`

### Agent Injector (Sidecar)

O Vault Agent Injector injeta secrets via annotations no Pod:

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

Os secrets ficam em \`/vault/secrets/<nome>\` dentro do container.

### Vault CSI Provider

Alternativa ao Agent Injector usando volumes CSI:

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
---
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  serviceAccountName: myapp-sa
  containers:
    - name: myapp
      image: myapp:v1
      volumeMounts:
        - name: secrets
          mountPath: "/mnt/secrets"
          readOnly: true
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: myapp-db-creds
              key: password
  volumes:
    - name: secrets
      csi:
        driver: secrets-store.csi.k8s.io
        readOnly: true
        volumeAttributes:
          secretProviderClass: "vault-myapp"
\`\`\`

### Dynamic Secrets

O Vault pode gerar credenciais efemeras para bancos de dados:

\`\`\`bash
# Habilitar secrets engine de database
vault secrets enable database

# Configurar conexao PostgreSQL
vault write database/config/mydb \\
  plugin_name=postgresql-database-plugin \\
  connection_url="postgresql://{{username}}:{{password}}@postgres:5432/mydb?sslmode=disable" \\
  allowed_roles="myapp-role" \\
  username="vault_admin" \\
  password="admin_pass"

# Criar role com credenciais dinamicas
vault write database/roles/myapp-role \\
  db_name=mydb \\
  creation_statements="CREATE ROLE \\"{{name}}\\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \\"{{name}}\\";" \\
  default_ttl="1h" \\
  max_ttl="24h"

# Gerar credenciais dinamicas
vault read database/creds/myapp-role
\`\`\`

### PKI — Certificados Internos

\`\`\`bash
# Habilitar PKI
vault secrets enable pki
vault secrets tune -max-lease-ttl=87600h pki

# Gerar Root CA
vault write -field=certificate pki/root/generate/internal \\
  common_name="example.com" \\
  ttl=87600h > CA_cert.crt

# Configurar role para emissao
vault write pki/roles/internal-certs \\
  allowed_domains="svc.cluster.local" \\
  allow_subdomains=true \\
  max_ttl="72h"

# Emitir certificado
vault write pki/issue/internal-certs \\
  common_name="myapp.production.svc.cluster.local" \\
  ttl="24h"
\`\`\`

### Erros Comuns

1. **ServiceAccount token expirado** — Kubernetes 1.24+ usa tokens bound; configure tokenReviewer no Vault
2. **Permission denied** — verificar policy path (KV v2 usa \`secret/data/...\` nao \`secret/...\`)
3. **Agent Injector nao injecta** — verificar webhook, annotations e ServiceAccount
4. **Vault sealed** — o Vault precisa ser unsealed apos restart; use auto-unseal em producao

## Killer.sh Style Challenge

> **Cenario:** Configure Vault no Kubernetes com: (1) auth method kubernetes, (2) KV secret engine com credenciais de banco, (3) Agent Injector para injetar secrets em um Deployment, (4) policy que permite apenas leitura no path da aplicacao.
`,
  quiz: [
    {
      question: 'Quais sao as duas formas principais de integrar Vault com workloads Kubernetes?',
      options: [
        'ConfigMap e Secret',
        'Agent Injector (sidecar) e CSI Provider (volume)',
        'Init Container e CronJob',
        'Webhook e DaemonSet'
      ],
      correct: 1,
      explanation: 'O Agent Injector usa um sidecar mutating webhook para injetar secrets como arquivos no Pod. O CSI Provider monta secrets como volumes usando o Secrets Store CSI Driver.',
      reference: 'Conceito relacionado: Agent Injector usa annotations vault.hashicorp.com/* no Pod template.'
    },
    {
      question: 'Como o Vault autentica workloads Kubernetes?',
      options: [
        'Via username/password do container',
        'Via ServiceAccount JWT token do Pod, validado pelo Kubernetes API',
        'Via IP do Pod',
        'Via certificado TLS do node'
      ],
      correct: 1,
      explanation: 'O Kubernetes auth method usa o JWT token do ServiceAccount do Pod para autenticar com o Vault. O Vault valida o token contra a API do Kubernetes.',
      reference: 'Conceito relacionado: bound_service_account_names e bound_service_account_namespaces na role.'
    },
    {
      question: 'Qual o path correto para ler secrets no KV v2?',
      options: [
        'secret/myapp/config',
        'secret/data/myapp/config',
        'kv/myapp/config',
        'vault/secret/myapp/config'
      ],
      correct: 1,
      explanation: 'No KV v2, o path real inclui /data/ entre o mount point e o path do secret. Portanto, secret/data/myapp/config e o path correto para acesso via API e policies.',
      reference: 'Conceito relacionado: Metadata fica em secret/metadata/myapp/config.'
    },
    {
      question: 'O que sao dynamic secrets no Vault?',
      options: [
        'Secrets que mudam de nome automaticamente',
        'Credenciais efemeras geradas sob demanda com TTL e rotacao automatica',
        'Secrets armazenados em volumes dinamicos',
        'Secrets que sao criptografados dinamicamente'
      ],
      correct: 1,
      explanation: 'Dynamic secrets sao credenciais geradas sob demanda pelo Vault (ex: usuario/senha temporarios de banco de dados) com TTL definido e revogacao automatica apos expiracao.',
      reference: 'Conceito relacionado: database secrets engine gera credenciais PostgreSQL, MySQL, MongoDB etc.'
    },
    {
      question: 'Onde ficam os secrets injetados pelo Vault Agent Injector dentro do Pod?',
      options: [
        '/etc/vault/secrets',
        '/vault/secrets/<nome-do-secret>',
        '/var/run/vault',
        '/tmp/vault'
      ],
      correct: 1,
      explanation: 'O Agent Injector monta os secrets renderizados em /vault/secrets/ por padrao. O nome do arquivo corresponde ao nome definido na annotation agent-inject-secret-<nome>.',
      reference: 'Conceito relacionado: Use agent-inject-template para customizar o formato do arquivo.'
    },
    {
      question: 'Por que o Vault precisa de "unseal" apos restart?',
      options: [
        'Para atualizar certificados',
        'Para descriptografar a master key que protege os dados armazenados',
        'Para conectar ao Kubernetes',
        'Para sincronizar com outros nodes Vault'
      ],
      correct: 1,
      explanation: 'O Vault criptografa todos os dados em repouso. Ao iniciar, ele esta "sealed" e precisa de unseal keys (Shamir shares) para reconstruir a master key e descriptografar os dados.',
      reference: 'Conceito relacionado: Auto-unseal com KMS (AWS, GCP, Azure) elimina a necessidade de unseal manual.'
    },
    {
      question: 'Qual a vantagem do Vault CSI Provider sobre o Agent Injector?',
      options: [
        'Suporta mais tipos de secrets',
        'Nao requer sidecar, reduzindo consumo de recursos e complexidade',
        'E mais seguro',
        'Suporta mais clouds'
      ],
      correct: 1,
      explanation: 'O CSI Provider nao adiciona um sidecar container ao Pod, reduzindo overhead de recursos. Ele monta secrets como volumes CSI e pode sincronizar com Kubernetes Secrets para uso como env vars.',
      reference: 'Conceito relacionado: SecretProviderClass com secretObjects cria K8s Secrets automaticamente.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os Secrets Engines mais usados do Vault?',
      back: '| Engine | Funcao |\n|--------|--------|\n| **KV (v2)** | Key-value com versionamento |\n| **Database** | Credenciais dinamicas (PostgreSQL, MySQL, MongoDB) |\n| **PKI** | Certificados X.509 internos |\n| **AWS/GCP/Azure** | Credenciais cloud dinamicas |\n| **Transit** | Encriptacao como servico |\n| **SSH** | Credenciais SSH dinamicas |\n\nCada engine e montada em um path: vault secrets enable -path=<path> <engine>'
    },
    {
      front: 'Como funciona o Kubernetes Auth Method do Vault?',
      back: '1. Pod faz request ao Vault com JWT do ServiceAccount\n2. Vault envia JWT ao Kubernetes TokenReview API\n3. Kubernetes valida o token e retorna identidade\n4. Vault verifica se SA e namespace estao na role\n5. Vault emite token de acesso com policies\n\n**Configuracao:**\n- vault auth enable kubernetes\n- vault write auth/kubernetes/config ...\n- vault write auth/kubernetes/role/<role> ...\n\n**Campos da role:** bound_service_account_names, bound_service_account_namespaces, policies, ttl'
    },
    {
      front: 'Agent Injector vs CSI Provider — quando usar cada um?',
      back: '**Agent Injector (Sidecar):**\n- Renderiza templates customizados\n- Rotacao automatica de secrets\n- Maior consumo de recursos (sidecar)\n- Funciona com qualquer volume\n\n**CSI Provider (Volume):**\n- Sem sidecar, menos overhead\n- Pode criar K8s Secrets (env vars)\n- Nao requer mutating webhook\n- Rotacao depende de volumes CSI\n\n**Recomendacao:**\n- Agent Injector para templates complexos e rotacao\n- CSI Provider para simplicidade e menor footprint'
    },
    {
      front: 'O que sao Dynamic Secrets e por que sao mais seguros?',
      back: '**Dynamic Secrets** = credenciais geradas sob demanda\n\n**Fluxo:**\n1. App solicita credencial ao Vault\n2. Vault gera user/pass temporario no banco\n3. Credencial tem TTL (ex: 1h)\n4. Vault revoga automaticamente apos expiracao\n\n**Por que sao mais seguros:**\n- Credenciais unicas por consumidor\n- TTL curto limita exposicao\n- Revogacao automatica\n- Auditoria de quem acessou\n- Sem secrets hardcoded ou compartilhados'
    },
    {
      front: 'Quais annotations controlam o Vault Agent Injector?',
      back: '| Annotation | Funcao |\n|------------|--------|\n| vault.hashicorp.com/agent-inject: "true" | Habilita injection |\n| vault.hashicorp.com/role | Role Vault para auth |\n| vault.hashicorp.com/agent-inject-secret-<nome> | Path do secret |\n| vault.hashicorp.com/agent-inject-template-<nome> | Template Go |\n| vault.hashicorp.com/agent-pre-populate-only | Apenas init (sem sidecar) |\n| vault.hashicorp.com/agent-inject-status | "injected" para skip |\n\nSecrets ficam em /vault/secrets/<nome>'
    },
    {
      front: 'Como funciona o Vault PKI para certificados internos?',
      back: '1. **Habilitar PKI engine:**\nvault secrets enable pki\n\n2. **Gerar Root CA:**\nvault write pki/root/generate/internal common_name="example.com"\n\n3. **Criar role de emissao:**\nvault write pki/roles/my-role allowed_domains="svc.cluster.local" allow_subdomains=true\n\n4. **Emitir certificado:**\nvault write pki/issue/my-role common_name="app.ns.svc.cluster.local"\n\n**Integracao:** Pode ser usado com cert-manager via Vault Issuer.'
    },
    {
      front: 'O que e Auto-Unseal e por que usar em producao?',
      back: '**Problema:** Vault sealed apos restart requer unseal keys manuais (Shamir shares).\n\n**Auto-Unseal:** Usa KMS externo para unseal automatico:\n- AWS KMS\n- GCP Cloud KMS\n- Azure Key Vault\n- HSM (Hardware Security Module)\n\n**Vantagem:**\n- Sem intervencao manual em restarts\n- Sem necessidade de distribuir unseal keys\n- Audit trail no KMS\n\n**Configuracao:**\nseal "awskms" { kms_key_id = "..." }'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar o HashiCorp Vault no Kubernetes para fornecer secrets de banco de dados a uma aplicacao via Agent Injector.',
    objective: 'Instalar Vault via Helm, configurar auth Kubernetes, criar secrets e injetar em um Deployment.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Instalar Vault no Kubernetes',
        instruction: `Instale o HashiCorp Vault usando Helm e inicialize o servidor.

\`\`\`bash
# Adicionar repo Helm do Vault
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update

# Instalar Vault em modo dev (para lab)
helm install vault hashicorp/vault \\
  --namespace vault --create-namespace \\
  --set "server.dev.enabled=true" \\
  --set "injector.enabled=true"

# Aguardar Pods ficarem prontos
kubectl rollout status statefulset vault -n vault

# Verificar status
kubectl exec -n vault vault-0 -- vault status
\`\`\``,
        hints: [
          'Modo dev auto-unseal e inicializa com root token "root"',
          'Em producao, use raft storage e auto-unseal com KMS',
          'O injector e um mutating webhook que monitora annotations vault.*'
        ],
        solution: `\`\`\`bash
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update
helm install vault hashicorp/vault --namespace vault --create-namespace --set "server.dev.enabled=true" --set "injector.enabled=true"
kubectl rollout status statefulset vault -n vault
\`\`\``,
        verify: `\`\`\`bash
# Verificar Vault Pod rodando
kubectl get pods -n vault
# Saida esperada: vault-0 Running, vault-agent-injector-* Running

# Verificar status (deve estar unsealed em modo dev)
kubectl exec -n vault vault-0 -- vault status | grep Sealed
# Saida esperada: Sealed          false

# Verificar injector webhook
kubectl get mutatingwebhookconfigurations | grep vault
# Saida esperada: vault-agent-injector-cfg
\`\`\``
      },
      {
        title: 'Configurar Auth e Secrets',
        instruction: `Configure o auth method Kubernetes e crie secrets no KV engine.

\`\`\`bash
# Entrar no Pod do Vault
kubectl exec -it -n vault vault-0 -- /bin/sh

# Dentro do Pod Vault:
# Habilitar auth Kubernetes
vault auth enable kubernetes

# Configurar endpoint do Kubernetes
vault write auth/kubernetes/config \\
  kubernetes_host="https://kubernetes.default.svc:443"

# Criar secret no KV v2
vault kv put secret/myapp/config \\
  db_host="postgres.production.svc.cluster.local" \\
  db_user="myapp" \\
  db_pass="SuperSecr3t!" \\
  db_name="appdb"

# Criar policy de leitura
vault policy write myapp-policy - <<EOF
path "secret/data/myapp/*" {
  capabilities = ["read"]
}
EOF

# Criar role vinculada ao ServiceAccount
vault write auth/kubernetes/role/myapp \\
  bound_service_account_names=myapp-sa \\
  bound_service_account_namespaces=default \\
  policies=myapp-policy \\
  ttl=1h

# Sair do Pod
exit
\`\`\``,
        hints: [
          'Em modo dev o root token e "root"',
          'KV v2 armazena em secret/data/... mas o CLI usa secret/...',
          'A role vincula ServiceAccount + namespace a uma policy Vault'
        ],
        solution: `\`\`\`bash
kubectl exec -n vault vault-0 -- vault auth enable kubernetes
kubectl exec -n vault vault-0 -- vault write auth/kubernetes/config kubernetes_host="https://kubernetes.default.svc:443"
kubectl exec -n vault vault-0 -- vault kv put secret/myapp/config db_host="postgres" db_user="myapp" db_pass="SuperSecr3t!"
kubectl exec -n vault vault-0 -- vault policy write myapp-policy - <<< 'path "secret/data/myapp/*" { capabilities = ["read"] }'
kubectl exec -n vault vault-0 -- vault write auth/kubernetes/role/myapp bound_service_account_names=myapp-sa bound_service_account_namespaces=default policies=myapp-policy ttl=1h
\`\`\``,
        verify: `\`\`\`bash
# Verificar auth method
kubectl exec -n vault vault-0 -- vault auth list | grep kubernetes
# Saida esperada: kubernetes/   kubernetes   ...

# Verificar secret
kubectl exec -n vault vault-0 -- vault kv get secret/myapp/config
# Saida esperada: db_host, db_user, db_pass com valores

# Verificar policy
kubectl exec -n vault vault-0 -- vault policy read myapp-policy
# Saida esperada: path "secret/data/myapp/*" { capabilities = ["read"] }

# Verificar role
kubectl exec -n vault vault-0 -- vault read auth/kubernetes/role/myapp
# Saida esperada: bound_service_account_names=[myapp-sa]
\`\`\``
      },
      {
        title: 'Injetar Secrets via Agent Injector',
        instruction: `Crie um Deployment que recebe secrets do Vault automaticamente via annotations.

\`\`\`bash
# Criar ServiceAccount
kubectl create serviceaccount myapp-sa

# Criar Deployment com annotations do Vault Agent Injector
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
          'O Agent Injector adiciona um init-container e um sidecar automaticamente',
          'Os secrets ficam em /vault/secrets/<nome-na-annotation>',
          'Use agent-inject-template para customizar o formato do arquivo'
        ],
        solution: `\`\`\`bash
kubectl create serviceaccount myapp-sa
kubectl apply -f myapp-deployment.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar Pod com sidecar injetado
kubectl get pods -l app=myapp -o jsonpath='{range .items[*]}{.metadata.name}{" containers="}{range .spec.containers[*]}{.name}{","}{end}{"\\n"}{end}'
# Saida esperada: myapp-xxx containers=myapp,vault-agent,

# Verificar secrets injetados
kubectl exec deploy/myapp -c myapp -- cat /vault/secrets/db-config
# Saida esperada:
# DB_HOST=postgres.production.svc.cluster.local
# DB_USER=myapp
# DB_PASS=SuperSecr3t!
# DB_NAME=appdb

# Verificar logs do vault-agent
kubectl logs deploy/myapp -c vault-agent | tail -5
# Saida esperada: logs de autenticacao e rendering de templates
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Agent Injector nao injeta secrets no Pod',
      difficulty: 'medium',
      symptom: 'O Pod tem annotations vault.hashicorp.com/* mas nenhum sidecar vault-agent e adicionado e /vault/secrets nao existe.',
      diagnosis: `\`\`\`bash
# Verificar se o injector webhook esta registrado
kubectl get mutatingwebhookconfigurations | grep vault

# Verificar logs do injector
kubectl logs -n vault deploy/vault-agent-injector --tail=20

# Verificar annotations do Pod
kubectl get pod <pod> -o jsonpath='{.metadata.annotations}' | python3 -m json.tool

# Verificar se o namespace tem label conflitante
kubectl get namespace <ns> --show-labels
\`\`\``,
      solution: `**Causas comuns:**

1. **Webhook nao registrado:** O vault-agent-injector Pod precisa estar rodando e o webhook registrado. Reinstale o Helm chart.

2. **Annotation no Pod, nao no template:** As annotations devem estar em spec.template.metadata.annotations do Deployment, nao no metadata do Deployment.

3. **Namespace excluido:** Verifique se o namespace nao tem label que exclui o webhook.

4. **ServiceAccount inexistente:** O serviceAccountName no Pod deve corresponder ao definido na role do Vault.`
    },
    {
      title: 'Permission denied ao acessar secrets',
      difficulty: 'medium',
      symptom: 'O vault-agent inicia mas falha com "permission denied" ao tentar ler secrets. Logs mostram erro 403.',
      diagnosis: `\`\`\`bash
# Verificar logs do vault-agent
kubectl logs <pod> -c vault-agent-init

# Verificar policy no Vault
kubectl exec -n vault vault-0 -- vault policy read <policy-name>

# Verificar role
kubectl exec -n vault vault-0 -- vault read auth/kubernetes/role/<role>

# Testar login manualmente
SA_TOKEN=\$(kubectl create token <sa-name>)
kubectl exec -n vault vault-0 -- vault write auth/kubernetes/login role=<role> jwt=\$SA_TOKEN
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Path errado na policy:** KV v2 usa \`secret/data/...\` na policy, nao \`secret/...\`. Corrija o path.

2. **ServiceAccount ou namespace errado na role:** Verifique bound_service_account_names e bound_service_account_namespaces.

3. **Policy nao associada a role:** Verifique que a role tem a policy correta com \`vault read auth/kubernetes/role/<role>\`.

4. **Token expirado:** Kubernetes 1.24+ usa bound tokens com expiracao. Verifique ttl na role.`
    },
    {
      title: 'Vault sealed apos restart do Pod',
      difficulty: 'hard',
      symptom: 'Apos restart do cluster ou do Pod do Vault, o servidor fica sealed e todas as aplicacoes perdem acesso aos secrets.',
      diagnosis: `\`\`\`bash
# Verificar status do Vault
kubectl exec -n vault vault-0 -- vault status

# Verificar se auto-unseal esta configurado
kubectl get statefulset vault -n vault -o yaml | grep -A10 "VAULT_SEAL"

# Verificar logs do Vault
kubectl logs -n vault vault-0 | grep -i "seal\\|unseal\\|barrier"

# Verificar PersistentVolume
kubectl get pvc -n vault
\`\`\``,
      solution: `**Acoes para resolver:**

1. **Unseal manual (temporario):**
\`\`\`bash
# Usar unseal keys salvas na inicializacao
kubectl exec -n vault vault-0 -- vault operator unseal <key1>
kubectl exec -n vault vault-0 -- vault operator unseal <key2>
kubectl exec -n vault vault-0 -- vault operator unseal <key3>
\`\`\`

2. **Configurar auto-unseal (recomendado para producao):**
Use KMS do cloud provider para auto-unseal:
- AWS KMS: seal "awskms" { kms_key_id = "..." }
- GCP: seal "gcpckms" { ... }
- Azure: seal "azurekeyvault" { ... }

3. **Usar modo dev apenas para testes:** O modo dev nao persiste dados e auto-unseal. Nunca use em producao.

4. **HA com Raft:** Em producao, use armazenamento Raft com 3+ replicas para alta disponibilidade.`
    }
  ]
};
