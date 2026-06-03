window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-runtime-security/falco'] = {

  theory: `# Falco & Runtime Threat Detection

## Relevancia no CKS
> O dominio "Monitor, Logging and Runtime Security" vale **20%** do exame CKS. Falco e a principal ferramenta de deteccao de ameacas em runtime cobrada no exame. O CKS e **performance-based** — voce deve saber instalar, configurar regras e interpretar alertas.

---

## O que e Falco?

**Falco** e um projeto CNCF Graduated para deteccao de ameacas em runtime. Ele monitora **syscalls** (chamadas de sistema) do kernel Linux e gera alertas quando comportamentos suspeitos sao detectados.

### Arquitetura

\`\`\`
  ┌──────────────────────────────────────┐
  │           Userspace                   │
  │  ┌──────────┐    ┌───────────────┐   │
  │  │  Falco   │◄───│  Rules Files  │   │
  │  │  Engine  │    │  (YAML)       │   │
  │  └─────┬────┘    └───────────────┘   │
  │        │ alerts                       │
  │        ▼                              │
  │  ┌───────────────┐                   │
  │  │  Output        │                   │
  │  │  stdout/syslog │                   │
  │  │  http/grpc     │                   │
  │  └───────────────┘                   │
  ├──────────────────────────────────────┤
  │           Kernel Space                │
  │  ┌──────────────────────────────┐    │
  │  │  eBPF probe / Kernel module  │    │
  │  │  (captura syscalls)          │    │
  │  └──────────────────────────────┘    │
  └──────────────────────────────────────┘
\`\`\`

### Componentes

| Componente | Funcao |
|-----------|--------|
| **Driver** | Kernel module ou eBPF probe que captura syscalls |
| **Libraries (libs)** | Processam eventos do driver e filtram |
| **Rules Engine** | Avalia eventos contra regras YAML |
| **Outputs** | Envia alertas para stdout, syslog, HTTP, gRPC, Kafka |

### Fontes de Eventos

Falco monitora:
- **Syscalls** — open, read, write, execve, connect, socket, etc.
- **Kubernetes Audit Logs** — eventos do API server (criacao de pods, RBAC changes)
- **Plugins** — CloudTrail, Okta, GitHub (via plugin framework)

---

## Instalacao

### Via Helm (recomendado em producao)

\`\`\`bash
# Adicionar repositorio
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm repo update

# Instalar Falco com driver eBPF (recomendado)
helm install falco falcosecurity/falco \\
  --namespace falco \\
  --create-namespace \\
  --set driver.kind=ebpf \\
  --set tty=true

# Verificar instalacao
kubectl get pods -n falco
kubectl logs -n falco -l app.kubernetes.io/name=falco
\`\`\`

### Via DaemonSet Manual

\`\`\`yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: falco
  namespace: falco
spec:
  selector:
    matchLabels:
      app: falco
  template:
    metadata:
      labels:
        app: falco
    spec:
      serviceAccountName: falco
      hostNetwork: true
      hostPID: true
      containers:
      - name: falco
        image: falcosecurity/falco-no-driver:latest
        securityContext:
          privileged: true
        volumeMounts:
        - name: dev
          mountPath: /host/dev
        - name: proc
          mountPath: /host/proc
          readOnly: true
        - name: etc
          mountPath: /host/etc
          readOnly: true
        - name: rules
          mountPath: /etc/falco/rules.d
      volumes:
      - name: dev
        hostPath:
          path: /dev
      - name: proc
        hostPath:
          path: /proc
      - name: etc
        hostPath:
          path: /etc
      - name: rules
        hostPath:
          path: /etc/falco/rules.d
\`\`\`

**Nota:** Falco precisa de acesso privilegiado (privileged: true ou capabilities especificas) para capturar syscalls. Isso e uma excecao legitima ao principio de least privilege.

---

## Regras Falco

As regras sao o coracao do Falco. Cada regra define:

### Estrutura de uma Regra

\`\`\`yaml
- rule: <nome da regra>
  desc: <descricao>
  condition: <expressao de filtro usando syscalls>
  output: <mensagem de alerta com campos substituiveis>
  priority: <severidade>
  tags: [<categorias>]
  enabled: true|false
\`\`\`

### Prioridades

| Prioridade | Uso |
|-----------|-----|
| **EMERGENCY** | Sistema inutilizavel |
| **ALERT** | Acao imediata necessaria |
| **CRITICAL** | Condicao critica |
| **ERROR** | Erro que afeta operacao |
| **WARNING** | Situacao incomum que merece atencao |
| **NOTICE** | Evento normal mas significativo |
| **INFORMATIONAL** | Informativo |
| **DEBUG** | Debug |

### Exemplos de Regras

**Detectar shell interativo em container:**
\`\`\`yaml
- rule: Terminal Shell in Container
  desc: Detecta quando um shell interativo e aberto dentro de um container
  condition: >
    spawned_process and
    container and
    shell_procs and
    proc.tty != 0
  output: >
    Shell interativo aberto em container
    (user=%user.name container=%container.name
    shell=%proc.name parent=%proc.pname
    cmdline=%proc.cmdline image=%container.image.repository)
  priority: WARNING
  tags: [container, shell, mitre_execution]
\`\`\`

**Detectar leitura de arquivos sensiveis:**
\`\`\`yaml
- rule: Read Sensitive File
  desc: Detecta leitura de arquivos sensiveis como /etc/shadow
  condition: >
    open_read and
    sensitive_files and
    container and
    not proc.name in (allowed_readers)
  output: >
    Leitura de arquivo sensivel detectada
    (user=%user.name file=%fd.name container=%container.name
    image=%container.image.repository command=%proc.cmdline)
  priority: WARNING
  tags: [filesystem, mitre_credential_access]
\`\`\`

**Detectar conexao de rede inesperada:**
\`\`\`yaml
- rule: Unexpected Outbound Connection
  desc: Container fazendo conexao para IP externo inesperado
  condition: >
    outbound and
    container and
    not fd.sip in (allowed_outbound_ips)
  output: >
    Conexao de saida inesperada
    (container=%container.name image=%container.image.repository
    connection=%fd.name user=%user.name)
  priority: NOTICE
  tags: [network, mitre_command_and_control]
\`\`\`

**Detectar escrita em diretorios de sistema:**
\`\`\`yaml
- rule: Write Below Etc
  desc: Tentativa de escrita em /etc dentro de container
  condition: >
    write and
    container and
    fd.directory = /etc
  output: >
    Escrita em /etc detectada
    (user=%user.name file=%fd.name container=%container.name
    image=%container.image.repository command=%proc.cmdline)
  priority: ERROR
  tags: [filesystem, mitre_persistence]
\`\`\`

---

## Macros e Lists

Macros e lists sao blocos reutilizaveis nas regras:

### Macros (condicoes reutilizaveis)
\`\`\`yaml
- macro: container
  condition: container.id != host

- macro: spawned_process
  condition: evt.type = execve and evt.dir = <

- macro: open_read
  condition: evt.type in (open, openat) and evt.is_open_read = true

- macro: outbound
  condition: >
    (evt.type in (connect) and evt.dir=< and
    fd.typechar=4 and fd.ip != "0.0.0.0")
\`\`\`

### Lists (listas reutilizaveis)
\`\`\`yaml
- list: shell_procs
  items: [bash, sh, zsh, csh, ksh, dash, fish]

- list: sensitive_files
  items: [/etc/shadow, /etc/sudoers, /etc/pam.d, /etc/security]

- list: allowed_readers
  items: [sshd, login, passwd]
\`\`\`

---

## Regras Customizadas

### Criando regras customizadas

Crie arquivos em \`/etc/falco/rules.d/\` para regras customizadas (nao editar o arquivo principal):

\`\`\`yaml
# /etc/falco/rules.d/custom-rules.yaml

# Detectar uso de kubectl exec em producao
- rule: Kubectl Exec in Production
  desc: Alguem executou kubectl exec em namespace de producao
  condition: >
    spawned_process and
    container and
    container.namespace = production and
    proc.pname = runc:[2:INIT]
  output: >
    kubectl exec detectado em producao
    (user=%user.name namespace=%container.namespace
    pod=%k8s.pod.name container=%container.name
    command=%proc.cmdline)
  priority: WARNING
  tags: [k8s, exec, mitre_execution]

# Detectar container rodando como root
- rule: Container Running as Root
  desc: Container esta rodando com UID 0 (root)
  condition: >
    spawned_process and
    container and
    user.uid = 0 and
    not container.image.repository in (allowed_root_images)
  output: >
    Container rodando como root
    (user=%user.name uid=%user.uid container=%container.name
    image=%container.image.repository namespace=%container.namespace)
  priority: WARNING
  tags: [container, users, mitre_privilege_escalation]

- list: allowed_root_images
  items: [falcosecurity/falco, calico/node, cilium/cilium]
\`\`\`

### Sobrescrevendo regras existentes

Para modificar uma regra built-in sem editar o arquivo original, use \`append\` ou redefina:

\`\`\`yaml
# Desabilitar uma regra built-in
- rule: Terminal Shell in Container
  enabled: false

# Adicionar excecoes a uma regra existente
- rule: Terminal Shell in Container
  append: true
  condition: and not container.image.repository = "my-debug-image"
\`\`\`

---

## Outputs e Integracao

### Configuracao de Outputs

\`\`\`yaml
# /etc/falco/falco.yaml

# Stdout (padrao, util para kubectl logs)
stdout_output:
  enabled: true

# Syslog
syslog_output:
  enabled: true

# Arquivo
file_output:
  enabled: true
  filename: /var/log/falco/events.log
  keep_alive: false

# HTTP endpoint (webhook)
http_output:
  enabled: true
  url: http://alertmanager:9093/api/v1/alerts

# gRPC (para Falco Sidekick)
grpc:
  enabled: true
  bind_address: "unix:///run/falco/falco.sock"
\`\`\`

### Falcosidekick

**Falcosidekick** e o componente que roteia alertas do Falco para multiplos destinos:

\`\`\`bash
helm install falcosidekick falcosecurity/falcosidekick \\
  --namespace falco \\
  --set config.slack.webhookurl="https://hooks.slack.com/xxx" \\
  --set config.elasticsearch.hostport="http://elasticsearch:9200"
\`\`\`

Destinos suportados: Slack, PagerDuty, Elasticsearch, Kafka, AWS SNS, Prometheus (alertmanager), Loki, e mais.

---

## Kubernetes Audit Logs com Falco

Falco pode consumir Kubernetes Audit Logs para detectar atividades suspeitas no API server:

### Habilitando Audit Logs no API Server

\`\`\`yaml
# /etc/kubernetes/audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]
- level: RequestResponse
  resources:
  - group: ""
    resources: ["pods", "services"]
  - group: "apps"
    resources: ["deployments"]
- level: None
  resources:
  - group: ""
    resources: ["events"]
\`\`\`

\`\`\`bash
# Flags do kube-apiserver
--audit-policy-file=/etc/kubernetes/audit-policy.yaml
--audit-webhook-config-file=/etc/kubernetes/audit-webhook.yaml
\`\`\`

### Regra Falco para Audit Logs

\`\`\`yaml
- rule: K8s Secret Access
  desc: Detecta acesso a Secrets via API
  condition: >
    ka.verb in (get, list) and
    ka.target.resource = secrets and
    not ka.user.name in (allowed_secret_readers)
  output: >
    Acesso a Secret detectado via API
    (user=%ka.user.name verb=%ka.verb
    secret=%ka.target.name namespace=%ka.target.namespace
    source=%ka.sourceips)
  priority: WARNING
  source: k8s_audit
  tags: [k8s, secrets, mitre_credential_access]

- list: allowed_secret_readers
  items: [system:serviceaccount:kube-system:default, system:kube-controller-manager]
\`\`\`

---

## Comandos Essenciais

\`\`\`bash
# Verificar status do Falco
kubectl get pods -n falco
kubectl logs -n falco -l app.kubernetes.io/name=falco --tail=50

# Testar regras — gerar evento de shell em container
kubectl exec -it <pod-name> -- /bin/sh

# Ver alertas em tempo real
kubectl logs -n falco -l app.kubernetes.io/name=falco -f

# Validar sintaxe de regras customizadas
falco --validate /etc/falco/rules.d/custom-rules.yaml

# Listar campos disponiveis para regras
falco --list

# Listar regras carregadas
falco --list-rules

# Testar com arquivo de trace (dry-run)
falco -r custom-rules.yaml -e trace-file.scap
\`\`\`

---

## Falco no Contexto CKS

### O que o CKS cobra sobre Falco

1. **Instalar Falco** em um cluster (via Helm ou DaemonSet)
2. **Interpretar alertas** — ler output do Falco e identificar a ameaca
3. **Criar/modificar regras** — escrever regras customizadas em YAML
4. **Configurar outputs** — direcionar alertas para arquivo ou endpoint
5. **Integrar com Audit Logs** — configurar audit policy e webhook

### Falco vs Outras Ferramentas

| Ferramenta | Tipo | Camada |
|-----------|------|--------|
| **Falco** | Runtime detection (syscalls) | Container/Runtime |
| **Trivy** | Vulnerability scanning (imagens) | Container/CI |
| **OPA/Gatekeeper** | Admission policy (API) | Cluster |
| **Kyverno** | Admission policy (API) | Cluster |
| **AppArmor/SELinux** | Mandatory Access Control (kernel) | Node/Runtime |
| **seccomp** | Syscall filtering (kernel) | Container/Runtime |

**Diferenca crucial:** Falco **detecta e alerta** mas nao bloqueia. AppArmor/SELinux/seccomp **bloqueiam** syscalls. Falco complementa — detecta ameacas que passaram por outras camadas.

---

## Erros Comuns no CKS

1. **Achar que Falco bloqueia ameacas** — Falco apenas detecta e alerta, nao bloqueia
2. **Confundir Falco com AppArmor** — AppArmor bloqueia (enforcement), Falco detecta
3. **Esquecer que Falco precisa de privileged** — o driver eBPF/kernel module requer acesso privilegiado
4. **Editar regras no arquivo principal** — sempre criar regras customizadas em /etc/falco/rules.d/
5. **Nao saber a sintaxe de condition** — macros como \`container\`, \`spawned_process\`, \`open_read\` sao essenciais
`,

  quiz: [
    {
      question: 'Qual e a principal funcao do Falco no ecossistema de seguranca Kubernetes?',
      options: [
        'Bloquear containers maliciosos em runtime',
        'Detectar ameacas em runtime monitorando syscalls e gerar alertas',
        'Escanear imagens de container em busca de vulnerabilidades',
        'Enforcar politicas de admissao no API server'
      ],
      correct: 1,
      explanation: 'Falco DETECTA e ALERTA sobre ameacas em runtime monitorando syscalls — ele NAO bloqueia. Trivy faz scanning de imagens. OPA/Gatekeeper enforcam politicas de admissao. Para bloqueio em runtime, usa-se AppArmor/SELinux/seccomp.',
      reference: 'Falco = deteccao (alerta). AppArmor/seccomp = enforcement (bloqueio). Trivy = scanning.'
    },
    {
      question: 'Qual componente do Falco captura syscalls do kernel?',
      options: [
        'Rules Engine',
        'Falcosidekick',
        'eBPF probe ou Kernel module',
        'gRPC output'
      ],
      correct: 2,
      explanation: 'O driver do Falco (eBPF probe ou kernel module) roda no kernel space e captura syscalls. O Rules Engine avalia os eventos contra regras. Falcosidekick roteia alertas. gRPC e um canal de output.',
      reference: 'Driver (kernel) -> libs (filtragem) -> Rules Engine (avaliacao) -> Outputs (alertas)'
    },
    {
      question: 'Qual regra Falco detectaria um atacante abrindo um shell interativo dentro de um container?',
      options: [
        'Read Sensitive File',
        'Terminal Shell in Container',
        'Write Below Etc',
        'Unexpected Outbound Connection'
      ],
      correct: 1,
      explanation: 'A regra "Terminal Shell in Container" detecta quando processos de shell (bash, sh, zsh) sao executados com TTY (terminal interativo) dentro de containers. A condition usa spawned_process, container, shell_procs e proc.tty != 0.',
      reference: 'Terminal Shell = shell + TTY em container. Read Sensitive = acesso a /etc/shadow. Write Below Etc = escrita em /etc.'
    },
    {
      question: 'Onde devem ser colocadas regras customizadas do Falco?',
      options: [
        'No arquivo principal /etc/falco/falco_rules.yaml',
        'Em /etc/falco/rules.d/ como arquivos YAML separados',
        'No ConfigMap do namespace default',
        'Inline no DaemonSet manifest'
      ],
      correct: 1,
      explanation: 'Regras customizadas devem ser colocadas em /etc/falco/rules.d/ para nao modificar o arquivo principal de regras. Isso facilita atualizacoes do Falco e gestao de configuracao.',
      reference: 'Regras custom: /etc/falco/rules.d/. Nunca editar o arquivo principal falco_rules.yaml.'
    },
    {
      question: 'Qual e a funcao do Falcosidekick?',
      options: [
        'Capturar syscalls do kernel',
        'Rotear alertas do Falco para multiplos destinos (Slack, Elasticsearch, etc.)',
        'Escanear imagens de container',
        'Aplicar regras de bloqueio em runtime'
      ],
      correct: 1,
      explanation: 'Falcosidekick recebe alertas do Falco via gRPC e os roteia para multiplos destinos: Slack, PagerDuty, Elasticsearch, Kafka, Prometheus Alertmanager, Loki, etc.',
      reference: 'Falcosidekick = router de alertas. Falco -> Falcosidekick -> Slack/ES/Kafka/etc.'
    },
    {
      question: 'Qual a diferenca entre Falco e seccomp profiles?',
      options: [
        'Falco bloqueia syscalls, seccomp apenas monitora',
        'Falco detecta e alerta, seccomp bloqueia syscalls no kernel',
        'Ambos fazem a mesma coisa — deteccao de ameacas',
        'seccomp monitora syscalls, Falco bloqueia containers'
      ],
      correct: 1,
      explanation: 'Falco DETECTA ameacas e gera alertas (nao bloqueia). seccomp BLOQUEIA syscalls nao permitidas no nivel do kernel. Sao complementares: seccomp previne, Falco detecta o que passou.',
      reference: 'Falco = detect & alert. seccomp = block syscalls. AppArmor = MAC enforcement. Complementares.'
    },
    {
      question: 'Por que o Falco precisa rodar como container privilegiado?',
      options: [
        'Para acessar a rede do host',
        'Para modificar regras do firewall',
        'Para inserir o driver eBPF/kernel module que captura syscalls',
        'Para acessar o API server do Kubernetes'
      ],
      correct: 2,
      explanation: 'O driver do Falco (eBPF probe ou kernel module) precisa de acesso privilegiado para ser inserido no kernel e capturar syscalls. Isso e uma excecao legitima ao principio de least privilege para ferramentas de seguranca.',
      reference: 'Falco = privileged para driver eBPF/kernel module. Excecao legitima como CNI e monitoring agents.'
    },
    {
      question: 'Para que serve o campo "source: k8s_audit" em uma regra Falco?',
      options: [
        'Para enviar alertas para o Kubernetes Audit Log',
        'Para filtrar eventos que vem do Kubernetes Audit Log em vez de syscalls',
        'Para gravar regras no etcd',
        'Para sincronizar regras com o API server'
      ],
      correct: 1,
      explanation: 'O campo source: k8s_audit indica que a regra processa eventos do Kubernetes Audit Log (acoes no API server como criacao de pods, acesso a secrets) em vez de syscalls. Falco suporta multiplas fontes: syscalls (padrao) e k8s_audit.',
      reference: 'source: syscall (padrao) = captura syscalls. source: k8s_audit = eventos do API server audit log.'
    },
    {
      question: 'Qual macro Falco verifica se um evento ocorreu dentro de um container (e nao no host)?',
      options: [
        'spawned_process',
        'container',
        'open_read',
        'outbound'
      ],
      correct: 1,
      explanation: 'A macro "container" e definida como "container.id != host" — retorna true se o evento ocorreu dentro de um container. "spawned_process" verifica se um novo processo foi criado. "open_read" verifica abertura de arquivo para leitura.',
      reference: 'container = container.id != host. spawned_process = execve. open_read = open/openat para leitura.'
    },
    {
      question: 'Como desabilitar uma regra built-in do Falco sem editar o arquivo principal?',
      options: [
        'Deletar a regra do arquivo principal',
        'Criar um arquivo em /etc/falco/rules.d/ redefinindo a regra com enabled: false',
        'Reiniciar o Falco com a flag --disable-rule',
        'Configurar o Falcosidekick para ignorar a regra'
      ],
      correct: 1,
      explanation: 'Para desabilitar uma regra built-in, crie um arquivo em /etc/falco/rules.d/ redefinindo a regra com "enabled: false". Os arquivos em rules.d/ sao carregados apos o arquivo principal e podem sobrescrever regras existentes.',
      reference: 'Desabilitar: redefinir em rules.d/ com enabled: false. Modificar: usar append: true.'
    }
  ],

  flashcards: [
    { front: 'O que Falco faz?', back: 'Detecta ameacas em runtime monitorando syscalls do kernel Linux e gera alertas. NAO bloqueia — apenas detecta e notifica. Projeto CNCF Graduated.' },
    { front: 'Quais sao os componentes do Falco?', back: 'Driver (eBPF probe ou kernel module, captura syscalls no kernel), Libraries (filtra eventos), Rules Engine (avalia contra regras YAML), Outputs (envia alertas para stdout/syslog/HTTP/gRPC).' },
    { front: 'Qual a estrutura de uma regra Falco?', back: 'rule (nome), desc (descricao), condition (expressao de filtro com macros), output (mensagem com campos %user.name, %container.name), priority (WARNING/ERROR/CRITICAL), tags, enabled.' },
    { front: 'Onde colocar regras customizadas do Falco?', back: 'Em /etc/falco/rules.d/ como arquivos YAML separados. Nunca editar o arquivo principal falco_rules.yaml. Arquivos em rules.d/ sao carregados depois e podem sobrescrever regras.' },
    { front: 'Falco vs AppArmor vs seccomp?', back: 'Falco = DETECTA e alerta (nao bloqueia). AppArmor = bloqueia acesso a arquivos/rede (MAC). seccomp = bloqueia syscalls nao permitidas. Sao complementares: seccomp/AppArmor previnem, Falco detecta o que passou.' },
    { front: 'O que e Falcosidekick?', back: 'Componente que roteia alertas do Falco para multiplos destinos: Slack, PagerDuty, Elasticsearch, Kafka, Prometheus Alertmanager, Loki, AWS SNS, etc.' },
    { front: 'Quais macros Falco mais importantes?', back: 'container (container.id != host), spawned_process (evt.type = execve), open_read (open/openat para leitura), outbound (connect para IP externo). Usados como blocos reutilizaveis nas conditions.' },
    { front: 'O que Falco monitora alem de syscalls?', back: 'Kubernetes Audit Logs (source: k8s_audit) — acoes no API server como criacao de pods, acesso a secrets, mudancas de RBAC. E plugins para CloudTrail, Okta, GitHub.' },
    { front: 'Por que Falco roda como privileged?', back: 'O driver eBPF/kernel module precisa de acesso privilegiado ao kernel para capturar syscalls. E uma excecao legitima ao principio de least privilege, similar a CNI plugins e agents de monitoramento.' },
    { front: 'Como desabilitar uma regra built-in sem editar o arquivo principal?', back: 'Criar arquivo em /etc/falco/rules.d/ com: "- rule: <nome>\\n  enabled: false". Para modificar, usar "append: true" na condition.' }
  ],

  lab: {
    scenario: 'Voce e um Security Engineer e precisa configurar Falco para detectar ameacas em runtime em um cluster Kubernetes. Apos a instalacao, voce deve criar regras customizadas e validar que alertas sao gerados corretamente.',
    objective: 'Instalar Falco, criar regras customizadas, gerar eventos de seguranca e interpretar os alertas.',
    duration: '30-40 minutos',
    steps: [
      {
        title: 'Instalar Falco via Helm',
        instruction: 'Instale o Falco no cluster usando Helm com driver eBPF e output em stdout.',
        hints: [
          'helm repo add falcosecurity https://falcosecurity.github.io/charts',
          'Use --set driver.kind=ebpf para o driver eBPF',
          'Use --set tty=true para output formatado em stdout'
        ],
        solution: '```bash\nhelm repo add falcosecurity https://falcosecurity.github.io/charts\nhelm repo update\n\nhelm install falco falcosecurity/falco \\\n  --namespace falco \\\n  --create-namespace \\\n  --set driver.kind=ebpf \\\n  --set tty=true\n\n# Aguardar pods ficarem Running\nkubectl wait --for=condition=Ready pods -l app.kubernetes.io/name=falco -n falco --timeout=120s\n```',
        verify: '```bash\n# Todos os pods Falco devem estar Running (1 por node)\nkubectl get pods -n falco\n\n# Verificar logs para confirmar que regras foram carregadas\nkubectl logs -n falco -l app.kubernetes.io/name=falco --tail=10 | grep -i "rules\\|loaded"\n```'
      },
      {
        title: 'Gerar alerta com shell interativo em container',
        instruction: 'Crie um pod de teste e abra um shell interativo nele. Verifique que o Falco gera um alerta "Terminal Shell in Container".',
        hints: [
          'kubectl run test-pod --image=alpine -- sleep 3600',
          'kubectl exec -it test-pod -- /bin/sh',
          'kubectl logs -n falco -l app.kubernetes.io/name=falco --tail=20'
        ],
        solution: '```bash\n# Criar pod de teste\nkubectl run test-pod --image=alpine -- sleep 3600\nkubectl wait --for=condition=Ready pod/test-pod --timeout=30s\n\n# Abrir shell (vai gerar alerta no Falco)\nkubectl exec -it test-pod -- /bin/sh -c "echo test && exit"\n\n# Verificar alertas do Falco\nkubectl logs -n falco -l app.kubernetes.io/name=falco --tail=20 | grep "Terminal shell"\n```',
        verify: '```bash\n# Deve aparecer um alerta contendo "Terminal shell in container"\nkubectl logs -n falco -l app.kubernetes.io/name=falco --tail=50 | grep -i "shell"\n# Saida esperada: Warning Terminal shell in container (user=root ... container=test-pod ...)\n```'
      },
      {
        title: 'Criar regra customizada para detectar acesso a /etc/shadow',
        instruction: 'Crie uma regra customizada que detecta quando qualquer processo dentro de um container le o arquivo /etc/shadow.',
        hints: [
          'Crie um ConfigMap com a regra e monte em /etc/falco/rules.d/',
          'Use a condition: open_read and container and fd.name = /etc/shadow',
          'Teste com: kubectl exec test-pod -- cat /etc/shadow'
        ],
        solution: '```bash\n# Criar ConfigMap com regra customizada\nkubectl create configmap falco-custom-rules -n falco --from-literal=custom-rules.yaml=\'\n- rule: Read Shadow File in Container\n  desc: Detecta leitura de /etc/shadow dentro de container\n  condition: >\n    open_read and\n    container and\n    fd.name = /etc/shadow\n  output: >\n    Leitura de /etc/shadow detectada\n    (user=%user.name container=%container.name\n    image=%container.image.repository command=%proc.cmdline\n    namespace=%container.namespace)\n  priority: WARNING\n  tags: [filesystem, mitre_credential_access]\n\'\n\n# Atualizar Helm para montar o ConfigMap\nhelm upgrade falco falcosecurity/falco \\\n  --namespace falco \\\n  --set driver.kind=ebpf \\\n  --set tty=true \\\n  --set "customRules.custom-rules\\.yaml=$(kubectl get cm falco-custom-rules -n falco -o jsonpath=\\{.data.custom-rules\\.yaml\\})"\n\n# Testar a regra\nkubectl exec test-pod -- cat /etc/shadow\n\n# Verificar alerta\nkubectl logs -n falco -l app.kubernetes.io/name=falco --tail=20 | grep "shadow"\n```',
        verify: '```bash\n# Deve aparecer alerta sobre leitura de /etc/shadow\nkubectl logs -n falco -l app.kubernetes.io/name=falco --tail=30 | grep -i "shadow"\n# Saida esperada: Warning Leitura de /etc/shadow detectada (user=root container=test-pod ...)\n```'
      },
      {
        title: 'Interpretar alertas e mapear para MITRE ATT&CK',
        instruction: 'Analise os alertas gerados pelo Falco e identifique qual tatica MITRE ATT&CK cada um representa. Limpe o ambiente de teste.',
        hints: [
          'Terminal Shell = Execution (T1059)',
          'Read Shadow = Credential Access (T1003)',
          'Conexao inesperada = Command and Control (T1071)'
        ],
        solution: '```bash\n# Ver todos os alertas recentes\nkubectl logs -n falco -l app.kubernetes.io/name=falco --tail=100 | grep -E "Warning|Error|Critical"\n\n# Mapear para MITRE:\n# Terminal Shell in Container -> Execution (TA0002) -> T1059 Command and Scripting Interpreter\n# Read Shadow File -> Credential Access (TA0006) -> T1003 OS Credential Dumping\n# Write Below Etc -> Persistence (TA0003) -> T1543 Create or Modify System Process\n\n# Limpar ambiente de teste\nkubectl delete pod test-pod\n```',
        verify: '```bash\n# Pod de teste deve ter sido removido\nkubectl get pod test-pod 2>&1 | grep "not found"\n\n# Falco deve continuar rodando\nkubectl get pods -n falco -l app.kubernetes.io/name=falco --no-headers | grep Running\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Falco nao gera alertas apos instalacao',
      difficulty: 'medium',
      symptom: 'Falco foi instalado via Helm e os pods estao Running, mas nenhum alerta aparece nos logs mesmo apos executar kubectl exec em containers. Os logs mostram "Falco initialized" mas nenhum evento.',
      diagnosis: '**1. Verificar status dos pods:**\n```bash\nkubectl get pods -n falco\nkubectl logs -n falco -l app.kubernetes.io/name=falco --tail=50\n```\n\n**2. Verificar se o driver foi carregado:**\n```bash\nkubectl logs -n falco -l app.kubernetes.io/name=falco | grep -i "driver\\|probe\\|module"\n```\nSe aparecer "unable to load driver" ou "probe not found", o driver eBPF nao foi compilado para o kernel do node.\n\n**3. Verificar versao do kernel do node:**\n```bash\nkubectl get nodes -o jsonpath=\'{.items[*].status.nodeInfo.kernelVersion}\'\n```\neBPF requer kernel >= 4.14.\n\n**4. Verificar se regras estao carregadas:**\n```bash\nkubectl logs -n falco -l app.kubernetes.io/name=falco | grep -i "rules\\|loaded"\n```',
      solution: '**Causa mais comum: driver eBPF nao compativel com o kernel do node.**\n\n**Solucao 1 — Usar kernel module em vez de eBPF:**\n```bash\nhelm upgrade falco falcosecurity/falco \\\n  --namespace falco \\\n  --set driver.kind=kmod \\\n  --set tty=true\n```\n\n**Solucao 2 — Usar imagem com driver pre-compilado:**\n```bash\nhelm upgrade falco falcosecurity/falco \\\n  --namespace falco \\\n  --set driver.kind=ebpf \\\n  --set driver.loader.enabled=true \\\n  --set tty=true\n```\n\n**Solucao 3 — Verificar se Falco tem acesso privilegiado:**\n```bash\nkubectl get pod -n falco -o jsonpath=\'{.items[0].spec.containers[0].securityContext}\'\n# Deve ter privileged: true\n```\n\n**Verificar apos correcao:**\n```bash\nkubectl exec test-pod -- /bin/sh -c "echo test"\nkubectl logs -n falco -l app.kubernetes.io/name=falco --tail=10 | grep "Terminal shell"\n```'
    },
    {
      title: 'Regra customizada do Falco nao e carregada',
      difficulty: 'hard',
      symptom: 'Uma regra customizada foi criada em um ConfigMap e montada em /etc/falco/rules.d/, mas o Falco nao carrega a regra. Os logs mostram "Loading rules from file" apenas para o arquivo principal, nao para o customizado.',
      diagnosis: '**1. Verificar se o ConfigMap esta montado corretamente:**\n```bash\nkubectl exec -n falco <falco-pod> -- ls -la /etc/falco/rules.d/\n```\n\n**2. Verificar conteudo do arquivo montado:**\n```bash\nkubectl exec -n falco <falco-pod> -- cat /etc/falco/rules.d/custom-rules.yaml\n```\n\n**3. Validar sintaxe YAML da regra:**\n```bash\nkubectl exec -n falco <falco-pod> -- falco --validate /etc/falco/rules.d/custom-rules.yaml\n```\nProcure por erros de sintaxe como indentacao incorreta, macros inexistentes ou campos invalidos.\n\n**4. Verificar se o Falco foi reiniciado apos adicionar o ConfigMap:**\n```bash\nkubectl rollout restart daemonset/falco -n falco\n```\n\n**5. Verificar logs por erros de parsing:**\n```bash\nkubectl logs -n falco -l app.kubernetes.io/name=falco | grep -i "error\\|invalid\\|failed"\n```',
      solution: '**Causas comuns:**\n\n**1. Arquivo nao montado no path correto:**\n```bash\n# Verificar volumeMounts no Helm values\nhelm get values falco -n falco\n# Deve ter customRules configurado\n```\n\n**2. Erro de sintaxe YAML:**\n```yaml\n# ERRADO — macro inexistente\ncondition: my_custom_macro and container\n\n# CORRETO — usar macros existentes ou definir a macro\n- macro: my_custom_macro\n  condition: evt.type = execve\n\n- rule: My Rule\n  condition: my_custom_macro and container\n```\n\n**3. Falco nao recarregou apos mudanca:**\n```bash\n# Enviar SIGHUP para recarregar regras sem restart\nkubectl exec -n falco <falco-pod> -- kill -HUP 1\n\n# Ou restart completo\nkubectl rollout restart daemonset/falco -n falco\n```\n\n**4. Reinstalar com regras customizadas via Helm:**\n```bash\nhelm upgrade falco falcosecurity/falco \\\n  --namespace falco \\\n  --set driver.kind=ebpf \\\n  --set tty=true \\\n  --set-file customRules.custom-rules\\.yaml=./custom-rules.yaml\n```\n\n**Verificar:**\n```bash\nkubectl logs -n falco -l app.kubernetes.io/name=falco | grep -i "custom-rules\\|loaded"\n```'
    }
  ]
};
