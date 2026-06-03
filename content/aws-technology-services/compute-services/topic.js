window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-technology-services/compute-services'] = {
  theory: `# Compute Services

## Relevancia no Exame
> O dominio **Cloud Technology and Services** vale **34%** do CLF-C02. Saber diferenciar os servicos de compute e fundamental.

## Amazon EC2 (Elastic Compute Cloud)

Maquinas virtuais (instances) na nuvem. O servico de compute mais fundamental da AWS.

### Tipos de Instance (Familias)

| Familia | Uso | Exemplos |
|---------|-----|----------|
| **General Purpose** (t3, m5) | Workloads balanceadas | Web servers, dev/test |
| **Compute Optimized** (c5, c6g) | CPU-intensivo | Batch processing, ML inference |
| **Memory Optimized** (r5, x1) | RAM-intensivo | In-memory databases, caches |
| **Storage Optimized** (i3, d2) | I/O intensivo | Data warehouses, HDFS |
| **Accelerated** (p4, g4) | GPU | Deep learning, video encoding |

### Modelos de Compra EC2

| Modelo | Descricao | Desconto | Compromisso |
|--------|-----------|----------|-------------|
| **On-Demand** | Paga por hora/segundo | 0% | Nenhum |
| **Reserved** | Reserva 1 ou 3 anos | Ate 72% | 1-3 anos |
| **Savings Plans** | Compromisso de gasto | Ate 72% | 1-3 anos |
| **Spot** | Capacidade ociosa | Ate 90% | Nenhum (pode ser interrompido) |
| **Dedicated Host** | Servidor fisico dedicado | Variavel | Compliance/licenciamento |
| **Dedicated Instance** | Instance em hardware dedicado | Variavel | Isolamento |

### Spot Instances — Importante
- Ate 90% de desconto sobre On-Demand
- AWS pode interromper com 2 minutos de aviso
- Ideal para: batch jobs, data analysis, CI/CD, workloads fault-tolerant
- NAO ideal para: databases, web servers criticos

## AWS Lambda (Serverless Compute)

Executa codigo sem provisionar servidores. Paga apenas pelo tempo de execucao.

### Caracteristicas
- Timeout maximo: **15 minutos**
- Memoria: 128 MB a 10 GB
- Paga por: numero de invocacoes + duracao (ms)
- Suporta: Python, Node.js, Java, Go, .NET, Ruby, custom runtimes
- Triggers: API Gateway, S3, DynamoDB, SQS, EventBridge, etc.
- Free tier: 1 milhao de invocacoes/mes

## Amazon ECS & EKS (Containers)

### Amazon ECS (Elastic Container Service)
- Orquestracao de containers propria da AWS
- Roda containers Docker
- Dois modos de launch:
  - **EC2 Launch Type**: voce gerencia as EC2 instances
  - **Fargate Launch Type**: serverless, AWS gerencia a infra

### Amazon EKS (Elastic Kubernetes Service)
- Kubernetes gerenciado pela AWS
- Compativel com ferramentas K8s (kubectl, Helm)
- Tambem suporta Fargate

### AWS Fargate
- Engine serverless para ECS e EKS
- Sem necessidade de gerenciar EC2 instances
- Paga por vCPU e memoria usadas

## Outros Servicos de Compute

| Servico | Descricao | Caso de Uso |
|---------|-----------|-------------|
| **Lightsail** | VPS simples, preco fixo | Sites simples, WordPress |
| **Elastic Beanstalk** | PaaS — deploy automatico | Apps web sem gerenciar infra |
| **App Runner** | Deploy de containers simplificado | APIs e web apps em containers |
| **Batch** | Processamento em lote | Jobs HPC, simulacoes |
| **Outposts** | Compute AWS on-premises | Cloud hibrida |

## Auto Scaling

### EC2 Auto Scaling
- Ajusta automaticamente o numero de instances
- Baseado em metricas (CPU, requests, custom)
- Garante minimo, desejado e maximo de instances
- Integra com ELB para distribuir trafego

### Tipos de Scaling
- **Scale Out**: adicionar instances (aumento de demanda)
- **Scale In**: remover instances (reducao de demanda)
- **Vertical Scaling**: mudar tipo de instance (t3.micro para t3.large)
- **Horizontal Scaling**: adicionar mais instances

## Elastic Load Balancing (ELB)

| Tipo | Camada | Uso |
|------|--------|-----|
| **ALB** (Application LB) | Layer 7 (HTTP/HTTPS) | Web apps, microservicos, path routing |
| **NLB** (Network LB) | Layer 4 (TCP/UDP) | Alta performance, baixa latencia |
| **GLB** (Gateway LB) | Layer 3 | Virtual appliances (firewalls) |
| **CLB** (Classic LB) | Layer 4/7 | Legado — nao usar para novos projetos |

## Erros Comuns

- Confundir ECS com EKS — ECS e proprietario AWS, EKS e Kubernetes gerenciado
- Achar que Fargate e um servico separado — e um launch type para ECS/EKS
- Confundir Spot com Reserved — Spot pode ser interrompido, Reserved nao
- Achar que Lambda roda indefinidamente — timeout maximo de 15 minutos
`,

  quiz: [
    {
      question: 'Qual modelo de compra EC2 oferece ate 90% de desconto mas pode ser interrompido pela AWS?',
      options: ['Reserved Instances', 'On-Demand', 'Spot Instances', 'Savings Plans'],
      correct: 2,
      explanation: 'Spot Instances usam capacidade ociosa da AWS com ate 90% de desconto. A AWS pode interromper com 2 minutos de aviso quando precisar da capacidade.',
      reference: 'Ideal para batch processing, CI/CD, workloads fault-tolerant.'
    },
    {
      question: 'Qual e o timeout maximo de uma funcao AWS Lambda?',
      options: ['5 minutos', '10 minutos', '15 minutos', '60 minutos'],
      correct: 2,
      explanation: 'Lambda tem timeout maximo de 15 minutos (900 segundos). Para processos mais longos, considere Step Functions, ECS ou EC2.',
      reference: 'Lambda cobra por numero de invocacoes + duracao em ms.'
    },
    {
      question: 'Qual servico permite rodar containers sem gerenciar EC2 instances?',
      options: ['Amazon ECS com EC2', 'Amazon EKS com EC2', 'AWS Fargate', 'Amazon Lightsail'],
      correct: 2,
      explanation: 'AWS Fargate e o engine serverless para containers. Funciona com ECS e EKS, eliminando a necessidade de provisionar e gerenciar EC2 instances.',
      reference: 'Fargate = serverless containers. Paga por vCPU + memoria por tarefa.'
    },
    {
      question: 'Qual tipo de Load Balancer opera na Layer 7 (HTTP/HTTPS)?',
      options: ['Network Load Balancer', 'Application Load Balancer', 'Gateway Load Balancer', 'Classic Load Balancer'],
      correct: 1,
      explanation: 'Application Load Balancer (ALB) opera na Layer 7 e suporta path-based routing, host-based routing, e integracao com containers e microservicos.',
      reference: 'NLB = Layer 4 (TCP/UDP, alta performance). GLB = Layer 3 (appliances virtuais).'
    },
    {
      question: 'Qual a diferenca entre ECS e EKS?',
      options: ['ECS e serverless, EKS nao', 'ECS usa Docker, EKS usa Kubernetes', 'ECS e gratuito, EKS e pago', 'Nao ha diferenca'],
      correct: 1,
      explanation: 'ECS e o orquestrador de containers proprietario da AWS. EKS e Kubernetes gerenciado. Ambos podem usar Fargate para ser serverless.',
      reference: 'EKS e ideal se voce ja usa Kubernetes. ECS e mais simples e integrado com AWS.'
    },
    {
      question: 'Qual familia de EC2 instances e ideal para workloads CPU-intensivas como batch processing?',
      options: ['General Purpose (t3)', 'Memory Optimized (r5)', 'Compute Optimized (c5)', 'Storage Optimized (i3)'],
      correct: 2,
      explanation: 'Compute Optimized (c5, c6g) sao otimizadas para CPU — ideais para batch processing, ML inference, gaming servers, e workloads computacionais.',
      reference: 'General Purpose = balanceado. Memory = RAM. Storage = I/O. Accelerated = GPU.'
    },
    {
      question: 'O que e Horizontal Scaling?',
      options: ['Aumentar o tamanho de uma instance', 'Adicionar mais instances', 'Mudar de Region', 'Adicionar mais storage'],
      correct: 1,
      explanation: 'Horizontal Scaling (Scale Out/In) adiciona ou remove instances. Vertical Scaling muda o tipo de instance (ex: t3.micro para t3.large).',
      reference: 'AWS recomenda Horizontal Scaling — e mais resiliente que Vertical.'
    },
    {
      question: 'Qual servico AWS e ideal para hospedar um site WordPress simples com preco previsivel?',
      options: ['Amazon EC2', 'AWS Lambda', 'Amazon Lightsail', 'AWS Elastic Beanstalk'],
      correct: 2,
      explanation: 'Lightsail oferece VPS com preco fixo mensal, ideal para sites simples, blogs, WordPress. Inclui compute, storage, e bandwidth em um pacote.',
      reference: 'Lightsail e mais simples e previsivel que EC2 para workloads basicas.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os modelos de compra de EC2?', back: 'On-Demand (sem compromisso), Reserved (1-3 anos, ate 72% desc), Savings Plans (compromisso de gasto), Spot (ate 90% desc, interruptivel), Dedicated Host (servidor dedicado), Dedicated Instance.' },
    { front: 'O que e AWS Lambda?', back: 'Servico serverless que executa codigo sem provisionar servidores. Timeout max 15 min. Paga por invocacao + duracao (ms). Free tier: 1M invocacoes/mes. Suporta Python, Node, Java, Go, .NET.' },
    { front: 'Qual a diferenca entre ECS e EKS?', back: 'ECS = orquestrador de containers proprietario AWS. EKS = Kubernetes gerenciado. Ambos suportam Fargate (serverless). EKS se voce ja usa K8s, ECS para simplicidade AWS-native.' },
    { front: 'O que e AWS Fargate?', back: 'Engine serverless para containers. Funciona com ECS e EKS. Sem gerenciar EC2 instances. Paga por vCPU e memoria por tarefa. AWS gerencia toda a infraestrutura subjacente.' },
    { front: 'Quais sao os tipos de Load Balancer?', back: 'ALB = Layer 7 (HTTP/HTTPS, path routing). NLB = Layer 4 (TCP/UDP, alta performance). GLB = Layer 3 (virtual appliances). CLB = legado, nao usar.' },
    { front: 'Quando usar Spot Instances?', back: 'Para workloads fault-tolerant: batch processing, data analysis, CI/CD, image processing. Ate 90% desconto. AWS pode interromper com 2 min aviso. NAO usar para databases ou apps criticos.' },
    { front: 'O que e EC2 Auto Scaling?', back: 'Ajusta automaticamente o numero de instances baseado em metricas. Define min/desired/max instances. Scale Out (adicionar) e Scale In (remover). Integra com ELB para distribuir trafego.' },
    { front: 'Quais sao as familias de EC2 instances?', back: 'General Purpose (t3/m5): balanceado. Compute Optimized (c5): CPU. Memory Optimized (r5): RAM. Storage Optimized (i3): I/O. Accelerated (p4/g4): GPU.' }
  ],

  lab: {
    scenario: 'Entenda os servicos de compute AWS e quando usar cada um.',
    objective: 'Selecionar o servico de compute correto para diferentes cenarios.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Selecionar Tipo de Instance EC2',
        instruction: 'Para cada cenario, escolha a familia de instance correta: (1) Web server de baixo trafego, (2) Machine learning training, (3) In-memory database.',
        hints: ['Web server basico = General Purpose', 'ML training = GPU = Accelerated', 'In-memory DB = Memory Optimized'],
        solution: '```\n1. Web server baixo trafego -> t3.micro (General Purpose)\n   - Burstable, barato, ideal para cargas leves\n\n2. ML training -> p4d.24xlarge (Accelerated/GPU)\n   - 8x NVIDIA A100 GPUs, ideal para deep learning\n\n3. In-memory database -> r5.xlarge (Memory Optimized)\n   - Ratio memoria/CPU alto, ideal para Redis, Memcached\n```',
        verify: '```bash\n# Verifique no console:\n# EC2 > Instance Types\n# Filtre por familia e compare specs\n# t3 = General Purpose (burstable)\n# p4 = Accelerated (GPU)\n# r5 = Memory Optimized\n```'
      },
      {
        title: 'Escolher Modelo de Compra',
        instruction: 'Para cada caso, selecione o modelo de compra: (1) Servidor de producao 24/7 por 3 anos, (2) Job de processamento de dados que pode ser interrompido, (3) Teste de nova aplicacao por 2 semanas.',
        hints: ['Producao longo prazo = Reserved/Savings Plans', 'Interruptivel = Spot', 'Curto prazo = On-Demand'],
        solution: '```\n1. Producao 24/7 por 3 anos -> Reserved Instance ou Savings Plan\n   - Ate 72% desconto, compromisso de 3 anos\n\n2. Job interruptivel -> Spot Instance\n   - Ate 90% desconto, AWS pode reclamar a capacidade\n\n3. Teste por 2 semanas -> On-Demand\n   - Sem compromisso, paga por hora, desliga quando quiser\n```',
        verify: '```bash\n# Verifique no console:\n# EC2 > Pricing > compare modelos\n# Reserved: menor custo para workloads estaveis\n# Spot: menor custo para workloads flexiveis\n# On-Demand: maior custo mas maior flexibilidade\n```'
      },
      {
        title: 'Escolher Servico de Compute',
        instruction: 'Para cada cenario, selecione o servico correto: (1) API que processa 100 requests/dia, (2) Aplicacao web em Docker, (3) Site WordPress simples.',
        hints: ['Poucas requests = Lambda (serverless)', 'Docker = ECS/Fargate', 'WordPress simples = Lightsail'],
        solution: '```\n1. API 100 req/dia -> Lambda + API Gateway\n   - Serverless, paga por invocacao, free tier cobre\n\n2. App Docker -> ECS com Fargate\n   - Serverless containers, sem gerenciar EC2\n\n3. WordPress -> Lightsail\n   - VPS simples, preco fixo, blueprints WordPress\n   - Alternativa: Elastic Beanstalk\n```',
        verify: '```bash\n# Regra de decisao:\n# < 15 min execucao + event-driven -> Lambda\n# Containers -> ECS/EKS (+ Fargate se serverless)\n# VPS simples -> Lightsail\n# Deploy code sem infra -> Elastic Beanstalk\n# Full control -> EC2\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Lambda vs EC2 vs Fargate — Quando usar qual?',
      difficulty: 'medium',
      symptom: 'Candidato nao sabe diferenciar quando usar Lambda, EC2 ou Fargate.',
      diagnosis: '```\nLambda:\n  - Execucoes curtas (< 15 min)\n  - Event-driven (S3, API Gateway, SQS)\n  - Poucas centenas de MB de memoria\n  - Paga por invocacao, zero quando idle\n\nFargate:\n  - Containers que rodam continuamente\n  - Apps que precisam de mais de 10 GB RAM\n  - Sem gerenciar EC2\n  - Paga por vCPU/memoria enquanto roda\n\nEC2:\n  - Controle total sobre OS\n  - Apps com requisitos especificos de OS/kernel\n  - Workloads com licenciamento por-core\n  - Paga por hora/segundo\n```',
      solution: 'Lambda para funcoes curtas event-driven. Fargate para containers sem gerenciar infra. EC2 para controle total. Se nao sabe, comece com Lambda (mais barato, menos gerenciamento) e escale para Fargate/EC2 se necessario.'
    },
    {
      title: 'Spot Instance Interrompida',
      difficulty: 'easy',
      symptom: 'Candidato usa Spot para database de producao e perde dados quando AWS reclama a instance.',
      diagnosis: '```\nSpot Instances:\n  - AWS pode interromper com 2 minutos de aviso\n  - A instance e TERMINADA (nao pausada)\n  - Dados em instance storage sao PERDIDOS\n  - EBS volumes sobrevivem se nao forem deletados\n\nBoas praticas para Spot:\n  - Use para workloads stateless e fault-tolerant\n  - Combine com On-Demand (mixed fleet)\n  - Use Spot Fleet para diversificar instance types\n  - Salve checkpoints frequentes\n```',
      solution: 'NUNCA use Spot para databases, web servers criticos ou workloads stateful. Use Spot para batch processing, rendering, CI/CD, data analysis. Combine Spot + On-Demand em Auto Scaling Groups para balancear custo e disponibilidade.'
    }
  ]
};
