window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-networking/vnet-nsg'] = {
  theory: `# Azure Virtual Networks & Network Security Groups

## Relevância no Exame
> Peso estimado **15-20%** no AZ-104. Networking é um dos domínios mais complexos — VNets, subnets, NSGs, peering e roteamento costumam aparecer em cenários práticos.

## Conceitos Fundamentais

### Virtual Network (VNet)
Rede privada isolada no Azure onde você coloca seus recursos:
- Definida por um **address space** (CIDR block), ex: \`10.0.0.0/16\`
- Dividida em **subnets** (sub-redes) dentro do address space
- Recursos na mesma VNet se comunicam por padrão
- Tráfego entre VNets diferentes é **bloqueado por padrão** (requer VNet Peering)

### Subnets
Divisões da VNet para organização e controle de tráfego:
- Cada subnet recebe um range CIDR do address space da VNet
- Azure **reserva 5 IPs** em cada subnet: .0 (network), .1 (gateway), .2 (DNS), .3 (DNS), .255 (broadcast)
- Uma subnet pode ter apenas um NSG associado
- Recursos NIC (de VMs) ficam em subnets

> **Atenção no exame**: Uma subnet /28 tem 16 IPs totais - 5 reservados = **11 utilizáveis**.

### Network Security Group (NSG)
Firewall stateful que controla tráfego de rede. Pode ser associado a:
- **Subnet** (afeta todos os recursos na subnet)
- **NIC de VM** (afeta apenas aquela interface)

Se um NSG está na subnet E outro na NIC, o tráfego passa pelos dois (**AND logic**).

#### Regras de NSG

Cada regra tem:
- **Prioridade**: 100-4096 (menor = maior prioridade)
- **Origem/Destino**: IP, CIDR, Service Tag ou Application Security Group
- **Protocolo**: TCP, UDP, ICMP, Any
- **Porta(s)**: número ou range
- **Ação**: Allow ou Deny

**Regras padrão (não editáveis, prioridade 65000-65500):**
| Prioridade | Nome | Direção | Allow/Deny |
|-----------|------|---------|-----------|
| 65000 | AllowVnetInBound | Inbound | Allow |
| 65001 | AllowAzureLoadBalancerInBound | Inbound | Allow |
| 65500 | DenyAllInBound | Inbound | Deny |
| 65000 | AllowVnetOutBound | Outbound | Allow |
| 65001 | AllowInternetOutBound | Outbound | Allow |
| 65500 | DenyAllOutBound | Outbound | Deny |

### Service Tags
Grupos predefinidos de prefixos de IP para serviços Azure, simplificando regras NSG:
- **Internet**: IPs públicos fora da VNet
- **VirtualNetwork**: address space da VNet (e VNets peered)
- **AzureLoadBalancer**: IPs do Azure Load Balancer
- **Storage**: IPs do Azure Storage
- **Sql**: IPs do Azure SQL
- **AppService**: IPs do Azure App Service

### Application Security Groups (ASG)
Permite agrupar VMs por função lógica (sem precisar saber IPs) e usar como origem/destino em regras NSG:
\`\`\`
Sem ASG: regra "Allow porta 443 de 10.0.1.4, 10.0.1.5, 10.0.1.6"
Com ASG: regra "Allow porta 443 de ASG-WebServers"
\`\`\`

### VNet Peering
Conecta duas VNets (mesma ou diferentes regiões) para comunicação direta:
- **VNet Peering (mesma região)**: baixa latência, alta performance
- **Global VNet Peering**: entre regiões diferentes
- Peering **não é transitivo**: se A↔B e B↔C, A e C não se comunicam (precisa A↔C separado)
- Configurado em ambas as direções (A→B e B→A)

### User-Defined Routes (UDR) e Route Tables
Por padrão, Azure roteia tráfego automaticamente. Para personalizar:
- **Route Tables** definem rotas customizadas
- Associadas a subnets
- Podem forçar tráfego para um NVA (Network Virtual Appliance), VPN Gateway ou Internet

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Criar VNet com address space
az network vnet create \\
  --name myVNet \\
  --resource-group myRG \\
  --location eastus \\
  --address-prefixes 10.0.0.0/16

# Criar subnet
az network vnet subnet create \\
  --name WebSubnet \\
  --vnet-name myVNet \\
  --resource-group myRG \\
  --address-prefixes 10.0.1.0/24

# Criar NSG
az network nsg create \\
  --name WebNSG \\
  --resource-group myRG \\
  --location eastus

# Criar regra NSG — permitir HTTP inbound
az network nsg rule create \\
  --nsg-name WebNSG \\
  --resource-group myRG \\
  --name AllowHTTP \\
  --priority 100 \\
  --direction Inbound \\
  --access Allow \\
  --protocol Tcp \\
  --source-address-prefixes Internet \\
  --source-port-ranges '*' \\
  --destination-address-prefixes '*' \\
  --destination-port-ranges 80 443

# Associar NSG à subnet
az network vnet subnet update \\
  --name WebSubnet \\
  --vnet-name myVNet \\
  --resource-group myRG \\
  --network-security-group WebNSG

# Criar VNet Peering (ambas as direções)
az network vnet peering create \\
  --name VNet1-to-VNet2 \\
  --vnet-name VNet1 \\
  --resource-group myRG \\
  --remote-vnet VNet2 \\
  --allow-vnet-access

az network vnet peering create \\
  --name VNet2-to-VNet1 \\
  --vnet-name VNet2 \\
  --resource-group myRG \\
  --remote-vnet VNet1 \\
  --allow-vnet-access

# Verificar effective routes em uma NIC
az network nic show-effective-route-table \\
  --name myNIC \\
  --resource-group myRG \\
  --output table

# Verificar effective NSG rules em uma NIC
az network nic list-effective-nsg \\
  --name myNIC \\
  --resource-group myRG

# Criar Application Security Group
az network asg create \\
  --name ASG-WebServers \\
  --resource-group myRG

# Usar ASG em regra NSG
az network nsg rule create \\
  --nsg-name AppNSG \\
  --resource-group myRG \\
  --name AllowFromWeb \\
  --priority 200 \\
  --direction Inbound \\
  --access Allow \\
  --source-asgs ASG-WebServers \\
  --destination-port-ranges 8080
\`\`\`

## Erros Comuns

1. **Peering assimétrico**: configurar apenas um lado do peering — os dois lados precisam ser criados.
2. **NSG na subnet E na NIC conflitando**: ambos são avaliados — tráfego precisa passar pelos dois.
3. **Confundir direction do NSG**: Inbound = entrando na VM; Outbound = saindo da VM.
4. **Address space overlap em Peering**: as VNets não podem ter address spaces sobrepostos para fazer peering.
5. **IPs reservados**: esquecer que Azure reserva 5 IPs por subnet no planejamento de capacidade.

## Killer.sh Style Challenge

> **Cenário**:
> - VNet \`app-vnet\` (10.0.0.0/16) com subnets: \`web-subnet\` (10.0.1.0/24) e \`db-subnet\` (10.0.2.0/24)
> - VMs web na web-subnet devem aceitar HTTP/HTTPS da Internet
> - VMs DB na db-subnet devem aceitar SQL (1433) apenas das VMs web
> - Nenhum outro tráfego inbound deve ser permitido nas VMs DB
> - VMs DB não devem ter acesso à Internet
>
> **Desenhe as regras NSG necessárias para web-subnet e db-subnet.**
>
> **Resposta**:
> - NSG web-subnet: Allow 80/443 from Internet inbound; Allow all outbound (padrão)
> - NSG db-subnet: Allow 1433 from 10.0.1.0/24 (ou ASG-WebServers) inbound; Deny all outbound to Internet (adicionar regra Deny Internet outbound com prioridade < 65001)
`,

  quiz: [
    {
      question: 'Uma subnet /28 no Azure tem quantos endereços IP utilizáveis (disponíveis para recursos)?',
      options: [
        '16',
        '14',
        '11',
        '13'
      ],
      correct: 2,
      explanation: 'Uma subnet /28 tem 16 endereços IP totais. O Azure reserva 5: .0 (network address), .1 (default gateway), .2 (DNS mapping), .3 (DNS mapping), .255 (broadcast). 16 - 5 = 11 endereços utilizáveis.',
      reference: 'Memorize: Azure reserva sempre 5 IPs por subnet. Calcule: 2^(32-prefixo) - 5 = IPs utilizáveis.'
    },
    {
      question: 'Uma VM tem um NSG associado à sua NIC que permite o tráfego na porta 80. A subnet onde a VM está tem outro NSG que nega todo o tráfego inbound. A VM consegue receber tráfego na porta 80?',
      options: [
        'Sim — o NSG da NIC tem precedência sobre o NSG da subnet',
        'Não — o tráfego precisa passar por ambos os NSGs; o Deny da subnet bloqueia',
        'Sim — AllowVnetInBound da subnet permite todo tráfego interno',
        'Depende da prioridade das regras em cada NSG'
      ],
      correct: 1,
      explanation: 'Quando há NSG na subnet E na NIC, o tráfego Inbound passa primeiro pelo NSG da subnet, depois pelo NSG da NIC. O Deny no NSG da subnet bloqueia antes de chegar à NIC. Para tráfego Outbound, a ordem é inversa: NIC → Subnet. Ambos os NSGs precisam permitir.',
      reference: 'Inbound: subnet NSG → NIC NSG. Outbound: NIC NSG → subnet NSG. Ambos devem permitir.'
    },
    {
      question: 'Você configurou VNet Peering entre VNet-A (10.0.0.0/16) e VNet-B (10.1.0.0/16). VNet-B também tem peering com VNet-C (10.2.0.0/16). Uma VM em VNet-A consegue comunicar com uma VM em VNet-C?',
      options: [
        'Sim — VNet Peering é transitivo por padrão',
        'Não — VNet Peering não é transitivo; VNet-A e VNet-C precisam de peering direto',
        'Sim, mas apenas se VNet-B tiver "Use Remote Gateways" habilitado',
        'Não é possível ter 3 VNets em peering'
      ],
      correct: 1,
      explanation: 'VNet Peering NÃO é transitivo. Mesmo que A↔B e B↔C existam, A não pode alcançar C através de B. Para conectar A e C, é necessário criar um peering direto A↔C. Alternativa: usar Hub-and-Spoke com Azure Virtual WAN ou Azure Firewall como hub de trânsito.',
      reference: 'VNet Peering não é transitivo — pegadinha clássica do exame. Use Hub-Spoke ou Azure vWAN para trânsito.'
    },
    {
      question: 'O que são Service Tags em regras de NSG?',
      options: [
        'Tags personalizadas para identificar NSGs no portal',
        'Grupos predefinidos de prefixos de IP que representam serviços Azure, simplificando regras de firewall',
        'Certificados SSL para serviços Azure',
        'Identificadores de serviços em load balancers'
      ],
      correct: 1,
      explanation: 'Service Tags são grupos gerenciados pela Microsoft de prefixos de IP para serviços Azure específicos (Storage, Sql, AppService, Internet, etc.). Ao usar "Storage" como destino em uma regra NSG, o Azure automaticamente expande para todos os IPs do serviço Storage da região, sem precisar listar IPs manualmente. A Microsoft atualiza essas listas automaticamente.',
      reference: 'Use Service Tags em vez de IPs manuais — a Microsoft mantém a lista atualizada. Exemplos: Storage, Sql, AzureActiveDirectory, Internet.'
    },
    {
      question: 'Qual é a prioridade das regras padrão "DenyAllInBound" e "DenyAllOutBound" de um NSG?',
      options: [
        '100 (mais alta)',
        '4096 (mais baixa)',
        '65500',
        '1000'
      ],
      correct: 2,
      explanation: 'As regras padrão DenyAllInBound e DenyAllOutBound têm prioridade 65500 (alta numeração = baixa prioridade = avaliadas por último). Isso garante que suas regras customizadas (com prioridade 100-4096) sejam avaliadas antes do deny padrão. Se nenhuma regra customizada permitir o tráfego, o Deny padrão bloqueia.',
      reference: 'Regras NSG: menor número = maior prioridade. Regras padrão (65000-65500) são sempre as últimas avaliadas.'
    },
    {
      question: 'Uma organização precisa permitir que todas as VMs do grupo "WebServers" possam acessar VMs do grupo "DatabaseServers" na porta 1433, sem precisar manter listas de IPs. Qual recurso usar?',
      options: [
        'VNet Peering',
        'Route Tables (UDR)',
        'Application Security Groups (ASG)',
        'Network Watcher'
      ],
      correct: 2,
      explanation: 'Application Security Groups permitem agrupar VMs por função lógica e referenciar esses grupos em regras NSG. Ao associar a NIC de uma VM ao ASG "WebServers" e criar uma regra NSG com source=ASG-WebServers e destination=ASG-DatabaseServers, o tráfego é controlado por função sem precisar gerenciar IPs.',
      reference: 'ASGs = substituem IPs em regras NSG. Associe NICs aos ASGs, referencie ASGs nas regras.'
    }
  ],

  flashcards: [
    {
      front: 'Quantos IPs o Azure reserva em cada subnet? Quais são eles?',
      back: 'O Azure reserva **5 IPs** em cada subnet:\n- **.0** — Network address\n- **.1** — Default gateway\n- **.2** — DNS (mapeado para Azure DNS)\n- **.3** — DNS (reservado para uso futuro)\n- **.255** — Broadcast\n\nExemplo: subnet 10.0.1.0/24 tem 256 IPs totais - 5 = **251 utilizáveis**.'
    },
    {
      front: 'Qual é a ordem de avaliação de NSGs para tráfego Inbound e Outbound?',
      back: '**Inbound** (entrando na VM):\n1. NSG da **Subnet** (avaliado primeiro)\n2. NSG da **NIC** (avaliado segundo)\n\n**Outbound** (saindo da VM):\n1. NSG da **NIC** (avaliado primeiro)\n2. NSG da **Subnet** (avaliado segundo)\n\nAmbos os NSGs precisam permitir o tráfego. Um Deny em qualquer um bloqueia.'
    },
    {
      front: 'VNet Peering é transitivo? O que isso significa na prática?',
      back: '**Não**, VNet Peering NÃO é transitivo.\n\nSe VNet-A ↔ VNet-B e VNet-B ↔ VNet-C, a VM em A **não pode** alcançar VM em C via B.\n\nPara conectar A e C: criar peering direto A ↔ C.\n\nAlternativa para topologia hub-spoke: usar Azure Firewall ou Azure Virtual WAN no hub para tráfego transitivo.'
    },
    {
      front: 'Quais são as regras padrão de um NSG (que não podem ser deletadas)?',
      back: '**Inbound padrão** (prioridade 65000-65500):\n- AllowVnetInBound (65000) — permite tráfego dentro da VNet\n- AllowAzureLoadBalancerInBound (65001) — health probes do LB\n- DenyAllInBound (65500) — bloqueia tudo mais\n\n**Outbound padrão**:\n- AllowVnetOutBound (65000) — permite saída para VNet\n- AllowInternetOutBound (65001) — permite saída para Internet\n- DenyAllOutBound (65500) — bloqueia tudo mais'
    },
    {
      front: 'O que são Application Security Groups (ASGs) e qual problema resolvem?',
      back: '**ASG** é um agrupamento lógico de NICs de VMs por função (WebServers, DatabaseServers, etc.).\n\n**Problema que resolve**: regras NSG baseadas em IPs são difíceis de manter à medida que VMs são criadas/removidas.\n\n**Com ASG**: associe a NIC ao ASG, e referencie o ASG em regras NSG. IPs gerenciados automaticamente.\n\n``\`bash\n# Associar NIC ao ASG\naz network nic ip-config update \\\n  --nic-name myNIC --name ipconfig1 \\\n  --resource-group myRG \\\n  --application-security-groups ASG-WebServers\n\```'
    }
  ],

  lab: {
    scenario: 'Configure a infraestrutura de rede da TechNova com VNet, subnets segmentadas e NSGs para isolar o tier de web do tier de dados.',
    objective: 'Criar VNet, subnets, NSGs com regras adequadas e verificar o isolamento entre tiers.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Criar VNet e subnets',
        instruction: `Crie uma VNet \`app-vnet\` com address space \`10.0.0.0/16\` e duas subnets: \`web-subnet\` (10.0.1.0/24) e \`db-subnet\` (10.0.2.0/24).`,
        hints: [
          'Crie o RG primeiro: \`az group create --name rg-network-lab\`',
          'VNet e subnets podem ser criadas em um único \`az network vnet create\` para a primeira subnet'
        ],
        solution: `\`\`\`bash
az group create --name rg-network-lab --location eastus

# Criar VNet com primeira subnet
az network vnet create \\
  --name app-vnet \\
  --resource-group rg-network-lab \\
  --location eastus \\
  --address-prefixes 10.0.0.0/16 \\
  --subnet-name web-subnet \\
  --subnet-prefixes 10.0.1.0/24

# Adicionar segunda subnet
az network vnet subnet create \\
  --name db-subnet \\
  --vnet-name app-vnet \\
  --resource-group rg-network-lab \\
  --address-prefixes 10.0.2.0/24
\`\`\``,
        verify: `\`\`\`bash
az network vnet subnet list \\
  --vnet-name app-vnet \\
  --resource-group rg-network-lab \\
  --query "[].{Nome:name,CIDR:addressPrefix}" -o table
# Saída esperada:
# Nome        CIDR
# ----------  ------------
# web-subnet  10.0.1.0/24
# db-subnet   10.0.2.0/24
\`\`\``
      },
      {
        title: 'Criar NSG para web-subnet com regras HTTP/HTTPS',
        instruction: `Crie um NSG \`web-nsg\` que permita tráfego HTTP (80) e HTTPS (443) da Internet e associe-o à web-subnet.`,
        hints: [
          'Source "Internet" é uma Service Tag — use como valor no \`--source-address-prefixes\`',
          'Associar NSG à subnet: \`az network vnet subnet update --network-security-group\`'
        ],
        solution: `\`\`\`bash
# Criar NSG para tier web
az network nsg create \\
  --name web-nsg \\
  --resource-group rg-network-lab

# Permitir HTTP inbound da Internet
az network nsg rule create \\
  --nsg-name web-nsg \\
  --resource-group rg-network-lab \\
  --name AllowHTTP \\
  --priority 100 \\
  --direction Inbound \\
  --access Allow \\
  --protocol Tcp \\
  --source-address-prefixes Internet \\
  --source-port-ranges '*' \\
  --destination-address-prefixes '*' \\
  --destination-port-ranges 80 443

# Associar NSG à web-subnet
az network vnet subnet update \\
  --name web-subnet \\
  --vnet-name app-vnet \\
  --resource-group rg-network-lab \\
  --network-security-group web-nsg
\`\`\``,
        verify: `\`\`\`bash
# Verificar NSG associado à subnet
az network vnet subnet show \\
  --name web-subnet \\
  --vnet-name app-vnet \\
  --resource-group rg-network-lab \\
  --query "networkSecurityGroup.id" -o tsv | grep -c "web-nsg" && echo "NSG corretamente associado"
\`\`\``
      },
      {
        title: 'Criar NSG para db-subnet com acesso restrito',
        instruction: `Crie um NSG \`db-nsg\` que:
1. Permita tráfego SQL (porta 1433) apenas da web-subnet (10.0.1.0/24)
2. Negue todo acesso à Internet (outbound)

Associe ao db-subnet.`,
        hints: [
          'Prioridade do Deny Internet Outbound deve ser menor que 65001 (prioridade das regras padrão)',
          'Use o CIDR da web-subnet como source address prefix'
        ],
        solution: `\`\`\`bash
# Criar NSG para tier DB
az network nsg create \\
  --name db-nsg \\
  --resource-group rg-network-lab

# Permitir SQL apenas da web-subnet
az network nsg rule create \\
  --nsg-name db-nsg \\
  --resource-group rg-network-lab \\
  --name AllowSQLFromWeb \\
  --priority 100 \\
  --direction Inbound \\
  --access Allow \\
  --protocol Tcp \\
  --source-address-prefixes 10.0.1.0/24 \\
  --source-port-ranges '*' \\
  --destination-address-prefixes '*' \\
  --destination-port-ranges 1433

# Bloquear acesso à Internet (outbound)
az network nsg rule create \\
  --nsg-name db-nsg \\
  --resource-group rg-network-lab \\
  --name DenyInternetOutbound \\
  --priority 200 \\
  --direction Outbound \\
  --access Deny \\
  --protocol '*' \\
  --source-address-prefixes '*' \\
  --source-port-ranges '*' \\
  --destination-address-prefixes Internet \\
  --destination-port-ranges '*'

# Associar NSG à db-subnet
az network vnet subnet update \\
  --name db-subnet \\
  --vnet-name app-vnet \\
  --resource-group rg-network-lab \\
  --network-security-group db-nsg
\`\`\``,
        verify: `\`\`\`bash
# Verificar regras do db-nsg
az network nsg rule list \\
  --nsg-name db-nsg \\
  --resource-group rg-network-lab \\
  --query "[?!startsWith(name,'Default')].{Nome:name,Dir:direction,Acao:access,Porta:destinationPortRange}" \\
  -o table
# Saída esperada:
# Nome                   Dir       Acao   Porta
# ---------------------  --------  -----  -----
# AllowSQLFromWeb        Inbound   Allow  1433
# DenyInternetOutbound   Outbound  Deny   *
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group e todos os recursos criados.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-network-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-network-lab --query "properties.provisioningState" -o tsv 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'VM não recebe tráfego HTTP apesar de regra NSG Allow',
      difficulty: 'medium',
      symptom: 'Uma VM no Azure tem um NSG com regra Allow HTTP (porta 80) inbound, mas requisições da Internet não chegam à aplicação.',
      diagnosis: `\`\`\`bash
# Verificar regras efetivas do NSG na NIC da VM
az network nic list-effective-nsg \\
  --name <nic-name> \\
  --resource-group <rg> \\
  --query "effectiveNetworkSecurityGroups[].{NSG:networkSecurityGroup.id,Regras:effectiveSecurityRules[?access=='Deny']}" -o json

# Verificar se tem NSG na subnet E na NIC (ambos são avaliados)
az network vnet subnet show \\
  --name <subnet> --vnet-name <vnet> --resource-group <rg> \\
  --query "networkSecurityGroup.id" -o tsv

az network nic show --name <nic-name> --resource-group <rg> \\
  --query "networkSecurityGroup.id" -o tsv

# Verificar se a VM tem IP público
az vm list-ip-addresses --name <vm-name> --resource-group <rg> -o table
\`\`\``,
      solution: `**Causas possíveis em ordem de investigação:**

1. **NSG da subnet bloqueando**: mesmo que o NSG da NIC permita, o NSG da subnet pode estar negando. Verificar ambos.

2. **VM sem IP público**: se é acesso da Internet, a VM precisa de IP público ou estar atrás de um Load Balancer.

3. **Aplicação não está escutando na porta**: verificar se o processo web está rodando na VM.

4. **Firewall do OS**: o Windows Firewall ou iptables dentro da VM pode estar bloqueando. NSG é externo à VM — o OS tem seu próprio firewall.

5. **Prioridade de regras**: verificar se há uma regra Deny com prioridade maior (número menor) que a regra Allow.`
    },
    {
      title: 'VNet Peering configurado mas VMs não se comunicam',
      difficulty: 'hard',
      symptom: 'Dois VNet Peerings foram criados entre VNet-A e VNet-B, mas VMs nas duas VNets não conseguem se conectar via ping ou porta 22.',
      diagnosis: `\`\`\`bash
# Verificar status dos peerings em ambas as VNets
az network vnet peering list --vnet-name VNet-A --resource-group <rg> \\
  --query "[].{Nome:name,Estado:peeringState,AllowAccess:allowVirtualNetworkAccess}" -o table

az network vnet peering list --vnet-name VNet-B --resource-group <rg> \\
  --query "[].{Nome:name,Estado:peeringState,AllowAccess:allowVirtualNetworkAccess}" -o table

# Verificar se address spaces se sobrepõem
az network vnet show --name VNet-A --resource-group <rg> --query "addressSpace.addressPrefixes" -o tsv
az network vnet show --name VNet-B --resource-group <rg> --query "addressSpace.addressPrefixes" -o tsv

# Verificar rotas efetivas na NIC da VM
az network nic show-effective-route-table --name <nic-name> --resource-group <rg> -o table
\`\`\``,
      solution: `**Causas possíveis:**

1. **Estado do Peering não é "Connected"**: verifique \`peeringState\`. Ambos os lados devem estar "Connected". Se um lado foi deletado/não criado, o outro fica "Disconnected".

2. **AllowVirtualNetworkAccess está False**: o parâmetro \`--allow-vnet-access\` não foi passado. Recriar o peering com a flag.

3. **NSG bloqueando tráfego**: mesmo com peering ativo, os NSGs das subnets precisam permitir o tráfego (não apenas AllowVnetInBound padrão, se houver regras Deny customizadas).

4. **Address spaces sobrepostos**: VNets com CIDR overlap não podem fazer peering. Exemplo: 10.0.0.0/16 e 10.0.1.0/24 (o segundo está dentro do primeiro) — peering impossível.

5. **Peering recém-criado**: aguardar alguns minutos para propagar completamente.`
    }
  ]
};
