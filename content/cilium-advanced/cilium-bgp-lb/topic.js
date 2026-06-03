window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cilium-advanced/cilium-bgp-lb'] = {
  theory: `
# BGP & Load Balancing — Networking Avancado com Cilium

## Relevancia
Cilium oferece BGP control plane nativo e LoadBalancer IP Address Management (LB-IPAM) integrado, eliminando a necessidade de MetalLB em clusters bare-metal/on-prem. Combinado com DSR e Maglev hashing, oferece load balancing de alta performance para ambientes de producao.

## Conceitos Fundamentais

### BGP Control Plane

\`\`\`
BGP (Border Gateway Protocol):
  - Protocolo de roteamento entre sistemas autonomos
  - Cilium anuncia IPs de Services/Pods para roteadores externos
  - Permite acesso externo a Services sem NodePort

Fluxo:
  1. Pod/Service recebe IP
  2. Cilium anuncia rota via BGP para router externo
  3. Router externo encaminha trafego para o node correto
  4. eBPF encaminha para o pod

Sem BGP (NodePort):
  Client → Router → qualquer node → kube-proxy → pod
  (trafego pode ir para node errado, hop extra)

Com BGP:
  Client → Router → node correto → eBPF → pod
  (roteamento direto, sem hops extras)
\`\`\`

### CiliumBGPPeeringPolicy

\`\`\`yaml
apiVersion: cilium.io/v2alpha1
kind: CiliumBGPPeeringPolicy
metadata:
  name: bgp-policy
spec:
  virtualRouters:
    - localASN: 65001
      exportPodCIDR: true
      neighbors:
        - peerAddress: "10.0.0.1/32"
          peerASN: 65000
          connectRetryTimeSeconds: 120
          holdTimeSeconds: 90
          keepAliveTimeSeconds: 30
          gracefulRestart:
            enabled: true
            restartTimeSeconds: 120
      serviceSelector:
        matchExpressions:
          - key: bgp
            operator: NotIn
            values:
              - exclude
  nodeSelector:
    matchLabels:
      bgp: enabled
\`\`\`

### LB-IPAM — LoadBalancer IP Address Management

\`\`\`yaml
# Pool de IPs para Services tipo LoadBalancer
apiVersion: cilium.io/v2alpha1
kind: CiliumLoadBalancerIPPool
metadata:
  name: production-pool
spec:
  blocks:
    - cidr: "192.168.100.0/24"
  serviceSelector:
    matchLabels:
      env: production
---
# Pool separado para staging
apiVersion: cilium.io/v2alpha1
kind: CiliumLoadBalancerIPPool
metadata:
  name: staging-pool
spec:
  blocks:
    - cidr: "192.168.200.0/24"
  serviceSelector:
    matchLabels:
      env: staging
\`\`\`

\`\`\`
Como funciona:
  1. Service tipo LoadBalancer e criado
  2. LB-IPAM atribui IP do pool configurado
  3. BGP anuncia o IP para roteadores externos
  4. Trafego externo chega ao cluster via rota BGP

Vantagens sobre MetalLB:
  - Integrado ao Cilium (sem componente extra)
  - Usa eBPF para load balancing (mais eficiente)
  - Configuravel por namespace/labels via serviceSelector
  - Compartilha BGP peering com pod CIDR
\`\`\`

### DSR — Direct Server Return

\`\`\`
Modo padrao (SNAT):
  Client → LB → Backend → LB → Client
  (resposta volta pelo LB — mais lento)

DSR:
  Client → LB → Backend → Client
  (resposta vai DIRETO para o client — mais rapido)
  - Menor latencia
  - Menos carga no LB
  - Preserva IP real do client

Habilitar:
  helm install cilium cilium/cilium \\
    --set loadBalancer.mode=dsr
\`\`\`

### Maglev Hashing

\`\`\`
Round-robin (padrao):
  Conexoes distribuidas sequencialmente
  → Nao e sticky — mesma conexao pode ir para backends diferentes
  → Sessao HTTP pode perder estado

Maglev (consistent hashing):
  Hash do (src IP, dst IP, src port, dst port, protocol)
  → Mesma tupla vai SEMPRE para o mesmo backend
  → Se backend morre, apenas suas conexoes sao redistribuidas
  → Session affinity sem overhead

Habilitar:
  helm install cilium cilium/cilium \\
    --set loadBalancer.algorithm=maglev
\`\`\`

### XDP Acceleration

\`\`\`
XDP (eXpress Data Path):
  - Processa pacotes ANTES de entrar no stack TCP/IP
  - Diretamente no driver da NIC
  - Maximo throughput possivel

Modos:
  Native XDP:   driver suporta → maximo performance
  Generic XDP:  fallback no kernel → bom performance

Habilitar:
  helm install cilium cilium/cilium \\
    --set loadBalancer.acceleration=native

Casos de uso:
  - DDoS mitigation
  - High-throughput load balancing
  - Packet filtering de alta performance
\`\`\`

### Configuracao Completa

\`\`\`bash
helm install cilium cilium/cilium \\
  --namespace kube-system \\
  --set kubeProxyReplacement=true \\
  --set bgpControlPlane.enabled=true \\
  --set loadBalancer.mode=dsr \\
  --set loadBalancer.algorithm=maglev \\
  --set loadBalancer.acceleration=native \\
  --set hubble.enabled=true \\
  --set hubble.relay.enabled=true
\`\`\`

## Comandos Essenciais

\`\`\`bash
# BGP status
cilium bgp peers
cilium bgp routes

# LB-IPAM pools
kubectl get ciliumbgppeeringpolicies
kubectl get ciliumloadbalancerippool

# Verificar IPs alocados
kubectl get svc -A -o wide | grep LoadBalancer

# BPF load balancer maps
cilium bpf lb list
cilium bpf lb list --revnat

# Service backends
cilium service list

# Maglev backends
cilium bpf lb maglev list

# DSR status
cilium config view | grep dsr
\`\`\`

## Erros Comuns

1. **BGP peer nao conecta**: Verifique ASN, IP do peer, portas TCP 179 abertas e nodeSelector correto.
2. **Service sem IP externo**: LB-IPAM nao configurado ou pool esgotado. Verifique CiliumLoadBalancerIPPool.
3. **DSR com problemas**: DSR requer que nodes vejam o IP do client. Nao funciona atras de certos load balancers cloud que masqueram o source IP.
4. **XDP nao funciona**: Driver da NIC precisa suportar XDP nativo. Verifique com ethtool.
5. **BGP route flapping**: gracefulRestart deve estar habilitado. Verifique holdTime e keepAlive.

## Killer.sh Style Challenge

**Cenario:** Configure BGP e LB-IPAM em um cluster bare-metal para expor Services tipo LoadBalancer.

**Tarefas:**
1. Configure CiliumBGPPeeringPolicy com peering para router externo
2. Crie CiliumLoadBalancerIPPool com IPs para producao e staging
3. Crie um Service LoadBalancer e verifique que recebeu IP do pool
4. Valide que a rota BGP foi anunciada
`,
  quiz: [
    {
      question: 'O que o BGP control plane do Cilium faz?',
      options: [
        'Gerencia DNS do cluster',
        'Anuncia rotas de IPs de Services e Pods para roteadores externos via BGP, permitindo acesso direto sem NodePort',
        'Cria regras iptables',
        'Gerencia certificados TLS'
      ],
      correct: 1,
      explanation: 'O BGP control plane do Cilium estabelece peering BGP com roteadores externos e anuncia rotas para pod CIDRs e Service IPs (LoadBalancer). Isso permite que trafego externo seja roteado diretamente para o node correto, eliminando NodePort e hops extras.',
      reference: 'Conceito relacionado: cilium-bgp-lb — BGP + LB-IPAM substituem MetalLB.'
    },
    {
      question: 'Qual a funcao do CiliumLoadBalancerIPPool?',
      options: [
        'Define CIDRs de pods',
        'Define pools de IPs que serao atribuidos a Services tipo LoadBalancer automaticamente, com filtro por labels/namespace',
        'Define IPs dos nodes',
        'Define DNS entries'
      ],
      correct: 1,
      explanation: 'CiliumLoadBalancerIPPool define blocos de IPs (CIDRs) que o LB-IPAM usa para atribuir IPs a Services tipo LoadBalancer. serviceSelector permite filtrar quais Services recebem IPs de qual pool — util para separar producao e staging.',
      reference: 'Conceito relacionado: cilium-bgp-lb — IPs do pool sao anunciados via BGP.'
    },
    {
      question: 'O que e DSR (Direct Server Return)?',
      options: [
        'Um protocolo DNS',
        'Modo onde a resposta do backend vai DIRETO para o client, sem passar pelo load balancer, reduzindo latencia e carga no LB',
        'Um tipo de Service Kubernetes',
        'Um modo de backup do etcd'
      ],
      correct: 1,
      explanation: 'No modo SNAT, resposta volta pelo LB (2 hops). No DSR, resposta vai direto do backend para o client (1 hop). Beneficios: menor latencia, menos carga no LB e preservacao do IP real do client. Limitacao: nao funciona atras de LBs que masqueram source IP.',
      reference: 'Conceito relacionado: cilium-architecture — DSR usa eBPF para routing direto.'
    },
    {
      question: 'Por que Maglev hashing e melhor que round-robin para load balancing?',
      options: [
        'E mais simples de configurar',
        'Usa consistent hashing baseado na 5-tupla, garantindo que a mesma conexao va sempre para o mesmo backend, com redistribuicao minima quando backends mudam',
        'Distribui igualmente independente do trafego',
        'Funciona apenas com HTTP'
      ],
      correct: 1,
      explanation: 'Maglev usa hash consistente da 5-tupla (src/dst IP, src/dst port, protocol). Mesma tupla = mesmo backend. Se um backend morre, apenas suas conexoes sao redistribuidas — outros backends nao sao afetados. Ideal para session affinity sem cookies.',
      reference: 'Conceito relacionado: cilium-bgp-lb — Maglev melhora session affinity.'
    },
    {
      question: 'Qual a vantagem do Cilium LB-IPAM sobre MetalLB?',
      options: [
        'MetalLB e mais rapido',
        'Cilium LB-IPAM e integrado (sem componente extra), usa eBPF para LB eficiente, e compartilha BGP peering com pod routing',
        'MetalLB suporta mais protocolos',
        'Nao ha diferenca'
      ],
      correct: 1,
      explanation: 'Cilium LB-IPAM esta integrado — nao precisa instalar/gerenciar MetalLB separadamente. Usa eBPF maps (O(1)) ao inves de iptables. Compartilha sessoes BGP com o routing de pods, simplificando configuracao. serviceSelector permite filtragem granular.',
      reference: 'Conceito relacionado: cilium-architecture — uma unica solucao para CNI, LB e BGP.'
    },
    {
      question: 'O que e XDP acceleration no Cilium?',
      options: [
        'Uma forma de comprimir pacotes',
        'Processamento de pacotes diretamente no driver da NIC, ANTES do stack TCP/IP, oferecendo maximo throughput para load balancing e packet filtering',
        'Um tipo de storage acelerado',
        'Uma forma de cachear DNS'
      ],
      correct: 1,
      explanation: 'XDP (eXpress Data Path) processa pacotes no nivel mais baixo possivel — diretamente no driver da placa de rede. E muito mais rapido que processar no stack TCP/IP. Cilium usa XDP para LB de alto throughput e mitigacao de DDoS. Requer suporte do driver da NIC.',
      reference: 'Conceito relacionado: cilium-bgp-lb — XDP + Maglev + DSR = LB maximo performance.'
    },
    {
      question: 'Como separar pools de IPs LoadBalancer por ambiente (prod/staging)?',
      options: [
        'Nao e possivel — um pool para todos',
        'Criar multiplos CiliumLoadBalancerIPPool com serviceSelector usando labels para direcionar Services de cada ambiente ao pool correto',
        'Criar namespaces diferentes e um so pool',
        'Usar NodePort ao inves de LoadBalancer'
      ],
      correct: 1,
      explanation: 'Crie CiliumLoadBalancerIPPool separados com CIDRs distintos e use serviceSelector com matchLabels para filtrar. Ex: pool prod com selector env=production, pool staging com selector env=staging. Services com label correspondente recebem IP do pool correto.',
      reference: 'Conceito relacionado: cilium-bgp-lb — serviceSelector permite governanca de IPs.'
    }
  ],
  flashcards: [
    {
      front: 'BGP Control Plane no Cilium?',
      back: '**O que faz:**\nAnuncia rotas via BGP para\nroteadores externos\n\n**CiliumBGPPeeringPolicy:**\n```yaml\nspec:\n  virtualRouters:\n    - localASN: 65001\n      exportPodCIDR: true\n      neighbors:\n        - peerAddress: \"10.0.0.1/32\"\n          peerASN: 65000\n```\n\n**Beneficios vs NodePort:**\n- Roteamento direto ao node\n- Sem hops extras\n- IP real do client preservado\n\n**Comandos:**\n```bash\ncilium bgp peers\ncilium bgp routes\n```'
    },
    {
      front: 'LB-IPAM — LoadBalancer IP pools?',
      back: '**CiliumLoadBalancerIPPool:**\n```yaml\nspec:\n  blocks:\n    - cidr: \"192.168.100.0/24\"\n  serviceSelector:\n    matchLabels:\n      env: production\n```\n\n**Fluxo:**\n1. Service LB criado\n2. LB-IPAM atribui IP do pool\n3. BGP anuncia IP externamente\n4. Trafego chega via BGP\n\n**vs MetalLB:**\n- Integrado (sem componente extra)\n- eBPF (mais eficiente)\n- serviceSelector por labels\n- Compartilha BGP peering\n\n**Multiplos pools:**\nProd, staging, DMZ...\ncada um com seu CIDR'
    },
    {
      front: 'DSR vs SNAT?',
      back: '**SNAT (padrao):**\n```\nClient → LB → Backend → LB → Client\n```\n- 2 hops na resposta\n- LB processa ida E volta\n- Source IP masquerado\n\n**DSR (Direct Server Return):**\n```\nClient → LB → Backend → Client\n```\n- 1 hop na resposta\n- LB so processa ida\n- Source IP preservado\n\n**Habilitar:**\n```bash\n--set loadBalancer.mode=dsr\n```\n\n**Limitacao:**\nNao funciona atras de LBs\nque mascaram source IP'
    },
    {
      front: 'Maglev consistent hashing?',
      back: '**Round-robin:**\n- Sequencial\n- Nao sticky\n- Sessao pode mudar backend\n\n**Maglev:**\n- Hash da 5-tupla\n  (src IP, dst IP, ports, proto)\n- Mesma tupla = mesmo backend\n- Backend morre → apenas suas\n  conexoes redistribuidas\n- Session affinity sem cookies\n\n**Habilitar:**\n```bash\n--set loadBalancer.algorithm=maglev\n```\n\n**Ideal para:**\n- APIs com sessao\n- WebSocket\n- gRPC streaming\n- Qualquer workload stateful'
    },
    {
      front: 'XDP acceleration?',
      back: '**XDP (eXpress Data Path):**\nProcessa pacotes ANTES\ndo stack TCP/IP\n→ Diretamente no driver NIC\n→ Maximo throughput\n\n**Modos:**\n- Native: driver suporta\n  → maximo performance\n- Generic: fallback kernel\n  → bom performance\n\n**Habilitar:**\n```bash\n--set loadBalancer.acceleration=native\n```\n\n**Casos de uso:**\n- DDoS mitigation\n- High-throughput LB\n- Packet filtering rapido\n\n**Requisito:**\nDriver NIC precisa suportar\nXDP nativo (checar ethtool)'
    },
    {
      front: 'Configuracao completa de LB?',
      back: '**Helm values:**\n```bash\nhelm install cilium cilium/cilium \\\n  --set kubeProxyReplacement=true \\\n  --set bgpControlPlane.enabled=true \\\n  --set loadBalancer.mode=dsr \\\n  --set loadBalancer.algorithm=maglev \\\n  --set loadBalancer.acceleration=native\n```\n\n**Resultado:**\n- kube-proxy replacement ✓\n- BGP peering ✓\n- DSR (resposta direta) ✓\n- Maglev (consistent hash) ✓\n- XDP (max throughput) ✓\n\n**Verificar:**\n```bash\ncilium bgp peers\ncilium bpf lb list\ncilium service list\n```'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar BGP e LB-IPAM em um cluster para expor Services tipo LoadBalancer em um ambiente bare-metal.',
    objective: 'Configurar CiliumBGPPeeringPolicy, CiliumLoadBalancerIPPool e validar anuncio de rotas.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Habilitar BGP Control Plane',
        instruction: `Verifique e habilite o BGP control plane no Cilium.

\`\`\`bash
# Verificar se BGP esta habilitado
cilium config view | grep bgp

# Se nao estiver, habilitar via Helm
helm upgrade cilium cilium/cilium -n kube-system \\
  --set bgpControlPlane.enabled=true \\
  --set loadBalancer.mode=dsr \\
  --set loadBalancer.algorithm=maglev

# Verificar CRDs BGP
kubectl get crd | grep cilium | grep bgp
\`\`\``,
        hints: [
          'bgpControlPlane.enabled=true ativa o BGP speaker no Cilium Agent',
          'DSR e Maglev sao opcionais mas melhoram performance',
          'CRDs CiliumBGPPeeringPolicy e CiliumLoadBalancerIPPool devem existir'
        ],
        solution: `\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set bgpControlPlane.enabled=true
kubectl get crd | grep cilium | grep bgp
\`\`\``,
        verify: `\`\`\`bash
cilium config view | grep bgp
# Saida esperada: bgp-control-plane: enabled

kubectl get crd ciliumbgppeeringpolicies.cilium.io
# Saida esperada: CRD existe
\`\`\``
      },
      {
        title: 'Configurar LB-IPAM Pool',
        instruction: `Crie um pool de IPs para Services LoadBalancer.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: cilium.io/v2alpha1
kind: CiliumLoadBalancerIPPool
metadata:
  name: main-pool
spec:
  blocks:
    - cidr: "192.168.100.0/28"
  serviceSelector:
    matchExpressions:
      - key: io.kubernetes.service.namespace
        operator: NotIn
        values:
          - kube-system
EOF
\`\`\``,
        hints: [
          '/28 fornece 16 IPs — suficiente para testes',
          'serviceSelector pode filtrar por namespace ou labels',
          'IPs desse pool serao atribuidos automaticamente a Services LB'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: cilium.io/v2alpha1
kind: CiliumLoadBalancerIPPool
metadata:
  name: main-pool
spec:
  blocks:
    - cidr: "192.168.100.0/28"
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get ciliumloadbalancerippool
# Saida esperada: NAME        DISABLED   CONFLICTING   IPS AVAILABLE   AGE
#                  main-pool   false      false         16              Xs
\`\`\``
      },
      {
        title: 'Criar Service LoadBalancer e Validar',
        instruction: `Crie um Service tipo LoadBalancer e verifique que recebeu IP do pool.

\`\`\`bash
# Criar deployment e service
kubectl create deployment nginx-lb --image=nginx
kubectl expose deployment nginx-lb --port=80 --type=LoadBalancer

# Verificar IP atribuido
kubectl get svc nginx-lb

# Verificar nos eBPF maps
cilium service list | grep nginx-lb
cilium bpf lb list | grep <service-ip>
\`\`\``,
        hints: [
          'O IP deve vir do range 192.168.100.0/28',
          'Se EXTERNAL-IP ficar em pending, verifique o pool e seus events',
          'cilium service list mostra todos os services mapeados'
        ],
        solution: `\`\`\`bash
kubectl create deployment nginx-lb --image=nginx
kubectl expose deployment nginx-lb --port=80 --type=LoadBalancer
kubectl get svc nginx-lb -w
\`\`\``,
        verify: `\`\`\`bash
kubectl get svc nginx-lb
# Saida esperada: EXTERNAL-IP com IP do range 192.168.100.x

cilium service list | grep nginx-lb
# Saida esperada: Service listado com frontend IP do pool
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Service LoadBalancer sem EXTERNAL-IP',
      difficulty: 'easy',
      symptom: 'Service tipo LoadBalancer fica com EXTERNAL-IP em <pending> indefinidamente.',
      diagnosis: `\`\`\`bash
# Verificar pools
kubectl get ciliumloadbalancerippool
kubectl describe ciliumloadbalancerippool <pool-name>

# Verificar events do Service
kubectl describe svc <service-name>

# Verificar se BGP esta habilitado
cilium config view | grep bgp

# Verificar Cilium Operator logs
kubectl logs -n kube-system -l app.kubernetes.io/name=cilium-operator --tail=20
\`\`\``,
      solution: `**Solucoes:**

1. **Pool nao existe:** Crie um CiliumLoadBalancerIPPool:
\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: cilium.io/v2alpha1
kind: CiliumLoadBalancerIPPool
metadata:
  name: default-pool
spec:
  blocks:
    - cidr: "192.168.100.0/24"
EOF
\`\`\`

2. **Pool esgotado:** Verifique IPs disponiveis e aumente o CIDR se necessario.

3. **serviceSelector nao match:** Verifique se o selector do pool corresponde ao Service.

4. **BGP nao habilitado:** Habilite bgpControlPlane.enabled=true no Helm.`
    },
    {
      title: 'BGP peer nao estabelece sessao',
      difficulty: 'hard',
      symptom: 'cilium bgp peers mostra status "not established" ou "active" (mas nao "established"). Rotas nao sao anunciadas.',
      diagnosis: `\`\`\`bash
# Verificar BGP peers
cilium bgp peers

# Verificar policy
kubectl describe ciliumbgppeeringpolicy <name>

# Verificar conectividade com peer
kubectl exec -n kube-system <cilium-pod> -- nc -zv <peer-ip> 179

# Verificar logs
kubectl logs -n kube-system -l k8s-app=cilium --tail=50 | grep -i bgp
\`\`\``,
      solution: `**Causas comuns:**

1. **Porta 179 bloqueada:** BGP usa TCP 179. Verifique firewall entre nodes e router.

2. **ASN incorreto:** localASN e peerASN devem corresponder a configuracao do router externo.

3. **nodeSelector nao match:** Verifique que nodes com BGP habilitado tem os labels corretos:
\`\`\`bash
kubectl label node <node-name> bgp=enabled
\`\`\`

4. **Graceful restart:** Habilite para evitar flapping:
\`\`\`yaml
gracefulRestart:
  enabled: true
  restartTimeSeconds: 120
\`\`\``
    },
    {
      title: 'DSR causando problemas de conexao',
      difficulty: 'medium',
      symptom: 'Apos habilitar DSR, clientes recebem timeouts ou conexoes reset em alguns cenarios.',
      diagnosis: `\`\`\`bash
# Verificar modo LB
cilium config view | grep loadbalancer

# Verificar se DSR esta ativo
cilium config view | grep dsr

# Testar com curl
curl -v http://<service-ip>/

# Verificar MTU
ip link show | grep mtu
\`\`\``,
      solution: `**Causas comuns e solucoes:**

1. **LB externo mascara source IP:** DSR precisa que o backend veja o IP real do client. Se ha um LB na frente que faz SNAT, DSR nao funciona. Solucao: use SNAT mode nesse cenario.

2. **MTU mismatch:** DSR pode encapsular pacotes, aumentando o tamanho. Ajuste MTU:
\`\`\`bash
helm upgrade cilium cilium/cilium --set mtu=1450
\`\`\`

3. **Firewall bloqueando resposta direta:** No DSR, a resposta vai do backend direto para o client com source IP diferente do esperado. Firewalls stateful podem bloquear. Ajuste regras.

4. **Fallback para SNAT:** Se DSR nao e viavel, use SNAT com Maglev:
\`\`\`bash
helm upgrade cilium cilium/cilium --set loadBalancer.mode=snat
\`\`\``
    }
  ]
};
