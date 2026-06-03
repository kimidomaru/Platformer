window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-identity/monitoring-design'] = {
  theory: `# Design de Soluções de Monitoramento (AZ-305)

## Relevância no Exame
> Peso estimado **10-15%** no AZ-305. O exame avalia a capacidade de projetar uma estratégia de monitoramento completa — não apenas configurar alertas, mas decidir qual workspace, quais dados coletar e como estruturar para escala.

## Azure Monitor — Hierarquia de Design

\`\`\`
Azure Monitor (plataforma central)
  ├─ Metrics (numérico, 93 dias retenção, <1min granularidade)
  │    └─ Metric Alerts → Action Groups → Notificação/Automação
  ├─ Logs (texto/JSON, Log Analytics Workspace)
  │    ├─ Activity Log (auditoria de operações de plano de controle)
  │    ├─ Resource Logs (diagnóstico de recursos)
  │    └─ VM/Container Logs (agentes)
  ├─ Application Insights (APM para aplicações)
  └─ Alerts
       ├─ Metric Alerts
       ├─ Log Query Alerts
       ├─ Activity Log Alerts
       └─ Smart Alerts (anomaly detection)
\`\`\`

## Log Analytics Workspace — Estratégia de Design

### Quantos workspaces criar?

| Fator | Centralizado (1 workspace) | Distribuído (N workspaces) |
|-------|--------------------------|--------------------------|
| Compliance | Dados em mesma região requerida? | Dados em regiões diferentes |
| Custo | Commitment tiers (economia em volume) | Custos separados por equipe |
| Acesso | RBAC granular por tabela | Isolamento completo |
| Retenção | Diferente por tabela | Diferente por workspace |
| Troubleshooting | Cross-resource queries fáceis | Cross-workspace queries mais complexas |

**Recomendação Microsoft**: centralizado por padrão + segundo workspace para compliance/isolamento.

### Retenção e Archiving

\`\`\`bash
# Configurar retenção interativa e arquivamento por tabela
az monitor log-analytics workspace table update \
  --workspace-name myws --resource-group myRG \
  --name SecurityEvent \
  --retention-time 90 \           # dias no estado "hot" (interativo)
  --total-retention-time 730      # total incluindo archive (2 anos)

# Archive = tier mais barato, requer restauração para queries
\`\`\`

### KQL para Design de Alertas

\`\`\`kql
// Alert: VM CPU > 90% por 15 minutos
Perf
| where ObjectName == "Processor" and CounterName == "% Processor Time"
| where CounterValue > 90
| summarize avg(CounterValue) by Computer, bin(TimeGenerated, 5m)
| where avg_CounterValue > 90

// Alert: Failed logins (Security)
SecurityEvent
| where EventID == 4625
| summarize FailedLogins = count() by Account, Computer, bin(TimeGenerated, 15m)
| where FailedLogins > 10

// Alert: Application errors
AppExceptions
| where SeverityLevel == "Error"
| summarize ErrorCount = count() by Type, bin(TimeGenerated, 5m)
| where ErrorCount > 50
\`\`\`

## Application Insights — Design para Aplicações

\`\`\`bash
# Criar Application Insights
az monitor app-insights component create \
  --app myapp-insights \
  --resource-group myRG \
  --location eastus \
  --workspace /subscriptions/.../workspaces/myws  # workspace-based (recomendado)

# Obter instrumentation key
az monitor app-insights component show \
  --app myapp-insights --resource-group myRG \
  --query "instrumentationKey" -o tsv
\`\`\`

**Workspace-based vs Classic Application Insights**: workspace-based (recomendado) integra dados no Log Analytics, permite KQL unificado e RBAC granular.

### Sampling Strategy

Para aplicações de alto volume, configure sampling para controlar custo:

\`\`\`json
{
  "sampling": {
    "percentage": 10,
    "isAdaptive": true,
    "maxTelemetryItemsPerSecond": 5
  }
}
\`\`\`

## Diagnostic Settings — Coleta Centralizada

\`\`\`bash
# Habilitar diagnostic settings em recurso (ex: Key Vault)
az monitor diagnostic-settings create \
  --name "to-workspace" \
  --resource /subscriptions/.../vaults/mykeyvault \
  --workspace /subscriptions/.../workspaces/myws \
  --logs '[{"category":"AuditEvent","enabled":true}]' \
  --metrics '[{"category":"AllMetrics","enabled":true}]'

# Habilitar em todos os recursos de um RG (via Policy)
# Use iniciativa "Enable Azure Monitor for VMs" (built-in)
\`\`\`

## Azure Monitor Workbooks

Workbooks = dashboards interativos com KQL:

\`\`\`kql
// Workbook: Overview de saúde de aplicação
requests
| where timestamp > ago(24h)
| summarize
    TotalRequests = count(),
    FailedRequests = countif(success == false),
    AvgDuration = avg(duration),
    P95Duration = percentile(duration, 95)
by bin(timestamp, 1h)
| render timechart
\`\`\`

## Padrão: Monitoramento Multi-Layer

\`\`\`
Layer 1: Infrastructure (VMs, AKS nodes)
  → Azure Monitor Agent → Log Analytics Workspace
  → Metric Alerts para CPU/Memória/Disco

Layer 2: Platform (AKS, App Service, SQL)
  → Resource Logs → Log Analytics
  → Container Insights, SQL Insights

Layer 3: Application (código)
  → Application Insights (SDK ou auto-instrumentation)
  → Distributed tracing, exceptions, performance

Layer 4: Business (KPIs)
  → Custom Metrics / Custom Events no App Insights
  → Workbooks para dashboards executivos
\`\`\`

## Erros Comuns de Design

1. **Workspaces demais sem necessidade**: múltiplos workspaces fragmentam dados e complicam queries cross-resource.
2. **Sem sampling em App Insights**: aplicações de alto tráfego sem sampling geram custo excessivo de ingestão.
3. **Activity Log sem exportação**: Activity Log retém apenas 90 dias — exportar para workspace para histórico maior.
4. **Retenção padrão para dados de compliance**: SecurityEvent com 30 dias de retenção pode violar compliance (HIPAA, ISO 27001 exigem 1+ anos).
5. **Classic Application Insights**: migrar para workspace-based para melhor integração e recursos.

## Killer.sh Style Challenge (AZ-305)

> Uma empresa com 3 ambientes (dev, staging, prod) precisa:
> - Dados de segurança retidos por 2 anos (compliance)
> - Custos separados por equipe via tags
> - Dev e staging: retenção de 30 dias (custo)
> - Prod: cross-resource queries entre VMs, App Service e SQL
>
> **Solução**: 2 workspaces: (1) "prod" para todos os recursos de produção com tabela SecurityEvent retention=730 dias; (2) "nonprod" para dev/staging com retention=30 dias. Usar resource tags + Azure Cost Management para chargeback por equipe. Application Insights workspace-based apontando para o workspace "prod". Azure Policy DeployIfNotExists para garantir diagnostic settings em todos os recursos.
`,

  quiz: [
    {
      question: 'Qual é a diferença entre Metrics e Logs no Azure Monitor e quando usar cada um?',
      options: [
        'Metrics são mais caros; Logs são gratuitos',
        'Metrics são séries temporais numéricas (para alertas de threshold e dashboards em tempo real); Logs são dados ricos/textuais armazenados no Log Analytics (para investigação e análises complexas)',
        'Metrics são para VMs; Logs são para aplicações',
        'Não há diferença técnica — são redundantes'
      ],
      correct: 1,
      explanation: 'Metrics são séries temporais numéricas com alta frequência (1 minuto), retenção de 93 dias, ideais para alertas de threshold (CPU > 80%) e dashboards em tempo real com baixa latência. Logs são dados textuais/JSON ricos armazenados no Log Analytics com retenção configurável (até anos), consultados via KQL para análises complexas, troubleshooting e correlação entre recursos.',
      reference: 'Hierarquia do Azure Monitor — Metrics para alertas rápidos; Logs para análise profunda e correlação.'
    },
    {
      question: 'Quando justifica ter múltiplos Log Analytics Workspaces em vez de um centralizado?',
      options: [
        'Sempre que há mais de 5 recursos para monitorar',
        'Quando há requisitos de compliance que exigem dados em regiões geográficas separadas, ou quando diferentes times precisam de isolamento completo de dados',
        'Múltiplos workspaces sempre melhoram a performance das queries',
        'É obrigatório ter um workspace por subscription'
      ],
      correct: 1,
      explanation: 'A recomendação Microsoft é centralizar em um único workspace para simplificar queries cross-resource e aproveitar commitment tiers (desconto em volume). Justificativas para workspaces separados: dados que precisam ficar em regiões específicas (GDPR, soberania de dados), isolamento completo de equipes ou BUs, ou diferentes políticas de retenção por regulamentação.',
      reference: 'Seção Log Analytics Workspace — centralizado é o padrão; adicione workspaces apenas por necessidade real.'
    },
    {
      question: 'Qual é a estratégia recomendada para gerenciar retenção de dados de segurança (SecurityEvent) que precisam ser retidos por 2 anos para compliance?',
      options: [
        'Criar um Storage Account separado e copiar logs manualmente',
        'Configurar retention-time=30 e total-retention-time=730 na tabela SecurityEvent do Log Analytics (interactive + archive)',
        'Usar um segundo Log Analytics Workspace apenas para dados de segurança',
        'Exportar para Azure Blob Storage com lifecycle policy para Archive'
      ],
      correct: 1,
      explanation: 'O Log Analytics suporta dois níveis de retenção por tabela: Interactive (hot, consultável normalmente) e Archive (custo baixo, requer restauração para queries). Configurar --retention-time=90 (interativo) e --total-retention-time=730 (inclui archive) na tabela SecurityEvent garante 2 anos de retenção com custo otimizado — 90 dias de acesso rápido + o resto em archive.',
      reference: 'Seção Retenção e Archiving — configure por tabela para balancear custo vs necessidade de acesso.'
    }
  ],

  flashcards: [
    {
      front: 'Qual é a hierarquia de design do Azure Monitor?',
      back: '**4 camadas de monitoramento**:\n\n1. **Infra** (VMs, nodes): Azure Monitor Agent → Log Analytics → Metric Alerts para CPU/mem/disco\n\n2. **Plataforma** (AKS, App Service, SQL): Resource Logs → Log Analytics → Container Insights, SQL Insights\n\n3. **Aplicação** (código): Application Insights SDK → distributed tracing, exceptions, performance\n\n4. **Negócio** (KPIs): Custom Metrics/Events → Workbooks para dashboards executivos\n\nCada camada adiciona visibilidade diferente — monitore todas para cobertura completa.'
    },
    {
      front: 'Quando usar Application Insights vs Log Analytics diretamente?',
      back: '**Application Insights** (workspace-based recomendado):\n- Monitoramento de código da aplicação\n- Distributed tracing (end-to-end request tracking)\n- Exceptions e performance de funções\n- Browser/mobile telemetry\n- SDK ou auto-instrumentation\n\n**Log Analytics diretamente**:\n- Infrastructure logs (VMs, containers)\n- Security logs (Activity Log, SecurityEvent)\n- Resource diagnostics\n- Cross-resource correlation via KQL\n\n**Workspace-based App Insights**: dados de App Insights ficam no Log Analytics → queries KQL unificadas entre infra + app.'
    }
  ],

  lab: {
    scenario: 'Configurar uma estratégia de monitoramento centralizada com Log Analytics e alertas de Log Query.',
    objective: 'Criar workspace Log Analytics, configurar diagnostic settings e criar um alert rule baseado em KQL.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Log Analytics Workspace e configurar retenção',
        instruction: 'Crie um workspace com retenção customizada para dados de segurança.',
        hints: ['az monitor log-analytics workspace create', 'az monitor log-analytics workspace table update para retenção por tabela'],
        solution: `\`\`\`bash
az group create --name rg-monitoring-design --location eastus

az monitor log-analytics workspace create \
  --workspace-name technova-monitoring \
  --resource-group rg-monitoring-design \
  --location eastus \
  --retention-time 30          # retenção padrão 30 dias

WS_ID=$(az monitor log-analytics workspace show \
  --workspace-name technova-monitoring \
  --resource-group rg-monitoring-design \
  --query id -o tsv)

echo "Workspace ID: $WS_ID"
echo "WS_ID=$WS_ID" > /tmp/monitoringlab.sh
\`\`\``,
        verify: `\`\`\`bash
az monitor log-analytics workspace show \
  --workspace-name technova-monitoring \
  --resource-group rg-monitoring-design \
  --query "{Name:name,Retention:retentionInDays,Status:provisioningState}" -o table
# Esperado: technova-monitoring, retentionInDays=30, Succeeded
\`\`\``
      },
      {
        title: 'Criar Application Insights workspace-based',
        instruction: 'Crie um Application Insights component vinculado ao workspace criado anteriormente.',
        hints: ['az monitor app-insights component create --workspace', 'Workspace-based é a abordagem recomendada'],
        solution: `\`\`\`bash
source /tmp/monitoringlab.sh

az monitor app-insights component create \
  --app technova-appinsights \
  --resource-group rg-monitoring-design \
  --location eastus \
  --workspace "$WS_ID"

AI_KEY=$(az monitor app-insights component show \
  --app technova-appinsights \
  --resource-group rg-monitoring-design \
  --query "instrumentationKey" -o tsv)

echo "Instrumentation Key: $AI_KEY"
echo "Pronto para instrumentar aplicações!"
\`\`\``,
        verify: `\`\`\`bash
az monitor app-insights component show \
  --app technova-appinsights \
  --resource-group rg-monitoring-design \
  --query "{Name:name,Type:applicationType,WorkspaceLinked:workspaceResourceId}" -o table
# Esperado: technova-appinsights, web, com workspaceResourceId preenchido

az group delete --name rg-monitoring-design --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Queries KQL não retornam dados apesar de diagnostic settings configuradas',
      difficulty: 'medium',
      symptom: 'Diagnostic settings foram configuradas em um recurso (ex: Key Vault) apontando para o Log Analytics, mas queries na tabela AzureDiagnostics/KeyVaultData retornam 0 linhas.',
      diagnosis: `\`\`\`bash
# Verificar se diagnostic settings foram aplicadas corretamente
az monitor diagnostic-settings list --resource /subscriptions/.../vaults/mykeyvault \
  --query "[].{Name:name,Workspace:workspaceId,Logs:logs[?enabled==true].category}" -o json

# Verificar na workspace que tabela existe
az monitor log-analytics workspace table list \
  --workspace-name myws --resource-group myRG \
  --query "[?contains(name,'KeyVault') || contains(name,'AzureDiagnostics')].name" -o tsv
\`\`\``,
      solution: `**Checklist de diagnóstico**:

1. **Aguardar ingestão**: após criar diagnostic settings, pode levar até 15 minutos para os primeiros logs aparecerem.

2. **Verificar se houve atividade**: sem operações no recurso, não há logs. Tente acessar o Key Vault para gerar um evento de diagnóstico.

3. **Workspace errado**: confirmar que a query está sendo executada no workspace correto.

4. **Tabela incorreta**: recursos Azure podem usar \`AzureDiagnostics\` (legado) ou tabelas específicas (\`KeyVaultData\`). Verifique qual tabela o recurso usa:
\`\`\`kql
// Listar todas as tabelas com dados no workspace
search *
| distinct $table
\`\`\`

5. **Filtro de categoria**: verificar se a categoria correta foi habilitada (ex: AuditEvent para Key Vault, não apenas AllLogs).`
    }
  ]
};
