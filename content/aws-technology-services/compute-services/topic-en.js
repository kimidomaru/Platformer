window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-technology-services/compute-services'] = {
  theory: `# Compute Services

## Exam Relevance
> The **Cloud Technology and Services** domain is worth **34%** of the CLF-C02. Knowing how to differentiate compute services is fundamental.

## Amazon EC2 (Elastic Compute Cloud)

Virtual machines (instances) in the cloud. The most fundamental AWS compute service.

### Instance Types (Families)

| Family | Use | Examples |
|--------|-----|----------|
| **General Purpose** (t3, m5) | Balanced workloads | Web servers, dev/test |
| **Compute Optimized** (c5, c6g) | CPU-intensive | Batch processing, ML inference |
| **Memory Optimized** (r5, x1) | RAM-intensive | In-memory databases, caches |
| **Storage Optimized** (i3, d2) | I/O intensive | Data warehouses, HDFS |
| **Accelerated** (p4, g4) | GPU | Deep learning, video encoding |

### EC2 Purchase Models

| Model | Description | Discount | Commitment |
|-------|-------------|----------|------------|
| **On-Demand** | Pay per hour/second | 0% | None |
| **Reserved** | Reserve 1 or 3 years | Up to 72% | 1-3 years |
| **Savings Plans** | Spend commitment | Up to 72% | 1-3 years |
| **Spot** | Spare capacity | Up to 90% | None (can be interrupted) |
| **Dedicated Host** | Dedicated physical server | Variable | Compliance/licensing |
| **Dedicated Instance** | Instance on dedicated hardware | Variable | Isolation |

### Spot Instances — Important
- Up to 90% discount over On-Demand
- AWS can interrupt with 2-minute notice
- Ideal for: batch jobs, data analysis, CI/CD, fault-tolerant workloads
- NOT ideal for: databases, critical web servers

## AWS Lambda (Serverless Compute)

Runs code without provisioning servers. Pay only for execution time.

### Characteristics
- Maximum timeout: **15 minutes**
- Memory: 128 MB to 10 GB
- Pay for: number of invocations + duration (ms)
- Supports: Python, Node.js, Java, Go, .NET, Ruby, custom runtimes
- Triggers: API Gateway, S3, DynamoDB, SQS, EventBridge, etc.
- Free tier: 1 million invocations/month

## Amazon ECS & EKS (Containers)

### Amazon ECS (Elastic Container Service)
- AWS proprietary container orchestration
- Runs Docker containers
- Two launch modes:
  - **EC2 Launch Type**: you manage EC2 instances
  - **Fargate Launch Type**: serverless, AWS manages infra

### Amazon EKS (Elastic Kubernetes Service)
- AWS managed Kubernetes
- Compatible with K8s tools (kubectl, Helm)
- Also supports Fargate

### AWS Fargate
- Serverless engine for ECS and EKS
- No need to manage EC2 instances
- Pay for vCPU and memory used

## Other Compute Services

| Service | Description | Use Case |
|---------|-------------|----------|
| **Lightsail** | Simple VPS, fixed price | Simple sites, WordPress |
| **Elastic Beanstalk** | PaaS — automatic deploy | Web apps without managing infra |
| **App Runner** | Simplified container deploy | APIs and web apps in containers |
| **Batch** | Batch processing | HPC jobs, simulations |
| **Outposts** | AWS compute on-premises | Hybrid cloud |

## Auto Scaling

### EC2 Auto Scaling
- Automatically adjusts the number of instances
- Based on metrics (CPU, requests, custom)
- Ensures minimum, desired, and maximum instances
- Integrates with ELB to distribute traffic

### Scaling Types
- **Scale Out**: add instances (demand increase)
- **Scale In**: remove instances (demand decrease)
- **Vertical Scaling**: change instance type (t3.micro to t3.large)
- **Horizontal Scaling**: add more instances

## Elastic Load Balancing (ELB)

| Type | Layer | Use |
|------|-------|-----|
| **ALB** (Application LB) | Layer 7 (HTTP/HTTPS) | Web apps, microservices, path routing |
| **NLB** (Network LB) | Layer 4 (TCP/UDP) | High performance, low latency |
| **GLB** (Gateway LB) | Layer 3 | Virtual appliances (firewalls) |
| **CLB** (Classic LB) | Layer 4/7 | Legacy — do not use for new projects |

## Common Mistakes

- Confusing ECS with EKS — ECS is AWS proprietary, EKS is managed Kubernetes
- Thinking Fargate is a separate service — it is a launch type for ECS/EKS
- Confusing Spot with Reserved — Spot can be interrupted, Reserved cannot
- Thinking Lambda runs indefinitely — maximum timeout is 15 minutes
`,

  quiz: [
    {
      question: 'Which EC2 purchase model offers up to 90% discount but can be interrupted by AWS?',
      options: ['Reserved Instances', 'On-Demand', 'Spot Instances', 'Savings Plans'],
      correct: 2,
      explanation: 'Spot Instances use spare AWS capacity with up to 90% discount. AWS can interrupt with 2-minute notice when capacity is needed.',
      reference: 'Ideal for batch processing, CI/CD, fault-tolerant workloads.'
    },
    {
      question: 'What is the maximum timeout for an AWS Lambda function?',
      options: ['5 minutes', '10 minutes', '15 minutes', '60 minutes'],
      correct: 2,
      explanation: 'Lambda has a maximum timeout of 15 minutes (900 seconds). For longer processes, consider Step Functions, ECS, or EC2.',
      reference: 'Lambda charges per invocation + duration in ms.'
    },
    {
      question: 'Which service allows running containers without managing EC2 instances?',
      options: ['Amazon ECS with EC2', 'Amazon EKS with EC2', 'AWS Fargate', 'Amazon Lightsail'],
      correct: 2,
      explanation: 'AWS Fargate is the serverless engine for containers. Works with ECS and EKS, eliminating the need to provision and manage EC2 instances.',
      reference: 'Fargate = serverless containers. Pay per vCPU + memory per task.'
    },
    {
      question: 'Which Load Balancer type operates at Layer 7 (HTTP/HTTPS)?',
      options: ['Network Load Balancer', 'Application Load Balancer', 'Gateway Load Balancer', 'Classic Load Balancer'],
      correct: 1,
      explanation: 'Application Load Balancer (ALB) operates at Layer 7 and supports path-based routing, host-based routing, and integration with containers and microservices.',
      reference: 'NLB = Layer 4 (TCP/UDP, high performance). GLB = Layer 3 (virtual appliances).'
    },
    {
      question: 'What is the difference between ECS and EKS?',
      options: ['ECS is serverless, EKS is not', 'ECS uses Docker, EKS uses Kubernetes', 'ECS is free, EKS is paid', 'There is no difference'],
      correct: 1,
      explanation: 'ECS is the AWS proprietary container orchestrator. EKS is managed Kubernetes. Both can use Fargate for serverless operation.',
      reference: 'EKS is ideal if you already use Kubernetes. ECS for simplicity and AWS-native integration.'
    },
    {
      question: 'Which EC2 instance family is ideal for CPU-intensive workloads like batch processing?',
      options: ['General Purpose (t3)', 'Memory Optimized (r5)', 'Compute Optimized (c5)', 'Storage Optimized (i3)'],
      correct: 2,
      explanation: 'Compute Optimized (c5, c6g) are optimized for CPU — ideal for batch processing, ML inference, gaming servers, and computational workloads.',
      reference: 'General Purpose = balanced. Memory = RAM. Storage = I/O. Accelerated = GPU.'
    },
    {
      question: 'What is Horizontal Scaling?',
      options: ['Increasing instance size', 'Adding more instances', 'Changing Region', 'Adding more storage'],
      correct: 1,
      explanation: 'Horizontal Scaling (Scale Out/In) adds or removes instances. Vertical Scaling changes instance type (e.g., t3.micro to t3.large).',
      reference: 'AWS recommends Horizontal Scaling — more resilient than Vertical.'
    },
    {
      question: 'Which AWS service is ideal for hosting a simple WordPress site with predictable pricing?',
      options: ['Amazon EC2', 'AWS Lambda', 'Amazon Lightsail', 'AWS Elastic Beanstalk'],
      correct: 2,
      explanation: 'Lightsail offers simple VPS with fixed monthly pricing, ideal for simple sites, blogs, WordPress. Includes compute, storage, and bandwidth in a package.',
      reference: 'Lightsail is simpler and more predictable than EC2 for basic workloads.'
    }
  ],

  flashcards: [
    { front: 'What are the EC2 purchase models?', back: 'On-Demand (no commitment), Reserved (1-3 years, up to 72% off), Savings Plans (spend commitment), Spot (up to 90% off, interruptible), Dedicated Host (physical server), Dedicated Instance.' },
    { front: 'What is AWS Lambda?', back: 'Serverless service that runs code without provisioning servers. Max timeout 15 min. Pay per invocation + duration (ms). Free tier: 1M invocations/month. Supports Python, Node, Java, Go, .NET.' },
    { front: 'What is the difference between ECS and EKS?', back: 'ECS = AWS proprietary container orchestrator. EKS = managed Kubernetes. Both support Fargate (serverless). EKS if you use K8s, ECS for AWS-native simplicity.' },
    { front: 'What is AWS Fargate?', back: 'Serverless engine for containers. Works with ECS and EKS. No managing EC2 instances. Pay per vCPU and memory per task. AWS manages all underlying infrastructure.' },
    { front: 'What are the Load Balancer types?', back: 'ALB = Layer 7 (HTTP/HTTPS, path routing). NLB = Layer 4 (TCP/UDP, high performance). GLB = Layer 3 (virtual appliances). CLB = legacy, do not use.' },
    { front: 'When to use Spot Instances?', back: 'For fault-tolerant workloads: batch processing, data analysis, CI/CD, image processing. Up to 90% off. AWS can interrupt with 2 min notice. NEVER for databases or critical apps.' },
    { front: 'What is EC2 Auto Scaling?', back: 'Automatically adjusts instance count based on metrics. Defines min/desired/max instances. Scale Out (add) and Scale In (remove). Integrates with ELB for traffic distribution.' },
    { front: 'What are EC2 instance families?', back: 'General Purpose (t3/m5): balanced. Compute Optimized (c5): CPU. Memory Optimized (r5): RAM. Storage Optimized (i3): I/O. Accelerated (p4/g4): GPU.' }
  ],

  lab: {
    scenario: 'Understand AWS compute services and when to use each one.',
    objective: 'Select the correct compute service for different scenarios.',
    duration: '10-15 minutes',
    steps: [
      {
        title: 'Select EC2 Instance Type',
        instruction: 'For each scenario, choose the correct instance family: (1) Low-traffic web server, (2) Machine learning training, (3) In-memory database.',
        hints: ['Basic web server = General Purpose', 'ML training = GPU = Accelerated', 'In-memory DB = Memory Optimized'],
        solution: '```\n1. Low-traffic web server -> t3.micro (General Purpose)\n   - Burstable, cheap, ideal for light loads\n\n2. ML training -> p4d.24xlarge (Accelerated/GPU)\n   - 8x NVIDIA A100 GPUs, ideal for deep learning\n\n3. In-memory database -> r5.xlarge (Memory Optimized)\n   - High memory/CPU ratio, ideal for Redis, Memcached\n```',
        verify: '```bash\n# Check in the console:\n# EC2 > Instance Types\n# Filter by family and compare specs\n# t3 = General Purpose (burstable)\n# p4 = Accelerated (GPU)\n# r5 = Memory Optimized\n```'
      },
      {
        title: 'Choose Purchase Model',
        instruction: 'For each case, select the purchase model: (1) Production server 24/7 for 3 years, (2) Interruptible data processing job, (3) Testing a new application for 2 weeks.',
        hints: ['Long-term production = Reserved/Savings Plans', 'Interruptible = Spot', 'Short-term = On-Demand'],
        solution: '```\n1. Production 24/7 for 3 years -> Reserved Instance or Savings Plan\n   - Up to 72% discount, 3-year commitment\n\n2. Interruptible job -> Spot Instance\n   - Up to 90% discount, AWS can reclaim capacity\n\n3. Test for 2 weeks -> On-Demand\n   - No commitment, pay per hour, stop when done\n```',
        verify: '```bash\n# Check in the console:\n# EC2 > Pricing > compare models\n# Reserved: lowest cost for stable workloads\n# Spot: lowest cost for flexible workloads\n# On-Demand: highest cost but most flexibility\n```'
      },
      {
        title: 'Choose Compute Service',
        instruction: 'For each scenario, select the correct service: (1) API handling 100 requests/day, (2) Docker web application, (3) Simple WordPress site.',
        hints: ['Few requests = Lambda (serverless)', 'Docker = ECS/Fargate', 'Simple WordPress = Lightsail'],
        solution: '```\n1. API 100 req/day -> Lambda + API Gateway\n   - Serverless, pay per invocation, free tier covers\n\n2. Docker app -> ECS with Fargate\n   - Serverless containers, no managing EC2\n\n3. WordPress -> Lightsail\n   - Simple VPS, fixed price, WordPress blueprints\n   - Alternative: Elastic Beanstalk\n```',
        verify: '```bash\n# Decision rule:\n# < 15 min execution + event-driven -> Lambda\n# Containers -> ECS/EKS (+ Fargate if serverless)\n# Simple VPS -> Lightsail\n# Deploy code without infra -> Elastic Beanstalk\n# Full control -> EC2\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Lambda vs EC2 vs Fargate — When to Use Which?',
      difficulty: 'medium',
      symptom: 'Candidate cannot differentiate when to use Lambda, EC2, or Fargate.',
      diagnosis: '```\nLambda:\n  - Short executions (< 15 min)\n  - Event-driven (S3, API Gateway, SQS)\n  - Few hundred MB of memory\n  - Pay per invocation, zero when idle\n\nFargate:\n  - Continuously running containers\n  - Apps needing more than 10 GB RAM\n  - No managing EC2\n  - Pay per vCPU/memory while running\n\nEC2:\n  - Full OS control\n  - Apps with specific OS/kernel requirements\n  - Workloads with per-core licensing\n  - Pay per hour/second\n```',
      solution: 'Lambda for short event-driven functions. Fargate for containers without managing infra. EC2 for full control. When unsure, start with Lambda (cheapest, least management) and scale to Fargate/EC2 if needed.'
    },
    {
      title: 'Spot Instance Interrupted',
      difficulty: 'easy',
      symptom: 'Candidate uses Spot for production database and loses data when AWS reclaims the instance.',
      diagnosis: '```\nSpot Instances:\n  - AWS can interrupt with 2-minute notice\n  - The instance is TERMINATED (not paused)\n  - Instance store data is LOST\n  - EBS volumes survive if not deleted\n\nBest practices for Spot:\n  - Use for stateless, fault-tolerant workloads\n  - Combine with On-Demand (mixed fleet)\n  - Use Spot Fleet to diversify instance types\n  - Save checkpoints frequently\n```',
      solution: 'NEVER use Spot for databases, critical web servers, or stateful workloads. Use Spot for batch processing, rendering, CI/CD, data analysis. Combine Spot + On-Demand in Auto Scaling Groups to balance cost and availability.'
    }
  ]
};
