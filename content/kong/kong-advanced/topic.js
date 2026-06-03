window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kong/kong-advanced'] = {
  theory: `
# Kong: Observabilidade, Gateway API Avancada e Producao

## Relevancia
Este topico cobre os recursos avancados do Kong para producao: integracao com Prometheus e OpenTelemetry, estrategias avancadas de roteamento com Gateway API (canary, blue-green, traffic splitting), gerenciamento de configuracao com decK CLI, e boas praticas de alta disponibilidade no Kubernetes.

## Conceitos Fundamentais

### Observabilidade — Prometheus e OpenTelemetry

\`\`\`yaml
# Plugin Prometheus — expor metricas para scraping
apiVersion: configuration.konghq.com/v1
kind: KongClusterPlugin
metadata:
  name: prometheus
  annotations:
    kubernetes.io/ingress.class: kong
plugin: prometheus
config:
  status_code_metrics: true     # Contar por status HTTP
  latency_metrics: true         # Histograma de latencia
  bandwidth_metrics: true       # Bytes enviados/recebidos
  upstream_health_metrics: true # Saude dos upstreams
\`\`\`

\`\`\`yaml
# ServiceMonitor para Prometheus Operator (kube-prometheus-stack)
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kong-metrics
  namespace: kong
  labels:
    release: kube-prometheus-stack   # Label para o Prometheus encontrar
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: kong
  namespaceSelector:
    matchNames:
      - kong
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
\`\`\`

**Metricas principais do Kong:**
\`\`\`
kong_http_requests_total{service, route, method, status}  — Total de requests por rota
kong_http_status{code}                                    — Contagem por codigo HTTP
kong_latency_bucket                                       — Histograma de latencia
kong_bandwidth_bytes_total{type="ingress|egress"}         — Bytes trafegados
kong_upstream_target_health{upstream, target, state}      — Saude dos upstreams
\`\`\`

### OpenTelemetry — Distributed Tracing

\`\`\`yaml
# Plugin OpenTelemetry — enviar traces para Jaeger/Tempo/OTLP
apiVersion: configuration.konghq.com/v1
kind: KongClusterPlugin
metadata:
  name: opentelemetry
  annotations:
    kubernetes.io/ingress.class: kong
plugin: opentelemetry
config:
  endpoint: "http://otel-collector.observability.svc.cluster.local:4318/v1/traces"
  resource_attributes:
    service.name: "kong-gateway"
    service.version: "3.x"
    deployment.environment: "production"
  header_type: b3              # b3 | w3c | jaeger | ot | datadog
  propagation_media_type: "application/json"
  sampling_rate: 1.0           # 1.0 = 100% sampling (reducir em producao)
\`\`\`

### Gateway API — Traffic Splitting e Canary

A Gateway API permite estrategias avancadas de trafego sem anotacoes proprias do Kong.

\`\`\`yaml
# Canary deployment — 90% producao, 10% canary
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-with-canary
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
            value: /api
      backendRefs:
        - name: api-stable          # Versao atual
          port: 80
          weight: 90                # 90% do trafego
        - name: api-canary          # Versao canary
          port: 80
          weight: 10                # 10% do trafego
\`\`\`

\`\`\`yaml
# Header-based routing — rotear para v2 com header especifico
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: header-based-routing
  namespace: default
spec:
  parentRefs:
    - name: kong-gateway
      namespace: kong
  rules:
    # Regra 1: Header X-Version: v2 vai para servico v2
    - matches:
        - headers:
            - name: X-Version
              value: v2
      backendRefs:
        - name: api-v2
          port: 80
    # Regra 2: Default vai para v1
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: api-v1
          port: 80
\`\`\`

\`\`\`yaml
# HTTPRoute com modificacao de headers (filtros)
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: route-with-filters
  namespace: default
spec:
  parentRefs:
    - name: kong-gateway
      namespace: kong
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api/v1
      filters:
        - type: RequestHeaderModifier
          requestHeaderModifier:
            add:
              - name: X-API-Version
                value: "1.0"
            remove:
              - X-Debug-Header
        - type: ResponseHeaderModifier
          responseHeaderModifier:
            add:
              - name: X-Response-Version
                value: "1.0"
      backendRefs:
        - name: api-v1
          port: 80
\`\`\`

### decK CLI — Gerenciamento de Configuracao

O decK (declarative Configuration) e a CLI oficial para exportar, validar, comparar e sincronizar configuracoes Kong.

\`\`\`bash
# Instalar decK
curl -sL https://github.com/Kong/deck/releases/latest/download/deck_linux_amd64.tar.gz | tar xz
sudo mv deck /usr/local/bin/

# Exportar configuracao atual do Kong
deck gateway dump --output-file kong.yaml

# Validar um arquivo de configuracao
deck gateway validate --state kong.yaml

# Comparar configuracao atual vs arquivo (dry-run)
deck gateway diff --state kong.yaml

# Aplicar configuracao (sincronizar)
deck gateway sync --state kong.yaml

# Render — expandir variaveis de ambiente no arquivo
deck gateway render --state kong.yaml.j2
\`\`\`

\`\`\`yaml
# Exemplo de arquivo de estado do decK (kong.yaml)
_format_version: "3.0"
_transform: true

services:
  - name: my-api
    url: http://api-service.default.svc.cluster.local
    routes:
      - name: my-api-route
        paths:
          - /api
        strip_path: true
        methods:
          - GET
          - POST
    plugins:
      - name: rate-limiting
        config:
          minute: 100
          policy: local
\`\`\`

### KongUpstreamPolicy — Balanceamento de Carga Avancado

\`\`\`yaml
# Configurar balanceamento com healthchecks ativos
apiVersion: configuration.konghq.com/v1beta1
kind: KongUpstreamPolicy
metadata:
  name: my-upstream-policy
  namespace: default
spec:
  algorithm: least-connections    # round-robin | least-connections | consistent-hashing | random
  slots: 1000                     # Numero de slots para consistent-hashing
  hashOn:                         # Para consistent-hashing
    header: X-User-ID             # Hash baseado no header (sticky sessions)
  healthchecks:
    active:
      type: http
      httpPath: /health
      httpStatuses: [200, 204]
      interval: 10
      timeout: 3
      concurrency: 10
      healthy:
        successes: 3
      unhealthy:
        httpFailures: 3
        timeouts: 3
    passive:
      type: http
      healthy:
        successes: 5
      unhealthy:
        httpFailures: 5
        httpStatuses: [429, 500, 502, 503, 504]
\`\`\`

\`\`\`yaml
# Associar KongUpstreamPolicy ao Service
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: default
  annotations:
    konghq.com/upstream-policy: my-upstream-policy  # Referenciar a policy
spec:
  selector:
    app: api
  ports:
    - port: 80
\`\`\`

### Alta Disponibilidade em Producao

\`\`\`yaml
# HPA para Kong Proxy
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: kong-proxy-hpa
  namespace: kong
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: kong-proxy
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
\`\`\`

\`\`\`yaml
# PodDisruptionBudget — garantir disponibilidade durante rolling updates
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: kong-pdb
  namespace: kong
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: kong-proxy
\`\`\`

### TLS Termination — HTTPS no Kong

\`\`\`yaml
# Ingress com TLS (cert-manager + Let's Encrypt)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tls-ingress
  namespace: default
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    konghq.com/protocols: "https"
    konghq.com/https-redirect-status-code: "301"
spec:
  ingressClassName: kong
  tls:
    - hosts:
        - api.example.com
      secretName: api-tls-cert    # cert-manager cria automaticamente
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 80
\`\`\`

### Erros Comuns em Producao

1. **Memory leak no Kong com muitos plugins** — Monitorar memory via Prometheus; ajustar limites de resources no Deployment
2. **Worker timeout em uploads grandes** — Aumentar proxy.read_timeout no KongIngress para rotas de upload
3. **DNS resolution falha para services** — Configurar dns_resolver no Kong para usar o kube-dns corretamente
4. **decK sync sobrescreve configuracao CRD** — Nao misturar decK com KIC no modo DBless; escolher uma abordagem
5. **Canary com peso errado** — Os pesos no HTTPRoute sao relativos (90+10=100%), nao percentuais absolutos; verificar soma

## Killer.sh Style Challenge

> **Cenario:** Configure um deployment blue-green para a API principal usando HTTPRoute com traffic splitting 50/50 inicialmente. Adicione metricas Prometheus com ServiceMonitor, configure OpenTelemetry para enviar traces ao Jaeger, e garanta HA com HPA (min 3, max 10 replicas) e PodDisruptionBudget (minAvailable 2).
`,
  quiz: [
    {
      question: 'Como implementar canary deployment com 10% de trafego para a nova versao usando Gateway API no Kong?',
      options: [
        'Usando annotation konghq.com/canary: "10%"',
        'Usando HTTPRoute com dois backendRefs: versao atual com weight: 90 e versao canary com weight: 10',
        'Criando dois Ingresses separados com nginx-split-client',
        'Canary nao e suportado nativamente no Kong'
      ],
      correct: 1,
      explanation: 'A Gateway API suporta traffic splitting nativo via HTTPRoute com backendRefs multiplos e weights. O Kong processa os pesos automaticamente: weight: 90 e weight: 10 em dois backendRefs na mesma regra envia 90% para stable e 10% para canary. Os pesos sao relativos — a soma define as proporcoes.',
      reference: 'Conceito relacionado: Para canary gradual, automatizar o ajuste de weights com kubectl patch ou ArgoCD Rollouts que integra com Kong Gateway API.'
    },
    {
      question: 'Qual o proposito do decK CLI no gerenciamento do Kong?',
      options: [
        'E uma interface grafica para o Kong',
        'E a CLI declarativa para exportar, validar, comparar e sincronizar configuracoes Kong — similar a "terraform plan/apply" para o Kong',
        'E usada apenas para instalar o Kong',
        'decK e um plugin do Kong, nao uma ferramenta externa'
      ],
      correct: 1,
      explanation: 'O decK (declarative Configuration) permite GitOps para o Kong: deck gateway dump (exportar estado atual), deck gateway diff (comparar arquivo vs cluster — dry-run), deck gateway sync (aplicar configuracoes). Util para modo DB-backed onde se quer gerenciar via arquivos YAML versionados.',
      reference: 'Conceito relacionado: Em modo DBless com KIC, nao usar decK — as configuracoes ja sao gerenciadas pelos CRDs Kubernetes. decK e para o modo DB-backed.'
    },
    {
      question: 'Como configurar sticky sessions (afinidade de sessao) no Kong?',
      options: [
        'Usando annotation konghq.com/sticky: "true"',
        'Usando KongUpstreamPolicy com algorithm: consistent-hashing e hashOn.header para fazer hash de um header especifico do usuario',
        'Sticky sessions nao sao suportadas no Kong',
        'Usando o plugin session do Kong'
      ],
      correct: 1,
      explanation: 'O consistent-hashing no KongUpstreamPolicy distribui requests do mesmo usuario para o mesmo pod backend. Configurando hashOn.header: X-User-ID (ou cookie, IP), requests com o mesmo valor sempre vao para o mesmo upstream. Util para aplicacoes com estado de sessao no servidor.',
      reference: 'Conceito relacionado: Combinar consistent-hashing com healthchecks ativos para remover pods nao saudaveis do pool sem quebrar sticky sessions desnecessariamente.'
    },
    {
      question: 'Quais sao as metricas mais importantes do plugin Prometheus do Kong?',
      options: [
        'Apenas CPU e memoria do pod Kong',
        'kong_http_requests_total (requests por rota/status), kong_latency_bucket (histograma), kong_upstream_target_health (saude dos backends)',
        'Apenas numero total de requests',
        'Metricas de disco e rede do node'
      ],
      correct: 1,
      explanation: 'O plugin prometheus do Kong expoe: kong_http_requests_total (com labels service, route, method, status — para SLO de error rate), kong_latency_bucket (para SLO de latencia P99/P95), e kong_upstream_target_health (para alertas de backend nao saudavel). Sao as metricas fundamentais para SRE trabalhar com o Kong.',
      reference: 'Conceito relacionado: Criar dashboards Grafana com esses dados para: error rate por servico, latencia P99 por rota, e disponibilidade de upstreams.'
    },
    {
      question: 'Como garantir zero downtime durante atualizacoes do Kong em producao?',
      options: [
        'Fazer o update fora do horario comercial',
        'Configurar HPA (min 2+ replicas), PodDisruptionBudget (minAvailable 1+), e usar RollingUpdate strategy no Deployment do Kong',
        'Kong atualiza automaticamente sem downtime',
        'Usar apenas 1 replica com restart rapido'
      ],
      correct: 1,
      explanation: 'Para zero downtime: (1) HPA com minReplicas >= 2 garante que sempre ha replicas disponivel; (2) PodDisruptionBudget impede que todos os pods sejam evictados ao mesmo tempo durante drenagem de node; (3) RollingUpdate garante que novos pods estao Ready antes de terminar os antigos. As tres medidas juntas.',
      reference: 'Conceito relacionado: Adicionar preStop hook de sleep nos pods Kong para dar tempo para o load balancer (cloud) remover o pod do pool antes do SIGTERM.'
    },
    {
      question: 'Como configurar roteamento baseado em header (header-based routing) com Gateway API no Kong?',
      options: [
        'Usando annotation konghq.com/route-by-header',
        'Usando HTTPRoute com rules[].matches[].headers especificando o nome e valor do header para rotear para diferentes backends',
        'Header-based routing nao e suportado pelo Kong',
        'Usando KongIngress com header routing'
      ],
      correct: 1,
      explanation: 'HTTPRoute suporta matching por header: em rules[].matches[].headers especificar name e value (ou type: RegularExpression para regex). Requests com o header correspondente vao para o backendRef daquela regra. Util para: roteamento por versao de API (X-API-Version: v2), A/B testing, e blue-green baseado em cookie.',
      reference: 'Conceito relacionado: O matching em HTTPRoute e processado em ordem — a primeira regra que bate e usada. Colocar regras mais especificas antes das mais gerais.'
    },
    {
      question: 'O que faz o plugin opentelemetry no Kong?',
      options: [
        'Monitora a performance interna do Kong apenas',
        'Gera e propaga distributed traces (spans) para cada request, enviando para um OTLP collector — permite rastrear um request pelo Kong e pelos microservicos downstream',
        'E uma alternativa ao plugin Prometheus',
        'Coleta apenas metricas, nao traces'
      ],
      correct: 1,
      explanation: 'O plugin opentelemetry do Kong cria um span para cada request passando pelo gateway, propaga o trace context via headers (W3C, B3, Jaeger), e envia traces via OTLP para um collector (Jaeger, Tempo, OTLP backend). Permite ver a latencia no Kong separadamente dos microservicos downstream.',
      reference: 'Conceito relacionado: Combinar opentelemetry no Kong com o OTEL SDK nos microservicos para traces end-to-end — do cliente ao banco de dados, passando pelo gateway.'
    }
  ],
  flashcards: [
    {
      front: 'Traffic splitting com HTTPRoute — pesos e canary',
      back: '**50/50 Blue-Green:**\n\`\`\`yaml\nrules:\n  - matches:\n      - path:\n          type: PathPrefix\n          value: /api\n    backendRefs:\n      - name: api-blue\n        port: 80\n        weight: 50\n      - name: api-green\n        port: 80\n        weight: 50\n\`\`\`\n\n**90/10 Canary:**\n\`\`\`yaml\n    backendRefs:\n      - name: api-stable\n        port: 80\n        weight: 90\n      - name: api-canary\n        port: 80\n        weight: 10\n\`\`\`\n\n**Header-based (sem peso):**\n\`\`\`yaml\n  - matches:\n      - headers:\n          - name: X-Version\n            value: canary\n    backendRefs:\n      - name: api-canary\n        port: 80\n\`\`\`\n\n**Pesos sao RELATIVOS:**\n90+10=100 ou 9+1=10 tem o mesmo efeito\nSoma total define as proporcoes'
    },
    {
      front: 'decK CLI — comandos essenciais',
      back: '**Instalacao:**\n\`\`\`bash\ncurl -sL https://github.com/Kong/deck/releases/latest/download/deck_linux_amd64.tar.gz | tar xz\nsudo mv deck /usr/local/bin/\n\`\`\`\n\n**Fluxo GitOps:**\n\`\`\`bash\n# 1. Exportar estado atual\ndeck gateway dump -o kong.yaml\n\n# 2. Editar kong.yaml no Git\n\n# 3. Validar arquivo\ndeck gateway validate --state kong.yaml\n\n# 4. Ver diff (dry-run)\ndeck gateway diff --state kong.yaml\n\n# 5. Aplicar mudancas\ndeck gateway sync --state kong.yaml\n\`\`\`\n\n**Flags uteis:**\n`--select-tag`: filtrar recursos por tag\n`--workspace`: especificar workspace (Enterprise)\n`--kong-addr`: endereco do Admin API\n\n**IMPORTANTE:**\nNao usar decK com KIC em modo DBless!\nEscolher: CRDs (DBless) OU decK (DB-backed)'
    },
    {
      front: 'Prometheus + Kong — metricas para SRE',
      back: '**Plugin Prometheus (aplicar globalmente):**\n\`\`\`yaml\napiVersion: configuration.konghq.com/v1\nkind: KongClusterPlugin\nmetadata:\n  name: prometheus\n  annotations:\n    kubernetes.io/ingress.class: kong\nplugin: prometheus\nconfig:\n  status_code_metrics: true\n  latency_metrics: true\n\`\`\`\n\n**Metricas SRE essenciais:**\n\`\`\`promql\n# Error rate (SLO)\nrate(kong_http_requests_total{status=~"5.."}[5m]) /\nrate(kong_http_requests_total[5m])\n\n# P99 latencia\nhistogram_quantile(0.99,\n  rate(kong_latency_bucket[5m]))\n\n# Upstream nao saudavel\nkong_upstream_target_health{state="healthchecks_off"} == 0\n\`\`\`\n\n**ServiceMonitor (kube-prometheus-stack):**\nPort: metrics (8100 padrao)\nPath: /metrics\nInterval: 15s'
    },
    {
      front: 'KongUpstreamPolicy — algoritmos de load balancing',
      back: '**round-robin (padrao):**\n- Distribui igualmente entre pods\n- Sem estado\n- Ideal para: servicos stateless\n\n**least-connections:**\n- Envia para o pod com menos conexoes ativas\n- Melhor para requests de duracoes variadas\n- Ideal para: streaming, webhooks\n\n**consistent-hashing:**\n- Mesmo hash (header/IP/cookie) → mesmo pod\n- Sticky sessions sem cookie\n- hashOn: header, consumer, ip, path, query_arg\n- Ideal para: caches por usuario, sessoes\n\n**random:**\n- Completamente aleatorio\n- Util para: testes de chaos\n\n**Configuracao:**\n\`\`\`yaml\nspec:\n  algorithm: consistent-hashing\n  hashOn:\n    header: X-User-ID\n  healthchecks:\n    active:\n      httpPath: /health\n      interval: 10\n\`\`\`'
    },
    {
      front: 'OpenTelemetry no Kong — configuracao e propagacao',
      back: '**Plugin OTel:**\n\`\`\`yaml\nplugin: opentelemetry\nconfig:\n  endpoint: "http://otel-collector:4318/v1/traces"\n  resource_attributes:\n    service.name: "kong-gateway"\n  header_type: w3c    # b3|w3c|jaeger|ot|datadog\n  sampling_rate: 1.0  # 0.0-1.0\n\`\`\`\n\n**Formatos de propagacao:**\n- `w3c` — W3C Trace Context (padrao moderno)\n- `b3` — Zipkin B3 (legado mas comum)\n- `jaeger` — Jaeger proprietary\n- `datadog` — Datadog APM\n\n**Dados gerados por request:**\n- trace_id: ID unico do trace\n- span_id: ID do span Kong\n- duration: tempo no Kong\n- http.method, http.status_code\n- kong.service, kong.route\n\n**Stack sugerida:**\nKong OTel → OTel Collector → Jaeger/Tempo\n+ Grafana para visualizacao de traces'
    },
    {
      front: 'Alta Disponibilidade Kong — checklist de producao',
      back: '**Minimo 2 replicas:**\n\`\`\`yaml\nspec:\n  replicas: 2\n  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxUnavailable: 0   # Zero downtime\n      maxSurge: 1\n\`\`\`\n\n**HPA para escalonamento:**\n\`\`\`yaml\nminReplicas: 2\nmaxReplicas: 10\ntarget CPU: 70%\n\`\`\`\n\n**PodDisruptionBudget:**\n\`\`\`yaml\nspec:\n  minAvailable: 1  # Sempre 1 pod disponivel\n\`\`\`\n\n**Resources (Kong proxy tipico):**\n\`\`\`yaml\nresources:\n  requests:\n    cpu: 100m\n    memory: 256Mi\n  limits:\n    cpu: 1000m\n    memory: 512Mi\n\`\`\`\n\n**Affinity (multi-AZ):**\n\`\`\`yaml\ntopologySpreadConstraints:\n  - maxSkew: 1\n    topologyKey: topology.kubernetes.io/zone\n    whenUnsatisfiable: DoNotSchedule\n\`\`\`'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar observabilidade completa para o Kong em producao, incluindo metricas Prometheus, roteamento avancado com traffic splitting, e garantir alta disponibilidade.',
    objective: 'Aprender a configurar o plugin Prometheus, traffic splitting com HTTPRoute, KongUpstreamPolicy para healthchecks, e HPA para o Kong.',
    duration: '30-35 minutos',
    steps: [
      {
        title: 'Configurar metricas Prometheus no Kong',
        instruction: `Configure o plugin Prometheus no Kong:
1. Criar um KongClusterPlugin prometheus aplicado globalmente
2. Verificar que o endpoint /metrics esta expondo dados
3. Criar um ServiceMonitor para o Prometheus Operator coletar as metricas
4. Consultar metricas basicas usando kubectl port-forward`,
        hints: [
          'O KongClusterPlugin com annotation kubernetes.io/ingress.class: kong se aplica globalmente',
          'O Kong expoe metricas na porta 8100 (ou configuravel via helm)',
          'Verificar metricas sem Prometheus: curl http://localhost:8100/metrics'
        ],
        solution: `\`\`\`yaml
# prometheus-plugin.yaml
apiVersion: configuration.konghq.com/v1
kind: KongClusterPlugin
metadata:
  name: prometheus
  annotations:
    kubernetes.io/ingress.class: kong
plugin: prometheus
config:
  status_code_metrics: true
  latency_metrics: true
  bandwidth_metrics: true
  upstream_health_metrics: true
\`\`\`

\`\`\`bash
kubectl apply -f prometheus-plugin.yaml
\`\`\`

\`\`\`yaml
# service-monitor.yaml (requer kube-prometheus-stack instalado)
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kong-metrics
  namespace: kong
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: kong
  namespaceSelector:
    matchNames:
      - kong
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
\`\`\`

\`\`\`bash
# Aplicar (se kube-prometheus-stack estiver instalado)
kubectl apply -f service-monitor.yaml 2>/dev/null || echo "ServiceMonitor CRD nao disponivel — normal se sem Prometheus Operator"
\`\`\``,
        verify: `\`\`\`bash
# Verificar KongClusterPlugin
kubectl get kongclusterplugin prometheus
# Saida esperada: READY=True

# Fazer algumas requisicoes para gerar metricas
for i in 1 2 3 4 5; do
  curl -s http://localhost:8080/echo > /dev/null 2>&1 || true
done

# Verificar endpoint de metricas (porta 8100 no pod Kong)
KONG_PROXY_POD=\$(kubectl get pods -n kong -l app=kong-proxy -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || \\
  kubectl get pods -n kong -o name | grep proxy | head -1 | cut -d/ -f2)

kubectl port-forward pod/\$KONG_PROXY_POD 8100:8100 -n kong &
sleep 2

# Ver metricas
curl -s http://localhost:8100/metrics | grep -E "^kong_http|^kong_latency" | head -20
# Saida esperada: metricas kong_http_requests_total, kong_latency_bucket, etc.

# Contagem de requests
curl -s http://localhost:8100/metrics | grep "kong_http_requests_total" | head -5

# Fechar port-forward
kill %1 2>/dev/null || true
\`\`\``
      },
      {
        title: 'Configurar traffic splitting com HTTPRoute',
        instruction: `Configure traffic splitting usando Gateway API:
1. Criar dois Deployments e Services simulando versoes "stable" e "canary"
2. Criar GatewayClass e Gateway para o Kong
3. Criar HTTPRoute com weights 80/20 (stable/canary)
4. Verificar que o trafego e distribuido aproximadamente na proporcao configurada`,
        hints: [
          'Os dois Services podem ter o mesmo app mas labels diferentes (version: stable vs version: canary)',
          'Os weights no HTTPRoute sao relativos — 80+20=100 ou 8+2=10 tem o mesmo efeito',
          'Para verificar a distribuicao, fazer muitas requisicoes e contar as respostas de cada versao'
        ],
        solution: `\`\`\`bash
# Criar dois deployments com respostas diferentes para identificar a versao
kubectl create deployment stable --image=nginx:alpine --replicas=1
kubectl expose deployment stable --port=80 --name=api-stable
kubectl create configmap stable-html --from-literal=index.html="<h1>Stable v1</h1>"

kubectl create deployment canary --image=nginx:alpine --replicas=1
kubectl expose deployment canary --port=80 --name=api-canary
\`\`\`

\`\`\`yaml
# gateway.yaml — GatewayClass e Gateway para Kong
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: kong
  annotations:
    konghq.com/gatewayclass-unmanaged: "true"
spec:
  controllerName: konghq.com/kic-gateway-controller
---
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
\`\`\`

\`\`\`yaml
# httproute-split.yaml — Traffic splitting 80/20
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-split
  namespace: default
spec:
  parentRefs:
    - name: kong-gateway
      namespace: kong
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /split
      backendRefs:
        - name: api-stable
          port: 80
          weight: 80
        - name: api-canary
          port: 80
          weight: 20
\`\`\`

\`\`\`bash
kubectl apply -f gateway.yaml
kubectl apply -f httproute-split.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar Gateway e HTTPRoute
kubectl get gateway -n kong
# Saida esperada: kong-gateway Ready

kubectl get httproute -n default
# Saida esperada: api-split listado

# Fazer 10 requisicoes para verificar distribuicao (aproximada)
STABLE=0
CANARY=0
for i in \$(seq 1 20); do
  RESPONSE=\$(curl -s http://localhost:8080/split 2>/dev/null || echo "error")
  if echo "\$RESPONSE" | grep -q "stable\\|Stable" 2>/dev/null; then
    STABLE=\$((STABLE+1))
  else
    CANARY=\$((CANARY+1))
  fi
done
echo "Stable: \$STABLE, Canary: \$CANARY"
# Saida esperada: aproximadamente 16 stable e 4 canary (80/20)

# Verificar HTTPRoute em detalhes
kubectl describe httproute api-split -n default | grep -A10 "Rules:"
# Saida esperada: backendRefs com stable (weight 80) e canary (weight 20)
\`\`\``
      },
      {
        title: 'Configurar KongUpstreamPolicy com healthchecks ativos',
        instruction: `Configure healthchecks ativos no upstream:
1. Criar uma KongUpstreamPolicy com healthchecks ativos na rota /health
2. Associar a policy ao Service via annotation
3. Simular uma falha no backend para ver o healthcheck em acao
4. Verificar as metricas kong_upstream_target_health via Prometheus`,
        hints: [
          'A annotation konghq.com/upstream-policy no Service referencia a KongUpstreamPolicy pelo nome',
          'Healthchecks ativos fazem requests periodicos ao endpoint configurado',
          'Para simular falha, scale o deployment para 0 replicas'
        ],
        solution: `\`\`\`yaml
# upstream-policy.yaml
apiVersion: configuration.konghq.com/v1beta1
kind: KongUpstreamPolicy
metadata:
  name: api-upstream-policy
  namespace: default
spec:
  algorithm: round-robin
  healthchecks:
    active:
      type: http
      httpPath: /
      httpStatuses: [200]
      interval: 5
      timeout: 2
      concurrency: 5
      healthy:
        successes: 2
      unhealthy:
        httpFailures: 2
        timeouts: 2
    passive:
      type: http
      healthy:
        successes: 3
      unhealthy:
        httpFailures: 3
        httpStatuses: [500, 502, 503, 504]
\`\`\`

\`\`\`bash
kubectl apply -f upstream-policy.yaml

# Associar a policy ao Service
kubectl annotate service api-stable \\
  konghq.com/upstream-policy=api-upstream-policy

# Verificar que a policy foi aplicada
kubectl describe service api-stable | grep "konghq.com"
\`\`\`

\`\`\`bash
# Simular falha escalando o deployment para 0
kubectl scale deployment stable --replicas=0

# Aguardar healthcheck detectar a falha
sleep 15

# Ver logs do Kong para ver healthcheck
kubectl logs -n kong -l app=kong-proxy --tail=20 | grep -i "health"
\`\`\``,
        verify: `\`\`\`bash
# Verificar KongUpstreamPolicy
kubectl get kongupstreampolicy -n default 2>/dev/null || \\
  kubectl get kongupstreampolicies -n default 2>/dev/null || \\
  echo "CRD pode variar por versao — verificar kubectl api-resources | grep upstream"

# Verificar annotation no Service
kubectl get service api-stable -o jsonpath='{.metadata.annotations}'
# Saida esperada: konghq.com/upstream-policy: api-upstream-policy

# Verificar metricas de health (se Prometheus ativo)
curl -s http://localhost:8100/metrics | grep "kong_upstream" | head -10
# Saida esperada: kong_upstream_target_health com state diferente apos scale 0

# Restaurar o deployment
kubectl scale deployment stable --replicas=1
kubectl wait deployment/stable --for=condition=Available --timeout=60s

# Verificar que voltou a receber trafego
curl -s http://localhost:8080/split
# Saida esperada: resposta de stable ou canary normalmente
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'HTTPRoute com traffic splitting nao distribui o trafego corretamente',
      difficulty: 'medium',
      symptom: 'O HTTPRoute tem dois backendRefs com weights diferentes (90/10) mas todo o trafego vai para um unico backend. A distribuicao esperada nao ocorre.',
      diagnosis: `\`\`\`bash
# 1. Verificar status do HTTPRoute
kubectl get httproute <nome> -n <namespace>
kubectl describe httproute <nome> -n <namespace>

# 2. Verificar se o GatewayClass e Gateway estao corretos
kubectl get gatewayclass
kubectl get gateway -n kong

# 3. Verificar se os Services backend existem e tem pods
kubectl get svc <nome-stable> <nome-canary> -n <namespace>
kubectl get pods -l app=<nome> -n <namespace>

# 4. Verificar logs do KIC para erros de configuracao
kubectl logs -n kong -l app=ingress-kong -c ingress-controller --tail=30

# 5. Confirmar pesos nos backendRefs
kubectl get httproute <nome> -o yaml | grep -A5 "backendRefs:"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Versao do Kong sem suporte a Gateway API:** Verificar se a versao do Kong Ingress Controller suporta HTTPRoute com weights. Necessario KIC >= 2.8 e Kong >= 3.0.

2. **GatewayClass nao reconhecida:** O campo spec.controllerName deve ser exatamente \`konghq.com/kic-gateway-controller\`. Verificar com kubectl describe gatewayclass kong.

3. **Service backend nao existe:** Se um dos backendRefs referencia um Service inexistente, o Kong pode enviar tudo para o Service valido ou retornar erro. Verificar se ambos os Services existem no namespace correto.

4. **Weights iguais (ambos 0):** Se os dois backendRefs tem weight: 0, o Kong usa o padrao. Verificar os valores exatos com kubectl get httproute -o yaml.

5. **Cache do Kong:** Forcar resync do controller:
\`\`\`bash
kubectl rollout restart deployment -n kong
flux reconcile kustomization kong 2>/dev/null || true
\`\`\``
    },
    {
      title: 'Plugin Prometheus nao expoe metricas — endpoint retorna 404',
      difficulty: 'easy',
      symptom: 'O KongClusterPlugin prometheus foi aplicado mas ao acessar a porta de metricas do Kong (geralmente 8100), o endpoint /metrics retorna 404 ou a conexao e recusada.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o KongClusterPlugin esta Ready
kubectl get kongclusterplugin prometheus
kubectl describe kongclusterplugin prometheus

# 2. Verificar qual porta o Kong usa para metricas
kubectl get svc -n kong
# Procurar: port com nome "metrics" ou porta 8100

# 3. Verificar se o Service de metricas existe
kubectl get svc -n kong | grep -i metric

# 4. Testar porta de metricas diretamente no pod
KONG_POD=\$(kubectl get pods -n kong -l app=kong-proxy -o name | head -1)
kubectl exec \$KONG_POD -n kong -- curl -s localhost:8100/metrics | head -5

# 5. Ver se o plugin foi aplicado globalmente
kubectl get kongclusterplugin -o yaml | grep -A3 "annotations:"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Porta de metricas errada:** A porta padrao pode variar conforme o chart Helm. Verificar com \`kubectl get svc -n kong\` e procurar a porta "metrics". Pode ser 8100, 8001, ou outra.

2. **KongClusterPlugin sem annotation de ingressClass:** O KongClusterPlugin deve ter a annotation \`kubernetes.io/ingress.class: kong\` para ser reconhecido pelo KIC. Sem ela, o plugin e ignorado.

3. **Prometheus nao habilitado no Helm:** Para o endpoint de metricas estar disponivel, o Kong deve ser instalado com suporte a Prometheus. Verificar se o Service de metricas existe.

4. **Plugin prometheus vs o endpoint nativo:** O Kong tem um endpoint de metricas nativo (porta 8001 no modo Admin) e o plugin prometheus adiciona metricas adicionais na porta configurada. Verificar qual e o correto para o ambiente.

5. **Reinstalar com metricas habilitadas:**
\`\`\`bash
helm upgrade kong kong/kong -n kong \\
  --set serviceMonitor.enabled=true \\
  --set serviceMonitor.labels.release=kube-prometheus-stack
\`\`\``
    }
  ]
};
