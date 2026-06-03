window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcsa-cluster-security/k8s-networking-security'] = {

  theory: `# Kubernetes Networking Security

## Relevancia no KCSA
> O dominio "Kubernetes Cluster Component Security" vale **22%** do KCSA. Seguranca de rede no Kubernetes cobre Network Policies, CNI security, mTLS e Ingress. Conceitos testados no exame teorico.

---

## Modelo de Rede do Kubernetes

O Kubernetes implementa um **flat network model**:
- Todo Pod recebe um IP unico no cluster
- Pods podem comunicar diretamente entre si (sem NAT)
- **Por padrao: todo trafego e permitido** (default allow)

Este modelo facilita a comunicacao, mas requer controles ativos para seguranca.

---

## Network Policies

Network Policies sao o mecanismo nativo de **microsegmentacao** do Kubernetes.

### Conceitos Fundamentais

\`\`\`text
Sem NetworkPolicy:
  Pod A --> Pod B (qualquer namespace): PERMITIDO
  Pod A --> Pod C (qualquer namespace): PERMITIDO

Com NetworkPolicy (default deny):
  Pod A --> Pod B: BLOQUEADO (exceto se permitido explicitamente)
  Pod A --> Pod C: BLOQUEADO (exceto se permitido explicitamente)
\`\`\`

### Tipos de Policy

| Tipo | Controla | Direcao |
|------|----------|---------|
| **Ingress** | Trafego ENTRANDO no pod | -> Pod |
| **Egress** | Trafego SAINDO do pod | Pod -> |

### Default Deny — Padrao de Seguranca

\`\`\`yaml
# Bloquear TODO trafego de entrada em um namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}       # Aplica a TODOS os pods
  policyTypes:
  - Ingress             # Sem regras = bloquear tudo
\`\`\`

\`\`\`yaml
# Bloquear TODO trafego (ingress + egress)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
\`\`\`

### Permitir Seletivamente

\`\`\`yaml
# Apenas o frontend pode acessar o backend na porta 8080
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:         # APENAS pods com esse label
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
\`\`\`

### Selectors: AND vs OR

**Importante — PEGADINHA NO KCSA:**

\`\`\`yaml
# AND: Pod deve ter AMBOS os labels E estar no namespace
- from:
  - podSelector:
      matchLabels:
        role: frontend
    namespaceSelector:    # na mesma entrada = AND
      matchLabels:
        env: production

# OR: Pod com o label OU pod no namespace
- from:
  - podSelector:           # entrada separada = OR
      matchLabels:
        role: frontend
  - namespaceSelector:     # entrada separada = OR
      matchLabels:
        env: production
\`\`\`

---

## CNI Security

O **Container Network Interface (CNI)** plugin influencia diretamente a seguranca de rede:

| CNI Plugin | Suporta NetworkPolicy | Feature de Seguranca |
|------------|----------------------|---------------------|
| **Calico** | ✅ (nativo) | GlobalNetworkPolicy, L7 policy com Envoy |
| **Cilium** | ✅ (nativo + extensoes) | L7 policies, eBPF, mTLS, Hubble (observabilidade) |
| **Flannel** | ❌ | Apenas rede basica, sem Network Policies |
| **Weave** | ✅ | Network Policies basicas |
| **Canal** | ✅ (via Calico) | Flannel para rede + Calico para policies |

> **Importante:** Se o CNI nao suporta Network Policies (ex: Flannel), os objetos NetworkPolicy sao criados mas **ignorados**. Verificar o CNI e critico.

### Cilium — Seguranca Avancada

Cilium usa **eBPF** para policies mais granulares:

\`\`\`yaml
# Cilium: policy L7 (HTTP)
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
spec:
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
        - method: GET     # Apenas GET, nao POST/DELETE
          path: /api/.*
\`\`\`

---

## mTLS e Service Mesh

**mTLS (mutual TLS)** encripta e autentica a comunicacao entre pods:

\`\`\`text
Sem mTLS:
  Pod A --> HTTP plaintext --> Pod B
  (qualquer um pode interceptar/ler)

Com mTLS (service mesh):
  Pod A --> TLS (cert A) --> Verificar cert B --> Dados encriptados --> Pod B
  (autenticacao mutua + encriptacao)
\`\`\`

### Service Meshes que implementam mTLS

| Mesh | Abordagem | Automatico |
|------|-----------|------------|
| **Istio** | Sidecar Envoy | Sim (com annotations) |
| **Linkerd** | Sidecar linkerd-proxy | Sim (automatico no namespace) |
| **Cilium** | eBPF (sem sidecar) | Sim (transparent mode) |
| **Consul Connect** | Sidecar Envoy | Sim |

### mTLS vs NetworkPolicy

| Aspecto | NetworkPolicy | mTLS |
|---------|--------------|------|
| Camada | L3/L4 (IP/porta) | L7 (aplicacao) |
| Encriptacao | Nao | Sim |
| Autenticacao | Por IP/namespace | Por certificado/identidade |
| Dependencia | CNI | Service Mesh |
| Overhead | Baixo | Moderado (sidecar) |

---

## Ingress Security

O Ingress e a porta de entrada do trafego externo para o cluster.

### TLS no Ingress

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secure-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - api.example.com
    secretName: tls-secret    # Secret com cert + key
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80
\`\`\`

### Boas Praticas de Ingress Security

- **TLS obrigatorio** — redirect HTTP para HTTPS
- **HSTS** (HTTP Strict Transport Security)
- **WAF** (Web Application Firewall) — Modsecurity, AWS WAF
- **Rate limiting** — prevenir DDoS e brute force
- **Autenticacao** no Ingress (OAuth2 proxy, basic auth)

---

## DNS Security (CoreDNS)

**CoreDNS** resolve nomes de Services e Pods:

\`\`\`bash
# Formato de resolucao DNS
<service>.<namespace>.svc.cluster.local
<pod-ip-dashed>.<namespace>.pod.cluster.local
\`\`\`

### Riscos de DNS

| Risco | Descricao | Mitigacao |
|-------|-----------|-----------|
| **DNS Spoofing** | Pod malicioso respondendo queries | DNSSEC, mTLS |
| **DNS Exfiltration** | Dados enviados via DNS queries | Egress NetworkPolicy para porta 53 |
| **CoreDNS Misconfiguration** | Permitir DNS para dominios externos indesejados | Corefile restritivo |

---

## ExternalIP Hijacking

Um usuario com permissao de criar Services pode usar **ExternalIPs** para interceptar trafego destinado a IPs do cluster:

\`\`\`yaml
# Service com ExternalIP malicioso
kind: Service
spec:
  externalIPs:
  - 192.168.1.100   # Captura trafego para este IP
\`\`\`

**Mitigacao:** Admission controller \`DenyServiceExternalIPs\` ou politica Kyverno/OPA.

---

## Erros Comuns no KCSA

1. **Achar que Network Policies funcionam sem o CNI suportar** — Flannel ignora NetworkPolicies
2. **Confundir AND vs OR nos selectors** — pegadinha classica em exames
3. **Esquecer que default e allow-all** — sem NetworkPolicy, todo trafego e liberado
4. **mTLS nao substitui NetworkPolicy** — sao complementares (L4 vs L7)
5. **Ingress sem TLS** — HTTP em producao expoe dados em plaintext
`,

  quiz: [
    {
      question: 'Qual e o comportamento padrao do Kubernetes quando nenhuma NetworkPolicy existe em um namespace?',
      options: ['Todo trafego e bloqueado por padrao', 'Todo trafego e permitido por padrao (default allow)', 'Apenas trafego interno ao namespace e permitido', 'Apenas trafego do kube-system e permitido'],
      correct: 1,
      explanation: 'Sem NetworkPolicies, o Kubernetes usa default allow: todo trafego entre pods e permitido. NetworkPolicies devem ser criadas explicitamente para restringir o trafego, implementando default deny.',
      reference: 'Default: todo trafego permitido. NetworkPolicy adiciona restricoes. Implementar default-deny-ingress em todos os namespaces de producao.'
    },
    {
      question: 'Qual CNI plugin NAO suporta Network Policies nativamente?',
      options: ['Calico', 'Cilium', 'Flannel', 'Weave'],
      correct: 2,
      explanation: 'Flannel nao suporta Network Policies. Os objetos NetworkPolicy sao criados mas completamente ignorados. Para usar NetworkPolicies com Flannel, instalar Calico apenas para policies (Canal = Flannel + Calico).',
      reference: 'CNI + NetworkPolicy: Calico (sim), Cilium (sim), Flannel (NAO), Weave (sim). Verificar CNI antes de aplicar policies de seguranca.'
    },
    {
      question: 'Como NAO deve ser interpretada a seguinte NetworkPolicy — dois selectors na mesma entrada "from" com podSelector E namespaceSelector?',
      options: ['OR: pod com o label OU no namespace especificado', 'AND: pod deve ter o label E estar no namespace especificado', 'Qualquer pod em qualquer namespace', 'Apenas pods do kube-system'],
      correct: 1,
      explanation: 'Quando podSelector e namespaceSelector estao na MESMA entrada (mesmo item do array "from"), funciona como AND — o pod deve satisfazer AMBAS as condicoes. Se estiverem em entradas SEPARADAS, funciona como OR.',
      reference: 'NetworkPolicy AND vs OR: mesma entrada = AND. Entradas separadas = OR. Pegadinha classica no KCSA.'
    },
    {
      question: 'Qual a principal diferenca entre NetworkPolicy e mTLS (service mesh)?',
      options: ['NetworkPolicy e mais lento', 'NetworkPolicy opera em L3/L4 (IP/porta), mTLS opera em L7 com encriptacao e autenticacao por certificado', 'mTLS e gratis, NetworkPolicy requer licenca', 'Sao identicos em funcionalidade'],
      correct: 1,
      explanation: 'NetworkPolicy: firewall L3/L4 (IP, protocolo, porta), sem encriptacao. mTLS: autentica e encripta comunicacao entre pods via certificados no nivel L7. Sao complementares: NetworkPolicy + mTLS = controle granular + encriptacao.',
      reference: 'NetworkPolicy = L3/L4, sem crypto. mTLS = L7, autenticacao + encriptacao. Istio/Linkerd/Cilium implementam mTLS automaticamente.'
    },
    {
      question: 'O que o admission controller DenyServiceExternalIPs previne?',
      options: ['Services de usar ClusterIP', 'Usuarios de criar Services com ExternalIPs que podem ser usados para interceptar trafego de rede', 'NodePort de expor portas acima de 30000', 'LoadBalancer de criar IPs externos'],
      correct: 1,
      explanation: 'ExternalIPs em Services permitem capturar trafego destinado a IPs especificos do cluster. Um atacante com permissao de criar Services pode usar isso para interceptar trafego. DenyServiceExternalIPs bloqueia este campo.',
      reference: 'ExternalIP hijacking: Service.spec.externalIPs captura trafego. Mitigar: DenyServiceExternalIPs admission controller ou Kyverno/OPA policy.'
    },
    {
      question: 'Por que Cilium e considerado superior ao Calico para seguranca de rede?',
      options: ['Cilium e mais antigo e maduro', 'Cilium usa eBPF permitindo policies L7 (HTTP method, path), observabilidade nativa (Hubble) e mTLS sem sidecar', 'Cilium suporta mais protocolos de rede', 'Cilium e o unico que suporta NetworkPolicy'],
      correct: 1,
      explanation: 'Cilium usa eBPF no kernel para implementar policies L7 (ex: permitir GET mas bloquear DELETE), observabilidade via Hubble e mTLS sem sidecar. Calico e excelente para L3/L4 mas nao tem capabilities L7 nativas.',
      reference: 'Cilium: eBPF, L7 policies, Hubble observability, mTLS sem sidecar. Calico: L3/L4 BGP, GlobalNetworkPolicy. Ambos sao CNCF.'
    },
    {
      question: 'Como encriptar a comunicacao entre pods sem modificar o codigo da aplicacao?',
      options: ['Usando apenas NetworkPolicies', 'Usando um Service Mesh (Istio, Linkerd, Cilium) que injeta mTLS automaticamente', 'Configurando TLS em cada container manualmente', 'Usando Secrets do Kubernetes'],
      correct: 1,
      explanation: 'Service Meshes injetam sidecar proxies (ou usam eBPF) que implementam mTLS automaticamente em todas as comunicacoes, sem alterar o codigo da aplicacao. Istio e Linkerd usam sidecars, Cilium usa eBPF.',
      reference: 'mTLS transparente: Istio (Envoy sidecar), Linkerd (linkerd-proxy sidecar), Cilium (eBPF, sem sidecar). Zero mudanca no codigo da aplicacao.'
    }
  ],

  flashcards: [
    { front: 'Qual e o comportamento default de rede no K8s?', back: 'Default allow: todo trafego entre pods e permitido. NetworkPolicy adiciona restricoes. Implementar default-deny-ingress/egress em namespaces de producao e best practice de seguranca.' },
    { front: 'AND vs OR em NetworkPolicy selectors?', back: 'MESMA entrada (mesmo item em "from"): AND - pod deve satisfazer AMBAS as condicoes (podSelector E namespaceSelector). ENTRADAS SEPARADAS (itens diferentes em "from"): OR - satisfazer UMA das condicoes.' },
    { front: 'Quais CNI plugins suportam NetworkPolicy?', back: 'Suportam: Calico, Cilium, Weave, Canal (Flannel+Calico). NAO suportam: Flannel (sozinho). Importante: se CNI nao suporta, NetworkPolicy e criada mas ignorada silenciosamente.' },
    { front: 'NetworkPolicy vs mTLS: qual usar?', back: 'Ambos! NetworkPolicy = L3/L4 firewall (IP, porta, protocolo). mTLS = L7 autenticacao + encriptacao por certificado. Sao complementares. NetworkPolicy restringe conexoes, mTLS encripta e autentica.' },
    { front: 'O que e default-deny e por que usar?', back: 'NetworkPolicy com podSelector: {} sem regras de ingress/egress bloqueia todo trafego para todos os pods do namespace. Best practice: criar em todo namespace de producao, depois adicionar policies permissivas apenas para o necessario.' },
    { front: 'Quais as ameacas de DNS no Kubernetes?', back: 'DNS Spoofing: pod malicioso respondendo queries. DNS Exfiltration: dados via DNS queries (egress policy na porta 53). CoreDNS misconfiguration: resolver dominios externos indesejados. Monitorar com Hubble/Falco.' },
    { front: 'Por que o Ingress precisa de TLS?', back: 'Sem TLS, dados entre usuario e cluster trafegam em plaintext (HTTP). Configurar: secretName com cert+key, ssl-redirect annotation para forcar HTTPS, HSTS para prevenir downgrade. cert-manager automatiza certificados.' },
    { front: 'O que o Cilium Hubble oferece?', back: 'Hubble e a plataforma de observabilidade de rede do Cilium: visualizacao de fluxos L3/L4/L7, deteccao de politicas, monitoramento de service mesh, metricas de rede. Alimentado por eBPF sem overhead de sidecar.' }
  ],

  lab: {
    scenario: 'Voce e um Security Engineer implementando microsegmentacao em um cluster Kubernetes. Precisa aplicar default-deny e criar policies permissivas seletivas.',
    objective: 'Implementar Network Policies de seguranca: default-deny, permissoes seletivas e verificar o CNI.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Verificar CNI e suporte a NetworkPolicy',
        instruction: 'Identifique qual CNI plugin esta em uso e confirme que suporta Network Policies.',
        hints: ['CNI pods ficam no kube-system', 'Procure por calico, cilium, flannel, weave'],
        solution: '```bash\n# Identificar CNI pelo nome dos pods\nkubectl get pods -n kube-system | grep -E "calico|cilium|flannel|weave|canal|kindnet|aws-node"\n\n# Ver DaemonSets de rede\nkubectl get daemonsets -n kube-system\n\n# Criar NetworkPolicy de teste e verificar se e respeitada\nkubectl create namespace np-test\nkubectl run test-pod --image=nginx -n np-test\nkubectl run client --image=alpine -n np-test -- sleep 3600\n\n# Testar conectividade antes de qualquer policy\nPOD_IP=$(kubectl get pod test-pod -n np-test -o jsonpath=\'{.status.podIP}\')\nkubectl exec -n np-test client -- wget -qO- --timeout=3 http://$POD_IP 2>&1\n```',
        verify: '```bash\nkubectl get pods -n kube-system | grep -E "calico|cilium|flannel|weave|canal|kindnet" | head -3\n# Saida esperada: pods do CNI em Running\n```'
      },
      {
        title: 'Aplicar Default-Deny e verificar bloqueio',
        instruction: 'Crie uma NetworkPolicy de default-deny no namespace de teste e confirme que o trafego e bloqueado.',
        hints: ['podSelector: {} aplica a todos os pods', 'Sem regras ingress = bloquear tudo'],
        solution: '```bash\n# Aplicar default-deny\nkubectl apply -f - <<EOF\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: default-deny-ingress\n  namespace: np-test\nspec:\n  podSelector: {}\n  policyTypes:\n  - Ingress\nEOF\n\n# Aguardar policy ser aplicada\nsleep 2\n\n# Testar que trafego foi bloqueado\nPOD_IP=$(kubectl get pod test-pod -n np-test -o jsonpath=\'{.status.podIP}\')\nkubectl exec -n np-test client -- wget -qO- --timeout=3 http://$POD_IP 2>&1\n# Deve falhar com timeout (trafego bloqueado)\n\n# Ver NetworkPolicies ativas\nkubectl get networkpolicies -n np-test\n```',
        verify: '```bash\nkubectl get networkpolicies -n np-test\n# Saida esperada: default-deny-ingress listada\n\n# Trafego deve estar bloqueado\nPOD_IP=$(kubectl get pod test-pod -n np-test -o jsonpath=\'{.status.podIP}\')\nkubectl exec -n np-test client -- wget -qO- --timeout=2 http://$POD_IP 2>&1 | grep -c "timed out\\|Connection refused"\n# Saida esperada: 1 (bloqueado)\n```'
      },
      {
        title: 'Criar policy permissiva seletiva',
        instruction: 'Adicione uma NetworkPolicy que permite apenas que o pod "client" acesse o pod "test-pod" na porta 80.',
        hints: ['Use podSelector com matchLabels do client', 'Use ports para restringir a porta 80'],
        solution: '```bash\n# Ver labels dos pods\nkubectl get pods -n np-test --show-labels\n\n# Criar policy permissiva seletiva\nkubectl apply -f - <<EOF\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-client-to-nginx\n  namespace: np-test\nspec:\n  podSelector:\n    matchLabels:\n      run: test-pod\n  policyTypes:\n  - Ingress\n  ingress:\n  - from:\n    - podSelector:\n        matchLabels:\n          run: client\n    ports:\n    - protocol: TCP\n      port: 80\nEOF\n\n# Testar que client pode acessar test-pod\nPOD_IP=$(kubectl get pod test-pod -n np-test -o jsonpath=\'{.status.podIP}\')\nkubectl exec -n np-test client -- wget -qO- --timeout=5 http://$POD_IP 2>&1 | head -5\n\n# Limpar\nkubectl delete namespace np-test\n```',
        verify: '```bash\nkubectl get networkpolicies -n np-test\n# Saida esperada: 2 policies (default-deny + allow-client)\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'NetworkPolicy criada mas trafego ainda permitido',
      difficulty: 'easy',
      symptom: 'Uma NetworkPolicy de default-deny foi aplicada ao namespace "production", mas pods ainda conseguem se comunicar livremente com outros pods do cluster.',
      diagnosis: '**1. Verificar se a NetworkPolicy foi criada:**\n```bash\nkubectl get networkpolicies -n production\n```\n\n**2. Verificar qual CNI esta em uso:**\n```bash\nkubectl get pods -n kube-system | grep -E "calico|cilium|flannel|weave|canal"\n```\n\n**3. Se o CNI e Flannel:**\n```bash\n# Flannel NAO suporta NetworkPolicies\n# A policy e criada mas completamente ignorada\nkubectl describe networkpolicy default-deny-ingress -n production\n# Policy existe mas nao tem efeito\n```\n\n**4. Verificar se a policy esta selecionando os pods corretos:**\n```bash\nkubectl describe networkpolicy default-deny-ingress -n production | grep "Pod Selector"\n```',
      solution: '**Causa: CNI nao suporta NetworkPolicy (ex: Flannel).**\n\n**Opcao 1: Instalar Calico apenas para policies (Canal):**\n```bash\n# Canal = Flannel para rede + Calico para policies\n# Instalar projeto Canal separadamente\nkubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.26.0/manifests/canal.yaml\n```\n\n**Opcao 2: Migrar para Calico ou Cilium como CNI:**\n```bash\n# Remover Flannel e instalar Calico (requer reinicio dos nodes)\n# Processo complexo, planejar com antecedencia\n```\n\n**Verificar apos correcao:**\n```bash\n# Com CNI que suporta policies, testar novamente\nkubectl run test-pod --image=nginx -n production\nkubectl run client --image=alpine -- sleep 3600\nPOD_IP=$(kubectl get pod test-pod -n production -o jsonpath=\'{.status.podIP}\')\nkubectl exec client -- wget -qO- --timeout=3 http://$POD_IP\n# Com Calico/Cilium: deve falhar (bloqueado pela default-deny)\n# Com Flannel: funciona (policy ignorada) - confirma o problema\n```'
    },
    {
      title: 'Pod nao consegue resolver nomes DNS do cluster',
      difficulty: 'medium',
      symptom: 'Apos aplicar NetworkPolicies de default-deny egress em um namespace, pods nao conseguem mais resolver nomes de Services (nslookup retorna SERVFAIL).',
      diagnosis: '**1. Testar resolucao DNS:**\n```bash\nkubectl run dns-test --image=busybox --rm -it --restart=Never -- nslookup kubernetes.default\n# Deve retornar o IP do Service kubernetes\n```\n\n**2. Verificar se e problema de DNS ou conectividade:**\n```bash\n# Testar com IP direto\nkubectl run ip-test --image=busybox --rm -it --restart=Never -- \\\n  wget -qO- --timeout=3 http://10.96.0.1  # IP do Service kubernetes\n```\n\n**3. Verificar NetworkPolicies de egress:**\n```bash\nkubectl get networkpolicies -n <namespace> -o yaml | grep -A20 egress\n```\n\n**4. Verificar IP do CoreDNS:**\n```bash\nkubectl get service kube-dns -n kube-system\n# CoreDNS fica normalmente em 10.96.0.10 (depende do cidr)\n```',
      solution: '**A policy de default-deny egress esta bloqueando a porta 53 (DNS).**\n\nAdicionar regra de egress permitindo DNS:\n```yaml\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-dns-egress\n  namespace: production\nspec:\n  podSelector: {}\n  policyTypes:\n  - Egress\n  egress:\n  # Permitir DNS (CoreDNS no kube-system)\n  - ports:\n    - protocol: UDP\n      port: 53\n    - protocol: TCP\n      port: 53\n  # Permitir HTTPS para o API Server (se necessario)\n  - to:\n    - namespaceSelector:\n        matchLabels:\n          kubernetes.io/metadata.name: kube-system\n    ports:\n    - protocol: TCP\n      port: 443\n```\n\n**Verificar apos correcao:**\n```bash\nkubectl run dns-verify --image=busybox --rm -it --restart=Never -n production -- nslookup kubernetes.default\n# Deve retornar: Name: kubernetes.default, Address: <cluster-ip>\n```'
    }
  ]
};
