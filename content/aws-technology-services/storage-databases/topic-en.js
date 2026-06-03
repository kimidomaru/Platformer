window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-technology-services/storage-databases'] = {
  theory: `# Storage & Database Services

## Exam Relevance
> Storage and databases are fundamental in the CLF-C02. Knowing how to differentiate S3, EBS, EFS, and database services is essential.

## Amazon S3 (Simple Storage Service)

Object storage with **99.999999999% (11 nines)** durability. Most used AWS service.

### S3 Concepts
- **Bucket**: container for objects (globally unique name)
- **Object**: file + metadata (up to 5 TB per object)
- **Key**: object path within the bucket
- No limit on total storage
- Multipart upload for files > 100 MB

### S3 Storage Classes

| Class | Use | Availability |
|-------|-----|--------------|
| **S3 Standard** | Frequently accessed data | 99.99% |
| **S3 Intelligent-Tiering** | Unpredictable access (auto-moves) | 99.9% |
| **S3 Standard-IA** | Infrequent access but fast when needed | 99.9% |
| **S3 One Zone-IA** | IA in a single AZ (30% cheaper) | 99.5% |
| **S3 Glacier Instant** | Archive with millisecond access | 99.9% |
| **S3 Glacier Flexible** | Archive with minutes-hours access | 99.99% |
| **S3 Glacier Deep Archive** | Long-term archive (cheapest, hours) | 99.99% |

### S3 Lifecycle Rules
Automatically move objects between storage classes based on time rules. E.g., move to Glacier after 90 days.

### S3 Versioning
Keep previous versions of objects. Protects against accidental deletions.

## Amazon EBS (Elastic Block Store)

Block volumes for EC2 instances. Think of it as a "virtual hard drive."

### Characteristics
- Attached to ONE EC2 instance at a time (except Multi-Attach io2)
- Persists independently of the instance
- Bound to a specific AZ
- Snapshots for backup (stored in S3, cross-AZ/Region)

### EBS Types

| Type | Use | IOPS |
|------|-----|------|
| **gp3/gp2** (SSD) | General purpose | Up to 16,000 |
| **io2/io1** (SSD) | High performance, databases | Up to 64,000 |
| **st1** (HDD) | Throughput intensive | Up to 500 |
| **sc1** (HDD) | Infrequent access, lowest cost | Up to 250 |

## Amazon EFS (Elastic File System)

Shared file system (NFS) mountable by multiple EC2 instances simultaneously.

- Multi-AZ by default
- Auto-scaling (grows and shrinks automatically)
- Linux only (no Windows support)
- More expensive than EBS but shareable

## AWS Storage Gateway

Hybrid service connecting on-premises storage with AWS cloud. Three types:
- **File Gateway**: access S3 via NFS/SMB
- **Volume Gateway**: iSCSI volumes backed by S3
- **Tape Gateway**: virtual tape backup to S3 Glacier

## Amazon FSx

Managed file systems:
- **FSx for Windows**: Windows File Server (SMB, Active Directory)
- **FSx for Lustre**: HPC, machine learning (high performance)

## Database Services

### Relational Databases

| Service | Description |
|---------|-------------|
| **Amazon RDS** | Managed relational database (MySQL, PostgreSQL, MariaDB, Oracle, SQL Server) |
| **Amazon Aurora** | AWS-native database, MySQL/PostgreSQL compatible, up to 5x faster than RDS MySQL |

### Non-Relational Databases (NoSQL)

| Service | Description |
|---------|-------------|
| **DynamoDB** | Key-value and document DB, serverless, single-digit ms latency |
| **DocumentDB** | MongoDB compatible |
| **Neptune** | Graph database |
| **Keyspaces** | Cassandra compatible |

### Other Database Services

| Service | Description |
|---------|-------------|
| **ElastiCache** | In-memory cache (Redis, Memcached) |
| **Redshift** | Data warehouse (analytics, columnar) |
| **DMS** | Database Migration Service |
| **QLDB** | Ledger database (immutable) |
| **Timestream** | Time-series database |

## Comparison: S3 vs EBS vs EFS

| Aspect | S3 | EBS | EFS |
|--------|-----|-----|-----|
| **Type** | Object storage | Block storage | File storage (NFS) |
| **Access** | HTTP/HTTPS | EC2 instance | Multiple EC2 |
| **Scalability** | Unlimited | Fixed volume | Auto-scaling |
| **AZ** | Multi-AZ | Single AZ | Multi-AZ |
| **Use** | Web, backup, data lake | OS disk, databases | Shared files |

## Common Mistakes

- Confusing S3 with EBS — S3 is object storage (HTTP), EBS is block storage (disk)
- Forgetting EBS is single-AZ while EFS is multi-AZ
- Not knowing S3 Glacier has retrieval time (not instant access for all tiers)
- Confusing DynamoDB (NoSQL serverless) with RDS (managed SQL)
`,

  quiz: [
    {
      question: 'What is the durability of Amazon S3?',
      options: ['99.9%', '99.99%', '99.999%', '99.999999999% (11 nines)'],
      correct: 3,
      explanation: 'S3 offers 99.999999999% (11 nines) durability. This means if you store 10 million objects, statistically you would lose 1 every 10,000 years.',
      reference: 'Durability vs Availability: durability is about NOT losing data, availability is about ACCESSING data.'
    },
    {
      question: 'Which storage type can be mounted by multiple EC2 instances simultaneously?',
      options: ['Amazon EBS', 'Amazon S3', 'Amazon EFS', 'Instance Store'],
      correct: 2,
      explanation: 'Amazon EFS (Elastic File System) is shared NFS that can be mounted by multiple EC2 instances across multiple AZs simultaneously.',
      reference: 'EBS = 1 instance. EFS = multiple instances. S3 = object storage (does not mount as filesystem).'
    },
    {
      question: 'Which S3 class is ideal for data with unpredictable access patterns?',
      options: ['S3 Standard', 'S3 Intelligent-Tiering', 'S3 Glacier', 'S3 One Zone-IA'],
      correct: 1,
      explanation: 'S3 Intelligent-Tiering automatically moves objects between tiers (frequent/infrequent/archive) based on access patterns. No retrieval fee.',
      reference: 'Ideal when you do not know access frequency. Small monthly monitoring fee per object.'
    },
    {
      question: 'Amazon DynamoDB is what type of database?',
      options: ['Relational (SQL)', 'NoSQL key-value and document', 'Graph database', 'Time-series'],
      correct: 1,
      explanation: 'DynamoDB is a serverless NoSQL database supporting key-value and document models. Offers single-digit millisecond latency at any scale.',
      reference: 'DynamoDB = NoSQL serverless. RDS = managed SQL. Neptune = graph. Timestream = time-series.'
    },
    {
      question: 'Which AWS service is a data warehouse for analytics?',
      options: ['Amazon RDS', 'Amazon DynamoDB', 'Amazon Redshift', 'Amazon ElastiCache'],
      correct: 2,
      explanation: 'Amazon Redshift is a columnar data warehouse optimized for analytics and complex queries on large data volumes (petabytes).',
      reference: 'Redshift = analytics (OLAP). RDS = transactional (OLTP). DynamoDB = NoSQL.'
    },
    {
      question: 'What is the main difference between EBS and EFS?',
      options: ['EBS is cheaper', 'EFS can be mounted by multiple instances, EBS by one', 'EBS supports Windows and Linux, EFS only Windows', 'No difference'],
      correct: 1,
      explanation: 'EBS is single-attach (one instance, one AZ). EFS is multi-attach, multi-AZ (shared across instances). EFS is Linux only, more expensive but shareable.',
      reference: 'For Windows shared files, use FSx for Windows File Server.'
    },
    {
      question: 'Which S3 class has the lowest cost for long-term archival?',
      options: ['S3 Standard-IA', 'S3 Glacier Flexible', 'S3 Glacier Deep Archive', 'S3 One Zone-IA'],
      correct: 2,
      explanation: 'S3 Glacier Deep Archive is the cheapest class, ideal for data rarely accessed (7-10 year retention). Retrieval time: 12-48 hours.',
      reference: 'Deep Archive < Glacier Flexible < Standard-IA < Standard in cost.'
    },
    {
      question: 'Amazon Aurora is compatible with which engines?',
      options: ['MongoDB and Redis', 'MySQL and PostgreSQL', 'Oracle and SQL Server', 'Cassandra and DynamoDB'],
      correct: 1,
      explanation: 'Aurora is an AWS-native database compatible with MySQL and PostgreSQL. Up to 5x faster than RDS MySQL and 3x faster than RDS PostgreSQL.',
      reference: 'Aurora = AWS-native, MySQL/PostgreSQL compatible, high performance, automatic Multi-AZ replication.'
    }
  ],

  flashcards: [
    { front: 'What are the S3 storage classes?', back: 'Standard (frequent), Intelligent-Tiering (auto-move), Standard-IA (infrequent), One Zone-IA (1 AZ), Glacier Instant (ms), Glacier Flexible (min-hrs), Glacier Deep Archive (12-48hrs). From most to least expensive.' },
    { front: 'What is the difference between S3, EBS, and EFS?', back: 'S3 = object storage (HTTP, unlimited). EBS = block storage (EC2 disk, single-AZ). EFS = file storage NFS (multi-AZ, shared, auto-scaling, Linux only).' },
    { front: 'What is Amazon Aurora?', back: 'AWS-native relational database, MySQL and PostgreSQL compatible. Up to 5x faster than RDS MySQL. Storage auto-scales to 128 TB. 6 copies across 3 AZs. Serverless option available.' },
    { front: 'What is Amazon DynamoDB?', back: 'Serverless NoSQL database (key-value + document). Single-digit ms latency. Auto-scaling. Global Tables for multi-region. DAX for in-memory cache. Pay-per-request or provisioned capacity.' },
    { front: 'What are the EBS volume types?', back: 'SSD: gp3/gp2 (general, up to 16K IOPS), io2/io1 (high perf, up to 64K IOPS). HDD: st1 (throughput, up to 500 IOPS), sc1 (cold, up to 250 IOPS). SSD for IOPS, HDD for throughput.' },
    { front: 'What is Amazon ElastiCache?', back: 'Managed in-memory cache service. Supports Redis and Memcached. Sub-millisecond latency. Used for: DB query caching, session storage, leaderboards. Reduces load on main database.' },
    { front: 'What is AWS Storage Gateway?', back: 'Hybrid service connecting on-prem with AWS. File Gateway (NFS/SMB to S3), Volume Gateway (iSCSI to S3), Tape Gateway (virtual tape to Glacier). For gradual migration.' },
    { front: 'What is Amazon Redshift?', back: 'Columnar data warehouse for analytics. SQL queries on petabytes. Redshift Spectrum queries S3 directly. Integrates with BI tools (QuickSight, Tableau). OLAP, not OLTP.' }
  ],

  lab: {
    scenario: 'Select the correct storage and database services for different scenarios.',
    objective: 'Map application requirements to AWS storage and database services.',
    duration: '10-15 minutes',
    steps: [
      {
        title: 'Choose Storage for Each Scenario',
        instruction: 'Select the correct storage service: (1) Host website images, (2) EC2 operating system disk, (3) Shared directory among 10 Linux EC2 instances.',
        hints: ['Web images = S3 (object storage)', 'OS disk = EBS (block)', 'Shared Linux = EFS (NFS)'],
        solution: '```\n1. Website images -> Amazon S3\n   - Object storage, HTTP/HTTPS access\n   - Integrates with CloudFront for CDN\n\n2. OS disk -> Amazon EBS (gp3)\n   - Block storage attached to EC2\n   - Persists after stop/start\n\n3. Shared directory -> Amazon EFS\n   - NFS multi-AZ, mounts on multiple instances\n   - Auto-scaling, Linux only\n```',
        verify: '```bash\n# Verification:\n# Web images -> S3 (HTTP access, CDN integration)\n# OS boot disk -> EBS (block storage, single instance)\n# Shared directory -> EFS (NFS, multi-instance, multi-AZ)\n```'
      },
      {
        title: 'Choose Database for Each Scenario',
        instruction: 'Select the correct service: (1) E-commerce with SQL transactions, (2) User profiles with key access, (3) Analytics on petabytes of data.',
        hints: ['SQL transactions = RDS/Aurora', 'Key-value = DynamoDB', 'Analytics = Redshift'],
        solution: '```\n1. E-commerce SQL -> Amazon Aurora (or RDS)\n   - Relational, ACID, up to 5x faster than MySQL\n   - Automatic Multi-AZ\n\n2. Profiles by key -> Amazon DynamoDB\n   - NoSQL key-value, serverless\n   - Single-digit ms latency\n\n3. Analytics -> Amazon Redshift\n   - Columnar data warehouse\n   - SQL on petabytes, integrates with BI tools\n```',
        verify: '```bash\n# Verification:\n# SQL + ACID -> RDS/Aurora\n# Key-value + serverless -> DynamoDB\n# OLAP analytics -> Redshift\n# Cache -> ElastiCache\n# Graph -> Neptune\n```'
      },
      {
        title: 'Design S3 Lifecycle',
        instruction: 'Design a lifecycle policy: objects accessed in first 30 days (Standard), then moved to IA until 90 days, then to Glacier for 1 year, then deleted.',
        hints: ['Lifecycle rules automate transitions between classes', 'Consider transition costs'],
        solution: '```\nS3 Lifecycle Policy:\nDay 0-30:   S3 Standard (frequent access)\nDay 31-90:  S3 Standard-IA (infrequent)\nDay 91-365: S3 Glacier Flexible (archive)\nDay 366+:   Delete object\n\nApproximate cost per GB/month:\nStandard:    $0.023\nStandard-IA: $0.0125\nGlacier:     $0.004\n\nSavings: ~80% after 90 days with Glacier\n```',
        verify: '```bash\n# Check in the console:\n# S3 > Bucket > Management > Lifecycle rules\n# Create rule with transitions and expiration\n# Result: automatic cost reduction\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'S3 vs EBS vs EFS — When to Use Which?',
      difficulty: 'easy',
      symptom: 'Candidate confuses the three storage types and when to use each.',
      diagnosis: '```\nAmazon S3:\n  - Object storage (key-value)\n  - Access via HTTP/HTTPS\n  - Unlimited, serverless\n  - For: web content, backups, data lakes\n\nAmazon EBS:\n  - Block storage (disk)\n  - Attached to 1 EC2 instance\n  - Single AZ\n  - For: boot volumes, databases\n\nAmazon EFS:\n  - File storage (NFS)\n  - Shared across instances\n  - Multi-AZ, auto-scaling\n  - For: shared configs, CMS, home dirs\n  - Linux only!\n```',
      solution: 'S3 for objects (web, backup). EBS for EC2 disk. EFS for shared Linux files. For Windows shared, use FSx for Windows.'
    },
    {
      title: 'RDS vs DynamoDB — SQL vs NoSQL',
      difficulty: 'medium',
      symptom: 'Candidate picks the wrong database type for the given scenario.',
      diagnosis: '```\nUse RDS/Aurora when:\n  - Relational data with complex JOINs\n  - ACID transactions required\n  - Rigid, defined schema\n  - Complex SQL queries\n  - E.g.: e-commerce, ERP, financial\n\nUse DynamoDB when:\n  - Key access (primary key lookup)\n  - Flexible schema (schemaless)\n  - Ultra-low latency (< 10ms)\n  - Massive scale without management\n  - E.g.: gaming leaderboards, IoT, session store\n```',
      solution: 'SQL + JOINs + ACID = RDS/Aurora. Key-value + serverless + scale = DynamoDB. Analytics = Redshift. Cache = ElastiCache. The exam frequently tests this differentiation.'
    }
  ]
};
