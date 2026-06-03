window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-networking/azure-dns'] = {
  theory: `# Azure DNS & Private DNS Zones

## Exam Relevance
> Estimated weight **5-8%** on AZ-104. Questions about domain delegation, Private DNS Zones for internal resources and integration with Private Endpoints.

## Core Concepts

### Azure DNS (Public)
Hosting service for public DNS zones:
- Hosts DNS records for public domains (e.g. contoso.com)
- High availability with 100% SLA (distributed across global Anycast servers)
- Supports: A, AAAA, CNAME, MX, NS, PTR, SOA, SRV, TXT, CAA, alias records
- **Does not sell domains** — you register them at an external registrar and delegate the zone to Azure DNS

**Domain Delegation:**
\`\`\`
1. Register domain at a registrar (e.g. GoDaddy)
2. Create a DNS zone in Azure for "contoso.com"
3. Azure provides 4 Name Servers (ns1-ns4.azure-dns.com/net/org/info)
4. Configure those NS records at the registrar
→ Azure DNS now resolves all queries for contoso.com
\`\`\`

### Private DNS Zones
Internal DNS for resources in Azure VNets:
- Resolves private names within the VNet (e.g. \`app-server.internal.contoso.com\`)
- **Not visible outside the VNet** — does not expose internal names
- **Virtual Network Link**: associates the Private DNS Zone with the VNet
- **Auto-registration**: automatically registers VMs created in the VNet

**Main use cases:**
1. Name resolution for Private Endpoints (Storage, SQL, Key Vault)
2. Internal DNS for services in VNets
3. Multi-region DNS with consistent resolution

### Private DNS for Private Endpoints
When you create a Private Endpoint, the resource needs to resolve to the private IP:
\`\`\`
Without Private DNS Zone:
nslookup mysa.blob.core.windows.net → 52.x.x.x (public IP)

With Private DNS Zone (privatelink.blob.core.windows.net):
nslookup mysa.blob.core.windows.net → 10.0.1.5 (private IP of the PE)
\`\`\`

**Private Link zones by service:**
| Service | Private DNS Zone |
|---------|-----------------|
| Blob Storage | \`privatelink.blob.core.windows.net\` |
| Azure SQL | \`privatelink.database.windows.net\` |
| Key Vault | \`privatelink.vaultcore.azure.net\` |
| Azure Files | \`privatelink.file.core.windows.net\` |

### Azure DNS Private Resolver
Forwards DNS queries between on-premises and Azure Private DNS:
- **Inbound Endpoint**: receives DNS queries from on-premises
- **Outbound Endpoint**: forwards queries to on-premises or external DNS
- Allows on-premises machines to resolve Azure Private DNS Zone names

## Essential Commands (Azure CLI)

\`\`\`bash
# Create a public DNS zone
az network dns zone create \\
  --name contoso.com \\
  --resource-group myRG

# Create an A record
az network dns record-set a add-record \\
  --zone-name contoso.com \\
  --resource-group myRG \\
  --record-set-name www \\
  --ipv4-address 1.2.3.4

# Create a CNAME record
az network dns record-set cname set-record \\
  --zone-name contoso.com \\
  --resource-group myRG \\
  --record-set-name mail \\
  --cname mailserver.contoso.com

# List the zone Name Servers (for delegation)
az network dns zone show \\
  --name contoso.com \\
  --resource-group myRG \\
  --query nameServers -o tsv

# Create a Private DNS Zone
az network private-dns zone create \\
  --name privatelink.blob.core.windows.net \\
  --resource-group myRG

# Link the Private DNS Zone to a VNet
az network private-dns link vnet create \\
  --zone-name privatelink.blob.core.windows.net \\
  --resource-group myRG \\
  --name myVNetLink \\
  --virtual-network myVNet \\
  --registration-enabled false

# Create an A record in the Private DNS Zone
az network private-dns record-set a add-record \\
  --zone-name internal.contoso.com \\
  --resource-group myRG \\
  --record-set-name app-server \\
  --ipv4-address 10.0.1.10

# List all records in a zone
az network dns record-set list \\
  --zone-name contoso.com \\
  --resource-group myRG \\
  --query "[].{Name:name,Type:type,TTL:ttl}" -o table
\`\`\`

## Common Mistakes

1. **Private DNS Zone does not resolve inside the VNet**: check whether the Virtual Network Link exists and is "Completed".
2. **Auto-registration and VMs not appearing**: auto-registration only creates records for VMs created **after** the link was established, not retroactively.
3. **Private DNS Zone conflict**: creating \`privatelink.blob.core.windows.net\` as a public zone (instead of private) breaks resolution.
4. **High TTL making migration harder**: when changing IPs, a high TTL means clients keep resolving the old IP for hours.

## Killer.sh Style Challenge

> A company is creating a Storage Account with a Private Endpoint. VMs inside the VNet must resolve \`mysa.blob.core.windows.net\` to the private IP 10.0.1.5. Configure the required DNS.
>
> **Answer**: 1) Create Private DNS Zone \`privatelink.blob.core.windows.net\`. 2) Create a Virtual Network Link to the VNet. 3) When creating the Private Endpoint for the Storage Account, Azure automatically creates the DNS A record: \`mysa\` → 10.0.1.5 in the zone. Result: any VM in the VNet resolves \`mysa.blob.core.windows.net\` → 10.0.1.5.
`,

  quiz: [
    {
      question: 'You created a Private Endpoint for a Storage Account, but VMs in the VNet still resolve the name to the public IP. What is missing?',
      options: [
        'An NSG rule allowing HTTPS traffic from the VNet to the Storage Account',
        'A Private DNS Zone with a Virtual Network Link to the VNet',
        'A Service Endpoint on the VNet subnet',
        'A CNAME record in the public DNS zone'
      ],
      correct: 1,
      explanation: 'Private Endpoints need a Private DNS Zone to work correctly. Without it, the public DNS still resolves the name to the service public IP, sending traffic over the Internet instead of the Private Endpoint private IP. The Private DNS Zone (e.g. privatelink.blob.core.windows.net) with a Virtual Network Link makes DNS resolve to the private IP inside the VNet.',
      reference: 'Private Endpoint without a Private DNS Zone = doesn\'t work for most applications. Always create both together.'
    },
    {
      question: 'What is the correct process to use Azure DNS to host the domain "contoso.com" registered at an external registrar?',
      options: [
        'Just create the DNS zone in Azure — it is automatically associated with the domain',
        'Create the DNS zone in Azure, copy the provided Name Servers, and configure them at the external registrar',
        'Transfer the domain registration to Azure',
        'Create a CNAME at the registrar pointing to azure-dns.com'
      ],
      correct: 1,
      explanation: 'To delegate DNS control to Azure: create a DNS Zone for "contoso.com" in Azure (which provides 4 NS Name Servers), then configure those NS records at the external registrar. The registrar then instructs global DNS that Azure is authoritative for contoso.com. Azure DNS does not sell domains — it only hosts zones.',
      reference: 'Azure DNS = zone hosting (record management). External registrar = domain owner. Delegation connects the two.'
    },
    {
      question: 'What is "Auto-registration" in a Private DNS Zone with a Virtual Network Link?',
      options: [
        'Automatically creates DNS records for all Private Endpoints in the VNet',
        'Automatically registers the FQDNs of VMs created in the linked VNet',
        'Automatically updates TTLs of expired records',
        'Syncs DNS records from on-premises to Azure'
      ],
      correct: 1,
      explanation: 'Auto-registration automatically creates A records in the Private DNS Zone for VMs created in the linked VNet — using the computer name as the hostname. When the VM is deleted, the record is removed. Available only for VM resources, not for other services. Only one Private DNS Zone per VNet can have auto-registration enabled.',
      reference: 'Auto-registration = automatic DNS for VMs. Only one zone per VNet can have auto-reg enabled.'
    }
  ],

  flashcards: [
    {
      front: 'Which Private DNS Zone to use for each Azure service with Private Endpoint?',
      back: '| Service | Zone |\n|---------|------|\n| Blob Storage | \`privatelink.blob.core.windows.net\` |\n| Azure Files | \`privatelink.file.core.windows.net\` |\n| Azure SQL | \`privatelink.database.windows.net\` |\n| Key Vault | \`privatelink.vaultcore.azure.net\` |\n| Container Registry | \`privatelink.azurecr.io\` |\n| App Service | \`privatelink.azurewebsites.net\` |\n\nAlways create a Virtual Network Link after creating the zone.'
    },
    {
      front: 'What is Azure DNS Private Resolver and when to use it?',
      back: '**Azure DNS Private Resolver** — solves the hybrid DNS problem:\n\n**Problem**: on-premises machines cannot resolve Azure Private DNS Zone names (e.g. \`mysa.privatelink.blob.core.windows.net\` → 10.0.x.x).\n\n**Solution**: \n- **Inbound Endpoint**: a private IP in the VNet that receives DNS queries from on-premises\n- **Outbound Endpoint**: forwards queries to on-premises DNS (for local names)\n\nConfigure the on-premises DNS forwarder to forward \`*.azure.net\`, \`*.windows.net\` queries to the Inbound Endpoint.'
    },
    {
      front: 'What are the steps to host a public domain in Azure DNS?',
      back: '1. **Create a DNS Zone** in Azure for the domain (\`az network dns zone create --name contoso.com\`)\n2. **Copy Name Servers** provided by Azure (4 NS1-NS4 entries)\n3. **Configure NS** at the external registrar (GoDaddy, Cloudflare, etc.)\n4. **Wait for propagation** (minutes to 48h depending on previous TTL)\n5. **Create records** — A, CNAME, MX etc. in the Azure portal or CLI\n\nDelegation means: the registrar tells the world "for contoso.com, ask Azure".'
    }
  ],

  lab: {
    scenario: 'Configure Azure DNS to host a public zone and a Private DNS Zone with a Virtual Network Link.',
    objective: 'Create a public DNS Zone with records, create a Private DNS Zone and link it to a VNet.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Create a public DNS Zone and records',
        instruction: 'Create a DNS Zone for a test domain and add A and CNAME records.',
        hints: ['Use a fictional domain like lab.contoso.internal for testing'],
        solution: `\`\`\`bash
az group create --name rg-dns-lab --location eastus

# Create a DNS Zone (fictional domain for the lab)
az network dns zone create \\
  --name lab-contoso.com \\
  --resource-group rg-dns-lab

# A records
az network dns record-set a add-record \\
  --zone-name lab-contoso.com \\
  --resource-group rg-dns-lab \\
  --record-set-name www \\
  --ipv4-address 10.0.1.10

az network dns record-set a add-record \\
  --zone-name lab-contoso.com \\
  --resource-group rg-dns-lab \\
  --record-set-name api \\
  --ipv4-address 10.0.1.20

# CNAME
az network dns record-set cname set-record \\
  --zone-name lab-contoso.com \\
  --resource-group rg-dns-lab \\
  --record-set-name portal \\
  --cname www.lab-contoso.com

# View Name Servers (for delegation at a real registrar)
az network dns zone show --name lab-contoso.com --resource-group rg-dns-lab \\
  --query "nameServers" -o tsv
\`\`\``,
        verify: `\`\`\`bash
az network dns record-set list \\
  --zone-name lab-contoso.com \\
  --resource-group rg-dns-lab \\
  --query "[?type!='Microsoft.Network/dnszones/NS' && type!='Microsoft.Network/dnszones/SOA'].{Name:name,Type:type}" -o table
# Expected output: www (A), api (A), portal (CNAME)
\`\`\``
      },
      {
        title: 'Create a Private DNS Zone with a Virtual Network Link',
        instruction: 'Create a VNet and a Private DNS Zone for blob storage Private Link, and link it to the VNet.',
        hints: ['\`az network private-dns zone create\` and then \`az network private-dns link vnet create\`'],
        solution: `\`\`\`bash
# VNet for the lab
az network vnet create \\
  --name dns-vnet --resource-group rg-dns-lab \\
  --address-prefixes 10.0.0.0/16 \\
  --subnet-name app-subnet --subnet-prefixes 10.0.1.0/24

# Private DNS Zone for Storage Private Link
az network private-dns zone create \\
  --name "privatelink.blob.core.windows.net" \\
  --resource-group rg-dns-lab

# Link to the VNet (no auto-registration for Private Link zones)
az network private-dns link vnet create \\
  --zone-name "privatelink.blob.core.windows.net" \\
  --resource-group rg-dns-lab \\
  --name dns-vnet-link \\
  --virtual-network dns-vnet \\
  --registration-enabled false

# Simulate a Private Endpoint record (normally created automatically)
az network private-dns record-set a add-record \\
  --zone-name "privatelink.blob.core.windows.net" \\
  --resource-group rg-dns-lab \\
  --record-set-name "mysa" \\
  --ipv4-address 10.0.1.5
\`\`\``,
        verify: `\`\`\`bash
# Verify the VNet link status is Completed
az network private-dns link vnet show \\
  --zone-name "privatelink.blob.core.windows.net" \\
  --resource-group rg-dns-lab \\
  --name dns-vnet-link \\
  --query "{Status:provisioningState,VNet:virtualNetwork.id}" -o table
# Expected output: Status = Succeeded

# Verify the DNS record was created
az network private-dns record-set a list \\
  --zone-name "privatelink.blob.core.windows.net" \\
  --resource-group rg-dns-lab \\
  --query "[].{Name:name,IP:aRecords[0].ipv4Address}" -o table
# Output: mysa | 10.0.1.5
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-dns-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-dns-lab 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Private Endpoint created but the name still resolves to the public IP',
      difficulty: 'medium',
      symptom: 'After creating a Private Endpoint for a Storage Account and a Private DNS Zone, \`nslookup mysa.blob.core.windows.net\` inside the VNet still returns the public IP.',
      diagnosis: `\`\`\`bash
# Check whether the Private DNS Zone exists
az network private-dns zone list --resource-group myRG \\
  --query "[?name=='privatelink.blob.core.windows.net'].name" -o tsv

# Check whether the Virtual Network Link exists and is associated with the correct VNet
az network private-dns link vnet list \\
  --zone-name "privatelink.blob.core.windows.net" \\
  --resource-group myRG \\
  --query "[].{Name:name,VNet:virtualNetwork.id,Status:provisioningState}" -o table

# Check whether there is an A record in the zone
az network private-dns record-set a list \\
  --zone-name "privatelink.blob.core.windows.net" \\
  --resource-group myRG -o table
\`\`\``,
      solution: `**Causes in order of probability:**

1. **Virtual Network Link not created**: the Private DNS Zone exists but is not linked to the VNet where the VM resides. Create the link:
\`\`\`bash
az network private-dns link vnet create \\
  --zone-name "privatelink.blob.core.windows.net" \\
  --resource-group myRG \\
  --name myVNetLink \\
  --virtual-network myVNet \\
  --registration-enabled false
\`\`\`

2. **DNS record not created**: the Private Endpoint should have automatically created the A record in the zone. If created manually, the name may be wrong. Check the record and recreate if needed.

3. **Wrong VNet in the link**: the VM may be in a different VNet from the one that has the link. Check the VM VNet and create an additional link.

4. **Custom DNS server on the VNet**: if the VNet uses a custom DNS server (not the default Azure DNS 168.63.129.16), that server needs to be configured to forward queries to Azure DNS.`
    }
  ]
};
