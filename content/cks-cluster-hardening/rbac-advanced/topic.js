window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-cluster-hardening/rbac-advanced'] = {

  theory: `# RBAC Avancado & Hardening

## Relevancia no CKS
> O dominio "Cluster Hardening" vale **15%** do CKS. RBAC avancado e critico para controle de acesso seguro. Voce deve saber identificar permissoes excessivas, prevenir escalacao de privilegios e auditar policies.

---

## Revisao Rapida de RBAC

RBAC usa 4 recursos:
- **Role** / **ClusterRole**: define permissoes (verbs em resources)
- **RoleBinding** / **ClusterRoleBinding**: associa roles a subjects (users, groups, ServiceAccounts)

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
\`\`\`

---

## Principio do Menor Privilegio

### Anti-Patterns (EVITAR)

\`\`\`yaml
# PERIGOSO: wildcard em tudo
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["*"]
\`\`\`

\`\`\`yaml
# PERIGOSO: acesso total a secrets
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list", "watch"]
\`\`\`

### Boas Praticas

\`\`\`yaml
# BOM: permissoes especificas e limitadas
rules:
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
  # Restringir a resources especificos por nome
  resourceNames: ["my-deployment"]
\`\`\`

---

## Escalacao de Privilegios via RBAC

### Verbs Perigosos

| Verb | Risco |
|------|-------|
| \`bind\` | Permite criar RoleBindings para qualquer Role |
| \`escalate\` | Permite adicionar permissoes que o usuario nao tem |
| \`impersonate\` | Permite agir como outro usuario/grupo/SA |
| \`create\` em pods | Pode montar secrets, usar SAs privilegiados |

### Cenario de Escalacao

\`\`\`bash
# Se um usuario pode criar Pods e tem acesso a um SA privilegiado:
# 1. Cria Pod com serviceAccountName de um SA admin
# 2. Exec no pod
# 3. Usa o token do SA admin para acessar a API
# Resultado: escalou de "pode criar pods" para "admin do cluster"
\`\`\`

### Prevencao

\`\`\`yaml
# Restringir quais SAs podem ser usados
# Nao dar create em pods sem restringir SAs
# Usar ValidatingAdmissionPolicy/Webhook para validar
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["create"]
  # NOTA: resourceNames nao funciona com create
  # Use admission controllers para restringir
\`\`\`

---

## Auditando RBAC

### kubectl auth can-i

\`\`\`bash
# Verificar suas permissoes
kubectl auth can-i create pods
kubectl auth can-i delete secrets --namespace kube-system
kubectl auth can-i '*' '*'

# Verificar permissoes de outro usuario
kubectl auth can-i create pods --as=user1
kubectl auth can-i list secrets --as=system:serviceaccount:default:mysa

# Listar TODAS as permissoes
kubectl auth can-i --list
kubectl auth can-i --list --as=user1

# Verificar em namespace especifico
kubectl auth can-i --list --namespace=production --as=user1
\`\`\`

### Identificar Bindings Excessivos

\`\`\`bash
# Encontrar ClusterRoleBindings para cluster-admin
kubectl get clusterrolebindings -o json | \\
  jq '.items[] | select(.roleRef.name=="cluster-admin") | .subjects'

# Listar todos os bindings de um usuario
kubectl get rolebindings,clusterrolebindings -A -o json | \\
  jq '.items[] | select(.subjects[]?.name=="user1")'

# Encontrar roles com wildcard
kubectl get clusterroles -o json | \\
  jq '.items[] | select(.rules[]?.verbs[]? == "*") | .metadata.name'
\`\`\`

---

## ClusterRole Aggregation

ClusterRoles podem agregar regras de outros ClusterRoles via labels:

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring-view
  labels:
    rbac.authorization.k8s.io/aggregate-to-view: "true"
rules:
- apiGroups: ["monitoring.coreos.com"]
  resources: ["prometheuses", "alertmanagers"]
  verbs: ["get", "list", "watch"]
\`\`\`

**Risco**: Qualquer ClusterRole com a label \`aggregate-to-view: "true"\` automaticamente adiciona suas rules ao ClusterRole \`view\`. Um atacante pode criar um ClusterRole com permissoes excessivas e essa label.

---

## Restringindo Acesso a Secrets

\`\`\`yaml
# Em vez de dar acesso a todos os secrets:
# BOM: acesso apenas a secrets especificos
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-secret-reader
  namespace: production
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get"]
  resourceNames: ["app-config", "app-tls"]
\`\`\`

---

## Erros Comuns

1. **Usar cluster-admin para tudo** — criar roles especificos
2. **Wildcards em verbs/resources** — sempre ser explicito
3. **Nao auditar RBAC regularmente** — permissoes acumulam
4. **Ignorar escalacao via pod creation** — criar pods = potencial admin
5. **ClusterRoleBinding quando RoleBinding basta** — preferir namespace-scoped

---

## Killer.sh Style Challenge

> Identifique todos os ClusterRoleBindings que dao acesso \`cluster-admin\`. Remova os desnecessarios. Crie um Role especifico para desenvolvedores que permite apenas get/list em pods e deployments no namespace \`dev\`, sem acesso a secrets.
`,

  quiz: [
    {
      question: 'Qual verb do RBAC permite criar RoleBindings para qualquer Role, mesmo roles mais privilegiadas?',
      options: ['create', 'bind', 'escalate', 'impersonate'],
      correct: 1,
      explanation: 'O verb "bind" permite associar qualquer Role/ClusterRole a um subject via RoleBinding. Isso pode ser usado para escalar privilegios associando roles mais privilegiadas.',
      reference: 'Conceito relacionado: RBAC escalation — verbs perigosos.'
    },
    {
      question: 'Qual comando verifica se um ServiceAccount pode listar secrets?',
      options: [
        'kubectl auth can-i list secrets --as=system:serviceaccount:ns:sa',
        'kubectl auth check sa/sa-name --verb=list --resource=secrets',
        'kubectl rbac verify sa/sa-name secrets list',
        'kubectl get sa sa-name --check-permissions'
      ],
      correct: 0,
      explanation: 'kubectl auth can-i com --as= permite verificar permissoes de qualquer subject. Para SAs, use o formato system:serviceaccount:<namespace>:<name>.',
      reference: 'Conceito relacionado: kubectl auth can-i — auditoria de permissoes.'
    },
    {
      question: 'Por que dar permissao de "create pods" pode levar a escalacao de privilegios?',
      options: [
        'Pods podem executar qualquer binario',
        'O usuario pode criar um Pod usando um ServiceAccount privilegiado e acessar seu token',
        'Pods automaticamente tem acesso cluster-admin',
        'Create pods inclui permissao de delete'
      ],
      correct: 1,
      explanation: 'Um usuario com "create pods" pode especificar serviceAccountName de um SA privilegiado, fazer exec no pod e usar o token montado para acessar a API com privilegios elevados.',
      reference: 'Conceito relacionado: RBAC — cenarios de escalacao.'
    },
    {
      question: 'O que o campo resourceNames faz em uma Rule do RBAC?',
      options: [
        'Define nomes de namespaces',
        'Restringe a permissao a recursos especificos por nome',
        'Define aliases para recursos',
        'Filtra recursos por label'
      ],
      correct: 1,
      explanation: 'resourceNames restringe a permissao a instancias especificas do recurso. Ex: resourceNames: ["my-secret"] permite acesso apenas ao secret "my-secret".',
      reference: 'Conceito relacionado: RBAC — principio do menor privilegio.'
    },
    {
      question: 'Qual o risco do ClusterRole aggregation via labels?',
      options: [
        'Labels podem ser editadas por qualquer usuario',
        'ClusterRoles com labels de aggregation automaticamente adicionam suas regras aos roles agregadores',
        'Aggregation desabilita auditoria',
        'Labels podem conter wildcards'
      ],
      correct: 1,
      explanation: 'Se um ClusterRole tem label aggregate-to-view: "true", suas rules sao automaticamente adicionadas ao ClusterRole "view". Um atacante pode criar roles com essa label para injetar permissoes.',
      reference: 'Conceito relacionado: ClusterRole Aggregation — riscos de seguranca.'
    },
    {
      question: 'Quando usar RoleBinding vs ClusterRoleBinding?',
      options: [
        'RoleBinding para cluster-scoped, ClusterRoleBinding para namespace-scoped',
        'Sempre usar ClusterRoleBinding por simplicidade',
        'RoleBinding para permissoes em um namespace, ClusterRoleBinding para permissoes cluster-wide',
        'Nao ha diferenca funcional'
      ],
      correct: 2,
      explanation: 'RoleBinding concede permissoes dentro de um namespace especifico. ClusterRoleBinding concede permissoes em todo o cluster. Preferir RoleBinding quando possivel (principio do menor privilegio).',
      reference: 'Conceito relacionado: RBAC — escopo de bindings.'
    },
    {
      question: 'Como encontrar todos os subjects com acesso cluster-admin?',
      options: [
        'kubectl get clusterroles cluster-admin',
        'kubectl get clusterrolebindings e filtrar por roleRef.name=cluster-admin',
        'kubectl auth list --role=cluster-admin',
        'kubectl describe clusterrole cluster-admin'
      ],
      correct: 1,
      explanation: 'Listar ClusterRoleBindings e filtrar pelo roleRef.name=="cluster-admin" mostra todos os subjects (users, groups, SAs) com acesso de admin ao cluster.',
      reference: 'Conceito relacionado: Auditoria de RBAC — identificar acessos privilegiados.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os 4 recursos RBAC do Kubernetes?', back: 'Role (namespace-scoped permissions), ClusterRole (cluster-wide permissions), RoleBinding (liga Role a subjects em um namespace), ClusterRoleBinding (liga ClusterRole a subjects cluster-wide).' },
    { front: 'O que o verb "escalate" permite no RBAC?', back: 'Permite modificar um Role/ClusterRole para adicionar permissoes que o proprio usuario nao possui. E um dos verbs mais perigosos e deve ser restrito.' },
    { front: 'Como verificar todas as permissoes de um usuario?', back: 'kubectl auth can-i --list --as=<username> [--namespace=<ns>]. Lista todas as permissoes do usuario, incluindo resources e verbs permitidos.' },
    { front: 'O que e resourceNames no RBAC?', back: 'Campo que restringe uma regra a recursos especificos por nome. Ex: resources: [\"secrets\"], resourceNames: [\"app-config\"] — permite acesso apenas ao secret chamado app-config.' },
    { front: 'Por que "create pods" e perigoso?', back: 'Um usuario que pode criar pods pode especificar um ServiceAccount privilegiado, montar secrets, e usar host namespaces — potencialmente escalando para admin do cluster.' },
    { front: 'O que e ClusterRole Aggregation?', back: 'Mecanismo onde ClusterRoles com labels especificas (ex: aggregate-to-view: "true") tem suas rules automaticamente adicionadas a ClusterRoles agregadores (view, edit, admin). Risco: injection de permissoes.' },
    { front: 'Como encontrar ClusterRoles com wildcards?', back: 'kubectl get clusterroles -o json | jq \'.items[] | select(.rules[]?.verbs[]? == \"*\") | .metadata.name\'. Identifica roles com acesso irrestrito.' },
    { front: 'Qual a diferenca entre impersonate e --as?', back: '--as e uma flag do kubectl que usa a permissao de impersonate. O verb impersonate no RBAC permite que um subject aja como outro usuario/grupo/SA na API.' }
  ],

  lab: {
    scenario: 'O cluster tem permissoes RBAC excessivas. Voce precisa auditar, identificar problemas e criar policies com menor privilegio.',
    objective: 'Auditar RBAC do cluster, remover acessos excessivos e criar roles seguindo principio do menor privilegio.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Auditar ClusterRoleBindings Privilegiados',
        instruction: 'Identifique todos os subjects que possuem acesso `cluster-admin` e determine quais sao desnecessarios.',
        hints: [
          'Use kubectl get clusterrolebindings',
          'Filtre por roleRef.name cluster-admin',
          'Componentes do sistema (kube-system) precisam, aplicacoes geralmente nao'
        ],
        solution: '```bash\n# Listar todos os ClusterRoleBindings com cluster-admin\nkubectl get clusterrolebindings -o json | \\\n  jq -r \'.items[] | select(.roleRef.name==\"cluster-admin\") | \"\\(.metadata.name): \\(.subjects // [] | map(.kind + \"/\" + .name) | join(\", \"))\"\'\n\n# Verificar permissoes de um subject especifico\nkubectl auth can-i --list --as=system:serviceaccount:default:default\n```',
        verify: '```bash\n# Verificar ClusterRoleBindings para cluster-admin\nkubectl get clusterrolebindings -o custom-columns=NAME:.metadata.name,ROLE:.roleRef.name | grep cluster-admin\n# Saida esperada: lista de bindings com cluster-admin\n```'
      },
      {
        title: 'Criar Role com Menor Privilegio',
        instruction: 'Crie um Role no namespace `dev` que permite apenas get e list em pods e deployments, sem acesso a secrets.',
        hints: [
          'Use Role (namespace-scoped), nao ClusterRole',
          'Especifique apenas os verbs necessarios',
          'Nao inclua secrets nos resources'
        ],
        solution: '```bash\n# Criar namespace se nao existir\nkubectl create namespace dev --dry-run=client -o yaml | kubectl apply -f -\n\n# Criar Role restritivo\nkubectl create role dev-reader \\\n  --namespace=dev \\\n  --verb=get,list \\\n  --resource=pods,deployments.apps\n\n# Criar RoleBinding\nkubectl create rolebinding dev-reader-binding \\\n  --namespace=dev \\\n  --role=dev-reader \\\n  --user=developer1\n```',
        verify: '```bash\n# Verificar Role criado\nkubectl get role dev-reader -n dev -o yaml\n# Saida esperada: verbs [get, list] em pods e deployments\n\n# Verificar que developer1 pode listar pods\nkubectl auth can-i list pods -n dev --as=developer1\n# Saida esperada: yes\n\n# Verificar que developer1 NAO pode acessar secrets\nkubectl auth can-i get secrets -n dev --as=developer1\n# Saida esperada: no\n```'
      },
      {
        title: 'Identificar e Corrigir Wildcards',
        instruction: 'Encontre ClusterRoles com permissoes wildcard (*) e avalie se sao necessarios.',
        hints: [
          'Use jq para filtrar rules com verbs contendo *',
          'ClusterRoles built-in (system:) podem ter wildcards legitimamente',
          'Foque em ClusterRoles custom'
        ],
        solution: '```bash\n# Encontrar ClusterRoles com wildcard verbs\nkubectl get clusterroles -o json | \\\n  jq -r \'.items[] | select(.rules[]?.verbs[]? == \"*\") | .metadata.name\' | \\\n  grep -v \"^system:\"\n\n# Ver detalhes de um ClusterRole suspeito\nkubectl describe clusterrole <suspicious-role>\n\n# Se necessario, editar para remover wildcards\nkubectl edit clusterrole <role-name>\n```',
        verify: '```bash\n# Verificar ClusterRoles custom com wildcards\nkubectl get clusterroles -o json | \\\n  jq -r \'.items[] | select(.rules[]?.verbs[]? == \"*\") | .metadata.name\' | \\\n  grep -v \"^system:\" | wc -l\n# Saida esperada: 0 (nenhum custom role com wildcard) ou lista dos que restam\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Usuario Nao Consegue Acessar Recursos Apos RBAC Hardening',
      difficulty: 'easy',
      symptom: 'Apos remover permissoes excessivas, usuarios reportam "Forbidden" ao tentar acessar recursos que deveriam ter acesso.',
      diagnosis: '```bash\n# Verificar permissoes atuais do usuario\nkubectl auth can-i --list --as=<username> --namespace=<ns>\n\n# Verificar bindings do usuario\nkubectl get rolebindings,clusterrolebindings -A -o json | \\\n  jq \'.items[] | select(.subjects[]?.name==\"<username>\")\'\n\n# Testar permissao especifica\nkubectl auth can-i get pods -n <ns> --as=<username>\n```',
      solution: 'Verifique se o usuario tem RoleBinding/ClusterRoleBinding com as permissoes corretas. Erros comuns: binding no namespace errado, Role sem os verbs necessarios, subject name incorreto (case-sensitive), grupo do usuario nao incluido no binding.'
    },
    {
      title: 'ServiceAccount com Mais Permissoes que o Esperado',
      difficulty: 'hard',
      symptom: 'Um ServiceAccount que deveria ter permissoes limitadas consegue realizar acoes como listar secrets ou criar pods em namespaces nao autorizados.',
      diagnosis: '```bash\n# Verificar TODAS as permissoes do SA\nkubectl auth can-i --list \\\n  --as=system:serviceaccount:<ns>:<sa-name>\n\n# Verificar ClusterRoleBindings (cluster-wide)\nkubectl get clusterrolebindings -o json | \\\n  jq \'.items[] | select(.subjects[]? | .name==\"<sa-name>\" and .namespace==\"<ns>\")\'\n\n# Verificar se ha aggregation injetando regras\nkubectl get clusterroles -o json | \\\n  jq \'.items[] | select(.metadata.labels[\"rbac.authorization.k8s.io/aggregate-to-edit\"]==\"true\") | .metadata.name\'\n```',
      solution: 'Fontes de permissoes inesperadas: 1) ClusterRoleBinding dando permissoes cluster-wide. 2) ClusterRole aggregation adicionando regras via labels. 3) Heranca do grupo system:serviceaccounts (todos os SAs). 4) Multiple bindings acumulando permissoes. Remova bindings desnecessarios e use RoleBinding ao inves de ClusterRoleBinding.'
    }
  ]
};
