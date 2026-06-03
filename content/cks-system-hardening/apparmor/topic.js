window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-system-hardening/apparmor'] = {

  theory: `# AppArmor Profiles

## Relevancia no CKS
> O dominio "System Hardening" vale **15%** do CKS. AppArmor e um sistema de Mandatory Access Control (MAC) que restringe o que processos podem acessar (arquivos, rede, capabilities). No CKS voce deve saber carregar profiles e aplica-los a Pods.

---

## O que e AppArmor?

**AppArmor** (Application Armor) e um modulo de seguranca do kernel Linux que confina programas a um conjunto limitado de recursos usando profiles.

### AppArmor vs SELinux

| Aspecto | AppArmor | SELinux |
|---------|----------|---------|
| **Modelo** | Path-based (arquivos por caminho) | Label-based (contextos de seguranca) |
| **Complexidade** | Mais simples de configurar | Mais complexo, mais granular |
| **Distros** | Ubuntu, SUSE, Debian | RHEL, CentOS, Fedora |
| **Kubernetes** | Suporte nativo (GA v1.30) | Via SELinux labels no securityContext |

---

## Modos de AppArmor

| Modo | Descricao |
|------|-----------|
| **enforce** | Bloqueia acessos nao permitidos e registra violacoes |
| **complain** | Permite acessos mas registra violacoes (modo auditoria) |
| **unconfined** | Sem restricao |

---

## Aplicando AppArmor no Kubernetes

### Desde v1.30 (GA) — via securityContext

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: apparmor-pod
spec:
  containers:
  - name: app
    image: nginx:1.25-alpine
    securityContext:
      appArmorProfile:
        type: Localhost
        localhostProfile: k8s-nginx-deny-write
\`\`\`

### Tipos de AppArmor Profile

| Tipo | Descricao |
|------|-----------|
| **RuntimeDefault** | Profile padrao do container runtime |
| **Localhost** | Profile customizado carregado no node |
| **Unconfined** | Sem AppArmor (bloqueado pelo PSS Baseline) |

---

## Criando AppArmor Profiles

### Profile que bloqueia escrita em /etc e /proc

\`\`\`
# /etc/apparmor.d/k8s-deny-write
#include <tunables/global>

profile k8s-deny-write flags=(attach_disconnected) {
  #include <abstractions/base>

  # Permitir leitura de tudo
  file,

  # Negar escrita em /etc e /proc
  deny /etc/** w,
  deny /proc/** w,

  # Negar montagem de filesystems
  deny mount,

  # Negar acesso a raw sockets
  deny network raw,
}
\`\`\`

### Profile mais restritivo para nginx

\`\`\`
#include <tunables/global>

profile k8s-nginx flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  #include <abstractions/nameservice>

  # Permitir leitura de arquivos de configuracao
  /etc/nginx/** r,
  /usr/share/nginx/** r,

  # Permitir escrita apenas em areas especificas
  /var/log/nginx/** w,
  /var/cache/nginx/** rw,
  /var/run/nginx.pid rw,
  /tmp/** rw,

  # Negar escrita em todo o resto
  deny /etc/** w,
  deny /root/** rw,
  deny /home/** rw,

  # Rede
  network inet tcp,
  network inet udp,
  deny network raw,

  # Capabilities minimas
  capability net_bind_service,
  capability setuid,
  capability setgid,
  deny capability sys_admin,
  deny capability sys_ptrace,
}
\`\`\`

---

## Gerenciando AppArmor Profiles

### Carregar profile no node

\`\`\`bash
# Copiar profile para o node
scp k8s-deny-write root@<node>:/etc/apparmor.d/

# Carregar o profile
ssh <node> "apparmor_parser -r /etc/apparmor.d/k8s-deny-write"

# Verificar profiles carregados
ssh <node> "aa-status"

# Ou alternativamente
ssh <node> "cat /sys/kernel/security/apparmor/profiles"
\`\`\`

### Comandos AppArmor

\`\`\`bash
# Verificar status do AppArmor no node
aa-status

# Carregar profile em modo enforce
apparmor_parser -r /etc/apparmor.d/<profile>

# Carregar em modo complain (auditoria)
apparmor_parser -C /etc/apparmor.d/<profile>

# Remover profile
apparmor_parser -R /etc/apparmor.d/<profile>

# Gerar profile basico a partir de um binario
aa-genprof /usr/sbin/nginx

# Analisar logs para gerar regras
aa-logprof
\`\`\`

---

## Verificando AppArmor em Pods

\`\`\`bash
# Verificar qual profile esta aplicado em um container
kubectl get pod <pod> -o jsonpath='{.spec.containers[0].securityContext.appArmorProfile}'

# Verificar no node se o profile esta carregado
ssh <node> "aa-status | grep k8s"

# Testar se o profile esta funcionando (executar acao bloqueada)
kubectl exec <pod> -- touch /etc/test-file
# Deve retornar: Permission denied
\`\`\`

---

## Erros Comuns no CKS

1. **Nao carregar o profile no node** — o profile deve ser carregado com apparmor_parser antes de criar o Pod
2. **Profile nao carregado em TODOS os nodes** — se o pod pode ser agendado em qualquer node, o profile deve estar em todos
3. **Confundir AppArmor com seccomp** — AppArmor = acesso a recursos (path-based). Seccomp = syscalls.
4. **Esquecer flags=(attach_disconnected)** — necessario para containers Docker/containerd
5. **Usar annotations em vez de securityContext** — desde v1.30, usar securityContext.appArmorProfile (annotations sao legado)
`,

  quiz: [
    {
      question: 'Qual e a diferenca principal entre AppArmor e seccomp?',
      options: [
        'AppArmor e para Linux, seccomp e para Windows',
        'AppArmor controla acesso a recursos (path-based), seccomp filtra syscalls',
        'AppArmor e mais recente que seccomp',
        'Nao ha diferenca — sao sinonimos'
      ],
      correct: 1,
      explanation: 'AppArmor usa profiles path-based para controlar acesso a arquivos, rede e capabilities. Seccomp filtra syscalls especificas do kernel. Sao complementares.',
      reference: 'AppArmor = path-based access control. Seccomp = syscall filtering. Complementares.'
    },
    {
      question: 'Qual comando carrega um AppArmor profile no modo enforce?',
      options: ['apparmor_parser -C <profile>', 'apparmor_parser -r <profile>', 'aa-enforce <profile>', 'aa-complain <profile>'],
      correct: 1,
      explanation: 'apparmor_parser -r carrega (ou recarrega) o profile no modo enforce. -C carrega em modo complain. aa-enforce e aa-complain alteram o modo de um profile ja carregado.',
      reference: 'apparmor_parser: -r = enforce, -C = complain, -R = remover. aa-status = ver profiles carregados.'
    },
    {
      question: 'Como aplicar um AppArmor profile a um container no Kubernetes v1.30+?',
      options: [
        'Usando annotation container.apparmor.security.beta.kubernetes.io/<container>',
        'Usando securityContext.appArmorProfile com type: Localhost',
        'Usando um ConfigMap com o profile',
        'Usando a flag --apparmor no kubectl run'
      ],
      correct: 1,
      explanation: 'Desde v1.30 (GA), AppArmor profiles sao configurados via securityContext.appArmorProfile no container spec. Annotations sao legado (beta).',
      reference: 'v1.30+: securityContext.appArmorProfile. Pre-v1.30: annotation (beta). Profile deve estar carregado no node.'
    },
    {
      question: 'O que acontece se o AppArmor profile referenciado no Pod nao estiver carregado no node?',
      options: [
        'O Pod roda sem restricao',
        'O Pod falha ao iniciar com erro de profile nao encontrado',
        'O Kubernetes carrega automaticamente o profile',
        'O Pod roda com RuntimeDefault'
      ],
      correct: 1,
      explanation: 'Se o profile nao esta carregado no node, o Pod falha ao iniciar. O kubelet verifica se o profile existe antes de criar o container. O profile deve ser carregado manualmente ou via DaemonSet.',
      reference: 'Profile deve estar carregado (apparmor_parser -r) em cada node onde o pod pode rodar.'
    },
    {
      question: 'Qual modo AppArmor permite acessos mas registra violacoes (util para auditoria)?',
      options: ['enforce', 'complain', 'unconfined', 'disabled'],
      correct: 1,
      explanation: 'O modo complain permite todos os acessos mas registra violacoes no log. Util para fase de descoberta — depois de analisar os logs, migre para enforce.',
      reference: 'complain = auditoria (permite + loga). enforce = bloqueia + loga. unconfined = sem restricao.'
    },
    {
      question: 'Qual flag e necessaria no AppArmor profile para funcionar com containers?',
      options: ['flags=(enforce)', 'flags=(attach_disconnected)', 'flags=(container_mode)', 'flags=(kubernetes)'],
      correct: 1,
      explanation: 'A flag attach_disconnected e necessaria para profiles usados em containers porque containers usam mount namespaces que "desconectam" o root filesystem do host.',
      reference: 'flags=(attach_disconnected) — obrigatorio para containers. Sem isso, o profile pode nao funcionar corretamente.'
    },
    {
      question: 'Qual nivel do PSS bloqueia AppArmor type: Unconfined?',
      options: ['Privileged', 'Baseline', 'Restricted', 'Nenhum nivel bloqueia'],
      correct: 1,
      explanation: 'O nivel Baseline do PSS bloqueia appArmorProfile.type: Unconfined. O Restricted tambem bloqueia (e mais restritivo). Privileged permite tudo.',
      reference: 'PSS: Baseline bloqueia Unconfined. Restricted bloqueia Unconfined. Privileged permite tudo.'
    }
  ],

  flashcards: [
    { front: 'O que e AppArmor?', back: 'Mandatory Access Control (MAC) do Linux que confina processos usando profiles path-based. Controla acesso a arquivos, rede e capabilities. Diferente de seccomp (que filtra syscalls).' },
    { front: 'Quais sao os 3 modos do AppArmor?', back: 'enforce (bloqueia + loga violacoes), complain (permite + loga violacoes — modo auditoria), unconfined (sem restricao).' },
    { front: 'Como aplicar AppArmor no K8s v1.30+?', back: 'securityContext.appArmorProfile com type: Localhost e localhostProfile: <nome-do-profile>. Annotations sao legado. O profile deve estar carregado no node com apparmor_parser -r.' },
    { front: 'Quais comandos gerenciam AppArmor profiles?', back: 'aa-status (ver profiles), apparmor_parser -r (carregar enforce), apparmor_parser -C (carregar complain), apparmor_parser -R (remover), aa-genprof (gerar profile), aa-logprof (analisar logs).' },
    { front: 'Por que precisa de flags=(attach_disconnected)?', back: 'Containers usam mount namespaces que desconectam o root filesystem. Sem attach_disconnected, o AppArmor pode nao aplicar o profile corretamente ao container.' },
    { front: 'AppArmor vs SELinux?', back: 'AppArmor: path-based, mais simples, Ubuntu/SUSE/Debian. SELinux: label-based, mais granular, mais complexo, RHEL/CentOS/Fedora. No K8s, AppArmor tem suporte GA (v1.30), SELinux via labels no securityContext.' },
    { front: 'Como debugar AppArmor blocks?', back: 'Verificar syslog: grep apparmor /var/log/syslog. Usar aa-logprof para analisar violacoes. Mudar para modo complain para descobrir quais acessos sao necessarios. Usar aa-status para confirmar profile carregado.' }
  ],

  lab: {
    scenario: 'Voce deve criar e aplicar AppArmor profiles para restringir containers em producao.',
    objective: 'Carregar AppArmor profiles, aplica-los a Pods e verificar que acessos proibidos sao bloqueados.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Verificar AppArmor no cluster',
        instruction: 'Verifique se AppArmor esta habilitado nos nodes e liste os profiles carregados.',
        hints: ['aa-status mostra o status do AppArmor', 'Verifique em cada node do cluster'],
        solution: '```bash\n# Verificar se AppArmor esta ativo no node\nkubectl debug node/<node-name> -it --image=alpine -- cat /sys/module/apparmor/parameters/enabled\n# Deve retornar: Y\n\n# Listar profiles carregados\nkubectl debug node/<node-name> -it --image=alpine -- cat /sys/kernel/security/apparmor/profiles\n```',
        verify: '```bash\n# AppArmor deve estar habilitado\nkubectl debug node/<node-name> -it --image=alpine -- cat /sys/module/apparmor/parameters/enabled\n# Saida esperada: Y\n```'
      },
      {
        title: 'Criar e carregar AppArmor profile',
        instruction: 'Crie um profile que bloqueia escrita em /etc e /proc e carregue-o no node.',
        hints: ['Use deny /etc/** w e deny /proc/** w', 'Carregue com apparmor_parser -r'],
        solution: '```bash\n# Criar profile no node\nkubectl debug node/<node-name> -it --image=ubuntu -- bash -c \'\ncat > /host/etc/apparmor.d/k8s-deny-write <<PROFILE\n#include <tunables/global>\nprofile k8s-deny-write flags=(attach_disconnected) {\n  #include <abstractions/base>\n  file,\n  deny /etc/** w,\n  deny /proc/** w,\n  deny mount,\n}\nPROFILE\napparmor_parser -r /host/etc/apparmor.d/k8s-deny-write\n\'\n```',
        verify: '```bash\n# Verificar que o profile foi carregado\nkubectl debug node/<node-name> -it --image=alpine -- cat /sys/kernel/security/apparmor/profiles | grep k8s-deny-write\n# Deve retornar: k8s-deny-write (enforce)\n```'
      },
      {
        title: 'Aplicar profile a um Pod e testar restricoes',
        instruction: 'Crie um Pod usando o profile e verifique que escrita em /etc e bloqueada.',
        hints: ['Use securityContext.appArmorProfile', 'Teste com kubectl exec -- touch /etc/test'],
        solution: '```bash\n# Criar pod com AppArmor profile\nkubectl apply -f - <<EOF\napiVersion: v1\nkind: Pod\nmetadata:\n  name: apparmor-test\nspec:\n  nodeName: <node-name>\n  containers:\n  - name: app\n    image: alpine\n    command: [\"sh\", \"-c\", \"sleep 3600\"]\n    securityContext:\n      appArmorProfile:\n        type: Localhost\n        localhostProfile: k8s-deny-write\nEOF\n\n# Testar restricao — escrita em /etc deve ser bloqueada\nkubectl exec apparmor-test -- touch /etc/test-file\n# Deve retornar: Permission denied\n\n# Leitura deve funcionar\nkubectl exec apparmor-test -- cat /etc/hostname\n# Deve retornar o hostname\n\n# Limpar\nkubectl delete pod apparmor-test\n```',
        verify: '```bash\n# Escrita em /etc deve falhar\nkubectl exec apparmor-test -- touch /etc/test 2>&1 | grep -i \"denied\\|permission\"\n# Deve conter \"Permission denied\"\n\n# Leitura deve funcionar\nkubectl exec apparmor-test -- cat /etc/hostname\n# Deve retornar um hostname valido\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod falha com "cannot find or load AppArmor profile"',
      difficulty: 'easy',
      symptom: 'Pod nao inicia e eventos mostram: "Cannot enforce AppArmor: profile k8s-custom not found".',
      diagnosis: '```bash\nkubectl describe pod <pod> | grep -A3 Events\n# Evento: cannot find profile\n\n# Verificar no node\nkubectl get pod <pod> -o jsonpath=\'{.spec.nodeName}\'\nssh <node> \"aa-status | grep k8s-custom\"\n```',
      solution: '**O profile nao esta carregado no node onde o pod foi agendado.**\n\n```bash\n# Carregar o profile no node\nssh <node> \"apparmor_parser -r /etc/apparmor.d/k8s-custom\"\n\n# Verificar\nssh <node> \"aa-status | grep k8s-custom\"\n# Deve mostrar: k8s-custom (enforce)\n\n# Importante: carregar em TODOS os nodes possiveis\n# Ou usar nodeSelector/nodeName para forcar agendamento\n```'
    },
    {
      title: 'Aplicacao quebra apos aplicar AppArmor profile',
      difficulty: 'hard',
      symptom: 'Aplicacao retorna erros 500 apos aplicar AppArmor profile restritivo. Logs mostram "Permission denied" para operacoes de arquivo.',
      diagnosis: '```bash\n# Verificar logs da aplicacao\nkubectl logs <pod>\n\n# Verificar syslog no node para ver violacoes AppArmor\nssh <node> \"grep apparmor /var/log/syslog | tail -20\"\n# Saida mostra quais arquivos/operacoes foram bloqueados\n\n# Exemplo de violacao:\n# apparmor=\"DENIED\" operation=\"open\" profile=\"k8s-nginx\" name=\"/var/cache/nginx/\" pid=1234\n```',
      solution: '**Solucao 1 — Mudar para modo complain e analisar:**\n```bash\nssh <node> \"aa-complain k8s-nginx\"\n# Rode a aplicacao, colete violacoes do syslog\nssh <node> \"grep apparmor /var/log/syslog | grep ALLOWED | awk \\\"{print \\\\$0}\\\"\"\n# Adicione paths necessarios ao profile\n```\n\n**Solucao 2 — Adicionar paths ao profile:**\n```\n# Adicionar ao profile:\n/var/cache/nginx/** rw,\n/var/run/nginx.pid rw,\n/tmp/** rw,\n```\n\n**Recarregar:**\n```bash\nssh <node> \"apparmor_parser -r /etc/apparmor.d/k8s-nginx\"\nkubectl delete pod <pod>\n# Pod sera recriado pelo Deployment\n```'
    }
  ]
};
