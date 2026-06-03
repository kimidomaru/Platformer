window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-security-compliance/shared-responsibility'] = {
  theory: `# Shared Responsibility Model

## Relevancia no Exame
> O Shared Responsibility Model aparece em **muitas** questoes do CLF-C02. Entenda claramente o que e responsabilidade da AWS vs do cliente.

## O Modelo de Responsabilidade Compartilhada

A seguranca na AWS e uma **responsabilidade compartilhada** entre a AWS e o cliente:

- **AWS**: responsavel pela seguranca **DA** nuvem (infraestrutura)
- **Cliente**: responsavel pela seguranca **NA** nuvem (dados e configuracoes)

## Responsabilidades da AWS (Security OF the Cloud)

| Camada | Responsabilidade AWS |
|--------|---------------------|
| **Hardware/Global Infra** | Data centers fisicos, rede global, Regions, AZs, Edge Locations |
| **Software** | Hypervisor, host OS, compute/storage/database/networking software |
| **Rede** | Infraestrutura de rede global, fibra entre AZs e Regions |
| **Compliance** | Certificacoes (SOC, ISO, PCI-DSS), auditorias |
| **Managed Services** | Patching de servicos gerenciados (RDS, Lambda, DynamoDB) |

## Responsabilidades do Cliente (Security IN the Cloud)

| Camada | Responsabilidade do Cliente |
|--------|---------------------------|
| **Dados** | Encriptacao, classificacao, protecao de dados |
| **Identidade** | IAM users, MFA, password policies, roles |
| **Aplicacao** | Firewall de aplicacao, codigo seguro |
| **OS/Rede** | Patching de EC2, security groups, NACLs |
| **Encriptacao** | Client-side e server-side encryption, gerenciamento de chaves |

## Responsabilidade Varia por Servico

### IaaS (ex: EC2) — Mais responsabilidade do cliente
- Cliente: patching OS, firewall (SG), antivirus, dados
- AWS: hardware, hypervisor, rede fisica

### PaaS (ex: RDS) — Responsabilidade compartilhada
- Cliente: dados, acesso (IAM), security groups, encriptacao
- AWS: OS patching, engine patching, hardware, backups automaticos

### SaaS/Serverless (ex: Lambda, S3)  — Mais responsabilidade da AWS
- Cliente: dados, acesso (IAM policies), encriptacao
- AWS: tudo mais (infra, runtime, patching, scaling)

### Container Services
- **ECS/EKS on EC2**: cliente faz patching dos EC2 worker nodes
- **Fargate**: AWS gerencia a infraestrutura, cliente gerencia containers

## Servicos de Seguranca da AWS

| Servico | Funcao |
|---------|--------|
| **AWS Shield** | Protecao DDoS (Standard gratuito, Advanced pago) |
| **AWS WAF** | Web Application Firewall (protecao L7) |
| **Amazon GuardDuty** | Deteccao de ameacas com ML (analisa logs) |
| **Amazon Inspector** | Scan de vulnerabilidades em EC2 e containers |
| **Amazon Macie** | Descoberta de dados sensiveis em S3 (PII) |
| **AWS Config** | Auditoria de conformidade de recursos |
| **AWS CloudTrail** | Log de todas as chamadas API (quem fez o que) |
| **AWS Artifact** | Acesso a relatorios de compliance (SOC, PCI, ISO) |
| **AWS Security Hub** | Dashboard centralizado de seguranca |
| **Amazon Detective** | Investigacao de incidentes de seguranca |

## Compliance na AWS

### AWS Artifact
Portal de acesso a relatorios de compliance e acordos:
- **Artifact Reports**: SOC 1/2/3, PCI DSS, ISO 27001, HIPAA
- **Artifact Agreements**: BAA (HIPAA), GDPR DPA

### Programas de Compliance
A AWS mantem certificacoes para: SOC 1/2/3, PCI DSS Level 1, ISO 27001/27017/27018, HIPAA, FedRAMP, LGPD compliance.

## Erros Comuns

- Achar que a AWS e responsavel por patching de EC2 — EC2 e IaaS, o cliente faz patching
- Confundir Shield (DDoS) com WAF (L7 firewall) com GuardDuty (threat detection)
- Esquecer que o cliente SEMPRE e responsavel pelos dados e controle de acesso
- Achar que RDS patching e responsabilidade do cliente — AWS faz patching do engine e OS
`,

  quiz: [
    {
      question: 'No Shared Responsibility Model, quem e responsavel pelo patching do sistema operacional de EC2 instances?',
      options: ['AWS', 'O cliente', 'Compartilhado igualmente', 'Depende da Region'],
      correct: 1,
      explanation: 'EC2 e IaaS — o cliente e responsavel pelo patching do OS, configuracao de firewall e seguranca da aplicacao. A AWS cuida do hardware e hypervisor.',
      reference: 'Compare com RDS onde a AWS faz o patching do OS e engine.'
    },
    {
      question: 'Qual servico AWS fornece protecao contra ataques DDoS?',
      options: ['AWS WAF', 'AWS Shield', 'Amazon GuardDuty', 'Amazon Inspector'],
      correct: 1,
      explanation: 'AWS Shield fornece protecao DDoS. Shield Standard e gratuito e automatico. Shield Advanced oferece protecao adicional e suporte dedicado (pago).',
      reference: 'WAF protege contra ataques L7 (SQL injection, XSS). Shield protege contra DDoS (L3/L4).'
    },
    {
      question: 'Qual servico analisa logs para detectar ameacas usando machine learning?',
      options: ['AWS Config', 'Amazon Inspector', 'Amazon GuardDuty', 'AWS CloudTrail'],
      correct: 2,
      explanation: 'GuardDuty usa ML para analisar CloudTrail logs, VPC Flow Logs e DNS logs para detectar atividades suspeitas e ameacas.',
      reference: 'Inspector faz scan de vulnerabilidades. Config audita conformidade. CloudTrail registra API calls.'
    },
    {
      question: 'No modelo de responsabilidade compartilhada, quem e responsavel pela encriptacao dos dados do cliente?',
      options: ['Somente a AWS', 'Somente o cliente', 'O cliente (AWS fornece ferramentas)', 'Depende do servico'],
      correct: 2,
      explanation: 'O cliente e SEMPRE responsavel por encriptar seus dados. A AWS fornece ferramentas como KMS, mas a decisao e configuracao de encriptacao e do cliente.',
      reference: 'O cliente decide: encriptar ou nao, qual chave usar, quem tem acesso.'
    },
    {
      question: 'Qual servico AWS fornece acesso a relatorios de compliance como SOC e PCI DSS?',
      options: ['AWS Config', 'AWS CloudTrail', 'AWS Artifact', 'AWS Security Hub'],
      correct: 2,
      explanation: 'AWS Artifact e o portal para baixar relatorios de compliance (SOC, PCI, ISO) e assinar acordos (BAA para HIPAA, DPA para GDPR).',
      reference: 'Artifact Reports = download de relatorios. Artifact Agreements = assinar acordos.'
    },
    {
      question: 'Para Amazon RDS, quem e responsavel pelo patching do database engine?',
      options: ['O cliente', 'A AWS', 'Compartilhado', 'O provedor do database'],
      correct: 1,
      explanation: 'RDS e um servico gerenciado — a AWS e responsavel pelo patching do OS e do database engine. O cliente e responsavel pelos dados, acesso e configuracao de seguranca.',
      reference: 'Compare: EC2 (cliente faz patching) vs RDS (AWS faz patching).'
    },
    {
      question: 'Qual servico descobre dados sensiveis (PII) armazenados no Amazon S3?',
      options: ['Amazon Inspector', 'Amazon Macie', 'AWS Config', 'Amazon GuardDuty'],
      correct: 1,
      explanation: 'Amazon Macie usa ML para descobrir, classificar e proteger dados sensiveis (PII, dados financeiros) armazenados no S3.',
      reference: 'Inspector = vulnerabilidades em EC2/containers. Macie = dados sensiveis em S3.'
    },
    {
      question: 'AWS CloudTrail registra qual tipo de informacao?',
      options: ['Metricas de performance', 'Chamadas API feitas na conta AWS', 'Dados de billing', 'Status de saude dos servicos'],
      correct: 1,
      explanation: 'CloudTrail registra todas as chamadas API feitas na conta AWS — quem fez, o que fez, quando, de onde. Essencial para auditoria e compliance.',
      reference: 'CloudTrail = API audit log. CloudWatch = metricas e logs de aplicacao.'
    }
  ],

  flashcards: [
    { front: 'O que significa "Security OF the Cloud" vs "Security IN the Cloud"?', back: 'OF = responsabilidade da AWS (infraestrutura fisica, hypervisor, rede global). IN = responsabilidade do cliente (dados, IAM, OS patching em EC2, encriptacao, firewall).' },
    { front: 'Qual a diferenca entre AWS Shield e AWS WAF?', back: 'Shield = protecao DDoS (L3/L4). Shield Standard e gratuito. WAF = Web Application Firewall (L7), protege contra SQL injection, XSS. Ambos podem ser usados juntos.' },
    { front: 'O que e Amazon GuardDuty?', back: 'Servico de deteccao de ameacas que usa ML para analisar CloudTrail logs, VPC Flow Logs e DNS logs. Identifica atividades suspeitas como crypto-mining, acesso anomalo, comunicacao com IPs maliciosos.' },
    { front: 'O que e AWS Artifact?', back: 'Portal para acessar relatorios de compliance (SOC 1/2/3, PCI DSS, ISO 27001) e assinar acordos regulatorios (BAA para HIPAA, DPA para GDPR). Nao e um servico tecnico, e documental.' },
    { front: 'Como varia a responsabilidade por tipo de servico?', back: 'IaaS (EC2): cliente faz mais (OS patching). PaaS (RDS): AWS faz patching, cliente cuida de dados. Serverless (Lambda): AWS faz quase tudo, cliente cuida de dados e codigo.' },
    { front: 'O que e Amazon Inspector?', back: 'Servico que faz scan automatico de vulnerabilidades em EC2 instances e container images (ECR). Verifica CVEs, exposicao de rede e boas praticas. Diferente de GuardDuty (ameacas) e Macie (PII).' },
    { front: 'O que e Amazon Macie?', back: 'Servico que usa ML para descobrir e proteger dados sensiveis (PII, dados financeiros, credenciais) armazenados no Amazon S3. Gera alertas sobre dados expostos ou desprotegidos.' },
    { front: 'O que e AWS Security Hub?', back: 'Dashboard centralizado que agrega findings de GuardDuty, Inspector, Macie, Firewall Manager e parceiros. Visao unificada de seguranca com score de compliance e priorizacao de alertas.' }
  ],

  lab: {
    scenario: 'Analise cenarios do Shared Responsibility Model e classifique responsabilidades.',
    objective: 'Identificar corretamente o que e responsabilidade da AWS vs do cliente em diferentes cenarios.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Classificar Responsabilidades',
        instruction: 'Para cada item, classifique se e responsabilidade da AWS ou do Cliente: patching de EC2, seguranca fisica do data center, configuracao de Security Groups, patching de RDS engine, encriptacao de dados no S3.',
        hints: ['Pense: quem tem controle sobre esse item?', 'Servicos gerenciados = AWS faz mais'],
        solution: '```\nAWS:\n  - Seguranca fisica do data center\n  - Patching do RDS engine e OS\n  - Infraestrutura de rede global\n\nCliente:\n  - Patching de EC2 OS\n  - Configuracao de Security Groups\n  - Encriptacao de dados no S3\n  - IAM users e permissoes\n  - MFA\n```',
        verify: '```bash\n# Verificacao conceitual:\n# EC2 OS patching = Cliente (IaaS)\n# RDS engine patching = AWS (PaaS managed)\n# S3 encryption = Cliente (decisao de encriptar)\n# Data center security = AWS (sempre)\n# Security Groups = Cliente (configuracao)\n```'
      },
      {
        title: 'Explorar Servicos de Seguranca',
        instruction: 'No console AWS, navegue ate GuardDuty, Inspector e Security Hub. Verifique quais estao habilitados na sua conta.',
        hints: ['Muitos tem free trial de 30 dias', 'Security Hub agrega findings de outros servicos'],
        solution: '```\n1. Console > GuardDuty > verificar se esta habilitado\n2. Console > Inspector > verificar scan status\n3. Console > Security Hub > ver dashboard de findings\n\nServicos gratuitos:\n- CloudTrail (1 trail gratis)\n- Shield Standard (automatico)\n- IAM Access Analyzer\n- AWS Config (pago por regra)\n```',
        verify: '```bash\n# Via CLI:\naws guardduty list-detectors\n# Saida com detector ID = habilitado\n\naws securityhub describe-hub\n# Saida com HubArn = habilitado\n```'
      },
      {
        title: 'Consultar AWS Artifact',
        instruction: 'Acesse AWS Artifact no console e explore os relatorios de compliance disponiveis. Identifique relatorios SOC e ISO.',
        hints: ['Console > Artifact > Reports', 'Os relatorios requerem aceitar NDA'],
        solution: '```\nAWS Artifact > Reports:\n- SOC 1 Type II\n- SOC 2 Type II\n- SOC 3\n- PCI DSS Level 1\n- ISO 27001\n- ISO 27017\n- ISO 27018\n\nAWS Artifact > Agreements:\n- BAA (Business Associate Agreement) para HIPAA\n- DPA (Data Processing Agreement) para GDPR\n```',
        verify: '```bash\n# Verificacao manual:\n# Acesse Console > Artifact\n# Verifique que os relatorios estao listados\n# Nota: download requer aceitar NDA\n# Resultado esperado: lista de relatorios SOC e ISO\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Quem faz patching? EC2 vs RDS vs Lambda',
      difficulty: 'easy',
      symptom: 'Candidato nao sabe responder quem e responsavel por patching em diferentes servicos.',
      diagnosis: '```\nRegra simples:\n\nEC2 (IaaS):\n  OS patching = CLIENTE\n  App patching = CLIENTE\n  Hardware = AWS\n\nRDS (PaaS managed):\n  OS patching = AWS\n  Engine patching = AWS\n  Data/access = CLIENTE\n\nLambda (Serverless):\n  Runtime patching = AWS\n  Code = CLIENTE\n  Data = CLIENTE\n\nFargate (Serverless containers):\n  Infra = AWS\n  Container image = CLIENTE\n```',
      solution: 'Quanto mais gerenciado o servico, menos o cliente faz. IaaS = cliente faz mais. Serverless = cliente faz menos. O cliente SEMPRE e responsavel pelos dados e acesso.'
    },
    {
      title: 'Confusao Shield vs WAF vs GuardDuty',
      difficulty: 'medium',
      symptom: 'Candidato confunde os tres servicos de seguranca — todos "protegem" mas de formas diferentes.',
      diagnosis: '```\nAWS Shield:\n  Protege contra: DDoS (L3/L4)\n  Como: absorve e mitiga trafego malicioso\n  Standard: gratuito, automatico\n  Advanced: pago, suporte dedicado, cost protection\n\nAWS WAF:\n  Protege contra: ataques L7 (SQL injection, XSS)\n  Como: regras customizaveis, IP blocking, rate limiting\n  Funciona com: CloudFront, ALB, API Gateway\n\nAmazon GuardDuty:\n  Protege contra: ameacas (threat detection)\n  Como: ML analisa logs (CloudTrail, VPC Flow, DNS)\n  Detecta: crypto-mining, compromised instances, anomalias\n```',
      solution: 'Shield = DDoS. WAF = ataques web (L7). GuardDuty = deteccao de ameacas via logs. Inspector = scan de vulnerabilidades. Macie = dados sensiveis. Memorize cada um com uma palavra-chave.'
    }
  ]
};
