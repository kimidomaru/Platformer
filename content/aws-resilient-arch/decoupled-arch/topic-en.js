window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-resilient-arch/decoupled-arch'] = {
  theory: `# Decoupled & Event-Driven Architectures

## Exam Relevance
> **Design Resilient Architectures** is worth **26%** of SAA-C03. SQS, SNS, EventBridge, Step Functions, and Kinesis are heavily tested.

## Amazon SQS (Simple Queue Service)

### Standard vs FIFO

| Feature | Standard | FIFO |
|---------|----------|------|
| **Throughput** | Unlimited | 300 msg/s (3,000 with batching) |
| **Ordering** | Best-effort | Strict (per message group) |
| **Delivery** | At-least-once (possible duplicates) | Exactly-once |
| **Name** | Any | Must end in .fifo |

### Key Features
- **Visibility Timeout**: message hidden after consumer reads it (default 30s, max 12h). If not deleted, reappears.
- **Dead-Letter Queue (DLQ)**: failed messages sent after maxReceiveCount exceeded
- **Long Polling**: reduces empty responses and cost (WaitTimeSeconds 1-20s)
- **Message Retention**: 1-14 days (default 4 days)
- **Max Message Size**: 256 KB (use Extended Client Library + S3 for larger)
- **Delay Queue**: postpone delivery 0-900 seconds

## Amazon SNS (Simple Notification Service)

Pub/sub messaging: one message to many subscribers simultaneously.

- **Topics**: Standard (best-effort ordering) or FIFO (strict ordering)
- **Subscribers**: SQS, Lambda, HTTP/S, email, SMS, Kinesis Data Firehose
- **Fan-out pattern**: SNS topic -> multiple SQS queues (parallel processing)
- **Message Filtering**: filter policies on subscriptions (process only relevant messages)

## Amazon EventBridge

Serverless event bus for event-driven architectures.

- **Event Bus**: default (AWS events) + custom (your events) + partner (SaaS)
- **Rules**: match event patterns and route to targets (150+ integrations)
- **Scheduler**: cron and rate-based scheduling (replaces CloudWatch Events)
- **Archive & Replay**: store events and replay them for debugging/recovery
- **Schema Registry**: auto-discover and document event schemas
- **Cross-account**: send events between accounts via event bus policies

## SQS vs SNS vs EventBridge

| Use Case | Service |
|----------|---------|
| Queue with consumers (pull) | SQS |
| Fan-out to multiple subscribers (push) | SNS |
| Event routing with filtering and many targets | EventBridge |
| Decouple microservices | SQS or SNS+SQS |
| React to AWS service events | EventBridge |
| Cron/scheduled tasks | EventBridge Scheduler |

## AWS Step Functions

Orchestrate serverless workflows with visual state machine.

| Type | Duration | Execution | Pricing |
|------|----------|-----------|---------|
| **Standard** | Up to 1 year | Exactly-once | \\$0.025 per 1,000 transitions |
| **Express** | Up to 5 min | At-least-once (async) or at-most-once (sync) | \\$1 per million executions |

- **Error handling**: Retry (with backoff/interval) and Catch (fallback state)
- **Map state**: parallel iteration over arrays
- **Service integrations**: 200+ AWS services (Lambda, DynamoDB, ECS, SQS, SNS)
- **Wait state**: pause execution for time or until timestamp

## Amazon Kinesis

| Service | Purpose | Latency |
|---------|---------|---------|
| **Data Streams** | Real-time streaming, custom consumers | ~200ms |
| **Data Firehose** | Load streaming data to destinations | 60s buffer |
| **Data Analytics** | SQL queries on streaming data | Near real-time |

### Data Streams vs Firehose
- **Streams**: you manage shards (1 MB/s in, 2 MB/s out per shard), retention 1-365 days, custom consumers (KCL, Lambda), need capacity planning
- **Firehose**: fully managed, auto-scaling, no shards, destinations (S3, Redshift, OpenSearch, HTTP), transformation via Lambda, 60-second minimum buffer

## Amazon MQ

Managed message broker for **migrating existing apps** using JMS, AMQP, MQTT, STOMP, OpenWire protocols.
- Supports Apache ActiveMQ and RabbitMQ
- Use when migrating from on-prem message brokers (not for new cloud-native apps — use SQS/SNS)

## Common Exam Mistakes

- Using SQS when fan-out is needed (use SNS+SQS)
- Confusing SQS Standard (duplicates possible) with FIFO (exactly-once)
- Forgetting visibility timeout causes message reprocessing if too short
- Using Kinesis Data Streams when Firehose (simpler) would suffice
- Choosing Amazon MQ for new apps instead of SQS/SNS (MQ is for migration)
`,

  quiz: [
    {
      question: 'What is the main difference between SQS Standard and FIFO?',
      options: ['Standard is free, FIFO is paid', 'Standard has unlimited throughput with at-least-once delivery, FIFO guarantees exactly-once with strict ordering', 'FIFO has unlimited throughput', 'Standard guarantees ordering'],
      correct: 1,
      explanation: 'Standard: unlimited throughput, at-least-once delivery (possible duplicates), best-effort ordering. FIFO: 300/3000 msg/s, exactly-once, strict ordering per message group.',
      reference: 'Standard = high throughput, possible duplicates. FIFO = ordering + exactly-once, lower throughput.'
    },
    {
      question: 'What is the SNS+SQS fan-out pattern?',
      options: ['SNS sends to one SQS queue', 'SNS topic publishes to multiple SQS queues for parallel processing', 'SQS sends to multiple SNS topics', 'SNS replaces SQS entirely'],
      correct: 1,
      explanation: 'Fan-out: one SNS topic with multiple SQS queue subscriptions. Each queue gets a copy of every message for independent, parallel processing by different consumers.',
      reference: 'Fan-out = SNS topic -> multiple SQS queues. Each queue processes independently.'
    },
    {
      question: 'What happens when SQS visibility timeout expires before a message is processed?',
      options: ['Message is deleted', 'Message becomes visible again for other consumers', 'Message goes to DLQ', 'Queue is paused'],
      correct: 1,
      explanation: 'If visibility timeout expires before the consumer deletes the message, it becomes visible again and can be received by another consumer (or the same one). This can cause duplicate processing.',
      reference: 'Visibility timeout too short = duplicates. Too long = delays retries. Default: 30s.'
    },
    {
      question: 'When should you use EventBridge over SNS?',
      options: ['When you need SMS notifications', 'When you need event filtering, routing to many targets, and AWS service event integration', 'When you need email delivery', 'When you need FIFO ordering'],
      correct: 1,
      explanation: 'EventBridge provides advanced event filtering, 150+ target integrations, schema registry, archive/replay, and native AWS service event integration. SNS is simpler pub/sub.',
      reference: 'EventBridge = event routing + filtering + AWS events. SNS = simple pub/sub fan-out.'
    },
    {
      question: 'What is the difference between Kinesis Data Streams and Firehose?',
      options: ['Streams is managed, Firehose is not', 'Streams needs shard management and custom consumers, Firehose is fully managed with auto-scaling', 'They are identical', 'Firehose has lower latency'],
      correct: 1,
      explanation: 'Data Streams: you manage shards, write custom consumers, real-time (~200ms). Firehose: fully managed, auto-scaling, destinations (S3/Redshift/OpenSearch), 60s buffer, no custom consumers.',
      reference: 'Streams = real-time + custom consumers + shards. Firehose = managed + destinations + no shards.'
    },
    {
      question: 'What is the difference between Step Functions Standard and Express?',
      options: ['Standard is cheaper', 'Standard supports up to 1 year and exactly-once, Express up to 5 min with higher throughput', 'Express supports longer workflows', 'They have the same features'],
      correct: 1,
      explanation: 'Standard: up to 1 year, exactly-once, \\$0.025/1K transitions. Express: up to 5 min, at-least-once (async) or at-most-once (sync), \\$1/million executions, for high-volume short workflows.',
      reference: 'Standard = long workflows, exactly-once. Express = short, high-volume, cheaper.'
    },
    {
      question: 'When should you use Amazon MQ instead of SQS/SNS?',
      options: ['For all new applications', 'When migrating existing applications that use protocols like JMS, AMQP, or MQTT', 'When you need higher throughput', 'When you need fan-out'],
      correct: 1,
      explanation: 'Amazon MQ is for migrating existing applications using standard messaging protocols (JMS, AMQP, MQTT). For new cloud-native apps, always use SQS/SNS (more scalable, cheaper).',
      reference: 'Amazon MQ = migration from on-prem brokers. SQS/SNS = new cloud-native apps.'
    },
    {
      question: 'What is SQS long polling and why use it?',
      options: ['Polling every 100ms for speed', 'Wait up to 20 seconds for messages, reducing empty responses and cost', 'Automatic message deletion', 'Batch processing of messages'],
      correct: 1,
      explanation: 'Long polling (WaitTimeSeconds 1-20s) waits for messages before returning empty response. Reduces number of API calls, lowering costs. Short polling returns immediately even if empty.',
      reference: 'Long polling = fewer API calls, lower cost. Set WaitTimeSeconds > 0. Max 20s.'
    }
  ],

  flashcards: [
    { front: 'SQS Standard vs FIFO?', back: 'Standard: unlimited throughput, at-least-once (duplicates possible), best-effort ordering. FIFO: 300/3000 msg/s, exactly-once, strict ordering per message group ID. FIFO queue name must end in .fifo.' },
    { front: 'Key SQS features?', back: 'Visibility Timeout (default 30s), Dead-Letter Queue (after maxReceiveCount), Long Polling (1-20s wait, saves cost), Retention (1-14 days, default 4), Max size 256KB, Delay Queue (0-900s).' },
    { front: 'SNS fan-out pattern?', back: 'One SNS topic -> multiple SQS queue subscriptions. Each queue gets a copy of every message. Independent parallel processing. Add message filtering on subscriptions to reduce noise.' },
    { front: 'SQS vs SNS vs EventBridge?', back: 'SQS: queue, consumers pull. SNS: pub/sub, push to subscribers. EventBridge: event bus, advanced routing/filtering, 150+ targets, AWS service events, scheduler, archive/replay.' },
    { front: 'Step Functions Standard vs Express?', back: 'Standard: up to 1 year, exactly-once, \\$0.025/1K transitions, for long workflows. Express: up to 5 min, at-least/at-most-once, \\$1/M executions, for high-volume short workflows.' },
    { front: 'Kinesis Data Streams vs Firehose?', back: 'Streams: real-time ~200ms, manage shards (1MB/s in), custom consumers, 1-365 day retention. Firehose: managed, auto-scale, 60s buffer, destinations (S3/Redshift/OpenSearch), no custom consumers.' },
    { front: 'When to use Amazon MQ?', back: 'Migrating from on-prem message brokers using JMS/AMQP/MQTT/STOMP. Supports ActiveMQ and RabbitMQ. NOT for new cloud-native apps (use SQS/SNS instead).' },
    { front: 'What is EventBridge Archive & Replay?', back: 'Store events in an archive with optional filtering. Replay archived events to an event bus for debugging, recovery, or reprocessing. Useful for testing and disaster recovery.' }
  ],

  lab: {
    scenario: 'Build a decoupled order processing system using SQS, SNS, and Lambda.',
    objective: 'Practice creating queues, topics, fan-out patterns, and dead-letter queues.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create SQS Queue with Dead-Letter Queue',
        instruction: 'Create a main SQS queue and a DLQ. Configure the main queue to send failed messages to the DLQ after 3 receive attempts.',
        hints: ['Create DLQ first, then reference its ARN', 'Use RedrivePolicy for DLQ configuration'],
        solution: '```bash\n# Create DLQ\naws sqs create-queue --queue-name orders-dlq\n\n# Get DLQ ARN\nDLQ_ARN=$(aws sqs get-queue-attributes --queue-url QUEUE_URL \\\n  --attribute-names QueueArn --query "Attributes.QueueArn" --output text)\n\n# Create main queue with redrive policy\naws sqs create-queue --queue-name orders-queue \\\n  --attributes \'{"RedrivePolicy":"{\\\\\"deadLetterTargetArn\\\\\":\\\\\"DLQ_ARN\\\\\",\\\\\"maxReceiveCount\\\\\":\\\\\"3\\\\\"}","VisibilityTimeout":"60"}\'\n```',
        verify: '```bash\naws sqs get-queue-attributes --queue-url MAIN_QUEUE_URL \\\n  --attribute-names RedrivePolicy\n# Expected: deadLetterTargetArn = DLQ ARN, maxReceiveCount = 3\n```'
      },
      {
        title: 'Set Up SNS Fan-Out to Multiple Queues',
        instruction: 'Create an SNS topic and subscribe two SQS queues to it for parallel processing (e.g., one for billing, one for notifications).',
        hints: ['SNS needs permission to send to SQS', 'Use SQS queue policy to allow SNS'],
        solution: '```bash\n# Create SNS topic\naws sns create-topic --name order-events\n\n# Create two consumer queues\naws sqs create-queue --queue-name billing-queue\naws sqs create-queue --queue-name notification-queue\n\n# Subscribe queues to topic\naws sns subscribe --topic-arn TOPIC_ARN \\\n  --protocol sqs --notification-endpoint BILLING_QUEUE_ARN\n\naws sns subscribe --topic-arn TOPIC_ARN \\\n  --protocol sqs --notification-endpoint NOTIFICATION_QUEUE_ARN\n```',
        verify: '```bash\n# Publish test message\naws sns publish --topic-arn TOPIC_ARN \\\n  --message \'{"orderId":"123","total":99.99}\'\n\n# Check both queues received it\naws sqs receive-message --queue-url BILLING_QUEUE_URL\naws sqs receive-message --queue-url NOTIFICATION_QUEUE_URL\n# Expected: both queues have the message\n```'
      },
      {
        title: 'Configure Long Polling and Test Visibility Timeout',
        instruction: 'Enable long polling (20s) on a queue and test the visibility timeout behavior.',
        hints: ['ReceiveMessageWaitTimeSeconds for long polling', 'VisibilityTimeout controls how long message is hidden'],
        solution: '```bash\n# Enable long polling (20s wait)\naws sqs set-queue-attributes --queue-url QUEUE_URL \\\n  --attributes \'{"ReceiveMessageWaitTimeSeconds":"20"}\'\n\n# Send a test message\naws sqs send-message --queue-url QUEUE_URL \\\n  --message-body "test-message"\n\n# Receive (will wait up to 20s if no messages)\naws sqs receive-message --queue-url QUEUE_URL\n# Note the ReceiptHandle\n\n# Message is now invisible for VisibilityTimeout period\n# If not deleted, it reappears after timeout\n```',
        verify: '```bash\naws sqs get-queue-attributes --queue-url QUEUE_URL \\\n  --attribute-names ReceiveMessageWaitTimeSeconds,VisibilityTimeout\n# Expected: ReceiveMessageWaitTimeSeconds = 20\n# Expected: VisibilityTimeout = 60 (or your configured value)\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Messages Processed Multiple Times (Duplicates)',
      difficulty: 'medium',
      symptom: 'SQS Standard queue messages are being processed more than once by consumers.',
      diagnosis: '```\nSQS Standard delivers at-least-once (duplicates possible)\n\nCommon causes:\n1. Visibility timeout too short:\n   Consumer takes longer than timeout to process\n   Message becomes visible again, another consumer gets it\n\n2. Consumer not deleting message after processing:\n   Message reappears after visibility timeout\n\n3. Using Standard queue when FIFO is needed:\n   Standard does not guarantee exactly-once\n\nCheck:\n  - Consumer processing time vs visibility timeout\n  - Consumer code: is DeleteMessage called after success?\n  - ApproximateReceiveCount in message attributes\n```',
      solution: 'Option 1: Increase visibility timeout to be longer than max processing time. Option 2: Use SQS FIFO queue for exactly-once delivery. Option 3: Make consumer idempotent (safe to process same message twice). Always delete message after successful processing.'
    },
    {
      title: 'EventBridge Rule Not Triggering Target',
      difficulty: 'hard',
      symptom: 'EventBridge rule is configured but the target Lambda/SQS is never invoked.',
      diagnosis: '```\nChecklist:\n1. Event pattern matches actual event?\n   Test with: aws events test-event-pattern\n   Common: wrong source, detail-type, or detail fields\n\n2. Rule is on correct event bus?\n   Default bus for AWS events, custom bus for your events\n\n3. Target has resource-based policy allowing EventBridge?\n   Lambda: needs lambda:InvokeFunction permission for events.amazonaws.com\n   SQS: needs sqs:SendMessage permission for events.amazonaws.com\n\n4. Rule is enabled?\n   aws events describe-rule --name RULE_NAME\n   State should be ENABLED\n\n5. Event is actually being published?\n   aws events put-events --entries with test event\n```',
      solution: 'Most common issue is event pattern mismatch or missing resource-based policy on the target. Use CloudWatch Metrics for the rule (Invocations, FailedInvocations) to determine if rule matches but target fails, or rule never matches.'
    }
  ]
};
