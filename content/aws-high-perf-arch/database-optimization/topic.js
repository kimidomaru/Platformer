window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-high-perf-arch/database-optimization'] = {
  theory: `# Database Selection & Optimization

## Relevancia no Exame
> **Design High-Performing Architectures** vale **24%** do SAA-C03. Escolha do banco correto, read replicas, padroes de caching e bancos purpose-built sao frequentes.

## Amazon RDS

### Multi-AZ vs Read Replicas

| Feature | Multi-AZ | Read Replicas |
|---------|----------|---------------|
| **Proposito** | HA (failover) | Performance (read scaling) |
| **Replicacao** | Sincrona | Assincrona |
| **Failover** | Auto (~60s) | Promocao manual |
| **Legivel** | Nao | Sim |
| **Cross-Region** | Nao | Sim |
| **Maximo** | 1 standby | 5 por instancia |

## Amazon Aurora

| Feature | RDS | Aurora |
|---------|-----|--------|
| **Storage** | EBS, scaling manual | Auto-scaling ate 128 TB |
| **Replicas** | Ate 5, failover em segundos | Ate 15, failover em ms |
| **Serverless** | Nao | Serverless v2 (0.5-128 ACU) |
| **Global** | Read replicas cross-Region | Global Database (<1s replicacao) |
| **Backtrack** | Nao | Sim (rebobinar ate 72h) |
| **Cloning** | Snapshot + restore (lento) | Copy-on-write (rapido) |

## Amazon DynamoDB

### Design de Partition Key
- Escolha **alta cardinalidade** (userId, orderId) para distribuicao uniforme
- Sort Key habilita range queries dentro de uma particao

### Indexes GSI vs LSI

| Tipo | GSI | LSI |
|------|-----|-----|
| **Partition Key** | Diferente da tabela | Mesmo da tabela |
| **Criacao** | A qualquer momento | Somente na criacao da tabela |
| **Consistencia** | Eventually consistent apenas | Strong ou eventual |
| **Capacidade** | Propria | Compartilha da tabela |

### Modos de Capacidade
- **On-Demand**: pague por request, sem planejamento, bom para imprevisivel
- **Provisioned**: especifique RCU/WCU, mais barato para carga constante
- **Auto-Scaling**: ajusta provisioned baseado em utilizacao

### Features DynamoDB
- **Streams**: captura mudancas em itens (24h retencao), trigger Lambda
- **TTL**: auto-delete itens expirados (sem custo extra)
- **DAX**: cache in-VPC, leituras microsegundos, write-through, API-compativel
- **Global Tables**: multi-Region, multi-active

## Padroes ElastiCache

### Lazy Loading (Cache-Aside)
1. App verifica cache primeiro
2. Cache miss -> le do DB -> grava no cache
3. Pros: so cacheia dados requisitados. Cons: penalidade no miss, dados stale

### Write-Through
1. App grava no cache E no DB simultaneamente
2. Pros: cache sempre atualizado. Cons: latencia de escrita, dados nao usados cacheados

## Bancos Purpose-Built

| Banco | Tipo | Caso de Uso |
|-------|------|-------------|
| **RDS/Aurora** | Relacional | Transacoes, queries complexas, ACID |
| **DynamoDB** | Key-value/Document | Alta escala, baixa latencia |
| **Redshift** | Columnar warehouse | Analytics, BI, OLAP petabyte |
| **Neptune** | Grafo | Redes sociais, fraude, recomendacoes |
| **DocumentDB** | Document (MongoDB) | Catalogos, perfis de usuario |
| **Timestream** | Time series | IoT, metricas DevOps |
| **QLDB** | Ledger | Transacoes financeiras, auditoria imutavel |
| **MemoryDB** | In-memory (Redis) | Workloads duraveis microsegundos |

## Erros Comuns

- Escolher RDS quando Aurora fornece melhor HA (15 replicas, ms failover)
- Usar GSI quando LSI e necessario (LSI deve ser criado na criacao da tabela)
- Esquecer modo on-demand do DynamoDB para workloads imprevisiveis
- Nao usar DAX para DynamoDB read-heavy (latencia microsegundos)
- Usar RDS para analytics em vez de Redshift (OLTP vs OLAP)
`,

  quiz: [
    {
      question: 'Quantas read replicas o Aurora suporta vs RDS padrao?',
      options: ['Aurora: 5, RDS: 15', 'Aurora: 15 com failover em ms, RDS: 5 com failover em segundos', 'Ambos suportam 15', 'Ambos suportam 5'],
      correct: 1,
      explanation: 'Aurora suporta ate 15 replicas com failover em milissegundos (storage compartilhado). RDS padrao suporta ate 5 replicas com failover em segundos.',
      reference: 'Aurora: 15 replicas, ms failover. RDS: 5 replicas, segundos failover, replicacao async.'
    },
    {
      question: 'Qual a diferenca entre DynamoDB GSI e LSI?',
      options: ['GSI e mais rapido que LSI', 'GSI pode ser criado a qualquer momento com partition key diferente; LSI deve ser criado na criacao da tabela com mesmo partition key', 'LSI suporta apenas eventual consistency', 'GSI compartilha capacidade da tabela'],
      correct: 1,
      explanation: 'GSI: partition key diferente, criado a qualquer momento, eventually consistent apenas, capacidade propria. LSI: mesmo partition key, criado na criacao apenas, suporta strong consistency.',
      reference: 'GSI = flexivel, qualquer momento, eventual apenas. LSI = mesmo partition, na criacao, strong consistency.'
    },
    {
      question: 'Qual banco escolher para analytics em tempo real sobre petabytes de dados?',
      options: ['RDS MySQL', 'DynamoDB', 'Amazon Redshift', 'Amazon Neptune'],
      correct: 2,
      explanation: 'Redshift e um data warehouse columnar projetado para analytics OLAP em escala petabyte. RDS/Aurora sao para OLTP. DynamoDB e key-value. Neptune e grafo.',
      reference: 'Redshift = analytics OLAP. RDS/Aurora = transacoes OLTP. DynamoDB = key-value scale.'
    },
    {
      question: 'Qual padrao de cache garante que o cache esta sempre atualizado?',
      options: ['Lazy Loading', 'Write-Through', 'Cache-Aside', 'Read-Through'],
      correct: 1,
      explanation: 'Write-Through grava no cache E no banco simultaneamente. Cache sempre atualizado. Tradeoff: latencia de escrita aumenta e dados nao usados podem ser cacheados.',
      reference: 'Write-Through = sempre atualizado. Lazy Loading = stale possivel mas so cacheia o que e lido.'
    },
    {
      question: 'Quando usar modo on-demand do DynamoDB?',
      options: ['Para workloads de producao constantes', 'Para trafego imprevisivel ou com picos', 'Quando precisa do menor custo', 'Apenas para batch processing'],
      correct: 1,
      explanation: 'On-demand: sem planejamento de capacidade, escala instantaneamente, pague por request. Melhor para tabelas novas, trafego imprevisivel ou com picos.',
      reference: 'On-demand = imprevisivel/picos. Provisioned = constante (mais barato). Auto-scaling = meio termo.'
    },
    {
      question: 'O que o Aurora Backtrack faz?',
      options: ['Cria backup snapshot', 'Rebobina o banco para qualquer ponto em ate 72 horas sem criar um restore', 'Replica para outra Region', 'Migra de RDS para Aurora'],
      correct: 1,
      explanation: 'Backtrack rebobina o Aurora para um ponto especifico (ate 72 horas) sem criar nova instancia. Muito mais rapido que restore de snapshot. Apenas Aurora MySQL.',
      reference: 'Backtrack = rebobinar in-place (segundos). Restore de snapshot = nova instancia (minutos/horas).'
    },
    {
      question: 'Qual banco e melhor para queries de relacionamento em redes sociais?',
      options: ['DynamoDB', 'Amazon Neptune', 'Amazon Redshift', 'RDS PostgreSQL'],
      correct: 1,
      explanation: 'Neptune e um banco de grafos otimizado para queries de relacionamento (amigos, recomendacoes, deteccao de fraude). Suporta Gremlin e SPARQL.',
      reference: 'Neptune = grafo (relacionamentos). DynamoDB = key-value. Redshift = analytics. RDS = relacional.'
    },
    {
      question: 'O que e DynamoDB DAX e como ajuda?',
      options: ['Uma ferramenta de backup', 'Um cache write-through in-VPC fornecendo latencia de leitura em microsegundos, API-compativel com DynamoDB', 'Uma ferramenta de migracao', 'Um dashboard de monitoramento'],
      correct: 1,
      explanation: 'DAX: cache in-VPC para DynamoDB. Leituras em microsegundos. Write-through. API-compativel (drop-in, sem mudancas de codigo necessarias).',
      reference: 'DAX = leituras microsegundos, API-compativel, write-through. Para workloads DynamoDB read-heavy.'
    }
  ],

  flashcards: [
    { front: 'Aurora vs RDS diferencas-chave?', back: 'Aurora: storage auto-scaling ate 128TB, 15 replicas (ms failover), storage compartilhado, Serverless v2, Global Database (<1s), Backtrack (72h), Cloning rapido. RDS: EBS-based, 5 replicas, replicacao async.' },
    { front: 'DynamoDB GSI vs LSI?', back: 'GSI: partition key diferente, criar a qualquer momento, eventually consistent apenas, capacidade propria. LSI: mesmo partition key, criar na CRIACAO da tabela apenas, suporta strong consistency, compartilha capacidade.' },
    { front: 'Modos de capacidade DynamoDB?', back: 'On-Demand: pague por request, sem planejamento, scaling instantaneo (imprevisivel). Provisioned: especifique RCU/WCU, mais barato constante. Auto-Scaling: ajusta provisioned por utilizacao.' },
    { front: 'Padroes ElastiCache?', back: 'Lazy Loading: verifica cache, miss->DB->cache (stale possivel, so cacheia o que e lido). Write-Through: grava cache+DB junto (sempre atual, latencia escrita). Session Store: servidores stateless.' },
    { front: 'Bancos purpose-built?', back: 'RDS/Aurora: relacional OLTP. DynamoDB: key-value escala. Redshift: columnar OLAP. Neptune: grafo. DocumentDB: MongoDB. Timestream: time series. QLDB: ledger. MemoryDB: Redis duravel.' },
    { front: 'O que e Aurora Backtrack?', back: 'Rebobinar Aurora para qualquer ponto em ate 72 horas SEM criar nova instancia. Rebobinagem in-place em segundos. Muito mais rapido que restore de snapshot. Apenas Aurora MySQL.' },
    { front: 'Design de partition key DynamoDB?', back: 'Escolha chaves de ALTA CARDINALIDADE (userId, orderId) para distribuicao uniforme. Evite hot partitions. Sort key permite range queries dentro da particao.' },
    { front: 'O que e DynamoDB DAX?', back: 'Cache write-through in-VPC. Leituras microsegundos (vs ms do DynamoDB). API-compativel (drop-in). Ideal para workloads read-heavy, sensiveis a latencia. NAO ajuda com escritas.' }
  ],

  lab: {
    scenario: 'Projete uma arquitetura de banco de dados para plataforma e-commerce.',
    objective: 'Praticar selecao de banco, estrategia de caching e configuracao de read replicas.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Cluster Aurora com Read Replica',
        instruction: 'Crie um cluster Aurora PostgreSQL com 1 writer e 1 reader para read scaling.',
        hints: ['Aurora cluster tem writer endpoint e reader endpoint', 'Reader endpoint faz load-balance entre todas as replicas'],
        solution: '```bash\n# Criar cluster Aurora\naws rds create-db-cluster --db-cluster-identifier ecommerce-db \\\n  --engine aurora-postgresql --engine-version 15.4 \\\n  --master-username admin --master-user-password MyP@ss123 \\\n  --db-subnet-group-name my-subnet-group\n\n# Criar instancia writer\naws rds create-db-instance --db-instance-identifier ecommerce-writer \\\n  --db-cluster-identifier ecommerce-db \\\n  --db-instance-class db.r6g.large --engine aurora-postgresql\n\n# Criar instancia reader\naws rds create-db-instance --db-instance-identifier ecommerce-reader \\\n  --db-cluster-identifier ecommerce-db \\\n  --db-instance-class db.r6g.large --engine aurora-postgresql\n```',
        verify: '```bash\naws rds describe-db-clusters --db-cluster-identifier ecommerce-db \\\n  --query "DBClusters[0].{Writer:Endpoint,Reader:ReaderEndpoint}"\n# Esperado: 2 membros (writer + reader), ambos endpoints disponiveis\n```'
      },
      {
        title: 'Criar Tabela DynamoDB com GSI',
        instruction: 'Crie uma tabela de pedidos com orderId como partition key e GSI em customerId para consultar pedidos por cliente.',
        hints: ['Partition key deve ter alta cardinalidade', 'GSI tem configuracoes de capacidade proprias'],
        solution: '```bash\naws dynamodb create-table --table-name Orders \\\n  --attribute-definitions \\\n    AttributeName=orderId,AttributeType=S \\\n    AttributeName=customerId,AttributeType=S \\\n  --key-schema AttributeName=orderId,KeyType=HASH \\\n  --global-secondary-indexes \\\n    \'[{"IndexName":"customer-index","KeySchema":[{"AttributeName":"customerId","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]\' \\\n  --billing-mode PAY_PER_REQUEST\n```',
        verify: '```bash\naws dynamodb describe-table --table-name Orders \\\n  --query "Table.{Status:TableStatus,GSIs:GlobalSecondaryIndexes[*].IndexName}"\n# Esperado: ACTIVE, GSI customer-index\n```'
      },
      {
        title: 'Escolher Banco Correto para Cada Caso',
        instruction: 'Associe: (1) Deteccao de fraude com queries de relacionamento, (2) Metricas IoT com queries temporais, (3) Catalogo de alta demanda com latencia ms.',
        hints: ['Pense no modelo de dados que cada workload precisa', 'Bancos purpose-built otimizam para padroes de acesso especificos'],
        solution: '```\n1. Deteccao de fraude (relacionamentos) -> Amazon Neptune (grafo)\n   - Atravessa relacionamentos entre entidades\n\n2. Metricas IoT (time series) -> Amazon Timestream\n   - Otimizado para dados ordenados no tempo\n   - Funcoes de agregacao temporal nativas\n\n3. Catalogo de produtos (key-value, baixa latencia) -> DynamoDB + DAX\n   - Schema flexivel para atributos variados\n   - Latencia microsegundos com DAX\n```',
        verify: '```bash\n# Framework de decisao:\n# Relacionamentos -> Neptune (grafo)\n# Time series -> Timestream\n# Key-value em escala -> DynamoDB\n# Relacional/ACID -> RDS/Aurora\n# Analytics/OLAP -> Redshift\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Hot Partition no DynamoDB Causando Throttling',
      difficulty: 'hard',
      symptom: 'Tabela DynamoDB tem capacidade provisionada suficiente mas alguns requests sao throttled.',
      diagnosis: '```\nCausas de hot partition:\n1. Partition key de baixa cardinalidade (ex: data, status)\n   Todo trafego vai para a mesma particao\n\n2. Itens populares: um item recebe reads desproporcionais\n\n3. Acesso desigual: algumas particoes recebem 99% do trafego\n\nDiagnostico:\n  CloudWatch: ConsumedReadCapacityUnits por particao\n  Contributor Insights: identificar hot keys\n```',
      solution: 'Redesenhe partition key para alta cardinalidade (userId, orderId). Adicione sufixo aleatorio para write-heavy (ex: date#rand(1-10)). Use DAX cache para hot reads. Habilite auto-scaling ou mude para on-demand.'
    },
    {
      title: 'Replica Lag do Aurora Afetando Aplicacao',
      difficulty: 'medium',
      symptom: 'Leituras do reader endpoint do Aurora retornam dados stale logo apos writes.',
      diagnosis: '```\nReplicacao Aurora:\n- Usa storage compartilhado (nao replicacao async de log)\n- Lag tipico: <100ms (muito melhor que RDS)\n- Mas still eventually consistent para readers\n\nChecklist:\n1. Verificar replica lag:\n   CloudWatch: AuroraReplicaLag\n   Normal: <20ms, Problema: >100ms consistente\n\n2. Aplicacao fazendo read-after-write que precisa de consistencia?\n\nPara strong consistency apos writes:\n  - Leia do writer endpoint (nao reader)\n```',
      solution: 'Para consistencia read-after-write, leia do writer endpoint imediatamente apos escrever. Para leituras gerais, use reader endpoint (eventually consistent). Se lag e consistentemente alto, verifique tamanho da instancia reader e metricas CloudWatch.'
    }
  ]
};
