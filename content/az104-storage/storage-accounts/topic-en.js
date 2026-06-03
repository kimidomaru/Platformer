window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-storage/storage-accounts'] = {
  theory: `# Azure Storage Accounts

## Exam Relevance
> Estimated weight **15-20%** on AZ-104. Questions cover redundancy types, access tiers, security and storage access control.

## Core Concepts

### What is a Storage Account?
A single container that groups all Azure storage services:
- **Blob Storage** — unstructured objects/files
- **Azure Files** — managed SMB/NFS shares
- **Queue Storage** — messages for decoupling
- **Table Storage** — key-value NoSQL data

### Storage Account Types

| Type | Description | Use |
|------|-------------|-----|
| **Standard General-purpose v2 (GPv2)** | Most complete, supports everything | Most cases |
| **Premium Block Blobs** | SSD, high performance for blobs | High-I/O workloads |
| **Premium File Shares** | SSD for Azure Files | High-performance file shares |
| **Premium Page Blobs** | SSD for page blobs | VM disks |
| **Azure Data Lake Storage Gen2** | Hierarchical namespace | Big Data and analytics |

### Redundancy (Replication)

| Acronym | Name | Copies | Geo-redundant | Read from Secondary |
|---------|------|--------|--------------|---------------------|
| **LRS** | Locally Redundant | 3 (same DC) | ❌ | ❌ |
| **ZRS** | Zone Redundant | 3 (different zones) | ❌ | ❌ |
| **GRS** | Geo-Redundant | 6 (3+3 other region) | ✅ | ❌ |
| **GZRS** | Geo-Zone Redundant | 6 (ZRS+3 other region) | ✅ | ❌ |
| **RA-GRS** | Read-Access Geo-Redundant | 6 | ✅ | ✅ |
| **RA-GZRS** | Read-Access Geo-Zone Redundant | 6 | ✅ | ✅ |

> **For the exam**: RA-GRS and RA-GZRS are the only options that allow **reads** from the secondary region without a failover.

### Access Tiers (Blob only)

| Tier | Storage Cost | Access Cost | Latency | Ideal Use |
|------|--------------|---------|---------|----|
| **Hot** | High | Low | ms | Frequently accessed data |
| **Cool** | Medium | Medium | ms | Monthly-accessed data |
| **Cold** | Low | High | ms | Data accessed every 90+ days |
| **Archive** | Very low | Very high | hours | Backup/compliance, rarely accessed |

> **Archive**: the blob goes **offline** — to access it, you must **rehydrate** (move to Hot/Cool), which takes hours.

### Security and Access Control

**Shared Access Signature (SAS)**: a signed URL with permissions and expiry
- **Service SAS**: access to a specific service (blob, file, queue, table)
- **Account SAS**: access to multiple services
- **User Delegation SAS**: signed with Entra ID credentials (most secure)

**Stored Access Policy**: defines a reusable SAS that can be revoked without changing the base URL.

**Storage Firewall**: restricts access by IP or Virtual Network (Service Endpoints/Private Endpoints)

**Access Keys**: primary and secondary keys that grant full access to the account. Should be rotated regularly or managed via Key Vault.

**Soft Delete**: recover accidentally deleted blobs/containers (configurable from 1–365 days)

**Versioning**: automatically keeps previous versions of blobs

### Lifecycle Management
Automates movement between tiers and deletion:
\`\`\`json
{
  "rules": [{
    "name": "move-to-cool",
    "type": "Lifecycle",
    "definition": {
      "actions": {
        "baseBlob": {
          "tierToCool": {"daysAfterModificationGreaterThan": 30},
          "tierToArchive": {"daysAfterModificationGreaterThan": 90},
          "delete": {"daysAfterModificationGreaterThan": 365}
        }
      },
      "filters": {"blobTypes": ["blockBlob"]}
    }
  }]
}
\`\`\`

## Essential Commands (Azure CLI)

\`\`\`bash
# Create a Storage Account
az storage account create \\
  --name mystorageaccount \\
  --resource-group myRG \\
  --location eastus \\
  --sku Standard_GRS \\
  --kind StorageV2 \\
  --access-tier Hot \\
  --https-only true

# List Storage Accounts
az storage account list --resource-group myRG --output table

# View details and replication settings
az storage account show \\
  --name mystorageaccount \\
  --resource-group myRG \\
  --query "{Name:name,SKU:sku.name,Tier:accessTier,Https:enableHttpsTrafficOnly}" -o table

# Create a blob container
az storage container create \\
  --name mycontainer \\
  --account-name mystorageaccount \\
  --public-access off

# Upload a file
az storage blob upload \\
  --account-name mystorageaccount \\
  --container-name mycontainer \\
  --name file.txt \\
  --file ./file.txt

# Generate a SAS token for a blob (valid for 1 hour)
az storage blob generate-sas \\
  --account-name mystorageaccount \\
  --container-name mycontainer \\
  --name file.txt \\
  --permissions r \\
  --expiry $(date -u -d '1 hour' '+%Y-%m-%dT%H:%MZ') \\
  --output tsv

# Change the access tier of a blob
az storage blob set-tier \\
  --account-name mystorageaccount \\
  --container-name mycontainer \\
  --name file.txt \\
  --tier Cool

# Create a lifecycle management policy
az storage account management-policy create \\
  --account-name mystorageaccount \\
  --resource-group myRG \\
  --policy @lifecycle-policy.json

# Update the replication type
az storage account update \\
  --name mystorageaccount \\
  --resource-group myRG \\
  --sku Standard_RAGRS

# Enable soft delete for blobs
az storage blob service-properties delete-policy update \\
  --account-name mystorageaccount \\
  --enable true \\
  --days-retained 30
\`\`\`

## Common Mistakes

1. **Storage account name**: must be **globally unique**, 3–24 characters, lowercase letters and numbers only.
2. **Archive tier cannot be the default account tier**: Archive can only be set per individual blob.
3. **Changing from LRS to ZRS**: requires a live migration or recreation — it is not an instant conversion.
4. **Expired SAS**: always check the \`se=\` (signedExpiry) field in the SAS URL.
5. **Access denied with key**: check whether "Allow storage account key access" is enabled.

## Killer.sh Style Challenge

> **Scenario**: You need to create a storage solution that:
> 1. Keeps critical data resilient to zone failures and also in another region, with reads possible from the secondary region
> 2. Rarely accessed blobs should be moved automatically to Archive after 90 days
> 3. After 365 days without access, blobs should be deleted
> 4. Accidentally deleted blobs should be recoverable for 14 days
>
> **Which redundancy SKU? How do you configure lifecycle and soft delete?**
>
> **Answer**: SKU **Standard_RAGZRS** (RA-GZRS). Lifecycle policy: tierToArchive after 90 days, delete after 365 days. Enable blob soft delete with 14-day retention.
`,

  quiz: [
    {
      question: 'A company needs its Azure Blob data to be resilient to a full datacenter failure in a region AND have the team be able to read data from the secondary region during a disaster, without initiating a failover. Which redundancy SKU should be used?',
      options: [
        'GRS (Geo-Redundant Storage)',
        'ZRS (Zone-Redundant Storage)',
        'RA-GRS (Read-Access Geo-Redundant Storage)',
        'LRS (Locally-Redundant Storage)'
      ],
      correct: 2,
      explanation: 'RA-GRS maintains 6 copies (3 in the primary region + 3 in the secondary) AND allows reads from the secondary region without a failover. GRS also replicates to another region but does not allow reads from the secondary without initiating a failover. ZRS only protects against zone failures in the same region.',
      reference: 'Memorize: RA-GRS = GRS + reads from secondary. RA-GZRS = GZRS + reads from secondary.'
    },
    {
      question: 'A blob in the "Archive" tier needs to be accessed urgently. What is the correct process?',
      options: [
        'Click "Download" in the portal — Archive blobs are accessed instantly',
        'Rehydrate to the Hot or Cool tier (can take hours) before you can access it',
        'Delete the blob and re-upload it in another tier',
        'Create a special SAS token for Archive blobs'
      ],
      correct: 1,
      explanation: 'Blobs in the Archive tier are offline and cannot be accessed directly. You must rehydrate (move to Hot or Cool) before accessing them. Rehydration can take up to 15 hours at standard priority, or less with High priority (at extra cost).',
      reference: 'Archive = offline storage. Always rehydrate first. Factor in rehydration time when designing your solution.'
    },
    {
      question: 'What is the main difference between a Service SAS and a User Delegation SAS?',
      options: [
        'Service SAS is for blobs; User Delegation SAS is for files',
        'User Delegation SAS is signed with Entra ID credentials and does not expose account keys; Service SAS uses account keys',
        'There is no security difference, only naming',
        'Service SAS lasts longer than User Delegation SAS'
      ],
      correct: 1,
      explanation: 'User Delegation SAS is created using Entra ID credentials (via OAuth), without exposing the storage account keys. It is considered more secure because: it does not reveal the master keys, can be revoked via Entra ID, and is audited in Azure AD. Service SAS and Account SAS are signed with account keys.',
      reference: 'Best practice: prefer User Delegation SAS over Service/Account SAS whenever possible.'
    },
    {
      question: 'An organization wants to ensure that accidentally deleted blobs can be recovered for up to 30 days. Which feature should be enabled?',
      options: [
        'Blob Versioning',
        'Blob Soft Delete',
        'Azure Backup for Storage',
        'Blob Immutability (WORM)'
      ],
      correct: 1,
      explanation: 'Blob Soft Delete retains deleted blobs for a configurable period (1–365 days) before permanent removal. During that period, the blob can be restored. Versioning keeps previous versions, but the deleted blob also needs soft delete to be recoverable.',
      reference: 'Soft delete = recycle bin for blobs. Versioning = change history. Both can be used together.'
    },
    {
      question: 'What is the correct storage hierarchy in Azure Blob Storage?',
      options: [
        'Storage Account → Blob → Container',
        'Storage Account → Container → Blob',
        'Subscription → Storage Account → Blob',
        'Resource Group → Container → Blob'
      ],
      correct: 1,
      explanation: 'The hierarchy is: Storage Account (account) → Container (like a "root folder") → Blob (file/object). A storage account can have millions of containers, each container can hold billions of blobs.',
      reference: 'Analogy: Storage Account = external hard drive, Container = root folder, Blob = file.'
    },
    {
      question: 'You want to automatically move blobs to the Cool tier after 30 days without modification and delete them after 1 year. Which Azure Storage feature should you use?',
      options: [
        'Azure Backup Policies',
        'Blob Versioning',
        'Lifecycle Management Policies',
        'Azure Policy with Modify effect'
      ],
      correct: 2,
      explanation: 'Lifecycle Management Policies automate movement between tiers (Hot→Cool→Cold→Archive) and deletion based on blob age (days since creation, last modification or last access). Configured via JSON rules on the storage account.',
      reference: 'Lifecycle = tiering automation. Combine with Soft Delete for accidental recovery and Archive for very old data.'
    },
    {
      question: 'What is the difference between ZRS and LRS in terms of fault protection?',
      options: [
        'LRS protects against zone failures; ZRS protects against datacenter failures',
        'LRS makes 3 copies in the same datacenter; ZRS makes 3 copies in different availability zones in the same region',
        'ZRS replicates to another region; LRS keeps everything in the same region',
        'There is no practical difference, only cost'
      ],
      correct: 1,
      explanation: 'LRS (Locally Redundant) makes 3 copies within the same datacenter — protects against hardware failure but not against a full datacenter failure. ZRS (Zone Redundant) makes 3 copies in different availability zones — protects against a full datacenter failure in the region. ZRS is more resilient and more expensive than LRS.',
      reference: 'LRS < ZRS < GRS < GZRS in protection level (and cost).'
    }
  ],

  flashcards: [
    {
      front: 'What are the 6 Azure Storage redundancy types and which one allows reads from the secondary region?',
      back: '| SKU | Protection | Secondary Reads |\n|-----|------------|------------------|\n| **LRS** | Same datacenter | ❌ |\n| **ZRS** | 3 zones, same region | ❌ |\n| **GRS** | 2 regions | ❌ |\n| **GZRS** | ZRS + another region | ❌ |\n| **RA-GRS** | 2 regions | ✅ |\n| **RA-GZRS** | GZRS + secondary reads | ✅ |\n\nOnly **RA-GRS** and **RA-GZRS** allow reads from the secondary without a failover.'
    },
    {
      front: 'What are the 4 Blob Storage access tiers and their characteristics?',
      back: '| Tier | Storage Cost | Access Cost | Availability |\n|------|-------------|-------------|---------------|\n| **Hot** | High | Low | Immediate |\n| **Cool** | Medium | Medium | Immediate |\n| **Cold** | Low | High | Immediate |\n| **Archive** | Very low | Very high | **Offline** (hours to rehydrate) |\n\nOnly Hot and Cool can be the default account tier.'
    },
    {
      front: 'What is rehydration in the context of Azure Blob Archive?',
      back: 'The process of moving a blob from the **Archive** tier (offline) to **Hot** or **Cool** before it can be accessed.\n\nDuration: up to **15 hours** at Standard priority, less with High priority (extra cost).\n\nWays to rehydrate:\n1. Change tier: \`az storage blob set-tier --tier Cool\`\n2. Copy the blob to another container in Hot/Cool tier'
    },
    {
      front: 'What is the naming rule for Storage Accounts in Azure?',
      back: 'The name must be:\n- **Globally unique** across all of Azure\n- Between **3 and 24 characters**\n- Only **lowercase letters and numbers** (no hyphens, underscores or uppercase)\n\nValid example: \`technovastorage2024\`\nInvalid: \`TechNova-Storage\`, \`my_storage\`, \`ab\` (too short)'
    },
    {
      front: 'What is the difference between Blob Versioning and Blob Soft Delete?',
      back: '**Soft Delete**: retains *deleted* blobs for N days (recycle bin). Lets you restore the state before deletion.\n\n**Versioning**: automatically saves *previous versions* of modified blobs. Lets you restore any earlier version of a still-existing blob.\n\nUsed together: soft delete recovers the deleted blob (as a previous version), versioning recovers content before a modification.'
    },
    {
      front: 'How does a Lifecycle Management Policy work in Azure Storage?',
      back: 'Defines automatic rules based on **blob age**:\n\n``\`json\n{\n  "actions": {\n    "baseBlob": {\n      "tierToCool": {"daysAfterModificationGreaterThan": 30},\n      "tierToArchive": {"daysAfterModificationGreaterThan": 90},\n      "delete": {"daysAfterModificationGreaterThan": 365}\n    }\n  },\n  "filters": {"blobTypes": ["blockBlob"]}\n}\n\```\n\nAlso supports: snapshots, versions, filters by name prefix.'
    }
  ],

  lab: {
    scenario: 'Configure a storage solution for TechNova with different tiers, SAS tokens and redundancy verification.',
    objective: 'Create Storage Accounts with different SKUs, manage blobs, configure access tiers and generate SAS tokens.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create a Storage Account with GRS',
        instruction: `Create a Storage Account called \`technovastorage<unique-suffix>\` with GRS (Geo-Redundant Storage) redundancy and a Hot default tier.`,
        hints: [
          'The name must be globally unique — add a random number',
          'SKU for GRS: \`Standard_GRS\`',
          'Use \`--kind StorageV2\` for General Purpose v2'
        ],
        solution: `\`\`\`bash
# Generate a unique suffix based on the timestamp
SUFFIX=$(date +%s | tail -c 5)
SA_NAME="technovastorage\${SUFFIX}"
echo "Storage Account: $SA_NAME"

# Create the Resource Group
az group create --name rg-storage-lab --location eastus

# Create the Storage Account with GRS
az storage account create \\
  --name $SA_NAME \\
  --resource-group rg-storage-lab \\
  --location eastus \\
  --sku Standard_GRS \\
  --kind StorageV2 \\
  --access-tier Hot \\
  --https-only true \\
  --min-tls-version TLS1_2

echo "SA_NAME=$SA_NAME" > /tmp/lab-vars.sh
\`\`\``,
        verify: `\`\`\`bash
source /tmp/lab-vars.sh
az storage account show \\
  --name $SA_NAME \\
  --resource-group rg-storage-lab \\
  --query "{Name:name,SKU:sku.name,Tier:accessTier,TLS:minimumTlsVersion}" -o table
# Expected output: Standard_GRS | Hot | TLS1_2
\`\`\``
      },
      {
        title: 'Create a container, upload a file and change the tier',
        instruction: `Create a container called \`backups\`, upload a test file and change the blob tier to Cool.`,
        hints: [
          'Use \`az storage container create\` with \`--public-access off\`',
          'To create a test file: \`echo "test content" > test.txt\`',
          '\`az storage blob set-tier\` to change the tier'
        ],
        solution: `\`\`\`bash
source /tmp/lab-vars.sh

# Get the connection string
CONN_STR=$(az storage account show-connection-string \\
  --name $SA_NAME --resource-group rg-storage-lab --query connectionString -o tsv)

# Create a private container
az storage container create \\
  --name backups \\
  --connection-string "$CONN_STR" \\
  --public-access off

# Create a test file
echo "Test backup file - $(date)" > /tmp/backup-test.txt

# Upload the file
az storage blob upload \\
  --container-name backups \\
  --name "backup-2024.txt" \\
  --file /tmp/backup-test.txt \\
  --connection-string "$CONN_STR"

# Check current tier (Hot by default)
az storage blob show \\
  --container-name backups \\
  --name "backup-2024.txt" \\
  --connection-string "$CONN_STR" \\
  --query "properties.blobTier" -o tsv

# Change to Cool tier
az storage blob set-tier \\
  --container-name backups \\
  --name "backup-2024.txt" \\
  --tier Cool \\
  --connection-string "$CONN_STR"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/lab-vars.sh
CONN_STR=$(az storage account show-connection-string \\
  --name $SA_NAME --resource-group rg-storage-lab --query connectionString -o tsv)

az storage blob show \\
  --container-name backups \\
  --name "backup-2024.txt" \\
  --connection-string "$CONN_STR" \\
  --query "properties.blobTier" -o tsv
# Expected output: Cool
\`\`\``
      },
      {
        title: 'Generate a SAS token with expiry',
        instruction: `Generate a read SAS token for the \`backup-2024.txt\` blob with a 2-hour expiry. Test access via URL.`,
        hints: [
          '\`az storage blob generate-sas\` with \`--permissions r\`',
          'Combine the blob base URL with the SAS token',
          '\`az storage account show --query primaryEndpoints.blob\` for the base URL'
        ],
        solution: `\`\`\`bash
source /tmp/lab-vars.sh
CONN_STR=$(az storage account show-connection-string \\
  --name $SA_NAME --resource-group rg-storage-lab --query connectionString -o tsv)

# Generate SAS token valid for 2 hours
EXPIRY=$(date -u -d '2 hours' '+%Y-%m-%dT%H:%MZ' 2>/dev/null || date -u -v+2H '+%Y-%m-%dT%H:%MZ')
SAS_TOKEN=$(az storage blob generate-sas \\
  --container-name backups \\
  --name "backup-2024.txt" \\
  --permissions r \\
  --expiry "$EXPIRY" \\
  --connection-string "$CONN_STR" \\
  --output tsv)

# Build the full URL
BLOB_URL="https://\${SA_NAME}.blob.core.windows.net/backups/backup-2024.txt?\${SAS_TOKEN}"
echo "SAS URL: $BLOB_URL"

# Test access (should return the file content)
curl -s "$BLOB_URL"
\`\`\``,
        verify: `\`\`\`bash
# Verify that curl returned the file content
echo "If the curl above returned 'Test backup file', the SAS token is working"
# Expected: "Test backup file - <date>"
\`\`\``
      },
      {
        title: 'Clean up resources',
        instruction: `Delete the Resource Group and all resources created.`,
        hints: ['\`az group delete --yes --no-wait\` for asynchronous deletion'],
        solution: `\`\`\`bash
az group delete --name rg-storage-lab --yes --no-wait
echo "Cleanup started! RG will be deleted in a few minutes."
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-storage-lab --query "properties.provisioningState" -o tsv 2>/dev/null || echo "RG not found — deleted successfully"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: '403 error when accessing a blob via SAS token',
      difficulty: 'easy',
      symptom: 'When trying to access a blob via a SAS URL, the user gets "AuthenticationFailed: Signed expiry time... is less than current time".',
      diagnosis: `\`\`\`bash
# Check the SAS URL — the se= field is the expiry time
# Example URL: https://sa.blob.core.windows.net/container/blob?sv=...&se=2024-01-01T00%3A00Z&...
# Decode %3A = :
# se=2024-01-01T00:00Z means it expired on 01/01/2024

# To check the current time in UTC
date -u
\`\`\``,
      solution: `**Cause**: SAS token has expired.

**Solution**: Generate a new SAS token with an appropriate future date:
\`\`\`bash
# New SAS valid for 24 hours
EXPIRY=$(date -u -d '24 hours' '+%Y-%m-%dT%H:%MZ')
az storage blob generate-sas \\
  --account-name <sa-name> \\
  --container-name <container> \\
  --name <blob-name> \\
  --permissions r \\
  --expiry "$EXPIRY" \\
  --auth-mode login  # uses Entra ID credentials (more secure)
\`\`\`

**Prevention**: For permanent access to private blobs, consider using Managed Identity + RBAC instead of SAS tokens.`
    },
    {
      title: 'Archive blob cannot be read immediately',
      difficulty: 'medium',
      symptom: 'Application tries to read a blob and receives "BlobAccessTierNotSupported: This operation is not supported for a rehydration pending blob".',
      diagnosis: `\`\`\`bash
# Check the blob tier and rehydration status
az storage blob show \\
  --account-name <sa-name> \\
  --container-name <container> \\
  --name <blob-name> \\
  --auth-mode login \\
  --query "{Tier:properties.blobTier,RehydrateStatus:properties.rehydrateStatus}" -o json
\`\`\``,
      solution: `**Cause**: The blob is in the Archive tier (offline) or is being rehydrated.

**Solution — option 1: Change tier (in-place rehydration)**:
\`\`\`bash
# Rehydrate with High priority (faster, more expensive)
az storage blob set-tier \\
  --account-name <sa-name> \\
  --container-name <container> \\
  --name <blob-name> \\
  --tier Hot \\
  --rehydrate-priority High \\
  --auth-mode login
\`\`\`

**Solution — option 2: Copy to a new blob in Hot**:
\`\`\`bash
az storage blob copy start \\
  --account-name <sa-name> \\
  --destination-container hot-container \\
  --destination-blob <blob-name> \\
  --source-uri "https://<sa>.blob.core.windows.net/<container>/<blob>"
\`\`\`

**Wait**: Standard priority takes up to 15 hours; High priority takes 1–3 hours.`
    }
  ]
};
