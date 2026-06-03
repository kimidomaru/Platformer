window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-storage/azure-files'] = {
  theory: `# Azure Files & File Sync

## Relevância no Exame
> Peso estimado **5-8%** no AZ-104. Questões sobre compartilhamentos SMB/NFS e Azure File Sync para híbrido.

## Conceitos Fundamentais

### Azure Files
Serviço de compartilhamento de arquivos gerenciado na nuvem:
- **Protocolo SMB** (Windows, Linux, macOS) — padrão para Windows
- **Protocolo NFS** (Linux) — requer Standard_ZRS ou Premium
- Totalmente gerenciado — sem gerenciar servidores de arquivos

**Tiers:**
| Tier | Storage Type | Uso |
|------|-------------|-----|
| **Transaction optimized** | HDD Standard | Acesso geral, custo otimizado |
| **Hot** | HDD Standard | Acesso frequente |
| **Cool** | HDD Standard | Acesso esporádico, menor custo |
| **Premium** | SSD | Latência baixa, workloads intensivos |

### Azure File Sync
Sincroniza Azure Files com servidores de arquivos Windows on-premises:
- **Cloud tiering**: arquivos menos acessados ficam somente na nuvem (placeholder local)
- **Multi-site sync**: múltiplos servidores Windows sincronizam o mesmo share
- **Namespace unificado**: usuários veem todos os arquivos, mesmo que parte esteja na nuvem

**Componentes:**
1. **Storage Sync Service**: recurso Azure que orquestra a sincronização
2. **Azure File Share**: o compartilhamento que serve como "master"
3. **Sync Group**: associa o share com os server endpoints
4. **Server Endpoint**: pasta em um servidor Windows registrado
5. **Azure File Sync Agent**: instalado no servidor Windows

### Quando usar Azure Files vs Blob
- **Azure Files**: compartilhamento SMB/NFS para lift-and-shift de file servers, home directories
- **Blob**: objetos/arquivos não estruturados acessados via REST API

### Montando Azure Files

**Windows:**
\`\`\`powershell
# Montar via script gerado no portal
net use Z: \\\\<sa>.file.core.windows.net\\<share> /u:AZURE\\<sa> <chave-de-acesso>
\`\`\`

**Linux:**
\`\`\`bash
sudo mount -t cifs //<sa>.file.core.windows.net/<share> /mnt/azfiles \\
  -o vers=3.0,username=<sa>,password=<key>,serverino
\`\`\`

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Criar file share
az storage share-rm create \\
  --storage-account mysa \\
  --resource-group myRG \\
  --name myfileshare \\
  --quota 100  # GB

# Listar shares
az storage share-rm list \\
  --storage-account mysa \\
  --resource-group myRG -o table

# Criar diretório no share
az storage directory create \\
  --account-name mysa \\
  --share-name myfileshare \\
  --name "documents"

# Upload de arquivo
az storage file upload \\
  --account-name mysa \\
  --share-name myfileshare \\
  --source ./myfile.txt

# Criar Storage Sync Service
az storagesync create \\
  --resource-group myRG \\
  --storage-sync-service-name mySyncService \\
  --location eastus
\`\`\`

## Erros Comuns

1. **SMB bloqueado por firewall**: porta TCP 445 deve estar aberta na rede corporativa para montar Azure Files via SMB.
2. **NFS requer redundância específica**: NFS no Azure Files requer Premium tier OU Standard com ZRS.
3. **Cloud tiering e espaço em disco**: se o servidor local ficar sem espaço, cloud tiering pode falhar — monitorar espaço disponível.

## Killer.sh Style Challenge

> Uma empresa tem 10 filiais com servidores de arquivos Windows. Querem centralizar dados na nuvem mantendo acesso local rápido. O que usar?
>
> **Resposta**: Azure File Sync com cloud tiering habilitado. Um Azure File Share central, Storage Sync Service, 10 Server Endpoints (um por filial). Arquivos recentes ficam localmente (cache), menos acessados ficam somente na Azure Files (com placeholder local que acessa sob demanda).
`,

  quiz: [
    {
      question: 'Qual protocolo o Azure Files usa por padrão para compartilhamentos Windows?',
      options: ['NFS v4', 'SMB (Server Message Block)', 'FTP', 'WebDAV'],
      correct: 1,
      explanation: 'Azure Files usa SMB (Server Message Block) como protocolo padrão para Windows — o mesmo protocolo dos compartilhamentos de rede Windows tradicionais. Para Linux, NFS também está disponível mas com requisitos específicos de tier e redundância.',
      reference: 'SMB = padrão Windows (porta 445). NFS = Linux (requer Premium ou Standard ZRS). Ambos são suportados pelo Azure Files.'
    },
    {
      question: 'O que faz o "Cloud Tiering" no Azure File Sync?',
      options: [
        'Move todos os arquivos para a nuvem e remove o servidor local',
        'Mantém arquivos frequentemente acessados localmente; move arquivos raramente acessados para Azure Files, deixando um placeholder local',
        'Sincroniza arquivos automaticamente entre diferentes regiões Azure',
        'Comprime arquivos na nuvem para economizar espaço'
      ],
      correct: 1,
      explanation: 'Cloud Tiering mantém arquivos "quentes" (acessados recentemente) no servidor local para acesso rápido, e move arquivos "frios" para Azure Files na nuvem. Um placeholder (atalho) fica no servidor local — ao acessar, o arquivo é baixado transparentemente da nuvem. Isso permite ter um namespace maior que o disco local.',
      reference: 'Cloud Tiering = cache inteligente local. Arquivos frequentes = locais. Raramente acessados = Azure Files (transparente para o usuário).'
    },
    {
      question: 'Qual é a porta TCP que deve estar aberta para montar Azure Files via SMB em redes corporativas?',
      options: ['80', '443', '445', '2049'],
      correct: 2,
      explanation: 'SMB usa a porta TCP 445. Muitas redes corporativas bloqueiam essa porta por razões de segurança (WannaCry explorou SMBv1). Se a porta 445 estiver bloqueada, a montagem de Azure Files via SMB falha. Alternativas: usar Azure VPN Gateway ou ExpressRoute para montar via rede privada.',
      reference: 'SMB = porta 445 (muitas empresas bloqueiam). NFS = porta 2049. HTTPS = 443 (REST API do storage).'
    }
  ],

  flashcards: [
    {
      front: 'Quais são os componentes do Azure File Sync?',
      back: '1. **Storage Sync Service** — recurso Azure que orquestra a sincronização\n2. **Azure File Share** — o share na nuvem que serve de "master"\n3. **Sync Group** — associa o share com os server endpoints\n4. **Server Endpoint** — pasta em um servidor Windows registrado\n5. **Azure File Sync Agent** — software instalado no servidor Windows\n\nFluxo: Agent → conecta ao Storage Sync Service → sincroniza com o File Share'
    },
    {
      front: 'Azure Files vs Azure Blob: quando usar cada um?',
      back: '**Azure Files** (compartilhamento SMB/NFS):\n- Lift-and-shift de file servers Windows\n- Home directories de usuários\n- Aplicações que esperam file system (SMB)\n- Multi-attach de VMs ao mesmo share\n\n**Azure Blob Storage** (objetos):\n- Arquivos acessados via REST API\n- Backups, logs, mídia, dados de ML\n- Acesso programático (SDK)\n- Tiers Hot/Cool/Archive para lifecycle\n\nRegra: se a aplicação usa \`\\\\server\\share\` → Files. Se usa REST API ou SDK → Blob.'
    }
  ],

  lab: {
    scenario: 'Crie um Azure File Share e monte-o para verificar o funcionamento.',
    objective: 'Criar file share e verificar as configurações de montagem.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Criar Storage Account e File Share',
        instruction: 'Crie uma storage account e um file share de 100GB.',
        hints: ['Use \`az storage share-rm create\` com \`--quota\`'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-files-lab --location eastus
az storage account create \\
  --name "filestore\${SUFFIX}" --resource-group rg-files-lab \\
  --sku Standard_LRS --kind StorageV2

az storage share-rm create \\
  --storage-account "filestore\${SUFFIX}" \\
  --resource-group rg-files-lab \\
  --name company-files \\
  --quota 100

echo "File share criado: //filestore\${SUFFIX}.file.core.windows.net/company-files"
\`\`\``,
        verify: `\`\`\`bash
SUFFIX=$(ls /tmp/ | grep -o '[0-9]*' | tail -1 2>/dev/null || date +%s | tail -c 5)
az storage share-rm list --resource-group rg-files-lab \\
  --query "[].{Nome:name,Quota:shareQuota,Status:provisioningState}" -o table 2>/dev/null || \\
  echo "Verificar: az storage share-rm list --resource-group rg-files-lab"
\`\`\``
      },
      {
        title: 'Obter script de montagem',
        instruction: 'Obtenha as credenciais para montar o file share e veja o script de montagem.',
        hints: ['Use \`az storage account keys list\` para obter a chave de acesso'],
        solution: `\`\`\`bash
# Obter nome da storage account
SA_NAME=$(az storage account list --resource-group rg-files-lab --query "[0].name" -o tsv)

# Obter chave de acesso
ACCESS_KEY=$(az storage account keys list \\
  --account-name $SA_NAME --resource-group rg-files-lab \\
  --query "[0].value" -o tsv)

echo "=== Script de Montagem Linux ==="
echo "sudo mount -t cifs //\${SA_NAME}.file.core.windows.net/company-files /mnt/azfiles \\"
echo "  -o vers=3.0,username=\${SA_NAME},password=<ACCESS_KEY>,serverino"

echo ""
echo "=== Script de Montagem Windows ==="
echo "net use Z: \\\\\\\\\\\${SA_NAME}.file.core.windows.net\\\\company-files /u:AZURE\\\\\\\${SA_NAME} <ACCESS_KEY>"
\`\`\``,
        verify: `\`\`\`bash
SA_NAME=$(az storage account list --resource-group rg-files-lab --query "[0].name" -o tsv 2>/dev/null)
echo "Storage Account: $SA_NAME"
echo "URL SMB: //\${SA_NAME}.file.core.windows.net/company-files"
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-files-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-files-lab 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Não consegue montar Azure Files via SMB na rede corporativa',
      difficulty: 'easy',
      symptom: 'Tentativa de montar Azure Files com \`net use\` retorna "System error 53 - The network path was not found".',
      diagnosis: `\`\`\`bash
# Testar conectividade na porta 445
# No Windows:
# Test-NetConnection -ComputerName <sa>.file.core.windows.net -Port 445

# No Linux:
nc -zv <sa>.file.core.windows.net 445
# Se retornar "Connection refused" ou timeout, porta 445 está bloqueada
\`\`\``,
      solution: `**Causa**: Porta TCP 445 bloqueada pelo firewall corporativo ou ISP (comum após WannaCry em 2017).

**Soluções:**

1. **Azure VPN Gateway (P2S)**: conectar o computador à VNet Azure via VPN cliente, montar o share via rede privada (sem depender de porta 445 na Internet).

2. **Azure VPN Gateway (S2S)**: para toda a rede corporativa, montar via ExpressRoute ou S2S VPN.

3. **Solicitar abertura de porta**: trabalhar com o time de segurança para abrir a porta 445 apenas para o IP do Azure Files (\`<sa>.file.core.windows.net\`).

4. **Usar REST API ou azcopy**: se apenas precisar de acesso programático, Azure Files tem REST API que usa porta 443.`
    }
  ]
};
