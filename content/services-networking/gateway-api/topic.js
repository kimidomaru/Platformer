window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['services-networking/gateway-api'] = {
  theory: `# Gateway API

## Relevancia no Exame
> A **Gateway API** entrou oficialmente no curriculo do CKA (revisao 2025) dentro do dominio **Services & Networking**. Espere tarefas praticas: criar um \`Gateway\`, expor um Service via \`HTTPRoute\`, fazer **traffic splitting** por peso e habilitar **roteamento cross-namespace** com \`ReferenceGrant\`. E o sucessor da Ingress API e o ponto onde a comunidade esta investindo.

## Por que a Gateway API existe?

A **Ingress API** resolveu o basico (host/path + TLS), mas travou em dois problemas:

1. **"Annotation soup"** — recursos avancados (rewrite, canary, rate-limit, header match) so existiam via annotations especificas de cada controller. Migrar de nginx para Traefik quebrava tudo.
2. **Sem separacao de papeis** — um unico objeto \`Ingress\` misturava preocupacoes de infra, operacao de cluster e desenvolvimento de app.

A **Gateway API** (\`gateway.networking.k8s.io\`) e a evolucao oficial: portavel entre implementacoes, expressiva sem annotations e **role-oriented**.

> **Importante:** a Gateway API NAO substitui a Ingress de imediato — ambas coexistem. Mas todo investimento novo (Gateway API GA desde a v1.0) acontece aqui.

---

## Modelo de Papeis (o conceito central)

A Gateway API divide a responsabilidade em **3 personas**, cada uma com seu recurso:

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│  Infra Provider     →  GatewayClass   (qual controller usar)  │
│  Cluster Operator   →  Gateway        (portas, TLS, listeners) │
│  App Developer      →  HTTPRoute      (regras de roteamento)   │
└─────────────────────────────────────────────────────────────┘
\`\`\`

| Recurso | Persona | Analogia |
|---------|---------|----------|
| **GatewayClass** | Infra / provider | Como uma \`StorageClass\` — aponta para um controller |
| **Gateway** | Operador do cluster | A instancia do load balancer / proxy (listeners) |
| **HTTPRoute** | Desenvolvedor da app | As regras L7 que conectam ao Service |

Isso permite que o dev crie \`HTTPRoute\` no seu namespace **sem tocar** na infraestrutura compartilhada.

---

## GatewayClass

Define qual implementacao (controller) materializa os Gateways. E **cluster-scoped**.

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: nginx
spec:
  controllerName: gateway.nginx.org/nginx-gateway-controller
\`\`\`

\`\`\`bash
kubectl get gatewayclass
# NAME    CONTROLLER                                ACCEPTED   AGE
# nginx   gateway.nginx.org/nginx-gateway-controller  True     2m
\`\`\`

> O \`controllerName\` e fixo por implementacao (nginx, Istio, Cilium, Envoy Gateway...). Voce normalmente nao cria GatewayClass na prova — ela ja vem instalada.

---

## Gateway

A instancia do data plane. Define **listeners**: porta, protocolo, hostname e quais Routes podem se anexar.

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: prod-gateway
  namespace: infra
spec:
  gatewayClassName: nginx
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      hostname: "*.example.com"     # opcional: filtra por SNI/Host
      allowedRoutes:
        namespaces:
          from: All                 # Same | All | Selector
    - name: https
      protocol: HTTPS
      port: 443
      tls:
        mode: Terminate             # Terminate | Passthrough
        certificateRefs:
          - name: example-tls
            kind: Secret
      allowedRoutes:
        namespaces:
          from: Same
\`\`\`

### allowedRoutes — quem pode se anexar
| Valor | Significado |
|-------|-------------|
| \`Same\` | So Routes do MESMO namespace do Gateway |
| \`All\` | Routes de qualquer namespace |
| \`Selector\` | Routes de namespaces que casam um \`matchLabels\` |

\`\`\`bash
kubectl get gateway prod-gateway -n infra
# NAME           CLASS   ADDRESS         PROGRAMMED   AGE
# prod-gateway   nginx   203.0.113.10    True         1m
\`\`\`

> **ADDRESS** so aparece quando o controller provisiona o LB. **PROGRAMMED=True** = o data plane esta configurado.

---

## HTTPRoute

O recurso que o dev mais usa. Conecta-se a um Gateway via \`parentRefs\` e roteia para Services via \`backendRefs\`.

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: app-route
  namespace: apps
spec:
  parentRefs:
    - name: prod-gateway
      namespace: infra          # Gateway em outro namespace (ver ReferenceGrant)
  hostnames:
    - "app.example.com"
  rules:
    - matches:
        - path:
            type: PathPrefix    # PathPrefix | Exact | RegularExpression
            value: /api
      backendRefs:
        - name: api-svc
          port: 8080
\`\`\`

### Tipos de match
\`\`\`yaml
matches:
  - path:
      type: Exact
      value: /healthz
  - headers:
      - name: x-version
        value: v2
  - queryParams:
      - name: env
        value: canary
  - method: POST
\`\`\`

> Dentro de **um** \`match\`, todas as condicoes sao **AND**. Itens diferentes na lista \`matches\` sao **OR**. (Mesma logica AND/OR das NetworkPolicies — pegadinha classica.)

---

## Traffic Splitting (Canary por peso)

Sem annotations: basta multiplos \`backendRefs\` com \`weight\`. Esse e um cenario que cai na prova.

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-route
  namespace: apps
spec:
  parentRefs:
    - name: prod-gateway
      namespace: infra
  hostnames:
    - "app.example.com"
  rules:
    - backendRefs:
        - name: app-stable
          port: 80
          weight: 90            # 90% do trafego
        - name: app-canary
          port: 80
          weight: 10            # 10% do trafego
\`\`\`

> O peso e relativo (90:10, 9:1, 3:1...). Se um backend tem \`weight: 0\`, ele para de receber trafego mas continua resolvido.

---

## Filters (manipulacao de request/response)

Substituem as annotations da Ingress por campos nativos e portaveis:

\`\`\`yaml
rules:
  - matches:
      - path: { type: PathPrefix, value: /old }
    filters:
      - type: RequestRedirect          # redirecionamento 3xx
        requestRedirect:
          scheme: https
          statusCode: 301
  - matches:
      - path: { type: PathPrefix, value: /api/v1 }
    filters:
      - type: URLRewrite               # reescreve o path (substitui rewrite-target)
        urlRewrite:
          path:
            type: ReplacePrefixMatch
            replacePrefixMatch: /v1
      - type: RequestHeaderModifier    # add/set/remove headers
        requestHeaderModifier:
          add:
            - name: x-gateway
              value: "true"
    backendRefs:
      - name: api-svc
        port: 8080
\`\`\`

| Filter | Substitui annotation de... |
|--------|----------------------------|
| \`RequestRedirect\` | redirect / force-ssl |
| \`URLRewrite\` | rewrite-target |
| \`RequestHeaderModifier\` | header manipulation |
| \`RequestMirror\` | mirror / shadow traffic |
| \`ResponseHeaderModifier\` | response headers |

---

## Roteamento Cross-Namespace + ReferenceGrant

Por padrao, uma referencia **entre namespaces** e **negada** (modelo de seguranca). Dois casos exigem permissao explicita via **ReferenceGrant**:

1. Um \`HTTPRoute\` referenciar um \`Service\` em **outro** namespace.
2. Um \`Gateway\` referenciar um \`Secret\` de TLS em **outro** namespace.

O \`ReferenceGrant\` vive **no namespace do recurso-alvo** (quem concede o acesso):

\`\`\`yaml
# HTTPRoute no namespace 'apps' quer rotear para um Service no namespace 'backend'
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: allow-apps-to-backend
  namespace: backend          # namespace do Service (alvo)
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: apps         # quem esta pedindo acesso
  to:
    - group: ""
      kind: Service           # o que pode ser referenciado
\`\`\`

> Sem o \`ReferenceGrant\`, o \`HTTPRoute\` fica com a condition **ResolvedRefs=False / RefNotPermitted**. Memorize: o grant fica do lado de **quem possui o recurso referenciado**.

---

## Outros tipos de Route

A Gateway API nao e so HTTP:

| Kind | Uso |
|------|-----|
| \`HTTPRoute\` | L7 HTTP/HTTPS (o mais comum) |
| \`GRPCRoute\` | roteamento gRPC nativo |
| \`TLSRoute\` | TLS passthrough por SNI (sem terminar) |
| \`TCPRoute\` | L4 TCP generico |
| \`UDPRoute\` | L4 UDP generico |

---

## Status & Conditions (essencial p/ debug)

Sempre cheque as conditions — elas dizem exatamente o que falhou:

\`\`\`bash
kubectl describe httproute app-route -n apps
\`\`\`

| Condition | True significa |
|-----------|----------------|
| \`Accepted\` | O Gateway aceitou anexar esta Route |
| \`ResolvedRefs\` | Todos os backendRefs/secrets foram resolvidos |
| \`Programmed\` (no Gateway) | Data plane configurado e pronto |

Falhas comuns: \`Accepted=False (NotAllowedByListeners)\` = \`allowedRoutes\`/hostname nao batem; \`ResolvedRefs=False (BackendNotFound)\` = Service errado; \`RefNotPermitted\` = falta ReferenceGrant.

---

## Gateway API vs Ingress

| | Ingress | Gateway API |
|---|---------|-------------|
| Status | freeze (so manutencao) | GA, ativo |
| Recursos avancados | via annotations | campos nativos (filters) |
| Portabilidade | baixa (annotations proprietarias) | alta |
| Separacao de papeis | nenhuma | GatewayClass / Gateway / Route |
| Cross-namespace | nao | sim (ReferenceGrant) |
| Protocolos | HTTP/HTTPS | HTTP, gRPC, TLS, TCP, UDP |
| Traffic split | annotation do controller | \`weight\` nativo |

---

## Erros Comuns

1. **Esquecer o ReferenceGrant** ao rotear/referenciar TLS entre namespaces — \`RefNotPermitted\`.
2. **\`allowedRoutes\` restritivo** — Gateway com \`from: Same\` e HTTPRoute em outro namespace = nunca anexa.
3. **Hostname incompativel** — listener com \`hostname: *.example.com\` e Route com \`foo.other.com\` nao casa.
4. **Confundir os apiVersions** — \`Gateway\`/\`HTTPRoute\` sao \`v1\`; \`ReferenceGrant\` ainda e \`v1beta1\`.
5. **Achar que GatewayClass cria algo sozinha** — sem um Gateway anexado, nada e provisionado.
6. **TLS Terminate sem \`certificateRefs\`** — listener HTTPS exige o Secret de certificado.

## Killer.sh Style Challenge

> Voce tem um Gateway \`web-gw\` no namespace \`gateway-system\` (classe \`nginx\`, listener HTTP :80, \`allowedRoutes: All\`). No namespace \`shop\` existem os Services \`frontend\` (:80) e \`frontend-beta\` (:80).
>
> 1. Crie um \`HTTPRoute\` chamado \`shop-route\` no namespace \`shop\`, anexado ao \`web-gw\`, para o host \`shop.k8s.local\`.
> 2. Roteie \`/\` enviando **80%** para \`frontend\` e **20%** para \`frontend-beta\`.
> 3. Adicione uma segunda regra que faca match no header \`x-debug: true\` e envie 100% para \`frontend-beta\`.
> 4. Valide com \`kubectl describe httproute shop-route -n shop\` que \`Accepted=True\` e \`ResolvedRefs=True\`.
>
> Dica: o \`parentRefs\` precisa de \`namespace: gateway-system\`; a regra mais especifica (header match) deve vir antes da regra de peso.
`,

  quiz: [
    {
      question: 'Na Gateway API, qual recurso e responsabilidade tipica do DESENVOLVEDOR da aplicacao (e nao do operador de cluster)?',
      options: [
        'GatewayClass',
        'Gateway',
        'HTTPRoute',
        'IngressClass'
      ],
      correct: 2,
      explanation: 'O modelo role-oriented separa: GatewayClass (infra provider, escolhe o controller), Gateway (operador do cluster, define listeners/portas/TLS) e HTTPRoute (desenvolvedor da app, define as regras L7 que conectam ao seu Service). O dev mexe no HTTPRoute no proprio namespace sem tocar a infra compartilhada.',
      reference: 'Secao Modelo de Papeis — GatewayClass/Gateway/HTTPRoute mapeiam para 3 personas distintas.'
    },
    {
      question: 'Um HTTPRoute no namespace "apps" precisa rotear para um Service no namespace "backend". O que e obrigatorio para isso funcionar?',
      options: [
        'Nada — referencias cross-namespace sao permitidas por padrao',
        'Um ReferenceGrant no namespace "backend" autorizando HTTPRoutes de "apps"',
        'Um ReferenceGrant no namespace "apps" autorizando o Service',
        'Mudar o Service para ExternalName'
      ],
      correct: 1,
      explanation: 'Referencias entre namespaces sao negadas por padrao. O ReferenceGrant deve viver no namespace do recurso ALVO (backend), declarando em "from" quem pede acesso (HTTPRoute de apps) e em "to" o que pode ser referenciado (Service). Sem ele: ResolvedRefs=False / RefNotPermitted.',
      reference: 'Secao Cross-Namespace + ReferenceGrant — o grant fica do lado de quem possui o recurso referenciado.'
    },
    {
      question: 'Como se faz traffic splitting (canary 90/10) entre dois Services na Gateway API?',
      options: [
        'Com a annotation nginx.ingress.kubernetes.io/canary-weight',
        'Criando dois Gateways e usando DNS round-robin',
        'Com multiplos backendRefs no HTTPRoute, cada um com um campo weight',
        'So e possivel com um service mesh como Istio'
      ],
      correct: 2,
      explanation: 'A Gateway API tem traffic splitting nativo: basta listar varios backendRefs em uma rule, cada um com weight (ex.: 90 e 10). O peso e relativo. Isso elimina a "annotation soup" da Ingress, onde canary dependia de annotations proprietarias do controller.',
      reference: 'Secao Traffic Splitting — weight relativo, sem annotations.'
    },
    {
      question: 'Um Gateway tem listener com "allowedRoutes: { namespaces: { from: Same } }". Um HTTPRoute em OUTRO namespace aponta para ele. Qual o resultado?',
      options: [
        'A Route anexa normalmente',
        'A Route NAO anexa (Accepted=False) porque o listener so aceita Routes do mesmo namespace',
        'A Route anexa, mas so para trafego interno',
        'O Gateway e recriado automaticamente em modo All'
      ],
      correct: 1,
      explanation: 'from: Same restringe o anexo a Routes do MESMO namespace do Gateway. Uma Route de outro namespace tera Accepted=False (NotAllowedByListeners). Para permitir, use from: All ou from: Selector com labels no namespace de origem.',
      reference: 'Secao Gateway — tabela allowedRoutes (Same | All | Selector).'
    },
    {
      question: 'Qual filter da Gateway API substitui a annotation "nginx.ingress.kubernetes.io/rewrite-target"?',
      options: [
        'RequestRedirect',
        'RequestHeaderModifier',
        'URLRewrite',
        'RequestMirror'
      ],
      correct: 2,
      explanation: 'O filter URLRewrite reescreve o path (ex.: ReplacePrefixMatch) de forma nativa e portavel, substituindo a annotation rewrite-target. RequestRedirect faz redirecionamento 3xx; RequestHeaderModifier mexe em headers; RequestMirror espelha trafego para outro backend.',
      reference: 'Secao Filters — tabela de equivalencia com annotations da Ingress.'
    },
    {
      question: 'Em um HTTPRoute, dentro de UM unico item de "matches" voce define path=/api E header x-version=v2. Como essas condicoes sao combinadas?',
      options: [
        'OR — basta uma das condicoes casar',
        'AND — ambas precisam casar simultaneamente',
        'Sao ignoradas; so o path conta',
        'Depende do controller'
      ],
      correct: 1,
      explanation: 'Dentro de um mesmo objeto match, todas as condicoes (path, headers, queryParams, method) sao AND — precisam casar juntas. Itens DIFERENTES na lista matches sao OR. E a mesma logica AND/OR das NetworkPolicies, uma pegadinha frequente.',
      reference: 'Secao HTTPRoute — AND dentro do match, OR entre matches.'
    },
    {
      question: 'Voce aplicou um Gateway HTTPS mas o campo ADDRESS fica vazio e PROGRAMMED=False. Qual a interpretacao mais provavel?',
      options: [
        'O HTTPRoute esta com host errado',
        'O controller ainda nao provisionou/configurou o data plane (ou nao ha controller para a GatewayClass)',
        'Falta um ReferenceGrant',
        'O Service backend nao existe'
      ],
      correct: 1,
      explanation: 'PROGRAMMED=True e ADDRESS preenchido indicam que o controller materializou o Gateway. Vazio/False normalmente significa que o controller da GatewayClass nao esta rodando, nao reconhece a classe, ou ainda nao terminou de provisionar o LB. Cheque kubectl get gatewayclass e os logs do controller.',
      reference: 'Secao Status & Conditions — PROGRAMMED no Gateway = data plane pronto.'
    },
    {
      question: 'Qual afirmacao sobre Gateway API vs Ingress esta CORRETA?',
      options: [
        'A Gateway API ja removeu a Ingress API do Kubernetes',
        'Ambas coexistem; a Ingress esta em modo manutencao e a Gateway API (GA) e onde ocorre o desenvolvimento novo',
        'A Gateway API so funciona com Istio',
        'A Ingress suporta TCP/UDP nativamente, a Gateway API nao'
      ],
      correct: 1,
      explanation: 'A Ingress nao foi removida — esta congelada (so manutencao). A Gateway API e GA (v1.0+) e concentra a evolucao: filters nativos, role separation, cross-namespace e suporte a HTTP/gRPC/TLS/TCP/UDP. As duas coexistem durante a transicao.',
      reference: 'Secao Gateway API vs Ingress — tabela comparativa.'
    }
  ],

  flashcards: [
    {
      front: 'Quais sao os 3 recursos centrais da Gateway API e a persona de cada um?',
      back: '**GatewayClass** (infra provider) — aponta para o controller, como uma StorageClass; cluster-scoped.\n\n**Gateway** (operador do cluster) — a instancia do proxy/LB; define listeners (porta, protocolo, hostname, TLS, allowedRoutes).\n\n**HTTPRoute** (desenvolvedor da app) — regras L7; conecta ao Gateway via parentRefs e ao Service via backendRefs.\n\nModelo **role-oriented**: cada persona mexe so no seu recurso.'
    },
    {
      front: 'O que e e onde vive um ReferenceGrant?',
      back: 'Autoriza referencias **cross-namespace** (negadas por padrao).\n\nDois casos: HTTPRoute → Service em outro ns, e Gateway → Secret TLS em outro ns.\n\n**Vive no namespace do recurso ALVO** (quem concede).\n\n```yaml\nkind: ReferenceGrant\nmetadata:\n  namespace: backend   # ns do Service\nspec:\n  from:\n    - kind: HTTPRoute\n      namespace: apps\n  to:\n    - kind: Service\n```\n\nSem ele: ResolvedRefs=False / RefNotPermitted.'
    },
    {
      front: 'Como funciona o traffic splitting (canary) na Gateway API?',
      back: 'Nativo, via multiplos **backendRefs** com **weight** numa rule:\n\n```yaml\nbackendRefs:\n  - name: app-stable\n    port: 80\n    weight: 90\n  - name: app-canary\n    port: 80\n    weight: 10\n```\n\nPeso e **relativo** (90:10). weight: 0 = backend para de receber. Sem annotations proprietarias.'
    },
    {
      front: 'allowedRoutes.namespaces.from — quais valores e o que fazem?',
      back: '**Same** — so Routes do mesmo namespace do Gateway.\n\n**All** — Routes de qualquer namespace.\n\n**Selector** — Routes de namespaces que casam um matchLabels.\n\nControla quem pode anexar ao listener. Se nao bater: HTTPRoute fica Accepted=False (NotAllowedByListeners).'
    },
    {
      front: 'Logica AND vs OR nos matches de um HTTPRoute',
      back: '**AND** — condicoes (path, headers, queryParams, method) DENTRO de um mesmo objeto match.\n\n**OR** — itens DIFERENTES na lista matches.\n\n```yaml\nmatches:\n  - path: { type: PathPrefix, value: /api }\n    headers:\n      - name: x-version\n        value: v2          # path AND header\n  - path: { type: Exact, value: /health }  # OR esta regra\n```\n\nMesma logica das NetworkPolicies.'
    },
    {
      front: 'Quais conditions checar ao debugar Gateway API e o que indicam?',
      back: '**Accepted** (HTTPRoute) — o Gateway aceitou anexar a Route. False/NotAllowedByListeners = allowedRoutes/hostname nao batem.\n\n**ResolvedRefs** (HTTPRoute) — backendRefs/secrets resolvidos. False/BackendNotFound = Service errado; RefNotPermitted = falta ReferenceGrant.\n\n**Programmed** (Gateway) — data plane configurado; junto com ADDRESS preenchido = pronto.\n\n`kubectl describe httproute/gateway` mostra tudo.'
    },
    {
      front: 'Gateway API vs Ingress — 4 diferencas-chave',
      back: '1. **Status**: Ingress congelada (so manutencao) vs Gateway API GA e ativa.\n2. **Avancado**: Ingress via annotations proprietarias vs Gateway API com filters nativos (URLRewrite, RequestRedirect...).\n3. **Papeis**: Ingress mistura tudo vs Gateway separa GatewayClass/Gateway/Route.\n4. **Protocolos**: Ingress so HTTP/S vs Gateway HTTP, gRPC, TLS, TCP, UDP. Bonus: cross-namespace com ReferenceGrant.'
    },
    {
      front: 'Diferenca entre TLS mode Terminate e Passthrough no Gateway',
      back: '**Terminate** — o Gateway encerra o TLS (decripta). Exige certificateRefs (Secret com o certificado). O trafego segue para o backend em texto claro (ou re-encriptado).\n\n**Passthrough** — o Gateway NAO decripta; encaminha o TLS bruto ao backend por SNI (usa TLSRoute, nao HTTPRoute). O certificado fica no backend.\n\nApi: listener HTTPS com `tls.mode: Terminate | Passthrough`.'
    }
  ],

  lab: {
    scenario: 'Instalar a Gateway API + um controller (NGINX Gateway Fabric), expor uma app via HTTPRoute, fazer canary por peso e habilitar roteamento cross-namespace com ReferenceGrant.',
    objective: 'Dominar o fluxo GatewayClass → Gateway → HTTPRoute e os dois cenarios que mais caem: traffic splitting e cross-namespace.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Instalar CRDs da Gateway API e o controller',
        instruction: 'Instale as CRDs oficiais da Gateway API e o NGINX Gateway Fabric. Confirme que a GatewayClass fica Accepted.',
        hints: ['As CRDs nao vem por padrao no cluster', 'GatewayClass deve mostrar ACCEPTED=True'],
        solution: `\`\`\`bash
# 1. Instalar as CRDs da Gateway API (canal standard)
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.1.0/standard-install.yaml

# 2. Instalar o controller (NGINX Gateway Fabric)
kubectl apply -f https://raw.githubusercontent.com/nginx/nginx-gateway-fabric/v1.4.0/deploy/default/deploy.yaml

# 3. Conferir
kubectl get gatewayclass
kubectl get pods -n nginx-gateway
\`\`\``,
        verify: `\`\`\`bash
kubectl get gatewayclass nginx
# NAME    CONTROLLER                                  ACCEPTED   AGE
# nginx   gateway.nginx.org/nginx-gateway-controller  True       1m

kubectl get crd | grep gateway.networking.k8s.io
# Esperado: gateways, httproutes, referencegrants, gatewayclasses...
\`\`\``
      },
      {
        title: 'Criar o Gateway e uma app, expor via HTTPRoute',
        instruction: 'Crie o namespace infra com um Gateway (HTTP :80, allowedRoutes: All) e uma app no namespace apps exposta por um HTTPRoute.',
        hints: ['parentRefs precisa do namespace do Gateway', 'Use kubectl run + expose para a app'],
        solution: `\`\`\`bash
kubectl create namespace infra
kubectl create namespace apps

# Gateway
cat <<'EOF' | kubectl apply -f -
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: prod-gateway
  namespace: infra
spec:
  gatewayClassName: nginx
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: All
EOF

# App + Service no namespace apps
kubectl create deployment web --image=nginx -n apps
kubectl expose deployment web --port=80 -n apps

# HTTPRoute
cat <<'EOF' | kubectl apply -f -
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: web-route
  namespace: apps
spec:
  parentRefs:
    - name: prod-gateway
      namespace: infra
  hostnames:
    - "web.k8s.local"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: web
          port: 80
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get gateway prod-gateway -n infra
# PROGRAMMED deve ir para True

kubectl describe httproute web-route -n apps | grep -A3 Conditions
# Esperado: Accepted=True e ResolvedRefs=True
\`\`\``
      },
      {
        title: 'Traffic splitting 80/20 (canary)',
        instruction: 'Adicione uma versao canary (web-canary) e ajuste o HTTPRoute para enviar 80% ao web estavel e 20% ao canary via weight.',
        hints: ['Dois backendRefs com weight', 'Peso e relativo'],
        solution: `\`\`\`bash
# Deploy canary
kubectl create deployment web-canary --image=nginxdemos/hello -n apps
kubectl expose deployment web-canary --port=80 -n apps

# Atualizar a Route com pesos
cat <<'EOF' | kubectl apply -f -
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: web-route
  namespace: apps
spec:
  parentRefs:
    - name: prod-gateway
      namespace: infra
  hostnames:
    - "web.k8s.local"
  rules:
    - backendRefs:
        - name: web
          port: 80
          weight: 80
        - name: web-canary
          port: 80
          weight: 20
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get httproute web-route -n apps -o jsonpath='{.spec.rules[0].backendRefs[*].weight}'
# Esperado: 80 20

# (Opcional) gerar trafego e observar a distribuicao via porta do gateway
# GW=$(kubectl get gateway prod-gateway -n infra -o jsonpath='{.status.addresses[0].value}')
# for i in $(seq 20); do curl -s -H "Host: web.k8s.local" http://$GW/ | grep -o 'Server\\|nginx'; done
\`\`\``
      },
      {
        title: 'Roteamento cross-namespace com ReferenceGrant',
        instruction: 'Crie um Service em um terceiro namespace (backend) e roteie para ele a partir do HTTPRoute em apps. Observe a falha, depois conceda acesso com ReferenceGrant.',
        hints: ['Sem grant: ResolvedRefs=False / RefNotPermitted', 'O ReferenceGrant fica no namespace backend'],
        solution: `\`\`\`bash
kubectl create namespace backend
kubectl create deployment api --image=nginx -n backend
kubectl expose deployment api --port=80 -n backend

# Apontar a Route (em apps) para o Service api (em backend) -> vai FALHAR primeiro
kubectl patch httproute web-route -n apps --type=json -p '[
  {"op":"replace","path":"/spec/rules/0/backendRefs","value":[{"name":"api","namespace":"backend","port":80}]}
]'

kubectl describe httproute web-route -n apps | grep -A3 Conditions
# Esperado agora: ResolvedRefs=False (RefNotPermitted)

# Conceder acesso com ReferenceGrant no namespace ALVO (backend)
cat <<'EOF' | kubectl apply -f -
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: allow-apps
  namespace: backend
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: apps
  to:
    - group: ""
      kind: Service
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl describe httproute web-route -n apps | grep -A3 Conditions
# Esperado: ResolvedRefs=True apos o ReferenceGrant

# Limpeza
kubectl delete namespace apps infra backend
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'HTTPRoute nao anexa ao Gateway (Accepted=False)',
      difficulty: 'medium',
      symptom: 'O HTTPRoute foi criado sem erros, mas o trafego nao chega ao Service e "kubectl describe" mostra Accepted=False com reason NotAllowedByListeners ou NoMatchingListenerHostname.',
      diagnosis: `\`\`\`bash
# Ver as conditions da Route
kubectl describe httproute minha-route -n apps | grep -A5 Conditions

# Comparar namespace da Route x allowedRoutes do Gateway
kubectl get gateway prod-gateway -n infra -o jsonpath='{.spec.listeners[*].allowedRoutes.namespaces.from}'

# Comparar hostname do listener x hostnames da Route
kubectl get gateway prod-gateway -n infra -o jsonpath='{.spec.listeners[*].hostname}'
kubectl get httproute minha-route -n apps -o jsonpath='{.spec.hostnames}'
\`\`\``,
      solution: `**Duas causas tipicas:**

1. **allowedRoutes restritivo** — o listener esta com \`from: Same\` e a Route esta em outro namespace. Solucao: mudar para \`from: All\` (ou \`Selector\` com labels), ou mover a Route para o namespace do Gateway.

2. **Hostname incompativel** — o listener tem \`hostname: *.example.com\` e a Route usa \`foo.other.com\`. O dominio precisa casar (incluindo wildcard). Ajuste o \`hostnames\` da Route ou o \`hostname\` do listener.

\`\`\`bash
# Exemplo: liberar todos os namespaces
kubectl patch gateway prod-gateway -n infra --type=json -p '[
  {"op":"replace","path":"/spec/listeners/0/allowedRoutes/namespaces/from","value":"All"}
]'
\`\`\`

**Prevencao:** sempre confira allowedRoutes + hostname antes de criar a Route; eles sao o "contrato" do listener.`
    },
    {
      title: 'ResolvedRefs=False com RefNotPermitted (cross-namespace)',
      difficulty: 'medium',
      symptom: 'Um HTTPRoute aponta para um Service em outro namespace e a condition ResolvedRefs fica False com reason RefNotPermitted. O Service existe e esta saudavel.',
      diagnosis: `\`\`\`bash
kubectl describe httproute api-route -n apps | grep -A5 Conditions
# ResolvedRefs   False   RefNotPermitted

# Existe ReferenceGrant no namespace ALVO?
kubectl get referencegrant -n backend
\`\`\``,
      solution: `**Causa:** referencias cross-namespace sao negadas por padrao. Falta um \`ReferenceGrant\` no **namespace do Service** (o alvo) autorizando o HTTPRoute de origem.

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: allow-apps-to-backend
  namespace: backend          # namespace do Service referenciado
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: apps         # de onde vem o HTTPRoute
  to:
    - group: ""
      kind: Service
\`\`\`

**Lembrete-chave:** o grant SEMPRE vive do lado de quem POSSUI o recurso referenciado, nunca do lado de quem pede. O mesmo vale para um Gateway referenciando um Secret de TLS em outro namespace.`
    },
    {
      title: 'Gateway sem ADDRESS e PROGRAMMED=False',
      difficulty: 'hard',
      symptom: 'O Gateway foi aplicado mas nunca recebe um ADDRESS e a condition Programmed permanece False. Nenhuma Route funciona.',
      diagnosis: `\`\`\`bash
kubectl get gateway prod-gateway -n infra
# ADDRESS vazio, PROGRAMMED False

# A GatewayClass existe e foi aceita?
kubectl get gatewayclass

# O controller esta rodando?
kubectl get pods -A | grep -i gateway

# Logs do controller
kubectl logs -n nginx-gateway deploy/nginx-gateway -c nginx-gateway --tail=50
\`\`\``,
      solution: `**Causas possiveis:**

1. **Controller ausente/quebrado** — a GatewayClass aponta para um \`controllerName\` cujo controller nao esta instalado ou esta em CrashLoop. Sem controller, ninguem materializa o Gateway. Instale/repare o controller.

2. **gatewayClassName errado** — o campo nao bate com nenhuma GatewayClass existente. Confira \`kubectl get gatewayclass\` e corrija.

3. **Sem LoadBalancer disponivel** — em clusters bare-metal sem MetalLB/provider, um Service LoadBalancer fica Pending e o Gateway nao ganha ADDRESS. Use NodePort/MetalLB ou um controller que use hostPort.

\`\`\`bash
# Verificar o Service do data plane (pode estar Pending)
kubectl get svc -n nginx-gateway
\`\`\`

**Prevencao:** valide \`gatewayclass ACCEPTED=True\` e o pod do controller Running antes de criar Gateways.`
    }
  ]
};
