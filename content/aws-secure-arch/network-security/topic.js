window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-secure-arch/network-security'] = {
  theory: `# Network Security

## Relevancia no Exame
> **Design Secure Architectures** vale **30%** do SAA-C03. Security Groups, NACLs, WAF, Shield, VPC endpoints e segmentacao de rede sao temas centrais.

## Security Groups vs NACLs

| Feature | Security Groups | Network ACLs |
|---------|----------------|--------------|
| **Nivel** | Instancia (ENI) | Subnet |
| **Estado** | Stateful (retorno automatico) | Stateless (retorno precisa de regra explicita) |
| **Regras** | Apenas Allow | Allow E Deny |
| **Avaliacao** | Todas as regras juntas | Em ordem (menor numero primeiro) |
| **Padrao** | Nega tudo inbound, permite tudo outbound | Permite tudo inbound e outbound |
| **Associacao** | Multiplos SGs por instancia | Um NACL por subnet |

### Security Groups — Pontos-Chave
- Stateful: se inbound e permitido, outbound de resposta e automatico
- Pode referenciar outros SGs (ex: permitir do sg-alb)
- Alteracoes tem efeito imediato
- Sem regras de deny — apenas allow

### NACLs — Pontos-Chave
- Stateless: deve definir regras INBOUND e OUTBOUND
- Numeros de regra: processados do menor para o maior, primeiro match ganha
- Regra 100 Allow HTTP, Regra 200 Deny HTTP -> ALLOW (100 faz match primeiro)
- Portas efemeras (1024-65535) devem ser permitidas para trafego de retorno
- NACL customizado nega tudo por padrao (diferente do NACL padrao)

## AWS WAF (Web Application Firewall)

Protege ALB, CloudFront, API Gateway, AppSync, Cognito contra exploits web.

### Componentes
- **Web ACL**: container de regras, associado a recursos
- **Regras**: IP match, rate-based (DDoS/brute force), SQL injection, XSS, geo match, restricao de tamanho
- **Managed Rule Groups**: AWS Managed (AmazonIPReputationList, CommonRuleSet, SQLiRuleSet) e Marketplace
- **Regras rate-based**: bloqueiam IPs que excedem threshold (ex: 2000 requests/5 min)

## AWS Shield

| Feature | Shield Standard | Shield Advanced |
|---------|----------------|-----------------|
| **Custo** | Gratis (todas as contas) | \\$3,000/mes + data transfer |
| **Protecao** | DDoS L3/L4 | DDoS L3/L4/L7 |
| **Suporte** | Nenhum | DRT (DDoS Response Team) 24/7 |
| **Protecao de custo** | Nao | Sim (creditos por custos de scaling) |
| **Visibilidade** | Basica | Metricas real-time, forense |

## AWS Firewall Manager

Gerenciamento centralizado de seguranca na Organization:
- Gerencia regras WAF, Shield Advanced, Security Groups, Network Firewall, Route 53 DNS Firewall
- Auto-aplica regras a novas contas/recursos
- Requer AWS Organizations

## VPC Endpoints

| Tipo | Gateway Endpoint | Interface Endpoint |
|------|-----------------|-------------------|
| **Servicos** | Apenas S3 e DynamoDB | 100+ servicos AWS |
| **Implementacao** | Entrada na route table | ENI na subnet (PrivateLink) |
| **Custo** | Gratis | \\$0.01/hora + \\$0.01/GB dados |
| **Seguranca** | Endpoint policy | Endpoint policy + Security Groups |

## AWS PrivateLink

Exponha servicos para outros VPCs/contas de forma privada:
- Provider: NLB + VPC Endpoint Service
- Consumer: Interface VPC Endpoint
- Sem VPC peering, internet, NAT ou VPN
- Trafego permanece no backbone AWS

## AWS Network Firewall

Firewall gerenciado em subnet dedicada:
- Regras stateless: 5-tupla (src/dst IP, porta, protocolo)
- Regras stateful: IPS compativel com Suricata, filtragem por dominio, inspecao TLS
- Integra com Firewall Manager para deployment Organization-wide

## Erros Comuns

- Confundir stateful (SG) com stateless (NACL)
- Esquecer portas efemeras para trafego de retorno no NACL
- Usar VPC peering quando PrivateLink e mais apropriado
- Nao saber que Gateway Endpoints sao gratis (S3 + DynamoDB)
- Confundir Shield Standard (gratis, L3/L4) com Advanced (pago, L7+DRT)
`,

  quiz: [
    {
      question: 'Qual a diferenca principal entre Security Groups e NACLs?',
      options: ['Security Groups sao gratis, NACLs sao pagos', 'Security Groups sao stateful, NACLs sao stateless', 'NACLs so se aplicam a EC2, Security Groups a todos os recursos', 'Security Groups suportam regras de deny, NACLs nao'],
      correct: 1,
      explanation: 'Security Groups sao stateful (trafego de retorno automaticamente permitido). NACLs sao stateless (voce deve permitir explicitamente o trafego de retorno incluindo portas efemeras).',
      reference: 'Stateful = SG. Stateless = NACL. Essa distincao e testada frequentemente.'
    },
    {
      question: 'Um NACL tem Regra 100: Allow HTTP, Regra 200: Deny HTTP. O que acontece com trafego HTTP?',
      options: ['Negado (deny prevalece sobre allow)', 'Permitido (Regra 100 e processada primeiro)', 'Depende do Security Group', 'As duas regras se cancelam'],
      correct: 1,
      explanation: 'Regras NACL sao processadas em ordem do menor para o maior numero. Regra 100 faz match primeiro e permite o trafego. Regra 200 nunca e avaliada.',
      reference: 'NACL = regras ordenadas (primeiro match ganha). SG = todas as regras avaliadas juntas.'
    },
    {
      question: 'Qual tipo de VPC Endpoint e gratuito e suporta S3?',
      options: ['Interface Endpoint', 'Gateway Endpoint', 'PrivateLink Endpoint', 'Service Endpoint'],
      correct: 1,
      explanation: 'Gateway Endpoints sao gratuitos e suportam apenas S3 e DynamoDB. Adicionam uma entrada na route table. Interface Endpoints usam PrivateLink (ENI) e custam \\$0.01/hora.',
      reference: 'Gateway = gratis, S3+DynamoDB, route table. Interface = pago, 100+ servicos, ENI.'
    },
    {
      question: 'O que o AWS Shield Advanced oferece que o Standard nao oferece?',
      options: ['Protecao DDoS basica', 'Protecao DDoS L7, equipe DRT e protecao de custos', 'Regras de firewall VPC', 'Gerenciamento de web ACL WAF'],
      correct: 1,
      explanation: 'Shield Advanced (\\$3000/mes) adiciona protecao DDoS L7, equipe DRT 24/7, creditos de protecao de custos e visibilidade de ataques em tempo real. Standard e gratis apenas L3/L4.',
      reference: 'Standard = gratis L3/L4. Advanced = L7, DRT, protecao de custo, \\$3000/mes.'
    },
    {
      question: 'Como funciona o AWS PrivateLink?',
      options: ['VPC peering com criptografia', 'Provider expoe via NLB, consumer acessa via Interface Endpoint', 'Tunel Direct Connect', 'Compartilhamento de bucket S3'],
      correct: 1,
      explanation: 'PrivateLink: provider cria NLB + Endpoint Service, consumer cria Interface VPC Endpoint. Trafego permanece no backbone AWS. Sem internet, peering ou NAT.',
      reference: 'PrivateLink = NLB (provider) + Interface Endpoint (consumer). Privado, sem internet.'
    },
    {
      question: 'Para que serve o AWS Firewall Manager?',
      options: ['Gerenciar firewalls EC2', 'Gerenciamento centralizado de politicas de seguranca na Organization', 'Substituir Security Groups', 'Resposta a DDoS'],
      correct: 1,
      explanation: 'Firewall Manager gerencia centralmente regras WAF, Shield Advanced, Security Groups, Network Firewall e DNS Firewall em todas as contas da Organization.',
      reference: 'Firewall Manager = politica centralizada. Requer AWS Organizations.'
    },
    {
      question: 'Qual tipo de regra WAF ajuda a proteger contra brute force ou DDoS?',
      options: ['Regra IP match', 'Regra rate-based', 'Regra geo match', 'Regra de restricao de tamanho'],
      correct: 1,
      explanation: 'Regras rate-based bloqueiam IPs que excedem um threshold de requisicoes (ex: 2000 requests/5 min). Util para brute force de login e DDoS HTTP flood.',
      reference: 'Rate-based = bloqueio por threshold. IP match = IPs especificos. Geo = bloqueio por pais.'
    },
    {
      question: 'O que voce deve lembrar ao configurar NACLs para trafego web?',
      options: ['Apenas permitir porta 80', 'Permitir inbound porta 80 E outbound portas efemeras (1024-65535)', 'NACLs tratam trafego de retorno automaticamente', 'Configurar regras no Security Group em vez disso'],
      correct: 1,
      explanation: 'NACLs sao stateless. Voce deve permitir inbound HTTP (porta 80) E outbound portas efemeras (1024-65535) para trafego de resposta. Esquecer portas efemeras quebra a conectividade.',
      reference: 'Stateless = regras explicitas para AMBAS direcoes. Portas efemeras para retorno.'
    }
  ],

  flashcards: [
    { front: 'Security Groups vs NACLs?', back: 'SG: stateful, nivel de instancia, apenas allow, todas as regras avaliadas. NACL: stateless, nivel de subnet, allow+deny, regras ordenadas (primeiro match ganha). Retorno SG e automatico; NACL precisa de regras explicitas para portas efemeras.' },
    { front: 'Quais sao os dois tipos de VPC Endpoint?', back: 'Gateway: gratis, apenas S3+DynamoDB, entrada na route table. Interface: PrivateLink, ENI na subnet, 100+ servicos, \\$0.01/hora+dados, suporta Security Groups.' },
    { front: 'Shield Standard vs Advanced?', back: 'Standard: gratis, todas as contas, protecao auto DDoS L3/L4. Advanced: \\$3000/mes, DDoS L7, equipe DRT 24/7, creditos protecao de custo, metricas real-time.' },
    { front: 'O que e AWS PrivateLink?', back: 'Expor servicos privadamente entre VPCs/contas. Provider: NLB + Endpoint Service. Consumer: Interface VPC Endpoint. Trafego no backbone AWS, sem internet/peering/NAT.' },
    { front: 'Contra o que o AWS WAF protege?', back: 'Exploits web: SQL injection, XSS, HTTP floods (rate-based), reputacao IP, bloqueio geografico. Protege ALB, CloudFront, API Gateway, AppSync. Usa Web ACLs com regras managed + custom.' },
    { front: 'O que e AWS Network Firewall?', back: 'Firewall gerenciado no VPC: regras stateless (5-tupla), stateful (IPS Suricata), filtragem por dominio, inspecao TLS. Deployado em subnet de firewall. Gerenciado via Firewall Manager.' },
    { front: 'O que e AWS Firewall Manager?', back: 'Politica de seguranca centralizada na Organization: gerencia WAF, Shield Advanced, Security Groups, Network Firewall, DNS Firewall. Auto-aplica a novas contas/recursos.' },
    { front: 'Ordem de processamento de regras NACL?', back: 'Regras processadas do menor para o maior numero, primeiro match ganha. Regra 100 Allow, Regra 200 Deny = ALLOW (100 faz match primeiro). Sempre termina com regra * DENY ALL. NACL customizado nega tudo por padrao.' }
  ],

  lab: {
    scenario: 'Configure camadas de seguranca de rede para uma aplicacao web em um VPC.',
    objective: 'Praticar configuracao de Security Groups, NACLs e VPC Endpoints.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Configurar Security Group para Web Server',
        instruction: 'Crie um Security Group que permite HTTP (80) e HTTPS (443) de qualquer origem, e SSH (22) apenas do seu IP.',
        hints: ['Use --protocol tcp para cada regra', 'Use seu IP com CIDR /32 para SSH'],
        solution: '```bash\n# Criar SG\naws ec2 create-security-group --group-name web-sg \\\n  --description "Web server SG" --vpc-id vpc-xxx\n\n# Permitir HTTP\naws ec2 authorize-security-group-ingress --group-id sg-xxx \\\n  --protocol tcp --port 80 --cidr 0.0.0.0/0\n\n# Permitir HTTPS\naws ec2 authorize-security-group-ingress --group-id sg-xxx \\\n  --protocol tcp --port 443 --cidr 0.0.0.0/0\n\n# Permitir SSH apenas do seu IP\naws ec2 authorize-security-group-ingress --group-id sg-xxx \\\n  --protocol tcp --port 22 --cidr SEU_IP/32\n```',
        verify: '```bash\naws ec2 describe-security-groups --group-ids sg-xxx \\\n  --query "SecurityGroups[0].IpPermissions"\n# Esperado: 3 regras inbound (80, 443, 22)\n```'
      },
      {
        title: 'Adicionar Regras NACL com Portas Efemeras',
        instruction: 'Crie um NACL customizado para uma subnet publica. Permita inbound HTTP/HTTPS e outbound portas efemeras para trafego de retorno.',
        hints: ['NACLs customizados negam tudo por padrao', 'Portas efemeras: 1024-65535'],
        solution: '```bash\n# Criar NACL\naws ec2 create-network-acl --vpc-id vpc-xxx\n\n# Inbound: Allow HTTP (regra 100)\naws ec2 create-network-acl-entry --network-acl-id acl-xxx \\\n  --rule-number 100 --protocol tcp --port-range From=80,To=80 \\\n  --cidr-block 0.0.0.0/0 --rule-action allow --ingress\n\n# Inbound: Allow HTTPS (regra 110)\naws ec2 create-network-acl-entry --network-acl-id acl-xxx \\\n  --rule-number 110 --protocol tcp --port-range From=443,To=443 \\\n  --cidr-block 0.0.0.0/0 --rule-action allow --ingress\n\n# Outbound: Allow portas efemeras (regra 100)\naws ec2 create-network-acl-entry --network-acl-id acl-xxx \\\n  --rule-number 100 --protocol tcp --port-range From=1024,To=65535 \\\n  --cidr-block 0.0.0.0/0 --rule-action allow --egress\n```',
        verify: '```bash\naws ec2 describe-network-acls --network-acl-ids acl-xxx\n# Esperado: 2 regras inbound allow (100, 110)\n# Esperado: 1 regra outbound allow (100, portas efemeras)\n```'
      },
      {
        title: 'Criar Gateway Endpoint para S3',
        instruction: 'Crie um Gateway VPC Endpoint para S3 permitindo acesso privado sem internet. Associe a uma route table.',
        hints: ['Gateway endpoints sao gratis', 'Use --service-name com.amazonaws.REGION.s3'],
        solution: '```bash\n# Criar Gateway Endpoint para S3\naws ec2 create-vpc-endpoint \\\n  --vpc-id vpc-xxx \\\n  --service-name com.amazonaws.us-east-1.s3 \\\n  --route-table-ids rtb-xxx \\\n  --vpc-endpoint-type Gateway\n\n# Adiciona rota na rtb-xxx apontando prefixos S3\n# para o endpoint (sem internet/NAT necessario)\n```',
        verify: '```bash\naws ec2 describe-vpc-endpoints \\\n  --filters Name=vpc-id,Values=vpc-xxx\n# Esperado: Gateway endpoint para S3, state = available\n\naws ec2 describe-route-tables --route-table-ids rtb-xxx\n# Esperado: rota com destino pl-xxx (prefix list S3)\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Web Server Acessivel via SG mas Bloqueado pelo NACL',
      difficulty: 'medium',
      symptom: 'EC2 web server tem regras corretas no Security Group permitindo HTTP, mas clientes nao conseguem conectar.',
      diagnosis: '```\nChecklist:\n1. Security Group: permite inbound porta 80? SIM\n2. NACL inbound: permite porta 80? VERIFICAR\n3. NACL outbound: permite portas efemeras (1024-65535)? VERIFICAR\n\nCausa comum: NACL customizado sem portas efemeras no outbound\nNACLs sao STATELESS - trafego de retorno precisa de regras explicitas\n\nVerifique:\n  aws ec2 describe-network-acls --filters Name=association.subnet-id,Values=subnet-xxx\n  Verifique Entries (ingress E egress)\n```',
      solution: 'Adicione regra outbound no NACL permitindo TCP portas 1024-65535 para 0.0.0.0/0. NACLs sao stateless, entao mesmo que o SG auto-permita trafego de retorno, o NACL bloqueia sem regras explicitas de portas efemeras.'
    },
    {
      title: 'Resolucao DNS de Interface Endpoint Nao Funciona',
      difficulty: 'hard',
      symptom: 'Criou um Interface VPC Endpoint mas a aplicacao ainda conecta ao servico via internet publica.',
      diagnosis: '```\nChecklist:\n1. Private DNS habilitado no endpoint? VERIFICAR\n   (enableDnsSupport e enableDnsHostnames devem ser true no VPC)\n2. Configuracoes DNS do VPC:\n   aws ec2 describe-vpc-attribute --vpc-id vpc-xxx \\\n     --attribute enableDnsSupport\n   aws ec2 describe-vpc-attribute --vpc-id vpc-xxx \\\n     --attribute enableDnsHostnames\n3. Security Group no endpoint permite trafego da origem?\n4. Endpoint policy permite as acoes necessarias?\n\nTestar resolucao DNS:\n  nslookup SERVICE.REGION.amazonaws.com\n  Deve resolver para IP privado no seu VPC\n```',
      solution: 'Habilite Private DNS no endpoint E garanta que o VPC tem enableDnsSupport=true e enableDnsHostnames=true. Verifique tambem que o Security Group do endpoint permite trafego inbound das instancias da aplicacao.'
    }
  ]
};
