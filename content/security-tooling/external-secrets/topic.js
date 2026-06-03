window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['security-tooling/external-secrets'] = {
  theory: `
# External Secrets Operator (ESO)

## Relevancia
O External Secrets Operator (ESO) sincroniza secrets de provedores externos para Kubernetes Secrets nativos. Ele suporta AWS Secrets Manager, HashiCorp Vault, Azure Key Vault, GCP Secret Manager e outros. A principal vantagem e desacoplar o armazenamento de secrets do cluster, mantendo compliance e auditoria centralizada.

## Conceitos Fundamentais

### Arquitetura do ESO

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
   │     Kubernetes Secret (nativo)           │
   │     (criado/atualizado pelo ESO)         │
   └──────────────────────────────────────────┘
\`\`\`

### CRDs Principais

| CRD | Escopo | Funcao |
|-----|--------|--------|
| SecretStore | Namespace | Conexao ao provider naquele namespace |
| ClusterSecretStore | Cluster | Conexao compartilhada cluster-wide |
| ExternalSecret | Namespace | Define quais secrets sincronizar |
| ClusterExternalSecret | Cluster | Sincroniza em multiplos namespaces |
| PushSecret | Namespace | Envia secrets DO cluster PARA o provider |

### Instalacao

\`\`\`bash
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

helm install external-secrets external-secrets/external-secrets \\
  --namespace external-secrets --create-namespace

kubectl rollout status deployment external-secrets -n external-secrets
\`\`\`

### SecretStore com AWS Secrets Manager

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

### SecretStore com HashiCorp Vault

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

### ClusterSecretStore (Compartilhado)

\`\`\`yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-global
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets
            namespace: external-secrets
\`\`\`

### ExternalSecret — Sincronizar Secrets

\`\`\`yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-secrets
  namespace: production
spec:
  refreshInterval: 1h                    # frequencia de sync
  secretStoreRef:
    name: aws-secretsmanager
    kind: SecretStore
  target:
    name: myapp-k8s-secret               # nome do K8s Secret criado
    creationPolicy: Owner                 # ESO gerencia o lifecycle
    deletionPolicy: Retain                # manter Secret se ExternalSecret for deletado
  data:
    - secretKey: db-password              # key no K8s Secret
      remoteRef:
        key: production/myapp/database    # path no provider
        property: password                # campo especifico do JSON
    - secretKey: api-key
      remoteRef:
        key: production/myapp/api
        property: key
\`\`\`

### ExternalSecret com Template

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

### PushSecret — Enviar do Cluster para o Provider

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

### Provedores Suportados

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

### Erros Comuns

1. **refreshInterval muito curto** — pode causar rate limiting no provider; use 1h+ em producao
2. **Credenciais expiradas no SecretStore** — verificar se o auth do provider esta ativo
3. **Property errado** — se o secret no provider e JSON, property deve ser o campo exato
4. **ClusterSecretStore vs SecretStore** — ClusterSecretStore precisa de conditions para restringir acesso

## Killer.sh Style Challenge

> **Cenario:** Configure o ESO para sincronizar secrets do AWS Secrets Manager: (1) crie SecretStore com credenciais, (2) crie ExternalSecret que sincroniza db credentials e api key, (3) verifique que o Kubernetes Secret foi criado com os valores corretos.
`,
  quiz: [
    {
      question: 'Qual a diferenca entre SecretStore e ClusterSecretStore?',
      options: [
        'SecretStore suporta mais providers',
        'SecretStore e limitado a um namespace, ClusterSecretStore e compartilhado cluster-wide',
        'ClusterSecretStore e mais seguro',
        'Nao ha diferenca funcional'
      ],
      correct: 1,
      explanation: 'SecretStore configura a conexao ao provider para um namespace especifico. ClusterSecretStore e cluster-scoped e pode ser usado por ExternalSecrets em qualquer namespace.',
      reference: 'Conceito relacionado: Use conditions no ClusterSecretStore para restringir quais namespaces podem usa-lo.'
    },
    {
      question: 'O que o ExternalSecret cria no Kubernetes?',
      options: [
        'Um ConfigMap',
        'Um Secret nativo do Kubernetes sincronizado com o provider externo',
        'Um Volume persistente',
        'Uma ServiceAccount'
      ],
      correct: 1,
      explanation: 'O ExternalSecret faz o ESO criar e manter atualizado um Kubernetes Secret nativo, sincronizando periodicamente os valores do provider externo (AWS SM, Vault, etc.).',
      reference: 'Conceito relacionado: target.name define o nome do K8s Secret, refreshInterval define a frequencia de sync.'
    },
    {
      question: 'Para que serve o PushSecret?',
      options: [
        'Para forcar a sincronizacao de secrets',
        'Para enviar secrets DO Kubernetes PARA o provider externo',
        'Para notificar sobre mudancas em secrets',
        'Para criar secrets no provider'
      ],
      correct: 1,
      explanation: 'O PushSecret faz o oposto do ExternalSecret: ele envia secrets do cluster Kubernetes para o provider externo (Vault, AWS SM, etc.). Util para migracoes ou backup.',
      reference: 'Conceito relacionado: PushSecret e v1alpha1, ainda em desenvolvimento ativo.'
    },
    {
      question: 'Qual campo define a frequencia de sincronizacao no ExternalSecret?',
      options: [
        'syncInterval',
        'refreshInterval',
        'pollInterval',
        'updateFrequency'
      ],
      correct: 1,
      explanation: 'refreshInterval define com que frequencia o ESO verifica o provider externo por mudancas e atualiza o Kubernetes Secret. Exemplo: "1h" verifica a cada hora.',
      reference: 'Conceito relacionado: Em producao, use 1h+ para evitar rate limiting. Para dev, 5m e aceitavel.'
    },
    {
      question: 'Como o ESO autentica com o HashiCorp Vault?',
      options: [
        'Apenas via token estatico',
        'Via Kubernetes auth (ServiceAccount), token, ou AppRole',
        'Via username/password',
        'Via certificado TLS apenas'
      ],
      correct: 1,
      explanation: 'O ESO suporta multiplos auth methods do Vault: Kubernetes (usando ServiceAccount do cluster), token estatico, e AppRole. O Kubernetes auth e o mais recomendado em clusters.',
      reference: 'Conceito relacionado: auth.kubernetes.role define a role do Vault para autenticacao.'
    },
    {
      question: 'Qual creationPolicy indica que o ESO gerencia completamente o lifecycle do Secret?',
      options: [
        'Merge',
        'Owner',
        'None',
        'Managed'
      ],
      correct: 1,
      explanation: 'creationPolicy: Owner significa que o ESO e o dono do Secret e gerencia seu lifecycle completo. Se o ExternalSecret for deletado, o Secret tambem sera (a menos que deletionPolicy: Retain).',
      reference: 'Conceito relacionado: creationPolicy: Merge preserva keys existentes no Secret, Owner substitui tudo.'
    },
    {
      question: 'Como referenciar um campo especifico dentro de um JSON secret no provider?',
      options: [
        'Usando data.field',
        'Usando remoteRef.property com o nome do campo',
        'Usando jsonPath',
        'Nao e possivel, precisa do JSON completo'
      ],
      correct: 1,
      explanation: 'O campo remoteRef.property permite extrair um campo especifico de um secret JSON no provider. Por exemplo, se o secret e {"user":"admin","pass":"123"}, property: "pass" extrai apenas "123".',
      reference: 'Conceito relacionado: Sem property, o valor inteiro (JSON completo) e sincronizado.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os CRDs do External Secrets Operator?',
      back: '| CRD | Funcao |\n|-----|--------|\n| **SecretStore** | Conexao ao provider (namespace) |\n| **ClusterSecretStore** | Conexao compartilhada (cluster) |\n| **ExternalSecret** | Sync provider -> K8s Secret |\n| **ClusterExternalSecret** | Sync em multiplos namespaces |\n| **PushSecret** | Sync K8s Secret -> provider |\n\n**Fluxo:** SecretStore + ExternalSecret = K8s Secret\n**Direcionamento:** ExternalSecret (pull), PushSecret (push)'
    },
    {
      front: 'Quais providers o ESO suporta?',
      back: '| Provider | Auth Methods |\n|----------|-------------|\n| **AWS Secrets Manager** | IAM, IRSA, Access Keys |\n| **AWS Parameter Store** | IAM, IRSA, Access Keys |\n| **HashiCorp Vault** | Token, K8s, AppRole |\n| **Azure Key Vault** | MI, SP, Workload Identity |\n| **GCP Secret Manager** | SA, Workload Identity |\n| **1Password** | Connect Token |\n| **Kubernetes** | ServiceAccount |\n| **Oracle Vault** | Auth token |\n\nTodos configurados via SecretStore/ClusterSecretStore.'
    },
    {
      front: 'Como funciona o refreshInterval?',
      back: '**refreshInterval** define a frequencia de sincronizacao.\n\n**Funcionamento:**\n1. ESO verifica o provider a cada intervalo\n2. Se o valor mudou, atualiza o K8s Secret\n3. Se nao mudou, nenhuma acao\n\n**Recomendacoes:**\n- Dev/staging: 5m-15m\n- Producao: 1h+ (evitar rate limiting)\n- Secrets criticos: 15m-30m\n\n**Cuidados:**\n- Rate limits do provider (AWS: 10k/s, Vault: depende)\n- Cada ExternalSecret faz uma chamada por intervalo\n- Muitos ExternalSecrets + intervalo curto = muitas chamadas'
    },
    {
      front: 'Qual a diferenca entre creationPolicy Owner e Merge?',
      back: '**Owner:**\n- ESO e dono exclusivo do Secret\n- Deleta o Secret se ExternalSecret for removido\n- Substitui todas as keys no Secret\n- Uso: quando ESO gerencia 100% do Secret\n\n**Merge:**\n- ESO adiciona/atualiza keys no Secret existente\n- NAO deleta keys que nao gerencia\n- Preserva keys adicionadas manualmente\n- Uso: quando o Secret tem keys de multiplas fontes\n\n**None:**\n- ESO nao cria o Secret (deve existir)\n- Apenas atualiza keys existentes'
    },
    {
      front: 'Como usar templates no ExternalSecret?',
      back: '**Templates** permitem transformar secrets em formatos customizados:\n\n\`\`\`yaml\ntarget:\n  template:\n    type: Opaque\n    data:\n      config.yaml: |\n        db_host: {{ .host }}\n        db_pass: {{ .password }}\n\`\`\`\n\n**Funcoes disponiveis:**\n- {{ .key }} — valor do secret\n- {{ .key | b64enc }} — base64 encode\n- {{ .key | b64dec }} — base64 decode\n- {{ .key | upper }} — uppercase\n- {{ .key | lower }} — lowercase\n\nUtil para gerar config files, connection strings, etc.'
    },
    {
      front: 'ESO vs Vault Agent Injector vs CSI Driver — quando usar cada?',
      back: '**ESO (External Secrets Operator):**\n- Cria K8s Secrets nativos\n- Funciona com qualquer provider\n- Sem sidecar ou volume especial\n- Melhor para: equipes que querem K8s Secrets padrao\n\n**Vault Agent Injector:**\n- Sidecar no Pod\n- Apenas Vault\n- Templates Go avancados\n- Rotacao automatica\n- Melhor para: apps que leem arquivos\n\n**CSI Driver:**\n- Volume CSI\n- Vault, AWS, Azure, GCP\n- Sem sidecar\n- Melhor para: menor footprint'
    },
    {
      front: 'Como diagnosticar falha de sincronizacao no ESO?',
      back: '**Checklist de diagnostico:**\n\n1. **Status do ExternalSecret:**\nkubectl get externalsecret -o wide\n(verificar STATUS: SecretSynced ou erro)\n\n2. **Eventos:**\nkubectl describe externalsecret <name>\n\n3. **SecretStore status:**\nkubectl get secretstore -o wide\n(verificar STATUS: Valid)\n\n4. **Logs do operator:**\nkubectl logs -n external-secrets deploy/external-secrets\n\n5. **Credenciais:**\nVerificar se o auth no SecretStore ainda e valido\n\n**Erros comuns:** 403 (permissao), 404 (path errado), timeout (rede)'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar o External Secrets Operator para sincronizar secrets do HashiCorp Vault para Kubernetes Secrets nativos.',
    objective: 'Instalar o ESO, configurar SecretStore com Vault, criar ExternalSecret e verificar sincronizacao.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Instalar External Secrets Operator',
        instruction: `Instale o ESO via Helm e verifique os componentes.

\`\`\`bash
# Instalar ESO
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

helm install external-secrets external-secrets/external-secrets \\
  --namespace external-secrets --create-namespace

# Aguardar Pods
kubectl rollout status deployment external-secrets -n external-secrets
kubectl rollout status deployment external-secrets-webhook -n external-secrets
kubectl rollout status deployment external-secrets-cert-controller -n external-secrets
\`\`\``,
        hints: [
          'O ESO tem 3 componentes: controller, webhook e cert-controller',
          'O cert-controller gerencia certificados TLS para o webhook',
          'Verifique os CRDs com kubectl get crd | grep external-secrets'
        ],
        solution: `\`\`\`bash
helm repo add external-secrets https://charts.external-secrets.io
helm repo update
helm install external-secrets external-secrets/external-secrets --namespace external-secrets --create-namespace
\`\`\``,
        verify: `\`\`\`bash
# Verificar Pods
kubectl get pods -n external-secrets
# Saida esperada: external-secrets, external-secrets-webhook, external-secrets-cert-controller todos Running

# Verificar CRDs
kubectl get crd | grep external-secrets
# Saida esperada: externalsecrets, secretstores, clustersecretstores, etc.

# Verificar API resources
kubectl api-resources | grep external-secrets
# Saida esperada: externalsecrets, secretstores, clustersecretstores, pushsecrets
\`\`\``
      },
      {
        title: 'Configurar SecretStore com Vault',
        instruction: `Configure um SecretStore que conecta ao HashiCorp Vault (assumindo Vault ja instalado do lab anterior).

\`\`\`bash
# Criar ServiceAccount para o ESO
kubectl create serviceaccount eso-vault-sa

# Configurar role no Vault para o ESO
kubectl exec -n vault vault-0 -- vault write auth/kubernetes/role/eso-role \\
  bound_service_account_names=eso-vault-sa \\
  bound_service_account_namespaces=default \\
  policies=myapp-policy \\
  ttl=1h

# Criar SecretStore
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
          'O SecretStore precisa de credenciais validas para conectar ao provider',
          'Para Vault, kubernetes auth e o metodo mais seguro em cluster',
          'A role do Vault deve permitir leitura nos paths que o ExternalSecret vai acessar'
        ],
        solution: `\`\`\`bash
kubectl create serviceaccount eso-vault-sa
kubectl exec -n vault vault-0 -- vault write auth/kubernetes/role/eso-role bound_service_account_names=eso-vault-sa bound_service_account_namespaces=default policies=myapp-policy ttl=1h
kubectl apply -f vault-secretstore.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar SecretStore
kubectl get secretstore vault-store
# Saida esperada: vault-store   Valid   Xs

# Verificar detalhes
kubectl describe secretstore vault-store | grep -A5 "Status"
# Saida esperada: Type: Ready, Status: True
\`\`\``
      },
      {
        title: 'Criar ExternalSecret e Verificar Sync',
        instruction: `Crie um ExternalSecret que sincroniza secrets do Vault e verifique o Kubernetes Secret criado.

\`\`\`bash
# Garantir que secrets existem no Vault
kubectl exec -n vault vault-0 -- vault kv put secret/myapp/config \\
  db_host="postgres.production.svc" \\
  db_user="myapp" \\
  db_pass="SuperSecr3t!" \\
  api_key="ak-1234567890"

# Criar ExternalSecret
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
          'O remoteRef.key deve incluir secret/data/ para Vault KV v2',
          'property extrai um campo especifico do JSON armazenado no Vault',
          'O Kubernetes Secret sera criado automaticamente pelo ESO'
        ],
        solution: `\`\`\`bash
kubectl exec -n vault vault-0 -- vault kv put secret/myapp/config db_host="postgres" db_user="myapp" db_pass="SuperSecr3t!" api_key="ak-1234567890"
kubectl apply -f myapp-external-secret.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar ExternalSecret
kubectl get externalsecret myapp-external
# Saida esperada: myapp-external   vault-store   SecretSynced   True   Xs

# Verificar Kubernetes Secret criado
kubectl get secret myapp-synced-secret
# Saida esperada: myapp-synced-secret   Opaque   4   Xs

# Verificar valores sincronizados
kubectl get secret myapp-synced-secret -o jsonpath='{.data.DB_HOST}' | base64 -d
# Saida esperada: postgres.production.svc

kubectl get secret myapp-synced-secret -o jsonpath='{.data.DB_PASS}' | base64 -d
# Saida esperada: SuperSecr3t!

# Verificar que todos os 4 campos estao presentes
kubectl get secret myapp-synced-secret -o jsonpath='{.data}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d.keys()))"
# Saida esperada: ['API_KEY', 'DB_HOST', 'DB_PASS', 'DB_USER']
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ExternalSecret nao sincroniza — status SecretSyncedError',
      difficulty: 'easy',
      symptom: 'O ExternalSecret mostra status SecretSyncedError e o Kubernetes Secret nao e criado.',
      diagnosis: `\`\`\`bash
# Verificar status do ExternalSecret
kubectl get externalsecret <name> -o wide

# Verificar eventos detalhados
kubectl describe externalsecret <name>

# Verificar status do SecretStore
kubectl get secretstore <name> -o wide
kubectl describe secretstore <name>

# Verificar logs do ESO
kubectl logs -n external-secrets deploy/external-secrets --tail=30
\`\`\``,
      solution: `**Causas comuns:**

1. **SecretStore invalido:** Verifique que o SecretStore esta com Status Valid. Se nao, as credenciais podem estar erradas.

2. **Path errado no remoteRef:** Para Vault KV v2, o path deve ser \`secret/data/myapp/config\`, nao \`secret/myapp/config\`.

3. **Property inexistente:** Se o secret no provider e JSON e o property nao existe naquele JSON, a sincronizacao falha.

4. **Permissao insuficiente:** A policy do provider deve permitir leitura no path especificado.`
    },
    {
      title: 'SecretStore mostra status Invalid',
      difficulty: 'medium',
      symptom: 'O SecretStore foi criado mas o status mostra Invalid. ExternalSecrets que o referenciam falham.',
      diagnosis: `\`\`\`bash
# Verificar SecretStore
kubectl describe secretstore <name>

# Verificar credenciais referenciadas
kubectl get secret <auth-secret-name> -o yaml

# Verificar conectividade com o provider
kubectl exec -n external-secrets deploy/external-secrets -- curl -s <provider-url>

# Verificar ServiceAccount (se usando kubernetes auth)
kubectl get serviceaccount <sa-name>
kubectl create token <sa-name>
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Credenciais invalidas:** O Secret referenciado pelo SecretStore deve conter credenciais validas. Verifique access keys, tokens ou certificados.

2. **Provider inacessivel:** O ESO precisa conectar ao provider pela rede. Verifique DNS, firewall e Service endpoints.

3. **ServiceAccount errado (Vault):** O ServiceAccount referenciado deve existir e ter permissao na role do Vault.

4. **Vault sealed:** Se o Vault estiver sealed, o SecretStore nao consegue validar a conexao.`
    },
    {
      title: 'Secret dessincronizado — valores antigos apos atualizacao no provider',
      difficulty: 'medium',
      symptom: 'Atualizou o secret no provider (Vault/AWS) mas o Kubernetes Secret ainda mostra os valores antigos.',
      diagnosis: `\`\`\`bash
# Verificar refreshInterval
kubectl get externalsecret <name> -o jsonpath='{.spec.refreshInterval}'

# Verificar ultima sincronizacao
kubectl get externalsecret <name> -o jsonpath='{.status.refreshTime}'

# Verificar condicoes
kubectl get externalsecret <name> -o jsonpath='{.status.conditions}'

# Forcar resync
kubectl annotate externalsecret <name> force-sync=\$(date +%s) --overwrite
\`\`\``,
      solution: `**Causas e solucoes:**

1. **refreshInterval muito longo:** Se o intervalo e 1h, pode levar ate 1 hora para o novo valor aparecer. Reduza temporariamente ou force resync.

2. **Cache do provider:** Alguns providers tem cache interno. O ESO pode receber o valor cached.

3. **Forcar resync:**
\`\`\`bash
# Adicionar annotation para trigger sync
kubectl annotate externalsecret <name> force-sync=\$(date +%s) --overwrite
\`\`\`

4. **Versao do secret (Vault KV v2):** Verifique que a versao mais recente do secret esta sendo lida. Por padrao, o ESO le a versao mais recente.`
    }
  ]
};
