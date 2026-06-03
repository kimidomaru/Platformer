window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-org-complexity/multi-account'] = {
  theory: `# Estrategia Multi-Conta e Governanca

## Relevancia no Exame
> **Design para Complexidade Organizacional** vale **26%** do SAP-C02. Estrategias multi-conta, Organizations, Control Tower, acesso cross-account e governanca centralizada sao topicos centrais.

## AWS Organizations

### Conceitos-Chave
- **Management Account**: conta raiz, dona da Organization. Use APENAS para billing/governanca, NUNCA para workloads. SCPs NAO afetam ela.
- **Organizational Units (OUs)**: agrupamento hierarquico. OUs aninhadas herdam SCPs do pai.
- **Consolidated Billing**: fatura unica, descontos por volume, compartilhamento de RI/SP entre contas.
- **Delegated Administrator**: delegue gerenciamento de servicos para contas membros (CloudFormation StackSets, GuardDuty, Security Hub).

### Service Control Policies (SCPs)

Duas estrategias:
- **Deny-list (recomendada)**: comece com FullAWSAccess, adicione Deny explicitos
- **Allow-list**: remova FullAWSAccess, permita apenas servicos especificos

Comportamentos-chave:
- SCPs limitam permissoes MAXIMAS (NAO concedem permissoes)
- Hierarquico: SCP da OU pai afeta todos os filhos
- NAO afeta a Management Account
- Permissao efetiva = intersecao SCP com politica IAM

## AWS Control Tower

Setup automatizado multi-conta com boas praticas:
- **Landing Zone**: ambiente multi-conta pre-configurado (conta log archive, audit, shared services)
- **Account Factory**: provisionamento self-service de contas com baselines pre-configuradas
- **Guardrails**: preventivos (SCPs), detectivos (Config rules), proativos (CloudFormation hooks)
- **Customizations for Control Tower (CfCT)**: estenda com templates CloudFormation customizados
- **Account Factory for Terraform (AFT)**: provisionamento de contas via Terraform

## Padroes de Acesso Cross-Account

| Padrao | Caso de Uso |
|--------|-------------|
| **IAM Roles + AssumeRole** | Acesso API cross-account (mais comum) |
| **AWS RAM** | Compartilhar recursos (Transit Gateway, subnets, License Manager) |
| **S3 Bucket Policy** | Acesso S3 cross-account via resource-based policy |
| **KMS Key Policy** | Criptografia/decriptografia cross-account |
| **Secrets Manager Resource Policy** | Acesso cross-account a segredos |
| **EventBridge Event Bus Policy** | Roteamento de eventos cross-account |

### Padrao AssumeRole
1. Conta B cria Role com Trust Policy permitindo Conta A
2. Usuario/role da Conta A chama sts:AssumeRole
3. Recebe credenciais temporarias para Conta B
4. Usa credenciais temporarias para acessar recursos

## Logging Centralizado

| Servico | Centralizacao |
|---------|--------------|
| **CloudTrail** | Organization trail: todas as contas, todas as Regions, para S3 centralizado |
| **Config** | Aggregator: visao de compliance multi-conta, multi-Region |
| **CloudWatch** | Cross-account observability: contas fonte -> conta de monitoramento |
| **VPC Flow Logs** | Bucket S3 centralizado com bucket policy |
| **GuardDuty** | Admin delegado: findings centralizados em toda a Organization |
| **Security Hub** | Findings de seguranca agregados entre contas |

## AWS Service Catalog

- **Portfolios**: colecao de produtos (templates CloudFormation)
- **Products**: templates de infraestrutura aprovados
- **Launch Constraints**: IAM role usada para provisionar (usuario final nao precisa de permissoes diretas)
- **TagOptions**: forcam tagging nos recursos provisionados
- **Sharing**: compartilhe portfolios entre contas da Organization

## Estrategias de Billing

- **Consolidated Billing**: fatura unica, descontos por volume
- **Cost Allocation Tags**: geradas pela AWS (aws:createdBy) + definidas pelo usuario (Team, Environment)
- **Compartilhamento RI/SP**: Reserved Instances e Savings Plans compartilhados na Organization (pode desativar por conta)
- **Budgets por conta**: defina limites de gasto individuais por conta

## Erros Comuns

- Executar workloads na Management Account (deve ser apenas billing/governanca)
- Achar que SCPs concedem permissoes (elas apenas restringem)
- Esquecer que SCPs NAO afetam a Management Account
- Nao usar delegated administrator para servicos como GuardDuty
- Usar VPC Peering para compartilhar recursos quando RAM e mais simples
`,

  quiz: [
    {
      question: 'Os SCPs afetam a Management Account da Organization?',
      options: ['Sim, afetam todas as contas', 'Nao, a Management Account e isenta de SCPs', 'Apenas se configurado explicitamente', 'Apenas para servicos de billing'],
      correct: 1,
      explanation: 'SCPs NAO afetam a Management Account. Por isso voce nunca deve executar workloads nela. Use apenas para billing, governanca e gerenciamento da Organization.',
      reference: 'Management Account: isenta de SCPs. Nunca use para workloads. Apenas billing/governanca.'
    },
    {
      question: 'Qual a diferenca entre estrategia SCP deny-list e allow-list?',
      options: ['Deny-list bloqueia tudo por padrao', 'Deny-list comeca com FullAWSAccess e adiciona Denies explicitos; allow-list remove FullAWSAccess e permite explicitamente', 'Sao identicas', 'Allow-list e mais restritiva por padrao'],
      correct: 1,
      explanation: 'Deny-list (recomendada): mantenha FullAWSAccess, adicione Deny especificos. Allow-list: remova FullAWSAccess, apenas servicos explicitamente permitidos funcionam. Deny-list e mais simples de gerenciar.',
      reference: 'Deny-list = FullAWSAccess + denies explicitos (recomendada). Allow-list = apenas allows explicitos.'
    },
    {
      question: 'O que o Account Factory do Control Tower fornece?',
      options: ['Faturamento de contas AWS', 'Provisionamento self-service de contas com baselines e guardrails pre-configurados', 'Templates de instancias EC2', 'Gerenciamento de stacks CloudFormation'],
      correct: 1,
      explanation: 'Account Factory: criacao self-service de novas contas AWS com networking, baselines de seguranca e guardrails pre-configurados. Integra com Service Catalog para provisionamento padronizado.',
      reference: 'Account Factory = provisionamento padronizado de contas. Guardrails = preventivo(SCP) + detectivo(Config).'
    },
    {
      question: 'Qual o padrao correto de acesso cross-account com IAM?',
      options: ['Compartilhar usuarios IAM entre contas', 'Criar IAM Role na conta destino com trust policy, assumi-la da conta origem via STS', 'Copiar access keys entre contas', 'Usar a mesma politica IAM em ambas as contas'],
      correct: 1,
      explanation: 'Cross-account: conta destino cria Role com Trust Policy permitindo conta origem. Usuario/role da conta origem chama sts:AssumeRole para obter credenciais temporarias. NUNCA compartilhe access keys.',
      reference: 'AssumeRole = credenciais temporarias. Trust Policy = quem pode assumir. NUNCA compartilhe access keys.'
    },
    {
      question: 'Como centralizar logs do CloudTrail em toda a Organization?',
      options: ['Habilitar CloudTrail individualmente em cada conta', 'Criar um Organization trail que registra todas as contas e Regions em um bucket S3 centralizado', 'Usar CloudWatch Logs', 'Usar AWS Config'],
      correct: 1,
      explanation: 'Organization trail: um trail cobre todas as contas da Organization, todas as Regions. Registra em bucket S3 centralizado na conta log archive. Nao precisa de configuracao por conta.',
      reference: 'Organization trail = todas as contas, todas as Regions, um bucket S3. Auditoria centralizada.'
    },
    {
      question: 'Para que serve o AWS RAM (Resource Access Manager)?',
      options: ['Gerenciar RAM nas instancias EC2', 'Compartilhar recursos AWS (Transit Gateway, subnets) entre contas sem duplicacao', 'Gerenciamento de roles IAM', 'Cache de memoria'],
      correct: 1,
      explanation: 'RAM compartilha recursos entre contas: Transit Gateway, subnets, configuracoes do License Manager, regras do Route 53 Resolver, e mais. Evita duplicar recursos entre contas.',
      reference: 'RAM = compartilhar recursos sem duplicacao. Transit Gateway, subnets, License Manager, etc.'
    },
    {
      question: 'Quais sao os tipos de guardrails do Control Tower?',
      options: ['Apenas SCPs', 'Preventivos (SCPs), Detectivos (Config rules) e Proativos (CloudFormation hooks)', 'Apenas Config rules', 'Apenas CloudWatch alarms'],
      correct: 1,
      explanation: 'Preventivos: SCPs que bloqueiam acoes nao conformes. Detectivos: Config rules que detectam nao-conformidade. Proativos: CloudFormation hooks que verificam antes da criacao do recurso.',
      reference: 'Preventivo = SCP (bloquear). Detectivo = Config (detectar). Proativo = CFN hooks (verificar antes).'
    },
    {
      question: 'Como o Launch Constraint do Service Catalog ajuda com seguranca?',
      options: ['Criptografa o produto', 'Especifica uma IAM role para provisionamento, dispensando permissoes diretas para o usuario', 'Restringe quais contas podem usar o produto', 'Habilita MFA'],
      correct: 1,
      explanation: 'Launch Constraint: especifica IAM role usada para provisionar o produto. Usuarios precisam apenas de permissoes do Service Catalog, nao de acesso direto aos servicos subjacentes (EC2, RDS, etc.).',
      reference: 'Launch Constraint = IAM role para provisionamento. Usuarios precisam apenas de permissoes servicecatalog:*.'
    }
  ],

  flashcards: [
    { front: 'Boas praticas da Management Account?', back: 'NUNCA execute workloads. Use apenas para billing, governanca, gerenciamento da Organization. SCPs NAO a afetam. Nao implante recursos. Use delegated administrator para servicos.' },
    { front: 'SCP deny-list vs allow-list?', back: 'Deny-list (recomendada): mantenha FullAWSAccess, adicione Deny explicitos. Allow-list: remova FullAWSAccess, permita apenas servicos necessarios. SCPs restringem max. permissoes, NAO concedem.' },
    { front: 'Componentes do Control Tower?', back: 'Landing Zone: setup multi-conta pre-configurado. Account Factory: provisionamento self-service. Guardrails: preventivo(SCP), detectivo(Config), proativo(CFN hooks). CfCT: extensoes customizadas.' },
    { front: 'Padroes de acesso cross-account?', back: 'IAM AssumeRole (mais comum). AWS RAM (compartilhar recursos). S3 bucket policy. KMS key policy. Secrets Manager resource policy. EventBridge event bus policy. NUNCA compartilhe access keys.' },
    { front: 'Arquitetura de logging centralizado?', back: 'CloudTrail: org trail para S3. Config: aggregator multi-conta. CloudWatch: cross-account observability. GuardDuty: admin delegado. Security Hub: findings agregados. VPC Flow Logs: S3 centralizado.' },
    { front: 'Recursos compartilhaveis pelo AWS RAM?', back: 'Transit Gateway, subnets, configuracoes License Manager, regras Route 53 Resolver, clusters Aurora, projetos CodeBuild, e mais. Compartilhe dentro da Organization ou com contas especificas.' },
    { front: 'Conceitos do Service Catalog?', back: 'Portfolios: colecao de produtos. Products: templates CloudFormation. Launch Constraints: IAM role para provisionamento. TagOptions: forcam tags. Compartilhavel entre contas da Organization.' },
    { front: 'Features de billing da Organization?', back: 'Consolidated Billing: fatura unica, descontos por volume. Compartilhamento RI/SP: entre contas (pode desativar por conta). Cost Allocation Tags: geradas pela AWS + definidas pelo usuario. Budgets por conta.' }
  ],

  lab: {
    scenario: 'Projete uma estrategia de governanca multi-conta para uma empresa.',
    objective: 'Praticar estrutura de OUs, SCPs, acesso cross-account e logging centralizado.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Projetar Estrutura de OUs e SCPs',
        instruction: 'Projete uma hierarquia de OUs para uma organizacao com times de Producao, Desenvolvimento e Seguranca. Defina SCPs para cada OU.',
        hints: ['Producao precisa de controles mais rigorosos que Desenvolvimento', 'Time de seguranca precisa de acesso amplo aos servicos de seguranca'],
        solution: '```\nAWS Organization\n|\n|-- OU: Security\n|   |-- Account: security-audit\n|   |-- Account: log-archive\n|   SCP: Permitir tudo (time de seguranca precisa de acesso amplo)\n|\n|-- OU: Production\n|   |-- Account: prod-app-1\n|   |-- Account: prod-app-2\n|   SCP: Negar saida da org, Negar desabilitar CloudTrail,\n|        Negar deletar VPC, Negar Regions nao aprovadas\n|\n|-- OU: Development\n|   |-- Account: dev-team-1\n|   |-- Account: dev-sandbox\n|   SCP: Negar tipos de instancia grandes (controle de custo),\n|        Negar Regions de producao\n|\n|-- OU: Sandbox\n|   |-- Account: sandbox-1\n|   SCP: Negar tudo exceto servicos aprovados,\n|        Limite de orcamento aplicado\n```',
        verify: '```bash\naws organizations list-organizational-units-for-parent \\\n  --parent-id r-xxxx\n# Esperado: OUs Security, Production, Development, Sandbox\n\naws organizations list-policies --filter SERVICE_CONTROL_POLICY\n# Esperado: SCPs para cada OU\n```'
      },
      {
        title: 'Configurar Acesso Cross-Account via Role',
        instruction: 'Crie uma Role na Conta B que a Conta A pode assumir para leitura de buckets S3.',
        hints: ['Trust policy define quem pode assumir', 'Permissions policy define o que pode fazer'],
        solution: '```bash\n# Na Conta B: criar Role com trust policy\naws iam create-role --role-name CrossAccountS3Reader \\\n  --assume-role-policy-document \'{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::ID_CONTA_A:root"},"Action":"sts:AssumeRole"}]}\'\n\n# Anexar permissao de leitura S3\naws iam attach-role-policy --role-name CrossAccountS3Reader \\\n  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess\n\n# Na Conta A: assumir a role\naws sts assume-role \\\n  --role-arn arn:aws:iam::ID_CONTA_B:role/CrossAccountS3Reader \\\n  --role-session-name sessao-cross-account\n```',
        verify: '```bash\n# Verificar role existe na Conta B\naws iam get-role --role-name CrossAccountS3Reader\n# Esperado: trust policy lista Conta A como principal\n\n# Verificar AssumeRole retorna credenciais temporarias\n# Esperado: AccessKeyId, SecretAccessKey, SessionToken\n```'
      },
      {
        title: 'Configurar Organization CloudTrail',
        instruction: 'Crie um Organization trail que registra todas as contas e Regions em um bucket S3 centralizado na conta log archive.',
        hints: ['Use a flag --is-organization-trail', 'Bucket policy S3 deve permitir CloudTrail da Organization'],
        solution: '```bash\n# Criar Organization trail (a partir da Management Account)\naws cloudtrail create-trail --name org-trail \\\n  --s3-bucket-name bucket-logs-centralizado \\\n  --is-organization-trail \\\n  --is-multi-region-trail \\\n  --enable-log-file-validation\n\n# Iniciar logging\naws cloudtrail start-logging --name org-trail\n```',
        verify: '```bash\naws cloudtrail describe-trails --trail-name-list org-trail\n# Esperado: IsOrganizationTrail = true\n# IsMultiRegionTrail = true\n# S3BucketName = bucket-logs-centralizado\n\naws cloudtrail get-trail-status --name org-trail\n# Esperado: IsLogging = true\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'SCP Bloqueando Acoes Legitimas',
      difficulty: 'hard',
      symptom: 'Admin IAM em conta membro tem AdministratorAccess mas nao consegue executar determinadas acoes. Erro: Access Denied.',
      diagnosis: '```\nFluxo de avaliacao SCP:\n1. Verifique SCPs na OU da conta (e OUs pai)\n2. Se SCP nega a acao -> NEGADO independente do IAM\n3. Se SCP nao permite a acao (modo allow-list) -> NEGADO\n\nDiagnostico:\n  aws organizations list-policies-for-target \\\n    --target-id ID_CONTA --filter SERVICE_CONTROL_POLICY\n  \n  Revise cada SCP por Deny statements ou Allow ausente\n  Verifique OUs pai (SCPs sao herdados)\n  Lembre: Management Account NAO e afetada por SCPs\n\nCausas comuns:\n  - SCP de restricao de Region bloqueando acao naquela Region\n  - SCP de restricao de servico bloqueando o servico especifico\n  - OU pai tem SCP restritivo herdado pelo filho\n```',
      solution: 'Liste todos os SCPs aplicados a conta (incluindo herdados das OUs pai). Verifique Deny explicito ou Allow ausente. SCPs sao avaliados hierarquicamente. Teste na Management Account (isenta de SCPs) para confirmar que SCP e a causa. Use CloudTrail para ver a chamada API negada e mapeie para os statements SCP.'
    },
    {
      title: 'Cross-Account AssumeRole Falha com Access Denied',
      difficulty: 'medium',
      symptom: 'Usuario na Conta A nao consegue assumir role na Conta B apesar da configuracao do trust policy.',
      diagnosis: '```\nAmbos os lados devem estar corretos:\n\n1. Trust Policy na Role (Conta B):\n   Principal deve corresponder a Conta A (account ID ou ARN especifico)\n   Action: sts:AssumeRole\n\n2. Politica IAM no Usuario/Role (Conta A):\n   Deve ter Allow sts:AssumeRole no ARN da role da Conta B\n\n3. SCP (se usando Organizations):\n   SCP na Conta A deve permitir sts:AssumeRole\n   SCP na Conta B deve permitir sts:AssumeRole\n\n4. Permissions Boundary (se aplicado):\n   Deve permitir sts:AssumeRole\n\n5. External ID (se exigido no trust policy):\n   Parametro --external-id deve corresponder\n\nVerificar:\n  aws iam get-role --role-name ROLE (Conta B)\n  Verificar AssumeRolePolicyDocument\n```',
      solution: 'Cross-account requer AMBOS: Trust Policy na Role (quem pode assumir) E permissao IAM no chamador (permitir assumir). Verifique account IDs, formatos ARN, condicoes (ExternalId, MFA). Se usando Organizations, verifique SCPs em ambas as contas permitindo sts:AssumeRole.'
    }
  ]
};
