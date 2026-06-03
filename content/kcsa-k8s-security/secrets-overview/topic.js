window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcsa-k8s-security/secrets-overview'] = {
  theory: `# Kubernetes Secrets — Overview

## Relevância no Exame
> KCSA — K8s Security Fundamentals (22%). Secrets são críticos: entender que base64 ≠ criptografia, como funciona a criptografia em repouso, e as melhores práticas de gestão de segredos são tópicos frequentes.

## O Problema com Dados Sensíveis

Hardcodar senhas, tokens e chaves em imagens de container ou manifests é uma má prática crítica. Kubernetes Secrets foram criados para desacoplar configurações sensíveis do código, mas **Secrets por padrão não são seguros por si mesmos**.

### Base64 ≠ Criptografia

\`\`\`bash
# Secrets são apenas base64-encoded por padrão
echo -n "minha-senha" | base64
# bWluaGEtc2VuaGE=

# Qualquer um pode decodificar
echo -n "bWluaGEtc2VuaGE=" | base64 -d
# minha-senha

# No etcd, sem encryption at rest, o valor fica exposto
kubectl get secret meu-secret -o jsonpath='{.data.password}' | base64 -d
\`\`\`

**Base64 é encoding, não encryption.** O valor em etcd fica em texto claro se não houver criptografia em repouso configurada.

## Tipos de Secrets

| Tipo | Uso |
|------|-----|
| \`Opaque\` | Dados genéricos (padrão) |
| \`kubernetes.io/service-account-token\` | Token de SA (legado) |
| \`kubernetes.io/dockerconfigjson\` | Pull de imagens privadas |
| \`kubernetes.io/tls\` | Certificados TLS |
| \`kubernetes.io/ssh-auth\` | Chaves SSH |
| \`kubernetes.io/basic-auth\` | Usuário/senha HTTP |

## Criação de Secrets

\`\`\`bash
# Imperativo — literal
kubectl create secret generic db-secret \\
  --from-literal=username=admin \\
  --from-literal=password=s3cr3t

# Imperativo — de arquivo
kubectl create secret generic tls-secret \\
  --from-file=cert.pem --from-file=key.pem

# TLS
kubectl create secret tls meu-tls \\
  --cert=path/to/cert.crt --key=path/to/key.key

# Docker registry
kubectl create secret docker-registry registry-creds \\
  --docker-server=myregistry.io \\
  --docker-username=user \\
  --docker-password=pass
\`\`\`

## Usando Secrets em Pods

### Como variável de ambiente

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
spec:
  containers:
  - name: app
    image: myapp:1.0
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: password
    envFrom:
    - secretRef:
        name: db-secret  # monta todas as chaves como env vars
\`\`\`

### Como volume (preferível)

\`\`\`yaml
spec:
  containers:
  - name: app
    image: myapp:1.0
    volumeMounts:
    - name: secret-vol
      mountPath: /etc/secrets
      readOnly: true  # SEMPRE readOnly
  volumes:
  - name: secret-vol
    secret:
      secretName: db-secret
      defaultMode: 0400  # permissões restritas
\`\`\`

**Volume é preferível a env var** porque:
- Env vars podem vazar em logs, dumps de processo, subprocessos
- Volumes podem ser rotacionados sem reiniciar o pod (se secretName mudar)
- Melhor controle de permissões de arquivo

## Criptografia em Repouso (Encryption at Rest)

Por padrão, Secrets ficam em texto claro no etcd. Para criptografar:

### EncryptionConfiguration

\`\`\`yaml
# /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:           # Criptografia AES-CBC com PBKDF2
      keys:
      - name: key1
        secret: <base64-encoded-32-byte-key>
  - identity: {}      # Fallback: sem criptografia (para leitura de dados antigos)
\`\`\`

\`\`\`bash
# Gerar chave de 32 bytes
head -c 32 /dev/urandom | base64

# Aplicar no kube-apiserver
# --encryption-provider-config=/etc/kubernetes/encryption-config.yaml

# Verificar se secret está criptografado no etcd
ETCDCTL_API=3 etcdctl get /registry/secrets/default/db-secret \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key | hexdump -C | head
# Se criptografado: começa com k8s:enc:aescbc:v1:

# Criptografar todos os secrets existentes
kubectl get secrets -A -o json | kubectl replace -f -
\`\`\`

### Provedores de Criptografia (ordem de segurança)

| Provider | Segurança | Observações |
|----------|-----------|-------------|
| \`identity\` | Nenhuma | Texto claro, apenas fallback |
| \`aescbc\` | Baixa/Média | AES-CBC, chave local, padrão antigo |
| \`aesgcm\` | Média | AES-GCM, mais eficiente |
| \`secretbox\` | Alta | XSalsa20-Poly1305, recomendado local |
| \`kms\` | Muito Alta | Chave externa (AWS KMS, GCP KMS, Azure Key Vault) |
| \`kms v2\` | Mais Alta | DEK caching, melhor performance |

**KMS é o mais seguro** porque a chave mestre nunca fica no cluster.

## External Secret Managers

Para produção, a melhor prática é usar gerenciadores externos:

### HashiCorp Vault

\`\`\`bash
# Vault Agent injeta secrets em sidecars
# Anotações no pod:
# vault.hashicorp.com/agent-inject: "true"
# vault.hashicorp.com/role: "myapp"
# vault.hashicorp.com/agent-inject-secret-config.txt: "secret/data/myapp/config"
\`\`\`

### External Secrets Operator (ESO)

\`\`\`yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-secret
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: db-secret  # Secret K8s criado
  data:
  - secretKey: password
    remoteRef:
      key: prod/myapp/db
      property: password
\`\`\`

### Vantagens de External Secret Managers

- Rotação automática de secrets
- Audit log detalhado de acesso
- Suporte a versioning e rollback
- Secrets nunca ficam em etcd
- Acesso granular por serviço

## RBAC para Secrets

Secrets precisam de RBAC restritivo — o **princípio do menor privilégio** é crítico:

\`\`\`yaml
# Role: apenas leitura de um secret específico
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: secret-reader
  namespace: production
rules:
- apiGroups: [""]
  resources: ["secrets"]
  resourceNames: ["db-secret"]  # Nome específico — mais restritivo
  verbs: ["get"]                # Apenas get, não list/watch
\`\`\`

\`\`\`bash
# Verificar quem pode acessar secrets
kubectl auth can-i get secrets -n production --as=system:serviceaccount:production:myapp

# Listar quem tem acesso a secrets (audit)
kubectl get rolebindings,clusterrolebindings -A -o json | \\
  jq '.items[] | select(.roleRef.name | test("secret|admin|cluster-admin"))'
\`\`\`

**Perigos de RBAC para Secrets:**
- \`list\` secrets revela todos os valores via API
- \`watch\` permite monitorar mudanças
- \`*\` (wildcard) inclui secrets implicitamente
- ServiceAccounts com acesso desnecessário a secrets

## Melhores Práticas

\`\`\`
✅ Habilitar encryption at rest (preferencialmente KMS)
✅ Montar secrets como volumes (readOnly)
✅ RBAC restritivo com resourceNames específicos
✅ Usar External Secret Managers em produção
✅ Rotacionar secrets regularmente
✅ Não usar namespace default para workloads
✅ automountServiceAccountToken: false quando não necessário
✅ Audit logging para acesso a secrets
❌ Não committar Secrets em Git (mesmo que base64)
❌ Não usar env vars para dados ultra-sensíveis
❌ Não dar list/watch de secrets desnecessariamente
❌ Não usar identity como único provider no etcd
\`\`\`

## Erros Comuns

1. **Confundir base64 com segurança** — é apenas encoding, qualquer um decodifica
2. **Não configurar encryption at rest** — etcd expõe secrets em texto claro
3. **RBAC muito permissivo** — \`list secrets\` revela tudo, não apenas um
4. **Secret em variável de ambiente** — vaza em /proc/PID/environ, logs, \`kubectl describe\`
5. **Não rotacionar secrets** após comprometimento
6. **imagePullSecrets sem proteção** — credentials de registry expostas

## Killer.sh Style Challenge

> **Cenário**: O time de segurança descobriu que Secrets no namespace \`payments\` não estão criptografados no etcd. Configure a criptografia em repouso usando AES-CBC para todos os Secrets, verifique que funciona, e garanta que os Secrets existentes também sejam criptografados.
`,
  quiz: [
    {
      question: 'Por que base64 NÃO é considerado seguro para armazenar senhas em Kubernetes Secrets?',
      options: [
        'Porque é um algoritmo de criptografia fraco',
        'Porque é apenas um encoding reversível, não criptografia',
        'Porque o etcd não suporta base64',
        'Porque kubectl não consegue decodificar base64'
      ],
      correct: 1,
      explanation: 'Base64 é um formato de encoding (codificação), não criptografia. Qualquer pessoa pode decodificar um valor base64 sem nenhuma chave ou segredo — `echo "bWluaGEtc2VuaGE=" | base64 -d` revela o valor original imediatamente.',
      reference: 'Conceito relacionado: Encryption at Rest — veja seção "Criptografia em Repouso" na teoria para entender como realmente proteger Secrets no etcd.'
    },
    {
      question: 'Qual provider de EncryptionConfiguration oferece o MAIOR nível de segurança para Secrets em etcd?',
      options: [
        'aescbc — AES-CBC com chave local',
        'aesgcm — AES-GCM mais eficiente',
        'secretbox — XSalsa20-Poly1305',
        'kms — chave mestre em serviço externo'
      ],
      correct: 3,
      explanation: 'O provider `kms` é o mais seguro porque a chave mestre (Key Encryption Key) nunca é armazenada no cluster — fica em um serviço externo como AWS KMS, GCP Cloud KMS ou Azure Key Vault. Isso garante separação de responsabilidade: comprometer o etcd não expõe a chave mestre.',
      reference: 'Conceito relacionado: Control Plane Security — veja o tópico de segurança do control plane para entender a configuração do EncryptionConfiguration no kube-apiserver.'
    },
    {
      question: 'Qual é a forma MAIS segura de fornecer um Secret para um container?',
      options: [
        'Variável de ambiente via env.valueFrom.secretKeyRef',
        'Variável de ambiente via envFrom.secretRef',
        'Volume montado com readOnly: true e permissões restritivas',
        'Argumento de linha de comando no spec.containers.args'
      ],
      correct: 2,
      explanation: 'Volumes montados são preferíveis porque: (1) não aparecem em `kubectl describe pod`, (2) não vazam em subprocessos via /proc, (3) podem ser montados com readOnly: true e defaultMode: 0400, (4) podem ser atualizados sem reiniciar o pod quando o Secret muda.',
      reference: 'Veja a seção "Usando Secrets em Pods" na teoria para comparação detalhada entre env vars e volumes.'
    },
    {
      question: 'Após configurar EncryptionConfiguration, o que deve ser feito para que Secrets EXISTENTES também sejam criptografados?',
      options: [
        'Reiniciar o kube-apiserver automaticamente criptografa tudo',
        'Deletar e recriar cada Secret manualmente',
        'Executar: kubectl get secrets -A -o json | kubectl replace -f -',
        'Secrets existentes são automaticamente migrados na próxima leitura'
      ],
      correct: 2,
      explanation: 'A EncryptionConfiguration só criptografa Secrets escritos APÓS sua configuração. Para migrar Secrets existentes, é necessário forçar uma reescrita: `kubectl get secrets -A -o json | kubectl replace -f -`. Isso força o kube-apiserver a ler e reescrever cada Secret com o novo provider.',
      reference: 'Conceito relacionado: etcd — os dados existentes no etcd não são automaticamente re-criptografados; é necessária uma operação explícita de reescrita.'
    },
    {
      question: 'Por que conceder o verbo `list` para Secrets em uma Role é especialmente perigoso?',
      options: [
        'Porque list permite deletar todos os Secrets',
        'Porque list retorna todos os valores dos Secrets de uma vez, não apenas metadados',
        'Porque list é um verbo de escrita que pode modificar Secrets',
        'Porque list consome muitos recursos do kube-apiserver'
      ],
      correct: 1,
      explanation: 'O verbo `list` para Secrets retorna a resposta completa da API incluindo os valores (base64-encoded). Diferente de outros recursos onde list retorna apenas metadados, Secrets sempre incluem o `.data` no list. Isso significa que qualquer um com `list` permission pode ler TODOS os Secrets do namespace de uma vez.',
      reference: 'Veja a seção "RBAC para Secrets" — use `get` com `resourceNames` específico ao invés de `list` para minimizar a superfície de ataque.'
    },
    {
      question: 'Qual é a principal vantagem de usar External Secrets Operator (ESO) em comparação a Kubernetes Secrets nativos?',
      options: [
        'ESO é mais rápido que Kubernetes Secrets nativos',
        'ESO permite armazenar Secrets maiores que 1MB',
        'Secrets nunca ficam armazenados no etcd e têm rotação automática',
        'ESO integra com RBAC nativo do Kubernetes automaticamente'
      ],
      correct: 2,
      explanation: 'Com ESO, os valores sensíveis ficam em sistemas externos (AWS Secrets Manager, HashiCorp Vault, etc.) e o ESO sincroniza apenas o necessário. Isso significa que comprometer o etcd não expõe os segredos reais, além de suporte a rotação automática, audit logging detalhado e versionamento.',
      reference: 'Conceito relacionado: Supply Chain Security — gerenciadores externos fazem parte de uma estratégia de segurança em profundidade para proteger dados sensíveis.'
    },
    {
      question: 'Um desenvolvedor pede acesso para "verificar se um Secret existe" no namespace production. Qual é a permissão MÍNIMA e MAIS SEGURA para conceder?',
      options: [
        'get secrets — permite ver todos os Secrets',
        'list secrets — permite ver todos os Secrets de uma vez',
        'get secrets com resourceNames específico — apenas aquele Secret',
        'watch secrets — monitora mudanças em tempo real'
      ],
      correct: 2,
      explanation: 'Para verificar se um Secret específico existe, use `get` com `resourceNames: ["nome-do-secret"]`. Isso limita o acesso a apenas aquele Secret específico. Evite `list` (expõe todos) e `watch` (monitoramento contínuo desnecessário). O princípio do menor privilégio deve guiar todas as decisões de RBAC para Secrets.',
      reference: 'Veja a seção "RBAC para Secrets" na teoria com exemplo de Role usando resourceNames específico.'
    },
    {
      question: 'Como verificar se um Secret está sendo armazenado criptografado no etcd?',
      options: [
        'kubectl get secret meu-secret -o yaml e verificar se .data está em formato irreconhecível',
        'etcdctl get /registry/secrets/... e verificar se começa com k8s:enc:',
        'kubectl describe secret meu-secret e verificar campo Encrypted: true',
        'kubectl get secret meu-secret -o json e verificar campo .metadata.annotations.encrypted'
      ],
      correct: 1,
      explanation: 'Para verificar encryption at rest, é necessário consultar o etcd diretamente com etcdctl. Se o Secret estiver criptografado, o valor bruto começa com o prefixo `k8s:enc:aescbc:v1:` (ou o provider configurado). `kubectl get` sempre descriptografa automaticamente, então não é útil para essa verificação.',
      reference: 'Veja os comandos na seção "Criptografia em Repouso" — verificar via etcdctl é a única forma de confirmar que a criptografia está funcionando de ponta a ponta.'
    }
  ],
  flashcards: [
    {
      front: 'Base64 é criptografia?',
      back: 'NÃO. Base64 é apenas encoding (codificação reversível). Qualquer pessoa pode decodificar sem chave: `echo "dGVzdA==" | base64 -d`. Secrets em K8s são base64-encoded por padrão, mas não criptografados sem EncryptionConfiguration.'
    },
    {
      front: 'Como habilitar encryption at rest para Secrets?',
      back: 'Criar EncryptionConfiguration YAML com providers (kms > secretbox > aescbc > identity) e configurar kube-apiserver com `--encryption-provider-config=/path/config.yaml`. Depois: `kubectl get secrets -A -o json | kubectl replace -f -` para migrar existentes.'
    },
    {
      front: 'Qual provider de encryption é o mais seguro e por quê?',
      back: 'KMS (Key Management Service). A chave mestre fica em serviço externo (AWS KMS, GCP KMS, Azure Key Vault) — nunca no cluster. Comprometer o etcd não expõe a KEK (Key Encryption Key).'
    },
    {
      front: 'Volume vs env var para Secrets — qual é melhor e por quê?',
      back: 'Volume é melhor: (1) não aparece em `kubectl describe`, (2) não vaza em /proc/PID/environ, (3) pode ser readOnly e com permissões 0400, (4) pode ser atualizado sem reiniciar o pod.'
    },
    {
      front: 'Por que `list secrets` é mais perigoso que `get secrets`?',
      back: '`list` retorna TODOS os Secrets com seus valores de uma vez. `get` com `resourceNames` específico limita a um Secret. Sempre use `get` + `resourceNames` ao invés de `list` para minimizar exposição.'
    },
    {
      front: 'O que é External Secrets Operator (ESO)?',
      back: 'Operador K8s que sincroniza secrets de gerenciadores externos (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager) para Kubernetes Secrets. Vantagens: rotação automática, audit log, secrets nunca ficam apenas no etcd.'
    },
    {
      front: 'Como verificar se Secret está criptografado no etcd?',
      back: 'Via etcdctl: `etcdctl get /registry/secrets/<ns>/<name> --cacert=... --cert=... --key=...`. Se criptografado, o valor começa com `k8s:enc:aescbc:v1:` ou similar. kubectl sempre descriptografa automaticamente.'
    },
    {
      front: 'Quais verbos de RBAC são perigosos para Secrets?',
      back: '`list` (expõe todos os valores), `watch` (monitoramento contínuo), `*` (inclui tudo). Seguro: `get` com `resourceNames` específico. Nunca conceder `list` ou `watch` desnecessariamente.'
    }
  ],
  lab: {
    scenario: 'O time de segurança identificou que a aplicação `payments-app` está usando Secrets como variáveis de ambiente sem criptografia em repouso. Você deve melhorar a segurança dos Secrets: configurar criptografia em repouso, migrar para volume mount, e aplicar RBAC restritivo.',
    objective: 'Entender e implementar boas práticas de Secrets: encryption at rest, volume mounts e RBAC mínimo.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Secret e verificar exposição no etcd',
        instruction: `Crie um Secret com dados sensíveis e verifique como ele aparece no etcd (sem criptografia).

\`\`\`bash
# Criar namespace e Secret
kubectl create namespace payments
kubectl create secret generic db-credentials \\
  --from-literal=username=payments_user \\
  --from-literal=password=SuperSecret123! \\
  -n payments
\`\`\`

Tente acessar o etcd diretamente (em clusters kubeadm):
\`\`\`bash
ETCDCTL_API=3 etcdctl get /registry/secrets/payments/db-credentials \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key
\`\`\`

Observe que o valor aparece em base64 legível (não criptografado).`,
        hints: [
          'O etcdctl requer certificados TLS — todos ficam em /etc/kubernetes/pki/etcd/',
          'Se não tiver acesso ao control plane, simule: kubectl get secret db-credentials -n payments -o jsonpath="{.data.password}" | base64 -d'
        ],
        solution: `\`\`\`bash
kubectl create namespace payments
kubectl create secret generic db-credentials \\
  --from-literal=username=payments_user \\
  --from-literal=password=SuperSecret123! \\
  -n payments

# Verificar o secret (decodificado pelo kubectl)
kubectl get secret db-credentials -n payments -o jsonpath='{.data.password}' | base64 -d
# Output: SuperSecret123!
\`\`\``,
        verify: `\`\`\`bash
# Verificar Secret criado
kubectl get secret db-credentials -n payments
# NAME             TYPE     DATA   AGE
# db-credentials   Opaque   2      ...

kubectl get secret db-credentials -n payments -o jsonpath='{.data.username}' | base64 -d
# Saída esperada: payments_user
\`\`\``
      },
      {
        title: 'Criar Pod usando Secret como volume (não env var)',
        instruction: `Crie um Pod que monta o Secret como volume com permissões restritivas, ao invés de variáveis de ambiente.

\`\`\`yaml
# payments-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: payments-app
  namespace: payments
spec:
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
  containers:
  - name: app
    image: busybox:1.35
    command: ["sh", "-c", "cat /etc/db-creds/password && sleep 3600"]
    volumeMounts:
    - name: db-creds
      mountPath: /etc/db-creds
      readOnly: true
  volumes:
  - name: db-creds
    secret:
      secretName: db-credentials
      defaultMode: 0400
\`\`\``,
        hints: [
          'defaultMode: 0400 significa leitura apenas para o owner (root ou fsGroup)',
          'readOnly: true no volumeMount é uma boa prática adicional',
          'automountServiceAccountToken: false remove um token desnecessário'
        ],
        solution: `\`\`\`bash
kubectl apply -f payments-pod.yaml

# Verificar que os arquivos estão acessíveis dentro do container
kubectl exec -n payments payments-app -- ls -la /etc/db-creds/
kubectl exec -n payments payments-app -- cat /etc/db-creds/username
kubectl exec -n payments payments-app -- cat /etc/db-creds/password
\`\`\``,
        verify: `\`\`\`bash
# Pod deve estar Running
kubectl get pod payments-app -n payments
# NAME           READY   STATUS    RESTARTS
# payments-app   1/1     Running   0

# Verificar permissões dos arquivos (devem ser 0400)
kubectl exec -n payments payments-app -- ls -la /etc/db-creds/
# -r-------- ... password
# -r-------- ... username

# Logs devem mostrar a senha lida do volume
kubectl logs payments-app -n payments
# SuperSecret123!
\`\`\``
      },
      {
        title: 'Aplicar RBAC restritivo para acesso ao Secret',
        instruction: `Crie um ServiceAccount para a aplicação e uma Role que concede acesso MÍNIMO apenas ao Secret necessário.

\`\`\`bash
# Criar ServiceAccount dedicada
kubectl create serviceaccount payments-sa -n payments
\`\`\`

\`\`\`yaml
# payments-rbac.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: payments-secret-reader
  namespace: payments
rules:
- apiGroups: [""]
  resources: ["secrets"]
  resourceNames: ["db-credentials"]  # Apenas este Secret específico
  verbs: ["get"]                     # Apenas get, não list ou watch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: payments-sa-secret-binding
  namespace: payments
subjects:
- kind: ServiceAccount
  name: payments-sa
  namespace: payments
roleRef:
  kind: Role
  name: payments-secret-reader
  apiGroup: rbac.authorization.k8s.io
\`\`\`

Verifique as permissões:
\`\`\`bash
# Deve ter acesso
kubectl auth can-i get secret/db-credentials -n payments \\
  --as=system:serviceaccount:payments:payments-sa

# NÃO deve ter acesso (list)
kubectl auth can-i list secrets -n payments \\
  --as=system:serviceaccount:payments:payments-sa

# NÃO deve ter acesso a outro Secret
kubectl auth can-i get secret/outro-secret -n payments \\
  --as=system:serviceaccount:payments:payments-sa
\`\`\``,
        hints: [
          'resourceNames restringe a recursos específicos pelo nome — mais seguro que sem resourceNames',
          'O verbo "list" retorna todos os valores de todos os Secrets — evite concedê-lo',
          'kubectl auth can-i com --as permite simular permissões sem precisar do token real'
        ],
        solution: `\`\`\`bash
kubectl create serviceaccount payments-sa -n payments
kubectl apply -f payments-rbac.yaml

# Testar permissões
kubectl auth can-i get secret/db-credentials -n payments \\
  --as=system:serviceaccount:payments:payments-sa
# yes

kubectl auth can-i list secrets -n payments \\
  --as=system:serviceaccount:payments:payments-sa
# no
\`\`\``,
        verify: `\`\`\`bash
# Verificar Role criada
kubectl get role payments-secret-reader -n payments -o yaml
# Deve mostrar apenas get com resourceNames: [db-credentials]

# Verificar binding
kubectl get rolebinding payments-sa-secret-binding -n payments

# Testar permissão get — deve retornar "yes"
kubectl auth can-i get secret/db-credentials -n payments \\
  --as=system:serviceaccount:payments:payments-sa

# Testar list — deve retornar "no"
kubectl auth can-i list secrets -n payments \\
  --as=system:serviceaccount:payments:payments-sa
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Secret exposto em texto claro no etcd',
      difficulty: 'medium',
      symptom: 'Auditoria de segurança revelou que Secrets no etcd estão em base64 legível. O time quer que todos os Secrets sejam criptografados com AES-CBC. Após configurar EncryptionConfiguration e reiniciar o kube-apiserver, novos Secrets são criptografados mas os existentes ainda aparecem em texto claro.',
      diagnosis: `\`\`\`bash
# Verificar se EncryptionConfiguration está ativa
kubectl get pod kube-apiserver-<node> -n kube-system -o yaml | grep encryption

# Criar um Secret NOVO e verificar no etcd
kubectl create secret generic test-new -n default --from-literal=key=value123

ETCDCTL_API=3 etcdctl get /registry/secrets/default/test-new \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key
# Novo Secret: começa com k8s:enc:aescbc:v1: ✅

ETCDCTL_API=3 etcdctl get /registry/secrets/default/old-secret \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key
# Secret antigo: ainda em base64 ❌
\`\`\``,
      solution: `A EncryptionConfiguration apenas criptografa dados escritos APÓS sua aplicação. Secrets existentes precisam ser explicitamente re-escritos:

\`\`\`bash
# Forçar reescrita de todos os Secrets (criptografa com o novo provider)
kubectl get secrets -A -o json | kubectl replace -f -

# Verificar que um Secret antigo agora está criptografado
ETCDCTL_API=3 etcdctl get /registry/secrets/default/old-secret \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key | strings | head -1
# Deve começar com: k8s:enc:aescbc:v1:

# Garantir que o provider "identity: {}" está como FALLBACK (último na lista)
# para permitir leitura de dados antigos durante a migração
\`\`\``
    },
    {
      title: 'Pod falha ao iniciar — Secret não encontrado',
      difficulty: 'easy',
      symptom: 'Pod no namespace `staging` falha com erro `CreateContainerConfigError`. O describe mostra: `secret "db-credentials" not found`.',
      diagnosis: `\`\`\`bash
# Ver eventos do Pod
kubectl describe pod payments-app -n staging
# Events:
#   Warning  Failed  CreateContainerConfigError: secret "db-credentials" not found

# Listar Secrets disponíveis no namespace
kubectl get secrets -n staging
# NAME                  TYPE
# default-token-xxxxx   kubernetes.io/service-account-token
# (sem db-credentials!)

# Verificar se Secret existe em outro namespace
kubectl get secrets -A | grep db-credentials
# production/db-credentials  Opaque  2  ...
\`\`\``,
      solution: `Secrets são namespaced — não podem ser compartilhados entre namespaces. Soluções:

\`\`\`bash
# Opção 1: Criar o Secret no namespace correto
kubectl create secret generic db-credentials \\
  --from-literal=username=staging_user \\
  --from-literal=password=StagingPass456! \\
  -n staging

# Opção 2 (melhor prática): Usar External Secrets Operator para sincronizar
# ExternalSecret apontando para o mesmo segredo no gerenciador externo

# Verificar que o Pod agora consegue iniciar
kubectl get pod payments-app -n staging -w
# NAME           READY   STATUS    RESTARTS
# payments-app   1/1     Running   0

# Se usar envFrom, verificar que o secretRef está correto
kubectl describe pod payments-app -n staging | grep -A5 "envFrom\\|secretRef"
\`\`\``
    }
  ]
};
