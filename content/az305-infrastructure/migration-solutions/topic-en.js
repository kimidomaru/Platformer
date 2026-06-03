window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-infrastructure/migration-solutions'] = {
  theory: `# Designing Migration Solutions (AZ-305)

## Exam Relevance
> Estimated weight **10-15%** on AZ-305. The exam evaluates your ability to choose the right migration strategy and the appropriate Azure tools.

## Migration Framework: 5 Rs (Gartner)

| Strategy | Description | When to use |
|---------|-------------|------------|
| **Rehost** (Lift & Shift) | Move to IaaS without changes | Fast, low risk, legacy software |
| **Refactor** (Replatform) | Minimal adjustment for PaaS | Web app → App Service |
| **Rearchitect** | Redesign for cloud-native | When benefits justify the effort |
| **Rebuild** | Rewrite from scratch | Legacy impossible to modernize |
| **Retire** | Decommission | No longer needed |

## Assessment and Migration Tools

### Azure Migrate
Central hub for assessment and migration:
- **Discovery**: inventory on-premises VMs (lightweight agent or agentless)
- **Assessment**: recommend Azure sizes, estimate costs, identify dependencies
- **Migration**: execute the migration (replication, test migration, final migration)

**Components:**
- **Azure Migrate Appliance**: a virtual VM installed on-premises that performs discovery
- **Server Migration**: for VMs (Hyper-V, VMware, physical)
- **Database Migration**: SQL, MySQL, PostgreSQL → Azure
- **App Service Migration**: ASP.NET web apps → Azure App Service

### Azure Database Migration Service (DMS)
Migrates on-premises databases to Azure:
- **Online migration**: migration with minimal downtime (CDC — change data capture)
- **Offline migration**: downtime accepted, simpler
- Support: SQL Server, MySQL, PostgreSQL, Oracle, MongoDB → Azure

**Online Migration process:**
\`\`\`
1. Initial full backup → Azure
2. CDC captures incremental changes
3. Apply changes continuously
4. Cutover: minimal downtime moment (seconds/minutes)
\`\`\`

### Azure Site Recovery for Migration
Also used for migrating VMs (replicate → test → permanent failover):
- Better for large-scale VMware/Hyper-V environments
- Difference: during migration, you do a "failover" then shut down the original VM

### Azure Data Box
Bulk data migration when bandwidth is limited:
| Product | Capacity | Use |
|---------|---------|-----|
| **Data Box Disk** | 8 TB per disk (max 35 TB) | Small migrations |
| **Data Box** | 80 TB | Medium migrations |
| **Data Box Heavy** | 1 PB | Large migrations |

**When to use Data Box vs internet:**
- If transferring over the internet takes > 1 week → use Data Box

## Strategies by Workload

### Windows/Linux VMs
1. **Rehost**: Azure Migrate → replicate → migrate to IaaS Azure VMs
2. **Refactor**: if it is a web app, consider App Service Migration Assistant

### SQL Server
1. **Rehost**: SQL Server on Azure VM (maximum compatibility)
2. **Refactor**: Azure SQL Managed Instance (high compatibility + PaaS benefits)
3. **Rearchitect**: Azure SQL Database (cloud-native, lower compatibility)

### Web Applications (ASP.NET)
1. Azure App Service Migration Assistant: evaluates and migrates ASP.NET apps automatically

### Mainframe / Legacy
1. Evaluate with specialized Microsoft partners
2. Consider emulators or modern rewrite

## Azure Migration Phases

\`\`\`
Phase 1: ASSESS
  ├─ Deploy Azure Migrate Appliance
  ├─ Discovery (6-24h for full inventory)
  ├─ Dependency Analysis (28 days for complete pattern)
  └─ Assessment Report (sizing, cost, readiness)

Phase 2: PREPARE
  ├─ Create Resource Groups, VNets, NSGs in Azure
  ├─ Configure ExpressRoute/VPN if needed
  └─ Define Recovery Plan and rollback strategy

Phase 3: MIGRATE
  ├─ Initial replication (can take hours/days per TB)
  ├─ Test Migration in isolated VNet
  ├─ Validate application on Azure
  └─ Cutover (maintenance window)

Phase 4: OPTIMIZE
  ├─ Right-sizing after 30-60 days
  ├─ Reserved Instances for savings
  ├─ Decommission on-premises hardware
  └─ Configure monitoring and alerts
\`\`\`

## Common Design Mistakes

1. **Migrating without assessment**: estimating sizes without real utilization data results in over-provisioning.
2. **Ignoring dependencies**: systems that depend on others must be migrated together or have guaranteed connectivity.
3. **No test migration**: always test in an isolated VNet before the real cutover.
4. **Cutover without a rollback plan**: always have a plan to revert if the migration fails.
5. **Underestimating network latency**: applications that assume local network (< 1ms) may have problems after migrating to Azure (5–20ms between on-prem and Azure).

## Killer.sh Style Challenge (AZ-305)

> **Scenario**: A company needs to migrate to Azure in 6 months:
> - 200 VMware VMs (Windows and Linux)
> - 5 SQL Server instances (with SSIS and SQL Agent features)
> - 3 ASP.NET web applications
> - 50 TB of file data on Windows file servers
> - Available Internet bandwidth: 100 Mbps
>
> **Design the migration plan with strategies and tools.**
>
> **Answer:**
> - 200 VMs: Azure Migrate (Rehost) with continuous replication + test migration per wave (30–40 VMs/week)
> - SQL Server with SSIS/Agent: Azure SQL Managed Instance (Refactor, high compatibility) via DMS with online migration
> - ASP.NET apps: App Service Migration Assistant (Refactor to App Service)
> - 50 TB file data: Data Box (100 Mbps = 50 TB would take 46+ days over the internet) → migrate first with Data Box, sync delta via AzCopy
> - Connectivity: ExpressRoute 1 Gbps for replication (or at minimum a dedicated S2S VPN for migration traffic)
`,

  quiz: [
    {
      question: 'A company needs to migrate 200 VMware VMs to Azure with minimal downtime and risk. Which Azure tool is most appropriate for assessment and migration?',
      options: [
        'Azure Site Recovery (only)',
        'Azure Migrate with Server Assessment and Server Migration',
        'Azure Resource Mover',
        'Azure Backup with restore to new VMs'
      ],
      correct: 1,
      explanation: 'Azure Migrate is the official migration hub. Server Assessment discovers and evaluates VMs (recommended Azure size, estimated cost, compatibility issues, dependencies). Server Migration executes the migration with continuous replication, test migration and cutover. Azure Site Recovery can also migrate but Azure Migrate is the specific tool for migration with integrated assessment.',
      reference: 'Azure Migrate = migration hub (discover + assess + migrate). ASR = replication/DR (can be used to migrate but has no assessment).'
    },
    {
      question: 'A company has 80 TB of on-premises data to migrate to Azure Blob Storage. The available Internet connection is 50 Mbps. Which is the fastest approach?',
      options: [
        'Transfer everything over the internet using AzCopy (would take ~143 days)',
        'Use Azure Data Box for physical shipping of the data',
        'Use a 10 Gbps Azure ExpressRoute (would take ~18 hours)',
        'Compress the data and transfer in parallel'
      ],
      correct: 1,
      explanation: 'At 50 Mbps, 80 TB would take ~143 days to transfer. Azure Data Box lets you ship data on physical drives — one Data Box holds 80 TB, and Microsoft returns it in ~1 week after shipment. For large volumes with limited bandwidth, Data Box is always faster. The general rule: if the transfer takes more than 1 week over the internet, use Data Box.',
      reference: 'Calculation: 80 TB × 8 bits / 50 Mbps = ~12.9 million seconds ≈ 149 days. Data Box Heavy = 1 week. Always calculate before choosing.'
    },
    {
      question: 'An on-premises SQL Server with SQL Agent jobs and linked servers needs to be migrated to Azure with minimal refactoring. Which Azure service should be chosen?',
      options: [
        'Azure SQL Database (Single)',
        'Azure SQL Managed Instance',
        'Azure Database for PostgreSQL',
        'SQL Server on Azure VM (IaaS)'
      ],
      correct: 1,
      explanation: 'Azure SQL Managed Instance offers ~100% compatibility with SQL Server, including SQL Agent, linked servers, CLR, database mail — features not available in Azure SQL Database. It is the best option for a lift-and-shift of SQL Server with advanced features, without having to manage the OS as you would on a VM. SQL Server on a VM has maximum compatibility but requires full VM management.',
      reference: 'Managed Instance = high compatibility + PaaS benefits. SQL Database = cloud-native, lower compatibility. SQL on VM = total control, total responsibility.'
    },
    {
      question: 'What is a "Test Migration" in Azure Migrate and why is it important?',
      options: [
        'A test migration that costs half the price',
        'Starts the replicated VM in an isolated VNet to validate that the application works before the real cutover',
        'A simulation that only estimates migration time',
        'A procedure only available for VMs with less than 1 TB of data'
      ],
      correct: 1,
      explanation: 'Test Migration creates an instance of the replicated VM in an isolated test VNet (without impacting production or continuous replication). You can validate that the application works in Azure, test connectivity, performance and integration with other systems. After validation, clean up the test and perform the real cutover. It is a critical step to reduce risk.',
      reference: 'Always perform a Test Migration before the real cutover. It is free (you only pay for the compute of the test VMs while they are running).'
    }
  ],

  flashcards: [
    {
      front: 'What are the 5 Rs of cloud migration and when to use each?',
      back: '1. **Rehost** (Lift & Shift) — move to IaaS without changes. Fast, low risk. VMs → Azure VMs.\n\n2. **Refactor** (Replatform) — minimal adjustment for PaaS. Web app → App Service, SQL → Managed Instance.\n\n3. **Rearchitect** — redesign for cloud-native. Monolith → microservices, SQL → Cosmos DB.\n\n4. **Rebuild** — rewrite from scratch for cloud-native.\n\n5. **Retire** — decommission. No longer needed.\n\nCommon strategy: Rehost first (quick wins), then Refactor/Rearchitect.'
    },
    {
      front: 'When to use Azure Data Box vs internet transfer?',
      back: '**General rule**: if transferring over the internet takes more than **1 week** → use Data Box.\n\n**Calculation**: \`data(GB) × 8 / bandwidth(Mbps) / 86400 = days\`\n\nProducts:\n- **Data Box Disk** (8 TB/disk, max 35 TB) — small\n- **Data Box** (80 TB) — medium\n- **Data Box Heavy** (1 PB) — large\n\nProcess: ship loaded drives, Microsoft uploads to Azure (1–2 weeks total).\n\nAfter: sync delta with AzCopy for data generated during shipping.'
    },
    {
      front: 'What are the phases of the Azure Migrate migration process?',
      back: '**Phase 1 — Discover & Assess:**\n- Deploy Azure Migrate Appliance on-prem\n- Discovery: 6–24h for inventory\n- Dependency Analysis: 28 days (recommended)\n- Assessment Report: sizing + cost + readiness\n\n**Phase 2 — Prepare:**\n- Create Azure infra (VNet, NSG, RG)\n- Configure connectivity (VPN/ExpressRoute)\n\n**Phase 3 — Migrate:**\n- Enable replication\n- **Test Migration** in isolated VNet\n- Validate application\n- **Cutover** (minimal downtime)\n\n**Phase 4 — Optimize:**\n- Right-sizing, Reserved Instances, monitoring'
    }
  ],

  lab: {
    scenario: 'Explore Azure Migrate to understand the assessment and migration process.',
    objective: 'Create an Azure Migrate project and explore assessment settings.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Create an Azure Migrate Project',
        instruction: 'Create an Azure Migrate project to simulate a migration.',
        hints: ['\`az migrate project create\`'],
        solution: `\`\`\`bash
az group create --name rg-migrate-lab --location eastus

# Create an Azure Migrate Project
az migrate project create \\
  --resource-group rg-migrate-lab \\
  --name technova-migration \\
  --location eastus \\
  --assessment-solution-id "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-migrate-lab/providers/Microsoft.Migrate/assessmentProjects/technova-migration"

echo "Azure Migrate Project created: technova-migration"
echo "Next step: deploy the Azure Migrate Appliance on-premises for discovery"
\`\`\``,
        verify: `\`\`\`bash
az migrate project list --resource-group rg-migrate-lab \\
  --query "[].{Name:name,Status:properties.provisioningState}" -o table 2>/dev/null || \\
  echo "Check via portal: Azure Migrate → Projects"
\`\`\``
      },
      {
        title: 'Explore assessment tools',
        instruction: 'Explore sizing criteria for assessment and calculate the transfer time for a scenario.',
        hints: ['Calculation: data(GB) × 8 / bandwidth(Mbps) / 3600 = hours'],
        solution: `\`\`\`bash
echo "=== Migration Calculator ==="
echo ""

# Transfer time calculation
DADOS_GB=50000  # 50 TB
BANDWIDTH_MBPS=100

SEGUNDOS=$(echo "$DADOS_GB * 1024 * 8 / $BANDWIDTH_MBPS" | bc)
HORAS=$(echo "$SEGUNDOS / 3600" | bc)
DIAS=$(echo "$HORAS / 24" | bc)

echo "Data to migrate: \${DADOS_GB} GB ($(($DADOS_GB/1024)) TB)"
echo "Available bandwidth: \${BANDWIDTH_MBPS} Mbps"
echo "Estimated time: \${HORAS} hours (~\${DIAS} days)"
echo ""
if [ $DIAS -gt 7 ]; then
  echo "WARNING: Use Azure Data Box (> 7 days over the internet)"
else
  echo "OK: Internet transfer is viable"
fi
\`\`\``,
        verify: `\`\`\`bash
echo "With 50 TB and 100 Mbps:"
echo "50000 GB × 8 bits / 100 Mbps = 4,000,000 seconds ≈ 46 days"
echo "→ Use Azure Data Box Heavy (1 PB capacity)"
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-migrate-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-migrate-lab 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Azure Migrate Appliance not discovering VMware VMs',
      difficulty: 'medium',
      symptom: 'The Azure Migrate Appliance was installed but is not discovering VMs in vCenter. The status shows "Discovery not started" after 24 hours.',
      diagnosis: `\`\`\`bash
# Check in the portal: Azure Migrate → Servers → Discovered servers
# If count = 0 after 12+ hours, there is a problem with the appliance or connectivity

# On the appliance server (local web UI):
# http://appliance-name:44368 or http://localhost:44368
# Check: Configuration Manager → Service status
# All services must be "Running"
\`\`\``,
      solution: `**Diagnostic checklist:**

1. **vCenter credentials**: check that the user configured in the appliance has permissions in vCenter (read-only is sufficient for discovery).

2. **Network connectivity**: the appliance must reach the vCenter Server on port 443. Test: \`Test-NetConnection -ComputerName vcenter -Port 443\`.

3. **Azure connectivity**: the appliance needs outbound access to Azure URLs (*.azure.com, *.microsoftonline.com). Check the corporate firewall.

4. **Discovery time**: initial discovery can take 24+ hours for large environments (>1000 VMs).

5. **Outdated appliance**: update the appliance to the latest version via Configuration Manager.

6. **Multiple appliances**: each appliance supports up to 10,000 VMs — for larger environments, use multiple appliances.`
    }
  ]
};
