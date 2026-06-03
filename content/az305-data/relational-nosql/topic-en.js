window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-data/relational-nosql'] = {
  theory: `# Designing Data Solutions: Relational & NoSQL (AZ-305)

## Exam Relevance
> Estimated weight **25-30%** on AZ-305. The exam evaluates choosing the right data service for different consistency, scale and access-pattern requirements.

## Azure Relational Services

### Azure SQL Database
Managed PaaS for SQL Server:
- **Single Database**: isolated database with dedicated or serverless resources
- **Elastic Pool**: multiple databases share resources (good for SaaS multi-tenant)
- **Managed Instance**: maximum compatibility with on-premises SQL Server (lift-and-shift)
- **SQL Server on VM** (IaaS): full control, all SQL Server features

**Service tiers:**
| Tier | Use | Max Storage | IOPS |
|------|-----|------------|------|
| **Basic/Standard (DTU)** | Small/medium workloads | 250 GB | — |
| **General Purpose (vCore)** | Balanced | 4 TB | Moderate |
| **Business Critical (vCore)** | High performance, Always On | 4 TB | High |
| **Hyperscale (vCore)** | Massive scale | 100 TB | High |
| **Serverless** | Intermittent use | 4 TB | Auto-pause |

**High Availability:**
- **Active Geo-Replication**: readable replicas in other regions
- **Auto-failover groups**: automatic failover with a single endpoint (listener)
- **Zone Redundant**: replicas across Availability Zones (Business Critical/General Purpose)

### Azure Database for PostgreSQL / MySQL
Managed PaaS for PostgreSQL and MySQL:
- **Flexible Server**: more control, availability zones, maintenance window
- Automatic backup (1–35-day retention)
- Scale compute without downtime (for Flexible Server)

### Azure Synapse Analytics
Data warehouse + analytics:
- **Dedicated SQL Pools**: DWU (Data Warehouse Units) for high-performance analytics
- **Serverless SQL Pool**: pay-per-query data lake queries without provisioning
- **Spark Pools**: big data processing with Apache Spark
- Integration with Data Lake Storage Gen2

## Azure NoSQL Services

### Azure Cosmos DB
Multi-model NoSQL database, globally distributed:
- **APIs**: Core (SQL), MongoDB, Cassandra, Gremlin (graph), Table
- **Global Distribution**: replicas in any region, sub-10ms latency
- **Consistency levels** (5 levels):

| Level | Guarantee | Performance |
|-------|-----------|------------|
| **Strong** | Reads always reflect the latest write | Slowest, highest cost |
| **Bounded Staleness** | Defined maximum delay | Balanced |
| **Session** | Consistent for the same client (default) | Good performance |
| **Consistent Prefix** | Reads never see out-of-order writes | Good performance |
| **Eventual** | No order guarantee, fastest | Best performance |

**Capacity model:**
- **Provisioned throughput**: reserved RU/s (Request Units)
- **Autoscale**: scales between min and max RU/s automatically
- **Serverless**: pay per RU consumed (for irregular workloads)

**Partitioning:**
- Partition key defines how data is distributed
- Choose a good partition key: high cardinality, uniform distribution, used in queries

### Azure Table Storage (vs Cosmos DB Table API)
- **Azure Table Storage**: simple key-value, very low cost
- **Cosmos DB Table API**: same API + global scale + stronger SLAs

### Azure Cache for Redis
In-memory cache, sessions, message queues:
- **Tiers**: Basic (no SLA), Standard (replica + SLA), Premium (clustering, geo-replication)
- Use for: session state, frequent-query cache, leaderboards, pub/sub

## Service Decision Matrix

\`\`\`
Need SQL/relational?
  ├─ YES → On-prem SQL Server (lift-and-shift) → Managed Instance
  │         New relational project → Azure SQL Database
  │         Massive data (>4TB), analytics → Hyperscale or Synapse
  │         Open source? → PostgreSQL/MySQL Flexible Server
  │
  └─ NO → What type of data?
            ├─ JSON documents → Cosmos DB (Core SQL or MongoDB API)
            ├─ Graph → Cosmos DB Gremlin
            ├─ Columnar (Cassandra-like) → Cosmos DB Cassandra
            ├─ Simple key-value, low cost → Table Storage
            ├─ Cache/session → Redis Cache
            └─ Big data analytics → Synapse Analytics / Databricks
\`\`\`

## Common Design Mistakes

1. **Cosmos DB for every use case**: Cosmos DB is powerful but expensive — for simple relational workloads, Azure SQL is more appropriate and cheaper.
2. **Strong consistency in multi-region Cosmos DB**: Strong consistency disables reading from secondary replicas (reverts to single-region behavior).
3. **Low-cardinality partition key**: a partition key like "country" at global scale results in hot partitions (e.g. USA = 80% of data).
4. **DTU vs vCore**: DTUs are an abstraction that makes comparison difficult; vCore is preferred for predictable workloads and is more transparent.

## Killer.sh Style Challenge (AZ-305)

> **Scenario**: A global e-commerce company has:
> - Product catalog: 10M items, read-intensive, eventual consistency is OK
> - Orders: critical consistency, relational, ACID compliant
> - Shopping cart: session-based access, temporary data, high speed
> - Sales analytics: complex queries on TBs of historical data
>
> **Which service for each component?**
>
> **Answer**:
> - Catalog: **Cosmos DB** (Core SQL or MongoDB API) with Eventual consistency, partitioned by productCategory
> - Orders: **Azure SQL Database** Business Critical (ACID, high availability with failover groups)
> - Cart: **Azure Cache for Redis** (Standard tier, in-memory, per-user session)
> - Analytics: **Azure Synapse Analytics** with Dedicated SQL Pool or Serverless SQL Pool
`,

  quiz: [
    {
      question: 'A global e-commerce application needs < 10ms latency for reading the product catalog from anywhere in the world. Which Azure database service is most appropriate?',
      options: [
        'Azure SQL Database with Active Geo-Replication',
        'Azure Cosmos DB with global distribution and Eventual consistency',
        'Azure Table Storage in multiple regions',
        'Azure Database for MySQL with read replicas'
      ],
      correct: 1,
      explanation: 'Azure Cosmos DB is designed for global distribution with guaranteed sub-10ms latency for reads/writes in any region. With Eventual consistency, it offers the best performance for catalog reads (rarely changing data). Azure SQL with geo-replication has normal network latency (not guaranteed sub-10ms) and is better suited for critical relational data.',
      reference: 'Cosmos DB = guaranteed sub-10ms latency globally. Ideal for: catalogs, user profiles, read-intensive data with global distribution.'
    },
    {
      question: 'Which Cosmos DB consistency level guarantees that a client always sees its own writes, but not necessarily the writes of other clients?',
      options: [
        'Strong',
        'Eventual',
        'Session',
        'Bounded Staleness'
      ],
      correct: 2,
      explanation: 'Session consistency guarantees that within a client session, reads always reflect the session\'s own writes (read-your-own-writes). It is the default level in Cosmos DB and offers good performance. Strong guarantees all clients see the latest write (slower). Eventual guarantees nothing about order or freshness.',
      reference: 'Session = Cosmos DB default = guarantees you see your own writes. Ideal for user applications where each client needs consistency of their own actions.'
    },
    {
      question: 'When should you choose Azure SQL Managed Instance over Azure SQL Database?',
      options: [
        'When you need very low cost',
        'When migrating on-premises SQL Server with maximum compatibility (SQL Agent, linked servers, CLR)',
        'When you need multi-region global distribution',
        'For machine learning workloads'
      ],
      correct: 1,
      explanation: 'Managed Instance offers ~100% compatibility with on-premises SQL Server, supporting features that Azure SQL Database does not: SQL Agent, linked servers, CLR, database mail, service broker, etc. It is ideal for lift-and-shift of applications that depend on these features. Azure SQL Database is more limited but more managed and scalable.',
      reference: 'Managed Instance = lift-and-shift of SQL Server (maximum compatibility). Azure SQL Database = new cloud-native development. SQL Server on VM = full control, more management.'
    },
    {
      question: 'What is a "Request Unit" (RU) in Azure Cosmos DB?',
      options: [
        'A read latency metric in milliseconds',
        'The throughput currency in Cosmos DB that abstracts the CPU, memory and IOPS needed for an operation',
        'The number of active global replicas',
        'The storage unit per document'
      ],
      correct: 1,
      explanation: 'An RU (Request Unit) is the Cosmos DB throughput currency — an abstraction that combines CPU, memory and IOPS consumed by an operation. A read of a 1KB document costs ~1 RU. Writes cost ~5 RUs. Complex queries cost more. You provision RU/s to guarantee throughput or use serverless to pay per RU consumed.',
      reference: 'RU = cost of operation in Cosmos DB. 1 read of 1KB ≈ 1 RU. Provision RU/s for predictable workloads, serverless for irregular ones.'
    }
  ],

  flashcards: [
    {
      front: 'Which Azure database service to choose for each scenario?',
      back: '| Scenario | Service |\n|---------|--------|\n| SQL Server lift-and-shift | Managed Instance |\n| New relational cloud app | Azure SQL Database |\n| PostgreSQL/MySQL open source | Flexible Server |\n| Global NoSQL, low latency | Cosmos DB |\n| Session/query cache | Azure Cache for Redis |\n| TBs of analytics data | Synapse Analytics |\n| Big Data with Spark | Synapse Spark / Databricks |\n| Simple key-value, minimum cost | Azure Table Storage |'
    },
    {
      front: 'What are the 5 Cosmos DB consistency levels and their trade-offs?',
      back: '**Strong** → always sees the latest write, slowest, expensive, no secondary replica reads\n\n**Bounded Staleness** → defined maximum delay (X updates or T seconds)\n\n**Session** (default) → you see your own writes, others get eventual\n\n**Consistent Prefix** → never sees out-of-order writes, but may be delayed\n\n**Eventual** → fastest, no order or freshness guarantees\n\nTrade-off: more consistency = higher latency + lower replica availability.'
    },
    {
      front: 'What are the differences between Azure SQL Database, Elastic Pool and Managed Instance?',
      back: '**Azure SQL Database** (Single):\n- One isolated database\n- Serverless or provisioned\n- Scale compute independently\n\n**Elastic Pool**:\n- Multiple databases share an RU pool\n- Ideal for SaaS multi-tenant with irregular usage\n- More economical when databases have peaks at different times\n\n**Managed Instance**:\n- Maximum SQL Server compatibility\n- VNet isolated\n- SQL Agent, linked servers, CLR\n- Lift-and-shift of on-prem apps'
    }
  ],

  lab: {
    scenario: 'Compare Azure SQL Database and Cosmos DB by creating an instance of each and understanding the differences in data model.',
    objective: 'Create a serverless Azure SQL Database and a serverless Cosmos DB, explore data model differences.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create an Azure SQL Database (Serverless)',
        instruction: 'Create a SQL Server and a serverless database for development.',
        hints: ['\`az sql server create\` then \`az sql db create --edition GeneralPurpose --compute-model Serverless\`'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-data-lab --location eastus

# Create the SQL Server
az sql server create \\
  --name "technova-sqlsrv-\${SUFFIX}" \\
  --resource-group rg-data-lab \\
  --location eastus \\
  --admin-user sqladmin \\
  --admin-password "P@ssword123!"

# Create a serverless database (auto-pause after 1h of inactivity)
az sql db create \\
  --server "technova-sqlsrv-\${SUFFIX}" \\
  --resource-group rg-data-lab \\
  --name technovadb \\
  --edition GeneralPurpose \\
  --compute-model Serverless \\
  --family Gen5 \\
  --capacity 2 \\
  --auto-pause-delay 60

echo "SQL Server: technova-sqlsrv-\${SUFFIX}.database.windows.net"
echo "SUFFIX=\${SUFFIX}" > /tmp/datalab.sh
\`\`\``,
        verify: `\`\`\`bash
source /tmp/datalab.sh
az sql db show \\
  --server "technova-sqlsrv-\${SUFFIX}" \\
  --resource-group rg-data-lab \\
  --name technovadb \\
  --query "{Name:name,Edition:edition,Model:currentServiceObjectiveName}" -o table
\`\`\``
      },
      {
        title: 'Create Cosmos DB (Serverless)',
        instruction: 'Create a Cosmos DB with Core SQL API in Serverless mode.',
        hints: ['\`az cosmosdb create\` with \`--capabilities EnableServerless\`'],
        solution: `\`\`\`bash
source /tmp/datalab.sh

# Create a Serverless Cosmos DB Account
az cosmosdb create \\
  --name "technova-cosmos-\${SUFFIX}" \\
  --resource-group rg-data-lab \\
  --locations regionName=eastus \\
  --capabilities EnableServerless \\
  --default-consistency-level Session

# Create database and container
az cosmosdb sql database create \\
  --account-name "technova-cosmos-\${SUFFIX}" \\
  --resource-group rg-data-lab \\
  --name catalogdb

az cosmosdb sql container create \\
  --account-name "technova-cosmos-\${SUFFIX}" \\
  --resource-group rg-data-lab \\
  --database-name catalogdb \\
  --name products \\
  --partition-key-path "/category"

echo "Cosmos DB created: technova-cosmos-\${SUFFIX}"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/datalab.sh
az cosmosdb show \\
  --name "technova-cosmos-\${SUFFIX}" \\
  --resource-group rg-data-lab \\
  --query "{Name:name,Consistency:consistencyPolicy.defaultConsistencyLevel,Status:provisioningState}" -o table
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group (it will delete the SQL Server, database and Cosmos DB).',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-data-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-data-lab 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Cosmos DB with high read latency from a specific region',
      difficulty: 'medium',
      symptom: 'A global application using Cosmos DB uses Strong consistency. Users in Asia report 200ms+ latency on reads, even with a replica in the Asian region.',
      diagnosis: `\`\`\`bash
# Check the consistency configuration
az cosmosdb show \\
  --name myCosmosDB --resource-group myRG \\
  --query "{Consistency:consistencyPolicy.defaultConsistencyLevel,Regions:locations[].locationName}" -o json
\`\`\``,
      solution: `**Cause**: Strong consistency in multi-region Cosmos DB forces reads to be synchronized with the write region (global quorum). The Asia replica only responds after confirmation from the primary write region — causing inter-regional round-trip latency.

**Solution 1**: Reduce the consistency level:
\`\`\`bash
az cosmosdb update \\
  --name myCosmosDB --resource-group myRG \\
  --default-consistency-level Session
\`\`\`

**Solution 2**: If Strong is mandatory, configure the write region closer to Asian users (multi-master write) — but this has other conflict implications.

**Consistency guideline**: use Strong only when absolutely necessary (e.g. financial transactions). For most cases, Session or Bounded Staleness are sufficient with better performance.`
    }
  ]
};
