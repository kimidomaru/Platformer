window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-infrastructure/application-architecture'] = {
  theory: `# Design de Arquitetura de Aplicações (AZ-305)

## Relevância no Exame
> Peso estimado **15-20%** no AZ-305. O exame avalia a capacidade de escolher entre monólitos, microserviços, serverless e event-driven para requisitos específicos.

## Estilos de Arquitetura

### Quando usar cada estilo

| Estilo | Quando escolher | Quando evitar |
|--------|----------------|--------------|
| **Monolito** | MVP, time pequeno, domínio simples | Escala independente necessária |
| **Microserviços** | Escala independente, múltiplos times, deploys independentes | Time pequeno, domínio novo |
| **Event-Driven** | Desacoplamento, processamento assíncrono | Consistência imediata necessária |
| **Serverless** | Workloads irregulares, event-triggered | Longa duração, state complexo |
| **N-Tier** | Separação clara de apresentação/negócio/dados | Alta escala de componentes específicos |

## Padrão: CQRS + Event Sourcing

\`\`\`
CQRS (Command Query Responsibility Segregation):

  Commands (escrita):                Queries (leitura):
  POST /orders → Command Handler     GET /orders → Read Model (otimizado)
       ↓                                  ↑
  Domain Logic + Validation          Projeção desnormalizada
       ↓                                  ↑
  Write DB (normalizado)         Event Handler (atualiza read model)
       ↓                                  ↑
  Publish OrderCreated Event ────────────┘
\`\`\`

### Event Sourcing
\`\`\`
Ao invés de salvar estado atual, salva todos os eventos:

  State atual: { status: "shipped", address: "Rua A" }

  Event Store (imutável):
  1. OrderCreated   { items: [...], address: "Rua A" }
  2. PaymentApproved { amount: 150.00 }
  3. OrderShipped   { trackingCode: "BR123" }

  Benefícios: auditoria completa, replay de eventos, time-travel debugging
  Custo: complexidade, eventual consistency
\`\`\`

## Padrão: Strangler Fig (Migração Gradual)

Para migrar monólito para microserviços sem big bang:

\`\`\`
Fase 1: Monólito intacto + facade (API Gateway na frente)
  Client → API Gateway → Monolito

Fase 2: Extrair serviços gradualmente
  Client → API Gateway → Monolito (80% das funcionalidades)
                       ↘ Auth Service (extraído)
                       ↘ Payment Service (extraído)

Fase 3: Monólito residual ou aposentadoria
\`\`\`

## Padrão: Saga para Transações Distribuídas

Microserviços não têm transações distribuídas — usam Sagas:

\`\`\`
Choreography-based Saga (Event-driven):
  OrderService → OrderCreated event
  PaymentService → ouve → PaymentProcessed event
  InventoryService → ouve → InventoryReserved event
  ShippingService → ouve → ShipmentCreated event

  Compensação se falhar:
  InventoryService → InventoryReleaseFailed → PaymentRefunded → OrderCancelled

Orchestration-based Saga (Azure Durable Functions):
  OrchestrationFunction:
    1. CallActivity(ProcessPayment)
    2. CallActivity(ReserveInventory) - se falhar, compensar
    3. CallActivity(CreateShipment)
    4. Compensações automáticas se houver exceção
\`\`\`

## Padrão: Backend for Frontend (BFF)

\`\`\`
Mobile App    Web App     Partner API
     ↓            ↓            ↓
Mobile BFF    Web BFF    Partner BFF
     ↓            ↓            ↓
         Core Microservices
\`\`\`

Cada BFF é otimizado para o cliente que serve — evita over-fetching/under-fetching.

## Azure-specific: Durable Functions para Workflows

\`\`\`python
# Orchestration Function (Python)
import azure.durable_functions as df

def orchestrator_function(context: df.DurableOrchestrationContext):
    # 1. Processar pagamento
    payment_result = yield context.call_activity('ProcessPayment', {
        'amount': context.get_input()['amount']
    })

    if not payment_result['success']:
        raise Exception("Payment failed")

    # 2. Reservar estoque (parallel fan-out)
    tasks = [
        context.call_activity('ReserveItem', item)
        for item in context.get_input()['items']
    ]
    results = yield context.task_all(tasks)

    # 3. Criar envio
    yield context.call_activity('CreateShipment', {
        'items': results,
        'address': context.get_input()['address']
    })

    return "Order completed"
\`\`\`

## Erros Comuns de Design

1. **Microserviços prematuros**: não use microserviços antes de entender o domínio — distributed monolith é pior que monolito.
2. **Chatty microservices**: microserviços que se chamam 10x por request introduzem latência e coupling. Agrupar em um único serviço se necessário.
3. **Shared database entre microserviços**: viola o princípio de autonomia — cada serviço deve ter seu próprio banco.
4. **Saga sem compensação**: transações distribuídas sem lógica de compensação deixam dados inconsistentes.
5. **CQRS onde não é necessário**: CQRS aumenta complexidade — só use quando há diferença real entre cargas de leitura e escrita.

## Killer.sh Style Challenge

> Uma empresa tem um monólito de e-commerce com 2M de usuários. O módulo de carrinho de compras é o gargalo — escala independente necessária durante Black Friday. Produtos e usuarios funcionam bem. Projete a arquitetura de transição.
>
> **Resposta**: Strangler Fig: colocar Azure API Management na frente do monólito. Extrair apenas o Cart Service (Azure Functions Premium ou Container Apps por ser event-driven e irregular). Monólito continua servindo produtos e usuários. API Management roteia /cart/* para Cart Service, resto para monólito. Usar Service Bus para comunicação entre Cart Service e monólito para pedidos finalizados.
`,

  quiz: [
    {
      question: 'O que é o padrão Strangler Fig e quando ele é aplicável?',
      options: [
        'Um padrão para eliminar microserviços desnecessários em uma arquitetura',
        'Uma estratégia de migração gradual de monólito para microserviços, extraindo funcionalidades incrementalmente sem um big bang rewrite',
        'Um padrão de retry para serviços que falham frequentemente',
        'Um design pattern para gerenciar dependências circulares entre serviços'
      ],
      correct: 1,
      explanation: 'Strangler Fig (inspirado na figueira estranguladora) é uma estratégia de migração incremental: um facade (API Gateway) é colocado na frente do monólito, e funcionalidades são gradualmente extraídas para novos serviços. O gateway roteia chamadas — novas chamadas vão para os microserviços, outras continuam no monólito. Com o tempo, o monólito "encolhe" até ser aposentado. Evita o risco de um big bang rewrite.',
      reference: 'Seção Strangler Fig — é a abordagem recomendada pela Microsoft para modernização de monólitos.'
    },
    {
      question: 'Qual é a diferença entre Choreography-based Saga e Orchestration-based Saga?',
      options: [
        'Choreography usa REST; Orchestration usa filas',
        'Em Choreography, serviços reagem a eventos sem coordenador central; em Orchestration, um coordenador central (ex: Durable Functions) define o fluxo e gerencia compensações',
        'Choreography é mais simples que Orchestration em todos os casos',
        'Orchestration requer um banco de dados compartilhado entre serviços'
      ],
      correct: 1,
      explanation: 'Choreography: cada serviço publica eventos e reage a eventos de outros serviços — descentralizado, mais desacoplado, mas difícil de visualizar o fluxo completo. Orchestration: um orquestrador central (Azure Durable Functions, Logic Apps) define explicitamente o fluxo, chama atividades e gerencia compensações — mais fácil de entender e debugar, mas cria acoplamento com o orquestrador.',
      reference: 'Seção Saga — use Orchestration (Durable Functions) quando o fluxo é complexo e visibilidade é importante; Choreography para fluxos simples e máxima desacoplamento.'
    },
    {
      question: 'Por que microserviços não devem compartilhar um banco de dados?',
      options: [
        'Por motivos de performance — queries concorrentes causam contention',
        'Por necessidade de isolamento e autonomia — banco compartilhado cria coupling implícito entre serviços e impede deploys independentes',
        'Por limitações técnicas do SQL Azure que não suporta múltiplos serviços',
        'Por questões de licenciamento de banco de dados'
      ],
      correct: 1,
      explanation: 'Banco de dados compartilhado viola o princípio fundamental de microserviços: autonomia. Com banco compartilhado: (1) mudanças de schema em um serviço podem quebrar outros, (2) deploys independentes tornam-se impossíveis, (3) o banco se torna o ponto de acoplamento. Cada microserviço deve ter seu próprio banco, podendo escolher o tipo mais adequado (SQL, NoSQL, Redis).',
      reference: 'Seção Erros Comuns — database per service é um dos princípios fundamentais de microserviços.'
    }
  ],

  flashcards: [
    {
      front: 'O que é CQRS e quando justifica usar?',
      back: '**CQRS** (Command Query Responsibility Segregation) = separar modelo de escrita de modelo de leitura.\n\n**Use quando**:\n- Cargas de leitura e escrita muito diferentes (ex: 1 escrita : 1000 leituras)\n- Read model precisa ser desnormalizado para performance\n- Event Sourcing é adotado\n\n**Benefícios**: escala independente de reads vs writes, modelo de leitura otimizado\n\n**Custos**: complexidade (dois modelos, sincronização), eventual consistency nas leituras\n\n**Não use quando**: CRUD simples, pequeno volume, sem diferença entre leitura e escrita.'
    },
    {
      front: 'O que é o padrão Saga e como implementar compensação?',
      back: '**Saga** = sequência de transações locais com compensações para casos de falha.\n\n**Choreography** (eventos):\n```\nOrderCreated → PaymentProcessed → InventoryReserved\n     ↑ compensação: OrderCancelled ← PaymentRefunded\n```\n\n**Orchestration** (Durable Functions):\n```python\ntry:\n    yield call_activity("ProcessPayment")\n    yield call_activity("ReserveInventory")\nexcept Exception:\n    yield call_activity("RefundPayment")  # compensação\n    raise\n```\n\nRegra: toda ação na Saga deve ter uma compensação correspondente.'
    }
  ],

  lab: {
    scenario: 'Explorar Azure Durable Functions como orquestrador de uma Saga simples.',
    objective: 'Entender o padrão de orquestração com Durable Functions para transações distribuídas.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Function App para Durable Functions',
        instruction: 'Crie uma Function App configurada para usar Durable Functions (Python ou Node.js).',
        hints: ['az functionapp create com runtime python', 'Durable Functions requer storage account para state'],
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

echo "Function App criada: durable-orchestrator-\${SUFFIX}"
echo "Próximo passo: desenvolver localmente com Azure Functions Core Tools"
echo "Instalar: pip install azure-functions azure-durable-functions"
\`\`\``,
        verify: `\`\`\`bash
az functionapp show --name "durable-orchestrator-\${SUFFIX}" --resource-group rg-durable-lab \
  --query "{Name:name,State:state,Runtime:siteConfig.linuxFxVersion}" -o table
# Esperado: Running, python
\`\`\``
      },
      {
        title: 'Estrutura de uma Saga com Durable Functions',
        instruction: 'Entenda a estrutura de arquivos para implementar uma Saga de pedido com Durable Functions.',
        hints: ['Orchestrator = coordenador; Activity = unidade de trabalho'],
        solution: `\`\`\`bash
# Estrutura de projeto Durable Functions para Order Saga
cat << 'EOF'
project/
├── HttpStart/          # HTTP trigger que inicia a orchestration
│   └── __init__.py    # Recebe request, inicia orchestration, retorna status URL
├── OrderSaga/          # Orchestrator function
│   └── __init__.py    # Define o fluxo: payment → inventory → shipping
├── ProcessPayment/     # Activity function
│   └── __init__.py    # Chama serviço de pagamento
├── ReserveInventory/   # Activity function
│   └── __init__.py    # Reserva itens no estoque
├── RefundPayment/      # Compensation Activity
│   └── __init__.py    # Compensa pagamento em caso de falha
└── host.json
EOF

# Exemplo do Orchestrator (OrderSaga/__init__.py):
cat << 'PYEOF'
import azure.durable_functions as df

def orchestrator_function(context: df.DurableOrchestrationContext):
    order = context.get_input()

    # 1. Processar pagamento
    try:
        payment = yield context.call_activity('ProcessPayment', order)
    except Exception as e:
        return {"status": "failed", "reason": "payment_failed"}

    # 2. Reservar estoque (com compensação)
    try:
        inventory = yield context.call_activity('ReserveInventory', order)
    except Exception:
        # Compensação: estornar pagamento
        yield context.call_activity('RefundPayment', payment)
        return {"status": "failed", "reason": "inventory_failed"}

    return {"status": "completed", "orderId": order["id"]}

main = df.Orchestrator.create(orchestrator_function)
PYEOF
\`\`\``,
        verify: `\`\`\`bash
echo "Estrutura de Saga com Durable Functions explicada."
echo "Para deploy completo: az functionapp deployment source config-zip"
echo "Para teste local: func start (com Azure Functions Core Tools)"

# Limpeza
az group delete --name rg-durable-lab --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Microserviços com alta latência por "chattiness" excessiva',
      difficulty: 'hard',
      symptom: 'Uma requisição de usuário que antes demorava 50ms no monólito agora demora 800ms após extração para microserviços, mesmo sem mudanças de lógica.',
      diagnosis: `\`\`\`bash
# Verificar traces no Application Insights
# Buscar por requests com alta duração
requests
| where duration > 500
| extend dependencies = customDimensions.dependencies
| project url, duration, dependencies

# Ver número de chamadas entre serviços
dependencies
| where timestamp > ago(1h)
| summarize callCount = count(), avgDuration = avg(duration) by target
| order by callCount desc
\`\`\``,
      solution: `**Causa**: Chatty microservices — um request faz 15+ chamadas HTTP síncronas entre serviços.

**Soluções**:

1. **Agregação (BFF pattern)**: criar um Backend for Frontend que agrega chamadas:
\`\`\`
Antes: Client → AuthService (50ms) → UserService (50ms) → OrderService (50ms) × 3 = 150ms+
Depois: Client → BFF Service (que faz as 3 chamadas em paralelo internamente, 60ms total)
\`\`\`

2. **Parallel calls**: usar fan-out pattern (Durable Functions Task.all ou asyncio.gather):
\`\`\`python
tasks = [call_activity("GetUser", id), call_activity("GetOrders", id)]
user, orders = await asyncio.gather(*tasks)
\`\`\`

3. **Rethink service boundaries**: se dois serviços se chamam frequentemente, provavelmente deveriam ser um único serviço.

4. **Caching**: adicionar Redis Cache para dados raramente mutáveis (perfil do usuário, catálogo).`
    }
  ]
};
