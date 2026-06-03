window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cilium-fundamentals/cilium-architecture'] = {
  theory: `
# Cilium Architecture & eBPF — O CNI do Futuro

## Relevancia
Cilium e o CNI mais avancado do ecossistema Kubernetes, usando eBPF para networking, seguranca e observabilidade no nivel do kernel. Substituiu o kube-proxy em muitos clusters de producao e e o CNI padrao do GKE, AKS e EKS. Entender Cilium e fundamental para qualquer SRE/Platform Engineer moderno.

## Conceitos Fundamentais

### O que e eBPF?

\`\`\`
eBPF (extended Berkeley Packet Filter):
  - Programas que rodam DENTRO do kernel Linux
  - Sem precisar modificar o kernel ou carregar modulos
  - Sandbox seguro: verificador garante que nao crashe o kernel
  - Usado para: networking, seguranca, tracing, observabilidade

Analogia: eBPF e como JavaScript para o kernel
  - Kernel = navegador
  - eBPF = scripts que rodam no browser sem modificar o navegador
  - Verificador = sandbox do browser

Pipeline:
  C code → compilador → bytecode eBPF → verificador → JIT → kernel
\`\`\`

### Arquitetura do Cilium

\`\`\`
┌─────────────────────────────────────────────────┐
│                 Control Plane                    │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │   Cilium      │  │   Cilium Operator        │ │
│  │   Agent       │  │   (Gerencia CRDs, IPAM,  │ │
│  │   (DaemonSet) │  │    CiliumNodes)           │ │
│  └──────────────┘  └──────────────────────────┘ │
│                                                  │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │   Hubble      │  │   Hubble Relay           │ │
│  │   (observ.)   │  │   (agrega flows)         │ │
│  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│                  Data Plane (eBPF)               │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │ Routing  │  │ L3/L4   │  │ L7 (Envoy)      │ │
│  │ eBPF     │  │ Policy  │  │ Policy Proxy    │ │
│  │ Programs │  │ eBPF    │  │ (quando L7)     │ │
│  └─────────┘  └─────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────┘
\`\`\`

**Componentes:**

| Componente | Tipo | Funcao |
|-----------|------|--------|
| **Cilium Agent** | DaemonSet | Gerencia eBPF programs, endpoints, policies |
| **Cilium Operator** | Deployment | Gerencia CRDs, IPAM, garbage collection |
| **Hubble** | Integrado ao Agent | Observabilidade de rede (flows, metricas) |
| **Hubble Relay** | Deployment | Agrega dados de todos os agents |
| **Hubble UI** | Deployment | Interface grafica para visualizar flows |

### Identity-Based Networking

\`\`\`
Modelo tradicional (iptables):
  Regras baseadas em IP:porta
  → IPs mudam, regras quebram
  → Milhares de regras = lento

Modelo Cilium (eBPF):
  Regras baseadas em IDENTIDADE
  → Identidade = labels do pod
  → Identity e numerica, eficiente
  → Nao depende de IPs

Exemplo:
  Pod com labels {app: frontend, env: prod}
  → Cilium atribui Identity ID: 12345
  → Policies referenciam a identity, nao o IP
  → Quando pod muda de IP, identity continua
\`\`\`

### Cilium como Substituto do kube-proxy

\`\`\`
kube-proxy (iptables mode):
  - Regras iptables para cada Service
  - Performance degrada com muitos Services (O(n))
  - Nao suporta session affinity avancada
  - Sem visibilidade de L7

Cilium (eBPF kube-proxy replacement):
  - eBPF map para Services (O(1) lookup)
  - Performance constante independente do numero de Services
  - Suporta Maglev hashing (consistente)
  - DSR (Direct Server Return) — resposta nao passa pelo LB
  - Socket-level load balancing

Para habilitar:
  helm install cilium cilium/cilium \\
    --set kubeProxyReplacement=true
\`\`\`

### IPAM — IP Address Management

\`\`\`
Modos de IPAM:
  cluster-pool:  Cilium gerencia pool de CIDRs (padrao)
  kubernetes:    Usa IPAM do Kubernetes (node.spec.podCIDR)
  multi-pool:    Multiplos pools para diferentes workloads
  azure/aws/gcp: Integracao nativa com cloud provider

Cluster Pool (padrao):
  --cluster-pool-ipv4-cidr=10.0.0.0/8
  --cluster-pool-ipv4-mask-size=24
  → Cada node recebe um /24 do pool
\`\`\`

### Instalacao com Helm

\`\`\`bash
# Adicionar repo
helm repo add cilium https://helm.cilium.io/
helm repo update

# Instalar Cilium (basico)
helm install cilium cilium/cilium \\
  --namespace kube-system \\
  --set kubeProxyReplacement=true \\
  --set hubble.enabled=true \\
  --set hubble.relay.enabled=true \\
  --set hubble.ui.enabled=true

# Verificar status
cilium status
cilium connectivity test
\`\`\`

### CRDs do Cilium

\`\`\`
CRDs principais:
  CiliumNetworkPolicy       Politica de rede L3-L7
  CiliumClusterwideNetworkPolicy  Politica cluster-wide
  CiliumNode                Representa um node no Cilium
  CiliumEndpoint            Representa um endpoint (pod)
  CiliumIdentity            Identidade de seguranca
  CiliumExternalWorkload    Workload externo ao cluster
  CiliumBGPPeeringPolicy    Configuracao BGP
  CiliumLoadBalancerIPPool  Pool de IPs para LoadBalancer
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Status do Cilium
cilium status
cilium status --verbose

# Listar endpoints
cilium endpoint list

# Verificar identidades
cilium identity list

# Testar conectividade
cilium connectivity test

# Monitor de eventos
cilium monitor

# BPF maps
cilium bpf ct list global
cilium bpf lb list
cilium bpf policy get <endpoint-id>

# Verificar health
cilium-health status
\`\`\`

## Erros Comuns

1. **Nao remover kube-proxy**: Ao usar kubeProxyReplacement=true, remova o kube-proxy DaemonSet e limpe regras iptables existentes.
2. **Kernel antigo**: Cilium requer kernel >= 4.19.57 (recomendado >= 5.10). Kernels antigos nao suportam todos os recursos eBPF.
3. **IPAM conflict**: Se migrando de outro CNI, limpe os CIDRs anteriores e garanta que nao ha sobreposicao.
4. **Cilium Agent crashloop**: Geralmente causado por falta de recursos (memoria) ou conflito com outro CNI. Verifique logs do agent.
5. **Connectivity test falha**: Verifique se todas as portas necessarias estao abertas (VXLAN 8472, health 4240, Hubble 4244).

## Killer.sh Style Challenge

**Cenario:** Instale e configure Cilium como CNI de um cluster Kubernetes, substituindo o kube-proxy.

**Tarefas:**
1. Instale Cilium com kube-proxy replacement e Hubble habilitado
2. Verifique que todos os nodes estao com status OK
3. Execute connectivity test e confirme que tudo passa
4. Identifique a identity de um pod especifico
5. Verifique os eBPF maps de load balancing
`,
  quiz: [
    {
      question: 'O que e eBPF e qual sua relacao com o Cilium?',
      options: [
        'Um protocolo de rede usado pelo Cilium para comunicacao entre pods',
        'Programas que rodam dentro do kernel Linux em sandbox, usados pelo Cilium para networking, seguranca e observabilidade sem modificar o kernel',
        'Um banco de dados usado pelo Cilium para armazenar politicas',
        'Uma alternativa ao Docker para executar containers'
      ],
      correct: 1,
      explanation: 'eBPF (extended Berkeley Packet Filter) permite executar programas em sandbox diretamente no kernel Linux. O verificador garante que os programas sao seguros. Cilium usa eBPF para implementar networking (routing, load balancing), seguranca (policies L3-L7) e observabilidade (Hubble) de forma eficiente.',
      reference: 'Conceito relacionado: cilium-architecture — eBPF substitui iptables com performance superior.'
    },
    {
      question: 'Quais sao os principais componentes da arquitetura Cilium?',
      options: [
        'Cilium Controller, Cilium Scheduler e Cilium Proxy',
        'Cilium Agent (DaemonSet), Cilium Operator (Deployment), Hubble (observabilidade) e Hubble Relay (agregacao)',
        'Cilium Master, Cilium Worker e Cilium Gateway',
        'Cilium API Server, Cilium etcd e Cilium DNS'
      ],
      correct: 1,
      explanation: 'Agent (DaemonSet em cada node) gerencia eBPF programs e endpoints. Operator (Deployment) gerencia CRDs, IPAM e garbage collection. Hubble (integrado ao Agent) fornece observabilidade. Hubble Relay agrega dados de todos os agents para consulta centralizada.',
      reference: 'Conceito relacionado: cilium-hubble — Hubble e o componente de observabilidade do Cilium.'
    },
    {
      question: 'O que e Identity-Based Networking no Cilium?',
      options: [
        'Autenticacao de usuarios para acessar pods',
        'Politicas de rede baseadas em identidades (labels dos pods) ao inves de IPs, permitindo que regras sobrevivam a mudancas de IP',
        'Certificados TLS atribuidos a cada pod',
        'DNS reverso para identificar pods'
      ],
      correct: 1,
      explanation: 'Cilium atribui uma identidade numerica a cada conjunto unico de labels. Policies referenciam essas identidades, nao IPs. Quando um pod muda de IP (reschedule), a identidade permanece, e as policies continuam funcionando — eliminando o problema de regras iptables quebrando com mudancas de IP.',
      reference: 'Conceito relacionado: cilium-network-policies — CiliumNetworkPolicy usa identidades para aplicar regras.'
    },
    {
      question: 'Por que Cilium substitui o kube-proxy com melhor performance?',
      options: [
        'Porque usa DNS ao inves de iptables',
        'Porque eBPF maps tem lookup O(1) vs O(n) do iptables, alem de suportar Maglev hashing e DSR (Direct Server Return)',
        'Porque remove todos os Services do cluster',
        'Porque roda no userspace com mais controle'
      ],
      correct: 1,
      explanation: 'kube-proxy com iptables cria regras lineares — performance degrada com muitos Services. Cilium usa eBPF hash maps com lookup O(1) constante. Maglev hashing garante distribuicao consistente. DSR permite que a resposta va direto do backend ao cliente, sem passar pelo load balancer.',
      reference: 'Conceito relacionado: cilium-bgp-lb — DSR e Maglev sao essenciais para LB de alta performance.'
    },
    {
      question: 'Qual o requisito minimo de kernel para rodar Cilium?',
      options: [
        'Kernel >= 3.10 (qualquer kernel moderno)',
        'Kernel >= 4.19.57, recomendado >= 5.10 para todos os recursos eBPF',
        'Kernel >= 6.0 (apenas kernels mais recentes)',
        'Nao ha requisito de kernel — funciona em qualquer versao'
      ],
      correct: 1,
      explanation: 'Cilium requer kernel >= 4.19.57 como minimo. Kernel >= 5.10 e recomendado para suportar todos os recursos, incluindo kube-proxy replacement completo, bandwidth manager e host routing. Kernels mais novos (5.15+, 6.x) trazem melhorias adicionais de eBPF.',
      reference: 'Conceito relacionado: cilium-architecture — verifique a versao do kernel antes de instalar.'
    },
    {
      question: 'Qual modo de IPAM e o padrao do Cilium?',
      options: [
        'kubernetes — usa o IPAM nativo do Kubernetes',
        'cluster-pool — Cilium gerencia seu proprio pool de CIDRs, atribuindo sub-redes a cada node',
        'aws-eni — usa ENIs da AWS',
        'host-scope — usa o IP do host'
      ],
      correct: 1,
      explanation: 'cluster-pool e o modo padrao. Cilium define um CIDR grande (ex: 10.0.0.0/8) e atribui sub-redes (ex: /24) a cada node. Outros modos incluem kubernetes (usa node.spec.podCIDR), multi-pool (multiplos pools) e integracoes cloud (aws-eni, azure-ipam, gcp).',
      reference: 'Conceito relacionado: cilium-cluster-mesh — IPAM deve ser nao-sobreposto entre clusters.'
    },
    {
      question: 'O que o comando "cilium connectivity test" faz?',
      options: [
        'Testa conectividade com a internet',
        'Executa uma suite completa de testes de rede entre pods, services, network policies e conectividade externa para validar que o Cilium esta funcionando corretamente',
        'Verifica apenas se o DNS esta funcionando',
        'Testa a latencia entre nodes'
      ],
      correct: 1,
      explanation: 'cilium connectivity test cria pods de teste e executa uma suite abrangente: pod-to-pod, pod-to-service, pod-to-external, network policies, L7 policies e mais. E a forma oficial de validar que o Cilium esta instalado e configurado corretamente.',
      reference: 'Conceito relacionado: cilium-architecture — execute apos instalacao e apos qualquer mudanca.'
    }
  ],
  flashcards: [
    {
      front: 'O que e eBPF e por que Cilium o usa?',
      back: '**eBPF (extended Berkeley Packet Filter):**\n- Programas que rodam DENTRO do kernel\n- Sandbox seguro (verificador)\n- Sem modificar kernel/carregar modulos\n\n**Por que Cilium usa eBPF:**\n- Performance: O(1) vs O(n) iptables\n- Identity-based: policies por labels\n- Observabilidade: visibilidade L3-L7\n- Seguranca: policies no kernel\n\n**Pipeline:**\nC code → compilador → bytecode\n→ verificador → JIT → kernel\n\n**Analogia:**\neBPF : kernel :: JavaScript : browser\nRoda scripts sem modificar o host'
    },
    {
      front: 'Componentes da arquitetura Cilium?',
      back: '**Cilium Agent (DaemonSet):**\n- Roda em cada node\n- Gerencia eBPF programs\n- Gerencia endpoints e policies\n\n**Cilium Operator (Deployment):**\n- Gerencia CRDs e IPAM\n- Garbage collection\n- Singleton (1 replica)\n\n**Hubble (integrado ao Agent):**\n- Observabilidade de flows\n- Metricas de rede\n\n**Hubble Relay (Deployment):**\n- Agrega dados de todos agents\n- API centralizada\n\n**Hubble UI (Deployment):**\n- Interface grafica\n- Service map visual'
    },
    {
      front: 'Identity-Based Networking?',
      back: '**Modelo tradicional (iptables):**\n- Regras por IP:porta\n- IPs mudam → regras quebram\n- Milhares de regras = lento\n\n**Modelo Cilium (eBPF):**\n- Regras por IDENTIDADE\n- Identidade = labels do pod\n- ID numerico eficiente\n- Nao depende de IPs\n\n**Exemplo:**\n{app:frontend, env:prod}\n→ Identity ID: 12345\n→ Policies referenciam 12345\n→ Pod muda IP? Identity continua!\n\n**Comandos:**\n```\ncilium identity list\ncilium endpoint list\n```'
    },
    {
      front: 'Cilium vs kube-proxy?',
      back: '**kube-proxy (iptables):**\n- Regras lineares O(n)\n- Performance degrada com N services\n- Sem session affinity avancada\n- Sem visibilidade L7\n\n**Cilium (eBPF):**\n- Hash maps O(1) lookup\n- Performance constante\n- Maglev hashing (consistente)\n- DSR (Direct Server Return)\n- Socket-level LB\n\n**Habilitar:**\n```bash\nhelm install cilium cilium/cilium \\\n  --set kubeProxyReplacement=true\n```\n\n**Importante:**\nRemova kube-proxy DaemonSet\ne limpe iptables antigos!'
    },
    {
      front: 'IPAM modes no Cilium?',
      back: '**cluster-pool (padrao):**\n- Cilium gerencia pool de CIDRs\n- Ex: 10.0.0.0/8 → /24 por node\n- Mais simples e flexivel\n\n**kubernetes:**\n- Usa node.spec.podCIDR\n- Compativel com IPAM existente\n\n**multi-pool:**\n- Multiplos pools\n- Diferentes workloads\n\n**Cloud (aws/azure/gcp):**\n- Integracao nativa\n- ENIs, VPC routing\n\n**Configurar:**\n```\n--cluster-pool-ipv4-cidr=10.0.0.0/8\n--cluster-pool-ipv4-mask-size=24\n```'
    },
    {
      front: 'CRDs principais do Cilium?',
      back: '**Networking:**\n- CiliumNetworkPolicy\n  L3-L7 policies\n- CiliumClusterwideNetworkPolicy\n  Cluster-wide policies\n\n**Nodes & Endpoints:**\n- CiliumNode\n  Representa node\n- CiliumEndpoint\n  Representa pod/endpoint\n- CiliumIdentity\n  Identidade de seguranca\n\n**Advanced:**\n- CiliumExternalWorkload\n  Workloads externos\n- CiliumBGPPeeringPolicy\n  Configuracao BGP\n- CiliumLoadBalancerIPPool\n  Pool IPs LoadBalancer\n\n**Listar:**\n```bash\nkubectl api-resources | grep cilium\n```'
    },
    {
      front: 'Comandos essenciais do Cilium CLI?',
      back: '**Status:**\n```bash\ncilium status\ncilium status --verbose\n```\n\n**Endpoints:**\n```bash\ncilium endpoint list\ncilium endpoint get <id>\n```\n\n**Identidades:**\n```bash\ncilium identity list\n```\n\n**Conectividade:**\n```bash\ncilium connectivity test\n```\n\n**Monitor:**\n```bash\ncilium monitor\ncilium monitor --type policy-verdict\n```\n\n**BPF maps:**\n```bash\ncilium bpf lb list\ncilium bpf ct list global\ncilium bpf policy get <id>\n```'
    }
  ],
  lab: {
    scenario: 'Voce precisa instalar o Cilium como CNI em um cluster Kubernetes e validar que o networking esta funcionando corretamente.',
    objective: 'Instalar Cilium com Helm, habilitar Hubble, substituir kube-proxy e validar conectividade.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Instalar Cilium com Helm',
        instruction: `Instale o Cilium usando Helm com kube-proxy replacement e Hubble habilitado.

\`\`\`bash
# Adicionar repo Cilium
helm repo add cilium https://helm.cilium.io/
helm repo update

# Instalar Cilium
helm install cilium cilium/cilium \\
  --namespace kube-system \\
  --set kubeProxyReplacement=true \\
  --set hubble.enabled=true \\
  --set hubble.relay.enabled=true \\
  --set hubble.ui.enabled=true \\
  --set ipam.mode=cluster-pool \\
  --set ipam.operator.clusterPoolIPv4PodCIDRList="10.0.0.0/8" \\
  --set ipam.operator.clusterPoolIPv4MaskSize=24
\`\`\``,
        hints: [
          'kubeProxyReplacement=true desativa a necessidade do kube-proxy',
          'Hubble precisa de relay para agregar dados entre nodes',
          'IPAM cluster-pool e o modo padrao e mais flexivel'
        ],
        solution: `\`\`\`bash
helm repo add cilium https://helm.cilium.io/ && helm repo update
helm install cilium cilium/cilium --namespace kube-system \\
  --set kubeProxyReplacement=true \\
  --set hubble.enabled=true \\
  --set hubble.relay.enabled=true
\`\`\``,
        verify: `\`\`\`bash
# Verificar pods do Cilium
kubectl get pods -n kube-system -l app.kubernetes.io/part-of=cilium
# Saida esperada: cilium-xxxxx (Running em cada node), cilium-operator-xxxxx (Running)

# Verificar status
cilium status
# Saida esperada: OK em todos os componentes
\`\`\``
      },
      {
        title: 'Validar Endpoints e Identidades',
        instruction: `Verifique que os endpoints e identidades foram criados corretamente para os pods do cluster.

\`\`\`bash
# Listar endpoints gerenciados pelo Cilium
cilium endpoint list

# Listar identidades
cilium identity list

# Verificar um endpoint especifico
kubectl get ciliumendpoints -A

# Verificar nodes do Cilium
kubectl get ciliumnodes
\`\`\``,
        hints: [
          'Cada pod gerenciado pelo Cilium aparece como um endpoint',
          'Identidades sao compartilhadas entre pods com os mesmos labels',
          'CiliumNodes mostram a alocacao de IPAM por node'
        ],
        solution: `\`\`\`bash
cilium endpoint list
cilium identity list
kubectl get ciliumendpoints -A
kubectl get ciliumnodes -o wide
\`\`\``,
        verify: `\`\`\`bash
# Verificar que endpoints existem
cilium endpoint list | grep -c "ready"
# Saida esperada: numero > 0

# Verificar CiliumNodes
kubectl get ciliumnodes
# Saida esperada: um CiliumNode por node do cluster
\`\`\``
      },
      {
        title: 'Executar Connectivity Test',
        instruction: `Execute o teste de conectividade oficial do Cilium para validar o networking completo.

\`\`\`bash
# Executar suite completa de testes
cilium connectivity test

# Para testes rapidos (subset)
cilium connectivity test --test pod-to-pod
cilium connectivity test --test pod-to-service
\`\`\``,
        hints: [
          'O connectivity test cria pods temporarios no namespace cilium-test',
          'Testes incluem pod-to-pod, pod-to-service, network policies e L7',
          'Pode demorar varios minutos na primeira execucao'
        ],
        solution: `\`\`\`bash
cilium connectivity test --test pod-to-pod,pod-to-service
\`\`\``,
        verify: `\`\`\`bash
# O proprio connectivity test reporta pass/fail
# Saida esperada: All X tests (Y checks) successful

# Verificar BPF LB maps (kube-proxy replacement)
cilium bpf lb list | head -20
# Saida esperada: lista de Services mapeados em eBPF
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Cilium Agent em CrashLoopBackOff',
      difficulty: 'medium',
      symptom: 'O pod cilium-agent nao inicia e fica em CrashLoopBackOff. Nenhum pod consegue se comunicar.',
      diagnosis: `\`\`\`bash
# Verificar logs do agent
kubectl logs -n kube-system -l k8s-app=cilium --tail=50

# Verificar eventos
kubectl describe pod -n kube-system -l k8s-app=cilium

# Verificar versao do kernel
uname -r

# Verificar se outro CNI esta instalado
ls /etc/cni/net.d/
\`\`\``,
      solution: `**Causas comuns e solucoes:**

1. **Kernel muito antigo:** Cilium requer >= 4.19.57. Atualize o kernel.

2. **Conflito com outro CNI:** Remova configs do CNI anterior:
\`\`\`bash
rm /etc/cni/net.d/10-flannel.conflist  # exemplo
rm /etc/cni/net.d/calico-*
\`\`\`

3. **Falta de memoria:** Aumente resources do DaemonSet:
\`\`\`bash
helm upgrade cilium cilium/cilium --set resources.requests.memory=256Mi
\`\`\`

4. **BPFFS nao montado:**
\`\`\`bash
mount -t bpf bpf /sys/fs/bpf
\`\`\``
    },
    {
      title: 'Services nao resolvem apos kube-proxy replacement',
      difficulty: 'hard',
      symptom: 'Apos habilitar kubeProxyReplacement, Services ClusterIP nao sao acessiveis. Pods nao conseguem acessar Services.',
      diagnosis: `\`\`\`bash
# Verificar se kube-proxy foi realmente desativado
kubectl get ds kube-proxy -n kube-system

# Verificar eBPF LB maps
cilium bpf lb list

# Verificar se regras iptables antigas existem
iptables -t nat -L KUBE-SERVICES | head -20

# Verificar status do kube-proxy replacement
cilium status | grep KubeProxyReplacement
\`\`\``,
      solution: `**Solucoes:**

1. **Limpar regras iptables do kube-proxy:**
\`\`\`bash
# Deletar kube-proxy
kubectl delete ds kube-proxy -n kube-system

# Limpar regras iptables em CADA node
iptables -F -t nat
iptables -F -t filter
iptables -F -t mangle
\`\`\`

2. **Verificar configuracao do Cilium:**
\`\`\`bash
cilium config view | grep kube-proxy
# Deve mostrar: kube-proxy-replacement: true
\`\`\`

3. **Reiniciar Cilium agents:**
\`\`\`bash
kubectl rollout restart ds/cilium -n kube-system
\`\`\`

4. **Verificar eBPF maps carregados:**
\`\`\`bash
cilium bpf lb list
# Deve listar todos os Services do cluster
\`\`\``
    },
    {
      title: 'Connectivity test falha em testes especificos',
      difficulty: 'easy',
      symptom: 'cilium connectivity test falha em alguns testes, especialmente pod-to-external ou testes de network policy.',
      diagnosis: `\`\`\`bash
# Executar teste com verbose
cilium connectivity test --test pod-to-external -v

# Verificar firewall do node
iptables -L INPUT -n | head -20

# Verificar DNS
kubectl exec -n cilium-test client -- nslookup kubernetes.default

# Verificar portas Cilium
ss -tlnp | grep -E "4240|4244|8472"
\`\`\``,
      solution: `**Solucoes por tipo de falha:**

1. **pod-to-external falha:** Firewall bloqueando trafego de saida. Abra a porta necessaria ou configure masquerade:
\`\`\`bash
helm upgrade cilium cilium/cilium --set enableIPv4Masquerade=true
\`\`\`

2. **Portas Cilium bloqueadas:** Abra as portas necessarias:
   - 8472/UDP: VXLAN overlay
   - 4240/TCP: Health check
   - 4244/TCP: Hubble Relay

3. **DNS falha:** Verifique CoreDNS esta rodando:
\`\`\`bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
\`\`\`

4. **Network policy tests:** Verifique CiliumNetworkPolicies existentes que podem bloquear:
\`\`\`bash
kubectl get cnp,ccnp -A
\`\`\``
    }
  ]
};
