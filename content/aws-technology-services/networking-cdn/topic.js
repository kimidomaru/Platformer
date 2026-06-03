window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-technology-services/networking-cdn'] = {
  theory: `# Networking & Content Delivery

## Relevancia no Exame
> Networking e uma area importante do CLF-C02. VPC, Route 53, CloudFront e conectividade hibrida aparecem com frequencia.

## Amazon VPC (Virtual Private Cloud)

Rede virtual isolada na AWS onde voce lanca recursos. Cada VPC pertence a uma Region.

### Componentes da VPC

| Componente | Descricao |
|------------|-----------|
| **Subnets** | Segmentos de rede dentro da VPC (publica ou privada) |
| **Internet Gateway** | Conexao da VPC com a internet (1 por VPC) |
| **NAT Gateway** | Permite subnets privadas acessarem internet (outbound only) |
| **Route Tables** | Regras de roteamento para subnets |
| **Security Groups** | Firewall stateful no nivel da instance (allow rules only) |
| **NACLs** | Firewall stateless no nivel da subnet (allow + deny rules) |

### Subnet Publica vs Privada
- **Publica**: tem rota para Internet Gateway (web servers, bastion hosts)
- **Privada**: sem rota para Internet Gateway (databases, app servers)
- NAT Gateway em subnet publica permite que instancias privadas acessem internet

### Security Groups vs NACLs

| Aspecto | Security Group | NACL |
|---------|---------------|------|
| **Nivel** | Instance | Subnet |
| **Tipo** | Stateful | Stateless |
| **Regras** | Allow only | Allow + Deny |
| **Avaliacao** | Todas as regras | Em ordem numerica |
| **Default** | Deny all inbound, Allow all outbound | Allow all |

## Amazon Route 53

DNS gerenciado da AWS. Registra dominios e roteia trafego.

### Routing Policies
| Policy | Descricao |
|--------|-----------|
| **Simple** | Um registro, um endpoint |
| **Weighted** | Distribui trafego por peso (ex: 70/30) |
| **Latency** | Roteia para Region com menor latencia |
| **Failover** | Primary/Secondary com health checks |
| **Geolocation** | Roteia por localizacao do usuario |
| **Geoproximity** | Roteia por proximidade (com bias) |
| **Multi-value** | Multiplos endpoints com health check |

## Amazon CloudFront

CDN da AWS com 400+ Edge Locations. Entrega conteudo com baixa latencia globalmente.

- Cache de conteudo estatico (S3) e dinamico (ALB, EC2)
- HTTPS automatico com ACM
- Lambda@Edge para logica na borda
- AWS Shield Standard incluso (protecao DDoS gratuita)
- Origin Access Control (OAC) para S3 privado

## Conectividade Hibrida

| Servico | Descricao | Latencia |
|---------|-----------|----------|
| **Site-to-Site VPN** | Conexao criptografada pela internet | Variavel |
| **AWS Direct Connect** | Conexao privada dedicada (fibra) | Consistente, baixa |
| **Transit Gateway** | Hub central para conectar VPCs e redes on-prem | Baixa |
| **VPC Peering** | Conexao privada entre 2 VPCs | Baixa |
| **PrivateLink** | Acesso privado a servicos AWS sem internet | Baixa |

### Direct Connect vs VPN
- **VPN**: rapido de configurar, pela internet, custo menor
- **Direct Connect**: semanas para instalar, conexao dedicada, custo maior, latencia consistente

## API Gateway

Servico gerenciado para criar, publicar e gerenciar APIs (REST, HTTP, WebSocket). Integra com Lambda, EC2, servicos AWS.

## AWS Global Accelerator

Usa a rede global da AWS para rotear trafego otimizado. Melhora performance para aplicacoes globais. IPs anycast estaticos.

## Erros Comuns

- Confundir Security Groups (stateful, instance-level) com NACLs (stateless, subnet-level)
- Achar que NAT Gateway permite trafego inbound — e apenas outbound
- Confundir VPN (pela internet) com Direct Connect (dedicado)
- Esquecer que CloudFront usa Edge Locations, nao AZs
`,

  quiz: [
    {
      question: 'Qual componente VPC permite que subnets privadas acessem a internet para updates?',
      options: ['Internet Gateway', 'NAT Gateway', 'VPC Peering', 'Transit Gateway'],
      correct: 1,
      explanation: 'NAT Gateway permite trafego outbound de subnets privadas para a internet (ex: updates do OS), mas NAO permite trafego inbound.',
      reference: 'Internet Gateway = subnet publica. NAT Gateway = saida para subnets privadas.'
    },
    {
      question: 'Qual a diferenca entre Security Groups e NACLs?',
      options: ['Security Groups sao stateless, NACLs sao stateful', 'Security Groups operam no nivel da instance, NACLs no nivel da subnet', 'Ambos suportam regras Deny', 'Nao ha diferenca'],
      correct: 1,
      explanation: 'Security Groups sao stateful e operam no nivel da instance (allow only). NACLs sao stateless e operam no nivel da subnet (allow + deny).',
      reference: 'Stateful = resposta automatica. Stateless = precisa regra explicita de retorno.'
    },
    {
      question: 'Qual servico AWS fornece conexao privada dedicada entre datacenter on-prem e AWS?',
      options: ['Site-to-Site VPN', 'AWS Direct Connect', 'VPC Peering', 'Internet Gateway'],
      correct: 1,
      explanation: 'AWS Direct Connect fornece conexao de rede privada dedicada (fibra) entre seu datacenter e AWS. Latencia consistente e mais baixa que VPN.',
      reference: 'VPN = pela internet (rapida de configurar). Direct Connect = dedicada (semanas para instalar).'
    },
    {
      question: 'Qual routing policy do Route 53 envia trafego para a Region com menor latencia?',
      options: ['Simple', 'Weighted', 'Latency-based', 'Geolocation'],
      correct: 2,
      explanation: 'Latency-based routing envia usuarios para a AWS Region que oferece menor latencia de rede, independente de localizacao geografica.',
      reference: 'Geolocation = por pais/continente. Latency = por medicao de latencia real.'
    },
    {
      question: 'O que e VPC Peering?',
      options: ['Conexao VPC com internet', 'Conexao privada entre duas VPCs', 'Cache de conteudo na borda', 'Balanceamento de carga'],
      correct: 1,
      explanation: 'VPC Peering permite conexao de rede privada entre duas VPCs (mesma conta, contas diferentes, ou Regions diferentes). Trafego nao passa pela internet.',
      reference: 'VPC Peering e 1-para-1. Para conectar muitas VPCs, use Transit Gateway.'
    },
    {
      question: 'Qual servico fornece protecao DDoS gratuita automaticamente?',
      options: ['AWS WAF', 'AWS Shield Standard', 'Amazon GuardDuty', 'AWS Firewall Manager'],
      correct: 1,
      explanation: 'AWS Shield Standard e gratuito e automatico para todos os clientes AWS. Protege contra ataques DDoS L3/L4 em CloudFront, Route 53 e ELB.',
      reference: 'Shield Standard = gratuito. Shield Advanced = pago ($3000/mes), com suporte e cost protection.'
    },
    {
      question: 'Qual servico AWS cria APIs REST/HTTP gerenciadas?',
      options: ['Amazon CloudFront', 'AWS API Gateway', 'Amazon Route 53', 'Elastic Load Balancer'],
      correct: 1,
      explanation: 'API Gateway e um servico gerenciado para criar, publicar e gerenciar APIs. Integra com Lambda para serverless APIs, EC2, e servicos AWS.',
      reference: 'API Gateway + Lambda = serverless API (padrao muito comum no CLF-C02).'
    },
    {
      question: 'Qual componente conecta multiplas VPCs e redes on-prem como um hub central?',
      options: ['VPC Peering', 'Internet Gateway', 'Transit Gateway', 'NAT Gateway'],
      correct: 2,
      explanation: 'Transit Gateway atua como hub central para conectar multiplas VPCs, VPNs e conexoes Direct Connect. Simplifica topologias de rede complexas.',
      reference: 'VPC Peering = 1:1. Transit Gateway = hub-and-spoke (1:N).'
    }
  ],

  flashcards: [
    { front: 'Quais sao os componentes principais de uma VPC?', back: 'Subnets (publica/privada), Internet Gateway (acesso internet), NAT Gateway (outbound para private subnets), Route Tables (rotas), Security Groups (firewall instance-level), NACLs (firewall subnet-level).' },
    { front: 'Qual a diferenca entre Security Groups e NACLs?', back: 'Security Groups: stateful, instance-level, allow-only. NACLs: stateless, subnet-level, allow+deny, avaliadas em ordem numerica. SGs sao o firewall primario, NACLs sao camada adicional.' },
    { front: 'Qual a diferenca entre VPN e Direct Connect?', back: 'VPN: conexao criptografada pela internet, rapida de configurar, custo menor, latencia variavel. Direct Connect: fibra dedicada, semanas para instalar, custo maior, latencia consistente e baixa.' },
    { front: 'Quais sao as routing policies do Route 53?', back: 'Simple (1 endpoint), Weighted (por peso), Latency (menor latencia), Failover (primary/secondary), Geolocation (por pais), Geoproximity (por proximidade + bias), Multi-value (multiplos + health check).' },
    { front: 'O que e Amazon CloudFront?', back: 'CDN com 400+ Edge Locations. Cache de conteudo estatico/dinamico. HTTPS automatico com ACM. Shield Standard incluso. Lambda@Edge para logica na borda. Origin: S3, ALB, EC2.' },
    { front: 'O que e AWS Transit Gateway?', back: 'Hub central que conecta multiplas VPCs, VPNs e Direct Connect em topologia hub-and-spoke. Simplifica redes complexas. Substitui mesh de VPC Peering quando voce tem muitas VPCs.' },
    { front: 'O que e AWS PrivateLink?', back: 'Permite acessar servicos AWS ou servicos de terceiros de forma privada (sem internet, sem NAT, sem VPN). Usa ENIs (Elastic Network Interfaces) dentro da sua VPC.' },
    { front: 'O que e API Gateway?', back: 'Servico gerenciado para criar APIs REST, HTTP e WebSocket. Integra com Lambda (serverless), EC2, servicos AWS. Suporta throttling, caching, autenticacao, canary deployments.' }
  ],

  lab: {
    scenario: 'Entenda os componentes de rede AWS e como proteger e conectar recursos.',
    objective: 'Configurar VPC com subnets publicas e privadas e entender o fluxo de trafego.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Arquitetura VPC Basica',
        instruction: 'Desenhe uma VPC com: 2 subnets publicas (web servers), 2 subnets privadas (databases), Internet Gateway, NAT Gateway, e ALB.',
        hints: ['Subnets publicas em 2 AZs para HA', 'NAT Gateway na subnet publica para acesso outbound da privada'],
        solution: '```\nVPC: 10.0.0.0/16\n\nSubnet Publica AZ-a: 10.0.1.0/24 -> Internet Gateway\nSubnet Publica AZ-b: 10.0.2.0/24 -> Internet Gateway\nSubnet Privada AZ-a: 10.0.3.0/24 -> NAT Gateway\nSubnet Privada AZ-b: 10.0.4.0/24 -> NAT Gateway\n\nALB (publico) -> EC2 em subnets publicas\nRDS Multi-AZ -> subnets privadas\nNAT Gateway -> subnet publica (permite outbound)\n```',
        verify: '```bash\n# Verificacao conceitual:\n# [x] VPC com CIDR /16\n# [x] 2 subnets publicas em AZs diferentes\n# [x] 2 subnets privadas em AZs diferentes\n# [x] Internet Gateway para subnets publicas\n# [x] NAT Gateway para subnets privadas\n# [x] ALB distribuindo trafego\n```'
      },
      {
        title: 'Configurar Security Groups',
        instruction: 'Crie Security Groups para: (1) ALB (porta 80/443 de qualquer IP), (2) EC2 web (porta 80 apenas do ALB SG), (3) RDS (porta 3306 apenas do EC2 SG).',
        hints: ['Security Groups podem referenciar outros Security Groups', 'Use SG-ID como source em vez de IP range'],
        solution: '```\nSG-ALB:\n  Inbound: 80 (0.0.0.0/0), 443 (0.0.0.0/0)\n  Outbound: All traffic\n\nSG-EC2:\n  Inbound: 80 (SG-ALB)   <- referencia o SG do ALB\n  Outbound: All traffic\n\nSG-RDS:\n  Inbound: 3306 (SG-EC2) <- referencia o SG do EC2\n  Outbound: All traffic\n```',
        verify: '```bash\n# Verificacao:\n# ALB aceita trafego da internet (80/443)\n# EC2 aceita trafego APENAS do ALB\n# RDS aceita trafego APENAS do EC2\n# Cadeia de confianca: Internet -> ALB -> EC2 -> RDS\n```'
      },
      {
        title: 'Escolher Conectividade',
        instruction: 'Para cada cenario, selecione a solucao: (1) Conectar escritorio com AWS rapidamente, (2) Conectar datacenter com latencia consistente, (3) Conectar 20 VPCs entre si.',
        hints: ['Rapido = VPN', 'Latencia consistente = Direct Connect', 'Muitas VPCs = Transit Gateway'],
        solution: '```\n1. Escritorio rapido -> Site-to-Site VPN\n   - Configura em horas, pela internet\n\n2. Datacenter latencia baixa -> Direct Connect\n   - Conexao dedicada, semanas para instalar\n\n3. 20 VPCs -> Transit Gateway\n   - Hub central, evita mesh de VPC Peering\n   - VPC Peering seria 190 conexoes (n*(n-1)/2)\n```',
        verify: '```bash\n# Regra de decisao:\n# Rapido + internet OK -> VPN\n# Dedicado + consistente -> Direct Connect\n# Muitas VPCs -> Transit Gateway\n# 2 VPCs -> VPC Peering\n# Acesso privado a servicos AWS -> PrivateLink\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Security Groups vs NACLs',
      difficulty: 'easy',
      symptom: 'Candidato confunde Security Groups com NACLs e nao sabe qual usar.',
      diagnosis: '```\nSecurity Groups (SG):\n  - Firewall de instance\n  - Stateful (reply automatico)\n  - Allow rules only (no deny)\n  - Todas as regras avaliadas\n  - Default: deny all in, allow all out\n\nNACLs:\n  - Firewall de subnet\n  - Stateless (precisa regra de retorno)\n  - Allow + Deny rules\n  - Avaliadas em ordem numerica\n  - Default: allow all\n```',
      solution: 'Na pratica, use Security Groups como firewall principal (mais facil, stateful). NACLs como camada adicional de defesa. No exame, preste atencao em stateful vs stateless e allow-only vs allow+deny.'
    },
    {
      title: 'Latency Routing vs Geolocation',
      difficulty: 'medium',
      symptom: 'Candidato confunde Latency-based routing com Geolocation routing no Route 53.',
      diagnosis: '```\nLatency-based:\n  - Roteia para Region com MENOR LATENCIA medida\n  - Baseado em medicoes reais de rede\n  - Um usuario no Brasil pode ir para us-east-1 se latencia for menor\n  - Use para: melhor performance\n\nGeolocation:\n  - Roteia por LOCALIZACAO do usuario (pais/continente)\n  - Nao mede latencia, usa IP geolocation\n  - Um usuario no Brasil SEMPRE vai para sa-east-1\n  - Use para: compliance, localizacao de conteudo\n\nGeoproximity:\n  - Combina localizacao com bias ajustavel\n  - Use para: controlar distribuicao de trafego geograficamente\n```',
      solution: 'Latency = melhor performance (medida). Geolocation = por pais/regiao (forcado). Se a questao menciona "compliance" ou "conteudo localizado", e Geolocation. Se menciona "menor latencia" ou "melhor performance", e Latency-based.'
    }
  ]
};
