window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-secure-arch/iam-advanced'] = {
  theory: `# IAM Advanced & Organizations

## Relevancia no Exame
> O dominio **Design Secure Architectures** vale **30%** do SAA-C03. IAM avancado, Organizations, federacao e cross-account sao temas frequentes.

## IAM Policies em Profundidade

### Estrutura de uma Policy

\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3Read",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ],
      "Condition": {
        "IpAddress": { "aws:SourceIp": "203.0.113.0/24" }
      }
    }
  ]
}
\`\`\`

### Avaliacao de Policies (Policy Evaluation Logic)

1. **Explicit Deny** em qualquer policy → DENY (sempre vence)
2. **Organizations SCP** → pode restringir (guardrail)
3. **Resource-based policy** → pode permitir cross-account
4. **Permissions boundary** → limita escopo maximo
5. **Session policy** → restringe credenciais temporarias
6. **Identity-based policy** → concede permissoes

Regra: **Deny explicito SEMPRE vence Allow**

### Tipos de Policies

| Tipo | Escopo | Uso |
|------|--------|-----|
| **Identity-based** | Anexada a user/group/role | Permissoes do principal |
| **Resource-based** | Anexada ao recurso (S3, SQS, Lambda) | Quem pode acessar o recurso |
| **Permissions Boundary** | Limita escopo maximo de um user/role | Delegacao segura |
| **SCP** | Limita contas em Organizations | Guardrails organizacionais |
| **Session Policy** | Restringe credenciais temporarias | AssumeRole, Federation |

## AWS Organizations Avancado

### Service Control Policies (SCPs)
- Limitam permissoes MAXIMAS de contas filhas
- NAO concedem permissoes (apenas restringem)
- Aplicados em OUs ou contas individuais
- Heranca hierarquica (OU pai afeta filhos)

### Estrategia de Multi-Account

\`\`\`
Organization Root
|
|-- OU: Security
|   |-- Log Archive Account (CloudTrail, Config)
|   |-- Security Tooling Account (GuardDuty, SecurityHub)
|
|-- OU: Infrastructure
|   |-- Network Account (Transit Gateway, DNS)
|   |-- Shared Services Account
|
|-- OU: Workloads
|   |-- OU: Production
|   |   |-- App1-Prod, App2-Prod
|   |-- OU: Development
|       |-- App1-Dev, App2-Dev
\`\`\`

## AWS IAM Identity Center (ex-SSO)

Gerenciamento centralizado de acesso para multiplas contas AWS e aplicacoes.

- Single sign-on para todas as contas da Organization
- Integra com IdPs externos (Active Directory, Okta, Azure AD)
- Permission Sets definem acesso por conta
- Substitui federacao manual com SAML

## AWS STS (Security Token Service)

Gera credenciais temporarias para:
- **AssumeRole**: assumir uma IAM Role (cross-account, servicos)
- **AssumeRoleWithSAML**: federacao via SAML 2.0
- **AssumeRoleWithWebIdentity**: login social (Google, Facebook, Cognito)
- **GetSessionToken**: MFA para acesso programatico

### Cross-Account Access Pattern

\`\`\`
Conta A (112233445566)         Conta B (998877665544)
|                               |
|  User: dev-user               |  Role: CrossAccountRole
|  Policy: sts:AssumeRole       |  Trust: Conta A
|  Resource: role ARN Conta B   |  Policy: s3:GetObject
|                               |
dev-user assume CrossAccountRole -> acessa S3 na Conta B
\`\`\`

## Amazon Cognito

Autenticacao e autorizacao para aplicacoes web e mobile.

### User Pools
- Diretorio de usuarios (sign-up, sign-in)
- MFA, verificacao de email/telefone
- Integracao com IdPs sociais (Google, Facebook, Apple)
- JWT tokens

### Identity Pools (Federated Identities)
- Troca tokens de User Pool por credenciais AWS temporarias
- Acesso direto a servicos AWS (S3, DynamoDB) de apps client-side
- Roles para usuarios autenticados vs anonimos

## AWS Resource Access Manager (RAM)

Compartilhe recursos AWS entre contas sem duplicar:
- Transit Gateway, Subnets, License Manager
- Dentro da Organization ou com contas especificas
- Reduz custo e complexidade

## Erros Comuns no Exame

- Esquecer que Explicit Deny SEMPRE vence Allow
- Confundir SCP (guardrail organizacional) com IAM Policy (permissao)
- Nao saber que SCPs nao afetam a Management Account
- Confundir Cognito User Pools (autenticacao) com Identity Pools (credenciais AWS)
- Usar access keys para cross-account em vez de AssumeRole
`,

  quiz: [
    {
      question: 'Qual e a ordem de avaliacao quando um user tem Allow em uma policy mas Deny explicito em outra?',
      options: ['Allow vence', 'Deny explicito SEMPRE vence', 'A mais recente vence', 'Depende da ordem de criacao'],
      correct: 1,
      explanation: 'Explicit Deny SEMPRE vence Allow, independente de onde o Deny esteja (identity policy, resource policy, SCP, boundary). E a regra mais importante de IAM.',
      reference: 'Policy evaluation: Deny > SCP > Resource > Boundary > Identity.'
    },
    {
      question: 'O que sao Permissions Boundaries no IAM?',
      options: ['Limites de API rate', 'Escopo maximo de permissoes que um user/role pode ter', 'Limites de gastos', 'Limites de Resources por conta'],
      correct: 1,
      explanation: 'Permissions Boundaries definem o escopo MAXIMO de permissoes. A permissao efetiva e a INTERSECAO entre identity policy e permissions boundary.',
      reference: 'Util para delegacao: admins criam roles com boundaries pre-definidos.'
    },
    {
      question: 'Qual servico substitui SAML federation manual para SSO em multiplas contas?',
      options: ['Amazon Cognito', 'AWS IAM Identity Center', 'AWS STS', 'AWS Directory Service'],
      correct: 1,
      explanation: 'IAM Identity Center (antigo AWS SSO) fornece single sign-on centralizado para todas as contas da Organization, com integracao a IdPs externos.',
      reference: 'Identity Center > SAML federation manual para multi-account SSO.'
    },
    {
      question: 'Qual servico AWS permite compartilhar recursos (Transit Gateway, subnets) entre contas?',
      options: ['VPC Peering', 'AWS RAM (Resource Access Manager)', 'AWS Organizations', 'AWS PrivateLink'],
      correct: 1,
      explanation: 'AWS RAM permite compartilhar recursos entre contas dentro ou fora da Organization sem duplicar. Suporta Transit Gateway, subnets, License Manager, etc.',
      reference: 'RAM compartilha recursos. PrivateLink compartilha servicos. VPC Peering conecta redes.'
    },
    {
      question: 'Qual a diferenca entre Cognito User Pools e Identity Pools?',
      options: ['User Pools armazenam arquivos, Identity Pools armazenam usuarios', 'User Pools gerenciam autenticacao, Identity Pools fornecem credenciais AWS', 'Sao a mesma coisa', 'User Pools sao gratuitos, Identity Pools sao pagos'],
      correct: 1,
      explanation: 'User Pools = autenticacao (sign-up, sign-in, JWT tokens). Identity Pools = trocam tokens por credenciais AWS temporarias para acesso direto a servicos.',
      reference: 'User Pool -> JWT token -> Identity Pool -> AWS credentials -> S3, DynamoDB.'
    },
    {
      question: 'SCPs no AWS Organizations afetam a Management Account?',
      options: ['Sim, afetam todas as contas', 'Nao, a Management Account e excecao', 'Apenas se explicitamente configurado', 'Apenas para servicos de billing'],
      correct: 1,
      explanation: 'SCPs NAO afetam a Management Account (raiz da Organization). Por isso, nunca use a Management Account para workloads — use apenas para gerenciamento.',
      reference: 'Best practice: Management Account apenas para Organizations, billing e audit.'
    },
    {
      question: 'Qual e o padrao correto para acesso cross-account entre Account A e Account B?',
      options: ['Compartilhar access keys da Account B', 'Account A assume Role na Account B via STS', 'Criar VPC Peering entre as contas', 'Usar a mesma IAM Policy em ambas'],
      correct: 1,
      explanation: 'Cross-account access: Account B cria Role com Trust Policy permitindo Account A. User/Role da Account A chama sts:AssumeRole para obter credenciais temporarias.',
      reference: 'NUNCA compartilhe access keys. Sempre use AssumeRole para cross-account.'
    },
    {
      question: 'O que e uma Resource-based Policy?',
      options: ['Policy anexada a um IAM user', 'Policy anexada diretamente a um recurso AWS', 'Policy de billing', 'Policy de rede'],
      correct: 1,
      explanation: 'Resource-based policies sao anexadas ao recurso (S3 bucket policy, SQS queue policy, Lambda resource policy). Definem quem pode acessar aquele recurso.',
      reference: 'Resource policies podem permitir cross-account SEM AssumeRole (o principal acessa diretamente).'
    }
  ],

  flashcards: [
    { front: 'Qual a regra mais importante de avaliacao de IAM policies?', back: 'Explicit Deny SEMPRE vence Allow. Se qualquer policy (identity, resource, SCP, boundary, session) tiver um Deny explicito, o acesso e negado, independente de quantos Allows existam.' },
    { front: 'O que sao Permissions Boundaries?', back: 'Definem o escopo MAXIMO de permissoes de um user/role. A permissao efetiva = INTERSECAO entre identity policy e boundary. Util para delegacao segura: admin cria roles com limite pre-definido.' },
    { front: 'O que e AWS IAM Identity Center?', back: 'Antigo AWS SSO. Single sign-on centralizado para multiplas contas AWS e apps. Integra com IdPs (AD, Okta). Permission Sets definem acesso por conta. Substitui SAML federation manual.' },
    { front: 'Como funciona cross-account access?', back: 'Account B cria Role com Trust Policy para Account A. User de A chama sts:AssumeRole para obter credenciais temporarias. NUNCA compartilhe access keys. Credenciais expiram automaticamente.' },
    { front: 'Qual a diferenca entre Cognito User Pools e Identity Pools?', back: 'User Pools = autenticacao (sign-up/in, MFA, JWT). Identity Pools = federacao com AWS (troca token por credenciais temporarias para S3, DynamoDB). Fluxo: User Pool -> token -> Identity Pool -> AWS creds.' },
    { front: 'O que sao SCPs e como funcionam?', back: 'Service Control Policies: guardrails que limitam permissoes MAXIMAS de contas na Organization. NAO concedem permissoes. NAO afetam Management Account. Heranca hierarquica em OUs.' },
    { front: 'O que e AWS RAM?', back: 'Resource Access Manager: compartilha recursos (Transit Gateway, subnets, License Manager) entre contas sem duplicar. Funciona dentro ou fora da Organization. Reduz custo e complexidade.' },
    { front: 'Quais sao os tipos de IAM Policies?', back: 'Identity-based (user/group/role), Resource-based (S3 bucket, SQS queue), Permissions Boundary (escopo maximo), SCP (guardrail organizacional), Session Policy (credenciais temporarias).' }
  ],

  lab: {
    scenario: 'Configure IAM avancado com cross-account access e policies granulares.',
    objective: 'Implementar cross-account access, permissions boundaries e entender policy evaluation.',
    duration: '20-30 minutos',
    steps: [
      {
        title: 'Analisar Policy Evaluation',
        instruction: 'Dado um usuario com: Identity policy Allow s3:*, SCP Deny s3:DeleteObject, Resource policy Allow s3:GetObject. O usuario consegue deletar objetos?',
        hints: ['Explicit Deny sempre vence', 'SCP e um deny ceiling'],
        solution: '```\nAnalise:\n1. Identity policy: Allow s3:* (inclui DeleteObject)\n2. SCP: Deny s3:DeleteObject (EXPLICIT DENY)\n3. Resource policy: Allow s3:GetObject\n\nResultado: DENY para s3:DeleteObject\nMotivo: SCP tem Deny explicito, que SEMPRE vence Allow\n\nO usuario pode: s3:GetObject, s3:PutObject, s3:ListBucket\nO usuario NAO pode: s3:DeleteObject (bloqueado pelo SCP)\n```',
        verify: '```bash\n# Use IAM Policy Simulator para verificar:\n# Console > IAM > Policy Simulator\n# Selecione o user, teste s3:DeleteObject\n# Resultado esperado: Implicitly Denied (SCP override)\n```'
      },
      {
        title: 'Configurar Cross-Account Access',
        instruction: 'Crie uma Role na Account B que Account A possa assumir para ler S3. Configure trust policy e permissions.',
        hints: ['Trust policy define QUEM pode assumir', 'Permissions policy define O QUE pode fazer'],
        solution: '```bash\n# Na Account B: criar Role\ncat > trust-policy.json << EOF\n{\n  "Version": "2012-10-17",\n  "Statement": [{\n    "Effect": "Allow",\n    "Principal": { "AWS": "arn:aws:iam::ACCOUNT_A_ID:root" },\n    "Action": "sts:AssumeRole"\n  }]\n}\nEOF\n\naws iam create-role --role-name CrossAccountS3Reader \\\n  --assume-role-policy-document file://trust-policy.json\n\naws iam attach-role-policy --role-name CrossAccountS3Reader \\\n  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess\n\n# Na Account A: usuario assume a Role\naws sts assume-role \\\n  --role-arn arn:aws:iam::ACCOUNT_B_ID:role/CrossAccountS3Reader \\\n  --role-session-name cross-account-session\n```',
        verify: '```bash\n# Verificar:\naws iam get-role --role-name CrossAccountS3Reader\n# Trust policy deve listar Account A como principal\n\n# Testar assume-role retorna credenciais temporarias:\n# AccessKeyId, SecretAccessKey, SessionToken\n# Validade: 1 hora por padrao\n```'
      },
      {
        title: 'Criar Permissions Boundary',
        instruction: 'Crie uma Permissions Boundary que limita um developer a apenas servicos S3 e DynamoDB, mesmo que a identity policy conceda mais.',
        hints: ['Boundary define o teto', 'Permissao efetiva = intersecao de identity + boundary'],
        solution: '```bash\n# Criar boundary policy\ncat > boundary.json << EOF\n{\n  "Version": "2012-10-17",\n  "Statement": [{\n    "Effect": "Allow",\n    "Action": ["s3:*", "dynamodb:*"],\n    "Resource": "*"\n  }]\n}\nEOF\n\naws iam create-policy --policy-name DevBoundary \\\n  --policy-document file://boundary.json\n\n# Anexar como boundary (nao como policy normal)\naws iam put-user-permissions-boundary \\\n  --user-name dev-user \\\n  --permissions-boundary arn:aws:iam::ACCOUNT:policy/DevBoundary\n\n# Mesmo se dev-user tiver AdministratorAccess,\n# so podera usar S3 e DynamoDB (intersecao)\n```',
        verify: '```bash\n# Verificar boundary anexado:\naws iam get-user --user-name dev-user\n# PermissionsBoundary deve mostrar DevBoundary ARN\n\n# Testar: dev-user tenta ec2:DescribeInstances\n# Resultado esperado: Access Denied (fora do boundary)\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Effective Permissions com Boundary + Policy',
      difficulty: 'hard',
      symptom: 'Permissions Boundary aplicado mas usuario ainda consegue acessar servicos fora do boundary.',
      diagnosis: '```\nPermissao Efetiva = INTERSECAO de:\n  Identity Policy AND Permissions Boundary\n\nSe Identity Policy: Allow ec2:*, s3:*, dynamodb:*\nE Boundary: Allow s3:*, dynamodb:*\n\nResultado: Allow apenas s3:* e dynamodb:*\n(ec2 esta na identity mas NAO no boundary = DENY)\n\nVerifique:\n1. Boundary esta anexado corretamente?\n   aws iam get-user --user-name USER\n   -> PermissionsBoundary deve aparecer\n\n2. Existem resource-based policies?\n   Resource policies IGNORAM boundaries\n   (ex: S3 bucket policy pode permitir acesso direto)\n```',
      solution: 'Resource-based policies sao avaliadas SEPARADAMENTE e podem permitir acesso mesmo com boundary restritivo. Para seguranca total, combine boundary + SCP + resource policies. Verifique com IAM Policy Simulator.'
    },
    {
      title: 'Cross-Account AssumeRole Access Denied',
      difficulty: 'medium',
      symptom: 'sts:AssumeRole falha com Access Denied apesar de trust policy configurada.',
      diagnosis: '```\nChecklist de verificacao:\n\n1. Trust Policy na Role (Account B):\n   Principal correto? (ARN da Account A ou user/role)\n   Action: sts:AssumeRole?\n\n2. Identity Policy no User (Account A):\n   Allow sts:AssumeRole no ARN da Role de B?\n   Resource: arn:aws:iam::ACCOUNT_B:role/RoleName?\n\n3. SCP (se using Organizations):\n   SCP permite sts:AssumeRole?\n   SCP na Account A e na Account B?\n\n4. Permissions Boundary (se aplicado):\n   Boundary permite sts:AssumeRole?\n\n5. External ID (se exigido):\n   --external-id parametro correto?\n```',
      solution: 'Cross-account precisa de AMBOS os lados: Trust policy na Role (quem pode assumir) E identity policy no user (permissao para assumir). Verifique ARNs, account IDs e conditions em ambas as policies.'
    }
  ]
};
