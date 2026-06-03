window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cluster-architecture/rbac'] = {
  theory: `# RBAC - Role-Based Access Control

## O que e RBAC?

RBAC (Role-Based Access Control) e o mecanismo de autorizacao padrao do Kubernetes. Ele permite controlar **quem pode fazer o que em quais recursos**, com granularidade por namespace ou em nivel de cluster.

O RBAC e habilitado por padrao desde o Kubernetes 1.8 e e ativado via flag \`--authorization-mode=RBAC\` no kube-apiserver.

O modelo RBAC do Kubernetes e baseado em tres conceitos:
- **Quem** (Subjects): usuarios, grupos ou ServiceAccounts
- **O que** (Verbs): acoes como get, list, create, delete
- **Em que** (Resources): pods, services, deployments, etc.

---

## Os 4 Objetos da API RBAC

### Role

Define permissoes dentro de um **namespace especifico**. Nao pode referenciar recursos fora do namespace.

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: production
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods/log"]
  verbs: ["get"]
\`\`\`

### ClusterRole

Define permissoes no **escopo de cluster** inteiro. Pode ser usado para:
- Recursos nao-namespaceds (nodes, persistentvolumes, namespaces)
- Recursos namespaceds em todos os namespaces (via ClusterRoleBinding)
- Non-resource URLs como /healthz, /metrics

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-viewer
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["metrics.k8s.io"]
  resources: ["nodes", "pods"]
  verbs: ["get", "list"]
- nonResourceURLs: ["/healthz", "/metrics"]
  verbs: ["get"]
\`\`\`

### RoleBinding

Vincula um Role **ou** ClusterRole a subjects dentro de um **namespace especifico**.

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods-binding
  namespace: production
subjects:
- kind: User
  name: joao
  apiGroup: rbac.authorization.k8s.io
- kind: Group
  name: dev-team
  apiGroup: rbac.authorization.k8s.io
- kind: ServiceAccount
  name: monitoring-sa
  namespace: monitoring
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
\`\`\`

### ClusterRoleBinding

Vincula uma ClusterRole a subjects com escopo de **todo o cluster**.

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: admin-binding
subjects:
- kind: User
  name: admin-user
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: cluster-admin
  apiGroup: rbac.authorization.k8s.io
\`\`\`

### Tabela Resumo

| Componente | Escopo | Pode referenciar |
|---|---|---|
| Role | Namespace especifico | Permissoes dentro do namespace |
| ClusterRole | Todo o cluster | Recursos non-namespaced ou global |
| RoleBinding | Namespace especifico | Role ou ClusterRole |
| ClusterRoleBinding | Todo o cluster | Somente ClusterRole |

> **Dica de prova**: Um RoleBinding pode referenciar uma ClusterRole, mas limita seu efeito ao namespace do binding. Isso e util para reutilizar ClusterRoles em namespaces especificos sem dar acesso global.

---

## Verbos (Verbs)

Os verbos definem as acoes permitidas sobre os recursos:

| Verbo | Acao HTTP equivalente | Descricao |
|---|---|---|
| get | GET (recurso individual) | Ler um recurso especifico por nome |
| list | GET (colecao) | Listar todos os recursos do tipo |
| watch | GET com ?watch=true | Monitorar mudancas em tempo real |
| create | POST | Criar um novo recurso |
| update | PUT | Substituir um recurso inteiro |
| patch | PATCH | Modificar parcialmente um recurso |
| delete | DELETE | Deletar um recurso especifico |
| deletecollection | DELETE (colecao) | Deletar todos os recursos do tipo |

> **Importante**: \`list\` e \`watch\` sao frequentemente usados juntos para informers/controllers. \`get\` nao implica \`list\`.

---

## API Groups

Os recursos do Kubernetes estao organizados em API groups:

\`\`\`
""                              -> Core group (pods, services, configmaps, secrets, nodes, endpoints, namespaces)
"apps"                          -> Deployments, StatefulSets, DaemonSets, ReplicaSets
"batch"                         -> Jobs, CronJobs
"rbac.authorization.k8s.io"    -> Roles, ClusterRoles, RoleBindings, ClusterRoleBindings
"networking.k8s.io"            -> NetworkPolicies, Ingresses
"storage.k8s.io"               -> StorageClasses, PersistentVolumes, VolumeAttachments
"autoscaling"                  -> HorizontalPodAutoscaler
"policy"                       -> PodDisruptionBudget
"scheduling.k8s.io"            -> PriorityClass
\`\`\`

\`\`\`bash
# Listar todos os API groups disponiveis no cluster
kubectl api-versions

# Listar todos os recursos com seus API groups
kubectl api-resources -o wide
\`\`\`

---

## ClusterRoles Built-in (Default)

O Kubernetes cria ClusterRoles built-in automaticamente:

| ClusterRole | Descricao | Casos de uso |
|---|---|---|
| cluster-admin | Acesso total irrestrito a tudo | Superadmin, nao usar para usuarios regulares |
| admin | Acesso admin dentro de um namespace (inclui RBAC) | Administradores de namespace |
| edit | Leitura e escrita de recursos, sem gerenciar RBAC | Desenvolvedores com permissao de deploy |
| view | Somente leitura (sem secrets) | Auditoria, suporte de leitura |

\`\`\`bash
# Ver as regras de uma ClusterRole built-in
kubectl get clusterrole admin -o yaml
kubectl get clusterrole edit -o yaml
kubectl get clusterrole view -o yaml

# Usar ClusterRole built-in em namespace especifico com RoleBinding
kubectl create rolebinding dev-admin \\
  --clusterrole=admin \\
  --user=joao \\
  -n development
\`\`\`

---

## Aggregated ClusterRoles

ClusterRoles podem ser agregadas usando labels especiais. O controller monitora labels e combina as regras automaticamente.

\`\`\`yaml
# ClusterRole que agrega outras automaticamente
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring-aggregate
aggregationRule:
  clusterRoleSelectors:
  - matchLabels:
      rbac.authorization.k8s.io/aggregate-to-monitoring: "true"
rules: []  # Preenchido automaticamente pelo controller
---
# ClusterRole que sera agregada ao monitoring-aggregate
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring-endpoints
  labels:
    rbac.authorization.k8s.io/aggregate-to-monitoring: "true"
rules:
- apiGroups: [""]
  resources: ["endpoints", "pods", "services"]
  verbs: ["get", "list", "watch"]
\`\`\`

As ClusterRoles built-in (admin, edit, view) usam esse mecanismo. Voce pode extender suas permissoes adicionando a label correspondente:

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: custom-resource-access
  labels:
    rbac.authorization.k8s.io/aggregate-to-edit: "true"  # Adiciona a "edit"
    rbac.authorization.k8s.io/aggregate-to-view: "true"  # Adiciona a "view"
rules:
- apiGroups: ["mycompany.io"]
  resources: ["myresources"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
\`\`\`

---

## ServiceAccounts e RBAC

ServiceAccounts sao identidades para processos que rodam dentro de Pods.

\`\`\`yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-service-account
  namespace: production
automountServiceAccountToken: false  # Desabilitar automount e boa pratica de seguranca
\`\`\`

Para associar um ServiceAccount a um Pod:

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
  namespace: production
spec:
  serviceAccountName: app-service-account
  automountServiceAccountToken: true  # Habilitar apenas quando necessario
  containers:
  - name: app
    image: nginx:1.25
\`\`\`

O token do ServiceAccount e montado em \`/var/run/secrets/kubernetes.io/serviceaccount/token\` e pode ser usado para autenticar contra o API Server.

\`\`\`bash
# Criar SA e fazer binding em um unico fluxo
kubectl create serviceaccount app-sa -n production
kubectl create role app-role --verb=get,list --resource=configmaps -n production
kubectl create rolebinding app-binding --role=app-role --serviceaccount=production:app-sa -n production

# O ServiceAccount e referenciado como:
# system:serviceaccount:<namespace>:<name>
kubectl auth can-i list configmaps --as=system:serviceaccount:production:app-sa -n production
\`\`\`

---

## Testando Permissoes com kubectl auth can-i

\`\`\`bash
# Verificar se o usuario atual pode criar pods no namespace default
kubectl auth can-i create pods

# Verificar permissao para outro usuario
kubectl auth can-i create pods --as=joao

# Verificar permissao em namespace especifico
kubectl auth can-i delete deployments --as=joao -n production

# Verificar como um ServiceAccount
kubectl auth can-i list secrets --as=system:serviceaccount:monitoring:monitoring-sa

# Listar TODAS as permissoes do usuario atual
kubectl auth can-i --list

# Listar permissoes em namespace especifico
kubectl auth can-i --list -n production

# Listar permissoes de outro usuario
kubectl auth can-i --list --as=joao -n production

# Verificar permissao em subrecurso
kubectl auth can-i create pods/exec --as=joao -n production
\`\`\`

---

## Comandos Imperativos para o Exame

\`\`\`bash
# Criar Role via imperativo
kubectl create role pod-reader \\
  --verb=get,list,watch \\
  --resource=pods \\
  -n production

# Criar Role com multiplos recursos
kubectl create role dev-role \\
  --verb=get,list,watch,create,update,patch,delete \\
  --resource=pods,deployments,services \\
  -n development

# Criar ClusterRole
kubectl create clusterrole node-viewer \\
  --verb=get,list,watch \\
  --resource=nodes

# Criar ClusterRole para non-resource URLs
kubectl create clusterrole health-checker \\
  --verb=get \\
  --non-resource-url=/healthz,/metrics

# Criar RoleBinding com usuario
kubectl create rolebinding read-pods-binding \\
  --role=pod-reader \\
  --user=joao \\
  -n production

# Criar RoleBinding com ServiceAccount
kubectl create rolebinding sa-binding \\
  --role=pod-reader \\
  --serviceaccount=production:app-sa \\
  -n production

# Criar RoleBinding referenciando ClusterRole
kubectl create rolebinding admin-ns \\
  --clusterrole=admin \\
  --user=joao \\
  -n production

# Criar ClusterRoleBinding
kubectl create clusterrolebinding admin-binding \\
  --clusterrole=cluster-admin \\
  --user=admin-user

# Criar ServiceAccount
kubectl create serviceaccount monitoring-sa -n monitoring

# Gerar YAML sem aplicar (util no exame)
kubectl create role pod-reader --verb=get,list --resource=pods --dry-run=client -o yaml

# Gerar YAML e editar antes de aplicar
kubectl create rolebinding my-binding --role=pod-reader --user=joao -n prod \\
  --dry-run=client -o yaml | kubectl apply -f -
\`\`\`

---

## Recursos Nao-Namespaceds vs Namespaceds

\`\`\`bash
# Verificar quais recursos sao namespaced
kubectl api-resources --namespaced=true
kubectl api-resources --namespaced=false
\`\`\`

**Recursos nao-namespaceds** (exigem ClusterRole e ClusterRoleBinding para acesso):
- nodes, persistentvolumes
- clusterroles, clusterrolebindings
- namespaces, storageclasses
- priorityclasses, ingressclasses

**Recursos namespaceds** (podem usar Role ou ClusterRole via RoleBinding):
- pods, deployments, services, configmaps, secrets
- replicasets, statefulsets, daemonsets, jobs, cronjobs
- roles, rolebindings, serviceaccounts

---

## Permissoes sobre SubResources

SubRecursos sao operacoes especificas sobre recursos:

\`\`\`yaml
rules:
- apiGroups: [""]
  resources: ["pods/exec"]        # kubectl exec
  verbs: ["create"]
- apiGroups: [""]
  resources: ["pods/log"]         # kubectl logs
  verbs: ["get"]
- apiGroups: [""]
  resources: ["pods/portforward"] # kubectl port-forward
  verbs: ["create"]
- apiGroups: ["apps"]
  resources: ["deployments/scale"]
  verbs: ["update", "patch"]
- apiGroups: [""]
  resources: ["nodes/proxy"]      # acesso ao kubelet via API
  verbs: ["get", "create"]
\`\`\`

---

## Permissoes para Recursos Especificos por Nome

\`\`\`yaml
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["app-config", "db-config"]
  verbs: ["get", "update"]
# ATENCAO: resourceNames nao funciona com "list" e "watch"
# pois essas operacoes sao em colecoes, nao em recursos individuais
\`\`\`

---

## Wildcards e Acesso Total

\`\`\`yaml
# Acesso total a tudo (equivalente ao cluster-admin)
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["*"]

# Acesso total a recursos do core group
rules:
- apiGroups: [""]
  resources: ["*"]
  verbs: ["*"]
\`\`\`

---

## Non-Resource URLs

Alguns endpoints do Kubernetes nao sao recursos namespaceds:

\`\`\`yaml
rules:
- nonResourceURLs:
  - "/healthz"
  - "/healthz/*"
  - "/metrics"
  - "/version"
  - "/api"
  - "/api/*"
  verbs: ["get"]
\`\`\`

---

## Padroes Comuns de RBAC (Patterns)

### Administrador de Namespace

\`\`\`bash
kubectl create rolebinding ns-admin \\
  --clusterrole=admin \\
  --user=team-lead \\
  -n meu-namespace
\`\`\`

### Usuario Read-Only para Auditoria

\`\`\`bash
kubectl create clusterrolebinding auditor-binding \\
  --clusterrole=view \\
  --user=auditor
\`\`\`

### CI/CD ServiceAccount

\`\`\`yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: cicd-deployer
  namespace: apps
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: cicd-role
  namespace: apps
rules:
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "create", "update", "patch"]
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "create", "update", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: cicd-binding
  namespace: apps
subjects:
- kind: ServiceAccount
  name: cicd-deployer
  namespace: apps
roleRef:
  kind: Role
  name: cicd-role
  apiGroup: rbac.authorization.k8s.io
\`\`\`

---

## Debugando Problemas de RBAC (403 Forbidden)

Quando uma aplicacao recebe 403 Forbidden, siga este fluxo:

\`\`\`bash
# 1. Identificar qual usuario/SA esta fazendo a requisicao
# O erro normalmente inclui: User "system:serviceaccount:namespace:name"

# 2. Testar a permissao diretamente
kubectl auth can-i <verb> <resource> \\
  --as=system:serviceaccount:<namespace>:<sa-name> \\
  -n <namespace>

# 3. Listar todas as permissoes do SA
kubectl auth can-i --list \\
  --as=system:serviceaccount:<namespace>:<sa-name> \\
  -n <namespace>

# 4. Ver RoleBindings e ClusterRoleBindings do SA
kubectl get rolebindings,clusterrolebindings --all-namespaces \\
  -o jsonpath='{range .items[?(@.subjects[*].name=="<sa-name>")]}{.metadata.name}{" "}{.metadata.namespace}{"\n"}{end}'

# 5. Verificar o Role/ClusterRole referenciado
kubectl get role <role-name> -n <namespace> -o yaml
kubectl get clusterrole <clusterrole-name> -o yaml

# 6. Verificar logs do kube-apiserver para RBAC
# No control plane:
kubectl logs -n kube-system kube-apiserver-<node> | grep "RBAC\\|Forbidden\\|403"
\`\`\``,

  quiz: [
    {
      question: 'Qual e a diferenca entre Role e ClusterRole no Kubernetes?',
      options: [
        'Role e mais poderoso e ClusterRole e mais restrito',
        'Role e limitado a um namespace, ClusterRole e valido em todo o cluster',
        'ClusterRole so pode ser usado com ClusterRoleBinding',
        'Nao ha diferenca, sao sinonimos'
      ],
      correct: 1,
      explanation: 'Role define permissoes dentro de um namespace especifico. ClusterRole define permissoes que se aplicam em todo o cluster ou a recursos nao-namespaceds como nodes e persistentvolumes.'
    },
    {
      question: 'Um desenvolvedor precisa listar pods no namespace "staging". Qual objeto RBAC e mais apropriado?',
      options: [
        'ClusterRoleBinding com ClusterRole',
        'Role no namespace staging + RoleBinding no namespace staging',
        'ClusterRole + RoleBinding no namespace staging',
        'Tanto B quanto C sao corretos'
      ],
      correct: 3,
      explanation: 'Ambas as opcoes B e C funcionam. Um RoleBinding pode referenciar um ClusterRole e limitar seu efeito ao namespace do binding. Isso permite reutilizar ClusterRoles em namespaces especificos.'
    },
    {
      question: 'Qual comando verifica se o usuario "maria" pode deletar deployments no namespace "production"?',
      options: [
        'kubectl check rbac --user=maria --verb=delete --resource=deployments -n production',
        'kubectl auth can-i delete deployments --as=maria -n production',
        'kubectl rbac test maria delete deployments -n production',
        'kubectl get permissions --user=maria -n production'
      ],
      correct: 1,
      explanation: 'O comando "kubectl auth can-i" e usado para verificar permissoes. A flag --as permite impersonar outro usuario e -n especifica o namespace.'
    },
    {
      question: 'Qual API group deve ser usado para recursos como Pods, Services e ConfigMaps em uma regra RBAC?',
      options: [
        '"core"',
        '"v1"',
        '""  (string vazia)',
        '"kubernetes.io"'
      ],
      correct: 2,
      explanation: 'Recursos do core group (pods, services, configmaps, secrets, nodes) usam uma string vazia "" como apiGroup nas regras RBAC. Nao se usa "core" ou "v1".'
    },
    {
      question: 'Um Pod precisa listar ConfigMaps no seu proprio namespace. O que deve ser criado?',
      options: [
        'Apenas um ServiceAccount',
        'ServiceAccount + Role com permissao de list em configmaps + RoleBinding ligando os dois',
        'ClusterRole com permissao de list + ClusterRoleBinding',
        'Nenhuma configuracao e necessaria, Pods ja tem acesso por padrao'
      ],
      correct: 1,
      explanation: 'Para um Pod acessar recursos da API, precisa: (1) um ServiceAccount com identidade, (2) um Role ou ClusterRole com as permissoes, (3) um RoleBinding ligando o ServiceAccount ao Role. O ServiceAccount e entao referenciado no spec do Pod.'
    },
    {
      question: 'Qual e o efeito de um RoleBinding que referencia uma ClusterRole?',
      options: [
        'A ClusterRole passa a ter efeito em todo o cluster para o sujeito vinculado',
        'As permissoes da ClusterRole sao limitadas ao namespace do RoleBinding',
        'Isso nao e permitido, RoleBinding so pode referenciar Role',
        'A ClusterRole e copiada para o namespace como um Role'
      ],
      correct: 1,
      explanation: 'Um RoleBinding pode referenciar uma ClusterRole, mas as permissoes ficam restritas ao namespace onde o RoleBinding foi criado. E uma forma de reutilizar ClusterRoles sem dar acesso a todo o cluster.'
    },
    {
      question: 'Como criar rapidamente um Role chamado "deployer" que permita criar e atualizar Deployments no namespace "apps"?',
      options: [
        'kubectl create role deployer --verb=create,update --resource=deployments -n apps',
        'kubectl apply role deployer --permissions=create,update --for=deployments -n apps',
        'kubectl role create deployer --actions=create,update --resources=deployments -n apps',
        'kubectl new role deployer --verb=create,update --resource=apps/deployments'
      ],
      correct: 0,
      explanation: 'O comando imperativo correto e "kubectl create role" com as flags --verb para os verbos permitidos e --resource para os recursos. A flag -n especifica o namespace.'
    },
    {
      question: 'Qual e a forma correta de referenciar um ServiceAccount chamado "monitor-sa" no namespace "monitoring" em um RoleBinding?',
      options: [
        'kind: ServiceAccount, name: monitor-sa (sem namespace)',
        'kind: ServiceAccount, name: monitoring:monitor-sa',
        'kind: ServiceAccount, name: monitor-sa, namespace: monitoring',
        'kind: User, name: system:serviceaccount:monitoring:monitor-sa'
      ],
      correct: 2,
      explanation: 'No campo subjects de um RoleBinding ou ClusterRoleBinding, um ServiceAccount e referenciado com kind: ServiceAccount, name: <nome-do-sa> e namespace: <namespace-do-sa>. O namespace e obrigatorio para ServiceAccounts.'
    },
    {
      question: 'O que significa "aggregationRule" em uma ClusterRole?',
      options: [
        'Permite que a ClusterRole herde regras de outras ClusterRoles selecionadas por label automaticamente',
        'Define quantas regras podem ser adicionadas a ClusterRole',
        'Agrega multiplos RoleBindings em um unico objeto',
        'E um alias para aggregateToAdmin nas ClusterRoles built-in'
      ],
      correct: 0,
      explanation: 'aggregationRule permite criar uma ClusterRole cujas rules sao preenchidas automaticamente pelo controller, coletando as rules de outras ClusterRoles que possuem labels correspondentes aos clusterRoleSelectors. As ClusterRoles built-in (admin, edit, view) usam esse mecanismo.'
    },
    {
      question: 'Um administrador adicionou "resourceNames: [\'prod-secret\']" a uma regra de Role para configmaps. Qual acao NAO funcionara para outros configmaps?',
      options: [
        'get prod-secret',
        'update prod-secret',
        'list (todos os configmaps)',
        'patch prod-secret'
      ],
      correct: 2,
      explanation: 'resourceNames restringe o acesso apenas aos recursos com aqueles nomes especificos. No entanto, "list" e "watch" operam em colecoes e nao em recursos individuais, portanto resourceNames nao funciona para essas operacoes — o sujeito nao conseguira listar configmaps mesmo que tenha acesso a um especifico.'
    }
  ],

  flashcards: [
    {
      front: 'O que e um Role no Kubernetes?',
      back: 'Um objeto RBAC que define permissoes (rules) dentro de um namespace especifico. Especifica quais verbos (get, list, create...) sao permitidos em quais recursos (pods, services...) de quais apiGroups.'
    },
    {
      front: 'Qual e a diferenca entre RoleBinding e ClusterRoleBinding?',
      back: 'RoleBinding vincula um sujeito a um Role ou ClusterRole dentro de um namespace especifico. ClusterRoleBinding vincula um sujeito a uma ClusterRole em todo o cluster. RoleBinding nunca pode referenciar um Role de outro namespace.'
    },
    {
      front: 'Quais sao os tres tipos de subjects em um RoleBinding?',
      back: '1. User - usuario autenticado (ex: joao)\n2. Group - grupo de usuarios (ex: dev-team)\n3. ServiceAccount - identidade para processos em Pods (ex: system:serviceaccount:namespace:name)'
    },
    {
      front: 'Como verificar todas as permissoes do usuario atual?',
      back: 'kubectl auth can-i --list\n\nPara um namespace especifico:\nkubectl auth can-i --list -n <namespace>\n\nPara impersonar outro usuario:\nkubectl auth can-i --list --as=<usuario>'
    },
    {
      front: 'Qual apiGroup usar para Deployments e StatefulSets em regras RBAC?',
      back: 'apiGroups: ["apps"]\n\nExemplo:\nrules:\n- apiGroups: ["apps"]\n  resources: ["deployments", "statefulsets"]\n  verbs: ["get", "list", "create", "update"]'
    },
    {
      front: 'O que sao as ClusterRoles built-in cluster-admin, admin, edit e view?',
      back: 'cluster-admin: acesso irrestrito a tudo\nadmin: acesso administrativo em namespace (incluindo RBAC)\nedit: leitura e escrita de recursos, sem gerenciar RBAC\nview: somente leitura de recursos (nao inclui secrets)'
    },
    {
      front: 'Como restringir uma regra RBAC a recursos especificos por nome?',
      back: 'Usar o campo resourceNames:\n\nrules:\n- apiGroups: [""]\n  resources: ["configmaps"]\n  resourceNames: ["app-config", "db-config"]\n  verbs: ["get", "update"]\n\nAtencao: resourceNames nao funciona com "list" e "watch".'
    },
    {
      front: 'Como criar um RoleBinding via linha de comando associando um ServiceAccount?',
      back: 'kubectl create rolebinding <nome> \\\n  --role=<role-name> \\\n  --serviceaccount=<namespace>:<sa-name> \\\n  -n <namespace>\n\nExemplo:\nkubectl create rolebinding app-binding \\\n  --role=pod-reader \\\n  --serviceaccount=production:app-sa \\\n  -n production'
    },
    {
      front: 'O que sao Aggregated ClusterRoles e como funcionam?',
      back: 'ClusterRoles com aggregationRule coletam rules de outras ClusterRoles automaticamente via labels.\n\nPara adicionar permissoes a ClusterRole "edit":\nadicione a label:\n  rbac.authorization.k8s.io/aggregate-to-edit: "true"\n\nO controller combina as rules automaticamente.'
    },
    {
      front: 'Qual o caminho do token de um ServiceAccount dentro de um Pod?',
      back: '/var/run/secrets/kubernetes.io/serviceaccount/token\n\nArquivos disponiveis:\n- token: JWT para autenticar no API Server\n- ca.crt: certificado CA do cluster\n- namespace: namespace do Pod\n\nUsado por bibliotecas cliente (client-go, python-kubernetes) automaticamente.'
    },
    {
      front: 'Como diagnosticar um erro 403 Forbidden de um Pod ao acessar o API Server?',
      back: '1. kubectl get pod <nome> -o jsonpath=\'{.spec.serviceAccountName}\'\n2. kubectl auth can-i <verbo> <recurso> \\\n     --as=system:serviceaccount:<ns>:<sa> -n <ns>\n3. kubectl auth can-i --list \\\n     --as=system:serviceaccount:<ns>:<sa>\n4. Criar Role + RoleBinding para o SA\n5. kubectl set serviceaccount deployment/<nome> <sa>'
    },
    {
      front: 'Qual e a diferenca entre os verbos "update" e "patch" no RBAC?',
      back: 'update (PUT): substitui o objeto inteiro. Requer enviar o manifest completo.\n\npatch (PATCH): modifica parcialmente o objeto. Permite alterar apenas campos especificos.\n\nExemplo pratico:\nkubectl edit usa patch\nkubectl apply usa patch ou update\nkubectl replace usa update (PUT)'
    }
  ],

  lab: {
    scenario: 'A equipe de desenvolvimento precisa de acesso controlado ao cluster de staging. O time de devs deve poder visualizar pods e logs, mas nao modificar nada. Um ServiceAccount para a aplicacao de monitoramento precisa listar pods e endpoints em todos os namespaces. Um CI/CD pipeline precisa de permissao para fazer deploy de Deployments no namespace "apps".',
    objective: 'Criar Roles, ClusterRoles, RoleBindings e ServiceAccounts com permissoes especificas, validando cada permissao com kubectl auth can-i e testando cenarios de negacao.',
    steps: [
      {
        title: 'Criar namespaces e ServiceAccounts base',
        instruction: 'Crie os namespaces "staging", "monitoring" e "apps". Crie um ServiceAccount chamado "monitor-sa" no namespace "monitoring" e um ServiceAccount "cicd-sa" no namespace "apps".',
        hints: [
          'Use kubectl create namespace para criar os namespaces',
          'Use kubectl create serviceaccount para o ServiceAccount',
          'Verifique com kubectl get serviceaccount -n monitoring'
        ],
        solution: '\`\`\`bash\nkubectl create namespace staging\nkubectl create namespace monitoring\nkubectl create namespace apps\nkubectl create serviceaccount monitor-sa -n monitoring\nkubectl create serviceaccount cicd-sa -n apps\nkubectl get serviceaccount -n monitoring\nkubectl get serviceaccount -n apps\n\`\`\`'
      },
      {
        title: 'Criar Role e RoleBinding para o time de desenvolvimento',
        instruction: 'Crie um Role chamado "dev-viewer" no namespace "staging" que permita get, list e watch nos recursos pods, pods/log e services. Crie um RoleBinding vinculando o usuario "dev-user" e o grupo "dev-team" ao Role. Valide as permissoes com kubectl auth can-i.',
        hints: [
          'kubectl create role aceita --verb e --resource',
          'Para pods/log use --resource=pods/log (subrecurso)',
          'Use --dry-run=client -o yaml para ver o YAML antes de criar',
          'Adicione o grupo ao RoleBinding via kubectl patch'
        ],
        solution: '\`\`\`bash\n# Criar o Role\nkubectl create role dev-viewer \\\n  --verb=get,list,watch \\\n  --resource=pods,pods/log,services \\\n  -n staging\n\n# Verificar o YAML criado\nkubectl get role dev-viewer -n staging -o yaml\n\n# Criar RoleBinding com usuario\nkubectl create rolebinding dev-viewer-binding \\\n  --role=dev-viewer \\\n  --user=dev-user \\\n  -n staging\n\n# Adicionar grupo ao RoleBinding\nkubectl patch rolebinding dev-viewer-binding -n staging \\\n  --type=json \\\n  -p \'[{"op":"add","path":"/subjects/-","value":{"kind":"Group","name":"dev-team","apiGroup":"rbac.authorization.k8s.io"}}]\'\n\n# Validar permissoes\nkubectl auth can-i list pods --as=dev-user -n staging         # yes\nkubectl auth can-i delete pods --as=dev-user -n staging       # no\nkubectl auth can-i list pods --as=dev-user -n production      # no\nkubectl auth can-i get pods/log --as=dev-user -n staging      # yes\n\`\`\`'
      },
      {
        title: 'Criar ClusterRole e ClusterRoleBinding para monitoramento',
        instruction: 'Crie um ClusterRole chamado "cluster-monitor" que permita get, list e watch em pods, endpoints e nodes. Vincule o ServiceAccount "monitor-sa" do namespace "monitoring" via ClusterRoleBinding. Valide acesso em diferentes namespaces.',
        hints: [
          'endpoints esta no core group (apiGroup vazio)',
          'nodes e um recurso nao-namespaced, exige ClusterRole',
          'Para ServiceAccount use --serviceaccount=namespace:nome',
          'Teste em namespaces diferentes para confirmar acesso global'
        ],
        solution: '\`\`\`bash\n# Criar ClusterRole\nkubectl create clusterrole cluster-monitor \\\n  --verb=get,list,watch \\\n  --resource=pods,endpoints,nodes\n\n# Verificar\nkubectl get clusterrole cluster-monitor -o yaml\n\n# Criar ClusterRoleBinding\nkubectl create clusterrolebinding monitor-binding \\\n  --clusterrole=cluster-monitor \\\n  --serviceaccount=monitoring:monitor-sa\n\n# Validar acesso global\nkubectl auth can-i list pods \\\n  --as=system:serviceaccount:monitoring:monitor-sa -n staging\nkubectl auth can-i list pods \\\n  --as=system:serviceaccount:monitoring:monitor-sa -n kube-system\nkubectl auth can-i list nodes \\\n  --as=system:serviceaccount:monitoring:monitor-sa\n\n# Confirmar que nao tem acesso a operacoes destrutivas\nkubectl auth can-i delete pods \\\n  --as=system:serviceaccount:monitoring:monitor-sa\n\`\`\`'
      },
      {
        title: 'Configurar ServiceAccount de CI/CD para deploy',
        instruction: 'Crie um Role "cicd-deployer" no namespace "apps" que permita operacoes completas (get, list, create, update, patch) em deployments e services. Vincule ao ServiceAccount "cicd-sa". Teste que o SA pode criar deployments mas nao pode deletar namespaces.',
        hints: [
          'Deployments estao no apiGroup "apps"',
          'Services estao no core group (string vazia)',
          'Use --resource=deployments para o apiGroup "apps"',
          'Lembre-se: a flag --resource nao aceita apiGroup explicito no comando imperativo'
        ],
        solution: '\`\`\`bash\n# Criar Role para CI/CD (deployments no grupo apps)\nkubectl create role cicd-deployer \\\n  --verb=get,list,watch,create,update,patch \\\n  --resource=deployments \\\n  -n apps\n\n# Adicionar permissao para services (core group)\nkubectl patch role cicd-deployer -n apps \\\n  --type=json \\\n  -p \'[{"op":"add","path":"/rules/-","value":{"apiGroups":[""],"resources":["services","configmaps"],"verbs":["get","list","create","update","patch"]}}]\'\n\n# Criar RoleBinding\nkubectl create rolebinding cicd-binding \\\n  --role=cicd-deployer \\\n  --serviceaccount=apps:cicd-sa \\\n  -n apps\n\n# Validar permissoes\nkubectl auth can-i create deployments \\\n  --as=system:serviceaccount:apps:cicd-sa -n apps     # yes\nkubectl auth can-i delete deployments \\\n  --as=system:serviceaccount:apps:cicd-sa -n apps     # no\nkubectl auth can-i delete namespaces \\\n  --as=system:serviceaccount:apps:cicd-sa             # no\n\n# Ver todas as permissoes do cicd-sa\nkubectl auth can-i --list \\\n  --as=system:serviceaccount:apps:cicd-sa -n apps\n\`\`\`'
      },
      {
        title: 'Usar ClusterRole built-in com RoleBinding (reutilizacao)',
        instruction: 'Atribua ao usuario "ns-admin" o papel de administrador completo APENAS no namespace "staging", reutilizando a ClusterRole built-in "admin". Confirme que ele tem acesso admin no namespace mas nao pode gerenciar nodes ou outros namespaces.',
        hints: [
          'Use RoleBinding (nao ClusterRoleBinding) referenciando a ClusterRole "admin"',
          'Isso limita o efeito ao namespace do RoleBinding',
          'kubectl auth can-i --list mostra todas as permissoes'
        ],
        solution: '\`\`\`bash\n# RoleBinding referenciando ClusterRole built-in\nkubectl create rolebinding ns-admin-binding \\\n  --clusterrole=admin \\\n  --user=ns-admin \\\n  -n staging\n\n# Validar: tem acesso admin em staging\nkubectl auth can-i create deployments --as=ns-admin -n staging     # yes\nkubectl auth can-i delete pods --as=ns-admin -n staging             # yes\nkubectl auth can-i create rolebindings --as=ns-admin -n staging     # yes\n\n# Validar: NAO tem acesso fora do namespace\nkubectl auth can-i create deployments --as=ns-admin -n production   # no\nkubectl auth can-i list nodes --as=ns-admin                         # no\nkubectl auth can-i list namespaces --as=ns-admin                    # no\n\n# Ver todas as permissoes no namespace staging\nkubectl auth can-i --list --as=ns-admin -n staging\n\`\`\`'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod nao consegue acessar a API do Kubernetes - Forbidden 403',
      symptom: 'Uma aplicacao rodando em um Pod retorna erro "403 Forbidden" ao tentar listar ConfigMaps ou outros recursos via API do Kubernetes. Os logs mostram: "configmaps is forbidden: User \\"system:serviceaccount:default:default\\" cannot list resource \\"configmaps\\" in API group \\"\\" in the namespace \\"default\\""',
      diagnosis: '\`\`\`bash\n# 1. Identificar o ServiceAccount usado pelo Pod\nkubectl get pod <pod-name> -o jsonpath=\'{.spec.serviceAccountName}\'\n\n# 2. Verificar se o SA tem permissoes\nkubectl auth can-i list configmaps \\\n  --as=system:serviceaccount:<namespace>:<sa-name> \\\n  -n <namespace>\n\n# 3. Listar todas as permissoes do SA\nkubectl auth can-i --list \\\n  --as=system:serviceaccount:<namespace>:<sa-name> \\\n  -n <namespace>\n\n# 4. Listar RoleBindings que referenciam o SA\nkubectl get rolebindings -n <namespace> -o yaml | grep -B5 -A5 <sa-name>\n\n# 5. Verificar se existe RBAC configurado\nkubectl get role,rolebinding -n <namespace>\nkubectl get clusterrole,clusterrolebinding | grep <sa-name>\n\`\`\`',
      solution: '\`\`\`bash\n# 1. Criar ServiceAccount dedicado (nao usar o default)\nkubectl create serviceaccount app-sa -n <namespace>\n\n# 2. Criar Role com as permissoes necessarias\nkubectl create role app-role \\\n  --verb=get,list,watch \\\n  --resource=configmaps \\\n  -n <namespace>\n\n# 3. Criar RoleBinding\nkubectl create rolebinding app-rolebinding \\\n  --role=app-role \\\n  --serviceaccount=<namespace>:app-sa \\\n  -n <namespace>\n\n# 4. Atualizar o Deployment para usar o SA correto\nkubectl set serviceaccount deployment/<deploy-name> app-sa -n <namespace>\n\n# 5. Validar\nkubectl auth can-i list configmaps \\\n  --as=system:serviceaccount:<namespace>:app-sa \\\n  -n <namespace>\n\`\`\`'
    },
    {
      title: 'RoleBinding criado mas permissao ainda negada',
      symptom: 'Um RoleBinding foi criado vinculando um usuario a um Role, mas o comando "kubectl auth can-i" ainda retorna "no". O usuario nao consegue executar as acoes esperadas mesmo com o binding existindo.',
      diagnosis: '\`\`\`bash\n# 1. Verificar se o RoleBinding existe no namespace correto\nkubectl get rolebinding -n <namespace>\n\n# 2. Inspecionar subjects e roleRef do RoleBinding\nkubectl get rolebinding <binding-name> -n <namespace> -o yaml\n\n# 3. Verificar o Role referenciado e suas regras\nkubectl get role <role-name> -n <namespace> -o yaml\n\n# 4. Confirmar o nome exato do usuario (case-sensitive!)\nkubectl auth can-i list pods --as=<usuario-exato> -n <namespace>\n\n# 5. Verificar se o usuario esta tentando acessar no namespace correto\nkubectl auth can-i --list --as=<usuario> -n <namespace>\n\n# 6. Confirmar que o apiGroup nos verbos esta correto\nkubectl api-resources | grep <recurso-alvo>\n\`\`\`',
      solution: '\`\`\`bash\n# Causa 1: nome de usuario incorreto (case-sensitive)\nkubectl edit rolebinding <binding-name> -n <namespace>\n# Ajustar subjects[].name para o nome exato\n\n# Causa 2: namespace errado\nkubectl get rolebinding --all-namespaces | grep <binding-name>\n# Recriar no namespace correto\n\n# Causa 3: recurso escrito incorretamente no Role\nkubectl api-resources | grep <recurso>\n# Usar o nome correto (ex: "deployments" nao "deployment")\n\n# Causa 4: verbo nao incluso no Role\nkubectl get role <role-name> -n <namespace> -o jsonpath=\'{.rules}\'\n# Adicionar o verbo faltante\nkubectl edit role <role-name> -n <namespace>\n\n# Causa 5: apiGroup errado para o recurso\n# Deployments precisam de apiGroups: ["apps"] nao [""]\nkubectl get role <role-name> -n <namespace> -o yaml\n# Corrigir o apiGroup\n\`\`\`'
    },
    {
      title: 'ClusterRoleBinding da acesso mais amplo que o esperado',
      symptom: 'Um usuario ou ServiceAccount tem acesso a recursos em namespaces que nao deveria. O administrador criou um binding pensando em restringir o acesso a um namespace, mas o sujeito consegue operar em todo o cluster.',
      diagnosis: '\`\`\`bash\n# 1. Verificar se existe ClusterRoleBinding (nao apenas RoleBinding)\nkubectl get clusterrolebinding | grep <usuario-ou-sa>\n\n# 2. Ver detalhes do ClusterRoleBinding\nkubectl get clusterrolebinding <nome> -o yaml\n\n# 3. Confirmar acesso indevido\nkubectl auth can-i list pods --as=<usuario> -n kube-system    # deveria ser "no"\nkubectl auth can-i list pods --as=<usuario> -n production      # deveria ser "no"\n\n# 4. Listar todos os bindings do usuario\nkubectl get rolebindings,clusterrolebindings --all-namespaces \\\n  -o yaml | grep -B10 <nome-do-usuario>\n\`\`\`',
      solution: '\`\`\`bash\n# O problema e que um ClusterRoleBinding foi criado em vez de RoleBinding\n# ClusterRoleBinding sempre da acesso em todo o cluster\n\n# 1. Deletar o ClusterRoleBinding incorreto\nkubectl delete clusterrolebinding <nome-do-binding>\n\n# 2. Criar RoleBinding no namespace correto (restringe o escopo)\nkubectl create rolebinding <nome-do-binding> \\\n  --clusterrole=<clusterrole-name> \\\n  --user=<usuario> \\\n  -n <namespace-desejado>\n\n# 3. Validar que o acesso agora e restrito\nkubectl auth can-i list pods --as=<usuario> -n <namespace-desejado>  # yes\nkubectl auth can-i list pods --as=<usuario> -n outro-namespace        # no\nkubectl auth can-i list nodes --as=<usuario>                          # no\n\`\`\`'
    }
  ]
};
