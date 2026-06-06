window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['crossplane/crossplane-compositions'] = {
  theory: `
# Crossplane Compositions & XRDs

## Relevancia
Compositions e XRDs sao o nivel mais avancado do Crossplane — onde voce define sua propria API de plataforma. Em vez de expor MRs diretamente (provider-aws-s3), voce cria abstractions (Databases, Environments, Applications) que times de desenvolvimento consomem sem precisar conhecer os detalhes da cloud. Este e o verdadeiro poder do "Platform Engineering" com Crossplane.

## ⚠️ Currency: Pipeline (Functions) e o modo ATUAL — Patch-and-Transform e legado
> **Importante (Crossplane v1.17+):** o modo nativo **Patch-and-Transform** (campo \`spec.resources\` com \`patches\`/\`transforms\` direto na Composition) esta **DEPRECATED**. O modo recomendado e **default** hoje e o **Pipeline mode** com **Composition Functions** (\`spec.mode: Pipeline\` + \`spec.pipeline\`). Ate a logica de P&T classica agora roda como uma *function* (\`function-patch-and-transform\`).
>
> **O que isso muda na pratica:**
> - Escreva novas Compositions com \`mode: Pipeline\`. Nao internalize \`spec.resources\` como o jeito "normal".
> - P&T vira *um passo* dentro do pipeline (via \`function-patch-and-transform\`), nao o mecanismo raiz.
> - Functions permitem logica que P&T nunca conseguiu: loops, condicionais, templates (KCL/Go-templating), validacao, e composicao de varias functions em sequencia.
> - As secoes abaixo sobre \`patches\`/\`transforms\` continuam validas como **referencia conceitual** (e porque voce vai ve-las em Compositions existentes), mas o **alvo** e o Pipeline mode mostrado em "Composition com Pipeline Mode (Functions)".

## Conceitos Fundamentais

### A Hierarquia Completa

\`\`\`
CompositeResourceDefinition (XRD)
└── Define o schema da sua API customizada
    ex: apiVersion: platform.acme.io/v1alpha1, kind: XDatabase

Composition
└── Define COMO o XRD e implementado
    ex: XDatabase → RDS + SubnetGroup + SecurityGroup + Secret

CompositeResource (XR)
└── Instancia de nivel cluster (cluster-scoped)
    Criado diretamente ou via Claim

Claim (XRC)
└── Instancia de nivel namespace (namespace-scoped)
    Criado por desenvolvedores — abstrai a cloud completamente
\`\`\`

### CompositeResourceDefinition (XRD)

\`\`\`yaml
apiVersion: apiextensions.crossplane.io/v1
kind: CompositeResourceDefinition
metadata:
  name: xdatabases.platform.acme.io
spec:
  group: platform.acme.io
  names:
    kind: XDatabase
    plural: xdatabases
  claimNames:
    kind: Database           # Claim namespace-scoped
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
                parameters:
                  type: object
                  properties:
                    size:
                      type: string
                      enum: [small, medium, large]
                      default: small
                    region:
                      type: string
                      default: us-east-1
                    storageGB:
                      type: integer
                      default: 20
                      minimum: 20
                      maximum: 500
                    engine:
                      type: string
                      enum: [postgres, mysql]
                      default: postgres
                  required:
                    - size
\`\`\`

### Composition Basica

\`\`\`yaml
apiVersion: apiextensions.crossplane.io/v1
kind: Composition
metadata:
  name: xdatabases-aws
  labels:
    provider: aws
    environment: production
spec:
  compositeTypeRef:
    apiVersion: platform.acme.io/v1alpha1
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
            engineVersion: "15.4"
            dbInstanceClass: db.t3.micro
            allocatedStorage: 20
            skipFinalSnapshot: true
          providerConfigRef:
            name: aws-production
          deletionPolicy: Orphan
      patches:
        - type: FromCompositeFieldPath
          fromFieldPath: spec.parameters.region
          toFieldPath: spec.forProvider.region
        - type: FromCompositeFieldPath
          fromFieldPath: spec.parameters.storageGB
          toFieldPath: spec.forProvider.allocatedStorage
        - type: FromCompositeFieldPath
          fromFieldPath: spec.parameters.engine
          toFieldPath: spec.forProvider.engine
        - type: FromCompositeFieldPath
          fromFieldPath: spec.parameters.size
          toFieldPath: spec.forProvider.dbInstanceClass
          transforms:
            - type: map
              map:
                small: db.t3.micro
                medium: db.t3.medium
                large: db.r5.large
      connectionDetails:
        - type: FromConnectionSecretKey
          name: endpoint
          fromConnectionSecretKey: endpoint
        - type: FromConnectionSecretKey
          name: port
          fromConnectionSecretKey: port
        - type: FromConnectionSecretKey
          name: username
          fromConnectionSecretKey: username
        - type: FromConnectionSecretKey
          name: password
          fromConnectionSecretKey: password
\`\`\`

### Patches — Tipos Principais

\`\`\`yaml
patches:
  # 1. Do composite para o recurso (mais comum)
  - type: FromCompositeFieldPath
    fromFieldPath: spec.parameters.region
    toFieldPath: spec.forProvider.region

  # 2. Do recurso para o composite (status feedback)
  - type: ToCompositeFieldPath
    fromFieldPath: status.atProvider.endpoint
    toFieldPath: status.address

  # 3. Valor literal
  - type: FromCompositeFieldPath
    fromFieldPath: metadata.labels["environment"]
    toFieldPath: spec.forProvider.tags["Environment"]

  # 4. Com transform
  - type: FromCompositeFieldPath
    fromFieldPath: spec.parameters.size
    toFieldPath: spec.forProvider.dbInstanceClass
    transforms:
      - type: map
        map:
          small: db.t3.micro
          medium: db.t3.medium
          large: db.r5.large

  # 5. Convert type
  - type: FromCompositeFieldPath
    fromFieldPath: spec.parameters.storageGB
    toFieldPath: spec.forProvider.allocatedStorage
    transforms:
      - type: convert
        convert:
          toType: string

  # 6. String format
  - type: FromCompositeFieldPath
    fromFieldPath: metadata.name
    toFieldPath: spec.forProvider.tags.Name
    transforms:
      - type: string
        string:
          fmt: "db-%s-prod"
\`\`\`

### Transforms Disponiveis

\`\`\`yaml
# map: lookup table
transforms:
  - type: map
    map:
      dev: t3.micro
      staging: t3.medium
      prod: r5.large

# string: formatacao
transforms:
  - type: string
    string:
      fmt: "prefix-%s-suffix"     # sprintf style
      # OU
      convert: ToUpper             # ToUpper, ToLower, ToBase64, FromBase64

# math: operacoes aritmeticas
transforms:
  - type: math
    math:
      multiply: 2                  # multiplica por 2

# convert: mudanca de tipo
transforms:
  - type: convert
    convert:
      toType: string               # string, int64, float64, bool

# match: regexp
transforms:
  - type: match
    match:
      patterns:
        - type: regexp
          regexp: "^prod-.*"
          result: production
        - type: literal
          literal: "staging"
          result: staging
      fallbackValue: development
\`\`\`

### Composition com Pipeline Mode (Functions)

\`\`\`yaml
# Crossplane v1.14+ suporta Functions (modo pipeline)
# Mais poderoso que patches simples — permite logica complexa

apiVersion: apiextensions.crossplane.io/v1
kind: Composition
metadata:
  name: xdatabases-pipeline
spec:
  compositeTypeRef:
    apiVersion: platform.acme.io/v1alpha1
    kind: XDatabase
  mode: Pipeline                   # Novo modo pipeline
  pipeline:
    - step: patch-and-transform
      functionRef:
        name: function-patch-and-transform   # Function instalada
      input:
        apiVersion: pt.fn.crossplane.io/v1beta1
        kind: Resources
        resources:
          - name: rds-instance
            base:
              apiVersion: rds.aws.upbound.io/v1beta1
              kind: Instance
              spec:
                forProvider:
                  region: us-east-1
                  engine: postgres
            patches:
              - type: FromCompositeFieldPath
                fromFieldPath: spec.parameters.region
                toFieldPath: spec.forProvider.region
    - step: auto-ready
      functionRef:
        name: function-auto-ready          # Marca composite Ready automaticamente
\`\`\`

### Instalando Functions

\`\`\`yaml
# function-patch-and-transform
apiVersion: pkg.crossplane.io/v1beta1
kind: Function
metadata:
  name: function-patch-and-transform
spec:
  package: xpkg.upbound.io/crossplane-contrib/function-patch-and-transform:v0.6.0
---
# function-auto-ready
apiVersion: pkg.crossplane.io/v1beta1
kind: Function
metadata:
  name: function-auto-ready
spec:
  package: xpkg.upbound.io/crossplane-contrib/function-auto-ready:v0.3.0
\`\`\`

### Criando um Claim (do ponto de vista do desenvolvedor)

\`\`\`yaml
# O developer NAO precisa saber sobre AWS, RDS ou Crossplane internals
apiVersion: platform.acme.io/v1alpha1
kind: Database                      # Claim (namespace-scoped)
metadata:
  name: my-app-db
  namespace: team-alpha
spec:
  parameters:
    size: small
    region: us-east-1
    storageGB: 50
    engine: postgres
  compositionSelector:
    matchLabels:
      provider: aws                 # Seleciona qual Composition usar
  writeConnectionSecretToRef:
    name: my-app-db-connection      # Secret com credenciais no mesmo namespace
\`\`\`

### Composition com multiplos recursos

\`\`\`yaml
# Ambiente completo: VPC + Subnet + SG + RDS
apiVersion: apiextensions.crossplane.io/v1
kind: Composition
metadata:
  name: xenvironments-full-aws
spec:
  compositeTypeRef:
    apiVersion: platform.acme.io/v1alpha1
    kind: XEnvironment
  resources:
    - name: vpc
      base:
        apiVersion: ec2.aws.upbound.io/v1beta1
        kind: VPC
        spec:
          forProvider:
            region: us-east-1
            cidrBlock: 10.0.0.0/16
            enableDnsHostnames: true
          providerConfigRef:
            name: aws-production
      patches:
        - type: FromCompositeFieldPath
          fromFieldPath: spec.parameters.region
          toFieldPath: spec.forProvider.region

    - name: subnet-a
      base:
        apiVersion: ec2.aws.upbound.io/v1beta1
        kind: Subnet
        spec:
          forProvider:
            region: us-east-1
            cidrBlock: 10.0.1.0/24
            availabilityZone: us-east-1a
            vpcIdSelector:
              matchControllerRef: true  # Referencia VPC criada nessa mesma Composition
          providerConfigRef:
            name: aws-production

    - name: database
      base:
        apiVersion: rds.aws.upbound.io/v1beta1
        kind: Instance
        spec:
          forProvider:
            region: us-east-1
            engine: postgres
            engineVersion: "15.4"
            dbInstanceClass: db.t3.micro
            allocatedStorage: 20
            skipFinalSnapshot: true
          writeConnectionSecretsToRef:
            namespace: crossplane-system
            name: db-connection-details
          providerConfigRef:
            name: aws-production
      patches:
        - type: FromCompositeFieldPath
          fromFieldPath: spec.parameters.dbSize
          toFieldPath: spec.forProvider.dbInstanceClass
          transforms:
            - type: map
              map:
                small: db.t3.micro
                medium: db.t3.medium
                large: db.r5.large
      connectionDetails:
        - fromConnectionSecretKey: endpoint
          name: endpoint
        - fromConnectionSecretKey: port
          name: port
        - fromConnectionSecretKey: password
          name: password
\`\`\`

### Selecao de Composition

\`\`\`yaml
# Metodo 1: compositionRef (nome exato)
spec:
  compositionRef:
    name: xdatabases-aws

# Metodo 2: compositionSelector (por labels)
spec:
  compositionSelector:
    matchLabels:
      provider: aws
      environment: production

# Metadata da Composition para correspondencia:
metadata:
  labels:
    provider: aws
    environment: production
\`\`\`

### Erros Comuns

1. **Patch path errado** — \`fromFieldPath\` ou \`toFieldPath\` com caminho incorreto; usar \`--dry-run=server\` para validar
2. **Faltando required fields no schema** — XRD com \`required\` mas Claim nao inclui o campo
3. **matchControllerRef mal entendido** — \`matchControllerRef: true\` seleciona recursos criados pela MESMA Composition instance (necessario para VPC → Subnet)
4. **Pipeline mode sem Function instalada** — Composition com mode: Pipeline falha se a Function referenciada nao estiver instalada e Healthy
5. **writeConnectionSecretToRef em namespace errado** — O Secret de conexao e criado no namespace do Claim; verificar RBAC do Provider

## Killer.sh Style Challenge

> **Cenario:** Crie um XRD chamado \`XWebApp\` no grupo \`platform.acme.io/v1alpha1\` com um Claim chamado \`WebApp\`. O XRD deve ter parametros: \`tier\` (free/standard/enterprise) e \`region\`. Crie uma Composition que, para cada WebApp, provisione um S3 Bucket com nome baseado no metadata.name do Claim e tags adequadas. Use transform type map para mapear tier→storageClass (free: STANDARD, standard: STANDARD_IA, enterprise: GLACIER_IR).
`,
  quiz: [
    {
      question: 'Qual a diferenca entre um CompositeResource (XR) e um Claim (XRC)?',
      options: [
        'XR e mais poderoso que Claim',
        'XR e cluster-scoped (criado por admins), Claim e namespace-scoped (criado por developers) — ambos instanciam a mesma Composition',
        'Claims so podem ser usados em producao',
        'XR e o mesmo que Managed Resource'
      ],
      correct: 1,
      explanation: 'XR (CompositeResource) e cluster-scoped — criado por engenheiros de plataforma. Claim e namespace-scoped — criado por developers dentro de um namespace. Ambos instanciam a mesma Composition. Claims sao o ponto de consumo para times de desenvolvimento.',
      reference: 'Conceito relacionado: Um Claim cria automaticamente um XR correspondente na camada cluster.'
    },
    {
      question: 'O que define um CompositeResourceDefinition (XRD)?',
      options: [
        'Quais Managed Resources serao usados',
        'O schema da API customizada: grupo, kind, plural, claimNames e schema OpenAPI dos campos aceitos',
        'Quais Providers instalar',
        'O namespace onde os recursos serao criados'
      ],
      correct: 1,
      explanation: 'O XRD define a API customizada: o grupo (platform.acme.io), o kind (XDatabase), o nome do Claim (Database), e o schema OpenAPIV3 dos parametros aceitos. Pense no XRD como um CRD de nivel superior — ele cria novos CRDs no cluster.',
      reference: 'Conceito relacionado: XRDs sao semelhantes a CRDs — ambos criam novos tipos de recursos K8s. A diferenca e que XRDs geram dois CRDs (XR + Claim).'
    },
    {
      question: 'Qual patch type envia um valor DO recurso filho DE VOLTA para o composite?',
      options: [
        'FromCompositeFieldPath',
        'ToCompositeFieldPath',
        'CombineFromComposite',
        'PatchSet'
      ],
      correct: 1,
      explanation: 'ToCompositeFieldPath flui do recurso filho (MR) para o composite. Muito usado para propagar status: o endpoint do RDS pode ser copiado para status.address do XDatabase para que o Claim possa ler.',
      reference: 'Conceito relacionado: FromCompositeFieldPath e o oposto — flui do composite para o recurso filho. E o tipo mais comum.'
    },
    {
      question: 'Como um Subnet pode referenciar a VPC criada na mesma Composition?',
      options: [
        'Usando vpcId hardcoded',
        'Usando vpcIdSelector.matchControllerRef: true — seleciona automaticamente o recurso com o mesmo controller ref',
        'Usando uma variavel de ambiente',
        'Nao e possivel referenciar recursos na mesma Composition'
      ],
      correct: 1,
      explanation: 'matchControllerRef: true e a forma recomendada para referenciar recursos criados pela mesma instancia de Composition. O Crossplane injeta automaticamente o controllerRef em todos os recursos criados por uma Composition, permitindo selecao segura.',
      reference: 'Conceito relacionado: Alternativa: usar vpcIdRef.name com o nome esperado do recurso, mas matchControllerRef e mais robusto.'
    },
    {
      question: 'Qual transform converte "small" → "db.t3.micro" e "large" → "db.r5.large"?',
      options: [
        'type: string',
        'type: map — define um lookup table de valores de entrada para saida',
        'type: convert',
        'type: match'
      ],
      correct: 1,
      explanation: 'O transform type: map e uma lookup table que converte valores de entrada para valores de saida. Perfeito para mapear tiers/sizes para instancias cloud concretas. A chave e o valor de entrada, o valor e a saida.',
      reference: 'Conceito relacionado: type: match usa regexp patterns para mapeamentos mais complexos.'
    },
    {
      question: 'O que e o modo Pipeline em Compositions?',
      options: [
        'Uma forma de executar Compositions em paralelo',
        'Um modo de Composition que usa Functions encadeadas para logica mais complexa que patches simples',
        'Um pipeline CI/CD integrado ao Crossplane',
        'Uma forma de versionar Compositions'
      ],
      correct: 1,
      explanation: 'Pipeline mode (Crossplane v1.14+) permite usar Composition Functions — programas que implementam logica de composicao complexa. As Functions sao encadeadas em steps, cada uma recebendo e modificando o conjunto de recursos desejados. Mais poderoso que patches declarativos.',
      reference: 'Conceito relacionado: function-patch-and-transform implementa patches/transforms no modo pipeline. function-auto-ready define automaticamente o composite como Ready.'
    },
    {
      question: 'Como um developer seleciona qual Composition usar ao criar um Claim?',
      options: [
        'O developer nao pode escolher — sempre usa a Composition default',
        'Usando compositionRef (nome exato) ou compositionSelector (labels) no spec do Claim',
        'Usando annotations no Claim',
        'Configurando o XRD com uma Composition padrao obrigatoria'
      ],
      correct: 1,
      explanation: 'O Claim pode especificar compositionRef.name (nome exato) ou compositionSelector.matchLabels (selecao por labels). Isso permite ter multiplas Compositions para o mesmo XRD — ex: uma para AWS, outra para GCP — e o developer escolhe via label.',
      reference: 'Conceito relacionado: O XRD pode ter um defaultCompositionRef para casos onde o Claim nao especifica.'
    },
    {
      question: 'Onde as credenciais de conexao (endpoint, senha) chegam para o developer apos criar um Claim?',
      options: [
        'Nas annotations do Claim',
        'Em um Secret no mesmo namespace do Claim, especificado em writeConnectionSecretToRef',
        'Em um ConfigMap no namespace crossplane-system',
        'Nos eventos do Claim'
      ],
      correct: 1,
      explanation: 'O Claim pode especificar writeConnectionSecretToRef.name e o Crossplane cria um Secret nesse namespace com as credenciais propagadas via connectionDetails da Composition. O developer monta esse Secret na aplicacao sem nunca ver as credenciais diretamente.',
      reference: 'Conceito relacionado: connectionDetails na Composition define quais keys do Secret do MR filho sao propagadas para o Secret do Claim.'
    }
  ],
  flashcards: [
    {
      front: 'Qual a hierarquia completa de abstractions no Crossplane?',
      back: '**4 camadas:**\n\n1. **MR (Managed Resource)**\n   Provider-level, 1:1 com recurso cloud\n   ex: Bucket, Instance, VPC\n\n2. **XRD (CompositeResourceDefinition)**\n   Define a API customizada (schema)\n   ex: XDatabase, XEnvironment\n\n3. **Composition**\n   Implementa o XRD usando MRs\n   Define patches, transforms, connectionDetails\n\n4. **XR (CompositeResource)**\n   Instancia cluster-scoped\n\n4a. **Claim (XRC)**\n   Instancia namespace-scoped\n   Criado por developers\n   Cria XR automaticamente\n\n**Fluxo:**\nClaim → XR → Composition → MRs → Cloud Resources'
    },
    {
      front: 'Quais tipos de patches existem em Compositions?',
      back: '**FromCompositeFieldPath** (mais comum)\nDo composite para o recurso filho\n\n**ToCompositeFieldPath**\nDo recurso filho para o composite\n(propagacao de status)\n\n**CombineFromComposite**\nCombina multiplos campos do composite\nem um campo do recurso filho\n\n**CombineToComposite**\nCombina campos do recurso filho\nno composite\n\n**FromEnvironmentFieldPath**\nDo EnvironmentConfig para o recurso\n\n**PatchSets**\nGrupos de patches reutilizaveis\ndefinidos no nivel da Composition'
    },
    {
      front: 'Quais transforms estao disponiveis em patches?',
      back: '**map** — lookup table\nsmall → db.t3.micro\n\n**string** — formatacao\nfmt: "prefix-%s"\nconvert: ToUpper/ToLower/ToBase64\n\n**math** — operacoes aritmeticas\nmultiply: 2\n\n**convert** — mudanca de tipo\ntoType: string/int64/float64/bool\n\n**match** — regexp ou literal patterns\nPatterns com fallbackValue\n\n**Encadeamento:**\nVarios transforms podem ser encadeados\nna ordem em que aparecem na lista.\nCada transform recebe o output do anterior.'
    },
    {
      front: 'O que e matchControllerRef e quando usar?',
      back: '**O que e:**\n`vpcIdSelector.matchControllerRef: true`\n\nSeleciona automaticamente o recurso\n(VPC, por exemplo) que foi criado pela\nMESMA instancia de Composition.\n\n**Por que usar:**\nEm uma Composition com VPC + Subnet,\no Subnet precisa do ID da VPC.\nComo o nome da VPC e gerado\nautomaticamente, nao ha como hardcodar.\n\nmatchControllerRef resolve isso:\nbusca VPC criada por este mesmo XR.\n\n**Implementacao:**\n\`\`\`yaml\nspec:\n  forProvider:\n    vpcIdSelector:\n      matchControllerRef: true\n\`\`\`\n\n**Alternativa:**\nvpcIdRef.name com nome previsivel,\nmas matchControllerRef e mais robusto.'
    },
    {
      front: 'Como funciona writeConnectionSecretToRef em Claims?',
      back: '**Fluxo de propagacao:**\n\n1. MR (RDS) exporta para Secret\n   via writeConnectionSecretsToRef\n   no namespace crossplane-system\n\n2. Composition define connectionDetails\n   para cada recurso, mapeando keys\n   do Secret do MR para o Claim\n\n3. Claim especifica:\n\`\`\`yaml\nwriteConnectionSecretToRef:\n  name: my-app-db-connection\n\`\`\`\n\n4. Crossplane cria Secret\n   no namespace do Claim com\n   as keys mapeadas\n\n5. Developer monta o Secret\n   na aplicacao sem ver detalhes\n   de infraestrutura\n\n**Keys tipicas:** endpoint, port,\nusername, password, connectionString'
    },
    {
      front: 'Composition mode: Resources vs Pipeline',
      back: '**mode: Resources (default)**\n- Patches declarativos simples\n- Transforms embutidos\n- Limitado a operacoes de campo\n- Sem logica condicional complexa\n\n**mode: Pipeline (v1.14+)**\n- Usa Composition Functions\n- Steps encadeados\n- Logica complexa via Functions\n- Suporta Go, Python, etc.\n\n**Functions comuns:**\n- function-patch-and-transform\n  (reimplementa Resources mode)\n- function-auto-ready\n  (marca composite Ready)\n- function-go-templating\n  (templates Go para YAML)\n- function-kcl\n  (KCL language para composicao)\n\n**Quando usar Pipeline:**\nLogica condicional, loops,\nmultiplas fontes de dados,\nou composicao programatica.'
    },
    {
      front: 'XRD schema — campos obrigatorios vs opcionais',
      back: '**Campos XRD obrigatorios:**\n- spec.group: dominio da API\n- spec.names.kind: CamelCase kind\n- spec.names.plural: lowercase plural\n- spec.versions[].name: ex "v1alpha1"\n- spec.versions[].served: true\n- spec.versions[].referenceable: true\n\n**Campos opcionais importantes:**\n- spec.claimNames: habilita Claims\n- spec.versions[].schema: OpenAPIV3\n- spec.defaultCompositionRef\n- spec.enforcedCompositionRef\n\n**OpenAPIV3 schema:**\nDefine validacao dos parametros.\nPode ter required, enum, default,\nminimum, maximum, pattern.\n\n**Dica:** Adicionar default values\nos parametros para facilitar\no uso pelos developers.'
    }
  ],
  lab: {
    scenario: 'Voce e um Platform Engineer e precisa criar uma API de banco de dados para times de desenvolvimento. Os developers devem conseguir pedir um banco PostgreSQL especificando apenas tamanho e regiao — sem conhecer nada de AWS.',
    objective: 'Criar um XRD, uma Composition e um Claim para abstrair a criacao de RDS PostgreSQL no AWS.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Criar o CompositeResourceDefinition (XRD)',
        instruction: `Defina a API customizada para banco de dados:
1. Criar um XRD chamado XDatabase no grupo platform.acme.io/v1alpha1
2. Habilitar Claims com kind Database
3. Definir parametros: size (small/medium/large), region (string, default us-east-1), storageGB (integer, 20-500)
4. Aplicar o XRD e verificar que os CRDs foram criados`,
        hints: [
          'O nome do XRD deve ser no formato plural.group (xdatabases.platform.acme.io)',
          'versions[0].referenceable deve ser true para a versao principal',
          'Verificar com kubectl get crds | grep platform.acme.io'
        ],
        solution: `\`\`\`yaml
# xrd.yaml
apiVersion: apiextensions.crossplane.io/v1
kind: CompositeResourceDefinition
metadata:
  name: xdatabases.platform.acme.io
spec:
  group: platform.acme.io
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
                parameters:
                  type: object
                  properties:
                    size:
                      type: string
                      enum: [small, medium, large]
                      default: small
                    region:
                      type: string
                      default: us-east-1
                    storageGB:
                      type: integer
                      default: 20
                      minimum: 20
                      maximum: 500
                  required:
                    - size
\`\`\`

\`\`\`bash
kubectl apply -f xrd.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar XRD criado e Established
kubectl get xrd xdatabases.platform.acme.io
# Saida esperada: ESTABLISHED=True OFFERED=True

# Verificar CRDs gerados automaticamente
kubectl get crds | grep platform.acme.io
# Saida esperada:
# xdatabases.platform.acme.io
# databases.platform.acme.io

# Verificar que o XRD esta Established
kubectl describe xrd xdatabases.platform.acme.io | grep -A5 "Conditions:"
# Saida esperada: Type: Established, Status: True
\`\`\``
      },
      {
        title: 'Criar a Composition',
        instruction: `Crie a implementacao AWS do XDatabase:
1. Criar uma Composition que mapeia XDatabase para um RDS Instance
2. Usar patches para propagar region, storageGB e size → dbInstanceClass
3. Usar transform type map para converter size → instancia RDS
4. Conectar a Composition ao XRD via compositeTypeRef`,
        hints: [
          'compositeTypeRef deve apontar para o XRD que voce criou',
          'Use transforms.map para mapear small/medium/large para tipos de instancia',
          'deletionPolicy: Orphan em dev para nao excluir acidentalmente'
        ],
        solution: `\`\`\`yaml
# composition.yaml
apiVersion: apiextensions.crossplane.io/v1
kind: Composition
metadata:
  name: xdatabases-aws
  labels:
    provider: aws
    cloud: aws
spec:
  compositeTypeRef:
    apiVersion: platform.acme.io/v1alpha1
    kind: XDatabase
  resources:
    - name: rds-instance
      base:
        apiVersion: rds.aws.upbound.io/v1beta1
        kind: Instance
        spec:
          forProvider:
            engine: postgres
            engineVersion: "15.4"
            dbInstanceClass: db.t3.micro
            allocatedStorage: 20
            skipFinalSnapshot: true
            publiclyAccessible: false
            autoMinorVersionUpgrade: true
          writeConnectionSecretsToRef:
            namespace: crossplane-system
            name: db-conn-placeholder
          providerConfigRef:
            name: aws-production
          deletionPolicy: Orphan
      patches:
        - type: FromCompositeFieldPath
          fromFieldPath: spec.parameters.region
          toFieldPath: spec.forProvider.region
        - type: FromCompositeFieldPath
          fromFieldPath: spec.parameters.storageGB
          toFieldPath: spec.forProvider.allocatedStorage
        - type: FromCompositeFieldPath
          fromFieldPath: spec.parameters.size
          toFieldPath: spec.forProvider.dbInstanceClass
          transforms:
            - type: map
              map:
                small: db.t3.micro
                medium: db.t3.medium
                large: db.r5.large
        - type: FromCompositeFieldPath
          fromFieldPath: metadata.uid
          toFieldPath: spec.writeConnectionSecretsToRef.name
          transforms:
            - type: string
              string:
                fmt: "db-%s-conn"
      connectionDetails:
        - type: FromConnectionSecretKey
          name: endpoint
          fromConnectionSecretKey: endpoint
        - type: FromConnectionSecretKey
          name: port
          fromConnectionSecretKey: port
        - type: FromConnectionSecretKey
          name: username
          fromConnectionSecretKey: username
        - type: FromConnectionSecretKey
          name: password
          fromConnectionSecretKey: password
\`\`\`

\`\`\`bash
kubectl apply -f composition.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar Composition criada
kubectl get composition xdatabases-aws
# Saida esperada: REVISION=1 XR-KIND=XDatabase XR-APIVERSION=platform.acme.io/v1alpha1 AGE=...

# Ver detalhes da Composition
kubectl describe composition xdatabases-aws | head -30

# Verificar que o XRD esta pronto para Compositions
kubectl get xrd xdatabases.platform.acme.io -o jsonpath='{.status.conditions[?(@.type=="Established")].status}'
# Saida esperada: True
\`\`\``
      },
      {
        title: 'Criar um Claim e verificar provisionamento',
        instruction: `Simule o workflow do developer criando um Claim:
1. Criar um namespace team-alpha
2. Criar um Claim do tipo Database no namespace team-alpha com size: small
3. Verificar que o XR (CompositeResource) foi criado automaticamente
4. Verificar a cadeia de recursos: Claim → XR → MR
5. Verificar logs e conditions para entender o ciclo de vida`,
        hints: [
          'O Claim usa kind: Database (do claimNames no XRD)',
          'Verificar kubectl get xdatabases para ver o XR gerado',
          'kubectl get managed mostra todos os MRs criados pela Composition'
        ],
        solution: `\`\`\`bash
# Criar namespace do time
kubectl create namespace team-alpha
\`\`\`

\`\`\`yaml
# database-claim.yaml
apiVersion: platform.acme.io/v1alpha1
kind: Database
metadata:
  name: app-database
  namespace: team-alpha
spec:
  parameters:
    size: small
    region: us-east-1
    storageGB: 30
  compositionSelector:
    matchLabels:
      provider: aws
  writeConnectionSecretToRef:
    name: app-database-credentials
\`\`\`

\`\`\`bash
kubectl apply -f database-claim.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar o Claim
kubectl get database app-database -n team-alpha
# Saida esperada: READY=False SYNCED=True (provisioning em andamento)

# Verificar o XR criado automaticamente
kubectl get xdatabases
# Saida esperada: XDatabase criado pelo Claim

# Verificar o MR criado pela Composition
kubectl get managed
# Saida esperada: instances.rds.aws.upbound.io com READY=False (aguardando RDS)

# Ver a cadeia completa
kubectl describe database app-database -n team-alpha | grep -A5 "Resource Ref"
# Saida esperada: referencia para o XDatabase

# Ver eventos do Claim
kubectl get events -n team-alpha --sort-by='.lastTimestamp'
# Saida esperada: eventos de criacao e sincronizacao

# Listar conexao (quando Ready)
kubectl get secret app-database-credentials -n team-alpha
# Saida esperada: Secret com endpoint, port, username, password
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Claim fica em READY=False sem motivo aparente',
      difficulty: 'medium',
      symptom: 'O Claim foi criado mas fica READY=False e SYNCED=False por muito tempo. Nenhum MR foi criado.',
      diagnosis: `\`\`\`bash
# 1. Verificar o Claim diretamente
kubectl describe database app-database -n team-alpha
# Procurar por "Conditions:" e "Events:"

# 2. Verificar o XR que foi criado
kubectl get xdatabases
kubectl describe xdatabase <nome-do-xr>
# Ver conditions e eventos do XR

# 3. Verificar se ha uma Composition correspondente
kubectl get compositions | grep XDatabase
# Verificar se labels correspondem ao compositionSelector do Claim

# 4. Verificar se o XRD esta Established
kubectl get xrd xdatabases.platform.acme.io
# ESTABLISHED deve ser True

# 5. Verificar logs do Crossplane
kubectl logs -n crossplane-system -l app=crossplane --tail=20
# Procurar por erros relacionados ao XDatabase
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Nenhuma Composition correspondente:** O Claim usa compositionSelector.matchLabels mas nenhuma Composition tem esses labels. Verificar labels da Composition com kubectl get composition -o yaml e ajustar.

2. **XRD nao Established:** O XRD pode estar com erro de validacao de schema. Verificar kubectl describe xrd e corrigir o schema OpenAPIV3.

3. **Parametros invalidos:** O Claim tem um campo que nao passa na validacao do XRD (ex: size: xlarge quando apenas small/medium/large sao validos). Corrigir o Claim.

4. **Sem ProviderConfig:** A Composition referencia um ProviderConfig que nao existe. Criar o ProviderConfig aws-production.

5. **RBAC do Crossplane:** O serviceaccount do Crossplane nao tem permissao para criar o tipo de recurso. Verificar ClusterRoles.`
    },
    {
      title: 'Patch nao funciona — campo nao e preenchido no MR',
      difficulty: 'hard',
      symptom: 'A Composition tem patches configurados mas o MR filho nao esta recebendo os valores corretos. O campo fica com o valor default da base.',
      diagnosis: `\`\`\`bash
# 1. Verificar o XR para ver se os campos chegaram do Claim
kubectl get xdatabase <nome> -o yaml | grep -A10 "parameters:"
# Verificar se spec.parameters tem os valores do Claim

# 2. Verificar o MR para ver o valor atual
kubectl get instance <nome> -o yaml | grep -A5 "dbInstanceClass:"
# Deve ter o valor mapeado pelo transform

# 3. Usar crossplane trace para ver o fluxo
kubectl crossplane trace database app-database -n team-alpha
# Mostra toda a cadeia de recursos e conditions

# 4. Verificar se o caminho do patch esta correto
# fromFieldPath e toFieldPath devem ser exatos
# Testar com: kubectl get xdatabase <nome> -o jsonpath='{.spec.parameters.size}'

# 5. Verificar se o transform esta correto
kubectl get composition xdatabases-aws -o yaml | grep -A10 "transforms:"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Caminho (fieldPath) errado:** \`fromFieldPath: spec.parameters.size\` mas o campo no XR esta em \`spec.parameters.dbSize\`. Verificar o caminho exato com kubectl get -o yaml.

2. **Transform map incompleto:** O valor no Claim (ex: "medium") nao esta no map do transform. Adicionar todos os valores possiveis ao map, ou adicionar um fallback.

3. **Tipo errado no campo:** O campo allocatedStorage espera integer mas o patch esta enviando string. Usar transform type: convert para ajustar o tipo.

4. **Falta de required no XRD schema:** O campo opcional nao foi preenchido no Claim, e o patch nao tem valor default. Adicionar default ao XRD schema ou tornar o campo required.

5. **Crossplane nao atualizou o MR:** Verificar se o MR esta em modo Synced. Se SYNCED=False, verificar eventos do MR.`
    },
    {
      title: 'Composition com multiplos recursos tem ordem de criacao errada',
      difficulty: 'medium',
      symptom: 'A Composition cria VPC, Subnet e RDS mas o Subnet falha porque a VPC ainda nao esta pronta. O erro e que o vpcId nao existe.',
      diagnosis: `\`\`\`bash
# 1. Verificar o estado de cada recurso na Composition
kubectl get managed
# Ver quais estao READY=True e quais READY=False

# 2. Verificar o recurso que esta falhando
kubectl describe subnet <nome> | grep -A8 "Conditions:"
# Procurar pela mensagem de erro

# 3. Verificar se o selector esta correto
kubectl get subnet <nome> -o yaml | grep -A5 "vpcIdSelector"

# 4. Verificar se a VPC foi criada
kubectl get vpc
# Ver se a VPC esta READY=True
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Falta de matchControllerRef:** O Subnet usa \`vpcIdSelector.matchLabels\` mas deveria usar \`vpcIdSelector.matchControllerRef: true\`. Com matchControllerRef, o Crossplane seleciona a VPC criada por esta mesma Composition e aguarda ela estar Ready antes de usar o ID.

2. **Race condition:** A Composition cria todos os recursos em paralelo. Para dependencias, usar \`*Ref\` (que espera o recurso estar Ready) em vez de tentar passar o ID via patch.

3. **Labels nao aplicados:** Se usando matchLabels, verificar que a VPC tem os labels corretos (podem ser aplicados via patches na Composition).

Solucao correta para VPC → Subnet:
\`\`\`yaml
spec:
  forProvider:
    vpcIdSelector:
      matchControllerRef: true  # Aguarda VPC da mesma Composition
\`\`\``
    }
  ]
};
