window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcsa-k8s-security/rbac-overview'] = {

  theory: `# RBAC & Authentication Overview

## Relevancia no KCSA
> O dominio "Kubernetes Security Fundamentals" vale **22%** do KCSA. RBAC, autenticacao e autorizacao sao conceitos centrais do exame. Entender como o Kubernetes controla acesso e fundamental.

---

## Authentication (AuthN) — Quem voce e?

O **kube-apiserver** suporta multiplos metodos de autenticacao:

| Metodo | Usado por | Detalhes |
|--------|-----------|---------|
| **Certificados X.509** | Admins, componentes do cluster | CN = username, O = group |
| **Bearer Tokens (SA)** | ServiceAccounts, pods | JWT assinado pelo API Server |
| **OIDC** | Usuarios humanos (SSO) | Integra com Google, Azure AD, Okta |
| **Webhook Token Auth** | Integracao com IAM externo | Delega autenticacao a servico externo |
| **Static Token File** | Basico (nao recomendado) | Arquivo CSV com tokens fixos |

### Usuarios vs ServiceAccounts

| Aspecto | User Account | Service Account |
|---------|-------------|-----------------|
| **Para** | Humanos | Pods/aplicacoes |
| **Namespace** | Cluster-global | Namespaced |
| **Criacao** | Fora do K8s (cert/OIDC) | kubectl/API K8s |
| **Token** | Via kubeconfig | Automontado no pod |
| **Gerenciado** | Externamente | Pelo Kubernetes |

**Ponto critico:** O Kubernetes nao tem objeto "User" — usuarios sao representados pelo Common Name (CN) em certificados ou pelo campo "sub" em OIDC tokens.

---

## Authorization (AuthZ) — O que voce pode fazer?

Apos autenticado, cada requisicao passa por **autorizacao**:

| Modo | Descricao | Uso |
|------|-----------|-----|
| **RBAC** | Role-Based Access Control | Padrao recomendado |
| **Node** | Restricao para kubelets | Sempre combinado com RBAC |
| **ABAC** | Attribute-Based (arquivo) | Legado, nao recomendado |
| **Webhook** | Delega a servico externo | Integracao com IAM |
| **AlwaysAllow** | Libera tudo | Nunca em producao |
| **AlwaysDeny** | Bloqueia tudo | Apenas para teste |

**Configuracao recomendada:** \`--authorization-mode=Node,RBAC\`

---

## RBAC — Role-Based Access Control

### Objetos RBAC

| Objeto | Escopo | Funcao |
|--------|--------|--------|
| **Role** | Namespace | Define permissoes em um namespace |
| **ClusterRole** | Cluster | Define permissoes em todo o cluster |
| **RoleBinding** | Namespace | Liga Role ou ClusterRole a um Subject (neste namespace) |
| **ClusterRoleBinding** | Cluster | Liga ClusterRole a um Subject em todo o cluster |

### Estrutura de uma Role

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: pod-reader
rules:
- apiGroups: [""]          # "" = grupo core (pods, services, secrets)
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]      # apps = deployments, replicasets
  resources: ["deployments"]
  verbs: ["get", "list"]
\`\`\`

### Verbos Disponiveis

| Verbo | HTTP | Descricao |
|-------|------|-----------|
| \`get\` | GET | Ler um recurso especifico |
| \`list\` | GET | Listar recursos |
| \`watch\` | GET | Observar mudancas |
| \`create\` | POST | Criar recursos |
| \`update\` | PUT | Substituir recurso |
| \`patch\` | PATCH | Modificar parcialmente |
| \`delete\` | DELETE | Deletar recurso |
| \`deletecollection\` | DELETE | Deletar varios recursos |
| \`exec\` | POST | Executar comando em pod |
| \`bind\` | POST | Criar RoleBindings (sensivel!) |
| \`escalate\` | PUT | Criar roles com mais permissoes (sensivel!) |

---

## Princípio do Menor Privilegio

**Never use cluster-admin** para workloads de aplicacao.

\`\`\`yaml
# MAU: dar cluster-admin para uma aplicacao
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: my-app-admin  # NUNCA FAZER ISSO
roleRef:
  kind: ClusterRole
  name: cluster-admin  # Acesso total ao cluster
subjects:
- kind: ServiceAccount
  name: my-app
  namespace: default

---
# BOM: permissoes minimas necessarias
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: my-app-role
  namespace: production
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get"]
  resourceNames: ["app-config"]  # Apenas este ConfigMap especifico
\`\`\`

---

## ClusterRole via RoleBinding (Truque Importante)

Um **RoleBinding** pode referenciar um **ClusterRole**, mas limita o acesso ao namespace do RoleBinding:

\`\`\`yaml
# RoleBinding referenciando um ClusterRole = permissao APENAS no namespace production
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: production   # Escopo limitado a este namespace
subjects:
- kind: User
  name: jane
roleRef:
  kind: ClusterRole       # ClusterRole referenciado
  name: pod-reader
\`\`\`

Isso permite reutilizar ClusterRoles (como os built-in: view, edit, admin) sem dar acesso ao cluster inteiro.

---

## ServiceAccounts e Tokens

### Automount de Token

Por padrao, o token da ServiceAccount e automontado em cada Pod:

\`\`\`yaml
# Desabilitar automount - boas praticas para pods que nao precisam da API K8s
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app
automountServiceAccountToken: false

---
# No Pod, tambem pode ser desabilitado
spec:
  automountServiceAccountToken: false
\`\`\`

### Tokens Projetados (Bound Tokens)

Tokens modernos sao temporarios, com audience e expiracao:

\`\`\`yaml
volumes:
- name: token
  projected:
    sources:
    - serviceAccountToken:
        audience: api
        expirationSeconds: 3600  # Token expira em 1 hora
        path: token
\`\`\`

---

## Built-in ClusterRoles

| ClusterRole | Permissoes | Uso |
|-------------|-----------|-----|
| \`cluster-admin\` | Tudo em todos os recursos | Apenas para administradores de cluster |
| \`admin\` | Tudo em um namespace (via RoleBinding) | Administradores de namespace |
| \`edit\` | Ler e escrever workloads (sem RBAC) | Desenvolvedores |
| \`view\` | Apenas leitura (sem secrets) | Observadores |

---

## Verificando Permissoes

\`\`\`bash
# Verificar o que EU posso fazer
kubectl auth can-i --list

# Verificar permissao especifica
kubectl auth can-i create pods
kubectl auth can-i delete secrets -n production

# Verificar como outro usuario ou SA
kubectl auth can-i get pods --as=jane
kubectl auth can-i create pods --as=system:serviceaccount:default:my-app

# Verificar em namespace especifico
kubectl auth can-i get secrets -n production --as=system:serviceaccount:production:my-app
\`\`\`

---

## Erros Comuns no KCSA

1. **Confundir escopo**: Role = namespace, ClusterRole = cluster
2. **Esquecer que apiGroups "" (string vazia) = grupo core** (pods, services, secrets)
3. **Achar que RoleBinding com ClusterRole da acesso ao cluster** — nao, limita ao namespace
4. **Verbos "bind" e "escalate" sao sensiveis** — permitem criar RBAC com mais privilegios
5. **ServiceAccounts com automount habilitado desnecessariamente** — pods sem necessidade de API K8s nao devem ter token
`,

  quiz: [
    {
      question: 'Qual a diferenca entre Role e ClusterRole no Kubernetes?',
      options: ['ClusterRole tem mais permissoes que Role', 'Role e namespaced (escopo em 1 namespace), ClusterRole e cluster-wide (todos os namespaces e recursos nao-namespaced)', 'Role pode ser usada por qualquer usuario, ClusterRole apenas por admins', 'Sao identicos, apenas com nomes diferentes'],
      correct: 1,
      explanation: 'Role: define permissoes em UM namespace especifico. ClusterRole: define permissoes em todos os namespaces E recursos nao-namespaced (nodes, PVs, namespaces). RoleBinding liga ao namespace, ClusterRoleBinding liga ao cluster.',
      reference: 'Role = namespace-scoped. ClusterRole = cluster-scoped. RoleBinding = namespace. ClusterRoleBinding = cluster. RoleBinding pode referenciar ClusterRole (limita ao namespace).'
    },
    {
      question: 'O que apiGroups: [""] significa em uma regra RBAC?',
      options: ['Nenhum API group (sem permissoes)', 'O grupo core do Kubernetes (pods, services, secrets, configmaps, nodes)', 'Todos os API groups', 'Apenas o grupo de extensoes'],
      correct: 1,
      explanation: 'apiGroups: [""] (string vazia) representa o grupo core da API Kubernetes, que inclui: pods, services, secrets, configmaps, nodes, namespaces, endpoints, persistentvolumeclaims, etc.',
      reference: 'apiGroups: [""] = core (pods, services, secrets). ["apps"] = deployments, replicasets. ["batch"] = jobs. ["rbac.authorization.k8s.io"] = roles, rolebindings.'
    },
    {
      question: 'Um RoleBinding que referencia um ClusterRole garante acesso em:',
      options: ['Todo o cluster (equivale a ClusterRoleBinding)', 'Apenas no namespace do RoleBinding', 'Apenas nos namespaces listados no ClusterRole', 'Em todos os namespaces onde o usuario existe'],
      correct: 1,
      explanation: 'RoleBinding limita o escopo ao namespace onde e criado, independente de referenciar um Role ou ClusterRole. Permite reutilizar ClusterRoles (como view, edit) em namespaces especificos.',
      reference: 'Truque RBAC: RoleBinding + ClusterRole = permissao apenas no namespace. ClusterRoleBinding + ClusterRole = permissao em todo o cluster.'
    },
    {
      question: 'Por que os verbos "bind" e "escalate" sao considerados sensiveis no RBAC?',
      options: ['Sao verbos reservados para o sistema', 'Permitem criar RoleBindings e Roles com mais privilegios que o usuario tem, podendo escalar privilegios', 'Sao mais lentos que os outros verbos', 'Requerem autenticacao adicional'],
      correct: 1,
      explanation: '"bind" permite criar RoleBindings (ligar permissoes a outros usuarios). "escalate" permite criar Roles/ClusterRoles com mais permissoes que as do usuario. Ambos podem ser usados para escalar privilegios.',
      reference: 'Verbos sensiveis: bind (criar RoleBindings), escalate (criar Roles mais permissivas), impersonate (agir como outro usuario/SA).'
    },
    {
      question: 'Qual e a melhor pratica para ServiceAccounts em pods que nao precisam acessar a API Kubernetes?',
      options: ['Usar a ServiceAccount default', 'Configurar automountServiceAccountToken: false para nao montar o token desnecessariamente', 'Criar uma ClusterRole vazia para a SA', 'Usar o ServiceAccount cluster-admin'],
      correct: 1,
      explanation: 'Pods que nao precisam da API K8s nao devem ter token montado. automountServiceAccountToken: false previne o automount, reduzindo a superficie de ataque caso o pod seja comprometido.',
      reference: 'automountServiceAccountToken: false. Configurar no SA ou no Pod spec. Pods de aplicacao raramente precisam da API K8s diretamente.'
    },
    {
      question: 'Qual comando verifica as permissoes de uma ServiceAccount especifica?',
      options: ['kubectl get permissions sa/my-app', 'kubectl auth can-i --list --as=system:serviceaccount:default:my-app', 'kubectl describe serviceaccount my-app', 'kubectl check rbac my-app'],
      correct: 1,
      explanation: 'kubectl auth can-i --list --as=system:serviceaccount:NAMESPACE:SA_NAME lista todas as permissoes da SA. O formato do username de uma SA e: system:serviceaccount:<namespace>:<name>.',
      reference: 'Format: system:serviceaccount:<namespace>:<name>. Verificar: kubectl auth can-i get pods --as=system:serviceaccount:default:my-app.'
    },
    {
      question: 'Qual e a configuracao de autorizacao recomendada para o kube-apiserver?',
      options: ['--authorization-mode=AlwaysAllow', '--authorization-mode=RBAC', '--authorization-mode=Node,RBAC', '--authorization-mode=ABAC,RBAC'],
      correct: 2,
      explanation: 'Node,RBAC e o modo recomendado: Node authorizer permite que kubelets acessem recursos necessarios para seus pods, RBAC controla acesso de todos os outros. ABAC e legado. AlwaysAllow e inseguro.',
      reference: '--authorization-mode=Node,RBAC. Node = kubelets, RBAC = todos os outros. Multiplos modos sao separados por virgula.'
    },
    {
      question: 'O Kubernetes possui um objeto "User" para gerenciar usuarios humanos?',
      options: ['Sim, kubectl create user funciona', 'Nao, usuarios sao representados pelo CN em certificados ou campo "sub" em OIDC tokens', 'Sim, mas apenas em managed Kubernetes', 'Nao, usuarios devem usar apenas ServiceAccounts'],
      correct: 1,
      explanation: 'O Kubernetes NAO tem objeto User. Usuarios humanos sao autenticados via: certificado X.509 (CN = username, O = group), OIDC token (sub = username), ou token estático. Nao ha API para criar usuarios.',
      reference: 'Sem objeto User no K8s. Username via: cert CN, OIDC sub. Groups via: cert O (Organization). ServiceAccounts = para pods/aplicacoes.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os 4 objetos RBAC do Kubernetes?', back: 'Role (permissoes no namespace), ClusterRole (permissoes no cluster), RoleBinding (liga Role/ClusterRole a Subject no namespace), ClusterRoleBinding (liga ClusterRole a Subject no cluster).' },
    { front: 'Qual a formula do sistema RBAC?', back: 'Subject (User, Group, ServiceAccount) + RoleBinding/ClusterRoleBinding --> Role/ClusterRole --> rules (apiGroups + resources + verbs). Subject obtém permissão de executar verbs nos resources.' },
    { front: 'RoleBinding com ClusterRole: qual o escopo?', back: 'Escopo do NAMESPACE do RoleBinding, nao do ClusterRole. Permite reutilizar ClusterRoles (view, edit, admin) em namespaces especificos sem dar acesso ao cluster inteiro.' },
    { front: 'Quais metodos de autenticacao o Kubernetes suporta?', back: 'Certificados X.509 (CN=user, O=group), Bearer Tokens (SA JWT), OIDC (SSO), Webhook Token Auth, Static Token File (evitar). Kubernetes nao tem objeto "User".' },
    { front: 'Por que automountServiceAccountToken: false e recomendado?', back: 'Pods que nao acessam a API K8s nao precisam do token. Token montado = superficie de ataque se pod for comprometido. Configurar false na SA ou no Pod. Tokens devem ser projetados com audience + expirationSeconds.' },
    { front: 'Como verificar permissoes no Kubernetes?', back: 'kubectl auth can-i --list (minhas permissoes). kubectl auth can-i get pods (permissao especifica). kubectl auth can-i --list --as=system:serviceaccount:default:my-app (simular SA). -n <namespace> para namespace especifico.' },
    { front: 'Verbos RBAC sensiveis: quais sao?', back: 'bind: criar RoleBindings (ligar permissoes). escalate: criar Roles com mais permissoes que o criador tem. impersonate: agir como outro usuario/SA. Cuidado: quem tem estes verbos pode escalar privilegios.' },
    { front: 'Quais sao os built-in ClusterRoles mais importantes?', back: 'cluster-admin: tudo em tudo (apenas admins). admin: tudo no namespace via RoleBinding (sem RBAC management). edit: ler/escrever workloads (sem RBAC). view: somente leitura (sem secrets).' }
  ],

  lab: {
    scenario: 'Voce e um Security Engineer auditando e corrigindo RBAC de um cluster. Precisa identificar permissoes excessivas e implementar principio do menor privilegio.',
    objective: 'Auditar RBAC, identificar permissoes excessivas e implementar politica de menor privilegio.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Auditar permissoes excessivas no cluster',
        instruction: 'Identifique ServiceAccounts e usuarios com permissoes cluster-admin ou excessivas.',
        hints: ['kubectl get clusterrolebindings | grep cluster-admin', 'kubectl auth can-i --list --as=system:serviceaccount:...'],
        solution: '```bash\n# Listar todos os ClusterRoleBindings para cluster-admin\nkubectl get clusterrolebindings -o wide | grep cluster-admin\n\n# Ver detalhes de todos os ClusterRoleBindings\nkubectl get clusterrolebindings -o custom-columns=\\\n  "NAME:.metadata.name,ROLE:.roleRef.name,SUBJECTS:.subjects[*].name" | head -20\n\n# Verificar permissoes de uma ServiceAccount\nkubectl auth can-i --list --as=system:serviceaccount:kube-system:default\n\n# Listar SAs com automount habilitado\nkubectl get serviceaccounts --all-namespaces \\\n  -o jsonpath=\'{range .items[*]}{.metadata.namespace}{"/"}{.metadata.name}{" automount="}{.automountServiceAccountToken}{"\\n"}{end}\' | \\\n  grep -v "false" | grep -v "kube-system"\n```',
        verify: '```bash\nkubectl get clusterrolebindings --no-headers | wc -l\n# Saida: numero de ClusterRoleBindings no cluster\n```'
      },
      {
        title: 'Criar RBAC com principio do menor privilegio',
        instruction: 'Crie uma ServiceAccount com permissoes minimas para uma aplicacao que apenas precisa listar pods em um namespace.',
        hints: ['Use Role (namespace-scoped), nao ClusterRole', 'Limite os verbs ao necessario: get, list'],
        solution: '```bash\n# Criar namespace e ServiceAccount\nkubectl create namespace rbac-demo\nkubectl create serviceaccount pod-reader -n rbac-demo\n\n# Configurar automount false\nkubectl patch serviceaccount pod-reader -n rbac-demo \\\n  -p \'{"automountServiceAccountToken": false}\'\n\n# Criar Role com permissoes minimas\nkubectl apply -f - <<EOF\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: pod-list-only\n  namespace: rbac-demo\nrules:\n- apiGroups: [""]\n  resources: ["pods"]\n  verbs: ["get", "list", "watch"]\nEOF\n\n# Criar RoleBinding\nkubectl create rolebinding pod-reader-binding \\\n  --role=pod-list-only \\\n  --serviceaccount=rbac-demo:pod-reader \\\n  -n rbac-demo\n\n# Verificar permissoes\nkubectl auth can-i list pods \\\n  --as=system:serviceaccount:rbac-demo:pod-reader \\\n  -n rbac-demo\nkubectl auth can-i delete pods \\\n  --as=system:serviceaccount:rbac-demo:pod-reader \\\n  -n rbac-demo\n```',
        verify: '```bash\n# Deve poder listar pods\nkubectl auth can-i list pods \\\n  --as=system:serviceaccount:rbac-demo:pod-reader \\\n  -n rbac-demo\n# Saida esperada: yes\n\n# NAO deve poder deletar pods\nkubectl auth can-i delete pods \\\n  --as=system:serviceaccount:rbac-demo:pod-reader \\\n  -n rbac-demo\n# Saida esperada: no\n\n# Limpar\nkubectl delete namespace rbac-demo\n```'
      },
      {
        title: 'Reutilizar ClusterRole built-in via RoleBinding',
        instruction: 'Use o ClusterRole built-in "view" para dar acesso somente-leitura a um usuario em um namespace especifico usando RoleBinding (nao ClusterRoleBinding).',
        hints: ['RoleBinding pode referenciar ClusterRole', 'Isso limita o acesso ao namespace do RoleBinding'],
        solution: '```bash\n# Verificar o que o ClusterRole "view" permite\nkubectl describe clusterrole view | head -30\n\n# Criar namespace\nkubectl create namespace reutilizar-demo\n\n# RoleBinding referenciando ClusterRole "view" (escopo limitado ao namespace)\nkubectl apply -f - <<EOF\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: jane-view\n  namespace: reutilizar-demo\nsubjects:\n- kind: User\n  name: jane\n  apiGroup: rbac.authorization.k8s.io\nroleRef:\n  kind: ClusterRole\n  name: view\n  apiGroup: rbac.authorization.k8s.io\nEOF\n\n# Verificar: jane pode ver pods no namespace reutilizar-demo\nkubectl auth can-i list pods --as=jane -n reutilizar-demo\n# Deve retornar: yes\n\n# Mas NAO pode ver pods em outros namespaces\nkubectl auth can-i list pods --as=jane -n default\n# Deve retornar: no\n\nkubectl delete namespace reutilizar-demo\n```',
        verify: '```bash\nkubectl auth can-i list pods --as=jane -n reutilizar-demo\n# Saida esperada: yes\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Aplicacao recebe 403 Forbidden ao acessar a API Kubernetes',
      difficulty: 'easy',
      symptom: 'Uma aplicacao em producao esta retornando erros de 403 Forbidden ao tentar listar ConfigMaps do seu proprio namespace. O pod usa a ServiceAccount "my-app".',
      diagnosis: '**1. Verificar o erro exato:**\n```bash\nkubectl logs <pod-name> | grep -E "403|Forbidden|RBAC|denied"\n```\n\n**2. Verificar o que a ServiceAccount pode fazer:**\n```bash\nkubectl auth can-i list configmaps \\\n  --as=system:serviceaccount:<namespace>:my-app \\\n  -n <namespace>\n# Se retornar "no", confirma o problema\n\nkubectl auth can-i --list \\\n  --as=system:serviceaccount:<namespace>:my-app \\\n  -n <namespace>\n```\n\n**3. Verificar se existem RoleBindings para a SA:**\n```bash\nkubectl get rolebindings -n <namespace> -o yaml | grep my-app\nkubectl get clusterrolebindings -o yaml | grep my-app\n```',
      solution: '**Criar Role e RoleBinding com a permissao necessaria:**\n\n```bash\n# Criar Role\nkubectl apply -f - <<EOF\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: configmap-reader\n  namespace: production\nrules:\n- apiGroups: [""]\n  resources: ["configmaps"]\n  verbs: ["get", "list", "watch"]\nEOF\n\n# Criar RoleBinding\nkubectl create rolebinding my-app-configmap-reader \\\n  --role=configmap-reader \\\n  --serviceaccount=production:my-app \\\n  -n production\n\n# Verificar\nkubectl auth can-i list configmaps \\\n  --as=system:serviceaccount:production:my-app \\\n  -n production\n# Deve retornar: yes\n```'
    },
    {
      title: 'Usuario tem cluster-admin sem querer',
      difficulty: 'medium',
      symptom: 'Auditoria revelou que um usuario "developer-john" tem ClusterRoleBinding para cluster-admin. Isto viola o principio do menor privilegio e precisa ser corrigido.',
      diagnosis: '**1. Encontrar o ClusterRoleBinding:**\n```bash\nkubectl get clusterrolebindings -o wide | grep developer-john\nkubectl get clusterrolebinding <binding-name> -o yaml\n```\n\n**2. Verificar o que john consegue fazer:**\n```bash\nkubectl auth can-i --list --as=developer-john\n# Vai mostrar tudo (cluster-admin)\n```\n\n**3. Identificar o que john REALMENTE precisa:**\n```bash\n# Verificar historico de acoes de john nos audit logs\n# grep john /var/log/kubernetes/audit.log | tail -50\n```',
      solution: '**1. Remover o ClusterRoleBinding excessivo:**\n```bash\nkubectl delete clusterrolebinding <binding-name>\n```\n\n**2. Criar permissoes adequadas com menor privilegio:**\n```bash\n# Exemplo: john e desenvolvedor no namespace dev\nkubectl create rolebinding john-developer \\\n  --clusterrole=edit \\\n  --user=developer-john \\\n  --namespace=development\n\n# Se john tambem precisa ver outros namespaces:\nkubectl create rolebinding john-view-staging \\\n  --clusterrole=view \\\n  --user=developer-john \\\n  --namespace=staging\n```\n\n**3. Verificar que as permissoes estao corretas:**\n```bash\n# John pode agora criar deployments em development\nkubectl auth can-i create deployments --as=developer-john -n development\n# yes\n\n# John NAO pode mais acessar kube-system ou outros namespaces sensiveis\nkubectl auth can-i get secrets --as=developer-john -n kube-system\n# no\n\nkubectl auth can-i delete namespaces --as=developer-john\n# no\n```'
    }
  ]
};
