window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['istio-advanced/istio-observability'] = {
  theory: `
# Observability & Telemetry no Istio

## Relevancia
O Istio fornece observabilidade automatica sem alterar o codigo da aplicacao. Metricas, distributed tracing e access logs sao gerados pelo sidecar Envoy. Integracoes com Kiali, Jaeger, Prometheus e Grafana fornecem visibilidade completa do mesh. A Telemetry API permite configuracao declarativa de telemetria.

## Conceitos Fundamentais

### Metricas Automaticas

O Envoy gera metricas padrao para cada request:

| Metrica | Descricao | Labels |
|---------|-----------|--------|
| istio_requests_total | Total de requests | source, destination, response_code |
| istio_request_duration_milliseconds | Latencia | source, destination |
| istio_request_bytes | Tamanho do request | source, destination |
| istio_response_bytes | Tamanho da response | source, destination |
| istio_tcp_connections_opened_total | Conexoes TCP abertas | source, destination |
| istio_tcp_connections_closed_total | Conexoes TCP fechadas | source, destination |

**Prometheus scraping:**
\`\`\`yaml
# Envoy expoe metricas na porta 15090
# istiod expoe metricas na porta 15014
# Prometheus scrape automatico via annotations
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "15090"
  prometheus.io/path: "/stats/prometheus"
\`\`\`

### Distributed Tracing com Jaeger

O Istio propaga headers de tracing automaticamente entre sidecars:

\`\`\`
Headers propagados:
- x-request-id
- x-b3-traceid
- x-b3-spanid
- x-b3-parentspanid
- x-b3-sampled
- x-b3-flags
- traceparent (W3C)
- tracestate (W3C)
\`\`\`

**Importante:** A aplicacao DEVE propagar esses headers entre requests. O Istio injeta/extrai automaticamente nos sidecars, mas se a app faz chamadas downstream, ela precisa copiar os headers.

**Configurar tracing:**
\`\`\`yaml
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
spec:
  meshConfig:
    defaultConfig:
      tracing:
        sampling: 100.0      # 100% = todas as requests (dev)
        zipkin:
          address: jaeger-collector.istio-system:9411
\`\`\`

### Kiali — Service Mesh Dashboard

Kiali e o dashboard oficial do Istio que fornece:

- **Graph visualization** — topologia do mesh em tempo real
- **Health monitoring** — status de saude dos servicos
- **Configuration validation** — detecta erros em VirtualService, DestinationRule
- **Traffic analysis** — taxa de sucesso, latencia, throughput
- **Tracing integration** — links para spans no Jaeger

\`\`\`bash
# Instalar Kiali (incluido no perfil demo)
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/kiali.yaml

# Acessar dashboard
istioctl dashboard kiali
\`\`\`

### Telemetry API

A Telemetry API permite configuracao declarativa de metricas, tracing e access logs:

\`\`\`yaml
apiVersion: telemetry.istio.io/v1alpha1
kind: Telemetry
metadata:
  name: namespace-telemetry
  namespace: production
spec:
  # Metricas customizadas
  metrics:
    - providers:
        - name: prometheus
      overrides:
        - match:
            metric: REQUEST_COUNT
            mode: CLIENT_AND_SERVER
          tagOverrides:
            request_host:
              value: "request.host"
  # Tracing
  tracing:
    - providers:
        - name: zipkin
      randomSamplingPercentage: 10.0
      customTags:
        environment:
          literal:
            value: "production"
  # Access Logging
  accessLogging:
    - providers:
        - name: envoy
      filter:
        expression: "response.code >= 400"
\`\`\`

### Access Logging

Configurar formato e filtro de access logs:

\`\`\`yaml
apiVersion: telemetry.istio.io/v1alpha1
kind: Telemetry
metadata:
  name: access-log
  namespace: istio-system       # mesh-wide
spec:
  accessLogging:
    - providers:
        - name: envoy
\`\`\`

\`\`\`yaml
# Formato customizado via MeshConfig
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
spec:
  meshConfig:
    accessLogFile: /dev/stdout
    accessLogEncoding: JSON
    accessLogFormat: |
      {
        "timestamp": "%START_TIME%",
        "method": "%REQ(:METHOD)%",
        "path": "%REQ(X-ENVOY-ORIGINAL-PATH?:PATH)%",
        "protocol": "%PROTOCOL%",
        "response_code": "%RESPONSE_CODE%",
        "response_flags": "%RESPONSE_FLAGS%",
        "upstream_host": "%UPSTREAM_HOST%",
        "duration": "%DURATION%"
      }
\`\`\`

### Metricas Customizadas com EnvoyFilter

\`\`\`yaml
apiVersion: networking.istio.io/v1alpha3
kind: EnvoyFilter
metadata:
  name: custom-metrics
  namespace: istio-system
spec:
  configPatches:
    - applyTo: HTTP_FILTER
      match:
        context: SIDECAR_INBOUND
        listener:
          filterChain:
            filter:
              name: envoy.filters.network.http_connection_manager
              subFilter:
                name: envoy.filters.http.router
      patch:
        operation: INSERT_BEFORE
        value:
          name: istio.stats
          typed_config:
            "@type": type.googleapis.com/udpa.type.v1.TypedStruct
            type_url: type.googleapis.com/envoy.extensions.filters.http.wasm.v3.Wasm
            value:
              config:
                configuration:
                  "@type": type.googleapis.com/google.protobuf.StringValue
                  value: |
                    {
                      "metrics": [
                        {
                          "name": "custom_request_count",
                          "dimensions": {
                            "user_agent": "request.headers['user-agent']"
                          }
                        }
                      ]
                    }
\`\`\`

### Erros Comuns

1. **Tracing incompleto** — a app nao propaga headers de tracing entre chamadas downstream
2. **Sampling 100% em producao** — causa overhead significativo; use 1-10%
3. **Access logs nao aparecem** — verificar Telemetry API e accessLogFile no MeshConfig
4. **Metricas missing** — sidecar nao foi injetado ou stats filter foi removido

## Killer.sh Style Challenge

> **Cenario:** Configure observabilidade completa para o namespace production: (1) tracing a 10% com tag customizada "env=production", (2) access logs JSON apenas para erros (status >= 400), (3) metricas padrao do Prometheus com label customizado para request_host.
`,
  quiz: [
    {
      question: 'Quais metricas o Envoy sidecar gera automaticamente?',
      options: [
        'Apenas latencia',
        'istio_requests_total, istio_request_duration_milliseconds, istio_request_bytes, istio_response_bytes',
        'Metricas de CPU e memoria do Pod',
        'Apenas contagem de requests'
      ],
      correct: 1,
      explanation: 'O Envoy gera automaticamente metricas padrao: total de requests, latencia, tamanho de request/response, e conexoes TCP. Todas incluem labels como source, destination e response_code.',
      reference: 'Conceito relacionado: Metricas sao expostas na porta 15090 do sidecar para scraping do Prometheus.'
    },
    {
      question: 'Qual e a responsabilidade da aplicacao no distributed tracing do Istio?',
      options: [
        'Nenhuma, o Istio faz tudo automaticamente',
        'A aplicacao deve propagar os headers de tracing (x-b3-*, traceparent) entre chamadas downstream',
        'A aplicacao deve gerar spans manualmente',
        'A aplicacao deve enviar metricas para o Jaeger'
      ],
      correct: 1,
      explanation: 'Embora o Istio injete headers de tracing automaticamente no sidecar, a aplicacao deve propagar esses headers ao fazer chamadas para outros servicos. Sem isso, os traces ficam fragmentados.',
      reference: 'Conceito relacionado: Headers B3 (Zipkin) e W3C (traceparent/tracestate) sao os formatos suportados.'
    },
    {
      question: 'O que o Kiali fornece que Prometheus e Grafana nao fornecem nativamente?',
      options: [
        'Metricas de latencia',
        'Visualizacao da topologia do mesh e validacao de configuracao Istio',
        'Alertas automaticos',
        'Storage de metricas'
      ],
      correct: 1,
      explanation: 'O Kiali e o dashboard oficial do Istio que mostra o grafo de servicos do mesh, status de saude, validacao de CRDs do Istio (erros em VirtualService, etc.) e integracao com tracing.',
      reference: 'Conceito relacionado: Kiali e instalado como addon — kubectl apply -f samples/addons/kiali.yaml.'
    },
    {
      question: 'Como configurar access logs apenas para requests com erro no Istio?',
      options: [
        'Editar o ConfigMap do Envoy',
        'Usar Telemetry API com filter expression "response.code >= 400"',
        'Configurar log level no istiod',
        'Nao e possivel filtrar access logs'
      ],
      correct: 1,
      explanation: 'A Telemetry API permite configurar filtros declarativos para access logs. A expressao "response.code >= 400" captura apenas respostas de erro, reduzindo volume de logs.',
      reference: 'Conceito relacionado: accessLogEncoding pode ser TEXT ou JSON, configuravel no MeshConfig.'
    },
    {
      question: 'Qual a taxa de sampling recomendada para tracing em producao?',
      options: [
        '100% para capturar todos os traces',
        '1-10% para balancear visibilidade e overhead',
        '0% para desabilitar completamente',
        '50% como valor padrao'
      ],
      correct: 1,
      explanation: 'Em producao, 100% de sampling causa overhead significativo de processamento e armazenamento. O recomendado e 1-10%, que fornece visibilidade suficiente sem impacto na performance.',
      reference: 'Conceito relacionado: randomSamplingPercentage na Telemetry API ou meshConfig.defaultConfig.tracing.sampling.'
    },
    {
      question: 'Em qual porta o sidecar Envoy expoe metricas para o Prometheus?',
      options: [
        '9090',
        '15090',
        '8080',
        '3000'
      ],
      correct: 1,
      explanation: 'O sidecar Envoy expoe metricas Prometheus na porta 15090 no path /stats/prometheus. O istiod expoe suas metricas na porta 15014.',
      reference: 'Conceito relacionado: Prometheus scrape annotations sao adicionadas automaticamente pelo sidecar injector.'
    },
    {
      question: 'Qual API declarativa do Istio configura metricas, tracing e access logs?',
      options: [
        'EnvoyFilter',
        'Telemetry API (telemetry.istio.io/v1alpha1)',
        'MeshConfig apenas',
        'DestinationRule'
      ],
      correct: 1,
      explanation: 'A Telemetry API (kind: Telemetry) e a forma declarativa e recomendada para configurar metricas, tracing e access logs. Suporta configuracao mesh-wide, por namespace ou por workload.',
      reference: 'Conceito relacionado: Telemetry API substitui configuracoes no MeshConfig e EnvoyFilter para telemetria.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao as metricas padrao geradas pelo Envoy sidecar?',
      back: '| Metrica | Descricao |\n|---------|----------|\n| **istio_requests_total** | Total de requests |\n| **istio_request_duration_milliseconds** | Latencia (histogram) |\n| **istio_request_bytes** | Tamanho do request |\n| **istio_response_bytes** | Tamanho da response |\n| **istio_tcp_connections_opened_total** | Conexoes TCP abertas |\n| **istio_tcp_connections_closed_total** | Conexoes TCP fechadas |\n\n**Labels comuns:** source_workload, destination_service, response_code, request_protocol'
    },
    {
      front: 'Como funciona distributed tracing no Istio?',
      back: '1. Sidecar do source **injeta** headers de tracing\n2. Aplicacao **propaga** headers para chamadas downstream\n3. Sidecar do destination **extrai** headers\n4. Spans sao enviados ao collector (Jaeger/Zipkin)\n\n**Headers:** x-b3-traceid, x-b3-spanid, traceparent (W3C)\n\n**IMPORTANTE:** A app DEVE propagar headers — o Istio so injeta/extrai nos sidecars.\n\n**Sampling:** 1-10% em prod, 100% em dev'
    },
    {
      front: 'O que o Kiali oferece como dashboard do Istio?',
      back: '**Visualizacao:**\n- Grafo de servicos em tempo real\n- Fluxo de trafego entre services\n- Taxa de sucesso/erro por servico\n\n**Validacao:**\n- Detecta erros em VirtualService, DestinationRule\n- Verifica configuracao do mesh\n\n**Integracao:**\n- Links para traces no Jaeger\n- Metricas do Prometheus/Grafana\n\n**Instalacao:**\nkubectl apply -f samples/addons/kiali.yaml\nistioctl dashboard kiali'
    },
    {
      front: 'Como configurar a Telemetry API?',
      back: '**Escopo:** mesh (istio-system), namespace, workload\n\n**Tres pilares:**\n\n1. **Metricas:**\n\`\`\`yaml\nmetrics:\n  - providers: [{name: prometheus}]\n    overrides: [{tagOverrides: ...}]\n\`\`\`\n\n2. **Tracing:**\n\`\`\`yaml\ntracing:\n  - providers: [{name: zipkin}]\n    randomSamplingPercentage: 10\n    customTags: ...\n\`\`\`\n\n3. **Access Logging:**\n\`\`\`yaml\naccessLogging:\n  - providers: [{name: envoy}]\n    filter: {expression: "..."}\n\`\`\`'
    },
    {
      front: 'Qual a diferenca entre MeshConfig e Telemetry API para telemetria?',
      back: '**MeshConfig:**\n- Configuracao global via IstioOperator\n- accessLogFile, accessLogFormat\n- tracing.sampling\n- Menos flexivel, mesh-wide apenas\n\n**Telemetry API:**\n- CRD declarativo (kind: Telemetry)\n- Granularidade: mesh/namespace/workload\n- Filtros com expressoes CEL\n- Tags customizadas\n- API recomendada (mais recente)\n\n**Preferir** Telemetry API para novas configuracoes.'
    },
    {
      front: 'Quais portas de telemetria sao importantes no Istio?',
      back: '| Porta | Componente | Funcao |\n|-------|-----------|--------|\n| **15090** | Envoy sidecar | Metricas Prometheus |\n| **15014** | istiod | Metricas do control plane |\n| **15020** | Envoy sidecar | Health check / merged metrics |\n| **9411** | Jaeger collector | Recebe spans (Zipkin format) |\n| **16685** | Jaeger query | API de consulta |\n| **20001** | Kiali | Dashboard web |\n| **3000** | Grafana | Dashboards |'
    },
    {
      front: 'Como depurar traces fragmentados no Jaeger?',
      back: '**Causa:** A aplicacao nao propaga headers de tracing.\n\n**Verificacao:**\n1. Verificar se headers B3 ou W3C chegam ao servico\n2. Verificar se a app copia headers ao fazer chamadas downstream\n\n**Solucao:**\n- Propagar headers: x-request-id, x-b3-traceid, x-b3-spanid, traceparent\n- Usar SDK de tracing (OpenTelemetry) para propagacao automatica\n- Verificar sampling rate > 0%\n\n**Dica:** Em frameworks REST, usar middleware/interceptor que copia headers automaticamente.'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar observabilidade completa para o mesh: metricas no Prometheus, tracing no Jaeger e access logs filtrados.',
    objective: 'Instalar addons de observabilidade, configurar Telemetry API e verificar metricas, traces e logs.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Instalar Addons de Observabilidade',
        instruction: `Instale Prometheus, Grafana, Jaeger e Kiali como addons do Istio.

\`\`\`bash
# Instalar addons (assumindo que Istio ja esta instalado)
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/prometheus.yaml
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/grafana.yaml
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/jaeger.yaml
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/kiali.yaml

# Aguardar Pods ficarem prontos
kubectl rollout status deployment prometheus -n istio-system
kubectl rollout status deployment grafana -n istio-system
kubectl rollout status deployment jaeger -n istio-system
kubectl rollout status deployment kiali -n istio-system

# Gerar trafego para popular metricas
for i in \$(seq 1 100); do
  kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null http://productpage:9080/productpage
done
\`\`\``,
        hints: [
          'Os addons sao opcionais — o Istio funciona sem eles',
          'Em producao, use instalacoes dedicadas de Prometheus e Grafana',
          'O perfil demo ja inclui tracing habilitado com 100% sampling'
        ],
        solution: `\`\`\`bash
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/prometheus.yaml
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/grafana.yaml
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/jaeger.yaml
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/kiali.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar Pods dos addons
kubectl get pods -n istio-system -l app=prometheus
kubectl get pods -n istio-system -l app=grafana
kubectl get pods -n istio-system -l app=jaeger
kubectl get pods -n istio-system -l app=kiali
# Saida esperada: todos com STATUS Running

# Verificar metricas no Prometheus
kubectl exec -n istio-system deploy/prometheus -- wget -qO- 'http://localhost:9090/api/v1/query?query=istio_requests_total' | head -5
# Saida esperada: resultados com metricas do Istio
\`\`\``
      },
      {
        title: 'Configurar Telemetry API',
        instruction: `Configure tracing com sampling de 10%, access logs apenas para erros, e tags customizadas.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: telemetry.istio.io/v1alpha1
kind: Telemetry
metadata:
  name: production-telemetry
  namespace: default
spec:
  # Tracing com sampling de 10% e tags customizadas
  tracing:
    - providers:
        - name: zipkin
      randomSamplingPercentage: 10.0
      customTags:
        environment:
          literal:
            value: "staging"
        cluster_name:
          literal:
            value: "cluster-1"
  # Access logs apenas para erros
  accessLogging:
    - providers:
        - name: envoy
      filter:
        expression: "response.code >= 400"
  # Metricas com label customizado
  metrics:
    - providers:
        - name: prometheus
      overrides:
        - match:
            metric: REQUEST_COUNT
            mode: CLIENT_AND_SERVER
          tagOverrides:
            request_host:
              value: "request.host"
EOF
\`\`\``,
        hints: [
          'Telemetry API suporta escopo mesh (istio-system), namespace ou workload',
          'randomSamplingPercentage: 10 = 10% dos traces sao capturados',
          'filter.expression usa CEL (Common Expression Language)',
          'Tags customizadas sao adicionadas a todos os spans'
        ],
        solution: `\`\`\`bash
kubectl apply -f telemetry-config.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar Telemetry
kubectl get telemetry production-telemetry
# Saida esperada: production-telemetry   Xs

# Verificar configuracao aplicada
kubectl get telemetry production-telemetry -o yaml | grep -A5 "tracing"
# Saida esperada: randomSamplingPercentage: 10

# Gerar trafego com erro para testar access logs
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://productpage:9080/nonexistent
# Saida esperada: 404

# Verificar access logs no sidecar (apenas erros)
kubectl logs deploy/productpage-v1 -c istio-proxy --tail=5 | grep "404"
# Saida esperada: log entry com response_code 404
\`\`\``
      },
      {
        title: 'Verificar Tracing e Metricas',
        instruction: `Gere trafego e verifique que traces e metricas sao coletados corretamente.

\`\`\`bash
# Gerar trafego variado
for i in \$(seq 1 50); do
  kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null http://productpage:9080/productpage
  kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null http://productpage:9080/nonexistent
done

# Verificar metricas no Prometheus
kubectl exec -n istio-system deploy/prometheus -- wget -qO- \\
  'http://localhost:9090/api/v1/query?query=sum(istio_requests_total)%20by%20(destination_service_name,response_code)' 2>/dev/null

# Acessar dashboards (em terminal separado)
# istioctl dashboard kiali
# istioctl dashboard jaeger
# istioctl dashboard grafana

# Verificar traces no Jaeger
kubectl exec -n istio-system deploy/jaeger -- wget -qO- \\
  'http://localhost:16686/api/traces?service=productpage.default&limit=5' 2>/dev/null | head -20
\`\`\``,
        hints: [
          'Com 10% de sampling, apenas ~10% dos traces serao capturados',
          'Metricas sao sempre 100% (independente de sampling de tracing)',
          'Use istioctl dashboard para acessar UIs localmente',
          'Access logs filtrados so mostram requests com status >= 400'
        ],
        solution: `\`\`\`bash
# Gerar trafego
for i in \$(seq 1 50); do
  kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null http://productpage:9080/productpage
done

# Verificar metricas
kubectl exec -n istio-system deploy/prometheus -- wget -qO- 'http://localhost:9090/api/v1/query?query=istio_requests_total'
\`\`\``,
        verify: `\`\`\`bash
# Verificar que metricas do Istio existem no Prometheus
kubectl exec -n istio-system deploy/prometheus -- wget -qO- 'http://localhost:9090/api/v1/label/__name__/values' 2>/dev/null | grep istio_requests
# Saida esperada: "istio_requests_total" na lista

# Verificar que Kiali esta acessivel
kubectl get svc kiali -n istio-system
# Saida esperada: kiali   ClusterIP   ...   20001/TCP

# Verificar que Jaeger esta acessivel
kubectl get svc tracing -n istio-system
# Saida esperada: tracing   ClusterIP   ...   80/TCP,16685/TCP

# Verificar Telemetry aplicada
kubectl get telemetry --all-namespaces
# Saida esperada: production-telemetry no namespace default
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Metricas do Istio nao aparecem no Prometheus',
      difficulty: 'easy',
      symptom: 'Prometheus esta rodando mas as metricas istio_requests_total e outras metricas do Istio nao aparecem.',
      diagnosis: `\`\`\`bash
# Verificar se o sidecar esta presente
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{" containers="}{range .spec.containers[*]}{.name}{","}{end}{"\\n"}{end}'

# Verificar se metricas sao expostas pelo sidecar
kubectl exec <pod> -c istio-proxy -- curl -s localhost:15090/stats/prometheus | grep istio_requests

# Verificar targets no Prometheus
kubectl exec -n istio-system deploy/prometheus -- wget -qO- 'http://localhost:9090/api/v1/targets' 2>/dev/null | grep "istio-proxy"

# Verificar Prometheus scrape config
kubectl get configmap prometheus -n istio-system -o yaml | grep istio
\`\`\``,
      solution: `**Causas comuns:**

1. **Sidecar nao injetado:** Sem o sidecar Envoy, nao ha metricas do Istio. Verificar injection label no namespace.

2. **Prometheus nao esta fazendo scrape:** Verificar que o Prometheus tem o job de scrape para istio-proxy configurado.

3. **Stats filter removido:** Se um EnvoyFilter removeu o stats filter, metricas nao sao geradas.

4. **Firewall/NetworkPolicy:** Verificar que o Prometheus consegue acessar a porta 15090 dos Pods.`
    },
    {
      title: 'Traces fragmentados no Jaeger',
      difficulty: 'medium',
      symptom: 'Os traces no Jaeger mostram spans individuais mas nao formam uma cadeia completa. Cada servico aparece como trace separado.',
      diagnosis: `\`\`\`bash
# Verificar headers de tracing no proxy
kubectl logs <pod> -c istio-proxy | grep -i "x-b3\\|traceparent"

# Verificar sampling rate
kubectl get configmap istio -n istio-system -o jsonpath='{.data.mesh}' | grep sampling

# Verificar Telemetry
kubectl get telemetry --all-namespaces -o yaml | grep -A5 tracing

# Verificar se a app propaga headers (testar manualmente)
kubectl exec <pod> -c <app-container> -- curl -v http://<downstream-service> -H "x-b3-traceid: test123"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **App nao propaga headers:** A causa mais comum. A aplicacao deve copiar headers x-b3-* ou traceparent ao fazer chamadas downstream.

Solucao: Adicionar middleware que propaga headers automaticamente. Em muitos frameworks, isso e um interceptor HTTP.

2. **Sampling inconsistente:** Se diferentes servicos tem sampling rates diferentes, traces podem ficar incompletos. Padronizar via Telemetry API no namespace.

3. **Collector inacessivel:** Se o Jaeger collector nao esta acessivel, spans sao descartados. Verificar Service e endpoints.

4. **Formato de tracing incompativel:** Garantir que todos os servicos usam o mesmo formato (B3 ou W3C).`
    },
    {
      title: 'Access logs nao aparecem mesmo com Telemetry configurada',
      difficulty: 'medium',
      symptom: 'Configurou Telemetry API com accessLogging mas os logs nao aparecem no stdout do container istio-proxy.',
      diagnosis: `\`\`\`bash
# Verificar Telemetry resource
kubectl get telemetry --all-namespaces -o yaml

# Verificar MeshConfig
kubectl get configmap istio -n istio-system -o jsonpath='{.data.mesh}' | grep accessLog

# Verificar logs do proxy
kubectl logs <pod> -c istio-proxy --tail=20

# Verificar se ha trafego passando
kubectl exec <pod> -c istio-proxy -- curl -s localhost:15000/stats | grep downstream_rq

# Verificar configuracao aplicada no proxy
istioctl proxy-config log <pod> --level debug
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Provider errado:** O provider deve ser "envoy" para logs no stdout do istio-proxy.

2. **Filtro muito restritivo:** Se a expression filtra por response.code >= 500, erros 4xx nao aparecem. Ajuste o filtro.

3. **Escopo errado:** A Telemetry deve estar no namespace correto ou em istio-system para mesh-wide.

4. **MeshConfig sobrescrevendo:** Se accessLogFile esta vazio no MeshConfig, pode desabilitar logs globalmente. Verificar com:
\`\`\`bash
kubectl get cm istio -n istio-system -o jsonpath='{.data.mesh}' | grep accessLog
\`\`\`

5. **Proxy nao atualizou:** Apos aplicar Telemetry, pode ser necessario aguardar ou reiniciar Pods para o proxy recarregar a configuracao.`
    }
  ]
};
