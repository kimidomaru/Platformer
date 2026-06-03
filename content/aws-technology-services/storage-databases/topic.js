window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-technology-services/storage-databases'] = {
  theory: `# Storage & Database Services

## Relevancia no Exame
> Storage e databases sao fundamentais no CLF-C02. Saber diferenciar S3, EBS, EFS e os servicos de database e essencial.

## Amazon S3 (Simple Storage Service)

Armazenamento de objetos com durabilidade de **99.999999999% (11 noves)**. Servico mais usado da AWS.

### Conceitos S3
- **Bucket**: container para objetos (nome globalmente unico)
- **Object**: arquivo + metadata (ate 5 TB por objeto)
- **Key**: caminho do objeto dentro do bucket
- Sem limite de armazenamento total
- Upload multipart para arquivos > 100 MB

### Classes de Armazenamento S3

| Classe | Uso | Disponibilidade |
|--------|-----|-----------------|
| **S3 Standard** | Dados acessados frequentemente | 99.99% |
| **S3 Intelligent-Tiering** | Acesso imprevisivel (move automaticamente) | 99.9% |
| **S3 Standard-IA** | Acesso infrequente mas rapido quando necessario | 99.9% |
| **S3 One Zone-IA** | IA em uma unica AZ (30% mais barato) | 99.5% |
| **S3 Glacier Instant** | Archive com acesso em milissegundos | 99.9% |
| **S3 Glacier Flexible** | Archive com acesso em minutos-horas | 99.99% |
| **S3 Glacier Deep Archive** | Archive longo prazo (mais barato, horas para acesso) | 99.99% |

### S3 Lifecycle Rules
Mova objetos automaticamente entre classes de storage baseado em regras temporais. Ex: mover para Glacier apos 90 dias.

### S3 Versioning
Mantenha versoes anteriores de objetos. Protege contra delecoes acidentais.

## Amazon EBS (Elastic Block Store)

Volumes de bloco para EC2 instances. Pense como um "HD virtual".

### Caracteristicas
- Anexado a UMA EC2 instance por vez (exceto Multi-Attach io2)
- Persiste independente da instance (nao perde dados ao parar)
- Vinculado a uma AZ especifica
- Snapshots para backup (armazenados no S3, cross-AZ/Region)

### Tipos de EBS

| Tipo | Uso | IOPS |
|------|-----|------|
| **gp3/gp2** (SSD) | Uso geral | Ate 16.000 |
| **io2/io1** (SSD) | Alta performance, databases | Ate 64.000 |
| **st1** (HDD) | Throughput intensivo | Ate 500 |
| **sc1** (HDD) | Acesso infrequente, menor custo | Ate 250 |

## Amazon EFS (Elastic File System)

Sistema de arquivos compartilhado (NFS) que pode ser montado por multiplas EC2 instances simultaneamente.

- Multi-AZ por padrao
- Auto-scaling (cresce e encolhe automaticamente)
- Apenas Linux (nao suporta Windows)
- Mais caro que EBS, mas compartilhavel

## AWS Storage Gateway

Servico hibrido que conecta storage on-premises com a nuvem AWS. Tres tipos:
- **File Gateway**: acessa S3 via NFS/SMB
- **Volume Gateway**: volumes iSCSI backed por S3
- **Tape Gateway**: backup em fita virtual para S3 Glacier

## Amazon FSx

Sistemas de arquivos gerenciados:
- **FSx for Windows**: Windows File Server (SMB, Active Directory)
- **FSx for Lustre**: HPC, machine learning (alta performance)

## Servicos de Database

### Databases Relacionais

| Servico | Descricao |
|---------|-----------|
| **Amazon RDS** | Database relacional gerenciado (MySQL, PostgreSQL, MariaDB, Oracle, SQL Server) |
| **Amazon Aurora** | Database AWS-nativo, compativel com MySQL/PostgreSQL, ate 5x mais rapido que RDS MySQL |

### Databases Nao-Relacionais (NoSQL)

| Servico | Descricao |
|---------|-----------|
| **DynamoDB** | Key-value e document DB, serverless, single-digit ms latency |
| **DocumentDB** | Compativel com MongoDB |
| **Neptune** | Graph database |
| **Keyspaces** | Compativel com Cassandra |

### Outros Servicos de Database

| Servico | Descricao |
|---------|-----------|
| **ElastiCache** | In-memory cache (Redis, Memcached) |
| **Redshift** | Data warehouse (analytics, columnar) |
| **DMS** | Database Migration Service |
| **QLDB** | Ledger database (imutavel) |
| **Timestream** | Time-series database |

## Comparacao: S3 vs EBS vs EFS

| Aspecto | S3 | EBS | EFS |
|---------|-----|-----|-----|
| **Tipo** | Object storage | Block storage | File storage (NFS) |
| **Acesso** | HTTP/HTTPS | EC2 instance | Multiplas EC2 |
| **Escalabilidade** | Ilimitada | Volume fixo | Auto-scaling |
| **AZ** | Multi-AZ | Single AZ | Multi-AZ |
| **Uso** | Web, backup, data lake | OS disk, databases | Shared files |

## Erros Comuns

- Confundir S3 com EBS — S3 e object storage (HTTP), EBS e block storage (disco)
- Esquecer que EBS e single-AZ, EFS e multi-AZ
- Nao saber que S3 Glacier tem tempo de recuperacao (nao e acesso instantaneo para todos os tiers)
- Confundir DynamoDB (NoSQL serverless) com RDS (SQL gerenciado)
`,

  quiz: [
    {
      question: 'Qual e a durabilidade do Amazon S3?',
      options: ['99.9%', '99.99%', '99.999%', '99.999999999% (11 noves)'],
      correct: 3,
      explanation: 'S3 oferece 99.999999999% (11 noves) de durabilidade. Isso significa que se armazenar 10 milhoes de objetos, estatisticamente perderia 1 a cada 10.000 anos.',
      reference: 'Durabilidade vs Disponibilidade: durabilidade e sobre NAO perder dados, disponibilidade e sobre ACESSAR dados.'
    },
    {
      question: 'Qual tipo de storage pode ser montado por multiplas EC2 instances simultaneamente?',
      options: ['Amazon EBS', 'Amazon S3', 'Amazon EFS', 'Instance Store'],
      correct: 2,
      explanation: 'Amazon EFS (Elastic File System) e NFS compartilhado que pode ser montado por multiplas EC2 instances em multiplas AZs simultaneamente.',
      reference: 'EBS = 1 instance. EFS = multiplas instances. S3 = object storage (nao monta como filesystem).'
    },
    {
      question: 'Qual classe S3 e ideal para dados com padrao de acesso imprevisivel?',
      options: ['S3 Standard', 'S3 Intelligent-Tiering', 'S3 Glacier', 'S3 One Zone-IA'],
      correct: 1,
      explanation: 'S3 Intelligent-Tiering move objetos automaticamente entre tiers (frequent/infrequent/archive) baseado em padroes de acesso. Sem taxa de recuperacao.',
      reference: 'Ideal quando voce nao sabe a frequencia de acesso. Pequena taxa mensal de monitoramento por objeto.'
    },
    {
      question: 'Amazon DynamoDB e que tipo de database?',
      options: ['Relacional (SQL)', 'NoSQL key-value e document', 'Graph database', 'Time-series'],
      correct: 1,
      explanation: 'DynamoDB e um database NoSQL serverless que suporta key-value e document models. Oferece latencia single-digit milliseconds em qualquer escala.',
      reference: 'DynamoDB = NoSQL serverless. RDS = SQL gerenciado. Neptune = graph. Timestream = time-series.'
    },
    {
      question: 'Qual servico AWS e um data warehouse para analytics?',
      options: ['Amazon RDS', 'Amazon DynamoDB', 'Amazon Redshift', 'Amazon ElastiCache'],
      correct: 2,
      explanation: 'Amazon Redshift e um data warehouse columnar otimizado para analytics e queries complexas em grandes volumes de dados (petabytes).',
      reference: 'Redshift = analytics (OLAP). RDS = transacional (OLTP). DynamoDB = NoSQL.'
    },
    {
      question: 'Qual a diferenca principal entre EBS e EFS?',
      options: ['EBS e mais barato', 'EFS pode ser montado por multiplas instances, EBS por uma', 'EBS suporta Windows e Linux, EFS apenas Windows', 'Nao ha diferenca'],
      correct: 1,
      explanation: 'EBS e single-attach (uma instance, uma AZ). EFS e multi-attach, multi-AZ (compartilhado entre instances). EFS e apenas Linux, mais caro mas compartilhavel.',
      reference: 'Para Windows shared files, use FSx for Windows File Server.'
    },
    {
      question: 'Qual classe S3 tem o menor custo para archive de longo prazo?',
      options: ['S3 Standard-IA', 'S3 Glacier Flexible', 'S3 Glacier Deep Archive', 'S3 One Zone-IA'],
      correct: 2,
      explanation: 'S3 Glacier Deep Archive e a classe mais barata, ideal para dados que raramente precisam ser acessados (retencao 7-10 anos). Tempo de recuperacao: 12-48 horas.',
      reference: 'Deep Archive < Glacier Flexible < Standard-IA < Standard em custo.'
    },
    {
      question: 'Amazon Aurora e compativel com quais engines?',
      options: ['MongoDB e Redis', 'MySQL e PostgreSQL', 'Oracle e SQL Server', 'Cassandra e DynamoDB'],
      correct: 1,
      explanation: 'Aurora e um database AWS-nativo compativel com MySQL e PostgreSQL. E ate 5x mais rapido que RDS MySQL e 3x mais rapido que RDS PostgreSQL.',
      reference: 'Aurora = AWS-native, compativel MySQL/PostgreSQL, alta performance, Multi-AZ replicacao automatica.'
    }
  ],

  flashcards: [
    { front: 'Quais sao as classes de S3?', back: 'Standard (frequent), Intelligent-Tiering (auto-move), Standard-IA (infrequent), One Zone-IA (1 AZ), Glacier Instant (ms), Glacier Flexible (min-hrs), Glacier Deep Archive (12-48hrs). Do mais caro ao mais barato.' },
    { front: 'Qual a diferenca entre S3, EBS e EFS?', back: 'S3 = object storage (HTTP, ilimitado). EBS = block storage (disco EC2, single-AZ). EFS = file storage NFS (multi-AZ, compartilhado, auto-scaling, Linux only).' },
    { front: 'O que e Amazon Aurora?', back: 'Database relacional AWS-nativo, compativel com MySQL e PostgreSQL. Ate 5x mais rapido que RDS MySQL. Storage auto-scaling ate 128 TB. 6 copias em 3 AZs. Serverless option disponivel.' },
    { front: 'O que e Amazon DynamoDB?', back: 'Database NoSQL serverless (key-value + document). Latencia single-digit ms. Auto-scaling. Global Tables para multi-region. DAX para cache in-memory. Pay-per-request ou provisioned capacity.' },
    { front: 'Quais sao os tipos de EBS volumes?', back: 'SSD: gp3/gp2 (uso geral, ate 16K IOPS), io2/io1 (alta perf, ate 64K IOPS). HDD: st1 (throughput, ate 500 IOPS), sc1 (cold, ate 250 IOPS). SSD para IOPS, HDD para throughput.' },
    { front: 'O que e Amazon ElastiCache?', back: 'Servico de cache in-memory gerenciado. Suporta Redis e Memcached. Latencia sub-millisecond. Usado para: caching de DB queries, session storage, leaderboards. Reduz carga no database principal.' },
    { front: 'O que e AWS Storage Gateway?', back: 'Servico hibrido conectando on-prem com AWS. File Gateway (NFS/SMB para S3), Volume Gateway (iSCSI para S3), Tape Gateway (backup em fita virtual para Glacier). Para migracao gradual.' },
    { front: 'O que e Amazon Redshift?', back: 'Data warehouse columnar para analytics. Queries SQL em petabytes de dados. Redshift Spectrum para consultar S3 direto. Integra com BI tools (QuickSight, Tableau). OLAP, nao OLTP.' }
  ],

  lab: {
    scenario: 'Selecione servicos de storage e database corretos para diferentes cenarios.',
    objective: 'Mapear requisitos de aplicacao para servicos AWS de storage e database.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Escolher Storage para cada Cenario',
        instruction: 'Selecione o servico de storage correto: (1) Hospedar imagens de um site, (2) Disco do sistema operacional de um EC2, (3) Diretorio compartilhado entre 10 EC2 instances Linux.',
        hints: ['Imagens web = S3 (object storage)', 'OS disk = EBS (block)', 'Shared Linux = EFS (NFS)'],
        solution: '```\n1. Imagens do site -> Amazon S3\n   - Object storage, acesso via HTTP/HTTPS\n   - Integra com CloudFront para CDN\n\n2. Disco do OS -> Amazon EBS (gp3)\n   - Block storage anexado ao EC2\n   - Persiste apos stop/start\n\n3. Diretorio compartilhado -> Amazon EFS\n   - NFS multi-AZ, monta em multiplas instances\n   - Auto-scaling, apenas Linux\n```',
        verify: '```bash\n# Verificacao:\n# Imagens web -> S3 (HTTP access, CDN integration)\n# OS boot disk -> EBS (block storage, single instance)\n# Shared directory -> EFS (NFS, multi-instance, multi-AZ)\n```'
      },
      {
        title: 'Escolher Database para cada Cenario',
        instruction: 'Selecione o servico correto: (1) E-commerce com transacoes SQL, (2) Perfis de usuario com acesso por key, (3) Analytics em petabytes de dados.',
        hints: ['SQL transactions = RDS/Aurora', 'Key-value = DynamoDB', 'Analytics = Redshift'],
        solution: '```\n1. E-commerce SQL -> Amazon Aurora (ou RDS)\n   - Relacional, ACID, ate 5x mais rapido que MySQL\n   - Multi-AZ automatico\n\n2. Perfis por key -> Amazon DynamoDB\n   - NoSQL key-value, serverless\n   - Single-digit ms latency\n\n3. Analytics -> Amazon Redshift\n   - Data warehouse columnar\n   - SQL em petabytes, integra com BI tools\n```',
        verify: '```bash\n# Verificacao:\n# SQL + ACID -> RDS/Aurora\n# Key-value + serverless -> DynamoDB\n# OLAP analytics -> Redshift\n# Cache -> ElastiCache\n# Graph -> Neptune\n```'
      },
      {
        title: 'Configurar S3 Lifecycle',
        instruction: 'Desenhe uma lifecycle policy: objetos acessados nos primeiros 30 dias (Standard), depois movidos para IA ate 90 dias, depois para Glacier por 1 ano, depois deletados.',
        hints: ['Lifecycle rules automatizam transicoes entre classes', 'Considere custos de transicao'],
        solution: '```\nS3 Lifecycle Policy:\nDia 0-30:   S3 Standard (acesso frequente)\nDia 31-90:  S3 Standard-IA (infrequente)\nDia 91-365: S3 Glacier Flexible (archive)\nDia 366+:   Deletar objeto\n\nCusto por GB/mes aproximado:\nStandard:    $0.023\nStandard-IA: $0.0125\nGlacier:     $0.004\n\nEconomia: ~80% apos 90 dias com Glacier\n```',
        verify: '```bash\n# Verifique no console:\n# S3 > Bucket > Management > Lifecycle rules\n# Crie regra com transitions e expiration\n# Resultado: reducao automatica de custos\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'S3 vs EBS vs EFS — Quando usar qual?',
      difficulty: 'easy',
      symptom: 'Candidato confunde os tres tipos de storage e quando usar cada um.',
      diagnosis: '```\nAmazon S3:\n  - Object storage (key-value)\n  - Acesso via HTTP/HTTPS\n  - Ilimitado, serverless\n  - Para: web content, backups, data lakes\n\nAmazon EBS:\n  - Block storage (disco)\n  - Anexado a 1 EC2 instance\n  - Single AZ\n  - Para: boot volumes, databases\n\nAmazon EFS:\n  - File storage (NFS)\n  - Compartilhado entre instances\n  - Multi-AZ, auto-scaling\n  - Para: shared configs, CMS, home dirs\n  - Apenas Linux!\n```',
      solution: 'S3 para objetos (web, backup). EBS para disco de EC2. EFS para arquivos compartilhados Linux. Para Windows compartilhado, use FSx for Windows.'
    },
    {
      title: 'RDS vs DynamoDB — SQL vs NoSQL',
      difficulty: 'medium',
      symptom: 'Candidato escolhe o tipo errado de database para o cenario apresentado.',
      diagnosis: '```\nUse RDS/Aurora quando:\n  - Dados relacionais com JOINs complexos\n  - Transacoes ACID necessarias\n  - Schema rigido e definido\n  - SQL queries complexas\n  - Ex: e-commerce, ERP, financeiro\n\nUse DynamoDB quando:\n  - Acesso por key (primary key lookup)\n  - Schema flexivel (schemaless)\n  - Latencia ultra-baixa (< 10ms)\n  - Escala massiva sem gerenciamento\n  - Ex: gaming leaderboards, IoT, session store\n```',
      solution: 'SQL + JOINs + ACID = RDS/Aurora. Key-value + serverless + scale = DynamoDB. Analytics = Redshift. Cache = ElastiCache. O exame frequentemente testa essa diferenciacao.'
    }
  ]
};
