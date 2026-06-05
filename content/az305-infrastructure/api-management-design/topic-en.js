window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-infrastructure/api-management-design'] = {
  theory: `# Azure API Management Design (AZ-305)

## Exam Relevance
> Estimated weight **10-15%** in AZ-305. APIM appears in scenarios about exposing APIs to partners, rate limiting, request transformation, and API gateway design.

## Azure API Management — Components

\`\`\`
              Internet / Partners
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

## API Management Tiers

| Tier | Capacity | SLA | VNet | Self-hosted Gateway |
|------|---------|-----|------|-------------------|
| **Developer** | 1 unit, low perf | No SLA | VNet Injection | Yes |
| **Basic** | 2 units | 99.9% | External only | No |
| **Standard** | 4 units | 99.9% | External/Internal | Yes |
| **Premium** | Multi-region, AZ | 99.99% | Internal/External | Yes |
| **Consumption** | Serverless, auto-scale | 99.95% | No | No |

**Consumption tier** = ideal for serverless/Functions workloads, pay per call.

## Policies — The Core of APIM

Policies are XML applied at 4 scopes: Global → Product → API → Operation

\`\`\`xml
<policies>
  <!-- Inbound: before sending to the backend -->
  <inbound>
    <!-- Rate limiting: 100 calls/hour per subscription -->
    <rate-limit calls="100" renewal-period="3600" />

    <!-- JWT authentication (Azure AD) -->
    <validate-jwt header-name="Authorization"
                  failed-validation-httpcode="401">
      <openid-config url="https://login.microsoftonline.com/TENANT/.well-known/openid-configuration" />
      <required-claims>
        <claim name="aud">
          <value>api://my-api-client-id</value>
        </claim>
      </required-claims>
    </validate-jwt>

    <!-- Cache response for 60 seconds -->
    <cache-lookup vary-by-developer="false"
                  vary-by-developer-groups="false" />

    <!-- Transform: add header to backend -->
    <set-header name="X-Forwarded-For" exists-action="append">
      <value>@(context.Request.IpAddress)</value>
    </set-header>
  </inbound>

  <!-- Backend: call to the destination service -->
  <backend>
    <forward-request />
  </backend>

  <!-- Outbound: after receiving response from backend -->
  <outbound>
    <cache-store duration="60" />
    <!-- Remove sensitive backend headers -->
    <set-header name="X-Powered-By" exists-action="delete" />
  </outbound>

  <!-- Error: in case of error -->
  <on-error>
    <return-response>
      <set-status code="500" reason="Internal Error" />
      <set-body>{ "error": "An error occurred" }</set-body>
    </return-response>
  </on-error>
</policies>
\`\`\`

## Pattern: APIM as Unified API Gateway

\`\`\`bash
# Create Standard instance
az apim create \
  --name myapim \
  --resource-group myRG \
  --publisher-email admin@example.com \
  --publisher-name "My Company" \
  --sku-name Standard

# Create API (import from OpenAPI)
az apim api import \
  --service-name myapim \
  --resource-group myRG \
  --api-id my-api \
  --specification-format OpenApi \
  --specification-path ./openapi.yaml \
  --path "v1/api"

# Create Product (API grouping for access plan)
az apim product create \
  --service-name myapim \
  --resource-group myRG \
  --product-id starter \
  --product-name "Starter Plan" \
  --state published \
  --subscription-required true
\`\`\`

## Pattern: Backend for On-Premises with Self-Hosted Gateway

\`\`\`yaml
# Deploy Self-Hosted Gateway on Kubernetes (on-premises)
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

## Common Design Mistakes

1. **No rate limiting in policies**: exposing APIs without throttling results in abuse or DDoS.
2. **Developer tier in production**: no SLA and no redundancy.
3. **Cache too long for mutable data**: 1-hour cache for prices that change every minute.
4. **Exposing backend URLs in the portal**: the Developer Portal exposes information about the backend — configure policies to mask it.
5. **Not using Products**: without Products, there is no way to control access by plan (free, paid, enterprise).

## Killer.sh Style Challenge

> A company needs to expose an API to 3 groups: free customers (100 req/min), paid customers (1000 req/min), and internal partners (no limit, certificate authentication). The API calls on-premises services.
>
> **Answer**: APIM Premium + Self-Hosted Gateway (on-premises). 3 Products: Free (rate-limit 100/min), Paid (rate-limit 1000/min), Partners (validate-certificate + no rate-limit). Rate-limit policies at each Product scope. Self-Hosted Gateway deployed on-premises via Kubernetes to access internal backends without VPN.
`,

  quiz: [
    {
      question: 'At which APIM policy scope would you apply rate limiting that applies to ALL APIs, regardless of product or operation?',
      options: [
        'Operation level (specific operation)',
        'API level',
        'Global level (All APIs)',
        'Product level'
      ],
      correct: 2,
      explanation: 'APIM policies have a hierarchy: Global (All APIs) → Product → API → Operation. A policy at the Global scope applies to all calls. For universal rate limiting, configure at Global scope. For rate limiting by access plan, configure at Product scope (each product can have different limits). Policies are cumulative — Global is applied first, then Product, then API, then Operation.',
      reference: 'Policies section — understand the scope hierarchy: Global > Product > API > Operation.'
    },
    {
      question: 'Which Azure APIM tier is recommended for APIs with very irregular traffic (unpredictable peaks) that need to scale to zero?',
      options: [
        'Developer tier for low cost',
        'Consumption tier (serverless, auto-scale, pay per call)',
        'Standard tier with manual autoscaling',
        'Premium tier with multiple regions'
      ],
      correct: 1,
      explanation: 'The Consumption tier is serverless: it scales automatically from zero to any volume, with per-call billing. Ideal for APIs with unpredictable traffic, partner APIs with occasional spikes, or APIs under development/testing where the fixed cost of dedicated tiers is undesirable. Limitation: does not support VNet injection (cannot access private resources).',
      reference: 'Tiers table — Consumption = serverless, pay per call. Premium = maximum availability with VNet and multi-region.'
    },
    {
      question: 'What is the Self-Hosted Gateway of Azure API Management used for?',
      options: [
        'To reduce cost by replacing the main APIM instance in the cloud',
        'To deploy an APIM gateway in on-premises environments or other clouds, allowing local APIs to be managed by APIM in the cloud',
        'For local testing of APIM policies before publishing to production',
        'To add local cache to APIM'
      ],
      correct: 1,
      explanation: 'The Self-Hosted Gateway is a Docker/Kubernetes container that can be deployed on-premises, in other clouds, or in edge locations. It connects to APIM in the cloud to fetch configurations and policies, but processes requests locally. This allows exposing on-premises APIs via APIM without VPN or ExpressRoute, with low latency for users near the gateway.',
      reference: 'Self-Hosted Gateway section — use when backends are on-premises or in another cloud without direct Azure connectivity.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 4 policy scopes in Azure APIM and their order of application?',
      back: '**Hierarchy (applied from broadest to most specific)**:\n\n1. **Global** (All APIs): applies to all gateway calls\n2. **Product**: applies to all APIs in a product\n3. **API**: applies to all operations of a specific API\n4. **Operation**: applies to a specific operation (GET /users, POST /orders)\n\n**Execution order**: Global → Product → API → Operation (each level can replace/complement the previous via `<base />` tag)\n\n**Example**: rate-limit at Product, JWT validation at Global, cache at a specific Operation.'
    },
    {
      front: 'What are the sections of an APIM policy and what does each control?',
      back: '```xml\n<policies>\n  <inbound>   <!-- Before sending to backend:\n               rate-limit, auth, transform request -->\n  </inbound>\n  <backend>   <!-- Controls call to backend:\n               retry, load balancing -->\n  </backend>\n  <outbound>  <!-- After receiving from backend:\n               cache, transform response, remove headers -->\n  </outbound>\n  <on-error>  <!-- In case of error:\n               custom error response -->\n  </on-error>\n</policies>\n```\n\nPrinciple: `inbound` modifies requests; `outbound` modifies responses; `on-error` handles exceptions.'
    }
  ],

  lab: {
    scenario: 'Create an APIM instance and import an API with rate limiting and caching policies.',
    objective: 'Understand how to configure Azure API Management with basic security and performance policies.',
    duration: '25-30 minutes (APIM creation takes ~30 min)',
    steps: [
      {
        title: 'Create APIM with Consumption tier (fastest)',
        instruction: 'Create an APIM instance in the Consumption tier for hands-on study (faster creation than Standard).',
        hints: ['Consumption tier: --sku-name Consumption', 'Creation takes ~5 minutes in Consumption'],
        solution: `\`\`\`bash
az group create --name rg-apim-lab --location eastus

az apim create \
  --name "technovaapim$(date +%s | tail -c 6)" \
  --resource-group rg-apim-lab \
  --publisher-email "admin@technova.com" \
  --publisher-name "TechNova" \
  --sku-name Consumption \
  --no-wait

echo "APIM creating in background (5-30 min depending on tier)"
echo "Check status: az apim show --name <name> --resource-group rg-apim-lab"
\`\`\``,
        verify: `\`\`\`bash
APIM_NAME=$(az apim list --resource-group rg-apim-lab --query "[0].name" -o tsv 2>/dev/null)
if [ -n "$APIM_NAME" ]; then
  az apim show --name $APIM_NAME --resource-group rg-apim-lab \
    --query "{Name:name,Tier:sku.name,State:provisioningState}" -o table
fi
# Expected when ready: Consumption, Succeeded
\`\`\``
      },
      {
        title: 'Explore policy structure (conceptual)',
        instruction: 'Understand the XML structure of policies and explore the most common types in the portal.',
        hints: ['Portal: APIM → APIs → Select API → Design → Policies'],
        solution: `\`\`\`bash
# Complete example policy (to explore in the portal)
cat << 'EOF'
<policies>
  <inbound>
    <base />
    <!-- Rate limiting: 60 calls per minute per subscription key -->
    <rate-limit-by-key calls="60"
                       renewal-period="60"
                       counter-key="@(context.Subscription.Id)" />

    <!-- Validate JWT from Azure AD -->
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
    <!-- 30-second cache for GETs -->
    <cache-store duration="30" />
    <!-- Remove internal header -->
    <set-header name="X-Internal-Host" exists-action="delete" />
  </outbound>

  <on-error>
    <base />
  </on-error>
</policies>
EOF

echo "To apply: Portal → APIM → APIs → your API → Design → All operations → Policies"
echo "Or: az apim api policy create --service-name \$APIM_NAME ..."
\`\`\``,
        verify: `\`\`\`bash
echo "APIM policies explored. Key learnings:"
echo "1. inbound = before backend (auth, rate-limit, transform)"
echo "2. outbound = after backend (cache, remove headers)"
echo "3. on-error = custom error handling"
echo ""
az group delete --name rg-apim-lab --yes --no-wait 2>/dev/null
echo "Cleanup started"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Rate limiting not working — user can make more calls than the limit',
      difficulty: 'medium',
      symptom: 'A rate-limit policy of 100 calls/hour was configured, but a user can make 500 calls without being blocked.',
      diagnosis: `\`\`\`bash
# Check where the policy is configured
az apim api policy show \
  --service-name myapim --resource-group myRG \
  --api-id my-api -o json

# Check if the product has policies
# Portal: APIM → Products → Policies
\`\`\``,
      solution: `**Common causes**:

1. **Wrong scope**: the policy is on the API but the user calls via a Product that does not inherit that API, or vice versa.

2. **Incorrect counter-key**: using \`<rate-limit>\` with a global counter-key instead of per subscription. Use \`rate-limit-by-key\` with counter-key based on subscription:
\`\`\`xml
<rate-limit-by-key
  calls="100"
  renewal-period="3600"
  counter-key="@(context.Subscription.Id)" />
\`\`\`

3. **Policy missing \`<base />\`**: without \`<base />\`, parent scope policies are ignored.

4. **Subscription Required = false on the Product**: without a subscription, per-subscription rate-limiting does not work. Enable subscription required on the Product.

5. **Developer Portal test vs production**: tests via Developer Portal use a test key that may not be subject to the configured rate-limit.`
    }
  ]
};
