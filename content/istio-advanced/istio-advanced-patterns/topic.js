window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['istio-advanced/istio-advanced-patterns'] = {
  theory: `
# Advanced Traffic Patterns no Istio

## Relevancia
Padroes avancados de trafego sao essenciais para operacoes em producao de larga escala. Canary progressivo, circuit breaking, locality-aware load balancing, service entry e multi-cluster sao ferramentas que um SRE deve dominar para garantir disponibilidade e performance.

## Conceitos Fundamentais

### Canary Progressivo com Flagger

Embora o Istio suporte traffic shifting manual via pesos no VirtualService, o **Flagger** automatiza canary progressivo:

\`\`\`
Flagger Workflow:
1. Deploy nova versao (v2)
2. Flagger cria canary VirtualService
3. Incrementa peso gradualmente: 5% -> 10% -> 25% -> 50% -> 100%
4. Analisa metricas (success rate, latency)
5. Rollback automatico se metricas degradam
\`\`\`

\`\`\`yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: reviews
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: reviews
  service:
    port: 9080
  analysis:
    interval: 30s
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
      - name: request-success-rate
        thresholdRange:
          min: 99
        interval: 30s
      - name: request-duration
        thresholdRange:
          max: 500
        interval: 30s
\`\`\`

### Locality-Aware Load Balancing

O Istio distribui trafego preferencialmente para endpoints na mesma zona/regiao:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  trafficPolicy:
    loadBalancer:
      localityLbSetting:
        enabled: true
        failover:
          - from: us-east-1
            to: us-west-2
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
\`\`\`

Prioridade: mesmo node > mesma zona > mesma regiao > failover.

### ServiceEntry — Servicos Externos

ServiceEntry registra servicos fora do mesh para que o Istio possa aplicar politicas de trafego:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: external-api
spec:
  hosts:
    - api.external-service.com
  ports:
    - number: 443
      name: https
      protocol: TLS
  resolution: DNS
  location: MESH_EXTERNAL
\`\`\`

Combinado com VirtualService para controle fino:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: external-api
spec:
  hosts:
    - api.external-service.com
  http:
    - timeout: 3s
      retries:
        attempts: 2
        perTryTimeout: 1s
      route:
        - destination:
            host: api.external-service.com
\`\`\`

### Rate Limiting com EnvoyFilter

\`\`\`yaml
apiVersion: networking.istio.io/v1alpha3
kind: EnvoyFilter
metadata:
  name: rate-limit
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
      patch:
        operation: INSERT_BEFORE
        value:
          name: envoy.filters.http.local_ratelimit
          typed_config:
            "@type": type.googleapis.com/udpa.type.v1.TypedStruct
            type_url: type.googleapis.com/envoy.extensions.filters.http.local_ratelimit.v3.LocalRateLimit
            value:
              stat_prefix: http_local_rate_limiter
              token_bucket:
                max_tokens: 100
                tokens_per_fill: 100
                fill_interval: 60s
              filter_enabled:
                runtime_key: local_rate_limit_enabled
                default_value:
                  numerator: 100
                  denominator: HUNDRED
\`\`\`

### Wasm Extensions

O Istio suporta extensoes WebAssembly para customizar o comportamento do Envoy:

\`\`\`yaml
apiVersion: extensions.istio.io/v1alpha1
kind: WasmPlugin
metadata:
  name: custom-auth
  namespace: production
spec:
  selector:
    matchLabels:
      app: reviews
  url: oci://registry.example.com/wasm-plugins/custom-auth:v1
  phase: AUTHN
  pluginConfig:
    header: "x-custom-auth"
    required: true
\`\`\`

### Multi-Cluster com Istio

O Istio suporta dois modelos de multi-cluster:

| Modelo | Control Plane | Network | Uso |
|--------|---------------|---------|-----|
| Primary-Remote | 1 primario, N remotos | Mesma ou diferente | Simples, centralized |
| Multi-Primary | N primarios | Mesma ou diferente | HA, cada cluster independente |

\`\`\`bash
# Configurar multi-cluster (primary-remote)
# No cluster primario:
istioctl install --set values.global.meshID=mesh1 \\
  --set values.global.multiCluster.clusterName=cluster1 \\
  --set values.global.network=network1

# No cluster remoto:
istioctl install --set profile=remote \\
  --set values.global.remotePilotAddress=<PRIMARY_ISTIOD_IP>
\`\`\`

### Erros Comuns

1. **ServiceEntry sem DNS resolution** — usar \`resolution: DNS\` para hosts externos com IP dinamico
2. **EnvoyFilter versao errada** — EnvoyFilter e acoplado a versao do Envoy e pode quebrar em upgrades
3. **Locality LB sem outlierDetection** — failover de localidade requer circuit breaker configurado
4. **Wasm plugin nao carrega** — verificar que a imagem OCI e acessivel e o formato e compativel

## Killer.sh Style Challenge

> **Cenario:** Configure ServiceEntry para acessar uma API externa (api.example.com:443). Aplique timeout de 5s e retry de 2 tentativas. Adicione circuit breaker com ejecao apos 3 erros consecutivos e failover de localidade.
`,
  quiz: [
    {
      question: 'Qual a funcao do ServiceEntry no Istio?',
      options: [
        'Registrar servicos internos no mesh',
        'Registrar servicos externos para que o Istio aplique politicas de trafego',
        'Criar entrada DNS para servicos',
        'Expor servicos internos externamente'
      ],
      correct: 1,
      explanation: 'ServiceEntry registra servicos que estao fora do mesh (APIs externas, bancos de dados) para que o Istio possa aplicar retries, timeouts, circuit breaking e observabilidade ao trafego de saida.',
      reference: 'Conceito relacionado: ServiceEntry com location MESH_EXTERNAL vs MESH_INTERNAL.'
    },
    {
      question: 'Qual campo do DestinationRule configura locality-aware load balancing?',
      options: [
        'trafficPolicy.loadBalancer.simple',
        'trafficPolicy.loadBalancer.localityLbSetting',
        'trafficPolicy.localityAware',
        'spec.locality.enabled'
      ],
      correct: 1,
      explanation: 'localityLbSetting dentro de trafficPolicy.loadBalancer habilita distribuicao de trafego baseada em localidade (zona/regiao) com failover configuravel.',
      reference: 'Conceito relacionado: outlierDetection e necessario para que o failover de localidade funcione.'
    },
    {
      question: 'O que sao WasmPlugins no Istio?',
      options: [
        'Plugins Java para o istiod',
        'Extensoes WebAssembly que customizam o comportamento do Envoy proxy',
        'Modulos Python para observabilidade',
        'Drivers de rede para o CNI'
      ],
      correct: 1,
      explanation: 'WasmPlugins permitem estender o Envoy proxy com logica customizada compilada para WebAssembly. Eles podem ser usados para autenticacao, transformacao de headers, rate limiting e mais.',
      reference: 'Conceito relacionado: Fases de plugin — AUTHN, AUTHZ, STATS.'
    },
    {
      question: 'Qual a diferenca entre os modelos multi-cluster Primary-Remote e Multi-Primary?',
      options: [
        'Primary-Remote tem 1 control plane centralizado; Multi-Primary tem N control planes independentes',
        'Primary-Remote suporta apenas 2 clusters; Multi-Primary suporta N clusters',
        'Nao ha diferenca funcional',
        'Primary-Remote usa mTLS; Multi-Primary usa plaintext'
      ],
      correct: 0,
      explanation: 'No Primary-Remote, um cluster primario roda o istiod e os remotos conectam-se a ele. No Multi-Primary, cada cluster tem seu proprio istiod e eles sincronizam entre si.',
      reference: 'Conceito relacionado: meshID, clusterName e network para configuracao multi-cluster.'
    },
    {
      question: 'Por que locality load balancing requer outlierDetection?',
      options: [
        'Para coletar metricas de localidade',
        'Para detectar endpoints com falha e habilitar failover automatico para outra zona',
        'Para limitar conexoes por localidade',
        'Para configurar DNS por regiao'
      ],
      correct: 1,
      explanation: 'O failover de localidade so ocorre quando endpoints locais sao ejetados pelo circuit breaker (outlierDetection). Sem ele, o trafego continua sendo enviado para endpoints com falha na mesma zona.',
      reference: 'Conceito relacionado: consecutive5xxErrors e baseEjectionTime no outlierDetection.'
    },
    {
      question: 'Qual o risco de usar EnvoyFilter em producao?',
      options: [
        'Nao ha riscos',
        'E acoplado a versao do Envoy e pode quebrar em upgrades do Istio',
        'Nao suporta HTTPS',
        'Requer restart do istiod'
      ],
      correct: 1,
      explanation: 'EnvoyFilter manipula a configuracao interna do Envoy, que pode mudar entre versoes. Um filter que funciona no Envoy 1.28 pode nao funcionar no 1.29. Use com cautela e prefira APIs de alto nivel.',
      reference: 'Conceito relacionado: Prefira WasmPlugin e Telemetry API quando possivel.'
    },
    {
      question: 'No Flagger, o que acontece quando as metricas de canary degradam abaixo do threshold?',
      options: [
        'O peso continua aumentando',
        'O Flagger faz rollback automatico para a versao anterior',
        'O deploy e pausado indefinidamente',
        'O Flagger envia alerta mas nao age'
      ],
      correct: 1,
      explanation: 'O Flagger monitora metricas (success rate, latency) durante o canary. Se os thresholds definidos na analise nao sao atingidos apos N tentativas (threshold), ele faz rollback automatico.',
      reference: 'Conceito relacionado: stepWeight, maxWeight e interval na configuracao do Canary.'
    }
  ],
  flashcards: [
    {
      front: 'O que e ServiceEntry e quando usar?',
      back: '**ServiceEntry** registra servicos externos no mesh Istio.\n\n**Quando usar:**\n- Acessar APIs externas com retries/timeouts\n- Aplicar circuit breaker em dependencias externas\n- Obter metricas de trafego egress\n- Controlar quais servicos externos sao acessiveis\n\n**location:** MESH_EXTERNAL (fora) ou MESH_INTERNAL (dentro)\n**resolution:** DNS, STATIC, ou NONE'
    },
    {
      front: 'Como funciona locality-aware load balancing?',
      back: 'O Istio prioriza endpoints pela localidade:\n\n1. **Mesmo node** (prioridade maxima)\n2. **Mesma zona** (ex: us-east-1a)\n3. **Mesma regiao** (ex: us-east-1)\n4. **Failover** (outra regiao)\n\n**Requisitos:**\n- Nodes com labels topology.kubernetes.io/zone\n- DestinationRule com localityLbSetting.enabled: true\n- outlierDetection configurado (necessario para failover)'
    },
    {
      front: 'Quais sao os dois modelos de multi-cluster do Istio?',
      back: '**Primary-Remote:**\n- 1 cluster com istiod (primario)\n- N clusters conectam ao primario\n- Simples, centralizado\n- Single point of failure no control plane\n\n**Multi-Primary:**\n- Cada cluster tem seu istiod\n- Sincronizam entre si\n- Alta disponibilidade\n- Mais complexo de operar'
    },
    {
      front: 'O que e o Flagger e como se integra com Istio?',
      back: '**Flagger** e um operador de progressive delivery que automatiza canary deployments.\n\n**Integracao com Istio:**\n1. Monitora Deployment alvo\n2. Cria VirtualService e DestinationRule\n3. Incrementa peso gradualmente (stepWeight)\n4. Analisa metricas do Prometheus\n5. Rollback automatico se metricas degradam\n\nConfigurado via CRD Canary com analysis.metrics.'
    },
    {
      front: 'Qual a diferenca entre EnvoyFilter e WasmPlugin?',
      back: '**EnvoyFilter:**\n- Patches diretos na config do Envoy\n- Acoplado a versao do Envoy\n- Pode quebrar em upgrades\n- Mais flexivel mas arriscado\n\n**WasmPlugin:**\n- Logica customizada em WebAssembly\n- API estavel e portavel\n- Funciona entre versoes\n- Mais seguro para producao\n- Suporta OCI registry\n\nPrefira WasmPlugin quando possivel.'
    },
    {
      front: 'Como configurar rate limiting no Istio?',
      back: '**Local Rate Limiting** (por proxy):\n- Usa EnvoyFilter com local_ratelimit\n- Configura token_bucket (max_tokens, fill_interval)\n- Simples, sem dependencia externa\n\n**Global Rate Limiting:**\n- Usa servico externo de rate limit (envoy ratelimit service)\n- Compartilha contadores entre proxies\n- Mais complexo mas consistente\n\nAlternativa: usar WasmPlugin para logica customizada.'
    },
    {
      front: 'Como o Istio lida com trafego para servicos externos por padrao?',
      back: '**Modo ALLOW_ANY (padrao):**\n- Todo trafego egress e permitido\n- Sem observabilidade para servicos nao registrados\n\n**Modo REGISTRY_ONLY:**\n- Apenas servicos com ServiceEntry sao acessiveis\n- Mais seguro mas requer registro explicito\n\nConfigurar via:\n\`meshConfig.outboundTrafficPolicy.mode\`\n\nRecomendacao: usar REGISTRY_ONLY em producao para controle total.'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar acesso controlado a uma API externa, com circuit breaker e locality-aware load balancing para um servico interno.',
    objective: 'Configurar ServiceEntry, DestinationRule com locality LB e circuit breaker, e testar failover.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Configurar ServiceEntry para API Externa',
        instruction: `Registre uma API externa no mesh usando ServiceEntry e aplique timeout e retries.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: external-api
  namespace: default
spec:
  hosts:
    - httpbin.org
  ports:
    - number: 443
      name: https
      protocol: TLS
    - number: 80
      name: http
      protocol: HTTP
  resolution: DNS
  location: MESH_EXTERNAL
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: external-api
  namespace: default
spec:
  hosts:
    - httpbin.org
  http:
    - timeout: 5s
      retries:
        attempts: 2
        perTryTimeout: 2s
        retryOn: 5xx,reset,connect-failure
      route:
        - destination:
            host: httpbin.org
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: external-api
  namespace: default
spec:
  host: httpbin.org
  trafficPolicy:
    tls:
      mode: SIMPLE
    outlierDetection:
      consecutive5xxErrors: 3
      interval: 30s
      baseEjectionTime: 60s
EOF
\`\`\``,
        hints: [
          'ServiceEntry com location: MESH_EXTERNAL registra o servico como externo',
          'resolution: DNS e necessario para hosts com IP dinamico',
          'O VirtualService aplica retries e timeout ao trafego egress',
          'O DestinationRule com tls.mode: SIMPLE habilita TLS para o host externo'
        ],
        solution: `\`\`\`bash
kubectl apply -f external-api-setup.yaml

# Testar acesso
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://httpbin.org/get
\`\`\``,
        verify: `\`\`\`bash
# Verificar ServiceEntry
kubectl get serviceentry external-api
# Saida esperada: external-api   ["httpbin.org"]   Xs

# Verificar VirtualService
kubectl get vs external-api
# Saida esperada: external-api   ["httpbin.org"]   Xs

# Verificar DestinationRule
kubectl get dr external-api -o jsonpath='{.spec.trafficPolicy.outlierDetection}'
# Saida esperada: {"baseEjectionTime":"60s","consecutive5xxErrors":3,"interval":"30s"}
\`\`\``
      },
      {
        title: 'Configurar Locality-Aware Load Balancing',
        instruction: `Configure locality LB para um servico interno com failover entre zonas.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews-locality
  namespace: default
spec:
  host: reviews
  trafficPolicy:
    loadBalancer:
      localityLbSetting:
        enabled: true
        failover:
          - from: us-east-1/us-east-1a
            to: us-east-1/us-east-1b
          - from: us-east-1
            to: us-west-2
    outlierDetection:
      consecutive5xxErrors: 3
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 100
  subsets:
    - name: v1
      labels:
        version: v1
    - name: v2
      labels:
        version: v2
EOF
\`\`\``,
        hints: [
          'Locality LB usa os labels topology.kubernetes.io/zone e /region dos nodes',
          'outlierDetection e obrigatorio para que o failover funcione',
          'maxEjectionPercent: 100 permite ejetar todos os endpoints de uma zona',
          'O failover segue a ordem: mesma zona > mesma regiao > regiao definida'
        ],
        solution: `\`\`\`bash
kubectl apply -f reviews-locality-dr.yaml

# Verificar labels de localidade dos nodes
kubectl get nodes --show-labels | grep topology
\`\`\``,
        verify: `\`\`\`bash
# Verificar DestinationRule
kubectl get dr reviews-locality -o yaml | grep -A10 localityLbSetting
# Saida esperada: enabled: true com failover configurado

# Verificar outlierDetection
kubectl get dr reviews-locality -o jsonpath='{.spec.trafficPolicy.outlierDetection}'
# Saida esperada: consecutive5xxErrors e baseEjectionTime configurados

# Verificar labels dos nodes
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{" zone="}{.metadata.labels.topology\\.kubernetes\\.io/zone}{"\\n"}{end}'
# Saida esperada: nodes com zonas atribuidas
\`\`\``
      },
      {
        title: 'Configurar Outbound Traffic Policy',
        instruction: `Configure o mesh para bloquear trafego egress nao registrado e verifique que apenas servicos com ServiceEntry sao acessiveis.

\`\`\`bash
# Verificar politica atual
kubectl get configmap istio -n istio-system -o jsonpath='{.data.mesh}' | grep outboundTrafficPolicy

# Configurar REGISTRY_ONLY (bloqueia trafego nao registrado)
istioctl install --set profile=demo \\
  --set meshConfig.outboundTrafficPolicy.mode=REGISTRY_ONLY -y

# Testar: acesso ao httpbin.org (registrado via ServiceEntry) deve funcionar
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://httpbin.org/get
# Esperado: 200

# Testar: acesso a servico nao registrado deve falhar
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://example.com
# Esperado: 502 (bloqueado pelo mesh)
\`\`\``,
        hints: [
          'REGISTRY_ONLY bloqueia trafego para hosts sem ServiceEntry',
          'ALLOW_ANY (padrao) permite todo trafego egress',
          'Apos mudar a politica, Pods existentes precisam de restart para aplicar',
          'Use ServiceEntry para cada dependencia externa que precisa ser acessivel'
        ],
        solution: `\`\`\`bash
# Configurar REGISTRY_ONLY
istioctl install --set profile=demo --set meshConfig.outboundTrafficPolicy.mode=REGISTRY_ONLY -y

# Restart Pods para aplicar
kubectl rollout restart deployment sleep

# Testar acesso
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://httpbin.org/get
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://example.com
\`\`\``,
        verify: `\`\`\`bash
# Verificar politica atual
kubectl get configmap istio -n istio-system -o jsonpath='{.data.mesh}' | grep -A1 outboundTrafficPolicy
# Saida esperada: mode: REGISTRY_ONLY

# Verificar que httpbin funciona (tem ServiceEntry)
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://httpbin.org/get
# Saida esperada: 200

# Verificar que servico nao registrado e bloqueado
kubectl exec deploy/sleep -c sleep -- curl -s -o /dev/null -w "%{http_code}" http://example.com
# Saida esperada: 502 ou connection refused
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ServiceEntry nao funciona - trafego egress bloqueado',
      difficulty: 'medium',
      symptom: 'Criou ServiceEntry para um host externo mas as requisicoes continuam falhando com 502 ou connection refused.',
      diagnosis: `\`\`\`bash
# Verificar se ServiceEntry esta correto
kubectl get serviceentry -o yaml

# Verificar se o host e resolvido pelo proxy
POD=\$(kubectl get pod -l app=sleep -o jsonpath='{.items[0].metadata.name}')
istioctl proxy-config clusters \$POD | grep <host-externo>

# Verificar logs do proxy
kubectl logs \$POD -c istio-proxy | grep <host-externo>

# Verificar politica de egress
kubectl get configmap istio -n istio-system -o jsonpath='{.data.mesh}' | grep outbound

# Testar DNS
kubectl exec \$POD -c sleep -- nslookup <host-externo>
\`\`\``,
      solution: `**Causas comuns:**

1. **Porta errada:** Verificar que a porta no ServiceEntry corresponde a porta usada pela aplicacao. Para HTTPS, usar porta 443 com protocol TLS.

2. **Resolution errada:** Para hosts com IP dinamico, usar \`resolution: DNS\`. Para IPs fixos, usar \`resolution: STATIC\` com addresses.

3. **TLS mode:** Se o servico externo usa HTTPS, adicionar DestinationRule com \`tls.mode: SIMPLE\`:
\`\`\`yaml
trafficPolicy:
  tls:
    mode: SIMPLE
\`\`\`

4. **Namespace scope:** ServiceEntry no namespace X pode nao ser visivel no namespace Y. Usar \`exportTo: ["*"]\` para visibilidade global.`
    },
    {
      title: 'Locality failover nao funciona',
      difficulty: 'hard',
      symptom: 'Configurou locality-aware load balancing mas quando endpoints de uma zona falham, o trafego nao faz failover para outra zona.',
      diagnosis: `\`\`\`bash
# Verificar labels de localidade dos nodes
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{" zone="}{.metadata.labels.topology\\.kubernetes\\.io/zone}{" region="}{.metadata.labels.topology\\.kubernetes\\.io/region}{"\\n"}{end}'

# Verificar DestinationRule
kubectl get dr <nome> -o yaml | grep -A15 localityLbSetting

# Verificar se outlierDetection esta configurado
kubectl get dr <nome> -o jsonpath='{.spec.trafficPolicy.outlierDetection}'

# Verificar distribuicao de endpoints por zona
istioctl proxy-config endpoints \$(kubectl get pod -l app=<app> -o jsonpath='{.items[0].metadata.name}') | grep <service>
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Sem outlierDetection:** Locality failover REQUER circuit breaker. Sem ele, endpoints com falha nao sao ejetados e o failover nao ocorre.

2. **Labels de localidade faltando:** Nodes devem ter os labels:
   - \`topology.kubernetes.io/zone\`
   - \`topology.kubernetes.io/region\`

3. **maxEjectionPercent baixo:** Se configurado como 10%, no maximo 10% dos endpoints sao ejetados. Isso pode nao ser suficiente para triggerar failover. Considere \`maxEjectionPercent: 100\`.

4. **Failover order errada:** Os pares from/to devem corresponder as zonas reais dos seus nodes.`
    },
    {
      title: 'EnvoyFilter causa erros apos upgrade do Istio',
      difficulty: 'hard',
      symptom: 'Apos upgrade do Istio, servicos retornam 503 ou NR (No Route). Os EnvoyFilters que funcionavam antes agora causam erros.',
      diagnosis: `\`\`\`bash
# Listar EnvoyFilters
kubectl get envoyfilter --all-namespaces

# Verificar logs do proxy com erros
kubectl logs <pod> -c istio-proxy | grep -i "error\\|reject\\|invalid"

# Verificar configuracao do proxy
istioctl proxy-config listeners <pod> --output json | head -100

# Verificar versao do Envoy
kubectl exec <pod> -c istio-proxy -- pilot-agent request GET /server_info | grep version

# Verificar se o filter e valido
istioctl analyze -n <namespace>
\`\`\``,
      solution: `**Acoes para resolver:**

1. **Desabilitar EnvoyFilter temporariamente:**
\`\`\`bash
kubectl delete envoyfilter <nome> -n <namespace>
# Verificar se os erros param
\`\`\`

2. **Atualizar o filter** para a nova versao do Envoy. Consulte o changelog do Envoy para breaking changes.

3. **Migrar para APIs de alto nivel:** Sempre que possivel, substitua EnvoyFilter por:
   - **WasmPlugin** para logica customizada
   - **Telemetry API** para metricas e logging
   - **AuthorizationPolicy** para controle de acesso

4. **Testar em staging primeiro:** Sempre teste upgrades do Istio em ambiente nao-produtivo com todos os EnvoyFilters aplicados.`
    }
  ]
};
