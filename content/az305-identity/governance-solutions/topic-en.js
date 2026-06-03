window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-identity/governance-solutions'] = {
  theory: `# Designing Governance & Compliance Solutions (AZ-305)

## Exam Relevance
> Estimated weight **15-20%** on AZ-305. Questions about Landing Zones, management group hierarchy and governance strategies at scale.

## Core Concepts

### Azure Landing Zone
A framework of best practices for structuring Azure in a scalable and secure way:
- Separates platform workloads (identity, network, security) from application workloads
- Defines guardrails (policies, RBAC) that apply to all workloads

**Typical Management Group structure for a Landing Zone:**
\`\`\`
Root Management Group
  ├─ Tenant Root
  │    ├─ Platform
  │    │    ├─ Connectivity (ExpressRoute, VPN, Firewall)
  │    │    ├─ Identity (Entra ID Connect, AD DS)
  │    │    └─ Management (Monitor, Backup, ASC)
  │    ├─ Landing Zones
  │    │    ├─ Corp (corporate resources connected to hub)
  │    │    └─ Online (Internet-facing workloads)
  │    ├─ Sandbox (experimentation, no prod connectivity)
  │    └─ Decommissioned (subscriptions being retired)
\`\`\`

### Governance at Scale

**Policy Strategy:**
1. **Deny policies** for hard regulatory requirements (e.g. EU only for GDPR data)
2. **Audit policies** for visibility (e.g. resources without tags)
3. **Modify/DeployIfNotExists** for automatic remediation (e.g. apply tags, enable diagnostics)

**Built-in Compliance Initiatives:**
- ISO 27001, SOC 2, PCI DSS, NIST SP 800-53
- CIS Microsoft Azure Foundations Benchmark
- FedRAMP High

### Azure Blueprints (legacy → use Bicep/Terraform)
Packaged: Role Assignments + Policy Assignments + ARM Templates + Resource Groups
- **Now deprecated** in favor of Bicep + Deployment Stacks or Terraform

### Tagging Strategy
Essential for billing, governance and operations:

| Tag | Purpose | Example |
|-----|---------|---------|
| Environment | Identify tier | prod, staging, dev |
| CostCenter | Chargeback | CC-1234 |
| Owner | Responsible team | team-platform |
| Application | Application name | app-checkout |
| DataClassification | Compliance | confidential, public |

**Enforce tags via Policy:**
- \`Deny\` without tag → blocks creation
- \`Modify\` → applies tag automatically
- \`Append\` → adds tag if it doesn't exist

### Microsoft Defender for Cloud (formerly ASC)
Security posture and workload protection:
- **Secure Score**: security score based on recommendations
- **Regulatory Compliance**: measures compliance against frameworks (ISO, PCI, NIST)
- **Defender Plans**: advanced protection for VMs, SQL, Storage, etc.

### Cost Management + Billing
Tools to control spending:
- **Cost Analysis**: visualize spending by resource/tag/service
- **Budgets**: alerts when spending reaches % of budget
- **Reservations**: up to 72% discount for consistently used VMs/SQL
- **Savings Plans**: flexible discount by $/hour commitment

## Design Patterns

### Pattern: Policy Hierarchy by Environment
\`\`\`
Root MG
  ├─ Deny: resources outside approved regions [ALL]
  ├─ Enforce: mandatory CostCenter tag [ALL]
  │
  └─ Prod MG
       ├─ Require: encryption at rest [PROD]
       ├─ Deny: public endpoints on Storage [PROD]
       └─ Deploy: Log Analytics on all VMs [PROD]

  └─ Dev MG
       └─ Audit: cost per RG [DEV]
\`\`\`

### Pattern: Chargeback by Tag
\`\`\`
Policy: Inherit CostCenter tag from subscription → RG → Resource
Cost Management: group by CostCenter tag
Azure Cost Export: CSV for internal chargeback system
\`\`\`

## Killer.sh Style Challenge

> **Scenario**: A company with 50 subscriptions needs governance. Requirements:
> 1. Personal data only in EU regions (GDPR)
> 2. Every RG must have tags: Owner, CostCenter, Environment
> 3. All production VMs must have diagnostics enabled
> 4. Monthly spend alerts per subscription
>
> **Design the solution.**
>
> **Answer**: Management Groups with 3 levels: Root → Platform/Landing Zones/Sandbox. At the root: Deny policy for locations outside EU for resources with dataClassification=personal. In Landing Zones: Policy Initiative with Deny (CostCenter/Owner/Environment mandatory) + Modify (inherit tags). In Prod MG: DeployIfNotExists for Log Analytics Agent on VMs. Budget alerts per subscription with Action Group → email to those responsible.
`,

  quiz: [
    {
      question: 'A company needs to ensure that data classified as "PII" is only stored in European regions (GDPR). How to implement this at scale for all subscriptions?',
      options: [
        'Compliance training for all developers',
        'Azure Policy Deny assignments on the Management Group with a condition for locations outside EU and tag dataClassification=PII',
        'Azure Defender for Cloud with a compliance alert',
        'Resource locks on Storage Accounts in EU regions'
      ],
      correct: 1,
      explanation: 'Azure Policy with the Deny effect on the Management Group ensures that PII-tagged resources cannot be created outside EU-approved regions. Assigned on the parent MG, it inherits to all child subscriptions automatically. It is the only way to guarantee technical compliance (not just by process).',
      reference: 'Technical governance > training: blocking policies guarantee compliance; training does not. Use Policy Deny for "cannot do" and Audit for "should do".'
    },
    {
      question: 'What is Azure Secure Score in Microsoft Defender for Cloud?',
      options: [
        'The company\'s credit score in Azure',
        'An aggregated metric of security posture based on implemented recommendations',
        'The number of security incidents in the month',
        'The response speed to security alerts'
      ],
      correct: 1,
      explanation: 'Secure Score is a percentage metric that reflects how many of Defender for Cloud\'s security recommendations have been implemented. Recommendations have different weights — implementing a critical recommendation increases the score more. It serves as a security posture KPI and helps prioritize improvements.',
      reference: 'Secure Score = % of security recommendations implemented. The higher, the more secure the posture. Target: > 80%.'
    },
    {
      question: 'What is the best strategy for applying mandatory tags (Owner, CostCenter) to all resources across an organization with multiple subscriptions?',
      options: [
        'Document the policy and wait for everyone to comply voluntarily',
        'A PowerShell script that runs monthly to add missing tags',
        'Azure Policy with Deny effect for new resources without the tags, and Modify to inherit tags from the Resource Group onto resources',
        'Azure Blueprints assigned to each subscription individually'
      ],
      correct: 2,
      explanation: 'The combination of Deny (blocks new resources without tags) and Modify (automatically inherits tags from the RG to resources) assigned at a Management Group is the scalable and automated approach. Deny prevents non-compliant creation; Modify ensures consistency on existing and new resources. Monthly scripts are reactive and do not guarantee continuous compliance.',
      reference: 'Policy Deny + Modify = automatic governance. Deny prevents non-compliance; Modify inherits and fixes automatically.'
    }
  ],

  flashcards: [
    {
      front: 'What is an Azure Landing Zone and what are its principles?',
      back: '**Landing Zone** = pre-configured Azure environment with security, network and governance guardrails before placing workloads.\n\n**Principles:**\n1. **Subscription per workload**: separation of billing and limits\n2. **Policy-driven governance**: automatic guardrails via Azure Policy\n3. **Platform separation**: network, identity, security managed separately from workloads\n4. **Scalability**: structure that grows without a rewrite\n\n**Accelerator**: Azure Landing Zone Bicep on GitHub (microsoft/alz-bicep)'
    },
    {
      front: 'What are the 4 components of an effective tagging strategy?',
      back: '1. **Mandatory tags** (enforced via Policy Deny):\n   - CostCenter, Owner, Environment, Application\n\n2. **Inherited tags** (via Policy Modify):\n   - Resources inherit tags from the Resource Group\n   - RGs inherit from the Subscription\n\n3. **Data Classification** (for compliance):\n   - confidential, internal, public\n\n4. **Report automation**:\n   - Cost Management grouped by tag\n   - Chargeback by CostCenter'
    },
    {
      front: 'What is the difference between Reservations and Savings Plans in Azure Cost Management?',
      back: '**Reservations** (up to 72% discount):\n- 1 or 3-year commitment for SPECIFIC resources\n- E.g.: 10 × D4s_v5 in East US\n- Discount applied automatically when the resource matches\n- Less flexible, higher discount\n\n**Savings Plans** (up to 65% discount):\n- $/hour commitment for 1 or 3 years\n- Applied to any qualifying compute\n- More flexible (any region, size)\n- Lower discount than Reservations'
    }
  ],

  lab: {
    scenario: 'Configure a basic governance structure with a Management Group and Azure Policy for TechNova.',
    objective: 'Create a Management Group, explore the hierarchy and check compliance via Azure Policy.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Create a Management Group',
        instruction: 'Create a Management Group for TechNova and explore the hierarchy.',
        hints: ['\`az account management-group create\`'],
        solution: `\`\`\`bash
# Create a Management Group (requires Owner/Management Group Contributor permission)
az account management-group create \\
  --name "TechNova-Corp" \\
  --display-name "TechNova Corporation"

# List Management Groups
az account management-group list --output table
\`\`\``,
        verify: `\`\`\`bash
az account management-group show --name "TechNova-Corp" \\
  --query "{Name:displayName,ID:name}" -o table 2>/dev/null || \\
  echo "Check permissions — Management Group requires Owner on the tenant"
\`\`\``
      },
      {
        title: 'Explore compliance and Secure Score',
        instruction: 'Explore Microsoft Defender for Cloud to understand the Secure Score and recommendations via CLI.',
        hints: ['\`az security secure-score list\`'],
        solution: `\`\`\`bash
# View the subscription Secure Score
az security secure-score list \\
  --query "[].{Score:properties.score.current,Max:properties.score.max,Pct:properties.score.percentage}" \\
  -o table 2>/dev/null || echo "Defender for Cloud: Portal → Security Center → Secure Score"

# View active recommendations
az security assessment list \\
  --query "[?properties.status.code=='Unhealthy'][].{Name:displayName,Status:properties.status.code}" \\
  -o table 2>/dev/null | head -10 || echo "Check via portal: Defender for Cloud → Recommendations"
\`\`\``,
        verify: `\`\`\`bash
echo "Secure Score explored — target: > 80% indicates a good security posture"
echo "Priority recommendations: enable MFA, activate diagnostics, encryption at rest"
\`\`\``
      },
      {
        title: 'Configure a Budget Alert',
        instruction: 'Create a $100 monthly budget with an alert at 80% usage.',
        hints: ['\`az consumption budget create\`'],
        solution: `\`\`\`bash
SUB_ID=$(az account show --query id -o tsv)

# Create a monthly budget
az consumption budget create \\
  --budget-name monthly-budget \\
  --amount 100 \\
  --time-grain Monthly \\
  --start-date $(date +%Y-%m-01) \\
  --end-date 2026-12-31 \\
  --scope /subscriptions/$SUB_ID \\
  --notifications '[{
    "enabled": true,
    "operator": "GreaterThan",
    "threshold": 80,
    "contactEmails": ["admin@contoso.com"],
    "thresholdType": "Actual"
  }]' 2>/dev/null || echo "Budget created via portal: Cost Management → Budgets → + Add"
\`\`\``,
        verify: `\`\`\`bash
az consumption budget list --query "[].{Name:name,Amount:amount}" -o table 2>/dev/null || echo "Check via portal"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Unexpectedly high Azure costs',
      difficulty: 'medium',
      symptom: 'The Azure bill came in much higher than expected. You need to identify which resources are generating the cost.',
      diagnosis: `\`\`\`bash
# Analyze costs by resource group
az consumption usage list \\
  --start-date $(date -d '-30 days' '+%Y-%m-%d') \\
  --end-date $(date '+%Y-%m-%d') \\
  --query "sort_by([],&pretaxCost)[-5:].{Resource:instanceName,Cost:pretaxCost,Service:meterDetails.serviceName}" \\
  -o table 2>/dev/null || echo "Check: Cost Management → Cost Analysis → Group by: Resource"
\`\`\``,
      solution: `**Investigation process:**

1. **Cost Analysis**: Azure Portal → Cost Management → Cost Analysis → Group by Resource or Service. Look for sudden spikes.

2. **Enable budget alerts**: set a budget alert at 80% of expected spend to detect overruns early.

3. **Identify forgotten resources**: common culprits — VMs not deallocated (only stopped), Premium SSD snapshots, public IPs assigned to nothing, ExpressRoute circuits.

4. **Use Cost Advisor**: Cost Management → Advisor recommendations → Cost category — Azure gives specific suggestions like "right-size this VM".

5. **Tag analysis**: if resources have CostCenter tags, group costs by tag to pinpoint which team/project is generating the spend.`
    }
  ]
};
