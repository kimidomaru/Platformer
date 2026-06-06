window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['crossplane/crossplane-fundamentals'] = {
  theory: `
# Crossplane Fundamentals

## Relevance
Crossplane is an open-source framework (CNCF Graduated) that transforms Kubernetes into a **Universal Control Plane** for infrastructure. Instead of using separate Terraform or CloudFormation, Crossplane lets you provision and manage cloud infrastructure (AWS, GCP, Azure) using native Kubernetes CRDs — integrating infrastructure into the GitOps workflow.

## Core Concepts

### What is Crossplane?

\`\`\`
Terraform vs Crossplane:

┌──────────────────────┐    ┌──────────────────────┐
│      Terraform        │    │      Crossplane       │
├──────────────────────┤    ├──────────────────────┤
│ State file (.tfstate)│    │ State in K8s (etcd)   │
│ CLI (plan/apply)     │    │ kubectl apply         │
│ Modules              │    │ Compositions/XRDs     │
│ Providers            │    │ Providers (CRDs)      │
│ Workspaces           │    │ Namespaces + Claims   │
│ Separate from K8s    │    │ Native to K8s         │
│ Manual drift detect  │    │ Continuous reconcile  │
└──────────────────────┘    └──────────────────────┘

Crossplane does NOT replace Terraform for everything.
Crossplane shines when:
- Infrastructure is managed by the same team that ops K8s
- Self-service via GitOps (dev makes claim, platform provisions)
- Need for continuous reconciliation (native drift detection)
\`\`\`

### Crossplane Architecture

\`\`\`
┌──────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 Crossplane                           │    │
│  │                                                     │    │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │    │
│  │  │  Provider  │  │Composition │  │   Function   │  │    │
│  │  │  (CRDs)    │  │ Engine     │  │ (Pipeline)   │  │    │
│  │  └─────┬──────┘  └─────┬──────┘  └──────┬───────┘  │    │
│  │        │               │                │           │    │
│  │  ┌─────▼──────────────▼────────────────▼───────┐   │    │
│  │  │           Managed Resources (MRs)           │   │    │
│  │  │  Bucket, RDSInstance, VPC, GKECluster...    │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                    ┌──────▼──────┐                           │
│                    │ProviderConfig│                          │
│                    │(credentials)│                           │
│                    └──────┬──────┘                           │
└───────────────────────────┼──────────────────────────────────┘
                            │  API calls
              ┌─────────────┼────────────────┐
              ▼             ▼                ▼
           ┌─────┐       ┌─────┐        ┌───────┐
           │ AWS │       │ GCP │        │ Azure │
           └─────┘       └─────┘        └───────┘
\`\`\`

### Crossplane Layers

\`\`\`
Level 1 — Managed Resources (MRs)
  Direct representation of cloud resources as CRDs
  Ex: Bucket, RDSInstance, VPCPeeringConnection
  Provisioned directly by Providers
  1:1 with real cloud resources

Level 2 — Composite Resources (XRs) and Claims
  Abstractions created by Platform Teams
  Hide complexity of direct MRs
  Ex: XDatabase (abstracts RDS + Parameter Group + SG)
  Claims = interface for developers

Level 3 — Platform API (XRDs)
  Definitions of the platform's custom APIs
  XRD (CompositeResourceDefinition) defines the schema
  Composition defines how to compose resources
  Functions extend composition logic
\`\`\`

### Managed Resources (MRs)

\`\`\`yaml
# Managed Resource — direct cloud resource provisioning
apiVersion: s3.aws.upbound.io/v1beta1
kind: Bucket
metadata:
  name: my-data-bucket
  annotations:
    crossplane.io/external-name: my-data-bucket-prod-2024
spec:
  forProvider:
    region: us-east-1
    acl: private
    tags:
      Environment: production
      Team: platform
  providerConfigRef:
    name: aws-production
  deletionPolicy: Delete    # Delete | Orphan
\`\`\`

**Essential Managed Resource fields:**

| Field | Description |
|-------|-------------|
| \`spec.forProvider\` | Resource configuration in the cloud |
| \`spec.providerConfigRef\` | Reference to ProviderConfig with credentials |
| \`spec.deletionPolicy\` | What to do on delete (Delete or Orphan the real resource) |
| \`metadata.annotations.crossplane.io/external-name\` | Resource name in the cloud |
| \`status.atProvider\` | Current resource state read from the cloud |
| \`status.conditions\` | Ready/Synced conditions |

### ProviderConfig — Credentials

\`\`\`yaml
# ProviderConfig for AWS
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
---
# Secret with AWS credentials
apiVersion: v1
kind: Secret
metadata:
  name: aws-credentials
  namespace: crossplane-system
type: Opaque
data:
  # base64 encoded AWS credentials file format:
  # [default]
  # aws_access_key_id = AKIAXXXXXXXX
  # aws_secret_access_key = XXXXXXXXXX
  credentials: <base64-encoded>
\`\`\`

**Alternative with IRSA (recommended for EKS):**

\`\`\`yaml
apiVersion: aws.upbound.io/v1beta1
kind: ProviderConfig
metadata:
  name: aws-production
spec:
  credentials:
    source: IRSA    # IAM Role via ServiceAccount annotation
\`\`\`

### Installation

\`\`\`bash
# Install Crossplane via Helm
helm repo add crossplane-stable https://charts.crossplane.io/stable
helm install crossplane crossplane-stable/crossplane \\
  --namespace crossplane-system \\
  --create-namespace

# Verify installation
kubectl get pods -n crossplane-system
# crossplane, crossplane-rbac-manager

# Install AWS Provider
kubectl apply -f - <<EOF
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-aws-s3
spec:
  package: xpkg.upbound.io/upbound/provider-aws-s3:v1.14.0
  packagePullPolicy: IfNotPresent
  revisionActivationPolicy: Automatic
EOF

# Verify Provider
kubectl get providers
# INSTALLED=True, HEALTHY=True
\`\`\`

### Managed Resource Conditions

\`\`\`yaml
# Healthy MR status
status:
  conditions:
    - type: Ready
      status: "True"
      reason: Available
      message: ""
    - type: Synced
      status: "True"
      reason: ReconcileSuccess

# Status with error
status:
  conditions:
    - type: Ready
      status: "False"
      reason: Unavailable
      message: "cannot create bucket: BucketAlreadyExists"
    - type: Synced
      status: "False"
      reason: ReconcileError
\`\`\`

**Interpreting conditions:**
- **Ready=True**: Resource exists and is available in the cloud
- **Synced=True**: Last reconcile was successful
- **Ready=False + Synced=False**: Provisioning error
- **Ready=False + Synced=True**: Resource being created (Transitioning)

### Continuous Provisioning (Drift Detection)

\`\`\`
Crossplane vs Terraform — Drift Detection

Terraform:                  Crossplane:
plan → apply → forget       continuous reconcile loop

Someone modifies the        Crossplane detects
bucket manually       →     the change and REVERTS
in the AWS console          automatically
                            (if managementPolicy != observe)

managementPolicy:
  - FullControl (default) — Crossplane manages everything
  - ObserveOnly — Crossplane only observes (read-only)
\`\`\`

### Common Mistakes

1. **ProviderConfig not found** — MR references a ProviderConfig that does not exist
2. **Invalid credentials** — Secret with incorrect credential format
3. **Forgotten deletionPolicy: Orphan** — Cloud resource becomes orphaned after MR delete
4. **external-name conflict** — Cloud resource name already exists in another account/region
5. **Provider not Healthy** — Check provider image and cloud connectivity
6. **Insufficient RBAC** — Crossplane needs permissions to manage Provider CRDs

## Killer.sh Style Challenge

> **Scenario:** Using Crossplane, provision an S3 Bucket in AWS with region us-east-1, Orphan deletion policy (to avoid accidental deletion), with tag Environment=production. Configure the ProviderConfig using a Secret with credentials. Verify the bucket is Ready and Synced.
`,
  quiz: [
    {
      question: 'What differentiates Crossplane from Terraform in infrastructure management?',
      options: [
        'Crossplane is faster than Terraform',
        'Crossplane uses Kubernetes as a control plane with native continuous reconciliation; Terraform uses a state file and requires manual runs',
        'Terraform supports more clouds than Crossplane',
        'Crossplane is only for AWS'
      ],
      correct: 1,
      explanation: 'Crossplane integrates infrastructure management into Kubernetes (CRDs, kubectl, GitOps), with continuous reconciliation that detects and corrects drift automatically. Terraform uses a separate state file and requires explicit plan/apply execution.',
      reference: 'Related concept: Crossplane shines in self-service scenarios with Platform APIs and GitOps.'
    },
    {
      question: 'What are Managed Resources (MRs) in Crossplane?',
      options: [
        'Pods managed by Crossplane',
        'CRDs that represent 1:1 real cloud resources (e.g., Bucket, RDSInstance, VPC)',
        'Monitoring resources',
        'Kubernetes configurations'
      ],
      correct: 1,
      explanation: 'Managed Resources are CRDs installed by Providers that directly represent cloud resources. A Bucket CR corresponds to a real S3 bucket. Crossplane continuously reconciles the desired state with reality.',
      reference: 'Related concept: spec.forProvider contains the cloud resource config; status.atProvider reflects the current state.'
    },
    {
      question: 'What is the purpose of spec.deletionPolicy in a Managed Resource?',
      options: [
        'Define the backup policy',
        'Control whether the real cloud resource will be deleted when the MR is deleted (Delete or Orphan)',
        'Configure autoscaling policy',
        'Define log retention'
      ],
      correct: 1,
      explanation: 'deletionPolicy: Delete removes the cloud resource when the MR is deleted. deletionPolicy: Orphan removes only the CRD but keeps the cloud resource (useful to prevent accidental deletions of production resources).',
      reference: 'Related concept: Use Orphan on critical data resources like production databases and buckets.'
    },
    {
      question: 'What does Ready=False and Synced=True mean on a Managed Resource?',
      options: [
        'The resource has a permanent error',
        'The resource is being created/provisioned (transient state)',
        'The resource was deleted',
        'Credentials are invalid'
      ],
      correct: 1,
      explanation: 'Ready=False + Synced=True indicates the last reconcile was successful (no API error), but the resource is not yet available — usually because it is still being created. When Ready=False + Synced=False, there is a real error.',
      reference: 'Related concept: Ready=True + Synced=True is the expected healthy state.'
    },
    {
      question: 'What are the three main layers of the Crossplane architecture?',
      options: [
        'Pods, Services, Ingress',
        'Managed Resources (MRs), Composite Resources (XRs/Claims), Platform API (XRDs)',
        'Control Plane, Data Plane, Management Plane',
        'Providers, Operators, Controllers'
      ],
      correct: 1,
      explanation: 'Level 1: MRs (1:1 with cloud resources). Level 2: XRs and Claims (abstractions created by platform teams to hide complexity). Level 3: XRDs (platform API definitions that generate Claim CRDs).',
      reference: 'Related concept: Claims are the developer interface; XRDs define the Claim schema.'
    },
    {
      question: 'What is the ProviderConfig for in Crossplane?',
      options: [
        'Configure the Provider version',
        'Define cloud provider access credentials (AWS, GCP, Azure)',
        'Configure Provider resource limits',
        'Define which MRs the Provider can create'
      ],
      correct: 1,
      explanation: 'ProviderConfig defines the credentials used by the Provider to access the cloud. It can reference a Secret with credentials, or use IRSA (AWS), Workload Identity (GCP), or Managed Identity (Azure) for passwordless authentication.',
      reference: 'Related concept: MRs reference ProviderConfig via spec.providerConfigRef.'
    },
    {
      question: 'What does the crossplane.io/external-name annotation define?',
      options: [
        'The CRD name in Kubernetes',
        'The real resource name in the cloud (e.g., S3 bucket name)',
        'The Provider name',
        'The Composition name'
      ],
      correct: 1,
      explanation: 'The crossplane.io/external-name annotation defines the resource name in the cloud. If not specified, Crossplane uses the MR metadata.name. Useful when the cloud name must differ from the K8s name or when importing existing resources.',
      reference: 'Related concept: To import existing resources, set external-name to the name of the already existing cloud resource.'
    }
  ],
  flashcards: [
    {
      front: 'What is Crossplane and what problem does it solve?',
      back: '**Crossplane** = Kubernetes as Universal Control Plane for infrastructure.\n\n**Problem solved:**\nManage cloud infrastructure (AWS/GCP/Azure) with the same K8s tools (kubectl, GitOps, RBAC).\n\n**How it works:**\n- Providers install CRDs for cloud resources\n- kubectl apply provisions real resources\n- Continuous reconciliation detects and corrects drift\n\n**Advantages over Terraform:**\n- State in etcd (not in state file)\n- Native drift detection (continuous reconcile)\n- Native GitOps (Pull model)\n- Self-service via Claims\n- K8s RBAC for access control'
    },
    {
      front: 'What are the Crossplane architecture layers?',
      back: '**Level 1 — Managed Resources:**\n- 1:1 with real cloud resources\n- Installed by Providers\n- Ex: Bucket, RDSInstance, VPCSubnet\n- spec.forProvider = cloud config\n\n**Level 2 — Composite Resources (XR) and Claims:**\n- Abstractions created by Platform Teams\n- XR = cluster-scoped version\n- Claim = namespace-scoped version (for devs)\n- Hide complexity of MRs\n\n**Level 3 — Platform API:**\n- XRD (CompositeResourceDefinition)\n- Defines Claim schema\n- Composition implements how to compose\n- Functions extend logic'
    },
    {
      front: 'What are Managed Resources and what are the essential fields?',
      back: '**Managed Resources (MRs):**\nCRDs that represent cloud resources 1:1.\n\n**Essential fields:**\n- spec.forProvider: cloud resource config\n- spec.providerConfigRef: credentials\n- spec.deletionPolicy: Delete|Orphan\n- metadata.annotations.crossplane.io/external-name: cloud name\n\n**Status:**\n- status.atProvider: current state read from cloud\n- status.conditions:\n  - Ready=True: resource available\n  - Synced=True: last reconcile OK\n\n**Example:**\nBucket → real S3 bucket\nRDSInstance → real RDS database'
    },
    {
      front: 'How does deletionPolicy work?',
      back: '**Delete (default):**\n- Delete MR in K8s → deletes resource in cloud\n- Safe for temporary environments\n- Risk: may accidentally delete data\n\n**Orphan:**\n- Delete MR → removes only the CRD\n- Cloud resource REMAINS\n- Safe for resources with data\n- Use for: databases, production buckets\n\n**When to use Orphan:**\n- RDS databases\n- S3 buckets with critical data\n- Any resource you do NOT want accidentally deleted\n\n**After Orphan:**\nResource becomes "unmanaged" in the cloud. Manage manually or re-import.'
    },
    {
      front: 'What conditions should a healthy Managed Resource have?',
      back: '**Healthy state:**\n- Ready=True: resource available in cloud\n- Synced=True: last reconcile OK\n\n**Creating/Transitioning:**\n- Ready=False, Synced=True\n- Normal during provisioning\n- Wait for Ready=True\n\n**Error:**\n- Ready=False, Synced=False\n- Check message for cause\n- Common: invalid credentials, quota limit\n\n**Check:**\n\`\`\`bash\nkubectl get managed\nkubectl describe bucket my-bucket\nkubectl get events --field-selector reason=CannotObserveExternalResource\n\`\`\`'
    },
    {
      front: 'How to configure ProviderConfig with different authentication methods?',
      back: '**Secret (basic):**\n\`\`\`yaml\nspec:\n  credentials:\n    source: Secret\n    secretRef:\n      name: aws-creds\n      namespace: crossplane-system\n      key: credentials\n\`\`\`\n\n**IRSA (AWS EKS — recommended):**\n\`\`\`yaml\nspec:\n  credentials:\n    source: IRSA\n\`\`\`\nRequires annotation on Provider ServiceAccount.\n\n**Workload Identity (GCP):**\n\`\`\`yaml\nspec:\n  credentials:\n    source: InjectedIdentity\n\`\`\`\n\n**Managed Identity (Azure):**\n\`\`\`yaml\nspec:\n  credentials:\n    source: UserAssignedManagedIdentity\n\`\`\`'
    },
    {
      front: 'How to install Crossplane and a Provider?',
      back: '**Install Crossplane:**\n\`\`\`bash\nhelm repo add crossplane-stable \\\n  https://charts.crossplane.io/stable\nhelm install crossplane \\\n  crossplane-stable/crossplane \\\n  -n crossplane-system --create-namespace\n\`\`\`\n\n**Install Provider:**\n\`\`\`yaml\napiVersion: pkg.crossplane.io/v1\nkind: Provider\nmetadata:\n  name: provider-aws-s3\nspec:\n  package: xpkg.upbound.io/upbound/provider-aws-s3:v1.14.0\n\`\`\`\n\n**Verify:**\n\`\`\`bash\nkubectl get providers\n# INSTALLED=True, HEALTHY=True\nkubectl get crds | grep aws\n# Provider AWS CRDs installed\n\`\`\`'
    }
  ],
  lab: {
    scenario: 'You have a Kubernetes cluster (kind/minikube) with no cloud credentials. You want to learn the end-to-end Crossplane flow using provider-kubernetes, which manages objects of the cluster itself as Managed Resources — so the lab runs 100% locally, no AWS/GCP.',
    objective: 'Install Crossplane via Helm, configure provider-kubernetes, create a ProviderConfig, and provision a Managed Resource (Object) declaratively, understanding the Provider -> ProviderConfig -> Managed Resource cycle.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Install Crossplane in the cluster',
        instruction: 'Install the Crossplane core into the `crossplane-system` namespace using the official Helm chart and confirm the pods are Running.',
        hints: ['The Helm repo is https://charts.crossplane.io/stable', 'Use --create-namespace', 'The main deployments are crossplane + crossplane-rbac-manager'],
        solution: '```bash\nhelm repo add crossplane-stable https://charts.crossplane.io/stable\nhelm repo update\nhelm install crossplane crossplane-stable/crossplane \\\n  --namespace crossplane-system --create-namespace\n\nkubectl get pods -n crossplane-system\n```',
        verify: '```bash\nkubectl get deploy -n crossplane-system\n# Expected output: crossplane and crossplane-rbac-manager READY 1/1\nkubectl get crds | grep crossplane.io | head\n# Expected output: providers.pkg.crossplane.io, configurations.pkg.crossplane.io, etc.\n```'
      },
      {
        title: 'Install provider-kubernetes',
        instruction: 'Create a `Provider` resource pointing at provider-kubernetes (manages objects of the cluster itself, no cloud credentials) and wait for it to become Healthy.',
        hints: ['kind: Provider, apiVersion pkg.crossplane.io/v1', 'package: xpkg.upbound.io/crossplane-contrib/provider-kubernetes:v0.13.0', 'kubectl get provider shows INSTALLED and HEALTHY'],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: pkg.crossplane.io/v1\nkind: Provider\nmetadata:\n  name: provider-kubernetes\nspec:\n  package: xpkg.upbound.io/crossplane-contrib/provider-kubernetes:v0.13.0\nEOF\n\nkubectl get provider provider-kubernetes -w\n```',
        verify: '```bash\nkubectl get provider provider-kubernetes\n# Expected output: INSTALLED=True  HEALTHY=True\nkubectl get crds | grep kubernetes.crossplane.io\n# Expected output: objects.kubernetes.crossplane.io (the Managed Resource CRD)\n```'
      },
      {
        title: 'Configure the ProviderConfig (provider identity)',
        instruction: 'Create a `ProviderConfig` telling provider-kubernetes to use the pod ServiceAccount itself (credentials source: InjectedIdentity), avoiding any secret.',
        hints: ['apiVersion kubernetes.crossplane.io/v1alpha1, kind ProviderConfig', 'spec.credentials.source: InjectedIdentity', 'The provider needs RBAC; in a lab you can grant cluster-admin to the provider SA'],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: kubernetes.crossplane.io/v1alpha1\nkind: ProviderConfig\nmetadata:\n  name: default\nspec:\n  credentials:\n    source: InjectedIdentity\nEOF\n\n# RBAC for the provider SA (lab only)\nSA=$(kubectl get sa -n crossplane-system -o name | grep provider-kubernetes | head -1)\nkubectl create clusterrolebinding provider-kubernetes-admin \\\n  --clusterrole=cluster-admin \\\n  --serviceaccount=crossplane-system:$(basename $SA)\n```',
        verify: '```bash\nkubectl get providerconfig.kubernetes.crossplane.io default\n# Expected output: the "default" ProviderConfig exists (AGE populated)\n```'
      },
      {
        title: 'Provision a declarative Managed Resource',
        instruction: 'Create an `Object` (provider-kubernetes Managed Resource) that makes Crossplane provision and reconcile a ConfigMap in the cluster. Edit/Delete the ConfigMap by hand and watch Crossplane reconcile it back (drift correction).',
        hints: ['kind: Object, apiVersion kubernetes.crossplane.io/v1alpha2', 'spec.forProvider.manifest holds the desired ConfigMap', 'Delete the ConfigMap and watch Crossplane recreate it'],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: kubernetes.crossplane.io/v1alpha2\nkind: Object\nmetadata:\n  name: platform-config\nspec:\n  forProvider:\n    manifest:\n      apiVersion: v1\n      kind: ConfigMap\n      metadata:\n        name: platform-config\n        namespace: default\n      data:\n        owner: platform-team\n        managedBy: crossplane\n  providerConfigRef:\n    name: default\nEOF\n\n# Drift test: delete the ConfigMap and watch Crossplane recreate it\nkubectl delete configmap platform-config -n default\nsleep 5\nkubectl get configmap platform-config -n default\n```',
        verify: '```bash\nkubectl get object.kubernetes.crossplane.io platform-config\n# Expected output: SYNCED=True  READY=True\nkubectl get configmap platform-config -n default -o jsonpath=\'{.data.managedBy}{\"\\n\"}\'\n# Expected output: crossplane (recreated by Crossplane even after delete = drift correction)\n```'
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Managed Resource stays in Synced=False with credentials error',
      difficulty: 'medium',
      symptom: 'When creating an MR (e.g., Bucket), the status shows Synced=False with an authentication or permission error message.',
      diagnosis: `\`\`\`bash
# 1. Check MR conditions
kubectl describe bucket my-bucket | grep -A10 "Conditions:"

# 2. Check if ProviderConfig exists
kubectl get providerconfig aws-production

# 3. Check credentials Secret
kubectl get secret aws-credentials -n crossplane-system
kubectl get secret aws-credentials -n crossplane-system -o jsonpath='{.data.credentials}' | base64 -d

# 4. Check Provider logs
kubectl logs -n crossplane-system -l pkg.crossplane.io/revision=provider-aws-s3 --tail=20

# 5. Check events
kubectl get events -n crossplane-system | grep -i error | tail -10
\`\`\``,
      solution: `**Causes and solutions:**

1. **ProviderConfig not found:** Verify the name in spec.providerConfigRef.name matches exactly the existing ProviderConfig name.

2. **Secret with incorrect format:** The AWS Secret must contain the credentials file in INI format: [default]\\naws_access_key_id=...\\naws_secret_access_key=... Check base64 encoding.

3. **Insufficient IAM permissions:** AWS credentials need permissions for the service used (e.g., s3:CreateBucket, s3:PutBucketTagging). Check IAM policy.

4. **Incorrect region:** Verify the region in spec.forProvider.region is correct and the resource can be created there.

5. **Provider not installed/healthy:** Check kubectl get providers. If HEALTHY=False, check provider image and cluster network connectivity with cloud endpoints.`
    },
    {
      title: 'Provider stays in NotInstalled or Unhealthy state',
      difficulty: 'hard',
      symptom: 'After installing a Provider via kubectl apply, it remains INSTALLED=False or HEALTHY=False.',
      diagnosis: `\`\`\`bash
# 1. Check Provider status
kubectl get provider provider-aws-s3 -o yaml | grep -A20 "status:"

# 2. Check if Provider pod was created
kubectl get pods -n crossplane-system | grep provider

# 3. Check Provider events
kubectl describe provider provider-aws-s3 | grep -A20 "Events:"

# 4. Check for image pull errors
kubectl describe pod -n crossplane-system -l pkg.crossplane.io/revision | grep -A10 "Events:"

# 5. Check Crossplane version and compatibility
kubectl get deployment -n crossplane-system crossplane -o jsonpath='{.spec.template.spec.containers[0].image}'
\`\`\``,
      solution: `**Causes and solutions:**

1. **Package image not accessible:** Verify the cluster has access to xpkg.upbound.io (or custom registry). Check ImagePullSecrets if using a private registry.

2. **Incompatible version:** Check compatibility between Crossplane version and Provider version. See the provider documentation for supported versions.

3. **Crossplane CRDs not ready:** If Crossplane was recently installed, wait for CRDs to be ready before installing providers (kubectl wait --for=condition=Established crd/providers.pkg.crossplane.io).

4. **No Kubernetes API access:** The Provider pod needs RBAC to create/manage MR CRDs. The crossplane-rbac-manager creates these permissions automatically.

5. **OOMKilled:** If the provider has many CRDs, it may consume a lot of memory. Increase memory limits in DeploymentRuntimeConfig.`
    }
  ]
};
