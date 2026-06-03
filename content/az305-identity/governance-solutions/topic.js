window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-identity/governance-solutions'] = {
  theory: `# Design de Governance & Compliance (AZ-305)

## Relevância no Exame
> Peso estimado **15-20%** no AZ-305. Questões sobre Landing Zones, hierarquia de management groups e estratégias de governance em escala.

## Conceitos Fundamentais

### Azure Landing Zone
Framework de boas práticas para estruturar o Azure de forma escalável e segura:
- Separa workloads de plataforma (identidade, rede, segurança) de workloads de aplicação
- Define guardrails (políticas, RBAC) que se aplicam a todos os workloads

**Estrutura típica de Management Groups para Landing Zone:**
\`\`\`
Root Management Group
  ├─ Tenant Root
  │    ├─ Platform
  │    │    ├─ Connectivity (ExpressRoute, VPN, Firewall)
  │    │    ├─ Identity (Entra ID Connect, AD DS)
  │    │    └─ Management (Monitor, Backup, ASC)
  │    ├─ Landing Zones
  │    │    ├─ Corp (recursos corporativos conectados ao hub)
  │    │    └─ Online (workloads voltados para Internet)
  │    ├─ Sandbox (experimentação, sem conectividade prod)
  │    └─ Decommissioned (assinaturas em descomissionamento)
\`\`\`

### Governance em Escala

**Estratégia de Policy:**
1. **Deny policies** para requisitos regulatórios hard (ex: apenas EU para dados GDPR)
2. **Audit policies** para visibilidade (ex: recursos sem tags)
3. **Modify/DeployIfNotExists** para remediação automática (ex: aplicar tags, habilitar diagnósticos)

**Iniciativas de Compliance Built-in:**
- ISO 27001, SOC 2, PCI DSS, NIST SP 800-53
- CIS Microsoft Azure Foundations Benchmark
- FedRAMP High

### Azure Blueprints (legado → usar Bicep/Terraform)
Empacotava: Role Assignments + Policy Assignments + ARM Templates + Resource Groups
- **Agora depreciado** em favor de Bicep + Deployment Stacks ou Terraform

### Tagging Strategy
Essencial para billing, governance e operações:

| Tag | Propósito | Exemplo |
|-----|-----------|---------|
| Environment | Identificar tier | prod, staging, dev |
| CostCenter | Chargeback | CC-1234 |
| Owner | Responsável | team-platform |
| Application | Aplicação | app-checkout |
| DataClassification | Compliance | confidential, public |

**Enforce tags via Policy:**
- \`Deny\` sem tag → bloqueia criação
- \`Modify\` → aplica tag automaticamente
- \`Append\` → adiciona tag se não existir

### Microsoft Defender for Cloud (ex-ASC)
Postura de segurança e proteção de workloads:
- **Secure Score**: pontuação de segurança baseada em recomendações
- **Regulatory Compliance**: mede compliance contra frameworks (ISO, PCI, NIST)
- **Defender Plans**: proteção avançada para VMs, SQL, Storage, etc.

### Cost Management + Billing
Ferramentas para controlar gastos:
- **Cost Analysis**: visualizar gastos por recurso/tag/serviço
- **Budgets**: alertas quando gastos atingem % do orçamento
- **Reservations**: desconto de até 72% para VMs/SQL de uso constante
- **Savings Plans**: desconto flexível por commitment de $ por hora

## Design Patterns

### Padrão: Policy Hierarchy por Ambiente
\`\`\`
Root MG
  ├─ Deny: recursos fora de regiões aprovadas [TODOS]
  ├─ Enforce: tag CostCenter obrigatória [TODOS]
  │
  └─ Prod MG
       ├─ Require: encryption at rest [PROD]
       ├─ Deny: public endpoints em Storage [PROD]
       └─ Deploy: Log Analytics em todas VMs [PROD]

  └─ Dev MG
       └─ Audit: custo por RG [DEV]
\`\`\`

### Padrão: Chargeback por Tag
\`\`\`
Policy: Inherit CostCenter tag de subscription → RG → Resource
Cost Management: grupo por tag CostCenter
Azure Cost Export: CSV para sistema de chargeback interno
\`\`\`

## Killer.sh Style Challenge

> **Cenário**: Empresa com 50 subscriptions precisa de governance. Requisiitos:
> 1. Dados pessoais apenas em regiões EU (GDPR)
> 2. Todo RG deve ter tags: Owner, CostCenter, Environment
> 3. Todas as VMs de produção devem ter diagnósticos habilitados
> 4. Monthly spend alerts para cada subscription
>
> **Projete a solução.**
>
> **Resposta**: Management Groups com 3 níveis: Root → Platform/Landing Zones/Sandbox. Na raiz: Deny policy para localização fora de EU para recursos com dataClassification=personal. Em Landing Zones: Policy Initiative com Deny (CostCenter/Owner/Environment obrigatórios) + Modify (herdar tags). Em Prod MG: DeployIfNotExists para Log Analytics Agent em VMs. Budget alerts por subscription com Action Group → email dos responsáveis.
`,

  quiz: [
    {
      question: 'Uma empresa precisa garantir que dados classificados como "PII" só sejam armazenados em regiões da Europa (GDPR). Como implementar isso em escala para todas as subscriptions?',
      options: [
        'Treinamento de compliance para todos os desenvolvedores',
        'Azure Policy Deny assignments no Management Group com condição de location fora da EU e tag dataClassification=PII',
        'Azure Defender for Cloud com alerta de compliance',
        'Lock de recursos em Storage Accounts nas regiões EU'
      ],
      correct: 1,
      explanation: 'Azure Policy com efeito Deny no Management Group garante que recursos marcados como PII não possam ser criados fora das regiões EU-approved. Assignado no MG pai, herda para todas as subscriptions filhas automaticamente. É a única forma de garantir conformidade técnica (não apenas por processo).',
      reference: 'Governance técnica > treinamento: políticas que bloqueiam garantem compliance; treinamento não garante. Use Policy Deny para "não pode fazer" e Audit para "deve fazer".'
    },
    {
      question: 'O que é Azure Secure Score no Microsoft Defender for Cloud?',
      options: [
        'A pontuação de crédito da empresa no Azure',
        'Uma métrica agregada da postura de segurança baseada em recomendações implementadas',
        'O número de incidentes de segurança no mês',
        'A velocidade de resposta a alertas de segurança'
      ],
      correct: 1,
      explanation: 'Secure Score é uma pontuação percentual que reflete quantas das recomendações de segurança do Defender for Cloud foram implementadas. Recomendações têm peso diferente — implementar uma recomendação crítica aumenta mais o score. Serve como KPI de postura de segurança e ajuda a priorizar melhorias.',
      reference: 'Secure Score = % de recomendações de segurança implementadas. Quanto mais alto, mais segura a postura. Meta: > 80%.'
    },
    {
      question: 'Qual é a melhor estratégia para aplicar tags obrigatórias (Owner, CostCenter) em todos os recursos de uma organização com múltiplas subscriptions?',
      options: [
        'Documentar a política e esperar que todos sigam voluntariamente',
        'Script PowerShell que roda mensalmente para adicionar tags faltantes',
        'Azure Policy com efeito Deny para novos recursos sem as tags, e Modify para herdar tags do Resource Group nos recursos',
        'Azure Blueprints atribuídos a cada subscription individualmente'
      ],
      correct: 2,
      explanation: 'A combinação de Deny (bloqueia novos recursos sem tag) e Modify (herda automaticamente tags do RG nos recursos) assignada em um Management Group é a abordagem escalável e automatizada. Deny previne criação de não-conformes; Modify garante consistência nos recursos existentes e novos. Scripts mensais são reativos e não garantem compliance contínuo.',
      reference: 'Policy Deny + Modify = governance automática. Deny evita não-conformidades; Modify herda e corrige automaticamente.'
    }
  ],

  flashcards: [
    {
      front: 'O que é uma Azure Landing Zone e quais são seus princípios?',
      back: '**Landing Zone** = ambiente Azure pré-configurado com guardrails de segurança, rede e governance antes de colocar workloads.\n\n**Princípios:**\n1. **Subscription per workload**: separação de billings e limites\n2. **Policy-driven governance**: guardrails automáticos via Azure Policy\n3. **Platform separation**: rede, identidade, segurança gerenciados separadamente dos workloads\n4. **Scalability**: estrutura que cresce sem reescrita\n\n**Acelerador**: Azure Landing Zone Bicep no GitHub (microsoft/alz-bicep)'
    },
    {
      front: 'Quais são os 4 componentes de uma estratégia de tagging eficaz?',
      back: '1. **Tags obrigatórias** (aplicadas via Policy Deny):\n   - CostCenter, Owner, Environment, Application\n\n2. **Tags herdadas** (via Policy Modify):\n   - Recursos herdam tags do Resource Group\n   - RGs herdam da Subscription\n\n3. **Data Classification** (para compliance):\n   - confidential, internal, public\n\n4. **Automação de reports**:\n   - Cost Management agrupado por tag\n   - Chargeback por CostCenter'
    },
    {
      front: 'Qual é a diferença entre Reservations e Savings Plans no Azure Cost Management?',
      back: '**Reservations** (até 72% desconto):\n- Compromisso de 1 ou 3 anos para recursos ESPECÍFICOS\n- Ex: 10 × D4s_v5 em East US\n- Desconto aplicado automaticamente se o recurso corresponde\n- Menos flexível, maior desconto\n\n**Savings Plans** (até 65% desconto):\n- Compromisso de valor em $/hora por 1 ou 3 anos\n- Aplicado a qualquer compute que se enquadre\n- Mais flexível (qualquer região, tamanho)\n- Menor desconto que Reservations'
    }
  ],

  lab: {
    scenario: 'Configure uma estrutura básica de governance com Management Group e Azure Policy para a TechNova.',
    objective: 'Criar Management Group, explorar hierarquia e verificar compliance via Azure Policy.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Criar Management Group',
        instruction: 'Crie um Management Group para a TechNova e explore a hierarquia.',
        hints: ['\`az account management-group create\`'],
        solution: `\`\`\`bash
# Criar Management Group (requer permissão Owner/Management Group Contributor)
az account management-group create \\
  --name "TechNova-Corp" \\
  --display-name "TechNova Corporation"

# Listar Management Groups
az account management-group list --output table
\`\`\``,
        verify: `\`\`\`bash
az account management-group show --name "TechNova-Corp" \\
  --query "{Nome:displayName,ID:name}" -o table 2>/dev/null || \\
  echo "Verificar permissões — Management Group requer Owner no tenant"
\`\`\``
      },
      {
        title: 'Explorar compliance e Secure Score',
        instruction: 'Explore o Microsoft Defender for Cloud para entender o Secure Score e recomendações via CLI.',
        hints: ['\`az security secure-score list\`'],
        solution: `\`\`\`bash
# Ver Secure Score da subscription
az security secure-score list \\
  --query "[].{Score:properties.score.current,Max:properties.score.max,Pct:properties.score.percentage}" \\
  -o table 2>/dev/null || echo "Defender for Cloud: Portal → Security Center → Secure Score"

# Ver recomendações ativas
az security assessment list \\
  --query "[?properties.status.code=='Unhealthy'][].{Nome:displayName,Status:properties.status.code}" \\
  -o table 2>/dev/null | head -10 || echo "Verificar via portal: Defender for Cloud → Recommendations"
\`\`\``,
        verify: `\`\`\`bash
echo "Secure Score explorado — goals: > 80% indica boa postura de segurança"
echo "Recomendações prioritárias: habilitar MFA, ativar diagnósticos, criptografia em repouso"
\`\`\``
      },
      {
        title: 'Configurar Budget Alert',
        instruction: 'Crie um budget de R$100 (ou $100) mensal com alerta em 80% de uso.',
        hints: ['\`az consumption budget create\`'],
        solution: `\`\`\`bash
SUB_ID=$(az account show --query id -o tsv)

# Criar budget mensal
az consumption budget create \\
  --budget-name monthly-budget \\
  --amount 100 \\
  --time-grain Monthly \\
  --start-date $(date +%Y-%m-01) \\
  --end-date 2026-12-31 \\
  --scope /subscriptions/$SUB_ID \\
  --notifications '[{
    "enabled": true,
    "operator": "GreaterThan",
    "threshold": 80,
    "contactEmails": ["admin@contoso.com"],
    "thresholdType": "Actual"
  }]' 2>/dev/null || echo "Budget criado via portal: Cost Management → Budgets → + Add"
\`\`\``,
        verify: `\`\`\`bash
az consumption budget list --query "[].{Nome:name,Amount:amount}" -o table 2>/dev/null || echo "Verificar via portal"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Custos inesperadamente altos no Azure',
      difficulty: 'medium',
      symptom: 'A fatura do Azure veio muito acima do esperado. Precisa identificar quais recursos estão gerando o custo.',
      diagnosis: `\`\`\`bash
# Analisar custos por resource group
az consumption usage list \\
  --start-date $(date -d '-30 days' '+%Y-%m-%d') \\
  --end-date $(date '+%Y-%m-%d') \\
  --query "sort_by([],&pretaxCost)[-5:].{Recurso:instanceName,Custo:pretaxCost,Servico:meterDetails.serviceName}" \\
  -o table 2>/dev/null || echo "Verificar: Cost Management → Cost Analysis → Group by: Resource"
\`\`\``,
      solution: `**Processo de investigação:**

1. **Cost Analysis no portal**: Cost Management → Cost Analysis → Group by: Resource ou Service → filtrar por período.

2. **Tags ausentes**: se recursos não têm tags, difícil rastrear. Prioridade: implementar tagging e Cost Management budgets.

3. **VMs não deallocadas**: VMs "Stopped" (não deallocated) ainda cobram compute — verificar todas as VMs com \`az vm list --show-details --query "[?powerState!='VM deallocated'].{Nome:name,Status:powerState}"\`.

4. **Storage com dados esquecidos**: Storage Accounts com dados antigos em tier Hot — configurar lifecycle policies.

5. **Dev/test resources ativos 24/7**: recursos de desenvolvimento que deveriam ser deletados após o trabalho — implementar auto-shutdown para VMs de dev.`
    }
  ]
};
