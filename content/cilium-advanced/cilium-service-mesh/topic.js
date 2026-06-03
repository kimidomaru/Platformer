window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cilium-advanced/cilium-service-mesh'] = {
  theory: `
# Cilium Service Mesh — Mesh sem Sidecar

## Relevancia
Cilium oferece funcionalidades de service mesh nativamente usando eBPF, eliminando a necessidade de sidecar proxies (como Envoy em Istio). Isso reduz latencia, consumo de recursos e complexidade operacional. Suporta Gateway API, mTLS, traffic management e L7 load balancing.

## Conceitos Fundamentais

### Service Mesh Tradicional vs Cilium

\`\`\`
Mesh Tradicional (Istio/Linkerd):
  ┌─────┐    ┌─────────┐    ┌─────────┐    ┌─────┐
  │ App │───▶│ Sidecar │───▶│ Sidecar │───▶│ App │
  └─────┘    │ Envoy   │    │ Envoy   │    └─────┘
             └─────────┘    └─────────┘
  - 2 hops extras por request
  - Overhead de CPU/memoria por pod
  - Complexidade de lifecycle management

Cilium Service Mesh (sidecar-free):
  ┌─────┐                              ┌─────┐
  │ App │──▶ eBPF (kernel) ───────────▶│ App │
  └─────┘   └─ Envoy (por node,       └─────┘
               so quando L7 necessario)
  - Zero ou 1 hop extra (apenas para L7)
  - Envoy compartilhado por node (nao por pod)
  - Menor overhead, menor latencia
\`\`\`

### Gateway API

\`\`\`yaml
# Gateway — define o listener (ponto de entrada)
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: cilium-gateway
  namespace: production
spec:
  gatewayClassName: cilium
  listeners:
    - name: http
      protocol: HTTP
      port: 80
    - name: https
      protocol: HTTPS
      port: 443
      tls:
        mode: Terminate
        certificateRefs:
          - name: tls-secret
---
# HTTPRoute — define regras de roteamento
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-routes
  namespace: production
spec:
  parentRefs:
    - name: cilium-gateway
  hostnames:
    - "api.example.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api/v1
      backendRefs:
        - name: api-v1
          port: 80
          weight: 90
        - name: api-v2
          port: 80
          weight: 10
    - matches:
        - path:
            type: PathPrefix
            value: /api/v2
      backendRefs:
        - name: api-v2
          port: 80
\`\`\`

### Traffic Splitting (Canary)

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-route
  namespace: production
spec:
  parentRefs:
    - name: cilium-gateway
  hostnames:
    - "app.example.com"
  rules:
    - backendRefs:
        - name: app-stable
          port: 80
          weight: 95
        - name: app-canary
          port: 80
          weight: 5
\`\`\`

### Header-Based Routing

\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: header-routing
spec:
  parentRefs:
    - name: cilium-gateway
  rules:
    # Beta users go to v2
    - matches:
        - headers:
            - name: X-User-Group
              value: beta
      backendRefs:
        - name: api-v2
          port: 80
    # Everyone else goes to v1
    - backendRefs:
        - name: api-v1
          port: 80
\`\`\`

### Mutual TLS (mTLS)

\`\`\`yaml
# Habilitar mTLS no Cilium
# helm values:
authentication:
  mutual:
    spiffe:
      enabled: true
      install:
        enabled: true  # instala SPIRE automaticamente
\`\`\`

\`\`\`
mTLS no Cilium:
  - Usa SPIFFE/SPIRE para identidade
  - Certificados automaticos por workload
  - Rotacao automatica
  - Transparente para aplicacao (eBPF intercepta)
  - Sem configuracao por servico

Fluxo:
  Pod A → eBPF → mTLS handshake → eBPF → Pod B
  (aplicacao nao precisa saber sobre TLS)
\`\`\`

### L7 Load Balancing

\`\`\`yaml
# Ingress com Cilium (alternativa ao Gateway API)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  annotations:
    # Cilium como ingress controller
    kubernetes.io/ingress.class: cilium
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-server
                port:
                  number: 80
\`\`\`

### Envoy CRD — Configuracao Avancada

\`\`\`yaml
# CiliumEnvoyConfig para configuracao avancada do Envoy
apiVersion: cilium.io/v2
kind: CiliumEnvoyConfig
metadata:
  name: custom-envoy-config
spec:
  services:
    - name: api-server
      namespace: production
  backendServices:
    - name: api-server
      namespace: production
  resources:
    - "@type": type.googleapis.com/envoy.config.listener.v3.Listener
      name: custom-listener
      # ... configuracao Envoy avancada
\`\`\`

### Comparacao: Cilium vs Istio vs Linkerd

\`\`\`
| Feature          | Cilium    | Istio      | Linkerd    |
|------------------|-----------|------------|------------|
| Sidecar          | Nao*      | Sim        | Sim        |
| Data plane       | eBPF      | Envoy      | Linkerd    |
| mTLS             | SPIFFE    | Citadel    | Built-in   |
| L7 policies      | Sim       | Sim        | Limitado   |
| Gateway API      | Sim       | Sim        | Sim        |
| Network policy   | Sim (L7)  | Sim        | Nao        |
| Observability    | Hubble    | Kiali      | Dashboard  |
| Overhead         | Baixo     | Alto       | Medio      |
| Complexidade     | Media     | Alta       | Baixa      |

* Cilium usa Envoy por NODE quando L7 e necessario,
  nao por POD como sidecar
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Gateway API
kubectl get gateways
kubectl get httproutes
kubectl describe gateway cilium-gateway

# Verificar Envoy no Cilium
cilium status | grep Envoy
kubectl get ciliumenvoyconfigs -A

# Verificar ingress controller
kubectl get ingress -A

# mTLS status
cilium identity list
cilium encrypt status

# Gateway class
kubectl get gatewayclasses
\`\`\`

## Erros Comuns

1. **GatewayClass nao existe**: Cilium precisa ser instalado com gatewayAPI.enabled=true para criar a GatewayClass.
2. **Envoy nao habilitado**: L7 features precisam de Envoy. Verifique se o Envoy esta habilitado no Helm.
3. **mTLS sem SPIRE**: mTLS requer SPIFFE/SPIRE instalado. Use o instalador integrado do Cilium.
4. **Gateway sem IP**: Se usando LoadBalancer, precisa de LB-IPAM ou cloud provider LB.
5. **HTTPRoute nao funciona**: Verifique parentRefs aponta para o Gateway correto e que hostnames batem.

## Killer.sh Style Challenge

**Cenario:** Configure Cilium Service Mesh com Gateway API para um microservico com canary deployment.

**Tarefas:**
1. Crie um Gateway com listener HTTP e HTTPS
2. Configure HTTPRoute com traffic splitting 90/10
3. Configure routing por header para beta users
4. Verifique o trafego com Hubble
`,
  quiz: [
    {
      question: 'Qual a principal diferenca entre Cilium Service Mesh e um mesh tradicional como Istio?',
      options: [
        'Cilium nao suporta mTLS',
        'Cilium usa eBPF no kernel e Envoy compartilhado por node (nao sidecar por pod), reduzindo overhead e latencia significativamente',
        'Cilium nao suporta L7',
        'Nao ha diferenca — ambos usam sidecar'
      ],
      correct: 1,
      explanation: 'Cilium elimina sidecar proxies usando eBPF para L3/L4 diretamente no kernel e compartilhando instancias Envoy por node (nao por pod) apenas quando L7 e necessario. Isso reduz latencia (menos hops), CPU/memoria (sem proxy por pod) e complexidade operacional.',
      reference: 'Conceito relacionado: cilium-architecture — eBPF permite mesh sem sidecar.'
    },
    {
      question: 'O que e Gateway API no contexto do Cilium?',
      options: [
        'Um API server alternativo',
        'O padrao Kubernetes para configurar ingress, roteamento e traffic management, que Cilium implementa nativamente como ingress controller e gateway',
        'Um protocolo proprietario do Cilium',
        'Uma extensao do etcd'
      ],
      correct: 1,
      explanation: 'Gateway API e o sucessor do Ingress no Kubernetes, com recursos como Gateway (ponto de entrada), HTTPRoute (regras de roteamento), traffic splitting e header-based routing. Cilium implementa a spec completa, servindo como ingress controller e gateway.',
      reference: 'Conceito relacionado: cilium-service-mesh — Gateway API e mais expressiva que Ingress.'
    },
    {
      question: 'Como o Cilium implementa mTLS?',
      options: [
        'Usando certificados auto-assinados manuais',
        'Usando SPIFFE/SPIRE para identidade de workload, com certificados automaticos, rotacao automatica e transparente para a aplicacao via eBPF',
        'Cada pod gera seu proprio certificado',
        'Usando TLS termination no ingress apenas'
      ],
      correct: 1,
      explanation: 'Cilium integra SPIFFE/SPIRE para identidade de workloads. SPIRE atribui SVIDs (SPIFFE Verifiable Identity Documents) a cada workload. eBPF intercepta o trafego e aplica mTLS transparentemente — a aplicacao nao precisa de mudancas. Rotacao de certificados e automatica.',
      reference: 'Conceito relacionado: cilium-service-mesh — mTLS requer SPIRE habilitado no Helm.'
    },
    {
      question: 'Como fazer canary deployment com Cilium e Gateway API?',
      options: [
        'Usando replicas diferentes no Deployment',
        'Usando HTTPRoute com backendRefs e weight para dividir trafego percentualmente entre versoes (ex: 95% stable, 5% canary)',
        'Criando dois Services com o mesmo nome',
        'Usando kubectl rollout'
      ],
      correct: 1,
      explanation: 'HTTPRoute permite traffic splitting com weights nos backendRefs. Configure dois backends (stable e canary) com pesos (95/5, 90/10). Cilium roteia o trafego proporcionalmente. Combine com header-based routing para enviar beta users direto ao canary.',
      reference: 'Conceito relacionado: cilium-service-mesh — combine weight com header routing.'
    },
    {
      question: 'Onde o Envoy roda no modelo Cilium Service Mesh?',
      options: [
        'Como sidecar em cada pod',
        'Compartilhado por NODE (nao por pod) — ativado apenas quando funcionalidades L7 sao necessarias, reduzindo drasticamente o overhead',
        'No control plane apenas',
        'Em um cluster separado'
      ],
      correct: 1,
      explanation: 'No Cilium, Envoy e instanciado por node como parte do Cilium Agent, nao como sidecar em cada pod. So e ativado quando ha policies L7 ou funcionalidades que precisam de proxy HTTP. L3/L4 e tratado diretamente pelo eBPF sem Envoy. Isso e significativamente mais eficiente.',
      reference: 'Conceito relacionado: cilium-network-policies — L7 policies ativam Envoy automaticamente.'
    },
    {
      question: 'Qual recurso do Gateway API define regras de roteamento HTTP?',
      options: [
        'Gateway',
        'HTTPRoute — define matches (path, headers, methods) e backendRefs (services de destino com weights opcionais)',
        'GatewayClass',
        'Service'
      ],
      correct: 1,
      explanation: 'HTTPRoute e o recurso que define regras de roteamento: matches (path prefix, exact, headers) determinam qual trafego e afetado, e backendRefs determinam para onde vai (services com weights opcionais para traffic splitting). Gateway define os listeners, GatewayClass define o controller.',
      reference: 'Conceito relacionado: cilium-service-mesh — Gateway + HTTPRoute trabalham juntos.'
    },
    {
      question: 'Qual a vantagem do Cilium Service Mesh em termos de overhead de recursos?',
      options: [
        'Usa mais recursos que Istio, mas e mais seguro',
        'Overhead significativamente menor: sem sidecar por pod, eBPF no kernel para L3/L4, e Envoy compartilhado por node apenas para L7',
        'Mesmo overhead que Istio',
        'Nao ha overhead porque nao tem features'
      ],
      correct: 1,
      explanation: 'Em um mesh com 1000 pods, Istio teria 1000 sidecars Envoy. Cilium teria 0 sidecars — usando eBPF para L3/L4 e Envoy compartilhado por node (~10-50 instancias) apenas quando L7 e necessario. A economia de CPU e memoria e dramatica em escala.',
      reference: 'Conceito relacionado: sre-capacity — menos overhead = menor custo de cluster.'
    }
  ],
  flashcards: [
    {
      front: 'Cilium Service Mesh vs Mesh Tradicional?',
      back: '**Mesh Tradicional (Istio):**\n- Sidecar Envoy por POD\n- 2 hops extras por request\n- Alto overhead CPU/mem\n- 1000 pods = 1000 sidecars\n\n**Cilium Service Mesh:**\n- SEM sidecar\n- eBPF no kernel (L3/L4)\n- Envoy por NODE (so L7)\n- 1000 pods = ~10 Envoys\n\n**Resultado:**\n- Menor latencia\n- Menor custo\n- Menor complexidade\n- Mesmas features L7\n\n**Habilitar:**\n```bash\nhelm install cilium cilium/cilium \\\n  --set envoyConfig.enabled=true \\\n  --set gatewayAPI.enabled=true\n```'
    },
    {
      front: 'Gateway API com Cilium?',
      back: '**GatewayClass:** define o controller\n**Gateway:** ponto de entrada (ports)\n**HTTPRoute:** regras de roteamento\n\n**Exemplo:**\n```yaml\napiVersion: gateway.networking.k8s.io/v1\nkind: Gateway\nmetadata:\n  name: my-gateway\nspec:\n  gatewayClassName: cilium\n  listeners:\n    - name: http\n      port: 80\n      protocol: HTTP\n---\nkind: HTTPRoute\nspec:\n  parentRefs:\n    - name: my-gateway\n  rules:\n    - matches:\n        - path:\n            value: /api\n      backendRefs:\n        - name: api-svc\n          port: 80\n```'
    },
    {
      front: 'Traffic splitting (canary) com Gateway API?',
      back: '**Canary 95/5:**\n```yaml\napiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nspec:\n  rules:\n    - backendRefs:\n        - name: app-stable\n          port: 80\n          weight: 95\n        - name: app-canary\n          port: 80\n          weight: 5\n```\n\n**Header routing (beta):**\n```yaml\n  rules:\n    - matches:\n        - headers:\n            - name: X-User-Group\n              value: beta\n      backendRefs:\n        - name: app-canary\n    - backendRefs:\n        - name: app-stable\n```\n\n**Combine os dois!**'
    },
    {
      front: 'mTLS no Cilium?',
      back: '**Stack:**\n- SPIFFE: framework de identidade\n- SPIRE: implementacao\n- SVIDs: certificados por workload\n\n**Habilitar:**\n```yaml\nauthentication:\n  mutual:\n    spiffe:\n      enabled: true\n      install:\n        enabled: true\n```\n\n**Caracteristicas:**\n- Certificados automaticos\n- Rotacao automatica\n- Transparente (eBPF intercepta)\n- Sem mudanca na app\n\n**Fluxo:**\nPod A → eBPF → mTLS → eBPF → Pod B\n(app nao sabe sobre TLS)'
    },
    {
      front: 'Cilium vs Istio vs Linkerd?',
      back: '**Cilium:**\n- Sem sidecar (eBPF)\n- Overhead baixo\n- Network policies L7\n- Hubble observability\n\n**Istio:**\n- Sidecar Envoy\n- Overhead alto\n- Feature-rich\n- Kiali observability\n\n**Linkerd:**\n- Sidecar leve\n- Overhead medio\n- Simples de operar\n- Dashboard built-in\n\n**Quando usar Cilium Mesh:**\n- Ja usa Cilium CNI\n- Performance critica\n- L7 policies needed\n- Quer evitar sidecars\n\n**Quando usar Istio:**\n- Features avancadas\n- Nao usa Cilium CNI\n- Team ja conhece Istio'
    },
    {
      front: 'Envoy no Cilium — como funciona?',
      back: '**Modelo sidecar (Istio):**\n1 Envoy por POD\n→ Alto overhead\n→ 2 hops extras\n\n**Modelo Cilium:**\n1 Envoy por NODE\n→ Compartilhado entre pods\n→ Ativado APENAS para L7\n→ L3/L4 = eBPF puro (sem Envoy)\n\n**Quando Envoy e ativado:**\n- L7 network policies (HTTP)\n- Gateway API routes\n- mTLS termination\n- L7 load balancing\n\n**Quando NAO precisa Envoy:**\n- L3/L4 policies\n- Basic load balancing\n- kube-proxy replacement\n\n**CRD:**\nCiliumEnvoyConfig para\nconfiguracoes avancadas'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar Cilium como service mesh com Gateway API para gerenciar trafego de um microservico com canary deployment.',
    objective: 'Configurar Gateway, HTTPRoute com traffic splitting e header-based routing.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Configurar Gateway',
        instruction: `Crie um Gateway com Cilium como controller.

\`\`\`bash
# Verificar GatewayClass
kubectl get gatewayclasses

# Criar Gateway
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: mesh-gateway
  namespace: default
spec:
  gatewayClassName: cilium
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: Same
EOF
\`\`\``,
        hints: [
          'GatewayClass cilium e criada automaticamente se gatewayAPI.enabled=true',
          'allowedRoutes controla quais namespaces podem criar HTTPRoutes',
          'Se GatewayClass nao existe, habilite: helm upgrade cilium --set gatewayAPI.enabled=true'
        ],
        solution: `\`\`\`bash
kubectl get gatewayclasses
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: mesh-gateway
spec:
  gatewayClassName: cilium
  listeners:
    - name: http
      port: 80
      protocol: HTTP
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get gateway mesh-gateway
# Saida esperada: NAME           CLASS    ADDRESS   PROGRAMMED   AGE
#                  mesh-gateway   cilium   ...       True         Xs

kubectl describe gateway mesh-gateway
# Saida esperada: Status com Accepted: True
\`\`\``
      },
      {
        title: 'Configurar Canary com HTTPRoute',
        instruction: `Crie deployments e configure traffic splitting com HTTPRoute.

\`\`\`bash
# Criar deployments
kubectl create deployment app-stable --image=nginx
kubectl create deployment app-canary --image=nginx
kubectl expose deployment app-stable --port=80
kubectl expose deployment app-canary --port=80

# Criar HTTPRoute com traffic splitting
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-route
spec:
  parentRefs:
    - name: mesh-gateway
  hostnames:
    - "app.example.com"
  rules:
    - matches:
        - headers:
            - name: X-Canary
              value: "true"
      backendRefs:
        - name: app-canary
          port: 80
    - backendRefs:
        - name: app-stable
          port: 80
          weight: 90
        - name: app-canary
          port: 80
          weight: 10
EOF
\`\`\``,
        hints: [
          'weight distribui trafego percentualmente entre backends',
          'Header match tem prioridade sobre weight quando presente',
          'Use hostnames para rotear por dominio'
        ],
        solution: `\`\`\`bash
kubectl create deployment app-stable --image=nginx
kubectl create deployment app-canary --image=nginx
kubectl expose deployment app-stable --port=80
kubectl expose deployment app-canary --port=80
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-route
spec:
  parentRefs:
    - name: mesh-gateway
  rules:
    - backendRefs:
        - name: app-stable
          port: 80
          weight: 90
        - name: app-canary
          port: 80
          weight: 10
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get httproute canary-route
# Saida esperada: NAME           HOSTNAMES            AGE
#                  canary-route   ["app.example.com"]  Xs

kubectl describe httproute canary-route
# Saida esperada: Rules com backendRefs e weights
\`\`\``
      },
      {
        title: 'Verificar Trafego com Hubble',
        instruction: `Use Hubble para monitorar o trafego passando pelo Gateway e validar traffic splitting.

\`\`\`bash
# Monitorar trafego HTTP
hubble observe --protocol http --namespace default -f

# Em outro terminal, gerar trafego
for i in \$(seq 1 20); do
  curl -s -H "Host: app.example.com" http://<gateway-ip>/
done

# Verificar distribuicao
hubble observe --protocol http --to-pod default/app-canary --last 20
hubble observe --protocol http --to-pod default/app-stable --last 20
\`\`\``,
        hints: [
          'Use Hubble para ver a proporcao real de trafego entre stable e canary',
          'Com 20 requests e weight 90/10, espere ~18 para stable e ~2 para canary',
          'Adicione -H "X-Canary: true" para forcar trafego ao canary'
        ],
        solution: `\`\`\`bash
hubble observe --protocol http --namespace default --last 10
\`\`\``,
        verify: `\`\`\`bash
# Verificar Gateway tem IP
kubectl get gateway mesh-gateway -o jsonpath='{.status.addresses[0].value}'
# Saida esperada: IP do Gateway

# Verificar HTTPRoute esta attached
kubectl get httproute canary-route -o jsonpath='{.status.parents[0].conditions[?(@.type=="Accepted")].status}'
# Saida esperada: True
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'GatewayClass cilium nao encontrada',
      difficulty: 'easy',
      symptom: 'kubectl get gatewayclasses nao retorna nada ou nao mostra "cilium". Gateway fica em status Pending.',
      diagnosis: `\`\`\`bash
# Verificar GatewayClasses
kubectl get gatewayclasses

# Verificar se Gateway API esta habilitado
helm get values cilium -n kube-system | grep gateway

# Verificar CRDs do Gateway API
kubectl get crd | grep gateway
\`\`\``,
      solution: `**Solucoes:**

1. **Habilitar Gateway API no Cilium:**
\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set gatewayAPI.enabled=true
\`\`\`

2. **Instalar CRDs do Gateway API** (se nao existirem):
\`\`\`bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/gateway-api/v1.0.0/config/crd/standard/gateway.networking.k8s.io_gatewayclasses.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/gateway-api/v1.0.0/config/crd/standard/gateway.networking.k8s.io_gateways.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/gateway-api/v1.0.0/config/crd/standard/gateway.networking.k8s.io_httproutes.yaml
\`\`\`

3. **Verificar Cilium Operator** esta rodando — ele cria a GatewayClass.`
    },
    {
      title: 'HTTPRoute nao roteia trafego',
      difficulty: 'medium',
      symptom: 'HTTPRoute criado mas requests nao chegam aos backends. Retorna 404 ou connection refused.',
      diagnosis: `\`\`\`bash
# Verificar status do HTTPRoute
kubectl describe httproute <name>

# Verificar se parentRef esta correto
kubectl get httproute <name> -o jsonpath='{.spec.parentRefs}'

# Verificar Gateway status
kubectl describe gateway <gateway-name>

# Verificar backends existem
kubectl get svc <backend-name>
kubectl get endpoints <backend-name>
\`\`\``,
      solution: `**Solucoes:**

1. **Verificar parentRefs:** HTTPRoute deve referenciar o Gateway correto por nome.

2. **Verificar hostnames:** Se HTTPRoute tem hostnames, o request deve incluir o header Host correto:
\`\`\`bash
curl -H "Host: app.example.com" http://<gateway-ip>/
\`\`\`

3. **Verificar backends:** Services referenciados devem existir e ter endpoints:
\`\`\`bash
kubectl get endpoints <service-name>
\`\`\`

4. **Verificar logs do Cilium:**
\`\`\`bash
kubectl logs -n kube-system -l k8s-app=cilium --tail=20 | grep -i gateway
\`\`\``
    },
    {
      title: 'mTLS nao funciona entre servicos',
      difficulty: 'hard',
      symptom: 'Apos habilitar mTLS, servicos nao conseguem se comunicar. Timeouts e erros de TLS handshake.',
      diagnosis: `\`\`\`bash
# Verificar SPIRE status
kubectl get pods -n cilium-spire

# Verificar identidades
cilium identity list

# Verificar encrypt status
cilium encrypt status

# Verificar logs do SPIRE
kubectl logs -n cilium-spire -l app=spire-agent --tail=20
\`\`\``,
      solution: `**Solucoes:**

1. **SPIRE nao instalado:** Habilite com instalacao integrada:
\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set authentication.mutual.spiffe.enabled=true \\
  --set authentication.mutual.spiffe.install.enabled=true
\`\`\`

2. **SPIRE agent nao running:** Verifique que o SPIRE agent esta em cada node:
\`\`\`bash
kubectl get pods -n cilium-spire -o wide
\`\`\`

3. **Identidades nao registradas:** SPIRE precisa de tempo para registrar workloads. Aguarde e verifique:
\`\`\`bash
kubectl exec -n cilium-spire spire-server-0 -- /opt/spire/bin/spire-server entry show
\`\`\``
    }
  ]
};
