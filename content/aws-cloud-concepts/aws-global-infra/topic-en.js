window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-cloud-concepts/aws-global-infra'] = {
  theory: `# AWS Global Infrastructure

## Exam Relevance
> Understanding AWS global infrastructure is essential for the CLF-C02 exam. Questions about Regions, AZs, Edge Locations, and how to choose a Region are frequent.

## Regions

A **Region** is an isolated geographic area containing multiple Availability Zones. AWS has 30+ Regions globally.

### Criteria for Choosing a Region

| Criterion | Description |
|-----------|-------------|
| **Compliance** | Must data stay in a specific country? (e.g., GDPR, HIPAA) |
| **Latency** | Proximity to end users |
| **Available services** | Not all services are available in every Region |
| **Pricing** | Prices vary between Regions (e.g., Sao Paulo vs Virginia) |

## Availability Zones (AZs)

Each Region has a **minimum of 3 AZs** (typically 3-6). Each AZ is one or more discrete data centers with redundant power, networking, and connectivity.

### AZ Characteristics
- Physically separated within a Region (tens of km apart)
- Connected to each other with high-speed, low-latency networking
- Failure in one AZ does NOT affect others
- You choose which AZ to deploy resources to (e.g., EC2, RDS)

### Multi-AZ for High Availability
\`\`\`
Region: us-east-1 (N. Virginia)
  |-- AZ: us-east-1a  ->  EC2 + RDS Primary
  |-- AZ: us-east-1b  ->  EC2 + RDS Standby
  +-- AZ: us-east-1c  ->  EC2 (Auto Scaling)

ELB distributes traffic across AZs automatically
\`\`\`

## Edge Locations

**Edge Locations** are points of presence (PoPs) used by **Amazon CloudFront** (CDN) and other services to deliver content with low latency.

- 400+ Edge Locations globally
- Far more numerous than Regions
- Used by: CloudFront, Route 53, AWS WAF, AWS Shield

### Difference: Region vs Edge Location

| Aspect | Region | Edge Location |
|--------|--------|---------------|
| **Count** | 30+ | 400+ |
| **Services** | All AWS services | CDN, DNS, Security |
| **Use** | Compute, storage, databases | Caching, content distribution |
| **Control** | You choose the Region | AWS manages automatically |

## Other Components

### Local Zones
- Extension of a Region, closer to users
- For workloads requiring ultra-low latency (< 10ms)
- Example: Los Angeles, Boston, Houston

### Wavelength Zones
- AWS infrastructure within 5G telecom networks
- For mobile applications with minimal latency
- Partnership with carriers (Verizon, Vodafone)

### AWS Outposts
- AWS racks installed in YOUR data center
- Same APIs and tools as AWS cloud
- For workloads that must remain on-premises
- Hybrid cloud model

### AWS Ground Station
- Satellite control and data processing
- Pay-per-use for satellite communication

## Amazon CloudFront (CDN)

CloudFront is the AWS CDN that distributes content globally using Edge Locations:

- Caches static and dynamic content
- Integrates with S3, EC2, ALB, Lambda@Edge
- Built-in DDoS protection (free AWS Shield Standard)
- Automatic HTTPS/TLS with ACM

## Common Mistakes

- Confusing AZ with Region — a Region contains multiple AZs
- Thinking Edge Location = AZ — Edge is for CDN/DNS, AZ is for compute
- Forgetting that not all services are available in all Regions
- Confusing Local Zones with Edge Locations — Local Zones run compute, Edge Locations do caching
`,

  quiz: [
    {
      question: 'What is the minimum number of Availability Zones in an AWS Region?',
      options: ['1', '2', '3', '4'],
      correct: 2,
      explanation: 'Each AWS Region has a minimum of 3 Availability Zones, providing high availability and resilience.',
      reference: 'Source: AWS Global Infrastructure page'
    },
    {
      question: 'Which AWS service uses Edge Locations to deliver content with low latency?',
      options: ['Amazon EC2', 'Amazon RDS', 'Amazon CloudFront', 'Amazon EBS'],
      correct: 2,
      explanation: 'CloudFront is the AWS CDN that uses 400+ Edge Locations to cache and distribute content globally.',
      reference: 'Route 53 (DNS) also uses Edge Locations.'
    },
    {
      question: 'Which criterion is NOT relevant when choosing an AWS Region?',
      options: ['Compliance with local regulations', 'Number of Edge Locations in the Region', 'Latency to end users', 'Availability of specific services'],
      correct: 1,
      explanation: 'Edge Locations are global and independent of Regions. The correct criteria are: compliance, latency, available services, and pricing.',
      reference: 'The 4 criteria: Compliance, Latency, Services, Pricing.'
    },
    {
      question: 'What is an Availability Zone?',
      options: ['An entire geographic region', 'One or more data centers with redundant infrastructure', 'A caching point for CDN', 'An AWS billing zone'],
      correct: 1,
      explanation: 'An AZ is one or more discrete data centers with redundant power, networking, and connectivity within a Region.',
      reference: 'AZs are physically separated by tens of km within the same Region.'
    },
    {
      question: 'Which service allows running AWS infrastructure in your own data center?',
      options: ['AWS Local Zones', 'AWS Wavelength', 'AWS Outposts', 'AWS Ground Station'],
      correct: 2,
      explanation: 'AWS Outposts installs AWS racks in your data center, using the same APIs and tools as the public cloud. It is the AWS hybrid cloud model.',
      reference: 'Outposts = AWS hardware on-premises. Local Zones = Region extension.'
    },
    {
      question: 'Approximately how many Edge Locations does AWS have?',
      options: ['30+', '100+', '200+', '400+'],
      correct: 3,
      explanation: 'AWS has 400+ Edge Locations globally, far more than the 30+ Regions, as they are used for CDN and DNS which need massive presence.',
      reference: 'Edge Locations > Local Zones > Regions in quantity.'
    },
    {
      question: 'AWS Wavelength Zones are designed for which use case?',
      options: ['Data backup', 'Ultra-low latency applications on 5G networks', 'Object storage', 'DNS management'],
      correct: 1,
      explanation: 'Wavelength Zones place AWS infrastructure within 5G telecom networks, ideal for mobile applications requiring minimal latency.',
      reference: 'Partnerships with Verizon, Vodafone, KDDI, SK Telecom.'
    },
    {
      question: 'What is the primary reason for deploying resources across multiple AZs?',
      options: ['Reduce costs', 'Increase high availability', 'Improve security', 'Simplify management'],
      correct: 1,
      explanation: 'Multi-AZ deployment ensures that if one AZ fails, the application continues running in the other AZ(s). This is the foundation of high availability on AWS.',
      reference: 'RDS Multi-AZ, ALB cross-AZ, ASG multi-AZ are common patterns.'
    }
  ],

  flashcards: [
    { front: 'What are the 4 criteria for choosing an AWS Region?', back: '1. Compliance (legal/regulatory requirements). 2. Latency (proximity to users). 3. Available services (not all are in every Region). 4. Pricing (varies between Regions).' },
    { front: 'What is the difference between Region, AZ, and Edge Location?', back: 'Region = geographic area (30+). AZ = data center(s) within a Region (3-6 per Region). Edge Location = CDN/DNS cache point (400+, far more than Regions).' },
    { front: 'What is AWS Outposts?', back: 'AWS hardware racks installed in your own data center. Allows using AWS APIs and services on-premises. It is the AWS managed hybrid cloud model.' },
    { front: 'What are Local Zones?', back: 'Extensions of a Region closer to end users. For workloads requiring ultra-low latency (< 10ms). Example: Los Angeles, Boston.' },
    { front: 'What is Amazon CloudFront?', back: 'AWS CDN (Content Delivery Network). Uses 400+ Edge Locations to cache and deliver content with low latency. Integrates with S3, ALB, Lambda@Edge. Shield Standard included.' },
    { front: 'How many AZs does a Region have at minimum?', back: 'Minimum 3 AZs. Typically 3-6. Each AZ is physically separated (tens of km) but connected with high-speed, low-latency networking.' },
    { front: 'What are Wavelength Zones?', back: 'AWS infrastructure within 5G telecom networks (Verizon, Vodafone). For mobile applications with ultra-low latency. Deploy compute at the edge of the carrier network.' },
    { front: 'Why deploy across multiple AZs?', back: 'High availability. If one AZ fails, the application continues in others. Common patterns: RDS Multi-AZ, ALB cross-AZ, ASG distributed across AZs.' }
  ],

  lab: {
    scenario: 'Explore the AWS global infrastructure and understand how to choose Regions and AZs.',
    objective: 'Map Regions, AZs, and Edge Locations and make architectural decisions based on selection criteria.',
    duration: '10-15 minutes',
    steps: [
      {
        title: 'Explore Available Regions and AZs',
        instruction: 'In the AWS console, click the Region selector (top right corner). List all South America Regions. Then, using EC2, identify the available AZs in Region us-east-1.',
        hints: ['The Region selector is in the console header', 'In EC2 > Subnets you can see the AZs'],
        solution: '```\nSouth America:\n- sa-east-1 (Sao Paulo)\n\nAZs in us-east-1:\n- us-east-1a through us-east-1f (6 AZs)\n\nCheck in: EC2 > Subnets > Availability Zone column\n```',
        verify: '```bash\n# Via CLI:\naws ec2 describe-availability-zones --region us-east-1 --query "AvailabilityZones[].ZoneName" --output text\n# Expected output: us-east-1a us-east-1b us-east-1c us-east-1d us-east-1e us-east-1f\n```'
      },
      {
        title: 'Check Services by Region',
        instruction: 'Visit https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/ and compare services available in us-east-1 (Virginia) vs sa-east-1 (Sao Paulo).',
        hints: ['us-east-1 always has ALL services', 'Newer Regions have fewer services'],
        solution: '```\nServices typically NOT available in sa-east-1:\n- Some ML/AI services (SageMaker may have limitations)\n- Very new services (launch first in us-east-1)\n- Some IoT services\n\nus-east-1 has 200+ services, sa-east-1 has ~150+\n```',
        verify: '```bash\n# Check on the AWS Global Infrastructure website\n# Expected result: us-east-1 has more services than sa-east-1\n# This demonstrates the "service availability" criterion\n```'
      },
      {
        title: 'Architectural Decision Scenario',
        instruction: 'Your company needs to host a web application for customers in Europe, with data that must remain in the EU (GDPR). Which Region do you choose and why?',
        hints: ['GDPR requires data residency in the EU', 'Consider latency for European users'],
        solution: '```\nRegion: eu-west-1 (Ireland) or eu-central-1 (Frankfurt)\n\nJustifications:\n1. Compliance: GDPR requires data in EU -> eu-west-1 or eu-central-1\n2. Latency: low latency for European users\n3. Services: both have most services available\n4. Price: eu-west-1 is slightly cheaper than eu-central-1\n\nMulti-AZ Architecture:\n- eu-west-1a: EC2 + RDS Primary\n- eu-west-1b: EC2 + RDS Standby\n- eu-west-1c: EC2 (burst capacity)\n- ALB distributing traffic across AZs\n```',
        verify: '```bash\n# Criteria met:\n# [x] Compliance (GDPR) -> EU Region\n# [x] Latency -> Region closest to European users\n# [x] Multi-AZ -> high availability\n# Expected result: justified choice based on compliance and latency\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'AZ vs Edge Location Confusion',
      difficulty: 'easy',
      symptom: 'Candidate thinks Edge Locations are a type of AZ or that you can run EC2 in Edge Locations.',
      diagnosis: '```\nAZ (Availability Zone):\n- Complete data center(s)\n- Runs ANY AWS service (EC2, RDS, etc)\n- You CHOOSE which AZ to deploy to\n- 3-6 per Region\n\nEdge Location:\n- Cache/presence point\n- Only CDN (CloudFront), DNS (Route 53), WAF, Shield\n- AWS manages automatically\n- 400+ globally\n```',
      solution: 'AZs are for compute and storage. Edge Locations are for caching and content distribution. You CANNOT run EC2 in Edge Locations. Use Lambda@Edge if you need compute at the edge.'
    },
    {
      title: 'When to Use Outposts vs Local Zones',
      difficulty: 'medium',
      symptom: 'Candidate confuses Outposts with Local Zones — both seem like "AWS closer to you."',
      diagnosis: '```\nAWS Outposts:\n- AWS hardware in YOUR data center\n- You manage the physical space\n- For: compliance, data residency, low-latency on-prem\n- Model: hybrid cloud\n\nLocal Zones:\n- AWS infrastructure in additional cities\n- AWS manages everything\n- For: latency < 10ms for end users\n- Model: extension of public cloud\n\nWavelength:\n- AWS inside carrier 5G network\n- For: ultra-low-latency mobile apps\n```',
      solution: 'Outposts = YOUR data center with AWS hardware. Local Zones = AWS data center in more cities. The key difference is WHO manages the physical space and WHERE the hardware is located.'
    }
  ]
};
