window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcna-cloud-native/open-standards'] = {

  theory: `# Open Standards & CNCF Projects

## Relevancia no KCNA
> O dominio "Cloud Native Architecture" vale **16%** do KCNA. Entender os padroes abertos (OCI, CNI, CSI, CRI, SMI) e projetos CNCF e fundamental para a prova.

---

## Por que Open Standards?

Padroes abertos garantem:
- **Interoperabilidade**: componentes de diferentes vendors trabalham juntos
- **Portabilidade**: migrar entre clouds/plataformas sem lock-in
- **Inovacao**: vendors competem em implementacao, nao em formato
- **Comunidade**: desenvolvimento colaborativo e transparente

---

## OCI (Open Container Initiative)

A OCI define padroes para containers:

| Spec | Funcao | Descricao |
|------|--------|-----------|
| **Image Spec** | Formato de imagens | Layers, manifest, index (multi-arch) |
| **Runtime Spec** | Execucao de containers | Como criar/executar containers (runc) |
| **Distribution Spec** | Distribuicao de imagens | API para push/pull de registries |

\`\`\`text
OCI Image Spec:
  Image Index (multi-arch)
    +-- Image Manifest (linux/amd64)
    |     +-- Config (env, cmd, layers)
    |     +-- Layers (tar+gzip)
    +-- Image Manifest (linux/arm64)
          +-- Config
          +-- Layers
\`\`\`

Impacto: imagens Docker funcionam em qualquer runtime OCI-compliant (containerd, CRI-O, Podman).

---

## CRI (Container Runtime Interface)

Interface padrao entre kubelet e container runtimes:

\`\`\`text
kubelet --CRI (gRPC)--> Runtime
                           |
                    +------+------+
                    |             |
                containerd     CRI-O
                    |             |
                  runc          runc
\`\`\`

| Servico | Funcao |
|---------|--------|
| **RuntimeService** | Criar, iniciar, parar, deletar containers e pods |
| **ImageService** | Pull, listar, remover imagens |

Implementacoes: containerd (padrao), CRI-O (Red Hat/OpenShift).

---

## CNI (Container Network Interface)

Interface padrao para plugins de rede:

\`\`\`text
kubelet --> CNI Plugin --> Configura rede do Pod
               |
       +-------+--------+
       |       |         |
    Calico  Cilium   Flannel
\`\`\`

Funcoes do CNI:
- Alocar IP ao Pod
- Configurar rotas entre pods
- Configurar rede do node
- Limpar recursos quando pod e removido

Plugins populares:

| Plugin | Abordagem | Destaque |
|--------|-----------|----------|
| **Calico** | L3/BGP | NetworkPolicy, popular |
| **Cilium** | eBPF | Performance, observabilidade |
| **Flannel** | VXLAN overlay | Simples, sem NetworkPolicy |
| **Weave** | Mesh overlay | Facil de instalar |

---

## CSI (Container Storage Interface)

Interface padrao para plugins de storage:

\`\`\`text
kubelet --> CSI Driver --> Provisiona/Monta volume
               |
       +-------+--------+
       |       |         |
    AWS EBS  GCP PD   Ceph RBD
\`\`\`

Funcoes do CSI:
- Criar/deletar volumes (provisioning)
- Attach/detach volumes ao node
- Mount/unmount volumes no pod
- Snapshots e clones

Vantagens sobre in-tree plugins:
- Desenvolvimento independente do K8s
- Vendors controlam releases
- Instalado como DaemonSet + Deployment

---

## SMI (Service Mesh Interface)

Interface padrao para service meshes:

| API | Funcao |
|-----|--------|
| **Traffic Access Control** | Politicas de acesso entre servicos |
| **Traffic Specs** | Definir rotas e matches |
| **Traffic Split** | Dividir trafego (canary, blue-green) |
| **Traffic Metrics** | Metricas padronizadas |

\`\`\`text
Aplicacao --> SMI API --> Service Mesh Implementation
                            |
                    +-------+-------+
                    |       |       |
                  Istio  Linkerd  Consul
\`\`\`

---

## CloudEvents

Especificacao para descrever eventos de forma padronizada:

\`\`\`json
{
  "specversion": "1.0",
  "type": "com.example.order.created",
  "source": "/orders/service",
  "id": "abc-123",
  "time": "2024-01-15T10:00:00Z",
  "data": { "orderId": "12345" }
}
\`\`\`

- CNCF Graduated project
- Formato padrao para eventos entre servicos
- Suportado por KEDA, Knative, Azure Event Grid

---

## CNCF Landscape

O CNCF Landscape organiza o ecossistema cloud native:

| Categoria | Exemplos |
|-----------|----------|
| **Container Runtime** | containerd, CRI-O |
| **Orchestration** | Kubernetes |
| **Service Mesh** | Istio, Linkerd |
| **Observability** | Prometheus, Grafana, Jaeger |
| **CI/CD** | Argo, Tekton, Flux |
| **Storage** | Rook, Longhorn, OpenEBS |
| **Security** | Falco, OPA, cert-manager |
| **Networking** | Calico, Cilium, CoreDNS |

### Projetos Graduated (mais importantes para KCNA)

| Projeto | Funcao |
|---------|--------|
| **Kubernetes** | Orquestracao de containers |
| **Prometheus** | Monitoramento e metricas |
| **Envoy** | Proxy L7 |
| **CoreDNS** | DNS do cluster |
| **containerd** | Container runtime |
| **etcd** | Key-value store |
| **Helm** | Gerenciador de pacotes |
| **Fluentd** | Coleta de logs |
| **Argo** | CI/CD e workflows |
| **Flux** | GitOps |
| **Linkerd** | Service mesh |
| **Harbor** | Container registry |

---

## Resumo dos Padroes

| Padrao | Interface | Conecta |
|--------|-----------|---------|
| **OCI** | Image/Runtime/Distribution | Imagens <-> Runtimes <-> Registries |
| **CRI** | Container Runtime Interface | kubelet <-> Runtime (containerd/CRI-O) |
| **CNI** | Container Network Interface | kubelet <-> Network Plugin (Calico/Cilium) |
| **CSI** | Container Storage Interface | kubelet <-> Storage Plugin (EBS/PD/Ceph) |
| **SMI** | Service Mesh Interface | App <-> Service Mesh (Istio/Linkerd) |
`,

  quiz: [
    {
      question: 'Qual a principal vantagem de open standards no ecossistema cloud native?',
      options: ['Sao mais rapidos', 'Garantem interoperabilidade e portabilidade entre vendors', 'Sao mais seguros', 'Sao gratuitos'],
      correct: 1,
      explanation: 'Open standards (OCI, CRI, CNI, CSI) garantem que componentes de diferentes vendors trabalham juntos e permitem migrar entre plataformas sem lock-in.',
      reference: 'Conceito relacionado: Open Standards — beneficios.'
    },
    {
      question: 'Quais specs a OCI (Open Container Initiative) define?',
      options: ['Network e Storage', 'Image Spec, Runtime Spec e Distribution Spec', 'API e Authentication', 'Service Mesh e Observability'],
      correct: 1,
      explanation: 'OCI define tres specs: Image Spec (formato de imagens), Runtime Spec (como executar containers) e Distribution Spec (API para push/pull de registries).',
      reference: 'Conceito relacionado: OCI — tres especificacoes.'
    },
    {
      question: 'O que CRI (Container Runtime Interface) conecta?',
      options: ['Pods e Services', 'kubelet e container runtimes (containerd, CRI-O)', 'API Server e etcd', 'CNI plugins e pods'],
      correct: 1,
      explanation: 'CRI e a interface gRPC padrao entre o kubelet e container runtimes. Define RuntimeService (gerenciar containers) e ImageService (gerenciar imagens).',
      reference: 'Conceito relacionado: CRI — kubelet e runtimes.'
    },
    {
      question: 'Qual a funcao principal do CNI (Container Network Interface)?',
      options: ['Gerenciar DNS', 'Configurar rede dos Pods (alocar IP, rotas)', 'Gerenciar certificates', 'Balancear carga entre Services'],
      correct: 1,
      explanation: 'CNI define como plugins de rede configuram a rede dos Pods: alocar IP, configurar rotas, limpar recursos. Implementacoes: Calico, Cilium, Flannel.',
      reference: 'Conceito relacionado: CNI — rede dos pods.'
    },
    {
      question: 'Qual padrao permite usar diferentes backends de storage no Kubernetes?',
      options: ['OCI', 'CRI', 'CSI (Container Storage Interface)', 'SMI'],
      correct: 2,
      explanation: 'CSI permite vendors implementar drivers de storage como plugins. Funcoes: provisionar/deletar volumes, attach/detach, mount/unmount, snapshots.',
      reference: 'Conceito relacionado: CSI — plugins de storage.'
    },
    {
      question: 'Qual projeto CNCF e o DNS padrao do Kubernetes?',
      options: ['kube-dns', 'CoreDNS', 'Bind9', 'PowerDNS'],
      correct: 1,
      explanation: 'CoreDNS e um projeto CNCF graduated que e o DNS padrao do Kubernetes desde a versao 1.13. Resolve nomes de Services e Pods dentro do cluster.',
      reference: 'Conceito relacionado: CoreDNS — CNCF graduated.'
    },
    {
      question: 'O que e CloudEvents?',
      options: ['Servico de nuvem da AWS', 'Especificacao padrao para descrever eventos entre servicos', 'Plugin de monitoramento', 'Ferramenta de deploy'],
      correct: 1,
      explanation: 'CloudEvents e uma especificacao CNCF graduated que define formato padrao para eventos. Garante interoperabilidade entre servicos event-driven.',
      reference: 'Conceito relacionado: CloudEvents — formato de eventos.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os principais open standards do ecossistema K8s?', back: 'OCI (imagens/runtime), CRI (kubelet<->runtime), CNI (rede), CSI (storage), SMI (service mesh). Garantem interoperabilidade e portabilidade entre vendors.' },
    { front: 'O que a OCI define?', back: 'Tres specs: Image Spec (formato de imagens, layers), Runtime Spec (como executar containers, runc), Distribution Spec (API para push/pull de registries). Garante portabilidade de imagens.' },
    { front: 'O que e CRI e quais implementacoes existem?', back: 'Container Runtime Interface: API gRPC entre kubelet e runtime. Servicos: RuntimeService + ImageService. Implementacoes: containerd (padrao) e CRI-O (Red Hat/OpenShift).' },
    { front: 'O que e CNI e quais plugins existem?', back: 'Container Network Interface: padrao para plugins de rede. Alocar IP, configurar rotas. Plugins: Calico (BGP/NetworkPolicy), Cilium (eBPF), Flannel (overlay simples), Weave (mesh).' },
    { front: 'O que e CSI?', back: 'Container Storage Interface: padrao para plugins de storage. Provisionar/deletar, attach/detach, mount/unmount volumes, snapshots. Drivers: AWS EBS, GCP PD, Ceph RBD. Instalado como DaemonSet.' },
    { front: 'O que e SMI?', back: 'Service Mesh Interface: padrao para service meshes. APIs: Traffic Access Control, Traffic Specs, Traffic Split, Traffic Metrics. Abstrai implementacao (Istio, Linkerd, Consul).' },
    { front: 'Quais sao os principais projetos CNCF Graduated?', back: 'Kubernetes, Prometheus, Envoy, CoreDNS, containerd, etcd, Helm, Fluentd, Argo, Flux, Linkerd, Harbor. Graduated = maduro e pronto para producao.' },
    { front: 'O que e CloudEvents?', back: 'Especificacao CNCF para formato padrao de eventos. Campos: specversion, type, source, id, time, data. Usado por KEDA, Knative, Azure Event Grid para interoperabilidade.' }
  ],

  lab: {
    scenario: 'Voce esta explorando os open standards implementados no seu cluster Kubernetes.',
    objective: 'Identificar quais padroes abertos (OCI, CRI, CNI, CSI) estao ativos no cluster.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Identificar Container Runtime (CRI)',
        instruction: 'Descubra qual container runtime (CRI implementation) esta sendo usado no cluster.',
        hints: ['Use kubectl get nodes -o wide', 'Procure a coluna CONTAINER-RUNTIME', 'Deve ser containerd ou CRI-O'],
        solution: '```bash\n# Identificar runtime via nodes\nkubectl get nodes -o wide\n# Coluna CONTAINER-RUNTIME: containerd://x.x.x ou cri-o://x.x.x\n\n# Detalhes do runtime\nkubectl describe node | grep -i "container runtime"\n\n# Ver versao do kubelet (que usa CRI)\nkubectl get nodes -o jsonpath="{.items[*].status.nodeInfo.containerRuntimeVersion}"\n```',
        verify: '```bash\nkubectl get nodes -o jsonpath="{.items[0].status.nodeInfo.containerRuntimeVersion}"\n# Saida esperada: containerd://1.x.x ou cri-o://1.x.x\n```'
      },
      {
        title: 'Identificar CNI Plugin',
        instruction: 'Descubra qual CNI plugin de rede esta instalado no cluster.',
        hints: ['Procure pods no kube-system', 'CNI plugins rodam como DaemonSet', 'Procure por calico, cilium, flannel, weave'],
        solution: '```bash\n# Procurar CNI plugin no kube-system\nkubectl get pods -n kube-system | grep -E "calico|cilium|flannel|weave|canal"\n\n# Ver DaemonSets de rede\nkubectl get daemonsets -n kube-system\n\n# Verificar configuracao de rede do node\nkubectl describe node | grep -A 2 "PodCIDR"\n\n# Ver IPs dos pods (rede CNI funcionando)\nkubectl get pods -A -o wide | head -10\n```',
        verify: '```bash\nkubectl get pods -n kube-system | grep -E "calico|cilium|flannel|weave|canal|kindnet" | head -3\n# Saida esperada: pods do CNI plugin em Running\n\nkubectl get pods -A -o wide | awk \'{print $7}\' | grep -v IP | head -5\n# Saida esperada: IPs dos pods (CNI alocou)\n```'
      },
      {
        title: 'Identificar CSI Drivers e StorageClasses',
        instruction: 'Verifique quais CSI drivers e StorageClasses estao disponiveis no cluster.',
        hints: ['Liste StorageClasses', 'Verifique o provisioner de cada StorageClass', 'CSI drivers aparecem como pods no kube-system'],
        solution: '```bash\n# Listar StorageClasses (CSI provisioners)\nkubectl get storageclass\n\n# Ver detalhes do provisioner\nkubectl get storageclass -o jsonpath="{range .items[*]}{.metadata.name}{\'\\t\'}{.provisioner}{\'\\n\'}{end}"\n\n# Listar CSI drivers instalados\nkubectl get csidrivers 2>/dev/null || echo "Nenhum CSIDriver resource encontrado"\n\n# Ver CSI pods (se existirem)\nkubectl get pods -n kube-system | grep csi\n```',
        verify: '```bash\nkubectl get storageclass\n# Saida esperada: pelo menos uma StorageClass listada\n\nkubectl get storageclass -o jsonpath="{.items[0].provisioner}"\n# Saida esperada: nome do provisioner (ex: rancher.io/local-path, kubernetes.io/aws-ebs, etc)\n```'
      }
    ]
  },

  troubleshooting: []
};
