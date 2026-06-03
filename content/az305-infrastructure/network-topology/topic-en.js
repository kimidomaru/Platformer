window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-infrastructure/network-topology'] = {
  theory: `# Designing Network Topology (AZ-305)

## Exam Relevance
> Estimated weight **20-25%** on AZ-305. Questions about topology choice (hub-spoke, vWAN, mesh), hybrid connectivity and network security.

## Topology Patterns

### Hub-and-Spoke
The most common enterprise topology:
\`\`\`
Internet
    ↓
Azure Firewall / NVA (Hub VNet)
    ├─ VNet Spoke 1 (App A)
    ├─ VNet Spoke 2 (App B)
    └─ VNet Spoke 3 (App C)
         ↕ (via hub)
    On-premises (ExpressRoute / VPN)
\`\`\`

**Hub VNet**: contains shared services:
- Azure Firewall or NVA (Network Virtual Appliance)
- ExpressRoute / VPN Gateway
- Azure Bastion
- DNS Resolver

**Spoke VNets**: isolated, peered to the hub

**VNet Peering**: spoke-to-hub + hub-to-spoke (two peerings per spoke)

**Transitive traffic via hub**: VNet Spoke 1 → Azure Firewall in Hub → VNet Spoke 2
(Remember: VNet Peering is not transitive — the hub with Firewall provides the transit)

### Azure Virtual WAN (vWAN)
Microsoft-managed hub-and-spoke — simpler for multiple regions:
- **Standard vWAN**: supports SD-WAN partners, higher performance
- **Basic vWAN**: S2S VPN only
- Hub managed automatically by Microsoft
- Automatic routing between spokes, branches and ExpressRoute

**When to use vWAN vs manual Hub-and-Spoke:**
- vWAN: many regions, many branches, want less management
- Manual hub: more control, custom Azure Firewall, lower cost for small topologies

### Private Endpoints vs Service Endpoints
| | Service Endpoint | Private Endpoint |
|-|-----------------|-----------------|
| Access | Via Azure backbone network | Via private IP in the VNet |
| Endpoint | Still public (service public IP) | Private IP in your VNet |
| DNS | Does not change | DNS resolves to private IP |
| Cost | No extra cost | Cost per hour + data |
| Security | Better than Internet | Better than Service Endpoint |

**Use Private Endpoints for:**
- Compliance requiring traffic never leaves the VNet
- Storage, Key Vault, SQL, etc. completely private

### Azure DNS & Private DNS Zones
- **Azure DNS**: public DNS service for domains (creates public DNS zones)
- **Private DNS Zone**: internal DNS for VNet resources
- **Azure DNS Private Resolver**: resolves DNS on-premises ↔ Azure Private DNS

**For Private Endpoints to work**: create Private DNS Zone + Virtual Network Link

### Azure DDoS Protection
- **Basic** (free): basic protection for all Azure resources
- **Standard**: advanced protection, telemetry, alerts, automatic mitigation
  - Requires: Virtual Network where resources with public IPs reside

### Azure Firewall
Managed Layer 4 and Layer 7 firewall:
- **Standard**: FQDN filtering, Network rules, Application rules
- **Premium**: TLS inspection, IDPS (Intrusion Detection/Prevention), URL categories
- Integrates with Azure Firewall Policy (centralized rule hierarchy)

## Design Patterns

### Pattern: Layered Network Security
\`\`\`
Internet
    ↓
DDoS Protection Standard
    ↓
Azure Firewall (L7 filter, IDPS)
    ↓
Application Gateway with WAF (L7 HTTP)
    ↓
Standard Load Balancer (L4)
    ↓
NSG on Subnet (L4 micro-segmentation)
    ↓
VMs / Services
\`\`\`

### Pattern: Hybrid Connectivity with Redundancy
\`\`\`
On-Premises
    ├─ ExpressRoute (primary) ──→ Azure Hub VNet
    └─ VPN Gateway (backup) ──────→ Azure Hub VNet
              ↓
        Route Priority: ExpressRoute first, VPN as failover
\`\`\`

## Common Design Mistakes

1. **Assuming transitive peering**: VNet A ↔ B and B ↔ C does not mean A can talk directly to C.
2. **Private Endpoint without DNS**: without resolving DNS to the private IP, the application uses the public IP.
3. **NSG on the GatewaySubnet**: do NOT place an NSG on the GatewaySubnet — it can break gateway connectivity.
4. **vWAN Standard vs Basic**: Basic only supports S2S VPN; Standard is for ExpressRoute and SD-WAN.

## Killer.sh Style Challenge

> **Scenario**: A global company has 5 VNets in 3 regions (East US, West EU, Southeast Asia), 20 on-premises branches and 3 external partners who need restricted access. Design the network topology.
>
> **Expected solution**: Azure Virtual WAN Standard with hubs in each region (multi-region). Branches connected via SD-WAN partners integrated with vWAN. External partners: B2B with Azure AD + Application Gateway/Private Endpoint for restricted access. DDoS Standard on VNets with public resources. Central Azure Firewall Policy managing rules across all hubs.
`,

  quiz: [
    {
      question: 'In a Hub-and-Spoke topology, VMs in Spoke-A need to communicate with VMs in Spoke-B. Which resource must be in the Hub to allow this transitive traffic?',
      options: [
        'An additional VNet Peering between Spoke-A and Spoke-B',
        'Azure Firewall or NVA (Network Virtual Appliance) in the Hub',
        'A Route Table pointing Spoke-A directly to Spoke-B',
        'An Application Gateway with backend pools in both Spokes'
      ],
      correct: 1,
      explanation: 'VNet Peering is not transitive. For traffic between spokes to flow through the hub, you need an Azure Firewall or NVA in the Hub that acts as a router/proxy. Traffic from Spoke-A goes to the Hub (via UDR), passes through the Firewall, and continues to Spoke-B. Without the Firewall, you would need a direct peering between every pair of spokes (mesh).',
      reference: 'Hub-and-spoke: Firewall/NVA in the hub = enables transitive traffic. Without it: direct peering between each spoke pair (exponentially more peerings).'
    },
    {
      question: 'What is the main difference between a Service Endpoint and a Private Endpoint for a Storage Account?',
      options: [
        'Service Endpoint is for blobs; Private Endpoint is for files',
        'With a Service Endpoint, the Storage still has a public IP but traffic uses the Azure backbone network; with a Private Endpoint, the Storage gets a private IP inside the VNet',
        'Service Endpoint is more secure than Private Endpoint',
        'There is no security difference — only cost'
      ],
      correct: 1,
      explanation: 'Service Endpoint optimizes routing (uses the Azure backbone instead of the Internet) but the service keeps its public endpoint. Private Endpoint creates a NIC with a private IP inside your VNet — DNS resolves the service name to this private IP, and traffic never leaves the VNet. Private Endpoint is more secure.',
      reference: 'Service Endpoint = backbone traffic but public IP. Private Endpoint = private IP in the VNet, fully private traffic.'
    },
    {
      question: 'When should you choose Azure Virtual WAN over a manual Hub-and-Spoke?',
      options: [
        'When cost is the main concern (vWAN is cheaper)',
        'When there are many regions, many branches and you want Azure to manage routing automatically',
        'When you need Azure Firewall (only vWAN supports it)',
        'For development/test workloads'
      ],
      correct: 1,
      explanation: 'Azure Virtual WAN is ideal for complex multi-region scenarios with many branches: Azure automatically manages the hub, routing tables and latency optimization. For simple topologies with 1–2 regions, manual Hub-and-Spoke is more economical and gives more control. vWAN is generally more expensive than manual Hub-and-Spoke.',
      reference: 'vWAN = global scale, less management, more expensive. Manual hub = more control, lower cost for simple topologies.'
    }
  ],

  flashcards: [
    {
      front: 'What are the benefits and limitations of the Hub-and-Spoke topology?',
      back: '**Benefits:**\n- Centralization of shared services (Firewall, VPN, Bastion, DNS)\n- Centralized security and auditing\n- Workload isolation (spokes)\n- Reduced cost vs full mesh\n\n**Limitations:**\n- Peering is not transitive → Firewall/NVA needed for spoke-to-spoke traffic\n- Hub is a single point of failure if there is no redundancy\n- Additional latency for spoke-to-spoke traffic (via hub)\n\n**Alternative for many regions**: Azure Virtual WAN (managed hub)'
    },
    {
      front: 'What is required for Private Endpoints to work correctly with DNS?',
      back: '**Without correct DNS**: the service name (e.g. \`mysa.blob.core.windows.net\`) resolves to the **public** IP, bypassing the Private Endpoint.\n\n**To make it work:**\n1. **Private DNS Zone**: create \`privatelink.blob.core.windows.net\`\n2. **Virtual Network Link**: associate the Private DNS Zone with the VNet\n3. **DNS A Record**: created automatically by Azure when the Private Endpoint is created\n\nResult: \`nslookup mysa.blob.core.windows.net\` returns a private IP (10.x.x.x)'
    },
    {
      front: 'What Azure Firewall SKUs exist and what are their differences?',
      back: '**Azure Firewall Standard:**\n- Network rules (L4)\n- Application rules with FQDN filtering\n- NAT rules (DNAT)\n- Threat Intelligence (block/alert for malicious IPs/FQDNs)\n\n**Azure Firewall Premium:**\n- Everything in Standard +\n- TLS inspection (inspects encrypted HTTPS traffic)\n- IDPS (Intrusion Detection and Prevention System)\n- URL categories (block categories of websites)\n- Web categories\n\nUse Premium for compliance that requires deep packet inspection.'
    }
  ],

  lab: {
    scenario: 'Create a basic Hub-and-Spoke topology to understand VNet isolation and connectivity.',
    objective: 'Create a Hub VNet, two Spoke VNets and configure bilateral VNet Peering.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create the Hub VNet and Spoke VNets',
        instruction: 'Create a Hub VNet (10.0.0.0/16), Spoke-1 (10.1.0.0/16) and Spoke-2 (10.2.0.0/16).',
        hints: ['Use \`az network vnet create\` three times with different address spaces'],
        solution: `\`\`\`bash
az group create --name rg-hubspoke-lab --location eastus

# Hub VNet
az network vnet create --name hub-vnet --resource-group rg-hubspoke-lab \\
  --address-prefixes 10.0.0.0/16 --subnet-name shared-subnet --subnet-prefixes 10.0.1.0/24

# Spoke VNets
az network vnet create --name spoke-1-vnet --resource-group rg-hubspoke-lab \\
  --address-prefixes 10.1.0.0/16 --subnet-name app-subnet --subnet-prefixes 10.1.1.0/24

az network vnet create --name spoke-2-vnet --resource-group rg-hubspoke-lab \\
  --address-prefixes 10.2.0.0/16 --subnet-name app-subnet --subnet-prefixes 10.2.1.0/24
\`\`\``,
        verify: `\`\`\`bash
az network vnet list --resource-group rg-hubspoke-lab \\
  --query "[].{Name:name,CIDR:addressSpace.addressPrefixes[0]}" -o table
# Expected output: 3 VNets with CIDRs 10.0/10.1/10.2
\`\`\``
      },
      {
        title: 'Configure bilateral VNet Peering Hub ↔ Spokes',
        instruction: 'Configure bilateral peering between the Hub and each Spoke (4 peerings in total).',
        hints: ['Each peering requires two commands: hub→spoke and spoke→hub'],
        solution: `\`\`\`bash
# Peering Hub ↔ Spoke-1 (bilateral)
az network vnet peering create \\
  --name hub-to-spoke1 --vnet-name hub-vnet --resource-group rg-hubspoke-lab \\
  --remote-vnet spoke-1-vnet --allow-vnet-access --allow-forwarded-traffic

az network vnet peering create \\
  --name spoke1-to-hub --vnet-name spoke-1-vnet --resource-group rg-hubspoke-lab \\
  --remote-vnet hub-vnet --allow-vnet-access --allow-forwarded-traffic

# Peering Hub ↔ Spoke-2 (bilateral)
az network vnet peering create \\
  --name hub-to-spoke2 --vnet-name hub-vnet --resource-group rg-hubspoke-lab \\
  --remote-vnet spoke-2-vnet --allow-vnet-access --allow-forwarded-traffic

az network vnet peering create \\
  --name spoke2-to-hub --vnet-name spoke-2-vnet --resource-group rg-hubspoke-lab \\
  --remote-vnet hub-vnet --allow-vnet-access --allow-forwarded-traffic
\`\`\``,
        verify: `\`\`\`bash
# Verify all peerings are Connected
az network vnet peering list --vnet-name hub-vnet --resource-group rg-hubspoke-lab \\
  --query "[].{Name:name,State:peeringState}" -o table
# Expected output: hub-to-spoke1 = Connected, hub-to-spoke2 = Connected
\`\`\``
      },
      {
        title: 'Verify isolation: Spokes cannot communicate directly',
        instruction: 'Observe that without a Firewall in the hub, traffic between spokes is not routed automatically — this is the key isolation principle of Hub-and-Spoke.',
        hints: ['This step is conceptual — demonstrates that only hub-to-spoke peering does not create automatic transit between spokes'],
        solution: `\`\`\`bash
# Demonstrate: without a Firewall in the hub, spoke-1 cannot reach spoke-2 via hub
# On a VM in spoke-1, a ping to 10.2.1.x would fail because:
# 1. The spoke-1 route goes to hub-vnet
# 2. hub-vnet has no route to spoke-2 without a Firewall/NVA

echo "Current topology: Spoke-1 and Spoke-2 can reach Hub, but NOT each other"
echo "For spoke-to-spoke transit: add Azure Firewall in the hub + UDRs in the spokes"
echo ""
echo "Existing peerings:"
az network vnet peering list --vnet-name hub-vnet --resource-group rg-hubspoke-lab \\
  --query "[].{Peering:name,Status:peeringState}" -o table
\`\`\``,
        verify: `\`\`\`bash
echo "Concept verified: 4 peerings, hub connected to both spokes"
echo "For spoke-to-spoke transit: Azure Firewall/NVA + UDRs needed"
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-hubspoke-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-hubspoke-lab 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Traffic between Spoke VNets does not flow through the Hub Firewall',
      difficulty: 'hard',
      symptom: 'VMs in Spoke-1 cannot reach VMs in Spoke-2 even with Azure Firewall in the Hub and peerings configured.',
      diagnosis: `\`\`\`bash
# Check effective routes on the NIC of a Spoke-1 VM
az network nic show-effective-route-table --name <nic-spoke1> --resource-group <rg> -o table
# Check whether there is a route to 10.2.0.0/16 pointing to the Firewall (10.0.x.x)

# Check the UDR on the Spoke-1 subnet
az network route-table list --resource-group <rg> \\
  --query "[].{Name:name,Routes:length(routes)}" -o table

# Check Azure Firewall Network Rules
az network firewall network-rule list --firewall-name hub-firewall --resource-group <rg> -o table
\`\`\``,
      solution: `**Checklist for spoke-to-spoke transit via Firewall:**

1. **UDRs on spokes**: create a Route Table with a default route (0.0.0.0/0) or a specific route (10.2.0.0/16) pointing to the Azure Firewall private IP in the hub. Associate the Route Table with the spoke subnet.

2. **Firewall rule**: create a Network Rule allowing traffic from 10.1.0.0/16 → 10.2.0.0/16 (and vice versa).

3. **Allow Forwarded Traffic on peering**: check that hub-to-spoke peerings have \`allowForwardedTraffic=true\`.

4. **Use Hub VNet Gateway**: if using VPN/ExpressRoute in the hub, check \`useRemoteGateways\` and \`allowGatewayTransit\` on the peerings.

\`\`\`bash
# Create a UDR to force traffic through the Firewall
FIREWALL_IP=$(az network firewall show --name hub-firewall --resource-group <rg> --query "ipConfigurations[0].privateIPAddress" -o tsv)

az network route-table create --name spoke1-udr --resource-group <rg>
az network route-table route create --route-table-name spoke1-udr --resource-group <rg> \\
  --name to-spoke2 --address-prefix 10.2.0.0/16 \\
  --next-hop-type VirtualAppliance --next-hop-ip-address $FIREWALL_IP
az network vnet subnet update --name app-subnet --vnet-name spoke-1-vnet \\
  --resource-group <rg> --route-table spoke1-udr
\`\`\``
    }
  ]
};
