window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcsa-security-overview/4c-security-model'] = {

  theory: `# The 4C's of Cloud Native Security

## Relevancia no KCSA
> O dominio "Overview of Cloud Security" vale **14%** do exame KCSA. O modelo 4C e o framework fundamental que a CNCF usa para organizar a seguranca cloud native. O KCSA e um exame **teorico** (multipla escolha).

---

## O Modelo 4C

O modelo **4C's of Cloud Native Security** e a abordagem em camadas recomendada pela documentacao oficial do Kubernetes. Cada camada protege a seguinte — se uma camada externa e comprometida, as internas ficam expostas.

\`\`\`
    ┌─────────────────────────────────────────┐
    │              CLOUD                       │
    │  ┌─────────────────────────────────┐     │
    │  │           CLUSTER                │     │
    │  │  ┌─────────────────────────┐     │     │
    │  │  │       CONTAINER          │     │     │
    │  │  │  ┌─────────────────┐     │     │     │
    │  │  │  │      CODE        │     │     │     │
    │  │  │  └─────────────────┘     │     │     │
    │  │  └─────────────────────────┘     │     │
    │  └─────────────────────────────────┘     │
    └─────────────────────────────────────────┘
\`\`\`

As 4 camadas, da mais externa para a mais interna:

| Camada | Escopo | Responsavel |
|--------|--------|-------------|
| **Cloud** | Infraestrutura do provedor (AWS, GCP, Azure, bare-metal) | Platform/Infra team |
| **Cluster** | Componentes do Kubernetes (API server, etcd, kubelet) | Platform Engineer / SRE |
| **Container** | Imagens, runtime, configuracao de seguranca dos containers | DevOps / Platform Engineer |
| **Code** | Codigo da aplicacao, dependencias, segredos | Developer |

---

## 1. Cloud (Infraestrutura)

A camada Cloud e a base de tudo. Se o provedor de nuvem ou o datacenter e comprometido, nenhuma das camadas internas esta segura.

### Responsabilidades

| Area | Controles |
|------|-----------|
| **Rede** | VPC, subnets privadas, firewalls, security groups |
| **IAM** | Identidade, roles, least privilege, MFA |
| **Criptografia** | Encryption at rest (discos, volumes), encryption in transit (TLS) |
| **Compliance** | Certificacoes do provedor (SOC2, ISO 27001, HIPAA) |
| **Compute** | Isolamento de VMs/bare-metal, patches de SO |

### Shared Responsibility Model

Em provedores de nuvem, a seguranca e compartilhada:

| Provedor Gerencia | Cliente Gerencia |
|-------------------|-----------------|
| Hardware fisico | Configuracao de rede (VPC, SG) |
| Rede do datacenter | IAM e access management |
| Hypervisor | Patches do OS (em VMs) |
| Servicos gerenciados (EKS, GKE, AKS) | Configuracao do cluster K8s |

### Boas Praticas — Cloud

- Usar **subnets privadas** para nodes do cluster (sem IP publico)
- **Restringir acesso ao API server** via allowlists de IP
- Habilitar **encryption at rest** para volumes (EBS, Persistent Disks)
- Usar **IAM roles** em vez de credenciais estaticas
- Habilitar **audit logging** do provedor (CloudTrail, Cloud Audit Logs)
- Aplicar **patches de seguranca** do SO regularmente

---

## 2. Cluster (Kubernetes)

A camada Cluster cobre todos os componentes do Kubernetes e suas configuracoes de seguranca.

### Componentes Criticos

| Componente | Risco | Controle |
|-----------|-------|----------|
| **API Server** | Ponto de entrada principal | RBAC, audit logging, admission controllers |
| **etcd** | Armazena todos os segredos e estado | Encryption at rest, acesso restrito, TLS mutual |
| **Kubelet** | Agente nos nodes | Autenticacao, authorization mode |
| **Scheduler** | Decide onde pods rodam | Menos critico, mas deve ter acesso restrito |
| **Controller Manager** | Reconcilia estado | Service account tokens, RBAC |

### Controles de Seguranca do Cluster

**RBAC (Role-Based Access Control)**
\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
\`\`\`

**Network Policies** — Restringem trafego entre pods:
\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
\`\`\`

**Admission Controllers** — Validam/modificam requests antes de persistir:
- PodSecurity (PSA) — enforce PSS levels
- ValidatingAdmissionPolicy — CEL-based custom rules
- OPA/Gatekeeper ou Kyverno — policy engines externas

**Audit Logging** — Registra todas as acoes no API server:
\`\`\`yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]
\`\`\`

### Boas Praticas — Cluster

- **RBAC com least privilege** — nunca usar cluster-admin para workloads
- **Encriptar etcd at rest** — via EncryptionConfiguration
- **Habilitar audit logging** — registrar acessos a secrets e RBAC changes
- **Network Policies** — default deny ingress em namespaces de producao
- **Pod Security Standards** — enforce Restricted em namespaces de app
- **Desabilitar anonymous access** ao API server
- **Rotacionar certificados** TLS regularmente
- **Restringir acesso ao kubelet** — authentication e authorization habilitados

---

## 3. Container

A camada Container cobre a seguranca das imagens, do runtime e da configuracao de seguranca dos pods/containers.

### Areas de Risco

| Area | Risco | Controle |
|------|-------|----------|
| **Imagens** | Vulnerabilidades em dependencias | Scanning (Trivy, Grype), base images minimas |
| **Runtime** | Container escape, privilege escalation | seccomp, AppArmor, SELinux, rootless |
| **Configuracao** | Containers privilegiados, root | Pod Security Standards, securityContext |
| **Registry** | Imagens maliciosas, supply chain | Registries privados, image signing (Cosign/Notary) |

### Principios de Seguranca de Container

**Imagens Minimas**
- Usar imagens \`distroless\`, \`alpine\` ou \`scratch\`
- Remover shells, package managers, ferramentas de debug
- Multi-stage builds para reduzir superficie de ataque

**Scanning de Vulnerabilidades**
\`\`\`bash
# Trivy — scanner CNCF
trivy image nginx:1.25-alpine
trivy image --severity HIGH,CRITICAL myapp:v1.0

# Grype — alternativa
grype myapp:v1.0
\`\`\`

**Container SecurityContext**
\`\`\`yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL
  seccompProfile:
    type: RuntimeDefault
\`\`\`

**Image Signing (Supply Chain Security)**
\`\`\`bash
# Cosign — assinatura de imagens OCI
cosign sign --key cosign.key myregistry.io/myapp:v1.0
cosign verify --key cosign.pub myregistry.io/myapp:v1.0
\`\`\`

### Boas Praticas — Container

- **Nunca rodar como root** — sempre runAsNonRoot: true
- **Read-only filesystem** — readOnlyRootFilesystem: true
- **Drop ALL capabilities** — adicionar apenas as necessarias
- **Scan imagens no CI/CD** — bloquear deploy de imagens com CVEs criticas
- **Usar tags imutaveis** ou digests SHA256 (nunca :latest em producao)
- **Limitar recursos** — sempre definir requests e limits (CPU, memoria)
- **Usar registries privados** — nunca puxar direto do Docker Hub em producao

---

## 4. Code (Aplicacao)

A camada mais interna. Mesmo com todas as camadas externas seguras, codigo inseguro pode ser explorado.

### Areas de Risco

| Area | Risco | Controle |
|------|-------|----------|
| **Dependencias** | CVEs em libs de terceiros | Dependabot, Snyk, SBOM |
| **Segredos** | Hardcoded secrets no codigo | Vault, External Secrets, Sealed Secrets |
| **Comunicacao** | Trafego nao-encriptado | mTLS (service mesh), TLS obrigatorio |
| **Input** | Injection (SQL, XSS, SSRF) | Validacao, sanitizacao, WAF |
| **Autenticacao** | Tokens fracos, sessoes inseguras | OAuth2, OIDC, JWT com rotacao |

### Boas Praticas — Code

- **TLS everywhere** — toda comunicacao interna deve usar TLS/mTLS
- **Nunca hardcode secrets** — usar Kubernetes Secrets + external secret managers
- **SBOM (Software Bill of Materials)** — gerar e manter inventario de dependencias
- **SAST/DAST** — analise estatica e dinamica no pipeline CI/CD
- **Principio do menor privilegio** — ServiceAccounts dedicadas por workload
- **Health checks** — liveness e readiness probes para detectar estados anormais

### Gestao de Segredos

\`\`\`yaml
# Kubernetes Secret (base64, NAO encriptado por default)
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
type: Opaque
data:
  password: cGFzc3dvcmQxMjM=  # base64 de "password123"
\`\`\`

**Importante:** Kubernetes Secrets sao apenas base64-encoded, NAO encriptados por padrao. Para seguranca real:

1. **Habilitar encryption at rest** no etcd via EncryptionConfiguration
2. **Usar external secret managers** (HashiCorp Vault, AWS Secrets Manager)
3. **RBAC restritivo** para acesso a Secrets
4. **Audit logging** para monitorar acessos a Secrets

---

## Defesa em Profundidade (Defense in Depth)

O modelo 4C implementa o principio de **defesa em profundidade**: multiplas camadas de seguranca independentes. Se uma camada falha, as outras continuam protegendo.

| Se comprometido... | Impacto sem 4C | Impacto com 4C |
|---------------------|---------------|----------------|
| Codigo vulneravel | Acesso total ao cluster | Limitado pelo container sandbox e network policies |
| Container escape | Acesso ao node | Limitado por seccomp/AppArmor e RBAC do node |
| Cluster comprometido | Acesso a infra | Limitado por IAM roles e network segmentation |

### Modelo de Ameacas por Camada

\`\`\`
Cloud:     Insider threat, misconfigured IAM, exposed API
            ↓ protege ↓
Cluster:   RBAC bypass, etcd exposure, kubelet exploit
            ↓ protege ↓
Container: Image vuln, container escape, privilege escalation
            ↓ protege ↓
Code:      Injection, hardcoded secrets, dependency CVE
\`\`\`

---

## Como o 4C Aparece no KCSA

O KCSA testa sua capacidade de:

1. **Identificar** em qual camada um controle de seguranca opera
2. **Classificar** riscos por camada
3. **Recomendar** controles apropriados para cada camada
4. **Entender** a relacao entre camadas (defesa em profundidade)
5. **Mapear** ferramentas CNCF para cada camada

| Ferramenta CNCF | Camada |
|-----------------|--------|
| Falco | Container / Cluster |
| OPA/Gatekeeper | Cluster |
| Trivy | Container |
| Cosign/Notary | Container (supply chain) |
| Cilium | Cluster (networking) |
| SPIFFE/SPIRE | Code (identidade) |

---

## Erros Comuns no KCSA

1. **Achar que Kubernetes Secrets sao encriptados** — sao apenas base64 por padrao
2. **Confundir camada** — Network Policies sao Cluster, nao Cloud
3. **Esquecer Shared Responsibility** — em managed K8s (EKS/GKE/AKS), o provedor nao gerencia RBAC nem workload security
4. **Ignorar supply chain** — image signing e scanning sao camada Container
5. **Confundir encryption at rest com in transit** — at rest = disco/etcd, in transit = rede/TLS
`,

  quiz: [
    {
      question: 'No modelo 4C de seguranca cloud native, qual e a ordem correta das camadas da mais externa para a mais interna?',
      options: ['Code, Container, Cluster, Cloud', 'Cloud, Cluster, Container, Code', 'Cloud, Container, Cluster, Code', 'Cluster, Cloud, Code, Container'],
      correct: 1,
      explanation: 'A ordem e Cloud (mais externa) -> Cluster -> Container -> Code (mais interna). Cada camada protege a seguinte — se a Cloud e comprometida, todas as internas ficam expostas.',
      reference: 'https://kubernetes.io/docs/concepts/security/overview/#the-4c-s-of-cloud-native-security'
    },
    {
      question: 'Em qual camada do 4C se encontram Network Policies do Kubernetes?',
      options: ['Cloud', 'Cluster', 'Container', 'Code'],
      correct: 1,
      explanation: 'Network Policies sao recursos do Kubernetes que controlam trafego entre pods — pertencem a camada Cluster. A camada Cloud cuida de firewalls e security groups do provedor.',
      reference: 'Network Policies = Cluster. Security Groups/Firewalls = Cloud.'
    },
    {
      question: 'Qual afirmacao sobre Kubernetes Secrets e CORRETA?',
      options: [
        'Secrets sao encriptados automaticamente no etcd',
        'Secrets sao apenas base64-encoded por padrao e requerem EncryptionConfiguration para encriptacao real',
        'Secrets usam AES-256 por padrao para encriptacao at rest',
        'Secrets nao podem ser lidos por pods no mesmo namespace'
      ],
      correct: 1,
      explanation: 'Kubernetes Secrets sao armazenados como base64 no etcd por padrao — isso NAO e encriptacao. Para encriptar secrets at rest, e necessario configurar EncryptionConfiguration no API server com um provider como aescbc ou secretbox.',
      reference: 'https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/'
    },
    {
      question: 'No Shared Responsibility Model de um servico Kubernetes gerenciado (EKS/GKE/AKS), qual responsabilidade e do CLIENTE?',
      options: [
        'Patches do hypervisor',
        'Seguranca fisica do datacenter',
        'Configuracao de RBAC e workload security',
        'Manutencao do control plane'
      ],
      correct: 2,
      explanation: 'Em managed Kubernetes, o provedor gerencia control plane, patches do SO dos nodes gerenciados, e infraestrutura fisica. O cliente e responsavel por RBAC, network policies, pod security, secrets management e seguranca dos workloads.',
      reference: 'Shared Responsibility: Provider = infra/control plane. Client = RBAC, workloads, configs.'
    },
    {
      question: 'Qual ferramenta e usada para assinatura de imagens de container (supply chain security)?',
      options: ['Trivy', 'Falco', 'Cosign', 'Kyverno'],
      correct: 2,
      explanation: 'Cosign (projeto Sigstore) e usado para assinatura e verificacao de imagens OCI — supply chain security na camada Container. Trivy e scanner de vulnerabilidades. Falco e runtime security. Kyverno e policy engine.',
      reference: 'Cosign/Notary = image signing (Container). Trivy = scanning (Container). Falco = runtime (Container/Cluster).'
    },
    {
      question: 'O que significa "defesa em profundidade" no contexto do modelo 4C?',
      options: [
        'Usar apenas a camada mais externa para protecao maxima',
        'Aplicar multiplas camadas de seguranca independentes para que a falha de uma nao comprometa tudo',
        'Encriptar todos os dados em todas as camadas simultaneamente',
        'Ter uma equipe de seguranca para cada camada do modelo'
      ],
      correct: 1,
      explanation: 'Defesa em profundidade significa ter controles de seguranca independentes em cada camada. Se um atacante compromete uma camada (ex: explora um CVE no codigo), as outras camadas (container sandbox, network policies, IAM) limitam o impacto.',
      reference: 'Defense in Depth = multiplas camadas independentes. Falha em uma != comprometimento total.'
    },
    {
      question: 'Qual pratica de seguranca pertence a camada CODE do modelo 4C?',
      options: [
        'Configurar Network Policies para deny-all por padrao',
        'Usar mTLS para comunicacao entre servicos',
        'Habilitar audit logging no API server',
        'Configurar encryption at rest no etcd'
      ],
      correct: 1,
      explanation: 'mTLS (mutual TLS) entre servicos e seguranca na camada Code/aplicacao (comunicacao segura entre microservicos). Network Policies e Cluster. Audit logging e Cluster. Encryption at rest no etcd e Cluster.',
      reference: 'Code: mTLS, secrets management, SAST/DAST. Cluster: RBAC, audit, network policies.'
    },
    {
      question: 'Qual e o risco principal de usar a tag :latest em imagens de container em producao?',
      options: [
        'A imagem e muito grande',
        'Falta rastreabilidade — nao se sabe exatamente qual versao esta rodando, e pode incluir vulnerabilidades nao testadas',
        'O Kubernetes nao consegue puxar imagens com tag latest',
        'A tag latest e mais lenta para baixar'
      ],
      correct: 1,
      explanation: 'A tag :latest e mutavel — pode apontar para diferentes versoes ao longo do tempo. Isso impede auditoria, dificulta rollbacks e pode introduzir vulnerabilidades. Use tags imutaveis ou digests SHA256.',
      reference: 'Boas praticas: tags imutaveis ou digest SHA256. Nunca :latest em producao.'
    },
    {
      question: 'SBOM (Software Bill of Materials) e relevante para qual camada do 4C?',
      options: ['Cloud', 'Cluster', 'Container', 'Code'],
      correct: 3,
      explanation: 'SBOM lista todas as dependencias e componentes do software — pertence a camada Code. Permite rastrear vulnerabilidades em bibliotecas de terceiros e atender requisitos de compliance.',
      reference: 'SBOM = inventario de dependencias = camada Code. Scanning de imagem = camada Container.'
    },
    {
      question: 'Qual controle NAO pertence a camada Cluster?',
      options: ['RBAC', 'Pod Security Standards', 'VPC e Security Groups', 'Admission Controllers'],
      correct: 2,
      explanation: 'VPC e Security Groups sao controles de rede do provedor de nuvem — pertencem a camada Cloud. RBAC, PSS/PSA e Admission Controllers sao todos componentes e configuracoes do Kubernetes — camada Cluster.',
      reference: 'Cloud: VPC, SG, IAM. Cluster: RBAC, PSA, Admission Controllers, Network Policies.'
    }
  ],

  flashcards: [
    { front: 'Quais sao as 4 camadas do modelo 4C?', back: 'Cloud (infraestrutura) -> Cluster (Kubernetes) -> Container (imagens e runtime) -> Code (aplicacao). Da mais externa para a mais interna.' },
    { front: 'O que e o Shared Responsibility Model?', back: 'Em cloud publica, a seguranca e compartilhada: o provedor gerencia infra fisica, hypervisor e (em managed K8s) control plane. O cliente gerencia RBAC, workload security, network policies e secrets.' },
    { front: 'Kubernetes Secrets sao encriptados?', back: 'NAO por padrao. Sao apenas base64-encoded. Para encriptacao real, configure EncryptionConfiguration no API server com provider aescbc ou secretbox para encryption at rest no etcd.' },
    { front: 'O que e defesa em profundidade?', back: 'Principio de aplicar controles de seguranca independentes em cada camada. Se uma camada e comprometida (ex: CVE no codigo), as outras (container sandbox, RBAC, IAM) limitam o impacto do ataque.' },
    { front: 'Trivy vs Cosign vs Falco — qual a funcao de cada?', back: 'Trivy = scanner de vulnerabilidades em imagens (Container). Cosign = assinatura e verificacao de imagens OCI (Container/Supply Chain). Falco = deteccao de ameacas em runtime via syscalls (Container/Cluster).' },
    { front: 'O que e SBOM?', back: 'Software Bill of Materials — inventario completo de todas as dependencias e componentes de um software. Camada Code. Permite rastrear CVEs em libs de terceiros e atender compliance.' },
    { front: 'Quais controles pertencem a camada Cloud?', back: 'VPC, subnets privadas, security groups, IAM roles, MFA, encryption at rest de discos, audit logging do provedor (CloudTrail), patches do SO, certificacoes de compliance (SOC2, ISO 27001).' },
    { front: 'Quais controles pertencem a camada Cluster?', back: 'RBAC, Network Policies, Pod Security Standards/Admission, Admission Controllers (OPA, Kyverno), audit logging do API server, encryption at rest do etcd, certificate rotation, kubelet authentication.' },
    { front: 'Quais controles pertencem a camada Container?', back: 'Image scanning (Trivy), image signing (Cosign), base images minimas (distroless), securityContext (runAsNonRoot, drop ALL caps), seccomp/AppArmor, registries privados, tags imutaveis.' },
    { front: 'Quais controles pertencem a camada Code?', back: 'mTLS entre servicos, secrets management (Vault), SAST/DAST, SBOM, dependencia scanning (Dependabot/Snyk), input validation, OAuth2/OIDC, ServiceAccounts dedicadas.' }
  ],

  lab: {
    scenario: 'Voce e um Security Engineer responsavel por mapear os controles de seguranca de um cluster Kubernetes para as 4 camadas do modelo 4C. O cluster roda em um provedor de nuvem com managed Kubernetes.',
    objective: 'Identificar controles de seguranca existentes em cada camada e encontrar gaps que precisam ser corrigidos.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Auditar camada Cluster — RBAC',
        instruction: 'Verifique os ClusterRoleBindings existentes e identifique quais concedem acesso cluster-admin (risco alto).',
        hints: ['kubectl get clusterrolebindings -o wide', 'Filtre pelo role cluster-admin'],
        solution: '```bash\n# Listar todos os ClusterRoleBindings que referenciam cluster-admin\nkubectl get clusterrolebindings -o wide | grep cluster-admin\n\n# Ver detalhes de um binding especifico\nkubectl describe clusterrolebinding cluster-admin\n\n# Listar TODOS os bindings para auditoria\nkubectl get clusterrolebindings -o custom-columns=NAME:.metadata.name,ROLE:.roleRef.name,SUBJECTS:.subjects[*].name\n```',
        verify: '```bash\n# Verificar que voce consegue listar clusterrolebindings\nkubectl get clusterrolebindings --no-headers | wc -l\n# Deve retornar um numero > 0\n```'
      },
      {
        title: 'Auditar camada Cluster — Network Policies',
        instruction: 'Verifique quais namespaces tem Network Policies configuradas e quais estao sem protecao (sem default deny).',
        hints: ['kubectl get networkpolicies --all-namespaces', 'Namespaces sem network policies permitem todo trafego'],
        solution: '```bash\n# Listar Network Policies em todos os namespaces\nkubectl get networkpolicies --all-namespaces\n\n# Listar namespaces SEM network policies (gap de seguranca)\nfor ns in $(kubectl get ns -o jsonpath=\'{.items[*].metadata.name}\'); do\n  count=$(kubectl get networkpolicies -n $ns --no-headers 2>/dev/null | wc -l)\n  if [ "$count" -eq "0" ]; then\n    echo "SEM NetworkPolicy: $ns"\n  fi\ndone\n```',
        verify: '```bash\n# Verificar que o comando funciona\nkubectl get networkpolicies --all-namespaces 2>&1\n# Saida: lista de policies ou "No resources found"\n```'
      },
      {
        title: 'Auditar camada Container — Pod Security',
        instruction: 'Verifique quais namespaces tem labels de Pod Security Admission configuradas e em qual nivel.',
        hints: ['kubectl get ns --show-labels | grep pod-security', 'Namespaces sem labels PSA nao tem restricao de pod security'],
        solution: '```bash\n# Ver labels PSA de todos os namespaces\nkubectl get ns --show-labels | grep -E "pod-security|NAME"\n\n# Listar namespaces SEM labels PSA\nfor ns in $(kubectl get ns -o jsonpath=\'{.items[*].metadata.name}\'); do\n  labels=$(kubectl get ns $ns -o jsonpath=\'{.metadata.labels}\' | grep pod-security)\n  if [ -z "$labels" ]; then\n    echo "SEM PSA: $ns"\n  fi\ndone\n\n# Verificar pods rodando como root (risco)\nkubectl get pods --all-namespaces -o jsonpath=\'{range .items[*]}{.metadata.namespace}{"/"}{.metadata.name}{" runAsNonRoot="}{.spec.securityContext.runAsNonRoot}{"\\n"}{end}\'\n```',
        verify: '```bash\n# Verificar labels de namespaces\nkubectl get ns --show-labels 2>&1 | head -10\n# Deve mostrar namespaces com ou sem labels pod-security\n```'
      },
      {
        title: 'Auditar camada Code — Secrets exposure',
        instruction: 'Verifique se existem Secrets expostos em namespaces de aplicacao e se encryption at rest esta configurado.',
        hints: ['kubectl get secrets --all-namespaces', 'Secrets do tipo Opaque sao os mais criticos'],
        solution: '```bash\n# Listar secrets por namespace (exceto kube-system e default service accounts)\nkubectl get secrets --all-namespaces --field-selector type=Opaque\n\n# Verificar se encryption at rest esta configurado\n# (requer acesso ao control plane)\nkubectl get pods -n kube-system -l component=kube-apiserver \\\n  -o jsonpath=\'{.items[0].spec.containers[0].command}\' | tr \' \' \'\\n\' | grep encryption\n\n# Verificar se algum Secret esta montado em ConfigMaps (anti-pattern)\nkubectl get configmaps --all-namespaces -o yaml | grep -i password\n```',
        verify: '```bash\n# Verificar que voce consegue listar secrets\nkubectl get secrets --all-namespaces --no-headers | wc -l\n# Deve retornar um numero >= 0\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Secret vazado em logs de aplicacao',
      difficulty: 'medium',
      symptom: 'Revisao de seguranca encontrou credenciais de banco de dados nos logs stdout de um Pod. O Secret do Kubernetes esta configurado corretamente como env var, mas o valor aparece em plain text nos logs.',
      diagnosis: '**1. Verificar como o Secret esta montado no Pod:**\n```bash\nkubectl get pod app-xyz -o yaml | grep -A5 envFrom\nkubectl get pod app-xyz -o yaml | grep -A5 "secretKeyRef"\n```\n\n**2. Verificar logs do pod para confirmar o vazamento:**\n```bash\nkubectl logs app-xyz | grep -i "password\\|secret\\|key\\|token"\n```\n\n**3. Identificar a causa — geralmente e o codigo da aplicacao que loga env vars ou connection strings:**\n```bash\n# Exemplo de log problematico:\n# "Connecting to database with password=mysecretpassword"\n# Ou: startup que imprime todas as env vars\n```\n\n**4. Este e um problema da camada CODE, nao da camada Cluster.**',
      solution: '**A causa e da camada Code — o aplicativo esta logando valores sensiveis.**\n\n**Correcoes:**\n\n1. **Corrigir o codigo** — nunca logar env vars que contem secrets\n2. **Usar Secret como volume** em vez de env var (reduz risco de log acidental):\n```yaml\nvolumeMounts:\n- name: db-secret\n  mountPath: /etc/secrets\n  readOnly: true\nvolumes:\n- name: db-secret\n  secret:\n    secretName: db-credentials\n```\n3. **Audit logging** — monitorar acessos ao Secret:\n```bash\nkubectl get events --field-selector reason=SecretAccess\n```\n4. **Rotacionar o secret imediatamente** apos vazamento\n5. **Considerar Vault** ou external secret manager para injecao segura'
    },
    {
      title: 'Pod privilegiado rodando em namespace de producao',
      difficulty: 'easy',
      symptom: 'Auditoria descobriu um Pod com `privileged: true` e `hostPID: true` rodando no namespace `production`. O namespace nao tem labels PSA.',
      diagnosis: '**1. Confirmar o pod privilegiado:**\n```bash\nkubectl get pod -n production -o jsonpath=\'{range .items[*]}{.metadata.name}{" privileged="}{.spec.containers[0].securityContext.privileged}{"\\n"}{end}\'\n```\n\n**2. Verificar labels PSA do namespace:**\n```bash\nkubectl get ns production --show-labels\n```\n\n**3. Este e um gap na camada Container (pod config) E Cluster (falta de PSA).**',
      solution: '**Correcoes em duas camadas:**\n\n**Camada Cluster — Aplicar PSA:**\n```bash\n# Primeiro em modo warn para identificar todos os pods afetados\nkubectl label namespace production \\\n  pod-security.kubernetes.io/warn=restricted \\\n  pod-security.kubernetes.io/audit=restricted\n\n# Depois de corrigir os pods, aplicar enforce\nkubectl label namespace production \\\n  pod-security.kubernetes.io/enforce=baseline\n```\n\n**Camada Container — Corrigir o Pod:**\n```yaml\nsecurityContext:\n  privileged: false\n  runAsNonRoot: true\n  allowPrivilegeEscalation: false\n  capabilities:\n    drop: [\"ALL\"]\n```\n\n**Verificar:**\n```bash\nkubectl get pods -n production -o jsonpath=\'{range .items[*]}{.metadata.name}{" privileged="}{.spec.containers[0].securityContext.privileged}{"\\n"}{end}\'\n```'
    }
  ]
};
