window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-new-solutions/serverless-architecture'] = {
  theory: `# Serverless Architecture at Scale

## Exam Relevance
> **Design for New Solutions** is worth **29%** of SAP-C02. Advanced serverless patterns, Lambda optimizations, orchestration with Step Functions, and event-driven architectures are core topics.

## AWS Lambda Advanced

### Performance Optimization
- **Memory**: 128 MB – 10,240 MB. CPU scales linearly with memory. More memory = faster execution = often cheaper.
- **Provisioned Concurrency**: pre-warms Lambda instances to eliminate cold starts. For latency-sensitive functions.
- **Reserved Concurrency**: limits max concurrent executions for a function (throttle protection + cost control).
- **Execution timeout**: max 15 minutes.
- **/tmp storage**: up to 10 GB ephemeral storage per invocation.

### Lambda Layers & Destinations
- **Layers**: share code/libraries across functions (up to 5 layers). Max 250 MB unzipped.
- **Destinations**: route async invocation results to SQS, SNS, Lambda, or EventBridge (success + failure separately).
- **Lambda URLs**: built-in HTTPS endpoint without API Gateway.
- **Response Streaming**: stream large responses back to clients (not buffered).

### Concurrency
| Type | Purpose |
|------|---------|
| **Unreserved** | Shared pool, bursts to regional limit |
| **Reserved** | Hard cap per function (ensures availability, limits blast radius) |
| **Provisioned** | Pre-initialized, eliminates cold starts (cost extra) |

## API Gateway

| Type | Protocol | Use Case |
|------|----------|----------|
| **REST API** | HTTP/REST | Full-featured API management |
| **HTTP API** | HTTP/REST | Lower cost/latency, fewer features |
| **WebSocket API** | WebSocket | Real-time bidirectional apps (chat, games) |

Key features:
- **Authorizers**: Lambda custom authorizer (JWT, custom logic) or Cognito User Pool
- **Usage Plans + API Keys**: rate limiting and quota per customer
- **Caching**: cache responses (TTL configurable) to reduce backend calls
- **Throttling**: default 10,000 rps soft limit, 5,000 burst
- **Private endpoints**: interface endpoint in VPC

## AWS Step Functions

Orchestrate serverless workflows with state machines:
- **Standard**: long-running (up to 1 year), exactly-once, auditable history. For human approvals, ETL.
- **Express**: high-volume, at-least-once, max 5 minutes. For IoT, streaming, microservices.
- **Activities**: allow external workers to poll for tasks (hybrid integration)
- **SDK integrations**: directly call 200+ AWS services without Lambda wrapper

### Workflow Patterns
- **Sequential**: steps run one after another
- **Parallel**: multiple branches run concurrently
- **Map**: iterate over array items (fan-out)
- **Wait for callback (task token)**: pause workflow until external system sends token back

## AWS AppSync (GraphQL)

- **Resolvers**: connect GraphQL operations to DynamoDB, Lambda, HTTP, Elasticsearch
- **Real-time subscriptions**: WebSocket for live data (IoT, dashboards)
- **Offline sync**: conflict resolution for mobile apps (Cognito + AppSync)

## EventBridge Advanced

- **Event Buses**: default (AWS services), custom, partner (SaaS events from Datadog, Zendesk, etc.)
- **Pipes**: point-to-point between event source and target, with optional filtering/enrichment
- **Scheduler**: cron-based or rate-based event delivery (replacement for CloudWatch Events)
- **Schema Registry**: auto-discover and document event schemas

## SAM & CDK

| Tool | Language | Abstraction |
|------|----------|-------------|
| **SAM** | YAML/JSON | Simple serverless (Lambda, API GW, DynamoDB) |
| **CDK** | TypeScript, Python, Java... | Full AWS infrastructure as code |

## Common Exam Mistakes

- Not using Provisioned Concurrency for latency-critical functions
- Using Standard Step Functions when Express is needed for high-volume (cost)
- Forgetting Lambda Destinations vs Dead Letter Queues (Destinations are async only)
- Choosing REST API Gateway when HTTP API suffices (2x lower cost)
- Missing that Lambda Reserved Concurrency can cause throttling if set too low
`,

  quiz: [
    {
      question: 'What is the difference between Lambda Reserved and Provisioned Concurrency?',
      options: ['They are the same', 'Reserved = hard cap on concurrent executions; Provisioned = pre-warmed instances to eliminate cold starts', 'Provisioned limits executions, Reserved pre-warms', 'Reserved is for scheduled functions only'],
      correct: 1,
      explanation: 'Reserved Concurrency: maximum concurrent executions allowed for a function (throttles beyond that). Provisioned Concurrency: pre-initializes execution environments to eliminate cold start latency.',
      reference: 'Reserved = cap (throttle above limit). Provisioned = pre-warm (eliminate cold start). Both cost extra.'
    },
    {
      question: 'When should you use Step Functions Express Workflow vs Standard?',
      options: ['Standard for everything', 'Express for high-volume, short-duration (<5min); Standard for long-running, exactly-once, with audit trail', 'Express for human approval workflows', 'Standard for IoT event processing'],
      correct: 1,
      explanation: 'Express: high-volume (100k events/sec), at-least-once, max 5 min, cheaper for high throughput. Standard: up to 1 year, exactly-once, full audit history, for ETL/human approval workflows.',
      reference: 'Express = high volume, at-least-once, <5min. Standard = long-running, exactly-once, audit history.'
    },
    {
      question: 'What is the difference between API Gateway REST API and HTTP API?',
      options: ['No difference', 'HTTP API is 70% cheaper with lower latency but fewer features; REST API has full feature set (WAF, caching, usage plans)', 'REST API is cheaper', 'HTTP API supports WebSocket'],
      correct: 1,
      explanation: 'HTTP API: lower cost (~70% less), lower latency, JWT/Cognito auth, VPC links. No WAF integration, no response caching, no usage plans. REST API: full feature set including WAF, caching, API keys, custom authorizers.',
      reference: 'HTTP API = cheap/fast/simple. REST API = full features (WAF, cache, usage plans). WebSocket API = real-time.'
    },
    {
      question: 'What do Lambda Destinations provide that DLQ does not?',
      options: ['DLQ and Destinations are identical', 'Destinations can route to SQS/SNS/Lambda/EventBridge for BOTH success and failure; DLQ only handles failures', 'Destinations work for sync invocations; DLQ for async', 'DLQ is cheaper'],
      correct: 1,
      explanation: 'Lambda Destinations: async invocations only, route to SQS/SNS/Lambda/EventBridge for both success AND failure, with full event context. DLQ: only failure, only SQS or SNS, less context.',
      reference: 'Destinations = async only, success+failure, full context. DLQ = failure only, SQS/SNS, less context.'
    },
    {
      question: 'What does Lambda Provisioned Concurrency specifically solve?',
      options: ['Memory limits', 'Cold start latency — functions respond immediately without initialization delay', 'Execution timeout', 'Cost reduction'],
      correct: 1,
      explanation: 'Cold starts occur when Lambda initializes a new execution environment. Provisioned Concurrency pre-warms environments so requests are handled immediately (sub-millisecond response after pre-warming). Costs extra.',
      reference: 'Provisioned Concurrency = eliminate cold start. Required for latency-sensitive APIs. Costs extra per provisioned execution.'
    },
    {
      question: 'What is the Step Functions "wait for callback" pattern used for?',
      options: ['Polling external services', 'Pausing a workflow until an external system sends a task token back (human approval, async external processing)', 'Waiting for Lambda timeout', 'Retry logic'],
      correct: 1,
      explanation: 'Wait for callback (task token): Step Functions sends a task token to an external service (email, SQS, Lambda). The workflow pauses until SendTaskSuccess/SendTaskFailure is called with that token.',
      reference: 'Task token = async human approval pattern. External system calls back with token to resume workflow.'
    },
    {
      question: 'Which Lambda limit can cause silent throttling across all functions in a Region?',
      options: ['Memory limit', 'Unreserved concurrency pool — if functions consume all of it, other functions cannot scale', 'Storage limit', 'Execution timeout'],
      correct: 1,
      explanation: 'Each Region has a concurrent execution limit (default 1000). If functions without reserved concurrency consume it all, other functions get throttled. Reserved Concurrency protects critical functions.',
      reference: 'Regional concurrency limit = shared pool. Reserved Concurrency = protect critical functions from starvation.'
    },
    {
      question: 'What does AppSync provide that standard REST APIs do not?',
      options: ['Better performance', 'GraphQL with real-time subscriptions, offline sync, and fine-grained field-level authorization', 'Cheaper pricing', 'Auto-scaling'],
      correct: 1,
      explanation: 'AppSync: GraphQL API with real-time WebSocket subscriptions, offline sync for mobile, field-level authorization with Cognito/IAM/API Key. Standard REST APIs require custom implementation for all of these.',
      reference: 'AppSync = GraphQL + real-time subscriptions + offline sync. For mobile apps and real-time dashboards.'
    }
  ],

  flashcards: [
    { front: 'Lambda concurrency types?', back: 'Unreserved: shared regional pool, can burst. Reserved: hard cap per function (protect + limit). Provisioned: pre-warmed instances, eliminates cold starts (extra cost). Regional limit default 1000.' },
    { front: 'Step Functions Standard vs Express?', back: 'Standard: up to 1 year, exactly-once, full audit history, for ETL/human approval. Express: high-volume (100k/s), at-least-once, max 5 min, cheaper for IoT/streaming. Sync Express = response inline.' },
    { front: 'API Gateway types?', back: 'REST API: full features (WAF, cache, usage plans, custom auth). HTTP API: 70% cheaper, lower latency, JWT/Cognito, fewer features. WebSocket API: bidirectional real-time (chat, games).' },
    { front: 'Lambda Destinations vs DLQ?', back: 'Destinations: async only, success+failure routing, to SQS/SNS/Lambda/EventBridge, full event context. DLQ: failure only, SQS/SNS only, less context. Destinations are more powerful for async error handling.' },
    { front: 'Lambda Layers?', back: 'Share code/libraries across functions without bundling in each deployment package. Up to 5 layers per function. Max 250 MB unzipped. Includes dependencies, custom runtimes, Lambda extensions.' },
    { front: 'EventBridge components?', back: 'Event Buses: default(AWS), custom(app), partner(SaaS). Pipes: point-to-point source->target with filter+enrich. Scheduler: cron/rate delivery. Schema Registry: auto-discover event schemas.' },
    { front: 'AppSync features?', back: 'GraphQL API. Resolvers: DynamoDB, Lambda, HTTP, OpenSearch. Real-time WebSocket subscriptions. Offline sync with conflict resolution. Field-level auth: Cognito, IAM, API Key, OIDC.' },
    { front: 'SAM vs CDK?', back: 'SAM: YAML/JSON, simplified serverless (Lambda, API GW, DynamoDB), transforms to CloudFormation. CDK: TypeScript/Python/Java/etc., full AWS constructs, imperative, generates CloudFormation. CDK more powerful/flexible.' }
  ],

  lab: {
    scenario: 'Build a serverless order processing pipeline with Lambda, Step Functions, and API Gateway.',
    objective: 'Practice Lambda configuration, Step Functions orchestration, and API Gateway setup.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Deploy Lambda with Provisioned Concurrency',
        instruction: 'Create a Lambda function with provisioned concurrency to eliminate cold starts for a critical order API.',
        hints: ['Publish a version before setting provisioned concurrency', 'Provisioned concurrency is set on a version or alias'],
        solution: '```bash\n# Create Lambda function\naws lambda create-function --function-name OrderProcessor \\\n  --runtime python3.12 \\\n  --role arn:aws:iam::ACCT:role/lambda-role \\\n  --handler index.handler \\\n  --zip-file fileb://function.zip \\\n  --timeout 30 --memory-size 512\n\n# Publish a version\naws lambda publish-version --function-name OrderProcessor\n\n# Set provisioned concurrency on version 1\naws lambda put-provisioned-concurrency-config \\\n  --function-name OrderProcessor \\\n  --qualifier 1 \\\n  --provisioned-concurrent-executions 10\n```',
        verify: '```bash\naws lambda get-provisioned-concurrency-config \\\n  --function-name OrderProcessor \\\n  --qualifier 1\n# Expected: AllocatedProvisionedConcurrentExecutions = 10\n# Status = READY (not IN_PROGRESS)\n```'
      },
      {
        title: 'Create Step Functions State Machine for Order Workflow',
        instruction: 'Create a Standard Step Functions state machine that validates, processes, and notifies for an order.',
        hints: ['Use Standard workflow for audit history', 'SDK integrations can call DynamoDB directly'],
        solution: '```bash\naws stepfunctions create-state-machine \\\n  --name OrderWorkflow \\\n  --type STANDARD \\\n  --role-arn arn:aws:iam::ACCT:role/stepfunctions-role \\\n  --definition \'{\n  "Comment": "Order processing workflow",\n  "StartAt": "ValidateOrder",\n  "States": {\n    "ValidateOrder": {\n      "Type": "Task",\n      "Resource": "arn:aws:lambda:us-east-1:ACCT:function:ValidateOrder",\n      "Next": "ProcessPayment",\n      "Catch": [{"ErrorEquals": ["States.ALL"],"Next": "OrderFailed"}]\n    },\n    "ProcessPayment": {\n      "Type": "Task",\n      "Resource": "arn:aws:lambda:us-east-1:ACCT:function:ProcessPayment",\n      "Next": "NotifyCustomer"\n    },\n    "NotifyCustomer": {\n      "Type": "Task",\n      "Resource": "arn:aws:states:::sns:publish",\n      "Parameters": {"TopicArn": "arn:aws:sns:us-east-1:ACCT:orders","Message.$": "$.orderId"},\n      "End": true\n    },\n    "OrderFailed": {"Type": "Fail", "Error": "OrderValidationFailed"}\n  }\n}\'\n```',
        verify: '```bash\naws stepfunctions describe-state-machine \\\n  --state-machine-arn arn:aws:states:us-east-1:ACCT:stateMachine:OrderWorkflow\n# Expected: status = ACTIVE, type = STANDARD\n\n# Test execution\naws stepfunctions start-execution \\\n  --state-machine-arn arn:aws:states:us-east-1:ACCT:stateMachine:OrderWorkflow \\\n  --input \'{"orderId": "order-123"}\'\n```'
      },
      {
        title: 'Create HTTP API Gateway with Lambda Integration',
        instruction: 'Create an HTTP API Gateway (cheaper than REST) with JWT authorization and Lambda integration.',
        hints: ['HTTP API is ~70% cheaper than REST API', 'JWT authorizer validates tokens from Cognito'],
        solution: '```bash\n# Create HTTP API\naws apigatewayv2 create-api \\\n  --name OrderAPI \\\n  --protocol-type HTTP \\\n  --cors-configuration AllowOrigins="*",AllowMethods="GET,POST"\n\n# Create Lambda integration\naws apigatewayv2 create-integration \\\n  --api-id API_ID \\\n  --integration-type AWS_PROXY \\\n  --integration-uri arn:aws:lambda:us-east-1:ACCT:function:OrderProcessor \\\n  --payload-format-version 2.0\n\n# Create route\naws apigatewayv2 create-route \\\n  --api-id API_ID \\\n  --route-key "POST /orders" \\\n  --target integrations/INTEGRATION_ID\n```',
        verify: '```bash\naws apigatewayv2 get-api --api-id API_ID\n# Expected: ProtocolType = HTTP, ApiEndpoint shown\n\naws apigatewayv2 get-routes --api-id API_ID\n# Expected: POST /orders route with Lambda integration\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Lambda Cold Starts Causing API Latency Spikes',
      difficulty: 'medium',
      symptom: 'API responses are fast most of the time but occasionally spike to 2-5 seconds. Happens more after periods of inactivity.',
      diagnosis: '```\nCold start indicators:\n1. X-Ray traces: "Initialization" segment present (cold start)\n2. CloudWatch Logs: REPORT line with "Init Duration: XXX ms"\n3. Pattern: spikes after inactivity or after new deployments\n\nCold start factors:\n- Runtime: Node/Python have faster cold starts than Java/.NET\n- Package size: larger = slower init\n- VPC: adds 1-3s for ENI creation (if function is in VPC)\n- Memory: more memory = faster init\n\nMitigations:\n1. Provisioned Concurrency (eliminates cold starts)\n2. Keep functions warm with scheduled ping (workaround)\n3. Increase memory (speeds up init)\n4. Reduce package size (layers, tree-shaking)\n5. VPC: use only if needed\n```',
      solution: 'For production latency-critical functions: enable Provisioned Concurrency on the published version/alias. Check X-Ray for "Initialization" segments. Reduce deployment package size. Avoid placing Lambda in VPC unless needed (adds ENI creation time). SnapStart available for Java (pre-snapshot execution environment).'
    },
    {
      title: 'Step Functions Execution Failing with States.TaskFailed',
      difficulty: 'hard',
      symptom: 'Step Functions state machine executions fail at a Lambda task with States.TaskFailed error. Lambda function works when invoked directly.',
      diagnosis: '```\nStates.TaskFailed diagnosis:\n1. Check execution details:\n   aws stepfunctions get-execution-history \\\n     --execution-arn arn:aws:states:...\n   Look for TaskFailed event with cause/error\n\n2. Common causes:\n   a) Lambda function throws uncaught exception\n      -> Check CloudWatch Logs for the Lambda invocation\n   b) Step Functions IAM role lacks lambda:InvokeFunction\n      -> Check error: "AccessDenied" in cause\n   c) Lambda timeout exceeded\n      -> Lambda default 3s, Step Functions can set higher\n   d) Lambda reserved concurrency throttling\n      -> Error: "TooManyRequestsException"\n\n3. Retry + Catch configuration:\n   Add Retry for transient errors (Lambda.TooManyRequestsException)\n   Add Catch for permanent failures\n\nCheck Lambda logs:\n  aws logs filter-log-events \\\n    --log-group-name /aws/lambda/FUNCTION_NAME \\\n    --filter-pattern "ERROR"\n```',
      solution: 'Check execution history for the exact error cause. Verify Step Functions IAM role has lambda:InvokeFunction permission. Check Lambda function logs for exceptions. Add Retry blocks for transient errors (throttling, network). Add Catch blocks to handle failures gracefully. Consider increasing Lambda timeout in function config.'
    }
  ]
};
