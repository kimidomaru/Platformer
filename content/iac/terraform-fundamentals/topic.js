window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['iac/terraform-fundamentals'] = {
  theory: `
# Terraform Fundamentals

## Relevancia
Terraform e a ferramenta de IaC (Infrastructure as Code) mais adotada do mercado, criada pela HashiCorp. Permite definir, provisionar e gerenciar infraestrutura de forma declarativa usando HCL (HashiCorp Configuration Language). Essencial para qualquer DevOps/SRE que trabalha com cloud e Kubernetes.

## Conceitos Fundamentais

### O que e Infrastructure as Code?

IaC e a pratica de gerenciar infraestrutura usando arquivos de configuracao em vez de processos manuais:

\`\`\`
Abordagem Manual:
  Console AWS → Click → Click → Click → "Funciona no meu ambiente"

Abordagem IaC:
  Codigo → git commit → Plan → Review → Apply → Infraestrutura consistente
\`\`\`

**Beneficios:**
- Reproduzibilidade — mesma infra em qualquer ambiente
- Versionamento — historico completo de mudancas (git)
- Revisao — code review para mudancas de infra
- Automacao — CI/CD para infraestrutura
- Documentacao — o codigo E a documentacao

### Terraform Core Concepts

\`\`\`
┌─────────────────────────────────────────┐
│           Terraform Workflow            │
├─────────────────────────────────────────┤
│                                         │
│  1. Write    → Definir recursos em HCL  │
│  2. Init     → Baixar providers         │
│  3. Plan     → Preview das mudancas     │
│  4. Apply    → Executar mudancas        │
│  5. Destroy  → Remover recursos         │
│                                         │
└─────────────────────────────────────────┘
\`\`\`

### Estrutura de um Projeto Terraform

\`\`\`
projeto-terraform/
  main.tf          # Recursos principais
  variables.tf     # Declaracao de variaveis
  outputs.tf       # Outputs expostos
  providers.tf     # Configuracao de providers
  terraform.tf     # Backend e required_providers
  terraform.tfvars # Valores das variaveis
  modules/         # Modulos locais
    vpc/
      main.tf
      variables.tf
      outputs.tf
\`\`\`

### HCL — HashiCorp Configuration Language

\`\`\`hcl
# Configuracao do provider
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "terraform"
      Project     = var.project_name
    }
  }
}
\`\`\`

### Recursos (Resources)

\`\`\`hcl
# Criar uma VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "\${var.project_name}-vpc"
  }
}

# Criar subnets
resource "aws_subnet" "public" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone = var.azs[count.index]

  map_public_ip_on_launch = true

  tags = {
    Name = "\${var.project_name}-public-\${count.index + 1}"
    Type = "public"
  }
}

# Security Group
resource "aws_security_group" "web" {
  name_prefix = "\${var.project_name}-web-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}
\`\`\`

### Variaveis

\`\`\`hcl
# variables.tf
variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "instance_count" {
  description = "Number of EC2 instances"
  type        = number
  default     = 2
}

variable "azs" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
\`\`\`

### Outputs

\`\`\`hcl
# outputs.tf
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "security_group_id" {
  description = "ID of the web security group"
  value       = aws_security_group.web.id
  sensitive   = false
}
\`\`\`

### State — O Coracao do Terraform

O state e o mapeamento entre o codigo HCL e os recursos reais na cloud:

\`\`\`
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Codigo HCL  │ ←──→│  State File  │ ←──→│  Cloud Real  │
│  (desejado)  │     │  (conhecido) │     │  (atual)     │
└──────────────┘     └──────────────┘     └──────────────┘

terraform plan compara:
  HCL (desejado) vs State (conhecido) = Mudancas a fazer
  State (conhecido) vs Cloud (atual) = Drift detection
\`\`\`

**Remote State (obrigatorio em equipe):**

\`\`\`hcl
# S3 backend com DynamoDB lock
backend "s3" {
  bucket         = "company-terraform-state"
  key            = "services/order-service/terraform.tfstate"
  region         = "us-east-1"
  dynamodb_table = "terraform-state-locks"
  encrypt        = true
}
\`\`\`

### Data Sources

\`\`\`hcl
# Buscar dados de recursos existentes (nao gerenciados pelo Terraform)
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Usar o data source
resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"
}
\`\`\`

### Modules

\`\`\`hcl
# Usar um modulo da registry
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "\${var.project_name}-vpc"
  cidr = "10.0.0.0/16"

  azs             = var.azs
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = var.environment != "prod"

  tags = var.tags
}

# Modulo local
module "security" {
  source = "./modules/security"

  vpc_id      = module.vpc.vpc_id
  environment = var.environment
}

# Acessar outputs do modulo
resource "aws_instance" "app" {
  subnet_id = module.vpc.private_subnets[0]
}
\`\`\`

### Comandos Essenciais

\`\`\`bash
# Inicializar o projeto (baixar providers)
terraform init

# Validar sintaxe
terraform validate

# Formatar codigo
terraform fmt -recursive

# Planejar mudancas
terraform plan -out=plan.tfplan

# Aplicar mudancas
terraform apply plan.tfplan

# Aplicar com auto-approve (CUIDADO — apenas CI/CD)
terraform apply -auto-approve

# Destruir tudo
terraform destroy

# Listar recursos no state
terraform state list

# Mostrar um recurso especifico
terraform state show aws_vpc.main

# Importar recurso existente para o state
terraform import aws_vpc.main vpc-12345678

# Mover recurso no state (refactoring)
terraform state mv aws_instance.old aws_instance.new

# Remover recurso do state (sem destruir)
terraform state rm aws_instance.detach

# Output values
terraform output -json
\`\`\`

### Lifecycle e Meta-Arguments

\`\`\`hcl
resource "aws_instance" "web" {
  # ...

  lifecycle {
    create_before_destroy = true       # Cria novo antes de destruir antigo
    prevent_destroy       = true       # Impede destruicao acidental
    ignore_changes        = [tags]     # Ignora mudancas em tags
  }

  # Meta-arguments
  count      = var.instance_count      # Criar N copias
  depends_on = [aws_vpc.main]          # Dependencia explicita
  provider   = aws.us_west             # Provider alternativo

  # for_each — alternativa ao count
  # for_each = toset(var.instances)
}
\`\`\`

### Erros Comuns

1. **State local em equipe** — sempre usar remote state com locking
2. **Sem plan antes de apply** — sempre rodar plan e revisar antes
3. **Hardcoded values** — usar variaveis e locals para reutilizacao
4. **Monolito terraform** — separar em modulos e workspaces
5. **Ignorar drift** — recursos modificados manualmente saem de sync
6. **Secrets no codigo** — nunca commitar terraform.tfvars com secrets

## Killer.sh Style Challenge

> **Cenario:** Configure um projeto Terraform para provisionar: VPC com 3 subnets publicas e 3 privadas, Security Group para HTTPS, e um S3 bucket para remote state com DynamoDB locking. Use modules quando possivel.
`,
  quiz: [
    {
      question: 'Qual comando do Terraform mostra as mudancas que serao feitas sem aplica-las?',
      options: [
        'terraform show',
        'terraform plan',
        'terraform validate',
        'terraform preview'
      ],
      correct: 1,
      explanation: 'terraform plan compara o estado desejado (HCL) com o estado atual (state + cloud) e mostra quais recursos serao criados, modificados ou destruidos, sem executar nenhuma mudanca.',
      reference: 'Conceito relacionado: Use terraform plan -out=plan.tfplan para salvar o plano e aplicar depois com terraform apply plan.tfplan.'
    },
    {
      question: 'Para que serve o state file do Terraform?',
      options: [
        'Armazenar logs de execucao',
        'Mapear os recursos definidos no codigo HCL aos recursos reais na cloud',
        'Armazenar credenciais de providers',
        'Cache de modulos baixados'
      ],
      correct: 1,
      explanation: 'O state file e o mapeamento entre o codigo HCL (desejado) e os recursos reais provisionados na cloud. Sem ele, o Terraform nao sabe quais recursos ja existem e tentaria recriar tudo.',
      reference: 'Conceito relacionado: Em equipe, sempre use remote state (S3, GCS) com locking (DynamoDB, GCS).'
    },
    {
      question: 'Qual a diferenca entre resource e data source no Terraform?',
      options: [
        'Nao ha diferenca',
        'resource cria/gerencia recursos; data source busca informacoes de recursos existentes sem gerencia-los',
        'data source cria recursos e resource busca informacoes',
        'resource e para AWS e data source para GCP'
      ],
      correct: 1,
      explanation: 'resource cria e gerencia o ciclo de vida do recurso. data source apenas consulta informacoes de recursos existentes (criados fora do Terraform ou em outro state) sem modifica-los.',
      reference: 'Conceito relacionado: data sources usam o prefixo data. no HCL (ex: data.aws_ami.ubuntu.id).'
    },
    {
      question: 'Qual backend de state e recomendado para equipes usando Terraform na AWS?',
      options: [
        'State local no filesystem',
        'S3 com DynamoDB para locking',
        'Terraform Cloud apenas',
        'Git repo com o state commitado'
      ],
      correct: 1,
      explanation: 'S3 armazena o state de forma segura e duravel. DynamoDB fornece locking para evitar modificacoes concorrentes. Ambos devem ter encrypt=true para seguranca.',
      reference: 'Conceito relacionado: NUNCA commitar o state file no git — contem dados sensiveis.'
    },
    {
      question: 'O que faz terraform import?',
      options: [
        'Importa modulos da registry',
        'Traz um recurso existente na cloud para o state do Terraform, sem recriar o recurso',
        'Importa variaveis de outro projeto',
        'Baixa providers de terceiros'
      ],
      correct: 1,
      explanation: 'terraform import associa um recurso existente na cloud ao estado do Terraform. O recurso nao e recriado — apenas adicionado ao state. Voce ainda precisa escrever o HCL correspondente.',
      reference: 'Conceito relacionado: No Terraform 1.5+, use import blocks no HCL em vez do CLI.'
    },
    {
      question: 'Qual lifecycle meta-argument previne destruicao acidental de um recurso?',
      options: [
        'ignore_changes',
        'prevent_destroy',
        'create_before_destroy',
        'skip_destroy'
      ],
      correct: 1,
      explanation: 'prevent_destroy = true faz o Terraform rejeitar qualquer plano que inclua destruicao desse recurso. Util para databases, S3 buckets e outros recursos criticos.',
      reference: 'Conceito relacionado: create_before_destroy cria o novo recurso antes de destruir o antigo (zero-downtime).'
    },
    {
      question: 'Qual a diferenca entre count e for_each no Terraform?',
      options: [
        'Nao ha diferenca, sao sinonimos',
        'count usa indice numerico; for_each usa chaves de map/set, sendo mais estavel para adicao/remocao',
        'count e para modulos e for_each para resources',
        'for_each e deprecated em favor de count'
      ],
      correct: 1,
      explanation: 'count cria recursos indexados por numero (0,1,2...). Remover um item do meio forca recriacao dos subsequentes. for_each usa chaves (string), tornando adicoes/remocoes mais seguras sem afetar outros recursos.',
      reference: 'Conceito relacionado: Prefira for_each para recursos que podem mudar independentemente.'
    }
  ],
  flashcards: [
    {
      front: 'Qual o workflow basico do Terraform?',
      back: '1. **Write** — definir recursos em HCL (.tf files)\n2. **Init** — baixar providers e inicializar backend\n3. **Plan** — preview das mudancas (create/update/destroy)\n4. **Apply** — executar as mudancas na cloud\n5. **Destroy** — remover todos os recursos\n\n**Comandos:**\n- terraform init\n- terraform validate\n- terraform fmt\n- terraform plan -out=plan.tfplan\n- terraform apply plan.tfplan\n- terraform destroy'
    },
    {
      front: 'O que e o state file e por que precisa de remote backend?',
      back: '**State** = mapeamento entre HCL e recursos reais.\n\n**Por que remote:**\n- Compartilhar entre equipe\n- Locking previne mudancas concorrentes\n- Backup automatico\n- Encriptacao em repouso\n\n**Backends comuns:**\n- AWS: S3 + DynamoDB (lock)\n- GCP: GCS (lock built-in)\n- Azure: Blob Storage\n- Terraform Cloud\n\n**NUNCA:** commitar state no git (contem secrets)'
    },
    {
      front: 'Qual a estrutura de arquivos de um projeto Terraform?',
      back: '**Arquivos principais:**\n- main.tf — recursos principais\n- variables.tf — declaracao de variaveis\n- outputs.tf — outputs expostos\n- providers.tf — configuracao de providers\n- terraform.tf — backend e required_providers\n- terraform.tfvars — valores das variaveis\n\n**Modulos:**\n- modules/nome/main.tf\n- modules/nome/variables.tf\n- modules/nome/outputs.tf\n\n**Convencao:** HCL nao exige nomes, mas a comunidade segue esse padrao.'
    },
    {
      front: 'O que sao Modules no Terraform e quando usar?',
      back: '**Module** = grupo reutilizavel de recursos.\n\n**Fontes:**\n- Local: source = "./modules/vpc"\n- Registry: source = "terraform-aws-modules/vpc/aws"\n- Git: source = "git::https://github.com/org/mod.git"\n\n**Quando usar:**\n- Padrao repetido em multiplos projetos\n- Abstrair complexidade\n- Separar responsabilidades\n\n**Acessar outputs:** module.vpc.vpc_id\n**Passar variaveis:** como argumentos do bloco module'
    },
    {
      front: 'Quais sao os meta-arguments do Terraform?',
      back: '**count** — criar N copias (indice numerico)\n**for_each** — criar copias por chave (map/set)\n**depends_on** — dependencia explicita\n**provider** — selecionar provider alternativo\n**lifecycle:**\n- create_before_destroy — zero-downtime\n- prevent_destroy — proteger recurso critico\n- ignore_changes — ignorar campos especificos\n- replace_triggered_by — forcar replace\n\n**Preferencias:**\n- for_each > count (mais estavel)\n- depends_on so quando implicito nao funciona'
    },
    {
      front: 'O que sao Data Sources no Terraform?',
      back: '**Data Source** = consulta read-only de recursos existentes.\n\n**Uso:** Buscar informacoes de recursos nao gerenciados pelo Terraform.\n\n**Exemplos:**\n- data "aws_ami" "ubuntu" — buscar AMI mais recente\n- data "aws_caller_identity" "current" — quem esta rodando\n- data "aws_vpc" "existing" — VPC existente\n\n**Sintaxe:** data.aws_ami.ubuntu.id\n\n**Diferenca de resource:**\n- resource: cria e gerencia\n- data: apenas consulta (read-only)'
    },
    {
      front: 'Quais comandos de state management do Terraform?',
      back: '**Listar recursos:**\nterraform state list\n\n**Mostrar detalhes:**\nterraform state show aws_vpc.main\n\n**Importar recurso existente:**\nterraform import aws_vpc.main vpc-123\n\n**Mover/renomear:**\nterraform state mv aws_instance.old aws_instance.new\n\n**Remover do state (sem destruir):**\nterraform state rm aws_instance.detach\n\n**Refresh (sync state com cloud):**\nterraform refresh\n\n**Cuidado:** Operacoes de state sao destrutivas — faca backup antes.'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar um projeto Terraform basico com VPC, subnets e remote state na AWS.',
    objective: 'Aprender a estrutura de um projeto Terraform, HCL basico, variaveis, outputs e remote state.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar estrutura basica do projeto Terraform',
        instruction: `Crie a estrutura de arquivos para um projeto Terraform:
1. \`terraform.tf\` — required_version >= 1.5, required_providers (aws ~> 5.0), backend S3
2. \`providers.tf\` — provider aws com region variavel e default_tags
3. \`variables.tf\` — variaveis: region (string), environment (string com validation), project_name (string)`,
        hints: [
          'terraform.tf contem o bloco terraform {} com backend e required_providers',
          'Use validation no environment para aceitar apenas dev, staging, prod',
          'default_tags no provider aplica tags automaticamente a todos os recursos'
        ],
        solution: `\`\`\`hcl
# terraform.tf
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "my-company-terraform-state"
    key            = "lab/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

# providers.tf
provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "terraform"
      Project     = var.project_name
    }
  }
}

# variables.tf
variable "region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "k8s-lab"
}
\`\`\``,
        verify: `\`\`\`bash
# Verificar estrutura de arquivos
ls -la *.tf
# Saida esperada: terraform.tf, providers.tf, variables.tf

# Validar sintaxe (antes do init — espera-se que falhe no backend)
terraform validate 2>&1 || true
# Nota: validate pode falhar antes do init, mas a sintaxe sera checada

# Verificar formatacao
terraform fmt -check
# Saida esperada: nenhuma saida (tudo formatado)
\`\`\``
      },
      {
        title: 'Criar VPC com subnets usando HCL',
        instruction: `Crie um \`main.tf\` com:
1. Uma **VPC** com CIDR 10.0.0.0/16 e DNS habilitado
2. **3 subnets publicas** usando count e cidrsubnet
3. Uma **Internet Gateway** associada a VPC
4. Uma **Route Table** com rota 0.0.0.0/0 para o IGW
5. Adicione uma variavel \`azs\` do tipo list(string) com 3 AZs`,
        hints: [
          'Use count = length(var.azs) para criar subnets dinamicamente',
          'cidrsubnet(cidr, newbits, netnum) calcula subnets automaticamente',
          'Route table association precisa de aws_route_table_association'
        ],
        solution: `\`\`\`hcl
# Adicionar a variables.tf
variable "azs" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# main.tf
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "\${var.project_name}-vpc"
  }
}

resource "aws_subnet" "public" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone = var.azs[count.index]

  map_public_ip_on_launch = true

  tags = {
    Name = "\${var.project_name}-public-\${count.index + 1}"
    Type = "public"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "\${var.project_name}-igw"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "\${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(var.azs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
\`\`\``,
        verify: `\`\`\`bash
# Validar a configuracao
terraform validate
# Saida esperada: Success! The configuration is valid.

# Planejar (sem aplicar)
terraform plan
# Saida esperada: Plan: 8 to add (vpc, 3 subnets, igw, route table, 3 associations)

# Verificar formatacao
terraform fmt -check -recursive
# Saida esperada: nenhuma saida (tudo formatado)
\`\`\``
      },
      {
        title: 'Criar outputs e usar data source',
        instruction: `Adicione ao projeto:
1. \`outputs.tf\` com outputs para vpc_id, public_subnet_ids e igw_id
2. Um **data source** para buscar a AMI Ubuntu mais recente
3. Um resource \`aws_instance\` usando a AMI do data source na primeira subnet publica`,
        hints: [
          'Use aws_subnet.public[*].id para coletar todos os IDs de subnet',
          'Data source aws_ami usa filter para name e owners para a conta',
          'most_recent = true retorna apenas a AMI mais recente'
        ],
        solution: `\`\`\`hcl
# outputs.tf
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "igw_id" {
  description = "ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}

output "instance_public_ip" {
  description = "Public IP of the web instance"
  value       = aws_instance.web.public_ip
}

# data source em main.tf
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# EC2 instance
resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "\${var.project_name}-web"
  }
}
\`\`\``,
        verify: `\`\`\`bash
# Validar configuracao completa
terraform validate
# Saida esperada: Success! The configuration is valid.

# Verificar que outputs estao definidos
terraform plan | grep -A1 "Outputs:"
# Saida esperada: vpc_id, public_subnet_ids, igw_id, instance_public_ip

# Listar outputs configurados
grep "^output" outputs.tf
# Saida esperada: 4 outputs definidos
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'State lock — "Error acquiring the state lock"',
      difficulty: 'easy',
      symptom: 'Ao rodar terraform plan ou apply, o erro "Error acquiring the state lock" aparece, impedindo qualquer operacao.',
      diagnosis: `\`\`\`bash
# 1. Verificar quem esta segurando o lock
terraform force-unlock -help
# O erro mostra o Lock ID

# 2. Verificar na DynamoDB (AWS)
aws dynamodb scan --table-name terraform-locks \\
  --filter-expression "LockID = :lockid" \\
  --expression-attribute-values '{":lockid":{"S":"state-key"}}'

# 3. Verificar se outro processo terraform esta rodando
ps aux | grep terraform

# 4. Verificar CI/CD — pode ter um pipeline travado
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Outro processo rodando:** Aguardar o outro terraform plan/apply terminar. Se for CI/CD, verificar se o pipeline esta travado.

2. **Processo crashou sem liberar lock:** Usar terraform force-unlock LOCK_ID para liberar manualmente. CUIDADO: so usar se tem certeza que nenhum outro processo esta rodando.

3. **Pipeline CI/CD cancelado:** Se o CI foi cancelado durante apply, o lock pode ficar preso. Force-unlock e seguro neste caso.

4. **Prevencao:** Configurar timeout no CI/CD e usar -lock-timeout=5m para esperar automaticamente.`
    },
    {
      title: 'Drift detectado — recurso modificado fora do Terraform',
      difficulty: 'medium',
      symptom: 'terraform plan mostra mudancas inesperadas em recursos que nao foram modificados no codigo. Alguem alterou o recurso manualmente na console AWS.',
      diagnosis: `\`\`\`bash
# 1. Verificar o que mudou
terraform plan -detailed-exitcode
# Exit code 2 = mudancas detectadas

# 2. Comparar state com realidade
terraform show
terraform state show aws_security_group.web

# 3. Verificar no CloudTrail quem fez a mudanca manual
# AWS Console > CloudTrail > Event history > filter by resource

# 4. Refresh do state para sincronizar
terraform refresh
# Atualiza o state com os valores atuais da cloud
\`\`\``,
      solution: `**Opcoes para resolver drift:**

1. **Aceitar a mudanca manual:** Rodar terraform refresh para atualizar o state. Depois ajustar o HCL para refletir o novo estado.

2. **Reverter para o HCL:** Rodar terraform apply normalmente — o Terraform vai reverter o recurso para o estado desejado no codigo.

3. **Ignorar campos especificos:** Se o campo muda frequentemente fora do Terraform, usar lifecycle { ignore_changes = [campo] }.

4. **Prevencao:** Implementar politicas que impedem modificacoes manuais (AWS SCP, tags de protecao). Usar alertas de drift no CI/CD.`
    },
    {
      title: 'Terraform destroy falha por dependencia circular',
      difficulty: 'hard',
      symptom: 'terraform destroy falha com erros de dependencia. Recursos nao podem ser destruidos porque outros recursos dependem deles.',
      diagnosis: `\`\`\`bash
# 1. Visualizar o grafo de dependencias
terraform graph | dot -Tpng > graph.png
# ou
terraform graph

# 2. Tentar destruir recursos especificos
terraform destroy -target=aws_instance.web

# 3. Verificar se recursos foram criados fora do Terraform
# que dependem de recursos gerenciados

# 4. Verificar se prevent_destroy esta ativo
grep -r "prevent_destroy" *.tf
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Recursos criados manualmente dependem dos gerenciados:** Remover manualmente os recursos nao gerenciados antes de destroy. Ou importar eles para o Terraform.

2. **prevent_destroy ativo:** Remover ou comentar o lifecycle { prevent_destroy = true } dos recursos antes do destroy.

3. **Dependencias cruzadas entre modules:** Destruir modulos em ordem especifica usando -target: terraform destroy -target=module.app e depois -target=module.vpc.

4. **Security Group em uso:** Se um SG esta associado a recursos fora do Terraform, remover a associacao primeiro.

5. **Caso extremo:** Remover recursos do state com terraform state rm e deletar manualmente na console.`
    }
  ]
};
