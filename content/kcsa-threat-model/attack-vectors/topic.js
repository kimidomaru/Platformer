window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcsa-threat-model/attack-vectors'] = {
  theory: `# Kubernetes Attack Vectors

## Relevância no Exame
> KCSA — Threat Model (16%). Compreender os principais vetores de ataque em Kubernetes, como identificá-los e como se defender é fundamental para o KCSA. O exame foca em reconhecer padrões de ataque e as mitigações correspondentes.

## A Superfície de Ataque do Kubernetes

Kubernetes é um sistema distribuído complexo com múltiplos pontos de entrada potenciais. Mapear a superfície de ataque é o primeiro passo para uma postura de segurança efetiva.

\`\`\`
Superfície de Ataque K8s:
┌─────────────────────────────────────────────────────────┐
│  EXTERNAL                                               │
│  ├── Ingress/LoadBalancer (L7/L4 exposure)              │
│  ├── NodePort/HostPort (direct node access)             │
│  └── API Server (se exposto sem auth)                   │
│                                                         │
│  INTERNAL                                               │
│  ├── Comprometimento de Pod (escape para host)          │
│  ├── Lateral movement (pod-to-pod, namespace-to-ns)     │
│  ├── RBAC escalation (via bind/escalate/impersonate)    │
│  └── Supply chain (imagem maliciosa, dependência)       │
│                                                         │
│  INFRASTRUCTURE                                         │
│  ├── etcd exposure (dados em texto claro)               │
│  ├── kubelet API (porta 10250/10255)                     │
│  ├── Cloud IMDS (169.254.169.254 credential theft)      │
│  └── Node compromise (chave para o cluster)             │
└─────────────────────────────────────────────────────────┘
\`\`\`

## MITRE ATT&CK for Containers

O framework MITRE ATT&CK possui uma matrix específica para containers com 12 táticas:

| Tática | Técnicas Exemplo |
|--------|-----------------|
| **Initial Access** | Exposed Dashboard, Valid Accounts, Supply Chain Compromise |
| **Execution** | Container Admin, Exec into Container, Deploy Container |
| **Persistence** | Backdoor Container, Writable Host Path, Cron Job |
| **Privilege Escalation** | Privileged Container, Container Escape, HostPath Mount |
| **Defense Evasion** | Clear Container Logs, Delete K8s Events, Masquerading |
| **Credential Access** | List K8s Secrets, Application Credentials in Config Files, IMDS |
| **Discovery** | Access Kubernetes API, Network Service Discovery, Cloud Services |
| **Lateral Movement** | Container Service Account, Cluster Internal Networking |
| **Collection** | Data from Local System, API credentials |
| **Exfiltration** | Container API, Traffic Duplication |
| **Impact** | Data Destruction, Resource Hijacking (cryptomining) |

## Vetores de Ataque Principais

### 1. Exposed kube-apiserver

\`\`\`bash
# Verificar se API está acessível sem autenticação
curl -k https://API-SERVER:6443/api/v1/namespaces
# Se retornar dados sem autenticação: CRÍTICO

# Verificar se anonymous access está habilitado
kubectl get pod kube-apiserver-* -n kube-system -o yaml | \\
  grep -E "anonymous-auth|insecure-port"
\`\`\`

**Mitigação**: \`--anonymous-auth=false\`, \`--insecure-port=0\`, autorização RBAC.

---

### 2. Privileged Container / Container Escape

\`\`\`yaml
# Container privilegiado pode escapar para o host
spec:
  containers:
  - name: malicioso
    securityContext:
      privileged: true        # Acesso total ao host!
    volumeMounts:
    - mountPath: /host
      name: host-root
  volumes:
  - name: host-root
    hostPath:
      path: /                 # Sistema de arquivos completo do host
\`\`\`

\`\`\`bash
# Dentro de um container privilegiado com hostPath=/
# O atacante pode:
chroot /host  # Muda o root para o host
# Agora tem acesso total ao node!

# Ou via nsenter
nsenter --target 1 --mount --uts --ipc --net --pid
\`\`\`

**Mitigação**: Pod Security Standards (Restricted), PSA enforce mode, \`privileged: false\`, sem \`hostPath\`.

---

### 3. RBAC Privilege Escalation

\`\`\`yaml
# Verbo "bind" permite criar RoleBindings para qualquer Role
# (mesmo roles com mais privilégios que o usuário tem)
rules:
- apiGroups: ["rbac.authorization.k8s.io"]
  resources: ["rolebindings"]
  verbs: ["bind"]  # PERIGOSO: privilege escalation!

# Verbo "escalate" permite modificar Roles/ClusterRoles
  verbs: ["escalate"]  # Permite adicionar permissões

# "impersonate" permite agir como outro usuário/SA
  resources: ["users", "groups", "serviceaccounts"]
  verbs: ["impersonate"]  # Atuar como cluster-admin
\`\`\`

\`\`\`bash
# Verificar se usuário pode escalar privilégios
kubectl auth can-i bind clusterrole/cluster-admin --as=developer

# Listar quem tem poder de impersonate
kubectl get clusterrolebindings -o json | \\
  jq '.items[] | select(.roleRef.name=="cluster-admin") | .subjects'
\`\`\`

**Mitigação**: Nunca conceder \`bind\`, \`escalate\`, \`impersonate\` sem necessidade extrema. Auditar periodicamente.

---

### 4. Cloud Instance Metadata Service (IMDS)

\`\`\`bash
# Pod em nó de cloud pode roubar credenciais IAM do node
# O IMDS fica em 169.254.169.254 (link-local)

# Dentro de qualquer Pod:
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/
# Retorna o nome do IAM role do node

curl http://169.254.169.254/latest/meta-data/iam/security-credentials/my-node-role
# Retorna:
# {
#   "AccessKeyId": "ASIA...",
#   "SecretAccessKey": "...",
#   "Token": "..."  ← Credenciais temporárias com permissões do nó!
# }
\`\`\`

\`\`\`yaml
# Mitigação: NetworkPolicy bloqueando IMDS
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-imds
  namespace: default
spec:
  podSelector: {}  # Todos os pods
  policyTypes: ["Egress"]
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 169.254.169.254/32  # Bloqueia IMDS
\`\`\`

**Mitigação adicional**: IMDSv2 (requer PUT token antes de GET), Workload Identity ao invés de node IAM roles.

---

### 5. Supply Chain Attacks

\`\`\`bash
# Ataque: imagem maliciosa no registry
# O atacante injeta código na imagem durante build

# Verificar origem e integridade das imagens
# Image digest garante que a imagem não foi alterada
image: nginx:1.25@sha256:abc123...  # Digest imutável

# Verificar vulnerabilidades
trivy image nginx:latest

# Verificar assinatura (Cosign/Sigstore)
cosign verify --certificate-identity=... nginx:latest
\`\`\`

**Fases da Supply Chain:**
1. **Dependências comprometidas** — npm, pip, maven com código malicioso
2. **Build pipeline comprometido** — CI/CD injetando backdoor
3. **Registry comprometido** — imagem substituída após push
4. **Configuração maliciosa** — Helm chart com privileged: true

---

### 6. Lateral Movement via Service Accounts

\`\`\`bash
# Pod comprometido usa token do SA montado automaticamente
ls /var/run/secrets/kubernetes.io/serviceaccount/
# token, ca.crt, namespace

# Usar o token para chamar a API
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
curl -k -H "Authorization: Bearer $TOKEN" \\
  https://kubernetes.default.svc/api/v1/namespaces/kube-system/secrets

# Se o SA tiver permissões excessivas: comprometimento escalado
\`\`\`

\`\`\`yaml
# Mitigação: desabilitar auto-mount quando desnecessário
spec:
  automountServiceAccountToken: false
\`\`\`

---

### 7. etcd Direct Access

\`\`\`bash
# Se o etcd não estiver protegido por TLS e autenticação:
ETCDCTL_API=3 etcdctl get /registry --prefix \\
  --endpoints=http://127.0.0.1:2379  # Sem TLS!
# Expõe TODOS os dados do cluster: secrets, configs, tokens

# Verificar se etcd requer TLS
curl http://127.0.0.1:2379/health  # Se responder: EXPOSTO
\`\`\`

**Mitigação**: etcd com mTLS, bind apenas em 127.0.0.1, encryption at rest para Secrets.

---

### 8. Writable HostPath / Node Filesystem

\`\`\`yaml
# Montar diretório do sistema pode dar controle do node
volumes:
- name: docker-sock
  hostPath:
    path: /var/run/docker.sock  # Control do Docker daemon!
- name: proc
  hostPath:
    path: /proc                 # Acesso a processos do host
- name: etc
  hostPath:
    path: /etc                  # Modifica configs do sistema
\`\`\`

**Mitigação**: PSS Restricted proíbe hostPath, usar CSI drivers e PVCs.

## Kubernetes Threat Model: Categorias de Agentes de Ameaça

| Agente | Motivação | Vetor Típico |
|--------|-----------|-------------|
| **Insider malicioso** | Sabotagem, roubo | RBAC excessivo, acesso direto |
| **Atacante externo** | Dados, cryptomining | Supply chain, misconfiguration |
| **Usuário descuidado** | Acidente | Exposição acidental de configurações |
| **Container comprometido** | Persistência, escalada | Container escape, IMDS |

## Detecção e Resposta

\`\`\`bash
# Falco: detecção de anomalias em runtime
# Regras Falco detectam:
# - Exec em containers em produção
# - Escrita em /etc do container
# - Conexões de rede inesperadas
# - Acesso a /proc/*/mem

# Audit Logging: quem fez o quê
kubectl get pods kube-apiserver-* -n kube-system -o yaml | \\
  grep audit-log

# Verificar eventos suspeitos
kubectl get events -A --sort-by='.metadata.creationTimestamp' | tail -20
\`\`\`

## Erros Comuns

1. **Expor kubelet na porta 10255** (read-only mas vaza informações)
2. **Não limitar egress de pods** — permite exfiltração de dados
3. **RBAC com wildcards** — \`resources: ["*"]\` e \`verbs: ["*"]\`
4. **Imagens latest sem digest** — susceptível a image substitution
5. **Não usar admission controllers** para validar configurações

## Killer.sh Style Challenge

> **Cenário**: O time de segurança identificou que pods no namespace \`app\` podem acessar o IMDS de cloud e que há um ServiceAccount com permissões de \`cluster-admin\`. Bloqueie o acesso ao IMDS via NetworkPolicy e identifique qual ServiceAccount tem privilégios excessivos, removendo a permissão.
`,
  quiz: [
    {
      question: 'Um pod comprometido tenta roubar credenciais IAM acessando 169.254.169.254. Qual é este tipo de ataque e como preveni-lo?',
      options: [
        'SQL Injection — usar WAF para bloquear',
        'IMDS (Instance Metadata Service) credential theft — bloquear via NetworkPolicy egress',
        'Man-in-the-Middle — usar mTLS entre todos os pods',
        'DNS Spoofing — configurar DNSSEC no CoreDNS'
      ],
      correct: 1,
      explanation: 'O IP 169.254.169.254 é o endpoint do Instance Metadata Service (IMDS) em cloud providers (AWS, GCP, Azure). Um pod comprometido pode usá-lo para obter credenciais IAM temporárias do nó. A prevenção primária é uma NetworkPolicy que bloqueia egress para esse IP específico.',
      reference: 'Veja a seção "Cloud Instance Metadata Service (IMDS)" — inclui o YAML completo de NetworkPolicy para bloqueio.'
    },
    {
      question: 'Qual verbo RBAC permite que um usuário com menos privilégios eleve seus próprios privilégios criando RoleBindings para roles mais poderosas?',
      options: [
        'create — permite criar qualquer objeto',
        'update — permite modificar objetos existentes',
        'bind — permite criar RoleBindings independente dos seus próprios privilégios',
        'patch — permite modificações parciais de objetos'
      ],
      correct: 2,
      explanation: 'O verbo `bind` é especialmente perigoso porque permite criar RoleBindings associando qualquer Role a qualquer subject, mesmo que o usuário não tenha as permissões daquela Role. Um atacante com `bind` pode se associar ao `cluster-admin`. Os outros verbos perigosos são `escalate` e `impersonate`.',
      reference: 'Veja "RBAC Privilege Escalation" na teoria e o tópico RBAC Overview para lista completa de verbos sensíveis.'
    },
    {
      question: 'Um container com `privileged: true` e um volume `hostPath: /` é montado. O que um atacante pode fazer dentro deste container?',
      options: [
        'Apenas ler arquivos do host, não modificar',
        'Acessar apenas o namespace de rede do host',
        'Obter controle total do nó via chroot /host ou nsenter',
        'Acessar apenas pods no mesmo nó'
      ],
      correct: 2,
      explanation: 'Um container privilegiado com hostPath: / tem acesso ao sistema de arquivos completo do nó. Com `chroot /host`, o atacante muda o root para o sistema do host, obtendo controle total. Com `nsenter --target 1 --mount --uts --ipc --net --pid` entra nos namespaces do processo init do host. Isso é essencialmente um escape de container.',
      reference: 'Veja "Privileged Container / Container Escape" — Pod Security Standards Restricted previne ambos privileged:true e hostPath.'
    },
    {
      question: 'O que é um ataque de Supply Chain no contexto de containers Kubernetes?',
      options: [
        'Atacar os nós do cluster diretamente via SSH',
        'Comprometer o código, build, imagem ou dependências antes do deploy no cluster',
        'Interceptar tráfego entre pods usando Man-in-the-Middle',
        'Explorar vulnerabilidades no kube-proxy'
      ],
      correct: 1,
      explanation: 'Supply chain attacks comprometem o software em alguma fase antes de chegar ao ambiente de produção: dependências (npm/pip maliciosos), CI/CD pipeline (injetando código no build), registry de imagens (substituindo imagem após push) ou configurações (Helm charts com privileged:true). Defesas: image signing (Cosign), scanning (Trivy), admission controllers.',
      reference: 'Veja "Supply Chain Attacks" e o tópico Supply Chain Overview para SLSA, Cosign e Trivy em detalhe.'
    },
    {
      question: 'Um pod tem `automountServiceAccountToken: true` (padrão). Qual risco isso representa se o pod for comprometido?',
      options: [
        'Nenhum — tokens de SA têm permissões muito limitadas por padrão',
        'O atacante pode usar o token para chamar a API K8s com as permissões do SA do pod',
        'O token apenas permite acesso ao namespace do pod, sem riscos',
        'O token expira em 1 minuto, então o risco é mínimo'
      ],
      correct: 1,
      explanation: 'Por padrão, o token do ServiceAccount é montado em /var/run/secrets/kubernetes.io/serviceaccount/token. Se o pod for comprometido, o atacante usa esse token para chamar a API K8s com as permissões do SA — potencialmente para listar secrets, escalar privilégios, ou mover lateralmente. Defesa: `automountServiceAccountToken: false` quando não necessário.',
      reference: 'Veja "Lateral Movement via Service Accounts" — RBAC mínimo para SAs é tão importante quanto desabilitar auto-mount.'
    },
    {
      question: 'Em qual componente do MITRE ATT&CK for Containers se encaixaria um atacante que escaneou pods em execução para encontrar Secrets em variáveis de ambiente?',
      options: [
        'Initial Access — primeiro passo do ataque',
        'Execution — execução de código malicioso',
        'Credential Access — obtenção de credenciais',
        'Exfiltration — envio de dados para fora'
      ],
      correct: 2,
      explanation: 'Listar K8s Secrets e acessar credenciais em variáveis de ambiente de processos em execução são técnicas da tática "Credential Access" no MITRE ATT&CK for Containers. O objetivo é obter credenciais para uso posterior em outras táticas (lateral movement, privilege escalation, etc.).',
      reference: 'Veja a tabela MITRE ATT&CK na teoria — familiarize-se com as 12 táticas e exemplos de técnicas de cada uma.'
    },
    {
      question: 'Qual é a diferença entre IMDSv1 e IMDSv2, e por que IMDSv2 é mais seguro?',
      options: [
        'IMDSv2 usa HTTPS enquanto IMDSv1 usa HTTP',
        'IMDSv2 requer um token de sessão via PUT antes de qualquer GET, prevenindo SSRF',
        'IMDSv2 bloqueia acesso de containers por padrão',
        'IMDSv2 usa autenticação mTLS com certificados de cliente'
      ],
      correct: 1,
      explanation: 'IMDSv2 (AWS) requer que o cliente primeiro faça um PUT para obter um token de sessão (TTL configurável), e então use esse token no header de GETs subsequentes. Isso previne ataques SSRF (Server-Side Request Forgery) onde uma aplicação vulnerável é usada como proxy para acessar o IMDS — o SSRF geralmente não consegue fazer o PUT inicial.',
      reference: 'Veja Cloud Provider Security — a comparação IMDSv1 vs IMDSv2 e como Workload Identity elimina a necessidade do IMDS completamente.'
    },
    {
      question: 'Como o acesso direto ao etcd sem TLS representa um vetor de ataque crítico?',
      options: [
        'Permite apenas leitura de metadados de pods em execução',
        'Expõe todos os dados do cluster: Secrets, tokens, configurações em texto claro',
        'Permite apenas modificar Deployments sem afetar outros recursos',
        'O etcd sem TLS apenas reduz performance, sem impacto de segurança'
      ],
      correct: 1,
      explanation: 'O etcd é o "cérebro" do cluster — armazena todo o estado: Secrets (com credenciais), ServiceAccount tokens, configurações de todos os resources. Sem TLS, qualquer um com acesso à rede pode ler e escrever diretamente, obtendo credenciais, injetando pods maliciosos, ou destruindo dados. É o impacto mais crítico possível.',
      reference: 'Veja Control Plane Security — mTLS no etcd, bind em 127.0.0.1, e encryption at rest são as três camadas de proteção do etcd.'
    }
  ],
  flashcards: [
    {
      front: 'O que é o IMDS e por que é um vetor de ataque?',
      back: 'Instance Metadata Service: endpoint em 169.254.169.254 disponível em todos os nós cloud. Um pod comprometido pode chamar este IP para obter credenciais IAM temporárias do nó, potencialmente com permissões amplas. Mitigação: NetworkPolicy bloqueando egress para 169.254.169.254/32, IMDSv2, ou Workload Identity.'
    },
    {
      front: 'Quais são os 3 verbos RBAC que causam privilege escalation?',
      back: '`bind` — cria RoleBindings para qualquer Role (mesmo mais privilegiadas). `escalate` — modifica Roles/ClusterRoles para adicionar permissões. `impersonate` — age como outro usuário/SA/grupo. Nunca conceder sem necessidade extrema e revisão.'
    },
    {
      front: 'O que é um container escape e como preveni-lo?',
      back: 'Container escape: sair do namespace do container e obter acesso ao host. Técnicas: privileged:true + hostPath:/, nsenter, exploits do runtime. Prevenção: PSS Restricted (sem privileged, sem hostPath), seccomp RuntimeDefault, AppArmor, gVisor/Kata para isolamento adicional.'
    },
    {
      front: 'O que é Supply Chain Attack em containers?',
      back: 'Comprometimento em qualquer fase antes do deploy: (1) dependências maliciosas no código, (2) CI/CD pipeline comprometido, (3) registry com imagem substituída, (4) Helm charts maliciosos. Defesas: image signing (Cosign/Sigstore), scanning (Trivy), SLSA framework, admission controllers verificando assinaturas.'
    },
    {
      front: 'Qual é o risco de automountServiceAccountToken padrão?',
      back: 'Por padrão o token do SA é montado em /var/run/secrets/kubernetes.io/serviceaccount/token. Pod comprometido usa o token para chamar a API K8s com as permissões do SA — potencialmente listar secrets, mover lateralmente, escalar privilégios. Fix: `automountServiceAccountToken: false` quando não necessário.'
    },
    {
      front: 'Quais são as 4 principais fases de ataque no MITRE ATT&CK for Containers?',
      back: 'Initial Access (entrar no cluster: exposed API, supply chain), Execution (rodar código: exec em container, deploy malicioso), Privilege Escalation (obter mais acesso: container escape, RBAC escalation), Lateral Movement (mover entre namespaces/nós via SA tokens e rede interna).'
    },
    {
      front: 'Por que hostPath: /var/run/docker.sock é especialmente perigoso?',
      back: 'Montar o socket do Docker daemon dá controle total sobre o Docker do host — pode criar novos containers privilegiados, inspecionar outros containers, modificar imagens. É equivalente a ter acesso root ao nó. PSS Restricted e PSA enforcement bloqueiam hostPath.'
    },
    {
      front: 'Como o lateral movement acontece via ServiceAccounts em Kubernetes?',
      back: 'Pod comprometido usa token SA montado → chama API K8s → lista secrets de outros namespaces → obtém credenciais de outros serviços → escala acesso. Prevenção: RBAC mínimo por SA, automountServiceAccountToken:false, NetworkPolicy limitando acesso à API server a apenas pods que precisam.'
    }
  ],
  lab: {
    scenario: 'Você é um analista de segurança investigando um cluster suspeito. Precisa identificar configurações que expõem vetores de ataque críticos: pods privilegiados, SAs com excesso de permissões, e acesso ao IMDS desprotegido.',
    objective: 'Identificar e mitigar vetores de ataque comuns em Kubernetes: container escape paths, RBAC excessivo, e acesso ao IMDS.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Identificar Pods com configurações perigosas',
        instruction: `Escaneie o cluster para encontrar pods com configurações que permitem container escape ou privilege escalation.

\`\`\`bash
# Encontrar pods privilegiados em todos os namespaces
kubectl get pods -A -o json | jq -r '
  .items[] |
  select(.spec.containers[].securityContext.privileged == true) |
  "\(.metadata.namespace)/\(.metadata.name): PRIVILEGED"'

# Encontrar pods com hostPath mounts suspeitos
kubectl get pods -A -o json | jq -r '
  .items[] |
  select(.spec.volumes[]?.hostPath != null) |
  "\(.metadata.namespace)/\(.metadata.name): hostPath=\(.spec.volumes[].hostPath.path // "n/a")"'

# Encontrar pods rodando como root
kubectl get pods -A -o json | jq -r '
  .items[] |
  select(
    (.spec.securityContext.runAsNonRoot != true) and
    (.spec.containers[].securityContext.runAsNonRoot != true)
  ) |
  "\(.metadata.namespace)/\(.metadata.name): pode rodar como root"'
\`\`\`

Crie um pod de teste com configuração insegura para observar os riscos:
\`\`\`yaml
# dangerous-pod.yaml (apenas para laboratório — NUNCA em produção)
apiVersion: v1
kind: Pod
metadata:
  name: dangerous-pod
  namespace: default
spec:
  containers:
  - name: test
    image: busybox:1.35
    command: ["sleep", "3600"]
    securityContext:
      allowPrivilegeEscalation: true
\`\`\``,
        hints: [
          'O jq é muito útil para filtrar campos específicos em JSON — aprenda o básico para o exame',
          'Pods em kube-system frequentemente têm hostPath por design — foque em namespaces de aplicação',
          'kubectl get pods -A -o wide mostra os nós de cada pod'
        ],
        solution: `\`\`\`bash
kubectl apply -f dangerous-pod.yaml

# Verificar configuração insegura
kubectl get pod dangerous-pod -o jsonpath='{.spec.containers[0].securityContext}'

# Comparar com um pod seguro
kubectl run safe-pod --image=busybox:1.35 --command -- sleep 3600 \\
  --overrides='{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":1000},"containers":[{"name":"safe-pod","image":"busybox:1.35","command":["sleep","3600"],"securityContext":{"allowPrivilegeEscalation":false,"readOnlyRootFilesystem":true}}]}}'
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o pod inseguro foi criado
kubectl get pod dangerous-pod
# NAME            READY   STATUS    RESTARTS
# dangerous-pod   1/1     Running   0

# Verificar sua configuração de segurança
kubectl get pod dangerous-pod -o jsonpath='{.spec.containers[0].securityContext}'
# Saída esperada mostrará allowPrivilegeEscalation: true

# Verificar que PSA não bloqueou (namespace default geralmente sem enforcement)
kubectl describe pod dangerous-pod | grep -E "Warning|Error|Security"
\`\`\``
      },
      {
        title: 'Identificar e mitigar RBAC excessivo',
        instruction: `Simule um cenário onde uma SA tem permissões excessivas e investigue o impacto.

\`\`\`bash
# Criar SA com permissões excessivas (simulação do que NÃO fazer)
kubectl create serviceaccount overprivileged-sa -n default
\`\`\`

\`\`\`yaml
# bad-rbac.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: bad-binding
subjects:
- kind: ServiceAccount
  name: overprivileged-sa
  namespace: default
roleRef:
  kind: ClusterRole
  name: cluster-admin
  apiGroup: rbac.authorization.k8s.io
\`\`\`

\`\`\`bash
kubectl apply -f bad-rbac.yaml

# Verificar o impacto — o que essa SA pode fazer?
kubectl auth can-i list secrets -A \\
  --as=system:serviceaccount:default:overprivileged-sa
# yes — PERIGOSO!

kubectl auth can-i delete pods -A \\
  --as=system:serviceaccount:default:overprivileged-sa
# yes — PERIGOSO!

# Agora corrija: remova e crie permissões mínimas
kubectl delete clusterrolebinding bad-binding
\`\`\`

Crie permissões mínimas adequadas:
\`\`\`yaml
# minimal-rbac.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: minimal-role
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]  # Apenas leitura de pods no namespace
\`\`\``,
        hints: [
          'kubectl auth can-i com --as simula permissões sem precisar do token real',
          'ClusterRoleBinding com cluster-admin = acesso irrestrito a tudo',
          'Sempre prefira Role (namespace-scoped) a ClusterRole quando possível'
        ],
        solution: `\`\`\`bash
kubectl create serviceaccount overprivileged-sa -n default
kubectl apply -f bad-rbac.yaml

# Verificar impacto
kubectl auth can-i list secrets -A \\
  --as=system:serviceaccount:default:overprivileged-sa

# Corrigir
kubectl delete clusterrolebinding bad-binding
kubectl apply -f minimal-rbac.yaml

kubectl create rolebinding minimal-binding \\
  --role=minimal-role \\
  --serviceaccount=default:overprivileged-sa \\
  -n default

# Verificar permissões corrigidas
kubectl auth can-i list secrets -A \\
  --as=system:serviceaccount:default:overprivileged-sa
# no ✅

kubectl auth can-i get pods -n default \\
  --as=system:serviceaccount:default:overprivileged-sa
# yes ✅
\`\`\``,
        verify: `\`\`\`bash
# Verificar que ClusterRoleBinding foi removido
kubectl get clusterrolebinding bad-binding 2>&1
# Error from server (NotFound): ...

# Verificar permissões após correção
kubectl auth can-i list secrets -A \\
  --as=system:serviceaccount:default:overprivileged-sa
# Saída esperada: no

kubectl auth can-i get pods -n default \\
  --as=system:serviceaccount:default:overprivileged-sa
# Saída esperada: yes
\`\`\``
      },
      {
        title: 'Criar NetworkPolicy para bloquear acesso ao IMDS',
        instruction: `Implemente proteção contra roubo de credenciais IMDS via NetworkPolicy.

\`\`\`yaml
# block-imds.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-cloud-imds
  namespace: default
spec:
  podSelector: {}  # Aplica a TODOS os pods no namespace
  policyTypes:
  - Egress
  egress:
  # Permite DNS (porta 53 UDP/TCP)
  - ports:
    - port: 53
      protocol: UDP
    - port: 53
      protocol: TCP
  # Permite qualquer destino EXCETO IMDS
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 169.254.169.254/32  # AWS/GCP/Azure IMDS
\`\`\`

\`\`\`bash
kubectl apply -f block-imds.yaml

# Testar o bloqueio (em ambiente real de cloud)
kubectl run test-pod --image=busybox:1.35 --restart=Never \\
  --command -- sleep 600

# Verificar que o IMDS está bloqueado
kubectl exec test-pod -- wget -T 3 -O- http://169.254.169.254/ 2>&1
# Deve falhar com timeout ou connection refused

# Verificar que internet normal ainda funciona
kubectl exec test-pod -- wget -T 5 -O- http://8.8.8.8/ 2>&1
\`\`\``,
        hints: [
          'A NetworkPolicy de egress precisa permitir DNS explicitamente ou pods perdem resolução de nomes',
          'ipBlock.except permite blockar IPs específicos mantendo o resto permitido',
          '169.254.169.254 é o IP link-local do IMDS em AWS, GCP e Azure'
        ],
        solution: `\`\`\`bash
kubectl apply -f block-imds.yaml

kubectl run test-pod --image=busybox:1.35 --restart=Never \\
  --command -- sleep 600

# Aguardar pod ficar Running
kubectl wait --for=condition=Ready pod/test-pod

# Testar bloqueio ao IMDS
kubectl exec test-pod -- wget -T 3 -O- http://169.254.169.254/ 2>&1
# wget: download timed out (ou similar)
\`\`\``,
        verify: `\`\`\`bash
# Verificar NetworkPolicy criada
kubectl get networkpolicy block-cloud-imds -n default
# NAME               POD-SELECTOR   AGE
# block-cloud-imds   <none>         ...

kubectl describe networkpolicy block-cloud-imds -n default
# Deve mostrar Egress com except para 169.254.169.254/32

# Verificar que pod não consegue acessar IMDS
kubectl exec test-pod -- wget -T 3 -q -O- http://169.254.169.254/ 2>&1
# Saída esperada: wget: download timed out (ou connection refused)

# Verificar que DNS ainda funciona
kubectl exec test-pod -- nslookup kubernetes.default.svc.cluster.local
# Saída esperada: resolução bem-sucedida
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Container com capabilities suspeitas detectado',
      difficulty: 'medium',
      symptom: 'O sistema de detecção Falco alertou sobre um container em produção que está chamando `setuid()` e modificando arquivos em `/etc`. Investigação inicial mostra que o container tem capabilities excessivas no SecurityContext.',
      diagnosis: `\`\`\`bash
# Identificar o pod com capabilities suspeitas
kubectl get pods -A -o json | jq -r '
  .items[] |
  select(.spec.containers[].securityContext.capabilities.add != null) |
  "\(.metadata.namespace)/\(.metadata.name): caps=\(.spec.containers[].securityContext.capabilities.add)"'

# Inspecionar o pod suspeito detalhadamente
kubectl describe pod <pod-suspeito> -n <namespace>
# Verificar: securityContext, capabilities, runAsUser

# Verificar se container pode escalar privilégios
kubectl get pod <pod-suspeito> -n <namespace> -o jsonpath='{.spec.containers[].securityContext}'
# Output pode mostrar: {"capabilities":{"add":["SYS_ADMIN","NET_ADMIN"]},"allowPrivilegeEscalation":true}

# Ver processos rodando no container
kubectl exec <pod-suspeito> -n <namespace> -- ps aux
kubectl exec <pod-suspeito> -n <namespace> -- ls -la /etc/ 2>/dev/null

# Verificar logs em busca de atividade suspeita
kubectl logs <pod-suspeito> -n <namespace> | grep -E "chmod|chown|setuid|passwd"
\`\`\``,
      solution: `\`\`\`bash
# Isolar o pod suspeito imediatamente (não deletar — preservar evidências)
# Adicionar label de quarentena
kubectl label pod <pod-suspeito> -n <namespace> security=quarantine

# Aplicar NetworkPolicy para isolar o pod
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: quarantine-pod
  namespace: <namespace>
spec:
  podSelector:
    matchLabels:
      security: quarantine
  policyTypes: ["Ingress", "Egress"]
  # Sem regras = bloqueia todo tráfego
EOF

# Corrigir o Deployment/Pod spec removendo capabilities perigosas
kubectl patch deployment <deployment-name> -n <namespace> --type='json' -p='[
  {"op": "remove", "path": "/spec/template/spec/containers/0/securityContext/capabilities/add"},
  {"op": "add", "path": "/spec/template/spec/containers/0/securityContext/capabilities/drop", "value": ["ALL"]},
  {"op": "add", "path": "/spec/template/spec/containers/0/securityContext/allowPrivilegeEscalation", "value": false}
]'

# Verificar que novo pod está com configuração correta
kubectl get pod <novo-pod> -n <namespace> -o jsonpath='{.spec.containers[0].securityContext}'
\`\`\``
    },
    {
      title: 'Token de ServiceAccount vazado — resposta a incidente',
      difficulty: 'hard',
      symptom: 'O audit log mostrou chamadas à API K8s de um IP externo suspeito usando o token do ServiceAccount `backend-sa` do namespace `app`. O token foi comprometido. Você precisa invalidar o token e prevenir novos vazamentos.',
      diagnosis: `\`\`\`bash
# Verificar audit logs (se configurado)
# Os logs ficam no control plane, tipicamente em /var/log/kubernetes/audit/audit.log
grep "backend-sa" /var/log/kubernetes/audit/audit.log | \\
  jq '.sourceIPs, .user.username, .requestURI, .responseStatus.code'

# Verificar qual Secret contém o token comprometido
kubectl get secrets -n app | grep backend-sa
kubectl get secret backend-sa-token-xxxxx -n app -o jsonpath='{.data.token}' | base64 -d

# Verificar permissões do SA comprometido
kubectl auth can-i --list --as=system:serviceaccount:app:backend-sa -n app
kubectl auth can-i --list --as=system:serviceaccount:app:backend-sa -A

# Identificar pods usando esse SA
kubectl get pods -n app -o json | jq -r '
  .items[] |
  select(.spec.serviceAccountName == "backend-sa") |
  .metadata.name'
\`\`\``,
      solution: `\`\`\`bash
# 1. Invalidar o token imediatamente — deletar o Secret do token
# (Para tokens legados — SA token Secrets)
kubectl delete secret backend-sa-token-xxxxx -n app

# 2. Para tokens bound (projetados) — a única forma de invalidar é deletar e recriar o SA
kubectl delete serviceaccount backend-sa -n app
kubectl create serviceaccount backend-sa -n app

# 3. Reiniciar todos os pods que usavam o SA (para obter novo token)
kubectl rollout restart deployment/backend -n app

# 4. Adicionar automountServiceAccountToken: false ao SA se não precisa da API
kubectl patch serviceaccount backend-sa -n app \\
  -p '{"automountServiceAccountToken": false}'

# 5. Revisar e restringir RBAC do SA comprometido
kubectl get rolebindings,clusterrolebindings -A -o json | \\
  jq '.items[] | select(.subjects[]?.name == "backend-sa" and .subjects[]?.namespace == "app")'

# Remover permissões excessivas identificadas acima
kubectl delete rolebinding <binding-excessivo> -n app

# 6. Habilitar audit logging se ainda não estiver ativo
# No kube-apiserver:
# --audit-log-path=/var/log/kubernetes/audit/audit.log
# --audit-policy-file=/etc/kubernetes/audit-policy.yaml

# 7. Configurar alerta para uso do SA a partir de IPs externos
# (via Falco rule ou audit webhook)
\`\`\``
    }
  ]
};
