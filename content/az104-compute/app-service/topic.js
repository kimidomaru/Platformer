window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-compute/app-service'] = {
  theory: `# Azure App Service

## Relevância no Exame
> Peso estimado **8-12%** no AZ-104. Questões sobre App Service Plans, deployment slots, scaling e integração com VNet aparecem regularmente.

## Conceitos Fundamentais

### App Service
PaaS para hospedar aplicações web, APIs REST e mobile backends:
- Suporta: .NET, Node.js, Python, Java, PHP, Ruby, Docker
- Gerenciado: sem gerenciar OS, patches ou infraestrutura
- Integra com: VNet, Key Vault, Managed Identity, Deployment Slots

### App Service Plan
Define o compute (CPU/RAM) e a localização do App Service:
- Um plano pode hospedar **múltiplos App Services**
- O custo é do **plano**, não por app

| Tier | Uso | Recursos |
|------|-----|---------|
| **Free/Shared** | Dev/test | Sem SLA, resources compartilhados |
| **Basic (B)** | Dev/test | VMs dedicadas, sem autoscaling |
| **Standard (S)** | Produção | Autoscaling, deployment slots (5) |
| **Premium (P)** | Alta performance | Mais slots (20), VNet integration |
| **Isolated (I)** | Missão crítica | ASE (App Service Environment), VNet dedicada |

### Deployment Slots
Ambientes separados dentro do mesmo App Service (staging, QA, etc.):
- Cada slot é uma URL separada (ex: \`myapp-staging.azurewebsites.net\`)
- **Swap**: troca produção ↔ staging com zero downtime (aquece a instância antes)
- Configurações podem ser "slot settings" (não são trocadas no swap) ou normais (trocadas)
- Requer tier Standard ou superior

### Scaling
**Scale Up**: aumentar tamanho do App Service Plan (mais CPU/RAM)
**Scale Out**: aumentar número de instâncias (horizontal)
- **Manual**: definir número fixo de instâncias
- **Autoscaling**: regras baseadas em CPU, memória, métricas custom

### Networking Integration
- **Outbound — VNet Integration**: App Service acessa recursos na VNet (bancos de dados privados)
- **Inbound — Private Endpoint**: expõe o App Service apenas dentro da VNet (sem acesso público)
- **Inbound — App Service Environment (ASE)**: App Service completamente dentro de uma VNet

### Custom Domain & SSL
\`\`\`bash
# Adicionar custom domain
az webapp config hostname add \\
  --webapp-name myApp \\
  --resource-group myRG \\
  --hostname www.contoso.com

# Fazer bind de certificado SSL
az webapp config ssl bind \\
  --name myApp \\
  --resource-group myRG \\
  --certificate-thumbprint <thumbprint> \\
  --ssl-type SNI
\`\`\`

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Criar App Service Plan Standard
az appservice plan create \\
  --name myAppPlan \\
  --resource-group myRG \\
  --sku S1 \\
  --is-linux

# Criar Web App
az webapp create \\
  --name myWebApp \\
  --resource-group myRG \\
  --plan myAppPlan \\
  --runtime "PYTHON:3.11"

# Listar runtimes disponíveis
az webapp list-runtimes --os-type linux

# Deploy via ZIP
az webapp deployment source config-zip \\
  --name myWebApp \\
  --resource-group myRG \\
  --src ./app.zip

# Criar deployment slot
az webapp deployment slot create \\
  --name myWebApp \\
  --resource-group myRG \\
  --slot staging

# Fazer swap production ↔ staging
az webapp deployment slot swap \\
  --name myWebApp \\
  --resource-group myRG \\
  --slot staging \\
  --target-slot production

# Configurar variável de ambiente
az webapp config appsettings set \\
  --name myWebApp \\
  --resource-group myRG \\
  --settings DATABASE_URL="postgresql://..." ENVIRONMENT="production"

# Configurar autoscaling
az monitor autoscale create \\
  --resource-group myRG \\
  --resource <app-service-plan-resource-id> \\
  --min-count 1 --max-count 5 --count 2

# Habilitar VNet Integration
az webapp vnet-integration add \\
  --name myWebApp \\
  --resource-group myRG \\
  --vnet myVNet \\
  --subnet IntegrationSubnet

# Ver logs em tempo real
az webapp log tail --name myWebApp --resource-group myRG
\`\`\`

## Erros Comuns

1. **Slot swap não funciona como esperado**: verificar se as app settings críticas são "slot settings" (não movem) ou configurações normais (movem com o swap).
2. **Autoscaling não está no tier certo**: autoscaling requer Standard ou superior — não funciona no Basic.
3. **VNet Integration não resolve nomes privados**: verificar configuração de DNS e se o App Plan suporta regional VNet integration.
4. **Always On desabilitado**: para Free/Shared tier, a app pode "adormecer" após inatividade — habilitar "Always On" no Standard+.

## Killer.sh Style Challenge

> Você tem uma aplicação web em produção e precisa fazer um deploy de nova versão sem downtime. A nova versão precisa ser testada antes de ir para produção. Descreva o processo usando Deployment Slots.
>
> **Resposta**: 1) Criar slot "staging" (requer S1+). 2) Deploy da nova versão no slot staging. 3) Testar em staging.azurewebsites.net. 4) Se aprovado: \`az webapp deployment slot swap --slot staging\` — troca staging ↔ production instantaneamente. Se problema: fazer swap de volta (a versão anterior está no slot staging após o swap).
`,

  quiz: [
    {
      question: 'Um App Service precisa de autoscaling baseado em CPU. Qual tier mínimo do App Service Plan é necessário?',
      options: [
        'Basic (B)',
        'Standard (S)',
        'Free',
        'Shared'
      ],
      correct: 1,
      explanation: 'Autoscaling requer tier Standard (S) ou superior. Basic tier suporta scale up/out manual mas não autoscaling baseado em métricas. Free e Shared são compartilhados e não suportam scaling.',
      reference: 'Memorize: Deployment Slots e Autoscaling = Standard+. Basic = escala manual apenas.'
    },
    {
      question: 'O que acontece com configurações de App Settings durante um Deployment Slot Swap?',
      options: [
        'Todas as configurações são sempre trocadas junto com o código',
        'Configurações marcadas como "slot settings" ficam no slot; configurações normais são trocadas junto com o deployment',
        'Nenhuma configuração é trocada — apenas o código é movido',
        'Configurações são duplicadas em ambos os slots após o swap'
      ],
      correct: 1,
      explanation: 'Durante um swap, configurações "normais" (não slot-specific) são trocadas junto com o código. Configurações marcadas como "slot settings" ficam ancoradas ao slot onde estão (ex: connection string de staging fica em staging mesmo após o swap). Isso permite que staging continue apontando para o DB de staging enquanto produção aponta para DB de produção.',
      reference: 'Use "slot settings" para connection strings e configurações que devem ser diferentes em cada ambiente.'
    },
    {
      question: 'Quantos deployment slots um App Service Plan Standard suporta?',
      options: [
        '1 (apenas produção)',
        '5 (incluindo produção)',
        '20',
        'Ilimitados'
      ],
      correct: 1,
      explanation: 'App Service Plan Standard suporta até 5 deployment slots (incluindo o slot de produção), ou seja, 4 slots adicionais como staging, QA, etc. Premium suporta até 20 slots.',
      reference: 'Standard = 5 slots total. Premium = 20 slots. Basic = sem slots.'
    }
  ],

  flashcards: [
    {
      front: 'O que é um App Service Plan e qual sua relação com os App Services?',
      back: '**App Service Plan** define o compute (CPU, RAM, capacidade) e região para apps.\n\n- Um plano pode hospedar **vários App Services** (compartilham recursos)\n- O custo é cobrado pelo **plano**, não por app\n- Mudar plano = mudar compute de todos os apps no plano\n\nTiers: Free/Shared (compartilhado) → Basic → Standard → Premium → Isolated (ASE)'
    },
    {
      front: 'Como funciona o Deployment Slot Swap e por que ele tem zero downtime?',
      back: '**Antes do swap**, Azure:\n1. Aquece o slot de staging (inicia instâncias, carrega config, faz warmup requests)\n2. Aguarda resposta saudável\n\n**No swap**: troca os roteamentos de tráfego instantaneamente (DNS interno)\n- Produção passa a apontar para o que era staging\n- Staging passa a apontar para o que era produção\n\n**Resultado**: zero downtime pois o novo código já estava "quente" antes do swap. Se der problema: fazer swap de volta.'
    },
    {
      front: 'Qual a diferença entre VNet Integration e Private Endpoint no App Service?',
      back: '**VNet Integration** (outbound):\n- App Service FAZ chamadas para recursos dentro da VNet\n- Ex: app → banco de dados privado na VNet\n- Fluxo: tráfego SAINDO do App Service vai pela VNet\n\n**Private Endpoint** (inbound):\n- App Service RECEBE tráfego apenas de dentro da VNet\n- Remove o acesso público ao app\n- Ex: App Service acessível apenas por VMs/serviços dentro da VNet\n\nPodem ser usados juntos para apps completamente privados.'
    }
  ],

  lab: {
    scenario: 'Deploy uma aplicação web simples no Azure App Service e configure um deployment slot para staging.',
    objective: 'Criar App Service Plan Standard, Web App, deployment slot e fazer um swap.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar App Service Plan e Web App',
        instruction: 'Crie um App Service Plan S1 Linux e uma Web App Python.',
        hints: ['\`az appservice plan create --sku S1 --is-linux\`'],
        solution: `\`\`\`bash
az group create --name rg-appservice-lab --location eastus

az appservice plan create \\
  --name technova-plan \\
  --resource-group rg-appservice-lab \\
  --sku S1 \\
  --is-linux

az webapp create \\
  --name technova-app-$(date +%s | tail -c 5) \\
  --resource-group rg-appservice-lab \\
  --plan technova-plan \\
  --runtime "PYTHON:3.11"

APP_NAME=$(az webapp list --resource-group rg-appservice-lab --query "[0].name" -o tsv)
echo "App criada: $APP_NAME"
echo "URL: https://\${APP_NAME}.azurewebsites.net"
\`\`\``,
        verify: `\`\`\`bash
APP_NAME=$(az webapp list --resource-group rg-appservice-lab --query "[0].name" -o tsv)
az webapp show --name $APP_NAME --resource-group rg-appservice-lab \\
  --query "{Nome:name,Estado:state,URL:defaultHostName}" -o table
\`\`\``
      },
      {
        title: 'Criar deployment slot de staging',
        instruction: 'Crie um slot chamado "staging" na Web App.',
        hints: ['\`az webapp deployment slot create\`'],
        solution: `\`\`\`bash
APP_NAME=$(az webapp list --resource-group rg-appservice-lab --query "[0].name" -o tsv)
az webapp deployment slot create \\
  --name $APP_NAME \\
  --resource-group rg-appservice-lab \\
  --slot staging

echo "Slot staging criado: https://\${APP_NAME}-staging.azurewebsites.net"
\`\`\``,
        verify: `\`\`\`bash
APP_NAME=$(az webapp list --resource-group rg-appservice-lab --query "[0].name" -o tsv)
az webapp deployment slot list \\
  --name $APP_NAME --resource-group rg-appservice-lab \\
  --query "[].{Slot:name,Estado:state}" -o table
# Saída esperada: staging | Running
\`\`\``
      },
      {
        title: 'Configurar App Settings e fazer Swap',
        instruction: 'Adicione uma App Setting "ENVIRONMENT=staging" ao slot staging e depois faça o swap com produção.',
        hints: ['\`az webapp config appsettings set --slot staging\`'],
        solution: `\`\`\`bash
APP_NAME=$(az webapp list --resource-group rg-appservice-lab --query "[0].name" -o tsv)

# Configurar app setting no slot staging
az webapp config appsettings set \\
  --name $APP_NAME \\
  --resource-group rg-appservice-lab \\
  --slot staging \\
  --settings ENVIRONMENT="staging" VERSION="2.0"

# Fazer swap staging → production
az webapp deployment slot swap \\
  --name $APP_NAME \\
  --resource-group rg-appservice-lab \\
  --slot staging \\
  --target-slot production

echo "Swap concluído!"
\`\`\``,
        verify: `\`\`\`bash
APP_NAME=$(az webapp list --resource-group rg-appservice-lab --query "[0].name" -o tsv)
# Após swap, produção deve ter as configs do staging (exceto slot settings)
az webapp config appsettings list \\
  --name $APP_NAME --resource-group rg-appservice-lab \\
  --query "[?name=='ENVIRONMENT'].value" -o tsv
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-appservice-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-appservice-lab 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'App Service retorna erro 503 Service Unavailable',
      difficulty: 'easy',
      symptom: 'Uma Web App retorna 503 Service Unavailable após um novo deploy.',
      diagnosis: `\`\`\`bash
# Verificar status da app
az webapp show --name myApp --resource-group myRG --query "state" -o tsv

# Ver logs de aplicação
az webapp log tail --name myApp --resource-group myRG

# Verificar configurações do app (error pode ser de variável faltando)
az webapp config appsettings list --name myApp --resource-group myRG -o table
\`\`\``,
      solution: `**Causas comuns:**

1. **Aplicação travando na inicialização**: verificar os logs — pode ser erro de import, variável de ambiente faltando, ou erro de dependência.

2. **App Setting faltando**: se um swap foi feito e uma configuração crítica estava como slot setting no staging (ficou para trás).

3. **Restart necessário**: \`az webapp restart --name myApp --resource-group myRG\`

4. **Insufficient resources**: se o App Service Plan está sobrecarregado (Basic com muitas apps), fazer scale up.

5. **Deploy incompleto**: verificar \`az webapp deployment list\` para ver se o último deploy foi bem-sucedido.`
    }
  ]
};
