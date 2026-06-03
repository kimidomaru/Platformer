window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['iac/terraform-patterns'] = {
  theory: `
# Terraform Advanced Patterns

## Relevance
Beyond fundamentals, mastering advanced Terraform patterns is essential for operating infrastructure at scale. Workspaces, remote state, Atlantis, Terragrunt, CI/CD pipelines, and drift detection are practices that distinguish mature operations from ad-hoc.

## Fundamental Concepts

### Workspaces

Workspaces allow using the same HCL code for multiple environments with separate states:

\`\`\`bash
# Create and list workspaces
terraform workspace new staging
terraform workspace new production
terraform workspace list
terraform workspace select staging
terraform workspace show
\`\`\`

\`\`\`hcl
# Use workspace in code
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

**Workspace Limitations:**
- Same backend for all workspaces
- Does not support different provider configs per workspace
- Alternative: directory per environment with Terragrunt

### Terragrunt — DRY Terraform

Terragrunt is a wrapper for Terraform that reduces duplication:

\`\`\`
# Structure with Terragrunt
infra/
  terragrunt.hcl           # Root config (backend, provider)
  environments/
    dev/
      terragrunt.hcl       # include root + dev vars
      vpc/
        terragrunt.hcl     # vpc module with dev inputs
      eks/
        terragrunt.hcl     # eks module with dev inputs
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
# terragrunt.hcl (root)
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

### Atlantis — GitOps for Terraform

Atlantis is a server that executes terraform plan/apply via Pull Requests:

\`\`\`
Atlantis Flow:
1. Dev opens PR with .tf change
2. Atlantis detects and runs terraform plan
3. Plan appears as comment on PR
4. Reviewer analyzes the plan
5. Dev comments "atlantis apply"
6. Atlantis executes terraform apply
7. PR is merged
\`\`\`

\`\`\`yaml
# atlantis.yaml — at repo root
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

### CI/CD Pipeline for Terraform

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

jobs:
  plan:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init
      - run: terraform fmt -check -recursive
      - run: terraform validate
      - run: terraform plan -no-color -out=plan.tfplan

  apply:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init
      - run: terraform apply -auto-approve
\`\`\`

### Drift Detection

\`\`\`bash
# Detect drift manually
terraform plan -detailed-exitcode
# Exit code 0 = no changes
# Exit code 1 = error
# Exit code 2 = changes detected (drift!)
\`\`\`

\`\`\`yaml
# Drift detection via GitHub Actions (scheduled)
name: Terraform Drift Detection
on:
  schedule:
    - cron: '0 8 * * 1-5'  # Mon-Fri at 8am

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - name: Check for Drift
        id: plan
        run: terraform plan -detailed-exitcode -no-color
        continue-on-error: true
      - name: Alert on Drift
        if: steps.plan.outcome == 'failure'
        run: echo "DRIFT DETECTED! Send alert..."
\`\`\`

### Advanced Modules

\`\`\`hcl
# Moved block for safe refactoring
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
# Mark variables as sensitive
variable "db_password" {
  type      = string
  sensitive = true
}

# Use Secrets Manager
data "aws_secretsmanager_secret_version" "db" {
  secret_id = "production/database/password"
}

resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db.secret_string
}
\`\`\`

### Common Mistakes in Advanced Patterns

1. **Workspace sprawl** — too many workspaces without governance
2. **Terragrunt overengineering** — using Terragrunt when workspaces suffice
3. **CI/CD without plan review** — apply without human review of plan
4. **No drift detection** — manually modified resources without alerting
5. **Overly generic modules** — modules that try to solve everything become complex
6. **No testing** — not testing modules with Terratest or terraform test

## Killer.sh Style Challenge

> **Scenario:** Configure a complete CI/CD pipeline for Terraform with: (1) automatic plan on PRs, (2) apply after approval and merge, (3) weekly drift detection with Slack alerts, (4) Terragrunt to manage 3 environments.
`,
  quiz: [
    {
      question: 'What are Terraform Workspaces?',
      options: [
        'Project directories',
        'Isolated states that allow using the same HCL code for multiple environments',
        'Separate Git repositories',
        'Provider plugins'
      ],
      correct: 1,
      explanation: 'Workspaces create separate states within the same backend, allowing use of the same code for dev, staging, and production. The current workspace is accessible via terraform.workspace.',
      reference: 'Related concept: For very different configurations between environments, consider Terragrunt.'
    },
    {
      question: 'What is the main benefit of Atlantis for Terraform?',
      options: [
        'Replace the Terraform CLI',
        'Execute plan/apply via Pull Requests with code review before apply',
        'Manage secrets',
        'Create modules automatically'
      ],
      correct: 1,
      explanation: 'Atlantis integrates Terraform with Git: automatic plan on PRs, plan visible as comment, apply via PR command after approval. Ensures all infra changes go through code review.',
      reference: 'Related concept: apply_requirements: approved + mergeable ensures review before apply.'
    },
    {
      question: 'How to detect drift (manual changes) in Terraform?',
      options: [
        'terraform validate',
        'terraform plan -detailed-exitcode (exit code 2 indicates drift)',
        'terraform fmt',
        'terraform state list'
      ],
      correct: 1,
      explanation: 'terraform plan -detailed-exitcode returns exit code 2 when there are differences between the state and real cloud. Can be automated in CI/CD to run periodically and alert.',
      reference: 'Related concept: Schedule drift detection in CI (cron) and alert via Slack/email.'
    },
    {
      question: 'What is the main benefit of Terragrunt?',
      options: [
        'Replace HCL with YAML',
        'Eliminate duplication (DRY) when managing multiple environments and modules with dependencies',
        'Generate automatic documentation',
        'Provide GUI for Terraform'
      ],
      correct: 1,
      explanation: 'Terragrunt eliminates duplication: configures backend automatically by path, generates providers, manages dependencies between modules (dependency blocks), and allows hierarchical inputs.',
      reference: 'Related concept: Terragrunt uses include/dependency to compose configurations hierarchically.'
    },
    {
      question: 'What is the moved block in Terraform?',
      options: [
        'A block to move files',
        'A declarative block for safe resource refactoring in state without recreation',
        'A block to migrate providers',
        'A block to move modules between repos'
      ],
      correct: 1,
      explanation: 'The moved block (Terraform 1.1+) allows renaming or moving resources in state declaratively. Instead of manual terraform state mv, the moved block is committed in code and applied automatically.',
      reference: 'Related concept: Import block (Terraform 1.5+) brings existing resources into state via code.'
    },
    {
      question: 'What is the best practice for managing secrets in Terraform?',
      options: [
        'Hardcode in main.tf',
        'Use data sources to fetch from Secrets Manager/Vault and mark variables as sensitive',
        'Commit in terraform.tfvars',
        'Use environment variables without sensitive'
      ],
      correct: 1,
      explanation: 'Secrets should come from Secrets Manager, Vault, or SSM Parameter Store via data sources. Variables receiving secrets should be marked sensitive = true to hide from plan output.',
      reference: 'Related concept: NEVER commit secrets to git — use .gitignore for terraform.tfvars.'
    },
    {
      question: 'Which Atlantis apply_requirement ensures PR was approved before apply?',
      options: [
        'auto_apply',
        'approved',
        'mergeable',
        'plan_complete'
      ],
      correct: 1,
      explanation: 'apply_requirements: [approved, mergeable] ensures (1) PR was approved by a reviewer and (2) PR is mergeable (no conflicts, checks passing) before allowing atlantis apply.',
      reference: 'Related concept: Combine with GitHub branch protection rules for extra security.'
    }
  ],
  flashcards: [
    {
      front: 'What are the patterns for organizing environments in Terraform?',
      back: '**1. Workspaces:**\n- Same code, separate states\n- terraform workspace new staging\n- Access via terraform.workspace\n- Good for: similar environments\n\n**2. Directories per environment:**\n- Folder per env with different .tfvars\n- More flexible, more duplication\n\n**3. Terragrunt:**\n- DRY wrapper over Terraform\n- include/dependency for hierarchy\n- Automatic backend by path\n- Good for: many envs + modules\n\n**4. Terraform Cloud:**\n- Cloud-managed workspaces\n- Policy as Code, RBAC, drift detection'
    },
    {
      front: 'How does Atlantis work?',
      back: '**Flow:**\n1. Dev opens PR with .tf change\n2. Atlantis runs terraform plan automatically\n3. Plan appears as PR comment\n4. Reviewer analyzes and approves\n5. Dev comments "atlantis apply"\n6. Atlantis runs terraform apply\n7. PR is merged\n\n**Config:** atlantis.yaml at repo root\n- projects: directories and workspaces\n- apply_requirements: approved, mergeable\n- workflows: custom steps\n\n**Benefit:** All infra changes go through code review.'
    },
    {
      front: 'How to implement automated drift detection?',
      back: '**Concept:** Detect when resources were modified outside Terraform.\n\n**Command:**\nterraform plan -detailed-exitcode\n- Exit 0: no changes\n- Exit 1: error\n- Exit 2: drift detected\n\n**Automation:**\n- GitHub Actions with schedule (cron)\n- Run plan periodically (daily/weekly)\n- Alert via Slack/email if exit code = 2\n\n**Terraform Cloud:** Built-in drift detection with automatic alerts.'
    },
    {
      front: 'How does Terragrunt work?',
      back: '**Terragrunt** = DRY wrapper for Terraform\n\n**Features:**\n- Automatic remote_state by path\n- generate for provider/backend\n- include for config inheritance\n- dependency for inter-module dependencies\n- inputs to pass variables\n\n**Structure:**\n- Root terragrunt.hcl (global config)\n- environments/ENV/MODULE/terragrunt.hcl\n- modules/MODULE/*.tf (pure HCL)\n\n**Commands:**\nterragrunt run-all plan (all modules)\nterragrunt apply (specific module)'
    },
    {
      front: 'What are the features of moved block and import block?',
      back: '**moved block (1.1+):**\nSafe state refactoring\n- Renames/moves resources in state\n- Applied automatically in plan\n- Committed in code\n- Replaces terraform state mv\n\n**import block (1.5+):**\nImport existing resources via code\n- Replaces terraform import CLI\n- Plannable and reviewable\n- Can auto-generate HCL\n\nBoth are declarative and version-controlled, unlike their CLI counterparts.'
    },
    {
      front: 'How to configure CI/CD for Terraform?',
      back: '**Typical pipeline:**\n\n**PR (plan):**\n1. terraform init\n2. terraform fmt -check\n3. terraform validate\n4. terraform plan -out=plan.tfplan\n5. Comment plan on PR\n\n**Merge to main (apply):**\n1. terraform init\n2. terraform apply -auto-approve\n3. (Protected environment with approval)\n\n**Tools:**\n- GitHub Actions + setup-terraform\n- GitLab CI + terraform image\n- Atlantis (plan/apply via PR comments)\n- Terraform Cloud (remote runs)\n- Spacelift, Env0, Scalr'
    },
    {
      front: 'How to manage sensitive data in Terraform?',
      back: '**Sensitive variables:**\nvariable "password" {\n  type = string\n  sensitive = true\n}\n\n**Secret sources:**\n- data "aws_secretsmanager_secret_version"\n- data "aws_ssm_parameter"\n- data "vault_generic_secret"\n- Terraform Cloud variables (sensitive)\n\n**Rules:**\n- NEVER hardcode secrets in HCL\n- NEVER commit .tfvars with secrets\n- Use .gitignore for *.tfvars\n- Outputs sensitive = true\n- State contains secrets — protect the backend'
    }
  ],
  lab: {
    scenario: 'You need to configure advanced Terraform patterns: workspaces, CI/CD pipeline, and drift detection.',
    objective: 'Learn to use workspaces for multiple environments, configure CI/CD, and implement drift detection.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Configure Workspaces for multiple environments',
        instruction: `Configure a Terraform project with workspaces:
1. Create a \`main.tf\` that uses \`terraform.workspace\` to determine instance_type and count
2. Define locals with maps for dev (1x t3.micro), staging (2x t3.small), production (3x t3.medium)
3. Create dev, staging, and production workspaces`,
        hints: [
          'Use terraform.workspace as key for maps in locals',
          'Maps in locals allow lookup by workspace name',
          'terraform workspace new NAME creates the workspace'
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
terraform workspace new dev
terraform workspace new staging
terraform workspace new production
\`\`\``,
        verify: `\`\`\`bash
# List workspaces
terraform workspace list
# Expected output:
#   default
#   dev
# * staging
#   production

# Check active workspace
terraform workspace show

# Plan in each workspace
terraform workspace select staging
terraform plan
# Expected output: 2 instances t3.small
\`\`\``
      },
      {
        title: 'Create Atlantis configuration',
        instruction: `Create an \`atlantis.yaml\` with:
1. Two projects: networking (dir: infra/networking) and eks (dir: infra/eks)
2. Both with autoplan enabled for changes in *.tf and *.tfvars
3. apply_requirements: approved and mergeable
4. Custom workflow including fmt -check and validate before plan`,
        hints: [
          'version: 3 is the current atlantis.yaml version',
          'autoplan.when_modified accepts glob patterns',
          'workflows.custom.plan.steps defines the command sequence'
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
# Verify atlantis.yaml structure
cat atlantis.yaml | grep -E "name:|dir:|apply_requirements:"
# Expected output: both projects with approved+mergeable requirements

# Verify custom workflow
cat atlantis.yaml | grep -E "workflow:|steps:"
# Expected output: validated workflow with fmt, validate, plan steps
\`\`\``
      },
      {
        title: 'Implement drift detection with GitHub Actions',
        instruction: `Create a workflow \`.github/workflows/drift-detection.yml\` that:
1. Runs Monday through Friday at 8am UTC (cron schedule)
2. Executes terraform plan -detailed-exitcode
3. If drift is detected (exit code 2), creates a GitHub issue alerting the team`,
        hints: [
          'Use schedule with cron in GitHub Actions',
          'continue-on-error: true allows capturing exit code without failing the job',
          'actions/github-script can create issues programmatically'
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
        run: terraform plan -detailed-exitcode -no-color 2>&1 | tee drift.txt
        working-directory: infrastructure
        continue-on-error: true

      - name: Create Issue on Drift
        if: steps.plan.outcome == 'failure'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const output = fs.readFileSync('infrastructure/drift.txt', 'utf8').substring(0, 3000);
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Terraform Drift Detected',
              body: '## Drift detected\\n\\n' + output,
              labels: ['infrastructure', 'drift']
            });
\`\`\``,
        verify: `\`\`\`bash
# Verify workflow structure
cat .github/workflows/drift-detection.yml | grep -E "cron:|detailed-exitcode|Create Issue"
# Expected output:
# - cron: '0 8 * * 1-5'
# terraform plan -detailed-exitcode
# Create Issue on Drift
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Wrong workspace causes destruction of production resources',
      difficulty: 'hard',
      symptom: 'A terraform destroy or apply was executed in the wrong workspace, affecting production resources instead of dev/staging.',
      diagnosis: `\`\`\`bash
# 1. Check current workspace IMMEDIATELY
terraform workspace show
# If it shows "production" when it should be "dev" — error occurred

# 2. Check what was changed
terraform state list

# 3. Check execution logs
# If using CI/CD, check pipeline logs
# If using Atlantis, check PR comments

# 4. Check if resources still exist
aws ec2 describe-instances --filters "Name=tag:Environment,Values=production"
\`\`\``,
      solution: `**Immediate actions:**

1. **If resources were destroyed:** Restore via backup (snapshots, S3 versioning, RDS automated backups). Run terraform apply in the correct workspace to recreate.

2. **If apply is in progress:** Cancel immediately (Ctrl+C). Terraform will attempt rollback of the current resource.

**Prevention:**

1. **Confirmation prompt:** Never use -auto-approve in production manually.

2. **Workspace protection:** Use prevent_destroy on critical production resources.

3. **CI/CD with approval:** Atlantis with apply_requirements: [approved] ensures review.

4. **State separation:** Use Terragrunt with separate directories instead of workspaces (safer).

5. **AWS SCP:** Protect critical resources with Service Control Policies.`
    },
    {
      title: 'Terragrunt dependency fails with "output not found"',
      difficulty: 'medium',
      symptom: 'When running terragrunt plan on the EKS module, the error "output not found in dependency vpc" appears. The VPC module is configured as a dependency.',
      diagnosis: `\`\`\`bash
# 1. Check if VPC module was applied
cd ../vpc && terragrunt output
# Should list available outputs

# 2. Check output name in dependency
# In eks/terragrunt.hcl: dependency.vpc.outputs.vpc_id
# Verify output is named exactly "vpc_id" in VPC module

# 3. Check if VPC state exists
ls -la ../vpc/.terragrunt-cache/

# 4. Check dependency block
cat terragrunt.hcl | grep -A5 "dependency"
\`\`\``,
      solution: `**Causes and solutions:**

1. **VPC module never applied:** Run terragrunt apply first on the VPC module. Use terragrunt run-all apply to apply in correct order.

2. **Incorrect output name:** Verify the output in the VPC module (outputs.tf) has exactly the same name used in dependency.vpc.outputs.NAME.

3. **Incorrect dependency path:** config_path should point to the directory of the VPC terragrunt.hcl, not the Terraform module.

4. **Mock outputs for plan:** Add mock_outputs in the dependency block to allow plan without prior apply:
dependency "vpc" {
  config_path = "../vpc"
  mock_outputs = {
    vpc_id = "vpc-mock"
    private_subnet_ids = ["subnet-mock"]
  }
}`
    },
    {
      title: 'Atlantis plan shows diff but apply fails with permission error',
      difficulty: 'hard',
      symptom: 'The terraform plan in Atlantis executes successfully and shows changes, but when commenting "atlantis apply", it fails with an IAM permission error.',
      diagnosis: `\`\`\`bash
# 1. Check Atlantis server logs
kubectl logs -n atlantis deploy/atlantis | grep -i "error" | tail -20

# 2. Check Atlantis IAM role
# Atlantis may use different roles for plan vs apply

# 3. Check AWS STS identity on Atlantis server
aws sts get-caller-identity

# 4. Check if error mentions specific resource
# Role may have permission for most resources
# but missing permission for a specific type (e.g., IAM, KMS)
\`\`\``,
      solution: `**Causes and solutions:**

1. **Read-only role:** terraform plan only needs read, but apply needs write/create/delete. The Atlantis IAM role needs full permissions for managed resources.

2. **SCP or Permission Boundary:** AWS Service Control Policies or Permission Boundaries may block actions even with IAM policy allowing. Check in AWS Organizations.

3. **IAM resource:** Creating/modifying IAM roles requires specific IAM permissions (iam:CreateRole, etc.) that may be blocked for security.

4. **KMS or resources with resource-based policy:** Some resources (KMS keys, S3 with bucket policy) require permission in both IAM policy and resource policy.

5. **Expired assume role:** If Atlantis uses assume role, the token may expire during a long apply. Increase MaxSessionDuration of the role.`
    }
  ]
};
