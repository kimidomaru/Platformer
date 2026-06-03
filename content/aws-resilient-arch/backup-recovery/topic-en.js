window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-resilient-arch/backup-recovery'] = {
  theory: `# Backup & Disaster Recovery

## Exam Relevance
> **Design Resilient Architectures** is worth **26%** of SAA-C03. DR strategies, RPO/RTO, AWS Backup, and service-specific backup features are heavily tested.

## RPO and RTO

- **RPO (Recovery Point Objective)**: maximum acceptable data loss (how much data can you lose?)
- **RTO (Recovery Time Objective)**: maximum acceptable downtime (how long to recover?)
- Lower RPO/RTO = higher cost

## Disaster Recovery Strategies

| Strategy | RPO | RTO | Cost | Description |
|----------|-----|-----|------|-------------|
| **Backup & Restore** | Hours | Hours | Lowest | Backup data to S3, restore when needed |
| **Pilot Light** | Minutes | Hours | Low | Core infrastructure always running (DB replicated), scale out on failover |
| **Warm Standby** | Seconds | Minutes | Medium | Scaled-down copy of production always running |
| **Multi-Site Active/Active** | Near-zero | Near-zero | Highest | Full production in 2+ Regions, traffic to both |

## AWS Backup

Centralized backup management across AWS services:
- **Backup Plans**: schedule (daily, weekly), retention (days/months/years), lifecycle (cold storage)
- **Backup Vaults**: encrypted containers for backups
- **Cross-Region Copy**: replicate backups to another Region for DR
- **Cross-Account Backup**: copy to a separate account (isolation from ransomware)
- **Audit Manager**: compliance reporting for backup policies
- Supported: EC2 (AMI), EBS, RDS, Aurora, DynamoDB, EFS, FSx, S3, and more

## Service-Specific Backup Features

### S3
- **Versioning**: recover overwritten/deleted objects
- **Cross-Region Replication (CRR)**: async replication to another Region
- **Object Lock**: WORM (Write Once Read Many) compliance
  - Governance mode: special permission can override
  - Compliance mode: NO ONE can delete, even root (immutable)

### RDS
- **Automated backups**: 0-35 days retention, point-in-time restore (within 5 minutes)
- **Manual snapshots**: persist until explicitly deleted
- **Cross-Region snapshot copy**: for DR in another Region
- **Export to S3**: Parquet format for analytics

### Aurora
- **Continuous backup**: automatic to S3, always available
- **Backtrack**: rewind database up to 72 hours (in-place, seconds, MySQL only)
- **Cloning**: fast copy-on-write for dev/test from production
- **Global Database**: cross-Region with <1s replication

### EBS
- **Snapshots**: incremental (stored in S3), copy to other Regions
- **Data Lifecycle Manager (DLM)**: automated snapshot schedules
- **Fast Snapshot Restore (FSR)**: eliminate latency on first access from snapshot

### DynamoDB
- **PITR (Point-in-Time Recovery)**: continuous 35-day backup, restore to any second
- **On-demand backup**: full backup persists until deleted
- **Export to S3**: query with Athena

## AWS Elastic Disaster Recovery (DRS)

Formerly CloudEndure Disaster Recovery:
- Continuous block-level replication from on-prem/cloud to AWS
- Sub-second RPO
- Automated failover and failback
- Non-disruptive testing (drill without impacting production)
- Replicates to staging area, launches full-capacity on failover

## Common Exam Mistakes

- Confusing RPO (data loss) with RTO (downtime)
- Choosing Multi-Site for a budget-conscious scenario (most expensive)
- Forgetting S3 Object Lock Compliance mode cannot be overridden
- Not knowing Aurora Backtrack is faster than restore from snapshot
- Using DRS when simple cross-Region read replicas suffice
`,

  quiz: [
    {
      question: 'What is the difference between RPO and RTO?',
      options: ['RPO is cost, RTO is time', 'RPO is maximum acceptable data loss, RTO is maximum acceptable downtime', 'RPO is backup frequency, RTO is restore speed', 'They are the same thing'],
      correct: 1,
      explanation: 'RPO: how much data can you afford to lose (measured in time). RTO: how long the system can be down. Example: RPO 1h means max 1 hour of data loss. RTO 15min means system must be back in 15 minutes.',
      reference: 'RPO = data loss tolerance. RTO = downtime tolerance. Lower = more expensive to achieve.'
    },
    {
      question: 'Which DR strategy has the lowest cost but highest RPO/RTO?',
      options: ['Multi-Site Active/Active', 'Warm Standby', 'Pilot Light', 'Backup & Restore'],
      correct: 3,
      explanation: 'Backup & Restore: cheapest strategy with hours RPO and hours RTO. You backup data to S3 and restore when disaster occurs. No infrastructure running in DR Region.',
      reference: 'Cost order: Backup&Restore < Pilot Light < Warm Standby < Multi-Site Active/Active.'
    },
    {
      question: 'What does S3 Object Lock Compliance mode do?',
      options: ['Encrypts objects', 'Prevents ANY deletion including by root account for the retention period', 'Requires MFA to delete', 'Locks the bucket policy'],
      correct: 1,
      explanation: 'Compliance mode: absolutely NO ONE can delete or overwrite the object during the retention period. Not even the root account or AWS support. For regulatory compliance (SEC, FINRA).',
      reference: 'Compliance = immutable, nobody can override. Governance = special permission can override.'
    },
    {
      question: 'What is the advantage of Aurora Backtrack over snapshot restore?',
      options: ['Backtrack is free', 'Backtrack rewinds in-place in seconds without creating a new instance', 'Backtrack works for all databases', 'Backtrack has unlimited retention'],
      correct: 1,
      explanation: 'Backtrack rewinds the database in-place in seconds (up to 72 hours). Snapshot restore creates a new DB instance and takes minutes/hours. Backtrack is Aurora MySQL only.',
      reference: 'Backtrack = in-place rewind in seconds. Snapshot restore = new instance in minutes/hours.'
    },
    {
      question: 'What does AWS Backup Cross-Account Backup protect against?',
      options: ['Region failure', 'Ransomware and compromised accounts', 'S3 data corruption', 'Network outages'],
      correct: 1,
      explanation: 'Cross-Account backup copies backups to a separate AWS account. This protects against ransomware that compromises the primary account and deletes all backups.',
      reference: 'Cross-Account = ransomware protection. Cross-Region = regional DR. Both = maximum protection.'
    },
    {
      question: 'How does RDS Point-in-Time Recovery work?',
      options: ['Manual snapshots only', 'Continuous automated backups allowing restore to any point within retention period (within 5 minutes)', 'Requires AWS Backup', 'Only works with Multi-AZ'],
      correct: 1,
      explanation: 'RDS automated backups are continuous. PITR lets you restore to any second within the retention period (0-35 days). Creates a new DB instance. Restore granularity is within 5 minutes of the current time.',
      reference: 'PITR: any second within retention period. Automated backups required. Creates new instance.'
    },
    {
      question: 'What is the Pilot Light DR strategy?',
      options: ['Full production copy in DR Region', 'Only backups stored, nothing running', 'Core infrastructure (database) always running in DR, scale out on failover', 'DNS-based failover only'],
      correct: 2,
      explanation: 'Pilot Light: minimal core infrastructure always running (e.g., database replicated). On disaster, scale out compute (launch EC2, update DNS). Minutes RPO, hours RTO.',
      reference: 'Pilot Light: DB running, compute off. Warm Standby: scaled-down full stack running.'
    },
    {
      question: 'What does EBS Fast Snapshot Restore (FSR) do?',
      options: ['Creates snapshots faster', 'Eliminates latency when creating volumes from snapshots (no initialization penalty)', 'Compresses snapshots', 'Enables cross-Region copy'],
      correct: 1,
      explanation: 'Without FSR, volumes from snapshots have initialization latency on first access. FSR pre-initializes the volume so it performs at full provisioned performance immediately. Extra cost per AZ per snapshot.',
      reference: 'FSR = full performance immediately from snapshot. Without FSR = lazy initialization on first access.'
    }
  ],

  flashcards: [
    { front: 'RPO vs RTO?', back: 'RPO (Recovery Point Objective): max acceptable DATA LOSS (time). RTO (Recovery Time Objective): max acceptable DOWNTIME. Lower RPO/RTO = higher cost. RPO 1h = lose max 1 hour of data.' },
    { front: 'DR strategies by cost/recovery?', back: 'Backup&Restore: cheapest, hours RPO/RTO. Pilot Light: DB running, min RPO, hours RTO. Warm Standby: scaled-down full stack, sec RPO, min RTO. Multi-Site Active/Active: most expensive, near-zero.' },
    { front: 'AWS Backup features?', back: 'Centralized: backup plans (schedule+retention+lifecycle), vaults, cross-Region copy, cross-account (ransomware protection), Audit Manager. Supports: EC2, EBS, RDS, Aurora, DynamoDB, EFS, FSx, S3.' },
    { front: 'S3 Object Lock modes?', back: 'Governance: special permission (s3:BypassGovernanceRetention) can override. Compliance: NO ONE can delete/overwrite during retention, not even root. For regulatory requirements (SEC, FINRA).' },
    { front: 'RDS backup options?', back: 'Automated: 0-35 days retention, PITR (any second). Manual snapshots: persist until deleted. Cross-Region copy: for DR. Export to S3: Parquet for analytics. PITR creates new instance.' },
    { front: 'Aurora backup features?', back: 'Continuous backup to S3. Backtrack: rewind up to 72h in-place (seconds, MySQL only). Cloning: copy-on-write for dev/test. Global Database: cross-Region <1s replication.' },
    { front: 'What is AWS DRS?', back: 'Elastic Disaster Recovery (ex-CloudEndure): continuous block replication on-prem/cloud to AWS. Sub-second RPO. Automated failover/failback. Non-disruptive testing. Staging area + full launch on failover.' },
    { front: 'DynamoDB backup options?', back: 'PITR: continuous 35-day backup, restore to any second. On-demand: full backup, persists until deleted. Export to S3: query with Athena. Global Tables for multi-Region active-active.' }
  ],

  lab: {
    scenario: 'Design a disaster recovery plan for a critical application.',
    objective: 'Practice configuring backups, cross-Region replication, and DR strategies.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Configure AWS Backup Plan',
        instruction: 'Create a backup plan that takes daily backups of RDS and EBS with 30-day retention and cross-Region copy.',
        hints: ['Use aws backup create-backup-plan', 'Add cross-Region copy in the backup rule'],
        solution: '```bash\n# Create backup vault in DR Region\naws backup create-backup-vault --backup-vault-name dr-vault \\\n  --region us-west-2\n\n# Create backup plan with daily schedule\naws backup create-backup-plan --backup-plan \'{"BackupPlanName":"daily-dr","Rules":[{"RuleName":"daily-rule","TargetBackupVaultName":"primary-vault","ScheduleExpression":"cron(0 3 * * ? *)","StartWindowMinutes":60,"Lifecycle":{"DeleteAfterDays":30},"CopyActions":[{"DestinationBackupVaultArn":"arn:aws:backup:us-west-2:ACCT:backup-vault:dr-vault","Lifecycle":{"DeleteAfterDays":30}}]}]}\'\n```',
        verify: '```bash\naws backup list-backup-plans\n# Expected: daily-dr plan with cross-Region copy to us-west-2\n\naws backup list-backup-jobs --by-state COMPLETED\n# Expected: recent backup jobs for assigned resources\n```'
      },
      {
        title: 'Enable S3 Cross-Region Replication',
        instruction: 'Configure S3 CRR from a source bucket (us-east-1) to a destination bucket (us-west-2) for DR.',
        hints: ['Both buckets must have versioning enabled', 'Need IAM role for replication'],
        solution: '```bash\n# Enable versioning on both buckets\naws s3api put-bucket-versioning --bucket source-bucket \\\n  --versioning-configuration Status=Enabled\naws s3api put-bucket-versioning --bucket dest-bucket \\\n  --versioning-configuration Status=Enabled --region us-west-2\n\n# Configure replication\naws s3api put-bucket-replication --bucket source-bucket \\\n  --replication-configuration \'{"Role":"arn:aws:iam::ACCT:role/s3-repl-role","Rules":[{"Status":"Enabled","Destination":{"Bucket":"arn:aws:s3:::dest-bucket"},"Filter":{}}]}\'\n```',
        verify: '```bash\naws s3api get-bucket-replication --bucket source-bucket\n# Expected: rule with Status=Enabled, destination=dest-bucket\n\n# Upload test object and verify replication\naws s3 cp test.txt s3://source-bucket/\naws s3 ls s3://dest-bucket/ --region us-west-2\n# Expected: test.txt appears in destination\n```'
      },
      {
        title: 'Enable DynamoDB Point-in-Time Recovery',
        instruction: 'Enable PITR on a DynamoDB table to allow continuous backup with 35-day recovery window.',
        hints: ['PITR is per-table', 'Restore creates a new table'],
        solution: '```bash\n# Enable PITR\naws dynamodb update-continuous-backups \\\n  --table-name Orders \\\n  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true\n\n# To restore (creates new table)\n# aws dynamodb restore-table-to-point-in-time \\\n#   --source-table-name Orders \\\n#   --target-table-name Orders-restored \\\n#   --restore-date-time 2024-01-15T10:30:00Z\n```',
        verify: '```bash\naws dynamodb describe-continuous-backups --table-name Orders\n# Expected: PointInTimeRecoveryStatus = ENABLED\n# EarliestRestorableDateTime and LatestRestorableDateTime shown\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'RDS Point-in-Time Restore to Wrong Time',
      difficulty: 'medium',
      symptom: 'Restored RDS to a point in time but the data does not match expectations.',
      diagnosis: '```\nCommon issues:\n1. Restore time in UTC (not local timezone)\n   All AWS timestamps are in UTC\n   Convert your local time to UTC before restoring\n\n2. Restore granularity: within ~5 minutes of current time\n   Cannot restore to the exact latest second\n   Latest restorable time is ~5 minutes ago\n\n3. Restored to new instance (not in-place)\n   PITR creates a NEW DB instance\n   Must update application connection string\n\n4. Retention period expired\n   Default 7 days, max 35 days\n   Cannot restore beyond retention period\n\nCheck:\n  aws rds describe-db-instances --db-instance-identifier DB \\\n    --query "DBInstances[0].LatestRestorableTime"\n```',
      solution: 'Always use UTC timestamps for restore. Check LatestRestorableTime for the most recent available point. Remember PITR creates a NEW instance (rename/swap when ready). Increase retention period to 35 days for critical databases.'
    },
    {
      title: 'Cross-Region Replication Lag Too High',
      difficulty: 'hard',
      symptom: 'S3 CRR objects taking hours to replicate to destination Region instead of minutes.',
      diagnosis: '```\nS3 CRR replication time factors:\n1. Object size: large objects take longer\n2. S3 Replication Time Control (S3 RTC):\n   Without RTC: best-effort, no SLA\n   With RTC: 99.99% within 15 minutes (extra cost)\n\n3. Check replication status:\n   aws s3api head-object --bucket source --key KEY\n   x-amz-replication-status: COMPLETED/PENDING/FAILED\n\n4. Common failures:\n   - IAM role missing permissions\n   - Destination bucket policy blocking\n   - KMS key not available in destination Region\n   - Versioning disabled on either bucket\n\nMetrics:\n  CloudWatch: s3:ReplicationLatency\n  S3 Replication Metrics (must be enabled)\n```',
      solution: 'Enable S3 Replication Time Control (RTC) for 15-minute SLA guarantee. Check IAM role permissions for both buckets. Verify KMS key is available in destination Region (or use S3-managed keys). Enable replication metrics to monitor. For existing objects, use S3 Batch Replication.'
    }
  ]
};
