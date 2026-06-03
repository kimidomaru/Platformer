window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-monitor/azure-backup'] = {
  theory: `# Azure Backup & Recovery Services

## Exam Relevance
> Estimated weight **8-10%** on AZ-104. VM protection, Recovery Services Vault configuration and backup policies appear in practical scenarios.

## Core Concepts

### Recovery Services Vault
Centralized repository for backup and recovery:
- Stores backup data from VMs, Files, SQL, SAP
- Supports **Soft delete**: deleted backups are retained for an extra 14 days
- **Cross-region restore**: restore in another region (requires GRS)
- Replication: LRS (local) or GRS (geo-redundant, recommended)

### Azure Backup for VMs
- **Application consistent backup**: snapshot with VSS (Volume Shadow Copy)
- **File-level recovery**: restore individual files without restoring the entire VM
- **Instant restore**: fast using local snapshots (retained 1–5 days)
- **Vault backup**: long-term copy in the Recovery Services Vault

### Backup Policies
Defines frequency and retention:
\`\`\`
Backup frequency: Daily / Weekly
Time: 2:00 AM UTC
Retention:
  Daily: 30 days
  Weekly: 12 weeks
  Monthly: 12 months
  Yearly: 3 years
\`\`\`

### Azure Site Recovery (ASR)
**Disaster Recovery** (not backup):
- Continuously replicates VMs to another region
- **RPO**: seconds to minutes (continuous replication)
- **RTO**: minutes (fast failover)
- Test failover: test DR without production impact
- Supports: Azure→Azure, on-prem→Azure, Hyper-V→Azure

### RTO vs RPO
- **RPO (Recovery Point Objective)**: how much data can you lose? (time since last backup)
- **RTO (Recovery Time Objective)**: how long to restore? (recovery time)

## Essential Commands (Azure CLI)

\`\`\`bash
# Create a Recovery Services Vault
az backup vault create \\
  --name myVault \\
  --resource-group myRG \\
  --location eastus

# Enable backup for a VM
az backup protection enable-for-vm \\
  --vault-name myVault \\
  --resource-group myRG \\
  --vm myVM \\
  --policy-name DefaultPolicy

# Trigger an immediate backup
az backup protection backup-now \\
  --vault-name myVault \\
  --resource-group myRG \\
  --container-name "iaasvmcontainerv2;myRG;myVM" \\
  --item-name "vm;iaasvmcontainerv2;myRG;myVM" \\
  --retain-until 2025-12-31

# List recovery points
az backup recoverypoint list \\
  --vault-name myVault \\
  --resource-group myRG \\
  --container-name "iaasvmcontainerv2;myRG;myVM" \\
  --item-name "vm;iaasvmcontainerv2;myRG;myVM" \\
  --workload-type VM -o table

# Restore a VM
az backup restore restore-disks \\
  --vault-name myVault \\
  --resource-group myRG \\
  --container-name "iaasvmcontainerv2;myRG;myVM" \\
  --item-name "vm;iaasvmcontainerv2;myRG;myVM" \\
  --rp-name <recovery-point-name> \\
  --storage-account myStorageAccount \\
  --restore-mode OriginalLocation
\`\`\`

## Common Mistakes

1. **Soft delete enabled + trying to delete backup**: with soft delete, data stays for an extra 14 days. To delete permanently, disable soft delete first.
2. **Vault on LRS for cross-region restore**: cross-region restore requires GRS on the vault.
3. **Backup of an encrypted VM**: VMs with Azure Disk Encryption require the vault to have access to the Key Vault.
4. **ASR ≠ Backup**: ASR is for DR/failover, it does not replace regular backups.

## Killer.sh Style Challenge

> A production VM needs a daily backup with 30-day retention for daily backups, 12-week retention for weekly backups, and the ability to restore individual files. Configure the solution.
>
> **Answer**: Create a Recovery Services Vault (GRS). Create a Backup Policy with: daily backup at 2AM, retain daily 30 days, retain weekly 12 weeks. Enable backup on the VM with that policy. To restore an individual file: Backup Items → VM → File Recovery → mount the recovery point as a temporary disk.
`,

  quiz: [
    {
      question: 'What is the difference between Azure Backup and Azure Site Recovery?',
      options: [
        'Backup is for VMs; ASR is for databases',
        'Backup protects against data loss with point-in-time recovery points; ASR continuously replicates for DR with fast failover',
        'ASR is cheaper; Backup has a better RPO',
        'There is no difference — they are the same service'
      ],
      correct: 1,
      explanation: 'Azure Backup creates periodic snapshots for point-in-time restore — RPO = backup frequency (hours/days). Azure Site Recovery continuously replicates to another region — RPO of seconds/minutes, RTO of minutes. Backup = protection against corruption/accidental deletion. ASR = DR against a complete region failure.',
      reference: 'Backup = point-in-time recovery (what you had yesterday). ASR = business continuity (failover to another region in minutes).'
    },
    {
      question: 'What is RPO in the context of backup and recovery?',
      options: [
        'Recovery Point Objective — the maximum acceptable data loss time',
        'Recovery Process Output — a report of the recovery process',
        'Restore Point Options — available restore point options',
        'Recovery Performance Optimization — restore speed configuration'
      ],
      correct: 0,
      explanation: 'RPO (Recovery Point Objective) defines the maximum amount of data that can be lost in a disaster — expressed as a time interval. If RPO = 24h, you can lose up to 24h of data. For a 24h RPO, a daily backup is sufficient. For a 15-minute RPO, you need frequent replication or ASR.',
      reference: 'RPO = "how much data can I lose?". RTO = "how long to restore?". Both define DR/backup requirements.'
    },
    {
      question: 'What happens when "Soft Delete" is enabled on a Recovery Services Vault and you delete a backup item?',
      options: [
        'The backup is immediately removed',
        'The backup is retained for an additional 14 days before being permanently deleted',
        'The backup is automatically moved to Azure Archive',
        'Additional approval is required for deletion'
      ],
      correct: 1,
      explanation: 'With Soft Delete enabled (default), deleting a backup item puts it in a "softdeleted" state for an extra 14 days. You can recover the item during that period. After 14 days, it is permanently deleted. To delete immediately, you must disable soft delete first.',
      reference: 'Soft Delete = protection against accidental backup deletion. Enabled by default. Important for compliance and data protection.'
    }
  ],

  flashcards: [
    {
      front: 'What is the difference between RPO and RTO?',
      back: '**RPO (Recovery Point Objective)**:\n- "How much data can I lose?"\n- Maximum acceptable time since the last backup\n- E.g.: RPO=24h = can lose up to 24h of data\n- Determined by backup/replication frequency\n\n**RTO (Recovery Time Objective)**:\n- "How long to get back online?"\n- Maximum acceptable downtime\n- E.g.: RTO=4h = system must be restored within 4h\n- Determined by restore speed or failover time'
    },
    {
      front: 'What are the components of a Backup Policy in Azure?',
      back: '**Backup Policy** defines:\n1. **Frequency**: Daily or Weekly\n2. **Time**: e.g. 2:00 AM UTC (backup window)\n3. **Retention per tier**:\n   - Daily: e.g. 30 days\n   - Weekly: e.g. 12 weeks\n   - Monthly: e.g. 12 months\n   - Yearly: e.g. 5 years\n4. **Instant restore**: how many days to keep local snapshots (1–5 days)\n\nDefault Policy: daily at 9:30 PM UTC, retain 30 days.'
    },
    {
      front: 'What is Azure Site Recovery (ASR) and when to use it?',
      back: '**ASR** = continuous replication of VMs to another Azure region for Disaster Recovery.\n\n**Characteristics:**\n- RPO: seconds to minutes (continuous replication)\n- RTO: minutes (fast failover)\n- Test failover without production impact\n- Support: Azure→Azure, VMware/Hyper-V→Azure\n\n**When to use:**\n- Critical applications that cannot afford more than minutes of downtime\n- Compliance requiring DR in another geographic region\n- Very high availability SLA (99.99%+)\n\n**Does not replace** backup — they are complementary.'
    }
  ],

  lab: {
    scenario: 'Configure VM backup and verify retention policies.',
    objective: 'Create a Recovery Services Vault, configure a backup policy and enable backup on a VM.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create a Recovery Services Vault',
        instruction: 'Create a Recovery Services Vault with GRS to support cross-region restore.',
        hints: ['\`az backup vault create\` with \`--storage-redundancy GeoRedundant\`'],
        solution: `\`\`\`bash
az group create --name rg-backup-lab --location eastus
az backup vault create \\
  --name technova-vault \\
  --resource-group rg-backup-lab \\
  --location eastus

# Configure GRS replication
az backup vault backup-properties set \\
  --vault-name technova-vault \\
  --resource-group rg-backup-lab \\
  --backup-storage-redundancy GeoRedundant
\`\`\``,
        verify: `\`\`\`bash
az backup vault show --name technova-vault --resource-group rg-backup-lab \\
  --query "{Name:name,Status:properties.provisioningState}" -o table
\`\`\``
      },
      {
        title: 'Verify available backup policies',
        instruction: 'List the backup policies available in the vault.',
        hints: ['\`az backup policy list\`'],
        solution: `\`\`\`bash
az backup policy list \\
  --vault-name technova-vault \\
  --resource-group rg-backup-lab \\
  --query "[].{Name:name,Type:backupManagementType}" -o table

# View DefaultPolicy details
az backup policy show \\
  --vault-name technova-vault \\
  --resource-group rg-backup-lab \\
  --name DefaultPolicy \\
  --query "{Frequency:properties.schedulePolicy.schedulePolicyType,Retention:properties.retentionPolicy}" \\
  -o json
\`\`\``,
        verify: `\`\`\`bash
az backup policy list --vault-name technova-vault --resource-group rg-backup-lab \\
  --query "length(@)" -o tsv
# Expected output: >= 1 (at least the DefaultPolicy)
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-backup-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-backup-lab 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Cannot delete backup items from the vault',
      difficulty: 'easy',
      symptom: 'When trying to delete a backup item (VM backup) from the Recovery Services Vault, you get the error "Cannot delete backup item as it is protected by soft delete".',
      diagnosis: `\`\`\`bash
# Check whether soft delete is enabled
az backup vault backup-properties show \\
  --vault-name myVault --resource-group myRG \\
  --query "softDeleteFeatureState" -o tsv
\`\`\``,
      solution: `**Soft delete is active** (default).

**Option 1: Disable soft delete (if acceptable for your compliance)**:
\`\`\`bash
az backup vault backup-properties set \\
  --vault-name myVault --resource-group myRG \\
  --soft-delete-feature-state Disable
\`\`\`
Then delete the item normally.

**Option 2: Wait 14 days** — the item in "softdeleted" state will be permanently removed automatically after 14 days.

**Option 3: Undelete and then stop protection + delete data**:
\`\`\`bash
# First: undelete the item from soft-deleted state
az backup item undelete ...
# Then: stop protection and delete data
az backup protection disable --delete-backup-data true ...
\`\`\``
    }
  ]
};
