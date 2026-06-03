window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-cloud-concepts/aws-global-infra'] = {
  theory: `# AWS Global Infrastructure

## Relevancia no Exame
> Entender a infraestrutura global da AWS e essencial no CLF-C02. Perguntas sobre Regions, AZs, Edge Locations e como escolher uma Region sao frequentes.

## Regions

Uma **Region** e uma area geografica isolada que contem multiplas Availability Zones. A AWS tem 30+ Regions globalmente.

### Criterios para Escolher uma Region

| Criterio | Descricao |
|----------|-----------|
| **Compliance** | Dados devem permanecer em determinado pais? (ex: LGPD, GDPR) |
| **Latencia** | Proximidade dos usuarios finais |
| **Servicos disponiveis** | Nem todos os servicos estao em todas as Regions |
| **Preco** | Precos variam entre Regions (ex: Sao Paulo vs Virginia) |

## Availability Zones (AZs)

Cada Region tem **minimo 3 AZs** (tipicamente 3-6). Cada AZ e um ou mais data centers discretos com energia, networking e conectividade redundante.

### Caracteristicas das AZs
- Separadas fisicamente dentro de uma Region (dezenas de km)
- Conectadas entre si com rede de alta velocidade e baixa latencia
- Falha em uma AZ NAO afeta as outras
- Voce escolhe em qual AZ deployar recursos (ex: EC2, RDS)

### Multi-AZ para Alta Disponibilidade
\`\`\`
Region: sa-east-1 (Sao Paulo)
  ├── AZ: sa-east-1a  →  EC2 + RDS Primary
  ├── AZ: sa-east-1b  →  EC2 + RDS Standby
  └── AZ: sa-east-1c  →  EC2 (Auto Scaling)

ELB distribui trafego entre AZs automaticamente
\`\`\`

## Edge Locations

**Edge Locations** sao pontos de presenca (PoPs) usados pelo **Amazon CloudFront** (CDN) e outros servicos para entregar conteudo com baixa latencia.

- 400+ Edge Locations globalmente
- Muito mais numerosas que Regions
- Usadas por: CloudFront, Route 53, AWS WAF, AWS Shield

### Diferenca: Region vs Edge Location

| Aspecto | Region | Edge Location |
|---------|--------|---------------|
| **Quantidade** | 30+ | 400+ |
| **Servicos** | Todos os servicos AWS | CDN, DNS, Security |
| **Uso** | Compute, storage, databases | Cache, distribuicao de conteudo |
| **Controle** | Voce escolhe a Region | AWS gerencia automaticamente |

## Outros Componentes

### Local Zones
- Extensao de uma Region, mais perto dos usuarios
- Para workloads com latencia ultra-baixa (< 10ms)
- Exemplo: Los Angeles, Boston, Houston

### Wavelength Zones
- Infraestrutura AWS dentro de redes 5G de telecom
- Para aplicacoes moveis com latencia minima
- Parceria com operadoras (Verizon, Vodafone)

### AWS Outposts
- Racks AWS instalados no SEU datacenter
- Mesmas APIs e ferramentas da AWS
- Para workloads que precisam permanecer on-premises
- Modelo de cloud hibrida

### AWS Ground Station
- Controle de satelites e processamento de dados
- Pay-per-use para comunicacao satelital

## AWS CloudFront (CDN)

CloudFront e a CDN da AWS que distribui conteudo globalmente usando Edge Locations:

- Cache de conteudo estatico e dinamico
- Integra com S3, EC2, ALB, Lambda@Edge
- Protecao DDoS integrada (AWS Shield Standard gratuito)
- HTTPS/TLS automatico com ACM

## Erros Comuns

- Confundir AZ com Region — uma Region contem multiplas AZs
- Achar que Edge Location = AZ — Edge e para CDN/DNS, AZ e para compute
- Esquecer que nem todos os servicos estao em todas as Regions
- Confundir Local Zones com Edge Locations — Local Zones rodam compute, Edge Locations fazem cache
`,

  quiz: [
    {
      question: 'Qual e o numero minimo de Availability Zones em uma AWS Region?',
      options: ['1', '2', '3', '4'],
      correct: 2,
      explanation: 'Cada AWS Region tem no minimo 3 Availability Zones, proporcionando alta disponibilidade e resiliencia.',
      reference: 'Fonte: AWS Global Infrastructure page'
    },
    {
      question: 'Qual servico AWS utiliza Edge Locations para entregar conteudo com baixa latencia?',
      options: ['Amazon EC2', 'Amazon RDS', 'Amazon CloudFront', 'Amazon EBS'],
      correct: 2,
      explanation: 'CloudFront e a CDN da AWS que utiliza 400+ Edge Locations para cache e distribuicao de conteudo globalmente.',
      reference: 'Route 53 (DNS) tambem usa Edge Locations.'
    },
    {
      question: 'Qual criterio NÃO e relevante ao escolher uma AWS Region?',
      options: ['Compliance com regulamentacoes locais', 'Numero de Edge Locations na Region', 'Latencia para os usuarios finais', 'Disponibilidade de servicos especificos'],
      correct: 1,
      explanation: 'Edge Locations sao globais e independentes de Regions. Os criterios corretos sao: compliance, latencia, servicos disponiveis e preco.',
      reference: 'Os 4 criterios: Compliance, Latencia, Servicos, Preco.'
    },
    {
      question: 'O que e uma Availability Zone?',
      options: ['Uma regiao geografica inteira', 'Um ou mais data centers com infraestrutura redundante', 'Um ponto de cache para CDN', 'Uma zona de cobranca da AWS'],
      correct: 1,
      explanation: 'Uma AZ e um ou mais data centers discretos com energia, networking e conectividade redundante dentro de uma Region.',
      reference: 'AZs sao separadas fisicamente por dezenas de km dentro da mesma Region.'
    },
    {
      question: 'Qual servico permite rodar infraestrutura AWS no seu proprio datacenter?',
      options: ['AWS Local Zones', 'AWS Wavelength', 'AWS Outposts', 'AWS Ground Station'],
      correct: 2,
      explanation: 'AWS Outposts instala racks AWS no seu datacenter, usando as mesmas APIs e ferramentas da nuvem publica. E o modelo de cloud hibrida da AWS.',
      reference: 'Outposts = hardware AWS on-premises. Local Zones = extensao de Region.'
    },
    {
      question: 'Quantas Edge Locations a AWS possui aproximadamente?',
      options: ['30+', '100+', '200+', '400+'],
      correct: 3,
      explanation: 'A AWS tem 400+ Edge Locations globalmente, muito mais que as 30+ Regions, pois sao usadas para CDN e DNS que precisam de presenca massiva.',
      reference: 'Edge Locations > Local Zones > Regions em quantidade.'
    },
    {
      question: 'AWS Wavelength Zones sao projetadas para qual caso de uso?',
      options: ['Backup de dados', 'Aplicacoes com latencia ultra-baixa em redes 5G', 'Armazenamento de objetos', 'Gerenciamento de DNS'],
      correct: 1,
      explanation: 'Wavelength Zones colocam infraestrutura AWS dentro de redes 5G de operadoras, ideal para aplicacoes moveis que precisam de latencia minima.',
      reference: 'Parcerias com Verizon, Vodafone, KDDI, SK Telecom.'
    },
    {
      question: 'Qual e a principal razao para deployar recursos em multiplas AZs?',
      options: ['Reduzir custos', 'Aumentar a alta disponibilidade', 'Melhorar a seguranca', 'Simplificar o gerenciamento'],
      correct: 1,
      explanation: 'Multi-AZ deployment garante que se uma AZ falhar, a aplicacao continua rodando na(s) outra(s) AZ(s). E a base da alta disponibilidade na AWS.',
      reference: 'RDS Multi-AZ, ALB cross-AZ, ASG multi-AZ sao padroes comuns.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os 4 criterios para escolher uma AWS Region?', back: '1. Compliance (requisitos legais/regulatorios). 2. Latencia (proximidade dos usuarios). 3. Servicos disponiveis (nem todos estao em todas as Regions). 4. Preco (varia entre Regions).' },
    { front: 'Qual a diferenca entre Region, AZ e Edge Location?', back: 'Region = area geografica (30+). AZ = data center(s) dentro de uma Region (3-6 por Region). Edge Location = ponto de cache CDN/DNS (400+, muito mais que Regions).' },
    { front: 'O que e AWS Outposts?', back: 'Racks de hardware AWS instalados no seu proprio datacenter. Permite usar APIs e servicos AWS on-premises. E o modelo de cloud hibrida gerenciada da AWS.' },
    { front: 'O que sao Local Zones?', back: 'Extensoes de uma Region mais perto dos usuarios finais. Para workloads que precisam de latencia ultra-baixa (< 10ms). Exemplo: Los Angeles, Boston.' },
    { front: 'O que e Amazon CloudFront?', back: 'CDN (Content Delivery Network) da AWS. Usa 400+ Edge Locations para cache e entrega de conteudo com baixa latencia. Integra com S3, ALB, Lambda@Edge. Shield Standard incluso.' },
    { front: 'Quantas AZs tem uma Region no minimo?', back: 'No minimo 3 AZs. Tipicamente 3-6. Cada AZ e fisicamente separada (dezenas de km) mas conectada com rede de alta velocidade e baixa latencia.' },
    { front: 'O que sao Wavelength Zones?', back: 'Infraestrutura AWS dentro de redes 5G de telecom (Verizon, Vodafone). Para aplicacoes moveis com latencia minima. Deploy compute na borda da rede do operador.' },
    { front: 'Por que deployar em multiplas AZs?', back: 'Alta disponibilidade. Se uma AZ falhar, a aplicacao continua nas outras. Padroes comuns: RDS Multi-AZ, ALB cross-AZ, ASG distribuido entre AZs.' }
  ],

  lab: {
    scenario: 'Explore a infraestrutura global da AWS e entenda como escolher Regions e AZs.',
    objective: 'Mapear Regions, AZs e Edge Locations e tomar decisoes arquiteturais baseadas em criterios de selecao.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Explorar Regions e AZs Disponiveis',
        instruction: 'No console AWS, clique no seletor de Region (canto superior direito). Liste todas as Regions da America do Sul. Depois, usando EC2, identifique as AZs disponiveis na Region sa-east-1.',
        hints: ['O seletor de Region fica no header do console', 'Em EC2 > Subnets voce pode ver as AZs'],
        solution: '```\nAmerica do Sul:\n- sa-east-1 (Sao Paulo)\n\nAZs em sa-east-1:\n- sa-east-1a\n- sa-east-1b\n- sa-east-1c\n\nVerifique em: EC2 > Subnets > coluna Availability Zone\n```',
        verify: '```bash\n# Via CLI:\naws ec2 describe-availability-zones --region sa-east-1 --query "AvailabilityZones[].ZoneName" --output text\n# Saida esperada: sa-east-1a sa-east-1b sa-east-1c\n```'
      },
      {
        title: 'Verificar Servicos por Region',
        instruction: 'Acesse https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/ e compare os servicos disponiveis em us-east-1 (Virginia) vs sa-east-1 (Sao Paulo).',
        hints: ['us-east-1 sempre tem TODOS os servicos', 'Regions mais novas tem menos servicos'],
        solution: '```\nServicos tipicamente NAO disponiveis em sa-east-1:\n- Alguns servicos de ML/AI (SageMaker pode ter limitacoes)\n- Servicos muito novos (lancam primeiro em us-east-1)\n- Alguns servicos de IoT\n\nus-east-1 tem 200+ servicos, sa-east-1 tem ~150+\n```',
        verify: '```bash\n# Verifique no site da AWS Global Infrastructure\n# Resultado esperado: us-east-1 tem mais servicos que sa-east-1\n# Isso demonstra o criterio "disponibilidade de servicos"\n```'
      },
      {
        title: 'Cenario de Decisao Arquitetural',
        instruction: 'Sua empresa brasileira precisa hospedar uma aplicacao web para clientes no Brasil, com dados que devem permanecer no pais (LGPD). Qual Region voce escolhe e por que?',
        hints: ['LGPD exige residencia de dados no Brasil', 'Latencia para usuarios brasileiros importa'],
        solution: '```\nRegion: sa-east-1 (Sao Paulo)\n\nJustificativas:\n1. Compliance: LGPD requer dados no Brasil -> sa-east-1\n2. Latencia: menor latencia para usuarios BR\n3. Servicos: maioria dos servicos necessarios disponiveis\n4. Preco: mais caro que us-east-1, mas compliance exige\n\nArquitetura Multi-AZ:\n- sa-east-1a: EC2 + RDS Primary\n- sa-east-1b: EC2 + RDS Standby\n- sa-east-1c: EC2 (burst capacity)\n- ALB distribuindo trafego entre AZs\n```',
        verify: '```bash\n# Criterios atendidos:\n# [x] Compliance (LGPD) -> sa-east-1\n# [x] Latencia -> Region mais proxima do Brasil\n# [x] Multi-AZ -> alta disponibilidade\n# Resultado esperado: escolha justificada por compliance e latencia\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Confusao entre AZ e Edge Location',
      difficulty: 'easy',
      symptom: 'Candidato acha que Edge Location e um tipo de AZ ou que pode rodar EC2 em Edge Locations.',
      diagnosis: '```\nAZ (Availability Zone):\n- Data center(s) completos\n- Roda QUALQUER servico AWS (EC2, RDS, etc)\n- Voce ESCOLHE em qual AZ deployar\n- 3-6 por Region\n\nEdge Location:\n- Ponto de cache/presenca\n- Apenas CDN (CloudFront), DNS (Route 53), WAF, Shield\n- AWS gerencia automaticamente\n- 400+ globalmente\n```',
      solution: 'AZs sao para compute e storage. Edge Locations sao para cache e distribuicao de conteudo. Voce NAO pode rodar EC2 em Edge Locations. Use Lambda@Edge se precisar de compute na borda.'
    },
    {
      title: 'Quando usar Outposts vs Local Zones',
      difficulty: 'medium',
      symptom: 'Candidato confunde Outposts com Local Zones — ambos parecem "AWS mais perto".',
      diagnosis: '```\nAWS Outposts:\n- Hardware AWS no SEU datacenter\n- Voce gerencia o espaco fisico\n- Para: compliance, residencia de dados, baixa latencia on-prem\n- Modelo: cloud hibrida\n\nLocal Zones:\n- Infraestrutura AWS em cidades adicionais\n- AWS gerencia tudo\n- Para: latencia < 10ms para usuarios finais\n- Modelo: extensao da cloud publica\n\nWavelength:\n- AWS dentro da rede 5G da operadora\n- Para: aplicacoes moveis ultra-low-latency\n```',
      solution: 'Outposts = SEU datacenter com hardware AWS. Local Zones = datacenter da AWS em mais cidades. A diferenca chave e QUEM gerencia o espaco fisico e ONDE fica o hardware.'
    }
  ]
};
