window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-data/relational-nosql'] = {
  theory: `# Design de Soluções de Dados: Relacional & NoSQL (AZ-305)

## Relevância no Exame
> Peso estimado **25-30%** no AZ-305. O exame avalia a escolha correta entre serviços de dados para diferentes requisitos de consistência, escala e modelo de acesso.

## Serviços Relacionais Azure

### Azure SQL Database
PaaS gerenciado para SQL Server:
- **Single Database**: banco isolado com recursos dedicados ou serverless
- **Elastic Pool**: múltiplos bancos compartilham recursos (bom para SaaS multi-tenant)
- **Managed Instance**: máxima compatibilidade com SQL Server on-premises (lift-and-shift)
- **SQL Server on VM** (IaaS): controle total, todas as features do SQL Server

**Camadas de serviço:**
| Tier | Uso | Storage Max | IOPS |
|------|-----|------------|------|
| **Basic/Standard (DTU)** | Workloads pequenas/médias | 250 GB | — |
| **General Purpose (vCore)** | Balanceado | 4 TB | Moderado |
| **Business Critical (vCore)** | Alta performance, Always On | 4 TB | Alta |
| **Hyperscale (vCore)** | Escala massiva | 100 TB | Alta |
| **Serverless** | Uso intermitente | 4 TB | Auto-pause |

**Alta Disponibilidade:**
- **Active Geo-Replication**: réplicas legíveis em outras regiões
- **Auto-failover groups**: failover automático com endpoint único (listener)
- **Zone Redundant**: réplicas em Availability Zones (Business Critical/General Purpose)

### Azure Database for PostgreSQL / MySQL
PaaS gerenciado para PostgreSQL e MySQL open-source:
- **Flexible Server**: mais controle, zonas de disponibilidade, maintenance window
- Backup automático (1-35 dias de retenção)
- Scale compute sem downtime (para Flexible Server)

### Azure Synapse Analytics
Data warehouse + analytics:
- **Dedicated SQL Pools**: DWU (Data Warehouse Units) para analytics de alta performance
- **Serverless SQL Pool**: query pay-per-query sem provisioning
- **Spark Pools**: processamento big data com Apache Spark
- Integração com Data Lake Storage Gen2

## Serviços NoSQL Azure

### Azure Cosmos DB
Banco de dados NoSQL multimodelo, distribuído globalmente:
- **APIs**: Core (SQL), MongoDB, Cassandra, Gremlin (graph), Table
- **Global Distribution**: replicas em qualquer região, sub-10ms latência
- **Consistency levels** (5 níveis):

| Level | Garantia | Performance |
|-------|----------|------------|
| **Strong** | Leitura sempre reflete última escrita | Mais lenta, maior custo |
| **Bounded Staleness** | Atraso máximo definido | Balanceado |
| **Session** | Consistente para o mesmo client (padrão) | Boa performance |
| **Consistent Prefix** | Leituras nunca veem out-of-order | Boa performance |
| **Eventual** | Sem garantia de ordem, mais rápida | Melhor performance |

**Modelo de capacidade:**
- **Provisioned throughput**: RU/s reservados (Ru = Request Unit)
- **Autoscale**: escala entre min e max RU/s automaticamente
- **Serverless**: paga por RU consumido (para workloads irregulares)

**Particionamento:**
- Partition key define como dados são distribuídos
- Escolha boa partition key: alta cardinalidade, distribuição uniforme, usada em queries

### Azure Table Storage (vs Cosmos DB Table API)
- **Azure Table Storage**: key-value simples, custo muito baixo
- **Cosmos DB Table API**: mesma API + escala global + SLAs mais fortes

### Azure Cache for Redis
Cache em memória, sessões, filas de mensagens:
- **Tiers**: Basic (sem SLA), Standard (replica + SLA), Premium (clustering, geo-replication)
- Use para: session state, cache de queries frequentes, leaderboards, pub/sub

## Matriz de Decisão de Serviços

\`\`\`
Precisa de SQL/relacional?
  ├─ SIM → SQL Server on-prem (lift-and-shift) → Managed Instance
  │         Novo projeto relacional simples → Azure SQL Database
  │         Dados massivos (>4TB), analytics → Hyperscale ou Synapse
  │         Open source? → PostgreSQL/MySQL Flexible Server
  │
  └─ NÃO → Que tipo de dados?
            ├─ Documentos JSON → Cosmos DB (Core SQL ou MongoDB API)
            ├─ Grafo → Cosmos DB Gremlin
            ├─ Colunar (Cassandra-like) → Cosmos DB Cassandra
            ├─ Chave-valor simples, custo baixo → Table Storage
            ├─ Cache/sessão → Redis Cache
            └─ Big data analytics → Synapse Analytics / Databricks
\`\`\`

## Erros Comuns de Design

1. **Cosmos DB para todos os casos**: Cosmos DB é poderoso mas caro — para workloads relacionais simples, Azure SQL é mais adequado e barato.
2. **Consistency Strong em Cosmos DB multi-região**: Strong consistency desabilita leitura em réplicas secundárias (volta para single-region behavior).
3. **Partition key com baixa cardinalidade**: partition key como "país" em escala global resulta em hot partitions (ex: EUA = 80% dos dados).
4. **DTU vs vCore**: DTUs são uma abstração que dificulta comparação; vCore é preferível para workloads previsíveis e mais transparente.

## Killer.sh Style Challenge (AZ-305)

> **Cenário**: Um e-commerce global tem:
> - Catálogo de produtos: 10M items, leitura intensiva, eventual consistency ok
> - Pedidos: consistência crítica, relacional, ACID compliant
> - Carrinho de compras: acesso por sessão, dados temporários, alta velocidade
> - Analytics de vendas: queries complexas sobre TB de dados históricos
>
> **Qual serviço para cada componente?**
>
> **Resposta**:
> - Catálogo: **Cosmos DB** (Core SQL ou MongoDB API) com Eventual consistency, partitioned by productCategory
> - Pedidos: **Azure SQL Database** Business Critical (ACID, alta disponibilidade com failover groups)
> - Carrinho: **Azure Cache for Redis** (Standard tier, in-memory, sessão por usuário)
> - Analytics: **Azure Synapse Analytics** com Dedicated SQL Pool ou Serverless SQL Pool
`,

  quiz: [
    {
      question: 'Uma aplicação de e-commerce global precisa de latência < 10ms para leitura do catálogo de produtos em qualquer região do mundo. Qual serviço de banco de dados Azure é mais adequado?',
      options: [
        'Azure SQL Database com Active Geo-Replication',
        'Azure Cosmos DB com distribuição global e Eventual consistency',
        'Azure Table Storage em múltiplas regiões',
        'Azure Database for MySQL com réplicas de leitura'
      ],
      correct: 1,
      explanation: 'Azure Cosmos DB é projetado para distribuição global com latência garantida de <10ms para leituras/escritas em qualquer região. Com Eventual consistency, oferece melhor performance para leitura de catálogo (dados que raramente mudam). Azure SQL com geo-replication tem latência de rede normal (não sub-10ms garantidos) e é mais adequado para dados relacionais críticos.',
      reference: 'Cosmos DB = latência sub-10ms garantida globalmente. Ideal para: catálogos, perfis de usuário, dados de leitura intensiva com distribuição global.'
    },
    {
      question: 'Qual nível de consistência do Cosmos DB garante que um cliente sempre veja suas próprias escritas, mas não necessariamente as escritas de outros clientes?',
      options: [
        'Strong',
        'Eventual',
        'Session',
        'Bounded Staleness'
      ],
      correct: 2,
      explanation: 'Session consistency garante que dentro de uma sessão de cliente, as leituras sempre refletem as escritas da mesma sessão (read-your-own-writes). É o nível padrão no Cosmos DB e oferece boa performance. Strong garante que todos os clientes veem a última escrita (mais lento). Eventual não garante nada sobre ordem ou freshness.',
      reference: 'Session = padrão Cosmos DB = garante que você vê suas próprias escritas. Ideal para aplicações de usuário onde cada cliente precisa de consistência de suas próprias ações.'
    },
    {
      question: 'Quando escolher Azure SQL Managed Instance em vez de Azure SQL Database?',
      options: [
        'Quando você precisa de baixíssimo custo',
        'Quando está migrando SQL Server on-premises com máxima compatibilidade (SQL Agent, linked servers, CLR)',
        'Quando precisa de distribuição global multi-região',
        'Para workloads de machine learning'
      ],
      correct: 1,
      explanation: 'Managed Instance oferece ~100% de compatibilidade com SQL Server on-premises, suportando features que o Azure SQL Database não suporta: SQL Agent, linked servers, CLR, database mail, service broker, etc. É ideal para lift-and-shift de aplicações que dependem dessas features. Azure SQL Database é mais limitado mas mais gerenciado e escalável.',
      reference: 'Managed Instance = lift-and-shift de SQL Server (máxima compatibilidade). Azure SQL Database = novo desenvolvimento cloud-native. VM SQL Server = controle total, mais gerenciamento.'
    },
    {
      question: 'O que é uma "Request Unit" (RU) no Azure Cosmos DB?',
      options: [
        'Uma métrica de latência de leitura em milissegundos',
        'A moeda de throughput no Cosmos DB que abstrai CPU, memória e IOPS necessários para uma operação',
        'O número de replicas globais ativas',
        'A unidade de armazenamento por documento'
      ],
      correct: 1,
      explanation: 'RU (Request Unit) é a moeda de throughput do Cosmos DB — uma abstração que combina CPU, memória e IOPS consumidos por uma operação. Uma leitura de 1KB de documento custa ~1 RU. Escritas custam ~5 RUs. Queries complexas custam mais. Você provisiona RU/s para garantir throughput ou usa serverless para pagar por RU consumida.',
      reference: 'RU = custo de operação no Cosmos DB. 1 leitura de 1KB ≈ 1 RU. Provisione RU/s para workloads previsíveis, serverless para irregulares.'
    }
  ],

  flashcards: [
    {
      front: 'Qual serviço de banco de dados Azure escolher para cada cenário?',
      back: '| Cenário | Serviço |\n|---------|--------|\n| SQL Server lift-and-shift | Managed Instance |\n| Novo app relacional cloud | Azure SQL Database |\n| PostgreSQL/MySQL open source | Flexible Server |\n| NoSQL global, baixa latência | Cosmos DB |\n| Cache de sessão/queries | Azure Cache for Redis |\n| Analytics de TB de dados | Synapse Analytics |\n| Big Data com Spark | Synapse Spark / Databricks |\n| Key-value simples, custo mínimo | Azure Table Storage |'
    },
    {
      front: 'Quais são os 5 níveis de consistência do Cosmos DB e suas trade-offs?',
      back: '**Strong** → sempre vê última escrita, mais lento, caro, sem réplicas secundárias leitura\n\n**Bounded Staleness** → atraso máximo definido (X updates ou T segundos)\n\n**Session** (padrão) → você vê suas próprias escritas, outros têm eventual\n\n**Consistent Prefix** → nunca vê escritas fora de ordem, mas pode ser atrasado\n\n**Eventual** → mais rápido, sem garantias de ordem ou freshness\n\nTradeoff: mais consistência = maior latência + menor disponibilidade de réplicas.'
    },
    {
      front: 'Quais são as diferenças entre Azure SQL Database, Elastic Pool e Managed Instance?',
      back: '**Azure SQL Database** (Single):\n- Um banco isolado\n- Serverless ou provisioned\n- Escala compute independente\n\n**Elastic Pool**:\n- Múltiplos bancos compartilham RU pool\n- Ideal para SaaS multi-tenant com uso irregular\n- Mais econômico quando bancos têm picos em horários diferentes\n\n**Managed Instance**:\n- Máxima compatibilidade SQL Server\n- VNet isolated\n- SQL Agent, linked servers, CLR\n- Lift-and-shift de apps on-premises'
    }
  ],

  lab: {
    scenario: 'Compare Azure SQL Database e Cosmos DB criando uma instância de cada e entendendo as diferenças de modelo.',
    objective: 'Criar Azure SQL Database serverless e Cosmos DB serverless, explorar diferenças de modelo de dados.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Criar Azure SQL Database (Serverless)',
        instruction: 'Crie um SQL Server e um banco de dados serverless para desenvolvimento.',
        hints: ['\`az sql server create\` depois \`az sql db create --edition GeneralPurpose --compute-model Serverless\`'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-data-lab --location eastus

# Criar SQL Server
az sql server create \\
  --name "technova-sqlsrv-\${SUFFIX}" \\
  --resource-group rg-data-lab \\
  --location eastus \\
  --admin-user sqladmin \\
  --admin-password "P@ssword123!"

# Criar banco de dados serverless (auto-pause após 1h de inatividade)
az sql db create \\
  --server "technova-sqlsrv-\${SUFFIX}" \\
  --resource-group rg-data-lab \\
  --name technovadb \\
  --edition GeneralPurpose \\
  --compute-model Serverless \\
  --family Gen5 \\
  --capacity 2 \\
  --auto-pause-delay 60

echo "SQL Server: technova-sqlsrv-\${SUFFIX}.database.windows.net"
echo "SUFFIX=\${SUFFIX}" > /tmp/datalab.sh
\`\`\``,
        verify: `\`\`\`bash
source /tmp/datalab.sh
az sql db show \\
  --server "technova-sqlsrv-\${SUFFIX}" \\
  --resource-group rg-data-lab \\
  --name technovadb \\
  --query "{Nome:name,Edicao:edition,Modelo:currentServiceObjectiveName}" -o table
\`\`\``
      },
      {
        title: 'Criar Cosmos DB (Serverless)',
        instruction: 'Crie um Cosmos DB com API Core SQL no modo Serverless.',
        hints: ['\`az cosmosdb create\` com \`--capabilities EnableServerless\`'],
        solution: `\`\`\`bash
source /tmp/datalab.sh

# Criar Cosmos DB Account (Serverless)
az cosmosdb create \\
  --name "technova-cosmos-\${SUFFIX}" \\
  --resource-group rg-data-lab \\
  --locations regionName=eastus \\
  --capabilities EnableServerless \\
  --default-consistency-level Session

# Criar database e container
az cosmosdb sql database create \\
  --account-name "technova-cosmos-\${SUFFIX}" \\
  --resource-group rg-data-lab \\
  --name catalogdb

az cosmosdb sql container create \\
  --account-name "technova-cosmos-\${SUFFIX}" \\
  --resource-group rg-data-lab \\
  --database-name catalogdb \\
  --name products \\
  --partition-key-path "/category"

echo "Cosmos DB criado: technova-cosmos-\${SUFFIX}"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/datalab.sh
az cosmosdb show \\
  --name "technova-cosmos-\${SUFFIX}" \\
  --resource-group rg-data-lab \\
  --query "{Nome:name,Consistencia:consistencyPolicy.defaultConsistencyLevel,Status:provisioningState}" -o table
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group (vai deletar SQL Server, banco e Cosmos DB).',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-data-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-data-lab 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Cosmos DB com alta latência em leituras de uma região específica',
      difficulty: 'medium',
      symptom: 'Uma aplicação global no Cosmos DB usa Strong consistency. Usuários na Ásia reportam latência de 200ms+ em leituras, mesmo com uma réplica na região asiática.',
      diagnosis: `\`\`\`bash
# Verificar configuração de consistência
az cosmosdb show \\
  --name myCosmosDB --resource-group myRG \\
  --query "{Consistencia:consistencyPolicy.defaultConsistencyLevel,Regioes:locations[].locationName}" -o json
\`\`\``,
      solution: `**Causa**: Strong consistency no Cosmos DB multi-região força leituras a serem sincronizadas com a região de escrita (quórum global). A réplica na Ásia responde só após confirmação da escrita na região primária — causando latência de ida e volta inter-regional.

**Solução 1**: Reduzir nível de consistência:
\`\`\`bash
az cosmosdb update \\
  --name myCosmosDB --resource-group myRG \\
  --default-consistency-level Session
\`\`\`

**Solução 2**: Se Strong é obrigatório, configurar região de escrita mais próxima dos usuários asiáticos (multi-master write) — mas isso tem outras implicações de conflito.

**Guideline de consistência**: use Strong apenas quando absolutamente necessário (ex: transações financeiras). Para a maioria dos casos, Session ou Bounded Staleness são suficientes com melhor performance.`
    }
  ]
};
