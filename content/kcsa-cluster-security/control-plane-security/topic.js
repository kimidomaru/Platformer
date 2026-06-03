window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcsa-cluster-security/control-plane-security'] = {

  theory: `# Control Plane Component Security

## Relevancia no KCSA
> O dominio "Kubernetes Cluster Component Security" vale **22%** do KCSA. Entender como proteger cada componente do control plane — API Server, etcd, controller-manager e scheduler — e essencial para o exame.

---

## Componentes do Control Plane

\`\`\`text
┌─────────────────────────────────────────────────┐
│                CONTROL PLANE                     │
│                                                  │
│  ┌─────────────┐    ┌──────────────────────┐    │
│  │  kube-apiserver  │  controller-manager   │    │
│  │  (porta 6443)│    │  (porta 10257)       │    │
│  └──────┬──────┘    └──────────────────────┘    │
│         │                                         │
│  ┌──────▼──────┐    ┌──────────────────────┐    │
│  │    etcd      │    │     kube-scheduler   │    │
│  │  (porta 2379)│    │     (porta 10259)    │    │
│  └─────────────┘    └──────────────────────┘    │
└─────────────────────────────────────────────────┘
\`\`\`

---

## API Server Security

O **kube-apiserver** e o unico ponto de entrada para o cluster. Todas as operacoes passam por ele.

### Flags de Seguranca Essenciais

| Flag | Valor Seguro | Descricao |
|------|-------------|-----------|
| \`--anonymous-auth\` | \`false\` | Desabilita acesso anonimo |
| \`--authorization-mode\` | \`Node,RBAC\` | Habilita RBAC e Node authorizer |
| \`--enable-admission-plugins\` | Ver lista abaixo | Admission controllers ativos |
| \`--audit-log-path\` | \`/var/log/audit.log\` | Habilita audit logging |
| \`--audit-policy-file\` | \`/etc/k8s/audit-policy.yaml\` | Politica de auditoria |
| \`--tls-cert-file\` | Certificado TLS | TLS obrigatorio |
| \`--tls-private-key-file\` | Chave privada TLS | TLS obrigatorio |
| \`--client-ca-file\` | CA certificate | Autenticacao por certificado |
| \`--etcd-cafile\` | CA do etcd | TLS para etcd |
| \`--etcd-certfile\` | Cert cliente etcd | mTLS com etcd |
| \`--etcd-keyfile\` | Key cliente etcd | mTLS com etcd |
| \`--profiling\` | \`false\` | Desabilita endpoint /debug/pprof |
| \`--insecure-port\` | \`0\` | Desabilita porta HTTP insegura (ja default) |
| \`--service-account-key-file\` | Chave para verificar SA tokens | Seguranca de SA tokens |
| \`--encryption-provider-config\` | Arquivo de encriptacao | Encryption at rest |

### Admission Controllers Recomendados

\`\`\`text
--enable-admission-plugins=\
  NodeRestriction,\
  PodSecurity,\
  ServiceAccount,\
  ResourceQuota,\
  LimitRanger,\
  AlwaysPullImages,\
  DenyServiceExternalIPs
\`\`\`

| Admission Controller | Funcao |
|---------------------|--------|
| **NodeRestriction** | Restringe o que kubelets podem modificar |
| **PodSecurity** | Aplica Pod Security Standards |
| **AlwaysPullImages** | Forca pull de imagens (verifica credenciais) |
| **ServiceAccount** | Garante que SA tokens sao validos |
| **DenyServiceExternalIPs** | Previne ExternalIP hijacking |

### Authentication no API Server

| Metodo | Mecanismo | Uso |
|--------|-----------|-----|
| **Certificados X.509** | Client cert assinado pela CA | Admins, componentes do cluster |
| **Bearer Tokens (SA)** | JWT assinado pelo API server | ServiceAccounts, pods |
| **OIDC** | JSON Web Tokens do OIDC provider | Usuarios humanos (SSO) |
| **Webhook** | Delegacao a servico externo | Integracao com IAM cloud |

---

## etcd Security

O **etcd** armazena TODO o estado do cluster, incluindo Secrets. E o ativo mais critico.

### Riscos

- Acesso direto ao etcd bypassa RBAC completamente
- Secrets sao armazenados em base64 (nao encriptados) por padrao
- Backup sem encryption expoe todos os dados

### Protecoes Essenciais

**1. mTLS entre etcd e API Server**
\`\`\`yaml
# No manifesto do etcd (/etc/kubernetes/manifests/etcd.yaml)
- --client-cert-auth=true
- --trusted-ca-file=/etc/kubernetes/pki/etcd/ca.crt
- --cert-file=/etc/kubernetes/pki/etcd/server.crt
- --key-file=/etc/kubernetes/pki/etcd/server.key
- --peer-client-cert-auth=true
\`\`\`

**2. Escutar apenas em loopback ou rede privada**
\`\`\`yaml
- --advertise-client-urls=https://127.0.0.1:2379
- --listen-client-urls=https://127.0.0.1:2379
\`\`\`

**3. Encryption at rest para Secrets**
\`\`\`yaml
# /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: <base64-32-bytes>
  - identity: {}
\`\`\`

Habilitado no API Server com:
\`\`\`
--encryption-provider-config=/etc/kubernetes/encryption-config.yaml
\`\`\`

**Providers de encriptacao (ordem de prioridade para escrita):**

| Provider | Seguranca | Uso |
|----------|-----------|-----|
| \`identity\` | Nenhuma (plaintext) | Leitura de dados legados |
| \`aescbc\` | AES-CBC com HMAC | Padrao recomendado |
| \`aesgcm\` | AES-GCM | Alta performance |
| \`secretbox\` | XSalsa20-Poly1305 | Alternativa moderna |
| \`kms\` | Chave externa (AWS KMS, Vault) | Mais seguro (envelope encryption) |

---

## Controller Manager Security

O **kube-controller-manager** executa os reconciliation loops. Flags de seguranca:

| Flag | Valor Seguro | Descricao |
|------|-------------|-----------|
| \`--use-service-account-credentials\` | \`true\` | SA separada por controller |
| \`--service-account-private-key-file\` | Chave privada | Assinatura de SA tokens |
| \`--root-ca-file\` | CA certificate | CA para verificar tokens |
| \`--profiling\` | \`false\` | Desabilitar pprof profiling |

### Por que \`--use-service-account-credentials=true\`?

Cada controller (deployment-controller, replicaset-controller, etc.) usa uma ServiceAccount dedicada com apenas as permissoes necessarias para seu trabalho, em vez de compartilhar uma unica SA com todos os privilegios.

---

## Scheduler Security

O **kube-scheduler** decide onde pods serao executados. Flags de seguranca:

| Flag | Valor Seguro | Descricao |
|------|-------------|-----------|
| \`--profiling\` | \`false\` | Desabilitar pprof |
| \`--bind-address\` | \`127.0.0.1\` | Escutar apenas localmente |

O scheduler tem menos superficie de ataque que o API Server, mas deve ser protegido pois um atacante com acesso poderia manipular o scheduling de pods.

---

## CIS Kubernetes Benchmark — Control Plane

O **CIS Kubernetes Benchmark** fornece recomendacoes para o control plane:

**Secao 1.1 — API Server (exemplos):**
- 1.1.1: Garantir que apiserver nao usa \`--anonymous-auth=true\`
- 1.1.7: Garantir que \`--authorization-mode\` inclui RBAC
- 1.1.13: Garantir que \`--audit-log-path\` esta configurado
- 1.1.19: Garantir que \`--profiling\` e \`false\`
- 1.1.29: Garantir que \`--encryption-provider-config\` esta configurado

**Secao 1.2 — etcd:**
- 1.2.1: Garantir que \`--client-cert-auth\` e \`true\`
- 1.2.2: Garantir que \`--auto-tls\` nao esta habilitado

---

## Verificando Seguranca do Control Plane

\`\`\`bash
# Ver flags do API Server
kubectl get pod kube-apiserver-<node> -n kube-system -o yaml | grep -A100 "command:"

# Verificar se anonymous auth esta desabilitado
kubectl get pod kube-apiserver-<node> -n kube-system \
  -o jsonpath='{.spec.containers[0].command}' | tr ' ' '\n' | grep anonymous

# Verificar admission plugins
kubectl get pod kube-apiserver-<node> -n kube-system \
  -o jsonpath='{.spec.containers[0].command}' | tr ' ' '\n' | grep admission

# Verificar encryption at rest
kubectl get pod kube-apiserver-<node> -n kube-system \
  -o jsonpath='{.spec.containers[0].command}' | tr ' ' '\n' | grep encryption

# Testar se API anonima esta desabilitada
curl -k https://<api-server>:6443/api/v1/secrets
# Deve retornar 401 Unauthorized (nao 403 Forbidden)
\`\`\`

---

## Erros Comuns no KCSA

1. **Achar que etcd e encriptado por padrao** — e apenas base64, encriptacao requer configuracao
2. **Confundir \`--authorization-mode=AlwaysAllow\`** — modo inseguro, nunca usar em producao
3. **Esquecer que acesso direto ao etcd bypassa RBAC** — proteger etcd e critico
4. **Nao saber os admission controllers essenciais** — NodeRestriction, PodSecurity, AlwaysPullImages
5. **Confundir authentication com authorization** — AuthN (quem voce e?) vem antes de AuthZ (o que pode fazer?)
`,

  quiz: [
    {
      question: 'Qual flag do kube-apiserver deve ser configurado como "false" para desabilitar acesso anonimo?',
      options: ['--allow-anonymous=false', '--anonymous-auth=false', '--disable-anonymous=true', '--auth-mode=deny-anon'],
      correct: 1,
      explanation: '--anonymous-auth=false desabilita requisicoes anonimas ao API Server. Sem isso, qualquer requisicao sem credenciais e tratada como usuario "system:anonymous" do grupo "system:unauthenticated".',
      reference: 'CIS Benchmark 1.1.1: --anonymous-auth deve ser false. Verificar com: kubectl get pod kube-apiserver -n kube-system -o yaml.'
    },
    {
      question: 'Por que o acesso direto ao etcd e critico de ser protegido?',
      options: ['etcd e lento e acesso direto sobrecarrega', 'Acesso direto bypassa completamente o RBAC do Kubernetes', 'etcd so armazena logs do cluster', 'etcd usa HTTP sem TLS'],
      correct: 1,
      explanation: 'etcd armazena todo o estado do cluster incluindo Secrets. Acesso direto bypassa o API Server e todo o sistema de AuthN/AuthZ (RBAC). Um atacante com acesso ao etcd tem acesso a tudo, sem restricao.',
      reference: 'Proteger etcd: mTLS, escutar em 127.0.0.1, encryption at rest. Acesso direto = bypass total do RBAC.'
    },
    {
      question: 'Qual admission controller forca o pull de imagens mesmo que ja existam no cache do node?',
      options: ['NodeRestriction', 'AlwaysPullImages', 'PodSecurity', 'ImagePolicyWebhook'],
      correct: 1,
      explanation: 'AlwaysPullImages forca o pull a cada vez que um pod e criado, garantindo que o registry autentique o acesso. Previne que um pod use imagens cacheadas de outro namespace sem permissao.',
      reference: 'AlwaysPullImages: forca reautenticacao no registry a cada pod creation. Util em ambientes multi-tenant.'
    },
    {
      question: 'Qual provider de encryption at rest para etcd oferece a seguranca mais alta no Kubernetes?',
      options: ['identity (nenhuma encriptacao)', 'aescbc', 'aesgcm', 'kms (envelope encryption com chave externa)'],
      correct: 3,
      explanation: 'KMS (Key Management Service) usa envelope encryption: a chave de encriptacao dos dados e encriptada por uma chave externa gerenciada pelo KMS (AWS KMS, Vault). Compromisso do etcd nao compromete as chaves de encriptacao.',
      reference: 'Providers: identity (nada) < aescbc/secretbox (chave local) < kms (chave externa). KMS = mais seguro mas mais complexo.'
    },
    {
      question: 'O que o flag --use-service-account-credentials=true no controller-manager garante?',
      options: ['Que todos os controllers usam o mesmo SA token', 'Cada controller usa uma ServiceAccount dedicada com o minimo de permissoes necessarias', 'Desabilita o uso de ServiceAccounts', 'Habilita rotacao automatica de tokens'],
      correct: 1,
      explanation: 'Com --use-service-account-credentials=true, cada controller (deployment, replicaset, etc.) usa uma SA dedicada com apenas as permissoes para seu trabalho especifico, implementando principio do menor privilegio.',
      reference: 'CIS Benchmark: --use-service-account-credentials=true. Principio do menor privilegio por controller.'
    },
    {
      question: 'Qual modo de autorizacao e recomendado para o kube-apiserver em producao?',
      options: ['AlwaysAllow', 'AlwaysDeny', 'ABAC', 'Node,RBAC'],
      correct: 3,
      explanation: 'Node,RBAC e o modo recomendado: Node authorizer permite que kubelets acessem recursos necessarios para seus pods, e RBAC controla o acesso de todos os outros usuarios e ServiceAccounts. AlwaysAllow e inseguro.',
      reference: '--authorization-mode=Node,RBAC. Node = restricoes para kubelets. RBAC = controle baseado em roles para usuarios e SAs.'
    },
    {
      question: 'Qual afirmacao sobre encryption at rest de Secrets no etcd e CORRETA?',
      options: ['Secrets sao encriptados por padrao com AES-256', 'Secrets sao armazenados como base64 por padrao, requerendo EncryptionConfiguration para encriptacao real', 'Secrets sao hash-ados com SHA-256', 'TLS no etcd garante encryption at rest'],
      correct: 1,
      explanation: 'Por padrao, Secrets sao armazenados no etcd como base64 (nao e encriptacao). TLS protege a comunicacao (em transito), nao o armazenamento. EncryptionConfiguration com provider aescbc/kms habilita encryption at rest real.',
      reference: 'base64 != encryption. TLS = in transit. EncryptionConfiguration = at rest. Verificar: kubectl get pod kube-apiserver -o yaml | grep encryption.'
    },
    {
      question: 'Qual admission controller restringe o que kubelets podem modificar no API Server?',
      options: ['LimitRanger', 'NodeRestriction', 'PodSecurity', 'ServiceAccount'],
      correct: 1,
      explanation: 'NodeRestriction impede que um kubelet modifique objetos de outros nodes. Garante que um kubelet comprometido nao pode modificar labels ou taints de outros nodes, nem escalar privilegios alem do seu node.',
      reference: 'NodeRestriction: kubelet so pode modificar seu proprio Node e os Pods agendados nele. Previne lateral movement via kubelet.'
    }
  ],

  flashcards: [
    { front: 'Quais as flags mais importantes do kube-apiserver para seguranca?', back: '--anonymous-auth=false, --authorization-mode=Node,RBAC, --audit-log-path, --audit-policy-file, --encryption-provider-config, --profiling=false, --enable-admission-plugins.' },
    { front: 'Por que proteger o etcd e critico?', back: 'etcd armazena TODO o estado do cluster: Secrets, configuracoes, credentials. Acesso direto bypassa RBAC completamente. Protecoes: mTLS, escutar em 127.0.0.1 apenas, encryption at rest, backups encriptados.' },
    { front: 'Quais admission controllers sao essenciais para seguranca?', back: 'NodeRestriction (restringe kubelets), PodSecurity (aplica PSS), AlwaysPullImages (reautenticar no registry), ServiceAccount (valida SAs), DenyServiceExternalIPs (previne ExternalIP hijack).' },
    { front: 'Qual a ordem de providers de encriptacao at rest?', back: 'O primeiro provider na lista e usado para ESCRITA. Os demais sao tentados para LEITURA (dados antigos). Para migrar: adicionar novo provider no inicio, reencriptar, remover o antigo. identity = sem encriptacao.' },
    { front: 'authentication vs authorization no API Server?', back: 'AuthN: quem voce e? (certificado X.509, SA token, OIDC, webhook). AuthZ: o que pode fazer? (RBAC, Node, ABAC, webhook). Admission: validar/modificar apos AuthZ. Ordem: AuthN -> AuthZ -> Admission.' },
    { front: 'O que e envelope encryption com KMS?', back: 'A chave de encriptacao dos dados (DEK) e encriptada por uma Key Encryption Key (KEK) externa no KMS. Se o etcd for comprometido, os dados ficam inuteis sem a KEK do KMS. Mais seguro que aescbc (chave local).' },
    { front: 'O que --use-service-account-credentials=true faz?', back: 'Controller-manager: cada controller (deployment, replicaset, job, etc.) usa sua propria ServiceAccount com permissoes minimas. Sem isso, todos compartilham uma SA com permissoes amplas. CIS Benchmark recommendation.' },
    { front: 'Como verificar flags de seguranca do API Server?', back: 'kubectl get pod kube-apiserver-<node> -n kube-system -o yaml | grep -A100 command. Em clusters kubeadm: /etc/kubernetes/manifests/kube-apiserver.yaml. Flags aparecem como comandos do container.' }
  ],

  lab: {
    scenario: 'Voce e um Security Auditor verificando a seguranca do control plane de um cluster Kubernetes. Precisa identificar flags do API Server, verificar encryption at rest e avaliar admission controllers.',
    objective: 'Auditar configuracoes de seguranca do control plane: flags do API Server, admission controllers e encryption at rest.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Auditar flags do kube-apiserver',
        instruction: 'Examine as flags de seguranca do kube-apiserver para identificar configuracoes seguras e possiveis gaps.',
        hints: ['O manifesto fica em /etc/kubernetes/manifests/ em clusters kubeadm', 'Use kubectl get pod kube-apiserver -n kube-system -o yaml'],
        solution: '```bash\n# Ver flags do API Server via kubectl\nkubectl get pod -n kube-system -l component=kube-apiserver \\\n  -o jsonpath=\'{.items[0].spec.containers[0].command}\' | tr \' \' \'\\n\'\n\n# Verificar flags criticas\nkubectl get pod -n kube-system -l component=kube-apiserver \\\n  -o jsonpath=\'{.items[0].spec.containers[0].command}\' | tr \' \' \'\\n\' | \\\n  grep -E "anonymous-auth|authorization-mode|audit|encryption|admission|profiling"\n\n# Verificar modo de autorizacao\nkubectl get pod -n kube-system -l component=kube-apiserver \\\n  -o jsonpath=\'{.items[0].spec.containers[0].command}\' | tr \' \' \'\\n\' | \\\n  grep authorization-mode\n```',
        verify: '```bash\n# Verificar se RBAC esta habilitado\nkubectl get clusterroles --no-headers | wc -l\n# Saida esperada: > 30 (RBAC ativo tem muitos built-in roles)\n\nkubectl auth can-i create pods\n# Saida esperada: yes (RBAC funcionando)\n```'
      },
      {
        title: 'Verificar Admission Controllers ativos',
        instruction: 'Identifique quais admission controllers estao habilitados e avalie se os recomendados estao presentes.',
        hints: ['Procure --enable-admission-plugins nas flags do apiserver', 'Verifique se NodeRestriction, PodSecurity e AlwaysPullImages estao presentes'],
        solution: '```bash\n# Ver admission controllers habilitados\nkubectl get pod -n kube-system -l component=kube-apiserver \\\n  -o jsonpath=\'{.items[0].spec.containers[0].command}\' | tr \' \' \'\\n\' | \\\n  grep -i admission\n\n# Testar se PSA esta funcionando (tentando criar pod privilegiado em namespace restrito)\nkubectl label namespace default pod-security.kubernetes.io/warn=restricted\nkubectl run test-priv --image=nginx --overrides=\'{\"spec\":{\"containers\":[{\"name\":\"test\",\"image\":\"nginx\",\"securityContext\":{\"privileged\":true}}]}}\' 2>&1\n\n# Verificar webhook admission controllers\nkubectl get validatingadmissionwebhooks\nkubectl get mutatingadmissionwebhooks\n```',
        verify: '```bash\n# Verificar se NodeRestriction esta habilitado\nkubectl get pod -n kube-system -l component=kube-apiserver \\\n  -o jsonpath=\'{.items[0].spec.containers[0].command}\' | tr \' \' \'\\n\' | \\\n  grep -c NodeRestriction\n# Saida esperada: 1 (NodeRestriction presente)\n```'
      },
      {
        title: 'Verificar Encryption at Rest e Audit Logging',
        instruction: 'Verifique se encryption at rest para Secrets e audit logging estao configurados no API Server.',
        hints: ['--encryption-provider-config indica encryption at rest', '--audit-log-path indica audit logging', 'Teste criando um Secret e verificando no etcd (se tiver acesso)'],
        solution: '```bash\n# Verificar encryption at rest\nkubectl get pod -n kube-system -l component=kube-apiserver \\\n  -o jsonpath=\'{.items[0].spec.containers[0].command}\' | tr \' \' \'\\n\' | \\\n  grep encryption\n\n# Verificar audit logging\nkubectl get pod -n kube-system -l component=kube-apiserver \\\n  -o jsonpath=\'{.items[0].spec.containers[0].command}\' | tr \' \' \'\\n\' | \\\n  grep audit\n\n# Criar um secret de teste\nkubectl create secret generic test-encryption --from-literal=password=mysecret\n\n# Se tiver acesso ao etcd, verificar se o secret esta encriptado:\n# ETCDCTL_API=3 etcdctl get /registry/secrets/default/test-encryption \\\n#   --endpoints=https://127.0.0.1:2379 --cacert=... --cert=... --key=...\n# Dados encriptados aparecem como binario ilegivel, nao como YAML legivel\n```',
        verify: '```bash\n# Verificar se o secret foi criado\nkubectl get secret test-encryption\n# Saida esperada: test-encryption Opaque\n\n# Limpar\nkubectl delete secret test-encryption\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'API Server retorna 401 para todas as requisicoes, incluindo kubectl',
      difficulty: 'hard',
      symptom: 'Apos uma manutencao no control plane, todos os comandos kubectl retornam "Unauthorized" (401). Nem o admin consegue acessar o cluster.',
      diagnosis: '**1. Verificar se o API Server esta rodando:**\n```bash\nsystemctl status kubelet\n# Verificar se o static pod do apiserver esta em execucao\nls /etc/kubernetes/manifests/\ndocker ps | grep apiserver  # ou crictl ps | grep apiserver\n```\n\n**2. Verificar logs do API Server:**\n```bash\n# Logs via journalctl\njournalctl -u kubelet | grep apiserver\n\n# Ou via container runtime\ncrictl logs $(crictl ps | grep apiserver | awk \'{print $1}\')\n```\n\n**3. Verificar se os certificados expiraram:**\n```bash\nkubeadm certs check-expiration\n```\n\n**4. Verificar o kubeconfig admin:**\n```bash\nls -la /etc/kubernetes/admin.conf\nopenssl x509 -in /etc/kubernetes/admin.conf -text | grep "Not After"\n```\n\n**5. Verificar se o CA certificate e valido:**\n```bash\nopenssl x509 -in /etc/kubernetes/pki/ca.crt -text | grep -E "Not Before|Not After|Subject"\n```',
      solution: '**Causa mais comum: certificados expirados.**\n\n**Se certificados expiraram:**\n```bash\n# Renovar todos os certificados (kubeadm)\nkubeadm certs renew all\n\n# Reiniciar componentes do control plane\nkubectl -n kube-system rollout restart deployment\n# Ou mover e restaurar manifestos de static pods\n\n# Verificar apos renovacao\nkubeadm certs check-expiration\n```\n\n**Outra causa: arquivo kubeconfig invalido.**\n```bash\n# Gerar novo kubeconfig de admin\nkubeadm kubeconfig user --org system:masters --client-name kubernetes-admin > /etc/kubernetes/admin.conf\n\n# Verificar conexao\nkubectl --kubeconfig=/etc/kubernetes/admin.conf cluster-info\n```\n\n**Nota:** Certificados expiram anualmente em clusters kubeadm por padrao. Usar `kubeadm certs renew` antes da expiracao.'
    },
    {
      title: 'Secrets sao armazenados em plaintext no etcd',
      difficulty: 'medium',
      symptom: 'Auditoria revelou que Secrets do Kubernetes estao armazenados sem encriptacao no etcd. Um backup do etcd expos senhas e tokens em texto legivel.',
      diagnosis: '**1. Verificar se encryption at rest esta configurado:**\n```bash\nkubectl get pod -n kube-system -l component=kube-apiserver \\\n  -o jsonpath=\'{.items[0].spec.containers[0].command}\' | tr \' \' \'\\n\' | grep encryption\n# Se nao retornar nada, encryption at rest NAO esta configurado\n```\n\n**2. Verificar diretamente no etcd (se tiver acesso):**\n```bash\nETCDCTL_API=3 etcdctl get /registry/secrets/default/<secret-name> \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key\n# Se retornar YAML legivel, nao esta encriptado\n# Se retornar binario, esta encriptado\n```',
      solution: '**Configurar encryption at rest:**\n\n**1. Gerar chave de encriptacao:**\n```bash\nhead -c 32 /dev/urandom | base64\n# Guardar este valor como <ENCRYPTION_KEY>\n```\n\n**2. Criar o arquivo de configuracao:**\n```yaml\n# /etc/kubernetes/encryption-config.yaml\napiVersion: apiserver.config.k8s.io/v1\nkind: EncryptionConfiguration\nresources:\n- resources:\n  - secrets\n  providers:\n  - aescbc:\n      keys:\n      - name: key1\n        secret: <ENCRYPTION_KEY>\n  - identity: {}\n```\n\n**3. Adicionar flag ao API Server:**\n```yaml\n# /etc/kubernetes/manifests/kube-apiserver.yaml\n- --encryption-provider-config=/etc/kubernetes/encryption-config.yaml\n```\n\n**4. Reencriptar Secrets existentes:**\n```bash\n# Forcar reescrita de todos os secrets (agora serao encriptados)\nkubectl get secrets --all-namespaces -o json | kubectl replace -f -\n```\n\n**5. Verificar a encriptacao:**\n```bash\n# O valor no etcd agora deve comecar com "k8s:enc:aescbc"\nETCDCTL_API=3 etcdctl get /registry/secrets/default/<secret-name> ...\n```'
    }
  ]
};
