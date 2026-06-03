window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kong/kong-fundamentals'] = {
  theory: `
# Kong Gateway: Fundamentos

## Relevancia
Kong Gateway e o API Gateway open-source mais utilizado no mundo, baseado em NGINX+OpenResty. No contexto Kubernetes, o Kong Ingress Controller (KIC) permite gerenciar trafego de entrada via recursos nativos Kubernetes (Ingress, Gateway API) alem de CRDs proprios do Kong. Conhecimento essencial para plataformas com muitas APIs e microservicos.

## Conceitos Fundamentais

### Arquitetura do Kong no Kubernetes

\`\`\`
                                        Kong Ingress Controller
     ┌──────────────────────────────────────────────────────┐
     │                                                      │
     │  Kubernetes API ──── KIC (controlplane) ───────────► │
     │                           │                          │
     │                           ▼                          │
     │  Clientes ──► Kong Proxy (dataplane/NGINX) ─────────►│
     │               port 80/443                    Services │
     │                                                      │
     └──────────────────────────────────────────────────────┘
\`\`\`

**Modos de deploy:**
- **DBless (recomendado para K8s):** Configuracao declarativa via ConfigMap/CRDs — sem banco de dados
- **DB-backed:** PostgreSQL como store de configuracao — para clusters grandes com Admin API

### Instalacao via Helm

\`\`\`bash
# Adicionar repositorio Helm do Kong
helm repo add kong https://charts.konghq.com
helm repo update

# Instalar Kong Ingress Controller (modo DBless)
helm install kong kong/ingress \\
  --namespace kong \\
  --create-namespace \\
  --set controller.ingressClass=kong \\
  --set proxy.type=LoadBalancer

# Verificar pods
kubectl get pods -n kong
# Saida esperada: kong-controller e kong-proxy Running

# Verificar LoadBalancer
kubectl get svc -n kong
# Saida esperada: kong-proxy com EXTERNAL-IP
\`\`\`

### CRDs Principais do Kong

\`\`\`
KongPlugin          — define um plugin (rate-limit, auth, etc.)
KongClusterPlugin   — plugin a nivel de cluster (disponivel em todos os namespaces)
KongConsumer        — usuario/consumidor da API (para auth)
KongConsumerGroup   — grupo de consumidores com configuracoes compartilhadas
KongIngress         — override de comportamento do Ingress (upstream, proxy, route)
KongUpstreamPolicy  — politica de balanceamento (round-robin, least-connections, etc.)
\`\`\`

### Ingress com Kong

\`\`\`yaml
# Ingress basico — Kong redireciona trafego para o service
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: echo-ingress
  namespace: default
  annotations:
    konghq.com/strip-path: "true"      # Remove o prefixo do path antes de encaminhar
spec:
  ingressClassName: kong
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /echo
            pathType: Prefix
            backend:
              service:
                name: echo-service
                port:
                  number: 80
\`\`\`

### Gateway API com Kong (moderno)

O Kong suporta a Gateway API do Kubernetes — mais expressiva que Ingress tradicional.

\`\`\`yaml
# GatewayClass — define o controlador
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: kong
  annotations:
    konghq.com/gatewayclass-unmanaged: "true"
spec:
  controllerName: konghq.com/kic-gateway-controller
---
# Gateway — ponto de entrada
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: kong-gateway
  namespace: kong
spec:
  gatewayClassName: kong
  listeners:
    - name: http
      port: 80
      protocol: HTTP
      allowedRoutes:
        namespaces:
          from: All
---
# HTTPRoute — regras de roteamento
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: echo-route
  namespace: default
spec:
  parentRefs:
    - name: kong-gateway
      namespace: kong
  hostnames:
    - "api.example.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /echo
      backendRefs:
        - name: echo-service
          port: 80
\`\`\`

### KongPlugin — Adicionar Plugins a Rotas

\`\`\`yaml
# Plugin de rate-limiting (limite por IP)
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: rate-limit-5-per-min
  namespace: default
plugin: rate-limiting
config:
  minute: 5
  limit_by: ip
  policy: local            # local | redis | cluster
---
# Aplicar plugin ao Ingress via annotation
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: echo-ingress
  annotations:
    konghq.com/plugins: rate-limit-5-per-min   # Nome do KongPlugin
spec:
  # ...
\`\`\`

\`\`\`yaml
# Aplicar plugin a um Service (afeta todas as rotas deste service)
apiVersion: v1
kind: Service
metadata:
  name: echo-service
  annotations:
    konghq.com/plugins: rate-limit-5-per-min
spec:
  # ...
\`\`\`

### KongConsumer — Gerenciamento de Consumidores

\`\`\`yaml
# Consumidor com credenciais key-auth
apiVersion: configuration.konghq.com/v1
kind: KongConsumer
metadata:
  name: my-consumer
  namespace: default
  annotations:
    kubernetes.io/ingress.class: "kong"
username: my-consumer
credentials:
  - my-consumer-key-secret   # Nome do Secret com credencial
---
# Secret com a API Key
apiVersion: v1
kind: Secret
metadata:
  name: my-consumer-key-secret
  namespace: default
  labels:
    konghq.com/credential: key-auth   # Tipo de credencial
stringData:
  key: my-super-secret-api-key        # A chave em si
\`\`\`

### KongIngress — Customizar Comportamento

\`\`\`yaml
# KongIngress — override de configuracoes avancadas
apiVersion: configuration.konghq.com/v1
kind: KongIngress
metadata:
  name: echo-ingress-override
  namespace: default
route:
  methods:
    - GET
    - POST
  strip_path: true
  preserve_host: true
upstream:
  algorithm: round-robin    # round-robin | least-connections | consistent-hashing
  healthchecks:
    active:
      http_path: /health
      healthy:
        interval: 10
        successes: 3
      unhealthy:
        interval: 5
        http_failures: 3
proxy:
  connect_timeout: 2000     # ms
  read_timeout: 60000
  write_timeout: 60000
\`\`\`

### Erros Comuns

1. **ingressClassName errado** — Deve ser "kong" (ou o valor definido no helm install); sem isso, o KIC ignora o Ingress
2. **Plugin nao aplicado** — A annotation konghq.com/plugins deve ter o nome EXATO do KongPlugin; verificar namespace
3. **KongConsumer sem kubernetes.io/ingress.class** — Sem essa annotation, o consumidor pode nao ser reconhecido pelo controller
4. **Gateway API nao instalada** — Os CRDs da Gateway API precisam ser instalados separadamente; verificar com kubectl get crds | grep gateway.networking

## Killer.sh Style Challenge

> **Cenario:** Configure o Kong como Ingress Controller para um servico "api-service" na porta 8080. O servico deve ser acessivel em /api com strip-path ativo, com rate limiting de 100 requisicoes por minuto por IP, e apenas os metodos GET e POST permitidos.
`,
  quiz: [
    {
      question: 'Qual a diferenca entre KongPlugin e KongClusterPlugin?',
      options: [
        'KongPlugin e mais rapido que KongClusterPlugin',
        'KongPlugin e namespaced (disponivel apenas no namespace onde foi criado); KongClusterPlugin e cluster-scoped (disponivel em todos os namespaces)',
        'KongClusterPlugin suporta mais tipos de plugins',
        'Sao equivalentes — apenas nomes diferentes'
      ],
      correct: 1,
      explanation: 'KongPlugin (namespaced) so pode ser referenciado por Ingresses/Services no mesmo namespace. KongClusterPlugin e um recurso cluster-scoped que pode ser aplicado a qualquer recurso em qualquer namespace — ideal para plugins globais como rate-limiting corporativo ou autenticacao padrao.',
      reference: 'Conceito relacionado: Para aplicar um plugin globalmente a TODAS as rotas, usar KongClusterPlugin com a annotation konghq.com/plugins no namespace kong-system.'
    },
    {
      question: 'Como o Kong Ingress Controller (KIC) sabe quais Ingresses gerenciar?',
      options: [
        'Gerencia todos os Ingresses do cluster automaticamente',
        'Via spec.ingressClassName: kong no Ingress ou annotation kubernetes.io/ingress.class: kong',
        'Via labels no Ingress',
        'Apenas via recursos Gateway API'
      ],
      correct: 1,
      explanation: 'O KIC monitora Ingresses com ingressClassName: kong (spec.ingressClassName) ou a annotation kubernetes.io/ingress.class: "kong" (legado). Ingresses sem esses campos sao ignorados pelo KIC. O nome da classe pode ser customizado no helm install com --set controller.ingressClass=<nome>.',
      reference: 'Conceito relacionado: Multiplos Ingress Controllers podem coexistir no mesmo cluster (nginx, kong, traefik) — cada um so processa os Ingresses da sua classe.'
    },
    {
      question: 'O que faz a annotation konghq.com/strip-path: "true" em um Ingress?',
      options: [
        'Remove todos os headers do request',
        'Remove o prefixo do path configurado no Ingress antes de encaminhar o request para o backend',
        'Redireciona o request para HTTPS',
        'Remove o path completo do request'
      ],
      correct: 1,
      explanation: 'Com strip-path: true, se o Ingress tem path /api e o cliente faz GET /api/users, o Kong encaminha GET /users para o backend (remove o prefixo /api). Sem strip-path, o backend receberia GET /api/users, o que pode causar 404 se o backend nao espera o prefixo.',
      reference: 'Conceito relacionado: O mesmo comportamento pode ser configurado em KongIngress.route.strip_path para configuracoes mais avancadas.'
    },
    {
      question: 'Qual a vantagem do modo DBless no Kong para Kubernetes?',
      options: [
        'E mais rapido mas tem menos funcionalidades',
        'Elimina a dependencia de banco de dados externo — configuracao e declarativa via CRDs e ConfigMaps, alinhada com filosofia GitOps',
        'Suporta mais plugins que o modo com banco de dados',
        'E mais seguro pois nao armazena configuracoes'
      ],
      correct: 1,
      explanation: 'DBless e ideal para Kubernetes: sem PostgreSQL para gerenciar, configuracao via YAML/CRDs versionavel no Git (GitOps), restart rapido (reconfigura via ConfigMap), e menor overhead operacional. A desvantagem e que a Admin API fica em modo read-only — mudancas so via Kubernetes.',
      reference: 'Conceito relacionado: No modo DBless, nao e possivel usar kong admin CLI para criar rotas — tudo deve ser feito via kubectl e CRDs.'
    },
    {
      question: 'Como aplicar um KongPlugin a todos os requests de um Service especifico?',
      options: [
        'Adicionar o plugin direto no spec do Service',
        'Adicionar a annotation konghq.com/plugins: <nome-do-plugin> no Service',
        'Criar um KongIngress com o plugin configurado',
        'Plugins so podem ser aplicados em Ingresses, nao em Services'
      ],
      correct: 1,
      explanation: 'A annotation konghq.com/plugins pode ser colocada tanto no Ingress (aplica apenas a essa rota) quanto no Service (aplica a todas as rotas que usam esse Service). Isso permite aplicar plugins de autenticacao ou rate-limiting a nivel de servico, independente de quantos Ingresses apontam para ele.',
      reference: 'Conceito relacionado: Plugins em Service tem precedencia de configuracao diferente de plugins em Ingress — consultar documentacao de precedencia do Kong.'
    },
    {
      question: 'O que e a Gateway API no contexto do Kong?',
      options: [
        'A API administrativa do Kong (Admin API)',
        'Uma API REST para gerenciar o Kong externamente',
        'Um padrao Kubernetes mais expressivo que Ingress, usando GatewayClass, Gateway e HTTPRoute para configurar trafego de entrada',
        'Uma feature exclusiva do Kong Enterprise'
      ],
      correct: 2,
      explanation: 'Gateway API e um padrao oficial do Kubernetes (projeto SIG-Network) que supera as limitacoes do Ingress: suporta pesos de trafego, filtros de header, multiplos backends por regra, e e extensivel por design. O Kong suporta Gateway API com os CRDs GatewayClass, Gateway, HTTPRoute e GRPCRoute.',
      reference: 'Conceito relacionado: Gateway API esta substituindo Ingress como padrao recomendado — novo codigo deve preferir HTTPRoute a Ingress para maior portabilidade.'
    },
    {
      question: 'Como configurar healthcheck ativo em um upstream do Kong via KongIngress?',
      options: [
        'Configurar readinessProbe no Pod',
        'Usando KongIngress.upstream.healthchecks.active com http_path, interval, e criterios de healthy/unhealthy',
        'Criar um Probe especifico no Service',
        'Healthchecks ativos nao sao suportados no modo KIC'
      ],
      correct: 1,
      explanation: 'O KongIngress permite configurar healthchecks ativos (Kong probe periodicamente o backend) e passivos (Kong observa erros reais). Os criterios incluem: http_path para o endpoint de health, interval em segundos, successes para marcar como saudavel, e http_failures para marcar como nao saudavel.',
      reference: 'Conceito relacionado: KongUpstreamPolicy e o recurso mais moderno para configurar algoritmos de balanceamento e healthchecks no Kong.'
    }
  ],
  flashcards: [
    {
      front: 'Kong Ingress Controller — recursos principais e suas funcoes',
      back: '**Kubernetes nativos:**\n- `Ingress` — regras de roteamento (com ingressClassName: kong)\n- `Service` — backend para o proxy\n- `Secret` — credenciais de consumidores\n\n**CRDs Kong:**\n- `KongPlugin` — plugin namespaced (rate-limit, auth, cors)\n- `KongClusterPlugin` — plugin cluster-scoped (global)\n- `KongConsumer` — usuario/consumidor da API\n- `KongConsumerGroup` — grupo de consumidores\n- `KongIngress` — override avancado de route/upstream/proxy\n- `KongUpstreamPolicy` — algoritmo de load balancing\n\n**Gateway API (moderno):**\n- `GatewayClass` — tipo de gateway\n- `Gateway` — instancia de gateway\n- `HTTPRoute` — regras de roteamento HTTP\n- `GRPCRoute` — regras de roteamento gRPC\n\n**Annotations chave:**\n- `konghq.com/plugins: nome-plugin`\n- `konghq.com/strip-path: "true"`\n- `kubernetes.io/ingress.class: kong`'
    },
    {
      front: 'Kong DBless vs DB-backed — quando usar cada um',
      back: '**DBless (recomendado para K8s):**\n\`\`\`bash\nhelm install kong kong/ingress \\\n  --set env.database=off\n\`\`\`\n- ✅ Sem PostgreSQL externo\n- ✅ Config via CRDs/YAML (GitOps)\n- ✅ Restart rapido\n- ✅ Menor overhead operacional\n- ❌ Admin API readonly\n- ❌ Sem clustering avancado\n\n**DB-backed:**\n\`\`\`bash\nhelm install kong kong/kong \\\n  --set postgresql.enabled=true\n\`\`\`\n- ✅ Admin API completa\n- ✅ Multi-pod coordination\n- ✅ Deckcli sync\n- ❌ Requer PostgreSQL HA\n- ❌ Mais complexo operacionalmente\n\n**Regra geral:** DBless para K8s nativo,\nDB-backed para Kong on-prem ou Konnect hybrid'
    },
    {
      front: 'Aplicar plugins no Kong — precedencia e scopes',
      back: '**Levels de aplicacao (do mais especifico ao mais geral):**\n1. **Route** (Ingress annotation) — afeta apenas essa rota\n2. **Service** (Service annotation) — afeta todas as rotas do service\n3. **Consumer** (KongConsumer annotation) — afeta requests desse consumidor\n4. **Global** (KongClusterPlugin sem target) — afeta tudo\n\n**Sintaxe annotation:**\n\`\`\`yaml\nmetadata:\n  annotations:\n    konghq.com/plugins: plugin1,plugin2\n\`\`\`\n\n**Multiplos plugins:**\n\`\`\`yaml\nkonghq.com/plugins: rate-limit,jwt-auth,cors\n\`\`\`\n\n**Plugin deve estar no mesmo namespace do Ingress**\n(ou usar KongClusterPlugin para cross-namespace)\n\n**Precedencia de config:**\nRoute > Service > Consumer > Global'
    },
    {
      front: 'HTTPRoute (Gateway API) vs Ingress — comparacao',
      back: '**Ingress (legado):**\n\`\`\`yaml\napiVersion: networking.k8s.io/v1\nkind: Ingress\nspec:\n  ingressClassName: kong\n  rules:\n    - host: api.example.com\n      http:\n        paths:\n          - path: /api\n            pathType: Prefix\n            backend:\n              service:\n                name: api-svc\n                port:\n                  number: 80\n\`\`\`\n\n**HTTPRoute (moderno):**\n\`\`\`yaml\napiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nspec:\n  parentRefs:\n    - name: kong-gateway  # Referencia ao Gateway\n  rules:\n    - matches:\n        - path:\n            type: PathPrefix\n            value: /api\n      backendRefs:\n        - name: api-svc\n          port: 80\n          weight: 100    # Traffic splitting!\n\`\`\`\n\nHTTPRoute suporta: weights, header filters,\nmultiple backends, query param matching'
    },
    {
      front: 'KongConsumer — autenticacao de APIs',
      back: '**Criar consumidor com key-auth:**\n\`\`\`yaml\n# 1. Secret com credencial\napiVersion: v1\nkind: Secret\nmetadata:\n  name: alice-key\n  labels:\n    konghq.com/credential: key-auth\nstringData:\n  key: alice-secret-key\n---\n# 2. KongConsumer referenciando o Secret\napiVersion: configuration.konghq.com/v1\nkind: KongConsumer\nmetadata:\n  name: alice\n  annotations:\n    kubernetes.io/ingress.class: kong\nusername: alice\ncredentials:\n  - alice-key\n\`\`\`\n\n**Usar a API Key no request:**\n\`\`\`bash\ncurl -H "apikey: alice-secret-key" http://api.example.com/\n\`\`\`\n\n**Tipos de credencial:**\n- `key-auth` — API Key (header/query)\n- `basic-auth` — Username/Password\n- `jwt` — JWT tokens\n- `oauth2` — OAuth2 credentials\n- `hmac-auth` — HMAC signatures'
    },
    {
      front: 'Kong Helm install — opcoes principais',
      back: '**Instalar KIC (modo ingress controller):**\n\`\`\`bash\nhelm install kong kong/ingress \\\n  --namespace kong \\\n  --create-namespace\n\`\`\`\n\n**Instalar Kong Gateway completo:**\n\`\`\`bash\nhelm install kong kong/kong \\\n  --namespace kong \\\n  --create-namespace \\\n  --set ingressController.enabled=true \\\n  --set proxy.type=LoadBalancer \\\n  --set env.database=off\n\`\`\`\n\n**Verificar instalacao:**\n\`\`\`bash\nkubectl get pods -n kong\nkubectl get svc -n kong\nkubectl get ingressclass\n# Deve mostrar: kong\n\`\`\`\n\n**Expor para teste local:**\n\`\`\`bash\nkubectl port-forward svc/kong-proxy 8080:80 -n kong\ncurl -H "Host: api.example.com" http://localhost:8080/\n\`\`\`'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar o Kong como API Gateway para uma aplicacao de demonstracao no cluster, com rate limiting e controle de acesso basico.',
    objective: 'Instalar o Kong Ingress Controller, configurar uma rota com strip-path, aplicar rate limiting via KongPlugin, e criar um consumidor com autenticacao por API Key.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Instalar o Kong Ingress Controller',
        instruction: `Instale o Kong Ingress Controller no cluster usando Helm:
1. Adicionar o repositorio Helm do Kong
2. Instalar o Kong no namespace "kong" no modo DBless
3. Verificar que os pods estao Running
4. Criar uma aplicacao de teste (echo server) para usar como backend`,
        hints: [
          'Use helm install kong kong/ingress para o modo simplificado (KIC)',
          'O proxy pode levar alguns minutos para obter EXTERNAL-IP se usar LoadBalancer',
          'Para ambientes locais (kind/minikube), usar type: NodePort ou port-forward'
        ],
        solution: `\`\`\`bash
# Adicionar repositorio Helm do Kong
helm repo add kong https://charts.konghq.com
helm repo update

# Instalar o Kong Ingress Controller
helm install kong kong/ingress \\
  --namespace kong \\
  --create-namespace \\
  --set controller.ingressClass=kong \\
  --set proxy.type=LoadBalancer

# Verificar instalacao
kubectl get pods -n kong
kubectl get svc -n kong
\`\`\`

\`\`\`yaml
# echo-app.yaml — aplicacao de teste
apiVersion: apps/v1
kind: Deployment
metadata:
  name: echo
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: echo
  template:
    metadata:
      labels:
        app: echo
    spec:
      containers:
        - name: echo
          image: ealen/echo-server:latest
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: echo-service
  namespace: default
spec:
  selector:
    app: echo
  ports:
    - port: 80
      targetPort: 80
\`\`\`

\`\`\`bash
kubectl apply -f echo-app.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar pods do Kong
kubectl get pods -n kong
# Saida esperada: 2 pods Running (controller e proxy)
# controller-xxx    1/1   Running
# proxy-xxx         1/1   Running

# Verificar IngressClass do Kong
kubectl get ingressclass
# Saida esperada: kong listado

# Verificar servico do proxy
kubectl get svc -n kong
# Saida esperada: kong-proxy com porta 80/443

# Verificar pod da aplicacao de teste
kubectl get pods -l app=echo
# Saida esperada: echo-xxx Running

# Verificar servico da aplicacao
kubectl get svc echo-service
# Saida esperada: echo-service ClusterIP porta 80
\`\`\``
      },
      {
        title: 'Configurar Ingress com strip-path e rate limiting',
        instruction: `Configure o roteamento e aplique rate limiting:
1. Criar um KongPlugin de rate-limiting (5 requests por minuto para teste)
2. Criar um Ingress com ingressClassName: kong e strip-path ativo
3. Aplicar o plugin ao Ingress via annotation
4. Testar o rate limiting apos atingir o limite`,
        hints: [
          'O KongPlugin deve estar no mesmo namespace do Ingress',
          'A annotation konghq.com/plugins recebe o nome do KongPlugin',
          'Use curl com -i para ver os headers X-RateLimit-Remaining-Minute'
        ],
        solution: `\`\`\`yaml
# kong-rate-limit.yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: rate-limit-5rpm
  namespace: default
plugin: rate-limiting
config:
  minute: 5
  limit_by: ip
  policy: local
  hide_client_headers: false  # Mostrar headers de rate limit
---
# echo-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: echo-ingress
  namespace: default
  annotations:
    konghq.com/strip-path: "true"
    konghq.com/plugins: rate-limit-5rpm
spec:
  ingressClassName: kong
  rules:
    - http:
        paths:
          - path: /echo
            pathType: Prefix
            backend:
              service:
                name: echo-service
                port:
                  number: 80
\`\`\`

\`\`\`bash
kubectl apply -f kong-rate-limit.yaml
kubectl apply -f echo-ingress.yaml

# Obter IP/porta do Kong proxy
KONG_IP=\$(kubectl get svc kong-proxy -n kong -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
# Ou para NodePort:
# KONG_PORT=\$(kubectl get svc kong-proxy -n kong -o jsonpath='{.spec.ports[0].nodePort}')

# Testar a rota
curl -i http://\$KONG_IP/echo
\`\`\``,
        verify: `\`\`\`bash
# Verificar KongPlugin criado
kubectl get kongplugin -n default
# Saida esperada: rate-limit-5rpm Ready

# Verificar Ingress
kubectl get ingress echo-ingress
# Saida esperada: CLASS=kong, ADDRESS preenchido

# Testar a rota (configurar KONG_IP ou usar port-forward)
kubectl port-forward svc/kong-proxy 8080:80 -n kong &

# Fazer algumas requisicoes para ver headers de rate limit
for i in 1 2 3 4 5 6; do
  echo "Request \$i:"
  curl -si http://localhost:8080/echo | grep -E "HTTP|X-RateLimit|RateLimit"
done
# Saida esperada para requisicoes 1-5: X-RateLimit-Remaining-Minute diminuindo
# Saida esperada para requisicao 6: HTTP 429 Too Many Requests

# Verificar que o KongPlugin esta aplicado na rota
kubectl describe ingress echo-ingress | grep -i annotation
# Saida esperada: konghq.com/plugins: rate-limit-5rpm
\`\`\``
      },
      {
        title: 'Criar consumidor com autenticacao por API Key',
        instruction: `Configure autenticacao de API Key:
1. Adicionar plugin key-auth ao Ingress
2. Criar um Secret com a API Key do consumidor
3. Criar um KongConsumer referenciando o Secret
4. Testar que requests sem API Key sao rejeitados e com API Key sao aceitos`,
        hints: [
          'O Secret deve ter a label konghq.com/credential: key-auth',
          'O KongConsumer precisa da annotation kubernetes.io/ingress.class: kong',
          'Por padrao, a API Key e enviada no header "apikey"'
        ],
        solution: `\`\`\`yaml
# key-auth-plugin.yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: key-auth
  namespace: default
plugin: key-auth
config:
  key_names:
    - apikey            # Nome do header para a API Key
  hide_credentials: true  # Nao encaminhar a key para o backend
\`\`\`

\`\`\`bash
# Adicionar key-auth ao Ingress
kubectl annotate ingress echo-ingress \\
  konghq.com/plugins="rate-limit-5rpm,key-auth" \\
  --overwrite
\`\`\`

\`\`\`yaml
# consumer.yaml
apiVersion: v1
kind: Secret
metadata:
  name: alice-api-key
  namespace: default
  labels:
    konghq.com/credential: key-auth
stringData:
  key: "alice-secret-key-123"
---
apiVersion: configuration.konghq.com/v1
kind: KongConsumer
metadata:
  name: alice
  namespace: default
  annotations:
    kubernetes.io/ingress.class: "kong"
username: alice
credentials:
  - alice-api-key
\`\`\`

\`\`\`bash
kubectl apply -f key-auth-plugin.yaml
kubectl apply -f consumer.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar KongConsumer criado
kubectl get kongconsumer -n default
# Saida esperada: alice Ready

# Testar SEM API Key (deve ser rejeitado)
curl -si http://localhost:8080/echo | head -5
# Saida esperada: HTTP/1.1 401 Unauthorized
# Body: {"message":"No API key found in request"}

# Testar COM API Key incorreta
curl -si -H "apikey: wrong-key" http://localhost:8080/echo | head -5
# Saida esperada: HTTP/1.1 401 Unauthorized
# Body: {"message":"Invalid authentication credentials"}

# Testar COM API Key correta
curl -si -H "apikey: alice-secret-key-123" http://localhost:8080/echo | head -3
# Saida esperada: HTTP/1.1 200 OK

# Verificar KongConsumer e Secret
kubectl get kongconsumer alice -o yaml | grep -A3 "credentials:"
# Saida esperada: - alice-api-key listado
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Ingress com ingressClassName: kong nao e processado pelo KIC',
      difficulty: 'easy',
      symptom: 'O Ingress foi criado mas nao aparece no ADDRESS e o Kong nao cria a rota. Requests para a rota retornam 404 do Kong ou "no route matched".',
      diagnosis: `\`\`\`bash
# 1. Verificar se o IngressClass "kong" existe
kubectl get ingressclass
# Se nao aparecer "kong", o KIC nao foi instalado corretamente

# 2. Verificar se o KIC esta rodando
kubectl get pods -n kong
kubectl logs -n kong -l app=ingress-kong -c ingress-controller --tail=20

# 3. Verificar o Ingress em detalhes
kubectl describe ingress <nome>
# Verificar: IngressClass, annotations, Events

# 4. Verificar se ha eventos de erro
kubectl get events --field-selector reason=Sync -n default

# 5. Testar o proxy diretamente com header Host
KONG_IP=\$(kubectl get svc kong-proxy -n kong -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl -H "Host: <host-do-ingress>" http://\$KONG_IP/
\`\`\``,
      solution: `**Causas e solucoes:**

1. **IngressClass nao existe:** Verificar se o Helm install do Kong completou com sucesso. Se nao houver IngressClass "kong", reinstalar: \`helm upgrade kong kong/ingress -n kong\`.

2. **Nome da IngressClass errado:** O valor em spec.ingressClassName deve corresponder ao IngressClass criado pelo Kong (geralmente "kong"). Verificar com \`kubectl get ingressclass\`.

3. **KIC nao esta observando o namespace:** Por padrao o KIC observa todos os namespaces. Se instalado com --watch-namespace, verificar se inclui o namespace do Ingress.

4. **Annotation de legado conflitando:** Se o Ingress tem tanto spec.ingressClassName quanto a annotation kubernetes.io/ingress.class, o spec tem precedencia. Remover a annotation se usar spec.

5. **Bug de sincronizacao:** Forcar resync do controller:
\`\`\`bash
kubectl rollout restart deployment -n kong
\`\`\``
    },
    {
      title: 'KongPlugin aplicado mas nao tem efeito nas requisicoes',
      difficulty: 'medium',
      symptom: 'O KongPlugin foi criado e anotado no Ingress, mas o comportamento esperado (rate limit, autenticacao) nao acontece. Requests sao aceitos normalmente sem o controle do plugin.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o KongPlugin esta Ready
kubectl get kongplugin <nome> -n <namespace>
kubectl describe kongplugin <nome> -n <namespace>

# 2. Verificar annotation no Ingress
kubectl get ingress <nome> -o yaml | grep "konghq.com/plugins"
# Deve mostrar o nome exato do KongPlugin

# 3. Verificar se o plugin e o Ingress estao no MESMO namespace
kubectl get kongplugin -A | grep <nome>
kubectl get ingress -A | grep <nome>

# 4. Ver logs do controller para erros de validacao
kubectl logs -n kong -l app=ingress-kong -c ingress-controller | grep -i "plugin\\|error"

# 5. Verificar se o plugin esta configurado na rota do Kong
# Via Admin API (se disponivel):
curl http://\$KONG_ADMIN/routes
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Nome do plugin errado na annotation:** A annotation konghq.com/plugins deve ter o nome EXATO do KongPlugin (case-sensitive). Ex: se o KongPlugin se chama "rate-limit-5rpm", a annotation deve ser exatamente isso.

2. **Namespace diferente:** KongPlugin e o Ingress devem estar no mesmo namespace. Se o plugin esta em "default" e o Ingress em "production", o plugin nao e aplicado. Solucao: mover o plugin para o mesmo namespace ou usar KongClusterPlugin.

3. **Tipo de plugin incorreto:** Verificar o campo \`plugin:\` no KongPlugin. Ex: plugin: rate-limiting (nao rate-limit). Nomes de plugins seguem a nomenclatura do Kong, nao aliases.

4. **Configuracao invalida do plugin:** Um plugin com config invalida pode ser criado mas nao aplicado. Verificar os eventos do KongPlugin:
\`\`\`bash
kubectl describe kongplugin <nome>
# Procurar erros de validacao em Events
\`\`\`

5. **Plugin no Service mas Ingress sem ele:** Verificar se a annotation esta no lugar certo (Ingress OU Service, dependendo do escopo desejado).`
    }
  ]
};
