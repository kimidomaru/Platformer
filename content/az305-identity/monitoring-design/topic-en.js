window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-identity/monitoring-design'] = {
  theory: `# Monitoring Solutions Design (AZ-305)

## Exam Relevance
> Estimated weight **10-15%** in AZ-305. The exam evaluates the ability to design a complete monitoring strategy — not just configuring alerts, but deciding which workspace, what data to collect, and how to structure it for scale.

## Azure Monitor — Design Hierarchy

\`\`\`
Azure Monitor (central platform)
  ├─ Metrics (numeric, 93 days retention, <1min granularity)
  │    └─ Metric Alerts → Action Groups → Notification/Automation
  ├─ Logs (text/JSON, Log Analytics Workspace)
  │    ├─ Activity Log (audit of control plane operations)
  │    ├─ Resource Logs (resource diagnostics)
  │    └─ VM/Container Logs (agents)
  ├─ Application Insights (APM for applications)
  └─ Alerts
       ├─ Metric Alerts
       ├─ Log Query Alerts
       ├─ Activity Log Alerts
       └─ Smart Alerts (anomaly detection)
\`\`\`

## Log Analytics Workspace — Design Strategy

### How many workspaces to create?

| Factor | Centralized (1 workspace) | Distributed (N workspaces) |
|--------|--------------------------|--------------------------|
| Compliance | Data in same required region? | Data in different regions |
| Cost | Commitment tiers (volume savings) | Separate costs per team |
| Access | Granular RBAC per table | Complete isolation |
| Retention | Different per table | Different per workspace |
| Troubleshooting | Cross-resource queries easy | Cross-workspace queries more complex |

**Microsoft recommendation**: centralized by default + second workspace for compliance/isolation.

### Retention and Archiving

\`\`\`bash
# Configure interactive retention and archiving per table
az monitor log-analytics workspace table update \
  --workspace-name myws --resource-group myRG \
  --name SecurityEvent \
  --retention-time 90 \           # days in "hot" (interactive) state
  --total-retention-time 730      # total including archive (2 years)

# Archive = cheaper tier, requires restoration for queries
\`\`\`

### KQL for Alert Design

\`\`\`kql
// Alert: VM CPU > 90% for 15 minutes
Perf
| where ObjectName == "Processor" and CounterName == "% Processor Time"
| where CounterValue > 90
| summarize avg(CounterValue) by Computer, bin(TimeGenerated, 5m)
| where avg_CounterValue > 90

// Alert: Failed logins (Security)
SecurityEvent
| where EventID == 4625
| summarize FailedLogins = count() by Account, Computer, bin(TimeGenerated, 15m)
| where FailedLogins > 10

// Alert: Application errors
AppExceptions
| where SeverityLevel == "Error"
| summarize ErrorCount = count() by Type, bin(TimeGenerated, 5m)
| where ErrorCount > 50
\`\`\`

## Application Insights — Design for Applications

\`\`\`bash
# Create Application Insights
az monitor app-insights component create \
  --app myapp-insights \
  --resource-group myRG \
  --location eastus \
  --workspace /subscriptions/.../workspaces/myws  # workspace-based (recommended)

# Get instrumentation key
az monitor app-insights component show \
  --app myapp-insights --resource-group myRG \
  --query "instrumentationKey" -o tsv
\`\`\`

**Workspace-based vs Classic Application Insights**: workspace-based (recommended) integrates data in Log Analytics, allows unified KQL, and granular RBAC.

### Sampling Strategy

For high-volume applications, configure sampling to control cost:

\`\`\`json
{
  "sampling": {
    "percentage": 10,
    "isAdaptive": true,
    "maxTelemetryItemsPerSecond": 5
  }
}
\`\`\`

## Diagnostic Settings — Centralized Collection

\`\`\`bash
# Enable diagnostic settings on a resource (e.g., Key Vault)
az monitor diagnostic-settings create \
  --name "to-workspace" \
  --resource /subscriptions/.../vaults/mykeyvault \
  --workspace /subscriptions/.../workspaces/myws \
  --logs '[{"category":"AuditEvent","enabled":true}]' \
  --metrics '[{"category":"AllMetrics","enabled":true}]'

# Enable on all resources in an RG (via Policy)
# Use initiative "Enable Azure Monitor for VMs" (built-in)
\`\`\`

## Azure Monitor Workbooks

Workbooks = interactive dashboards with KQL:

\`\`\`kql
// Workbook: Application health overview
requests
| where timestamp > ago(24h)
| summarize
    TotalRequests = count(),
    FailedRequests = countif(success == false),
    AvgDuration = avg(duration),
    P95Duration = percentile(duration, 95)
by bin(timestamp, 1h)
| render timechart
\`\`\`

## Pattern: Multi-Layer Monitoring

\`\`\`
Layer 1: Infrastructure (VMs, AKS nodes)
  → Azure Monitor Agent → Log Analytics Workspace
  → Metric Alerts for CPU/Memory/Disk

Layer 2: Platform (AKS, App Service, SQL)
  → Resource Logs → Log Analytics
  → Container Insights, SQL Insights

Layer 3: Application (code)
  → Application Insights (SDK or auto-instrumentation)
  → Distributed tracing, exceptions, performance

Layer 4: Business (KPIs)
  → Custom Metrics / Custom Events in App Insights
  → Workbooks for executive dashboards
\`\`\`

## Common Design Mistakes

1. **Too many workspaces without need**: multiple workspaces fragment data and complicate cross-resource queries.
2. **No sampling in App Insights**: high-traffic applications without sampling generate excessive ingestion costs.
3. **Activity Log without export**: Activity Log retains only 90 days — export to workspace for longer history.
4. **Default retention for compliance data**: SecurityEvent with 30-day retention may violate compliance (HIPAA, ISO 27001 require 1+ years).
5. **Classic Application Insights**: migrate to workspace-based for better integration and features.

## Killer.sh Style Challenge (AZ-305)

> A company with 3 environments (dev, staging, prod) needs:
> - Security data retained for 2 years (compliance)
> - Separate costs per team via tags
> - Dev and staging: 30-day retention (cost)
> - Prod: cross-resource queries between VMs, App Service, and SQL
>
> **Solution**: 2 workspaces: (1) "prod" for all production resources with SecurityEvent table retention=730 days; (2) "nonprod" for dev/staging with retention=30 days. Use resource tags + Azure Cost Management for team chargeback. Workspace-based Application Insights pointing to the "prod" workspace. Azure Policy DeployIfNotExists to ensure diagnostic settings on all resources.
`,

  quiz: [
    {
      question: 'What is the difference between Metrics and Logs in Azure Monitor and when should you use each?',
      options: [
        'Metrics are more expensive; Logs are free',
        'Metrics are numeric time series (for threshold alerts and real-time dashboards); Logs are rich/textual data stored in Log Analytics (for investigation and complex analysis)',
        'Metrics are for VMs; Logs are for applications',
        'There is no technical difference — they are redundant'
      ],
      correct: 1,
      explanation: 'Metrics are high-frequency numeric time series (1 minute), with 93-day retention, ideal for threshold alerts (CPU > 80%) and real-time dashboards with low latency. Logs are rich textual/JSON data stored in Log Analytics with configurable retention (up to years), queried via KQL for complex analysis, troubleshooting, and cross-resource correlation.',
      reference: 'Azure Monitor hierarchy — Metrics for fast alerts; Logs for deep analysis and correlation.'
    },
    {
      question: 'When is it justified to have multiple Log Analytics Workspaces instead of a centralized one?',
      options: [
        'Whenever there are more than 5 resources to monitor',
        'When there are compliance requirements that mandate data in separate geographic regions, or when different teams need complete data isolation',
        'Multiple workspaces always improve query performance',
        'It is mandatory to have one workspace per subscription'
      ],
      correct: 1,
      explanation: 'The Microsoft recommendation is to centralize in a single workspace to simplify cross-resource queries and take advantage of commitment tiers (volume discounts). Justifications for separate workspaces: data that must stay in specific regions (GDPR, data sovereignty), complete isolation of teams or business units, or different retention policies due to regulation.',
      reference: 'Log Analytics Workspace section — centralized is the default; add workspaces only when there is a real need.'
    },
    {
      question: 'What is the recommended strategy for managing retention of security data (SecurityEvent) that must be retained for 2 years for compliance?',
      options: [
        'Create a separate Storage Account and manually copy logs',
        'Configure retention-time=30 and total-retention-time=730 on the SecurityEvent table in Log Analytics (interactive + archive)',
        'Use a second Log Analytics Workspace only for security data',
        'Export to Azure Blob Storage with a lifecycle policy for Archive'
      ],
      correct: 1,
      explanation: 'Log Analytics supports two retention levels per table: Interactive (hot, normally queryable) and Archive (low cost, requires restoration for queries). Configuring --retention-time=90 (interactive) and --total-retention-time=730 (includes archive) on the SecurityEvent table guarantees 2 years of retention with optimized cost — 90 days of fast access + the rest in archive.',
      reference: 'Retention and Archiving section — configure per table to balance cost vs access needs.'
    }
  ],

  flashcards: [
    {
      front: 'What is the design hierarchy of Azure Monitor?',
      back: '**4 monitoring layers**:\n\n1. **Infra** (VMs, nodes): Azure Monitor Agent → Log Analytics → Metric Alerts for CPU/mem/disk\n\n2. **Platform** (AKS, App Service, SQL): Resource Logs → Log Analytics → Container Insights, SQL Insights\n\n3. **Application** (code): Application Insights SDK → distributed tracing, exceptions, performance\n\n4. **Business** (KPIs): Custom Metrics/Events → Workbooks for executive dashboards\n\nEach layer adds different visibility — monitor all for complete coverage.'
    },
    {
      front: 'When to use Application Insights vs Log Analytics directly?',
      back: '**Application Insights** (workspace-based recommended):\n- Application code monitoring\n- Distributed tracing (end-to-end request tracking)\n- Exceptions and function performance\n- Browser/mobile telemetry\n- SDK or auto-instrumentation\n\n**Log Analytics directly**:\n- Infrastructure logs (VMs, containers)\n- Security logs (Activity Log, SecurityEvent)\n- Resource diagnostics\n- Cross-resource correlation via KQL\n\n**Workspace-based App Insights**: App Insights data lives in Log Analytics → unified KQL queries across infra + app.'
    }
  ],

  lab: {
    scenario: 'Configure a centralized monitoring strategy with Log Analytics and Log Query alerts.',
    objective: 'Create a Log Analytics workspace, configure diagnostic settings, and create a KQL-based alert rule.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Log Analytics Workspace and configure retention',
        instruction: 'Create a workspace with custom retention for security data.',
        hints: ['az monitor log-analytics workspace create', 'az monitor log-analytics workspace table update for per-table retention'],
        solution: `\`\`\`bash
az group create --name rg-monitoring-design --location eastus

az monitor log-analytics workspace create \
  --workspace-name technova-monitoring \
  --resource-group rg-monitoring-design \
  --location eastus \
  --retention-time 30          # default retention 30 days

WS_ID=$(az monitor log-analytics workspace show \
  --workspace-name technova-monitoring \
  --resource-group rg-monitoring-design \
  --query id -o tsv)

echo "Workspace ID: $WS_ID"
echo "WS_ID=$WS_ID" > /tmp/monitoringlab.sh
\`\`\``,
        verify: `\`\`\`bash
az monitor log-analytics workspace show \
  --workspace-name technova-monitoring \
  --resource-group rg-monitoring-design \
  --query "{Name:name,Retention:retentionInDays,Status:provisioningState}" -o table
# Expected: technova-monitoring, retentionInDays=30, Succeeded
\`\`\``
      },
      {
        title: 'Create workspace-based Application Insights',
        instruction: 'Create an Application Insights component linked to the previously created workspace.',
        hints: ['az monitor app-insights component create --workspace', 'Workspace-based is the recommended approach'],
        solution: `\`\`\`bash
source /tmp/monitoringlab.sh

az monitor app-insights component create \
  --app technova-appinsights \
  --resource-group rg-monitoring-design \
  --location eastus \
  --workspace "$WS_ID"

AI_KEY=$(az monitor app-insights component show \
  --app technova-appinsights \
  --resource-group rg-monitoring-design \
  --query "instrumentationKey" -o tsv)

echo "Instrumentation Key: $AI_KEY"
echo "Ready to instrument applications!"
\`\`\``,
        verify: `\`\`\`bash
az monitor app-insights component show \
  --app technova-appinsights \
  --resource-group rg-monitoring-design \
  --query "{Name:name,Type:applicationType,WorkspaceLinked:workspaceResourceId}" -o table
# Expected: technova-appinsights, web, with workspaceResourceId populated

az group delete --name rg-monitoring-design --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'KQL queries returning no data despite diagnostic settings being configured',
      difficulty: 'medium',
      symptom: 'Diagnostic settings were configured on a resource (e.g., Key Vault) pointing to Log Analytics, but queries on the AzureDiagnostics/KeyVaultData table return 0 rows.',
      diagnosis: `\`\`\`bash
# Verify diagnostic settings were applied correctly
az monitor diagnostic-settings list --resource /subscriptions/.../vaults/mykeyvault \
  --query "[].{Name:name,Workspace:workspaceId,Logs:logs[?enabled==true].category}" -o json

# Check in the workspace that the table exists
az monitor log-analytics workspace table list \
  --workspace-name myws --resource-group myRG \
  --query "[?contains(name,'KeyVault') || contains(name,'AzureDiagnostics')].name" -o tsv
\`\`\``,
      solution: `**Diagnostic checklist**:

1. **Wait for ingestion**: after creating diagnostic settings, it can take up to 15 minutes for the first logs to appear.

2. **Verify there was activity**: without operations on the resource, there are no logs. Try accessing the Key Vault to generate a diagnostic event.

3. **Wrong workspace**: confirm the query is being run in the correct workspace.

4. **Incorrect table**: Azure resources may use \`AzureDiagnostics\` (legacy) or specific tables (\`KeyVaultData\`). Check which table the resource uses:
\`\`\`kql
// List all tables with data in the workspace
search *
| distinct $table
\`\`\`

5. **Category filter**: verify that the correct category was enabled (e.g., AuditEvent for Key Vault, not just AllLogs).`
    }
  ]
};
