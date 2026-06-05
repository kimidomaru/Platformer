window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-data/caching-messaging'] = {
  theory: `# Caching & Messaging Design (AZ-305)

## Exam Relevance
> Estimated weight **10-15%** in AZ-305. Questions about choosing between Redis, Service Bus, Event Grid, and Event Hub appear in architecture design scenarios.

## Azure Cache for Redis — Design

### When to use Redis

| Use Case | Why Redis |
|----------|----------|
| User session cache | In-memory access <1ms vs database |
| Query result cache | Avoids repeated database queries |
| Leaderboards and rankings | Redis Sorted Sets |
| Rate limiting | Atomic INCR + EXPIRE |
| Simple Pub/Sub | Native Redis channels |
| Distributed locks | SETNX (SET if Not eXists) |

### Azure Cache for Redis Tiers

| Tier | Characteristics | Use Case |
|------|----------------|----------|
| **Basic** | Single node, no SLA, no replication | Dev/test |
| **Standard** | Primary-replica replication, 99.9% SLA | General production |
| **Premium** | Clustering, geo-replication, VNet, persistence | High availability |
| **Enterprise** | Redis Enterprise, Modules (Search, JSON) | Maximum performance |
| **Enterprise Flash** | Partly on NVMe SSD, lower cost | Large datasets |

\`\`\`bash
# Create Standard Redis Cache (production)
az redis create \
  --name my-redis \
  --resource-group myRG \
  --location eastus \
  --sku Standard \
  --vm-size c1            # c0=250MB, c1=1GB, c2=2.5GB...

# Premium with clustering (3 shards)
az redis create \
  --name my-redis-premium \
  --resource-group myRG \
  --sku Premium \
  --vm-size p1 \
  --shard-count 3

# Get connection string
az redis list-keys --name my-redis --resource-group myRG
\`\`\`

### Cache Patterns

\`\`\`
Cache-Aside (Lazy Loading):         Read-Through:
  App → Redis → HIT → return         App → Cache Layer → DB (automatic)
  App → Redis → MISS → DB → update    Cache fetches from DB automatically

Write-Through:                      Write-Behind (async):
  App → Cache → DB (synchronous)      App → Cache → returns
                                       Cache → DB (asynchronous, eventual)
\`\`\`

## Messaging Decision Pattern

\`\`\`
Event or Command?
  ├─ EVENT (something happened, multiple consumers)
  │    ├─ High volume, streaming → Event Hub
  │    └─ Low volume, pub/sub → Event Grid
  └─ COMMAND (do something, guaranteed processing)
       ├─ FIFO, dead-letter, sessions → Service Bus Queue/Topic
       └─ Simple, very high volume → Storage Queue
\`\`\`

## Azure Service Bus — Design

### Queue vs Topic/Subscription

\`\`\`
Queue (1 producer → 1 consumer):         Topic (1 producer → N consumers):
  Producer → Queue → Consumer 1              Publisher → Topic → Sub A → Consumer A
                                                               ↘ Sub B → Consumer B
                                                               ↘ Sub C → Consumer C
\`\`\`

\`\`\`bash
# Create namespace and queue with dead-letter
az servicebus namespace create \
  --name mybus --resource-group myRG --sku Standard

az servicebus queue create \
  --namespace-name mybus --resource-group myRG \
  --name orders \
  --max-delivery-count 3 \            # attempts before dead-letter
  --default-message-time-to-live P7D  # messages expire in 7 days

# Create topic with filters
az servicebus topic create \
  --namespace-name mybus --resource-group myRG \
  --name events

# Subscription with SQL filter
az servicebus topic subscription create \
  --namespace-name mybus --resource-group myRG \
  --topic-name events --name high-priority

az servicebus topic subscription rule create \
  --namespace-name mybus --resource-group myRG \
  --topic-name events --subscription-name high-priority \
  --name priority-filter \
  --filter-sql-expression "priority = 'high'"
\`\`\`

### Service Bus Features

| Feature | Service Bus | Storage Queue |
|---------|-------------|--------------|
| Max message size | 256KB (Standard), 100MB (Premium) | 64KB |
| Dead-letter queue | Native | Not available |
| Guaranteed FIFO | Yes (sessions) | No |
| Transactions | Yes | No |
| Duplicate detection | Yes | No |
| Max retention | 14 days | 7 days |
| Throughput | Moderate | Very high |

## Azure Event Grid — Design

Event Grid = serverless event routing (low volume, reactive):

\`\`\`bash
# Create custom topic
az eventgrid topic create \
  --name my-topic --resource-group myRG --location eastus

# Create subscription for Azure Function
az eventgrid event-subscription create \
  --name my-subscription \
  --source-resource-id /subscriptions/.../topics/my-topic \
  --endpoint /subscriptions/.../functions/my-function \
  --endpoint-type azurefunction \
  --included-event-types Microsoft.Storage.BlobCreated
\`\`\`

**Native Event Grid sources**: Storage Account, Event Hub, Service Bus, IoT Hub, Resource Groups, Azure AD, Container Registry.

## Pattern: Outbox Pattern

To guarantee delivery between database and messaging:

\`\`\`
1. Database transaction:
   INSERT INTO orders (data) VALUES (...)
   INSERT INTO outbox (event, payload) VALUES ('OrderCreated', {...})
   COMMIT

2. Outbox processor (background):
   SELECT * FROM outbox WHERE sent = false
   → Publish to Service Bus
   → UPDATE outbox SET sent = true

3. Avoids: publishing message BEFORE the DB commits (event loss)
           publishing message BUT DB fails (ghost event)
\`\`\`

## Common Design Mistakes

1. **Redis Basic in production**: no replication and no SLA — any failure brings down the cache and propagates to the database.
2. **Event Grid for high throughput**: Event Grid is optimized for low event volume per second — use Event Hub for streaming.
3. **Storage Queue for critical FIFO**: Storage Queue does not guarantee FIFO — use Service Bus with Sessions for orders.
4. **No dead-letter monitoring**: messages in the dead-letter queue indicate application bugs — monitor and alert.
5. **TTL too high in Redis**: stale data served to users. Set TTL appropriate to the data change profile.

## Killer.sh Style Challenge (AZ-305)

> An e-commerce platform needs:
> 1. Product catalog cache (100k products, updates 1x/hour, 10k req/s access)
> 2. Order processing with FIFO, automatic retry, and dead-letter queue
> 3. Notify N microservices when an order is created (each performs a different action)
> 4. Ingestion of clickstream events (100k events/min)
>
> **Answer**: (1) Redis Standard (cache-aside, TTL 1h). (2) Service Bus Queue Premium with sessions + max-delivery-count=3. (3) Service Bus Topic with N subscriptions per microservice. (4) Event Hub Standard with 10+ partitions.
`,

  quiz: [
    {
      question: 'When should you use Azure Service Bus instead of Azure Event Hub for messaging?',
      options: [
        'Service Bus is always cheaper than Event Hub',
        'Service Bus for critical commands with FIFO, dead-letter, and transactions; Event Hub for high-volume event streaming',
        'Event Hub supports more simultaneous consumers than Service Bus',
        'Service Bus has better integration with Azure Functions'
      ],
      correct: 1,
      explanation: 'Service Bus is an enterprise message broker: FIFO guarantees (with sessions), dead-letter queue, duplicate detection, transactions, and automatic retry. Ideal for business commands (orders, payments). Event Hub is a high-throughput streaming platform: processes millions of events/second, multiple consumer groups, 7-90 day retention, no dead-letter. Ideal for telemetry, logs, clickstream.',
      reference: 'Messaging decision matrix — FIFO/dead-letter/transactions = Service Bus; volume/streaming = Event Hub.'
    },
    {
      question: 'Which tier of Azure Cache for Redis supports clustering, geo-replication, and data persistence?',
      options: [
        'Standard',
        'Basic',
        'Premium',
        'Developer'
      ],
      correct: 2,
      explanation: 'The Premium tier of Azure Cache for Redis offers: Redis Cluster to distribute data across multiple shards, geo-replication for a replica in another region, Redis persistence (RDB/AOF) for durability, Private Endpoint, and VNet injection. Standard only offers primary-replica replication without clustering. Basic has no SLA or replication.',
      reference: 'Redis Tiers table — Premium is required for critical production workloads needing scale or DR.'
    },
    {
      question: 'What is the Outbox Pattern and what problem does it solve?',
      options: [
        'A pattern for storing undelivered messages in a special queue',
        'A pattern that guarantees atomicity between persisting data to the database and publishing events to the message broker using an outbox table',
        'A design pattern for routing messages between different brokers',
        'An automatic retry strategy for failed messages'
      ],
      correct: 1,
      explanation: 'The Outbox Pattern solves the duality between database and messaging: instead of persisting to the database AND publishing to the queue (two operations that can fail independently), you persist the data AND a record in the outbox table in a single ACID transaction. A background process asynchronously publishes from the outbox to the broker. This guarantees there is never an event without corresponding data, nor data without an event.',
      reference: 'Outbox Pattern section — a fundamental pattern in microservices with eventual consistency.'
    }
  ],

  flashcards: [
    {
      front: 'Cache-Aside vs Read-Through vs Write-Through — when to use each pattern?',
      back: '**Cache-Aside (Lazy Loading)**:\n- App tries to read from cache; on miss, fetches from DB and updates cache\n- Use: most cases, simple to implement\n- Risk: cache stampede on simultaneous cache miss\n\n**Read-Through**:\n- Cache Layer fetches from DB automatically on miss\n- Use: when you want to abstract the logic from the app\n- Risk: first read is always slower\n\n**Write-Through**:\n- Every write goes to cache AND DB synchronously\n- Use: when consistency is critical\n- Risk: higher write latency\n\n**Write-Behind (Write-Back)**:\n- Write goes to cache; DB is updated asynchronously\n- Use: high write frequency, eventual consistency ok\n- Risk: data loss if cache fails before persisting'
    },
    {
      front: 'What is the difference between Service Bus Queue and Service Bus Topic?',
      back: '**Queue** (point-to-point):\n- 1 producer → 1 consumer per message\n- Multiple consumers compete (competing consumers)\n- To scale processing of a single type of task\n- E.g.: order processing\n\n**Topic with Subscriptions** (pub/sub):\n- 1 producer → N subscriptions → N consumers\n- Each subscription receives a copy of the message\n- To notify multiple independent services\n- Subscriptions can have SQL filters\n- E.g.: "OrderCreated" → email, inventory, analytics'
    }
  ],

  lab: {
    scenario: 'Create a Service Bus with a queue for order processing and a topic for notifications.',
    objective: 'Configure Service Bus Queue with dead-letter and Topic with multiple filtered subscriptions.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Service Bus Namespace and Queue',
        instruction: 'Create a Standard namespace and an orders queue with dead-letter configured.',
        hints: ['az servicebus namespace create --sku Standard', '--max-delivery-count 3 for dead-letter after 3 attempts'],
        solution: `\`\`\`bash
az group create --name rg-messaging-lab --location eastus

az servicebus namespace create \
  --name technovamessaging$(date +%s | tail -c 5) \
  --resource-group rg-messaging-lab \
  --sku Standard

NS=$(az servicebus namespace list --resource-group rg-messaging-lab --query "[0].name" -o tsv)

az servicebus queue create \
  --namespace-name $NS \
  --resource-group rg-messaging-lab \
  --name orders \
  --max-delivery-count 3 \
  --default-message-time-to-live P1D \
  --enable-dead-lettering-on-message-expiration true

echo "Queue 'orders' created in $NS"
\`\`\``,
        verify: `\`\`\`bash
NS=$(az servicebus namespace list --resource-group rg-messaging-lab --query "[0].name" -o tsv)
az servicebus queue show --namespace-name $NS --resource-group rg-messaging-lab --name orders \
  --query "{Name:name,DeadLetter:properties.maxDeliveryCount,TTL:properties.defaultMessageTimeToLive}" -o table
# Expected: orders, maxDeliveryCount=3
\`\`\``
      },
      {
        title: 'Create Topic with filtered Subscriptions',
        instruction: 'Create an "events" topic with two subscriptions: one for high-priority events and one for all events.',
        hints: ['az servicebus topic create', 'az servicebus topic subscription rule create --filter-sql-expression'],
        solution: `\`\`\`bash
NS=$(az servicebus namespace list --resource-group rg-messaging-lab --query "[0].name" -o tsv)

az servicebus topic create \
  --namespace-name $NS --resource-group rg-messaging-lab --name events

# Subscription for all events
az servicebus topic subscription create \
  --namespace-name $NS --resource-group rg-messaging-lab \
  --topic-name events --name all-events

# Subscription for high priority only
az servicebus topic subscription create \
  --namespace-name $NS --resource-group rg-messaging-lab \
  --topic-name events --name high-priority-only

az servicebus topic subscription rule create \
  --namespace-name $NS --resource-group rg-messaging-lab \
  --topic-name events --subscription-name high-priority-only \
  --name priority-filter \
  --filter-sql-expression "priority = 'high'"
\`\`\``,
        verify: `\`\`\`bash
NS=$(az servicebus namespace list --resource-group rg-messaging-lab --query "[0].name" -o tsv)
az servicebus topic subscription list \
  --namespace-name $NS --resource-group rg-messaging-lab --topic-name events \
  --query "[].{Name:name}" -o table
# Expected: all-events and high-priority-only

az group delete --name rg-messaging-lab --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Messages accumulating in Service Bus Dead-Letter Queue',
      difficulty: 'medium',
      symptom: 'Azure Monitor shows constant growth in the dead-letter queue of a Service Bus Queue. Messages arrive but processing fails repeatedly.',
      diagnosis: `\`\`\`bash
# Check dead-letter count
az servicebus queue show --namespace-name mybus --resource-group myRG --name orders \
  --query "properties.deadLetterMessageCount" -o tsv

# Via Service Bus Explorer in portal: view message content in DLQ
# Namespace → Queue → Dead-letter tab → peek messages
\`\`\``,
      solution: `**Common causes of dead-letter:**

1. **maxDeliveryCount reached**: application throws an exception during processing. Fix the bug in the processing logic.

2. **TTL expired**: messages sit in the queue for too long. Check if the consumer is running and healthy.

3. **Invalid message**: corrupted payload or incompatible schema. Add schema validation before processing.

**Diagnostic process:**
\`\`\`bash
# 1. Check consumer logs (Azure Function/App Service)
# 2. Inspect a message from the DLQ in the portal (peek without removing)
# 3. View the DeadLetterReason and DeadLetterErrorDescription fields

# Reprocess messages from DLQ (after fixing the bug)
# Use Service Bus Explorer or code that reads from DLQ and republishes to the main queue
\`\`\`

**Prevention**: configure an Azure Monitor alert for dead-letter count > 0 for proactive detection.`
    }
  ]
};
