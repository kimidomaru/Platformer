window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-security/compliance-design'] = {
  theory: `# Compliance & Regulatory Design (AZ-305)

## Exam Relevance
> Estimated weight **10-15%** in AZ-305. Questions about GDPR, data residency, Microsoft Purview, and Defender for Cloud Regulatory Compliance appear in design scenarios.

## Compliance Frameworks in Azure

### Microsoft Defender for Cloud — Regulatory Compliance

\`\`\`bash
# View available compliance frameworks
az security regulatory-compliance-standards list -o table

# View controls of a specific framework
az security regulatory-compliance-controls list \
  --standard-name "PCI-DSS-3.2.1" \
  --query "[?state=='Failed'].{Control:name,State:state}" -o table

# View compliance score
az security secure-score-controls list \
  --query "[].{Control:displayName,Score:score.current,Max:score.max}" -o table
\`\`\`

**Available frameworks**: ISO 27001, SOC 2, PCI DSS, NIST SP 800-53, FedRAMP, CIS Benchmarks, LGPD, GDPR.

## Data Residency

For GDPR and local regulations, data must remain in specific regions:

\`\`\`bash
# Create storage account restricted to EU regions
# Via Azure Policy: "Allowed locations"
az policy assignment create \
  --name eu-data-residency \
  --policy "/providers/Microsoft.Authorization/policyDefinitions/e56962a6-4747-49cd-b67b-bf8b01975c4f" \
  --scope /subscriptions/my-subscription-id \
  --params '{"listOfAllowedLocations": {"value": ["westeurope", "northeurope", "francecentral"]}}'
\`\`\`

## Microsoft Purview — Data Governance

\`\`\`
Microsoft Purview = governance, risk and compliance platform

Components:
├─ Data Map: automatic inventory of data from sources (SQL, Storage, Power BI)
├─ Data Catalog: data discovery and classification (PII, GDPR, etc.)
├─ Data Policy: access control based on classification
├─ Information Protection: labels, DLP (Data Loss Prevention)
└─ Insider Risk Management: detect internal risky behavior
\`\`\`

\`\`\`bash
# Create Purview account
az purview account create \
  --account-name mypurview \
  --resource-group myRG \
  --location eastus \
  --managed-resource-group-name purview-managed-rg

# Register data source (Azure SQL)
az purview account register-data-source \
  --account-name mypurview \
  --resource-group myRG \
  --data-source-type AzureSqlDatabase \
  --data-source-name mydb
\`\`\`

## Encryption Strategy

### Encryption at Rest

| Type | Key Management | Use |
|------|---------------|-----|
| **PMK** (Platform-managed) | Microsoft manages | Default, no extra cost |
| **CMK** (Customer-managed) | Customer manages in Key Vault | Compliance, audit rotation |
| **BYOK** (Bring Your Own Key) | Customer HSM | Maximum control, regulatory |

\`\`\`bash
# Storage Account with CMK
az storage account update \
  --name mysa \
  --resource-group myRG \
  --encryption-key-source Microsoft.Keyvault \
  --encryption-key-vault https://mykeyvault.vault.azure.net \
  --encryption-key-name storage-encryption-key \
  --encryption-key-version <key-version>
\`\`\`

### Encryption in Transit

- TLS 1.2 minimum on all Azure services
- App Service: configure minimum TLS version
- Storage Account: Secure transfer required (HTTPS only)

\`\`\`bash
# Force TLS 1.2+ on Storage
az storage account update \
  --name mysa --resource-group myRG \
  --min-tls-version TLS1_2 \
  --https-only true
\`\`\`

## Azure Policy for Automatic Compliance

\`\`\`bash
# Policy Initiative: apply multiple ISO 27001 controls
az policy assignment create \
  --name iso-27001-compliance \
  --policy-set-definition /providers/Microsoft.Authorization/policySetDefinitions/89c6cddc-1c73-4ac1-b19c-54d1a15a42f9 \
  --scope /subscriptions/my-sub-id \
  --enforcement-mode Default

# Verify compliance
az policy state list \
  --query "[?complianceState=='NonCompliant'].{Policy:policyDefinitionName,Resource:resourceId}" \
  -o table | head -20
\`\`\`

## Common Design Mistakes

1. **PMK when CMK is required**: financial regulations often require the customer to control encryption keys (CMK/BYOK).
2. **No personal data inventory**: GDPR/LGPD requires knowing where personal data is located — Purview automates this inventory.
3. **TLS 1.0/1.1 still accepted**: legacy protocols with known vulnerabilities. Enforce a minimum of TLS 1.2.
4. **Audit logs for only 30 days**: compliance often requires 1-7 years of log retention.
5. **Compliance policy without remediation**: Policy in Audit mode does not remediate — configure DeployIfNotExists for automatic remediation.

## Killer.sh Style Challenge (AZ-305)

> A bank needs to comply with PCI DSS for card data. Requirements: card data encrypted at rest with keys controlled by the bank, minimum TLS 1.2, access logs for 3 years, alerts for unauthorized access, data only in Brazil (LGPD).
>
> **Answer**: Azure Policy "Allowed locations" = brazilsouth+brazilsoutheast. Azure SQL with Always Encrypted + CMK in Key Vault with BYOK (HSM). Storage Account with CMK + TLS 1.2+ enforced. Log Analytics workspace: SecurityEvent retention=1095 days (3 years). Defender for Cloud with PCI DSS initiative + Sentinel for anomalous access alerts. Purview for automatic card data classification.
`,

  quiz: [
    {
      question: 'What is the difference between PMK, CMK, and BYOK in the context of encryption at rest in Azure?',
      options: [
        'They are just marketing terms for the same service',
        'PMK = Microsoft manages the keys (default); CMK = customer manages keys in Key Vault (compliance); BYOK = customer imports keys from their own HSM (maximum control)',
        'PMK is for data at rest; CMK for data in transit; BYOK for data in use',
        'BYOK is more expensive but offers no additional technical benefits over CMK'
      ],
      correct: 1,
      explanation: 'PMK (Platform-managed keys): Microsoft creates, stores, and rotates keys automatically — default, no extra cost, transparent. CMK (Customer-managed keys): customer creates and stores in Azure Key Vault, controls rotation, and can revoke access. BYOK (Bring Your Own Key): customer generates keys in an on-premises HSM and imports them into Azure Key Vault — maximum control, meets regulations requiring keys to never be generated outside the customer\'s control.',
      reference: 'Encryption Strategy section — PMK for default, CMK for compliance, BYOK for financial/sovereignty regulations.'
    },
    {
      question: 'To comply with GDPR, a company needs to guarantee that personal data of European customers never leaves the European Union. Which Azure mechanism should be implemented?',
      options: [
        'Manually configure each resource in the correct region',
        'Azure Policy with the "Allowed locations" initiative restricted to EU regions, applied at the Management Group',
        'Use only Azure Germany (sovereign) for European data',
        'Configure geo-replication only to European regions'
      ],
      correct: 1,
      explanation: 'Azure Policy "Allowed locations" (ID: e56962a6-...) blocks the creation of resources in unauthorized regions. Applied at the Management Group, it guarantees that ALL resources (present and future) can only be created in approved regions. Manual configuration per resource is error-prone and does not scale. Policy = automatic and consistent governance.',
      reference: 'Data Residency section — Policy at the Management Group ensures compliance at scale for all subscriptions.'
    },
    {
      question: 'What is Microsoft Purview and what compliance problem does it solve?',
      options: [
        'It is a replacement for Azure Active Directory for authentication',
        'It is a data governance platform that automatically discovers, classifies, and catalogs sensitive data (PII, PCI, etc.) across the entire Azure environment',
        'It is a database performance monitoring tool',
        'It is the compliance portal that replaced the Microsoft Trust Center'
      ],
      correct: 1,
      explanation: 'Microsoft Purview automates the data inventory: it scans sources (Azure SQL, Blob, Power BI, on-premises) and automatically classifies sensitive data using ML (recognizes card numbers, SSN, passwords, etc.). This is essential for GDPR/LGPD: you need to know WHERE personal data is located to report violations (Art. 33 of GDPR requires notification within 72h). Without Purview, this mapping is manual and error-prone.',
      reference: 'Microsoft Purview section — it is the Azure Data Governance tool. Fundamental for GDPR, LGPD, and personal data regulations.'
    }
  ],

  flashcards: [
    {
      front: 'What are the main compliance frameworks available in Azure and how do you monitor them?',
      back: '**Available frameworks** (Defender for Cloud):\n- ISO 27001, ISO 27017, ISO 27018\n- SOC 1, SOC 2, SOC 3\n- PCI DSS 3.2.1\n- NIST SP 800-53, FedRAMP\n- GDPR, LGPD\n- CIS Microsoft Azure Foundations Benchmark\n- HIPAA/HITRUST\n\n**Monitor**:\n```bash\naz security regulatory-compliance-standards list\naz security regulatory-compliance-controls list \\\n  --standard-name "ISO-27001"\n```\n\n**Portal**: Defender for Cloud → Regulatory Compliance → view score and failing controls.'
    },
    {
      front: 'What is BYOK (Bring Your Own Key) and when is it required?',
      back: '**BYOK** = customer generates cryptographic keys in their own HSM (Hardware Security Module) and imports them into Azure Key Vault Managed HSM.\n\n**When to use**:\n- Regulations requiring that keys NEVER leave customer control (e.g., banking regulations, defense)\n- Complete cryptographic separation from the cloud provider\n- Audit of the full key lifecycle\n\n**Flow**:\n1. Generate KEK (Key Exchange Key) on the customer HSM\n2. Export in BYOK format\n3. Import into Azure Key Vault Managed HSM\n4. The original key never touched Microsoft hardware\n\n**Less rigorous alternative**: CMK (Customer-Managed Key) where the customer creates the key inside Azure Key Vault.'
    }
  ],

  lab: {
    scenario: 'Verify compliance of a subscription using Microsoft Defender for Cloud and configure a data residency Policy.',
    objective: 'Explore Regulatory Compliance in Defender for Cloud and implement data residency control via Policy.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Explore Regulatory Compliance via CLI',
        instruction: 'Check the available compliance frameworks and the current state of the subscription.',
        hints: ['az security regulatory-compliance-standards list', 'az security secure-score-controls list'],
        solution: `\`\`\`bash
# View available compliance frameworks
az security regulatory-compliance-standards list \
  --query "[].{Name:name,State:state}" -o table 2>/dev/null || \
  echo "Check via portal: Defender for Cloud → Regulatory Compliance"

# View failing controls (if Defender is enabled)
az security regulatory-compliance-controls list \
  --standard-name "Azure-CIS-1.4.0" \
  --query "[?state=='Failed'].{Control:name}" -o table 2>/dev/null | head -10 || \
  echo "Select an available standard"

# View current Secure Score
az security secure-score-controls list \
  --query "[].{Control:displayName,Score:score.current,Max:score.max}" \
  -o table 2>/dev/null | head -10
\`\`\``,
        verify: `\`\`\`bash
echo "Compliance explored via CLI"
echo "For full analysis: Portal → Defender for Cloud → Regulatory Compliance"
echo "Ideal score: > 80% indicates good security posture"
\`\`\``
      },
      {
        title: 'Create Data Residency Policy',
        instruction: 'Create an Azure Policy that restricts resources to specific regions (simulating LGPD/GDPR).',
        hints: ['Built-in Policy: e56962a6-4747-49cd-b67b-bf8b01975c4f (Allowed locations)', 'Assignment at current resource group'],
        solution: `\`\`\`bash
az group create --name rg-compliance-lab --location eastus

# Create assignment of "Allowed locations" Policy restricted to eastus and westus
SUB_ID=$(az account show --query id -o tsv)

az policy assignment create \
  --name data-residency-policy \
  --display-name "Data Residency - East/West US only" \
  --policy "e56962a6-4747-49cd-b67b-bf8b01975c4f" \
  --scope "/subscriptions/$SUB_ID/resourceGroups/rg-compliance-lab" \
  --params '{"listOfAllowedLocations": {"value": ["eastus", "westus2"]}}'

echo "Policy created - resources outside eastus/westus2 will be blocked in this RG"
\`\`\``,
        verify: `\`\`\`bash
# Verify the policy was created
az policy assignment show \
  --name data-residency-policy \
  --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-compliance-lab" \
  --query "{Name:name,Policy:policyDefinitionId}" -o table

# Test creating a resource in a disallowed region (should fail)
az storage account create --name blockedtest123 \
  --resource-group rg-compliance-lab \
  --location brazilsouth 2>&1 | grep -i "disallowed\|denied\|policy" || \
  echo "Policy may take up to 30min to be applied"

az group delete --name rg-compliance-lab --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Compliance Policy not preventing resource creation outside the allowed region',
      difficulty: 'easy',
      symptom: 'An Azure Policy "Allowed locations" was created and assigned, but resources are still being created in unauthorized regions.',
      diagnosis: `\`\`\`bash
# Check assignment state
az policy assignment show --name my-location-policy \
  --scope /subscriptions/... \
  --query "{Name:name,Mode:policyDefinitionId,Enforcement:enforcementMode}" -o json

# View compliance state (takes up to 30 min to update)
az policy state list \
  --query "[?complianceState=='NonCompliant'].{Resource:resourceId}" -o table | head -10
\`\`\``,
      solution: `**Common causes**:

1. **EnforcementMode = DoNotEnforce**: check if the assignment is in audit mode instead of blocking:
\`\`\`bash
az policy assignment update --name my-location-policy \
  --scope /subscriptions/... \
  --enforcement-mode Default  # Default = enforce, DoNotEnforce = audit only
\`\`\`

2. **Incorrect scope**: Policy assigned at the RG but resources created in another RG or at the subscription level.

3. **Propagation delay**: new assignments take up to 30 minutes to be applied. Wait and test again.

4. **Exemption created**: check if there is an exemption that bypasses the policy for a specific resource:
\`\`\`bash
az policy exemption list --scope /subscriptions/.../resourceGroups/myRG
\`\`\``
    }
  ]
};
