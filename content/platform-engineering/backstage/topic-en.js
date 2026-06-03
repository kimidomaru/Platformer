window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['platform-engineering/backstage'] = {
  theory: `
# Backstage Developer Portal

## Relevance
Backstage is the open-source platform created by Spotify for building developer portals. Donated to CNCF (incubating project), it is the de facto standard for the interface layer of an IDP. It centralizes service catalog, templates, documentation, and plugins in a single portal.

## Fundamental Concepts

### What is Backstage?

Backstage is a framework for building developer portals. It is not a ready-made solution — it is an extensible platform you customize for your organization:

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

### Backstage Pillars

1. **Software Catalog** — centralized inventory of all services, APIs, resources, and teams
2. **Software Templates (Scaffolder)** — creation of new projects via standardized templates
3. **TechDocs** — technical documentation as code (docs-as-code)
4. **Plugins** — extensions to integrate tools (Kubernetes, ArgoCD, PagerDuty, etc.)

### Software Catalog

The Software Catalog is the heart of Backstage. It registers and organizes all ecosystem components:

\`\`\`yaml
# catalog-info.yaml — at the root of each repository
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payment-service
  description: Payment processing service
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
      title: Grafana Dashboard
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

#### Catalog Entity Kinds

\`\`\`
┌─────────────┬──────────────────────────────┐
│ Kind        │ Description                  │
├─────────────┼──────────────────────────────┤
│ Component   │ Software (service, lib, CLI) │
│ API         │ Interface (REST, gRPC, etc)  │
│ Resource    │ Infra (DB, S3, queue)        │
│ System      │ Grouping of components       │
│ Domain      │ Business area                │
│ Group       │ Team                         │
│ User        │ Person                       │
│ Location    │ Entity origin                │
│ Template    │ Scaffolder template          │
└─────────────┴──────────────────────────────┘
\`\`\`

#### Relationships

\`\`\`yaml
# Relationships between entities
spec:
  owner: group:team-payments       # who owns it
  system: checkout                 # which system it belongs to
  providesApis:                    # APIs it exposes
    - payment-api
  consumesApis:                    # APIs it consumes
    - user-api
  dependsOn:                       # dependencies
    - resource:payments-db
    - component:auth-service
  subcomponentOf: platform         # hierarchy
\`\`\`

### Software Templates (Scaffolder)

The Scaffolder allows creating new projects from standardized templates:

\`\`\`yaml
# template.yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: microservice-template
  title: Create Microservice
  description: Standard template for new microservice with CI/CD
  tags:
    - recommended
    - microservice
spec:
  owner: platform-team
  type: service

  parameters:
    - title: Service Information
      required:
        - name
        - owner
      properties:
        name:
          title: Service Name
          type: string
          pattern: '^[a-z][a-z0-9-]*\$'
        owner:
          title: Owner Team
          type: string
          ui:field: OwnerPicker
          ui:options:
            catalogFilter:
              kind: Group
        description:
          title: Description
          type: string

    - title: Technical Settings
      properties:
        language:
          title: Language
          type: string
          enum: ['go', 'java', 'python', 'nodejs']
          default: go
        database:
          title: Needs database?
          type: boolean
          default: false

  steps:
    - id: fetch-skeleton
      name: Generate Code
      action: fetch:template
      input:
        url: ./skeleton
        values:
          name: \${{ parameters.name }}
          owner: \${{ parameters.owner }}
          language: \${{ parameters.language }}

    - id: create-repo
      name: Create Repository
      action: publish:github
      input:
        repoUrl: github.com?owner=org&repo=\${{ parameters.name }}
        description: \${{ parameters.description }}
        defaultBranch: main

    - id: register-catalog
      name: Register in Catalog
      action: catalog:register
      input:
        repoContentsUrl: \${{ steps['create-repo'].output.repoContentsUrl }}
        catalogInfoPath: /catalog-info.yaml

    - id: create-argocd-app
      name: Create ArgoCD App
      action: argocd:create-application
      input:
        appName: \${{ parameters.name }}
        repoUrl: \${{ steps['create-repo'].output.remoteUrl }}

  output:
    links:
      - title: Repository
        url: \${{ steps['create-repo'].output.remoteUrl }}
      - title: Open in Catalog
        entityRef: \${{ steps['register-catalog'].output.entityRef }}
\`\`\`

### TechDocs — Documentation as Code

TechDocs uses MkDocs to generate documentation from markdown in the repository:

\`\`\`yaml
# mkdocs.yml — at repository root
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
# Repository structure
repo/
  docs/
    index.md
    architecture.md
    api.md
    runbook.md
  mkdocs.yml
  catalog-info.yaml    # with annotation backstage.io/techdocs-ref
\`\`\`

### Backstage Architecture

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

**Infrastructure requirements:**
- Node.js 18+
- PostgreSQL (catalog and state)
- Storage for TechDocs (S3, GCS, or local)
- Authentication (GitHub, Google, Okta, etc.)

### Deploying Backstage on Kubernetes

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

### Essential Plugins

| Plugin | Function |
|--------|----------|
| @backstage/plugin-catalog | Software catalog |
| @backstage/plugin-scaffolder | Templates and project creation |
| @backstage/plugin-techdocs | Documentation as code |
| @backstage/plugin-kubernetes | View K8s workloads |
| @backstage/plugin-github-actions | CI/CD status |
| @roadiehq/backstage-plugin-argo-cd | ArgoCD integration |
| @backstage/plugin-api-docs | API documentation (OpenAPI) |
| @pagerduty/backstage-plugin | PagerDuty integration |
| @backstage/plugin-search | Unified search in portal |
| @backstage/plugin-cost-insights | Cloud costs |

### app-config.yaml — Main Configuration

\`\`\`yaml
app:
  title: My Platform
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

### Common Mistakes

1. **Not registering catalog-info.yaml** — services remain invisible in the portal
2. **Templates without validation** — scaffolder creates malformed projects
3. **Outdated TechDocs** — docs in the portal diverge from code
4. **No ownership** — entities without defined owner make accountability difficult
5. **Too many plugins** — installing everything available instead of focusing on what adds value
6. **No autodiscovery configured** — depending on manual registration when it can be automatic

## Killer.sh Style Challenge

> **Scenario:** Configure Backstage with: (1) catalog-info.yaml for a Go service with 2 APIs, (2) Scaffolder template to create new microservices, (3) Kubernetes plugin integration to view service pods.
`,
  quiz: [
    {
      question: 'Which file must exist at the root of each repository to register a service in the Backstage Catalog?',
      options: [
        'backstage.yaml',
        'catalog-info.yaml',
        'service.json',
        '.backstage/config.yaml'
      ],
      correct: 1,
      explanation: 'The catalog-info.yaml file at the repository root describes the component (kind: Component) with metadata, spec, owner, and relationships. It is the Backstage standard for entity registration.',
      reference: 'Related concept: Backstage can autodiscover by scanning repositories for this file.'
    },
    {
      question: 'What are the 4 main pillars of Backstage?',
      options: [
        'CI/CD, Monitoring, Logging, Tracing',
        'Software Catalog, Software Templates (Scaffolder), TechDocs, Plugins',
        'Git, Docker, Kubernetes, Helm',
        'Frontend, Backend, Database, Cache'
      ],
      correct: 1,
      explanation: 'The 4 pillars are: Software Catalog (service inventory), Software Templates/Scaffolder (project creation), TechDocs (documentation as code), and Plugins (integration extensions).',
      reference: 'Related concept: Each pillar is independent — you can adopt them incrementally.'
    },
    {
      question: 'What is the Scaffolder in Backstage?',
      options: [
        'A monitoring system',
        'The template engine that allows creating new standardized projects via portal forms',
        'A security plugin',
        'The portal search system'
      ],
      correct: 1,
      explanation: 'The Scaffolder (Software Templates) allows creating new projects via forms. A template defines parameters, steps (generate code, create repo, register in catalog), and outputs.',
      reference: 'Related concept: Templates use apiVersion scaffolder.backstage.io/v1beta3 with declarative steps.'
    },
    {
      question: 'Which technology does TechDocs use to generate documentation?',
      options: [
        'Docusaurus',
        'MkDocs',
        'Sphinx',
        'GitBook'
      ],
      correct: 1,
      explanation: 'TechDocs uses MkDocs with the techdocs-core plugin. Documentation is written in Markdown in the repository and rendered automatically in the Backstage portal.',
      reference: 'Related concept: The mkdocs.yml file at the repo root configures navigation and plugins.'
    },
    {
      question: 'Which entity Kinds does the Backstage Catalog support?',
      options: [
        'Only Component and API',
        'Component, API, Resource, System, Domain, Group, User, Location, Template',
        'Service, Database, Queue, Cache',
        'Pod, Deployment, Service, Ingress'
      ],
      correct: 1,
      explanation: 'The Backstage Catalog supports 9 Kinds: Component (software), API (interfaces), Resource (infra), System (grouping), Domain (business area), Group (team), User (person), Location (origin), and Template.',
      reference: 'Related concept: Entities relate via spec.owner, spec.system, spec.dependsOn, etc.'
    },
    {
      question: 'Which annotation in catalog-info.yaml enables TechDocs for a component?',
      options: [
        'backstage.io/docs-ref',
        'backstage.io/techdocs-ref: dir:.',
        'techdocs.backstage.io/enabled: true',
        'docs.backstage.io/path: ./docs'
      ],
      correct: 1,
      explanation: 'The annotation backstage.io/techdocs-ref: dir:. tells TechDocs that the documentation (mkdocs.yml + docs/) is at the component repository root.',
      reference: 'Related concept: The builder can be "local" (Backstage generates) or "external" (CI generates and sends to storage).'
    },
    {
      question: 'Which database does Backstage use in production?',
      options: [
        'MongoDB',
        'PostgreSQL',
        'SQLite',
        'MySQL'
      ],
      correct: 1,
      explanation: 'Backstage uses PostgreSQL in production to store the catalog, scaffolder state, and plugin data. SQLite can be used for local development.',
      reference: 'Related concept: Configured in app-config.yaml under the backend.database section.'
    }
  ],
  flashcards: [
    {
      front: 'What is catalog-info.yaml and where is it located?',
      back: '**catalog-info.yaml** is the file that registers a component in the Backstage Catalog.\n\n**Location:** root of the service repository.\n\n**Minimum content:**\n- apiVersion: backstage.io/v1alpha1\n- kind: Component\n- metadata: name, description, annotations\n- spec: type, lifecycle, owner\n\n**Important annotations:**\n- backstage.io/techdocs-ref (docs)\n- github.com/project-slug (GitHub)\n- argocd/app-name (ArgoCD)'
    },
    {
      front: 'What are the 9 entity Kinds in the Backstage Catalog?',
      back: '1. **Component** — software (service, lib, CLI)\n2. **API** — interface (REST, gRPC, GraphQL)\n3. **Resource** — infra (DB, S3, queue, topic)\n4. **System** — logical grouping of components\n5. **Domain** — business area\n6. **Group** — team\n7. **User** — individual person\n8. **Location** — URL/path entity origin\n9. **Template** — Scaffolder template\n\nRelationships: owner, system, dependsOn, providesApis, consumesApis'
    },
    {
      front: 'How does the Scaffolder (Software Templates) work?',
      back: '**Flow:**\n1. Dev accesses the portal and chooses a template\n2. Fills out a form (parameters defined in YAML)\n3. Backstage executes steps sequentially\n\n**Common steps:**\n- fetch:template — generates code from skeleton\n- publish:github — creates GitHub repository\n- catalog:register — registers in catalog\n- argocd:create-application — creates ArgoCD app\n\n**Output:** links to repo, catalog, CI/CD'
    },
    {
      front: 'What is TechDocs and how does it work?',
      back: '**TechDocs** = documentation as code (docs-as-code) inside Backstage.\n\n**Technology:** MkDocs + techdocs-core plugin\n\n**Setup:**\n1. Create mkdocs.yml at repo root\n2. Write docs in Markdown in /docs/\n3. Add annotation backstage.io/techdocs-ref: dir:.\n4. Build can be local (Backstage) or external (CI)\n\n**Storage:** S3, GCS, or local\n\n**Advantage:** docs live alongside code and are rendered in the portal.'
    },
    {
      front: 'What is the Backstage architecture?',
      back: '**Frontend:** React App with UI plugins\n**Backend:** Node.js with backend plugins\n**Database:** PostgreSQL\n**Storage:** S3/GCS (for TechDocs)\n\n**Configuration:** app-config.yaml\n- Integrations (GitHub, GitLab)\n- Authentication (OAuth providers)\n- Catalog locations\n- Database connection\n- TechDocs builder/publisher\n\n**Deploy:** Single or separate container (frontend/backend). Default port: 7007.'
    },
    {
      front: 'Which essential plugins to install in Backstage?',
      back: '**Core (built-in):**\n- plugin-catalog — software catalog\n- plugin-scaffolder — templates\n- plugin-techdocs — documentation\n- plugin-search — unified search\n\n**Kubernetes & GitOps:**\n- plugin-kubernetes — view workloads\n- backstage-plugin-argo-cd — ArgoCD status\n\n**Observability:**\n- plugin-cost-insights — cloud costs\n\n**Incident:**\n- pagerduty-plugin — on-call and incidents\n\n**CI/CD:**\n- plugin-github-actions — build status'
    },
    {
      front: 'How to set up autodiscovery of services in Backstage?',
      back: '**Configure providers in app-config.yaml:**\n\n\`\`\`yaml\ncatalog:\n  providers:\n    github:\n      myOrg:\n        organization: my-org\n        catalogPath: /catalog-info.yaml\n        schedule:\n          frequency: { minutes: 30 }\n          timeout: { minutes: 3 }\n\`\`\`\n\n**Function:** Backstage scans all org repos looking for catalog-info.yaml and registers automatically.\n\n**Alternative:** Manual registration via catalog.locations in config.'
    }
  ],
  lab: {
    scenario: 'You need to configure a basic Backstage Developer Portal on Kubernetes and register services in the catalog.',
    objective: 'Learn the structure of catalog-info.yaml, Scaffolder templates, and Backstage configuration.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create catalog-info.yaml for a service',
        instruction: `Create a \`catalog-info.yaml\` file for a service called \`order-service\`:
- Kind: Component
- Type: service
- Lifecycle: production
- Owner: team-orders
- System: e-commerce
- Provides the \`order-api\` API
- Consumes the \`payment-api\` API
- Depends on resource \`orders-db\`
- Add annotations for TechDocs and GitHub
- Add tags: go, grpc, orders`,
        hints: [
          'Use apiVersion: backstage.io/v1alpha1',
          'Important annotations: backstage.io/techdocs-ref and github.com/project-slug',
          'Relationships go in spec: providesApis, consumesApis, dependsOn'
        ],
        solution: `\`\`\`yaml
# catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: order-service
  description: Order management service
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
# Validate catalog-info.yaml structure
# Check required fields
cat catalog-info.yaml | grep -E "kind:|name:|type:|lifecycle:|owner:"
# Expected output:
# kind: Component
# name: order-service
# type: service
# lifecycle: production
# owner: group:team-orders

# Check relationships
cat catalog-info.yaml | grep -E "providesApis|consumesApis|dependsOn"
# Expected output: all 3 sections present
\`\`\``
      },
      {
        title: 'Create API entity and Resource entity',
        instruction: `Create two additional files:
1. \`order-api.yaml\` — Kind: API for the order-api (type: grpc, owner: team-orders, definition with proto)
2. \`orders-db.yaml\` — Kind: Resource for the database (type: database, owner: team-orders, system: e-commerce)`,
        hints: [
          'API uses spec.definition for definition content (proto, openapi, etc.)',
          'Resource uses spec.type: database',
          'Both need spec.owner and spec.system'
        ],
        solution: `\`\`\`yaml
# order-api.yaml
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: order-api
  description: gRPC API for order management
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
  description: PostgreSQL database for orders
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
# Verify entities
cat order-api.yaml | grep -E "kind:|name:|type:"
# Expected output:
# kind: API
# name: order-api
# type: grpc

cat orders-db.yaml | grep -E "kind:|name:|type:"
# Expected output:
# kind: Resource
# name: orders-db
# type: database
\`\`\``
      },
      {
        title: 'Create Scaffolder template',
        instruction: `Create a Scaffolder \`template.yaml\` to create new microservices:
- apiVersion: scaffolder.backstage.io/v1beta3
- Parameters: name (string), owner (OwnerPicker), language (enum: go, java, python)
- Steps: fetch:template, publish:github, catalog:register
- Output: links to repository and catalog`,
        hints: [
          'Use spec.parameters as an array of field groups',
          'OwnerPicker uses ui:field: OwnerPicker with catalogFilter',
          'Reference outputs from previous steps with ${{ steps[id].output.* }}'
        ],
        solution: `\`\`\`yaml
# template.yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: new-microservice
  title: Create New Microservice
  description: Template to create microservice with CI/CD and catalog registration
  tags:
    - recommended
    - microservice
spec:
  owner: group:platform-team
  type: service

  parameters:
    - title: Service Information
      required:
        - name
        - owner
      properties:
        name:
          title: Service Name
          type: string
          description: Name in kebab-case
          pattern: '^[a-z][a-z0-9-]*$'
        owner:
          title: Owner Team
          type: string
          ui:field: OwnerPicker
          ui:options:
            catalogFilter:
              kind: Group
        description:
          title: Description
          type: string

    - title: Tech Stack
      properties:
        language:
          title: Language
          type: string
          enum: ['go', 'java', 'python']
          default: go

  steps:
    - id: fetch
      name: Generate Code
      action: fetch:template
      input:
        url: ./skeleton
        values:
          name: \\\${{ parameters.name }}
          owner: \\\${{ parameters.owner }}
          language: \\\${{ parameters.language }}

    - id: publish
      name: Create Repository
      action: publish:github
      input:
        repoUrl: github.com?owner=myorg&repo=\\\${{ parameters.name }}
        description: \\\${{ parameters.description }}
        defaultBranch: main

    - id: register
      name: Register in Catalog
      action: catalog:register
      input:
        repoContentsUrl: \\\${{ steps['publish'].output.repoContentsUrl }}
        catalogInfoPath: /catalog-info.yaml

  output:
    links:
      - title: Repository
        url: \\\${{ steps['publish'].output.remoteUrl }}
      - title: Catalog
        entityRef: \\\${{ steps['register'].output.entityRef }}
\`\`\``,
        verify: `\`\`\`bash
# Verify template structure
cat template.yaml | grep -E "kind:|apiVersion:|action:"
# Expected output:
# apiVersion: scaffolder.backstage.io/v1beta3
# kind: Template
# action: fetch:template
# action: publish:github
# action: catalog:register

# Verify required parameters
cat template.yaml | grep -E "required:" -A 3
# Expected output: name and owner as required
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Components not appearing in Software Catalog',
      difficulty: 'easy',
      symptom: 'New services were created with catalog-info.yaml but do not appear in the Backstage portal.',
      diagnosis: `\`\`\`bash
# 1. Verify if catalog-info.yaml is valid
# Access: Backstage > Catalog > Register Existing Component
# Paste the catalog-info.yaml URL and see errors

# 2. Check backend logs
kubectl logs -n backstage deploy/backstage | grep -i "catalog" | grep -i "error"

# 3. Verify if provider is configured
# In app-config.yaml, confirm that catalog.providers or catalog.locations
# points to the correct repository/organization

# 4. Check provider schedule
# Autodiscovery runs on schedule (e.g., every 30 min)
# May need to wait or force refresh
\`\`\``,
      solution: `**Common causes and solutions:**

1. **Invalid YAML in catalog-info.yaml:** Validate the YAML with a linter. Required fields: apiVersion, kind, metadata.name, spec.type, spec.lifecycle, spec.owner.

2. **Location not configured:** Add the repo URL in catalog.locations in app-config.yaml or configure catalog.providers.github for autodiscovery.

3. **GitHub token permission:** The GITHUB_TOKEN used by Backstage needs read permission on the organization's repositories.

4. **Provider schedule:** If using autodiscovery, the scan runs according to the configured schedule. To force: Catalog > Register Existing Component > paste URL.

5. **Wrong branch:** Confirm that catalogPath points to the correct branch (main vs master).`
    },
    {
      title: 'TechDocs not rendering documentation',
      difficulty: 'medium',
      symptom: 'The TechDocs tab of the component shows an error or blank page. Documentation is not generated.',
      diagnosis: `\`\`\`bash
# 1. Check annotation in catalog-info.yaml
grep "techdocs-ref" catalog-info.yaml
# Should contain: backstage.io/techdocs-ref: dir:.

# 2. Verify mkdocs.yml exists at repo root
ls -la mkdocs.yml

# 3. Check docs structure
ls -la docs/
# Should have at least index.md

# 4. Check TechDocs build logs
kubectl logs -n backstage deploy/backstage | grep -i "techdocs" | tail -20

# 5. Check publisher configuration
# In app-config.yaml: techdocs.builder and techdocs.publisher
\`\`\``,
      solution: `**Causes and solutions:**

1. **Missing annotation:** Add \`backstage.io/techdocs-ref: dir:.\` in the catalog-info.yaml annotations.

2. **Malformed mkdocs.yml:** Verify the file exists at root and has minimum configuration (site_name and plugins: [techdocs-core]).

3. **Missing docs/ folder:** Create the docs/ folder with at least an index.md at root.

4. **Builder configured as external but CI not generating:** If techdocs.builder: external, CI needs to run \`npx @techdocs/cli generate\` and publish. For local generation, use \`techdocs.builder: local\`.

5. **Storage not configured:** For external builder, verify techdocs.publisher points to valid S3/GCS with correct permissions.`
    },
    {
      title: 'Scaffolder template fails to create repository',
      difficulty: 'hard',
      symptom: 'When using a Scaffolder template, the publish:github step fails with a permission or configuration error.',
      diagnosis: `\`\`\`bash
# 1. Check scaffolder logs
kubectl logs -n backstage deploy/backstage | grep -i "scaffolder" | grep -i "error"

# 2. Verify GitHub token
# Token needs scopes: repo, workflow, admin:org (to create repos)
# In app-config.yaml: integrations.github[].token

# 3. Test token manually
curl -H "Authorization: token GITHUB_TOKEN" https://api.github.com/user
# Should return user information

# 4. Verify repoUrl in template
# Format: github.com?owner=ORG&repo=NAME
# owner must be a valid org or user

# 5. Check if org allows repo creation via API
\`\`\``,
      solution: `**Causes and solutions:**

1. **Token without sufficient scopes:** The GITHUB_TOKEN for the Scaffolder needs scopes: repo (full control), workflow, admin:org (read). Generate a new token with adequate scopes.

2. **Organization restricts repo creation:** Check in GitHub org settings if "Members can create repositories" is enabled or if the token belongs to an admin.

3. **Incorrect repoUrl format:** The correct format is \`github.com?owner=ORG&repo=NAME\`. Do not use the full URL — Backstage builds the URL automatically.

4. **Repo already exists:** If a repository with the same name already exists, the step fails. Add validation in the template or handle the error.

5. **Rate limiting:** Many consecutive executions can cause rate limit on the GitHub API. Check X-RateLimit-Remaining headers.`
    }
  ]
};
