window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-security/security-design'] = {
  theory: `# Security Solutions Design (AZ-305)

## Exam Relevance
> Estimated weight **15-20%** in AZ-305. The exam evaluates the ability to design layered security solutions: identity, network, data, and application.

## Defense in Depth

\`\`\`
Layer 1: Physical (Microsoft data center)
Layer 2: Identity (Azure AD, MFA, PIM)
Layer 3: Perimeter (DDoS, Azure Firewall)
Layer 4: Network (NSG, Private Endpoints, VNet)
Layer 5: Compute (Defender for Servers, patch)
Layer 6: Application (APIM, WAF, App Gateway)
Layer 7: Data (Encryption, Key Vault, RBAC)
\`\`\`

## Azure Key Vault — Design

### Types of objects in Key Vault

| Type | Use | Example |
|------|-----|---------|
| **Secrets** | Opaque strings | Passwords, connection strings |
| **Keys** | Cryptographic keys | RSA, EC keys for encryption |
| **Certificates** | TLS/SSL certificates | App Service SSL, mTLS |

\`\`\`bash
# Create Key Vault with soft-delete and purge protection
az keyvault create \
  --name mykeyvault \
  --resource-group myRG \
  --location eastus \
  --enable-soft-delete true \
  --retention-days 90 \
  --enable-purge-protection true \    # irreversible once enabled
  --sku standard

# Add a secret
az keyvault secret set \
  --vault-name mykeyvault \
  --name db-password \
  --value "P@ssword123!"

# Grant access to a Managed Identity
az keyvault set-policy \
  --name mykeyvault \
  --object-id <managed-identity-object-id> \
  --secret-permissions get list
\`\`\`

## Managed Identity — Zero Secrets

\`\`\`
Without Managed Identity:              With Managed Identity:
App → stores secret → uses secret      App → Managed Identity → Azure AD Token
      (risk: leak, rotation)                → Key Vault / Storage / SQL
                                           (no secrets, no manual rotation)
\`\`\`

### System-assigned vs User-assigned

| | System-assigned | User-assigned |
|-|----------------|--------------|
| Lifecycle | Tied to the resource | Independent |
| Sharing | 1 resource | N resources |
| Use case | Individual VM, single App Service | VM pool, Container Instances |

## Microsoft Defender for Cloud

\`\`\`bash
# Enable Defender for Containers (for AKS)
az security pricing create \
  --name Containers \
  --tier Standard \
  --resource-group myRG

# Enable Defender for Servers
az security pricing create \
  --name VirtualMachines \
  --tier Standard

# View security recommendations
az security assessment list \
  --query "[?properties.status.code=='Unhealthy'].{Name:displayName,Severity:properties.metadata.severity}" \
  -o table
\`\`\`

## Azure WAF (Web Application Firewall)

WAF protects against OWASP Top 10 vulnerabilities:

\`\`\`bash
# Create WAF Policy
az network application-gateway waf-policy create \
  --name myWAFPolicy \
  --resource-group myRG \
  --type OWASP \
  --version 3.2 \
  --state Enabled \
  --mode Prevention

# Add custom rule
az network application-gateway waf-policy custom-rule create \
  --policy-name myWAFPolicy \
  --resource-group myRG \
  --name BlockCountry \
  --priority 100 \
  --rule-type MatchRule \
  --action Block \
  --match-conditions '[{"matchVariable":"RemoteAddr","operator":"GeoMatch","matchValues":["CN","RU"]}]'
\`\`\`

## Pattern: Network Segmentation

\`\`\`
Internet → DDoS Protection Standard
         ↓
         Azure Firewall (Layer 7, FQDN filtering)
         ↓
         Application Gateway + WAF (Layer 7 HTTP)
         ↓
         AKS/App Service (Private Endpoint)
         ↓
         Azure SQL (Private Endpoint, firewall rules)
         ↓
         Key Vault (Private Endpoint, Access Policies)
\`\`\`

## Common Design Mistakes

1. **Key Vault without purge protection**: secrets can be permanently deleted by accident or attack.
2. **Service principal with password instead of Managed Identity**: passwords expire and are hard to rotate; Managed Identity is managed automatically.
3. **DDoS Basic sufficient for public applications**: Basic has no automatic response or telemetry — Standard is required for SLA.
4. **WAF in Detection mode in production**: Detection only logs, it does not block. Use Prevention in production.
5. **NSG without explicit deny rule**: NSG allows all traffic between subnets in the same VNet without rules.

## Killer.sh Style Challenge (AZ-305)

> A digital bank needs: public web application, API for external partners, customer data with LGPD, audit of all operations, DDoS and web attack protection.
>
> **Answer**: Azure Front Door + DDoS Standard (perimeter protection). Application Gateway + WAF v2 Prevention mode (L7 protection). App Service with Private Endpoint (no public IP). Azure SQL with Private Endpoint + Transparent Data Encryption + Always Encrypted for sensitive data. Key Vault with purge protection for encryption keys. Managed Identity for zero-secret authentication. Activity Log + Microsoft Sentinel for SIEM and audit.
`,

  quiz: [
    {
      question: 'What is "purge protection" in Azure Key Vault and when should you enable it?',
      options: [
        'It prevents the creation of new secrets during maintenance',
        'It makes the Key Vault and its objects unrecoverable even after being deleted during the soft-delete period, preventing permanent destruction from errors or attacks',
        'It automatically synchronizes secrets between multiple Key Vaults',
        'It encrypts secrets with a customer-managed key'
      ],
      correct: 1,
      explanation: 'With purge protection enabled, even after deleting a secret or the entire Key Vault, the content cannot be "purged" (permanently deleted) during the soft-delete period. This protects against: accidental deletion by an admin, ransomware attacks, or errors in automation scripts. Note: once enabled, purge protection cannot be disabled — it is irreversible.',
      reference: 'Key Vault section — enable purge protection in production; it is irreversible but essential for compliance.'
    },
    {
      question: 'What is the main advantage of Managed Identity over Service Principals with passwords for application authentication in Azure?',
      options: [
        'Managed Identity has broader permissions than Service Principals',
        'Managed Identity requires no secret management — Azure automatically manages the credential lifecycle, eliminating manual rotation and leak risk',
        'Managed Identity only works inside Azure; Service Principal is needed for hybrid environments',
        'Managed Identity is faster for authentication because it uses a different protocol'
      ],
      correct: 1,
      explanation: 'Service Principals with passwords/certificates require: secure credential storage, periodic rotation, and there is a risk of leaking to logs or code. Managed Identity solves this completely — Azure automatically manages the identity and credentials. The application requests a token from the local IMDS (Instance Metadata Service), without ever seeing a password. There are no secrets to leak or rotate.',
      reference: 'Managed Identity section — Managed Identity is the recommended standard for all service-to-service authentication in Azure.'
    },
    {
      question: 'A WAF configured in Detection mode is running in production. What is the risk?',
      options: [
        'Detection mode is more expensive than Prevention',
        'In Detection, the WAF only logs threats but does not block them — real attacks continue to reach the application',
        'Detection mode does not work with OWASP rules',
        'Detection mode causes false negatives only'
      ],
      correct: 1,
      explanation: 'WAF Detection mode records all suspicious requests in the Application Gateway logs, but forwards them to the application without blocking. It is useful for calibrating rules and identifying false positives before enabling blocking. In production, keep it in Prevention mode which actively blocks attacks. The recommended transition: Detection for a few days for false positive analysis → Prevention.',
      reference: 'Azure WAF section — Detection = log only. Prevention = block attacks. Always use Prevention in production.'
    }
  ],

  flashcards: [
    {
      front: 'What is Defense in Depth and how does it apply in Azure?',
      back: '**Defense in Depth** = multiple layers of security, where a failure in one layer does not compromise the entire security posture.\n\n**7 layers in Azure**:\n1. **Physical**: Microsoft data center (Microsoft responsibility)\n2. **Identity**: Entra ID, MFA, PIM, Conditional Access\n3. **Perimeter**: DDoS Standard, Azure Firewall Premium\n4. **Network**: NSG, VNet segmentation, Private Endpoints\n5. **Compute**: Defender for Servers, patch management\n6. **Application**: WAF, APIM, SAST/DAST\n7. **Data**: TDE, Always Encrypted, Key Vault, granular RBAC'
    },
    {
      front: 'System-assigned vs User-assigned Managed Identity — when to use each?',
      back: '**System-assigned**:\n- Lifecycle = resource lifecycle\n- Deleted when the resource is deleted\n- Ideal for: individual VMs, specific App Services\n- 1 resource → 1 identity\n\n**User-assigned**:\n- Lifecycle independent of the resource\n- Can be assigned to multiple resources\n- Ideal for: VM pools, Container Instances with autoscale, permission reuse\n- 1 identity → N resources\n\n**Rule**: single unique resource → System. Pool/multiple resources → User-assigned.'
    }
  ],

  lab: {
    scenario: 'Configure Key Vault with Managed Identity for zero-secrets access from an application.',
    objective: 'Demonstrate the Managed Identity + Key Vault pattern eliminating hardcoded credentials.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Key Vault and add a secret',
        instruction: 'Create a Key Vault with soft-delete and add a database secret.',
        hints: ['--enable-purge-protection is irreversible', 'az keyvault secret set to add secrets'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-security-lab --location eastus

az keyvault create \
  --name "technova-kv-\${SUFFIX}" \
  --resource-group rg-security-lab \
  --location eastus \
  --enable-soft-delete true \
  --retention-days 7

az keyvault secret set \
  --vault-name "technova-kv-\${SUFFIX}" \
  --name "db-connection-string" \
  --value "Server=mydb.database.windows.net;Database=prod;..."

echo "KV_NAME=technova-kv-\${SUFFIX}" > /tmp/securitylab.sh
echo "Key Vault created and secret added"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/securitylab.sh
az keyvault secret show --vault-name $KV_NAME --name db-connection-string \
  --query "{Name:name,Enabled:attributes.enabled}" -o table
# Expected: db-connection-string, true
\`\`\``
      },
      {
        title: 'Create VM with Managed Identity and grant access to Key Vault',
        instruction: 'Create a VM with system-assigned Managed Identity and configure access to Key Vault.',
        hints: ['az vm create --assign-identity', 'az keyvault set-policy to grant permission'],
        solution: `\`\`\`bash
source /tmp/securitylab.sh

# Create VM with Managed Identity
az vm create \
  --name app-vm \
  --resource-group rg-security-lab \
  --image Ubuntu2204 \
  --assign-identity \
  --generate-ssh-keys \
  --size Standard_B1s

# Get Managed Identity object ID
MI_OBJECT_ID=$(az vm show \
  --name app-vm \
  --resource-group rg-security-lab \
  --query "identity.principalId" -o tsv)

echo "Managed Identity Object ID: $MI_OBJECT_ID"

# Grant secret read permission to Key Vault
az keyvault set-policy \
  --name $KV_NAME \
  --object-id $MI_OBJECT_ID \
  --secret-permissions get list

echo "VM can now access Key Vault without credentials!"
echo "On the VM: curl 'http://169.254.169.254/metadata/identity/oauth2/token'"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/securitylab.sh
az keyvault show --name $KV_NAME --resource-group rg-security-lab \
  --query "properties.accessPolicies[?contains(permissions.secrets, 'get')].objectId" -o tsv
# Expected: the Managed Identity object ID

az group delete --name rg-security-lab --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Application with Managed Identity cannot access Key Vault',
      difficulty: 'medium',
      symptom: 'An Azure Function with System-assigned Managed Identity returns "Forbidden" when trying to fetch a secret from Key Vault, even after configuring the Access Policy.',
      diagnosis: `\`\`\`bash
# Check Access Policies on the Key Vault
az keyvault show --name mykeyvault --resource-group myRG \
  --query "properties.accessPolicies" -o json

# Check if Managed Identity is enabled on the Function
az functionapp identity show \
  --name myfunction --resource-group myRG
\`\`\``,
      solution: `**Diagnostic checklist**:

1. **Managed Identity not enabled**: check if system-assigned MI is enabled on the Function App:
\`\`\`bash
az functionapp identity assign --name myfunction --resource-group myRG
\`\`\`

2. **Access Policy with wrong Object ID**: the Policy must use the Object ID of the MI Service Principal (not the Client ID):
\`\`\`bash
MI_OBJECT_ID=$(az functionapp identity show --name myfunction --resource-group myRG --query "principalId" -o tsv)
az keyvault set-policy --name mykeyvault --object-id $MI_OBJECT_ID --secret-permissions get
\`\`\`

3. **Key Vault with RBAC enabled**: if the KV uses Azure RBAC (not Access Policies), grant the "Key Vault Secrets User" role:
\`\`\`bash
az role assignment create --assignee $MI_OBJECT_ID --role "Key Vault Secrets User" --scope /subscriptions/.../vaults/mykeyvault
\`\`\`

4. **Private Endpoint without DNS**: if the Key Vault has a Private Endpoint, the Function needs to be in the same VNet or have access via Private DNS.`
    }
  ]
};
