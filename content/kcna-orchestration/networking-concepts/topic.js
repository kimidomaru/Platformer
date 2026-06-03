window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcna-orchestration/networking-concepts'] = {

  theory: `# Kubernetes Networking & Service Mesh

## Relevancia no KCNA
> O dominio "Container Orchestration" vale **22%** do KCNA. Networking e fundamental — entenda o modelo de rede, CNI plugins, DNS e conceitos de Service Mesh.

---

## Modelo de Rede do Kubernetes

Regras fundamentais:
1. **Todo Pod recebe um IP unico** no cluster
2. **Pods podem comunicar sem NAT** (diretamente por IP)
3. **Agents em nodes podem comunicar com todos os pods**
4. **Pods em um node veem o mesmo IP que pods em outros nodes veem**

---

## CNI (Container Network Interface)

CNI e o padrao para plugins de rede no Kubernetes:

| Plugin | Tipo | Destaque |
|--------|------|----------|
| **Calico** | L3 (BGP) | NetworkPolicies, popular, performante |
| **Cilium** | eBPF | Observabilidade, seguranca, alta performance |
| **Flannel** | Overlay (VXLAN) | Simples, sem NetworkPolicy nativo |
| **Weave Net** | Overlay (mesh) | Facil de configurar, mesh P2P |
| **Canal** | Flannel + Calico | Flannel para rede + Calico para policies |

---

## kube-proxy

Implementa Services distribuindo trafego para os Pods:

| Modo | Descricao |
|------|-----------|
| **iptables** | Regras iptables para cada Service (padrao) |
| **IPVS** | IP Virtual Server, melhor para clusters grandes |
| **nftables** | Novo, baseado em nftables (K8s 1.29+) |

---

## DNS no Kubernetes (CoreDNS)

\`\`\`text
<service>.<namespace>.svc.cluster.local
  nginx.default.svc.cluster.local
  api.production.svc.cluster.local
\`\`\`

- **CoreDNS** resolve nomes de Services e Pods
- Services: \`<svc>.<ns>.svc.cluster.local\`
- Pods: \`<pod-ip-dashed>.<ns>.pod.cluster.local\`
- Headless Services: retornam IPs dos Pods diretamente

---

## Network Policies

Controlam trafego entre Pods (L3/L4):

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - port: 8080
\`\`\`

**Sem NetworkPolicy**: todo trafego e permitido (default allow).

---

## Service Mesh

Um Service Mesh adiciona funcionalidades de rede sem modificar a aplicacao:

### Sidecar Pattern

\`\`\`text
Pod:
  +-------------------+
  | App Container     |
  | (sua aplicacao)   |
  +-------------------+
  | Sidecar Proxy     |
  | (Envoy/Linkerd)   |
  +-------------------+
\`\`\`

O sidecar proxy intercepta todo trafego de entrada e saida.

### Funcionalidades

| Feature | Descricao |
|---------|-----------|
| **mTLS** | Encriptacao automatica entre servicos |
| **Traffic Management** | Canary, blue-green, circuit breaker |
| **Observability** | Metricas, traces, logs automaticos |
| **Retries/Timeouts** | Resiliencia automatica |
| **Rate Limiting** | Controle de taxa de requests |

### Service Meshes Populares

| Mesh | Proxy | Destaque |
|------|-------|----------|
| **Istio** | Envoy | Mais completo, mais complexo |
| **Linkerd** | linkerd2-proxy | Leve, CNCF graduated |
| **Cilium SM** | eBPF (sem sidecar) | Alto desempenho, kernel-level |

### Envoy Proxy

Envoy e um proxy L7 open-source (CNCF graduated):
- Usado por Istio como sidecar
- Load balancing avancado
- Observabilidade integrada
- Suporte a gRPC, HTTP/2, WebSocket
`,

  quiz: [
    {
      question: 'Qual regra fundamental do modelo de rede do Kubernetes?',
      options: ['Pods precisam de NAT para comunicar', 'Todo Pod recebe um IP unico e pode comunicar com qualquer outro Pod sem NAT', 'Pods compartilham IP com o node', 'Pods so comunicam via Services'],
      correct: 1,
      explanation: 'No modelo de rede K8s, cada Pod recebe um IP unico e pode comunicar diretamente com qualquer outro Pod no cluster sem necessidade de NAT.',
      reference: 'Conceito relacionado: K8s networking model — flat network.'
    },
    {
      question: 'O que CNI significa e qual sua funcao?',
      options: ['Container Name Interface', 'Container Network Interface — padrao para plugins de rede', 'Cluster Node Inspector', 'Container Namespace Isolation'],
      correct: 1,
      explanation: 'CNI (Container Network Interface) define a interface padrao entre o container runtime e plugins de rede. Plugins como Calico, Cilium e Flannel implementam essa interface.',
      reference: 'Conceito relacionado: CNI — plugins de rede.'
    },
    {
      question: 'Qual CNI plugin usa eBPF para alta performance e observabilidade?',
      options: ['Calico', 'Flannel', 'Cilium', 'Weave Net'],
      correct: 2,
      explanation: 'Cilium usa eBPF (extended Berkeley Packet Filter) no kernel para networking de alta performance, observabilidade e seguranca, sem overhead de iptables.',
      reference: 'Conceito relacionado: Cilium — eBPF networking.'
    },
    {
      question: 'Qual componente resolve nomes DNS dentro do cluster Kubernetes?',
      options: ['kube-proxy', 'CoreDNS', 'kube-dns', 'kubelet'],
      correct: 1,
      explanation: 'CoreDNS e o servidor DNS padrao do Kubernetes. Resolve nomes de Services (svc.cluster.local) e Pods para seus IPs.',
      reference: 'Conceito relacionado: CoreDNS — resolucao de nomes.'
    },
    {
      question: 'O que um Service Mesh faz?',
      options: ['Gerencia imagens de container', 'Adiciona funcionalidades de rede (mTLS, traffic management, observability) via sidecar proxy', 'Substitui o CNI plugin', 'Gerencia DNS'],
      correct: 1,
      explanation: 'Service Mesh injeta sidecar proxies nos pods para fornecer mTLS, traffic management, observabilidade e resiliencia automaticamente, sem modificar a aplicacao.',
      reference: 'Conceito relacionado: Service Mesh — padrao sidecar.'
    },
    {
      question: 'Qual e o comportamento padrao de NetworkPolicies quando nenhuma e criada?',
      options: ['Todo trafego e bloqueado', 'Todo trafego e permitido (default allow)', 'Apenas trafego interno e permitido', 'Depende do CNI'],
      correct: 1,
      explanation: 'Sem NetworkPolicies, todo trafego entre pods e permitido (default allow). NetworkPolicies adicionam regras de firewall para restringir trafego.',
      reference: 'Conceito relacionado: NetworkPolicy — default behavior.'
    },
    {
      question: 'Qual Service Mesh e CNCF graduated e conhecido por ser leve?',
      options: ['Istio', 'Linkerd', 'Consul Connect', 'Envoy'],
      correct: 1,
      explanation: 'Linkerd e CNCF graduated, projetado para ser leve e simples. Usa linkerd2-proxy (Rust) em vez do Envoy, sendo mais leve que o Istio.',
      reference: 'Conceito relacionado: Linkerd vs Istio.'
    }
  ],

  flashcards: [
    { front: 'Quais sao as regras do modelo de rede K8s?', back: 'Todo pod tem IP unico, pods comunicam sem NAT, agents podem comunicar com todos os pods, IPs sao consistentes de qualquer perspectiva no cluster.' },
    { front: 'Quais sao os principais CNI plugins?', back: 'Calico (L3/BGP, NetworkPolicies), Cilium (eBPF, observabilidade), Flannel (overlay simples, sem policies), Weave Net (mesh P2P), Canal (Flannel+Calico).' },
    { front: 'O que e kube-proxy?', back: 'Componente que implementa Services no K8s. Modos: iptables (padrao, regras por Service), IPVS (melhor para clusters grandes), nftables (K8s 1.29+).' },
    { front: 'Como funciona DNS no K8s?', back: 'CoreDNS resolve: Services como <svc>.<ns>.svc.cluster.local, Pods como <ip>.<ns>.pod.cluster.local. Headless Services retornam IPs dos Pods diretamente.' },
    { front: 'O que e o padrao Sidecar?', back: 'Container auxiliar injetado no Pod que intercepta todo trafego de rede. Usado por Service Meshes (Istio/Envoy, Linkerd) para mTLS, observabilidade e traffic management.' },
    { front: 'Quais funcionalidades um Service Mesh fornece?', back: 'mTLS (encriptacao entre servicos), traffic management (canary, circuit breaker), observabilidade (metricas, traces), retries/timeouts, rate limiting.' },
    { front: 'Istio vs Linkerd vs Cilium SM?', back: 'Istio: mais completo/complexo, usa Envoy. Linkerd: leve, CNCF graduated, proxy Rust. Cilium: eBPF (sem sidecar), alta performance, kernel-level.' }
  ],

  lab: {
    scenario: 'Voce esta explorando os conceitos de rede do Kubernetes e como servicos se comunicam.',
    objective: 'Entender DNS, Services e comunicacao entre pods no Kubernetes.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Explorar DNS do Cluster',
        instruction: 'Crie dois pods em namespaces diferentes e teste a resolucao DNS entre eles.',
        hints: ['Crie Service para um pod', 'Use nslookup ou dig de outro pod', 'Use o FQDN: svc.namespace.svc.cluster.local'],
        solution: '```bash\n# Criar pods e Services\nkubectl create deployment dns-server --image=nginx:1.25-alpine\nkubectl expose deployment dns-server --port=80\n\n# Testar DNS de outro pod\nkubectl run dns-test --image=busybox --rm -it --restart=Never -- nslookup dns-server.default.svc.cluster.local\n```',
        verify: '```bash\nkubectl get svc dns-server\n# Saida esperada: dns-server ClusterIP com IP\n\nkubectl run dns-check --image=busybox --rm -it --restart=Never -- nslookup dns-server\n# Saida esperada: Name/Address resolvidos\n```'
      },
      {
        title: 'Verificar CNI e kube-proxy',
        instruction: 'Identifique qual CNI plugin e modo do kube-proxy estao configurados no cluster.',
        hints: ['Verifique pods no kube-system', 'Procure por calico, cilium, flannel', 'Verifique configmap do kube-proxy'],
        solution: '```bash\n# Identificar CNI\nkubectl get pods -n kube-system | grep -E \"calico|cilium|flannel|weave\"\n\n# Ver config do kube-proxy\nkubectl get configmap kube-proxy -n kube-system -o yaml | grep mode\n\n# Ver detalhes do CNI no node\nkubectl describe node | grep -i -A 3 \"container runtime\\|network\"\n```',
        verify: '```bash\nkubectl get pods -n kube-system | grep -E \"calico|cilium|flannel|weave|kube-proxy\" | head -5\n# Saida esperada: pods do CNI e kube-proxy rodando\n```'
      },
      {
        title: 'Testar Comunicacao Pod-to-Pod',
        instruction: 'Verifique que pods podem comunicar diretamente por IP sem NAT.',
        hints: ['Obtenha IP de um pod com -o wide', 'Use curl ou wget de outro pod', 'Teste entre namespaces diferentes'],
        solution: '```bash\n# Obter IP do pod\nPOD_IP=$(kubectl get pods -l app=dns-server -o jsonpath=\"{.items[0].status.podIP}\")\n\n# Testar comunicacao direta\nkubectl run connectivity-test --image=curlimages/curl --rm -it --restart=Never -- curl -s $POD_IP\n```',
        verify: '```bash\nPOD_IP=$(kubectl get pods -l app=dns-server -o jsonpath=\"{.items[0].status.podIP}\")\necho \"Pod IP: $POD_IP\"\n# Saida esperada: IP valido do pod\n\nkubectl run curl-test --image=curlimages/curl --rm -it --restart=Never -- curl -s --max-time 3 $POD_IP | head -3\n# Saida esperada: HTML do nginx\n```'
      }
    ]
  },

  troubleshooting: []
};
