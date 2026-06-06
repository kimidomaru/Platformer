window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['crossplane/crossplane-compositions'] = {
  theory: `
# Crossplane Compositions & XRDs

## Relevance
Compositions and XRDs are the most advanced level of Crossplane — where you define your own platform API. Instead of exposing MRs directly (provider-aws-s3), you create abstractions (Databases, Environments, Applications) that development teams consume without needing to know cloud details. This is the true power of "Platform Engineering" with Crossplane.

## ⚠️ Currency: Pipeline (Functions) is the CURRENT mode — Patch-and-Transform is legacy
> **Important (Crossplane v1.17+):** the native **Patch-and-Transform** mode (\`spec.resources\` with inline \`patches\`/\`transforms\` on the Composition) is **DEPRECATED**. The recommended and **default** mode today is **Pipeline mode** with **Composition Functions** (\`spec.mode: Pipeline\` + \`spec.pipeline\`). Even classic P&T logic now runs as a *function* (\`function-patch-and-transform\`).
>
> **What this changes in practice:**
> - Write new Compositions with \`mode: Pipeline\`. Do not internalize \`spec.resources\` as the "normal" way.
> - P&T becomes *one step* inside the pipeline (via \`function-patch-and-transform\`), not the root mechanism.
> - Functions enable logic P&T never could: loops, conditionals, templates (KCL/Go-templating), validation, and chaining multiple functions in sequence.
> - The sections below on \`patches\`/\`transforms\` remain valid as **conceptual reference** (and because you will see them in existing Compositions), but the **target** is the Pipeline mode shown in "Composition with Pipeline Mode (Functions)".

## Core Concepts

### The Full Hierarchy

\`\`\`
CompositeResourceDefinition (XRD)
└── Defines the schema of your custom API
    ex: apiVersion: platform.acme.io/v1alpha1, kind: XDatabase

Composition
└── Defines HOW the XRD is implemented
    ex: XDatabase → RDS + SubnetGroup + SecurityGroup + Secret

CompositeResource (XR)
└── Cluster-scoped instance
    Created directly or via Claim

Claim (XRC)
└── Namespace-scoped instance
    Created by developers — completely abstracts the cloud
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
    kind: Database           # Namespace-scoped Claim
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

### Basic Composition

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

### Patches — Main Types

\`\`\`yaml
patches:
  # 1. From composite to resource (most common)
  - type: FromCompositeFieldPath
    fromFieldPath: spec.parameters.region
    toFieldPath: spec.forProvider.region

  # 2. From resource back to composite (status feedback)
  - type: ToCompositeFieldPath
    fromFieldPath: status.atProvider.endpoint
    toFieldPath: status.address

  # 3. Literal value
  - type: FromCompositeFieldPath
    fromFieldPath: metadata.labels["environment"]
    toFieldPath: spec.forProvider.tags["Environment"]

  # 4. With transform
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

### Available Transforms

\`\`\`yaml
# map: lookup table
transforms:
  - type: map
    map:
      dev: t3.micro
      staging: t3.medium
      prod: r5.large

# string: formatting
transforms:
  - type: string
    string:
      fmt: "prefix-%s-suffix"     # sprintf style
      # OR
      convert: ToUpper             # ToUpper, ToLower, ToBase64, FromBase64

# math: arithmetic operations
transforms:
  - type: math
    math:
      multiply: 2                  # multiply by 2

# convert: type change
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

### Composition with Pipeline Mode (Functions)

\`\`\`yaml
# Crossplane v1.14+ supports Functions (pipeline mode)
# More powerful than simple patches — allows complex logic

apiVersion: apiextensions.crossplane.io/v1
kind: Composition
metadata:
  name: xdatabases-pipeline
spec:
  compositeTypeRef:
    apiVersion: platform.acme.io/v1alpha1
    kind: XDatabase
  mode: Pipeline                   # New pipeline mode
  pipeline:
    - step: patch-and-transform
      functionRef:
        name: function-patch-and-transform   # Installed Function
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
        name: function-auto-ready          # Automatically marks composite Ready
\`\`\`

### Installing Functions

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

### Creating a Claim (from the developer's perspective)

\`\`\`yaml
# The developer does NOT need to know about AWS, RDS, or Crossplane internals
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
      provider: aws                 # Selects which Composition to use
  writeConnectionSecretToRef:
    name: my-app-db-connection      # Secret with credentials in same namespace
\`\`\`

### Composition with Multiple Resources

\`\`\`yaml
# Full environment: VPC + Subnet + SG + RDS
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
              matchControllerRef: true  # References VPC created in this same Composition
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

### Composition Selection

\`\`\`yaml
# Method 1: compositionRef (exact name)
spec:
  compositionRef:
    name: xdatabases-aws

# Method 2: compositionSelector (by labels)
spec:
  compositionSelector:
    matchLabels:
      provider: aws
      environment: production

# Composition metadata for matching:
metadata:
  labels:
    provider: aws
    environment: production
\`\`\`

### Common Mistakes

1. **Wrong patch path** — \`fromFieldPath\` or \`toFieldPath\` with incorrect path; use \`--dry-run=server\` to validate
2. **Missing required fields in schema** — XRD with \`required\` but Claim doesn't include the field
3. **Misunderstanding matchControllerRef** — \`matchControllerRef: true\` selects resources created by the SAME Composition instance (needed for VPC → Subnet)
4. **Pipeline mode without installed Function** — Composition with mode: Pipeline fails if the referenced Function isn't installed and Healthy
5. **writeConnectionSecretToRef in wrong namespace** — The connection Secret is created in the Claim's namespace; check Provider RBAC

## Killer.sh Style Challenge

> **Scenario:** Create an XRD called \`XWebApp\` in the group \`platform.acme.io/v1alpha1\` with a Claim called \`WebApp\`. The XRD should have parameters: \`tier\` (free/standard/enterprise) and \`region\`. Create a Composition that for each WebApp provisions an S3 Bucket with a name based on the Claim's metadata.name and appropriate tags. Use transform type map to map tier→storageClass (free: STANDARD, standard: STANDARD_IA, enterprise: GLACIER_IR).
`,
  quiz: [
    {
      question: 'What is the difference between a CompositeResource (XR) and a Claim (XRC)?',
      options: [
        'XR is more powerful than Claim',
        'XR is cluster-scoped (created by admins), Claim is namespace-scoped (created by developers) — both instantiate the same Composition',
        'Claims can only be used in production',
        'XR is the same as Managed Resource'
      ],
      correct: 1,
      explanation: 'XR (CompositeResource) is cluster-scoped — created by platform engineers. Claim is namespace-scoped — created by developers within a namespace. Both instantiate the same Composition. Claims are the consumption point for development teams.',
      reference: 'Related concept: A Claim automatically creates a corresponding XR at the cluster layer.'
    },
    {
      question: 'What does a CompositeResourceDefinition (XRD) define?',
      options: [
        'Which Managed Resources will be used',
        'The custom API schema: group, kind, plural, claimNames, and OpenAPI schema of accepted fields',
        'Which Providers to install',
        'The namespace where resources will be created'
      ],
      correct: 1,
      explanation: 'The XRD defines the custom API: the group (platform.acme.io), the kind (XDatabase), the Claim name (Database), and the OpenAPIV3 schema of accepted parameters. Think of XRD as a higher-level CRD — it creates new CRDs in the cluster.',
      reference: 'Related concept: XRDs are similar to CRDs — both create new K8s resource types. The difference is XRDs generate two CRDs (XR + Claim).'
    },
    {
      question: 'Which patch type sends a value FROM the child resource BACK to the composite?',
      options: [
        'FromCompositeFieldPath',
        'ToCompositeFieldPath',
        'CombineFromComposite',
        'PatchSet'
      ],
      correct: 1,
      explanation: 'ToCompositeFieldPath flows from the child resource (MR) to the composite. Commonly used to propagate status: the RDS endpoint can be copied to status.address of XDatabase so the Claim can read it.',
      reference: 'Related concept: FromCompositeFieldPath is the opposite — flows from composite to child resource. It\'s the most common type.'
    },
    {
      question: 'How can a Subnet reference the VPC created in the same Composition?',
      options: [
        'Using hardcoded vpcId',
        'Using vpcIdSelector.matchControllerRef: true — automatically selects the resource with the same controller ref',
        'Using an environment variable',
        'It\'s not possible to reference resources in the same Composition'
      ],
      correct: 1,
      explanation: 'matchControllerRef: true is the recommended way to reference resources created by the same Composition instance. Crossplane automatically injects the controllerRef into all resources created by a Composition, enabling safe selection.',
      reference: 'Related concept: Alternative: use vpcIdRef.name with the expected resource name, but matchControllerRef is more robust.'
    },
    {
      question: 'Which transform converts "small" → "db.t3.micro" and "large" → "db.r5.large"?',
      options: [
        'type: string',
        'type: map — defines a lookup table from input values to output values',
        'type: convert',
        'type: match'
      ],
      correct: 1,
      explanation: 'The type: map transform is a lookup table that converts input values to output values. Perfect for mapping tiers/sizes to concrete cloud instances. The key is the input value, the value is the output.',
      reference: 'Related concept: type: match uses regexp patterns for more complex mappings.'
    },
    {
      question: 'What is Pipeline mode in Compositions?',
      options: [
        'A way to execute Compositions in parallel',
        'A Composition mode that uses chained Functions for logic more complex than simple patches',
        'A CI/CD pipeline integrated with Crossplane',
        'A way to version Compositions'
      ],
      correct: 1,
      explanation: 'Pipeline mode (Crossplane v1.14+) allows using Composition Functions — programs that implement complex composition logic. Functions are chained in steps, each receiving and modifying the desired resource set. More powerful than declarative patches.',
      reference: 'Related concept: function-patch-and-transform implements patches/transforms in pipeline mode. function-auto-ready automatically sets the composite as Ready.'
    },
    {
      question: 'How does a developer select which Composition to use when creating a Claim?',
      options: [
        'The developer cannot choose — always uses the default Composition',
        'Using compositionRef (exact name) or compositionSelector (labels) in the Claim spec',
        'Using annotations on the Claim',
        'Configuring the XRD with a mandatory default Composition'
      ],
      correct: 1,
      explanation: 'The Claim can specify compositionRef.name (exact name) or compositionSelector.matchLabels (label selection). This allows having multiple Compositions for the same XRD — e.g., one for AWS, another for GCP — and the developer chooses via label.',
      reference: 'Related concept: The XRD can have a defaultCompositionRef for cases where the Claim doesn\'t specify.'
    },
    {
      question: 'Where do connection credentials (endpoint, password) arrive for the developer after creating a Claim?',
      options: [
        'In Claim annotations',
        'In a Secret in the same namespace as the Claim, specified in writeConnectionSecretToRef',
        'In a ConfigMap in the crossplane-system namespace',
        'In Claim events'
      ],
      correct: 1,
      explanation: 'The Claim can specify writeConnectionSecretToRef.name and Crossplane creates a Secret in that namespace with credentials propagated via Composition connectionDetails. The developer mounts this Secret in the application without ever seeing the credentials directly.',
      reference: 'Related concept: connectionDetails in the Composition defines which keys from the child MR\'s Secret are propagated to the Claim\'s Secret.'
    }
  ],
  flashcards: [
    {
      front: 'What is the full abstraction hierarchy in Crossplane?',
      back: '**4 layers:**\n\n1. **MR (Managed Resource)**\n   Provider-level, 1:1 with cloud resource\n   ex: Bucket, Instance, VPC\n\n2. **XRD (CompositeResourceDefinition)**\n   Defines the custom API (schema)\n   ex: XDatabase, XEnvironment\n\n3. **Composition**\n   Implements the XRD using MRs\n   Defines patches, transforms, connectionDetails\n\n4. **XR (CompositeResource)**\n   Cluster-scoped instance\n\n4a. **Claim (XRC)**\n   Namespace-scoped instance\n   Created by developers\n   Automatically creates XR\n\n**Flow:**\nClaim → XR → Composition → MRs → Cloud Resources'
    },
    {
      front: 'What patch types exist in Compositions?',
      back: '**FromCompositeFieldPath** (most common)\nFrom composite to child resource\n\n**ToCompositeFieldPath**\nFrom child resource to composite\n(status propagation)\n\n**CombineFromComposite**\nCombines multiple composite fields\ninto one child resource field\n\n**CombineToComposite**\nCombines child resource fields\ninto the composite\n\n**FromEnvironmentFieldPath**\nFrom EnvironmentConfig to resource\n\n**PatchSets**\nReusable groups of patches\ndefined at Composition level'
    },
    {
      front: 'What transforms are available in patches?',
      back: '**map** — lookup table\nsmall → db.t3.micro\n\n**string** — formatting\nfmt: "prefix-%s"\nconvert: ToUpper/ToLower/ToBase64\n\n**math** — arithmetic operations\nmultiply: 2\n\n**convert** — type change\ntoType: string/int64/float64/bool\n\n**match** — regexp or literal patterns\nPatterns with fallbackValue\n\n**Chaining:**\nMultiple transforms can be chained\nin the order they appear in the list.\nEach transform receives the previous one\'s output.'
    },
    {
      front: 'What is matchControllerRef and when to use it?',
      back: '**What it is:**\n`vpcIdSelector.matchControllerRef: true`\n\nAutomatically selects the resource\n(VPC, for example) that was created by the\nSAME Composition instance.\n\n**Why to use it:**\nIn a Composition with VPC + Subnet,\nthe Subnet needs the VPC ID.\nSince the VPC name is auto-generated,\nthere\'s no way to hardcode it.\n\nmatchControllerRef solves this:\nfinds the VPC created by this same XR.\n\n**Implementation:**\n\`\`\`yaml\nspec:\n  forProvider:\n    vpcIdSelector:\n      matchControllerRef: true\n\`\`\`\n\n**Alternative:**\nvpcIdRef.name with a predictable name,\nbut matchControllerRef is more robust.'
    },
    {
      front: 'How does writeConnectionSecretToRef work in Claims?',
      back: '**Propagation flow:**\n\n1. MR (RDS) exports to Secret\n   via writeConnectionSecretsToRef\n   in namespace crossplane-system\n\n2. Composition defines connectionDetails\n   for each resource, mapping keys\n   from MR Secret to the Claim\n\n3. Claim specifies:\n\`\`\`yaml\nwriteConnectionSecretToRef:\n  name: my-app-db-connection\n\`\`\`\n\n4. Crossplane creates Secret\n   in the Claim\'s namespace with\n   the mapped keys\n\n5. Developer mounts the Secret\n   in the application without seeing\n   infrastructure details\n\n**Typical keys:** endpoint, port,\nusername, password, connectionString'
    },
    {
      front: 'Composition mode: Resources vs Pipeline',
      back: '**mode: Resources (default)**\n- Simple declarative patches\n- Built-in transforms\n- Limited to field operations\n- No complex conditional logic\n\n**mode: Pipeline (v1.14+)**\n- Uses Composition Functions\n- Chained steps\n- Complex logic via Functions\n- Supports Go, Python, etc.\n\n**Common Functions:**\n- function-patch-and-transform\n  (reimplements Resources mode)\n- function-auto-ready\n  (marks composite Ready)\n- function-go-templating\n  (Go templates for YAML)\n- function-kcl\n  (KCL language for composition)\n\n**When to use Pipeline:**\nConditional logic, loops,\nmultiple data sources,\nor programmatic composition.'
    },
    {
      front: 'XRD schema — required vs optional fields',
      back: '**Required XRD fields:**\n- spec.group: API domain\n- spec.names.kind: CamelCase kind\n- spec.names.plural: lowercase plural\n- spec.versions[].name: ex "v1alpha1"\n- spec.versions[].served: true\n- spec.versions[].referenceable: true\n\n**Important optional fields:**\n- spec.claimNames: enables Claims\n- spec.versions[].schema: OpenAPIV3\n- spec.defaultCompositionRef\n- spec.enforcedCompositionRef\n\n**OpenAPIV3 schema:**\nDefines parameter validation.\nCan have required, enum, default,\nminimum, maximum, pattern.\n\n**Tip:** Adding default values\nto parameters makes them\neasier for developers to use.'
    }
  ],
  lab: {
    scenario: 'You are a Platform Engineer and need to create a database API for development teams. Developers should be able to request a PostgreSQL database by specifying only size and region — without knowing anything about AWS.',
    objective: 'Create an XRD, a Composition, and a Claim to abstract the creation of PostgreSQL RDS on AWS.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create the CompositeResourceDefinition (XRD)',
        instruction: `Define the custom API for databases:
1. Create an XRD called XDatabase in the group platform.acme.io/v1alpha1
2. Enable Claims with kind Database
3. Define parameters: size (small/medium/large), region (string, default us-east-1), storageGB (integer, 20-500)
4. Apply the XRD and verify that CRDs were created`,
        hints: [
          'The XRD name must be in the format plural.group (xdatabases.platform.acme.io)',
          'versions[0].referenceable must be true for the primary version',
          'Verify with kubectl get crds | grep platform.acme.io'
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
# Verify XRD created and Established
kubectl get xrd xdatabases.platform.acme.io
# Expected: ESTABLISHED=True OFFERED=True

# Verify auto-generated CRDs
kubectl get crds | grep platform.acme.io
# Expected:
# xdatabases.platform.acme.io
# databases.platform.acme.io

# Verify XRD is Established
kubectl describe xrd xdatabases.platform.acme.io | grep -A5 "Conditions:"
# Expected: Type: Established, Status: True
\`\`\``
      },
      {
        title: 'Create the Composition',
        instruction: `Create the AWS implementation of XDatabase:
1. Create a Composition that maps XDatabase to an RDS Instance
2. Use patches to propagate region, storageGB and size → dbInstanceClass
3. Use transform type map to convert size → RDS instance type
4. Connect the Composition to the XRD via compositeTypeRef`,
        hints: [
          'compositeTypeRef must point to the XRD you created',
          'Use transforms.map to map small/medium/large to instance types',
          'deletionPolicy: Orphan in dev to not accidentally delete'
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
# Verify Composition created
kubectl get composition xdatabases-aws
# Expected: REVISION=1 XR-KIND=XDatabase XR-APIVERSION=platform.acme.io/v1alpha1 AGE=...

# See Composition details
kubectl describe composition xdatabases-aws | head -30

# Verify XRD is ready for Compositions
kubectl get xrd xdatabases.platform.acme.io -o jsonpath='{.status.conditions[?(@.type=="Established")].status}'
# Expected: True
\`\`\``
      },
      {
        title: 'Create a Claim and Verify Provisioning',
        instruction: `Simulate the developer workflow by creating a Claim:
1. Create a team-alpha namespace
2. Create a Claim of type Database in namespace team-alpha with size: small
3. Verify that the XR (CompositeResource) was automatically created
4. Verify the resource chain: Claim → XR → MR
5. Check logs and conditions to understand the lifecycle`,
        hints: [
          'The Claim uses kind: Database (from claimNames in the XRD)',
          'Check kubectl get xdatabases to see the generated XR',
          'kubectl get managed shows all MRs created by the Composition'
        ],
        solution: `\`\`\`bash
# Create team namespace
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
# Verify the Claim
kubectl get database app-database -n team-alpha
# Expected: READY=False SYNCED=True (provisioning in progress)

# Verify the automatically created XR
kubectl get xdatabases
# Expected: XDatabase created by the Claim

# Verify the MR created by the Composition
kubectl get managed
# Expected: instances.rds.aws.upbound.io with READY=False (waiting for RDS)

# See the full chain
kubectl describe database app-database -n team-alpha | grep -A5 "Resource Ref"
# Expected: reference to the XDatabase

# See Claim events
kubectl get events -n team-alpha --sort-by='.lastTimestamp'
# Expected: creation and synchronization events

# List connection (when Ready)
kubectl get secret app-database-credentials -n team-alpha
# Expected: Secret with endpoint, port, username, password
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Claim stays READY=False with no apparent reason',
      difficulty: 'medium',
      symptom: 'The Claim was created but stays READY=False and SYNCED=False for a long time. No MR was created.',
      diagnosis: `\`\`\`bash
# 1. Check the Claim directly
kubectl describe database app-database -n team-alpha
# Look for "Conditions:" and "Events:"

# 2. Check the XR that was created
kubectl get xdatabases
kubectl describe xdatabase <name>
# Check conditions and XR events

# 3. Check if there's a matching Composition
kubectl get compositions | grep XDatabase
# Verify labels match the Claim's compositionSelector

# 4. Check if XRD is Established
kubectl get xrd xdatabases.platform.acme.io
# ESTABLISHED must be True

# 5. Check Crossplane logs
kubectl logs -n crossplane-system -l app=crossplane --tail=20
# Look for errors related to XDatabase
\`\`\``,
      solution: `**Causes and solutions:**

1. **No matching Composition:** The Claim uses compositionSelector.matchLabels but no Composition has those labels. Check Composition labels with kubectl get composition -o yaml and adjust.

2. **XRD not Established:** The XRD may have a schema validation error. Check kubectl describe xrd and fix the OpenAPIV3 schema.

3. **Invalid parameters:** The Claim has a field that fails XRD validation (ex: size: xlarge when only small/medium/large are valid). Fix the Claim.

4. **No ProviderConfig:** The Composition references a ProviderConfig that doesn't exist. Create the aws-production ProviderConfig.

5. **Crossplane RBAC:** The Crossplane serviceaccount doesn't have permission to create the resource type. Check ClusterRoles.`
    },
    {
      title: 'Patch doesn\'t work — field not populated in MR',
      difficulty: 'hard',
      symptom: 'The Composition has patches configured but the child MR is not receiving the correct values. The field stays with the base default value.',
      diagnosis: `\`\`\`bash
# 1. Check the XR to see if fields arrived from the Claim
kubectl get xdatabase <name> -o yaml | grep -A10 "parameters:"
# Verify spec.parameters has the Claim values

# 2. Check the MR for the current value
kubectl get instance <name> -o yaml | grep -A5 "dbInstanceClass:"
# Should have the transform-mapped value

# 3. Use crossplane trace to see the flow
kubectl crossplane trace database app-database -n team-alpha
# Shows the full resource chain and conditions

# 4. Check if the patch path is correct
# fromFieldPath and toFieldPath must be exact
# Test with: kubectl get xdatabase <name> -o jsonpath='{.spec.parameters.size}'

# 5. Check if the transform is correct
kubectl get composition xdatabases-aws -o yaml | grep -A10 "transforms:"
\`\`\``,
      solution: `**Causes and solutions:**

1. **Wrong path (fieldPath):** \`fromFieldPath: spec.parameters.size\` but the field in XR is at \`spec.parameters.dbSize\`. Verify the exact path with kubectl get -o yaml.

2. **Incomplete transform map:** The Claim value (ex: "medium") isn't in the transform map. Add all possible values to the map, or add a fallback.

3. **Wrong field type:** The allocatedStorage field expects integer but the patch is sending string. Use transform type: convert to adjust the type.

4. **Missing required in XRD schema:** The optional field wasn't filled in the Claim, and the patch has no default value. Add default to XRD schema or make the field required.

5. **Crossplane didn't update the MR:** Check if the MR is in Synced mode. If SYNCED=False, check MR events.`
    },
    {
      title: 'Composition with multiple resources has wrong creation order',
      difficulty: 'medium',
      symptom: 'The Composition creates VPC, Subnet, and RDS but the Subnet fails because the VPC isn\'t ready yet. The error is that vpcId doesn\'t exist.',
      diagnosis: `\`\`\`bash
# 1. Check the state of each resource in the Composition
kubectl get managed
# See which are READY=True and which are READY=False

# 2. Check the failing resource
kubectl describe subnet <name> | grep -A8 "Conditions:"
# Look for the error message

# 3. Check if the selector is correct
kubectl get subnet <name> -o yaml | grep -A5 "vpcIdSelector"

# 4. Check if VPC was created
kubectl get vpc
# See if VPC is READY=True
\`\`\``,
      solution: `**Causes and solutions:**

1. **Missing matchControllerRef:** The Subnet uses \`vpcIdSelector.matchLabels\` but should use \`vpcIdSelector.matchControllerRef: true\`. With matchControllerRef, Crossplane selects the VPC created by this same Composition and waits for it to be Ready before using its ID.

2. **Race condition:** The Composition creates all resources in parallel. For dependencies, use \`*Ref\` (which waits for the resource to be Ready) instead of trying to pass the ID via patch.

3. **Labels not applied:** If using matchLabels, verify the VPC has the correct labels (they can be applied via patches in the Composition).

Correct solution for VPC → Subnet:
\`\`\`yaml
spec:
  forProvider:
    vpcIdSelector:
      matchControllerRef: true  # Wait for VPC from same Composition
\`\`\``
    }
  ]
};
