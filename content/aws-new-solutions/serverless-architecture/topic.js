window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-new-solutions/serverless-architecture'] = {
  theory: `# Arquitetura Serverless em Escala

## Relevancia no Exame
> **Design for New Solutions** vale **29%** do SAP-C02. Padroes serverless avancados, otimizacoes Lambda, orquestracao com Step Functions e arquiteturas orientadas a eventos sao topicos centrais.

## AWS Lambda Avancado

### Otimizacao de Performance
- **Memoria**: 128 MB – 10.240 MB. CPU escala linearmente com memoria. Mais memoria = execucao mais rapida = frequentemente mais barato.
- **Provisioned Concurrency**: pre-aquece instancias Lambda para eliminar cold starts. Para funcoes sensiveis a latencia.
- **Reserved Concurrency**: limita execucoes concorrentes maximas de uma funcao (protecao contra throttle + controle de custo).
- **Timeout de execucao**: maximo 15 minutos.
- **Armazenamento /tmp**: ate 10 GB por invocacao.

### Lambda Layers e Destinations
- **Layers**: compartilhe codigo/bibliotecas entre funcoes (ate 5 layers). Maximo 250 MB descomprimido.
- **Destinations**: roteie resultados de invocacao assincrona para SQS, SNS, Lambda ou EventBridge (sucesso + falha separadamente).
- **Lambda URLs**: endpoint HTTPS integrado sem API Gateway.
- **Response Streaming**: transmita respostas grandes para clientes (nao bufferizado).

### Tipos de Concorrencia
| Tipo | Proposito |
|------|-----------|
| **Nao-reservada** | Pool compartilhado regional, pode escalar ate limite |
| **Reservada** | Cap rigido por funcao (garante disponibilidade, limita blast radius) |
| **Provisionada** | Pre-inicializada, elimina cold starts (custo extra) |

## API Gateway

| Tipo | Protocolo | Caso de Uso |
|------|-----------|-------------|
| **REST API** | HTTP/REST | Gerenciamento API completo |
| **HTTP API** | HTTP/REST | Menor custo/latencia, menos features |
| **WebSocket API** | WebSocket | Apps bidirecionais em tempo real (chat, games) |

Features principais:
- **Authorizers**: Lambda authorizer customizado (JWT, logica custom) ou Cognito User Pool
- **Usage Plans + API Keys**: rate limiting e quota por cliente
- **Cache**: cache de respostas (TTL configuravel) para reduzir chamadas ao backend
- **Throttling**: limite soft padrao 10.000 rps, 5.000 burst
- **Endpoints privados**: interface endpoint na VPC

## AWS Step Functions

Orquestre workflows serverless com state machines:
- **Standard**: longa duracao (ate 1 ano), exactly-once, historico auditavel. Para aprovacao humana, ETL.
- **Express**: alto volume, at-least-once, max 5 minutos. Para IoT, streaming, microsservicos.
- **Activities**: permite workers externos agirem em tarefas (integracao hibrida)
- **Integracoes SDK**: chame 200+ servicos AWS diretamente sem wrapper Lambda

### Padroes de Workflow
- **Sequencial**: passos executam um apos o outro
- **Paralelo**: multiplos branches executam concorrentemente
- **Map**: itera sobre itens de array (fan-out)
- **Wait for callback (task token)**: pausa workflow ate sistema externo enviar token de volta

## AWS AppSync (GraphQL)

- **Resolvers**: conecte operacoes GraphQL a DynamoDB, Lambda, HTTP, Elasticsearch
- **Subscriptions em tempo real**: WebSocket para dados ao vivo (IoT, dashboards)
- **Sync offline**: resolucao de conflitos para apps mobile (Cognito + AppSync)

## EventBridge Avancado

- **Event Buses**: padrao (servicos AWS), customizados, parceiros (eventos SaaS: Datadog, Zendesk, etc.)
- **Pipes**: ponto-a-ponto entre fonte de evento e destino, com filtragem/enriquecimento opcional
- **Scheduler**: entrega de eventos baseada em cron ou rate (substituto do CloudWatch Events)
- **Schema Registry**: descobre e documenta schemas de eventos automaticamente

## SAM e CDK

| Ferramenta | Linguagem | Abstracao |
|------------|-----------|-----------|
| **SAM** | YAML/JSON | Serverless simples (Lambda, API GW, DynamoDB) |
| **CDK** | TypeScript, Python, Java... | Infra completa como codigo |

## Erros Comuns

- Nao usar Provisioned Concurrency para funcoes criticas de latencia
- Usar Step Functions Standard quando Express e necessario para alto volume (custo)
- Esquecer que Lambda Destinations vs DLQ (Destinations apenas para async)
- Escolher REST API Gateway quando HTTP API e suficiente (2x menor custo)
- Lambda Reserved Concurrency muito baixo pode causar throttling
`,

  quiz: [
    {
      question: 'Qual a diferenca entre Lambda Reserved e Provisioned Concurrency?',
      options: ['Sao iguais', 'Reserved = cap rigido nas execucoes concorrentes; Provisioned = instancias pre-aquecidas para eliminar cold starts', 'Provisioned limita execucoes, Reserved pre-aquece', 'Reserved e apenas para funcoes agendadas'],
      correct: 1,
      explanation: 'Reserved Concurrency: maximo de execucoes concorrentes permitidas para uma funcao (throttle acima disso). Provisioned Concurrency: pre-inicializa ambientes de execucao para eliminar latencia de cold start.',
      reference: 'Reserved = cap (throttle acima do limite). Provisioned = pre-aquecer (eliminar cold start). Ambos custam extra.'
    },
    {
      question: 'Quando usar Step Functions Express Workflow vs Standard?',
      options: ['Standard para tudo', 'Express para alto volume, curta duracao (<5min); Standard para longa duracao, exactly-once, com historico de auditoria', 'Express para workflows de aprovacao humana', 'Standard para processamento de eventos IoT'],
      correct: 1,
      explanation: 'Express: alto volume (100k eventos/s), at-least-once, max 5 min, mais barato para alto throughput. Standard: ate 1 ano, exactly-once, historico completo, para ETL/aprovacao humana.',
      reference: 'Express = alto volume, at-least-once, <5min. Standard = longa duracao, exactly-once, historico de auditoria.'
    },
    {
      question: 'Qual a diferenca entre API Gateway REST API e HTTP API?',
      options: ['Nenhuma diferenca', 'HTTP API e 70% mais barato com menor latencia mas menos features; REST API tem conjunto completo (WAF, cache, usage plans)', 'REST API e mais barato', 'HTTP API suporta WebSocket'],
      correct: 1,
      explanation: 'HTTP API: menor custo (~70% menos), menor latencia, auth JWT/Cognito, VPC links. Sem integracao WAF, sem cache de respostas, sem usage plans. REST API: recursos completos incluindo WAF, cache, chaves API.',
      reference: 'HTTP API = barato/rapido/simples. REST API = recursos completos (WAF, cache, usage plans). WebSocket API = tempo real.'
    },
    {
      question: 'O que Lambda Destinations oferece que DLQ nao oferece?',
      options: ['DLQ e Destinations sao identicos', 'Destinations podem rotear para SQS/SNS/Lambda/EventBridge para SUCESSO e FALHA; DLQ apenas trata falhas', 'Destinations funcionam para invocacoes sincronas; DLQ para async', 'DLQ e mais barato'],
      correct: 1,
      explanation: 'Lambda Destinations: apenas invocacoes async, roteiam para SQS/SNS/Lambda/EventBridge para sucesso E falha, com contexto completo do evento. DLQ: apenas falha, apenas SQS ou SNS, menos contexto.',
      reference: 'Destinations = apenas async, sucesso+falha, contexto completo. DLQ = apenas falha, SQS/SNS, menos contexto.'
    },
    {
      question: 'O que o Lambda Provisioned Concurrency especificamente resolve?',
      options: ['Limites de memoria', 'Latencia de cold start — funcoes respondem imediatamente sem atraso de inicializacao', 'Timeout de execucao', 'Reducao de custo'],
      correct: 1,
      explanation: 'Cold starts ocorrem quando Lambda inicializa um novo ambiente de execucao. Provisioned Concurrency pre-aquece ambientes para que requests sejam atendidos imediatamente. Custa extra.',
      reference: 'Provisioned Concurrency = eliminar cold start. Necessario para APIs criticas de latencia. Custa extra por execucao provisionada.'
    },
    {
      question: 'Para que serve o padrao "wait for callback" do Step Functions?',
      options: ['Polling de servicos externos', 'Pausar um workflow ate um sistema externo enviar um task token de volta (aprovacao humana, processamento async externo)', 'Aguardar timeout Lambda', 'Logica de retry'],
      correct: 1,
      explanation: 'Wait for callback (task token): Step Functions envia um task token para servico externo (email, SQS, Lambda). O workflow pausa ate SendTaskSuccess/SendTaskFailure ser chamado com aquele token.',
      reference: 'Task token = padrao de aprovacao humana async. Sistema externo chama de volta com token para retomar workflow.'
    },
    {
      question: 'Qual limite Lambda pode causar throttling silencioso em todas as funcoes de uma Region?',
      options: ['Limite de memoria', 'Pool de concorrencia nao-reservada — se funcoes consumirem todo ele, outras funcoes nao conseguem escalar', 'Limite de armazenamento', 'Timeout de execucao'],
      correct: 1,
      explanation: 'Cada Region tem um limite de execucao concorrente (padrao 1000). Se funcoes sem reserved concurrency consumirem tudo, outras funcoes sao throttled. Reserved Concurrency protege funcoes criticas.',
      reference: 'Limite de concorrencia regional = pool compartilhado. Reserved Concurrency = proteger funcoes criticas de starvation.'
    },
    {
      question: 'O que o AppSync oferece que APIs REST padrao nao oferecem?',
      options: ['Melhor performance', 'GraphQL com subscriptions em tempo real, sync offline e autorizacao em nivel de campo', 'Preco menor', 'Auto-scaling'],
      correct: 1,
      explanation: 'AppSync: API GraphQL com subscriptions WebSocket em tempo real, sync offline para mobile, autorizacao em nivel de campo com Cognito/IAM/API Key. APIs REST padrao requerem implementacao custom de tudo isso.',
      reference: 'AppSync = GraphQL + subscriptions tempo real + sync offline. Para apps mobile e dashboards em tempo real.'
    }
  ],

  flashcards: [
    { front: 'Tipos de concorrencia Lambda?', back: 'Nao-reservada: pool regional compartilhado. Reservada: cap rigido por funcao (protege + limita). Provisionada: instancias pre-aquecidas, elimina cold starts (custo extra). Limite regional padrao 1000.' },
    { front: 'Step Functions Standard vs Express?', back: 'Standard: ate 1 ano, exactly-once, historico auditavel completo, para ETL/aprovacao humana. Express: alto volume (100k/s), at-least-once, max 5 min, mais barato para IoT/streaming.' },
    { front: 'Tipos de API Gateway?', back: 'REST API: recursos completos (WAF, cache, usage plans, auth custom). HTTP API: 70% mais barato, menor latencia, JWT/Cognito, menos features. WebSocket API: tempo real bidirecional.' },
    { front: 'Lambda Destinations vs DLQ?', back: 'Destinations: apenas async, roteamento sucesso+falha, para SQS/SNS/Lambda/EventBridge, contexto completo. DLQ: apenas falha, apenas SQS/SNS, menos contexto. Destinations sao mais poderosos.' },
    { front: 'Lambda Layers?', back: 'Compartilhe codigo/bibliotecas entre funcoes sem empacotar em cada deployment. Ate 5 layers por funcao. Max 250 MB descomprimido. Inclui dependencias, runtimes customizados, Lambda extensions.' },
    { front: 'Componentes EventBridge?', back: 'Event Buses: padrao(AWS), customizado(app), parceiro(SaaS). Pipes: ponto-a-ponto fonte->destino com filtro+enriquecimento. Scheduler: entrega cron/rate. Schema Registry: descobre schemas automaticamente.' },
    { front: 'Features AppSync?', back: 'API GraphQL. Resolvers: DynamoDB, Lambda, HTTP, OpenSearch. Subscriptions WebSocket em tempo real. Sync offline com resolucao de conflitos. Auth em nivel de campo: Cognito, IAM, API Key, OIDC.' },
    { front: 'SAM vs CDK?', back: 'SAM: YAML/JSON, serverless simplificado (Lambda, API GW, DynamoDB), transforma para CloudFormation. CDK: TypeScript/Python/Java, constructs AWS completos, imperativo, gera CloudFormation. CDK mais poderoso/flexivel.' }
  ],

  lab: {
    scenario: 'Construa um pipeline serverless de processamento de pedidos com Lambda, Step Functions e API Gateway.',
    objective: 'Praticar configuracao Lambda, orquestracao Step Functions e configuracao API Gateway.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Implantar Lambda com Provisioned Concurrency',
        instruction: 'Crie uma funcao Lambda com provisioned concurrency para eliminar cold starts numa API critica de pedidos.',
        hints: ['Publique uma versao antes de configurar provisioned concurrency', 'Provisioned concurrency e configurado em uma versao ou alias'],
        solution: '```bash\n# Criar funcao Lambda\naws lambda create-function --function-name ProcessadorPedidos \\\n  --runtime python3.12 \\\n  --role arn:aws:iam::CONTA:role/lambda-role \\\n  --handler index.handler \\\n  --zip-file fileb://function.zip \\\n  --timeout 30 --memory-size 512\n\n# Publicar uma versao\naws lambda publish-version --function-name ProcessadorPedidos\n\n# Configurar provisioned concurrency na versao 1\naws lambda put-provisioned-concurrency-config \\\n  --function-name ProcessadorPedidos \\\n  --qualifier 1 \\\n  --provisioned-concurrent-executions 10\n```',
        verify: '```bash\naws lambda get-provisioned-concurrency-config \\\n  --function-name ProcessadorPedidos \\\n  --qualifier 1\n# Esperado: AllocatedProvisionedConcurrentExecutions = 10\n# Status = READY (nao IN_PROGRESS)\n```'
      },
      {
        title: 'Criar State Machine Step Functions para Workflow de Pedidos',
        instruction: 'Crie uma state machine Standard do Step Functions que valida, processa e notifica para um pedido.',
        hints: ['Use workflow Standard para historico de auditoria', 'Integracoes SDK podem chamar DynamoDB diretamente'],
        solution: '```bash\naws stepfunctions create-state-machine \\\n  --name WorkflowPedido \\\n  --type STANDARD \\\n  --role-arn arn:aws:iam::CONTA:role/stepfunctions-role \\\n  --definition \'{\n  "Comment": "Workflow de processamento de pedidos",\n  "StartAt": "ValidarPedido",\n  "States": {\n    "ValidarPedido": {\n      "Type": "Task",\n      "Resource": "arn:aws:lambda:us-east-1:CONTA:function:ValidarPedido",\n      "Next": "ProcessarPagamento",\n      "Catch": [{"ErrorEquals": ["States.ALL"],"Next": "PedidoFalhou"}]\n    },\n    "ProcessarPagamento": {\n      "Type": "Task",\n      "Resource": "arn:aws:lambda:us-east-1:CONTA:function:ProcessarPagamento",\n      "Next": "NotificarCliente"\n    },\n    "NotificarCliente": {\n      "Type": "Task",\n      "Resource": "arn:aws:states:::sns:publish",\n      "Parameters": {"TopicArn": "arn:aws:sns:us-east-1:CONTA:pedidos","Message.$": "$.pedidoId"},\n      "End": true\n    },\n    "PedidoFalhou": {"Type": "Fail", "Error": "ValidacaoPedidoFalhou"}\n  }\n}\'\n```',
        verify: '```bash\naws stepfunctions describe-state-machine \\\n  --state-machine-arn arn:aws:states:us-east-1:CONTA:stateMachine:WorkflowPedido\n# Esperado: status = ACTIVE, type = STANDARD\n\n# Testar execucao\naws stepfunctions start-execution \\\n  --state-machine-arn arn:aws:states:us-east-1:CONTA:stateMachine:WorkflowPedido \\\n  --input \'{"pedidoId": "pedido-123"}\'\n```'
      },
      {
        title: 'Criar HTTP API Gateway com Integracao Lambda',
        instruction: 'Crie um HTTP API Gateway (mais barato que REST) com autorizacao JWT e integracao Lambda.',
        hints: ['HTTP API e ~70% mais barato que REST API', 'Authorizer JWT valida tokens do Cognito'],
        solution: '```bash\n# Criar HTTP API\naws apigatewayv2 create-api \\\n  --name PedidosAPI \\\n  --protocol-type HTTP \\\n  --cors-configuration AllowOrigins="*",AllowMethods="GET,POST"\n\n# Criar integracao Lambda\naws apigatewayv2 create-integration \\\n  --api-id API_ID \\\n  --integration-type AWS_PROXY \\\n  --integration-uri arn:aws:lambda:us-east-1:CONTA:function:ProcessadorPedidos \\\n  --payload-format-version 2.0\n\n# Criar rota\naws apigatewayv2 create-route \\\n  --api-id API_ID \\\n  --route-key "POST /pedidos" \\\n  --target integrations/INTEGRATION_ID\n```',
        verify: '```bash\naws apigatewayv2 get-api --api-id API_ID\n# Esperado: ProtocolType = HTTP, ApiEndpoint mostrado\n\naws apigatewayv2 get-routes --api-id API_ID\n# Esperado: rota POST /pedidos com integracao Lambda\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Cold Starts Lambda Causando Picos de Latencia na API',
      difficulty: 'medium',
      symptom: 'Respostas da API sao rapidas na maioria das vezes mas ocasionalmente disparam para 2-5 segundos. Acontece mais apos periodos de inatividade.',
      diagnosis: '```\nIndicadores de cold start:\n1. X-Ray traces: segmento "Initialization" presente (cold start)\n2. CloudWatch Logs: linha REPORT com "Init Duration: XXX ms"\n3. Padrao: picos apos inatividade ou apos novos deploys\n\nFatores de cold start:\n- Runtime: Node/Python tem cold starts mais rapidos que Java/.NET\n- Tamanho do pacote: maior = init mais lento\n- VPC: adiciona 1-3s para criacao de ENI (se funcao esta em VPC)\n- Memoria: mais memoria = init mais rapido\n\nMitigacoes:\n1. Provisioned Concurrency (elimina cold starts)\n2. Manter funcoes aquecidas com ping agendado (workaround)\n3. Aumentar memoria (acelera init)\n4. Reduzir tamanho do pacote (layers, tree-shaking)\n5. VPC: use apenas se necessario\n```',
      solution: 'Para funcoes de producao criticas de latencia: habilite Provisioned Concurrency na versao/alias publicado. Verifique X-Ray por segmentos "Initialization". Reduza o tamanho do pacote de deployment. Evite colocar Lambda em VPC a menos que necessario (adiciona tempo de criacao de ENI). SnapStart disponivel para Java.'
    },
    {
      title: 'Execucao Step Functions Falhando com States.TaskFailed',
      difficulty: 'hard',
      symptom: 'Execucoes da state machine Step Functions falham numa tarefa Lambda com erro States.TaskFailed. Funcao Lambda funciona quando invocada diretamente.',
      diagnosis: '```\nDiagnostico States.TaskFailed:\n1. Verificar detalhes da execucao:\n   aws stepfunctions get-execution-history \\\n     --execution-arn arn:aws:states:...\n   Procure evento TaskFailed com cause/error\n\n2. Causas comuns:\n   a) Funcao Lambda lanca excecao nao tratada\n      -> Verifique CloudWatch Logs da invocacao Lambda\n   b) Role IAM Step Functions sem lambda:InvokeFunction\n      -> Verifique erro: "AccessDenied" no cause\n   c) Timeout Lambda excedido\n      -> Lambda padrao 3s, Step Functions pode configurar mais alto\n   d) Throttling por reserved concurrency\n      -> Erro: "TooManyRequestsException"\n\n3. Configuracao Retry + Catch:\n   Adicione Retry para erros transientes (Lambda.TooManyRequestsException)\n   Adicione Catch para falhas permanentes\n\nVerificar logs Lambda:\n  aws logs filter-log-events \\\n    --log-group-name /aws/lambda/NOME_FUNCAO \\\n    --filter-pattern "ERROR"\n```',
      solution: 'Verifique o historico de execucao para a causa exata do erro. Confirme que a role IAM do Step Functions tem permissao lambda:InvokeFunction. Verifique logs da funcao Lambda por excecoes. Adicione blocos Retry para erros transientes (throttling, rede). Adicione blocos Catch para lidar com falhas. Considere aumentar o timeout Lambda na configuracao da funcao.'
    }
  ]
};
