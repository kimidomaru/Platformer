window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-high-perf-arch/storage-optimization'] = {
  theory: `# Storage & Caching Optimization

## Exam Relevance
> **Design High-Performing Architectures** is worth **24%** of SAA-C03. S3 classes, EBS types, shared file systems, caching, and CloudFront are core topics.

## S3 Storage Classes

| Class | Access | Min Duration | Use Case |
|-------|--------|-------------|----------|
| **Standard** | Frequent | None | Active data, websites |
| **Standard-IA** | Infrequent | 30 days | Backups, older data |
| **One Zone-IA** | Infrequent, single AZ | 30 days | Reproducible data, 20% cheaper |
| **Intelligent-Tiering** | Auto-tiered | None | Unpredictable access patterns |
| **Glacier Instant** | Milliseconds retrieval | 90 days | Archive needing instant access |
| **Glacier Flexible** | 1-12 hours retrieval | 90 days | Long-term archive |
| **Deep Archive** | 12-48 hours retrieval | 180 days | Compliance, 7-10 year retention |

### S3 Lifecycle Policies
- **Transition rules**: move objects between classes (Standard -> IA after 30d -> Glacier after 90d)
- **Expiration rules**: delete objects after specified days
- **Filter**: apply by prefix, tags, or object size
- **Intelligent-Tiering**: auto-moves between tiers, \\$0.0025/1000 objects monitoring fee, no retrieval fees

### S3 Performance
- **Transfer Acceleration**: uses CloudFront edge locations for faster uploads (global users)
- **Multipart Upload**: required >5GB, recommended >100MB, parallel parts
- **S3 Select**: query data in-place with SQL (reduce data transfer up to 400%)
- **Byte-Range Fetches**: parallel downloads of specific byte ranges

## EBS Volume Types

| Type | IOPS | Throughput | Use Case |
|------|------|-----------|----------|
| **gp3** | 3,000 baseline (up to 16,000) | 125 MB/s (up to 1,000) | General workloads (recommended default) |
| **gp2** | 3,000 burst (3 IOPS/GB) | 250 MB/s | Legacy general purpose |
| **io2 Block Express** | Up to 256,000 | 4,000 MB/s | Critical databases, sub-ms latency |
| **st1** (Throughput HDD) | 500 | 500 MB/s | Big data, data warehouses, logs |
| **sc1** (Cold HDD) | 250 | 250 MB/s | Infrequent access, lowest cost |

**gp3 vs gp2**: gp3 has independent IOPS/throughput configuration (not tied to size). gp3 is 20% cheaper than gp2.

## Shared File Systems

| Service | Protocol | Best For |
|---------|----------|----------|
| **EFS** | NFS | Linux shared storage, serverless (Lambda) |
| **FSx for Lustre** | Lustre | HPC, ML training, S3 integration |
| **FSx for Windows** | SMB | Windows workloads, Active Directory |
| **FSx for NetApp ONTAP** | NFS/SMB/iSCSI | Multi-protocol, migration from NetApp |
| **FSx for OpenZFS** | NFS | Linux migration from ZFS |

### EFS Details
- Standard vs One Zone (20% cheaper, single AZ)
- Performance modes: General Purpose (latency-sensitive) vs Max I/O (high throughput)
- Throughput modes: Bursting, Provisioned, Elastic (auto-scales)

## Caching

### ElastiCache: Redis vs Memcached

| Feature | Redis | Memcached |
|---------|-------|-----------|
| **Persistence** | Yes (RDB/AOF) | No |
| **Replication** | Yes (read replicas) | No |
| **Data structures** | Strings, lists, sets, sorted sets, hashes | Simple key-value |
| **Pub/Sub** | Yes | No |
| **Multi-threaded** | No (single-threaded) | Yes |
| **Cluster mode** | Yes (sharding) | Yes (simple) |

### DAX (DynamoDB Accelerator)
- In-VPC cache for DynamoDB
- Microsecond read latency (vs single-digit ms for DynamoDB)
- Write-through cache (writes go to DynamoDB first)
- API-compatible with DynamoDB (drop-in replacement)

## CloudFront (CDN)

- **Edge Locations**: 400+ worldwide, cache content close to users
- **TTL**: control how long content is cached (default 24h)
- **Origin Access Control (OAC)**: secure S3 origin access (replaces OAI)
- **Cache Policies**: separate cache key from origin request headers
- **Lambda@Edge**: run code at edge (viewer/origin request/response)
- **CloudFront Functions**: lightweight JavaScript for simple transformations
- **Invalidation**: remove cached content (\\$0.005 per path, use versioning instead)

## Common Exam Mistakes

- Using gp2 instead of gp3 (gp3 is newer, cheaper, independently configurable)
- Forgetting S3 Intelligent-Tiering has no retrieval fees (unlike IA/Glacier)
- Choosing EFS for Windows (use FSx for Windows)
- Using Redis when Memcached is sufficient (simpler, multi-threaded)
- Not knowing DAX is API-compatible with DynamoDB (drop-in)
`,

  quiz: [
    {
      question: 'Which S3 storage class automatically moves objects between tiers with no retrieval fees?',
      options: ['Standard-IA', 'Glacier Instant Retrieval', 'Intelligent-Tiering', 'One Zone-IA'],
      correct: 2,
      explanation: 'Intelligent-Tiering auto-moves objects between Frequent, Infrequent, and Archive tiers based on access. No retrieval fees. Small monitoring fee per 1,000 objects.',
      reference: 'Intelligent-Tiering = auto-tier, no retrieval fees. IA classes have retrieval fees.'
    },
    {
      question: 'What is the advantage of gp3 over gp2 EBS volumes?',
      options: ['gp3 is more expensive but faster', 'gp3 allows independent IOPS/throughput configuration and is 20% cheaper', 'gp2 has higher maximum IOPS', 'gp3 only works with Graviton'],
      correct: 1,
      explanation: 'gp3: 3000 IOPS baseline, independently configure IOPS (up to 16K) and throughput (up to 1000 MB/s), 20% cheaper than gp2. gp2 ties IOPS to volume size (3 IOPS/GB).',
      reference: 'gp3 = independent config, cheaper. gp2 = size-based IOPS. Always prefer gp3 for new volumes.'
    },
    {
      question: 'When should you use FSx for Lustre?',
      options: ['Windows file sharing with Active Directory', 'Multi-protocol NFS/SMB access', 'High-performance computing and ML training with S3 integration', 'Simple Linux file sharing'],
      correct: 2,
      explanation: 'FSx for Lustre: high-performance parallel file system for HPC, ML training, video processing. Native S3 integration (lazy loading from S3, write back to S3).',
      reference: 'Lustre = HPC + S3. Windows = FSx Windows (SMB+AD). Multi-protocol = FSx NetApp ONTAP.'
    },
    {
      question: 'What is the key difference between Redis and Memcached in ElastiCache?',
      options: ['Memcached supports persistence, Redis does not', 'Redis supports persistence, replication, and rich data structures; Memcached is simpler and multi-threaded', 'They are identical', 'Memcached is more expensive'],
      correct: 1,
      explanation: 'Redis: persistence (RDB/AOF), replication, data structures (lists, sets, sorted sets), pub/sub. Memcached: simple key-value, multi-threaded, no persistence, no replication.',
      reference: 'Redis = rich features, persistence. Memcached = simple, multi-threaded, volatile.'
    },
    {
      question: 'What does DAX provide for DynamoDB?',
      options: ['Backup and restore', 'Microsecond read latency via in-VPC write-through cache', 'Schema conversion', 'Cross-Region replication'],
      correct: 1,
      explanation: 'DAX: in-VPC cache for DynamoDB with microsecond read latency. Write-through cache (writes go to DynamoDB first). API-compatible — drop-in replacement, no code changes.',
      reference: 'DAX = microsecond reads, API-compatible with DynamoDB, write-through cache.'
    },
    {
      question: 'What is CloudFront Origin Access Control (OAC)?',
      options: ['A firewall rule for CloudFront', 'Secures S3 origin so only CloudFront can access it (replaces OAI)', 'DNS routing policy', 'SSL certificate management'],
      correct: 1,
      explanation: 'OAC restricts S3 bucket access to only CloudFront distribution. Prevents direct S3 access. OAC replaces the older OAI (Origin Access Identity) with better security.',
      reference: 'OAC = secure S3 origin. Replaces OAI. S3 bucket policy allows CloudFront service principal.'
    },
    {
      question: 'Which EBS volume type provides the highest IOPS?',
      options: ['gp3 (16,000 IOPS)', 'st1 (500 IOPS)', 'io2 Block Express (256,000 IOPS)', 'sc1 (250 IOPS)'],
      correct: 2,
      explanation: 'io2 Block Express: up to 256,000 IOPS with sub-millisecond latency. For mission-critical databases requiring extreme performance. gp3 max is 16,000 IOPS.',
      reference: 'io2 BE = 256K IOPS (critical DBs). gp3 = 16K IOPS (general). st1/sc1 = HDD (throughput).'
    },
    {
      question: 'What is S3 Transfer Acceleration?',
      options: ['Faster retrieval from Glacier', 'Uses CloudFront edge locations to speed up uploads from global users', 'Compresses S3 objects', 'Increases S3 API rate limits'],
      correct: 1,
      explanation: 'Transfer Acceleration routes uploads through nearest CloudFront edge location via optimized AWS network. Best for global users uploading to a single S3 bucket. Additional cost per GB.',
      reference: 'Transfer Acceleration = edge upload. Multipart = parallel large files. S3 Select = query in-place.'
    }
  ],

  flashcards: [
    { front: 'S3 storage classes by access frequency?', back: 'Standard (frequent), Standard-IA (infrequent, 30d min), One Zone-IA (single AZ, 20% cheaper), Intelligent-Tiering (auto-tier), Glacier Instant (ms, 90d), Glacier Flexible (1-12h, 90d), Deep Archive (12-48h, 180d).' },
    { front: 'EBS volume types by use case?', back: 'gp3: general (3K IOPS, recommended default). io2 BE: critical DBs (256K IOPS). st1: big data throughput (500 MB/s HDD). sc1: cold infrequent (250 MB/s HDD). gp3 is 20% cheaper than gp2.' },
    { front: 'FSx options?', back: 'Lustre: HPC/ML + S3 integration. Windows: SMB + Active Directory. NetApp ONTAP: multi-protocol NFS/SMB/iSCSI. OpenZFS: Linux ZFS migration. EFS: shared NFS for Linux.' },
    { front: 'Redis vs Memcached?', back: 'Redis: persistence, replication, data structures (lists/sets/sorted sets), pub/sub, single-threaded. Memcached: simple key-value, multi-threaded, no persistence, no replication. Redis for features, Memcached for simplicity.' },
    { front: 'What is DAX?', back: 'DynamoDB Accelerator: in-VPC cache, microsecond reads, write-through. API-compatible with DynamoDB (drop-in, no code changes). Ideal for read-heavy DynamoDB workloads.' },
    { front: 'S3 performance features?', back: 'Transfer Acceleration (edge uploads). Multipart Upload (parallel, required >5GB). S3 Select (SQL query in-place, reduce transfer 400%). Byte-Range Fetches (parallel partial downloads).' },
    { front: 'CloudFront key features?', back: '400+ edge locations. TTL control. OAC for S3 security. Cache/Origin Request policies. Lambda@Edge (full code at edge). CloudFront Functions (lightweight JS). Invalidation vs versioning.' },
    { front: 'S3 lifecycle policies?', back: 'Transition: move between classes (Standard->IA 30d, ->Glacier 90d, ->Deep Archive 180d). Expiration: auto-delete. Filter by prefix/tags/size. Use S3 Analytics for class recommendations.' }
  ],

  lab: {
    scenario: 'Optimize storage architecture for a data analytics platform.',
    objective: 'Practice S3 lifecycle policies, EBS selection, and caching strategies.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Configure S3 Lifecycle Policy',
        instruction: 'Create a lifecycle policy that transitions objects to Standard-IA after 30 days, Glacier Flexible after 90 days, and deletes after 365 days.',
        hints: ['Use aws s3api put-bucket-lifecycle-configuration', 'Transition days are from object creation'],
        solution: '```bash\naws s3api put-bucket-lifecycle-configuration \\\n  --bucket my-data-bucket \\\n  --lifecycle-configuration \'{"Rules":[{"ID":"archive-policy","Status":"Enabled","Filter":{"Prefix":"data/"},"Transitions":[{"Days":30,"StorageClass":"STANDARD_IA"},{"Days":90,"StorageClass":"GLACIER"}],"Expiration":{"Days":365}}]}\'\n```',
        verify: '```bash\naws s3api get-bucket-lifecycle-configuration --bucket my-data-bucket\n# Expected: 1 rule with 2 transitions (IA at 30d, Glacier at 90d)\n# and expiration at 365 days\n```'
      },
      {
        title: 'Choose the Right EBS Volume Type',
        instruction: 'An application needs 10,000 IOPS sustained. Compare gp3 (configurable) vs io2 and select the most cost-effective option.',
        hints: ['gp3 supports up to 16,000 IOPS', 'io2 is more expensive but supports up to 256K IOPS'],
        solution: '```bash\n# gp3: baseline 3000 IOPS, provision up to 16,000\n# 10,000 IOPS is within gp3 range\n# Cost: ~\\$0.08/GB + \\$0.005/provisioned IOPS above 3000\n# 100GB gp3 at 10K IOPS = \\$8 + (7000 * \\$0.005) = \\$43/month\n\n# io2: \\$0.125/GB + \\$0.065/IOPS\n# 100GB io2 at 10K IOPS = \\$12.50 + \\$650 = \\$662.50/month\n\n# gp3 is dramatically cheaper for 10K IOPS!\naws ec2 create-volume --volume-type gp3 --size 100 \\\n  --iops 10000 --throughput 400 \\\n  --availability-zone us-east-1a\n```',
        verify: '```bash\naws ec2 describe-volumes --volume-ids vol-xxx \\\n  --query "Volumes[0].{Type:VolumeType,IOPS:Iops,Throughput:Throughput,Size:Size}"\n# Expected: gp3, 10000 IOPS, 400 MB/s throughput, 100 GB\n```'
      },
      {
        title: 'Set Up ElastiCache Redis Cluster',
        instruction: 'Create a Redis ElastiCache cluster for session storage with a read replica for HA.',
        hints: ['Use replication group for HA', 'Choose cache.r6g for memory-optimized with Graviton'],
        solution: '```bash\n# Create Redis replication group (1 primary + 1 replica)\naws elasticache create-replication-group \\\n  --replication-group-id session-cache \\\n  --replication-group-description "Session store" \\\n  --engine redis \\\n  --cache-node-type cache.r6g.large \\\n  --num-cache-clusters 2 \\\n  --automatic-failover-enabled \\\n  --multi-az-enabled\n```',
        verify: '```bash\naws elasticache describe-replication-groups \\\n  --replication-group-id session-cache\n# Expected: 2 cache clusters, AutomaticFailover = enabled\n# MultiAZ = enabled, Status = available\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'S3 Lifecycle Rule Not Transitioning Objects',
      difficulty: 'medium',
      symptom: 'Objects older than the transition period remain in Standard class instead of moving to IA/Glacier.',
      diagnosis: '```\nChecklist:\n1. Rule is Enabled? (not Disabled)\n2. Filter matches objects? (prefix, tags, size)\n3. Minimum size: objects < 128 KB are NOT transitioned\n4. Transition timing:\n   - Days counted from object creation date\n   - Processed daily (not instant)\n   - Standard to IA requires minimum 30 days\n5. Versioning: rules apply to current or noncurrent versions\n\nCheck:\n  aws s3api get-bucket-lifecycle-configuration --bucket BUCKET\n  Verify Status, Filter, Transitions days\n```',
      solution: 'Verify rule is enabled and filter matches target objects. Objects smaller than 128 KB are never transitioned. Transitions are processed daily in batches. Ensure minimum 30-day gap between Standard and IA. For versioned buckets, configure NoncurrentVersionTransitions separately.'
    },
    {
      title: 'ElastiCache Redis High Latency',
      difficulty: 'hard',
      symptom: 'Redis cluster showing increased latency despite low CPU and memory utilization.',
      diagnosis: '```\nCommon causes:\n1. Network: client not in same VPC/subnet\n   Solution: deploy client in same AZ as primary node\n\n2. Hot key: single key receiving disproportionate traffic\n   Check: redis-cli --latency, SLOWLOG GET\n\n3. Large values: big objects increase serialization time\n   Check: DEBUG OBJECT key (serializedlength)\n\n4. Persistence impact: RDB snapshots cause brief latency\n   Check: CloudWatch BackupInProgress metric\n\n5. Connection overhead: too many new connections\n   Solution: use connection pooling\n\nCloudWatch metrics to check:\n  - EngineCPUUtilization (not host CPU)\n  - CurrConnections\n  - CacheHitRate\n  - ReplicationLag\n```',
      solution: 'Common fixes: 1) Deploy clients in same AZ as Redis primary. 2) Use connection pooling. 3) Break large values into smaller keys. 4) Enable cluster mode for sharding hot keys. 5) Schedule RDB snapshots during low-traffic windows. Check EngineCPUUtilization (not HostCPU) for true Redis load.'
    }
  ]
};
