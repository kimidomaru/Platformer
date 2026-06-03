window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kong/kong-plugins'] = {
  theory: `
# Kong: Plugins e Controle de Trafego

## Relevancia
O ecossistema de plugins e o diferencial do Kong — mais de 50 plugins oficiais e centenas da comunidade cobrem casos de uso como autenticacao, transformacao de requests, cache, observabilidade e seguranca. Entender como configurar e encadear plugins e essencial para construir um API Gateway robusto no Kubernetes.

## Conceitos Fundamentais

### Categorias de Plugins Kong

\`\`\`
Authentication    — key-auth, jwt, oauth2, basic-auth, hmac-auth, ldap-auth
Security          — bot-detection, cors, ip-restriction, acl
Traffic Control   — rate-limiting, request-size-limiting, response-ratelimiting
Transformations   — request-transformer, response-transformer, correlation-id
Serverless        — aws-lambda, openwhisk, azure-functions
Analytics         — prometheus, datadog, opentelemetry, file-log, http-log
\`\`\`

### Rate Limiting — Configuracoes Avancadas

\`\`\`yaml
# Rate limiting com diferentes janelas de tempo
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: advanced-rate-limit
  namespace: default
plugin: rate-limiting
config:
  second: 10          # Max 10 req/segundo
  minute: 100         # Max 100 req/minuto
  hour: 1000          # Max 1000 req/hora
  limit_by: consumer  # ip | consumer | credential | service | header | path
  policy: redis       # local | redis | cluster (redis e mais preciso em multi-pod)
  redis_host: redis.default.svc.cluster.local
  redis_port: 6379
  error_code: 429
  error_message: "Rate limit exceeded. Please try again later."
  hide_client_headers: false  # Expor headers RateLimit-*
\`\`\`

\`\`\`yaml
# Rate limiting por Consumer (limite personalizado por usuario)
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: consumer-rate-limit
plugin: rate-limiting
config:
  minute: 1000        # Limite padrao (sobrescrito por consumer)
  limit_by: consumer
  policy: local
\`\`\`

### CORS — Cross-Origin Resource Sharing

\`\`\`yaml
# Plugin CORS para APIs consumidas por browsers
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: cors-policy
  namespace: default
plugin: cors
config:
  origins:
    - "https://app.example.com"
    - "https://admin.example.com"
  methods:
    - GET
    - POST
    - PUT
    - DELETE
    - OPTIONS
  headers:
    - Accept
    - Authorization
    - Content-Type
    - X-Request-ID
  exposed_headers:
    - X-Auth-Token
    - X-Request-ID
  credentials: true             # Permitir cookies/auth headers cross-origin
  max_age: 3600                 # Cache de preflight em segundos
  preflight_continue: false     # Interceptar OPTIONS (nao passar para backend)
\`\`\`

### Request Transformer — Modificar Requests

\`\`\`yaml
# Adicionar, remover e renomear headers/query params
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: add-headers
  namespace: default
plugin: request-transformer
config:
  add:
    headers:
      - "X-Custom-Header:my-value"
      - "X-Forwarded-For:$(remote_addr)"  # Variavel dinamica
    querystring:
      - "api_version:v2"
  remove:
    headers:
      - "X-Internal-Token"       # Remover header sensivel antes de encaminhar
      - "Cookie"                  # Remover cookies
  replace:
    headers:
      - "Host:api.example.com"   # Substituir o header Host
  rename:
    headers:
      - "Old-Header:New-Header"  # Renomear header
\`\`\`

### Response Transformer — Modificar Responses

\`\`\`yaml
# Modificar headers e body da resposta
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: response-headers
  namespace: default
plugin: response-transformer
config:
  add:
    headers:
      - "X-Kong-Proxy:true"
      - "Strict-Transport-Security:max-age=31536000; includeSubDomains"
      - "X-Content-Type-Options:nosniff"
  remove:
    headers:
      - "X-Powered-By"          # Remover header que expoe tecnologia
      - "Server"                 # Ocultar versao do servidor
\`\`\`

### IP Restriction — Controle de Acesso por IP

\`\`\`yaml
# Bloquear ou permitir IPs especificos
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: ip-allowlist
  namespace: default
plugin: ip-restriction
config:
  allow:
    - "10.0.0.0/8"              # Rede interna
    - "192.168.1.100"           # IP especifico
  deny: []                       # Se allow for definido, deny e ignorado
---
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: ip-denylist
  namespace: default
plugin: ip-restriction
config:
  deny:
    - "203.0.113.0/24"          # Bloquear range suspeito
\`\`\`

### JWT Authentication

\`\`\`yaml
# Plugin JWT — validar tokens JWT
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: jwt-auth
  namespace: default
plugin: jwt
config:
  key_claim_name: iss            # Claim que identifica o consumer (issuer)
  claims_to_verify:
    - exp                        # Verificar expiracao
    - nbf                        # Verificar not-before
  header_names:
    - Authorization              # Header onde buscar o token
  uri_param_names:
    - jwt                        # Ou via query param ?jwt=...
  cookie_names: []               # Ou via cookie
  secret_is_base64: false
\`\`\`

\`\`\`yaml
# Secret com credenciais JWT do consumer
apiVersion: v1
kind: Secret
metadata:
  name: bob-jwt-cred
  namespace: default
  labels:
    konghq.com/credential: jwt
stringData:
  key: "bob-issuer"              # Valor do claim "iss" no JWT
  algorithm: HS256               # Algoritmo de assinatura
  secret: "my-jwt-secret-key"   # Chave para validar a assinatura HMAC
---
apiVersion: configuration.konghq.com/v1
kind: KongConsumer
metadata:
  name: bob
  annotations:
    kubernetes.io/ingress.class: kong
username: bob
credentials:
  - bob-jwt-cred
\`\`\`

### ACL — Controle de Acesso por Grupo

\`\`\`yaml
# Criar grupos de acesso
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: acl-admin-only
  namespace: default
plugin: acl
config:
  allow:
    - admin                      # Apenas consumers no grupo "admin"
  deny: []
  hide_groups_header: true       # Nao expor X-Consumer-Groups ao backend
---
# Adicionar consumer ao grupo via Secret
apiVersion: v1
kind: Secret
metadata:
  name: alice-acl
  namespace: default
  labels:
    konghq.com/credential: acl
stringData:
  group: admin                   # Grupo do consumer
---
apiVersion: configuration.konghq.com/v1
kind: KongConsumer
metadata:
  name: alice
  annotations:
    kubernetes.io/ingress.class: kong
username: alice
credentials:
  - alice-api-key
  - alice-acl                    # Multiplas credenciais permitidas
\`\`\`

### Proxy Cache — Cache de Respostas

\`\`\`yaml
# Cache de respostas GET/HEAD
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: proxy-cache
  namespace: default
plugin: proxy-cache
config:
  response_code:
    - 200
    - 301
    - 302
  request_method:
    - GET
    - HEAD
  content_type:
    - "application/json"
    - "text/plain"
  cache_ttl: 300                 # TTL em segundos (5 minutos)
  strategy: memory               # memory | redis
  memory:
    dictionary_name: kong_db_cache
\`\`\`

### Correlation ID — Rastreamento de Requests

\`\`\`yaml
# Adicionar ID unico a cada request para rastreamento distribuido
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: correlation-id
  namespace: default
plugin: correlation-id
config:
  header_name: X-Request-ID
  generator: uuid               # uuid | uuid#counter | tracker
  echo_downstream: true         # Retornar o ID na resposta
\`\`\`

### Encadeamento de Plugins

\`\`\`yaml
# Multiplos plugins em um Ingress — executados em ordem de prioridade
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secure-api
  annotations:
    konghq.com/plugins: "cors-policy,jwt-auth,acl-admin-only,rate-limit-5rpm,correlation-id"
    # Ordem de execucao e definida pela prioridade do plugin no Kong, nao pela ordem da annotation
spec:
  ingressClassName: kong
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /admin
            pathType: Prefix
            backend:
              service:
                name: admin-service
                port:
                  number: 8080
\`\`\`

### KongConsumerGroup — Configuracoes por Grupo

\`\`\`yaml
# Grupo de consumers com rate limit customizado
apiVersion: configuration.konghq.com/v1beta1
kind: KongConsumerGroup
metadata:
  name: premium-tier
  namespace: default
  annotations:
    kubernetes.io/ingress.class: kong
---
# Plugin com override por consumer group
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: premium-rate-limit
  namespace: default
  annotations:
    konghq.com/consumer-group: premium-tier  # Aplica ao grupo
plugin: rate-limiting
config:
  minute: 10000        # Limite premium muito maior
  limit_by: consumer
\`\`\`

### Erros Comuns

1. **Plugin redis nao conecta** — Verificar redis_host, redis_port e se o Redis esta acessivel no cluster
2. **JWT invalido** — O claim "iss" do token deve corresponder ao "key" do Secret de credencial JWT
3. **ACL 403 inesperado** — Verificar se o consumer tem o grupo correto via Secret com label konghq.com/credential: acl
4. **CORS preflight falha** — OPTIONS deve ser listado em config.methods; preflight_continue: false e necessario
5. **Response transformer remove header que nao existe** — Nao causa erro, apenas e ignorado

## Killer.sh Style Challenge

> **Cenario:** Configure uma rota /api/v2 com: (1) autenticacao JWT com verificacao de expiracao; (2) apenas consumers no grupo "premium" permitidos via ACL; (3) CORS para https://app.example.com; (4) response transformer adicionando header "X-API-Version: v2"; (5) log das requisicoes via http-log para http://log-service/collect.
`,
  quiz: [
    {
      question: 'Qual a diferenca entre as policies "local", "cluster" e "redis" no plugin rate-limiting?',
      options: [
        'Sao identicas em comportamento',
        '"local" conta por pod Kong (impreciso em multi-pod); "redis" usa Redis como store centralizado (preciso em multi-pod); "cluster" usa a DB do Kong (apenas modo DB-backed)',
        '"redis" e mais lento que "local"',
        '"cluster" e a opcao padrao e recomendada'
      ],
      correct: 1,
      explanation: 'Em deployments com multiplas replicas do Kong: "local" conta por instancia (cada pod tem seu proprio contador — pode deixar 3x o limite passar em 3 replicas). "redis" usa um Redis centralizado para contar requisicoes de todos os pods — unico que garante o limite global. "cluster" funciona com PostgreSQL (modo DB-backed).',
      reference: 'Conceito relacionado: Para producao com rate-limiting preciso, instalar Redis junto com o Kong e usar policy: redis.'
    },
    {
      question: 'Como o plugin ACL funciona em conjunto com autenticacao no Kong?',
      options: [
        'ACL funciona sem autenticacao — bloqueia por IP',
        'ACL requer um plugin de autenticacao ativo na mesma rota — verifica se o consumer autenticado pertence ao grupo permitido/negado',
        'ACL substitui a autenticacao',
        'ACL so funciona com o plugin key-auth'
      ],
      correct: 1,
      explanation: 'ACL depende de autenticacao: primeiro o plugin de auth identifica o consumer, depois o ACL verifica se o consumer esta no grupo allow/deny. Sem autenticacao ativa, o Kong nao sabe quem e o consumer e o ACL retorna 403. Fluxo: request → auth (identifica consumer) → acl (verifica grupo) → backend.',
      reference: 'Conceito relacionado: Um consumer pode ter multiplas credenciais (key-auth + acl) configuradas via multiplos Secrets referenciados no KongConsumer.'
    },
    {
      question: 'Como o Request Transformer pode remover headers sensiveis antes de encaminhar ao backend?',
      options: [
        'Nao e possivel remover headers com o Request Transformer',
        'Usando config.remove.headers com a lista de headers a remover — o Kong remove esses headers do request antes de encaminhar ao servico',
        'Criando uma regra de firewall no Kong',
        'Usando o plugin response-transformer no sentido inverso'
      ],
      correct: 1,
      explanation: 'O request-transformer com config.remove.headers remove headers do request ANTES de encaminhar ao backend. Util para: remover X-Internal-Token (credenciais internas), remover Cookie (privacidade), ou remover qualquer header que o backend nao deve receber. O plugin pode tambem adicionar, substituir e renomear headers.',
      reference: 'Conceito relacionado: O plugin key-auth tem config.hide_credentials: true que remove automaticamente o header da API Key antes de encaminhar ao backend.'
    },
    {
      question: 'O que acontece quando varios plugins sao listados na annotation konghq.com/plugins?',
      options: [
        'Apenas o primeiro plugin e aplicado',
        'Os plugins sao executados em paralelo',
        'Os plugins sao executados em ordem de prioridade interna do Kong (cada plugin tem um numero de prioridade definido)',
        'A ordem na annotation define a ordem de execucao'
      ],
      correct: 2,
      explanation: 'A ordem de execucao dos plugins no Kong e definida pela prioridade de cada plugin (numero interno), nao pela ordem na annotation. Por exemplo, cors (priority 2000) executa antes de rate-limiting (priority 910). A annotation apenas lista quais plugins aplicar — nao controla a ordem. Consultar a documentacao do Kong para ver prioridades.',
      reference: 'Conceito relacionado: Plugins de autenticacao tem prioridade alta para identificar o consumer antes de plugins de controle de trafego como ACL e rate-limiting.'
    },
    {
      question: 'Para que serve o plugin correlation-id no Kong?',
      options: [
        'Para correlacionar multiplos clusters Kong',
        'Para adicionar um ID unico (UUID) a cada request, facilitando rastreamento distribuido e debugging em logs',
        'Para correlacionar consumers com suas credenciais',
        'Para identificar dependencias entre APIs'
      ],
      correct: 1,
      explanation: 'O correlation-id adiciona um header (ex: X-Request-ID) com UUID unico a cada request. O mesmo ID e: encaminhado ao backend, retornado ao cliente (echo_downstream: true), e visivel nos logs do Kong. Permite rastrear um request especifico atraves de multiplos microservicos e logs.',
      reference: 'Conceito relacionado: Para rastreamento distribuido completo, combinar correlation-id com opentelemetry (traces) e http-log (logs) — correlacionar pelo X-Request-ID.'
    },
    {
      question: 'Como configurar o proxy-cache para cachear apenas respostas GET bem-sucedidas?',
      options: [
        'Nao e possivel filtrar por metodo HTTP no proxy-cache',
        'Usando config.request_method: [GET, HEAD] e config.response_code: [200] no KongPlugin proxy-cache',
        'Criando um KongIngress com cache ativo',
        'O proxy-cache cacheia tudo automaticamente'
      ],
      correct: 1,
      explanation: 'O proxy-cache permite filtrar: request_method (quais metodos cachear — tipicamente GET e HEAD), response_code (quais status cachear — tipicamente 200), e content_type (quais tipos de conteudo cachear). Isso evita cachear POSTs (mutacao de dados), erros 4xx/5xx, ou respostas binarias.',
      reference: 'Conceito relacionado: O plugin proxy-cache tem um header X-Cache-Status (Miss/Hit/Bypass/Refresh) na response que indica se foi servido do cache.'
    },
    {
      question: 'Qual e o proposito de hide_credentials: true no plugin key-auth?',
      options: [
        'Ocultar a API Key no log do Kong',
        'Remover o header/query param com a API Key do request antes de encaminhar ao backend — evita que o backend veja a credencial',
        'Criptografar a API Key em transito',
        'Nao retornar o erro de autenticacao ao cliente'
      ],
      correct: 1,
      explanation: 'Com hide_credentials: true, o Kong remove o header "apikey" (ou query param) do request antes de encaminhar ao backend. Sem isso, o backend receberia a API Key no header — desnecessario e potencialmente inseguro. O backend deve receber a requisicao sem os campos de autenticacao da camada de gateway.',
      reference: 'Conceito relacionado: Similar em outros plugins: jwt tem config.hide_credentials, basic-auth tem config.hide_credentials — sempre habilitar em producao.'
    }
  ],
  flashcards: [
    {
      front: 'Plugins de autenticacao Kong — comparacao',
      back: '**key-auth (API Key):**\n- Header: `apikey: <key>` ou query `?apikey=<key>`\n- Simples, sem estado, facil de revogar\n- Ideal para: integracao machine-to-machine\n\n**jwt (JSON Web Token):**\n- Header: `Authorization: Bearer <token>`\n- Token auto-contido com claims (exp, iss, sub)\n- Ideal para: auth stateless, microservicos\n\n**oauth2:**\n- Fluxo completo OAuth2 (code, client credentials)\n- Requer client_id + client_secret\n- Ideal para: autorizacao delegada\n\n**basic-auth:**\n- Header: `Authorization: Basic <base64(user:pass)>`\n- Simples mas sem expiracao\n- Ideal para: ferramentas internas, legado\n\n**hmac-auth:**\n- Assinatura HMAC do request completo\n- Detecta adulteracao do conteudo\n- Ideal para: webhooks, pagamentos\n\n**Todos requerem KongConsumer + Secret**'
    },
    {
      front: 'Rate Limiting — policies e quando usar',
      back: '**local:**\n- Cada pod Kong tem seu contador\n- N pods = N * limite por segundo\n- ⚠️ Nao preciso em multi-replica\n- ✅ Zero dependencias externas\n- ✅ Mais rapido (sem I/O)\n\n**redis:**\n- Contador centralizado no Redis\n- Preciso mesmo com multiplos pods\n- ✅ Recomendado para producao\n- Requer: redis_host, redis_port\n\n**cluster:**\n- Usa PostgreSQL do Kong\n- Apenas para modo DB-backed\n- ✅ Sem Redis adicional\n\n**Configuracao:**\n\`\`\`yaml\nconfig:\n  second: 10\n  minute: 100\n  limit_by: consumer  # ip|consumer|credential\n  policy: redis\n  redis_host: redis.svc\n\`\`\`\n\n**Headers de resposta:**\n`X-RateLimit-Limit-Minute: 100`\n`X-RateLimit-Remaining-Minute: 42`'
    },
    {
      front: 'Request/Response Transformer — operacoes disponiveis',
      back: '**Request Transformer:**\n\`\`\`yaml\nconfig:\n  add:\n    headers: ["X-Custom:value"]\n    querystring: ["param:value"]\n    body: ["field:value"]\n  remove:\n    headers: ["Cookie", "X-Token"]\n    querystring: ["debug"]\n  replace:\n    headers: ["Host:api.example.com"]\n  rename:\n    headers: ["Old:New"]\n  append:\n    headers: ["X-Multi:extra"]\n\`\`\`\n\n**Response Transformer:**\n\`\`\`yaml\nconfig:\n  add:\n    headers:\n      - "X-Kong-Proxy:true"\n      - "HSTS:max-age=31536000"\n  remove:\n    headers: ["X-Powered-By", "Server"]\n  replace:\n    headers: ["Content-Type:application/json"]\n\`\`\`\n\n**Variaveis disponiveis:**\n`$(consumer.username)`, `$(route.id)`,\n`$(service.name)`, `$(remote_addr)`'
    },
    {
      front: 'Plugin CORS — configuracao completa',
      back: '**O que o CORS faz:**\nAdiciona headers `Access-Control-*` nas respostas\npara permitir requests cross-origin de browsers\n\n**Configuracao:**\n\`\`\`yaml\nconfig:\n  origins:\n    - "https://app.example.com"\n    - "*"                 # Permite tudo (dev only!)\n  methods:\n    - GET\n    - POST\n    - OPTIONS             # OBRIGATORIO para preflight\n  headers:\n    - Authorization\n    - Content-Type\n  exposed_headers:\n    - X-Request-ID        # Headers que JS pode ler\n  credentials: true       # Permite cookies cross-origin\n  max_age: 3600           # Cache do preflight (segundos)\n  preflight_continue: false  # Interceptar OPTIONS\n\`\`\`\n\n**Headers adicionados na response:**\n`Access-Control-Allow-Origin: https://app.example.com`\n`Access-Control-Allow-Methods: GET, POST`\n`Access-Control-Allow-Credentials: true`'
    },
    {
      front: 'JWT no Kong — fluxo de autenticacao',
      back: '**Setup:**\n1. Plugin jwt no Ingress/Service\n2. KongConsumer com username = "issuer"\n3. Secret com label `konghq.com/credential: jwt`\n   - `key`: valor do claim "iss" no JWT\n   - `algorithm`: HS256 | RS256\n   - `secret`: chave HMAC (HS256) OU\n   - `rsa_public_key`: chave publica RSA (RS256)\n\n**Fluxo:**\n1. Cliente envia: `Authorization: Bearer <jwt>`\n2. Kong decodifica o JWT (sem verificar ainda)\n3. Extrai o claim `iss` (ou outro via key_claim_name)\n4. Busca KongConsumer com esse username\n5. Busca o Secret de credencial jwt desse consumer\n6. Verifica assinatura do JWT com o secret\n7. Verifica claims (exp, nbf se configurado)\n8. Se valido: encaminha ao backend com consumer identificado\n\n**Gerar JWT para teste:**\n`jwt.io` ou `python3 -c "import jwt; print(jwt.encode({...}, secret))"`'
    },
    {
      front: 'Proxy Cache — headers de status e invalidacao',
      back: '**Header de status na response:**\n`X-Cache-Status: Miss` — nao estava no cache (primeira req)\n`X-Cache-Status: Hit` — servido do cache\n`X-Cache-Status: Bypass` — nao cacheavel (POST, auth, etc)\n`X-Cache-Status: Refresh` — cache expirado, revalidando\n\n**Configuracao para JSON APIs:**\n\`\`\`yaml\nconfig:\n  request_method: [GET, HEAD]\n  response_code: [200]\n  content_type:\n    - "application/json; charset=utf-8"\n    - "application/json"\n  cache_ttl: 300\n  strategy: memory\n\`\`\`\n\n**Invalidar cache manualmente:**\n\`\`\`bash\n# Via Admin API (modo DB-backed)\ncurl -X DELETE http://kong-admin/cache\n\`\`\`\n\n**Nao cacheia se:**\n- Request tem Authorization header\n- Response tem Cache-Control: no-store\n- Metodo e POST/PUT/DELETE/PATCH\n- Status code nao esta em response_code'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar uma API segura com multiplas camadas de plugins no Kong: autenticacao JWT, controle de acesso por grupo (ACL), CORS para um frontend especifico, e modificacao de headers para seguranca.',
    objective: 'Aprender a encadear multiplos plugins Kong, configurar JWT com KongConsumer, e aplicar CORS e transformacao de headers.',
    duration: '30-35 minutos',
    steps: [
      {
        title: 'Configurar autenticacao JWT com KongConsumer',
        instruction: `Configure autenticacao JWT no Kong:
1. Criar um plugin JWT na rota
2. Criar um KongConsumer com credenciais JWT (HMAC HS256)
3. Gerar um JWT valido para testar
4. Verificar que requests sem JWT sao rejeitados e com JWT valido sao aceitos`,
        hints: [
          'O campo "key" no Secret JWT deve corresponder ao claim "iss" do token',
          'O algoritmo HS256 usa uma chave secreta simetrica',
          'Use jwt.io para gerar tokens de teste facilmente'
        ],
        solution: `\`\`\`yaml
# jwt-plugin.yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: jwt-auth
  namespace: default
plugin: jwt
config:
  claims_to_verify:
    - exp
  hide_credentials: true
\`\`\`

\`\`\`bash
# Adicionar JWT ao Ingress existente (supondo echo-ingress do lab anterior)
kubectl annotate ingress echo-ingress \\
  konghq.com/plugins="jwt-auth" \\
  --overwrite 2>/dev/null || \\
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secure-ingress
  namespace: default
  annotations:
    konghq.com/strip-path: "true"
    konghq.com/plugins: jwt-auth
spec:
  ingressClassName: kong
  rules:
    - http:
        paths:
          - path: /secure
            pathType: Prefix
            backend:
              service:
                name: echo-service
                port:
                  number: 80
EOF
\`\`\`

\`\`\`yaml
# jwt-consumer.yaml
apiVersion: v1
kind: Secret
metadata:
  name: charlie-jwt
  namespace: default
  labels:
    konghq.com/credential: jwt
stringData:
  key: "charlie-issuer"    # Valor do claim "iss" no JWT
  algorithm: HS256
  secret: "charlie-secret-key-min-32-chars-long"
---
apiVersion: configuration.konghq.com/v1
kind: KongConsumer
metadata:
  name: charlie
  namespace: default
  annotations:
    kubernetes.io/ingress.class: kong
username: charlie
credentials:
  - charlie-jwt
\`\`\`

\`\`\`bash
kubectl apply -f jwt-plugin.yaml
kubectl apply -f jwt-consumer.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar plugin e consumer criados
kubectl get kongplugin jwt-auth -n default
kubectl get kongconsumer charlie -n default
# Saida esperada: ambos Ready

# Testar SEM JWT (deve ser 401)
curl -si http://localhost:8080/secure | head -3
# Saida esperada: HTTP/1.1 401 Unauthorized

# Gerar JWT de teste (requer python3 e pyjwt)
# Alternativa: usar jwt.io com:
#   Header: {"alg": "HS256", "typ": "JWT"}
#   Payload: {"iss": "charlie-issuer", "exp": <timestamp_futuro>}
#   Secret: charlie-secret-key-min-32-chars-long

# Se pyjwt disponivel:
python3 -c "
import jwt, time
token = jwt.encode({
  'iss': 'charlie-issuer',
  'exp': int(time.time()) + 3600
}, 'charlie-secret-key-min-32-chars-long', algorithm='HS256')
print(token)
" 2>/dev/null || echo "pyjwt nao disponivel — gerar token em jwt.io"

# Testar COM JWT valido
TOKEN="<seu-token-aqui>"
curl -si -H "Authorization: Bearer \$TOKEN" http://localhost:8080/secure | head -3
# Saida esperada: HTTP/1.1 200 OK
\`\`\``
      },
      {
        title: 'Configurar CORS e Response Transformer para seguranca',
        instruction: `Configure headers de seguranca e CORS:
1. Criar plugin CORS para permitir requests de https://app.example.com
2. Criar plugin Response Transformer para adicionar headers de seguranca (HSTS, X-Content-Type-Options) e remover headers que expõem a tecnologia
3. Aplicar ambos ao Ingress
4. Verificar os headers nas respostas`,
        hints: [
          'Para testar CORS, simular uma preflight request com: curl -X OPTIONS -H "Origin: https://app.example.com" ...',
          'O Response Transformer pode adicionar multiplos headers de uma vez',
          'Headers de seguranca padrao: HSTS, X-Frame-Options, X-Content-Type-Options'
        ],
        solution: `\`\`\`yaml
# security-plugins.yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: cors
  namespace: default
plugin: cors
config:
  origins:
    - "https://app.example.com"
    - "http://localhost:3000"     # Para desenvolvimento local
  methods:
    - GET
    - POST
    - PUT
    - DELETE
    - OPTIONS
  headers:
    - Authorization
    - Content-Type
    - X-Request-ID
  credentials: true
  max_age: 3600
  preflight_continue: false
---
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: security-headers
  namespace: default
plugin: response-transformer
config:
  add:
    headers:
      - "Strict-Transport-Security:max-age=31536000; includeSubDomains"
      - "X-Content-Type-Options:nosniff"
      - "X-Frame-Options:DENY"
      - "X-XSS-Protection:1; mode=block"
  remove:
    headers:
      - "X-Powered-By"
      - "Server"
\`\`\`

\`\`\`bash
kubectl apply -f security-plugins.yaml

# Aplicar plugins ao Ingress
kubectl patch ingress secure-ingress --type=merge -p \\
  '{"metadata":{"annotations":{"konghq.com/plugins":"jwt-auth,cors,security-headers"}}}'
\`\`\``,
        verify: `\`\`\`bash
# Verificar plugins criados
kubectl get kongplugin -n default
# Saida esperada: cors e security-headers listados

# Testar CORS preflight (sem JWT pois OPTIONS pode ser excluido)
curl -si -X OPTIONS \\
  -H "Origin: https://app.example.com" \\
  -H "Access-Control-Request-Method: GET" \\
  http://localhost:8080/secure | grep -i "access-control"
# Saida esperada:
# Access-Control-Allow-Origin: https://app.example.com
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# Access-Control-Allow-Credentials: true

# Testar headers de seguranca com JWT valido
TOKEN="<seu-token-aqui>"
curl -si -H "Authorization: Bearer \$TOKEN" \\
  http://localhost:8080/secure | grep -i "strict\\|x-frame\\|x-content\\|x-powered\\|server"
# Saida esperada:
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# (X-Powered-By e Server NAO devem aparecer)
\`\`\``
      },
      {
        title: 'Configurar Rate Limiting com Redis e Correlation ID',
        instruction: `Configure rate limiting preciso e rastreamento de requests:
1. Deployar Redis no cluster para rate limiting centralizado
2. Criar plugin rate-limiting usando Redis como policy
3. Criar plugin correlation-id para rastreamento
4. Verificar os headers de rate limit e o X-Request-ID`,
        hints: [
          'O Redis pode ser instalado com um simples Deployment para laboratorio',
          'O redis_host deve ser o FQDN do Service Redis no cluster',
          'O correlation-id gera um UUID unico por request automaticamente'
        ],
        solution: `\`\`\`bash
# Deployar Redis simples para laboratorio
kubectl run redis --image=redis:7-alpine --port=6379
kubectl expose pod redis --port=6379 --name=redis

# Aguardar Redis estar pronto
kubectl wait pod/redis --for=condition=Ready --timeout=60s
\`\`\`

\`\`\`yaml
# redis-rate-limit.yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: redis-rate-limit
  namespace: default
plugin: rate-limiting
config:
  minute: 10            # 10 req/min para teste
  limit_by: consumer
  policy: redis
  redis_host: redis.default.svc.cluster.local
  redis_port: 6379
  hide_client_headers: false
---
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: correlation-id
  namespace: default
plugin: correlation-id
config:
  header_name: X-Request-ID
  generator: uuid
  echo_downstream: true
\`\`\`

\`\`\`bash
kubectl apply -f redis-rate-limit.yaml

# Atualizar Ingress com todos os plugins
kubectl patch ingress secure-ingress --type=merge -p \\
  '{"metadata":{"annotations":{"konghq.com/plugins":"jwt-auth,cors,security-headers,redis-rate-limit,correlation-id"}}}'
\`\`\``,
        verify: `\`\`\`bash
# Verificar que Redis esta rodando
kubectl get pod redis
# Saida esperada: redis Running

# Verificar plugin de rate limit com Redis
kubectl get kongplugin redis-rate-limit -n default
# Saida esperada: READY=True

# Testar correlation ID (sem JWT para simplicidade — usar rota nao protegida)
curl -si http://localhost:8080/echo | grep -i "x-request-id"
# Saida esperada: x-request-id: <uuid> (UUID diferente a cada request)

# Testar rate limiting com JWT
TOKEN="<seu-token-aqui>"
for i in \$(seq 1 12); do
  STATUS=\$(curl -si -H "Authorization: Bearer \$TOKEN" http://localhost:8080/secure | head -1)
  REMAINING=\$(curl -si -H "Authorization: Bearer \$TOKEN" http://localhost:8080/secure | grep -i "ratelimit-remaining-minute\\|x-ratelimit-remaining")
  echo "Request \$i: \$STATUS | \$REMAINING"
done
# Saida esperada:
# Requests 1-10: HTTP/1.1 200 OK | X-RateLimit-Remaining-Minute decrescendo
# Requests 11+: HTTP/1.1 429 Too Many Requests
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'JWT token valido retorna 401 "No credentials found for given iss"',
      difficulty: 'medium',
      symptom: 'O JWT foi gerado corretamente e verificado em jwt.io, mas o Kong retorna 401 com "No credentials found for given iss value". A autenticacao falha mesmo com token valido.',
      diagnosis: `\`\`\`bash
# 1. Verificar o consumer e suas credenciais
kubectl get kongconsumer -n <namespace>
kubectl describe kongconsumer <nome> -n <namespace>
# Verificar se o Secret de credencial jwt esta listado

# 2. Verificar o Secret de credencial JWT
kubectl get secret <nome-secret> -n <namespace> -o yaml
# Verificar: label konghq.com/credential: jwt
# Verificar: campo "key" (deve ser o valor do claim "iss" do JWT)

# 3. Decodificar o JWT para ver o claim "iss"
# Pegar o payload (parte do meio do JWT):
echo "<payload-base64>" | base64 -d 2>/dev/null | python3 -m json.tool

# 4. Verificar configuracao do plugin JWT
kubectl get kongplugin jwt-auth -n <namespace> -o yaml
# Verificar: key_claim_name (padrao e "iss")

# 5. Ver logs do Kong proxy para detalhes
kubectl logs -n kong -l app=kong-proxy --tail=20 | grep -i "jwt\\|401"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Mismatch entre "key" do Secret e claim "iss" do JWT:** O campo \`key\` no Secret de credencial JWT deve ser IDENTICO ao valor do claim \`iss\` no payload do JWT. Ex: se o Secret tem \`key: "my-service"\`, o JWT deve ter \`"iss": "my-service"\`.

2. **Label faltando no Secret:** O Secret DEVE ter a label \`konghq.com/credential: jwt\`. Sem ela, o KIC nao reconhece o Secret como credencial JWT.

3. **KongConsumer sem annotation de ingressClass:** Adicionar \`kubernetes.io/ingress.class: kong\` ao KongConsumer.

4. **Algoritmo diferente:** Se o JWT e RS256 mas o Secret tem \`algorithm: HS256\`, a validacao falha. Verificar e corrigir o algoritmo no Secret.

5. **Consumer nao foi sincronizado:** Forcar resync do controller:
\`\`\`bash
kubectl rollout restart deployment -n kong
# Aguardar restart e testar novamente
\`\`\``
    },
    {
      title: 'Rate limiting nao funciona com Redis — plugin retorna erro de conexao',
      difficulty: 'hard',
      symptom: 'O plugin rate-limiting com policy: redis retorna erros 500 ou ignora o rate limit. Os logs mostram "failed to connect to Redis" ou "connection refused". O Redis esta rodando mas a conexao falha.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o Redis esta acessivel pelo Kong
kubectl exec -n kong <pod-kong-proxy> -- curl -s redis.<namespace>.svc.cluster.local:6379

# 2. Verificar o endereco Redis na configuracao do plugin
kubectl get kongplugin <nome> -n <namespace> -o yaml | grep -A5 "config:"
# Verificar: redis_host, redis_port

# 3. Testar conectividade direta do pod Kong para o Redis
kubectl exec -n kong <pod-kong-proxy> -- \\
  nc -zv redis.<namespace>.svc.cluster.local 6379
# Saida esperada: Connection to redis... succeeded!

# 4. Verificar logs do Kong proxy
kubectl logs -n kong -l app=kong-proxy --tail=30 | grep -i "redis\\|error"

# 5. Verificar se Redis requer autenticacao
kubectl exec redis -- redis-cli ping
# Se retornar NOAUTH: Redis requer senha
\`\`\``,
      solution: `**Causas e solucoes:**

1. **FQDN errado do Redis:** O redis_host deve ser o Service FQDN completo: \`redis.<namespace>.svc.cluster.local\`. Nomes curtos como "redis" podem nao resolver corretamente de outro namespace.

2. **Porta errada:** Redis padrao e 6379. Se deployado diferente, verificar com \`kubectl get svc redis\`.

3. **Redis requer autenticacao:** Se o Redis foi configurado com senha, adicionar \`redis_password\` na config do plugin:
\`\`\`yaml
config:
  policy: redis
  redis_host: redis.default.svc.cluster.local
  redis_port: 6379
  redis_password: "minha-senha"
\`\`\`

4. **NetworkPolicy bloqueando:** Se houver NetworkPolicies no cluster, verificar se o namespace do Kong tem permissao para se conectar ao Redis no namespace de destino.

5. **Redis com TLS:** Se o Redis tem TLS ativado, adicionar \`redis_ssl: true\` e \`redis_ssl_verify: false\` (ou configurar o certificado CA).`
    }
  ]
};
