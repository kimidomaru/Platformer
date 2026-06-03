window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-high-perf-arch/database-optimization'] = {
  theory: `# Database Selection & Optimization

## Exam Relevance
> **Design High-Performing Architectures** is worth **24%** of SAA-C03. Choosing the right database, read replicas, caching patterns, and purpose-built databases are heavily tested.

## Amazon RDS

### Multi-AZ vs Read Replicas

| Feature | Multi-AZ | Read Replicas |
|---------|----------|---------------|
| **Purpose** | HA (failover) | Performance (read scaling) |
| **Replication** | Synchronous | Asynchronous |
| **Failover** | Auto (~60s) | Manual promotion |
| **Readable** | No | Yes |
| **Cross-Region** | No | Yes |
| **Max count** | 1 standby | 5 per instance |

### Engines
MySQL, PostgreSQL, MariaDB, Oracle, SQL Server. Each has specific Multi-AZ and replica limitations.

## Amazon Aurora

| Feature | RDS | Aurora |
|---------|-----|--------|
| **Storage** | EBS-based, manual scaling | Auto-scaling up to 128 TB, SSD |
| **Replicas** | Up to 5, seconds failover | Up to 15, millisecond failover |
| **Replication** | Async to replicas | Shared storage (no replication lag) |
| **Serverless** | No | Serverless v2 (0.5-128 ACU) |
| **Global** | Cross-Region read replicas | Global Database (<1s replication) |
| **Backtrack** | No | Yes (rewind up to 72h) |
| **Cloning** | Snapshot + restore (slow) | Copy-on-write (fast, same cluster) |

## Amazon DynamoDB

### Key Design Principles
- **Partition Key**: choose high cardinality (userId, orderId) to distribute evenly
- **Sort Key**: enables range queries within a partition
- **Single-table design**: store multiple entity types in one table (SAP-level pattern)

### Indexes

| Type | GSI (Global Secondary Index) | LSI (Local Secondary Index) |
|------|-----|-----|
| **Partition Key** | Different from table | Same as table |
| **Sort Key** | Any attribute | Different from table |
| **Consistency** | Eventually consistent only | Strong or eventual |
| **Creation** | Anytime | At table creation only |
| **Capacity** | Own provisioned capacity | Shares table capacity |

### Capacity Modes
- **On-Demand**: pay per request, no capacity planning, good for unpredictable
- **Provisioned**: specify RCU/WCU, cheaper for steady workloads
- **Auto-Scaling**: adjusts provisioned capacity based on utilization

### DynamoDB Features
- **Streams**: capture item-level changes (24h retention), trigger Lambda
- **TTL**: auto-delete expired items (no extra cost)
- **DAX**: in-VPC cache, microsecond reads, write-through, API-compatible
- **Global Tables**: multi-Region, multi-active replication

## ElastiCache Patterns

### Lazy Loading (Cache-Aside)
1. App checks cache first
2. Cache miss -> read from DB -> write to cache
3. Pros: only requested data cached. Cons: cache miss penalty, stale data

### Write-Through
1. App writes to cache AND DB simultaneously
2. Pros: cache always current. Cons: write latency, unused data cached

### Session Store
- Store user sessions in Redis/Memcached
- Stateless application servers (any server can handle any request)

## Purpose-Built Databases

| Database | Type | Use Case |
|----------|------|----------|
| **RDS/Aurora** | Relational | Transactions, complex queries, ACID |
| **DynamoDB** | Key-value/Document | High scale, low latency, flexible schema |
| **Redshift** | Columnar warehouse | Analytics, BI, petabyte-scale OLAP |
| **Neptune** | Graph | Social networks, fraud detection, recommendations |
| **DocumentDB** | Document (MongoDB) | Content management, catalogs, user profiles |
| **Timestream** | Time series | IoT, DevOps metrics, application monitoring |
| **QLDB** | Ledger | Financial transactions, audit, immutable history |
| **MemoryDB** | In-memory (Redis) | Durable microsecond-latency workloads |
| **Keyspaces** | Wide column (Cassandra) | Cassandra migration to managed service |

## Common Exam Mistakes

- Choosing RDS when Aurora provides better HA (15 replicas, ms failover)
- Using GSI when LSI is needed (LSI must be created at table creation)
- Forgetting DynamoDB on-demand mode for unpredictable workloads
- Not using DAX for DynamoDB read-heavy workloads (microsecond latency)
- Using RDS for analytics instead of Redshift (OLTP vs OLAP)
`,

  quiz: [
    {
      question: 'How many read replicas can Aurora support vs standard RDS?',
      options: ['Aurora: 5, RDS: 15', 'Aurora: 15 with ms failover, RDS: 5 with seconds failover', 'Both support 15', 'Both support 5'],
      correct: 1,
      explanation: 'Aurora supports up to 15 replicas with millisecond failover (shared storage). Standard RDS supports up to 5 replicas with seconds of failover time.',
      reference: 'Aurora: 15 replicas, ms failover, shared storage. RDS: 5 replicas, seconds failover, async replication.'
    },
    {
      question: 'What is the difference between DynamoDB GSI and LSI?',
      options: ['GSI is faster than LSI', 'GSI can be created anytime with different partition key; LSI must be created at table creation with same partition key', 'LSI supports eventual consistency only', 'GSI shares table capacity'],
      correct: 1,
      explanation: 'GSI: different partition key, created anytime, eventually consistent only, own capacity. LSI: same partition key, created at table creation only, supports strong consistency, shares table capacity.',
      reference: 'GSI = flexible, anytime, eventual only. LSI = same partition, at creation, strong consistency option.'
    },
    {
      question: 'Which database should you choose for real-time analytics on petabytes of data?',
      options: ['RDS MySQL', 'DynamoDB', 'Amazon Redshift', 'Amazon Neptune'],
      correct: 2,
      explanation: 'Redshift is a columnar data warehouse designed for OLAP analytics on petabyte-scale data. RDS/Aurora are for OLTP. DynamoDB is key-value. Neptune is graph.',
      reference: 'Redshift = OLAP analytics. RDS/Aurora = OLTP transactions. DynamoDB = key-value scale.'
    },
    {
      question: 'What caching pattern ensures the cache is always up-to-date?',
      options: ['Lazy Loading', 'Write-Through', 'Cache-Aside', 'Read-Through'],
      correct: 1,
      explanation: 'Write-Through writes to cache AND database simultaneously. Cache is always current. Tradeoff: write latency increases and unused data may be cached.',
      reference: 'Write-Through = always current. Lazy Loading = stale possible but only caches what is read.'
    },
    {
      question: 'When should you use DynamoDB on-demand capacity mode?',
      options: ['For steady-state production workloads', 'For unpredictable or spiky traffic patterns', 'When you need the lowest cost', 'For batch processing only'],
      correct: 1,
      explanation: 'On-demand: no capacity planning, scales instantly, pay per request. Best for new tables, unpredictable traffic, or spiky workloads. Provisioned is cheaper for steady-state.',
      reference: 'On-demand = unpredictable/spiky. Provisioned = steady-state (cheaper). Auto-scaling = middle ground.'
    },
    {
      question: 'What does Aurora Backtrack do?',
      options: ['Creates a backup snapshot', 'Rewinds the database to any point within 72 hours without creating a restore', 'Replicates to another Region', 'Migrates from RDS to Aurora'],
      correct: 1,
      explanation: 'Backtrack rewinds the Aurora database to a specific point in time (up to 72 hours) without creating a new instance. Much faster than snapshot restore. Aurora MySQL only.',
      reference: 'Backtrack = rewind in-place (seconds). Restore from snapshot = create new instance (minutes/hours).'
    },
    {
      question: 'Which database is best for social network relationship queries?',
      options: ['DynamoDB', 'Amazon Neptune', 'Amazon Redshift', 'RDS PostgreSQL'],
      correct: 1,
      explanation: 'Neptune is a graph database optimized for relationship queries (friends, recommendations, fraud detection). Supports Gremlin and SPARQL query languages.',
      reference: 'Neptune = graph (relationships). DynamoDB = key-value. Redshift = analytics. RDS = relational.'
    },
    {
      question: 'What is DynamoDB DAX and how does it help?',
      options: ['A backup tool', 'An in-VPC write-through cache providing microsecond read latency, API-compatible with DynamoDB', 'A migration tool', 'A monitoring dashboard'],
      correct: 1,
      explanation: 'DAX: in-VPC cache for DynamoDB. Microsecond read latency (vs single-digit ms). Write-through. API-compatible (drop-in, no code changes needed).',
      reference: 'DAX = microsecond reads, API-compatible, write-through. For read-heavy DynamoDB workloads.'
    }
  ],

  flashcards: [
    { front: 'Aurora vs RDS key differences?', back: 'Aurora: auto-scaling storage to 128TB, 15 replicas (ms failover), shared storage (no replication lag), Serverless v2, Global Database (<1s), Backtrack (72h rewind), fast Cloning. RDS: EBS-based, 5 replicas, async replication.' },
    { front: 'DynamoDB GSI vs LSI?', back: 'GSI: different partition key, create anytime, eventually consistent only, own capacity. LSI: same partition key as table, create at table creation ONLY, supports strong consistency, shares table capacity.' },
    { front: 'DynamoDB capacity modes?', back: 'On-Demand: pay per request, no planning, instant scaling (unpredictable). Provisioned: specify RCU/WCU, cheaper steady-state. Auto-Scaling: adjusts provisioned based on utilization. Switch between modes once per 24h.' },
    { front: 'ElastiCache patterns?', back: 'Lazy Loading: check cache first, miss->DB->cache (stale possible, only caches what is read). Write-Through: write cache+DB together (always current, write latency). Session Store: stateless servers.' },
    { front: 'Purpose-built databases?', back: 'RDS/Aurora: relational OLTP. DynamoDB: key-value scale. Redshift: columnar OLAP. Neptune: graph. DocumentDB: MongoDB. Timestream: time series. QLDB: ledger. MemoryDB: durable Redis. Keyspaces: Cassandra.' },
    { front: 'What is Aurora Backtrack?', back: 'Rewind Aurora database to any point within 72 hours WITHOUT creating a new instance. In-place rewind in seconds. Much faster than snapshot restore. Aurora MySQL only. Pay per change record stored.' },
    { front: 'DynamoDB partition key design?', back: 'Choose HIGH CARDINALITY keys (userId, orderId) for even distribution. Avoid hot partitions. Sort key enables range queries within partition. Consider composite keys for complex access patterns.' },
    { front: 'What is DynamoDB DAX?', back: 'In-VPC write-through cache. Microsecond reads (vs ms for DynamoDB). API-compatible (drop-in replacement). Ideal for read-heavy, latency-sensitive workloads. Does NOT help with writes.' }
  ],

  lab: {
    scenario: 'Design a database architecture for an e-commerce platform.',
    objective: 'Practice database selection, caching strategy, and read replica configuration.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Aurora Cluster with Read Replica',
        instruction: 'Create an Aurora PostgreSQL cluster with 1 writer and 1 reader instance for read scaling.',
        hints: ['Aurora cluster has a writer endpoint and reader endpoint', 'Reader endpoint load-balances across all read replicas'],
        solution: '```bash\n# Create Aurora cluster\naws rds create-db-cluster --db-cluster-identifier ecommerce-db \\\n  --engine aurora-postgresql --engine-version 15.4 \\\n  --master-username admin --master-user-password MyP@ss123 \\\n  --db-subnet-group-name my-subnet-group\n\n# Create writer instance\naws rds create-db-instance --db-instance-identifier ecommerce-writer \\\n  --db-cluster-identifier ecommerce-db \\\n  --db-instance-class db.r6g.large --engine aurora-postgresql\n\n# Create reader instance\naws rds create-db-instance --db-instance-identifier ecommerce-reader \\\n  --db-cluster-identifier ecommerce-db \\\n  --db-instance-class db.r6g.large --engine aurora-postgresql\n```',
        verify: '```bash\naws rds describe-db-clusters --db-cluster-identifier ecommerce-db \\\n  --query "DBClusters[0].{Writer:Endpoint,Reader:ReaderEndpoint,Members:DBClusterMembers[*].DBInstanceIdentifier}"\n# Expected: 2 members (writer + reader), both endpoints available\n```'
      },
      {
        title: 'Design DynamoDB Table with GSI',
        instruction: 'Create a DynamoDB orders table with orderId as partition key, and a GSI on customerId for querying orders by customer.',
        hints: ['Partition key should be high cardinality', 'GSI has its own capacity settings'],
        solution: '```bash\naws dynamodb create-table --table-name Orders \\\n  --attribute-definitions \\\n    AttributeName=orderId,AttributeType=S \\\n    AttributeName=customerId,AttributeType=S \\\n  --key-schema AttributeName=orderId,KeyType=HASH \\\n  --global-secondary-indexes \\\n    \'[{"IndexName":"customer-index","KeySchema":[{"AttributeName":"customerId","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]\' \\\n  --billing-mode PAY_PER_REQUEST\n```',
        verify: '```bash\naws dynamodb describe-table --table-name Orders \\\n  --query "Table.{Status:TableStatus,GSIs:GlobalSecondaryIndexes[*].IndexName,KeySchema:KeySchema}"\n# Expected: ACTIVE status, GSI customer-index, HASH key orderId\n```'
      },
      {
        title: 'Choose the Right Database for Each Use Case',
        instruction: 'Match these workloads to the best database: (1) Real-time fraud detection with relationship queries, (2) IoT sensor metrics with time-based queries, (3) High-traffic product catalog with millisecond latency.',
        hints: ['Think about the data model each workload needs', 'Purpose-built databases optimize for specific access patterns'],
        solution: '```\n1. Fraud detection (relationships) -> Amazon Neptune (graph DB)\n   - Traverses relationships between entities\n   - Detects patterns across connected nodes\n\n2. IoT sensor metrics (time series) -> Amazon Timestream\n   - Optimized for time-ordered data\n   - Built-in time aggregation functions\n   - Automatic data tiering (recent in memory, old in storage)\n\n3. Product catalog (key-value, low latency) -> DynamoDB + DAX\n   - Flexible schema for varied product attributes\n   - Single-digit ms latency (microseconds with DAX)\n   - Auto-scaling for traffic spikes\n```',
        verify: '```bash\n# Decision framework:\n# Relationships -> Neptune (graph)\n# Time series -> Timestream\n# Key-value at scale -> DynamoDB\n# Relational/ACID -> RDS/Aurora\n# Analytics/OLAP -> Redshift\n# Document/MongoDB -> DocumentDB\n# Immutable ledger -> QLDB\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'DynamoDB Hot Partition Causing Throttling',
      difficulty: 'hard',
      symptom: 'DynamoDB table has sufficient provisioned capacity but some requests are throttled (ProvisionedThroughputExceededException).',
      diagnosis: '```\nHot partition causes:\n1. Low-cardinality partition key (e.g., date, status)\n   All traffic goes to same partition\n\n2. Popular items: one item gets disproportionate reads\n\n3. Uneven access: some partitions get 99% of traffic\n\nDiagnosis:\n  CloudWatch: ConsumedReadCapacityUnits per partition\n  CloudWatch Contributor Insights: identify hot keys\n  \n  Check partition key distribution:\n  - date as PK: all today traffic on one partition\n  - status as PK: most items "active" on one partition\n```',
      solution: 'Redesign partition key for high cardinality (userId, orderId). Add random suffix for write-heavy (e.g., date#rand(1-10)). Use DAX cache for hot read items. Enable DynamoDB auto-scaling or switch to on-demand. Consider Contributor Insights to identify hot keys.'
    },
    {
      title: 'Aurora Read Replica Lag Affecting Application',
      difficulty: 'medium',
      symptom: 'Application reads from Aurora reader endpoint return stale data shortly after writes.',
      diagnosis: '```\nAurora replication:\n- Uses shared storage (not async log replication)\n- Typical lag: <100ms (much better than RDS)\n- But still eventually consistent for readers\n\nChecklist:\n1. Check replica lag:\n   CloudWatch: AuroraReplicaLag metric\n   Normal: <20ms, Problem: >100ms consistently\n\n2. Too many replicas competing for resources?\n3. Reader instance class too small?\n4. Application doing read-after-write that needs consistency?\n\nFor strong consistency after writes:\n  - Read from writer endpoint (not reader)\n  - Use cluster endpoint for writes, reader endpoint for reads\n```',
      solution: 'For read-after-write consistency, read from the writer endpoint immediately after writing. For general reads, use the reader endpoint (eventually consistent). If lag is consistently high, check reader instance size and CloudWatch metrics. Aurora lag is typically <100ms (much better than RDS async replication).'
    }
  ]
};
