window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['iac/terraform-fundamentals'] = {
  theory: `
# Terraform Fundamentals

## Relevance
Terraform is the most widely adopted IaC (Infrastructure as Code) tool, created by HashiCorp. It allows defining, provisioning, and managing infrastructure declaratively using HCL (HashiCorp Configuration Language). Essential for any DevOps/SRE working with cloud and Kubernetes.

## Fundamental Concepts

### What is Infrastructure as Code?

IaC is the practice of managing infrastructure using configuration files instead of manual processes:

\`\`\`
Manual Approach:
  AWS Console → Click → Click → Click → "Works on my environment"

IaC Approach:
  Code → git commit → Plan → Review → Apply → Consistent infrastructure
\`\`\`

**Benefits:**
- Reproducibility — same infra in any environment
- Versioning — complete history of changes (git)
- Review — code review for infra changes
- Automation — CI/CD for infrastructure
- Documentation — the code IS the documentation

### Terraform Core Concepts

\`\`\`
┌─────────────────────────────────────────┐
│           Terraform Workflow            │
├─────────────────────────────────────────┤
│                                         │
│  1. Write    → Define resources in HCL  │
│  2. Init     → Download providers       │
│  3. Plan     → Preview changes          │
│  4. Apply    → Execute changes          │
│  5. Destroy  → Remove resources         │
│                                         │
└─────────────────────────────────────────┘
\`\`\`

### Terraform Project Structure

\`\`\`
terraform-project/
  main.tf          # Main resources
  variables.tf     # Variable declarations
  outputs.tf       # Exposed outputs
  providers.tf     # Provider configuration
  terraform.tf     # Backend and required_providers
  terraform.tfvars # Variable values
  modules/         # Local modules
    vpc/
      main.tf
      variables.tf
      outputs.tf
\`\`\`

### HCL — HashiCorp Configuration Language

\`\`\`hcl
# Provider configuration
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

### Resources

\`\`\`hcl
# Create a VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "\${var.project_name}-vpc"
  }
}

# Create subnets
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

### Variables

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

### State — The Heart of Terraform

The state is the mapping between HCL code and real resources in the cloud:

\`\`\`
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   HCL Code   │ ←──→│  State File  │ ←──→│  Real Cloud  │
│  (desired)   │     │  (known)     │     │  (actual)    │
└──────────────┘     └──────────────┘     └──────────────┘

terraform plan compares:
  HCL (desired) vs State (known) = Changes to make
  State (known) vs Cloud (actual) = Drift detection
\`\`\`

**Remote State (mandatory for teams):**

\`\`\`hcl
# S3 backend with DynamoDB lock
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
# Fetch data from existing resources (not managed by Terraform)
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

# Use the data source
resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"
}
\`\`\`

### Modules

\`\`\`hcl
# Use a module from the registry
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

# Local module
module "security" {
  source = "./modules/security"

  vpc_id      = module.vpc.vpc_id
  environment = var.environment
}

# Access module outputs
resource "aws_instance" "app" {
  subnet_id = module.vpc.private_subnets[0]
}
\`\`\`

### Essential Commands

\`\`\`bash
# Initialize project (download providers)
terraform init

# Validate syntax
terraform validate

# Format code
terraform fmt -recursive

# Plan changes
terraform plan -out=plan.tfplan

# Apply changes
terraform apply plan.tfplan

# Apply with auto-approve (CAUTION — CI/CD only)
terraform apply -auto-approve

# Destroy everything
terraform destroy

# List resources in state
terraform state list

# Show a specific resource
terraform state show aws_vpc.main

# Import existing resource to state
terraform import aws_vpc.main vpc-12345678

# Move resource in state (refactoring)
terraform state mv aws_instance.old aws_instance.new

# Remove resource from state (without destroying)
terraform state rm aws_instance.detach

# Output values
terraform output -json
\`\`\`

### Lifecycle and Meta-Arguments

\`\`\`hcl
resource "aws_instance" "web" {
  # ...

  lifecycle {
    create_before_destroy = true       # Create new before destroying old
    prevent_destroy       = true       # Prevent accidental destruction
    ignore_changes        = [tags]     # Ignore changes in tags
  }

  # Meta-arguments
  count      = var.instance_count      # Create N copies
  depends_on = [aws_vpc.main]          # Explicit dependency
  provider   = aws.us_west             # Alternative provider

  # for_each — alternative to count
  # for_each = toset(var.instances)
}
\`\`\`

### Common Mistakes

1. **Local state in teams** — always use remote state with locking
2. **No plan before apply** — always run plan and review first
3. **Hardcoded values** — use variables and locals for reuse
4. **Terraform monolith** — separate into modules and workspaces
5. **Ignoring drift** — manually modified resources go out of sync
6. **Secrets in code** — never commit terraform.tfvars with secrets

## Killer.sh Style Challenge

> **Scenario:** Configure a Terraform project to provision: VPC with 3 public and 3 private subnets, Security Group for HTTPS, and an S3 bucket for remote state with DynamoDB locking. Use modules where possible.
`,
  quiz: [
    {
      question: 'Which Terraform command shows changes that will be made without applying them?',
      options: [
        'terraform show',
        'terraform plan',
        'terraform validate',
        'terraform preview'
      ],
      correct: 1,
      explanation: 'terraform plan compares the desired state (HCL) with the current state (state + cloud) and shows which resources will be created, modified, or destroyed, without executing any changes.',
      reference: 'Related concept: Use terraform plan -out=plan.tfplan to save the plan and apply later with terraform apply plan.tfplan.'
    },
    {
      question: 'What is the purpose of the Terraform state file?',
      options: [
        'Store execution logs',
        'Map resources defined in HCL code to actual cloud resources',
        'Store provider credentials',
        'Cache downloaded modules'
      ],
      correct: 1,
      explanation: 'The state file is the mapping between HCL code (desired) and actual provisioned cloud resources. Without it, Terraform wouldn\'t know which resources already exist and would try to recreate everything.',
      reference: 'Related concept: For teams, always use remote state (S3, GCS) with locking (DynamoDB, GCS).'
    },
    {
      question: 'What is the difference between resource and data source in Terraform?',
      options: [
        'There is no difference',
        'resource creates/manages resources; data source fetches information from existing resources without managing them',
        'data source creates resources and resource fetches information',
        'resource is for AWS and data source for GCP'
      ],
      correct: 1,
      explanation: 'resource creates and manages the resource lifecycle. data source only queries information from existing resources (created outside Terraform or in another state) without modifying them.',
      reference: 'Related concept: data sources use the data. prefix in HCL (e.g., data.aws_ami.ubuntu.id).'
    },
    {
      question: 'Which state backend is recommended for teams using Terraform on AWS?',
      options: [
        'Local state on filesystem',
        'S3 with DynamoDB for locking',
        'Terraform Cloud only',
        'Git repo with committed state'
      ],
      correct: 1,
      explanation: 'S3 stores state securely and durably. DynamoDB provides locking to prevent concurrent modifications. Both should have encrypt=true for security.',
      reference: 'Related concept: NEVER commit the state file to git — it contains sensitive data.'
    },
    {
      question: 'What does terraform import do?',
      options: [
        'Imports modules from the registry',
        'Brings an existing cloud resource into the Terraform state without recreating it',
        'Imports variables from another project',
        'Downloads third-party providers'
      ],
      correct: 1,
      explanation: 'terraform import associates an existing cloud resource with Terraform state. The resource is not recreated — only added to the state. You still need to write the corresponding HCL.',
      reference: 'Related concept: In Terraform 1.5+, use import blocks in HCL instead of the CLI.'
    },
    {
      question: 'Which lifecycle meta-argument prevents accidental destruction of a resource?',
      options: [
        'ignore_changes',
        'prevent_destroy',
        'create_before_destroy',
        'skip_destroy'
      ],
      correct: 1,
      explanation: 'prevent_destroy = true makes Terraform reject any plan that includes destruction of that resource. Useful for databases, S3 buckets, and other critical resources.',
      reference: 'Related concept: create_before_destroy creates the new resource before destroying the old one (zero-downtime).'
    },
    {
      question: 'What is the difference between count and for_each in Terraform?',
      options: [
        'There is no difference, they are synonyms',
        'count uses numeric index; for_each uses map/set keys, being more stable for additions/removals',
        'count is for modules and for_each for resources',
        'for_each is deprecated in favor of count'
      ],
      correct: 1,
      explanation: 'count creates resources indexed by number (0,1,2...). Removing an item in the middle forces recreation of subsequent ones. for_each uses keys (string), making additions/removals safer without affecting other resources.',
      reference: 'Related concept: Prefer for_each for resources that can change independently.'
    }
  ],
  flashcards: [
    {
      front: 'What is the basic Terraform workflow?',
      back: '1. **Write** — define resources in HCL (.tf files)\n2. **Init** — download providers and initialize backend\n3. **Plan** — preview changes (create/update/destroy)\n4. **Apply** — execute changes in the cloud\n5. **Destroy** — remove all resources\n\n**Commands:**\n- terraform init\n- terraform validate\n- terraform fmt\n- terraform plan -out=plan.tfplan\n- terraform apply plan.tfplan\n- terraform destroy'
    },
    {
      front: 'What is the state file and why does it need a remote backend?',
      back: '**State** = mapping between HCL and real resources.\n\n**Why remote:**\n- Share across team\n- Locking prevents concurrent changes\n- Automatic backup\n- Encryption at rest\n\n**Common backends:**\n- AWS: S3 + DynamoDB (lock)\n- GCP: GCS (lock built-in)\n- Azure: Blob Storage\n- Terraform Cloud\n\n**NEVER:** commit state to git (contains secrets)'
    },
    {
      front: 'What is the file structure of a Terraform project?',
      back: '**Main files:**\n- main.tf — main resources\n- variables.tf — variable declarations\n- outputs.tf — exposed outputs\n- providers.tf — provider configuration\n- terraform.tf — backend and required_providers\n- terraform.tfvars — variable values\n\n**Modules:**\n- modules/name/main.tf\n- modules/name/variables.tf\n- modules/name/outputs.tf\n\n**Convention:** HCL doesn\'t require names, but community follows this pattern.'
    },
    {
      front: 'What are Modules in Terraform and when to use them?',
      back: '**Module** = reusable group of resources.\n\n**Sources:**\n- Local: source = "./modules/vpc"\n- Registry: source = "terraform-aws-modules/vpc/aws"\n- Git: source = "git::https://github.com/org/mod.git"\n\n**When to use:**\n- Pattern repeated across projects\n- Abstract complexity\n- Separate responsibilities\n\n**Access outputs:** module.vpc.vpc_id\n**Pass variables:** as arguments of the module block'
    },
    {
      front: 'What are Terraform meta-arguments?',
      back: '**count** — create N copies (numeric index)\n**for_each** — create copies by key (map/set)\n**depends_on** — explicit dependency\n**provider** — select alternative provider\n**lifecycle:**\n- create_before_destroy — zero-downtime\n- prevent_destroy — protect critical resource\n- ignore_changes — ignore specific fields\n- replace_triggered_by — force replace\n\n**Preferences:**\n- for_each > count (more stable)\n- depends_on only when implicit doesn\'t work'
    },
    {
      front: 'What are Data Sources in Terraform?',
      back: '**Data Source** = read-only query of existing resources.\n\n**Usage:** Fetch information from resources not managed by Terraform.\n\n**Examples:**\n- data "aws_ami" "ubuntu" — fetch latest AMI\n- data "aws_caller_identity" "current" — who is running\n- data "aws_vpc" "existing" — existing VPC\n\n**Syntax:** data.aws_ami.ubuntu.id\n\n**Difference from resource:**\n- resource: creates and manages\n- data: only queries (read-only)'
    },
    {
      front: 'What Terraform state management commands exist?',
      back: '**List resources:**\nterraform state list\n\n**Show details:**\nterraform state show aws_vpc.main\n\n**Import existing resource:**\nterraform import aws_vpc.main vpc-123\n\n**Move/rename:**\nterraform state mv aws_instance.old aws_instance.new\n\n**Remove from state (without destroying):**\nterraform state rm aws_instance.detach\n\n**Refresh (sync state with cloud):**\nterraform refresh\n\n**Caution:** State operations are destructive — backup first.'
    }
  ],
  lab: {
    scenario: 'You need to configure a basic Terraform project with VPC, subnets, and remote state on AWS.',
    objective: 'Learn the structure of a Terraform project, basic HCL, variables, outputs, and remote state.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create basic Terraform project structure',
        instruction: `Create the file structure for a Terraform project:
1. \`terraform.tf\` — required_version >= 1.5, required_providers (aws ~> 5.0), S3 backend
2. \`providers.tf\` — aws provider with variable region and default_tags
3. \`variables.tf\` — variables: region (string), environment (string with validation), project_name (string)`,
        hints: [
          'terraform.tf contains the terraform {} block with backend and required_providers',
          'Use validation on environment to accept only dev, staging, prod',
          'default_tags on provider automatically applies tags to all resources'
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
# Verify file structure
ls -la *.tf
# Expected output: terraform.tf, providers.tf, variables.tf

# Validate syntax (before init — expected to fail on backend)
terraform validate 2>&1 || true
# Note: validate may fail before init, but syntax will be checked

# Check formatting
terraform fmt -check
# Expected output: no output (everything formatted)
\`\`\``
      },
      {
        title: 'Create VPC with subnets using HCL',
        instruction: `Create a \`main.tf\` with:
1. A **VPC** with CIDR 10.0.0.0/16 and DNS enabled
2. **3 public subnets** using count and cidrsubnet
3. An **Internet Gateway** associated with the VPC
4. A **Route Table** with 0.0.0.0/0 route to the IGW
5. Add an \`azs\` variable of type list(string) with 3 AZs`,
        hints: [
          'Use count = length(var.azs) to create subnets dynamically',
          'cidrsubnet(cidr, newbits, netnum) calculates subnets automatically',
          'Route table association needs aws_route_table_association'
        ],
        solution: `\`\`\`hcl
# Add to variables.tf
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
# Validate configuration
terraform validate
# Expected output: Success! The configuration is valid.

# Plan (without applying)
terraform plan
# Expected output: Plan: 8 to add (vpc, 3 subnets, igw, route table, 3 associations)

# Check formatting
terraform fmt -check -recursive
# Expected output: no output (everything formatted)
\`\`\``
      },
      {
        title: 'Create outputs and use data source',
        instruction: `Add to the project:
1. \`outputs.tf\` with outputs for vpc_id, public_subnet_ids, and igw_id
2. A **data source** to fetch the latest Ubuntu AMI
3. An \`aws_instance\` resource using the AMI from the data source in the first public subnet`,
        hints: [
          'Use aws_subnet.public[*].id to collect all subnet IDs',
          'Data source aws_ami uses filter for name and owners for the account',
          'most_recent = true returns only the latest AMI'
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

# data source in main.tf
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
# Validate complete configuration
terraform validate
# Expected output: Success! The configuration is valid.

# Verify outputs are defined
terraform plan | grep -A1 "Outputs:"
# Expected output: vpc_id, public_subnet_ids, igw_id, instance_public_ip

# List configured outputs
grep "^output" outputs.tf
# Expected output: 4 outputs defined
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'State lock — "Error acquiring the state lock"',
      difficulty: 'easy',
      symptom: 'When running terraform plan or apply, the error "Error acquiring the state lock" appears, preventing any operation.',
      diagnosis: `\`\`\`bash
# 1. Check who is holding the lock
terraform force-unlock -help
# The error shows the Lock ID

# 2. Check in DynamoDB (AWS)
aws dynamodb scan --table-name terraform-locks \\
  --filter-expression "LockID = :lockid" \\
  --expression-attribute-values '{":lockid":{"S":"state-key"}}'

# 3. Check if another terraform process is running
ps aux | grep terraform

# 4. Check CI/CD — a pipeline might be stuck
\`\`\``,
      solution: `**Causes and solutions:**

1. **Another process running:** Wait for the other terraform plan/apply to finish. If CI/CD, check if the pipeline is stuck.

2. **Process crashed without releasing lock:** Use terraform force-unlock LOCK_ID to release manually. CAUTION: only use if certain no other process is running.

3. **CI/CD pipeline cancelled:** If CI was cancelled during apply, the lock may remain. Force-unlock is safe in this case.

4. **Prevention:** Configure timeout in CI/CD and use -lock-timeout=5m to wait automatically.`
    },
    {
      title: 'Drift detected — resource modified outside Terraform',
      difficulty: 'medium',
      symptom: 'terraform plan shows unexpected changes to resources that were not modified in code. Someone changed the resource manually in the AWS console.',
      diagnosis: `\`\`\`bash
# 1. Check what changed
terraform plan -detailed-exitcode
# Exit code 2 = changes detected

# 2. Compare state with reality
terraform show
terraform state show aws_security_group.web

# 3. Check in CloudTrail who made the manual change
# AWS Console > CloudTrail > Event history > filter by resource

# 4. Refresh state to synchronize
terraform refresh
# Updates state with current cloud values
\`\`\``,
      solution: `**Options to resolve drift:**

1. **Accept the manual change:** Run terraform refresh to update the state. Then adjust HCL to reflect the new state.

2. **Revert to HCL:** Run terraform apply normally — Terraform will revert the resource to the desired state in code.

3. **Ignore specific fields:** If the field changes frequently outside Terraform, use lifecycle { ignore_changes = [field] }.

4. **Prevention:** Implement policies preventing manual modifications (AWS SCP, protection tags). Use drift alerts in CI/CD.`
    },
    {
      title: 'Terraform destroy fails due to circular dependency',
      difficulty: 'hard',
      symptom: 'terraform destroy fails with dependency errors. Resources cannot be destroyed because other resources depend on them.',
      diagnosis: `\`\`\`bash
# 1. Visualize the dependency graph
terraform graph | dot -Tpng > graph.png
# or
terraform graph

# 2. Try destroying specific resources
terraform destroy -target=aws_instance.web

# 3. Check if resources were created outside Terraform
# that depend on managed resources

# 4. Check if prevent_destroy is active
grep -r "prevent_destroy" *.tf
\`\`\``,
      solution: `**Causes and solutions:**

1. **Manually created resources depend on managed ones:** Manually remove unmanaged resources before destroy. Or import them into Terraform.

2. **prevent_destroy active:** Remove or comment out the lifecycle { prevent_destroy = true } from resources before destroy.

3. **Cross-module dependencies:** Destroy modules in specific order using -target: terraform destroy -target=module.app then -target=module.vpc.

4. **Security Group in use:** If an SG is associated with resources outside Terraform, remove the association first.

5. **Edge case:** Remove resources from state with terraform state rm and delete manually in the console.`
    }
  ]
};
