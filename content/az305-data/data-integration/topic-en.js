window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-data/data-integration'] = {
  theory: `# Designing Data Integration & Analytics Solutions (AZ-305)

## Exam Relevance
> Estimated weight **10-15%** on AZ-305. Questions about data pipelines, streaming and choosing between analytics services appear in design scenarios.

## Data Integration Services

### Azure Data Factory (ADF)
Managed ETL/ELT — orchestrates data movement and transformation:
- **Pipelines**: activity flow (copy, transform, execute)
- **Datasets**: source/destination data definition
- **Linked Services**: connection to external systems (SQL, Blob, Salesforce, etc.)
- **Integration Runtime (IR)**: compute for execution
  - **Azure IR**: serverless, managed by Azure
  - **Self-hosted IR**: for on-premises sources (installs a local agent)
  - **SSIS IR**: runs legacy SSIS packages

**When to use ADF:**
- Batch ETL/ELT pipelines
- Moving data between services (SQL → Data Lake → Synapse)
- Orchestrating complex data flows with dependencies
- Integrating with on-premises sources via Self-hosted IR

### Azure Synapse Analytics
Unified analytics platform:
- **Synapse SQL** (dedicated pools): DWU-based data warehouse
- **Synapse SQL** (serverless pools): query data lake without provisioning
- **Synapse Spark**: big data processing with Apache Spark
- **Synapse Pipelines**: ADF integrated within Synapse
- **Synapse Link**: CDC directly from Cosmos DB or SQL Server

### Azure Stream Analytics
Real-time stream processing:
- SQL-like query language
- Sources: Event Hub, IoT Hub, Blob Storage
- Outputs: SQL, Cosmos DB, Power BI, Event Hub, Blob
- Window functions: Tumbling, Hopping, Sliding, Session

\`\`\`sql
-- Stream Analytics example: temperature > 70°C alerts
SELECT
  IoTHub.ConnectionDeviceId AS deviceId,
  AVG(temperature) AS avgTemp,
  System.Timestamp AS windowEnd
FROM IoTInput TIMESTAMP BY EventEnqueuedUtcTime
GROUP BY
  IoTHub.ConnectionDeviceId,
  TumblingWindow(minute, 5)
HAVING AVG(temperature) > 70
\`\`\`

### Azure Event Hub
High-volume streaming message broker:
- Up to millions of events per second
- Retention: 1–7 days (Standard), up to 90 days (Premium)
- **Capture**: automatically saves streams to Blob Storage/Data Lake
- Consumer groups for parallel reads
- Integrates with Stream Analytics, Functions, Spark

### Azure Service Bus
Message broker for application integration (not analytics):
- Queues: FIFO with deduplication
- Topics/Subscriptions: pub/sub with filters
- Dead-letter queue: failed messages
- **Difference from Event Hub**: Service Bus is for business messages (process once); Event Hub is for telemetry/streaming (multiple consumers)

## Decision Matrix

\`\`\`
Streaming in real time?
  ├─ YES + SQL-like analytics → Azure Stream Analytics
  ├─ YES + high volume (IoT telemetry) → Event Hub
  └─ YES + complex processing → Spark Streaming (Synapse/Databricks)

Batch ETL?
  ├─ No code, visual → Azure Data Factory
  ├─ Large volume + Spark → Synapse Spark / Azure Databricks
  └─ Legacy SSIS → ADF with SSIS IR

Application messaging?
  ├─ High scale, streaming → Event Hub
  └─ FIFO, transactions, dead-letter → Service Bus Queue/Topic

Interactive analytics on data lake?
  └─ Synapse Serverless SQL Pool (pay-per-query)
\`\`\`

## Lambda Architecture Pattern

\`\`\`
Raw data
  ├─ Batch Layer: ADF → Data Lake → Synapse Dedicated Pool
  │   (processes full history, slower, precise)
  └─ Speed Layer: Event Hub → Stream Analytics → Cosmos DB
      (processes last few hours, fast, approximate)
         ↓
    Serving Layer: combines batch + speed for queries
\`\`\`

## Common Design Mistakes

1. **Confusing Event Hub and Service Bus**: Event Hub = streaming/telemetry (many producers, multiple consumers). Service Bus = business messages (guaranteed once delivery, FIFO, dead-letter).
2. **Synapse Dedicated Pool always on**: Dedicated Pools charge even when paused — pause them outside usage hours.
3. **ADF without Self-hosted IR for on-premises**: without a Self-hosted IR installed, ADF cannot access on-premises data.

## Killer.sh Style Challenge (AZ-305)

> A company needs to:
> 1. Ingest data from 1,000 IoT sensors (10K events/second) for analysis
> 2. Detect anomalous temperatures in real time (<5s latency)
> 3. Store all raw data for historical analysis
> 4. Daily BI reports on averages and trends
>
> **Design the data pipeline.**
>
> **Answer**: IoT Hub (ingestion) → Event Hub (stream buffer) → Stream Analytics (anomaly detection → alerts via Service Bus) + Event Hub Capture (raw data → Data Lake). Daily ADF pipeline: Data Lake → Synapse Dedicated Pool. Power BI connects to Synapse for reports.
`,

  quiz: [
    {
      question: 'What is the main difference between Azure Event Hub and Azure Service Bus?',
      options: [
        'Event Hub is for structured data; Service Bus is for unstructured data',
        'Event Hub is for high-volume streaming/telemetry with multiple consumers; Service Bus is for business messages with guaranteed once delivery and FIFO',
        'Service Bus is faster than Event Hub in all scenarios',
        'There is no technical difference — they are interchangeable'
      ],
      correct: 1,
      explanation: 'Event Hub is designed for high-volume telemetry/logging (millions of events/sec), multiple consumer groups, 1–7 day retention, no dead-letter. Service Bus is for critical business messages: guaranteed FIFO, deduplication, dead-letter queue, sessions, transactions. Use Event Hub for IoT telemetry; Service Bus for purchase orders, critical notifications.',
      reference: 'Event Hub = high volume, telemetry, replay. Service Bus = guaranteed delivery, FIFO, dead-letter. Completely different use cases.'
    },
    {
      question: 'A company needs to run legacy SSIS packages in Azure as part of a migration. Which Azure Data Factory feature should be used?',
      options: [
        'Azure Integration Runtime',
        'Self-hosted Integration Runtime',
        'SSIS Integration Runtime (Azure-SSIS IR)',
        'Managed Integration Runtime'
      ],
      correct: 2,
      explanation: 'Azure-SSIS Integration Runtime is a managed cluster of nodes in Azure that runs SSIS packages natively, without needing a local SQL Server. It allows migrating legacy SSIS workloads to Azure without rewriting. It is provisioned and shut down on demand (you pay per hour of use).',
      reference: 'SSIS IR = lift-and-shift of SSIS packages to Azure. Self-hosted IR = connect ADF to on-premises sources (not SSIS specific).'
    },
    {
      question: 'Which Stream Analytics Window function would you use to count events in 5-minute windows without overlap, where each event belongs to only one window?',
      options: [
        'Sliding Window',
        'Hopping Window',
        'Tumbling Window',
        'Session Window'
      ],
      correct: 2,
      explanation: 'Tumbling Window divides time into fixed non-overlapping windows — each event belongs to exactly one window. Hopping Window can overlap (e.g. result every 1 min from 5-min windows). Sliding Window creates a new window for every event that has activity. Session Window groups events by inactivity.',
      reference: 'Tumbling = non-overlapping windows (0:00-5:00, 5:00-10:00). Hopping = overlap. Sliding = per event. Session = by inactivity.'
    }
  ],

  flashcards: [
    {
      front: 'When to use Azure Data Factory vs Azure Synapse Pipelines?',
      back: '**Azure Data Factory** (standalone):\n- Enterprise data orchestration\n- Integration with diverse sources (150+ connectors)\n- When the focus is ETL/ELT without integrated analytics\n\n**Azure Synapse Pipelines** (inside Synapse):\n- Same engine as ADF, but integrated into the Synapse workspace\n- When you are already using Synapse for analytics\n- Direct access to Synapse SQL Pools and Spark\n\nFunctionality: identical. Choose based on project context.'
    },
    {
      front: 'What is the Lambda Architecture and how to implement it in Azure?',
      back: '**Lambda Architecture** — processes data in two paths:\n\n**Batch Layer** (precise, slow):\n- ADF → Data Lake Storage Gen2 → Synapse SQL Pool\n- Processes full history, precise results\n\n**Speed Layer** (approximate, fast):\n- Event Hub → Stream Analytics → Cosmos DB/Redis\n- Processes the last few hours in real time\n\n**Serving Layer**:\n- Combines batch + speed results\n- Power BI or API queries both layers\n\nUse when you need real time AND precise history.'
    },
    {
      front: 'What are the 4 Window function types in Stream Analytics?',
      back: '1. **Tumbling** — fixed non-overlapping windows: \`GROUP BY TumblingWindow(minute, 5)\` → 0-5, 5-10, 10-15...\n\n2. **Hopping** — overlapping windows: \`HoppingWindow(minute, 10, 5)\` → result every 5min from a 10min window\n\n3. **Sliding** — creates a window for each event that has activity: responds when there is change\n\n4. **Session** — groups by inactivity: closes the window when there are no events for X time'
    }
  ],

  lab: {
    scenario: 'Create an Event Hub to simulate telemetry ingestion and configure basic Stream Analytics.',
    objective: 'Create an Event Hub namespace, hub and explore Stream Analytics configuration.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create an Event Hub Namespace and Hub',
        instruction: 'Create a Standard Event Hub Namespace and a hub for IoT sensor data.',
        hints: ['\`az eventhubs namespace create\` then \`az eventhubs eventhub create\`'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-integration-lab --location eastus

# Create the Namespace
az eventhubs namespace create \\
  --name "technova-eh-\${SUFFIX}" \\
  --resource-group rg-integration-lab \\
  --location eastus \\
  --sku Standard \\
  --capacity 1

# Create the Event Hub
az eventhubs eventhub create \\
  --name sensor-telemetry \\
  --namespace-name "technova-eh-\${SUFFIX}" \\
  --resource-group rg-integration-lab \\
  --partition-count 4 \\
  --message-retention 3

echo "SUFFIX=\${SUFFIX}" > /tmp/integlab.sh
echo "Event Hub created: sensor-telemetry"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/integlab.sh
az eventhubs eventhub show \\
  --name sensor-telemetry \\
  --namespace-name "technova-eh-\${SUFFIX}" \\
  --resource-group rg-integration-lab \\
  --query "{Name:name,Partitions:partitionCount,Retention:messageRetentionInDays}" -o table
\`\`\``
      },
      {
        title: 'Configure a Consumer Group and Connection String',
        instruction: 'Create a dedicated consumer group for Stream Analytics and get the connection string.',
        hints: ['\`az eventhubs eventhub consumer-group create\`'],
        solution: `\`\`\`bash
source /tmp/integlab.sh

# Consumer Group for Stream Analytics
az eventhubs eventhub consumer-group create \\
  --consumer-group-name stream-analytics-cg \\
  --eventhub-name sensor-telemetry \\
  --namespace-name "technova-eh-\${SUFFIX}" \\
  --resource-group rg-integration-lab

# Get the connection string (for configuring inputs)
az eventhubs namespace authorization-rule keys list \\
  --namespace-name "technova-eh-\${SUFFIX}" \\
  --resource-group rg-integration-lab \\
  --name RootManageSharedAccessKey \\
  --query "primaryConnectionString" -o tsv
\`\`\``,
        verify: `\`\`\`bash
source /tmp/integlab.sh
az eventhubs eventhub consumer-group list \\
  --eventhub-name sensor-telemetry \\
  --namespace-name "technova-eh-\${SUFFIX}" \\
  --resource-group rg-integration-lab \\
  --query "[].name" -o tsv
# Output: $Default and stream-analytics-cg
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-integration-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-integration-lab 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Azure Data Factory pipeline fails to connect to an on-premises source',
      difficulty: 'medium',
      symptom: 'An ADF pipeline that reads data from an on-premises SQL Server fails with "Error connecting to the source: Unable to connect to the server".',
      diagnosis: `\`\`\`bash
# Check the Self-hosted IR status
az datafactory integration-runtime list \\
  --factory-name myADF --resource-group myRG \\
  --query "[?type=='SelfHosted'].{Name:name,State:properties.state}" -o table

# In the portal: ADF → Manage → Integration Runtimes → Self-hosted IR → Nodes
# Check whether the node is "Running" or "Limited"
\`\`\``,
      solution: `**Diagnostic checklist:**

1. **Self-hosted IR node offline**: check whether the "Integration Runtime Service" Windows service is running on the server. If not: start it via services.msc or \`net start DIAHostService\`.

2. **Outdated version**: update the Integration Runtime to the latest version (ADF → Integration Runtimes → update).

3. **Firewall blocking outbound**: the Self-hosted IR needs outbound HTTPS connectivity (port 443) to Azure Service Bus and storage. Check firewall rules.

4. **Linked Service credentials**: check that the SQL Server username/password or connection string is correct.

5. **SQL Server unreachable from the IR server**: test connectivity from the server where the IR is installed to the SQL Server (test via SSMS or \`Test-NetConnection -ComputerName sqlserver -Port 1433\`).`
    }
  ]
};
