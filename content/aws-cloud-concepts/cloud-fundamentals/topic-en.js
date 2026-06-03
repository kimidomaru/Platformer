window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-cloud-concepts/cloud-fundamentals'] = {
  theory: `# Cloud Computing Fundamentals

## Exam Relevance
> The **Cloud Concepts** domain is worth **24%** of the CLF-C02 exam. This topic covers the definition of cloud computing, deployment models, benefits, and the AWS Well-Architected Framework.

## What is Cloud Computing?

Cloud computing is the on-demand delivery of IT resources over the internet with pay-as-you-go pricing. Instead of buying, maintaining, and operating physical data centers, you access technology services (compute, storage, databases) from a cloud provider like AWS.

### Essential Characteristics (NIST)

| Characteristic | Description |
|----------------|-------------|
| **On-demand self-service** | Provision resources without human interaction with the provider |
| **Broad network access** | Access over the network via standard mechanisms (HTTP/HTTPS) |
| **Resource pooling** | Resources shared among multiple customers (multi-tenant) |
| **Rapid elasticity** | Scale up or down quickly based on demand |
| **Measured service** | Usage monitored and billed based on actual consumption |

## Service Models

### IaaS — Infrastructure as a Service
Provides basic IT building blocks in the cloud: networking, compute, storage. Maximum control over resources.
- **AWS Example**: Amazon EC2, Amazon VPC, Amazon EBS

### PaaS — Platform as a Service
Removes the need to manage underlying infrastructure. Focus on deploying and managing applications.
- **AWS Example**: AWS Elastic Beanstalk, AWS App Runner, Amazon RDS

### SaaS — Software as a Service
Complete product run and managed by the provider. The user simply consumes the software.
- **AWS Example**: Amazon WorkSpaces, Amazon Chime, AWS Marketplace SaaS

## Deployment Models

### Public Cloud
- Shared resources accessed over the internet
- No upfront hardware investment
- Pay-as-you-go
- Example: Running applications entirely on AWS

### Private Cloud (On-Premises)
- Dedicated infrastructure operated by the organization
- Full control over security and compliance
- Example: VMware, OpenStack, AWS Outposts

### Hybrid Cloud
- Combines public cloud with on-premises infrastructure
- Connects local resources to cloud resources
- Example: Keep sensitive data on-prem and burst to AWS

## Benefits of Cloud Computing

### 1. Trade CapEx for OpEx
Capital Expense (buying servers) becomes Operational Expense (pay for use). No massive upfront investment.

### 2. Economies of Scale
AWS aggregates usage from thousands of customers, achieving lower prices than you could alone.

### 3. Stop guessing capacity
No need to estimate future demand. Scale as needed in minutes.

### 4. Increase speed and agility
New resources available in minutes instead of weeks. Reduce time to experiment.

### 5. Stop spending money on data centers
Focus on your business, not physical infrastructure.

### 6. Go global in minutes
Deploy to multiple regions worldwide with a few clicks.

## AWS Well-Architected Framework

The framework defines **6 pillars** for building secure, resilient, efficient, and cost-effective architectures:

| Pillar | Focus |
|--------|-------|
| **Operational Excellence** | Automate operations, respond to events, improve processes |
| **Security** | Protect data, systems, and assets using security best practices |
| **Reliability** | Recover from failures, scale to meet demand |
| **Performance Efficiency** | Use resources efficiently as demand changes |
| **Cost Optimization** | Eliminate unnecessary spending |
| **Sustainability** | Minimize environmental impact of workloads |

### AWS Well-Architected Tool
A free service that helps review your architectures against best practices across all 6 pillars. Generates a report with improvement recommendations.

## Common Exam Mistakes

- Confusing IaaS with PaaS — EC2 is IaaS (you manage the OS), Elastic Beanstalk is PaaS
- Thinking hybrid cloud = multi-cloud — hybrid is on-prem + cloud, multi-cloud is using multiple providers
- Forgetting the Sustainability pillar in Well-Architected (added in 2021)
- Confusing CapEx vs OpEx — cloud is OpEx, owning a data center is CapEx
`,

  quiz: [
    {
      question: 'Which of the following is an essential characteristic of cloud computing according to NIST?',
      options: ['Fixed monthly pricing', 'On-demand self-service', 'Mandatory dedicated hardware', 'Long-term contracts'],
      correct: 1,
      explanation: 'On-demand self-service is one of the 5 NIST essential characteristics: users can provision resources without human interaction with the provider.',
      reference: 'Related concept: NIST Definition of Cloud Computing'
    },
    {
      question: 'Amazon EC2 is an example of which service model?',
      options: ['SaaS', 'PaaS', 'IaaS', 'FaaS'],
      correct: 2,
      explanation: 'EC2 is IaaS — it provides virtual machines where you manage the operating system, patches, and applications. AWS manages the physical infrastructure.',
      reference: 'Differentiating IaaS/PaaS/SaaS is a frequent CLF-C02 topic.'
    },
    {
      question: 'Which deployment model combines on-premises infrastructure with cloud resources?',
      options: ['Public cloud', 'Private cloud', 'Hybrid cloud', 'Multi-cloud'],
      correct: 2,
      explanation: 'Hybrid cloud connects local infrastructure (on-premises) with the public cloud, allowing workloads to move between both.',
      reference: 'Do not confuse with multi-cloud (using AWS + Azure, for example).'
    },
    {
      question: 'Which cloud benefit allows you to stop guessing about infrastructure capacity?',
      options: ['Economies of scale', 'Elasticity', 'Trade CapEx for OpEx', 'Go global in minutes'],
      correct: 1,
      explanation: 'Elasticity allows scaling up or down based on actual demand, eliminating the need to estimate future capacity.',
      reference: 'Auto Scaling Groups are the primary elasticity mechanism for EC2.'
    },
    {
      question: 'How many pillars does the AWS Well-Architected Framework have?',
      options: ['4', '5', '6', '7'],
      correct: 2,
      explanation: 'The Well-Architected Framework has 6 pillars: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, and Sustainability.',
      reference: 'The Sustainability pillar was added in 2021.'
    },
    {
      question: 'What does the shift from CapEx to OpEx mean in cloud computing?',
      options: ['Switching software licenses to open source', 'Switching upfront hardware investment to pay-per-use', 'Switching physical servers to containers', 'Switching in-house staff to outsourced teams'],
      correct: 1,
      explanation: 'CapEx is upfront investment in physical assets. OpEx is paying for operational use. Cloud transforms infrastructure costs into operational expenses.',
      reference: 'Key benefit frequently tested on the CLF-C02.'
    },
    {
      question: 'AWS Elastic Beanstalk is an example of which service model?',
      options: ['IaaS', 'PaaS', 'SaaS', 'CaaS'],
      correct: 1,
      explanation: 'Elastic Beanstalk is PaaS — you upload code and the service handles provisioning, load balancing, auto scaling, and monitoring.',
      reference: 'Compare: EC2 (IaaS) vs Beanstalk (PaaS) vs Lambda (FaaS).'
    },
    {
      question: 'Which Well-Architected pillar focuses on minimizing environmental impact?',
      options: ['Cost Optimization', 'Operational Excellence', 'Sustainability', 'Reliability'],
      correct: 2,
      explanation: 'Sustainability is the 6th pillar, added in 2021, focused on maximizing efficiency and minimizing environmental impact of workloads.',
      reference: 'Most recent pillar — may appear as a distractor if candidates are unaware of it.'
    }
  ],

  flashcards: [
    { front: 'What are the 3 cloud computing service models?', back: 'IaaS (Infrastructure as a Service) — e.g., EC2. PaaS (Platform as a Service) — e.g., Elastic Beanstalk. SaaS (Software as a Service) — e.g., Amazon WorkSpaces.' },
    { front: 'What are the 3 cloud deployment models?', back: 'Public cloud (everything in the cloud), private cloud (dedicated on-premises), and hybrid cloud (combination of on-prem + public cloud).' },
    { front: 'What are the 5 essential characteristics of cloud (NIST)?', back: 'On-demand self-service, broad network access, resource pooling (multi-tenant), rapid elasticity, and measured service (pay-as-you-go).' },
    { front: 'What are the 6 pillars of the AWS Well-Architected Framework?', back: 'Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, and Sustainability.' },
    { front: 'What is the difference between CapEx and OpEx?', back: 'CapEx (Capital Expenditure) = upfront investment in assets (buying servers). OpEx (Operational Expenditure) = paying for ongoing use (pay-as-you-go in cloud). Cloud transforms CapEx into OpEx.' },
    { front: 'What is the AWS Well-Architected Tool?', back: 'A free AWS service that helps review architectures against best practices across all 6 pillars. Generates reports with improvement recommendations for your workloads.' },
    { front: 'What is the difference between hybrid cloud and multi-cloud?', back: 'Hybrid = on-premises + public cloud (one provider). Multi-cloud = using multiple cloud providers (AWS + Azure, for example). They are different concepts.' },
    { front: 'What is "economies of scale" in the cloud context?', back: 'AWS aggregates usage from thousands of customers, achieving lower unit costs. This benefit is passed on as lower prices than maintaining your own infrastructure.' }
  ],

  lab: {
    scenario: 'In this conceptual lab, you will explore the AWS console and identify service models in action.',
    objective: 'Classify AWS services by model (IaaS/PaaS/SaaS) and review the AWS Well-Architected Tool.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Classify AWS Services',
        instruction: 'Access the AWS console. List 3 services for each model: IaaS, PaaS, SaaS. Hint: EC2, RDS, Elastic Beanstalk, Lambda, WorkSpaces, Lightsail.',
        hints: ['EC2 = IaaS (you manage the OS)', 'Elastic Beanstalk = PaaS (upload code, AWS manages infra)', 'Lambda is FaaS, but often categorized as PaaS'],
        solution: '```\nIaaS: EC2, VPC, EBS\nPaaS: Elastic Beanstalk, RDS, App Runner\nSaaS: WorkSpaces, Chime, Connect\nFaaS (subset of PaaS): Lambda\n```',
        verify: '```bash\n# In the AWS console, access each service and verify:\n# EC2 > Launch Instance — you choose AMI and manage the OS = IaaS\n# Elastic Beanstalk > Create Application — upload code = PaaS\n# Expected result: correct classification of at least 6 services\n```'
      },
      {
        title: 'Explore the Well-Architected Tool',
        instruction: 'In the AWS console, navigate to AWS Well-Architected Tool. Create a test workload and answer questions from the Security pillar.',
        hints: ['Search for "Well-Architected" in the console search bar', 'It is free — no charges'],
        solution: '```\n1. AWS Console > Well-Architected Tool\n2. Create Workload > name: "test-workload"\n3. Select the "Security" pillar\n4. Answer questions (can select "None of these")\n5. Review the generated report with High/Medium risk items\n```',
        verify: '```bash\n# Verify:\n# - Workload appears in the list\n# - Report shows risk items\n# - Recommendations are listed by pillar\n# Expected result: report with improvement plan\n```'
      },
      {
        title: 'Map Benefits to AWS Features',
        instruction: 'For each cloud benefit, identify which AWS service/feature implements it: Elasticity, Global Reach, Pay-as-you-go.',
        hints: ['Auto Scaling = Elasticity', 'Regions/AZs = Global Reach', 'On-Demand pricing = Pay-as-you-go'],
        solution: '```\nElasticity -> Auto Scaling Groups + ELB\nGlobal Reach -> 30+ Regions, 90+ AZs, CloudFront edge locations\nPay-as-you-go -> EC2 On-Demand, Lambda per-invocation, S3 per-GB\nCapEx->OpEx -> No hardware purchase, pay for use\nEconomies of Scale -> Prices reduce as AWS grows\n```',
        verify: '```bash\n# Verify in the console:\n# EC2 > Auto Scaling Groups — confirm elasticity\n# Console header > Region selector — see available regions\n# Billing > Bills — see usage-based billing\n# Expected result: correct mapping of 5 benefits\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'IaaS vs PaaS Confusion',
      difficulty: 'easy',
      symptom: 'Candidate cannot correctly classify RDS — is it IaaS or PaaS?',
      diagnosis: '```\nAsk yourself: who manages the OS?\n- EC2: YOU manage the OS -> IaaS\n- RDS: AWS manages the OS and engine -> PaaS\n- But RDS allows choosing engine and configuring parameters\n\nRule of thumb:\n- If you SSH into the server -> IaaS\n- If you do NOT SSH -> PaaS or SaaS\n```',
      solution: 'RDS is PaaS — AWS manages the OS, patching, and backups. You choose the engine (MySQL, PostgreSQL) but do not access the OS. DynamoDB is even more managed (serverless). The key is: how much infrastructure control do you HAVE?'
    },
    {
      title: 'Well-Architected Pillar Confusion',
      difficulty: 'medium',
      symptom: 'Candidate confuses Reliability with Operational Excellence, or forgets Sustainability.',
      diagnosis: '```\nMnemonic for the 6 pillars: SCORPS\n- S: Security\n- C: Cost Optimization\n- O: Operational Excellence\n- R: Reliability\n- P: Performance Efficiency\n- S: Sustainability\n\nDifferentiation tips:\n- Operational Excellence = processes, runbooks, IaC\n- Reliability = failure recovery, auto scaling\n- Performance Efficiency = using the right resource type\n```',
      solution: 'Memorize SCORPS. Reliability is about RECOVERING from failures (DR, multi-AZ). Operational Excellence is about OPERATING well (automation, IaC, CI/CD). Performance Efficiency is about CHOOSING the right resources. Cost Optimization is about NOT WASTING money.'
    }
  ]
};
