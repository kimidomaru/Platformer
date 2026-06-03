window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-infrastructure/compute-solutions'] = {
  theory: `# Designing Compute Solutions (AZ-305)

## Exam Relevance
> Estimated weight **25-30%** on AZ-305. The exam evaluates your ability to choose between IaaS/PaaS/serverless and design compute architectures suited to the requirements.

## Core Concepts

### Decision Matrix: IaaS vs PaaS vs Serverless

\`\`\`
                  Control    Management    Scalability    Cost
VMs (IaaS)         High        Manual        Manual        Fixed
App Service (PaaS) Medium      Managed       Auto          On-demand
Container Inst.    Medium      Serverless    Auto (burst)  Per second
AKS                High        Shared        Auto          Per node
Functions          Low         Serverless    Automatic     Per execution
\`\`\`

**When to use each:**

| Service | Use when |
|---------|---------|
| **Azure VMs** | Full OS control, legacy software, specific Windows workloads, lift-and-shift |
| **App Service** | Web apps, REST APIs, no infra management, 1–30k requests/day |
| **Azure Container Instances (ACI)** | Containers without orchestration, batch tasks, CI/CD runners, fast burst |
| **Azure Kubernetes Service (AKS)** | Complex microservices, multiple teams, high traffic, sophisticated deployment |
| **Azure Functions** | Event-driven, asynchronous processing, webhooks, short scheduled tasks |
| **Azure Container Apps** | Serverless microservices with Dapr, without managing Kubernetes |
| **Azure Logic Apps** | Code-free integrations and workflows, SaaS connectors |

### VM Scale Sets (VMSS)
Manages groups of identical VMs with autoscaling:
- **Autoscaling**: scale out/in based on metrics (CPU, memory, custom)
- **Rolling updates**: updates VMs gradually without downtime
- **Spot VMs**: uses Azure excess capacity at a discount (up to 90%) but can be interrupted
- **Flex orchestration**: more flexible, supports different sizes in the same set

**VMSS vs App Service:**
- VMSS: stateful workloads, legacy containers, VM-intensive processing
- App Service: web apps, without managing OS, simple deploys

### Azure Kubernetes Service (AKS) — Architecture Decision
It is not always the best choice. Use AKS when:
- Multiple microservices with complex interdependencies
- The team has Kubernetes expertise
- Portability is required (multi-cloud or on-premises)
- Workloads have very different resource requirements

Consider **Azure Container Apps** as a simpler alternative to AKS for serverless microservices.

### Serverless Compute

**Azure Functions** — event → code → result:
- **Consumption plan**: pay per execution, scales to zero
- **Premium plan**: no cold start, VNet integration, more expensive
- **Dedicated plan**: existing App Service plan, good for long-running functions
- Timeout: 5 min (Consumption), 10 min configurable (Premium/Dedicated)

**Durable Functions** — orchestration:
- **Orchestrator**: coordinates activities (does not call external APIs directly)
- **Activity**: performs the actual work
- **Human interaction pattern**: waits for human approval

### Azure Batch
Large-scale parallel job processing:
- Automatically creates and manages VM pools
- Distributes tasks among VMs
- Pay only for the compute used
- Use cases: 3D rendering, scientific simulations, data processing

### Region Selection and Proximity Placement Groups
- **Proximity Placement Groups**: ensures VMs are physically close (same rack) to minimize network latency
- Important for HPC and latency-sensitive workloads

## Design Patterns

### Pattern: Web App with Asynchronous Backend
\`\`\`
Client → App Service (Web)
              ↓ queue
         Azure Service Bus/Queue
              ↓ trigger
         Azure Functions (processing)
              ↓
         Azure SQL / Cosmos DB
\`\`\`

### Pattern: Microservices on AKS
\`\`\`
Internet → Azure Front Door/AppGW (WAF, SSL)
              ↓
           AKS Ingress Controller (nginx/AGIC)
              ↓
    [Service A] [Service B] [Service C]
        ↓              ↓           ↓
  Azure SQL     Cosmos DB    Azure Cache
\`\`\`

### Pattern: Batch Processing
\`\`\`
Blob Storage (input files)
      ↓ trigger
Azure Batch (VM pool)
      ↓ parallel processing
Blob Storage (output files)
      ↓
Azure Functions (notification)
\`\`\`

## Common Design Mistakes

1. **AKS for simple apps**: AKS has high operational cost and complexity — App Service or Container Apps are more appropriate for simple apps.
2. **Functions without Premium Plan for VNet**: Functions on the Consumption Plan have no native VNet integration — use the Premium Plan.
3. **VMSS without health probes**: without health probes, the VMSS cannot detect unhealthy instances.
4. **Not considering cold start**: Functions on the Consumption Plan have cold start — for consistent latency, use Premium.

## Killer.sh Style Challenge (AZ-305 Style)

> **Scenario**: A company has:
> - An e-commerce site with 10x traffic peaks on Black Friday
> - Order processing that takes 30 seconds each
> - Analytical reports that run overnight on GBs of data
> - A partner API that must always be available with latency < 100ms
>
> **Design the compute solution for each component.**
>
> **Expected solution:**
> - E-commerce site: **App Service + Premium Plan** with autoscaling or **Azure Front Door + multiple regions** (99.99%)
> - Order processing: **Azure Functions** with Service Bus Queue trigger (decouples, scales independently, 30s is OK on Premium/Dedicated plan)
> - Analytical reports: **Azure Batch** or **Azure Databricks** (parallel processing of GBs overnight)
> - Partner API: **App Service Premium** with **Availability Zones** (low latency, always available) or **Azure API Management** in front
`,

  quiz: [
    {
      question: 'A startup needs to process images uploaded by users (5–10 seconds per image) without keeping servers always on. Volume is irregular — it can be zero for hours and peak at hundreds simultaneously. Which compute solution is most appropriate?',
      options: [
        'VMs with autoscaling',
        'Azure Functions with a Blob Storage trigger',
        'App Service with manual scalability',
        'Azure Kubernetes Service (AKS)'
      ],
      correct: 1,
      explanation: 'Azure Functions is ideal for irregular event-driven processing: scales automatically from zero to any volume, you pay only per execution, and the Blob Storage trigger starts processing automatically when an image is uploaded. VMs with autoscaling would take minutes to scale; AKS has fixed node costs.',
      reference: 'Azure Functions = event-driven, scales to zero, pay per execution. Perfect for irregular and asynchronous workloads.'
    },
    {
      question: 'A legacy Windows application (.NET Framework 4.5) needs to be migrated to Azure with minimal changes. Which compute service is most appropriate?',
      options: [
        'Azure Functions',
        'Azure Container Instances',
        'Azure Virtual Machines (IaaS)',
        'Azure Container Apps'
      ],
      correct: 2,
      explanation: 'For lift-and-shift of legacy applications with specific OS or old framework dependencies, Azure VMs (IaaS) is the most appropriate choice — it allows full OS control, installing specific dependencies, and migrating with minimal code changes. Azure Functions and Container Apps require refactoring.',
      reference: 'Lift-and-shift with legacy software → VMs (IaaS). Incremental modernization → App Service. Full refactoring → Functions/Containers.'
    },
    {
      question: 'What is the main difference between Azure Container Instances (ACI) and Azure Container Apps?',
      options: [
        'ACI is for Linux; Container Apps is for Windows',
        'ACI is for short-lived containers and burst; Container Apps is for microservices with managed scalability and ingress',
        'There is no technical difference — they are the same service',
        'ACI supports Kubernetes; Container Apps does not'
      ],
      correct: 1,
      explanation: 'Azure Container Instances is simple and direct — run a container without managing infrastructure, ideal for short-lived jobs, CI/CD runners, batch tasks. Container Apps is built on Kubernetes (abstracting complexity) with microservices features: autoscaling via KEDA, managed ingress, service discovery, Dapr integration — for long-running applications.',
      reference: 'ACI = simple container, no orchestration. Container Apps = serverless microservices on K8s. AKS = managed Kubernetes with full control.'
    },
    {
      question: 'A data analytics application needs to process 10,000 files in parallel overnight. Each file takes ~30 seconds to process. Which Azure service is most appropriate?',
      options: [
        'Azure Functions with Consumption Plan',
        'Azure App Service with maximum instances',
        'Azure Batch',
        'Azure Logic Apps'
      ],
      correct: 2,
      explanation: 'Azure Batch is designed for HPC workloads and large-scale parallel processing. It automatically manages VM pools, distributes tasks, handles dependencies and cleans up resources after completion. For 10,000 parallel tasks, Batch is far more appropriate than Functions (which has concurrency limits and cost) or App Service.',
      reference: 'Azure Batch = HPC, rendering, simulations, parallel processing of large volumes. Automatically creates and destroys VMs.'
    },
    {
      question: 'Which Azure Functions plan is required for Virtual Network integration and to eliminate cold starts?',
      options: [
        'Consumption Plan',
        'Premium Plan',
        'App Service Plan (Dedicated)',
        'Basic Plan'
      ],
      correct: 1,
      explanation: 'The Azure Functions Premium Plan offers: no cold start (pre-warmed instances), VNet integration, more powerful CPU/memory, and unlimited execution duration. The Consumption Plan has no native VNet integration and has cold start. The Dedicated (App Service) Plan also avoids cold start but is more expensive for functions with low utilization.',
      reference: 'Functions + VNet = Premium Plan. Consumption = cheapest but cold start and no VNet. Premium = fixed cost per pre-warmed instance.'
    }
  ],

  flashcards: [
    {
      front: 'Which Azure compute service to choose for each scenario?',
      back: '| Scenario | Service |\n|---------|--------|\n| Legacy lift-and-shift | VMs (IaaS) |\n| Web app/API without infra | App Service |\n| Event-driven/webhook | Azure Functions |\n| Isolated container, burst | Azure Container Instances |\n| Serverless microservices | Azure Container Apps |\n| Complex Kubernetes | AKS |\n| HPC/parallel processing | Azure Batch |\n| VM autoscaling in a group | VM Scale Sets |'
    },
    {
      front: 'What are the 3 Azure Functions plans and their differences?',
      back: '**Consumption Plan** (default):\n- Pay per execution (execution + memory)\n- Scales to zero\n- Cold start possible\n- No native VNet integration\n- Timeout: 5 min (default)\n\n**Premium Plan**:\n- Pre-warmed instances (no cold start)\n- VNet integration\n- No maximum timeout\n- Pay per instance/hour\n\n**Dedicated (App Service) Plan**:\n- Runs on your existing App Service Plan\n- No cold start\n- No automatic scaling by default\n- Good for long-running functions or when you already have an App Service'
    },
    {
      front: 'When to use VM Scale Sets vs App Service for horizontal scaling?',
      back: '**VM Scale Sets (VMSS)**:\n- Full OS control\n- Stateful workloads that need VMs\n- GPU/HPC processing\n- Containers on custom VMs\n- Spot instances for cost savings\n\n**App Service with autoscaling**:\n- Web apps and APIs\n- No OS or patch management\n- Simpler deploys\n- Managed PaaS\n\n**Rule**: if you need VMs and automatic scaling → VMSS. If it\'s web/API and you don\'t want to manage VMs → App Service.'
    }
  ],

  lab: {
    scenario: 'Compare different compute options by creating an Azure Function and an App Service, understanding the practical differences.',
    objective: 'Create an Azure Function with a Consumption Plan and compare it with App Service, understanding cost and functionality trade-offs.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create an Azure Function App',
        instruction: 'Create a Python Function App on the Consumption Plan.',
        hints: ['\`az functionapp create\` requires a storage account and the "consumption" plan'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-compute-design --location eastus

# Storage Account for Functions
az storage account create \\
  --name "funcstore\${SUFFIX}" \\
  --resource-group rg-compute-design \\
  --sku Standard_LRS

# Function App on the Consumption Plan (serverless)
az functionapp create \\
  --name "technova-func-\${SUFFIX}" \\
  --resource-group rg-compute-design \\
  --storage-account "funcstore\${SUFFIX}" \\
  --consumption-plan-location eastus \\
  --runtime python \\
  --runtime-version 3.11 \\
  --functions-version 4 \\
  --os-type linux

echo "Function App: technova-func-\${SUFFIX}"
echo "SUFFIX=\${SUFFIX}" > /tmp/compute-design.sh
\`\`\``,
        verify: `\`\`\`bash
source /tmp/compute-design.sh 2>/dev/null
az functionapp list --resource-group rg-compute-design \\
  --query "[].{Name:name,State:state}" -o table 2>/dev/null || \\
az functionapp list --resource-group rg-compute-design -o table
\`\`\``
      },
      {
        title: 'Compare available plans',
        instruction: 'List and compare the available plans for Functions and App Service in the eastus region.',
        hints: ['\`az functionapp list-consumption-locations\` and \`az appservice list-locations\`'],
        solution: `\`\`\`bash
# List regions with Consumption Plan support
echo "=== Regions with Consumption Plan for Functions ==="
az functionapp list-consumption-locations --query "[?contains(name,'east')].name" -o tsv | head -5

# Compare plan features
echo "=== Plan Comparison ==="
echo "Consumption: pay per execution, scales to 0, cold start possible"
echo "Premium: pre-warmed instances, no cold start, VNet, fixed cost"
echo "Dedicated: uses existing App Service Plan, no native autoscale"

# View the created Function App settings
SUFFIX=$(cat /tmp/compute-design.sh 2>/dev/null | grep SUFFIX | cut -d= -f2)
if [ ! -z "$SUFFIX" ]; then
  az functionapp show --name "technova-func-\${SUFFIX}" \\
    --resource-group rg-compute-design \\
    --query "{Name:name,Runtime:siteConfig.linuxFxVersion}" -o json
fi
\`\`\``,
        verify: `\`\`\`bash
echo "Plan comparison complete"
echo "Next step: decide between Consumption/Premium/Dedicated based on requirements"
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-compute-design --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-compute-design 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Azure Function cold start impacting production latency',
      difficulty: 'medium',
      symptom: 'Users report that the first requests after a period of inactivity are very slow (5–10 seconds). The system uses Functions on the Consumption Plan.',
      diagnosis: `\`\`\`bash
# Check the current Function App plan
az functionapp show --name myFuncApp --resource-group myRG \\
  --query "{Plan:appServicePlanId,SKU:sku}" -o json

# Check Application Insights for response times
# Portal: Application Insights → Performance → Dependency calls
# Look for "cold start" in the traces
\`\`\``,
      solution: `**Cause**: Cold start on the Consumption Plan — when there are no requests for a period, instances are deallocated. The next request starts the instance from scratch (cold start).

**Solutions in order of cost:**

1. **Migrate to Premium Plan**: pre-warmed instances eliminate cold start:
\`\`\`bash
az functionapp plan create \\
  --name funcpremiumplan --resource-group myRG \\
  --sku EP1 --location eastus --is-linux

az functionapp update --name myFuncApp --resource-group myRG \\
  --plan funcpremiumplan
\`\`\`

2. **Keep-alive with Azure Scheduler (workaround)**: a timer trigger that calls the function every 5 minutes to keep it "warm" — does not eliminate cold start, only reduces its frequency.

3. **App Service Plan (Dedicated)**: if you already have an App Service Plan, move the Function to it — no cold start and no additional compute cost.`
    }
  ]
};
