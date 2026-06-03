window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-storage/blob-storage'] = {
  theory: `# Azure Blob Storage & Lifecycle Management

## Relevância no Exame
> Peso estimado **8-12%** no AZ-104. Tipos de blob, segurança, lifecycle e SAS tokens são tópicos frequentes.

## Conceitos Fundamentais

### Tipos de Blob
- **Block Blob**: arquivos genéricos, uploads de grande volume (até 190.7 TiB). Mais usado.
- **Append Blob**: otimizado para append-only (logs, auditoria). Apenas adiciona ao final.
- **Page Blob**: blocos de 512 bytes, aleatório read/write. Usado para discos de VM (VHD).

### Imutabilidade (WORM)
- **Time-based retention**: blob não pode ser modificado/deletado até expirar o período
- **Legal hold**: bloco indefinido até remoção explícita (ex: litígio)
- Requer container com imutabilidade habilitada

### Anonymous Access
- **Private** (padrão): sem acesso anônimo — sempre requer auth
- **Blob**: qualquer pessoa pode ler blobs individuais
- **Container**: qualquer pessoa pode listar e ler blobs do container

> **Segurança**: desabilitar anonymous access no nível da storage account para prevenir exposcição acidental.

### Shared Access Signatures (SAS)
\`\`\`
URL com SAS:
https://sa.blob.core.windows.net/container/file.txt?
  sv=2023-01-03     (signed version)
  &ss=b             (signed services: blob)
  &srt=o            (signed resource type: object)
  &sp=r             (signed permissions: read)
  &se=2024-12-31T00:00Z  (expiry)
  &sig=...          (signature)
\`\`\`

### Storage Networking
- **Public endpoint**: acessível pela Internet (padrão)
- **Service Endpoints**: tráfego fica na rede Azure mas sem IP privado
- **Private Endpoint**: IP privado dentro da VNet para acesso completamente privado

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Criar container com acesso privado
az storage container create \\
  --name mycontainer \\
  --account-name mysa \\
  --public-access off \\
  --auth-mode login

# Listar blobs
az storage blob list \\
  --container-name mycontainer \\
  --account-name mysa \\
  --auth-mode login \\
  --query "[].{Nome:name,Tier:properties.blobTier,Tamanho:properties.contentLength}" -o table

# Copiar blob entre containers/contas
az storage blob copy start \\
  --source-account-name sourcesa \\
  --source-container sourcecontainer \\
  --source-blob myblob.txt \\
  --destination-container destcontainer \\
  --destination-blob myblob.txt \\
  --account-name destsa \\
  --auth-mode login

# Criar Stored Access Policy
az storage container policy create \\
  --container-name mycontainer \\
  --name readonly-policy \\
  --account-name mysa \\
  --permissions r \\
  --expiry 2025-12-31T00:00Z \\
  --auth-mode login

# Gerar SAS com Stored Access Policy
az storage blob generate-sas \\
  --container-name mycontainer \\
  --name myblob.txt \\
  --account-name mysa \\
  --policy-name readonly-policy \\
  --auth-mode login -o tsv
\`\`\`

## Erros Comuns

1. **Blob público exposto**: verificar "Allow Blob Anonymous Access" na storage account — deve estar Disabled.
2. **SAS com permissão errada**: SAS read-only não pode fazer upload — permissão "r" é apenas leitura.
3. **Stored Access Policy revogada mas URL ainda funciona brevemente**: propagação pode demorar alguns minutos.

## Killer.sh Style Challenge

> Você precisa fornecer acesso temporário de upload (apenas PUT) a um parceiro externo para um blob específico, válido por 24 horas, de forma que possa revogar o acesso antes do prazo se necessário. Como fazer?
>
> **Resposta**: Criar uma **Stored Access Policy** no container com permissão "w" e expiração em 24h → gerar SAS usando essa policy (não inline). Se precisar revogar antes: deletar a Stored Access Policy → todos os SAS baseados nela são invalidados imediatamente.
`,

  quiz: [
    {
      question: 'Qual tipo de blob é mais adequado para armazenar logs de aplicação que são continuamente adicionados ao mesmo arquivo?',
      options: [
        'Block Blob',
        'Page Blob',
        'Append Blob',
        'Premium Blob'
      ],
      correct: 2,
      explanation: 'Append Blob é otimizado para operações de append-only — adicionar dados ao final do blob de forma eficiente. Ideal para logs, auditoria e dados de streaming onde apenas novas entradas são adicionadas. Block Blob suporta escrita completa mas requer reescrita do bloco inteiro para modificações.',
      reference: 'Block Blob = arquivos genéricos. Append Blob = logs/streams. Page Blob = discos de VM (VHD).'
    },
    {
      question: 'Você criou uma SAS token que expira em 1 hora. Um usuário começa a usar a URL. Você descobre que ele não deveria ter acesso. Como revogar IMEDIATAMENTE, sem esperar a expiração?',
      options: [
        'Deletar o blob — isso invalida qualquer SAS existente',
        'Alterar as chaves de acesso (Access Keys) da Storage Account — invalida SAS assinadas com a chave antiga',
        'Alterar o CORS da storage account',
        'Não é possível — SAS não podem ser revogadas antes da expiração'
      ],
      correct: 1,
      explanation: 'SAS tokens assinados com Access Keys ficam invalidados quando a key é rotacionada/alterada. Esta é a forma de revogar um SAS inline "inline SAS" imediatamente. Para evitar ter que rotacionar keys, use Stored Access Policies — você pode revogar deletando a policy sem afetar outras SAS.',
      reference: 'Revogação de SAS: para inline SAS → rotacionar access key. Para policy-based SAS → deletar a Stored Access Policy.'
    },
    {
      question: 'O que habilitar para garantir que blobs de conformidade regulatória não possam ser deletados ou modificados por nenhum usuário, incluindo admins, por 7 anos?',
      options: [
        'Blob Soft Delete com retenção de 7 anos',
        'Azure Backup com RPO de 7 anos',
        'Imutabilidade de blob com Time-based Retention Policy de 7 anos (WORM)',
        'Azure Archive tier com lifecycle lock'
      ],
      correct: 2,
      explanation: 'Políticas de imutabilidade WORM (Write Once Read Many) com Time-based Retention garantem que blobs não possam ser modificados ou deletados durante o período de retenção — nem por administradores ou pela Microsoft. Usado para compliance regulatória (FINRA, SEC, CFTC). Soft Delete apenas protege contra deleção acidental (pode ser revertido).',
      reference: 'WORM = imutabilidade real para compliance. Soft Delete = proteção acidental reversível. São casos de uso diferentes.'
    }
  ],

  flashcards: [
    {
      front: 'Quais são os 3 tipos de Blob e seus casos de uso?',
      back: '1. **Block Blob** — Arquivos genéricos (imagens, vídeos, documentos, backups). Uploads eficientes de grandes arquivos. Suporta até 190.7 TiB.\n\n2. **Append Blob** — Dados append-only (logs, auditoria, streaming). Só adiciona ao final — não sobrescreve.\n\n3. **Page Blob** — Blocos de 512 bytes com acesso aleatório R/W. Usado exclusivamente para discos de VM (VHD files).'
    },
    {
      front: 'Como revogar um SAS token antes da expiração?',
      back: '**SAS inline** (assinado com Access Key):\n- Rotacionar a Access Key da Storage Account invalida todos os SAS assinados com ela\n- Impacto: todas as aplicações usando aquela key precisam ser atualizadas\n\n**SAS baseado em Stored Access Policy**:\n- Deletar a Stored Access Policy invalida apenas os SAS associados a ela\n- Sem impacto em outros SAS ou no acesso via key\n\nMelhor prática: sempre use Stored Access Policies para poder revogar granularmente.'
    },
    {
      front: 'O que é imutabilidade WORM no Azure Blob Storage?',
      back: '**WORM (Write Once, Read Many)** — blobs não podem ser modificados ou deletados durante o período de retenção:\n\n- **Time-based retention**: define período (ex: 7 anos). Nem admins podem deletar antes.\n- **Legal hold**: bloqueio indefinido até remoção explícita (para litígios)\n- Configurado por container\n- Suporte a compliance regulatória: SEC Rule 17a-4, CFTC, FINRA\n\nDiferente de Soft Delete: WORM é irreversível durante a retenção.'
    }
  ],

  lab: {
    scenario: 'Configure segurança avançada em um container Blob com Stored Access Policy e verifique acesso anônimo.',
    objective: 'Criar container, configurar Stored Access Policy, gerar SAS revogável e verificar acesso.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Criar Storage Account e container',
        instruction: 'Crie uma storage account e um container privado.',
        hints: ['Use sufixo único para o nome da storage account'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
SA_NAME="technovastorage\${SUFFIX}"
az group create --name rg-blob-lab --location eastus
az storage account create --name $SA_NAME --resource-group rg-blob-lab \\
  --sku Standard_LRS --kind StorageV2 --https-only true
az storage container create --name confidential \\
  --account-name $SA_NAME --public-access off --auth-mode login
echo "SA_NAME=$SA_NAME" > /tmp/bloblab.sh
\`\`\``,
        verify: `\`\`\`bash
source /tmp/bloblab.sh
az storage container show --name confidential --account-name $SA_NAME \\
  --auth-mode login --query "properties.publicAccess" -o tsv
# Saída esperada: off (ou vazio = privado)
\`\`\``
      },
      {
        title: 'Upload e Stored Access Policy',
        instruction: 'Faça upload de um arquivo e crie uma Stored Access Policy de leitura.',
        hints: ['\`az storage container policy create\`'],
        solution: `\`\`\`bash
source /tmp/bloblab.sh
echo "Dados confidenciais" > /tmp/secret.txt
az storage blob upload --container-name confidential \\
  --name secret.txt --file /tmp/secret.txt \\
  --account-name $SA_NAME --auth-mode login

az storage container policy create \\
  --container-name confidential \\
  --name readonly-30min \\
  --account-name $SA_NAME \\
  --permissions r \\
  --expiry $(date -u -d '30 minutes' '+%Y-%m-%dT%H:%MZ' 2>/dev/null || date -u -v+30M '+%Y-%m-%dT%H:%MZ') \\
  --auth-mode login
\`\`\``,
        verify: `\`\`\`bash
source /tmp/bloblab.sh
az storage container policy list --container-name confidential \\
  --account-name $SA_NAME --auth-mode login -o table
# Saída: readonly-30min com permissão 'r'
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-blob-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-blob-lab 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Blob acessível publicamente por engano',
      difficulty: 'easy',
      symptom: 'Auditoria de segurança encontrou blobs acessíveis sem autenticação via URL pública.',
      diagnosis: `\`\`\`bash
# Verificar se a storage account permite anonymous access
az storage account show --name mysa --resource-group myRG \\
  --query "allowBlobPublicAccess" -o tsv

# Listar containers com acesso público
az storage container list --account-name mysa --auth-mode login \\
  --query "[?properties.publicAccess!='off'].{Nome:name,Acesso:properties.publicAccess}" -o table
\`\`\``,
      solution: `**Solução imediata — desabilitar acesso anônimo no nível da conta:**
\`\`\`bash
az storage account update --name mysa --resource-group myRG \\
  --allow-blob-public-access false
\`\`\`

Esta configuração sobrepõe os containers individuais — mesmo que um container tenha public access habilitado, o acesso anônimo será bloqueado se desabilitado no nível da conta.

**Depois verificar e corrigir containers individuais:**
\`\`\`bash
az storage container set-permission --name mycontainer \\
  --account-name mysa --public-access off --auth-mode login
\`\`\``
    }
  ]
};
