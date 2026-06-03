window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-infrastructure/network-topology'] = {
  theory: `# Design de Topologia de Rede (AZ-305)

## Relevância no Exame
> Peso estimado **20-25%** no AZ-305. Questões sobre escolha de topologia (hub-spoke, vWAN, mesh), conectividade híbrida e segurança de rede.

## Padrões de Topologia

### Hub-and-Spoke
Topologia mais comum para empresas:
\`\`\`
Internet
    ↓
Azure Firewall / NVA (Hub VNet)
    ├─ VNet Spoke 1 (App A)
    ├─ VNet Spoke 2 (App B)
    └─ VNet Spoke 3 (App C)
         ↕ (via hub)
    On-premises (ExpressRoute / VPN)
\`\`\`

**Hub VNet**: contém serviços compartilhados:
- Azure Firewall ou NVA (Network Virtual Appliance)
- ExpressRoute / VPN Gateway
- Azure Bastion
- DNS Resolver

**Spoke VNets**: isoladas, peered ao hub

**VNet Peering**: spoke-to-hub + hub-to-spoke (dois peerings por spoke)

**Tráfego transitivo via hub**: VNet Spoke 1 → Azure Firewall no Hub → VNet Spoke 2
(Lembra: VNet Peering não é transitivo — o hub com Firewall fornece o trânsito)

### Azure Virtual WAN (vWAN)
Hub-and-spoke gerenciado pela Microsoft — mais simples para múltiplas regiões:
- **Standard vWAN**: suporta SD-WAN parceiros, maior performance
- **Basic vWAN**: apenas VPN S2S
- Hub gerenciado automaticamente pela Microsoft
- Routing automático entre spokes, branches e ExpressRoute

**Quando usar vWAN vs Hub-and-Spoke manual:**
- vWAN: muitas regiões, muitas branches, quer menos gerenciamento
- Hub manual: mais controle, Azure Firewall customizado, menos custo para pequenas topologias

### Private Endpoints vs Service Endpoints
| | Service Endpoint | Private Endpoint |
|-|-----------------|-----------------|
| Acesso | Via rede Azure backbone | Via IP privado na VNet |
| Endpoint | Ainda é público (IP público do serviço) | IP privado na sua VNet |
| DNS | Não muda | DNS resolve para IP privado |
| Custo | Sem custo adicional | Custo por hora + dados |
| Segurança | Melhor que Internet | Melhor que Service Endpoint |

**Use Private Endpoints para:**
- Compliance que exige tráfego nunca sair da VNet
- Storage, Key Vault, SQL, etc. completamente privados

### Azure DNS & Private DNS Zones
- **Azure DNS**: serviço DNS público para domínios (cria zonas DNS públicas)
- **Private DNS Zone**: DNS interno para recursos na VNet
- **Azure DNS Private Resolver**: resolve DNS on-premises ↔ Azure Private DNS

**Para Private Endpoints funcionar**: criar Private DNS Zone + Virtual Network Link

### Azure DDoS Protection
- **Basic** (gratuito): proteção básica para todos os recursos Azure
- **Standard**: proteção avançada, telemetria, alertas, mitigação automática
  - Requer: Virtual Network onde estão os recursos com IPs públicos

### Azure Firewall
Firewall gerenciado Layer 4 e Layer 7:
- **Standard**: FQDN filtering, Network rules, Application rules
- **Premium**: TLS inspection, IDPS (Intrusion Detection/Prevention), URL categories
- Integra com Azure Firewall Policy (hierarquia de regras centralizadas)

## Padrões de Design

### Padrão: Segurança de Rede em Camadas
\`\`\`
Internet
    ↓
DDoS Protection Standard
    ↓
Azure Firewall (filtro L7, IDPS)
    ↓
Application Gateway com WAF (L7 HTTP)
    ↓
Load Balancer Standard (L4)
    ↓
NSG na Subnet (L4 micro-segmentação)
    ↓
VMs / Services
\`\`\`

### Padrão: Conectividade Híbrida com Redundância
\`\`\`
On-Premises
    ├─ ExpressRoute (primário) ──→ Azure Hub VNet
    └─ VPN Gateway (backup) ──────→ Azure Hub VNet
              ↓
        Route Priority: ExpressRoute first, VPN as failover
\`\`\`

## Erros Comuns de Design

1. **Peering transitivo assumido**: VNet A ↔ B e B ↔ C não significa A pode falar com C diretamente.
2. **Private Endpoint sem DNS**: sem resolver DNS para o IP privado, a aplicação usa o IP público.
3. **NSG na GatewaySubnet**: NÃO colocar NSG na GatewaySubnet — pode quebrar a conectividade do gateway.
4. **vWAN Standard vs Basic**: Basic só suporta S2S VPN; Standard para ExpressRoute e SD-WAN.

## Killer.sh Style Challenge

> **Cenário**: Uma empresa global tem 5 VNets em 3 regiões (East US, West EU, Southeast Asia), 20 branches on-premises e 3 parceiros externos que precisam de acesso restrito. Projete a topologia de rede.
>
> **Solução esperada**: Azure Virtual WAN Standard com hubs em cada região (multi-region). Branches conectadas via SD-WAN parceiros integrados ao vWAN. Parceiros externos: B2B com Azure AD + Application Gateway/Private Endpoint para acesso restrito. DDoS Standard nas VNets com recursos públicos. Azure Firewall Policy central gerenciando regras em todos os hubs.
`,

  quiz: [
    {
      question: 'Na topologia Hub-and-Spoke, VMs em Spoke-A precisam se comunicar com VMs em Spoke-B. Qual recurso deve estar no Hub para permitir esse tráfego transitivo?',
      options: [
        'VNet Peering adicional entre Spoke-A e Spoke-B',
        'Azure Firewall ou NVA (Network Virtual Appliance) no Hub',
        'Route Table apontando Spoke-A diretamente para Spoke-B',
        'Application Gateway com backend pools nos dois Spokes'
      ],
      correct: 1,
      explanation: 'VNet Peering não é transitivo. Para tráfego entre spokes fluir pelo hub, é necessário um Azure Firewall ou NVA no Hub que atue como roteador/proxy. O tráfego de Spoke-A vai para o Hub (via UDR), passa pelo Firewall, e segue para Spoke-B. Sem o Firewall, seria necessário peering direto entre cada par de spokes (mesh).',
      reference: 'Hub-and-spoke: Firewall/NVA no hub = permite tráfego transitivo. Sem ele: peering direto entre cada spoke (exponencialmente mais peerings).'
    },
    {
      question: 'Qual é a principal diferença entre Service Endpoint e Private Endpoint para uma Storage Account?',
      options: [
        'Service Endpoint é para blobs; Private Endpoint é para files',
        'Com Service Endpoint, o Storage ainda tem IP público mas o tráfego usa a rede Azure backbone; com Private Endpoint, o Storage recebe IP privado dentro da VNet',
        'Service Endpoint é mais seguro que Private Endpoint',
        'Não há diferença de segurança — apenas de custo'
      ],
      correct: 1,
      explanation: 'Service Endpoint otimiza o roteamento (usa a rede backbone Azure em vez da Internet) mas o serviço mantém endpoint público. Private Endpoint cria uma NIC com IP privado dentro da sua VNet — o DNS resolve o nome do serviço para este IP privado, e o tráfego nunca sai da VNet. Private Endpoint é mais seguro.',
      reference: 'Service Endpoint = tráfego backbone mas IP público. Private Endpoint = IP privado na VNet, tráfego completamente privado.'
    },
    {
      question: 'Quando escolher Azure Virtual WAN em vez de Hub-and-Spoke manual?',
      options: [
        'Quando o custo é a principal preocupação (vWAN é mais barato)',
        'Quando há muitas regiões, muitas branches e você quer o Azure gerenciando o routing automaticamente',
        'Quando você precisa de Azure Firewall (apenas vWAN suporta)',
        'Para workloads de desenvolvimento/teste'
      ],
      correct: 1,
      explanation: 'Azure Virtual WAN é ideal para cenários complexos multi-região com muitas branches: o Azure gerencia automaticamente o hub, as tabelas de roteamento, e a otimização de latência. Para topologias simples com 1-2 regiões, Hub-and-Spoke manual é mais econômico e dá mais controle. vWAN é geralmente mais caro que Hub-and-Spoke manual.',
      reference: 'vWAN = escala global, menos gerenciamento, mais caro. Hub manual = mais controle, menos custo para topologias simples.'
    }
  ],

  flashcards: [
    {
      front: 'Quais são os benefícios e limitações da topologia Hub-and-Spoke?',
      back: '**Benefícios:**\n- Centralização de serviços compartilhados (Firewall, VPN, Bastion, DNS)\n- Segurança centralizada e auditoria\n- Isolamento entre workloads (spokes)\n- Custo reduzido vs mesh completo\n\n**Limitações:**\n- Peering não é transitivo → Firewall/NVA necessário para tráfego spoke-to-spoke\n- Hub é single point of failure se não tiver redundância\n- Latência adicional para tráfego spoke-to-spoke (via hub)\n\n**Alternativa para muitas regiões**: Azure Virtual WAN (hub gerenciado)'
    },
    {
      front: 'O que é necessário para que Private Endpoints funcionem corretamente com DNS?',
      back: '**Sem DNS correto**: o nome do serviço (ex: \`mysa.blob.core.windows.net\`) resolve para o IP **público**, ignorando o Private Endpoint.\n\n**Para funcionar:**\n1. **Private DNS Zone**: criar \`privatelink.blob.core.windows.net\`\n2. **Virtual Network Link**: associar a Private DNS Zone à VNet\n3. **DNS A Record**: criado automaticamente pelo Azure ao criar o Private Endpoint\n\nResultado: \`nslookup mysa.blob.core.windows.net\` retorna IP privado (10.x.x.x)'
    },
    {
      front: 'Quais SKUs do Azure Firewall existem e quais são os diferenciais?',
      back: '**Azure Firewall Standard:**\n- Network rules (L4)\n- Application rules com FQDN filtering\n- NAT rules (DNAT)\n- Threat Intelligence (block/alert para IPs/FQDNs maliciosos)\n\n**Azure Firewall Premium:**\n- Tudo do Standard +\n- TLS inspection (inspeciona tráfego HTTPS criptografado)\n- IDPS (Intrusion Detection and Prevention System)\n- URL categories (block categorias de sites)\n- Web categories\n\nUse Premium para compliance que exige inspeção profunda de tráfego.'
    }
  ],

  lab: {
    scenario: 'Crie uma topologia Hub-and-Spoke básica para entender o isolamento e conectividade entre VNets.',
    objective: 'Criar Hub VNet, duas Spoke VNets e configurar VNet Peering bilateral.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Hub VNet e Spoke VNets',
        instruction: 'Crie uma Hub VNet (10.0.0.0/16), Spoke-1 (10.1.0.0/16) e Spoke-2 (10.2.0.0/16).',
        hints: ['Use \`az network vnet create\` três vezes com address spaces diferentes'],
        solution: `\`\`\`bash
az group create --name rg-hubspoke-lab --location eastus

# Hub VNet
az network vnet create --name hub-vnet --resource-group rg-hubspoke-lab \\
  --address-prefixes 10.0.0.0/16 --subnet-name shared-subnet --subnet-prefixes 10.0.1.0/24

# Spoke VNets
az network vnet create --name spoke-1-vnet --resource-group rg-hubspoke-lab \\
  --address-prefixes 10.1.0.0/16 --subnet-name app-subnet --subnet-prefixes 10.1.1.0/24

az network vnet create --name spoke-2-vnet --resource-group rg-hubspoke-lab \\
  --address-prefixes 10.2.0.0/16 --subnet-name app-subnet --subnet-prefixes 10.2.1.0/24
\`\`\``,
        verify: `\`\`\`bash
az network vnet list --resource-group rg-hubspoke-lab \\
  --query "[].{Nome:name,CIDR:addressSpace.addressPrefixes[0]}" -o table
# Saída esperada: 3 VNets com CIDRs 10.0/10.1/10.2
\`\`\``
      },
      {
        title: 'Configurar VNet Peering bilateral Hub ↔ Spokes',
        instruction: 'Configure peering bilateral entre Hub e cada Spoke (4 peerings no total).',
        hints: ['Cada peering precisa de dois comandos: hub→spoke e spoke→hub'],
        solution: `\`\`\`bash
# Peering Hub ↔ Spoke-1 (bilateral)
az network vnet peering create \\
  --name hub-to-spoke1 --vnet-name hub-vnet --resource-group rg-hubspoke-lab \\
  --remote-vnet spoke-1-vnet --allow-vnet-access --allow-forwarded-traffic

az network vnet peering create \\
  --name spoke1-to-hub --vnet-name spoke-1-vnet --resource-group rg-hubspoke-lab \\
  --remote-vnet hub-vnet --allow-vnet-access --allow-forwarded-traffic

# Peering Hub ↔ Spoke-2 (bilateral)
az network vnet peering create \\
  --name hub-to-spoke2 --vnet-name hub-vnet --resource-group rg-hubspoke-lab \\
  --remote-vnet spoke-2-vnet --allow-vnet-access --allow-forwarded-traffic

az network vnet peering create \\
  --name spoke2-to-hub --vnet-name spoke-2-vnet --resource-group rg-hubspoke-lab \\
  --remote-vnet hub-vnet --allow-vnet-access --allow-forwarded-traffic
\`\`\``,
        verify: `\`\`\`bash
# Verificar todos os peerings estão Connected
az network vnet peering list --vnet-name hub-vnet --resource-group rg-hubspoke-lab \\
  --query "[].{Nome:name,Estado:peeringState}" -o table
# Saída esperada: hub-to-spoke1 = Connected, hub-to-spoke2 = Connected
\`\`\``
      },
      {
        title: 'Verificar isolamento: Spokes não se comunicam diretamente',
        instruction: 'Tente criar um peering direto Spoke-1 ↔ Spoke-2 e veja que address spaces 10.1/10.2 não se sobrepõem mas que sem firewall no hub, o tráfego entre spokes não é roteado.',
        hints: ['Este passo é conceitual — demonstra que apenas hub-to-spoke peering não cria trânsito automático entre spokes'],
        solution: `\`\`\`bash
# Demonstrar: sem Firewall no hub, spoke-1 não pode alcançar spoke-2 via hub
# Em uma VM em spoke-1, um ping para 10.2.1.x falharia porque:
# 1. A rota de spoke-1 vai para hub-vnet
# 2. hub-vnet não tem rota para spoke-2 sem Firewall/NVA

echo "Topologia atual: Spoke-1 e Spoke-2 podem alcançar Hub, mas NÃO um ao outro"
echo "Para trânsito entre spokes: adicionar Azure Firewall no hub + UDRs nos spokes"
echo ""
echo "Peerings existentes:"
az network vnet peering list --vnet-name hub-vnet --resource-group rg-hubspoke-lab \\
  --query "[].{Peering:name,Status:peeringState}" -o table
\`\`\``,
        verify: `\`\`\`bash
echo "Conceito verificado: 4 peerings, hub conectado a ambos os spokes"
echo "Para trânsito spoke-to-spoke: necessário Azure Firewall/NVA + UDRs"
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-hubspoke-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-hubspoke-lab 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Tráfego entre Spoke VNets não flui pelo Hub Firewall',
      difficulty: 'hard',
      symptom: 'VMs em Spoke-1 não conseguem alcançar VMs em Spoke-2 mesmo com Azure Firewall no Hub e peerings configurados.',
      diagnosis: `\`\`\`bash
# Verificar effective routes na NIC de VM no Spoke-1
az network nic show-effective-route-table --name <nic-spoke1> --resource-group <rg> -o table
# Verificar se há rota para 10.2.0.0/16 apontando para o Firewall (10.0.x.x)

# Verificar UDR na subnet do Spoke-1
az network route-table list --resource-group <rg> \\
  --query "[].{Nome:name,Rotas:length(routes)}" -o table

# Verificar Azure Firewall Network Rules
az network firewall network-rule list --firewall-name hub-firewall --resource-group <rg> -o table
\`\`\``,
      solution: `**Checklist para trânsito spoke-to-spoke via Firewall:**

1. **UDR nos spokes**: criar Route Table com rota padrão (0.0.0.0/0) ou rota específica (10.2.0.0/16) apontando para o IP privado do Azure Firewall no hub. Associar Route Table à subnet do spoke.

2. **Regra no Firewall**: criar Network Rule permitindo tráfego de 10.1.0.0/16 → 10.2.0.0/16 (e vice-versa).

3. **Allow Forwarded Traffic no peering**: verificar se os peerings hub-to-spoke têm \`allowForwardedTraffic=true\`.

4. **Use Hub VNet Gateway**: se usar VPN/ExpressRoute no hub, verificar \`useRemoteGateways\` e \`allowGatewayTransit\` nos peerings.

\`\`\`bash
# Criar UDR para forçar tráfego pelo Firewall
FIREWALL_IP=$(az network firewall show --name hub-firewall --resource-group <rg> --query "ipConfigurations[0].privateIPAddress" -o tsv)

az network route-table create --name spoke1-udr --resource-group <rg>
az network route-table route create --route-table-name spoke1-udr --resource-group <rg> \\
  --name to-spoke2 --address-prefix 10.2.0.0/16 \\
  --next-hop-type VirtualAppliance --next-hop-ip-address $FIREWALL_IP
az network vnet subnet update --name app-subnet --vnet-name spoke-1-vnet \\
  --resource-group <rg> --route-table spoke1-udr
\`\`\``
    }
  ]
};
