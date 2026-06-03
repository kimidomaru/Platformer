window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['fluxcd/fluxcd-advanced'] = {
  theory: `
# FluxCD: Image Automation, Notificacoes e Multi-tenancy

## Relevancia
Este topico cobre os recursos avancados do Flux: automacao de atualizacao de imagens (Image Automation), sistema de notificacoes e alertas (Notification Controller), e padroes de multi-tenancy para gerenciar multiplos times com seguranca em um cluster compartilhado.

## Conceitos Fundamentais

### Image Automation — Atualizacao Automatica de Imagens

O Flux pode monitorar registries de containers e atualizar automaticamente os manifests no repositorio Git quando novas imagens sao publicadas.

**Componentes:**
1. **ImageRepository** — monitora um registry por novas imagens
2. **ImagePolicy** — define qual tag selecionar (semver, alphabetical, numeric)
3. **ImageUpdateAutomation** — escreve a tag selecionada de volta no Git

\`\`\`yaml
# 1. ImageRepository — monitorar registry
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: podinfo
  namespace: flux-system
spec:
  image: ghcr.io/stefanprodan/podinfo
  interval: 5m
  secretRef:
    name: ghcr-auth          # Secret docker-registry para repos privados
\`\`\`

\`\`\`yaml
# 2. ImagePolicy — selecionar qual tag usar
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: podinfo
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: podinfo             # Referencia ao ImageRepository acima
  policy:
    semver:
      range: ">=6.0.0"       # Qualquer versao >= 6.0.0 (ultima patch)
    # alphabetical:           # Alternativa: ordem alfabetica
    #   order: asc
    # numerical:              # Alternativa: numero mais alto
    #   order: asc
\`\`\`

\`\`\`yaml
# 3. ImageUpdateAutomation — escrever tag de volta no Git
apiVersion: image.toolkit.fluxcd.io/v1beta1
kind: ImageUpdateAutomation
metadata:
  name: flux-system
  namespace: flux-system
spec:
  interval: 1m
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  git:
    checkout:
      ref:
        branch: main
    commit:
      author:
        email: fluxcdbot@users.noreply.github.com
        name: fluxcdbot
      messageTemplate: |
        Automated image update

        Automation name: {{ .AutomationObject }}
        Files:
        {{ range \$filename, \$_ := .Updated.Files -}}
        - {{ \$filename }}
        {{ end -}}
        Objects:
        {{ range \$resource, \$_ := .Updated.Objects -}}
        - {{ \$resource.Kind }} {{ \$resource.Name }}
        {{ end -}}
        Images:
        {{ range .Updated.Images -}}
        - {{.}}
        {{ end -}}
    push:
      branch: main            # Faz push direto na branch main
  update:
    strategy: Setters         # Estrategia: procurar marcadores no YAML
    path: ./apps              # Diretorio onde os manifests estao
\`\`\`

**Marcadores no YAML (Setters strategy):**

\`\`\`yaml
# Adicionar marcador de comentario no manifest para o Flux atualizar
apiVersion: apps/v1
kind: Deployment
metadata:
  name: podinfo
spec:
  template:
    spec:
      containers:
        - name: podinfo
          image: ghcr.io/stefanprodan/podinfo:6.5.4  # {"$imagepolicy": "flux-system:podinfo"}
\`\`\`

> O marcador \`# {"$imagepolicy": "flux-system:podinfo"}\` instrui o Flux a atualizar esse campo quando a ImagePolicy selecionar uma nova tag.

### Notification Controller — Alertas e Notificacoes

O Flux tem um controller dedicado para enviar notificacoes sobre eventos de reconciliacao para sistemas externos (Slack, Teams, PagerDuty, GitHub, GitLab, etc.).

**Componentes:**
1. **Provider** — destino das notificacoes (Slack, MS Teams, GitHub, email, etc.)
2. **Alert** — regra que define QUANDO e O QUE notificar
3. **Receiver** — webhook para receber notificacoes externas e triggar reconciliacao

#### Provider — Destino das Notificacoes

\`\`\`yaml
# Provider para Slack
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: slack
  namespace: flux-system
spec:
  type: slack
  channel: k8s-alerts         # Canal do Slack
  secretRef:
    name: slack-webhook        # Secret com a URL do webhook

# O Secret deve ter:
# data:
#   address: <base64-encoded-slack-webhook-url>
\`\`\`

\`\`\`yaml
# Provider para Microsoft Teams
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: msteams
  namespace: flux-system
spec:
  type: msteams
  secretRef:
    name: msteams-webhook
\`\`\`

\`\`\`yaml
# Provider para GitHub (atualiza status de commits/PRs)
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: github-status
  namespace: flux-system
spec:
  type: github
  address: https://github.com/myorg/my-repo
  secretRef:
    name: github-token         # Secret com token GitHub (repo scope)
\`\`\`

#### Alert — Regras de Notificacao

\`\`\`yaml
# Alertar Slack sobre falhas em qualquer recurso Flux
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Alert
metadata:
  name: on-call-slack
  namespace: flux-system
spec:
  providerRef:
    name: slack
  eventSeverity: error         # info | warning | error
  eventSources:
    - kind: GitRepository
      name: "*"                # Todos os GitRepositories
    - kind: Kustomization
      name: "*"
    - kind: HelmRelease
      name: "*"
  exclusionList:
    - ".*no significant.*"     # Regex para excluir mensagens irrelevantes
\`\`\`

\`\`\`yaml
# Alertar sobre TODOS os eventos (info + warning + error)
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Alert
metadata:
  name: all-events
  namespace: flux-system
spec:
  providerRef:
    name: slack
  eventSeverity: info           # Nivel minimo (inclui tudo acima)
  eventSources:
    - kind: Kustomization
      name: apps
      namespace: flux-system
\`\`\`

#### Receiver — Receber Webhooks Externos

\`\`\`yaml
# Receiver para GitHub webhooks — trigga reconciliacao imediata no push
apiVersion: notification.toolkit.fluxcd.io/v1
kind: Receiver
metadata:
  name: github-receiver
  namespace: flux-system
spec:
  type: github
  events:
    - "ping"
    - "push"
  secretRef:
    name: webhook-token         # Secret com token para validar webhook
  resources:
    - apiVersion: source.toolkit.fluxcd.io/v1
      kind: GitRepository
      name: fleet-infra
      namespace: flux-system
\`\`\`

\`\`\`bash
# Obter URL do Receiver para configurar no GitHub
kubectl get receiver github-receiver -n flux-system -o jsonpath='{.status.webhookPath}'
# Output: /hook/sha256:<hash>
# URL completa: http://<cluster-ip>:9292/hook/sha256:<hash>
\`\`\`

### Multi-tenancy com Flux

Em organizacoes com multiplos times, o Flux suporta multi-tenancy via:
1. **Namespaced Flux** — cada time tem seu proprio conjunto de controllers
2. **RBAC por namespace** — limitar acesso dos times
3. **Tenants** — isolamento via ServiceAccounts e Namespaces dedicados

\`\`\`yaml
# Namespace para o time team-a
apiVersion: v1
kind: Namespace
metadata:
  name: team-a
  labels:
    toolkit.fluxcd.io/tenant: team-a
---
# ServiceAccount para o Flux do team-a (RBAC restrito)
apiVersion: v1
kind: ServiceAccount
metadata:
  name: flux
  namespace: team-a
---
# RoleBinding — time so pode criar recursos no proprio namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: flux-tenant
  namespace: team-a
subjects:
  - kind: ServiceAccount
    name: flux
    namespace: team-a
roleRef:
  kind: ClusterRole
  name: cluster-admin           # Em prod: usar Role customizada mais restrita
  apiGroup: rbac.authorization.k8s.io
\`\`\`

\`\`\`yaml
# Kustomization do time team-a usando ServiceAccount dedicada
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: team-a-apps
  namespace: flux-system
spec:
  interval: 5m
  path: ./teams/team-a
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  serviceAccountName: flux       # SA do team-a com permissoes limitadas
  targetNamespace: team-a        # Forcar deploy no namespace do time
  prune: true
\`\`\`

### Flux Tenancy com flux-multi-tenancy

\`\`\`yaml
# Patch para restringir Kustomizations de tenants ao proprio namespace
# (evita que time-a acidentalmente deploy em team-b)
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: team-a-apps
  namespace: team-a             # Kustomization no namespace do time
spec:
  interval: 5m
  path: ./apps
  sourceRef:
    kind: GitRepository
    name: team-a-repo
  serviceAccountName: flux-reconciler
  targetNamespace: team-a
  # Deny substitution de variaveis sensiveis de outros namespaces:
  postBuild:
    substitute: {}
\`\`\`

### Erros Comuns Avancados

1. **ImageUpdateAutomation sem permissao de push** — O Git deploy key deve ter permissao de ESCRITA no repositorio (nao so leitura)
2. **Marcador $imagepolicy incorreto** — O formato correto e: \`{"$imagepolicy": "namespace:nome-da-policy"}\`
3. **Alert sem events** — Se o eventSeverity e "error" mas so ocorrem eventos "info", nenhum alerta e enviado
4. **Receiver URL nao acessivel** — O GitHub precisa acessar a URL do Receiver; verificar ingress/LoadBalancer no notification-controller
5. **Tenant cross-namespace** — Se a Kustomization nao tem targetNamespace e a SA nao tem ClusterRole, pode falhar ao tentar criar recursos em outros namespaces

## Killer.sh Style Challenge

> **Cenario:** Configure o Flux para: (1) monitorar o registry \`ghcr.io/myorg/api\` por novas tags semver >= 2.0.0 e atualizar automaticamente o deployment no Git; (2) enviar alertas de erro para um canal Slack; (3) criar um Receiver para que pushes no GitHub triggem reconciliacao imediata.
`,
  quiz: [
    {
      question: 'Quais tres recursos sao necessarios para configurar Image Automation no Flux?',
      options: [
        'ImageScan, ImageTag, ImageDeploy',
        'ImageRepository, ImagePolicy e ImageUpdateAutomation',
        'ImageWatcher, ImageSelector, ImageUpdater',
        'ContainerRegistry, TagSelector, AutoUpdater'
      ],
      correct: 1,
      explanation: 'Image Automation usa tres CRDs: ImageRepository (monitora o registry OCI por novas tags), ImagePolicy (define qual tag selecionar via semver/alphabetical/numerical), e ImageUpdateAutomation (faz commit no Git com a nova tag). Os tres trabalham em conjunto.',
      reference: 'Conceito relacionado: O marcador de comentario {"$imagepolicy": "namespace:nome"} no YAML indica ao Flux qual campo atualizar.'
    },
    {
      question: 'Qual e o proposito do marcador # {"$imagepolicy": "flux-system:podinfo"} em um manifest?',
      options: [
        'E um comentario sem funcao tecnica',
        'Indica ao ImageUpdateAutomation qual campo de imagem atualizar quando a ImagePolicy selecionar uma nova tag',
        'Configura a politica de pull da imagem',
        'Habilita o scan de vulnerabilidades da imagem'
      ],
      correct: 1,
      explanation: 'O marcador $imagepolicy e um comentario especial que o ImageUpdateAutomation usa para localizar qual campo no YAML deve ser atualizado. O formato e {"$imagepolicy": "namespace:nome-da-policy"}. Quando a ImagePolicy seleciona uma nova tag, o Flux atualiza esse campo no arquivo e faz commit no Git.',
      reference: 'Conceito relacionado: O Flux usa a strategy "Setters" para encontrar e atualizar esses marcadores nos arquivos YAML do repositorio.'
    },
    {
      question: 'Qual a diferenca entre Alert e Receiver no Notification Controller do Flux?',
      options: [
        'Sao o mesmo recurso com nomes diferentes',
        'Alert envia notificacoes para sistemas externos (Slack, Teams); Receiver recebe webhooks externos para triggar reconciliacao',
        'Alert e para erros; Receiver e para eventos de sucesso',
        'Alert e mais novo que Receiver na API'
      ],
      correct: 1,
      explanation: 'Alert e saida (outbound): quando o Flux detecta um evento, envia notificacao para um Provider (Slack, Teams, etc.). Receiver e entrada (inbound): recebe webhooks externos (GitHub push, Harbor scan) e trigga reconciliacao imediata de Sources sem esperar o interval.',
      reference: 'Conceito relacionado: Um Receiver para GitHub pode reduzir o tempo de deploy de minutos (interval) para segundos — reconciliacao imediata no push.'
    },
    {
      question: 'Como o Flux implementa multi-tenancy de forma segura?',
      options: [
        'Usando um namespace separado para cada controller',
        'Usando ServiceAccounts dedicadas por tenant com RBAC restrito, targetNamespace para forcar deploy no namespace correto, e Kustomizations por namespace de tenant',
        'Multi-tenancy nao e suportado pelo Flux',
        'Usando NetworkPolicies para isolar tenants'
      ],
      correct: 1,
      explanation: 'Multi-tenancy no Flux combina: (1) ServiceAccount por tenant com permissoes minimas; (2) spec.serviceAccountName na Kustomization para impersonar a SA do tenant; (3) spec.targetNamespace para forcas recursos ao namespace correto; (4) RBAC limitando o que a SA pode fazer. Evita vazamento de recursos entre times.',
      reference: 'Conceito relacionado: flux-multi-tenancy no GitHub tem exemplos de padroes de multi-tenancy recomendados pela comunidade.'
    },
    {
      question: 'O que o campo eventSeverity: info em um Alert significa?',
      options: [
        'Apenas eventos de nivel info sao enviados',
        'Eventos de nivel info ou superior sao enviados (info + warning + error)',
        'Apenas eventos de nivel error sao enviados',
        'O campo eventSeverity nao existe no Flux'
      ],
      correct: 1,
      explanation: 'eventSeverity define o nivel MINIMO de eventos a notificar. info envia todos (info, warning, error). warning envia warning e error. error envia apenas erros. Para alertas de oncall, usar error. Para auditoria completa, usar info.',
      reference: 'Conceito relacionado: Combinar um Alert com eventSeverity: error para o canal de alertas e outro com eventSeverity: info para um canal de auditoria/debug.'
    },
    {
      question: 'Como configurar o ImageUpdateAutomation para atualizar o Git com novas imagens?',
      options: [
        'Apenas criar o ImagePolicy — a atualizacao e automatica',
        'Criar ImageUpdateAutomation com sourceRef (GitRepository), configuracoes de git.commit (autor, mensagem), git.push (branch), e update.path (onde estao os manifests)',
        'Configurar um CronJob para fazer o push periodicamente',
        'O Flux nao pode modificar o repositorio Git'
      ],
      correct: 1,
      explanation: 'ImageUpdateAutomation precisa: sourceRef (qual GitRepository monitorar), git.checkout.ref.branch (branch para checkout), git.commit.author (identidade do commit automatico), git.push.branch (branch para push), update.strategy: Setters e update.path (diretorio com manifests marcados com $imagepolicy).',
      reference: 'Conceito relacionado: Para producao, usar git.push.branch diferente da branch principal e criar um PR automatico em vez de push direto.'
    },
    {
      question: 'Qual tipo de Provider permite atualizar o status de commits no GitHub durante reconciliacao?',
      options: [
        'type: github-status',
        'type: github',
        'type: git',
        'type: webhook'
      ],
      correct: 1,
      explanation: 'O type: github (Provider) usa a API do GitHub para atualizar o status de commits/PRs com o resultado da reconciliacao Flux — aparece como check verde/vermelho no PR. Requer um token GitHub com escopo de repo:status. Util para ver o status do deploy direto no PR.',
      reference: 'Conceito relacionado: Equivalente para GitLab e type: gitlab, que atualiza pipeline status nos commits.'
    }
  ],
  flashcards: [
    {
      front: 'Image Automation — fluxo completo',
      back: '**3 recursos necessarios:**\n\n1. **ImageRepository:**\n\`\`\`yaml\nspec:\n  image: ghcr.io/org/app\n  interval: 5m\n  secretRef:\n    name: ghcr-auth\n\`\`\`\n\n2. **ImagePolicy:**\n\`\`\`yaml\nspec:\n  imageRepositoryRef:\n    name: app\n  policy:\n    semver:\n      range: ">=1.0.0"\n\`\`\`\n\n3. **ImageUpdateAutomation:**\n\`\`\`yaml\nspec:\n  sourceRef:\n    kind: GitRepository\n    name: fleet-infra\n  git:\n    commit:\n      author:\n        name: fluxcdbot\n    push:\n      branch: main\n  update:\n    strategy: Setters\n    path: ./apps\n\`\`\`\n\n**Marcador no YAML:**\n\`image: org/app:1.0.0  # {"$imagepolicy": "flux-system:app"}\`\n\n**Fluxo:** Registry → ImageRepo → ImagePolicy seleciona tag → ImageUpdateAutomation commita no Git → Flux reconcilia'
    },
    {
      front: 'Notification Controller — Alert vs Receiver',
      back: '**Alert (saida — outbound):**\n\`\`\`yaml\nspec:\n  providerRef:\n    name: slack          # Para onde enviar\n  eventSeverity: error  # Nivel minimo\n  eventSources:\n    - kind: Kustomization\n      name: "*"          # Todos\n\`\`\`\n\n**Provider (destino):**\n\`\`\`yaml\nspec:\n  type: slack            # slack|msteams|github|email|webhook\n  channel: #k8s-alerts\n  secretRef:\n    name: slack-webhook\n\`\`\`\n\n**Receiver (entrada — inbound):**\n\`\`\`yaml\nspec:\n  type: github           # Tipo de webhook\n  events: ["push"]\n  secretRef:\n    name: webhook-token  # Token para validar\n  resources:\n    - kind: GitRepository\n      name: fleet-infra  # O que triggar\n\`\`\`\n\n**Receiver URL:**\n`kubectl get receiver -o jsonpath=\'{.status.webhookPath}\'`'
    },
    {
      front: 'ImagePolicy — estrategias de selecao de tag',
      back: '**semver (recomendado para releases):**\n\`\`\`yaml\npolicy:\n  semver:\n    range: ">=1.0.0 <2.0.0"  # Patch mais recente\n\`\`\`\n\n**alphabetical (para tags com data/hash):**\n\`\`\`yaml\npolicy:\n  alphabetical:\n    order: asc   # ou desc (a mais recente alfabeticamente)\n\`\`\`\n\n**numerical (para versoes numericas simples):**\n\`\`\`yaml\npolicy:\n  numerical:\n    order: asc   # Numero maior = mais recente\n\`\`\`\n\n**Com filtro de tag (regex):**\n\`\`\`yaml\nspec:\n  filterTags:\n    pattern: "^main-[a-f0-9]+-(?P<ts>[0-9]+)$"\n    extract: "$ts"    # Extrair e comparar este grupo\n  policy:\n    numerical:\n      order: asc\n\`\`\`\n\n**Ver tag selecionada:**\n`kubectl get imagepolicy nome -o jsonpath=\'{.status.latestImage}\'`'
    },
    {
      front: 'Multi-tenancy no Flux — padroes de isolamento',
      back: '**Componentes de isolamento:**\n\n1. **Namespace por tenant:**\n\`\`\`yaml\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: team-a\n  labels:\n    toolkit.fluxcd.io/tenant: team-a\n\`\`\`\n\n2. **ServiceAccount restrita:**\n\`\`\`yaml\napiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: flux-reconciler\n  namespace: team-a\n\`\`\`\n\n3. **Kustomization com SA e targetNamespace:**\n\`\`\`yaml\nspec:\n  serviceAccountName: flux-reconciler\n  targetNamespace: team-a   # Forcado!\n  sourceRef:\n    kind: GitRepository\n    name: team-a-repo\n\`\`\`\n\n**Beneficios:**\n- Time A nao acessa recursos do Time B\n- Deploy sempre no namespace correto\n- Auditoria clara por SA\n- Falha isolada nao afeta outros times'
    },
    {
      front: 'Provider types no Notification Controller',
      back: '**Mensageria:**\n- `slack` — Slack (webhook)\n- `msteams` — Microsoft Teams\n- `discord` — Discord\n- `telegram` — Telegram\n- `matrix` — Matrix\n- `rocket` — Rocket.Chat\n\n**CI/CD e Git:**\n- `github` — GitHub (commit status/checks)\n- `gitlab` — GitLab (pipeline status)\n- `gitea` — Gitea\n- `bitbucket` — Bitbucket\n\n**Alertas e Incidentes:**\n- `pagerduty` — PagerDuty\n- `opsgenie` — OpsGenie\n- `datadog` — Datadog Events\n- `sentry` — Sentry\n\n**Generico:**\n- `generic` — HTTP webhook generico\n- `generic-hmac` — Webhook com HMAC\n\n**Secret de autenticacao:**\nSempre secretRef com `address` (webhook URL) ou token'
    },
    {
      front: 'ImageUpdateAutomation — configuracao de push e commit',
      back: '**Push direto na main:**\n\`\`\`yaml\ngit:\n  push:\n    branch: main\n\`\`\`\n\n**Push em branch separada (para PR):**\n\`\`\`yaml\ngit:\n  push:\n    branch: flux/image-updates  # Branch diferente\n    # Criar PR manualmente ou via GitHub Actions\n\`\`\`\n\n**Commit message template:**\n\`\`\`yaml\ngit:\n  commit:\n    author:\n      email: flux@org.com\n      name: FluxBot\n    messageTemplate: |\n      Auto-update images\n      {{ range .Updated.Images -}}\n      - {{.}}\n      {{ end -}}\n\`\`\`\n\n**Verificar status:**\n`flux get image update nome`\n`kubectl get imageupdateautomation nome -o yaml`\n\n**Permissao necessaria:**\nDeploy key com acesso de ESCRITA ao repositorio'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar o sistema de notificacoes do Flux e explorar o Image Automation em um cluster de laboratorio.',
    objective: 'Aprender a configurar Providers, Alerts, Receivers e entender o fluxo de Image Automation.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Configurar notificacoes com Slack (simulado)',
        instruction: `Configure o sistema de notificacoes do Flux:
1. Criar um Secret com uma URL de webhook (pode ser uma URL de teste como webhook.site)
2. Criar um Provider apontando para o webhook
3. Criar um Alert para eventos de erro nos Kustomizations
4. Verificar que o Provider e Alert foram criados corretamente`,
        hints: [
          'O Secret deve ter a chave "address" com a URL do webhook encoded em base64',
          'Para testar sem Slack real, usar https://webhook.site para receber webhooks',
          'O Alert eventSeverity: info trigga em qualquer evento, util para testes'
        ],
        solution: `\`\`\`bash
# Criar Secret com webhook URL (usando webhook.site para teste)
# Substitua <YOUR-UUID> pela UUID do seu webhook.site
kubectl create secret generic slack-webhook \\
  --from-literal=address=https://webhook.site/test-endpoint \\
  -n flux-system
\`\`\`

\`\`\`yaml
# notification-provider.yaml
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: webhook-test
  namespace: flux-system
spec:
  type: generic             # Webhook generico para teste
  secretRef:
    name: slack-webhook
\`\`\`

\`\`\`yaml
# notification-alert.yaml
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Alert
metadata:
  name: flux-events
  namespace: flux-system
spec:
  providerRef:
    name: webhook-test
  eventSeverity: info       # Todos os eventos para teste
  eventSources:
    - kind: Kustomization
      name: "*"
      namespace: flux-system
    - kind: GitRepository
      name: "*"
      namespace: flux-system
\`\`\`

\`\`\`bash
kubectl apply -f notification-provider.yaml
kubectl apply -f notification-alert.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar Provider
kubectl get provider webhook-test -n flux-system
# Saida esperada: READY=True (ou Unknown se url nao existir)

kubectl describe provider webhook-test -n flux-system
# Verificar: Type: Ready, Status: True

# Verificar Alert
kubectl get alert flux-events -n flux-system
# Saida esperada: READY=True

# Ver todos os recursos de notificacao
kubectl get providers,alerts,receivers -n flux-system
# Saida esperada: lista com webhook-test e flux-events

# Triggar uma reconciliacao para gerar um evento
flux reconcile kustomization podinfo -n flux-system 2>/dev/null || true

# Ver logs do notification-controller
kubectl logs -n flux-system -l app=notification-controller --tail=20
# Saida esperada: logs de eventos sendo processados
\`\`\``
      },
      {
        title: 'Configurar ImageRepository e ImagePolicy',
        instruction: `Configure o Image Automation para monitorar uma imagem publica:
1. Criar um ImageRepository para monitorar ghcr.io/stefanprodan/podinfo
2. Criar uma ImagePolicy para selecionar tags semver >= 5.0.0
3. Verificar qual tag foi selecionada
4. Entender o marcador $imagepolicy que seria usado no manifest`,
        hints: [
          'ghcr.io/stefanprodan/podinfo e uma imagem publica — nao precisa de secretRef',
          'O status do ImageRepository mostra quantas tags foram encontradas',
          'A ImagePolicy mostra a latestImage selecionada no status'
        ],
        solution: `\`\`\`yaml
# image-repository.yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: podinfo
  namespace: flux-system
spec:
  image: ghcr.io/stefanprodan/podinfo
  interval: 5m
  # Sem secretRef pois e imagem publica
\`\`\`

\`\`\`yaml
# image-policy.yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: podinfo
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: podinfo
  policy:
    semver:
      range: ">=5.0.0"        # Ultima versao >= 5.0.0
\`\`\`

\`\`\`bash
kubectl apply -f image-repository.yaml
kubectl apply -f image-policy.yaml

# Aguardar sincronizacao (alguns minutos)
echo "Aguardando scan do registry..."
sleep 30
\`\`\`

\`\`\`bash
# Ver qual tag seria usada no marcador (para referencia):
# image: ghcr.io/stefanprodan/podinfo:X.Y.Z  # {"$imagepolicy": "flux-system:podinfo"}
echo 'Marcador que seria usado no YAML:'
echo '# {"$imagepolicy": "flux-system:podinfo"}'
\`\`\``,
        verify: `\`\`\`bash
# Verificar ImageRepository
kubectl get imagerepository podinfo -n flux-system
# Saida esperada: READY=True, com numero de tags encontradas

# Ver detalhes do scan
kubectl describe imagerepository podinfo -n flux-system | grep -A5 "Status:"
# Saida esperada: LastScanResult com numero de tags

# Verificar ImagePolicy e qual tag foi selecionada
kubectl get imagepolicy podinfo -n flux-system
# Saida esperada: READY=True e LATESTIMAGE com a tag selecionada

# Ver a tag mais recente selecionada pela policy
kubectl get imagepolicy podinfo -n flux-system -o jsonpath='{.status.latestImage}'
# Saida esperada: ghcr.io/stefanprodan/podinfo:X.Y.Z (versao mais recente >= 5.0.0)

# Ver todas as tags encontradas (pode ser muitas)
kubectl get imagerepository podinfo -n flux-system -o yaml | grep -A3 "lastScanResult"
\`\`\``
      },
      {
        title: 'Configurar Receiver para webhooks GitHub',
        instruction: `Configure um Receiver para receber webhooks do GitHub:
1. Criar um Secret com um token para validar o webhook
2. Criar o Receiver do tipo github
3. Obter a URL do webhook para configurar no GitHub
4. Entender como o Receiver trigga reconciliacao imediata`,
        hints: [
          'O token no Secret e usado para validar a assinatura HMAC do webhook do GitHub',
          'A URL do webhook fica em status.webhookPath do Receiver',
          'O notification-controller precisa de um Service/Ingress para ser acessivel externamente'
        ],
        solution: `\`\`\`bash
# Gerar token aleatorio para validar webhooks
TOKEN=\$(head -c 12 /dev/urandom | shasum | cut -d ' ' -f1)
echo "Token gerado: \$TOKEN"

# Criar Secret com o token
kubectl create secret generic github-webhook-token \\
  --from-literal=token=\$TOKEN \\
  -n flux-system
\`\`\`

\`\`\`yaml
# receiver.yaml
apiVersion: notification.toolkit.fluxcd.io/v1
kind: Receiver
metadata:
  name: github-receiver
  namespace: flux-system
spec:
  type: github
  events:
    - "ping"
    - "push"
  secretRef:
    name: github-webhook-token
  resources:
    - apiVersion: source.toolkit.fluxcd.io/v1
      kind: GitRepository
      name: podinfo            # GitRepository a triggar
      namespace: flux-system
\`\`\`

\`\`\`bash
kubectl apply -f receiver.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar Receiver criado
kubectl get receiver github-receiver -n flux-system
# Saida esperada: READY=True

# Ver URL do webhook (para configurar no GitHub)
WEBHOOK_PATH=\$(kubectl get receiver github-receiver -n flux-system \\
  -o jsonpath='{.status.webhookPath}')
echo "Webhook path: \$WEBHOOK_PATH"
# Saida esperada: /hook/sha256:<hash>

# Ver URL completa que o GitHub usaria
echo "Para configurar no GitHub:"
echo "URL: http://<cluster-ip>:9292\$WEBHOOK_PATH"

# Verificar todos os receivers
kubectl get receivers -n flux-system
# Saida esperada: github-receiver READY=True

# Ver logs do notification-controller
kubectl logs -n flux-system -l app=notification-controller --tail=10
# Saida esperada: logs indicando receiver configurado

# Ver detalhes do receiver
kubectl describe receiver github-receiver -n flux-system
# Saida esperada: Status com webhookPath disponivel
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ImageUpdateAutomation nao faz commit — permissao de push negada',
      difficulty: 'medium',
      symptom: 'O ImageUpdateAutomation detecta novas imagens e a ImagePolicy seleciona tags atualizadas, mas nenhum commit e feito no repositorio Git. O status mostra erro de autenticacao ou permissao.',
      diagnosis: `\`\`\`bash
# 1. Verificar status do ImageUpdateAutomation
kubectl get imageupdateautomation -n flux-system
kubectl describe imageupdateautomation flux-system -n flux-system | grep -A10 "Status:"

# 2. Ver logs do image-automation-controller
kubectl logs -n flux-system -l app=image-automation-controller --tail=30

# 3. Verificar se o GitRepository tem permissao de escrita
kubectl get gitrepository fleet-infra -n flux-system -o yaml | grep -A5 "secretRef:"

# 4. Verificar o Secret de autenticacao Git
kubectl get secret <nome-do-secret> -n flux-system -o yaml

# 5. Verificar se a branch de push existe
kubectl get imageupdateautomation -n flux-system -o yaml | grep -A3 "push:"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Deploy key sem permissao de escrita:** A chave SSH usada pelo GitRepository deve ter permissao de PUSH/WRITE no repositorio. No GitHub, va em Settings > Deploy Keys e habilite "Allow write access".

2. **Token com escopo insuficiente:** Para repositorios HTTPS, o Personal Access Token deve ter o escopo \`repo\` (nao so \`repo:read\`).

3. **Branch de push nao existe:** Se spec.git.push.branch especifica uma branch que nao existe, o push falha. Criar a branch primeiro ou usar uma branch existente.

4. **GitRepository e somente leitura:** Verificar se o mesmo Secret e usado para read e write — criar um Secret separado com chave de escrita se necessario.

5. **Confirmar que image-automation-controller esta instalado:**
\`\`\`bash
flux check
# Verificar: image-automation-controller: deployment ready
kubectl get deploy -n flux-system | grep image-automation
\`\`\``
    },
    {
      title: 'Alert nao envia notificacoes para Slack — webhook retorna 4xx',
      difficulty: 'easy',
      symptom: 'Os eventos Flux estao sendo gerados corretamente, mas nenhuma mensagem e recebida no canal Slack. Os logs do notification-controller mostram erros HTTP 4xx.',
      diagnosis: `\`\`\`bash
# 1. Verificar status do Provider
kubectl get provider slack -n flux-system
kubectl describe provider slack -n flux-system | grep -A5 "Status:"

# 2. Ver logs do notification-controller com nivel de detalhe
kubectl logs -n flux-system -l app=notification-controller --tail=50 | grep -i "slack\\|error\\|webhook"

# 3. Verificar o Secret com a URL do webhook
kubectl get secret slack-webhook -n flux-system -o jsonpath='{.data.address}' | base64 -d
# Conferir se a URL esta correta

# 4. Verificar o Alert
kubectl get alert -n flux-system
kubectl describe alert on-call-slack -n flux-system

# 5. Testar a URL do webhook manualmente
WEBHOOK_URL=\$(kubectl get secret slack-webhook -n flux-system -o jsonpath='{.data.address}' | base64 -d)
curl -X POST -H 'Content-type: application/json' \\
  --data '{"text":"Teste do Flux"}' "\$WEBHOOK_URL"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **URL do webhook expirada:** Webhooks do Slack expiram ou sao revogados. Gerar um novo webhook em api.slack.com/apps e atualizar o Secret:
\`\`\`bash
kubectl create secret generic slack-webhook \\
  --from-literal=address=<nova-url> \\
  -n flux-system --dry-run=client -o yaml | kubectl apply -f -
\`\`\`

2. **Formato errado no Secret:** O campo deve ser \`address\`, nao \`url\` ou \`webhook\`. Verificar a chave exata no Secret.

3. **Canal nao existe ou bot sem acesso:** Se o Provider tem spec.channel, verificar que o canal existe e que o Slack app tem permissao para postar nele.

4. **exclusionList filtrando todos os eventos:** Se o exclusionList tem um regex muito abrangente, todos os eventos podem ser filtrados. Remover ou ajustar o exclusionList temporariamente para debug.

5. **eventSources muito restrito:** Verificar se o Alert tem os eventSources corretos (kind e name do recurso que esta gerando eventos).`
    }
  ]
};
