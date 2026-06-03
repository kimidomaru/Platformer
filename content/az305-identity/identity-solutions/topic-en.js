window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-identity/identity-solutions'] = {
  theory: `# Designing Identity Solutions (AZ-305)

## Exam Relevance
> Estimated weight **25-30%** on AZ-305. The exam evaluates your ability to **design** identity solutions — not just configure them, but choose the right architecture for complex requirements.

## Core Concepts

### Identity Design Principles

**Zero Trust Identity Model:**
- **Verify explicitly**: always authenticate and authorize based on all available data
- **Use least privilege**: JIT (Just-in-Time) and JEA (Just Enough Access)
- **Assume breach**: minimize blast radius, segment access

**Identity layers:**
\`\`\`
Tenant/Directory (Entra ID)
  ├─ Users and Groups
  ├─ Applications (App Registrations)
  ├─ Managed Identities
  ├─ Conditional Access (access policies)
  └─ Privileged Identity Management (PIM)
\`\`\`

### Privileged Identity Management (PIM)
Manages Just-in-Time privileged access:
- Users **activate** roles when needed (e.g. Global Admin for 1 hour)
- Approval by another admin can be required
- MFA mandatory at activation
- Full audit trail of when/why access was activated
- Requires **Entra ID P2**

**PIM vs direct RBAC:**

| Scenario | Use |
|---------|------|
| Developer needs Contributor always | Direct RBAC |
| DBA needs DB access only during incidents | PIM |
| Security audit 1x/month needs Reader | PIM (JIT) |

### Hybrid Identity
For organizations with on-premises AD + Azure:

| Method | How it works | Best when |
|--------|-------------|-----------|
| **Password Hash Sync (PHS)** | Password hash replicated to Azure | Simplest, no on-prem dependency |
| **Pass-through Auth (PTA)** | Auth validated on-prem in real time | Compliance requires password never in the cloud |
| **Federation (AD FS)** | Auth token from on-prem AD FS | Advanced customization, complex SSO |

**Entra ID Connect Health**: monitors sync and alerts on problems.

### Multi-tenant Architecture
Scenarios with multiple tenants:
- **B2B (Business-to-Business)**: external partners use their own identity in your tenant (Guest users)
- **B2C (Business-to-Consumer)**: external customers create a custom account (Entra External ID / Azure AD B2C)
- **Multi-tenant App**: an app registered in one tenant can be used by users from other tenants

### External Identities (B2B vs B2C)

| | B2B | B2C |
|-|-----|-----|
| User | External partners/employees | End customers/consumers |
| Identity | Keeps own identity (Google, Microsoft, company) | Creates account in your tenant |
| Scale | Tens to thousands | Millions |
| Customization | Limited | High (branded flows, custom policies) |
| License | Entra ID (first 50k MAU free) | Entra External ID (MAU-based) |

### Conditional Access — Advanced Design
Policies that control when/how users access resources:

**Evaluated signals:**
- User/Group/Role
- Application
- Location (IP, country)
- Device (compliant, Hybrid AD Joined)
- Sign-in risk (Identity Protection, P2)
- Real-time risk score

**Design patterns:**

\`\`\`
Policy 1: MFA for access from untrusted locations
  IF: location NOT IN trusted IPs
  THEN: require MFA

Policy 2: Block high-risk countries
  IF: location = [KP, IR, ...]
  THEN: block

Policy 3: Admin access = compliant device + MFA
  IF: user role = Global Admin
  THEN: require compliant device + MFA
\`\`\`

### App Registration vs Enterprise Application
- **App Registration**: the application definition (how it authenticates, which permissions it has)
- **Enterprise Application**: the app instance in the tenant (where you configure user access)
- Multi-tenant app: one App Registration, multiple Enterprise Applications in different tenants

## Design Patterns — Use Cases

### Pattern 1: Secure DevOps Access
\`\`\`
Developers → Entra ID → PIM for Contributor on Prod
                      → Direct RBAC Contributor on Dev/Test
                      → Conditional Access: MFA + Compliant Device for Prod
\`\`\`

### Pattern 2: Hybrid Identity
\`\`\`
On-prem AD → Entra ID Connect (PHS) → Entra ID
               ↓                         ↓
         Sync users/groups           Conditional Access
                                     App registrations
                                     SSO for SaaS
\`\`\`

### Pattern 3: External Partner Access
\`\`\`
Partner tenant → B2B invite → Guest in your tenant
                              → Limited RBAC on specific resources
                              → Conditional Access: MFA mandatory for guests
                              → Quarterly Access Reviews (P2)
\`\`\`

## Common Design Mistakes

1. **Direct RBAC for privileged access**: using permanent RBAC for Global Admin/Contributor in Prod — the right approach is PIM JIT.
2. **No Conditional Access for guests**: B2B without Conditional Access may leave external accounts without MFA.
3. **PHS when compliance forbids hashes in the cloud**: use PTA or Federation if compliance requires passwords never leave the datacenter.
4. **Application using service principal with a secret**: secrets expire and are hard to manage — use Managed Identity or certificate-based auth.

## Killer.sh Style Challenge (AZ-305 Style)

> **Design Scenario**: A financial services company has 2,000 employees in on-premises AD and needs to migrate to a hybrid cloud. Requirements:
> 1. Employees have on-premises passwords — compliance requires that password hashes are NEVER stored in the cloud
> 2. IT admins need privileged access only during incidents, with CISO approval
> 3. 500 external partners need access to a reporting application
> 4. Application access only from corporate managed devices
>
> **Design the complete identity solution.**
>
> **Expected solution:**
> 1. Entra ID Connect with **Pass-through Authentication** (not PHS — compliance forbids hashes in the cloud)
> 2. **PIM** for admin roles with mandatory CISO approval + MFA at activation (requires P2)
> 3. **Azure AD B2B** for partners (Guest users, keep their own identity, MAU-based billing)
> 4. **Conditional Access** policy: cloud app = Reporting App, grant = require Hybrid AD Joined OR Compliant Device
`,

  quiz: [
    {
      question: 'A company needs to ensure that global administrators have privileged access only when needed, with approval from another admin and a full audit trail. Which feature to use?',
      options: [
        'RBAC with permanent Role Assignment',
        'Privileged Identity Management (PIM)',
        'Conditional Access with MFA',
        'Azure Policy with Deny'
      ],
      correct: 1,
      explanation: 'PIM (Privileged Identity Management) implements JIT (Just-in-Time) access for privileged roles. Users are "eligible" for a role but must activate it when needed, which can require approval from another admin, MFA and a justification. Every activation is audited. Requires Entra ID P2.',
      reference: 'PIM = JIT for privileged roles. Permanent RBAC = always-on access. For admins, PIM is the recommended standard.'
    },
    {
      question: 'A company\'s compliance policy forbids storing password hashes outside the on-premises datacenter. Which Entra ID Connect sync method should be used?',
      options: [
        'Password Hash Sync (PHS)',
        'Pass-through Authentication (PTA)',
        'Azure AD Connect Cloud Sync',
        'Direct Federation with SAML'
      ],
      correct: 1,
      explanation: 'Pass-through Authentication (PTA) validates passwords directly against the on-premises AD in real time — the password (or its hash) is never stored in Azure. Requires PTA agents installed on-premises that stay online to process authentications. PHS syncs the password hash to Entra ID, which violates the compliance requirement.',
      reference: 'PHS = hash goes to Azure (simple but hash is in the cloud). PTA = auth validated on-prem in real time (hash never goes to Azure).'
    },
    {
      question: 'What is the difference between Azure AD B2B and Azure AD B2C (Entra External ID)?',
      options: [
        'B2B is for customers; B2C is for business partners',
        'B2B is for external partners/employees who keep their own identity; B2C is for end consumers who create accounts in your tenant',
        'B2C only supports Microsoft identities; B2B supports external identities',
        'There is no technical difference — only licensing terminology'
      ],
      correct: 1,
      explanation: 'B2B (Business-to-Business): partners use their existing corporate/Microsoft identity as a guest in your tenant. Scale of tens to thousands. B2C/External ID: consumers create an account specific to your tenant, with custom flows and your company\'s branding. Scale of millions of users. Completely different use cases.',
      reference: 'B2B = partners (guest users, keep identity). B2C = consumers (create account in your tenant, millions scale).'
    },
    {
      question: 'Which Conditional Access signal evaluates the real-time risk of a sign-in (e.g. suspicious login from an unusual location) and requires which license?',
      options: [
        'Location signal — Entra ID P1',
        'Identity Protection risk signal — Entra ID P2',
        'Device compliance — Entra ID P1',
        'User risk — Entra ID Free'
      ],
      correct: 1,
      explanation: 'The Entra ID Identity Protection risk signal evaluates in real time whether a sign-in is suspicious (anomalous location, malicious IP, leaked credentials). By integrating with Conditional Access, you can require MFA or block high-risk sign-ins. Requires Entra ID P2.',
      reference: 'P1: Conditional Access with basic signals (location, device, app). P2: adds Identity Protection (risk-based CA, PIM, Access Reviews).'
    },
    {
      question: 'An application needs to access the Microsoft Graph API on behalf of itself (not a user). Which permission type and authentication should be used?',
      options: [
        'Delegated permissions with user credential',
        'Application permissions with Client Credentials flow (service principal)',
        'User Impersonation with Managed Identity',
        'Shared Access Signature for Microsoft APIs'
      ],
      correct: 1,
      explanation: 'For "daemon" access (without a user, the application acting on its own behalf), use Application Permissions with the OAuth 2.0 Client Credentials Flow. The application authenticates with its own clientId + secret/certificate (or Managed Identity). Delegated permissions are for when the application acts ON BEHALF of a specific user.',
      reference: 'Delegated = on behalf of a user (user must consent). Application = the app itself (admin consent needed, not individual user).'
    }
  ],

  flashcards: [
    {
      front: 'What is PIM (Privileged Identity Management) and what are its pillars?',
      back: '**PIM** manages Just-in-Time (JIT) privileged access in Entra ID and Azure RBAC.\n\n**3 pillars:**\n1. **Eligible assignments**: user can activate the role when needed\n2. **Time-bound**: access with a limited duration (e.g. 1–8h)\n3. **Approval workflow**: activation can require approval\n\n**Benefits:**\n- Reduces exposure of permanent privileged accounts\n- Full audit trail (who activated, when, why)\n- MFA mandatory at activation\n\n**License**: Entra ID P2'
    },
    {
      front: 'What are the 3 Entra ID Connect sync methods and when to use each?',
      back: '**1. Password Hash Sync (PHS)** — recommended by Microsoft:\n- Password hash synced to Azure\n- Auth happens in the cloud (no on-prem dependency)\n- More resilient (works if on-prem is down)\n\n**2. Pass-through Auth (PTA)**:\n- Auth validated on-prem in real time\n- Hash never goes to Azure\n- Use when compliance forbids password data in the cloud\n\n**3. Federation (AD FS)**:\n- Token issued by on-prem AD FS\n- Maximum customization and control\n- More complex and costly to maintain'
    },
    {
      front: 'What is the Zero Trust design pattern for identity?',
      back: '**Zero Trust** = "Never trust, always verify"\n\n**3 principles:**\n1. **Verify explicitly**: always authenticate and authorize based on ALL data (identity, location, device, service, workload, etc.)\n2. **Least privilege**: JIT + JEA. PIM for privileged roles. Granular RBAC.\n3. **Assume breach**: segment access, detect anomalies, respond quickly\n\n**Implementation controls:**\n- Conditional Access + MFA\n- PIM for privileged roles\n- Identity Protection for risk-based access\n- Periodic Access Reviews (P2)'
    },
    {
      front: 'App Registration vs Enterprise Application in Entra ID — what is the difference?',
      back: '**App Registration** (global object):\n- "Blueprint" of the application\n- Defines how it authenticates, which permissions it requests\n- Created in the tenant where the app is "owned"\n- Has clientId, secret/certificate\n\n**Enterprise Application** (Service Principal — local object):\n- App instance in the tenant\n- Here you manage: who can access, permission consent, SSO\n- Created automatically when you register the app OR install an app from the Marketplace\n\nMulti-tenant app: 1 App Registration → N Enterprise Applications in N tenants'
    }
  ],

  lab: {
    scenario: 'Explore PIM and Conditional Access settings to understand secure identity design.',
    objective: 'Verify PIM prerequisites and create a Conditional Access Policy requiring MFA for administrators.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Verify license and explore PIM',
        instruction: 'Check whether the tenant has the Entra ID P2 license needed for PIM and explore the settings via CLI.',
        hints: ['\`az ad user show\` to see your user details', 'PIM requires P2 — check assigned licenses'],
        solution: `\`\`\`bash
# Check tenant licenses
az rest --method GET \\
  --url "https://graph.microsoft.com/v1.0/subscribedSkus" \\
  --query "value[].{SKU:skuPartNumber,Units:prepaidUnits.enabled}" \\
  -o table

# Check your user licenses
MY_ID=$(az ad signed-in-user show --query id -o tsv)
az rest --method GET \\
  --url "https://graph.microsoft.com/v1.0/users/$MY_ID/licenseDetails" \\
  --query "value[].servicePlans[?servicePlanName=='AAD_PREMIUM_P2'].servicePlanName" \\
  -o tsv

echo "If 'AAD_PREMIUM_P2' appears, the tenant has P2 license for PIM"
\`\`\``,
        verify: `\`\`\`bash
echo "To explore PIM: Azure Portal → Microsoft Entra ID → Privileged Identity Management"
echo "PIM cannot be fully configured via CLI — the portal is needed for activations"
\`\`\``
      },
      {
        title: 'Create a Conditional Access Policy for Admins',
        instruction: 'Use the Azure portal (via instructions) or the Graph API to create a policy requiring MFA for Global Administrators.',
        hints: [
          'Via portal: Entra ID → Security → Conditional Access → New Policy',
          'Assignments: Users → Directory Roles → Global Administrator',
          'Grant: Require multi-factor authentication'
        ],
        solution: `\`\`\`bash
# Via Graph API (if permissions are available)
az rest --method POST \\
  --url "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies" \\
  --body '{
    "displayName": "Require MFA for Global Admins",
    "state": "enabledForReportingButNotEnforced",
    "conditions": {
      "users": {
        "includeRoles": ["62e90394-69f5-4237-9190-012177145e10"]
      },
      "applications": {
        "includeApplications": ["All"]
      }
    },
    "grantControls": {
      "operator": "OR",
      "builtInControls": ["mfa"]
    }
  }' \\
  --headers "Content-Type=application/json" 2>/dev/null || echo "Create via portal: Entra ID → Security → Conditional Access"
\`\`\``,
        verify: `\`\`\`bash
# List Conditional Access policies
az rest --method GET \\
  --url "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies" \\
  --query "value[].{Name:displayName,State:state}" -o table 2>/dev/null || echo "Check via portal"
\`\`\``
      },
      {
        title: 'Review Access Reviews (conceptual)',
        instruction: 'Understand when to use Access Reviews and explore the options via portal. Access Reviews automate periodic auditing of who has access to what.',
        hints: ['Access Reviews require P2', 'Portal: Entra ID → Identity Governance → Access Reviews'],
        solution: `\`\`\`bash
# Access Reviews are configured via the portal or MS Graph API
# Check whether Identity Governance is available
az rest --method GET \\
  --url "https://graph.microsoft.com/v1.0/identityGovernance/accessReviews/definitions" \\
  --query "value[].{Name:displayName,Status:status}" -o table 2>/dev/null || \\
  echo "Identity Governance (Access Reviews) requires a P2 license and configuration via the portal"

echo "Use cases for Access Reviews:"
echo "1. Quarterly review of who has access to sensitive resources"
echo "2. Identify and remove inactive guest users"
echo "3. Audit members of privileged groups (e.g. Global Admins)"
\`\`\``,
        verify: `\`\`\`bash
echo "Access Reviews explored via portal or Graph API"
echo "Next step: implement in a real environment with a P2 license"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Conditional Access is blocking legitimate users',
      difficulty: 'medium',
      symptom: 'After creating a Conditional Access policy, some legitimate users (including an admin) are being blocked when they try to sign in.',
      diagnosis: `\`\`\`bash
# Check Sign-in Logs to understand why users were blocked
az rest --method GET \\
  --url "https://graph.microsoft.com/v1.0/auditLogs/signIns?\\$filter=conditionalAccessStatus eq 'failure'&\\$top=10" \\
  --query "value[].{User:userPrincipalName,App:appDisplayName,Status:conditionalAccessStatus,Error:status.failureReason}" \\
  -o table 2>/dev/null || echo "Check: Entra ID → Sign-in logs → Filter: CA status = Failure"
\`\`\``,
      solution: `**Preventions and solutions:**

1. **Always use "Report-only" mode first**: when creating the policy, set it to "Report-only" for a few days — see who would be affected without blocking anyone.

2. **Exclude break-glass accounts**: always create 2 "emergency access" accounts (no CA, no MFA, with long passwords in a physical vault) and exclude them from the policy.

3. **Temporarily exclude a specific user/group**: edit the policy → Exclude → add the blocked user while investigating.

4. **Check sign-in logs**: Entra ID → Sign-in Logs → filter by user and see which policy is blocking and why.

5. **Break-glass mode**: if the admin is blocked, use the emergency access account.`
    },
    {
      title: 'On-premises users not appearing in Entra ID after configuring Connect',
      difficulty: 'medium',
      symptom: 'Entra ID Connect was installed and configured, but on-premises AD users do not appear in Entra ID.',
      diagnosis: `\`\`\`bash
# Check sync status (on the server where Connect is installed)
# Via PowerShell on the Connect server:
# Import-Module ADSync
# Get-ADSyncScheduler
# Start-ADSyncSyncCycle -PolicyType Delta

# Via portal: Entra ID → Entra ID Connect → Sync errors

# Check whether the user has required attributes
# In on-prem AD, check: userPrincipalName, mail, proxyAddresses
\`\`\``,
      solution: `**Diagnostic checklist:**

1. **Check Sync Errors**: in the portal Entra ID → Connect → Sync errors — errors are listed by attribute/user.

2. **Required attributes**: check that the on-prem user UPN uses a verified domain in Azure. If the UPN is \`user@contoso.local\` (non-routable domain), it may cause issues — configure Alternate Login ID.

3. **OU not in sync scope**: check that the users' OU is selected in the Connect filter configuration.

4. **Attribute conflict**: two objects with the same proxyAddress or ImmutableId generate a conflict — check the sync error list.

5. **Force synchronization**: on the Connect server, via PowerShell: \`Start-ADSyncSyncCycle -PolicyType Initial\` for a full sync.`
    }
  ]
};
