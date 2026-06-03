window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-security-compliance/shared-responsibility'] = {
  theory: `# Shared Responsibility Model

## Exam Relevance
> The Shared Responsibility Model appears in **many** CLF-C02 questions. Understand clearly what is AWS responsibility vs customer responsibility.

## The Shared Responsibility Model

Security in AWS is a **shared responsibility** between AWS and the customer:

- **AWS**: responsible for security **OF** the cloud (infrastructure)
- **Customer**: responsible for security **IN** the cloud (data and configurations)

## AWS Responsibilities (Security OF the Cloud)

| Layer | AWS Responsibility |
|-------|-------------------|
| **Hardware/Global Infra** | Physical data centers, global network, Regions, AZs, Edge Locations |
| **Software** | Hypervisor, host OS, compute/storage/database/networking software |
| **Network** | Global network infrastructure, fiber between AZs and Regions |
| **Compliance** | Certifications (SOC, ISO, PCI-DSS), audits |
| **Managed Services** | Patching of managed services (RDS, Lambda, DynamoDB) |

## Customer Responsibilities (Security IN the Cloud)

| Layer | Customer Responsibility |
|-------|------------------------|
| **Data** | Encryption, classification, data protection |
| **Identity** | IAM users, MFA, password policies, roles |
| **Application** | Application firewall, secure code |
| **OS/Network** | EC2 patching, security groups, NACLs |
| **Encryption** | Client-side and server-side encryption, key management |

## Responsibility Varies by Service

### IaaS (e.g., EC2) — More customer responsibility
- Customer: OS patching, firewall (SG), antivirus, data
- AWS: hardware, hypervisor, physical network

### PaaS (e.g., RDS) — Shared responsibility
- Customer: data, access (IAM), security groups, encryption
- AWS: OS patching, engine patching, hardware, automatic backups

### SaaS/Serverless (e.g., Lambda, S3) — More AWS responsibility
- Customer: data, access (IAM policies), encryption
- AWS: everything else (infra, runtime, patching, scaling)

### Container Services
- **ECS/EKS on EC2**: customer patches EC2 worker nodes
- **Fargate**: AWS manages infrastructure, customer manages containers

## AWS Security Services

| Service | Function |
|---------|----------|
| **AWS Shield** | DDoS protection (Standard free, Advanced paid) |
| **AWS WAF** | Web Application Firewall (L7 protection) |
| **Amazon GuardDuty** | ML-based threat detection (analyzes logs) |
| **Amazon Inspector** | Vulnerability scanning for EC2 and containers |
| **Amazon Macie** | Sensitive data discovery in S3 (PII) |
| **AWS Config** | Resource compliance auditing |
| **AWS CloudTrail** | Log of all API calls (who did what) |
| **AWS Artifact** | Access to compliance reports (SOC, PCI, ISO) |
| **AWS Security Hub** | Centralized security dashboard |
| **Amazon Detective** | Security incident investigation |

## Common Mistakes

- Thinking AWS is responsible for EC2 patching — EC2 is IaaS, customer patches
- Confusing Shield (DDoS) with WAF (L7 firewall) with GuardDuty (threat detection)
- Forgetting that the customer is ALWAYS responsible for data and access control
- Thinking RDS patching is customer responsibility — AWS patches engine and OS
`,

  quiz: [
    {
      question: 'In the Shared Responsibility Model, who is responsible for patching the OS on EC2 instances?',
      options: ['AWS', 'The customer', 'Shared equally', 'Depends on the Region'],
      correct: 1,
      explanation: 'EC2 is IaaS — the customer is responsible for OS patching, firewall configuration, and application security. AWS handles hardware and hypervisor.',
      reference: 'Compare with RDS where AWS patches the OS and engine.'
    },
    {
      question: 'Which AWS service provides protection against DDoS attacks?',
      options: ['AWS WAF', 'AWS Shield', 'Amazon GuardDuty', 'Amazon Inspector'],
      correct: 1,
      explanation: 'AWS Shield provides DDoS protection. Shield Standard is free and automatic. Shield Advanced offers additional protection and dedicated support (paid).',
      reference: 'WAF protects against L7 attacks (SQL injection, XSS). Shield protects against DDoS (L3/L4).'
    },
    {
      question: 'Which service analyzes logs to detect threats using machine learning?',
      options: ['AWS Config', 'Amazon Inspector', 'Amazon GuardDuty', 'AWS CloudTrail'],
      correct: 2,
      explanation: 'GuardDuty uses ML to analyze CloudTrail logs, VPC Flow Logs, and DNS logs to detect suspicious activities and threats.',
      reference: 'Inspector scans vulnerabilities. Config audits compliance. CloudTrail records API calls.'
    },
    {
      question: 'In the shared responsibility model, who is responsible for encrypting customer data?',
      options: ['AWS only', 'Customer only', 'Customer (AWS provides tools)', 'Depends on the service'],
      correct: 2,
      explanation: 'The customer is ALWAYS responsible for encrypting their data. AWS provides tools like KMS, but the decision and configuration of encryption is the customer responsibility.',
      reference: 'Customer decides: encrypt or not, which key, who has access.'
    },
    {
      question: 'Which AWS service provides access to compliance reports like SOC and PCI DSS?',
      options: ['AWS Config', 'AWS CloudTrail', 'AWS Artifact', 'AWS Security Hub'],
      correct: 2,
      explanation: 'AWS Artifact is the portal for downloading compliance reports (SOC, PCI, ISO) and signing regulatory agreements (BAA for HIPAA, DPA for GDPR).',
      reference: 'Artifact Reports = download reports. Artifact Agreements = sign agreements.'
    },
    {
      question: 'For Amazon RDS, who is responsible for patching the database engine?',
      options: ['The customer', 'AWS', 'Shared', 'The database vendor'],
      correct: 1,
      explanation: 'RDS is a managed service — AWS is responsible for OS and database engine patching. The customer is responsible for data, access, and security configuration.',
      reference: 'Compare: EC2 (customer patches) vs RDS (AWS patches).'
    },
    {
      question: 'Which service discovers sensitive data (PII) stored in Amazon S3?',
      options: ['Amazon Inspector', 'Amazon Macie', 'AWS Config', 'Amazon GuardDuty'],
      correct: 1,
      explanation: 'Amazon Macie uses ML to discover, classify, and protect sensitive data (PII, financial data, credentials) stored in S3.',
      reference: 'Inspector = EC2/container vulnerabilities. Macie = sensitive data in S3.'
    },
    {
      question: 'What type of information does AWS CloudTrail record?',
      options: ['Performance metrics', 'API calls made in the AWS account', 'Billing data', 'Service health status'],
      correct: 1,
      explanation: 'CloudTrail records all API calls made in the AWS account — who, what, when, where. Essential for auditing and compliance.',
      reference: 'CloudTrail = API audit log. CloudWatch = application metrics and logs.'
    }
  ],

  flashcards: [
    { front: 'What does "Security OF the Cloud" vs "Security IN the Cloud" mean?', back: 'OF = AWS responsibility (physical infra, hypervisor, global network). IN = customer responsibility (data, IAM, EC2 OS patching, encryption, firewall config).' },
    { front: 'What is the difference between AWS Shield and AWS WAF?', back: 'Shield = DDoS protection (L3/L4). Shield Standard is free. WAF = Web Application Firewall (L7), protects against SQL injection, XSS. Both can be used together.' },
    { front: 'What is Amazon GuardDuty?', back: 'Threat detection service using ML to analyze CloudTrail logs, VPC Flow Logs, and DNS logs. Identifies suspicious activities like crypto-mining, anomalous access, malicious IP communication.' },
    { front: 'What is AWS Artifact?', back: 'Portal for accessing compliance reports (SOC 1/2/3, PCI DSS, ISO 27001) and signing regulatory agreements (BAA for HIPAA, DPA for GDPR). Not a technical service, it is documentary.' },
    { front: 'How does responsibility vary by service type?', back: 'IaaS (EC2): customer does more (OS patching). PaaS (RDS): AWS patches, customer handles data. Serverless (Lambda): AWS does almost everything, customer handles data and code.' },
    { front: 'What is Amazon Inspector?', back: 'Service that automatically scans EC2 instances and container images (ECR) for vulnerabilities. Checks CVEs, network exposure, and best practices. Different from GuardDuty (threats) and Macie (PII).' },
    { front: 'What is Amazon Macie?', back: 'Service using ML to discover and protect sensitive data (PII, financial data, credentials) stored in Amazon S3. Generates alerts about exposed or unprotected data.' },
    { front: 'What is AWS Security Hub?', back: 'Centralized dashboard aggregating findings from GuardDuty, Inspector, Macie, Firewall Manager, and partners. Unified security view with compliance scoring and alert prioritization.' }
  ],

  lab: {
    scenario: 'Analyze Shared Responsibility Model scenarios and classify responsibilities.',
    objective: 'Correctly identify what is AWS vs customer responsibility in different scenarios.',
    duration: '10-15 minutes',
    steps: [
      {
        title: 'Classify Responsibilities',
        instruction: 'For each item, classify if it is AWS or Customer responsibility: EC2 patching, physical data center security, Security Group configuration, RDS engine patching, S3 data encryption.',
        hints: ['Think: who has control over this item?', 'Managed services = AWS does more'],
        solution: '```\nAWS:\n  - Physical data center security\n  - RDS engine and OS patching\n  - Global network infrastructure\n\nCustomer:\n  - EC2 OS patching\n  - Security Group configuration\n  - S3 data encryption\n  - IAM users and permissions\n  - MFA\n```',
        verify: '```bash\n# Conceptual verification:\n# EC2 OS patching = Customer (IaaS)\n# RDS engine patching = AWS (PaaS managed)\n# S3 encryption = Customer (decision to encrypt)\n# Data center security = AWS (always)\n# Security Groups = Customer (configuration)\n```'
      },
      {
        title: 'Explore Security Services',
        instruction: 'In the AWS console, navigate to GuardDuty, Inspector, and Security Hub. Check which are enabled in your account.',
        hints: ['Many have a 30-day free trial', 'Security Hub aggregates findings from other services'],
        solution: '```\n1. Console > GuardDuty > check if enabled\n2. Console > Inspector > check scan status\n3. Console > Security Hub > view findings dashboard\n\nFree services:\n- CloudTrail (1 free trail)\n- Shield Standard (automatic)\n- IAM Access Analyzer\n- AWS Config (paid per rule)\n```',
        verify: '```bash\n# Via CLI:\naws guardduty list-detectors\n# Output with detector ID = enabled\n\naws securityhub describe-hub\n# Output with HubArn = enabled\n```'
      },
      {
        title: 'Access AWS Artifact',
        instruction: 'Access AWS Artifact in the console and explore available compliance reports. Identify SOC and ISO reports.',
        hints: ['Console > Artifact > Reports', 'Reports require accepting an NDA'],
        solution: '```\nAWS Artifact > Reports:\n- SOC 1 Type II\n- SOC 2 Type II\n- SOC 3\n- PCI DSS Level 1\n- ISO 27001\n- ISO 27017\n- ISO 27018\n\nAWS Artifact > Agreements:\n- BAA (Business Associate Agreement) for HIPAA\n- DPA (Data Processing Agreement) for GDPR\n```',
        verify: '```bash\n# Manual verification:\n# Access Console > Artifact\n# Verify reports are listed\n# Note: download requires accepting NDA\n# Expected result: list of SOC and ISO reports\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Who Patches? EC2 vs RDS vs Lambda',
      difficulty: 'easy',
      symptom: 'Candidate cannot determine who is responsible for patching across different services.',
      diagnosis: '```\nSimple rule:\n\nEC2 (IaaS):\n  OS patching = CUSTOMER\n  App patching = CUSTOMER\n  Hardware = AWS\n\nRDS (PaaS managed):\n  OS patching = AWS\n  Engine patching = AWS\n  Data/access = CUSTOMER\n\nLambda (Serverless):\n  Runtime patching = AWS\n  Code = CUSTOMER\n  Data = CUSTOMER\n\nFargate (Serverless containers):\n  Infra = AWS\n  Container image = CUSTOMER\n```',
      solution: 'The more managed the service, the less the customer does. IaaS = customer does more. Serverless = customer does less. The customer is ALWAYS responsible for data and access.'
    },
    {
      title: 'Shield vs WAF vs GuardDuty Confusion',
      difficulty: 'medium',
      symptom: 'Candidate confuses the three security services — all "protect" but in different ways.',
      diagnosis: '```\nAWS Shield:\n  Protects against: DDoS (L3/L4)\n  How: absorbs and mitigates malicious traffic\n  Standard: free, automatic\n  Advanced: paid, dedicated support, cost protection\n\nAWS WAF:\n  Protects against: L7 attacks (SQL injection, XSS)\n  How: customizable rules, IP blocking, rate limiting\n  Works with: CloudFront, ALB, API Gateway\n\nAmazon GuardDuty:\n  Protects against: threats (threat detection)\n  How: ML analyzes logs (CloudTrail, VPC Flow, DNS)\n  Detects: crypto-mining, compromised instances, anomalies\n```',
      solution: 'Shield = DDoS. WAF = web attacks (L7). GuardDuty = threat detection via logs. Inspector = vulnerability scanning. Macie = sensitive data. Memorize each with one keyword.'
    }
  ]
};
