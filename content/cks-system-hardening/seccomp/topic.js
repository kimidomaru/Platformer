window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-system-hardening/seccomp'] = {

  theory: `# Seccomp Profiles

## Relevancia no CKS
> O dominio "System Hardening" vale **15%** do CKS. Seccomp restringe quais syscalls um container pode executar, reduzindo a superficie de ataque do kernel. Voce deve saber criar, aplicar e debugar seccomp profiles.

---

## O que e Seccomp?

**Seccomp** (Secure Computing Mode) e um mecanismo do kernel Linux que filtra syscalls. No Kubernetes, seccomp profiles definem quais syscalls um container pode executar.

### Tipos de Profile

| Tipo | Descricao |
|------|-----------|
| **RuntimeDefault** | Profile padrao do container runtime (recomendado) |
| **Localhost** | Profile customizado em arquivo JSON no node |
| **Unconfined** | Sem restricao (inseguro, bloqueado pelo PSS Restricted) |

---

## Aplicando Seccomp via SecurityContext

### RuntimeDefault (recomendado como baseline)

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: nginx:1.25-alpine
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]
\`\`\`

### Profile Customizado (Localhost)

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: custom-seccomp-pod
spec:
  securityContext:
    seccompProfile:
      type: Localhost
      localhostProfile: profiles/my-profile.json
  containers:
  - name: app
    image: nginx:1.25-alpine
\`\`\`

O arquivo deve estar em \`/var/lib/kubelet/seccomp/profiles/my-profile.json\` no node.

---

## Criando Profiles Customizados

### Estrutura do Profile JSON

\`\`\`json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": ["SCMP_ARCH_X86_64"],
  "syscalls": [
    {
      "names": ["read", "write", "open", "close", "stat", "fstat",
                "mmap", "mprotect", "munmap", "brk", "ioctl",
                "access", "pipe", "select", "sched_yield",
                "socket", "connect", "accept", "sendto", "recvfrom",
                "bind", "listen", "clone", "execve", "exit",
                "exit_group", "futex", "epoll_wait", "epoll_ctl"],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
\`\`\`

### Acoes Disponiveis

| Acao | Comportamento |
|------|---------------|
| **SCMP_ACT_ALLOW** | Permitir a syscall |
| **SCMP_ACT_ERRNO** | Bloquear e retornar erro (recomendado como default) |
| **SCMP_ACT_KILL** | Matar o processo imediatamente |
| **SCMP_ACT_KILL_PROCESS** | Matar o processo (nao so a thread) |
| **SCMP_ACT_LOG** | Permitir mas registrar no audit log |
| **SCMP_ACT_TRACE** | Notificar tracer (debug) |

### Profile Audit-Only (para descobrir quais syscalls a app usa)

\`\`\`json
{
  "defaultAction": "SCMP_ACT_LOG",
  "syscalls": [
    {
      "names": ["read", "write", "exit", "exit_group"],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
\`\`\`

---

## Seccomp com Kubernetes Security Profiles Operator

O **Security Profiles Operator** (SPO) permite gerenciar seccomp profiles como recursos Kubernetes:

\`\`\`yaml
apiVersion: security-profiles-operator.x-k8s.io/v1beta1
kind: SeccompProfile
metadata:
  name: nginx-profile
  namespace: default
spec:
  defaultAction: SCMP_ACT_ERRNO
  syscalls:
  - action: SCMP_ACT_ALLOW
    names:
    - read
    - write
    - open
    - close
    - socket
    - bind
    - listen
    - accept4
    - epoll_create1
    - epoll_ctl
    - epoll_wait
\`\`\`

### Gerando Profiles com ProfileRecording

\`\`\`yaml
apiVersion: security-profiles-operator.x-k8s.io/v1alpha1
kind: ProfileRecording
metadata:
  name: nginx-recording
spec:
  kind: SeccompProfile
  recorder: logs
  podSelector:
    matchLabels:
      app: nginx
\`\`\`

Apos rodar o workload, o SPO gera automaticamente um SeccompProfile com as syscalls observadas.

---

## Seccomp e Pod Security Standards

| Nivel PSS | Requisito Seccomp |
|-----------|------------------|
| **Privileged** | Sem requisito |
| **Baseline** | Nao pode ser Unconfined (v1.25+) |
| **Restricted** | Deve ser RuntimeDefault ou Localhost |

---

## Comandos Essenciais

\`\`\`bash
# Verificar seccomp profile de um pod
kubectl get pod <pod> -o jsonpath='{.spec.securityContext.seccompProfile}'
kubectl get pod <pod> -o jsonpath='{.spec.containers[0].securityContext.seccompProfile}'

# Listar profiles disponíveis no node
ls /var/lib/kubelet/seccomp/

# Verificar se o runtime suporta seccomp
crictl info | grep -i seccomp

# Ver syscalls bloqueadas (audit log)
grep SECCOMP /var/log/audit/audit.log
dmesg | grep -i seccomp

# Aplicar profile via annotation (legado, pre-v1.19)
# NAO usar — usar securityContext.seccompProfile
\`\`\`

---

## Erros Comuns no CKS

1. **Colocar profile JSON no path errado** — deve ser em /var/lib/kubelet/seccomp/ no node
2. **Esquecer que Localhost precisa do arquivo no node** — nao e no pod ou no control plane
3. **Confundir RuntimeDefault com Unconfined** — RuntimeDefault aplica o profile padrao do runtime, Unconfined nao aplica nenhum
4. **Nao saber que annotations de seccomp sao legado** — usar securityContext.seccompProfile (GA desde v1.19)
5. **defaultAction ALLOW demais** — use SCMP_ACT_ERRNO como default e ALLOW apenas as syscalls necessarias
`,

  quiz: [
    {
      question: 'Qual tipo de seccomp profile e recomendado como baseline para a maioria dos workloads?',
      options: ['Unconfined', 'RuntimeDefault', 'Localhost', 'Audit'],
      correct: 1,
      explanation: 'RuntimeDefault aplica o profile padrao do container runtime, que bloqueia syscalls perigosas enquanto permite as mais comuns. E o tipo recomendado e exigido pelo PSS Restricted.',
      reference: 'RuntimeDefault = padrao do runtime. Localhost = customizado. Unconfined = sem restricao (inseguro).'
    },
    {
      question: 'Em qual diretorio do node devem ser colocados seccomp profiles customizados (Localhost)?',
      options: ['/etc/seccomp/', '/var/lib/kubelet/seccomp/', '/opt/kubernetes/seccomp/', '/etc/kubernetes/seccomp/'],
      correct: 1,
      explanation: 'Profiles Localhost devem estar em /var/lib/kubelet/seccomp/ no node. O path no Pod spec e relativo a esse diretorio.',
      reference: 'Path: /var/lib/kubelet/seccomp/<localhostProfile>. Deve existir em cada node que rodar o pod.'
    },
    {
      question: 'Qual acao seccomp bloqueia a syscall e retorna erro ao processo (recomendada como defaultAction)?',
      options: ['SCMP_ACT_KILL', 'SCMP_ACT_ALLOW', 'SCMP_ACT_ERRNO', 'SCMP_ACT_LOG'],
      correct: 2,
      explanation: 'SCMP_ACT_ERRNO bloqueia a syscall e retorna um erro, permitindo que o processo lide com o erro gracefully. SCMP_ACT_KILL mata o processo, o que pode causar falhas inesperadas.',
      reference: 'ERRNO = bloqueia com erro (recomendado). KILL = mata processo. LOG = permite e loga. ALLOW = permite.'
    },
    {
      question: 'O nivel Restricted do PSS exige qual configuracao de seccomp?',
      options: ['seccompProfile.type: Unconfined', 'seccompProfile.type: RuntimeDefault ou Localhost', 'Nenhuma configuracao necessaria', 'seccompProfile.type: Audit'],
      correct: 1,
      explanation: 'O PSS Restricted exige seccompProfile.type RuntimeDefault ou Localhost. Unconfined e bloqueado. Isso garante que syscalls perigosas sejam filtradas em todos os pods de producao.',
      reference: 'PSS Restricted: seccomp obrigatorio (RuntimeDefault/Localhost). Baseline: Unconfined bloqueado. Privileged: sem requisito.'
    },
    {
      question: 'Como se especifica um seccomp profile customizado no Pod spec?',
      options: [
        'Usando annotation seccomp.security.alpha.kubernetes.io',
        'Usando securityContext.seccompProfile com type: Localhost e localhostProfile: <path>',
        'Usando a flag --seccomp-profile no kubectl run',
        'Usando um ConfigMap montado em /etc/seccomp'
      ],
      correct: 1,
      explanation: 'Desde v1.19 (GA), seccomp profiles sao configurados via securityContext.seccompProfile com type: Localhost e localhostProfile apontando para o arquivo JSON. Annotations sao legado.',
      reference: 'securityContext.seccompProfile (GA v1.19+). Annotations sao legado — nao usar no CKS.'
    },
    {
      question: 'O que o Security Profiles Operator (SPO) permite fazer?',
      options: [
        'Enforcar Network Policies em todos os namespaces',
        'Gerenciar seccomp profiles como recursos Kubernetes (CRDs) e gerar profiles automaticamente',
        'Substituir o PSA controller no cluster',
        'Escanear imagens de container em busca de vulnerabilidades'
      ],
      correct: 1,
      explanation: 'O SPO permite criar SeccompProfile como CRDs e usar ProfileRecording para gerar profiles automaticamente observando syscalls de um workload real.',
      reference: 'SPO: SeccompProfile (CRD) + ProfileRecording (gera automaticamente). Substitui gerenciamento manual de JSON.'
    },
    {
      question: 'Qual defaultAction deve ser usada em um seccomp profile para mode "audit" (descobrir syscalls necessarias)?',
      options: ['SCMP_ACT_ERRNO', 'SCMP_ACT_KILL', 'SCMP_ACT_LOG', 'SCMP_ACT_ALLOW'],
      correct: 2,
      explanation: 'SCMP_ACT_LOG permite a syscall mas registra no audit log. Ideal para fase de descoberta — rode o workload, analise o log e crie um profile restritivo baseado nas syscalls observadas.',
      reference: 'Fluxo: LOG (descoberta) -> analise audit log -> crie profile com ERRNO + ALLOW seletivo.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os 3 tipos de seccomp profile no Kubernetes?', back: 'RuntimeDefault (profile padrao do runtime, recomendado), Localhost (JSON customizado em /var/lib/kubelet/seccomp/), Unconfined (sem restricao, inseguro, bloqueado pelo PSS Restricted).' },
    { front: 'Onde ficam os seccomp profiles Localhost no node?', back: '/var/lib/kubelet/seccomp/. O campo localhostProfile no Pod spec e relativo a esse diretorio. Ex: localhostProfile: profiles/my-profile.json -> /var/lib/kubelet/seccomp/profiles/my-profile.json' },
    { front: 'Qual a diferenca entre SCMP_ACT_ERRNO e SCMP_ACT_KILL?', back: 'ERRNO: bloqueia a syscall e retorna erro ao processo (recomendado como defaultAction). KILL: mata o processo/thread imediatamente. ERRNO permite que o app lide com o erro gracefully.' },
    { front: 'Como aplicar RuntimeDefault seccomp em um Pod?', back: 'spec.securityContext.seccompProfile.type: RuntimeDefault. Pode ser no nivel do Pod (spec.securityContext) ou do container (spec.containers[].securityContext).' },
    { front: 'O que e o Security Profiles Operator?', back: 'Operator que permite gerenciar seccomp profiles como CRDs (SeccompProfile) e gerar profiles automaticamente via ProfileRecording, observando syscalls de um workload real.' },
    { front: 'Seccomp vs AppArmor: qual a diferenca?', back: 'Seccomp filtra SYSCALLS especificas (ex: open, socket, execve). AppArmor controla ACESSO a recursos (arquivos, rede, capabilities). Sao complementares — seccomp e mais granular no nivel de syscalls, AppArmor e mais granular no nivel de paths.' },
    { front: 'Como debugar seccomp blocks?', back: 'Verificar audit log: grep SECCOMP /var/log/audit/audit.log ou dmesg | grep seccomp. Mostra qual syscall foi bloqueada, PID e processo. Usar SCMP_ACT_LOG para modo audit (permitir + logar).' }
  ],

  lab: {
    scenario: 'Voce deve aplicar seccomp profiles para restringir syscalls em containers de producao.',
    objective: 'Criar e aplicar seccomp profiles RuntimeDefault e customizados, e verificar que syscalls perigosas sao bloqueadas.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Aplicar RuntimeDefault seccomp profile',
        instruction: 'Crie um Pod com seccomp RuntimeDefault e verifique que ele roda normalmente.',
        hints: ['Use securityContext.seccompProfile.type: RuntimeDefault', 'Aplique no nivel do Pod spec'],
        solution: '```bash\nkubectl apply -f - <<EOF\napiVersion: v1\nkind: Pod\nmetadata:\n  name: seccomp-default\nspec:\n  securityContext:\n    seccompProfile:\n      type: RuntimeDefault\n    runAsNonRoot: true\n    runAsUser: 1000\n  containers:\n  - name: app\n    image: nginx:1.25-alpine\n    securityContext:\n      allowPrivilegeEscalation: false\n      capabilities:\n        drop: [\"ALL\"]\nEOF\n```',
        verify: '```bash\nkubectl get pod seccomp-default\n# STATUS deve ser Running\n\nkubectl get pod seccomp-default -o jsonpath=\'{.spec.securityContext.seccompProfile.type}\'\n# Deve retornar: RuntimeDefault\n```'
      },
      {
        title: 'Criar e aplicar seccomp profile customizado',
        instruction: 'Crie um profile JSON que permite apenas syscalls basicas e aplique-o a um Pod.',
        hints: ['O arquivo deve estar em /var/lib/kubelet/seccomp/ no node', 'Use type: Localhost no Pod spec'],
        solution: '```bash\n# No node (via SSH ou kubectl debug node)\nmkdir -p /var/lib/kubelet/seccomp/profiles\n\ncat > /var/lib/kubelet/seccomp/profiles/restricted.json <<EOF\n{\n  "defaultAction": "SCMP_ACT_ERRNO",\n  "syscalls": [\n    {\n      "names": ["read","write","open","openat","close","stat","fstat","lstat",\n                "poll","lseek","mmap","mprotect","munmap","brk","ioctl",\n                "access","pipe","dup","dup2","socket","connect","accept",\n                "sendto","recvfrom","bind","listen","clone","execve",\n                "exit","exit_group","wait4","kill","getpid","getuid",\n                "getgid","geteuid","getegid","epoll_create1","epoll_ctl",\n                "epoll_wait","futex","set_robust_list","nanosleep",\n                "clock_gettime","sched_yield","sigaltstack","rt_sigaction",\n                "rt_sigprocmask","rt_sigreturn","arch_prctl","set_tid_address",\n                "newfstatat","getrandom","pread64","pwrite64","writev",\n                "setsockopt","getsockopt","fcntl","flock","madvise"\n              ],\n      "action": "SCMP_ACT_ALLOW"\n    }\n  ]\n}\nEOF\n\n# Criar Pod com profile customizado\nkubectl apply -f - <<EOF\napiVersion: v1\nkind: Pod\nmetadata:\n  name: seccomp-custom\nspec:\n  securityContext:\n    seccompProfile:\n      type: Localhost\n      localhostProfile: profiles/restricted.json\n  containers:\n  - name: app\n    image: alpine\n    command: [\"sh\", \"-c\", \"echo seccomp working && sleep 3600\"]\nEOF\n```',
        verify: '```bash\nkubectl get pod seccomp-custom\n# STATUS deve ser Running\n\nkubectl get pod seccomp-custom -o jsonpath=\'{.spec.securityContext.seccompProfile}\'\n# Deve retornar: {\"localhostProfile\":\"profiles/restricted.json\",\"type\":\"Localhost\"}\n```'
      },
      {
        title: 'Verificar que syscalls perigosas sao bloqueadas',
        instruction: 'Tente executar operacoes que usam syscalls bloqueadas dentro do container com profile customizado.',
        hints: ['Tente montar filesystem ou usar ptrace', 'Verifique os logs de auditoria para ver blocks'],
        solution: '```bash\n# Tentar operacao que requer syscall bloqueada\nkubectl exec seccomp-custom -- unshare -r whoami 2>&1\n# Deve falhar com "Operation not permitted" (unshare usa syscalls bloqueadas)\n\n# Verificar no node\nssh <node> \"dmesg | grep -i seccomp | tail -5\"\n# Ou\nssh <node> \"grep SECCOMP /var/log/audit/audit.log | tail -5\"\n\n# Limpar\nkubectl delete pod seccomp-default seccomp-custom\n```',
        verify: '```bash\n# O comando unshare deve ter falhado\nkubectl exec seccomp-custom -- unshare -r whoami 2>&1 | grep -i \"not permitted\\|denied\\|error\"\n# Deve retornar mensagem de erro\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod em CrashLoopBackOff apos aplicar seccomp profile',
      difficulty: 'medium',
      symptom: 'Apos aplicar um seccomp profile Localhost customizado, o Pod entra em CrashLoopBackOff. Os logs mostram "operation not permitted" ou o container simplesmente morre.',
      diagnosis: '```bash\n# Verificar logs do pod\nkubectl logs <pod> --previous\n\n# Verificar eventos\nkubectl describe pod <pod>\n\n# No node, verificar audit log para ver quais syscalls foram bloqueadas\ndmesg | grep -i seccomp\ngrep SECCOMP /var/log/audit/audit.log | tail -20\n\n# O audit log mostra: syscall=<numero> que foi bloqueada\n# Usar ausyscall para traduzir numero para nome:\nausyscall <numero>\n```',
      solution: '**Causa: o profile bloqueia syscalls necessarias para o container funcionar.**\n\n**Solucao 1 — Usar profile audit primeiro:**\n```json\n{"defaultAction": "SCMP_ACT_LOG"}\n```\nRode o workload, analise quais syscalls sao usadas, e adicione ao ALLOW.\n\n**Solucao 2 — Adicionar syscalls faltantes ao profile:**\n```bash\n# Identificar syscalls bloqueadas\ngrep SECCOMP /var/log/audit/audit.log | awk \'{print $NF}\' | sort -u\n# Adicionar ao array "names" do profile\n```\n\n**Solucao 3 — Usar RuntimeDefault como baseline:**\n```yaml\nseccompProfile:\n  type: RuntimeDefault\n```'
    },
    {
      title: 'Profile Localhost nao encontrado — pod falha ao iniciar',
      difficulty: 'easy',
      symptom: 'Pod com seccomp type: Localhost nao inicia. Evento mostra: "failed to generate security options: cannot load seccomp profile".',
      diagnosis: '```bash\nkubectl describe pod <pod> | grep -A5 Events\n# Evento: cannot load seccomp profile\n\n# Verificar se o arquivo existe no node correto\nkubectl get pod <pod> -o jsonpath=\'{.spec.nodeName}\'\nssh <node> \"ls -la /var/lib/kubelet/seccomp/<localhostProfile>\"\n```',
      solution: '**Causas comuns:**\n1. Arquivo nao existe no node onde o pod foi agendado\n2. Path incorreto no localhostProfile\n3. JSON com sintaxe invalida\n\n**Correcoes:**\n```bash\n# Copiar profile para o node correto\nscp profile.json <node>:/var/lib/kubelet/seccomp/profiles/\n\n# Verificar JSON valido\npython3 -m json.tool /var/lib/kubelet/seccomp/profiles/my-profile.json\n\n# Verificar path no pod spec\nkubectl get pod <pod> -o jsonpath=\'{.spec.securityContext.seccompProfile.localhostProfile}\'\n# Deve ser relativo a /var/lib/kubelet/seccomp/\n```'
    }
  ]
};
