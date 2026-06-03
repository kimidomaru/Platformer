window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-resilient-arch/decoupled-arch'] = {
  theory: `# Decoupled & Event-Driven Architectures

## Relevancia no Exame
> **Design Resilient Architectures** vale **26%** do SAA-C03. SQS, SNS, EventBridge, Step Functions e Kinesis sao temas frequentes.

## Amazon SQS (Simple Queue Service)

### Standard vs FIFO

| Feature | Standard | FIFO |
|---------|----------|------|
| **Throughput** | Ilimitado | 300 msg/s (3.000 com batching) |
| **Ordenacao** | Melhor esforco | Estrita (por message group) |
| **Entrega** | At-least-once (duplicatas possiveis) | Exactly-once |
| **Nome** | Qualquer | Deve terminar em .fifo |

### Features Principais
- **Visibility Timeout**: mensagem oculta apos consumidor ler (padrao 30s, max 12h)
- **Dead-Letter Queue (DLQ)**: mensagens falhas enviadas apos maxReceiveCount excedido
- **Long Polling**: reduz respostas vazias e custo (WaitTimeSeconds 1-20s)
- **Retencao**: 1-14 dias (padrao 4 dias)
- **Tamanho maximo**: 256 KB (use Extended Client Library + S3 para maior)
- **Delay Queue**: adiar entrega 0-900 segundos

## Amazon SNS (Simple Notification Service)

Mensageria pub/sub: uma mensagem para muitos subscribers simultaneamente.

- **Topics**: Standard ou FIFO
- **Subscribers**: SQS, Lambda, HTTP/S, email, SMS, Kinesis Data Firehose
- **Fan-out**: SNS topic -> multiplas filas SQS (processamento paralelo)
- **Message Filtering**: filter policies nas subscriptions (processe apenas mensagens relevantes)

## Amazon EventBridge

Event bus serverless para arquiteturas event-driven.

- **Event Bus**: default (eventos AWS) + custom (seus eventos) + partner (SaaS)
- **Rules**: match de event patterns e roteamento para targets (150+ integracoes)
- **Scheduler**: cron e rate-based (substitui CloudWatch Events)
- **Archive & Replay**: armazene e re-processe eventos para debug/recovery
- **Schema Registry**: auto-descoberta e documentacao de schemas

## SQS vs SNS vs EventBridge

| Caso de Uso | Servico |
|-------------|---------|
| Fila com consumidores (pull) | SQS |
| Fan-out para multiplos subscribers (push) | SNS |
| Roteamento de eventos com filtragem | EventBridge |
| Desacoplar microsservicos | SQS ou SNS+SQS |
| Reagir a eventos de servicos AWS | EventBridge |
| Tarefas agendadas (cron) | EventBridge Scheduler |

## AWS Step Functions

Orquestre workflows serverless com maquina de estados visual.

| Tipo | Duracao | Execucao | Preco |
|------|---------|----------|-------|
| **Standard** | Ate 1 ano | Exactly-once | \\$0.025 por 1.000 transicoes |
| **Express** | Ate 5 min | At-least-once (async) ou at-most-once (sync) | \\$1 por milhao |

- **Error handling**: Retry (com backoff) e Catch (estado fallback)
- **Map state**: iteracao paralela sobre arrays
- **Service integrations**: 200+ servicos AWS

## Amazon Kinesis

| Servico | Proposito | Latencia |
|---------|-----------|---------|
| **Data Streams** | Streaming real-time, consumers customizados | ~200ms |
| **Data Firehose** | Carregar dados streaming para destinos | 60s buffer |
| **Data Analytics** | Queries SQL em dados streaming | Near real-time |

### Streams vs Firehose
- **Streams**: voce gerencia shards (1 MB/s in, 2 MB/s out por shard), retencao 1-365 dias, consumers customizados
- **Firehose**: totalmente gerenciado, auto-scaling, sem shards, destinos (S3, Redshift, OpenSearch)

## Amazon MQ

Broker gerenciado para **migrar apps existentes** usando JMS, AMQP, MQTT, STOMP.
- Suporta Apache ActiveMQ e RabbitMQ
- Use apenas para migracao de brokers on-prem (para novos apps, use SQS/SNS)

## Erros Comuns

- Usar SQS quando fan-out e necessario (use SNS+SQS)
- Confundir SQS Standard (duplicatas possiveis) com FIFO (exactly-once)
- Esquecer que visibility timeout curto causa reprocessamento
- Usar Kinesis Streams quando Firehose (mais simples) seria suficiente
- Escolher Amazon MQ para novos apps em vez de SQS/SNS
`,

  quiz: [
    {
      question: 'Qual a diferenca principal entre SQS Standard e FIFO?',
      options: ['Standard e gratis, FIFO e pago', 'Standard tem throughput ilimitado com at-least-once, FIFO garante exactly-once com ordenacao estrita', 'FIFO tem throughput ilimitado', 'Standard garante ordenacao'],
      correct: 1,
      explanation: 'Standard: throughput ilimitado, at-least-once (duplicatas possiveis), ordenacao melhor esforco. FIFO: 300/3000 msg/s, exactly-once, ordenacao estrita por message group.',
      reference: 'Standard = alto throughput, duplicatas possiveis. FIFO = ordenacao + exactly-once, throughput menor.'
    },
    {
      question: 'O que e o padrao SNS+SQS fan-out?',
      options: ['SNS envia para uma fila SQS', 'SNS topic publica para multiplas filas SQS para processamento paralelo', 'SQS envia para multiplos SNS topics', 'SNS substitui SQS completamente'],
      correct: 1,
      explanation: 'Fan-out: um SNS topic com multiplas subscriptions de filas SQS. Cada fila recebe copia de toda mensagem para processamento independente e paralelo.',
      reference: 'Fan-out = SNS topic -> multiplas SQS queues. Cada fila processa independentemente.'
    },
    {
      question: 'O que acontece quando o visibility timeout do SQS expira antes da mensagem ser processada?',
      options: ['Mensagem e deletada', 'Mensagem fica visivel novamente para outros consumidores', 'Mensagem vai para DLQ', 'A fila e pausada'],
      correct: 1,
      explanation: 'Se o visibility timeout expirar antes do consumidor deletar a mensagem, ela fica visivel novamente e pode ser recebida por outro consumidor. Isso pode causar duplicatas.',
      reference: 'Visibility timeout curto = duplicatas. Longo demais = atrasa retries. Padrao: 30s.'
    },
    {
      question: 'Quando usar EventBridge em vez de SNS?',
      options: ['Quando precisa de notificacoes SMS', 'Quando precisa de filtragem de eventos, roteamento para muitos targets e integracao com eventos AWS', 'Quando precisa de entrega de email', 'Quando precisa de ordenacao FIFO'],
      correct: 1,
      explanation: 'EventBridge fornece filtragem avancada de eventos, 150+ integracoes de target, schema registry, archive/replay e integracao nativa com eventos de servicos AWS.',
      reference: 'EventBridge = roteamento + filtragem + eventos AWS. SNS = pub/sub simples fan-out.'
    },
    {
      question: 'Qual a diferenca entre Kinesis Data Streams e Firehose?',
      options: ['Streams e gerenciado, Firehose nao', 'Streams precisa de gerenciamento de shards e consumers custom, Firehose e totalmente gerenciado com auto-scaling', 'Sao identicos', 'Firehose tem menor latencia'],
      correct: 1,
      explanation: 'Data Streams: voce gerencia shards, escreve consumers custom, real-time (~200ms). Firehose: totalmente gerenciado, auto-scaling, destinos (S3/Redshift/OpenSearch), buffer 60s.',
      reference: 'Streams = real-time + consumers custom + shards. Firehose = gerenciado + destinos + sem shards.'
    },
    {
      question: 'Qual a diferenca entre Step Functions Standard e Express?',
      options: ['Standard e mais barato', 'Standard suporta ate 1 ano e exactly-once, Express ate 5 min com maior throughput', 'Express suporta workflows mais longos', 'Tem as mesmas features'],
      correct: 1,
      explanation: 'Standard: ate 1 ano, exactly-once, \\$0.025/1K transicoes. Express: ate 5 min, at-least/at-most-once, \\$1/milhao, para workflows curtos de alto volume.',
      reference: 'Standard = workflows longos, exactly-once. Express = curtos, alto volume, mais barato.'
    },
    {
      question: 'Quando usar Amazon MQ em vez de SQS/SNS?',
      options: ['Para todas as novas aplicacoes', 'Ao migrar aplicacoes existentes que usam protocolos como JMS, AMQP ou MQTT', 'Quando precisa de maior throughput', 'Quando precisa de fan-out'],
      correct: 1,
      explanation: 'Amazon MQ e para migrar aplicacoes existentes usando protocolos padrao de mensageria (JMS, AMQP, MQTT). Para novos apps cloud-native, sempre use SQS/SNS.',
      reference: 'Amazon MQ = migracao de brokers on-prem. SQS/SNS = novos apps cloud-native.'
    },
    {
      question: 'O que e SQS long polling e por que usar?',
      options: ['Polling a cada 100ms para velocidade', 'Esperar ate 20 segundos por mensagens, reduzindo respostas vazias e custo', 'Delecao automatica de mensagens', 'Processamento em lote de mensagens'],
      correct: 1,
      explanation: 'Long polling (WaitTimeSeconds 1-20s) espera por mensagens antes de retornar resposta vazia. Reduz numero de chamadas API e custos.',
      reference: 'Long polling = menos chamadas API, menor custo. Defina WaitTimeSeconds > 0. Max 20s.'
    }
  ],

  flashcards: [
    { front: 'SQS Standard vs FIFO?', back: 'Standard: throughput ilimitado, at-least-once (duplicatas possiveis), ordenacao melhor esforco. FIFO: 300/3000 msg/s, exactly-once, ordenacao estrita por message group ID. Nome FIFO deve terminar em .fifo.' },
    { front: 'Features principais do SQS?', back: 'Visibility Timeout (padrao 30s), Dead-Letter Queue (apos maxReceiveCount), Long Polling (1-20s, economiza), Retencao (1-14 dias, padrao 4), Max 256KB, Delay Queue (0-900s).' },
    { front: 'Padrao SNS fan-out?', back: 'Um SNS topic -> multiplas subscriptions de filas SQS. Cada fila recebe copia de toda mensagem. Processamento paralelo independente. Adicione message filtering nas subscriptions.' },
    { front: 'SQS vs SNS vs EventBridge?', back: 'SQS: fila, consumidores fazem pull. SNS: pub/sub, push para subscribers. EventBridge: event bus, roteamento/filtragem avancada, 150+ targets, eventos AWS, scheduler, archive/replay.' },
    { front: 'Step Functions Standard vs Express?', back: 'Standard: ate 1 ano, exactly-once, \\$0.025/1K transicoes. Express: ate 5 min, at-least/at-most-once, \\$1/M execucoes, para workflows curtos de alto volume.' },
    { front: 'Kinesis Streams vs Firehose?', back: 'Streams: real-time ~200ms, gerencia shards (1MB/s in), consumers custom, retencao 1-365 dias. Firehose: gerenciado, auto-scale, buffer 60s, destinos (S3/Redshift/OpenSearch).' },
    { front: 'Quando usar Amazon MQ?', back: 'Migracao de brokers on-prem usando JMS/AMQP/MQTT/STOMP. Suporta ActiveMQ e RabbitMQ. NAO para novos apps cloud-native (use SQS/SNS).' },
    { front: 'O que e EventBridge Archive & Replay?', back: 'Armazene eventos em um archive com filtragem opcional. Re-processe eventos arquivados em um event bus para debug, recovery ou reprocessamento. Util para testes e DR.' }
  ],

  lab: {
    scenario: 'Construa um sistema de processamento de pedidos desacoplado usando SQS, SNS e Lambda.',
    objective: 'Praticar criacao de filas, topicos, fan-out e dead-letter queues.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Fila SQS com Dead-Letter Queue',
        instruction: 'Crie uma fila SQS principal e uma DLQ. Configure a fila principal para enviar mensagens falhas para a DLQ apos 3 tentativas.',
        hints: ['Crie a DLQ primeiro, depois referencie seu ARN', 'Use RedrivePolicy para configurar DLQ'],
        solution: '```bash\n# Criar DLQ\naws sqs create-queue --queue-name orders-dlq\n\n# Obter ARN da DLQ\nDLQ_ARN=$(aws sqs get-queue-attributes --queue-url QUEUE_URL \\\n  --attribute-names QueueArn --query "Attributes.QueueArn" --output text)\n\n# Criar fila principal com redrive policy\naws sqs create-queue --queue-name orders-queue \\\n  --attributes \'{"RedrivePolicy":"{\\\\\"deadLetterTargetArn\\\\\":\\\\\"DLQ_ARN\\\\\",\\\\\"maxReceiveCount\\\\\":\\\\\"3\\\\\"}","VisibilityTimeout":"60"}\'\n```',
        verify: '```bash\naws sqs get-queue-attributes --queue-url MAIN_QUEUE_URL \\\n  --attribute-names RedrivePolicy\n# Esperado: deadLetterTargetArn = DLQ ARN, maxReceiveCount = 3\n```'
      },
      {
        title: 'Configurar SNS Fan-Out para Multiplas Filas',
        instruction: 'Crie um SNS topic e inscreva duas filas SQS para processamento paralelo (ex: uma para billing, outra para notificacoes).',
        hints: ['SNS precisa de permissao para enviar ao SQS', 'Use SQS queue policy para permitir SNS'],
        solution: '```bash\n# Criar SNS topic\naws sns create-topic --name order-events\n\n# Criar duas filas consumidoras\naws sqs create-queue --queue-name billing-queue\naws sqs create-queue --queue-name notification-queue\n\n# Inscrever filas no topic\naws sns subscribe --topic-arn TOPIC_ARN \\\n  --protocol sqs --notification-endpoint BILLING_QUEUE_ARN\n\naws sns subscribe --topic-arn TOPIC_ARN \\\n  --protocol sqs --notification-endpoint NOTIFICATION_QUEUE_ARN\n```',
        verify: '```bash\n# Publicar mensagem de teste\naws sns publish --topic-arn TOPIC_ARN \\\n  --message \'{"orderId":"123","total":99.99}\'\n\n# Verificar que ambas as filas receberam\naws sqs receive-message --queue-url BILLING_QUEUE_URL\naws sqs receive-message --queue-url NOTIFICATION_QUEUE_URL\n# Esperado: ambas filas tem a mensagem\n```'
      },
      {
        title: 'Configurar Long Polling',
        instruction: 'Habilite long polling (20s) em uma fila e teste o comportamento do visibility timeout.',
        hints: ['ReceiveMessageWaitTimeSeconds para long polling', 'VisibilityTimeout controla quanto tempo a mensagem fica oculta'],
        solution: '```bash\n# Habilitar long polling (20s)\naws sqs set-queue-attributes --queue-url QUEUE_URL \\\n  --attributes \'{"ReceiveMessageWaitTimeSeconds":"20"}\'\n\n# Enviar mensagem de teste\naws sqs send-message --queue-url QUEUE_URL \\\n  --message-body "test-message"\n\n# Receber (espera ate 20s se nao houver mensagens)\naws sqs receive-message --queue-url QUEUE_URL\n```',
        verify: '```bash\naws sqs get-queue-attributes --queue-url QUEUE_URL \\\n  --attribute-names ReceiveMessageWaitTimeSeconds,VisibilityTimeout\n# Esperado: ReceiveMessageWaitTimeSeconds = 20\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Mensagens Processadas Multiplas Vezes (Duplicatas)',
      difficulty: 'medium',
      symptom: 'Mensagens da fila SQS Standard estao sendo processadas mais de uma vez pelos consumidores.',
      diagnosis: '```\nSQS Standard entrega at-least-once (duplicatas possiveis)\n\nCausas comuns:\n1. Visibility timeout curto demais:\n   Consumidor demora mais que o timeout para processar\n   Mensagem fica visivel novamente\n\n2. Consumidor nao deleta mensagem apos processar:\n   Mensagem reaparece apos visibility timeout\n\n3. Usando Standard quando FIFO e necessario:\n   Standard nao garante exactly-once\n\nVerifique:\n  - Tempo de processamento vs visibility timeout\n  - Codigo do consumidor: DeleteMessage e chamado apos sucesso?\n  - ApproximateReceiveCount nos atributos da mensagem\n```',
      solution: 'Opcao 1: Aumente visibility timeout para ser maior que o tempo maximo de processamento. Opcao 2: Use SQS FIFO para exactly-once. Opcao 3: Torne o consumidor idempotente (seguro processar mesma mensagem duas vezes). Sempre delete a mensagem apos processamento bem-sucedido.'
    },
    {
      title: 'Regra EventBridge Nao Dispara Target',
      difficulty: 'hard',
      symptom: 'Regra EventBridge esta configurada mas o target Lambda/SQS nunca e invocado.',
      diagnosis: '```\nChecklist:\n1. Event pattern corresponde ao evento real?\n   Teste com: aws events test-event-pattern\n   Comum: source, detail-type ou detail errados\n\n2. Regra esta no event bus correto?\n   Default bus para eventos AWS, custom bus para seus eventos\n\n3. Target tem resource-based policy permitindo EventBridge?\n   Lambda: precisa de lambda:InvokeFunction para events.amazonaws.com\n   SQS: precisa de sqs:SendMessage para events.amazonaws.com\n\n4. Regra esta habilitada?\n   aws events describe-rule --name RULE_NAME\n   State deve ser ENABLED\n```',
      solution: 'Problema mais comum e event pattern incompativel ou resource-based policy faltando no target. Use CloudWatch Metrics da regra (Invocations, FailedInvocations) para determinar se a regra faz match mas target falha, ou se regra nunca faz match.'
    }
  ]
};
