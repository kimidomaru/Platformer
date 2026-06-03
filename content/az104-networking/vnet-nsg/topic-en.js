window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-networking/vnet-nsg'] = {
  theory: `# Azure Virtual Networks & Network Security Groups

## Exam Relevance
> Estimated weight **15-20%** on AZ-104. Networking is one of the most complex domains — VNets, subnets, NSGs, peering and routing frequently appear in practical scenarios.

## Core Concepts

### Virtual Network (VNet)
An isolated private network in Azure where you place your resources:
- Defined by an **address space** (CIDR block), e.g. \`10.0.0.0/16\`
- Divided into **subnets** within the address space
- Resources in the same VNet communicate by default
- Traffic between different VNets is **blocked by default** (requires VNet Peering)

### Subnets
Divisions of the VNet for organization and traffic control:
- Each subnet gets a CIDR range from the VNet address space
- Azure **reserves 5 IPs** in each subnet: .0 (network), .1 (gateway), .2 (DNS), .3 (DNS), .255 (broadcast)
- A subnet can have only one associated NSG
- VM NICs reside in subnets

> **Exam note**: A /28 subnet has 16 total IPs - 5 reserved = **11 usable**.

### Network Security Group (NSG)
A stateful firewall that controls network traffic. Can be associated with:
- **Subnet** (affects all resources in the subnet)
- **VM NIC** (affects only that interface)

If an NSG is on the subnet AND another is on the NIC, traffic must pass through both (**AND logic**).

#### NSG Rules

Each rule has:
- **Priority**: 100–4096 (lower = higher priority)
- **Source/Destination**: IP, CIDR, Service Tag or Application Security Group
- **Protocol**: TCP, UDP, ICMP, Any
- **Port(s)**: number or range
- **Action**: Allow or Deny

**Default rules (not editable, priority 65000–65500):**
| Priority | Name | Direction | Allow/Deny |
|----------|------|-----------|-----------|
| 65000 | AllowVnetInBound | Inbound | Allow |
| 65001 | AllowAzureLoadBalancerInBound | Inbound | Allow |
| 65500 | DenyAllInBound | Inbound | Deny |
| 65000 | AllowVnetOutBound | Outbound | Allow |
| 65001 | AllowInternetOutBound | Outbound | Allow |
| 65500 | DenyAllOutBound | Outbound | Deny |

### Service Tags
Predefined groups of IP prefixes for Azure services, simplifying NSG rules:
- **Internet**: public IPs outside the VNet
- **VirtualNetwork**: the VNet address space (and peered VNets)
- **AzureLoadBalancer**: Azure Load Balancer IPs
- **Storage**: Azure Storage IPs
- **Sql**: Azure SQL IPs
- **AppService**: Azure App Service IPs

### Application Security Groups (ASG)
Groups VMs by logical function (without needing to know IPs) for use as source/destination in NSG rules:
\`\`\`
Without ASG: rule "Allow port 443 from 10.0.1.4, 10.0.1.5, 10.0.1.6"
With ASG:    rule "Allow port 443 from ASG-WebServers"
\`\`\`

### VNet Peering
Connects two VNets (same or different regions) for direct communication:
- **VNet Peering (same region)**: low latency, high performance
- **Global VNet Peering**: between different regions
- Peering **is not transitive**: if A↔B and B↔C, A and C cannot communicate (A↔C must be created separately)
- Configured in both directions (A→B and B→A)

### User-Defined Routes (UDR) and Route Tables
By default, Azure routes traffic automatically. To customize:
- **Route Tables** define custom routes
- Associated with subnets
- Can force traffic through an NVA (Network Virtual Appliance), VPN Gateway or the Internet

## Essential Commands (Azure CLI)

\`\`\`bash
# Create a VNet with an address space
az network vnet create \\
  --name myVNet \\
  --resource-group myRG \\
  --location eastus \\
  --address-prefixes 10.0.0.0/16

# Create a subnet
az network vnet subnet create \\
  --name WebSubnet \\
  --vnet-name myVNet \\
  --resource-group myRG \\
  --address-prefixes 10.0.1.0/24

# Create an NSG
az network nsg create \\
  --name WebNSG \\
  --resource-group myRG \\
  --location eastus

# Create an NSG rule — allow HTTP inbound
az network nsg rule create \\
  --nsg-name WebNSG \\
  --resource-group myRG \\
  --name AllowHTTP \\
  --priority 100 \\
  --direction Inbound \\
  --access Allow \\
  --protocol Tcp \\
  --source-address-prefixes Internet \\
  --source-port-ranges '*' \\
  --destination-address-prefixes '*' \\
  --destination-port-ranges 80 443

# Associate the NSG with the subnet
az network vnet subnet update \\
  --name WebSubnet \\
  --vnet-name myVNet \\
  --resource-group myRG \\
  --network-security-group WebNSG

# Create VNet Peering (both directions)
az network vnet peering create \\
  --name VNet1-to-VNet2 \\
  --vnet-name VNet1 \\
  --resource-group myRG \\
  --remote-vnet VNet2 \\
  --allow-vnet-access

az network vnet peering create \\
  --name VNet2-to-VNet1 \\
  --vnet-name VNet2 \\
  --resource-group myRG \\
  --remote-vnet VNet1 \\
  --allow-vnet-access

# Check effective routes on a NIC
az network nic show-effective-route-table \\
  --name myNIC \\
  --resource-group myRG \\
  --output table

# Check effective NSG rules on a NIC
az network nic list-effective-nsg \\
  --name myNIC \\
  --resource-group myRG

# Create an Application Security Group
az network asg create \\
  --name ASG-WebServers \\
  --resource-group myRG

# Use an ASG in an NSG rule
az network nsg rule create \\
  --nsg-name AppNSG \\
  --resource-group myRG \\
  --name AllowFromWeb \\
  --priority 200 \\
  --direction Inbound \\
  --access Allow \\
  --source-asgs ASG-WebServers \\
  --destination-port-ranges 8080
\`\`\`

## Common Mistakes

1. **Asymmetric peering**: configuring only one side of the peering — both sides must be created.
2. **Conflicting NSGs on subnet AND NIC**: both are evaluated — traffic must pass through both.
3. **Confusing NSG direction**: Inbound = entering the VM; Outbound = leaving the VM.
4. **Overlapping address spaces in Peering**: VNets cannot have overlapping address spaces for peering.
5. **Reserved IPs**: forgetting that Azure reserves 5 IPs per subnet when planning capacity.

## Killer.sh Style Challenge

> **Scenario**:
> - VNet \`app-vnet\` (10.0.0.0/16) with subnets: \`web-subnet\` (10.0.1.0/24) and \`db-subnet\` (10.0.2.0/24)
> - Web VMs in web-subnet must accept HTTP/HTTPS from the Internet
> - DB VMs in db-subnet must accept SQL (1433) only from web VMs
> - No other inbound traffic should be allowed on DB VMs
> - DB VMs should not have Internet access
>
> **Design the NSG rules needed for web-subnet and db-subnet.**
>
> **Answer**:
> - NSG web-subnet: Allow 80/443 from Internet inbound; Allow all outbound (default)
> - NSG db-subnet: Allow 1433 from 10.0.1.0/24 (or ASG-WebServers) inbound; Deny all outbound to Internet (add Deny Internet outbound rule with priority < 65001)
`,

  quiz: [
    {
      question: 'A /28 subnet in Azure has how many usable IP addresses (available for resources)?',
      options: [
        '16',
        '14',
        '11',
        '13'
      ],
      correct: 2,
      explanation: 'A /28 subnet has 16 total IP addresses. Azure reserves 5: .0 (network address), .1 (default gateway), .2 (DNS mapping), .3 (DNS mapping), .255 (broadcast). 16 - 5 = 11 usable addresses.',
      reference: 'Memorize: Azure always reserves 5 IPs per subnet. Calculate: 2^(32-prefix) - 5 = usable IPs.'
    },
    {
      question: 'A VM has an NSG associated with its NIC that allows traffic on port 80. The subnet where the VM resides has another NSG that denies all inbound traffic. Can the VM receive traffic on port 80?',
      options: [
        'Yes — the NIC NSG takes precedence over the subnet NSG',
        'No — traffic must pass through both NSGs; the subnet Deny blocks it',
        'Yes — AllowVnetInBound on the subnet allows all internal traffic',
        'It depends on the rule priorities in each NSG'
      ],
      correct: 1,
      explanation: 'When there is an NSG on the subnet AND on the NIC, inbound traffic passes through the subnet NSG first, then the NIC NSG. The Deny on the subnet NSG blocks before it reaches the NIC. For outbound traffic, the order is reversed: NIC → Subnet. Both NSGs must allow.',
      reference: 'Inbound: subnet NSG → NIC NSG. Outbound: NIC NSG → subnet NSG. Both must allow.'
    },
    {
      question: 'You configured VNet Peering between VNet-A (10.0.0.0/16) and VNet-B (10.1.0.0/16). VNet-B also has peering with VNet-C (10.2.0.0/16). Can a VM in VNet-A communicate with a VM in VNet-C?',
      options: [
        'Yes — VNet Peering is transitive by default',
        'No — VNet Peering is not transitive; VNet-A and VNet-C need a direct peering',
        'Yes, but only if VNet-B has "Use Remote Gateways" enabled',
        'It is not possible to have 3 VNets in peering'
      ],
      correct: 1,
      explanation: 'VNet Peering is NOT transitive. Even if A↔B and B↔C exist, A cannot reach C through B. To connect A and C, you must create a direct A↔C peering. Alternative: use Hub-and-Spoke with Azure Virtual WAN or Azure Firewall as a transit hub.',
      reference: 'VNet Peering is not transitive — a classic exam gotcha. Use Hub-Spoke or Azure vWAN for transit.'
    },
    {
      question: 'What are Service Tags in NSG rules?',
      options: [
        'Custom tags used to identify NSGs in the portal',
        'Predefined groups of IP prefixes that represent Azure services, simplifying firewall rules',
        'SSL certificates for Azure services',
        'Service identifiers in load balancers'
      ],
      correct: 1,
      explanation: 'Service Tags are Microsoft-managed groups of IP prefixes for specific Azure services (Storage, Sql, AppService, Internet, etc.). By using "Storage" as a destination in an NSG rule, Azure automatically expands it to all Storage service IPs in the region, without manually listing IPs. Microsoft updates these lists automatically.',
      reference: 'Use Service Tags instead of manual IPs — Microsoft keeps the list up to date. Examples: Storage, Sql, AzureActiveDirectory, Internet.'
    },
    {
      question: 'What is the priority of the default "DenyAllInBound" and "DenyAllOutBound" rules of an NSG?',
      options: [
        '100 (highest)',
        '4096 (lowest)',
        '65500',
        '1000'
      ],
      correct: 2,
      explanation: 'The default DenyAllInBound and DenyAllOutBound rules have priority 65500 (high number = low priority = evaluated last). This ensures your custom rules (with priority 100–4096) are evaluated before the default deny. If no custom rule allows the traffic, the default Deny blocks it.',
      reference: 'NSG rules: lower number = higher priority. Default rules (65000–65500) are always the last to be evaluated.'
    },
    {
      question: 'An organization needs to allow all VMs in the "WebServers" group to access VMs in the "DatabaseServers" group on port 1433, without maintaining IP lists. Which feature should they use?',
      options: [
        'VNet Peering',
        'Route Tables (UDR)',
        'Application Security Groups (ASG)',
        'Network Watcher'
      ],
      correct: 2,
      explanation: 'Application Security Groups let you group VMs by logical function and reference those groups in NSG rules. By associating a VM\'s NIC to the "WebServers" ASG and creating an NSG rule with source=ASG-WebServers and destination=ASG-DatabaseServers, traffic is controlled by function without managing IPs.',
      reference: 'ASGs = replace IPs in NSG rules. Associate NICs to ASGs, reference ASGs in the rules.'
    }
  ],

  flashcards: [
    {
      front: 'How many IPs does Azure reserve in each subnet? What are they?',
      back: 'Azure reserves **5 IPs** in each subnet:\n- **.0** — Network address\n- **.1** — Default gateway\n- **.2** — DNS (mapped to Azure DNS)\n- **.3** — DNS (reserved for future use)\n- **.255** — Broadcast\n\nExample: subnet 10.0.1.0/24 has 256 total IPs - 5 = **251 usable**.'
    },
    {
      front: 'What is the NSG evaluation order for Inbound and Outbound traffic?',
      back: '**Inbound** (entering the VM):\n1. **Subnet** NSG (evaluated first)\n2. **NIC** NSG (evaluated second)\n\n**Outbound** (leaving the VM):\n1. **NIC** NSG (evaluated first)\n2. **Subnet** NSG (evaluated second)\n\nBoth NSGs must allow the traffic. A Deny on either one blocks it.'
    },
    {
      front: 'Is VNet Peering transitive? What does that mean in practice?',
      back: '**No**, VNet Peering is NOT transitive.\n\nIf VNet-A ↔ VNet-B and VNet-B ↔ VNet-C, a VM in A **cannot** reach a VM in C via B.\n\nTo connect A and C: create a direct A ↔ C peering.\n\nAlternative for hub-spoke topology: use Azure Firewall or Azure Virtual WAN at the hub for transitive traffic.'
    },
    {
      front: 'What are the default NSG rules (that cannot be deleted)?',
      back: '**Default Inbound** (priority 65000–65500):\n- AllowVnetInBound (65000) — allows traffic within the VNet\n- AllowAzureLoadBalancerInBound (65001) — LB health probes\n- DenyAllInBound (65500) — blocks everything else\n\n**Default Outbound**:\n- AllowVnetOutBound (65000) — allows outbound to the VNet\n- AllowInternetOutBound (65001) — allows outbound to the Internet\n- DenyAllOutBound (65500) — blocks everything else'
    },
    {
      front: 'What are Application Security Groups (ASGs) and what problem do they solve?',
      back: '**ASG** is a logical grouping of VM NICs by function (WebServers, DatabaseServers, etc.).\n\n**Problem it solves**: NSG rules based on IPs are hard to maintain as VMs are created/removed.\n\n**With ASG**: associate the NIC to the ASG, and reference the ASG in NSG rules. IPs managed automatically.\n\n``\`bash\n# Associate a NIC to an ASG\naz network nic ip-config update \\\n  --nic-name myNIC --name ipconfig1 \\\n  --resource-group myRG \\\n  --application-security-groups ASG-WebServers\n\```'
    }
  ],

  lab: {
    scenario: 'Configure the TechNova network infrastructure with a VNet, segmented subnets and NSGs to isolate the web tier from the data tier.',
    objective: 'Create a VNet, subnets, NSGs with appropriate rules and verify the isolation between tiers.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create the VNet and subnets',
        instruction: `Create a VNet \`app-vnet\` with address space \`10.0.0.0/16\` and two subnets: \`web-subnet\` (10.0.1.0/24) and \`db-subnet\` (10.0.2.0/24).`,
        hints: [
          'Create the RG first: \`az group create --name rg-network-lab\`',
          'The VNet and first subnet can be created in a single \`az network vnet create\`'
        ],
        solution: `\`\`\`bash
az group create --name rg-network-lab --location eastus

# Create the VNet with the first subnet
az network vnet create \\
  --name app-vnet \\
  --resource-group rg-network-lab \\
  --location eastus \\
  --address-prefixes 10.0.0.0/16 \\
  --subnet-name web-subnet \\
  --subnet-prefixes 10.0.1.0/24

# Add the second subnet
az network vnet subnet create \\
  --name db-subnet \\
  --vnet-name app-vnet \\
  --resource-group rg-network-lab \\
  --address-prefixes 10.0.2.0/24
\`\`\``,
        verify: `\`\`\`bash
az network vnet subnet list \\
  --vnet-name app-vnet \\
  --resource-group rg-network-lab \\
  --query "[].{Name:name,CIDR:addressPrefix}" -o table
# Expected output:
# Name        CIDR
# ----------  ------------
# web-subnet  10.0.1.0/24
# db-subnet   10.0.2.0/24
\`\`\``
      },
      {
        title: 'Create the NSG for web-subnet with HTTP/HTTPS rules',
        instruction: `Create an NSG \`web-nsg\` that allows HTTP (80) and HTTPS (443) traffic from the Internet and associate it with web-subnet.`,
        hints: [
          '"Internet" is a Service Tag — use it as the value for \`--source-address-prefixes\`',
          'Associate the NSG with the subnet: \`az network vnet subnet update --network-security-group\`'
        ],
        solution: `\`\`\`bash
# Create the NSG for the web tier
az network nsg create \\
  --name web-nsg \\
  --resource-group rg-network-lab

# Allow HTTP inbound from the Internet
az network nsg rule create \\
  --nsg-name web-nsg \\
  --resource-group rg-network-lab \\
  --name AllowHTTP \\
  --priority 100 \\
  --direction Inbound \\
  --access Allow \\
  --protocol Tcp \\
  --source-address-prefixes Internet \\
  --source-port-ranges '*' \\
  --destination-address-prefixes '*' \\
  --destination-port-ranges 80 443

# Associate the NSG with web-subnet
az network vnet subnet update \\
  --name web-subnet \\
  --vnet-name app-vnet \\
  --resource-group rg-network-lab \\
  --network-security-group web-nsg
\`\`\``,
        verify: `\`\`\`bash
# Verify the NSG is associated with the subnet
az network vnet subnet show \\
  --name web-subnet \\
  --vnet-name app-vnet \\
  --resource-group rg-network-lab \\
  --query "networkSecurityGroup.id" -o tsv | grep -c "web-nsg" && echo "NSG correctly associated"
\`\`\``
      },
      {
        title: 'Create the NSG for db-subnet with restricted access',
        instruction: `Create an NSG \`db-nsg\` that:
1. Allows SQL traffic (port 1433) only from web-subnet (10.0.1.0/24)
2. Denies all Internet access (outbound)

Associate it with db-subnet.`,
        hints: [
          'The Deny Internet Outbound priority must be lower than 65001 (the priority of default rules)',
          'Use the web-subnet CIDR as the source address prefix'
        ],
        solution: `\`\`\`bash
# Create the NSG for the DB tier
az network nsg create \\
  --name db-nsg \\
  --resource-group rg-network-lab

# Allow SQL only from web-subnet
az network nsg rule create \\
  --nsg-name db-nsg \\
  --resource-group rg-network-lab \\
  --name AllowSQLFromWeb \\
  --priority 100 \\
  --direction Inbound \\
  --access Allow \\
  --protocol Tcp \\
  --source-address-prefixes 10.0.1.0/24 \\
  --source-port-ranges '*' \\
  --destination-address-prefixes '*' \\
  --destination-port-ranges 1433

# Block Internet access (outbound)
az network nsg rule create \\
  --nsg-name db-nsg \\
  --resource-group rg-network-lab \\
  --name DenyInternetOutbound \\
  --priority 200 \\
  --direction Outbound \\
  --access Deny \\
  --protocol '*' \\
  --source-address-prefixes '*' \\
  --source-port-ranges '*' \\
  --destination-address-prefixes Internet \\
  --destination-port-ranges '*'

# Associate the NSG with db-subnet
az network vnet subnet update \\
  --name db-subnet \\
  --vnet-name app-vnet \\
  --resource-group rg-network-lab \\
  --network-security-group db-nsg
\`\`\``,
        verify: `\`\`\`bash
# Verify db-nsg rules
az network nsg rule list \\
  --nsg-name db-nsg \\
  --resource-group rg-network-lab \\
  --query "[?!startsWith(name,'Default')].{Name:name,Dir:direction,Action:access,Port:destinationPortRange}" \\
  -o table
# Expected output:
# Name                   Dir       Action  Port
# ---------------------  --------  ------  ----
# AllowSQLFromWeb        Inbound   Allow   1433
# DenyInternetOutbound   Outbound  Deny    *
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group and all created resources.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-network-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-network-lab --query "properties.provisioningState" -o tsv 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'VM not receiving HTTP traffic despite an NSG Allow rule',
      difficulty: 'medium',
      symptom: 'A VM in Azure has an NSG with an Allow HTTP (port 80) inbound rule, but requests from the Internet do not reach the application.',
      diagnosis: `\`\`\`bash
# Check effective NSG rules on the VM NIC
az network nic list-effective-nsg \\
  --name <nic-name> \\
  --resource-group <rg> \\
  --query "effectiveNetworkSecurityGroups[].{NSG:networkSecurityGroup.id,Rules:effectiveSecurityRules[?access=='Deny']}" -o json

# Check whether there is an NSG on both the subnet AND the NIC (both are evaluated)
az network vnet subnet show \\
  --name <subnet> --vnet-name <vnet> --resource-group <rg> \\
  --query "networkSecurityGroup.id" -o tsv

az network nic show --name <nic-name> --resource-group <rg> \\
  --query "networkSecurityGroup.id" -o tsv

# Check whether the VM has a public IP
az vm list-ip-addresses --name <vm-name> --resource-group <rg> -o table
\`\`\``,
      solution: `**Possible causes in order of investigation:**

1. **Subnet NSG blocking**: even if the NIC NSG allows it, the subnet NSG may be denying it. Check both.

2. **VM has no public IP**: for Internet access, the VM needs a public IP or to be behind a Load Balancer.

3. **Application not listening on the port**: check whether the web process is running on the VM.

4. **OS firewall**: Windows Firewall or iptables inside the VM may be blocking. The NSG is external to the VM — the OS has its own firewall.

5. **Rule priority**: check whether there is a Deny rule with higher priority (lower number) than the Allow rule.`
    },
    {
      title: 'VNet Peering configured but VMs cannot communicate',
      difficulty: 'hard',
      symptom: 'Two VNet Peerings were created between VNet-A and VNet-B, but VMs in the two VNets cannot connect via ping or port 22.',
      diagnosis: `\`\`\`bash
# Check peering status in both VNets
az network vnet peering list --vnet-name VNet-A --resource-group <rg> \\
  --query "[].{Name:name,State:peeringState,AllowAccess:allowVirtualNetworkAccess}" -o table

az network vnet peering list --vnet-name VNet-B --resource-group <rg> \\
  --query "[].{Name:name,State:peeringState,AllowAccess:allowVirtualNetworkAccess}" -o table

# Check whether address spaces overlap
az network vnet show --name VNet-A --resource-group <rg> --query "addressSpace.addressPrefixes" -o tsv
az network vnet show --name VNet-B --resource-group <rg> --query "addressSpace.addressPrefixes" -o tsv

# Check effective routes on the VM NIC
az network nic show-effective-route-table --name <nic-name> --resource-group <rg> -o table
\`\`\``,
      solution: `**Possible causes:**

1. **Peering state is not "Connected"**: check \`peeringState\`. Both sides must be "Connected". If one side was deleted/not created, the other shows "Disconnected".

2. **AllowVirtualNetworkAccess is False**: the \`--allow-vnet-access\` parameter was not passed. Recreate the peering with the flag.

3. **NSG blocking traffic**: even with an active peering, subnet NSGs must allow the traffic (not just the default AllowVnetInBound, if there are custom Deny rules).

4. **Overlapping address spaces**: VNets with CIDR overlap cannot peer. Example: 10.0.0.0/16 and 10.0.1.0/24 (the second is inside the first) — peering is impossible.

5. **Recently created peering**: wait a few minutes for full propagation.`
    }
  ]
};
