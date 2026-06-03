window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['argocd-patterns/argocd-app-of-apps'] = {
  theory: `
# App of Apps & ApplicationSets

## Relevancia
Gerenciar dezenas ou centenas de Applications individualmente nao escala. O pattern **App of Apps** e os **ApplicationSets** resolvem esse problema: permitem criar e gerenciar multiplas Applications de forma declarativa e automatizada. Sao essenciais para ambientes com multiplos clusters, ambientes (dev/staging/prod) ou equipes.

## Conceitos Fundamentais

### App of Apps Pattern

O pattern App of Apps usa uma **Application pai** que gerencia outras Applications como seus recursos:

\`\`\`
Application "root-app" (pai)
  ├── Application "app-frontend"
  ├── Application "app-backend"
  ├── Application "app-database"
  ├── Application "monitoring"
  └── Application "ingress-controller"
\`\`\`

**Estrutura no Git:**
\`\`\`
apps/
├── Chart.yaml          # ou kustomization.yaml
├── templates/
│   ├── frontend.yaml   # Application para frontend
│   ├── backend.yaml    # Application para backend
│   ├── database.yaml   # Application para database
│   ├── monitoring.yaml # Application para monitoring
│   └── ingress.yaml    # Application para ingress
└── values.yaml         # valores compartilhados
\`\`\`

### Application Pai (Root App)

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root-app
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/org/gitops-config.git
    targetRevision: main
    path: apps            # pasta com templates de Applications
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd     # Applications filhas sao criadas no namespace argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
\`\`\`

### Application Filha (Template)

\`\`\`yaml
# apps/templates/backend.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: backend
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/org/backend.git
    targetRevision: main
    path: k8s/production
  destination:
    server: https://kubernetes.default.svc
    namespace: backend
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
\`\`\`

### ApplicationSet — A Evolucao

ApplicationSets sao um CRD que gera multiplas Applications automaticamente usando **generators**:

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: cluster-apps
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - cluster: dev
            url: https://dev-cluster.example.com
          - cluster: staging
            url: https://staging-cluster.example.com
          - cluster: prod
            url: https://prod-cluster.example.com
  template:
    metadata:
      name: 'myapp-{{cluster}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/app.git
        targetRevision: main
        path: 'overlays/{{cluster}}'
      destination:
        server: '{{url}}'
        namespace: myapp
\`\`\`

### Tipos de Generators

| Generator | Descricao | Caso de Uso |
|-----------|-----------|-------------|
| **List** | Lista explicita de valores | Clusters/ambientes conhecidos |
| **Cluster** | Clusters registrados no ArgoCD | Deploy automatico em novos clusters |
| **Git Directory** | Diretorios em um repo Git | Uma app por diretorio |
| **Git File** | Arquivos JSON/YAML em um repo | Config por arquivo |
| **Matrix** | Produto cartesiano de 2 generators | Combinacoes cluster x app |
| **Merge** | Merge de generators com override | Base + overrides por ambiente |
| **Pull Request** | PRs abertos de um repo | Preview environments |
| **SCM Provider** | Repos de um org (GitHub/GitLab) | Autodiscovery de repos |

### Generator: Cluster

Gera Applications automaticamente para cada cluster registrado no ArgoCD:

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: monitoring-stack
  namespace: argocd
spec:
  generators:
    - clusters:
        selector:
          matchLabels:
            environment: production
  template:
    metadata:
      name: 'monitoring-{{name}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/monitoring.git
        targetRevision: main
        path: k8s
      destination:
        server: '{{server}}'
        namespace: monitoring
\`\`\`

### Generator: Git Directory

Gera uma Application para cada diretorio no repo:

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: microservices
  namespace: argocd
spec:
  generators:
    - git:
        repoURL: https://github.com/org/microservices.git
        revision: main
        directories:
          - path: services/*
          - path: services/deprecated  # excluir
            exclude: true
  template:
    metadata:
      name: '{{path.basename}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/microservices.git
        targetRevision: main
        path: '{{path}}'
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{path.basename}}'
\`\`\`

### Generator: Matrix (Combinacoes)

Gera o produto cartesiano de dois generators:

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: all-apps-all-clusters
  namespace: argocd
spec:
  generators:
    - matrix:
        generators:
          # Generator 1: clusters
          - clusters:
              selector:
                matchLabels:
                  tier: production
          # Generator 2: apps
          - git:
              repoURL: https://github.com/org/apps.git
              revision: main
              directories:
                - path: apps/*
  template:
    metadata:
      name: '{{path.basename}}-{{name}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/apps.git
        targetRevision: main
        path: '{{path}}'
      destination:
        server: '{{server}}'
        namespace: '{{path.basename}}'
\`\`\`

### Generator: Pull Request (Preview Environments)

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: pr-previews
  namespace: argocd
spec:
  generators:
    - pullRequest:
        github:
          owner: myorg
          repo: myapp
          tokenRef:
            secretName: github-token
            key: token
        requeueAfterSeconds: 60
  template:
    metadata:
      name: 'preview-{{number}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/myorg/myapp.git
        targetRevision: '{{head_sha}}'
        path: k8s
        kustomize:
          namePrefix: 'pr-{{number}}-'
      destination:
        server: https://kubernetes.default.svc
        namespace: 'preview-{{number}}'
      syncPolicy:
        automated:
          prune: true
        syncOptions:
          - CreateNamespace=true
\`\`\`

### Sync Policy do ApplicationSet

\`\`\`yaml
spec:
  syncPolicy:
    preserveResourcesOnDeletion: false  # deleta apps ao remover do generator
    applicationsSync: create-update     # create-only, create-update, create-delete
  template:
    spec:
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Listar ApplicationSets
kubectl get applicationset -n argocd

# Ver detalhes de um ApplicationSet
kubectl get applicationset microservices -n argocd -o yaml

# Ver Applications geradas
argocd app list | grep <appset-prefix>

# Deletar ApplicationSet (e Applications geradas)
kubectl delete applicationset microservices -n argocd
\`\`\`

## Erros Comuns

1. **Nao usar finalizer nas Applications filhas**: Se a root app for deletada sem finalizers nas filhas, os recursos ficam orfaos.
2. **ApplicationSet gerando nomes duplicados**: Se dois generators produzem o mesmo nome de Application, ha conflito. Use templates com nomes unicos.
3. **Matrix generator com muitas combinacoes**: O produto cartesiano pode gerar centenas de Applications. Monitore o impacto no controller.
4. **preserveResourcesOnDeletion: false em producao**: Se um elemento for removido do generator, a Application e deletada automaticamente. Considere \`true\` para producao.
5. **PR generator sem cleanup**: Sem configurar PR closed detection, preview environments ficam ativos apos merge. Configure requeueAfterSeconds adequado.
6. **App of Apps sem auto-sync**: Se a root app nao tem auto-sync, novas Applications adicionadas ao Git nao sao criadas automaticamente.

## Killer.sh Style Challenge

**Cenario:** Configure um sistema GitOps que gerencie automaticamente Applications para multiplos microservicos em multiplos ambientes.

**Tarefas:**
1. Crie um ApplicationSet com Git Directory generator para microservicos
2. Crie um ApplicationSet com Matrix generator (clusters x apps)
3. Configure preview environments para Pull Requests
4. Configure cleanup automatico ao fechar PRs
`,
  quiz: [
    {
      question: 'Qual a diferenca principal entre App of Apps e ApplicationSet?',
      options: [
        'Sao identicos em funcionalidade',
        'App of Apps usa uma Application pai com templates manuais, ApplicationSet gera Applications automaticamente via generators',
        'App of Apps e mais novo que ApplicationSet',
        'ApplicationSet nao suporta multiplos clusters'
      ],
      correct: 1,
      explanation: 'App of Apps usa uma Application pai cujo source contem manifests de outras Applications (manualmente definidas). ApplicationSet usa generators (list, cluster, git, matrix, etc.) para gerar Applications automaticamente baseado em regras. ApplicationSet e mais escalavel e declarativo.',
      reference: 'Conceito relacionado: argocd-applications — ApplicationSets geram Applications usando o mesmo CRD.'
    },
    {
      question: 'O que o generator Matrix faz?',
      options: [
        'Gera uma unica Application com multiplas sources',
        'Gera o produto cartesiano de dois generators, criando uma Application para cada combinacao',
        'Combina multiplos repos em um',
        'Cria uma matriz de dashboards'
      ],
      correct: 1,
      explanation: 'O Matrix generator combina dois generators e gera o produto cartesiano. Ex: 3 clusters x 5 apps = 15 Applications. Cada combinacao gera uma Application unica. Util para deploy de todos os microservicos em todos os clusters.',
      reference: 'Conceito relacionado: argocd-app-of-apps — Matrix e ideal quando precisa combinar clusters com aplicacoes.'
    },
    {
      question: 'Qual generator e ideal para criar preview environments para Pull Requests?',
      options: [
        'List generator',
        'Cluster generator',
        'Pull Request generator',
        'Git Directory generator'
      ],
      correct: 2,
      explanation: 'O Pull Request generator cria uma Application para cada PR aberto no repositorio. Quando o PR e fechado/merged, a Application (e o namespace de preview) sao removidos automaticamente. Ideal para ambientes efemeros de teste/review.',
      reference: 'Conceito relacionado: argocd-sync-strategies — use syncPolicy.automated com prune e CreateNamespace para preview environments.'
    },
    {
      question: 'O que acontece com preserveResourcesOnDeletion: false em um ApplicationSet?',
      options: [
        'Os recursos Kubernetes sao preservados',
        'Quando um elemento e removido do generator, a Application E seus recursos sao deletados automaticamente',
        'O ApplicationSet e protegido contra delecao',
        'Apenas a Application e removida, recursos ficam no cluster'
      ],
      correct: 1,
      explanation: 'Com preserveResourcesOnDeletion: false (padrao), remover um elemento do generator faz o ApplicationSet deletar a Application correspondente, que por sua vez deleta os recursos do cluster (se tiver finalizer). Em producao, considere true para protecao adicional.',
      reference: 'Conceito relacionado: argocd-applications — o finalizer na Application controla se recursos sao deletados junto.'
    },
    {
      question: 'Como o Git Directory generator decide quantas Applications criar?',
      options: [
        'Baseado no numero de arquivos YAML',
        'Uma Application para cada diretorio que corresponde ao path pattern configurado',
        'Baseado em labels nos arquivos',
        'Baseado no numero de branches'
      ],
      correct: 1,
      explanation: 'O Git Directory generator cria uma Application para cada diretorio que corresponde ao path pattern (ex: services/*). Novos diretorios sao automaticamente detectados e geram novas Applications. Diretorios podem ser excluidos com exclude: true.',
      reference: 'Conceito relacionado: argocd-app-of-apps — compare Git Directory vs Git File generator para diferentes necessidades.'
    },
    {
      question: 'Qual a vantagem do Cluster generator sobre o List generator?',
      options: [
        'E mais rapido',
        'Detecta automaticamente novos clusters registrados no ArgoCD sem alterar o ApplicationSet',
        'Suporta mais clusters',
        'E mais seguro'
      ],
      correct: 1,
      explanation: 'O Cluster generator detecta automaticamente clusters registrados no ArgoCD. Quando um novo cluster e adicionado (e corresponde ao selector), o ApplicationSet cria automaticamente uma Application para ele. O List generator requer atualizacao manual do YAML.',
      reference: 'Conceito relacionado: argocd-advanced — multi-cluster management e otimizado com Cluster generator.'
    },
    {
      question: 'Numa estrutura App of Apps, onde as Applications filhas devem ser criadas?',
      options: [
        'No namespace da aplicacao alvo',
        'No namespace argocd (mesmo namespace do ArgoCD)',
        'Em um namespace dedicado para apps',
        'Em qualquer namespace'
      ],
      correct: 1,
      explanation: 'Applications filhas, como qualquer Application do ArgoCD, devem ser criadas no namespace argocd. A root app tem destination.namespace: argocd, e cada Application filha define seu proprio destination para o namespace da aplicacao real.',
      reference: 'Conceito relacionado: argocd-applications — Applications sempre residem no namespace argocd.'
    }
  ],
  flashcards: [
    {
      front: 'App of Apps vs ApplicationSet — quando usar cada um?',
      back: '**App of Apps:**\n- Simples, facil de entender\n- Controle manual sobre cada Application\n- Bom para pequeno numero de apps (< 20)\n- Usa Helm/Kustomize para templates\n\n**ApplicationSet:**\n- Escalavel, automatizado\n- Generators geram apps automaticamente\n- Ideal para muitas apps ou clusters\n- Suporta preview envs (PR generator)\n- Deteccao automatica de mudancas\n\n**Regra:** se tem pattern repetitivo, use ApplicationSet. Se cada app e unica, use App of Apps.'
    },
    {
      front: 'Quais sao os generators do ApplicationSet?',
      back: '| Generator | Fonte | Uso |\n|-----------|-------|-----|\n| **List** | valores explicitos | clusters conhecidos |\n| **Cluster** | clusters ArgoCD | auto-detect clusters |\n| **Git Directory** | dirs no repo | app por diretorio |\n| **Git File** | arquivos no repo | config por arquivo |\n| **Matrix** | 2 generators | combinacoes |\n| **Merge** | generators + override | base + overrides |\n| **Pull Request** | PRs abertos | preview envs |\n| **SCM Provider** | repos de org | autodiscovery |\n\nMatrix gera produto cartesiano. Merge permite overrides por ambiente.'
    },
    {
      front: 'Como funciona o Git Directory generator?',
      back: '**Config:**\n```yaml\ngenerators:\n  - git:\n      repoURL: https://github.com/org/apps.git\n      revision: main\n      directories:\n        - path: services/*\n        - path: services/deprecated\n          exclude: true\n```\n\n**Resultado:**\nSe o repo tem:\n```\nservices/\n  frontend/\n  backend/\n  api/\n  deprecated/\n```\n\nGera 3 Applications: frontend, backend, api\n(deprecated excluido)\n\n**Variaveis:** {{path}}, {{path.basename}}'
    },
    {
      front: 'Como configurar preview environments com ApplicationSet?',
      back: '```yaml\ngenerators:\n  - pullRequest:\n      github:\n        owner: myorg\n        repo: myapp\n        tokenRef:\n          secretName: github-token\n          key: token\n      requeueAfterSeconds: 60\ntemplate:\n  metadata:\n    name: "preview-{{number}}"\n  spec:\n    source:\n      targetRevision: "{{head_sha}}"\n      path: k8s\n    destination:\n      namespace: "preview-{{number}}"\n    syncPolicy:\n      automated:\n        prune: true\n      syncOptions:\n        - CreateNamespace=true\n```\n\nCria env por PR, remove ao fechar.'
    },
    {
      front: 'Como funciona o Matrix generator?',
      back: '**Conceito:** produto cartesiano de 2 generators\n\n**Exemplo:** 3 clusters x 2 apps = 6 Applications\n```yaml\ngenerators:\n  - matrix:\n      generators:\n        - clusters:\n            selector:\n              matchLabels:\n                tier: production\n        - list:\n            elements:\n              - app: frontend\n              - app: backend\ntemplate:\n  metadata:\n    name: "{{app}}-{{name}}"\n```\n\n**Resultado:**\n- frontend-cluster1\n- frontend-cluster2\n- frontend-cluster3\n- backend-cluster1\n- backend-cluster2\n- backend-cluster3'
    },
    {
      front: 'Quais sao os sync policies especificos do ApplicationSet?',
      back: '**ApplicationSet syncPolicy:**\n```yaml\nspec:\n  syncPolicy:\n    preserveResourcesOnDeletion: false\n    applicationsSync: create-update\n```\n\n**preserveResourcesOnDeletion:**\n- false (padrao): deleta apps ao remover do generator\n- true: preserva apps (seguro para producao)\n\n**applicationsSync:**\n- create-only: so cria, nao atualiza\n- create-update: cria e atualiza\n- create-delete: cria e deleta (sem update)\n\n**Application syncPolicy (no template):**\n```yaml\ntemplate:\n  spec:\n    syncPolicy:\n      automated:\n        prune: true\n        selfHeal: true\n```'
    }
  ],
  lab: {
    scenario: 'Voce precisa gerenciar multiplas Applications de forma escalavel usando o pattern App of Apps e ApplicationSets.',
    objective: 'Criar uma estrutura App of Apps, migrar para ApplicationSet com Git Directory generator, e explorar generators avancados.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar App of Apps',
        instruction: `Crie uma Application pai que gerencia multiplas Applications filhas.

\`\`\`bash
# A root app aponta para um diretorio com Application manifests
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root-app
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: apps
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
EOF

# Sincronizar
argocd app sync root-app
\`\`\``,
        hints: [
          'A root app cria Applications no namespace argocd',
          'O path "apps" contem manifests de Applications filhas',
          'As Applications filhas gerenciam os recursos reais nos namespaces alvo'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root-app
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: apps
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar root app
argocd app get root-app
# Saida esperada: Synced, Healthy

# Verificar Applications filhas criadas
argocd app list
# Saida esperada: root-app + Applications filhas
\`\`\``
      },
      {
        title: 'Criar ApplicationSet com List Generator',
        instruction: `Crie um ApplicationSet que gera Applications para multiplos ambientes usando o List generator.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: multi-env
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - env: dev
            namespace: guestbook-dev
          - env: staging
            namespace: guestbook-staging
  template:
    metadata:
      name: 'guestbook-{{env}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/argoproj/argocd-example-apps.git
        targetRevision: HEAD
        path: guestbook
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{namespace}}'
      syncPolicy:
        automated:
          prune: true
        syncOptions:
          - CreateNamespace=true
EOF
\`\`\``,
        hints: [
          'O List generator cria uma Application para cada elemento da lista',
          'As variaveis {{env}} e {{namespace}} sao substituidas pelos valores do elemento',
          'Cada Application e independente — pode ter seu proprio sync status'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: multi-env
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - env: dev
            namespace: guestbook-dev
          - env: staging
            namespace: guestbook-staging
  template:
    metadata:
      name: 'guestbook-{{env}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/argoproj/argocd-example-apps.git
        targetRevision: HEAD
        path: guestbook
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{namespace}}'
      syncPolicy:
        automated:
          prune: true
        syncOptions:
          - CreateNamespace=true
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar ApplicationSet criado
kubectl get applicationset -n argocd
# Saida esperada: multi-env

# Verificar Applications geradas
argocd app list | grep guestbook
# Saida esperada: guestbook-dev e guestbook-staging

# Verificar pods nos namespaces
kubectl get pods -n guestbook-dev
kubectl get pods -n guestbook-staging
\`\`\``
      },
      {
        title: 'Verificar e Explorar Applications Geradas',
        instruction: `Examine as Applications geradas pelo ApplicationSet e verifique seu funcionamento.

\`\`\`bash
# Ver detalhes das Applications geradas
argocd app get guestbook-dev
argocd app get guestbook-staging

# Ver recursos de cada Application
argocd app resources guestbook-dev
argocd app resources guestbook-staging

# Ver o ApplicationSet original
kubectl get applicationset multi-env -n argocd -o yaml | head -40
\`\`\``,
        hints: [
          'Cada Application gerada e independente e tem seu proprio lifecycle',
          'O ApplicationSet owner reference vincula as Applications ao ApplicationSet',
          'Deletar o ApplicationSet deleta todas as Applications geradas'
        ],
        solution: `\`\`\`bash
argocd app get guestbook-dev
argocd app get guestbook-staging
kubectl get applicationset multi-env -n argocd -o yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar que ambas as Applications estao Synced
argocd app get guestbook-dev -o json | jq '.status.sync.status'
# Saida esperada: "Synced"

argocd app get guestbook-staging -o json | jq '.status.sync.status'
# Saida esperada: "Synced"
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: `Remova os recursos criados durante o lab.

\`\`\`bash
# Deletar ApplicationSet (deleta Applications geradas)
kubectl delete applicationset multi-env -n argocd

# Deletar root-app
argocd app delete root-app -y

# Limpar namespaces
kubectl delete namespace guestbook-dev guestbook-staging --ignore-not-found
\`\`\``,
        hints: [
          'Deletar o ApplicationSet deleta automaticamente as Applications geradas',
          'Os namespaces precisam ser limpos separadamente se CreateNamespace foi usado',
          'Verifique que nenhuma Application orfao restou'
        ],
        solution: `\`\`\`bash
kubectl delete applicationset multi-env -n argocd
argocd app delete root-app -y
kubectl delete namespace guestbook-dev guestbook-staging --ignore-not-found
\`\`\``,
        verify: `\`\`\`bash
# Verificar que nao ha ApplicationSets
kubectl get applicationset -n argocd
# Saida esperada: nenhum

# Verificar que nao ha Applications orfaos
argocd app list | grep guestbook
# Saida esperada: nenhuma linha
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ApplicationSet nao gera Applications',
      difficulty: 'easy',
      symptom: 'O ApplicationSet foi criado mas nenhuma Application e gerada. kubectl get applicationset mostra o recurso mas argocd app list nao mostra as Applications esperadas.',
      diagnosis: `\`\`\`bash
# Verificar status do ApplicationSet
kubectl get applicationset <name> -n argocd -o yaml | tail -20

# Verificar logs do ApplicationSet Controller
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-applicationset-controller --tail=30

# Verificar se o generator tem elementos
kubectl get applicationset <name> -n argocd -o json | jq '.spec.generators'
\`\`\``,
      solution: `**Causas comuns:**

1. **Generator vazio:** O generator nao produz nenhum elemento. Verifique a configuracao (ex: Git Directory sem diretorios correspondentes).

2. **Template com erro:** Se o template tem campos invalidos, o controller nao consegue gerar Applications.

3. **Controller nao instalado:** O ApplicationSet Controller e separado. Verifique se o pod existe:
\`\`\`bash
kubectl get pod -n argocd -l app.kubernetes.io/name=argocd-applicationset-controller
\`\`\`

4. **Permissoes insuficientes:** O controller precisa de permissoes para criar Applications no namespace argocd.`
    },
    {
      title: 'Matrix generator gera Applications demais',
      difficulty: 'medium',
      symptom: 'O Matrix generator criou centenas de Applications inesperadas, sobrecarregando o ArgoCD controller.',
      diagnosis: `\`\`\`bash
# Contar Applications geradas
argocd app list | wc -l

# Ver o produto cartesiano
kubectl get applicationset <name> -n argocd -o json | jq '.spec.generators[0].matrix.generators | .[0], .[1]'

# Verificar uso de recursos do controller
kubectl top pod -n argocd -l app.kubernetes.io/name=argocd-application-controller
\`\`\``,
      solution: `**Solucoes:**

1. **Adicionar filtros nos generators:**
\`\`\`yaml
- clusters:
    selector:
      matchLabels:
        tier: production  # filtrar clusters
- git:
    directories:
      - path: apps/critical-*  # filtrar diretorios
\`\`\`

2. **Limitar o ApplicationSet:** Use applicationsSync: create-only para evitar updates massivos.

3. **Dividir em ApplicationSets menores:** Em vez de um Matrix grande, crie ApplicationSets separados por equipe ou escopo.

4. **Aumentar recursos do controller:**
\`\`\`yaml
controller:
  resources:
    requests:
      cpu: "1"
      memory: 2Gi
\`\`\``
    },
    {
      title: 'Preview environments nao sao limpos apos merge do PR',
      difficulty: 'hard',
      symptom: 'Namespaces de preview (preview-123, preview-456) continuam existindo mesmo apos os PRs serem merged/fechados.',
      diagnosis: `\`\`\`bash
# Verificar PRs detectados pelo generator
kubectl get applicationset pr-previews -n argocd -o json | jq '.status'

# Verificar Applications de preview ativas
argocd app list | grep preview

# Verificar se o token GitHub esta valido
kubectl get secret github-token -n argocd -o jsonpath='{.data.token}' | base64 -d | head -c 10
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Token expirado:** O PR generator precisa de um token valido para consultar PRs. Renove o token.

2. **requeueAfterSeconds muito alto:** Reduza para deteccao mais rapida de PRs fechados:
\`\`\`yaml
requeueAfterSeconds: 30  # verificar a cada 30s
\`\`\`

3. **preserveResourcesOnDeletion: true:** Se configurado, Applications nao sao deletadas automaticamente:
\`\`\`yaml
syncPolicy:
  preserveResourcesOnDeletion: false  # deve ser false para cleanup
\`\`\`

4. **Limpar manualmente:**
\`\`\`bash
# Deletar Application de preview
argocd app delete preview-123 -y

# Deletar namespace
kubectl delete namespace preview-123
\`\`\`

5. **Adicionar TTL:** Considere usar um CronJob para limpar namespaces antigos baseado em annotations com timestamp de criacao.`
    }
  ]
};
