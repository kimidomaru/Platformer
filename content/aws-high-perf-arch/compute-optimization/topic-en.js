window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-high-perf-arch/compute-optimization'] = {
  theory: `# Compute & Container Optimization

## Exam Relevance
> **Design High-Performing Architectures** is worth **24%** of SAA-C03. EC2 instance selection, placement groups, containers, Lambda performance, and Graviton are key topics.

## EC2 Instance Families

| Family | Type | Use Case |
|--------|------|----------|
| **M** (General) | Balanced CPU/memory | Web servers, app servers, small DBs |
| **T** (Burstable) | Baseline + burst CPU | Dev/test, micro-services, small workloads |
| **C** (Compute) | High CPU | Batch processing, ML inference, gaming, HPC |
| **R** (Memory) | High memory | In-memory DBs (Redis, SAP HANA), real-time analytics |
| **X** (Memory) | Very high memory | SAP HANA, large in-memory DBs |
| **I** (Storage) | High sequential I/O | NoSQL DBs (Cassandra), data warehousing |
| **D** (Dense) | Local HDD storage | MapReduce, HDFS, distributed file systems |
| **P/G** (Accelerated) | GPU | ML training, 3D rendering, video encoding |
| **Inf/Trn** (Accelerated) | ML chips | ML inference (Inferentia), ML training (Trainium) |

### Naming Convention
**m7g.xlarge** = Family (m) + Generation (7) + Processor (g=Graviton) + Size (xlarge)

## Placement Groups

| Type | Behavior | Use Case |
|------|----------|----------|
| **Cluster** | Same rack, same AZ | HPC, low latency (<10Gbps network) |
| **Spread** | Distinct hardware, max 7 per AZ | Critical HA instances (small count) |
| **Partition** | Separate racks per partition | Large distributed systems (HDFS, Cassandra, Kafka) |

## Containers on AWS

### ECS vs EKS

| Aspect | ECS | EKS |
|--------|-----|-----|
| **Orchestrator** | AWS-proprietary | Standard Kubernetes |
| **Complexity** | Simpler | More complex, more powerful |
| **Portability** | AWS-only | Multi-cloud, on-prem |
| **Ecosystem** | AWS-native integrations | K8s ecosystem (Helm, Istio, etc.) |
| **Pricing** | Free control plane | \\$0.10/hour per cluster |

### Fargate
- Serverless containers — no EC2 instances to manage
- Per-vCPU and per-GB-memory pricing (per second)
- Good for spiky, unpredictable workloads
- Fargate Spot: up to 70% discount (interruptible)

## Lambda Performance Tuning

| Parameter | Range | Impact |
|-----------|-------|--------|
| **Memory** | 128 MB - 10 GB | CPU scales proportionally with memory |
| **Timeout** | 1s - 15 min | Max execution time |
| **Ephemeral Storage** | 512 MB - 10 GB | Temporary /tmp storage |
| **Provisioned Concurrency** | Pre-initialize instances | Eliminates cold starts |
| **SnapStart** | Java only | Cached snapshot restores in <1s |
| **Layers** | Up to 5 | Shared libraries across functions |

## AWS Graviton

ARM-based processors built by AWS:
- **Up to 40% better price-performance** vs x86
- Available for: EC2, RDS, ElastiCache, Lambda, EKS, ECS
- Graviton4: latest generation (m8g, c8g, r8g)
- Requires ARM-compatible code (most Linux workloads work natively)

## AWS Compute Optimizer

ML-based right-sizing recommendations:
- EC2 instances (over/under-provisioned)
- EBS volumes (type and size)
- Lambda functions (memory optimization)
- Auto Scaling groups (instance type mix)

## Common Exam Mistakes

- Using Cluster placement for HA (it is for performance, NOT HA)
- Choosing EKS when ECS is simpler and sufficient
- Not knowing Graviton offers 40% better price-performance
- Forgetting Lambda memory increases also increase CPU proportionally
- Using Spread placement for large fleets (max 7 per AZ limit)
`,

  quiz: [
    {
      question: 'Which EC2 instance family is best for compute-intensive batch processing?',
      options: ['M (General Purpose)', 'C (Compute Optimized)', 'R (Memory Optimized)', 'T (Burstable)'],
      correct: 1,
      explanation: 'C family (Compute Optimized) provides the highest CPU-to-memory ratio. Ideal for batch processing, ML inference, scientific computing, and gaming servers.',
      reference: 'C = Compute (CPU-intensive). R = Memory (RAM-intensive). M = General (balanced).'
    },
    {
      question: 'What does a Cluster placement group provide?',
      options: ['Instances across different AZs for HA', 'Instances on the same rack for lowest latency', 'Maximum 7 instances per AZ', 'Automatic failover'],
      correct: 1,
      explanation: 'Cluster placement: all instances on the same rack in the same AZ. Provides the lowest network latency (up to 10 Gbps between instances). Used for HPC workloads.',
      reference: 'Cluster = same rack, low latency. Spread = distinct hardware, HA. Partition = large distributed.'
    },
    {
      question: 'How does Lambda memory allocation affect CPU?',
      options: ['No effect on CPU', 'CPU scales proportionally with memory allocation', 'CPU is fixed regardless of memory', 'CPU only changes with provisioned concurrency'],
      correct: 1,
      explanation: 'Lambda allocates CPU proportionally to memory. At 1,769 MB you get 1 full vCPU. At 10 GB you get 6 vCPUs. More memory = more CPU = faster execution.',
      reference: '128 MB = minimal CPU. 1769 MB = 1 vCPU. 10 GB = 6 vCPUs. More memory often cheaper overall.'
    },
    {
      question: 'What is the benefit of AWS Graviton processors?',
      options: ['Free instances', 'Up to 40% better price-performance than x86', 'Windows-only support', 'Automatic scaling'],
      correct: 1,
      explanation: 'Graviton (ARM-based) processors offer up to 40% better price-performance vs comparable x86 instances. Available for EC2, RDS, ElastiCache, Lambda, and EKS.',
      reference: 'Graviton = ARM, 40% better price-perf. Most Linux workloads work natively.'
    },
    {
      question: 'What is the maximum number of instances per AZ in a Spread placement group?',
      options: ['3', '5', '7', 'Unlimited'],
      correct: 2,
      explanation: 'Spread placement group allows maximum 7 instances per AZ. Each instance is on distinct underlying hardware. Best for small numbers of critical instances requiring HA.',
      reference: 'Spread: max 7/AZ, distinct hardware. For larger fleets, use Partition placement.'
    },
    {
      question: 'When should you choose ECS over EKS?',
      options: ['When you need multi-cloud portability', 'When you want simpler AWS-native container orchestration', 'When you need Helm and Istio', 'When you need Kubernetes compatibility'],
      correct: 1,
      explanation: 'ECS is simpler, has tighter AWS integration, and has a free control plane. Choose ECS when you do not need Kubernetes portability or its ecosystem.',
      reference: 'ECS = simpler, AWS-native, free control plane. EKS = standard K8s, portable, \\$0.10/hr.'
    },
    {
      question: 'What does Lambda Provisioned Concurrency do?',
      options: ['Increases memory', 'Pre-initializes execution environments to eliminate cold starts', 'Extends timeout beyond 15 minutes', 'Enables GPU access'],
      correct: 1,
      explanation: 'Provisioned Concurrency keeps a specified number of execution environments initialized and ready. Eliminates cold starts for latency-sensitive applications.',
      reference: 'Provisioned Concurrency = no cold starts. SnapStart = Java cold start optimization.'
    },
    {
      question: 'What is the Partition placement group best suited for?',
      options: ['Low-latency HPC', 'Small critical instances', 'Large distributed systems like HDFS, Cassandra, and Kafka', 'Serverless workloads'],
      correct: 2,
      explanation: 'Partition placement: instances spread across logical partitions, each on separate racks. Best for large distributed and replicated workloads (HDFS, HBase, Cassandra, Kafka).',
      reference: 'Partition: separate racks per partition. Up to 7 partitions per AZ. For large distributed systems.'
    }
  ],

  flashcards: [
    { front: 'EC2 instance family mnemonics?', back: 'M=General, T=Burstable, C=Compute, R=Memory, X=Extreme Memory, I=Storage(IOPS), D=Dense(HDD), P/G=GPU, Inf=Inference, Trn=Training. Name: m7g.xlarge = family+gen+processor+size.' },
    { front: 'Placement Group types?', back: 'Cluster: same rack, lowest latency, HPC. Spread: distinct hardware per instance, max 7/AZ, HA. Partition: separate racks per partition, large distributed systems (HDFS, Cassandra, Kafka).' },
    { front: 'ECS vs EKS?', back: 'ECS: AWS-native, simpler, free control plane, tighter AWS integration. EKS: standard Kubernetes, portable, K8s ecosystem (Helm, Istio), \\$0.10/hr control plane. Choose ECS unless you need K8s.' },
    { front: 'Fargate benefits?', back: 'Serverless containers, no EC2 management, per-vCPU+memory pricing, good for spiky workloads. Fargate Spot: up to 70% off (interruptible). Works with both ECS and EKS.' },
    { front: 'Lambda performance tuning?', back: 'Memory 128MB-10GB (CPU scales proportionally). Provisioned Concurrency (no cold starts). SnapStart (Java). Layers (shared libs). 15-min max timeout. 10GB ephemeral storage.' },
    { front: 'What is AWS Graviton?', back: 'ARM-based processors by AWS. Up to 40% better price-performance vs x86. Available for EC2, RDS, ElastiCache, Lambda, EKS. Graviton4 = latest (m8g, c8g, r8g). Most Linux workloads compatible.' },
    { front: 'What does Compute Optimizer recommend?', back: 'ML-based right-sizing: EC2 instance type (over/under-provisioned), EBS volume type/size, Lambda memory, ASG instance mix. Analyzes CloudWatch metrics for recommendations.' },
    { front: 'Lambda cold starts - how to fix?', back: 'Provisioned Concurrency (pre-initialized environments). SnapStart (Java cached snapshot). Keep functions warm (scheduled invocations). Reduce package size (smaller deployment). More memory = faster init.' }
  ],

  lab: {
    scenario: 'Optimize compute resources for a containerized application.',
    objective: 'Practice EC2 selection, placement groups, and Lambda optimization.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Compare Instance Types for a Workload',
        instruction: 'Use Compute Optimizer or the EC2 console to identify the best instance type for a web application currently running on m5.xlarge with 15% average CPU.',
        hints: ['Low CPU utilization suggests over-provisioning', 'Consider Graviton for Linux workloads'],
        solution: '```bash\n# Check current instance utilization\naws cloudwatch get-metric-statistics \\\n  --namespace AWS/EC2 --metric-name CPUUtilization \\\n  --dimensions Name=InstanceId,Value=i-xxx \\\n  --start-time 2024-01-01T00:00:00Z --end-time 2024-01-08T00:00:00Z \\\n  --period 3600 --statistics Average\n\n# Get Compute Optimizer recommendations\naws compute-optimizer get-ec2-instance-recommendations \\\n  --instance-arns arn:aws:ec2:REGION:ACCT:instance/i-xxx\n\n# If 15% CPU on m5.xlarge, likely right-size to:\n# m7g.large (Graviton, 40% cheaper) or m5.large\n```',
        verify: '```bash\n# Expected recommendation:\n# Current: m5.xlarge (4 vCPU, 16 GB) at 15% CPU\n# Recommended: m7g.large (2 vCPU, 8 GB Graviton)\n# Estimated savings: ~60% (downsize + Graviton)\n```'
      },
      {
        title: 'Create a Cluster Placement Group for HPC',
        instruction: 'Create a Cluster placement group and launch 2 compute-optimized instances in it for low-latency communication.',
        hints: ['Cluster = same AZ, same rack', 'Use c-family instances for HPC'],
        solution: '```bash\n# Create cluster placement group\naws ec2 create-placement-group --group-name hpc-cluster \\\n  --strategy cluster\n\n# Launch instances in the placement group\naws ec2 run-instances --image-id ami-xxx \\\n  --instance-type c6i.xlarge --count 2 \\\n  --placement GroupName=hpc-cluster \\\n  --subnet-id subnet-xxx\n```',
        verify: '```bash\naws ec2 describe-placement-groups --group-names hpc-cluster\n# Expected: State = available, Strategy = cluster\n\naws ec2 describe-instances --filters \\\n  Name=placement-group-name,Values=hpc-cluster \\\n  --query "Reservations[].Instances[].{ID:InstanceId,Type:InstanceType,AZ:Placement.AvailabilityZone}"\n# Expected: 2 instances, same AZ\n```'
      },
      {
        title: 'Optimize Lambda Memory',
        instruction: 'Test a Lambda function with different memory configurations (128MB, 512MB, 1024MB) and compare execution time and cost.',
        hints: ['More memory = more CPU = potentially faster', 'Use AWS Lambda Power Tuning tool for automated testing'],
        solution: '```bash\n# Update Lambda memory to 128 MB\naws lambda update-function-configuration \\\n  --function-name my-function --memory-size 128\n# Invoke and note duration\naws lambda invoke --function-name my-function output.json\n\n# Update to 512 MB\naws lambda update-function-configuration \\\n  --function-name my-function --memory-size 512\naws lambda invoke --function-name my-function output.json\n\n# Update to 1024 MB\naws lambda update-function-configuration \\\n  --function-name my-function --memory-size 1024\naws lambda invoke --function-name my-function output.json\n\n# Compare Duration in response headers\n```',
        verify: '```bash\n# Expected results pattern:\n# 128 MB: Duration 3000ms, Cost = 3000ms * 128MB\n# 512 MB: Duration 800ms, Cost = 800ms * 512MB\n# 1024 MB: Duration 400ms, Cost = 400ms * 1024MB\n# Often 512-1024 MB is cheapest (faster execution offsets higher rate)\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Placement Group Launch Failure',
      difficulty: 'medium',
      symptom: 'Cannot launch instances into a Cluster placement group. Error: insufficient capacity.',
      diagnosis: '```\nCluster placement group constraints:\n1. All instances must be in the SAME AZ\n2. Capacity may be limited for the chosen instance type\n3. Cannot span multiple AZs\n4. Mixing instance types can cause issues\n\nBest practices:\n  - Use a single instance type\n  - Launch all instances in one request\n  - If capacity error, try different AZ or instance type\n  - Stop and start (not reboot) to relocate within cluster\n\nCheck:\n  aws ec2 describe-placement-groups --group-names GROUP_NAME\n  Ensure Strategy matches your need\n```',
      solution: 'Launch all instances in a single request with the same instance type. If insufficient capacity, try a different AZ or a different instance type in the same family. For guaranteed capacity, consider using Capacity Reservations with the placement group.'
    },
    {
      title: 'Lambda Cold Start Latency Too High',
      difficulty: 'hard',
      symptom: 'Lambda function has intermittent high latency (2-5 seconds) due to cold starts.',
      diagnosis: '```\nCold start causes:\n1. First invocation after deployment\n2. Scale-out (new execution environment)\n3. Idle timeout (AWS reclaims environment)\n\nDiagnosis:\n  CloudWatch Logs: look for INIT_START in log streams\n  X-Ray: Initialization segment shows cold start time\n  CloudWatch Metrics: compare Init Duration vs Duration\n\nFactors affecting cold start:\n  - Runtime (Java/C# slowest, Python/Node fastest)\n  - Package size (larger = slower init)\n  - Memory allocation (more memory = faster init)\n  - VPC (adds ENI setup time, improved with Hyperplane)\n```',
      solution: 'Options: 1) Provisioned Concurrency (guaranteed warm environments, extra cost). 2) SnapStart for Java (cached snapshot, near-zero cold start). 3) Reduce package size (smaller deployment). 4) Increase memory (faster initialization). 5) Keep warm with scheduled CloudWatch Events (cost-effective for low-traffic).'
    }
  ]
};
