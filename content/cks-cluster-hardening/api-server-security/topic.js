window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-cluster-hardening/api-server-security'] = {

  theory: `# API Server Security

## Relevancia no CKS
> O dominio "Cluster Hardening" vale **15%** do CKS. O API Server e o componente central do Kubernetes — toda comunicacao passa por ele. Hardening do API Server e uma das tarefas mais criticas e frequentes no exame.

---

## Flags Criticas de Seguranca

O kube-apiserver e configurado via flags no manifest estático em \`/etc/kubernetes/manifests/kube-apiserver.yaml\`.

### Autenticacao

| Flag | Valor Seguro | Descricao |
|------|-------------|-----------|
| \`--anonymous-auth\` | \`false\` | Desabilita acesso anonimo |
| \`--token-auth-file\` | Nao usar | Static tokens sao inseguros |
| \`--basic-auth-file\` | Nao usar | Basic auth deprecated/removido |

\`\`\`yaml
# /etc/kubernetes/manifests/kube-apiserver.yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --anonymous-auth=false
    # NAO incluir --token-auth-file ou --basic-auth-file
\`\`\`

### Autorizacao

\`\`\`yaml
    - --authorization-mode=Node,RBAC
    # Node: restringe kubelet a seus proprios recursos
    # RBAC: controle de acesso baseado em roles
    # NUNCA usar AlwaysAllow
\`\`\`

### Profiling

\`\`\`yaml
    - --profiling=false
    # Desabilita endpoint de profiling que pode vazar informacoes
\`\`\`

---

## Admission Controllers

Admission Controllers interceptam requests ao API Server APOS autenticacao/autorizacao e ANTES da persistencia.

### Controllers Essenciais para Seguranca

\`\`\`yaml
    - --enable-admission-plugins=NodeRestriction,PodSecurity,AlwaysPullImages
\`\`\`

| Controller | Funcao |
|-----------|--------|
| **NodeRestriction** | Limita o que kubelet pode modificar (apenas seus pods/nodes) |
| **PodSecurity** | Enforces Pod Security Standards (PSS) |
| **AlwaysPullImages** | Forca pull da imagem sempre (evita uso de imagens cached) |
| **EventRateLimit** | Limita taxa de eventos (previne DoS) |

### Controllers que Devem Ser Desabilitados

\`\`\`yaml
    - --disable-admission-plugins=AlwaysAdmit
    # AlwaysAdmit: aprova tudo, sem validacao
\`\`\`

---

## Encryption at Rest

Por padrao, Secrets sao armazenados em **texto plano (base64)** no etcd. Encryption at rest protege os dados.

### EncryptionConfiguration

\`\`\`yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  - configmaps
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: <base64-encoded-32-byte-key>
  - identity: {}
\`\`\`

### Aplicando Encryption

\`\`\`bash
# 1. Gerar chave de encriptacao
ENCRYPTION_KEY=\$(head -c 32 /dev/urandom | base64)

# 2. Criar arquivo de configuracao
# Salvar como /etc/kubernetes/enc/enc.yaml

# 3. Adicionar flag ao API Server
# --encryption-provider-config=/etc/kubernetes/enc/enc.yaml

# 4. Montar o arquivo no pod do API Server
# volumeMounts e volumes no manifest

# 5. Re-encriptar secrets existentes
kubectl get secrets --all-namespaces -o json | kubectl replace -f -
\`\`\`

### Providers de Encriptacao

| Provider | Seguranca | Performance | Uso |
|----------|-----------|-------------|-----|
| \`identity\` | Nenhuma (texto plano) | Maxima | Padrao (inseguro) |
| \`aescbc\` | Forte | Boa | Recomendado |
| \`aesgcm\` | Forte + autenticacao | Boa | Melhor que aescbc |
| \`secretbox\` | Forte | Boa | Alternativa moderna |
| \`kms\` | Maxima (chave externa) | Variavel | Producao (AWS KMS, etc.) |

**IMPORTANTE**: A ordem dos providers importa. O **primeiro** provider e usado para **encriptar**. Todos sao tentados para **decriptar**.

---

## Configuracao TLS

\`\`\`yaml
    - --tls-cert-file=/etc/kubernetes/pki/apiserver.crt
    - --tls-private-key-file=/etc/kubernetes/pki/apiserver.key
    - --client-ca-file=/etc/kubernetes/pki/ca.crt
    - --kubelet-certificate-authority=/etc/kubernetes/pki/ca.crt
    - --kubelet-client-certificate=/etc/kubernetes/pki/apiserver-kubelet-client.crt
    - --kubelet-client-key=/etc/kubernetes/pki/apiserver-kubelet-client.key
    - --etcd-cafile=/etc/kubernetes/pki/etcd/ca.crt
    - --etcd-certfile=/etc/kubernetes/pki/apiserver-etcd-client.crt
    - --etcd-keyfile=/etc/kubernetes/pki/apiserver-etcd-client.key
\`\`\`

---

## Restringindo Acesso ao etcd

O etcd contem TODOS os dados do cluster. Acesso direto ao etcd e equivalente a acesso root.

\`\`\`bash
# Verificar que etcd aceita apenas conexoes TLS
etcdctl --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/apiserver-etcd-client.crt \\
  --key=/etc/kubernetes/pki/apiserver-etcd-client.key \\
  member list
\`\`\`

Boas praticas:
- etcd apenas acessivel pelo API Server
- Firewall bloqueando porta 2379/2380 de fontes externas
- TLS mutuo entre API Server e etcd
- Backup encriptado do etcd

---

## Audit Logging no API Server

\`\`\`yaml
    - --audit-policy-file=/etc/kubernetes/audit/policy.yaml
    - --audit-log-path=/var/log/kubernetes/audit.log
    - --audit-log-maxage=30
    - --audit-log-maxbackup=10
    - --audit-log-maxsize=100
\`\`\`

---

## Erros Comuns

1. **anonymous-auth habilitado** — primeira flag a verificar
2. **Usar static token files** — inseguro, preferir certificados ou OIDC
3. **Nao habilitar NodeRestriction** — permite kubelet comprometido afetar outros nodes
4. **Secrets sem encryption at rest** — base64 nao e encriptacao
5. **Profiling habilitado** — vaza informacoes de performance e stack traces
6. **identity como primeiro provider** — dados gravados sem encriptacao

---

## Killer.sh Style Challenge

> O API Server do cluster esta com --anonymous-auth=true e sem encryption at rest. Configure --anonymous-auth=false, habilite encryption at rest com aescbc para Secrets, e habilite o admission controller NodeRestriction. Valide todas as mudancas.
`,

  quiz: [
    {
      question: 'Qual flag desabilita acesso anonimo ao API Server?',
      options: ['--disable-anonymous', '--anonymous-auth=false', '--no-anonymous', '--auth-mode=none'],
      correct: 1,
      explanation: 'A flag --anonymous-auth=false desabilita requests anonimos ao API Server. Por padrao, anonymous-auth e true em muitas instalacoes.',
      reference: 'Conceito relacionado: API Server — flags de autenticacao.'
    },
    {
      question: 'Qual admission controller restringe o que o kubelet pode modificar?',
      options: ['PodSecurity', 'NodeRestriction', 'AlwaysPullImages', 'LimitRanger'],
      correct: 1,
      explanation: 'NodeRestriction limita o kubelet a modificar apenas seus proprios Node objects e pods scheduled para ele. Previne que um kubelet comprometido afete outros nodes.',
      reference: 'Conceito relacionado: Admission Controllers — seguranca de nodes.'
    },
    {
      question: 'Qual provider de encriptacao oferece a maior seguranca para encryption at rest?',
      options: ['identity', 'aescbc', 'aesgcm', 'kms'],
      correct: 3,
      explanation: 'KMS (Key Management Service) e o mais seguro pois a chave de encriptacao e gerenciada externamente (AWS KMS, GCP Cloud KMS, Azure Key Vault), nunca ficando no disco do node.',
      reference: 'Conceito relacionado: Encryption at rest — providers.'
    },
    {
      question: 'Na EncryptionConfiguration, qual a importancia da ordem dos providers?',
      options: [
        'Nao importa, todos sao usados igualmente',
        'O primeiro provider e usado para encriptar, todos sao tentados para decriptar',
        'O ultimo provider tem prioridade',
        'A ordem define a velocidade de encriptacao'
      ],
      correct: 1,
      explanation: 'O primeiro provider na lista e usado para ENCRIPTAR novos dados. Para DECRIPTAR, todos os providers sao tentados em ordem ate um conseguir. Se identity e o primeiro, dados sao gravados sem encriptacao.',
      reference: 'Conceito relacionado: EncryptionConfiguration — ordem de providers.'
    },
    {
      question: 'Por que --profiling=false e importante para seguranca?',
      options: [
        'Reduz uso de CPU',
        'Previne vazamento de informacoes de performance e stack traces',
        'Desabilita metricas do Prometheus',
        'Impede debug remoto'
      ],
      correct: 1,
      explanation: 'O endpoint de profiling (/debug/pprof) pode vazar informacoes sensiveis como stack traces, goroutines e memory profiles que ajudam atacantes a entender o sistema.',
      reference: 'Conceito relacionado: API Server — surface area reduction.'
    },
    {
      question: 'Qual admission controller forca que imagens de container sejam sempre baixadas do registry?',
      options: ['ImagePolicyWebhook', 'AlwaysPullImages', 'PodSecurity', 'ValidatingAdmissionWebhook'],
      correct: 1,
      explanation: 'AlwaysPullImages muda a imagePullPolicy para Always em todos os pods. Isso garante que imagens cached nao sejam usadas sem verificacao e previne acesso a imagens privadas via cache.',
      reference: 'Conceito relacionado: Admission Controllers — controle de imagens.'
    },
    {
      question: 'Como re-encriptar secrets existentes apos habilitar encryption at rest?',
      options: [
        'Reiniciar o API Server automaticamente re-encripta',
        'kubectl get secrets -A -o json | kubectl replace -f -',
        'etcdctl defrag',
        'kubectl rollout restart deployment -A'
      ],
      correct: 1,
      explanation: 'Secrets existentes foram gravados antes da encriptacao. E necessario le-los e regrava-los para que sejam encriptados com o novo provider: kubectl get secrets -A -o json | kubectl replace -f -.',
      reference: 'Conceito relacionado: Encryption at rest — migracao.'
    }
  ],

  flashcards: [
    { front: 'Onde fica o manifest do API Server?', back: '/etc/kubernetes/manifests/kube-apiserver.yaml. E um static pod gerenciado pelo kubelet. Mudancas no arquivo sao aplicadas automaticamente (kubelet detecta e recria o pod).' },
    { front: 'O que e encryption at rest no Kubernetes?', back: 'Encriptacao dos dados armazenados no etcd. Configurado via EncryptionConfiguration com providers como aescbc, aesgcm, kms. Sem isso, Secrets sao armazenados em base64 (texto plano).' },
    { front: 'O que o admission controller NodeRestriction faz?', back: 'Limita o kubelet a: modificar apenas seu proprio Node object, modificar pods scheduled para ele, e usar apenas labels com prefixo node-restriction.kubernetes.io/. Previne lateral movement.' },
    { front: 'Por que base64 nao e encriptacao?', back: 'Base64 e apenas encoding (codificacao), nao encriptacao. Qualquer pessoa pode decodificar base64. Secrets do K8s sao base64 por padrao, o que significa que sao texto plano no etcd sem encryption at rest.' },
    { front: 'O que o AlwaysPullImages admission controller faz?', back: 'Forca imagePullPolicy: Always em todos os containers. Beneficios: garante autenticacao com o registry, previne uso de imagens cached nao autorizadas, garante que a imagem mais recente e usada.' },
    { front: 'Como funciona a EncryptionConfiguration?', back: 'Define providers de encriptacao por tipo de recurso. O primeiro provider encripta novos dados. Todos sao tentados para decriptar. Requer flag --encryption-provider-config no API Server e mount do arquivo.' },
    { front: 'Quais modos de autorizacao o API Server suporta?', back: 'Node (kubelet access), RBAC (role-based), Webhook (externo), ABAC (attribute-based, legacy), AlwaysAllow (inseguro), AlwaysDeny. Recomendado: --authorization-mode=Node,RBAC.' },
    { front: 'Como verificar se encryption at rest esta funcionando?', back: 'Ler diretamente do etcd: etcdctl get /registry/secrets/<ns>/<name> | hexdump -C. Se estiver encriptado, vera prefixo k8s:enc:aescbc:v1: ao inves de texto legivel.' }
  ],

  lab: {
    scenario: 'O API Server do cluster tem configuracoes inseguras que precisam ser corrigidas: anonymous auth habilitado, sem encryption at rest, e faltam admission controllers.',
    objective: 'Configurar o API Server com seguranca: desabilitar anonymous auth, habilitar encryption at rest, e adicionar admission controllers.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Auditar Configuracao Atual do API Server',
        instruction: 'Verifique as flags atuais do API Server e identifique problemas de seguranca.',
        hints: [
          'O manifest fica em /etc/kubernetes/manifests/kube-apiserver.yaml',
          'Verifique flags de autenticacao, autorizacao e admission',
          'Procure por flags ausentes que deveriam estar presentes'
        ],
        solution: '```bash\n# Ver flags do API Server\ncat /etc/kubernetes/manifests/kube-apiserver.yaml | grep -E \"anonymous-auth|profiling|authorization-mode|enable-admission|encryption-provider\"\n\n# Ou via processo\nps aux | grep kube-apiserver | tr \" \" \"\\n\" | grep -E \"anonymous|profiling|admission|encryption\"\n```',
        verify: '```bash\n# Verificar que o API Server esta rodando\nkubectl get pods -n kube-system | grep kube-apiserver\n# Saida esperada: kube-apiserver-<node> Running\n\n# Verificar flags\nkubectl -n kube-system get pod kube-apiserver-$(hostname) -o yaml | grep -E \"anonymous|profiling|admission\"\n```'
      },
      {
        title: 'Desabilitar Anonymous Auth e Profiling',
        instruction: 'Edite o manifest do API Server para desabilitar autenticacao anonima e profiling.',
        hints: [
          'Edite /etc/kubernetes/manifests/kube-apiserver.yaml',
          'Adicione --anonymous-auth=false',
          'Adicione --profiling=false',
          'O kubelet recria o pod automaticamente'
        ],
        solution: '```bash\n# Editar manifest\nsudo vi /etc/kubernetes/manifests/kube-apiserver.yaml\n\n# Adicionar/modificar estas flags:\n#   - --anonymous-auth=false\n#   - --profiling=false\n\n# Aguardar API Server reiniciar\nkubectl wait --for=condition=Ready pod/kube-apiserver-$(hostname) -n kube-system --timeout=120s\n```',
        verify: '```bash\n# Verificar que anonymous auth esta desabilitado\nps aux | grep kube-apiserver | grep \"anonymous-auth=false\"\n# Saida esperada: linha com --anonymous-auth=false\n\n# Verificar que profiling esta desabilitado\nps aux | grep kube-apiserver | grep \"profiling=false\"\n# Saida esperada: linha com --profiling=false\n\n# Testar acesso anonimo (deve falhar)\ncurl -sk https://localhost:6443/api/v1/namespaces\n# Saida esperada: Unauthorized\n```'
      },
      {
        title: 'Habilitar Encryption at Rest',
        instruction: 'Configure encryption at rest para Secrets usando o provider aescbc.',
        hints: [
          'Gere uma chave com head -c 32 /dev/urandom | base64',
          'Crie EncryptionConfiguration em /etc/kubernetes/enc/',
          'Adicione --encryption-provider-config ao API Server',
          'Monte o arquivo como volume'
        ],
        solution: '```bash\n# Gerar chave\nENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64)\n\n# Criar diretorio\nsudo mkdir -p /etc/kubernetes/enc\n\n# Criar configuracao\nsudo tee /etc/kubernetes/enc/enc.yaml <<EOF\napiVersion: apiserver.config.k8s.io/v1\nkind: EncryptionConfiguration\nresources:\n- resources:\n  - secrets\n  providers:\n  - aescbc:\n      keys:\n      - name: key1\n        secret: ${ENCRYPTION_KEY}\n  - identity: {}\nEOF\n\n# Adicionar ao API Server manifest:\n#   --encryption-provider-config=/etc/kubernetes/enc/enc.yaml\n# E adicionar volumeMount e volume correspondentes\n\n# Re-encriptar secrets existentes\nkubectl get secrets --all-namespaces -o json | kubectl replace -f -\n```',
        verify: '```bash\n# Verificar que encryption esta configurado\nps aux | grep kube-apiserver | grep encryption-provider-config\n# Saida esperada: --encryption-provider-config=/etc/kubernetes/enc/enc.yaml\n\n# Criar secret de teste\nkubectl create secret generic test-enc --from-literal=key=value\n\n# Verificar no etcd (se tiver acesso)\nsudo ETCDCTL_API=3 etcdctl get /registry/secrets/default/test-enc \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/apiserver-etcd-client.crt \\\n  --key=/etc/kubernetes/pki/apiserver-etcd-client.key | hexdump -C | head\n# Saida esperada: deve conter k8s:enc:aescbc:v1: (encriptado)\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'API Server Nao Inicia Apos Mudanca no Manifest',
      difficulty: 'medium',
      symptom: 'Apos editar kube-apiserver.yaml, o API Server nao reinicia e kubectl para de funcionar.',
      diagnosis: '```bash\n# Verificar logs do container\nsudo crictl ps -a | grep kube-apiserver\nsudo crictl logs <container-id>\n\n# Verificar logs do kubelet (que gerencia static pods)\nsudo journalctl -u kubelet --since \"5 minutes ago\" | grep apiserver\n\n# Verificar YAML syntax\nsudo python3 -c \"import yaml; yaml.safe_load(open(\\\"/etc/kubernetes/manifests/kube-apiserver.yaml\\\"))\"\n```',
      solution: 'Causas comuns: 1) Erro de YAML syntax (indentacao, caracteres invalidos). 2) Path do arquivo de encriptacao incorreto ou arquivo nao existe. 3) Volume mount ausente para o arquivo de encriptacao. 4) Chave de encriptacao invalida (deve ser base64 de 32 bytes). Restaure o backup do manifest e aplique as mudancas novamente.'
    },
    {
      title: 'Secrets Inacessiveis Apos Habilitar Encryption',
      difficulty: 'hard',
      symptom: 'Apos habilitar encryption at rest, secrets existentes retornam erro ao serem lidos.',
      diagnosis: '```bash\n# Tentar ler um secret\nkubectl get secret <name> -o yaml\n\n# Verificar logs do API Server\nkubectl logs -n kube-system kube-apiserver-$(hostname) | grep -i encrypt\n\n# Verificar configuracao de encriptacao\ncat /etc/kubernetes/enc/enc.yaml\n```',
      solution: 'Se o provider identity nao esta na lista de providers, o API Server nao consegue decriptar secrets que foram gravados sem encriptacao. Solucao: adicione "- identity: {}" como ULTIMO provider na lista. Isso permite decriptar dados antigos (texto plano) enquanto novos dados sao encriptados com o primeiro provider.'
    }
  ]
};
