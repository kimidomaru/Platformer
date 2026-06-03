window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-cluster-hardening/serviceaccount-hardening'] = {

  theory: `# ServiceAccount Hardening

## Relevancia no CKS
> O dominio "Cluster Hardening" vale **15%** do CKS. ServiceAccounts sao a identidade dos pods no Kubernetes. Configuracoes incorretas permitem escalacao de privilegios e movimentacao lateral.

---

## ServiceAccounts no Kubernetes

Cada namespace tem um ServiceAccount \`default\` criado automaticamente. Por padrao, pods usam esse SA e recebem um token montado automaticamente.

\`\`\`bash
# Listar ServiceAccounts
kubectl get sa -n default

# Ver detalhes
kubectl get sa default -o yaml
\`\`\`

---

## Problema: Token Automatico

Por padrao, o Kubernetes monta o token do SA em todos os pods:

\`\`\`text
/var/run/secrets/kubernetes.io/serviceaccount/
  ├── token      ← JWT para autenticar na API
  ├── ca.crt     ← CA do cluster
  └── namespace  ← Namespace do pod
\`\`\`

Se o pod for comprometido, o atacante pode usar esse token para acessar a API.

---

## Hardening #1: Desabilitar Automount

### No ServiceAccount

\`\`\`yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  namespace: default
automountServiceAccountToken: false
\`\`\`

### No Pod (override do SA)

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  serviceAccountName: my-app-sa
  automountServiceAccountToken: false
  containers:
  - name: app
    image: nginx:1.25-alpine
\`\`\`

**Prioridade**: A configuracao no Pod tem precedencia sobre a do ServiceAccount.

---

## Hardening #2: Bound Service Account Tokens

Desde Kubernetes 1.22+, tokens sao **bound** (vinculados) por padrao:

| Caracteristica | Legacy Token | Bound Token |
|---------------|-------------|-------------|
| Expiracao | Nunca expira | Expira (1h por padrao, renovado) |
| Audience | Qualquer | Especifica (API Server) |
| Vinculado a | Apenas SA | SA + Pod + Secret |
| Revogacao | So deletando o Secret | Automatica quando pod e deletado |

### TokenRequest API

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-token
spec:
  serviceAccountName: my-app-sa
  containers:
  - name: app
    image: my-app:latest
    volumeMounts:
    - name: token
      mountPath: /var/run/secrets/tokens
      readOnly: true
  volumes:
  - name: token
    projected:
      sources:
      - serviceAccountToken:
          path: token
          expirationSeconds: 3600
          audience: vault
\`\`\`

### Solicitar Token via CLI

\`\`\`bash
# Criar token com expiracao
kubectl create token my-app-sa --duration=1h

# Criar token com audience especifica
kubectl create token my-app-sa --audience=vault --duration=30m
\`\`\`

---

## Hardening #3: SA Dedicado por Workload

\`\`\`bash
# Criar SA dedicado (nao usar default)
kubectl create serviceaccount app-reader -n production

# Criar Role com permissoes minimas
kubectl create role app-reader-role \\
  --namespace=production \\
  --verb=get,list \\
  --resource=configmaps

# Vincular Role ao SA
kubectl create rolebinding app-reader-binding \\
  --namespace=production \\
  --role=app-reader-role \\
  --serviceaccount=production:app-reader
\`\`\`

\`\`\`yaml
# Pod usando SA dedicado
apiVersion: v1
kind: Pod
metadata:
  name: my-app
  namespace: production
spec:
  serviceAccountName: app-reader
  automountServiceAccountToken: true  # so se realmente precisar
  containers:
  - name: app
    image: my-app:latest
\`\`\`

---

## Hardening #4: Restringir Default SA

\`\`\`bash
# Desabilitar automount no SA default de cada namespace
kubectl patch serviceaccount default -n <namespace> \\
  -p '{"automountServiceAccountToken": false}'

# Fazer para todos os namespaces
for ns in \$(kubectl get ns -o jsonpath='{.items[*].metadata.name}'); do
  kubectl patch serviceaccount default -n \$ns \\
    -p '{"automountServiceAccountToken": false}'
done
\`\`\`

---

## Hardening #5: Limpar Tokens Legados

\`\`\`bash
# Encontrar secrets de tokens legados
kubectl get secrets -A -o json | \\
  jq '.items[] | select(.type=="kubernetes.io/service-account-token") | "\\(.metadata.namespace)/\\(.metadata.name)"'

# Verificar se estao em uso
kubectl get pods -A -o json | \\
  jq '.items[] | select(.spec.volumes[]?.secret.secretName) | "\\(.metadata.namespace)/\\(.metadata.name)"'
\`\`\`

---

## Workload Identity (Cloud)

Em ambientes cloud, use Workload Identity para associar identidade IAM diretamente ao SA:

\`\`\`yaml
# AWS IRSA (IAM Roles for Service Accounts)
apiVersion: v1
kind: ServiceAccount
metadata:
  name: s3-reader
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/s3-reader-role
\`\`\`

---

## Erros Comuns

1. **Usar SA default para tudo** — criar SAs dedicados
2. **Nao desabilitar automount** — montar token so quando necessario
3. **Tokens sem expiracao** — usar bound tokens com TTL
4. **RBAC excessivo no SA** — principio do menor privilegio
5. **Ignorar SA default em novos namespaces** — patch automaticamente

---

## Killer.sh Style Challenge

> Crie um ServiceAccount \`restricted-sa\` no namespace \`secure\` com automount desabilitado. Crie um pod que usa esse SA e solicita um token com expiracao de 1 hora e audience \`api\`. Garanta que o SA default do namespace nao monta token automaticamente.
`,

  quiz: [
    {
      question: 'Qual campo desabilita a montagem automatica do token do ServiceAccount?',
      options: ['disableToken: true', 'automountServiceAccountToken: false', 'mountToken: false', 'tokenAutoMount: disabled'],
      correct: 1,
      explanation: 'automountServiceAccountToken: false impede que o token do SA seja montado automaticamente nos pods. Pode ser definido no SA ou no Pod spec.',
      reference: 'Conceito relacionado: ServiceAccount — automount token.'
    },
    {
      question: 'Qual a vantagem dos Bound Service Account Tokens sobre tokens legados?',
      options: [
        'Sao mais rapidos',
        'Tem expiracao, audience restrita e sao revogados quando o pod e deletado',
        'Sao armazenados encriptados',
        'Funcionam em todos os cloud providers'
      ],
      correct: 1,
      explanation: 'Bound tokens expiram (1h padrao, renovados automaticamente), sao vinculados a pod+SA+audience, e sao revogados automaticamente quando o pod e deletado.',
      reference: 'Conceito relacionado: Bound Service Account Tokens — seguranca.'
    },
    {
      question: 'O que acontece quando automountServiceAccountToken e definido tanto no SA quanto no Pod?',
      options: [
        'O valor do SA tem prioridade',
        'O valor do Pod tem prioridade',
        'E gerado um erro de conflito',
        'Ambos sao ignorados'
      ],
      correct: 1,
      explanation: 'A configuracao no Pod spec tem prioridade sobre a do ServiceAccount. Isso permite overrides por pod quando necessario.',
      reference: 'Conceito relacionado: automountServiceAccountToken — prioridade.'
    },
    {
      question: 'Por que nao se deve usar o ServiceAccount default para workloads?',
      options: [
        'O SA default nao funciona corretamente',
        'Todos os pods no namespace compartilham o mesmo SA, dificultando controle de acesso granular',
        'O SA default nao suporta RBAC',
        'O SA default e removido automaticamente'
      ],
      correct: 1,
      explanation: 'O SA default e compartilhado por todos os pods do namespace. Se um RBAC for aplicado ao SA default, todos os pods recebem as mesmas permissoes, violando o principio do menor privilegio.',
      reference: 'Conceito relacionado: ServiceAccount — isolamento de identidade.'
    },
    {
      question: 'Como criar um token com expiracao para um ServiceAccount via kubectl?',
      options: [
        'kubectl get token sa-name --ttl=1h',
        'kubectl create token sa-name --duration=1h',
        'kubectl token create sa-name --expiry=1h',
        'kubectl auth token sa-name --timeout=1h'
      ],
      correct: 1,
      explanation: 'kubectl create token <sa-name> --duration=<time> cria um token bound com a duracao especificada. Tambem aceita --audience para restringir o audience.',
      reference: 'Conceito relacionado: TokenRequest API — kubectl.'
    },
    {
      question: 'Onde o token do ServiceAccount e montado por padrao nos pods?',
      options: [
        '/etc/kubernetes/tokens/',
        '/var/run/secrets/kubernetes.io/serviceaccount/',
        '/opt/kubernetes/sa/',
        '/tmp/k8s/token/'
      ],
      correct: 1,
      explanation: 'O token e montado em /var/run/secrets/kubernetes.io/serviceaccount/ contendo: token (JWT), ca.crt (CA do cluster) e namespace.',
      reference: 'Conceito relacionado: ServiceAccount — token mount path.'
    },
    {
      question: 'O que e o campo audience em um bound service account token?',
      options: [
        'O namespace do SA',
        'O destinatario pretendido do token, limitando onde pode ser usado',
        'O grupo do usuario',
        'A versao da API'
      ],
      correct: 1,
      explanation: 'O audience define para quem o token e valido. Um token com audience "vault" so sera aceito pelo Vault, nao pelo API Server. Isso limita o blast radius de um token comprometido.',
      reference: 'Conceito relacionado: Bound tokens — audience restriction.'
    }
  ],

  flashcards: [
    { front: 'O que e automountServiceAccountToken?', back: 'Campo booleano que controla se o token do ServiceAccount e montado automaticamente nos pods. Setar false impede a montagem. Pode ser definido no SA ou no Pod (Pod tem prioridade).' },
    { front: 'O que sao Bound Service Account Tokens?', back: 'Tokens vinculados a pod+SA+audience com expiracao (1h padrao). Introduzidos como padrao no K8s 1.22+. Sao revogados quando o pod e deletado, ao contrario de tokens legados que nunca expiram.' },
    { front: 'Como desabilitar automount no SA default de um namespace?', back: 'kubectl patch serviceaccount default -n <ns> -p \'{"automountServiceAccountToken": false}\'. Fazer para cada namespace do cluster.' },
    { front: 'O que e a TokenRequest API?', back: 'API que gera tokens bound com expiracao e audience customizados. Usada via kubectl create token ou via projected volume no pod spec.' },
    { front: 'Por que usar SAs dedicados por workload?', back: 'Permite RBAC granular por aplicacao. O SA default e compartilhado por todos os pods do namespace, impedindo controle de acesso individualizado.' },
    { front: 'O que e IRSA/Workload Identity?', back: 'Mecanismo que associa roles IAM do cloud provider diretamente a ServiceAccounts K8s. AWS: IRSA (annotation eks.amazonaws.com/role-arn). GCP: Workload Identity. Azure: AKS Workload Identity.' },
    { front: 'Como encontrar tokens legados (non-bound) no cluster?', back: 'kubectl get secrets -A -o json | jq \'.items[] | select(.type==\"kubernetes.io/service-account-token\")\'. Tokens legados sao armazenados como Secrets e nunca expiram.' }
  ],

  lab: {
    scenario: 'O cluster usa o ServiceAccount default para todas as aplicacoes e tokens sao montados automaticamente em todos os pods. Voce precisa aplicar hardening nos ServiceAccounts.',
    objective: 'Criar SAs dedicados, desabilitar automount no default, e usar bound tokens com expiracao.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Desabilitar Automount no SA Default',
        instruction: 'Patch o ServiceAccount default no namespace `default` para nao montar token automaticamente.',
        hints: [
          'Use kubectl patch serviceaccount',
          'O campo e automountServiceAccountToken: false',
          'Verifique com kubectl get sa default -o yaml'
        ],
        solution: '```bash\n# Patch SA default\nkubectl patch serviceaccount default \\\n  -p \'{"automountServiceAccountToken": false}\'\n\n# Verificar\nkubectl get sa default -o yaml | grep automount\n```',
        verify: '```bash\n# Verificar que automount esta false\nkubectl get sa default -o jsonpath=\'{.automountServiceAccountToken}\'\n# Saida esperada: false\n\n# Testar: criar pod sem especificar SA\nkubectl run test-default --image=nginx:1.25-alpine --restart=Never\nkubectl exec test-default -- ls /var/run/secrets/kubernetes.io/serviceaccount/ 2>/dev/null || echo \"Token nao montado (correto)\"\nkubectl delete pod test-default\n```'
      },
      {
        title: 'Criar ServiceAccount Dedicado',
        instruction: 'Crie um ServiceAccount dedicado `app-sa` com automount desabilitado e vincule uma Role que permite apenas get/list em configmaps.',
        hints: [
          'Use kubectl create serviceaccount',
          'Crie uma Role e um RoleBinding',
          'O SA deve ter automountServiceAccountToken: false'
        ],
        solution: '```bash\n# Criar SA\nkubectl create serviceaccount app-sa\nkubectl patch serviceaccount app-sa \\\n  -p \'{"automountServiceAccountToken": false}\'\n\n# Criar Role\nkubectl create role configmap-reader \\\n  --verb=get,list \\\n  --resource=configmaps\n\n# Criar RoleBinding\nkubectl create rolebinding app-sa-binding \\\n  --role=configmap-reader \\\n  --serviceaccount=default:app-sa\n```',
        verify: '```bash\n# Verificar SA\nkubectl get sa app-sa -o jsonpath=\'{.automountServiceAccountToken}\'\n# Saida esperada: false\n\n# Verificar permissoes\nkubectl auth can-i list configmaps --as=system:serviceaccount:default:app-sa\n# Saida esperada: yes\n\nkubectl auth can-i list secrets --as=system:serviceaccount:default:app-sa\n# Saida esperada: no\n```'
      },
      {
        title: 'Pod com Bound Token e Audience',
        instruction: 'Crie um Pod que usa o SA `app-sa` e solicita um bound token com expiracao de 1 hora e audience `api`.',
        hints: [
          'Use projected volume com serviceAccountToken',
          'Defina expirationSeconds e audience',
          'Monte em um path customizado'
        ],
        solution: '```bash\nkubectl apply -f - <<EOF\napiVersion: v1\nkind: Pod\nmetadata:\n  name: app-with-bound-token\nspec:\n  serviceAccountName: app-sa\n  automountServiceAccountToken: false\n  containers:\n  - name: app\n    image: nginx:1.25-alpine\n    volumeMounts:\n    - name: bound-token\n      mountPath: /var/run/secrets/tokens\n      readOnly: true\n  volumes:\n  - name: bound-token\n    projected:\n      sources:\n      - serviceAccountToken:\n          path: token\n          expirationSeconds: 3600\n          audience: api\nEOF\n```',
        verify: '```bash\n# Verificar que o pod esta rodando\nkubectl get pod app-with-bound-token\n# Saida esperada: Running\n\n# Verificar que o token bound esta montado\nkubectl exec app-with-bound-token -- cat /var/run/secrets/tokens/token | cut -d. -f2 | base64 -d 2>/dev/null | head -c 200\n# Saida esperada: JSON com exp (expiracao) e aud (audience \"api\")\n\n# Verificar que o token DEFAULT nao esta montado\nkubectl exec app-with-bound-token -- ls /var/run/secrets/kubernetes.io/serviceaccount/ 2>/dev/null || echo \"Default token NAO montado (correto)\"\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod Nao Consegue Acessar API Apos Desabilitar Automount',
      difficulty: 'easy',
      symptom: 'Apos setar automountServiceAccountToken: false, a aplicacao no pod retorna erro 401 Unauthorized ao acessar a API do Kubernetes.',
      diagnosis: '```bash\n# Verificar se o token esta montado\nkubectl exec <pod> -- ls /var/run/secrets/kubernetes.io/serviceaccount/\n\n# Verificar configuracao do SA\nkubectl get sa <sa-name> -o yaml | grep automount\n\n# Verificar configuracao do pod\nkubectl get pod <pod> -o yaml | grep automount\n```',
      solution: 'Se a aplicacao precisa acessar a API, ha 2 opcoes: 1) Setar automountServiceAccountToken: true APENAS no Pod (override o SA). 2) Usar projected volume com bound token para controle granular (expiracao, audience). A opcao 2 e mais segura.'
    },
    {
      title: 'Token Legado Nao Expira e Permite Acesso Apos Deletar Pod',
      difficulty: 'hard',
      symptom: 'Um token de ServiceAccount continua funcionando mesmo apos o pod que o usava ser deletado.',
      diagnosis: '```bash\n# Verificar tipo do token\nkubectl get secrets -o json | \\\n  jq \'.items[] | select(.type==\"kubernetes.io/service-account-token\") | .metadata.name\'\n\n# Verificar se e token legado (stored in Secret)\nkubectl get secret <token-secret> -o yaml\n\n# Testar se o token ainda funciona\ncurl -sk -H \"Authorization: Bearer <token>\" https://<api-server>:6443/api/v1/namespaces\n```',
      solution: 'Tokens legados (armazenados como Secrets do tipo kubernetes.io/service-account-token) nunca expiram e nao sao revogados quando pods sao deletados. Para resolver: 1) Deletar o Secret do token legado. 2) Migrar para bound tokens (projected volumes). 3) Auditar e remover todos os token Secrets legados do cluster.'
    }
  ]
};
