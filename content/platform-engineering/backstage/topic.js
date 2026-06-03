window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['platform-engineering/backstage'] = {
  theory: `
# Backstage Developer Portal

## Relevancia
Backstage e a plataforma open-source criada pelo Spotify para construir developer portals. Doada a CNCF (incubating project), e o padrao de facto para a camada de interface de um IDP. Centraliza catalogo de servicos, templates, documentacao e plugins em um unico portal.

## Conceitos Fundamentais

### O que e Backstage?

Backstage e um framework para construir developer portals. Nao e uma solucao pronta — e uma plataforma extensivel que voce customiza para sua organizacao:

\`\`\`
┌─────────────────────────────────────────────┐
│              Backstage Portal               │
├──────────┬──────────┬──────────┬────────────┤
│ Software │ Software │ TechDocs │  Plugins   │
│ Catalog  │ Templates│          │            │
├──────────┴──────────┴──────────┴────────────┤
│              Plugin Architecture            │
├─────────────────────────────────────────────┤
│           Backstage Core (React)            │
└─────────────────────────────────────────────┘
\`\`\`

### Pilares do Backstage

1. **Software Catalog** — inventario centralizado de todos os servicos, APIs, recursos e equipes
2. **Software Templates (Scaffolder)** — criacao de novos projetos via templates padronizados
3. **TechDocs** — documentacao tecnica como codigo (docs-as-code)
4. **Plugins** — extensoes para integrar ferramentas (Kubernetes, ArgoCD, PagerDuty, etc.)

### Software Catalog

O Software Catalog e o coracao do Backstage. Registra e organiza todos os componentes do ecossistema:

\`\`\`yaml
# catalog-info.yaml — na raiz de cada repositorio
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payment-service
  description: Servico de processamento de pagamentos
  annotations:
    backstage.io/techdocs-ref: dir:.
    github.com/project-slug: org/payment-service
    argocd/app-name: payment-service
  tags:
    - java
    - spring-boot
    - payments
  links:
    - url: https://grafana.internal/d/payment
      title: Dashboard Grafana
      icon: dashboard
spec:
  type: service
  lifecycle: production
  owner: team-payments
  system: checkout
  providesApis:
    - payment-api
  consumesApis:
    - user-api
    - notification-api
  dependsOn:
    - resource:payments-db
    - component:auth-service
\`\`\`

#### Tipos de Entidades do Catalog

\`\`\`
┌─────────────┬──────────────────────────────┐
│ Kind        │ Descricao                    │
├─────────────┼──────────────────────────────┤
│ Component   │ Software (servico, lib, CLI) │
│ API         │ Interface (REST, gRPC, etc)  │
│ Resource    │ Infra (DB, S3, queue)        │
│ System      │ Agrupamento de components    │
│ Domain      │ Area de negocio              │
│ Group       │ Equipe / time                │
│ User        │ Pessoa                       │
│ Location    │ Origem de entidades          │
│ Template    │ Template do Scaffolder       │
└─────────────┴──────────────────────────────┘
\`\`\`

#### Relacionamentos

\`\`\`yaml
# Relacionamentos entre entidades
spec:
  owner: group:team-payments       # quem e dono
  system: checkout                 # a que sistema pertence
  providesApis:                    # APIs que expoe
    - payment-api
  consumesApis:                    # APIs que consome
    - user-api
  dependsOn:                       # dependencias
    - resource:payments-db
    - component:auth-service
  subcomponentOf: platform         # hierarquia
\`\`\`

### Software Templates (Scaffolder)

O Scaffolder permite criar novos projetos a partir de templates padronizados:

\`\`\`yaml
# template.yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: microservice-template
  title: Criar Microservico
  description: Template padrao para novo microservico com CI/CD
  tags:
    - recommended
    - microservice
spec:
  owner: platform-team
  type: service

  parameters:
    - title: Informacoes do Servico
      required:
        - name
        - owner
      properties:
        name:
          title: Nome do Servico
          type: string
          pattern: '^[a-z][a-z0-9-]*\$'
        owner:
          title: Equipe Dona
          type: string
          ui:field: OwnerPicker
          ui:options:
            catalogFilter:
              kind: Group
        description:
          title: Descricao
          type: string

    - title: Configuracoes Tecnicas
      properties:
        language:
          title: Linguagem
          type: string
          enum: ['go', 'java', 'python', 'nodejs']
          default: go
        database:
          title: Precisa de banco de dados?
          type: boolean
          default: false

  steps:
    - id: fetch-skeleton
      name: Gerar Codigo
      action: fetch:template
      input:
        url: ./skeleton
        values:
          name: \${{ parameters.name }}
          owner: \${{ parameters.owner }}
          language: \${{ parameters.language }}

    - id: create-repo
      name: Criar Repositorio
      action: publish:github
      input:
        repoUrl: github.com?owner=org&repo=\${{ parameters.name }}
        description: \${{ parameters.description }}
        defaultBranch: main

    - id: register-catalog
      name: Registrar no Catalogo
      action: catalog:register
      input:
        repoContentsUrl: \${{ steps['create-repo'].output.repoContentsUrl }}
        catalogInfoPath: /catalog-info.yaml

    - id: create-argocd-app
      name: Criar App no ArgoCD
      action: argocd:create-application
      input:
        appName: \${{ parameters.name }}
        repoUrl: \${{ steps['create-repo'].output.remoteUrl }}

  output:
    links:
      - title: Repositorio
        url: \${{ steps['create-repo'].output.remoteUrl }}
      - title: Abrir no Catalogo
        entityRef: \${{ steps['register-catalog'].output.entityRef }}
\`\`\`

### TechDocs — Documentacao como Codigo

TechDocs usa MkDocs para gerar documentacao a partir de markdown no repositorio:

\`\`\`yaml
# mkdocs.yml — na raiz do repositorio
site_name: Payment Service
nav:
  - Home: index.md
  - Architecture: architecture.md
  - API Reference: api.md
  - Runbook: runbook.md

plugins:
  - techdocs-core
\`\`\`

\`\`\`
# Estrutura no repositorio
repo/
  docs/
    index.md
    architecture.md
    api.md
    runbook.md
  mkdocs.yml
  catalog-info.yaml    # com annotation backstage.io/techdocs-ref
\`\`\`

### Arquitetura do Backstage

\`\`\`
┌──────────────────────────────────────┐
│          Frontend (React App)        │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │Catalog │ │Scaffold│ │TechDocs│  │
│  │Plugin  │ │Plugin  │ │Plugin  │  │
│  └────┬───┘ └────┬───┘ └────┬───┘  │
├───────┼──────────┼──────────┼───────┤
│       │  Backend (Node.js)  │       │
│  ┌────┴───┐ ┌────┴───┐ ┌───┴────┐ │
│  │Catalog │ │Scaffold│ │TechDocs│ │
│  │Backend │ │Backend │ │Backend │ │
│  └────┬───┘ └────┬───┘ └────┬───┘ │
├───────┼──────────┼──────────┼──────┤
│       ▼          ▼          ▼      │
│            PostgreSQL DB           │
└──────────────────────────────────────┘
\`\`\`

**Requisitos de infraestrutura:**
- Node.js 18+
- PostgreSQL (catalogo e estado)
- Armazenamento para TechDocs (S3, GCS ou local)
- Autenticacao (GitHub, Google, Okta, etc.)

### Deploy do Backstage no Kubernetes

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backstage
  namespace: backstage
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backstage
  template:
    metadata:
      labels:
        app: backstage
    spec:
      containers:
        - name: backstage
          image: backstage-custom:latest
          ports:
            - containerPort: 7007
          envFrom:
            - secretRef:
                name: backstage-secrets
          env:
            - name: POSTGRES_HOST
              value: backstage-db
            - name: POSTGRES_PORT
              value: "5432"
          readinessProbe:
            httpGet:
              path: /healthcheck
              port: 7007
          livenessProbe:
            httpGet:
              path: /healthcheck
              port: 7007
---
apiVersion: v1
kind: Service
metadata:
  name: backstage
  namespace: backstage
spec:
  selector:
    app: backstage
  ports:
    - port: 80
      targetPort: 7007
\`\`\`

### Plugins Essenciais

| Plugin | Funcao |
|--------|--------|
| @backstage/plugin-catalog | Catalogo de software |
| @backstage/plugin-scaffolder | Templates e criacao de projetos |
| @backstage/plugin-techdocs | Documentacao como codigo |
| @backstage/plugin-kubernetes | Visualizar workloads K8s |
| @backstage/plugin-github-actions | Status de CI/CD |
| @roadiehq/backstage-plugin-argo-cd | Integracao ArgoCD |
| @backstage/plugin-api-docs | Documentacao de APIs (OpenAPI) |
| @pagerduty/backstage-plugin | Integracao PagerDuty |
| @backstage/plugin-search | Busca unificada no portal |
| @backstage/plugin-cost-insights | Custos de cloud |

### app-config.yaml — Configuracao Principal

\`\`\`yaml
app:
  title: Minha Plataforma
  baseUrl: http://localhost:3000

backend:
  baseUrl: http://localhost:7007
  database:
    client: pg
    connection:
      host: localhost
      port: 5432
      user: backstage
      password: \${POSTGRES_PASSWORD}

integrations:
  github:
    - host: github.com
      token: \${GITHUB_TOKEN}

catalog:
  locations:
    - type: url
      target: https://github.com/org/*/blob/main/catalog-info.yaml
    - type: file
      target: ../templates/all-templates.yaml

  providers:
    github:
      myOrg:
        organization: my-org
        catalogPath: /catalog-info.yaml
        schedule:
          frequency: { minutes: 30 }
          timeout: { minutes: 3 }

techdocs:
  builder: external
  publisher:
    type: awsS3
    awsS3:
      bucketName: my-techdocs-bucket

auth:
  providers:
    github:
      development:
        clientId: \${GITHUB_CLIENT_ID}
        clientSecret: \${GITHUB_CLIENT_SECRET}
\`\`\`

### Erros Comuns

1. **Nao registrar catalog-info.yaml** — servicos ficam invisiveis no portal
2. **Templates sem validacao** — scaffolder cria projetos malformados
3. **TechDocs desatualizados** — docs no portal divergem do codigo
4. **Sem ownership** — entidades sem owner definido dificultam responsabilidade
5. **Plugins demais** — instalar tudo disponivel ao inves de focar no que agrega valor
6. **Nao configurar autodiscovery** — depender de registro manual quando pode ser automatico

## Killer.sh Style Challenge

> **Cenario:** Configure o Backstage com: (1) catalog-info.yaml para um servico Go com 2 APIs, (2) template do Scaffolder para criar novos microservicos, (3) integracao com Kubernetes plugin para visualizar pods do servico.
`,
  quiz: [
    {
      question: 'Qual arquivo deve existir na raiz de cada repositorio para registrar um servico no Backstage Catalog?',
      options: [
        'backstage.yaml',
        'catalog-info.yaml',
        'service.json',
        '.backstage/config.yaml'
      ],
      correct: 1,
      explanation: 'O arquivo catalog-info.yaml na raiz do repositorio descreve o componente (kind: Component) com metadata, spec, owner e relacionamentos. E o padrao do Backstage para registro de entidades.',
      reference: 'Conceito relacionado: O Backstage pode fazer autodiscovery varrendo repositorios em busca desse arquivo.'
    },
    {
      question: 'Quais sao os 4 pilares principais do Backstage?',
      options: [
        'CI/CD, Monitoring, Logging, Tracing',
        'Software Catalog, Software Templates (Scaffolder), TechDocs, Plugins',
        'Git, Docker, Kubernetes, Helm',
        'Frontend, Backend, Database, Cache'
      ],
      correct: 1,
      explanation: 'Os 4 pilares sao: Software Catalog (inventario de servicos), Software Templates/Scaffolder (criacao de projetos), TechDocs (documentacao como codigo) e Plugins (extensoes para integracoes).',
      reference: 'Conceito relacionado: Cada pilar e independente — voce pode adotar incrementalmente.'
    },
    {
      question: 'O que e o Scaffolder no Backstage?',
      options: [
        'Um sistema de monitoramento',
        'O motor de templates que permite criar novos projetos padronizados via formularios no portal',
        'Um plugin de seguranca',
        'O sistema de busca do portal'
      ],
      correct: 1,
      explanation: 'O Scaffolder (Software Templates) permite criar novos projetos via formularios. Um template define parametros, steps (gerar codigo, criar repo, registrar no catalogo) e outputs.',
      reference: 'Conceito relacionado: Templates usam apiVersion scaffolder.backstage.io/v1beta3 com steps declarativos.'
    },
    {
      question: 'Qual a tecnologia que o TechDocs usa para gerar documentacao?',
      options: [
        'Docusaurus',
        'MkDocs',
        'Sphinx',
        'GitBook'
      ],
      correct: 1,
      explanation: 'TechDocs usa MkDocs com o plugin techdocs-core. A documentacao e escrita em Markdown no repositorio e renderizada automaticamente no portal Backstage.',
      reference: 'Conceito relacionado: O arquivo mkdocs.yml na raiz do repo configura a navegacao e plugins.'
    },
    {
      question: 'Quais Kinds de entidade o Backstage Catalog suporta?',
      options: [
        'Apenas Component e API',
        'Component, API, Resource, System, Domain, Group, User, Location, Template',
        'Service, Database, Queue, Cache',
        'Pod, Deployment, Service, Ingress'
      ],
      correct: 1,
      explanation: 'O Backstage Catalog suporta 9 Kinds: Component (software), API (interfaces), Resource (infra), System (agrupamento), Domain (area de negocio), Group (equipe), User (pessoa), Location (origem) e Template.',
      reference: 'Conceito relacionado: Entidades se relacionam via spec.owner, spec.system, spec.dependsOn, etc.'
    },
    {
      question: 'Qual annotation no catalog-info.yaml habilita o TechDocs para um componente?',
      options: [
        'backstage.io/docs-ref',
        'backstage.io/techdocs-ref: dir:.',
        'techdocs.backstage.io/enabled: true',
        'docs.backstage.io/path: ./docs'
      ],
      correct: 1,
      explanation: 'A annotation backstage.io/techdocs-ref: dir:. indica ao TechDocs que a documentacao (mkdocs.yml + docs/) esta na raiz do repositorio do componente.',
      reference: 'Conceito relacionado: O builder pode ser "local" (Backstage gera) ou "external" (CI gera e envia para storage).'
    },
    {
      question: 'Qual banco de dados o Backstage usa em producao?',
      options: [
        'MongoDB',
        'PostgreSQL',
        'SQLite',
        'MySQL'
      ],
      correct: 1,
      explanation: 'O Backstage usa PostgreSQL em producao para armazenar o catalogo, estado do scaffolder e dados de plugins. SQLite pode ser usado em desenvolvimento local.',
      reference: 'Conceito relacionado: Configurado em app-config.yaml na secao backend.database.'
    }
  ],
  flashcards: [
    {
      front: 'O que e o catalog-info.yaml e onde fica?',
      back: '**catalog-info.yaml** e o arquivo que registra um componente no Backstage Catalog.\n\n**Localizacao:** raiz do repositorio do servico.\n\n**Conteudo minimo:**\n- apiVersion: backstage.io/v1alpha1\n- kind: Component\n- metadata: name, description, annotations\n- spec: type, lifecycle, owner\n\n**Annotations importantes:**\n- backstage.io/techdocs-ref (docs)\n- github.com/project-slug (GitHub)\n- argocd/app-name (ArgoCD)'
    },
    {
      front: 'Quais sao os 9 Kinds de entidade do Backstage Catalog?',
      back: '1. **Component** — software (servico, lib, CLI)\n2. **API** — interface (REST, gRPC, GraphQL)\n3. **Resource** — infra (DB, S3, queue, topic)\n4. **System** — agrupamento logico de components\n5. **Domain** — area de negocio\n6. **Group** — equipe/time\n7. **User** — pessoa individual\n8. **Location** — URL/path de origem de entidades\n9. **Template** — template do Scaffolder\n\nRelacionamentos: owner, system, dependsOn, providesApis, consumesApis'
    },
    {
      front: 'Como funciona o Scaffolder (Software Templates)?',
      back: '**Fluxo:**\n1. Dev acessa o portal e escolhe um template\n2. Preenche formulario (parametros definidos no YAML)\n3. Backstage executa os steps sequencialmente\n\n**Steps comuns:**\n- fetch:template — gera codigo a partir do skeleton\n- publish:github — cria repositorio no GitHub\n- catalog:register — registra no catalogo\n- argocd:create-application — cria app no ArgoCD\n\n**Output:** links para repo, catalogo, CI/CD'
    },
    {
      front: 'O que e TechDocs e como funciona?',
      back: '**TechDocs** = documentacao como codigo (docs-as-code) dentro do Backstage.\n\n**Tecnologia:** MkDocs + plugin techdocs-core\n\n**Setup:**\n1. Criar mkdocs.yml na raiz do repo\n2. Escrever docs em Markdown em /docs/\n3. Adicionar annotation backstage.io/techdocs-ref: dir:.\n4. Build pode ser local (Backstage) ou external (CI)\n\n**Storage:** S3, GCS ou local\n\n**Vantagem:** docs vivem junto do codigo e sao renderizadas no portal.'
    },
    {
      front: 'Qual a arquitetura do Backstage?',
      back: '**Frontend:** React App com plugins UI\n**Backend:** Node.js com plugins backend\n**Database:** PostgreSQL\n**Storage:** S3/GCS (para TechDocs)\n\n**Configuracao:** app-config.yaml\n- Integracoes (GitHub, GitLab)\n- Autenticacao (OAuth providers)\n- Catalog locations\n- Database connection\n- TechDocs builder/publisher\n\n**Deploy:** Container unico ou separado (frontend/backend). Porta padrao: 7007.'
    },
    {
      front: 'Quais plugins essenciais instalar no Backstage?',
      back: '**Core (built-in):**\n- plugin-catalog — catalogo de software\n- plugin-scaffolder — templates\n- plugin-techdocs — documentacao\n- plugin-search — busca unificada\n\n**Kubernetes & GitOps:**\n- plugin-kubernetes — visualizar workloads\n- backstage-plugin-argo-cd — status ArgoCD\n\n**Observability:**\n- plugin-cost-insights — custos cloud\n\n**Incident:**\n- pagerduty-plugin — on-call e incidentes\n\n**CI/CD:**\n- plugin-github-actions — status de builds'
    },
    {
      front: 'Como fazer autodiscovery de servicos no Backstage?',
      back: '**Configurar providers no app-config.yaml:**\n\n\`\`\`yaml\ncatalog:\n  providers:\n    github:\n      myOrg:\n        organization: my-org\n        catalogPath: /catalog-info.yaml\n        schedule:\n          frequency: { minutes: 30 }\n          timeout: { minutes: 3 }\n\`\`\`\n\n**Funcao:** Backstage varre todos os repos da org buscando catalog-info.yaml e registra automaticamente.\n\n**Alternativa:** Registro manual via catalog.locations no config.'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar um Backstage Developer Portal basico no Kubernetes e registrar servicos no catalogo.',
    objective: 'Aprender a estrutura do catalog-info.yaml, templates do Scaffolder e configuracao do Backstage.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar catalog-info.yaml para um servico',
        instruction: `Crie um arquivo \`catalog-info.yaml\` para um servico chamado \`order-service\`:
- Kind: Component
- Type: service
- Lifecycle: production
- Owner: team-orders
- System: e-commerce
- Fornece a API \`order-api\`
- Consome a API \`payment-api\`
- Depende do resource \`orders-db\`
- Adicione annotations para TechDocs e GitHub
- Adicione tags: go, grpc, orders`,
        hints: [
          'Use apiVersion: backstage.io/v1alpha1',
          'Annotations importantes: backstage.io/techdocs-ref e github.com/project-slug',
          'Relacionamentos ficam em spec: providesApis, consumesApis, dependsOn'
        ],
        solution: `\`\`\`yaml
# catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: order-service
  description: Servico de gerenciamento de pedidos
  annotations:
    backstage.io/techdocs-ref: dir:.
    github.com/project-slug: myorg/order-service
  tags:
    - go
    - grpc
    - orders
  links:
    - url: https://grafana.internal/d/orders
      title: Dashboard
      icon: dashboard
spec:
  type: service
  lifecycle: production
  owner: group:team-orders
  system: e-commerce
  providesApis:
    - order-api
  consumesApis:
    - payment-api
  dependsOn:
    - resource:orders-db
    - component:auth-service
\`\`\``,
        verify: `\`\`\`bash
# Validar a estrutura do catalog-info.yaml
# Verificar campos obrigatorios
cat catalog-info.yaml | grep -E "kind:|name:|type:|lifecycle:|owner:"
# Saida esperada:
# kind: Component
# name: order-service
# type: service
# lifecycle: production
# owner: group:team-orders

# Verificar relacionamentos
cat catalog-info.yaml | grep -E "providesApis|consumesApis|dependsOn"
# Saida esperada: todas as 3 secoes presentes
\`\`\``
      },
      {
        title: 'Criar API entity e Resource entity',
        instruction: `Crie dois arquivos adicionais:
1. \`order-api.yaml\` — Kind: API para a order-api (type: grpc, owner: team-orders, definition com proto)
2. \`orders-db.yaml\` — Kind: Resource para o banco de dados (type: database, owner: team-orders, system: e-commerce)`,
        hints: [
          'API usa spec.definition para conteudo da definicao (proto, openapi, etc.)',
          'Resource usa spec.type: database',
          'Ambos precisam de spec.owner e spec.system'
        ],
        solution: `\`\`\`yaml
# order-api.yaml
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: order-api
  description: API gRPC para gerenciamento de pedidos
  tags:
    - grpc
    - orders
spec:
  type: grpc
  lifecycle: production
  owner: group:team-orders
  system: e-commerce
  definition: |
    syntax = "proto3";
    package orders.v1;

    service OrderService {
      rpc CreateOrder(CreateOrderRequest) returns (Order);
      rpc GetOrder(GetOrderRequest) returns (Order);
      rpc ListOrders(ListOrdersRequest) returns (ListOrdersResponse);
    }
---
# orders-db.yaml
apiVersion: backstage.io/v1alpha1
kind: Resource
metadata:
  name: orders-db
  description: Banco PostgreSQL para pedidos
  tags:
    - postgresql
    - database
spec:
  type: database
  lifecycle: production
  owner: group:team-orders
  system: e-commerce
\`\`\``,
        verify: `\`\`\`bash
# Verificar as entidades
cat order-api.yaml | grep -E "kind:|name:|type:"
# Saida esperada:
# kind: API
# name: order-api
# type: grpc

cat orders-db.yaml | grep -E "kind:|name:|type:"
# Saida esperada:
# kind: Resource
# name: orders-db
# type: database
\`\`\``
      },
      {
        title: 'Criar template do Scaffolder',
        instruction: `Crie um \`template.yaml\` do Scaffolder para criar novos microservicos:
- apiVersion: scaffolder.backstage.io/v1beta3
- Parametros: name (string), owner (OwnerPicker), language (enum: go, java, python)
- Steps: fetch:template, publish:github, catalog:register
- Output: links para repositorio e catalogo`,
        hints: [
          'Use spec.parameters como array de grupos de campos',
          'OwnerPicker usa ui:field: OwnerPicker com catalogFilter',
          'Referencie outputs de steps anteriores com ${{ steps[id].output.* }}'
        ],
        solution: `\`\`\`yaml
# template.yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: new-microservice
  title: Criar Novo Microservico
  description: Template para criar microservico com CI/CD e registro no catalogo
  tags:
    - recommended
    - microservice
spec:
  owner: group:platform-team
  type: service

  parameters:
    - title: Informacoes do Servico
      required:
        - name
        - owner
      properties:
        name:
          title: Nome do Servico
          type: string
          description: Nome em kebab-case
          pattern: '^[a-z][a-z0-9-]*$'
        owner:
          title: Equipe Dona
          type: string
          ui:field: OwnerPicker
          ui:options:
            catalogFilter:
              kind: Group
        description:
          title: Descricao
          type: string

    - title: Stack Tecnica
      properties:
        language:
          title: Linguagem
          type: string
          enum: ['go', 'java', 'python']
          default: go

  steps:
    - id: fetch
      name: Gerar Codigo
      action: fetch:template
      input:
        url: ./skeleton
        values:
          name: \\\${{ parameters.name }}
          owner: \\\${{ parameters.owner }}
          language: \\\${{ parameters.language }}

    - id: publish
      name: Criar Repositorio
      action: publish:github
      input:
        repoUrl: github.com?owner=myorg&repo=\\\${{ parameters.name }}
        description: \\\${{ parameters.description }}
        defaultBranch: main

    - id: register
      name: Registrar no Catalogo
      action: catalog:register
      input:
        repoContentsUrl: \\\${{ steps['publish'].output.repoContentsUrl }}
        catalogInfoPath: /catalog-info.yaml

  output:
    links:
      - title: Repositorio
        url: \\\${{ steps['publish'].output.remoteUrl }}
      - title: Catalogo
        entityRef: \\\${{ steps['register'].output.entityRef }}
\`\`\``,
        verify: `\`\`\`bash
# Verificar estrutura do template
cat template.yaml | grep -E "kind:|apiVersion:|action:"
# Saida esperada:
# apiVersion: scaffolder.backstage.io/v1beta3
# kind: Template
# action: fetch:template
# action: publish:github
# action: catalog:register

# Verificar que tem parametros obrigatorios
cat template.yaml | grep -E "required:" -A 3
# Saida esperada: name e owner como required
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Componentes nao aparecem no Software Catalog',
      difficulty: 'easy',
      symptom: 'Novos servicos foram criados com catalog-info.yaml mas nao aparecem no portal Backstage.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o catalog-info.yaml esta valido
# Acesse: Backstage > Catalog > Register Existing Component
# Cole a URL do catalog-info.yaml e veja os erros

# 2. Verificar logs do backend
kubectl logs -n backstage deploy/backstage | grep -i "catalog" | grep -i "error"

# 3. Verificar se o provider esta configurado
# Em app-config.yaml, confirmar que catalog.providers ou catalog.locations
# aponta para o repositorio/organizacao correta

# 4. Verificar agendamento do provider
# O autodiscovery roda em schedule (ex: a cada 30 min)
# Pode ser necessario aguardar ou forcar refresh
\`\`\``,
      solution: `**Causas comuns e solucoes:**

1. **catalog-info.yaml com YAML invalido:** Validar o YAML com um linter. Campos obrigatorios: apiVersion, kind, metadata.name, spec.type, spec.lifecycle, spec.owner.

2. **Localizacao nao configurada:** Adicionar a URL do repo em catalog.locations no app-config.yaml ou configurar catalog.providers.github para autodiscovery.

3. **Permissao do token GitHub:** O GITHUB_TOKEN usado pelo Backstage precisa de permissao de leitura nos repositorios da organizacao.

4. **Schedule do provider:** Se usando autodiscovery, o scan roda conforme o schedule configurado. Para forcar: Catalog > Register Existing Component > colar URL.

5. **Branch errada:** Confirmar que o catalogPath aponta para a branch correta (main vs master).`
    },
    {
      title: 'TechDocs nao renderiza documentacao',
      difficulty: 'medium',
      symptom: 'A aba TechDocs do componente exibe erro ou pagina em branco. A documentacao nao e gerada.',
      diagnosis: `\`\`\`bash
# 1. Verificar annotation no catalog-info.yaml
grep "techdocs-ref" catalog-info.yaml
# Deve conter: backstage.io/techdocs-ref: dir:.

# 2. Verificar se mkdocs.yml existe na raiz do repo
ls -la mkdocs.yml

# 3. Verificar estrutura de docs
ls -la docs/
# Deve ter pelo menos index.md

# 4. Verificar logs de build do TechDocs
kubectl logs -n backstage deploy/backstage | grep -i "techdocs" | tail -20

# 5. Verificar configuracao do publisher
# Em app-config.yaml: techdocs.builder e techdocs.publisher
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Annotation ausente:** Adicionar \`backstage.io/techdocs-ref: dir:.\` nas annotations do catalog-info.yaml.

2. **mkdocs.yml malformado:** Verificar que o arquivo existe na raiz e tem a configuracao minima (site_name e plugins: [techdocs-core]).

3. **Pasta docs/ ausente:** Criar a pasta docs/ com pelo menos um index.md na raiz.

4. **Builder configurado como external mas CI nao gera:** Se techdocs.builder: external, a CI precisa rodar \`npx @techdocs/cli generate\` e publicar. Se quiser geracao local, usar \`techdocs.builder: local\`.

5. **Storage nao configurado:** Para builder external, verificar que techdocs.publisher aponta para S3/GCS valido com permissoes corretas.`
    },
    {
      title: 'Scaffolder template falha ao criar repositorio',
      difficulty: 'hard',
      symptom: 'Ao usar um template do Scaffolder, o step de publish:github falha com erro de permissao ou configuracao.',
      diagnosis: `\`\`\`bash
# 1. Verificar logs do scaffolder
kubectl logs -n backstage deploy/backstage | grep -i "scaffolder" | grep -i "error"

# 2. Verificar token GitHub
# O token precisa de scopes: repo, workflow, admin:org (para criar repos)
# Em app-config.yaml: integrations.github[].token

# 3. Testar token manualmente
curl -H "Authorization: token GITHUB_TOKEN" https://api.github.com/user
# Deve retornar informacoes do usuario

# 4. Verificar repoUrl no template
# Formato: github.com?owner=ORG&repo=NOME
# owner deve ser uma org ou usuario valido

# 5. Verificar se a org permite criacao de repos via API
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Token sem scopes suficientes:** O GITHUB_TOKEN para o Scaffolder precisa de scopes: repo (full control), workflow, admin:org (read). Gerar novo token com scopes adequados.

2. **Organizacao restringe criacao de repos:** Verificar nas configuracoes da org GitHub se "Members can create repositories" esta habilitado ou se o token pertence a um admin.

3. **repoUrl com formato incorreto:** O formato correto e \`github.com?owner=ORG&repo=NOME\`. Nao usar URL completa — o Backstage constroi a URL automaticamente.

4. **Repo ja existe:** Se um repositorio com o mesmo nome ja existe, o step falha. Adicionar validacao no template ou tratar o erro.

5. **Rate limiting:** Muitas execucoes consecutivas podem causar rate limit na API do GitHub. Verificar headers X-RateLimit-Remaining.`
    }
  ]
};
