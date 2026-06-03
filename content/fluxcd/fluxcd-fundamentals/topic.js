window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['fluxcd/fluxcd-fundamentals'] = {
  theory: `
# FluxCD & GitOps Fundamentals

## Relevancia
FluxCD e a implementacao de referencia de GitOps para Kubernetes — projeto CNCF Graduated. GitOps usa Git como fonte unica de verdade para toda a infraestrutura e aplicacoes. O Flux monitora repositorios Git/Helm/OCI e reconcilia automaticamente o cluster para o estado desejado. E o fundamento de plataformas modernas de entrega continua.

## Conceitos Fundamentais

### O que e GitOps?

\`\`\`
Principios GitOps (OpenGitOps):

1. Declarative (Declarativo)
   Todo o estado desejado e descrito declarativamente
   (YAML manifests, Helm values, Kustomize overlays)

2. Versioned and Immutable (Versionado e Imutavel)
   Estado desejado armazenado de forma versionada (Git)
   Cada mudanca e um commit auditavel

3. Pulled Automatically (Puxado Automaticamente)
   Agentes SOFTWARE puxam o estado do Git
   NAO push — o cluster puxa, nao recebe push

4. Continuously Reconciled (Continuamente Reconciliado)
   Agentes garantem estado real = estado desejado
   Detectam e corrigem drift automaticamente
\`\`\`

### Arquitetura do FluxCD

\`\`\`
Git Repository (GitHub/GitLab/Gitea)
         │
         │ PULL (pooling)
         ▼
┌─────────────────────────────────────────┐
│              Flux Controllers            │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ source-controller                │   │
│  │ Monitora: Git, Helm, OCI, Bucket │   │
│  └──────────────────┬───────────────┘   │
│                     │ Artefato          │
│  ┌──────────────────▼───────────────┐   │
│  │ kustomize-controller             │   │
│  │ Aplica: Kustomizations           │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │ helm-controller                  │   │
│  │ Aplica: HelmReleases             │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │ notification-controller          │   │
│  │ Alertas: Slack, PagerDuty, etc.  │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │ image-reflector-controller       │   │
│  │ Detecta: novas imagens registry  │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │ image-automation-controller      │   │
│  │ Atualiza: manifests com nova img │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
         │
         │ kubectl apply
         ▼
    Kubernetes Cluster
\`\`\`

### CRDs Principais do Flux

\`\`\`
Source Controller:
├── GitRepository      — monitora repositorio Git
├── HelmRepository     — monitora repositorio Helm (index.yaml)
├── HelmChart          — chart especifico de um HelmRepository
├── OCIRepository      — monitora OCI registry (imagens/artefatos)
└── Bucket             — monitora S3/GCS/Azure Blob

Kustomize Controller:
└── Kustomization      — aplica manifests/kustomize ao cluster

Helm Controller:
└── HelmRelease        — deploy de Helm chart

Notification Controller:
├── Provider           — destino de notificacao (Slack, Teams, etc.)
├── Alert              — regra de quando e o que notificar
└── Receiver           — webhook para receber eventos externos

Image Automation:
├── ImageRepository    — monitora registry por novas tags
├── ImagePolicy        — seleciona qual tag usar (semver, regex)
└── ImageUpdateAutomation — commita atualizacoes de imagem no Git
\`\`\`

### Instalacao do Flux CLI e Bootstrap

\`\`\`bash
# Instalar Flux CLI
curl -s https://fluxcd.io/install.sh | sudo bash

# Verificar prerequisitos do cluster
flux check --pre

# Bootstrap com GitHub (instala Flux no cluster E configura repositorio)
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
export GITHUB_USER=meu-usuario

flux bootstrap github \\
  --owner=\${GITHUB_USER} \\
  --repository=fleet-infra \\
  --branch=main \\
  --path=clusters/my-cluster \\
  --personal

# Para repositorio existente:
flux bootstrap github \\
  --owner=myorg \\
  --repository=gitops-repo \\
  --branch=main \\
  --path=clusters/production
\`\`\`

\`\`\`bash
# Bootstrap com GitLab
flux bootstrap gitlab \\
  --owner=mygroup \\
  --repository=fleet-infra \\
  --branch=main \\
  --path=clusters/production \\
  --token-auth

# Bootstrap com SSH key (para qualquer git provider)
flux bootstrap git \\
  --url=ssh://git@github.com/myorg/fleet-infra \\
  --branch=main \\
  --path=clusters/production \\
  --ssh-key-algorithm=ecdsa
\`\`\`

### Estrutura Tipica de Repositorio

\`\`\`
fleet-infra/
├── clusters/
│   ├── production/
│   │   ├── flux-system/           ← Gerado pelo bootstrap
│   │   │   ├── gotk-components.yaml
│   │   │   ├── gotk-sync.yaml
│   │   │   └── kustomization.yaml
│   │   ├── apps/
│   │   │   ├── kustomization.yaml ← Aponta para apps/
│   │   │   └── podinfo.yaml       ← HelmRelease ou Kustomization
│   │   └── infrastructure/
│   │       ├── kustomization.yaml
│   │       └── cert-manager.yaml
│   └── staging/
│       └── flux-system/
├── apps/
│   ├── base/
│   │   └── podinfo/
│   │       ├── kustomization.yaml
│   │       ├── deployment.yaml
│   │       └── service.yaml
│   ├── production/
│   │   └── podinfo/
│   │       └── kustomization.yaml  ← Overlay de producao
│   └── staging/
│       └── podinfo/
│           └── kustomization.yaml  ← Overlay de staging
└── infrastructure/
    ├── base/
    │   └── cert-manager/
    └── production/
\`\`\`

### GitRepository — Monitorar Git

\`\`\`yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: fleet-infra
  namespace: flux-system
spec:
  interval: 1m                   # Verificar mudancas a cada 1 minuto
  url: https://github.com/myorg/fleet-infra
  ref:
    branch: main                 # ou tag: v1.0.0 ou commit: abc123
  secretRef:
    name: flux-system            # Secret com SSH key ou token
\`\`\`

### Kustomization — Aplicar Manifests

\`\`\`yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps
  namespace: flux-system
spec:
  interval: 5m                   # Reconciliar a cada 5 minutos
  path: ./apps/production        # Path no repositorio Git
  prune: true                    # Deletar recursos que foram removidos do Git
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  healthChecks:                  # Aguardar recursos ficarem saudaveis
    - apiVersion: apps/v1
      kind: Deployment
      name: podinfo
      namespace: podinfo
  postBuild:
    substitute:
      ENVIRONMENT: "production"
      DOMAIN: "acme.io"
\`\`\`

### HelmRepository e HelmRelease

\`\`\`yaml
# Repositorio Helm
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: podinfo
  namespace: flux-system
spec:
  interval: 1h
  url: https://stefanprodan.github.io/podinfo
---
# Deploy via HelmRelease
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: podinfo
  namespace: default
spec:
  interval: 5m
  chart:
    spec:
      chart: podinfo
      version: ">=6.0.0 <7.0.0"  # Semver range
      sourceRef:
        kind: HelmRepository
        name: podinfo
        namespace: flux-system
  values:
    replicaCount: 2
    ingress:
      enabled: true
      hosts:
        - host: podinfo.acme.io
  valuesFrom:                    # Valores de ConfigMap/Secret
    - kind: ConfigMap
      name: podinfo-values
      valuesKey: values.yaml
\`\`\`

### Drift Detection e Reconciliacao

\`\`\`bash
# Ver status de todos os recursos Flux
flux get all

# Ver Kustomizations
flux get kustomizations

# Ver HelmReleases
flux get helmreleases

# Forcear reconciliacao imediata
flux reconcile kustomization apps --with-source
flux reconcile helmrelease podinfo --with-source

# Ver logs do controller
flux logs --kind=Kustomization --name=apps

# Suspender reconciliacao (para manutencao)
flux suspend kustomization apps
flux resume kustomization apps
\`\`\`

### Erros Comuns

1. **interval muito curto** — interval: 30s aumenta carga no Git server e no cluster. Para producao, usar 1m-5m.
2. **prune: false em producao** — Sem prune, recursos deletados do Git continuam no cluster (drift). Usar prune: true com cuidado.
3. **path errado no Kustomization** — O path e relativo a raiz do repositorio, nao ao checkout local.
4. **Sem Secret de auth** — GitRepository privado sem secretRef vai falhar com erro 401.
5. **healthChecks mal configurados** — Kustomization espera por recurso que nao existe no path; a reconciliacao fica travada.

## Killer.sh Style Challenge

> **Cenario:** Configure GitOps para uma aplicacao: (1) Criar GitRepository apontando para https://github.com/stefanprodan/podinfo, branch main, intervalo 1m; (2) Criar Kustomization que aplica o diretorio ./kustomize do repositorio ao namespace podinfo com prune: true; (3) Verificar que a aplicacao foi deployada automaticamente.
`,
  quiz: [
    {
      question: 'Quais sao os 4 principios do GitOps (OpenGitOps)?',
      options: [
        'Git, CI/CD, Containers, Automation',
        'Declarativo, Versionado/Imutavel, Puxado automaticamente, Continuamente reconciliado',
        'Push, Pull, Deploy, Monitor',
        'Source, Build, Test, Deploy'
      ],
      correct: 1,
      explanation: 'Os 4 principios OpenGitOps: (1) Declarativo — estado descrito em arquivos; (2) Versionado/Imutavel — Git como fonte; (3) Puxado automaticamente — agentes puxam, nao recebem push; (4) Continuamente reconciliado — estado real = estado desejado.',
      reference: 'Conceito relacionado: O modelo "pull" e fundamental — o agente no cluster puxa do Git, nao o CI/CD que faz push para o cluster.'
    },
    {
      question: 'Qual controller do Flux e responsavel por monitorar repositorios Git, Helm e OCI?',
      options: [
        'kustomize-controller',
        'source-controller',
        'helm-controller',
        'notification-controller'
      ],
      correct: 1,
      explanation: 'O source-controller monitora fontes externas: GitRepository (Git), HelmRepository (index Helm), OCIRepository (registries OCI), e Bucket (S3/GCS). Ele baixa artefatos e os disponibiliza para outros controllers. kustomize-controller e helm-controller CONSOMEM esses artefatos.',
      reference: 'Conceito relacionado: source-controller cria um artefato (tarball) que outros controllers referenciam — isso desacopla o download do apply.'
    },
    {
      question: 'O que acontece quando prune: true esta configurado em uma Kustomization?',
      options: [
        'O namespace e deletado junto com os recursos',
        'Recursos que existem no cluster mas foram removidos do repositorio Git sao automaticamente deletados do cluster',
        'Todos os recursos sao re-criados a cada reconciliacao',
        'Recursos com erros sao deletados e re-criados'
      ],
      correct: 1,
      explanation: 'Com prune: true, o Flux rastreia quais recursos foram criados por aquela Kustomization. Se um recurso e removido do Git (commit que deleta um arquivo), o Flux automaticamente deleta o recurso correspondente do cluster. Sem prune: false, esses recursos ficam como orfaos.',
      reference: 'Conceito relacionado: Usar prune: true em conjunto com um Git workflow cuidadoso — um delete acidental no repositorio pode deletar producao.'
    },
    {
      question: 'Como o Flux se autentica com repositorios Git privados?',
      options: [
        'Usando as credenciais do kubectl',
        'Usando um Secret referenciado em secretRef no GitRepository — com SSH key, token, ou usuario/senha',
        'Automaticamente com as credenciais do cluster',
        'Usando o ServiceAccount do flux-system'
      ],
      correct: 1,
      explanation: 'GitRepository privados precisam de secretRef apontando para um Secret no namespace flux-system. O Secret pode ter: chave SSH (identity, identity.pub, known_hosts), token (username + password ou bearerToken), ou HTTPS com usuario/senha. O flux bootstrap automaticamente cria esse Secret.',
      reference: 'Conceito relacionado: Para GitHub Actions, usar Deploy Keys (read-only) no repositorio em vez de tokens pessoais.'
    },
    {
      question: 'O que faz o comando flux reconcile kustomization apps --with-source?',
      options: [
        'Recria toda a Kustomization do zero',
        'Forca uma reconciliacao imediata: primeiro re-baixa o source (GitRepository) e depois re-aplica a Kustomization ao cluster',
        'Verifica se a Kustomization esta sincronizada',
        'Suspende e resume a Kustomization'
      ],
      correct: 1,
      explanation: '--with-source forca primeiro a reconciliacao do Source (GitRepository) para buscar o ultimo commit, e depois reconcilia a Kustomization com esse novo artefato. Sem --with-source, reconcilia apenas com o artefato atual (sem buscar novas versoes).',
      reference: 'Conceito relacionado: flux suspend e flux resume controlam temporariamente a reconciliacao automatica — util para manutencao.'
    },
    {
      question: 'Qual a diferenca entre o interval da GitRepository e da Kustomization?',
      options: [
        'Sao o mesmo interval',
        'GitRepository.interval define com que frequencia o source e verificado (novo commit?); Kustomization.interval define com que frequencia os manifests sao re-aplicados ao cluster (mesmo sem mudancas no Git)',
        'Kustomization.interval e sempre maior que GitRepository.interval',
        'Apenas Kustomization tem interval; GitRepository usa webhooks'
      ],
      correct: 1,
      explanation: 'GitRepository.interval: frequencia de polling do Git para detectar novos commits. Kustomization.interval: frequencia de reconciliacao no cluster — re-aplica os manifests mesmo sem mudancas no Git (detecta drift). Valores tipicos: GitRepository=1m, Kustomization=5m-10m.',
      reference: 'Conceito relacionado: Para reconciliacao mais rapida sem aumentar polling, configurar webhooks no Git para notificar o Flux.'
    },
    {
      question: 'Para que serve o campo healthChecks em uma Kustomization?',
      options: [
        'Para verificar a saude dos pods do Flux',
        'Para aguardar que os recursos deployados estejam saudaveis antes de marcar a Kustomization como Ready — permite dependencias entre Kustomizations',
        'Para configurar liveness probes nos pods deployados',
        'Para validar os YAML antes de aplicar'
      ],
      correct: 1,
      explanation: 'healthChecks faz a Kustomization aguardar recursos ficarem Ready antes de se marcar como bem-sucedida. Critico para dependencias: se Kustomization B depende de A (via dependsOn), B so roda apos A estar saudavel. Sem healthChecks, A pode ser marcada Ready antes dos recursos estarem prontos.',
      reference: 'Conceito relacionado: dependsOn no Kustomization cria ordem de deploy — ex: instalar cert-manager antes de qualquer app que usa certificates.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os 5 controllers principais do Flux v2?',
      back: '**source-controller**\nMonitora: GitRepository, HelmRepository,\nOCIRepository, HelmChart, Bucket\nCria artefatos para outros controllers\n\n**kustomize-controller**\nAplica Kustomizations ao cluster\nSuporta: Kustomize overlays, substituicoes\n\n**helm-controller**\nGerencia HelmReleases\nInstala/Upgrade/Rollback de charts\n\n**notification-controller**\nEnvia alertas (Slack, Teams, PagerDuty)\nRecebe webhooks externos\n\n**image-reflector-controller**\nMonitora registries por novas tags\n\n**image-automation-controller**\nCommita atualizacoes de imagem no Git\n\n**Namespace:** flux-system\n**Instalacao:** flux bootstrap'
    },
    {
      front: 'Estrutura de arquivos de um repositorio Flux',
      back: '```\nfleet-infra/\n├── clusters/\n│   ├── production/\n│   │   ├── flux-system/    ← bootstrap\n│   │   │   ├── gotk-components.yaml\n│   │   │   ├── gotk-sync.yaml\n│   │   │   └── kustomization.yaml\n│   │   ├── apps/\n│   │   │   └── kustomization.yaml\n│   │   └── infrastructure/\n│   │       └── kustomization.yaml\n│   └── staging/\n├── apps/\n│   ├── base/       ← manifests base\n│   ├── production/ ← overlays producao\n│   └── staging/    ← overlays staging\n└── infrastructure/\n    ├── base/\n    └── production/\n```\nPadrao recomendado pela documentacao Flux.'
    },
    {
      front: 'GitRepository — campos importantes',
      back: '```yaml\napiVersion: source.toolkit.fluxcd.io/v1\nkind: GitRepository\nmetadata:\n  name: fleet-infra\n  namespace: flux-system\nspec:\n  interval: 1m       # Polling frequency\n  url: https://github.com/org/repo\n  ref:\n    branch: main     # OR\n    tag: v1.0.0      # OR\n    semver: ">=1.0.0"\n    commit: abc123   # Specific commit\n  secretRef:\n    name: github-token  # Auth secret\n  ignore: |           # Files to ignore\n    *.md\n    docs/\n```\nStatus: flux get gitrepositories\nArtefato disponivel em: .status.artifact'
    },
    {
      front: 'Kustomization Flux — campos importantes',
      back: '```yaml\napiVersion: kustomize.toolkit.fluxcd.io/v1\nkind: Kustomization\nmetadata:\n  name: apps\n  namespace: flux-system\nspec:\n  interval: 5m         # Reconcile frequency\n  path: ./apps/prod    # Path in repo\n  prune: true          # Delete removed resources\n  sourceRef:\n    kind: GitRepository\n    name: fleet-infra\n  targetNamespace: production  # Override namespace\n  dependsOn:           # Wait for these first\n    - name: infrastructure\n  healthChecks:        # Wait for Ready\n    - apiVersion: apps/v1\n      kind: Deployment\n      name: app\n      namespace: default\n  postBuild:\n    substitute:\n      KEY: value       # Variable substitution\n```'
    },
    {
      front: 'Comandos Flux CLI essenciais',
      back: '**Status geral:**\n`flux get all`\n`flux get sources git`\n`flux get kustomizations`\n`flux get helmreleases`\n\n**Reconciliar:**\n`flux reconcile source git fleet-infra`\n`flux reconcile kustomization apps --with-source`\n`flux reconcile helmrelease podinfo`\n\n**Suspender/Resumir:**\n`flux suspend kustomization apps`\n`flux resume kustomization apps`\n\n**Logs:**\n`flux logs --kind=Kustomization --name=apps`\n`flux logs --all-namespaces`\n\n**Exportar/Importar:**\n`flux export source git fleet-infra`\n`flux diff kustomization apps`\n\n**Bootstrap:**\n`flux bootstrap github ...`\n`flux check --pre`'
    },
    {
      front: 'Como o Flux detecta e corrige drift?',
      back: '**Drift Detection:**\nO kustomize-controller reconcilia a cada\n`interval`. Em cada ciclo:\n1. Baixa artefato do source-controller\n2. Gera manifests (kustomize build ou helm)\n3. Compara com estado atual do cluster\n4. Aplica diferenca (kubectl apply)\n\n**Cenarios de drift:**\n- Alguem faz kubectl edit em producao\n- Um operator modifica um recurso\n- Resource e deletado manualmente\n\n**O Flux reverte:**\nNa proxima reconciliacao, o estado\ndesejado (Git) e re-aplicado.\n\n**Como inspecionar:**\n```bash\nflux diff kustomization apps\n# Mostra o que seria aplicado\n# sem realmente aplicar\n```\n\n**Para mudancas manuais temporarias:**\n`flux suspend kustomization apps`\n(Pausar reconc. durante manutencao)'
    }
  ],
  lab: {
    scenario: 'Voce vai configurar um ambiente GitOps completo usando o FluxCD. O objetivo e usar Git como fonte de verdade para deploy automatico de uma aplicacao no cluster.',
    objective: 'Instalar FluxCD, configurar GitRepository e Kustomization, e verificar reconciliacao automatica.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Instalar Flux CLI e verificar pre-requisitos',
        instruction: `Configure o Flux no seu ambiente:
1. Instalar a Flux CLI
2. Verificar pre-requisitos do cluster com flux check
3. Instalar os controllers do Flux no cluster sem bootstrap (modo manual para lab)
4. Verificar que todos os pods estao Running`,
        hints: [
          'curl -s https://fluxcd.io/install.sh | sudo bash instala a CLI',
          'flux install instala os controllers sem precisar de repositorio Git',
          'flux check --pre verifica se o cluster suporta Flux antes de instalar'
        ],
        solution: `\`\`\`bash
# Instalar Flux CLI
curl -s https://fluxcd.io/install.sh | sudo bash

# Ou via brew no macOS
# brew install fluxcd/tap/flux

# Verificar versao
flux version

# Verificar pre-requisitos do cluster
flux check --pre
# Deve mostrar checkmarks verdes

# Instalar Flux no cluster (modo manual sem bootstrap)
flux install \\
  --namespace=flux-system \\
  --network-policy=false    # Para labs com networking restrito
\`\`\``,
        verify: `\`\`\`bash
# Verificar todos os pods do Flux rodando
kubectl get pods -n flux-system
# Saida esperada: todos os controllers em Running state
# helm-controller-xxx
# kustomize-controller-xxx
# notification-controller-xxx
# source-controller-xxx

# Verificar CRDs instalados
kubectl get crds | grep toolkit.fluxcd.io | head -10
# Saida esperada: gitrepositories, kustomizations, helmreleases, etc.

# Verificar status geral
flux check
# Saida esperada: todos os checks verdes

# Verificar que o namespace flux-system existe
kubectl get namespace flux-system
\`\`\``
      },
      {
        title: 'Criar GitRepository e Kustomization',
        instruction: `Configure o Flux para monitorar um repositorio Git publico:
1. Criar um GitRepository apontando para https://github.com/stefanprodan/podinfo (branch main)
2. Criar um namespace podinfo
3. Criar uma Kustomization que aplica o diretorio ./kustomize do repositorio
4. Verificar que a aplicacao foi deployada automaticamente`,
        hints: [
          'O repositorio podinfo e publico — nao precisa de secretRef',
          'O path ./kustomize no repositorio podinfo tem os manifests',
          'flux get kustomizations mostra o status da reconciliacao'
        ],
        solution: `\`\`\`bash
# Criar namespace
kubectl create namespace podinfo
\`\`\`

\`\`\`yaml
# podinfo-source.yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: podinfo
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/stefanprodan/podinfo
  ref:
    branch: master
\`\`\`

\`\`\`yaml
# podinfo-kustomization.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: podinfo
  namespace: flux-system
spec:
  interval: 5m
  path: ./kustomize
  prune: true
  sourceRef:
    kind: GitRepository
    name: podinfo
  targetNamespace: podinfo
\`\`\`

\`\`\`bash
kubectl apply -f podinfo-source.yaml
kubectl apply -f podinfo-kustomization.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar GitRepository sendo sincronizado
kubectl get gitrepository podinfo -n flux-system
# Saida esperada: READY=True, URL exibida

# Ver detalhes do artefato baixado
kubectl describe gitrepository podinfo -n flux-system | grep -A5 "Artifact:"

# Verificar Kustomization em reconciliacao
flux get kustomizations
# Saida esperada: podinfo READY=True APPLIED=True

# Verificar que a aplicacao foi deployada
kubectl get all -n podinfo
# Saida esperada: deployment/podinfo, service/podinfo, pods Running

# Verificar que o Flux gerencia os recursos
kubectl get deployment podinfo -n podinfo -o yaml | grep -i "kustomize.toolkit"
# Saida esperada: labels do Flux no recurso

# Forcar reconciliacao manual para verificar
flux reconcile kustomization podinfo --with-source
\`\`\``
      },
      {
        title: 'Testar drift detection',
        instruction: `Verifique como o Flux detecta e corrige drift:
1. Fazer uma mudanca manual no cluster (editar um recurso)
2. Aguardar a proxima reconciliacao (ou forcar com flux reconcile)
3. Verificar que o Flux reverteu a mudanca para o estado do Git
4. Usar flux diff para ver o que seria aplicado`,
        hints: [
          'Editar o numero de replicas com kubectl scale e uma mudanca que o Flux vai reverter',
          'flux diff kustomization mostra o que sera aplicado sem aplicar',
          'O interval da Kustomization controla a frequencia de reconciliacao'
        ],
        solution: `\`\`\`bash
# Ver estado atual
kubectl get deployment podinfo -n podinfo
# Anotar numero de replicas

# Fazer drift manual — alterar replicas
kubectl scale deployment podinfo -n podinfo --replicas=5

# Verificar mudanca aplicada
kubectl get deployment podinfo -n podinfo | grep -i replicas

# Usar flux diff para ver o que o Flux aplicaria
flux diff kustomization podinfo
# Saida esperada: mostra que replicas seria revertido para o valor do Git

# Forcar reconciliacao para reverter o drift
flux reconcile kustomization podinfo --with-source
\`\`\``,
        verify: `\`\`\`bash
# Verificar que as replicas foram revertidas para o valor do Git
kubectl get deployment podinfo -n podinfo
# Saida esperada: REPLICAS devem estar no valor original do repositorio

# Verificar eventos da Kustomization (mostra historico de reconciliacoes)
kubectl get events -n flux-system --field-selector involvedObject.name=podinfo
# Saida esperada: eventos de reconciliacao bem-sucedida

# Ver status completo da Kustomization
flux get kustomization podinfo
# Saida esperada: READY=True, ultimo apply recente

# Ver logs do kustomize-controller para confirmar
flux logs --kind=Kustomization --name=podinfo --tail=10
# Saida esperada: logs de aplicacao dos manifests
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'GitRepository fica em estado NotReady com erro de autenticacao',
      difficulty: 'easy',
      symptom: 'O GitRepository foi criado mas fica com READY=False e mensagem de erro "failed to authenticate".',
      diagnosis: `\`\`\`bash
# 1. Verificar status do GitRepository
kubectl get gitrepository <nome> -n flux-system
# Verificar coluna READY e REASON

# 2. Ver mensagem de erro detalhada
kubectl describe gitrepository <nome> -n flux-system | grep -A10 "Status:"
# Procurar por "Message:" no Conditions

# 3. Verificar se o Secret existe
kubectl get secret <nome-do-secret> -n flux-system

# 4. Verificar formato do Secret
kubectl get secret <nome-do-secret> -n flux-system -o yaml | grep "data:"
# Verificar campos esperados (identity, known_hosts para SSH; username, password para HTTPS)

# 5. Ver logs do source-controller
kubectl logs -n flux-system -l app=source-controller --tail=20 | grep -i "error\\|fail"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Repositorio privado sem Secret:** Adicionar secretRef ao GitRepository. Para repositorios publicos, nao e necessario.

2. **Secret no namespace errado:** O Secret deve estar no mesmo namespace do GitRepository (geralmente flux-system).

3. **Formato de Secret errado para SSH:**
\`\`\`bash
flux create secret git github-token \\
  --url=ssh://git@github.com/org/repo \\
  --ssh-key-algorithm=ecdsa
# Ou criar manualmente com identity + known_hosts
\`\`\`

4. **Token expirado:** Tokens pessoais e deploy keys expiram. Regenerar e atualizar o Secret.

5. **URL incorreta:** Para SSH usar \`ssh://git@github.com/org/repo\` com protocolo. Para HTTPS usar \`https://github.com/org/repo\`.`
    },
    {
      title: 'Kustomization fica presa em estado Reconciling sem terminar',
      difficulty: 'medium',
      symptom: 'A Kustomization mostra status "Reconciling" por muito tempo e nunca fica Ready. Os recursos podem ou nao estar sendo criados.',
      diagnosis: `\`\`\`bash
# 1. Verificar status detalhado
kubectl describe kustomization <nome> -n flux-system | grep -A15 "Status:"

# 2. Verificar se o healthCheck esta travado
kubectl describe kustomization <nome> -n flux-system | grep -A10 "Health:"
# Procurar qual recurso esta falhando no healthCheck

# 3. Verificar os recursos que deveriam estar saudaveis
kubectl get deployment <nome> -n <namespace>
# Ver se esta em estado Progressing ou Error

# 4. Verificar eventos
kubectl get events -n <namespace> --sort-by='.lastTimestamp' | tail -10

# 5. Logs do kustomize-controller
kubectl logs -n flux-system -l app=kustomize-controller --tail=30 | grep -i "error\\|fail\\|health"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **healthChecks referenciando recurso inexistente:** O healthCheck aponta para um Deployment que nao existe no path. Verificar que o nome e namespace correspondem a um recurso real criado pela Kustomization.

2. **Deployment com ImagePullBackOff:** O Pod nao consegue baixar a imagem. O healthCheck aguarda o Deployment Ready mas ele nunca fica. Verificar kubectl describe pod e kubectl describe deployment.

3. **dependsOn travado:** A Kustomization depende de outra que tambem nao esta Ready. Verificar flux get kustomizations para ver qual esta bloqueando.

4. **Timeout do healthCheck:** Adicionar timeout: 5m ao spec da Kustomization para nao esperar indefinidamente.

5. **Recursos Terminating:** Recursos do ciclo anterior estao em Terminating. Aguardar ou forcar finalizadores: kubectl patch <recurso> -p '{"metadata":{"finalizers":[]}}' --type=merge.`
    }
  ]
};
