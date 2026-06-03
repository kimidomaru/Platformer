window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-cost-optimized/cost-management'] = {
  theory: `# Cost Optimization Strategies

## Relevancia no Exame
> **Design Cost-Optimized Architectures** vale **20%** do SAA-C03. Opcoes de compra EC2, tiering de storage, right-sizing e ferramentas de gerenciamento de custo sao temas centrais.

## Opcoes de Compra EC2

| Opcao | Desconto | Compromisso | Caracteristica |
|-------|----------|-------------|----------------|
| **On-Demand** | 0% | Nenhum | Pague por segundo, sem compromisso |
| **Reserved (Standard)** | Ate 72% | 1 ou 3 anos | Nao pode mudar familia da instancia |
| **Reserved (Convertible)** | Ate 66% | 1 ou 3 anos | Pode mudar familia, OS, tenancy |
| **Savings Plans (Compute)** | Ate 66% | 1 ou 3 anos | Qualquer EC2, Fargate, Lambda |
| **Savings Plans (EC2 Instance)** | Ate 72% | 1 ou 3 anos | Familia + Region especificos |
| **Spot Instances** | Ate 90% | Nenhum | Pode ser interrompido com aviso de 2 min |

### Opcoes de Pagamento (Reserved/Savings Plans)
- **All Upfront**: desconto maximo
- **Partial Upfront**: desconto moderado
- **No Upfront**: desconto minimo, ainda com compromisso

### Estrategias de Spot
- **Capacity-optimized**: escolhe pools com mais capacidade disponivel (menor interrupcao)
- **Lowest-price**: mais barato entre pools (maior risco de interrupcao)
- **Diversified**: distribui entre multiplos tipos e AZs
- **Spot Fleet**: mix de Spot + On-Demand, defina capacidade alvo
- Tratar interrupcoes: checkpoint no S3, processamento via SQS, ASG com instancias mistas

## Otimizacao de Custo S3

### Lifecycle Policies
- **Transition rules**: Standard -> Standard-IA (30+ dias) -> Glacier Flexible (90+ dias) -> Deep Archive (180+ dias)
- **Expiration rules**: auto-delete objetos apos X dias
- **Filtro por prefixo/tags**: aplique regras a objetos especificos

### Intelligent-Tiering
- Tiering automatico baseado em padroes de acesso (sem taxas de retrieval)
- Taxa de monitoramento: \\$0.0025 por 1.000 objetos/mes
- Melhor para padroes de acesso imprevisiveis

## Right-Sizing

| Ferramenta | O que Faz |
|------------|-----------|
| **Compute Optimizer** | Recomendacoes ML para EC2, EBS, Lambda, ASG |
| **Trusted Advisor** | Instancias ociosas, EBS subutilizado, EIPs nao usados |
| **CloudWatch** | Metricas CPU/memoria para identificar sub/sobre-provisionamento |
| **Cost Explorer** | Recomendacoes de cobertura e utilizacao RI/SP |

## Ferramentas de Gerenciamento de Custo

| Ferramenta | Proposito |
|------------|-----------|
| **Cost Explorer** | Historico 12 meses, previsao, recomendacoes RI/SP |
| **AWS Budgets** | Alertas custo/uso/reserva, acoes automatizadas (terminar, parar) |
| **Cost Anomaly Detection** | Alertas de anomalia baseados em ML via SNS |
| **Cost and Usage Report** | Relatorio mais granular, exporta para S3, query com Athena |

## Custos de Data Transfer

| Caminho | Custo |
|---------|-------|
| **Inbound** (internet para AWS) | Gratis |
| **Mesmo AZ** (IP privado) | Gratis |
| **Cross-AZ** (mesma Region) | \\$0.01/GB cada direcao |
| **Cross-Region** | \\$0.02/GB (varia) |
| **Outbound** (AWS para internet) | \\$0.09/GB (diminui com volume) |
| **VPC Endpoint** (S3/DynamoDB) | Gratis (Gateway) |
| **NAT Gateway** | \\$0.045/GB processado |

## Erros Comuns

- Confundir Standard RI (nao pode mudar familia) com Convertible RI (pode mudar)
- Nao saber que Compute Savings Plans cobrem EC2 + Fargate + Lambda
- Esquecer que Spot pode ser interrompido (nao usar para bancos ou workloads stateful)
- Usar NAT Gateway quando VPC Gateway Endpoint (gratis para S3) seria suficiente
`,

  quiz: [
    {
      question: 'Qual opcao de compra oferece o maior desconto para EC2?',
      options: ['Convertible Reserved Instance', 'Compute Savings Plan', 'Spot Instance (ate 90% off)', 'Standard Reserved Instance'],
      correct: 2,
      explanation: 'Spot Instances oferecem ate 90% de desconto mas podem ser interrompidas com aviso de 2 minutos. Standard RI ate 72%, Compute SP ate 66%, Convertible RI ate 66%.',
      reference: 'Spot = maior desconto mas interruptivel. RI Standard = melhor para carga constante.'
    },
    {
      question: 'Qual a diferenca entre Standard e Convertible Reserved Instances?',
      options: ['Standard e mais barato', 'Standard nao pode mudar familia de instancia, Convertible pode', 'Convertible nao tem desconto', 'Standard requer compromisso de 3 anos'],
      correct: 1,
      explanation: 'Standard RI: ate 72% off mas travado na familia/OS/tenancy. Convertible RI: ate 66% off mas pode mudar familia, OS, escopo e tenancy.',
      reference: 'Standard = mais desconto, menos flexibilidade. Convertible = menos desconto, flexibilidade total.'
    },
    {
      question: 'Qual Savings Plan cobre EC2, Fargate E Lambda?',
      options: ['EC2 Instance Savings Plan', 'Compute Savings Plan', 'Reserved Instance', 'Spot Savings Plan'],
      correct: 1,
      explanation: 'Compute Savings Plan (ate 66%) aplica-se a qualquer EC2 (qualquer familia, Region, OS), Fargate e Lambda. EC2 Instance SP e travado em familia + Region especificos.',
      reference: 'Compute SP = mais flexivel (EC2+Fargate+Lambda). EC2 Instance SP = mais desconto mas travado.'
    },
    {
      question: 'Qual o custo de transferencia de dados entre duas instancias EC2 na mesma AZ usando IPs privados?',
      options: ['\\$0.01/GB', '\\$0.02/GB', 'Gratis', '\\$0.09/GB'],
      correct: 2,
      explanation: 'Transferencia dentro da mesma AZ usando IPs privados e gratis. Cross-AZ custa \\$0.01/GB cada direcao. Sempre use IPs privados para evitar cobranças.',
      reference: 'Mesma AZ IP privado = gratis. Cross-AZ = \\$0.01/GB. Outbound internet = \\$0.09/GB.'
    },
    {
      question: 'Qual ferramenta fornece recomendacoes de right-sizing baseadas em ML para EC2?',
      options: ['AWS Budgets', 'AWS Compute Optimizer', 'AWS Cost Explorer', 'AWS Trusted Advisor'],
      correct: 1,
      explanation: 'Compute Optimizer usa ML para analisar metricas CloudWatch e recomendar tipos otimos de EC2, EBS, memoria Lambda e configuracoes de ASG.',
      reference: 'Compute Optimizer = right-sizing ML. Trusted Advisor = recursos ociosos. Cost Explorer = analise.'
    },
    {
      question: 'Como funciona o S3 Intelligent-Tiering?',
      options: ['Voce define lifecycle rules manualmente', 'Move objetos automaticamente entre tiers baseado em padroes de acesso', 'So funciona com Glacier', 'Requer capacidade reservada'],
      correct: 1,
      explanation: 'Intelligent-Tiering move objetos automaticamente entre tiers Frequent, Infrequent, Archive Instant, Archive e Deep Archive. Sem taxas de retrieval. Monitoramento \\$0.0025/1000 objetos.',
      reference: 'Intelligent-Tiering = auto-tiering, sem taxas retrieval. Melhor para acesso imprevisivel.'
    },
    {
      question: 'Que acao automatizada o AWS Budgets pode executar quando um threshold e excedido?',
      options: ['Apenas enviar alertas por email', 'Terminar ou parar instancias EC2 via budget actions', 'Redimensionar instancias automaticamente', 'Bloquear todas as chamadas de API'],
      correct: 1,
      explanation: 'AWS Budgets suporta acoes automatizadas: aplicar IAM policies para restringir provisionamento, ou parar/terminar instancias EC2 quando thresholds sao excedidos.',
      reference: 'Budgets = alertas + acoes automatizadas. Cost Explorer = analise. Cost Anomaly = deteccao ML.'
    },
    {
      question: 'Por que usar VPC Gateway Endpoint pode reduzir custos comparado ao NAT Gateway?',
      options: ['Gateway Endpoints tem mais bandwidth', 'Gateway Endpoints para S3/DynamoDB sao gratis, NAT Gateway cobra por GB processado', 'NAT Gateway esta deprecated', 'Gateway Endpoints criptografam dados'],
      correct: 1,
      explanation: 'NAT Gateway cobra \\$0.045/GB processado + taxa horaria. Gateway Endpoints para S3 e DynamoDB sao gratis. Rotear trafego S3 pelo Gateway Endpoint em vez do NAT economiza significativamente.',
      reference: 'Gateway Endpoint (S3/DynamoDB) = gratis. NAT Gateway = \\$0.045/GB + \\$0.045/hora.'
    }
  ],

  flashcards: [
    { front: 'Opcoes de compra EC2 por desconto?', back: 'Spot (ate 90%, interruptivel) > Standard RI / EC2 Instance SP (ate 72%, travado) > Convertible RI / Compute SP (ate 66%, flexivel) > On-Demand (0%). Spot para stateless, RI/SP para carga constante.' },
    { front: 'Standard vs Convertible Reserved Instances?', back: 'Standard: ate 72% off, nao pode mudar familia/OS/tenancy. Convertible: ate 66% off, pode mudar tudo. Ambos: 1 ou 3 anos, All/Partial/No Upfront.' },
    { front: 'Compute SP vs EC2 Instance SP?', back: 'Compute SP: ate 66%, cobre EC2 (qualquer familia/Region/OS) + Fargate + Lambda. EC2 Instance SP: ate 72%, travado em familia + Region. Compute SP e mais flexivel.' },
    { front: 'Como tratar interrupcoes Spot?', back: 'Checkpoint no S3, filas SQS para jobs, diversificar tipos/AZs, ASG com mixed instances policy, estrategia capacity-optimized para menor interrupcao.' },
    { front: 'Otimizacao lifecycle S3?', back: 'Transition: Standard -> Standard-IA (30d) -> Glacier Flexible (90d) -> Deep Archive (180d). Expiration: auto-delete apos X dias. Intelligent-Tiering para acesso imprevisivel (auto-tier, sem retrieval fees).' },
    { front: 'Ferramentas de custo AWS?', back: 'Cost Explorer: analise 12 meses + previsao. Budgets: alertas + acoes auto. Cost Anomaly Detection: alertas ML. CUR: relatorio mais granular S3 + Athena. Compute Optimizer: right-sizing ML.' },
    { front: 'Custos de data transfer?', back: 'Inbound: gratis. Mesma AZ IP privado: gratis. Cross-AZ: \\$0.01/GB cada lado. Outbound internet: \\$0.09/GB. NAT Gateway: \\$0.045/GB. Gateway Endpoint (S3/DynamoDB): gratis.' },
    { front: 'Quando usar Spot vs Reserved vs On-Demand?', back: 'Spot: stateless, fault-tolerant, batch, CI/CD, big data. Reserved/SP: producao constante, bancos, workloads 24/7. On-Demand: curto prazo, imprevisivel, testes. NUNCA Spot para bancos ou stateful.' }
  ],

  lab: {
    scenario: 'Analise e otimize custos de um ambiente AWS de producao.',
    objective: 'Praticar analise de custos com Cost Explorer, right-sizing e otimizacao de compras.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Analisar Custos com Cost Explorer',
        instruction: 'Use Cost Explorer para identificar os 3 servicos mais caros nos ultimos 3 meses e prever custos do proximo mes.',
        hints: ['Agrupe por Service para ver breakdown', 'Use feature Forecast para projecoes'],
        solution: '```bash\n# Custo por servico (ultimos 3 meses)\naws ce get-cost-and-usage \\\n  --time-period Start=2024-01-01,End=2024-04-01 \\\n  --granularity MONTHLY \\\n  --metrics BlendedCost \\\n  --group-by Type=DIMENSION,Key=SERVICE\n\n# Previsao de custo proximo mes\naws ce get-cost-forecast \\\n  --time-period Start=2024-04-01,End=2024-05-01 \\\n  --granularity MONTHLY \\\n  --metric BLENDED_COST\n```',
        verify: '```bash\n# Verificar saida:\n# - Top servicos por custo (geralmente EC2, RDS, S3)\n# - Tendencia mensal (crescendo ou diminuindo)\n# - Valor previsto para proximo mes\n```'
      },
      {
        title: 'Verificar Recomendacoes de Right-Sizing',
        instruction: 'Use Compute Optimizer para obter recomendacoes de right-sizing EC2. Identifique instancias sobre-provisionadas.',
        hints: ['Compute Optimizer precisa ser ativado primeiro', 'Procure instancias onde recomendacao e menor'],
        solution: '```bash\n# Ativar Compute Optimizer\naws compute-optimizer update-enrollment-status --status Active\n\n# Obter recomendacoes EC2\naws compute-optimizer get-ec2-instance-recommendations \\\n  --query "instanceRecommendations[].{Instance:instanceArn,Atual:currentInstanceType,Recomendado:recommendationOptions[0].instanceType,Economia:recommendationOptions[0].estimatedMonthlySavings.value}"\n```',
        verify: '```bash\naws compute-optimizer get-enrollment-status\n# Esperado: status = Active\n# Sobre-provisionado: atual m5.xlarge -> recomendado m5.large\n```'
      },
      {
        title: 'Criar Budget com Alerta',
        instruction: 'Crie um budget mensal de \\$500 com alertas nos thresholds de 80% e 100%.',
        hints: ['Use aws budgets create-budget', 'Defina thresholds como porcentagens'],
        solution: '```bash\naws budgets create-budget --account-id ACCOUNT_ID \\\n  --budget \'{"BudgetName":"mensal-500","BudgetLimit":{"Amount":"500","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}\' \\\n  --notifications-with-subscribers \'[{"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":80},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"admin@example.com"}]},{"Notification":{"NotificationType":"FORECASTED","ComparisonOperator":"GREATER_THAN","Threshold":100},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"admin@example.com"}]}]\'\n```',
        verify: '```bash\naws budgets describe-budget --account-id ACCOUNT_ID \\\n  --budget-name mensal-500\n# Esperado: BudgetLimit = 500 USD, MONTHLY\n# 2 notificacoes: 80% actual, 100% forecasted\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Custos Altos de NAT Gateway por Trafego S3',
      difficulty: 'medium',
      symptom: 'Cobranças de processamento de dados do NAT Gateway estao inesperadamente altas. A maioria do trafego e para S3.',
      diagnosis: '```\nNAT Gateway cobra:\n  \\$0.045/hora + \\$0.045/GB processado\n\nSe maioria do trafego e S3:\n  Route table envia trafego S3 pelo NAT Gateway\n  em vez de usar Gateway Endpoint gratuito\n\nVerifique:\n  aws ec2 describe-route-tables --route-table-ids rtb-xxx\n  Procure rota prefix list S3 vs rota NAT Gateway\n\n  VPC Flow Logs: verifique IPs destino (prefixo S3)\n  NAT Gateway CloudWatch: BytesOutToDestination\n```',
      solution: 'Crie um Gateway VPC Endpoint para S3 (gratis) e associe a route table. Trafego S3 sera roteado pelo endpoint em vez do NAT Gateway. Pode economizar centenas de dolares por mes em workloads pesados de S3.'
    },
    {
      title: 'Reserved Instance Nao Aplicando Desconto',
      difficulty: 'hard',
      symptom: 'Comprou Standard Reserved Instance mas preco On-Demand continua aparecendo na fatura.',
      diagnosis: '```\nRequisitos de match do RI (TODOS devem coincidir):\n  1. Familia da instancia (ex: m5)\n  2. Tamanho (ex: xlarge) ou size-flexible\n  3. Region (ex: us-east-1)\n  4. Plataforma (ex: Linux)\n  5. Tenancy (default vs dedicated)\n  6. Escopo: Regional (qualquer AZ) vs Zonal (AZ especifica)\n\nVerifique:\n  aws ec2 describe-reserved-instances\n  Compare com instancias rodando:\n  aws ec2 describe-instances --query \\\n    "Reservations[].Instances[].{Type:InstanceType,AZ:Placement.AvailabilityZone}"\n\nCausas comuns:\n  - Region ou AZ errada (escopo Zonal)\n  - Plataforma diferente (Windows vs Linux)\n  - Tenancy diferente\n```',
      solution: 'Verifique que todos os atributos do RI coincidem com suas instancias. RIs Regionais sao mais flexiveis (qualquer AZ, size-flexible na familia). Consulte o relatorio de utilizacao de RI no Cost Explorer para ver gaps de cobertura.'
    }
  ]
};
