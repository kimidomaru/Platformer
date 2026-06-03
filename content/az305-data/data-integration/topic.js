window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-data/data-integration'] = {
  theory: `# Design de Integração de Dados & Analytics (AZ-305)

## Relevância no Exame
> Peso estimado **10-15%** no AZ-305. Questões sobre pipelines de dados, streaming e escolha entre serviços de analytics aparecem em cenários de design.

## Serviços de Integração de Dados

### Azure Data Factory (ADF)
ETL/ELT gerenciado — orquestra movimentação e transformação de dados:
- **Pipelines**: fluxo de atividades (copy, transform, execute)
- **Datasets**: definição da fonte/destino dos dados
- **Linked Services**: conexão com sistemas externos (SQL, Blob, Salesforce, etc.)
- **Integration Runtime (IR)**: compute para execução
  - **Azure IR**: serverless, gerenciado pelo Azure
  - **Self-hosted IR**: para fontes on-premises (instala agente local)
  - **SSIS IR**: executa pacotes SSIS legados

**Quando usar ADF:**
- Pipelines ETL/ELT batch
- Movimentação de dados entre serviços (SQL → Data Lake → Synapse)
- Orquestração de fluxos de dados complexos com dependências
- Integração com fontes on-premises via Self-hosted IR

### Azure Synapse Analytics
Plataforma unificada de analytics:
- **Synapse SQL** (dedicated pools): data warehouse DWU-based
- **Synapse SQL** (serverless pools): query data lake sem provisionar
- **Synapse Spark**: processamento big data com Apache Spark
- **Synapse Pipelines**: ADF integrado dentro do Synapse
- **Synapse Link**: CDC direto do Cosmos DB ou SQL Server

### Azure Stream Analytics
Processamento de streaming em tempo real:
- Linguagem de query similar ao SQL
- Sources: Event Hub, IoT Hub, Blob Storage
- Outputs: SQL, Cosmos DB, Power BI, Event Hub, Blob
- Window functions: Tumbling, Hopping, Sliding, Session

\`\`\`sql
-- Exemplo Stream Analytics: alertas de temperatura > 70°C
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
Message broker para streaming de alto volume:
- Até milhões de eventos por segundo
- Retenção: 1-7 dias (Standard), até 90 dias (Premium)
- **Capture**: salva streams para Blob Storage/Data Lake automaticamente
- Consumer groups para leitura paralela
- Integra com Stream Analytics, Functions, Spark

### Azure Service Bus
Message broker para integração de aplicações (não analytics):
- Filas (queue): FIFO com deduplication
- Tópicos/Subscriptions: pub/sub com filtros
- Dead-letter queue: mensagens com falha
- **Diferença de Event Hub**: Service Bus é para mensagens de negócio (processar 1 vez); Event Hub é para telemetria/streaming (múltiplos consumidores)

## Matriz de Decisão

\`\`\`
Streaming em tempo real?
  ├─ SIM + analytics SQL-like → Azure Stream Analytics
  ├─ SIM + alto volume (telemetria IoT) → Event Hub
  └─ SIM + processamento complexo → Spark Streaming (Synapse/Databricks)

Batch ETL?
  ├─ Sem código, visual → Azure Data Factory
  ├─ Grande volume + Spark → Synapse Spark / Azure Databricks
  └─ SSIS legado → ADF com SSIS IR

Mensageria entre aplicações?
  ├─ Alta escala, streaming → Event Hub
  └─ FIFO, transações, dead-letter → Service Bus Queue/Topic

Analytics interativo em data lake?
  └─ Synapse Serverless SQL Pool (pay-per-query)
\`\`\`

## Padrão Lambda Architecture

\`\`\`
Dados brutos
  ├─ Batch Layer: ADF → Data Lake → Synapse Dedicated Pool
  │   (processa histórico completo, mais lento, preciso)
  └─ Speed Layer: Event Hub → Stream Analytics → Cosmos DB
      (processa últimas horas, rápido, aproximado)
         ↓
    Serving Layer: combina batch + speed para queries
\`\`\`

## Erros Comuns de Design

1. **Event Hub vs Service Bus confusão**: Event Hub = streaming/telemetria (muitos produtores, múltiplos consumidores). Service Bus = mensagens de negócio (processamento garantido uma vez, FIFO, dead-letter).
2. **Synapse Dedicated Pool sempre ligado**: Dedicated Pools cobram mesmo pausados — pausar fora do horário de uso.
3. **ADF sem Self-hosted IR para on-premises**: sem Self-hosted IR instalado, ADF não consegue acessar dados on-premises.

## Killer.sh Style Challenge (AZ-305)

> Uma empresa precisa:
> 1. Ingerir dados de 1.000 sensores IoT (10K eventos/segundo) para análise
> 2. Detectar temperaturas anômalas em tempo real (<5s de latência)
> 3. Armazenar todos os dados brutos para análise histórica
> 4. Relatórios BI diários sobre médias e tendências
>
> **Projete o pipeline de dados.**
>
> **Resposta**: IoT Hub (ingestão) → Event Hub (stream buffer) → Stream Analytics (detecção anomalia → alertas via Service Bus) + Event Hub Capture (raw data → Data Lake). ADF pipeline diário: Data Lake → Synapse Dedicated Pool. Power BI conecta ao Synapse para relatórios.
`,

  quiz: [
    {
      question: 'Qual é a principal diferença entre Azure Event Hub e Azure Service Bus?',
      options: [
        'Event Hub é para dados estruturados; Service Bus é para dados não-estruturados',
        'Event Hub é para streaming/telemetria de alto volume com múltiplos consumidores; Service Bus é para mensagens de negócio com garantia de processamento uma vez e FIFO',
        'Service Bus é mais rápido que Event Hub em todos os cenários',
        'Não há diferença técnica — são intercambiáveis'
      ],
      correct: 1,
      explanation: 'Event Hub é projetado para telemetria/logging de alto volume (milhões de eventos/seg), múltiplos consumer groups, retenção de 1-7 dias, sem dead-letter. Service Bus é para mensagens de negócio críticas: FIFO garantido, deduplication, dead-letter queue, sessões, transações. Use Event Hub para telemetria IoT; Service Bus para ordens de compra, notificações críticas.',
      reference: 'Event Hub = alto volume, telemetria, replay. Service Bus = garantia de entrega, FIFO, dead-letter. Casos de uso completamente diferentes.'
    },
    {
      question: 'Uma empresa precisa executar pacotes SSIS legados no Azure como parte de uma migração. Qual recurso do Azure Data Factory usar?',
      options: [
        'Azure Integration Runtime',
        'Self-hosted Integration Runtime',
        'SSIS Integration Runtime (Azure-SSIS IR)',
        'Managed Integration Runtime'
      ],
      correct: 2,
      explanation: 'Azure-SSIS Integration Runtime é um cluster gerenciado de nós no Azure que executa pacotes SSIS nativamente, sem precisar de SQL Server local. Permite migrar workloads SSIS legados para Azure sem reescrita. É provisionado e desligado sob demanda (paga por hora de uso).',
      reference: 'SSIS IR = lift-and-shift de pacotes SSIS para Azure. Self-hosted IR = conectar ADF a fontes on-premises (não SSIS específico).'
    },
    {
      question: 'Qual Window function do Stream Analytics usaria para contar eventos em janelas de 5 minutos sem sobreposição, onde cada evento pertence apenas a uma janela?',
      options: [
        'Sliding Window',
        'Hopping Window',
        'Tumbling Window',
        'Session Window'
      ],
      correct: 2,
      explanation: 'Tumbling Window (janela rolante) divide o tempo em janelas fixas sem sobreposição — cada evento pertence exatamente a uma janela. Hopping Window pode sobrepor (ex: resultado a cada 1 min de janelas de 5 min). Sliding Window cria janela nova para cada evento. Session Window agrupa eventos por inatividade.',
      reference: 'Tumbling = janelas sem sobreposição (0:00-5:00, 5:00-10:00). Hopping = sobreposição. Sliding = por evento. Session = por inatividade.'
    }
  ],

  flashcards: [
    {
      front: 'Quando usar Azure Data Factory vs Azure Synapse Pipelines?',
      back: '**Azure Data Factory** (standalone):\n- Orquestração de dados enterprise\n- Integração com fontes diversas (150+ conectores)\n- Quando o foco é ETL/ELT sem necessidade de analytics integrado\n\n**Azure Synapse Pipelines** (dentro do Synapse):\n- Mesma engine do ADF, mas integrado ao workspace Synapse\n- Quando já está usando Synapse para analytics\n- Acesso direto a Synapse SQL Pools e Spark\n\nFuncionalidade: idêntica. Escolha baseada no contexto do projeto.'
    },
    {
      front: 'O que é o Lambda Architecture e como implementar no Azure?',
      back: '**Lambda Architecture** — processa dados em dois caminhos:\n\n**Batch Layer** (preciso, lento):\n- ADF → Data Lake Storage Gen2 → Synapse SQL Pool\n- Processa histórico completo, resultados precisos\n\n**Speed Layer** (aproximado, rápido):\n- Event Hub → Stream Analytics → Cosmos DB/Redis\n- Processa últimas horas em tempo real\n\n**Serving Layer**:\n- Combina resultados batch + speed\n- Power BI ou API consulta ambas as camadas\n\nUse quando precisar de tempo real E histórico preciso.'
    },
    {
      front: 'Quais são os 4 tipos de Window functions no Stream Analytics?',
      back: '1. **Tumbling** — janelas fixas sem sobreposição: \`GROUP BY TumblingWindow(minute, 5)\` → 0-5, 5-10, 10-15...\n\n2. **Hopping** — janelas com sobreposição: \`HoppingWindow(minute, 10, 5)\` → resultado a cada 5min de janela de 10min\n\n3. **Sliding** — cria janela para cada evento que tem atividade: responde quando há mudança\n\n4. **Session** — agrupa por inatividade: fecha a janela quando não há eventos por X tempo'
    }
  ],

  lab: {
    scenario: 'Crie um Event Hub para simular ingestão de telemetria e configure Stream Analytics básico.',
    objective: 'Criar Event Hub namespace, hub e explorar configuração do Stream Analytics.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Event Hub Namespace e Hub',
        instruction: 'Crie um Event Hub Namespace Standard e um hub para dados de sensores IoT.',
        hints: ['\`az eventhubs namespace create\` depois \`az eventhubs eventhub create\`'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-integration-lab --location eastus

# Criar Namespace
az eventhubs namespace create \\
  --name "technova-eh-\${SUFFIX}" \\
  --resource-group rg-integration-lab \\
  --location eastus \\
  --sku Standard \\
  --capacity 1

# Criar Event Hub
az eventhubs eventhub create \\
  --name sensor-telemetry \\
  --namespace-name "technova-eh-\${SUFFIX}" \\
  --resource-group rg-integration-lab \\
  --partition-count 4 \\
  --message-retention 3

echo "SUFFIX=\${SUFFIX}" > /tmp/integlab.sh
echo "Event Hub criado: sensor-telemetry"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/integlab.sh
az eventhubs eventhub show \\
  --name sensor-telemetry \\
  --namespace-name "technova-eh-\${SUFFIX}" \\
  --resource-group rg-integration-lab \\
  --query "{Nome:name,Particoes:partitionCount,Retencao:messageRetentionInDays}" -o table
\`\`\``
      },
      {
        title: 'Configurar Consumer Group e Connection String',
        instruction: 'Crie um consumer group dedicado para o Stream Analytics e obtenha a connection string.',
        hints: ['\`az eventhubs eventhub consumer-group create\`'],
        solution: `\`\`\`bash
source /tmp/integlab.sh

# Consumer Group para Stream Analytics
az eventhubs eventhub consumer-group create \\
  --consumer-group-name stream-analytics-cg \\
  --eventhub-name sensor-telemetry \\
  --namespace-name "technova-eh-\${SUFFIX}" \\
  --resource-group rg-integration-lab

# Obter connection string (para configurar inputs)
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
# Saída: $Default e stream-analytics-cg
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-integration-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-integration-lab 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Azure Data Factory pipeline falha ao conectar fonte on-premises',
      difficulty: 'medium',
      symptom: 'Pipeline ADF que lê dados de um SQL Server on-premises falha com "Error connecting to the source: Unable to connect to the server".',
      diagnosis: `\`\`\`bash
# Verificar status do Self-hosted IR
az datafactory integration-runtime list \\
  --factory-name myADF --resource-group myRG \\
  --query "[?type=='SelfHosted'].{Nome:name,Estado:properties.state}" -o table

# No portal: ADF → Manage → Integration Runtimes → Self-hosted IR → Nodes
# Verificar se o nó está "Running" ou "Limited"
\`\`\``,
      solution: `**Checklist de diagnóstico:**

1. **Node do Self-hosted IR offline**: verificar se o serviço "Integration Runtime Service" está rodando no servidor Windows. Se não: iniciar via services.msc ou \`net start DIAHostService\`.

2. **Versão desatualizada**: atualizar o Integration Runtime para a versão mais recente (ADF → Integration Runtimes → atualizar).

3. **Firewall bloqueando saída**: o Self-hosted IR precisa de conexão HTTPS de saída (porta 443) para o Azure Service Bus e storage. Verificar regras de firewall.

4. **Credenciais do Linked Service**: verificar se o usuário/senha ou connection string do SQL Server está correto.

5. **SQL Server inacessível do servidor IR**: testar conectividade do servidor onde o IR está instalado para o SQL Server (testar via SSMS ou \`Test-NetConnection -ComputerName sqlserver -Port 1433\`).`
    }
  ]
};
