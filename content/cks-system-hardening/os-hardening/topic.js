window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-system-hardening/os-hardening'] = {

  theory: `# OS-Level Security Hardening

## Relevancia no CKS
> O dominio "System Hardening" vale **15%** do CKS. Hardening do sistema operacional dos nodes e fundamental para reduzir a superficie de ataque. Voce deve saber remover servicos desnecessarios, restringir acesso ao host e aplicar principios de menor privilegio.

---

## Principios de Hardening de OS

### Reduzir Superficie de Ataque

A ideia central e **remover tudo que nao e necessario** para o funcionamento do node Kubernetes:

- Servicos desnecessarios
- Pacotes nao utilizados
- Modulos de kernel nao necessarios
- Portas abertas sem justificativa
- Usuarios e acessos desnecessarios

---

## Imagens de OS Minimas

Para nodes Kubernetes, use imagens de SO otimizadas e minimas:

| Imagem | Descricao | Caracteristicas |
|--------|-----------|----------------|
| **Bottlerocket** (AWS) | SO otimizado para containers | Imutavel, API-driven, sem shell por padrao |
| **Flatcar Container Linux** | Sucessor do CoreOS | Imutavel, updates atomicos, minimalista |
| **Talos Linux** | SO para Kubernetes | Sem SSH, sem shell, API-only management |
| **Ubuntu Minimal** | Ubuntu reduzido | Familiar mas com menos pacotes |

---

## Gerenciamento de Servicos

### Listar e Desabilitar Servicos

\`\`\`bash
# Listar todos os servicos ativos
systemctl list-units --type=service --state=running

# Listar servicos habilitados no boot
systemctl list-unit-files --type=service --state=enabled

# Desabilitar servico desnecessario
sudo systemctl stop <service>
sudo systemctl disable <service>

# Mascarar servico (impede que seja iniciado)
sudo systemctl mask <service>
\`\`\`

### Servicos Tipicamente Desnecessarios em Nodes K8s

\`\`\`bash
# Exemplos de servicos que podem ser removidos
sudo systemctl disable --now snapd
sudo systemctl disable --now avahi-daemon
sudo systemctl disable --now cups
sudo systemctl disable --now bluetooth
sudo systemctl disable --now rpcbind
\`\`\`

---

## Remocao de Pacotes

\`\`\`bash
# Listar pacotes instalados (Debian/Ubuntu)
dpkg -l | grep -v "^ii"
apt list --installed

# Remover pacotes desnecessarios
sudo apt remove --purge telnet netcat nmap
sudo apt autoremove

# Listar pacotes instalados (RHEL/CentOS)
rpm -qa
yum list installed

# Remover pacotes
sudo yum remove telnet nc nmap-ncat
\`\`\`

---

## Modulos de Kernel

### Desabilitar Modulos Desnecessarios

\`\`\`bash
# Listar modulos carregados
lsmod

# Desabilitar modulo (blacklist)
echo "blacklist <module>" | sudo tee /etc/modprobe.d/<module>.conf
echo "install <module> /bin/true" | sudo tee -a /etc/modprobe.d/<module>.conf

# Exemplos de modulos frequentemente desnecessarios
echo "blacklist cramfs" | sudo tee /etc/modprobe.d/cramfs.conf
echo "blacklist freevxfs" | sudo tee /etc/modprobe.d/freevxfs.conf
echo "blacklist udf" | sudo tee /etc/modprobe.d/udf.conf
echo "blacklist usb-storage" | sudo tee /etc/modprobe.d/usb-storage.conf
\`\`\`

---

## Sysctl - Parametros de Kernel

\`\`\`bash
# Desabilitar IP forwarding (exceto se necessario para CNI)
# NOTA: Kubernetes PRECISA de net.ipv4.ip_forward=1
sudo sysctl -w net.ipv4.ip_forward=1

# Desabilitar source routing
sudo sysctl -w net.ipv4.conf.all.accept_source_route=0

# Habilitar protecao contra SYN flood
sudo sysctl -w net.ipv4.tcp_syncookies=1

# Desabilitar ICMP redirect
sudo sysctl -w net.ipv4.conf.all.accept_redirects=0
sudo sysctl -w net.ipv4.conf.all.send_redirects=0

# Persistir configuracoes
sudo tee /etc/sysctl.d/99-kubernetes-hardening.conf <<EOF
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.tcp_syncookies = 1
kernel.randomize_va_space = 2
EOF

sudo sysctl --system
\`\`\`

---

## Perigos de Host Namespaces

Pods com acesso a namespaces do host podem comprometer o node:

| Campo | Risco | PSS Level que Bloqueia |
|-------|-------|----------------------|
| \`hostPID: true\` | Ve todos os processos do node | Baseline |
| \`hostNetwork: true\` | Acessa rede do node diretamente | Baseline |
| \`hostIPC: true\` | Compartilha IPC com processos do node | Baseline |
| \`privileged: true\` | Acesso total ao host | Baseline |

\`\`\`yaml
# Pod INSEGURO - nunca usar sem necessidade real
apiVersion: v1
kind: Pod
metadata:
  name: dangerous-pod
spec:
  hostPID: true
  hostNetwork: true
  hostIPC: true
  containers:
  - name: app
    image: nginx
    securityContext:
      privileged: true
\`\`\`

\`\`\`yaml
# Pod SEGURO - principio do menor privilegio
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  containers:
  - name: app
    image: nginx:1.25-alpine
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      runAsNonRoot: true
      runAsUser: 1000
      capabilities:
        drop: ["ALL"]
      seccompProfile:
        type: RuntimeDefault
\`\`\`

---

## SSH Hardening

\`\`\`bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
AllowUsers kubernetes-admin
X11Forwarding no
AllowTcpForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2

# Reiniciar SSH
sudo systemctl restart sshd
\`\`\`

Em ambientes de producao, considere desabilitar SSH completamente (como Talos Linux faz).

---

## Erros Comuns

1. **Desabilitar ip_forward** — Kubernetes PRECISA de net.ipv4.ip_forward=1
2. **Nao mascarar servicos** — disable pode nao ser suficiente, use mask
3. **Ignorar host namespaces** — hostPID/hostNetwork sao tao perigosos quanto privileged
4. **SSH com senha habilitado** — sempre usar chaves e desabilitar PasswordAuthentication
5. **Nao remover pacotes debug** — ferramentas como nmap, tcpdump, strace facilitam ataques

---

## Killer.sh Style Challenge

> Um auditor reportou que nodes do cluster tem servicos desnecessarios rodando (rpcbind, avahi-daemon), modulos de kernel inseguros carregados (cramfs, usb-storage), e SSH permite login root. Remedie todos os problemas e valide as mudancas.
`,

  quiz: [
    {
      question: 'Qual SO e projetado especificamente para Kubernetes e nao possui SSH nem shell?',
      options: ['Ubuntu Minimal', 'Bottlerocket', 'Talos Linux', 'Flatcar Container Linux'],
      correct: 2,
      explanation: 'Talos Linux e um SO projetado para Kubernetes que nao possui SSH, shell ou gerenciador de pacotes. Toda a gestao e feita via API, maximizando a seguranca.',
      reference: 'Conceito relacionado: Imagens de OS minimas para nodes Kubernetes.'
    },
    {
      question: 'Qual comando impede permanentemente que um servico seja iniciado, mesmo manualmente?',
      options: ['systemctl disable', 'systemctl stop', 'systemctl mask', 'systemctl remove'],
      correct: 2,
      explanation: 'systemctl mask cria um link para /dev/null, impedindo que o servico seja iniciado por qualquer meio. disable apenas remove do boot, e stop apenas para a execucao atual.',
      reference: 'Conceito relacionado: Gerenciamento de servicos com systemd.'
    },
    {
      question: 'Qual parametro sysctl o Kubernetes PRECISA que esteja habilitado?',
      options: ['net.ipv4.conf.all.accept_redirects', 'net.ipv4.ip_forward', 'net.ipv4.conf.all.accept_source_route', 'kernel.modules_disabled'],
      correct: 1,
      explanation: 'net.ipv4.ip_forward=1 e obrigatorio para que o Kubernetes faca roteamento de trafego entre pods. Desabilitar isso quebra a rede do cluster.',
      reference: 'Conceito relacionado: Sysctl — parametros de rede para Kubernetes.'
    },
    {
      question: 'Qual campo do Pod permite ver todos os processos do node host?',
      options: ['hostNetwork: true', 'hostPID: true', 'hostIPC: true', 'privileged: true'],
      correct: 1,
      explanation: 'hostPID: true compartilha o PID namespace do host com o pod, permitindo ver e interagir com todos os processos do node.',
      reference: 'Conceito relacionado: Host namespaces — riscos de seguranca.'
    },
    {
      question: 'Qual a forma recomendada de desabilitar modulos de kernel no Linux?',
      options: [
        'Deletar o arquivo .ko do modulo',
        'Criar blacklist em /etc/modprobe.d/ com install /bin/true',
        'Remover via apt remove',
        'Desabilitar via sysctl'
      ],
      correct: 1,
      explanation: 'A forma padrao e criar um arquivo em /etc/modprobe.d/ com "blacklist <module>" e "install <module> /bin/true" para impedir o carregamento.',
      reference: 'Conceito relacionado: Modulos de kernel — hardening.'
    },
    {
      question: 'Por que e importante desabilitar PasswordAuthentication no SSH?',
      options: [
        'Melhora a performance do SSH',
        'Previne ataques de forca bruta e credenciais vazadas',
        'E obrigatorio para compliance PCI',
        'Permite autenticacao via certificado'
      ],
      correct: 1,
      explanation: 'Desabilitar PasswordAuthentication forca uso de chaves SSH, prevenindo ataques de forca bruta e eliminando o risco de senhas fracas ou vazadas.',
      reference: 'Conceito relacionado: SSH Hardening — autenticacao segura.'
    },
    {
      question: 'Qual nivel do Pod Security Standards bloqueia hostPID, hostNetwork e hostIPC?',
      options: ['Privileged', 'Baseline', 'Restricted', 'Nenhum'],
      correct: 1,
      explanation: 'O nivel Baseline do PSS bloqueia host namespaces (hostPID, hostNetwork, hostIPC) e containers privilegiados. O nivel Restricted adiciona mais restricoes.',
      reference: 'Conceito relacionado: Pod Security Standards — niveis de seguranca.'
    }
  ],

  flashcards: [
    { front: 'O que e a superficie de ataque de um node?', back: 'Conjunto de servicos, pacotes, portas, modulos e configuracoes que podem ser explorados por um atacante. Hardening de OS visa reduzir essa superficie removendo tudo que nao e necessario.' },
    { front: 'Qual a diferenca entre systemctl disable e systemctl mask?', back: 'disable remove o servico do boot automatico mas ainda pode ser iniciado manualmente. mask cria link para /dev/null, impedindo completamente que o servico seja iniciado.' },
    { front: 'O que sao Bottlerocket e Talos Linux?', back: 'SOs minimalistas projetados para rodar containers/Kubernetes. Bottlerocket (AWS) e imutavel e API-driven. Talos Linux nao tem SSH nem shell, sendo gerenciado exclusivamente via API.' },
    { front: 'Quais host namespaces sao perigosos em pods?', back: 'hostPID (ve processos do host), hostNetwork (acessa rede do host), hostIPC (compartilha IPC). Combinados com privileged: true, dao controle total do node.' },
    { front: 'Por que net.ipv4.ip_forward deve ser 1 no Kubernetes?', back: 'O Kubernetes precisa de IP forwarding para rotear trafego entre pods em diferentes nodes. Desabilitar quebra a rede do cluster. E o unico parametro que NAO deve ser desabilitado no hardening.' },
    { front: 'Como desabilitar um modulo de kernel permanentemente?', back: 'Criar arquivo em /etc/modprobe.d/<module>.conf com: "blacklist <module>" e "install <module> /bin/true". Isso impede o carregamento do modulo.' },
    { front: 'Quais configuracoes de SSH sao essenciais para hardening?', back: 'PermitRootLogin no, PasswordAuthentication no, PubkeyAuthentication yes, MaxAuthTries 3, AllowTcpForwarding no, X11Forwarding no.' }
  ],

  lab: {
    scenario: 'Um auditor de seguranca identificou que os nodes do cluster possuem servicos desnecessarios, modulos de kernel inseguros e configuracao SSH permissiva.',
    objective: 'Aplicar hardening de OS nos nodes do cluster, removendo servicos, desabilitando modulos e configurando SSH.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Auditar e Desabilitar Servicos Desnecessarios',
        instruction: 'Liste os servicos rodando no node e desabilite aqueles que nao sao necessarios para o Kubernetes.',
        hints: [
          'Use systemctl list-units --type=service --state=running',
          'Servicos como rpcbind, avahi-daemon, cups nao sao necessarios',
          'Use systemctl mask para impedir reativacao'
        ],
        solution: '```bash\n# Listar servicos rodando\nsystemctl list-units --type=service --state=running\n\n# Desabilitar servicos desnecessarios\nsudo systemctl disable --now rpcbind\nsudo systemctl mask rpcbind\nsudo systemctl disable --now avahi-daemon\nsudo systemctl mask avahi-daemon\nsudo systemctl disable --now cups\nsudo systemctl mask cups\n```',
        verify: '```bash\n# Verificar que servicos foram mascarados\nsystemctl is-enabled rpcbind\n# Saida esperada: masked\n\nsystemctl is-enabled avahi-daemon\n# Saida esperada: masked\n\nsystemctl list-units --type=service --state=running | grep -E \"rpcbind|avahi|cups\"\n# Saida esperada: nenhuma linha\n```'
      },
      {
        title: 'Blacklist Modulos de Kernel Inseguros',
        instruction: 'Desabilite os modulos de kernel `cramfs` e `usb-storage` que nao sao necessarios nos nodes.',
        hints: [
          'Crie arquivos em /etc/modprobe.d/',
          'Use blacklist e install /bin/true',
          'Verifique se o modulo esta carregado com lsmod'
        ],
        solution: '```bash\n# Blacklist cramfs\nsudo tee /etc/modprobe.d/cramfs.conf <<EOF\nblacklist cramfs\ninstall cramfs /bin/true\nEOF\n\n# Blacklist usb-storage\nsudo tee /etc/modprobe.d/usb-storage.conf <<EOF\nblacklist usb-storage\ninstall usb-storage /bin/true\nEOF\n\n# Remover modulo se estiver carregado\nsudo modprobe -r cramfs 2>/dev/null\nsudo modprobe -r usb-storage 2>/dev/null\n```',
        verify: '```bash\n# Verificar que blacklist foi criada\ncat /etc/modprobe.d/cramfs.conf\n# Saida esperada: blacklist cramfs / install cramfs /bin/true\n\n# Verificar que modulo nao esta carregado\nlsmod | grep cramfs\n# Saida esperada: nenhuma saida\n\nlsmod | grep usb_storage\n# Saida esperada: nenhuma saida\n```'
      },
      {
        title: 'Auditar Pods com Host Namespaces',
        instruction: 'Verifique se existem pods no cluster usando host namespaces (hostPID, hostNetwork, hostIPC) e identifique quais nao deveriam ter esse acesso.',
        hints: [
          'Use kubectl get pods com jsonpath ou output custom-columns',
          'Pods em kube-system podem legitimamente usar host namespaces',
          'Pods de aplicacao NAO devem usar host namespaces'
        ],
        solution: '```bash\n# Verificar pods com hostPID\nkubectl get pods -A -o jsonpath=\'{range .items[?(@.spec.hostPID==true)]}{.metadata.namespace}/{.metadata.name}{\\"\\n\\"}{end}\'\n\n# Verificar pods com hostNetwork\nkubectl get pods -A -o jsonpath=\'{range .items[?(@.spec.hostNetwork==true)]}{.metadata.namespace}/{.metadata.name}{\\"\\n\\"}{end}\'\n\n# Verificar pods privilegiados\nkubectl get pods -A -o jsonpath=\'{range .items[*]}{range .spec.containers[*]}{..metadata.namespace}/{..metadata.name} privileged={.securityContext.privileged}{\\"\\n\\"}{end}{end}\'\n```',
        verify: '```bash\n# Verificar que nao ha pods de aplicacao com host namespaces\nkubectl get pods -n default -o jsonpath=\'{.items[*].spec.hostPID}\'\n# Saida esperada: vazio (nenhum pod com hostPID)\n\nkubectl get pods -n default -o jsonpath=\'{.items[*].spec.hostNetwork}\'\n# Saida esperada: vazio\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Node NotReady Apos Hardening de Servicos',
      difficulty: 'medium',
      symptom: 'Apos desabilitar servicos no node, ele fica NotReady e pods sao evicted.',
      diagnosis: '```bash\n# Verificar status do node\nkubectl get nodes\nkubectl describe node <node-name> | grep -A 5 Conditions\n\n# Verificar kubelet\nsudo systemctl status kubelet\nsudo journalctl -u kubelet --since \"5 minutes ago\"\n\n# Verificar container runtime\nsudo systemctl status containerd\nsudo crictl ps\n```',
      solution: 'Provavelmente um servico essencial foi desabilitado por engano. Verifique se kubelet e containerd estao rodando. Servicos essenciais para nodes K8s: kubelet, containerd (ou CRI-O), kube-proxy. NAO desabilitar esses. Use systemctl unmask <service> e systemctl start <service> para restaurar.'
    },
    {
      title: 'Rede do Cluster Quebrada Apos Sysctl Hardening',
      difficulty: 'hard',
      symptom: 'Pods nao conseguem se comunicar entre nodes apos aplicar configuracoes sysctl de hardening.',
      diagnosis: '```bash\n# Verificar ip_forward\nsysctl net.ipv4.ip_forward\n\n# Verificar bridge-nf-call\nsysctl net.bridge.bridge-nf-call-iptables\n\n# Testar conectividade\nkubectl run test --image=busybox --rm -it --restart=Never -- ping -c 3 <pod-ip-outro-node>\n\n# Verificar configuracao aplicada\ncat /etc/sysctl.d/99-kubernetes-hardening.conf\n```',
      solution: 'O Kubernetes requer: net.ipv4.ip_forward=1 (roteamento entre pods), net.bridge.bridge-nf-call-iptables=1 (processamento de regras iptables para trafego bridge). Restaure com: sysctl -w net.ipv4.ip_forward=1 && sysctl -w net.bridge.bridge-nf-call-iptables=1. Atualize o arquivo de configuracao para manter esses valores.'
    }
  ]
};
