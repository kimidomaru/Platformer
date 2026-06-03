window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcna-k8s-fundamentals/containers-runtime'] = {

  theory: `# Containers & Container Runtimes

## Relevancia no KCNA
> O dominio "Kubernetes Fundamentals" vale **46%** do KCNA. Entender o que sao containers e como runtimes funcionam e base para todo o ecossistema Kubernetes.

---

## O que sao Containers?

Containers sao processos isolados que empacotam aplicacao + dependencias. Usam recursos do kernel Linux:

| Tecnologia | Funcao |
|-----------|--------|
| **Namespaces** | Isolamento (PID, rede, filesystem, users) |
| **cgroups** | Limitacao de recursos (CPU, memoria) |
| **Union FS** | Layers de filesystem sobrepostas |

### Container vs VM

| Aspecto | Container | VM |
|---------|-----------|-----|
| Isolamento | Processo (kernel compartilhado) | Hardware (kernel dedicado) |
| Startup | Segundos | Minutos |
| Tamanho | MBs | GBs |
| Overhead | Minimo | Significativo |
| Densidade | Alta (centenas/host) | Baixa (dezenas/host) |

---

## Container Images

Uma imagem e um pacote read-only com layers:

\`\`\`text
Layer 4: COPY app.py      (aplicacao)
Layer 3: RUN pip install   (dependencias)
Layer 2: RUN apt install   (pacotes OS)
Layer 1: ubuntu:22.04      (base image)
\`\`\`

- Cada instrucao do Dockerfile cria uma layer
- Layers sao compartilhadas entre imagens (eficiencia)
- Containers adicionam uma **writable layer** no topo

### OCI Image Spec

A **OCI (Open Container Initiative)** define o padrao para imagens:
- Image manifest (lista de layers)
- Image index (multi-arch support)
- Layer format (tar+gzip)

---

## Container Registries

| Registry | Tipo | Uso |
|----------|------|-----|
| Docker Hub | Publico/Privado | Registry padrao, imagens oficiais |
| Harbor | Self-hosted | Enterprise, scanning integrado |
| Amazon ECR | Cloud | AWS integrado |
| Google GCR/AR | Cloud | GCP integrado |
| Azure ACR | Cloud | Azure integrado |
| Quay.io | Publico/Privado | Red Hat, scanning com Clair |
| GitHub GHCR | Publico/Privado | Integrado com GitHub |

---

## Container Runtime Interface (CRI)

O **CRI** e a interface padrao entre kubelet e container runtimes:

\`\`\`text
kubelet --> CRI --> High-Level Runtime --> Low-Level Runtime --> Container
              |           |                       |
              |      containerd              runc / crun
              |      CRI-O
              |
         gRPC API (ImageService + RuntimeService)
\`\`\`

### High-Level Runtimes

| Runtime | Descricao |
|---------|-----------|
| **containerd** | Runtime padrao, CNCF graduated, usado pela maioria |
| **CRI-O** | Lightweight, projetado especificamente para K8s (Red Hat) |

### Low-Level Runtimes (OCI Runtime)

| Runtime | Descricao |
|---------|-----------|
| **runc** | Implementacao de referencia OCI, padrao |
| **crun** | Alternativa em C, mais leve que runc |
| **runsc (gVisor)** | Sandbox com kernel user-space |
| **kata-runtime** | Sandbox com MicroVM |

---

## Historico: Docker e dockershim

\`\`\`text
Antes do K8s 1.24:
  kubelet --> dockershim --> Docker Engine --> containerd --> runc

Depois do K8s 1.24 (dockershim removido):
  kubelet --> CRI --> containerd --> runc
\`\`\`

- **K8s 1.20**: dockershim deprecated
- **K8s 1.24**: dockershim removido
- Imagens Docker continuam funcionando (OCI-compliant)
- Apenas o runtime mudou, nao o formato de imagem

---

## Ciclo de Vida do Container

\`\`\`text
Image Pull --> Create --> Start --> Running --> Stop --> Remove
                                      |
                                    Restart
                                   (policy)
\`\`\`

### Restart Policies (Kubernetes)

| Policy | Comportamento |
|--------|-------------|
| \`Always\` | Sempre reinicia (padrao para Deployments) |
| \`OnFailure\` | Reinicia apenas se exit code != 0 |
| \`Never\` | Nunca reinicia (para Jobs) |
`,

  quiz: [
    {
      question: 'Quais tecnologias do kernel Linux sao usadas por containers?',
      options: ['VMs e hypervisors', 'Namespaces e cgroups', 'Sockets e pipes', 'Modules e drivers'],
      correct: 1,
      explanation: 'Containers usam namespaces (isolamento de PID, rede, filesystem) e cgroups (limitacao de CPU, memoria). Nao usam virtualizacao de hardware como VMs.',
      reference: 'Conceito relacionado: Containers — tecnologias de isolamento.'
    },
    {
      question: 'Qual container runtime e o padrao na maioria das distribuicoes Kubernetes?',
      options: ['Docker', 'CRI-O', 'containerd', 'runc'],
      correct: 2,
      explanation: 'containerd e o runtime padrao, CNCF graduated. Docker (via dockershim) foi removido no K8s 1.24. containerd e um high-level runtime que usa runc como OCI runtime.',
      reference: 'Conceito relacionado: Container runtimes — containerd.'
    },
    {
      question: 'O que aconteceu com o Docker no Kubernetes 1.24?',
      options: [
        'Docker foi proibido',
        'O dockershim foi removido, mas imagens Docker continuam funcionando',
        'Docker se tornou o unico runtime suportado',
        'Docker foi substituido por Podman'
      ],
      correct: 1,
      explanation: 'O dockershim (adaptador CRI para Docker) foi removido no K8s 1.24. O runtime padrao mudou para containerd ou CRI-O. Imagens Docker continuam 100% compativeis (OCI spec).',
      reference: 'Conceito relacionado: dockershim removal — K8s 1.24.'
    },
    {
      question: 'O que a OCI (Open Container Initiative) define?',
      options: [
        'Kubernetes APIs',
        'Padroes para imagens de container e runtimes',
        'Protocolos de rede',
        'Padroes de armazenamento'
      ],
      correct: 1,
      explanation: 'OCI define dois padroes: Image Spec (formato de imagens) e Runtime Spec (como executar containers). Garante portabilidade entre diferentes runtimes e registries.',
      reference: 'Conceito relacionado: OCI — Open Container Initiative.'
    },
    {
      question: 'Qual a diferenca entre um high-level e low-level container runtime?',
      options: [
        'High-level e mais rapido',
        'High-level gerencia lifecycle e imagens, low-level executa o container usando recursos do kernel',
        'Nao ha diferenca',
        'Low-level e mais seguro'
      ],
      correct: 1,
      explanation: 'High-level (containerd, CRI-O): gerencia lifecycle, pull de imagens, networking. Low-level (runc, crun): configura namespaces, cgroups e executa o container.',
      reference: 'Conceito relacionado: Runtime hierarchy.'
    },
    {
      question: 'O que e CRI no Kubernetes?',
      options: [
        'Container Registry Interface',
        'Container Runtime Interface — API gRPC entre kubelet e runtime',
        'Container Resource Inspector',
        'Cluster Runtime Installer'
      ],
      correct: 1,
      explanation: 'CRI (Container Runtime Interface) e a API gRPC padrao entre o kubelet e o container runtime. Define operacoes de ImageService e RuntimeService.',
      reference: 'Conceito relacionado: CRI — padrao de interface.'
    },
    {
      question: 'O que sao layers em uma imagem de container?',
      options: [
        'Camadas de rede do container',
        'Camadas read-only do filesystem, cada instrucao do Dockerfile cria uma layer',
        'Niveis de seguranca',
        'Camadas de criptografia'
      ],
      correct: 1,
      explanation: 'Cada instrucao do Dockerfile (RUN, COPY, ADD) cria uma layer read-only. Layers sao empilhadas e compartilhadas entre imagens para eficiencia.',
      reference: 'Conceito relacionado: Container images — layers.'
    }
  ],

  flashcards: [
    { front: 'O que sao containers?', back: 'Processos isolados que usam namespaces (isolamento) e cgroups (limitacao de recursos) do kernel Linux. Empacotam aplicacao + dependencias em imagens portaveis.' },
    { front: 'Container vs VM: quais as diferencas?', back: 'Container: kernel compartilhado, startup em segundos, MBs, alta densidade. VM: kernel dedicado, startup em minutos, GBs, overhead de hypervisor.' },
    { front: 'O que e CRI?', back: 'Container Runtime Interface: API gRPC entre kubelet e container runtime. Permite usar diferentes runtimes (containerd, CRI-O) de forma padronizada.' },
    { front: 'O que e containerd?', back: 'High-level container runtime padrao do Kubernetes. CNCF graduated. Gerencia lifecycle de containers, pull de imagens e networking. Usa runc como OCI runtime.' },
    { front: 'O que aconteceu com dockershim?', back: 'Deprecated no K8s 1.20, removido no K8s 1.24. O kubelet agora usa CRI diretamente com containerd ou CRI-O. Imagens Docker continuam funcionando (OCI-compliant).' },
    { front: 'O que e a OCI?', back: 'Open Container Initiative: define padroes abertos para Image Spec (formato de imagens) e Runtime Spec (como executar containers). Garante portabilidade.' },
    { front: 'O que sao namespaces e cgroups?', back: 'Namespaces: isolamento de PID, rede, mount, user, IPC, UTS. cgroups: limitacao e contabilizacao de recursos (CPU, memoria, I/O). Juntos formam a base de containers.' }
  ],

  lab: {
    scenario: 'Voce esta explorando como containers e runtimes funcionam no Kubernetes.',
    objective: 'Entender a relacao entre containers, imagens, runtimes e o Kubernetes.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Explorar Container Runtime',
        instruction: 'Identifique qual container runtime esta sendo usado no cluster.',
        hints: ['Use kubectl get nodes -o wide', 'Procure pela coluna CONTAINER-RUNTIME', 'Use kubectl describe node'],
        solution: '```bash\n# Ver runtime dos nodes\nkubectl get nodes -o wide\n# Coluna CONTAINER-RUNTIME mostra o runtime\n\n# Detalhes do node\nkubectl describe node | grep -i runtime\n\n# Via crictl (se tiver acesso ao node)\ncrictl version 2>/dev/null || echo \"crictl nao disponivel\"\n```',
        verify: '```bash\nkubectl get nodes -o wide | awk \'{print $1, $NF}\'\n# Saida esperada: nome-node containerd://x.x.x (ou cri-o://x.x.x)\n```'
      },
      {
        title: 'Explorar Imagens e Layers',
        instruction: 'Crie um pod e examine a imagem usada, entendendo como layers e pull policies funcionam.',
        hints: ['Crie um pod com nginx', 'Use kubectl describe para ver eventos de pull', 'Compare imagePullPolicy'],
        solution: '```bash\n# Criar pod\nkubectl run layer-test --image=nginx:1.25-alpine\n\n# Ver eventos (incluindo pull da imagem)\nkubectl describe pod layer-test | grep -A 5 Events\n\n# Ver detalhes da imagem\nkubectl get pod layer-test -o jsonpath=\"{.spec.containers[0].image}\"\nkubectl get pod layer-test -o jsonpath=\"{.status.containerStatuses[0].imageID}\"\n```',
        verify: '```bash\nkubectl get pod layer-test -o jsonpath=\"{.status.containerStatuses[0].imageID}\"\n# Saida esperada: hash SHA256 da imagem\n\nkubectl get pod layer-test\n# Saida esperada: Running\n```'
      },
      {
        title: 'Entender Restart Policies',
        instruction: 'Explore como diferentes restart policies afetam o comportamento de pods.',
        hints: ['Crie pods com diferentes restartPolicy', 'Use Never para Jobs', 'Use Always para Deployments'],
        solution: '```bash\n# Pod com restartPolicy Never (estilo Job)\nkubectl run once --image=busybox --restart=Never -- echo \"Executou uma vez\"\n\n# Verificar status apos conclusao\nkubectl get pod once\n# Status sera Completed (nao reinicia)\n\n# Pod com restartPolicy Always (padrao)\nkubectl run always --image=busybox --restart=Always -- sh -c \"exit 1\"\n\n# Verificar restarts\nsleep 10\nkubectl get pod always\n# RESTARTS vai aumentar (reinicia sempre)\n```',
        verify: '```bash\nkubectl get pod once -o jsonpath=\"{.spec.restartPolicy}\"\n# Saida esperada: Never\n\nkubectl get pod once -o jsonpath=\"{.status.phase}\"\n# Saida esperada: Succeeded\n```'
      }
    ]
  },

  troubleshooting: []
};
