window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-continuous-improvement/operational-excellence'] = {
  theory: `# Operational Excellence & Automation

## Exam Relevance
> **Continuous Improvement for Existing Solutions** is worth **25%** of SAP-C02. CI/CD pipelines, CloudFormation advanced, Systems Manager, and operational automation are core topics.

## AWS CodePipeline & CI/CD

### Pipeline Stages
1. **Source**: CodeCommit, GitHub, S3, ECR (trigger on push)
2. **Build**: CodeBuild (run tests, compile, create artifacts)
3. **Test**: integration tests, approval gates
4. **Deploy**: CodeDeploy, ECS, EKS, CloudFormation, Elastic Beanstalk
5. **Approval**: manual approval action (email via SNS)

### CodeBuild
- Managed build service (no servers to maintain)
- **buildspec.yml**: define build phases (install, pre_build, build, post_build)
- Runs in Docker containers (choose managed image or custom ECR image)
- Can build VPC-private resources (using VPC configuration)
- **Caching**: S3 or local for dependency layers

### CodeDeploy Deployment Strategies
| Strategy | EC2/On-Prem | Lambda | ECS |
|----------|-------------|--------|-----|
| **In-Place** | Yes | No | No |
| **Blue/Green** | Yes | Yes | Yes |
| **Canary** | No | Yes | Yes |
| **Linear** | No | Yes | Yes |
| **All-at-Once** | Yes | No | No |

## AWS CloudFormation Advanced

### Key Concepts
- **StackSets**: deploy stacks to multiple accounts/regions with one operation
  - **Service-managed**: uses Organizations for account targeting
  - **Self-managed**: manual IAM role setup
- **Change Sets**: preview changes before applying (like Terraform plan)
- **Drift Detection**: detect manual configuration changes
- **Stack Policies**: protect critical resources from accidental updates
- **Nested Stacks**: modular templates (root stack references child stacks)
- **Custom Resources**: Lambda-backed resources for non-native services
- **Macros**: transform template snippets (like SAM transform)

### Best Practices
- Use Parameters + SSM Parameter Store for dynamic values
- Export outputs for cross-stack references
- Use DeletionPolicy: Retain for production databases/S3 buckets
- Enable termination protection on production stacks

## AWS Systems Manager (SSM)

Operational tool for managing EC2 and on-premises:
- **Session Manager**: browser-based SSH without bastion host, no open ports
- **Patch Manager**: automated patching with maintenance windows
- **Parameter Store**: hierarchical config storage (plaintext or SecureString with KMS)
- **Secrets Manager integration**: reference secrets in EC2 userdata/apps
- **Run Command**: execute commands across fleets without SSH
- **State Manager**: ensure consistent configuration state
- **Automation**: runbooks for common operational tasks (EC2 start/stop, AMI creation)
- **OpsCenter**: centralized operational issues with OpsItems
- **Incident Manager**: coordinate incident response (runbooks, escalation, notifications)

### Parameter Store vs Secrets Manager
| Feature | Parameter Store | Secrets Manager |
|---------|----------------|----------------|
| **Free tier** | Standard (10k params) | No free tier |
| **Auto-rotation** | No | Yes (Lambda-based) |
| **Cross-account** | Limited | Yes |
| **Max size** | 8KB | 64KB |
| **Primary use** | Config values, non-secret strings | Credentials, API keys |

## AWS OpsWorks

Managed Puppet/Chef:
- **OpsWorks Stacks**: layers (web, app, db), recipes
- **OpsWorks for Chef Automate**: fully managed Chef server
- **OpsWorks for Puppet Enterprise**: fully managed Puppet master
- Migration path: move to Systems Manager State Manager or Ansible

## Operational Readiness

- **AWS Health**: service health events, scheduled maintenance, account-specific issues
- **Personal Health Dashboard**: your account's health events
- **Service Health Dashboard**: global AWS status page
- **EventBridge integration**: automate responses to Health events

## Common Exam Mistakes

- Forgetting CloudFormation StackSets for multi-account deployment (use Organizations)
- Choosing Secrets Manager when Parameter Store suffices (cost-conscious)
- Not using Session Manager when bastion host is mentioned (modern alternative)
- Missing drift detection after manual configuration changes
- Not knowing CodeDeploy supports Lambda traffic shifting (canary/linear)
`,

  quiz: [
    {
      question: 'What is the difference between CloudFormation StackSets with Service-Managed vs Self-Managed permissions?',
      options: ['No difference', 'Service-Managed uses AWS Organizations for account targeting; Self-Managed requires manual IAM role setup in each account', 'Service-Managed is cheaper', 'Self-Managed has more features'],
      correct: 1,
      explanation: 'Service-Managed: integrates with Organizations, automatically provision in new accounts, no manual IAM setup. Self-Managed: manually create IAM roles in admin and target accounts, more granular control.',
      reference: 'StackSets Service-Managed = Organizations integration, automatic. Self-Managed = manual IAM roles, more control.'
    },
    {
      question: 'What does AWS Systems Manager Session Manager provide compared to traditional SSH?',
      options: ['Better performance', 'Browser-based shell access without open port 22, bastion hosts, or SSH keys — fully audited via CloudTrail', 'Cheaper compute', 'Multi-user sessions'],
      correct: 1,
      explanation: 'Session Manager: access EC2 instances via browser or AWS CLI without SSH. No inbound ports needed, no bastion hosts, no key pairs to manage. All sessions logged to CloudTrail and optionally to S3/CloudWatch Logs.',
      reference: 'Session Manager = no SSH port, no bastion, no keys. Fully audited. Works for on-prem via SSM Agent.'
    },
    {
      question: 'When should you use Secrets Manager instead of SSM Parameter Store?',
      options: ['Always — Secrets Manager is better', 'When you need automatic credential rotation, cross-account access, or secret sharing between accounts', 'When secrets are small (< 8KB)', 'When cost is a concern (Parameter Store is more expensive)'],
      correct: 1,
      explanation: 'Secrets Manager: auto-rotation (Lambda), cross-account sharing, database credential integration. Parameter Store: free tier for standard params, config values, non-secret strings. Use Secrets Manager for credentials that rotate.',
      reference: 'Secrets Manager = auto-rotation, cross-account. Parameter Store = free tier, config values, no rotation.'
    },
    {
      question: 'What does CodeDeploy canary deployment do for Lambda functions?',
      options: ['Deploys to a canary environment', 'Shifts a small % of traffic to new Lambda version first, monitors alarms, then shifts remaining % after bake time', 'Creates a copy of the Lambda function', 'Deploys to a test account first'],
      correct: 1,
      explanation: 'CodeDeploy canary for Lambda: e.g., Canary10Percent5Minutes = 10% traffic to new version for 5 minutes, monitor CloudWatch alarms, then 100% if healthy. Automatic rollback if alarms trigger.',
      reference: 'CodeDeploy Lambda = canary (10%+rest) or linear (gradual %). Auto-rollback on alarm. Weighted aliases.'
    },
    {
      question: 'What does CloudFormation Drift Detection identify?',
      options: ['Cost drift from budget', 'Resources that have been manually modified outside of CloudFormation (configuration divergence)', 'Stack deployment failures', 'Changes in region availability'],
      correct: 1,
      explanation: 'Drift Detection: compares the current resource configuration in AWS with what CloudFormation expects based on the stack template. Identifies resources modified directly via console, CLI, or API — not through CloudFormation.',
      reference: 'Drift = manual changes outside CloudFormation. Detect per stack. Remediate by importing or redeploying.'
    },
    {
      question: 'What is the purpose of a CloudFormation Stack Policy?',
      options: ['IAM policy for CloudFormation service', 'JSON document that defines which stack resources can be updated, preventing accidental modification of critical resources', 'Policy for cross-account deployments', 'Policy for CloudFormation StackSets'],
      correct: 1,
      explanation: 'Stack Policy: defines which resources are protected from updates. Example: prevent accidental deletion of a production RDS database. Must explicitly allow updates to protected resources.',
      reference: 'Stack Policy = protect resources from updates. Not the same as IAM policies. Overridable temporarily.'
    },
    {
      question: 'What does the buildspec.yml file define in AWS CodeBuild?',
      options: ['The build server size', 'Build phases (install, pre_build, build, post_build), commands, environment variables, and artifacts', 'The deployment configuration', 'The source repository'],
      correct: 1,
      explanation: 'buildspec.yml: configuration file in the repository root that defines the build lifecycle. Phases: install (runtime), pre_build (login to ECR), build (run tests/compile), post_build (push artifacts). Can include cache configuration.',
      reference: 'buildspec.yml = phases (install/pre_build/build/post_build), commands, env vars, artifacts definition.'
    },
    {
      question: 'What is AWS Systems Manager Automation used for?',
      options: ['Auto-scaling', 'Runbooks for common operational tasks: start/stop EC2, create AMIs, patch instances, remediate Config violations', 'Automated testing', 'Database automation'],
      correct: 1,
      explanation: 'SSM Automation: execute operational runbooks (documents) at scale. Pre-built: patch instances, restart services, create AMIs. Custom: complex multi-step workflows. Integrates with Config remediation, EventBridge.',
      reference: 'SSM Automation = operational runbooks at scale. Pre-built docs. Config remediation. EventBridge triggers.'
    }
  ],

  flashcards: [
    { front: 'CodePipeline stages?', back: 'Source (CodeCommit/GitHub/S3/ECR) -> Build (CodeBuild) -> Test -> Deploy (CodeDeploy/ECS/CFN) -> Approval (manual). Parallel actions within stages. Cross-region/cross-account deployment supported.' },
    { front: 'CloudFormation StackSets?', back: 'Deploy stacks to multiple accounts/regions. Service-Managed: uses Organizations, auto-provision new accounts. Self-Managed: manual IAM roles. Concurrent deployments configurable.' },
    { front: 'SSM Session Manager benefits?', back: 'No SSH port 22 open. No bastion hosts. No key pairs. Browser or CLI access. Full audit trail (CloudTrail + S3/CWL logs). Works for EC2 + on-prem via SSM Agent.' },
    { front: 'Secrets Manager vs Parameter Store?', back: 'Secrets Manager: auto-rotation, cross-account, database integration, $0.40/secret/month. Parameter Store: free standard (10k), no auto-rotation, config values, 8KB max. Use Secrets for rotating credentials.' },
    { front: 'CodeDeploy deployment types?', back: 'EC2/On-Prem: In-Place, Blue/Green. Lambda: Canary (10%+rest), Linear (gradual%), AllAtOnce. ECS: Blue/Green only. All support CloudWatch alarm rollback.' },
    { front: 'CloudFormation key features?', back: 'StackSets (multi-acct/region). Change Sets (preview changes). Drift Detection (manual changes). Stack Policy (protect resources). Nested Stacks (modular). Custom Resources (Lambda-backed). Macros (transforms).' },
    { front: 'SSM components?', back: 'Session Manager: SSH-less access. Patch Manager: automated patching. Parameter Store: config. Run Command: fleet commands. State Manager: config drift. Automation: runbooks. OpsCenter: operational issues. Incident Manager: response.' },
    { front: 'AWS Health?', back: 'Personal Health Dashboard: account-specific events. Service Health Dashboard: global status. EventBridge integration: automate responses (notify, remediate). Affected resources list. Scheduled maintenance alerts.' }
  ],

  lab: {
    scenario: 'Build a CI/CD pipeline for a containerized application with automated testing and blue/green deployment.',
    objective: 'Practice CodePipeline, CodeBuild, and CodeDeploy for ECS blue/green deployment.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create CodeBuild Project with buildspec.yml',
        instruction: 'Create a CodeBuild project that builds a Docker image, runs tests, and pushes to ECR.',
        hints: ['CodeBuild needs IAM role with ECR permissions', 'Use environment variables for account ID and region'],
        solution: '```bash\n# Create CodeBuild project\naws codebuild create-project \\\n  --name AppBuild \\\n  --source type=CODECOMMIT,location=https://git-codecommit.us-east-1.amazonaws.com/v1/repos/my-app \\\n  --artifacts type=NO_ARTIFACTS \\\n  --environment type=LINUX_CONTAINER,computeType=BUILD_GENERAL1_SMALL,image=aws/codebuild/standard:7.0,privilegedMode=true \\\n  --service-role arn:aws:iam::ACCT:role/CodeBuildRole\n\n# Example buildspec.yml (in repo)\n# cat buildspec.yml\n# version: 0.2\n# phases:\n#   pre_build:\n#     commands:\n#       - aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI\n#   build:\n#     commands:\n#       - docker build -t $ECR_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION .\n#   post_build:\n#     commands:\n#       - docker push $ECR_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION\n```',
        verify: '```bash\naws codebuild batch-get-projects --names AppBuild\n# Expected: project with LINUX_CONTAINER environment\n\n# Start build manually to test\naws codebuild start-build --project-name AppBuild\n# Expected: buildId returned, monitor in console\n```'
      },
      {
        title: 'Create CodePipeline with Source and Deploy Stages',
        instruction: 'Create a CodePipeline that triggers from CodeCommit, builds with CodeBuild, and deploys to ECS using blue/green.',
        hints: ['Pipeline needs service role with permissions for all stages', 'ECS blue/green uses CodeDeploy as deploy provider'],
        solution: '```bash\naws codepipeline create-pipeline --pipeline \'{\n  "name": "AppPipeline",\n  "roleArn": "arn:aws:iam::ACCT:role/CodePipelineRole",\n  "artifactStore": {"type": "S3", "location": "my-pipeline-bucket"},\n  "stages": [\n    {\n      "name": "Source",\n      "actions": [{"name":"Source","actionTypeId":{"category":"Source","owner":"AWS","provider":"CodeCommit","version":"1"},"outputArtifacts":[{"name":"SourceOutput"}],"configuration":{"RepositoryName":"my-app","BranchName":"main"}}]\n    },\n    {\n      "name": "Build",\n      "actions": [{"name":"Build","actionTypeId":{"category":"Build","owner":"AWS","provider":"CodeBuild","version":"1"},"inputArtifacts":[{"name":"SourceOutput"}],"outputArtifacts":[{"name":"BuildOutput"}],"configuration":{"ProjectName":"AppBuild"}}]\n    }\n  ]\n}\'\n```',
        verify: '```bash\naws codepipeline get-pipeline --name AppPipeline\n# Expected: pipeline with Source and Build stages\n\naws codepipeline get-pipeline-state --name AppPipeline\n# Expected: latest execution status for each stage\n```'
      },
      {
        title: 'Configure SSM Parameter Store for App Configuration',
        instruction: 'Store application configuration in SSM Parameter Store and access it from Lambda/EC2 at runtime.',
        hints: ['Use SecureString type for sensitive values', 'IAM policy must grant ssm:GetParameter for specific paths'],
        solution: '```bash\n# Create standard parameter\naws ssm put-parameter \\\n  --name "/myapp/prod/database-url" \\\n  --value "mysql://rds-endpoint:3306/mydb" \\\n  --type String \\\n  --description "Production database URL"\n\n# Create secure parameter (encrypted with KMS)\naws ssm put-parameter \\\n  --name "/myapp/prod/api-key" \\\n  --value "secret-api-key-value" \\\n  --type SecureString \\\n  --key-id alias/aws/ssm\n\n# Get parameter value\naws ssm get-parameter \\\n  --name "/myapp/prod/database-url" \\\n  --query "Parameter.Value" --output text\n\n# Get all under path\naws ssm get-parameters-by-path \\\n  --path "/myapp/prod/" \\\n  --with-decryption\n```',
        verify: '```bash\naws ssm describe-parameters \\\n  --filters "Key=Path,Values=/myapp/prod/"\n# Expected: both parameters listed\n\n# Verify decryption works\naws ssm get-parameter \\\n  --name "/myapp/prod/api-key" \\\n  --with-decryption \\\n  --query "Parameter.Value"\n# Expected: decrypted value (not encrypted blob)\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'CloudFormation Stack Update Rolling Back',
      difficulty: 'medium',
      symptom: 'CloudFormation stack update fails and rolls back. Error message shows UPDATE_ROLLBACK_COMPLETE state.',
      diagnosis: '```\nCloudFormation rollback checklist:\n1. Check Stack Events:\n   aws cloudformation describe-stack-events \\\n     --stack-name STACK_NAME \\\n     --query "StackEvents[?ResourceStatus==FAILED]"\n   Look for ResourceStatusReason field\n\n2. Common causes:\n   a) IAM permission issue: CFN role lacks needed permission\n      -> Check ResourceStatusReason for "is not authorized"\n   b) Resource already exists (name conflict)\n      -> Check if resource with same name exists\n   c) Invalid parameter value\n      -> Constraint violations in resource properties\n   d) Service limit exceeded\n      -> Check ResourceStatusReason for "limit exceeded"\n\n3. If stuck in UPDATE_ROLLBACK_FAILED:\n   Cannot proceed until resolved\n   Must use continue-update-rollback or delete stack\n\n4. Change Sets:\n   Preview with: aws cloudformation create-change-set\n   Detect issues before applying\n```',
      solution: 'Check stack events for the FAILED resource and read ResourceStatusReason. Fix the root cause (permissions, naming conflicts, parameter values). Use Change Sets to preview future updates. If stuck in UPDATE_ROLLBACK_FAILED, use continue-update-rollback or skip the specific resource. Enable stack policy to prevent accidental critical resource changes.'
    },
    {
      title: 'CodeBuild Pipeline Failing with AccessDenied in Build Stage',
      difficulty: 'hard',
      symptom: 'CodeBuild build fails immediately after start with AccessDenied error. Works when run locally with developer credentials.',
      diagnosis: '```\nCodeBuild IAM permission checklist:\n1. CodeBuild service role vs developer credentials:\n   CodeBuild uses the configured SERVICE ROLE, not developer credentials\n   Role is specified in project configuration\n\n2. Common permission requirements:\n   - ECR: ecr:GetAuthorizationToken, ecr:BatchGetImage, ecr:PutImage\n   - S3 (artifacts): s3:PutObject, s3:GetObject\n   - SSM (parameter access): ssm:GetParameter\n   - Secrets Manager: secretsmanager:GetSecretValue\n   - KMS (if encrypted params): kms:Decrypt\n\n3. VPC configuration issues:\n   If CodeBuild is in VPC without NAT, cannot reach:\n   - ECR (need VPC endpoint or NAT)\n   - S3 (need VPC endpoint or NAT)\n   - SSM (need VPC endpoint or NAT)\n\n4. Check CloudTrail for the denied API call:\n   Find the exact action that was denied\n   aws cloudtrail lookup-events \\\n     --lookup-attributes AttributeKey=EventName,AttributeValue=AccessDenied\n```',
      solution: 'Check the CodeBuild service role permissions — it must have explicit permissions for each AWS service used in the build (ECR, S3, SSM, etc.). If CodeBuild runs in a VPC, ensure VPC endpoints are configured for required services. Check CloudTrail for the specific denied API action. Use IAM policy simulator to test the service role.'
    }
  ]
};
