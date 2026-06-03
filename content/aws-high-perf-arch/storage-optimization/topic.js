window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-high-perf-arch/storage-optimization'] = {
  theory: `# Storage & Caching Optimization

## Relevancia no Exame
> **Design High-Performing Architectures** vale **24%** do SAA-C03. Classes S3, tipos EBS, file systems compartilhados, caching e CloudFront sao temas centrais.

## Classes de Storage S3

| Classe | Acesso | Duracao Min | Caso de Uso |
|--------|--------|------------|-------------|
| **Standard** | Frequente | Nenhuma | Dados ativos, websites |
| **Standard-IA** | Infrequente | 30 dias | Backups, dados antigos |
| **One Zone-IA** | Infrequente, AZ unica | 30 dias | Dados reproduziveis, 20% mais barato |
| **Intelligent-Tiering** | Auto-tiered | Nenhuma | Padroes de acesso imprevisiveis |
| **Glacier Instant** | Retrieval em ms | 90 dias | Arquivo com acesso instantaneo |
| **Glacier Flexible** | Retrieval 1-12h | 90 dias | Arquivo de longo prazo |
| **Deep Archive** | Retrieval 12-48h | 180 dias | Compliance, retencao 7-10 anos |

### Lifecycle Policies
- **Transition rules**: mover entre classes (Standard -> IA apos 30d -> Glacier apos 90d)
- **Expiration rules**: deletar objetos apos X dias
- **Intelligent-Tiering**: auto-move entre tiers, \\$0.0025/1000 objetos monitoramento, sem taxa de retrieval

### Performance S3
- **Transfer Acceleration**: usa edge locations CloudFront para uploads mais rapidos
- **Multipart Upload**: obrigatorio >5GB, recomendado >100MB, partes paralelas
- **S3 Select**: query in-place com SQL (reduz transfer ate 400%)

## Tipos de Volume EBS

| Tipo | IOPS | Throughput | Caso de Uso |
|------|------|-----------|-------------|
| **gp3** | 3.000 baseline (ate 16.000) | 125 MB/s (ate 1.000) | Workloads gerais (padrao recomendado) |
| **gp2** | 3.000 burst (3 IOPS/GB) | 250 MB/s | General purpose legado |
| **io2 Block Express** | Ate 256.000 | 4.000 MB/s | DBs criticos, latencia sub-ms |
| **st1** (Throughput HDD) | 500 | 500 MB/s | Big data, data warehouses, logs |
| **sc1** (Cold HDD) | 250 | 250 MB/s | Acesso infrequente, menor custo |

**gp3 vs gp2**: gp3 permite config independente de IOPS/throughput. gp3 e 20% mais barato que gp2.

## File Systems Compartilhados

| Servico | Protocolo | Melhor Para |
|---------|-----------|-------------|
| **EFS** | NFS | Storage compartilhado Linux, serverless (Lambda) |
| **FSx for Lustre** | Lustre | HPC, ML training, integracao S3 |
| **FSx for Windows** | SMB | Workloads Windows, Active Directory |
| **FSx for NetApp ONTAP** | NFS/SMB/iSCSI | Multi-protocolo, migracao NetApp |

## Caching

### ElastiCache: Redis vs Memcached

| Feature | Redis | Memcached |
|---------|-------|-----------|
| **Persistencia** | Sim (RDB/AOF) | Nao |
| **Replicacao** | Sim (read replicas) | Nao |
| **Estruturas de dados** | Strings, lists, sets, sorted sets | Key-value simples |
| **Pub/Sub** | Sim | Nao |
| **Multi-threaded** | Nao (single-threaded) | Sim |

### DAX (DynamoDB Accelerator)
- Cache in-VPC para DynamoDB
- Latencia de leitura em microsegundos
- Cache write-through (writes vao para DynamoDB primeiro)
- API-compativel com DynamoDB (drop-in, sem mudancas de codigo)

## CloudFront (CDN)

- **Edge Locations**: 400+ mundialmente, cache proximo dos usuarios
- **OAC**: acesso seguro ao S3 origin (substitui OAI)
- **Lambda@Edge**: codigo nas edge locations
- **CloudFront Functions**: JavaScript leve para transformacoes simples
- **Invalidation**: remover cache (\\$0.005 por path, prefira versionamento)

## Erros Comuns

- Usar gp2 em vez de gp3 (gp3 e mais novo, mais barato)
- Esquecer que Intelligent-Tiering nao tem taxa de retrieval (diferente de IA/Glacier)
- Escolher EFS para Windows (use FSx for Windows)
- Usar Redis quando Memcached e suficiente
`,

  quiz: [
    {
      question: 'Qual classe S3 move objetos automaticamente entre tiers sem taxas de retrieval?',
      options: ['Standard-IA', 'Glacier Instant Retrieval', 'Intelligent-Tiering', 'One Zone-IA'],
      correct: 2,
      explanation: 'Intelligent-Tiering move objetos automaticamente entre tiers Frequent, Infrequent e Archive baseado no acesso. Sem taxas de retrieval. Pequena taxa de monitoramento.',
      reference: 'Intelligent-Tiering = auto-tier, sem retrieval fees. Classes IA tem retrieval fees.'
    },
    {
      question: 'Qual a vantagem do gp3 sobre gp2 para volumes EBS?',
      options: ['gp3 e mais caro mas mais rapido', 'gp3 permite configuracao independente de IOPS/throughput e e 20% mais barato', 'gp2 tem IOPS maximo mais alto', 'gp3 so funciona com Graviton'],
      correct: 1,
      explanation: 'gp3: 3000 IOPS baseline, configure IOPS (ate 16K) e throughput (ate 1000 MB/s) independentemente, 20% mais barato que gp2. gp2 atrela IOPS ao tamanho (3 IOPS/GB).',
      reference: 'gp3 = config independente, mais barato. gp2 = IOPS baseado em tamanho. Prefira gp3.'
    },
    {
      question: 'Quando usar FSx for Lustre?',
      options: ['Compartilhamento de arquivos Windows com AD', 'Acesso multi-protocolo NFS/SMB', 'Computacao de alto desempenho e ML training com integracao S3', 'Compartilhamento Linux simples'],
      correct: 2,
      explanation: 'FSx for Lustre: file system paralelo de alto desempenho para HPC, ML training, processamento de video. Integracao nativa com S3 (lazy loading e write-back).',
      reference: 'Lustre = HPC + S3. Windows = FSx Windows (SMB+AD). Multi-protocolo = FSx NetApp ONTAP.'
    },
    {
      question: 'Qual a diferenca principal entre Redis e Memcached no ElastiCache?',
      options: ['Memcached suporta persistencia, Redis nao', 'Redis suporta persistencia, replicacao e estruturas de dados ricas; Memcached e mais simples e multi-threaded', 'Sao identicos', 'Memcached e mais caro'],
      correct: 1,
      explanation: 'Redis: persistencia (RDB/AOF), replicacao, estruturas de dados (lists, sets, sorted sets), pub/sub. Memcached: key-value simples, multi-threaded, sem persistencia.',
      reference: 'Redis = features ricas, persistencia. Memcached = simples, multi-threaded, volatil.'
    },
    {
      question: 'O que o DAX fornece para DynamoDB?',
      options: ['Backup e restore', 'Latencia de leitura em microsegundos via cache write-through in-VPC', 'Conversao de schema', 'Replicacao cross-Region'],
      correct: 1,
      explanation: 'DAX: cache in-VPC para DynamoDB com latencia de leitura em microsegundos. Cache write-through. API-compativel (drop-in, sem mudancas de codigo).',
      reference: 'DAX = leituras microsegundos, API-compativel com DynamoDB, write-through cache.'
    },
    {
      question: 'O que e CloudFront Origin Access Control (OAC)?',
      options: ['Regra de firewall para CloudFront', 'Protege S3 origin para que apenas CloudFront acesse (substitui OAI)', 'Politica de roteamento DNS', 'Gerenciamento de certificados SSL'],
      correct: 1,
      explanation: 'OAC restringe acesso ao bucket S3 apenas para a distribuicao CloudFront. Previne acesso direto ao S3. OAC substitui o OAI antigo com melhor seguranca.',
      reference: 'OAC = proteger origin S3. Substitui OAI. Bucket policy permite service principal CloudFront.'
    },
    {
      question: 'Qual tipo de volume EBS fornece os maiores IOPS?',
      options: ['gp3 (16.000 IOPS)', 'st1 (500 IOPS)', 'io2 Block Express (256.000 IOPS)', 'sc1 (250 IOPS)'],
      correct: 2,
      explanation: 'io2 Block Express: ate 256.000 IOPS com latencia sub-milissegundo. Para bancos de dados criticos que exigem performance extrema.',
      reference: 'io2 BE = 256K IOPS (DBs criticos). gp3 = 16K IOPS (geral). st1/sc1 = HDD (throughput).'
    },
    {
      question: 'O que e S3 Transfer Acceleration?',
      options: ['Retrieval mais rapido do Glacier', 'Usa edge locations CloudFront para acelerar uploads de usuarios globais', 'Comprime objetos S3', 'Aumenta limites de API S3'],
      correct: 1,
      explanation: 'Transfer Acceleration roteia uploads pela edge location CloudFront mais proxima via rede AWS otimizada. Melhor para usuarios globais fazendo upload para um unico bucket.',
      reference: 'Transfer Acceleration = upload via edge. Multipart = arquivos grandes paralelos. S3 Select = query in-place.'
    }
  ],

  flashcards: [
    { front: 'Classes S3 por frequencia de acesso?', back: 'Standard (frequente), Standard-IA (infrequente, 30d min), One Zone-IA (AZ unica, 20% mais barato), Intelligent-Tiering (auto-tier), Glacier Instant (ms, 90d), Glacier Flexible (1-12h, 90d), Deep Archive (12-48h, 180d).' },
    { front: 'Tipos de volume EBS por caso de uso?', back: 'gp3: geral (3K IOPS, padrao recomendado). io2 BE: DBs criticos (256K IOPS). st1: throughput big data (500 MB/s HDD). sc1: frio infrequente (250 MB/s HDD). gp3 e 20% mais barato que gp2.' },
    { front: 'Opcoes FSx?', back: 'Lustre: HPC/ML + integracao S3. Windows: SMB + AD. NetApp ONTAP: multi-protocolo NFS/SMB/iSCSI. OpenZFS: migracao Linux ZFS. EFS: NFS compartilhado para Linux.' },
    { front: 'Redis vs Memcached?', back: 'Redis: persistencia, replicacao, estruturas de dados (lists/sets/sorted sets), pub/sub, single-threaded. Memcached: key-value simples, multi-threaded, sem persistencia. Redis para features, Memcached para simplicidade.' },
    { front: 'O que e DAX?', back: 'DynamoDB Accelerator: cache in-VPC, leituras microsegundos, write-through. API-compativel com DynamoDB (drop-in, sem mudancas). Ideal para workloads DynamoDB read-heavy.' },
    { front: 'Features de performance S3?', back: 'Transfer Acceleration (uploads via edge). Multipart Upload (paralelo, obrigatorio >5GB). S3 Select (query SQL in-place, reduz transfer 400%). Byte-Range Fetches (downloads paralelos parciais).' },
    { front: 'Features principais CloudFront?', back: '400+ edge locations. Controle TTL. OAC para seguranca S3. Cache/Origin Request policies. Lambda@Edge (codigo completo na edge). CloudFront Functions (JS leve). Invalidation vs versionamento.' },
    { front: 'Lifecycle policies S3?', back: 'Transition: mover entre classes (Standard->IA 30d, ->Glacier 90d, ->Deep Archive 180d). Expiration: auto-delete. Filtro por prefixo/tags/tamanho. Use S3 Analytics para recomendacoes de classe.' }
  ],

  lab: {
    scenario: 'Otimize a arquitetura de storage para uma plataforma de analytics.',
    objective: 'Praticar lifecycle policies S3, selecao de EBS e estrategias de caching.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Configurar S3 Lifecycle Policy',
        instruction: 'Crie uma lifecycle policy que transiciona objetos para Standard-IA apos 30 dias, Glacier Flexible apos 90 dias e deleta apos 365 dias.',
        hints: ['Use aws s3api put-bucket-lifecycle-configuration', 'Dias de transicao sao a partir da criacao do objeto'],
        solution: '```bash\naws s3api put-bucket-lifecycle-configuration \\\n  --bucket my-data-bucket \\\n  --lifecycle-configuration \'{"Rules":[{"ID":"archive-policy","Status":"Enabled","Filter":{"Prefix":"data/"},"Transitions":[{"Days":30,"StorageClass":"STANDARD_IA"},{"Days":90,"StorageClass":"GLACIER"}],"Expiration":{"Days":365}}]}\'\n```',
        verify: '```bash\naws s3api get-bucket-lifecycle-configuration --bucket my-data-bucket\n# Esperado: 1 regra com 2 transicoes (IA em 30d, Glacier em 90d)\n# e expiracao em 365 dias\n```'
      },
      {
        title: 'Escolher Tipo de Volume EBS Correto',
        instruction: 'Uma aplicacao precisa de 10.000 IOPS sustentados. Compare gp3 vs io2 e selecione a opcao mais custo-efetiva.',
        hints: ['gp3 suporta ate 16.000 IOPS', 'io2 e mais caro mas suporta ate 256K IOPS'],
        solution: '```bash\n# gp3: baseline 3000 IOPS, provisione ate 16.000\n# 10.000 IOPS esta dentro do range gp3\n# Custo: ~\\$0.08/GB + \\$0.005/IOPS provisionado acima de 3000\n# 100GB gp3 com 10K IOPS = \\$8 + (7000 * \\$0.005) = \\$43/mes\n\n# io2: \\$0.125/GB + \\$0.065/IOPS\n# 100GB io2 com 10K IOPS = \\$12.50 + \\$650 = \\$662.50/mes\n\n# gp3 e dramaticamente mais barato para 10K IOPS!\naws ec2 create-volume --volume-type gp3 --size 100 \\\n  --iops 10000 --throughput 400 \\\n  --availability-zone us-east-1a\n```',
        verify: '```bash\naws ec2 describe-volumes --volume-ids vol-xxx \\\n  --query "Volumes[0].{Type:VolumeType,IOPS:Iops,Throughput:Throughput}"\n# Esperado: gp3, 10000 IOPS, 400 MB/s\n```'
      },
      {
        title: 'Criar Cluster ElastiCache Redis',
        instruction: 'Crie um cluster Redis para session store com replica para HA.',
        hints: ['Use replication group para HA', 'Escolha cache.r6g para memory-optimized com Graviton'],
        solution: '```bash\naws elasticache create-replication-group \\\n  --replication-group-id session-cache \\\n  --replication-group-description "Session store" \\\n  --engine redis \\\n  --cache-node-type cache.r6g.large \\\n  --num-cache-clusters 2 \\\n  --automatic-failover-enabled \\\n  --multi-az-enabled\n```',
        verify: '```bash\naws elasticache describe-replication-groups \\\n  --replication-group-id session-cache\n# Esperado: 2 clusters, AutomaticFailover = enabled\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Lifecycle Rule S3 Nao Transiciona Objetos',
      difficulty: 'medium',
      symptom: 'Objetos mais antigos que o periodo de transicao permanecem em Standard em vez de mover para IA/Glacier.',
      diagnosis: '```\nChecklist:\n1. Regra esta Enabled? (nao Disabled)\n2. Filtro corresponde aos objetos? (prefixo, tags, tamanho)\n3. Tamanho minimo: objetos < 128 KB NAO sao transicionados\n4. Timing da transicao:\n   - Dias contados a partir da data de criacao\n   - Processado diariamente (nao instantaneo)\n   - Standard para IA requer minimo 30 dias\n5. Versionamento: regras se aplicam a versoes current ou noncurrent\n\nVerifique:\n  aws s3api get-bucket-lifecycle-configuration --bucket BUCKET\n```',
      solution: 'Verifique que a regra esta habilitada e o filtro corresponde aos objetos alvo. Objetos menores que 128 KB nunca sao transicionados. Transicoes sao processadas diariamente em lotes. Garanta gap minimo de 30 dias entre Standard e IA.'
    },
    {
      title: 'ElastiCache Redis com Alta Latencia',
      difficulty: 'hard',
      symptom: 'Cluster Redis mostrando latencia aumentada apesar de baixa utilizacao de CPU e memoria.',
      diagnosis: '```\nCausas comuns:\n1. Rede: cliente nao esta no mesmo VPC/subnet\n   Solucao: deploy cliente na mesma AZ do node primario\n\n2. Hot key: chave unica recebendo trafego desproporcional\n   Verifique: redis-cli --latency, SLOWLOG GET\n\n3. Valores grandes: objetos grandes aumentam tempo de serializacao\n\n4. Impacto de persistencia: snapshots RDB causam breve latencia\n\n5. Overhead de conexao: muitas conexoes novas\n   Solucao: use connection pooling\n\nMetricas CloudWatch:\n  - EngineCPUUtilization (nao host CPU)\n  - CurrConnections\n  - CacheHitRate\n```',
      solution: 'Fixes comuns: 1) Deploy clientes na mesma AZ do Redis primario. 2) Use connection pooling. 3) Quebre valores grandes em chaves menores. 4) Habilite cluster mode para sharding de hot keys. 5) Agende snapshots RDB em janelas de baixo trafego.'
    }
  ]
};
