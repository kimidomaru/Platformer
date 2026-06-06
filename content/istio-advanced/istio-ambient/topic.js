window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['istio-advanced/istio-ambient'] = {
  theory: `# Istio Ambient Mesh (sidecar-less)

## Relevancia
Ambient mesh e a maior mudanca arquitetural do Istio desde o sidecar. Ficou **GA no Istio 1.24 (nov/2024)** e e a direcao recomendada para novas adocoes. Em vez de injetar um proxy Envoy em cada Pod, o Ambient separa a malha em **duas camadas independentes**: uma camada L4 obrigatoria (ztunnel) e uma camada L7 opcional (waypoint). Isso elimina o overhead de CPU/memoria por Pod, remove o reinicio de Pods para entrar/sair da malha e simplifica upgrades.

## Conceitos Fundamentais

### As duas camadas
- **Secure Overlay (L4) - ztunnel**: um **DaemonSet** (um ztunnel por node, nao por Pod) escrito em Rust. Cuida de **mTLS, identidade (SPIFFE), autorizacao L4 e telemetria TCP**. Todo trafego entre Pods da malha passa por ztunnel usando o protocolo **HBONE** (HTTP-Based Overlay Network Environment: mTLS sobre HTTP/2 CONNECT na porta **15008**).
- **Waypoint Proxy (L7)**: um **Deployment de Envoy** opcional, provisionado **por namespace ou por service account**, nao por Pod. So e necessario quando voce precisa de funcoes L7: roteamento HTTP, retries, fault injection, AuthorizationPolicy baseada em metodo/path/header, traffic splitting por peso.

### Modelo mental
> "L4 de graca, L7 quando precisar." Voce coloca um namespace na malha e ja ganha mTLS + identidade sem nenhum proxy no Pod. So adiciona um waypoint nos namespaces que realmente precisam de politica L7.

### Como um Pod entra na malha
Nao ha mais injecao de sidecar. Voce rotula o **namespace**:
\`\`\`
kubectl label namespace default istio.io/dataplane-mode=ambient
\`\`\`
Os Pods existentes entram na malha **sem reinicio**. O node redireciona o trafego deles para o ztunnel local via eBPF/iptables gerenciado pelo CNI do Istio.

## Ambient vs Sidecar

| Aspecto | Sidecar | Ambient |
|---|---|---|
| Proxy L4 | Envoy por Pod | ztunnel por node (DaemonSet) |
| Proxy L7 | Envoy por Pod | waypoint por namespace/SA (opcional) |
| Entrar na malha | injeta sidecar + **reinicia Pod** | rotula namespace, **sem reinicio** |
| Custo por Pod | ~1 Envoy (CPU/mem fixos) | ~0 (so L4 compartilhado) |
| Upgrade do dataplane | reinicia todos os Pods | atualiza ztunnel/waypoint |
| Quando usar L7 | sempre presente | so onde precisa |

## Comandos Essenciais
\`\`\`bash
# Instalar Istio no perfil ambient
istioctl install --set profile=ambient --skip-confirmation

# Componentes esperados: istio-cni (DaemonSet), ztunnel (DaemonSet), istiod
kubectl get daemonset -n istio-system            # ztunnel + istio-cni
kubectl get pods -n istio-system

# Colocar um namespace na malha (L4 mTLS automatico, sem reinicio)
kubectl label namespace default istio.io/dataplane-mode=ambient

# Provisionar um waypoint L7 para o namespace
istioctl waypoint apply -n default --enroll-namespace

# Listar waypoints
istioctl waypoint list -n default

# Inspecionar a configuracao do ztunnel de um node
istioctl ztunnel-config workloads
istioctl ztunnel-config services

# Ver a identidade/policies aplicadas
istioctl ztunnel-config policies
\`\`\`

## Exemplos YAML

### 1. Habilitar ambient num namespace
\`\`\`yaml
apiVersion: v1
kind: Namespace
metadata:
  name: shop
  labels:
    istio.io/dataplane-mode: ambient
\`\`\`

### 2. Waypoint por namespace (Gateway API)
O waypoint e modelado como um **Gateway** da Gateway API com a GatewayClass do Istio:
\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: waypoint
  namespace: shop
  labels:
    istio.io/waypoint-for: service   # service | workload | all | none
spec:
  gatewayClassName: istio-waypoint
  listeners:
  - name: mesh
    port: 15008
    protocol: HBONE
\`\`\`

### 3. Politica L7 (so funciona com waypoint presente)
\`\`\`yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: only-get-reviews
  namespace: shop
spec:
  targetRefs:
  - kind: Service
    group: ""
    name: reviews
  action: ALLOW
  rules:
  - to:
    - operation:
        methods: ["GET"]      # regra de metodo HTTP -> exige L7 -> exige waypoint
\`\`\`

### 4. Traffic splitting L7 com HTTPRoute (atravessa o waypoint)
\`\`\`yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: reviews-canary
  namespace: shop
spec:
  parentRefs:
  - group: ""
    kind: Service
    name: reviews
    port: 9080
  rules:
  - backendRefs:
    - name: reviews-v1
      port: 9080
      weight: 90
    - name: reviews-v2
      port: 9080
      weight: 10
\`\`\`

## Erros Comuns
- **Esperar politica L7 sem waypoint**: \`AuthorizationPolicy\` com metodo/path/header ou \`VirtualService\`/\`HTTPRoute\` **so tem efeito se houver um waypoint** no caminho. Sem waypoint voce so tem L4 (identidade/porta).
- **Apontar AuthorizationPolicy L7 para \`selector\` em vez de \`targetRefs\`**: no ambient as politicas L7 sao anexadas ao waypoint via \`targetRefs\` (Service ou Gateway), nao via selector de Pod como no sidecar.
- **Misturar sidecar e ambient no mesmo Pod**: um Pod com sidecar injetado **nao** deve estar em namespace ambient; escolha um modo por workload.
- **Bloquear a porta 15008**: NetworkPolicy ou firewall de node que bloqueia HBONE (15008) quebra todo o trafego da malha.
- **Achar que ztunnel faz L7**: ztunnel e estritamente L4 (mTLS/identidade/TCP). Qualquer coisa HTTP-aware exige waypoint.

## Killer.sh Style Challenge
Voce recebeu um cluster com Istio em perfil ambient ja instalado. No namespace \`shop\`, o time quer: (1) todo trafego pod-a-pod criptografado com mTLS **sem reiniciar Pods**; (2) o Service \`reviews\` deve aceitar **apenas requests GET** vindos do Service \`productpage\`. Habilite o ambient no namespace, provisione um waypoint e crie a AuthorizationPolicy correta. Valide que a regra de metodo so passa a valer **depois** que o waypoint esta Running, e prove o mTLS com \`istioctl ztunnel-config workloads\`.`,
  quiz: [
    {
      question: 'No Istio Ambient, qual componente prove a camada L4 (mTLS, identidade) e como ele e implantado?',
      options: [
        'ztunnel, como um DaemonSet (um por node)',
        'Envoy, como um sidecar em cada Pod',
        'waypoint, como um Deployment por namespace',
        'istiod, como um Deployment central'
      ],
      correct: 0,
      explanation: 'A Secure Overlay L4 e provida pelo ztunnel, um DaemonSet (um por node, nao por Pod), escrito em Rust, responsavel por mTLS, identidade SPIFFE, autorizacao L4 e telemetria TCP.',
      reference: 'Conceito relacionado: as duas camadas do ambient — estude a secao Conceitos Fundamentais.'
    },
    {
      question: 'Qual protocolo o ztunnel usa para tunelar o trafego mTLS entre nodes e em qual porta?',
      options: [
        'HBONE (mTLS sobre HTTP/2 CONNECT) na porta 15008',
        'gRPC simples na porta 15010',
        'WireGuard na porta 51871',
        'TLS passthrough na porta 443'
      ],
      correct: 0,
      explanation: 'O ztunnel usa HBONE (HTTP-Based Overlay Network Environment): mTLS encapsulado em HTTP/2 CONNECT, na porta 15008. Bloquear essa porta quebra a malha.',
      reference: 'Conceito relacionado: HBONE e porta 15008 — veja Erros Comuns.'
    },
    {
      question: 'Quando um waypoint proxy e realmente necessario no Ambient mesh?',
      options: [
        'Quando voce precisa de funcoes L7: roteamento HTTP, retries, ou AuthorizationPolicy por metodo/path/header',
        'Sempre, pois sem waypoint nao ha mTLS',
        'Apenas para trafego de ingress externo',
        'Somente quando o cluster tem mais de um node'
      ],
      correct: 0,
      explanation: 'O waypoint (Envoy por namespace/SA) so e necessario para L7. mTLS, identidade e politica L4 ja vem do ztunnel sem waypoint. "L4 de graca, L7 quando precisar."',
      reference: 'Conceito relacionado: modelo mental L4/L7 — veja Conceitos Fundamentais.'
    },
    {
      question: 'Como um Pod existente entra na malha ambient?',
      options: [
        'Rotulando o namespace com istio.io/dataplane-mode=ambient, sem reiniciar o Pod',
        'Adicionando uma anotacao de injecao e reiniciando o Pod',
        'Recriando o Deployment com um initContainer manual',
        'Instalando um sidecar Envoy via istioctl kube-inject'
      ],
      correct: 0,
      explanation: 'No ambient nao ha injecao de sidecar. Rotular o namespace com istio.io/dataplane-mode=ambient coloca os Pods na malha sem reinicio; o CNI do Istio redireciona o trafego ao ztunnel local.',
      reference: 'Conceito relacionado: entrar na malha sem reinicio — veja a tabela Ambient vs Sidecar.'
    },
    {
      question: 'Uma AuthorizationPolicy que permite apenas metodo GET no namespace ambient nao esta surtindo efeito. Qual a causa mais provavel?',
      options: [
        'Nao ha waypoint provisionado, entao nao existe camada L7 para avaliar a regra de metodo',
        'O ztunnel nao suporta mTLS nesse namespace',
        'A porta 15008 esta aberta demais',
        'O istiod precisa ser reiniciado apos cada policy'
      ],
      correct: 0,
      explanation: 'Regras L7 (metodo/path/header) exigem um waypoint no caminho. Sem waypoint, o ztunnel so aplica L4 (identidade/porta), entao a regra de metodo GET e ignorada.',
      reference: 'Conceito relacionado: politica L7 exige waypoint — veja Erros Comuns.'
    },
    {
      question: 'Como o waypoint proxy e modelado declarativamente no Istio Ambient?',
      options: [
        'Como um recurso Gateway da Gateway API com gatewayClassName istio-waypoint',
        'Como um Deployment Envoy criado manualmente pelo usuario',
        'Como um campo dentro do PeerAuthentication',
        'Como uma anotacao no Pod alvo'
      ],
      correct: 0,
      explanation: 'O waypoint e um Gateway da Gateway API com gatewayClassName: istio-waypoint e o label istio.io/waypoint-for. O istioctl waypoint apply gera esse recurso.',
      reference: 'Conceito relacionado: waypoint como Gateway — veja Exemplos YAML.'
    },
    {
      question: 'Qual a principal vantagem de custo do Ambient sobre o modo sidecar?',
      options: [
        'L4 e compartilhado por node (ztunnel), eliminando ~1 Envoy de CPU/memoria por Pod',
        'Remove a necessidade de mTLS no cluster',
        'Elimina o istiod do plano de controle',
        'Faz o L7 rodar dentro do kernel via eBPF sem Envoy'
      ],
      correct: 0,
      explanation: 'No sidecar cada Pod carrega um Envoy. No ambient o L4 e um ztunnel compartilhado por node e o L7 (waypoint) so existe onde necessario, reduzindo drasticamente o overhead por Pod.',
      reference: 'Conceito relacionado: tabela de custo Ambient vs Sidecar.'
    }
  ],
  flashcards: [
    { front: 'Quais sao as duas camadas do Istio Ambient?', back: 'Secure Overlay L4 (ztunnel, DaemonSet por node: mTLS/identidade/L4) e Waypoint L7 (Envoy por namespace/SA, opcional: roteamento HTTP, politica por metodo/path/header).' },
    { front: 'O que e HBONE e qual porta usa?', back: 'HTTP-Based Overlay Network Environment: mTLS encapsulado em HTTP/2 CONNECT, usado pelo ztunnel para tunelar trafego entre nodes na porta 15008.' },
    { front: 'Como colocar um namespace na malha ambient?', back: 'kubectl label namespace <ns> istio.io/dataplane-mode=ambient — os Pods entram sem reinicio.' },
    { front: 'ztunnel faz L7?', back: 'Nao. ztunnel e estritamente L4 (mTLS, identidade SPIFFE, autorizacao por porta, telemetria TCP). Qualquer L7 (HTTP) exige um waypoint.' },
    { front: 'Quando voce precisa de um waypoint?', back: 'Quando precisa de funcoes L7: roteamento HTTP, retries, fault injection, traffic splitting por peso, ou AuthorizationPolicy por metodo/path/header.' },
    { front: 'Como o waypoint e provisionado e modelado?', back: 'istioctl waypoint apply -n <ns> --enroll-namespace; e modelado como um Gateway da Gateway API com gatewayClassName: istio-waypoint.' },
    { front: 'Diferenca de entrada na malha: sidecar vs ambient?', back: 'Sidecar injeta um Envoy e exige reinicio do Pod. Ambient rotula o namespace e os Pods entram sem reinicio.' }
  ],
  lab: {
    scenario: 'Voce tem um cluster com Istio instalado no perfil ambient. O namespace shop roda productpage e reviews. O time quer mTLS automatico e uma regra L7 que so permite GET em reviews.',
    objective: 'Habilitar ambient num namespace, provisionar um waypoint e aplicar uma AuthorizationPolicy L7, entendendo a fronteira L4/L7.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Habilitar ambient no namespace e validar mTLS L4',
        instruction: 'Rotule o namespace `shop` para entrar na malha ambient e confirme que os workloads sao geridos pelo ztunnel sem reiniciar Pods.',
        hints: ['O label e istio.io/dataplane-mode=ambient', 'ztunnel e um DaemonSet em istio-system', 'istioctl ztunnel-config workloads mostra os workloads cobertos'],
        solution: '```bash\nkubectl label namespace shop istio.io/dataplane-mode=ambient\n\n# Pods NAO reiniciam; o CNI do Istio redireciona ao ztunnel local\nkubectl get pods -n shop -o wide\n\n# ztunnel rodando como DaemonSet (um por node)\nkubectl get daemonset ztunnel -n istio-system\n```',
        verify: '```bash\n# O namespace deve ter o label ambient\nkubectl get ns shop --show-labels | grep dataplane-mode=ambient\n\n# Os workloads de shop devem aparecer cobertos pelo ztunnel (protocolo HBONE)\nistioctl ztunnel-config workloads | grep shop\n# Saida esperada: linhas com NAMESPACE=shop e PROTOCOL=HBONE\n```'
      },
      {
        title: 'Provisionar o waypoint L7 do namespace',
        instruction: 'Crie um waypoint para o namespace `shop` (necessario para qualquer politica/roteamento L7) e confirme que ele esta Running.',
        hints: ['istioctl waypoint apply', 'O waypoint vira um Gateway da Gateway API (gatewayClassName istio-waypoint)', 'Espere o Pod do waypoint ficar Ready antes de testar regras L7'],
        solution: '```bash\nistioctl waypoint apply -n shop --enroll-namespace\n\n# Confirmar o Gateway e o Deployment do waypoint\nkubectl get gateway -n shop\nkubectl get pods -n shop -l gateway.networking.k8s.io/gateway-name=waypoint\n```',
        verify: '```bash\nistioctl waypoint list -n shop\n# Saida esperada: waypoint com status PROGRAMMED=True\n\nkubectl get pods -n shop -l gateway.networking.k8s.io/gateway-name=waypoint\n# Saida esperada: 1 Pod waypoint em Running/Ready\n```'
      },
      {
        title: 'Aplicar AuthorizationPolicy L7 (apenas GET em reviews)',
        instruction: 'Crie uma AuthorizationPolicy que permita somente o metodo GET no Service `reviews`, anexada ao waypoint via targetRefs. Valide que a regra de metodo so vale com o waypoint presente.',
        hints: ['Use action: ALLOW com operation.methods: ["GET"]', 'No ambient a policy L7 usa targetRefs (kind: Service), nao selector', 'Teste um POST: deve ser negado; um GET: permitido'],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: security.istio.io/v1\nkind: AuthorizationPolicy\nmetadata:\n  name: only-get-reviews\n  namespace: shop\nspec:\n  targetRefs:\n  - kind: Service\n    group: ""\n    name: reviews\n  action: ALLOW\n  rules:\n  - to:\n    - operation:\n        methods: ["GET"]\nEOF\n```',
        verify: '```bash\n# A partir do productpage, GET deve passar (200) e POST deve ser negado (403)\nkubectl exec -n shop deploy/productpage -- curl -s -o /dev/null -w "%{http_code}\\n" http://reviews:9080/health\n# Saida esperada: 200\nkubectl exec -n shop deploy/productpage -- curl -s -o /dev/null -w "%{http_code}\\n" -X POST http://reviews:9080/health\n# Saida esperada: 403 (a regra L7 so funciona porque o waypoint existe)\n```'
      }
    ]
  },
  troubleshooting: [
    {
      title: 'AuthorizationPolicy L7 ignorada (sem waypoint)',
      difficulty: 'medium',
      symptom: 'Uma AuthorizationPolicy que restringe por metodo HTTP (ex.: apenas GET) nao tem efeito no namespace ambient; POSTs continuam passando.',
      diagnosis: '```bash\n# Existe waypoint no namespace?\nistioctl waypoint list -n shop\nkubectl get gateway -n shop\n\n# A policy aponta para um Service via targetRefs?\nkubectl get authorizationpolicy -n shop -o yaml | grep -A4 targetRefs\n```',
      solution: 'Regras L7 (metodo/path/header) so sao avaliadas por um waypoint. Provisione um: `istioctl waypoint apply -n shop --enroll-namespace` e garanta que a policy use `targetRefs` apontando para o Service/Gateway (nao `selector`). Sem waypoint, o ztunnel so aplica L4 e a regra de metodo e ignorada.'
    },
    {
      title: 'Trafego da malha quebrado apos NetworkPolicy',
      difficulty: 'hard',
      symptom: 'Depois de aplicar uma NetworkPolicy restritiva, a comunicacao entre Pods da malha ambient para de funcionar com timeouts.',
      diagnosis: '```bash\n# ztunnel usa HBONE na porta 15008 entre nodes\nkubectl get networkpolicy -A\nistioctl ztunnel-config workloads | grep shop\n\n# Logs do ztunnel do node afetado\nkubectl logs -n istio-system ds/ztunnel | grep -i connect\n```',
      solution: 'A NetworkPolicy esta bloqueando a porta HBONE (15008) usada pelo ztunnel para o tunel mTLS entre nodes. Libere o trafego para a porta 15008 (e 15001/15006/15021/15008 conforme o caso) entre nodes/ztunnel, ou ajuste a NetworkPolicy para permitir o trafego da identidade da malha. Sem isso o overlay seguro nao consegue estabelecer os tuneis.'
    }
  ]
};
