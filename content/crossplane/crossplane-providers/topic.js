window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['crossplane/crossplane-providers'] = {
  theory: `
# Crossplane Providers & Managed Resources

## Relevancia
Os Providers sao o coracão do Crossplane — sao packages que instalam CRDs para recursos de um cloud provider especifico. Cada Provider expoe centenas de Managed Resources (MRs) que mapeiam 1:1 para recursos reais na cloud. Dominar Providers significa saber instalar, configurar e usar os recursos mais comuns de AWS, GCP e Azure.

## Conceitos Fundamentais

### Ecossistema de Providers

\`\`\`
Providers Oficiais (Upbound):
├── provider-aws-*         — AWS (multiplos sub-providers)
│   ├── provider-aws-s3
│   ├── provider-aws-ec2
│   ├── provider-aws-rds
│   ├── provider-aws-iam
│   ├── provider-aws-eks
│   ├── provider-aws-kms
│   └── ... (40+ sub-providers)
├── provider-gcp-*         — Google Cloud
│   ├── provider-gcp-storage
│   ├── provider-gcp-sql
│   ├── provider-gcp-container
│   └── ...
├── provider-azure-*       — Microsoft Azure
│   ├── provider-azure-storage
│   ├── provider-azure-sql
│   ├── provider-azure-containerservice
│   └── ...
├── provider-kubernetes    — Kubernetes resources
├── provider-helm          — Helm charts
└── provider-terraform     — Terraform modules (bridge)

Providers Comunitarios:
├── provider-upjet-*       — Auto-gerados do Terraform
└── Muitos outros no upbound.io/marketplace
\`\`\`

### Instalacao de Providers (Family Pattern)

\`\`\`yaml
# Providers AWS usam "family" pattern
# Instalar o provider-aws principal + sub-providers especificos

# 1. Provider Family (instala tipos comuns + gerencia sub-providers)
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-aws
spec:
  package: xpkg.upbound.io/upbound/provider-family-aws:v1.14.0
  packagePullPolicy: IfNotPresent
  revisionActivationPolicy: Automatic
---
# 2. Sub-provider especifico
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-aws-s3
spec:
  package: xpkg.upbound.io/upbound/provider-aws-s3:v1.14.0
  packagePullPolicy: IfNotPresent
  revisionActivationPolicy: Automatic
---
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-aws-rds
spec:
  package: xpkg.upbound.io/upbound/provider-aws-rds:v1.14.0
\`\`\`

### ProviderConfig com IRSA (AWS EKS)

\`\`\`yaml
# Configuracao IRSA — sem credenciais no cluster
apiVersion: aws.upbound.io/v1beta1
kind: ProviderConfig
metadata:
  name: aws-production
spec:
  credentials:
    source: IRSA

# Para IRSA funcionar, o ServiceAccount do Provider precisa de annotation:
# eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/CrossplaneRole

# Aplicar via ControllerConfig (deprecated) ou DeploymentRuntimeConfig:
apiVersion: pkg.crossplane.io/v1beta1
kind: DeploymentRuntimeConfig
metadata:
  name: irsa-config
spec:
  deploymentTemplate:
    spec:
      selector: {}
      template:
        spec:
          serviceAccountName: provider-aws
          containers:
            - name: package-runtime
              env:
                - name: AWS_ROLE_ARN
                  value: "arn:aws:iam::123456789012:role/CrossplaneIRSA"
                - name: AWS_WEB_IDENTITY_TOKEN_FILE
                  value: "/var/run/secrets/eks.amazonaws.com/serviceaccount/token"
\`\`\`

### Managed Resources AWS Comuns

\`\`\`yaml
# S3 Bucket
apiVersion: s3.aws.upbound.io/v1beta1
kind: Bucket
metadata:
  name: my-app-data
  annotations:
    crossplane.io/external-name: my-app-data-acme-prod
spec:
  forProvider:
    region: us-east-1
    tags:
      app: my-app
      env: production
  providerConfigRef:
    name: aws-production
  deletionPolicy: Orphan
\`\`\`

\`\`\`yaml
# RDS Instance
apiVersion: rds.aws.upbound.io/v1beta1
kind: Instance
metadata:
  name: app-database
spec:
  forProvider:
    region: us-east-1
    dbInstanceClass: db.t3.medium
    engine: postgres
    engineVersion: "15.4"
    dbName: appdb
    allocatedStorage: 20
    storageType: gp3
    multiAz: true
    skipFinalSnapshot: false
    finalSnapshotIdentifierPrefix: app-db-final
    vpcSecurityGroupIdRefs:
      - name: db-security-group
    dbSubnetGroupNameRef:
      name: app-db-subnet-group
  writeConnectionSecretsToRef:
    namespace: default
    name: app-db-connection
  providerConfigRef:
    name: aws-production
  deletionPolicy: Orphan
\`\`\`

\`\`\`yaml
# VPC
apiVersion: ec2.aws.upbound.io/v1beta1
kind: VPC
metadata:
  name: production-vpc
spec:
  forProvider:
    region: us-east-1
    cidrBlock: 10.0.0.0/16
    enableDnsSupport: true
    enableDnsHostnames: true
    tags:
      Name: production-vpc
  providerConfigRef:
    name: aws-production
---
# Subnet
apiVersion: ec2.aws.upbound.io/v1beta1
kind: Subnet
metadata:
  name: production-subnet-a
spec:
  forProvider:
    region: us-east-1
    availabilityZone: us-east-1a
    cidrBlock: 10.0.1.0/24
    vpcIdRef:
      name: production-vpc
  providerConfigRef:
    name: aws-production
\`\`\`

\`\`\`yaml
# EKS Cluster
apiVersion: eks.aws.upbound.io/v1beta1
kind: Cluster
metadata:
  name: my-eks-cluster
spec:
  forProvider:
    region: us-east-1
    version: "1.29"
    roleArnRef:
      name: eks-cluster-role
    vpcConfig:
      - subnetIdRefs:
          - name: production-subnet-a
          - name: production-subnet-b
        endpointPublicAccess: true
        endpointPrivateAccess: false
  providerConfigRef:
    name: aws-production
\`\`\`

### Managed Resources GCP Comuns

\`\`\`yaml
# GCS Bucket
apiVersion: storage.gcp.upbound.io/v1beta1
kind: Bucket
metadata:
  name: gcp-app-data
  annotations:
    crossplane.io/external-name: gcp-app-data-acme-prod
spec:
  forProvider:
    location: US
    storageClass: STANDARD
    labels:
      app: my-app
      env: production
  providerConfigRef:
    name: gcp-production
---
# ProviderConfig GCP
apiVersion: gcp.upbound.io/v1beta1
kind: ProviderConfig
metadata:
  name: gcp-production
spec:
  projectID: my-gcp-project-id
  credentials:
    source: Secret
    secretRef:
      namespace: crossplane-system
      name: gcp-credentials
      key: credentials
\`\`\`

\`\`\`yaml
# CloudSQL PostgreSQL
apiVersion: sql.gcp.upbound.io/v1beta1
kind: DatabaseInstance
metadata:
  name: app-postgres
spec:
  forProvider:
    region: us-central1
    databaseVersion: POSTGRES_15
    settings:
      - tier: db-g1-small
        ipConfiguration:
          - privateNetworkRef:
              name: production-vpc
            ipv4Enabled: false
        backupConfiguration:
          - enabled: true
            startTime: "02:00"
  providerConfigRef:
    name: gcp-production
\`\`\`

### Managed Resources Azure Comuns

\`\`\`yaml
# Azure Resource Group
apiVersion: azure.upbound.io/v1beta1
kind: ResourceGroup
metadata:
  name: app-resource-group
spec:
  forProvider:
    location: East US
    tags:
      environment: production
  providerConfigRef:
    name: azure-production
---
# Azure Storage Account
apiVersion: storage.azure.upbound.io/v1beta1
kind: Account
metadata:
  name: appstorageaccount
spec:
  forProvider:
    location: East US
    resourceGroupNameRef:
      name: app-resource-group
    accountKind: StorageV2
    accountTier: Standard
    accountReplicationType: LRS
    enableHttpsTrafficOnly: true
  providerConfigRef:
    name: azure-production
\`\`\`

### writeConnectionSecretsToRef — Exportar Credenciais

\`\`\`yaml
# RDS exporta connection string para um Secret
apiVersion: rds.aws.upbound.io/v1beta1
kind: Instance
metadata:
  name: app-database
spec:
  forProvider:
    # ... config do RDS
  writeConnectionSecretsToRef:
    namespace: default
    name: app-db-connection   # Secret criado automaticamente
  providerConfigRef:
    name: aws-production

# O Secret criado contera:
# endpoint: app-database.xxxx.us-east-1.rds.amazonaws.com
# port: 5432
# username: master
# password: <generated>
# connectionString: postgresql://...
\`\`\`

### Crossplane Composite Resource References

\`\`\`yaml
# Referenciar outros MRs por nome (evitar hardcoding de IDs)
spec:
  forProvider:
    # Por referencia (cria dependency tracking)
    vpcIdRef:
      name: production-vpc        # Crossplane resolve o ID automaticamente

    # Por selector (dinamico)
    vpcIdSelector:
      matchLabels:
        env: production
        team: platform

    # Por valor direto (evitar quando possivel)
    vpcId: vpc-0a1b2c3d4e5f
\`\`\`

### Importar Recursos Existentes

\`\`\`yaml
# Importar um bucket S3 existente sem deletar
apiVersion: s3.aws.upbound.io/v1beta1
kind: Bucket
metadata:
  name: existing-bucket
  annotations:
    crossplane.io/external-name: my-existing-bucket-prod  # nome real na AWS
spec:
  forProvider:
    region: us-east-1
    # ... configuracao deve corresponder ao estado atual
  deletionPolicy: Orphan           # Nao deletar ao remover o CR
  managementPolicies:
    - Observe                      # So observar, nao modificar
  providerConfigRef:
    name: aws-production

# Crossplane vai:
# 1. Buscar o recurso na cloud pelo external-name
# 2. Popular status.atProvider com o estado atual
# 3. Se managementPolicies incluir FullControl, reconciliar para spec.forProvider
\`\`\`

### provider-kubernetes e provider-helm

\`\`\`yaml
# provider-kubernetes — gerenciar recursos K8s via Crossplane
apiVersion: kubernetes.crossplane.io/v1alpha2
kind: Object
metadata:
  name: my-namespace
spec:
  forProvider:
    manifest:
      apiVersion: v1
      kind: Namespace
      metadata:
        name: team-alpha
        labels:
          team: alpha
  providerConfigRef:
    name: kubernetes-provider
---
# provider-helm — deploy de Helm charts via Crossplane
apiVersion: helm.crossplane.io/v1beta1
kind: Release
metadata:
  name: nginx-ingress
spec:
  forProvider:
    chart:
      name: ingress-nginx
      repository: https://kubernetes.github.io/ingress-nginx
      version: 4.9.0
    namespace: ingress-system
    values:
      controller:
        replicaCount: 2
        service:
          type: LoadBalancer
  providerConfigRef:
    name: in-cluster
\`\`\`

### Erros Comuns

1. **Family provider nao instalado** — Sub-providers AWS precisam do provider-family-aws instalado primeiro
2. **writeConnectionSecrets sem RBAC** — O ServiceAccount do Provider precisa criar Secrets no namespace alvo
3. **Cross-resource ref dangling** — Referenciar MR que ainda nao foi criado (usar dependencia explicita)
4. **managementPolicies errado** — ObserveOnly nao faz reconciliacao; usar FullControl para gestao completa
5. **Sem external-name em importacao** — Sem a annotation, Crossplane cria novo recurso em vez de importar

## Killer.sh Style Challenge

> **Cenario:** Provisione usando Crossplane no AWS: (1) uma VPC com CIDR 10.0.0.0/16, (2) dois Subnets em AZs diferentes referenciando a VPC por ref, (3) um RDS PostgreSQL db.t3.micro em modo MultiAZ que exporta connection string para Secret "db-credentials", (4) tudo com deletionPolicy: Orphan.
`,
  quiz: [
    {
      question: 'Como os providers AWS sao organizados no Crossplane v1+?',
      options: [
        'Um unico provider para toda AWS',
        'Family pattern: provider-family-aws + sub-providers especificos (provider-aws-s3, provider-aws-rds, etc)',
        'Um provider por regiao AWS',
        'Providers por tipo de servico (compute, storage, database)'
      ],
      correct: 1,
      explanation: 'AWS usa o "family pattern": provider-family-aws e o provider principal que gerencia tipos compartilhados. Sub-providers especificos (provider-aws-s3, provider-aws-rds, provider-aws-ec2) instalam CRDs para servicos especificos. Isso reduz o numero de CRDs por provider.',
      reference: 'Conceito relacionado: O family provider deve ser instalado antes dos sub-providers.'
    },
    {
      question: 'Para que serve writeConnectionSecretsToRef em um Managed Resource?',
      options: [
        'Armazenar as credenciais do ProviderConfig',
        'Exportar automaticamente informacoes de conexao do recurso provisionado para um Kubernetes Secret',
        'Conectar dois MRs diferentes',
        'Configurar o acesso de rede do recurso'
      ],
      correct: 1,
      explanation: 'writeConnectionSecretsToRef instrui o Crossplane a criar um Secret com as informacoes de conexao do recurso (endpoint, porta, usuario, senha). Muito util para RDS, ElastiCache, etc. — as apps podem montar esse Secret diretamente.',
      reference: 'Conceito relacionado: O Secret e criado no namespace especificado. O ServiceAccount do Provider precisa de permissao para criar Secrets nesse namespace.'
    },
    {
      question: 'Como referenciar um recurso Crossplane por nome em vez de ID hardcoded?',
      options: [
        'Usando labels',
        'Usando campos *Ref (vpcIdRef, securityGroupIdRef) que resolvem automaticamente o ID do recurso referenciado',
        'Usando ConfigMaps',
        'Usando variavel de ambiente'
      ],
      correct: 1,
      explanation: 'Campos *Ref (como vpcIdRef.name) permitem referenciar outros MRs por nome Kubernetes. O Crossplane resolve automaticamente o ID do recurso na cloud. Alternativa: *Selector com matchLabels para selecao dinamica.',
      reference: 'Conceito relacionado: Refs criam dependencias entre recursos — o Crossplane aguarda o recurso referenciado estar Ready.'
    },
    {
      question: 'Como importar um recurso cloud existente para o Crossplane sem deletar?',
      options: [
        'Usar kubectl import',
        'Definir crossplane.io/external-name com o nome do recurso existente, deletionPolicy: Orphan e managementPolicies: [Observe]',
        'Usar crossplane import CLI',
        'Criar um Composition que importa'
      ],
      correct: 1,
      explanation: 'Para importar: (1) external-name com o nome real na cloud, (2) deletionPolicy: Orphan para nao deletar ao remover o CR, (3) managementPolicies: [Observe] para so observar sem modificar. O Crossplane busca e popula status.atProvider.',
      reference: 'Conceito relacionado: Mudar para FullControl apos importar permite que o Crossplane reconcilie o estado.'
    },
    {
      question: 'O que o provider-kubernetes faz?',
      options: [
        'Instala Kubernetes no AWS',
        'Permite gerenciar recursos Kubernetes (Namespace, Deployment, etc.) como Managed Resources do Crossplane',
        'Configura o cluster Kubernetes para o Crossplane',
        'Instala providers adicionais'
      ],
      correct: 1,
      explanation: 'O provider-kubernetes expoe um CRD chamado Object que pode gerenciar qualquer recurso Kubernetes. Util em Compositions para criar recursos K8s junto com infraestrutura cloud (ex: criar Namespace + RDS + ServiceAccount de uma vez).',
      reference: 'Conceito relacionado: provider-helm permite deployar charts Helm como Managed Resources.'
    },
    {
      question: 'Qual a diferenca entre managementPolicies Observe e FullControl?',
      options: [
        'Nao ha diferenca',
        'ObserveOnly le o estado da cloud mas nao modifica; FullControl reconcilia o estado desejado com o real',
        'FullControl e mais seguro que ObserveOnly',
        'ObserveOnly e usado apenas para testes'
      ],
      correct: 1,
      explanation: 'ObserveOnly: Crossplane le o estado da cloud e popula status.atProvider mas NAO aplica mudancas. FullControl (default): Crossplane reconcilia continuamente, aplicando spec.forProvider e revertendo drift.',
      reference: 'Conceito relacionado: Use ObserveOnly para recursos gerenciados externamente que voce quer visibilidade mas nao controle.'
    },
    {
      question: 'Como configurar IRSA no Crossplane para autenticacao AWS sem credenciais?',
      options: [
        'Usar um Secret especial chamado irsa-secret',
        'Configurar ProviderConfig com credentials.source: IRSA e anotar o ServiceAccount do Provider com o ARN do IAM Role',
        'Instalar um plugin IRSA separado',
        'Configurar uma variavel de ambiente no Crossplane'
      ],
      correct: 1,
      explanation: 'IRSA (IAM Roles for Service Accounts) permite ao Provider AWS usar roles IAM sem credenciais no cluster. Requer: (1) ProviderConfig com source: IRSA, (2) ServiceAccount do Provider anotado com eks.amazonaws.com/role-arn, (3) OIDC do cluster configurado na AWS.',
      reference: 'Conceito relacionado: IRSA e o metodo recomendado para EKS; equivalente a Workload Identity no GCP.'
    }
  ],
  flashcards: [
    {
      front: 'Quais providers Crossplane existem e como se organizam?',
      back: '**Providers Oficiais (Upbound):**\n- provider-family-aws + sub-providers\n  (s3, rds, ec2, iam, eks, kms, ...)\n- provider-family-gcp + sub-providers\n  (storage, sql, container, ...)\n- provider-family-azure + sub-providers\n  (storage, sql, containerservice, ...)\n\n**Providers Especiais:**\n- provider-kubernetes: recursos K8s\n- provider-helm: Helm charts\n- provider-terraform: bridge Terraform\n\n**Family Pattern:**\nInstalar family provider PRIMEIRO,\ndepois sub-providers especificos.\n\n**Marketplace:** upbound.io/marketplace'
    },
    {
      front: 'Como referenciar recursos entre MRs?',
      back: '**Por referencia (recomendado):**\n\`\`\`yaml\nvpcIdRef:\n  name: production-vpc\n\`\`\`\n- Crossplane resolve o ID automaticamente\n- Cria dependencia entre recursos\n- Aguarda recurso referenciado estar Ready\n\n**Por selector (dinamico):**\n\`\`\`yaml\nvpcIdSelector:\n  matchLabels:\n    env: production\n\`\`\`\n- Seleciona o MR que corresponde aos labels\n- Util para Compositions\n\n**Por valor direto (evitar):**\n\`\`\`yaml\nvpcId: vpc-0a1b2c3d4e5f\n\`\`\`\n- Hardcoded, fragil\n- Nao cria dependencia'
    },
    {
      front: 'Como o writeConnectionSecretsToRef funciona?',
      back: '**O que faz:**\nExporta informacoes de conexao do recurso provisionado para um Kubernetes Secret.\n\n**Campos exportados tipicos (RDS):**\n- endpoint: hostname\n- port: porta\n- username: usuario master\n- password: senha gerada\n- connectionString: URL completa\n\n**Configuracao:**\n\`\`\`yaml\nwriteConnectionSecretsToRef:\n  namespace: default\n  name: app-db-connection\n\`\`\`\n\n**RBAC necessario:**\nServiceAccount do Provider precisa de\ncreate/update Secrets no namespace alvo.\n\n**Uso na app:**\nMontar o Secret como env vars ou volume.'
    },
    {
      front: 'MRs AWS comuns e seus apiGroups',
      back: '**S3:**\n- apiGroup: s3.aws.upbound.io/v1beta1\n- kind: Bucket\n\n**RDS:**\n- apiGroup: rds.aws.upbound.io/v1beta1\n- kind: Instance\n\n**EC2:**\n- apiGroup: ec2.aws.upbound.io/v1beta1\n- kinds: VPC, Subnet, SecurityGroup, InternetGateway\n\n**EKS:**\n- apiGroup: eks.aws.upbound.io/v1beta1\n- kinds: Cluster, NodeGroup\n\n**IAM:**\n- apiGroup: iam.aws.upbound.io/v1beta1\n- kinds: Role, Policy, RolePolicyAttachment\n\n**Dica:** kubectl get crds | grep aws | grep -v upbound\npara listar todos os CRDs AWS instalados'
    },
    {
      front: 'Como importar recursos cloud existentes para o Crossplane?',
      back: '**Passos:**\n\n1. Criar MR com external-name correto:\n\`\`\`yaml\nannotations:\n  crossplane.io/external-name: nome-na-cloud\n\`\`\`\n\n2. Usar deletionPolicy: Orphan\n(nao deletar ao remover o CR)\n\n3. Primeiro com managementPolicies: [Observe]\n(so le, nao modifica)\n\n4. Verificar status.atProvider preenchido\n\n5. Ajustar spec.forProvider para corresponder\nao estado atual\n\n6. Mudar para FullControl se quiser reconciliar\n\n**Cuidado:** spec.forProvider deve corresponder\nexatamente ao estado da cloud para evitar\nmodificacoes indesejadas.'
    },
    {
      front: 'provider-kubernetes e provider-helm — para que servem?',
      back: '**provider-kubernetes:**\nGerencia recursos K8s como MRs Crossplane.\n\nUso tipico em Compositions:\n- Criar Namespace para o time\n- Criar ServiceAccount\n- Criar NetworkPolicy\n- Criar Quota de recursos\n\n\`\`\`yaml\napiVersion: kubernetes.crossplane.io/v1alpha2\nkind: Object\nspec:\n  forProvider:\n    manifest:\n      apiVersion: v1\n      kind: Namespace\n      metadata:\n        name: team-alpha\n\`\`\`\n\n**provider-helm:**\nGerencia Helm Releases como MRs.\n\nUso tipico:\n- Instalar addons K8s (ingress-nginx, cert-manager)\n- Como parte de Composition para ambiente completo'
    }
  ],
  lab: {
    scenario: 'Voce precisa provisionar infraestrutura AWS basica usando Crossplane: um S3 Bucket para armazenar artefatos e uma simulacao de conexao com banco de dados.',
    objective: 'Aprender a instalar Providers, configurar ProviderConfig e criar Managed Resources no Crossplane.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Instalar Crossplane e Providers AWS',
        instruction: `Instale o Crossplane e configure o Provider AWS:
1. Instalar Crossplane via Helm no namespace crossplane-system
2. Instalar provider-family-aws e provider-aws-s3
3. Criar um Secret com credenciais AWS (formato INI)
4. Criar ProviderConfig apontando para o Secret`,
        hints: [
          'Use helm install crossplane crossplane-stable/crossplane',
          'Instalar o family provider ANTES do sub-provider',
          'O Secret deve estar em namespace crossplane-system'
        ],
        solution: `\`\`\`bash
# Instalar Crossplane
helm repo add crossplane-stable https://charts.crossplane.io/stable
helm install crossplane crossplane-stable/crossplane \\
  --namespace crossplane-system \\
  --create-namespace

kubectl wait --for=condition=Available deployment/crossplane -n crossplane-system --timeout=120s
\`\`\`

\`\`\`yaml
# providers.yaml
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-aws
spec:
  package: xpkg.upbound.io/upbound/provider-family-aws:v1.14.0
  packagePullPolicy: IfNotPresent
  revisionActivationPolicy: Automatic
---
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-aws-s3
spec:
  package: xpkg.upbound.io/upbound/provider-aws-s3:v1.14.0
  packagePullPolicy: IfNotPresent
  revisionActivationPolicy: Automatic
\`\`\`

\`\`\`bash
kubectl apply -f providers.yaml
# Aguardar providers ficarem saudaveis (pode demorar 2-3 min)
kubectl wait --for=condition=Healthy provider/provider-aws-s3 --timeout=180s
\`\`\`

\`\`\`bash
# Criar Secret com credenciais AWS
cat > /tmp/aws-credentials.txt <<EOF
[default]
aws_access_key_id = AKIAXXXXXXXXXXXXXXXX
aws_secret_access_key = XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
EOF
kubectl create secret generic aws-credentials \\
  -n crossplane-system \\
  --from-file=credentials=/tmp/aws-credentials.txt
\`\`\`

\`\`\`yaml
# provider-config.yaml
apiVersion: aws.upbound.io/v1beta1
kind: ProviderConfig
metadata:
  name: aws-production
spec:
  credentials:
    source: Secret
    secretRef:
      namespace: crossplane-system
      name: aws-credentials
      key: credentials
\`\`\`

\`\`\`bash
kubectl apply -f provider-config.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar Crossplane rodando
kubectl get pods -n crossplane-system
# Saida esperada: crossplane e crossplane-rbac-manager Running

# Verificar providers instalados
kubectl get providers
# Saida esperada: provider-aws e provider-aws-s3 com INSTALLED=True HEALTHY=True

# Verificar CRDs AWS instalados
kubectl get crds | grep s3.aws
# Saida esperada: buckets.s3.aws.upbound.io e outros CRDs S3

# Verificar ProviderConfig
kubectl get providerconfig aws-production
# Saida esperada: aws-production
\`\`\``
      },
      {
        title: 'Criar S3 Bucket como Managed Resource',
        instruction: `Crie um Managed Resource S3 Bucket:
1. Criar um Bucket S3 com nome unico (use external-name para o nome real na AWS)
2. Regiao us-east-1, privado
3. Usar deletionPolicy: Orphan
4. Adicionar tags Environment=production e Team=platform
5. Verificar que o bucket foi criado e esta Ready`,
        hints: [
          'external-name define o nome real do bucket na AWS',
          'Nomes de bucket S3 devem ser globalmente unicos',
          'Use kubectl describe para ver detalhes do status'
        ],
        solution: `\`\`\`yaml
# s3-bucket.yaml
apiVersion: s3.aws.upbound.io/v1beta1
kind: Bucket
metadata:
  name: my-app-artifacts
  annotations:
    crossplane.io/external-name: my-app-artifacts-acme-corp-2024
spec:
  forProvider:
    region: us-east-1
    tags:
      Environment: production
      Team: platform
      ManagedBy: crossplane
  providerConfigRef:
    name: aws-production
  deletionPolicy: Orphan
\`\`\`

\`\`\`bash
kubectl apply -f s3-bucket.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar status do Bucket
kubectl get bucket my-app-artifacts
# Saida esperada: READY=True SYNCED=True (pode demorar 1-2 min)

# Ver detalhes completos
kubectl describe bucket my-app-artifacts | grep -A15 "Conditions:"
# Saida esperada:
# Type: Ready, Status: True, Reason: Available
# Type: Synced, Status: True, Reason: ReconcileSuccess

# Ver estado na AWS (atProvider)
kubectl get bucket my-app-artifacts -o jsonpath='{.status.atProvider}'
# Saida esperada: estado atual do bucket lido da AWS

# Listar todos os managed resources
kubectl get managed
# Saida esperada: bucket/my-app-artifacts READY=True
\`\`\``
      },
      {
        title: 'Inspecionar e fazer drift detection',
        instruction: `Explore drift detection do Crossplane:
1. Verificar os eventos e conditions do Bucket
2. Simular drift: tente adicionar uma propriedade no spec.forProvider que seja diferente
3. Observe como o Crossplane detecta e reporta a diferenca
4. Verificar logs do Provider para entender o ciclo de reconciliacao`,
        hints: [
          'kubectl get events -n crossplane-system mostra eventos de reconciliacao',
          'kubectl logs -n crossplane-system -l pkg.crossplane.io/revision=provider-aws-s3 mostra os logs',
          'Modificar spec.forProvider e fazer kubectl apply para ver reconciliacao'
        ],
        solution: `\`\`\`bash
# Verificar eventos de reconciliacao
kubectl get events -n crossplane-system --sort-by='.lastTimestamp' | tail -10

# Verificar logs do provider (reconcile loop)
kubectl logs -n crossplane-system \\
  -l pkg.crossplane.io/revision=provider-aws-s3 \\
  --tail=20

# Verificar generation e resourceVersion (indica mudancas)
kubectl get bucket my-app-artifacts -o jsonpath='{.metadata.resourceVersion}'

# Adicionar uma tag ao spec.forProvider para ver reconciliacao
kubectl patch bucket my-app-artifacts --type='merge' -p '{
  "spec": {
    "forProvider": {
      "tags": {
        "Environment": "production",
        "Team": "platform",
        "UpdatedBy": "crossplane-test"
      }
    }
  }
}'

# Aguardar e verificar que SYNCED volta a True
kubectl get bucket my-app-artifacts -w
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o bucket ainda esta Ready e Synced apos mudanca
kubectl get bucket my-app-artifacts
# Saida esperada: READY=True SYNCED=True

# Verificar a nova tag em atProvider
kubectl get bucket my-app-artifacts -o jsonpath='{.status.atProvider.tags}'
# Saida esperada: tags incluindo UpdatedBy=crossplane-test

# Verificar condicao Synced detalhada
kubectl get bucket my-app-artifacts -o yaml | grep -A5 "type: Synced"
# Saida esperada: status: "True" reason: ReconcileSuccess

# Verificar external-name
kubectl get bucket my-app-artifacts -o jsonpath='{.metadata.annotations.crossplane\\.io/external-name}'
# Saida esperada: my-app-artifacts-acme-corp-2024
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'MR fica em estado Synced=True mas Ready=False por longo periodo',
      difficulty: 'medium',
      symptom: 'O Managed Resource mostra Synced=True mas Ready=False por mais de 5 minutos. O recurso deveria ter sido criado rapidamente.',
      diagnosis: `\`\`\`bash
# 1. Verificar detalhes da condition
kubectl describe bucket my-bucket | grep -A8 "Conditions:"
# Procurar pelo reason da condition Ready=False

# 2. Verificar se o recurso existe na cloud
# (se nao existir, o problema e na criacao; se existir, e no status)

# 3. Verificar eventos recentes
kubectl get events --field-selector "involvedObject.name=my-bucket" -n crossplane-system

# 4. Verificar logs do provider
kubectl logs -n crossplane-system \\
  -l pkg.crossplane.io/revision=provider-aws-s3 \\
  --tail=30 | grep -i "my-bucket"

# 5. Verificar se ha erros de quota ou limites
kubectl get bucket my-bucket -o yaml | grep -i "message:"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Recurso sendo criado (transitorio):** Alguns recursos demoram (RDS: 5-10min, EKS: 15-20min). Verificar a mensagem da condition para entender o progresso.

2. **Dependencia nao resolvida:** Se o MR referencia outro MR (via Ref), o recurso referenciado pode ainda nao estar Ready. Verificar kubectl get managed para ver o estado de todos.

3. **Quota AWS excedida:** A mensagem pode indicar quota limit. Verificar Service Quotas no console AWS e solicitar aumento.

4. **Nome duplicado:** external-name com nome ja existente em outra conta. Crossplane pode estar tentando criar mas nao conseguindo adotar o recurso existente.

5. **Problema transiente de API:** AWS API pode estar tendo issues. Verificar AWS Status page e aguardar reconciliacao automatica.`
    },
    {
      title: 'Provider funciona mas MRs nao aparecem no kubectl get crds',
      difficulty: 'hard',
      symptom: 'O Provider mostra INSTALLED=True e HEALTHY=True mas os CRDs dos recursos nao aparecem. Nao e possivel criar MRs.',
      diagnosis: `\`\`\`bash
# 1. Verificar se e o provider family
kubectl get providers
# Verificar se provider-family-aws esta instalado

# 2. Verificar revisoes do provider
kubectl get providerrevisions
# Verificar se ha revisao Active

# 3. Verificar logs do crossplane-rbac-manager
kubectl logs -n crossplane-system \\
  -l app=crossplane-rbac-manager --tail=20

# 4. Verificar se o package e correto
kubectl get provider provider-aws-s3 -o yaml | grep "spec.package"

# 5. Verificar se o pod do provider existe
kubectl get pods -n crossplane-system | grep s3
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Family provider nao instalado:** Para AWS, instalar provider-family-aws ANTES dos sub-providers. O family provider instala tipos comuns que os sub-providers precisam.

2. **Provider instalando ainda:** Aguardar o provider terminar de instalar todos os CRDs. Pode demorar alguns minutos. Verificar kubectl get providers --watch.

3. **Package errado:** Verificar que o nome do package em spec.package esta correto (xpkg.upbound.io/upbound/provider-aws-s3, nao provider-aws/s3).

4. **Versao incompativel:** Versao do provider incompativel com versao do Crossplane. Verificar matriz de compatibilidade na documentacao.

5. **Falta de RBAC para CRDs:** O Crossplane precisa de permissao para criar CRDs (ClusterRole). Verificar se o crossplane-rbac-manager esta rodando e saudavel.`
    }
  ]
};
