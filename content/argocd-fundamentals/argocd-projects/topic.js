window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['argocd-fundamentals/argocd-projects'] = {
  theory: `
# ArgoCD Projects & RBAC

## Relevancia
AppProjects sao o mecanismo de multi-tenancy do ArgoCD. Eles restringem quais repositorios, clusters e namespaces uma Application pode acessar, e combinados com RBAC, permitem isolamento seguro entre equipes. Essencial para ambientes corporativos com multiplas equipes usando o mesmo ArgoCD.

## Conceitos Fundamentais

### O que e um AppProject?

Um AppProject e um CRD do ArgoCD que define **boundaries** (limites) para Applications:

- **Quais repositorios** podem ser usados como source
- **Quais clusters/namespaces** podem ser usados como destination
- **Quais recursos** podem ser criados (whitelisted/blacklisted)
- **Quais roles** tem acesso e quais acoes podem executar

### Projeto Default

O ArgoCD vem com um projeto \`default\` que permite tudo:
\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: default
  namespace: argocd
spec:
  sourceRepos:
    - '*'              # qualquer repositorio
  destinations:
    - namespace: '*'   # qualquer namespace
      server: '*'      # qualquer cluster
  clusterResourceWhitelist:
    - group: '*'
      kind: '*'        # qualquer recurso cluster-scoped
\`\`\`

### Projeto Restrito (Producao)

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: team-backend
  namespace: argocd
spec:
  description: "Projeto para a equipe de backend"

  # Repositorios permitidos
  sourceRepos:
    - 'https://github.com/myorg/backend-*'
    - 'https://charts.bitnami.com/bitnami'

  # Destinos permitidos
  destinations:
    - namespace: 'backend-*'
      server: https://kubernetes.default.svc
    - namespace: 'backend-*'
      server: https://prod-cluster.example.com

  # Recursos namespace-scoped permitidos
  namespaceResourceWhitelist:
    - group: ''
      kind: ConfigMap
    - group: ''
      kind: Secret
    - group: ''
      kind: Service
    - group: apps
      kind: Deployment
    - group: apps
      kind: StatefulSet
    - group: networking.k8s.io
      kind: Ingress
    - group: batch
      kind: Job
    - group: batch
      kind: CronJob

  # Recursos cluster-scoped permitidos (vazio = nenhum)
  clusterResourceWhitelist: []

  # Recursos bloqueados (tem precedencia sobre whitelist)
  namespaceResourceBlacklist:
    - group: ''
      kind: ResourceQuota
    - group: ''
      kind: LimitRange

  # Janelas de sync (quando sync e permitido)
  syncWindows:
    - kind: allow
      schedule: '0 8-18 * * 1-5'  # seg-sex, 8h-18h
      duration: 10h
      applications: ['*']
    - kind: deny
      schedule: '0 0 * * 0'       # domingos
      duration: 24h
      applications: ['*']

  # Roles do projeto
  roles:
    - name: developer
      description: "Acesso read-only + sync manual"
      policies:
        - p, proj:team-backend:developer, applications, get, team-backend/*, allow
        - p, proj:team-backend:developer, applications, sync, team-backend/*, allow
      groups:
        - backend-developers  # grupo SSO

    - name: admin
      description: "Acesso total ao projeto"
      policies:
        - p, proj:team-backend:admin, applications, *, team-backend/*, allow
      groups:
        - backend-leads

  # Orphaned resources monitoring
  orphanedResources:
    warn: true
    ignore:
      - group: ''
        kind: ConfigMap
        name: kube-root-ca.crt
\`\`\`

### RBAC do ArgoCD

O RBAC e configurado no ConfigMap \`argocd-rbac-cm\`:

\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  # Politica padrao para usuarios autenticados
  policy.default: role:readonly

  # Politicas customizadas (formato Casbin)
  policy.csv: |
    # Admins — acesso total
    p, role:admin, applications, *, */*, allow
    p, role:admin, clusters, *, *, allow
    p, role:admin, repositories, *, *, allow
    p, role:admin, projects, *, *, allow

    # Developers — apenas sync e get
    p, role:developer, applications, get, */*, allow
    p, role:developer, applications, sync, */*, allow
    p, role:developer, applications, action/*, */*, allow
    p, role:developer, repositories, get, *, allow
    p, role:developer, projects, get, *, allow

    # DevOps — gerenciar apps e repos
    p, role:devops, applications, *, */*, allow
    p, role:devops, repositories, *, *, allow
    p, role:devops, projects, get, *, allow

    # Mapear grupos SSO para roles
    g, admin-team, role:admin
    g, dev-team, role:developer
    g, devops-team, role:devops

  # Scope dos grupos (quais claims OIDC usar)
  scopes: '[groups, email]'
\`\`\`

### Formato de Politicas RBAC

\`\`\`
p, <role/user/group>, <resource>, <action>, <object>, <allow/deny>

Resources: applications, clusters, repositories, projects, accounts, certificates, gpgkeys, logs, exec
Actions: get, create, update, delete, sync, override, action/<action-name>, *
Object: <project>/<application> ou * para todos
\`\`\`

### Sync Windows (Janelas de Deploy)

\`\`\`yaml
spec:
  syncWindows:
    # Permitir sync seg-sex, 8h-18h
    - kind: allow
      schedule: '0 8 * * 1-5'
      duration: 10h
      applications: ['*']
      namespaces: ['*']
      clusters: ['*']
      manualSync: true    # permite sync manual fora da janela

    # Bloquear sync em horario de pico
    - kind: deny
      schedule: '0 12 * * *'
      duration: 1h
      applications: ['critical-*']

    # Bloquear sync no fim de semana
    - kind: deny
      schedule: '0 0 * * 0,6'
      duration: 24h
      applications: ['*']
\`\`\`

### SSO com Dex (OIDC)

\`\`\`yaml
# argocd-cm ConfigMap
data:
  dex.config: |
    connectors:
      - type: github
        id: github
        name: GitHub
        config:
          clientID: \$dex.github.clientID
          clientSecret: \$dex.github.clientSecret
          orgs:
            - name: my-org
              teams:
                - backend-team
                - devops-team
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Listar projetos
argocd proj list

# Criar projeto
argocd proj create team-backend \\
  --src 'https://github.com/org/backend-*' \\
  --dest 'https://kubernetes.default.svc,backend-*' \\
  --description "Backend team project"

# Adicionar source repo
argocd proj add-source team-backend https://github.com/org/new-repo.git

# Adicionar destination
argocd proj add-destination team-backend https://kubernetes.default.svc backend-prod

# Remover destination
argocd proj remove-destination team-backend https://kubernetes.default.svc backend-staging

# Ver detalhes do projeto
argocd proj get team-backend

# Adicionar role
argocd proj role create team-backend developer

# Adicionar policy a role
argocd proj role add-policy team-backend developer \\
  --action get \\
  --permission allow \\
  --object 'team-backend/*'

# Adicionar grupo SSO a role
argocd proj role add-group team-backend developer backend-developers

# Listar roles do projeto
argocd proj role list team-backend

# Adicionar sync window
argocd proj windows add team-backend \\
  --kind allow \\
  --schedule '0 8-18 * * 1-5' \\
  --duration 10h \\
  --applications '*'
\`\`\`

## Erros Comuns

1. **Usar o projeto default em producao**: O projeto default permite tudo. Sempre crie projetos especificos com restricoes adequadas.
2. **Whitelist muito restritiva**: Se nao incluir todos os recursos necessarios (ex: ServiceAccount, RoleBinding), o sync falha parcialmente.
3. **Esquecer clusterResourceWhitelist**: Sem definir, nenhum recurso cluster-scoped pode ser criado (Namespace, ClusterRole, etc.).
4. **Sync windows bloqueando deploys urgentes**: Configure \`manualSync: true\` nas deny windows para permitir sync manual emergencial.
5. **RBAC policy.default muito permissivo**: O padrao deve ser \`role:readonly\` ou vazio. Nunca use \`role:admin\` como default.
6. **Nao mapear grupos SSO**: Configurar SSO sem mapear grupos para roles deixa usuarios sem acesso (ou com acesso default).

## Killer.sh Style Challenge

**Cenario:** Configure multi-tenancy no ArgoCD para duas equipes.

**Tarefas:**
1. Crie um AppProject "team-frontend" restrito ao repositorio frontend e namespaces frontend-*
2. Crie um AppProject "team-backend" restrito ao repositorio backend e namespaces backend-*
3. Configure roles: developer (read + sync), admin (full access)
4. Configure sync windows: permitir deploy apenas seg-sex 8h-18h
5. Configure RBAC global com policy.default: role:readonly
`,
  quiz: [
    {
      question: 'Qual a funcao principal de um AppProject no ArgoCD?',
      options: [
        'Agrupar repositorios Git',
        'Definir boundaries (limites) para Applications: quais repos, clusters e namespaces podem ser acessados',
        'Gerenciar versoes de Helm charts',
        'Monitorar a saude dos pods'
      ],
      correct: 1,
      explanation: 'AppProjects definem boundaries de seguranca: quais repositorios podem ser usados como source, quais clusters/namespaces como destination, quais recursos podem ser criados, e quais roles/usuarios tem acesso. Sao o mecanismo de multi-tenancy do ArgoCD.',
      reference: 'Conceito relacionado: argocd-applications — toda Application deve pertencer a um project.'
    },
    {
      question: 'Qual a configuracao recomendada para policy.default no RBAC do ArgoCD em producao?',
      options: [
        'role:admin',
        'role:readonly',
        'role:developer',
        'Nao definir nenhum default'
      ],
      correct: 1,
      explanation: 'Em producao, policy.default deve ser role:readonly. Isso garante que usuarios autenticados (via SSO) tenham acesso de leitura por padrao, precisando de permissao explicita para acoes como sync, create ou delete. Usar role:admin como default e um risco de seguranca critico.',
      reference: 'Conceito relacionado: argocd-projects — roles dentro do projeto refinam o acesso alem do RBAC global.'
    },
    {
      question: 'O que acontece se clusterResourceWhitelist estiver vazio em um AppProject?',
      options: [
        'Todos os recursos cluster-scoped sao permitidos',
        'Nenhum recurso cluster-scoped pode ser criado (Namespace, ClusterRole, etc.)',
        'Apenas Namespaces sao permitidos',
        'O projeto e invalido'
      ],
      correct: 1,
      explanation: 'Com clusterResourceWhitelist vazio, nenhum recurso cluster-scoped pode ser criado pelo projeto. Isso inclui Namespace, ClusterRole, ClusterRoleBinding, etc. Se a Application precisar criar namespaces, e necessario incluir Namespace na whitelist ou usar syncOptions: CreateNamespace=true.',
      reference: 'Conceito relacionado: argocd-sync-strategies — CreateNamespace=true em syncOptions pode contornar a restricao de Namespace.'
    },
    {
      question: 'Como funciona uma sync window do tipo "deny" no ArgoCD?',
      options: [
        'Permite sync apenas durante o horario definido',
        'Bloqueia qualquer sync automatico ou manual durante o horario definido',
        'Deleta Applications durante o horario',
        'Desativa o ArgoCD durante o periodo'
      ],
      correct: 1,
      explanation: 'Uma deny window bloqueia syncs durante o periodo definido. Por padrao, bloqueia tanto auto-sync quanto sync manual. Configure manualSync: true na window para permitir sync manual emergencial durante o periodo de deny.',
      reference: 'Conceito relacionado: argocd-sync-strategies — sync windows complementam auto-sync para controle de deploy.'
    },
    {
      question: 'Como mapear um grupo SSO (ex: GitHub team) para uma role do ArgoCD?',
      options: [
        'Via argocd-cm ConfigMap apenas',
        'Usando a diretiva "g" (group) no policy.csv do argocd-rbac-cm',
        'Via linha de comando apenas',
        'Nao e possivel — apenas usuarios individuais'
      ],
      correct: 1,
      explanation: 'A diretiva "g" (group) no policy.csv mapeia grupos para roles: "g, github-team-name, role:developer". Isso funciona com qualquer provedor OIDC (GitHub, GitLab, LDAP). Os grupos sao extraidos das claims OIDC definidas em scopes.',
      reference: 'Conceito relacionado: argocd-architecture — o Dex Server gerencia a autenticacao OIDC/SSO.'
    },
    {
      question: 'Qual e a precedencia entre namespaceResourceWhitelist e namespaceResourceBlacklist?',
      options: [
        'Whitelist tem precedencia',
        'Blacklist tem precedencia — recursos na blacklist sao bloqueados mesmo que estejam na whitelist',
        'Sao mutuamente exclusivos',
        'Depende da ordem no YAML'
      ],
      correct: 1,
      explanation: 'namespaceResourceBlacklist tem precedencia sobre namespaceResourceWhitelist. Se um recurso estiver em ambas as listas, ele sera bloqueado. Isso permite criar uma whitelist ampla e usar a blacklist para exceções especificas.',
      reference: 'Conceito relacionado: argocd-projects — use blacklist para bloquear recursos perigosos como ResourceQuota ou LimitRange.'
    },
    {
      question: 'O que sao orphaned resources no ArgoCD e como monitora-los?',
      options: [
        'Resources que pertencem a outro cluster',
        'Recursos no namespace da Application que nao sao gerenciados pelo ArgoCD — podem ser monitorados via orphanedResources no project',
        'Applications sem projeto',
        'Recursos que foram deletados do Git'
      ],
      correct: 1,
      explanation: 'Orphaned resources sao recursos que existem no namespace da Application mas nao sao gerenciados por nenhuma Application do ArgoCD. Configurar orphanedResources.warn: true no projeto gera alertas quando recursos orfaos sao detectados.',
      reference: 'Conceito relacionado: argocd-sync-strategies — prune remove recursos orfaos que FORAM gerenciados.'
    }
  ],
  flashcards: [
    {
      front: 'Quais restricoes um AppProject pode definir?',
      back: '1. **sourceRepos** — quais repos Git sao permitidos\n2. **destinations** — quais clusters + namespaces sao permitidos\n3. **namespaceResourceWhitelist** — recursos NS-scoped permitidos\n4. **namespaceResourceBlacklist** — recursos NS-scoped bloqueados\n5. **clusterResourceWhitelist** — recursos cluster-scoped permitidos\n6. **syncWindows** — quando sync e permitido/bloqueado\n7. **roles** — quem pode fazer o que\n8. **orphanedResources** — monitorar recursos nao gerenciados\n\nBlacklist > Whitelist (blacklist tem precedencia)'
    },
    {
      front: 'Como funciona o RBAC do ArgoCD?',
      back: '**Formato Casbin:**\n```\np, <subject>, <resource>, <action>, <object>, allow/deny\ng, <group>, <role>\n```\n\n**Exemplo:**\n```\n# Policy\np, role:dev, applications, get, */*, allow\np, role:dev, applications, sync, */*, allow\n\n# Group mapping\ng, github-devs, role:dev\n```\n\n**ConfigMap:** argocd-rbac-cm\n**Default:** policy.default: role:readonly\n\n**Resources:** applications, clusters, repositories, projects\n**Actions:** get, create, update, delete, sync, *'
    },
    {
      front: 'O que sao sync windows e como configura-las?',
      back: '**Sync Windows** controlam QUANDO sync e permitido:\n\n**allow:** permite sync durante o periodo\n**deny:** bloqueia sync durante o periodo\n\n```yaml\nsyncWindows:\n  - kind: allow\n    schedule: "0 8 * * 1-5"  # cron\n    duration: 10h\n    applications: ["*"]\n    manualSync: true  # permite manual em deny\n```\n\n**Exemplos:**\n- Permitir apenas horario comercial\n- Bloquear fim de semana\n- Bloquear horario de pico (12h-13h)\n\n**manualSync: true** permite sync manual em windows deny (emergencia).'
    },
    {
      front: 'Qual a diferenca entre RBAC global e roles de projeto?',
      back: '**RBAC Global (argocd-rbac-cm):**\n- Afeta TODAS as Applications e projetos\n- Definido pelo admin do ArgoCD\n- Usa policy.csv com formato Casbin\n- Mapeia grupos SSO → roles\n\n**Roles de Projeto (AppProject.spec.roles):**\n- Afeta apenas Applications DO projeto\n- Definido pelo admin do projeto\n- Scoped ao projeto especifico\n- Complementa (nao substitui) RBAC global\n\n**Precedencia:** RBAC global → projeto → default policy\n\n**Best practice:** RBAC global para roles gerais, projeto para roles especificos.'
    },
    {
      front: 'Como configurar SSO com GitHub no ArgoCD?',
      back: '**1. Configurar Dex (argocd-cm):**\n```yaml\ndex.config: |\n  connectors:\n    - type: github\n      id: github\n      name: GitHub\n      config:\n        clientID: $dex.github.clientID\n        clientSecret: $dex.github.clientSecret\n        orgs:\n          - name: my-org\n```\n\n**2. Criar OAuth App no GitHub:**\nSettings → Developer → OAuth Apps\nCallback: https://argocd.example.com/api/dex/callback\n\n**3. Mapear grupos (argocd-rbac-cm):**\n```\ng, my-org:team-name, role:developer\n```\n\n**4. Definir scopes:**\n```yaml\nscopes: "[groups, email]"\n```'
    },
    {
      front: 'Best practices de seguranca para ArgoCD em producao?',
      back: '1. **Nunca usar projeto default** — criar projetos por equipe\n2. **policy.default: role:readonly** — minimo privilegio\n3. **SSO obrigatorio** — desabilitar login local em producao\n4. **clusterResourceWhitelist restritivo** — evitar criacao de ClusterRoles\n5. **Sync windows** — bloquear deploys fora do horario\n6. **Audit logging** — habilitar logs de auditoria\n7. **RBAC por equipe** — roles especificos no projeto\n8. **Source repos restritos** — nao usar * em producao\n9. **Namespace isolation** — cada equipe em seus namespaces\n10. **Secrets externos** — usar External Secrets ou Vault'
    }
  ],
  lab: {
    scenario: 'Voce e o admin do ArgoCD em uma empresa com duas equipes (frontend e backend). Precisa configurar multi-tenancy seguro com projetos, RBAC e sync windows.',
    objective: 'Criar AppProjects com restricoes de source/destination, configurar RBAC com roles por equipe, e definir sync windows para controlar horarios de deploy.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar AppProject Restrito',
        instruction: `Crie um AppProject para a equipe backend com restricoes de source e destination.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: team-backend
  namespace: argocd
spec:
  description: "Backend team project"
  sourceRepos:
    - 'https://github.com/argoproj/argocd-example-apps.git'
  destinations:
    - namespace: 'backend-*'
      server: https://kubernetes.default.svc
  namespaceResourceWhitelist:
    - group: ''
      kind: ConfigMap
    - group: ''
      kind: Service
    - group: apps
      kind: Deployment
  clusterResourceWhitelist: []
EOF
\`\`\``,
        hints: [
          'sourceRepos aceita wildcards (*) para URLs',
          'destinations define clusters e namespaces permitidos',
          'clusterResourceWhitelist vazio bloqueia todos os recursos cluster-scoped'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: team-backend
  namespace: argocd
spec:
  description: "Backend team project"
  sourceRepos:
    - 'https://github.com/argoproj/argocd-example-apps.git'
  destinations:
    - namespace: 'backend-*'
      server: https://kubernetes.default.svc
  namespaceResourceWhitelist:
    - group: ''
      kind: ConfigMap
    - group: ''
      kind: Service
    - group: apps
      kind: Deployment
  clusterResourceWhitelist: []
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar projeto criado
argocd proj get team-backend
# Saida esperada: detalhes do projeto com restricoes

# Listar projetos
argocd proj list
# Saida esperada: lista contendo "team-backend"
\`\`\``
      },
      {
        title: 'Testar Restricoes do Projeto',
        instruction: `Crie uma Application no projeto e teste que as restricoes funcionam.

\`\`\`bash
# Esta deve funcionar (repo e namespace permitidos)
kubectl create namespace backend-dev
argocd app create backend-app \\
  --project team-backend \\
  --repo https://github.com/argoproj/argocd-example-apps.git \\
  --path guestbook \\
  --dest-server https://kubernetes.default.svc \\
  --dest-namespace backend-dev

# Esta deve falhar (namespace nao permitido)
argocd app create frontend-app \\
  --project team-backend \\
  --repo https://github.com/argoproj/argocd-example-apps.git \\
  --path guestbook \\
  --dest-server https://kubernetes.default.svc \\
  --dest-namespace frontend-dev
\`\`\``,
        hints: [
          'O namespace backend-dev corresponde ao pattern backend-*',
          'O namespace frontend-dev NAO corresponde ao pattern backend-*',
          'O ArgoCD rejeita Applications que violam restricoes do projeto'
        ],
        solution: `\`\`\`bash
kubectl create namespace backend-dev
argocd app create backend-app \\
  --project team-backend \\
  --repo https://github.com/argoproj/argocd-example-apps.git \\
  --path guestbook \\
  --dest-server https://kubernetes.default.svc \\
  --dest-namespace backend-dev
\`\`\``,
        verify: `\`\`\`bash
# Verificar que backend-app foi criada no projeto correto
argocd app get backend-app -o json | jq '.spec.project'
# Saida esperada: "team-backend"

# Verificar que frontend-app foi rejeitada (erro no output anterior)
argocd app list | grep frontend-app
# Saida esperada: nenhuma linha (app nao criada)
\`\`\``
      },
      {
        title: 'Configurar RBAC Global',
        instruction: `Configure RBAC no ArgoCD para definir roles com diferentes niveis de acesso.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.default: role:readonly
  policy.csv: |
    p, role:developer, applications, get, */*, allow
    p, role:developer, applications, sync, */*, allow
    p, role:developer, repositories, get, *, allow
    p, role:developer, projects, get, *, allow

    p, role:devops, applications, *, */*, allow
    p, role:devops, repositories, *, *, allow
    p, role:devops, projects, get, *, allow
    p, role:devops, clusters, get, *, allow
EOF
\`\`\``,
        hints: [
          'policy.default define o acesso padrao para usuarios autenticados',
          'role:readonly permite apenas visualizar — nenhuma acao',
          'As politicas usam formato Casbin: p, subject, resource, action, object, effect'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.default: role:readonly
  policy.csv: |
    p, role:developer, applications, get, */*, allow
    p, role:developer, applications, sync, */*, allow
    p, role:developer, repositories, get, *, allow
    p, role:developer, projects, get, *, allow
    p, role:devops, applications, *, */*, allow
    p, role:devops, repositories, *, *, allow
    p, role:devops, projects, get, *, allow
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar RBAC configurado
kubectl get cm argocd-rbac-cm -n argocd -o jsonpath='{.data.policy\\.default}'
# Saida esperada: role:readonly

# Verificar policies
kubectl get cm argocd-rbac-cm -n argocd -o jsonpath='{.data.policy\\.csv}'
# Saida esperada: politicas Casbin definidas
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: `Remova os recursos criados durante o lab.

\`\`\`bash
# Deletar Application
argocd app delete backend-app -y

# Deletar namespace
kubectl delete namespace backend-dev

# Manter o projeto para referencia ou deletar
argocd proj delete team-backend
\`\`\``,
        hints: [
          'Projetos com Applications ativas nao podem ser deletados',
          'Delete as Applications primeiro, depois o projeto',
          'O RBAC ConfigMap pode ser mantido ou revertido'
        ],
        solution: `\`\`\`bash
argocd app delete backend-app -y
kubectl delete namespace backend-dev
argocd proj delete team-backend
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o projeto foi deletado
argocd proj list | grep team-backend
# Saida esperada: nenhuma linha

# Verificar que a Application foi deletada
argocd app list | grep backend-app
# Saida esperada: nenhuma linha
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Application rejeitada — "application destination is not allowed"',
      difficulty: 'easy',
      symptom: 'Ao criar ou sincronizar uma Application, o erro "application destination {server, namespace} is not permitted in project" e retornado.',
      diagnosis: `\`\`\`bash
# Verificar destinations permitidos no projeto
argocd proj get <project-name> -o json | jq '.spec.destinations'

# Verificar a destination da Application
argocd app get <app-name> -o json | jq '.spec.destination'

# Comparar — a destination deve corresponder ao pattern do projeto
\`\`\``,
      solution: `**Solucoes:**

1. **Adicionar destination ao projeto:**
\`\`\`bash
argocd proj add-destination <project> https://kubernetes.default.svc <namespace>
\`\`\`

2. **Usar wildcard no namespace:**
\`\`\`yaml
destinations:
  - namespace: 'team-*'
    server: https://kubernetes.default.svc
\`\`\`

3. **Verificar o server URL:** O URL do cluster deve corresponder exatamente. Use \`argocd cluster list\` para ver os URLs registrados.`
    },
    {
      title: 'Sync bloqueado por sync window',
      difficulty: 'medium',
      symptom: 'O sync (automatico ou manual) falha com erro "sync not allowed by sync window" ou a Application fica OutOfSync sem sincronizar.',
      diagnosis: `\`\`\`bash
# Verificar sync windows do projeto
argocd proj windows list <project-name>

# Verificar status das windows
argocd proj get <project-name> -o json | jq '.spec.syncWindows'

# Verificar horario atual vs windows
date
\`\`\``,
      solution: `**Solucoes:**

1. **Sync manual emergencial:** Se manualSync: true estiver configurado na window:
\`\`\`bash
argocd app sync <app-name>
\`\`\`

2. **Modificar sync window:**
\`\`\`bash
# Remover window restritiva
argocd proj windows delete <project> <window-index>

# Adicionar nova window
argocd proj windows add <project> --kind allow --schedule '* * * * *' --duration 24h
\`\`\`

3. **Adicionar manualSync a deny windows:**
\`\`\`yaml
- kind: deny
  schedule: '0 0 * * 0'
  duration: 24h
  manualSync: true  # permite sync manual em emergencia
\`\`\``
    },
    {
      title: 'RBAC nao funciona apos configurar SSO',
      difficulty: 'hard',
      symptom: 'Usuarios autenticados via SSO (GitHub/OIDC) nao conseguem executar acoes permitidas pela politica RBAC. Todos tem apenas acesso readonly.',
      diagnosis: `\`\`\`bash
# Verificar informacoes do usuario logado
argocd account get-user-info

# Verificar se os grupos estao sendo passados
# (No Grafana/ArgoCD UI, verificar claims do token OIDC)

# Verificar scopes configurados
kubectl get cm argocd-rbac-cm -n argocd -o jsonpath='{.data.scopes}'

# Verificar policies
kubectl get cm argocd-rbac-cm -n argocd -o yaml
\`\`\``,
      solution: `**Causas comuns:**

1. **Scopes incorretos:** O campo scopes deve incluir "groups" para mapear grupos SSO:
\`\`\`yaml
data:
  scopes: '[groups, email]'
\`\`\`

2. **Nome do grupo errado:** O nome do grupo no policy.csv deve corresponder exatamente ao que o OIDC provider retorna. Para GitHub: "org:team-name".
\`\`\`yaml
g, my-org:backend-team, role:developer
\`\`\`

3. **Dex nao configurado para teams:** O conector GitHub precisa solicitar a scope "read:org":
\`\`\`yaml
dex.config: |
  connectors:
    - type: github
      config:
        loadAllGroups: true  # carregar todos os grupos
\`\`\`

4. **Cache:** Apos alterar RBAC, pode ser necessario reiniciar o argocd-server:
\`\`\`bash
kubectl rollout restart deployment argocd-server -n argocd
\`\`\``
    }
  ]
};
