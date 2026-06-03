window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-billing-pricing/pricing-support'] = {
  theory: `# Pricing Models & Support Plans

## Relevancia no Exame
> O dominio **Billing, Pricing and Support** vale **12%** do CLF-C02. Saber diferenciar modelos de precificacao, ferramentas de billing e support plans e essencial.

## Modelos de Precificacao AWS

### Pay-as-you-go
- Pague apenas pelo que usar, sem contratos
- Sem investimento inicial
- Escalado conforme necessidade

### Save when you commit
- Descontos por compromisso de uso (Reserved Instances, Savings Plans)
- Ate 72% de desconto
- Compromisso de 1 ou 3 anos

### Pay less by using more
- Descontos por volume (ex: S3 armazenamento, data transfer)
- Quanto mais voce usa, menor o preco unitario

## AWS Free Tier

Tres tipos de ofertas:

| Tipo | Descricao | Exemplo |
|------|-----------|---------|
| **Always Free** | Sempre gratuito, sem limite de tempo | Lambda: 1M invocacoes/mes, DynamoDB: 25 GB |
| **12 Months Free** | Gratuito por 12 meses apos criar conta | EC2: 750h t2.micro/mes, S3: 5 GB, RDS: 750h |
| **Trials** | Trial de curto prazo ao ativar servico | Redshift: 2 meses, GuardDuty: 30 dias |

## Ferramentas de Billing e Custos

| Ferramenta | Funcao |
|------------|--------|
| **AWS Pricing Calculator** | Estimar custos ANTES de usar (pre-deploy) |
| **AWS Cost Explorer** | Analisar custos HISTORICOS com graficos e filtros |
| **AWS Budgets** | Definir orcamentos e receber alertas quando se aproximar |
| **AWS Cost and Usage Report** | Relatorio detalhado de uso (mais granular, para download) |
| **AWS Billing Dashboard** | Visao geral da fatura atual |

### AWS Pricing Calculator
- Ferramenta web para estimar custos de arquiteturas
- Selecione servicos, configure parametros, veja custo mensal estimado
- Util ANTES de deployar (planejamento)

### AWS Cost Explorer
- Visualize custos dos ultimos 12 meses
- Filtre por servico, Region, tag, conta
- Previsao de custos futuros (forecast)
- Identifique tendencias de gasto

### AWS Budgets
- Defina limites de custo, uso ou reservas
- Alertas por email/SNS quando atingir % do orcamento
- Budget types: Cost, Usage, Reservation, Savings Plans

## Support Plans

| Plano | Preco | TAM | Trusted Advisor | Tempo Resposta (Critical) |
|-------|-------|-----|-----------------|--------------------------|
| **Basic** | Gratis | Nao | 7 checks | N/A (sem suporte tecnico) |
| **Developer** | \$29+/mes | Nao | 7 checks | 12 horas (business hours) |
| **Business** | \$100+/mes | Nao | TODOS os checks | 1 hora |
| **Enterprise On-Ramp** | \$5,500+/mes | Pool | TODOS os checks | 30 minutos |
| **Enterprise** | \$15,000+/mes | Dedicado | TODOS os checks | 15 minutos |

### TAM — Technical Account Manager
- Disponivel apenas nos planos Enterprise On-Ramp e Enterprise
- Ponto de contato tecnico dedicado
- Revisoes arquiteturais, otimizacao, well-architected reviews

### Concierge Support Team
- Disponivel nos planos Enterprise
- Assistencia para billing e account
- Ajuda com melhores praticas de billing

## Billing Consolidado (Organizations)

- Uma unica fatura para todas as contas da Organization
- Descontos por volume agregado entre contas
- Reserved Instances e Savings Plans compartilhados entre contas
- Faturamento detalhado por conta individual

## Tags de Alocacao de Custos

- Tags que voce adiciona aos recursos para rastrear custos
- Exemplo: Environment:Production, Team:Backend, Project:AppX
- Habilitadas no Billing console
- Aparecem no Cost Explorer e Cost and Usage Report

## Erros Comuns

- Confundir Pricing Calculator (estimativa) com Cost Explorer (historico)
- Esquecer que TAM so existe no Enterprise (On-Ramp ou full)
- Achar que Basic Support tem suporte tecnico — nao tem
- Confundir Budgets (alertas de orcamento) com Cost Explorer (analise de custos)
`,

  quiz: [
    {
      question: 'Qual ferramenta AWS permite estimar custos ANTES de deployar uma arquitetura?',
      options: ['AWS Cost Explorer', 'AWS Budgets', 'AWS Pricing Calculator', 'AWS Cost and Usage Report'],
      correct: 2,
      explanation: 'AWS Pricing Calculator e a ferramenta web para estimar custos antes de usar. Cost Explorer mostra custos historicos, Budgets define limites.',
      reference: 'Pricing Calculator = pre-deploy. Cost Explorer = pos-deploy (analise historica).'
    },
    {
      question: 'Qual Support Plan oferece um Technical Account Manager (TAM) dedicado?',
      options: ['Business', 'Developer', 'Enterprise', 'Basic'],
      correct: 2,
      explanation: 'Apenas o plano Enterprise tem TAM dedicado. Enterprise On-Ramp tem pool de TAMs. Business e Developer nao tem TAM.',
      reference: 'Enterprise = TAM dedicado + 15 min response. Enterprise On-Ramp = TAM pool + 30 min response.'
    },
    {
      question: 'Qual e o tempo de resposta para incidentes criticos no plano Business?',
      options: ['15 minutos', '30 minutos', '1 hora', '12 horas'],
      correct: 2,
      explanation: 'O plano Business tem tempo de resposta de 1 hora para incidentes criticos (system impaired). Enterprise tem 15 min, On-Ramp tem 30 min.',
      reference: 'Basic: sem suporte tecnico. Developer: 12h. Business: 1h. Enterprise: 15min.'
    },
    {
      question: 'Qual tipo de Free Tier o AWS Lambda oferece?',
      options: ['12 Months Free', 'Always Free', 'Trial', 'Nenhum'],
      correct: 1,
      explanation: 'Lambda tem Always Free tier: 1 milhao de invocacoes por mes e 400.000 GB-segundo de compute, indefinidamente (sem limite de tempo).',
      reference: 'Always Free: Lambda, DynamoDB (25 GB), SNS, SQS. 12 meses: EC2 t2.micro, S3 5 GB, RDS.'
    },
    {
      question: 'O que o AWS Budgets faz?',
      options: ['Analisa custos historicos com graficos', 'Define limites de orcamento e envia alertas', 'Estima custos de novas arquiteturas', 'Gera relatorios detalhados de uso'],
      correct: 1,
      explanation: 'AWS Budgets permite definir orcamentos de custo, uso ou reservas e receber alertas quando se aproximar ou ultrapassar o limite definido.',
      reference: 'Budgets = alertas proativos. Cost Explorer = analise retroativa. Pricing Calculator = estimativa.'
    },
    {
      question: 'Quantos checks do Trusted Advisor estao disponiveis no plano Basic?',
      options: ['0', '7', 'Todos', '15'],
      correct: 1,
      explanation: 'O plano Basic oferece 7 checks gratuitos do Trusted Advisor (MFA root, SG exposed, S3 permissions, etc). Todos os checks requerem Business ou superior.',
      reference: '7 checks basicos = Basic/Developer. Todos os checks = Business/Enterprise.'
    },
    {
      question: 'Qual beneficio o Consolidated Billing do AWS Organizations oferece?',
      options: ['Suporte tecnico gratuito', 'Descontos por volume agregado entre contas', 'TAM dedicado', 'Free Tier estendido'],
      correct: 1,
      explanation: 'Consolidated Billing agrega uso de todas as contas para volume discounts. Reserved Instances e Savings Plans podem ser compartilhados entre contas.',
      reference: 'Uma unica fatura + descontos por volume + RI/SP sharing.'
    },
    {
      question: 'O que sao Cost Allocation Tags?',
      options: ['Tags de seguranca para IAM', 'Tags para rastrear custos por recurso', 'Tags de roteamento DNS', 'Tags de prioridade de suporte'],
      correct: 1,
      explanation: 'Cost Allocation Tags sao tags que voce adiciona aos recursos (ex: Team:Backend, Environment:Prod) para rastrear e alocar custos no Cost Explorer e reports.',
      reference: 'Habilite no Billing console. AWS-generated tags (aws:createdBy) e user-defined tags.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os 3 modelos de precificacao AWS?', back: 'Pay-as-you-go (pague pelo uso), Save when you commit (Reserved/Savings Plans, ate 72% off), Pay less by using more (descontos por volume). Sem contratos obrigatorios.' },
    { front: 'Qual a diferenca entre Pricing Calculator, Cost Explorer e Budgets?', back: 'Pricing Calculator = estimar custos ANTES de usar. Cost Explorer = analisar custos HISTORICOS. Budgets = definir limites e receber ALERTAS quando se aproximar.' },
    { front: 'Quais sao os AWS Support Plans?', back: 'Basic (gratis, sem suporte tecnico), Developer ($29+, 12h response), Business ($100+, 1h, full Trusted Advisor), Enterprise On-Ramp ($5500+, 30min, TAM pool), Enterprise ($15000+, 15min, TAM dedicado).' },
    { front: 'Quais sao os 3 tipos de AWS Free Tier?', back: 'Always Free (sem limite de tempo: Lambda 1M req, DynamoDB 25 GB). 12 Months Free (EC2 t2.micro 750h, S3 5 GB). Trials (servico-especifico: GuardDuty 30 dias, Redshift 2 meses).' },
    { front: 'O que e um TAM (Technical Account Manager)?', back: 'Ponto de contato tecnico da AWS dedicado a sua conta. Faz revisoes arquiteturais, well-architected reviews, otimizacao. Disponivel apenas em Enterprise On-Ramp (pool) e Enterprise (dedicado).' },
    { front: 'O que e AWS Cost and Usage Report?', back: 'Relatorio mais detalhado e granular de uso e custos AWS. Pode ser exportado para S3. Usado para analise profunda, integracao com BI tools (Athena, QuickSight). Mais detalhado que Cost Explorer.' },
    { front: 'O que e Consolidated Billing?', back: 'Feature do AWS Organizations. Uma fatura para todas as contas. Descontos por volume agregado. Reserved Instances e Savings Plans compartilhados. Rastreamento por conta individual.' },
    { front: 'O que sao Cost Allocation Tags?', back: 'Tags em recursos AWS para rastrear custos: Environment:Prod, Team:Backend, Project:AppX. Habilitadas no Billing console. Aparecem no Cost Explorer e Cost & Usage Report.' }
  ],

  lab: {
    scenario: 'Explore as ferramentas de billing e precificacao da AWS.',
    objective: 'Usar Pricing Calculator, Cost Explorer e Budgets para planejar e monitorar custos.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Estimar Custos com Pricing Calculator',
        instruction: 'Acesse calculator.aws e estime o custo mensal de: 1 EC2 t3.medium (On-Demand, us-east-1, 24/7), 100 GB S3 Standard, 1 RDS db.t3.micro MySQL Multi-AZ.',
        hints: ['calculator.aws e a URL do Pricing Calculator', 'Selecione Region us-east-1 para precos menores'],
        solution: '```\nEstimativa (us-east-1, precos aproximados 2024):\n\nEC2 t3.medium On-Demand:\n  730 horas x $0.0416/h = ~$30/mes\n\nS3 Standard 100 GB:\n  100 GB x $0.023/GB = ~$2.30/mes\n\nRDS db.t3.micro MySQL Multi-AZ:\n  730 horas x $0.034/h = ~$25/mes\n\nTotal estimado: ~$57/mes\n```',
        verify: '```bash\n# Acesse calculator.aws\n# Adicione EC2, S3 e RDS\n# Configure conforme especificado\n# Verifique total mensal estimado\n# Resultado esperado: ~$50-60/mes\n```'
      },
      {
        title: 'Explorar Cost Explorer',
        instruction: 'No console AWS, acesse Cost Explorer. Visualize custos dos ultimos 3 meses por servico. Identifique qual servico tem o maior custo.',
        hints: ['Billing > Cost Explorer', 'Use filtro "Group by: Service"'],
        solution: '```\nCost Explorer > Last 3 Months > Group by Service\n\nResultado tipico:\n1. EC2 (instances + EBS) - geralmente o maior custo\n2. RDS - databases\n3. S3 - storage\n4. Data Transfer - trafego entre Regions/internet\n5. CloudWatch - logs e metricas\n\nUse "Forecast" para ver projecao do mes atual\n```',
        verify: '```bash\n# Verifique:\n# [x] Grafico de custos por servico\n# [x] Tendencia de gastos (crescendo ou diminuindo)\n# [x] Forecast do proximo mes\n# Resultado: identificacao do servico mais caro\n```'
      },
      {
        title: 'Criar um Budget',
        instruction: 'Crie um AWS Budget de custo mensal de $100 com alertas em 50%, 80% e 100% do orcamento.',
        hints: ['Billing > Budgets > Create Budget', 'Configure email para receber alertas'],
        solution: '```\nAWS Budgets > Create Budget > Cost Budget\n\nNome: monthly-cost-budget\nAmount: $100/mes\n\nAlertas:\n1. Alerta em 50% ($50) - actual cost\n2. Alerta em 80% ($80) - actual cost\n3. Alerta em 100% ($100) - forecasted cost\n\nNotificacao: email do responsavel\n```',
        verify: '```bash\n# Verifique:\n# Billing > Budgets\n# Budget criado com 3 alertas\n# Status: dentro ou fora do orcamento\n# Resultado: alertas configurados para custo mensal\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pricing Calculator vs Cost Explorer',
      difficulty: 'easy',
      symptom: 'Candidato confunde as duas ferramentas e quando usar cada uma.',
      diagnosis: '```\nAWS Pricing Calculator:\n  - Para ESTIMAR custos de novas arquiteturas\n  - ANTES de deployar\n  - URL: calculator.aws\n  - Sem dados reais da conta\n\nAWS Cost Explorer:\n  - Para ANALISAR custos historicos\n  - DEPOIS de usar\n  - No console AWS (Billing)\n  - Com dados reais da sua conta\n\nAWS Budgets:\n  - Para definir LIMITES e receber ALERTAS\n  - Proativo (avisa antes de estourar)\n  - Integra com SNS para notificacoes\n```',
      solution: 'Pricing Calculator = "quanto vai custar?" (antes). Cost Explorer = "quanto custou?" (depois). Budgets = "me avise quando chegar em X" (proativo). Sao complementares.'
    },
    {
      title: 'Escolher o Support Plan Correto',
      difficulty: 'medium',
      symptom: 'Candidato nao sabe qual Support Plan e adequado para cada cenario.',
      diagnosis: '```\nBasic:\n  - Estudante, individual, explorando AWS\n  - Sem suporte tecnico (apenas documentacao)\n\nDeveloper:\n  - Desenvolvedor testando/experimentando\n  - Suporte por email, horario comercial\n\nBusiness:\n  - Empresa com workloads de producao\n  - Suporte 24/7 por telefone\n  - Full Trusted Advisor\n  - 1h response para critical\n\nEnterprise On-Ramp:\n  - Empresa com workloads criticos\n  - TAM pool, 30 min response\n\nEnterprise:\n  - Grande empresa, missao critica\n  - TAM dedicado, 15 min response\n  - Concierge support\n```',
      solution: 'No exame, identifique palavras-chave: "24/7 phone support" = Business+. "TAM" = Enterprise. "15 min response" = Enterprise. "Trusted Advisor full" = Business+. "Free" = Basic.'
    }
  ]
};
