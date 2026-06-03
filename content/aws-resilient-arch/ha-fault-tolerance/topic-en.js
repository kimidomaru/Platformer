window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-resilient-arch/ha-fault-tolerance'] = {
  theory: `# High Availability & Fault Tolerance

## Exam Relevance
> **Design Resilient Architectures** is worth **26%** of SAA-C03. Multi-AZ, load balancing, Auto Scaling, and database HA are core topics.

## Elastic Load Balancing (ELB)

| Type | Layer | Protocol | Key Feature |
|------|-------|----------|-------------|
| **ALB** | L7 | HTTP/HTTPS | Path/host-based routing, sticky sessions, gRPC |
| **NLB** | L4 | TCP/UDP/TLS | Ultra-low latency, static IP per AZ, preserves source IP |
| **GLB** | L3 | GENEVE | Third-party virtual appliances (firewalls, IDS) |

### ALB vs NLB Decision
- **ALB**: web apps, microservices, path routing (/api, /web), WebSocket, Lambda targets
- **NLB**: extreme performance (<100ms latency), static IPs, non-HTTP protocols, PrivateLink
- **GLB**: inline network appliances (transparent inspection)

### Cross-Zone Load Balancing
- ALB: always enabled (free)
- NLB: disabled by default (charges apply if enabled)

## Auto Scaling

### Scaling Policies
- **Target Tracking**: maintain metric at target (e.g., CPU at 50%) — recommended
- **Step Scaling**: scale based on alarm thresholds (e.g., +2 if CPU>70%, +4 if CPU>90%)
- **Scheduled**: scale at specific times (e.g., increase capacity weekdays 9am)
- **Predictive**: ML-based forecast, pre-provisions capacity before demand spike

### Key Concepts
- **Launch Template**: defines instance config (AMI, type, SG, user data) — replaces launch configs
- **Cooldown**: wait period after scaling (default 300s) to avoid rapid scale in/out
- **Health Checks**: EC2 (instance status) or ELB (HTTP health check) — ELB recommended
- **Warm Pools**: pre-initialized instances for faster scale-out

## RDS High Availability

### Multi-AZ vs Read Replicas

| Feature | Multi-AZ | Read Replicas |
|---------|----------|---------------|
| **Purpose** | High availability (failover) | Performance (read scaling) |
| **Replication** | Synchronous | Asynchronous |
| **Failover** | Automatic (~60s DNS) | Manual promotion |
| **Read traffic** | Standby NOT readable | Readable endpoints |
| **Cross-Region** | No (same Region only) | Yes |
| **Engine** | All RDS engines | All except Oracle (varies) |

## Amazon Aurora

- **6 copies** of data across **3 AZs** (auto-healing, no data loss on 2 AZ failure)
- Up to **15 Aurora Replicas** with millisecond failover (vs 5 for RDS)
- **Aurora Serverless v2**: scales 0.5-128 ACU, ideal for variable workloads
- **Aurora Global Database**: cross-Region, <1 second replication, promotes secondary in <1 min
- **Backtrack**: rewind database to any point within 72 hours (no restore needed)
- **Cloning**: fast copy-on-write (dev/test from production)

## Route 53 for HA

### Routing Policies for HA
- **Failover**: active-passive, health check determines primary/secondary
- **Weighted**: distribute traffic by weight (blue/green, A/B testing)
- **Multivalue Answer**: return multiple healthy IPs (client-side load balancing)
- **Latency**: route to lowest latency Region

### Health Checks
- Endpoint (HTTP/HTTPS/TCP), Calculated (combine multiple), CloudWatch alarm-based
- Failover triggers when health check fails (configurable threshold)

## Common Exam Mistakes

- Confusing Multi-AZ (HA, sync, standby NOT readable) with Read Replicas (performance, async, readable)
- Forgetting NLB provides static IP per AZ (ALB does not)
- Not knowing Aurora can have 15 replicas (RDS only 5)
- Confusing scaling policies: target tracking is simplest and recommended
`,

  quiz: [
    {
      question: 'What is the key difference between RDS Multi-AZ and Read Replicas?',
      options: ['Multi-AZ is for performance, Read Replicas for HA', 'Multi-AZ is synchronous standby for HA, Read Replicas are async for read scaling', 'Read Replicas provide automatic failover', 'Multi-AZ supports cross-Region'],
      correct: 1,
      explanation: 'Multi-AZ: synchronous standby in another AZ for HA with automatic failover (~60s). Read Replicas: asynchronous copies for read performance, manual promotion, can be cross-Region.',
      reference: 'Multi-AZ = HA (sync, auto-failover). Read Replica = performance (async, manual promotion).'
    },
    {
      question: 'Which load balancer provides a static IP per AZ?',
      options: ['ALB', 'NLB', 'GLB', 'Classic LB'],
      correct: 1,
      explanation: 'NLB provides one static IP per AZ (or Elastic IP). ALB has dynamic IPs. This is important for allowlisting by IP, DNS, or PrivateLink.',
      reference: 'NLB = static IP, L4, ultra-low latency. ALB = dynamic IP, L7, path routing.'
    },
    {
      question: 'How many copies of data does Aurora maintain?',
      options: ['2 copies across 2 AZs', '4 copies across 2 AZs', '6 copies across 3 AZs', '3 copies across 3 AZs'],
      correct: 2,
      explanation: 'Aurora stores 6 copies of data across 3 AZs. It can tolerate loss of 2 copies for writes and 3 copies for reads without data loss.',
      reference: 'Aurora: 6 copies, 3 AZs, self-healing, 15 replicas, ms failover.'
    },
    {
      question: 'Which Auto Scaling policy is the simplest and most recommended?',
      options: ['Step Scaling', 'Scheduled Scaling', 'Target Tracking', 'Predictive Scaling'],
      correct: 2,
      explanation: 'Target Tracking is the simplest: set a target metric value (e.g., CPU at 50%) and ASG automatically adjusts capacity. No alarm configuration needed.',
      reference: 'Target Tracking = simplest. Step = more control. Scheduled = time-based. Predictive = ML.'
    },
    {
      question: 'What does Aurora Global Database provide?',
      options: ['Multi-AZ within same Region', 'Cross-Region replication with less than 1 second lag', 'Serverless auto-scaling', 'Automatic schema migration'],
      correct: 1,
      explanation: 'Aurora Global Database replicates across Regions with typically <1 second lag. Secondary Region can be promoted to primary in <1 minute for disaster recovery.',
      reference: 'Global Database: cross-Region <1s lag, promote secondary <1 min for DR.'
    },
    {
      question: 'In Route 53, which routing policy provides active-passive failover?',
      options: ['Weighted', 'Latency', 'Failover', 'Multivalue'],
      correct: 2,
      explanation: 'Failover routing: primary record serves traffic when healthy, secondary takes over when primary health check fails. Active-passive pattern for disaster recovery.',
      reference: 'Failover = active-passive. Weighted = traffic distribution. Latency = closest Region.'
    },
    {
      question: 'What is the purpose of Auto Scaling cooldown?',
      options: ['Cool down the CPU', 'Wait period after scaling to avoid rapid scale in/out', 'Time to warm up instances', 'Delay before health check'],
      correct: 1,
      explanation: 'Cooldown (default 300s) prevents rapid successive scaling actions. After a scaling event, ASG waits before responding to new alarms to let metrics stabilize.',
      reference: 'Default cooldown: 300s. Prevents flapping. Can customize per scaling policy.'
    },
    {
      question: 'What is the advantage of NLB over ALB for PrivateLink?',
      options: ['NLB is cheaper', 'NLB is required for PrivateLink endpoint services (ALB cannot be used)', 'NLB has better routing', 'NLB supports WebSocket'],
      correct: 1,
      explanation: 'PrivateLink endpoint services require an NLB as the backend. ALB cannot be used directly as a PrivateLink service provider. NLB static IPs also simplify firewall rules.',
      reference: 'PrivateLink = NLB required. ALB can be behind NLB if needed.'
    }
  ],

  flashcards: [
    { front: 'ALB vs NLB vs GLB?', back: 'ALB: L7, HTTP/HTTPS, path/host routing, WebSocket, Lambda targets. NLB: L4, TCP/UDP, static IP, ultra-low latency, PrivateLink. GLB: L3, GENEVE, inline security appliances.' },
    { front: 'RDS Multi-AZ vs Read Replicas?', back: 'Multi-AZ: HA, sync standby, auto-failover ~60s, NOT readable, same Region. Read Replicas: performance, async, readable, manual promotion, cross-Region possible.' },
    { front: 'Aurora HA features?', back: '6 copies across 3 AZs, self-healing storage, up to 15 Aurora Replicas (ms failover), Global Database (<1s cross-Region), Serverless v2 (0.5-128 ACU), Backtrack (72h rewind), Cloning.' },
    { front: 'Auto Scaling policy types?', back: 'Target Tracking: maintain metric at target (simplest). Step: alarm-based thresholds. Scheduled: time-based. Predictive: ML forecast. Cooldown: 300s default wait between actions.' },
    { front: 'Route 53 routing for HA?', back: 'Failover: active-passive with health checks. Weighted: traffic distribution (blue/green). Multivalue: multiple healthy IPs. Latency: lowest latency Region. All use health checks.' },
    { front: 'What are Aurora Global Databases?', back: 'Cross-Region replication with <1s lag. Secondary can be promoted in <1 min. Up to 5 secondary Regions. Use for DR and low-latency global reads.' },
    { front: 'What is NLB cross-zone load balancing?', back: 'Distributes traffic evenly across all registered targets in all AZs. Disabled by default on NLB (charges apply). Always enabled on ALB (free). Enable for even distribution.' },
    { front: 'What are ASG Warm Pools?', back: 'Pre-initialized stopped instances ready for fast scale-out. Instances go through lifecycle hooks and are stopped. On scale-out, start from pool instead of launching new (much faster).' }
  ],

  lab: {
    scenario: 'Design a highly available web application architecture.',
    objective: 'Configure ALB with Auto Scaling, RDS Multi-AZ, and Route 53 health checks.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create ALB with Target Group',
        instruction: 'Create an Application Load Balancer with a target group for HTTP health checks and register EC2 instances.',
        hints: ['ALB requires at least 2 AZs', 'Health check path should be a lightweight endpoint'],
        solution: '```bash\n# Create target group\naws elbv2 create-target-group --name web-tg \\\n  --protocol HTTP --port 80 --vpc-id vpc-xxx \\\n  --health-check-path /health --health-check-interval-seconds 30\n\n# Create ALB\naws elbv2 create-load-balancer --name web-alb \\\n  --subnets subnet-az1 subnet-az2 \\\n  --security-groups sg-alb\n\n# Create listener\naws elbv2 create-listener --load-balancer-arn ALB_ARN \\\n  --protocol HTTP --port 80 \\\n  --default-actions Type=forward,TargetGroupArn=TG_ARN\n```',
        verify: '```bash\naws elbv2 describe-target-health --target-group-arn TG_ARN\n# Expected: targets with HealthState = healthy\n\naws elbv2 describe-load-balancers --names web-alb\n# Expected: State.Code = active, 2+ AZs\n```'
      },
      {
        title: 'Configure Auto Scaling Group',
        instruction: 'Create an ASG with target tracking policy to maintain CPU at 50%, min 2, max 6 instances.',
        hints: ['Use launch template, not launch config', 'Target tracking is the simplest policy'],
        solution: '```bash\n# Create ASG\naws autoscaling create-auto-scaling-group --auto-scaling-group-name web-asg \\\n  --launch-template LaunchTemplateId=lt-xxx,Version=\\$Latest \\\n  --min-size 2 --max-size 6 --desired-capacity 2 \\\n  --target-group-arns TG_ARN \\\n  --vpc-zone-identifier "subnet-az1,subnet-az2"\n\n# Add target tracking policy\naws autoscaling put-scaling-policy --auto-scaling-group-name web-asg \\\n  --policy-name cpu-target-50 --policy-type TargetTrackingScaling \\\n  --target-tracking-configuration \'{"PredefinedMetricSpecification":{"PredefinedMetricType":"ASGAverageCPUUtilization"},"TargetValue":50.0}\'\n```',
        verify: '```bash\naws autoscaling describe-auto-scaling-groups --auto-scaling-group-names web-asg\n# Expected: MinSize=2, MaxSize=6, DesiredCapacity=2\n# TargetGroupARNs includes TG_ARN\n\naws autoscaling describe-policies --auto-scaling-group-name web-asg\n# Expected: TargetTrackingScaling policy, target=50\n```'
      },
      {
        title: 'Enable RDS Multi-AZ',
        instruction: 'Create an RDS instance with Multi-AZ enabled for automatic failover, or modify an existing one.',
        hints: ['Multi-AZ doubles the cost', 'Failover is automatic on AZ failure, instance failure, or maintenance'],
        solution: '```bash\n# Create Multi-AZ RDS\naws rds create-db-instance --db-instance-identifier prod-db \\\n  --db-instance-class db.r6g.large --engine postgres \\\n  --master-username admin --master-user-password MyP@ss123 \\\n  --allocated-storage 100 --multi-az\n\n# Or modify existing to enable Multi-AZ\naws rds modify-db-instance --db-instance-identifier prod-db \\\n  --multi-az --apply-immediately\n```',
        verify: '```bash\naws rds describe-db-instances --db-instance-identifier prod-db \\\n  --query "DBInstances[0].{MultiAZ:MultiAZ,AZ:AvailabilityZone,SecondaryAZ:SecondaryAvailabilityZone}"\n# Expected: MultiAZ = true, SecondaryAZ present\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'ALB Health Checks Failing Despite Application Working',
      difficulty: 'medium',
      symptom: 'ALB shows targets as unhealthy but the application responds correctly when accessed directly.',
      diagnosis: '```\nChecklist:\n1. Health check path correct? (e.g., /health vs /)\n2. Application returns 200 on health check path?\n3. Security Group on instance allows traffic from ALB SG?\n4. Health check port matches application port?\n5. Health check timeout < interval?\n\nCommon causes:\n  - App returns 301 redirect on / (health check expects 200)\n  - SG does not allow ALB SG inbound\n  - Health check path requires authentication\n\nVerify:\n  aws elbv2 describe-target-health --target-group-arn TG_ARN\n  Check: HealthCheckPort, Reason (Elb.InitialHealthChecking, Target.Timeout)\n```',
      solution: 'Set health check path to a lightweight endpoint that returns 200 without auth (e.g., /health). Ensure instance SG allows inbound from ALB SG on the health check port. Set success codes to include redirects if needed (e.g., 200-399).'
    },
    {
      title: 'Auto Scaling Flapping: Scale Out Then Immediately Scale In',
      difficulty: 'hard',
      symptom: 'ASG keeps adding instances then removing them in rapid succession. Instance count oscillates.',
      diagnosis: '```\nPossible causes:\n\n1. Cooldown too short:\n   Default 300s may not be enough for metrics to stabilize\n   New instances need time to warm up and serve traffic\n\n2. Health check too aggressive:\n   ELB health check fails during instance startup\n   ASG replaces "unhealthy" instance before its ready\n\n3. Target tracking target too low:\n   e.g., CPU target 30% causes constant adjustment\n\n4. No warm-up time configured:\n   New instance metrics included immediately (high CPU during startup)\n\nCheck:\n  aws autoscaling describe-scaling-activities \\\n    --auto-scaling-group-name web-asg\n  Look for rapid Launching/Terminating alternation\n```',
      solution: 'Increase cooldown period (e.g., 600s). Set estimated instance warm-up time in scaling policy. Use ELB health checks with adequate grace period (e.g., 300s). Set realistic target tracking value (50% CPU, not 30%). Consider Warm Pools for faster boot.'
    }
  ]
};
