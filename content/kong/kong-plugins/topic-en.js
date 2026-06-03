window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kong/kong-plugins'] = {
  theory: `
# Kong: Plugins & Traffic Control

## Relevance
The plugin ecosystem is Kong's differentiator — over 50 official plugins and hundreds from the community cover use cases like authentication, request transformation, caching, observability, and security. Understanding how to configure and chain plugins is essential for building a robust API Gateway on Kubernetes.

## Fundamental Concepts

### Kong Plugin Categories

\`\`\`
Authentication    — key-auth, jwt, oauth2, basic-auth, hmac-auth, ldap-auth
Security          — bot-detection, cors, ip-restriction, acl
Traffic Control   — rate-limiting, request-size-limiting, response-ratelimiting
Transformations   — request-transformer, response-transformer, correlation-id
Serverless        — aws-lambda, openwhisk, azure-functions
Analytics         — prometheus, datadog, opentelemetry, file-log, http-log
\`\`\`

### Rate Limiting — Advanced Configuration

\`\`\`yaml
# Rate limiting with different time windows
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: advanced-rate-limit
  namespace: default
plugin: rate-limiting
config:
  second: 10          # Max 10 req/second
  minute: 100         # Max 100 req/minute
  hour: 1000          # Max 1000 req/hour
  limit_by: consumer  # ip | consumer | credential | service | header | path
  policy: redis       # local | redis | cluster (redis is more accurate in multi-pod)
  redis_host: redis.default.svc.cluster.local
  redis_port: 6379
  error_code: 429
  error_message: "Rate limit exceeded. Please try again later."
  hide_client_headers: false  # Expose RateLimit-* headers
\`\`\`

\`\`\`yaml
# Rate limiting per Consumer (personalized limit per user)
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: consumer-rate-limit
plugin: rate-limiting
config:
  minute: 1000        # Default limit (overridden by consumer)
  limit_by: consumer
  policy: local
\`\`\`

### CORS — Cross-Origin Resource Sharing

\`\`\`yaml
# CORS plugin for APIs consumed by browsers
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
  credentials: true             # Allow cookies/auth headers cross-origin
  max_age: 3600                 # Preflight cache in seconds
  preflight_continue: false     # Intercept OPTIONS (don't pass to backend)
\`\`\`

### Request Transformer — Modifying Requests

\`\`\`yaml
# Add, remove, and rename headers/query params
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
      - "X-Forwarded-For:$(remote_addr)"  # Dynamic variable
    querystring:
      - "api_version:v2"
  remove:
    headers:
      - "X-Internal-Token"       # Remove sensitive header before forwarding
      - "Cookie"                  # Remove cookies
  replace:
    headers:
      - "Host:api.example.com"   # Replace Host header
  rename:
    headers:
      - "Old-Header:New-Header"  # Rename header
\`\`\`

### Response Transformer — Modifying Responses

\`\`\`yaml
# Modify response headers and body
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
      - "X-Powered-By"          # Remove header exposing technology
      - "Server"                 # Hide server version
\`\`\`

### IP Restriction — Access Control by IP

\`\`\`yaml
# Block or allow specific IPs
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: ip-allowlist
  namespace: default
plugin: ip-restriction
config:
  allow:
    - "10.0.0.0/8"              # Internal network
    - "192.168.1.100"           # Specific IP
  deny: []                       # If allow is defined, deny is ignored
---
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: ip-denylist
  namespace: default
plugin: ip-restriction
config:
  deny:
    - "203.0.113.0/24"          # Block suspicious range
\`\`\`

### JWT Authentication

\`\`\`yaml
# JWT plugin — validate JWT tokens
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: jwt-auth
  namespace: default
plugin: jwt
config:
  key_claim_name: iss            # Claim that identifies the consumer (issuer)
  claims_to_verify:
    - exp                        # Verify expiration
    - nbf                        # Verify not-before
  header_names:
    - Authorization              # Header where to look for the token
  uri_param_names:
    - jwt                        # Or via query param ?jwt=...
  cookie_names: []               # Or via cookie
  secret_is_base64: false
\`\`\`

\`\`\`yaml
# Secret with consumer's JWT credentials
apiVersion: v1
kind: Secret
metadata:
  name: bob-jwt-cred
  namespace: default
  labels:
    konghq.com/credential: jwt
stringData:
  key: "bob-issuer"              # Value of the "iss" claim in the JWT
  algorithm: HS256               # Signing algorithm
  secret: "my-jwt-secret-key"   # Key to validate HMAC signature
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

### ACL — Access Control by Group

\`\`\`yaml
# Create access groups
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: acl-admin-only
  namespace: default
plugin: acl
config:
  allow:
    - admin                      # Only consumers in the "admin" group
  deny: []
  hide_groups_header: true       # Don't expose X-Consumer-Groups to backend
---
# Add consumer to group via Secret
apiVersion: v1
kind: Secret
metadata:
  name: alice-acl
  namespace: default
  labels:
    konghq.com/credential: acl
stringData:
  group: admin                   # Consumer's group
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
  - alice-acl                    # Multiple credentials allowed
\`\`\`

### Proxy Cache — Response Caching

\`\`\`yaml
# Cache GET/HEAD responses
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
  cache_ttl: 300                 # TTL in seconds (5 minutes)
  strategy: memory               # memory | redis
  memory:
    dictionary_name: kong_db_cache
\`\`\`

### Correlation ID — Request Tracking

\`\`\`yaml
# Add a unique ID to each request for distributed tracing
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: correlation-id
  namespace: default
plugin: correlation-id
config:
  header_name: X-Request-ID
  generator: uuid               # uuid | uuid#counter | tracker
  echo_downstream: true         # Return the ID in the response
\`\`\`

### Plugin Chaining

\`\`\`yaml
# Multiple plugins on an Ingress — executed in priority order
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secure-api
  annotations:
    konghq.com/plugins: "cors-policy,jwt-auth,acl-admin-only,rate-limit-5rpm,correlation-id"
    # Execution order is defined by Kong's plugin priority, not annotation order
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

### KongConsumerGroup — Per-Group Configuration

\`\`\`yaml
# Consumer group with custom rate limit
apiVersion: configuration.konghq.com/v1beta1
kind: KongConsumerGroup
metadata:
  name: premium-tier
  namespace: default
  annotations:
    kubernetes.io/ingress.class: kong
---
# Plugin with consumer group override
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: premium-rate-limit
  namespace: default
  annotations:
    konghq.com/consumer-group: premium-tier  # Applies to the group
plugin: rate-limiting
config:
  minute: 10000        # Much higher premium limit
  limit_by: consumer
\`\`\`

### Common Errors

1. **Redis plugin can't connect** — Check redis_host, redis_port and whether Redis is accessible in the cluster
2. **Invalid JWT** — The "iss" claim in the token must match the "key" in the JWT credential Secret
3. **Unexpected ACL 403** — Check if the consumer has the correct group via Secret with label konghq.com/credential: acl
4. **CORS preflight fails** — OPTIONS must be listed in config.methods; preflight_continue: false is needed
5. **Response transformer removes non-existent header** — Doesn't cause an error, simply ignored

## Killer.sh Style Challenge

> **Scenario:** Configure a route /api/v2 with: (1) JWT authentication with expiration verification; (2) only consumers in the "premium" group allowed via ACL; (3) CORS for https://app.example.com; (4) response transformer adding header "X-API-Version: v2"; (5) request logging via http-log to http://log-service/collect.
`,
  quiz: [
    {
      question: 'What is the difference between "local", "cluster", and "redis" policies in the rate-limiting plugin?',
      options: [
        'They are identical in behavior',
        '"local" counts per Kong pod (imprecise in multi-pod); "redis" uses Redis as a centralized store (precise in multi-pod); "cluster" uses Kong\'s DB (DB-backed mode only)',
        '"redis" is slower than "local"',
        '"cluster" is the default and recommended option'
      ],
      correct: 1,
      explanation: 'In deployments with multiple Kong replicas: "local" counts per instance (each pod has its own counter — can let 3x the limit through with 3 replicas). "redis" uses a centralized Redis to count requests from all pods — the only one that guarantees the global limit. "cluster" works with PostgreSQL (DB-backed mode).',
      reference: 'Related concept: For production with accurate rate-limiting, install Redis alongside Kong and use policy: redis.'
    },
    {
      question: 'How does the ACL plugin work together with authentication in Kong?',
      options: [
        'ACL works without authentication — it blocks by IP',
        'ACL requires an active authentication plugin on the same route — it checks if the authenticated consumer belongs to the allowed/denied group',
        'ACL replaces authentication',
        'ACL only works with the key-auth plugin'
      ],
      correct: 1,
      explanation: 'ACL depends on authentication: first the auth plugin identifies the consumer, then ACL checks if the consumer is in the allow/deny group. Without active authentication, Kong doesn\'t know who the consumer is and ACL returns 403. Flow: request → auth (identifies consumer) → acl (checks group) → backend.',
      reference: 'Related concept: A consumer can have multiple credentials (key-auth + acl) configured via multiple Secrets referenced in KongConsumer.'
    },
    {
      question: 'How can Request Transformer remove sensitive headers before forwarding to the backend?',
      options: [
        'It\'s not possible to remove headers with Request Transformer',
        'Using config.remove.headers with the list of headers to remove — Kong removes these headers from the request before forwarding to the service',
        'By creating a firewall rule in Kong',
        'Using the response-transformer plugin in reverse'
      ],
      correct: 1,
      explanation: 'The request-transformer with config.remove.headers removes headers from the request BEFORE forwarding to the backend. Useful for: removing X-Internal-Token (internal credentials), removing Cookie (privacy), or removing any header the backend shouldn\'t receive. The plugin can also add, replace, and rename headers.',
      reference: 'Related concept: The key-auth plugin has config.hide_credentials: true that automatically removes the API Key header before forwarding to the backend.'
    },
    {
      question: 'What happens when multiple plugins are listed in the konghq.com/plugins annotation?',
      options: [
        'Only the first plugin is applied',
        'Plugins are executed in parallel',
        'Plugins are executed in order of Kong\'s internal priority (each plugin has a defined priority number)',
        'The order in the annotation defines the execution order'
      ],
      correct: 2,
      explanation: 'The execution order of plugins in Kong is defined by each plugin\'s priority (internal number), not the annotation order. For example, cors (priority 2000) executes before rate-limiting (priority 910). The annotation only lists which plugins to apply — it doesn\'t control order. Consult Kong documentation for priorities.',
      reference: 'Related concept: Authentication plugins have high priority to identify the consumer before traffic control plugins like ACL and rate-limiting.'
    },
    {
      question: 'What is the purpose of the correlation-id plugin in Kong?',
      options: [
        'To correlate multiple Kong clusters',
        'To add a unique ID (UUID) to each request, facilitating distributed tracing and debugging in logs',
        'To correlate consumers with their credentials',
        'To identify dependencies between APIs'
      ],
      correct: 1,
      explanation: 'The correlation-id adds a header (e.g., X-Request-ID) with a unique UUID to each request. The same ID is: forwarded to the backend, returned to the client (echo_downstream: true), and visible in Kong\'s logs. Allows tracking a specific request through multiple microservices and logs.',
      reference: 'Related concept: For full distributed tracing, combine correlation-id with opentelemetry (traces) and http-log (logs) — correlate by X-Request-ID.'
    },
    {
      question: 'How to configure proxy-cache to only cache successful GET responses?',
      options: [
        'It\'s not possible to filter by HTTP method in proxy-cache',
        'Using config.request_method: [GET, HEAD] and config.response_code: [200] in the KongPlugin proxy-cache',
        'Creating a KongIngress with cache active',
        'The proxy-cache caches everything automatically'
      ],
      correct: 1,
      explanation: 'The proxy-cache allows filtering: request_method (which methods to cache — typically GET and HEAD), response_code (which status codes to cache — typically 200), and content_type (which content types to cache). This prevents caching POSTs (data mutation), 4xx/5xx errors, or binary responses.',
      reference: 'Related concept: The proxy-cache plugin has an X-Cache-Status header (Miss/Hit/Bypass/Refresh) in the response that indicates whether it was served from cache.'
    },
    {
      question: 'What is the purpose of hide_credentials: true in the key-auth plugin?',
      options: [
        'To hide the API Key in Kong\'s log',
        'To remove the header/query param with the API Key from the request before forwarding to the backend — prevents the backend from seeing the credential',
        'To encrypt the API Key in transit',
        'To not return the authentication error to the client'
      ],
      correct: 1,
      explanation: 'With hide_credentials: true, Kong removes the "apikey" header (or query param) from the request before forwarding to the backend. Without this, the backend would receive the API Key in the header — unnecessary and potentially insecure. The backend should receive the request without the gateway layer\'s authentication fields.',
      reference: 'Related concept: Similar in other plugins: jwt has config.hide_credentials, basic-auth has config.hide_credentials — always enable in production.'
    }
  ],
  flashcards: [
    {
      front: 'Kong authentication plugins — comparison',
      back: '**key-auth (API Key):**\n- Header: `apikey: <key>` or query `?apikey=<key>`\n- Simple, stateless, easy to revoke\n- Ideal for: machine-to-machine integration\n\n**jwt (JSON Web Token):**\n- Header: `Authorization: Bearer <token>`\n- Self-contained token with claims (exp, iss, sub)\n- Ideal for: stateless auth, microservices\n\n**oauth2:**\n- Full OAuth2 flow (code, client credentials)\n- Requires client_id + client_secret\n- Ideal for: delegated authorization\n\n**basic-auth:**\n- Header: `Authorization: Basic <base64(user:pass)>`\n- Simple but without expiration\n- Ideal for: internal tools, legacy\n\n**hmac-auth:**\n- HMAC signature of the full request\n- Detects content tampering\n- Ideal for: webhooks, payments\n\n**All require KongConsumer + Secret**'
    },
    {
      front: 'Rate Limiting — policies and when to use',
      back: '**local:**\n- Each Kong pod has its own counter\n- N pods = N * limit per second\n- ⚠️ Not accurate in multi-replica\n- ✅ Zero external dependencies\n- ✅ Faster (no I/O)\n\n**redis:**\n- Centralized counter in Redis\n- Accurate even with multiple pods\n- ✅ Recommended for production\n- Requires: redis_host, redis_port\n\n**cluster:**\n- Uses Kong\'s PostgreSQL\n- Only for DB-backed mode\n- ✅ No additional Redis\n\n**Configuration:**\n\`\`\`yaml\nconfig:\n  second: 10\n  minute: 100\n  limit_by: consumer  # ip|consumer|credential\n  policy: redis\n  redis_host: redis.svc\n\`\`\`\n\n**Response headers:**\n`X-RateLimit-Limit-Minute: 100`\n`X-RateLimit-Remaining-Minute: 42`'
    },
    {
      front: 'Request/Response Transformer — available operations',
      back: '**Request Transformer:**\n\`\`\`yaml\nconfig:\n  add:\n    headers: ["X-Custom:value"]\n    querystring: ["param:value"]\n    body: ["field:value"]\n  remove:\n    headers: ["Cookie", "X-Token"]\n    querystring: ["debug"]\n  replace:\n    headers: ["Host:api.example.com"]\n  rename:\n    headers: ["Old:New"]\n  append:\n    headers: ["X-Multi:extra"]\n\`\`\`\n\n**Response Transformer:**\n\`\`\`yaml\nconfig:\n  add:\n    headers:\n      - "X-Kong-Proxy:true"\n      - "HSTS:max-age=31536000"\n  remove:\n    headers: ["X-Powered-By", "Server"]\n  replace:\n    headers: ["Content-Type:application/json"]\n\`\`\`\n\n**Available variables:**\n`$(consumer.username)`, `$(route.id)`,\n`$(service.name)`, `$(remote_addr)`'
    },
    {
      front: 'CORS plugin — complete configuration',
      back: '**What CORS does:**\nAdds `Access-Control-*` headers to responses\nto allow cross-origin requests from browsers\n\n**Configuration:**\n\`\`\`yaml\nconfig:\n  origins:\n    - "https://app.example.com"\n    - "*"                 # Allow all (dev only!)\n  methods:\n    - GET\n    - POST\n    - OPTIONS             # REQUIRED for preflight\n  headers:\n    - Authorization\n    - Content-Type\n  exposed_headers:\n    - X-Request-ID        # Headers JS can read\n  credentials: true       # Allow cross-origin cookies\n  max_age: 3600           # Preflight cache (seconds)\n  preflight_continue: false  # Intercept OPTIONS\n\`\`\`\n\n**Headers added to response:**\n`Access-Control-Allow-Origin: https://app.example.com`\n`Access-Control-Allow-Methods: GET, POST`\n`Access-Control-Allow-Credentials: true`'
    },
    {
      front: 'JWT in Kong — authentication flow',
      back: '**Setup:**\n1. jwt plugin on Ingress/Service\n2. KongConsumer with username = "issuer"\n3. Secret with label `konghq.com/credential: jwt`\n   - `key`: value of "iss" claim in JWT\n   - `algorithm`: HS256 | RS256\n   - `secret`: HMAC key (HS256) OR\n   - `rsa_public_key`: RSA public key (RS256)\n\n**Flow:**\n1. Client sends: `Authorization: Bearer <jwt>`\n2. Kong decodes the JWT (without verifying yet)\n3. Extracts the `iss` claim (or other via key_claim_name)\n4. Looks up KongConsumer with that username\n5. Looks up the jwt credential Secret of that consumer\n6. Verifies JWT signature with the secret\n7. Verifies claims (exp, nbf if configured)\n8. If valid: forwards to backend with identified consumer\n\n**Generate JWT for testing:**\n`jwt.io` or `python3 -c "import jwt; print(jwt.encode({...}, secret))"`'
    },
    {
      front: 'Proxy Cache — status headers and invalidation',
      back: '**Status header in response:**\n`X-Cache-Status: Miss` — not in cache (first req)\n`X-Cache-Status: Hit` — served from cache\n`X-Cache-Status: Bypass` — not cacheable (POST, auth, etc)\n`X-Cache-Status: Refresh` — cache expired, revalidating\n\n**Configuration for JSON APIs:**\n\`\`\`yaml\nconfig:\n  request_method: [GET, HEAD]\n  response_code: [200]\n  content_type:\n    - "application/json; charset=utf-8"\n    - "application/json"\n  cache_ttl: 300\n  strategy: memory\n\`\`\`\n\n**Manually invalidate cache:**\n\`\`\`bash\n# Via Admin API (DB-backed mode)\ncurl -X DELETE http://kong-admin/cache\n\`\`\`\n\n**Not cached if:**\n- Request has Authorization header\n- Response has Cache-Control: no-store\n- Method is POST/PUT/DELETE/PATCH\n- Status code not in response_code'
    }
  ],
  lab: {
    scenario: 'You need to configure a secure API with multiple plugin layers in Kong: JWT authentication, group-based access control (ACL), CORS for a specific frontend, and header modification for security.',
    objective: 'Learn to chain multiple Kong plugins, configure JWT with KongConsumer, and apply CORS and header transformation.',
    duration: '30-35 minutes',
    steps: [
      {
        title: 'Configure JWT authentication with KongConsumer',
        instruction: `Configure JWT authentication in Kong:
1. Create a JWT plugin on the route
2. Create a KongConsumer with JWT credentials (HMAC HS256)
3. Generate a valid JWT for testing
4. Verify that requests without JWT are rejected and with valid JWT are accepted`,
        hints: [
          'The "key" field in the JWT Secret must match the "iss" claim in the token',
          'The HS256 algorithm uses a symmetric secret key',
          'Use jwt.io to easily generate test tokens'
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
# Add JWT to Ingress (creating a new one if needed)
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
  key: "charlie-issuer"    # Value of the "iss" claim in JWT
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
# Verify plugin and consumer created
kubectl get kongplugin jwt-auth -n default
kubectl get kongconsumer charlie -n default
# Expected output: both Ready

# Test WITHOUT JWT (should be 401)
curl -si http://localhost:8080/secure | head -3
# Expected output: HTTP/1.1 401 Unauthorized

# Generate test JWT (requires python3 and pyjwt)
# Alternative: use jwt.io with:
#   Header: {"alg": "HS256", "typ": "JWT"}
#   Payload: {"iss": "charlie-issuer", "exp": <future_timestamp>}
#   Secret: charlie-secret-key-min-32-chars-long

# If pyjwt available:
python3 -c "
import jwt, time
token = jwt.encode({
  'iss': 'charlie-issuer',
  'exp': int(time.time()) + 3600
}, 'charlie-secret-key-min-32-chars-long', algorithm='HS256')
print(token)
" 2>/dev/null || echo "pyjwt not available — generate token at jwt.io"

# Test WITH valid JWT
TOKEN="<your-token-here>"
curl -si -H "Authorization: Bearer \$TOKEN" http://localhost:8080/secure | head -3
# Expected output: HTTP/1.1 200 OK
\`\`\``
      },
      {
        title: 'Configure CORS and Response Transformer for security',
        instruction: `Configure security headers and CORS:
1. Create CORS plugin to allow requests from https://app.example.com
2. Create Response Transformer plugin to add security headers (HSTS, X-Content-Type-Options) and remove headers exposing technology
3. Apply both to the Ingress
4. Verify the headers in responses`,
        hints: [
          'To test CORS, simulate a preflight request with: curl -X OPTIONS -H "Origin: https://app.example.com" ...',
          'Response Transformer can add multiple headers at once',
          'Standard security headers: HSTS, X-Frame-Options, X-Content-Type-Options'
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
    - "http://localhost:3000"     # For local development
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

# Apply plugins to Ingress
kubectl patch ingress secure-ingress --type=merge -p \\
  '{"metadata":{"annotations":{"konghq.com/plugins":"jwt-auth,cors,security-headers"}}}'
\`\`\``,
        verify: `\`\`\`bash
# Verify plugins created
kubectl get kongplugin -n default
# Expected output: cors and security-headers listed

# Test CORS preflight (without JWT since OPTIONS may be excluded)
curl -si -X OPTIONS \\
  -H "Origin: https://app.example.com" \\
  -H "Access-Control-Request-Method: GET" \\
  http://localhost:8080/secure | grep -i "access-control"
# Expected output:
# Access-Control-Allow-Origin: https://app.example.com
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# Access-Control-Allow-Credentials: true

# Test security headers with valid JWT
TOKEN="<your-token-here>"
curl -si -H "Authorization: Bearer \$TOKEN" \\
  http://localhost:8080/secure | grep -i "strict\\|x-frame\\|x-content\\|x-powered\\|server"
# Expected output:
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# (X-Powered-By and Server should NOT appear)
\`\`\``
      },
      {
        title: 'Configure Rate Limiting with Redis and Correlation ID',
        instruction: `Configure accurate rate limiting and request tracking:
1. Deploy Redis in the cluster for centralized rate limiting
2. Create rate-limiting plugin using Redis as policy
3. Create correlation-id plugin for request tracking
4. Verify rate limit headers and X-Request-ID`,
        hints: [
          'Redis can be installed with a simple Deployment for lab purposes',
          'The redis_host should be the FQDN of the Redis Service in the cluster',
          'The correlation-id automatically generates a unique UUID per request'
        ],
        solution: `\`\`\`bash
# Deploy simple Redis for lab
kubectl run redis --image=redis:7-alpine --port=6379
kubectl expose pod redis --port=6379 --name=redis

# Wait for Redis to be ready
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
  minute: 10            # 10 req/min for testing
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

# Update Ingress with all plugins
kubectl patch ingress secure-ingress --type=merge -p \\
  '{"metadata":{"annotations":{"konghq.com/plugins":"jwt-auth,cors,security-headers,redis-rate-limit,correlation-id"}}}'
\`\`\``,
        verify: `\`\`\`bash
# Verify Redis is running
kubectl get pod redis
# Expected output: redis Running

# Verify rate limit plugin with Redis
kubectl get kongplugin redis-rate-limit -n default
# Expected output: READY=True

# Test correlation ID (without JWT for simplicity — use unprotected route)
curl -si http://localhost:8080/echo | grep -i "x-request-id"
# Expected output: x-request-id: <uuid> (different UUID each request)

# Test rate limiting with JWT
TOKEN="<your-token-here>"
for i in \$(seq 1 12); do
  STATUS=\$(curl -si -H "Authorization: Bearer \$TOKEN" http://localhost:8080/secure | head -1)
  REMAINING=\$(curl -si -H "Authorization: Bearer \$TOKEN" http://localhost:8080/secure | grep -i "ratelimit-remaining-minute\\|x-ratelimit-remaining")
  echo "Request \$i: \$STATUS | \$REMAINING"
done
# Expected output:
# Requests 1-10: HTTP/1.1 200 OK | X-RateLimit-Remaining-Minute decreasing
# Requests 11+: HTTP/1.1 429 Too Many Requests
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Valid JWT token returns 401 "No credentials found for given iss"',
      difficulty: 'medium',
      symptom: 'The JWT was generated correctly and verified at jwt.io, but Kong returns 401 with "No credentials found for given iss value". Authentication fails even with a valid token.',
      diagnosis: `\`\`\`bash
# 1. Check the consumer and its credentials
kubectl get kongconsumer -n <namespace>
kubectl describe kongconsumer <name> -n <namespace>
# Check if the jwt credential Secret is listed

# 2. Check the JWT credential Secret
kubectl get secret <secret-name> -n <namespace> -o yaml
# Check: label konghq.com/credential: jwt
# Check: field "key" (must be the value of the "iss" claim in the JWT)

# 3. Decode the JWT to see the "iss" claim
# Get the payload (middle part of JWT):
echo "<payload-base64>" | base64 -d 2>/dev/null | python3 -m json.tool

# 4. Check JWT plugin configuration
kubectl get kongplugin jwt-auth -n <namespace> -o yaml
# Check: key_claim_name (default is "iss")

# 5. View Kong proxy logs for details
kubectl logs -n kong -l app=kong-proxy --tail=20 | grep -i "jwt\\|401"
\`\`\``,
      solution: `**Causes and solutions:**

1. **Mismatch between Secret "key" and JWT "iss" claim:** The \`key\` field in the JWT credential Secret must be IDENTICAL to the value of the \`iss\` claim in the JWT payload. Ex: if the Secret has \`key: "my-service"\`, the JWT must have \`"iss": "my-service"\`.

2. **Missing label on Secret:** The Secret MUST have the label \`konghq.com/credential: jwt\`. Without it, KIC doesn't recognize the Secret as a JWT credential.

3. **KongConsumer without ingressClass annotation:** Add \`kubernetes.io/ingress.class: kong\` to the KongConsumer.

4. **Different algorithm:** If the JWT is RS256 but the Secret has \`algorithm: HS256\`, validation fails. Check and fix the algorithm in the Secret.

5. **Consumer not synchronized:** Force controller resync:
\`\`\`bash
kubectl rollout restart deployment -n kong
# Wait for restart and test again
\`\`\``
    },
    {
      title: 'Rate limiting not working with Redis — plugin returns connection error',
      difficulty: 'hard',
      symptom: 'The rate-limiting plugin with policy: redis returns 500 errors or ignores the rate limit. Logs show "failed to connect to Redis" or "connection refused". Redis is running but the connection fails.',
      diagnosis: `\`\`\`bash
# 1. Check if Redis is accessible from Kong
kubectl exec -n kong <kong-proxy-pod> -- curl -s redis.<namespace>.svc.cluster.local:6379

# 2. Check Redis address in plugin configuration
kubectl get kongplugin <name> -n <namespace> -o yaml | grep -A5 "config:"
# Check: redis_host, redis_port

# 3. Test direct connectivity from Kong pod to Redis
kubectl exec -n kong <kong-proxy-pod> -- \\
  nc -zv redis.<namespace>.svc.cluster.local 6379
# Expected output: Connection to redis... succeeded!

# 4. Check Kong proxy logs
kubectl logs -n kong -l app=kong-proxy --tail=30 | grep -i "redis\\|error"

# 5. Check if Redis requires authentication
kubectl exec redis -- redis-cli ping
# If returns NOAUTH: Redis requires a password
\`\`\``,
      solution: `**Causes and solutions:**

1. **Wrong Redis FQDN:** The redis_host must be the full Service FQDN: \`redis.<namespace>.svc.cluster.local\`. Short names like "redis" may not resolve correctly from another namespace.

2. **Wrong port:** Redis default is 6379. If deployed differently, check with \`kubectl get svc redis\`.

3. **Redis requires authentication:** If Redis was configured with a password, add \`redis_password\` to the plugin config:
\`\`\`yaml
config:
  policy: redis
  redis_host: redis.default.svc.cluster.local
  redis_port: 6379
  redis_password: "my-password"
\`\`\`

4. **NetworkPolicy blocking:** If there are NetworkPolicies in the cluster, verify that Kong's namespace has permission to connect to Redis in the target namespace.

5. **Redis with TLS:** If Redis has TLS enabled, add \`redis_ssl: true\` and \`redis_ssl_verify: false\` (or configure the CA certificate).`
    }
  ]
};
