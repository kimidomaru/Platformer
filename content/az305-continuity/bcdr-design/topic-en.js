window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-continuity/bcdr-design'] = {
  theory: `# BCDR Design — Business Continuity & Disaster Recovery (AZ-305)

## Exam Relevance
> Estimated weight **10-15%** on AZ-305. The exam evaluates your ability to design DR solutions with specific RPO/RTO requirements and choose the correct services.

## Core Concepts

### RTO and RPO — Design Definitions

**RPO (Recovery Point Objective)**: maximum data that can be lost
- RPO = 0: zero data loss (synchronous replication)
- RPO = 15 min: can lose up to 15 min of transactions
- RPO = 24h: daily backup is sufficient

**RTO (Recovery Time Objective)**: maximum downtime
- RTO = minutes → Active-Active or hot standby
- RTO = 1–4h → warm standby with manual failover
- RTO = 24h+ → traditional backup/restore

### DR Strategies

| Strategy | RTO | RPO | Cost | How it works |
|---------|-----|-----|------|-------------|
| **Backup & Restore** | Hours to days | Hours | Low | Restore from backup |
| **Pilot Light** | 10–30 min | Minutes | Medium | Minimal infra running, scales on DR |
| **Warm Standby** | 5–10 min | Seconds–min | Medium-high | Reduced version always on |
| **Multi-site Active-Active** | Seconds | Zero (sync) | High | Two sites serving simultaneously |

### Azure Site Recovery (ASR) — Design
Replicates VMs to another region:
- **RPO**: minimum 30 seconds
- **RTO**: minutes (automatic or manual failover)
- Support: Azure-to-Azure, VMware/Hyper-V-to-Azure
- **Test failover**: validate DR without affecting production (isolated in a test VNet)
- **Failback**: return to the primary region after DR

**ASR Configuration:**
\`\`\`
Source Region (East US)          Target Region (West US)
  ├─ VM-Web-1 ──replication──→  VM-Web-1 (off)
  ├─ VM-App-1 ──replication──→  VM-App-1 (off)
  └─ SQL-Server ──replication──→ SQL-Server (off)

Recovery Plan: defines failover order
  1. SQL Server (wait 5 min for startup)
  2. App VMs (wait 2 min)
  3. Web VMs
\`\`\`

### High Availability vs Disaster Recovery

| | HA | DR |
|-|----|----|
| Goal | Avoid downtime | Recover from a catastrophe |
| Scope | Hardware/zone failures | Full region failure |
| Example | Availability Zones | Azure Site Recovery |
| SLA | 99.99% | Defined RTO/RPO |
| Cost | +20–30% | +50–100% |

### BCDR for Managed Services

**Azure SQL Database:**
- Auto-failover groups (automatic failover + single endpoint)
- Geo-restore (restore from geo-replicated backup, RPO = 1h)
- Active Geo-Replication (readable replica, manual failover)

**Cosmos DB:**
- Automatic with multi-region write enabled
- Automatic failover with configurable priority

**App Service:**
- Deploy in multiple regions + Traffic Manager/Front Door
- Azure Backup for configuration and content

**Storage:**
- RA-GRS: read from secondary, manual failover
- GZRS: zone-redundant + geo for maximum protection

### Recovery Plans
Failover documentation and automation:
- Defines recovery order (which VM starts first)
- Can include scripts and runbooks (Azure Automation)
- Allows test failover without production impact
- Document: RTO/RPO, responsibilities, escalation contacts

### Business Continuity Checklist
1. ✅ Identify critical workloads and their RTO/RPO
2. ✅ Implement a technical solution (ASR, geo-replication, backup)
3. ✅ Document the Recovery Plan
4. ✅ Test DR regularly (at least annually)
5. ✅ Monitor replication (alerts if RPO drift increases)

## Design Patterns

### Pattern: Multi-region Active-Active with Azure Front Door
\`\`\`
Users
  ↓
Azure Front Door (health checks + routing)
  ├─ East US (production)
  │    ├─ App Service (primary)
  │    └─ Azure SQL (primary)
  └─ West US (secondary)
       ├─ App Service (hot standby)
       └─ Azure SQL (readable geo-replica)
\`\`\`
RTO: seconds (Front Door detects failure and redirects)
RPO: ~1–5 seconds (SQL geo-replication lag)

### Pattern: ASR for IaaS VMs
\`\`\`
East US (production) → ASR replication → West US (DR)
Recovery Plan:
  1. Network setup (VNet, NSG via ARM template)
  2. Database VM (wait 5 min)
  3. App VMs (wait 2 min)
  4. Web VMs
Monthly test failover
\`\`\`

## Killer.sh Style Challenge (AZ-305)

> **Scenario**: A critical financial application with the following required SLAs:
> - RPO: maximum 30 seconds for transactions
> - RTO: maximum 2 minutes for service resumption
> - Compliance: DR must be in a geographically separate region
> - DR Test: without impacting production
>
> **Design the complete BCDR solution.**
>
> **Answer**: Multi-site Active-Active with Azure Front Door + automatic failover. Azure SQL with Auto-Failover Group (30s RPO), VMs with Azure Site Recovery (30s RPO, RTO ~10min via automated Recovery Plan), Storage with RA-GZRS. Monthly test failover via ASR "test failover" (isolated in a separate VNet). Recovery Plan with runbooks to automate service restart in the correct order.
`,

  quiz: [
    {
      question: 'A company requires an RTO of 5 minutes and an RPO of 30 seconds for a critical application. Which DR strategy is most appropriate?',
      options: [
        'Backup and Restore to Azure Storage',
        'Pilot Light with minimal instances in the DR region',
        'Warm Standby with auto-failover groups and Azure Site Recovery',
        'Multi-site Active-Active with Azure Front Door'
      ],
      correct: 2,
      explanation: 'Warm Standby (or hot standby) with Azure Site Recovery for VMs (RPO ~30s) and SQL Auto-Failover Groups (RPO ~30s) meets the requirements. Active-Active would also work but has doubled cost. Pilot Light and Backup do not meet a 5-minute RTO. The key is having pre-warmed infrastructure in the DR region to achieve a 5-minute RTO.',
      reference: 'RPO 30s + RTO 5min = Warm Standby or Active-Active. Anything that needs to provision infra from scratch cannot achieve a 5-min RTO.'
    },
    {
      question: 'What is the difference between "Test Failover" and "Failover" in Azure Site Recovery?',
      options: [
        'Test Failover is slower; Failover is instantaneous',
        'Test Failover creates VMs in an isolated VNet without affecting replication; real Failover moves production to the secondary region',
        'Test Failover does not require a Recovery Plan; Failover does',
        'There is no technical difference — just different names for the same operation'
      ],
      correct: 1,
      explanation: 'Test Failover creates replicated VMs in an isolated test VNet — you validate that DR works without interrupting replication or production. The test VNet is separate and temporary. A real Failover initiates production failover to the secondary region, stopping replication. After stabilizing, you perform a Failback to return to the primary region.',
      reference: 'Test Failover = DR validation without risk. Always perform test failovers regularly before you need the real one.'
    },
    {
      question: 'For an application requiring an RPO of zero (no data loss) across multiple regions, which Cosmos DB configuration should be used?',
      options: [
        'Single-region with automatic backup',
        'Multi-region with Strong consistency',
        'Multi-region write with Bounded Staleness',
        'Multi-region with Eventual consistency'
      ],
      correct: 1,
      explanation: 'Multi-region with Strong consistency guarantees zero RPO — a write is only confirmed when all replicas confirm it. This results in higher latency but zero data loss in case of a region failure. Multi-region write with Eventual consistency has RPO > 0 because there can be lag between regions.',
      reference: 'Zero RPO = Strong consistency or synchronous replication. There is always a trade-off: zero RPO = higher write latency.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 4 DR strategies and their RTO/RPO/cost trade-offs?',
      back: '| Strategy | RTO | RPO | Cost |\n|---------|-----|-----|------|\n| **Backup & Restore** | Hours–days | Hours | Low |\n| **Pilot Light** | 10–30 min | Minutes | Medium |\n| **Warm Standby** | 5–10 min | Seconds | Medium-high |\n| **Active-Active** | Seconds | ~0 | High |\n\nRule: lower RTO/RPO = higher cost. Choose based on how much downtime/data loss costs vs the cost of the DR solution.'
    },
    {
      front: 'How does Azure Site Recovery meet RTO/RPO requirements?',
      back: '**RPO**: minimum 30 seconds (continuous data replication)\n\n**RTO**: depends on the Recovery Plan:\n- Simple VMs: 15–30 minutes (startup + network)\n- With automated Recovery Plan: 5–10 minutes\n- Pre-configured resources in the DR region: 2–5 minutes\n\n**Test Failover**: validates DR without production impact — creates VMs in an isolated VNet, can be done monthly\n\n**Failback**: returns to the primary region after the DR event is resolved'
    },
    {
      front: 'Which Azure service provides HA vs which provides DR?',
      back: '**High Availability (HA)** — failures within a region:\n- Availability Zones → VMs, SQL, Storage\n- Load Balancer + Health Probes\n- App Service auto-healing\n- SQL Database Always On (automatic)\n\n**Disaster Recovery (DR)** — full region failure:\n- Azure Site Recovery → VMs\n- SQL Auto-Failover Groups → Azure SQL\n- RA-GRS/GZRS → Storage\n- Cosmos DB multi-region\n- Azure Front Door / Traffic Manager → global routing'
    }
  ],

  lab: {
    scenario: 'Explore Azure Site Recovery and Recovery Plan settings to understand the BCDR process.',
    objective: 'Create a Recovery Services Vault configured for ASR and explore Recovery Plans.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create a Recovery Services Vault for ASR',
        instruction: 'Create a vault dedicated to Azure Site Recovery in East US (source) with GRS for replication to West US.',
        hints: ['\`az backup vault create\` — the same vault serves for backup and ASR'],
        solution: `\`\`\`bash
az group create --name rg-bcdr-lab --location eastus

az backup vault create \\
  --name technova-asr-vault \\
  --resource-group rg-bcdr-lab \\
  --location eastus

# Configure GRS (required for ASR cross-region)
az backup vault backup-properties set \\
  --vault-name technova-asr-vault \\
  --resource-group rg-bcdr-lab \\
  --backup-storage-redundancy GeoRedundant

echo "Recovery Services Vault created for ASR"
echo "Next step: in the portal, Azure Site Recovery → Enable Replication"
\`\`\``,
        verify: `\`\`\`bash
az backup vault show --name technova-asr-vault --resource-group rg-bcdr-lab \\
  --query "{Name:name,Status:properties.provisioningState}" -o table
\`\`\``
      },
      {
        title: 'Explore SQL Failover Groups (conceptual)',
        instruction: 'Create a SQL Server to explore Auto-Failover Group configuration as part of the BCDR design.',
        hints: ['SQL Auto-Failover Group requires two SQL Servers in different regions'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)

# Primary SQL Server (East US)
az sql server create \\
  --name "primary-sql-\${SUFFIX}" \\
  --resource-group rg-bcdr-lab \\
  --location eastus \\
  --admin-user sqladmin \\
  --admin-password "P@ssword123!"

# Database on the primary
az sql db create \\
  --server "primary-sql-\${SUFFIX}" \\
  --resource-group rg-bcdr-lab \\
  --name proddb \\
  --edition GeneralPurpose \\
  --family Gen5 \\
  --capacity 2

echo "SUFFIX=\${SUFFIX}" > /tmp/bcdrlab.sh
echo "Primary SQL created: primary-sql-\${SUFFIX}.database.windows.net"
echo "For a complete failover group, a second SQL Server in another region would be needed"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/bcdrlab.sh
az sql db show \\
  --server "primary-sql-\${SUFFIX}" \\
  --resource-group rg-bcdr-lab \\
  --name proddb \\
  --query "{Name:name,Status:status}" -o table
\`\`\``
      },
      {
        title: 'Calculate RTO/RPO for a scenario',
        instruction: 'Based on the created services, calculate the theoretical RTO and RPO for different recovery strategies.',
        hints: ['ASR minimum RPO: 30 seconds. SQL Failover Group RPO: ~30 seconds. Recovery via backup: depends on the last backup.'],
        solution: `\`\`\`bash
echo "=== RTO/RPO Analysis ==="
echo ""
echo "Scenario: Web Application with VMs + SQL Database"
echo ""
echo "Option 1: Backup & Restore"
echo "  RPO: up to 24h (last daily backup)"
echo "  RTO: 2-6 hours (provision VMs + restore database)"
echo "  Cost: Low (backup storage only)"
echo ""
echo "Option 2: Azure Site Recovery + SQL Geo-Replication"
echo "  RPO: 30-60 seconds"
echo "  RTO: 15-30 minutes (VM failover + DNS propagation)"
echo "  Cost: Medium (ASR license + SQL replica)"
echo ""
echo "Option 3: Active-Active with Front Door"
echo "  RPO: ~0 (synchronous)"
echo "  RTO: seconds (Front Door redirects automatically)"
echo "  Cost: High (doubled infra + Front Door)"
\`\`\``,
        verify: `\`\`\`bash
echo "Analysis complete. Strategy choice depends on required SLA and available budget."
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-bcdr-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-bcdr-lab 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Azure Site Recovery — replication stopped (high RPO drift)',
      difficulty: 'hard',
      symptom: 'The ASR monitor shows the current RPO is at 8 hours (well above the 30-minute target). The replication status shows "Warning".',
      diagnosis: `\`\`\`bash
# Check replication health via the portal
# Recovery Services Vault → Replicated Items → VM Status

# Via CLI — check replication events
az site-recovery replication-protected-item list \\
  --resource-group myRG \\
  --vault-name myVault \\
  --fabric-name primary-fabric \\
  --protection-container-name primary-container \\
  --query "[].{VM:name,Health:replicationHealth,RPO:currentScenario.scenarioName}" \\
  -o table 2>/dev/null || echo "Check via portal: ASR → Replicated Items → VM → Health"
\`\`\``,
      solution: `**Common causes of RPO drift in ASR:**

1. **Insufficient bandwidth**: replication is competing with production traffic. Solutions:
   - Configure network throttling on the ASR agent to limit usage outside peak hours
   - Increase ExpressRoute/VPN bandwidth

2. **High VM change rate**: applications with heavy writes (e.g. databases with many transactions) generate a lot of replication data. Consider replicating only the OS disks (not database data disks — use SQL Active Geo-Replication for the database).

3. **Outdated ASR agent**: update the mobility agent on the affected VM.

4. **Snapshot consistency issues**: for VMs with multiple disks, ensure crash-consistent snapshots are being taken correctly. For critical VMs, use app-consistent with pre/post snapshot scripts.

5. **Network to cache Storage Account**: replication uses a cache Storage Account — check connectivity and storage throttling.`
    }
  ]
};
