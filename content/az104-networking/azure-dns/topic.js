window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-networking/azure-dns'] = {
  theory: `# Azure DNS & Private DNS Zones

## Relevância no Exame
> Peso estimado **5-8%** no AZ-104. Questões sobre delegação de domínio, Private DNS Zones para recursos internos e integração com Private Endpoints.

## Conceitos Fundamentais

### Azure DNS (Público)
Serviço de hospedagem de zonas DNS públicas:
- Hospeda registros DNS para domínios públicos (ex: contoso.com)
- Alta disponibilidade com SLA 100% (distribuído em servidores globais Anycast)
- Suporta: A, AAAA, CNAME, MX, NS, PTR, SOA, SRV, TXT, CAA, alias records
- **Não vende domínios** — você registra em registrar externo e delega a zona para o Azure DNS

**Delegação de Domínio:**
\`\`\`
1. Registrar domínio em registrar (ex: GoDaddy)
2. Criar DNS zone no Azure para "contoso.com"
3. Azure fornece 4 Name Servers (ns1-ns4.azure-dns.com/net/org/info)
4. Configurar esses NS no registrar
→ Agora Azure DNS resolve todas as queries para contoso.com
\`\`\`

### Private DNS Zones
DNS interno para recursos em VNets Azure:
- Resolve nomes privados dentro da VNet (ex: \`app-server.internal.contoso.com\`)
- **Não visível fora da VNet** — não expõe nomes internos
- **Virtual Network Link**: associa a Private DNS Zone à VNet
- **Auto-registration**: registra automaticamente VMs criadas na VNet

**Casos de uso principais:**
1. Resolução de nomes para Private Endpoints (Storage, SQL, Key Vault)
2. DNS interno para serviços em VNets
3. Multi-region DNS com resolução consistente

### Private DNS para Private Endpoints
Quando você cria um Private Endpoint, o recurso precisa resolver para o IP privado:
\`\`\`
Sem Private DNS Zone:
nslookup mysa.blob.core.windows.net → 52.x.x.x (IP público)

Com Private DNS Zone (privatelink.blob.core.windows.net):
nslookup mysa.blob.core.windows.net → 10.0.1.5 (IP privado do PE)
\`\`\`

**Zonas de Private Link por serviço:**
| Serviço | Private DNS Zone |
|---------|-----------------|
| Blob Storage | \`privatelink.blob.core.windows.net\` |
| Azure SQL | \`privatelink.database.windows.net\` |
| Key Vault | \`privatelink.vaultcore.azure.net\` |
| Azure Files | \`privatelink.file.core.windows.net\` |

### Azure DNS Private Resolver
Encaminha consultas DNS entre on-premises e Azure Private DNS:
- **Inbound Endpoint**: recebe queries DNS do on-premises
- **Outbound Endpoint**: encaminha queries para DNS on-premises ou externo
- Permite que máquinas on-premises resolvam nomes de Private DNS Zones do Azure

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Criar DNS Zone pública
az network dns zone create \\
  --name contoso.com \\
  --resource-group myRG

# Criar registro A
az network dns record-set a add-record \\
  --zone-name contoso.com \\
  --resource-group myRG \\
  --record-set-name www \\
  --ipv4-address 1.2.3.4

# Criar registro CNAME
az network dns record-set cname set-record \\
  --zone-name contoso.com \\
  --resource-group myRG \\
  --record-set-name mail \\
  --cname mailserver.contoso.com

# Listar Name Servers da zona (para delegação)
az network dns zone show \\
  --name contoso.com \\
  --resource-group myRG \\
  --query nameServers -o tsv

# Criar Private DNS Zone
az network private-dns zone create \\
  --name privatelink.blob.core.windows.net \\
  --resource-group myRG

# Vincular Private DNS Zone à VNet
az network private-dns link vnet create \\
  --zone-name privatelink.blob.core.windows.net \\
  --resource-group myRG \\
  --name myVNetLink \\
  --virtual-network myVNet \\
  --registration-enabled false

# Criar registro A na Private DNS Zone
az network private-dns record-set a add-record \\
  --zone-name internal.contoso.com \\
  --resource-group myRG \\
  --record-set-name app-server \\
  --ipv4-address 10.0.1.10

# Verificar resolução DNS de uma zona
az network dns record-set list \\
  --zone-name contoso.com \\
  --resource-group myRG \\
  --query "[].{Nome:name,Tipo:type,TTL:ttl}" -o table
\`\`\`

## Erros Comuns

1. **Private DNS Zone não resolve dentro da VNet**: verificar se o Virtual Network Link existe e está "Completed".
2. **Auto-registration e VMs não aparecem**: auto-registration cria registros apenas para VMs criadas **após** o link, não retroativamente.
3. **Conflito de zonas Private DNS**: criar \`privatelink.blob.core.windows.net\` como zona pública (em vez de privada) quebra a resolução.
4. **TTL alto dificultando migração**: ao mudar IPs, TTL alto significa que clientes continuam resolvendo o IP antigo por horas.

## Killer.sh Style Challenge

> Uma empresa está criando uma Storage Account com Private Endpoint. VMs dentro da VNet devem resolver \`mysa.blob.core.windows.net\` para o IP privado 10.0.1.5. Configure o DNS necessário.
>
> **Resposta**: 1) Criar Private DNS Zone \`privatelink.blob.core.windows.net\`. 2) Criar Virtual Network Link para a VNet. 3) Ao criar o Private Endpoint para a Storage Account, o Azure cria automaticamente o registro DNS A: \`mysa\` → 10.0.1.5 na zona. Resultado: qualquer VM na VNet resolve \`mysa.blob.core.windows.net\` → 10.0.1.5.
`,

  quiz: [
    {
      question: 'Você criou um Private Endpoint para uma Storage Account, mas VMs na VNet ainda resolvem o nome para o IP público. O que está faltando?',
      options: [
        'Uma regra de NSG permitindo tráfego HTTPS da VNet para a Storage Account',
        'Uma Private DNS Zone com Virtual Network Link à VNet',
        'Um Service Endpoint na subnet da VNet',
        'Um registro CNAME na zona DNS pública'
      ],
      correct: 1,
      explanation: 'Private Endpoints precisam de uma Private DNS Zone para funcionar corretamente. Sem ela, o DNS público ainda resolve o nome para o IP público do serviço, fazendo o tráfego ir pela Internet em vez do IP privado do Private Endpoint. A Private DNS Zone (ex: privatelink.blob.core.windows.net) com Virtual Network Link faz o DNS resolver para o IP privado dentro da VNet.',
      reference: 'Private Endpoint sem Private DNS Zone = não funciona para a maioria das aplicações. Sempre criar ambos juntos.'
    },
    {
      question: 'Qual é o processo correto para usar o Azure DNS para hospedar o domínio "contoso.com" registrado em um registrar externo?',
      options: [
        'Apenas criar a DNS zone no Azure — ela é automaticamente associada ao domínio',
        'Criar DNS zone no Azure, copiar os Name Servers fornecidos, e configurá-los no registrar externo',
        'Transferir o registro do domínio para o Azure',
        'Criar um CNAME no registrar apontando para azure-dns.com'
      ],
      correct: 1,
      explanation: 'Para delegar o controle DNS ao Azure: criar uma DNS Zone para "contoso.com" no Azure (que fornece 4 Name Servers NS), depois configurar esses NS no painel do registrar externo. O registrar então instrui o DNS global que o Azure é o autoritativo para contoso.com. O Azure DNS não vende domínios — apenas hospeda as zonas.',
      reference: 'Azure DNS = hospedagem de zona (gestão de registros). Registrar externo = dono do domínio. Delegação conecta os dois.'
    },
    {
      question: 'O que é o "Auto-registration" em uma Private DNS Zone com Virtual Network Link?',
      options: [
        'Cria registros DNS automaticamente para todos os Private Endpoints da VNet',
        'Registra automaticamente os FQDNs de VMs criadas na VNet vinculada',
        'Atualiza automaticamente os TTLs de registros expirados',
        'Sincroniza registros DNS do on-premises para o Azure'
      ],
      correct: 1,
      explanation: 'Auto-registration cria automaticamente registros A na Private DNS Zone para VMs criadas na VNet vinculada — usando o nome do computador como hostname. Quando a VM é deletada, o registro é removido. Disponível apenas para recursos de VM, não para outros serviços. Apenas uma Private DNS Zone por VNet pode ter auto-registration habilitado.',
      reference: 'Auto-registration = DNS automático para VMs. Apenas uma zona por VNet pode ter auto-reg habilitado.'
    }
  ],

  flashcards: [
    {
      front: 'Qual Private DNS Zone usar para cada serviço Azure com Private Endpoint?',
      back: '| Serviço | Zona |\n|---------|------|\n| Blob Storage | \`privatelink.blob.core.windows.net\` |\n| Azure Files | \`privatelink.file.core.windows.net\` |\n| Azure SQL | \`privatelink.database.windows.net\` |\n| Key Vault | \`privatelink.vaultcore.azure.net\` |\n| Container Registry | \`privatelink.azurecr.io\` |\n| App Service | \`privatelink.azurewebsites.net\` |\n\nSempre criar Virtual Network Link após criar a zona.'
    },
    {
      front: 'O que é o Azure DNS Private Resolver e quando usar?',
      back: '**Azure DNS Private Resolver** — resolve o problema de DNS híbrido:\n\n**Problema**: máquinas on-premises não conseguem resolver nomes de Private DNS Zones do Azure (ex: \`mysa.privatelink.blob.core.windows.net\` → 10.0.x.x).\n\n**Solução**: \n- **Inbound Endpoint**: IP privado na VNet que recebe queries DNS do on-premises\n- **Outbound Endpoint**: encaminha queries para DNS on-premises (para nomes locais)\n\nConfigurar DNS forwarder on-premises para encaminhar queries \`*.azure.net\`, \`*.windows.net\` para o Inbound Endpoint.'
    },
    {
      front: 'Quais são os passos para hospedar um domínio público no Azure DNS?',
      back: '1. **Criar DNS Zone** no Azure para o domínio (\`az network dns zone create --name contoso.com\`)\n2. **Copiar Name Servers** fornecidos pelo Azure (4 entradas NS1-NS4)\n3. **Configurar NS** no registrar externo (GoDaddy, Cloudflare, etc.)\n4. **Aguardar propagação** (minutos a 48h dependendo do TTL anterior)\n5. **Criar registros** A, CNAME, MX etc. no portal Azure ou CLI\n\nDelegação significa: o registrar diz ao mundo "para contoso.com, pergunte ao Azure".'
    }
  ],

  lab: {
    scenario: 'Configure o Azure DNS para hospedar uma zona pública e uma Private DNS Zone com Virtual Network Link.',
    objective: 'Criar DNS Zone pública com registros, criar Private DNS Zone e vinculá-la a uma VNet.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Criar DNS Zone pública e registros',
        instruction: 'Crie uma DNS Zone para um domínio de teste e adicione registros A e CNAME.',
        hints: ['Use um domínio fictício como lab.contoso.internal para testes'],
        solution: `\`\`\`bash
az group create --name rg-dns-lab --location eastus

# Criar DNS Zone (domínio fictício para lab)
az network dns zone create \\
  --name lab-contoso.com \\
  --resource-group rg-dns-lab

# Registros A
az network dns record-set a add-record \\
  --zone-name lab-contoso.com \\
  --resource-group rg-dns-lab \\
  --record-set-name www \\
  --ipv4-address 10.0.1.10

az network dns record-set a add-record \\
  --zone-name lab-contoso.com \\
  --resource-group rg-dns-lab \\
  --record-set-name api \\
  --ipv4-address 10.0.1.20

# CNAME
az network dns record-set cname set-record \\
  --zone-name lab-contoso.com \\
  --resource-group rg-dns-lab \\
  --record-set-name portal \\
  --cname www.lab-contoso.com

# Ver Name Servers (para delegação em registrar real)
az network dns zone show --name lab-contoso.com --resource-group rg-dns-lab \\
  --query "nameServers" -o tsv
\`\`\``,
        verify: `\`\`\`bash
az network dns record-set list \\
  --zone-name lab-contoso.com \\
  --resource-group rg-dns-lab \\
  --query "[?type!='Microsoft.Network/dnszones/NS' && type!='Microsoft.Network/dnszones/SOA'].{Nome:name,Tipo:type}" -o table
# Saída esperada: www (A), api (A), portal (CNAME)
\`\`\``
      },
      {
        title: 'Criar Private DNS Zone com Virtual Network Link',
        instruction: 'Crie uma VNet e uma Private DNS Zone para Private Link do blob storage, e vincule à VNet.',
        hints: ['\`az network private-dns zone create\` e depois \`az network private-dns link vnet create\`'],
        solution: `\`\`\`bash
# VNet para o lab
az network vnet create \\
  --name dns-vnet --resource-group rg-dns-lab \\
  --address-prefixes 10.0.0.0/16 \\
  --subnet-name app-subnet --subnet-prefixes 10.0.1.0/24

# Private DNS Zone para Storage Private Link
az network private-dns zone create \\
  --name "privatelink.blob.core.windows.net" \\
  --resource-group rg-dns-lab

# Vincular à VNet (sem auto-registration para zonas de Private Link)
az network private-dns link vnet create \\
  --zone-name "privatelink.blob.core.windows.net" \\
  --resource-group rg-dns-lab \\
  --name dns-vnet-link \\
  --virtual-network dns-vnet \\
  --registration-enabled false

# Simular registro de Private Endpoint (normalmente criado automaticamente)
az network private-dns record-set a add-record \\
  --zone-name "privatelink.blob.core.windows.net" \\
  --resource-group rg-dns-lab \\
  --record-set-name "mysa" \\
  --ipv4-address 10.0.1.5
\`\`\``,
        verify: `\`\`\`bash
# Verificar VNet link está Completed
az network private-dns link vnet show \\
  --zone-name "privatelink.blob.core.windows.net" \\
  --resource-group rg-dns-lab \\
  --name dns-vnet-link \\
  --query "{Status:provisioningState,VNet:virtualNetwork.id}" -o table
# Saída esperada: Status = Succeeded

# Verificar registro DNS criado
az network private-dns record-set a list \\
  --zone-name "privatelink.blob.core.windows.net" \\
  --resource-group rg-dns-lab \\
  --query "[].{Nome:name,IP:aRecords[0].ipv4Address}" -o table
# Saída: mysa | 10.0.1.5
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-dns-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-dns-lab 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Private Endpoint criado mas nome ainda resolve para IP público',
      difficulty: 'medium',
      symptom: 'Após criar Private Endpoint para uma Storage Account e uma Private DNS Zone, \`nslookup mysa.blob.core.windows.net\` dentro da VNet ainda retorna o IP público.',
      diagnosis: `\`\`\`bash
# Verificar se a Private DNS Zone existe
az network private-dns zone list --resource-group myRG \\
  --query "[?name=='privatelink.blob.core.windows.net'].name" -o tsv

# Verificar se o Virtual Network Link existe e está associado à VNet correta
az network private-dns link vnet list \\
  --zone-name "privatelink.blob.core.windows.net" \\
  --resource-group myRG \\
  --query "[].{Nome:name,VNet:virtualNetwork.id,Status:provisioningState}" -o table

# Verificar se há registro A na zona
az network private-dns record-set a list \\
  --zone-name "privatelink.blob.core.windows.net" \\
  --resource-group myRG -o table
\`\`\``,
      solution: `**Causas em ordem de probabilidade:**

1. **Virtual Network Link não criado**: a Private DNS Zone existe mas não está vinculada à VNet onde a VM está. Criar o link:
\`\`\`bash
az network private-dns link vnet create \\
  --zone-name "privatelink.blob.core.windows.net" \\
  --resource-group myRG \\
  --name myVNetLink \\
  --virtual-network myVNet \\
  --registration-enabled false
\`\`\`

2. **Registro DNS não criado**: o Private Endpoint deveria ter criado automaticamente o registro A na zona. Se foi criado manualmente, pode ter nome errado. Verificar o registro e recriar se necessário.

3. **VNet errada no link**: a VM pode estar em VNet diferente da que tem o link. Verificar VNet da VM e criar link adicional.

4. **Custom DNS server na VNet**: se a VNet usa um DNS server customizado (não o Azure DNS padrão 168.63.129.16), esse servidor precisa ser configurado para encaminhar queries para o Azure DNS.`
    }
  ]
};
