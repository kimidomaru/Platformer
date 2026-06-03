window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-identity/azure-policy'] = {
  theory: `# Azure Policy & Management Groups

## Exam Relevance
> Estimated weight **10-15%** on AZ-104. Questions involve creating policies to enforce compliance, organizing resources with Management Groups and applying tags in an automated way.

## Core Concepts

### Management Groups
A container that organizes **multiple subscriptions**:
\`\`\`
Root Management Group (tenant root)
  ├─ MG-Corp
  │    ├─ Subscription Prod
  │    └─ Subscription Staging
  └─ MG-Dev
       └─ Subscription Dev
\`\`\`
- Supports up to **6 levels** of hierarchy (excluding the root)
- Policies and RBAC assigned at a Management Group **inherit** to all child subscriptions
- Each tenant has an automatic Root Management Group

### Azure Policy
A service that **enforces** or **audits** rules over Azure resources:
- Guarantees organizational compliance (e.g. "every VM must have a cost tag")
- Prevents creation of non-compliant resources
- Can **remediate** existing non-compliant resources

### Azure Policy Components

**Policy Definition**: the rule itself. Composed of:
- **if** (condition): when the policy applies
- **then** (effect): what happens

**Policy Initiative (Policy Set)**: a collection of policies grouped for a common goal (e.g. CIS Benchmark, PCI-DSS)

**Policy Assignment**: applying a policy/initiative to a specific scope

### Effects

| Effect | When to Use | Behavior |
|--------|-------------|----------|
| **Deny** | Prevent creation/modification | Blocks the operation |
| **Audit** | Monitor without blocking | Logs non-compliance |
| **AuditIfNotExists** | Check a related resource | Alerts if an auxiliary resource doesn't exist |
| **DeployIfNotExists** | Auto-remediate on creation | Deploys a related resource automatically |
| **Append** | Add properties | Adds fields to the resource |
| **Modify** | Change tags/properties | Modifies properties during creation/update |
| **Disabled** | Temporarily disable | Policy not evaluated |

> **Important for the exam**: Deny blocks new resources; Audit blocks nothing; DeployIfNotExists is used for auto-remediation.

### Exemption vs Exclusion
- **Exclusion**: permanently excludes a scope from the policy (in the assignment)
- **Exemption**: temporarily excludes a resource/scope with an expiration date and justification (requires \`Microsoft.Authorization/policyExemptions/write\`)

### Compliance State
- **Compliant**: the resource meets the policy
- **Non-compliant**: the resource violates the policy
- **Exempt**: excluded from evaluation
- **Conflicting**: the resource contradicts multiple policies

## Essential Commands (Azure CLI)

\`\`\`bash
# List available policy definitions
az policy definition list --output table | head -20

# Search for a policy by keyword
az policy definition list --query "[?contains(displayName,'tag')].[displayName,name]" -o table

# View details of a built-in policy
az policy definition show --name "1e30110a-5ceb-460c-a204-c1c3969c6d62"

# Create a custom policy definition
az policy definition create \\
  --name "require-costcenter-tag" \\
  --display-name "Require CostCenter tag on Resource Groups" \\
  --description "All RGs must have the CostCenter tag" \\
  --rules '{
    "if": {
      "allOf": [
        {"field": "type", "equals": "Microsoft.Resources/subscriptions/resourceGroups"},
        {"field": "tags[CostCenter]", "exists": "false"}
      ]
    },
    "then": {"effect": "deny"}
  }' \\
  --mode All

# Assign a policy to a Resource Group
az policy assignment create \\
  --name "enforce-costcenter-rg" \\
  --display-name "Enforce CostCenter Tag in RG" \\
  --policy "require-costcenter-tag" \\
  --scope /subscriptions/<sub-id>/resourceGroups/<rg>

# Assign a policy with parameters
az policy assignment create \\
  --name "allowed-locations" \\
  --display-name "Allowed Locations" \\
  --policy "e56962a6-4747-49cd-b67b-bf8b01975c4f" \\
  --params '{"listOfAllowedLocations": {"value": ["eastus", "westeurope"]}}' \\
  --scope /subscriptions/<sub-id>

# Check compliance
az policy state list \\
  --resource-group myRG \\
  --filter "complianceState eq 'NonCompliant'" \\
  --query "[].{Resource:resourceId,Policy:policyDefinitionName}" -o table

# List Management Groups
az account management-group list --output table

# Create a Management Group
az account management-group create \\
  --name "MG-Production" \\
  --display-name "Production Workloads"

# Move a subscription into a Management Group
az account management-group subscription add \\
  --name "MG-Production" \\
  --subscription <subscription-id>
\`\`\`

## Custom Policy Example

### Require a Tag on Resources
\`\`\`json
{
  "mode": "Indexed",
  "policyRule": {
    "if": {
      "field": "tags[Environment]",
      "exists": "false"
    },
    "then": {
      "effect": "deny"
    }
  },
  "parameters": {}
}
\`\`\`

### Inherit a Tag from the Resource Group (Modify)
\`\`\`json
{
  "mode": "Indexed",
  "policyRule": {
    "if": {
      "allOf": [
        {"field": "tags[CostCenter]", "exists": "false"},
        {"value": "[resourceGroup().tags['CostCenter']]", "exists": "true"}
      ]
    },
    "then": {
      "effect": "modify",
      "details": {
        "roleDefinitionIds": [
          "/providers/microsoft.authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c"
        ],
        "operations": [{
          "operation": "add",
          "field": "tags[CostCenter]",
          "value": "[resourceGroup().tags['CostCenter']]"
        }]
      }
    }
  }
}
\`\`\`

## Common Mistakes

1. **Policy does not evaluate existing resources immediately**: it can take up to 30 minutes for the initial evaluation.
2. **DeployIfNotExists without a Managed Identity**: this effect requires a Managed Identity on the assignment to run remediations.
3. **Confusing Audit with Deny**: Audit logs non-compliance, it does not block. Deny blocks.
4. **Assignment scope too narrow**: a policy assigned on the RG does not affect other RGs in the same subscription.
5. **Mode: All vs Indexed**: "All" evaluates every resource type (including RGs); "Indexed" evaluates only resources that support tags and location.

## Killer.sh Style Challenge

> **Scenario**: The company requires:
> 1. All new resources must be created only in "East US" or "West Europe"
> 2. Every Resource Group must mandatorily have the "CostCenter" tag
> 3. If an RG does not have the "Environment" tag, the tag must be inherited automatically from the subscription
> 4. All requirements must apply to 3 different subscriptions in a centralized way
>
> **Describe the solution with Azure Policy and Management Groups.**
>
> **Answer**: Create a parent Management Group of the 3 subscriptions → Create 3 policy definitions (Deny for locations, Deny for CostCenter, Modify to inherit Environment) → Group them into a Policy Initiative → Assign the Initiative at the Management Group (inherits to all 3 subs). For Modify, create a Managed Identity with Contributor permission on the subs.
`,

  quiz: [
    {
      question: 'Which Azure Policy effect should be used to BLOCK the creation of resources that violate a rule?',
      options: [
        'Audit',
        'Deny',
        'AuditIfNotExists',
        'DeployIfNotExists'
      ],
      correct: 1,
      explanation: 'Deny completely blocks the operation that violates the policy, returning an error to the user. Audit only logs the non-compliance without blocking. AuditIfNotExists audits whether a related resource does not exist. DeployIfNotExists is for automatic remediation.',
      reference: 'Memorize the 4 main effects: Deny (blocks), Audit (logs), DeployIfNotExists (auto-deploy), Modify (changes tags/props).'
    },
    {
      question: 'A company wants to ensure all new VMs automatically get a "CostCenter" tag inherited from the Resource Group, without blocking creation. Which effect should it use?',
      options: [
        'Deny',
        'Append',
        'Modify',
        'AuditIfNotExists'
      ],
      correct: 2,
      explanation: 'Modify changes properties (including tags) of resources during creation or update without blocking the operation. It is the correct effect for automatic tag inheritance. Append only adds fields but does not modify existing ones. Deny would block creation.',
      reference: 'Modify vs Append: Modify can change existing values; Append only adds (does not overwrite).'
    },
    {
      question: 'What is the correct Management Groups hierarchy in Azure?',
      options: [
        'Subscription → Management Group → Resource Group → Resource',
        'Root Management Group → Management Groups → Subscriptions → Resource Groups',
        'Tenant → Subscription → Management Group → Resource Group',
        'Management Group → Resource Group → Subscription → Resource'
      ],
      correct: 1,
      explanation: 'The correct hierarchy is: Root Management Group (automatic per tenant) → Management Groups (up to 6 levels) → Subscriptions → Resource Groups → Resources. Management Groups organize subscriptions, not resource groups directly.',
      reference: 'Management Groups are for multi-subscription governance — policies and RBAC assigned here inherit to all child subscriptions.'
    },
    {
      question: 'An Azure Policy with the "DeployIfNotExists" effect is configured to create a Log Analytics Workspace automatically when a VM is created without one. What is mandatory in the Policy Assignment for this to work?',
      options: [
        'A Custom Role with write permissions',
        'A Managed Identity assigned to the policy assignment',
        'A manual approval from the global administrator',
        'A Policy Initiative with at least 3 policies'
      ],
      correct: 1,
      explanation: 'Effects that modify resources (DeployIfNotExists and Modify) need a Managed Identity assigned to the policy assignment to perform the operations. That identity must have the appropriate permissions (typically Contributor) on the scope.',
      reference: 'DeployIfNotExists and Modify = always require a Managed Identity on the assignment for remediation.'
    },
    {
      question: 'What is the difference between a Policy Definition and a Policy Initiative?',
      options: [
        'A Policy Definition is for auditing; a Policy Initiative is for deny',
        'A Policy Definition is a single rule; a Policy Initiative is a set of multiple grouped Policy Definitions',
        'A Policy Definition is applied per user; a Policy Initiative is applied per resource',
        'There is no difference, they are synonyms'
      ],
      correct: 1,
      explanation: 'A Policy Definition is a single rule (one condition and one effect). A Policy Initiative (Policy Set) is a collection of multiple Policy Definitions grouped for a common goal. For example, the "CIS Microsoft Azure Foundations Benchmark" initiative contains dozens of individual policies.',
      reference: 'Use initiatives to apply multiple policies at once — e.g. compliance standards like NIST, PCI-DSS, ISO 27001.'
    },
    {
      question: 'You assigned an Azure Policy with the "Deny" effect on a Resource Group. An existing resource in the RG violates the policy. What happens?',
      options: [
        'The resource is automatically deleted',
        'The resource is marked as "Non-compliant" but is not changed',
        'The resource is blocked and no one can access it',
        'The resource is automatically fixed by Azure'
      ],
      correct: 1,
      explanation: 'Policies with the Deny effect affect only new operations (create/update). EXISTING resources that violate the policy get marked as "Non-compliant" in the compliance dashboard, but they are not changed or removed. To remediate existing resources, use DeployIfNotExists or Modify with remediation tasks.',
      reference: 'Deny is not retroactive. To remediate existing ones: DeployIfNotExists + Remediation Task or manual scripts.'
    },
    {
      question: 'An organization has 5 subscriptions and wants to apply the same compliance policies to all of them. Which approach is most efficient?',
      options: [
        'Assign the policies individually in each subscription',
        'Create Management Groups and assign the policies at the parent Management Group',
        'Create a master subscription and link the others to it',
        'Use Azure Blueprints instead of Azure Policy'
      ],
      correct: 1,
      explanation: 'Assigning policies at Management Groups is the correct approach for centralized management of multiple subscriptions. The policy automatically inherits to all child subscriptions. Assigning individually in each subscription is manual and prone to inconsistencies.',
      reference: 'Management Groups = governance at scale. One assignment on the parent MG applies to all child subscriptions.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 5 main Azure Policy effects and when to use each?',
      back: '1. **Deny** — blocks creation/modification of non-compliant resources\n2. **Audit** — logs non-compliance without blocking (visibility)\n3. **DeployIfNotExists** — deploys a related resource automatically on creation\n4. **Modify** — adds/changes tags and properties during creation/update\n5. **AuditIfNotExists** — audits whether a related resource (such as diagnostics) does not exist\n\nDeny and Modify/DeployIfNotExists that make changes require a Managed Identity.'
    },
    {
      front: 'What is a Policy Initiative (Policy Set)?',
      back: 'A collection of multiple **Policy Definitions** grouped for a common compliance goal.\n\nExamples: CIS Benchmark, PCI-DSS, NIST SP 800-53, ISO 27001\n\nAdvantage: assigning an initiative = assigning all the policies inside it at once. Lets you apply complete compliance frameworks with a single assignment.'
    },
    {
      front: 'What is the difference between Exclusion and Exemption in Azure Policy?',
      back: '**Exclusion** (in the policy assignment):\n- Permanent\n- Excludes an entire scope from evaluation\n- Configured at assignment time\n\n**Exemption** (separate resource):\n- Temporary (with an expiration date)\n- Requires justification (category: Waiver or Mitigated)\n- A specific resource excluded even within a scope that has a policy\n- Requires the \`Microsoft.Authorization/policyExemptions/write\` permission'
    },
    {
      front: 'Which Mode to use in Policy Definitions? "All" vs "Indexed"',
      back: '**mode: "All"** — evaluates all resource types, including Resource Groups and Subscriptions. Use when the policy applies to RGs.\n\n**mode: "Indexed"** — evaluates only resources that support tags and location (VMs, Storage, etc.). Ignores RGs and resources without those properties.\n\nRule: if the condition uses \`tags\` or \`location\` on resources (not RGs), use "Indexed". If it involves RGs, use "All".'
    },
    {
      front: 'How does inheritance work in Management Groups?',
      back: 'Policies and RBAC assigned at a **Management Group inherit downward** in the hierarchy:\n\n``\`\nMG-Corp (policy Deny non-EU locations)\n  └─ Subscription-Prod ← inherits the policy\n       └─ RG-Backend ← inherits the policy\n            └─ VM-App ← inherits the policy\n\```\n\nAn assignment on MG-Corp affects ALL subscriptions, RGs and resources below it. Limit: 6 levels of MGs below the Root.'
    },
    {
      front: 'Does a "Deny" policy affect existing resources that already violate the rule?',
      back: '**No.** The **Deny** effect is prospective — it affects only new creations and updates.\n\nExisting non-compliant resources get marked as **Non-Compliant** in the compliance dashboard, but they are not removed or blocked.\n\nTo remediate existing ones: use **DeployIfNotExists** or **Modify** + create a **Remediation Task** in the portal.'
    }
  ],

  lab: {
    scenario: 'The company TechNova needs to ensure all Azure resources follow governance policies: only approved locations, mandatory tags and compliance visibility.',
    objective: 'Create and assign custom and built-in Azure Policies, check compliance and create Management Groups for organization.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create a Resource Group and explore built-in policies',
        instruction: `Create the RG \`rg-policy-lab\` and explore Azure built-in policies related to tags and locations.`,
        hints: [
          '\`az policy definition list\` with OData filters to find policies',
          'The "Require a tag on resource groups" policy has a built-in ID to inspect'
        ],
        solution: `\`\`\`bash
az group create --name rg-policy-lab --location eastus

# List policies related to tags
az policy definition list \\
  --query "[?contains(displayName,'tag') && policyType=='BuiltIn'].{Name:displayName,ID:name}" \\
  -o table | head -10

# List location policies
az policy definition list \\
  --query "[?contains(displayName,'location') && policyType=='BuiltIn'].{Name:displayName,ID:name}" \\
  -o table | head -10

# View details of the "Allowed locations" policy
az policy definition show \\
  --name "e56962a6-4747-49cd-b67b-bf8b01975c4f" \\
  --query "{Name:displayName,Effect:policyRule.then.effect,Parameters:parameters}" \\
  -o json
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-policy-lab --query "properties.provisioningState" -o tsv
# Expected output: Succeeded
\`\`\``
      },
      {
        title: 'Create a custom policy to require the CostCenter tag',
        instruction: `Create a custom policy definition that requires the \`CostCenter\` tag on all Resource Groups and assign it to the current subscription in **Audit** mode (don't block, just log).`,
        hints: [
          'Save the policy rule JSON in a temporary file',
          'Use the "Audit" effect to avoid blocking existing resources',
          'The policy must have \`"mode": "All"\` to evaluate RGs'
        ],
        solution: `\`\`\`bash
# Create the policy rule file
cat > /tmp/require-costcenter-rule.json << 'EOF'
{
  "mode": "All",
  "policyRule": {
    "if": {
      "allOf": [
        {
          "field": "type",
          "equals": "Microsoft.Resources/subscriptions/resourceGroups"
        },
        {
          "field": "tags[CostCenter]",
          "exists": "false"
        }
      ]
    },
    "then": {
      "effect": "Audit"
    }
  },
  "parameters": {}
}
EOF

# Create the policy definition
az policy definition create \\
  --name "audit-require-costcenter-rg" \\
  --display-name "[TechNova] Audit: RGs must have CostCenter tag" \\
  --description "Audits Resource Groups without the CostCenter tag" \\
  --rules /tmp/require-costcenter-rule.json \\
  --mode All

# Get the subscription ID and assign the policy
SUB_ID=$(az account show --query id -o tsv)
az policy assignment create \\
  --name "audit-costcenter-sub" \\
  --display-name "[TechNova] Audit CostCenter on RGs" \\
  --policy "audit-require-costcenter-rg" \\
  --scope /subscriptions/$SUB_ID
\`\`\``,
        verify: `\`\`\`bash
# Verify the policy definition was created
az policy definition show --name "audit-require-costcenter-rg" \\
  --query "{Name:displayName,Effect:policyRule.then.effect}" -o table
# Expected output: [TechNova] Audit: RGs must have CostCenter tag | Audit

# Verify the assignment was created
az policy assignment show --name "audit-costcenter-sub" \\
  --scope /subscriptions/$(az account show --query id -o tsv) \\
  --query "{Name:displayName,Scope:scope}" -o table
\`\`\``
      },
      {
        title: 'Check compliance and clean up resources',
        instruction: `Wait for the compliance evaluation and check which RGs are non-compliant (no CostCenter tag). Then remove the policy and the lab RG.`,
        hints: [
          '\`az policy state list\` shows the compliance state',
          'The initial evaluation can take up to 30 min — use \`--filter\` to filter by Non-Compliant'
        ],
        solution: `\`\`\`bash
SUB_ID=$(az account show --query id -o tsv)

# Check compliance state (may take a few minutes to populate)
echo "Checking compliance..."
az policy state list \\
  --policy-assignment "audit-costcenter-sub" \\
  --query "[].{Resource:resourceId,State:complianceState}" \\
  -o table 2>/dev/null || echo "Waiting for the initial evaluation (may take up to 30 minutes)..."

# Force an immediate evaluation (if available)
az policy state trigger-scan --resource-group rg-policy-lab 2>/dev/null || true

# Cleanup: remove the assignment and policy definition
az policy assignment delete \\
  --name "audit-costcenter-sub" \\
  --scope /subscriptions/$SUB_ID

az policy definition delete --name "audit-require-costcenter-rg"

# Remove the Resource Group
az group delete --name rg-policy-lab --yes --no-wait

echo "Cleanup complete!"
\`\`\``,
        verify: `\`\`\`bash
# Verify the assignment was removed
az policy assignment list \\
  --scope /subscriptions/$(az account show --query id -o tsv) \\
  --query "[?name=='audit-costcenter-sub'].name" -o tsv
# Expected output: (empty)

# Verify the policy definition was removed
az policy definition list --custom-role-only false \\
  --query "[?name=='audit-require-costcenter-rg'].name" -o tsv 2>/dev/null || echo "Policy removed"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Deny policy is not blocking non-compliant resources',
      difficulty: 'easy',
      symptom: 'A policy with the Deny effect was created to block resources without the "Environment" tag, but users can still create VMs without that tag.',
      diagnosis: `\`\`\`bash
# Check whether the policy is assigned (the assignment exists)
az policy assignment list --all \\
  --query "[].{Name:displayName,Scope:scope,Policy:policyDefinitionId}" -o table

# Check the assignment scope vs where the resources are being created
# The RG where they create must be within the policy scope

# Check whether there is an exemption on the resource
az policy exemption list --scope <resource-id>
\`\`\``,
      solution: `**Possible causes:**

1. **Policy assigned at the wrong scope**: If the assignment is on \`rg-A\` but the user creates in \`rg-B\`, the policy does not apply. Check the scope and adjust to the subscription if needed.

2. **Incorrect mode**: A policy with mode "Indexed" does not evaluate RGs. If the condition is about tags on RGs, use mode "All".

3. **Active exemption**: Check whether an exemption exists on the resource or RG.

4. **Effect is "Audit" and not "Deny"**: Confirm the effect in the policy definition.

5. **Cache/propagation**: It can take up to 30 minutes after policy creation before it starts being evaluated.`
    },
    {
      title: 'DeployIfNotExists is not creating resources automatically',
      difficulty: 'hard',
      symptom: 'A policy with the DeployIfNotExists effect should create a Log Analytics Workspace when a VM is created without diagnostics configured. But the workspaces are not being created.',
      diagnosis: `\`\`\`bash
# Check whether the policy assignment has a Managed Identity configured
az policy assignment show --name <assignment-name> \\
  --query "{Identity:identity,Scope:scope}" -o json

# Check the role assignments of the assignment's Managed Identity
POLICY_IDENTITY=$(az policy assignment show --name <assignment-name> \\
  --query "identity.principalId" -o tsv)
az role assignment list --assignee $POLICY_IDENTITY --all -o table

# Check existing remediation tasks
az policy remediation list --policy-assignment <assignment-id> -o table
\`\`\``,
      solution: `**Cause**: \`DeployIfNotExists\` requires a **Managed Identity** on the assignment with **appropriate permissions** to create resources.

**Solution:**
1. Recreate the assignment with a Managed Identity:
\`\`\`bash
az policy assignment create \\
  --name <assignment-name> \\
  --policy <policy-definition-id> \\
  --scope <scope> \\
  --assign-identity \\
  --location eastus \\
  --identity-scope <scope>  # scope where the MI will have permissions
\`\`\`
2. Assign an appropriate role to the assignment's Managed Identity:
\`\`\`bash
az role assignment create \\
  --assignee-object-id <managed-identity-principal-id> \\
  --role "Contributor" \\
  --scope <scope>
\`\`\`
3. Create a Remediation Task to remediate EXISTING non-compliant resources:
\`\`\`bash
az policy remediation create \\
  --name "remediate-diagnostics" \\
  --policy-assignment <assignment-id> \\
  --resource-discovery-mode ReEvaluateCompliance
\`\`\``
    }
  ]
};
