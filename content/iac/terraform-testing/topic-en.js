window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['iac/terraform-testing'] = {
  theory: `# Terraform Testing & Quality Gates

## Relevance
> Testing infrastructure as code is the differentiator between amateur and professional IaC. Checkov, tflint, Terratest, and the native Terraform testing framework appear in senior Platform/DevOps interviews.

## IaC Testing Pyramid

\`\`\`
            ╔═══════════════╗
            ║   E2E Tests   ║  (Terratest — slow, costly, complete)
           ╔╩═══════════════╩╗
           ║ Integration Tests║  (terraform test — real resources)
          ╔╩═════════════════╩╗
          ║   Static Analysis  ║  (tflint, checkov, tfsec — fast, no infra)
         ╔╩═══════════════════╩╗
         ║    Format & Validate ║  (terraform fmt, validate — instant)
         ╚═════════════════════╝
\`\`\`

## 1. Formatting and Validation (fastest)

\`\`\`bash
# Check formatting (executes nothing)
terraform fmt -check -recursive

# Fix formatting automatically
terraform fmt -recursive

# Validate syntax and references (without accessing provider)
terraform validate

# Integrate in pre-commit hook
cat > .pre-commit-config.yaml << 'EOF'
repos:
  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.83.0
    hooks:
      - id: terraform_fmt
      - id: terraform_validate
      - id: terraform_tflint
      - id: terraform_checkov
EOF
\`\`\`

## 2. Static Analysis with tflint

\`\`\`bash
# Install tflint
curl -s https://raw.githubusercontent.com/terraform-linters/tflint/master/install_linux.sh | bash

# Configuration (.tflint.hcl)
cat > .tflint.hcl << 'EOF'
plugin "aws" {
  enabled = true
  version = "0.27.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

rule "terraform_deprecated_interpolation" { enabled = true }
rule "terraform_unused_declarations" { enabled = true }
rule "terraform_naming_convention" {
  enabled = true
  variable {
    format = "snake_case"
  }
}
EOF

# Run
tflint --chdir=./modules/eks
tflint --recursive  # all modules
\`\`\`

## 3. Security Scanning with Checkov

\`\`\`bash
# Install
pip install checkov

# Security scan (checks 1000+ rules)
checkov -d ./modules/

# Scan specific file
checkov -f main.tf

# Skip specific checks (justification required)
# In Terraform code:
resource "aws_s3_bucket" "logs" {
  # checkov:skip=CKV_AWS_18:Logging intentionally disabled on this log bucket
  bucket = "my-log-bucket"
}

# Generate SARIF report (for GitHub Security)
checkov -d . --output sarif --output-file results.sarif

# Integrate in CI/CD
checkov -d . --soft-fail  # does not fail pipeline (only reports)
checkov -d . --hard-fail-on CRITICAL  # fails only on CRITICAL
\`\`\`

## 4. Terraform Test (Native Framework — Terraform >= 1.6)

\`\`\`hcl
# tests/main.tftest.hcl
run "basic_deployment" {
  command = plan    # or apply (creates real resources)

  variables {
    environment  = "test"
    instance_type = "t3.micro"
    min_size      = 1
    max_size      = 3
  }

  assert {
    condition     = aws_autoscaling_group.main.min_size == 1
    error_message = "ASG min_size must be 1 in test environment"
  }

  assert {
    condition     = aws_autoscaling_group.main.max_size <= 3
    error_message = "ASG max_size cannot exceed 3 in test environment"
  }
}

run "security_validation" {
  command = plan

  assert {
    condition     = !aws_instance.web.associate_public_ip_address
    error_message = "Production instances must not have a public IP"
  }

  assert {
    condition = contains(
      aws_security_group.web.ingress[*].from_port,
      443
    )
    error_message = "Security group must allow HTTPS (443)"
  }
}
\`\`\`

\`\`\`bash
# Run tests
terraform test

# Run only plan tests (without creating resources)
terraform test -filter=run.basic_deployment
\`\`\`

## 5. Integration Tests with Terratest (Go)

\`\`\`go
// test/vpc_test.go
package test

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/gruntwork-io/terratest/modules/aws"
    "github.com/stretchr/testify/assert"
)

func TestVPCModule(t *testing.T) {
    t.Parallel()

    terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
        TerraformDir: "../modules/vpc",
        Vars: map[string]interface{}{
            "environment": "test",
            "cidr_block":  "10.99.0.0/16",
        },
        // Use sandbox AWS account
    })

    // Destroy at the end of the test
    defer terraform.Destroy(t, terraformOptions)

    // Apply the module
    terraform.InitAndApply(t, terraformOptions)

    // Validate outputs
    vpcId := terraform.Output(t, terraformOptions, "vpc_id")
    assert.NotEmpty(t, vpcId)

    // Validate AWS resources directly
    vpc := aws.GetVpcById(t, vpcId, "us-east-1")
    assert.Equal(t, "10.99.0.0/16", aws.GetCidrBlockOfVpc(t, vpc))

    // Validate created subnets
    subnets := aws.GetSubnetsForVpc(t, vpcId, "us-east-1")
    assert.Equal(t, 3, len(subnets))
}
\`\`\`

\`\`\`bash
# Run Go tests
cd test && go test -v -timeout 30m -run TestVPCModule
\`\`\`

## CI/CD Pipeline with Quality Gates

\`\`\`yaml
# .github/workflows/terraform-quality.yml
name: Terraform Quality Gates
on: [pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Format Check
        run: terraform fmt -check -recursive

      - name: Validate
        run: |
          terraform init -backend=false
          terraform validate

      - name: tflint
        uses: terraform-linters/setup-tflint@v4
        with:
          tflint_version: v0.50.0
      - run: tflint --recursive

      - name: Checkov Security Scan
        uses: bridgecrewio/checkov-action@v12
        with:
          directory: .
          hard_fail_on: CRITICAL
          output_format: sarif
          output_file_path: results.sarif

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif

      - name: Terraform Test (native)
        run: terraform test
        if: github.event_name == 'pull_request'
\`\`\`

## Common Mistakes

1. **Testing only the plan, never apply**: plans pass but apply can fail due to permissions, quotas, conflicts.
2. **No destroy tests**: testing only creation, but destroy may have unmapped dependencies.
3. **Production account in tests**: testing in production due to lack of sandbox → potential disaster.
4. **Ignoring all Checkov checks**: checkov:skip without justification → accumulates security debt.
`,

  quiz: [
    {
      question: 'What is the difference between `terraform validate` and `terraform plan` in terms of verification?',
      options: [
        'Both query the AWS/Azure provider to check permissions',
        'validate checks syntax and references without accessing the provider; plan executes against the provider and shows real changes',
        'validate creates a saved plan; plan executes immediately',
        'There is no difference — validate and plan perform the same verification'
      ],
      correct: 1,
      explanation: 'terraform validate checks only HCL syntax and internal references (variables exist, correct types) without initializing providers or accessing remote APIs. It is instant and works without credentials. terraform plan queries the provider, reads the remote state, and calculates the necessary changes — requires credentials and access to the backend.',
      reference: 'Formatting and Validation section — validate is ideal for pre-commit hooks because it is fast and has no external dependencies.'
    },
    {
      question: 'Which static analysis tool for Terraform checks security issues such as S3 buckets without encryption or overly permissive security groups?',
      options: [
        'tflint',
        'terraform validate',
        'Checkov',
        'terraform fmt'
      ],
      correct: 2,
      explanation: 'Checkov is a static security scanner that checks 1000+ security and compliance rules in Terraform, CloudFormation, ARM, and other IaC formats. It identifies: S3 buckets without encryption, security groups with 0.0.0.0/0, instances without IMDSv2, etc. tflint checks best practices and syntax errors, but does not focus on security.',
      reference: 'Security Scanning section — integrate Checkov in CI/CD with --hard-fail-on CRITICAL.'
    },
    {
      question: 'What is the purpose of the `terraform test` framework (native to Terraform >= 1.6)?',
      options: [
        'To completely replace Terratest and all integration tests',
        'To run assertions on the plan or apply of Terraform modules within .tftest.hcl files',
        'To only test the format and syntax of Terraform code',
        'To automatically generate compliance reports'
      ],
      correct: 1,
      explanation: 'The native terraform test framework (Terraform >= 1.6) runs .tftest.hcl files that define runs with variables and assert blocks. It can run in plan mode (without creating resources) or apply mode (creates and destroys test resources). It is simpler than Terratest (Go) but less flexible — ideal for unit tests of modules, leaving Terratest for complex integration testing.',
      reference: 'Terraform Test section — use command = plan for fast, cost-free tests; apply for full validation.'
    }
  ],

  flashcards: [
    {
      front: 'What is the testing pyramid for Terraform infrastructure?',
      back: '**Base (fastest, no cost)**:\n1. `terraform fmt -check` → formatting\n2. `terraform validate` → syntax and references\n\n**Static analysis (without creating resources)**:\n3. `tflint` → best practices and errors\n4. `checkov` → security and compliance\n\n**Module tests**:\n5. `terraform test` (native >= 1.6) → assertions on plan/apply\n\n**Top (slow, costly, complete)**:\n6. Terratest (Go) → integration tests with real resources\n\nRun lower layers on PR; top only on release branches.'
    },
    {
      front: 'How do you skip a Checkov check with justification in Terraform code?',
      back: '```hcl\nresource "aws_s3_bucket" "public-assets" {\n  # checkov:skip=CKV_AWS_20:Public assets bucket - requires anonymous read access\n  # checkov:skip=CKV_AWS_18:Logging not needed for static assets\n  bucket = "company-public-cdn-assets"\n}\n```\n\nFormat: `# checkov:skip=CHECK_ID:justification`\n\n**Never** skip without justification — it accumulates security debt and loses traceability of decisions.'
    }
  ],

  lab: {
    scenario: 'Set up a quality pipeline for a Terraform module with fmt, validate, tflint, and checkov.',
    objective: 'Implement quality gates that block insecure or malformatted code before merge.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create a Terraform module with intentional problems',
        instruction: 'Create a simple module with some formatting and security issues for the scanners to find.',
        hints: ['Wrong indentation will be detected by fmt', 'S3 without versioning will be detected by checkov'],
        solution: `\`\`\`bash
mkdir -p terraform-quality-demo/modules/storage
cd terraform-quality-demo/modules/storage

# main.tf with intentional problems
cat > main.tf << 'EOF'
variable "bucket_name" {
  description = "S3 bucket name"
  type = string
}

resource "aws_s3_bucket" "main" {
bucket = var.bucket_name   # wrong formatting (no indentation)
}

# No versioning, no encryption — security issues
EOF

# outputs.tf
cat > outputs.tf << 'EOF'
output "bucket_arn" {
value = aws_s3_bucket.main.arn
}
EOF
\`\`\``,
        verify: `\`\`\`bash
ls terraform-quality-demo/modules/storage/
# Expected: main.tf outputs.tf
\`\`\``
      },
      {
        title: 'Run quality gates and fix issues',
        instruction: 'Run terraform fmt, validate, and checkov to find and fix the problems.',
        hints: ['terraform fmt -check shows problems without fixing', '-recursive analyzes all modules'],
        solution: `\`\`\`bash
cd terraform-quality-demo

# 1. Check formatting (will find problems)
terraform fmt -check -recursive
# Expected: ./modules/storage/main.tf ./modules/storage/outputs.tf

# Fix automatically
terraform fmt -recursive

# 2. Install and run checkov
pip install checkov 2>/dev/null || pip3 install checkov

checkov -d modules/storage --compact
# Expected: Failures in CKV_AWS_144 (replication), CKV_AWS_145 (encryption), etc.

# 3. Fix security issues in main.tf
cat > modules/storage/main.tf << 'EOF'
variable "bucket_name" {
  description = "S3 bucket name"
  type        = string
}

resource "aws_s3_bucket" "main" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_versioning" "main" {
  # checkov:skip=CKV_AWS_144:Cross-region replication not needed for this module
  bucket = aws_s3_bucket.main.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  bucket = aws_s3_bucket.main.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
EOF

# Re-run checkov
checkov -d modules/storage --compact
# Expected: fewer failures (only those we intentionally skipped)
\`\`\``,
        verify: `\`\`\`bash
# Verify fmt passed
terraform fmt -check -recursive
# Expected: no output (everything formatted)

# Verify the main check passed
checkov -d modules/storage -c CKV_AWS_145 --compact 2>/dev/null
# Expected: Passed checks for encryption
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Checkov blocking pipeline with false positives',
      difficulty: 'easy',
      symptom: 'Checkov is failing CI/CD with checks that do not apply to the context (e.g., requires MFA on a public CDN bucket where MFA makes no sense).',
      diagnosis: `\`\`\`bash
# View details of the failing check
checkov -d . -c CKV_AWS_94 --output cli

# View all available checks
checkov --list
\`\`\``,
      solution: `**Options for handling false positives**:

**1. Inline skip with justification** (most traceable):
\`\`\`hcl
resource "aws_s3_bucket" "cdn" {
  # checkov:skip=CKV_AWS_20:Public CDN bucket — requires anonymous read access for assets
  bucket = "cdn-public-assets"
}
\`\`\`

**2. Centralized skip file** (.checkov.yaml):
\`\`\`yaml
skip-check:
  - CKV_AWS_144    # Cross-region replication — single region by design
\`\`\`

**3. Soft fail in CI** (reports but does not block):
\`\`\`yaml
checkov -d . --soft-fail
\`\`\`

**4. Hard fail only on CRITICAL**:
\`\`\`yaml
checkov -d . --hard-fail-on CRITICAL
\`\`\`

**Best practices**: document each skip with justification and periodically review if it still applies.`
    }
  ]
};
