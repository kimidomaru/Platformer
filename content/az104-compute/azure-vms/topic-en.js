window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-compute/azure-vms'] = {
  theory: `# Azure Virtual Machines & Availability

## Exam Relevance
> Estimated weight **20-25%** on AZ-104. VMs are the most tested compute resource — sizes, disks, high availability and monitoring are frequent topics.

## Core Concepts

### Creating a VM
An Azure VM is composed of:
- **Compute**: size (vCPUs, RAM)
- **Storage**: OS disk + data disks
- **Networking**: NIC on a VNet subnet
- **OS Image**: Windows or Linux (marketplace or custom)

### VM Size Families

| Family | Typical Use | Example |
|--------|-------------|---------|
| **B** (Burstable) | Dev/test, intermittent use | B2s (2 vCPU, 4 GB) |
| **D** (General Purpose) | Web apps, small databases | D4s_v5 (4 vCPU, 16 GB) |
| **E** (Memory Optimized) | Databases, in-memory cache | E8s_v5 (8 vCPU, 64 GB) |
| **F** (Compute Optimized) | CPU-intensive | F8s_v2 (8 vCPU, 16 GB) |
| **N** (GPU) | ML, rendering | NC6s_v3 (NVIDIA GPU) |
| **L** (Storage Optimized) | Big data, NoSQL | L8s_v3 (local NVMe) |

### VM Disks

| Type | Technology | Use |
|------|-----------|-----|
| **Standard HDD** | Magnetic | Backup, archive |
| **Standard SSD (E)** | SSD | Light production workloads |
| **Premium SSD (P)** | High-performance SSD | Production, databases |
| **Premium SSD v2** | NVMe SSD | High I/O, low latency |
| **Ultra Disk** | Extreme NVMe SSD | Critical workloads (SAP, Oracle) |

**Disk types by use:**
- **OS Disk**: operating system disk (mandatory)
- **Temporary Disk**: local ephemeral storage (not replicated, lost on reallocation)
- **Data Disk**: additional disks for application data

### High Availability

#### Availability Sets
Protects against physical failures **within a datacenter**:
- **Fault Domains (FD)**: groups of servers sharing power and switch. Azure distributes VMs across up to 3 FDs.
- **Update Domains (UD)**: logical groups for planned maintenance. Azure updates one UD at a time. Default: 5 UDs.
- SLA: **99.95%** (with 2+ VMs in an Availability Set)
- VMs in an Availability Set must be created in the same RG and region
- **Cannot be migrated to Availability Zones**

#### Availability Zones
Protects against **full datacenter** failures in the same region:
- Physically separated zones with independent power, network and cooling
- Most Azure regions have 3 zones
- SLA: **99.99%** (with 2+ VMs in different zones)
- Supports Zone-Redundant Storage (ZRS)

#### Azure Site Recovery (ASR)
Replicates VMs to another Azure region — for DR (Disaster Recovery). This is DR, not HA.

### Extensions and Custom Script
**VM Extensions** add functionality post-deploy:
- **Custom Script Extension**: runs scripts on the VM after creation
- **Diagnostics Extension**: sends metrics/logs to Storage/Monitor
- **Azure Monitor Agent**: collects logs and metrics
- **Key Vault Extension**: syncs Key Vault secrets to local files

### Bastion Host
Secure SSH/RDP access via browser **without needing a public IP on the VM**:
- Requires a dedicated \`AzureBastionSubnet\` (/27 or larger)
- Premium: SSH/RDP session tunneled through the Azure Portal
- No exposure of ports 22 or 3389 to the Internet

## Essential Commands (Azure CLI)

\`\`\`bash
# Create a simple Linux VM
az vm create \\
  --name myVM \\
  --resource-group myRG \\
  --image Ubuntu2204 \\
  --size Standard_B2s \\
  --vnet-name myVNet \\
  --subnet mySubnet \\
  --admin-username azureuser \\
  --generate-ssh-keys \\
  --public-ip-sku Standard

# Create a VM in an Availability Zone
az vm create \\
  --name myVM-zone1 \\
  --resource-group myRG \\
  --image Ubuntu2204 \\
  --size Standard_D2s_v5 \\
  --zone 1 \\
  --admin-username azureuser \\
  --generate-ssh-keys

# Create an Availability Set
az vm availability-set create \\
  --name myAvailabilitySet \\
  --resource-group myRG \\
  --platform-fault-domain-count 3 \\
  --platform-update-domain-count 5

# Create a VM in an Availability Set
az vm create \\
  --name myVM \\
  --resource-group myRG \\
  --availability-set myAvailabilitySet \\
  --image Win2022Datacenter \\
  --size Standard_D2s_v3 \\
  --admin-username azureuser \\
  --admin-password "P@ssword123!"

# List VMs and status
az vm list --resource-group myRG \\
  --query "[].{Name:name,Status:powerState,Size:hardwareProfile.vmSize}" -o table

# Stop VM (deallocates, stops billing for compute)
az vm deallocate --name myVM --resource-group myRG

# Start VM
az vm start --name myVM --resource-group myRG

# Resize a VM
az vm resize \\
  --name myVM \\
  --resource-group myRG \\
  --size Standard_D4s_v5

# Attach a data disk
az vm disk attach \\
  --vm-name myVM \\
  --resource-group myRG \\
  --name myDataDisk \\
  --size-gb 128 \\
  --sku Premium_LRS \\
  --new

# View VM high availability info
az vm show \\
  --name myVM \\
  --resource-group myRG \\
  --query "{AvailSet:availabilitySet,Zone:zones,Size:hardwareProfile.vmSize}" -o json

# Run a remote script on the VM via Run Command
az vm run-command invoke \\
  --name myVM \\
  --resource-group myRG \\
  --command-id RunShellScript \\
  --scripts "sudo apt-get update && sudo apt-get install -y nginx"
\`\`\`

## Common Mistakes

1. **Stopped vs Deallocated**: "Stopped" still charges for compute; "Deallocated" does not (but the public IP may change).
2. **Availability Set ≠ Availability Zone**: they are different strategies — not interchangeable.
3. **Temporary disk lost**: data on the temp disk is lost on deallocate/resize/hardware failure — use it only for cache/temp files.
4. **Premium SSD not available on all sizes**: B-series (burstable) VMs do not support Premium SSD.
5. **Disk limit per VM**: each VM size has a maximum number of data disks (Max Data Disks).

## Killer.sh Style Challenge

> **Scenario**: A 3-tier web application (web, app, database) needs high availability:
> - Web tier: 3 VMs resilient to both datacenter failures **and** hardware failures
> - App tier: 2 VMs resilient only to hardware failures
> - Database tier: 2 VMs with high-performance storage for SQL Server
>
> **Recommend the HA strategy and disk type for each tier.**
>
> **Answer**:
> - Web tier: **Availability Zones** (3 VMs in zones 1, 2, 3) — protects against datacenter failure + 99.99% SLA
> - App tier: **Availability Set** (2 VMs) — protects against hardware/planned-maintenance failure + 99.95% SLA
> - DB tier: **Availability Zone** + **Premium SSD** (P30 or higher) — I/O performance for SQL Server
`,

  quiz: [
    {
      question: 'What is the difference between Availability Sets and Availability Zones in Azure?',
      options: [
        'Availability Sets protect against datacenter failures; Zones protect against hardware only',
        'Availability Sets protect against hardware/maintenance failures within a datacenter (FD/UD); Zones protect against a full datacenter failure',
        'There is no technical difference, only cost',
        'Availability Zones are the older version; Availability Sets are the newer'
      ],
      correct: 1,
      explanation: 'Availability Sets distribute VMs across Fault Domains (separate racks) and Update Domains within a single datacenter. They protect against hardware failures and maintenance windows, but not against a full datacenter failure. Availability Zones place VMs in physically separate datacenters in the same region, protecting against a full datacenter failure. SLA: 99.95% (Avail. Set) vs 99.99% (Avail. Zones).',
      reference: 'Memorize: Sets = within the DC (FD + UD, 99.95%). Zones = separate DCs (99.99%).'
    },
    {
      question: 'An Azure VM was "Stopped" (by the OS) but not "Deallocated". What is the implication?',
      options: [
        'The VM incurs no charge when Stopped',
        'The VM continues to be billed for compute when Stopped but not Deallocated',
        'A VM stopped by the OS is automatically deallocated by Azure',
        'Stopped and Deallocated are synonyms in Azure'
      ],
      correct: 1,
      explanation: 'Stopped (VM shut down by the OS or the "Stop" button that does not deallocate) still has compute allocated — you keep paying for the instance. Only when the state is "Deallocated" (via the portal "Stop" that deallocates, or \`az vm deallocate\`) does Azure release the hardware and stop billing for compute. Resources like disks and IPs still incur charges.',
      reference: 'ALWAYS use \`az vm deallocate\` to stop dev/test VMs and save money. "Stop" inside the OS does not deallocate.'
    },
    {
      question: 'What is the availability SLA for VMs distributed across Availability Zones vs Availability Sets?',
      options: [
        'Zones: 99.9% | Sets: 99.5%',
        'Zones: 99.99% | Sets: 99.95%',
        'Zones: 99.95% | Sets: 99.99%',
        'Both offer 99.99%'
      ],
      correct: 1,
      explanation: '2+ VMs in Availability Zones → 99.99% SLA (four nines). 2+ VMs in an Availability Set → 99.95% SLA. The difference is because Zones offer physical isolation between datacenters, while Sets only isolate hardware within a single datacenter.',
      reference: 'SLA is fundamental for design questions in AZ-304/305: Zones = 99.99%, Sets = 99.95%, single VM Premium SSD = 99.9%.'
    },
    {
      question: 'Which Azure disk type offers the highest IOPS and lowest latency for mission-critical database workloads?',
      options: [
        'Standard HDD',
        'Premium SSD',
        'Standard SSD',
        'Ultra Disk'
      ],
      correct: 3,
      explanation: 'Ultra Disk offers the highest IOPS (up to 400,000) and lowest latency (sub-millisecond) — ideal for extremely I/O-intensive workloads like SAP HANA, Oracle, and critical SQL Server. Premium SSD provides good performance and is the most used in production, but Ultra Disk surpasses it in all I/O aspects. Ultra Disk has restrictions: available only in certain regions and VM sizes.',
      reference: 'Performance hierarchy: HDD < Standard SSD < Premium SSD < Ultra Disk (cost and IOPS grow together).'
    },
    {
      question: 'What happens to data on the Temporary Disk of an Azure VM when it is deallocated and restarted?',
      options: [
        'Data is preserved automatically',
        'Data is lost — the temporary disk is not persistent',
        'Data is automatically migrated to the OS disk',
        'Data is kept in a temporary snapshot for 24 hours'
      ],
      correct: 1,
      explanation: 'The Temporary Disk (D: on Windows, /dev/sdb on Linux) is local ephemeral storage. Data is lost on deallocate, resize, hardware failure or planned maintenance. Use it only for data that can be recreated: swap files, temporary cache, session files. NEVER store important data on the temp disk.',
      reference: 'Temp disk = volatile storage. For persistent data, use Data Disks (managed by Azure).'
    },
    {
      question: 'How do you securely access a Linux VM via SSH without exposing port 22 to the Internet?',
      options: [
        'Create an NSG Allow rule for port 22 restricted to your public IP only',
        'Use Azure Bastion — SSH/RDP access via browser without exposing ports to the Internet',
        'Create a Jump Server (custom Bastion Host) with a public IP',
        'Use a point-to-site VPN to connect to Azure'
      ],
      correct: 1,
      explanation: 'Azure Bastion is a managed service that provides secure SSH and RDP access via browser (HTTPS) without exposing ports 22 or 3389 to the Internet. It requires a dedicated "AzureBastionSubnet" (/27 or larger) in the VNet. It is the method recommended by Microsoft for secure remote access to VMs.',
      reference: 'Bastion = secure access without a public IP on the VM. P2S VPN is also valid for corporate access, but Bastion is simpler for ad-hoc access.'
    }
  ],

  flashcards: [
    {
      front: 'What is the difference between VM Stopped and VM Deallocated?',
      back: '**Stopped** (shut down in OS or without deallocating):\n- VM remains allocated on hardware\n- **Charges** for compute (vCPU + RAM)\n- Dynamic public IP may be preserved\n\n**Deallocated** (\`az vm deallocate\`):\n- Hardware released by Azure\n- **No charge** for compute\n- Dynamic public IP may be released\n- Data on OS/Data disks is preserved\n\nAlways use \`deallocate\` to stop VMs that won\'t be used.'
    },
    {
      front: 'What are Fault Domains and Update Domains in an Availability Set?',
      back: '**Fault Domain (FD)**: a group of physical hardware (rack) that shares power and network switch. Azure distributes VMs across up to 3 FDs. If a rack fails, only the VMs in that FD are affected.\n\n**Update Domain (UD)**: a logical group for planned maintenance. Azure restarts one UD at a time. Default: 5 UDs. If you have 2 VMs in different UDs, they are never restarted simultaneously.\n\nSLA with 2+ VMs in an Availability Set: **99.95%**'
    },
    {
      front: 'What are the Azure disk types and their characteristics?',
      back: '| Type | SKU | Use |\n|------|-----|-----|\n| Standard HDD | HDD | Backup, archive (low cost) |\n| Standard SSD | E | Dev/test, light apps |\n| Premium SSD | P | Production, DBs (I/O intensive) |\n| Premium SSD v2 | — | High I/O + low latency |\n| Ultra Disk | — | Mission critical (SAP, Oracle) |\n\nTemp disk: local, ephemeral, **lost on deallocate/resize**.'
    },
    {
      front: 'What is Azure Bastion and why use it?',
      back: '**Azure Bastion** is a managed PaaS service for SSH/RDP access to VMs via browser (HTTPS) without exposing ports to the Internet.\n\n**Advantages**:\n- VMs without a public IP = smaller attack surface\n- No need to manage Jump Servers\n- Integrated into the Azure portal\n- Supports SSH keys and credentials\n\n**Requirements**:\n- Dedicated \`AzureBastionSubnet\` (/27 minimum)\n- SKU: Basic or Standard (Standard = more features)'
    },
    {
      front: 'When to use an Availability Set vs an Availability Zone?',
      back: '**Use Availability Set when:**\n- The region has no Availability Zones\n- You need granular FD/UD control\n- Tighter budget\n- 99.95% SLA is sufficient\n\n**Use Availability Zone when:**\n- The region supports zones (most major regions do)\n- You need to protect against a full datacenter failure\n- 99.99% SLA is required\n- Critical production workloads\n\nYou cannot move VMs between Availability Sets and Zones after creation.'
    }
  ],

  lab: {
    scenario: 'Create two Linux VMs for TechNova using different high-availability strategies: one in an Availability Set and one in an Availability Zone.',
    objective: 'Create VMs with Availability Sets and Zones, verify HA settings and understand the SLA impact.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create a VM in an Availability Zone',
        instruction: `Create a Linux VM \`web-vm-zone1\` in Zone 1, size B2s, with the Ubuntu 22.04 image. Use automatic SSH key generation.`,
        hints: [
          'Use \`--zone 1\` to specify the Availability Zone',
          'Ubuntu image: \`Ubuntu2204\`',
          '\`--generate-ssh-keys\` creates the SSH key automatically'
        ],
        solution: `\`\`\`bash
az group create --name rg-compute-lab --location eastus

# Create a VM in Availability Zone 1
az vm create \\
  --name web-vm-zone1 \\
  --resource-group rg-compute-lab \\
  --image Ubuntu2204 \\
  --size Standard_B2s \\
  --zone 1 \\
  --admin-username azureuser \\
  --generate-ssh-keys \\
  --output json | grep -E '"name"|"zones"|"publicIpAddress"'
\`\`\``,
        verify: `\`\`\`bash
az vm show \\
  --name web-vm-zone1 \\
  --resource-group rg-compute-lab \\
  --query "{Name:name,Zones:zones,Status:provisioningState}" -o table
# Expected output:
# Name           Zones  Status
# -------------  -----  ---------
# web-vm-zone1   ['1']  Succeeded
\`\`\``
      },
      {
        title: 'Create an Availability Set and a second VM',
        instruction: `Create an Availability Set \`app-avset\` with 3 Fault Domains and 5 Update Domains. Then create a VM \`app-vm-1\` inside that Availability Set.`,
        hints: [
          '\`az vm availability-set create\` with \`--platform-fault-domain-count\` and \`--platform-update-domain-count\`',
          'When creating the VM, use \`--availability-set\` to associate it'
        ],
        solution: `\`\`\`bash
# Create the Availability Set
az vm availability-set create \\
  --name app-avset \\
  --resource-group rg-compute-lab \\
  --platform-fault-domain-count 3 \\
  --platform-update-domain-count 5

# Create a VM in the Availability Set
az vm create \\
  --name app-vm-1 \\
  --resource-group rg-compute-lab \\
  --image Ubuntu2204 \\
  --size Standard_B2s \\
  --availability-set app-avset \\
  --admin-username azureuser \\
  --generate-ssh-keys \\
  --no-wait
\`\`\``,
        verify: `\`\`\`bash
# Verify the Availability Set
az vm availability-set show \\
  --name app-avset \\
  --resource-group rg-compute-lab \\
  --query "{FDs:platformFaultDomainCount,UDs:platformUpdateDomainCount,VMs:length(virtualMachines)}" -o table
# Expected output: FDs=3, UDs=5

# Verify the VM is in the AvSet (after provisioning)
az vm show \\
  --name app-vm-1 \\
  --resource-group rg-compute-lab \\
  --query "{Name:name,AvailSet:availabilitySet.id}" -o json 2>/dev/null | grep -c "app-avset" && echo "VM is in the correct Availability Set"
\`\`\``
      },
      {
        title: 'Check status and deallocate VMs to save costs',
        instruction: `List all created VMs with their power states. Then deallocate the VMs so compute is not billed during the lab.`,
        hints: [
          '\`az vm list --show-details\` includes the \`powerState\`',
          '\`az vm deallocate\` can be called with \`--no-wait\` to avoid blocking'
        ],
        solution: `\`\`\`bash
# List VMs with power state
az vm list --resource-group rg-compute-lab --show-details \\
  --query "[].{Name:name,Status:powerState,Zone:zones,AvailSet:availabilitySet.id}" -o table

# Deallocate both VMs to save costs
az vm deallocate --name web-vm-zone1 --resource-group rg-compute-lab --no-wait
az vm deallocate --name app-vm-1 --resource-group rg-compute-lab --no-wait

echo "VMs being deallocated — no compute charge will be incurred"
\`\`\``,
        verify: `\`\`\`bash
# Wait for deallocate and check status (after 1-2 minutes)
az vm list --resource-group rg-compute-lab --show-details \\
  --query "[].{Name:name,Status:powerState}" -o table
# Expected output after deallocate:
# Status: VM deallocated
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group and all resources.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-compute-lab --yes --no-wait
echo "Cleanup started!"
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-compute-lab 2>/dev/null && echo "Still deleting..." || echo "RG deleted successfully"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'VM does not start after resizing',
      difficulty: 'medium',
      symptom: 'After resizing a VM to a larger size, it gets stuck in "Starting" and does not boot.',
      diagnosis: `\`\`\`bash
# Check the current state of the VM
az vm show --name myVM --resource-group myRG \\
  --query "{Status:provisioningState,PowerState:instanceView.statuses}" -o json

# Check whether the desired size is available in the zone/region
az vm list-vm-resize-options \\
  --name myVM \\
  --resource-group myRG \\
  --query "[].name" -o tsv | grep D4s

# Check boot logs via Boot Diagnostics
az vm boot-diagnostics get-boot-log --name myVM --resource-group myRG
\`\`\``,
      solution: `**Causes and solutions:**

1. **Size not available on the current cluster**: the host where the VM is allocated may not have capacity for the requested size. Solution: deallocate the VM before resizing (releases the hardware, Azure allocates on hardware that supports the new size):
\`\`\`bash
az vm deallocate --name myVM --resource-group myRG
az vm resize --name myVM --resource-group myRG --size Standard_D4s_v5
az vm start --name myVM --resource-group myRG
\`\`\`

2. **VM in Availability Set with size limitations**: all sizes must be from the same family for VMs in the same Availability Set. Check compatibility before resizing.

3. **Boot Diagnostics for diagnosis**: enable Boot Diagnostics to see a screenshot of the boot screen and startup logs.`
    },
    {
      title: 'Cannot connect via SSH to the VM',
      difficulty: 'easy',
      symptom: 'An SSH attempt to an Azure VM returns "Connection timed out" or "Connection refused".',
      diagnosis: `\`\`\`bash
# Check whether the VM is running
az vm show --name myVM --resource-group myRG --show-details \\
  --query "powerState" -o tsv

# Check the VM public IP
az vm list-ip-addresses --name myVM --resource-group myRG -o table

# Check effective NSG rules on the NIC
az network nic list-effective-nsg --name myNIC --resource-group myRG \\
  --query "effectiveNetworkSecurityGroups[].effectiveSecurityRules[?access=='Allow' && direction=='Inbound']" -o table

# Use Network Watcher to test connectivity
az network watcher test-connectivity \\
  --source-resource <vm-resource-id> \\
  --dest-address <dest-ip> \\
  --dest-port 22
\`\`\``,
      solution: `**Checklist in order:**

1. **Is the VM running?** Check \`powerState\` = "VM running"
2. **Public IP configured?** VM may have been created without a public IP
3. **NSG blocking port 22?** Check whether there is an Allow rule for port 22 or use Azure Bastion
4. **Just-in-Time (JIT) VM Access**: if Azure Security Center/Defender is active, port 22 may be blocked by default. Request JIT access via the portal
5. **Incorrect SSH key**: check that you are using the correct key for the configured user

**Recommended solution — Azure Bastion**:
\`\`\`bash
# Create Bastion (requires AzureBastionSubnet)
az network vnet subnet create \\
  --name AzureBastionSubnet \\
  --vnet-name myVNet --resource-group myRG \\
  --address-prefixes 10.0.100.0/27

az network bastion create \\
  --name myBastion \\
  --resource-group myRG \\
  --vnet-name myVNet \\
  --location eastus \\
  --sku Basic
\`\`\``
    }
  ]
};
