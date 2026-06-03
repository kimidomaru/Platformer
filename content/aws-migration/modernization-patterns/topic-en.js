window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-migration/modernization-patterns'] = {
  theory: `# Application Modernization Patterns

## Exam Relevance
> **Design for New Solutions** is worth **29%** of SAP-C02. Modernization patterns (Strangler Fig, decomposition strategies), event-driven architecture, and decoupling patterns appear in complex scenario questions.

## Strangler Fig Pattern

Gradually replace a monolith with microservices:
1. **Identify** a bounded context in the monolith
2. **Build** a new microservice for that context
3. **Route** traffic for that function to new service (via API Gateway, ALB)
4. **Retire** the corresponding monolith code
5. Repeat until monolith is fully replaced

### AWS Implementation
- **API Gateway**: route by path prefix or header to new service vs monolith
- **ALB with weighted target groups**: gradual traffic shift
- **EventBridge**: intercept events from monolith to trigger new services

## Event-Driven Architecture (EDA)

Decouple services through events:
- **EventBridge**: event router — filter, transform, route to 20+ targets
- **SNS Fan-out**: publish once, multiple SQS queues receive
- **SQS for decoupling**: buffer between producer and consumer
- **Kinesis**: real-time event streaming (ordered, replay)
- **Kafka (MSK)**: managed Kafka for high-throughput, ordered events

### Event-Driven Patterns
- **Event Notification**: service publishes event, others react (fire and forget)
- **Event-Carried State Transfer**: event contains full state (no query back needed)
- **Event Sourcing**: store all events as the source of truth; derive state by replaying
- **CQRS (Command Query Responsibility Segregation)**: separate read and write models

## CQRS Pattern

Separate read and write sides of the data model:
- **Write side**: handles commands, enforces business rules, publishes events
- **Read side**: optimized projections/views for queries
- **Eventual consistency**: read side updated asynchronously via events

### AWS Implementation
- Write: DynamoDB or RDS for write operations
- Events: DynamoDB Streams -> Lambda -> update read model
- Read: ElastiCache or OpenSearch for fast queries

## Saga Pattern

Manage distributed transactions without 2PC:
- **Choreography**: services emit events, each subscribes to others' events
- **Orchestration**: central orchestrator (Step Functions) coordinates steps

### AWS Implementation
- Step Functions Standard: orchestrated saga with explicit rollback states
- Each step in saga = Lambda function
- Compensating transactions defined in Catch blocks

## Database Per Service Pattern

Each microservice owns its database:
- **No shared databases**: coupling through DB is anti-pattern
- **Polyglot persistence**: each service uses appropriate DB type
  - Order service: RDS Aurora (ACID transactions)
  - Product catalog: DynamoDB (flexible schema)
  - Search: OpenSearch
  - Analytics: Redshift

### Cross-Service Data
- API calls for synchronous queries
- Event-driven for async updates
- API Composition: aggregate data from multiple services in an API Gateway

## Anti-Corruption Layer

Translate between old and new system models:
- Adapter layer that prevents legacy model from contaminating new service
- Useful during gradual migration (Strangler Fig)
- AWS: Lambda function that transforms old data format to new

## Bulkhead Pattern

Isolate failures to prevent cascade:
- Each service has its own thread pool / connection pool / SQS queue
- Lambda reserved concurrency = bulkhead
- VPC subnets per service = network isolation
- SQS per service: one queue's backlog does not affect others

## Common Exam Mistakes

- Choosing 2PC (two-phase commit) for distributed transactions (use Saga instead)
- Not knowing Strangler Fig requires traffic routing layer (API GW, ALB)
- Using shared database between microservices (violates bounded context)
- Forgetting CQRS requires eventual consistency tolerance
- Choosing event sourcing when simple CRUD is sufficient (over-engineering)
`,

  quiz: [
    {
      question: 'What is the Strangler Fig pattern and how is it implemented in AWS?',
      options: ['Deleting legacy code immediately', 'Gradually replacing monolith functions by routing traffic to new microservices via API Gateway or ALB while keeping the monolith running', 'Deploying microservices alongside monolith in the same database', 'Event-based migration using SQS'],
      correct: 1,
      explanation: 'Strangler Fig: incrementally migrate a monolith by intercepting calls at the entry point (API Gateway/ALB) and routing specific paths to new microservices. The monolith continues running during migration. Functions migrate piece by piece.',
      reference: 'Strangler Fig = gradual replacement. Traffic routing = API GW or ALB. Monolith keeps running during migration.'
    },
    {
      question: 'When should you use CQRS (Command Query Responsibility Segregation)?',
      options: ['For all applications', 'When read and write patterns have very different requirements — high-volume reads need denormalized/indexed views, while writes need ACID guarantees', 'Only for NoSQL databases', 'For simple CRUD applications'],
      correct: 1,
      explanation: 'CQRS is valuable when read and write workloads are asymmetric: e.g., millions of reads (use ElastiCache/OpenSearch) vs hundreds of writes (use RDS). Adds complexity; use when the query optimization benefit justifies it.',
      reference: 'CQRS = separate read/write models. Use when read patterns differ from write patterns. Adds eventual consistency complexity.'
    },
    {
      question: 'What is the key difference between Saga Choreography and Orchestration?',
      options: ['Cost difference', 'Choreography: services communicate via events with no central coordinator; Orchestration: central service (Step Functions) manages the workflow', 'Choreography is faster', 'Orchestration only works with Lambda'],
      correct: 1,
      explanation: 'Choreography: decentralized, each service knows its own events and reacts to others. Harder to visualize. Orchestration: central orchestrator (Step Functions) directs each service. Easier to debug and visualize the workflow.',
      reference: 'Choreography = decentralized events, harder to debug. Orchestration = central coordinator (Step Functions), easier to trace.'
    },
    {
      question: 'Why is the "Database per Service" pattern important in microservices?',
      options: ['It reduces costs', 'It ensures loose coupling — services can change their database schema without affecting other services, and each can use the optimal DB type', 'It improves performance', 'It simplifies backup'],
      correct: 1,
      explanation: 'Shared databases create tight coupling: any schema change affects all services, and one service can overwhelm the DB affecting others. Database per service enables independent deployment, polyglot persistence, and true bounded contexts.',
      reference: 'DB per service = loose coupling, polyglot persistence, independent deployment. No shared DB is a core microservices principle.'
    },
    {
      question: 'In a microservices architecture, a payment service fails and causes the entire checkout flow to fail. Which pattern addresses this?',
      options: ['Strangler Fig', 'Bulkhead pattern — isolate failures by giving each service independent resources (Lambda reserved concurrency, separate SQS queues)', 'CQRS', 'Event Sourcing'],
      correct: 1,
      explanation: 'Bulkhead: isolate failures to one service. Lambda reserved concurrency prevents one service consuming all regional concurrency. Separate SQS queues prevent one backlog from affecting others. Mimics ship bulkheads that contain flooding to one compartment.',
      reference: 'Bulkhead = isolate failures. Lambda reserved concurrency = bulkhead for functions. SQS per service = queue isolation.'
    },
    {
      question: 'What is Event Sourcing and when should you use it?',
      options: ['SQS event filtering', 'Store all state changes as an immutable sequence of events; rebuild current state by replaying events. Good for audit trails, temporal queries, debugging', 'CloudWatch Events', 'Event-based triggers'],
      correct: 1,
      explanation: 'Event Sourcing: instead of storing current state in DB, store the complete history of events. Current state derived by replaying events. Benefits: full audit trail, time travel (replay to any point), debugging. Complexity: replay time for large histories.',
      reference: 'Event Sourcing = immutable event log, replay to derive state. For audit trails + temporal queries. Complex, not for simple CRUD.'
    },
    {
      question: 'What does the Anti-Corruption Layer pattern prevent in migration scenarios?',
      options: ['Security vulnerabilities', 'The legacy system domain model from leaking into and corrupting the new service design', 'Data corruption during migration', 'Cost overruns'],
      correct: 1,
      explanation: 'Anti-Corruption Layer (ACL): a translation layer between old and new system boundaries. Prevents legacy concepts (old naming conventions, data formats, business rules) from creeping into the new architecture.',
      reference: 'ACL = translation layer between legacy and new service. Prevents legacy model contamination. Common in Strangler Fig migration.'
    },
    {
      question: 'Why should you avoid distributed transactions (2PC) in microservices and use Saga instead?',
      options: ['2PC is too expensive', '2PC requires a coordinator that creates a distributed lock — services must wait, reducing availability and creating tight coupling. Saga uses eventual consistency', '2PC does not work with AWS', 'Saga is faster'],
      correct: 1,
      explanation: '2PC: coordinator locks all participants until all confirm — single point of failure, availability decreases. Saga: each step is a local transaction with a compensating transaction if it fails. Embraces eventual consistency for better availability.',
      reference: '2PC = distributed lock, tight coupling, availability risk. Saga = eventual consistency, compensating transactions, loosely coupled.'
    }
  ],

  flashcards: [
    { front: 'Strangler Fig pattern?', back: 'Gradually replace monolith: 1. Identify bounded context. 2. Build microservice. 3. Route traffic via API GW/ALB. 4. Retire monolith code. Repeat until monolith gone. Monolith keeps running throughout.' },
    { front: 'CQRS pattern?', back: 'Separate read (query) and write (command) models. Write: ACID DB, business rules, emits events. Read: denormalized/indexed view, eventual consistency. Use when read/write patterns are asymmetric.' },
    { front: 'Saga pattern variants?', back: 'Choreography: services emit events, react to others (decentralized). Orchestration: central coordinator (Step Functions) directs workflow. Orchestration = easier to debug. Choreography = more decoupled.' },
    { front: 'Event-Driven patterns?', back: 'Event Notification: fire & forget. Event-Carried State Transfer: full state in event. Event Sourcing: events as source of truth, replay to derive state. CQRS: separate read/write sides.' },
    { front: 'Database per Service benefits?', back: 'Loose coupling: schema changes do not affect other services. Polyglot persistence: each service uses optimal DB. Independent scaling. True bounded contexts. No shared DB = core microservices principle.' },
    { front: 'Bulkhead pattern in AWS?', back: 'Isolate failures to prevent cascade. Lambda: Reserved Concurrency limits per function. SQS: separate queue per service. VPC subnets: network isolation. DLQ: capture failures without affecting main flow.' },
    { front: 'Anti-Corruption Layer?', back: 'Translation layer at old/new system boundary. Prevents legacy data model, naming, or concepts from leaking into new service design. Common in Strangler Fig migration. Implement as Lambda adapter or API Gateway mapping.' },
    { front: 'When to use Event Sourcing?', back: 'Use for: audit trails, time travel (replay history), debugging complex state. Not for: simple CRUD, when eventual consistency is problematic, when replay is too slow (billions of events). Adds significant complexity.' }
  ],

  lab: {
    scenario: 'Implement a Saga pattern for a distributed order processing workflow using Step Functions.',
    objective: 'Practice orchestrated Saga, compensating transactions, and event-driven architecture.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Design the Saga State Machine',
        instruction: 'Create a Step Functions state machine implementing the Saga pattern for an order: Reserve Inventory -> Charge Payment -> Confirm Order, with compensating transactions on failure.',
        hints: ['Each step must have a compensating transaction (rollback)', 'Use Catch blocks to trigger compensation', 'Step Functions Standard for audit history'],
        solution: '```bash\naws stepfunctions create-state-machine \\\n  --name OrderSaga \\\n  --type STANDARD \\\n  --role-arn arn:aws:iam::ACCT:role/StepFunctionsRole \\\n  --definition \'{\n  "StartAt": "ReserveInventory",\n  "States": {\n    "ReserveInventory": {\n      "Type": "Task",\n      "Resource": "arn:aws:lambda:us-east-1:ACCT:function:ReserveInventory",\n      "Next": "ChargePayment",\n      "Catch": [{"ErrorEquals":["States.ALL"],"Next":"SagaFailed","ResultPath":"$.error"}]\n    },\n    "ChargePayment": {\n      "Type": "Task",\n      "Resource": "arn:aws:lambda:us-east-1:ACCT:function:ChargePayment",\n      "Next": "ConfirmOrder",\n      "Catch": [{"ErrorEquals":["States.ALL"],"Next":"ReleaseInventory","ResultPath":"$.error"}]\n    },\n    "ConfirmOrder": {\n      "Type": "Task",\n      "Resource": "arn:aws:lambda:us-east-1:ACCT:function:ConfirmOrder",\n      "End": true\n    },\n    "ReleaseInventory": {\n      "Type": "Task",\n      "Resource": "arn:aws:lambda:us-east-1:ACCT:function:ReleaseInventory",\n      "Next": "SagaFailed"\n    },\n    "SagaFailed": {"Type": "Fail", "Error": "OrderSagaFailed"}\n  }\n}\'\n```',
        verify: '```bash\naws stepfunctions describe-state-machine \\\n  --state-machine-arn arn:aws:states:us-east-1:ACCT:stateMachine:OrderSaga\n# Expected: status = ACTIVE\n\naws stepfunctions start-execution \\\n  --state-machine-arn arn:aws:states:us-east-1:ACCT:stateMachine:OrderSaga \\\n  --input \'{"orderId":"123","amount":99.99,"productId":"p-456"}\'\n# Monitor execution in console for state transitions\n```'
      },
      {
        title: 'Implement Strangler Fig with API Gateway',
        instruction: 'Create API Gateway routes that gradually shift traffic from the monolith to a new microservice using path-based routing.',
        hints: ['Route /v2/orders to new microservice Lambda', 'Route /v1/orders to existing monolith integration', 'Can use ALB weighted target groups for percentage routing'],
        solution: '```bash\n# Create HTTP API Gateway\naws apigatewayv2 create-api \\\n  --name StranglerFigAPI \\\n  --protocol-type HTTP\n\n# Route new path to microservice\naws apigatewayv2 create-route \\\n  --api-id API_ID \\\n  --route-key "POST /v2/orders" \\\n  --target integrations/NEW_INTEGRATION_ID\n\n# Route legacy path to monolith\naws apigatewayv2 create-route \\\n  --api-id API_ID \\\n  --route-key "POST /v1/orders" \\\n  --target integrations/MONOLITH_INTEGRATION_ID\n```',
        verify: '```bash\naws apigatewayv2 get-routes --api-id API_ID\n# Expected: POST /v1/orders (monolith) and POST /v2/orders (microservice)\n\n# Test routing\ncurl -X POST https://API_ID.execute-api.us-east-1.amazonaws.com/v2/orders \\\n  -d \'{"productId":"p-123"}\'\n# Expected: response from new microservice Lambda\n```'
      },
      {
        title: 'Implement CQRS with DynamoDB Streams',
        instruction: 'Set up CQRS using DynamoDB as the write store and a Lambda that updates an ElastiCache read model from DynamoDB Streams.',
        hints: ['DynamoDB Streams captures all changes', 'Lambda processes stream events to update read model', 'ElastiCache provides fast read access'],
        solution: '```bash\n# Enable DynamoDB Streams on write table\naws dynamodb update-table \\\n  --table-name Orders \\\n  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES\n\n# Create Lambda to process stream -> update read model\naws lambda create-event-source-mapping \\\n  --function-name UpdateReadModel \\\n  --event-source-arn arn:aws:dynamodb:us-east-1:ACCT:table/Orders/stream/... \\\n  --batch-size 10 \\\n  --starting-position LATEST\n\n# Lambda UpdateReadModel reads from stream\n# and updates ElastiCache with aggregated view\n```',
        verify: '```bash\naws dynamodb describe-table --table-name Orders \\\n  --query "Table.StreamSpecification"\n# Expected: StreamEnabled = true, StreamViewType = NEW_AND_OLD_IMAGES\n\naws lambda list-event-source-mappings \\\n  --function-name UpdateReadModel\n# Expected: DynamoDB stream mapping in state Enabled\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Saga Failing Without Triggering Compensation',
      difficulty: 'hard',
      symptom: 'Step Functions Saga fails at the payment step but inventory is never released. System is left in inconsistent state with reserved inventory and no order.',
      diagnosis: '```\nSaga compensation checklist:\n1. Check State Machine definition:\n   Each state needs a Catch block that triggers compensation\n   If Catch is missing -> failure propagates to parent without compensation\n\n2. Step Functions execution history:\n   aws stepfunctions get-execution-history \\\n     --execution-arn EXECUTION_ARN\n   Look for TaskFailed events and what happens after\n\n3. Compensating Lambda errors:\n   If the compensation Lambda (ReleaseInventory) also fails:\n   -> Need retry logic in compensating states\n   -> Log compensation failures to DLQ or alerting\n\n4. Idempotency:\n   Compensating transactions MUST be idempotent\n   Multiple retries of ReleaseInventory must be safe\n\n5. ResultPath in Catch:\n   ResultPath="$.error" preserves original input\n   Without it, error replaces the input context\n```',
      solution: 'Add Catch blocks to every task state that should trigger compensation. Verify the compensating states are reachable and do not fail silently. Make compensating Lambdas idempotent (use orderId for deduplication). Add retry logic to compensation steps. Consider a final "Saga Log" step that records the final outcome to a monitoring system.'
    },
    {
      title: 'CQRS Read Model Out of Sync with Write Model',
      difficulty: 'medium',
      symptom: 'Users see stale data in the application. Orders placed 30 seconds ago still show as "Pending" despite being confirmed in the write database.',
      diagnosis: '```\nCQRS eventual consistency lag checklist:\n1. DynamoDB Streams processing delay:\n   Check Lambda metrics: Iterator Age\n   If Iterator Age > threshold: Lambda is behind on stream processing\n   aws cloudwatch get-metric-statistics \\\n     --namespace AWS/Lambda \\\n     --metric-name IteratorAge \\\n     --dimensions Name=FunctionName,Value=UpdateReadModel\n\n2. Lambda errors in stream processing:\n   aws logs filter-log-events \\\n     --log-group-name /aws/lambda/UpdateReadModel \\\n     --filter-pattern "ERROR"\n   Errors cause Lambda to retry, increasing lag\n\n3. Throttling:\n   ElastiCache write throttling\n   Lambda concurrency limits\n\n4. Expected behavior vs bug:\n   CQRS is eventually consistent by design\n   If lag is typically < 1 second but now 30s -> processing issue\n   If lag is always 30s -> design issue (too much processing)\n\n5. Read model cache TTL:\n   If ElastiCache TTL is 30s, even updated read model\n   may return stale cached response\n```',
      solution: 'Check Lambda IteratorAge CloudWatch metric to see how far behind stream processing is. Check Lambda function logs for errors. Ensure Lambda processes DynamoDB stream events without errors. Consider SQS DLQ for failed stream processing events. Review ElastiCache TTL settings — reduce for fresher data. Set user expectation appropriately for eventual consistency scenarios.'
    }
  ]
};
