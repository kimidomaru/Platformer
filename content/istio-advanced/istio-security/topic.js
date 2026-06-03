window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['istio-advanced/istio-security'] = {
  theory: `
# Security & mTLS no Istio

## Relevancia
Seguranca e o pilar mais critico do service mesh. O Istio fornece mTLS automatico entre servicos, autenticacao baseada em identidade SPIFFE, autorizacao granular e integracao com JWT. Dominar PeerAuthentication, AuthorizationPolicy e RequestAuthentication e essencial para proteger workloads em producao.

## Conceitos Fundamentais

### Identidade no Istio — SPIFFE

O Istio atribui identidades SPIFFE (Secure Production Identity Framework for Everyone) a cada workload:

\`\`\`
spiffe://<trust-domain>/ns/<namespace>/sa/<service-account>

Exemplo:
spiffe://cluster.local/ns/production/sa/reviews
\`\`\`

O Citadel (dentro do istiod) emite certificados X.509 (SVIDs) para cada sidecar automaticamente. Esses certificados sao usados para mTLS entre servicos.

### mTLS Automatico (Auto mTLS)

Por padrao, o Istio habilita mTLS oportunistico:

\`\`\`
Sidecar <-> Sidecar: mTLS automatico
Sidecar <-> Sem sidecar: plaintext (fallback)
\`\`\`

### PeerAuthentication

Controla a politica de mTLS para trafego entre workloads:

\`\`\`yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system       # mesh-wide
spec:
  mtls:
    mode: STRICT                # requer mTLS em todo o mesh
\`\`\`

**Modos disponiveis:**

| Modo | Comportamento |
|------|---------------|
| STRICT | Aceita apenas mTLS (rejeita plaintext) |
| PERMISSIVE | Aceita mTLS e plaintext (padrao, migracao) |
| DISABLE | Desabilita mTLS |
| UNSET | Herda do nivel superior |

**Granularidade:**
\`\`\`yaml
# Namespace-level
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT
---
# Workload-level (por porta)
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: reviews-policy
  namespace: production
spec:
  selector:
    matchLabels:
      app: reviews
  mtls:
    mode: STRICT
  portLevelMtls:
    8080:
      mode: PERMISSIVE          # porta especifica aceita plaintext
\`\`\`

### AuthorizationPolicy

Controla QUEM pode acessar QUAL servico:

\`\`\`yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: reviews-policy
  namespace: production
spec:
  selector:
    matchLabels:
      app: reviews
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/production/sa/productpage"]
      to:
        - operation:
            methods: ["GET"]
            paths: ["/api/v1/reviews/*"]
\`\`\`

**Actions disponiveis:**

| Action | Comportamento |
|--------|---------------|
| ALLOW | Permite trafego que corresponde as regras |
| DENY | Nega trafego que corresponde as regras |
| CUSTOM | Delega decisao para provedor externo |
| AUDIT | Registra log mas nao bloqueia |

**Ordem de avaliacao:** CUSTOM -> DENY -> ALLOW -> deny-all (padrao implicitly deny)

**Deny-all e Allow-all:**
\`\`\`yaml
# Deny-all para o namespace (zero-trust)
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: deny-all
  namespace: production
spec: {}                        # vazio = negar tudo
---
# Allow-all para o namespace
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-all
  namespace: production
spec:
  rules:
    - {}                        # regra vazia = permitir tudo
\`\`\`

### RequestAuthentication (JWT)

Valida tokens JWT no trafego de entrada:

\`\`\`yaml
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
  name: jwt-auth
  namespace: production
spec:
  selector:
    matchLabels:
      app: reviews
  jwtRules:
    - issuer: "https://accounts.google.com"
      jwksUri: "https://www.googleapis.com/oauth2/v3/certs"
      forwardOriginalToken: true
    - issuer: "https://auth.example.com"
      jwks: |
        { "keys": [{ "kty": "RSA", ... }] }
\`\`\`

**Combinando com AuthorizationPolicy:**
\`\`\`yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: require-jwt
  namespace: production
spec:
  selector:
    matchLabels:
      app: reviews
  action: ALLOW
  rules:
    - from:
        - source:
            requestPrincipals: ["https://accounts.google.com/*"]
      when:
        - key: request.auth.claims[groups]
          values: ["admin", "editor"]
\`\`\`

### Erros Comuns

1. **STRICT mTLS sem sidecar** — servicos sem sidecar sao bloqueados; use PERMISSIVE durante migracao
2. **AuthorizationPolicy vazia** — spec vazio e um deny-all implicito
3. **JWT validation sem AuthorizationPolicy** — RequestAuthentication sozinha nao bloqueia; precisa de AuthorizationPolicy para negar tokens invalidos
4. **Principals case-sensitive** — identidades SPIFFE sao case-sensitive

## Killer.sh Style Challenge

> **Cenario:** Configure zero-trust no namespace production: (1) STRICT mTLS, (2) deny-all padrao, (3) permitir apenas productpage acessar reviews via GET /api/v1/reviews, (4) exigir JWT valido do issuer auth.example.com para acesso externo.
`,
  quiz: [
    {
      question: 'Qual formato de identidade o Istio usa para identificar workloads?',
      options: [
        'Kubernetes UID',
        'SPIFFE (spiffe://trust-domain/ns/namespace/sa/service-account)',
        'IP do Pod',
        'Nome do Deployment'
      ],
      correct: 1,
      explanation: 'O Istio usa SPIFFE IDs no formato spiffe://<trust-domain>/ns/<namespace>/sa/<service-account>. Esses IDs sao codificados em certificados X.509 (SVIDs) emitidos automaticamente pelo Citadel.',
      reference: 'Conceito relacionado: O trust-domain padrao e cluster.local, configuravel no mesh config.'
    },
    {
      question: 'O que acontece quando PeerAuthentication esta em modo STRICT e um servico sem sidecar tenta se comunicar?',
      options: [
        'A comunicacao funciona normalmente',
        'O trafego e criptografado automaticamente',
        'A conexao e rejeitada porque o servico nao pode apresentar certificado mTLS',
        'O Istio injeta sidecar automaticamente'
      ],
      correct: 2,
      explanation: 'No modo STRICT, apenas conexoes mTLS sao aceitas. Servicos sem sidecar Envoy nao podem apresentar certificados mTLS e sao rejeitados. Use PERMISSIVE durante migracao.',
      reference: 'Conceito relacionado: PERMISSIVE aceita tanto mTLS quanto plaintext, ideal para migracao gradual.'
    },
    {
      question: 'Qual e o resultado de criar uma AuthorizationPolicy com spec vazio (spec: {})?',
      options: [
        'Permite todo trafego',
        'Nao tem efeito',
        'Nega todo trafego para o escopo selecionado',
        'Causa erro de validacao'
      ],
      correct: 2,
      explanation: 'Uma AuthorizationPolicy com spec vazio (sem regras) e interpretada como deny-all. Nenhuma regra e avaliada, entao nenhum trafego e permitido. Isso e usado para implementar zero-trust.',
      reference: 'Conceito relacionado: Uma regra vazia (rules: [{}]) tem efeito oposto — permite tudo.'
    },
    {
      question: 'Qual a ordem de avaliacao das AuthorizationPolicies?',
      options: [
        'ALLOW -> DENY -> CUSTOM',
        'CUSTOM -> DENY -> ALLOW -> deny-by-default',
        'DENY -> ALLOW -> CUSTOM',
        'Todas sao avaliadas em paralelo'
      ],
      correct: 1,
      explanation: 'A ordem e: CUSTOM primeiro (delegacao externa), depois DENY (nega se match), depois ALLOW (permite se match). Se nenhuma ALLOW faz match e existem politicas ALLOW, o trafego e negado por padrao.',
      reference: 'Conceito relacionado: Se nao existir nenhuma AuthorizationPolicy, todo trafego e permitido.'
    },
    {
      question: 'RequestAuthentication sozinha bloqueia requests sem JWT?',
      options: [
        'Sim, rejeita automaticamente',
        'Nao, apenas valida tokens presentes; requests sem token passam',
        'Depende do modo TLS',
        'Sim, com retorno 401'
      ],
      correct: 1,
      explanation: 'RequestAuthentication apenas valida tokens JWT quando presentes. Requests sem token sao aceitas (nao autenticadas). Para bloquear requests sem token, combine com AuthorizationPolicy exigindo requestPrincipals.',
      reference: 'Conceito relacionado: AuthorizationPolicy com source.requestPrincipals: ["*"] requer JWT valido.'
    },
    {
      question: 'Como aplicar mTLS STRICT em todo o mesh?',
      options: [
        'Configurar PeerAuthentication em cada namespace',
        'Criar PeerAuthentication com mode STRICT no namespace istio-system',
        'Editar o ConfigMap do Istio',
        'Usar annotation nos Pods'
      ],
      correct: 1,
      explanation: 'Uma PeerAuthentication no namespace istio-system com mode STRICT aplica mTLS obrigatorio em todo o mesh. Politicas mais especificas (namespace/workload) podem sobrescrever.',
      reference: 'Conceito relacionado: Hierarquia — mesh (istio-system) < namespace < workload.'
    },
    {
      question: 'Qual campo na AuthorizationPolicy permite filtrar por claims do JWT?',
      options: [
        'from.source.principals',
        'when.key com request.auth.claims[campo]',
        'to.operation.headers',
        'from.source.jwtClaims'
      ],
      correct: 1,
      explanation: 'O campo when com key request.auth.claims[campo] permite filtrar por claims especificas do JWT, como groups, roles ou email. Isso e combinado com RequestAuthentication.',
      reference: 'Conceito relacionado: request.auth.presenter, request.auth.audiences tambem podem ser usados.'
    }
  ],
  flashcards: [
    {
      front: 'O que e SPIFFE e como o Istio o utiliza?',
      back: '**SPIFFE** = Secure Production Identity Framework for Everyone\n\n**Formato:** spiffe://trust-domain/ns/namespace/sa/service-account\n\n**No Istio:**\n- Citadel (istiod) emite certificados X.509 (SVIDs)\n- Cada workload recebe identidade unica\n- Certificados sao rotacionados automaticamente\n- Usados para mTLS entre sidecars\n- Trust domain padrao: cluster.local'
    },
    {
      front: 'Quais sao os modos do PeerAuthentication?',
      back: '| Modo | Comportamento |\n|------|---------------|\n| **STRICT** | Aceita apenas mTLS |\n| **PERMISSIVE** | mTLS + plaintext (padrao) |\n| **DISABLE** | Desabilita mTLS |\n| **UNSET** | Herda do nivel superior |\n\n**Hierarquia:** mesh (istio-system) < namespace < workload\n\n**Dica:** Use PERMISSIVE durante migracao, STRICT em producao.'
    },
    {
      front: 'Como implementar zero-trust com AuthorizationPolicy?',
      back: '1. **Deny-all no namespace:**\n\`\`\`yaml\nspec: {}\n\`\`\`\n\n2. **ALLOW explicito por servico:**\n\`\`\`yaml\nspec:\n  selector: {matchLabels: {app: X}}\n  action: ALLOW\n  rules:\n    - from: [{source: {principals: [...]}}]\n      to: [{operation: {methods: ["GET"]}}]\n\`\`\`\n\n3. **STRICT mTLS:**\nPeerAuthentication com mode: STRICT\n\nOrdem: CUSTOM -> DENY -> ALLOW -> deny-by-default'
    },
    {
      front: 'Como funciona RequestAuthentication com JWT?',
      back: '**RequestAuthentication:**\n- Valida tokens JWT presentes\n- NAO bloqueia requests sem token\n- Configura issuer + jwksUri\n- Pode ter multiplos jwtRules\n\n**Para bloquear sem token:**\nCombinar com AuthorizationPolicy:\n\`\`\`yaml\nrules:\n  - from:\n      - source:\n          requestPrincipals: ["*"]\n\`\`\`\n\nIsto exige JWT valido em toda request.'
    },
    {
      front: 'Qual a diferenca entre principals e requestPrincipals?',
      back: '**principals:**\n- Identidade mTLS (SPIFFE ID)\n- Vem do certificado X.509\n- Formato: cluster.local/ns/X/sa/Y\n- Autenticacao peer-to-peer\n\n**requestPrincipals:**\n- Identidade do JWT\n- Formato: issuer/subject\n- Ex: accounts.google.com/user123\n- Autenticacao end-user\n\nAmbos podem ser usados na mesma AuthorizationPolicy.'
    },
    {
      front: 'Como o mTLS automatico funciona no Istio?',
      back: '**Auto mTLS (padrao):**\n- Istio detecta se o destino tem sidecar\n- Com sidecar: envia mTLS automaticamente\n- Sem sidecar: envia plaintext\n- Nao requer configuracao manual\n\n**Para forcar mTLS:**\n- PeerAuthentication com mode: STRICT\n- DestinationRule com tls.mode: ISTIO_MUTUAL\n\n**Rotacao de certificados:**\n- Certificados SDS rotacionados automaticamente\n- TTL padrao: 24 horas\n- Configuravel via pilot-agent'
    },
    {
      front: 'Quais actions estao disponiveis na AuthorizationPolicy?',
      back: '| Action | Uso |\n|--------|-----|\n| **ALLOW** | Permite trafego que faz match |\n| **DENY** | Nega trafego que faz match |\n| **CUSTOM** | Delega para provedor externo (OPA, ext-authz) |\n| **AUDIT** | Registra log, nao bloqueia |\n\n**Ordem:** CUSTOM -> DENY -> ALLOW\n\n**Sem nenhuma policy:** tudo e permitido\n**Com ALLOW policy:** deny-by-default para nao-match'
    }
  ],
  lab: {
    scenario: 'Voce precisa implementar seguranca zero-trust no namespace production: mTLS obrigatorio, autorizacao granular e validacao JWT.',
    objective: 'Configurar PeerAuthentication STRICT, AuthorizationPolicy deny-all com excecoes, e RequestAuthentication com JWT.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Configurar mTLS STRICT',
        instruction: `Habilite mTLS obrigatorio para o namespace production e verifique que comunicacao plaintext e rejeitada.

\`\`\`bash
# Criar namespace com injection
kubectl create namespace production
kubectl label namespace production istio-injection=enabled

# Deploy servicos de teste
kubectl apply -n production -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/bookinfo/platform/kube/bookinfo.yaml

# Aplicar mTLS STRICT no namespace
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT
EOF

# Testar: request de Pod COM sidecar (deve funcionar)
kubectl exec -n production deploy/productpage-v1 -c productpage -- curl -s http://reviews:9080/reviews/1 -o /dev/null -w "%{http_code}"

# Testar: request de Pod SEM sidecar (deve falhar)
kubectl run test-nosidecar -n production --image=curlimages/curl --restart=Never --command -- sleep 3600
# Aguardar Pod ficar pronto (sem sidecar porque nao recebeu injection)
kubectl exec -n production test-nosidecar -- curl -s http://reviews:9080/reviews/1 -o /dev/null -w "%{http_code}"
# Esperado: falhar com connection reset
\`\`\``,
        hints: [
          'PeerAuthentication no namespace aplica apenas a aquele namespace',
          'STRICT rejeita qualquer conexao que nao apresente certificado mTLS valido',
          'Use istioctl authn tls-check para verificar status de mTLS'
        ],
        solution: `\`\`\`bash
kubectl create namespace production
kubectl label namespace production istio-injection=enabled
kubectl apply -n production -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/bookinfo/platform/kube/bookinfo.yaml
kubectl apply -f peer-auth-strict.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar PeerAuthentication
kubectl get peerauthentication -n production
# Saida esperada: default   STRICT   Xs

# Verificar mTLS entre servicos
istioctl proxy-config clusters deploy/productpage-v1 -n production | grep reviews
# Saida esperada: reviews.production.svc.cluster.local com ISTIO_MUTUAL

# Verificar certificado
istioctl proxy-config secret deploy/productpage-v1 -n production
# Saida esperada: certificados ROOTCA e default com datas validas
\`\`\``
      },
      {
        title: 'Implementar Zero-Trust com AuthorizationPolicy',
        instruction: `Configure deny-all padrao e crie regras explicitas de acesso entre servicos.

\`\`\`bash
# Deny-all no namespace production
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: deny-all
  namespace: production
spec: {}
EOF

# Testar: todas as requests devem ser negadas
kubectl exec -n production deploy/productpage-v1 -c productpage -- curl -s http://reviews:9080/reviews/1 -o /dev/null -w "%{http_code}"
# Esperado: 403

# Permitir productpage -> reviews (GET)
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-productpage-reviews
  namespace: production
spec:
  selector:
    matchLabels:
      app: reviews
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/production/sa/bookinfo-productpage"]
      to:
        - operation:
            methods: ["GET"]
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-productpage-details
  namespace: production
spec:
  selector:
    matchLabels:
      app: details
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/production/sa/bookinfo-productpage"]
      to:
        - operation:
            methods: ["GET"]
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-reviews-ratings
  namespace: production
spec:
  selector:
    matchLabels:
      app: ratings
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/production/sa/bookinfo-reviews"]
      to:
        - operation:
            methods: ["GET"]
EOF
\`\`\``,
        hints: [
          'spec: {} sem regras cria um deny-all implicito',
          'principals usa o SPIFFE ID: cluster.local/ns/<ns>/sa/<sa>',
          'Cada servico precisa de sua propria AuthorizationPolicy ALLOW'
        ],
        solution: `\`\`\`bash
kubectl apply -f deny-all.yaml
kubectl apply -f allow-policies.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar AuthorizationPolicies
kubectl get authorizationpolicies -n production
# Saida esperada: deny-all, allow-productpage-reviews, allow-productpage-details, allow-reviews-ratings

# Testar productpage -> reviews (deve funcionar)
kubectl exec -n production deploy/productpage-v1 -c productpage -- curl -s http://reviews:9080/reviews/1 -o /dev/null -w "%{http_code}"
# Saida esperada: 200

# Testar acesso nao autorizado (deve ser negado)
kubectl exec -n production deploy/ratings-v1 -c ratings -- curl -s http://reviews:9080/reviews/1 -o /dev/null -w "%{http_code}"
# Saida esperada: 403
\`\`\``
      },
      {
        title: 'Configurar Autenticacao JWT',
        instruction: `Configure RequestAuthentication para validar tokens JWT e combine com AuthorizationPolicy para controlar acesso.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
  name: jwt-auth
  namespace: production
spec:
  selector:
    matchLabels:
      app: productpage
  jwtRules:
    - issuer: "testing@secure.istio.io"
      jwksUri: "https://raw.githubusercontent.com/istio/istio/release-1.20/security/tools/jwt/samples/jwks.json"
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: require-jwt-productpage
  namespace: production
spec:
  selector:
    matchLabels:
      app: productpage
  action: ALLOW
  rules:
    - from:
        - source:
            requestPrincipals: ["testing@secure.istio.io/testing@secure.istio.io"]
EOF

# Testar sem token (deve ser negado)
INGRESS_IP=\$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl -s -o /dev/null -w "%{http_code}" http://\$INGRESS_IP/productpage
# Esperado: 403

# Testar com token valido
TOKEN=\$(curl -s https://raw.githubusercontent.com/istio/istio/release-1.20/security/tools/jwt/samples/demo.jwt)
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer \$TOKEN" http://\$INGRESS_IP/productpage
# Esperado: 200
\`\`\``,
        hints: [
          'RequestAuthentication sozinha NAO bloqueia requests sem token',
          'AuthorizationPolicy com requestPrincipals: ["*"] exige JWT valido',
          'O issuer e subject do JWT formam o requestPrincipal: issuer/subject'
        ],
        solution: `\`\`\`bash
kubectl apply -f jwt-auth-setup.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar RequestAuthentication
kubectl get requestauthentication -n production
# Saida esperada: jwt-auth   Xs

# Verificar AuthorizationPolicy
kubectl get authorizationpolicies require-jwt-productpage -n production
# Saida esperada: require-jwt-productpage   Xs

# Testar sem token (deve falhar)
curl -s -o /dev/null -w "%{http_code}" http://\$INGRESS_IP/productpage
# Saida esperada: 403

# Testar com token valido
TOKEN=\$(curl -s https://raw.githubusercontent.com/istio/istio/release-1.20/security/tools/jwt/samples/demo.jwt)
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer \$TOKEN" http://\$INGRESS_IP/productpage
# Saida esperada: 200
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Servicos retornam 503 apos habilitar STRICT mTLS',
      difficulty: 'medium',
      symptom: 'Apos configurar PeerAuthentication STRICT, algumas comunicacoes entre servicos falham com 503 Service Unavailable.',
      diagnosis: `\`\`\`bash
# Verificar quais Pods tem sidecar
kubectl get pods -n production -o jsonpath='{range .items[*]}{.metadata.name}{" containers="}{range .spec.containers[*]}{.name}{","}{end}{"\\n"}{end}'

# Verificar PeerAuthentication
kubectl get peerauthentication --all-namespaces

# Verificar mTLS status
istioctl proxy-config clusters deploy/<app> -n production | grep <servico-alvo>

# Verificar logs do proxy
kubectl logs <pod> -c istio-proxy -n production | grep -i "TLS\\|reject\\|503"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Servico sem sidecar:** Verifique que todos os Pods no namespace tem o container istio-proxy. Pods sem sidecar nao podem apresentar certificado mTLS.
\`\`\`bash
# Verificar injection
kubectl get namespace production --show-labels | grep injection
\`\`\`

2. **DestinationRule com tls.mode conflitante:** Se existe DestinationRule com tls.mode: DISABLE, ela sobrescreve o mTLS automatico.

3. **Servicos em outros namespaces:** Se o servico alvo esta em outro namespace sem STRICT, o mTLS pode falhar. Aplique PeerAuthentication consistentemente.

4. **Migracao gradual:** Use PERMISSIVE primeiro, verifique que tudo funciona com mTLS, depois mude para STRICT.`
    },
    {
      title: 'AuthorizationPolicy bloqueando trafego que deveria ser permitido',
      difficulty: 'medium',
      symptom: 'Configurou AuthorizationPolicy ALLOW mas o trafego continua sendo negado com 403 RBAC access denied.',
      diagnosis: `\`\`\`bash
# Listar todas as AuthorizationPolicies
kubectl get authorizationpolicies -n production -o yaml

# Verificar se existe deny-all
kubectl get authorizationpolicies -n production -o jsonpath='{range .items[*]}{.metadata.name}{" action="}{.spec.action}{" rules="}{.spec.rules}{"\\n"}{end}'

# Verificar identidade do servico de origem
kubectl exec <pod-origem> -c istio-proxy -n production -- pilot-agent request GET /certs | head -20

# Verificar logs do proxy de destino
kubectl logs <pod-destino> -c istio-proxy -n production | grep "rbac"
\`\`\``,
      solution: `**Causas comuns:**

1. **Principal errado:** Verifique o SPIFFE ID exato do servico de origem. Use \`istioctl proxy-config secret\` para ver o certificado.

2. **ServiceAccount errado:** O principal usa o ServiceAccount do Pod, nao o nome do Deployment. Verifique com \`kubectl get pod -o jsonpath='{.spec.serviceAccountName}'\`.

3. **Namespace no principal:** Inclua o namespace completo: \`cluster.local/ns/production/sa/myapp\`.

4. **Deny-all sem excecao:** Se existe um deny-all, cada servico precisa de seu proprio ALLOW explicito.

5. **Metodo HTTP errado:** Se a policy permite GET mas a app envia POST, o trafego e negado.`
    },
    {
      title: 'JWT validation falha com token valido',
      difficulty: 'hard',
      symptom: 'Configurou RequestAuthentication mas tokens JWT validos sao rejeitados com 401 Jwt verification fails.',
      diagnosis: `\`\`\`bash
# Verificar RequestAuthentication
kubectl get requestauthentication -n production -o yaml

# Decodificar JWT para verificar issuer/audience
echo \$TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | python3 -m json.tool

# Verificar se jwksUri e acessivel
kubectl exec deploy/<app> -c istio-proxy -n production -- curl -s <jwksUri>

# Verificar logs do proxy
kubectl logs <pod> -c istio-proxy -n production | grep -i "jwt\\|401\\|authn"

# Verificar configuracao do listener
istioctl proxy-config listeners <pod> -n production -o json | grep -A5 "jwt"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Issuer mismatch:** O campo issuer na RequestAuthentication deve corresponder exatamente ao claim "iss" do JWT.

2. **jwksUri inacessivel:** Se o proxy nao consegue acessar o JWKS endpoint, a validacao falha. Verifique ServiceEntry se necessario.

3. **Token expirado:** Verifique o claim "exp" do JWT. Tokens expirados sao rejeitados.

4. **Audience errada:** Se configurou audiences na RequestAuthentication, o claim "aud" do JWT deve corresponder.

5. **Clock skew:** Se o Pod tem clock desincronizado, tokens podem ser rejeitados prematuramente. Verifique com \`date\` no container.`
    }
  ]
};
