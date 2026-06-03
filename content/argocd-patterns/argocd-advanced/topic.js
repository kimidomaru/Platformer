window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['argocd-patterns/argocd-advanced'] = {
  theory: `
# ArgoCD Avancado — Multi-Cluster, Notifications & Image Updater

## Relevancia
Em ambientes de producao reais, ArgoCD vai alem de sincronizar um unico cluster. Multi-cluster management, notificacoes automatizadas e atualizacao automatica de imagens sao funcionalidades avancadas que diferenciam um setup basico de um pipeline GitOps maduro e corporativo.

## Conceitos Fundamentais

### Multi-Cluster Management

O ArgoCD pode gerenciar multiplos clusters a partir de uma unica instalacao:

\`\`\`
ArgoCD (Hub Cluster)
  |-- Cluster: dev (https://dev.k8s.local)
  |-- Cluster: staging (https://staging.k8s.local)
  |-- Cluster: prod-us (https://prod-us.k8s.local)
  +-- Cluster: prod-eu (https://prod-eu.k8s.local)
\`\`\`

**Registrar cluster externo:**
\`\`\`bash
# Listar contextos kubeconfig
kubectl config get-contexts

# Adicionar cluster ao ArgoCD
argocd cluster add prod-context --name production

# Listar clusters
argocd cluster list

# Adicionar com labels (para ApplicationSet cluster generator)
argocd cluster add staging-context --name staging --label environment=staging --label tier=non-prod
\`\`\`

**O que acontece ao registrar um cluster:**
1. ArgoCD cria um ServiceAccount no cluster remoto
2. Cria ClusterRole e ClusterRoleBinding
3. Armazena credenciais como Secret no namespace argocd
4. O Application Controller se conecta via API do cluster remoto

**Secret de cluster:**
\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: prod-cluster
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: cluster
    environment: production
    tier: prod
type: Opaque
stringData:
  name: production
  server: https://prod.k8s.local:6443
  config: |
    {
      "bearerToken": "eyJhbG...",
      "tlsClientConfig": {
        "insecure": false,
        "caData": "LS0tLS..."
      }
    }
\`\`\`

### ArgoCD Notifications

O ArgoCD Notifications Controller envia notificacoes sobre eventos das Applications:

\`\`\`yaml
# argocd-notifications-cm ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-notifications-cm
  namespace: argocd
data:
  # Servicos (destinos)
  service.slack: |
    token: \$slack-token

  service.webhook.grafana: |
    url: https://grafana.example.com/api/annotations
    headers:
      - name: Authorization
        value: Bearer \$grafana-token

  # Templates (formato da mensagem)
  template.app-sync-succeeded: |
    message: |
      Application {{.app.metadata.name}} sync succeeded.
      Revision: {{.app.status.sync.revision}}
    slack:
      attachments: |
        [{
          "color": "#18be52",
          "title": "{{.app.metadata.name}} synced",
          "fields": [
            {"title": "Project", "value": "{{.app.spec.project}}", "short": true},
            {"title": "Revision", "value": "{{.app.status.sync.revision | trunc 7}}", "short": true}
          ]
        }]

  template.app-sync-failed: |
    message: |
      Application {{.app.metadata.name}} sync FAILED.
      Error: {{.app.status.operationState.message}}
    slack:
      attachments: |
        [{
          "color": "#E96D76",
          "title": "{{.app.metadata.name}} sync failed",
          "text": "{{.app.status.operationState.message}}"
        }]

  template.app-health-degraded: |
    message: |
      Application {{.app.metadata.name}} is DEGRADED.

  # Triggers (quando enviar)
  trigger.on-sync-succeeded: |
    - when: app.status.operationState.phase in ['Succeeded']
      send: [app-sync-succeeded]

  trigger.on-sync-failed: |
    - when: app.status.operationState.phase in ['Error', 'Failed']
      send: [app-sync-failed]

  trigger.on-health-degraded: |
    - when: app.status.health.status == 'Degraded'
      send: [app-health-degraded]
\`\`\`

**Ativar notificacoes em uma Application:**
\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
  annotations:
    notifications.argoproj.io/subscribe.on-sync-succeeded.slack: alerts-channel
    notifications.argoproj.io/subscribe.on-sync-failed.slack: alerts-critical
    notifications.argoproj.io/subscribe.on-health-degraded.slack: alerts-critical
\`\`\`

### ArgoCD Image Updater

O ArgoCD Image Updater monitora registries de container images e atualiza automaticamente a tag no Git:

\`\`\`
Container Registry          ArgoCD Image Updater          Git Repository
(Docker Hub, ECR, etc.)  →  (detecta nova tag)         →  (atualiza values)
                                                          → ArgoCD sync
\`\`\`

**Instalacao:**
\`\`\`bash
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/manifests/install.yaml
\`\`\`

**Configurar em uma Application:**
\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
  annotations:
    # Habilitar Image Updater para esta Application
    argocd-image-updater.argoproj.io/image-list: myapp=docker.io/myorg/myapp

    # Estrategia de update
    argocd-image-updater.argoproj.io/myapp.update-strategy: semver

    # Filtro de tags (apenas tags semver)
    argocd-image-updater.argoproj.io/myapp.allow-tags: regexp:^v[0-9]+\\.[0-9]+\\.[0-9]+$

    # Como escrever a mudanca (direto no Git)
    argocd-image-updater.argoproj.io/write-back-method: git
    argocd-image-updater.argoproj.io/write-back-target: kustomization
\`\`\`

**Estrategias de update:**

| Estrategia | Descricao |
|-----------|-----------|
| **semver** | Atualiza para a maior versao semver compativel |
| **latest** | Atualiza para a tag mais recente (por data) |
| **name** | Atualiza pela tag com maior nome (alfabetico) |
| **digest** | Atualiza quando o digest de uma tag muda |

### Best Practices para Producao

**Estrutura de repositorios GitOps:**
\`\`\`
Repo 1: app-source (codigo + Dockerfile)
  → CI: build, test, push image

Repo 2: gitops-config (manifests K8s)
  |-- base/
  |   +-- kustomization.yaml
  |-- overlays/
  |   |-- dev/
  |   |-- staging/
  |   +-- production/
  +-- apps/  (Application manifests)
\`\`\`

**Separacao source vs config:**
- **Source repo**: codigo da aplicacao, Dockerfile, testes
- **Config repo**: manifests K8s, Helm values, Kustomize overlays
- CI pusha imagem para registry e atualiza tag no config repo
- ArgoCD monitora config repo e aplica mudancas

**Estrategia de branches:**
\`\`\`
main → production
staging → staging environment
develop → dev environment
\`\`\`

### Disaster Recovery

\`\`\`bash
# Backup: exportar todas as Applications
argocd app list -o json > apps-backup.json

# Backup: exportar ApplicationSets
kubectl get applicationset -n argocd -o yaml > appsets-backup.yaml

# Backup: exportar Projects
kubectl get appproject -n argocd -o yaml > projects-backup.yaml

# Backup: exportar ConfigMaps criticos
kubectl get cm argocd-cm argocd-rbac-cm argocd-notifications-cm -n argocd -o yaml > config-backup.yaml

# Backup: exportar Secrets de repositorios
kubectl get secret -n argocd -l argocd.argoproj.io/secret-type=repository -o yaml > repos-backup.yaml

# Restore: aplicar backups
kubectl apply -f config-backup.yaml
kubectl apply -f projects-backup.yaml
kubectl apply -f repos-backup.yaml
kubectl apply -f appsets-backup.yaml
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Multi-cluster
argocd cluster add <context> --name <name>
argocd cluster list
argocd cluster get <name>
argocd cluster rm <server-url>

# Notifications
kubectl get cm argocd-notifications-cm -n argocd -o yaml
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-notifications-controller

# Image Updater
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-image-updater
argocd-image-updater test <image> --registries-conf-path /etc/registries.conf

# Metricas
kubectl port-forward svc/argocd-server -n argocd 8083:8083
curl http://localhost:8083/metrics | grep argocd_app
\`\`\`

## Erros Comuns

1. **Credenciais de cluster expiradas**: Tokens de ServiceAccount podem expirar. Monitore e renove periodicamente.
2. **Notificacoes nao enviadas**: O token do Slack/webhook pode estar invalido. Verifique o Secret e teste manualmente.
3. **Image Updater atualizando para versao errada**: Sem filtro de tags, o updater pode pegar tags indesejaveis (ex: \`latest\`, \`dev\`). Sempre use \`allow-tags\`.
4. **Um unico ArgoCD para muitos clusters**: A latencia aumenta com muitos clusters remotos. Considere ArgoCD por regiao.
5. **Nao versionar configuracoes do ArgoCD**: argocd-cm, argocd-rbac-cm e notifications-cm devem estar no Git.
6. **Sem monitoring do ArgoCD**: O ArgoCD expoe metricas Prometheus. Monitore sync failures, latencia e health status.

## Killer.sh Style Challenge

**Cenario:** Configure um setup ArgoCD de producao com multi-cluster, notificacoes e atualizacao automatica de imagens.

**Tarefas:**
1. Registre 2 clusters externos no ArgoCD
2. Configure notificacoes Slack para sync success/failure
3. Configure ArgoCD Image Updater para atualizar automaticamente uma imagem
4. Configure monitoring com metricas Prometheus
5. Crie um plano de backup/restore para o ArgoCD
`,
  quiz: [
    {
      question: 'O que acontece quando voce registra um cluster externo no ArgoCD com "argocd cluster add"?',
      options: [
        'O ArgoCD instala um agente no cluster remoto',
        'O ArgoCD cria ServiceAccount, ClusterRole e ClusterRoleBinding no cluster remoto e armazena credenciais como Secret',
        'O cluster remoto se conecta ao ArgoCD automaticamente',
        'O ArgoCD clona o kubeconfig do cluster remoto'
      ],
      correct: 1,
      explanation: 'Ao registrar um cluster, o ArgoCD cria um ServiceAccount com ClusterRole e ClusterRoleBinding no cluster remoto, e armazena as credenciais (bearer token + CA) como Secret no namespace argocd. O Application Controller usa essas credenciais para se conectar ao cluster remoto via API.',
      reference: 'Conceito relacionado: argocd-app-of-apps — use Cluster generator para deploy automatico em clusters registrados.'
    },
    {
      question: 'Qual componente do ArgoCD e responsavel por enviar notificacoes sobre eventos das Applications?',
      options: [
        'Application Controller',
        'API Server',
        'Notifications Controller',
        'Repo Server'
      ],
      correct: 2,
      explanation: 'O Notifications Controller (argocd-notifications-controller) monitora eventos das Applications (sync success/failure, health changes) e envia notificacoes configuradas para destinos como Slack, Email, Webhook, etc. E configurado via argocd-notifications-cm ConfigMap.',
      reference: 'Conceito relacionado: argocd-architecture — o Notifications Controller e um dos componentes opcionais do ArgoCD.'
    },
    {
      question: 'O que o ArgoCD Image Updater faz?',
      options: [
        'Constroi imagens Docker automaticamente',
        'Monitora registries de container e atualiza automaticamente a tag da imagem no Git quando uma nova versao e publicada',
        'Faz push de imagens para o registry',
        'Valida se imagens tem vulnerabilidades'
      ],
      correct: 1,
      explanation: 'O Image Updater monitora container registries (Docker Hub, ECR, GCR, etc.) e quando detecta uma nova tag que corresponde a estrategia configurada (semver, latest, etc.), atualiza automaticamente o manifest no Git com a nova tag. O ArgoCD entao sincroniza a mudanca.',
      reference: 'Conceito relacionado: argocd-sync-strategies — auto-sync garante que a mudanca feita pelo Image Updater seja aplicada automaticamente.'
    },
    {
      question: 'Por que e recomendado separar o repositorio de codigo (source) do repositorio de configuracao (config) no GitOps?',
      options: [
        'Apenas por organizacao',
        'Para evitar loops de CI (build → push tag → trigger build), manter audit trails separados, e permitir que equipes diferentes gerenciem cada repo',
        'Porque o ArgoCD nao suporta repos mistos',
        'Porque o Git nao suporta repos grandes'
      ],
      correct: 1,
      explanation: 'Separar source e config evita loops de CI (commit de config no source repo dispara novo build), mantem audit trails limpos (quem mudou o codigo vs quem mudou a config), e permite ownership diferente (devs no source, SRE/platform no config).',
      reference: 'Conceito relacionado: argocd-applications — Multiple Sources (v2.6+) permite combinar chart de um repo com values de outro.'
    },
    {
      question: 'Qual estrategia do Image Updater atualiza para a maior versao semver compativel?',
      options: [
        'latest',
        'digest',
        'semver',
        'name'
      ],
      correct: 2,
      explanation: 'A estrategia semver analisa as tags no formato Semantic Versioning (ex: v1.2.3) e atualiza para a maior versao compativel. Pode ser combinada com constraints (ex: ~1.2 para apenas minor updates). As estrategias latest (por data) e name (alfabetico) sao menos precisas.',
      reference: 'Conceito relacionado: argocd-advanced — use allow-tags com regex para filtrar tags indesejaveis.'
    },
    {
      question: 'Quais ConfigMaps sao criticos para backup do ArgoCD?',
      options: [
        'Apenas argocd-cm',
        'argocd-cm, argocd-rbac-cm e argocd-notifications-cm',
        'Nenhum — tudo esta nos CRDs',
        'Apenas os Secrets de repositorio'
      ],
      correct: 1,
      explanation: 'Os ConfigMaps criticos sao: argocd-cm (configuracao geral, repos, timeouts), argocd-rbac-cm (politicas de acesso, mapeamento SSO), e argocd-notifications-cm (templates e triggers de notificacao). Alem deles, Secrets de repositorio e cluster tambem devem ser incluidos no backup.',
      reference: 'Conceito relacionado: argocd-projects — AppProjects e Applications tambem devem ser versionados/backup.'
    },
    {
      question: 'Como ativar notificacoes para uma Application especifica no ArgoCD?',
      options: [
        'Configurando no argocd-cm ConfigMap',
        'Adicionando annotations na Application com o formato notifications.argoproj.io/subscribe.<trigger>.<service>',
        'Criando um CRD de notificacao',
        'Configurando no argocd-rbac-cm'
      ],
      correct: 1,
      explanation: 'Notificacoes sao ativadas via annotations na Application: notifications.argoproj.io/subscribe.<trigger>.<service>: <destination>. Exemplo: notifications.argoproj.io/subscribe.on-sync-failed.slack: alerts-critical. O trigger define quando notificar, service define o canal.',
      reference: 'Conceito relacionado: argocd-advanced — configure templates e triggers no argocd-notifications-cm antes de ativar.'
    }
  ],
  flashcards: [
    {
      front: 'Como o ArgoCD gerencia multiplos clusters?',
      back: '**Registro:**\n```bash\nargocd cluster add <context> --name <name>\n```\n\n**O que acontece:**\n1. Cria ServiceAccount no cluster remoto\n2. Cria ClusterRole + ClusterRoleBinding\n3. Armazena credenciais como Secret no argocd namespace\n\n**Labels para ApplicationSets:**\n```bash\nargocd cluster add ctx --label env=prod --label tier=production\n```\n\n**Best practice:**\n- Um ArgoCD hub para clusters na mesma regiao\n- ArgoCD separado por regiao para reduzir latencia\n- Monitorar connectivity dos clusters'
    },
    {
      front: 'Como configurar notificacoes no ArgoCD?',
      back: '**1. Configurar servico (argocd-notifications-cm):**\n```yaml\nservice.slack: |\n  token: $slack-token\n```\n\n**2. Criar template:**\n```yaml\ntemplate.app-sync-failed: |\n  message: "{{.app.metadata.name}} FAILED"\n```\n\n**3. Criar trigger:**\n```yaml\ntrigger.on-sync-failed: |\n  - when: app.status.operationState.phase in [\'Failed\']\n    send: [app-sync-failed]\n```\n\n**4. Ativar na Application (annotation):**\n```yaml\nnotifications.argoproj.io/subscribe.on-sync-failed.slack: alerts\n```'
    },
    {
      front: 'Como funciona o ArgoCD Image Updater?',
      back: '**Fluxo:**\n1. Monitora container registry periodicamente\n2. Detecta nova tag compativel com a estrategia\n3. Atualiza o manifest no Git (write-back)\n4. ArgoCD detecta mudanca e faz sync\n\n**Configuracao (annotations):**\n```yaml\nargocd-image-updater.argoproj.io/image-list: \n  app=docker.io/org/app\nargocd-image-updater.argoproj.io/app.update-strategy: \n  semver\nargocd-image-updater.argoproj.io/app.allow-tags: \n  regexp:^v[0-9]+\\\\.[0-9]+$\nargocd-image-updater.argoproj.io/write-back-method: \n  git\n```\n\n**Estrategias:** semver, latest, name, digest'
    },
    {
      front: 'Qual a estrutura recomendada de repos para GitOps?',
      back: '**Repo 1: Source (codigo)**\n- Codigo da aplicacao\n- Dockerfile\n- Testes\n- CI pipeline (build + push image)\n\n**Repo 2: Config (manifests)**\n- Manifests Kubernetes\n- Helm values / Kustomize overlays\n- Application manifests do ArgoCD\n- Estrutura por ambiente:\n```\noverlays/\n  dev/\n  staging/\n  production/\n```\n\n**Beneficios:**\n- Evita loops de CI\n- Audit trails separados\n- Ownership diferente (dev vs SRE)\n- Rollback independente'
    },
    {
      front: 'Como monitorar o ArgoCD com Prometheus?',
      back: '**Metricas expostas:**\n- \`argocd_app_info\` — info das Applications\n- \`argocd_app_sync_total\` — contagem de syncs\n- \`argocd_app_reconcile_count\` — reconciliacoes\n- \`argocd_app_health_status\` — health por app\n- \`argocd_cluster_api_server_requests_total\`\n\n**Endpoints:**\n- Server: :8083/metrics\n- Controller: :8082/metrics\n- Repo Server: :8084/metrics\n\n**ServiceMonitor:**\n```yaml\napiVersion: monitoring.coreos.com/v1\nkind: ServiceMonitor\nmetadata:\n  name: argocd\nspec:\n  selector:\n    matchLabels:\n      app.kubernetes.io/part-of: argocd\n```\n\n**Dashboard Grafana:** ID 14584'
    },
    {
      front: 'Checklist de producao para ArgoCD?',
      back: '**Infra:**\n- [ ] HA installation (replicas > 1)\n- [ ] Resource limits em todos os pods\n- [ ] TLS via Ingress + cert-manager\n- [ ] Redis HA com Sentinel\n\n**Seguranca:**\n- [ ] SSO configurado (Dex/OIDC)\n- [ ] RBAC com policy.default: readonly\n- [ ] Projects por equipe\n- [ ] Sync windows para producao\n\n**Operacional:**\n- [ ] Monitoring (Prometheus + Grafana)\n- [ ] Notifications (Slack/PagerDuty)\n- [ ] Backup de ConfigMaps e Secrets\n- [ ] Git webhooks para sync rapido\n\n**GitOps:**\n- [ ] Source e config repos separados\n- [ ] Image Updater configurado\n- [ ] ApplicationSets para scaling'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar funcionalidades avancadas do ArgoCD: notificacoes, metricas e backup para um ambiente de producao.',
    objective: 'Configurar notificacoes via webhook, explorar metricas Prometheus do ArgoCD, e criar procedimento de backup/restore.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Configurar Notificacoes',
        instruction: `Configure o ArgoCD Notifications para enviar notificacoes via webhook.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-notifications-cm
  namespace: argocd
data:
  service.webhook.test: |
    url: https://webhook.site/your-unique-url
    headers:
      - name: Content-Type
        value: application/json

  template.app-sync-status: |
    webhook:
      test:
        method: POST
        body: |
          {
            "app": "{{.app.metadata.name}}",
            "sync": "{{.app.status.sync.status}}",
            "health": "{{.app.status.health.status}}"
          }

  trigger.on-sync-succeeded: |
    - when: app.status.operationState.phase in ['Succeeded']
      send: [app-sync-status]

  trigger.on-sync-failed: |
    - when: app.status.operationState.phase in ['Error', 'Failed']
      send: [app-sync-status]
EOF
\`\`\``,
        hints: [
          'Use webhook.site para criar um endpoint de teste gratuito',
          'O template define o formato da mensagem',
          'O trigger define quando a notificacao e enviada'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-notifications-cm
  namespace: argocd
data:
  service.webhook.test: |
    url: https://webhook.site/test
    headers:
      - name: Content-Type
        value: application/json
  template.app-sync-status: |
    webhook:
      test:
        method: POST
        body: |
          {"app": "{{.app.metadata.name}}", "sync": "{{.app.status.sync.status}}"}
  trigger.on-sync-succeeded: |
    - when: app.status.operationState.phase in ['Succeeded']
      send: [app-sync-status]
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar ConfigMap
kubectl get cm argocd-notifications-cm -n argocd -o yaml | grep -c "template\\|trigger\\|service"
# Saida esperada: numero > 0

# Verificar logs do controller
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-notifications-controller --tail=5
# Saida esperada: logs sem erros
\`\`\``
      },
      {
        title: 'Explorar Metricas Prometheus',
        instruction: `Explore as metricas Prometheus expostas pelo ArgoCD.

\`\`\`bash
# Port-forward para metricas do server
kubectl port-forward svc/argocd-server-metrics -n argocd 8083:8083 &

# Ou diretamente do pod
kubectl exec -n argocd deploy/argocd-server -- curl -s http://localhost:8083/metrics 2>/dev/null | grep argocd_app | head -20

# Metricas do Application Controller
kubectl exec -n argocd sts/argocd-application-controller -- curl -s http://localhost:8082/metrics 2>/dev/null | grep argocd_app_reconcile | head -10

# Metricas do Repo Server
kubectl exec -n argocd deploy/argocd-repo-server -- curl -s http://localhost:8084/metrics 2>/dev/null | grep argocd_git | head -10
\`\`\``,
        hints: [
          'O ArgoCD expoe metricas em 3 endpoints separados',
          'Metricas incluem sync status, health, latencia e contagem de operacoes',
          'Use essas metricas para dashboards Grafana e alertas'
        ],
        solution: `\`\`\`bash
kubectl exec -n argocd deploy/argocd-server -- curl -s http://localhost:8083/metrics 2>/dev/null | grep argocd_app | head -20
\`\`\``,
        verify: `\`\`\`bash
# Verificar que metricas estao disponiveis
kubectl exec -n argocd deploy/argocd-server -- curl -s http://localhost:8083/metrics 2>/dev/null | grep -c argocd_app
# Saida esperada: numero > 0
\`\`\``
      },
      {
        title: 'Criar Backup do ArgoCD',
        instruction: `Crie um backup completo das configuracoes do ArgoCD.

\`\`\`bash
# Backup de ConfigMaps
kubectl get cm argocd-cm argocd-rbac-cm argocd-notifications-cm -n argocd -o yaml > /tmp/argocd-cm-backup.yaml

# Backup de Projects
kubectl get appproject -n argocd -o yaml > /tmp/argocd-projects-backup.yaml

# Backup de Applications
kubectl get application -n argocd -o yaml > /tmp/argocd-apps-backup.yaml

# Backup de ApplicationSets
kubectl get applicationset -n argocd -o yaml > /tmp/argocd-appsets-backup.yaml

# Backup de Secrets (repos e clusters)
kubectl get secret -n argocd -l argocd.argoproj.io/secret-type -o yaml > /tmp/argocd-secrets-backup.yaml

# Listar backups
ls -la /tmp/argocd-*-backup.yaml
\`\`\``,
        hints: [
          'ConfigMaps contem a configuracao principal do ArgoCD',
          'Secrets contem credenciais de repos e clusters',
          'Em producao, armazene backups em local seguro (nao no Git se contem secrets)'
        ],
        solution: `\`\`\`bash
kubectl get cm argocd-cm argocd-rbac-cm -n argocd -o yaml > /tmp/argocd-cm-backup.yaml
kubectl get appproject -n argocd -o yaml > /tmp/argocd-projects-backup.yaml
kubectl get application -n argocd -o yaml > /tmp/argocd-apps-backup.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar que os backups foram criados
ls -la /tmp/argocd-*-backup.yaml
# Saida esperada: arquivos com tamanho > 0

# Verificar conteudo de um backup
grep "kind:" /tmp/argocd-cm-backup.yaml | head -3
# Saida esperada: kind: ConfigMap
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Cluster remoto desconectado — "cluster connection failed"',
      difficulty: 'medium',
      symptom: 'Applications em um cluster remoto mostram erro "cluster connection failed" e ficam com status Unknown.',
      diagnosis: `\`\`\`bash
# Verificar conectividade
argocd cluster get <cluster-name>

# Ver status dos clusters
argocd cluster list

# Verificar Secret do cluster
kubectl get secret -n argocd -l argocd.argoproj.io/secret-type=cluster

# Testar conexao direta
kubectl --context <context-name> get nodes
\`\`\``,
      solution: `**Causas comuns:**

1. **Token expirado:** ServiceAccount tokens podem expirar. Recrie:
\`\`\`bash
argocd cluster rm <server-url>
argocd cluster add <context-name> --name <cluster-name>
\`\`\`

2. **Firewall/rede:** O ArgoCD precisa acessar o API server do cluster remoto. Verifique conectividade de rede.

3. **Certificado TLS alterado:** Se o CA do cluster mudou, atualize o Secret:
\`\`\`bash
# Re-registrar o cluster
argocd cluster rm <server-url>
argocd cluster add <context-name>
\`\`\`

4. **API server indisponivel:** O cluster remoto pode estar down. Verifique o health do cluster.`
    },
    {
      title: 'Notificacoes nao sao enviadas',
      difficulty: 'easy',
      symptom: 'Configurou notificacoes no ArgoCD mas nenhuma mensagem e recebida no Slack/webhook mesmo quando Applications fazem sync.',
      diagnosis: `\`\`\`bash
# Verificar logs do notifications controller
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-notifications-controller --tail=30

# Verificar ConfigMap
kubectl get cm argocd-notifications-cm -n argocd -o yaml

# Verificar annotations da Application
kubectl get application <app-name> -n argocd -o jsonpath='{.metadata.annotations}' | jq .
\`\`\``,
      solution: `**Causas comuns:**

1. **Annotation faltando na Application:** Verifique que a annotation de subscribe esta correta:
\`\`\`yaml
annotations:
  notifications.argoproj.io/subscribe.on-sync-succeeded.slack: channel-name
\`\`\`

2. **Token invalido:** O token do Slack/webhook pode estar errado. Verifique o Secret:
\`\`\`bash
kubectl get secret argocd-notifications-secret -n argocd -o yaml
\`\`\`

3. **Template/trigger com erro de sintaxe:** Valide o YAML do ConfigMap cuidadosamente. Um erro de template Go causa falha silenciosa.

4. **Controller nao reiniciado:** Apos alterar o ConfigMap, o controller pode precisar de restart:
\`\`\`bash
kubectl rollout restart deployment argocd-notifications-controller -n argocd
\`\`\``
    },
    {
      title: 'Image Updater atualiza para versao incorreta',
      difficulty: 'hard',
      symptom: 'O ArgoCD Image Updater atualizou a tag da imagem para uma versao inesperada (ex: tag de dev, pre-release ou latest).',
      diagnosis: `\`\`\`bash
# Ver logs do Image Updater
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-image-updater --tail=30

# Verificar annotations da Application
kubectl get application <app-name> -n argocd -o yaml | grep "argocd-image-updater"

# Verificar tags disponiveis no registry
argocd-image-updater test <image> --semver-constraint "~1.2"
\`\`\``,
      solution: `**Solucoes:**

1. **Adicionar filtro de tags:**
\`\`\`yaml
# Apenas tags semver (v1.2.3)
argocd-image-updater.argoproj.io/myapp.allow-tags: regexp:^v[0-9]+\\.[0-9]+\\.[0-9]+$

# Ignorar tags especificas
argocd-image-updater.argoproj.io/myapp.ignore-tags: latest, dev, *-rc*
\`\`\`

2. **Usar constraint semver:**
\`\`\`yaml
# Apenas minor updates dentro de v1.x
argocd-image-updater.argoproj.io/myapp.update-strategy: semver
argocd-image-updater.argoproj.io/myapp.allow-tags: "~1"
\`\`\`

3. **Usar digest strategy para tag fixa:**
\`\`\`yaml
# Atualizar apenas quando o digest de "stable" mudar
argocd-image-updater.argoproj.io/myapp.update-strategy: digest
\`\`\`

4. **Reverter:** corrija o manifest no Git com a tag correta e o Image Updater respeitara o filtro no proximo ciclo.`
    }
  ]
};
