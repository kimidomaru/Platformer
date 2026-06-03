window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-networking/vpn-expressroute'] = {
  theory: `# Azure VPN Gateway & ExpressRoute

## Relevância no Exame
> Peso estimado **8-12%** no AZ-104. Questões sobre conectividade híbrida (on-premises ↔ Azure) são frequentes em cenários de migração.

## Conceitos Fundamentais

### VPN Gateway
Conecta redes on-premises ou outras VNets ao Azure via **tunelamento encriptado** pela Internet pública:

**Tipos de VPN:**
- **Site-to-Site (S2S)**: conecta rede on-premises inteira à VNet Azure (requer dispositivo VPN on-prem)
- **Point-to-Site (P2S)**: conecta dispositivos individuais (laptops, PCs) à VNet Azure
- **VNet-to-VNet**: conecta duas VNets Azure em regiões diferentes (alternativa ao Global Peering)

**SKUs do VPN Gateway:**

| SKU | Throughput | Túneis S2S | P2S Connections |
|-----|-----------|-----------|-----------------|
| **Basic** | 100 Mbps | 10 | 128 |
| **VpnGw1** | 650 Mbps | 30 | 250 |
| **VpnGw2** | 1 Gbps | 30 | 500 |
| **VpnGw3** | 1.25 Gbps | 30 | 1000 |

**Requisitos:**
- Requer subnet dedicada \`GatewaySubnet\` (/27 ou maior, preferencialmente /26)
- Provisionamento leva ~30-45 minutos
- Basic não suporta Zone-Redundant ou BGP

**BGP (Border Gateway Protocol):**
Permite routing dinâmico entre on-premises e Azure — necessário para ExpressRoute e múltiplos túneis VPN com failover automático.

### ExpressRoute
Conexão privada e dedicada entre on-premises e Azure via provedor de conectividade (não passa pela Internet pública):

- Latência consistente e garantida (SLA forte)
- Mais seguro (sem tráfego pela Internet)
- Velocidades de 50 Mbps a 10 Gbps
- Requer contratação com provedor parceiro (Equinix, AT&T, etc.)

**Tipos de peering:**
- **Private Peering**: acessa VNets Azure (recursos privados)
- **Microsoft Peering**: acessa serviços Microsoft 365 e Azure PaaS público

**ExpressRoute + VPN (coexistência):**
- VPN como backup se ExpressRoute falhar
- Requer dois gateways na mesma GatewaySubnet (ExpressRoute Gateway + VPN Gateway)

### Comparação: VPN Gateway vs ExpressRoute

| Critério | VPN Gateway | ExpressRoute |
|---------|------------|-------------|
| Meio | Internet pública (encriptada) | Linha privada dedicada |
| Latência | Variável (dependente da Internet) | Garantida e consistente |
| Velocidade | Até 1.25 Gbps | Até 10 Gbps |
| Custo | Baixo | Alto |
| Setup | Rápido (horas) | Semanas/meses |
| SLA | 99.9% (zone-redundant: 99.99%) | 99.9% |

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Criar GatewaySubnet
az network vnet subnet create \\
  --name GatewaySubnet \\
  --vnet-name myVNet \\
  --resource-group myRG \\
  --address-prefixes 10.0.255.0/27

# Criar IP público para VPN Gateway (zone-redundant)
az network public-ip create \\
  --name vpn-gw-pip \\
  --resource-group myRG \\
  --sku Standard \\
  --zone 1 2 3

# Criar VPN Gateway (demora ~30-45 min)
az network vnet-gateway create \\
  --name myVPNGateway \\
  --resource-group myRG \\
  --vnet myVNet \\
  --public-ip-address vpn-gw-pip \\
  --gateway-type Vpn \\
  --vpn-type RouteBased \\
  --sku VpnGw2AZ \\
  --no-wait

# Criar Local Network Gateway (representa a rede on-premises)
az network local-gateway create \\
  --name on-prem-lgw \\
  --resource-group myRG \\
  --gateway-ip-address 203.0.113.1 \\  # IP público do firewall/VPN on-prem
  --local-address-prefixes 192.168.0.0/24

# Criar conexão S2S
az network vpn-connection create \\
  --name S2S-Connection \\
  --resource-group myRG \\
  --vnet-gateway1 myVPNGateway \\
  --local-gateway2 on-prem-lgw \\
  --shared-key "SecretPSK123!" \\
  --connection-type IPsec

# Verificar status da conexão
az network vpn-connection show \\
  --name S2S-Connection \\
  --resource-group myRG \\
  --query "{Status:connectionStatus,Bytes:ingressBytesTransferred}" -o table
\`\`\`

## Erros Comuns

1. **GatewaySubnet com nome errado**: deve ser exatamente \`GatewaySubnet\` (case-sensitive).
2. **GatewaySubnet muito pequena**: recomendado /26 ou /27 — subnet menores causam problemas com gateways zone-redundant.
3. **PSK diferente em cada lado**: a Preshared Key deve ser idêntica no Azure e no dispositivo on-premises.
4. **IKE policy incompatível**: verificar se o dispositivo VPN on-prem suporta os parâmetros IKE/IPsec configurados no Azure.

## Killer.sh Style Challenge

> Uma empresa precisa conectar seu datacenter on-premises (192.168.0.0/16) ao Azure com baixa latência garantida e 1 Gbps de throughput para workloads críticos. Qual solução usar? Quais são os requisitos de configuração no Azure?
>
> **Resposta**: ExpressRoute com circuito de 1 Gbps via provedor parceiro. No Azure: criar ExpressRoute Gateway (SKU HighPerformance ou UltraPerformance) na GatewaySubnet, criar ExpressRoute Circuit, configurar Private Peering para acesso às VNets.
`,

  quiz: [
    {
      question: 'Qual subnet deve ser criada em uma VNet Azure antes de implantar um VPN Gateway?',
      options: [
        'VPNSubnet',
        'GatewaySubnet',
        'AzureVPNSubnet',
        'ManagementSubnet'
      ],
      correct: 1,
      explanation: 'O VPN Gateway requer uma subnet com nome exatamente "GatewaySubnet" (case-sensitive) na VNet. Não pode ser qualquer nome. O tamanho recomendado é /26 ou /27. Recursos do usuário não devem ser colocados nessa subnet.',
      reference: 'GatewaySubnet é obrigatória e o nome deve ser EXATAMENTE "GatewaySubnet". O Azure rejeita gateways sem ela.'
    },
    {
      question: 'Uma empresa precisa de conexão com latência garantida e consistente entre on-premises e Azure, sem depender da Internet pública. Qual solução escolher?',
      options: [
        'VPN Gateway Site-to-Site',
        'VPN Gateway Point-to-Site',
        'ExpressRoute',
        'VNet Peering'
      ],
      correct: 2,
      explanation: 'ExpressRoute oferece conexão privada e dedicada via provedor de conectividade — não usa a Internet pública, proporcionando latência consistente e garantida. VPN Gateway usa a Internet pública (com criptografia), sujeito à variabilidade da Internet. VNet Peering é apenas para VNets Azure.',
      reference: 'ExpressRoute = privado, latência garantida, mais caro. VPN Gateway = Internet encriptada, variável, mais barato.'
    },
    {
      question: 'Qual é a diferença entre VPN Site-to-Site e Point-to-Site?',
      options: [
        'Site-to-Site conecta datacenters; Point-to-Site conecta dispositivos individuais ao Azure',
        'Site-to-Site é mais rápido; Point-to-Site é mais seguro',
        'Point-to-Site é entre dois data centers; Site-to-Site é para usuários remotos',
        'Não há diferença técnica, apenas de licenciamento'
      ],
      correct: 0,
      explanation: 'Site-to-Site (S2S) conecta redes inteiras (ex: datacenter on-premises 192.168.0.0/16 → VNet Azure), requer dispositivo VPN on-premises com IP público fixo. Point-to-Site (P2S) conecta dispositivos individuais (laptop, PC de home office) ao Azure via cliente VPN — sem necessidade de hardware especial on-premises.',
      reference: 'S2S = rede para rede (requer VPN device). P2S = device individual para VNet (client VPN app).'
    }
  ],

  flashcards: [
    {
      front: 'Quais são os 3 tipos de VPN suportados pelo Azure VPN Gateway?',
      back: '1. **Site-to-Site (S2S)** — conecta rede on-premises inteira à VNet. Requer dispositivo VPN on-prem com IP público.\n\n2. **Point-to-Site (P2S)** — conecta dispositivos individuais à VNet via cliente VPN. Para usuários remotos.\n\n3. **VNet-to-VNet** — conecta duas VNets Azure em regiões diferentes (alternativa ao Global VNet Peering quando há gateway existente).'
    },
    {
      front: 'ExpressRoute vs VPN Gateway: quando usar cada um?',
      back: '**Use ExpressRoute quando:**\n- Latência garantida e consistente é crítica\n- Throughput > 1 Gbps necessário\n- Compliance exige tráfego fora da Internet pública\n- Conexão permanente e de alta qualidade\n- Budget permite (é mais caro)\n\n**Use VPN Gateway quando:**\n- Custo é prioridade\n- Setup rápido necessário\n- Throughput até 1.25 Gbps suficiente\n- Redundância/backup para ExpressRoute\n- Conectar usuários remotos (P2S)'
    },
    {
      front: 'Qual é o requisito de subnet para VPN Gateway e ExpressRoute Gateway?',
      back: 'Ambos requerem uma subnet chamada **exatamente** \`GatewaySubnet\` na VNet:\n\n- Tamanho mínimo: **/27** (para gateway não-zone-redundant)\n- Tamanho recomendado: **/26** (necessário para alguns SKUs zone-redundant)\n- Não colocar outros recursos nessa subnet\n- Uma VNet pode ter AMBOS os gateways na mesma GatewaySubnet\n\nNome com typo (ex: "GatewaySubnet1") → deploy falha!'
    }
  ],

  lab: {
    scenario: 'Crie a infraestrutura de rede necessária para um VPN Gateway (sem provisionar o gateway — leva 30+ min).',
    objective: 'Criar VNet com GatewaySubnet e Local Network Gateway, entendendo os pré-requisitos para Site-to-Site VPN.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Criar VNet com GatewaySubnet',
        instruction: 'Crie a VNet \`hybrid-vnet\` e adicione a \`GatewaySubnet\` /26.',
        hints: ['Nome da subnet deve ser EXATAMENTE "GatewaySubnet"'],
        solution: `\`\`\`bash
az group create --name rg-vpn-lab --location eastus
az network vnet create \\
  --name hybrid-vnet --resource-group rg-vpn-lab \\
  --address-prefixes 10.100.0.0/16 \\
  --subnet-name AppSubnet \\
  --subnet-prefixes 10.100.1.0/24

# Adicionar GatewaySubnet (nome obrigatório)
az network vnet subnet create \\
  --name GatewaySubnet \\
  --vnet-name hybrid-vnet \\
  --resource-group rg-vpn-lab \\
  --address-prefixes 10.100.255.0/26
\`\`\``,
        verify: `\`\`\`bash
az network vnet subnet list --vnet-name hybrid-vnet --resource-group rg-vpn-lab \\
  --query "[].{Nome:name,CIDR:addressPrefix}" -o table
# Saída esperada:
# GatewaySubnet  10.100.255.0/26
# AppSubnet      10.100.1.0/24
\`\`\``
      },
      {
        title: 'Criar Local Network Gateway',
        instruction: 'Crie um Local Network Gateway representando a rede on-premises (IP público: 203.0.113.1, rede: 192.168.0.0/24).',
        hints: ['\`az network local-gateway create\` com \`--gateway-ip-address\` e \`--local-address-prefixes\`'],
        solution: `\`\`\`bash
az network local-gateway create \\
  --name onprem-lgw \\
  --resource-group rg-vpn-lab \\
  --gateway-ip-address 203.0.113.1 \\
  --local-address-prefixes 192.168.0.0/24 \\
  --location eastus
\`\`\``,
        verify: `\`\`\`bash
az network local-gateway show --name onprem-lgw --resource-group rg-vpn-lab \\
  --query "{IP:gatewayIpAddress,Rede:localNetworkAddressSpace.addressPrefixes}" -o json
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-vpn-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-vpn-lab 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Conexão VPN S2S está Connected mas tráfego não passa',
      difficulty: 'hard',
      symptom: 'O status da VPN Connection no Azure aparece como "Connected", mas VMs no Azure não conseguem pingar máquinas on-premises.',
      diagnosis: `\`\`\`bash
# Verificar status e bytes transferidos
az network vpn-connection show \\
  --name S2S-Connection --resource-group myRG \\
  --query "{Status:connectionStatus,BytesIn:ingressBytesTransferred,BytesOut:egressBytesTransferred}" -o table

# Verificar rotas efetivas na NIC da VM
az network nic show-effective-route-table --name myNIC --resource-group myRG -o table

# Verificar se o Local Network Gateway tem o CIDR on-prem correto
az network local-gateway show --name onprem-lgw --resource-group myRG \\
  --query "localNetworkAddressSpace.addressPrefixes" -o tsv
\`\`\``,
      solution: `**Causas com bytes zerados (nenhum tráfego):**

1. **CIDR on-premises incorreto no Local Network Gateway**: se o range de IPs on-prem está errado, o Azure não sabe rotear para lá. Verificar e corrigir.

2. **NSG bloqueando**: NSGs na subnet de destino podem bloquear tráfego vindo do range on-premises.

3. **Rota não propagada**: verificar effective routes — deve haver uma rota para o range on-prem apontando para o VPN Gateway.

4. **Firewall on-premises bloqueando**: o problema pode ser no lado on-prem — verificar regras de firewall e rotas do dispositivo VPN.

5. **MTU issues**: tunelamento VPN adiciona overhead. Se MTU da aplicação é 1500, pacotes podem ser fragmentados ou descartados. Reduzir MTU para 1350-1400.`
    }
  ]
};
