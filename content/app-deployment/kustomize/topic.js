window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['app-deployment/kustomize'] = {
  theory: `# Kustomize: Personalizacao de Manifestos Kubernetes

## O que e o Kustomize?

Kustomize e uma ferramenta de customizacao de configuracao **sem templates**. Em vez de usar linguagens de template (como Go templates do Helm), o Kustomize trabalha com **YAMLs validos** e aplica transformacoes declarativas sobre eles.

**Integrado nativamente ao kubectl desde a versao 1.14**:
\`\`\`bash
kubectl apply -k <diretorio>    # Aplica usando Kustomize
kubectl kustomize <diretorio>   # Renderiza sem aplicar
\`\`\`

---

## kustomization.yaml: O Arquivo Central

Toda configuracao Kustomize e definida no arquivo \`kustomization.yaml\`. Ele lista os recursos e as transformacoes a serem aplicadas.

\`\`\`yaml
# kustomization.yaml completo com todos os campos principais
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# Recursos base (arquivos YAML ou diretorios com kustomization.yaml)
resources:
  - deployment.yaml
  - service.yaml
  - ../base          # Referencia a outro diretorio

# Prefixo/sufixo adicionado ao nome de TODOS os recursos
namePrefix: prod-
nameSuffix: -v2

# Namespace aplicado a todos os recursos (sobrescreve o existente)
namespace: producao

# Labels adicionadas a todos os recursos e seus selectors
commonLabels:
  app.kubernetes.io/managed-by: kustomize
  environment: production
  team: platform

# Annotations adicionadas a todos os recursos
commonAnnotations:
  app.kubernetes.io/version: "2.0.0"
  contact: platform@empresa.com

# Imagens: substituicao de nome/tag de imagem em todos os containers
images:
  - name: minha-api              # nome original na imagem
    newTag: v2.0.0               # nova tag
  - name: meu-registry.io/api   # tambem pode ser substituicao de registry
    newName: novo-registry.io/api
    newTag: v2.0.0

# Gerador de ConfigMaps (cria automaticamente)
configMapGenerator:
  - name: app-config
    literals:
      - APP_ENV=production
      - LOG_LEVEL=info
    files:
      - config.properties    # Conteudo do arquivo vira valor no ConfigMap
    envs:
      - app.env              # Arquivo .env -> chaves do ConfigMap

# Gerador de Secrets
secretGenerator:
  - name: db-credentials
    type: Opaque
    literals:
      - username=admin
      - password=senha-segura
    files:
      - tls.crt
      - tls.key
    options:
      disableNameSuffixHash: true   # Nao adiciona hash ao nome

# Patches (forma recomendada para modificacoes)
patches:
  # Strategic Merge Patch: merge inteligente baseado no tipo de recurso
  - path: patches/replica-patch.yaml
    target:
      kind: Deployment
      name: minha-api

  # JSON Patch: operacoes precisas (add, remove, replace, move, copy, test)
  - patch: |-
      - op: replace
        path: /spec/replicas
        value: 5
    target:
      kind: Deployment
      name: minha-api
\`\`\`

---

## Estrutura de Overlays

O padrao mais poderoso do Kustomize: uma **base** com configuracao comum e **overlays** que a personalizam por ambiente.

\`\`\`
minha-api/
├── base/
│   ├── kustomization.yaml    # Define recursos base
│   ├── deployment.yaml       # YAML limpo, sem valores de ambiente
│   ├── service.yaml
│   └── configmap.yaml
└── overlays/
    ├── dev/
    │   ├── kustomization.yaml    # Referencia base, aplica customizacoes de dev
    │   └── replica-patch.yaml    # 1 replica para dev
    ├── staging/
    │   ├── kustomization.yaml
    │   └── resources-patch.yaml  # Recursos menores para staging
    └── prod/
        ├── kustomization.yaml
        ├── replica-patch.yaml    # 5 replicas para prod
        └── resources-patch.yaml  # Recursos maiores para prod
\`\`\`

### base/kustomization.yaml

\`\`\`yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml

commonLabels:
  app: minha-api
\`\`\`

### base/deployment.yaml

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minha-api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: minha-api
  template:
    metadata:
      labels:
        app: minha-api
    spec:
      containers:
        - name: api
          image: minha-api:latest
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "200m"
              memory: "256Mi"
\`\`\`

### overlays/prod/kustomization.yaml

\`\`\`yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# Referencia a base (caminho relativo ao arquivo atual)
resources:
  - ../../base

# Customizacoes especificas de prod
namespace: producao
namePrefix: prod-

images:
  - name: minha-api
    newTag: v2.0.0

commonAnnotations:
  deployment.kubernetes.io/revision: "prod"

patches:
  - path: replica-patch.yaml
  - path: resources-patch.yaml
\`\`\`

### overlays/prod/replica-patch.yaml (Strategic Merge Patch)

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minha-api     # Identifica o recurso a ser modificado
spec:
  replicas: 5         # Sobrescreve o valor da base
\`\`\`

### overlays/prod/resources-patch.yaml

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minha-api
spec:
  template:
    spec:
      containers:
        - name: api
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
\`\`\`

---

## Tipos de Patches

### Strategic Merge Patch

Merge inteligente que entende a semantica dos recursos K8s. Listas sao mergeadas por chaves estrategicas (ex: containers por nome).

\`\`\`yaml
# Adicionar uma variavel de ambiente a um container existente
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minha-api
spec:
  template:
    spec:
      containers:
        - name: api             # Identifica o container pelo nome
          env:
            - name: FEATURE_FLAG
              value: "true"     # Adiciona sem remover as envs existentes
\`\`\`

### JSON Patch (RFC 6902)

Operacoes precisas para modificacoes cirurgicas:

\`\`\`yaml
# Exemplo inline no kustomization.yaml
patches:
  - patch: |-
      - op: replace
        path: /spec/replicas
        value: 3
      - op: add
        path: /spec/template/spec/containers/0/env/-
        value:
          name: NEW_ENV
          value: "valor"
      - op: remove
        path: /spec/template/spec/containers/0/livenessProbe
    target:
      kind: Deployment
      name: minha-api
\`\`\`

---

## Generators

### configMapGenerator

\`\`\`yaml
configMapGenerator:
  - name: app-config
    # De literais
    literals:
      - DATABASE_HOST=postgres.default.svc.cluster.local
      - DATABASE_PORT=5432
    # De arquivo (chave=nome-do-arquivo, valor=conteudo)
    files:
      - configs/nginx.conf
      - application.properties=app-custom.properties  # renomeia a chave
    options:
      # Por padrao, Kustomize adiciona hash ao nome (ex: app-config-abc123)
      # para forcar rollout de Pods ao mudar o ConfigMap
      disableNameSuffixHash: false
\`\`\`

O hash no nome do ConfigMap e uma feature poderosa: garante que quando o conteudo do ConfigMap muda, o nome muda, o Deployment referencia o novo nome, e o Kubernetes faz rollout automatico dos Pods.

---

## Comandos Essenciais

\`\`\`bash
# Renderizar o output (sem aplicar)
kubectl kustomize overlays/prod
kustomize build overlays/prod   # Se kustomize CLI instalada separadamente

# Aplicar no cluster
kubectl apply -k overlays/prod
kubectl apply -k overlays/staging

# Ver diff antes de aplicar (requer kustomize CLI)
kubectl diff -k overlays/prod

# Deletar recursos gerados pelo kustomize
kubectl delete -k overlays/prod

# Debugar output do overlay especifico
kubectl kustomize overlays/dev | kubectl apply --dry-run=client -f -
\`\`\`
`,

  quiz: [
    {
      question: 'Qual e a diferenca fundamental entre Kustomize e Helm no gerenciamento de configuracao Kubernetes?',
      options: [
        'Kustomize e mais antigo e menos capaz que o Helm',
        'Helm usa templates (Go template engine); Kustomize trabalha com YAMLs validos e aplica transformacoes declarativas sem templates',
        'Kustomize precisa de um servidor (Tiller) instalado no cluster',
        'Helm e integrado ao kubectl; Kustomize requer instalacao separada'
      ],
      correct: 1,
      explanation: 'Kustomize aplica o principio de "pure YAML": todos os arquivos sao YAMLs validos, sem sintaxe de template. As modificacoes sao aplicadas via patches e transformadores. Helm usa Go templates que podem ser dificeis de ler e debugar. Kustomize e integrado ao kubectl desde 1.14. Tiller era do Helm 2 (removido no Helm 3). Cada abordagem tem seus casos de uso.'
    },
    {
      question: 'O que acontece com o nome de um ConfigMap gerado pelo configMapGenerator quando o conteudo muda?',
      options: [
        'O nome permanece identico, apenas o conteudo e atualizado no lugar',
        'Um hash do conteudo e adicionado ao nome (ex: app-config-abc123), gerando um novo ConfigMap e forcando rollout dos Pods que o referenciam',
        'O Kustomize nao suporta atualizacao de ConfigMaps gerados',
        'O ConfigMap antigo e deletado antes do novo ser criado, causando downtime'
      ],
      correct: 1,
      explanation: 'Por padrao, o configMapGenerator adiciona um hash do conteudo ao nome do ConfigMap. Quando o conteudo muda, o hash muda, gerando um novo ConfigMap com nome diferente. O Deployment que referencia o ConfigMap precisa ser atualizado com o novo nome, o que dispara um rollout automatico dos Pods. Isso garante que Pods sempre usam o ConfigMap correto. Use disableNameSuffixHash: true para desativar.'
    },
    {
      question: 'Como o namePrefix: prod- afeta os recursos em um overlay de producao?',
      options: [
        'Adiciona "prod-" apenas ao namespace dos recursos',
        'Adiciona "prod-" ao inicio do nome de TODOS os recursos gerenciados pelo kustomization.yaml',
        'Cria um namespace chamado "prod-" automaticamente',
        'Afeta apenas os recursos do tipo Deployment'
      ],
      correct: 1,
      explanation: 'namePrefix adiciona o prefixo ao campo metadata.name de TODOS os recursos listados no kustomization.yaml (e recursivamente nos recursos referenciados). Tambem atualiza automaticamente referencias entre recursos (ex: selector do Service, volumeClaimTemplates, etc.). Com namePrefix: prod-, um Deployment chamado "api" se torna "prod-api". nameSuffix funciona de forma analoga mas adiciona ao final.'
    },
    {
      question: 'Qual a diferenca entre Strategic Merge Patch e JSON Patch no Kustomize?',
      options: [
        'Strategic Merge Patch e para Deployments; JSON Patch e para outros recursos',
        'Strategic Merge Patch entende a semantica K8s (merge inteligente de listas por chave); JSON Patch usa operacoes RFC 6902 (add/remove/replace) para modificacoes cirurgicas precisas',
        'JSON Patch e mais lento e nao recomendado',
        'Sao identicos, apenas sintaxes diferentes'
      ],
      correct: 1,
      explanation: 'Strategic Merge Patch conhece a estrutura dos recursos K8s: ao adicionar um container a uma lista, ele faz merge por nome (nao substitui a lista inteira). JSON Patch (RFC 6902) usa operacoes explicitas (op: add/remove/replace/move/copy/test) para modificacoes precisas em caminhos especificos. Strategic Merge Patch e mais legivel; JSON Patch e mais preciso para casos como remover um campo especifico ou modificar um elemento especifico de uma lista.'
    },
    {
      question: 'Em um overlay Kustomize, como voce referencia o diretorio base?',
      options: [
        'Com a chave "base:" no kustomization.yaml',
        'Listando o caminho na secao "resources:" (ex: resources: - ../../base)',
        'Com a chave "extends:" apontando para o diretorio base',
        'Usando "import:" com o caminho relativo'
      ],
      correct: 1,
      explanation: 'No Kustomize, a referencia ao diretorio base e feita simplesmente listando o caminho (relativo ou absoluto) na secao "resources:". O Kustomize detecta que o caminho aponta para um diretorio com kustomization.yaml e processa recursivamente. Nao existe chave especial "base:" ou "extends:". Um overlay pode referenciar multiplas bases e recursos da mesma forma.'
    },
    {
      question: 'Qual e o efeito do campo "images:" no kustomization.yaml?',
      options: [
        'Faz pull das imagens listadas para o cluster',
        'Substitui o nome e/ou tag das imagens em TODOS os containers de TODOS os recursos gerenciados, sem precisar modificar cada arquivo YAML individualmente',
        'Define quais imagens sao permitidas no cluster',
        'Cria um Secret do tipo docker-registry automaticamente'
      ],
      correct: 1,
      explanation: 'O campo "images:" e um transformer do Kustomize que busca e substitui referencias de imagens em todos os recursos gerenciados. Pode trocar nome do repositorio (newName), tag (newTag) ou ambos. Util para: trocar a tag de imagem no overlay de prod sem modificar a base, mudar de um registry para outro, fixar tags especificas por ambiente. O Kustomize busca em spec.containers[*].image, spec.initContainers[*].image e outros campos de imagem.'
    },
    {
      question: 'Qual comando aplica uma configuracao Kustomize no cluster?',
      options: [
        'kubectl apply --kustomize overlays/prod',
        'kubectl apply -k overlays/prod',
        'kustomize apply overlays/prod',
        'kubectl kustomize apply overlays/prod'
      ],
      correct: 1,
      explanation: '"kubectl apply -k <diretorio>" e o comando correto e integrado ao kubectl. A flag "-k" indica para processar o diretorio como uma configuracao Kustomize. "kubectl kustomize <diretorio>" apenas renderiza o YAML sem aplicar (equivalente a kustomize build). "kustomize build | kubectl apply -f -" tambem funciona se a CLI kustomize estiver instalada separadamente.'
    },
    {
      question: 'Como visualizar o YAML final que seria aplicado por um overlay Kustomize SEM aplicar no cluster?',
      options: [
        'kubectl apply -k overlays/prod --dry-run=server',
        'kubectl kustomize overlays/prod',
        'kubectl diff -k overlays/prod',
        'kubectl get -k overlays/prod'
      ],
      correct: 1,
      explanation: '"kubectl kustomize <diretorio>" (ou "kustomize build <diretorio>") renderiza o YAML final com todas as transformacoes aplicadas, sem tocar no cluster. Ideal para revisar o output antes de aplicar. "kubectl apply -k --dry-run=server" valida contra a API do cluster mas nao faz alteracoes. "kubectl diff -k" mostra a diferenca entre o estado atual do cluster e o que seria aplicado — util para verificar o impacto de uma mudanca antes do deploy.'
    },
    {
      question: 'Voce precisa adicionar uma annotation a todos os recursos de um overlay sem modificar a base. Qual campo do kustomization.yaml usar?',
      options: [
        'metadata.annotations no kustomization.yaml diretamente',
        'commonAnnotations: com os pares chave-valor desejados',
        'patches: com um Strategic Merge Patch adicionando annotations em cada recurso',
        'transformers: com uma lista de annotation-transformers'
      ],
      correct: 1,
      explanation: '"commonAnnotations" no kustomization.yaml adiciona as annotations especificadas em metadata.annotations de TODOS os recursos gerenciados. Exemplo: commonAnnotations: app.kubernetes.io/managed-by: kustomize. Diferentemente de "commonLabels" (que tambem afeta selectors), "commonAnnotations" so modifica metadata.annotations, sendo seguro de aplicar a qualquer momento sem risco de imutabilidade de selectors. Util para adicionar annotations de rastreabilidade (ex: versao de commit, ambiente).'
    },
    {
      question: 'O que o campo "secretGenerator" faz de diferente em relacao ao "configMapGenerator" no Kustomize?',
      options: [
        'secretGenerator cria Secrets codificados em base64 automaticamente; configMapGenerator cria ConfigMaps com dados em texto plano',
        'secretGenerator nao tem diferenca funcional; ambos geram recursos com hash no nome',
        'secretGenerator requer um arquivo .env; configMapGenerator pode usar literals',
        'secretGenerator cria Secrets do tipo Opaque; configMapGenerator cria apenas ConfigMaps genericos'
      ],
      correct: 0,
      explanation: 'O Kustomize "secretGenerator" cria Secrets Kubernetes onde os valores sao automaticamente codificados em base64 (como exigido pelo tipo Secret). O "configMapGenerator" cria ConfigMaps com dados em texto plano. Ambos suportam as mesmas fontes: literals (chave=valor), files (arquivos), env (arquivo .env). Ambos adicionam hash no nome por padrao. Importante: nunca commite arquivos de valores de Secret no repositorio; use ferramentas como Sealed Secrets, Vault, ou External Secrets para gerencia-los.'
    },
    {
      question: 'Voce tem um overlay "prod" que precisa mudar apenas o numero de replicas do Deployment da base de 1 para 5. Como fazer isso com o menor arquivo de patch possivel?',
      options: [
        'Copiar o Deployment completo da base para o overlay e alterar replicas: 5',
        'Criar um arquivo de patch com apenas apiVersion, kind, metadata.name e spec.replicas: 5 e referenciar em patches: no kustomization.yaml do overlay',
        'Usar o campo replicas: no kustomization.yaml diretamente (nao suportado)',
        'Usar o campo scale: no kustomization.yaml do overlay'
      ],
      correct: 1,
      explanation: 'Com Strategic Merge Patch, voce cria um YAML minimo com apenas os campos necessarios para identificar o recurso (apiVersion, kind, metadata.name) e os campos a modificar (spec.replicas: 5). O Kustomize faz o merge com a base, resultando no Deployment completo com replicas alteradas. Exemplo: "apiVersion: apps/v1\\nkind: Deployment\\nmetadata:\\n  name: minha-api\\nspec:\\n  replicas: 5". Kustomize 4.1+ tambem suporta o campo "replicas:" no kustomization.yaml para este caso especifico.'
    },
    {
      question: 'Como o Kustomize lida com recursos referenciados em multiplos overlays que herdam da mesma base?',
      options: [
        'Causa erro de conflito quando dois overlays referenciam a mesma base',
        'Cada overlay processa a base de forma independente; nao ha estado compartilhado entre overlays',
        'O ultimo overlay a ser aplicado sobrescreve as configuracoes dos anteriores na base',
        'Os overlays sao mesclados automaticamente numa configuracao final'
      ],
      correct: 1,
      explanation: 'Cada overlay e completamente independente: quando voce executa "kubectl apply -k overlays/prod", o Kustomize processa APENAS aquele overlay e sua base. Nao ha estado compartilhado ou interacao entre overlays diferentes. Voce pode ter overlays/dev, overlays/staging e overlays/prod, todos herdando da mesma base, e cada um produz sua propria versao independente dos recursos. Isso e o que torna o modelo base+overlays poderoso: isolamento total por ambiente com reaproveitamento de configuracao base.'
    }
  ],

  flashcards: [
    {
      front: 'O que e o arquivo kustomization.yaml e quais sao seus campos principais?',
      back: 'kustomization.yaml e o arquivo central do Kustomize que define recursos e transformacoes. Campos principais: resources (lista de YAMLs ou diretorios), namePrefix/nameSuffix (prefixo/sufixo no nome de todos os recursos), namespace (namespace para todos os recursos), commonLabels/commonAnnotations (labels/annotations em todos os recursos), images (substituicao de imagens), patches (Strategic Merge ou JSON), configMapGenerator/secretGenerator (geradores).'
    },
    {
      front: 'Como funciona o padrao base + overlays no Kustomize?',
      back: 'Base: diretorio com os manifestos "puros" sem valores de ambiente especificos. Overlays: um diretorio por ambiente (dev/staging/prod) com um kustomization.yaml que referencia a base em resources: [../../base] e adiciona customizacoes especificas (replicas, resources, imagens, namespace, patches). A base e valida por si so; overlays so contem o diff. Aplicacao: kubectl apply -k overlays/prod.'
    },
    {
      front: 'Para que serve o hash adicionado automaticamente pelo configMapGenerator?',
      back: 'Quando o conteudo de um ConfigMap ou Secret gerado muda, o hash no nome muda (ex: config-abc123 -> config-def456). Isso forca o Kubernetes a atualizar as referencias nos Deployments (que referenciam o ConfigMap pelo nome), disparando automaticamente um rollout dos Pods. Sem o hash, mudar o ConfigMap nao causaria rollout e os Pods continuariam com os valores antigos. Use disableNameSuffixHash: true apenas quando necessario (ex: ConfigMaps referenciados por nome fixo).'
    },
    {
      front: 'Qual a diferenca entre commonLabels e commonAnnotations no Kustomize?',
      back: 'commonLabels: adiciona labels em metadata.labels de todos os recursos E tambem nos selectors (spec.selector, spec.template.metadata.labels). Cuidado: modificar commonLabels em um Deployment ja existente pode causar erro pois selectors sao imutaveis. commonAnnotations: adiciona apenas em metadata.annotations, nao afeta selectors. Seguro de modificar a qualquer momento. Ambos sao aplicados a todos os recursos definidos no kustomization.yaml.'
    },
    {
      front: 'Como fazer uma substituicao de imagem em um overlay sem modificar a base?',
      back: 'Use o campo "images:" no kustomization.yaml do overlay: images: - name: minha-api (nome exato como aparece na base) newTag: v2.0.0. O Kustomize substitui a tag em todos os containers de todos os recursos que usam aquela imagem. Para trocar o registry: newName: novo-registry.io/minha-api. Pode combinar newName e newTag. Este e o mecanismo principal para parametrizar versoes de imagem por ambiente.'
    },
    {
      front: 'Como referenciar um diretorio base em um overlay Kustomize?',
      back: 'Na secao resources: do kustomization.yaml do overlay, liste o caminho relativo para o diretorio base: resources: - ../../base. O Kustomize detecta que e um diretorio com kustomization.yaml e processa recursivamente. Pode referenciar multiplas bases: resources: - ../../base - outros-recursos.yaml - https://github.com/org/repo/base. URLs do GitHub tambem sao suportadas para bases remotas.'
    },
    {
      front: 'Quais sao os dois tipos de patch suportados pelo Kustomize e quando usar cada um?',
      back: 'Strategic Merge Patch: arquivo YAML parcial com a mesma estrutura do recurso. Kustomize faz merge inteligente: para listas de containers, faz merge por nome (nao substitui). Mais legivel, recomendado para a maioria dos casos. JSON Patch (RFC 6902): operacoes explicitas (op: add/remove/replace) em caminhos especificos do JSON. Use quando precisa remover um campo, modificar um elemento especifico de uma lista por indice, ou fazer operacoes que o strategic merge nao suporta bem.'
    }
  ],

  lab: {
    scenario: 'A equipe precisa gerenciar a aplicacao "minha-api" em tres ambientes (dev, staging, prod) com configuracoes diferentes de replicas, recursos e imagens. A abordagem deve ser DRY (Don\'t Repeat Yourself): definir os manifestos base uma vez e customizar por overlay.',
    objective: 'Criar a estrutura base + overlays com Kustomize, aplicar patches especificos por ambiente, usar configMapGenerator e images transformer, e validar os outputs antes de aplicar.',
    steps: [
      {
        title: 'Criar estrutura base',
        instruction: `Crie a estrutura de diretorios e os arquivos base para a aplicacao. A base deve conter um Deployment com 1 replica, um Service ClusterIP, e um ConfigMap com variaveis de configuracao. Os valores de base devem ser os minimos necessarios.`,
        hints: [
          'Crie os diretorios: base/, overlays/dev/, overlays/staging/, overlays/prod/',
          'O kustomization.yaml da base lista os recursos: deployment.yaml, service.yaml',
          'Mantenha o YAML da base limpo: sem valores de ambiente especificos',
          'kubectl kustomize base/ para validar que a base renderiza corretamente'
        ],
        solution: `\`\`\`bash
# Criar estrutura de diretorios
mkdir -p base overlays/dev overlays/staging overlays/prod
\`\`\`

\`\`\`yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml

configMapGenerator:
  - name: app-config
    literals:
      - APP_ENV=base
      - LOG_LEVEL=debug

commonLabels:
  app: minha-api
\`\`\`

\`\`\`yaml
# base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minha-api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: minha-api
  template:
    metadata:
      labels:
        app: minha-api
    spec:
      containers:
        - name: api
          image: nginx:1.24-alpine
          ports:
            - containerPort: 80
          envFrom:
            - configMapRef:
                name: app-config
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "200m"
              memory: "256Mi"
\`\`\`

\`\`\`yaml
# base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: minha-api
spec:
  selector:
    app: minha-api
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP
\`\`\`

\`\`\`bash
# Validar que a base renderiza corretamente
kubectl kustomize base/

# Deve mostrar: Deployment, Service, e ConfigMap com hash no nome
\`\`\``
      },
      {
        title: 'Criar overlays para cada ambiente',
        instruction: `Crie os overlays de dev (1 replica, imagem latest), staging (2 replicas, imagem v1.9.0) e prod (5 replicas, imagem v2.0.0, recursos maiores, namespace producao). Cada overlay deve referenciar a base e aplicar apenas as diferencas.`,
        hints: [
          'Use "resources: - ../../base" para referenciar a base',
          'O campo "images:" substitui a imagem sem tocar no deployment.yaml da base',
          'Para prod, use um patch separado para os recursos (requests/limits)',
          'kubectl kustomize overlays/prod/ > prod-output.yaml para inspecionar'
        ],
        solution: `\`\`\`yaml
# overlays/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namespace: development

images:
  - name: nginx
    newTag: 1.24-alpine

configMapGenerator:
  - name: app-config
    behavior: merge    # merge com o configMapGenerator da base
    literals:
      - APP_ENV=development
      - DEBUG=true
\`\`\`

\`\`\`yaml
# overlays/staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namespace: staging
namePrefix: staging-

images:
  - name: nginx
    newTag: 1.25-alpine

patches:
  - patch: |-
      - op: replace
        path: /spec/replicas
        value: 2
    target:
      kind: Deployment
      name: minha-api

configMapGenerator:
  - name: app-config
    behavior: merge
    literals:
      - APP_ENV=staging
      - LOG_LEVEL=info
\`\`\`

\`\`\`yaml
# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namespace: producao
namePrefix: prod-

commonAnnotations:
  deployment.kubernetes.io/environment: production

images:
  - name: nginx
    newTag: 1.25-alpine

patches:
  - path: replica-patch.yaml
  - path: resources-patch.yaml

configMapGenerator:
  - name: app-config
    behavior: merge
    literals:
      - APP_ENV=production
      - LOG_LEVEL=warn
\`\`\`

\`\`\`yaml
# overlays/prod/replica-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minha-api
spec:
  replicas: 5
\`\`\`

\`\`\`yaml
# overlays/prod/resources-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minha-api
spec:
  template:
    spec:
      containers:
        - name: api
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
\`\`\`

\`\`\`bash
# Inspecionar output de cada overlay
kubectl kustomize overlays/dev/
kubectl kustomize overlays/staging/
kubectl kustomize overlays/prod/

# Comparar replicas entre overlays
kubectl kustomize overlays/dev/ | grep "replicas:"
kubectl kustomize overlays/staging/ | grep "replicas:"
kubectl kustomize overlays/prod/ | grep "replicas:"

# Verificar substituicao de imagem
kubectl kustomize overlays/prod/ | grep "image:"
\`\`\``
      },
      {
        title: 'Aplicar overlays e verificar resultado no cluster',
        instruction: `Aplique os overlays no cluster, verifique que os recursos foram criados com os valores corretos em cada namespace, e teste a substituicao de imagem usando o campo images: para "deployar" uma nova versao sem tocar na base.`,
        hints: [
          'Crie os namespaces antes de aplicar ou use --create-namespace equivalente do kubectl apply -k',
          'kubectl apply -k e idempotente: pode ser executado multiplas vezes',
          'kubectl get all -n producao verifica os recursos criados',
          'kubectl diff -k overlays/prod/ mostra o que mudaria antes de aplicar'
        ],
        solution: `\`\`\`bash
# Criar namespaces
kubectl create namespace development --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace staging --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace producao --dry-run=client -o yaml | kubectl apply -f -

# Aplicar overlay de dev
kubectl apply -k overlays/dev/
kubectl get all -n development
kubectl get configmap -n development

# Aplicar overlay de staging
kubectl apply -k overlays/staging/
kubectl get all -n staging

# Verificar que o namePrefix foi aplicado
kubectl get deployment -n staging

# Aplicar overlay de prod
kubectl apply -k overlays/prod/
kubectl get all -n producao

# Verificar replicas em cada ambiente
kubectl get deployment -n development minha-api -o jsonpath='{.spec.replicas}'
kubectl get deployment -n staging staging-minha-api -o jsonpath='{.spec.replicas}'
kubectl get deployment -n producao prod-minha-api -o jsonpath='{.spec.replicas}'

# Simular "deploy" de nova versao em prod (sem tocar na base)
# Edite overlays/prod/kustomization.yaml, mude newTag para 1.26-alpine
# Entao re-aplique:
kubectl diff -k overlays/prod/   # Ver o que vai mudar
kubectl apply -k overlays/prod/  # Aplicar a mudanca

# Verificar rollout
kubectl rollout status deployment/prod-minha-api -n producao

# Limpar tudo
kubectl delete -k overlays/dev/
kubectl delete -k overlays/staging/
kubectl delete -k overlays/prod/
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'kubectl apply -k falha com "no matches for kind" ou "resource mapping not found"',
      symptom: 'Ao executar "kubectl apply -k overlays/prod/", o comando falha com erros como: "no matches for kind Deployment in version apps/v1beta1" ou "error: resource mapping not found for name: ... resource: ... from kustomization".',
      diagnosis: `**Passo 1: Verificar a versao da API usada nos manifestos**
\`\`\`bash
# Ver o output renderizado pelo Kustomize
kubectl kustomize overlays/prod/

# Verificar se ha APIs depreciadas no output
kubectl kustomize overlays/prod/ | grep "apiVersion:"
\`\`\`

**Passo 2: Verificar APIs disponiveis no cluster**
\`\`\`bash
kubectl api-resources | grep deployment
kubectl api-versions | grep apps
# Deployments devem usar apps/v1 (estavel desde K8s 1.9)
\`\`\`

**Passo 3: Verificar erros de sintaxe no kustomization.yaml**
\`\`\`bash
# Renderizar com verbosidade maxima
kubectl kustomize overlays/prod/ 2>&1

# Verificar indentacao e sintaxe YAML
python3 -c "import yaml; yaml.safe_load(open('overlays/prod/kustomization.yaml'))"
\`\`\`

**Passo 4: Verificar que os caminhos nos patches estao corretos**
\`\`\`bash
# O target.name deve corresponder ao nome do recurso NA BASE (antes do namePrefix)
kubectl kustomize base/ | grep "name:"
# Compare com os valores em patches[*].target.name no kustomization.yaml do overlay
\`\`\``,
      solution: `**Causa: API depreciada nos manifestos base**
\`\`\`bash
# Atualizar o apiVersion nos manifestos
# Substituir apps/v1beta1 por apps/v1 (Deployments, ReplicaSets)
# Substituir extensions/v1beta1 por networking.k8s.io/v1 (Ingress)

# Verificar quais arquivos precisam de atualizacao
grep -r "v1beta1" base/
\`\`\`

**Causa: target.name no patch nao corresponde ao nome do recurso na base**
\`\`\`yaml
# ERRADO: usando o nome com prefixo no target
patches:
  - path: replica-patch.yaml
    target:
      kind: Deployment
      name: prod-minha-api    # ERRADO: namePrefix e aplicado depois

# CORRETO: usar o nome original da base
patches:
  - path: replica-patch.yaml
    target:
      kind: Deployment
      name: minha-api         # CORRETO: Kustomize aplica o prefixo automaticamente
\`\`\`

**Causa: Estrutura de diretorios incorreta**
\`\`\`bash
# Verificar que o arquivo kustomization.yaml existe no diretorio
ls overlays/prod/
# Deve conter: kustomization.yaml

# Verificar que os recursos referenciados existem
ls base/
# Deve conter os arquivos listados em resources: do kustomization.yaml da base

# Testar o caminho relativo manualmente
kubectl kustomize base/    # Deve funcionar primeiro
kubectl kustomize overlays/prod/  # Depois testar o overlay
\`\`\``
    }
  ]
};
