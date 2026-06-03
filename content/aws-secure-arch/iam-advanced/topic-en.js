window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-secure-arch/iam-advanced'] = {
  theory: `# IAM Advanced & Organizations

## Exam Relevance
> The **Design Secure Architectures** domain is worth **30%** of the SAA-C03. Advanced IAM, Organizations, federation, and cross-account access are frequent topics.

## IAM Policies in Depth

### Policy Evaluation Logic

1. **Explicit Deny** in any policy -> DENY (always wins)
2. **Organizations SCP** -> can restrict (guardrail)
3. **Resource-based policy** -> can allow cross-account
4. **Permissions boundary** -> limits maximum scope
5. **Session policy** -> restricts temporary credentials
6. **Identity-based policy** -> grants permissions

Rule: **Explicit Deny ALWAYS overrides Allow**

### Policy Types

| Type | Scope | Use |
|------|-------|-----|
| **Identity-based** | Attached to user/group/role | Principal permissions |
| **Resource-based** | Attached to resource (S3, SQS, Lambda) | Who can access the resource |
| **Permissions Boundary** | Limits max scope of user/role | Secure delegation |
| **SCP** | Limits accounts in Organizations | Organizational guardrails |
| **Session Policy** | Restricts temporary credentials | AssumeRole, Federation |

## AWS Organizations Advanced

### Service Control Policies (SCPs)
- Limit MAXIMUM permissions for child accounts
- Do NOT grant permissions (only restrict)
- Applied to OUs or individual accounts
- Hierarchical inheritance (parent OU affects children)
- Do NOT affect the Management Account

## AWS IAM Identity Center (formerly SSO)

Centralized access management for multiple AWS accounts and applications.

- Single sign-on for all Organization accounts
- Integrates with external IdPs (Active Directory, Okta, Azure AD)
- Permission Sets define access per account

## AWS STS (Security Token Service)

Generates temporary credentials for:
- **AssumeRole**: assume an IAM Role (cross-account, services)
- **AssumeRoleWithSAML**: SAML 2.0 federation
- **AssumeRoleWithWebIdentity**: social login (Google, Facebook, Cognito)

### Cross-Account Access Pattern
Account B creates Role with Trust Policy allowing Account A. User in Account A calls sts:AssumeRole to get temporary credentials to access resources in Account B.

## Amazon Cognito

Authentication and authorization for web and mobile applications.

### User Pools
- User directory (sign-up, sign-in), MFA, JWT tokens
- Integration with social IdPs (Google, Facebook, Apple)

### Identity Pools (Federated Identities)
- Exchanges User Pool tokens for temporary AWS credentials
- Direct access to AWS services (S3, DynamoDB) from client-side apps

## AWS Resource Access Manager (RAM)

Share AWS resources (Transit Gateway, subnets) between accounts without duplicating.

## Common Exam Mistakes

- Forgetting Explicit Deny ALWAYS overrides Allow
- Confusing SCP (organizational guardrail) with IAM Policy (permission)
- Not knowing SCPs do not affect Management Account
- Using access keys for cross-account instead of AssumeRole
`,

  quiz: [
    {
      question: 'What happens when a user has Allow in one policy but explicit Deny in another?',
      options: ['Allow wins', 'Explicit Deny ALWAYS wins', 'The most recent wins', 'Depends on creation order'],
      correct: 1,
      explanation: 'Explicit Deny ALWAYS overrides Allow, regardless of where the Deny is (identity, resource, SCP, boundary). This is the most important IAM rule.',
      reference: 'Policy evaluation: Deny > SCP > Resource > Boundary > Identity.'
    },
    {
      question: 'What are Permissions Boundaries in IAM?',
      options: ['API rate limits', 'Maximum permission scope for a user/role', 'Spending limits', 'Resource limits per account'],
      correct: 1,
      explanation: 'Permissions Boundaries define the MAXIMUM permission scope. Effective permission is the INTERSECTION of identity policy and permissions boundary.',
      reference: 'Useful for delegation: admins create roles with pre-defined boundaries.'
    },
    {
      question: 'Which service replaces manual SAML federation for multi-account SSO?',
      options: ['Amazon Cognito', 'AWS IAM Identity Center', 'AWS STS', 'AWS Directory Service'],
      correct: 1,
      explanation: 'IAM Identity Center (formerly AWS SSO) provides centralized single sign-on for all Organization accounts, with external IdP integration.',
      reference: 'Identity Center > manual SAML federation for multi-account SSO.'
    },
    {
      question: 'Which AWS service shares resources (Transit Gateway, subnets) between accounts?',
      options: ['VPC Peering', 'AWS RAM (Resource Access Manager)', 'AWS Organizations', 'AWS PrivateLink'],
      correct: 1,
      explanation: 'AWS RAM allows sharing resources between accounts within or outside the Organization without duplicating.',
      reference: 'RAM shares resources. PrivateLink shares services. VPC Peering connects networks.'
    },
    {
      question: 'What is the difference between Cognito User Pools and Identity Pools?',
      options: ['User Pools store files, Identity Pools store users', 'User Pools manage authentication, Identity Pools provide AWS credentials', 'They are the same', 'User Pools are free, Identity Pools are paid'],
      correct: 1,
      explanation: 'User Pools = authentication (sign-up, sign-in, JWT tokens). Identity Pools = exchange tokens for temporary AWS credentials for direct service access.',
      reference: 'User Pool -> JWT token -> Identity Pool -> AWS credentials -> S3, DynamoDB.'
    },
    {
      question: 'Do SCPs in AWS Organizations affect the Management Account?',
      options: ['Yes, they affect all accounts', 'No, Management Account is an exception', 'Only if explicitly configured', 'Only for billing services'],
      correct: 1,
      explanation: 'SCPs do NOT affect the Management Account (Organization root). This is why you should never use the Management Account for workloads.',
      reference: 'Best practice: Management Account only for Organizations, billing, and audit.'
    },
    {
      question: 'What is the correct pattern for cross-account access between Account A and Account B?',
      options: ['Share access keys from Account B', 'Account A assumes Role in Account B via STS', 'Create VPC Peering between accounts', 'Use the same IAM Policy in both'],
      correct: 1,
      explanation: 'Cross-account: Account B creates Role with Trust Policy for Account A. User in Account A calls sts:AssumeRole to get temporary credentials.',
      reference: 'NEVER share access keys. Always use AssumeRole for cross-account.'
    },
    {
      question: 'What is a Resource-based Policy?',
      options: ['Policy attached to an IAM user', 'Policy attached directly to an AWS resource', 'Billing policy', 'Network policy'],
      correct: 1,
      explanation: 'Resource-based policies are attached to resources (S3 bucket policy, SQS queue policy). They define who can access that specific resource.',
      reference: 'Resource policies can allow cross-account access WITHOUT AssumeRole.'
    }
  ],

  flashcards: [
    { front: 'What is the most important IAM policy evaluation rule?', back: 'Explicit Deny ALWAYS overrides Allow. If any policy (identity, resource, SCP, boundary, session) has an explicit Deny, access is denied regardless of how many Allows exist.' },
    { front: 'What are Permissions Boundaries?', back: 'Define the MAXIMUM permission scope for a user/role. Effective permission = INTERSECTION of identity policy and boundary. Useful for secure delegation.' },
    { front: 'What is AWS IAM Identity Center?', back: 'Formerly AWS SSO. Centralized single sign-on for multiple AWS accounts and apps. Integrates with IdPs (AD, Okta). Permission Sets define per-account access.' },
    { front: 'How does cross-account access work?', back: 'Account B creates Role with Trust Policy for Account A. User in A calls sts:AssumeRole to get temp credentials. NEVER share access keys. Credentials auto-expire.' },
    { front: 'What is the difference between Cognito User Pools and Identity Pools?', back: 'User Pools = authentication (sign-up/in, MFA, JWT). Identity Pools = federation with AWS (exchange token for temp credentials for S3, DynamoDB).' },
    { front: 'What are SCPs and how do they work?', back: 'Service Control Policies: guardrails limiting MAXIMUM permissions for Organization accounts. Do NOT grant permissions. Do NOT affect Management Account. Hierarchical inheritance.' },
    { front: 'What is AWS RAM?', back: 'Resource Access Manager: shares resources (Transit Gateway, subnets, License Manager) between accounts without duplicating. Works within or outside Organization.' },
    { front: 'What are the IAM Policy types?', back: 'Identity-based (user/group/role), Resource-based (S3 bucket, SQS queue), Permissions Boundary (max scope), SCP (org guardrail), Session Policy (temp credentials).' }
  ],

  lab: {
    scenario: 'Configure advanced IAM with cross-account access and granular policies.',
    objective: 'Implement cross-account access, permissions boundaries, and understand policy evaluation.',
    duration: '20-30 minutes',
    steps: [
      {
        title: 'Analyze Policy Evaluation',
        instruction: 'Given a user with: Identity policy Allow s3:*, SCP Deny s3:DeleteObject, Resource policy Allow s3:GetObject. Can the user delete objects?',
        hints: ['Explicit Deny always wins', 'SCP is a deny ceiling'],
        solution: '```\nAnalysis:\n1. Identity policy: Allow s3:* (includes DeleteObject)\n2. SCP: Deny s3:DeleteObject (EXPLICIT DENY)\n3. Resource policy: Allow s3:GetObject\n\nResult: DENY for s3:DeleteObject\nReason: SCP has explicit Deny, which ALWAYS overrides Allow\n\nUser can: s3:GetObject, s3:PutObject, s3:ListBucket\nUser CANNOT: s3:DeleteObject (blocked by SCP)\n```',
        verify: '```bash\n# Use IAM Policy Simulator to verify:\n# Console > IAM > Policy Simulator\n# Select user, test s3:DeleteObject\n# Expected result: Implicitly Denied (SCP override)\n```'
      },
      {
        title: 'Configure Cross-Account Access',
        instruction: 'Create a Role in Account B that Account A can assume to read S3. Configure trust policy and permissions.',
        hints: ['Trust policy defines WHO can assume', 'Permissions policy defines WHAT they can do'],
        solution: '```bash\n# In Account B: create Role\naws iam create-role --role-name CrossAccountS3Reader \\\n  --assume-role-policy-document file://trust-policy.json\n\naws iam attach-role-policy --role-name CrossAccountS3Reader \\\n  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess\n\n# In Account A: user assumes the Role\naws sts assume-role \\\n  --role-arn arn:aws:iam::ACCOUNT_B:role/CrossAccountS3Reader \\\n  --role-session-name cross-account-session\n```',
        verify: '```bash\n# Verify role exists and trust policy is correct:\naws iam get-role --role-name CrossAccountS3Reader\n# Trust policy should list Account A as principal\n# AssumeRole should return temporary credentials\n```'
      },
      {
        title: 'Create Permissions Boundary',
        instruction: 'Create a Permissions Boundary limiting a developer to only S3 and DynamoDB, even if identity policy grants more.',
        hints: ['Boundary defines the ceiling', 'Effective permission = intersection of identity + boundary'],
        solution: '```bash\n# Create boundary policy allowing only S3 and DynamoDB\naws iam create-policy --policy-name DevBoundary \\\n  --policy-document file://boundary.json\n\n# Attach as boundary (not as regular policy)\naws iam put-user-permissions-boundary \\\n  --user-name dev-user \\\n  --permissions-boundary arn:aws:iam::ACCOUNT:policy/DevBoundary\n\n# Even with AdministratorAccess,\n# user can only use S3 and DynamoDB (intersection)\n```',
        verify: '```bash\n# Verify boundary attached:\naws iam get-user --user-name dev-user\n# PermissionsBoundary should show DevBoundary ARN\n# Test: user tries ec2:DescribeInstances -> Access Denied\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Effective Permissions with Boundary + Policy',
      difficulty: 'hard',
      symptom: 'Permissions Boundary applied but user can still access services outside the boundary.',
      diagnosis: '```\nEffective Permission = INTERSECTION of:\n  Identity Policy AND Permissions Boundary\n\nIf Identity Policy: Allow ec2:*, s3:*, dynamodb:*\nAnd Boundary: Allow s3:*, dynamodb:*\n\nResult: Allow only s3:* and dynamodb:*\n(ec2 is in identity but NOT in boundary = DENY)\n\nCheck:\n1. Is boundary correctly attached?\n   aws iam get-user --user-name USER\n\n2. Are there resource-based policies?\n   Resource policies IGNORE boundaries\n   (e.g., S3 bucket policy can allow direct access)\n```',
      solution: 'Resource-based policies are evaluated SEPARATELY and can allow access even with restrictive boundary. For full security, combine boundary + SCP + resource policies.'
    },
    {
      title: 'Cross-Account AssumeRole Access Denied',
      difficulty: 'medium',
      symptom: 'sts:AssumeRole fails with Access Denied despite trust policy configured.',
      diagnosis: '```\nVerification checklist:\n\n1. Trust Policy on Role (Account B):\n   Correct principal? (Account A ARN or user/role)\n   Action: sts:AssumeRole?\n\n2. Identity Policy on User (Account A):\n   Allow sts:AssumeRole on Account B Role ARN?\n\n3. SCP (if using Organizations):\n   SCP allows sts:AssumeRole?\n\n4. Permissions Boundary (if applied):\n   Boundary allows sts:AssumeRole?\n\n5. External ID (if required):\n   --external-id parameter correct?\n```',
      solution: 'Cross-account requires BOTH sides: Trust policy on the Role (who can assume) AND identity policy on the user (permission to assume). Check ARNs, account IDs, and conditions in both policies.'
    }
  ]
};
