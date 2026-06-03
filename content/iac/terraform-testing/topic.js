window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['iac/terraform-testing'] = {
  theory: `# Terraform Testing & Quality Gates

## Relevância
> Testar infraestrutura como código é o diferencial entre IaC amador e profissional. Checkov, tflint, Terratest e o Terraform testing framework nativo aparecem em entrevistas Platform/DevOps sênior.

## Pirâmide de Testes IaC

\`\`\`
            ╔═══════════════╗
            ║   E2E Tests   ║  (Terratest — lento, custoso, completo)
           ╔╩═══════════════╩╗
           ║ Integration Tests║  (terraform test — recursos reais)
          ╔╩═════════════════╩╗
          ║   Static Analysis  ║  (tflint, checkov, tfsec — rápido, sem infra)
         ╔╩═══════════════════╩╗
         ║    Format & Validate ║  (terraform fmt, validate — instantâneo)
         ╚═════════════════════╝
\`\`\`

## 1. Formatação e Validação (mais rápido)

\`\`\`bash
# Verificar formatação (não executa nada)
terraform fmt -check -recursive

# Corrigir formatação automaticamente
terraform fmt -recursive

# Validar sintaxe e referências (sem acessar provider)
terraform validate

# Integrar no pre-commit hook
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

## 2. Static Analysis com tflint

\`\`\`bash
# Instalar tflint
curl -s https://raw.githubusercontent.com/terraform-linters/tflint/master/install_linux.sh | bash

# Configuração (.tflint.hcl)
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

# Executar
tflint --chdir=./modules/eks
tflint --recursive  # todos os módulos
\`\`\`

## 3. Security Scanning com Checkov

\`\`\`bash
# Instalar
pip install checkov

# Scan de segurança (verifica 1000+ checks)
checkov -d ./modules/

# Scan de arquivo específico
checkov -f main.tf

# Ignorar checks específicos (justificativa necessária)
# No código Terraform:
resource "aws_s3_bucket" "logs" {
  # checkov:skip=CKV_AWS_18:Logging desabilitado intencionalmente neste bucket de log
  bucket = "my-log-bucket"
}

# Gerar relatório SARIF (para GitHub Security)
checkov -d . --output sarif --output-file results.sarif

# Integrar no CI/CD
checkov -d . --soft-fail  # não falha o pipeline (apenas reporta)
checkov -d . --hard-fail-on CRITICAL  # falha apenas em CRITICAL
\`\`\`

## 4. Terraform Test (Framework Nativo — Terraform >= 1.6)

\`\`\`hcl
# tests/main.tftest.hcl
run "basic_deployment" {
  command = plan    # ou apply (cria recursos reais)

  variables {
    environment  = "test"
    instance_type = "t3.micro"
    min_size      = 1
    max_size      = 3
  }

  assert {
    condition     = aws_autoscaling_group.main.min_size == 1
    error_message = "ASG min_size deve ser 1 em ambiente de teste"
  }

  assert {
    condition     = aws_autoscaling_group.main.max_size <= 3
    error_message = "ASG max_size não pode exceder 3 em ambiente de teste"
  }
}

run "security_validation" {
  command = plan

  assert {
    condition     = !aws_instance.web.associate_public_ip_address
    error_message = "Instâncias de produção não devem ter IP público"
  }

  assert {
    condition = contains(
      aws_security_group.web.ingress[*].from_port,
      443
    )
    error_message = "Security group deve permitir HTTPS (443)"
  }
}
\`\`\`

\`\`\`bash
# Executar testes
terraform test

# Executar apenas testes de plan (sem criar recursos)
terraform test -filter=run.basic_deployment
\`\`\`

## 5. Testes de Integração com Terratest (Go)

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
        // Usar conta AWS de sandbox
    })

    // Destruir ao final do teste
    defer terraform.Destroy(t, terraformOptions)

    // Aplicar o módulo
    terraform.InitAndApply(t, terraformOptions)

    // Validar outputs
    vpcId := terraform.Output(t, terraformOptions, "vpc_id")
    assert.NotEmpty(t, vpcId)

    // Validar recursos AWS diretamente
    vpc := aws.GetVpcById(t, vpcId, "us-east-1")
    assert.Equal(t, "10.99.0.0/16", aws.GetCidrBlockOfVpc(t, vpc))

    // Validar subnets criadas
    subnets := aws.GetSubnetsForVpc(t, vpcId, "us-east-1")
    assert.Equal(t, 3, len(subnets))
}
\`\`\`

\`\`\`bash
# Executar testes Go
cd test && go test -v -timeout 30m -run TestVPCModule
\`\`\`

## Pipeline CI/CD com Qualidade

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

## Erros Comuns

1. **Testar apenas o plan, nunca o apply**: plans passam mas apply pode falhar por permissões, quotas, conflitos.
2. **Sem testes de destruição**: testar apenas criação, mas destroy pode ter dependências não mapeadas.
3. **Conta de produção nos testes**: testar em produção por falta de sandbox → desastre potencial.
4. **Ignorar todos os checks do Checkov**: checkov:skip sem justificativa → acumula dívida de segurança.
`,

  quiz: [
    {
      question: 'Qual é a diferença entre `terraform validate` e `terraform plan` em termos de verificação?',
      options: [
        'Ambos consultam o provider AWS/Azure para verificar permissões',
        'validate verifica sintaxe e referências sem acessar o provider; plan executa contra o provider e mostra mudanças reais',
        'validate cria um plan salvo; plan executa imediatamente',
        'Não há diferença — validate e plan fazem a mesma verificação'
      ],
      correct: 1,
      explanation: 'terraform validate verifica apenas a sintaxe HCL e referências internas (variáveis existem, tipos corretos) sem inicializar providers ou acessar APIs remotas. É instantâneo e funciona sem credenciais. terraform plan consulta o provider, lê o state remoto, e calcula as mudanças necessárias — requer credenciais e acesso ao backend.',
      reference: 'Seção Formatação e Validação — validate é ideal para pre-commit hooks por ser rápido e sem dependências externas.'
    },
    {
      question: 'Qual ferramenta de análise estática para Terraform verifica problemas de segurança como buckets S3 sem criptografia ou security groups muito permissivos?',
      options: [
        'tflint',
        'terraform validate',
        'Checkov',
        'terraform fmt'
      ],
      correct: 2,
      explanation: 'Checkov é um scanner de segurança estático que verifica 1000+ checks de segurança e compliance em Terraform, CloudFormation, ARM e outros formatos IaC. Identifica: buckets S3 sem criptografia, security groups 0.0.0.0/0, instâncias sem IMDSv2, etc. tflint verifica boas práticas e erros de sintaxe, mas não tem foco em segurança.',
      reference: 'Seção Security Scanning — integre Checkov no CI/CD com --hard-fail-on CRITICAL.'
    },
    {
      question: 'Qual é o propósito do framework `terraform test` (nativo do Terraform >= 1.6)?',
      options: [
        'Substituir completamente o Terratest e todos os testes de integração',
        'Executar assertions sobre o plan ou apply de módulos Terraform dentro de arquivos .tftest.hcl',
        'Apenas testar o formato e sintaxe do código Terraform',
        'Gerar relatórios de compliance automaticamente'
      ],
      correct: 1,
      explanation: 'O terraform test framework nativo (Terraform >= 1.6) executa arquivos .tftest.hcl que definem runs com variables e assert blocks. Pode rodar em modo plan (sem criar recursos) ou apply (cria e destrói recursos de teste). É mais simples que o Terratest (Go) mas menos flexível — ideal para testes unitários de módulos, deixando Terratest para integração complexa.',
      reference: 'Seção Terraform Test — use command = plan para testes rápidos sem custo, apply para validação completa.'
    }
  ],

  flashcards: [
    {
      front: 'Qual é a pirâmide de testes para infraestrutura Terraform?',
      back: '**Base (mais rápido, sem custo)**:\n1. `terraform fmt -check` → formatação\n2. `terraform validate` → sintaxe e referências\n\n**Análise estática (sem criar recursos)**:\n3. `tflint` → boas práticas e erros\n4. `checkov` → segurança e compliance\n\n**Testes de módulos**:\n5. `terraform test` (nativo >= 1.6) → assertions sobre plan/apply\n\n**Topo (lento, custoso, completo)**:\n6. Terratest (Go) → testes de integração com recursos reais\n\nRun mais baixa camadas no PR; topo apenas em branches de release.'
    },
    {
      front: 'Como ignorar um check do Checkov com justificativa no código Terraform?',
      back: '```hcl\nresource "aws_s3_bucket" "public-assets" {\n  # checkov:skip=CKV_AWS_20:Bucket de assets públicos - requer acesso anônimo de leitura\n  # checkov:skip=CKV_AWS_18:Logging não necessário para assets estáticos\n  bucket = "company-public-cdn-assets"\n}\n```\n\nFormato: `# checkov:skip=CHECK_ID:justificativa`\n\n**Nunca** ignore sem justificativa — acumula dívida de segurança e perde rastreabilidade de decisões.'
    }
  ],

  lab: {
    scenario: 'Configurar um pipeline de qualidade para um módulo Terraform com fmt, validate, tflint e checkov.',
    objective: 'Implementar quality gates que bloqueiam código inseguro ou malformatado antes do merge.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar módulo Terraform com problemas propositais',
        instruction: 'Crie um módulo simples com alguns problemas de formatação e segurança para os scanners encontrarem.',
        hints: ['Indentação errada vai ser detectada pelo fmt', 'S3 sem versioning vai ser detectado pelo checkov'],
        solution: `\`\`\`bash
mkdir -p terraform-quality-demo/modules/storage
cd terraform-quality-demo/modules/storage

# main.tf com problemas propositais
cat > main.tf << 'EOF'
variable "bucket_name" {
  description = "Nome do bucket S3"
  type = string
}

resource "aws_s3_bucket" "main" {
bucket = var.bucket_name   # formatação errada (sem indentação)
}

# Sem versionamento, sem criptografia — problemas de segurança
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
# Esperado: main.tf outputs.tf
\`\`\``
      },
      {
        title: 'Executar quality gates e corrigir problemas',
        instruction: 'Execute terraform fmt, validate e checkov para encontrar e corrigir os problemas.',
        hints: ['terraform fmt -check mostra problemas sem corrigir', '-recursive analisa todos os módulos'],
        solution: `\`\`\`bash
cd terraform-quality-demo

# 1. Verificar formatação (vai encontrar problemas)
terraform fmt -check -recursive
# Esperado: ./modules/storage/main.tf ./modules/storage/outputs.tf

# Corrigir automaticamente
terraform fmt -recursive

# 2. Instalar e executar checkov
pip install checkov 2>/dev/null || pip3 install checkov

checkov -d modules/storage --compact
# Esperado: Falhas em CKV_AWS_144 (replication), CKV_AWS_145 (encryption), etc.

# 3. Corrigir os problemas de segurança no main.tf
cat > modules/storage/main.tf << 'EOF'
variable "bucket_name" {
  description = "Nome do bucket S3"
  type        = string
}

resource "aws_s3_bucket" "main" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_versioning" "main" {
  # checkov:skip=CKV_AWS_144:Cross-region replication não necessário para este módulo
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

# Re-executar checkov
checkov -d modules/storage --compact
# Esperado: menos falhas (apenas as que fizemos skip intencionalmente)
\`\`\``,
        verify: `\`\`\`bash
# Verificar que fmt passou
terraform fmt -check -recursive
# Esperado: sem output (tudo formatado)

# Verificar que o check principal passou
checkov -d modules/storage -c CKV_AWS_145 --compact 2>/dev/null
# Esperado: Passed checks para criptografia
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Checkov bloqueando pipeline com falsos positivos',
      difficulty: 'easy',
      symptom: 'O Checkov está falhando o CI/CD com checks que não se aplicam ao contexto (ex: requer MFA em bucket de CDN público onde MFA não faz sentido).',
      diagnosis: `\`\`\`bash
# Ver detalhes do check falhando
checkov -d . -c CKV_AWS_94 --output cli

# Ver todos os checks disponíveis
checkov --list
\`\`\``,
      solution: `**Opções para lidar com falsos positivos**:

**1. Skip inline com justificativa** (mais rastreável):
\`\`\`hcl
resource "aws_s3_bucket" "cdn" {
  # checkov:skip=CKV_AWS_20:Bucket de CDN público — requer acesso anônimo de leitura para assets
  bucket = "cdn-public-assets"
}
\`\`\`

**2. Arquivo de skip centralizado** (.checkov.yaml):
\`\`\`yaml
skip-check:
  - CKV_AWS_144    # Cross-region replication — single region por design
\`\`\`

**3. Soft fail no CI** (reporta mas não bloqueia):
\`\`\`yaml
checkov -d . --soft-fail
\`\`\`

**4. Hard fail apenas em CRITICAL**:
\`\`\`yaml
checkov -d . --hard-fail-on CRITICAL
\`\`\`

**Boas práticas**: documente cada skip com justificativa e revise periodicamente se ainda se aplica.`
    }
  ]
};
