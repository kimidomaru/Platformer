window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-migration/modernization-patterns'] = {
  theory: `# Padroes de Modernizacao de Aplicacoes

## Relevancia no Exame
> **Design for New Solutions** vale **29%** do SAP-C02. Padroes de modernizacao (Strangler Fig, estrategias de decomposicao), arquitetura orientada a eventos e padroes de desacoplamento aparecem em questoes de cenarios complexos.

## Padrao Strangler Fig

Substitua gradualmente um monolito por microsservicos:
1. **Identifique** um contexto delimitado no monolito
2. **Construa** um novo microsservico para aquele contexto
3. **Roteie** trafego para aquela funcao para o novo servico (via API Gateway, ALB)
4. **Retire** o codigo correspondente do monolito
5. Repita ate que o monolito seja completamente substituido

### Implementacao AWS
- **API Gateway**: roteie por prefixo de caminho ou header para novo servico vs monolito
- **ALB com target groups ponderados**: deslocamento gradual de trafego
- **EventBridge**: intercepte eventos do monolito para acionar novos servicos

## Arquitetura Orientada a Eventos (EDA)

Desacople servicos atraves de eventos:
- **EventBridge**: roteador de eventos — filtre, transforme, roteie para 20+ destinos
- **SNS Fan-out**: publique uma vez, multiplas filas SQS recebem
- **SQS para desacoplamento**: buffer entre produtor e consumidor
- **Kinesis**: streaming de eventos em tempo real (ordenado, com replay)
- **Kafka (MSK)**: Kafka gerenciado para eventos de alto throughput e ordenados

### Padroes Orientados a Eventos
- **Event Notification**: servico publica evento, outros reagem (fire and forget)
- **Event-Carried State Transfer**: evento contem estado completo (sem consulta de volta)
- **Event Sourcing**: armazene todos os eventos como fonte da verdade; derive estado por replay
- **CQRS (Command Query Responsibility Segregation)**: separe modelos de leitura e escrita

## Padrao CQRS

Separe os lados de leitura e escrita do modelo de dados:
- **Lado de escrita**: trata comandos, aplica regras de negocio, publica eventos
- **Lado de leitura**: projections/views otimizadas para queries
- **Consistencia eventual**: lado de leitura atualizado assincronamente via eventos

### Implementacao AWS
- Escrita: DynamoDB ou RDS para operacoes de escrita
- Eventos: DynamoDB Streams -> Lambda -> atualizar modelo de leitura
- Leitura: ElastiCache ou OpenSearch para queries rapidas

## Padrao Saga

Gerencie transacoes distribuidas sem 2PC:
- **Coreografia**: servicos emitem eventos, cada um se inscreve nos eventos dos outros
- **Orquestracao**: orquestrador central (Step Functions) coordena os passos

### Implementacao AWS
- Step Functions Standard: saga orquestrada com estados de rollback explicitos
- Cada passo da saga = funcao Lambda
- Transacoes compensatorias definidas nos blocos Catch

## Padrao Database Per Service

Cada microsservico possui seu banco de dados:
- **Sem bancos compartilhados**: acoplamento via banco e anti-padrao
- **Persistencia poliglota**: cada servico usa o tipo de banco adequado
  - Servico de pedidos: RDS Aurora (transacoes ACID)
  - Catalogo de produtos: DynamoDB (schema flexivel)
  - Busca: OpenSearch
  - Analytics: Redshift

### Dados Cross-Service
- Chamadas de API para queries sincronas
- Orientado a eventos para atualizacoes assincronas
- API Composition: agregue dados de multiplos servicos em um API Gateway

## Anti-Corruption Layer

Traduza entre modelos de sistemas antigos e novos:
- Camada adaptadora que impede que o modelo legado contamine o novo servico
- Util durante migracao gradual (Strangler Fig)
- AWS: funcao Lambda que transforma formato de dados antigo para novo

## Padrao Bulkhead

Isole falhas para evitar cascata:
- Cada servico tem seu proprio pool de threads / pool de conexoes / fila SQS
- Reserved concurrency Lambda = bulkhead
- Subnets VPC por servico = isolamento de rede
- SQS por servico: backlog de uma fila nao afeta outras

## Erros Comuns

- Escolher 2PC (two-phase commit) para transacoes distribuidas (use Saga)
- Nao saber que Strangler Fig requer camada de roteamento de trafego (API GW, ALB)
- Usar banco de dados compartilhado entre microsservicos (viola contexto delimitado)
- Esquecer que CQRS requer tolerancia a consistencia eventual
- Escolher event sourcing quando CRUD simples e suficiente (over-engineering)
`,

  quiz: [
    {
      question: 'O que e o padrao Strangler Fig e como e implementado na AWS?',
      options: ['Deletar codigo legado imediatamente', 'Substituir gradualmente funcoes do monolito roteando trafego para novos microsservicos via API Gateway ou ALB enquanto o monolito continua rodando', 'Implantar microsservicos ao lado do monolito no mesmo banco', 'Migracao baseada em eventos usando SQS'],
      correct: 1,
      explanation: 'Strangler Fig: migre um monolito incrementalmente interceptando chamadas no ponto de entrada (API Gateway/ALB) e roteando caminhos especificos para novos microsservicos. O monolito continua rodando durante a migracao. Funcoes migram aos poucos.',
      reference: 'Strangler Fig = substituicao gradual. Roteamento de trafego = API GW ou ALB. Monolito continua rodando durante a migracao.'
    },
    {
      question: 'Quando usar CQRS (Command Query Responsibility Segregation)?',
      options: ['Para todas as aplicacoes', 'Quando padroes de leitura e escrita tem requisitos muito diferentes — leituras de alto volume precisam de views desnormalizadas, enquanto escritas precisam de garantias ACID', 'Apenas para bancos NoSQL', 'Para aplicacoes CRUD simples'],
      correct: 1,
      explanation: 'CQRS e valioso quando workloads de leitura e escrita sao assimetricos: ex. milhoes de leituras (use ElastiCache/OpenSearch) vs centenas de escritas (use RDS). Adiciona complexidade; use quando o beneficio de otimizacao de query justifica.',
      reference: 'CQRS = modelos separados leitura/escrita. Use quando padroes de leitura diferem dos de escrita. Adiciona complexidade de consistencia eventual.'
    },
    {
      question: 'Qual a principal diferenca entre Coreografia e Orquestracao na Saga?',
      options: ['Diferenca de custo', 'Coreografia: servicos se comunicam via eventos sem coordenador central; Orquestracao: servico central (Step Functions) gerencia o workflow', 'Coreografia e mais rapida', 'Orquestracao funciona apenas com Lambda'],
      correct: 1,
      explanation: 'Coreografia: descentralizada, cada servico conhece seus proprios eventos e reage aos de outros. Mais dificil de visualizar. Orquestracao: orquestrador central (Step Functions) direciona cada servico. Mais facil de debugar e visualizar o workflow.',
      reference: 'Coreografia = eventos descentralizados, mais dificil de debugar. Orquestracao = coordenador central (Step Functions), mais facil de rastrear.'
    },
    {
      question: 'Por que o padrao "Database per Service" e importante em microsservicos?',
      options: ['Reduz custos', 'Garante acoplamento fraco — servicos podem mudar seu schema sem afetar outros servicos, e cada um pode usar o tipo de banco otimizado', 'Melhora performance', 'Simplifica backup'],
      correct: 1,
      explanation: 'Bancos compartilhados criam acoplamento forte: qualquer mudanca de schema afeta todos os servicos, e um servico pode sobrecarregar o banco afetando outros. Database per service habilita deploy independente, persistencia poliglota e verdadeiros contextos delimitados.',
      reference: 'DB por servico = acoplamento fraco, persistencia poliglota, deploy independente. Sem DB compartilhado e principio central de microsservicos.'
    },
    {
      question: 'Em uma arquitetura de microsservicos, um servico de pagamento falha e causa a falha de todo o fluxo de checkout. Qual padrao aborda isso?',
      options: ['Strangler Fig', 'Padrao Bulkhead — isole falhas dando a cada servico recursos independentes (reserved concurrency Lambda, filas SQS separadas)', 'CQRS', 'Event Sourcing'],
      correct: 1,
      explanation: 'Bulkhead: isole falhas em um servico. Reserved concurrency Lambda impede um servico de consumir toda a concorrencia regional. Filas SQS separadas evitam que um backlog afete outros. Imita bulkheads de navio que contem alagamento em um compartimento.',
      reference: 'Bulkhead = isolar falhas. Reserved concurrency Lambda = bulkhead para funcoes. SQS por servico = isolamento de fila.'
    },
    {
      question: 'O que e Event Sourcing e quando deve ser usado?',
      options: ['Filtragem de eventos SQS', 'Armazene todas as mudancas de estado como sequencia imutavel de eventos; reconstrua estado atual fazendo replay. Bom para trilhas de auditoria, queries temporais, debugging', 'CloudWatch Events', 'Triggers baseados em eventos'],
      correct: 1,
      explanation: 'Event Sourcing: em vez de armazenar estado atual no banco, armazene o historico completo de eventos. Estado atual derivado fazendo replay de eventos. Beneficios: trilha de auditoria completa, viagem no tempo. Complexidade: tempo de replay para historicos grandes.',
      reference: 'Event Sourcing = log de eventos imutavel, replay para derivar estado. Para trilhas de auditoria + queries temporais. Complexo, nao para CRUD simples.'
    },
    {
      question: 'O que o padrao Anti-Corruption Layer previne em cenarios de migracao?',
      options: ['Vulnerabilidades de seguranca', 'O modelo de dominio do sistema legado vazar para e contaminar o design do novo servico', 'Corrupcao de dados durante migracao', 'Estouro de orcamento'],
      correct: 1,
      explanation: 'Anti-Corruption Layer (ACL): camada de traducao entre fronteiras de sistemas antigos e novos. Impede que conceitos legados (convencoes de nomenclatura antigas, formatos de dados, regras de negocio) se infiltrem na nova arquitetura.',
      reference: 'ACL = camada de traducao entre legado e novo servico. Previne contaminacao pelo modelo legado. Comum em migracao Strangler Fig.'
    },
    {
      question: 'Por que evitar transacoes distribuidas (2PC) em microsservicos e usar Saga?',
      options: ['2PC e muito caro', '2PC requer um coordenador que cria lock distribuido — servicos devem aguardar, reduzindo disponibilidade e criando acoplamento forte. Saga usa consistencia eventual', '2PC nao funciona com AWS', 'Saga e mais rapida'],
      correct: 1,
      explanation: '2PC: coordenador trava todos os participantes ate que todos confirmem — ponto unico de falha, disponibilidade reduz. Saga: cada passo e uma transacao local com transacao compensatoria se falhar. Abraca consistencia eventual para melhor disponibilidade.',
      reference: '2PC = lock distribuido, acoplamento forte, risco de disponibilidade. Saga = consistencia eventual, transacoes compensatorias, acoplamento fraco.'
    }
  ],

  flashcards: [
    { front: 'Padrao Strangler Fig?', back: 'Substituicao gradual do monolito: 1. Identificar contexto delimitado. 2. Construir microsservico. 3. Rotear trafego via API GW/ALB. 4. Retirar codigo do monolito. Repetir ate o monolito desaparecer. Monolito continua rodando.' },
    { front: 'Padrao CQRS?', back: 'Separe modelos de leitura (query) e escrita (command). Escrita: banco ACID, regras de negocio, emite eventos. Leitura: view desnormalizada/indexada, consistencia eventual. Use quando padroes leitura/escrita sao assimetricos.' },
    { front: 'Variantes do padrao Saga?', back: 'Coreografia: servicos emitem eventos, reagem aos de outros (descentralizado). Orquestracao: coordenador central (Step Functions) direciona workflow. Orquestracao = mais facil de debugar. Coreografia = mais desacoplado.' },
    { front: 'Padroes orientados a eventos?', back: 'Event Notification: fire & forget. Event-Carried State Transfer: estado completo no evento. Event Sourcing: eventos como fonte da verdade, replay para derivar estado. CQRS: lados separados leitura/escrita.' },
    { front: 'Beneficios Database per Service?', back: 'Acoplamento fraco: mudancas de schema nao afetam outros servicos. Persistencia poliglota: cada servico usa banco otimizado. Escalabilidade independente. Verdadeiros contextos delimitados. Sem DB compartilhado = principio central.' },
    { front: 'Padrao Bulkhead na AWS?', back: 'Isola falhas para prevenir cascata. Lambda: Reserved Concurrency limita por funcao. SQS: fila separada por servico. Subnets VPC: isolamento de rede. DLQ: captura falhas sem afetar fluxo principal.' },
    { front: 'Anti-Corruption Layer?', back: 'Camada de traducao na fronteira entre sistema antigo e novo. Impede que modelo de dados, nomenclatura ou conceitos legados vazem para o design do novo servico. Comum na migracao Strangler Fig. Implemente como Lambda adaptador ou mapeamento API Gateway.' },
    { front: 'Quando usar Event Sourcing?', back: 'Use para: trilhas de auditoria, viagem no tempo (replay de historico), debugging de estado complexo. Nao use para: CRUD simples, quando consistencia eventual e problematica, quando replay e muito lento (bilhoes de eventos). Adiciona complexidade significativa.' }
  ],

  lab: {
    scenario: 'Implemente o padrao Saga para um workflow de processamento de pedidos distribuido usando Step Functions.',
    objective: 'Praticar Saga orquestrada, transacoes compensatorias e arquitetura orientada a eventos.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Projetar a State Machine Saga',
        instruction: 'Crie uma state machine Step Functions implementando o padrao Saga para um pedido: Reservar Estoque -> Cobrar Pagamento -> Confirmar Pedido, com transacoes compensatorias em caso de falha.',
        hints: ['Cada passo deve ter uma transacao compensatoria (rollback)', 'Use blocos Catch para acionar compensacao', 'Step Functions Standard para historico de auditoria'],
        solution: '```bash\naws stepfunctions create-state-machine \\\n  --name PedidoSaga \\\n  --type STANDARD \\\n  --role-arn arn:aws:iam::CONTA:role/StepFunctionsRole \\\n  --definition \'{\n  "StartAt": "ReservarEstoque",\n  "States": {\n    "ReservarEstoque": {\n      "Type": "Task",\n      "Resource": "arn:aws:lambda:us-east-1:CONTA:function:ReservarEstoque",\n      "Next": "CobrarPagamento",\n      "Catch": [{"ErrorEquals":["States.ALL"],"Next":"SagaFalhou","ResultPath":"$.error"}]\n    },\n    "CobrarPagamento": {\n      "Type": "Task",\n      "Resource": "arn:aws:lambda:us-east-1:CONTA:function:CobrarPagamento",\n      "Next": "ConfirmarPedido",\n      "Catch": [{"ErrorEquals":["States.ALL"],"Next":"LiberarEstoque","ResultPath":"$.error"}]\n    },\n    "ConfirmarPedido": {\n      "Type": "Task",\n      "Resource": "arn:aws:lambda:us-east-1:CONTA:function:ConfirmarPedido",\n      "End": true\n    },\n    "LiberarEstoque": {\n      "Type": "Task",\n      "Resource": "arn:aws:lambda:us-east-1:CONTA:function:LiberarEstoque",\n      "Next": "SagaFalhou"\n    },\n    "SagaFalhou": {"Type": "Fail", "Error": "PedidoSagaFalhou"}\n  }\n}\'\n```',
        verify: '```bash\naws stepfunctions describe-state-machine \\\n  --state-machine-arn arn:aws:states:us-east-1:CONTA:stateMachine:PedidoSaga\n# Esperado: status = ACTIVE\n\naws stepfunctions start-execution \\\n  --state-machine-arn arn:aws:states:us-east-1:CONTA:stateMachine:PedidoSaga \\\n  --input \'{"pedidoId":"123","valor":99.99,"produtoId":"p-456"}\'\n# Monitore a execucao no console para transicoes de estado\n```'
      },
      {
        title: 'Implementar Strangler Fig com API Gateway',
        instruction: 'Crie rotas API Gateway que gradualmente desviam trafego do monolito para um novo microsservico usando roteamento baseado em caminho.',
        hints: ['Roteie /v2/pedidos para novo microsservico Lambda', 'Roteie /v1/pedidos para integracao com monolito existente', 'Pode usar target groups ponderados ALB para roteamento por porcentagem'],
        solution: '```bash\n# Criar HTTP API Gateway\naws apigatewayv2 create-api \\\n  --name StranglerFigAPI \\\n  --protocol-type HTTP\n\n# Rotear novo caminho para microsservico\naws apigatewayv2 create-route \\\n  --api-id API_ID \\\n  --route-key "POST /v2/pedidos" \\\n  --target integrations/NOVA_INTEGRACAO_ID\n\n# Rotear caminho legado para monolito\naws apigatewayv2 create-route \\\n  --api-id API_ID \\\n  --route-key "POST /v1/pedidos" \\\n  --target integrations/MONOLITO_INTEGRACAO_ID\n```',
        verify: '```bash\naws apigatewayv2 get-routes --api-id API_ID\n# Esperado: POST /v1/pedidos (monolito) e POST /v2/pedidos (microsservico)\n\n# Testar roteamento\ncurl -X POST https://API_ID.execute-api.us-east-1.amazonaws.com/v2/pedidos \\\n  -d \'{"produtoId":"p-123"}\'\n# Esperado: resposta do novo microsservico Lambda\n```'
      },
      {
        title: 'Implementar CQRS com DynamoDB Streams',
        instruction: 'Configure CQRS usando DynamoDB como store de escrita e um Lambda que atualiza um modelo de leitura ElastiCache a partir de DynamoDB Streams.',
        hints: ['DynamoDB Streams captura todas as mudancas', 'Lambda processa eventos do stream para atualizar modelo de leitura', 'ElastiCache fornece acesso de leitura rapido'],
        solution: '```bash\n# Habilitar DynamoDB Streams na tabela de escrita\naws dynamodb update-table \\\n  --table-name Pedidos \\\n  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES\n\n# Criar Lambda para processar stream -> atualizar modelo de leitura\naws lambda create-event-source-mapping \\\n  --function-name AtualizarModeloLeitura \\\n  --event-source-arn arn:aws:dynamodb:us-east-1:CONTA:table/Pedidos/stream/... \\\n  --batch-size 10 \\\n  --starting-position LATEST\n\n# Lambda AtualizarModeloLeitura le do stream\n# e atualiza ElastiCache com view agregada\n```',
        verify: '```bash\naws dynamodb describe-table --table-name Pedidos \\\n  --query "Table.StreamSpecification"\n# Esperado: StreamEnabled = true, StreamViewType = NEW_AND_OLD_IMAGES\n\naws lambda list-event-source-mappings \\\n  --function-name AtualizarModeloLeitura\n# Esperado: mapeamento de stream DynamoDB com state Enabled\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Saga Falhando Sem Acionar Compensacao',
      difficulty: 'hard',
      symptom: 'Step Functions Saga falha no passo de pagamento mas o estoque nunca e liberado. Sistema fica em estado inconsistente com estoque reservado e sem pedido.',
      diagnosis: '```\nChecklist de compensacao Saga:\n1. Verificar definicao da State Machine:\n   Cada estado precisa de bloco Catch que aciona compensacao\n   Se Catch esta ausente -> falha se propaga sem compensacao\n\n2. Historico de execucao Step Functions:\n   aws stepfunctions get-execution-history \\\n     --execution-arn ARN_EXECUCAO\n   Procurar eventos TaskFailed e o que acontece depois\n\n3. Erros na Lambda compensatoria:\n   Se Lambda de compensacao (LiberarEstoque) tambem falha:\n   -> Precisar de logica de retry nos estados compensatorios\n   -> Logar falhas de compensacao em DLQ ou alertas\n\n4. Idempotencia:\n   Transacoes compensatorias DEVEM ser idempotentes\n   Multiplas retentativas de LiberarEstoque devem ser seguras\n\n5. ResultPath no Catch:\n   ResultPath="$.error" preserva o input original\n   Sem ele, o erro substitui o contexto de input\n```',
      solution: 'Adicione blocos Catch a cada estado de task que deve acionar compensacao. Verifique que os estados compensatorios sao alcancaveis e nao falham silenciosamente. Torne Lambdas compensatorias idempotentes (use pedidoId para deduplicacao). Adicione logica de retry aos passos de compensacao. Considere um passo final "Saga Log" que registra o resultado final em um sistema de monitoramento.'
    },
    {
      title: 'Modelo de Leitura CQRS Fora de Sincronia com Modelo de Escrita',
      difficulty: 'medium',
      symptom: 'Usuarios veem dados desatualizados na aplicacao. Pedidos feitos 30 segundos atras ainda aparecem como "Pendente" apesar de confirmados no banco de escrita.',
      diagnosis: '```\nChecklist de lag de consistencia eventual CQRS:\n1. Atraso no processamento DynamoDB Streams:\n   Verificar metricas Lambda: Iterator Age\n   Se Iterator Age > limiar: Lambda esta atrasado no processamento do stream\n   aws cloudwatch get-metric-statistics \\\n     --namespace AWS/Lambda \\\n     --metric-name IteratorAge \\\n     --dimensions Name=FunctionName,Value=AtualizarModeloLeitura\n\n2. Erros Lambda no processamento do stream:\n   aws logs filter-log-events \\\n     --log-group-name /aws/lambda/AtualizarModeloLeitura \\\n     --filter-pattern "ERROR"\n   Erros causam retentativa do Lambda, aumentando lag\n\n3. Throttling:\n   Throttling de escrita no ElastiCache\n   Limites de concorrencia Lambda\n\n4. Comportamento esperado vs bug:\n   CQRS e eventualmente consistente por design\n   Se lag tipicamente < 1 segundo mas agora 30s -> problema de processamento\n   Se lag e sempre 30s -> problema de design (processamento excessivo)\n\n5. TTL do cache do modelo de leitura:\n   Se TTL do ElastiCache e 30s, mesmo modelo de leitura atualizado\n   pode retornar resposta em cache desatualizada\n```',
      solution: 'Verifique a metrica IteratorAge do Lambda no CloudWatch para ver quao atrasado esta o processamento do stream. Verifique logs da funcao Lambda por erros. Garanta que Lambda processe eventos DynamoDB Streams sem erros. Considere SQS DLQ para eventos de stream com falha. Revise configuracoes de TTL do ElastiCache — reduza para dados mais frescos. Defina expectativa do usuario adequadamente para cenarios de consistencia eventual.'
    }
  ]
};
