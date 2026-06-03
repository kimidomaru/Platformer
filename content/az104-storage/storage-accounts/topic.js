window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-storage/storage-accounts'] = {
  theory: `# Azure Storage Accounts

## Relevância no Exame
> Peso estimado **15-20%** no AZ-104. Questões envolvem tipos de redundância, tiers de acesso, segurança e controle de acesso a storage.

## Conceitos Fundamentais

### O que é uma Storage Account?
Container único que agrupa todos os serviços de armazenamento Azure:
- **Blob Storage** — objetos/arquivos não estruturados
- **Azure Files** — compartilhamentos SMB/NFS gerenciados
- **Queue Storage** — mensagens para desacoplamento
- **Table Storage** — dados NoSQL chave-valor

### Tipos de Storage Account

| Tipo | Descrição | Uso |
|------|-----------|-----|
| **Standard General-purpose v2 (GPv2)** | Mais completo, suporta tudo | Maioria dos casos |
| **Premium Block Blobs** | SSD, alta performance para blobs | Workloads de alta I/O |
| **Premium File Shares** | SSD para Azure Files | File shares de alta performance |
| **Premium Page Blobs** | SSD para page blobs | Discos de VMs |
| **Azure Data Lake Storage Gen2** | Hierarchical namespace | Big Data e analytics |

### Redundância (Replication)

| Sigla | Nome | Cópias | Georedundante | Leitura na Secundária |
|-------|------|--------|--------------|----------------------|
| **LRS** | Locally Redundant | 3 (mesmo DC) | ❌ | ❌ |
| **ZRS** | Zone Redundant | 3 (zonas diferentes) | ❌ | ❌ |
| **GRS** | Geo-Redundant | 6 (3+3 outra região) | ✅ | ❌ |
| **GZRS** | Geo-Zone Redundant | 6 (ZRS+3 outra região) | ✅ | ❌ |
| **RA-GRS** | Read-Access Geo-Redundant | 6 | ✅ | ✅ |
| **RA-GZRS** | Read-Access Geo-Zone Redundant | 6 | ✅ | ✅ |

> **Para o exame**: RA-GRS e RA-GZRS são os únicos que permitem **leitura** na região secundária sem failover.

### Access Tiers (Camadas de Acesso) — apenas Blob

| Tier | Custo Armazenamento | Custo Acesso | Latência | Uso Ideal |
|------|--------------------|-----------|---------|-----------|
| **Hot** | Alto | Baixo | ms | Dados acessados frequentemente |
| **Cool** | Médio | Médio | ms | Dados acessados mensalmente |
| **Cold** | Baixo | Alto | ms | Dados acessados a cada 90+ dias |
| **Archive** | Muito baixo | Muito alto | horas | Backup/conformidade, raro acesso |

> **Archive**: o blob fica **offline** — para acessar, é necessário fazer **rehydration** (mover para Hot/Cool), o que leva horas.

### Segurança e Controle de Acesso

**Shared Access Signature (SAS)**: URL assinada com permissões e prazo de validade
- **Service SAS**: acesso a um serviço específico (blob, file, queue, table)
- **Account SAS**: acesso a múltiplos serviços
- **User Delegation SAS**: assinado com credenciais do Entra ID (mais seguro)

**Stored Access Policy**: define SAS reusável e que pode ser revogada sem alterar a URL base.

**Storage Firewall**: permite restringir acesso por IP ou Virtual Network (Service Endpoints/Private Endpoints)

**Chaves de Acesso (Access Keys)**: chaves primária e secundária que dão acesso total à conta. Devem ser rotacionadas regularmente ou gerenciadas via Key Vault.

**Soft Delete**: recuperar blobs/containers deletados por acidente (configurável de 1-365 dias)

**Versioning**: manter versões anteriores dos blobs automaticamente

### Lifecycle Management
Automatiza a movimentação entre tiers e deleção:
\`\`\`json
{
  "rules": [{
    "name": "move-to-cool",
    "type": "Lifecycle",
    "definition": {
      "actions": {
        "baseBlob": {
          "tierToCool": {"daysAfterModificationGreaterThan": 30},
          "tierToArchive": {"daysAfterModificationGreaterThan": 90},
          "delete": {"daysAfterModificationGreaterThan": 365}
        }
      },
      "filters": {"blobTypes": ["blockBlob"]}
    }
  }]
}
\`\`\`

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Criar Storage Account
az storage account create \\
  --name mystorageaccount \\
  --resource-group myRG \\
  --location eastus \\
  --sku Standard_GRS \\
  --kind StorageV2 \\
  --access-tier Hot \\
  --https-only true

# Listar Storage Accounts
az storage account list --resource-group myRG --output table

# Ver detalhes e configurações de replication
az storage account show \\
  --name mystorageaccount \\
  --resource-group myRG \\
  --query "{Nome:name,SKU:sku.name,Tier:accessTier,Https:enableHttpsTrafficOnly}" -o table

# Criar container blob
az storage container create \\
  --name mycontainer \\
  --account-name mystorageaccount \\
  --public-access off

# Upload de arquivo
az storage blob upload \\
  --account-name mystorageaccount \\
  --container-name mycontainer \\
  --name arquivo.txt \\
  --file ./arquivo.txt

# Gerar SAS token para um blob (válido por 1 hora)
az storage blob generate-sas \\
  --account-name mystorageaccount \\
  --container-name mycontainer \\
  --name arquivo.txt \\
  --permissions r \\
  --expiry $(date -u -d '1 hour' '+%Y-%m-%dT%H:%MZ') \\
  --output tsv

# Alterar tier de acesso de um blob
az storage blob set-tier \\
  --account-name mystorageaccount \\
  --container-name mycontainer \\
  --name arquivo.txt \\
  --tier Cool

# Criar regra de lifecycle management
az storage account management-policy create \\
  --account-name mystorageaccount \\
  --resource-group myRG \\
  --policy @lifecycle-policy.json

# Atualizar tipo de replicação
az storage account update \\
  --name mystorageaccount \\
  --resource-group myRG \\
  --sku Standard_RAGRS

# Habilitar soft delete para blobs
az storage blob service-properties delete-policy update \\
  --account-name mystorageaccount \\
  --enable true \\
  --days-retained 30
\`\`\`

## Erros Comuns

1. **Nome da storage account**: deve ser **globalmente único**, entre 3-24 caracteres, apenas letras minúsculas e números.
2. **Archive tier não pode ser o default account tier**: Archive só pode ser definido por blob individualmente.
3. **Alterar de LRS para ZRS**: exige migração ao vivo ou recriação — não é conversão instantânea.
4. **SAS expirado**: verificar sempre o campo \`se=\` (signedExpiry) na URL SAS.
5. **Acesso negado com chave**: verificar se "Allow storage account key access" está habilitado.

## Killer.sh Style Challenge

> **Cenário**: Você precisa criar uma solução de armazenamento que:
> 1. Mantenha dados críticos resilientes a falhas de zona e também em outra região, com leitura possível na região secundária
> 2. Blobs acessados raramente devem ser movidos automaticamente para Archive após 90 dias
> 3. Após 365 dias sem acesso, os blobs devem ser deletados
> 4. Blobs deletados acidentalmente devem ser recuperáveis por 14 dias
>
> **Qual SKU de redundância? Como configurar lifecycle e soft delete?**
>
> **Resposta**: SKU **Standard_RAGZRS** (RA-GZRS). Lifecycle policy: tierToArchive após 90 dias, delete após 365 dias. Habilitar blob soft delete com 14 dias de retenção.
`,

  quiz: [
    {
      question: 'Uma empresa precisa que seus dados Azure Blob sejam resilientes a falhas de datacenter completo em uma região E que a equipe possa fazer leitura dos dados na região secundária durante um desastre, sem precisar iniciar um failover. Qual SKU de redundância deve ser usado?',
      options: [
        'GRS (Geo-Redundant Storage)',
        'ZRS (Zone-Redundant Storage)',
        'RA-GRS (Read-Access Geo-Redundant Storage)',
        'LRS (Locally-Redundant Storage)'
      ],
      correct: 2,
      explanation: 'RA-GRS mantém 6 cópias (3 na região primária + 3 na secundária) E permite leitura na região secundária sem failover. GRS também replica para outra região mas não permite leitura na secundária sem iniciar failover. ZRS protege apenas contra falhas de zona na mesma região.',
      reference: 'Memorize: RA-GRS = GRS + leitura na secundária. RA-GZRS = GZRS + leitura na secundária.'
    },
    {
      question: 'Um blob no tier "Archive" precisa ser acessado urgentemente. Qual é o processo correto?',
      options: [
        'Clicar em "Download" no portal — blobs Archive são acessados instantaneamente',
        'Fazer rehydration para tier Hot ou Cool (pode levar horas) antes de poder acessar',
        'Deletar o blob e fazer re-upload em outro tier',
        'Criar uma SAS token especial para blobs Archive'
      ],
      correct: 1,
      explanation: 'Blobs no tier Archive ficam offline e não podem ser acessados diretamente. É necessário fazer rehydration (mover para Hot ou Cool) antes de acessar. A rehydration pode levar até 15 horas na prioridade padrão, ou menos com prioridade High (a custo adicional).',
      reference: 'Archive = offline storage. Sempre rehydrate primeiro. Considere o tempo de rehydration no design da solução.'
    },
    {
      question: 'Qual é a principal diferença entre uma Service SAS e uma User Delegation SAS?',
      options: [
        'Service SAS é para blobs; User Delegation SAS é para files',
        'User Delegation SAS é assinada com credenciais do Entra ID e não expõe as account keys; Service SAS usa as account keys',
        'Não há diferença de segurança, apenas de nomenclatura',
        'Service SAS dura mais tempo que User Delegation SAS'
      ],
      correct: 1,
      explanation: 'User Delegation SAS é criada usando credenciais do Entra ID (via OAuth), sem expor as storage account keys. É considerada mais segura pois: não revela as chaves mestras, pode ser revogada via Entra ID, e é auditada no Azure AD. Service SAS e Account SAS são assinadas com as account keys.',
      reference: 'Best practice: prefira User Delegation SAS sobre Service/Account SAS sempre que possível.'
    },
    {
      question: 'Uma organização quer garantir que blobs deletados acidentalmente possam ser recuperados por até 30 dias. Qual recurso habilitar?',
      options: [
        'Blob Versioning',
        'Blob Soft Delete',
        'Azure Backup for Storage',
        'Imutabilidade de Blob (WORM)'
      ],
      correct: 1,
      explanation: 'Blob Soft Delete mantém os blobs deletados por um período configurável (1-365 dias) antes da remoção permanente. Durante esse período, o blob pode ser restaurado. Versioning mantém versões anteriores mas o blob deletado também precisa de soft delete para ser recuperável.',
      reference: 'Soft delete = lixeira para blobs. Versioning = histórico de alterações. Ambos podem ser usados juntos.'
    },
    {
      question: 'Qual é a hierarquia correta de armazenamento no Azure Blob Storage?',
      options: [
        'Storage Account → Blob → Container',
        'Storage Account → Container → Blob',
        'Subscription → Storage Account → Blob',
        'Resource Group → Container → Blob'
      ],
      correct: 1,
      explanation: 'A hierarquia é: Storage Account (conta) → Container (similar a "pasta raiz") → Blob (arquivo/objeto). Um storage account pode ter milhões de containers, cada container pode ter bilhões de blobs.',
      reference: 'Analogia: Storage Account = HD externo, Container = pasta raiz, Blob = arquivo.'
    },
    {
      question: 'Você quer mover automaticamente blobs para o tier Cool após 30 dias sem modificação e deletá-los após 1 ano. Qual recurso do Azure Storage usar?',
      options: [
        'Azure Backup Policies',
        'Blob Versioning',
        'Lifecycle Management Policies',
        'Azure Policy com efeito Modify'
      ],
      correct: 2,
      explanation: 'Lifecycle Management Policies automatizam a movimentação entre tiers (Hot→Cool→Cold→Archive) e a deleção baseada em idade do blob (dias desde criação, última modificação ou último acesso). Configurado via regras JSON no storage account.',
      reference: 'Lifecycle = automação de tiering. Combine com Soft Delete para recuperação acidental e Archive para dados muito antigos.'
    },
    {
      question: 'Qual é a diferença entre ZRS e LRS em termos de proteção contra falhas?',
      options: [
        'LRS protege contra falhas de zona; ZRS protege contra falhas de datacenter',
        'LRS faz 3 cópias no mesmo datacenter; ZRS faz 3 cópias em zonas de disponibilidade diferentes na mesma região',
        'ZRS replica para outra região; LRS mantém tudo na mesma região',
        'Não há diferença prática, apenas de custo'
      ],
      correct: 1,
      explanation: 'LRS (Locally Redundant) faz 3 cópias dentro do mesmo datacenter — protege contra falhas de hardware mas não contra falha do datacenter inteiro. ZRS (Zone Redundant) faz 3 cópias em zonas de disponibilidade diferentes — protege contra falha de um datacenter inteiro na região. ZRS é mais resiliente e mais caro que LRS.',
      reference: 'LRS < ZRS < GRS < GZRS em nível de proteção (e custo).'
    }
  ],

  flashcards: [
    {
      front: 'Quais são os 6 tipos de redundância do Azure Storage e qual permite leitura na região secundária?',
      back: '| SKU | Proteção | Leitura Secundária |\n|-----|----------|--------------------|\n| **LRS** | Mesmo datacenter | ❌ |\n| **ZRS** | 3 zonas, mesma região | ❌ |\n| **GRS** | 2 regiões | ❌ |\n| **GZRS** | ZRS + outra região | ❌ |\n| **RA-GRS** | 2 regiões | ✅ |\n| **RA-GZRS** | GZRS + leitura secundária | ✅ |\n\nApenas **RA-GRS** e **RA-GZRS** permitem leitura na secundária sem failover.'
    },
    {
      front: 'Quais são os 4 access tiers do Blob Storage e suas características?',
      back: '| Tier | Custo Storage | Custo Acesso | Disponibilidade |\n|------|--------------|--------------|------------------|\n| **Hot** | Alto | Baixo | Imediato |\n| **Cool** | Médio | Médio | Imediato |\n| **Cold** | Baixo | Alto | Imediato |\n| **Archive** | Muito baixo | Muito alto | **Offline** (horas p/ rehydrate) |\n\nApenas Hot e Cool podem ser o tier padrão da conta.'
    },
    {
      front: 'O que é rehydration no contexto do Azure Blob Archive?',
      back: 'Processo de mover um blob do tier **Archive** (offline) para **Hot** ou **Cool** antes de poder acessá-lo.\n\nDuração: até **15 horas** na prioridade Standard, menos com prioridade High (custo adicional).\n\nFormas de rehydrate:\n1. Alterar tier: \`az storage blob set-tier --tier Cool\`\n2. Copiar o blob para outro container em tier Hot/Cool'
    },
    {
      front: 'Qual é a regra para nomes de Storage Account no Azure?',
      back: 'Nome deve ser:\n- **Globalmente único** em todo o Azure\n- Entre **3 e 24 caracteres**\n- Apenas **letras minúsculas e números** (sem hífens, underscores ou maiúsculas)\n\nExemplo válido: \`technovastorage2024\`\nInválidos: \`TechNova-Storage\`, \`my_storage\`, \`ab\` (muito curto)'
    },
    {
      front: 'Qual é a diferença entre Blob Versioning e Blob Soft Delete?',
      back: '**Soft Delete**: guarda blobs *deletados* por N dias (lixeira). Permite restaurar o estado antes da deleção.\n\n**Versioning**: guarda *versões anteriores* de blobs modificados automaticamente. Permite restaurar qualquer versão anterior de um blob ainda existente.\n\nUsados juntos: soft delete recupera o blob deletado (como versão anterior), versioning recupera o conteúdo antes de uma modificação.'
    },
    {
      front: 'Como funciona uma Lifecycle Management Policy no Azure Storage?',
      back: 'Define regras automáticas baseadas em **idade do blob**:\n\n``\`json\n{\n  "actions": {\n    "baseBlob": {\n      "tierToCool": {"daysAfterModificationGreaterThan": 30},\n      "tierToArchive": {"daysAfterModificationGreaterThan": 90},\n      "delete": {"daysAfterModificationGreaterThan": 365}\n    }\n  },\n  "filters": {"blobTypes": ["blockBlob"]}\n}\n\```\n\nTambém suporta: snapshots, versões, filtros por prefixo de nome.'
    }
  ],

  lab: {
    scenario: 'Configure uma solução de armazenamento para a TechNova com diferentes tiers, SAS tokens e verificação de redundância.',
    objective: 'Criar Storage Accounts com diferentes SKUs, gerenciar blobs, configurar tiers de acesso e gerar SAS tokens.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Criar Storage Account com GRS',
        instruction: `Crie uma Storage Account chamada \`technovastorage<sufixo-único>\` com redundância GRS (Geo-Redundant Storage) e tier padrão Hot.`,
        hints: [
          'Nome deve ser globalmente único — adicione um número aleatório',
          'SKU para GRS: \`Standard_GRS\`',
          'Use \`--kind StorageV2\` para General Purpose v2'
        ],
        solution: `\`\`\`bash
# Gerar sufixo único baseado no timestamp
SUFFIX=$(date +%s | tail -c 5)
SA_NAME="technovastorage\${SUFFIX}"
echo "Storage Account: $SA_NAME"

# Criar Resource Group
az group create --name rg-storage-lab --location eastus

# Criar Storage Account com GRS
az storage account create \\
  --name $SA_NAME \\
  --resource-group rg-storage-lab \\
  --location eastus \\
  --sku Standard_GRS \\
  --kind StorageV2 \\
  --access-tier Hot \\
  --https-only true \\
  --min-tls-version TLS1_2

echo "SA_NAME=$SA_NAME" > /tmp/lab-vars.sh
\`\`\``,
        verify: `\`\`\`bash
source /tmp/lab-vars.sh
az storage account show \\
  --name $SA_NAME \\
  --resource-group rg-storage-lab \\
  --query "{Nome:name,SKU:sku.name,Tier:accessTier,TLS:minimumTlsVersion}" -o table
# Saída esperada: Standard_GRS | Hot | TLS1_2
\`\`\``
      },
      {
        title: 'Criar container, fazer upload e alterar tier',
        instruction: `Crie um container chamado \`backups\`, faça upload de um arquivo de teste e altere o tier do blob para Cool.`,
        hints: [
          'Use \`az storage container create\` com \`--public-access off\`',
          'Para criar um arquivo de teste: \`echo "test content" > test.txt\`',
          '\`az storage blob set-tier\` para alterar o tier'
        ],
        solution: `\`\`\`bash
source /tmp/lab-vars.sh

# Obter connection string
CONN_STR=$(az storage account show-connection-string \\
  --name $SA_NAME --resource-group rg-storage-lab --query connectionString -o tsv)

# Criar container privado
az storage container create \\
  --name backups \\
  --connection-string "$CONN_STR" \\
  --public-access off

# Criar arquivo de teste
echo "Arquivo de backup de teste - $(date)" > /tmp/backup-test.txt

# Upload do arquivo
az storage blob upload \\
  --container-name backups \\
  --name "backup-2024.txt" \\
  --file /tmp/backup-test.txt \\
  --connection-string "$CONN_STR"

# Verificar tier atual (Hot por padrão)
az storage blob show \\
  --container-name backups \\
  --name "backup-2024.txt" \\
  --connection-string "$CONN_STR" \\
  --query "properties.blobTier" -o tsv

# Alterar para tier Cool
az storage blob set-tier \\
  --container-name backups \\
  --name "backup-2024.txt" \\
  --tier Cool \\
  --connection-string "$CONN_STR"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/lab-vars.sh
CONN_STR=$(az storage account show-connection-string \\
  --name $SA_NAME --resource-group rg-storage-lab --query connectionString -o tsv)

az storage blob show \\
  --container-name backups \\
  --name "backup-2024.txt" \\
  --connection-string "$CONN_STR" \\
  --query "properties.blobTier" -o tsv
# Saída esperada: Cool
\`\`\``
      },
      {
        title: 'Gerar SAS token com expiração',
        instruction: `Gere um SAS token de leitura para o blob \`backup-2024.txt\` com expiração de 2 horas. Teste o acesso via URL.`,
        hints: [
          '\`az storage blob generate-sas\` com \`--permissions r\`',
          'Combinar a URL base do blob com o SAS token',
          '\`az storage account show --query primaryEndpoints.blob\` para a URL base'
        ],
        solution: `\`\`\`bash
source /tmp/lab-vars.sh
CONN_STR=$(az storage account show-connection-string \\
  --name $SA_NAME --resource-group rg-storage-lab --query connectionString -o tsv)

# Gerar SAS token com validade de 2 horas
EXPIRY=$(date -u -d '2 hours' '+%Y-%m-%dT%H:%MZ' 2>/dev/null || date -u -v+2H '+%Y-%m-%dT%H:%MZ')
SAS_TOKEN=$(az storage blob generate-sas \\
  --container-name backups \\
  --name "backup-2024.txt" \\
  --permissions r \\
  --expiry "$EXPIRY" \\
  --connection-string "$CONN_STR" \\
  --output tsv)

# Construir URL completa
BLOB_URL="https://\${SA_NAME}.blob.core.windows.net/backups/backup-2024.txt?\${SAS_TOKEN}"
echo "SAS URL: $BLOB_URL"

# Testar acesso (deve retornar o conteúdo do arquivo)
curl -s "$BLOB_URL"
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o curl retornou conteúdo do arquivo
echo "Se o curl acima retornou 'Arquivo de backup de teste', o SAS token está funcionando"
# Esperado: "Arquivo de backup de teste - <data>"
\`\`\``
      },
      {
        title: 'Limpeza dos recursos',
        instruction: `Delete o Resource Group e todos os recursos criados.`,
        hints: ['\`az group delete --yes --no-wait\` para deleção assíncrona'],
        solution: `\`\`\`bash
az group delete --name rg-storage-lab --yes --no-wait
echo "Limpeza iniciada! RG será deletado em alguns minutos."
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-storage-lab --query "properties.provisioningState" -o tsv 2>/dev/null || echo "RG não encontrado — deletado com sucesso"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Erro 403 ao acessar blob via SAS token',
      difficulty: 'easy',
      symptom: 'Ao tentar acessar um blob via URL com SAS token, o usuário recebe "AuthenticationFailed: Signed expiry time... is less than current time".',
      diagnosis: `\`\`\`bash
# Verificar a URL SAS — o campo se= é o tempo de expiração
# URL exemplo: https://sa.blob.core.windows.net/container/blob?sv=...&se=2024-01-01T00%3A00Z&...
# Decodificar %3A = :
# se=2024-01-01T00:00Z significa expirou em 01/01/2024

# Para verificar hora atual em UTC
date -u
\`\`\``,
      solution: `**Causa**: SAS token expirado.

**Solução**: Gerar novo SAS token com data futura adequada:
\`\`\`bash
# Novo SAS com validade de 24 horas
EXPIRY=$(date -u -d '24 hours' '+%Y-%m-%dT%H:%MZ')
az storage blob generate-sas \\
  --account-name <sa-name> \\
  --container-name <container> \\
  --name <blob-name> \\
  --permissions r \\
  --expiry "$EXPIRY" \\
  --auth-mode login  # usa credenciais Entra ID (mais seguro)
\`\`\`

**Prevenção**: Para acesso permanente a blobs privados, considere usar Managed Identity + RBAC em vez de SAS tokens.`
    },
    {
      title: 'Blob Archive não pode ser lido imediatamente',
      difficulty: 'medium',
      symptom: 'Aplicação tenta ler um blob e recebe erro "BlobAccessTierNotSupported: This operation is not supported for a rehydration pending blob".',
      diagnosis: `\`\`\`bash
# Verificar tier e status de rehydration do blob
az storage blob show \\
  --account-name <sa-name> \\
  --container-name <container> \\
  --name <blob-name> \\
  --auth-mode login \\
  --query "{Tier:properties.blobTier,RehydrateStatus:properties.rehydrateStatus}" -o json
\`\`\``,
      solution: `**Causa**: O blob está no tier Archive (offline) ou em processo de rehydration.

**Solução — opção 1: Alterar tier (rehydration in-place)**:
\`\`\`bash
# Rehydrate com prioridade High (mais rápido, mais caro)
az storage blob set-tier \\
  --account-name <sa-name> \\
  --container-name <container> \\
  --name <blob-name> \\
  --tier Hot \\
  --rehydrate-priority High \\
  --auth-mode login
\`\`\`

**Solução — opção 2: Copy para novo blob em Hot**:
\`\`\`bash
az storage blob copy start \\
  --account-name <sa-name> \\
  --destination-container hot-container \\
  --destination-blob <blob-name> \\
  --source-uri "https://<sa>.blob.core.windows.net/<container>/<blob>"
\`\`\`

**Aguardar**: Prioridade Standard leva até 15 horas; High leva 1-3 horas.`
    }
  ]
};
