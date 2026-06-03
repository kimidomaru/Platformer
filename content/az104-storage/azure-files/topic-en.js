window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-storage/azure-files'] = {
  theory: `# Azure Files & File Sync

## Exam Relevance
> Estimated weight **5-8%** on AZ-104. Questions about SMB/NFS shares and Azure File Sync for hybrid scenarios.

## Core Concepts

### Azure Files
A managed cloud file-share service:
- **SMB protocol** (Windows, Linux, macOS) — the default for Windows
- **NFS protocol** (Linux) — requires Standard_ZRS or Premium
- Fully managed — no file servers to manage

**Tiers:**
| Tier | Storage Type | Use |
|------|-------------|-----|
| **Transaction optimized** | HDD Standard | General access, cost optimized |
| **Hot** | HDD Standard | Frequent access |
| **Cool** | HDD Standard | Infrequent access, lower cost |
| **Premium** | SSD | Low latency, intensive workloads |

### Azure File Sync
Synchronizes Azure Files with on-premises Windows file servers:
- **Cloud tiering**: less-accessed files stay only in the cloud (local placeholder)
- **Multi-site sync**: multiple Windows servers sync the same share
- **Unified namespace**: users see all files, even if part is in the cloud

**Components:**
1. **Storage Sync Service**: an Azure resource that orchestrates the sync
2. **Azure File Share**: the share that acts as the "master"
3. **Sync Group**: associates the share with the server endpoints
4. **Server Endpoint**: a folder on a registered Windows server
5. **Azure File Sync Agent**: installed on the Windows server

### When to use Azure Files vs Blob
- **Azure Files**: SMB/NFS share for lift-and-shift of file servers, home directories
- **Blob**: unstructured objects/files accessed via REST API

### Mounting Azure Files

**Windows:**
\`\`\`powershell
# Mount via the script generated in the portal
net use Z: \\\\<sa>.file.core.windows.net\\<share> /u:AZURE\\<sa> <access-key>
\`\`\`

**Linux:**
\`\`\`bash
sudo mount -t cifs //<sa>.file.core.windows.net/<share> /mnt/azfiles \\
  -o vers=3.0,username=<sa>,password=<key>,serverino
\`\`\`

## Essential Commands (Azure CLI)

\`\`\`bash
# Create a file share
az storage share-rm create \\
  --storage-account mysa \\
  --resource-group myRG \\
  --name myfileshare \\
  --quota 100  # GB

# List shares
az storage share-rm list \\
  --storage-account mysa \\
  --resource-group myRG -o table

# Create a directory in the share
az storage directory create \\
  --account-name mysa \\
  --share-name myfileshare \\
  --name "documents"

# Upload a file
az storage file upload \\
  --account-name mysa \\
  --share-name myfileshare \\
  --source ./myfile.txt

# Create a Storage Sync Service
az storagesync create \\
  --resource-group myRG \\
  --storage-sync-service-name mySyncService \\
  --location eastus
\`\`\`

## Common Mistakes

1. **SMB blocked by firewall**: TCP port 445 must be open on the corporate network to mount Azure Files via SMB.
2. **NFS requires specific redundancy**: NFS on Azure Files requires the Premium tier OR Standard with ZRS.
3. **Cloud tiering and disk space**: if the local server runs out of space, cloud tiering can fail — monitor available space.

## Killer.sh Style Challenge

> A company has 10 branch offices with Windows file servers. They want to centralize data in the cloud while keeping fast local access. What should they use?
>
> **Answer**: Azure File Sync with cloud tiering enabled. One central Azure File Share, a Storage Sync Service, 10 Server Endpoints (one per branch). Recent files stay local (cache), less-accessed files stay only in Azure Files (with a local placeholder that fetches on demand).
`,

  quiz: [
    {
      question: 'Which protocol does Azure Files use by default for Windows shares?',
      options: ['NFS v4', 'SMB (Server Message Block)', 'FTP', 'WebDAV'],
      correct: 1,
      explanation: 'Azure Files uses SMB (Server Message Block) as the default protocol for Windows — the same protocol as traditional Windows network shares. For Linux, NFS is also available but with specific tier and redundancy requirements.',
      reference: 'SMB = Windows default (port 445). NFS = Linux (requires Premium or Standard ZRS). Both are supported by Azure Files.'
    },
    {
      question: 'What does "Cloud Tiering" do in Azure File Sync?',
      options: [
        'Moves all files to the cloud and removes the local server',
        'Keeps frequently accessed files locally; moves rarely accessed files to Azure Files, leaving a local placeholder',
        'Automatically syncs files between different Azure regions',
        'Compresses files in the cloud to save space'
      ],
      correct: 1,
      explanation: 'Cloud Tiering keeps "hot" files (recently accessed) on the local server for fast access, and moves "cold" files to Azure Files in the cloud. A placeholder (shortcut) stays on the local server — when accessed, the file is transparently downloaded from the cloud. This lets you have a namespace larger than the local disk.',
      reference: 'Cloud Tiering = smart local cache. Frequent files = local. Rarely accessed = Azure Files (transparent to the user).'
    },
    {
      question: 'Which TCP port must be open to mount Azure Files via SMB on corporate networks?',
      options: ['80', '443', '445', '2049'],
      correct: 2,
      explanation: 'SMB uses TCP port 445. Many corporate networks block this port for security reasons (WannaCry exploited SMBv1). If port 445 is blocked, mounting Azure Files via SMB fails. Alternatives: use an Azure VPN Gateway or ExpressRoute to mount via a private network.',
      reference: 'SMB = port 445 (many companies block it). NFS = port 2049. HTTPS = 443 (storage REST API).'
    }
  ],

  flashcards: [
    {
      front: 'What are the components of Azure File Sync?',
      back: '1. **Storage Sync Service** — an Azure resource that orchestrates the sync\n2. **Azure File Share** — the cloud share that acts as the "master"\n3. **Sync Group** — associates the share with the server endpoints\n4. **Server Endpoint** — a folder on a registered Windows server\n5. **Azure File Sync Agent** — software installed on the Windows server\n\nFlow: Agent → connects to the Storage Sync Service → syncs with the File Share'
    },
    {
      front: 'Azure Files vs Azure Blob: when to use each?',
      back: '**Azure Files** (SMB/NFS share):\n- Lift-and-shift of Windows file servers\n- User home directories\n- Applications that expect a file system (SMB)\n- Multi-attach of VMs to the same share\n\n**Azure Blob Storage** (objects):\n- Files accessed via REST API\n- Backups, logs, media, ML data\n- Programmatic access (SDK)\n- Hot/Cool/Archive tiers for lifecycle\n\nRule: if the application uses \`\\\\server\\share\` → Files. If it uses REST API or SDK → Blob.'
    }
  ],

  lab: {
    scenario: 'Create an Azure File Share and mount it to verify it works.',
    objective: 'Create a file share and check the mount settings.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Create a Storage Account and File Share',
        instruction: 'Create a storage account and a 100GB file share.',
        hints: ['Use \`az storage share-rm create\` with \`--quota\`'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-files-lab --location eastus
az storage account create \\
  --name "filestore\${SUFFIX}" --resource-group rg-files-lab \\
  --sku Standard_LRS --kind StorageV2

az storage share-rm create \\
  --storage-account "filestore\${SUFFIX}" \\
  --resource-group rg-files-lab \\
  --name company-files \\
  --quota 100

echo "File share created: //filestore\${SUFFIX}.file.core.windows.net/company-files"
\`\`\``,
        verify: `\`\`\`bash
SUFFIX=$(ls /tmp/ | grep -o '[0-9]*' | tail -1 2>/dev/null || date +%s | tail -c 5)
az storage share-rm list --resource-group rg-files-lab \\
  --query "[].{Name:name,Quota:shareQuota,Status:provisioningState}" -o table 2>/dev/null || \\
  echo "Check: az storage share-rm list --resource-group rg-files-lab"
\`\`\``
      },
      {
        title: 'Get the mount script',
        instruction: 'Get the credentials to mount the file share and view the mount script.',
        hints: ['Use \`az storage account keys list\` to get the access key'],
        solution: `\`\`\`bash
# Get the storage account name
SA_NAME=$(az storage account list --resource-group rg-files-lab --query "[0].name" -o tsv)

# Get the access key
ACCESS_KEY=$(az storage account keys list \\
  --account-name $SA_NAME --resource-group rg-files-lab \\
  --query "[0].value" -o tsv)

echo "=== Linux Mount Script ==="
echo "sudo mount -t cifs //\${SA_NAME}.file.core.windows.net/company-files /mnt/azfiles \\"
echo "  -o vers=3.0,username=\${SA_NAME},password=<ACCESS_KEY>,serverino"

echo ""
echo "=== Windows Mount Script ==="
echo "net use Z: \\\\\\\\\\\${SA_NAME}.file.core.windows.net\\\\company-files /u:AZURE\\\\\\\${SA_NAME} <ACCESS_KEY>"
\`\`\``,
        verify: `\`\`\`bash
SA_NAME=$(az storage account list --resource-group rg-files-lab --query "[0].name" -o tsv 2>/dev/null)
echo "Storage Account: $SA_NAME"
echo "SMB URL: //\${SA_NAME}.file.core.windows.net/company-files"
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-files-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-files-lab 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Cannot mount Azure Files via SMB on the corporate network',
      difficulty: 'easy',
      symptom: 'An attempt to mount Azure Files with \`net use\` returns "System error 53 - The network path was not found".',
      diagnosis: `\`\`\`bash
# Test connectivity on port 445
# On Windows:
# Test-NetConnection -ComputerName <sa>.file.core.windows.net -Port 445

# On Linux:
nc -zv <sa>.file.core.windows.net 445
# If it returns "Connection refused" or times out, port 445 is blocked
\`\`\``,
      solution: `**Cause**: TCP port 445 blocked by the corporate firewall or ISP (common after WannaCry in 2017).

**Solutions:**

1. **Azure VPN Gateway (P2S)**: connect the computer to the Azure VNet via client VPN, mount the share over the private network (without relying on port 445 over the Internet).

2. **Azure VPN Gateway (S2S)**: for the whole corporate network, mount via ExpressRoute or S2S VPN.

3. **Request port opening**: work with the security team to open port 445 only to the Azure Files IP (\`<sa>.file.core.windows.net\`).

4. **Use the REST API or azcopy**: if you only need programmatic access, Azure Files has a REST API that uses port 443.`
    }
  ]
};
