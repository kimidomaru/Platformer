window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-cost-optimized/cost-management'] = {
  theory: `# Cost Optimization Strategies

## Exam Relevance
> **Design Cost-Optimized Architectures** is worth **20%** of SAA-C03. EC2 purchasing options, storage tiering, right-sizing, and cost management tools are core topics.

## EC2 Purchasing Options

| Option | Discount | Commitment | Key Feature |
|--------|----------|-----------|-------------|
| **On-Demand** | 0% | None | Pay per second, no commitment |
| **Reserved (Standard)** | Up to 72% | 1 or 3 years | Cannot change instance family |
| **Reserved (Convertible)** | Up to 66% | 1 or 3 years | Can change family, OS, tenancy |
| **Savings Plans (Compute)** | Up to 66% | 1 or 3 years | Any EC2, Fargate, Lambda |
| **Savings Plans (EC2 Instance)** | Up to 72% | 1 or 3 years | Specific family + Region |
| **Spot Instances** | Up to 90% | None | Can be interrupted with 2-min notice |

### Payment Options (Reserved/Savings Plans)
- **All Upfront**: maximum discount
- **Partial Upfront**: moderate discount
- **No Upfront**: minimum discount, still committed

### Spot Instance Strategies
- **Capacity-optimized**: chooses pools with most available capacity (lowest interruption)
- **Lowest-price**: cheapest across pools (higher interruption risk)
- **Diversified**: spread across multiple instance types and AZs
- **Spot Fleet**: mix of Spot + On-Demand, define target capacity
- Handle interruptions: checkpointing to S3, SQS-based processing, ASG with mixed instances

## S3 Cost Optimization

### Lifecycle Policies
- **Transition rules**: Standard -> Standard-IA (30+ days) -> Glacier Flexible (90+ days) -> Deep Archive (180+ days)
- **Expiration rules**: auto-delete objects after X days
- **Filter by prefix/tags**: apply rules to specific objects

### Intelligent-Tiering
- Automatic tiering based on access patterns (no retrieval fees)
- Monitoring fee: \\$0.0025 per 1,000 objects/month
- Best for unpredictable access patterns

### Other S3 Savings
- **Requester Pays**: requester pays data transfer (shared datasets)
- **S3 Analytics**: recommends storage class based on access patterns
- **S3 Select**: query in-place (reduce data transfer by up to 400%)

## Right-Sizing

| Tool | What It Does |
|------|-------------|
| **Compute Optimizer** | ML-based recommendations for EC2, EBS, Lambda, ASG |
| **Trusted Advisor** | Idle instances, underutilized EBS, unused EIPs |
| **CloudWatch** | CPU/memory metrics to identify under/over-provisioned |
| **Cost Explorer** | RI/SP coverage and utilization recommendations |

## Cost Management Tools

| Tool | Purpose |
|------|---------|
| **Cost Explorer** | 12-month history, forecasting, RI/SP recommendations |
| **AWS Budgets** | Cost/usage/reservation alerts, automated actions (terminate, stop) |
| **Cost Anomaly Detection** | ML-based anomaly alerts via SNS |
| **Cost and Usage Report** | Most granular report, export to S3, query with Athena |
| **Billing Dashboard** | Current month summary |

## Data Transfer Costs

| Path | Cost |
|------|------|
| **Inbound** (internet to AWS) | Free |
| **Same AZ** (private IP) | Free |
| **Cross-AZ** (same Region) | \\$0.01/GB each direction |
| **Cross-Region** | \\$0.02/GB (varies) |
| **Outbound** (AWS to internet) | \\$0.09/GB (decreases with volume) |
| **VPC Endpoint** (to S3/DynamoDB) | Free (Gateway) |
| **NAT Gateway** | \\$0.045/GB processed |
| **CloudFront** | Cheaper than direct for global delivery |

## Reserved Capacity (Other Services)

- **RDS Reserved**: up to 69% off (same as EC2 model)
- **ElastiCache Reserved**: up to 55% off
- **Redshift Reserved**: up to 75% off
- **DynamoDB Reserved**: up to 77% off (provisioned capacity)

## Common Exam Mistakes

- Confusing Standard RI (cannot change family) with Convertible RI (can change)
- Not knowing Compute Savings Plans cover EC2 + Fargate + Lambda
- Forgetting Spot can be interrupted (not for databases or stateful workloads)
- Using NAT Gateway when VPC Gateway Endpoint (free for S3) would suffice
- Not considering data transfer costs in architecture design
`,

  quiz: [
    {
      question: 'Which purchasing option provides the highest discount for EC2?',
      options: ['Convertible Reserved Instance', 'Compute Savings Plan', 'Spot Instance (up to 90% off)', 'Standard Reserved Instance'],
      correct: 2,
      explanation: 'Spot Instances offer up to 90% discount but can be interrupted with 2-minute notice. Standard RI offers up to 72%, Compute SP up to 66%, Convertible RI up to 66%.',
      reference: 'Spot = highest discount but interruptible. RI Standard = best for steady-state.'
    },
    {
      question: 'What is the difference between Standard and Convertible Reserved Instances?',
      options: ['Standard is cheaper', 'Standard cannot change instance family, Convertible can', 'Convertible has no discount', 'Standard requires 3-year commitment'],
      correct: 1,
      explanation: 'Standard RI: up to 72% off but locked to instance family/OS/tenancy. Convertible RI: up to 66% off but can change instance family, OS, scope, and tenancy.',
      reference: 'Standard = higher discount, less flexibility. Convertible = lower discount, full flexibility.'
    },
    {
      question: 'Which Savings Plan covers EC2, Fargate, AND Lambda?',
      options: ['EC2 Instance Savings Plan', 'Compute Savings Plan', 'Reserved Instance', 'Spot Savings Plan'],
      correct: 1,
      explanation: 'Compute Savings Plan (up to 66% off) applies to any EC2 instance (any family, Region, OS), Fargate, and Lambda. EC2 Instance SP is locked to a specific family + Region.',
      reference: 'Compute SP = most flexible (EC2+Fargate+Lambda). EC2 Instance SP = higher discount but locked.'
    },
    {
      question: 'What is the cost of data transfer between two EC2 instances in the same AZ using private IPs?',
      options: ['\\$0.01/GB', '\\$0.02/GB', 'Free', '\\$0.09/GB'],
      correct: 2,
      explanation: 'Data transfer within the same AZ using private IPs is free. Cross-AZ costs \\$0.01/GB each direction. Always use private IPs to avoid charges.',
      reference: 'Same AZ private IP = free. Cross-AZ = \\$0.01/GB. Outbound internet = \\$0.09/GB.'
    },
    {
      question: 'Which tool provides ML-based right-sizing recommendations for EC2?',
      options: ['AWS Budgets', 'AWS Compute Optimizer', 'AWS Cost Explorer', 'AWS Trusted Advisor'],
      correct: 1,
      explanation: 'Compute Optimizer uses ML to analyze CloudWatch metrics and recommends optimal EC2 instance types, EBS volume types, Lambda memory, and ASG configurations.',
      reference: 'Compute Optimizer = ML right-sizing. Trusted Advisor = idle resources. Cost Explorer = cost analysis.'
    },
    {
      question: 'How does S3 Intelligent-Tiering work?',
      options: ['You set lifecycle rules manually', 'It automatically moves objects between tiers based on access patterns', 'It only works with Glacier', 'It requires Reserved capacity'],
      correct: 1,
      explanation: 'Intelligent-Tiering automatically moves objects between Frequent, Infrequent, Archive Instant, Archive, and Deep Archive tiers. No retrieval fees. Monitoring fee \\$0.0025/1000 objects.',
      reference: 'Intelligent-Tiering = auto-tiering, no retrieval fees. Best for unpredictable access.'
    },
    {
      question: 'What automated action can AWS Budgets perform when a threshold is exceeded?',
      options: ['Only send email alerts', 'Terminate or stop EC2 instances via budget actions', 'Automatically resize instances', 'Block all API calls'],
      correct: 1,
      explanation: 'AWS Budgets supports automated actions: apply IAM policies to restrict provisioning, or stop/terminate EC2 instances when budget thresholds are exceeded.',
      reference: 'Budgets = alerts + automated actions. Cost Explorer = analysis. Cost Anomaly = ML detection.'
    },
    {
      question: 'Why might using a VPC Gateway Endpoint reduce costs compared to NAT Gateway?',
      options: ['Gateway Endpoints have higher bandwidth', 'Gateway Endpoints for S3/DynamoDB are free, NAT Gateway charges per GB processed', 'NAT Gateway is deprecated', 'Gateway Endpoints encrypt data'],
      correct: 1,
      explanation: 'NAT Gateway charges \\$0.045/GB processed + hourly fee. Gateway Endpoints for S3 and DynamoDB are free. Routing S3 traffic through Gateway Endpoint instead of NAT saves significantly.',
      reference: 'Gateway Endpoint (S3/DynamoDB) = free. NAT Gateway = \\$0.045/GB + \\$0.045/hour.'
    }
  ],

  flashcards: [
    { front: 'EC2 purchasing options ranked by discount?', back: 'Spot (up to 90%, interruptible) > Standard RI / EC2 Instance SP (up to 72%, locked) > Convertible RI / Compute SP (up to 66%, flexible) > On-Demand (0%). Spot for stateless, RI/SP for steady-state.' },
    { front: 'Standard vs Convertible Reserved Instances?', back: 'Standard: up to 72% off, cannot change instance family/OS/tenancy. Convertible: up to 66% off, can change everything. Both: 1 or 3 year, All/Partial/No Upfront payment.' },
    { front: 'Compute SP vs EC2 Instance SP?', back: 'Compute SP: up to 66%, covers EC2 (any family/Region/OS) + Fargate + Lambda. EC2 Instance SP: up to 72%, locked to specific family + Region. Compute SP is more flexible.' },
    { front: 'How to handle Spot Instance interruptions?', back: 'Checkpoint to S3, use SQS for job queues, diversify across instance types/AZs, use ASG with mixed instances policy, capacity-optimized allocation strategy for lowest interruption.' },
    { front: 'S3 lifecycle optimization?', back: 'Transition: Standard -> Standard-IA (30d) -> Glacier Flexible (90d) -> Deep Archive (180d). Expiration: auto-delete after X days. Intelligent-Tiering for unpredictable access (auto-tier, no retrieval fees).' },
    { front: 'AWS cost management tools?', back: 'Cost Explorer: 12-month analysis + forecasting. Budgets: alerts + auto-actions. Cost Anomaly Detection: ML-based alerts. CUR: most granular report to S3 + Athena. Compute Optimizer: ML right-sizing.' },
    { front: 'Data transfer costs?', back: 'Inbound: free. Same AZ private IP: free. Cross-AZ: \\$0.01/GB each way. Outbound internet: \\$0.09/GB. NAT Gateway: \\$0.045/GB. Gateway Endpoint (S3/DynamoDB): free. CloudFront: cheaper for global.' },
    { front: 'When to use Spot vs Reserved vs On-Demand?', back: 'Spot: stateless, fault-tolerant, batch, CI/CD, big data. Reserved/SP: steady-state production, databases, 24/7 workloads. On-Demand: short-term, unpredictable, testing. Never Spot for databases or stateful.' }
  ],

  lab: {
    scenario: 'Analyze and optimize costs for a production AWS environment.',
    objective: 'Practice cost analysis with Cost Explorer, right-sizing, and purchasing optimization.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Analyze Costs with Cost Explorer',
        instruction: 'Use Cost Explorer to identify the top 3 most expensive services over the last 3 months and forecast next month costs.',
        hints: ['Group by Service to see breakdown', 'Use Forecast feature for projections'],
        solution: '```bash\n# Get cost by service (last 3 months)\naws ce get-cost-and-usage \\\n  --time-period Start=2024-01-01,End=2024-04-01 \\\n  --granularity MONTHLY \\\n  --metrics BlendedCost \\\n  --group-by Type=DIMENSION,Key=SERVICE\n\n# Get cost forecast for next month\naws ce get-cost-forecast \\\n  --time-period Start=2024-04-01,End=2024-05-01 \\\n  --granularity MONTHLY \\\n  --metric BLENDED_COST\n```',
        verify: '```bash\n# Check output:\n# - Top services by cost (usually EC2, RDS, S3)\n# - Monthly trend (increasing or decreasing)\n# - Forecast amount for next month\n# Expected: JSON with service-level cost breakdown\n```'
      },
      {
        title: 'Check Right-Sizing Recommendations',
        instruction: 'Use Compute Optimizer to get EC2 right-sizing recommendations. Identify over-provisioned instances.',
        hints: ['Compute Optimizer must be opted in first', 'Look for instances where recommendation is smaller'],
        solution: '```bash\n# Opt in to Compute Optimizer (if not already)\naws compute-optimizer update-enrollment-status --status Active\n\n# Get EC2 recommendations\naws compute-optimizer get-ec2-instance-recommendations \\\n  --query "instanceRecommendations[].{Instance:instanceArn,Current:currentInstanceType,Recommended:recommendationOptions[0].instanceType,Savings:recommendationOptions[0].estimatedMonthlySavings.value}"\n\n# Look for instances where Recommended < Current\n```',
        verify: '```bash\naws compute-optimizer get-enrollment-status\n# Expected: status = Active\n\n# Review recommendations:\n# Over-provisioned: current m5.xlarge -> recommended m5.large\n# Estimated monthly savings per instance\n```'
      },
      {
        title: 'Create Cost Budget with Alert',
        instruction: 'Create a monthly cost budget of \\$500 with alerts at 80% and 100% thresholds.',
        hints: ['Use aws budgets create-budget', 'Define notification thresholds as percentages'],
        solution: '```bash\n# Create budget (use JSON file for complex config)\naws budgets create-budget --account-id ACCOUNT_ID \\\n  --budget \'{"BudgetName":"monthly-500","BudgetLimit":{"Amount":"500","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}\' \\\n  --notifications-with-subscribers \'[{"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":80},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"admin@example.com"}]},{"Notification":{"NotificationType":"FORECASTED","ComparisonOperator":"GREATER_THAN","Threshold":100},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"admin@example.com"}]}]\'\n```',
        verify: '```bash\naws budgets describe-budget --account-id ACCOUNT_ID \\\n  --budget-name monthly-500\n# Expected: BudgetLimit = 500 USD, MONTHLY\n# 2 notifications: 80% actual, 100% forecasted\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'High NAT Gateway Costs for S3 Traffic',
      difficulty: 'medium',
      symptom: 'NAT Gateway data processing charges are unexpectedly high. Most traffic is to S3.',
      diagnosis: '```\nNAT Gateway charges:\n  \\$0.045/hour + \\$0.045/GB processed\n\nIf most traffic is S3:\n  Route table sends S3 traffic through NAT Gateway\n  instead of using free Gateway Endpoint\n\nCheck:\n  aws ec2 describe-route-tables --route-table-ids rtb-xxx\n  Look for S3 prefix list route vs NAT Gateway route\n\n  VPC Flow Logs: check destination IPs (S3 prefix)\n  NAT Gateway CloudWatch: BytesOutToDestination\n```',
      solution: 'Create a Gateway VPC Endpoint for S3 (free) and associate it with the route table. S3 traffic will route through the endpoint instead of NAT Gateway. Can save hundreds of dollars per month for S3-heavy workloads.'
    },
    {
      title: 'Reserved Instance Not Applying Discount',
      difficulty: 'hard',
      symptom: 'Purchased Standard Reserved Instance but On-Demand pricing still appears on the bill.',
      diagnosis: '```\nRI matching requirements (ALL must match):\n  1. Instance family (e.g., m5)\n  2. Instance size (e.g., xlarge) or size-flexible\n  3. Region (e.g., us-east-1)\n  4. Platform (e.g., Linux)\n  5. Tenancy (default vs dedicated)\n  6. Scope: Regional (any AZ) vs Zonal (specific AZ)\n\nCheck:\n  aws ec2 describe-reserved-instances\n  Compare with running instances:\n  aws ec2 describe-instances --query \\\n    "Reservations[].Instances[].{Type:InstanceType,AZ:Placement.AvailabilityZone,Platform:Platform}"\n\nCommon causes:\n  - Wrong Region or AZ (Zonal scope)\n  - Different platform (Windows vs Linux)\n  - Different tenancy\n```',
      solution: 'Verify all RI attributes match your running instances. Regional RIs are more flexible (any AZ, size-flexible within family). Check Cost Explorer RI Utilization report to see coverage gaps. Consider Convertible RI or Compute Savings Plan for more flexibility.'
    }
  ]
};
