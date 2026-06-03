window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-secure-arch/data-protection'] = {
  theory: `# Data Protection & Encryption

## Exam Relevance
> **Design Secure Architectures** is worth **30%** of SAA-C03. Encryption (at-rest/in-transit), key management, and secrets handling are heavily tested.

## AWS KMS (Key Management Service)

Central service for creating and managing **encryption keys** across AWS.

### Key Types

| Type | Management | Use Case |
|------|-----------|----------|
| **AWS Owned Keys** | AWS manages entirely | Default encryption (S3, EBS) |
| **AWS Managed Keys** (aws/service) | AWS manages, visible in KMS | Per-service default (aws/s3, aws/ebs) |
| **Customer Managed Keys (CMK)** | You create, you control | Full control: rotation, policies, grants |

### Key Policies and Grants
- **Key Policy**: resource-based policy (required, every key has one)
- **Grants**: temporary, programmatic delegation without changing key policy
- **ViaService condition**: restrict key usage to specific AWS services

### Envelope Encryption
KMS encrypts data keys, data keys encrypt data. For objects > 4 KB, SDK uses envelope encryption automatically via GenerateDataKey API.

### Key Rotation
- **AWS Managed**: automatic rotation every year (mandatory)
- **Customer Managed**: optional automatic rotation (annual), or manual rotation
- Old key material preserved for decryption of old data

### Multi-Region Keys
- Replicate keys across Regions with same key material but different ARN
- Use case: encrypted S3 cross-Region replication, DynamoDB global tables, DR

## AWS CloudHSM

**Dedicated hardware security module** — FIPS 140-2 Level 3 validated.

| Aspect | KMS | CloudHSM |
|--------|-----|----------|
| **Tenancy** | Multi-tenant (shared) | Single-tenant (dedicated) |
| **Compliance** | FIPS 140-2 Level 2 | FIPS 140-2 Level 3 |
| **Key Access** | AWS can access metadata | AWS has NO access to your keys |
| **Integration** | Native AWS service integration | Custom apps, Oracle TDE, SSL offloading |
| **HA** | Managed by AWS | You deploy across 2+ AZs |

## AWS Certificate Manager (ACM)

- **Public certificates**: free, auto-renewal for integrated services (ALB, CloudFront, API Gateway)
- **Private CA**: create internal PKI (\\$400/month per CA)
- ACM certificates CANNOT be used on EC2 directly — use via ALB/NLB/CloudFront

## Secrets Manager vs Parameter Store

| Feature | Secrets Manager | SSM Parameter Store |
|---------|----------------|---------------------|
| **Auto-rotation** | Built-in (Lambda) | No native rotation |
| **RDS integration** | Native auto-rotation | Manual |
| **Cost** | \\$0.40/secret/month | Free (Standard) / \\$0.05 (Advanced) |
| **Size limit** | 64 KB | 4 KB (Standard) / 8 KB (Advanced) |
| **Cross-account** | Via resource policy | No native cross-account |

## Encryption Patterns

### At-Rest Encryption

| Service | Options |
|---------|---------|
| **S3** | SSE-S3 (AES-256, default), SSE-KMS (audit trail), SSE-C (you provide key), DSSE-KMS (double encryption) |
| **EBS** | AES-256 via KMS. Enable default encryption per Region. Encrypted snapshots stay encrypted. |
| **RDS** | KMS encryption at creation only (cannot enable later). Read replicas inherit encryption. |
| **DynamoDB** | AWS owned key (default) or Customer Managed Key |

### In-Transit Encryption
- **TLS/SSL**: enforced via HTTPS endpoints
- **CloudFront**: viewer protocol policy (HTTPS only, redirect HTTP to HTTPS)
- **RDS**: force SSL via parameter group (rds.force_ssl=1)

## Common Exam Mistakes

- Thinking KMS keys can be shared across Regions without multi-Region keys
- Confusing Secrets Manager (rotation) with Parameter Store (config)
- Forgetting ACM certs cannot be used directly on EC2
- Not knowing SSE-KMS provides CloudTrail audit trail (SSE-S3 does not)
`,

  quiz: [
    {
      question: 'Which S3 encryption option provides an audit trail via CloudTrail?',
      options: ['SSE-S3', 'SSE-KMS', 'SSE-C', 'Client-side encryption'],
      correct: 1,
      explanation: 'SSE-KMS logs every use of the encryption key in CloudTrail. SSE-S3 uses Amazon-managed keys with no individual key-level audit logging.',
      reference: 'SSE-KMS = audit trail. SSE-S3 = simpler but no key-level audit.'
    },
    {
      question: 'What is the key difference between KMS and CloudHSM?',
      options: ['KMS is free, CloudHSM is paid', 'KMS is multi-tenant, CloudHSM is single-tenant dedicated hardware', 'CloudHSM only works with S3', 'KMS requires manual key rotation'],
      correct: 1,
      explanation: 'KMS is multi-tenant (FIPS 140-2 Level 2). CloudHSM provides single-tenant dedicated HSMs (FIPS 140-2 Level 3) where AWS has NO access to your keys.',
      reference: 'CloudHSM for: FIPS Level 3, custom crypto, Oracle TDE, SSL offloading.'
    },
    {
      question: 'Which service provides automatic rotation of RDS database passwords?',
      options: ['AWS KMS', 'SSM Parameter Store', 'AWS Secrets Manager', 'AWS Config'],
      correct: 2,
      explanation: 'Secrets Manager has native integration with RDS for automatic password rotation using Lambda. Parameter Store has no built-in rotation capability.',
      reference: 'Secrets Manager = rotation. Parameter Store = config storage (no rotation).'
    },
    {
      question: 'Can ACM public certificates be used directly on EC2 instances?',
      options: ['Yes, install via SSM', 'Yes, download from ACM', 'No, they only work with integrated services like ALB and CloudFront', 'Yes, with CloudHSM integration'],
      correct: 2,
      explanation: 'ACM public certificates cannot be exported. They work only with ALB, NLB, CloudFront, API Gateway. For EC2, use a third-party CA or ACM Private CA.',
      reference: 'ACM public certs: ALB, NLB, CloudFront, API GW only. NOT EC2.'
    },
    {
      question: 'What is envelope encryption in KMS?',
      options: ['Encrypting the key policy', 'Using KMS to encrypt a data key, which then encrypts the actual data', 'Double encryption with two KMS keys', 'Encrypting S3 bucket policies'],
      correct: 1,
      explanation: 'Envelope encryption: KMS encrypts a data key (small). The data key encrypts actual data (large). Avoids sending large data to KMS (4 KB API limit).',
      reference: 'GenerateDataKey API returns plaintext + encrypted data key.'
    },
    {
      question: 'How do KMS multi-Region keys work?',
      options: ['Same key is automatically available everywhere', 'You replicate the key to other Regions with same material but different ARN', 'Keys are shared via S3 cross-Region replication', 'Multi-Region is only for CloudHSM'],
      correct: 1,
      explanation: 'Multi-Region keys share the same key material but have different ARNs per Region. Encrypt in one Region, decrypt in another without re-encryption.',
      reference: 'Same key material, different ARN. Use for cross-Region S3 replication, DynamoDB global tables.'
    },
    {
      question: 'What happens when you enable EBS default encryption for a Region?',
      options: ['Existing volumes are encrypted', 'Only new EBS volumes and snapshots are encrypted automatically', 'All EC2 instances are encrypted', 'It enables S3 encryption too'],
      correct: 1,
      explanation: 'EBS default encryption applies to NEW volumes and snapshots in that Region. Existing unencrypted volumes are unaffected — you must create an encrypted copy.',
      reference: 'Default encryption is per-Region. Existing volumes need copy to encrypt.'
    },
    {
      question: 'Which SSM Parameter Store tier supports parameters up to 8 KB?',
      options: ['Standard (free)', 'Advanced (paid)', 'Premium', 'Enterprise'],
      correct: 1,
      explanation: 'Standard tier: up to 4 KB, free, 10,000 params. Advanced tier: up to 8 KB, \\$0.05/param/month, parameter policies, and higher throughput.',
      reference: 'Standard: 4 KB, free. Advanced: 8 KB, \\$0.05/month, parameter policies.'
    }
  ],

  flashcards: [
    { front: 'What are the 3 KMS key types?', back: 'AWS Owned Keys (fully managed, invisible). AWS Managed Keys (aws/service, visible, auto-rotation). Customer Managed Keys (you create, full control, optional rotation).' },
    { front: 'What is envelope encryption?', back: 'KMS encrypts a data key (GenerateDataKey). Data key encrypts the actual data. Avoids sending large data to KMS (4 KB API limit). SDK handles automatically.' },
    { front: 'KMS vs CloudHSM?', back: 'KMS: multi-tenant, FIPS 140-2 Level 2, AWS-managed. CloudHSM: single-tenant dedicated HSM, FIPS 140-2 Level 3, YOU manage keys, AWS has no access.' },
    { front: 'Secrets Manager vs Parameter Store?', back: 'Secrets Manager: auto-rotation (Lambda), RDS integration, \\$0.40/secret/mo, cross-account. Parameter Store: config+secrets, no rotation, free (Standard 4KB) or \\$0.05 (Advanced 8KB).' },
    { front: 'S3 server-side encryption options?', back: 'SSE-S3 (AES-256, default), SSE-KMS (KMS key, CloudTrail audit), SSE-C (customer-provided key), DSSE-KMS (double encryption). Client-side also possible.' },
    { front: 'Can ACM certs be used on EC2?', back: 'No. ACM public certs cannot be exported. Use with ALB, NLB, CloudFront, API Gateway only. For EC2, use third-party CA or ACM Private CA (\\$400/month).' },
    { front: 'What are KMS multi-Region keys?', back: 'Keys with same key material replicated across Regions (different ARNs). Encrypt in one Region, decrypt in another. For: S3 cross-Region replication, DynamoDB global tables, DR.' },
    { front: 'How to enforce in-transit encryption for RDS?', back: 'Set rds.force_ssl=1 in the DB parameter group. Requires all connections to use SSL/TLS. Download RDS CA bundle for client verification.' }
  ],

  lab: {
    scenario: 'Configure encryption at rest and manage secrets for an application architecture.',
    objective: 'Practice KMS key management, S3 encryption, and Secrets Manager rotation.',
    duration: '20-30 minutes',
    steps: [
      {
        title: 'Create and Use a Customer Managed Key',
        instruction: 'Create a KMS CMK, add an alias, and configure it as the default encryption for an S3 bucket.',
        hints: ['aws kms create-key returns KeyId', 'Use --server-side-encryption aws:kms on S3'],
        solution: '```bash\n# Create CMK\naws kms create-key --description "My S3 encryption key" \\\n  --key-usage ENCRYPT_DECRYPT --origin AWS_KMS\n\n# Create alias\naws kms create-alias --alias-name alias/my-s3-key \\\n  --target-key-id <key-id>\n\n# Set S3 bucket default encryption\naws s3api put-bucket-encryption --bucket my-bucket \\\n  --server-side-encryption-configuration \\\n  \'{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms","KMSMasterKeyID":"alias/my-s3-key"},"BucketKeyEnabled":true}]}\'\n```',
        verify: '```bash\n# Verify key\naws kms describe-key --key-id alias/my-s3-key\n# Expected: KeyState = Enabled\n\n# Verify bucket encryption\naws s3api get-bucket-encryption --bucket my-bucket\n# Expected: SSEAlgorithm = aws:kms\n```'
      },
      {
        title: 'Store and Rotate a Secret',
        instruction: 'Create a database credential in Secrets Manager and configure automatic rotation every 30 days.',
        hints: ['Secrets Manager has create-secret and rotate-secret APIs', 'Rotation needs a Lambda function ARN'],
        solution: '```bash\n# Create secret\naws secretsmanager create-secret \\\n  --name prod/db/credentials \\\n  --secret-string \'{"username":"admin","password":"MyP@ss123"}\'\n\n# Enable rotation\naws secretsmanager rotate-secret \\\n  --secret-id prod/db/credentials \\\n  --rotation-lambda-arn arn:aws:lambda:REGION:ACCT:function:SecretsRotation \\\n  --rotation-rules AutomaticallyAfterDays=30\n```',
        verify: '```bash\naws secretsmanager describe-secret --secret-id prod/db/credentials\n# Expected: RotationEnabled = true\n# RotationRules.AutomaticallyAfterDays = 30\n```'
      },
      {
        title: 'Compare SSE-S3 vs SSE-KMS',
        instruction: 'Upload an object with SSE-S3 and another with SSE-KMS. Compare the encryption metadata and CloudTrail audit differences.',
        hints: ['--server-side-encryption AES256 for SSE-S3', '--server-side-encryption aws:kms for SSE-KMS'],
        solution: '```bash\n# Upload with SSE-S3\naws s3api put-object --bucket my-bucket --key test-s3.txt \\\n  --body file.txt --server-side-encryption AES256\n\n# Upload with SSE-KMS\naws s3api put-object --bucket my-bucket --key test-kms.txt \\\n  --body file.txt --server-side-encryption aws:kms \\\n  --ssekms-key-id alias/my-s3-key\n\n# SSE-KMS: CloudTrail logs Encrypt/Decrypt events\n# SSE-S3: no key-level CloudTrail events\n```',
        verify: '```bash\naws s3api head-object --bucket my-bucket --key test-s3.txt\n# Expected: ServerSideEncryption = AES256\n\naws s3api head-object --bucket my-bucket --key test-kms.txt\n# Expected: ServerSideEncryption = aws:kms\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'KMS Key Policy vs IAM Policy Conflict',
      difficulty: 'hard',
      symptom: 'User has IAM permissions for kms:Encrypt but gets Access Denied.',
      diagnosis: '```\nKMS uses dual authorization:\n\n1. Key policy MUST allow the account root principal\n   If missing, IAM policies are completely IGNORED\n\n2. Default key policy allows root principal\n   Then IAM policies can grant KMS permissions\n\n3. If key policy lists specific principals only\n   Only those principals can use the key\n\nCheck:\n  aws kms get-key-policy --key-id KEY --policy-name default\n  Look for: Principal: {"AWS": "arn:aws:iam::ACCOUNT:root"}\n```',
      solution: 'The key policy MUST allow the account root principal for IAM policies to take effect. If the key policy only lists specific users/roles, only those can access the key regardless of IAM permissions.'
    },
    {
      title: 'Cannot Encrypt Existing EBS Volume',
      difficulty: 'medium',
      symptom: 'Need to encrypt an existing unencrypted EBS volume but no in-place option exists.',
      diagnosis: '```\nEBS encryption cannot be changed in-place:\n\n1. Create snapshot of unencrypted volume\n2. Copy snapshot WITH encryption enabled\n3. Create new volume from encrypted snapshot\n4. Stop instance, swap volumes\n\nCommands:\n  aws ec2 create-snapshot --volume-id vol-xxx\n  aws ec2 copy-snapshot --source-snapshot-id snap-xxx \\\n    --encrypted --kms-key-id alias/my-key\n  aws ec2 create-volume --snapshot-id snap-encrypted \\\n    --availability-zone us-east-1a\n```',
      solution: 'Create snapshot > copy with encryption > create new encrypted volume > swap on instance. Enable default EBS encryption per Region to prevent future unencrypted volumes.'
    }
  ]
};
