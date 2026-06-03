window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-networking/vpn-expressroute'] = {
  theory: `# Azure VPN Gateway & ExpressRoute

## Exam Relevance
> Estimated weight **8-12%** on AZ-104. Questions about hybrid connectivity (on-premises ↔ Azure) are frequent in migration scenarios.

## Core Concepts

### VPN Gateway
Connects on-premises networks or other VNets to Azure via **encrypted tunneling** over the public Internet:

**VPN types:**
- **Site-to-Site (S2S)**: connects an entire on-premises network to an Azure VNet (requires an on-prem VPN device)
- **Point-to-Site (P2S)**: connects individual devices (laptops, PCs) to an Azure VNet
- **VNet-to-VNet**: connects two Azure VNets in different regions (alternative to Global Peering)

**VPN Gateway SKUs:**

| SKU | Throughput | S2S Tunnels | P2S Connections |
|-----|-----------|-------------|-----------------|
| **Basic** | 100 Mbps | 10 | 128 |
| **VpnGw1** | 650 Mbps | 30 | 250 |
| **VpnGw2** | 1 Gbps | 30 | 500 |
| **VpnGw3** | 1.25 Gbps | 30 | 1000 |

**Requirements:**
- Requires a dedicated \`GatewaySubnet\` (/27 or larger, preferably /26)
- Provisioning takes ~30–45 minutes
- Basic does not support Zone-Redundant or BGP

**BGP (Border Gateway Protocol):**
Enables dynamic routing between on-premises and Azure — required for ExpressRoute and multiple VPN tunnels with automatic failover.

### ExpressRoute
A private and dedicated connection between on-premises and Azure via a connectivity provider (does not go over the public Internet):

- Consistent and guaranteed latency (strong SLA)
- More secure (no Internet traffic)
- Speeds from 50 Mbps to 10 Gbps
- Requires a contract with a partner provider (Equinix, AT&T, etc.)

**Peering types:**
- **Private Peering**: accesses Azure VNets (private resources)
- **Microsoft Peering**: accesses Microsoft 365 and public Azure PaaS services

**ExpressRoute + VPN (coexistence):**
- VPN as backup if ExpressRoute fails
- Requires two gateways in the same GatewaySubnet (ExpressRoute Gateway + VPN Gateway)

### Comparison: VPN Gateway vs ExpressRoute

| Criterion | VPN Gateway | ExpressRoute |
|-----------|------------|-------------|
| Medium | Public Internet (encrypted) | Dedicated private line |
| Latency | Variable (Internet-dependent) | Guaranteed and consistent |
| Speed | Up to 1.25 Gbps | Up to 10 Gbps |
| Cost | Low | High |
| Setup | Fast (hours) | Weeks/months |
| SLA | 99.9% (zone-redundant: 99.99%) | 99.9% |

## Essential Commands (Azure CLI)

\`\`\`bash
# Create the GatewaySubnet
az network vnet subnet create \\
  --name GatewaySubnet \\
  --vnet-name myVNet \\
  --resource-group myRG \\
  --address-prefixes 10.0.255.0/27

# Create a public IP for the VPN Gateway (zone-redundant)
az network public-ip create \\
  --name vpn-gw-pip \\
  --resource-group myRG \\
  --sku Standard \\
  --zone 1 2 3

# Create the VPN Gateway (takes ~30-45 min)
az network vnet-gateway create \\
  --name myVPNGateway \\
  --resource-group myRG \\
  --vnet myVNet \\
  --public-ip-address vpn-gw-pip \\
  --gateway-type Vpn \\
  --vpn-type RouteBased \\
  --sku VpnGw2AZ \\
  --no-wait

# Create a Local Network Gateway (represents the on-premises network)
az network local-gateway create \\
  --name on-prem-lgw \\
  --resource-group myRG \\
  --gateway-ip-address 203.0.113.1 \\
  --local-address-prefixes 192.168.0.0/24

# Create an S2S connection
az network vpn-connection create \\
  --name S2S-Connection \\
  --resource-group myRG \\
  --vnet-gateway1 myVPNGateway \\
  --local-gateway2 on-prem-lgw \\
  --shared-key "SecretPSK123!" \\
  --connection-type IPsec

# Check connection status
az network vpn-connection show \\
  --name S2S-Connection \\
  --resource-group myRG \\
  --query "{Status:connectionStatus,Bytes:ingressBytesTransferred}" -o table
\`\`\`

## Common Mistakes

1. **GatewaySubnet with the wrong name**: must be exactly \`GatewaySubnet\` (case-sensitive).
2. **GatewaySubnet too small**: recommended /26 or /27 — smaller subnets cause issues with zone-redundant gateways.
3. **Different PSK on each side**: the Preshared Key must be identical on Azure and the on-premises device.
4. **Incompatible IKE policy**: check whether the on-premises VPN device supports the IKE/IPsec parameters configured in Azure.

## Killer.sh Style Challenge

> A company needs to connect its on-premises datacenter (192.168.0.0/16) to Azure with guaranteed low latency and 1 Gbps throughput for critical workloads. Which solution to use? What are the configuration requirements in Azure?
>
> **Answer**: ExpressRoute with a 1 Gbps circuit via a partner provider. In Azure: create an ExpressRoute Gateway (HighPerformance or UltraPerformance SKU) in the GatewaySubnet, create an ExpressRoute Circuit, configure Private Peering for access to VNets.
`,

  quiz: [
    {
      question: 'Which subnet must be created in an Azure VNet before deploying a VPN Gateway?',
      options: [
        'VPNSubnet',
        'GatewaySubnet',
        'AzureVPNSubnet',
        'ManagementSubnet'
      ],
      correct: 1,
      explanation: 'The VPN Gateway requires a subnet named exactly "GatewaySubnet" (case-sensitive) in the VNet. No other name will work. The recommended size is /26 or /27. User resources should not be placed in this subnet.',
      reference: 'GatewaySubnet is mandatory and the name must be EXACTLY "GatewaySubnet". Azure rejects gateways without it.'
    },
    {
      question: 'A company needs a connection with guaranteed and consistent latency between on-premises and Azure, without relying on the public Internet. Which solution to choose?',
      options: [
        'VPN Gateway Site-to-Site',
        'VPN Gateway Point-to-Site',
        'ExpressRoute',
        'VNet Peering'
      ],
      correct: 2,
      explanation: 'ExpressRoute offers a private and dedicated connection via a connectivity provider — it does not use the public Internet, providing consistent and guaranteed latency. VPN Gateway uses the public Internet (with encryption), subject to Internet variability. VNet Peering is only for Azure VNets.',
      reference: 'ExpressRoute = private, guaranteed latency, more expensive. VPN Gateway = encrypted Internet, variable, cheaper.'
    },
    {
      question: 'What is the difference between Site-to-Site and Point-to-Site VPN?',
      options: [
        'Site-to-Site connects datacenters; Point-to-Site connects individual devices to Azure',
        'Site-to-Site is faster; Point-to-Site is more secure',
        'Point-to-Site is between two data centers; Site-to-Site is for remote users',
        'There is no technical difference, only licensing'
      ],
      correct: 0,
      explanation: 'Site-to-Site (S2S) connects entire networks (e.g. on-premises datacenter 192.168.0.0/16 → Azure VNet), requires an on-premises VPN device with a fixed public IP. Point-to-Site (P2S) connects individual devices (laptop, home office PC) to Azure via a VPN client — no special on-premises hardware needed.',
      reference: 'S2S = network to network (requires VPN device). P2S = individual device to VNet (client VPN app).'
    }
  ],

  flashcards: [
    {
      front: 'What are the 3 VPN types supported by Azure VPN Gateway?',
      back: '1. **Site-to-Site (S2S)** — connects an entire on-premises network to the VNet. Requires an on-prem VPN device with a public IP.\n\n2. **Point-to-Site (P2S)** — connects individual devices to the VNet via a VPN client. For remote users.\n\n3. **VNet-to-VNet** — connects two Azure VNets in different regions (alternative to Global VNet Peering when a gateway already exists).'
    },
    {
      front: 'ExpressRoute vs VPN Gateway: when to use each?',
      back: '**Use ExpressRoute when:**\n- Guaranteed and consistent latency is critical\n- Throughput > 1 Gbps is needed\n- Compliance requires traffic off the public Internet\n- Permanent, high-quality connection needed\n- Budget allows (it is more expensive)\n\n**Use VPN Gateway when:**\n- Cost is a priority\n- Fast setup is needed\n- Up to 1.25 Gbps throughput is sufficient\n- Redundancy/backup for ExpressRoute\n- Connecting remote users (P2S)'
    },
    {
      front: 'What is the subnet requirement for a VPN Gateway and an ExpressRoute Gateway?',
      back: 'Both require a subnet named **exactly** \`GatewaySubnet\` in the VNet:\n\n- Minimum size: **/27** (for non-zone-redundant gateway)\n- Recommended size: **/26** (required for some zone-redundant SKUs)\n- Do not place other resources in this subnet\n- A VNet can have BOTH gateways in the same GatewaySubnet\n\nTypo in the name (e.g. "GatewaySubnet1") → deployment fails!'
    }
  ],

  lab: {
    scenario: 'Create the network infrastructure needed for a VPN Gateway (without provisioning the gateway itself — that takes 30+ min).',
    objective: 'Create a VNet with a GatewaySubnet and a Local Network Gateway, understanding the prerequisites for a Site-to-Site VPN.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Create the VNet with a GatewaySubnet',
        instruction: 'Create the VNet \`hybrid-vnet\` and add the \`GatewaySubnet\` /26.',
        hints: ['The subnet name must be EXACTLY "GatewaySubnet"'],
        solution: `\`\`\`bash
az group create --name rg-vpn-lab --location eastus
az network vnet create \\
  --name hybrid-vnet --resource-group rg-vpn-lab \\
  --address-prefixes 10.100.0.0/16 \\
  --subnet-name AppSubnet \\
  --subnet-prefixes 10.100.1.0/24

# Add GatewaySubnet (mandatory name)
az network vnet subnet create \\
  --name GatewaySubnet \\
  --vnet-name hybrid-vnet \\
  --resource-group rg-vpn-lab \\
  --address-prefixes 10.100.255.0/26
\`\`\``,
        verify: `\`\`\`bash
az network vnet subnet list --vnet-name hybrid-vnet --resource-group rg-vpn-lab \\
  --query "[].{Name:name,CIDR:addressPrefix}" -o table
# Expected output:
# GatewaySubnet  10.100.255.0/26
# AppSubnet      10.100.1.0/24
\`\`\``
      },
      {
        title: 'Create a Local Network Gateway',
        instruction: 'Create a Local Network Gateway representing the on-premises network (public IP: 203.0.113.1, network: 192.168.0.0/24).',
        hints: ['\`az network local-gateway create\` with \`--gateway-ip-address\` and \`--local-address-prefixes\`'],
        solution: `\`\`\`bash
az network local-gateway create \\
  --name onprem-lgw \\
  --resource-group rg-vpn-lab \\
  --gateway-ip-address 203.0.113.1 \\
  --local-address-prefixes 192.168.0.0/24 \\
  --location eastus
\`\`\``,
        verify: `\`\`\`bash
az network local-gateway show --name onprem-lgw --resource-group rg-vpn-lab \\
  --query "{IP:gatewayIpAddress,Network:localNetworkAddressSpace.addressPrefixes}" -o json
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-vpn-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-vpn-lab 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'S2S VPN connection is Connected but traffic does not flow',
      difficulty: 'hard',
      symptom: 'The VPN Connection status in Azure shows "Connected", but Azure VMs cannot ping on-premises machines.',
      diagnosis: `\`\`\`bash
# Check status and bytes transferred
az network vpn-connection show \\
  --name S2S-Connection --resource-group myRG \\
  --query "{Status:connectionStatus,BytesIn:ingressBytesTransferred,BytesOut:egressBytesTransferred}" -o table

# Check effective routes on the VM NIC
az network nic show-effective-route-table --name myNIC --resource-group myRG -o table

# Check whether the Local Network Gateway has the correct on-prem CIDR
az network local-gateway show --name onprem-lgw --resource-group myRG \\
  --query "localNetworkAddressSpace.addressPrefixes" -o tsv
\`\`\``,
      solution: `**Causes with zero bytes (no traffic):**

1. **Incorrect on-premises CIDR in the Local Network Gateway**: if the on-prem IP range is wrong, Azure does not know how to route there. Check and fix.

2. **NSG blocking**: NSGs on the destination subnet may be blocking traffic coming from the on-premises range.

3. **Route not propagated**: check effective routes — there must be a route for the on-prem range pointing to the VPN Gateway.

4. **On-premises firewall blocking**: the issue may be on the on-prem side — check firewall rules and routes on the VPN device.

5. **MTU issues**: VPN tunneling adds overhead. If the application MTU is 1500, packets may be fragmented or dropped. Reduce MTU to 1350–1400.`
    }
  ]
};
