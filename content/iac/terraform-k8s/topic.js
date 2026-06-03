window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['iac/terraform-k8s'] = {
  theory: `
# Terraform & Kubernetes

## Relevancia
Terraform e amplamente usado para provisionar clusters Kubernetes em cloud providers (EKS, GKE, AKS) e para gerenciar recursos dentro do cluster via providers Kubernetes e Helm. Entender essa integracao e essencial para DevOps/SRE que gerenciam infraestrutura Kubernetes como codigo.

## Conceitos Fundamentais

### Terraform + Kubernetes: Dois Niveis

\`\`\`
┌─────────────────────────────────────────┐
│  Nivel 1: Provisionar o Cluster         │
│  (Terraform → Cloud Provider API)       │
│                                         │
│  aws_eks_cluster, google_container_*    │
│  azurerm_kubernetes_cluster             │
├─────────────────────────────────────────┤
│  Nivel 2: Gerenciar Recursos no Cluster │
│  (Terraform → Kubernetes API)           │
│                                         │
│  kubernetes_namespace, helm_release     │
│  kubernetes_deployment, kubernetes_*    │
└─────────────────────────────────────────┘
\`\`\`

### Provisionando EKS com Terraform

\`\`\`hcl
# Modulo oficial para EKS
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "\${var.project}-\${var.environment}"
  cluster_version = "1.30"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # Acesso ao cluster
  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # Managed Node Groups
  eks_managed_node_groups = {
    general = {
      instance_types = ["t3.medium"]
      min_size       = 2
      max_size       = 5
      desired_size   = 3

      labels = {
        role = "general"
      }

      tags = {
        "k8s.io/cluster-autoscaler/enabled" = "true"
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

  # Addons do EKS
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent              = true
      service_account_role_arn = module.vpc_cni_irsa.iam_role_arn
    }
  }

  tags = var.tags
}

# IRSA para VPC CNI
module "vpc_cni_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name             = "\${var.project}-vpc-cni"
  attach_vpc_cni_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-node"]
    }
  }
}
\`\`\`

### Provider Kubernetes

\`\`\`hcl
# Configurar provider Kubernetes usando dados do EKS
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

# Criar namespace
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

# Criar ResourceQuota
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

# ConfigMap
resource "kubernetes_config_map" "app_config" {
  metadata {
    name      = "app-config"
    namespace = kubernetes_namespace.apps["production"].metadata[0].name
  }

  data = {
    DATABASE_HOST = module.rds.db_instance_address
    REDIS_HOST    = module.elasticache.endpoint
    LOG_LEVEL     = "info"
  }
}
\`\`\`

### Provider Helm

\`\`\`hcl
# Configurar provider Helm
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

# Instalar ingress-nginx via Helm
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

  set {
    name  = "controller.metrics.enabled"
    value = "true"
  }
}

# Instalar cert-manager
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

  set {
    name  = "prometheus.enabled"
    value = "true"
  }
}

# ArgoCD com values file
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
# IRSA para uma aplicacao que precisa acessar S3
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

# Policy para S3
resource "aws_iam_policy" "app_s3" {
  name = "\${var.project}-app-s3"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          module.s3_bucket.s3_bucket_arn,
          "\${module.s3_bucket.s3_bucket_arn}/*"
        ]
      }
    ]
  })
}

# ServiceAccount no Kubernetes com annotation IRSA
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

### Provisionando GKE com Terraform

\`\`\`hcl
# Google Kubernetes Engine
resource "google_container_cluster" "primary" {
  name     = "\${var.project}-\${var.environment}"
  location = var.region

  # Usar separately managed node pool
  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.vpc.id
  subnetwork = google_compute_subnetwork.private.id

  networking_mode = "VPC_NATIVE"
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  workload_identity_config {
    workload_pool = "\${var.project_id}.svc.id.goog"
  }

  release_channel {
    channel = "REGULAR"
  }
}

resource "google_container_node_pool" "general" {
  name     = "general"
  cluster  = google_container_cluster.primary.id
  location = var.region

  autoscaling {
    min_node_count = 2
    max_node_count = 5
  }

  node_config {
    machine_type = "e2-medium"
    disk_size_gb = 50

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      role = "general"
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }
}
\`\`\`

### Separacao de Concerns

\`\`\`
Recomendacao: separar Terraform configs em layers

Layer 1: Networking (VPC, subnets, NAT)
  └── terraform state: networking.tfstate

Layer 2: Cluster (EKS/GKE/AKS)
  └── terraform state: cluster.tfstate
  └── data source: remote_state de networking

Layer 3: Cluster Addons (ingress, cert-manager, monitoring)
  └── terraform state: addons.tfstate
  └── data source: remote_state de cluster

Layer 4: Applications (namespaces, configs, IRSA)
  └── terraform state: apps.tfstate
  └── data source: remote_state de cluster
\`\`\`

\`\`\`hcl
# Acessar state de outra layer
data "terraform_remote_state" "cluster" {
  backend = "s3"
  config = {
    bucket = "terraform-state"
    key    = "cluster/terraform.tfstate"
    region = "us-east-1"
  }
}

# Usar outputs da outra layer
provider "kubernetes" {
  host = data.terraform_remote_state.cluster.outputs.cluster_endpoint
  # ...
}
\`\`\`

### Erros Comuns

1. **Provisionar cluster e recursos K8s no mesmo state** — separar em layers
2. **Nao usar IRSA** — pods com node IAM role tem acesso demais
3. **Hardcoded cluster version** — usar variaveis para facilitar upgrades
4. **Helm release sem versao fixa** — sempre fixar chart version
5. **Nao esperar cluster ficar ready** — usar depends_on entre cluster e providers
6. **State gigante** — separar em layers menores e focadas

## Killer.sh Style Challenge

> **Cenario:** Provisione um cluster EKS com: (1) 2 managed node groups (general + spot), (2) IRSA para external-dns acessar Route53, (3) ingress-nginx e cert-manager via Helm, (4) namespaces production e staging com ResourceQuotas.
`,
  quiz: [
    {
      question: 'Como configurar o provider Kubernetes do Terraform para acessar um cluster EKS?',
      options: [
        'Hardcoded token no provider',
        'Usando exec com aws eks get-token e cluster_ca_certificate do modulo EKS',
        'Copiando o kubeconfig manualmente',
        'Usando kubectl proxy'
      ],
      correct: 1,
      explanation: 'O metodo recomendado e usar exec com aws eks get-token, que gera tokens temporarios via AWS IAM. O cluster_ca_certificate vem do output do modulo EKS.',
      reference: 'Conceito relacionado: O mesmo padrao se aplica ao provider Helm — ambos precisam de autenticacao no cluster.'
    },
    {
      question: 'O que e IRSA no contexto EKS/Terraform?',
      options: [
        'Um tipo de instancia EC2',
        'IAM Roles for Service Accounts — vincular IAM roles a ServiceAccounts K8s via OIDC',
        'Um plugin do kubectl',
        'Um tipo de node group'
      ],
      correct: 1,
      explanation: 'IRSA (IAM Roles for Service Accounts) permite que pods assumam roles IAM especificas via ServiceAccount, em vez de herdar a role do node. Usa OIDC provider do EKS para autenticacao.',
      reference: 'Conceito relacionado: Annotation eks.amazonaws.com/role-arn no ServiceAccount vincula a role.'
    },
    {
      question: 'Qual a melhor pratica para gerenciar cluster e addons com Terraform?',
      options: [
        'Tudo no mesmo terraform apply',
        'Separar em layers: networking → cluster → addons → apps, cada um com seu state',
        'Usar apenas Helm para tudo',
        'Nao usar Terraform para Kubernetes'
      ],
      correct: 1,
      explanation: 'Separar em layers reduz blast radius, melhora performance do plan/apply e permite que equipes diferentes gerenciem camadas distintas. Cada layer acessa outputs das anteriores via remote_state.',
      reference: 'Conceito relacionado: Use data "terraform_remote_state" para acessar outputs entre layers.'
    },
    {
      question: 'Qual recurso Terraform e usado para instalar charts Helm no cluster?',
      options: [
        'kubernetes_deployment',
        'helm_release',
        'kubernetes_manifest',
        'helm_chart'
      ],
      correct: 1,
      explanation: 'helm_release e o recurso do provider Helm que instala, atualiza e gerencia charts Helm no cluster. Suporta set values, values files e versionamento do chart.',
      reference: 'Conceito relacionado: Sempre fixe a version do chart para evitar upgrades inesperados.'
    },
    {
      question: 'Por que NAO se deve provisionar cluster e recursos K8s no mesmo state?',
      options: [
        'E impossivel tecnicamente',
        'Aumenta blast radius, tempo de plan/apply e cria dependencia circular entre providers',
        'O Terraform nao suporta multiplos providers',
        'E mais seguro tudo junto'
      ],
      correct: 1,
      explanation: 'Mesmo state para cluster e recursos K8s: (1) destroy do cluster quebra provider K8s, (2) plan fica lento, (3) mudanca em namespace pode afetar cluster. Separar reduz risco e melhora operacao.',
      reference: 'Conceito relacionado: Layers: networking → cluster → addons → apps.'
    },
    {
      question: 'Como passar valores dinamicos para um Helm chart no Terraform?',
      options: [
        'Editar o chart manualmente',
        'Usar set blocks ou values com templatefile() no helm_release',
        'Criar um ConfigMap antes',
        'Usar kubectl apply'
      ],
      correct: 1,
      explanation: 'helm_release suporta: set { name = "key"; value = "val" } para valores simples, e values = [templatefile("values.yaml", vars)] para arquivos de valores com interpolacao Terraform.',
      reference: 'Conceito relacionado: templatefile() permite usar variaveis Terraform dentro do values.yaml.'
    },
    {
      question: 'Qual modulo Terraform e mais usado para provisionar EKS na AWS?',
      options: [
        'terraform-aws-modules/ec2-instance/aws',
        'terraform-aws-modules/eks/aws',
        'hashicorp/aws-eks',
        'aws/eks-terraform-module'
      ],
      correct: 1,
      explanation: 'terraform-aws-modules/eks/aws e o modulo comunitario mais usado e mantido para EKS. Gerencia cluster, node groups, addons, OIDC provider e integracoes como IRSA.',
      reference: 'Conceito relacionado: Sempre especifique version do modulo para evitar breaking changes.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os dois niveis de uso do Terraform com Kubernetes?',
      back: '**Nivel 1 — Provisionar o Cluster:**\n- Terraform → Cloud Provider API\n- Recursos: aws_eks_cluster, google_container_cluster\n- Cria o cluster, node groups, networking\n\n**Nivel 2 — Gerenciar Recursos no Cluster:**\n- Terraform → Kubernetes API\n- Providers: kubernetes, helm\n- Recursos: namespaces, ConfigMaps, Helm releases\n\n**Recomendacao:** Separar em states/layers diferentes para reduzir blast radius.'
    },
    {
      front: 'Como funciona IRSA (IAM Roles for Service Accounts)?',
      back: '**IRSA** vincula IAM Roles a K8s ServiceAccounts:\n\n1. EKS cria OIDC provider\n2. Terraform cria IAM Role com trust policy para o OIDC\n3. ServiceAccount recebe annotation:\n   eks.amazonaws.com/role-arn: arn:aws:iam::role/name\n4. Pod com esse SA assume a IAM Role\n\n**Vantagem:**\n- Least privilege por pod\n- Nao herda role do node\n- Auditavel via CloudTrail\n\n**Modulo:** terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks'
    },
    {
      front: 'Como o provider Helm funciona no Terraform?',
      back: '**Configuracao:**\n- Mesma autenticacao do provider kubernetes\n- host, cluster_ca_certificate, exec\n\n**Recurso principal:** helm_release\n\n**Opcoes de valores:**\n- set { name = "key"; value = "val" }\n- values = [file("values.yaml")]\n- values = [templatefile("values.yaml", vars)]\n\n**Boas praticas:**\n- Sempre fixar chart version\n- create_namespace = true\n- Usar templatefile para valores dinamicos'
    },
    {
      front: 'Como separar Terraform em layers para Kubernetes?',
      back: '**Layer 1: Networking**\n- VPC, subnets, NAT, security groups\n- State: networking.tfstate\n\n**Layer 2: Cluster**\n- EKS/GKE/AKS, node groups\n- State: cluster.tfstate\n\n**Layer 3: Addons**\n- ingress-nginx, cert-manager, ArgoCD\n- State: addons.tfstate\n\n**Layer 4: Applications**\n- Namespaces, IRSA, configs\n- State: apps.tfstate\n\n**Conexao entre layers:**\ndata "terraform_remote_state" para acessar outputs'
    },
    {
      front: 'Quais addons tipicos sao instalados via Terraform no EKS?',
      back: '**EKS Managed Addons (cluster_addons):**\n- coredns — DNS do cluster\n- kube-proxy — networking\n- vpc-cni — plugin de rede AWS\n\n**Via Helm (helm_release):**\n- ingress-nginx — ingress controller\n- cert-manager — TLS automatico\n- ArgoCD — GitOps\n- Prometheus/Grafana — observabilidade\n- external-dns — DNS automatico\n- cluster-autoscaler — autoscaling\n- metrics-server — HPA\n\n**Via Kubernetes provider:**\n- Namespaces, ResourceQuotas\n- ConfigMaps, Secrets\n- ServiceAccounts (IRSA)'
    },
    {
      front: 'Como provisionar EKS com modulo terraform-aws-modules/eks?',
      back: '**Parametros principais:**\n- cluster_name, cluster_version\n- vpc_id, subnet_ids\n- cluster_endpoint_public/private_access\n\n**Node Groups:**\n- eks_managed_node_groups\n- instance_types, min/max/desired_size\n- labels, taints, capacity_type (ON_DEMAND/SPOT)\n\n**Addons:**\n- cluster_addons: coredns, kube-proxy, vpc-cni\n\n**Outputs uteis:**\n- cluster_endpoint\n- cluster_certificate_authority_data\n- cluster_name, oidc_provider_arn'
    },
    {
      front: 'Qual a diferenca entre EKS, GKE e AKS no Terraform?',
      back: '**EKS (AWS):**\n- Modulo: terraform-aws-modules/eks/aws\n- Auth: IRSA (OIDC)\n- Node: managed node groups ou Fargate\n- CNI: vpc-cni (AWS nativo)\n\n**GKE (Google):**\n- Resource: google_container_cluster\n- Auth: Workload Identity\n- Node: google_container_node_pool\n- CNI: VPC-native\n\n**AKS (Azure):**\n- Resource: azurerm_kubernetes_cluster\n- Auth: Azure AD + managed identity\n- Node: default_node_pool + azurerm_kubernetes_cluster_node_pool\n- CNI: Azure CNI ou kubenet'
    }
  ],
  lab: {
    scenario: 'Voce precisa provisionar um cluster EKS com Terraform, instalar addons via Helm e configurar IRSA para uma aplicacao.',
    objective: 'Aprender a criar EKS com Terraform, configurar providers Kubernetes e Helm, e implementar IRSA.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Configurar modulo EKS e providers',
        instruction: `Crie a configuracao Terraform para:
1. Modulo EKS (terraform-aws-modules/eks/aws ~> 20.0) com cluster version 1.30
2. Um managed node group "general" (t3.medium, 2-5 nodes)
3. Providers kubernetes e helm configurados com exec para autenticacao`,
        hints: [
          'Use module.eks outputs para configurar os providers',
          'exec usa command "aws" com args ["eks", "get-token", "--cluster-name", ...]',
          'Os providers kubernetes e helm precisam de host e cluster_ca_certificate'
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

      labels = {
        role = "general"
      }
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
# Validar configuracao
terraform validate
# Saida esperada: Success! The configuration is valid.

# Verificar que os providers estao configurados
terraform providers
# Saida esperada: hashicorp/aws, hashicorp/kubernetes, hashicorp/helm

# Planejar (sem aplicar)
terraform plan
# Saida esperada: Plan com EKS cluster e node group
\`\`\``
      },
      {
        title: 'Instalar addons via Helm',
        instruction: `Adicione helm_release resources para:
1. **ingress-nginx** (chart 4.10.0) com 2 replicas e service type LoadBalancer NLB
2. **cert-manager** (chart 1.14.0) com installCRDs=true
Ambos devem criar namespace automaticamente.`,
        hints: [
          'Use create_namespace = true no helm_release',
          'Para annotations com pontos no nome, escape com \\\\.',
          'chart version deve ser fixo, nao latest'
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
# Apos apply, verificar releases Helm
helm list -A
# Saida esperada:
# ingress-nginx    ingress-nginx    deployed
# cert-manager     cert-manager     deployed

# Verificar pods
kubectl get pods -n ingress-nginx
kubectl get pods -n cert-manager
# Saida esperada: pods Running
\`\`\``
      },
      {
        title: 'Configurar IRSA para aplicacao',
        instruction: `Crie IRSA para uma aplicacao que precisa acessar S3:
1. Modulo iam-role-for-service-accounts-eks com policy para s3:GetObject e s3:PutObject
2. kubernetes_service_account com annotation IRSA no namespace production
3. IAM policy com acesso ao bucket "app-data-bucket"`,
        hints: [
          'O modulo IRSA precisa do oidc_provider_arn do EKS',
          'namespace_service_accounts usa formato "namespace:sa-name"',
          'ServiceAccount recebe annotation eks.amazonaws.com/role-arn'
        ],
        solution: `\`\`\`hcl
# irsa.tf
resource "aws_iam_policy" "app_s3" {
  name = "\${var.project}-app-s3-access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::app-data-bucket",
          "arn:aws:s3:::app-data-bucket/*"
        ]
      }
    ]
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

  depends_on = [kubernetes_namespace.apps]
}
\`\`\``,
        verify: `\`\`\`bash
# Verificar ServiceAccount
kubectl get sa app-sa -n production -o yaml
# Saida esperada: annotation eks.amazonaws.com/role-arn presente

# Verificar IAM Role
aws iam get-role --role-name project-app-s3
# Saida esperada: Role com trust policy para OIDC

# Testar IRSA (criar pod de teste)
kubectl run test-irsa --image=amazon/aws-cli -n production \\
  --overrides='{"spec":{"serviceAccountName":"app-sa"}}' \\
  --command -- aws sts get-caller-identity
# Saida esperada: Arn com role do IRSA
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Provider Kubernetes falha apos provisionar EKS',
      difficulty: 'medium',
      symptom: 'Terraform falha ao criar recursos Kubernetes logo apos criar o cluster EKS. Erro: "the server has asked for the client to provide credentials" ou timeout de conexao.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o cluster esta ready
aws eks describe-cluster --name cluster-name --query "cluster.status"
# Deve retornar "ACTIVE"

# 2. Verificar se o endpoint esta acessivel
curl -k https://CLUSTER_ENDPOINT/healthz

# 3. Verificar se aws eks get-token funciona
aws eks get-token --cluster-name cluster-name

# 4. Verificar se o provider depende do modulo EKS
# providers nao aceitam depends_on direto
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Cluster nao esta ready:** O EKS leva 10-15 minutos para ficar ativo. Terraform pode tentar acessar antes. Solucao: adicionar depends_on nos recursos kubernetes/helm para o modulo EKS.

2. **Endpoint nao acessivel:** Se cluster_endpoint_public_access = false, a maquina rodando Terraform precisa estar na VPC. Verificar security groups.

3. **Token expirado entre plan e apply:** Tokens EKS expiram em 15 min. Se o plan demora muito, o apply pode falhar. Rodar apply diretamente.

4. **Provider nao suporta depends_on:** Usar null_resource com depends_on no EKS ou separar em layers (cluster em um state, addons em outro).`
    },
    {
      title: 'Helm release stuck em status "pending-install"',
      difficulty: 'medium',
      symptom: 'helm_release fica preso durante terraform apply. O status do release mostra "pending-install" e o apply nunca completa.',
      diagnosis: `\`\`\`bash
# 1. Verificar status do release
helm list -A --all
# Procurar releases com status pending-*

# 2. Verificar logs dos pods
kubectl get pods -n NAMESPACE
kubectl describe pod POD_NAME -n NAMESPACE

# 3. Verificar se CRDs foram instalados (cert-manager)
kubectl get crd | grep cert-manager

# 4. Verificar se o namespace existe
kubectl get namespace NAMESPACE

# 5. Verificar Terraform state
terraform state show helm_release.name
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Pod nao starta:** O chart precisa de recursos que nao existem (CRDs, PVC, secrets). Verificar eventos do pod.

2. **Timeout do Terraform:** Aumentar timeout no helm_release: timeout = 600 (segundos).

3. **Release corrompido:** Limpar com helm uninstall NAME -n NAMESPACE e rodar terraform apply novamente.

4. **Dependencia entre releases:** Se cert-manager precisa de CRDs antes de outros charts, usar depends_on entre helm_releases.

5. **Remover do state e reinstalar:** terraform state rm helm_release.name seguido de terraform apply.`
    },
    {
      title: 'IRSA nao funciona — pod recebe credenciais do node',
      difficulty: 'hard',
      symptom: 'Mesmo com ServiceAccount configurado com annotation IRSA, o pod usa as credenciais do node (Instance Profile) em vez da role IRSA.',
      diagnosis: `\`\`\`bash
# 1. Verificar annotation no ServiceAccount
kubectl get sa app-sa -n production -o jsonpath='{.metadata.annotations}'
# Deve conter eks.amazonaws.com/role-arn

# 2. Verificar se o pod usa o ServiceAccount correto
kubectl get pod POD -n production -o jsonpath='{.spec.serviceAccountName}'
# Deve retornar o SA com IRSA

# 3. Verificar se as env vars IRSA estao injetadas
kubectl exec POD -n production -- env | grep AWS
# Deve conter AWS_ROLE_ARN e AWS_WEB_IDENTITY_TOKEN_FILE

# 4. Verificar trust policy da IAM Role
aws iam get-role --role-name ROLE_NAME --query "Role.AssumeRolePolicyDocument"
# Deve conter o OIDC provider do EKS

# 5. Verificar OIDC provider
aws eks describe-cluster --name CLUSTER --query "cluster.identity.oidc"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Pod nao usa o ServiceAccount:** Verificar spec.serviceAccountName no Deployment/Pod. Se nao especificado, usa "default" que nao tem IRSA.

2. **Annotation incorreta:** Verificar se eks.amazonaws.com/role-arn tem o ARN correto da role (case sensitive, sem espacos).

3. **Trust policy incorreta:** A IAM Role precisa de trust policy para o OIDC provider do EKS com condicao no ServiceAccount (namespace:sa-name).

4. **VPC CNI addon nao atualizado:** O IRSA depende do mutating webhook do EKS. Se o vpc-cni ou o pod-identity-webhook nao estao funcionando, as env vars nao sao injetadas.

5. **SDK/CLI antigo:** Versoes antigas do AWS SDK nao suportam web identity token. Atualizar o SDK usado pela aplicacao.`
    }
  ]
};
