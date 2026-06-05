window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-infrastructure/application-architecture'] = {
  theory: `# Application Architecture Design (AZ-305)

## Exam Relevance
> Estimated weight **15-20%** in AZ-305. The exam evaluates the ability to choose between monoliths, microservices, serverless, and event-driven for specific requirements.

## Architecture Styles

### When to use each style

| Style | When to choose | When to avoid |
|-------|---------------|--------------|
| **Monolith** | MVP, small team, simple domain | Independent scale required |
| **Microservices** | Independent scale, multiple teams, independent deploys | Small team, new domain |
| **Event-Driven** | Decoupling, async processing | Immediate consistency required |
| **Serverless** | Irregular workloads, event-triggered | Long duration, complex state |
| **N-Tier** | Clear separation of presentation/business/data | High scale of specific components |

## Pattern: CQRS + Event Sourcing

\`\`\`
CQRS (Command Query Responsibility Segregation):

  Commands (write):                  Queries (read):
  POST /orders → Command Handler     GET /orders → Read Model (optimized)
       ↓                                  ↑
  Domain Logic + Validation          Denormalized projection
       ↓                                  ↑
  Write DB (normalized)          Event Handler (updates read model)
       ↓                                  ↑
  Publish OrderCreated Event ────────────┘
\`\`\`

### Event Sourcing
\`\`\`
Instead of saving current state, saves all events:

  Current state: { status: "shipped", address: "123 Main St" }

  Event Store (immutable):
  1. OrderCreated   { items: [...], address: "123 Main St" }
  2. PaymentApproved { amount: 150.00 }
  3. OrderShipped   { trackingCode: "BR123" }

  Benefits: complete audit trail, event replay, time-travel debugging
  Cost: complexity, eventual consistency
\`\`\`

## Pattern: Strangler Fig (Gradual Migration)

For migrating a monolith to microservices without a big bang:

\`\`\`
Phase 1: Intact monolith + facade (API Gateway in front)
  Client → API Gateway → Monolith

Phase 2: Gradually extract services
  Client → API Gateway → Monolith (80% of functionality)
                       ↘ Auth Service (extracted)
                       ↘ Payment Service (extracted)

Phase 3: Residual monolith or retirement
\`\`\`

## Pattern: Saga for Distributed Transactions

Microservices have no distributed transactions — they use Sagas:

\`\`\`
Choreography-based Saga (Event-driven):
  OrderService → OrderCreated event
  PaymentService → listens → PaymentProcessed event
  InventoryService → listens → InventoryReserved event
  ShippingService → listens → ShipmentCreated event

  Compensation if failure:
  InventoryService → InventoryReleaseFailed → PaymentRefunded → OrderCancelled

Orchestration-based Saga (Azure Durable Functions):
  OrchestrationFunction:
    1. CallActivity(ProcessPayment)
    2. CallActivity(ReserveInventory) - if fails, compensate
    3. CallActivity(CreateShipment)
    4. Automatic compensations if exception
\`\`\`

## Pattern: Backend for Frontend (BFF)

\`\`\`
Mobile App    Web App     Partner API
     ↓            ↓            ↓
Mobile BFF    Web BFF    Partner BFF
     ↓            ↓            ↓
         Core Microservices
\`\`\`

Each BFF is optimized for the client it serves — avoids over-fetching/under-fetching.

## Azure-specific: Durable Functions for Workflows

\`\`\`python
# Orchestration Function (Python)
import azure.durable_functions as df

def orchestrator_function(context: df.DurableOrchestrationContext):
    # 1. Process payment
    payment_result = yield context.call_activity('ProcessPayment', {
        'amount': context.get_input()['amount']
    })

    if not payment_result['success']:
        raise Exception("Payment failed")

    # 2. Reserve inventory (parallel fan-out)
    tasks = [
        context.call_activity('ReserveItem', item)
        for item in context.get_input()['items']
    ]
    results = yield context.task_all(tasks)

    # 3. Create shipment
    yield context.call_activity('CreateShipment', {
        'items': results,
        'address': context.get_input()['address']
    })

    return "Order completed"
\`\`\`

## Common Design Mistakes

1. **Premature microservices**: do not use microservices before understanding the domain — a distributed monolith is worse than a monolith.
2. **Chatty microservices**: microservices that call each other 10 times per request introduce latency and coupling. Group into a single service if needed.
3. **Shared database between microservices**: violates the autonomy principle — each service must have its own database.
4. **Saga without compensation**: distributed transactions without compensation logic leave data inconsistent.
5. **CQRS where not needed**: CQRS increases complexity — only use it when there is a real difference between read and write loads.

## Killer.sh Style Challenge

> A company has an e-commerce monolith with 2M users. The shopping cart module is the bottleneck — independent scale is needed during Black Friday. Products and users work fine. Design the transition architecture.
>
> **Answer**: Strangler Fig: place Azure API Management in front of the monolith. Extract only the Cart Service (Azure Functions Premium or Container Apps because it is event-driven and irregular). The monolith continues serving products and users. API Management routes /cart/* to Cart Service, the rest to the monolith. Use Service Bus for communication between Cart Service and monolith for completed orders.
`,

  quiz: [
    {
      question: 'What is the Strangler Fig pattern and when is it applicable?',
      options: [
        'A pattern for eliminating unnecessary microservices in an architecture',
        'A strategy for gradual migration from monolith to microservices, incrementally extracting functionality without a big bang rewrite',
        'A retry pattern for frequently failing services',
        'A design pattern for managing circular dependencies between services'
      ],
      correct: 1,
      explanation: 'Strangler Fig (inspired by the strangler fig tree) is an incremental migration strategy: a facade (API Gateway) is placed in front of the monolith, and functionality is gradually extracted into new services. The gateway routes calls — new calls go to microservices, others stay in the monolith. Over time, the monolith "shrinks" until it is retired. It avoids the risk of a big bang rewrite.',
      reference: 'Strangler Fig section — this is the Microsoft-recommended approach for monolith modernization.'
    },
    {
      question: 'What is the difference between Choreography-based Saga and Orchestration-based Saga?',
      options: [
        'Choreography uses REST; Orchestration uses queues',
        'In Choreography, services react to events without a central coordinator; in Orchestration, a central coordinator (e.g., Durable Functions) defines the flow and manages compensations',
        'Choreography is simpler than Orchestration in all cases',
        'Orchestration requires a shared database between services'
      ],
      correct: 1,
      explanation: 'Choreography: each service publishes events and reacts to events from other services — decentralized, more decoupled, but hard to visualize the complete flow. Orchestration: a central orchestrator (Azure Durable Functions, Logic Apps) explicitly defines the flow, calls activities, and manages compensations — easier to understand and debug, but creates coupling with the orchestrator.',
      reference: 'Saga section — use Orchestration (Durable Functions) when the flow is complex and visibility is important; Choreography for simple flows and maximum decoupling.'
    },
    {
      question: 'Why must microservices not share a database?',
      options: [
        'For performance reasons — concurrent queries cause contention',
        'For isolation and autonomy needs — a shared database creates implicit coupling between services and prevents independent deployments',
        'Due to technical limitations of Azure SQL that does not support multiple services',
        'Due to database licensing issues'
      ],
      correct: 1,
      explanation: 'A shared database violates the fundamental principle of microservices: autonomy. With a shared database: (1) schema changes in one service can break others, (2) independent deployments become impossible, (3) the database becomes the coupling point. Each microservice must have its own database, able to choose the most appropriate type (SQL, NoSQL, Redis).',
      reference: 'Common Mistakes section — database per service is one of the fundamental principles of microservices.'
    }
  ],

  flashcards: [
    {
      front: 'What is CQRS and when does it justify its use?',
      back: '**CQRS** (Command Query Responsibility Segregation) = separate write model from read model.\n\n**Use when**:\n- Read and write loads are very different (e.g., 1 write : 1000 reads)\n- Read model needs to be denormalized for performance\n- Event Sourcing is adopted\n\n**Benefits**: independent scale of reads vs writes, optimized read model\n\n**Costs**: complexity (two models, synchronization), eventual consistency in reads\n\n**Do not use when**: simple CRUD, small volume, no difference between read and write.'
    },
    {
      front: 'What is the Saga pattern and how do you implement compensation?',
      back: '**Saga** = sequence of local transactions with compensations for failure cases.\n\n**Choreography** (events):\n```\nOrderCreated → PaymentProcessed → InventoryReserved\n     ↑ compensation: OrderCancelled ← PaymentRefunded\n```\n\n**Orchestration** (Durable Functions):\n```python\ntry:\n    yield call_activity("ProcessPayment")\n    yield call_activity("ReserveInventory")\nexcept Exception:\n    yield call_activity("RefundPayment")  # compensation\n    raise\n```\n\nRule: every action in the Saga must have a corresponding compensation.'
    }
  ],

  lab: {
    scenario: 'Explore Azure Durable Functions as an orchestrator for a simple Saga.',
    objective: 'Understand the orchestration pattern with Durable Functions for distributed transactions.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Function App for Durable Functions',
        instruction: 'Create a Function App configured to use Durable Functions (Python or Node.js).',
        hints: ['az functionapp create with python runtime', 'Durable Functions requires a storage account for state'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-durable-lab --location eastus

az storage account create \
  --name "durablestore\${SUFFIX}" \
  --resource-group rg-durable-lab \
  --sku Standard_LRS

az functionapp create \
  --name "durable-orchestrator-\${SUFFIX}" \
  --resource-group rg-durable-lab \
  --storage-account "durablestore\${SUFFIX}" \
  --consumption-plan-location eastus \
  --runtime python --runtime-version 3.11 \
  --functions-version 4 --os-type linux

echo "Function App created: durable-orchestrator-\${SUFFIX}"
echo "Next step: develop locally with Azure Functions Core Tools"
echo "Install: pip install azure-functions azure-durable-functions"
\`\`\``,
        verify: `\`\`\`bash
az functionapp show --name "durable-orchestrator-\${SUFFIX}" --resource-group rg-durable-lab \
  --query "{Name:name,State:state,Runtime:siteConfig.linuxFxVersion}" -o table
# Expected: Running, python
\`\`\``
      },
      {
        title: 'Structure of a Saga with Durable Functions',
        instruction: 'Understand the file structure to implement an order Saga with Durable Functions.',
        hints: ['Orchestrator = coordinator; Activity = unit of work'],
        solution: `\`\`\`bash
# Durable Functions project structure for Order Saga
cat << 'EOF'
project/
├── HttpStart/          # HTTP trigger that starts the orchestration
│   └── __init__.py    # Receives request, starts orchestration, returns status URL
├── OrderSaga/          # Orchestrator function
│   └── __init__.py    # Defines the flow: payment → inventory → shipping
├── ProcessPayment/     # Activity function
│   └── __init__.py    # Calls payment service
├── ReserveInventory/   # Activity function
│   └── __init__.py    # Reserves items in inventory
├── RefundPayment/      # Compensation Activity
│   └── __init__.py    # Compensates payment in case of failure
└── host.json
EOF

# Example of the Orchestrator (OrderSaga/__init__.py):
cat << 'PYEOF'
import azure.durable_functions as df

def orchestrator_function(context: df.DurableOrchestrationContext):
    order = context.get_input()

    # 1. Process payment
    try:
        payment = yield context.call_activity('ProcessPayment', order)
    except Exception as e:
        return {"status": "failed", "reason": "payment_failed"}

    # 2. Reserve inventory (with compensation)
    try:
        inventory = yield context.call_activity('ReserveInventory', order)
    except Exception:
        # Compensation: refund payment
        yield context.call_activity('RefundPayment', payment)
        return {"status": "failed", "reason": "inventory_failed"}

    return {"status": "completed", "orderId": order["id"]}

main = df.Orchestrator.create(orchestrator_function)
PYEOF
\`\`\``,
        verify: `\`\`\`bash
echo "Saga structure with Durable Functions explained."
echo "For full deploy: az functionapp deployment source config-zip"
echo "For local testing: func start (with Azure Functions Core Tools)"

# Cleanup
az group delete --name rg-durable-lab --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Microservices with high latency due to excessive "chattiness"',
      difficulty: 'hard',
      symptom: 'A user request that used to take 50ms in the monolith now takes 800ms after extraction to microservices, even without logic changes.',
      diagnosis: `\`\`\`bash
# Check traces in Application Insights
# Search for requests with high duration
requests
| where duration > 500
| extend dependencies = customDimensions.dependencies
| project url, duration, dependencies

# View number of inter-service calls
dependencies
| where timestamp > ago(1h)
| summarize callCount = count(), avgDuration = avg(duration) by target
| order by callCount desc
\`\`\``,
      solution: `**Cause**: Chatty microservices — one request makes 15+ synchronous HTTP calls between services.

**Solutions**:

1. **Aggregation (BFF pattern)**: create a Backend for Frontend that aggregates calls:
\`\`\`
Before: Client → AuthService (50ms) → UserService (50ms) → OrderService (50ms) × 3 = 150ms+
After: Client → BFF Service (makes the 3 calls in parallel internally, 60ms total)
\`\`\`

2. **Parallel calls**: use fan-out pattern (Durable Functions Task.all or asyncio.gather):
\`\`\`python
tasks = [call_activity("GetUser", id), call_activity("GetOrders", id)]
user, orders = await asyncio.gather(*tasks)
\`\`\`

3. **Rethink service boundaries**: if two services call each other frequently, they probably should be a single service.

4. **Caching**: add Redis Cache for rarely mutated data (user profile, catalog).`
    }
  ]
};
