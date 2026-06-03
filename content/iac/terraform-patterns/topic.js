window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['iac/terraform-patterns'] = {
  theory: `
# Terraform Advanced Patterns

## Relevancia
Alem dos fundamentos, dominar padroes avancados de Terraform e essencial para operar infraestrutura em escala. Workspaces, remote state, Atlantis, Terragrunt, CI/CD pipelines e drift detection sao praticas que diferenciam operacoes maduras de ad-hoc.

## Conceitos Fundamentais

### Workspaces

Workspaces permitem usar o mesmo codigo HCL para multiplos ambientes com states separados:

\`\`\`bash
# Criar e listar workspaces
terraform workspace new staging
terraform workspace new production
terraform workspace list
terraform workspace select staging
terraform workspace show
\`\`\`

\`\`\`hcl
# Usar workspace no codigo
locals {
  environment = terraform.workspace

  instance_count = {
    dev        = 1
    staging    = 2
    production = 3
  }

  instance_type = {
    dev        = "t3.micro"
    staging    = "t3.small"
    production = "t3.medium"
  }
}

resource "aws_instance" "app" {
  count         = local.instance_count[local.environment]
  instance_type = local.instance_type[local.environment]
  ami           = data.aws_ami.ubuntu.id

  tags = {
    Name        = "\${var.project}-\${local.environment}-\${count.index + 1}"
    Environment = local.environment
  }
}
\`\`\`

**Limitacoes de Workspaces:**
- Mesmo backend para todos os workspaces
- Nao suporta configuracoes de provider diferentes por workspace
- Alternativa: diretorio por ambiente com Terragrunt

### Terragrunt — DRY Terraform

Terragrunt e um wrapper para Terraform que reduz duplicacao:

\`\`\`
# Estrutura com Terragrunt
infra/
  terragrunt.hcl           # Config raiz (backend, provider)
  environments/
    dev/
      terragrunt.hcl       # include root + vars de dev
      vpc/
        terragrunt.hcl     # modulo vpc com inputs de dev
      eks/
        terragrunt.hcl     # modulo eks com inputs de dev
    staging/
      terragrunt.hcl
      vpc/
        terragrunt.hcl
      eks/
        terragrunt.hcl
    production/
      terragrunt.hcl
      vpc/
        terragrunt.hcl
      eks/
        terragrunt.hcl
  modules/
    vpc/
      main.tf
      variables.tf
      outputs.tf
    eks/
      main.tf
      variables.tf
      outputs.tf
\`\`\`

\`\`\`hcl
# terragrunt.hcl (raiz)
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite"
  }
  config = {
    bucket         = "company-terraform-state"
    key            = "\${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite"
  contents  = <<EOF
provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = {
      ManagedBy   = "terraform"
      Environment = "\${basename(get_terragrunt_dir())}"
    }
  }
}
EOF
}
\`\`\`

\`\`\`hcl
# environments/production/vpc/terragrunt.hcl
include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/vpc"
}

inputs = {
  name        = "production-vpc"
  cidr        = "10.0.0.0/16"
  azs         = ["us-east-1a", "us-east-1b", "us-east-1c"]
  environment = "production"
}
\`\`\`

\`\`\`hcl
# environments/production/eks/terragrunt.hcl
include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/eks"
}

dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  cluster_name = "production-eks"
  vpc_id       = dependency.vpc.outputs.vpc_id
  subnet_ids   = dependency.vpc.outputs.private_subnet_ids
  environment  = "production"
}
\`\`\`

### Atlantis — GitOps para Terraform

Atlantis e um servidor que executa terraform plan/apply via Pull Requests:

\`\`\`
Fluxo Atlantis:
1. Dev abre PR com mudanca em .tf
2. Atlantis detecta e roda terraform plan
3. Plan aparece como comentario no PR
4. Reviewer analisa o plan
5. Dev comenta "atlantis apply"
6. Atlantis executa terraform apply
7. PR e merged
\`\`\`

\`\`\`yaml
# atlantis.yaml — na raiz do repo
version: 3
projects:
  - name: networking
    dir: infrastructure/networking
    workspace: production
    terraform_version: v1.7.0
    autoplan:
      when_modified:
        - "*.tf"
        - "*.tfvars"
      enabled: true
    apply_requirements:
      - approved
      - mergeable

  - name: eks-cluster
    dir: infrastructure/eks
    workspace: production
    terraform_version: v1.7.0
    autoplan:
      when_modified:
        - "*.tf"
        - "*.tfvars"
      enabled: true
    apply_requirements:
      - approved
      - mergeable
    workflow: custom

workflows:
  custom:
    plan:
      steps:
        - init
        - run: terraform fmt -check
        - run: terraform validate
        - plan:
            extra_args: ["-var-file", "production.tfvars"]
    apply:
      steps:
        - apply
\`\`\`

### CI/CD Pipeline para Terraform

\`\`\`yaml
# .github/workflows/terraform.yml
name: Terraform CI/CD

on:
  pull_request:
    paths:
      - 'infrastructure/**'
  push:
    branches:
      - main
    paths:
      - 'infrastructure/**'

env:
  TF_VERSION: "1.7.0"
  AWS_REGION: "us-east-1"

jobs:
  plan:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: \${{ env.TF_VERSION }}

      - name: Terraform Init
        run: terraform init
        working-directory: infrastructure

      - name: Terraform Format Check
        run: terraform fmt -check -recursive
        working-directory: infrastructure

      - name: Terraform Validate
        run: terraform validate
        working-directory: infrastructure

      - name: Terraform Plan
        run: terraform plan -no-color -out=plan.tfplan
        working-directory: infrastructure

      - name: Comment Plan on PR
        uses: actions/github-script@v7
        with:
          script: |
            const output = \\\`Terraform Plan output here\\\`;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: output
            });

  apply:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: []
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: \${{ env.TF_VERSION }}

      - name: Terraform Init
        run: terraform init
        working-directory: infrastructure

      - name: Terraform Apply
        run: terraform apply -auto-approve
        working-directory: infrastructure
\`\`\`

### Drift Detection

\`\`\`bash
# Detectar drift manualmente
terraform plan -detailed-exitcode
# Exit code 0 = no changes
# Exit code 1 = error
# Exit code 2 = changes detected (drift!)

# Automatizar drift detection no CI
# Rodar plan periodicamente e alertar se exit code == 2
\`\`\`

\`\`\`yaml
# Drift detection via GitHub Actions (scheduled)
name: Terraform Drift Detection

on:
  schedule:
    - cron: '0 8 * * 1-5'  # Seg-Sex as 8h

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3

      - name: Init & Plan
        id: plan
        run: |
          terraform init
          terraform plan -detailed-exitcode -no-color 2>&1 | tee plan.txt
        continue-on-error: true
        working-directory: infrastructure

      - name: Alert on Drift
        if: steps.plan.outputs.exitcode == 2
        run: |
          echo "DRIFT DETECTED!"
          # Enviar alerta via Slack/email
\`\`\`

### Modulos Avancados

\`\`\`hcl
# Modulo com validacao complexa
variable "config" {
  type = object({
    name        = string
    environment = string
    replicas    = number
    features    = map(bool)
  })

  validation {
    condition     = var.config.replicas > 0 && var.config.replicas <= 20
    error_message = "Replicas must be between 1 and 20."
  }
}

# Usar moved block para refactoring seguro
moved {
  from = aws_instance.web
  to   = aws_instance.app
}

# Import block (Terraform 1.5+)
import {
  to = aws_s3_bucket.existing
  id = "my-existing-bucket"
}

resource "aws_s3_bucket" "existing" {
  bucket = "my-existing-bucket"
}
\`\`\`

### Sensitive Data Management

\`\`\`hcl
# Marcar variaveis como sensitive
variable "db_password" {
  type      = string
  sensitive = true
}

# Marcar outputs como sensitive
output "db_connection_string" {
  value     = "postgresql://\${var.db_user}:\${var.db_password}@\${aws_db_instance.main.endpoint}/app"
  sensitive = true
}

# Usar AWS Secrets Manager / SSM
data "aws_secretsmanager_secret_version" "db" {
  secret_id = "production/database/password"
}

# Nunca hardcode secrets
resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db.secret_string
  # NAO: password = "MyP@ssword123!"
}
\`\`\`

### Terraform Cloud / HCP Terraform

\`\`\`hcl
# Backend para Terraform Cloud
terraform {
  cloud {
    organization = "my-company"

    workspaces {
      name = "production-infra"
    }
  }
}
\`\`\`

**Features do Terraform Cloud:**
- Remote state management (built-in)
- Remote plan/apply (no CI/CD needed)
- Policy as Code (Sentinel)
- Private module registry
- Cost estimation
- Drift detection automatico
- SSO e RBAC

### Erros Comuns em Patterns Avancados

1. **Workspace sprawl** — muitos workspaces sem governanca
2. **Terragrunt overengineering** — usar Terragrunt quando workspaces bastam
3. **CI/CD sem plan review** — apply sem revisao humana do plan
4. **Sem drift detection** — recursos modificados manualmente sem alerta
5. **Modulos muito genericos** — modulos que tentam resolver tudo ficam complexos
6. **Sem testes** — nao testar modulos com Terratest ou terraform test

## Killer.sh Style Challenge

> **Cenario:** Configure um pipeline CI/CD completo para Terraform com: (1) plan automatico em PRs, (2) apply apos aprovacao e merge, (3) drift detection semanal com alerta via Slack, (4) Terragrunt para gerenciar 3 ambientes.
`,
  quiz: [
    {
      question: 'O que sao Terraform Workspaces?',
      options: [
        'Diretorios de projeto',
        'States isolados que permitem usar o mesmo codigo HCL para multiplos ambientes',
        'Repositorios Git separados',
        'Plugins de provider'
      ],
      correct: 1,
      explanation: 'Workspaces criam states separados dentro do mesmo backend, permitindo usar o mesmo codigo para dev, staging e production. O workspace atual e acessivel via terraform.workspace.',
      reference: 'Conceito relacionado: Para configuracoes muito diferentes entre ambientes, considere Terragrunt.'
    },
    {
      question: 'Qual o principal beneficio do Atlantis para Terraform?',
      options: [
        'Substituir o Terraform CLI',
        'Executar plan/apply via Pull Requests com revisao de codigo antes do apply',
        'Gerenciar secrets',
        'Criar modulos automaticamente'
      ],
      correct: 1,
      explanation: 'Atlantis integra Terraform com Git: plan automatico em PRs, plan visivel como comentario, apply via comando no PR apos aprovacao. Garante que toda mudanca de infra passa por code review.',
      reference: 'Conceito relacionado: apply_requirements: approved + mergeable garante revisao antes do apply.'
    },
    {
      question: 'Como detectar drift (mudancas manuais) no Terraform?',
      options: [
        'terraform validate',
        'terraform plan -detailed-exitcode (exit code 2 indica drift)',
        'terraform fmt',
        'terraform state list'
      ],
      correct: 1,
      explanation: 'terraform plan -detailed-exitcode retorna exit code 2 quando ha diferencas entre o state e a cloud real. Pode ser automatizado no CI/CD para rodar periodicamente e alertar.',
      reference: 'Conceito relacionado: Schedule drift detection no CI (cron) e alerte via Slack/email.'
    },
    {
      question: 'Qual o principal beneficio do Terragrunt?',
      options: [
        'Substituir o HCL por YAML',
        'Eliminar duplicacao (DRY) ao gerenciar multiplos ambientes e modulos com dependencias',
        'Gerar documentacao automatica',
        'Prover interface grafica para Terraform'
      ],
      correct: 1,
      explanation: 'Terragrunt elimina duplicacao: configura backend automaticamente por path, gera providers, gerencia dependencias entre modulos (dependency blocks) e permite inputs hierarquicos.',
      reference: 'Conceito relacionado: Terragrunt usa include/dependency para compor configuracoes hierarquicamente.'
    },
    {
      question: 'O que e o moved block no Terraform?',
      options: [
        'Um bloco para mover arquivos',
        'Um bloco declarativo para refactoring seguro de recursos no state sem recrear',
        'Um bloco para migrar providers',
        'Um bloco para mover modulos entre repos'
      ],
      correct: 1,
      explanation: 'O moved block (Terraform 1.1+) permite renomear ou mover recursos no state de forma declarativa. Em vez de terraform state mv manual, o moved block e commitado no codigo e aplicado automaticamente.',
      reference: 'Conceito relacionado: Import block (Terraform 1.5+) traz recursos existentes para o state via codigo.'
    },
    {
      question: 'Qual a melhor pratica para gerenciar secrets no Terraform?',
      options: [
        'Hardcode no main.tf',
        'Usar data sources para buscar em Secrets Manager/Vault e marcar variaveis como sensitive',
        'Commitar no terraform.tfvars',
        'Usar variaveis de ambiente sem sensitive'
      ],
      correct: 1,
      explanation: 'Secrets devem vir de Secrets Manager, Vault ou SSM Parameter Store via data sources. Variaveis que recebem secrets devem ser marcadas como sensitive = true para esconder do plan output.',
      reference: 'Conceito relacionado: NUNCA commitar secrets no git — use .gitignore para terraform.tfvars.'
    },
    {
      question: 'Qual apply_requirement do Atlantis garante que o PR foi aprovado antes do apply?',
      options: [
        'auto_apply',
        'approved',
        'mergeable',
        'plan_complete'
      ],
      correct: 1,
      explanation: 'apply_requirements: [approved, mergeable] garante que (1) o PR foi aprovado por um reviewer e (2) o PR e mergeavel (sem conflitos, checks passando) antes de permitir atlantis apply.',
      reference: 'Conceito relacionado: Combine com branch protection rules do GitHub para seguranca extra.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os padroes de organizacao de ambientes no Terraform?',
      back: '**1. Workspaces:**\n- Mesmo codigo, states separados\n- terraform workspace new staging\n- Acesso via terraform.workspace\n- Bom para: ambientes similares\n\n**2. Diretorios por ambiente:**\n- Pasta por ambiente com .tfvars diferentes\n- Mais flexivel, mais duplicacao\n\n**3. Terragrunt:**\n- Wrapper DRY sobre Terraform\n- include/dependency para hierarquia\n- Backend automatico por path\n- Bom para: muitos ambientes + modulos\n\n**4. Terraform Cloud:**\n- Workspaces gerenciados na nuvem\n- Policy as Code, RBAC, drift detection'
    },
    {
      front: 'Como funciona o Atlantis?',
      back: '**Fluxo:**\n1. Dev abre PR com mudanca .tf\n2. Atlantis roda terraform plan automaticamente\n3. Plan aparece como comentario no PR\n4. Reviewer analisa e aprova\n5. Dev comenta "atlantis apply"\n6. Atlantis roda terraform apply\n7. PR e merged\n\n**Configuracao:** atlantis.yaml na raiz do repo\n- projects: diretorios e workspaces\n- apply_requirements: approved, mergeable\n- workflows: steps customizados\n\n**Beneficio:** Toda mudanca de infra passa por code review.'
    },
    {
      front: 'Como implementar drift detection automatizado?',
      back: '**Conceito:** Detectar quando recursos foram modificados fora do Terraform.\n\n**Comando:**\nterraform plan -detailed-exitcode\n- Exit 0: sem mudancas\n- Exit 1: erro\n- Exit 2: drift detectado\n\n**Automacao:**\n- GitHub Actions com schedule (cron)\n- Rodar plan periodicamente (diario/semanal)\n- Alertar via Slack/email se exit code = 2\n\n**Terraform Cloud:** Drift detection built-in com alertas automaticos.'
    },
    {
      front: 'Como funciona o Terragrunt?',
      back: '**Terragrunt** = wrapper DRY para Terraform\n\n**Features:**\n- remote_state automatico por path\n- generate para provider/backend\n- include para heranca de config\n- dependency para dependencias entre modulos\n- inputs para passar variaveis\n\n**Estrutura:**\n- terragrunt.hcl raiz (config global)\n- environments/ENV/MODULE/terragrunt.hcl\n- modules/MODULE/*.tf (HCL puro)\n\n**Comando:**\nterragrunt run-all plan (todos os modulos)\nterragrunt apply (modulo especifico)'
    },
    {
      front: 'Quais sao as features do moved block e import block?',
      back: '**moved block (1.1+):**\nRefactoring seguro no state\n\`\`\`hcl\nmoved {\n  from = aws_instance.web\n  to   = aws_instance.app\n}\n\`\`\`\n- Aplicado automaticamente no plan\n- Commitado no codigo\n- Substitui terraform state mv\n\n**import block (1.5+):**\nImportar recursos existentes via codigo\n\`\`\`hcl\nimport {\n  to = aws_s3_bucket.existing\n  id = "my-bucket"\n}\n\`\`\`\n- Substitui terraform import CLI\n- Planificavel e revisavel\n- Pode gerar HCL automaticamente'
    },
    {
      front: 'Como configurar CI/CD para Terraform?',
      back: '**Pipeline tipico:**\n\n**PR (plan):**\n1. terraform init\n2. terraform fmt -check\n3. terraform validate\n4. terraform plan -out=plan.tfplan\n5. Comentar plan no PR\n\n**Merge to main (apply):**\n1. terraform init\n2. terraform apply -auto-approve\n3. (Ambiente protegido com approval)\n\n**Ferramentas:**\n- GitHub Actions + setup-terraform\n- GitLab CI + terraform image\n- Atlantis (plan/apply via PR comments)\n- Terraform Cloud (remote runs)\n- Spacelift, Env0, Scalr'
    },
    {
      front: 'Como gerenciar sensitive data no Terraform?',
      back: '**Variaveis sensitive:**\nvariable "password" {\n  type = string\n  sensitive = true  # Esconde do plan\n}\n\n**Fontes de secrets:**\n- data "aws_secretsmanager_secret_version"\n- data "aws_ssm_parameter"\n- data "vault_generic_secret"\n- Terraform Cloud variables (sensitive)\n\n**Regras:**\n- NUNCA hardcode secrets no HCL\n- NUNCA commitar .tfvars com secrets\n- Usar .gitignore para *.tfvars\n- Outputs sensitive = true\n- State contem secrets — proteger o backend'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar patterns avancados de Terraform: workspaces, CI/CD pipeline e drift detection.',
    objective: 'Aprender a usar workspaces para multiplos ambientes, configurar CI/CD e implementar drift detection.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Configurar Workspaces para multiplos ambientes',
        instruction: `Configure um projeto Terraform com workspaces:
1. Crie um \`main.tf\` que usa \`terraform.workspace\` para determinar instance_type e count
2. Defina locals com maps para dev (1x t3.micro), staging (2x t3.small), production (3x t3.medium)
3. Crie os workspaces dev, staging e production`,
        hints: [
          'Use terraform.workspace como chave dos maps em locals',
          'Maps em locals permitem lookup por workspace name',
          'terraform workspace new NOME cria o workspace'
        ],
        solution: `\`\`\`hcl
# main.tf
locals {
  environment = terraform.workspace

  config = {
    dev = {
      instance_count = 1
      instance_type  = "t3.micro"
    }
    staging = {
      instance_count = 2
      instance_type  = "t3.small"
    }
    production = {
      instance_count = 3
      instance_type  = "t3.medium"
    }
  }

  current = local.config[local.environment]
}

resource "aws_instance" "app" {
  count         = local.current.instance_count
  instance_type = local.current.instance_type
  ami           = data.aws_ami.ubuntu.id

  tags = {
    Name        = "app-\${local.environment}-\${count.index + 1}"
    Environment = local.environment
  }
}
\`\`\`

\`\`\`bash
# Criar workspaces
terraform workspace new dev
terraform workspace new staging
terraform workspace new production

# Verificar
terraform workspace list
\`\`\``,
        verify: `\`\`\`bash
# Listar workspaces
terraform workspace list
# Saida esperada:
#   default
#   dev
# * staging  (ou o workspace ativo)
#   production

# Verificar workspace ativo
terraform workspace show
# Saida esperada: nome do workspace ativo

# Planejar em cada workspace
terraform workspace select staging
terraform plan
# Saida esperada: 2 instancias t3.small
\`\`\``
      },
      {
        title: 'Criar configuracao Atlantis',
        instruction: `Crie um \`atlantis.yaml\` com:
1. Dois projetos: networking (dir: infra/networking) e eks (dir: infra/eks)
2. Ambos com autoplan habilitado para mudancas em *.tf e *.tfvars
3. apply_requirements: approved e mergeable
4. Workflow customizado que inclui fmt -check e validate antes do plan`,
        hints: [
          'version: 3 e a versao atual do atlantis.yaml',
          'autoplan.when_modified aceita glob patterns',
          'workflows.custom.plan.steps define a sequencia de comandos'
        ],
        solution: `\`\`\`yaml
# atlantis.yaml
version: 3
projects:
  - name: networking
    dir: infra/networking
    workspace: production
    terraform_version: v1.7.0
    autoplan:
      when_modified:
        - "*.tf"
        - "*.tfvars"
      enabled: true
    apply_requirements:
      - approved
      - mergeable
    workflow: validated

  - name: eks
    dir: infra/eks
    workspace: production
    terraform_version: v1.7.0
    autoplan:
      when_modified:
        - "*.tf"
        - "*.tfvars"
      enabled: true
    apply_requirements:
      - approved
      - mergeable
    workflow: validated

workflows:
  validated:
    plan:
      steps:
        - init
        - run: terraform fmt -check -recursive
        - run: terraform validate
        - plan
    apply:
      steps:
        - apply
\`\`\``,
        verify: `\`\`\`bash
# Verificar estrutura do atlantis.yaml
cat atlantis.yaml | grep -E "name:|dir:|apply_requirements:"
# Saida esperada:
# name: networking
# dir: infra/networking
# apply_requirements: approved, mergeable
# name: eks
# dir: infra/eks
# apply_requirements: approved, mergeable

# Verificar workflow customizado
cat atlantis.yaml | grep -E "workflow:|steps:" | head -5
# Saida esperada: workflow validated com steps de fmt, validate, plan
\`\`\``
      },
      {
        title: 'Implementar drift detection com GitHub Actions',
        instruction: `Crie um workflow \`.github/workflows/drift-detection.yml\` que:
1. Roda de segunda a sexta as 8h UTC (cron schedule)
2. Executa terraform plan -detailed-exitcode
3. Se drift for detectado (exit code 2), cria uma issue no GitHub alertando`,
        hints: [
          'Use schedule com cron no GitHub Actions',
          'continue-on-error: true permite capturar o exit code sem falhar o job',
          'actions/github-script pode criar issues programaticamente'
        ],
        solution: `\`\`\`yaml
# .github/workflows/drift-detection.yml
name: Terraform Drift Detection

on:
  schedule:
    - cron: '0 8 * * 1-5'
  workflow_dispatch: {}

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: '1.7.0'

      - name: Terraform Init
        run: terraform init
        working-directory: infrastructure

      - name: Check for Drift
        id: plan
        run: terraform plan -detailed-exitcode -no-color -out=drift.tfplan 2>&1 | tee drift-output.txt
        working-directory: infrastructure
        continue-on-error: true

      - name: Create Issue on Drift
        if: steps.plan.outcome == 'failure'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const output = fs.readFileSync('infrastructure/drift-output.txt', 'utf8');
            const truncated = output.substring(0, 3000);
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Terraform Drift Detected',
              body: '## Drift detected\\n\\nResources were modified outside of Terraform.\\n\\n<details>\\n<summary>Plan Output</summary>\\n\\n' + truncated + '\\n\\n</details>',
              labels: ['infrastructure', 'drift']
            });
\`\`\``,
        verify: `\`\`\`bash
# Verificar estrutura do workflow
cat .github/workflows/drift-detection.yml | grep -E "cron:|detailed-exitcode|Create Issue"
# Saida esperada:
# - cron: '0 8 * * 1-5'
# terraform plan -detailed-exitcode
# Create Issue on Drift

# Verificar que o workflow e valido
# GitHub valida automaticamente ao fazer push
# Ou usar: actionlint .github/workflows/drift-detection.yml
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Workspace errado causa destruicao de recursos de producao',
      difficulty: 'hard',
      symptom: 'Um terraform destroy ou apply foi executado no workspace errado, afetando recursos de producao em vez de dev/staging.',
      diagnosis: `\`\`\`bash
# 1. Verificar workspace atual IMEDIATAMENTE
terraform workspace show
# Se mostra "production" quando deveria ser "dev" — houve erro

# 2. Verificar o que foi alterado
terraform state list
# Listar recursos no state atual

# 3. Verificar logs de execucao
# Se usando CI/CD, verificar pipeline logs
# Se usando Atlantis, verificar comentarios no PR

# 4. Verificar se os recursos ainda existem
aws ec2 describe-instances --filters "Name=tag:Environment,Values=production"
\`\`\``,
      solution: `**Acoes imediatas:**

1. **Se recursos foram destruidos:** Restaurar via backup (snapshots, versioning S3, RDS automated backups). Rodar terraform apply no workspace correto para recriar.

2. **Se apply esta em andamento:** Cancelar imediatamente (Ctrl+C). O Terraform tentara rollback do recurso atual.

**Prevencao:**

1. **Prompt de confirmacao:** Nunca usar -auto-approve em producao manualmente.

2. **Protecao de workspace:** Usar prevent_destroy em recursos criticos de producao.

3. **CI/CD com aprovacao:** Atlantis com apply_requirements: [approved] garante revisao.

4. **Separacao de state:** Usar Terragrunt com diretorios separados em vez de workspaces (mais seguro).

5. **AWS SCP:** Proteger recursos criticos com Service Control Policies.`
    },
    {
      title: 'Terragrunt dependency falha com "output not found"',
      difficulty: 'medium',
      symptom: 'Ao rodar terragrunt plan no modulo EKS, o erro "output not found in dependency vpc" aparece. O modulo VPC esta configurado como dependency.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o modulo VPC foi aplicado
cd ../vpc && terragrunt output
# Deve listar os outputs disponeiveis

# 2. Verificar o nome do output no dependency
# No eks/terragrunt.hcl:
# dependency.vpc.outputs.vpc_id
# Verificar se o output se chama exatamente "vpc_id" no modulo VPC

# 3. Verificar se o state do VPC existe
ls -la ../vpc/.terragrunt-cache/

# 4. Verificar o dependency block
cat terragrunt.hcl | grep -A5 "dependency"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Modulo VPC nunca foi aplicado:** Rodar terragrunt apply primeiro no modulo VPC. Use terragrunt run-all apply para aplicar na ordem correta.

2. **Nome do output incorreto:** Verificar que o output no modulo VPC (outputs.tf) tem exatamente o mesmo nome usado no dependency.vpc.outputs.NOME.

3. **Path do dependency incorreto:** config_path deve apontar para o diretorio do terragrunt.hcl do VPC, nao para o modulo Terraform.

4. **Mock outputs para plan:** Adicionar mock_outputs no dependency block para permitir plan sem apply previo:
dependency "vpc" {
  config_path = "../vpc"
  mock_outputs = {
    vpc_id = "vpc-mock"
    private_subnet_ids = ["subnet-mock"]
  }
}`
    },
    {
      title: 'Atlantis plan mostra diff mas apply falha com permissao',
      difficulty: 'hard',
      symptom: 'O terraform plan no Atlantis executa com sucesso e mostra as mudancas, mas ao comentar "atlantis apply", falha com erro de permissao IAM.',
      diagnosis: `\`\`\`bash
# 1. Verificar logs do Atlantis server
kubectl logs -n atlantis deploy/atlantis | grep -i "error" | tail -20

# 2. Verificar IAM role do Atlantis
# O Atlantis pode usar uma role diferente para plan vs apply
# Ou a role pode ter permissao de read mas nao de write

# 3. Verificar AWS STS identity
# No servidor Atlantis:
aws sts get-caller-identity

# 4. Verificar se o erro menciona recurso especifico
# Pode ser que a role tem permissao para a maioria dos recursos
# mas falta permissao para um tipo especifico (ex: IAM, KMS)
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Role com permissao read-only:** terraform plan so precisa de read, mas apply precisa de write/create/delete. A IAM role do Atlantis precisa de permissoes completas para os recursos gerenciados.

2. **SCP ou Permission Boundary:** AWS Service Control Policies ou Permission Boundaries podem bloquear acoes mesmo com IAM policy permitindo. Verificar no AWS Organizations.

3. **Recurso IAM:** Criar/modificar roles IAM requer permissoes IAM especificas (iam:CreateRole, etc.) que podem estar bloqueadas por seguranca.

4. **KMS ou recursos com resource-based policy:** Alguns recursos (KMS keys, S3 com bucket policy) requerem permissao tanto na IAM policy quanto no resource policy.

5. **Assume role expirado:** Se o Atlantis usa assume role, o token pode expirar durante um apply longo. Aumentar MaxSessionDuration da role.`
    }
  ]
};
