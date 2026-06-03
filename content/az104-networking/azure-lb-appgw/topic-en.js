window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-networking/azure-lb-appgw'] = {
  theory: `# Azure Load Balancer & Application Gateway

## Exam Relevance
> Estimated weight **10-15%** on AZ-104. Questions involve choosing the right load balancer and configuring health probes and rules.

## Core Concepts

### Azure Load Balancer (ALB)
**Layer 4** (TCP/UDP) load balancer:
- Operates at the transport level — does not inspect HTTP content
- Distributes traffic to VMs in a **Backend Pool**
- **Health Probe**: checks whether backends are healthy
- **Load Balancing Rule**: defines incoming port → backend port
- **NAT Rules**: forwards a specific port to a specific VM (for SSH/RDP)

| SKU | Scope | HA Zones | SLA |
|-----|-------|----------|-----|
| **Basic** | No zones, VMs in the same AvSet/VMSS | ❌ | — |
| **Standard** | Zone-redundant, any VM in the VNet | ✅ | 99.99% |

> **For the exam**: Standard is recommended for production. Basic will be retired.

**Types:**
- **Public LB**: public IP in front, distributes to private VMs
- **Internal LB**: private IP in the VNet, for internal traffic (e.g. web tier → app tier)

### Application Gateway (AppGW)
**Layer 7** (HTTP/HTTPS) load balancer:
- Inspects HTTP request content
- **URL-based routing**: routes \`/images/*\` to pool A, \`/api/*\` to pool B
- **SSL termination**: decrypts HTTPS at the gateway
- **Web Application Firewall (WAF)**: protects against OWASP Top 10
- **Cookie-based affinity** (sticky sessions)
- **HTTP header rewrite**

| SKU | Features |
|-----|---------|
| **Standard_v2** | Routing, SSL termination, autoscaling |
| **WAF_v2** | Standard_v2 + Web Application Firewall |

### Which one to use?

| Criterion | Load Balancer | Application Gateway |
|-----------|--------------|---------------------|
| Protocol | TCP/UDP (L4) | HTTP/HTTPS (L7) |
| URL routing | ❌ | ✅ |
| SSL termination | ❌ | ✅ |
| WAF | ❌ | ✅ (WAF SKU) |
| Performance | High | Lower than LB |
| Cost | Lower | Higher |

### Azure Traffic Manager
**DNS-based** load balancing between **regions** (not individual resources):
- Does not process traffic directly — only resolves DNS
- Methods: Priority, Weighted, Performance, Geographic, Subnet, MultiValue

### Azure Front Door
CDN + global web application load balancing + WAF:
- Global edge locations, low latency
- URL rewrite, caching, global WAF

## Essential Commands (Azure CLI)

\`\`\`bash
# Create a Standard Load Balancer with a public IP
az network public-ip create --name lb-pip --resource-group myRG --sku Standard --zone 1 2 3
az network lb create \\
  --name myLB \\
  --resource-group myRG \\
  --sku Standard \\
  --frontend-ip-name FrontEnd \\
  --public-ip-address lb-pip \\
  --backend-pool-name BackendPool

# Create a health probe (HTTP on port 80)
az network lb probe create \\
  --lb-name myLB \\
  --resource-group myRG \\
  --name HealthProbe \\
  --protocol Http \\
  --port 80 \\
  --path /health

# Create a load balancing rule
az network lb rule create \\
  --lb-name myLB \\
  --resource-group myRG \\
  --name HTTPRule \\
  --protocol Tcp \\
  --frontend-port 80 \\
  --backend-port 80 \\
  --frontend-ip-name FrontEnd \\
  --backend-pool-name BackendPool \\
  --probe-name HealthProbe

# Add a VM NIC to the Backend Pool
az network nic ip-config address-pool add \\
  --address-pool BackendPool \\
  --ip-config-name ipconfig1 \\
  --nic-name myNIC \\
  --resource-group myRG \\
  --lb-name myLB
\`\`\`

## Common Mistakes

1. **Empty Backend Pool**: the LB distributes to VMs that are in the pool — check whether NICs were added.
2. **Health Probe failing**: the application is not responding on the configured port/path — the VM is removed from the pool.
3. **Basic LB without zones**: does not support Availability Zones — use Standard for HA.
4. **AppGW vs LB confusion**: AppGW is for HTTP/HTTPS with intelligent routing; LB is for generic TCP/UDP.

## Killer.sh Style Challenge

> An application has 3 web VMs (HTTP/HTTPS) and 2 API VMs. Requests to \`/api/*\` should go to the API VMs and \`/*\` to the web VMs. There is a WAF requirement against OWASP. Which resource to use and how to configure the routing?
>
> **Answer**: Application Gateway WAF_v2 with two Backend Pools (web-pool, api-pool) and URL-based routing rules: rule 1 path=/api/* → api-pool; rule 2 (default) → web-pool. Enable WAF in Prevention mode with the OWASP 3.2 ruleset.
`,

  quiz: [
    {
      question: 'A company needs to load balance HTTP traffic with URL-based routing — \`/api/*\` to one group of VMs and \`/web/*\` to another. Which Azure resource should be used?',
      options: [
        'Azure Load Balancer Standard',
        'Application Gateway',
        'Azure Traffic Manager',
        'Azure Front Door'
      ],
      correct: 1,
      explanation: 'Application Gateway operates at Layer 7 (HTTP/HTTPS) and supports URL-based routing — routing traffic to different backend pools based on the URL path. Azure Load Balancer operates at Layer 4 (TCP/UDP) and cannot inspect URLs. Traffic Manager is DNS-based between regions.',
      reference: 'Layer 4 = Load Balancer (TCP/UDP, no content inspection). Layer 7 = Application Gateway (HTTP, inspects URL/headers).'
    },
    {
      question: 'Which Azure Load Balancer SKU is required to support Availability Zones and a 99.99% SLA?',
      options: [
        'Basic',
        'Standard',
        'Premium',
        'Global'
      ],
      correct: 1,
      explanation: 'Azure Load Balancer Standard supports Availability Zones (zone-redundant), has a 99.99% SLA, and can balance to any VM in the VNet. Load Balancer Basic does not support zones and only works with VMs in the same Availability Set or VMSS. Basic will be retired — Standard is the recommended option.',
      reference: 'Standard LB = production, zones, 99.99% SLA. Basic LB = legacy, no zones, will be discontinued.'
    },
    {
      question: 'What is a Health Probe in an Azure Load Balancer and what is its behavior when it fails?',
      options: [
        'It records performance metrics — no impact on traffic',
        'It checks whether backends are healthy; if it fails, the LB stops sending traffic to that backend',
        'It automatically restarts the process on the VM when a failure is detected',
        'It sends email alerts when a VM becomes unavailable'
      ],
      correct: 1,
      explanation: 'Health Probes regularly check whether backends (VMs) are responding on the configured port/path. If a backend does not respond after a configurable number of attempts, the LB marks it as "unhealthy" and stops sending traffic to it, distributing to the remaining healthy backends.',
      reference: 'Configure health probes on the actual application port, not just the LB port. A TCP probe on port 80 != application responding on port 80.'
    },
    {
      question: 'What is the difference between Azure Traffic Manager and Azure Application Gateway?',
      options: [
        'Traffic Manager is for internal traffic; Application Gateway is for external traffic',
        'Traffic Manager performs DNS-based load balancing between regions; Application Gateway processes HTTP/HTTPS traffic at Layer 7 in a single region',
        'There is no technical difference — they are the same service with different names',
        'Traffic Manager only works with VMs; Application Gateway only with App Services'
      ],
      correct: 1,
      explanation: 'Traffic Manager is DNS-based: it returns the IP of the most suitable endpoint based on a policy (performance, priority, geographic) — it does not process the HTTP traffic itself. Application Gateway is a reverse proxy that processes HTTP/HTTPS traffic, performing SSL termination, URL routing and WAF in a region.',
      reference: 'Traffic Manager = global DNS-based load balancing (multi-region). Application Gateway = L7 proxy in one region.'
    }
  ],

  flashcards: [
    {
      front: 'When to use Azure Load Balancer vs Application Gateway vs Traffic Manager?',
      back: '**Azure Load Balancer** (Layer 4 — TCP/UDP):\n- VMs in the same region\n- Non-HTTP protocols (TCP, UDP)\n- High performance, low cost\n\n**Application Gateway** (Layer 7 — HTTP/HTTPS):\n- URL-based routing\n- SSL termination, WAF, cookie affinity\n- HTTP/HTTPS traffic with intelligent routing\n\n**Traffic Manager** (DNS-based — global):\n- Multi-region\n- Does not process traffic, only resolves DNS\n- Routing: Priority, Weighted, Performance, Geographic'
    },
    {
      front: 'What are the components of an Azure Load Balancer configuration?',
      back: '1. **Frontend IP Configuration** — public or private IP where the LB receives traffic\n2. **Backend Pool** — group of VMs (NICs) that receive traffic\n3. **Health Probe** — checks backend health (TCP, HTTP, HTTPS)\n4. **Load Balancing Rule** — maps frontend port → backend port\n5. **NAT Rule** — forwards a specific port to a specific VM (SSH, RDP)'
    },
    {
      front: 'What does the WAF do in Application Gateway?',
      back: '**WAF (Web Application Firewall)** — available in the WAF_v2 SKU:\n\n- Protects against OWASP Top 10 attacks (SQL injection, XSS, CSRF, etc.)\n- Modes: **Detection** (detects and logs, does not block) and **Prevention** (detects and blocks)\n- Ruleset: OWASP 3.0/3.1/3.2 or Microsoft Default Ruleset\n- Custom rules can be added\n- Integration with Azure Monitor for WAF logs'
    }
  ],

  lab: {
    scenario: 'Configure an Internal Standard Load Balancer to distribute traffic between TechNova backend VMs.',
    objective: 'Create a VNet, VMs, NSG, Standard Load Balancer with health probe and load balancing rule.',
    duration: '30-35 minutes',
    steps: [
      {
        title: 'Create the base infrastructure',
        instruction: 'Create the RG and VNet for the Load Balancer lab.',
        hints: [],
        solution: `\`\`\`bash
az group create --name rg-lb-lab --location eastus
az network vnet create \\
  --name lb-vnet --resource-group rg-lb-lab \\
  --address-prefixes 10.0.0.0/16 \\
  --subnet-name backend-subnet \\
  --subnet-prefixes 10.0.1.0/24
\`\`\``,
        verify: `\`\`\`bash
az network vnet show --name lb-vnet --resource-group rg-lb-lab --query "subnets[0].addressPrefix" -o tsv
# Output: 10.0.1.0/24
\`\`\``
      },
      {
        title: 'Create an Internal Standard Load Balancer',
        instruction: 'Create an Internal Standard Load Balancer with static private IP 10.0.1.10, HTTP health probe on port 80 and a load balancing rule.',
        hints: ['An internal Load Balancer uses \`--private-ip-address\` instead of a public IP'],
        solution: `\`\`\`bash
# Create the Internal Load Balancer (no public IP)
az network lb create \\
  --name internal-lb \\
  --resource-group rg-lb-lab \\
  --sku Standard \\
  --frontend-ip-name FrontEnd \\
  --backend-pool-name BackendPool \\
  --vnet-name lb-vnet \\
  --subnet backend-subnet \\
  --private-ip-address 10.0.1.10

# HTTP Health Probe
az network lb probe create \\
  --lb-name internal-lb --resource-group rg-lb-lab \\
  --name HTTPProbe \\
  --protocol Http --port 80 --path /

# Load Balancing Rule
az network lb rule create \\
  --lb-name internal-lb --resource-group rg-lb-lab \\
  --name HTTPRule \\
  --protocol Tcp \\
  --frontend-port 80 --backend-port 80 \\
  --frontend-ip-name FrontEnd \\
  --backend-pool-name BackendPool \\
  --probe-name HTTPProbe
\`\`\``,
        verify: `\`\`\`bash
az network lb show --name internal-lb --resource-group rg-lb-lab \\
  --query "{FrontendIP:frontendIPConfigurations[0].privateIPAddress,Probe:length(probes),Rules:length(loadBalancingRules)}" -o table
# Expected output: FrontendIP=10.0.1.10, Probe=1, Rules=1
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-lb-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-lb-lab 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Backend VMs not receiving traffic from the Load Balancer',
      difficulty: 'medium',
      symptom: 'The Load Balancer is configured, but traffic sent to the LB IP does not reach the backend pool VMs.',
      diagnosis: `\`\`\`bash
# Check whether there are VMs in the backend pool
az network lb address-pool show \\
  --lb-name myLB --name BackendPool --resource-group myRG \\
  --query "backendIPConfigurations[].id" -o tsv

# Check health probe status (if failing, VMs are removed from the pool)
az network lb probe list --lb-name myLB --resource-group myRG \\
  --query "[].{Name:name,Port:port,Protocol:protocol}" -o table
\`\`\``,
      solution: `**Causes in order of probability:**

1. **Empty Backend Pool**: VM NICs have not been added to the backend pool.

2. **Health Probe failing**: the application is not responding on the configured probe port/path. Check whether nginx/apache is running on the correct port.

3. **NSG blocking the probe**: the NSG on the subnet or VM NIC must allow traffic from the "AzureLoadBalancer" Service Tag — check that the default rule "AllowAzureLoadBalancerInBound" (65001) has not been overridden by a custom Deny.

4. **VMs not running**: check the VM powerState.`
    }
  ]
};
