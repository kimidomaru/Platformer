window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-high-perf-arch/compute-optimization'] = {
  theory: `# Compute & Container Optimization

## Relevancia no Exame
> **Design High-Performing Architectures** vale **24%** do SAA-C03. Selecao de instancias EC2, placement groups, containers, performance Lambda e Graviton sao temas-chave.

## Familias de Instancias EC2

| Familia | Tipo | Caso de Uso |
|---------|------|-------------|
| **M** (General) | CPU/memoria balanceados | Web servers, app servers, DBs pequenos |
| **T** (Burstable) | Baseline + burst CPU | Dev/test, micro-servicos |
| **C** (Compute) | CPU alto | Batch, ML inference, gaming, HPC |
| **R** (Memory) | Memoria alta | DBs in-memory (Redis, SAP HANA) |
| **I** (Storage) | I/O sequencial alto | NoSQL (Cassandra), data warehousing |
| **P/G** (Accelerated) | GPU | ML training, renderizacao 3D |
| **Inf/Trn** (Accelerated) | Chips ML | ML inference (Inferentia), training (Trainium) |

### Convencao de Nomes
**m7g.xlarge** = Familia (m) + Geracao (7) + Processador (g=Graviton) + Tamanho (xlarge)

## Placement Groups

| Tipo | Comportamento | Caso de Uso |
|------|--------------|-------------|
| **Cluster** | Mesmo rack, mesma AZ | HPC, baixa latencia (<10Gbps rede) |
| **Spread** | Hardware distinto, max 7 por AZ | Instancias criticas HA (poucas) |
| **Partition** | Racks separados por particao | Sistemas distribuidos (HDFS, Cassandra, Kafka) |

## Containers na AWS

### ECS vs EKS

| Aspecto | ECS | EKS |
|---------|-----|-----|
| **Orquestrador** | Proprietario AWS | Kubernetes padrao |
| **Complexidade** | Mais simples | Mais complexo, mais poderoso |
| **Portabilidade** | Apenas AWS | Multi-cloud, on-prem |
| **Control Plane** | Gratis | \\$0.10/hora por cluster |

### Fargate
- Containers serverless — sem instancias EC2 para gerenciar
- Preco por vCPU e por GB-memoria (por segundo)
- Bom para workloads variaveis e imprevisiveis
- Fargate Spot: ate 70% de desconto (interruptivel)

## Lambda Performance Tuning

| Parametro | Range | Impacto |
|-----------|-------|---------|
| **Memoria** | 128 MB - 10 GB | CPU escala proporcionalmente com memoria |
| **Timeout** | 1s - 15 min | Tempo maximo de execucao |
| **Provisioned Concurrency** | Pre-inicializa ambientes | Elimina cold starts |
| **SnapStart** | Apenas Java | Snapshot cached restaura em <1s |
| **Layers** | Ate 5 | Bibliotecas compartilhadas entre funcoes |

## AWS Graviton

Processadores ARM desenvolvidos pela AWS:
- **Ate 40% melhor preco-performance** vs x86
- Disponivel para: EC2, RDS, ElastiCache, Lambda, EKS, ECS
- Requer codigo compativel com ARM (maioria dos workloads Linux funciona nativamente)

## AWS Compute Optimizer

Recomendacoes de right-sizing baseadas em ML:
- Instancias EC2 (sobre/sub-provisionadas)
- Volumes EBS (tipo e tamanho)
- Funcoes Lambda (otimizacao de memoria)
- Auto Scaling groups (mix de tipos)

## Erros Comuns

- Usar Cluster placement para HA (e para performance, NAO HA)
- Escolher EKS quando ECS e mais simples e suficiente
- Nao saber que Graviton oferece 40% melhor preco-performance
- Esquecer que mais memoria Lambda tambem aumenta CPU proporcionalmente
`,

  quiz: [
    {
      question: 'Qual familia de instancias EC2 e melhor para batch processing compute-intensivo?',
      options: ['M (General Purpose)', 'C (Compute Optimized)', 'R (Memory Optimized)', 'T (Burstable)'],
      correct: 1,
      explanation: 'Familia C (Compute Optimized) fornece a maior razao CPU/memoria. Ideal para batch, ML inference, computacao cientifica e gaming.',
      reference: 'C = Compute (CPU-intensivo). R = Memory (RAM-intensivo). M = General (balanceado).'
    },
    {
      question: 'O que um Cluster placement group fornece?',
      options: ['Instancias em diferentes AZs para HA', 'Instancias no mesmo rack para menor latencia', 'Maximo 7 instancias por AZ', 'Failover automatico'],
      correct: 1,
      explanation: 'Cluster placement: todas as instancias no mesmo rack na mesma AZ. Fornece a menor latencia de rede (ate 10 Gbps entre instancias). Usado para HPC.',
      reference: 'Cluster = mesmo rack, baixa latencia. Spread = hardware distinto, HA. Partition = distribuido.'
    },
    {
      question: 'Como a alocacao de memoria do Lambda afeta a CPU?',
      options: ['Nenhum efeito na CPU', 'CPU escala proporcionalmente com a alocacao de memoria', 'CPU e fixa independente da memoria', 'CPU so muda com provisioned concurrency'],
      correct: 1,
      explanation: 'Lambda aloca CPU proporcionalmente a memoria. Com 1.769 MB voce tem 1 vCPU completa. Com 10 GB, 6 vCPUs. Mais memoria = mais CPU = execucao mais rapida.',
      reference: '128 MB = CPU minima. 1769 MB = 1 vCPU. 10 GB = 6 vCPUs.'
    },
    {
      question: 'Qual o beneficio dos processadores AWS Graviton?',
      options: ['Instancias gratis', 'Ate 40% melhor preco-performance que x86', 'Suporte apenas Windows', 'Scaling automatico'],
      correct: 1,
      explanation: 'Graviton (ARM) oferece ate 40% melhor preco-performance vs instancias x86 comparaveis. Disponivel para EC2, RDS, ElastiCache, Lambda e EKS.',
      reference: 'Graviton = ARM, 40% melhor preco-perf. Maioria dos workloads Linux funciona nativamente.'
    },
    {
      question: 'Qual o numero maximo de instancias por AZ em um Spread placement group?',
      options: ['3', '5', '7', 'Ilimitado'],
      correct: 2,
      explanation: 'Spread placement group permite maximo 7 instancias por AZ. Cada instancia fica em hardware distinto. Melhor para poucas instancias criticas que precisam de HA.',
      reference: 'Spread: max 7/AZ, hardware distinto. Para fleets grandes, use Partition.'
    },
    {
      question: 'Quando escolher ECS em vez de EKS?',
      options: ['Quando precisa de portabilidade multi-cloud', 'Quando quer orquestracao de containers mais simples e nativa AWS', 'Quando precisa de Helm e Istio', 'Quando precisa de compatibilidade Kubernetes'],
      correct: 1,
      explanation: 'ECS e mais simples, tem integracao mais forte com AWS e control plane gratis. Escolha ECS quando nao precisa de portabilidade Kubernetes ou seu ecossistema.',
      reference: 'ECS = mais simples, AWS-nativo, control plane gratis. EKS = K8s padrao, portavel, \\$0.10/hr.'
    },
    {
      question: 'O que Lambda Provisioned Concurrency faz?',
      options: ['Aumenta memoria', 'Pre-inicializa ambientes de execucao para eliminar cold starts', 'Estende timeout alem de 15 minutos', 'Habilita acesso GPU'],
      correct: 1,
      explanation: 'Provisioned Concurrency mantem um numero especifico de ambientes de execucao inicializados e prontos. Elimina cold starts para aplicacoes sensiveis a latencia.',
      reference: 'Provisioned Concurrency = sem cold starts. SnapStart = otimizacao cold start para Java.'
    },
    {
      question: 'Para que o Partition placement group e mais indicado?',
      options: ['HPC de baixa latencia', 'Poucas instancias criticas', 'Sistemas distribuidos grandes como HDFS, Cassandra e Kafka', 'Workloads serverless'],
      correct: 2,
      explanation: 'Partition placement: instancias distribuidas em particoes logicas, cada uma em racks separados. Melhor para workloads distribuidos e replicados grandes.',
      reference: 'Partition: racks separados por particao. Ate 7 particoes por AZ. Para sistemas distribuidos.'
    }
  ],

  flashcards: [
    { front: 'Mnemonicos das familias EC2?', back: 'M=General, T=Burstable, C=Compute, R=Memory, X=Extreme Memory, I=Storage(IOPS), D=Dense(HDD), P/G=GPU, Inf=Inference, Trn=Training. Nome: m7g.xlarge = familia+geracao+processador+tamanho.' },
    { front: 'Tipos de Placement Group?', back: 'Cluster: mesmo rack, menor latencia, HPC. Spread: hardware distinto por instancia, max 7/AZ, HA. Partition: racks separados por particao, sistemas distribuidos (HDFS, Cassandra, Kafka).' },
    { front: 'ECS vs EKS?', back: 'ECS: AWS-nativo, mais simples, control plane gratis, integracao forte AWS. EKS: Kubernetes padrao, portavel, ecossistema K8s (Helm, Istio), \\$0.10/hr control plane. Escolha ECS a menos que precise de K8s.' },
    { front: 'Beneficios do Fargate?', back: 'Containers serverless, sem gerenciamento EC2, preco por vCPU+memoria, bom para workloads variaveis. Fargate Spot: ate 70% off (interruptivel). Funciona com ECS e EKS.' },
    { front: 'Tuning de performance Lambda?', back: 'Memoria 128MB-10GB (CPU escala proporcionalmente). Provisioned Concurrency (sem cold starts). SnapStart (Java). Layers (libs compartilhadas). 15-min max timeout. 10GB ephemeral storage.' },
    { front: 'O que e AWS Graviton?', back: 'Processadores ARM da AWS. Ate 40% melhor preco-performance vs x86. Disponivel para EC2, RDS, ElastiCache, Lambda, EKS. Maioria dos workloads Linux compativel nativamente.' },
    { front: 'O que Compute Optimizer recomenda?', back: 'Right-sizing baseado em ML: tipo de instancia EC2, tipo/tamanho EBS, memoria Lambda, mix de instancias ASG. Analisa metricas CloudWatch para recomendacoes.' },
    { front: 'Cold starts Lambda - como resolver?', back: 'Provisioned Concurrency (ambientes pre-inicializados). SnapStart (Java, snapshot cached). Reduzir tamanho do pacote. Aumentar memoria (init mais rapido). Keep warm com CloudWatch Events agendados.' }
  ],

  lab: {
    scenario: 'Otimize recursos de compute para uma aplicacao containerizada.',
    objective: 'Praticar selecao de EC2, placement groups e otimizacao Lambda.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Comparar Tipos de Instancia para um Workload',
        instruction: 'Use Compute Optimizer para identificar o melhor tipo de instancia para uma aplicacao web rodando em m5.xlarge com 15% de CPU media.',
        hints: ['Baixa utilizacao de CPU sugere sobre-provisionamento', 'Considere Graviton para workloads Linux'],
        solution: '```bash\n# Verificar utilizacao atual\naws cloudwatch get-metric-statistics \\\n  --namespace AWS/EC2 --metric-name CPUUtilization \\\n  --dimensions Name=InstanceId,Value=i-xxx \\\n  --start-time 2024-01-01T00:00:00Z --end-time 2024-01-08T00:00:00Z \\\n  --period 3600 --statistics Average\n\n# Obter recomendacoes do Compute Optimizer\naws compute-optimizer get-ec2-instance-recommendations \\\n  --instance-arns arn:aws:ec2:REGION:ACCT:instance/i-xxx\n\n# Com 15% CPU no m5.xlarge, provavelmente right-size para:\n# m7g.large (Graviton, 40% mais barato) ou m5.large\n```',
        verify: '```bash\n# Recomendacao esperada:\n# Atual: m5.xlarge (4 vCPU, 16 GB) com 15% CPU\n# Recomendado: m7g.large (2 vCPU, 8 GB Graviton)\n# Economia estimada: ~60% (downsize + Graviton)\n```'
      },
      {
        title: 'Criar Cluster Placement Group para HPC',
        instruction: 'Crie um Cluster placement group e lance 2 instancias compute-optimized nele para comunicacao de baixa latencia.',
        hints: ['Cluster = mesma AZ, mesmo rack', 'Use instancias familia-c para HPC'],
        solution: '```bash\n# Criar cluster placement group\naws ec2 create-placement-group --group-name hpc-cluster \\\n  --strategy cluster\n\n# Lancar instancias no placement group\naws ec2 run-instances --image-id ami-xxx \\\n  --instance-type c6i.xlarge --count 2 \\\n  --placement GroupName=hpc-cluster \\\n  --subnet-id subnet-xxx\n```',
        verify: '```bash\naws ec2 describe-placement-groups --group-names hpc-cluster\n# Esperado: State = available, Strategy = cluster\n\naws ec2 describe-instances --filters \\\n  Name=placement-group-name,Values=hpc-cluster\n# Esperado: 2 instancias, mesma AZ\n```'
      },
      {
        title: 'Otimizar Memoria Lambda',
        instruction: 'Teste uma funcao Lambda com diferentes configuracoes de memoria (128MB, 512MB, 1024MB) e compare tempo de execucao e custo.',
        hints: ['Mais memoria = mais CPU = potencialmente mais rapido', 'Use AWS Lambda Power Tuning para testes automatizados'],
        solution: '```bash\n# Atualizar memoria para 128 MB\naws lambda update-function-configuration \\\n  --function-name my-function --memory-size 128\naws lambda invoke --function-name my-function output.json\n\n# Atualizar para 512 MB\naws lambda update-function-configuration \\\n  --function-name my-function --memory-size 512\naws lambda invoke --function-name my-function output.json\n\n# Atualizar para 1024 MB\naws lambda update-function-configuration \\\n  --function-name my-function --memory-size 1024\naws lambda invoke --function-name my-function output.json\n# Comparar Duration nos response headers\n```',
        verify: '```bash\n# Padrao de resultados esperado:\n# 128 MB: Duration 3000ms\n# 512 MB: Duration 800ms\n# 1024 MB: Duration 400ms\n# Geralmente 512-1024 MB e mais barato (execucao rapida compensa taxa maior)\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Falha ao Lancar em Placement Group',
      difficulty: 'medium',
      symptom: 'Nao consigo lancar instancias em um Cluster placement group. Erro: insufficient capacity.',
      diagnosis: '```\nRestricoes do Cluster placement group:\n1. Todas as instancias devem estar na MESMA AZ\n2. Capacidade pode ser limitada para o tipo escolhido\n3. Nao pode abranger multiplas AZs\n4. Misturar tipos de instancia pode causar problemas\n\nMelhores praticas:\n  - Use um unico tipo de instancia\n  - Lance todas em um unico request\n  - Se erro de capacidade, tente AZ ou tipo diferente\n  - Stop e start (nao reboot) para realocar no cluster\n```',
      solution: 'Lance todas as instancias em um unico request com o mesmo tipo. Se capacidade insuficiente, tente AZ diferente ou tipo diferente na mesma familia. Para capacidade garantida, considere Capacity Reservations com o placement group.'
    },
    {
      title: 'Latencia de Cold Start Lambda Muito Alta',
      difficulty: 'hard',
      symptom: 'Funcao Lambda tem latencia alta intermitente (2-5 segundos) devido a cold starts.',
      diagnosis: '```\nCausas de cold start:\n1. Primeira invocacao apos deployment\n2. Scale-out (novo ambiente de execucao)\n3. Timeout de ociosidade (AWS reclama ambiente)\n\nDiagnostico:\n  CloudWatch Logs: procure INIT_START nos log streams\n  X-Ray: segmento Initialization mostra tempo de cold start\n\nFatores que afetam cold start:\n  - Runtime (Java/C# mais lento, Python/Node mais rapido)\n  - Tamanho do pacote (maior = init mais lento)\n  - Alocacao de memoria (mais memoria = init mais rapido)\n  - VPC (adiciona setup de ENI)\n```',
      solution: 'Opcoes: 1) Provisioned Concurrency (ambientes aquecidos garantidos, custo extra). 2) SnapStart para Java (snapshot cached, cold start quase zero). 3) Reduzir tamanho do pacote. 4) Aumentar memoria (init mais rapido). 5) Keep warm com CloudWatch Events agendados.'
    }
  ]
};
