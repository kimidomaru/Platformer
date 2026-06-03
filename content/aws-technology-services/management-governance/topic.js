window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-technology-services/management-governance'] = {
  theory: `# Management & Governance

## Relevancia no Exame
> Servicos de gerenciamento e governanca aparecem com frequencia no CLF-C02. Saber diferenciar CloudWatch, CloudTrail, Config, Trusted Advisor e Systems Manager e essencial.

## Amazon CloudWatch

Servico de **monitoramento e observabilidade**. Coleta metricas, logs e eventos de recursos AWS.

### Componentes CloudWatch

| Componente | Funcao |
|------------|--------|
| **Metrics** | Metricas de recursos (CPU EC2, NetworkIn, etc.) |
| **Alarms** | Alertas baseados em metricas (ex: CPU > 80%) |
| **Logs** | Agregacao de logs de aplicacoes e servicos |
| **Dashboards** | Visualizacao personalizada de metricas |
| **Events/EventBridge** | Eventos e automacao baseada em mudancas |

### Metricas Default do EC2
- CPUUtilization, NetworkIn, NetworkOut, DiskReadOps
- **NAO inclui**: memory usage, disk space (precisa de CloudWatch Agent)

## AWS CloudTrail

Registra **todas as chamadas API** na conta AWS — quem fez o que, quando, de onde.

- Habilitado por padrao (90 dias de historico)
- Crie um Trail para armazenar em S3 indefinidamente
- Essencial para **auditoria**, compliance e investigacao de seguranca
- Registra: Management Events (control plane) e Data Events (data plane, opcional)

### CloudWatch vs CloudTrail

| Aspecto | CloudWatch | CloudTrail |
|---------|------------|------------|
| **O que faz** | Monitoramento (metricas, logs) | Auditoria (API calls) |
| **Pergunta** | Como esta o recurso? | Quem fez o que? |
| **Exemplo** | CPU do EC2 em 90% | Quem terminou o EC2? |

## AWS Config

Avalia e **audita a configuracao** dos seus recursos AWS. Verifica compliance contra regras.

- Registra historico de mudancas de configuracao
- Regras de compliance (ex: EBS volumes devem ser encrypted)
- Remediation automatico com SSM Automation
- Dashboard de conformidade

### Exemplos de Config Rules
- EBS volumes devem ser encriptados
- Security Groups nao devem permitir SSH de 0.0.0.0/0
- S3 buckets devem ter versioning habilitado
- EC2 instances devem usar approved AMIs

## AWS Trusted Advisor

Analisa sua conta e recomenda melhorias em **5 categorias**:

| Categoria | Exemplos |
|-----------|----------|
| **Cost Optimization** | Instances ociosas, Reserved nao usadas |
| **Performance** | EBS throughput, CloudFront config |
| **Security** | MFA na root, SG rules expostas |
| **Fault Tolerance** | Multi-AZ, backups |
| **Service Limits** | Limites de VPCs, EIPs, etc. |

### Tiers do Trusted Advisor
- **Basic/Developer**: 7 checks basicos (ex: MFA root, SG exposed ports)
- **Business/Enterprise**: TODOS os checks + API access

## AWS Systems Manager (SSM)

Gerenciamento operacional de recursos. Nao precisa SSH — gerencia via SSM Agent.

### Funcionalidades
- **Session Manager**: acesso shell sem SSH (sem porta 22 aberta)
- **Patch Manager**: automacao de patching
- **Parameter Store**: armazenamento seguro de configuracoes e secrets
- **Run Command**: executar comandos em multiplas instances
- **Automation**: runbooks para tarefas operacionais

## AWS Organizations

Gerenciamento centralizado de **multiplas contas AWS**.

| Feature | Descricao |
|---------|-----------|
| **Consolidated Billing** | Uma unica fatura para todas as contas |
| **SCPs** | Service Control Policies — limitar permissoes de contas |
| **OUs** | Organizational Units — agrupar contas |
| **Volume Discounts** | Descontos por uso agregado |

## Outros Servicos de Governanca

| Servico | Descricao |
|---------|-----------|
| **AWS Control Tower** | Setup automatizado de multi-account com guardrails |
| **AWS Service Catalog** | Catalogo de produtos aprovados para self-service |
| **AWS Health Dashboard** | Status de saude dos servicos AWS |
| **AWS Compute Optimizer** | Recomendacoes de right-sizing para EC2 |

## Erros Comuns

- Confundir CloudWatch (monitoramento) com CloudTrail (auditoria de API)
- Achar que CloudWatch monitora memoria por padrao — precisa de Agent
- Confundir Config (compliance de configuracao) com CloudTrail (audit de API)
- Esquecer que Trusted Advisor full requer plano Business/Enterprise
`,

  quiz: [
    {
      question: 'Qual servico AWS registra todas as chamadas API feitas na conta?',
      options: ['Amazon CloudWatch', 'AWS CloudTrail', 'AWS Config', 'AWS Trusted Advisor'],
      correct: 1,
      explanation: 'CloudTrail registra todas as chamadas API — quem, o que, quando, de onde. Essencial para auditoria e investigacao de seguranca.',
      reference: 'CloudWatch = metricas e monitoramento. CloudTrail = auditoria de API calls.'
    },
    {
      question: 'O que o Amazon CloudWatch monitora?',
      options: ['Chamadas API', 'Metricas de recursos, logs e eventos', 'Configuracao de recursos', 'Custos da conta'],
      correct: 1,
      explanation: 'CloudWatch coleta metricas (CPU, rede), logs de aplicacao, e permite criar alarmes e dashboards para monitoramento.',
      reference: 'Para monitorar memoria e disco em EC2, precisa instalar o CloudWatch Agent.'
    },
    {
      question: 'Qual servico avalia a conformidade da configuracao dos recursos AWS?',
      options: ['CloudTrail', 'CloudWatch', 'AWS Config', 'Trusted Advisor'],
      correct: 2,
      explanation: 'AWS Config registra e avalia a configuracao dos recursos contra regras de compliance (ex: EBS must be encrypted, SG rules check).',
      reference: 'Config = compliance de configuracao. CloudTrail = quem mudou. CloudWatch = como esta agora.'
    },
    {
      question: 'AWS Trusted Advisor analisa a conta em quantas categorias?',
      options: ['3', '4', '5', '6'],
      correct: 2,
      explanation: 'Trusted Advisor analisa em 5 categorias: Cost Optimization, Performance, Security, Fault Tolerance e Service Limits.',
      reference: 'Basic/Developer: 7 checks basicos. Business/Enterprise: TODOS os checks.'
    },
    {
      question: 'Qual servico permite acessar EC2 instances sem SSH (sem porta 22)?',
      options: ['AWS CloudShell', 'SSM Session Manager', 'EC2 Instance Connect', 'AWS Direct Connect'],
      correct: 1,
      explanation: 'SSM Session Manager fornece acesso shell a EC2 sem precisar abrir porta 22. Usa SSM Agent para comunicacao segura, auditavel via CloudTrail.',
      reference: 'Mais seguro que SSH — sem chaves, sem portas abertas, com audit trail.'
    },
    {
      question: 'Qual feature do AWS Organizations permite limitar servicos que contas filhas podem usar?',
      options: ['Consolidated Billing', 'Service Control Policies (SCPs)', 'IAM Policies', 'AWS Config Rules'],
      correct: 1,
      explanation: 'SCPs sao guardrails que limitam as permissoes maximas de contas em uma Organization. Mesmo admin da conta filha nao pode ultrapassar o SCP.',
      reference: 'SCPs nao concedem permissoes — apenas restringem. A conta ainda precisa de IAM policies para allow.'
    },
    {
      question: 'O que o AWS Compute Optimizer recomenda?',
      options: ['Configuracao de seguranca', 'Right-sizing de EC2 instances', 'Backup de dados', 'DNS routing'],
      correct: 1,
      explanation: 'Compute Optimizer analisa metricas de uso e recomenda tipos de EC2 instances otimizados (right-sizing), reduzindo custos e melhorando performance.',
      reference: 'Tambem recomenda para EBS volumes, Lambda functions e Auto Scaling Groups.'
    },
    {
      question: 'Qual a diferenca entre CloudWatch e CloudTrail?',
      options: ['CloudWatch e gratuito, CloudTrail e pago', 'CloudWatch monitora performance, CloudTrail audita chamadas API', 'Ambos fazem a mesma coisa', 'CloudTrail e para monitoramento, CloudWatch para auditoria'],
      correct: 1,
      explanation: 'CloudWatch = monitoramento (metricas, logs, alarmes). CloudTrail = auditoria (quem chamou qual API, quando, de onde). Servicos complementares.',
      reference: 'Pergunta classica no CLF-C02: "who terminated the instance?" = CloudTrail.'
    }
  ],

  flashcards: [
    { front: 'Qual a diferenca entre CloudWatch, CloudTrail e Config?', back: 'CloudWatch = monitoramento (metricas, alarmes, logs). CloudTrail = auditoria de API calls (quem fez o que). Config = compliance de configuracao (recurso esta conforme regra?).' },
    { front: 'Quais sao as 5 categorias do Trusted Advisor?', back: 'Cost Optimization, Performance, Security, Fault Tolerance, Service Limits. Basic plan: 7 checks. Business/Enterprise: todos os checks + API access.' },
    { front: 'O que e AWS Systems Manager?', back: 'Gerenciamento operacional: Session Manager (shell sem SSH), Patch Manager (patching automatico), Parameter Store (configs/secrets), Run Command (executar em fleet), Automation (runbooks).' },
    { front: 'O que e AWS Organizations?', back: 'Gerenciamento multi-account: consolidated billing, SCPs (guardrails de permissoes), OUs (agrupar contas), volume discounts. Usado com Control Tower para setup automatizado.' },
    { front: 'Que metricas o CloudWatch NAO monitora por padrao no EC2?', back: 'Memory (RAM) usage e disk space. Essas metricas precisam do CloudWatch Agent instalado na instance. CPU, network e disk I/O sao monitorados por padrao.' },
    { front: 'O que sao SCPs no AWS Organizations?', back: 'Service Control Policies — guardrails que limitam permissoes maximas de contas filhas. Nao concedem permissoes, apenas restringem. Mesmo admin da conta nao pode violar SCP.' },
    { front: 'O que e AWS Control Tower?', back: 'Setup automatizado de ambiente multi-account com guardrails (preventive e detective), landing zone, account factory. Usa Organizations, Config e CloudTrail internamente.' },
    { front: 'O que e AWS Service Catalog?', back: 'Catalogo de produtos de TI aprovados (CloudFormation templates, AMIs) que usuarios podem provisionar self-service. Garante compliance e padronizacao.' }
  ],

  lab: {
    scenario: 'Explore os servicos de gerenciamento e governanca da AWS.',
    objective: 'Diferenciar CloudWatch, CloudTrail e Config e entender quando usar cada um.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Diferenciar os Servicos de Monitoramento',
        instruction: 'Para cada pergunta, identifique qual servico responde: (1) Qual a CPU do meu EC2 agora? (2) Quem deletou meu S3 bucket? (3) Meu Security Group esta aberto para o mundo?',
        hints: ['Performance atual = CloudWatch', 'Quem fez = CloudTrail', 'Configuracao conforme = Config'],
        solution: '```\n1. CPU do EC2 -> Amazon CloudWatch\n   - Metricas de performance em tempo real\n   - Dashboard e alarmes\n\n2. Quem deletou S3 -> AWS CloudTrail\n   - Registro de todas as API calls\n   - Quem, quando, de onde\n\n3. SG aberto -> AWS Config\n   - Config Rule: restricted-ssh\n   - Verifica se SG permite 0.0.0.0/0 na porta 22\n```',
        verify: '```bash\n# Regra de decisao:\n# "Como esta agora?" -> CloudWatch\n# "Quem fez isso?" -> CloudTrail\n# "Esta conforme a regra?" -> Config\n# "O que melhorar?" -> Trusted Advisor\n```'
      },
      {
        title: 'Explorar Trusted Advisor',
        instruction: 'No console AWS, acesse Trusted Advisor. Verifique quais checks estao disponiveis no seu plano e identifique recomendacoes de seguranca.',
        hints: ['Console > Trusted Advisor', 'Basic plan mostra 7 checks gratuitos'],
        solution: '```\nTrusted Advisor > Dashboard\n\nChecks gratuitos (Basic/Developer):\n1. MFA on Root Account\n2. Security Groups — Specific Ports Unrestricted\n3. S3 Bucket Permissions\n4. IAM Use\n5. Service Limits\n6. EBS Public Snapshots\n7. RDS Public Snapshots\n\nChecks pagos (Business/Enterprise):\n- Idle EC2 Instances\n- Underutilized EBS Volumes\n- Unassociated Elastic IPs\n- RDS Multi-AZ\n- + dezenas de outros\n```',
        verify: '```bash\n# Verifique:\n# Quantos checks com status "warning" ou "error"\n# Foque nos de Security primeiro\n# Resultado esperado: dashboard com recomendacoes\n```'
      },
      {
        title: 'Cenario de Governanca Multi-Account',
        instruction: 'Sua empresa tem 5 equipes que precisam de contas AWS separadas. Desenhe a estrutura com Organizations, OUs e SCPs.',
        hints: ['Use OUs para agrupar contas por funcao', 'SCPs restringem o que contas podem fazer'],
        solution: '```\nAWS Organization\n|\n|-- OU: Production\n|   |-- Account: prod-app-1\n|   |-- Account: prod-app-2\n|   SCP: deny delete VPC, deny leave org\n|\n|-- OU: Development\n|   |-- Account: dev-team-1\n|   |-- Account: dev-team-2\n|   SCP: deny launch large instances (> m5.xlarge)\n|\n|-- OU: Security\n|   |-- Account: security-audit\n|   SCP: full access for security tools\n\nConsolidated Billing: unica fatura\nVolume Discounts: uso agregado\n```',
        verify: '```bash\n# Verificacao:\n# [x] Management account na raiz\n# [x] OUs agrupando contas por funcao\n# [x] SCPs restringindo acoes por OU\n# [x] Consolidated billing habilitado\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'CloudWatch vs CloudTrail vs Config',
      difficulty: 'easy',
      symptom: 'Candidato confunde os tres servicos e nao sabe qual usar para cada cenario.',
      diagnosis: '```\nPergunta: "Quanto de CPU meu EC2 esta usando?"\nResposta: CloudWatch (metricas)\n\nPergunta: "Quem terminou meu EC2 ontem?"\nResposta: CloudTrail (auditoria API)\n\nPergunta: "Meus EBS volumes estao encriptados?"\nResposta: AWS Config (compliance)\n\nPergunta: "O que posso melhorar na minha conta?"\nResposta: Trusted Advisor (recomendacoes)\n\nPergunta: "Preciso acessar EC2 sem SSH"\nResposta: SSM Session Manager\n```',
      solution: 'CloudWatch = COMO esta (metricas). CloudTrail = QUEM fez (audit). Config = ESTA conforme (compliance). Trusted Advisor = O QUE melhorar (best practices). SSM = GERENCIAR (operacional).'
    },
    {
      title: 'Memory do EC2 nao aparece no CloudWatch',
      difficulty: 'medium',
      symptom: 'CloudWatch nao mostra metricas de memoria (RAM) do EC2 por padrao.',
      diagnosis: '```\nMetricas DEFAULT do EC2 (sem agent):\n  - CPUUtilization\n  - NetworkIn / NetworkOut\n  - DiskReadOps / DiskWriteOps\n  - StatusCheckFailed\n\nMetricas que PRECISAM de Agent:\n  - Memory utilization\n  - Disk space used\n  - Custom application metrics\n  - Process-level metrics\n\nComo instalar:\n  1. Instalar CloudWatch Agent no EC2\n  2. Configurar metricas desejadas\n  3. IAM Role com permissao CloudWatchAgentServerPolicy\n```',
      solution: 'Memoria e disco nao sao metricas que o hypervisor enxerga de fora — precisam de um agent dentro da instance. No exame, se a questao pedir "monitor memory", a resposta e "install CloudWatch Agent".'
    }
  ]
};
