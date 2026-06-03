window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['iac/terraform-k8s'] = {
  theory: `
# Terraform & Kubernetes

## Relevance
Terraform is widely used to provision Kubernetes clusters on cloud providers (EKS, GKE, AKS) and to manage resources inside the cluster via Kubernetes and Helm providers. Understanding this integration is essential for DevOps/SRE managing Kubernetes infrastructure as code.

## Fundamental Concepts

### Terraform + Kubernetes: Two Levels

\`\`\`
┌─────────────────────────────────────────┐
│  Level 1: Provision the Cluster         │
│  (Terraform → Cloud Provider API)       │
│                                         │
│  aws_eks_cluster, google_container_*    │
│  azurerm_kubernetes_cluster             │
├─────────────────────────────────────────┤
│  Level 2: Manage Resources in Cluster   │
│  (Terraform → Kubernetes API)           │
│                                         │
│  kubernetes_namespace, helm_release     │
│  kubernetes_deployment, kubernetes_*    │
└─────────────────────────────────────────┘
\`\`\`

### Provisioning EKS with Terraform

\`\`\`hcl
# Official EKS module
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "\${var.project}-\${var.environment}"
  cluster_version = "1.30"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  eks_managed_node_groups = {
    general = {
      instance_types = ["t3.medium"]
      min_size       = 2
      max_size       = 5
      desired_size   = 3

      labels = {
        role = "general"
      }
    }

    spot = {
      instance_types = ["t3.medium", "t3.large"]
      capacity_type  = "SPOT"
      min_size       = 0
      max_size       = 10
      desired_size   = 2

      labels = {
        role = "spot-workers"
      }

      taints = [{
        key    = "spot"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
    }
  }

  cluster_addons = {
    coredns    = { most_recent = true }
    kube-proxy = { most_recent = true }
    vpc-cni    = { most_recent = true }
  }

  tags = var.tags
}
\`\`\`

### Kubernetes Provider

\`\`\`hcl
# Configure Kubernetes provider using EKS data
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

# Create namespaces
resource "kubernetes_namespace" "apps" {
  for_each = toset(["production", "staging", "monitoring"])

  metadata {
    name = each.key
    labels = {
      environment = each.key
      managed-by  = "terraform"
    }
  }
}

# ResourceQuota
resource "kubernetes_resource_quota" "apps" {
  for_each = kubernetes_namespace.apps

  metadata {
    name      = "default-quota"
    namespace = each.value.metadata[0].name
  }

  spec {
    hard = {
      "requests.cpu"    = "4"
      "requests.memory" = "8Gi"
      "limits.cpu"      = "8"
      "limits.memory"   = "16Gi"
      pods              = "50"
    }
  }
}
\`\`\`

### Helm Provider

\`\`\`hcl
# Configure Helm provider
provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}

# Install ingress-nginx via Helm
resource "helm_release" "ingress_nginx" {
  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  version    = "4.10.0"
  namespace  = "ingress-nginx"

  create_namespace = true

  set {
    name  = "controller.replicaCount"
    value = "2"
  }

  set {
    name  = "controller.service.type"
    value = "LoadBalancer"
  }
}

# ArgoCD with values file
resource "helm_release" "argocd" {
  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = "6.0.0"
  namespace  = "argocd"

  create_namespace = true

  values = [
    templatefile("\${path.module}/values/argocd.yaml", {
      domain   = var.argocd_domain
      replicas = var.environment == "prod" ? 3 : 1
    })
  ]
}
\`\`\`

### IRSA — IAM Roles for Service Accounts

\`\`\`hcl
# IRSA for an application that needs S3 access
module "app_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "\${var.project}-app-s3-access"

  role_policy_arns = {
    s3 = aws_iam_policy.app_s3.arn
  }

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["production:app-service-account"]
    }
  }
}

# ServiceAccount in Kubernetes with IRSA annotation
resource "kubernetes_service_account" "app" {
  metadata {
    name      = "app-service-account"
    namespace = "production"
    annotations = {
      "eks.amazonaws.com/role-arn" = module.app_irsa.iam_role_arn
    }
  }
}
\`\`\`

### Separation of Concerns

\`\`\`
Recommendation: separate Terraform configs into layers

Layer 1: Networking (VPC, subnets, NAT)
  state: networking.tfstate

Layer 2: Cluster (EKS/GKE/AKS)
  state: cluster.tfstate
  data source: remote_state from networking

Layer 3: Cluster Addons (ingress, cert-manager, monitoring)
  state: addons.tfstate
  data source: remote_state from cluster

Layer 4: Applications (namespaces, configs, IRSA)
  state: apps.tfstate
  data source: remote_state from cluster
\`\`\`

\`\`\`hcl
# Access state from another layer
data "terraform_remote_state" "cluster" {
  backend = "s3"
  config = {
    bucket = "terraform-state"
    key    = "cluster/terraform.tfstate"
    region = "us-east-1"
  }
}

# Use outputs from another layer
provider "kubernetes" {
  host = data.terraform_remote_state.cluster.outputs.cluster_endpoint
}
\`\`\`

### Common Mistakes

1. **Provisioning cluster and K8s resources in same state** — separate into layers
2. **Not using IRSA** — pods with node IAM role have too much access
3. **Hardcoded cluster version** — use variables for easier upgrades
4. **Helm release without fixed version** — always pin chart version
5. **Not waiting for cluster readiness** — use depends_on between cluster and providers
6. **Giant state** — separate into smaller focused layers

## Killer.sh Style Challenge

> **Scenario:** Provision an EKS cluster with: (1) 2 managed node groups (general + spot), (2) IRSA for external-dns to access Route53, (3) ingress-nginx and cert-manager via Helm, (4) production and staging namespaces with ResourceQuotas.
`,
  quiz: [
    {
      question: 'How to configure the Terraform Kubernetes provider to access an EKS cluster?',
      options: [
        'Hardcoded token in provider',
        'Using exec with aws eks get-token and cluster_ca_certificate from the EKS module',
        'Manually copying the kubeconfig',
        'Using kubectl proxy'
      ],
      correct: 1,
      explanation: 'The recommended method is using exec with aws eks get-token, which generates temporary tokens via AWS IAM. The cluster_ca_certificate comes from the EKS module output.',
      reference: 'Related concept: The same pattern applies to the Helm provider — both need cluster authentication.'
    },
    {
      question: 'What is IRSA in the EKS/Terraform context?',
      options: [
        'A type of EC2 instance',
        'IAM Roles for Service Accounts — binding IAM roles to K8s ServiceAccounts via OIDC',
        'A kubectl plugin',
        'A type of node group'
      ],
      correct: 1,
      explanation: 'IRSA (IAM Roles for Service Accounts) allows pods to assume specific IAM roles via ServiceAccount, instead of inheriting the node role. Uses the EKS OIDC provider for authentication.',
      reference: 'Related concept: The annotation eks.amazonaws.com/role-arn on the ServiceAccount binds the role.'
    },
    {
      question: 'What is the best practice for managing cluster and addons with Terraform?',
      options: [
        'Everything in the same terraform apply',
        'Separate into layers: networking → cluster → addons → apps, each with its own state',
        'Use only Helm for everything',
        'Don\'t use Terraform for Kubernetes'
      ],
      correct: 1,
      explanation: 'Separating into layers reduces blast radius, improves plan/apply performance, and allows different teams to manage distinct layers. Each layer accesses previous outputs via remote_state.',
      reference: 'Related concept: Use data "terraform_remote_state" to access outputs between layers.'
    },
    {
      question: 'Which Terraform resource is used to install Helm charts in a cluster?',
      options: [
        'kubernetes_deployment',
        'helm_release',
        'kubernetes_manifest',
        'helm_chart'
      ],
      correct: 1,
      explanation: 'helm_release is the Helm provider resource that installs, updates, and manages Helm charts in the cluster. Supports set values, values files, and chart versioning.',
      reference: 'Related concept: Always pin the chart version to avoid unexpected upgrades.'
    },
    {
      question: 'Why should cluster and K8s resources NOT be in the same state?',
      options: [
        'It\'s technically impossible',
        'Increases blast radius, plan/apply time, and creates circular dependency between providers',
        'Terraform doesn\'t support multiple providers',
        'It\'s more secure together'
      ],
      correct: 1,
      explanation: 'Same state for cluster and K8s resources: (1) destroying cluster breaks K8s provider, (2) plan becomes slow, (3) namespace changes can affect cluster. Separating reduces risk and improves operations.',
      reference: 'Related concept: Layers: networking → cluster → addons → apps.'
    },
    {
      question: 'How to pass dynamic values to a Helm chart in Terraform?',
      options: [
        'Edit the chart manually',
        'Use set blocks or values with templatefile() in helm_release',
        'Create a ConfigMap first',
        'Use kubectl apply'
      ],
      correct: 1,
      explanation: 'helm_release supports: set { name = "key"; value = "val" } for simple values, and values = [templatefile("values.yaml", vars)] for values files with Terraform interpolation.',
      reference: 'Related concept: templatefile() allows using Terraform variables inside values.yaml.'
    },
    {
      question: 'Which Terraform module is most used for provisioning EKS on AWS?',
      options: [
        'terraform-aws-modules/ec2-instance/aws',
        'terraform-aws-modules/eks/aws',
        'hashicorp/aws-eks',
        'aws/eks-terraform-module'
      ],
      correct: 1,
      explanation: 'terraform-aws-modules/eks/aws is the most used and maintained community module for EKS. Manages cluster, node groups, addons, OIDC provider, and integrations like IRSA.',
      reference: 'Related concept: Always specify module version to avoid breaking changes.'
    }
  ],
  flashcards: [
    {
      front: 'What are the two levels of using Terraform with Kubernetes?',
      back: '**Level 1 — Provision the Cluster:**\n- Terraform → Cloud Provider API\n- Resources: aws_eks_cluster, google_container_cluster\n- Creates cluster, node groups, networking\n\n**Level 2 — Manage Resources in Cluster:**\n- Terraform → Kubernetes API\n- Providers: kubernetes, helm\n- Resources: namespaces, ConfigMaps, Helm releases\n\n**Recommendation:** Separate into different states/layers to reduce blast radius.'
    },
    {
      front: 'How does IRSA (IAM Roles for Service Accounts) work?',
      back: '**IRSA** binds IAM Roles to K8s ServiceAccounts:\n\n1. EKS creates OIDC provider\n2. Terraform creates IAM Role with trust policy for OIDC\n3. ServiceAccount gets annotation:\n   eks.amazonaws.com/role-arn: arn:aws:iam::role/name\n4. Pod with that SA assumes the IAM Role\n\n**Advantage:**\n- Least privilege per pod\n- Doesn\'t inherit node role\n- Auditable via CloudTrail\n\n**Module:** terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks'
    },
    {
      front: 'How does the Helm provider work in Terraform?',
      back: '**Configuration:**\n- Same auth as kubernetes provider\n- host, cluster_ca_certificate, exec\n\n**Main resource:** helm_release\n\n**Value options:**\n- set { name = "key"; value = "val" }\n- values = [file("values.yaml")]\n- values = [templatefile("values.yaml", vars)]\n\n**Best practices:**\n- Always pin chart version\n- create_namespace = true\n- Use templatefile for dynamic values'
    },
    {
      front: 'How to separate Terraform into layers for Kubernetes?',
      back: '**Layer 1: Networking**\n- VPC, subnets, NAT, security groups\n- State: networking.tfstate\n\n**Layer 2: Cluster**\n- EKS/GKE/AKS, node groups\n- State: cluster.tfstate\n\n**Layer 3: Addons**\n- ingress-nginx, cert-manager, ArgoCD\n- State: addons.tfstate\n\n**Layer 4: Applications**\n- Namespaces, IRSA, configs\n- State: apps.tfstate\n\n**Connection between layers:**\ndata "terraform_remote_state" to access outputs'
    },
    {
      front: 'Which typical addons are installed via Terraform on EKS?',
      back: '**EKS Managed Addons (cluster_addons):**\n- coredns — cluster DNS\n- kube-proxy — networking\n- vpc-cni — AWS network plugin\n\n**Via Helm (helm_release):**\n- ingress-nginx — ingress controller\n- cert-manager — automatic TLS\n- ArgoCD — GitOps\n- Prometheus/Grafana — observability\n- external-dns — automatic DNS\n- cluster-autoscaler — autoscaling\n\n**Via Kubernetes provider:**\n- Namespaces, ResourceQuotas\n- ConfigMaps, Secrets\n- ServiceAccounts (IRSA)'
    },
    {
      front: 'How to provision EKS with terraform-aws-modules/eks module?',
      back: '**Main parameters:**\n- cluster_name, cluster_version\n- vpc_id, subnet_ids\n- cluster_endpoint_public/private_access\n\n**Node Groups:**\n- eks_managed_node_groups\n- instance_types, min/max/desired_size\n- labels, taints, capacity_type\n\n**Addons:**\n- cluster_addons: coredns, kube-proxy, vpc-cni\n\n**Useful outputs:**\n- cluster_endpoint\n- cluster_certificate_authority_data\n- cluster_name, oidc_provider_arn'
    },
    {
      front: 'What is the difference between EKS, GKE, and AKS in Terraform?',
      back: '**EKS (AWS):**\n- Module: terraform-aws-modules/eks/aws\n- Auth: IRSA (OIDC)\n- Nodes: managed node groups or Fargate\n\n**GKE (Google):**\n- Resource: google_container_cluster\n- Auth: Workload Identity\n- Nodes: google_container_node_pool\n\n**AKS (Azure):**\n- Resource: azurerm_kubernetes_cluster\n- Auth: Azure AD + managed identity\n- Nodes: default_node_pool + node_pool resource'
    }
  ],
  lab: {
    scenario: 'You need to provision an EKS cluster with Terraform, install addons via Helm, and configure IRSA for an application.',
    objective: 'Learn to create EKS with Terraform, configure Kubernetes and Helm providers, and implement IRSA.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Configure EKS module and providers',
        instruction: `Create the Terraform configuration for:
1. EKS module (terraform-aws-modules/eks/aws ~> 20.0) with cluster version 1.30
2. A managed node group "general" (t3.medium, 2-5 nodes)
3. Kubernetes and Helm providers configured with exec for authentication`,
        hints: [
          'Use module.eks outputs to configure providers',
          'exec uses command "aws" with args ["eks", "get-token", "--cluster-name", ...]',
          'kubernetes and helm providers need host and cluster_ca_certificate'
        ],
        solution: `\`\`\`hcl
# eks.tf
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "\${var.project}-\${var.environment}"
  cluster_version = "1.30"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  eks_managed_node_groups = {
    general = {
      instance_types = ["t3.medium"]
      min_size       = 2
      max_size       = 5
      desired_size   = 3
      labels         = { role = "general" }
    }
  }

  cluster_addons = {
    coredns    = { most_recent = true }
    kube-proxy = { most_recent = true }
    vpc-cni    = { most_recent = true }
  }

  tags = var.tags
}

# providers.tf
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}
\`\`\``,
        verify: `\`\`\`bash
# Validate configuration
terraform validate
# Expected output: Success! The configuration is valid.

# Check configured providers
terraform providers
# Expected output: hashicorp/aws, hashicorp/kubernetes, hashicorp/helm

# Plan (without applying)
terraform plan
# Expected output: Plan with EKS cluster and node group
\`\`\``
      },
      {
        title: 'Install addons via Helm',
        instruction: `Add helm_release resources for:
1. **ingress-nginx** (chart 4.10.0) with 2 replicas and LoadBalancer NLB service
2. **cert-manager** (chart 1.14.0) with installCRDs=true
Both should create namespace automatically.`,
        hints: [
          'Use create_namespace = true on helm_release',
          'For annotations with dots in the name, escape with \\\\.',
          'Chart version should be fixed, not latest'
        ],
        solution: `\`\`\`hcl
# addons.tf
resource "helm_release" "ingress_nginx" {
  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  version    = "4.10.0"
  namespace  = "ingress-nginx"

  create_namespace = true

  set {
    name  = "controller.replicaCount"
    value = "2"
  }

  set {
    name  = "controller.service.type"
    value = "LoadBalancer"
  }

  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-type"
    value = "nlb"
  }

  depends_on = [module.eks]
}

resource "helm_release" "cert_manager" {
  name       = "cert-manager"
  repository = "https://charts.jetstack.io"
  chart      = "cert-manager"
  version    = "1.14.0"
  namespace  = "cert-manager"

  create_namespace = true

  set {
    name  = "installCRDs"
    value = "true"
  }

  depends_on = [module.eks]
}
\`\`\``,
        verify: `\`\`\`bash
# After apply, verify Helm releases
helm list -A
# Expected output:
# ingress-nginx    ingress-nginx    deployed
# cert-manager     cert-manager     deployed

# Verify pods
kubectl get pods -n ingress-nginx
kubectl get pods -n cert-manager
# Expected output: pods Running
\`\`\``
      },
      {
        title: 'Configure IRSA for application',
        instruction: `Create IRSA for an application that needs S3 access:
1. iam-role-for-service-accounts-eks module with policy for s3:GetObject and s3:PutObject
2. kubernetes_service_account with IRSA annotation in production namespace
3. IAM policy with access to bucket "app-data-bucket"`,
        hints: [
          'The IRSA module needs oidc_provider_arn from EKS',
          'namespace_service_accounts uses format "namespace:sa-name"',
          'ServiceAccount receives annotation eks.amazonaws.com/role-arn'
        ],
        solution: `\`\`\`hcl
# irsa.tf
resource "aws_iam_policy" "app_s3" {
  name = "\${var.project}-app-s3-access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
      Resource = [
        "arn:aws:s3:::app-data-bucket",
        "arn:aws:s3:::app-data-bucket/*"
      ]
    }]
  })
}

module "app_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "\${var.project}-app-s3"

  role_policy_arns = {
    s3 = aws_iam_policy.app_s3.arn
  }

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["production:app-sa"]
    }
  }
}

resource "kubernetes_service_account" "app" {
  metadata {
    name      = "app-sa"
    namespace = "production"
    annotations = {
      "eks.amazonaws.com/role-arn" = module.app_irsa.iam_role_arn
    }
  }
}
\`\`\``,
        verify: `\`\`\`bash
# Verify ServiceAccount
kubectl get sa app-sa -n production -o yaml
# Expected output: annotation eks.amazonaws.com/role-arn present

# Verify IAM Role
aws iam get-role --role-name project-app-s3
# Expected output: Role with trust policy for OIDC

# Test IRSA (create test pod)
kubectl run test-irsa --image=amazon/aws-cli -n production \\
  --overrides='{"spec":{"serviceAccountName":"app-sa"}}' \\
  --command -- aws sts get-caller-identity
# Expected output: Arn with IRSA role
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Kubernetes provider fails after provisioning EKS',
      difficulty: 'medium',
      symptom: 'Terraform fails to create Kubernetes resources right after creating the EKS cluster. Error: "the server has asked for the client to provide credentials" or connection timeout.',
      diagnosis: `\`\`\`bash
# 1. Check if cluster is ready
aws eks describe-cluster --name cluster-name --query "cluster.status"
# Should return "ACTIVE"

# 2. Check if endpoint is accessible
curl -k https://CLUSTER_ENDPOINT/healthz

# 3. Check if aws eks get-token works
aws eks get-token --cluster-name cluster-name

# 4. Check if provider depends on EKS module
# Providers don't accept direct depends_on
\`\`\``,
      solution: `**Causes and solutions:**

1. **Cluster not ready:** EKS takes 10-15 minutes to become active. Terraform may try to access before that. Solution: add depends_on to kubernetes/helm resources for the EKS module.

2. **Endpoint not accessible:** If cluster_endpoint_public_access = false, the machine running Terraform needs to be in the VPC. Check security groups.

3. **Token expired between plan and apply:** EKS tokens expire in 15 min. If plan takes too long, apply may fail. Run apply directly.

4. **Provider doesn't support depends_on:** Use null_resource with depends_on on EKS or separate into layers (cluster in one state, addons in another).`
    },
    {
      title: 'Helm release stuck in "pending-install" status',
      difficulty: 'medium',
      symptom: 'helm_release gets stuck during terraform apply. The release status shows "pending-install" and apply never completes.',
      diagnosis: `\`\`\`bash
# 1. Check release status
helm list -A --all
# Look for releases with pending-* status

# 2. Check pod logs
kubectl get pods -n NAMESPACE
kubectl describe pod POD_NAME -n NAMESPACE

# 3. Check if CRDs were installed (cert-manager)
kubectl get crd | grep cert-manager

# 4. Check Terraform state
terraform state show helm_release.name
\`\`\``,
      solution: `**Causes and solutions:**

1. **Pod doesn't start:** The chart needs resources that don't exist (CRDs, PVC, secrets). Check pod events.

2. **Terraform timeout:** Increase timeout in helm_release: timeout = 600 (seconds).

3. **Corrupted release:** Clean up with helm uninstall NAME -n NAMESPACE and run terraform apply again.

4. **Dependency between releases:** If cert-manager needs CRDs before other charts, use depends_on between helm_releases.

5. **Remove from state and reinstall:** terraform state rm helm_release.name followed by terraform apply.`
    },
    {
      title: 'IRSA not working — pod receives node credentials',
      difficulty: 'hard',
      symptom: 'Even with ServiceAccount configured with IRSA annotation, the pod uses node credentials (Instance Profile) instead of the IRSA role.',
      diagnosis: `\`\`\`bash
# 1. Check annotation on ServiceAccount
kubectl get sa app-sa -n production -o jsonpath='{.metadata.annotations}'
# Should contain eks.amazonaws.com/role-arn

# 2. Check if pod uses correct ServiceAccount
kubectl get pod POD -n production -o jsonpath='{.spec.serviceAccountName}'
# Should return the SA with IRSA

# 3. Check if IRSA env vars are injected
kubectl exec POD -n production -- env | grep AWS
# Should contain AWS_ROLE_ARN and AWS_WEB_IDENTITY_TOKEN_FILE

# 4. Check trust policy of IAM Role
aws iam get-role --role-name ROLE_NAME --query "Role.AssumeRolePolicyDocument"
# Should contain the EKS OIDC provider
\`\`\``,
      solution: `**Causes and solutions:**

1. **Pod doesn't use the ServiceAccount:** Check spec.serviceAccountName in Deployment/Pod. If not specified, uses "default" which doesn't have IRSA.

2. **Incorrect annotation:** Verify eks.amazonaws.com/role-arn has the correct role ARN (case sensitive, no spaces).

3. **Incorrect trust policy:** The IAM Role needs trust policy for the EKS OIDC provider with condition on ServiceAccount (namespace:sa-name).

4. **VPC CNI addon not updated:** IRSA depends on the EKS mutating webhook. If vpc-cni or pod-identity-webhook are not working, env vars are not injected.

5. **Old SDK/CLI:** Old AWS SDK versions don't support web identity token. Update the SDK used by the application.`
    }
  ]
};
