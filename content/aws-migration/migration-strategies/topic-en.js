window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-migration/migration-strategies'] = {
  theory: `# Migration Strategies & Tools

## Exam Relevance
> **Design Solutions for Organizational Complexity** and **Design for New Solutions** both touch migration. The 7Rs framework, AWS Migration Hub, MGN, and DMS are heavily tested on SAP-C02.

## The 7Rs Migration Strategies

| Strategy | Description | Effort | Risk |
|----------|-------------|--------|------|
| **Retire** | Decommission — no longer needed | None | None |
| **Retain** | Keep on-premises — not ready to migrate | None | None |
| **Rehost (Lift & Shift)** | Move to EC2 without changes | Low | Low |
| **Replatform (Lift & Tinker)** | Minor optimizations: RDS instead of MySQL on EC2, Elastic Beanstalk | Medium | Low |
| **Repurchase** | Move to SaaS: Salesforce, ServiceNow instead of custom app | Low | Medium |
| **Refactor/Re-architect** | Redesign using cloud-native (microservices, serverless) | High | High |
| **Relocate** | Move VMware to AWS VMware Cloud | Low | Low |

## AWS Migration Hub

Central tracking hub for all migrations:
- Tracks progress across multiple migration tools
- Groups servers into applications
- Migration status dashboard
- Works with: Application Discovery Service, MGN, DMS, Server Migration Service

## AWS Application Discovery Service

Discover on-premises inventory before migration:
- **Agentless**: VMware vCenter API — collects VM configuration/utilization
- **Agent-based**: deeper OS-level discovery (processes, dependencies, network connections)
- Data feeds into Migration Hub and CloudEndure

## AWS Application Migration Service (MGN)

Formerly CloudEndure Migration:
- **Continuous block-level replication** from source to AWS staging area
- Source: physical, virtual, cloud (any OS)
- Non-disruptive: production continues while replicating
- **Test cutovers**: test migration without affecting production
- **Cutover**: launch converted instances, redirect traffic
- RPO sub-second, RTO minutes (fastest lift-and-shift)

### MGN vs DMS
- **MGN**: server/VM migration (full OS + applications) — lift and shift
- **DMS**: database migration only, supports schema conversion

## AWS Database Migration Service (DMS)

Migrate databases to AWS with minimal downtime:
- **Supported sources**: Oracle, SQL Server, MySQL, PostgreSQL, MongoDB, SAP, on-prem, cloud
- **Supported targets**: RDS, Aurora, Redshift, DynamoDB, S3, Kinesis, DocumentDB
- **Homogeneous**: same engine (MySQL -> MySQL) — simpler
- **Heterogeneous**: different engines (Oracle -> Aurora) — needs Schema Conversion Tool (SCT)
- **Schema Conversion Tool (SCT)**: converts DDL + stored procedures + application code
- **CDC (Change Data Capture)**: replicate ongoing changes for minimal downtime cutover
- **Multi-AZ replication instance**: HA for the migration task itself

## AWS DataSync

Online data transfer service:
- Transfer files/objects to/from: S3, EFS, FSx, NFS, SMB
- Automated scheduling, bandwidth throttling
- Encrypts data in transit (TLS) and at rest
- Faster than manual copy + verification
- Agent deployed on-premises for NFS/SMB sources
- Use for initial data migration + ongoing sync

## AWS Snow Family

Offline data transfer for large datasets or limited bandwidth:
- **Snowcone**: 8 TB storage, small/rugged, edge computing
- **Snowball Edge Storage Optimized**: 80 TB usable storage
- **Snowball Edge Compute Optimized**: EC2 instances + S3-compatible storage at edge
- **Snowmobile**: 100 PB container truck for massive migrations

### Snow vs DataSync Decision
- DataSync: good network bandwidth available (< 10 Gbps threshold)
- Snow: limited bandwidth, > 10 TB, disconnected environments

## Common Exam Mistakes

- Choosing MGN when database migration is the requirement (use DMS)
- Choosing DMS for full server migration (use MGN)
- Forgetting Schema Conversion Tool is separate from DMS (needed for heterogeneous)
- Not knowing MGN supports any OS (not just VMware)
- Choosing Snowmobile for < 10 PB (use Snowball Edge)
`,

  quiz: [
    {
      question: 'An enterprise wants to move its Oracle database to Amazon Aurora PostgreSQL with minimal downtime. Which combination of tools should they use?',
      options: ['MGN + DMS', 'DMS + Schema Conversion Tool (SCT)', 'DataSync + RDS', 'Snowball + RDS'],
      correct: 1,
      explanation: 'Oracle to Aurora PostgreSQL is heterogeneous migration. SCT converts schema and stored procedures. DMS performs the actual data migration with CDC for ongoing replication. Together they enable near-zero downtime cutover.',
      reference: 'Heterogeneous DB migration = DMS + SCT. Homogeneous = DMS only. MGN = full server, not just database.'
    },
    {
      question: 'A company wants to migrate 500 VMware VMs to AWS with minimal disruption to running applications. Which service is best suited?',
      options: ['AWS DMS', 'AWS MGN (Application Migration Service)', 'AWS DataSync', 'AWS Snow Family'],
      correct: 1,
      explanation: 'MGN: continuous block-level replication allows production to keep running. Test cutovers validate migration before actual cutover. Supports any OS on any hypervisor. Fastest lift-and-shift approach.',
      reference: 'MGN = lift-and-shift, any OS, continuous replication, test cutovers. DMS = databases only.'
    },
    {
      question: 'Which 7R strategy involves replacing a custom CRM with Salesforce?',
      options: ['Rehost', 'Replatform', 'Repurchase', 'Refactor'],
      correct: 2,
      explanation: 'Repurchase: move from a custom/packaged application to a SaaS equivalent. Example: custom CRM -> Salesforce, on-prem Exchange -> Office 365, homegrown ticketing -> ServiceNow.',
      reference: 'Repurchase = SaaS replacement. Rehost = lift&shift. Replatform = minor optimization. Refactor = re-architect.'
    },
    {
      question: 'What is the key difference between MGN Rehost and Replatform migration strategies?',
      options: ['Cost', 'Rehost migrates as-is to EC2; Replatform makes minor optimizations (e.g., replace MySQL on EC2 with RDS)', 'Replatform is faster', 'Rehost requires more skilled staff'],
      correct: 1,
      explanation: 'Rehost (lift and shift): move exact workload to EC2/IaaS without changes. Replatform (lift and tinker): take advantage of managed services — MySQL on EC2 becomes RDS, Java app on Tomcat becomes Elastic Beanstalk, but no code changes.',
      reference: 'Rehost = same on IaaS. Replatform = use managed services, no code change. Refactor = redesign architecture.'
    },
    {
      question: 'A company has 50 TB of on-premises file data to migrate to Amazon S3. They have 100 Mbps internet connection. Which is the fastest migration option?',
      options: ['AWS DataSync over internet', 'AWS Direct Connect + DataSync', 'AWS Snowball Edge', 'AWS S3 Transfer Acceleration'],
      correct: 2,
      explanation: 'At 100 Mbps, transferring 50 TB would take weeks. Snowball Edge: ship device, load 80 TB, ship back — completed in days. DataSync over internet: 50 TB / 100 Mbps = ~46 days. Use Snow for large data with limited bandwidth.',
      reference: 'Snow = limited bandwidth or > 10 TB. DataSync = good network available. 100 Mbps is too slow for 50 TB online transfer.'
    },
    {
      question: 'What does DMS Change Data Capture (CDC) provide?',
      options: ['Real-time backup', 'Continuous replication of ongoing database changes, enabling near-zero downtime cutover', 'Schema conversion', 'Data compression'],
      correct: 1,
      explanation: 'CDC: after initial full load, DMS continuously captures INSERT/UPDATE/DELETE changes from the source and applies them to the target. When ready to cut over, the target is nearly synchronized with the source.',
      reference: 'CDC = ongoing change replication. Full load + CDC = near-zero downtime migration. Works for homogeneous and heterogeneous.'
    },
    {
      question: 'When should you use AWS DataSync instead of AWS Snow Family?',
      options: ['Always', 'When you have good network bandwidth and the data volume is manageable for online transfer', 'When data is > 100 TB', 'When source is on-premises NAS only'],
      correct: 1,
      explanation: 'DataSync: best when sufficient network bandwidth (e.g., 1 Gbps+) and data volume allows reasonable transfer time. Provides scheduling, verification, and monitoring. Snow Family: best for limited bandwidth, disconnected environments, or massive datasets (PB scale).',
      reference: 'DataSync = online, good bandwidth, scheduling+verification. Snow = offline, limited bandwidth, > 10 TB typically.'
    },
    {
      question: 'What does AWS Migration Hub primarily provide?',
      options: ['Data migration tool', 'Central dashboard to track migration progress across multiple tools and applications', 'Schema conversion', 'Network connectivity assessment'],
      correct: 1,
      explanation: 'Migration Hub: centralized visibility into migration progress. Groups servers into application stacks. Aggregates status from MGN, DMS, Application Discovery Service. Provides a single pane of glass for the entire migration program.',
      reference: 'Migration Hub = central tracking, not a migration tool itself. Works with MGN, DMS, CloudEndure.'
    }
  ],

  flashcards: [
    { front: '7Rs migration strategies?', back: 'Retire (decommission). Retain (keep on-prem). Rehost (lift&shift to EC2). Replatform (managed services, no code change). Repurchase (SaaS). Refactor (re-architect cloud-native). Relocate (VMware Cloud).' },
    { front: 'MGN vs DMS?', back: 'MGN: full server/VM migration (any OS), block-level replication, lift&shift, test cutovers. DMS: database migration only, supports heterogeneous with SCT, CDC for ongoing replication.' },
    { front: 'DMS key concepts?', back: 'Homogeneous: same engine, DMS only. Heterogeneous: different engines, DMS + SCT (Schema Conversion Tool). CDC: ongoing change replication for near-zero downtime. Replication instance = managed EC2.' },
    { front: 'Snow Family sizing?', back: 'Snowcone: 8 TB, smallest, edge. Snowball Edge Storage Optimized: 80 TB. Snowball Edge Compute Optimized: EC2 + S3 at edge. Snowmobile: 100 PB truck. Choose Snow when limited bandwidth or > 10 TB.' },
    { front: 'DataSync features?', back: 'Online transfer: S3, EFS, FSx, NFS, SMB. Agent for on-prem. Automated scheduling. Bandwidth throttling. TLS encryption. Integrity verification. Faster than manual copy. For initial load + ongoing sync.' },
    { front: 'Application Discovery Service?', back: 'Agentless: VMware vCenter API, VM config/utilization. Agent-based: OS-level, processes, dependencies, network. Data feeds Migration Hub. Used before migration planning.' },
    { front: 'MGN migration flow?', back: '1. Install agent. 2. Continuous block replication to staging. 3. Test cutover (validate). 4. Cutover: launch converted instances. 5. Redirect traffic. Production runs throughout replication.' },
    { front: 'Migration Hub purpose?', back: 'Central tracking dashboard for all migrations. Groups servers into applications. Aggregates from MGN, DMS, Discovery Service. Not a migration tool itself — just visibility/tracking.' }
  ],

  lab: {
    scenario: 'Plan a migration strategy for a 3-tier web application from on-premises to AWS.',
    objective: 'Practice applying 7Rs, setting up DMS for database migration, and using MGN for server migration.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Apply 7Rs Framework to Migration Scenario',
        instruction: 'Analyze a 3-tier application (web tier, app tier, Oracle database) and decide the migration strategy for each component.',
        hints: ['Consider cloud-native alternatives for each tier', 'Oracle to Aurora is heterogeneous — needs SCT'],
        solution: '```\nApplication inventory analysis:\n\nWeb Tier (Apache on RHEL):\n  Current: Apache on EC2-equivalent VMs\n  Strategy: REPLATFORM\n  -> Amazon CloudFront + S3 (static) or\n  -> ALB + ECS/Fargate (dynamic)\n  Rationale: no code change, use managed services\n\nApp Tier (Java Tomcat):\n  Current: Tomcat on VMs\n  Strategy: REPLATFORM\n  -> Elastic Beanstalk (manages Tomcat)\n  -> Or REFACTOR to Lambda/containers if redesigning\n  Rationale: managed runtime, auto-scaling\n\nDatabase Tier (Oracle 12c):\n  Current: Oracle on-premises\n  Strategy: REPLATFORM\n  -> Amazon Aurora PostgreSQL via DMS + SCT\n  Rationale: open-source, managed, cost reduction\n\nLegacy Batch System:\n  Strategy: RETIRE\n  -> Move functionality to AWS Step Functions\n  -> Or decommission if no longer needed\n```',
        verify: '```\n# Validation questions:\n# 1. Did you consider cost, effort, risk for each strategy?\n# 2. Is each decision justified by business requirements?\n# 3. Did you identify dependencies between tiers?\n# Expected: documented 7R decision for each component with rationale\n```'
      },
      {
        title: 'Create DMS Replication Instance and Migration Task',
        instruction: 'Set up a DMS replication instance and create a migration task to migrate MySQL to Amazon Aurora MySQL.',
        hints: ['Homogeneous migration does not need SCT', 'Choose Multi-AZ for HA replication instance'],
        solution: '```bash\n# Create DMS replication instance\naws dms create-replication-instance \\\n  --replication-instance-identifier migration-instance \\\n  --replication-instance-class dms.r5.large \\\n  --allocated-storage 100 \\\n  --multi-az \\\n  --engine-version 3.5.1\n\n# Create source endpoint (MySQL on-prem)\naws dms create-endpoint \\\n  --endpoint-identifier source-mysql \\\n  --endpoint-type source \\\n  --engine-name mysql \\\n  --username admin \\\n  --password MyPassword \\\n  --server-name 10.0.1.100 \\\n  --port 3306 \\\n  --database-name mydb\n\n# Create target endpoint (Aurora MySQL)\naws dms create-endpoint \\\n  --endpoint-identifier target-aurora \\\n  --endpoint-type target \\\n  --engine-name aurora \\\n  --username admin \\\n  --password MyPassword \\\n  --server-name aurora-cluster.cluster-xxx.us-east-1.rds.amazonaws.com \\\n  --port 3306\n```',
        verify: '```bash\naws dms describe-replication-instances \\\n  --filters Name=replication-instance-identifier,Values=migration-instance\n# Expected: status = available\n\naws dms test-connection \\\n  --replication-instance-arn REPLICATION_INSTANCE_ARN \\\n  --endpoint-arn SOURCE_ENDPOINT_ARN\n# Expected: status = successful\n```'
      },
      {
        title: 'Set Up MGN Agent for Server Migration',
        instruction: 'Install MGN agent on source server and verify replication to AWS staging area.',
        hints: ['MGN agent requires network connectivity to AWS MGN API endpoints', 'Staging area is in a dedicated AWS subnet'],
        solution: '```bash\n# Initialize MGN service in account\naws mgn initialize-service\n\n# Download and install agent on source server (Linux)\ncurl -O https://aws-application-migration-service-us-east-1.s3.amazonaws.com/latest/linux/aws-replication-installer-init\nchmod +x aws-replication-installer-init\nsudo ./aws-replication-installer-init \\\n  --region us-east-1 \\\n  --aws-access-key-id ACCESS_KEY \\\n  --aws-secret-access-key SECRET_KEY\n\n# Check source server status in MGN\naws mgn describe-source-servers \\\n  --filters filters=[{name=lifeCycle.state,values=[READY_FOR_TEST]}]\n```',
        verify: '```bash\naws mgn describe-source-servers --filters filters=[]\n# Expected: source server listed with replicationStatus = HEALTHY\n# lifeCycle.state = READY_FOR_TEST (after initial sync)\n\n# Verify replication lag\naws mgn describe-source-servers \\\n  --query "items[0].dataReplicationInfo.dataReplicationState"\n# Expected: REPLICATING or CONTINUOUS\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'DMS Migration Task Failing with Foreign Key Constraint Violations',
      difficulty: 'medium',
      symptom: 'DMS migration task starts but fails with foreign key constraint errors. Tables are partially migrated.',
      diagnosis: '```\nForeign key constraint issue during DMS migration:\n1. Root cause:\n   DMS migrates tables in parallel by default\n   Parent table may not be migrated before child tables\n   Foreign key constraints fail when child row inserted before parent\n\n2. Solutions:\n   a) Disable FK constraints on target before migration\n      MySQL/Aurora: SET FOREIGN_KEY_CHECKS=0\n      Re-enable after: SET FOREIGN_KEY_CHECKS=1\n   b) Specify table load order (LOB mode)\n   c) Use DMS task setting: targetTablePrepMode=TRUNCATE_BEFORE_LOAD\n\n3. Check task logs:\n   aws dms describe-replication-task-logs \\\n     --replication-task-arn TASK_ARN\n\n4. LOB (Large Object) settings:\n   If binary/text columns are large:\n   enableLobsForTask=true, lobMaxSize as needed\n\n5. For heterogeneous migration:\n   Also check SCT conversion errors\n   Some constructs may not convert cleanly\n```',
      solution: 'Disable foreign key checks on the target database before starting the migration task. Run DMS full load, then re-enable foreign key checks. Validate data integrity after. For ongoing CDC after initial load, foreign key issues are less common as changes come in order.'
    },
    {
      title: 'MGN Agent Not Connecting After Installation',
      difficulty: 'hard',
      symptom: 'MGN agent installed on source server but source server does not appear in Migration Hub. Replication never starts.',
      diagnosis: '```\nMGN agent connectivity checklist:\n1. Network connectivity from source to AWS:\n   Required endpoints (TCP 443):\n   - mgn.REGION.amazonaws.com (MGN API)\n   - kinesis.REGION.amazonaws.com (for streaming)\n   - s3.amazonaws.com (for replication data)\n\n2. TCP port 1500 (replication data):\n   Source server -> AWS staging area subnet\n   Must be open in security groups/NACLs/on-prem firewall\n\n3. IAM credentials:\n   The access key/secret used during install\n   Must have: AWSApplicationMigrationAgentPolicy\n\n4. Check agent logs:\n   Linux: /var/log/aws-replication-agent/replication.log\n   Windows: C:\\Program Files (x86)\\AWS Replication Agent\\logs\\\n\n5. Proxy configuration:\n   If source behind HTTP proxy, configure agent with proxy settings\n\n6. VPN/DX for replication traffic:\n   For large servers, VPN or Direct Connect avoids internet transfer costs\n```',
      solution: 'Verify TCP 443 from source to MGN API endpoints and TCP 1500 to staging subnet. Check IAM permissions (AWSApplicationMigrationAgentPolicy). Review agent logs for connection errors. If source is behind a proxy, configure agent proxy settings. For production migrations, use VPN or Direct Connect to avoid replication over internet.'
    }
  ]
};
