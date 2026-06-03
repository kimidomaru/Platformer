window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-microservice-vuln/runtime-sandboxing'] = {

  theory: `# Container Runtime Sandboxing

## Relevancia no CKS
> O dominio "Minimize Microservice Vulnerabilities" vale **20%** do CKS. Runtime sandboxing adiciona camadas de isolamento alem dos namespaces Linux. Voce deve saber configurar RuntimeClass e entender gVisor vs Kata Containers.

---

## Por que Sandboxing?

Containers padrao (runc) compartilham o kernel do host. Se um atacante explorar uma vulnerabilidade do kernel, ele compromete o node inteiro.

\`\`\`text
Container Security Layers:
  runc (padrao)     → Namespaces + cgroups     → Kernel compartilhado
  gVisor (runsc)    → User-space kernel         → Syscalls interceptados
  Kata Containers   → MicroVM                   → Kernel dedicado por pod
\`\`\`

---

## Comparacao de Runtimes

| Caracteristica | runc | gVisor (runsc) | Kata Containers |
|---------------|------|---------------|----------------|
| Isolamento | Namespaces/cgroups | User-space kernel | MicroVM |
| Performance | Maxima | Moderada (overhead syscall) | Menor (overhead VM) |
| Compatibilidade | Total | Parcial (nem todas syscalls) | Alta |
| Seguranca | Baseline | Alta | Maxima |
| Recursos | Minimo | Baixo-Moderado | Alto (memoria/CPU) |
| Uso ideal | Workloads confiados | Multi-tenant, untrusted code | Maxima isolacao |

---

## gVisor (runsc)

gVisor intercepta syscalls dos containers e as processa em user-space, sem passar pelo kernel do host.

### Como Funciona

\`\`\`text
Container App
    |
    v
  Sentry (user-space kernel)
    |
    v
  Gofer (filesystem I/O)
    |
    v
  Host Kernel (subset limitado de syscalls)
\`\`\`

### Configurando gVisor no containerd

\`\`\`toml
# /etc/containerd/config.toml
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc]
  runtime_type = "io.containerd.runsc.v1"
\`\`\`

\`\`\`bash
# Reiniciar containerd
sudo systemctl restart containerd
\`\`\`

---

## Kata Containers

Kata Containers executa cada pod em uma MicroVM leve com kernel dedicado.

### Configurando Kata no containerd

\`\`\`toml
# /etc/containerd/config.toml
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.kata]
  runtime_type = "io.containerd.kata.v2"
\`\`\`

---

## RuntimeClass

O recurso **RuntimeClass** permite associar pods a runtimes especificos:

\`\`\`yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
\`\`\`

\`\`\`yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: kata
handler: kata
\`\`\`

### Usando RuntimeClass em Pods

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandboxed-pod
spec:
  runtimeClassName: gvisor
  containers:
  - name: app
    image: nginx:1.25-alpine
\`\`\`

### RuntimeClass com Scheduling

\`\`\`yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
scheduling:
  nodeSelector:
    runtime: gvisor
  tolerations:
  - key: runtime
    value: gvisor
    effect: NoSchedule
overhead:
  podFixed:
    memory: "100Mi"
    cpu: "100m"
\`\`\`

Os campos \`scheduling\` e \`overhead\` garantem que:
- Pods com essa RuntimeClass sejam schedulados em nodes com gVisor instalado
- O overhead de recursos da sandbox seja contabilizado

---

## Quando Usar Cada Runtime

| Cenario | Runtime Recomendado |
|---------|-------------------|
| Workloads internos confiados | runc (padrao) |
| Multi-tenant (codigo de terceiros) | gVisor |
| Processamento de dados sensiveis | Kata |
| CI/CD pipelines (builds untrusted) | gVisor |
| Compliance regulatorio (PCI, HIPAA) | Kata |
| Maxima performance | runc |

---

## Limitacoes

### gVisor
- Nem todas as syscalls sao suportadas (~70% coberto)
- Aplicacoes que usam syscalls raras podem falhar
- Overhead em I/O intensivo
- Nao suporta todas as opcoes de rede

### Kata Containers
- Maior consumo de memoria (kernel por pod)
- Tempo de startup maior que runc
- Requer hardware com virtualizacao (VT-x/AMD-V)
- Nested virtualization pode nao funcionar em todos os clouds

---

## Erros Comuns

1. **Nao criar RuntimeClass** — so configurar o runtime no containerd nao basta
2. **gVisor com apps incompativeis** — verificar syscalls necessarias
3. **Kata sem suporte a virtualizacao** — verificar se o node suporta
4. **Nao contabilizar overhead** — gVisor/Kata usam mais recursos
5. **Scheduler sem nodeSelector** — pods podem ser agendados em nodes sem o runtime

---

## Killer.sh Style Challenge

> Configure uma RuntimeClass chamada \`gvisor\` com handler \`runsc\`. Crie um pod que usa essa RuntimeClass e verifique que esta executando com o runtime correto. Compare a lista de processos visiveis entre um pod normal e um pod com gVisor.
`,

  quiz: [
    {
      question: 'Por que containers padrao (runc) nao oferecem isolamento maximo?',
      options: [
        'Containers nao tem isolamento algum',
        'Containers compartilham o kernel do host, vulnerabilidades do kernel afetam todos',
        'Containers nao suportam networking',
        'runc nao usa namespaces'
      ],
      correct: 1,
      explanation: 'Containers padrao usam namespaces e cgroups para isolamento, mas compartilham o kernel do host. Uma vulnerabilidade no kernel pode permitir escape do container.',
      reference: 'Conceito relacionado: Container isolation — kernel compartilhado.'
    },
    {
      question: 'Como o gVisor (runsc) isola containers?',
      options: [
        'Usando VMs leves',
        'Interceptando syscalls em user-space com um kernel proprio',
        'Usando TPM para verificacao',
        'Encriptando a memoria do container'
      ],
      correct: 1,
      explanation: 'gVisor implementa um kernel em user-space (Sentry) que intercepta syscalls dos containers. O container nunca acessa o kernel do host diretamente.',
      reference: 'Conceito relacionado: gVisor — arquitetura.'
    },
    {
      question: 'Qual recurso do Kubernetes permite associar pods a runtimes especificos?',
      options: ['PodSecurityPolicy', 'RuntimeClass', 'SecurityContext', 'PodPreset'],
      correct: 1,
      explanation: 'RuntimeClass e o recurso que mapeia um nome (ex: gvisor) para um handler de runtime (ex: runsc) no container runtime do node.',
      reference: 'Conceito relacionado: RuntimeClass — scheduling de runtime.'
    },
    {
      question: 'Qual a principal vantagem do Kata Containers sobre gVisor?',
      options: [
        'Melhor performance',
        'Kernel dedicado por pod via MicroVM oferece isolamento maximo',
        'Nao requer configuracao',
        'Funciona em qualquer hardware'
      ],
      correct: 1,
      explanation: 'Kata Containers executa cada pod em uma MicroVM com kernel dedicado, oferecendo o maior nivel de isolamento. gVisor usa user-space kernel mas ainda compartilha o kernel do host para algumas operacoes.',
      reference: 'Conceito relacionado: Kata Containers vs gVisor.'
    },
    {
      question: 'Qual campo do Pod spec define qual runtime usar?',
      options: ['spec.runtime', 'spec.runtimeClassName', 'spec.sandboxMode', 'spec.containerRuntime'],
      correct: 1,
      explanation: 'spec.runtimeClassName referencia o nome de um RuntimeClass resource. O scheduler usa essa informacao para agendar o pod em nodes com o runtime correto.',
      reference: 'Conceito relacionado: Pod spec — runtimeClassName.'
    },
    {
      question: 'Qual limitacao principal do gVisor?',
      options: [
        'Nao suporta Linux',
        'Nem todas as syscalls sao suportadas, podendo causar falhas em algumas aplicacoes',
        'Requer hardware especial',
        'Nao funciona com Kubernetes'
      ],
      correct: 1,
      explanation: 'gVisor implementa um subset das syscalls Linux (~70%). Aplicacoes que usam syscalls nao implementadas (como algumas operacoes de rede avancadas) podem falhar.',
      reference: 'Conceito relacionado: gVisor — compatibilidade de syscalls.'
    },
    {
      question: 'O que o campo overhead na RuntimeClass define?',
      options: [
        'O timeout do container',
        'Recursos adicionais consumidos pela sandbox que devem ser contabilizados no scheduling',
        'O custo financeiro do runtime',
        'A versao do runtime'
      ],
      correct: 1,
      explanation: 'O campo overhead.podFixed define CPU e memoria adicionais consumidos pela sandbox (kernel gVisor, MicroVM Kata). O scheduler contabiliza esses recursos ao agendar o pod.',
      reference: 'Conceito relacionado: RuntimeClass — overhead.'
    }
  ],

  flashcards: [
    { front: 'O que e container runtime sandboxing?', back: 'Tecnica que adiciona camadas de isolamento alem de namespaces/cgroups. gVisor usa kernel em user-space, Kata Containers usa MicroVMs. Protege contra vulnerabilidades do kernel do host.' },
    { front: 'Como funciona o gVisor?', back: 'Implementa um kernel em user-space (Sentry) que intercepta syscalls. Gofer gerencia I/O de filesystem. O container nunca acessa diretamente o kernel do host. Handler: runsc.' },
    { front: 'Como funciona o Kata Containers?', back: 'Executa cada pod em uma MicroVM leve com kernel Linux dedicado. Maximo isolamento mas maior overhead de recursos e startup. Requer hardware com virtualizacao.' },
    { front: 'O que e RuntimeClass?', back: 'Recurso K8s que mapeia um nome (ex: gvisor) para um handler de runtime (ex: runsc) no containerd. Pods referenciam via spec.runtimeClassName. Suporta scheduling e overhead.' },
    { front: 'Quando usar gVisor vs Kata vs runc?', back: 'runc: workloads confiados, maxima performance. gVisor: multi-tenant, untrusted code, CI/CD. Kata: maxima isolacao, compliance regulatorio, dados sensiveis.' },
    { front: 'Quais as limitacoes do gVisor?', back: 'Nao implementa todas as syscalls (~70%), overhead em I/O, incompatibilidade com algumas apps. Verificar compatibilidade antes de usar em producao.' },
    { front: 'Como configurar RuntimeClass com node scheduling?', back: 'Usar campo scheduling.nodeSelector para garantir que pods sejam agendados em nodes com o runtime instalado. Tambem usar tolerations se nodes tiverem taints.' }
  ],

  lab: {
    scenario: 'Voce precisa configurar sandbox de runtime para workloads nao confiaveis, isolando-os dos outros pods no cluster.',
    objective: 'Criar RuntimeClass para gVisor e executar pods sandboxed.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Criar RuntimeClass',
        instruction: 'Crie uma RuntimeClass chamada `gvisor` com handler `runsc`.',
        hints: [
          'O recurso e node.k8s.io/v1',
          'O handler deve corresponder ao nome configurado no containerd',
          'RuntimeClass e cluster-scoped (sem namespace)'
        ],
        solution: '```bash\nkubectl apply -f - <<EOF\napiVersion: node.k8s.io/v1\nkind: RuntimeClass\nmetadata:\n  name: gvisor\nhandler: runsc\nEOF\n```',
        verify: '```bash\n# Verificar RuntimeClass criada\nkubectl get runtimeclass gvisor\n# Saida esperada: gvisor   runsc   <age>\n\nkubectl describe runtimeclass gvisor\n# Saida esperada: Handler: runsc\n```'
      },
      {
        title: 'Criar Pod Sandboxed',
        instruction: 'Crie um Pod que usa a RuntimeClass `gvisor` para executar em sandbox.',
        hints: [
          'Use spec.runtimeClassName no pod',
          'Se gVisor nao estiver instalado no node, o pod ficara Pending',
          'Para teste, verifique o runtimeClassName no describe'
        ],
        solution: '```bash\nkubectl apply -f - <<EOF\napiVersion: v1\nkind: Pod\nmetadata:\n  name: sandboxed-app\nspec:\n  runtimeClassName: gvisor\n  containers:\n  - name: app\n    image: nginx:1.25-alpine\n    resources:\n      limits:\n        memory: \"128Mi\"\n        cpu: \"250m\"\nEOF\n```',
        verify: '```bash\n# Verificar pod\nkubectl get pod sandboxed-app -o wide\n# Saida: pode estar Running (se gVisor instalado) ou Pending\n\n# Verificar runtimeClassName\nkubectl get pod sandboxed-app -o jsonpath=\"{.spec.runtimeClassName}\"\n# Saida esperada: gvisor\n\n# Se rodando com gVisor, verificar kernel\nkubectl exec sandboxed-app -- uname -a 2>/dev/null || echo \"Pod nao disponivel\"\n# Com gVisor: kernel mostra versao do gVisor (nao do host)\n```'
      },
      {
        title: 'Comparar Isolamento',
        instruction: 'Compare a visibilidade de processos entre um pod normal e um pod sandboxed.',
        hints: [
          'Um pod normal com hostPID veria processos do host',
          'Um pod sandboxed nao ve processos do host',
          'Use ps aux dentro dos pods'
        ],
        solution: '```bash\n# Pod normal\nkubectl run normal-pod --image=nginx:1.25-alpine --restart=Never\n\n# Comparar processos visiveis\nkubectl exec normal-pod -- ps aux\n# Pod normal: ve apenas processos do container\n\nkubectl exec sandboxed-app -- ps aux 2>/dev/null\n# Pod sandboxed: ve processos via kernel gVisor (se instalado)\n\n# Comparar /proc\nkubectl exec normal-pod -- ls /proc/ | head -20\nkubectl exec sandboxed-app -- ls /proc/ 2>/dev/null | head -20\n```',
        verify: '```bash\n# Verificar que ambos os pods estao criados\nkubectl get pods normal-pod sandboxed-app\n\n# Verificar runtimeClass de cada um\nkubectl get pod normal-pod -o jsonpath=\"{.spec.runtimeClassName}\"\n# Saida esperada: (vazio - usa runc padrao)\n\nkubectl get pod sandboxed-app -o jsonpath=\"{.spec.runtimeClassName}\"\n# Saida esperada: gvisor\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod com RuntimeClass Fica Pending',
      difficulty: 'easy',
      symptom: 'Pod com runtimeClassName configurado fica em estado Pending indefinidamente.',
      diagnosis: '```bash\n# Verificar eventos do pod\nkubectl describe pod <pod-name> | grep -A 10 Events\n\n# Verificar se RuntimeClass existe\nkubectl get runtimeclass\n\n# Verificar se o handler esta configurado nos nodes\nsudo cat /etc/containerd/config.toml | grep -A 3 runsc\n\n# Verificar scheduling da RuntimeClass\nkubectl get runtimeclass <name> -o yaml | grep -A 5 scheduling\n```',
      solution: 'Causas comuns: 1) RuntimeClass nao existe — criar com kubectl apply. 2) Handler nao configurado no containerd do node — instalar gVisor/Kata e configurar. 3) scheduling.nodeSelector nao corresponde a nenhum node — adicionar label nos nodes. 4) Node com taint sem toleration na RuntimeClass.'
    },
    {
      title: 'Aplicacao Falha com gVisor',
      difficulty: 'hard',
      symptom: 'Aplicacao funciona normalmente com runc mas falha com gVisor, retornando erros de syscall ou funcionalidade indisponivel.',
      diagnosis: '```bash\n# Verificar logs do pod\nkubectl logs <pod-name>\n\n# Verificar dmesg do gVisor\nkubectl exec <pod-name> -- dmesg 2>/dev/null\n\n# Testar syscalls especificas\nkubectl exec <pod-name> -- strace -c -p 1 2>/dev/null\n\n# Verificar compatibilidade\n# https://gvisor.dev/docs/user_guide/compatibility/\n```',
      solution: 'gVisor nao implementa todas as syscalls Linux. Solucoes: 1) Verificar compatibilidade em gvisor.dev/docs/user_guide/compatibility. 2) Usar Kata Containers (compatibilidade total) se maxima isolacao for necessaria. 3) Usar runc com seccomp e AppArmor para apps incompativeis com gVisor. 4) Reportar syscall faltante no GitHub do gVisor.'
    }
  ]
};
