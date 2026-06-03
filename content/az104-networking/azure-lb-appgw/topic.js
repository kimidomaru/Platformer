window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-networking/azure-lb-appgw'] = {
  theory: `# Azure Load Balancer & Application Gateway

## Relevância no Exame
> Peso estimado **10-15%** no AZ-104. Questões envolvem escolher o balanceador correto e configurar health probes e regras.

## Conceitos Fundamentais

### Azure Load Balancer (ALB)
Balanceador de carga **Layer 4** (TCP/UDP):
- Opera no nível de transporte — não inspeciona conteúdo HTTP
- Distribui tráfego para VMs em um **Backend Pool**
- **Health Probe**: verifica se backends estão saudáveis
- **Load Balancing Rule**: define porta de entrada → porta de backend
- **NAT Rules**: encaminha porta específica para VM específica (para SSH/RDP)

| SKU | Escopo | HA Zones | SLA |
|-----|--------|----------|-----|
| **Basic** | Sem zonas, VMs no mesmo AvSet/VMSS | ❌ | — |
| **Standard** | Zone-redundant, qualquer VM na VNet | ✅ | 99.99% |

> **Para o exame**: Standard é recomendado para produção. Basic será aposentado.

**Tipos:**
- **Public LB**: IP público na frente, distribui para VMs privadas
- **Internal LB**: IP privado na VNet, para tráfego interno (ex: tier web → tier app)

### Application Gateway (AppGW)
Balanceador de carga **Layer 7** (HTTP/HTTPS):
- Inspeciona conteúdo da requisição HTTP
- **URL-based routing**: rota \`/images/*\` para pool A, \`/api/*\` para pool B
- **SSL termination**: decodifica HTTPS no gateway
- **Web Application Firewall (WAF)**: protege contra OWASP Top 10
- **Cookie-based affinity** (sticky sessions)
- **HTTP headers rewrite**

| SKU | Recursos |
|-----|---------|
| **Standard_v2** | Routing, SSL termination, autoscaling |
| **WAF_v2** | Standard_v2 + Web Application Firewall |

### Quando usar qual?

| Critério | Load Balancer | Application Gateway |
|---------|--------------|---------------------|
| Protocolo | TCP/UDP (L4) | HTTP/HTTPS (L7) |
| URL routing | ❌ | ✅ |
| SSL termination | ❌ | ✅ |
| WAF | ❌ | ✅ (WAF SKU) |
| Performance | Alta | Menor que LB |
| Custo | Menor | Maior |

### Azure Traffic Manager
Balanceamento de carga **DNS-based** entre **regiões** (não recursos individuais):
- Não processa tráfego diretamente — apenas resolve DNS
- Métodos: Priority, Weighted, Performance, Geographic, Subnet, MultiValue

### Azure Front Door
CDN + balanceamento global de aplicações web + WAF:
- Edge locations globais, baixa latência
- URL rewrite, caching, WAF global

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Criar Load Balancer Standard com IP público
az network public-ip create --name lb-pip --resource-group myRG --sku Standard --zone 1 2 3
az network lb create \\
  --name myLB \\
  --resource-group myRG \\
  --sku Standard \\
  --frontend-ip-name FrontEnd \\
  --public-ip-address lb-pip \\
  --backend-pool-name BackendPool

# Criar health probe (HTTP na porta 80)
az network lb probe create \\
  --lb-name myLB \\
  --resource-group myRG \\
  --name HealthProbe \\
  --protocol Http \\
  --port 80 \\
  --path /health

# Criar load balancing rule
az network lb rule create \\
  --lb-name myLB \\
  --resource-group myRG \\
  --name HTTPRule \\
  --protocol Tcp \\
  --frontend-port 80 \\
  --backend-port 80 \\
  --frontend-ip-name FrontEnd \\
  --backend-pool-name BackendPool \\
  --probe-name HealthProbe

# Adicionar NIC de VM ao Backend Pool
az network nic ip-config address-pool add \\
  --address-pool BackendPool \\
  --ip-config-name ipconfig1 \\
  --nic-name myNIC \\
  --resource-group myRG \\
  --lb-name myLB
\`\`\`

## Erros Comuns

1. **Backend Pool vazio**: LB distribui para VMs que estão no pool — verificar se as NICs foram adicionadas.
2. **Health Probe failing**: aplicação não responde na porta/path configurada — a VM é removida do pool.
3. **Basic LB sem zones**: não suporta Availability Zones — usar Standard para HA.
4. **AppGW vs LB confusão**: AppGW é para HTTP/HTTPS com routing inteligente; LB é para TCP/UDP genérico.

## Killer.sh Style Challenge

> Uma aplicação tem 3 VMs web (HTTP/HTTPS) e 2 VMs de API. Requisições para \`/api/*\` devem ir para as VMs de API e \`/*\` para as VMs web. Há requisito de WAF contra OWASP. Qual recurso usar e como configurar o routing?
>
> **Resposta**: Application Gateway WAF_v2 com dois Backend Pools (web-pool, api-pool) e URL-based routing rules: regra 1 path=/api/* → api-pool; regra 2 (default) → web-pool. Habilitar WAF em modo Prevention com OWASP 3.2 ruleset.
`,

  quiz: [
    {
      question: 'Uma empresa precisa balancear tráfego HTTP com roteamento baseado em URL — \`/api/*\` para um grupo de VMs e \`/web/*\` para outro. Qual recurso Azure usar?',
      options: [
        'Azure Load Balancer Standard',
        'Application Gateway',
        'Azure Traffic Manager',
        'Azure Front Door'
      ],
      correct: 1,
      explanation: 'Application Gateway opera em Layer 7 (HTTP/HTTPS) e suporta URL-based routing — rotear tráfego para diferentes backend pools baseado no path da URL. Azure Load Balancer opera em Layer 4 (TCP/UDP) e não pode inspecionar URLs. Traffic Manager é DNS-based entre regiões.',
      reference: 'Layer 4 = Load Balancer (TCP/UDP, sem inspecionar conteúdo). Layer 7 = Application Gateway (HTTP, inspeciona URL/headers).'
    },
    {
      question: 'Qual SKU do Azure Load Balancer é necessário para suporte a Availability Zones e SLA de 99.99%?',
      options: [
        'Basic',
        'Standard',
        'Premium',
        'Global'
      ],
      correct: 1,
      explanation: 'Azure Load Balancer Standard suporta Availability Zones (zone-redundant), tem SLA de 99.99%, e pode balancear para qualquer VM na VNet. Load Balancer Basic não suporta zones e só funciona com VMs no mesmo Availability Set ou VMSS. Basic será aposentado — Standard é o recomendado.',
      reference: 'Standard LB = produção, zones, SLA 99.99%. Basic LB = legacy, sem zones, será descontinuado.'
    },
    {
      question: 'O que é uma Health Probe em um Load Balancer Azure e qual é seu comportamento quando falha?',
      options: [
        'Registra métricas de performance — sem impacto no tráfego',
        'Verifica se os backends estão saudáveis; se falhar, o LB para de enviar tráfego para aquele backend',
        'Reinicia automaticamente o processo na VM quando detecta falha',
        'Envia alertas por email quando uma VM fica indisponível'
      ],
      correct: 1,
      explanation: 'Health Probes verificam regularmente se os backends (VMs) estão respondendo na porta/path configurada. Se um backend não responder por um número configurável de tentativas, o LB o marca como "unhealthy" e para de enviar tráfego para ele, distribuindo para os backends saudáveis restantes.',
      reference: 'Configure health probes na porta real da aplicação, não apenas na porta do LB. Probe TCP na porta 80 != aplicação respondendo na porta 80.'
    },
    {
      question: 'Qual é a diferença entre Azure Traffic Manager e Azure Application Gateway?',
      options: [
        'Traffic Manager é para tráfego interno; Application Gateway é para tráfego externo',
        'Traffic Manager faz balanceamento baseado em DNS entre regiões; Application Gateway processa tráfego HTTP/HTTPS em Layer 7 em uma única região',
        'Não há diferença técnica — são o mesmo serviço com nomes diferentes',
        'Traffic Manager só funciona com VMs; Application Gateway só com App Services'
      ],
      correct: 1,
      explanation: 'Traffic Manager é DNS-based: retorna o IP do endpoint mais adequado baseado na política (performance, priority, geographic) — não processa o tráfego HTTP em si. Application Gateway é um proxy reverso que processa o tráfego HTTP/HTTPS, fazendo SSL termination, URL routing e WAF em uma região.',
      reference: 'Traffic Manager = balanceamento global via DNS (multi-região). Application Gateway = proxy L7 em uma região.'
    }
  ],

  flashcards: [
    {
      front: 'Quando usar Azure Load Balancer vs Application Gateway vs Traffic Manager?',
      back: '**Azure Load Balancer** (Layer 4 — TCP/UDP):\n- VMs na mesma região\n- Protocolos não-HTTP (TCP, UDP)\n- Alta performance, baixo custo\n\n**Application Gateway** (Layer 7 — HTTP/HTTPS):\n- URL-based routing\n- SSL termination, WAF, cookie affinity\n- Tráfego HTTP/HTTPS com routing inteligente\n\n**Traffic Manager** (DNS-based — global):\n- Multi-região\n- Não processa tráfego, apenas resolve DNS\n- Routing: Priority, Weighted, Performance, Geographic'
    },
    {
      front: 'Quais são os componentes de uma configuração de Load Balancer Azure?',
      back: '1. **Frontend IP Configuration** — IP público ou privado onde LB recebe tráfego\n2. **Backend Pool** — grupo de VMs (NICs) que recebem tráfego\n3. **Health Probe** — verifica saúde dos backends (TCP, HTTP, HTTPS)\n4. **Load Balancing Rule** — mapeia porta frontend → porta backend\n5. **NAT Rule** — encaminha porta específica para VM específica (SSH, RDP)'
    },
    {
      front: 'O que faz o WAF no Application Gateway?',
      back: '**WAF (Web Application Firewall)** — disponível no SKU WAF_v2:\n\n- Protege contra ataques OWASP Top 10 (SQL injection, XSS, CSRF, etc.)\n- Modos: **Detection** (detecta e loga, não bloqueia) e **Prevention** (detecta e bloqueia)\n- Ruleset: OWASP 3.0/3.1/3.2 ou Microsoft Default Ruleset\n- Regras customizadas podem ser adicionadas\n- Integração com Azure Monitor para logs de WAF'
    }
  ],

  lab: {
    scenario: 'Configure um Internal Load Balancer Standard para distribuir tráfego entre VMs backend da TechNova.',
    objective: 'Criar VNet, VMs, NSG, Load Balancer Standard com health probe e load balancing rule.',
    duration: '30-35 minutos',
    steps: [
      {
        title: 'Criar infraestrutura base',
        instruction: 'Crie o RG e VNet para o lab de Load Balancer.',
        hints: [],
        solution: `\`\`\`bash
az group create --name rg-lb-lab --location eastus
az network vnet create \\
  --name lb-vnet --resource-group rg-lb-lab \\
  --address-prefixes 10.0.0.0/16 \\
  --subnet-name backend-subnet \\
  --subnet-prefixes 10.0.1.0/24
\`\`\``,
        verify: `\`\`\`bash
az network vnet show --name lb-vnet --resource-group rg-lb-lab --query "subnets[0].addressPrefix" -o tsv
# Saída: 10.0.1.0/24
\`\`\``
      },
      {
        title: 'Criar Internal Load Balancer Standard',
        instruction: 'Crie um Internal Load Balancer Standard com IP privado estático 10.0.1.10, health probe na porta 80 e regra de balanceamento.',
        hints: ['Load Balancer interno usa \`--private-ip-address\` em vez de IP público'],
        solution: `\`\`\`bash
# Criar Internal Load Balancer (sem IP público)
az network lb create \\
  --name internal-lb \\
  --resource-group rg-lb-lab \\
  --sku Standard \\
  --frontend-ip-name FrontEnd \\
  --backend-pool-name BackendPool \\
  --vnet-name lb-vnet \\
  --subnet backend-subnet \\
  --private-ip-address 10.0.1.10

# Health Probe HTTP
az network lb probe create \\
  --lb-name internal-lb --resource-group rg-lb-lab \\
  --name HTTPProbe \\
  --protocol Http --port 80 --path /

# Load Balancing Rule
az network lb rule create \\
  --lb-name internal-lb --resource-group rg-lb-lab \\
  --name HTTPRule \\
  --protocol Tcp \\
  --frontend-port 80 --backend-port 80 \\
  --frontend-ip-name FrontEnd \\
  --backend-pool-name BackendPool \\
  --probe-name HTTPProbe
\`\`\``,
        verify: `\`\`\`bash
az network lb show --name internal-lb --resource-group rg-lb-lab \\
  --query "{FrontendIP:frontendIPConfigurations[0].privateIPAddress,Probe:length(probes),Rules:length(loadBalancingRules)}" -o table
# Saída esperada: FrontendIP=10.0.1.10, Probe=1, Rules=1
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-lb-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-lb-lab 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Backend VMs não recebem tráfego do Load Balancer',
      difficulty: 'medium',
      symptom: 'O Load Balancer está configurado, mas tráfego enviado ao IP do LB não chega às VMs do backend pool.',
      diagnosis: `\`\`\`bash
# Verificar se há VMs no backend pool
az network lb address-pool show \\
  --lb-name myLB --name BackendPool --resource-group myRG \\
  --query "backendIPConfigurations[].id" -o tsv

# Verificar status do health probe (se failing, VMs são removidas do pool)
az network lb probe list --lb-name myLB --resource-group myRG \\
  --query "[].{Nome:name,Port:port,Protocol:protocol}" -o table
\`\`\``,
      solution: `**Causas em ordem de probabilidade:**

1. **Backend Pool vazio**: as NICs das VMs não foram adicionadas ao backend pool.

2. **Health Probe failing**: a aplicação não está respondendo na porta/path configurada da probe. Verificar se nginx/apache está rodando na porta correta.

3. **NSG bloqueando a probe**: o NSG na subnet ou NIC das VMs precisa permitir tráfego da Service Tag "AzureLoadBalancer" — verificar se a regra "AllowAzureLoadBalancerInBound" (padrão 65001) não foi sobrescrita por um Deny customizado.

4. **VMs não estão running**: verificar powerState das VMs.`
    }
  ]
};
