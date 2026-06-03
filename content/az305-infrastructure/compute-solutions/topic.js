window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-infrastructure/compute-solutions'] = {
  theory: `# Design de Soluções de Compute (AZ-305)

## Relevância no Exame
> Peso estimado **25-30%** no AZ-305. O exame avalia a capacidade de escolher entre IaaS/PaaS/serverless e projetar arquiteturas de compute adequadas aos requisitos.

## Conceitos Fundamentais

### Matriz de Decisão: IaaS vs PaaS vs Serverless

\`\`\`
                  Controle    Gerenciamento   Escalabilidade   Custo
VMs (IaaS)         Alto        Manual          Manual            Fixo
App Service (PaaS) Médio       Gerenciado      Auto              Sob demanda
Container Inst.    Médio       Serverless       Auto (burst)     Por segundo
AKS                Alto        Compartilhado   Auto              Por node
Functions          Baixo       Serverless       Automático        Por execução
\`\`\`

**Quando usar cada um:**

| Serviço | Use quando |
|---------|-----------|
| **Azure VMs** | Controle total do OS, software legado, workloads Windows específicos, lift-and-shift |
| **App Service** | Web apps, APIs REST, sem gerenciar infraestrutura, 1-30k requisições/dia |
| **Azure Container Instances (ACI)** | Containers sem orquestração, tarefas batch, CI/CD runners, burst rápido |
| **Azure Kubernetes Service (AKS)** | Microserviços complexos, múltiplos times, alto tráfego, deployment sofisticado |
| **Azure Functions** | Event-driven, processamento assíncrono, webhooks, tarefas agendadas curtas |
| **Azure Container Apps** | Microserviços serverless com Dapr, sem gerenciar Kubernetes |
| **Azure Logic Apps** | Integrações e workflows sem código, conectores de SaaS |

### VM Scale Sets (VMSS)
Gerencia grupos de VMs idênticas com autoscaling:
- **Autoscaling**: scale out/in baseado em métricas (CPU, memory, custom)
- **Rolling updates**: atualiza VMs gradualmente sem downtime
- **Spot VMs**: usa capacity excedente do Azure com desconto (até 90%) mas pode ser interrompido
- **Flex orchestration**: mais flexível, suporta diferentes tamanhos no mesmo set

**Quando VMSS vs App Service:**
- VMSS: workloads stateful, containers legados, processamento intensivo em VMs
- App Service: web apps, sem gerenciar OS, deploys simples

### Azure Kubernetes Service (AKS) — Decisão de Arquitetura
Não é sempre a melhor escolha. Use AKS quando:
- Múltiplos microserviços com interdependências complexas
- Time tem expertise em Kubernetes
- Requer portabilidade (multi-cloud ou on-premises)
- Workloads com requisitos muito diferentes de recursos

Considere **Azure Container Apps** como alternativa mais simples ao AKS para microserviços serverless.

### Serverless Compute

**Azure Functions** — evento → código → resultado:
- **Consumption plan**: paga por execução, escala para zero
- **Premium plan**: sem cold start, VNET integration, mais caro
- **Dedicated plan**: App Service plan existente, bom para functions longas
- Timeout: 5 min (Consumption), 10 min configurável (Premium/Dedicated)

**Durable Functions** — orchestration:
- **Orchestrator**: coordena atividades (não chama APIs externas diretamente)
- **Activity**: executa trabalho real
- **Human interaction pattern**: aguarda aprovação humana

### Azure Batch
Processamento em larga escala de jobs paralelos:
- Cria e gerencia pools de VMs automaticamente
- Distribui tarefas entre as VMs
- Paga apenas pelo compute usado
- Casos: renderização 3D, simulações científicas, processamento de dados

### Seleção de Região e Proximity Placement Groups
- **Proximity Placement Groups**: garante que VMs sejam fisicamente próximas (mesma rack) para minimizar latência de rede
- Importante para HPC e workloads latency-sensitive

## Padrões de Design

### Padrão: Web App com Backend Assíncrono
\`\`\`
Client → App Service (Web)
              ↓ queue
         Azure Service Bus/Queue
              ↓ trigger
         Azure Functions (processamento)
              ↓
         Azure SQL / Cosmos DB
\`\`\`

### Padrão: Microserviços em AKS
\`\`\`
Internet → Azure Front Door/AppGW (WAF, SSL)
              ↓
           AKS Ingress Controller (nginx/AGIC)
              ↓
    [Service A] [Service B] [Service C]
        ↓              ↓           ↓
  Azure SQL     Cosmos DB    Azure Cache
\`\`\`

### Padrão: Batch Processing
\`\`\`
Blob Storage (input files)
      ↓ trigger
Azure Batch (pool de VMs)
      ↓ processamento paralelo
Blob Storage (output files)
      ↓
Azure Functions (notificação)
\`\`\`

## Erros Comuns de Design

1. **AKS para app simples**: AKS tem custo e complexidade operacional alto — App Service ou Container Apps são mais adequados para apps simples.
2. **Functions sem Premium Plan para VNet**: Functions no Consumption Plan não têm VNet integration nativa — usar Premium Plan.
3. **VMSS sem health probes**: sem health probes, o VMSS não detecta instâncias não saudáveis.
4. **Não considerar cold start**: Functions no Consumption Plan têm cold start — para latência consistente, usar Premium.

## Killer.sh Style Challenge (AZ-305 Style)

> **Cenário**: Uma empresa tem:
> - Um site de e-commerce com picos de 10x tráfego no Black Friday
> - Processamento de pedidos que demora 30 segundos cada
> - Relatórios analíticos que rodam overnight sobre GB de dados
> - Uma API de parceiros que deve estar sempre disponível com latência < 100ms
>
> **Projete a solução de compute para cada componente.**
>
> **Solução esperada:**
> - Site e-commerce: **App Service + Premium Plan** com autoscaling ou **Azure Front Door + múltiplas regiões** (99.99%)
> - Processamento de pedidos: **Azure Functions** com trigger em Service Bus Queue (desacopla, escala independente, 30s ok no Premium/Dedicated plan)
> - Relatórios analíticos: **Azure Batch** ou **Azure Databricks** (processamento paralelo de GBs overnight)
> - API de parceiros: **App Service Premium** com **Availability Zones** (latência baixa, sempre disponível) ou **Azure API Management** na frente
`,

  quiz: [
    {
      question: 'Uma startup precisa processar imagens enviadas pelos usuários (operação de 5-10 segundos por imagem) sem manter servidores sempre ligados. O volume é irregular — pode ser zero por horas e picos de centenas simultâneas. Qual solução de compute é mais adequada?',
      options: [
        'VMs com autoscaling',
        'Azure Functions com trigger em Blob Storage',
        'App Service com escalabilidade manual',
        'Azure Kubernetes Service (AKS)'
      ],
      correct: 1,
      explanation: 'Azure Functions é ideal para processamento event-driven irregular: escala automaticamente de zero para qualquer volume, paga apenas por execução, e o trigger em Blob Storage inicia o processamento automaticamente quando uma imagem é carregada. VMs com autoscaling demoraria minutos para escalar, AKS tem custo fixo de nodes.',
      reference: 'Azure Functions = event-driven, escala para zero, paga por execução. Perfeito para workloads irregulares e assíncronos.'
    },
    {
      question: 'Um aplicativo legado Windows (.NET Framework 4.5) precisa ser migrado para Azure com o mínimo de mudanças. Qual serviço de compute é mais adequado?',
      options: [
        'Azure Functions',
        'Azure Container Instances',
        'Azure Virtual Machines (IaaS)',
        'Azure Container Apps'
      ],
      correct: 2,
      explanation: 'Para lift-and-shift de aplicações legadas com dependências específicas de OS ou framework antigo, Azure VMs (IaaS) é a escolha mais adequada — permite controle total do SO, instalar dependências específicas, e migrar com o mínimo de mudanças no código. Azure Functions e Container Apps requerem refatoração.',
      reference: 'Lift-and-shift com software legado → VMs (IaaS). Modernização incremental → App Service. Refatoração completa → Functions/Containers.'
    },
    {
      question: 'Qual é a principal diferença entre Azure Container Instances (ACI) e Azure Container Apps?',
      options: [
        'ACI é para Linux; Container Apps é para Windows',
        'ACI é para containers de curta duração e burst; Container Apps é para microserviços com escalabilidade e ingress gerenciados',
        'Não há diferença técnica — são o mesmo serviço',
        'ACI suporta Kubernetes; Container Apps não'
      ],
      correct: 1,
      explanation: 'Azure Container Instances é simples e direto — execute um container sem gerenciar infraestrutura, ideal para jobs de curta duração, CI/CD runners, tarefas batch. Container Apps é construído sobre Kubernetes (abstraindo a complexidade) com resources de microserviços: autoscaling via KEDA, ingress gerenciado, service discovery, Dapr integration — para aplicações de longa duração.',
      reference: 'ACI = container simples, sem orquestração. Container Apps = microserviços serverless sobre K8s. AKS = Kubernetes gerenciado com controle total.'
    },
    {
      question: 'Uma aplicação de análise de dados precisa processar 10.000 arquivos em paralelo overnight. Cada arquivo leva ~30 segundos para processar. Qual serviço Azure é mais adequado?',
      options: [
        'Azure Functions com Consumption Plan',
        'Azure App Service com máxima instâncias',
        'Azure Batch',
        'Azure Logic Apps'
      ],
      correct: 2,
      explanation: 'Azure Batch é projetado para workloads HPC e processamento paralelo em larga escala. Gerencia automaticamente pools de VMs, distribui tarefas, gerencia dependências e limpa recursos após conclusão. Para 10.000 tarefas paralelas, Batch é muito mais adequado que Functions (que tem limites de concorrência e custo) ou App Service.',
      reference: 'Azure Batch = HPC, renderização, simulações, processamento paralelo de grandes volumes. Cria e destrói VMs automaticamente.'
    },
    {
      question: 'Qual plano do Azure Functions é necessário para integração com Virtual Network e eliminar cold starts?',
      options: [
        'Consumption Plan',
        'Premium Plan',
        'App Service Plan (Dedicated)',
        'Basic Plan'
      ],
      correct: 1,
      explanation: 'Premium Plan do Azure Functions oferece: sem cold start (instâncias pré-aquecidas), VNet integration, CPU/memory mais poderosos, e execução ilimitada em duração. Consumption Plan não tem VNet integration nativa e tem cold start. Dedicated (App Service) Plan também evita cold start mas é mais caro para funções com baixa utilização.',
      reference: 'Functions + VNet = Premium Plan. Consumption = mais barato mas cold start e sem VNet. Premium = custo fixo por instância pré-aquecida.'
    }
  ],

  flashcards: [
    {
      front: 'Qual serviço de compute Azure escolher para cada cenário?',
      back: '| Cenário | Serviço |\n|---------|--------|\n| Legado lift-and-shift | VMs (IaaS) |\n| Web app/API sem infra | App Service |\n| Event-driven/webhook | Azure Functions |\n| Container isolado, burst | Azure Container Instances |\n| Microserviços serverless | Azure Container Apps |\n| Kubernetes complexo | AKS |\n| HPC/processamento paralelo | Azure Batch |\n| VM autoscaling em grupo | VM Scale Sets |'
    },
    {
      front: 'Quais são os 3 planos do Azure Functions e suas diferenças?',
      back: '**Consumption Plan** (padrão):\n- Paga por execução (execução + memória)\n- Escala para zero\n- Cold start possível\n- Sem VNet integration nativa\n- Timeout: 5 min (padrão)\n\n**Premium Plan**:\n- Instâncias pré-aquecidas (sem cold start)\n- VNet integration\n- Sem timeout máximo\n- Paga por instância/hora\n\n**Dedicated (App Service) Plan**:\n- Roda no seu App Service Plan existente\n- Sem cold start\n- Sem escala automática por padrão\n- Bom para functions longas ou que já têm App Service'
    },
    {
      front: 'Quando usar VM Scale Sets vs App Service para escala horizontal?',
      back: '**VM Scale Sets (VMSS)**:\n- Controle total do OS\n- Workloads stateful que precisam de VMs\n- Processamento GPU/HPC\n- Containers em VMs customizadas\n- Spot instances para custo\n\n**App Service com autoscaling**:\n- Web apps e APIs\n- Sem gerenciar OS ou patches\n- Deploy mais simples\n- PaaS gerenciado\n\n**Regra**: se você precisa de VMs e scale automático → VMSS. Se é web/API e não quer gerenciar VMs → App Service.'
    }
  ],

  lab: {
    scenario: 'Compare diferentes opções de compute criando uma Azure Function e um App Service, entendendo as diferenças práticas.',
    objective: 'Criar Azure Function com Consumption Plan e comparar com App Service, entendendo trade-offs de custo e funcionalidade.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Azure Function App',
        instruction: 'Crie uma Function App Python no Consumption Plan.',
        hints: ['\`az functionapp create\` requer uma storage account e o plan "consumption"'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-compute-design --location eastus

# Storage Account para Functions
az storage account create \\
  --name "funcstore\${SUFFIX}" \\
  --resource-group rg-compute-design \\
  --sku Standard_LRS

# Function App no Consumption Plan (serverless)
az functionapp create \\
  --name "technova-func-\${SUFFIX}" \\
  --resource-group rg-compute-design \\
  --storage-account "funcstore\${SUFFIX}" \\
  --consumption-plan-location eastus \\
  --runtime python \\
  --runtime-version 3.11 \\
  --functions-version 4 \\
  --os-type linux

echo "Function App: technova-func-\${SUFFIX}"
echo "SUFFIX=\${SUFFIX}" > /tmp/compute-design.sh
\`\`\``,
        verify: `\`\`\`bash
source /tmp/compute-design.sh 2>/dev/null || SUFFIX=$(ls /tmp/compute-design.sh 2>/dev/null | head -1)
az functionapp list --resource-group rg-compute-design \\
  --query "[].{Nome:name,Estado:state,SKU:sku}" -o table 2>/dev/null || \\
az functionapp list --resource-group rg-compute-design -o table
\`\`\``
      },
      {
        title: 'Comparar planos disponíveis',
        instruction: 'Liste e compare os planos disponíveis para Functions e App Service na região eastus.',
        hints: ['\`az functionapp list-consumption-locations\` e \`az appservice list-locations\`'],
        solution: `\`\`\`bash
# Listar locais com suporte a Consumption Plan
echo "=== Regiões com Consumption Plan para Functions ==="
az functionapp list-consumption-locations --query "[?contains(name,'east')].name" -o tsv | head -5

# Comparar recursos de cada plano
echo "=== Comparação de Planos ==="
echo "Consumption: paga por execução, escala para 0, cold start possível"
echo "Premium: instâncias pré-aquecidas, sem cold start, VNet, custo fixo"
echo "Dedicated: usa App Service Plan existente, sem autoscale nativo"

# Ver configurações da Function App criada
SUFFIX=$(cat /tmp/compute-design.sh 2>/dev/null | grep SUFFIX | cut -d= -f2)
if [ ! -z "$SUFFIX" ]; then
  az functionapp show --name "technova-func-\${SUFFIX}" \\
    --resource-group rg-compute-design \\
    --query "{Nome:name,Runtime:siteConfig.linuxFxVersion,SKU:sku}" -o json
fi
\`\`\``,
        verify: `\`\`\`bash
echo "Comparação de planos concluída"
echo "Próximo passo: decidir entre Consumption/Premium/Dedicated baseado nos requisitos"
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-compute-design --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-compute-design 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Azure Function com cold start impactando latência de produção',
      difficulty: 'medium',
      symptom: 'Usuários reportam que as primeiras requisições após período de inatividade são muito lentas (5-10 segundos). O sistema usa Functions no Consumption Plan.',
      diagnosis: `\`\`\`bash
# Verificar plano atual da Function App
az functionapp show --name myFuncApp --resource-group myRG \\
  --query "{Plano:appServicePlanId,SKU:sku}" -o json

# Verificar Application Insights para tempos de resposta
# Portal: Application Insights → Performance → Dependency calls
# Procurar por "cold start" nas traces
\`\`\``,
      solution: `**Causa**: Cold start no Consumption Plan — quando não há requisições por um período, as instâncias são desalocadas. A próxima requisição inicia a instância do zero (cold start).

**Soluções em ordem de custo:**

1. **Migrar para Premium Plan**: instâncias pré-aquecidas eliminam cold start:
\`\`\`bash
az functionapp plan create \\
  --name funcpremiumplan --resource-group myRG \\
  --sku EP1 --location eastus --is-linux

az functionapp update --name myFuncApp --resource-group myRG \\
  --plan funcpremiumplan
\`\`\`

2. **Keep-alive com Azure Scheduler (workaround)**: timer trigger que chama a function a cada 5 minutos para manter "quente" — não elimina o cold start, apenas reduz frequência.

3. **App Service Plan (Dedicated)**: se já tem um App Service Plan, mover a Function para ele — sem cold start e sem custo adicional de compute.`
    }
  ]
};
