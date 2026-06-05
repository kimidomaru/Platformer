window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-org-complexity/cost-optimization-pro'] = {
  theory: `# AWS Advanced Cost Optimization (SAP-C02)

## Exam Relevance
> Estimated weight **10-15%** in SAP-C02. Questions on savings strategies with Reserved Instances, Savings Plans, Spot, rightsizing, and cost control in multi-account organizations.

## AWS Savings Hierarchy

\`\`\`
Base cost (On-Demand)
  ↓ 20-40% discount
Savings Plans (flexible, $/hour commitment)
  ↓ 40-66% discount
Reserved Instances (specific resource commitment)
  ↓ up to 90% discount
Spot Instances (excess capacity, interruptible)
\`\`\`

## Savings Plans vs Reserved Instances

| | Savings Plans | Reserved Instances |
|-|--------------|-------------------|
| Commitment | $/hour of usage | Specific capacity |
| Flexibility | High (Compute SP: any family, region) | Low (Standard RI) or medium (Convertible RI) |
| Discount | Up to 66% | Up to 72% |
| Marketplace | No | Yes (Standard RI) |
| Services | EC2, Lambda, Fargate | EC2, RDS, ElastiCache, Redshift, etc. |

\`\`\`bash
# View Savings Plans recommendations
aws ce get-savings-plans-purchase-recommendation \
  --savings-plans-type COMPUTE_SP \
  --term-in-years ONE_YEAR \
  --payment-option NO_UPFRONT \
  --lookback-period-in-days SIXTY_DAYS

# View estimated Reserved Instance savings
aws ce get-reservation-purchase-recommendation \
  --service EC2-Instance \
  --term-in-years ONE_YEAR \
  --lookback-period-in-days SIXTY_DAYS
\`\`\`

## Spot Instances — Design for Interruption

### Spot Usage Strategies

\`\`\`bash
# Launch Template with Mixed Instances Policy (ASG)
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
# Spot interruption handler (2-minute warning)
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
    # 1. Stop accepting new tasks
    # 2. Save current state
    # 3. Deregister from load balancer
    # 4. Finish in-progress tasks
    pass

threading.Thread(target=check_interruption, daemon=True).start()
\`\`\`

## AWS Cost Management in Organizations

\`\`\`bash
# Enable Cost Allocation Tags
aws ce create-cost-category-definition \
  --name "Environment" \
  --rules '[
    {"Value": "production", "Rule": {"Tags": {"Key": "env", "Values": ["prod"]}}},
    {"Value": "development", "Rule": {"Tags": {"Key": "env", "Values": ["dev","staging"]}}}
  ]'

# Create Budget with alert
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
Access frequency:
  ↓ Constant           → S3 Standard           ($0.023/GB)
  ↓ < 1x/month        → S3 Standard-IA         ($0.0125/GB, retrieval fee)
  ↓ < 1x/quarter      → S3 Glacier Instant     ($0.004/GB, milliseconds)
  ↓ Rare (12h ok)     → S3 Glacier Flexible    ($0.0036/GB, hours)
  ↓ Archive (48h ok)  → S3 Glacier Deep Archive($0.00099/GB, cheapest)
  ↓ Unpredictable     → S3 Intelligent-Tiering  (moves automatically)
\`\`\`

\`\`\`bash
# Lifecycle policy for automatic optimization
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

## Common Cost Optimization Mistakes

1. **RI without Convertible for variable workload instances**: Standard RIs are rigid; Convertible RIs allow family changes, but with a smaller discount.
2. **Spot for stateful workloads without interruption handling**: data loss without graceful shutdown.
3. **No rightsizing before buying RIs**: buying RIs for oversized instances is double waste.
4. **S3 Standard for backup/archive data**: moving to S3 Glacier can reduce cost by 80%.
5. **No Cost Allocation Tags**: without tags, there is no cost visibility per project/team — chargeback is impossible.

## Killer.sh Style Challenge (SAP-C02)

> A company has 200 production EC2 running 24/7 (m5.xlarge), 50 batch EC2 running daily for 6 hours (c5.2xlarge), historical S3 data rarely accessed (500 TB, 3+ years), and a monthly cost of $180k. Reduce by 40%.
>
> **Answer**: (1) Prod EC2: Compute Savings Plan 3 years, No Upfront = 66% discount → -$70k/month. (2) Batch: Spot Instances c5.2xlarge with family diversification = 70% discount (only 6h/day of use). (3) S3: Lifecycle to Glacier after 30 days, Deep Archive after 1 year = 95% reduction in historical storage. Total estimated: 45-50% savings.
`,

  quiz: [
    {
      question: 'What is the main difference between Compute Savings Plans and EC2 Instance Savings Plans?',
      options: [
        'Compute SP is cheaper than Instance SP in all situations',
        'Compute SP offers maximum flexibility (any family, region, OS) with up to 66% discount; Instance SP is specific to a family in a region with up to 72% discount',
        'Instance SP can be sold in the Reserved Instance Marketplace; Compute SP cannot',
        'There is no technical difference — only different names in billing reports'
      ],
      correct: 1,
      explanation: 'Compute Savings Plan = maximum flexibility. You commit to $/hour of compute usage, and the discount automatically applies to any EC2 instance (any family, size, region, OS) and also to Fargate and Lambda. EC2 Instance Savings Plan = commitment to a specific family (e.g., m5) in the region, but flexible in size and OS, with a higher discount (up to 72%). Choose between flexibility vs maximum discount.',
      reference: 'Savings Plans section — Compute SP for varied portfolios; Instance SP when you have family and region predictability.'
    },
    {
      question: 'What is the most recommended Spot strategy for a production Autoscaling Group that needs resilience?',
      options: [
        'Use only one type of Spot instance for simplicity',
        'Mixed instances policy: combination of On-Demand as base + diversification of Spot instance types with capacity-optimized strategy',
        'Spot should not be used in production — only in dev/test environments',
        'Use the highest possible Spot bid price to avoid interruptions'
      ],
      correct: 1,
      explanation: 'The AWS recommended strategy for Spot in production: (1) OnDemandBaseCapacity: minimum On-Demand to guarantee base availability, (2) diversification of multiple families and instance sizes to avoid all Spot being interrupted simultaneously, (3) capacity-optimized allocation strategy that chooses Spot from pools with the most available capacity (lower chance of interruption). Spot bidding has not used manual prices since 2017.',
      reference: 'Spot Instances section — mixed instances + capacity-optimized = best Spot resilience for production.'
    }
  ],

  flashcards: [
    {
      front: 'How do you implement a near-zero cost strategy for rarely accessed data in S3?',
      back: '**S3 Intelligent-Tiering** (automatic):\n- Automatically moves between Standard, IA, Archive\n- No surprise retrieval fees\n- Monitoring cost: $0.0025/1000 objects\n\n**Lifecycle Policy** (manual, more control):\n```\nDay 0-30:  Standard     ($0.023/GB)\nDay 30-90: Standard-IA  ($0.0125/GB)\nDay 90-365: Glacier Instant ($0.004/GB)\nDay 365+:  Deep Archive ($0.00099/GB)\nDay 2555:  DELETE\n```\n\n**Practical rule**: 1 TB in Standard = $23/month. Same data in Deep Archive = $1/month. For 500 TB → savings of $11,000/month.'
    },
    {
      front: 'What is AWS Cost Anomaly Detection and how do you configure it?',
      back: '**Cost Anomaly Detection** uses ML to automatically identify anomalous spending.\n\n**Configure**:\n```bash\n# Monitor by service\naws ce create-anomaly-monitor \\\n  --anomaly-monitor \\\n  \'{"MonitorName":"service-monitor","MonitorType":"DIMENSIONAL","MonitorDimension":"SERVICE"}\'\n\n# Alert when anomaly > $100\naws ce create-anomaly-subscription \\\n  --anomaly-subscription \'{"SubscriptionName":"alert","MonitorArnList":["arn:..."],"Subscribers":[{"Address":"cto@co.com","Type":"EMAIL"}],"Threshold":100,"Frequency":"DAILY"}\'\n```\n\n**Advantage**: detects unexpected cost spikes (e.g., someone forgot a $500/hour instance) before it becomes a huge bill at the end of the month.'
    }
  ],

  lab: {
    scenario: 'Explore Savings Plans recommendations and configure Cost Anomaly Detection via AWS CLI.',
    objective: 'Understand how to use the Cost Explorer API to generate savings recommendations and configure alerts.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'View Savings Plans recommendations',
        instruction: 'Use Cost Explorer to get Savings Plans recommendations based on historical usage.',
        hints: ['aws ce get-savings-plans-purchase-recommendation', '--lookback-period-in-days THIRTY_DAYS'],
        solution: `\`\`\`bash
# View Compute Savings Plans recommendations (requires prior usage)
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
  }' 2>/dev/null || echo "Insufficient data for recommendations (new account)"
\`\`\``,
        verify: `\`\`\`bash
echo "Savings Plans explored via Cost Explorer"
echo "For accounts with history: use AWS Console → Cost Explorer → Savings Plans → Recommendations"
\`\`\``
      },
      {
        title: 'Create Cost Anomaly Monitor and Subscription',
        instruction: 'Configure Cost Anomaly Detection to alert when anomalous spending by service is detected.',
        hints: ['aws ce create-anomaly-monitor', 'MonitorType DIMENSIONAL + MonitorDimension SERVICE'],
        solution: `\`\`\`bash
# Create monitor by AWS service
MONITOR_ARN=$(aws ce create-anomaly-monitor \
  --anomaly-monitor '{
    "MonitorName": "service-anomaly-monitor",
    "MonitorType": "DIMENSIONAL",
    "MonitorDimension": "SERVICE"
  }' \
  --query "MonitorArn" --output text 2>/dev/null)

if [ -n "$MONITOR_ARN" ]; then
  echo "Monitor created: $MONITOR_ARN"

  # Create subscription for email
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

  echo "Alert configured: email when anomaly > \$50/day"
else
  echo "Cost Anomaly Detection via Console: Cost Explorer → Anomaly Detection"
fi
\`\`\``,
        verify: `\`\`\`bash
aws ce get-anomaly-monitors \
  --query "AnomalyMonitors[?MonitorName=='service-anomaly-monitor'].{Name:MonitorName,Type:MonitorType}" \
  --output table 2>/dev/null || echo "Check via Console: Cost Explorer → Anomaly Detection"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Reserved Instances with no utilization — wasted fixed cost',
      difficulty: 'medium',
      symptom: 'The RI Utilization report shows that 40% of Reserved Instances have less than 50% utilization. The account is paying for unused capacity.',
      diagnosis: `\`\`\`bash
# View Reserved Instance utilization
aws ce get-reservation-utilization \
  --time-period '{"Start": "2024-01-01", "End": "2024-01-31"}' \
  --granularity MONTHLY \
  --query 'UtilizationsByTime[0].Total.UtilizationPercentage' \
  --output text

# View RI coverage
aws ce get-reservation-coverage \
  --time-period '{"Start": "2024-01-01", "End": "2024-01-31"}' \
  --granularity MONTHLY
\`\`\``,
      solution: `**Strategies to resolve RI underutilization**:

1. **Sell Standard RIs in the Marketplace** (if Standard, not Convertible):
   - AWS Marketplace: EC2 → Reserved Instances → Sell Reserved Instances
   - Recovers part of the investment before expiration

2. **Modify RIs** (same family, different AZs or sizes):
\`\`\`bash
aws ec2 modify-reserved-instances \
  --reserved-instances-ids ri-xxx \
  --target-configurations '[{"AvailabilityZone":"us-east-1b","InstanceCount":2,"InstanceType":"m5.large"}]'
\`\`\`

3. **Migrate to Savings Plans** (when RIs expire):
   - Savings Plans have more flexibility — avoids the underutilization problem in the future

4. **Check Shared Reserved Instances**: in AWS Organizations, RIs are automatically shared between accounts. Check if another account can use the underutilized RIs.`
    }
  ]
};
