window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['platform-engineering/golden-paths'] = {
  theory: `
# Golden Paths & Self-Service

## Relevancia
Golden Paths sao workflows padronizados e otimizados oferecidos pela plataforma interna que permitem aos desenvolvedores realizar tarefas comuns (deploy, criar servico, provisionar infra) de forma rapida, segura e sem dependencias. Self-service e o mecanismo que habilita esses caminhos de forma autonoma. Juntos, sao o nucleo operacional de um IDP.

## Conceitos Fundamentais

### O que sao Golden Paths?

Golden Paths (tambem chamados "Paved Roads" ou "Happy Paths") sao caminhos recomendados e otimizados para tarefas comuns de desenvolvimento:

\`\`\`
┌─────────────────────────────────────────────┐
│              Golden Paths                   │
├─────────────────────────────────────────────┤
│                                             │
│  "Novo Microservico"                        │
│   Template → Repo → CI/CD → Deploy → Obs   │
│                                             │
│  "Nova API"                                 │
│   OpenAPI → Codegen → Gateway → Docs        │
│                                             │
│  "Novo Banco de Dados"                      │
│   Request → Provisioning → Secrets → App    │
│                                             │
│  "Novo Ambiente"                            │
│   Namespace → RBAC → Quotas → GitOps        │
│                                             │
└─────────────────────────────────────────────┘
\`\`\`

**Caracteristicas essenciais:**
- **Recomendados, nao obrigatorios** — devs podem sair do caminho se necessario
- **Seguros por padrao** — seguranca, compliance e boas praticas embutidas
- **Testados e mantidos** — a plataforma garante que funcionam
- **Documentados** — instrucoes claras, exemplos e troubleshooting
- **Automatizados** — minimizam passos manuais

### Self-Service: O Motor dos Golden Paths

\`\`\`
Modelo Tradicional (Ticket-driven):
  Dev → Ticket → Aprovacao → Ops → Execucao → 3-5 dias

Modelo Self-Service:
  Dev → Portal/CLI → Automacao → Pronto em minutos
\`\`\`

#### Niveis de Self-Service

| Nivel | Descricao | Exemplo |
|-------|-----------|---------|
| 0. Manual | Tickets e docs | "Abra um Jira para criar namespace" |
| 1. Assistido | Templates + docs | "Use este Helm chart e siga o guia" |
| 2. Portal | UI com formularios | "Preencha o form no Backstage" |
| 3. API/CLI | Programatico | "Use \`platform create service\`" |
| 4. GitOps | Declarativo | "Commit um YAML no repo de infra" |

### Anatomia de um Golden Path

Um golden path completo para "Criar novo microservico":

\`\`\`
┌─────────────────────────────────────────────────┐
│  1. SCAFFOLDING                                 │
│     Template gera: codigo, Dockerfile,           │
│     CI config, Helm chart, catalog-info.yaml    │
├─────────────────────────────────────────────────┤
│  2. REPOSITORIO                                 │
│     GitHub repo criado automaticamente          │
│     Branch protection, CODEOWNERS configurados  │
├─────────────────────────────────────────────────┤
│  3. CI/CD PIPELINE                              │
│     GitHub Actions / Tekton configurado         │
│     Build, test, scan, push image               │
├─────────────────────────────────────────────────┤
│  4. DEPLOY                                      │
│     ArgoCD Application criada                   │
│     Namespace, RBAC, quotas provisionados       │
├─────────────────────────────────────────────────┤
│  5. OBSERVABILIDADE                             │
│     Prometheus ServiceMonitor criado            │
│     Grafana dashboard provisionado              │
│     Alertas basicos configurados                │
├─────────────────────────────────────────────────┤
│  6. REGISTRO                                    │
│     Registrado no Backstage Catalog             │
│     TechDocs configurado                        │
│     API documentada                             │
└─────────────────────────────────────────────────┘
\`\`\`

### Platform API com Crossplane

Crossplane permite expor abstrações de infraestrutura como APIs Kubernetes (CRDs customizados):

\`\`\`yaml
# Definir uma abstração: CompositeResourceDefinition (XRD)
apiVersion: apiextensions.crossplane.io/v1
kind: CompositeResourceDefinition
metadata:
  name: xdatabases.platform.example.com
spec:
  group: platform.example.com
  names:
    kind: XDatabase
    plural: xdatabases
  claimNames:
    kind: Database
    plural: databases
  versions:
    - name: v1alpha1
      served: true
      referenceable: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                engine:
                  type: string
                  enum: ["postgres", "mysql"]
                size:
                  type: string
                  enum: ["small", "medium", "large"]
              required:
                - engine
                - size
\`\`\`

\`\`\`yaml
# Composição: o que acontece quando alguém pede um Database
apiVersion: apiextensions.crossplane.io/v1
kind: Composition
metadata:
  name: database-aws
  labels:
    provider: aws
spec:
  compositeTypeRef:
    apiVersion: platform.example.com/v1alpha1
    kind: XDatabase
  resources:
    - name: rds-instance
      base:
        apiVersion: rds.aws.upbound.io/v1beta1
        kind: Instance
        spec:
          forProvider:
            region: us-east-1
            engine: postgres
            instanceClass: db.t3.micro
            allocatedStorage: 20
            skipFinalSnapshot: true
      patches:
        - fromFieldPath: "spec.engine"
          toFieldPath: "spec.forProvider.engine"
        - fromFieldPath: "spec.size"
          toFieldPath: "spec.forProvider.instanceClass"
          transforms:
            - type: map
              map:
                small: db.t3.micro
                medium: db.t3.medium
                large: db.t3.large
\`\`\`

\`\`\`yaml
# O que o dev pede (Claim) — interface simples
apiVersion: platform.example.com/v1alpha1
kind: Database
metadata:
  name: orders-db
  namespace: team-orders
spec:
  engine: postgres
  size: medium
\`\`\`

### GitOps como Self-Service

Usando ArgoCD ApplicationSet para self-service baseado em GitOps:

\`\`\`yaml
# ApplicationSet: auto-gera ArgoCD Apps baseado na estrutura de pastas
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: team-apps
  namespace: argocd
spec:
  generators:
    - git:
        repoURL: https://github.com/org/platform-config
        revision: HEAD
        directories:
          - path: 'teams/*/apps/*'
  template:
    metadata:
      name: '{{path[2]}}-{{path[4]}}'
    spec:
      project: '{{path[2]}}'
      source:
        repoURL: https://github.com/org/platform-config
        targetRevision: HEAD
        path: '{{path}}'
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{path[2]}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
\`\`\`

\`\`\`
# Estrutura do repo GitOps
platform-config/
  teams/
    team-orders/
      apps/
        order-service/
          kustomization.yaml
          deployment.yaml
          service.yaml
        payment-service/
          ...
    team-users/
      apps/
        user-service/
          ...
\`\`\`

### Namespace Self-Service com Kyverno

\`\`\`yaml
# ClusterPolicy: auto-configura namespaces criados por devs
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: namespace-defaults
spec:
  rules:
    - name: add-resource-quota
      match:
        any:
          - resources:
              kinds:
                - Namespace
              selector:
                matchLabels:
                  platform.example.com/managed: "true"
      generate:
        apiVersion: v1
        kind: ResourceQuota
        name: default-quota
        namespace: "{{request.object.metadata.name}}"
        data:
          spec:
            hard:
              requests.cpu: "4"
              requests.memory: 8Gi
              limits.cpu: "8"
              limits.memory: 16Gi
              pods: "50"

    - name: add-network-policy
      match:
        any:
          - resources:
              kinds:
                - Namespace
              selector:
                matchLabels:
                  platform.example.com/managed: "true"
      generate:
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        name: default-deny-ingress
        namespace: "{{request.object.metadata.name}}"
        data:
          spec:
            podSelector: {}
            policyTypes:
              - Ingress
\`\`\`

### CLI de Plataforma

Exemplo de CLI que abstrai operacoes comuns:

\`\`\`bash
# CLI da plataforma — exemplos de comandos
platform create service \\
  --name order-service \\
  --team team-orders \\
  --language go \\
  --with-database postgres

platform create namespace \\
  --name team-orders-staging \\
  --team team-orders \\
  --environment staging \\
  --quota medium

platform deploy \\
  --service order-service \\
  --environment production \\
  --version v1.2.3

platform status \\
  --service order-service \\
  --all-envs
\`\`\`

### Medindo Eficacia dos Golden Paths

| Metrica | Como medir | Meta |
|---------|-----------|------|
| Time to first deploy | Tempo desde create ate 1o deploy | < 30 min |
| Golden path adoption | % equipes usando golden paths | > 80% |
| Self-service ratio | Self-service vs tickets manuais | > 90% |
| Developer NPS | Survey trimestral | > 40 |
| Onboarding time | Novo dev -> primeira contribuicao | < 1 dia |
| Incidents from non-golden | Incidentes de quem nao usa golden path | Track |

### Erros Comuns

1. **Golden path unico** — nao existe "one size fits all"; oferecer variantes por linguagem/stack
2. **Path desatualizado** — templates que geram codigo com deps desatualizadas perdem confianca
3. **Sem escape hatch** — devs PRECISAM poder sair do golden path quando necessario
4. **Self-service complexo** — se o formulario tem 30 campos, ninguem usa
5. **Sem feedback loop** — nao coletar metricas de uso e satisfacao
6. **Seguranca como afterthought** — seguranca deve estar embutida no golden path, nao adicionada depois

## Killer.sh Style Challenge

> **Cenario:** Projete golden paths para uma organizacao com 3 linguagens (Go, Java, Python), 2 ambientes (staging, production) e necessidade de provisionar bancos de dados. Defina: (1) quais golden paths criar, (2) como implementar self-service com Crossplane + ArgoCD, (3) que metricas usar para validar adocao.
`,
  quiz: [
    {
      question: 'O que sao Golden Paths em Platform Engineering?',
      options: [
        'Rotas de rede otimizadas entre pods',
        'Workflows padronizados e recomendados para tarefas comuns que sao seguros por padrao mas nao obrigatorios',
        'Pipelines de CI/CD fixos que todos devem seguir',
        'Politicas de seguranca obrigatorias'
      ],
      correct: 1,
      explanation: 'Golden Paths sao caminhos recomendados e otimizados para tarefas como criar servicos, deployar, provisionar infra. Sao seguros por padrao, testados e mantidos pela plataforma, mas devs podem sair do caminho se necessario.',
      reference: 'Conceito relacionado: Tambem chamados "Paved Roads" ou "Happy Paths".'
    },
    {
      question: 'Qual o papel do Crossplane em um IDP?',
      options: [
        'Gerenciar containers Docker',
        'Expor abstracoes de infraestrutura como APIs Kubernetes nativas (CRDs) para self-service',
        'Monitorar aplicacoes',
        'Gerenciar DNS'
      ],
      correct: 1,
      explanation: 'Crossplane permite definir abstrações de infraestrutura como XRDs (CompositeResourceDefinitions) e Compositions. Devs pedem recursos via Claims simples (ex: Database com engine e size) e o Crossplane provisiona a infraestrutura real.',
      reference: 'Conceito relacionado: XRD define a interface, Composition define a implementacao, Claim e o pedido do dev.'
    },
    {
      question: 'Como o ArgoCD ApplicationSet habilita self-service?',
      options: [
        'Criando pipelines de CI automaticamente',
        'Gerando ArgoCD Applications automaticamente baseado em padroes (ex: estrutura de pastas no repo GitOps)',
        'Provisionando clusters Kubernetes',
        'Gerenciando secrets do Vault'
      ],
      correct: 1,
      explanation: 'ApplicationSet usa generators (git, list, cluster) para auto-gerar ArgoCD Applications. Por exemplo, um git generator pode criar um app para cada pasta em teams/*/apps/*, habilitando self-service via commits.',
      reference: 'Conceito relacionado: Devs fazem self-service via Git commits — adicionam pasta = novo app deployado.'
    },
    {
      question: 'Por que Golden Paths NAO devem ser obrigatorios?',
      options: [
        'Porque nao sao seguros',
        'Porque forcar adocao gera resistencia e casos especiais podem precisar de abordagens diferentes',
        'Porque sao muito caros de manter',
        'Porque so funcionam com Kubernetes'
      ],
      correct: 1,
      explanation: 'Forcar adocao gera resistencia e shadow IT. Golden Paths devem ser tao bons que devs QUEIRAM usar. Alem disso, casos especiais (ML workloads, legacy, compliance) podem precisar de abordagens fora do golden path.',
      reference: 'Conceito relacionado: O principio e "attract, not mandate" — atrair, nao obrigar.'
    },
    {
      question: 'Qual o nivel mais alto de self-service em uma plataforma?',
      options: [
        'Portal com formularios',
        'CLI programatico',
        'GitOps declarativo — commit YAML no repo e a automacao provisiona',
        'Tickets automatizados'
      ],
      correct: 2,
      explanation: 'GitOps declarativo e o nivel mais alto: devs fazem commit de YAML no repo de infra e a automacao (ArgoCD/Flux) provisiona tudo. E auditavel, versionado e reproduzivel sem nenhuma interface especial.',
      reference: 'Conceito relacionado: Niveis: Manual → Assistido → Portal → API/CLI → GitOps.'
    },
    {
      question: 'O que e um Crossplane Claim?',
      options: [
        'Uma credencial de acesso',
        'Um pedido de recurso com interface simplificada que o dev faz ao Crossplane',
        'Um tipo de ServiceAccount',
        'Um registro no Backstage Catalog'
      ],
      correct: 1,
      explanation: 'Um Claim e a interface simplificada que o dev usa para pedir recursos. Exemplo: kind: Database com spec.engine: postgres e spec.size: medium. O Crossplane resolve o Claim para os recursos reais via Composition.',
      reference: 'Conceito relacionado: Claim e namespaced, XR (Composite Resource) e cluster-scoped.'
    },
    {
      question: 'Qual metrica indica melhor se os Golden Paths estao funcionando?',
      options: [
        'Numero de deployments por dia',
        'Self-service ratio (percentual de provisionamentos via self-service vs tickets manuais)',
        'Numero de pods rodando',
        'Tamanho dos containers'
      ],
      correct: 1,
      explanation: 'O self-service ratio mede diretamente a eficacia dos golden paths: se devs ainda abrem tickets manuais, o golden path nao esta atendendo. A meta tipica e > 90% de operacoes via self-service.',
      reference: 'Conceito relacionado: Complementar com Developer NPS, time-to-first-deploy e onboarding time.'
    }
  ],
  flashcards: [
    {
      front: 'O que e um Golden Path e quais suas caracteristicas?',
      back: '**Golden Path** = workflow padronizado e otimizado para tarefas comuns.\n\n**Caracteristicas:**\n- Recomendado, NAO obrigatorio\n- Seguro por padrao (security built-in)\n- Testado e mantido pela plataforma\n- Documentado com exemplos\n- Automatizado (minimos passos manuais)\n\n**Exemplos:**\n- Criar novo microservico\n- Provisionar banco de dados\n- Configurar CI/CD pipeline\n- Criar novo ambiente\n\n**Principio:** "Attract, not mandate"'
    },
    {
      front: 'Quais sao os niveis de self-service?',
      back: '| Nivel | Mecanismo | Exemplo |\n|-------|-----------|--------|\n| 0. Manual | Tickets | Jira + Ops |\n| 1. Assistido | Templates + docs | Helm chart + guia |\n| 2. Portal | UI com forms | Backstage Scaffolder |\n| 3. API/CLI | Programatico | platform CLI |\n| 4. GitOps | Declarativo | Commit YAML |\n\n**Meta:** Chegar pelo menos ao nivel 2-3.\n**Ideal:** Nivel 4 (GitOps) para operacoes de infra.'
    },
    {
      front: 'Como o Crossplane habilita self-service de infra?',
      back: '**3 componentes:**\n\n1. **XRD (CompositeResourceDefinition)**\n   Define a interface: quais campos o dev preenche\n   Ex: engine (postgres/mysql), size (small/medium/large)\n\n2. **Composition**\n   Define a implementacao: o que provisionar\n   Ex: RDS Instance, SecurityGroup, Secret\n   Usa patches para mapear campos do XRD para recursos\n\n3. **Claim**\n   O que o dev pede (namespaced)\n   Ex: kind: Database, spec.engine: postgres\n\n**Resultado:** Dev pede "Database postgres medium" e recebe RDS configurado.'
    },
    {
      front: 'Como ApplicationSet habilita self-service via GitOps?',
      back: '**ApplicationSet** auto-gera ArgoCD Applications baseado em generators.\n\n**Exemplo com git generator:**\n- Monitora pastas em teams/*/apps/*\n- Para cada pasta, cria um ArgoCD Application\n- Dev adiciona pasta = novo app deployado\n\n**Self-service flow:**\n1. Dev cria pasta teams/my-team/apps/new-service/\n2. Adiciona kustomization.yaml + manifests\n3. Commit + push\n4. ApplicationSet detecta nova pasta\n5. ArgoCD cria app e faz sync\n\n**Vantagem:** 100% GitOps, auditavel, sem portal necessario.'
    },
    {
      front: 'Quais metricas medem eficacia dos Golden Paths?',
      back: '| Metrica | Meta |\n|---------|------|\n| Time to first deploy | < 30 min |\n| Golden path adoption | > 80% |\n| Self-service ratio | > 90% |\n| Developer NPS | > 40 |\n| Onboarding time | < 1 dia |\n| Incidents from non-golden | Track |\n\n**Como coletar:**\n- DORA metrics pipeline\n- Surveys trimestrais\n- Logs de uso do portal/CLI\n- Contagem de tickets manuais\n- Tracking de incidentes por origem'
    },
    {
      front: 'O que e Namespace self-service com Kyverno?',
      back: '**Kyverno ClusterPolicy** pode auto-configurar namespaces:\n\nQuando um namespace com label managed=true e criado:\n1. **ResourceQuota** gerado automaticamente\n2. **NetworkPolicy** default-deny criada\n3. **LimitRange** aplicado\n4. **RBAC** RoleBinding criado para o team\n\n**Como funciona:**\n- Regras do tipo generate\n- Match por label selector\n- Namespace recebe todos os defaults automaticamente\n\n**Resultado:** Dev cria namespace com um label e recebe toda a configuracao de seguranca e quotas.'
    },
    {
      front: 'Quais erros comuns ao implementar Golden Paths?',
      back: '1. **Golden path unico** — oferecer variantes por stack\n2. **Path desatualizado** — templates com deps velhas\n3. **Sem escape hatch** — devs PRECISAM poder sair\n4. **Self-service complexo** — forms com 30 campos\n5. **Sem feedback loop** — nao medir uso/satisfacao\n6. **Seguranca como afterthought** — deve ser built-in\n\n**Principios de design:**\n- Start small (1-2 golden paths)\n- Iterar baseado em feedback\n- Medir e otimizar\n- Security by default\n- Documentacao como parte do path'
    }
  ],
  lab: {
    scenario: 'Voce precisa implementar golden paths self-service usando Crossplane para infra, ArgoCD para deploy e Kyverno para automacao de namespaces.',
    objective: 'Criar abstrações de infraestrutura com Crossplane, configurar ApplicationSet para self-service GitOps e automação de namespace com Kyverno.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar abstração de banco de dados com Crossplane',
        instruction: `Crie os manifests Crossplane para self-service de banco de dados:
1. Um **CompositeResourceDefinition (XRD)** chamado \`xdatabases.platform.example.com\` com campos: engine (enum: postgres, mysql) e size (enum: small, medium, large)
2. Um **Claim** de exemplo: kind Database, engine postgres, size small, no namespace team-orders`,
        hints: [
          'XRD usa apiVersion: apiextensions.crossplane.io/v1',
          'ClaimNames define o kind que o dev usa (namespaced)',
          'O Claim usa o group e kind definidos no XRD'
        ],
        solution: `\`\`\`yaml
# xrd-database.yaml
apiVersion: apiextensions.crossplane.io/v1
kind: CompositeResourceDefinition
metadata:
  name: xdatabases.platform.example.com
spec:
  group: platform.example.com
  names:
    kind: XDatabase
    plural: xdatabases
  claimNames:
    kind: Database
    plural: databases
  versions:
    - name: v1alpha1
      served: true
      referenceable: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                engine:
                  type: string
                  enum: ["postgres", "mysql"]
                size:
                  type: string
                  enum: ["small", "medium", "large"]
              required:
                - engine
                - size
---
# claim-orders-db.yaml
apiVersion: platform.example.com/v1alpha1
kind: Database
metadata:
  name: orders-db
  namespace: team-orders
spec:
  engine: postgres
  size: small
\`\`\``,
        verify: `\`\`\`bash
# Verificar o XRD
kubectl get xrd xdatabases.platform.example.com
# Saida esperada: XRD listado com ESTABLISHED=True

# Verificar que o CRD de Claim foi criado
kubectl get crd databases.platform.example.com
# Saida esperada: CRD listado

# Verificar o Claim
kubectl get databases -n team-orders
# Saida esperada: orders-db listado
\`\`\``
      },
      {
        title: 'Configurar ArgoCD ApplicationSet para self-service',
        instruction: `Crie um **ApplicationSet** que auto-gera ArgoCD Applications baseado na estrutura de pastas do repo GitOps:
- Repository: https://github.com/org/platform-config
- Padrao de pastas: teams/*/apps/*
- Cada pasta gera um app com nome \`{team}-{app}\`
- Namespace = nome do team
- SyncPolicy automated com prune e selfHeal`,
        hints: [
          'Use git generator com directories',
          'path[2] = nome do team, path[4] = nome do app',
          'syncPolicy.automated habilita auto-sync'
        ],
        solution: `\`\`\`yaml
# applicationset-teams.yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: team-apps
  namespace: argocd
spec:
  generators:
    - git:
        repoURL: https://github.com/org/platform-config
        revision: HEAD
        directories:
          - path: 'teams/*/apps/*'
  template:
    metadata:
      name: '{{path[2]}}-{{path[4]}}'
      labels:
        team: '{{path[2]}}'
        app: '{{path[4]}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/platform-config
        targetRevision: HEAD
        path: '{{path}}'
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{path[2]}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        syncOptions:
          - CreateNamespace=true
\`\`\``,
        verify: `\`\`\`bash
# Aplicar o ApplicationSet
kubectl apply -f applicationset-teams.yaml

# Verificar que o ApplicationSet foi criado
kubectl get applicationset -n argocd team-apps
# Saida esperada: team-apps listado

# Verificar apps gerados (se houver pastas no repo)
kubectl get applications -n argocd -l team
# Saida esperada: apps gerados para cada pasta teams/*/apps/*
\`\`\``
      },
      {
        title: 'Criar automacao de namespace com Kyverno',
        instruction: `Crie uma **ClusterPolicy** do Kyverno que, ao criar um namespace com a label \`platform.example.com/managed: "true"\`, gere automaticamente:
1. Um **ResourceQuota** com limits de CPU (8 cores), memoria (16Gi) e pods (50)
2. Uma **NetworkPolicy** default-deny para ingress`,
        hints: [
          'Use rules com generate para criar recursos automaticamente',
          'Match por label selector no namespace',
          'Cada regra generate cria um recurso no namespace recem-criado'
        ],
        solution: `\`\`\`yaml
# policy-namespace-defaults.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: namespace-defaults
spec:
  rules:
    - name: generate-resource-quota
      match:
        any:
          - resources:
              kinds:
                - Namespace
              selector:
                matchLabels:
                  platform.example.com/managed: "true"
      generate:
        apiVersion: v1
        kind: ResourceQuota
        name: default-quota
        namespace: "{{request.object.metadata.name}}"
        synchronize: true
        data:
          spec:
            hard:
              requests.cpu: "4"
              requests.memory: 8Gi
              limits.cpu: "8"
              limits.memory: 16Gi
              pods: "50"

    - name: generate-network-policy
      match:
        any:
          - resources:
              kinds:
                - Namespace
              selector:
                matchLabels:
                  platform.example.com/managed: "true"
      generate:
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        name: default-deny-ingress
        namespace: "{{request.object.metadata.name}}"
        synchronize: true
        data:
          spec:
            podSelector: {}
            policyTypes:
              - Ingress
---
# Testar: criar namespace managed
apiVersion: v1
kind: Namespace
metadata:
  name: team-orders-dev
  labels:
    platform.example.com/managed: "true"
    team: team-orders
    environment: dev
\`\`\``,
        verify: `\`\`\`bash
# Aplicar a policy
kubectl apply -f policy-namespace-defaults.yaml

# Verificar que a policy esta pronta
kubectl get clusterpolicy namespace-defaults
# Saida esperada: namespace-defaults com READY=true

# Criar namespace de teste
kubectl create namespace test-golden-path --dry-run=client -o yaml | \\
  kubectl label --local -f - platform.example.com/managed=true -o yaml | \\
  kubectl apply -f -

# Verificar recursos gerados
kubectl get resourcequota -n test-golden-path
# Saida esperada: default-quota listado

kubectl get networkpolicy -n test-golden-path
# Saida esperada: default-deny-ingress listado
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Crossplane Claim fica em estado Waiting',
      difficulty: 'medium',
      symptom: 'O dev criou um Claim (ex: kind: Database) mas o recurso fica em estado Waiting e nunca provisiona.',
      diagnosis: `\`\`\`bash
# 1. Verificar status do Claim
kubectl describe database orders-db -n team-orders
# Procurar por Events e Conditions

# 2. Verificar se existe Composition compativel
kubectl get compositions -l crossplane.io/xrd-kind=XDatabase
# Deve retornar pelo menos uma Composition

# 3. Verificar se o XRD esta established
kubectl get xrd xdatabases.platform.example.com
# ESTABLISHED deve ser True

# 4. Verificar logs do Crossplane
kubectl logs -n crossplane-system deploy/crossplane -c crossplane

# 5. Verificar se o Provider esta instalado e saudavel
kubectl get providers
kubectl get providerconfigs
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Sem Composition compativel:** O Claim precisa de uma Composition que referencia o mesmo XRD. Verificar compositeTypeRef na Composition.

2. **Provider nao instalado:** O Provider (ex: provider-aws) precisa estar instalado e com ProviderConfig valido. Verificar credenciais.

3. **XRD nao established:** Se o XRD tem erro de schema, o CRD nao e criado. Verificar eventos do XRD.

4. **Selector nao match:** Se a Composition usa labels, o Claim precisa ter compositionSelector ou compositionRef correto.

5. **Credenciais invalidas:** O Provider precisa de credenciais validas para provisionar recursos na cloud. Verificar o Secret referenciado pelo ProviderConfig.`
    },
    {
      title: 'ApplicationSet nao gera Applications para novas pastas',
      difficulty: 'medium',
      symptom: 'Um dev adicionou uma nova pasta em teams/my-team/apps/new-service/ no repo GitOps mas o ArgoCD nao criou o Application automaticamente.',
      diagnosis: `\`\`\`bash
# 1. Verificar status do ApplicationSet
kubectl get applicationset -n argocd team-apps -o yaml
# Verificar spec.generators e status

# 2. Verificar logs do ApplicationSet controller
kubectl logs -n argocd deploy/argocd-applicationset-controller | tail -30

# 3. Verificar se o repo esta acessivel
argocd repo list
# O repo deve estar listado e com status Successful

# 4. Verificar se a pasta segue o padrao
# O path pattern no generator deve corresponder a estrutura real
# Ex: 'teams/*/apps/*' requer exatamente essa profundidade

# 5. Verificar se o commit foi para a branch correta
# O ApplicationSet monitora a revision configurada (HEAD = default branch)
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Pasta nao segue o padrao:** O git generator com directories usa glob patterns. A pasta deve corresponder exatamente ao padrao (ex: teams/team-x/apps/service-y/ — 4 niveis).

2. **Repo nao cadastrado no ArgoCD:** O repositorio deve estar registrado no ArgoCD com credenciais validas.

3. **Branch errada:** Se revision: HEAD, o commit deve ir para a branch default. Se o dev fez push para uma feature branch, o ApplicationSet nao detecta.

4. **Rate limit do Git polling:** O ArgoCD faz polling do repo em intervalos. Pode levar ate 3 minutos para detectar mudancas. Forcar com: kubectl rollout restart deploy/argocd-applicationset-controller -n argocd.

5. **Pasta vazia ou sem manifests validos:** A pasta precisa conter manifests Kubernetes validos ou kustomization.yaml para o ArgoCD processar.`
    },
    {
      title: 'Kyverno nao gera recursos ao criar namespace',
      difficulty: 'hard',
      symptom: 'Ao criar um namespace com a label platform.example.com/managed=true, o ResourceQuota e NetworkPolicy nao sao gerados automaticamente.',
      diagnosis: `\`\`\`bash
# 1. Verificar status da ClusterPolicy
kubectl get clusterpolicy namespace-defaults
# READY deve ser true, BACKGROUND deve estar ok

# 2. Verificar se a label esta correta no namespace
kubectl get namespace team-test --show-labels
# Deve ter platform.example.com/managed=true

# 3. Verificar eventos no namespace
kubectl describe namespace team-test
# Procurar por eventos do Kyverno

# 4. Verificar logs do Kyverno
kubectl logs -n kyverno deploy/kyverno-admission-controller | grep -i "namespace-defaults"

# 5. Verificar PolicyReport
kubectl get policyreport -n team-test
kubectl describe policyreport -n team-test
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Label aplicada apos criacao:** Se o namespace foi criado sem a label e depois a label foi adicionada, a regra generate pode nao disparar. O match avalia no momento da criacao. Solucao: deletar e recriar o namespace com a label.

2. **Kyverno webhook nao configurado:** Verificar que os webhooks do Kyverno estao registrados: kubectl get mutatingwebhookconfigurations | grep kyverno.

3. **Policy com erro de syntax:** Verificar se a policy esta READY. Se nao, verificar eventos: kubectl describe clusterpolicy namespace-defaults.

4. **Permissao RBAC:** O ServiceAccount do Kyverno precisa de permissao para criar ResourceQuota e NetworkPolicy nos namespaces. Verificar ClusterRole.

5. **Conflito com outros controllers:** Se outro controller ou admission webhook intervem, o recurso gerado pode ser bloqueado. Verificar logs de admission.`
    }
  ]
};
