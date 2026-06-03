window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-monitor/azure-monitor'] = {
  theory: `# Azure Monitor & Log Analytics

## Relevância no Exame
> Peso estimado **10-15%** no AZ-104. Questões sobre coleta de logs, alertas e diagnóstico de problemas são frequentes.

## Conceitos Fundamentais

### Azure Monitor
Plataforma unificada de monitoramento do Azure que coleta:
- **Métricas**: dados numéricos em série temporal (CPU%, requests/sec, latency)
- **Logs**: dados de texto estruturado/não-estruturado (eventos, traces, diagnósticos)
- **Traces**: rastreamento distribuído de aplicações (via Application Insights)

### Hierarquia de Monitoramento

\`\`\`
Azure Monitor
  ├─ Metrics (métricas de 93 dias, alta granularidade)
  ├─ Logs → Log Analytics Workspace (KQL queries)
  │    ├─ Activity Logs (operações no Azure ARM)
  │    ├─ Resource Logs (diagnósticos dos recursos)
  │    └─ Guest OS Logs (via Azure Monitor Agent)
  ├─ Alerts (regras de alerta + Action Groups)
  └─ Application Insights (APM para apps)
\`\`\`

### Log Analytics Workspace (LAW)
Repositório centralizado de logs para queries com **KQL** (Kusto Query Language):
- Retenção padrão: **30 dias** (configurável até 730 dias)
- Queries com KQL: filtros, joins, agregações, visualizações
- Pode agregar logs de múltiplas subscriptions e recursos

### Activity Log
Registro de todas as operações no plano de controle (Azure ARM):
- Quem criou/deletou/modificou qual recurso?
- Auditoria de operações administrativas
- Retenção padrão: **90 dias**
- Para retenção maior: exportar para Log Analytics, Storage ou Event Hub

### Azure Monitor Agent (AMA)
Substituiu o Log Analytics Agent (MMA/OMS) e o Diagnostics Extension. Coleta:
- Logs do SO (Windows Event Log, Syslog Linux)
- Métricas customizadas
- Configurado via **Data Collection Rules (DCR)**

### Alertas
**Alert Rule** = condição que dispara notificações:
- **Metric Alert**: baseado em métricas (ex: CPU > 80% por 5 min)
- **Log Alert**: baseado em query KQL (ex: count de erros > 10 em 1h)
- **Activity Log Alert**: operações específicas no Azure (ex: "VM deletada")
- **Smart Detection**: anomalias automáticas via Application Insights

**Action Group**: define quem notificar e como quando um alerta disparar:
- Email, SMS, push notification
- ITSM integration (ServiceNow, Jira)
- Azure Function, Logic App, Webhook
- Runbook de Automação

### Insights (Workbooks prontos)
- **VM Insights**: performance de VMs, mapas de dependência
- **Container Insights**: métricas de AKS e containers
- **Network Insights**: topologia e diagnóstico de rede

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Criar Log Analytics Workspace
az monitor log-analytics workspace create \\
  --workspace-name myLAW \\
  --resource-group myRG \\
  --location eastus \\
  --retention-time 90

# Configurar diagnósticos de uma VM para enviar ao LAW
LAW_ID=$(az monitor log-analytics workspace show \\
  --workspace-name myLAW --resource-group myRG --query id -o tsv)

az monitor diagnostic-settings create \\
  --name vm-diagnostics \\
  --resource <vm-resource-id> \\
  --workspace $LAW_ID \\
  --metrics '[{"category":"AllMetrics","enabled":true}]' \\
  --logs '[{"category":"Administrative","enabled":true}]'

# Criar Action Group
az monitor action-group create \\
  --name ops-team \\
  --resource-group myRG \\
  --short-name ops \\
  --email-receivers name=oncall address=ops@contoso.com

# Criar alert rule de métrica (CPU > 80%)
az monitor metrics alert create \\
  --name "High CPU Alert" \\
  --resource-group myRG \\
  --scopes <vm-resource-id> \\
  --condition "avg Percentage CPU > 80" \\
  --window-size 5m \\
  --evaluation-frequency 1m \\
  --action ops-team \\
  --severity 2

# Criar alert de Activity Log (VM deletada)
az monitor activity-log alert create \\
  --name "VM Deleted Alert" \\
  --resource-group myRG \\
  --scope /subscriptions/<sub-id> \\
  --condition category=Administrative \\
  --condition operationName=Microsoft.Compute/virtualMachines/delete \\
  --action-group <action-group-id>

# Consultar métricas de uma VM
az monitor metrics list \\
  --resource <vm-resource-id> \\
  --metric "Percentage CPU" \\
  --interval PT5M \\
  --start-time 2024-01-01T00:00:00Z \\
  --end-time 2024-01-01T01:00:00Z \\
  --query "value[0].timeseries[0].data[-3:]" -o table

# Query KQL no Log Analytics
az monitor log-analytics query \\
  --workspace $LAW_ID \\
  --analytics-query "Heartbeat | where TimeGenerated > ago(1h) | summarize count() by Computer" \\
  --timespan P1H
\`\`\`

## KQL Básico para o Exame

\`\`\`kql
// Top 10 erros na última hora
AzureDiagnostics
| where TimeGenerated > ago(1h)
| where Level == "Error"
| summarize count() by ResourceId
| top 10 by count_

// Activity Log: quem deletou recursos?
AzureActivity
| where OperationNameValue contains "delete"
| where ActivityStatusValue == "Success"
| project TimeGenerated, Caller, OperationNameValue, ResourceGroup

// CPU médio por VM nas últimas 6 horas
Perf
| where TimeGenerated > ago(6h)
| where CounterName == "% Processor Time"
| summarize avg(CounterValue) by Computer, bin(TimeGenerated, 1h)
\`\`\`

## Erros Comuns

1. **Activity Log retenção de 90 dias**: para auditoria de longo prazo, exportar para Storage Account ou Log Analytics.
2. **Alert em "Fired" não envia email**: verificar Action Group — o email pode ter sido verificado incorretamente.
3. **Métricas vs Logs**: métricas são numéricas em tempo real; logs precisam de query KQL e têm latência maior.
4. **LAW sem agente na VM**: o workspace recebe logs apenas se o Azure Monitor Agent está instalado e configurado com uma DCR.

## Killer.sh Style Challenge

> **Cenário**: Configure monitoramento para uma aplicação crítica:
> 1. Criar LAW com retenção de 90 dias
> 2. Criar alerta quando CPU de qualquer VM do RG superar 80% por 5 minutos
> 3. Notificar por email a equipe de operações
> 4. Criar alerta de Activity Log para detectar deleção de VMs na subscription
>
> **Descreva os passos e recursos necessários.**
`,

  quiz: [
    {
      question: 'Qual é a retenção padrão do Activity Log no Azure e como estendê-la?',
      options: [
        '30 dias — configurar no Log Analytics Workspace',
        '90 dias — exportar para Log Analytics, Storage Account ou Event Hub para maior retenção',
        '365 dias — não pode ser alterado',
        '7 dias — criar alerta para backup automático'
      ],
      correct: 1,
      explanation: 'O Activity Log tem retenção padrão de 90 dias. Para manter por mais tempo, configure Diagnostic Settings no Activity Log para exportar para: Log Analytics Workspace (até 730 dias), Storage Account (retenção personalizável, mais barato) ou Event Hub (streaming para SIEM externo).',
      reference: 'Activity Log = auditoria de operações ARM. 90 dias padrão. Para compliance, exporte para Storage ou LAW.'
    },
    {
      question: 'Qual é a diferença entre uma Metric Alert e uma Log Alert no Azure Monitor?',
      options: [
        'Metric Alert é para VMs; Log Alert é para Storage Accounts',
        'Metric Alert avalia dados numéricos em série temporal quase em tempo real; Log Alert executa queries KQL sobre logs com maior latência',
        'Log Alert é mais barato que Metric Alert',
        'Não há diferença técnica — são configurados da mesma forma'
      ],
      correct: 1,
      explanation: 'Metric Alerts avaliam dados numéricos (CPU%, requests/sec) em intervalos de 1-5 minutos — quase tempo real. Log Alerts executam queries KQL sobre logs no Log Analytics Workspace, com maior latência (dados podem demorar minutos para chegar) mas muito mais flexíveis — podem detectar padrões complexos como "mais de 10 erros 500 em 1 hora".',
      reference: 'Use Metric Alerts para performance/disponibilidade imediata. Use Log Alerts para padrões complexos e correlação de eventos.'
    },
    {
      question: 'Você quer receber um SMS quando uma VM for deletada acidentalmente na sua subscription. Qual tipo de alerta configurar?',
      options: [
        'Metric Alert com métrica "VM Count"',
        'Log Alert com query no LAW',
        'Activity Log Alert para operação Microsoft.Compute/virtualMachines/delete',
        'Smart Detection Alert do Application Insights'
      ],
      correct: 2,
      explanation: 'Activity Log Alerts disparam baseados em operações no plano de controle (ARM), incluindo criação, modificação e deleção de recursos. Para detectar deleção de VM, configure um Activity Log Alert com category=Administrative e operationName=Microsoft.Compute/virtualMachines/delete, associado a um Action Group com SMS.',
      reference: 'Activity Log Alert = auditoria em tempo real de operações ARM (quem fez o quê). Ideal para compliance e detecção de mudanças.'
    },
    {
      question: 'O que é um Action Group no Azure Monitor?',
      options: [
        'Um grupo de recursos monitorados juntos',
        'Uma coleção de ações (notificações, webhooks, runbooks) que são executadas quando um alerta dispara',
        'Um grupo de regras de alerta aplicadas ao mesmo recurso',
        'Um grupo do Entra ID com permissões de monitoramento'
      ],
      correct: 1,
      explanation: 'Action Group define "como reagir" quando um alerta dispara. Pode incluir: enviar email/SMS/push notification, chamar webhook ou Azure Function, executar Logic App, integrar com ITSM (ServiceNow), rodar Azure Automation Runbook. Um Action Group pode ser reutilizado em múltiplas Alert Rules.',
      reference: 'Alert Rule = "quando" alertar. Action Group = "como/quem" notificar. Separe essas responsabilidades para reutilização.'
    },
    {
      question: 'Qual linguagem é usada para consultar logs no Log Analytics Workspace?',
      options: [
        'SQL (Structured Query Language)',
        'KQL (Kusto Query Language)',
        'Gremlin (Apache TinkerPop)',
        'MongoDB Query Language'
      ],
      correct: 1,
      explanation: 'KQL (Kusto Query Language) é a linguagem de query do Azure Monitor Log Analytics. É uma linguagem de pipelines (similar ao shell pipe) otimizada para análise de logs. Exemplo básico: \`AzureActivity | where OperationNameValue contains "delete" | project TimeGenerated, Caller\`.',
      reference: 'KQL é usado também no Microsoft Sentinel, Azure Data Explorer e Azure Resource Graph. Vale a pena aprender o básico para o exame.'
    }
  ],

  flashcards: [
    {
      front: 'Qual é a hierarquia de monitoramento do Azure Monitor?',
      back: '``\`\nAzure Monitor\n  ├─ Metrics — dados numéricos, 93 dias, alta granularidade\n  ├─ Logs → Log Analytics Workspace\n  │    ├─ Activity Logs (operações ARM - 90 dias padrão)\n  │    ├─ Resource Logs (diagnósticos dos recursos)\n  │    └─ Guest OS Logs (via Azure Monitor Agent + DCR)\n  ├─ Alerts (Metric / Log / Activity Log)\n  │    └─ → Action Groups (email, SMS, webhook, runbook)\n  └─ Application Insights (APM)\n\```'
    },
    {
      front: 'Quais são os 3 tipos de Alert no Azure Monitor?',
      back: '1. **Metric Alert** — baseado em dados numéricos em série temporal (CPU, requests/sec). Avaliação quase em tempo real (1-5 min).\n\n2. **Log Alert** — query KQL sobre logs no LAW. Mais flexível, maior latência. Detecta padrões complexos.\n\n3. **Activity Log Alert** — disparado por operações ARM (criar, deletar, modificar recursos). Ideal para auditoria e compliance.'
    },
    {
      front: 'Por quanto tempo o Activity Log retém dados por padrão? Como estender?',
      back: '**Padrão: 90 dias**\n\nPara estender, configure **Diagnostic Settings** no Activity Log (nível da subscription) para exportar para:\n- **Log Analytics Workspace** — até 730 dias, queries KQL\n- **Storage Account** — retenção configurável, mais barato\n- **Event Hub** — streaming para SIEM externo (Splunk, IBM QRadar)\n\nPortal: Monitor → Activity Log → Export Activity Logs'
    },
    {
      front: 'O que é um Log Analytics Workspace e como consultar os dados?',
      back: '**Log Analytics Workspace (LAW)** é o repositório centralizado de logs do Azure Monitor.\n\n- Linguagem de query: **KQL (Kusto Query Language)**\n- Retenção: 30 dias padrão, até 730 dias configurável\n- Pode receber logs de múltiplas regiões/subscriptions\n\nExemplo KQL:\n``\`kql\nAzureActivity\n| where TimeGenerated > ago(24h)\n| where OperationNameValue contains "delete"\n| project TimeGenerated, Caller, ResourceGroup\n\```'
    }
  ],

  lab: {
    scenario: 'Configure monitoramento básico para recursos Azure da TechNova com Log Analytics Workspace e alertas de CPU.',
    objective: 'Criar LAW, configurar diagnostic settings e criar uma alert rule com action group.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Log Analytics Workspace',
        instruction: 'Crie um Log Analytics Workspace \`technova-law\` com retenção de 90 dias.',
        hints: ['Use \`az monitor log-analytics workspace create\`'],
        solution: `\`\`\`bash
az group create --name rg-monitor-lab --location eastus

az monitor log-analytics workspace create \\
  --workspace-name technova-law \\
  --resource-group rg-monitor-lab \\
  --location eastus \\
  --retention-time 90

LAW_ID=$(az monitor log-analytics workspace show \\
  --workspace-name technova-law \\
  --resource-group rg-monitor-lab \\
  --query id -o tsv)
echo "LAW ID: $LAW_ID"
\`\`\``,
        verify: `\`\`\`bash
az monitor log-analytics workspace show \\
  --workspace-name technova-law \\
  --resource-group rg-monitor-lab \\
  --query "{Nome:name,Retencao:retentionInDays,Status:provisioningState}" -o table
# Saída: Retenção 90, Status Succeeded
\`\`\``
      },
      {
        title: 'Criar Action Group para notificações',
        instruction: 'Crie um Action Group \`ops-alerts\` que envia email quando um alerta dispara.',
        hints: ['Use \`az monitor action-group create\` com \`--email-receivers\`'],
        solution: `\`\`\`bash
az monitor action-group create \\
  --name ops-alerts \\
  --resource-group rg-monitor-lab \\
  --short-name opsalert \\
  --email-receivers name=admin address=admin@contoso.com

AG_ID=$(az monitor action-group show \\
  --name ops-alerts \\
  --resource-group rg-monitor-lab \\
  --query id -o tsv)
echo "Action Group ID: $AG_ID"
\`\`\``,
        verify: `\`\`\`bash
az monitor action-group show \\
  --name ops-alerts \\
  --resource-group rg-monitor-lab \\
  --query "{Nome:name,Emails:emailReceivers[].emailAddress}" -o json
\`\`\``
      },
      {
        title: 'Criar Activity Log Alert para deleção de RGs',
        instruction: 'Crie um alert que detecta quando qualquer Resource Group é deletado na subscription.',
        hints: ['\`az monitor activity-log alert create\` com \`--condition category=Administrative\`'],
        solution: `\`\`\`bash
SUB_ID=$(az account show --query id -o tsv)
AG_ID=$(az monitor action-group show --name ops-alerts --resource-group rg-monitor-lab --query id -o tsv)

az monitor activity-log alert create \\
  --name "RG-Deletion-Alert" \\
  --resource-group rg-monitor-lab \\
  --scope /subscriptions/$SUB_ID \\
  --condition "category=Administrative and operationName=Microsoft.Resources/subscriptions/resourceGroups/delete" \\
  --action-groups $AG_ID \\
  --description "Alerta: Resource Group foi deletado"

echo "Activity Log Alert criado!"
\`\`\``,
        verify: `\`\`\`bash
az monitor activity-log alert list \\
  --resource-group rg-monitor-lab \\
  --query "[].{Nome:name,Habilitado:enabled}" -o table
# Saída esperada: RG-Deletion-Alert | True
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group do lab.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-monitor-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-monitor-lab 2>/dev/null && echo "Deletando..." || echo "RG removido"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Alerta disparou mas nenhum email foi recebido',
      difficulty: 'easy',
      symptom: 'Um Metric Alert aparece como "Fired" no portal Azure Monitor, mas nenhum membro da equipe recebeu o email.',
      diagnosis: `\`\`\`bash
# Verificar o Action Group configurado no alert
az monitor metrics alert show --name "meu-alerta" --resource-group myRG \\
  --query "actions[].actionGroupId" -o tsv

# Verificar receivers do Action Group
az monitor action-group show --ids <action-group-id> \\
  --query "emailReceivers" -o json
\`\`\``,
      solution: `**Causas possíveis:**

1. **Email não verificado**: se o email foi adicionado manualmente, pode exigir verificação. Verificar no portal se há uma pendência de confirmação no Action Group.

2. **Email no spam**: Verificar pasta de spam/junk — emails do Azure Monitor podem ser filtrados.

3. **Action Group errado**: verificar se o alert está associado ao Action Group correto.

4. **Rate limiting**: Azure Monitor pode suprimir alertas se dispararem muito frequentemente (alertas com throttling). Verificar no histórico do alerta se há "Suppressed".

5. **Regra desabilitada**: verificar se o alert está habilitado: \`az monitor metrics alert show --query enabled\`.`
    },
    {
      title: 'Logs não aparecem no Log Analytics após configurar diagnostic settings',
      difficulty: 'medium',
      symptom: 'Após configurar Diagnostic Settings para enviar logs de uma VM para o Log Analytics Workspace, queries KQL retornam zero resultados.',
      diagnosis: `\`\`\`bash
# Verificar se Diagnostic Settings foi criado corretamente
az monitor diagnostic-settings list --resource <vm-resource-id> -o json

# Verificar se o LAW ID está correto no diagnostic setting
az monitor diagnostic-settings show \\
  --name vm-diagnostics \\
  --resource <vm-resource-id> \\
  --query "workspaceId" -o tsv

# Verificar se o agente está instalado na VM
az vm extension list --vm-name myVM --resource-group myRG \\
  --query "[].{Nome:name,Estado:provisioningState}" -o table
\`\`\``,
      solution: `**Causas possíveis:**

1. **Aguardar ingestão**: logs podem levar **5-15 minutos** para aparecer no LAW após a configuração.

2. **Azure Monitor Agent não instalado**: para logs do SO (não apenas diagnósticos de plataforma), o Azure Monitor Agent precisa estar na VM + uma Data Collection Rule configurada.

3. **Diagnostic Settings incorreto**: verificar se o workspace ID está correto e se as categorias de log desejadas estão habilitadas.

4. **Query com filtro de tempo muito restrito**: queries KQL com \`ago(5m)\` podem não ter dados ainda — testar com \`ago(1h)\` ou \`ago(1d)\`.

5. **LAW diferente**: confirmar que está consultando o workspace correto.`
    }
  ]
};
