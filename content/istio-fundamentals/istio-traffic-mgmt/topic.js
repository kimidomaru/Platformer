window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['istio-fundamentals/istio-traffic-mgmt'] = {
  theory: `
# Traffic Management no Istio

## Relevancia
O gerenciamento de trafego e o recurso mais usado do Istio. Ele permite controlar como requisicoes sao roteadas entre servicos, implementar canary deployments, injetar falhas para testes de resiliencia, e configurar retries e timeouts — tudo sem alterar codigo.

## Conceitos Fundamentais

### VirtualService

O VirtualService define **como** o trafego e roteado para um servico. Ele intercepta requisicoes e aplica regras de routing.

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews              # nome do Service Kubernetes
  http:
    - match:
        - headers:
            end-user:
              exact: jason
      route:
        - destination:
            host: reviews
            subset: v2     # usuarios "jason" vao para v2
    - route:
        - destination:
            host: reviews
            subset: v1     # todos os outros vao para v1
\`\`\`

### DestinationRule

O DestinationRule define **politicas** que se aplicam ao trafego APOS o routing. Ele configura subsets (versoes), load balancing e connection pool.

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        h2UpgradePolicy: DEFAULT
        http1MaxPendingRequests: 100
  subsets:
    - name: v1
      labels:
        version: v1
    - name: v2
      labels:
        version: v2
    - name: v3
      labels:
        version: v3
      trafficPolicy:
        connectionPool:
          http:
            http1MaxPendingRequests: 50
\`\`\`

### Traffic Shifting (Canary)

Distribua trafego entre versoes usando pesos:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 90       # 90% do trafego
        - destination:
            host: reviews
            subset: v2
          weight: 10       # 10% do trafego (canary)
\`\`\`

### Retries e Timeouts

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ratings
spec:
  hosts:
    - ratings
  http:
    - route:
        - destination:
            host: ratings
      timeout: 3s
      retries:
        attempts: 3
        perTryTimeout: 1s
        retryOn: 5xx,reset,connect-failure,retriable-4xx
\`\`\`

### Fault Injection

Injete falhas para testar resiliencia:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ratings
spec:
  hosts:
    - ratings
  http:
    - fault:
        delay:
          percentage:
            value: 50        # 50% das requisicoes
          fixedDelay: 5s     # delay de 5 segundos
        abort:
          percentage:
            value: 10        # 10% das requisicoes
          httpStatus: 503    # retorna 503
      route:
        - destination:
            host: ratings
\`\`\`

### Circuit Breaker

Configure via DestinationRule:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  trafficPolicy:
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
        maxRequestsPerConnection: 10
\`\`\`

### Request Mirroring

Espelhe trafego para uma versao sem afetar a resposta:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 100
      mirror:
        host: reviews
        subset: v2
      mirrorPercentage:
        value: 100.0      # espelha 100% do trafego para v2
\`\`\`

### Erros Comuns

1. **VirtualService sem DestinationRule** — subsets referenciados no VS devem existir no DR
2. **Host errado** — o campo hosts deve corresponder ao nome do Kubernetes Service
3. **Pesos nao somam 100** — os weights de traffic shifting devem totalizar 100
4. **Order matters** — regras de match sao avaliadas de cima para baixo, a primeira match vence

## Killer.sh Style Challenge

> **Cenario:** Configure um canary deployment com 80/20 de trafego entre v1 e v2 do servico \`productpage\`. Adicione retry de 3 tentativas com timeout de 2s por tentativa. Injete um delay de 3s em 20% das requisicoes para v2 para testar resiliencia.
`,
  quiz: [
    {
      question: 'Qual CRD do Istio define como o trafego e roteado para um servico?',
      options: ['DestinationRule', 'VirtualService', 'Gateway', 'ServiceEntry'],
      correct: 1,
      explanation: 'O VirtualService define regras de routing que determinam como o trafego e direcionado para diferentes versoes de um servico, baseado em headers, URI, percentual, etc.',
      reference: 'Conceito relacionado: DestinationRule define politicas POS-routing (subsets, load balancing).'
    },
    {
      question: 'Em um traffic shifting (canary), os pesos das rotas devem:',
      options: ['Ser iguais', 'Somar 100', 'Ser maiores que 50', 'Nao importa o valor'],
      correct: 1,
      explanation: 'Os campos weight de todas as destinations em uma rota HTTP devem somar exatamente 100. Por exemplo, 90/10, 80/20, ou 50/50.',
      reference: 'Conceito relacionado: Progressive delivery com incremento gradual de peso (1% -> 5% -> 25% -> 100%).'
    },
    {
      question: 'Qual campo do VirtualService configura retry automatico?',
      options: ['spec.http.retry', 'spec.http.retries', 'spec.http.fault.retry', 'spec.retryPolicy'],
      correct: 1,
      explanation: 'O campo retries dentro de spec.http configura attempts (numero de tentativas), perTryTimeout (timeout por tentativa) e retryOn (condicoes que disparam retry).',
      reference: 'Conceito relacionado: retryOn aceita valores como 5xx, reset, connect-failure, retriable-4xx.'
    },
    {
      question: 'Qual a diferenca entre fault delay e fault abort no Istio?',
      options: [
        'delay adiciona latencia, abort retorna erro HTTP',
        'delay retorna erro, abort adiciona latencia',
        'delay afeta TCP, abort afeta HTTP',
        'Nao ha diferenca funcional'
      ],
      correct: 0,
      explanation: 'fault.delay injeta um atraso artificial na requisicao (simula lentidao). fault.abort termina a requisicao prematuramente retornando um codigo HTTP de erro (simula falha).',
      reference: 'Conceito relacionado: Chaos engineering com fault injection para validar resiliencia.'
    },
    {
      question: 'O que faz o outlierDetection no DestinationRule?',
      options: [
        'Detecta servicos externos ao mesh',
        'Implementa circuit breaker ejetando endpoints com falha',
        'Monitora latencia dos endpoints',
        'Bloqueia trafego de IPs desconhecidos'
      ],
      correct: 1,
      explanation: 'outlierDetection implementa circuit breaking: se um endpoint retorna erros consecutivos, ele e ejetado do pool de load balancing por um periodo (baseEjectionTime).',
      reference: 'Conceito relacionado: consecutive5xxErrors, interval e maxEjectionPercent.'
    },
    {
      question: 'O que e request mirroring no Istio?',
      options: [
        'Duplicar o servico em outro namespace',
        'Enviar uma copia do trafego para outra versao sem afetar a resposta original',
        'Espelhar metricas entre clusters',
        'Replicar configuracao entre namespaces'
      ],
      correct: 1,
      explanation: 'Request mirroring (ou traffic shadowing) envia uma copia de cada requisicao para um destino adicional. A resposta do mirror e descartada — apenas a resposta da rota principal e retornada ao cliente.',
      reference: 'Conceito relacionado: Util para testar nova versao com trafego real sem impacto.'
    },
    {
      question: 'Em que ordem o Istio avalia as regras de match em um VirtualService?',
      options: [
        'Ordem alfabetica',
        'De cima para baixo (first match wins)',
        'Mais especifica primeiro (longest match)',
        'Aleatoria com peso'
      ],
      correct: 1,
      explanation: 'As regras http no VirtualService sao avaliadas sequencialmente de cima para baixo. A primeira regra cujo match corresponde a requisicao e aplicada. Por isso, regras mais especificas devem vir antes das mais genericas.',
      reference: 'Conceito relacionado: A ultima regra sem match funciona como default/catch-all.'
    }
  ],
  flashcards: [
    {
      front: 'Qual a diferenca entre VirtualService e DestinationRule?',
      back: '**VirtualService** — define COMO rotear:\n- Match por header, URI, peso\n- Retries, timeouts\n- Fault injection\n- Routing para subsets\n\n**DestinationRule** — define politicas POS-routing:\n- Define subsets (versoes)\n- Load balancing (ROUND_ROBIN, RANDOM, LEAST_CONN)\n- Connection pool\n- Circuit breaker (outlierDetection)\n- mTLS settings'
    },
    {
      front: 'Como implementar canary deployment com Istio?',
      back: '1. Criar DestinationRule com subsets (v1, v2)\n2. Criar VirtualService com weight:\n\n\`\`\`yaml\nhttp:\n  - route:\n      - destination:\n          host: app\n          subset: v1\n        weight: 90\n      - destination:\n          host: app\n          subset: v2\n        weight: 10\n\`\`\`\n\nPesos devem somar 100. Ajustar gradualmente.'
    },
    {
      front: 'Quais tipos de fault injection o Istio suporta?',
      back: '1. **Delay** — injeta latencia artificial:\n   - fixedDelay: tempo de atraso\n   - percentage: % de requisicoes afetadas\n\n2. **Abort** — retorna erro HTTP:\n   - httpStatus: codigo de erro (ex: 503)\n   - percentage: % de requisicoes afetadas\n\nAmbos podem ser combinados e aplicados por rota.'
    },
    {
      front: 'O que e circuit breaking no Istio e como configurar?',
      back: 'Circuit breaking ejeta endpoints com falha do pool de load balancing.\n\nConfigurado via **DestinationRule.trafficPolicy.outlierDetection**:\n- consecutive5xxErrors: erros antes de ejetar\n- interval: janela de avaliacao\n- baseEjectionTime: tempo fora do pool\n- maxEjectionPercent: % maximo de endpoints ejetados\n\nTambem inclui connectionPool para limitar conexoes simultaneas.'
    },
    {
      front: 'O que e request mirroring e quando usar?',
      back: '**Mirroring** envia copia do trafego real para outro destino sem afetar a resposta ao cliente.\n\n**Quando usar:**\n- Testar nova versao com trafego de producao\n- Validar performance antes de canary\n- Comparar respostas entre versoes\n\n**Configuracao:** campo \`mirror\` e \`mirrorPercentage\` no VirtualService.'
    },
    {
      front: 'Quais condicoes podem disparar retry no Istio?',
      back: 'Campo retryOn aceita:\n- **5xx** — qualquer erro 500+\n- **reset** — conexao resetada\n- **connect-failure** — falha de conexao\n- **retriable-4xx** — erros 4xx retentaveis (409)\n- **gateway-error** — 502, 503, 504\n- **refused-stream** — stream recusada\n\nConfigurar com attempts (max tentativas) e perTryTimeout.'
    },
    {
      front: 'Qual a relacao entre subsets e labels dos Pods?',
      back: 'Subsets no DestinationRule mapeiam para Pods via labels:\n\n\`\`\`yaml\nsubsets:\n  - name: v1\n    labels:\n      version: v1  # seleciona Pods com version=v1\n  - name: v2\n    labels:\n      version: v2  # seleciona Pods com version=v2\n\`\`\`\n\nO VirtualService roteia para subsets.\nO DestinationRule define quais Pods pertencem a cada subset.'
    }
  ],
  lab: {
    scenario: 'Voce tem dois Deployments de um servico de reviews (v1 e v2) e precisa implementar canary deployment com controle de trafego, retries e fault injection.',
    objective: 'Configurar traffic shifting, retries, timeouts e fault injection usando VirtualService e DestinationRule.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Deployments e DestinationRule',
        instruction: `Crie dois Deployments (v1 e v2) do servico reviews e um DestinationRule com subsets.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: reviews-v1
spec:
  replicas: 2
  selector:
    matchLabels:
      app: reviews
      version: v1
  template:
    metadata:
      labels:
        app: reviews
        version: v1
    spec:
      containers:
        - name: reviews
          image: docker.io/istio/examples-bookinfo-reviews-v1:1.18.0
          ports:
            - containerPort: 9080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: reviews-v2
spec:
  replicas: 1
  selector:
    matchLabels:
      app: reviews
      version: v2
  template:
    metadata:
      labels:
        app: reviews
        version: v2
    spec:
      containers:
        - name: reviews
          image: docker.io/istio/examples-bookinfo-reviews-v2:1.18.0
          ports:
            - containerPort: 9080
---
apiVersion: v1
kind: Service
metadata:
  name: reviews
spec:
  selector:
    app: reviews
  ports:
    - port: 9080
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
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
          'Ambos os Deployments compartilham o label app: reviews para o Service',
          'O label version diferencia v1 de v2 nos subsets',
          'O DestinationRule precisa existir antes do VirtualService que referencia os subsets'
        ],
        solution: `\`\`\`bash
# Aplicar os manifests acima
kubectl apply -f reviews-setup.yaml

# Verificar
kubectl get deploy | grep reviews
kubectl get destinationrule reviews -o yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar Deployments
kubectl get deploy reviews-v1 reviews-v2
# Saida esperada: reviews-v1 2/2, reviews-v2 1/1

# Verificar DestinationRule
kubectl get destinationrule reviews
# Saida esperada: reviews   reviews   Xs

# Verificar subsets
kubectl get destinationrule reviews -o jsonpath='{.spec.subsets[*].name}'
# Saida esperada: v1 v2
\`\`\``
      },
      {
        title: 'Configurar Traffic Shifting e Retries',
        instruction: `Crie um VirtualService com 80/20 canary e configuracao de retries.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 80
        - destination:
            host: reviews
            subset: v2
          weight: 20
      timeout: 5s
      retries:
        attempts: 3
        perTryTimeout: 2s
        retryOn: 5xx,reset,connect-failure
EOF
\`\`\``,
        hints: [
          'Os weights devem somar 100 (80 + 20 = 100)',
          'O timeout geral (5s) deve ser maior que perTryTimeout * attempts',
          'retryOn define quais erros disparam retry automatico'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 80
        - destination:
            host: reviews
            subset: v2
          weight: 20
      timeout: 5s
      retries:
        attempts: 3
        perTryTimeout: 2s
        retryOn: 5xx,reset,connect-failure
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar VirtualService
kubectl get virtualservice reviews
# Saida esperada: reviews   ["reviews"]   Xs

# Verificar pesos
kubectl get vs reviews -o jsonpath='{.spec.http[0].route[*].weight}'
# Saida esperada: 80 20

# Verificar retries
kubectl get vs reviews -o jsonpath='{.spec.http[0].retries.attempts}'
# Saida esperada: 3
\`\`\``
      },
      {
        title: 'Adicionar Fault Injection para Testes',
        instruction: `Atualize o VirtualService adicionando fault injection para testar resiliencia.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - match:
        - headers:
            test-fault:
              exact: "true"
      fault:
        delay:
          percentage:
            value: 100
          fixedDelay: 3s
        abort:
          percentage:
            value: 20
          httpStatus: 503
      route:
        - destination:
            host: reviews
            subset: v2
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 80
        - destination:
            host: reviews
            subset: v2
          weight: 20
      timeout: 5s
      retries:
        attempts: 3
        perTryTimeout: 2s
        retryOn: 5xx,reset,connect-failure
EOF
\`\`\``,
        hints: [
          'A regra de fault injection usa match por header para ser ativada sob demanda',
          'Regras mais especificas (com match) devem vir antes das genericas',
          'O header test-fault: true ativa a injecao de falhas'
        ],
        solution: `\`\`\`bash
# Aplicar o VirtualService com fault injection
kubectl apply -f reviews-vs-fault.yaml

# Testar com header
kubectl exec deploy/sleep -c sleep -- curl -s -H "test-fault: true" http://reviews:9080/reviews/1 -w "\\nHTTP_CODE:%{http_code}\\nTIME:%{time_total}\\n"
\`\`\``,
        verify: `\`\`\`bash
# Verificar VirtualService atualizado
kubectl get vs reviews -o yaml | grep -A5 fault
# Saida esperada: delay e abort configurados

# Verificar configuracao de analise
istioctl analyze
# Saida esperada: sem erros

# Verificar que proxy recebeu a configuracao
POD=\$(kubectl get pod -l app=reviews,version=v2 -o jsonpath='{.items[0].metadata.name}')
istioctl proxy-config routes \$POD | grep reviews
# Saida esperada: rotas configuradas para reviews
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'VirtualService nao funciona - trafego nao e roteado',
      difficulty: 'medium',
      symptom: 'O VirtualService foi criado mas o trafego continua sendo distribuido igualmente entre todas as versoes, ignorando as regras de routing.',
      diagnosis: `\`\`\`bash
# Verificar se o VirtualService esta correto
kubectl get vs reviews -o yaml

# Verificar se o DestinationRule existe com subsets
kubectl get dr reviews -o yaml

# Verificar se os labels dos Pods correspondem aos subsets
kubectl get pods -l app=reviews --show-labels

# Analisar configuracao
istioctl analyze

# Verificar se o proxy recebeu a config
istioctl proxy-config routes \$(kubectl get pod -l app=reviews -o jsonpath='{.items[0].metadata.name}')
\`\`\``,
      solution: `**Causas comuns:**

1. **DestinationRule ausente:** O VirtualService referencia subsets que nao existem no DestinationRule. Criar o DR com os subsets correspondentes.

2. **Labels incorretos:** Os labels dos Pods devem corresponder exatamente aos labels definidos nos subsets do DestinationRule.

3. **Host errado:** O campo \`hosts\` no VS deve ser o nome exato do Kubernetes Service (ou FQDN).

4. **Sem sidecar:** Se os Pods nao tem sidecar Envoy, as regras do Istio nao sao aplicadas:
\`\`\`bash
kubectl get pods -l app=reviews -o jsonpath='{.items[*].spec.containers[*].name}'
# Deve incluir istio-proxy
\`\`\``
    },
    {
      title: 'Retries causando amplificacao de carga',
      difficulty: 'hard',
      symptom: 'Em situacoes de falha, os retries do Istio geram uma amplificacao de requisicoes que sobrecarrega o servico destino, piorando a situacao.',
      diagnosis: `\`\`\`bash
# Verificar configuracao de retries
kubectl get vs <nome> -o jsonpath='{.spec.http[0].retries}'

# Verificar metricas de retry no Envoy
kubectl exec <pod> -c istio-proxy -- pilot-agent request GET /stats | grep upstream_rq_retry

# Verificar rate de requisicoes no destino
kubectl exec <pod> -c istio-proxy -- pilot-agent request GET /stats | grep upstream_rq_total
\`\`\``,
      solution: `**Estrategias para evitar retry storms:**

1. **Limitar tentativas:** Use no maximo 2-3 attempts com perTryTimeout adequado.

2. **Configurar circuit breaker** junto com retries:
\`\`\`yaml
trafficPolicy:
  outlierDetection:
    consecutive5xxErrors: 3
    interval: 10s
    baseEjectionTime: 30s
\`\`\`

3. **Retry budget:** O Envoy limita retries a 20% das requisicoes ativas por padrao. Evite aumentar este valor.

4. **Timeout adequado:** timeout total deve ser > perTryTimeout * attempts para permitir todos os retries.

5. **Nao usar retry em operacoes nao-idempotentes:** POST/PUT que criam recursos podem duplicar dados com retry.`
    },
    {
      title: 'Traffic shifting mostra porcentagens incorretas',
      difficulty: 'easy',
      symptom: 'Configurou canary 90/10 mas a distribuicao real parece ser diferente (ex: 70/30 ou 50/50).',
      diagnosis: `\`\`\`bash
# Verificar weights configurados
kubectl get vs <nome> -o jsonpath='{.spec.http[0].route}'

# Verificar se ha multiplos VirtualServices para o mesmo host
kubectl get vs --all-namespaces | grep <host>

# Testar com multiplas requisicoes
for i in \$(seq 1 100); do
  kubectl exec deploy/sleep -c sleep -- curl -s http://reviews:9080/reviews/1 -o /dev/null -w "%{http_code}\\n"
done | sort | uniq -c
\`\`\``,
      solution: `**Causas comuns:**

1. **Amostra pequena:** Com poucas requisicoes, a distribuicao pode parecer diferente. Teste com pelo menos 100+ requisicoes.

2. **Sticky sessions:** Se o cliente reutiliza conexoes, as requisicoes podem ir para o mesmo endpoint. Adicionar \`maxRequestsPerConnection: 1\` no DestinationRule.

3. **Multiplos VirtualServices:** Dois VirtualServices para o mesmo host causam conflito. Deve haver apenas um por host.

4. **Cache de DNS:** O Envoy pode cachear resolucao DNS. Verifique com proxy-config.`
    }
  ]
};
