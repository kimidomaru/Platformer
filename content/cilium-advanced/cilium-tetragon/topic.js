window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cilium-advanced/cilium-tetragon'] = {
  theory: `# Tetragon: Runtime Security & Observability com eBPF

## Relevancia
> **Tetragon** e o componente de **runtime security** da familia Cilium (projeto CNCF, originado na Isovalent). Usa **eBPF** para observar — e opcionalmente **bloquear** — eventos no nivel do kernel: execucao de processos, acesso a arquivos, atividade de rede e syscalls, com contexto completo de Kubernetes (pod, container, labels). E o que falta na maioria das stacks: visibilidade e enforcement em tempo de execucao com overhead minimo.

## Por que eBPF para runtime security?

Ferramentas tradicionais de seguranca rodam em user-space e coletam eventos com polling ou via auditd — alto overhead e fáceis de burlar. O Tetragon roda **no kernel via eBPF**:

- **Baixo overhead** — sem context-switch por evento; filtragem acontece no kernel.
- **Inviolavel pelo processo observado** — o programa eBPF roda fora do alcance do workload.
- **Contexto rico** — correlaciona o evento (PID, binario, args) com o Pod/container/namespace do Kubernetes automaticamente.

> Tetragon funciona **com ou sem** o Cilium como CNI — pode ser instalado standalone em qualquer cluster.

## O que o Tetragon observa

\`\`\`
┌───────────────────────────────────────────────┐
│  Process execution  →  exec / exit (full args) │
│  File access        →  open / read / write     │
│  Network activity   →  connect / accept / DNS  │
│  Privileges         →  capabilities, setuid    │
│  Syscalls           →  qualquer syscall         │
└───────────────────────────────────────────────┘
        observado por eBPF, enriquecido com
        identidade do Kubernetes (pod/labels)
\`\`\`

## Process Visibility (sem configuracao)

Logo apos instalado, o Tetragon ja emite eventos de **process_exec** e **process_exit** para todo o cluster:

\`\`\`bash
# Instalar via Helm
helm repo add cilium https://helm.cilium.io
helm install tetragon cilium/tetragon -n kube-system

# Ver eventos em tempo real (CLI tetra dentro do pod)
kubectl exec -n kube-system ds/tetragon -c tetragon -- \\
  tetra getevents -o compact

# Saida tipica (exec de processo com contexto K8s):
# 🚀 process default/xwing /bin/bash
# 🚀 process default/xwing /usr/bin/curl https://evil.com
# 💥 exit    default/xwing /usr/bin/curl 0
\`\`\`

> Cada evento traz: namespace/pod, binario, argumentos, UID, processo pai — pronto para detectar shells interativos, downloads suspeitos, etc.

## TracingPolicy — o coracao do Tetragon

A CRD **TracingPolicy** define **o que observar** e, opcionalmente, **o que fazer** (enforcement). Exemplo: monitorar acesso a arquivos sensiveis.

\`\`\`yaml
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: monitor-sensitive-files
spec:
  kprobes:
    - call: "security_file_permission"
      syscall: false
      args:
        - index: 0
          type: "file"
        - index: 1
          type: "int"
      selectors:
        - matchArgs:
            - index: 0
              operator: "Prefix"
              values:
                - "/etc/shadow"
                - "/etc/passwd"
            - index: 1
              operator: "Equal"
              values:
                - "4"          # MAY_READ
\`\`\`

\`\`\`bash
kubectl apply -f monitor-sensitive-files.yaml

# Agora qualquer leitura de /etc/shadow gera um evento:
# 📂 default/web-pod /bin/cat /etc/shadow
\`\`\`

## Enforcement: do observar para o bloquear

O grande diferencial: o Tetragon nao so observa — ele pode **matar o processo** no kernel, em linha (antes do syscall retornar), via a acao \`Sigkill\` ou \`Override\`:

\`\`\`yaml
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: block-shell-in-prod
spec:
  kprobes:
    - call: "security_bprm_creds_from_file"
      syscall: false
      args:
        - index: 1
          type: "file"
      selectors:
        - matchBinaries:
            - operator: "In"
              values:
                - "/bin/bash"
                - "/bin/sh"
          matchActions:
            - action: Sigkill     # mata o processo imediatamente
\`\`\`

| Acao | Efeito |
|------|--------|
| \`Post\` | apenas emite o evento (observabilidade) |
| \`Sigkill\` | mata o processo no kernel (enforcement) |
| \`Override\` | faz o syscall retornar um erro (ex.: -EPERM) sem matar |
| \`NotifyEnforcer\` | sinaliza o enforcer para acoes combinadas |

> **Enforcement sincrono no kernel** = nao ha janela de corrida (TOCTOU) entre detectar e agir, ao contrario de solucoes que reagem em user-space depois do fato.

## Filtros (selectors) — precisao sem ruido

Os \`selectors\` filtram no kernel para reduzir volume e focar no relevante:

| matchX | Filtra por |
|--------|-----------|
| \`matchBinaries\` | caminho do executavel |
| \`matchArgs\` | argumentos do syscall (path, flags...) |
| \`matchPIDs\` | PID / namespace de PID |
| \`matchNamespaces\` | namespaces do kernel |
| \`matchCapabilities\` | capabilities do processo |
| \`matchNamespaceChanges\` | mudanca de namespace (container escape!) |

## Casos de uso classicos

\`\`\`yaml
# 1. Detectar shell interativo dentro de um container (reverse shell)
#    -> matchBinaries In [/bin/bash,/bin/sh] + action Post/Sigkill

# 2. Detectar escrita em binarios do sistema (/usr/bin, /sbin)
#    -> kprobe em security_file_permission + matchArgs Prefix /usr/bin

# 3. Detectar mudanca de namespace (tentativa de container escape)
#    -> matchNamespaceChanges

# 4. Detectar uso de capabilities perigosas (CAP_SYS_ADMIN)
#    -> matchCapabilities
\`\`\`

## Tetragon vs Falco

| | Falco | Tetragon |
|---|-------|----------|
| Mecanismo | eBPF ou kernel module | eBPF (CO-RE) |
| Enforcement | nao (so alerta) | **sim** (Sigkill/Override no kernel) |
| Contexto K8s | sim | sim (nativo, via identidade Cilium) |
| Linguagem de regra | Falco Rules (YAML/condicoes) | TracingPolicy (kprobes/selectors) |
| Integracao | CNCF, ecossistema amplo | familia Cilium/Hubble |

> Resumo: Falco e excelente para **deteccao** baseada em regras prontas; Tetragon brilha quando voce quer **enforcement sincrono** e correlacao profunda com a stack Cilium.

## Observabilidade e exportacao

\`\`\`bash
# Eventos em JSON (para SIEM/pipeline)
kubectl exec -n kube-system ds/tetragon -c tetragon -- \\
  tetra getevents -o json | jq .

# Tetragon expoe metricas Prometheus
kubectl get svc -n kube-system tetragon -o yaml | grep -i metrics
# scrape de tetragon_events_total, etc.
\`\`\`

## Erros Comuns

1. **Esperar enforcement sem \`matchActions\`** — sem a acao \`Sigkill\`/\`Override\`, a policy so observa.
2. **Kernel sem BTF** — Tetragon usa CO-RE; kernels muito antigos sem BTF exigem configuracao extra.
3. **Filtros largos demais** — sem \`selectors\` precisos, o volume de eventos explode.
4. **Confundir kprobe com tracepoint** — \`syscall: true\` para syscalls; \`syscall: false\` para funcoes internas do kernel (kprobes).
5. **Assumir que precisa do Cilium CNI** — Tetragon roda standalone.

## Killer.sh Style Challenge

> Em um cluster com Tetragon instalado:
>
> 1. Crie uma TracingPolicy que **observe** qualquer execucao de \`/bin/bash\` ou \`/bin/sh\` nos Pods do namespace \`production\`.
> 2. Gere um evento: \`kubectl exec\` em um pod de \`production\` rodando \`sh\`.
> 3. Confirme o evento com \`tetra getevents -o compact\`.
> 4. Evolua a policy para **bloquear** (Sigkill) a execucao de shells e valide que o \`kubectl exec ... sh\` agora e morto.
>
> Dica: \`matchBinaries\` + \`matchActions: [{action: Post}]\` primeiro; depois troque para \`Sigkill\`.
`,

  quiz: [
    {
      question: 'Qual e a principal capacidade que diferencia o Tetragon de ferramentas de deteccao como o Falco?',
      options: [
        'Tetragon usa kernel modules em vez de eBPF',
        'Tetragon pode fazer enforcement sincrono no kernel (Sigkill/Override), nao apenas alertar',
        'Tetragon so funciona com o Cilium CNI instalado',
        'Tetragon nao tem contexto de Kubernetes'
      ],
      correct: 1,
      explanation: 'Ambos observam via eBPF com contexto K8s, mas o Tetragon pode AGIR no proprio kernel — matar o processo (Sigkill) ou forcar o syscall a retornar erro (Override) de forma sincrona, eliminando a janela TOCTOU. Falco foca em deteccao/alerta. E Tetragon roda standalone, sem exigir o Cilium como CNI.',
      reference: 'Secao Enforcement e Tetragon vs Falco.'
    },
    {
      question: 'Qual CRD o Tetragon usa para definir o que observar e quais acoes tomar?',
      options: [
        'CiliumNetworkPolicy',
        'FalcoRule',
        'TracingPolicy',
        'AuditPolicy'
      ],
      correct: 2,
      explanation: 'A TracingPolicy (apiVersion cilium.io/v1alpha1) define kprobes/tracepoints, os args observados, os selectors (filtros no kernel) e os matchActions (Post, Sigkill, Override). E o ponto central de configuracao do Tetragon.',
      reference: 'Secao TracingPolicy.'
    },
    {
      question: 'Em uma TracingPolicy, o que acontece se voce define os selectors mas NAO inclui matchActions?',
      options: [
        'A policy e rejeitada pelo API server',
        'O processo e bloqueado por padrao',
        'A policy apenas observa e emite eventos (sem enforcement)',
        'Todos os syscalls do cluster sao bloqueados'
      ],
      correct: 2,
      explanation: 'Sem matchActions com uma acao de enforcement (Sigkill/Override), a TracingPolicy funciona em modo observabilidade: gera eventos quando o filtro casa, mas nao interfere no processo. Para bloquear, e preciso adicionar explicitamente matchActions com Sigkill ou Override.',
      reference: 'Secao Enforcement e Erros Comuns (item 1).'
    },
    {
      question: 'Qual selector e mais adequado para detectar uma tentativa de container escape via mudanca de namespace?',
      options: [
        'matchBinaries',
        'matchArgs',
        'matchNamespaceChanges',
        'matchCapabilities'
      ],
      correct: 2,
      explanation: 'matchNamespaceChanges detecta quando um processo muda de namespace do kernel — um sinal classico de tentativa de escapar do isolamento do container. matchBinaries filtra por executavel, matchArgs por argumentos e matchCapabilities por capabilities.',
      reference: 'Secao Filtros (selectors) e Casos de uso.'
    },
    {
      question: 'Por que o enforcement do Tetragon no kernel evita a condicao de corrida (TOCTOU) comum em solucoes user-space?',
      options: [
        'Porque ele roda como DaemonSet',
        'Porque a acao (ex.: Sigkill) acontece em linha, no kernel, antes do syscall retornar — nao ha intervalo entre detectar e agir',
        'Porque usa polling de alta frequencia',
        'Porque desabilita o syscall globalmente'
      ],
      correct: 1,
      explanation: 'Solucoes user-space detectam o evento depois que o syscall ja ocorreu e reagem com atraso (TOCTOU = Time Of Check to Time Of Use). O Tetragon executa a acao dentro do hook eBPF no kernel, de forma sincrona, fechando essa janela.',
      reference: 'Secao Enforcement.'
    },
    {
      question: 'Tetragon requer o Cilium instalado como CNI para funcionar?',
      options: [
        'Sim, e um componente embutido no agente Cilium',
        'Nao, pode ser instalado standalone em qualquer cluster Kubernetes',
        'Sim, depende das identidades do Cilium para gerar eventos',
        'Apenas em clusters com kube-proxy replacement'
      ],
      correct: 1,
      explanation: 'Embora faca parte da familia Cilium e integre bem com Hubble, o Tetragon e independente: pode ser instalado via Helm como DaemonSet em qualquer cluster, com ou sem o Cilium como CNI. Ele obtem contexto K8s via watch da API, nao exclusivamente das identidades do Cilium.',
      reference: 'Secao Por que eBPF e Erros Comuns (item 5).'
    },
    {
      question: 'Logo apos instalar o Tetragon, sem nenhuma TracingPolicy, quais eventos ele ja emite por padrao?',
      options: [
        'Nenhum — tudo exige TracingPolicy',
        'Apenas eventos de rede',
        'process_exec e process_exit (execucao/saida de processos) com contexto K8s',
        'Somente acessos a /etc/shadow'
      ],
      correct: 2,
      explanation: 'O Tetragon ja fornece visibilidade de execucao de processos (process_exec/process_exit) out-of-the-box, com pod, container, binario, args e UID. TracingPolicies adicionam observacao/enforcement de coisas especificas (arquivos, syscalls, capabilities).',
      reference: 'Secao Process Visibility.'
    }
  ],

  flashcards: [
    {
      front: 'O que e o Tetragon e por que usa eBPF?',
      back: 'Componente de **runtime security & observability** da familia Cilium (CNCF).\n\nUsa **eBPF** para observar (e opcionalmente bloquear) eventos no kernel: exec de processos, acesso a arquivos, rede, syscalls, capabilities.\n\nVantagens do eBPF:\n- baixo overhead (filtra no kernel)\n- inviolavel pelo workload observado\n- contexto K8s rico (pod/labels)\n\nRoda **standalone**, com ou sem o Cilium CNI.'
    },
    {
      front: 'TracingPolicy — estrutura essencial',
      back: '```yaml\napiVersion: cilium.io/v1alpha1\nkind: TracingPolicy\nspec:\n  kprobes:\n    - call: "security_file_permission"\n      syscall: false\n      args: [...]\n      selectors:\n        - matchArgs: [...]      # filtro no kernel\n          matchActions:\n            - action: Sigkill    # enforcement\n```\n\n`syscall: true` para syscalls; `false` para funcoes internas (kprobes). Sem `matchActions` = so observa.'
    },
    {
      front: 'Acoes (matchActions) do Tetragon',
      back: '| Acao | Efeito |\n|------|--------|\n| **Post** | so emite o evento (observabilidade) |\n| **Sigkill** | mata o processo no kernel (enforcement) |\n| **Override** | faz o syscall retornar erro (ex.: -EPERM) |\n| **NotifyEnforcer** | sinaliza o enforcer |\n\nEnforcement e **sincrono no kernel** = sem janela TOCTOU.'
    },
    {
      front: 'Selectors do Tetragon — para que servem?',
      back: 'Filtram eventos no kernel (precisao + menos ruido):\n\n- **matchBinaries** — caminho do executavel\n- **matchArgs** — args do syscall (path/flags)\n- **matchPIDs** — PID / pid namespace\n- **matchCapabilities** — capabilities do processo\n- **matchNamespaceChanges** — mudanca de namespace (container escape!)\n\nFiltrar bem evita explosao de volume de eventos.'
    },
    {
      front: 'Tetragon vs Falco',
      back: '**Falco** — deteccao por regras (Falco Rules), so alerta, ecossistema CNCF amplo, eBPF ou kernel module.\n\n**Tetragon** — eBPF CO-RE, **enforcement sincrono** (Sigkill/Override), TracingPolicy (kprobes/selectors), integra com Cilium/Hubble.\n\nFalco = deteccao pronta; Tetragon = bloqueio + correlacao profunda com a stack Cilium.'
    },
    {
      front: 'Como ver eventos do Tetragon?',
      back: '```bash\n# Compacto (legivel)\nkubectl exec -n kube-system ds/tetragon -c tetragon -- \\\n  tetra getevents -o compact\n\n# JSON (para SIEM)\n... tetra getevents -o json | jq .\n```\n\nSimbolos: 🚀 exec, 💥 exit, 📂 file. Cada evento traz pod, binario, args, UID. Tetragon tambem expoe metricas Prometheus.'
    },
    {
      front: '4 casos de uso classicos de TracingPolicy',
      back: '1. **Reverse shell** — matchBinaries In [/bin/bash,/bin/sh] + Sigkill.\n2. **Escrita em binarios do sistema** — kprobe security_file_permission + matchArgs Prefix /usr/bin.\n3. **Container escape** — matchNamespaceChanges.\n4. **Capabilities perigosas** — matchCapabilities (ex.: CAP_SYS_ADMIN).'
    }
  ],

  lab: {
    scenario: 'Instalar o Tetragon, observar execucao de processos out-of-the-box, criar uma TracingPolicy para detectar shells e depois evoluir para enforcement com Sigkill.',
    objective: 'Entender o fluxo observar -> filtrar -> bloquear do Tetragon usando TracingPolicy e a CLI tetra.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Instalar Tetragon e ver eventos de processo',
        instruction: 'Instale o Tetragon via Helm e observe os eventos de exec/exit gerados por um Pod de teste.',
        hints: ['tetra getevents -o compact', 'O DaemonSet roda em kube-system'],
        solution: `\`\`\`bash
helm repo add cilium https://helm.cilium.io
helm install tetragon cilium/tetragon -n kube-system

kubectl rollout status ds/tetragon -n kube-system

# Pod de teste
kubectl run xwing --image=cilium/json-mock

# Acompanhar eventos (em outro terminal)
kubectl exec -n kube-system ds/tetragon -c tetragon -- \\
  tetra getevents -o compact &

# Gerar atividade
kubectl exec xwing -- bash -c "curl -s https://example.com >/dev/null"
\`\`\``,
        verify: `\`\`\`bash
kubectl get ds tetragon -n kube-system
# Esperado: DESIRED = READY (1 por node)

# Nos eventos compact deve aparecer algo como:
# 🚀 process default/xwing /usr/bin/curl https://example.com
\`\`\``
      },
      {
        title: 'TracingPolicy de observacao (detectar shells)',
        instruction: 'Crie uma TracingPolicy que emita evento quando /bin/bash ou /bin/sh forem executados.',
        hints: ['matchBinaries com operator In', 'action: Post = so observa'],
        solution: `\`\`\`bash
cat <<'EOF' | kubectl apply -f -
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: monitor-shell
spec:
  kprobes:
    - call: "security_bprm_creds_from_file"
      syscall: false
      args:
        - index: 1
          type: "file"
      selectors:
        - matchBinaries:
            - operator: "In"
              values:
                - "/bin/bash"
                - "/bin/sh"
          matchActions:
            - action: Post
EOF

# Gerar um shell
kubectl exec xwing -- sh -c "echo hello"
\`\`\``,
        verify: `\`\`\`bash
kubectl get tracingpolicy monitor-shell
# Esperado: a policy listada

# Nos eventos deve aparecer o exec de /bin/sh no pod xwing
kubectl exec -n kube-system ds/tetragon -c tetragon -- \\
  tetra getevents -o compact | grep -m1 'sh'
\`\`\``
      },
      {
        title: 'Evoluir para enforcement (Sigkill)',
        instruction: 'Altere a policy para matar shells com Sigkill e confirme que o exec e bloqueado.',
        hints: ['Trocar action Post por Sigkill', 'O kubectl exec deve falhar/morrer'],
        solution: `\`\`\`bash
cat <<'EOF' | kubectl apply -f -
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: monitor-shell
spec:
  kprobes:
    - call: "security_bprm_creds_from_file"
      syscall: false
      args:
        - index: 1
          type: "file"
      selectors:
        - matchBinaries:
            - operator: "In"
              values:
                - "/bin/bash"
                - "/bin/sh"
          matchActions:
            - action: Sigkill
EOF

# Tentar abrir um shell -> deve ser morto
kubectl exec xwing -- sh -c "echo should-not-run" ; echo "exit code: $?"
\`\`\``,
        verify: `\`\`\`bash
# O comando acima deve retornar exit code != 0 (processo morto)
# e o evento deve mostrar a acao de enforcement

# Limpeza
kubectl delete tracingpolicy monitor-shell
kubectl delete pod xwing
helm uninstall tetragon -n kube-system
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'TracingPolicy aplicada mas nenhum evento aparece',
      difficulty: 'medium',
      symptom: 'A TracingPolicy foi criada sem erros, mas tetra getevents nao mostra os eventos esperados quando a condicao deveria casar.',
      diagnosis: `\`\`\`bash
# 1. A policy foi aceita?
kubectl get tracingpolicy
kubectl describe tracingpolicy <nome>

# 2. O agente Tetragon esta saudavel em todos os nodes?
kubectl get ds tetragon -n kube-system
kubectl logs -n kube-system ds/tetragon -c tetragon --tail=50 | grep -i 'error\\|policy'

# 3. O kprobe existe nesse kernel?
# Alguns simbolos variam entre versoes de kernel
kubectl logs -n kube-system ds/tetragon -c tetragon | grep -i 'kprobe\\|symbol'
\`\`\``,
      solution: `**Causas comuns:**

1. **Selector nao casa** — o \`matchArgs\`/\`matchBinaries\` esta estrito demais ou com o path errado. Teste primeiro com um selector mais amplo (so \`matchBinaries\` por exemplo) e refine.

2. **Simbolo de kprobe inexistente no kernel** — \`call:\` aponta para uma funcao que mudou de nome entre versoes. Verifique nos logs do agente e ajuste para o simbolo correto daquele kernel.

3. **Evento no node errado** — o DaemonSet observa por node; confirme que o Pod que gera o evento esta num node com o agente Running.

\`\`\`bash
# Validar com um teste amplo
kubectl exec -n kube-system ds/tetragon -c tetragon -- \\
  tetra getevents -o compact | head
# Se eventos genericos de exec aparecem, o agente esta ok;
# o problema esta no selector da policy.
\`\`\`

**Prevencao:** comece amplo (action: Post) para validar a deteccao antes de estreitar e antes de ligar enforcement.`
    },
    {
      title: 'Tetragon nao inicia: kernel sem BTF / CO-RE',
      difficulty: 'hard',
      symptom: 'Os pods do Tetragon ficam em CrashLoopBackOff. Os logs mencionam BTF nao encontrado, falha ao carregar programas eBPF ou "failed to load BPF".',
      diagnosis: `\`\`\`bash
kubectl logs -n kube-system ds/tetragon -c tetragon --previous | grep -i 'btf\\|bpf\\|CO-RE'

# Verificar se o kernel expoe BTF
ls -l /sys/kernel/btf/vmlinux   # no node
uname -r
\`\`\``,
      solution: `**Causa:** o Tetragon usa **CO-RE** (Compile Once - Run Everywhere), que depende de **BTF** (BPF Type Format) no kernel (\`/sys/kernel/btf/vmlinux\`). Kernels antigos ou builds sem CONFIG_DEBUG_INFO_BTF nao expoem BTF.

**Solucoes:**

1. **Atualizar o kernel** para uma versao com BTF habilitado (recomendado; >= 5.x na maioria das distros).

2. **Fornecer BTF externo** — em kernels sem BTF, e possivel apontar para um arquivo BTF externo correspondente ao kernel (BTFHub), via configuracao do Tetragon:
\`\`\`bash
helm upgrade tetragon cilium/tetragon -n kube-system \\
  --set tetragon.btf=/var/lib/tetragon/btf
\`\`\`

3. **Verificar requisitos** — kernel >= 4.19 para funcionalidades basicas; recursos avancados exigem kernels mais novos.

**Prevencao:** valide \`/sys/kernel/btf/vmlinux\` nos nodes antes de instalar; prefira imagens de node com BTF habilitado.`
    }
  ]
};
