window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-new-solutions/containers-at-scale'] = {
  theory: `# Containers & Microservices at Scale

## Exam Relevance
> **Design for New Solutions** is worth **29%** of SAP-C02. Container orchestration choices (ECS vs EKS), Fargate, service mesh, service discovery, and deployment strategies are heavily tested.

## ECS vs EKS at Scale

| Feature | ECS | EKS |
|---------|-----|-----|
| **Orchestration** | AWS proprietary | Kubernetes-native |
| **Learning curve** | Low | High (Kubernetes) |
| **Portability** | AWS-only | Multi-cloud/hybrid |
| **Launch types** | EC2, Fargate, External | EC2, Fargate, Managed Nodes |
| **Networking** | awsvpc mode (VPC native) | VPC CNI plugin |
| **Service Mesh** | App Mesh / ECS Connect | App Mesh / Istio |
| **Cost** | No cluster fee | $0.10/hr cluster fee |

### ECS Advanced Concepts
- **Task Definitions**: blueprint for containers (CPU, memory, networking, logging)
- **awsvpc mode**: each task gets its own ENI and private IP in VPC
- **Service Auto Scaling**: target tracking, step scaling for ECS services
- **Capacity Providers**: manage EC2 Auto Scaling Groups for ECS clusters
- **ECS Anywhere**: run ECS on on-premises servers

### EKS Advanced Concepts
- **Managed Node Groups**: AWS manages EC2 provisioning + patching
- **EKS Fargate Profiles**: run pods serverlessly on Fargate
- **EKS Anywhere**: run EKS on on-premises (VMware, bare metal)
- **EKS Blueprints**: pre-configured EKS cluster configurations
- **Karpenter**: open-source node provisioner (better than Cluster Autoscaler)

## AWS Fargate

Serverless container compute — no EC2 management:
- **ECS on Fargate**: task-level isolation, ENI per task
- **EKS on Fargate**: pod-level Fargate profiles (no persistent volumes on Fargate)
- **Pricing**: vCPU + memory per second (more expensive per unit than EC2)
- **Use case**: variable workloads, dev/test, batch jobs, simpler operations

## AWS App Runner

Fully managed container service for web apps/APIs:
- **Source**: deploy from ECR image or GitHub repository directly
- **Auto-scaling**: scale to zero, scale from zero (pay-per-use)
- **HTTPS**: automatic TLS, custom domains
- **VPC connectivity**: private VPC endpoints for backend services
- **Use case**: simple web apps/APIs without ECS/EKS complexity

## Amazon ECR

Managed container registry:
- **ECR Public**: public gallery (like Docker Hub)
- **ECR Private**: private per-account, per-region
- **Vulnerability scanning**: Basic (on push) or Enhanced (continuous with Inspector)
- **Lifecycle policies**: auto-expire untagged images, keep N tagged images
- **Cross-region/cross-account**: replicate images for multi-region deployments

## Service Discovery & Mesh

### AWS Cloud Map
- Register services by name (DNS or API-based discovery)
- Health checks integrated
- Works across VPCs and Regions

### AWS App Mesh
- Service mesh using Envoy sidecar proxy
- **Virtual nodes**: represent actual services
- **Virtual services**: abstract service endpoint
- **Traffic policies**: retries, timeouts, circuit breaking, canary routing
- **Observability**: traces (X-Ray), metrics (CloudWatch), logs

## Deployment Strategies with CodeDeploy

| Strategy | Description | Rollback |
|----------|-------------|---------|
| **Blue/Green** | New task set, shift traffic % over time | Instant (reroute to blue) |
| **Rolling** | Replace old with new gradually | Slow (re-deploy) |
| **Canary** | Small % to new, monitor, then full | Fast |

## AWS Proton

Infrastructure as Code for platform teams:
- **Templates**: platform team defines VPC, ECS/EKS, CI/CD stacks
- **Services**: developers deploy using approved templates
- **Separation of concerns**: infra team vs dev team responsibilities

## Common Exam Mistakes

- Choosing ECS when Kubernetes portability is required (use EKS)
- Using Fargate when persistent storage (EBS) is needed (not supported)
- Not knowing App Runner auto-scales to zero (cost savings)
- Missing ECR lifecycle policies causing high storage costs
- Forgetting App Mesh requires Envoy sidecar (cannot use natively)
`,

  quiz: [
    {
      question: 'When should you choose EKS over ECS?',
      options: ['When you want lower cost', 'When you need Kubernetes portability, multi-cloud/hybrid, or existing Kubernetes tooling', 'EKS is always better', 'ECS has more features than EKS'],
      correct: 1,
      explanation: 'EKS: Kubernetes-native, portable across environments, large ecosystem. ECS: simpler, AWS-native, no cluster fee. Choose EKS for Kubernetes expertise, multi-cloud, or existing K8s tooling. ECS for simplicity and AWS-only workloads.',
      reference: 'EKS = portable K8s, multi-cloud, $0.10/hr cluster fee. ECS = simpler, AWS-native, no cluster fee.'
    },
    {
      question: 'What is the main limitation of EKS Fargate compared to EC2 node groups?',
      options: ['Higher latency', 'No support for persistent EBS volumes or DaemonSets', 'Cannot use spot instances', 'No horizontal pod autoscaling'],
      correct: 1,
      explanation: 'EKS Fargate does not support EBS persistent volumes (use EFS instead), DaemonSets, or privileged containers. EC2 node groups support all Kubernetes workload types.',
      reference: 'Fargate limitations: no EBS, no DaemonSets, no privileged. Use EC2 nodes for these requirements.'
    },
    {
      question: 'What makes AWS App Runner different from ECS/EKS?',
      options: ['It only supports Java applications', 'Fully managed with auto-scaling to zero, deploys directly from source code or ECR, minimal configuration', 'It is cheaper than Fargate', 'It has more networking options'],
      correct: 1,
      explanation: 'App Runner: deploy containers or source code directly, auto-scale to zero (cost savings), built-in HTTPS/load balancing. No cluster or task definition management needed. Best for simple web apps/APIs.',
      reference: 'App Runner = serverless containers, scale to zero, from source or ECR. ECS/EKS = more control, complexity.'
    },
    {
      question: 'What deployment strategy allows instant rollback with zero additional cost?',
      options: ['Rolling update', 'Blue/Green deployment', 'Canary deployment', 'In-place update'],
      correct: 1,
      explanation: 'Blue/Green: new version deployed alongside old. Traffic shifted using ALB/NLB weighted target groups. Rollback = reroute traffic to blue environment instantly. No need to re-deploy old version.',
      reference: 'Blue/Green = instant rollback, zero-downtime. Rolling = gradual, slower rollback. Canary = small% test first.'
    },
    {
      question: 'What does awsvpc networking mode provide for ECS tasks?',
      options: ['Better performance', 'Each task gets its own ENI and VPC IP address, enabling fine-grained Security Group control', 'Shared IP across tasks', 'Internet access by default'],
      correct: 1,
      explanation: 'awsvpc mode: each ECS task gets its own Elastic Network Interface (ENI) in the VPC. Enables Security Groups at task level (not just instance level), VPC Flow Logs per task, and same networking as EC2.',
      reference: 'awsvpc = ENI per task, SG at task level, VPC-native networking. Required for Fargate.'
    },
    {
      question: 'What does ECR Enhanced Scanning provide that Basic Scanning does not?',
      options: ['Faster scanning', 'Continuous scanning with Amazon Inspector (not just on push), OS and package vulnerability detection', 'Cross-region replication', 'Private registry'],
      correct: 1,
      explanation: 'Basic Scanning: scan on push only, OS vulnerabilities. Enhanced Scanning: uses Amazon Inspector, continuous scanning, OS + programming language package vulnerabilities, automatic re-scanning when new CVEs published.',
      reference: 'Basic = on-push, OS only. Enhanced = continuous, OS + packages (Inspector). Recommended for production.'
    },
    {
      question: 'What is AWS App Mesh used for in microservices architectures?',
      options: ['Load balancing', 'Service mesh using Envoy sidecar proxy for traffic management, retries, circuit breaking, and observability', 'Container registry', 'Service discovery DNS'],
      correct: 1,
      explanation: 'App Mesh provides service mesh capabilities: traffic routing, retries, timeouts, circuit breaking, and observability (metrics, traces, logs) without code changes. Uses Envoy proxy sidecar injected into each container.',
      reference: 'App Mesh = Envoy sidecar, traffic policies, observability. Cloud Map = service discovery (DNS/API).'
    },
    {
      question: 'What is the correct use case for ECS Capacity Providers?',
      options: ['Manage IAM permissions', 'Define compute capacity (EC2 ASG) strategy for ECS clusters — managed scaling of EC2 instances', 'Configure networking', 'Manage ECR images'],
      correct: 1,
      explanation: 'Capacity Providers: link ECS clusters to EC2 Auto Scaling Groups. Managed scaling automatically adjusts the ASG based on ECS task demand. Weight across multiple capacity providers for cost optimization.',
      reference: 'Capacity Providers = link ECS to EC2 ASG, managed scaling. Mix Spot + On-Demand for cost savings.'
    }
  ],

  flashcards: [
    { front: 'ECS vs EKS choice?', back: 'ECS: AWS-native, simpler, no cluster fee, awsvpc networking. EKS: Kubernetes-native, portable, multi-cloud, $0.10/hr cluster fee. Choose ECS for simplicity, EKS for K8s portability/ecosystem.' },
    { front: 'Fargate limitations?', back: 'No EBS persistent volumes (use EFS). No DaemonSets. No privileged containers. No GPU. Task-level isolation. Pay per vCPU/memory per second. Supported by both ECS and EKS.' },
    { front: 'AWS App Runner?', back: 'Fully managed containers/apps. Deploy from ECR image or GitHub. Auto-scale to zero. Built-in HTTPS, custom domains. VPC connectivity. No cluster mgmt. Best for simple web apps/APIs.' },
    { front: 'ECR features?', back: 'Private/Public registries. Basic scanning (on push, OS). Enhanced scanning (Inspector, continuous, OS+packages). Lifecycle policies (auto-expire images). Cross-region/account replication. Immutable tags.' },
    { front: 'Deployment strategies?', back: 'Blue/Green: instant rollback, reroute traffic. Rolling: replace tasks gradually, slower rollback. Canary: small% to new version first. All configurable with CodeDeploy for ECS.' },
    { front: 'App Mesh components?', back: 'Virtual nodes: represent services. Virtual services: abstract endpoint. Envoy sidecar: injected into each task/pod. Traffic policies: retries, timeouts, circuit breaking, canary. Observability: X-Ray + CloudWatch.' },
    { front: 'Cloud Map vs App Mesh?', back: 'Cloud Map: service discovery via DNS or API (register/find services). App Mesh: service mesh (traffic management, resilience, observability). They complement each other — Cloud Map for discovery, App Mesh for traffic control.' },
    { front: 'ECS awsvpc mode?', back: 'Each ECS task gets own ENI + VPC IP. Security Groups at task level (fine-grained). VPC Flow Logs per task. Same networking as EC2 instances. Required for Fargate. Limits tasks per instance (ENI count).' }
  ],

  lab: {
    scenario: 'Deploy a microservices application on ECS Fargate with blue/green deployment.',
    objective: 'Practice ECS service creation, ECR image management, and blue/green deployment.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create ECS Cluster and Task Definition',
        instruction: 'Create an ECS cluster with Fargate launch type and a task definition for a web service.',
        hints: ['Fargate requires awsvpc network mode', 'Task definition specifies CPU, memory, container image'],
        solution: '```bash\n# Create ECS cluster\naws ecs create-cluster --cluster-name microservices-cluster \\\n  --capacity-providers FARGATE FARGATE_SPOT\n\n# Create task definition\naws ecs register-task-definition \\\n  --family web-service \\\n  --network-mode awsvpc \\\n  --requires-compatibilities FARGATE \\\n  --cpu "256" --memory "512" \\\n  --execution-role-arn arn:aws:iam::ACCT:role/ecsTaskExecutionRole \\\n  --container-definitions \'[{"name":"web","image":"nginx:latest","portMappings":[{"containerPort":80}],"logConfiguration":{"logDriver":"awslogs","options":{"awslogs-group":"/ecs/web-service","awslogs-region":"us-east-1","awslogs-stream-prefix":"web"}}}]\'\n```',
        verify: '```bash\naws ecs describe-clusters --clusters microservices-cluster\n# Expected: status = ACTIVE, capacityProviders = [FARGATE, FARGATE_SPOT]\n\naws ecs describe-task-definition --task-definition web-service\n# Expected: task definition registered with FARGATE compatibility\n```'
      },
      {
        title: 'Create ECS Service with Blue/Green Deployment',
        instruction: 'Create an ECS service using CodeDeploy blue/green deployment with an Application Load Balancer.',
        hints: ['Blue/green requires CodeDeploy deployment controller', 'Two target groups needed for ALB'],
        solution: '```bash\n# Create ECS service with CodeDeploy deployment controller\naws ecs create-service \\\n  --cluster microservices-cluster \\\n  --service-name web-service \\\n  --task-definition web-service \\\n  --desired-count 2 \\\n  --launch-type FARGATE \\\n  --network-configuration "awsvpcConfiguration={subnets=[subnet-1111,subnet-2222],securityGroups=[sg-xxxx],assignPublicIp=ENABLED}" \\\n  --deployment-controller type=CODE_DEPLOY \\\n  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...:targetgroup/blue-tg/xxx,containerName=web,containerPort=80"\n```',
        verify: '```bash\naws ecs describe-services \\\n  --cluster microservices-cluster \\\n  --services web-service\n# Expected: status = ACTIVE, deploymentController = CODE_DEPLOY\n# runningCount = desiredCount = 2\n```'
      },
      {
        title: 'Set ECR Lifecycle Policy',
        instruction: 'Create an ECR lifecycle policy to automatically remove untagged images older than 7 days and keep only 5 tagged images.',
        hints: ['Lifecycle policies reduce storage costs', 'Rules are evaluated in order by priority'],
        solution: '```bash\n# Create ECR repository\naws ecr create-repository --repository-name web-service\n\n# Set lifecycle policy\naws ecr put-lifecycle-policy \\\n  --repository-name web-service \\\n  --lifecycle-policy-text \'{"rules":[{"rulePriority":1,"description":"Remove untagged > 7 days","selection":{"tagStatus":"untagged","countType":"sinceImagePushed","countUnit":"days","countNumber":7},"action":{"type":"expire"}},{"rulePriority":2,"description":"Keep last 5 tagged","selection":{"tagStatus":"tagged","tagPrefixList":["v"],"countType":"imageCountMoreThan","countNumber":5},"action":{"type":"expire"}}]}\'\n```',
        verify: '```bash\naws ecr get-lifecycle-policy --repository-name web-service\n# Expected: lifecycle policy with 2 rules\n\naws ecr describe-repositories --repository-names web-service\n# Expected: repository with imageScanningConfiguration\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'ECS Tasks Failing to Start (ResourceInitializationError)',
      difficulty: 'medium',
      symptom: 'ECS Fargate tasks stop immediately with ResourceInitializationError. Tasks never reach RUNNING state.',
      diagnosis: '```\nResourceInitializationError common causes:\n1. Cannot pull image from ECR:\n   - Task execution role lacks ecr:GetAuthorizationToken\n   - Task execution role lacks ecr:BatchGetImage\n   - VPC has no internet access + no VPC endpoint for ECR\n   Check: ecs-agent logs or task stopped reason\n\n2. Secrets Manager/SSM Parameter Store access:\n   - Execution role lacks secretsmanager:GetSecretValue\n   - No VPC endpoint for Secrets Manager\n\n3. CloudWatch Logs:\n   - Execution role lacks logs:CreateLogGroup, logs:CreateLogStream\n\nDiagnose:\n  aws ecs describe-tasks \\\n    --cluster CLUSTER --tasks TASK_ARN\n  Look at stoppedReason and containers[].reason\n\nVPC Endpoints needed (no NAT required):\n  - com.amazonaws.REGION.ecr.dkr\n  - com.amazonaws.REGION.ecr.api\n  - com.amazonaws.REGION.s3 (gateway)\n  - com.amazonaws.REGION.logs\n```',
      solution: 'Check task execution role has ECR pull permissions. If VPC has no internet access, create VPC Interface Endpoints for ECR (ecr.dkr, ecr.api) and S3 Gateway Endpoint. Check describe-tasks stoppedReason for exact cause. Enable CloudWatch Container Insights for better visibility.'
    },
    {
      title: 'Blue/Green Deployment Stuck in Replacement Task Set',
      difficulty: 'hard',
      symptom: 'CodeDeploy blue/green deployment creates replacement task set but never completes traffic shifting. Deployment stays in "WaitingForTrafficShiftToComplete".',
      diagnosis: '```\nBlue/Green deployment flow:\n1. ECS creates replacement (green) task set\n2. CodeDeploy health checks on green target group\n3. If health checks pass: shifts traffic per deployment config\n4. After bake time: terminates original (blue) task set\n\nCommon stuck causes:\n1. Green target group health checks failing:\n   aws elbv2 describe-target-health \\\n     --target-group-arn GREEN_TG_ARN\n   \n2. Container health check in task definition failing:\n   aws ecs describe-tasks (look at health field)\n\n3. Security Group not allowing ALB -> task on correct port\n\n4. Application error causing tasks to exit:\n   Check CloudWatch Logs for the green containers\n\n5. Deployment config timeout:\n   Check CodeDeploy deployment events in console\n```',
      solution: 'Check green target group health in ALB (aws elbv2 describe-target-health). Verify Security Groups allow ALB to reach tasks on container port. Check application logs in CloudWatch. If health checks pass but traffic not shifting, check CodeDeploy deployment lifecycle event order. Manual override possible in CodeDeploy console.'
    }
  ]
};
