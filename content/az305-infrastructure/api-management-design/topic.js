window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-infrastructure/api-management-design'] = {
  theory: `# Design com Azure API Management (AZ-305)

## Relevância no Exame
> Peso estimado **10-15%** no AZ-305. APIM aparece em cenários de exposição de APIs para parceiros, rate limiting, transformação de requests e design de API gateway.

## Azure API Management — Componentes

\`\`\`
              Internet / Parceiros
                     ↓
        ┌─── Azure API Management ───┐
        │  • Rate limiting            │
        │  • Authentication (OAuth)   │
        │  • Request transformation   │
        │  • Caching                  │
        │  • Developer Portal         │
        │  • Analytics                │
        └─────────────────────────────┘
                     ↓
         Backend APIs (App Service,
         Functions, Kubernetes, on-prem)
\`\`\`

## Tiers do API Management

| Tier | Capacidade | SLA | VNet | Self-hosted Gateway |
|------|-----------|-----|------|-------------------|
| **Developer** | 1 unit, baixa perf | Sem SLA | VNet Injection | Sim |
| **Basic** | 2 units | 99.9% | External apenas | Não |
| **Standard** | 4 units | 99.9% | External/Internal | Sim |
| **Premium** | Multi-region, AZ | 99.99% | Internal/External | Sim |
| **Consumption** | Serverless, auto-scale | 99.95% | Não | Não |

**Consumption tier** = ideal para workloads serverless/Functions, paga por chamada.

## Políticas (Policies) — O Core do APIM

Políticas são XML aplicadas em 4 escopos: Global → Product → API → Operation

\`\`\`xml
<policies>
  <!-- Inbound: antes de enviar para o backend -->
  <inbound>
    <!-- Rate limiting: 100 calls/hora por assinatura -->
    <rate-limit calls="100" renewal-period="3600" />

    <!-- Autenticação JWT (Azure AD) -->
    <validate-jwt header-name="Authorization"
                  failed-validation-httpcode="401">
      <openid-config url="https://login.microsoftonline.com/TENANT/.well-known/openid-configuration" />
      <required-claims>
        <claim name="aud">
          <value>api://my-api-client-id</value>
        </claim>
      </required-claims>
    </validate-jwt>

    <!-- Cache de resposta por 60 segundos -->
    <cache-lookup vary-by-developer="false"
                  vary-by-developer-groups="false" />

    <!-- Transformação: adicionar header ao backend -->
    <set-header name="X-Forwarded-For" exists-action="append">
      <value>@(context.Request.IpAddress)</value>
    </set-header>
  </inbound>

  <!-- Backend: chamada ao serviço de destino -->
  <backend>
    <forward-request />
  </backend>

  <!-- Outbound: após receber resposta do backend -->
  <outbound>
    <cache-store duration="60" />
    <!-- Remover headers sensíveis do backend -->
    <set-header name="X-Powered-By" exists-action="delete" />
  </outbound>

  <!-- Error: em caso de erro -->
  <on-error>
    <return-response>
      <set-status code="500" reason="Internal Error" />
      <set-body>{ "error": "An error occurred" }</set-body>
    </return-response>
  </on-error>
</policies>
\`\`\`

## Padrão: APIM como API Gateway Unificado

\`\`\`bash
# Criar instância Standard
az apim create \
  --name myapim \
  --resource-group myRG \
  --publisher-email admin@example.com \
  --publisher-name "My Company" \
  --sku-name Standard

# Criar API (import de OpenAPI)
az apim api import \
  --service-name myapim \
  --resource-group myRG \
  --api-id my-api \
  --specification-format OpenApi \
  --specification-path ./openapi.yaml \
  --path "v1/api"

# Criar Product (agrupamento de APIs para plano de acesso)
az apim product create \
  --service-name myapim \
  --resource-group myRG \
  --product-id starter \
  --product-name "Starter Plan" \
  --state published \
  --subscription-required true
\`\`\`

## Padrão: Backend para On-Premises com Self-Hosted Gateway

\`\`\`yaml
# Deploy do Self-Hosted Gateway no Kubernetes (on-premises)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: apim-gateway
spec:
  replicas: 2
  selector:
    matchLabels:
      app: apim-gateway
  template:
    spec:
      containers:
        - name: apim-gateway
          image: mcr.microsoft.com/azure-api-management/gateway:2.4.0
          env:
            - name: config.service.endpoint
              value: "https://myapim.management.azure-api.net"
            - name: config.service.auth
              valueFrom:
                secretKeyRef:
                  name: apim-token
                  key: token
          ports:
            - containerPort: 8080    # HTTP
            - containerPort: 8081    # HTTPS
\`\`\`

## Erros Comuns de Design

1. **Sem rate limiting nas políticas**: expor APIs sem throttling resulta em abuso ou DDoS.
2. **Developer tier em produção**: sem SLA e sem redundância.
3. **Cache muito longo para dados mutáveis**: cache de 1 hora para preços que mudam a cada minuto.
4. **Expor backend URLs no portal**: o Developer Portal expõe informações sobre o backend — configure políticas para mascarar.
5. **Não usar Products**: sem Products, não há como controlar acesso por plano (free, paid, enterprise).

## Killer.sh Style Challenge

> Uma empresa precisa expor uma API para 3 grupos: clientes gratuitos (100 req/min), clientes pagos (1000 req/min) e parceiros internos (sem limite, autenticação por certificado). A API chama serviços on-premises.
>
> **Resposta**: APIM Premium + Self-Hosted Gateway (on-premises). 3 Products: Free (rate-limit 100/min), Paid (rate-limit 1000/min), Partners (validate-certificate + sem rate-limit). Políticas de rate-limit no escopo de cada Product. Self-Hosted Gateway deployado on-premises via Kubernetes para acessar backends internos sem VPN.
`,

  quiz: [
    {
      question: 'Em qual escopo de política APIM você aplicaria rate limiting que se aplica a TODAS as APIs, independente de produto ou operação?',
      options: [
        'Nível de Operation (operação específica)',
        'Nível de API',
        'Nível Global (All APIs)',
        'Nível de Product'
      ],
      correct: 2,
      explanation: 'As políticas do APIM têm hierarquia: Global (All APIs) → Product → API → Operation. Uma política no escopo Global se aplica a todas as chamadas. Para rate limiting universal, configure no escopo Global. Para rate limiting por plano de acesso, configure no escopo Product (cada produto pode ter limites diferentes). Políticas são acumulativas — aplica Global primeiro, depois Product, depois API, depois Operation.',
      reference: 'Seção Políticas — entenda a hierarquia de escopos: Global > Product > API > Operation.'
    },
    {
      question: 'Qual tier do Azure APIM é recomendado para APIs com tráfego muito irregular (picos imprevisíveis) que precisam escalar para zero?',
      options: [
        'Developer tier para custo baixo',
        'Consumption tier (serverless, auto-scale, paga por chamada)',
        'Standard tier com autoscaling manual',
        'Premium tier com múltiplas regiões'
      ],
      correct: 1,
      explanation: 'O Consumption tier é serverless: escala automaticamente de zero para qualquer volume, com cobrança por chamada. Ideal para APIs com tráfego imprevisível, APIs de parceiros com picos eventuais, ou APIs em desenvolvimento/teste onde o custo fixo de tiers dedicados é indesejado. Limitação: não suporta VNet injection (não acessa recursos privados).',
      reference: 'Tabela de Tiers — Consumption = serverless, paga por call. Premium = máxima disponibilidade com VNet e multi-region.'
    },
    {
      question: 'Para que serve o Self-Hosted Gateway do Azure API Management?',
      options: [
        'Para reduzir custo substituindo a instância principal do APIM na nuvem',
        'Para fazer deploy de um gateway APIM em ambientes on-premises ou outras nuvens, permitindo que APIs locais sejam gerenciadas pelo APIM na nuvem',
        'Para testes locais de políticas APIM antes de publicar em produção',
        'Para adicionar cache local ao APIM'
      ],
      correct: 1,
      explanation: 'O Self-Hosted Gateway é um container Docker/Kubernetes que pode ser deployado on-premises, em outras nuvens ou em edge locations. Ele se conecta ao APIM na nuvem para buscar configurações e políticas, mas processa as requisições localmente. Isso permite expor APIs on-premises via APIM sem VPN ou ExpressRoute, com baixa latência para usuários próximos ao gateway.',
      reference: 'Seção Self-Hosted Gateway — use quando backends estão on-premises ou em outra nuvem sem conectividade direta ao Azure.'
    }
  ],

  flashcards: [
    {
      front: 'Quais são os 4 escopos de políticas no Azure APIM e sua ordem de aplicação?',
      back: '**Hierarquia (aplicadas do mais amplo ao mais específico)**:\n\n1. **Global** (All APIs): aplica a todas as chamadas do gateway\n2. **Product**: aplica a todas as APIs em um produto\n3. **API**: aplica a todas as operações de uma API específica\n4. **Operation**: aplica a uma operação específica (GET /users, POST /orders)\n\n**Ordem de execução**: Global → Product → API → Operation (cada nível pode substituir/complementar o anterior via `<base />` tag)\n\n**Exemplo**: rate-limit no Product, JWT validation no Global, cache numa Operation específica.'
    },
    {
      front: 'Quais são as seções de uma política APIM e o que cada uma controla?',
      back: '```xml\n<policies>\n  <inbound>   <!-- Antes de enviar ao backend:\n               rate-limit, auth, transform request -->\n  </inbound>\n  <backend>   <!-- Controla chamada ao backend:\n               retry, load balancing -->\n  </backend>\n  <outbound>  <!-- Após receber do backend:\n               cache, transform response, remove headers -->\n  </outbound>\n  <on-error>  <!-- Em caso de erro:\n               custom error response -->\n  </on-error>\n</policies>\n```\n\nPrincípio: `inbound` modifica requests; `outbound` modifica responses; `on-error` trata exceções.'
    }
  ],

  lab: {
    scenario: 'Criar uma instância APIM e importar uma API com políticas de rate limiting e caching.',
    objective: 'Entender como configurar Azure API Management com políticas básicas de segurança e performance.',
    duration: '25-30 minutos (criação do APIM leva ~30 min)',
    steps: [
      {
        title: 'Criar APIM com Consumption tier (mais rápido)',
        instruction: 'Crie uma instância APIM no tier Consumption para estudo prático (criação mais rápida que Standard).',
        hints: ['Consumption tier: --sku-name Consumption', 'Criação demora ~5 minutos no Consumption'],
        solution: `\`\`\`bash
az group create --name rg-apim-lab --location eastus

az apim create \
  --name "technovaapim$(date +%s | tail -c 6)" \
  --resource-group rg-apim-lab \
  --publisher-email "admin@technova.com" \
  --publisher-name "TechNova" \
  --sku-name Consumption \
  --no-wait

echo "APIM criando em background (5-30 min dependendo do tier)"
echo "Verificar status: az apim show --name <nome> --resource-group rg-apim-lab"
\`\`\``,
        verify: `\`\`\`bash
APIM_NAME=$(az apim list --resource-group rg-apim-lab --query "[0].name" -o tsv 2>/dev/null)
if [ -n "$APIM_NAME" ]; then
  az apim show --name $APIM_NAME --resource-group rg-apim-lab \
    --query "{Name:name,Tier:sku.name,State:provisioningState}" -o table
fi
# Esperado quando pronto: Consumption, Succeeded
\`\`\``
      },
      {
        title: 'Explorar estrutura de políticas (conceitual)',
        instruction: 'Entenda a estrutura XML de políticas e explore os tipos mais comuns no portal.',
        hints: ['Portal: APIM → APIs → Select API → Design → Policies'],
        solution: `\`\`\`bash
# Política completa de exemplo (para explorar no portal)
cat << 'EOF'
<policies>
  <inbound>
    <base />
    <!-- Rate limiting: 60 chamadas por minuto por chave de assinatura -->
    <rate-limit-by-key calls="60"
                       renewal-period="60"
                       counter-key="@(context.Subscription.Id)" />

    <!-- Validar JWT do Azure AD -->
    <validate-jwt header-name="Authorization"
                  failed-validation-httpcode="401"
                  failed-validation-error-message="Unauthorized">
      <openid-config url="https://login.microsoftonline.com/TENANT_ID/v2.0/.well-known/openid-configuration"/>
      <audiences>
        <audience>api://YOUR_APP_ID</audience>
      </audiences>
    </validate-jwt>
  </inbound>

  <backend>
    <base />
  </backend>

  <outbound>
    <base />
    <!-- Cache de 30 segundos para GETs -->
    <cache-store duration="30" />
    <!-- Remover header interno -->
    <set-header name="X-Internal-Host" exists-action="delete" />
  </outbound>

  <on-error>
    <base />
  </on-error>
</policies>
EOF

echo "Para aplicar: Portal → APIM → APIs → sua API → Design → All operations → Policies"
echo "Ou: az apim api policy create --service-name \$APIM_NAME ..."
\`\`\``,
        verify: `\`\`\`bash
echo "Políticas APIM exploradas. Key learnings:"
echo "1. inbound = antes do backend (auth, rate-limit, transform)"
echo "2. outbound = após o backend (cache, remover headers)"
echo "3. on-error = tratamento de erros customizado"
echo ""
az group delete --name rg-apim-lab --yes --no-wait 2>/dev/null
echo "Limpeza iniciada"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Rate limiting não funcionando — usuário consegue fazer mais calls do que o limite',
      difficulty: 'medium',
      symptom: 'Uma política de rate-limit de 100 calls/hora foi configurada, mas um usuário consegue fazer 500 calls sem ser bloqueado.',
      diagnosis: `\`\`\`bash
# Verificar onde a política está configurada
az apim api policy show \
  --service-name myapim --resource-group myRG \
  --api-id my-api -o json

# Verificar se o produto tem políticas
# Portal: APIM → Products → Policies
\`\`\``,
      solution: `**Causas comuns**:

1. **Escopo errado**: a política está na API mas o usuário chama via um Product que não herda essa API, ou vice-versa.

2. **counter-key incorreta**: usando \`<rate-limit>\` com counter-key global em vez de por assinatura. Usar \`rate-limit-by-key\` com counter-key baseada na subscription:
\`\`\`xml
<rate-limit-by-key
  calls="100"
  renewal-period="3600"
  counter-key="@(context.Subscription.Id)" />
\`\`\`

3. **Política com \`<base />\` faltando**: sem \`<base />\`, políticas do escopo pai são ignoradas.

4. **Subscription Required = false no Product**: sem assinatura, o rate-limit por assinatura não funciona. Habilitar subscription required no Product.

5. **Developer Portal test vs produção**: testes via Developer Portal usam chave de teste que pode não estar sujeita ao rate-limit configurado.`
    }
  ]
};
