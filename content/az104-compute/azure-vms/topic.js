window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-compute/azure-vms'] = {
  theory: `# Azure Virtual Machines & Availability

## Relevância no Exame
> Peso estimado **20-25%** no AZ-104. VMs são o recurso de compute mais cobrado — tamanhos, discos, alta disponibilidade e monitoramento são tópicos frequentes.

## Conceitos Fundamentais

### Criando uma VM
Uma VM Azure é composta por:
- **Compute**: tamanho (vCPUs, RAM)
- **Storage**: disco OS + discos de dados
- **Networking**: NIC em uma subnet de VNet
- **OS Image**: Windows ou Linux (marketplace ou custom)

### Famílias de Tamanho de VM

| Família | Uso Típico | Exemplo |
|---------|-----------|---------|
| **B** (Burstable) | Dev/test, uso intermitente | B2s (2 vCPU, 4GB) |
| **D** (General Purpose) | Web apps, databases pequenos | D4s_v5 (4 vCPU, 16GB) |
| **E** (Memory Optimized) | Bancos de dados, cache in-memory | E8s_v5 (8 vCPU, 64GB) |
| **F** (Compute Optimized) | CPU intensivo | F8s_v2 (8 vCPU, 16GB) |
| **N** (GPU) | ML, renderização | NC6s_v3 (GPU NVIDIA) |
| **L** (Storage Optimized) | Big data, NoSQL | L8s_v3 (NVMe local) |

### Discos de VM

| Tipo | Tecnologia | Uso |
|------|-----------|-----|
| **Standard HDD (HDD)** | Magnético | Backup, arquivo |
| **Standard SSD (E)** | SSD | Cargas leves de produção |
| **Premium SSD (P)** | SSD alta performance | Produção, bancos de dados |
| **Premium SSD v2** | SSD NVMe | Alta I/O, baixa latência |
| **Ultra Disk** | SSD NVMe extremo | Workloads críticos (SAP, Oracle) |

**Tipos de disco por uso:**
- **OS Disk**: disco de sistema operacional (obrigatório)
- **Temporary Disk**: armazenamento efêmero local (não replicado, perdido em reallocation)
- **Data Disk**: discos adicionais para dados da aplicação

### Alta Disponibilidade

#### Availability Sets
Protege contra falhas físicas **dentro de um datacenter**:
- **Fault Domains (FD)**: grupos de servidores com energia e switch compartilhados. Azure distribui VMs por até 3 FDs.
- **Update Domains (UD)**: grupos para manutenção planejada. Azure atualiza um UD por vez. Padrão: 5 UDs.
- SLA: **99.95%** (com 2+ VMs em Availability Set)
- VMs em Availability Set devem ser criadas no mesmo RG e região
- **Não migram para Availability Zones**

#### Availability Zones
Protege contra falhas de **datacenter inteiro** na mesma região:
- Zonas fisicamente separadas com energia, rede e refrigeração independentes
- A maioria das regiões Azure tem 3 zonas
- SLA: **99.99%** (com 2+ VMs em zonas diferentes)
- Suporta Zone-Redundant Storage (ZRS)

#### Azure Site Recovery (ASR)
Replicação de VMs para outra região Azure — para DR (Disaster Recovery). Não é HA, é DR.

### Extensions e Custom Script
**VM Extensions** adicionam funcionalidades pós-deploy:
- **Custom Script Extension**: executa scripts na VM após criação
- **Diagnostics Extension**: envia métricas/logs para Storage/Monitor
- **Azure Monitor Agent**: coleta logs e métricas
- **Key Vault Extension**: sincroniza segredos do Key Vault para arquivos locais

### Bastion Host
Acesso SSH/RDP seguro via browser **sem precisar de IP público na VM**:
- Requer subnet dedicada \`AzureBastionSubnet\` (/27 ou maior)
- Premium: sessão via SSH/RDP tunnelada pelo Azure Portal
- Sem exposição de portas 22 ou 3389 à Internet

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Criar VM Linux simples
az vm create \\
  --name myVM \\
  --resource-group myRG \\
  --image Ubuntu2204 \\
  --size Standard_B2s \\
  --vnet-name myVNet \\
  --subnet mySubnet \\
  --admin-username azureuser \\
  --generate-ssh-keys \\
  --public-ip-sku Standard

# Criar VM em Availability Zone
az vm create \\
  --name myVM-zone1 \\
  --resource-group myRG \\
  --image Ubuntu2204 \\
  --size Standard_D2s_v5 \\
  --zone 1 \\
  --admin-username azureuser \\
  --generate-ssh-keys

# Criar Availability Set
az vm availability-set create \\
  --name myAvailabilitySet \\
  --resource-group myRG \\
  --platform-fault-domain-count 3 \\
  --platform-update-domain-count 5

# Criar VM em Availability Set
az vm create \\
  --name myVM \\
  --resource-group myRG \\
  --availability-set myAvailabilitySet \\
  --image Win2022Datacenter \\
  --size Standard_D2s_v3 \\
  --admin-username azureuser \\
  --admin-password "P@ssword123!"

# Listar VMs e status
az vm list --resource-group myRG \\
  --query "[].{Nome:name,Status:powerState,Tamanho:hardwareProfile.vmSize}" -o table

# Parar VM (desaloca, para de cobrar compute)
az vm deallocate --name myVM --resource-group myRG

# Iniciar VM
az vm start --name myVM --resource-group myRG

# Redimensionar VM
az vm resize \\
  --name myVM \\
  --resource-group myRG \\
  --size Standard_D4s_v5

# Adicionar disco de dados
az vm disk attach \\
  --vm-name myVM \\
  --resource-group myRG \\
  --name myDataDisk \\
  --size-gb 128 \\
  --sku Premium_LRS \\
  --new

# Ver informações de alta disponibilidade da VM
az vm show \\
  --name myVM \\
  --resource-group myRG \\
  --query "{AvailSet:availabilitySet,Zone:zones,Size:hardwareProfile.vmSize}" -o json

# Executar script remoto na VM via Run Command
az vm run-command invoke \\
  --name myVM \\
  --resource-group myRG \\
  --command-id RunShellScript \\
  --scripts "sudo apt-get update && sudo apt-get install -y nginx"
\`\`\`

## Erros Comuns

1. **VM parada vs deallocated**: "Stopped" ainda cobra por compute; "Deallocated" não cobra (mas o IP público pode mudar).
2. **Availability Set ≠ Availability Zone**: são estratégias diferentes — não são intercambiáveis.
3. **Temporary disk perdido**: dados no temp disk são perdidos em deallocate/resize/falha de hardware — usar apenas para cache/temp files.
4. **Premium SSD não disponível em todos os tamanhos**: VMs da série B (burstable) não suportam Premium SSD.
5. **Limite de discos por VM**: cada tamanho de VM tem limite máximo de discos de dados (Max Data Disks).

## Killer.sh Style Challenge

> **Cenário**: Uma aplicação web de 3-tier (web, app, database) precisa de alta disponibilidade:
> - Tier web: 3 VMs resistentes a falhas de datacenter **e** a falhas de hardware
> - Tier app: 2 VMs resistentes apenas a falhas de hardware
> - Tier database: 2 VMs com armazenamento de alta performance para SQL Server
>
> **Recomende a estratégia de HA e tipo de disco para cada tier.**
>
> **Resposta**:
> - Web tier: **Availability Zones** (3 VMs em zonas 1, 2, 3) — protege contra falha de datacenter + SLA 99.99%
> - App tier: **Availability Set** (2 VMs) — protege contra falha de hardware/planned maintenance + SLA 99.95%
> - DB tier: **Availability Zone** + **Premium SSD** (P30 ou superior) — performance de I/O para SQL Server
`,

  quiz: [
    {
      question: 'Qual é a diferença entre Availability Sets e Availability Zones no Azure?',
      options: [
        'Availability Sets protegem contra falhas de datacenter; Zones protegem apenas contra hardware',
        'Availability Sets protegem contra falhas de hardware/manutenção dentro de um datacenter (FD/UD); Zones protegem contra falha do datacenter inteiro',
        'Não há diferença técnica, apenas de custo',
        'Availability Zones são a versão mais antiga; Availability Sets são a mais nova'
      ],
      correct: 1,
      explanation: 'Availability Sets distribuem VMs por Fault Domains (racks separados) e Update Domains dentro de um único datacenter. Protege contra falhas de hardware e janelas de manutenção, mas não contra falha do datacenter inteiro. Availability Zones colocam VMs em datacenters fisicamente separados na mesma região, protegendo contra falha completa de um datacenter. SLA: 99.95% (Avail. Set) vs 99.99% (Avail. Zones).',
      reference: 'Memorizou: Sets = dentro do DC (FD + UD, 99.95%). Zones = DCs separados (99.99%).'
    },
    {
      question: 'Uma VM Azure foi "Stopped" (pelo sistema operacional) mas não "Deallocated". Qual é a implicação?',
      options: [
        'A VM não cobra nada quando está Stopped',
        'A VM continua sendo cobrada por compute quando está Stopped mas não Deallocated',
        'Uma VM parada pelo OS é automaticamente deallocated pelo Azure',
        'Stopped e Deallocated são sinônimos no Azure'
      ],
      correct: 1,
      explanation: 'Stopped (VM desligada pelo OS ou pelo botão "Stop" que não desaloca) ainda tem compute alocado — você continua pagando pela instância. Somente quando o estado é "Deallocated" (via portal "Stop" que desaloca, ou \`az vm deallocate\`) o Azure libera o hardware e para de cobrar pelo compute. Recursos como discos e IPs ainda cobram.',
      reference: 'Use SEMPRE \`az vm deallocate\` para parar VMs em dev/test e economizar. "Stop" dentro do OS não desaloca.'
    },
    {
      question: 'Qual é o SLA de disponibilidade para VMs distribuídas em Availability Zones vs Availability Sets?',
      options: [
        'Zones: 99.9% | Sets: 99.5%',
        'Zones: 99.99% | Sets: 99.95%',
        'Zones: 99.95% | Sets: 99.99%',
        'Ambos oferecem 99.99%'
      ],
      correct: 1,
      explanation: '2+ VMs em Availability Zones → SLA 99.99% (quatro noves). 2+ VMs em Availability Set → SLA 99.95%. A diferença é porque Zones oferecem isolamento físico entre datacenters, enquanto Sets apenas isolam hardware dentro de um datacenter.',
      reference: 'SLA é fundamental para questões de design no AZ-304/305: Zones = 99.99%, Sets = 99.95%, VM única Premium SSD = 99.9%.'
    },
    {
      question: 'Qual tipo de disco Azure oferece a maior IOPS e menor latência para workloads de banco de dados de missão crítica?',
      options: [
        'Standard HDD',
        'Premium SSD',
        'Standard SSD',
        'Ultra Disk'
      ],
      correct: 3,
      explanation: 'Ultra Disk oferece as maiores IOPS (até 400.000) e menor latência (sub-milissegundo) — ideal para workloads extremamente intensivos como SAP HANA, Oracle, SQL Server crítico. Premium SSD oferece boa performance e é o mais usado em produção, mas Ultra Disk supera em todos os aspectos de I/O. Ultra Disk tem restrições: disponível apenas em certas regiões e tamanhos de VM.',
      reference: 'Hierarquia de performance: HDD < Standard SSD < Premium SSD < Ultra Disk (custo e IOPS crescem juntos).'
    },
    {
      question: 'O que acontece com os dados no Temporary Disk de uma VM Azure quando ela é deallocated e reiniciada?',
      options: [
        'Os dados são preservados automaticamente',
        'Os dados são perdidos — o temporary disk não é persistente',
        'Os dados são migrados automaticamente para o OS disk',
        'Os dados ficam em um snapshot temporário por 24 horas'
      ],
      correct: 1,
      explanation: 'O Temporary Disk (D: no Windows, /dev/sdb no Linux) é armazenamento local efêmero. Os dados são perdidos em eventos de deallocate, resize, falha de hardware ou manutenção planejada. Use-o apenas para dados que podem ser recriados: swap files, cache temporário, arquivos de sessão. NUNCA armazene dados importantes no temp disk.',
      reference: 'Temp disk = armazenamento volátil. Para dados persistentes, use Data Disks (gerenciados pelo Azure).'
    },
    {
      question: 'Como você acessa uma VM Linux via SSH de forma segura sem expor a porta 22 à Internet?',
      options: [
        'Criar uma regra NSG Allow porta 22 apenas para seu IP público',
        'Usar Azure Bastion — acesso SSH/RDP via browser sem expor portas à Internet',
        'Criar um Jump Server (Bastion Host personalizado) com IP público',
        'Usar VPN ponto-a-site para conectar ao Azure'
      ],
      correct: 1,
      explanation: 'Azure Bastion é um serviço gerenciado que fornece acesso SSH e RDP seguro via browser (HTTPS) sem expor portas 22 ou 3389 à Internet. Requer uma subnet dedicada "AzureBastionSubnet" (/27 ou maior) na VNet. É o método recomendado pela Microsoft para acesso remoto seguro às VMs.',
      reference: 'Bastion = acesso seguro sem IP público na VM. VPN P2S também é válida para acesso corporativo, mas Bastion é mais simples para acesso ad-hoc.'
    }
  ],

  flashcards: [
    {
      front: 'Qual é a diferença entre VM Stopped e VM Deallocated?',
      back: '**Stopped** (desligada no OS ou sem desalocar):\n- VM continua reservada no hardware\n- **Cobra** pelo compute (vCPU + RAM)\n- IP público (se dynamic) pode ser preservado\n\n**Deallocated** (\`az vm deallocate\`):\n- Hardware liberado pelo Azure\n- **Não cobra** por compute\n- IP público dynamic pode ser liberado\n- Dados em OS/Data disks são preservados\n\nSempre use \`deallocate\` para parar VMs que não serão usadas.'
    },
    {
      front: 'O que são Fault Domains e Update Domains em um Availability Set?',
      back: '**Fault Domain (FD)**: grupo de hardware físico (rack) que compartilha energia e switch de rede. Azure distribui VMs por até 3 FDs. Se um rack falhar, apenas as VMs naquele FD são afetadas.\n\n**Update Domain (UD)**: grupo lógico para manutenção planejada. Azure reinicia um UD por vez. Padrão: 5 UDs. Se você tem 2 VMs em UDs diferentes, nunca as duas são reiniciadas simultaneamente.\n\nSLA com 2+ VMs em Availability Set: **99.95%**'
    },
    {
      front: 'Quais são os tipos de disco Azure e suas características?',
      back: '| Tipo | SKU | Uso |\n|------|-----|-----|\n| Standard HDD | HDD | Backup, arquivo (baixo custo) |\n| Standard SSD | E | Dev/test, apps leves |\n| Premium SSD | P | Produção, DBs (I/O intensivo) |\n| Premium SSD v2 | — | Alta I/O + baixa latência |\n| Ultra Disk | — | Missão crítica (SAP, Oracle) |\n\nTemp disk: local, efêmero, **perdido em deallocate/resize**.'
    },
    {
      front: 'O que é Azure Bastion e por que usá-lo?',
      back: '**Azure Bastion** é um serviço PaaS gerenciado para acesso SSH/RDP a VMs via browser (HTTPS) sem expor portas à Internet.\n\n**Vantagens**:\n- VMs sem IP público = menor superfície de ataque\n- Sem gerenciar Jump Servers\n- Integrado ao portal Azure\n- Suporte a chaves SSH e credenciais\n\n**Requisitos**:\n- Subnet dedicada \`AzureBastionSubnet\` (/27 mínimo)\n- SKU: Basic ou Standard (Standard = mais funcionalidades)'
    },
    {
      front: 'Quando usar Availability Set vs Availability Zone?',
      back: '**Use Availability Set quando:**\n- A região não tem Availability Zones\n- Necessidade de controle granular de FD/UD\n- Budget mais restrito\n- SLA 99.95% é suficiente\n\n**Use Availability Zone quando:**\n- Região suporta zones (maioria das grandes regiões)\n- Precisar proteger contra falha de datacenter inteiro\n- SLA 99.99% é necessário\n- Workloads críticos de produção\n\nNão é possível mover VMs entre Availability Sets e Zones após criação.'
    }
  ],

  lab: {
    scenario: 'Crie duas VMs Linux para a TechNova usando estratégias de alta disponibilidade diferentes: uma em Availability Set e outra em Availability Zone.',
    objective: 'Criar VMs com Availability Sets e Zones, verificar configurações de HA e entender o impacto nos SLAs.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Criar VM em Availability Zone',
        instruction: `Crie uma VM Linux \`web-vm-zone1\` na Zone 1, tamanho B2s, com a imagem Ubuntu 22.04. Use geração automática de chaves SSH.`,
        hints: [
          'Use \`--zone 1\` para especificar a Availability Zone',
          'Imagem Ubuntu: \`Ubuntu2204\`',
          '\`--generate-ssh-keys\` cria chave SSH automaticamente'
        ],
        solution: `\`\`\`bash
az group create --name rg-compute-lab --location eastus

# Criar VM em Availability Zone 1
az vm create \\
  --name web-vm-zone1 \\
  --resource-group rg-compute-lab \\
  --image Ubuntu2204 \\
  --size Standard_B2s \\
  --zone 1 \\
  --admin-username azureuser \\
  --generate-ssh-keys \\
  --output json | grep -E '"name"|"zones"|"publicIpAddress"'
\`\`\``,
        verify: `\`\`\`bash
az vm show \\
  --name web-vm-zone1 \\
  --resource-group rg-compute-lab \\
  --query "{Nome:name,Zones:zones,Status:provisioningState}" -o table
# Saída esperada:
# Nome           Zones  Status
# -------------  -----  ---------
# web-vm-zone1   ['1']  Succeeded
\`\`\``
      },
      {
        title: 'Criar Availability Set e segunda VM',
        instruction: `Crie um Availability Set \`app-avset\` com 3 Fault Domains e 5 Update Domains. Depois crie uma VM \`app-vm-1\` dentro desse Availability Set.`,
        hints: [
          '\`az vm availability-set create\` com \`--platform-fault-domain-count\` e \`--platform-update-domain-count\`',
          'Ao criar a VM, usar \`--availability-set\` para associar'
        ],
        solution: `\`\`\`bash
# Criar Availability Set
az vm availability-set create \\
  --name app-avset \\
  --resource-group rg-compute-lab \\
  --platform-fault-domain-count 3 \\
  --platform-update-domain-count 5

# Criar VM no Availability Set
az vm create \\
  --name app-vm-1 \\
  --resource-group rg-compute-lab \\
  --image Ubuntu2204 \\
  --size Standard_B2s \\
  --availability-set app-avset \\
  --admin-username azureuser \\
  --generate-ssh-keys \\
  --no-wait
\`\`\``,
        verify: `\`\`\`bash
# Verificar Availability Set
az vm availability-set show \\
  --name app-avset \\
  --resource-group rg-compute-lab \\
  --query "{FDs:platformFaultDomainCount,UDs:platformUpdateDomainCount,VMs:length(virtualMachines)}" -o table
# Saída esperada: FDs=3, UDs=5

# Verificar VM no AvSet (após provisionamento)
az vm show \\
  --name app-vm-1 \\
  --resource-group rg-compute-lab \\
  --query "{Nome:name,AvailSet:availabilitySet.id}" -o json 2>/dev/null | grep -c "app-avset" && echo "VM está no Availability Set correto"
\`\`\``
      },
      {
        title: 'Verificar status e deallocate VMs para economizar',
        instruction: `Liste todas as VMs criadas com seus status de energia. Em seguida, deallocate as VMs para não cobrar pelo compute durante o lab.`,
        hints: [
          '\`az vm list --show-details\` inclui o \`powerState\`',
          '\`az vm deallocate\` pode ser chamado com \`--no-wait\` para não bloquear'
        ],
        solution: `\`\`\`bash
# Listar VMs com status de energia
az vm list --resource-group rg-compute-lab --show-details \\
  --query "[].{Nome:name,Status:powerState,Zona:zones,AvailSet:availabilitySet.id}" -o table

# Deallocate ambas as VMs para economizar
az vm deallocate --name web-vm-zone1 --resource-group rg-compute-lab --no-wait
az vm deallocate --name app-vm-1 --resource-group rg-compute-lab --no-wait

echo "VMs sendo deallocated — não haverá cobrança de compute"
\`\`\``,
        verify: `\`\`\`bash
# Aguardar deallocate e verificar status (após 1-2 minutos)
az vm list --resource-group rg-compute-lab --show-details \\
  --query "[].{Nome:name,Status:powerState}" -o table
# Saída esperada após deallocate:
# Status: VM deallocated
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group e todos os recursos.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-compute-lab --yes --no-wait
echo "Limpeza iniciada!"
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-compute-lab 2>/dev/null && echo "Ainda deletando..." || echo "RG deletado com sucesso"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'VM não inicializa após redimensionamento (resize)',
      difficulty: 'medium',
      symptom: 'Após fazer resize de uma VM para um tamanho maior, a VM fica presa em "Starting" e não inicializa.',
      diagnosis: `\`\`\`bash
# Verificar o estado atual da VM
az vm show --name myVM --resource-group myRG \\
  --query "{Status:provisioningState,PowerState:instanceView.statuses}" -o json

# Verificar se o tamanho desejado está disponível na zona/região
az vm list-vm-resize-options \\
  --name myVM \\
  --resource-group myRG \\
  --query "[].name" -o tsv | grep D4s

# Verificar logs de boot via Boot Diagnostics
az vm boot-diagnostics get-boot-log --name myVM --resource-group myRG
\`\`\``,
      solution: `**Causas e soluções:**

1. **Tamanho não disponível no cluster atual**: o host onde a VM está alocada pode não ter capacidade do tamanho solicitado. Solução: deallocate a VM antes de fazer resize (libera o hardware, Azure aloca em hardware que suporte o novo tamanho):
\`\`\`bash
az vm deallocate --name myVM --resource-group myRG
az vm resize --name myVM --resource-group myRG --size Standard_D4s_v5
az vm start --name myVM --resource-group myRG
\`\`\`

2. **VM em Availability Set com limitação de tamanhos**: todos os tamanhos devem ser da mesma família para VMs no mesmo Availability Set. Verificar compatibilidade antes do resize.

3. **Boot Diagnostics para diagnóstico**: habilitar Boot Diagnostics para ver screenshot da tela de boot e logs de inicialização.`
    },
    {
      title: 'Não consegue conectar via SSH à VM',
      difficulty: 'easy',
      symptom: 'Tentativa de SSH para uma VM Azure retorna "Connection timed out" ou "Connection refused".',
      diagnosis: `\`\`\`bash
# Verificar se VM está running
az vm show --name myVM --resource-group myRG --show-details \\
  --query "powerState" -o tsv

# Verificar IP público da VM
az vm list-ip-addresses --name myVM --resource-group myRG -o table

# Verificar regras NSG efetivas na NIC
az network nic list-effective-nsg --name myNIC --resource-group myRG \\
  --query "effectiveNetworkSecurityGroups[].effectiveSecurityRules[?access=='Allow' && direction=='Inbound']" -o table

# Usar Network Watcher para verificar conectividade
az network watcher test-connectivity \\
  --source-resource <vm-resource-id> \\
  --dest-address <ip-destino> \\
  --dest-port 22
\`\`\``,
      solution: `**Checklist em ordem:**

1. **VM está rodando?** Verificar \`powerState\` = "VM running"
2. **IP público configurado?** VM pode ter sido criada sem IP público
3. **NSG bloqueia porta 22?** Verificar se há regra Allow porta 22 ou usar Azure Bastion
4. **Just-in-Time (JIT) VM Access**: se o Azure Security Center/Defender está ativo, a porta 22 pode ser bloqueada por padrão. Solicitar acesso JIT via portal
5. **Chave SSH incorreta**: verificar se está usando a chave correta para o usuário configurado

**Solução recomendada — Azure Bastion**:
\`\`\`bash
# Criar Bastion (requer AzureBastionSubnet)
az network vnet subnet create \\
  --name AzureBastionSubnet \\
  --vnet-name myVNet --resource-group myRG \\
  --address-prefixes 10.0.100.0/27

az network bastion create \\
  --name myBastion \\
  --resource-group myRG \\
  --vnet-name myVNet \\
  --location eastus \\
  --sku Basic
\`\`\``
    }
  ]
};
