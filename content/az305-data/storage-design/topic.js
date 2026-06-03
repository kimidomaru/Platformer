window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-data/storage-design'] = {
  theory: `# Design de Soluções de Storage (AZ-305)

## Relevância no Exame
> Peso estimado **15-20%** no AZ-305. O exame avalia a capacidade de escolher a solução de armazenamento correta para requisitos de performance, custo, compliance e padrões de acesso.

## Matriz de Decisão de Storage

\`\`\`
Dados estruturados (esquema rígido)?
  ├─ SIM + OLTP (transações) → Azure SQL Database / Managed Instance
  ├─ SIM + OLAP (analytics) → Azure Synapse Analytics
  └─ NÃO (schema flexível)?
       ├─ Documentos JSON → Cosmos DB (Core SQL ou MongoDB API)
       ├─ Chave-valor simples → Azure Table Storage / Cosmos DB Table API
       ├─ Grafos → Cosmos DB Gremlin API
       └─ Colunar (Cassandra-like) → Cosmos DB Cassandra API

Arquivos e objetos?
  ├─ Compartilhamentos SMB/NFS → Azure Files
  ├─ Objetos não estruturados (blobs) → Azure Blob Storage
  │    ├─ Acesso frequente → Hot tier
  │    ├─ Acesso mensal → Cool tier
  │    ├─ Acesso a cada 90+ dias → Cold tier
  │    └─ Arquivo/compliance → Archive tier
  ├─ Big data / analytics → Azure Data Lake Storage Gen2
  └─ Discos de VM → Azure Managed Disks (Premium SSD, Ultra Disk)
\`\`\`

## Azure Blob Storage — Design Avançado

### Padrão: Data Lake Architecture (Medallion)

\`\`\`
Camada Bronze (raw)        Camada Silver (curated)     Camada Gold (business)
  → dados brutos             → dados limpos               → agregações
  → formato original         → schema normalizado         → para BI/ML
  → WORM immutability        → delta format               → Synapse/Power BI

Storage Tier:  Cool/Archive   Cool                        Hot
\`\`\`

### Lifecycle Management Policy — Automação de Tier

\`\`\`json
{
  "rules": [
    {
      "name": "lifecycle-bronze",
      "type": "Lifecycle",
      "definition": {
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["bronze/"]
        },
        "actions": {
          "baseBlob": {
            "tierToCool": { "daysAfterModificationGreaterThan": 30 },
            "tierToArchive": { "daysAfterModificationGreaterThan": 90 },
            "delete": { "daysAfterModificationGreaterThan": 365 }
          }
        }
      }
    }
  ]
}
\`\`\`

### Imutabilidade WORM para Compliance

\`\`\`bash
# Configurar WORM time-based retention (compliance regulatória)
az storage container immutability-policy create \
  --account-name mysa \
  --container-name compliance-records \
  --period 2555      # 7 anos em dias
  --allow-protected-append-writes false

# Legal hold (bloqueio indefinido para litígios)
az storage container legal-hold set \
  --account-name mysa \
  --container-name legal-hold-bucket \
  --tags "case-2024-001"
\`\`\`

## Azure Managed Disks — Design para VMs

### Escolha do tipo de disco

| Tipo | IOPS Máx | Throughput | Latência | Caso de Uso |
|------|----------|------------|----------|-------------|
| Standard HDD | 2.000 | 500 MB/s | ms | Backup, arquivo |
| Standard SSD | 6.000 | 750 MB/s | < 10ms | Web, dev/test |
| Premium SSD | 20.000 | 900 MB/s | < 5ms | Produção, bancos de dados |
| Premium SSD v2 | 80.000 | 1.200 MB/s | < 1ms | I/O intensivo |
| Ultra Disk | 400.000 | 10 GB/s | < 1ms | SAP HANA, Oracle crítico |

### Padrão: Shared Disks para Clusters (SQL Always On)

\`\`\`bash
# Criar shared disk para SQL Server Always On
az disk create \
  --name sql-shared-disk \
  --resource-group myRG \
  --size-gb 512 \
  --sku Premium_LRS \
  --max-shares 2 \        # compartilhado entre 2 VMs
  --zone 1                # Availability Zone
\`\`\`

## Azure Data Lake Storage Gen2

ADLS Gen2 = Azure Blob Storage + Hierarchical Namespace (HNS):

**Funcionalidades extras com HNS habilitado:**
- Operações de diretório atômicas (rename, delete) — crucial para big data
- ACLs POSIX por arquivo/diretório (não apenas por container)
- Integração nativa com Azure Synapse Analytics, Databricks, HDInsight

\`\`\`bash
# Criar storage account com HNS (cria ADLS Gen2)
az storage account create \
  --name mydatalake \
  --resource-group myRG \
  --sku Standard_LRS \
  --kind StorageV2 \
  --enable-hierarchical-namespace true \
  --hierarchical-namespace true

# Criar estrutura de diretórios (diferente do Blob padrão)
az storage fs directory create \
  --account-name mydatalake \
  --file-system bronze \
  --name "2024/01/raw-events"
\`\`\`

## Erros Comuns de Design

1. **Blob Storage para dados relacionais**: Blob não tem query engine — use Cosmos DB ou SQL.
2. **Archive tier para dados com acesso frequente**: rehydration leva horas e custa caro.
3. **Hot tier para todos os dados**: dados raramente acessados no Hot tier desperdiçam budget.
4. **Premium SSD para todos os discos**: dev/test não precisa de Premium — Standard SSD é suficiente e mais barato.
5. **Sem lifecycle policy**: sem automação, dados crescem no tier mais caro indefinidamente.

## Killer.sh Style Challenge (AZ-305)

> **Cenário**: Um banco precisa armazenar:
> - Registros de transações (ultimos 7 anos, nunca deletáveis por compliance)
> - Relatórios PDF (acesso frequente, últimos 30 dias; acesso raro depois)
> - Dados brutos de eventos IoT (1 TB/dia, processados em 48h, deletados após 1 ano)
>
> **Projete a solução de storage.**
>
> **Resposta**: (1) Transações: Azure Blob + WORM time-based retention 7 anos (2555 dias) + immutability locked. (2) PDFs: Blob Hot nos primeiros 30 dias → lifecycle policy muda para Cool após 30 dias. (3) IoT: ADLS Gen2 (Bronze) + lifecycle: Cool após 2 dias, Archive após 30 dias, Delete após 365 dias. Formato Parquet para compressão eficiente.
`,

  quiz: [
    {
      question: 'Qual serviço Azure deve ser usado para armazenar grandes volumes de dados não estruturados que serão processados por Apache Spark e Azure Databricks?',
      options: [
        'Azure Blob Storage (sem HNS)',
        'Azure Data Lake Storage Gen2 (ADLS Gen2)',
        'Azure Table Storage',
        'Azure Queue Storage'
      ],
      correct: 1,
      explanation: 'ADLS Gen2 (Blob Storage com Hierarchical Namespace habilitado) é otimizado para big data analytics: suporta operações de diretório atômicas (rename/delete eficientes em Spark), ACLs POSIX granulares por arquivo, e é a camada de storage nativa para Azure Synapse Analytics, Databricks e HDInsight. O Blob padrão não tem HNS e operações de rename/delete são ineficientes para workloads Spark.',
      reference: 'Seção ADLS Gen2 — HNS (Hierarchical Namespace) é o diferencial crítico para analytics. Lembre: ADLS Gen2 = Blob + HNS.'
    },
    {
      question: 'Uma empresa de saúde precisa garantir que registros médicos digitais não possam ser deletados ou modificados por 10 anos, nem mesmo por administradores. Qual recurso do Azure Blob Storage usar?',
      options: [
        'Blob Soft Delete com 10 anos de retenção',
        'Resource Locks (ReadOnly) nos containers',
        'Imutabilidade WORM com Time-based Retention Policy de 10 anos',
        'Azure Backup com RPO de 10 anos'
      ],
      correct: 2,
      explanation: 'Políticas de imutabilidade WORM (Write Once Read Many) com Time-based Retention garantem que blobs não possam ser modificados ou deletados durante o período de retenção — nem por administradores globais, nem pela Microsoft. É o único mecanismo que atende compliance regulatória real (HIPAA, SEC, FINRA). Soft Delete é reversível; Resource Locks podem ser removidos por um admin.',
      reference: 'Seção Imutabilidade WORM — WORM bloqueado é irrevogável durante a retenção. Use para compliance regulatória apenas.'
    },
    {
      question: 'Qual é a diferença entre Premium SSD v2 e Ultra Disk em termos de caso de uso?',
      options: [
        'Não há diferença técnica — apenas de preço',
        'Premium SSD v2 oferece alta I/O com configuração flexível de IOPS; Ultra Disk oferece performance extrema (400K IOPS) para workloads críticos como SAP HANA',
        'Ultra Disk é para Linux; Premium SSD v2 é para Windows',
        'Premium SSD v2 requer Availability Zone; Ultra Disk não requer'
      ],
      correct: 1,
      explanation: 'Premium SSD v2 oferece IOPS e throughput ajustáveis independentemente do tamanho do disco, com latência < 1ms e custo menor que Ultra Disk. É ideal para bancos de dados de produção, SQL Server, etc. Ultra Disk oferece IOPS até 400.000 e throughput de 10 GB/s para os workloads mais extremos (SAP HANA, Oracle, SQL Server VLDB). O Ultra Disk tem restrições de região e VM size.',
      reference: 'Tabela de discos — memorize a hierarquia HDD < Standard SSD < Premium SSD < Premium SSD v2 < Ultra Disk.'
    },
    {
      question: 'Qual Lifecycle Management Policy move blobs do tier Hot para Archive após 90 dias sem acesso?',
      options: [
        'tierToArchive: { daysAfterModificationGreaterThan: 90 }',
        'tierToArchive: { daysAfterLastAccessTimeGreaterThan: 90 }',
        'Ambas as opções são válidas e equivalentes',
        'As Lifecycle Policies não suportam transição direta de Hot para Archive'
      ],
      correct: 2,
      explanation: 'Ambas as abordagens são válidas: daysAfterModificationGreaterThan move baseado na última modificação (padrão), enquanto daysAfterLastAccessTimeGreaterThan move baseado no último acesso (requer Last Access Time tracking habilitado na storage account). Para dados que são escritos uma vez e raramente acessados, modification-based é mais simples. Para dados com padrão de acesso variável, access-time-based é mais preciso.',
      reference: 'Seção Lifecycle Management — considere habilitar Last Access Time tracking para políticas baseadas em acesso real.'
    }
  ],

  flashcards: [
    {
      front: 'Qual serviço de storage Azure para cada tipo de dado?',
      back: '| Dado | Serviço |\n|------|---------|\n| Documentos JSON flexíveis | Cosmos DB (Core SQL) |\n| Chave-valor simples, baixo custo | Azure Table Storage |\n| Blobs/objetos não estruturados | Azure Blob Storage |\n| Big data + Spark/analytics | ADLS Gen2 (Blob + HNS) |\n| Compartilhamentos SMB/NFS | Azure Files |\n| Discos de VM OLTP | Premium SSD / Ultra Disk |\n| Data warehouse analítico | Azure Synapse Analytics |\n| Cache em memória | Azure Cache for Redis |'
    },
    {
      front: 'O que é ADLS Gen2 e como difere do Azure Blob Storage padrão?',
      back: '**ADLS Gen2** = Azure Blob Storage + **Hierarchical Namespace (HNS)**\n\n**Funcionalidades extras com HNS**:\n- Diretórios reais (não apenas prefixos de nome)\n- Rename/delete de diretório é atômico e O(1) — crítico para Spark\n- ACLs POSIX por arquivo/diretório\n- Compatível com Azure Synapse, Databricks, HDInsight\n\n**Criar**: `az storage account create --enable-hierarchical-namespace true`\n\n**Sem HNS**: rename de diretório = copiar todos os blobs + deletar originais (O(n)) — lento para petabytes.'
    }
  ],

  lab: {
    scenario: 'Configurar uma solução de armazenamento para dados de compliance (WORM) e implementar lifecycle management automático.',
    objective: 'Criar políticas de imutabilidade e lifecycle management para otimizar custo e garantir compliance.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Storage Account e configurar Lifecycle Policy',
        instruction: 'Crie uma storage account e configure lifecycle policy para mover blobs de Hot para Cool após 30 dias e Archive após 90 dias.',
        hints: ['az storage account management-policy create', 'Arquivo JSON de policy'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
SA_NAME="compliance\${SUFFIX}"
az group create --name rg-storage-design --location eastus

az storage account create \
  --name $SA_NAME \
  --resource-group rg-storage-design \
  --sku Standard_LRS \
  --kind StorageV2

az storage container create \
  --name logs --account-name $SA_NAME --auth-mode login
az storage container create \
  --name compliance --account-name $SA_NAME --auth-mode login

# Criar lifecycle policy
cat > /tmp/lifecycle.json << 'EOF'
{
  "rules": [{
    "name": "logs-tiering",
    "type": "Lifecycle",
    "definition": {
      "filters": {"blobTypes": ["blockBlob"], "prefixMatch": ["logs/"]},
      "actions": {
        "baseBlob": {
          "tierToCool": {"daysAfterModificationGreaterThan": 30},
          "tierToArchive": {"daysAfterModificationGreaterThan": 90},
          "delete": {"daysAfterModificationGreaterThan": 365}
        }
      }
    }
  }]
}
EOF

az storage account management-policy create \
  --account-name $SA_NAME \
  --resource-group rg-storage-design \
  --policy @/tmp/lifecycle.json

echo "SA_NAME=$SA_NAME" > /tmp/storagedesign.sh
\`\`\``,
        verify: `\`\`\`bash
source /tmp/storagedesign.sh
az storage account management-policy show \
  --account-name $SA_NAME \
  --resource-group rg-storage-design \
  --query "policy.rules[0].name" -o tsv
# Esperado: logs-tiering
\`\`\``
      },
      {
        title: 'Configurar WORM immutability no container de compliance',
        instruction: 'Configure uma política de imutabilidade time-based de 7 anos no container de compliance.',
        hints: ['az storage container immutability-policy create', 'Period em dias: 365*7=2555'],
        solution: `\`\`\`bash
source /tmp/storagedesign.sh

# Configurar imutabilidade (7 anos = 2555 dias)
az storage container immutability-policy create \
  --account-name $SA_NAME \
  --resource-group rg-storage-design \
  --container-name compliance \
  --period 2555

echo "Imutabilidade configurada: 7 anos (2555 dias)"
echo "NOTA: Em produção, execute lock para tornar irreversível"
echo "az storage container immutability-policy lock ... (IRREVERSÍVEL)"

# Verificar configuração
az storage container immutability-policy show \
  --account-name $SA_NAME \
  --resource-group rg-storage-design \
  --container-name compliance
\`\`\``,
        verify: `\`\`\`bash
source /tmp/storagedesign.sh
az storage container immutability-policy show \
  --account-name $SA_NAME \
  --resource-group rg-storage-design \
  --container-name compliance \
  --query "properties.immutabilityPeriodSinceCreationInDays" -o tsv
# Esperado: 2555

az group delete --name rg-storage-design --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Lifecycle Policy não movendo blobs para Archive como esperado',
      difficulty: 'medium',
      symptom: 'Blobs com mais de 90 dias ainda aparecem no tier Hot/Cool em vez de Archive após configurar uma Lifecycle Management Policy.',
      diagnosis: `\`\`\`bash
# Verificar se a policy existe e está correta
az storage account management-policy show \
  --account-name mysa --resource-group myRG \
  --query "policy.rules[].{Nome:name,Prefixo:definition.filters.prefixMatch,Acao:definition.actions.baseBlob}" -o json

# Verificar tier atual dos blobs
az storage blob list --container-name mycontainer \
  --account-name mysa --auth-mode login \
  --query "[].{Nome:name,Tier:properties.blobTier,Modified:properties.lastModified}" -o table
\`\`\``,
      solution: `**Causas comuns**:

1. **Avaliação não ocorreu ainda**: lifecycle policies são avaliadas uma vez por dia (geralmente durante a noite). Aguardar 24-48h.

2. **Prefixo incorreto na policy**: se a policy tem \`prefixMatch: ["logs/"]\` mas os blobs estão em \`"log/"\` (sem s), não são afetados.

3. **Blob type errado**: policies com \`blobTypes: ["blockBlob"]\` não afetam appendBlobs ou pageBlobs.

4. **Blob em estado imutável**: blobs em containers com WORM ativo não podem ser movidos de tier.

5. **Access tier tracking não habilitado**: se a policy usa \`daysAfterLastAccessTimeGreaterThan\`, o tracking precisa estar habilitado na storage account.

\`\`\`bash
# Habilitar last access time tracking
az storage account blob-service-properties update \
  --account-name mysa --resource-group myRG \
  --enable-last-access-tracking true
\`\`\``
    }
  ]
};
