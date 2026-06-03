window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-identity/azure-rbac'] = {
  theory: `# Azure RBAC — Role-Based Access Control

## Exam Relevance
> Appears across **every domain** of AZ-104. Knowing how to grant, revoke and verify access correctly is indispensable. Estimated weight: 10-15% of direct questions, but present indirectly in almost everything.

## Core Concepts

### The Azure RBAC Model
Azure RBAC (Role-Based Access Control) controls **who can do what on which resources**. It is based on three elements:

\`\`\`
Security Principal → Role Definition → Scope
(WHO)               (WHAT)            (WHERE)
\`\`\`

**Security Principal**: user, group, service principal or managed identity that will receive the permission.

**Role Definition**: a set of permissions. Defines allowed and denied operations (actions/notActions/dataActions/notDataActions).

**Scope**: the hierarchy where the permission applies:
\`\`\`
Management Group
  └─ Subscription
       └─ Resource Group
            └─ Resource
\`\`\`

> Permissions **inherit downward**: a role assigned at the Subscription level applies to all Resource Groups and Resources within it.

### Built-in Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full control + can manage others' access |
| **Contributor** | Full control of resources, but **CANNOT** manage access |
| **Reader** | Read-only access |
| **User Access Administrator** | Manages others' access, but does not manage resources |

Besides these fundamentals, there are hundreds of specialized roles:
- **Storage Blob Data Contributor** — read/write on blobs
- **Key Vault Secrets User** — read Key Vault secrets
- **Monitoring Reader** — read monitoring data
- **AcrPull** — pull images from Azure Container Registry
- etc.

### Owner vs User Access Administrator

| | Owner | User Access Administrator |
|-|-------|--------------------------|
| Manage resources | ✅ | ❌ |
| Assign roles to others | ✅ | ✅ |

Use **User Access Administrator** when someone needs to manage access without having control over resources.

### Custom Roles
When built-in roles don't fit, you can create **Custom Roles**:
- Define exactly which \`actions\` and \`dataActions\` are allowed
- Specify \`notActions\` to exclude specific operations
- Define \`assignableScopes\` (subscriptions/management groups where the role can be assigned)

\`\`\`json
{
  "Name": "VM Operator",
  "Description": "Can start and stop VMs but not create or delete",
  "Actions": [
    "Microsoft.Compute/virtualMachines/start/action",
    "Microsoft.Compute/virtualMachines/deallocate/action",
    "Microsoft.Compute/virtualMachines/read"
  ],
  "NotActions": [],
  "DataActions": [],
  "NotDataActions": [],
  "AssignableScopes": [
    "/subscriptions/<subscription-id>"
  ]
}
\`\`\`

### Deny Assignments
- By default, **no permission = access denied** ("deny by default" model)
- Deny Assignments explicitly block actions even if a role allows them
- Mainly used by Azure Blueprints and Managed Applications
- **Regular users do not create Deny Assignments** — they are created automatically by the system

### Checking Effective Access
A user's **effective access** is the **combination of all role assignments** across every level of the hierarchy, minus any deny assignment.

To check: Portal → resource IAM → "Check access" → select the user.

## Essential Commands (Azure CLI)

\`\`\`bash
# List available roles
az role definition list --output table

# Search for a specific role
az role definition list --name "Contributor" --output json

# List all assignments in a subscription
az role assignment list --all --output table

# Assign a role to a user on a Resource Group
az role assignment create \\
  --assignee user@contoso.com \\
  --role "Contributor" \\
  --resource-group MyResourceGroup

# Assign a role to a group on a subscription
az role assignment create \\
  --assignee-object-id <group-object-id> \\
  --assignee-principal-type Group \\
  --role "Reader" \\
  --scope /subscriptions/<subscription-id>

# Assign a role to a Managed Identity on a resource
az role assignment create \\
  --assignee <managed-identity-client-id> \\
  --role "Storage Blob Data Reader" \\
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Storage/storageAccounts/<sa>

# List assignments for a specific user
az role assignment list --assignee user@contoso.com --all --output table

# Remove a role assignment
az role assignment delete \\
  --assignee user@contoso.com \\
  --role "Contributor" \\
  --resource-group MyResourceGroup

# Create a custom role from a JSON file
az role definition create --role-definition @custom-role.json

# List custom roles
az role definition list --custom-role-only true --output table

# Check a user's effective permissions
az role assignment list --assignee user@contoso.com --all \\
  --query "[].{Role:roleDefinitionName,Scope:scope}" --output table
\`\`\`

## Assignment Examples

### Example 1: Developer on the Resource Group
\`\`\`bash
# Developer can do everything in the dev RG but not manage access
az role assignment create \\
  --assignee dev@contoso.com \\
  --role "Contributor" \\
  --resource-group rg-dev-environment
\`\`\`

### Example 2: CI/CD Pipeline (Service Principal)
\`\`\`bash
# CI/CD Service Principal can deploy to the production RG
SP_ID=$(az ad sp show --id "my-pipeline-sp" --query appId -o tsv)
az role assignment create \\
  --assignee-object-id $SP_ID \\
  --assignee-principal-type ServicePrincipal \\
  --role "Contributor" \\
  --resource-group rg-production
\`\`\`

### Example 3: VM with Key Vault access
\`\`\`bash
# The VM's Managed Identity reads secrets from the Key Vault
VM_IDENTITY=$(az vm identity show --name myVM --resource-group myRG \\
  --query principalId -o tsv)

az role assignment create \\
  --assignee-object-id $VM_IDENTITY \\
  --assignee-principal-type ServicePrincipal \\
  --role "Key Vault Secrets User" \\
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/<kv>
\`\`\`

## Common Mistakes

1. **Contributor cannot assign roles**: Contributor lacks \`Microsoft.Authorization/roleAssignments/write\`. Needs Owner or User Access Administrator.
2. **Assignment does not propagate immediately**: It can take a few minutes to replicate globally in Azure AD.
3. **Wrong scope**: Assigning at a specific resource level when it should be on the Resource Group (or vice versa).
4. **Confusing classic roles (Classic Admin) with RBAC**: Account Administrator, Service Administrator and Co-Administrator are legacy roles. RBAC is the modern model and should be used.
5. **Custom role with incorrect AssignableScopes**: The role only appears for assignment in the scopes defined in AssignableScopes.

## Killer.sh Style Challenge

> **Scenario**: You need to configure the following:
> 1. The DevOps team (Entra ID group) must be able to create/modify/delete resources in \`rg-production\` but NOT manage access
> 2. The user \`audit@contoso.com\` must be able to view **all** subscription resources, but not modify anything
> 3. The VM \`app-server\` needs to read secrets from the Key Vault \`kv-app-secrets\` without using hardcoded credentials
>
> Configure the minimum RBAC needed for each case.
>
> **Answer**:
> 1. DevOps Group → Role: **Contributor** → Scope: \`rg-production\`
> 2. audit@ → Role: **Reader** → Scope: subscription (inherits to all RGs)
> 3. Enable a System-Assigned Managed Identity on the VM → assign **Key Vault Secrets User** to the VM's Principal ID on the Key Vault
`,

  quiz: [
    {
      question: 'Which built-in role lets a user create and manage all Azure resources in a subscription, but does NOT allow assigning roles to other users?',
      options: [
        'Owner',
        'Contributor',
        'User Access Administrator',
        'Reader'
      ],
      correct: 1,
      explanation: 'Contributor has full control over resources (create, modify, delete) but cannot manage access (lacks Microsoft.Authorization/roleAssignments/write). Owner has everything Contributor has PLUS the ability to manage access.',
      reference: 'Memorize: Owner = Contributor + access management. This distinction shows up a lot on the exam.'
    },
    {
      question: 'A user has "Contributor" on the Subscription and "Reader" on a specific Resource Group within that Subscription. What is their effective access on the Resource Group?',
      options: [
        'Reader — the most restrictive role wins',
        'Contributor — the most permissive role wins (inheritance)',
        'No access — conflicting roles cancel out',
        'Depends on the order in which they were assigned'
      ],
      correct: 1,
      explanation: 'In Azure RBAC, permissions are ADDITIVE. The user has Contributor inherited from the Subscription (which includes the RG) + Reader on the RG. The combination is Contributor (more permissive). Roles do not cancel out — they add up, except when there is a Deny Assignment.',
      reference: 'Golden rule: RBAC is additive (except Deny). More permissions = more access, never less.'
    },
    {
      question: 'What is the scope hierarchy in Azure RBAC, from broadest to most restrictive?',
      options: [
        'Subscription → Management Group → Resource Group → Resource',
        'Management Group → Subscription → Resource Group → Resource',
        'Resource Group → Resource → Subscription → Management Group',
        'Management Group → Resource Group → Subscription → Resource'
      ],
      correct: 1,
      explanation: 'The correct hierarchy is: Management Group (broadest) → Subscription → Resource Group → Resource (most restrictive). Permissions assigned at higher levels inherit to all lower levels.',
      reference: 'The scope hierarchy is fundamental to understanding permission inheritance — review the diagram in the theory.'
    },
    {
      question: 'A user needs to manage who has access to Azure resources across multiple subscriptions, but does not need to create or modify the resources themselves. Which role is most appropriate?',
      options: [
        'Owner on the subscription',
        'Contributor on the subscription',
        'User Access Administrator on the subscription',
        'Global Administrator in Entra ID'
      ],
      correct: 2,
      explanation: 'User Access Administrator is exactly for this: managing role assignments without having permission to manage the resources. Owner would also work, but it violates the principle of least privilege since it would grant full control over resources.',
      reference: 'Principle of least privilege: always choose the role that grants only what is necessary.'
    },
    {
      question: 'You created a Custom Role but it does not appear as an option when you try to assign it to a user on a Resource Group. What is the most likely cause?',
      options: [
        'Custom roles cannot be assigned at Resource Groups, only at Subscriptions',
        'The custom role\'s AssignableScopes field does not include the Resource Group\'s subscription',
        'You need to wait 24 hours for the custom role to become available',
        'Custom roles can only be assigned by the Global Administrator'
      ],
      correct: 1,
      explanation: 'Custom roles only appear for assignment in the scopes defined in AssignableScopes. If AssignableScopes contains only a specific subscription, the role will not appear in different subscriptions. Check and update the AssignableScopes field to include the required scope.',
      reference: 'When creating custom roles, always set AssignableScopes to cover all subscriptions where it will be used.'
    },
    {
      question: 'What is the difference between Actions and DataActions in an Azure RBAC Role Definition?',
      options: [
        'Actions control resources via the control-plane API (ARM); DataActions control operations on data inside resources',
        'Actions are for read permissions; DataActions are for write permissions',
        'Actions are for users; DataActions are for service principals',
        'There is no difference — they are synonyms in the documentation'
      ],
      correct: 0,
      explanation: 'Actions (and notActions) control control-plane operations — create, delete, configure resources via ARM. DataActions (and notDataActions) control data-plane operations — read/write blobs, Key Vault secrets, Service Bus messages, etc. A Storage Contributor can create storage accounts (Actions) but cannot read blobs (DataActions) without Storage Blob Data Contributor.',
      reference: 'Control plane (ARM) vs data plane: essential for storage and Key Vault roles.'
    },
    {
      question: 'An Azure VM needs to access an Azure Key Vault to read secrets, without storing credentials in code. What is the correct approach?',
      options: [
        'Create a Service Principal and store the clientId/secret in environment variables on the VM',
        'Use the subscription administrator account to authenticate',
        'Enable a Managed Identity on the VM and assign the "Key Vault Secrets User" role on the Key Vault',
        'Create a Key Vault SAS Token and store it on the VM storage'
      ],
      correct: 2,
      explanation: 'Managed Identity is the recommended "zero credentials" approach: Azure automatically manages the credential lifecycle. The VM authenticates using its own identity (system-assigned or user-assigned), and you grant the needed role via RBAC on the Key Vault. No credential is stored in code or on the VM.',
      reference: 'Recommended pattern: Managed Identity + RBAC = no secrets in code. Remember: Key Vault Secrets User for reads, Secrets Officer for management.'
    },
    {
      question: 'When assigning a role via \`az role assignment create\`, which parameter specifies the subscription, Resource Group or specific resource where the role applies?',
      options: [
        '--resource-group (the only parameter available)',
        '--scope',
        '--location',
        '--target'
      ],
      correct: 1,
      explanation: '\`--scope\` accepts the full ARM resource ID, which can be: \`/subscriptions/<id>\` for subscription, \`/subscriptions/<id>/resourceGroups/<rg>\` for an RG, or the full resource ID for a specific resource. The \`--resource-group\` parameter is a shortcut that internally expands to the RG scope.',
      reference: 'Scope format: always starts with /subscriptions/<sub-id>/ and can include more levels.'
    }
  ],

  flashcards: [
    {
      front: 'What is the Azure RBAC formula? What are the 3 components?',
      back: '**Security Principal** (who) + **Role Definition** (what) + **Scope** (where) = **Role Assignment**\n\n- Security Principal: user, group, service principal, managed identity\n- Role Definition: a set of allowed Actions/NotActions/DataActions\n- Scope: management group → subscription → resource group → resource'
    },
    {
      front: 'What is the difference between Owner, Contributor and User Access Administrator?',
      back: '| Role | Manages Resources | Manages Access |\n|------|-------------------|------------------|\n| **Owner** | ✅ | ✅ |\n| **Contributor** | ✅ | ❌ |\n| **Reader** | ❌ (read-only) | ❌ |\n| **User Access Admin** | ❌ | ✅ |'
    },
    {
      front: 'How do permissions work in Azure RBAC? Are they additive or does the most restrictive win?',
      back: 'Permissions are **ADDITIVE** — all role assignments across all scopes add up.\n\nException: **Deny Assignments** explicitly block actions even with permissive roles.\n\nThere is no "most restrictive role wins" — without a deny, more permissions = more access.'
    },
    {
      front: 'What are DataActions in a Role Definition? What is a practical example?',
      back: '**DataActions** control **data-plane** operations (inside the resource), not the control plane (ARM).\n\nExamples:\n- \`Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read\` — read blobs\n- \`Microsoft.KeyVault/vaults/secrets/getSecret/action\` — read secrets\n\nThe "Storage Contributor" role can create storage accounts (Actions) but cannot read blobs (DataActions) — that requires "Storage Blob Data Contributor".'
    },
    {
      front: 'What are the steps to create and assign a Custom Role in Azure?',
      back: '1. Create a JSON file with: Name, Description, Actions, NotActions, DataActions, AssignableScopes\n2. \`az role definition create --role-definition @custom-role.json\`\n3. Assign: \`az role assignment create --assignee ... --role "Role Name" --scope ...\`\n\nLimit: maximum **5000 custom roles** per tenant.'
    },
    {
      front: 'Which command lists all role assignments of a user across all subscriptions?',
      back: '``\`bash\naz role assignment list \\\n  --assignee user@contoso.com \\\n  --all \\\n  --query "[].{Role:roleDefinitionName,Scope:scope}" \\\n  --output table\n\``\`\n\nWithout \`--all\`, it only shows the current subscription.'
    },
    {
      front: 'What is a Deny Assignment and who can create one?',
      back: '**Deny Assignment** explicitly blocks specific actions for a security principal, even when a role allows them.\n\nCharacteristics:\n- Overrides permissive role assignments\n- Created automatically by: Azure Blueprints, Managed Applications\n- **Regular users and administrators CANNOT create** deny assignments directly\n- Can be viewed via portal or API but not created by the user'
    }
  ],

  lab: {
    scenario: 'Configure granular access control for the startup TechNova: the DevOps team needs operational access, auditors need read-only, and a VM needs to access a Storage Account securely.',
    objective: 'Create and manage Role Assignments in Azure RBAC at different scopes, validate the principle of least privilege and configure a Managed Identity for credential-free access.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create a Resource Group and check current permissions',
        instruction: `Create a Resource Group named \`rg-lab-rbac\` and check which roles are assigned in your current subscription.`,
        hints: [
          'Use \`az group create\` for the RG',
          '\`az role assignment list --all\` lists everything in the subscription'
        ],
        solution: `\`\`\`bash
# Create the Resource Group
az group create \\
  --name rg-lab-rbac \\
  --location eastus

# Check your current subscription
az account show --query "{Name:name,ID:id,Tenant:tenantId}" -o table

# View all role assignments in the subscription
az role assignment list --all \\
  --query "[].{Principal:principalName,Role:roleDefinitionName,Scope:scope}" \\
  -o table
\`\`\``,
        verify: `\`\`\`bash
# Verify the RG was created
az group show --name rg-lab-rbac --query "{Name:name,Location:location,State:properties.provisioningState}" -o table
# Expected output:
# Name          Location   State
# ------------  ---------  ---------
# rg-lab-rbac   eastus     Succeeded
\`\`\``
      },
      {
        title: 'Assign roles at different scopes',
        instruction: `Simulate role assignments following the principle of least privilege:
- Assign **Reader** on the subscription to an audit group
- Assign **Contributor** on the Resource Group to a DevOps team
- Observe that the audit group inherits Reader to the RG via inheritance`,
        hints: [
          'For this lab use your own user or an existing group as the assignee',
          'Use \`az account show --query id -o tsv\` to get the subscription ID',
          'Subscription scope: \`/subscriptions/<id>\`'
        ],
        solution: `\`\`\`bash
# Get the subscription ID
SUB_ID=$(az account show --query id -o tsv)
echo "Subscription ID: $SUB_ID"

# Get your own Object ID (for testing)
MY_ID=$(az ad signed-in-user show --query id -o tsv)
echo "My Object ID: $MY_ID"

# Assign Reader on the subscription (inherits to all RGs)
# Note: In a real lab, use a different group/user
az role assignment create \\
  --assignee-object-id $MY_ID \\
  --assignee-principal-type User \\
  --role "Reader" \\
  --scope /subscriptions/$SUB_ID

# Verify the assignment was created
az role assignment list \\
  --assignee-object-id $MY_ID \\
  --scope /subscriptions/$SUB_ID \\
  --query "[].{Role:roleDefinitionName,Scope:scope}" -o table
\`\`\``,
        verify: `\`\`\`bash
# Verify Reader was assigned on the subscription
SUB_ID=$(az account show --query id -o tsv)
MY_ID=$(az ad signed-in-user show --query id -o tsv)

az role assignment list \\
  --assignee-object-id $MY_ID \\
  --scope /subscriptions/$SUB_ID \\
  --query "[?roleDefinitionName=='Reader'].roleDefinitionName" -o tsv
# Expected output: Reader
\`\`\``
      },
      {
        title: 'List and verify effective permissions',
        instruction: `List all role assignments of your user across all scopes and verify the effective access on the created Resource Group.`,
        hints: [
          '\`az role assignment list --assignee <id> --all\` shows all scopes',
          'Use \`--include-inherited\` to see inherited assignments'
        ],
        solution: `\`\`\`bash
MY_ID=$(az ad signed-in-user show --query id -o tsv)

# List ALL of the user's assignments (every scope)
echo "=== All Role Assignments ==="
az role assignment list --assignee-object-id $MY_ID --all \\
  --query "[].{Role:roleDefinitionName,Scope:scope}" -o table

# See assignments specific to the RG (including inherited)
SUB_ID=$(az account show --query id -o tsv)
echo "=== Assignments on the Resource Group (including inherited) ==="
az role assignment list \\
  --assignee-object-id $MY_ID \\
  --resource-group rg-lab-rbac \\
  --include-inherited \\
  --query "[].{Role:roleDefinitionName,Scope:scope,Inherited:roleAssignmentName}" -o table
\`\`\``,
        verify: `\`\`\`bash
MY_ID=$(az ad signed-in-user show --query id -o tsv)
# Reader inherited from the subscription should appear on the RG
az role assignment list \\
  --assignee-object-id $MY_ID \\
  --resource-group rg-lab-rbac \\
  --include-inherited \\
  --query "length([?roleDefinitionName=='Reader'])" -o tsv
# Expected output: 1 (or more, depending on other assignments)
\`\`\``
      },
      {
        title: 'Remove assignments and clean up resources',
        instruction: `Remove the role assignments you created and delete the Resource Group.`,
        hints: [
          '\`az role assignment delete\` with the same parameters as create',
          '\`az group delete --no-wait\` deletes the RG asynchronously'
        ],
        solution: `\`\`\`bash
MY_ID=$(az ad signed-in-user show --query id -o tsv)
SUB_ID=$(az account show --query id -o tsv)

# Remove Reader from the subscription
az role assignment delete \\
  --assignee-object-id $MY_ID \\
  --role "Reader" \\
  --scope /subscriptions/$SUB_ID

# Delete the Resource Group (and all resources inside)
az group delete --name rg-lab-rbac --yes --no-wait

echo "Cleanup started!"
\`\`\``,
        verify: `\`\`\`bash
MY_ID=$(az ad signed-in-user show --query id -o tsv)
SUB_ID=$(az account show --query id -o tsv)

# Verify Reader was removed
az role assignment list \\
  --assignee-object-id $MY_ID \\
  --scope /subscriptions/$SUB_ID \\
  --query "[?roleDefinitionName=='Reader'].roleDefinitionName" -o tsv
# Expected output: (empty)

# Verify the RG is being deleted
az group show --name rg-lab-rbac --query "properties.provisioningState" -o tsv 2>/dev/null || echo "RG deleted successfully"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'User gets "AuthorizationFailed" when trying to create a resource',
      difficulty: 'easy',
      symptom: 'A developer gets the error "The client does not have authorization to perform action Microsoft.Compute/virtualMachines/write" when trying to create a VM in the Azure portal.',
      diagnosis: `\`\`\`bash
# Check which roles the user has
az role assignment list \\
  --assignee user@contoso.com \\
  --all \\
  --query "[].{Role:roleDefinitionName,Scope:scope}" -o table

# Check whether the scope includes the Resource Group where they are trying to create
az group show --name <resource-group> --query id -o tsv
\`\`\``,
      solution: `**Cause**: The user does not have the appropriate role at the correct scope.

**Solutions in order of investigation:**
1. Check whether they have Contributor or Owner on the RG (or parent subscription)
2. If they only have Reader, assign Contributor on the RG:
\`\`\`bash
az role assignment create \\
  --assignee user@contoso.com \\
  --role "Contributor" \\
  --resource-group <rg-name>
\`\`\`
3. Wait a few minutes for the permission to propagate
4. Ask the user to log out and log back in (cached tokens)`
    },
    {
      title: 'Service Principal cannot deploy even with Contributor',
      difficulty: 'medium',
      symptom: 'A CI/CD pipeline fails to create resources. The Service Principal has "Contributor" on the Resource Group, but gets authorization errors when trying to register new Resource Providers (e.g., Microsoft.ContainerRegistry).',
      diagnosis: `\`\`\`bash
# Check the SP's role assignments
SP_ID=$(az ad sp show --id <client-id> --query id -o tsv)
az role assignment list --assignee-object-id $SP_ID --all -o table

# Check resource providers registered in the subscription
az provider show --namespace Microsoft.ContainerRegistry \\
  --query "{State:registrationState}" -o table

# Contributor on the RG CANNOT register providers
# This requires permission on the subscription
az provider list --query "[?registrationState=='NotRegistered'].namespace" -o tsv | head -10
\`\`\``,
      solution: `**Cause**: Registering Resource Providers requires the \`Microsoft.*/register/action\` permission on the **Subscription**, not just on the Resource Group. Contributor on the RG does not inherit that power.

**Solutions:**
1. **Pre-register the provider** (recommended): An admin registers the provider once on the subscription:
\`\`\`bash
az provider register --namespace Microsoft.ContainerRegistry --wait
\`\`\`
2. **Assign Contributor on the Subscription** to the SP (broader, less secure)
3. **Create a Custom Role** with only \`Microsoft.ContainerRegistry/register/action\` on the subscription + Contributor on the RG (least privilege)

**Best practice**: Pre-register all required providers before granting pipeline access.`
    }
  ]
};
