window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-identity/azure-policy'] = {
  theory: `# Azure Policy & Management Groups

## Relevância no Exame
> Peso estimado **10-15%** no AZ-104. Questões envolvem criar políticas para impor compliance, organizar recursos com Management Groups e aplicar tags de forma automatizada.

## Conceitos Fundamentais

### Management Groups
Contêiner que organiza **múltiplas subscriptions**:
\`\`\`
Root Management Group (raiz do tenant)
  ├─ MG-Corp
  │    ├─ Subscription Prod
  │    └─ Subscription Staging
  └─ MG-Dev
       └─ Subscription Dev
\`\`\`
- Suporte a até **6 níveis** de hierarquia (excluindo a raiz)
- Políticas e RBAC atribuídos em Management Group **herdam** para todas as subscriptions filhas
- Cada tenant tem um Root Management Group automático

### Azure Policy
Serviço que **impõe** ou **audita** regras sobre recursos Azure:
- Garante compliance organizacional (ex: "toda VM deve ter tag de custo")
- Previne criação de recursos não conformes
- Pode **remediar** recursos já existentes não conformes

### Componentes do Azure Policy

**Policy Definition**: a regra em si. Composta por:
- **if** (condição): quando a política se aplica
- **then** (efeito): o que acontece

**Policy Initiative (Policy Set)**: coleção de políticas agrupadas para um objetivo comum (ex: CIS Benchmark, PCI-DSS)

**Policy Assignment**: aplicação de uma policy/initiative a um escopo específico

### Efeitos (Effects)

| Efeito | Quando Usar | Comportamento |
|--------|-------------|---------------|
| **Deny** | Prevenir criação/modificação | Bloqueia a operação |
| **Audit** | Monitorar sem bloquear | Registra não-conformidade |
| **AuditIfNotExists** | Verificar recurso relacionado | Alerta se recurso auxiliar não existe |
| **DeployIfNotExists** | Auto-remediar na criação | Deploya recurso relacionado automaticamente |
| **Append** | Adicionar propriedades | Adiciona campos ao recurso |
| **Modify** | Alterar tags/propriedades | Modifica propriedades durante criação/update |
| **Disabled** | Desabilitar temporariamente | Policy não avaliada |

> **Importante no exame**: Deny bloqueia novos recursos; Audit não bloqueia nada; DeployIfNotExists é usado para auto-remediation.

### Exemption vs Exclusion
- **Exclusion**: exclude um escopo da policy permanentemente (no assignment)
- **Exemption**: exclui temporariamente um recurso/escopo com data de validade e justificativa (requer \`Microsoft.Authorization/policyExemptions/write\`)

### Compliance State
- **Compliant**: recurso atende à política
- **Non-compliant**: recurso viola a política
- **Exempt**: excluído da avaliação
- **Conflicting**: recurso contradiz múltiplas policies

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Listar policy definitions disponíveis
az policy definition list --output table | head -20

# Buscar policy por palavra-chave
az policy definition list --query "[?contains(displayName,'tag')].[displayName,name]" -o table

# Ver detalhes de uma policy built-in
az policy definition show --name "1e30110a-5ceb-460c-a204-c1c3969c6d62"

# Criar policy definition customizada
az policy definition create \\
  --name "require-costcenter-tag" \\
  --display-name "Exigir tag CostCenter em Resource Groups" \\
  --description "Todos os RGs devem ter a tag CostCenter" \\
  --rules '{
    "if": {
      "allOf": [
        {"field": "type", "equals": "Microsoft.Resources/subscriptions/resourceGroups"},
        {"field": "tags[CostCenter]", "exists": "false"}
      ]
    },
    "then": {"effect": "deny"}
  }' \\
  --mode All

# Atribuir policy a um Resource Group
az policy assignment create \\
  --name "enforce-costcenter-rg" \\
  --display-name "Enforce CostCenter Tag in RG" \\
  --policy "require-costcenter-tag" \\
  --scope /subscriptions/<sub-id>/resourceGroups/<rg>

# Atribuir policy com parâmetros
az policy assignment create \\
  --name "allowed-locations" \\
  --display-name "Allowed Locations" \\
  --policy "e56962a6-4747-49cd-b67b-bf8b01975c4f" \\
  --params '{"listOfAllowedLocations": {"value": ["eastus", "westeurope"]}}' \\
  --scope /subscriptions/<sub-id>

# Verificar compliance
az policy state list \\
  --resource-group myRG \\
  --filter "complianceState eq 'NonCompliant'" \\
  --query "[].{Recurso:resourceId,Policy:policyDefinitionName}" -o table

# Listar Management Groups
az account management-group list --output table

# Criar Management Group
az account management-group create \\
  --name "MG-Production" \\
  --display-name "Production Workloads"

# Mover subscription para Management Group
az account management-group subscription add \\
  --name "MG-Production" \\
  --subscription <subscription-id>
\`\`\`

## Exemplo de Policy Customizada

### Exigir Tag em Recursos
\`\`\`json
{
  "mode": "Indexed",
  "policyRule": {
    "if": {
      "field": "tags[Environment]",
      "exists": "false"
    },
    "then": {
      "effect": "deny"
    }
  },
  "parameters": {}
}
\`\`\`

### Herdar Tag do Resource Group (Modify)
\`\`\`json
{
  "mode": "Indexed",
  "policyRule": {
    "if": {
      "allOf": [
        {"field": "tags[CostCenter]", "exists": "false"},
        {"value": "[resourceGroup().tags['CostCenter']]", "exists": "true"}
      ]
    },
    "then": {
      "effect": "modify",
      "details": {
        "roleDefinitionIds": [
          "/providers/microsoft.authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c"
        ],
        "operations": [{
          "operation": "add",
          "field": "tags[CostCenter]",
          "value": "[resourceGroup().tags['CostCenter']]"
        }]
      }
    }
  }
}
\`\`\`

## Erros Comuns

1. **Policy não avalia recursos existentes imediatamente**: Pode levar até 30 minutos para a avaliação inicial.
2. **DeployIfNotExists sem Managed Identity**: Este efeito requer uma Managed Identity no assignment para executar as remediações.
3. **Confundir Audit com Deny**: Audit registra não-conformidade, não bloqueia. Deny bloqueia.
4. **Scope de assignment muito restrito**: Policy atribuída no RG não afeta outros RGs da mesma subscription.
5. **Mode: All vs Indexed**: "All" avalia todos os tipos de recursos (incluindo RGs); "Indexed" avalia apenas recursos que suportam tags e location.

## Killer.sh Style Challenge

> **Cenário**: A empresa exige:
> 1. Todos os recursos novos devem ser criados apenas em "East US" ou "West Europe"
> 2. Todo Resource Group deve ter obrigatoriamente a tag "CostCenter"
> 3. Se um RG não tem a tag "Environment", a tag deve ser herdada automaticamente da subscription
> 4. Todos os requisitos devem se aplicar a 3 subscriptions diferentes de forma centralizada
>
> **Descreva a solução com Azure Policy e Management Groups.**
>
> **Resposta**: Criar Management Group pai das 3 subscriptions → Criar 3 policy definitions (Deny para locations, Deny para CostCenter, Modify para herdar Environment) → Agrupar nas 3 como Policy Initiative → Atribuir a Initiative no Management Group (herda para as 3 subs). Para Modify, criar Managed Identity com permissão de Contributor nas subs.
`,

  quiz: [
    {
      question: 'Qual efeito de Azure Policy deve ser usado para BLOQUEAR a criação de recursos que violam uma regra?',
      options: [
        'Audit',
        'Deny',
        'AuditIfNotExists',
        'DeployIfNotExists'
      ],
      correct: 1,
      explanation: 'Deny bloqueia completamente a operação que viola a política, retornando um erro para o usuário. Audit apenas registra a não-conformidade sem bloquear. AuditIfNotExists audita se um recurso relacionado não existe. DeployIfNotExists é para remediação automática.',
      reference: 'Memorize os 4 principais efeitos: Deny (bloqueia), Audit (registra), DeployIfNotExists (auto-deploy), Modify (altera tags/props).'
    },
    {
      question: 'Uma empresa quer garantir que todas as novas VMs tenham automaticamente uma tag "CostCenter" herdada do Resource Group, sem bloquear a criação. Qual efeito usar?',
      options: [
        'Deny',
        'Append',
        'Modify',
        'AuditIfNotExists'
      ],
      correct: 2,
      explanation: 'Modify altera propriedades (incluindo tags) de recursos durante criação ou update sem bloquear a operação. É o efeito correto para herança automática de tags. Append apenas adiciona campos mas não modifica existentes. Deny bloquearia a criação.',
      reference: 'Modify vs Append: Modify pode alterar valores existentes; Append só adiciona (não sobrescreve).'
    },
    {
      question: 'Qual é a hierarquia correta de Management Groups no Azure?',
      options: [
        'Subscription → Management Group → Resource Group → Resource',
        'Root Management Group → Management Groups → Subscriptions → Resource Groups',
        'Tenant → Subscription → Management Group → Resource Group',
        'Management Group → Resource Group → Subscription → Resource'
      ],
      correct: 1,
      explanation: 'A hierarquia correta é: Root Management Group (automático por tenant) → Management Groups (até 6 níveis) → Subscriptions → Resource Groups → Resources. Management Groups organizam subscriptions, não resource groups diretamente.',
      reference: 'Management Groups são para governance multi-subscription — políticas e RBAC atribuídos aqui herdam para todas as subscriptions filhas.'
    },
    {
      question: 'Uma Azure Policy com efeito "DeployIfNotExists" está configurada para criar um Log Analytics Workspace automaticamente quando uma VM é criada sem um. O que é obrigatório no Policy Assignment para isso funcionar?',
      options: [
        'Uma Custom Role com permissões de escrita',
        'Uma Managed Identity atribuída ao assignment da policy',
        'Uma aprovação manual do administrador global',
        'Uma Policy Initiative com pelo menos 3 policies'
      ],
      correct: 1,
      explanation: 'Efeitos que modificam recursos (DeployIfNotExists e Modify) precisam de uma Managed Identity atribuída ao policy assignment para executar as operações. Essa identidade precisa ter as permissões adequadas (normalmente Contributor) no escopo.',
      reference: 'DeployIfNotExists e Modify = sempre requerem Managed Identity no assignment para remediação.'
    },
    {
      question: 'Qual é a diferença entre uma Policy Definition e uma Policy Initiative?',
      options: [
        'Policy Definition é para auditoria; Policy Initiative é para deny',
        'Policy Definition é uma regra única; Policy Initiative é um conjunto de múltiplas Policy Definitions agrupadas',
        'Policy Definition é aplicada por usuário; Policy Initiative é aplicada por recurso',
        'Não há diferença, são sinônimos'
      ],
      correct: 1,
      explanation: 'Policy Definition é uma regra única (uma condição e um efeito). Policy Initiative (Policy Set) é uma coleção de múltiplas Policy Definitions agrupadas para um objetivo comum. Por exemplo, a initiative "CIS Microsoft Azure Foundations Benchmark" contém dezenas de policies individuais.',
      reference: 'Use initiatives para aplicar múltiplas políticas de uma vez — ex: padrões de compliance como NIST, PCI-DSS, ISO 27001.'
    },
    {
      question: 'Você atribuiu uma Azure Policy com efeito "Deny" em um Resource Group. Um recurso existente no RG viola a política. O que acontece?',
      options: [
        'O recurso é automaticamente deletado',
        'O recurso é marcado como "Non-compliant" mas não é alterado',
        'O recurso é bloqueado e ninguém pode acessá-lo',
        'O recurso é automaticamente corrigido pelo Azure'
      ],
      correct: 1,
      explanation: 'Policies com efeito Deny afetam apenas operações novas (criar/atualizar). Recursos EXISTENTES que violam a política ficam marcados como "Non-compliant" no painel de compliance, mas não são alterados nem removidos. Para remediar recursos existentes, use DeployIfNotExists ou Modify com tarefas de remediação.',
      reference: 'Deny não é retroativo. Para remediar existentes: DeployIfNotExists + Remediation Task ou scripts manuais.'
    },
    {
      question: 'Uma organização tem 5 subscriptions e quer aplicar as mesmas políticas de compliance em todas. Qual abordagem é mais eficiente?',
      options: [
        'Atribuir as policies individualmente em cada subscription',
        'Criar Management Groups e atribuir as policies no Management Group pai',
        'Criar uma subscription master e fazer link das demais',
        'Usar Azure Blueprints em vez de Azure Policy'
      ],
      correct: 1,
      explanation: 'Atribuir policies em Management Groups é a abordagem correta para gestão centralizada de múltiplas subscriptions. A policy herda automaticamente para todas as subscriptions filhas. Atribuir individualmente em cada subscription é manual e propenso a inconsistências.',
      reference: 'Management Groups = governance em escala. Uma atribuição no MG pai vale para todas as subscriptions filhas.'
    }
  ],

  flashcards: [
    {
      front: 'Quais são os 5 principais efeitos de Azure Policy e quando usar cada um?',
      back: '1. **Deny** — bloqueia criação/modificação de recursos não conformes\n2. **Audit** — registra não-conformidade sem bloquear (visibilidade)\n3. **DeployIfNotExists** — deploya recurso relacionado automaticamente na criação\n4. **Modify** — adiciona/altera tags e propriedades durante criação/update\n5. **AuditIfNotExists** — audita se um recurso relacionado (como diagnósticos) não existe\n\nDeny e Modify/DeployIfNotExists que fazem mudanças requerem Managed Identity.'
    },
    {
      front: 'O que é uma Policy Initiative (Policy Set)?',
      back: 'Coleção de múltiplas **Policy Definitions** agrupadas para um objetivo de compliance comum.\n\nExemplos: CIS Benchmark, PCI-DSS, NIST SP 800-53, ISO 27001\n\nVantagem: atribuir uma initiative = atribuir todas as policies dentro dela de uma vez. Permite aplicar frameworks de compliance completos com um assignment.'
    },
    {
      front: 'Qual é a diferença entre Exclusion e Exemption no Azure Policy?',
      back: '**Exclusion** (no policy assignment):\n- Permanente\n- Exclui um escopo inteiro da avaliação\n- Configurado no momento do assignment\n\n**Exemption** (recurso separado):\n- Temporária (com data de validade)\n- Requer justificativa (categoria: Waiver ou Mitigated)\n- Recurso específico excluído mesmo dentro de um escopo com policy\n- Requer permissão \`Microsoft.Authorization/policyExemptions/write\`'
    },
    {
      front: 'Qual Mode usar em Policy Definitions? "All" vs "Indexed"',
      back: '**mode: "All"** — avalia todos os tipos de recursos, incluindo Resource Groups e Subscriptions. Use quando a policy se aplica a RGs.\n\n**mode: "Indexed"** — avalia apenas recursos que suportam tags e location (VMs, Storage, etc.). Ignora RGs e recursos sem essas propriedades.\n\nRegra: se a condição usa \`tags\` ou \`location\` em recursos (não RGs), use "Indexed". Se envolve RGs, use "All".'
    },
    {
      front: 'Como funciona a herança em Management Groups?',
      back: 'Policies e RBAC atribuídos em um **Management Group herdam para baixo** na hierarquia:\n\n``\`\nMG-Corp (policy Deny non-EU locations)\n  └─ Subscription-Prod ← herda a policy\n       └─ RG-Backend ← herda a policy\n            └─ VM-App ← herda a policy\n\```\n\nUma atribuição no MG-Corp afeta TODAS as subscriptions, RGs e recursos abaixo dele. Limite: 6 níveis de MGs abaixo do Root.'
    },
    {
      front: 'Uma policy "Deny" afeta recursos existentes que já violam a regra?',
      back: '**Não.** Efeito **Deny** é prospectivo — afeta apenas novas criações e atualizações.\n\nRecursos existentes não conformes ficam marcados como **Non-Compliant** no painel de compliance, mas não são removidos ou bloqueados.\n\nPara remediar existentes: usar **DeployIfNotExists** ou **Modify** + criar uma **Remediation Task** no portal.'
    }
  ],

  lab: {
    scenario: 'A empresa TechNova precisa garantir que todos os recursos Azure sigam as políticas de governança: apenas localizações aprovadas, tags obrigatórias e visibilidade de compliance.',
    objective: 'Criar e atribuir Azure Policies customizadas e built-in, verificar compliance e criar Management Groups para organização.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Resource Group e explorar policies built-in',
        instruction: `Crie o RG \`rg-policy-lab\` e explore as policies built-in do Azure relacionadas a tags e locations.`,
        hints: [
          '\`az policy definition list\` com filtros OData para encontrar policies',
          'A policy "Require a tag on resource groups" tem ID built-in para inspecionar'
        ],
        solution: `\`\`\`bash
az group create --name rg-policy-lab --location eastus

# Listar policies relacionadas a tags
az policy definition list \\
  --query "[?contains(displayName,'tag') && policyType=='BuiltIn'].{Name:displayName,ID:name}" \\
  -o table | head -10

# Listar policies de location
az policy definition list \\
  --query "[?contains(displayName,'location') && policyType=='BuiltIn'].{Name:displayName,ID:name}" \\
  -o table | head -10

# Ver detalhes da policy "Allowed locations"
az policy definition show \\
  --name "e56962a6-4747-49cd-b67b-bf8b01975c4f" \\
  --query "{Nome:displayName,Efeito:policyRule.then.effect,Parametros:parameters}" \\
  -o json
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-policy-lab --query "properties.provisioningState" -o tsv
# Saída esperada: Succeeded
\`\`\``
      },
      {
        title: 'Criar policy customizada para exigir tag CostCenter',
        instruction: `Crie uma policy definition customizada que exige a tag \`CostCenter\` em todos os Resource Groups e a atribua à subscription atual em modo **Audit** (não bloquear, apenas registrar).`,
        hints: [
          'Salve o JSON da policy rule em um arquivo temporário',
          'Use efeito "Audit" para não bloquear recursos existentes',
          'A policy deve ter \`"mode": "All"\` para avaliar RGs'
        ],
        solution: `\`\`\`bash
# Criar o arquivo de regra da policy
cat > /tmp/require-costcenter-rule.json << 'EOF'
{
  "mode": "All",
  "policyRule": {
    "if": {
      "allOf": [
        {
          "field": "type",
          "equals": "Microsoft.Resources/subscriptions/resourceGroups"
        },
        {
          "field": "tags[CostCenter]",
          "exists": "false"
        }
      ]
    },
    "then": {
      "effect": "Audit"
    }
  },
  "parameters": {}
}
EOF

# Criar a policy definition
az policy definition create \\
  --name "audit-require-costcenter-rg" \\
  --display-name "[TechNova] Audit: RGs devem ter tag CostCenter" \\
  --description "Audita Resource Groups sem a tag CostCenter" \\
  --rules /tmp/require-costcenter-rule.json \\
  --mode All

# Obter subscription ID e atribuir a policy
SUB_ID=$(az account show --query id -o tsv)
az policy assignment create \\
  --name "audit-costcenter-sub" \\
  --display-name "[TechNova] Audit CostCenter em RGs" \\
  --policy "audit-require-costcenter-rg" \\
  --scope /subscriptions/$SUB_ID
\`\`\``,
        verify: `\`\`\`bash
# Verificar policy definition criada
az policy definition show --name "audit-require-costcenter-rg" \\
  --query "{Nome:displayName,Efeito:policyRule.then.effect}" -o table
# Saída esperada: [TechNova] Audit: RGs devem ter tag CostCenter | Audit

# Verificar assignment criado
az policy assignment show --name "audit-costcenter-sub" \\
  --scope /subscriptions/$(az account show --query id -o tsv) \\
  --query "{Nome:displayName,Scope:scope}" -o table
\`\`\``
      },
      {
        title: 'Verificar compliance e limpar recursos',
        instruction: `Aguarde a avaliação de compliance e verifique quais RGs estão não-conformes (sem tag CostCenter). Depois remova a policy e o RG de lab.`,
        hints: [
          '\`az policy state list\` mostra o estado de compliance',
          'A avaliação inicial pode levar até 30min — use \`--filter\` para filtrar por Non-Compliant'
        ],
        solution: `\`\`\`bash
SUB_ID=$(az account show --query id -o tsv)

# Verificar estado de compliance (pode demorar alguns minutos para popular)
echo "Verificando compliance..."
az policy state list \\
  --policy-assignment "audit-costcenter-sub" \\
  --query "[].{Recurso:resourceId,Estado:complianceState}" \\
  -o table 2>/dev/null || echo "Aguardando avaliação inicial (pode levar até 30 minutos)..."

# Forçar avaliação imediata (se disponível)
az policy state trigger-scan --resource-group rg-policy-lab 2>/dev/null || true

# Limpeza: remover assignment e policy definition
az policy assignment delete \\
  --name "audit-costcenter-sub" \\
  --scope /subscriptions/$SUB_ID

az policy definition delete --name "audit-require-costcenter-rg"

# Remover Resource Group
az group delete --name rg-policy-lab --yes --no-wait

echo "Limpeza concluída!"
\`\`\``,
        verify: `\`\`\`bash
# Verificar assignment removido
az policy assignment list \\
  --scope /subscriptions/$(az account show --query id -o tsv) \\
  --query "[?name=='audit-costcenter-sub'].name" -o tsv
# Saída esperada: (vazio)

# Verificar policy definition removida
az policy definition list --custom-role-only false \\
  --query "[?name=='audit-require-costcenter-rg'].name" -o tsv 2>/dev/null || echo "Policy removida"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Policy Deny não está bloqueando recursos não-conformes',
      difficulty: 'easy',
      symptom: 'Uma policy com efeito Deny foi criada para bloquear recursos sem tag "Environment", mas usuários ainda conseguem criar VMs sem essa tag.',
      diagnosis: `\`\`\`bash
# Verificar se a policy está atribuída (assignment existe)
az policy assignment list --all \\
  --query "[].{Nome:displayName,Escopo:scope,Policy:policyDefinitionId}" -o table

# Verificar o scope do assignment vs onde estão criando os recursos
# O RG onde está criando deve estar dentro do escopo da policy

# Verificar se há uma exemption no recurso
az policy exemption list --scope <resource-id>
\`\`\``,
      solution: `**Causas possíveis:**

1. **Policy atribuída no escopo errado**: Se o assignment está em \`rg-A\` mas o usuário cria em \`rg-B\`, a policy não se aplica. Verificar escopo e ajustar para subscription se necessário.

2. **Mode incorreto**: Policy com mode "Indexed" não avalia RGs. Se a condição é sobre tags em RGs, use mode "All".

3. **Exemption ativa**: Verificar se existe uma exemption no recurso ou RG.

4. **Efeito é "Audit" e não "Deny"**: Confirmar o efeito na policy definition.

5. **Cache/propagação**: Pode levar até 30 minutos após criação da policy para começar a ser avaliada.`
    },
    {
      title: 'DeployIfNotExists não está criando recursos automaticamente',
      difficulty: 'hard',
      symptom: 'Uma policy com efeito DeployIfNotExists deve criar um Log Analytics Workspace quando uma VM é criada sem diagnósticos configurados. Mas os workspaces não estão sendo criados.',
      diagnosis: `\`\`\`bash
# Verificar se a policy assignment tem Managed Identity configurada
az policy assignment show --name <assignment-name> \\
  --query "{Identity:identity,Scope:scope}" -o json

# Verificar role assignments da Managed Identity do assignment
POLICY_IDENTITY=$(az policy assignment show --name <assignment-name> \\
  --query "identity.principalId" -o tsv)
az role assignment list --assignee $POLICY_IDENTITY --all -o table

# Verificar remediation tasks existentes
az policy remediation list --policy-assignment <assignment-id> -o table
\`\`\``,
      solution: `**Causa**: \`DeployIfNotExists\` requer uma **Managed Identity** no assignment com **permissões adequadas** para criar recursos.

**Solução:**
1. Recriar o assignment com Managed Identity:
\`\`\`bash
az policy assignment create \\
  --name <assignment-name> \\
  --policy <policy-definition-id> \\
  --scope <scope> \\
  --assign-identity \\
  --location eastus \\
  --identity-scope <scope>  # scope onde a MI terá permissões
\`\`\`
2. Atribuir role adequada à Managed Identity do assignment:
\`\`\`bash
az role assignment create \\
  --assignee-object-id <managed-identity-principal-id> \\
  --role "Contributor" \\
  --scope <scope>
\`\`\`
3. Criar Remediation Task para remediar recursos EXISTENTES não-conformes:
\`\`\`bash
az policy remediation create \\
  --name "remediate-diagnostics" \\
  --policy-assignment <assignment-id> \\
  --resource-discovery-mode ReEvaluateCompliance
\`\`\``
    }
  ]
};
