window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['fluxcd/fluxcd-sources'] = {
  theory: `
# FluxCD: Sources, Kustomizations & Helm Avancado

## Relevancia
Este topico aprofunda o modelo de Sources do Flux (GitRepository, HelmRepository, OCIRepository), as capacidades avancadas de Kustomization (substituicao de variaveis, dependencias, patches), e o gerenciamento completo de HelmReleases com upgrade, rollback e valuesFrom. Conhecimento essencial para operadores de plataforma que gerenciam multiplos clusters e ambientes.

## Conceitos Fundamentais

### Sources — Tipos e Usos

\`\`\`yaml
# GitRepository — repositorio Git
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/org/my-app
  ref:
    branch: main              # branch
    # tag: v1.2.3             # ou tag especifica
    # semver: ">=1.0.0 <2.0"  # ou semver range
    # commit: abc123def       # ou commit exato
  ignore: |                   # Ignorar arquivos/diretorios
    *.md
    *.txt
    tests/
    docs/
\`\`\`

\`\`\`yaml
# HelmRepository — repositorio Helm (OCI ou HTTP)
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: bitnami
  namespace: flux-system
spec:
  interval: 1h               # Repositories Helm mudam menos
  url: https://charts.bitnami.com/bitnami
  # Para OCI (Helm 3.8+):
  # type: oci
  # url: oci://registry-1.docker.io/bitnamicharts
\`\`\`

\`\`\`yaml
# OCIRepository — artefatos OCI (imagens Flux, charts empacotados)
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: OCIRepository
metadata:
  name: my-app-configs
  namespace: flux-system
spec:
  interval: 5m
  url: oci://ghcr.io/myorg/my-app-configs
  ref:
    tag: latest
    # ou semver: ">=1.0.0"
    # ou digest: sha256:abc123
  secretRef:
    name: ghcr-auth
\`\`\`

### Kustomization Avancada — Substituicao de Variaveis

\`\`\`yaml
# postBuild.substitute — substituicao de variaveis no YAML
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps
  namespace: flux-system
spec:
  interval: 5m
  path: ./apps
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  postBuild:
    substitute:
      ENVIRONMENT: production
      DOMAIN: acme.io
      IMAGE_TAG: v1.2.3
    substituteFrom:
      - kind: ConfigMap
        name: cluster-vars          # Variaveis de um ConfigMap
      - kind: Secret
        name: cluster-secrets       # Variaveis sensiveis de um Secret
        optional: true              # Nao falhar se Secret nao existir
\`\`\`

\`\`\`yaml
# No arquivo YAML do repositorio, usar \${VAR_NAME}:
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: \${ENVIRONMENT}       # Substituido em runtime
spec:
  template:
    spec:
      containers:
        - name: app
          image: ghcr.io/myorg/app:\${IMAGE_TAG}  # Tag do ConfigMap
          env:
            - name: DOMAIN
              value: \${DOMAIN}
\`\`\`

### Kustomization com dependsOn

\`\`\`yaml
# infrastructure/kustomization.yaml — deploy de cert-manager primeiro
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: infrastructure
  namespace: flux-system
spec:
  interval: 10m
  path: ./infrastructure/base
  prune: true
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: cert-manager
      namespace: cert-manager
---
# apps/kustomization.yaml — apps so deployam apos infrastructure estar Ready
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps
  namespace: flux-system
spec:
  interval: 5m
  path: ./apps/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  dependsOn:
    - name: infrastructure        # Aguarda infrastructure estar Ready
\`\`\`

### Kustomization com patches inline

\`\`\`yaml
# patches inline na Kustomization do Flux
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps-production
  namespace: flux-system
spec:
  interval: 5m
  path: ./apps/base
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  patches:
    # Strategic merge patch
    - patch: |
        apiVersion: apps/v1
        kind: Deployment
        metadata:
          name: podinfo
        spec:
          replicas: 3
      target:
        kind: Deployment
        name: podinfo
    # JSON patch
    - patch: |
        - op: replace
          path: /spec/template/spec/containers/0/resources/requests/memory
          value: 256Mi
      target:
        kind: Deployment
        name: podinfo
\`\`\`

### HelmRelease Avancado

\`\`\`yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: kube-prometheus-stack
  namespace: monitoring
spec:
  interval: 30m
  chart:
    spec:
      chart: kube-prometheus-stack
      version: ">=55.0.0 <56.0.0"
      sourceRef:
        kind: HelmRepository
        name: prometheus-community
        namespace: flux-system
      valuesFiles:
        - values.yaml             # Values file no chart
  values:                        # Override inline
    grafana:
      enabled: true
      adminPassword: ""          # Override para seguranca
  valuesFrom:
    - kind: ConfigMap
      name: prometheus-values
      valuesKey: values.yaml
    - kind: Secret
      name: prometheus-secrets
      valuesKey: secret-values.yaml
      optional: true
  install:
    createNamespace: true
    remediation:
      retries: 3                 # Tentar 3x antes de considerar falha
  upgrade:
    remediation:
      retries: 3
      remediateLastFailure: true # Remediar mesmo na ultima tentativa
  rollback:
    timeout: 5m
    cleanupOnFail: true
  timeout: 10m                   # Timeout para operacoes Helm
\`\`\`

### HelmRelease — Dependencias entre Releases

\`\`\`yaml
# cert-manager deve ser instalado antes de apps que usam Certificates
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: cert-manager
  namespace: cert-manager
spec:
  interval: 30m
  chart:
    spec:
      chart: cert-manager
      version: ">=1.14.0 <2.0.0"
      sourceRef:
        kind: HelmRepository
        name: jetstack
        namespace: flux-system
  values:
    installCRDs: true
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: my-app
  namespace: default
spec:
  dependsOn:
    - name: cert-manager
      namespace: cert-manager    # Aguarda cert-manager Ready
  chart:
    spec:
      chart: my-app
      # ...
\`\`\`

### HelmRelease com Kustomize postRenderer

\`\`\`yaml
# Usar Kustomize para modificar o output do Helm
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: podinfo
  namespace: default
spec:
  chart:
    spec:
      chart: podinfo
      sourceRef:
        kind: HelmRepository
        name: podinfo
        namespace: flux-system
  postRenderers:
    - kustomize:
        patches:
          - patch: |
              apiVersion: apps/v1
              kind: Deployment
              metadata:
                name: podinfo
              spec:
                template:
                  spec:
                    nodeSelector:
                      kubernetes.io/os: linux
            target:
              kind: Deployment
              name: podinfo
\`\`\`

### OCIRepository — Artefatos GitOps OCI

\`\`\`bash
# Empacotar e publicar configs como artefato OCI
flux push artifact oci://ghcr.io/myorg/podinfo-manifests:latest \\
  --path=./apps/podinfo \\
  --source="https://github.com/myorg/fleet-infra" \\
  --revision="main@sha1:abc123"

# Listar artefatos publicados
flux list artifact oci://ghcr.io/myorg/podinfo-manifests

# Verificar assinatura do artefato (cosign)
flux pull artifact oci://ghcr.io/myorg/podinfo-manifests:latest \\
  --output=./download
\`\`\`

\`\`\`yaml
# OCIRepository como source para Kustomization
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: OCIRepository
metadata:
  name: podinfo-configs
  namespace: flux-system
spec:
  interval: 5m
  url: oci://ghcr.io/myorg/podinfo-manifests
  ref:
    semver: ">=1.0.0"
  secretRef:
    name: ghcr-auth
  verify:                           # Verificar assinatura cosign
    provider: cosign
    secretRef:
      name: cosign-pub-key
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: podinfo-from-oci
  namespace: flux-system
spec:
  interval: 5m
  path: ./
  sourceRef:
    kind: OCIRepository
    name: podinfo-configs
  prune: true
\`\`\`

### Erros Comuns Avancados

1. **substituteFrom sem ConfigMap/Secret** — Se o ConfigMap/Secret nao existir e optional nao for true, a Kustomization falha
2. **dependsOn circular** — A → B → A causa deadlock; verificar grafo de dependencias
3. **HelmRelease timeout** — Charts complexos podem demorar mais que o timeout default (5min); aumentar timeout
4. **valuesFrom key errada** — O valuesKey deve ser o nome exato da chave no ConfigMap/Secret
5. **HelmRelease com valores de Secret em texto claro** — Usar valuesFrom com Secret para valores sensiveis, nao inline no spec

## Killer.sh Style Challenge

> **Cenario:** Voce tem dois ambientes (staging e producao) compartilhando os mesmos manifests base em Git. Usando Kustomizations separadas, configure: (1) staging com REPLICAS=1 e ENVIRONMENT=staging usando substituicao de variaveis; (2) production com REPLICAS=3 e ENVIRONMENT=production; (3) Ambos dependem de uma Kustomization \`infrastructure\` que deve estar Ready primeiro.
`,
  quiz: [
    {
      question: 'Qual a diferenca entre GitRepository, HelmRepository e OCIRepository no Flux?',
      options: [
        'Sao o mesmo tipo de recurso com nomes diferentes',
        'GitRepository monitora repositorios Git; HelmRepository monitora index de charts Helm; OCIRepository monitora registries OCI (imagens, charts empacotados)',
        'HelmRepository so suporta Helm 2; OCIRepository so suporta Helm 3',
        'GitRepository e mais rapido que os outros'
      ],
      correct: 1,
      explanation: 'GitRepository: clona repositorios Git (SSH/HTTPS), suporta branch/tag/commit/semver. HelmRepository: baixa index.yaml de repositorios Helm tradicionais ou OCI. OCIRepository: baixa artefatos de OCI registries (manifestos, charts, etc.) — mais seguro pois suporta verificacao de assinatura cosign.',
      reference: 'Conceito relacionado: OCIRepository e o futuro do GitOps — permite empacotar e assinar configuracoes como imagens OCI.'
    },
    {
      question: 'Como funciona o postBuild.substitute em Kustomizations do Flux?',
      options: [
        'Executa scripts shell apos o deploy',
        'Substitui variaveis no formato ${VAR} nos manifests YAML antes de aplicar ao cluster, usando valores de substitute ou substituteFrom (ConfigMap/Secret)',
        'Adiciona labels a todos os recursos deployados',
        'Valida os manifests antes de aplicar'
      ],
      correct: 1,
      explanation: 'postBuild.substitute realiza substituicao de texto nos manifests: ${ENVIRONMENT} se torna "production". Os valores vem de substitute (inline) ou substituteFrom (ConfigMap/Secret). Permite reutilizar os mesmos manifests em multiplos ambientes apenas mudando variaveis.',
      reference: 'Conceito relacionado: substituteFrom com optional: true nao falha se o ConfigMap/Secret nao existir — util para variaveis opcionais.'
    },
    {
      question: 'O que o campo dependsOn em uma Kustomization garante?',
      options: [
        'Que os recursos tem o mesmo owner',
        'Que a Kustomization so inicia reconciliacao apos as Kustomizations listadas em dependsOn estarem no estado Ready',
        'Que recursos sao deletados na ordem correta',
        'Que labels sao propagados entre Kustomizations'
      ],
      correct: 1,
      explanation: 'dependsOn cria ordem de reconciliacao: se apps depende de infrastructure, o Flux aguarda infrastructure (e seus healthChecks) ficarem Ready antes de comecar a reconciliar apps. Critico para: cert-manager antes de apps com Certificates, ingress-controller antes de Ingresses.',
      reference: 'Conceito relacionado: dependsOn funciona entre HelmReleases tambem — HelmRelease B pode depender de HelmRelease A.'
    },
    {
      question: 'Como configurar rollback automatico em um HelmRelease no Flux?',
      options: [
        'Usando flux rollback helmrelease',
        'Configurando spec.rollback com timeout e cleanupOnFail, e spec.upgrade.remediation.remediateLastFailure: true',
        'Rollback e automatico e nao precisa de configuracao',
        'Usando um Job de rollback no mesmo namespace'
      ],
      correct: 1,
      explanation: 'Para rollback automatico: (1) spec.rollback.timeout: limite de tempo; (2) spec.rollback.cleanupOnFail: limpar recursos se rollback falhar; (3) spec.upgrade.remediation.retries: quantas vezes tentar upgrade antes de rollback; (4) remediateLastFailure: true para rollback mesmo na ultima tentativa.',
      reference: 'Conceito relacionado: spec.install.remediation.retries controla tentativas no primeiro install. spec.upgrade.remediation controla tentativas em upgrades subsequentes.'
    },
    {
      question: 'O que sao postRenderers em HelmReleases?',
      options: [
        'Scripts que rodam apos o Helm install',
        'Transformacoes aplicadas ao output YAML gerado pelo Helm ANTES de ser aplicado ao cluster — permite usar Kustomize patches em charts Helm',
        'Validadores do chart Helm',
        'Hooks Helm customizados'
      ],
      correct: 1,
      explanation: 'postRenderers sao transformacoes (via Kustomize) aplicadas ao YAML que o Helm gera antes de ser aplicado ao cluster. Permite adicionar labels, nodeSelectors, tolerations, ou qualquer modificacao que o chart nao suporta nativamente — sem fazer fork do chart.',
      reference: 'Conceito relacionado: Alternativa ao fork de charts para pequenas customizacoes. O resultado e auditavel via flux diff helmrelease.'
    },
    {
      question: 'Como empacotar e publicar configuracoes como artefato OCI com Flux?',
      options: [
        'Usando docker push',
        'Usando flux push artifact com URL oci://, path local, source e revision — cria uma imagem OCI com os manifests',
        'Usando kubectl create configmap',
        'Nao e possivel publicar configs como OCI com Flux'
      ],
      correct: 1,
      explanation: 'flux push artifact oci://registry/repo:tag --path=./configs cria uma imagem OCI com os manifests como layer. Suporta verificacao de assinatura cosign com spec.verify no OCIRepository. E o modelo recomendado para distribuicao de configuracoes entre clusters em organizacoes.',
      reference: 'Conceito relacionado: Artefatos OCI podem ser assinados com cosign e verificados pelo Flux antes de aplicar — zero-trust GitOps.'
    },
    {
      question: 'Como usar valuesFrom em HelmReleases para injetar valores sensiveis?',
      options: [
        'Adicionar os valores diretamente em spec.values',
        'Usando spec.valuesFrom com kind: Secret e valuesKey especificando qual chave do Secret contem os valores YAML',
        'Usando variaveis de ambiente no controller',
        'Valores sensiveis nao podem ser usados em HelmReleases'
      ],
      correct: 1,
      explanation: 'valuesFrom permite injetar valores de ConfigMaps e Secrets: kind: Secret, name: my-secrets, valuesKey: values.yaml. O Flux le o conteudo da chave (que deve ser YAML valido de values Helm) e o mescla com os outros valores. Nao expoe os valores sensiveis no spec da HelmRelease.',
      reference: 'Conceito relacionado: Usar Sealed Secrets ou External Secrets para gerenciar os Secrets que o valuesFrom referencia.'
    }
  ],
  flashcards: [
    {
      front: 'Sources do Flux — comparacao GitRepository vs HelmRepository vs OCIRepository',
      back: '**GitRepository:**\n- Protocolo: HTTPS ou SSH\n- Auth: deploy key, token\n- ref: branch, tag, commit, semver\n- Output: tarball dos arquivos\n- Use case: manifestos YAML, Kustomize\n\n**HelmRepository:**\n- Tipo: HTTP (index.yaml) ou OCI\n- interval: geralmente 1h (muda pouco)\n- Output: lista de charts disponiveis\n- Use case: instalar charts Helm\n\n**OCIRepository:**\n- Protocolo: OCI (como Docker)\n- Auth: imagePullSecret format\n- ref: tag, semver, digest\n- verify: cosign signature\n- Output: layers OCI com configs\n- Use case: distribuicao de configs\n\n**Compartilham:**\n- interval, secretRef, ignore\n- Status: READY, URL, artifact'
    },
    {
      front: 'postBuild.substitute — variaveis em Kustomizations',
      back: '**No manifests YAML:**\n\`\`\`yaml\nimage: registry/${IMAGE_TAG}\nnamespace: ${ENVIRONMENT}\n\`\`\`\n\n**Na Kustomization:**\n\`\`\`yaml\npostBuild:\n  substitute:\n    IMAGE_TAG: v1.2.3        # Inline\n    ENVIRONMENT: production  # Inline\n  substituteFrom:\n    - kind: ConfigMap\n      name: cluster-vars     # Do ConfigMap\n    - kind: Secret\n      name: cluster-secrets  # Do Secret\n      optional: true         # Nao falhar se inexistente\n\`\`\`\n\n**Precendencia:**\nsubstitute > substituteFrom ConfigMap > substituteFrom Secret\n\n**Caracteres especiais:**\n\`$$\` para literal \`\$\` no YAML\n\`\${VAR:=default}\` com valor default'
    },
    {
      front: 'HelmRelease — upgrade e rollback automatico',
      back: '\`\`\`yaml\nspec:\n  timeout: 10m      # Timeout operacoes\n  install:\n    remediation:\n      retries: 3    # Tentativas install\n  upgrade:\n    remediation:\n      retries: 3\n      remediateLastFailure: true  # Rollback na ultima\n  rollback:\n    timeout: 5m\n    cleanupOnFail: true  # Limpar se rollback falhar\n\`\`\`\n\n**Fluxo em falha:**\n1. Upgrade falha\n2. Tenta novamente (retries)\n3. Se retries esgotados, faz ROLLBACK\n4. Roll back para versao anterior\n5. Se cleanupOnFail, limpa recursos\n\n**Forcar rollback manual:**\n`flux suspend helmrelease nome`\n`helm rollback nome --namespace ns`\n`flux resume helmrelease nome`'
    },
    {
      front: 'dependsOn — ordem de reconciliacao',
      back: '**Em Kustomizations:**\n\`\`\`yaml\nspec:\n  dependsOn:\n    - name: infrastructure\n    - name: cert-manager\n      namespace: cert-manager  # Cross-namespace\n\`\`\`\n\n**Em HelmReleases:**\n\`\`\`yaml\nspec:\n  dependsOn:\n    - name: cert-manager\n      namespace: cert-manager\n\`\`\`\n\n**Como funciona:**\n- Verifica se dependencias estao Ready\n- Se nao, fica em estado Waiting\n- So reconcilia apos TODAS as deps Ready\n\n**Casos de uso comuns:**\n1. CRDs antes de resources\n2. Namespace antes de resources\n3. cert-manager antes de Ingresses\n4. storage-class antes de PVCs\n5. secrets-manager antes de apps\n\n**Circular dependency:**\nA→B→A causa DEADLOCK — evitar!'
    },
    {
      front: 'HelmRelease valuesFrom — injetar valores externos',
      back: '**Sintaxe:**\n\`\`\`yaml\nspec:\n  valuesFrom:\n    - kind: ConfigMap\n      name: app-values         # Nome do CM\n      valuesKey: values.yaml   # Chave no CM\n    - kind: Secret\n      name: app-secrets        # Nome do Secret\n      valuesKey: secret-vals   # Chave no Secret\n      optional: true           # Nao falhar se inexistente\n      targetPath: "db.password"  # Path especifico no values\n\`\`\`\n\n**O conteudo da chave deve ser YAML valido:**\n\`\`\`yaml\n# ConfigMap data.values.yaml:\ngrafana:\n  adminPassword: admin\nprometheus:\n  retention: 30d\n\`\`\`\n\n**Precedencia:**\nspec.values > valuesFrom[last] > valuesFrom[first] > chart defaults\n\n**Dica:** Usar Sealed Secrets\nou External Secrets para os Secrets\nreferenciados por valuesFrom.'
    },
    {
      front: 'postRenderers — customizar charts Helm com Kustomize',
      back: '**Caso de uso:**\nChart Helm nao suporta uma opcao que voce precisa\n(ex: adicionar tolerations, nodeSelector)\n\n**Sem fork do chart:**\n\`\`\`yaml\nspec:\n  postRenderers:\n    - kustomize:\n        patches:\n          - patch: |\n              apiVersion: apps/v1\n              kind: Deployment\n              metadata:\n                name: nome\n              spec:\n                template:\n                  spec:\n                    tolerations:\n                      - key: dedicated\n                        value: monitoring\n            target:\n              kind: Deployment\n              name: nome\n        images:       # Override imagens\n          - name: nginx\n            newTag: 1.25.0\n\`\`\`\n\n**Inspecionar resultado:**\n`flux diff helmrelease nome`'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar um ambiente multi-stage usando o Flux, com dependencias entre componentes de infraestrutura e aplicacoes, e variaveis de ambiente por cluster.',
    objective: 'Aprender substituicao de variaveis, dependencias entre Kustomizations, e HelmRelease com valuesFrom.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Configurar Kustomization com substituicao de variaveis',
        instruction: `Configure substituicao de variaveis no Flux:
1. Criar um ConfigMap com variaveis de cluster (ENVIRONMENT=lab, DOMAIN=example.com)
2. Criar uma Kustomization que usa postBuild.substituteFrom para injetar essas variaveis
3. Criar manifests YAML que usam as variaveis \${ENVIRONMENT} e \${DOMAIN}
4. Verificar que as variaveis foram substituidas corretamente`,
        hints: [
          'O ConfigMap deve estar no mesmo namespace da Kustomization (flux-system)',
          'No YAML, usar \${VAR_NAME} para referencias de variavel',
          'kubectl get configmap -n <namespace> mostra o valor aplicado'
        ],
        solution: `\`\`\`bash
# Criar ConfigMap com variaveis do cluster
kubectl create configmap cluster-vars \\
  --from-literal=ENVIRONMENT=lab \\
  --from-literal=DOMAIN=example.com \\
  --from-literal=REPLICA_COUNT=1 \\
  -n flux-system
\`\`\`

\`\`\`bash
# Criar manifests que usam variaveis (simulando repositorio Git)
mkdir -p /tmp/flux-lab/apps

cat > /tmp/flux-lab/apps/namespace.yaml <<'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: \${ENVIRONMENT}
  labels:
    environment: \${ENVIRONMENT}
    domain: \${DOMAIN}
EOF

cat > /tmp/flux-lab/apps/configmap.yaml <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: \${ENVIRONMENT}
data:
  DOMAIN: \${DOMAIN}
  ENV: \${ENVIRONMENT}
EOF

cat > /tmp/flux-lab/apps/kustomization.yaml <<'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - namespace.yaml
  - configmap.yaml
EOF
\`\`\`

\`\`\`yaml
# flux-kustomization.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: app-with-vars
  namespace: flux-system
spec:
  interval: 1m
  path: /apps
  prune: true
  sourceRef:
    kind: GitRepository
    name: podinfo        # Reusar source existente
  postBuild:
    substituteFrom:
      - kind: ConfigMap
        name: cluster-vars
        namespace: flux-system
\`\`\``,
        verify: `\`\`\`bash
# NOTA: Este step e demonstrativo — o source deve ter os arquivos com \${VAR}
# Para testar substituicao, usar flux CLI diretamente:

# Ver o ConfigMap de variaveis
kubectl get configmap cluster-vars -n flux-system -o yaml
# Saida esperada: data com ENVIRONMENT, DOMAIN, REPLICA_COUNT

# Verificar que substituicao funciona (via kyverno apply simulado)
# flux diff kustomization app-with-vars (se source tivesse os arquivos)

# Demonstrar logica de substituicao manualmente:
echo 'Valor ENVIRONMENT: lab'
echo 'Valor DOMAIN: example.com'
echo 'Em runtime, \${ENVIRONMENT} seria substituido por "lab"'
echo 'Em runtime, \${DOMAIN} seria substituido por "example.com"'

# Verificar Kustomization criada
kubectl get kustomization -n flux-system
# Saida esperada: app-with-vars listada
\`\`\``
      },
      {
        title: 'Configurar HelmRelease com dependsOn',
        instruction: `Configure HelmReleases com dependencias:
1. Criar um HelmRepository para o repositorio bitnami
2. Criar um HelmRelease para o nginx (simula infraestrutura base)
3. Criar outro HelmRelease que depende do nginx estar Ready (simula aplicacao)
4. Verificar a ordem de deploy e healthChecks`,
        hints: [
          'spec.dependsOn[].name deve ser o nome exato do HelmRelease do qual depende',
          'Use flux get helmreleases para ver o status de todos',
          'Se o primeiro HelmRelease falhar, o segundo fica em Waiting'
        ],
        solution: `\`\`\`yaml
# helm-sources.yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: bitnami
  namespace: flux-system
spec:
  interval: 1h
  url: https://charts.bitnami.com/bitnami
\`\`\`

\`\`\`yaml
# helm-releases.yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: nginx-base
  namespace: default
spec:
  interval: 10m
  chart:
    spec:
      chart: nginx
      version: ">=15.0.0 <16.0.0"
      sourceRef:
        kind: HelmRepository
        name: bitnami
        namespace: flux-system
  values:
    replicaCount: 1
    service:
      type: ClusterIP
  install:
    remediation:
      retries: 2
  upgrade:
    remediation:
      retries: 2
---
# Segundo HelmRelease DEPENDE do primeiro
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: my-app
  namespace: default
spec:
  dependsOn:
    - name: nginx-base           # Aguarda nginx-base
      namespace: default
  interval: 5m
  chart:
    spec:
      chart: nginx
      version: ">=15.0.0 <16.0.0"
      sourceRef:
        kind: HelmRepository
        name: bitnami
        namespace: flux-system
  values:
    replicaCount: 1
    nameOverride: my-app
\`\`\`

\`\`\`bash
kubectl apply -f helm-sources.yaml
kubectl apply -f helm-releases.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar HelmRepository
kubectl get helmrepository bitnami -n flux-system
# Saida esperada: READY=True

# Monitorar HelmReleases (my-app fica em Waiting ate nginx-base estar Ready)
flux get helmreleases
# Saida esperada inicialmente:
# nginx-base  - False  -  install in progress...
# my-app      - False  -  dependency not ready

# Apos nginx-base estar Ready:
# nginx-base  - True   -  Release reconciliation succeeded
# my-app      - True   -  Release reconciliation succeeded

# Verificar pods deployados
kubectl get pods -n default | grep -E "nginx|my-app"
# Saida esperada: pods de nginx-base e my-app

# Ver logs do helm-controller para confirmar dependencia
flux logs --kind=HelmRelease --name=my-app
# Saida esperada: "dependency not ready" seguido de deploy bem-sucedido
\`\`\``
      },
      {
        title: 'Explorar flux diff e operacoes CLI avancadas',
        instruction: `Explore as capacidades avancadas da Flux CLI:
1. Usar flux diff para ver o que seria aplicado sem aplicar
2. Exportar resources Flux para YAML
3. Suspender e resumir uma Kustomization
4. Verificar o historico de reconciliacoes via logs`,
        hints: [
          'flux diff kustomization <nome> mostra diferenca entre Git e cluster',
          'flux export source git <nome> exporta o recurso como YAML limpo',
          'flux logs --follow aguarda novos logs (semelhante a kubectl logs -f)'
        ],
        solution: `\`\`\`bash
# Ver status completo de todos os recursos
flux get all

# Ver detalhes de um GitRepository especifico
flux get source git podinfo -n flux-system
flux get source git --namespace=flux-system

# Exportar recurso como YAML (util para GitOps)
flux export source git podinfo -n flux-system

# Exportar Kustomization
flux export kustomization podinfo -n flux-system

# Ver logs de um controller especifico
flux logs --kind=Kustomization --name=podinfo -n flux-system --tail=20

# Suspender reconciliacao (para manutencao ou testes)
flux suspend kustomization podinfo -n flux-system
echo "Kustomization suspensa — mudancas manuais nao serao revertidas"

# Verificar status apos suspensao
kubectl get kustomization podinfo -n flux-system
# Saida esperada: SUSPENDED=True

# Fazer mudanca manual enquanto suspenso
kubectl scale deployment podinfo -n podinfo --replicas=3 2>/dev/null || true
\`\`\``,
        verify: `\`\`\`bash
# Verificar que esta suspenso
flux get kustomization podinfo -n flux-system
# Saida esperada: SUSPENDED=True

# Retomar reconciliacao
flux resume kustomization podinfo -n flux-system
flux get kustomization podinfo -n flux-system
# Saida esperada: SUSPENDED=False

# Ver eventos de reconc.
kubectl get events -n flux-system \\
  --field-selector involvedObject.name=podinfo \\
  --sort-by='.lastTimestamp' | tail -5
# Saida esperada: eventos de suspend/resume e reconciliacao

# Verificar que mudancas manuais foram revertidas
kubectl get deployment podinfo -n podinfo 2>/dev/null
# Saida esperada: replicas voltaram ao valor do Git

# Ver resumo do estado de tudo
flux get all -n flux-system
# Saida esperada: todos os recursos READY=True
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'HelmRelease fica em upgrade retries com erro "release not found"',
      difficulty: 'medium',
      symptom: 'O HelmRelease falha repetidamente com "upgrade retries exhausted" ou "release not found". O chart nao e deployado.',
      diagnosis: `\`\`\`bash
# 1. Verificar status detalhado
flux get helmrelease <nome> -n <namespace>
kubectl describe helmrelease <nome> -n <namespace> | grep -A10 "Status:"

# 2. Ver logs do helm-controller
flux logs --kind=HelmRelease --name=<nome> -n <namespace> --tail=30

# 3. Verificar se o HelmRepository esta healthy
flux get source helm <helm-repo-nome> -n flux-system

# 4. Ver historico Helm diretamente
helm history <nome> -n <namespace> 2>/dev/null

# 5. Verificar se o namespace existe
kubectl get namespace <namespace>
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Chart nao encontrado no repositorio:** O chart ou versao nao existe no HelmRepository. Verificar com \`helm search repo <nome>/<chart>\` ou inspecionar o HelmRepository.

2. **HelmRepository ainda nao indexado:** O primeiro sync pode demorar. Forcar: \`flux reconcile source helm <nome> -n flux-system\`.

3. **Versao do chart nao corresponde ao semver:** \`version: ">=5.0.0 <6.0.0"\` pode nao ter versao disponivel. Verificar versoes existentes.

4. **Release helm corrompida:** Se uma instalacao anterior falhou parcialmente, a release helm pode estar em estado ruim. Limpar manualmente:
\`\`\`bash
flux suspend helmrelease <nome>
helm uninstall <nome> -n <namespace> --no-hooks
flux resume helmrelease <nome>
\`\`\`

5. **Namespace nao existe:** Se spec.install.createNamespace: false (default) e o namespace nao existe, o deploy falha. Adicionar createNamespace: true ou criar o namespace antes.`
    },
    {
      title: 'postBuild.substitute nao substitui variaveis — ficam como ${VAR}',
      difficulty: 'easy',
      symptom: 'A Kustomization usa postBuild.substitute mas as variaveis ${VAR} ficam literais no cluster — os recursos tem a string ${VAR} em vez do valor.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o ConfigMap tem os valores corretos
kubectl get configmap cluster-vars -n flux-system -o yaml

# 2. Verificar syntax do substituteFrom
kubectl get kustomization <nome> -n flux-system -o yaml | grep -A10 "postBuild:"

# 3. Verificar o recurso aplicado no cluster
kubectl get deployment <nome> -o yaml | grep -i "environment\\|domain\\|image"
# Se mostrar "\${VAR}" literal, a substituicao nao ocorreu

# 4. Ver logs da Kustomization
flux logs --kind=Kustomization --name=<nome> -n flux-system
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Sintaxe errada no YAML:** A variavel deve ser \`\${VAR_NAME}\` (com chaves). Sem chaves (\`\$VAR\`) nao e substituido.

2. **Arquivo nao e processado pelo substitutor:** Verificar se o arquivo esta no path da Kustomization e nao no campo ignore.

3. **ConfigMap no namespace errado:** O ConfigMap referenciado em substituteFrom deve estar no namespace da Kustomization (geralmente flux-system). Se estiver em outro namespace, a Kustomization nao consegue le-lo.

4. **Variavel nao definida:** Se a variavel nao existe nem no substitute nem no substituteFrom, ela fica como literal. Verificar o nome exato (case-sensitive).

5. **Kustomize override o valor:** O arquivo kustomization.yaml no repositorio pode ter patches que sobrescrevem o valor substituido. Verificar a ordem de aplicacao.`
    }
  ]
};
