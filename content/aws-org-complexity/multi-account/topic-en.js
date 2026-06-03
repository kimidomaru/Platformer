window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-org-complexity/multi-account'] = {
  theory: `# Multi-Account Strategy & Governance

## Exam Relevance
> **Design for Organizational Complexity** is worth **26%** of SAP-C02. Multi-account strategies, Organizations, Control Tower, cross-account access, and centralized governance are core topics.

## AWS Organizations

### Key Concepts
- **Management Account**: root account, owns the Organization. Use ONLY for billing/governance, NEVER for workloads. SCPs do NOT affect it.
- **Organizational Units (OUs)**: hierarchical grouping. Nested OUs inherit parent SCPs.
- **Consolidated Billing**: single invoice, volume discounts, RI/SP sharing across accounts.
- **Delegated Administrator**: delegate service management to member accounts (CloudFormation StackSets, GuardDuty, Security Hub).

### Service Control Policies (SCPs)

Two strategies:
- **Deny-list (recommended)**: start with FullAWSAccess, add explicit Deny statements
- **Allow-list**: remove FullAWSAccess, explicitly allow only permitted services

Key behaviors:
- SCPs limit MAXIMUM permissions (do NOT grant permissions)
- Hierarchical: parent OU SCP affects all children
- Do NOT affect the Management Account
- Effective permission = SCP intersection with IAM policy

## AWS Control Tower

Automated multi-account setup with best practices:
- **Landing Zone**: pre-configured multi-account environment (log archive, audit account, shared services)
- **Account Factory**: self-service account provisioning with pre-configured baselines
- **Guardrails**: preventive (SCPs), detective (Config rules), proactive (CloudFormation hooks)
- **Customizations for Control Tower (CfCT)**: extend with custom CloudFormation templates
- **Account Factory for Terraform (AFT)**: Terraform-based account provisioning

## Cross-Account Access Patterns

| Pattern | Use Case |
|---------|----------|
| **IAM Roles + AssumeRole** | Cross-account API access (most common) |
| **AWS RAM** | Share resources (Transit Gateway, subnets, License Manager) |
| **S3 Bucket Policy** | Cross-account S3 access via resource-based policy |
| **KMS Key Policy** | Cross-account encryption/decryption |
| **Secrets Manager Resource Policy** | Cross-account secret access |
| **EventBridge Event Bus Policy** | Cross-account event routing |

### AssumeRole Pattern
1. Account B creates Role with Trust Policy allowing Account A
2. User/role in Account A calls sts:AssumeRole
3. Gets temporary credentials for Account B
4. Uses temp credentials to access resources

## Centralized Logging

| Service | Centralization |
|---------|---------------|
| **CloudTrail** | Organization trail: all accounts, all Regions, to centralized S3 |
| **Config** | Aggregator: multi-account, multi-Region compliance view |
| **CloudWatch** | Cross-account observability: source accounts -> monitoring account |
| **VPC Flow Logs** | Centralized S3 bucket with bucket policy |
| **GuardDuty** | Delegated admin: centralized findings across Organization |
| **Security Hub** | Aggregated security findings across accounts |

## AWS Service Catalog

- **Portfolios**: collection of products (CloudFormation templates)
- **Products**: approved infrastructure templates
- **Launch Constraints**: IAM role used to provision (end user does not need direct permissions)
- **TagOptions**: enforce tagging on provisioned resources
- **Sharing**: share portfolios across accounts in the Organization

## Billing Strategies

- **Consolidated Billing**: single invoice, volume discounts
- **Cost Allocation Tags**: AWS-generated (aws:createdBy) + user-defined (Team, Environment)
- **RI/SP Sharing**: Reserved Instances and Savings Plans shared across Organization (can disable per account)
- **Per-account Budgets**: set individual account spending limits

## Common Exam Mistakes

- Running workloads in the Management Account (should be billing/governance only)
- Thinking SCPs grant permissions (they only restrict)
- Forgetting SCPs do NOT affect the Management Account
- Not using delegated administrator for services like GuardDuty
- Sharing resources with VPC Peering when RAM is simpler
`,

  quiz: [
    {
      question: 'Do SCPs affect the Management Account?',
      options: ['Yes, SCPs affect all accounts', 'No, the Management Account is exempt from SCPs', 'Only if explicitly configured', 'Only for billing services'],
      correct: 1,
      explanation: 'SCPs do NOT affect the Management Account. This is why you should never run workloads in it. Use it only for billing, governance, and Organization management.',
      reference: 'Management Account: exempt from SCPs. Never use for workloads. Only billing/governance.'
    },
    {
      question: 'What is the difference between SCP deny-list and allow-list strategies?',
      options: ['Deny-list blocks everything by default', 'Deny-list starts with FullAWSAccess and adds explicit denies; allow-list removes FullAWSAccess and explicitly allows', 'They are identical', 'Allow-list is more restrictive by default'],
      correct: 1,
      explanation: 'Deny-list (recommended): keep FullAWSAccess, add specific Deny statements. Allow-list: remove FullAWSAccess, only explicitly allowed services work. Deny-list is simpler to manage.',
      reference: 'Deny-list = FullAWSAccess + explicit denies (recommended). Allow-list = explicit allows only.'
    },
    {
      question: 'What does Control Tower Account Factory provide?',
      options: ['AWS account billing', 'Self-service account provisioning with pre-configured baselines and guardrails', 'EC2 instance templates', 'CloudFormation stack management'],
      correct: 1,
      explanation: 'Account Factory: self-service creation of new AWS accounts with pre-configured networking, security baselines, and guardrails. Integrates with Service Catalog for standardized provisioning.',
      reference: 'Account Factory = standardized account provisioning. Guardrails = preventive(SCP) + detective(Config).'
    },
    {
      question: 'What is the correct cross-account access pattern using IAM?',
      options: ['Share IAM users between accounts', 'Create IAM Role in target account with trust policy, assume it from source account via STS', 'Copy access keys between accounts', 'Use the same IAM policy in both accounts'],
      correct: 1,
      explanation: 'Cross-account: target account creates Role with Trust Policy allowing source account. Source account user/role calls sts:AssumeRole to get temporary credentials. NEVER share access keys.',
      reference: 'AssumeRole = temporary credentials. Trust Policy = who can assume. NEVER share access keys.'
    },
    {
      question: 'How do you centralize CloudTrail logging across an Organization?',
      options: ['Enable CloudTrail in each account individually', 'Create an Organization trail that logs all accounts and Regions to a centralized S3 bucket', 'Use CloudWatch Logs', 'Use AWS Config'],
      correct: 1,
      explanation: 'Organization trail: one trail covers all accounts in the Organization, all Regions. Logs to a centralized S3 bucket in the log archive account. No per-account setup needed.',
      reference: 'Organization trail = all accounts, all Regions, one S3 bucket. Centralized audit.'
    },
    {
      question: 'What is AWS RAM (Resource Access Manager) used for?',
      options: ['Managing RAM on EC2 instances', 'Sharing AWS resources (Transit Gateway, subnets) between accounts without duplication', 'IAM role management', 'Memory caching'],
      correct: 1,
      explanation: 'RAM shares resources between accounts: Transit Gateway, subnets, License Manager configs, Route 53 Resolver rules, and more. Avoids duplicating resources across accounts.',
      reference: 'RAM = share resources without duplication. Transit Gateway, subnets, License Manager, etc.'
    },
    {
      question: 'What are Control Tower guardrail types?',
      options: ['Only SCPs', 'Preventive (SCPs), Detective (Config rules), and Proactive (CloudFormation hooks)', 'Only Config rules', 'Only CloudWatch alarms'],
      correct: 1,
      explanation: 'Preventive: SCPs that block non-compliant actions. Detective: Config rules that detect non-compliance. Proactive: CloudFormation hooks that check before resource creation.',
      reference: 'Preventive = SCP (block). Detective = Config (detect). Proactive = CFN hooks (pre-create check).'
    },
    {
      question: 'How does Service Catalog Launch Constraint help with security?',
      options: ['It encrypts the product', 'It specifies an IAM role for provisioning so end users do not need direct service permissions', 'It restricts which accounts can use the product', 'It enables MFA'],
      correct: 1,
      explanation: 'Launch Constraint: specifies an IAM role used to provision the product. Users only need Service Catalog permissions, not direct access to underlying services (EC2, RDS, etc.).',
      reference: 'Launch Constraint = IAM role for provisioning. Users need only servicecatalog:* permissions.'
    }
  ],

  flashcards: [
    { front: 'Management Account best practices?', back: 'NEVER run workloads. Use only for billing, governance, Organization management. SCPs do NOT affect it. Do not deploy resources. Use delegated administrator for services.' },
    { front: 'SCP deny-list vs allow-list?', back: 'Deny-list (recommended): keep FullAWSAccess, add explicit Deny statements. Allow-list: remove FullAWSAccess, explicitly allow only needed services. SCPs restrict max permissions, do NOT grant.' },
    { front: 'Control Tower components?', back: 'Landing Zone: pre-configured multi-account setup. Account Factory: self-service provisioning. Guardrails: preventive(SCP), detective(Config), proactive(CFN hooks). CfCT: custom extensions.' },
    { front: 'Cross-account access patterns?', back: 'IAM AssumeRole (most common). AWS RAM (share resources). S3 bucket policy. KMS key policy. Secrets Manager resource policy. EventBridge event bus policy. NEVER share access keys.' },
    { front: 'Centralized logging architecture?', back: 'CloudTrail: org trail to S3. Config: aggregator multi-account. CloudWatch: cross-account observability. GuardDuty: delegated admin. Security Hub: aggregated findings. VPC Flow Logs: centralized S3.' },
    { front: 'AWS RAM shareable resources?', back: 'Transit Gateway, subnets, License Manager configs, Route 53 Resolver rules, Aurora DB clusters, CodeBuild projects, and more. Share within Organization or with specific accounts.' },
    { front: 'Service Catalog concepts?', back: 'Portfolios: collection of products. Products: CloudFormation templates. Launch Constraints: IAM role for provisioning. TagOptions: enforce tags. Can share across Organization accounts.' },
    { front: 'Organization billing features?', back: 'Consolidated Billing: single invoice, volume discounts. RI/SP Sharing: across accounts (can disable per account). Cost Allocation Tags: AWS-generated + user-defined. Per-account Budgets.' }
  ],

  lab: {
    scenario: 'Design a multi-account governance strategy for an enterprise.',
    objective: 'Practice Organization structure, SCPs, cross-account access, and centralized logging.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Design OU Structure and SCPs',
        instruction: 'Design an OU hierarchy for an organization with Production, Development, and Security teams. Define SCPs for each OU.',
        hints: ['Production needs stricter controls than Development', 'Security team needs full access to security services'],
        solution: '```\nAWS Organization\n|\n|-- OU: Security\n|   |-- Account: security-audit\n|   |-- Account: log-archive\n|   SCP: Allow all (security team needs broad access)\n|\n|-- OU: Production\n|   |-- Account: prod-app-1\n|   |-- Account: prod-app-2\n|   SCP: Deny leaving org, Deny disabling CloudTrail,\n|        Deny deleting VPC, Deny specific Regions\n|\n|-- OU: Development\n|   |-- Account: dev-team-1\n|   |-- Account: dev-sandbox\n|   SCP: Deny large instance types (cost control),\n|        Deny production Regions\n|\n|-- OU: Sandbox\n|   |-- Account: sandbox-1\n|   SCP: Deny all except approved services,\n|        Budget limit enforced\n```',
        verify: '```bash\naws organizations list-organizational-units-for-parent \\\n  --parent-id r-xxxx\n# Expected: Security, Production, Development, Sandbox OUs\n\naws organizations list-policies --filter SERVICE_CONTROL_POLICY\n# Expected: SCPs for each OU\n```'
      },
      {
        title: 'Configure Cross-Account Role Access',
        instruction: 'Create a Role in Account B that Account A can assume to read S3 buckets.',
        hints: ['Trust policy defines who can assume', 'Permissions policy defines what they can do'],
        solution: '```bash\n# In Account B: create Role with trust policy\naws iam create-role --role-name CrossAccountS3Reader \\\n  --assume-role-policy-document \'{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::ACCOUNT_A_ID:root"},"Action":"sts:AssumeRole"}]}\'\n\n# Attach S3 read permission\naws iam attach-role-policy --role-name CrossAccountS3Reader \\\n  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess\n\n# In Account A: assume the role\naws sts assume-role \\\n  --role-arn arn:aws:iam::ACCOUNT_B_ID:role/CrossAccountS3Reader \\\n  --role-session-name cross-account-session\n```',
        verify: '```bash\n# Verify role exists in Account B\naws iam get-role --role-name CrossAccountS3Reader\n# Expected: trust policy lists Account A as principal\n\n# Verify AssumeRole returns temporary credentials\n# Expected: AccessKeyId, SecretAccessKey, SessionToken\n```'
      },
      {
        title: 'Set Up Organization CloudTrail',
        instruction: 'Create an Organization trail that logs all accounts and Regions to a centralized S3 bucket in the log archive account.',
        hints: ['Use --is-organization-trail flag', 'S3 bucket policy must allow CloudTrail from the Organization'],
        solution: '```bash\n# Create Organization trail (from Management Account)\naws cloudtrail create-trail --name org-trail \\\n  --s3-bucket-name centralized-logs-bucket \\\n  --is-organization-trail \\\n  --is-multi-region-trail \\\n  --enable-log-file-validation\n\n# Start logging\naws cloudtrail start-logging --name org-trail\n```',
        verify: '```bash\naws cloudtrail describe-trails --trail-name-list org-trail\n# Expected: IsOrganizationTrail = true\n# IsMultiRegionTrail = true\n# S3BucketName = centralized-logs-bucket\n\naws cloudtrail get-trail-status --name org-trail\n# Expected: IsLogging = true\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'SCP Blocking Legitimate Actions',
      difficulty: 'hard',
      symptom: 'IAM admin in a member account has AdministratorAccess but cannot perform certain actions. Error: Access Denied.',
      diagnosis: '```\nSCP evaluation flow:\n1. Check SCP on the account OU (and parent OUs)\n2. If SCP denies the action -> DENIED regardless of IAM\n3. If SCP does not allow the action (allow-list mode) -> DENIED\n\nDiagnosis:\n  aws organizations list-policies-for-target \\\n    --target-id ACCOUNT_ID --filter SERVICE_CONTROL_POLICY\n  \n  Review each SCP for Deny statements or missing Allow\n  Check parent OUs (SCPs are inherited)\n  Remember: Management Account is NOT affected by SCPs\n\nCommon causes:\n  - Region restriction SCP blocking action in that Region\n  - Service restriction SCP blocking the specific service\n  - Parent OU has restrictive SCP inherited by child\n```',
      solution: 'List all SCPs applied to the account (including inherited from parent OUs). Check for explicit Deny or missing Allow. SCPs are evaluated hierarchically. Test in Management Account (exempt from SCPs) to confirm SCP is the cause. Use CloudTrail to see the denied API call and match it to SCP statements.'
    },
    {
      title: 'Cross-Account AssumeRole Fails with Access Denied',
      difficulty: 'medium',
      symptom: 'User in Account A cannot assume role in Account B despite trust policy configuration.',
      diagnosis: '```\nBoth sides must be correctly configured:\n\n1. Trust Policy on Role (Account B):\n   Principal must match Account A (account ID or specific user/role ARN)\n   Action: sts:AssumeRole\n\n2. IAM Policy on User/Role (Account A):\n   Must have Allow sts:AssumeRole on the Account B role ARN\n\n3. SCP (if using Organizations):\n   SCP on Account A must allow sts:AssumeRole\n   SCP on Account B must allow sts:AssumeRole\n\n4. Permissions Boundary (if applied):\n   Must allow sts:AssumeRole\n\n5. External ID (if required in trust policy):\n   --external-id parameter must match\n\nCheck:\n  aws iam get-role --role-name ROLE (Account B)\n  Look at AssumeRolePolicyDocument\n```',
      solution: 'Cross-account requires BOTH: Trust Policy on the Role (who can assume) AND IAM permission on the caller (allow to assume). Check account IDs, ARN formats, conditions (ExternalId, MFA). If using Organizations, verify SCPs on both accounts allow sts:AssumeRole.'
    }
  ]
};
