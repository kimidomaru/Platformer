window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['argocd-fundamentals/argocd-applications'] = {
  theory: `
# ArgoCD Applications

## Relevancia
O recurso Application e o objeto central do ArgoCD. Ele define **o que** implantar (source — repo Git ou chart Helm) e **onde** implantar (destination — cluster e namespace). Entender como criar, configurar e gerenciar Applications e fundamental para operar ArgoCD no dia-a-dia.

## Conceitos Fundamentais

### O que e uma Application?

Uma Application e um CRD (Custom Resource Definition) do ArgoCD que mapeia um **source** (repositorio Git, chart Helm) para um **destination** (cluster + namespace). O ArgoCD monitora essa Application e garante que o estado real no cluster corresponda ao estado definido no source.

### Estrutura de uma Application

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd          # SEMPRE no namespace argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io  # deleta recursos ao remover a App
spec:
  project: default           # AppProject (controle de acesso)
  source:                    # DE ONDE vem o manifesto
    repoURL: https://github.com/org/repo.git
    targetRevision: HEAD     # branch, tag ou commit
    path: k8s/overlays/prod  # path dentro do repo
  destination:               # PARA ONDE implantar
    server: https://kubernetes.default.svc  # cluster
    namespace: production    # namespace alvo
  syncPolicy:                # COMO sincronizar
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
\`\`\`

### Source Types

O ArgoCD suporta multiplas fontes de manifests:

| Source Type | Descricao | Campos Relevantes |
|------------|-----------|-------------------|
| **Directory (YAML puro)** | Pasta com manifests YAML/JSON | \`path\`, \`directory.recurse\` |
| **Helm** | Helm chart de repo ou Git | \`chart\`, \`helm.values\`, \`helm.parameters\` |
| **Kustomize** | Kustomize overlays | \`path\`, \`kustomize.images\`, \`kustomize.namePrefix\` |
| **Jsonnet** | Templates Jsonnet | \`path\`, \`directory.jsonnet\` |
| **Plugin** | Config Management Plugin | \`plugin.name\`, \`plugin.env\` |

### Source: Directory (YAML puro)

\`\`\`yaml
spec:
  source:
    repoURL: https://github.com/org/repo.git
    targetRevision: main
    path: manifests/production
    directory:
      recurse: true           # inclui subpastas
      exclude: '*.test.yaml'  # exclui arquivos de teste
\`\`\`

### Source: Helm Chart (de repo Helm)

\`\`\`yaml
spec:
  source:
    repoURL: https://charts.bitnami.com/bitnami  # Helm repo
    chart: nginx                                   # nome do chart
    targetRevision: 15.0.0                         # versao do chart
    helm:
      releaseName: my-nginx
      values: |
        replicaCount: 3
        service:
          type: ClusterIP
      parameters:
        - name: image.tag
          value: "1.25"
\`\`\`

### Source: Helm Chart (de repo Git)

\`\`\`yaml
spec:
  source:
    repoURL: https://github.com/org/charts.git
    targetRevision: main
    path: charts/my-app       # pasta com Chart.yaml
    helm:
      releaseName: my-app
      valueFiles:
        - values.yaml
        - values-prod.yaml    # override por ambiente
      parameters:
        - name: image.tag
          value: "v1.2.3"
\`\`\`

### Source: Kustomize

\`\`\`yaml
spec:
  source:
    repoURL: https://github.com/org/repo.git
    targetRevision: main
    path: overlays/production
    kustomize:
      namePrefix: prod-
      images:
        - name: my-app
          newTag: v1.2.3
      commonLabels:
        env: production
\`\`\`

### Multiple Sources (v2.6+)

A partir do ArgoCD 2.6, e possivel usar multiplas sources em uma unica Application:

\`\`\`yaml
spec:
  sources:                    # note o plural "sources"
    - repoURL: https://charts.bitnami.com/bitnami
      chart: nginx
      targetRevision: 15.0.0
      helm:
        releaseName: nginx
        valueFiles:
          - \$values/envs/production/values.yaml  # referencia ao segundo source
    - repoURL: https://github.com/org/config.git
      targetRevision: main
      ref: values              # referencia usada acima como \$values
\`\`\`

### Sync Status e Health Status

| Sync Status | Significado |
|------------|-------------|
| **Synced** | Estado real = estado desejado (Git) |
| **OutOfSync** | Estado real != estado desejado |
| **Unknown** | Nao foi possivel determinar o estado |

| Health Status | Significado |
|--------------|-------------|
| **Healthy** | Todos os recursos estao funcionando |
| **Progressing** | Recursos estao sendo atualizados |
| **Degraded** | Um ou mais recursos falharam |
| **Suspended** | Recursos estao pausados (ex: Deployment paused) |
| **Missing** | Recursos definidos no Git nao existem no cluster |
| **Unknown** | Health nao pode ser determinado |

### Destination

\`\`\`yaml
spec:
  destination:
    # Opcao 1: Cluster por URL (obrigatorio para clusters externos)
    server: https://kubernetes.default.svc

    # Opcao 2: Cluster por nome (se registrado no ArgoCD)
    # name: production-cluster

    namespace: my-namespace
\`\`\`

### Finalizers

\`\`\`yaml
metadata:
  finalizers:
    # Deleta recursos do cluster ao remover a Application
    - resources-finalizer.argocd.argoproj.io

    # Foreground deletion — espera recursos filhos serem deletados primeiro
    # - resources-finalizer.argocd.argoproj.io/foreground
\`\`\`

## Comandos Essenciais

### Gerenciamento de Applications

\`\`\`bash
# Criar Application via CLI
argocd app create my-app \\
  --repo https://github.com/org/repo.git \\
  --path k8s/production \\
  --dest-server https://kubernetes.default.svc \\
  --dest-namespace production \\
  --sync-policy automated \\
  --auto-prune \\
  --self-heal

# Listar Applications
argocd app list

# Ver detalhes de uma Application
argocd app get my-app

# Ver diff (o que mudaria com sync)
argocd app diff my-app

# Sync manual
argocd app sync my-app

# Sync com prune (deletar recursos orfaos)
argocd app sync my-app --prune

# Sync de recursos especificos
argocd app sync my-app --resource :Deployment:nginx

# Rollback para revisao anterior
argocd app rollback my-app <revision-id>

# Deletar Application (mantem recursos no cluster)
argocd app delete my-app --cascade=false

# Deletar Application (remove recursos do cluster)
argocd app delete my-app

# Ver historico de sync
argocd app history my-app

# Ver logs dos pods da Application
argocd app logs my-app
\`\`\`

### Gerenciamento de Repositorios

\`\`\`bash
# Adicionar repositorio (HTTPS)
argocd repo add https://github.com/org/repo.git --username user --password token

# Adicionar repositorio (SSH)
argocd repo add git@github.com:org/repo.git --ssh-private-key-path ~/.ssh/id_rsa

# Adicionar Helm repo
argocd repo add https://charts.bitnami.com/bitnami --type helm --name bitnami

# Listar repositorios
argocd repo list
\`\`\`

## Erros Comuns

1. **Application no namespace errado**: Applications devem ser criadas no namespace \`argocd\`, nao no namespace da aplicacao alvo.
2. **targetRevision vazio**: Se nao especificar, usa HEAD. Mas para producao, sempre fixe uma tag ou branch.
3. **Esquecer finalizer**: Sem o finalizer, deletar a Application no ArgoCD NAO deleta os recursos no cluster.
4. **Helm values inline muito grandes**: Para values complexos, use \`valueFiles\` apontando para arquivos no repo.
5. **Path errado no source**: O path e relativo a raiz do repo. Um path errado resulta em "No manifests found".
6. **Nao usar CreateNamespace**: Se o namespace alvo nao existe, o sync falha. Adicione \`CreateNamespace=true\` em syncOptions.

## Killer.sh Style Challenge

**Cenario:** Crie Applications para implantar uma stack completa de microservicos.

**Tarefas:**
1. Crie uma Application que implante manifests YAML puros de um diretorio Git
2. Crie uma Application que implante um Helm chart de um repositorio Helm publico
3. Crie uma Application usando Kustomize com override de imagem para producao
4. Configure auto-sync com prune e self-heal em todas as Applications

**Dicas:**
- Use \`syncOptions: [CreateNamespace=true]\` para criar namespaces automaticamente
- Para Helm charts, use \`helm.releaseName\` para definir o nome do release
- Sempre adicione o finalizer para cleanup automatico
`,
  quiz: [
    {
      question: 'Em qual namespace uma Application do ArgoCD deve ser criada?',
      options: [
        'No namespace da aplicacao alvo',
        'No namespace argocd (onde o ArgoCD esta instalado)',
        'No namespace default',
        'Em qualquer namespace'
      ],
      correct: 1,
      explanation: 'Applications do ArgoCD devem ser criadas no namespace argocd (onde o ArgoCD esta instalado). O campo destination.namespace define o namespace alvo onde os recursos serao implantados, mas a Application em si sempre reside no namespace argocd.',
      reference: 'Conceito relacionado: argocd-projects — AppProjects controlam quais namespaces/clusters uma Application pode usar como destination.'
    },
    {
      question: 'Qual campo em uma Application define de onde os manifests Kubernetes vem?',
      options: [
        'destination',
        'source',
        'syncPolicy',
        'project'
      ],
      correct: 1,
      explanation: 'O campo source define de onde vem os manifests: repositorio Git (repoURL + path) ou Helm chart (repoURL + chart). Suporta YAML puro, Helm, Kustomize, Jsonnet e plugins. A partir do ArgoCD 2.6, e possivel usar "sources" (plural) para multiplas fontes.',
      reference: 'Conceito relacionado: argocd-sync-strategies — o syncPolicy define COMO os manifests do source sao aplicados.'
    },
    {
      question: 'O que acontece ao deletar uma Application SEM o finalizer resources-finalizer.argocd.argoproj.io?',
      options: [
        'Os recursos no cluster sao deletados automaticamente',
        'A Application e os recursos sao deletados',
        'Apenas a Application e removida do ArgoCD, os recursos continuam no cluster',
        'O ArgoCD impede a delecao'
      ],
      correct: 2,
      explanation: 'Sem o finalizer, deletar a Application no ArgoCD remove apenas o objeto Application. Os recursos Kubernetes implantados (Deployments, Services, etc.) continuam existindo no cluster como orfaos. O finalizer garante a limpeza automatica dos recursos ao remover a Application.',
      reference: 'Conceito relacionado: argocd-sync-strategies — o prune em auto-sync funciona de forma similar, removendo recursos orfaos.'
    },
    {
      question: 'Como implantar um Helm chart de um repositorio Helm publico com o ArgoCD?',
      options: [
        'Usando source.path apontando para o URL do chart',
        'Usando source.repoURL com o URL do Helm repo, source.chart com nome do chart, e source.targetRevision com a versao',
        'Usando destination.helm com os parametros',
        'O ArgoCD nao suporta Helm charts de repos publicos'
      ],
      correct: 1,
      explanation: 'Para Helm charts de repositorios Helm: repoURL aponta para o repo (ex: https://charts.bitnami.com/bitnami), chart define o nome do chart (ex: nginx), targetRevision define a versao (ex: 15.0.0). Values podem ser inline (helm.values) ou parametrizados (helm.parameters).',
      reference: 'Conceito relacionado: argocd-applications — compare source types: directory vs Helm vs Kustomize.'
    },
    {
      question: 'Qual sync status indica que o estado real do cluster esta diferente do estado definido no Git?',
      options: [
        'Synced',
        'OutOfSync',
        'Degraded',
        'Missing'
      ],
      correct: 1,
      explanation: 'OutOfSync indica que o estado real dos recursos no cluster difere do estado desejado definido no Git. Synced significa que estao iguais. Degraded e Missing sao health statuses, nao sync statuses — Degraded indica recursos com falha, Missing indica recursos que nao existem no cluster.',
      reference: 'Conceito relacionado: argocd-sync-strategies — auto-sync pode corrigir OutOfSync automaticamente.'
    },
    {
      question: 'O que e o recurso "Multiple Sources" (sources) no ArgoCD 2.6+?',
      options: [
        'Suporte a multiplos clusters',
        'Capacidade de definir multiplas fontes de manifests em uma unica Application (ex: Helm chart + valores de outro repo)',
        'Multiplas copias da mesma aplicacao',
        'Suporte a multiplos projetos'
      ],
      correct: 1,
      explanation: 'Multiple Sources permite que uma Application use manifests de multiplas fontes. O caso de uso mais comum e separar o Helm chart dos valores: o chart vem de um repo Helm, e os values vem de um repo Git separado. Isso permite que equipes de plataforma e desenvolvimento gerenciem configs independentemente.',
      reference: 'Conceito relacionado: argocd-app-of-apps — ApplicationSets oferecem outra abordagem para gerenciar multiplas Applications.'
    },
    {
      question: 'Qual campo deve ser configurado para que o ArgoCD crie o namespace automaticamente se ele nao existir?',
      options: [
        'destination.createNamespace: true',
        'syncPolicy.syncOptions com CreateNamespace=true',
        'source.namespace: auto',
        'project.allowNamespaceCreation: true'
      ],
      correct: 1,
      explanation: 'A opcao CreateNamespace=true deve ser adicionada a syncPolicy.syncOptions. Sem ela, se o namespace alvo nao existir, o sync falhara com erro. E uma pratica comum em ambientes onde namespaces sao criados pelo ArgoCD como parte do deploy.',
      reference: 'Conceito relacionado: argocd-projects — o AppProject deve permitir o namespace na lista de destinations.'
    },
    {
      question: 'Qual health status indica que os recursos de uma Application estao sendo atualizados?',
      options: [
        'Healthy',
        'Progressing',
        'Degraded',
        'Suspended'
      ],
      correct: 1,
      explanation: 'Progressing indica que recursos estao sendo atualizados (ex: Deployment fazendo rollout, Pod inicializando). E um estado transitorio que normalmente evolui para Healthy (sucesso) ou Degraded (falha). O ArgoCD monitora continuamente e atualiza o health status.',
      reference: 'Conceito relacionado: argocd-sync-strategies — sync waves e hooks permitem controlar a ordem de atualizacao.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os source types suportados pelo ArgoCD?',
      back: '1. **Directory** — YAML/JSON puro (path + directory.recurse)\n2. **Helm** — Charts de repo Helm ou Git (chart + helm.values)\n3. **Kustomize** — Overlays Kustomize (path + kustomize.images)\n4. **Jsonnet** — Templates Jsonnet (path + directory.jsonnet)\n5. **Plugin** — Config Management Plugins customizados\n6. **Multiple Sources** (v2.6+) — combinar multiplos sources\n\nO ArgoCD detecta automaticamente o tipo baseado nos arquivos (Chart.yaml = Helm, kustomization.yaml = Kustomize).'
    },
    {
      front: 'Qual a diferenca entre Sync Status e Health Status?',
      back: '**Sync Status** (Git vs Cluster):\n- **Synced** — estado real = Git\n- **OutOfSync** — estado real != Git\n- **Unknown** — nao determinado\n\n**Health Status** (recursos funcionando?):\n- **Healthy** — tudo ok\n- **Progressing** — atualizando\n- **Degraded** — falha em recursos\n- **Suspended** — pausado\n- **Missing** — recurso nao existe no cluster\n\nSync = "esta atualizado?", Health = "esta funcionando?"'
    },
    {
      front: 'Como usar Multiple Sources no ArgoCD?',
      back: 'Multiple Sources (v2.6+) permite combinar fontes:\n\n```yaml\nspec:\n  sources:  # plural!\n    - repoURL: https://charts.bitnami.com/bitnami\n      chart: nginx\n      targetRevision: 15.0.0\n      helm:\n        valueFiles:\n          - $values/envs/prod/values.yaml\n    - repoURL: https://github.com/org/config.git\n      targetRevision: main\n      ref: values  # referencia\n```\n\n**Caso de uso:** chart Helm de um repo, values de outro repo Git (separacao de responsabilidades).'
    },
    {
      front: 'O que faz o finalizer resources-finalizer.argocd.argoproj.io?',
      back: '**Com finalizer:**\nAo deletar a Application, o ArgoCD primeiro deleta TODOS os recursos Kubernetes criados por ela (Deployments, Services, etc.) e so entao remove a Application.\n\n**Sem finalizer:**\nAo deletar a Application, apenas o objeto Application e removido. Os recursos no cluster ficam como "orfaos".\n\n**Foreground variant:**\n\`resources-finalizer.argocd.argoproj.io/foreground\`\nEspera recursos filhos serem deletados antes de remover o pai.\n\n**Best practice:** sempre usar finalizer em producao.'
    },
    {
      front: 'Como criar uma Application ArgoCD via CLI?',
      back: '```bash\nargocd app create my-app \\\n  --repo https://github.com/org/repo.git \\\n  --path k8s/production \\\n  --dest-server https://kubernetes.default.svc \\\n  --dest-namespace production \\\n  --sync-policy automated \\\n  --auto-prune \\\n  --self-heal\n```\n\n**Operacoes comuns:**\n- \`argocd app list\` — listar apps\n- \`argocd app get my-app\` — detalhes\n- \`argocd app sync my-app\` — sync manual\n- \`argocd app diff my-app\` — ver diff\n- \`argocd app delete my-app\` — deletar\n- \`argocd app history my-app\` — historico'
    },
    {
      front: 'Como configurar uma Application com Helm values de um repo Git?',
      back: '```yaml\nspec:\n  source:\n    repoURL: https://github.com/org/charts.git\n    targetRevision: main\n    path: charts/my-app\n    helm:\n      releaseName: my-app\n      valueFiles:\n        - values.yaml\n        - values-prod.yaml\n      parameters:\n        - name: image.tag\n          value: "v1.2.3"\n        - name: replicaCount\n          value: "3"\n```\n\n**Precedencia:** parameters > valueFiles (ultimo vence) > values inline\n\n**Dica:** use valueFiles para config por ambiente (dev/staging/prod).'
    }
  ],
  lab: {
    scenario: 'Voce precisa implantar uma aplicacao usando ArgoCD com diferentes source types: YAML puro, Helm chart e Kustomize.',
    objective: 'Criar Applications no ArgoCD usando diferentes source types, entender sync/health status, e gerenciar o ciclo de vida das Applications.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Application com YAML puro',
        instruction: `Crie uma Application que implante manifests YAML de um repositorio Git publico.

\`\`\`bash
# Criar Application via CLI
argocd app create guestbook \\
  --repo https://github.com/argoproj/argocd-example-apps.git \\
  --path guestbook \\
  --dest-server https://kubernetes.default.svc \\
  --dest-namespace guestbook \\
  --sync-option CreateNamespace=true

# Ou via YAML
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: guestbook
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: guestbook
  destination:
    server: https://kubernetes.default.svc
    namespace: guestbook
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
EOF
\`\`\``,
        hints: [
          'O repositorio argocd-example-apps e publico e contem exemplos oficiais',
          'CreateNamespace=true cria o namespace se nao existir',
          'A Application comeca OutOfSync ate o primeiro sync'
        ],
        solution: `\`\`\`bash
argocd app create guestbook \\
  --repo https://github.com/argoproj/argocd-example-apps.git \\
  --path guestbook \\
  --dest-server https://kubernetes.default.svc \\
  --dest-namespace guestbook \\
  --sync-option CreateNamespace=true
\`\`\``,
        verify: `\`\`\`bash
# Verificar Application criada
argocd app get guestbook
# Saida esperada: Status Sync: OutOfSync, Health: Missing

# Verificar via kubectl
kubectl get application guestbook -n argocd
# Saida esperada: Application com SYNC STATUS
\`\`\``
      },
      {
        title: 'Sincronizar e Verificar Status',
        instruction: `Sincronize a Application e observe os status de sync e health.

\`\`\`bash
# Ver diff antes do sync
argocd app diff guestbook

# Executar sync
argocd app sync guestbook

# Verificar status
argocd app get guestbook

# Ver recursos criados
argocd app resources guestbook

# Ver pods
kubectl get pods -n guestbook
\`\`\``,
        hints: [
          'O diff mostra exatamente o que sera criado/modificado',
          'Apos sync, o status deve mudar para Synced + Healthy',
          'Use "argocd app resources" para ver todos os recursos gerenciados'
        ],
        solution: `\`\`\`bash
# Sync
argocd app sync guestbook

# Verificar
argocd app get guestbook

# Recursos
kubectl get all -n guestbook
\`\`\``,
        verify: `\`\`\`bash
# Verificar sync status
argocd app get guestbook -o json | jq '.status.sync.status'
# Saida esperada: "Synced"

# Verificar health status
argocd app get guestbook -o json | jq '.status.health.status'
# Saida esperada: "Healthy"

# Verificar pods
kubectl get pods -n guestbook --no-headers | wc -l
# Saida esperada: numero > 0
\`\`\``
      },
      {
        title: 'Criar Application com Helm Chart',
        instruction: `Crie uma Application que implante um Helm chart de um repositorio Helm publico.

\`\`\`bash
# Adicionar Helm repo (se necessario)
argocd repo add https://charts.bitnami.com/bitnami --type helm --name bitnami

# Criar Application com Helm
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: nginx-helm
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://charts.bitnami.com/bitnami
    chart: nginx
    targetRevision: 15.0.0
    helm:
      releaseName: nginx-prod
      values: |
        replicaCount: 2
        service:
          type: ClusterIP
  destination:
    server: https://kubernetes.default.svc
    namespace: nginx-helm
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
EOF
\`\`\``,
        hints: [
          'Para Helm repos, use chart em vez de path',
          'targetRevision e a versao do chart',
          'O auto-sync com selfHeal fara o sync automaticamente'
        ],
        solution: `\`\`\`bash
# A Application com auto-sync sincroniza automaticamente
argocd app get nginx-helm
\`\`\``,
        verify: `\`\`\`bash
# Verificar Application
argocd app get nginx-helm -o json | jq '{sync: .status.sync.status, health: .status.health.status}'
# Saida esperada: {"sync": "Synced", "health": "Healthy" ou "Progressing"}

# Verificar pods do nginx
kubectl get pods -n nginx-helm
# Saida esperada: 2 pods nginx rodando (replicaCount: 2)
\`\`\``
      },
      {
        title: 'Testar Drift Detection e Self-Heal',
        instruction: `Altere manualmente um recurso gerenciado e observe o ArgoCD detectar e corrigir o drift.

\`\`\`bash
# Alterar replicas manualmente (drift proposital)
kubectl scale deployment nginx-prod-nginx -n nginx-helm --replicas=5

# Verificar status imediato
argocd app get nginx-helm

# Aguardar self-heal (o ArgoCD deve reverter para 2 replicas)
# O self-heal age em poucos segundos

# Verificar que voltou a 2 replicas
kubectl get deployment nginx-prod-nginx -n nginx-helm -o jsonpath='{.spec.replicas}'
\`\`\``,
        hints: [
          'Com selfHeal habilitado, o ArgoCD reverte mudancas manuais automaticamente',
          'O self-heal verifica a cada poucos segundos',
          'Sem selfHeal, o ArgoCD apenas marcaria como OutOfSync'
        ],
        solution: `\`\`\`bash
# Forcar drift
kubectl scale deployment nginx-prod-nginx -n nginx-helm --replicas=5

# Aguardar self-heal (5-10 segundos)
sleep 10

# Verificar correcao
kubectl get deployment nginx-prod-nginx -n nginx-helm -o jsonpath='{.spec.replicas}'
\`\`\``,
        verify: `\`\`\`bash
# Verificar que replicas voltaram ao valor do Git
kubectl get deployment nginx-prod-nginx -n nginx-helm -o jsonpath='{.spec.replicas}'
# Saida esperada: 2 (valor definido no Helm values)

# Verificar Application synced
argocd app get nginx-helm -o json | jq '.status.sync.status'
# Saida esperada: "Synced"
\`\`\``
      },
      {
        title: 'Cleanup — Deletar Applications',
        instruction: `Remova as Applications e verifique o comportamento com e sem finalizer.

\`\`\`bash
# Deletar guestbook SEM finalizer (recursos ficam no cluster)
argocd app delete guestbook --cascade=false -y

# Verificar que os recursos ainda existem
kubectl get pods -n guestbook

# Deletar nginx-helm COM finalizer (recursos sao removidos)
argocd app delete nginx-helm -y

# Verificar que os recursos foram removidos
kubectl get pods -n nginx-helm
\`\`\``,
        hints: [
          '--cascade=false preserva os recursos no cluster',
          'Com finalizer, o ArgoCD deleta recursos antes de remover a Application',
          'Sem flag --cascade, o comportamento depende do finalizer na Application'
        ],
        solution: `\`\`\`bash
argocd app delete guestbook --cascade=false -y
kubectl get pods -n guestbook  # recursos ainda existem

argocd app delete nginx-helm -y
kubectl get pods -n nginx-helm  # recursos removidos
\`\`\``,
        verify: `\`\`\`bash
# Verificar que guestbook nao existe mais no ArgoCD
argocd app list | grep guestbook
# Saida esperada: nenhuma linha

# Verificar que recursos do guestbook ainda existem
kubectl get pods -n guestbook --no-headers | wc -l
# Saida esperada: numero > 0 (orfaos)

# Limpar recursos orfaos
kubectl delete namespace guestbook
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Application presa em "OutOfSync" mesmo apos sync',
      difficulty: 'medium',
      symptom: 'A Application permanece OutOfSync mesmo apos executar sync com sucesso. O sync completa sem erros mas o status nao muda para Synced.',
      diagnosis: `\`\`\`bash
# Ver diff detalhado
argocd app diff my-app --local

# Verificar recursos com diff
argocd app get my-app -o json | jq '.status.resources[] | select(.status != "Synced")'

# Verificar se ha campos mutaveis sendo modificados pelo cluster
argocd app diff my-app 2>&1 | head -50
\`\`\``,
      solution: `**Causas comuns:**

1. **Campos mutaveis (defaulting):** O Kubernetes adiciona campos default apos o apply (ex: strategy, resources). O ArgoCD ve isso como diff.
\`\`\`yaml
# Ignorar diferencas em campos especificos
spec:
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas  # ignorar se HPA controla replicas
    - group: ""
      kind: Service
      jqPathExpressions:
        - .spec.clusterIP  # campo atribuido pelo cluster
\`\`\`

2. **Webhook/admission controller modificando recursos:** Admission controllers podem adicionar/modificar campos apos o apply.

3. **Resource tracking method:** Mude para annotation-based:
\`\`\`bash
kubectl edit cm argocd-cm -n argocd
# Adicionar: application.resourceTrackingMethod: annotation
\`\`\``
    },
    {
      title: 'Erro "No manifests found" ao sincronizar',
      difficulty: 'easy',
      symptom: 'O sync falha com erro "rpc error: code = Unknown desc = No manifests found at path" ou a Application mostra 0 recursos.',
      diagnosis: `\`\`\`bash
# Verificar path configurado
argocd app get my-app -o json | jq '.spec.source.path'

# Verificar conteudo do repo no path
argocd repo get https://github.com/org/repo.git

# Listar arquivos no path
# (localmente, clone o repo e verifique)
git ls-tree -r HEAD --name-only | grep "^path/"
\`\`\``,
      solution: `**Causas comuns:**

1. **Path errado:** O path e relativo a raiz do repo. Verifique se o path existe e contem manifests.

2. **Branch errada:** targetRevision pode estar apontando para uma branch que nao tem o path.
\`\`\`bash
argocd app get my-app -o json | jq '.spec.source.targetRevision'
\`\`\`

3. **Helm Chart sem Chart.yaml:** Se o path e um Helm chart, deve ter Chart.yaml na raiz.

4. **Kustomize sem kustomization.yaml:** Se o path usa Kustomize, deve ter kustomization.yaml.

5. **Arquivos com extensao errada:** O ArgoCD so processa .yaml, .yml e .json por padrao.

6. **directory.exclude muito abrangente:** Verifique se o exclude nao esta filtrando todos os arquivos.`
    },
    {
      title: 'Application Degraded — pods em CrashLoopBackOff',
      difficulty: 'hard',
      symptom: 'A Application sincroniza com sucesso (Synced) mas o health status fica Degraded. Os pods da aplicacao estao em CrashLoopBackOff.',
      diagnosis: `\`\`\`bash
# Ver health detalhado
argocd app get my-app --show-operation

# Ver recursos com problema
argocd app resources my-app | grep -v Healthy

# Ver logs do pod com problema
argocd app logs my-app --name <pod-name>

# Ver eventos do pod
kubectl describe pod <pod-name> -n <namespace>

# Ver logs anteriores (pre-crash)
kubectl logs <pod-name> -n <namespace> --previous
\`\`\``,
      solution: `**Fluxo de investigacao:**

1. **Sync OK mas app nao funciona:** O sync aplica manifests com sucesso, mas a aplicacao falha ao iniciar. Isso e um problema de aplicacao, nao de ArgoCD.

2. **Verificar ConfigMaps/Secrets:** A aplicacao pode depender de ConfigMaps ou Secrets que nao foram incluidos no Git.
\`\`\`bash
kubectl get events -n <namespace> --sort-by=.lastTimestamp | tail -10
\`\`\`

3. **Verificar imagem:** A tag da imagem pode nao existir ou o registry pode estar inacessivel.

4. **Verificar resources:** Limits muito baixos podem causar OOMKill.

5. **Verificar probes:** Liveness probes muito agressivas podem reiniciar o pod antes dele estar pronto.

**Importante:** Synced != Healthy. Synced significa que os manifests foram aplicados. Healthy significa que os recursos estao funcionando. Sempre investigue health issues como problemas da aplicacao, nao do ArgoCD.`
    }
  ]
};
