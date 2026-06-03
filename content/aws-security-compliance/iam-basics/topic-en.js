window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-security-compliance/iam-basics'] = {
  theory: `# IAM Fundamentals

## Exam Relevance
> The **Security and Compliance** domain is worth **30%** of the CLF-C02 — the heaviest! IAM is the most important AWS service and appears in almost every security question.

## What is IAM?

**AWS Identity and Access Management (IAM)** is the service that controls WHO can access WHAT in your AWS account. It is global — it does not belong to any specific Region.

### Key Characteristics
- **Free** — no additional costs
- **Global** — users and roles work across all Regions
- **Granular** — detailed control by action, resource, and condition
- **Secure by default** — new users have NO permissions

## IAM Components

### Root Account
- Created automatically with the AWS account
- Has TOTAL and UNRESTRICTED access to all resources
- **NEVER use for day-to-day tasks**
- Protect with MFA immediately
- Use only for: creating first IAM user, changing support plan, closing account

### Users
- Represent a person or application
- Have credentials (password for console, access keys for CLI/API)
- Principle: **one person = one IAM user**
- New users have no permissions (implicit deny)

### Groups
- Collection of IAM users
- Apply policies to multiple users at once
- Example: "Developers" group, "Admins" group
- A user can belong to multiple groups
- **Groups CANNOT contain other groups**

### Policies
- JSON documents that define permissions
- Can be attached to Users, Groups, or Roles
- Types: AWS Managed, Customer Managed, Inline

\\\`\\\`\\\`json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-bucket/*"
    }
  ]
}
\\\`\\\`\\\`

### Roles
- Identity with temporary permissions
- NO permanent credentials (no password or access keys)
- Assumed by: AWS services, users, external accounts
- Common use cases:
  - EC2 instance assuming role to access S3
  - Lambda function assuming role to access DynamoDB
  - Cross-account access

## MFA — Multi-Factor Authentication

MFA adds an extra security layer beyond the password:

| MFA Type | Description |
|----------|-------------|
| **Virtual MFA** | Mobile app (Google Authenticator, Authy) |
| **Hardware MFA** | Physical device (YubiKey, Gemalto) |
| **U2F Security Key** | USB key (YubiKey U2F) |

**Recommendation**: Enable MFA on the root account AND all IAM users.

## IAM Best Practices

1. **Never use root account** for daily tasks
2. **Enable MFA** on root account and all users
3. **Least privilege** — grant only necessary permissions
4. **Use Groups** to assign permissions (not directly on users)
5. **Use Roles** for AWS services (never access keys on EC2)
6. **Rotate credentials** regularly
7. **Use IAM Access Analyzer** to identify excessive permissions
8. **Create strong password policy** (minimum length, complexity, rotation)

## IAM Access Analyzer

Service that analyzes policies and identifies resources shared with external entities. Helps find excessive permissions and unintended access.

## Credential Report and Access Advisor

- **Credential Report**: report of all users and credential status (account-level)
- **Access Advisor**: shows permissions granted to a user and when they were last used (user-level)

## Common Mistakes

- Using root account for daily tasks
- Not enabling MFA on root account
- Granting permissions directly to users instead of groups
- Using access keys on EC2 instead of IAM Roles
- Not following the principle of least privilege
`,

  quiz: [
    {
      question: 'What is the best practice for protecting the root account?',
      options: ['Delete the root account', 'Enable MFA and do not use for daily tasks', 'Share credentials with the team', 'Use only for application deployment'],
      correct: 1,
      explanation: 'The root account cannot be deleted. Best practice is to enable MFA immediately and create IAM users for daily tasks. Root should only be used for tasks that require root.',
      reference: 'Root-only tasks: create first IAM user, change support plan.'
    },
    {
      question: 'Which IAM component allows granting temporary permissions to AWS services?',
      options: ['IAM User', 'IAM Group', 'IAM Role', 'IAM Policy'],
      correct: 2,
      explanation: 'IAM Roles provide temporary credentials. They are ideal for AWS services (EC2 accessing S3) as they have no permanent credentials.',
      reference: 'Roles are preferred over access keys for AWS services.'
    },
    {
      question: 'Can IAM Groups contain other groups?',
      options: ['Yes, up to 3 levels of nesting', 'Yes, with no limit', 'No, groups can only contain users', 'Yes, if in the same account'],
      correct: 2,
      explanation: 'IAM Groups can only contain IAM Users. Groups CANNOT contain other groups (no nesting).',
      reference: 'Frequent exam limitation: groups are flat, no hierarchy.'
    },
    {
      question: 'Which security principle states that users should only have the permissions they need?',
      options: ['Defense in depth', 'Least privilege', 'Zero trust', 'Separation of duties'],
      correct: 1,
      explanation: 'Least privilege is the principle of granting only the permissions needed to perform a task, nothing more.',
      reference: 'Applies to users, groups, and roles. Use Access Advisor to review.'
    },
    {
      question: 'How should an EC2 instance access other AWS services (e.g., S3)?',
      options: ['Hardcoded access keys in code', 'Access keys in environment variables', 'IAM Role attached to the instance', 'Root account credentials'],
      correct: 2,
      explanation: 'IAM Roles are the secure way to grant permissions to EC2. Credentials are temporary and automatically rotated. Never use access keys on EC2.',
      reference: 'Instance Profile is the wrapper that attaches the Role to EC2.'
    },
    {
      question: 'Which IAM tool shows when a user permissions were last used?',
      options: ['Credential Report', 'IAM Access Advisor', 'IAM Access Analyzer', 'CloudTrail'],
      correct: 1,
      explanation: 'IAM Access Advisor shows permissions granted and when they were last used (user-level). Credential Report shows credential status for all users (account-level).',
      reference: 'Use Access Advisor to implement least privilege — remove unused permissions.'
    },
    {
      question: 'What is the default behavior of a newly created IAM user?',
      options: ['Full access to all services', 'Read-only access', 'No permissions (implicit deny)', 'Console access only'],
      correct: 2,
      explanation: 'New IAM users have NO permissions by default (implicit deny). All permissions must be explicitly granted via policies.',
      reference: 'IAM principle: everything is denied until explicitly allowed.'
    },
    {
      question: 'Which MFA type is a mobile app like Google Authenticator?',
      options: ['Hardware MFA', 'Virtual MFA device', 'U2F Security Key', 'SMS MFA'],
      correct: 1,
      explanation: 'Virtual MFA uses apps like Google Authenticator or Authy on your phone to generate TOTP (Time-based One-Time Password) codes.',
      reference: 'AWS recommends Virtual MFA for users and Hardware MFA key for root account.'
    }
  ],

  flashcards: [
    { front: 'What are the 4 main IAM components?', back: 'Users (people/apps), Groups (collection of users), Roles (temporary permissions for services), and Policies (JSON documents with permissions). IAM is global and free.' },
    { front: 'What is the root account and how to protect it?', back: 'Account created with the AWS account, has total unrestricted access. Protection: enable MFA immediately, never use for daily tasks, create IAM users for everyday use.' },
    { front: 'What is the difference between IAM User and IAM Role?', back: 'User: identity with permanent credentials (password, access keys), represents a person. Role: identity with temporary credentials, no fixed credentials, assumed by services/users.' },
    { front: 'What is the Least Privilege principle?', back: 'Grant only the permissions necessary to perform a task, nothing more. Apply to users, groups, and roles. Use IAM Access Advisor to review unused permissions.' },
    { front: 'What is the difference between Credential Report and Access Advisor?', back: 'Credential Report: account-level report with credential status of ALL users. Access Advisor: user-level, shows permissions granted and when they were last used.' },
    { front: 'What are the types of IAM Policies?', back: 'AWS Managed (created by AWS, e.g., AdministratorAccess). Customer Managed (created by you, reusable). Inline (embedded directly in a user/group/role, not reusable).' },
    { front: 'Why use IAM Roles instead of access keys on EC2?', back: 'Roles provide temporary, automatically rotated credentials. Access keys are permanent and can leak. Instance Profile attaches the Role to EC2 automatically.' },
    { front: 'What are IAM best practices?', back: 'Never use root daily, MFA on everything, least privilege, use groups for permissions, roles for AWS services, rotate credentials, strong password policy.' }
  ],

  lab: {
    scenario: 'You need to set up IAM securely for a development team.',
    objective: 'Create users, groups, and IAM policies following best practices.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Create IAM Group and Users',
        instruction: 'Create a "Developers" group and 2 IAM users. Attach the AmazonS3ReadOnlyAccess policy to the group.',
        hints: ['IAM > User Groups > Create group', 'Select the AWS managed policy'],
        solution: '```bash\n# Create group\naws iam create-group --group-name Developers\n\n# Attach policy to group\naws iam attach-group-policy --group-name Developers \\\n  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess\n\n# Create users\naws iam create-user --user-name dev-user-1\naws iam create-user --user-name dev-user-2\n\n# Add users to group\naws iam add-user-to-group --group-name Developers --user-name dev-user-1\naws iam add-user-to-group --group-name Developers --user-name dev-user-2\n```',
        verify: '```bash\n# Verify group and members\naws iam get-group --group-name Developers\n# Expected output: GroupName: Developers, 2 users listed\n\n# Verify group policies\naws iam list-attached-group-policies --group-name Developers\n# Expected output: AmazonS3ReadOnlyAccess\n```'
      },
      {
        title: 'Create IAM Role for EC2',
        instruction: 'Create an IAM Role that allows EC2 instances to access S3. Use the trust policy for EC2.',
        hints: ['The trust policy defines WHO can assume the role', 'The EC2 service is ec2.amazonaws.com'],
        solution: '```bash\n# Create trust policy\ncat > trust-policy.json << EOF\n{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Effect": "Allow",\n      "Principal": { "Service": "ec2.amazonaws.com" },\n      "Action": "sts:AssumeRole"\n    }\n  ]\n}\nEOF\n\n# Create role\naws iam create-role --role-name EC2-S3-Role \\\n  --assume-role-policy-document file://trust-policy.json\n\n# Attach S3 access policy\naws iam attach-role-policy --role-name EC2-S3-Role \\\n  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess\n```',
        verify: '```bash\n# Verify role\naws iam get-role --role-name EC2-S3-Role\n# Expected: RoleName: EC2-S3-Role, trust policy with ec2.amazonaws.com\n\n# Verify role policies\naws iam list-attached-role-policies --role-name EC2-S3-Role\n# Expected: AmazonS3ReadOnlyAccess\n```'
      },
      {
        title: 'Generate Credential Report',
        instruction: 'Generate and analyze the account Credential Report. Identify users without MFA enabled.',
        hints: ['IAM > Credential Report > Download', 'The report is a CSV with status columns'],
        solution: '```bash\n# Generate report\naws iam generate-credential-report\n\n# Download report (base64)\naws iam get-credential-report --output text --query Content | base64 --decode > report.csv\n\n# Analyze (look for mfa_active = false)\ncat report.csv | head -5\n```',
        verify: '```bash\n# Verify report content\n# Important columns: user, mfa_active, access_key_1_active\n# Expected output: CSV with all account users\n# Identify lines with mfa_active=false\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Access Denied Despite Allow Policy',
      difficulty: 'medium',
      symptom: 'User has a policy with Allow but receives Access Denied when accessing a resource.',
      diagnosis: '```\nCheck policy evaluation order:\n1. Explicit Deny (in any policy) -> ALWAYS denies\n2. SCP (Organizations) -> can restrict\n3. Resource-based policy -> allows or denies\n4. Identity-based policy -> Allow\n5. Permissions boundary -> can restrict\n6. Session policy -> can restrict\n\nIf ANY policy has an explicit Deny, access is denied\neven if another policy has Allow.\n```',
      solution: 'Check if there is an explicit Deny in ANY attached policy. Explicit Deny ALWAYS overrides Allow. Use IAM Policy Simulator to test. Also check SCPs if using AWS Organizations.'
    },
    {
      title: 'Confusing Role with User on the Exam',
      difficulty: 'easy',
      symptom: 'Candidate suggests creating access keys for EC2 to access S3 instead of using a Role.',
      diagnosis: '```\nAccess Keys on EC2 (WRONG):\n- Permanent credentials\n- Can leak if instance compromised\n- Need manual rotation\n- Hardcoded in code or env vars\n\nIAM Role on EC2 (CORRECT):\n- Temporary credentials (STS)\n- Automatic rotation (~every 1h)\n- No credentials on disk/code\n- Instantly revocable\n```',
      solution: 'Always use IAM Roles for AWS services. Roles use STS (Security Token Service) to generate temporary credentials that expire automatically. Access keys are for programmatic access by PEOPLE (CLI), never by services.'
    }
  ]
};
