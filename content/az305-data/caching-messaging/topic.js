window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-data/caching-messaging'] = {
  theory: `# Design de Caching & Messaging (AZ-305)

## Relevância no Exame
> Peso estimado **10-15%** no AZ-305. Questões sobre escolha entre Redis, Service Bus, Event Grid e Event Hub aparecem em cenários de design de arquitetura.

## Azure Cache for Redis — Design

### Quando usar Redis

| Caso de Uso | Por quê Redis |
|------------|--------------|
| Cache de sessão de usuário | Acesso em memória <1ms vs banco de dados |
| Cache de resultados de queries | Evita consultas repetidas ao banco |
| Leaderboards e rankings | Sorted Sets do Redis |
| Rate limiting | Atomic INCR + EXPIRE |
| Pub/Sub simples | Channels nativos do Redis |
| Distributed locks | SETNX (SET if Not eXists) |

### Tiers do Azure Cache for Redis

| Tier | Características | Caso de Uso |
|------|----------------|------------|
| **Basic** | Nó único, sem SLA, sem replicação | Dev/test |
| **Standard** | Replicação primário-réplica, SLA 99.9% | Produção geral |
| **Premium** | Clustering, geo-replication, VNet, persistence | Alta disponibilidade |
| **Enterprise** | Redis Enterprise, Modules (Search, JSON) | Máxima performance |
| **Enterprise Flash** | Parte em NVMe SSD, custo menor | Grandes datasets |

\`\`\`bash
# Criar Redis Cache Standard (produção)
az redis create \
  --name my-redis \
  --resource-group myRG \
  --location eastus \
  --sku Standard \
  --vm-size c1            # c0=250MB, c1=1GB, c2=2.5GB...

# Premium com clustering (3 shards)
az redis create \
  --name my-redis-premium \
  --resource-group myRG \
  --sku Premium \
  --vm-size p1 \
  --shard-count 3

# Obter connection string
az redis list-keys --name my-redis --resource-group myRG
\`\`\`

### Padrões de Cache

\`\`\`
Cache-Aside (Lazy Loading):         Read-Through:
  App → Redis → HIT → return         App → Cache Layer → DB (automático)
  App → Redis → MISS → DB → update    Cache busca do DB automaticamente

Write-Through:                      Write-Behind (async):
  App → Cache → DB (síncrono)         App → Cache → retorna
                                       Cache → DB (assíncrono, eventual)
\`\`\`

## Padrão de Decisão de Messaging

\`\`\`
Evento ou Comando?
  ├─ EVENTO (algo aconteceu, múltiplos consumidores)
  │    ├─ Alta volume, streaming → Event Hub
  │    └─ Baixo volume, pub/sub → Event Grid
  └─ COMANDO (faça algo, processamento garantido)
       ├─ FIFO, dead-letter, sessões → Service Bus Queue/Topic
       └─ Simples, altíssimo volume → Storage Queue
\`\`\`

## Azure Service Bus — Design

### Queue vs Topic/Subscription

\`\`\`
Queue (1 produtor → 1 consumidor):         Topic (1 produtor → N consumidores):
  Producer → Queue → Consumer 1              Publisher → Topic → Sub A → Consumer A
                                                               ↘ Sub B → Consumer B
                                                               ↘ Sub C → Consumer C
\`\`\`

\`\`\`bash
# Criar namespace e queue com dead-letter
az servicebus namespace create \
  --name mybus --resource-group myRG --sku Standard

az servicebus queue create \
  --namespace-name mybus --resource-group myRG \
  --name orders \
  --max-delivery-count 3 \            # tentativas antes de dead-letter
  --default-message-time-to-live P7D  # mensagens expiram em 7 dias

# Criar topic com filtros
az servicebus topic create \
  --namespace-name mybus --resource-group myRG \
  --name events

# Subscription com filtro SQL
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
| Tamanho máx mensagem | 256KB (Standard), 100MB (Premium) | 64KB |
| Dead-letter queue | Nativa | Não tem |
| FIFO garantido | Sim (sessions) | Não |
| Transações | Sim | Não |
| Duplicate detection | Sim | Não |
| Max retention | 14 dias | 7 dias |
| Throughput | Moderado | Altíssimo |

## Azure Event Grid — Design

Event Grid = roteamento de eventos serverless (baixo volume, reativo):

\`\`\`bash
# Criar tópico customizado
az eventgrid topic create \
  --name my-topic --resource-group myRG --location eastus

# Criar subscription para Azure Function
az eventgrid event-subscription create \
  --name my-subscription \
  --source-resource-id /subscriptions/.../topics/my-topic \
  --endpoint /subscriptions/.../functions/my-function \
  --endpoint-type azurefunction \
  --included-event-types Microsoft.Storage.BlobCreated
\`\`\`

**Fontes nativas do Event Grid**: Storage Account, Event Hub, Service Bus, IoT Hub, Resource Groups, Azure AD, Container Registry.

## Padrão: Outbox Pattern

Para garantia de entrega entre banco de dados e mensageria:

\`\`\`
1. Transação do banco:
   INSERT INTO orders (data) VALUES (...)
   INSERT INTO outbox (event, payload) VALUES ('OrderCreated', {...})
   COMMIT

2. Outbox processor (background):
   SELECT * FROM outbox WHERE sent = false
   → Publicar no Service Bus
   → UPDATE outbox SET sent = true

3. Evita: publicar mensagem ANTES do banco commitar (perda de evento)
         publicar mensagem MAS banco falhar (evento fantasma)
\`\`\`

## Erros Comuns de Design

1. **Redis Basic em produção**: sem replicação e sem SLA — qualquer falha derruba o cache e propaga para o banco.
2. **Event Grid para alta vazão**: Event Grid é otimizado para baixo volume de eventos por segundo — use Event Hub para streaming.
3. **Storage Queue para FIFO crítico**: Storage Queue não garante FIFO — use Service Bus com Sessions para pedidos.
4. **Sem dead-letter monitoring**: mensagens no dead-letter queue indicam bugs na aplicação — monitore e alerte.
5. **TTL muito alto no Redis**: dados obsoletos servidos para usuários. Defina TTL adequado ao perfil de mudança dos dados.

## Killer.sh Style Challenge (AZ-305)

> Uma plataforma de e-commerce precisa:
> 1. Cache de catálogo de produtos (100k produtos, atualiza 1x/hora, acesso de 10k req/s)
> 2. Processamento de pedidos com FIFO, retry automático e dead-letter queue
> 3. Notificar N microserviços quando um pedido é criado (cada um faz ação diferente)
> 4. Ingestão de eventos de clickstream (100k eventos/min)
>
> **Resposta**: (1) Redis Standard (cache-aside, TTL 1h). (2) Service Bus Queue Premium com sessions + max-delivery-count=3. (3) Service Bus Topic com N subscriptions por microserviço. (4) Event Hub Standard com 10+ partitions.
`,

  quiz: [
    {
      question: 'Quando usar Azure Service Bus em vez de Azure Event Hub para messaging?',
      options: [
        'Service Bus é sempre mais barato que Event Hub',
        'Service Bus para comandos críticos com FIFO, dead-letter e transações; Event Hub para streaming de alto volume de eventos',
        'Event Hub suporta mais consumidores simultâneos que Service Bus',
        'Service Bus tem melhor integração com Azure Functions'
      ],
      correct: 1,
      explanation: 'Service Bus é um message broker empresarial: garantias de FIFO (com sessions), dead-letter queue, detecção de duplicatas, transações e retry automático. Ideal para comandos de negócio (pedidos, pagamentos). Event Hub é um streaming platform de alto throughput: processa milhões de eventos/segundo, múltiplos consumer groups, retenção de 7-90 dias, sem dead-letter. Ideal para telemetria, logs, clickstream.',
      reference: 'Matriz de decisão de Messaging — FIFO/dead-letter/transações = Service Bus; volume/streaming = Event Hub.'
    },
    {
      question: 'Qual tier do Azure Cache for Redis suporta clustering, geo-replication e persistência de dados?',
      options: [
        'Standard',
        'Basic',
        'Premium',
        'Developer'
      ],
      correct: 2,
      explanation: 'O tier Premium do Azure Cache for Redis oferece: Redis Cluster para distribuir dados entre múltiplos shards, geo-replication para réplica em outra região, Redis persistence (RDB/AOF) para durabilidade, Private Endpoint e VNet injection. O Standard oferece apenas replicação primário-réplica sem clustering. Basic não tem SLA nem replicação.',
      reference: 'Tabela de Tiers do Redis — Premium é necessário para cargas de produção críticas com necessidade de escala ou DR.'
    },
    {
      question: 'O que é o Outbox Pattern e qual problema ele resolve?',
      options: [
        'Um padrão para armazenar mensagens não entregues em uma fila especial',
        'Um padrão que garante atomicidade entre persistir dados no banco e publicar eventos no message broker usando uma tabela outbox',
        'Um design pattern para rotear mensagens entre diferentes brokers',
        'Uma estratégia de retry automático para mensagens falhas'
      ],
      correct: 1,
      explanation: 'O Outbox Pattern resolve a dualidade entre banco de dados e mensageria: ao invés de persistir no banco E publicar na fila (duas operações que podem falhar independentemente), você persiste os dados E um registro na tabela outbox em uma única transação ACID. Um processo background publica assincronamente do outbox para o broker. Isso garante que nunca há evento sem dado correspondente, nem dado sem evento.',
      reference: 'Seção Outbox Pattern — padrão fundamental em microserviços com eventual consistency.'
    }
  ],

  flashcards: [
    {
      front: 'Cache-Aside vs Read-Through vs Write-Through — quando usar cada padrão?',
      back: '**Cache-Aside (Lazy Loading)**:\n- App tenta ler do cache; se miss, busca no DB e atualiza cache\n- Uso: maioria dos casos, simples de implementar\n- Risco: cache stampede em cache miss simultâneo\n\n**Read-Through**:\n- Cache Layer busca do DB automaticamente no miss\n- Uso: quando você quer abstrair a lógica da app\n- Risco: primeira leitura sempre mais lenta\n\n**Write-Through**:\n- Toda escrita vai ao cache E ao DB sincronamente\n- Uso: quando consistência é crítica\n- Risco: latência de escrita maior\n\n**Write-Behind (Write-Back)**:\n- Escrita vai ao cache; DB é atualizado assincronamente\n- Uso: alta frequência de escrita, eventual consistency ok\n- Risco: perda de dados se cache falhar antes de persistir'
    },
    {
      front: 'Qual é a diferença entre Service Bus Queue e Service Bus Topic?',
      back: '**Queue** (ponto-a-ponto):\n- 1 produtor → 1 consumidor por mensagem\n- Múltiplos consumidores competem (competing consumers)\n- Para escalar processamento de um único tipo de tarefa\n- Ex: processamento de pedidos\n\n**Topic com Subscriptions** (pub/sub):\n- 1 produtor → N subscriptions → N consumidores\n- Cada subscription recebe uma cópia da mensagem\n- Para notificar múltiplos serviços independentes\n- Subscriptions podem ter filtros SQL\n- Ex: "OrderCreated" → email, inventory, analytics'
    }
  ],

  lab: {
    scenario: 'Criar um Service Bus com queue para processamento de pedidos e topic para notificações.',
    objective: 'Configurar Service Bus Queue com dead-letter e Topic com múltiplas subscriptions filtradas.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Service Bus Namespace e Queue',
        instruction: 'Crie um namespace Standard e uma queue de pedidos com dead-letter configurado.',
        hints: ['az servicebus namespace create --sku Standard', '--max-delivery-count 3 para dead-letter após 3 tentativas'],
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

echo "Queue 'orders' criada em $NS"
\`\`\``,
        verify: `\`\`\`bash
NS=$(az servicebus namespace list --resource-group rg-messaging-lab --query "[0].name" -o tsv)
az servicebus queue show --namespace-name $NS --resource-group rg-messaging-lab --name orders \
  --query "{Name:name,DeadLetter:properties.maxDeliveryCount,TTL:properties.defaultMessageTimeToLive}" -o table
# Esperado: orders, maxDeliveryCount=3
\`\`\``
      },
      {
        title: 'Criar Topic com Subscriptions filtradas',
        instruction: 'Crie um topic "events" com duas subscriptions: uma para eventos de alta prioridade e outra para todos.',
        hints: ['az servicebus topic create', 'az servicebus topic subscription rule create --filter-sql-expression'],
        solution: `\`\`\`bash
NS=$(az servicebus namespace list --resource-group rg-messaging-lab --query "[0].name" -o tsv)

az servicebus topic create \
  --namespace-name $NS --resource-group rg-messaging-lab --name events

# Subscription para todos os eventos
az servicebus topic subscription create \
  --namespace-name $NS --resource-group rg-messaging-lab \
  --topic-name events --name all-events

# Subscription apenas para alta prioridade
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
# Esperado: all-events e high-priority-only

az group delete --name rg-messaging-lab --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Mensagens acumulando na Dead-Letter Queue do Service Bus',
      difficulty: 'medium',
      symptom: 'O Azure Monitor mostra crescimento constante na dead-letter queue de uma Service Bus Queue. As mensagens chegam mas o processamento falha repetidamente.',
      diagnosis: `\`\`\`bash
# Verificar contagem de dead-letter
az servicebus queue show --namespace-name mybus --resource-group myRG --name orders \
  --query "properties.deadLetterMessageCount" -o tsv

# Via Service Bus Explorer no portal: ver conteúdo das mensagens na DLQ
# Namespace → Queue → Dead-letter tab → peek messages
\`\`\``,
      solution: `**Causas comuns de dead-letter:**

1. **maxDeliveryCount atingido**: aplicação lança exceção no processamento. Corrigir o bug na lógica de processamento.

2. **TTL expirado**: mensagens ficam na fila por tempo demais. Verificar se o consumer está rodando e saudável.

3. **Mensagem inválida**: payload corrompido ou schema incompatível. Adicionar validação de schema antes de processar.

**Processo de diagnóstico:**
\`\`\`bash
# 1. Verificar logs do consumer (Azure Function/App Service)
# 2. Inspecionar uma mensagem da DLQ no portal (peek sem remover)
# 3. Ver o campo DeadLetterReason e DeadLetterErrorDescription

# Reprocessar mensagens da DLQ (após corrigir o bug)
# Usar Service Bus Explorer ou código que lê da DLQ e republica na queue principal
\`\`\`

**Prevenção**: configure alerta no Azure Monitor para dead-letter count > 0 para detecção proativa.`
    }
  ]
};
