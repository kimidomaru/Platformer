window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-identity/entra-id'] = {
  theory: `# Microsoft Entra ID (Azure Active Directory)

## Exam Relevance
> A domain carrying **15-20% of the weight** on AZ-104. Every question about authentication, users, groups and licensing routes through here. Practically mandatory to get right.

## Core Concepts

### What is Microsoft Entra ID?
**Microsoft Entra ID** (formerly Azure Active Directory / Azure AD) is Microsoft's **cloud-based identity and access** service. It manages:
- Users and groups
- Authentication and authorization
- Single Sign-On (SSO) for SaaS apps
- Conditional access and MFA
- Synchronization with on-premises Active Directory (via Entra ID Connect)

### Tenant
A **tenant** is a dedicated and isolated instance of Entra ID that an organization receives when it signs up for Microsoft Cloud services. Each tenant has a default domain \`<name>.onmicrosoft.com\`.

- One organization = one tenant (usually)
- A tenant can have multiple Azure **subscriptions**
- Identities live in the tenant, not in the subscription

### Identity Types

| Type | Description |
|------|-------------|
| **Member user** | Native tenant user (created in Entra ID) |
| **Guest user** | External user invited via B2B (external email) |
| **Service Principal** | Application/service identity |
| **Managed Identity** | Service principal automatically managed by Azure |

### Entra ID Licenses

| Plan | Key features |
|------|--------------|
| **Free** | Basic users, SSO, basic MFA |
| **P1** | Conditional Access, Dynamic Groups, SSPR, Hybrid join |
| **P2** | PIM (Privileged Identity Management), Identity Protection, Access Reviews |

### Groups

**Membership types:**
- **Assigned**: members added manually
- **Dynamic User**: rule based on user attributes (\`department eq "IT"\`)
- **Dynamic Device**: rule based on device attributes

**Group types:**
- **Security Group**: for controlling access to resources
- **Microsoft 365 Group**: collaboration (Teams, SharePoint, Exchange)

### Multi-Factor Authentication (MFA)
- Configured via **Conditional Access** (P1/P2) or **Security Defaults** (free)
- Methods: Authenticator App, TOTP, SMS, phone call, FIDO2 key
- **Per-user MFA** (legacy): enable per individual user
- **Security Defaults**: enables MFA for everyone, blocks legacy protocols

### Self-Service Password Reset (SSPR)
Requires **P1** license or higher. Lets users reset passwords without the helpdesk. You configure the number of authentication methods required (1 or 2).

### Entra ID Connect (on-prem → cloud sync)
Synchronizes users/groups from local Active Directory to Entra ID:
- **Password Hash Sync (PHS)**: password hash synced (simplest, recommended)
- **Pass-through Authentication (PTA)**: authentication validated on-premises in real time
- **Federation (AD FS)**: authentication delegated to local AD FS

## Essential Commands (Azure CLI)

\`\`\`bash
# Login to Azure
az login

# List Entra ID users
az ad user list --output table

# Create a user
az ad user create \\
  --display-name "John Smith" \\
  --user-principal-name john.smith@contoso.onmicrosoft.com \\
  --password "P@ssword123!" \\
  --force-change-password-next-sign-in true

# Update user attributes
az ad user update \\
  --id john.smith@contoso.onmicrosoft.com \\
  --department "Engineering" \\
  --job-title "SRE"

# Delete user (goes to recycle bin for 30 days)
az ad user delete --id john.smith@contoso.onmicrosoft.com

# List groups
az ad group list --output table

# Create a security group
az ad group create \\
  --display-name "DevOps-Team" \\
  --mail-nickname "devops-team"

# Add a member to the group
az ad group member add \\
  --group "DevOps-Team" \\
  --member-id <user-object-id>

# Check group members
az ad group member list --group "DevOps-Team" --output table

# List service principals
az ad sp list --display-name "my-app" --output table

# Create a service principal (app registration)
az ad sp create-for-rbac --name "my-app-sp" --skip-assignment

# List guest users (B2B type)
az ad user list --filter "userType eq 'Guest'" --output table
\`\`\`

## Configuration Examples

### Dynamic Group via Portal
\`\`\`
Entra ID → Groups → New Group
Group type: Security
Membership type: Dynamic User
Dynamic query:
  Property: department
  Operator: Equals
  Value: Engineering
\`\`\`

### Conditional Access Policy (requires P1)
\`\`\`
Entra ID → Security → Conditional Access → New Policy
Name: Require MFA for Admins
Assignments:
  Users: Directory Roles → Global Administrator
  Cloud apps: All cloud apps
Conditions: (no conditions = always)
Grant: Grant access → Require multi-factor authentication
\`\`\`

## Common Mistakes

1. **Dynamic group without P1 license**: dynamic groups require Entra ID P1
2. **Guest user can't access**: check External Collaboration Settings and B2B access policies
3. **Deleted user**: stays in the recycle bin for **30 days** — recoverable via "Deleted users"
4. **SSPR not working**: check that the P1 license is assigned and SSPR is enabled
5. **Sync fails**: a user created on-premises doesn't appear in the cloud — check Entra ID Connect and required attributes

## Killer.sh Style Challenge

> **Scenario**: The company has 500 users in on-premises Active Directory. The IT department needs to:
> 1. Sync users to Entra ID using Password Hash Sync
> 2. Create a dynamic security group that automatically includes everyone with \`department = "Finance"\`
> 3. Require MFA for all Finance group users when accessing the Azure portal
> 4. Configure SSPR so users can reset passwords with 2 verification methods
>
> **Which licenses are required? Which steps and in what order?**
>
> **Expected answer**: Entra ID P1 license for dynamic groups, SSPR and Conditional Access. Order: install Entra ID Connect with PHS → create the Finance dynamic group → create a Conditional Access policy (target: Finance group, grant: require MFA) → enable SSPR with minimum methods = 2.
`,

  quiz: [
    {
      question: 'What is the difference between a "Member user" and a "Guest user" in Microsoft Entra ID?',
      options: [
        'Member users are internal to the tenant; Guest users are external, invited via B2B',
        'Member users have access only to applications; Guest users have administrative access',
        'Member users are synced from on-prem AD; Guest users are created in the Azure portal',
        'There is no practical difference, just different naming'
      ],
      correct: 0,
      explanation: 'Member users are native tenant identities (created in Entra ID or synced via Connect). Guest users are external identities invited via Azure AD B2B — they keep their own home identity and get limited access to the tenant.',
      reference: 'Related concept: Azure RBAC — see how permissions differ between Members and Guests.'
    },
    {
      question: 'A company wants all users in the "Finance" department to be automatically added to a security group. Which group type should be created?',
      options: [
        'Security Group with Assigned membership',
        'Security Group with Dynamic User membership',
        'Microsoft 365 Group with Dynamic User membership',
        'Security Group with Dynamic Device membership'
      ],
      correct: 1,
      explanation: 'A Security Group with Dynamic User membership lets you create rules based on user attributes (such as department eq "Finance"). This automatically adds and removes users as attributes change. Requires an Entra ID P1 license.',
      reference: 'Dynamic groups require a P1 license — review the licensing table in the theory section.'
    },
    {
      question: 'Which Entra ID license is required to use Conditional Access Policies?',
      options: [
        'Free',
        'Microsoft 365 Basic',
        'Entra ID P1',
        'Entra ID P2'
      ],
      correct: 2,
      explanation: 'Conditional Access Policies require Entra ID P1 (or higher). The Free tier offers only Security Defaults, which are less granular. P2 adds Identity Protection and PIM, but Conditional Access is already available in P1.',
      reference: 'Review the licensing table: Free vs P1 vs P2 and the features of each plan.'
    },
    {
      question: 'A user was deleted from Entra ID by mistake. For how long can they be recovered from the recycle bin?',
      options: [
        '7 days',
        '14 days',
        '30 days',
        '90 days'
      ],
      correct: 2,
      explanation: 'Deleted users stay in the Entra ID "recycle bin" for 30 days. After that period they are permanently removed and cannot be recovered. During the 30 days you can restore via "Deleted users" in the portal or via Azure CLI/PowerShell.',
      reference: 'Important for the exam: always 30 days for soft delete in Entra ID.'
    },
    {
      question: 'Which Entra ID Connect sync method is recommended by Microsoft and does not require additional on-premises infrastructure to validate authentication?',
      options: [
        'Pass-through Authentication (PTA)',
        'Federation with AD FS',
        'Password Hash Sync (PHS)',
        'Certificate-based Authentication (CBA)'
      ],
      correct: 2,
      explanation: 'Password Hash Sync (PHS) is the method recommended by Microsoft because it is simpler, more resilient and does not depend on real-time on-premises infrastructure. The password hash is synced to Entra ID, so authentication happens in the cloud even if the on-premises connection goes down.',
      reference: 'PTA validates on-premises (requires working agents); AD FS is more complex. PHS is the simplest and most resilient.'
    },
    {
      question: 'What is a Managed Identity in the context of Azure?',
      options: [
        'A user account managed by the IT helpdesk',
        'A Service Principal whose credential is automatically managed by Azure, with no need for manual secrets',
        'An Entra ID group with administrative permissions',
        'A federated identity from an external provider like Google or GitHub'
      ],
      correct: 1,
      explanation: 'Managed Identities are special Service Principals where Azure automatically manages the credential lifecycle (certificates/secrets). Used so that VMs, App Services, Functions etc. authenticate to other Azure services without storing secrets in code. There are two types: System-assigned (lives with the resource) and User-assigned (reusable across resources).',
      reference: 'Managed Identities are fundamental to the "zero secrets" security pattern — review Azure RBAC to see how to grant access.'
    },
    {
      question: 'What is the main difference between "Security Defaults" and "Conditional Access" for enabling MFA?',
      options: [
        'Security Defaults requires P1; Conditional Access is free',
        'Security Defaults is a granular per-user policy; Conditional Access is for everyone',
        'Security Defaults applies MFA to everyone without granularity; Conditional Access allows rules per user, app, location and device',
        'There is no difference, they are different names for the same feature'
      ],
      correct: 2,
      explanation: 'Security Defaults (free) applies a fixed set of security policies to all users, including mandatory MFA for admins. Conditional Access (requires P1) lets you create granular policies: require MFA only for certain users, apps, locations or specific conditions. They cannot coexist — when you create a Conditional Access Policy, Security Defaults must be disabled.',
      reference: 'Exam gotcha: Security Defaults and Conditional Access are mutually exclusive — you cannot have both enabled.'
    },
    {
      question: 'An organization needs IT department employees to be able to reset their own passwords without contacting the helpdesk. Which feature must be enabled and which license is required?',
      options: [
        'Password Writeback — requires Entra ID Free',
        'Self-Service Password Reset (SSPR) — requires Entra ID P1',
        'Multi-Factor Authentication — requires Entra ID P2',
        'Privileged Identity Management — requires Entra ID P2'
      ],
      correct: 1,
      explanation: 'Self-Service Password Reset (SSPR) lets users reset their own passwords using configured verification methods (alternate email, phone, Authenticator app, etc.). Requires an Entra ID P1 license. To sync the password back to on-premises AD (Password Writeback), you also need to configure Entra ID Connect.',
      reference: 'SSPR vs PIM: SSPR is for regular users to reset passwords (P1); PIM is for managing temporary privileged access (P2).'
    }
  ],

  flashcards: [
    {
      front: 'What is a Tenant in Microsoft Entra ID?',
      back: 'A dedicated and isolated instance of Entra ID that an organization receives when signing up for Microsoft Cloud services. Identified by a default domain \`<name>.onmicrosoft.com\`. An organization usually has one tenant, which can contain multiple Azure subscriptions.'
    },
    {
      front: 'What are the 3 Entra ID Connect sync methods?',
      back: '1. **Password Hash Sync (PHS)** — password hash synced to the cloud (recommended, most resilient)\n2. **Pass-through Authentication (PTA)** — authentication validated on-premises in real time\n3. **Federation (AD FS)** — authentication delegated to local AD FS (most complex)'
    },
    {
      front: 'Which Entra ID license is required for each feature? (Dynamic Groups / Conditional Access / PIM)',
      back: '- **Dynamic Groups** → P1\n- **Conditional Access** → P1\n- **SSPR** → P1\n- **Hybrid Azure AD Join** → P1\n- **PIM** (Privileged Identity Management) → P2\n- **Identity Protection** → P2\n- **Access Reviews** → P2'
    },
    {
      front: 'What is the difference between System-Assigned and User-Assigned Managed Identity?',
      back: '- **System-Assigned**: tied to a specific resource, deleted when the resource is deleted. Cannot be shared.\n- **User-Assigned**: independent resource, can be assigned to multiple Azure resources. Keeps existing when the resources using it are deleted.'
    },
    {
      front: 'How long does a deleted user stay in the Entra ID recycle bin?',
      back: '**30 days**. After that period it is permanently removed. During the 30 days it can be restored via the Azure portal (Entra ID → Deleted users) or via \`az ad user restore\`.'
    },
    {
      front: 'What is the difference between Security Defaults and Conditional Access for MFA?',
      back: '- **Security Defaults** (free): applies MFA to everyone, no granularity, blocks legacy protocols\n- **Conditional Access** (P1): granular policies per user/group/app/location/device\n- **Important**: they are mutually exclusive — they cannot coexist in the same tenant'
    },
    {
      front: 'What are External Collaboration Settings in Entra ID?',
      back: 'Settings that control how Guest users (B2B) can be invited to the tenant. They include:\n- Who can invite guests (admins, members, guests, no one)\n- Domain restrictions (allow/deny list)\n- Level of access guests have to the directory\nLocation: Entra ID → External Identities → External Collaboration Settings'
    },
    {
      front: 'Which Azure CLI command creates a user in Entra ID?',
      back: '``\`bash\naz ad user create \\\n  --display-name "John Smith" \\\n  --user-principal-name john@contoso.onmicrosoft.com \\\n  --password "P@ssword123!" \\\n  --force-change-password-next-sign-in true\n\```'
    }
  ],

  lab: {
    scenario: 'The startup TechNova needs to structure its identities in Azure. You will create users, organize groups and validate access policies in Microsoft Entra ID.',
    objective: 'Create and manage users, static and dynamic groups, and validate basic security settings in Entra ID via Azure CLI.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create users in Entra ID',
        instruction: `Create two users for the company TechNova:
- **ana.devops** — DevOps Engineer, department "Engineering"
- **carlos.fin** — Financial Analyst, department "Finance"

Use the Azure CLI with the correct department parameters.`,
        hints: [
          'Use \`az ad user create\` with flags \`--display-name\`, \`--user-principal-name\`, \`--password\`',
          'After creating, use \`az ad user update --id <upn> --department "Engineering"\` to set the department',
          'The UPN must be in the format user@<your-tenant>.onmicrosoft.com'
        ],
        solution: `\`\`\`bash
# Check the tenant default domain
az account show --query tenantId -o tsv
az ad signed-in-user show --query userPrincipalName -o tsv

# Create the DevOps user
az ad user create \\
  --display-name "Ana DevOps" \\
  --user-principal-name ana.devops@contoso.onmicrosoft.com \\
  --password "P@ssword123!" \\
  --force-change-password-next-sign-in false

# Update department
az ad user update \\
  --id ana.devops@contoso.onmicrosoft.com \\
  --department "Engineering" \\
  --job-title "DevOps Engineer"

# Create the Finance user
az ad user create \\
  --display-name "Carlos Finance" \\
  --user-principal-name carlos.fin@contoso.onmicrosoft.com \\
  --password "P@ssword123!" \\
  --force-change-password-next-sign-in false

az ad user update \\
  --id carlos.fin@contoso.onmicrosoft.com \\
  --department "Finance" \\
  --job-title "Financial Analyst"
\`\`\``,
        verify: `\`\`\`bash
# Verify both users were created
az ad user list --filter "startswith(displayName,'Ana')" --query "[].{Name:displayName,UPN:userPrincipalName,Dept:department}" -o table
az ad user list --filter "startswith(displayName,'Carlos')" --query "[].{Name:displayName,UPN:userPrincipalName,Dept:department}" -o table

# Expected output for ana.devops:
# Name         UPN                                    Dept
# -----------  -------------------------------------  -----------
# Ana DevOps   ana.devops@contoso.onmicrosoft.com     Engineering

# Expected output for carlos.fin:
# Name            UPN                                  Dept
# --------------  -----------------------------------  -------
# Carlos Finance  carlos.fin@contoso.onmicrosoft.com   Finance
\`\`\``
      },
      {
        title: 'Create a static security group for Engineering',
        instruction: `Create a security group named **"Engineering-Team"** and add Ana as a member. This group will be used for access control to Azure resources.`,
        hints: [
          'Use \`az ad group create\` to create the group',
          'Use \`az ad group member add\` with the user Object ID as \`--member-id\`',
          'To get the Object ID: \`az ad user show --id <upn> --query id -o tsv\`'
        ],
        solution: `\`\`\`bash
# Create the security group
az ad group create \\
  --display-name "Engineering-Team" \\
  --mail-nickname "engineering-team" \\
  --description "TechNova Engineering Team"

# Get Ana's Object ID
ANA_ID=$(az ad user show --id ana.devops@contoso.onmicrosoft.com --query id -o tsv)
echo "Ana's Object ID: $ANA_ID"

# Add Ana to the group
az ad group member add \\
  --group "Engineering-Team" \\
  --member-id $ANA_ID
\`\`\``,
        verify: `\`\`\`bash
# Verify the group was created
az ad group show --group "Engineering-Team" --query "{Name:displayName,ID:id}" -o table

# Verify the group members
az ad group member list --group "Engineering-Team" \\
  --query "[].{Name:displayName,UPN:userPrincipalName}" -o table

# Expected output:
# Name         UPN
# -----------  -------------------------------------
# Ana DevOps   ana.devops@contoso.onmicrosoft.com
\`\`\``
      },
      {
        title: 'List and filter users by attribute',
        instruction: `Use OData filters to list all users in the "Finance" department — demonstrating how dynamic groups would work in practice. Then check the full properties of the carlos.fin user.`,
        hints: [
          'OData filter: \`--filter "department eq \'Finance\'"\` ',
          'Use \`--query\` to select specific fields',
          '\`az ad user show\` returns all attributes of a specific user'
        ],
        solution: `\`\`\`bash
# List all users in the Finance department
az ad user list \\
  --filter "department eq 'Finance'" \\
  --query "[].{Name:displayName,UPN:userPrincipalName,Dept:department,Title:jobTitle}" \\
  -o table

# View full details of carlos.fin
az ad user show --id carlos.fin@contoso.onmicrosoft.com \\
  --query "{Name:displayName,UPN:userPrincipalName,Dept:department,Type:userType,Account:accountEnabled}" \\
  -o json

# Simulate a dynamic group query — see how many would be included
echo "Users that would join the Finance dynamic group:"
az ad user list --filter "department eq 'Finance'" --query "length(@)" -o tsv
\`\`\``,
        verify: `\`\`\`bash
# Verify the filter returns carlos.fin
az ad user list --filter "department eq 'Finance'" --query "[].userPrincipalName" -o tsv
# Expected output:
# carlos.fin@contoso.onmicrosoft.com

# Verify Engineering returns ana.devops
az ad user list --filter "department eq 'Engineering'" --query "[].userPrincipalName" -o tsv
# Expected output:
# ana.devops@contoso.onmicrosoft.com
\`\`\``
      },
      {
        title: 'Clean up the created resources',
        instruction: `Remove the users and group created during the lab so you don't leave junk in the tenant.`,
        hints: [
          'Delete users first, then the group',
          'Deleted users stay in the recycle bin for 30 days'
        ],
        solution: `\`\`\`bash
# Remove members from the group (optional, the group will be deleted)
ANA_ID=$(az ad user show --id ana.devops@contoso.onmicrosoft.com --query id -o tsv)
az ad group member remove --group "Engineering-Team" --member-id $ANA_ID

# Delete the group
az ad group delete --group "Engineering-Team"

# Delete the users (they stay in the recycle bin for 30 days)
az ad user delete --id ana.devops@contoso.onmicrosoft.com
az ad user delete --id carlos.fin@contoso.onmicrosoft.com

echo "Cleanup complete!"
\`\`\``,
        verify: `\`\`\`bash
# Verify the group was removed
az ad group list --display-name "Engineering-Team" --query "length(@)" -o tsv
# Expected output: 0

# Verify the users appear in Deleted Users (soft delete)
az ad user list --filter "startswith(displayName,'Ana')" --query "[].displayName" -o tsv
# Expected output: (empty — the user no longer appears in the active list)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'User cannot reset their own password (SSPR)',
      difficulty: 'easy',
      symptom: 'Users complain that when they click "Forgot my password" at login they get the message: "Your administrator has not enabled this feature for your account".',
      diagnosis: `\`\`\`bash
# Check whether SSPR is enabled and for which users
# (In the portal: Entra ID → Password reset → Properties)

# Via PowerShell/Graph API — check the configuration
az rest --method GET \\
  --url "https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy" \\
  --query "registrationEnforcement"

# Check whether the user has an appropriate license
az ad user show --id user@contoso.onmicrosoft.com \\
  --query "assignedLicenses"
\`\`\``,
      solution: `**Causes and solutions:**

1. **SSPR not enabled**: In the Azure portal → Entra ID → Password reset → Properties → Enabled: select "All" or "Selected" (specific group)

2. **User not in the SSPR group**: If SSPR is set to "Selected", add the user to the configured group

3. **No P1 license**: SSPR requires Entra ID P1. Check Entra ID → Licenses → Assigned licenses → assign P1/P2 to the user

4. **User has no registered authentication methods**: Even with SSPR enabled, the user must have registered at least one method (alternate email, phone, Authenticator app). Instruct the user to go to \`aka.ms/ssprsetup\` to register methods.`
    },
    {
      title: 'Guest user (B2B) cannot access resources after accepting the invite',
      difficulty: 'medium',
      symptom: 'An external partner accepts the B2B invite but when trying to access a Storage Account or App gets "Access Denied" or "You don\'t have permission to view this page".',
      diagnosis: `\`\`\`bash
# Check whether the guest user exists in the tenant
az ad user list --filter "userType eq 'Guest'" \\
  --query "[].{Name:displayName,UPN:userPrincipalName,Status:accountEnabled}" -o table

# Check the guest's Object ID
az ad user show --id guest@externaldomain.com#EXT#@contoso.onmicrosoft.com \\
  --query "{ID:id,UPN:userPrincipalName,Type:userType}" -o json

# Check RBAC assignments for the guest
az role assignment list --assignee <guest-object-id> --all -o table
\`\`\``,
      solution: `**Causes and solutions:**

1. **Missing RBAC assignment**: The guest needs a Role Assignment on the resource. Add via:
   \`\`\`bash
   az role assignment create \\
     --assignee <guest-object-id> \\
     --role "Storage Blob Data Reader" \\
     --scope /subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.Storage/storageAccounts/<sa>
   \`\`\`

2. **External Collaboration Settings too restrictive**: Check Entra ID → External Identities → External Collaboration Settings. It may be blocking directory access.

3. **Conditional Access blocking guests**: If there is a Conditional Access Policy that requires a compliant or joined device, external guests fail that condition. Create a policy exclusively for guests or exclude guests from the problematic policy.

4. **Guest UPN in a special format**: A guest's UPN is \`email#EXT#@domain.onmicrosoft.com\` — using the Object ID as the assignee is safer than the UPN.`
    }
  ]
};
