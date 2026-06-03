window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-technology-services/networking-cdn'] = {
  theory: `# Networking & Content Delivery

## Exam Relevance
> Networking is an important area of the CLF-C02. VPC, Route 53, CloudFront, and hybrid connectivity appear frequently.

## Amazon VPC (Virtual Private Cloud)

Isolated virtual network in AWS where you launch resources. Each VPC belongs to a Region.

### VPC Components

| Component | Description |
|-----------|-------------|
| **Subnets** | Network segments within the VPC (public or private) |
| **Internet Gateway** | VPC connection to the internet (1 per VPC) |
| **NAT Gateway** | Allows private subnets to access internet (outbound only) |
| **Route Tables** | Routing rules for subnets |
| **Security Groups** | Stateful firewall at instance level (allow rules only) |
| **NACLs** | Stateless firewall at subnet level (allow + deny rules) |

### Public vs Private Subnet
- **Public**: has route to Internet Gateway (web servers, bastion hosts)
- **Private**: no route to Internet Gateway (databases, app servers)
- NAT Gateway in public subnet lets private instances access internet

### Security Groups vs NACLs

| Aspect | Security Group | NACL |
|--------|---------------|------|
| **Level** | Instance | Subnet |
| **Type** | Stateful | Stateless |
| **Rules** | Allow only | Allow + Deny |
| **Evaluation** | All rules | In numeric order |
| **Default** | Deny all inbound, Allow all outbound | Allow all |

## Amazon Route 53

AWS managed DNS service. Registers domains and routes traffic.

### Routing Policies
| Policy | Description |
|--------|-------------|
| **Simple** | One record, one endpoint |
| **Weighted** | Distributes traffic by weight (e.g., 70/30) |
| **Latency** | Routes to Region with lowest latency |
| **Failover** | Primary/Secondary with health checks |
| **Geolocation** | Routes by user location |
| **Geoproximity** | Routes by proximity (with bias) |
| **Multi-value** | Multiple endpoints with health check |

## Amazon CloudFront

AWS CDN with 400+ Edge Locations. Delivers content with low latency globally.

- Caches static (S3) and dynamic (ALB, EC2) content
- Automatic HTTPS with ACM
- Lambda@Edge for edge logic
- AWS Shield Standard included (free DDoS protection)
- Origin Access Control (OAC) for private S3

## Hybrid Connectivity

| Service | Description | Latency |
|---------|-------------|---------|
| **Site-to-Site VPN** | Encrypted connection over internet | Variable |
| **AWS Direct Connect** | Dedicated private connection (fiber) | Consistent, low |
| **Transit Gateway** | Central hub to connect VPCs and on-prem networks | Low |
| **VPC Peering** | Private connection between 2 VPCs | Low |
| **PrivateLink** | Private access to AWS services without internet | Low |

## Common Mistakes

- Confusing Security Groups (stateful, instance-level) with NACLs (stateless, subnet-level)
- Thinking NAT Gateway allows inbound traffic — it is outbound only
- Confusing VPN (over internet) with Direct Connect (dedicated)
- Forgetting CloudFront uses Edge Locations, not AZs
`,

  quiz: [
    {
      question: 'Which VPC component allows private subnets to access the internet for updates?',
      options: ['Internet Gateway', 'NAT Gateway', 'VPC Peering', 'Transit Gateway'],
      correct: 1,
      explanation: 'NAT Gateway allows outbound traffic from private subnets to the internet (e.g., OS updates), but does NOT allow inbound traffic.',
      reference: 'Internet Gateway = public subnet. NAT Gateway = outbound for private subnets.'
    },
    {
      question: 'What is the difference between Security Groups and NACLs?',
      options: ['Security Groups are stateless, NACLs are stateful', 'Security Groups operate at instance level, NACLs at subnet level', 'Both support Deny rules', 'No difference'],
      correct: 1,
      explanation: 'Security Groups are stateful and operate at instance level (allow only). NACLs are stateless and operate at subnet level (allow + deny).',
      reference: 'Stateful = automatic return traffic. Stateless = needs explicit return rule.'
    },
    {
      question: 'Which AWS service provides a dedicated private connection between on-prem datacenter and AWS?',
      options: ['Site-to-Site VPN', 'AWS Direct Connect', 'VPC Peering', 'Internet Gateway'],
      correct: 1,
      explanation: 'AWS Direct Connect provides a dedicated private network connection (fiber) between your datacenter and AWS. Consistent and lower latency than VPN.',
      reference: 'VPN = over internet (quick setup). Direct Connect = dedicated (weeks to install).'
    },
    {
      question: 'Which Route 53 routing policy sends traffic to the Region with lowest latency?',
      options: ['Simple', 'Weighted', 'Latency-based', 'Geolocation'],
      correct: 2,
      explanation: 'Latency-based routing sends users to the AWS Region offering the lowest network latency, regardless of geographic location.',
      reference: 'Geolocation = by country/continent. Latency = by actual latency measurement.'
    },
    {
      question: 'What is VPC Peering?',
      options: ['VPC connection to internet', 'Private connection between two VPCs', 'Edge content caching', 'Load balancing'],
      correct: 1,
      explanation: 'VPC Peering allows private network connection between two VPCs (same account, different accounts, or different Regions). Traffic does not traverse the internet.',
      reference: 'VPC Peering is 1-to-1. For connecting many VPCs, use Transit Gateway.'
    },
    {
      question: 'Which service provides free automatic DDoS protection?',
      options: ['AWS WAF', 'AWS Shield Standard', 'Amazon GuardDuty', 'AWS Firewall Manager'],
      correct: 1,
      explanation: 'AWS Shield Standard is free and automatic for all AWS customers. Protects against L3/L4 DDoS attacks on CloudFront, Route 53, and ELB.',
      reference: 'Shield Standard = free. Shield Advanced = paid ($3000/month), with support and cost protection.'
    },
    {
      question: 'Which AWS service creates managed REST/HTTP APIs?',
      options: ['Amazon CloudFront', 'AWS API Gateway', 'Amazon Route 53', 'Elastic Load Balancer'],
      correct: 1,
      explanation: 'API Gateway is a managed service for creating, publishing, and managing APIs. Integrates with Lambda for serverless APIs, EC2, and AWS services.',
      reference: 'API Gateway + Lambda = serverless API (very common CLF-C02 pattern).'
    },
    {
      question: 'Which component connects multiple VPCs and on-prem networks as a central hub?',
      options: ['VPC Peering', 'Internet Gateway', 'Transit Gateway', 'NAT Gateway'],
      correct: 2,
      explanation: 'Transit Gateway acts as a central hub to connect multiple VPCs, VPNs, and Direct Connect connections. Simplifies complex network topologies.',
      reference: 'VPC Peering = 1:1. Transit Gateway = hub-and-spoke (1:N).'
    }
  ],

  flashcards: [
    { front: 'What are the main VPC components?', back: 'Subnets (public/private), Internet Gateway (internet access), NAT Gateway (outbound for private subnets), Route Tables (routes), Security Groups (instance-level firewall), NACLs (subnet-level firewall).' },
    { front: 'What is the difference between Security Groups and NACLs?', back: 'Security Groups: stateful, instance-level, allow-only. NACLs: stateless, subnet-level, allow+deny, evaluated in numeric order. SGs are primary firewall, NACLs are additional layer.' },
    { front: 'What is the difference between VPN and Direct Connect?', back: 'VPN: encrypted over internet, quick setup, lower cost, variable latency. Direct Connect: dedicated fiber, weeks to install, higher cost, consistent low latency.' },
    { front: 'What are the Route 53 routing policies?', back: 'Simple (1 endpoint), Weighted (by weight), Latency (lowest latency), Failover (primary/secondary), Geolocation (by country), Geoproximity (proximity + bias), Multi-value (multiple + health check).' },
    { front: 'What is Amazon CloudFront?', back: 'CDN with 400+ Edge Locations. Caches static/dynamic content. Automatic HTTPS with ACM. Shield Standard included. Lambda@Edge for edge logic. Origins: S3, ALB, EC2.' },
    { front: 'What is AWS Transit Gateway?', back: 'Central hub connecting multiple VPCs, VPNs, and Direct Connect in hub-and-spoke topology. Simplifies complex networks. Replaces VPC Peering mesh when you have many VPCs.' },
    { front: 'What is AWS PrivateLink?', back: 'Allows accessing AWS services or third-party services privately (no internet, no NAT, no VPN). Uses ENIs (Elastic Network Interfaces) within your VPC.' },
    { front: 'What is API Gateway?', back: 'Managed service for creating REST, HTTP, and WebSocket APIs. Integrates with Lambda (serverless), EC2, AWS services. Supports throttling, caching, authentication, canary deployments.' }
  ],

  lab: {
    scenario: 'Understand AWS networking components and how to protect and connect resources.',
    objective: 'Design a VPC with public and private subnets and understand traffic flow.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Basic VPC Architecture',
        instruction: 'Design a VPC with: 2 public subnets (web servers), 2 private subnets (databases), Internet Gateway, NAT Gateway, and ALB.',
        hints: ['Public subnets in 2 AZs for HA', 'NAT Gateway in public subnet for private outbound access'],
        solution: '```\nVPC: 10.0.0.0/16\n\nPublic Subnet AZ-a: 10.0.1.0/24 -> Internet Gateway\nPublic Subnet AZ-b: 10.0.2.0/24 -> Internet Gateway\nPrivate Subnet AZ-a: 10.0.3.0/24 -> NAT Gateway\nPrivate Subnet AZ-b: 10.0.4.0/24 -> NAT Gateway\n\nALB (public) -> EC2 in public subnets\nRDS Multi-AZ -> private subnets\nNAT Gateway -> public subnet (enables outbound)\n```',
        verify: '```bash\n# Verification:\n# [x] VPC with /16 CIDR\n# [x] 2 public subnets in different AZs\n# [x] 2 private subnets in different AZs\n# [x] Internet Gateway for public subnets\n# [x] NAT Gateway for private subnets\n# [x] ALB distributing traffic\n```'
      },
      {
        title: 'Configure Security Groups',
        instruction: 'Create Security Groups for: (1) ALB (port 80/443 from any IP), (2) EC2 web (port 80 only from ALB SG), (3) RDS (port 3306 only from EC2 SG).',
        hints: ['Security Groups can reference other Security Groups', 'Use SG-ID as source instead of IP range'],
        solution: '```\nSG-ALB:\n  Inbound: 80 (0.0.0.0/0), 443 (0.0.0.0/0)\n  Outbound: All traffic\n\nSG-EC2:\n  Inbound: 80 (SG-ALB)   <- references ALB SG\n  Outbound: All traffic\n\nSG-RDS:\n  Inbound: 3306 (SG-EC2) <- references EC2 SG\n  Outbound: All traffic\n```',
        verify: '```bash\n# Verification:\n# ALB accepts traffic from internet (80/443)\n# EC2 accepts traffic ONLY from ALB\n# RDS accepts traffic ONLY from EC2\n# Trust chain: Internet -> ALB -> EC2 -> RDS\n```'
      },
      {
        title: 'Choose Connectivity',
        instruction: 'For each scenario, select the solution: (1) Connect office to AWS quickly, (2) Connect datacenter with consistent latency, (3) Connect 20 VPCs to each other.',
        hints: ['Quick = VPN', 'Consistent latency = Direct Connect', 'Many VPCs = Transit Gateway'],
        solution: '```\n1. Quick office -> Site-to-Site VPN\n   - Configure in hours, over internet\n\n2. Low-latency datacenter -> Direct Connect\n   - Dedicated connection, weeks to install\n\n3. 20 VPCs -> Transit Gateway\n   - Central hub, avoids VPC Peering mesh\n   - VPC Peering would be 190 connections (n*(n-1)/2)\n```',
        verify: '```bash\n# Decision rule:\n# Quick + internet OK -> VPN\n# Dedicated + consistent -> Direct Connect\n# Many VPCs -> Transit Gateway\n# 2 VPCs -> VPC Peering\n# Private AWS service access -> PrivateLink\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Security Groups vs NACLs',
      difficulty: 'easy',
      symptom: 'Candidate confuses Security Groups with NACLs and does not know which to use.',
      diagnosis: '```\nSecurity Groups (SG):\n  - Instance firewall\n  - Stateful (automatic reply)\n  - Allow rules only (no deny)\n  - All rules evaluated\n  - Default: deny all in, allow all out\n\nNACLs:\n  - Subnet firewall\n  - Stateless (needs return rule)\n  - Allow + Deny rules\n  - Evaluated in numeric order\n  - Default: allow all\n```',
      solution: 'In practice, use Security Groups as primary firewall (easier, stateful). NACLs as additional defense layer. On the exam, pay attention to stateful vs stateless and allow-only vs allow+deny.'
    },
    {
      title: 'Latency Routing vs Geolocation',
      difficulty: 'medium',
      symptom: 'Candidate confuses Latency-based routing with Geolocation routing in Route 53.',
      diagnosis: '```\nLatency-based:\n  - Routes to Region with LOWEST MEASURED LATENCY\n  - Based on actual network measurements\n  - A user in Brazil might go to us-east-1 if latency is lower\n  - Use for: best performance\n\nGeolocation:\n  - Routes by USER LOCATION (country/continent)\n  - Does not measure latency, uses IP geolocation\n  - A user in Brazil ALWAYS goes to sa-east-1\n  - Use for: compliance, content localization\n\nGeoproximity:\n  - Combines location with adjustable bias\n  - Use for: controlling geographic traffic distribution\n```',
      solution: 'Latency = best performance (measured). Geolocation = by country/region (forced). If the question mentions "compliance" or "localized content," it is Geolocation. If it mentions "lowest latency" or "best performance," it is Latency-based.'
    }
  ]
};
