window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-storage/blob-storage'] = {
  theory: `# Azure Blob Storage & Lifecycle Management

## Exam Relevance
> Estimated weight **8-12%** on AZ-104. Blob types, security, lifecycle and SAS tokens are frequent topics.

## Core Concepts

### Blob Types
- **Block Blob**: generic files, large-volume uploads (up to 190.7 TiB). Most used.
- **Append Blob**: optimized for append-only (logs, auditing). Only appends to the end.
- **Page Blob**: 512-byte blocks, random read/write. Used for VM disks (VHD).

### Immutability (WORM)
- **Time-based retention**: a blob cannot be modified/deleted until the period expires
- **Legal hold**: indefinite lock until explicit removal (e.g. litigation)
- Requires a container with immutability enabled

### Anonymous Access
- **Private** (default): no anonymous access — always requires auth
- **Blob**: anyone can read individual blobs
- **Container**: anyone can list and read the container's blobs

> **Security**: disable anonymous access at the storage account level to prevent accidental exposure.

### Shared Access Signatures (SAS)
\`\`\`
URL with SAS:
https://sa.blob.core.windows.net/container/file.txt?
  sv=2023-01-03     (signed version)
  &ss=b             (signed services: blob)
  &srt=o            (signed resource type: object)
  &sp=r             (signed permissions: read)
  &se=2024-12-31T00:00Z  (expiry)
  &sig=...          (signature)
\`\`\`

### Storage Networking
- **Public endpoint**: accessible over the Internet (default)
- **Service Endpoints**: traffic stays on the Azure network but without a private IP
- **Private Endpoint**: a private IP inside the VNet for fully private access

## Essential Commands (Azure CLI)

\`\`\`bash
# Create a container with private access
az storage container create \\
  --name mycontainer \\
  --account-name mysa \\
  --public-access off \\
  --auth-mode login

# List blobs
az storage blob list \\
  --container-name mycontainer \\
  --account-name mysa \\
  --auth-mode login \\
  --query "[].{Name:name,Tier:properties.blobTier,Size:properties.contentLength}" -o table

# Copy a blob between containers/accounts
az storage blob copy start \\
  --source-account-name sourcesa \\
  --source-container sourcecontainer \\
  --source-blob myblob.txt \\
  --destination-container destcontainer \\
  --destination-blob myblob.txt \\
  --account-name destsa \\
  --auth-mode login

# Create a Stored Access Policy
az storage container policy create \\
  --container-name mycontainer \\
  --name readonly-policy \\
  --account-name mysa \\
  --permissions r \\
  --expiry 2025-12-31T00:00Z \\
  --auth-mode login

# Generate a SAS using a Stored Access Policy
az storage blob generate-sas \\
  --container-name mycontainer \\
  --name myblob.txt \\
  --account-name mysa \\
  --policy-name readonly-policy \\
  --auth-mode login -o tsv
\`\`\`

## Common Mistakes

1. **Publicly exposed blob**: check "Allow Blob Anonymous Access" on the storage account — it must be Disabled.
2. **SAS with wrong permission**: a read-only SAS cannot upload — the "r" permission is read only.
3. **Stored Access Policy revoked but the URL still works briefly**: propagation can take a few minutes.

## Killer.sh Style Challenge

> You need to give temporary upload access (PUT only) to an external partner for a specific blob, valid for 24 hours, in such a way that you can revoke access before the deadline if necessary. How do you do it?
>
> **Answer**: Create a **Stored Access Policy** on the container with the "w" permission and a 24h expiry → generate a SAS using that policy (not inline). If you need to revoke earlier: delete the Stored Access Policy → all SAS based on it are invalidated immediately.
`,

  quiz: [
    {
      question: 'Which blob type is most appropriate for storing application logs that are continuously appended to the same file?',
      options: [
        'Block Blob',
        'Page Blob',
        'Append Blob',
        'Premium Blob'
      ],
      correct: 2,
      explanation: 'Append Blob is optimized for append-only operations — adding data to the end of the blob efficiently. Ideal for logs, auditing and streaming data where only new entries are added. Block Blob supports full writes but requires rewriting the entire block for modifications.',
      reference: 'Block Blob = generic files. Append Blob = logs/streams. Page Blob = VM disks (VHD).'
    },
    {
      question: 'You created a SAS token that expires in 1 hour. A user starts using the URL. You discover they should not have access. How do you revoke it IMMEDIATELY, without waiting for expiration?',
      options: [
        'Delete the blob — this invalidates any existing SAS',
        'Change the Storage Account Access Keys — this invalidates SAS signed with the old key',
        'Change the storage account CORS',
        'It is not possible — SAS cannot be revoked before expiration'
      ],
      correct: 1,
      explanation: 'SAS tokens signed with Access Keys become invalid when the key is rotated/changed. This is the way to revoke an inline SAS immediately. To avoid having to rotate keys, use Stored Access Policies — you can revoke by deleting the policy without affecting other SAS.',
      reference: 'SAS revocation: for inline SAS → rotate the access key. For policy-based SAS → delete the Stored Access Policy.'
    },
    {
      question: 'What should you enable to ensure that regulatory-compliance blobs cannot be deleted or modified by any user, including admins, for 7 years?',
      options: [
        'Blob Soft Delete with 7-year retention',
        'Azure Backup with a 7-year RPO',
        'Blob immutability with a 7-year Time-based Retention Policy (WORM)',
        'Azure Archive tier with a lifecycle lock'
      ],
      correct: 2,
      explanation: 'WORM (Write Once Read Many) immutability policies with Time-based Retention ensure blobs cannot be modified or deleted during the retention period — not even by administrators or by Microsoft. Used for regulatory compliance (FINRA, SEC, CFTC). Soft Delete only protects against accidental deletion (it can be reverted).',
      reference: 'WORM = real immutability for compliance. Soft Delete = reversible accidental protection. They are different use cases.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 3 blob types and their use cases?',
      back: '1. **Block Blob** — Generic files (images, videos, documents, backups). Efficient uploads of large files. Supports up to 190.7 TiB.\n\n2. **Append Blob** — Append-only data (logs, auditing, streaming). Only appends to the end — does not overwrite.\n\n3. **Page Blob** — 512-byte blocks with random R/W access. Used exclusively for VM disks (VHD files).'
    },
    {
      front: 'How do you revoke a SAS token before expiration?',
      back: '**Inline SAS** (signed with an Access Key):\n- Rotating the Storage Account Access Key invalidates all SAS signed with it\n- Impact: all applications using that key need to be updated\n\n**SAS based on a Stored Access Policy**:\n- Deleting the Stored Access Policy invalidates only the SAS associated with it\n- No impact on other SAS or on access via the key\n\nBest practice: always use Stored Access Policies so you can revoke granularly.'
    },
    {
      front: 'What is WORM immutability in Azure Blob Storage?',
      back: '**WORM (Write Once, Read Many)** — blobs cannot be modified or deleted during the retention period:\n\n- **Time-based retention**: sets a period (e.g. 7 years). Not even admins can delete before then.\n- **Legal hold**: indefinite lock until explicit removal (for litigation)\n- Configured per container\n- Supports regulatory compliance: SEC Rule 17a-4, CFTC, FINRA\n\nDifferent from Soft Delete: WORM is irreversible during retention.'
    }
  ],

  lab: {
    scenario: 'Configure advanced security on a Blob container with a Stored Access Policy and check anonymous access.',
    objective: 'Create a container, configure a Stored Access Policy, generate a revocable SAS and verify access.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Create a Storage Account and container',
        instruction: 'Create a storage account and a private container.',
        hints: ['Use a unique suffix for the storage account name'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
SA_NAME="technovastorage\${SUFFIX}"
az group create --name rg-blob-lab --location eastus
az storage account create --name $SA_NAME --resource-group rg-blob-lab \\
  --sku Standard_LRS --kind StorageV2 --https-only true
az storage container create --name confidential \\
  --account-name $SA_NAME --public-access off --auth-mode login
echo "SA_NAME=$SA_NAME" > /tmp/bloblab.sh
\`\`\``,
        verify: `\`\`\`bash
source /tmp/bloblab.sh
az storage container show --name confidential --account-name $SA_NAME \\
  --auth-mode login --query "properties.publicAccess" -o tsv
# Expected output: off (or empty = private)
\`\`\``
      },
      {
        title: 'Upload and Stored Access Policy',
        instruction: 'Upload a file and create a read Stored Access Policy.',
        hints: ['\`az storage container policy create\`'],
        solution: `\`\`\`bash
source /tmp/bloblab.sh
echo "Confidential data" > /tmp/secret.txt
az storage blob upload --container-name confidential \\
  --name secret.txt --file /tmp/secret.txt \\
  --account-name $SA_NAME --auth-mode login

az storage container policy create \\
  --container-name confidential \\
  --name readonly-30min \\
  --account-name $SA_NAME \\
  --permissions r \\
  --expiry $(date -u -d '30 minutes' '+%Y-%m-%dT%H:%MZ' 2>/dev/null || date -u -v+30M '+%Y-%m-%dT%H:%MZ') \\
  --auth-mode login
\`\`\``,
        verify: `\`\`\`bash
source /tmp/bloblab.sh
az storage container policy list --container-name confidential \\
  --account-name $SA_NAME --auth-mode login -o table
# Output: readonly-30min with the 'r' permission
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-blob-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-blob-lab 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Blob accidentally publicly accessible',
      difficulty: 'easy',
      symptom: 'A security audit found blobs accessible without authentication via a public URL.',
      diagnosis: `\`\`\`bash
# Check whether the storage account allows anonymous access
az storage account show --name mysa --resource-group myRG \\
  --query "allowBlobPublicAccess" -o tsv

# List containers with public access
az storage container list --account-name mysa --auth-mode login \\
  --query "[?properties.publicAccess!='off'].{Name:name,Access:properties.publicAccess}" -o table
\`\`\``,
      solution: `**Immediate fix — disable anonymous access at the account level:**
\`\`\`bash
az storage account update --name mysa --resource-group myRG \\
  --allow-blob-public-access false
\`\`\`

This setting overrides individual containers — even if a container has public access enabled, anonymous access will be blocked when it is disabled at the account level.

**Then check and fix individual containers:**
\`\`\`bash
az storage container set-permission --name mycontainer \\
  --account-name mysa --public-access off --auth-mode login
\`\`\``
    }
  ]
};
