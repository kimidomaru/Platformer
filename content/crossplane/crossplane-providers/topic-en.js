window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['crossplane/crossplane-providers'] = {
  theory: `
# Crossplane Providers & Managed Resources

## Relevance
Providers are the heart of Crossplane — packages that install CRDs for resources of a specific cloud provider. Each Provider exposes hundreds of Managed Resources (MRs) that map 1:1 to real resources in the cloud. Mastering Providers means knowing how to install, configure, and use the most common AWS, GCP, and Azure resources.

## Core Concepts

### Provider Ecosystem

\`\`\`
Official Providers (Upbound):
├── provider-aws-*         — AWS (multiple sub-providers)
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

Community Providers:
├── provider-upjet-*       — Auto-generated from Terraform
└── Many others at upbound.io/marketplace
\`\`\`

### Provider Installation (Family Pattern)

\`\`\`yaml
# AWS Providers use the "family" pattern
# Install the main provider-aws + specific sub-providers

# 1. Provider Family (installs common types + manages sub-providers)
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-aws
spec:
  package: xpkg.upbound.io/upbound/provider-family-aws:v1.14.0
  packagePullPolicy: IfNotPresent
  revisionActivationPolicy: Automatic
---
# 2. Specific sub-provider
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

### ProviderConfig with IRSA (AWS EKS)

\`\`\`yaml
# IRSA configuration — no credentials stored in the cluster
apiVersion: aws.upbound.io/v1beta1
kind: ProviderConfig
metadata:
  name: aws-production
spec:
  credentials:
    source: IRSA

# For IRSA to work, the Provider's ServiceAccount needs an annotation:
# eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/CrossplaneRole

# Apply via DeploymentRuntimeConfig:
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

### Common AWS Managed Resources

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

### Common GCP Managed Resources

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
# GCP ProviderConfig
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

### Common Azure Managed Resources

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

### writeConnectionSecretsToRef — Exporting Credentials

\`\`\`yaml
# RDS exports connection string to a Secret
apiVersion: rds.aws.upbound.io/v1beta1
kind: Instance
metadata:
  name: app-database
spec:
  forProvider:
    # ... RDS config
  writeConnectionSecretsToRef:
    namespace: default
    name: app-db-connection   # Secret created automatically
  providerConfigRef:
    name: aws-production

# The created Secret will contain:
# endpoint: app-database.xxxx.us-east-1.rds.amazonaws.com
# port: 5432
# username: master
# password: <generated>
# connectionString: postgresql://...
\`\`\`

### Cross-Resource References

\`\`\`yaml
# Reference other MRs by name (avoid hardcoding IDs)
spec:
  forProvider:
    # By reference (creates dependency tracking)
    vpcIdRef:
      name: production-vpc        # Crossplane resolves the ID automatically

    # By selector (dynamic)
    vpcIdSelector:
      matchLabels:
        env: production
        team: platform

    # By direct value (avoid when possible)
    vpcId: vpc-0a1b2c3d4e5f
\`\`\`

### Importing Existing Resources

\`\`\`yaml
# Import an existing S3 bucket without deleting it
apiVersion: s3.aws.upbound.io/v1beta1
kind: Bucket
metadata:
  name: existing-bucket
  annotations:
    crossplane.io/external-name: my-existing-bucket-prod  # real name in AWS
spec:
  forProvider:
    region: us-east-1
    # ... config must match the current state
  deletionPolicy: Orphan           # Don't delete when removing the CR
  managementPolicies:
    - Observe                      # Read only, don't modify
  providerConfigRef:
    name: aws-production

# Crossplane will:
# 1. Find the resource in the cloud by external-name
# 2. Populate status.atProvider with current state
# 3. If managementPolicies includes FullControl, reconcile to spec.forProvider
\`\`\`

### provider-kubernetes and provider-helm

\`\`\`yaml
# provider-kubernetes — manage K8s resources via Crossplane
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
# provider-helm — deploy Helm charts via Crossplane
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

### Common Mistakes

1. **Family provider not installed** — AWS sub-providers need provider-family-aws installed first
2. **writeConnectionSecrets without RBAC** — The Provider's ServiceAccount needs to create Secrets in the target namespace
3. **Dangling cross-resource ref** — Referencing a MR that hasn't been created yet (use explicit dependency)
4. **Wrong managementPolicies** — ObserveOnly doesn't reconcile; use FullControl for full management
5. **Missing external-name on import** — Without the annotation, Crossplane creates a new resource instead of importing

## Killer.sh Style Challenge

> **Scenario:** Provision using Crossplane on AWS: (1) a VPC with CIDR 10.0.0.0/16, (2) two Subnets in different AZs referencing the VPC by ref, (3) a PostgreSQL RDS db.t3.micro in MultiAZ mode that exports a connection string to a Secret "db-credentials", (4) all with deletionPolicy: Orphan.
`,
  quiz: [
    {
      question: 'How are AWS providers organized in Crossplane v1+?',
      options: [
        'A single provider for all of AWS',
        'Family pattern: provider-family-aws + specific sub-providers (provider-aws-s3, provider-aws-rds, etc)',
        'One provider per AWS region',
        'Providers by service type (compute, storage, database)'
      ],
      correct: 1,
      explanation: 'AWS uses the "family pattern": provider-family-aws is the main provider that manages shared types. Specific sub-providers (provider-aws-s3, provider-aws-rds, provider-aws-ec2) install CRDs for specific services. This reduces the number of CRDs per provider.',
      reference: 'Related concept: The family provider must be installed before sub-providers.'
    },
    {
      question: 'What does writeConnectionSecretsToRef do in a Managed Resource?',
      options: [
        'Stores ProviderConfig credentials',
        'Automatically exports connection information from the provisioned resource to a Kubernetes Secret',
        'Connects two different MRs',
        'Configures network access for the resource'
      ],
      correct: 1,
      explanation: 'writeConnectionSecretsToRef instructs Crossplane to create a Secret with the resource\'s connection information (endpoint, port, user, password). Very useful for RDS, ElastiCache, etc. — apps can mount this Secret directly.',
      reference: 'Related concept: The Secret is created in the specified namespace. The Provider\'s ServiceAccount needs permission to create Secrets in that namespace.'
    },
    {
      question: 'How do you reference a Crossplane resource by name instead of hardcoded ID?',
      options: [
        'Using labels',
        'Using *Ref fields (vpcIdRef, securityGroupIdRef) that automatically resolve the referenced resource\'s ID',
        'Using ConfigMaps',
        'Using environment variables'
      ],
      correct: 1,
      explanation: '*Ref fields (like vpcIdRef.name) allow referencing other MRs by Kubernetes name. Crossplane automatically resolves the cloud resource ID. Alternative: *Selector with matchLabels for dynamic selection.',
      reference: 'Related concept: Refs create dependencies between resources — Crossplane waits for the referenced resource to be Ready.'
    },
    {
      question: 'How do you import an existing cloud resource into Crossplane without deleting it?',
      options: [
        'Use kubectl import',
        'Set crossplane.io/external-name with the existing resource name, deletionPolicy: Orphan and managementPolicies: [Observe]',
        'Use the crossplane import CLI',
        'Create a Composition that imports'
      ],
      correct: 1,
      explanation: 'To import: (1) external-name with the real cloud name, (2) deletionPolicy: Orphan to not delete when removing the CR, (3) managementPolicies: [Observe] to read-only without modifying. Crossplane fetches and populates status.atProvider.',
      reference: 'Related concept: Switch to FullControl after importing to let Crossplane reconcile state.'
    },
    {
      question: 'What does provider-kubernetes do?',
      options: [
        'Installs Kubernetes on AWS',
        'Allows managing Kubernetes resources (Namespace, Deployment, etc.) as Crossplane Managed Resources',
        'Configures the Kubernetes cluster for Crossplane',
        'Installs additional providers'
      ],
      correct: 1,
      explanation: 'provider-kubernetes exposes a CRD called Object that can manage any Kubernetes resource. Useful in Compositions to create K8s resources alongside cloud infrastructure (e.g., create Namespace + RDS + ServiceAccount all at once).',
      reference: 'Related concept: provider-helm allows deploying Helm charts as Managed Resources.'
    },
    {
      question: 'What is the difference between managementPolicies Observe and FullControl?',
      options: [
        'There is no difference',
        'ObserveOnly reads cloud state but does not modify; FullControl reconciles desired state with actual state',
        'FullControl is safer than ObserveOnly',
        'ObserveOnly is only used for testing'
      ],
      correct: 1,
      explanation: 'ObserveOnly: Crossplane reads cloud state and populates status.atProvider but does NOT apply changes. FullControl (default): Crossplane continuously reconciles, applying spec.forProvider and reverting drift.',
      reference: 'Related concept: Use ObserveOnly for externally managed resources where you want visibility but not control.'
    },
    {
      question: 'How do you configure IRSA in Crossplane for AWS authentication without credentials?',
      options: [
        'Use a special Secret called irsa-secret',
        'Configure ProviderConfig with credentials.source: IRSA and annotate the Provider\'s ServiceAccount with the IAM Role ARN',
        'Install a separate IRSA plugin',
        'Configure an environment variable in Crossplane'
      ],
      correct: 1,
      explanation: 'IRSA (IAM Roles for Service Accounts) allows the AWS Provider to use IAM roles without credentials in the cluster. Requires: (1) ProviderConfig with source: IRSA, (2) Provider\'s ServiceAccount annotated with eks.amazonaws.com/role-arn, (3) cluster OIDC configured in AWS.',
      reference: 'Related concept: IRSA is the recommended method for EKS; equivalent to Workload Identity in GCP.'
    }
  ],
  flashcards: [
    {
      front: 'What Crossplane providers exist and how are they organized?',
      back: '**Official Providers (Upbound):**\n- provider-family-aws + sub-providers\n  (s3, rds, ec2, iam, eks, kms, ...)\n- provider-family-gcp + sub-providers\n  (storage, sql, container, ...)\n- provider-family-azure + sub-providers\n  (storage, sql, containerservice, ...)\n\n**Special Providers:**\n- provider-kubernetes: K8s resources\n- provider-helm: Helm charts\n- provider-terraform: Terraform bridge\n\n**Family Pattern:**\nInstall family provider FIRST,\nthen specific sub-providers.\n\n**Marketplace:** upbound.io/marketplace'
    },
    {
      front: 'How do you reference resources between MRs?',
      back: '**By reference (recommended):**\n\`\`\`yaml\nvpcIdRef:\n  name: production-vpc\n\`\`\`\n- Crossplane resolves the ID automatically\n- Creates dependency between resources\n- Waits for referenced resource to be Ready\n\n**By selector (dynamic):**\n\`\`\`yaml\nvpcIdSelector:\n  matchLabels:\n    env: production\n\`\`\`\n- Selects the MR matching the labels\n- Useful for Compositions\n\n**By direct value (avoid):**\n\`\`\`yaml\nvpcId: vpc-0a1b2c3d4e5f\n\`\`\`\n- Hardcoded, brittle\n- Does not create dependency'
    },
    {
      front: 'How does writeConnectionSecretsToRef work?',
      back: '**What it does:**\nExports connection information from the provisioned resource to a Kubernetes Secret.\n\n**Typical exported fields (RDS):**\n- endpoint: hostname\n- port: port number\n- username: master user\n- password: generated password\n- connectionString: full URL\n\n**Configuration:**\n\`\`\`yaml\nwriteConnectionSecretsToRef:\n  namespace: default\n  name: app-db-connection\n\`\`\`\n\n**Required RBAC:**\nProvider\'s ServiceAccount needs\ncreate/update Secrets in the target namespace.\n\n**App usage:**\nMount the Secret as env vars or volume.'
    },
    {
      front: 'Common AWS MRs and their apiGroups',
      back: '**S3:**\n- apiGroup: s3.aws.upbound.io/v1beta1\n- kind: Bucket\n\n**RDS:**\n- apiGroup: rds.aws.upbound.io/v1beta1\n- kind: Instance\n\n**EC2:**\n- apiGroup: ec2.aws.upbound.io/v1beta1\n- kinds: VPC, Subnet, SecurityGroup, InternetGateway\n\n**EKS:**\n- apiGroup: eks.aws.upbound.io/v1beta1\n- kinds: Cluster, NodeGroup\n\n**IAM:**\n- apiGroup: iam.aws.upbound.io/v1beta1\n- kinds: Role, Policy, RolePolicyAttachment\n\n**Tip:** kubectl get crds | grep aws\nto list all installed AWS CRDs'
    },
    {
      front: 'How do you import existing cloud resources into Crossplane?',
      back: '**Steps:**\n\n1. Create MR with correct external-name:\n\`\`\`yaml\nannotations:\n  crossplane.io/external-name: cloud-resource-name\n\`\`\`\n\n2. Use deletionPolicy: Orphan\n(don\'t delete when removing the CR)\n\n3. Start with managementPolicies: [Observe]\n(read only, don\'t modify)\n\n4. Verify status.atProvider is populated\n\n5. Adjust spec.forProvider to match\nthe current state\n\n6. Switch to FullControl to reconcile\n\n**Warning:** spec.forProvider must match\nthe cloud state exactly to avoid\nunintended modifications.'
    },
    {
      front: 'provider-kubernetes and provider-helm — what are they for?',
      back: '**provider-kubernetes:**\nManages K8s resources as Crossplane MRs.\n\nTypical use in Compositions:\n- Create Namespace for the team\n- Create ServiceAccount\n- Create NetworkPolicy\n- Create resource Quota\n\n\`\`\`yaml\napiVersion: kubernetes.crossplane.io/v1alpha2\nkind: Object\nspec:\n  forProvider:\n    manifest:\n      apiVersion: v1\n      kind: Namespace\n      metadata:\n        name: team-alpha\n\`\`\`\n\n**provider-helm:**\nManages Helm Releases as MRs.\n\nTypical use:\n- Install K8s addons (ingress-nginx, cert-manager)\n- As part of Composition for complete environment'
    }
  ],
  lab: {
    scenario: 'You need to provision basic AWS infrastructure using Crossplane: an S3 Bucket to store artifacts and simulate a database connection.',
    objective: 'Learn to install Providers, configure ProviderConfig, and create Managed Resources in Crossplane.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Install Crossplane and AWS Providers',
        instruction: `Install Crossplane and configure the AWS Provider:
1. Install Crossplane via Helm in the crossplane-system namespace
2. Install provider-family-aws and provider-aws-s3
3. Create a Secret with AWS credentials (INI format)
4. Create a ProviderConfig pointing to the Secret`,
        hints: [
          'Use helm install crossplane crossplane-stable/crossplane',
          'Install the family provider BEFORE the sub-provider',
          'The Secret must be in the crossplane-system namespace'
        ],
        solution: `\`\`\`bash
# Install Crossplane
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
# Wait for providers to become healthy (may take 2-3 min)
kubectl wait --for=condition=Healthy provider/provider-aws-s3 --timeout=180s
\`\`\`

\`\`\`bash
# Create Secret with AWS credentials
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
# Verify Crossplane is running
kubectl get pods -n crossplane-system
# Expected: crossplane and crossplane-rbac-manager Running

# Verify providers installed
kubectl get providers
# Expected: provider-aws and provider-aws-s3 with INSTALLED=True HEALTHY=True

# Verify AWS CRDs installed
kubectl get crds | grep s3.aws
# Expected: buckets.s3.aws.upbound.io and other S3 CRDs

# Verify ProviderConfig
kubectl get providerconfig aws-production
# Expected: aws-production
\`\`\``
      },
      {
        title: 'Create S3 Bucket as Managed Resource',
        instruction: `Create a Managed Resource S3 Bucket:
1. Create an S3 Bucket with a unique name (use external-name for the real AWS name)
2. Region us-east-1, private
3. Use deletionPolicy: Orphan
4. Add tags Environment=production and Team=platform
5. Verify the bucket was created and is Ready`,
        hints: [
          'external-name defines the real bucket name in AWS',
          'S3 bucket names must be globally unique',
          'Use kubectl describe to see status details'
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
# Verify Bucket status
kubectl get bucket my-app-artifacts
# Expected: READY=True SYNCED=True (may take 1-2 min)

# See full details
kubectl describe bucket my-app-artifacts | grep -A15 "Conditions:"
# Expected:
# Type: Ready, Status: True, Reason: Available
# Type: Synced, Status: True, Reason: ReconcileSuccess

# See AWS state (atProvider)
kubectl get bucket my-app-artifacts -o jsonpath='{.status.atProvider}'
# Expected: current bucket state read from AWS

# List all managed resources
kubectl get managed
# Expected: bucket/my-app-artifacts READY=True
\`\`\``
      },
      {
        title: 'Inspect and Test Drift Detection',
        instruction: `Explore Crossplane's drift detection:
1. Check the Bucket's events and conditions
2. Simulate drift: add a property to spec.forProvider that differs
3. Observe how Crossplane detects and reports the difference
4. Check Provider logs to understand the reconciliation cycle`,
        hints: [
          'kubectl get events -n crossplane-system shows reconciliation events',
          'kubectl logs -n crossplane-system -l pkg.crossplane.io/revision=provider-aws-s3 shows logs',
          'Modify spec.forProvider and kubectl apply to see reconciliation'
        ],
        solution: `\`\`\`bash
# Check reconciliation events
kubectl get events -n crossplane-system --sort-by='.lastTimestamp' | tail -10

# Check provider logs (reconcile loop)
kubectl logs -n crossplane-system \\
  -l pkg.crossplane.io/revision=provider-aws-s3 \\
  --tail=20

# Check generation and resourceVersion (indicates changes)
kubectl get bucket my-app-artifacts -o jsonpath='{.metadata.resourceVersion}'

# Add a tag to spec.forProvider to see reconciliation
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

# Wait and verify SYNCED returns to True
kubectl get bucket my-app-artifacts -w
\`\`\``,
        verify: `\`\`\`bash
# Verify bucket is still Ready and Synced after change
kubectl get bucket my-app-artifacts
# Expected: READY=True SYNCED=True

# Verify new tag in atProvider
kubectl get bucket my-app-artifacts -o jsonpath='{.status.atProvider.tags}'
# Expected: tags including UpdatedBy=crossplane-test

# Check Synced condition in detail
kubectl get bucket my-app-artifacts -o yaml | grep -A5 "type: Synced"
# Expected: status: "True" reason: ReconcileSuccess

# Check external-name
kubectl get bucket my-app-artifacts -o jsonpath='{.metadata.annotations.crossplane\\.io/external-name}'
# Expected: my-app-artifacts-acme-corp-2024
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'MR stays in Synced=True but Ready=False for a long time',
      difficulty: 'medium',
      symptom: 'The Managed Resource shows Synced=True but Ready=False for more than 5 minutes. The resource should have been created quickly.',
      diagnosis: `\`\`\`bash
# 1. Check condition details
kubectl describe bucket my-bucket | grep -A8 "Conditions:"
# Look for the reason of the Ready=False condition

# 2. Check if the resource exists in the cloud
# (if not present, the problem is in creation; if it exists, it's in status)

# 3. Check recent events
kubectl get events --field-selector "involvedObject.name=my-bucket" -n crossplane-system

# 4. Check provider logs
kubectl logs -n crossplane-system \\
  -l pkg.crossplane.io/revision=provider-aws-s3 \\
  --tail=30 | grep -i "my-bucket"

# 5. Check for quota or limit errors
kubectl get bucket my-bucket -o yaml | grep -i "message:"
\`\`\``,
      solution: `**Causes and solutions:**

1. **Resource being created (transient):** Some resources take time (RDS: 5-10min, EKS: 15-20min). Check the condition message to understand progress.

2. **Unresolved dependency:** If the MR references another MR (via Ref), the referenced resource may not be Ready yet. Check kubectl get managed to see all states.

3. **AWS quota exceeded:** The message may indicate quota limit. Check Service Quotas in the AWS console and request an increase.

4. **Duplicate name:** external-name with a name already existing in another account. Crossplane may be trying to create but unable to adopt the existing resource.

5. **Transient API issue:** AWS API may be having issues. Check the AWS Status page and wait for automatic reconciliation.`
    },
    {
      title: 'Provider works but MR CRDs don\'t appear in kubectl get crds',
      difficulty: 'hard',
      symptom: 'The Provider shows INSTALLED=True and HEALTHY=True but resource CRDs don\'t appear. Cannot create MRs.',
      diagnosis: `\`\`\`bash
# 1. Check if it's the family provider
kubectl get providers
# Verify provider-family-aws is installed

# 2. Check provider revisions
kubectl get providerrevisions
# Verify there is an Active revision

# 3. Check crossplane-rbac-manager logs
kubectl logs -n crossplane-system \\
  -l app=crossplane-rbac-manager --tail=20

# 4. Verify the package is correct
kubectl get provider provider-aws-s3 -o yaml | grep "spec.package"

# 5. Check if the provider pod exists
kubectl get pods -n crossplane-system | grep s3
\`\`\``,
      solution: `**Causes and solutions:**

1. **Family provider not installed:** For AWS, install provider-family-aws BEFORE sub-providers. The family provider installs shared types that sub-providers need.

2. **Provider still installing:** Wait for the provider to finish installing all CRDs. May take a few minutes. Check kubectl get providers --watch.

3. **Wrong package:** Verify the package name in spec.package is correct (xpkg.upbound.io/upbound/provider-aws-s3, not provider-aws/s3).

4. **Incompatible version:** Provider version incompatible with Crossplane version. Check compatibility matrix in documentation.

5. **Missing RBAC for CRDs:** Crossplane needs permission to create CRDs (ClusterRole). Verify that crossplane-rbac-manager is running and healthy.`
    }
  ]
};
