window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['argocd-fundamentals/argocd-architecture'] = {
  theory: `
# ArgoCD — Arquitetura & Componentes

## Relevancia
ArgoCD e a ferramenta GitOps mais adotada para Kubernetes, sendo um projeto **Graduated** da CNCF. Dominar sua arquitetura e essencial para qualquer profissional DevOps/SRE que trabalhe com continuous delivery em Kubernetes. ArgoCD e frequentemente cobrado em entrevistas e e parte fundamental do workflow GitOps moderno.

## Conceitos Fundamentais

### O que e GitOps?

GitOps e um paradigma operacional onde o Git e a **unica fonte de verdade** para a infraestrutura e aplicacoes. Os principios fundamentais sao:

1. **Declarativo**: todo o sistema e descrito declarativamente (YAML/JSON)
2. **Versionado**: o estado desejado e armazenado no Git
3. **Automatizado**: mudancas aprovadas sao aplicadas automaticamente
4. **Reconciliacao continua**: agentes garantem que o estado real = estado desejado

### Push vs Pull GitOps

| Aspecto | Push (CI-driven) | Pull (ArgoCD) |
|---------|-------------------|---------------|
| **Fluxo** | CI faz kubectl apply | ArgoCD observa Git e aplica |
| **Credenciais** | CI precisa de kubeconfig | Apenas ArgoCD tem acesso ao cluster |
| **Seguranca** | Credenciais no CI pipeline | Credenciais isoladas no cluster |
| **Drift detection** | Nenhuma | Automatica e continua |
| **Auditoria** | Logs do CI | Git history + ArgoCD UI |

### Arquitetura do ArgoCD

\`\`\`
+-------------------+     +--------------------+     +------------------+
|   Git Repository  |     |   ArgoCD Server    |     |  Kubernetes      |
|   (Source of      |<----|   (Control Plane)   |---->|  Cluster(s)      |
|    Truth)         |     |                    |     |  (Target)        |
+-------------------+     +--------------------+     +------------------+
                          |  API Server        |
                          |  Repo Server       |
                          |  Application Ctrl  |
                          |  Redis Cache       |
                          |  Dex (SSO)         |
                          |  Notifications Ctrl|
                          +--------------------+
\`\`\`

### Componentes Principais

| Componente | Funcao | Pod |
|-----------|--------|-----|
| **API Server** | Expoe a API REST e gRPC, serve a UI, gerencia autenticacao | argocd-server |
| **Repository Server** | Clona repos Git, gera manifests (Helm/Kustomize/plain YAML) | argocd-repo-server |
| **Application Controller** | Monitora apps, compara estado desejado vs real, reconcilia | argocd-application-controller |
| **Redis** | Cache para estado das apps e repos | argocd-redis |
| **Dex** | Autenticacao OIDC/SSO (opcional) | argocd-dex-server |
| **ApplicationSet Controller** | Gera Applications automaticamente a partir de templates | argocd-applicationset-controller |
| **Notifications Controller** | Envia notificacoes (Slack, Email, Webhook) | argocd-notifications-controller |

### Fluxo de Reconciliacao

\`\`\`
1. Application Controller detecta diff (a cada 3 min por padrao)
2. Repo Server clona o repo e gera manifests
3. Controller compara manifests com estado atual do cluster (kubectl diff)
4. Se OutOfSync:
   a. Auto-sync habilitado → aplica automaticamente
   b. Manual sync → marca como OutOfSync na UI
5. Apos sync → verifica health status dos recursos
6. Atualiza status na UI/API
\`\`\`

## Comandos Essenciais

### Instalacao

\`\`\`bash
# Instalacao padrao (namespace argocd)
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Instalacao HA (producao)
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/ha/install.yaml

# Verificar pods
kubectl get pods -n argocd
# NAME                                               READY   STATUS
# argocd-application-controller-0                    1/1     Running
# argocd-repo-server-xxx                             1/1     Running
# argocd-server-xxx                                  1/1     Running
# argocd-redis-xxx                                   1/1     Running
# argocd-dex-server-xxx                              1/1     Running
# argocd-applicationset-controller-xxx               1/1     Running
# argocd-notifications-controller-xxx                1/1     Running
\`\`\`

### CLI (argocd)

\`\`\`bash
# Instalar CLI
curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x argocd && sudo mv argocd /usr/local/bin/

# Obter senha inicial do admin
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d

# Login
argocd login localhost:8080 --username admin --password <senha>

# Alterar senha
argocd account update-password

# Listar apps
argocd app list

# Listar clusters registrados
argocd cluster list

# Adicionar cluster externo
argocd cluster add <context-name>
\`\`\`

### Acesso a UI

\`\`\`bash
# Port-forward (desenvolvimento)
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Ou expor via Ingress
# Requer --insecure flag no argocd-server para TLS termination no ingress
\`\`\`

## Exemplos YAML

### Instalacao via Helm (recomendado para producao)

\`\`\`yaml
# values.yaml para argo-cd Helm chart
global:
  image:
    tag: v2.10.0

server:
  replicas: 2
  ingress:
    enabled: true
    hostname: argocd.example.com
    tls: true
  extraArgs:
    - --insecure  # TLS terminado no ingress

controller:
  replicas: 1
  resources:
    requests:
      cpu: 250m
      memory: 512Mi
    limits:
      cpu: "1"
      memory: 1Gi

repoServer:
  replicas: 2
  resources:
    requests:
      cpu: 100m
      memory: 256Mi

redis:
  resources:
    requests:
      cpu: 100m
      memory: 128Mi

configs:
  params:
    server.insecure: true
    controller.repo.server.timeout.seconds: "120"
    controller.self.heal.timeout.seconds: "5"
  cm:
    timeout.reconciliation: 180s  # intervalo de reconciliacao (padrao 3m)
    resource.customizations.health.argoproj.io_Application: |
      hs = {}
      hs.status = "Healthy"
      return hs
\`\`\`

### ConfigMap principal (argocd-cm)

\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cm
  namespace: argocd
data:
  # Repositorios
  repositories: |
    - url: https://github.com/org/repo.git
      type: git
    - url: https://charts.example.com
      type: helm
      name: example-charts

  # Timeout de reconciliacao
  timeout.reconciliation: 180s

  # Resource tracking method
  application.resourceTrackingMethod: annotation

  # Customizacoes de health check
  resource.customizations.health.apps_Deployment: |
    hs = {}
    if obj.status ~= nil then
      if obj.status.readyReplicas == obj.status.replicas then
        hs.status = "Healthy"
      else
        hs.status = "Progressing"
      end
    end
    return hs
\`\`\`

## Erros Comuns

1. **Nao alterar a senha padrao do admin**: A senha inicial e gerada em um Secret. Se nao for alterada, qualquer pessoa com acesso ao namespace pode obte-la.
2. **Usar a instalacao non-HA em producao**: A instalacao padrao usa replicas=1. Em producao, sempre usar o manifest HA ou configurar replicas via Helm.
3. **Nao configurar resource limits**: Sem limits, o repo-server pode consumir recursos excessivos ao gerar manifests de repos grandes.
4. **Expor a UI sem TLS**: Nunca expor o ArgoCD server sem HTTPS. Use Ingress com TLS ou port-forward.
5. **Intervalo de reconciliacao muito curto**: O padrao (3 min) e adequado para a maioria dos casos. Reduzir demais sobrecarrega a API do cluster.
6. **Nao configurar RBAC do ArgoCD**: O admin padrao tem acesso total. Configure projects e RBAC para restringir acesso por equipe.

## Killer.sh Style Challenge

**Cenario:** Instale ArgoCD em um cluster Kubernetes e configure o acesso inicial.

**Tarefas:**
1. Instale o ArgoCD no namespace \`argocd\`
2. Obtenha a senha inicial do admin
3. Faca login via CLI
4. Altere a senha do admin
5. Configure o ArgoCD server para ser acessivel via Ingress com TLS

**Dicas:**
- A senha inicial fica no Secret \`argocd-initial-admin-secret\`
- Use \`argocd login\` com \`--insecure\` se estiver usando port-forward com HTTPS
- Para Ingress, adicione \`--insecure\` nos args do argocd-server para TLS termination no ingress
`,
  quiz: [
    {
      question: 'Qual componente do ArgoCD e responsavel por clonar repositorios Git e gerar manifests Kubernetes?',
      options: [
        'Application Controller',
        'API Server',
        'Repository Server',
        'Redis'
      ],
      correct: 2,
      explanation: 'O Repository Server (argocd-repo-server) e responsavel por clonar repositorios Git e gerar os manifests Kubernetes finais. Ele suporta Helm templates, Kustomize overlays e plain YAML, gerando os manifests que o Application Controller usa para comparar com o estado atual do cluster.',
      reference: 'Conceito relacionado: argocd-applications — o Repo Server gera manifests para cada Application baseado na source configurada.'
    },
    {
      question: 'Qual a principal diferenca entre o modelo Push (CI-driven) e Pull (ArgoCD) no GitOps?',
      options: [
        'Push e mais seguro porque usa pipelines',
        'No modelo Pull, o agente (ArgoCD) roda dentro do cluster e puxa mudancas do Git, eliminando credenciais de cluster no CI',
        'No modelo Push, nao e necessario Git',
        'Nao ha diferenca significativa'
      ],
      correct: 1,
      explanation: 'No modelo Pull, o ArgoCD roda dentro do cluster Kubernetes e continuamente compara o estado do Git com o cluster. Isso elimina a necessidade de distribuir kubeconfig/credenciais para pipelines de CI, aumentando a seguranca. Alem disso, o modelo Pull detecta drift automaticamente.',
      reference: 'Conceito relacionado: argocd-sync-strategies — o modelo Pull permite auto-sync e self-heal para correcao automatica de drift.'
    },
    {
      question: 'Qual componente do ArgoCD monitora o estado das aplicacoes e executa a reconciliacao?',
      options: [
        'API Server',
        'Repository Server',
        'Application Controller',
        'Dex Server'
      ],
      correct: 2,
      explanation: 'O Application Controller e o coracao do ArgoCD. Ele monitora continuamente o estado das Applications, compara o estado desejado (Git) com o estado real (cluster), e executa a reconciliacao (sync) quando necessario. Ele roda como StatefulSet para garantir consistencia.',
      reference: 'Conceito relacionado: argocd-sync-strategies — o Controller gerencia sync policies, auto-sync e self-heal.'
    },
    {
      question: 'Qual o intervalo padrao de reconciliacao do ArgoCD?',
      options: [
        '30 segundos',
        '1 minuto',
        '3 minutos',
        '10 minutos'
      ],
      correct: 2,
      explanation: 'O intervalo padrao de reconciliacao e 3 minutos (180 segundos). Isso significa que o ArgoCD verifica o estado do Git e do cluster a cada 3 minutos. Pode ser configurado via timeout.reconciliation no argocd-cm ConfigMap. Webhooks do Git podem disparar reconciliacao imediata.',
      reference: 'Conceito relacionado: argocd-sync-strategies — webhooks do Git podem complementar o polling para sync mais rapido.'
    },
    {
      question: 'Como obter a senha inicial do admin do ArgoCD?',
      options: [
        'Ela e "admin" por padrao',
        'Extrair do Secret argocd-initial-admin-secret no namespace argocd',
        'E definida durante a instalacao via Helm',
        'Nao ha senha padrao, e necessario configurar SSO'
      ],
      correct: 1,
      explanation: 'A senha inicial do admin e gerada automaticamente e armazenada no Secret argocd-initial-admin-secret no namespace argocd. Para obte-la: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath=\'{.data.password}\' | base64 -d. Deve ser alterada apos o primeiro login.',
      reference: 'Conceito relacionado: argocd-projects — configure RBAC e SSO para acesso seguro em producao.'
    },
    {
      question: 'Qual componente do ArgoCD e responsavel pela autenticacao SSO/OIDC?',
      options: [
        'API Server',
        'Application Controller',
        'Dex Server',
        'Redis'
      ],
      correct: 2,
      explanation: 'O Dex Server (argocd-dex-server) e um identity service que fornece autenticacao OIDC/SSO. Ele suporta integracao com GitHub, GitLab, LDAP, SAML e outros provedores de identidade. E um componente opcional — o ArgoCD tambem suporta autenticacao local e OIDC direto.',
      reference: 'Conceito relacionado: argocd-projects — RBAC do ArgoCD integra com usuarios/grupos do SSO.'
    },
    {
      question: 'Por que a instalacao HA do ArgoCD e recomendada para producao?',
      options: [
        'Porque e mais rapida de instalar',
        'Porque usa menos recursos',
        'Porque roda componentes com multiplas replicas, evitando single point of failure',
        'Porque suporta mais repositorios Git'
      ],
      correct: 2,
      explanation: 'A instalacao HA roda multiplas replicas do API Server, Repo Server e usa Redis HA com Sentinel. Isso evita single point of failure — se um pod falhar, os outros continuam servindo. O Application Controller usa leader election para garantir apenas uma instancia ativa reconciliando.',
      reference: 'Conceito relacionado: argocd-advanced — multi-cluster e HA sao essenciais para ambientes de producao.'
    },
    {
      question: 'Qual o papel do Redis no ArgoCD?',
      options: [
        'Armazenar os manifests do Git',
        'Cache de estado das aplicacoes e dados dos repositorios para performance',
        'Executar a reconciliacao das aplicacoes',
        'Gerenciar a autenticacao dos usuarios'
      ],
      correct: 1,
      explanation: 'O Redis serve como cache para o ArgoCD, armazenando o estado das aplicacoes e dados dos repositorios. Isso reduz a carga no API server do Kubernetes e no Repo Server, melhorando significativamente a performance, especialmente em ambientes com muitas aplicacoes.',
      reference: 'Conceito relacionado: argocd-architecture — em HA, Redis usa Sentinel para alta disponibilidade do cache.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os componentes principais do ArgoCD e suas funcoes?',
      back: '1. **API Server** — expoe REST/gRPC API, serve UI, autenticacao\n2. **Repo Server** — clona repos Git, gera manifests (Helm/Kustomize/YAML)\n3. **Application Controller** — monitora apps, compara desejado vs real, reconcilia\n4. **Redis** — cache de estado e dados de repos\n5. **Dex** — autenticacao SSO/OIDC (opcional)\n6. **ApplicationSet Controller** — gera Applications a partir de templates\n7. **Notifications Controller** — envia notificacoes (Slack, Email, Webhook)'
    },
    {
      front: 'O que e GitOps e quais sao seus 4 principios?',
      back: '**GitOps** = paradigma operacional onde Git e a unica fonte de verdade.\n\n**4 Principios:**\n1. **Declarativo** — todo o sistema descrito em YAML/JSON\n2. **Versionado** — estado desejado armazenado no Git\n3. **Automatizado** — mudancas aprovadas sao aplicadas automaticamente\n4. **Reconciliacao continua** — agentes garantem estado real = desejado\n\n**Beneficios:** auditoria via git log, rollback via git revert, review via PR.'
    },
    {
      front: 'Push vs Pull GitOps — qual e mais seguro e por que?',
      back: '**Pull (ArgoCD)** e mais seguro:\n- Credenciais do cluster ficam APENAS no ArgoCD (dentro do cluster)\n- CI/CD NAO precisa de kubeconfig\n- Drift detection automatica e continua\n- Auditoria completa via Git history\n\n**Push (CI-driven):**\n- CI precisa de kubeconfig (credenciais expostas)\n- Sem drift detection automatica\n- Se o CI falhar, o estado fica inconsistente\n\nEm ambientes seguros, sempre prefira Pull-based GitOps.'
    },
    {
      front: 'Como o ArgoCD detecta e corrige drift?',
      back: '**Deteccao (a cada 3 min por padrao):**\n1. Application Controller solicita manifests ao Repo Server\n2. Repo Server clona repo e gera manifests\n3. Controller faz diff com estado atual do cluster\n4. Se diferente → marca como **OutOfSync**\n\n**Correcao:**\n- **Manual:** usuario clica Sync na UI ou usa CLI\n- **Auto-sync:** ArgoCD aplica automaticamente\n- **Self-heal:** reverte mudancas manuais no cluster\n\nConfig: \`timeout.reconciliation: 180s\` no argocd-cm'
    },
    {
      front: 'Como instalar ArgoCD em um cluster Kubernetes?',
      back: '**Instalacao basica:**\n```bash\nkubectl create namespace argocd\nkubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml\n```\n\n**Senha inicial:**\n```bash\nkubectl -n argocd get secret argocd-initial-admin-secret \\\n  -o jsonpath=\'{.data.password}\' | base64 -d\n```\n\n**Acesso:**\n```bash\nkubectl port-forward svc/argocd-server -n argocd 8080:443\nargocd login localhost:8080\n```\n\n**Producao:** use instalacao HA ou Helm chart.'
    },
    {
      front: 'Qual a diferenca entre ArgoCD e FluxCD?',
      back: '| Aspecto | ArgoCD | FluxCD |\n|---------|--------|--------|\n| **UI** | UI rica nativa | Sem UI (precisa Weave GitOps) |\n| **Arquitetura** | Centralizada (server) | Distribuida (controllers) |\n| **CRDs** | Application | Kustomization, HelmRelease |\n| **Multi-cluster** | Nativo | Via Kustomization remoto |\n| **CNCF** | Graduated | Graduated |\n| **Melhor para** | Times que querem UI | Times que preferem YAML puro |\n\nAmbos sao validos. ArgoCD e mais popular em empresas por causa da UI.'
    },
    {
      front: 'Quais sao os requisitos de producao para ArgoCD?',
      back: '1. **HA:** usar manifest HA ou Helm com replicas > 1\n2. **TLS:** nunca expor sem HTTPS (Ingress + cert-manager)\n3. **SSO:** configurar Dex com OIDC (GitHub, Google, LDAP)\n4. **RBAC:** Projects para isolar equipes\n5. **Resource limits:** definir CPU/memory para todos os pods\n6. **Backup:** argocd-cm e argocd-rbac-cm sao criticos\n7. **Monitoring:** metricas Prometheus em /metrics\n8. **Senha:** alterar senha admin e deletar Secret inicial'
    }
  ],
  lab: {
    scenario: 'Voce precisa instalar e configurar o ArgoCD em um cluster Kubernetes, acessar a UI, fazer login via CLI e explorar os componentes.',
    objective: 'Instalar ArgoCD, obter credenciais, acessar a UI via port-forward, e explorar a arquitetura dos componentes.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Instalar ArgoCD',
        instruction: `Instale o ArgoCD no namespace dedicado.

\`\`\`bash
# Criar namespace
kubectl create namespace argocd

# Instalar ArgoCD (versao estavel)
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Aguardar todos os pods ficarem Running
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=120s
\`\`\``,
        hints: [
          'O namespace deve ser "argocd" para a instalacao padrao',
          'Use kubectl wait para aguardar os pods ficarem prontos',
          'A instalacao cria 7 pods principais'
        ],
        solution: `\`\`\`bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=120s
\`\`\``,
        verify: `\`\`\`bash
# Verificar pods do ArgoCD
kubectl get pods -n argocd
# Saida esperada: todos os pods em Running (argocd-server, argocd-repo-server, argocd-application-controller, argocd-redis, argocd-dex-server, argocd-applicationset-controller, argocd-notifications-controller)

# Verificar servicos
kubectl get svc -n argocd
# Saida esperada: argocd-server com porta 443
\`\`\``
      },
      {
        title: 'Acessar ArgoCD e Fazer Login',
        instruction: `Obtenha a senha inicial do admin, configure port-forward e faca login via CLI.

\`\`\`bash
# 1. Obter senha inicial
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d && echo

# 2. Port-forward (em outro terminal ou background)
kubectl port-forward svc/argocd-server -n argocd 8080:443 &

# 3. Instalar CLI (se nao tiver)
curl -sSL -o /usr/local/bin/argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x /usr/local/bin/argocd

# 4. Login
argocd login localhost:8080 --username admin --password <senha> --insecure
\`\`\``,
        hints: [
          'A flag --insecure e necessaria quando o certificado e auto-assinado (port-forward)',
          'A senha inicial esta codificada em base64 no Secret',
          'A UI fica acessivel em https://localhost:8080'
        ],
        solution: `\`\`\`bash
# Obter senha
ARGOCD_PWD=\$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d)

# Port-forward
kubectl port-forward svc/argocd-server -n argocd 8080:443 &

# Login
argocd login localhost:8080 --username admin --password \$ARGOCD_PWD --insecure
\`\`\``,
        verify: `\`\`\`bash
# Verificar login bem-sucedido
argocd account get-user-info
# Saida esperada: loggedIn: true, username: admin

# Listar clusters
argocd cluster list
# Saida esperada: pelo menos o cluster in-cluster (https://kubernetes.default.svc)
\`\`\``
      },
      {
        title: 'Explorar Componentes e CRDs',
        instruction: `Examine os componentes instalados e os Custom Resource Definitions do ArgoCD.

\`\`\`bash
# Listar CRDs do ArgoCD
kubectl get crd | grep argo

# Descrever o CRD Application
kubectl explain application.spec --api-version=argoproj.io/v1alpha1

# Ver resources do ArgoCD
kubectl api-resources | grep argo

# Examinar o ConfigMap principal
kubectl get cm argocd-cm -n argocd -o yaml

# Examinar a configuracao RBAC
kubectl get cm argocd-rbac-cm -n argocd -o yaml

# Ver os ServiceAccounts
kubectl get sa -n argocd
\`\`\``,
        hints: [
          'O ArgoCD instala 5 CRDs principais: Application, AppProject, ApplicationSet, etc.',
          'O argocd-cm ConfigMap contem a configuracao principal',
          'O argocd-rbac-cm define as politicas de acesso'
        ],
        solution: `\`\`\`bash
# CRDs
kubectl get crd | grep argo

# API resources
kubectl api-resources | grep argo

# ConfigMaps
kubectl get cm argocd-cm -n argocd -o yaml
kubectl get cm argocd-rbac-cm -n argocd -o yaml

# ServiceAccounts
kubectl get sa -n argocd
\`\`\``,
        verify: `\`\`\`bash
# Verificar CRDs instalados
kubectl get crd | grep argoproj | wc -l
# Saida esperada: 3 ou mais (applications, appprojects, applicationsets)

# Verificar que o projeto default existe
argocd proj list
# Saida esperada: lista contendo "default"
\`\`\``
      },
      {
        title: 'Verificar Metricas e Health',
        instruction: `Verifique o health dos componentes e explore as metricas Prometheus expostas pelo ArgoCD.

\`\`\`bash
# Health check do ArgoCD server
kubectl exec -n argocd deploy/argocd-server -- curl -s http://localhost:8082/healthz

# Metricas do Application Controller
kubectl exec -n argocd sts/argocd-application-controller -- curl -s http://localhost:8082/metrics | head -20

# Metricas do ArgoCD Server
kubectl exec -n argocd deploy/argocd-server -- curl -s http://localhost:8083/metrics | head -20

# Verificar versao
argocd version
\`\`\``,
        hints: [
          'O ArgoCD expoe metricas Prometheus nos endpoints /metrics',
          'As metricas incluem informacoes sobre sync status, health e latencia',
          'Use essas metricas para monitorar o ArgoCD com Prometheus/Grafana'
        ],
        solution: `\`\`\`bash
# Health
kubectl exec -n argocd deploy/argocd-server -- curl -s http://localhost:8082/healthz

# Versao
argocd version --client

# Status geral
argocd app list
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o ArgoCD esta saudavel
argocd version --client
# Saida esperada: versao do ArgoCD CLI

# Verificar conectividade
argocd cluster list
# Saida esperada: cluster com STATUS "Successful"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ArgoCD server nao inicia — CrashLoopBackOff',
      difficulty: 'easy',
      symptom: 'O pod argocd-server fica em CrashLoopBackOff apos a instalacao.',
      diagnosis: `\`\`\`bash
# Ver logs do pod
kubectl logs -n argocd deploy/argocd-server --previous

# Verificar eventos
kubectl describe pod -n argocd -l app.kubernetes.io/name=argocd-server

# Verificar se o Redis esta rodando
kubectl get pod -n argocd -l app.kubernetes.io/name=argocd-redis

# Verificar resources
kubectl top pod -n argocd
\`\`\``,
      solution: `**Causas comuns:**

1. **Redis nao disponivel:** O argocd-server depende do Redis. Se o Redis nao esta rodando, o server nao inicia.
\`\`\`bash
kubectl get pod -n argocd -l app.kubernetes.io/name=argocd-redis
# Se nao estiver Running, verificar logs do Redis
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-redis
\`\`\`

2. **Porta ja em uso:** Se outro servico usa a porta 8080/8083, o server falha.

3. **TLS misconfiguration:** Se o argocd-server esta configurado com --insecure mas o cert nao existe, pode falhar. Verifique os args:
\`\`\`bash
kubectl get deploy argocd-server -n argocd -o jsonpath='{.spec.template.spec.containers[0].args}'
\`\`\`

4. **Recursos insuficientes:** O server precisa de pelo menos 256Mi de memoria. Verifique com kubectl top pod.`
    },
    {
      title: 'Repo Server nao consegue clonar repositorio privado',
      difficulty: 'medium',
      symptom: 'Applications ficam com erro "rpc error: code = Unknown desc = authentication required" ao tentar sincronizar.',
      diagnosis: `\`\`\`bash
# Verificar logs do repo-server
kubectl logs -n argocd deploy/argocd-repo-server | grep -i "error\\|auth\\|clone"

# Listar repositorios configurados
argocd repo list

# Testar conexao com repositorio
argocd repo get https://github.com/org/private-repo.git
\`\`\``,
      solution: `**Solucao:**

1. **Adicionar credenciais do repositorio:**
\`\`\`bash
# Via CLI — HTTPS com token
argocd repo add https://github.com/org/repo.git --username oauth2 --password <token>

# Via CLI — SSH key
argocd repo add git@github.com:org/repo.git --ssh-private-key-path ~/.ssh/id_rsa
\`\`\`

2. **Via Secret (GitOps-friendly):**
\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: repo-private
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repository
type: Opaque
stringData:
  url: https://github.com/org/repo.git
  username: oauth2
  password: ghp_xxxxxxxxxxxx
  type: git
\`\`\`

3. **Credential templates (para org inteira):**
\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: github-creds
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repo-creds
type: Opaque
stringData:
  url: https://github.com/org
  username: oauth2
  password: ghp_xxxxxxxxxxxx
  type: git
\`\`\``
    },
    {
      title: 'Application Controller com alta latencia de reconciliacao',
      difficulty: 'hard',
      symptom: 'O ArgoCD demora mais de 10 minutos para detectar mudancas no Git. Sync manual funciona rapidamente, mas a deteccao automatica esta lenta.',
      diagnosis: `\`\`\`bash
# Verificar metricas do controller
kubectl exec -n argocd sts/argocd-application-controller -- curl -s http://localhost:8082/metrics | grep argocd_app_reconcile

# Verificar quantidade de apps
argocd app list | wc -l

# Verificar uso de recursos
kubectl top pod -n argocd -l app.kubernetes.io/name=argocd-application-controller

# Verificar configuracao de reconciliacao
kubectl get cm argocd-cm -n argocd -o jsonpath='{.data.timeout\\.reconciliation}'
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Muitas aplicacoes:** Cada app e reconciliada sequencialmente pelo controller. Com 100+ apps, o ciclo completo pode levar muito tempo.
\`\`\`yaml
# Aumentar workers do controller
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cmd-params-cm
  namespace: argocd
data:
  controller.status.processors: "50"
  controller.operation.processors: "25"
\`\`\`

2. **Webhooks nao configurados:** Sem webhooks, o ArgoCD depende do polling (3 min). Configure webhooks no Git:
\`\`\`bash
# O ArgoCD escuta webhooks em /api/webhook
# Configure no GitHub: Settings > Webhooks > https://argocd.example.com/api/webhook
\`\`\`

3. **Repo Server lento:** Repos grandes demoram para clonar. Configure shallow clones:
\`\`\`yaml
# No argocd-cmd-params-cm
data:
  reposerver.git.request.timeout: "120"
\`\`\`

4. **Cache do Redis cheio:** Redis sem memoria suficiente descarta cache, forcando re-clone.
\`\`\`bash
kubectl exec -n argocd deploy/argocd-redis -- redis-cli info memory
\`\`\``
    }
  ]
};
