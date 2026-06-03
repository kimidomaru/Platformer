window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-org-complexity/cost-optimization-pro'] = {
  theory: `# AWS Cost Optimization Avançado (SAP-C02)

## Relevância no Exame
> Peso estimado **10-15%** no SAP-C02. Questões sobre estratégias de savings com Reserved Instances, Savings Plans, Spot, rightsizing e controle de custos em organizações multi-account.

## Hierarquia de Savings no AWS

\`\`\`
Custo base (On-Demand)
  ↓ 20-40% desconto
Savings Plans (flexible, $/hora commitment)
  ↓ 40-66% desconto
Reserved Instances (specific resource commitment)
  ↓ até 90% desconto
Spot Instances (excess capacity, interruptível)
\`\`\`

## Savings Plans vs Reserved Instances

| | Savings Plans | Reserved Instances |
|-|--------------|-------------------|
| Compromisso | $/hora de uso | Capacidade específica |
| Flexibilidade | Alta (Compute SP: qualquer familia, região) | Baixa (Standard RI) ou média (Convertible RI) |
| Desconto | Até 66% | Até 72% |
| Marketplace | Não | Sim (Standard RI) |
| Serviços | EC2, Lambda, Fargate | EC2, RDS, ElastiCache, Redshift, etc. |

\`\`\`bash
# Ver recomendações de Savings Plans
aws ce get-savings-plans-purchase-recommendation \
  --savings-plans-type COMPUTE_SP \
  --term-in-years ONE_YEAR \
  --payment-option NO_UPFRONT \
  --lookback-period-in-days SIXTY_DAYS

# Ver economia estimada de Reserved Instances
aws ce get-reservation-purchase-recommendation \
  --service EC2-Instance \
  --term-in-years ONE_YEAR \
  --lookback-period-in-days SIXTY_DAYS
\`\`\`

## Spot Instances — Design para Interrupção

### Estratégias de uso de Spot

\`\`\`bash
# Launch Template com Mixed Instances Policy (ASG)
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name mixed-fleet \
  --mixed-instances-policy '{
    "LaunchTemplate": {
      "LaunchTemplateSpecification": {
        "LaunchTemplateName": "my-lt",
        "Version": "$Latest"
      },
      "Overrides": [
        {"InstanceType": "m5.large"},
        {"InstanceType": "m5a.large"},
        {"InstanceType": "m4.large"}
      ]
    },
    "InstancesDistribution": {
      "OnDemandBaseCapacity": 2,
      "OnDemandPercentageAboveBaseCapacity": 20,
      "SpotAllocationStrategy": "capacity-optimized"
    }
  }' \
  --min-size 4 --max-size 20
\`\`\`

### Spot Interruption Handling

\`\`\`python
# Handler de interrução do Spot (2 minutos de aviso)
import boto3, requests, threading, time

def check_interruption():
    while True:
        try:
            response = requests.get(
                "http://169.254.169.254/latest/meta-data/spot/interruption-notice",
                timeout=1
            )
            if response.status_code == 200:
                print("Spot interruption in 2 minutes!")
                graceful_shutdown()
                break
        except requests.exceptions.RequestException:
            pass
        time.sleep(5)

def graceful_shutdown():
    # 1. Parar de aceitar novas tarefas
    # 2. Salvar estado atual
    # 3. Desregistrar do load balancer
    # 4. Finalizar tarefas em andamento
    pass

threading.Thread(target=check_interruption, daemon=True).start()
\`\`\`

## AWS Cost Management em Organizations

\`\`\`bash
# Habilitar Cost Allocation Tags
aws ce create-cost-category-definition \
  --name "Environment" \
  --rules '[
    {"Value": "production", "Rule": {"Tags": {"Key": "env", "Values": ["prod"]}}},
    {"Value": "development", "Rule": {"Tags": {"Key": "env", "Values": ["dev","staging"]}}}
  ]'

# Criar Budget com alerta
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "monthly-budget",
    "BudgetLimit": {"Amount": "5000", "Unit": "USD"},
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80
    },
    "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "cto@company.com"}]
  }]'

# AWS Cost Anomaly Detection
aws ce create-anomaly-monitor \
  --anomaly-monitor '{
    "MonitorName": "ec2-monitor",
    "MonitorType": "DIMENSIONAL",
    "MonitorDimension": "SERVICE"
  }'
\`\`\`

## S3 Storage Classes — Cost Optimization

\`\`\`
Frequência de acesso:
  ↓ Constante        → S3 Standard           ($0.023/GB)
  ↓ < 1x/mês        → S3 Standard-IA         ($0.0125/GB, retrieval fee)
  ↓ < 1x/trimestre  → S3 Glacier Instant     ($0.004/GB, milissegundos)
  ↓ Raro (12h ok)   → S3 Glacier Flexible    ($0.0036/GB, horas)
  ↓ Arquivo (48h ok) → S3 Glacier Deep Archive($0.00099/GB, mais barato)
  ↓ Acesso imprev.  → S3 Intelligent-Tiering  (move automaticamente)
\`\`\`

\`\`\`bash
# Lifecycle policy para otimização automática
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-data-bucket \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "cost-optimization",
      "Status": "Enabled",
      "Transitions": [
        {"Days": 30, "StorageClass": "STANDARD_IA"},
        {"Days": 90, "StorageClass": "GLACIER"},
        {"Days": 365, "StorageClass": "DEEP_ARCHIVE"}
      ],
      "Expiration": {"Days": 2555},
      "Filter": {"Prefix": "logs/"}
    }]
  }'
\`\`\`

## Erros Comuns de Cost Optimization

1. **RI sem Convertible para instâncias de workload variável**: Standard RI são rígidas; Convertible RI permitem mudança de família, mas com menor desconto.
2. **Spot para workloads stateful sem handling de interrupção**: perda de dados sem graceful shutdown.
3. **Sem rightsizing antes de comprar RIs**: comprar RIs para instâncias oversized é desperdício duplo.
4. **S3 Standard para dados de backup/arquivo**: mover para S3 Glacier pode reduzir custo em 80%.
5. **Sem Cost Allocation Tags**: sem tags, não há visibilidade de custo por projeto/time — impossível chargeback.

## Killer.sh Style Challenge (SAP-C02)

> Uma empresa tem 200 EC2 de produção rodando 24/7 (m5.xlarge), 50 EC2 de batch diário de 6 horas (c5.2xlarge), dados históricos de S3 raramente acessados (500 TB, 3+ anos), e custo de $180k/mês. Reduzir 40%.
>
> **Resposta**: (1) EC2 prod: Compute Savings Plan 3 anos, No Upfront = 66% desconto → -$70k/mês. (2) Batch: Spot Instances c5.2xlarge com diversificação de família = 70% desconto (apenas 6h/dia de uso). (3) S3: Lifecycle para Glacier após 30 dias, Deep Archive após 1 ano = 95% de redução em armazenamento histórico. Total estimado: economia de 45-50%.
`,

  quiz: [
    {
      question: 'Qual é a diferença principal entre Compute Savings Plans e EC2 Instance Savings Plans?',
      options: [
        'Compute SP é mais barato que Instance SP em todas as situações',
        'Compute SP oferece flexibilidade máxima (qualquer família, região, OS) com desconto de até 66%; Instance SP é específico para família na região com desconto de até 72%',
        'Instance SP pode ser vendido no Reserved Instance Marketplace; Compute SP não',
        'Não há diferença técnica — apenas de nome nos relatórios de billing'
      ],
      correct: 1,
      explanation: 'Compute Savings Plan = máxima flexibilidade. Você se compromete com $/hora de compute usage, e o desconto se aplica automaticamente a qualquer instância EC2 (qualquer família, tamanho, região, OS) e também a Fargate e Lambda. EC2 Instance Savings Plan = compromisso com família específica (ex: m5) na região, mas flexível em tamanho e OS, com desconto maior (até 72%). Escolha entre flexibilidade vs desconto máximo.',
      reference: 'Seção Savings Plans — Compute SP para portfólios variados; Instance SP quando você tem previsibilidade de família e região.'
    },
    {
      question: 'Qual é a estratégia de Spot mais recomendada para um Autoscaling Group de produção que precisa de resiliência?',
      options: [
        'Usar apenas um tipo de instância Spot para simplificar',
        'Mixed instances policy: combinação de On-Demand como base + diversificação de tipos de instância Spot com estratégia capacity-optimized',
        'Spot não deve ser usado em produção — apenas em ambientes de dev/test',
        'Usar Spot bid price o mais alto possível para evitar interrupções'
      ],
      correct: 1,
      explanation: 'A estratégia recomendada pela AWS para Spot em produção: (1) OnDemandBaseCapacity: mínimo de On-Demand para garantir disponibilidade base, (2) diversificação de múltiplas famílias e tamanhos de instância para evitar que todos os Spot sejam interrompidos simultaneamente, (3) capacity-optimized allocation strategy que escolhe Spot dos pools com mais capacidade disponível (menor chance de interrupção). Spot bid nunca usa preços manuais desde 2017.',
      reference: 'Seção Spot Instances — mixed instances + capacity-optimized = melhor resiliência Spot para produção.'
    }
  ],

  flashcards: [
    {
      front: 'Como implementar uma estratégia de custo zero para dados raramente acessados no S3?',
      back: '**S3 Intelligent-Tiering** (automático):\n- Move automaticamente entre Standard, IA, Archive\n- Sem taxa de retrieval surpresa\n- Custo de monitoramento: $0.0025/1000 objetos\n\n**Lifecycle Policy** (manual, maior controle):\n```\nDia 0-30:  Standard     ($0.023/GB)\nDia 30-90: Standard-IA  ($0.0125/GB)\nDia 90-365: Glacier Instant ($0.004/GB)\nDia 365+:  Deep Archive ($0.00099/GB)\nDia 2555:  DELETE\n```\n\n**Regra prática**: 1 TB em Standard = $23/mês. Mesmo dado em Deep Archive = $1/mês. Para 500 TB → economia de $11.000/mês.'
    },
    {
      front: 'O que é o AWS Cost Anomaly Detection e como configurar?',
      back: '**Cost Anomaly Detection** usa ML para identificar gastos anômalos automaticamente.\n\n**Configurar**:\n```bash\n# Monitor por serviço\naws ce create-anomaly-monitor \\\n  --anomaly-monitor \\\n  \'{"MonitorName":"service-monitor","MonitorType":"DIMENSIONAL","MonitorDimension":"SERVICE"}\'\n\n# Alert quando anomalia > $100\naws ce create-anomaly-subscription \\\n  --anomaly-subscription \'{"SubscriptionName":"alert","MonitorArnList":["arn:..."],"Subscribers":[{"Address":"cto@co.com","Type":"EMAIL"}],"Threshold":100,"Frequency":"DAILY"}\'\n```\n\n**Vantagem**: detecta picos de custo inesperados (ex: alguém esqueceu uma instância de $500/hora) antes de virar uma conta gigante no final do mês.'
    }
  ],

  lab: {
    scenario: 'Explorar recomendações de Savings Plans e configurar Cost Anomaly Detection via AWS CLI.',
    objective: 'Entender como usar Cost Explorer API para gerar recomendações de economia e configurar alertas.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Ver recomendações de Savings Plans',
        instruction: 'Use Cost Explorer para obter recomendações de Savings Plans baseadas no uso histórico.',
        hints: ['aws ce get-savings-plans-purchase-recommendation', '--lookback-period-in-days THIRTY_DAYS'],
        solution: `\`\`\`bash
# Ver recomendações de Compute Savings Plans (requer uso prévio)
aws ce get-savings-plans-purchase-recommendation \
  --savings-plans-type COMPUTE_SP \
  --term-in-years ONE_YEAR \
  --payment-option NO_UPFRONT \
  --lookback-period-in-days THIRTY_DAYS \
  --query '{
    EstimatedMonthlySavings: SavingsPlansRecommendationSummary.EstimatedMonthlySavings,
    CurrentCost: SavingsPlansRecommendationSummary.CurrentOnDemandSpend,
    Recommendations: SavingsPlansRecommendationDetails[0:3].{
      HourlyCommitment: SavingsPlansPurchaseRecommendationDetails.HourlyCommitmentToPurchase,
      EstimatedSavings: SavingsPlansPurchaseRecommendationDetails.EstimatedMonthlySavingsPercentage
    }
  }' 2>/dev/null || echo "Dados insuficientes para recomendações (conta nova)"
\`\`\``,
        verify: `\`\`\`bash
echo "Savings Plans explorado via Cost Explorer"
echo "Para contas com histórico: usar AWS Console → Cost Explorer → Savings Plans → Recommendations"
\`\`\``
      },
      {
        title: 'Criar Cost Anomaly Monitor e Subscription',
        instruction: 'Configure o Cost Anomaly Detection para alertar quando gastos anômalos por serviço forem detectados.',
        hints: ['aws ce create-anomaly-monitor', 'MonitorType DIMENSIONAL + MonitorDimension SERVICE'],
        solution: `\`\`\`bash
# Criar monitor por serviço AWS
MONITOR_ARN=$(aws ce create-anomaly-monitor \
  --anomaly-monitor '{
    "MonitorName": "service-anomaly-monitor",
    "MonitorType": "DIMENSIONAL",
    "MonitorDimension": "SERVICE"
  }' \
  --query "MonitorArn" --output text 2>/dev/null)

if [ -n "$MONITOR_ARN" ]; then
  echo "Monitor criado: $MONITOR_ARN"

  # Criar subscription para email
  aws ce create-anomaly-subscription \
    --anomaly-subscription "{
      \"SubscriptionName\": \"anomaly-alert\",
      \"MonitorArnList\": [\"$MONITOR_ARN\"],
      \"Subscribers\": [{
        \"Address\": \"admin@company.com\",
        \"Type\": \"EMAIL\"
      }],
      \"Threshold\": 50,
      \"Frequency\": \"DAILY\"
    }" 2>/dev/null

  echo "Alert configurado: email quando anomalia > \$50/dia"
else
  echo "Cost Anomaly Detection via Console: Cost Explorer → Anomaly Detection"
fi
\`\`\``,
        verify: `\`\`\`bash
aws ce get-anomaly-monitors \
  --query "AnomalyMonitors[?MonitorName=='service-anomaly-monitor'].{Name:MonitorName,Type:MonitorType}" \
  --output table 2>/dev/null || echo "Verificar via Console: Cost Explorer → Anomaly Detection"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Reserved Instances sem utilização — custo fixo desperdiçado',
      difficulty: 'medium',
      symptom: 'O relatório de RI Utilization mostra que 40% das Reserved Instances têm utilização < 50%. A conta está pagando por capacidade não utilizada.',
      diagnosis: `\`\`\`bash
# Ver utilização de Reserved Instances
aws ce get-reservation-utilization \
  --time-period '{"Start": "2024-01-01", "End": "2024-01-31"}' \
  --granularity MONTHLY \
  --query 'UtilizationsByTime[0].Total.UtilizationPercentage' \
  --output text

# Ver cobertura de RIs
aws ce get-reservation-coverage \
  --time-period '{"Start": "2024-01-01", "End": "2024-01-31"}' \
  --granularity MONTHLY
\`\`\``,
      solution: `**Estratégias para resolver subutilização de RIs**:

1. **Vender Standard RIs no Marketplace** (se for Standard, não Convertible):
   - AWS Marketplace: EC2 → Reserved Instances → Sell Reserved Instances
   - Recupera parte do investimento antes do vencimento

2. **Modificar RIs** (mesma família, diferentes AZs ou tamanhos):
\`\`\`bash
aws ec2 modify-reserved-instances \
  --reserved-instances-ids ri-xxx \
  --target-configurations '[{"AvailabilityZone":"us-east-1b","InstanceCount":2,"InstanceType":"m5.large"}]'
\`\`\`

3. **Migrar para Savings Plans** (no vencimento das RIs):
   - Savings Plans têm mais flexibilidade — evita o problema de subutilização no futuro

4. **Verificar Shared Reserved Instances**: em AWS Organizations, RIs são compartilhadas automaticamente entre contas. Verificar se outra conta pode usar as RIs subutilizadas.`
    }
  ]
};
