window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-identity/azure-rbac'] = {
  theory: `# Azure RBAC — Role-Based Access Control

## Relevância no Exame
> Aparece em **todos os domínios** do AZ-104. Saber conceder, revogar e verificar acessos corretamente é indispensável. Peso estimado: 10-15% das questões diretas, mas presente indiretamente em quase tudo.

## Conceitos Fundamentais

### O Modelo Azure RBAC
O Azure RBAC (Role-Based Access Control) controla **quem pode fazer o quê em quais recursos**. É baseado em três elementos:

\`\`\`
Security Principal → Role Definition → Scope
(QUEM)              (O QUÊ)           (ONDE)
\`\`\`

**Security Principal**: usuário, grupo, service principal ou managed identity que receberá a permissão.

**Role Definition (Função)**: conjunto de permissões. Define operações permitidas e negadas (actions/notActions/dataActions/notDataActions).

**Scope (Escopo)**: hierarquia onde a permissão se aplica:
\`\`\`
Management Group
  └─ Subscription
       └─ Resource Group
            └─ Resource
\`\`\`

> As permissões **herdam para baixo**: uma role atribuída no nível de Subscription se aplica a todos os Resource Groups e Recursos dentro dela.

### Funções Integradas (Built-in Roles)

| Role | Permissões |
|------|-----------|
| **Owner** | Controle total + pode gerenciar acesso de outros |
| **Contributor** | Controle total dos recursos, mas **NÃO** pode gerenciar acesso |
| **Reader** | Acesso somente leitura |
| **User Access Administrator** | Gerencia acesso de outros, mas não gerencia recursos |

Além dessas fundamentais, existem centenas de roles especializadas:
- **Storage Blob Data Contributor** — leitura/escrita em blobs
- **Key Vault Secrets User** — leitura de segredos do Key Vault
- **Monitoring Reader** — leitura de dados de monitoramento
- **AcrPull** — pull de imagens do Azure Container Registry
- etc.

### Diferença Owner vs User Access Administrator

| | Owner | User Access Administrator |
|-|-------|--------------------------|
| Gerenciar recursos | ✅ | ❌ |
| Atribuir roles a outros | ✅ | ✅ |

Use **User Access Administrator** quando alguém precisa gerenciar acessos sem ter controle dos recursos.

### Custom Roles
Quando as built-in roles não atendem, você pode criar **Custom Roles**:
- Definir exatamente quais \`actions\` e \`dataActions\` são permitidas
- Especificar \`notActions\` para excluir operações específicas
- Definir \`assignableScopes\` (subscriptions/management groups onde a role pode ser atribuída)

\`\`\`json
{
  "Name": "VM Operator",
  "Description": "Pode iniciar e parar VMs mas não criar ou deletar",
  "Actions": [
    "Microsoft.Compute/virtualMachines/start/action",
    "Microsoft.Compute/virtualMachines/deallocate/action",
    "Microsoft.Compute/virtualMachines/read"
  ],
  "NotActions": [],
  "DataActions": [],
  "NotDataActions": [],
  "AssignableScopes": [
    "/subscriptions/<subscription-id>"
  ]
}
\`\`\`

### Deny Assignments
- Por padrão, **sem permissão = acesso negado** (modelo "deny by default")
- Deny Assignments explicitamente bloqueiam ações mesmo que uma role permita
- Principalmente usados pelo Azure Blueprints e Managed Applications
- **Usuários comuns não criam Deny Assignments** — são criados automaticamente pelo sistema

### Verificando Acesso Efetivo
O **acesso efetivo** de um usuário é a **combinação de todas as role assignments** em todos os níveis da hierarquia menos qualquer deny assignment.

Para verificar: Portal → IAM do recurso → "Check access" → selecionar o usuário.

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Listar roles disponíveis
az role definition list --output table

# Buscar role específica
az role definition list --name "Contributor" --output json

# Listar todas as atribuições de uma subscription
az role assignment list --all --output table

# Atribuir role a um usuário em um Resource Group
az role assignment create \\
  --assignee user@contoso.com \\
  --role "Contributor" \\
  --resource-group MyResourceGroup

# Atribuir role a um grupo em uma subscription
az role assignment create \\
  --assignee-object-id <group-object-id> \\
  --assignee-principal-type Group \\
  --role "Reader" \\
  --scope /subscriptions/<subscription-id>

# Atribuir role a uma Managed Identity em um recurso
az role assignment create \\
  --assignee <managed-identity-client-id> \\
  --role "Storage Blob Data Reader" \\
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Storage/storageAccounts/<sa>

# Listar atribuições de um usuário específico
az role assignment list --assignee user@contoso.com --all --output table

# Remover atribuição de role
az role assignment delete \\
  --assignee user@contoso.com \\
  --role "Contributor" \\
  --resource-group MyResourceGroup

# Criar custom role a partir de arquivo JSON
az role definition create --role-definition @custom-role.json

# Listar custom roles
az role definition list --custom-role-only true --output table

# Verificar permissões efetivas de um usuário
az role assignment list --assignee user@contoso.com --all \\
  --query "[].{Role:roleDefinitionName,Scope:scope}" --output table
\`\`\`

## Exemplos de Atribuição

### Exemplo 1: Developer no Resource Group
\`\`\`bash
# Developer pode fazer tudo no RG de dev mas não gerenciar acesso
az role assignment create \\
  --assignee dev@contoso.com \\
  --role "Contributor" \\
  --resource-group rg-dev-environment
\`\`\`

### Exemplo 2: Pipeline CI/CD (Service Principal)
\`\`\`bash
# Service Principal do CI/CD pode deployar no RG de produção
SP_ID=$(az ad sp show --id "meu-pipeline-sp" --query appId -o tsv)
az role assignment create \\
  --assignee-object-id $SP_ID \\
  --assignee-principal-type ServicePrincipal \\
  --role "Contributor" \\
  --resource-group rg-production
\`\`\`

### Exemplo 3: VM com acesso ao Key Vault
\`\`\`bash
# Managed Identity da VM lê segredos do Key Vault
VM_IDENTITY=$(az vm identity show --name myVM --resource-group myRG \\
  --query principalId -o tsv)

az role assignment create \\
  --assignee-object-id $VM_IDENTITY \\
  --assignee-principal-type ServicePrincipal \\
  --role "Key Vault Secrets User" \\
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/<kv>
\`\`\`

## Erros Comuns

1. **Contributor não consegue atribuir roles**: Contributor não tem \`Microsoft.Authorization/roleAssignments/write\`. Precisa de Owner ou User Access Administrator.
2. **Atribuição não propaga imediatamente**: Pode levar alguns minutos para replicar globalmente no Azure AD.
3. **Scope errado**: Atribuir no nível de recurso específico quando deveria ser no Resource Group (ou vice-versa).
4. **Confundir roles clássicas (Classic Admin) com RBAC**: Account Administrator, Service Administrator e Co-Administrator são roles legadas. RBAC é o modelo moderno e deve ser usado.
5. **Custom role com AssignableScopes incorreto**: A role só aparece para atribuição nos escopos definidos em AssignableScopes.

## Killer.sh Style Challenge

> **Cenário**: Você precisa configurar o seguinte:
> 1. O time de DevOps (grupo no Entra ID) deve poder criar/modificar/deletar recursos em \`rg-production\` mas NÃO gerenciar acessos
> 2. O usuário \`audit@contoso.com\` deve poder ver **todos** os recursos da subscription, mas não modificar nada
> 3. A VM \`app-server\` precisa ler segredos do Key Vault \`kv-app-secrets\` sem usar credenciais hardcoded
>
> Configure o RBAC mínimo necessário para cada caso.
>
> **Resposta**:
> 1. DevOps Group → Role: **Contributor** → Scope: \`rg-production\`
> 2. audit@ → Role: **Reader** → Scope: subscription (herda para todos os RGs)
> 3. Habilitar System-Assigned Managed Identity na VM → atribuir **Key Vault Secrets User** ao Principal ID da VM no Key Vault
`,

  quiz: [
    {
      question: 'Qual built-in role permite que um usuário crie e gerencie todos os recursos Azure em uma subscription, mas NÃO permite atribuir roles a outros usuários?',
      options: [
        'Owner',
        'Contributor',
        'User Access Administrator',
        'Reader'
      ],
      correct: 1,
      explanation: 'Contributor tem controle total sobre recursos (criar, modificar, deletar) mas não pode gerenciar acesso (não tem Microsoft.Authorization/roleAssignments/write). Owner tem tudo que Contributor tem MAIS a capacidade de gerenciar acessos.',
      reference: 'Memorize: Owner = Contributor + gestão de acesso. Esta distinção cai muito no exame.'
    },
    {
      question: 'Um usuário tem "Contributor" na Subscription e "Reader" em um Resource Group específico dentro dessa Subscription. Qual é o acesso efetivo dele no Resource Group?',
      options: [
        'Reader — a role mais restritiva prevalece',
        'Contributor — a role mais permissiva prevalece (herança)',
        'Sem acesso — roles conflitantes se cancelam',
        'Depende da ordem em que foram atribuídas'
      ],
      correct: 1,
      explanation: 'No Azure RBAC, as permissões são ADITIVAS. O usuário tem Contributor herdado da Subscription (que inclui o RG) + Reader no RG. A combinação é Contributor (mais permissivo). Roles não se cancelam — elas se somam, exceto quando há um Deny Assignment.',
      reference: 'Regra de ouro: RBAC é aditivo (exceto Deny). Mais permissões = mais acesso, nunca menos.'
    },
    {
      question: 'Qual é a hierarquia de escopos no Azure RBAC, do mais amplo para o mais restrito?',
      options: [
        'Subscription → Management Group → Resource Group → Resource',
        'Management Group → Subscription → Resource Group → Resource',
        'Resource Group → Resource → Subscription → Management Group',
        'Management Group → Resource Group → Subscription → Resource'
      ],
      correct: 1,
      explanation: 'A hierarquia correta é: Management Group (mais amplo) → Subscription → Resource Group → Resource (mais restrito). Permissões atribuídas em níveis superiores herdam para todos os níveis inferiores.',
      reference: 'A hierarquia de escopos é fundamental para entender herança de permissões — revise o diagrama na teoria.'
    },
    {
      question: 'Um usuário precisa gerenciar quem tem acesso a recursos Azure em várias subscriptions, mas não precisa criar ou modificar os recursos em si. Qual role é mais adequada?',
      options: [
        'Owner na subscription',
        'Contributor na subscription',
        'User Access Administrator na subscription',
        'Global Administrator no Entra ID'
      ],
      correct: 2,
      explanation: 'User Access Administrator é exatamente para isso: gerenciar role assignments sem ter permissões de gerenciar os recursos. Owner também funcionaria, mas viola o princípio do menor privilégio pois daria controle total dos recursos.',
      reference: 'Princípio do menor privilégio: sempre escolha a role que dá apenas o que é necessário.'
    },
    {
      question: 'Você criou uma Custom Role mas ela não aparece como opção quando tenta atribuí-la a um usuário em um Resource Group. Qual é a causa mais provável?',
      options: [
        'Custom roles não podem ser atribuídas em Resource Groups, apenas em Subscriptions',
        'O campo AssignableScopes da custom role não inclui a subscription do Resource Group',
        'Você precisa esperar 24 horas para a custom role ficar disponível',
        'Custom roles só podem ser atribuídas pelo Global Administrator'
      ],
      correct: 1,
      explanation: 'Custom roles só aparecem para atribuição nos escopos definidos em AssignableScopes. Se o AssignableScopes contém apenas uma subscription específica, a role não aparecerá em subscriptions diferentes. Verifique e atualize o campo AssignableScopes para incluir o escopo necessário.',
      reference: 'Ao criar custom roles, sempre defina AssignableScopes abrangendo todas as subscriptions onde será usado.'
    },
    {
      question: 'Qual é a diferença entre Actions e DataActions em uma Role Definition do Azure RBAC?',
      options: [
        'Actions controlam recursos via API de controle (ARM); DataActions controlam operações sobre dados dentro dos recursos',
        'Actions são para permissões de leitura; DataActions são para permissões de escrita',
        'Actions são para usuários; DataActions são para service principals',
        'Não há diferença — são sinônimos na documentação'
      ],
      correct: 0,
      explanation: 'Actions (e notActions) controlam operações no plano de controle — criar, deletar, configurar recursos via ARM. DataActions (e notDataActions) controlam operações no plano de dados — ler/escrever blobs, segredos do Key Vault, mensagens do Service Bus, etc. Um Storage Contributor pode criar storage accounts (Actions) mas não ler blobs (DataActions) sem Storage Blob Data Contributor.',
      reference: 'Plano de controle (ARM) vs plano de dados: essencial para roles de storage e Key Vault.'
    },
    {
      question: 'Uma VM Azure precisa acessar um Azure Key Vault para ler secrets, sem armazenar credenciais no código. Qual é a abordagem correta?',
      options: [
        'Criar um Service Principal, armazenar o clientId/secret em variáveis de ambiente na VM',
        'Usar a conta de administrador da subscription para autenticar',
        'Habilitar Managed Identity na VM e atribuir a role "Key Vault Secrets User" no Key Vault',
        'Criar uma SAS Token do Key Vault e guardar no storage da VM'
      ],
      correct: 2,
      explanation: 'Managed Identity é a abordagem "zero credentials" recomendada: o Azure gerencia automaticamente o cycle de vida das credenciais. A VM autentica usando sua própria identidade (system-assigned ou user-assigned), e você concede a role necessária via RBAC no Key Vault. Nenhuma credencial é armazenada no código ou na VM.',
      reference: 'Padrão recomendado: Managed Identity + RBAC = sem segredos no código. Lembre: Key Vault Secrets User para leitura, Secrets Officer para gestão.'
    },
    {
      question: 'Ao atribuir uma role via \`az role assignment create\`, qual parâmetro especifica a subscription, Resource Group ou recurso específico onde a role se aplica?',
      options: [
        '--resource-group (único parâmetro disponível)',
        '--scope',
        '--location',
        '--target'
      ],
      correct: 1,
      explanation: '\`--scope\` aceita o ARM resource ID completo, podendo ser: \`/subscriptions/<id>\` para subscription, \`/subscriptions/<id>/resourceGroups/<rg>\` para RG, ou o resource ID completo para um recurso específico. O parâmetro \`--resource-group\` é um atalho que internamente expande para o scope do RG.',
      reference: 'Format do scope: sempre começa com /subscriptions/<sub-id>/ e pode incluir mais níveis.'
    }
  ],

  flashcards: [
    {
      front: 'Qual é a fórmula do Azure RBAC? Quais são os 3 componentes?',
      back: '**Security Principal** (quem) + **Role Definition** (o quê) + **Scope** (onde) = **Role Assignment**\n\n- Security Principal: user, group, service principal, managed identity\n- Role Definition: conjunto de Actions/NotActions/DataActions permitidos\n- Scope: management group → subscription → resource group → resource'
    },
    {
      front: 'Qual é a diferença entre Owner, Contributor e User Access Administrator?',
      back: '| Role | Gerencia Recursos | Gerencia Acesso |\n|------|-------------------|------------------|\n| **Owner** | ✅ | ✅ |\n| **Contributor** | ✅ | ❌ |\n| **Reader** | ❌ (somente leitura) | ❌ |\n| **User Access Admin** | ❌ | ✅ |'
    },
    {
      front: 'Como funcionam as permissões no Azure RBAC? São aditivas ou o mais restritivo prevalece?',
      back: 'As permissões são **ADITIVAS** — somam-se todas as role assignments em todos os escopos.\n\nExceção: **Deny Assignments** explicitamente bloqueiam ações mesmo com roles permissivas.\n\nNão existe "role mais restritiva prevalece" — sem deny, mais permissões = mais acesso.'
    },
    {
      front: 'O que são DataActions em uma Role Definition? Qual exemplo prático?',
      back: '**DataActions** controlam operações no **plano de dados** (dentro do recurso), não no plano de controle (ARM).\n\nExemplos:\n- \`Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read\` — ler blobs\n- \`Microsoft.KeyVault/vaults/secrets/getSecret/action\` — ler segredos\n\nRole "Storage Contributor" pode criar storage accounts (Actions) mas não ler blobs (DataActions) — requer "Storage Blob Data Contributor".'
    },
    {
      front: 'Quais os passos para criar e atribuir uma Custom Role no Azure?',
      back: '1. Criar arquivo JSON com: Name, Description, Actions, NotActions, DataActions, AssignableScopes\n2. \`az role definition create --role-definition @custom-role.json\`\n3. Atribuir: \`az role assignment create --assignee ... --role "Nome da Role" --scope ...\`\n\nLimite: máximo **5000 custom roles** por tenant.'
    },
    {
      front: 'Qual comando lista todas as role assignments de um usuário em todas as subscriptions?',
      back: '``\`bash\naz role assignment list \\\n  --assignee user@contoso.com \\\n  --all \\\n  --query "[].{Role:roleDefinitionName,Scope:scope}" \\\n  --output table\n\``\`\n\nSem \`--all`, só mostra a subscription atual.'
    },
    {
      front: 'O que é um Deny Assignment e quem pode criá-lo?',
      back: '**Deny Assignment** bloqueia explicitamente ações específicas para um security principal, mesmo que uma role permita.\n\nCaracterísticas:\n- Sobrepõe role assignments permissivas\n- Criados automaticamente por: Azure Blueprints, Managed Applications\n- **Usuários e administradores comuns NÃO podem criar** deny assignments diretamente\n- Podem ser visualizados via portal ou API mas não criados pelo usuário'
    }
  ],

  lab: {
    scenario: 'Configure controle de acesso granular para a startup TechNova: o time de DevOps precisa de acesso operacional, auditores precisam de somente leitura, e uma VM precisa acessar um Storage Account de forma segura.',
    objective: 'Criar e gerenciar Role Assignments no Azure RBAC em diferentes escopos, validar o princípio do menor privilégio e configurar Managed Identity para acesso sem credenciais.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Criar Resource Group e verificar permissões atuais',
        instruction: `Crie um Resource Group chamado \`rg-lab-rbac\` e verifique quais roles estão atribuídas na sua subscription atual.`,
        hints: [
          'Use \`az group create\` para o RG',
          '\`az role assignment list --all\` lista tudo na subscription'
        ],
        solution: `\`\`\`bash
# Criar Resource Group
az group create \\
  --name rg-lab-rbac \\
  --location eastus

# Verificar sua subscription atual
az account show --query "{Nome:name,ID:id,Tenant:tenantId}" -o table

# Ver todas as role assignments na subscription
az role assignment list --all \\
  --query "[].{Principal:principalName,Role:roleDefinitionName,Scope:scope}" \\
  -o table
\`\`\``,
        verify: `\`\`\`bash
# Verificar RG criado
az group show --name rg-lab-rbac --query "{Nome:name,Local:location,Estado:properties.provisioningState}" -o table
# Saída esperada:
# Nome          Local   Estado
# ------------  ------  ---------
# rg-lab-rbac   eastus  Succeeded
\`\`\``
      },
      {
        title: 'Atribuir roles em diferentes escopos',
        instruction: `Simule atribuições de roles seguindo o princípio do menor privilégio:
- Atribuir **Reader** na subscription para um grupo de auditoria
- Atribuir **Contributor** no Resource Group para um time de DevOps
- Observe que o grupo de auditoria herda Reader para o RG via herança`,
        hints: [
          'Para este lab use seu próprio usuário ou um grupo existente como assignee',
          'Use \`az account show --query id -o tsv\` para obter o ID da subscription',
          'Subscription scope: \`/subscriptions/<id>\`'
        ],
        solution: `\`\`\`bash
# Obter ID da subscription
SUB_ID=$(az account show --query id -o tsv)
echo "Subscription ID: $SUB_ID"

# Obter seu próprio Object ID (para teste)
MY_ID=$(az ad signed-in-user show --query id -o tsv)
echo "Meu Object ID: $MY_ID"

# Atribuir Reader na subscription (herda para todos os RGs)
# Nota: Em lab real, usar um grupo/usuário diferente
az role assignment create \\
  --assignee-object-id $MY_ID \\
  --assignee-principal-type User \\
  --role "Reader" \\
  --scope /subscriptions/$SUB_ID

# Verificar assignment criado
az role assignment list \\
  --assignee-object-id $MY_ID \\
  --scope /subscriptions/$SUB_ID \\
  --query "[].{Role:roleDefinitionName,Scope:scope}" -o table
\`\`\``,
        verify: `\`\`\`bash
# Verificar que Reader foi atribuído na subscription
SUB_ID=$(az account show --query id -o tsv)
MY_ID=$(az ad signed-in-user show --query id -o tsv)

az role assignment list \\
  --assignee-object-id $MY_ID \\
  --scope /subscriptions/$SUB_ID \\
  --query "[?roleDefinitionName=='Reader'].roleDefinitionName" -o tsv
# Saída esperada: Reader
\`\`\``
      },
      {
        title: 'Listar e verificar permissões efetivas',
        instruction: `Liste todas as role assignments do seu usuário em todos os escopos e verifique o acesso efetivo no Resource Group criado.`,
        hints: [
          '\`az role assignment list --assignee <id> --all\` mostra todos os escopos',
          'Use \`--include-inherited\` para ver assignments herdados'
        ],
        solution: `\`\`\`bash
MY_ID=$(az ad signed-in-user show --query id -o tsv)

# Listar TODAS as assignments do usuário (todos os escopos)
echo "=== Todas as Role Assignments ==="
az role assignment list --assignee-object-id $MY_ID --all \\
  --query "[].{Role:roleDefinitionName,Scope:scope}" -o table

# Ver assignments específicas para o RG (incluindo herdadas)
SUB_ID=$(az account show --query id -o tsv)
echo "=== Assignments no Resource Group (incluindo herdadas) ==="
az role assignment list \\
  --assignee-object-id $MY_ID \\
  --resource-group rg-lab-rbac \\
  --include-inherited \\
  --query "[].{Role:roleDefinitionName,Scope:scope,Inherited:roleAssignmentName}" -o table
\`\`\``,
        verify: `\`\`\`bash
MY_ID=$(az ad signed-in-user show --query id -o tsv)
# Deve aparecer Reader herdado da subscription no RG
az role assignment list \\
  --assignee-object-id $MY_ID \\
  --resource-group rg-lab-rbac \\
  --include-inherited \\
  --query "length([?roleDefinitionName=='Reader'])" -o tsv
# Saída esperada: 1 (ou mais, dependendo de outras assignments)
\`\`\``
      },
      {
        title: 'Remover assignments e limpar recursos',
        instruction: `Remova as role assignments criadas e delete o Resource Group.`,
        hints: [
          '\`az role assignment delete\` com os mesmos parâmetros do create',
          '\`az group delete --no-wait\` deleta o RG de forma assíncrona'
        ],
        solution: `\`\`\`bash
MY_ID=$(az ad signed-in-user show --query id -o tsv)
SUB_ID=$(az account show --query id -o tsv)

# Remover Reader da subscription
az role assignment delete \\
  --assignee-object-id $MY_ID \\
  --role "Reader" \\
  --scope /subscriptions/$SUB_ID

# Deletar Resource Group (e todos os recursos dentro)
az group delete --name rg-lab-rbac --yes --no-wait

echo "Limpeza iniciada!"
\`\`\``,
        verify: `\`\`\`bash
MY_ID=$(az ad signed-in-user show --query id -o tsv)
SUB_ID=$(az account show --query id -o tsv)

# Verificar Reader foi removido
az role assignment list \\
  --assignee-object-id $MY_ID \\
  --scope /subscriptions/$SUB_ID \\
  --query "[?roleDefinitionName=='Reader'].roleDefinitionName" -o tsv
# Saída esperada: (vazio)

# Verificar RG está sendo deletado
az group show --name rg-lab-rbac --query "properties.provisioningState" -o tsv 2>/dev/null || echo "RG deletado com sucesso"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Usuário recebe "AuthorizationFailed" ao tentar criar recurso',
      difficulty: 'easy',
      symptom: 'Um developer recebe erro "The client does not have authorization to perform action Microsoft.Compute/virtualMachines/write" ao tentar criar uma VM no portal Azure.',
      diagnosis: `\`\`\`bash
# Verificar quais roles o usuário tem
az role assignment list \\
  --assignee user@contoso.com \\
  --all \\
  --query "[].{Role:roleDefinitionName,Scope:scope}" -o table

# Verificar se o scope inclui o Resource Group onde está tentando criar
az group show --name <resource-group> --query id -o tsv
\`\`\``,
      solution: `**Causa**: O usuário não tem a role adequada no escopo correto.

**Soluções em ordem de investigação:**
1. Verificar se tem Contributor ou Owner no RG (ou subscription pai)
2. Se tem Reader apenas, atribuir Contributor no RG:
\`\`\`bash
az role assignment create \\
  --assignee user@contoso.com \\
  --role "Contributor" \\
  --resource-group <nome-do-rg>
\`\`\`
3. Aguardar alguns minutos para a permissão propagar
4. Pedir ao usuário para fazer logout e login novamente (tokens cacheados)`
    },
    {
      title: 'Service Principal não consegue fazer deploy mesmo com Contributor',
      difficulty: 'medium',
      symptom: 'Pipeline de CI/CD falha ao criar recursos. O Service Principal tem "Contributor" no Resource Group, mas recebe erros de autorização ao tentar registrar novos Resource Providers (ex: Microsoft.ContainerRegistry).',
      diagnosis: `\`\`\`bash
# Verificar role assignments do SP
SP_ID=$(az ad sp show --id <client-id> --query id -o tsv)
az role assignment list --assignee-object-id $SP_ID --all -o table

# Verificar resource providers registrados na subscription
az provider show --namespace Microsoft.ContainerRegistry \\
  --query "{Estado:registrationState}" -o table

# Contributor no RG NÃO pode registrar providers
# Isso requer permissão na subscription
az provider list --query "[?registrationState=='NotRegistered'].namespace" -o tsv | head -10
\`\`\``,
      solution: `**Causa**: Registrar Resource Providers requer permissão \`Microsoft.*/register/action\` na **Subscription**, não apenas no Resource Group. Contributor no RG não herda esse poder.

**Soluções:**
1. **Pré-registrar o provider** (recomendado): Um admin registra o provider uma vez na subscription:
\`\`\`bash
az provider register --namespace Microsoft.ContainerRegistry --wait
\`\`\`
2. **Atribuir Contributor na Subscription** ao SP (mais amplo, menos seguro)
3. **Criar Custom Role** com apenas \`Microsoft.ContainerRegistry/register/action\` na subscription + Contributor no RG (menor privilégio)

**Boas práticas**: Pré-registrar todos os providers necessários antes de dar acesso ao pipeline.`
    }
  ]
};
