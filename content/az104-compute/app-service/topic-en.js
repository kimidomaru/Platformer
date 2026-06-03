window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-compute/app-service'] = {
  theory: `# Azure App Service

## Exam Relevance
> Estimated weight **8-12%** on AZ-104. Questions about App Service Plans, deployment slots, scaling and VNet integration appear regularly.

## Core Concepts

### App Service
PaaS for hosting web apps, REST APIs and mobile backends:
- Supports: .NET, Node.js, Python, Java, PHP, Ruby, Docker
- Managed: no OS, patches or infrastructure to manage
- Integrates with: VNet, Key Vault, Managed Identity, Deployment Slots

### App Service Plan
Defines the compute (CPU/RAM) and location of the App Service:
- One plan can host **multiple App Services**
- Costs are per **plan**, not per app

| Tier | Use | Features |
|------|-----|---------|
| **Free/Shared** | Dev/test | No SLA, shared resources |
| **Basic (B)** | Dev/test | Dedicated VMs, no autoscaling |
| **Standard (S)** | Production | Autoscaling, deployment slots (5) |
| **Premium (P)** | High performance | More slots (20), VNet integration |
| **Isolated (I)** | Mission critical | ASE (App Service Environment), dedicated VNet |

### Deployment Slots
Separate environments within the same App Service (staging, QA, etc.):
- Each slot has its own URL (e.g. \`myapp-staging.azurewebsites.net\`)
- **Swap**: exchanges production ↔ staging with zero downtime (warms up the instance first)
- Settings can be "slot settings" (not swapped) or regular (swapped)
- Requires Standard tier or higher

### Scaling
**Scale Up**: increase App Service Plan size (more CPU/RAM)
**Scale Out**: increase number of instances (horizontal)
- **Manual**: set a fixed number of instances
- **Autoscaling**: rules based on CPU, memory, custom metrics

### Networking Integration
- **Outbound — VNet Integration**: App Service accesses resources on the VNet (private databases)
- **Inbound — Private Endpoint**: exposes the App Service only within the VNet (no public access)
- **Inbound — App Service Environment (ASE)**: App Service completely inside a VNet

### Custom Domain & SSL
\`\`\`bash
# Add a custom domain
az webapp config hostname add \\
  --webapp-name myApp \\
  --resource-group myRG \\
  --hostname www.contoso.com

# Bind an SSL certificate
az webapp config ssl bind \\
  --name myApp \\
  --resource-group myRG \\
  --certificate-thumbprint <thumbprint> \\
  --ssl-type SNI
\`\`\`

## Essential Commands (Azure CLI)

\`\`\`bash
# Create a Standard App Service Plan
az appservice plan create \\
  --name myAppPlan \\
  --resource-group myRG \\
  --sku S1 \\
  --is-linux

# Create a Web App
az webapp create \\
  --name myWebApp \\
  --resource-group myRG \\
  --plan myAppPlan \\
  --runtime "PYTHON:3.11"

# List available runtimes
az webapp list-runtimes --os-type linux

# Deploy via ZIP
az webapp deployment source config-zip \\
  --name myWebApp \\
  --resource-group myRG \\
  --src ./app.zip

# Create a deployment slot
az webapp deployment slot create \\
  --name myWebApp \\
  --resource-group myRG \\
  --slot staging

# Swap production ↔ staging
az webapp deployment slot swap \\
  --name myWebApp \\
  --resource-group myRG \\
  --slot staging \\
  --target-slot production

# Configure an environment variable
az webapp config appsettings set \\
  --name myWebApp \\
  --resource-group myRG \\
  --settings DATABASE_URL="postgresql://..." ENVIRONMENT="production"

# Configure autoscaling
az monitor autoscale create \\
  --resource-group myRG \\
  --resource <app-service-plan-resource-id> \\
  --min-count 1 --max-count 5 --count 2

# Enable VNet Integration
az webapp vnet-integration add \\
  --name myWebApp \\
  --resource-group myRG \\
  --vnet myVNet \\
  --subnet IntegrationSubnet

# Stream logs in real time
az webapp log tail --name myWebApp --resource-group myRG
\`\`\`

## Common Mistakes

1. **Slot swap does not work as expected**: check whether critical app settings are "slot settings" (they stay) or regular settings (they move with the swap).
2. **Autoscaling is on the wrong tier**: autoscaling requires Standard or higher — it does not work on Basic.
3. **VNet Integration does not resolve private names**: check DNS configuration and whether the App Plan supports regional VNet integration.
4. **Always On disabled**: for Free/Shared tier, the app can "sleep" after inactivity — enable "Always On" on Standard+.

## Killer.sh Style Challenge

> You have a production web application and need to deploy a new version without downtime. The new version must be tested before going to production. Describe the process using Deployment Slots.
>
> **Answer**: 1) Create a "staging" slot (requires S1+). 2) Deploy the new version to the staging slot. 3) Test at staging.azurewebsites.net. 4) If approved: \`az webapp deployment slot swap --slot staging\` — swaps staging ↔ production instantly. If there is an issue: swap back (the previous version is now in the staging slot after the swap).
`,

  quiz: [
    {
      question: 'An App Service needs CPU-based autoscaling. What is the minimum App Service Plan tier required?',
      options: [
        'Basic (B)',
        'Standard (S)',
        'Free',
        'Shared'
      ],
      correct: 1,
      explanation: 'Autoscaling requires the Standard (S) tier or higher. Basic tier supports manual scale up/out but not metric-based autoscaling. Free and Shared are shared and do not support scaling.',
      reference: 'Memorize: Deployment Slots and Autoscaling = Standard+. Basic = manual scaling only.'
    },
    {
      question: 'What happens to App Settings during a Deployment Slot Swap?',
      options: [
        'All settings are always swapped together with the code',
        'Settings marked as "slot settings" stay in their slot; regular settings are swapped together with the deployment',
        'No settings are swapped — only the code is moved',
        'Settings are duplicated in both slots after the swap'
      ],
      correct: 1,
      explanation: 'During a swap, "regular" (non-slot-specific) settings are swapped along with the code. Settings marked as "slot settings" remain anchored to the slot they are in (e.g. the staging connection string stays in staging even after the swap). This lets staging continue pointing to the staging DB while production points to the production DB.',
      reference: 'Use "slot settings" for connection strings and settings that must differ per environment.'
    },
    {
      question: 'How many deployment slots does a Standard App Service Plan support?',
      options: [
        '1 (production only)',
        '5 (including production)',
        '20',
        'Unlimited'
      ],
      correct: 1,
      explanation: 'Standard App Service Plan supports up to 5 deployment slots (including the production slot), meaning 4 additional slots such as staging, QA, etc. Premium supports up to 20 slots.',
      reference: 'Standard = 5 slots total. Premium = 20 slots. Basic = no slots.'
    }
  ],

  flashcards: [
    {
      front: 'What is an App Service Plan and how does it relate to App Services?',
      back: '**App Service Plan** defines the compute (CPU, RAM, capacity) and region for apps.\n\n- One plan can host **multiple App Services** (they share resources)\n- Costs are charged per **plan**, not per app\n- Changing the plan = changing the compute for all apps on the plan\n\nTiers: Free/Shared (shared) → Basic → Standard → Premium → Isolated (ASE)'
    },
    {
      front: 'How does Deployment Slot Swap work and why does it have zero downtime?',
      back: '**Before the swap**, Azure:\n1. Warms up the staging slot (starts instances, loads config, makes warmup requests)\n2. Waits for a healthy response\n\n**On the swap**: switches traffic routing instantly (internal DNS)\n- Production now points to what was staging\n- Staging now points to what was production\n\n**Result**: zero downtime because the new code was already "warm" before the swap. If there is an issue: swap back.'
    },
    {
      front: 'What is the difference between VNet Integration and Private Endpoint in App Service?',
      back: '**VNet Integration** (outbound):\n- App Service MAKES calls to resources inside the VNet\n- E.g.: app → private database on the VNet\n- Flow: traffic LEAVING the App Service goes through the VNet\n\n**Private Endpoint** (inbound):\n- App Service RECEIVES traffic only from inside the VNet\n- Removes public access to the app\n- E.g.: App Service accessible only by VMs/services inside the VNet\n\nBoth can be used together for completely private apps.'
    }
  ],

  lab: {
    scenario: 'Deploy a simple web application on Azure App Service and configure a staging deployment slot.',
    objective: 'Create a Standard App Service Plan, Web App, deployment slot and perform a swap.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create the App Service Plan and Web App',
        instruction: 'Create an S1 Linux App Service Plan and a Python Web App.',
        hints: ['\`az appservice plan create --sku S1 --is-linux\`'],
        solution: `\`\`\`bash
az group create --name rg-appservice-lab --location eastus

az appservice plan create \\
  --name technova-plan \\
  --resource-group rg-appservice-lab \\
  --sku S1 \\
  --is-linux

az webapp create \\
  --name technova-app-$(date +%s | tail -c 5) \\
  --resource-group rg-appservice-lab \\
  --plan technova-plan \\
  --runtime "PYTHON:3.11"

APP_NAME=$(az webapp list --resource-group rg-appservice-lab --query "[0].name" -o tsv)
echo "App created: $APP_NAME"
echo "URL: https://\${APP_NAME}.azurewebsites.net"
\`\`\``,
        verify: `\`\`\`bash
APP_NAME=$(az webapp list --resource-group rg-appservice-lab --query "[0].name" -o tsv)
az webapp show --name $APP_NAME --resource-group rg-appservice-lab \\
  --query "{Name:name,State:state,URL:defaultHostName}" -o table
\`\`\``
      },
      {
        title: 'Create a staging deployment slot',
        instruction: 'Create a slot called "staging" on the Web App.',
        hints: ['\`az webapp deployment slot create\`'],
        solution: `\`\`\`bash
APP_NAME=$(az webapp list --resource-group rg-appservice-lab --query "[0].name" -o tsv)
az webapp deployment slot create \\
  --name $APP_NAME \\
  --resource-group rg-appservice-lab \\
  --slot staging

echo "Staging slot created: https://\${APP_NAME}-staging.azurewebsites.net"
\`\`\``,
        verify: `\`\`\`bash
APP_NAME=$(az webapp list --resource-group rg-appservice-lab --query "[0].name" -o tsv)
az webapp deployment slot list \\
  --name $APP_NAME --resource-group rg-appservice-lab \\
  --query "[].{Slot:name,State:state}" -o table
# Expected output: staging | Running
\`\`\``
      },
      {
        title: 'Configure App Settings and perform a Swap',
        instruction: 'Add an App Setting "ENVIRONMENT=staging" to the staging slot and then swap it with production.',
        hints: ['\`az webapp config appsettings set --slot staging\`'],
        solution: `\`\`\`bash
APP_NAME=$(az webapp list --resource-group rg-appservice-lab --query "[0].name" -o tsv)

# Configure app setting on the staging slot
az webapp config appsettings set \\
  --name $APP_NAME \\
  --resource-group rg-appservice-lab \\
  --slot staging \\
  --settings ENVIRONMENT="staging" VERSION="2.0"

# Swap staging → production
az webapp deployment slot swap \\
  --name $APP_NAME \\
  --resource-group rg-appservice-lab \\
  --slot staging \\
  --target-slot production

echo "Swap complete!"
\`\`\``,
        verify: `\`\`\`bash
APP_NAME=$(az webapp list --resource-group rg-appservice-lab --query "[0].name" -o tsv)
# After the swap, production should have the settings from staging (except slot settings)
az webapp config appsettings list \\
  --name $APP_NAME --resource-group rg-appservice-lab \\
  --query "[?name=='ENVIRONMENT'].value" -o tsv
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-appservice-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-appservice-lab 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'App Service returns 503 Service Unavailable',
      difficulty: 'easy',
      symptom: 'A Web App returns 503 Service Unavailable after a new deploy.',
      diagnosis: `\`\`\`bash
# Check the app status
az webapp show --name myApp --resource-group myRG --query "state" -o tsv

# View application logs
az webapp log tail --name myApp --resource-group myRG

# Check app settings (error may be a missing variable)
az webapp config appsettings list --name myApp --resource-group myRG -o table
\`\`\``,
      solution: `**Common causes:**

1. **Application crashing at startup**: check the logs — it may be an import error, a missing environment variable, or a dependency error.

2. **Missing App Setting**: if a swap was performed and a critical setting was a slot setting in staging (it stayed behind).

3. **Restart needed**: \`az webapp restart --name myApp --resource-group myRG\`

4. **Insufficient resources**: if the App Service Plan is overloaded (Basic with many apps), scale up.

5. **Incomplete deploy**: check \`az webapp deployment list\` to see whether the last deploy succeeded.`
    }
  ]
};
