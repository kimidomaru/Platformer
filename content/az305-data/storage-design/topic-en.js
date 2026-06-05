window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-data/storage-design'] = {
  theory: `# Storage Solutions Design (AZ-305)

## Exam Relevance
> Estimated weight **15-20%** in AZ-305. The exam evaluates the ability to choose the correct storage solution for performance, cost, compliance, and access pattern requirements.

## Storage Decision Matrix

\`\`\`
Structured data (rigid schema)?
  ├─ YES + OLTP (transactions) → Azure SQL Database / Managed Instance
  ├─ YES + OLAP (analytics) → Azure Synapse Analytics
  └─ NO (flexible schema)?
       ├─ JSON documents → Cosmos DB (Core SQL or MongoDB API)
       ├─ Simple key-value → Azure Table Storage / Cosmos DB Table API
       ├─ Graphs → Cosmos DB Gremlin API
       └─ Columnar (Cassandra-like) → Cosmos DB Cassandra API

Files and objects?
  ├─ SMB/NFS shares → Azure Files
  ├─ Unstructured objects (blobs) → Azure Blob Storage
  │    ├─ Frequent access → Hot tier
  │    ├─ Monthly access → Cool tier
  │    ├─ Access every 90+ days → Cold tier
  │    └─ Archive/compliance → Archive tier
  ├─ Big data / analytics → Azure Data Lake Storage Gen2
  └─ VM disks → Azure Managed Disks (Premium SSD, Ultra Disk)
\`\`\`

## Azure Blob Storage — Advanced Design

### Pattern: Data Lake Architecture (Medallion)

\`\`\`
Bronze layer (raw)         Silver layer (curated)      Gold layer (business)
  → raw data                 → clean data                → aggregations
  → original format          → normalized schema         → for BI/ML
  → WORM immutability        → delta format              → Synapse/Power BI

Storage Tier:  Cool/Archive   Cool                        Hot
\`\`\`

### Lifecycle Management Policy — Tier Automation

\`\`\`json
{
  "rules": [
    {
      "name": "lifecycle-bronze",
      "type": "Lifecycle",
      "definition": {
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["bronze/"]
        },
        "actions": {
          "baseBlob": {
            "tierToCool": { "daysAfterModificationGreaterThan": 30 },
            "tierToArchive": { "daysAfterModificationGreaterThan": 90 },
            "delete": { "daysAfterModificationGreaterThan": 365 }
          }
        }
      }
    }
  ]
}
\`\`\`

### WORM Immutability for Compliance

\`\`\`bash
# Configure WORM time-based retention (regulatory compliance)
az storage container immutability-policy create \
  --account-name mysa \
  --container-name compliance-records \
  --period 2555      # 7 years in days
  --allow-protected-append-writes false

# Legal hold (indefinite lock for litigation)
az storage container legal-hold set \
  --account-name mysa \
  --container-name legal-hold-bucket \
  --tags "case-2024-001"
\`\`\`

## Azure Managed Disks — Design for VMs

### Choosing the disk type

| Type | Max IOPS | Throughput | Latency | Use Case |
|------|----------|------------|---------|----------|
| Standard HDD | 2,000 | 500 MB/s | ms | Backup, archive |
| Standard SSD | 6,000 | 750 MB/s | < 10ms | Web, dev/test |
| Premium SSD | 20,000 | 900 MB/s | < 5ms | Production, databases |
| Premium SSD v2 | 80,000 | 1,200 MB/s | < 1ms | I/O intensive |
| Ultra Disk | 400,000 | 10 GB/s | < 1ms | SAP HANA, critical Oracle |

### Pattern: Shared Disks for Clusters (SQL Always On)

\`\`\`bash
# Create shared disk for SQL Server Always On
az disk create \
  --name sql-shared-disk \
  --resource-group myRG \
  --size-gb 512 \
  --sku Premium_LRS \
  --max-shares 2 \        # shared between 2 VMs
  --zone 1                # Availability Zone
\`\`\`

## Azure Data Lake Storage Gen2

ADLS Gen2 = Azure Blob Storage + Hierarchical Namespace (HNS):

**Extra features with HNS enabled:**
- Atomic directory operations (rename, delete) — critical for big data
- POSIX ACLs per file/directory (not just per container)
- Native integration with Azure Synapse Analytics, Databricks, HDInsight

\`\`\`bash
# Create storage account with HNS (creates ADLS Gen2)
az storage account create \
  --name mydatalake \
  --resource-group myRG \
  --sku Standard_LRS \
  --kind StorageV2 \
  --enable-hierarchical-namespace true \
  --hierarchical-namespace true

# Create directory structure (different from standard Blob)
az storage fs directory create \
  --account-name mydatalake \
  --file-system bronze \
  --name "2024/01/raw-events"
\`\`\`

## Common Design Mistakes

1. **Blob Storage for relational data**: Blob has no query engine — use Cosmos DB or SQL.
2. **Archive tier for frequently accessed data**: rehydration takes hours and is expensive.
3. **Hot tier for all data**: rarely accessed data in Hot tier wastes budget.
4. **Premium SSD for all disks**: dev/test does not need Premium — Standard SSD is sufficient and cheaper.
5. **No lifecycle policy**: without automation, data grows in the most expensive tier indefinitely.

## Killer.sh Style Challenge (AZ-305)

> **Scenario**: A bank needs to store:
> - Transaction records (last 7 years, never deletable for compliance)
> - PDF reports (frequent access, last 30 days; rare access after)
> - Raw IoT event data (1 TB/day, processed in 48h, deleted after 1 year)
>
> **Design the storage solution.**
>
> **Answer**: (1) Transactions: Azure Blob + WORM time-based retention 7 years (2555 days) + locked immutability. (2) PDFs: Blob Hot for the first 30 days → lifecycle policy changes to Cool after 30 days. (3) IoT: ADLS Gen2 (Bronze) + lifecycle: Cool after 2 days, Archive after 30 days, Delete after 365 days. Parquet format for efficient compression.
`,

  quiz: [
    {
      question: 'Which Azure service should be used to store large volumes of unstructured data that will be processed by Apache Spark and Azure Databricks?',
      options: [
        'Azure Blob Storage (without HNS)',
        'Azure Data Lake Storage Gen2 (ADLS Gen2)',
        'Azure Table Storage',
        'Azure Queue Storage'
      ],
      correct: 1,
      explanation: 'ADLS Gen2 (Blob Storage with Hierarchical Namespace enabled) is optimized for big data analytics: supports atomic directory operations (efficient rename/delete in Spark), granular POSIX ACLs per file, and is the native storage layer for Azure Synapse Analytics, Databricks, and HDInsight. Standard Blob has no HNS and rename/delete operations are inefficient for Spark workloads.',
      reference: 'ADLS Gen2 section — HNS (Hierarchical Namespace) is the critical differentiator for analytics. Remember: ADLS Gen2 = Blob + HNS.'
    },
    {
      question: 'A healthcare company needs to guarantee that digital medical records cannot be deleted or modified for 10 years, not even by administrators. Which Azure Blob Storage feature should they use?',
      options: [
        'Blob Soft Delete with 10 years retention',
        'Resource Locks (ReadOnly) on the containers',
        'WORM immutability with a 10-year Time-based Retention Policy',
        'Azure Backup with 10-year RPO'
      ],
      correct: 2,
      explanation: 'WORM (Write Once Read Many) immutability policies with Time-based Retention guarantee that blobs cannot be modified or deleted during the retention period — not by global administrators, not by Microsoft. It is the only mechanism that meets real regulatory compliance (HIPAA, SEC, FINRA). Soft Delete is reversible; Resource Locks can be removed by an admin.',
      reference: 'WORM Immutability section — locked WORM is irrevocable during retention. Use only for regulatory compliance.'
    },
    {
      question: 'What is the difference between Premium SSD v2 and Ultra Disk in terms of use case?',
      options: [
        'There is no technical difference — only price',
        'Premium SSD v2 offers high I/O with flexible IOPS configuration; Ultra Disk offers extreme performance (400K IOPS) for critical workloads like SAP HANA',
        'Ultra Disk is for Linux; Premium SSD v2 is for Windows',
        'Premium SSD v2 requires Availability Zone; Ultra Disk does not'
      ],
      correct: 1,
      explanation: 'Premium SSD v2 offers independently adjustable IOPS and throughput regardless of disk size, with < 1ms latency and lower cost than Ultra Disk. It is ideal for production databases, SQL Server, etc. Ultra Disk offers IOPS up to 400,000 and throughput of 10 GB/s for the most extreme workloads (SAP HANA, Oracle, SQL Server VLDB). Ultra Disk has region and VM size restrictions.',
      reference: 'Disk table — memorize the hierarchy HDD < Standard SSD < Premium SSD < Premium SSD v2 < Ultra Disk.'
    },
    {
      question: 'Which Lifecycle Management Policy moves blobs from Hot tier to Archive after 90 days without access?',
      options: [
        'tierToArchive: { daysAfterModificationGreaterThan: 90 }',
        'tierToArchive: { daysAfterLastAccessTimeGreaterThan: 90 }',
        'Both options are valid and equivalent',
        'Lifecycle Policies do not support direct transition from Hot to Archive'
      ],
      correct: 2,
      explanation: 'Both approaches are valid: daysAfterModificationGreaterThan moves based on last modification (default), while daysAfterLastAccessTimeGreaterThan moves based on last access (requires Last Access Time tracking enabled on the storage account). For data written once and rarely accessed, modification-based is simpler. For data with variable access patterns, access-time-based is more precise.',
      reference: 'Lifecycle Management section — consider enabling Last Access Time tracking for policies based on real access.'
    }
  ],

  flashcards: [
    {
      front: 'Which Azure storage service for each data type?',
      back: '| Data | Service |\n|------|---------|\n| Flexible JSON documents | Cosmos DB (Core SQL) |\n| Simple key-value, low cost | Azure Table Storage |\n| Unstructured blobs/objects | Azure Blob Storage |\n| Big data + Spark/analytics | ADLS Gen2 (Blob + HNS) |\n| SMB/NFS shares | Azure Files |\n| VM OLTP disks | Premium SSD / Ultra Disk |\n| Analytical data warehouse | Azure Synapse Analytics |\n| In-memory cache | Azure Cache for Redis |'
    },
    {
      front: 'What is ADLS Gen2 and how does it differ from standard Azure Blob Storage?',
      back: '**ADLS Gen2** = Azure Blob Storage + **Hierarchical Namespace (HNS)**\n\n**Extra features with HNS**:\n- Real directories (not just name prefixes)\n- Directory rename/delete is atomic and O(1) — critical for Spark\n- POSIX ACLs per file/directory\n- Compatible with Azure Synapse, Databricks, HDInsight\n\n**Create**: `az storage account create --enable-hierarchical-namespace true`\n\n**Without HNS**: directory rename = copy all blobs + delete originals (O(n)) — slow for petabytes.'
    }
  ],

  lab: {
    scenario: 'Configure a storage solution for compliance data (WORM) and implement automatic lifecycle management.',
    objective: 'Create immutability policies and lifecycle management to optimize cost and ensure compliance.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Storage Account and configure Lifecycle Policy',
        instruction: 'Create a storage account and configure a lifecycle policy to move blobs from Hot to Cool after 30 days and Archive after 90 days.',
        hints: ['az storage account management-policy create', 'JSON policy file'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
SA_NAME="compliance\${SUFFIX}"
az group create --name rg-storage-design --location eastus

az storage account create \
  --name $SA_NAME \
  --resource-group rg-storage-design \
  --sku Standard_LRS \
  --kind StorageV2

az storage container create \
  --name logs --account-name $SA_NAME --auth-mode login
az storage container create \
  --name compliance --account-name $SA_NAME --auth-mode login

# Create lifecycle policy
cat > /tmp/lifecycle.json << 'EOF'
{
  "rules": [{
    "name": "logs-tiering",
    "type": "Lifecycle",
    "definition": {
      "filters": {"blobTypes": ["blockBlob"], "prefixMatch": ["logs/"]},
      "actions": {
        "baseBlob": {
          "tierToCool": {"daysAfterModificationGreaterThan": 30},
          "tierToArchive": {"daysAfterModificationGreaterThan": 90},
          "delete": {"daysAfterModificationGreaterThan": 365}
        }
      }
    }
  }]
}
EOF

az storage account management-policy create \
  --account-name $SA_NAME \
  --resource-group rg-storage-design \
  --policy @/tmp/lifecycle.json

echo "SA_NAME=$SA_NAME" > /tmp/storagedesign.sh
\`\`\``,
        verify: `\`\`\`bash
source /tmp/storagedesign.sh
az storage account management-policy show \
  --account-name $SA_NAME \
  --resource-group rg-storage-design \
  --query "policy.rules[0].name" -o tsv
# Expected: logs-tiering
\`\`\``
      },
      {
        title: 'Configure WORM immutability on the compliance container',
        instruction: 'Configure a 7-year time-based immutability policy on the compliance container.',
        hints: ['az storage container immutability-policy create', 'Period in days: 365*7=2555'],
        solution: `\`\`\`bash
source /tmp/storagedesign.sh

# Configure immutability (7 years = 2555 days)
az storage container immutability-policy create \
  --account-name $SA_NAME \
  --resource-group rg-storage-design \
  --container-name compliance \
  --period 2555

echo "Immutability configured: 7 years (2555 days)"
echo "NOTE: In production, run lock to make it irreversible"
echo "az storage container immutability-policy lock ... (IRREVERSIBLE)"

# Verify configuration
az storage container immutability-policy show \
  --account-name $SA_NAME \
  --resource-group rg-storage-design \
  --container-name compliance
\`\`\``,
        verify: `\`\`\`bash
source /tmp/storagedesign.sh
az storage container immutability-policy show \
  --account-name $SA_NAME \
  --resource-group rg-storage-design \
  --container-name compliance \
  --query "properties.immutabilityPeriodSinceCreationInDays" -o tsv
# Expected: 2555

az group delete --name rg-storage-design --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Lifecycle Policy not moving blobs to Archive as expected',
      difficulty: 'medium',
      symptom: 'Blobs older than 90 days still appear in Hot/Cool tier instead of Archive after configuring a Lifecycle Management Policy.',
      diagnosis: `\`\`\`bash
# Verify the policy exists and is correct
az storage account management-policy show \
  --account-name mysa --resource-group myRG \
  --query "policy.rules[].{Name:name,Prefix:definition.filters.prefixMatch,Action:definition.actions.baseBlob}" -o json

# Check current blob tier
az storage blob list --container-name mycontainer \
  --account-name mysa --auth-mode login \
  --query "[].{Name:name,Tier:properties.blobTier,Modified:properties.lastModified}" -o table
\`\`\``,
      solution: `**Common causes**:

1. **Evaluation has not occurred yet**: lifecycle policies are evaluated once per day (usually overnight). Wait 24-48h.

2. **Incorrect prefix in the policy**: if the policy has \`prefixMatch: ["logs/"]\` but blobs are in \`"log/"\` (without s), they are not affected.

3. **Wrong blob type**: policies with \`blobTypes: ["blockBlob"]\` do not affect appendBlobs or pageBlobs.

4. **Blob in immutable state**: blobs in containers with active WORM cannot have their tier changed.

5. **Access tier tracking not enabled**: if the policy uses \`daysAfterLastAccessTimeGreaterThan\`, tracking must be enabled on the storage account.

\`\`\`bash
# Enable last access time tracking
az storage account blob-service-properties update \
  --account-name mysa --resource-group myRG \
  --enable-last-access-tracking true
\`\`\``
    }
  ]
};
