window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-org-complexity/hybrid-networking'] = {
  theory: `# Redes Hibridas e Multi-Region

## Relevancia no Exame
> **Design para Complexidade Organizacional** vale **26%** do SAP-C02. Padroes de conectividade hibrida, recursos avancados do Transit Gateway, resiliencia do Direct Connect e redes multi-Region sao temas frequentes.

## AWS Transit Gateway (TGW)

Hub central para conectar VPCs e redes on-premises em escala:
- **Route Tables**: TGW tem tabelas de rotas proprias. Cada attachment (VPC, VPN, DX GW) e associado a uma route table.
- **Peering**: conecte TGWs entre Regions (TGW peering inter-Region) — sem gargalo de banda
- **Multicast**: suporte a IP multicast entre VPCs anexadas
- **Network Manager**: visao global da topologia on-prem + cloud
- **TGW Connect**: integracao com SD-WAN via GRE (mais rapido que VPN)

### TGW vs VPC Peering
| Fator | VPC Peering | Transit Gateway |
|-------|-------------|-----------------|
| **Escala** | N*(N-1)/2 conexoes | Hub-and-spoke, N conexoes |
| **Roteamento** | Nao-transitivo | Transitivo |
| **Banda** | Sem limite (mesma Region) | 50 Gbps por AZ por attachment |
| **Cross-Region** | Sim | Sim (TGW peering) |
| **Custo** | So transferencia de dados | Por attachment + dados |

## AWS Direct Connect (DX)

Conexao privada dedicada de on-premises para AWS:
- **Dedicated Connection**: 1, 10 ou 100 Gbps diretamente da AWS
- **Hosted Connection**: velocidades menores (50 Mbps – 10 Gbps) via parceiro DX
- **Virtual Interfaces (VIFs)**:
  - **Private VIF**: acessa recursos VPC via IP privado
  - **Public VIF**: acessa servicos publicos AWS (S3, DynamoDB) via DX
  - **Transit VIF**: conecta ao Transit Gateway (melhor para multi-VPC)
- **DX Gateway**: conecta um unico DX a multiplas VPCs em diferentes Regions
- **LAG**: Link Aggregation Group — agrupa multiplos DX para maior banda + redundancia

### Padroes de Resiliencia DX

| Padrao | Disponibilidade | Design |
|--------|----------------|--------|
| **DX unico** | ~99,9% | Basico; ponto unico de falha |
| **DX duplo (mesma localizacao)** | ~99,95% | Duas conexoes, mesmo DX location |
| **DX duplo (localizacoes diferentes)** | ~99,99% | Resiliencia maxima |
| **DX + VPN backup** | ~99,95% | DX principal, VPN como failover |

Roteamento BGP: use diferentes BGP communities para preferir DX sobre VPN.

## Site-to-Site VPN

| Feature | Valor |
|---------|-------|
| **Tunnels por VPN** | 2 (active/standby por padrao, active/active com ECMP no TGW) |
| **Banda** | 1,25 Gbps por tunnel |
| **Criptografia** | IKEv1/IKEv2, AES-128/256 |
| **Roteamento** | Estatico ou BGP (dinamico) |
| **HA** | Use 2 customer gateways (2 dispositivos fisicos) |

**Accelerated VPN**: roteia trafego VPN pelo Global Accelerator para melhor performance.

## AWS PrivateLink (VPC Endpoint Services)

Exponha servicos para outras VPCs/contas sem internet ou VPC peering:
- **Interface Endpoint**: ENI na subnet da VPC — conecta a servicos AWS suportados ou servicos PrivateLink
- **Gateway Endpoint**: apenas S3 e DynamoDB — sem custo de transferencia de dados
- **PrivateLink**: provedor cria NLB, consumidores criam Interface Endpoint
- **Resolucao DNS**: deve estar habilitada na VPC para nomes DNS privados resolverem

## AWS Global Accelerator

Melhore disponibilidade e performance de aplicacoes globais:
- **IPs Anycast**: 2 IPs estaticos que roteiam para o edge location AWS mais proximo
- **Trafego TCP/UDP**: nao e apenas HTTP (diferente do CloudFront)
- **Health checks**: failover automatico para endpoints saudaveis
- **Traffic dials**: alterne porcentagem de trafego entre grupos de endpoints
- **Casos de uso**: failover multi-Region, gaming, IoT, workloads nao-HTTP

### Global Accelerator vs CloudFront
| Fator | Global Accelerator | CloudFront |
|-------|-------------------|------------|
| **Protocolo** | TCP/UDP | HTTP/HTTPS |
| **Cache** | Nao | Sim |
| **Caso de uso** | Performance + HA | Entrega de conteudo |
| **IPs** | IPs Anycast estaticos | Dinamicos |

## Network Firewall

Firewall stateful gerenciado para VPCs:
- **Inspecao stateful**: rastreia estado da conexao
- **Regras Suricata**: formato IDS/IPS open-source
- **Inspecao centralizada**: inspete trafego via TGW com VPC de firewall
- **Integracao**: CloudWatch, S3 para logs

## Erros Comuns

- Usar VPC peering para muitas VPCs (use TGW para hub-and-spoke)
- Nao saber que DX Gateway permite uma conexao DX acessar multiplas Regions
- Esquecer Accelerated VPN para VPN sensivel a latencia
- Confundir Global Accelerator (TCP/UDP, performance) com CloudFront (HTTP, cache)
- Nao configurar dois customer gateways para HA do VPN
`,

  quiz: [
    {
      question: 'Quando escolher Transit Gateway em vez de VPC Peering?',
      options: ['Sempre — TGW e sempre melhor', 'Quando voce tem muitas VPCs precisando de conectividade transitiva (hub-and-spoke)', 'Apenas para conexoes cross-Region', 'Apenas quando banda excede 10 Gbps'],
      correct: 1,
      explanation: 'TGW e ideal para hub-and-spoke em escala: N conexoes em vez de N*(N-1)/2 em malha completa. TGW suporta roteamento transitivo (VPC A -> TGW -> VPC B). VPC Peering e mais barato e simples para poucas VPCs.',
      reference: 'TGW = transitivo, hub-and-spoke. VPC Peering = nao-transitivo, mais simples/barato para poucas VPCs.'
    },
    {
      question: 'Qual a diferenca entre Private VIF e Transit VIF no Direct Connect?',
      options: ['Nenhuma, sao iguais', 'Private VIF conecta a uma unica VPC; Transit VIF conecta a um Transit Gateway (muitas VPCs)', 'Transit VIF e mais rapido', 'Private VIF requer BGP'],
      correct: 1,
      explanation: 'Private VIF: conecta DX diretamente a uma unica VPC. Transit VIF: conecta DX a um Transit Gateway, que pode rotear para muitas VPCs. Para conectividade multi-VPC, use DX Gateway + Transit VIF.',
      reference: 'Private VIF = uma VPC. Transit VIF = TGW = muitas VPCs. DX Gateway = multi-Region.'
    },
    {
      question: 'Qual e o padrao de maior resiliencia para Direct Connect?',
      options: ['Conexao DX unica com backup VPN', 'Dois DX no mesmo DX location', 'Dois DX em DX locations diferentes', 'DX com multiplos VIFs'],
      correct: 2,
      explanation: 'Resiliencia maxima: duas conexoes DX em DX locations fisicos diferentes. Protege contra falha do DX location. Mesmo location = ~99,95%, locations diferentes = ~99,99%.',
      reference: 'Max DX resiliencia = conexoes duplas, locations diferentes (~99,99%). Mesmo location = 99,95%.'
    },
    {
      question: 'O que o Global Accelerator oferece que o CloudFront NAO oferece?',
      options: ['Cache de conteudo no edge', 'Otimizacao TCP/UDP e IPs Anycast estaticos para workloads nao-HTTP', 'Protecao DDoS', 'Certificados SSL customizados'],
      correct: 1,
      explanation: 'Global Accelerator: suporte TCP/UDP, IPs Anycast estaticos, roteia para edge mais proximo pelo backbone AWS. CloudFront: apenas HTTP/HTTPS, cache de conteudo. Use Global Accelerator para gaming, IoT, workloads nao-HTTP.',
      reference: 'Global Accelerator = TCP/UDP, IPs estaticos, performance. CloudFront = HTTP, cache, entrega de conteudo.'
    },
    {
      question: 'Qual feature VPN habilita os dois tunnels ativos simultaneamente no Transit Gateway?',
      options: ['HA VPN', 'Roteamento BGP', 'ECMP (Equal Cost Multi-Path)', 'Accelerated VPN'],
      correct: 2,
      explanation: 'Por padrao, S2S VPN tem 2 tunnels (active/standby). Com TGW e ECMP habilitado, ambos tunnels ficam ativos simultaneamente, dobrando a banda para 2,5 Gbps por conexao VPN.',
      reference: 'ECMP no TGW = tunnels VPN active/active = 2x banda (2,5 Gbps por conexao).'
    },
    {
      question: 'Qual e a finalidade do DX Gateway?',
      options: ['Conectar DX a internet', 'Permitir uma conexao DX acessar VPCs em multiplas Regions AWS', 'Criptografar trafego Direct Connect', 'Funcionar como VPN gateway'],
      correct: 1,
      explanation: 'DX Gateway: recurso global que permite uma conexao DX conectar a VPCs em multiplas Regions. Sem ele, voce precisaria de uma conexao DX separada por Region.',
      reference: 'DX Gateway = um DX -> multiplas Regions. Recurso global, sem custo adicional.'
    },
    {
      question: 'Qual a diferenca entre Interface Endpoint e Gateway Endpoint?',
      options: ['Interface suporta S3 e DynamoDB; Gateway suporta todos os servicos', 'Gateway suporta apenas S3 e DynamoDB (gratuito); Interface suporta maioria dos servicos via ENI (custo por hora)', 'Sao identicos', 'Interface e mais rapido'],
      correct: 1,
      explanation: 'Gateway Endpoint: gratuito, apenas S3 e DynamoDB, usa entradas na route table. Interface Endpoint: custo por hora, usa ENI na subnet, suporta maioria dos servicos e servicos PrivateLink.',
      reference: 'Gateway Endpoint = S3/DynamoDB, gratuito, route table. Interface Endpoint = ENI, custo hora, maioria dos servicos.'
    },
    {
      question: 'O que e Accelerated Site-to-Site VPN?',
      options: ['VPN com aceleracao de hardware', 'VPN que usa AWS Global Accelerator para otimizar roteamento pelo backbone AWS em vez da internet publica', 'Tipo mais rapido de Direct Connect', 'VPN com ECMP habilitado'],
      correct: 1,
      explanation: 'Accelerated VPN roteia trafego VPN pelos edge locations do Global Accelerator e depois pelo backbone AWS. Reduz latencia para clientes distantes das Regions AWS. Funciona com Transit Gateway.',
      reference: 'Accelerated VPN = VPN pelo backbone Global Accelerator. Melhor latencia que internet publica.'
    }
  ],

  flashcards: [
    { front: 'Transit Gateway vs VPC Peering?', back: 'TGW: roteamento transitivo, hub-and-spoke (N conexoes), suporta TGW peering, 50 Gbps/AZ/attachment, custo por attachment. VPC Peering: nao-transitivo, N*(N-1)/2 conexoes, so transferencia de dados, simples para poucas VPCs.' },
    { front: 'Tipos de VIF do Direct Connect?', back: 'Private VIF: VPC unica via IP privado. Public VIF: servicos publicos AWS (S3, DynamoDB, etc.) via DX. Transit VIF: conecta ao TGW (muitas VPCs, muitas Regions). Use DX Gateway para multi-Region.' },
    { front: 'Padroes de resiliencia DX?', back: 'DX unico: 99,9%, SPOF. DX duplo mesmo location: 99,95%. DX duplo locations diferentes: 99,99% (maximo). DX + backup VPN: 99,95%. BGP communities para preferir DX sobre VPN.' },
    { front: 'Features do Global Accelerator?', back: '2 IPs Anycast estaticos -> edge location mais proximo. Suporte TCP/UDP (nao so HTTP). Roteia pelo backbone AWS. Traffic dials para split de trafego. Health checks + failover automatico. Para gaming, IoT, nao-HTTP.' },
    { front: 'Comparacao de VPC Endpoints?', back: 'Gateway Endpoint: S3 + DynamoDB, gratuito, entradas na route table. Interface Endpoint: maioria dos servicos + PrivateLink, ENI na subnet, custo hora+dados, requer DNS habilitado.' },
    { front: 'Fatos-chave Site-to-Site VPN?', back: '2 tunnels por VPN (active/standby). 1,25 Gbps por tunnel. ECMP no TGW = active/active (2,5 Gbps). Accelerated VPN = backbone Global Accelerator. Para HA: 2 customer gateways.' },
    { front: 'AWS Network Firewall?', back: 'Firewall VPC stateful gerenciado. Regras Suricata IDS/IPS. Inspecao centralizada via TGW + VPC firewall dedicada. Logs para CloudWatch/S3/Kinesis. Para inspecao profunda de pacotes entre VPCs.' },
    { front: 'Caso de uso DX Gateway?', back: 'Conectar UMA conexao Direct Connect a VPCs em MULTIPLAS Regions (recurso global). Sem DX Gateway, um DX por Region. Combine com Transit VIF para multi-VPC por Region.' }
  ],

  lab: {
    scenario: 'Projete uma arquitetura de conectividade hibrida resiliente para empresa com data center on-premises.',
    objective: 'Praticar configuracao de Transit Gateway, VPN e validacao de conectividade.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Criar Transit Gateway e Attachments',
        instruction: 'Crie um Transit Gateway e anexe duas VPCs a ele, verificando roteamento transitivo.',
        hints: ['TGW precisa de entradas de route table nas VPCs', 'TGW propaga rotas automaticamente se habilitado'],
        solution: '```bash\n# Criar Transit Gateway\naws ec2 create-transit-gateway \\\n  --description "TGW Empresa" \\\n  --options AmazonSideAsn=64512,AutoAcceptSharedAttachments=enable,DefaultRouteTableAssociation=enable,DefaultRouteTablePropagation=enable\n\n# Anexar VPC-A\naws ec2 create-transit-gateway-vpc-attachment \\\n  --transit-gateway-id tgw-xxxx \\\n  --vpc-id vpc-aaaa \\\n  --subnet-ids subnet-1111 subnet-2222\n\n# Atualizar route tables das VPCs para rotear pelo TGW\naws ec2 create-route --route-table-id rtb-aaaa \\\n  --destination-cidr-block 10.1.0.0/16 \\\n  --transit-gateway-id tgw-xxxx\n```',
        verify: '```bash\naws ec2 describe-transit-gateway-attachments \\\n  --filters Name=transit-gateway-id,Values=tgw-xxxx\n# Esperado: 2 attachments com state "available"\n\naws ec2 get-transit-gateway-route-table-propagations \\\n  --transit-gateway-route-table-id tgw-rtb-xxxx\n# Esperado: CIDRs de ambas VPCs propagados\n```'
      },
      {
        title: 'Configurar Site-to-Site VPN com BGP',
        instruction: 'Crie um Customer Gateway e Site-to-Site VPN conectado ao Transit Gateway com roteamento BGP.',
        hints: ['Customer Gateway precisa do IP publico do roteador on-premises', 'ASN BGP on-prem deve diferir do lado AWS'],
        solution: '```bash\n# Criar Customer Gateway\naws ec2 create-customer-gateway \\\n  --type ipsec.1 \\\n  --public-ip 203.0.113.1 \\\n  --bgp-asn 65000\n\n# Criar VPN anexada ao TGW\naws ec2 create-vpn-connection \\\n  --type ipsec.1 \\\n  --customer-gateway-id cgw-xxxx \\\n  --transit-gateway-id tgw-xxxx\n```',
        verify: '```bash\naws ec2 describe-vpn-connections \\\n  --filters Name=transit-gateway-id,Values=tgw-xxxx\n# Esperado: VPN em state "available"\n# VgwTelemetry: 2 tunnels, Status = UP\n\n# Baixar configuracao VPN para roteador on-prem\naws ec2 get-vpn-connection-device-sample-configuration \\\n  --vpn-connection-id vpn-xxxx \\\n  --vpn-connection-device-type-id "Generic"\n```'
      },
      {
        title: 'Criar VPC Endpoint para Acesso Privado ao S3',
        instruction: 'Crie um S3 Gateway Endpoint na VPC para que instancias EC2 acessem S3 sem traversar a internet.',
        hints: ['Gateway endpoints sao gratuitos e nao requerem ENI', 'Route table deve ser atualizada'],
        solution: '```bash\n# Criar S3 Gateway Endpoint\naws ec2 create-vpc-endpoint \\\n  --vpc-id vpc-aaaa \\\n  --service-name com.amazonaws.us-east-1.s3 \\\n  --route-table-ids rtb-aaaa rtb-bbbb\n\n# Para Interface Endpoint (outros servicos)\naws ec2 create-vpc-endpoint \\\n  --vpc-id vpc-aaaa \\\n  --vpc-endpoint-type Interface \\\n  --service-name com.amazonaws.us-east-1.execute-api \\\n  --subnet-ids subnet-1111 \\\n  --security-group-ids sg-xxxx \\\n  --private-dns-enabled\n```',
        verify: '```bash\naws ec2 describe-vpc-endpoints \\\n  --filters Name=vpc-id,Values=vpc-aaaa\n# Esperado: S3 gateway endpoint com State=available\n# Route table tem pl-XXXXXX (S3 prefix list) como destino\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Rotas TGW Nao Propagando Entre VPCs',
      difficulty: 'medium',
      symptom: 'Instancias VPC A nao alcancam instancias VPC B apesar de ambas VPCs estarem anexadas ao mesmo Transit Gateway.',
      diagnosis: '```\nChecklist para conectividade TGW:\n1. TGW Attachments:\n   aws ec2 describe-transit-gateway-attachments\n   State deve ser "available" (nao pending/failed)\n\n2. Propagacao de route table TGW:\n   aws ec2 get-transit-gateway-route-table-propagations \\\n     --transit-gateway-route-table-id tgw-rtb-xxxx\n   CIDRs de ambas VPCs devem aparecer\n\n3. Route Tables das VPCs:\n   RT da subnet VPC A deve ter rota 10.1.0.0/16 -> TGW\n   RT da subnet VPC B deve ter rota 10.0.0.0/16 -> TGW\n\n4. Security Groups:\n   Permitir trafego do CIDR da outra VPC\n\n5. Selecao de subnet:\n   Subnets do attachment TGW devem estar em cada AZ que precisa de conectividade\n```',
      solution: 'Verifique todas as quatro camadas: (1) state do attachment TGW = available, (2) route table TGW tem CIDRs de ambas VPCs, (3) route tables das subnets das VPCs tem rotas apontando para TGW, (4) Security Groups permitem o trafego. TGW frequentemente e mal configurado na camada de route table das VPCs.'
    },
    {
      title: 'Sessao BGP do Direct Connect Nao Estabelecendo',
      difficulty: 'hard',
      symptom: 'Conexao Direct Connect esta ativa mas sessao BGP falha ao estabelecer para o Virtual Interface.',
      diagnosis: '```\nChecklist de troubleshooting BGP:\n1. Incompatibilidade de ASN BGP:\n   ASN BGP do VIF AWS deve corresponder a config do roteador\n   Verificar: aws directconnect describe-virtual-interfaces\n   Campo: asn (lado AWS) vs customerRouterConfig\n\n2. Autenticacao BGP:\n   Chave MD5 deve corresponder exatamente nos dois lados\n\n3. IP do neighbor BGP:\n   IP peer AWS do console vs configurado no roteador\n   Exemplo: AWS=169.254.x.1/30, Customer=169.254.x.2/30\n\n4. Incompatibilidade MTU:\n   Recomendado: 1500 para Private VIF, 9001 para Jumbo frames\n   Incompatibilidade causa flapping da sessao\n\n5. VLAN tagging:\n   VLAN deve corresponder a configuracao do VIF\n```',
      solution: 'Verifique ASN BGP, IPs de neighbor (da config do VIF AWS), chave MD5, VLAN ID e MTU no roteador do cliente. Todos os parametros devem corresponder exatamente a configuracao do VIF AWS. Use aws directconnect describe-virtual-interfaces para obter os parametros exatos que AWS espera.'
    }
  ]
};
