window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-technology-services/management-governance'] = {
  theory: `# Management & Governance

## Exam Relevance
> Management and governance services appear frequently on the CLF-C02. Knowing how to differentiate CloudWatch, CloudTrail, Config, Trusted Advisor, and Systems Manager is essential.

## Amazon CloudWatch

**Monitoring and observability** service. Collects metrics, logs, and events from AWS resources.

### CloudWatch Components

| Component | Function |
|-----------|----------|
| **Metrics** | Resource metrics (EC2 CPU, NetworkIn, etc.) |
| **Alarms** | Alerts based on metrics (e.g., CPU > 80%) |
| **Logs** | Application and service log aggregation |
| **Dashboards** | Custom visualization of metrics |
| **Events/EventBridge** | Events and change-based automation |

### Default EC2 Metrics
- CPUUtilization, NetworkIn, NetworkOut, DiskReadOps
- **NOT included**: memory usage, disk space (requires CloudWatch Agent)

## AWS CloudTrail

Records **all API calls** in the AWS account — who did what, when, from where.

- Enabled by default (90 days of history)
- Create a Trail to store in S3 indefinitely
- Essential for **auditing**, compliance, and security investigation

### CloudWatch vs CloudTrail

| Aspect | CloudWatch | CloudTrail |
|--------|------------|------------|
| **Function** | Monitoring (metrics, logs) | Auditing (API calls) |
| **Question** | How is the resource? | Who did what? |
| **Example** | EC2 CPU at 90% | Who terminated the EC2? |

## AWS Config

Evaluates and **audits the configuration** of your AWS resources. Checks compliance against rules.

- Records configuration change history
- Compliance rules (e.g., EBS volumes must be encrypted)
- Automatic remediation with SSM Automation

## AWS Trusted Advisor

Analyzes your account and recommends improvements in **5 categories**:

| Category | Examples |
|----------|----------|
| **Cost Optimization** | Idle instances, unused Reserved |
| **Performance** | EBS throughput, CloudFront config |
| **Security** | MFA on root, exposed SG rules |
| **Fault Tolerance** | Multi-AZ, backups |
| **Service Limits** | VPC, EIP limits, etc. |

### Trusted Advisor Tiers
- **Basic/Developer**: 7 basic checks (e.g., MFA root, SG exposed ports)
- **Business/Enterprise**: ALL checks + API access

## AWS Systems Manager (SSM)

Operational management of resources. No SSH needed — manages via SSM Agent.

- **Session Manager**: shell access without SSH (no port 22 open)
- **Patch Manager**: patching automation
- **Parameter Store**: secure configuration and secrets storage
- **Run Command**: execute commands on multiple instances

## AWS Organizations

Centralized management of **multiple AWS accounts**.

| Feature | Description |
|---------|-------------|
| **Consolidated Billing** | Single invoice for all accounts |
| **SCPs** | Service Control Policies — limit account permissions |
| **OUs** | Organizational Units — group accounts |
| **Volume Discounts** | Discounts from aggregated usage |

## Other Governance Services

| Service | Description |
|---------|-------------|
| **AWS Control Tower** | Automated multi-account setup with guardrails |
| **AWS Service Catalog** | Catalog of approved products for self-service |
| **AWS Health Dashboard** | AWS service health status |
| **AWS Compute Optimizer** | EC2 right-sizing recommendations |

## Common Mistakes

- Confusing CloudWatch (monitoring) with CloudTrail (API auditing)
- Thinking CloudWatch monitors memory by default — requires Agent
- Confusing Config (configuration compliance) with CloudTrail (API audit)
- Forgetting Trusted Advisor full requires Business/Enterprise plan
`,

  quiz: [
    {
      question: 'Which AWS service records all API calls made in the account?',
      options: ['Amazon CloudWatch', 'AWS CloudTrail', 'AWS Config', 'AWS Trusted Advisor'],
      correct: 1,
      explanation: 'CloudTrail records all API calls — who, what, when, from where. Essential for auditing and security investigation.',
      reference: 'CloudWatch = metrics and monitoring. CloudTrail = API call auditing.'
    },
    {
      question: 'What does Amazon CloudWatch monitor?',
      options: ['API calls', 'Resource metrics, logs, and events', 'Resource configuration', 'Account costs'],
      correct: 1,
      explanation: 'CloudWatch collects metrics (CPU, network), application logs, and allows creating alarms and dashboards for monitoring.',
      reference: 'To monitor memory and disk on EC2, you need to install the CloudWatch Agent.'
    },
    {
      question: 'Which service evaluates the compliance of AWS resource configurations?',
      options: ['CloudTrail', 'CloudWatch', 'AWS Config', 'Trusted Advisor'],
      correct: 2,
      explanation: 'AWS Config records and evaluates resource configuration against compliance rules (e.g., EBS must be encrypted, SG rules check).',
      reference: 'Config = configuration compliance. CloudTrail = who changed it. CloudWatch = current state.'
    },
    {
      question: 'AWS Trusted Advisor analyzes the account across how many categories?',
      options: ['3', '4', '5', '6'],
      correct: 2,
      explanation: 'Trusted Advisor analyzes across 5 categories: Cost Optimization, Performance, Security, Fault Tolerance, and Service Limits.',
      reference: 'Basic/Developer: 7 basic checks. Business/Enterprise: ALL checks.'
    },
    {
      question: 'Which service allows accessing EC2 instances without SSH (no port 22)?',
      options: ['AWS CloudShell', 'SSM Session Manager', 'EC2 Instance Connect', 'AWS Direct Connect'],
      correct: 1,
      explanation: 'SSM Session Manager provides shell access to EC2 without opening port 22. Uses SSM Agent for secure, auditable communication.',
      reference: 'More secure than SSH — no keys, no open ports, with audit trail.'
    },
    {
      question: 'Which AWS Organizations feature limits what services child accounts can use?',
      options: ['Consolidated Billing', 'Service Control Policies (SCPs)', 'IAM Policies', 'AWS Config Rules'],
      correct: 1,
      explanation: 'SCPs are guardrails that limit maximum permissions for accounts in an Organization. Even account admin cannot exceed SCP limits.',
      reference: 'SCPs do not grant permissions — they only restrict. Account still needs IAM policies for allow.'
    },
    {
      question: 'What does AWS Compute Optimizer recommend?',
      options: ['Security configuration', 'EC2 instance right-sizing', 'Data backup', 'DNS routing'],
      correct: 1,
      explanation: 'Compute Optimizer analyzes usage metrics and recommends optimized EC2 instance types (right-sizing), reducing costs and improving performance.',
      reference: 'Also recommends for EBS volumes, Lambda functions, and Auto Scaling Groups.'
    },
    {
      question: 'What is the difference between CloudWatch and CloudTrail?',
      options: ['CloudWatch is free, CloudTrail is paid', 'CloudWatch monitors performance, CloudTrail audits API calls', 'Both do the same thing', 'CloudTrail is for monitoring, CloudWatch for auditing'],
      correct: 1,
      explanation: 'CloudWatch = monitoring (metrics, logs, alarms). CloudTrail = auditing (who called which API, when, from where). Complementary services.',
      reference: 'Classic CLF-C02 question: "who terminated the instance?" = CloudTrail.'
    }
  ],

  flashcards: [
    { front: 'What is the difference between CloudWatch, CloudTrail, and Config?', back: 'CloudWatch = monitoring (metrics, alarms, logs). CloudTrail = API call auditing (who did what). Config = configuration compliance (is resource compliant with rules?).' },
    { front: 'What are the 5 Trusted Advisor categories?', back: 'Cost Optimization, Performance, Security, Fault Tolerance, Service Limits. Basic plan: 7 checks. Business/Enterprise: all checks + API access.' },
    { front: 'What is AWS Systems Manager?', back: 'Operational management: Session Manager (shell without SSH), Patch Manager (auto patching), Parameter Store (configs/secrets), Run Command (execute on fleet), Automation (runbooks).' },
    { front: 'What is AWS Organizations?', back: 'Multi-account management: consolidated billing, SCPs (permission guardrails), OUs (group accounts), volume discounts. Used with Control Tower for automated setup.' },
    { front: 'Which EC2 metrics does CloudWatch NOT monitor by default?', back: 'Memory (RAM) usage and disk space. These metrics require CloudWatch Agent installed on the instance. CPU, network, and disk I/O are monitored by default.' },
    { front: 'What are SCPs in AWS Organizations?', back: 'Service Control Policies — guardrails that limit maximum permissions for child accounts. Do not grant permissions, only restrict. Even account admin cannot violate SCP.' },
    { front: 'What is AWS Control Tower?', back: 'Automated multi-account environment setup with guardrails (preventive and detective), landing zone, account factory. Uses Organizations, Config, and CloudTrail internally.' },
    { front: 'What is AWS Service Catalog?', back: 'Catalog of approved IT products (CloudFormation templates, AMIs) that users can provision self-service. Ensures compliance and standardization.' }
  ],

  lab: {
    scenario: 'Explore AWS management and governance services.',
    objective: 'Differentiate CloudWatch, CloudTrail, and Config and understand when to use each.',
    duration: '10-15 minutes',
    steps: [
      {
        title: 'Differentiate Monitoring Services',
        instruction: 'For each question, identify which service answers it: (1) What is my EC2 CPU now? (2) Who deleted my S3 bucket? (3) Is my Security Group open to the world?',
        hints: ['Current performance = CloudWatch', 'Who did it = CloudTrail', 'Configuration compliance = Config'],
        solution: '```\n1. EC2 CPU -> Amazon CloudWatch\n   - Real-time performance metrics\n   - Dashboard and alarms\n\n2. Who deleted S3 -> AWS CloudTrail\n   - Record of all API calls\n   - Who, when, from where\n\n3. Open SG -> AWS Config\n   - Config Rule: restricted-ssh\n   - Checks if SG allows 0.0.0.0/0 on port 22\n```',
        verify: '```bash\n# Decision rule:\n# "How is it now?" -> CloudWatch\n# "Who did that?" -> CloudTrail\n# "Is it compliant?" -> Config\n# "What to improve?" -> Trusted Advisor\n```'
      },
      {
        title: 'Explore Trusted Advisor',
        instruction: 'In the AWS console, access Trusted Advisor. Check which checks are available on your plan and identify security recommendations.',
        hints: ['Console > Trusted Advisor', 'Basic plan shows 7 free checks'],
        solution: '```\nTrusted Advisor > Dashboard\n\nFree checks (Basic/Developer):\n1. MFA on Root Account\n2. Security Groups - Specific Ports Unrestricted\n3. S3 Bucket Permissions\n4. IAM Use\n5. Service Limits\n6. EBS Public Snapshots\n7. RDS Public Snapshots\n```',
        verify: '```bash\n# Check:\n# How many checks with "warning" or "error" status\n# Focus on Security checks first\n# Expected result: dashboard with recommendations\n```'
      },
      {
        title: 'Multi-Account Governance Scenario',
        instruction: 'Your company has 5 teams that need separate AWS accounts. Design the structure with Organizations, OUs, and SCPs.',
        hints: ['Use OUs to group accounts by function', 'SCPs restrict what accounts can do'],
        solution: '```\nAWS Organization\n|\n|-- OU: Production\n|   |-- Account: prod-app-1\n|   |-- Account: prod-app-2\n|   SCP: deny delete VPC, deny leave org\n|\n|-- OU: Development\n|   |-- Account: dev-team-1\n|   |-- Account: dev-team-2\n|   SCP: deny launch large instances\n|\n|-- OU: Security\n|   |-- Account: security-audit\n|   SCP: full access for security tools\n\nConsolidated Billing enabled\n```',
        verify: '```bash\n# Verification:\n# [x] Management account at root\n# [x] OUs grouping accounts by function\n# [x] SCPs restricting actions per OU\n# [x] Consolidated billing enabled\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'CloudWatch vs CloudTrail vs Config',
      difficulty: 'easy',
      symptom: 'Candidate confuses the three services and does not know which to use.',
      diagnosis: '```\nQuestion: "How much CPU is my EC2 using?"\nAnswer: CloudWatch (metrics)\n\nQuestion: "Who terminated my EC2 yesterday?"\nAnswer: CloudTrail (API audit)\n\nQuestion: "Are my EBS volumes encrypted?"\nAnswer: AWS Config (compliance)\n\nQuestion: "What can I improve?"\nAnswer: Trusted Advisor (recommendations)\n\nQuestion: "Need to access EC2 without SSH"\nAnswer: SSM Session Manager\n```',
      solution: 'CloudWatch = HOW it is (metrics). CloudTrail = WHO did it (audit). Config = IS it compliant (compliance). Trusted Advisor = WHAT to improve (best practices). SSM = MANAGE (operational).'
    },
    {
      title: 'EC2 Memory Not in CloudWatch',
      difficulty: 'medium',
      symptom: 'CloudWatch does not show EC2 memory (RAM) metrics by default.',
      diagnosis: '```\nDEFAULT EC2 metrics (no agent):\n  - CPUUtilization\n  - NetworkIn / NetworkOut\n  - DiskReadOps / DiskWriteOps\n  - StatusCheckFailed\n\nMetrics that NEED Agent:\n  - Memory utilization\n  - Disk space used\n  - Custom application metrics\n  - Process-level metrics\n\nHow to install:\n  1. Install CloudWatch Agent on EC2\n  2. Configure desired metrics\n  3. IAM Role with CloudWatchAgentServerPolicy\n```',
      solution: 'Memory and disk are not metrics the hypervisor can see from outside — they need an agent inside the instance. On the exam, if the question asks to "monitor memory," the answer is "install CloudWatch Agent."'
    }
  ]
};
