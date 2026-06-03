window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cilium-fundamentals/cilium-network-policies'] = {
  theory: `
# Cilium Network Policies — Seguranca L3-L7 com eBPF

## Relevancia
CiliumNetworkPolicy estende o NetworkPolicy padrao do Kubernetes com suporte a L7 (HTTP, gRPC, Kafka, DNS), FQDN-based rules, identity-aware policies e host-level policies. Dominar essas policies e fundamental para seguranca zero-trust em Kubernetes.

## Conceitos Fundamentais

### NetworkPolicy vs CiliumNetworkPolicy

\`\`\`
NetworkPolicy (K8s nativo):
  - Apenas L3/L4 (IP, porta, protocolo)
  - Selecao por labels e namespaces
  - Sem suporte a FQDN
  - Sem regras L7

CiliumNetworkPolicy (CNP):
  - L3/L4 + L7 (HTTP paths, methods, headers)
  - Identity-aware (labels, nao IPs)
  - FQDN-based egress rules
  - DNS-aware policies
  - Host-level policies (CiliumClusterwideNetworkPolicy)
  - TLS SNI filtering
\`\`\`

### Estrutura de uma CiliumNetworkPolicy

\`\`\`yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: frontend-policy
  namespace: production
spec:
  endpointSelector:
    matchLabels:
      app: frontend
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: api-gateway
      toPorts:
        - ports:
            - port: "8080"
              protocol: TCP
          rules:
            http:
              - method: GET
                path: "/api/v1/.*"
  egress:
    - toEndpoints:
        - matchLabels:
            app: backend
      toPorts:
        - ports:
            - port: "3000"
              protocol: TCP
    - toFQDNs:
        - matchPattern: "*.googleapis.com"
      toPorts:
        - ports:
            - port: "443"
              protocol: TCP
\`\`\`

### L7 Policies — HTTP

\`\`\`yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: api-l7-policy
  namespace: production
spec:
  endpointSelector:
    matchLabels:
      app: api-server
  ingress:
    - fromEndpoints:
        - matchLabels:
            role: frontend
      toPorts:
        - ports:
            - port: "8080"
              protocol: TCP
          rules:
            http:
              # Permitir apenas GET e POST em /api/
              - method: GET
                path: "/api/.*"
              - method: POST
                path: "/api/v1/orders"
                headers:
                  - 'Content-Type: application/json'
\`\`\`

### L7 Policies — gRPC e Kafka

\`\`\`yaml
# gRPC policy
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: grpc-policy
spec:
  endpointSelector:
    matchLabels:
      app: grpc-service
  ingress:
    - toPorts:
        - ports:
            - port: "50051"
          rules:
            http:
              - method: POST
                path: "/mypackage.MyService/.*"
---
# Kafka policy
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: kafka-policy
spec:
  endpointSelector:
    matchLabels:
      app: kafka-consumer
  egress:
    - toEndpoints:
        - matchLabels:
            app: kafka
      toPorts:
        - ports:
            - port: "9092"
          rules:
            kafka:
              - apiKey: "produce"
                topic: "orders"
              - apiKey: "fetch"
                topic: "orders"
\`\`\`

### FQDN-Based Egress

\`\`\`yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: external-access
  namespace: production
spec:
  endpointSelector:
    matchLabels:
      app: payment-service
  egress:
    # Permitir acesso apenas a APIs externas especificas
    - toFQDNs:
        - matchName: "api.stripe.com"
        - matchName: "api.paypal.com"
        - matchPattern: "*.amazonaws.com"
      toPorts:
        - ports:
            - port: "443"
              protocol: TCP
    # Permitir DNS para resolver FQDNs
    - toEndpoints:
        - matchLabels:
            k8s:io.kubernetes.pod.namespace: kube-system
            k8s-app: kube-dns
      toPorts:
        - ports:
            - port: "53"
              protocol: UDP
          rules:
            dns:
              - matchPattern: "*"
\`\`\`

### CiliumClusterwideNetworkPolicy

\`\`\`yaml
# Politica que se aplica a TODO o cluster
apiVersion: cilium.io/v2
kind: CiliumClusterwideNetworkPolicy
metadata:
  name: deny-external-by-default
spec:
  endpointSelector:
    matchLabels:
      env: production
  egress:
    - toEntities:
        - cluster
        - kube-apiserver
    - toCIDR:
        - 10.0.0.0/8
    - toFQDNs:
        - matchPattern: "*.internal.company.com"
      toPorts:
        - ports:
            - port: "443"
\`\`\`

### Entities — Abstracoes de Destino

\`\`\`
Entities no Cilium:
  host         → O node onde o pod roda
  remote-node  → Outros nodes do cluster
  world        → Qualquer IP externo ao cluster
  cluster      → Qualquer endpoint no cluster
  kube-apiserver → API server do Kubernetes
  health       → Cilium health endpoints
  init         → Endpoints sendo inicializados

Exemplo de uso:
  egress:
    - toEntities:
        - cluster       # permite tudo dentro do cluster
        - kube-apiserver # permite acesso ao API server
    - toEntities:
        - world         # bloqueia se nao listar
\`\`\`

### Default Deny

\`\`\`yaml
# Deny all ingress e egress para o namespace
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  endpointSelector: {}
  ingress:
    - {}
  egress:
    - {}
---
# Versao mais restritiva: nega TUDO
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: strict-deny-all
  namespace: production
spec:
  endpointSelector: {}
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Listar CiliumNetworkPolicies
kubectl get cnp -A
kubectl get ccnp  # cluster-wide

# Detalhar uma policy
kubectl describe cnp <name> -n <namespace>

# Verificar policy enforcement
cilium endpoint list
cilium policy get

# Monitor de policy verdicts
cilium monitor --type policy-verdict
cilium monitor --type drop

# Verificar policy em endpoint especifico
cilium bpf policy get <endpoint-id>

# Identidades e labels
cilium identity list
cilium identity get <identity-id>
\`\`\`

## Erros Comuns

1. **Esquecer DNS egress**: FQDN policies precisam de regra DNS explicitamente permitindo resolucao (porta 53/UDP para CoreDNS).
2. **Policy sem match**: endpointSelector vazio ({}) seleciona TODOS os pods do namespace — cuidado com deny-all acidental.
3. **L7 sem proxy**: Policies L7 (HTTP, Kafka) requerem Envoy proxy — verifique se esta habilitado.
4. **Order of evaluation**: Cilium usa whitelist — se ha policy no endpoint, tudo que nao esta explicitamente permitido e negado.
5. **FQDN cache expire**: FQDNs sao resolvidos via DNS e cacheados. TTL curto pode causar falhas intermitentes.

## Killer.sh Style Challenge

**Cenario:** Configure seguranca zero-trust para um microservico com policies L3-L7.

**Tarefas:**
1. Aplique default deny em um namespace
2. Crie regra L7 permitindo apenas GET /api/v1/products
3. Crie regra FQDN para acesso a API externa
4. Verifique policy verdicts com cilium monitor
`,
  quiz: [
    {
      question: 'Qual a principal vantagem da CiliumNetworkPolicy sobre a NetworkPolicy padrao do Kubernetes?',
      options: [
        'E mais rapida por usar iptables',
        'Suporte a regras L7 (HTTP, gRPC, Kafka, DNS), FQDN-based egress e identity-aware policies, alem do L3/L4 padrao',
        'Nao precisa de labels para funcionar',
        'Funciona sem CNI instalado'
      ],
      correct: 1,
      explanation: 'CiliumNetworkPolicy estende NetworkPolicy com: regras L7 (inspecao de HTTP methods/paths, gRPC, Kafka topics), FQDN egress (permitir por dominio), DNS-aware filtering e identity-based matching. Tudo isso usando eBPF para enforcement eficiente no kernel.',
      reference: 'Conceito relacionado: cilium-architecture — eBPF permite inspecao L7 no kernel.'
    },
    {
      question: 'O que acontece quando voce aplica uma CiliumNetworkPolicy a um endpoint?',
      options: [
        'Todo trafego continua normalmente',
        'Apenas o trafego explicitamente definido na policy e permitido — o modelo e whitelist, todo o resto e negado por padrao',
        'Apenas o trafego definido e bloqueado',
        'O pod e reiniciado para aplicar a policy'
      ],
      correct: 1,
      explanation: 'Cilium usa modelo whitelist: quando ha pelo menos uma policy aplicada a um endpoint, TODO trafego que nao esta explicitamente permitido e negado. Isso e diferente do modelo blacklist. E por isso que default-deny e aplicar quando qualquer CNP e criada para aquele endpoint.',
      reference: 'Conceito relacionado: cilium-network-policies — cuidado ao aplicar a primeira policy.'
    },
    {
      question: 'Por que policies FQDN precisam de uma regra DNS explicita?',
      options: [
        'Nao precisam — FQDN funciona automaticamente',
        'Porque o pod precisa resolver o dominio via DNS antes de conectar, e sem permissao de DNS egress (porta 53) a resolucao falha e a conexao nao acontece',
        'Porque o Cilium usa DNS como proxy',
        'Porque FQDN e um alias para IP fixo'
      ],
      correct: 1,
      explanation: 'FQDN policies funcionam interceptando respostas DNS para mapear dominios a IPs. Se o pod nao pode fazer DNS queries (porta 53/UDP para CoreDNS), ele nao resolve o dominio e a conexao falha. Sempre inclua uma regra egress para DNS junto com regras toFQDNs.',
      reference: 'Conceito relacionado: cilium-network-policies — sempre permita DNS ao usar toFQDNs.'
    },
    {
      question: 'O que sao Entities no Cilium?',
      options: [
        'Tipos de containers',
        'Abstracoes de destino pre-definidas como host, world, cluster, kube-apiserver e remote-node, usadas em policies para simplificar regras',
        'Nomes de namespaces',
        'Tipos de servicos Kubernetes'
      ],
      correct: 1,
      explanation: 'Entities sao abstracoes que representam destinos comuns: host (node local), world (IPs externos), cluster (qualquer endpoint interno), kube-apiserver (API server), remote-node (outros nodes). Simplificam policies ao evitar hardcoded CIDRs.',
      reference: 'Conceito relacionado: cilium-network-policies — use entities para regras mais limpas.'
    },
    {
      question: 'Como funciona uma policy L7 HTTP no Cilium?',
      options: [
        'Filtra pacotes pelo tamanho do payload',
        'Usa Envoy proxy para inspecionar o trafego HTTP e aplicar regras por method (GET, POST), path (regex) e headers antes de encaminhar ao pod',
        'Bloqueia todo trafego HTTP automaticamente',
        'Redireciona trafego para um WAF externo'
      ],
      correct: 1,
      explanation: 'Policies L7 usam Envoy proxy integrado ao Cilium para inspecionar o conteudo HTTP. Voce pode filtrar por method (GET, POST, PUT), path (suporta regex), e headers. O trafego passa pelo Envoy, que aplica as regras antes de encaminhar ao pod destino.',
      reference: 'Conceito relacionado: cilium-service-mesh — Envoy e compartilhado com funcionalidades de service mesh.'
    },
    {
      question: 'Qual a diferenca entre CiliumNetworkPolicy e CiliumClusterwideNetworkPolicy?',
      options: [
        'Nao ha diferenca',
        'CiliumNetworkPolicy e namespaced (aplica a pods de um namespace); CiliumClusterwideNetworkPolicy nao tem namespace e pode aplicar a pods de qualquer namespace',
        'CiliumClusterwideNetworkPolicy so funciona com L7',
        'CiliumNetworkPolicy so funciona com L3'
      ],
      correct: 1,
      explanation: 'CiliumNetworkPolicy (CNP) e namespaced — afeta apenas pods do namespace onde e criada. CiliumClusterwideNetworkPolicy (CCNP) e cluster-scoped e pode afetar pods de qualquer namespace. CCNP e ideal para policies globais como default-deny ou restricoes de egress.',
      reference: 'Conceito relacionado: cilium-network-policies — CCNP e util para baseline de seguranca.'
    },
    {
      question: 'Como monitorar policy verdicts em tempo real no Cilium?',
      options: [
        'kubectl get events',
        'cilium monitor --type policy-verdict mostra em tempo real quais pacotes foram permitidos ou negados e por qual policy',
        'cilium policy list',
        'kubectl logs cilium-agent'
      ],
      correct: 1,
      explanation: 'cilium monitor --type policy-verdict mostra em tempo real cada decisao de policy: ALLOWED, DENIED, ou DROPPED. Inclui informacao sobre source/dest identity, porta e qual policy causou a decisao. Essencial para debug de policies.',
      reference: 'Conceito relacionado: cilium-hubble — Hubble oferece visibilidade ainda mais rica de flows.'
    }
  ],
  flashcards: [
    {
      front: 'NetworkPolicy vs CiliumNetworkPolicy?',
      back: '**NetworkPolicy (K8s nativo):**\n- Apenas L3/L4 (IP, porta)\n- Selecao por labels\n- Sem FQDN\n- Sem L7\n\n**CiliumNetworkPolicy:**\n- L3/L4 + L7 (HTTP, gRPC, Kafka)\n- Identity-aware\n- FQDN egress\n- DNS-aware\n- Host-level (CCNP)\n- TLS SNI filtering\n\n**Modelo:** Whitelist\nSe ha policy, tudo nao\nexplicitamente permitido e negado\n\n**CRDs:**\n- CNP = namespaced\n- CCNP = cluster-wide'
    },
    {
      front: 'Policy L7 HTTP no Cilium?',
      back: '**Como funciona:**\n- Envoy proxy inspeciona HTTP\n- Filtra por method, path, headers\n\n**Exemplo:**\n```yaml\ningress:\n  - fromEndpoints:\n      - matchLabels:\n          app: frontend\n    toPorts:\n      - ports:\n          - port: \"8080\"\n        rules:\n          http:\n            - method: GET\n              path: \"/api/.*\"\n            - method: POST\n              path: \"/api/orders\"\n```\n\n**Suporta:**\n- HTTP methods\n- Path regex\n- Headers\n- gRPC services\n- Kafka topics/apiKeys'
    },
    {
      front: 'FQDN-based egress policies?',
      back: '**Para que serve:**\nPermitir egress por dominio\n(nao por IP)\n\n**Exemplo:**\n```yaml\negress:\n  - toFQDNs:\n      - matchName: \"api.stripe.com\"\n      - matchPattern: \"*.aws.com\"\n    toPorts:\n      - ports:\n          - port: \"443\"\n```\n\n**OBRIGATORIO: permitir DNS!**\n```yaml\n  - toEndpoints:\n      - matchLabels:\n          k8s-app: kube-dns\n    toPorts:\n      - ports:\n          - port: \"53\"\n            protocol: UDP\n```\n\n**Sem DNS = FQDN nao funciona!**'
    },
    {
      front: 'Entities no Cilium?',
      back: '**Abstracoes de destino:**\n- **host**: node onde pod roda\n- **remote-node**: outros nodes\n- **world**: IPs externos\n- **cluster**: endpoints internos\n- **kube-apiserver**: API server\n- **health**: health endpoints\n- **init**: inicializando\n\n**Exemplo:**\n```yaml\negress:\n  - toEntities:\n      - cluster\n      - kube-apiserver\n```\n→ Permite tudo interno\n→ Permite API server\n→ Bloqueia world implicitamente\n\n**Vantagem:**\nNao precisa hardcodar CIDRs!'
    },
    {
      front: 'Default deny no Cilium?',
      back: '**Modelo whitelist:**\nSe ha policy, tudo nao\npermitido e NEGADO\n\n**Deny all explicito:**\n```yaml\napiVersion: cilium.io/v2\nkind: CiliumNetworkPolicy\nmetadata:\n  name: default-deny\nspec:\n  endpointSelector: {}\n```\n→ {} seleciona TODOS os pods\n→ Sem ingress/egress = nega tudo\n\n**Entao permitir seletivamente:**\n```yaml\nspec:\n  endpointSelector:\n    matchLabels:\n      app: api\n  ingress:\n    - fromEndpoints:\n        - matchLabels:\n            app: frontend\n```\n\n**Zero-trust = deny by default**'
    },
    {
      front: 'Comandos para debug de policies?',
      back: '**Listar policies:**\n```bash\nkubectl get cnp -A\nkubectl get ccnp\n```\n\n**Policy verdicts:**\n```bash\ncilium monitor --type policy-verdict\ncilium monitor --type drop\n```\n\n**Policy em endpoint:**\n```bash\ncilium endpoint list\ncilium bpf policy get <ep-id>\n```\n\n**Identidades:**\n```bash\ncilium identity list\ncilium identity get <id>\n```\n\n**Policy computed:**\n```bash\ncilium policy get\ncilium policy selectors\n```'
    }
  ],
  lab: {
    scenario: 'Voce precisa implementar seguranca zero-trust para um microservico usando CiliumNetworkPolicies com regras L3, L4 e L7.',
    objective: 'Aplicar default deny, criar regras L7 HTTP, configurar FQDN egress e validar com cilium monitor.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Aplicar Default Deny',
        instruction: `Crie uma CiliumNetworkPolicy de default deny para o namespace de teste.

\`\`\`bash
# Criar namespace de teste
kubectl create namespace policy-demo
kubectl label namespace policy-demo env=demo

# Deploy de teste
kubectl create deployment frontend --image=nginx --namespace=policy-demo
kubectl create deployment backend --image=nginx --namespace=policy-demo
kubectl expose deployment backend --port=80 --namespace=policy-demo

# Default deny
kubectl apply -f - <<EOF
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: default-deny
  namespace: policy-demo
spec:
  endpointSelector: {}
EOF
\`\`\``,
        hints: [
          'endpointSelector: {} seleciona todos os pods do namespace',
          'Sem regras ingress/egress = nega tudo',
          'Teste: kubectl exec frontend -- curl backend deve falhar'
        ],
        solution: `\`\`\`bash
kubectl create namespace policy-demo
kubectl create deployment frontend --image=nginx -n policy-demo
kubectl create deployment backend --image=nginx -n policy-demo
kubectl expose deployment backend --port=80 -n policy-demo
kubectl apply -f - <<EOF
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: default-deny
  namespace: policy-demo
spec:
  endpointSelector: {}
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get cnp -n policy-demo
# Saida esperada: default-deny

# Testar que trafego esta bloqueado
kubectl exec -n policy-demo deploy/frontend -- curl -s --connect-timeout 3 backend 2>&1 || echo "BLOCKED - expected"
# Saida esperada: timeout ou connection refused
\`\`\``
      },
      {
        title: 'Criar Policy L7 HTTP',
        instruction: `Crie uma CiliumNetworkPolicy permitindo frontend acessar backend apenas com GET na porta 80.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: policy-demo
spec:
  endpointSelector:
    matchLabels:
      app: backend
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: frontend
      toPorts:
        - ports:
            - port: "80"
              protocol: TCP
          rules:
            http:
              - method: GET
                path: "/.*"
---
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: allow-frontend-egress
  namespace: policy-demo
spec:
  endpointSelector:
    matchLabels:
      app: frontend
  egress:
    - toEndpoints:
        - matchLabels:
            app: backend
      toPorts:
        - ports:
            - port: "80"
    - toEndpoints:
        - matchLabels:
            k8s:io.kubernetes.pod.namespace: kube-system
            k8s-app: kube-dns
      toPorts:
        - ports:
            - port: "53"
              protocol: UDP
          rules:
            dns:
              - matchPattern: "*"
EOF
\`\`\``,
        hints: [
          'Precisa de regra no backend (ingress) E no frontend (egress)',
          'L7 HTTP usa Envoy proxy — pode haver um pequeno delay na primeira requisicao',
          'DNS egress e necessario para resolucao do Service name'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: policy-demo
spec:
  endpointSelector:
    matchLabels:
      app: backend
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: frontend
      toPorts:
        - ports:
            - port: "80"
          rules:
            http:
              - method: GET
EOF
\`\`\``,
        verify: `\`\`\`bash
# GET deve funcionar
kubectl exec -n policy-demo deploy/frontend -- curl -s --connect-timeout 5 http://backend/
# Saida esperada: pagina HTML do nginx

# POST deve ser bloqueado pela policy L7
kubectl exec -n policy-demo deploy/frontend -- curl -s -X POST --connect-timeout 5 http://backend/ 2>&1
# Saida esperada: Access denied ou 403
\`\`\``
      },
      {
        title: 'Monitorar Policy Verdicts',
        instruction: `Use cilium monitor para verificar policy verdicts em tempo real.

\`\`\`bash
# Em um terminal, monitore verdicts
cilium monitor --type policy-verdict -n policy-demo

# Em outro terminal, gere trafego
kubectl exec -n policy-demo deploy/frontend -- curl -s http://backend/
kubectl exec -n policy-demo deploy/frontend -- curl -s -X POST http://backend/
\`\`\``,
        hints: [
          'policy-verdict mostra ALLOWED e DENIED para cada pacote',
          'Procure por "verdict: denied" para ver policies bloqueando',
          'Use --type drop para ver apenas pacotes descartados'
        ],
        solution: `\`\`\`bash
# Monitor em background
cilium monitor --type policy-verdict &

# Gerar trafego
kubectl exec -n policy-demo deploy/frontend -- curl -s http://backend/
\`\`\``,
        verify: `\`\`\`bash
# Listar policies aplicadas
kubectl get cnp -n policy-demo
# Saida esperada: default-deny, allow-frontend-to-backend, allow-frontend-egress

# Verificar endpoints com policy
cilium endpoint list | grep policy-demo
# Saida esperada: endpoints com policy enforcement ON
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pod nao consegue acessar servico externo apos policy FQDN',
      difficulty: 'medium',
      symptom: 'Apos criar uma policy FQDN para permitir acesso a uma API externa, o pod nao consegue conectar. Timeout na requisicao.',
      diagnosis: `\`\`\`bash
# Verificar DNS funciona
kubectl exec <pod> -- nslookup api.external.com

# Verificar policy
kubectl describe cnp <policy-name> -n <namespace>

# Verificar drops
cilium monitor --type drop

# Verificar FQDN cache
cilium fqdn cache list
\`\`\``,
      solution: `**Causa mais comum: falta de regra DNS egress**

Adicione permissao DNS junto com toFQDNs:
\`\`\`yaml
egress:
  - toFQDNs:
      - matchName: "api.external.com"
    toPorts:
      - ports:
          - port: "443"
  # OBRIGATORIO: permitir DNS
  - toEndpoints:
      - matchLabels:
          k8s:io.kubernetes.pod.namespace: kube-system
          k8s-app: kube-dns
    toPorts:
      - ports:
          - port: "53"
            protocol: UDP
        rules:
          dns:
            - matchPattern: "*"
\`\`\`

Sem a regra DNS, o pod nao resolve o dominio e a conexao falha.`
    },
    {
      title: 'Policy L7 causa latencia alta',
      difficulty: 'hard',
      symptom: 'Apos aplicar policies L7 HTTP, o servico apresenta latencia elevada e timeouts intermitentes.',
      diagnosis: `\`\`\`bash
# Verificar proxy status
cilium status | grep Proxy

# Verificar Envoy logs
kubectl logs -n kube-system -l k8s-app=cilium -c cilium-envoy --tail=20

# Verificar recursos do cilium agent
kubectl top pods -n kube-system -l k8s-app=cilium

# Verificar metricas do proxy
curl localhost:9964/metrics | grep envoy
\`\`\``,
      solution: `**Solucoes:**

1. **Aumentar recursos do Cilium agent:** L7 policies usam Envoy que consome mais CPU/memoria.

2. **Limitar scope de L7:** Aplique L7 apenas onde necessario — use L3/L4 para trafego que nao precisa de inspecao HTTP.

3. **Verificar numero de regras:** Muitas regras L7 no mesmo endpoint sobrecarregam o proxy. Consolide regras quando possivel.

4. **Envoy connection pool:** Se ha muitas conexoes simultaneas, configure connection pooling no Envoy.`
    },
    {
      title: 'Default deny quebra DNS e CoreDNS',
      difficulty: 'easy',
      symptom: 'Apos aplicar default deny, pods nao conseguem resolver DNS. Todos os servicos ficam inacessiveis por nome.',
      diagnosis: `\`\`\`bash
# Testar DNS
kubectl exec <pod> -- nslookup kubernetes.default

# Verificar CoreDNS
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Verificar drops de DNS
cilium monitor --type drop | grep 53
\`\`\``,
      solution: `**Solucao: adicionar regra DNS egress a cada policy**

\`\`\`yaml
egress:
  # ... suas regras de egress ...

  # Sempre permitir DNS
  - toEndpoints:
      - matchLabels:
          k8s:io.kubernetes.pod.namespace: kube-system
          k8s-app: kube-dns
    toPorts:
      - ports:
          - port: "53"
            protocol: UDP
          - port: "53"
            protocol: TCP
\`\`\`

Ou crie uma CiliumClusterwideNetworkPolicy permitindo DNS para todos:
\`\`\`yaml
apiVersion: cilium.io/v2
kind: CiliumClusterwideNetworkPolicy
metadata:
  name: allow-dns-all
spec:
  endpointSelector: {}
  egress:
    - toEndpoints:
        - matchLabels:
            k8s:io.kubernetes.pod.namespace: kube-system
            k8s-app: kube-dns
      toPorts:
        - ports:
            - port: "53"
\`\`\``
    }
  ]
};
