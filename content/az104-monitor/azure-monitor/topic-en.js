window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-monitor/azure-monitor'] = {
  theory: `# Azure Monitor & Log Analytics

## Exam Relevance
> Estimated weight **10-15%** on AZ-104. Questions about log collection, alerts and diagnosing problems are frequent.

## Core Concepts

### Azure Monitor
Azure's unified monitoring platform that collects:
- **Metrics**: numerical time-series data (CPU%, requests/sec, latency)
- **Logs**: structured/unstructured text data (events, traces, diagnostics)
- **Traces**: distributed application tracing (via Application Insights)

### Monitoring Hierarchy

\`\`\`
Azure Monitor
  ├─ Metrics (93-day retention, high granularity)
  ├─ Logs → Log Analytics Workspace (KQL queries)
  │    ├─ Activity Logs (Azure ARM control-plane operations)
  │    ├─ Resource Logs (resource diagnostics)
  │    └─ Guest OS Logs (via Azure Monitor Agent)
  ├─ Alerts (alert rules + Action Groups)
  └─ Application Insights (APM for apps)
\`\`\`

### Log Analytics Workspace (LAW)
Centralized log repository for queries with **KQL** (Kusto Query Language):
- Default retention: **30 days** (configurable up to 730 days)
- KQL queries: filters, joins, aggregations, visualizations
- Can aggregate logs from multiple subscriptions and resources

### Activity Log
A record of all control-plane operations (Azure ARM):
- Who created/deleted/modified which resource?
- Audit trail for administrative operations
- Default retention: **90 days**
- For longer retention: export to Log Analytics, Storage or Event Hub

### Azure Monitor Agent (AMA)
Replaced the Log Analytics Agent (MMA/OMS) and the Diagnostics Extension. Collects:
- OS logs (Windows Event Log, Linux Syslog)
- Custom metrics
- Configured via **Data Collection Rules (DCR)**

### Alerts
**Alert Rule** = a condition that triggers notifications:
- **Metric Alert**: based on metrics (e.g. CPU > 80% for 5 min)
- **Log Alert**: based on a KQL query (e.g. error count > 10 in 1h)
- **Activity Log Alert**: specific Azure operations (e.g. "VM deleted")
- **Smart Detection**: automatic anomalies via Application Insights

**Action Group**: defines who to notify and how when an alert fires:
- Email, SMS, push notification
- ITSM integration (ServiceNow, Jira)
- Azure Function, Logic App, Webhook
- Automation Runbook

### Insights (ready-made Workbooks)
- **VM Insights**: VM performance, dependency maps
- **Container Insights**: AKS and container metrics
- **Network Insights**: topology and network diagnostics

## Essential Commands (Azure CLI)

\`\`\`bash
# Create a Log Analytics Workspace
az monitor log-analytics workspace create \\
  --workspace-name myLAW \\
  --resource-group myRG \\
  --location eastus \\
  --retention-time 90

# Configure diagnostics for a VM to send to the LAW
LAW_ID=$(az monitor log-analytics workspace show \\
  --workspace-name myLAW --resource-group myRG --query id -o tsv)

az monitor diagnostic-settings create \\
  --name vm-diagnostics \\
  --resource <vm-resource-id> \\
  --workspace $LAW_ID \\
  --metrics '[{"category":"AllMetrics","enabled":true}]' \\
  --logs '[{"category":"Administrative","enabled":true}]'

# Create an Action Group
az monitor action-group create \\
  --name ops-team \\
  --resource-group myRG \\
  --short-name ops \\
  --email-receivers name=oncall address=ops@contoso.com

# Create a metric alert rule (CPU > 80%)
az monitor metrics alert create \\
  --name "High CPU Alert" \\
  --resource-group myRG \\
  --scopes <vm-resource-id> \\
  --condition "avg Percentage CPU > 80" \\
  --window-size 5m \\
  --evaluation-frequency 1m \\
  --action ops-team \\
  --severity 2

# Create an Activity Log alert (VM deleted)
az monitor activity-log alert create \\
  --name "VM Deleted Alert" \\
  --resource-group myRG \\
  --scope /subscriptions/<sub-id> \\
  --condition category=Administrative \\
  --condition operationName=Microsoft.Compute/virtualMachines/delete \\
  --action-group <action-group-id>

# Query VM metrics
az monitor metrics list \\
  --resource <vm-resource-id> \\
  --metric "Percentage CPU" \\
  --interval PT5M \\
  --start-time 2024-01-01T00:00:00Z \\
  --end-time 2024-01-01T01:00:00Z \\
  --query "value[0].timeseries[0].data[-3:]" -o table

# Run a KQL query on Log Analytics
az monitor log-analytics query \\
  --workspace $LAW_ID \\
  --analytics-query "Heartbeat | where TimeGenerated > ago(1h) | summarize count() by Computer" \\
  --timespan P1H
\`\`\`

## Basic KQL for the Exam

\`\`\`kql
// Top 10 errors in the last hour
AzureDiagnostics
| where TimeGenerated > ago(1h)
| where Level == "Error"
| summarize count() by ResourceId
| top 10 by count_

// Activity Log: who deleted resources?
AzureActivity
| where OperationNameValue contains "delete"
| where ActivityStatusValue == "Success"
| project TimeGenerated, Caller, OperationNameValue, ResourceGroup

// Average CPU per VM over the last 6 hours
Perf
| where TimeGenerated > ago(6h)
| where CounterName == "% Processor Time"
| summarize avg(CounterValue) by Computer, bin(TimeGenerated, 1h)
\`\`\`

## Common Mistakes

1. **Activity Log 90-day retention**: for long-term auditing, export to Storage Account or Log Analytics.
2. **Alert in "Fired" state sends no email**: check the Action Group — the email may not have been verified correctly.
3. **Metrics vs Logs**: metrics are real-time numerical data; logs require a KQL query and have higher latency.
4. **LAW without an agent on the VM**: the workspace only receives OS logs if the Azure Monitor Agent is installed and configured with a DCR.

## Killer.sh Style Challenge

> **Scenario**: Configure monitoring for a critical application:
> 1. Create a LAW with 90-day retention
> 2. Create an alert when CPU on any VM in the RG exceeds 80% for 5 minutes
> 3. Notify the operations team by email
> 4. Create an Activity Log alert to detect VM deletion in the subscription
>
> **Describe the required steps and resources.**
`,

  quiz: [
    {
      question: 'What is the default retention period for the Activity Log in Azure and how can it be extended?',
      options: [
        '30 days — configure in the Log Analytics Workspace',
        '90 days — export to Log Analytics, Storage Account or Event Hub for longer retention',
        '365 days — cannot be changed',
        '7 days — create an alert for automatic backup'
      ],
      correct: 1,
      explanation: 'The Activity Log has a default retention of 90 days. To keep it longer, configure Diagnostic Settings on the Activity Log to export to: Log Analytics Workspace (up to 730 days), Storage Account (customizable retention, cheaper) or Event Hub (streaming to an external SIEM).',
      reference: 'Activity Log = ARM operation audit trail. 90-day default. For compliance, export to Storage or LAW.'
    },
    {
      question: 'What is the difference between a Metric Alert and a Log Alert in Azure Monitor?',
      options: [
        'Metric Alert is for VMs; Log Alert is for Storage Accounts',
        'Metric Alert evaluates numerical time-series data near real time; Log Alert runs KQL queries on logs with higher latency',
        'Log Alert is cheaper than Metric Alert',
        'There is no technical difference — they are configured the same way'
      ],
      correct: 1,
      explanation: 'Metric Alerts evaluate numerical data (CPU%, requests/sec) at 1–5 minute intervals — near real time. Log Alerts run KQL queries on logs in the Log Analytics Workspace, with higher latency (data can take minutes to arrive) but much more flexible — they can detect complex patterns like "more than 10 500 errors in 1 hour".',
      reference: 'Use Metric Alerts for immediate performance/availability. Use Log Alerts for complex patterns and event correlation.'
    },
    {
      question: 'You want to receive an SMS when a VM is accidentally deleted in your subscription. Which type of alert should you configure?',
      options: [
        'Metric Alert with metric "VM Count"',
        'Log Alert with a LAW query',
        'Activity Log Alert for operation Microsoft.Compute/virtualMachines/delete',
        'Smart Detection Alert from Application Insights'
      ],
      correct: 2,
      explanation: 'Activity Log Alerts fire based on control-plane (ARM) operations, including resource creation, modification and deletion. To detect VM deletion, configure an Activity Log Alert with category=Administrative and operationName=Microsoft.Compute/virtualMachines/delete, associated with an Action Group that has SMS.',
      reference: 'Activity Log Alert = real-time audit of ARM operations (who did what). Ideal for compliance and change detection.'
    },
    {
      question: 'What is an Action Group in Azure Monitor?',
      options: [
        'A group of resources monitored together',
        'A collection of actions (notifications, webhooks, runbooks) that run when an alert fires',
        'A group of alert rules applied to the same resource',
        'An Entra ID group with monitoring permissions'
      ],
      correct: 1,
      explanation: 'An Action Group defines "how to react" when an alert fires. It can include: send email/SMS/push notification, call a webhook or Azure Function, run a Logic App, integrate with an ITSM (ServiceNow), run an Azure Automation Runbook. One Action Group can be reused across multiple Alert Rules.',
      reference: 'Alert Rule = "when" to alert. Action Group = "how/who" to notify. Separate these responsibilities for reuse.'
    },
    {
      question: 'Which language is used to query logs in a Log Analytics Workspace?',
      options: [
        'SQL (Structured Query Language)',
        'KQL (Kusto Query Language)',
        'Gremlin (Apache TinkerPop)',
        'MongoDB Query Language'
      ],
      correct: 1,
      explanation: 'KQL (Kusto Query Language) is the query language for Azure Monitor Log Analytics. It is a pipeline language (similar to shell pipes) optimized for log analysis. Basic example: \`AzureActivity | where OperationNameValue contains "delete" | project TimeGenerated, Caller\`.',
      reference: 'KQL is also used in Microsoft Sentinel, Azure Data Explorer and Azure Resource Graph. Worth learning the basics for the exam.'
    }
  ],

  flashcards: [
    {
      front: 'What is the Azure Monitor monitoring hierarchy?',
      back: '``\`\nAzure Monitor\n  ├─ Metrics — numeric data, 93 days, high granularity\n  ├─ Logs → Log Analytics Workspace\n  │    ├─ Activity Logs (ARM operations - 90-day default)\n  │    ├─ Resource Logs (resource diagnostics)\n  │    └─ Guest OS Logs (via Azure Monitor Agent + DCR)\n  ├─ Alerts (Metric / Log / Activity Log)\n  │    └─ → Action Groups (email, SMS, webhook, runbook)\n  └─ Application Insights (APM)\n\```'
    },
    {
      front: 'What are the 3 alert types in Azure Monitor?',
      back: '1. **Metric Alert** — based on numerical time-series data (CPU, requests/sec). Near-real-time evaluation (1–5 min).\n\n2. **Log Alert** — KQL query over logs in the LAW. More flexible, higher latency. Detects complex patterns.\n\n3. **Activity Log Alert** — triggered by ARM operations (create, delete, modify resources). Ideal for auditing and compliance.'
    },
    {
      front: 'How long does the Activity Log retain data by default? How to extend it?',
      back: '**Default: 90 days**\n\nTo extend, configure **Diagnostic Settings** on the Activity Log (subscription level) to export to:\n- **Log Analytics Workspace** — up to 730 days, KQL queries\n- **Storage Account** — configurable retention, cheaper\n- **Event Hub** — streaming to an external SIEM (Splunk, IBM QRadar)\n\nPortal: Monitor → Activity Log → Export Activity Logs'
    },
    {
      front: 'What is a Log Analytics Workspace and how do you query the data?',
      back: '**Log Analytics Workspace (LAW)** is Azure Monitor\'s centralized log repository.\n\n- Query language: **KQL (Kusto Query Language)**\n- Retention: 30-day default, up to 730 days configurable\n- Can receive logs from multiple regions/subscriptions\n\nKQL example:\n``\`kql\nAzureActivity\n| where TimeGenerated > ago(24h)\n| where OperationNameValue contains "delete"\n| project TimeGenerated, Caller, ResourceGroup\n\```'
    }
  ],

  lab: {
    scenario: 'Configure basic monitoring for TechNova Azure resources with a Log Analytics Workspace and CPU alerts.',
    objective: 'Create a LAW, configure diagnostic settings and create an alert rule with an action group.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create a Log Analytics Workspace',
        instruction: 'Create a Log Analytics Workspace \`technova-law\` with 90-day retention.',
        hints: ['Use \`az monitor log-analytics workspace create\`'],
        solution: `\`\`\`bash
az group create --name rg-monitor-lab --location eastus

az monitor log-analytics workspace create \\
  --workspace-name technova-law \\
  --resource-group rg-monitor-lab \\
  --location eastus \\
  --retention-time 90

LAW_ID=$(az monitor log-analytics workspace show \\
  --workspace-name technova-law \\
  --resource-group rg-monitor-lab \\
  --query id -o tsv)
echo "LAW ID: $LAW_ID"
\`\`\``,
        verify: `\`\`\`bash
az monitor log-analytics workspace show \\
  --workspace-name technova-law \\
  --resource-group rg-monitor-lab \\
  --query "{Name:name,Retention:retentionInDays,Status:provisioningState}" -o table
# Output: Retention 90, Status Succeeded
\`\`\``
      },
      {
        title: 'Create an Action Group for notifications',
        instruction: 'Create an Action Group \`ops-alerts\` that sends email when an alert fires.',
        hints: ['Use \`az monitor action-group create\` with \`--email-receivers\`'],
        solution: `\`\`\`bash
az monitor action-group create \\
  --name ops-alerts \\
  --resource-group rg-monitor-lab \\
  --short-name opsalert \\
  --email-receivers name=admin address=admin@contoso.com

AG_ID=$(az monitor action-group show \\
  --name ops-alerts \\
  --resource-group rg-monitor-lab \\
  --query id -o tsv)
echo "Action Group ID: $AG_ID"
\`\`\``,
        verify: `\`\`\`bash
az monitor action-group show \\
  --name ops-alerts \\
  --resource-group rg-monitor-lab \\
  --query "{Name:name,Emails:emailReceivers[].emailAddress}" -o json
\`\`\``
      },
      {
        title: 'Create an Activity Log Alert for RG deletion',
        instruction: 'Create an alert that detects when any Resource Group is deleted in the subscription.',
        hints: ['\`az monitor activity-log alert create\` with \`--condition category=Administrative\`'],
        solution: `\`\`\`bash
SUB_ID=$(az account show --query id -o tsv)
AG_ID=$(az monitor action-group show --name ops-alerts --resource-group rg-monitor-lab --query id -o tsv)

az monitor activity-log alert create \\
  --name "RG-Deletion-Alert" \\
  --resource-group rg-monitor-lab \\
  --scope /subscriptions/$SUB_ID \\
  --condition "category=Administrative and operationName=Microsoft.Resources/subscriptions/resourceGroups/delete" \\
  --action-groups $AG_ID \\
  --description "Alert: Resource Group was deleted"

echo "Activity Log Alert created!"
\`\`\``,
        verify: `\`\`\`bash
az monitor activity-log alert list \\
  --resource-group rg-monitor-lab \\
  --query "[].{Name:name,Enabled:enabled}" -o table
# Expected output: RG-Deletion-Alert | True
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the lab Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-monitor-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-monitor-lab 2>/dev/null && echo "Deleting..." || echo "RG removed"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Alert fired but no email was received',
      difficulty: 'easy',
      symptom: 'A Metric Alert shows as "Fired" in the Azure Monitor portal, but no team member received the email.',
      diagnosis: `\`\`\`bash
# Check the Action Group configured on the alert
az monitor metrics alert show --name "my-alert" --resource-group myRG \\
  --query "actions[].actionGroupId" -o tsv

# Check the Action Group receivers
az monitor action-group show --ids <action-group-id> \\
  --query "emailReceivers" -o json
\`\`\``,
      solution: `**Possible causes:**

1. **Email not verified**: if the email was added manually, it may require verification. Check in the portal whether there is a pending confirmation on the Action Group.

2. **Email in spam**: check the spam/junk folder — Azure Monitor emails may be filtered.

3. **Wrong Action Group**: check whether the alert is associated with the correct Action Group.

4. **Rate limiting**: Azure Monitor may suppress alerts if they fire too frequently (throttled alerts). Check the alert history for "Suppressed" entries.

5. **Rule disabled**: check whether the alert is enabled: \`az monitor metrics alert show --query enabled\`.`
    },
    {
      title: 'Logs not appearing in Log Analytics after configuring diagnostic settings',
      difficulty: 'medium',
      symptom: 'After configuring Diagnostic Settings to send VM logs to the Log Analytics Workspace, KQL queries return zero results.',
      diagnosis: `\`\`\`bash
# Check whether the Diagnostic Settings were created correctly
az monitor diagnostic-settings list --resource <vm-resource-id> -o json

# Check whether the LAW ID is correct in the diagnostic setting
az monitor diagnostic-settings show \\
  --name vm-diagnostics \\
  --resource <vm-resource-id> \\
  --query "workspaceId" -o tsv

# Check whether the agent is installed on the VM
az vm extension list --vm-name myVM --resource-group myRG \\
  --query "[].{Name:name,State:provisioningState}" -o table
\`\`\``,
      solution: `**Possible causes:**

1. **Wait for ingestion**: logs can take **5–15 minutes** to appear in the LAW after configuration.

2. **Azure Monitor Agent not installed**: for OS logs (not just platform diagnostics), the Azure Monitor Agent must be on the VM + a Data Collection Rule configured.

3. **Incorrect Diagnostic Settings**: check that the workspace ID is correct and that the desired log categories are enabled.

4. **KQL query time filter too narrow**: KQL queries with \`ago(5m)\` may not have data yet — test with \`ago(1h)\` or \`ago(1d)\`.

5. **Different LAW**: confirm that you are querying the correct workspace.`
    }
  ]
};
