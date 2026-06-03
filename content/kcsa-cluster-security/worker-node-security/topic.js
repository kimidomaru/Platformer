window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcsa-cluster-security/worker-node-security'] = {

  theory: `# Worker Node Security

## Relevancia no KCSA
> O dominio "Kubernetes Cluster Component Security" vale **22%** do KCSA. Entender como proteger worker nodes, o kubelet e o container runtime e essencial para o exame teorico.

---

## Componentes do Worker Node

\`\`\`text
┌─────────────────────────────────────────────────┐
│                WORKER NODE                       │
│                                                  │
│  ┌─────────────┐    ┌──────────────────────┐    │
│  │   kubelet    │    │     kube-proxy       │    │
│  │ (porta 10250)│    │   (ports 10256)      │    │
│  └──────┬──────┘    └──────────────────────┘    │
│         │                                         │
│  ┌──────▼──────┐    ┌──────────────────────┐    │
│  │  Container  │    │     Pods             │    │
│  │  Runtime    │    │  (containers)        │    │
│  │(containerd) │    └──────────────────────┘    │
│  └─────────────┘                                 │
└─────────────────────────────────────────────────┘
\`\`\`

---

## kubelet Security

O **kubelet** e o agente principal do worker node. Roda em cada node e recebe instrucoes do API Server.

### Superficie de Ataque do kubelet

O kubelet expoe uma API HTTP/HTTPS na porta 10250 que permite:
- Executar comandos em pods (\`/exec\`)
- Ver logs de pods (\`/logs\`)
- Criar/deletar containers
- Ver metricas do node

Se comprometido, um atacante pode controlar todos os pods do node.

### Flags de Seguranca do kubelet

| Flag | Valor Seguro | Descricao |
|------|-------------|-----------|
| \`--anonymous-auth\` | \`false\` | Desabilita acesso anonimo |
| \`--authorization-mode\` | \`Webhook\` | Delega autorizacao ao API Server |
| \`--client-ca-file\` | CA certificate | Verifica certificados de clientes |
| \`--read-only-port\` | \`0\` | Desabilita porta read-only (10255) |
| \`--protect-kernel-defaults\` | \`true\` | Protege configuracoes do kernel |
| \`--rotate-certificates\` | \`true\` | Rotacao automatica de certificados |
| \`--tls-cert-file\` | Certificado TLS | TLS obrigatorio |
| \`--tls-private-key-file\` | Chave privada | TLS obrigatorio |

### Autenticacao e Autorizacao do kubelet

\`\`\`yaml
# /var/lib/kubelet/config.yaml
authentication:
  anonymous:
    enabled: false          # Sem acesso anonimo
  webhook:
    enabled: true           # API Server valida tokens
  x509:
    clientCAFile: /etc/kubernetes/pki/ca.crt  # Valida certs
authorization:
  mode: Webhook             # Delega ao API Server via SubjectAccessReview
\`\`\`

**Por que Webhook authorization?**
O kubelet faz uma chamada ao API Server para validar cada requisicao. Isso garante que permissoes do RBAC sao respeitadas.

---

## CIS Benchmark para Worker Nodes

O CIS Kubernetes Benchmark cobre configuracoes dos worker nodes:

**Secao 4.1 — kubelet:**
- 4.1.1: \`--anonymous-auth=false\`
- 4.1.2: \`--authorization-mode=Webhook\` ou \`--authorization-mode=AlwaysAllow\` evitado
- 4.1.3: \`--client-ca-file\` configurado
- 4.1.6: \`--protect-kernel-defaults=true\`
- 4.1.8: \`--hostname-override\` nao configurado (exceto se necessario)

**Secao 4.2 — Configuracao do Node:**
- Sistema operacional atualizado com patches de seguranca
- SSH hardening (desabilitar login root, usar keys)
- Filesystem permissions corretas para arquivos do kubelet

---

## Sistema Operacional do Node

### Hardening do OS

| Area | Pratica Recomendada |
|------|---------------------|
| **SSH** | Desabilitar login root, usar SSH keys, desabilitar password auth |
| **Users** | Remover usuarios desnecessarios, usar principle of least privilege |
| **Packages** | Instalar apenas o necessario, remover ferramentas desnecessarias |
| **Firewall** | Configurar iptables/nftables para portas necessarias apenas |
| **Kernel** | Parametros sysctl hardening (ex: net.ipv4.ip_forward) |
| **Auditd** | Habilitar auditoria do sistema para acoes criticas |

### sysctl Hardening

\`\`\`bash
# Parametros kernel recomendados para nodes K8s
kernel.dmesg_restrict = 1        # Restringe acesso ao dmesg
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_redirects = 0
kernel.randomize_va_space = 2   # ASLR habilitado
\`\`\`

### Sistemas Operacionais Otimizados para Containers

| OS | Caracteristica | Uso |
|----|---------------|-----|
| **Bottlerocket (AWS)** | Imutavel, atualizacoes atomicas, minimal | Nodes AWS |
| **Flatcar Container Linux** | Sucessor do CoreOS, minimal | Multi-cloud |
| **Talos Linux** | API-driven, sem SSH, imutavel | Producao |
| **Ubuntu** | Geral, LTS, familiar | Mais comum |
| **RHEL/Rocky** | Enterprise, SELinux | Ambientes regulados |

---

## Container Runtime Security

### containerd Security

O container runtime e a interface entre o kubelet e os containers:

\`\`\`text
kubelet --CRI--> containerd --OCI--> runc --> container
\`\`\`

**Boas praticas:**
- Usar **rootless containers** (containerd rootless mode)
- Habilitar **seccomp** por padrao
- Usar **cgroups v2** para melhor isolamento de recursos
- Manter containerd atualizado (patches de seguranca)

### RuntimeClass e Sandboxes

Para workloads criticos, usar runtimes com isolamento adicional:

\`\`\`yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc  # gVisor: user-space kernel
\`\`\`

| Runtime | Isolamento | Uso |
|---------|------------|-----|
| **runc** | namespaces + cgroups | Padrao |
| **gVisor (runsc)** | Kernel user-space | Isolamento adicional |
| **Kata Containers** | MicroVM | Isolamento maximo |

---

## NodeRestriction Admission Controller

O **NodeRestriction** admission controller restringe o que kubelets podem fazer no API Server:

**Um kubelet pode:**
- Ler Secrets, ConfigMaps e PVs dos pods agendados em seu node
- Modificar o objeto Node do seu proprio node
- Modificar pods agendados em seu node

**Um kubelet NAO pode:**
- Ler Secrets de pods em outros nodes
- Modificar objetos de outros nodes
- Criar ou deletar nodes
- Adicionar labels com prefixos arbitrarios ao seu node

\`\`\`bash
# Verificar se NodeRestriction esta habilitado
kubectl get pod -n kube-system -l component=kube-apiserver \
  -o jsonpath='{.spec.containers[0].command}' | tr ' ' '\n' | grep NodeRestriction
\`\`\`

---

## Acesso SSH e Bastion Hosts

### Evitar SSH Direto a Nodes

Em clusters de producao, acesso SSH direto aos nodes deve ser evitado:
- Usar \`kubectl exec\` para depurar pods
- Usar \`kubectl debug\` para criar containers efemeros
- Usar \`kubectl node-shell\` ou ferramentas similares via API Server

Se SSH for necessario:
- Usar **bastion host** (jump server) como intermediario
- SSH keys apenas (sem password)
- Audit logging de todas as sessoes SSH
- Rotacao regular de SSH keys

---

## Erros Comuns no KCSA

1. **Confundir portas do kubelet**: 10250 (API autenticada), 10255 (read-only insegura, deve ser desabilitada)
2. **Achar que \`--authorization-mode=AlwaysAllow\` no kubelet e seguro** — e inseguro, usar Webhook
3. **Esquecer que NodeRestriction restringe o kubelet** — impede lateral movement entre nodes
4. **Ignorar o SO do node** — hardening do OS e parte da camada Cluster do 4C
5. **Usar :latest em containerd** — sempre pinnar versoes de runtime tambem
`,

  quiz: [
    {
      question: 'Qual flag do kubelet desabilita o acesso anonimo a API do kubelet?',
      options: ['--disable-auth=true', '--anonymous-auth=false', '--auth-mode=deny', '--require-auth=true'],
      correct: 1,
      explanation: '--anonymous-auth=false desabilita requisicoes sem autenticacao ao kubelet. Sem isso, qualquer um com acesso a porta 10250 pode executar comandos em pods e ver logs sem autenticacao.',
      reference: 'CIS Benchmark 4.1.1: --anonymous-auth=false. Porta 10250 = API kubelet autenticada. Porta 10255 = read-only insegura (desabilitar com --read-only-port=0).'
    },
    {
      question: 'Qual modo de autorizacao e recomendado para o kubelet?',
      options: ['AlwaysAllow', 'AlwaysDeny', 'Webhook', 'RBAC'],
      correct: 2,
      explanation: 'Webhook faz com que o kubelet delegue decisoes de autorizacao ao API Server via SubjectAccessReview. Garante que as policies RBAC do cluster sao respeitadas ao acessar a API do kubelet.',
      reference: 'kubelet --authorization-mode=Webhook. Delega ao API Server. AlwaysAllow = inseguro, qualquer um autenticado tem acesso total.'
    },
    {
      question: 'O que o NodeRestriction admission controller impede?',
      options: ['Criacao de pods em nodes sem recursos', 'Um kubelet comprometido de modificar objetos de outros nodes ou acessar Secrets de outros pods', 'Pods de usarem hostNetwork', 'Nodes de escalar horizontalmente'],
      correct: 1,
      explanation: 'NodeRestriction garante que cada kubelet so pode acessar/modificar seu proprio Node e os Pods agendados nele. Um kubelet comprometido nao pode fazer lateral movement lendo Secrets de pods em outros nodes.',
      reference: 'NodeRestriction: lateral movement prevention via kubelet. Habilitar com --enable-admission-plugins=NodeRestriction.'
    },
    {
      question: 'Qual porta do kubelet deve ser desabilitada por ser insegura (read-only sem autenticacao)?',
      options: ['6443', '10250', '10255', '2379'],
      correct: 2,
      explanation: 'A porta 10255 e a porta read-only do kubelet, que nao requer autenticacao e exibe metricas e estado dos pods. Deve ser desabilitada com --read-only-port=0. A porta 10250 e a API autenticada (deve ser mantida com TLS).',
      reference: 'Portas: 6443=API Server, 2379=etcd, 10250=kubelet API (autenticada), 10255=kubelet read-only (insegura, desabilitar).'
    },
    {
      question: 'Qual sistema operacional para nodes Kubernetes e descrito como "imutavel, sem SSH, gerenciado via API"?',
      options: ['Ubuntu', 'Bottlerocket', 'Talos Linux', 'Flatcar'],
      correct: 2,
      explanation: 'Talos Linux e um OS imutavel, sem shell SSH, gerenciado exclusivamente via API (talosctl). Elimina toda uma classe de ataques relacionados a acesso SSH e modificacao do sistema de arquivos do node.',
      reference: 'Talos: sem SSH, imutavel, API-only. Bottlerocket (AWS): imutavel, atualizacoes atomicas. Flatcar: successor do CoreOS.'
    },
    {
      question: 'O que diferencia gVisor (runsc) do runtime runc padrao?',
      options: ['gVisor e mais rapido', 'gVisor implementa um kernel user-space que intercepta syscalls, adicionando camada de isolamento', 'gVisor usa VMs para isolamento', 'gVisor e um CNI plugin'],
      correct: 1,
      explanation: 'gVisor implementa um kernel user-space (via runsc) que intercepta todas as syscalls dos containers. Adiciona uma camada de isolamento entre container e kernel do host, reduzindo impacto de exploits de kernel.',
      reference: 'gVisor: user-space kernel (isolamento). Kata: MicroVM (maximo isolamento). runc: namespaces+cgroups (padrao). RuntimeClass define qual usar.'
    },
    {
      question: 'Por que o SSH direto a nodes de producao deve ser evitado?',
      options: ['SSH e lento', 'Acesso SSH bypassa o audit trail do Kubernetes e cria superficie de ataque extra', 'SSH nao funciona em containers', 'Nodes nao tem SSH instalado'],
      correct: 1,
      explanation: 'SSH direto bypassa o API Server, perdendo audit logging do K8s. Prefira kubectl exec/debug via API Server, que e auditado. Bastion hosts sao intermediarios seguros se SSH for necessario.',
      reference: 'kubectl exec = auditado pelo K8s. SSH direto = sem audit trail K8s. Talos Linux elimina SSH completamente.'
    },
    {
      question: 'O que --protect-kernel-defaults=true faz no kubelet?',
      options: ['Encripta os dados do kernel', 'Garante que parametros sysctl necessarios para K8s nao foram alterados pelo OS', 'Desabilita modulos do kernel desnecessarios', 'Habilita kernel namespaces para containers'],
      correct: 1,
      explanation: '--protect-kernel-defaults=true faz o kubelet verificar que parametros sysctl necessarios para o funcionamento do Kubernetes (como net.ipv4.ip_forward) estao configurados corretamente e nao foram sobrescritos.',
      reference: 'CIS Benchmark 4.1.6: --protect-kernel-defaults=true. Garante que o OS nao sobrescreve configuracoes necessarias para K8s.'
    }
  ],

  flashcards: [
    { front: 'Flags essenciais de seguranca do kubelet?', back: '--anonymous-auth=false, --authorization-mode=Webhook, --client-ca-file=<CA>, --read-only-port=0, --protect-kernel-defaults=true, --rotate-certificates=true, --tls-cert-file, --tls-private-key-file.' },
    { front: 'Portas do kubelet e suas funcoes?', back: '10250: API autenticada (manter com TLS). 10255: read-only sem autenticacao (DESABILITAR com --read-only-port=0). 10256: health check do kube-proxy.' },
    { front: 'O que NodeRestriction faz?', back: 'Admission controller que restringe o que kubelets podem fazer: so podem acessar Secrets/ConfigMaps dos Pods no SEU node, so podem modificar o SEU Node. Previne lateral movement se um kubelet for comprometido.' },
    { front: 'kubelet --authorization-mode=Webhook vs AlwaysAllow?', back: 'Webhook: delega ao API Server via SubjectAccessReview, respeitando RBAC. AlwaysAllow: qualquer autenticado tem acesso total (inseguro). CIS Benchmark exige Webhook.' },
    { front: 'Qual a diferenca entre runc, gVisor e Kata Containers?', back: 'runc: namespaces+cgroups, padrao, sem overhead. gVisor: kernel user-space (runsc), intercepta syscalls, isolamento adicional. Kata: MicroVM, isolamento maximo, maior overhead. RuntimeClass seleciona o runtime.' },
    { front: 'Por que usar OSes imutaveis para nodes K8s?', back: 'OSes imutaveis (Talos, Bottlerocket, Flatcar) eliminam: acesso SSH direto, modificacao em runtime, configuration drift, ferramentas desnecessarias. Reduzem drasticamente a superficie de ataque do node.' },
    { front: 'Como evitar acesso SSH direto a nodes?', back: 'kubectl exec: executar comandos em pods. kubectl debug: containers efemeros para debug. node-shell: via API Server com SA de sistema. Se SSH necessario: bastion host + keys + audit logging.' },
    { front: 'O que CIS Benchmark seção 4 cobre para nodes?', back: 'Secao 4.1: kubelet flags (anonymous-auth, authorization-mode, client-ca-file, read-only-port). Secao 4.2: OS hardening. Ferramenta kube-bench valida automaticamente.' }
  ],

  lab: {
    scenario: 'Voce e um Security Engineer auditando a seguranca dos worker nodes de um cluster. Precisa verificar configuracoes do kubelet, runtime e identificar gaps de seguranca.',
    objective: 'Auditar configuracoes de seguranca dos worker nodes: kubelet, container runtime e isolamento.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Auditar configuracoes do kubelet',
        instruction: 'Examine as flags de seguranca do kubelet nos nodes do cluster para identificar configuracoes seguras e gaps.',
        hints: ['Verifique a porta 10255 (read-only insegura)', 'Procure por --anonymous-auth e --authorization-mode'],
        solution: '```bash\n# Ver versao e info dos nodes\nkubectl get nodes -o wide\n\n# Ver configuracao do kubelet via ConfigMap (se configurado via kubeadm)\nkubectl get configmap kubelet-config -n kube-system -o yaml 2>/dev/null || echo "ConfigMap nao encontrado"\n\n# Verificar que o kubelet nao expoe read-only port\n# (De dentro de um pod)\nkubectl run kubelet-audit --image=alpine --restart=Never --rm -it -- \\\n  wget -qO- --timeout=2 http://$(kubectl get nodes -o jsonpath=\'{.items[0].status.addresses[0].address}\'):10255/pods 2>&1 || echo "Porta 10255 bloqueada (bom)\"\n\n# Ver versao do kubelet\nkubectl get nodes -o jsonpath=\'{range .items[*]}{.metadata.name}{\" kubelet=\"}{.status.nodeInfo.kubeletVersion}{\"\\n\"}{end}\'\n```',
        verify: '```bash\n# Verificar informacoes basicas dos nodes\nkubectl get nodes -o wide\n# Saida esperada: nodes em Ready state com versoes\n```'
      },
      {
        title: 'Verificar Container Runtime e SecurityContext dos Pods',
        instruction: 'Identifique o container runtime em uso e analise os SecurityContexts dos pods em execucao para encontrar pods rodando com configuracoes inseguras.',
        hints: ['Use kubectl get nodes -o wide para ver o runtime', 'Procure por containers com privileged: true ou sem securityContext'],
        solution: '```bash\n# Ver container runtime dos nodes\nkubectl get nodes -o jsonpath=\'{range .items[*]}{.metadata.name}{\" \"}{.status.nodeInfo.containerRuntimeVersion}{\"\\n\"}{end}\'\n\n# Encontrar pods rodando como root ou com privilegios elevados\nkubectl get pods --all-namespaces -o json | \\\n  jq \'.items[] | select(.spec.securityContext.runAsNonRoot != true) | .metadata.namespace + \"/\" + .metadata.name\'\n\n# Encontrar pods sem securityContext definido\nkubectl get pods --all-namespaces -o json | \\\n  jq \'.items[] | select(.spec.containers[].securityContext == null) | .metadata.namespace + \"/\" + .metadata.name\' | head -10\n\n# Verificar containers privilegiados\nkubectl get pods --all-namespaces -o json | \\\n  jq \'.items[] | select(.spec.containers[].securityContext.privileged == true) | .metadata.namespace + \"/\" + .metadata.name\'\n```',
        verify: '```bash\n# Verificar runtime dos nodes\nkubectl get nodes -o jsonpath=\'{.items[0].status.nodeInfo.containerRuntimeVersion}\'\n# Saida esperada: containerd://x.x.x ou cri-o://x.x.x\n```'
      },
      {
        title: 'Verificar NodeRestriction e Seguranca do kubelet',
        instruction: 'Confirme que o NodeRestriction admission controller esta ativo e verifique que kubelets nao tem acesso a recursos de outros nodes.',
        hints: ['NodeRestriction aparece nas flags do apiserver', 'Tente kubectl auth can-i com a identidade de um kubelet'],
        solution: '```bash\n# Verificar NodeRestriction no apiserver\nkubectl get pod -n kube-system -l component=kube-apiserver \\\n  -o jsonpath=\'{.items[0].spec.containers[0].command}\' | tr \' \' \'\\n\' | grep NodeRestriction\n\n# Simular o que um kubelet pode fazer (system:node identidade)\n# Kubelets usam: system:node:<node-name> em system:nodes group\nNODE_NAME=$(kubectl get nodes -o jsonpath=\'{.items[0].metadata.name}\')\n\n# Verificar se kubelet pode acessar secrets (deve ser restrito pelo NodeRestriction)\nkubectl auth can-i get secrets \\\n  --as=system:node:$NODE_NAME \\\n  --as-group=system:nodes -n kube-system\n# Saida esperada: no (NodeRestriction restringindo acesso)\n\n# Verificar acoes permitidas para o kubelet no seu proprio namespace\nkubectl auth can-i get pods \\\n  --as=system:node:$NODE_NAME \\\n  --as-group=system:nodes -n default\n```',
        verify: '```bash\nNODE_NAME=$(kubectl get nodes -o jsonpath=\'{.items[0].metadata.name}\')\nkubectl auth can-i delete nodes --as=system:node:$NODE_NAME --as-group=system:nodes\n# Saida esperada: no (kubelet nao pode deletar nodes)\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'kubelet nao consegue autenticar com o API Server apos rotacao de certificados',
      difficulty: 'medium',
      symptom: 'Apos rotacao de certificados do cluster, um node especifico fica em NotReady. O kubelet deste node retorna "x509: certificate has expired or is not yet valid" nos logs.',
      diagnosis: '**1. Verificar status do node:**\n```bash\nkubectl get nodes\n# Node especifico em NotReady\n\nkubectl describe node <node-name>\n# Ver condicoes e eventos\n```\n\n**2. Verificar logs do kubelet no node afetado:**\n```bash\n# No node (via SSH ou console)\njournalctl -u kubelet | tail -50 | grep -E "certificate|x509|auth"\n```\n\n**3. Verificar o certificado do kubelet:**\n```bash\nopenssl x509 -in /var/lib/kubelet/pki/kubelet-client-current.pem -text | grep -E "Not Before|Not After"\n```\n\n**4. Verificar se rotacao automatica esta habilitada:**\n```bash\n# No node\ngrep rotate-certificates /etc/kubernetes/kubelet.conf || cat /var/lib/kubelet/config.yaml | grep rotate\n```',
      solution: '**Se rotacao automatica esta desabilitada:**\n```bash\n# Habilitar rotacao automatica no kubelet config\n# /var/lib/kubelet/config.yaml\nrotateCertificates: true\n\n# Ou via flag\n# --rotate-certificates=true\n\n# Reiniciar kubelet\nsystemctl restart kubelet\n```\n\n**Se o certificado expirou e o node nao consegue se reconectar:**\n```bash\n# No control plane, aprovara o CSR do node\nkubectl get csr\nkubectl certificate approve <csr-name>\n```\n\n**Prevencao:**\n```bash\n# Verificar expiracao de certificados regularmente\nkubeadm certs check-expiration\n\n# Habilitar rotacao no kubelet (flag ou config)\n--rotate-certificates=true\n```'
    },
    {
      title: 'Pod consegue acessar a API do kubelet diretamente na porta 10250',
      difficulty: 'hard',
      symptom: 'Teste de penetracao revelou que pods podem fazer requisicoes diretas ao kubelet de outros nodes via porta 10250, obtendo informacoes de pods e executando comandos.',
      diagnosis: '**1. Verificar se kubelet tem autenticacao desabilitada:**\n```bash\n# No node afetado\ncat /var/lib/kubelet/config.yaml | grep -A5 authentication\n# Se anonymous.enabled: true, E vulneravel\n```\n\n**2. Verificar se a porta 10250 e acessivel de outros pods:**\n```bash\nkubectl run test --image=alpine --restart=Never --rm -it -- \\\n  wget -qO- --timeout=2 https://<NODE_IP>:10250/pods --no-check-certificate 2>&1\n# Se retornar JSON, o acesso anonimo esta habilitado\n```\n\n**3. Verificar NetworkPolicies:**\n```bash\nkubectl get networkpolicies --all-namespaces\n# Verificar se existe policy bloqueando acesso a porta 10250\n```',
      solution: '**1. Desabilitar acesso anonimo ao kubelet:**\n```yaml\n# /var/lib/kubelet/config.yaml\nauthentication:\n  anonymous:\n    enabled: false\n  webhook:\n    enabled: true\n  x509:\n    clientCAFile: /etc/kubernetes/pki/ca.crt\nauthorization:\n  mode: Webhook\n```\n\n**2. Reiniciar o kubelet:**\n```bash\nsystemctl restart kubelet\n```\n\n**3. Adicionar NetworkPolicy bloqueando porta 10250 de pods:**\n```yaml\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: block-kubelet-api\n  namespace: default\nspec:\n  podSelector: {}\n  policyTypes:\n  - Egress\n  egress:\n  - ports:\n    - port: 80\n    - port: 443\n    - port: 53\n      protocol: UDP\n  # Nao incluir porta 10250 = pods nao podem acessar kubelet API\n```\n\n**Verificar:**\n```bash\nkubectl run verify --image=alpine --restart=Never --rm -it -- \\\n  wget -qO- --timeout=2 https://<NODE_IP>:10250/pods --no-check-certificate 2>&1\n# Deve retornar 401 Unauthorized (nao 200 OK)\n```'
    }
  ]
};
