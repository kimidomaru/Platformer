window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-application/event-driven-design'] = {
  theory: `# Event-Driven Architecture Design (AZ-305)

## Exam Relevance
> Estimated weight **15-20%** in AZ-305. Event-driven architecture is covered in questions about service decoupling, asynchronous processing, and choosing between Event Grid, Event Hub, and Service Bus.

## Fundamental Concepts

### Events vs Commands vs Messages

| Type | Example | Broker | Semantics |
|------|---------|--------|-----------|
| **Event** | "OrderShipped" | Event Grid, Event Hub | What happened (fact) |
| **Command** | "ProcessPayment" | Service Bus | Do something (intention) |
| **Message** | any data | Any | Generic container |

## Azure Event Grid — Design

Event Grid = reactive event routing (low-latency, near-real-time):

\`\`\`
Sources:                   Event Grid              Destinations:
Azure Storage       →      Topics/System Topics  → Azure Functions
Azure Container Reg →      + Filtering           → Logic Apps
Custom Application  →      + Dead-letter          → Event Hub
Azure Service Bus   →      + Retry policy         → WebHook/HTTPS
IoT Hub             →                             → Service Bus
\`\`\`

\`\`\`bash
# Create custom topic
az eventgrid topic create \
  --name orders-events \
  --resource-group myRG \
  --location eastus

# Create subscription for Function
FUNCTION_ID=$(az functionapp function show \
  --function-name ProcessOrder \
  --name myFunctionApp \
  --resource-group myRG \
  --query id -o tsv)

az eventgrid event-subscription create \
  --name order-processor \
  --source-resource-id /subscriptions/.../topics/orders-events \
  --endpoint $FUNCTION_ID \
  --endpoint-type azurefunction \
  --included-event-types "order.created" "order.updated" \
  --deadletter-endpoint /subscriptions/.../storageAccounts/dlq/blobServices/default/containers/deadletter
\`\`\`

## Event Hub — Design for Streaming

\`\`\`
                          Event Hub
                       ┌─────────────┐
Producers         →    │ Partitions  │  →  Consumer Groups
(IoT devices,          │  [0][1][2]  │
 apps, logs)           │  [3][4][5]  │     - Stream Analytics (real-time)
                       └─────────────┘     - Azure Functions (batch)
                            ↓              - Spark/Databricks (analytics)
                       Capture Storage     - Custom consumers
\`\`\`

\`\`\`bash
# Create Event Hub optimized for IoT telemetry
az eventhubs namespace create \
  --name iot-hub --resource-group myRG --sku Standard

az eventhubs eventhub create \
  --name telemetry \
  --namespace-name iot-hub \
  --resource-group myRG \
  --partition-count 32 \          # more partitions = more parallelism
  --message-retention 7 \         # retention in days
  --enable-capture true \
  --capture-interval 300 \        # capture every 5 minutes
  --capture-destination-name "StorageAccount" \
  --storage-account /subscriptions/.../storageAccounts/telemetrystorage \
  --blob-container raw-events
\`\`\`

## Pattern: Event-Driven with Idempotency

Event consumers must be idempotent:

\`\`\`python
# Azure Function with idempotency
import azure.functions as func
import json

def process_order(msg: func.ServiceBusMessage) -> None:
    order_id = msg.get_body().decode('utf-8')
    order_data = json.loads(order_id)

    # Check if already processed (idempotency)
    if is_already_processed(order_data['id']):
        logging.info(f"Order {order_data['id']} already processed, ignoring")
        return

    # Process order
    process(order_data)

    # Mark as processed (in Redis or database)
    mark_as_processed(order_data['id'])
\`\`\`

## Pattern: Event Aggregation (Time Windows)

\`\`\`
Raw telemetry (1000 events/second)
         ↓
Event Hub (streaming buffer)
         ↓
Stream Analytics (aggregation by window)
         ↓
Alerts (if avg CPU > 80% for 5min)
Cosmos DB (per-minute averages for dashboard)
SQL (hourly summaries for reports)
\`\`\`

## Common Design Mistakes

1. **Event Grid for high-throughput**: Event Grid is optimized for low volume and low latency — use Event Hub for millions of events/second.
2. **No idempotency in consumers**: events can be delivered more than once (at-least-once) — consumers must handle duplicates.
3. **No dead-letter queue**: events that fail are lost without a DLQ configured.
4. **Event Hub with too few partitions**: few partitions limit parallelism. Each parallel consumer needs its own partition.
5. **Consumer without checkpoint**: without checkpoint, restarting the consumer reprocesses all events from the beginning.

## Killer.sh Style Challenge (AZ-305)

> IoT system with 50,000 sensors sending readings every second. Requirements: anomaly detection in < 5 seconds, store raw data for 1 year for historical analysis, notify operators when temperature > 80°C on any sensor.
>
> **Answer**: Event Hub (50K events/second, 32 partitions). Stream Analytics with 5-second Tumbling Window to detect anomalies (temp > 80°C). Alerts via Event Grid → Logic App → email/Teams. Event Hub Capture → Data Lake for historical data. Databricks for ad-hoc historical analysis.
`,

  quiz: [
    {
      question: 'Why must event consumers in an event-driven architecture be idempotent?',
      options: [
        'To improve processing performance',
        'Because brokers like Event Hub and Service Bus use at-least-once semantics — the same event can be delivered more than once in case of retry or failure',
        'To allow parallel processing without locks',
        'Due to audit compliance requirements'
      ],
      correct: 1,
      explanation: 'Event brokers use at-least-once delivery: they guarantee that the event is delivered at least once, but may deliver duplicates in case of consumer failure or ack timeout. If the consumer is not idempotent, duplicates cause side effects (e.g., charging the same payment twice). The solution is to check whether the event has already been processed using a unique event ID (event ID or business key).',
      reference: 'Idempotency section — always design consumers to handle duplicates in Azure Event Hub and Service Bus.'
    },
    {
      question: 'Which Azure service should you use to process IoT streaming with 500,000 events/second with time-window aggregation?',
      options: [
        'Azure Event Grid with Azure Functions',
        'Azure Service Bus with multiple consumers',
        'Azure Event Hub + Azure Stream Analytics',
        'Azure Storage Queue with Azure Batch'
      ],
      correct: 2,
      explanation: 'Event Hub is the only Azure service capable of reliably receiving 500K events/second (scales to millions). Stream Analytics is natively integrated with Event Hub and provides a SQL-like query language with window functions for real-time aggregation (TumblingWindow, HoppingWindow). Together they form the canonical pattern for IoT and telemetry in Azure.',
      reference: 'Event Hub Design section — high-throughput streaming = Event Hub. Real-time aggregation = Stream Analytics. Event Grid for low-volume events.'
    },
    {
      question: 'What is Event Hub Capture and what is it used for?',
      options: [
        'Dead-letter queue mechanism for Event Hub',
        'A feature that automatically saves the event stream to Azure Blob Storage or Data Lake in Avro format',
        'A service to capture events from Azure Functions and store them in Event Hub',
        'A filter that captures only events matching a pattern'
      ],
      correct: 1,
      explanation: 'Event Hub Capture automatically persists the event stream to Azure Blob Storage or Azure Data Lake Storage in Apache Avro format, at configurable intervals (e.g., every 5 minutes or every 500MB). This allows processing events in real-time via Stream Analytics while also storing raw data for historical analysis via Databricks, Synapse, or ad-hoc queries — without any additional code.',
      reference: 'Event Hub Design section — Capture = automatic persistence to Data Lake. Configure capture + Stream Analytics for lambda architecture.'
    }
  ],

  flashcards: [
    {
      front: 'Event Grid vs Event Hub vs Service Bus — how do you choose?',
      back: '**Azure Event Grid** (reactive router):\n- Volume: low to medium\n- Latency: < 1 second\n- Model: push to subscribers\n- Use: reactions to Azure resource events, webhooks\n\n**Azure Event Hub** (streaming platform):\n- Volume: millions/second\n- Retention: 1-90 days\n- Model: pull with consumer groups\n- Use: IoT, telemetry, logs, analytics\n\n**Azure Service Bus** (message broker):\n- Volume: moderate\n- Guarantees: FIFO, dead-letter, transactions\n- Model: push/pull\n- Use: business commands, critical workflows'
    },
    {
      front: 'What is at-least-once delivery and how do you implement idempotency?',
      back: '**At-least-once delivery**: the broker guarantees the message will reach the consumer at least 1 time — but it may arrive 2+ times in case of retry.\n\n**Implement idempotency**:\n1. Each event has a unique ID (UUID)\n2. Consumer checks: "have I already processed this ID?"\n3. If yes: ignore (log and ack)\n4. If no: process + record ID\n\n**Store processed IDs**:\n- Redis with TTL (fast, temporary)\n- Database (persistent, auditable)\n- Cosmos DB with TTL (scalable)\n\n**Deduplication field**: Event Hub → SequenceNumber; Service Bus → MessageId'
    }
  ],

  lab: {
    scenario: 'Create an Event Hub and configure Event Hub Capture to store events in a Data Lake.',
    objective: 'Implement the streaming + persistence pattern using Event Hub with Capture.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Event Hub with Capture enabled',
        instruction: 'Create an Event Hub with 4 partitions and Capture to Data Lake.',
        hints: ['az eventhubs eventhub create --enable-capture true', '--capture-destination-name StorageAccount'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-eventdriven-lab --location eastus

# Storage for Capture
az storage account create \
  --name "iotcapture\${SUFFIX}" \
  --resource-group rg-eventdriven-lab \
  --sku Standard_LRS

az storage container create \
  --name raw-events \
  --account-name "iotcapture\${SUFFIX}" --auth-mode login

# Event Hub Namespace
az eventhubs namespace create \
  --name "iot-hub-\${SUFFIX}" \
  --resource-group rg-eventdriven-lab \
  --sku Standard

# Event Hub with Capture
STORAGE_ID=$(az storage account show --name "iotcapture\${SUFFIX}" --resource-group rg-eventdriven-lab --query id -o tsv)

az eventhubs eventhub create \
  --name telemetry \
  --namespace-name "iot-hub-\${SUFFIX}" \
  --resource-group rg-eventdriven-lab \
  --partition-count 4 \
  --message-retention 3 \
  --enable-capture true \
  --capture-interval 300 \
  --capture-destination-name "StorageAccount" \
  --storage-account $STORAGE_ID \
  --blob-container raw-events

echo "SUFFIX=\${SUFFIX}" > /tmp/eventlab.sh
\`\`\``,
        verify: `\`\`\`bash
source /tmp/eventlab.sh
az eventhubs eventhub show \
  --name telemetry \
  --namespace-name "iot-hub-\${SUFFIX}" \
  --resource-group rg-eventdriven-lab \
  --query "{Name:name,Partitions:partitionCount,Capture:captureDescription.enabled}" -o table
# Expected: telemetry, 4 partitions, Capture=true
\`\`\``
      },
      {
        title: 'Explore consumer groups and connection string',
        instruction: 'Create a dedicated consumer group for Stream Analytics and obtain the connection string.',
        hints: ['Consumer groups allow multiple independent consumers', 'Each consumer group maintains its own offset'],
        solution: `\`\`\`bash
source /tmp/eventlab.sh

# Consumer group for Stream Analytics
az eventhubs eventhub consumer-group create \
  --consumer-group-name stream-analytics \
  --eventhub-name telemetry \
  --namespace-name "iot-hub-\${SUFFIX}" \
  --resource-group rg-eventdriven-lab

# Consumer group for Databricks
az eventhubs eventhub consumer-group create \
  --consumer-group-name databricks-analytics \
  --eventhub-name telemetry \
  --namespace-name "iot-hub-\${SUFFIX}" \
  --resource-group rg-eventdriven-lab

# Connection string for sending events
az eventhubs namespace authorization-rule keys list \
  --namespace-name "iot-hub-\${SUFFIX}" \
  --resource-group rg-eventdriven-lab \
  --name RootManageSharedAccessKey \
  --query "primaryConnectionString" -o tsv

echo "Consumer groups created - each maintains an independent cursor"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/eventlab.sh
az eventhubs eventhub consumer-group list \
  --eventhub-name telemetry \
  --namespace-name "iot-hub-\${SUFFIX}" \
  --resource-group rg-eventdriven-lab \
  --query "[].name" -o tsv
# Expected: \$Default, stream-analytics, databricks-analytics

az group delete --name rg-eventdriven-lab --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Consumer reading duplicate events after restart',
      difficulty: 'hard',
      symptom: 'After restarting an Event Hub consumer, it starts reprocessing old events that were already processed, causing duplicate actions in the system.',
      diagnosis: `\`\`\`bash
# Check if the consumer is persisting checkpoints
# (Azure Event Processor Host must save offsets in Azure Storage)

# Check consumer group and current position
az eventhubs eventhub consumer-group show \
  --consumer-group-name my-consumer \
  --eventhub-name my-hub \
  --namespace-name my-namespace \
  --resource-group myRG
\`\`\``,
      solution: `**Cause**: the consumer is not persisting checkpoints, so on restart it begins from the beginning (or the oldest position in the retention window).

**Solution with Azure Event Processor Host (Python)**:
\`\`\`python
from azure.eventhub import EventHubConsumerClient
from azure.eventhub.extensions.checkpointstoreblob import BlobCheckpointStore

# Checkpoint store in Azure Blob Storage
checkpoint_store = BlobCheckpointStore.from_connection_string(
    STORAGE_CONNECTION_STRING,
    container_name="checkpoints"  # container to save offsets
)

client = EventHubConsumerClient.from_connection_string(
    EVENT_HUB_CONNECTION_STRING,
    consumer_group="my-consumer",
    eventhub_name="telemetry",
    checkpoint_store=checkpoint_store  # persists offset after processing
)

def on_event(partition_context, event):
    process_event(event)
    # Checkpoint AFTER successful processing
    partition_context.update_checkpoint(event)

client.receive(on_event=on_event)
\`\`\`

After implementing checkpointing, restarts continue from the last saved checkpoint.`
    }
  ]
};
