window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-billing-pricing/pricing-support'] = {
  theory: `# Pricing Models & Support Plans

## Exam Relevance
> The **Billing, Pricing and Support** domain is worth **12%** of the CLF-C02. Knowing pricing models, billing tools, and support plans is essential.

## AWS Pricing Models

### Pay-as-you-go
- Pay only for what you use, no contracts
- No upfront investment
- Scale as needed

### Save when you commit
- Discounts for usage commitment (Reserved Instances, Savings Plans)
- Up to 72% discount
- 1 or 3 year commitment

### Pay less by using more
- Volume discounts (e.g., S3 storage, data transfer)
- The more you use, the lower the unit price

## AWS Free Tier

Three types of offers:

| Type | Description | Example |
|------|-------------|---------|
| **Always Free** | Always free, no time limit | Lambda: 1M invocations/month, DynamoDB: 25 GB |
| **12 Months Free** | Free for 12 months after account creation | EC2: 750h t2.micro/month, S3: 5 GB, RDS: 750h |
| **Trials** | Short-term trial when activating service | Redshift: 2 months, GuardDuty: 30 days |

## Billing and Cost Tools

| Tool | Function |
|------|----------|
| **AWS Pricing Calculator** | Estimate costs BEFORE using (pre-deploy) |
| **AWS Cost Explorer** | Analyze HISTORICAL costs with charts and filters |
| **AWS Budgets** | Set budgets and receive alerts when approaching |
| **AWS Cost and Usage Report** | Detailed usage report (most granular, downloadable) |
| **AWS Billing Dashboard** | Overview of current bill |

## Support Plans

| Plan | Price | TAM | Trusted Advisor | Response Time (Critical) |
|------|-------|-----|-----------------|--------------------------|
| **Basic** | Free | No | 7 checks | N/A (no tech support) |
| **Developer** | \\$29+/mo | No | 7 checks | 12 hours (business hours) |
| **Business** | \\$100+/mo | No | ALL checks | 1 hour |
| **Enterprise On-Ramp** | \\$5,500+/mo | Pool | ALL checks | 30 minutes |
| **Enterprise** | \\$15,000+/mo | Dedicated | ALL checks | 15 minutes |

### TAM — Technical Account Manager
- Available only on Enterprise On-Ramp and Enterprise plans
- Dedicated technical point of contact
- Architectural reviews, optimization, well-architected reviews

## Consolidated Billing (Organizations)

- Single invoice for all accounts in the Organization
- Volume discounts from aggregated usage across accounts
- Reserved Instances and Savings Plans shared between accounts

## Cost Allocation Tags

- Tags added to resources to track costs
- Example: Environment:Production, Team:Backend, Project:AppX
- Enabled in the Billing console
- Appear in Cost Explorer and Cost and Usage Report

## Common Mistakes

- Confusing Pricing Calculator (estimate) with Cost Explorer (historical)
- Forgetting TAM only exists in Enterprise (On-Ramp or full)
- Thinking Basic Support has technical support — it does not
- Confusing Budgets (budget alerts) with Cost Explorer (cost analysis)
`,

  quiz: [
    {
      question: 'Which AWS tool allows estimating costs BEFORE deploying an architecture?',
      options: ['AWS Cost Explorer', 'AWS Budgets', 'AWS Pricing Calculator', 'AWS Cost and Usage Report'],
      correct: 2,
      explanation: 'AWS Pricing Calculator is the web tool for estimating costs before using. Cost Explorer shows historical costs, Budgets sets limits.',
      reference: 'Pricing Calculator = pre-deploy. Cost Explorer = post-deploy (historical analysis).'
    },
    {
      question: 'Which Support Plan offers a dedicated Technical Account Manager (TAM)?',
      options: ['Business', 'Developer', 'Enterprise', 'Basic'],
      correct: 2,
      explanation: 'Only the Enterprise plan has a dedicated TAM. Enterprise On-Ramp has a pool of TAMs. Business and Developer do not have TAM.',
      reference: 'Enterprise = dedicated TAM + 15 min response. On-Ramp = TAM pool + 30 min response.'
    },
    {
      question: 'What is the response time for critical incidents on the Business plan?',
      options: ['15 minutes', '30 minutes', '1 hour', '12 hours'],
      correct: 2,
      explanation: 'The Business plan has a 1-hour response time for critical incidents. Enterprise has 15 min, On-Ramp has 30 min.',
      reference: 'Basic: no tech support. Developer: 12h. Business: 1h. Enterprise: 15min.'
    },
    {
      question: 'What type of Free Tier does AWS Lambda offer?',
      options: ['12 Months Free', 'Always Free', 'Trial', 'None'],
      correct: 1,
      explanation: 'Lambda has Always Free tier: 1 million invocations per month and 400,000 GB-seconds of compute, indefinitely.',
      reference: 'Always Free: Lambda, DynamoDB (25 GB), SNS, SQS. 12 months: EC2 t2.micro, S3 5 GB, RDS.'
    },
    {
      question: 'What does AWS Budgets do?',
      options: ['Analyze historical costs with charts', 'Set budget limits and send alerts', 'Estimate costs of new architectures', 'Generate detailed usage reports'],
      correct: 1,
      explanation: 'AWS Budgets allows setting cost, usage, or reservation budgets and receiving alerts when approaching or exceeding the defined limit.',
      reference: 'Budgets = proactive alerts. Cost Explorer = retroactive analysis. Pricing Calculator = estimates.'
    },
    {
      question: 'How many Trusted Advisor checks are available on the Basic plan?',
      options: ['0', '7', 'All', '15'],
      correct: 1,
      explanation: 'The Basic plan offers 7 free Trusted Advisor checks (MFA root, SG exposed, S3 permissions, etc). All checks require Business or higher.',
      reference: '7 basic checks = Basic/Developer. All checks = Business/Enterprise.'
    },
    {
      question: 'What benefit does Consolidated Billing in AWS Organizations offer?',
      options: ['Free tech support', 'Volume discounts from aggregated usage across accounts', 'Dedicated TAM', 'Extended Free Tier'],
      correct: 1,
      explanation: 'Consolidated Billing aggregates usage across all accounts for volume discounts. Reserved Instances and Savings Plans can be shared between accounts.',
      reference: 'Single invoice + volume discounts + RI/SP sharing.'
    },
    {
      question: 'What are Cost Allocation Tags?',
      options: ['Security tags for IAM', 'Tags to track costs by resource', 'DNS routing tags', 'Support priority tags'],
      correct: 1,
      explanation: 'Cost Allocation Tags are tags added to resources (e.g., Team:Backend, Environment:Prod) to track and allocate costs in Cost Explorer and reports.',
      reference: 'Enable in Billing console. AWS-generated tags (aws:createdBy) and user-defined tags.'
    }
  ],

  flashcards: [
    { front: 'What are the 3 AWS pricing models?', back: 'Pay-as-you-go (pay for use), Save when you commit (Reserved/Savings Plans, up to 72% off), Pay less by using more (volume discounts). No mandatory contracts.' },
    { front: 'What is the difference between Pricing Calculator, Cost Explorer, and Budgets?', back: 'Pricing Calculator = estimate costs BEFORE using. Cost Explorer = analyze HISTORICAL costs. Budgets = set LIMITS and receive ALERTS when approaching.' },
    { front: 'What are the AWS Support Plans?', back: 'Basic (free, no tech support), Developer ($29+, 12h response), Business ($100+, 1h, full Trusted Advisor), Enterprise On-Ramp ($5500+, 30min, TAM pool), Enterprise ($15000+, 15min, dedicated TAM).' },
    { front: 'What are the 3 types of AWS Free Tier?', back: 'Always Free (no time limit: Lambda 1M req, DynamoDB 25 GB). 12 Months Free (EC2 t2.micro 750h, S3 5 GB). Trials (service-specific: GuardDuty 30 days, Redshift 2 months).' },
    { front: 'What is a TAM (Technical Account Manager)?', back: 'Dedicated AWS technical point of contact for your account. Does architectural reviews, well-architected reviews, optimization. Available only on Enterprise On-Ramp (pool) and Enterprise (dedicated).' },
    { front: 'What is AWS Cost and Usage Report?', back: 'Most detailed and granular AWS usage and cost report. Can be exported to S3. Used for deep analysis, BI tool integration (Athena, QuickSight). More detailed than Cost Explorer.' },
    { front: 'What is Consolidated Billing?', back: 'AWS Organizations feature. One invoice for all accounts. Volume discounts from aggregated usage. Reserved Instances and Savings Plans shared. Per-account tracking available.' },
    { front: 'What are Cost Allocation Tags?', back: 'Tags on AWS resources to track costs: Environment:Prod, Team:Backend, Project:AppX. Enabled in Billing console. Appear in Cost Explorer and Cost & Usage Report.' }
  ],

  lab: {
    scenario: 'Explore AWS billing and pricing tools.',
    objective: 'Use Pricing Calculator, Cost Explorer, and Budgets to plan and monitor costs.',
    duration: '10-15 minutes',
    steps: [
      {
        title: 'Estimate Costs with Pricing Calculator',
        instruction: 'Go to calculator.aws and estimate the monthly cost of: 1 EC2 t3.medium (On-Demand, us-east-1, 24/7), 100 GB S3 Standard, 1 RDS db.t3.micro MySQL Multi-AZ.',
        hints: ['calculator.aws is the Pricing Calculator URL', 'Select Region us-east-1 for lower prices'],
        solution: '```\nEstimate (us-east-1, approximate 2024 prices):\n\nEC2 t3.medium On-Demand:\n  730 hours x $0.0416/h = ~$30/month\n\nS3 Standard 100 GB:\n  100 GB x $0.023/GB = ~$2.30/month\n\nRDS db.t3.micro MySQL Multi-AZ:\n  730 hours x $0.034/h = ~$25/month\n\nEstimated total: ~$57/month\n```',
        verify: '```bash\n# Go to calculator.aws\n# Add EC2, S3, and RDS\n# Configure as specified\n# Check estimated monthly total\n# Expected result: ~$50-60/month\n```'
      },
      {
        title: 'Explore Cost Explorer',
        instruction: 'In the AWS console, access Cost Explorer. View costs for the last 3 months by service. Identify which service has the highest cost.',
        hints: ['Billing > Cost Explorer', 'Use filter "Group by: Service"'],
        solution: '```\nCost Explorer > Last 3 Months > Group by Service\n\nTypical result:\n1. EC2 (instances + EBS) - usually highest cost\n2. RDS - databases\n3. S3 - storage\n4. Data Transfer - traffic between Regions/internet\n5. CloudWatch - logs and metrics\n\nUse "Forecast" to see current month projection\n```',
        verify: '```bash\n# Check:\n# [x] Cost chart by service\n# [x] Spending trend (growing or decreasing)\n# [x] Next month forecast\n# Result: identification of most expensive service\n```'
      },
      {
        title: 'Create a Budget',
        instruction: 'Create an AWS Budget for monthly cost of $100 with alerts at 50%, 80%, and 100% of budget.',
        hints: ['Billing > Budgets > Create Budget', 'Configure email to receive alerts'],
        solution: '```\nAWS Budgets > Create Budget > Cost Budget\n\nName: monthly-cost-budget\nAmount: $100/month\n\nAlerts:\n1. Alert at 50% ($50) - actual cost\n2. Alert at 80% ($80) - actual cost\n3. Alert at 100% ($100) - forecasted cost\n\nNotification: responsible email\n```',
        verify: '```bash\n# Check:\n# Billing > Budgets\n# Budget created with 3 alerts\n# Status: within or over budget\n# Result: alerts configured for monthly cost\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pricing Calculator vs Cost Explorer',
      difficulty: 'easy',
      symptom: 'Candidate confuses the two tools and when to use each.',
      diagnosis: '```\nAWS Pricing Calculator:\n  - For ESTIMATING costs of new architectures\n  - BEFORE deploying\n  - URL: calculator.aws\n  - No real account data\n\nAWS Cost Explorer:\n  - For ANALYZING historical costs\n  - AFTER using\n  - In AWS console (Billing)\n  - With real account data\n\nAWS Budgets:\n  - For setting LIMITS and receiving ALERTS\n  - Proactive (warns before exceeding)\n  - Integrates with SNS for notifications\n```',
      solution: 'Pricing Calculator = "how much will it cost?" (before). Cost Explorer = "how much did it cost?" (after). Budgets = "alert me when it reaches X" (proactive). They are complementary.'
    },
    {
      title: 'Choosing the Right Support Plan',
      difficulty: 'medium',
      symptom: 'Candidate does not know which Support Plan is appropriate for each scenario.',
      diagnosis: '```\nBasic:\n  - Student, individual, exploring AWS\n  - No tech support (documentation only)\n\nDeveloper:\n  - Developer testing/experimenting\n  - Email support, business hours\n\nBusiness:\n  - Company with production workloads\n  - 24/7 phone support\n  - Full Trusted Advisor\n  - 1h response for critical\n\nEnterprise On-Ramp:\n  - Company with critical workloads\n  - TAM pool, 30 min response\n\nEnterprise:\n  - Large company, mission critical\n  - Dedicated TAM, 15 min response\n  - Concierge support\n```',
      solution: 'On the exam, identify keywords: "24/7 phone support" = Business+. "TAM" = Enterprise. "15 min response" = Enterprise. "Full Trusted Advisor" = Business+. "Free" = Basic.'
    }
  ]
};
