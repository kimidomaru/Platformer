window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-application/event-driven-design'] = {
  theory: `# Design de Arquitetura Event-Driven (AZ-305)

## Relevância no Exame
> Peso estimado **15-20%** no AZ-305. Event-driven architecture é cobrado em questões sobre desacoplamento de serviços, processamento assíncrono e escolha entre Event Grid, Event Hub e Service Bus.

## Conceitos Fundamentais

### Eventos vs Comandos vs Mensagens

| Tipo | Exemplo | Broker | Semântica |
|------|---------|--------|-----------|
| **Evento** | "OrderShipped" | Event Grid, Event Hub | O que aconteceu (fact) |
| **Comando** | "ProcessPayment" | Service Bus | Faça algo (intention) |
| **Mensagem** | qualquer dado | Qualquer | Container genérico |

## Azure Event Grid — Design

Event Grid = roteamento de eventos reativo (low-latency, near-real-time):

\`\`\`
Fontes:                    Event Grid              Destinos:
Azure Storage       →      Topics/System Topics  → Azure Functions
Azure Container Reg →      + Filtering           → Logic Apps
Custom Application  →      + Dead-letter          → Event Hub
Azure Service Bus   →      + Retry policy         → WebHook/HTTPS
IoT Hub             →                             → Service Bus
\`\`\`

\`\`\`bash
# Criar custom topic
az eventgrid topic create \
  --name orders-events \
  --resource-group myRG \
  --location eastus

# Criar subscription para Function
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

## Event Hub — Design para Streaming

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
# Criar Event Hub otimizado para IoT telemetry
az eventhubs namespace create \
  --name iot-hub --resource-group myRG --sku Standard

az eventhubs eventhub create \
  --name telemetry \
  --namespace-name iot-hub \
  --resource-group myRG \
  --partition-count 32 \          # mais partições = mais paralelismo
  --message-retention 7 \         # retenção em dias
  --enable-capture true \
  --capture-interval 300 \        # captura a cada 5 minutos
  --capture-destination-name "StorageAccount" \
  --storage-account /subscriptions/.../storageAccounts/telemetrystorage \
  --blob-container raw-events
\`\`\`

## Padrão: Event-Driven com Idempotência

Consumidores de eventos devem ser idempotentes:

\`\`\`python
# Azure Function com idempotência
import azure.functions as func
import json

def process_order(msg: func.ServiceBusMessage) -> None:
    order_id = msg.get_body().decode('utf-8')
    order_data = json.loads(order_id)

    # Verificar se já processado (idempotência)
    if is_already_processed(order_data['id']):
        logging.info(f"Order {order_data['id']} já processada, ignorando")
        return

    # Processar pedido
    process(order_data)

    # Marcar como processada (em Redis ou banco)
    mark_as_processed(order_data['id'])
\`\`\`

## Padrão: Event Aggregation (Janelas Temporais)

\`\`\`
Telemetria bruta (1000 eventos/segundo)
         ↓
Event Hub (buffer de streaming)
         ↓
Stream Analytics (agregação por janela)
         ↓
Alertas (se média CPU > 80% por 5min)
Cosmos DB (médias a cada minuto para dashboard)
SQL (sumários horários para relatórios)
\`\`\`

## Erros Comuns de Design

1. **Event Grid para high-throughput**: Event Grid é otimizado para baixo volume e baixa latência — use Event Hub para milhões de eventos/segundo.
2. **Sem idempotência nos consumidores**: eventos podem ser entregues mais de uma vez (at-least-once) — consumidores devem lidar com duplicatas.
3. **Sem dead-letter queue**: eventos que falham são perdidos sem DLQ configurada.
4. **Event Hub com poucas partições**: poucas partições limitam o paralelismo. Cada consumidor paralelo precisa de uma partição própria.
5. **Consumidor sem checkpoint**: sem checkpoint, reinício do consumidor reprocessa todos os eventos desde o início.

## Killer.sh Style Challenge (AZ-305)

> Sistema de IoT com 50.000 sensores enviando leituras a cada segundo. Requisitos: detecção de anomalias em < 5 segundos, armazenar dados brutos por 1 ano para análise histórica, notificar operadores em caso de temperatura > 80°C em qualquer sensor.
>
> **Resposta**: Event Hub (50K eventos/segundo, 32 partitions). Stream Analytics com Tumbling Window de 5 segundos para detectar anomalias (temp > 80°C). Alertas via Event Grid → Logic App → email/Teams. Event Hub Capture → Data Lake para histórico. Databricks para análise histórica ad-hoc.
`,

  quiz: [
    {
      question: 'Por que consumidores de eventos em arquitetura event-driven devem ser idempotentes?',
      options: [
        'Para melhorar a performance do processamento',
        'Porque brokers como Event Hub e Service Bus usam semântica at-least-once — o mesmo evento pode ser entregue mais de uma vez em casos de retry ou falha',
        'Para permitir processamento paralelo sem locks',
        'Por requisitos de compliance de auditoria'
      ],
      correct: 1,
      explanation: 'Event brokers usam at-least-once delivery: garantem que o evento seja entregue pelo menos uma vez, mas podem entregar duplicatas em casos de falha do consumidor ou timeout de ack. Se o consumidor não for idempotente, duplicatas causam efeitos colaterais (ex: cobrar o mesmo pagamento duas vezes). A solução é verificar se o evento já foi processado usando um ID único do evento (event ID ou business key).',
      reference: 'Seção Idempotência — sempre design consumidores para lidar com duplicatas no Azure Event Hub e Service Bus.'
    },
    {
      question: 'Qual serviço Azure usar para processar streaming de IoT com 500.000 eventos/segundo com agregação em janelas de tempo?',
      options: [
        'Azure Event Grid com Azure Functions',
        'Azure Service Bus com múltiplos consumidores',
        'Azure Event Hub + Azure Stream Analytics',
        'Azure Storage Queue com Azure Batch'
      ],
      correct: 2,
      explanation: 'Event Hub é o único serviço Azure capaz de receber 500K eventos/segundo de forma confiável (escala para milhões). Stream Analytics é integrado nativamente ao Event Hub e fornece SQL-like query language com window functions para agregação em tempo real (TumblingWindow, HoppingWindow). Juntos formam o padrão canônico para IoT e telemetria no Azure.',
      reference: 'Seção Event Hub Design — high-throughput streaming = Event Hub. Agregação em tempo real = Stream Analytics. Event Grid para eventos de baixo volume.'
    },
    {
      question: 'O que é o Event Hub Capture e para que serve?',
      options: [
        'Mecanismo de dead-letter queue do Event Hub',
        'Funcionalidade que salva automaticamente o stream de eventos para Azure Blob Storage ou Data Lake em formato Avro',
        'Um serviço para capturar eventos de Azure Functions e armazenar no Event Hub',
        'Um filtro que captura apenas eventos que correspondem a um padrão'
      ],
      correct: 1,
      explanation: 'Event Hub Capture persiste automaticamente o stream de eventos em Azure Blob Storage ou Azure Data Lake Storage no formato Apache Avro, em intervalos configuráveis (ex: a cada 5 minutos ou a cada 500MB). Isso permite processar eventos em tempo real via Stream Analytics enquanto também armazena os dados brutos para análise histórica via Databricks, Synapse ou consultas ad-hoc — sem código adicional.',
      reference: 'Seção Event Hub Design — Capture = persistência automática para Data Lake. Configure capture + Stream Analytics para lambda architecture.'
    }
  ],

  flashcards: [
    {
      front: 'Event Grid vs Event Hub vs Service Bus — como escolher?',
      back: '**Azure Event Grid** (rotor reativo):\n- Volume: baixo a médio\n- Latência: < 1 segundo\n- Modelo: push para subscribers\n- Uso: reações a eventos de recursos Azure, webhooks\n\n**Azure Event Hub** (streaming platform):\n- Volume: milhões/segundo\n- Retenção: 1-90 dias\n- Modelo: pull com consumer groups\n- Uso: IoT, telemetria, logs, analytics\n\n**Azure Service Bus** (message broker):\n- Volume: moderado\n- Garantias: FIFO, dead-letter, transações\n- Modelo: push/pull\n- Uso: comandos de negócio, workflows críticos'
    },
    {
      front: 'O que é at-least-once delivery e como implementar idempotência?',
      back: '**At-least-once delivery**: o broker garante que a mensagem chegará ao consumidor pelo menos 1 vez — mas pode chegar 2+ vezes em caso de retry.\n\n**Implementar idempotência**:\n1. Cada evento tem um ID único (UUID)\n2. Consumidor verifica: "já processei este ID?"\n3. Se sim: ignorar (log e ack)\n4. Se não: processar + registrar ID\n\n**Armazenar IDs processados**:\n- Redis com TTL (rápido, temporário)\n- Banco de dados (persistente, auditável)\n- Cosmos DB com TTL (escalável)\n\n**Campo de deduplicação**: Event Hub → SequenceNumber; Service Bus → MessageId'
    }
  ],

  lab: {
    scenario: 'Criar um Event Hub e configurar Event Hub Capture para armazenar eventos em Data Lake.',
    objective: 'Implementar o padrão de streaming + persistence usando Event Hub com Capture.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Event Hub com Capture habilitado',
        instruction: 'Crie um Event Hub com 4 partições e Capture para Data Lake.',
        hints: ['az eventhubs eventhub create --enable-capture true', '--capture-destination-name StorageAccount'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-eventdriven-lab --location eastus

# Storage para Capture
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

# Event Hub com Capture
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
# Esperado: telemetry, 4 partitions, Capture=true
\`\`\``
      },
      {
        title: 'Explorar consumer groups e connection string',
        instruction: 'Crie um consumer group dedicado para Stream Analytics e obtenha a connection string.',
        hints: ['Consumer groups permitem múltiplos consumidores independentes', 'Cada consumer group mantém seu próprio offset'],
        solution: `\`\`\`bash
source /tmp/eventlab.sh

# Consumer group para Stream Analytics
az eventhubs eventhub consumer-group create \
  --consumer-group-name stream-analytics \
  --eventhub-name telemetry \
  --namespace-name "iot-hub-\${SUFFIX}" \
  --resource-group rg-eventdriven-lab

# Consumer group para Databricks
az eventhubs eventhub consumer-group create \
  --consumer-group-name databricks-analytics \
  --eventhub-name telemetry \
  --namespace-name "iot-hub-\${SUFFIX}" \
  --resource-group rg-eventdriven-lab

# Connection string para envio de eventos
az eventhubs namespace authorization-rule keys list \
  --namespace-name "iot-hub-\${SUFFIX}" \
  --resource-group rg-eventdriven-lab \
  --name RootManageSharedAccessKey \
  --query "primaryConnectionString" -o tsv

echo "Consumer groups criados - cada um mantém cursor independente"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/eventlab.sh
az eventhubs eventhub consumer-group list \
  --eventhub-name telemetry \
  --namespace-name "iot-hub-\${SUFFIX}" \
  --resource-group rg-eventdriven-lab \
  --query "[].name" -o tsv
# Esperado: \$Default, stream-analytics, databricks-analytics

az group delete --name rg-eventdriven-lab --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Consumer lendo eventos duplicados após reinício',
      difficulty: 'hard',
      symptom: 'Após reiniciar um consumer de Event Hub, ele começa a reprocessar eventos antigos que já foram processados anteriormente, causando ações duplicadas no sistema.',
      diagnosis: `\`\`\`bash
# Verificar se o consumer está persistindo checkpoints
# (Azure Event Processor Host deve salvar offsets no Azure Storage)

# Verificar consumer group e posição atual
az eventhubs eventhub consumer-group show \
  --consumer-group-name my-consumer \
  --eventhub-name my-hub \
  --namespace-name my-namespace \
  --resource-group myRG
\`\`\``,
      solution: `**Causa**: o consumer não está persistindo checkpoints, então ao reiniciar começa do início (ou da posição mais antiga da retenção).

**Solução com Azure Event Processor Host (Python)**:
\`\`\`python
from azure.eventhub import EventHubConsumerClient
from azure.eventhub.extensions.checkpointstoreblob import BlobCheckpointStore

# Checkpoint store no Azure Blob Storage
checkpoint_store = BlobCheckpointStore.from_connection_string(
    STORAGE_CONNECTION_STRING,
    container_name="checkpoints"  # container para salvar offsets
)

client = EventHubConsumerClient.from_connection_string(
    EVENT_HUB_CONNECTION_STRING,
    consumer_group="my-consumer",
    eventhub_name="telemetry",
    checkpoint_store=checkpoint_store  # persiste offset após processamento
)

def on_event(partition_context, event):
    process_event(event)
    # Checkpoint APÓS processamento com sucesso
    partition_context.update_checkpoint(event)

client.receive(on_event=on_event)
\`\`\`

Após implementar checkpointing, reinícios continuam do último checkpoint salvo.`
    }
  ]
};
