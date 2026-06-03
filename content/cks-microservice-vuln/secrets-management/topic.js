window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-microservice-vuln/secrets-management'] = {

  theory: `# Secrets Management

## Relevancia no CKS
> O dominio "Minimize Microservice Vulnerabilities" vale **20%** do CKS. Gerenciamento seguro de Secrets e fundamental. Voce deve saber os tipos de Secrets, encryption at rest, e integracao com secret managers externos.

---

## Tipos de Secrets

| Tipo | Uso | Campo de Dados |
|------|-----|---------------|
| \`Opaque\` | Dados genericos (padrao) | Qualquer chave/valor |
| \`kubernetes.io/tls\` | Certificados TLS | tls.crt, tls.key |
| \`kubernetes.io/dockerconfigjson\` | Registry credentials | .dockerconfigjson |
| \`kubernetes.io/basic-auth\` | Credenciais basicas | username, password |
| \`kubernetes.io/ssh-auth\` | Chave SSH | ssh-privatekey |
| \`kubernetes.io/service-account-token\` | Token de SA (legado) | token, ca.crt, namespace |
| \`bootstrap.kubernetes.io/token\` | Bootstrap tokens | token-id, token-secret |

---

## Base64 NAO e Encriptacao

\`\`\`bash
# Secrets sao armazenados em base64 por padrao
echo "minha-senha" | base64
# bWluaGEtc2VuaGEK

# Qualquer pessoa pode decodificar
echo "bWluaGEtc2VuaGEK" | base64 -d
# minha-senha
\`\`\`

**Base64 e encoding, nao encriptacao!** Sem encryption at rest, secrets ficam em texto plano no etcd.

---

## Criando Secrets

\`\`\`bash
# Via kubectl (recomendado)
kubectl create secret generic app-secret \\
  --from-literal=db-password=S3cr3t! \\
  --from-literal=api-key=abc123

# Via arquivo
kubectl create secret generic app-config \\
  --from-file=config.properties \\
  --from-file=ca.pem

# TLS
kubectl create secret tls app-tls \\
  --cert=tls.crt --key=tls.key

# Docker registry
kubectl create secret docker-registry regcred \\
  --docker-server=registry.example.com \\
  --docker-username=user \\
  --docker-password=pass
\`\`\`

---

## Usando Secrets em Pods

### Como Environment Variables

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
  - name: app
    image: myapp:latest
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: app-secret
          key: db-password
\`\`\`

### Como Volume Mount (mais seguro)

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
  - name: app
    image: myapp:latest
    volumeMounts:
    - name: secret-vol
      mountPath: /etc/secrets
      readOnly: true
  volumes:
  - name: secret-vol
    secret:
      secretName: app-secret
      defaultMode: 0400
\`\`\`

**Volumes sao mais seguros** porque:
- Nao aparecem em \`kubectl describe pod\` (env vars sim)
- Sao armazenados em tmpfs (memoria, nao disco)
- Podem ter permissoes restritas (0400)

---

## Encryption at Rest

### Configuracao

\`\`\`yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: <base64-encoded-32-byte-key>
  - identity: {}
\`\`\`

### Providers

| Provider | Descricao | Seguranca |
|----------|-----------|-----------|
| \`identity\` | Sem encriptacao (padrao) | Nenhuma |
| \`aescbc\` | AES-CBC com PKCS#7 padding | Boa |
| \`aesgcm\` | AES-GCM (autenticada) | Melhor (rotacao obrigatoria) |
| \`secretbox\` | XSalsa20+Poly1305 | Boa |
| \`kms v2\` | Key Management Service externo | Maxima |

### Verificar se Esta Encriptado

\`\`\`bash
# Ler diretamente do etcd
ETCDCTL_API=3 etcdctl get /registry/secrets/default/app-secret \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/apiserver-etcd-client.crt \\
  --key=/etc/kubernetes/pki/apiserver-etcd-client.key | hexdump -C | head -20

# Se encriptado: vera prefixo "k8s:enc:aescbc:v1:key1:"
# Se nao encriptado: vera os dados em texto plano
\`\`\`

---

## Rotacao de Chaves de Encriptacao

\`\`\`bash
# 1. Gerar nova chave
NEW_KEY=\$(head -c 32 /dev/urandom | base64)

# 2. Adicionar nova chave como PRIMEIRA na lista
# (primeira = usada para encriptar)

# 3. Reiniciar API Server

# 4. Re-encriptar todos os secrets com a nova chave
kubectl get secrets -A -o json | kubectl replace -f -

# 5. Remover chave antiga da configuracao

# 6. Reiniciar API Server novamente
\`\`\`

---

## External Secret Managers

### HashiCorp Vault

\`\`\`yaml
# External Secrets Operator
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secret
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: app-secret
  data:
  - secretKey: db-password
    remoteRef:
      key: secret/data/app
      property: password
\`\`\`

### Beneficios de Secret Managers Externos

| Beneficio | Descricao |
|-----------|-----------|
| Rotacao automatica | Secrets sao renovados periodicamente |
| Auditoria | Log de quem acessou qual secret |
| Versionamento | Historico de mudancas |
| Centralizacao | Um lugar para todos os secrets |
| Acesso granular | Policies de acesso por aplicacao |

---

## RBAC para Secrets

\`\`\`yaml
# Restringir acesso a secrets especificos
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-secret-reader
  namespace: production
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get"]
  resourceNames: ["app-db-creds", "app-tls"]
\`\`\`

\`\`\`bash
# Verificar quem pode acessar secrets
kubectl auth can-i get secrets --as=developer -n production
kubectl auth can-i list secrets --as=developer -n production
\`\`\`

---

## Boas Praticas

1. **Encryption at rest** — sempre habilitar
2. **RBAC restritivo** — usar resourceNames
3. **Volumes ao inves de env vars** — mais seguro
4. **Nao commitar secrets em Git** — usar sealed-secrets ou external-secrets
5. **Rotacao regular** — de chaves de encriptacao e dos secrets
6. **Audit logging** — monitorar acesso a secrets
7. **defaultMode: 0400** — permissoes restritas nos volumes

---

## Erros Comuns

1. **Pensar que base64 e seguro** — e apenas encoding
2. **identity como primeiro provider** — dados gravados sem encriptacao
3. **RBAC com list/watch em secrets** — permite ver todos os secrets
4. **Secrets em env vars** — visiveis no describe e em logs
5. **Nao re-encriptar apos mudar chave** — secrets antigos ficam com chave antiga

---

## Killer.sh Style Challenge

> Configure encryption at rest usando aescbc para Secrets. Verifique no etcd que um secret existente esta em texto plano, habilite encriptacao, re-encripte todos os secrets, e verifique que agora estao encriptados.
`,

  quiz: [
    {
      question: 'Por que base64 NAO e considerado encriptacao?',
      options: [
        'Base64 usa chaves fracas',
        'Base64 e apenas encoding reversivel, qualquer pessoa pode decodificar',
        'Base64 nao funciona com binarios',
        'Base64 e mais lento que encriptacao'
      ],
      correct: 1,
      explanation: 'Base64 e um esquema de encoding que converte bytes em texto ASCII. Nao requer chave para decodificar — qualquer pessoa pode reverter com base64 -d.',
      reference: 'Conceito relacionado: Secrets — base64 vs encriptacao.'
    },
    {
      question: 'Qual a forma mais segura de expor um Secret para um container?',
      options: [
        'Environment variable',
        'Volume mount com permissoes restritas',
        'Annotation no pod',
        'ConfigMap'
      ],
      correct: 1,
      explanation: 'Volume mounts sao mais seguros: armazenados em tmpfs (memoria), nao aparecem em describe/logs, e podem ter permissoes de arquivo restritas (0400).',
      reference: 'Conceito relacionado: Secrets — env vars vs volumes.'
    },
    {
      question: 'Qual provider de encriptacao usa um servico externo de gerenciamento de chaves?',
      options: ['aescbc', 'aesgcm', 'secretbox', 'kms'],
      correct: 3,
      explanation: 'KMS (Key Management Service) integra com servicos externos como AWS KMS, GCP Cloud KMS ou Azure Key Vault. A chave de encriptacao nunca fica no disco do node.',
      reference: 'Conceito relacionado: Encryption at rest — KMS provider.'
    },
    {
      question: 'Como verificar se um Secret esta encriptado no etcd?',
      options: [
        'kubectl describe secret',
        'Ler diretamente do etcd com etcdctl e verificar o prefixo k8s:enc:',
        'kubectl get secret -o yaml',
        'Verificar logs do API Server'
      ],
      correct: 1,
      explanation: 'Lendo diretamente do etcd com etcdctl get e usando hexdump, voce pode verificar se o dado tem prefixo k8s:enc:<provider>:v1: (encriptado) ou se esta em texto plano.',
      reference: 'Conceito relacionado: Verificacao de encryption at rest.'
    },
    {
      question: 'Qual o risco de dar permissao "list" em secrets via RBAC?',
      options: [
        'Nao ha risco',
        'Permite ver o conteudo de TODOS os secrets do namespace',
        'Permite deletar secrets',
        'Permite criar novos secrets'
      ],
      correct: 1,
      explanation: 'A permissao "list" em secrets permite listar e ver o conteudo de todos os secrets do namespace. Use "get" com resourceNames para restringir a secrets especificos.',
      reference: 'Conceito relacionado: RBAC — acesso a secrets.'
    },
    {
      question: 'Apos rotacao da chave de encriptacao, o que deve ser feito com secrets existentes?',
      options: [
        'Nada, sao re-encriptados automaticamente',
        'Deletar e recriar todos',
        'Re-encriptar com kubectl get secrets -A -o json | kubectl replace -f -',
        'Reiniciar o etcd'
      ],
      correct: 2,
      explanation: 'Secrets existentes permanecem com a chave antiga. E necessario le-los e regrava-los para que sejam encriptados com a nova chave.',
      reference: 'Conceito relacionado: Rotacao de chaves — re-encriptacao.'
    },
    {
      question: 'Qual recurso do External Secrets Operator sincroniza secrets de um vault externo?',
      options: ['SecretImport', 'ExternalSecret', 'VaultSecret', 'SecretSync'],
      correct: 1,
      explanation: 'ExternalSecret define qual secret buscar do vault externo, como mapeie-lo para um K8s Secret, e com que frequencia sincronizar (refreshInterval).',
      reference: 'Conceito relacionado: External Secrets Operator.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os tipos de Secret do Kubernetes?', back: 'Opaque (generico), kubernetes.io/tls (certificados), kubernetes.io/dockerconfigjson (registry), kubernetes.io/basic-auth, kubernetes.io/ssh-auth, kubernetes.io/service-account-token (legado), bootstrap.kubernetes.io/token.' },
    { front: 'Por que volumes sao mais seguros que env vars para secrets?', back: 'Volumes: armazenados em tmpfs (memoria), nao aparecem em kubectl describe, permissoes de arquivo configuraveis (0400). Env vars: visiveis em describe, podem vazar em logs e core dumps.' },
    { front: 'O que e encryption at rest no contexto de secrets?', back: 'Encriptacao dos dados armazenados no etcd. Sem encryption at rest, secrets ficam em base64 (texto plano) no etcd. Providers: aescbc, aesgcm, secretbox, kms.' },
    { front: 'Como verificar se encryption at rest esta ativo?', back: 'Ler diretamente do etcd: etcdctl get /registry/secrets/<ns>/<name> | hexdump -C. Se encriptado, dados terao prefixo k8s:enc:<provider>:v1:. Se nao, dados serao legiveis.' },
    { front: 'O que e o External Secrets Operator?', back: 'Operator que sincroniza secrets de vaults externos (HashiCorp Vault, AWS Secrets Manager, etc.) para Kubernetes Secrets. Suporta rotacao automatica via refreshInterval.' },
    { front: 'Como restringir acesso RBAC a secrets especificos?', back: 'Usar resourceNames na Role: resources: [\"secrets\"], verbs: [\"get\"], resourceNames: [\"app-db-creds\"]. Evitar \"list\" pois permite ver todos os secrets.' },
    { front: 'Quais os passos para rotacao de chave de encriptacao?', back: '1) Gerar nova chave. 2) Adicionar como primeira na lista de providers. 3) Reiniciar API Server. 4) Re-encriptar: kubectl get secrets -A -o json | kubectl replace -f -. 5) Remover chave antiga. 6) Reiniciar.' }
  ],

  lab: {
    scenario: 'O cluster armazena secrets sem encriptacao e utiliza praticas inseguras de gerenciamento. Voce precisa melhorar a seguranca.',
    objective: 'Criar secrets de forma segura, verificar encriptacao e restringir acesso via RBAC.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Criar Secrets de Forma Segura',
        instruction: 'Crie um Secret com credenciais de banco de dados e monte-o como volume com permissoes restritas.',
        hints: [
          'Use kubectl create secret generic',
          'Monte como volume com defaultMode: 0400',
          'Use readOnly: true no volumeMount'
        ],
        solution: '```bash\n# Criar Secret\nkubectl create secret generic db-creds \\\n  --from-literal=username=admin \\\n  --from-literal=password=S3cr3tP4ss!\n\n# Criar Pod com volume mount seguro\nkubectl apply -f - <<EOF\napiVersion: v1\nkind: Pod\nmetadata:\n  name: secure-app\nspec:\n  containers:\n  - name: app\n    image: nginx:1.25-alpine\n    volumeMounts:\n    - name: db-creds\n      mountPath: /etc/db-creds\n      readOnly: true\n  volumes:\n  - name: db-creds\n    secret:\n      secretName: db-creds\n      defaultMode: 0400\nEOF\n```',
        verify: '```bash\n# Verificar Secret criado\nkubectl get secret db-creds\n# Saida esperada: db-creds Opaque 2\n\n# Verificar permissoes no pod\nkubectl exec secure-app -- ls -la /etc/db-creds/\n# Saida esperada: -r-------- para cada arquivo\n\n# Verificar conteudo\nkubectl exec secure-app -- cat /etc/db-creds/username\n# Saida esperada: admin\n```'
      },
      {
        title: 'Restringir Acesso via RBAC',
        instruction: 'Crie uma Role que permite acesso apenas ao secret `db-creds` e vincule a um ServiceAccount.',
        hints: [
          'Use resourceNames para restringir a secrets especificos',
          'Nao de permissao list (permite ver todos)',
          'Use apenas o verb get'
        ],
        solution: '```bash\n# Criar ServiceAccount\nkubectl create serviceaccount app-sa\n\n# Criar Role restritiva\nkubectl apply -f - <<EOF\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: db-creds-reader\nrules:\n- apiGroups: [\"\"]\n  resources: [\"secrets\"]\n  verbs: [\"get\"]\n  resourceNames: [\"db-creds\"]\nEOF\n\n# Criar RoleBinding\nkubectl create rolebinding app-sa-db-creds \\\n  --role=db-creds-reader \\\n  --serviceaccount=default:app-sa\n```',
        verify: '```bash\n# Pode acessar db-creds\nkubectl auth can-i get secrets/db-creds --as=system:serviceaccount:default:app-sa\n# Saida esperada: yes\n\n# NAO pode listar todos os secrets\nkubectl auth can-i list secrets --as=system:serviceaccount:default:app-sa\n# Saida esperada: no\n\n# NAO pode acessar outros secrets\nkubectl auth can-i get secrets/other-secret --as=system:serviceaccount:default:app-sa\n# Saida esperada: no\n```'
      },
      {
        title: 'Verificar Encriptacao no etcd',
        instruction: 'Verifique se o secret esta encriptado no etcd lendo diretamente do datastore.',
        hints: [
          'Use etcdctl com certificados TLS',
          'O path no etcd e /registry/secrets/<namespace>/<name>',
          'Use hexdump para visualizar os bytes'
        ],
        solution: '```bash\n# Ler secret diretamente do etcd\nsudo ETCDCTL_API=3 etcdctl get /registry/secrets/default/db-creds \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/apiserver-etcd-client.crt \\\n  --key=/etc/kubernetes/pki/apiserver-etcd-client.key \\\n  | hexdump -C | head -20\n\n# Se encriptado: vera k8s:enc:aescbc:v1:key1:\n# Se NAO encriptado: vera os dados em texto plano\n```',
        verify: '```bash\n# Verificar se encryption-provider-config esta configurado no API Server\nps aux | grep kube-apiserver | grep encryption-provider-config\n# Se retornar resultado: encryption at rest esta configurado\n# Se vazio: secrets estao em texto plano no etcd\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Secret Montado com Permissoes Incorretas',
      difficulty: 'easy',
      symptom: 'Aplicacao nao consegue ler o secret montado como volume, retornando Permission Denied.',
      diagnosis: '```bash\n# Verificar permissoes do arquivo\nkubectl exec <pod> -- ls -la /etc/secrets/\n\n# Verificar defaultMode no volume\nkubectl get pod <pod> -o yaml | grep -A 5 defaultMode\n\n# Verificar usuario do container\nkubectl exec <pod> -- id\n```',
      solution: 'O defaultMode define as permissoes do arquivo. Se o container roda como non-root (ex: UID 1000) e o defaultMode e 0400 (read owner only), o owner e root e o container nao consegue ler. Solucoes: 1) Usar defaultMode: 0444 (read all). 2) Montar com fsGroup no securityContext. 3) Usar initContainer para ajustar permissoes.'
    },
    {
      title: 'Secrets Antigos Nao Encriptados Apos Habilitar Encryption',
      difficulty: 'medium',
      symptom: 'Encryption at rest foi habilitado mas secrets criados antes da configuracao ainda aparecem em texto plano no etcd.',
      diagnosis: '```bash\n# Verificar secret antigo no etcd\nsudo ETCDCTL_API=3 etcdctl get /registry/secrets/default/<old-secret> \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/apiserver-etcd-client.crt \\\n  --key=/etc/kubernetes/pki/apiserver-etcd-client.key | hexdump -C | head\n\n# Se nao tem prefixo k8s:enc:, esta em texto plano\n```',
      solution: 'Encryption at rest so afeta dados ESCRITOS apos a configuracao. Secrets existentes precisam ser re-escritos: kubectl get secrets -A -o json | kubectl replace -f -. Isso le cada secret (decripta se necessario) e regrava (encripta com o provider ativo).'
    }
  ]
};
