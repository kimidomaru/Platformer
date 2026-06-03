window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcsa-threat-model/threat-modeling'] = {

  theory: `# STRIDE & Kubernetes Threat Modeling

## Relevancia no KCSA
> O dominio "Kubernetes Threat Model" vale **16%** do exame KCSA. Voce deve saber aplicar frameworks de threat modeling (STRIDE) ao Kubernetes e mapear ameacas aos componentes do cluster. O KCSA e um exame **teorico** (multipla escolha).

---

## O que e Threat Modeling?

**Threat Modeling** e o processo sistematico de identificar ameacas potenciais, categoriza-las e priorizar mitigacoes. No contexto Kubernetes, ajuda a responder:

1. O que estamos protegendo? (assets)
2. Contra quem/o que? (threat actors)
3. Como podem atacar? (attack vectors)
4. Como mitigamos? (controls)

---

## Framework STRIDE

**STRIDE** e o framework de threat modeling mais usado, criado pela Microsoft. Cada letra representa uma categoria de ameaca:

| Letra | Ameaca | Descricao | Propriedade Violada |
|-------|--------|-----------|-------------------|
| **S** | Spoofing | Fingir ser outra identidade | Autenticacao |
| **T** | Tampering | Modificar dados sem autorizacao | Integridade |
| **R** | Repudiation | Negar ter realizado uma acao | Nao-repudio |
| **I** | Information Disclosure | Acessar dados nao autorizados | Confidencialidade |
| **D** | Denial of Service | Tornar servico indisponivel | Disponibilidade |
| **E** | Elevation of Privilege | Obter privilegios nao autorizados | Autorizacao |

---

## STRIDE Aplicado ao Kubernetes

### S — Spoofing (Falsificacao de Identidade)

| Vetor de Ataque | Componente | Mitigacao |
|----------------|-----------|-----------|
| Usar credenciais roubadas para acessar API Server | API Server | mTLS, OIDC, short-lived tokens |
| Pod fingindo ser outro servico | Pods/Services | ServiceAccount tokens, mTLS (service mesh) |
| Man-in-the-middle entre componentes | Rede interna | TLS obrigatorio entre todos os componentes |
| Imagem maliciosa com mesmo nome | Registry | Image signing (Cosign), registry privado |

**Controles Kubernetes:**
\`\`\`yaml
# ServiceAccount com token automontado desabilitado
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app
automountServiceAccountToken: false
\`\`\`

\`\`\`yaml
# Token projetado com audience e expiracao
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: my-app
  containers:
  - name: app
    image: myapp:v1
    volumeMounts:
    - name: token
      mountPath: /var/run/secrets/tokens
  volumes:
  - name: token
    projected:
      sources:
      - serviceAccountToken:
          audience: api
          expirationSeconds: 3600
          path: token
\`\`\`

### T — Tampering (Adulteracao)

| Vetor de Ataque | Componente | Mitigacao |
|----------------|-----------|-----------|
| Modificar etcd diretamente | etcd | TLS mutual, acesso restrito, encryption at rest |
| Alterar imagem de container | Registry/Supply Chain | Image signing, immutable tags, digest |
| Modificar ConfigMaps/Secrets em runtime | API Server | RBAC restritivo, audit logging |
| Alterar binarios no container filesystem | Container | readOnlyRootFilesystem, seccomp |

**Controles Kubernetes:**
\`\`\`yaml
# Proteger filesystem do container
securityContext:
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
\`\`\`

\`\`\`yaml
# Admission controller para validar imagens
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: require-digest
spec:
  matchConstraints:
    resourceRules:
    - apiGroups: [""]
      resources: ["pods"]
      operations: ["CREATE"]
  validations:
  - expression: >
      object.spec.containers.all(c,
        c.image.contains('@sha256:'))
    message: "Imagens devem usar digest SHA256"
\`\`\`

### R — Repudiation (Negacao)

| Vetor de Ataque | Componente | Mitigacao |
|----------------|-----------|-----------|
| Admin nega ter deletado recursos | API Server | Audit logging obrigatorio |
| Atacante apaga evidencias | Logs | Audit logs externos (imutaveis), SIEM |
| Acoes nao rastreadas | RBAC | Audit policy com nivel RequestResponse |

**Controles Kubernetes:**
\`\`\`yaml
# Audit policy abrangente
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
# Logar todas as acoes em secrets
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets"]
# Logar criacao/delecao de pods com request e response
- level: RequestResponse
  resources:
  - group: ""
    resources: ["pods"]
  verbs: ["create", "delete"]
# Logar mudancas de RBAC
- level: RequestResponse
  resources:
  - group: "rbac.authorization.k8s.io"
    resources: ["roles", "rolebindings", "clusterroles", "clusterrolebindings"]
\`\`\`

### I — Information Disclosure (Vazamento de Informacao)

| Vetor de Ataque | Componente | Mitigacao |
|----------------|-----------|-----------|
| Ler Secrets de outros namespaces | API Server/RBAC | RBAC restritivo por namespace |
| Acesso ao etcd sem autenticacao | etcd | mTLS, encryption at rest |
| Environment variables com secrets | Pods | Montar secrets como volumes, nao env vars |
| Network sniffing entre pods | Rede | Network Policies, mTLS (service mesh) |
| Metadata API do cloud provider | Nodes | Bloquear metadata endpoint (169.254.169.254) |

**Controles Kubernetes:**
\`\`\`yaml
# Network Policy bloqueando acesso ao metadata API do cloud
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-metadata
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 169.254.169.254/32
\`\`\`

\`\`\`yaml
# EncryptionConfiguration para secrets no etcd
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: <base64-encoded-key>
  - identity: {}
\`\`\`

### D — Denial of Service (Negacao de Servico)

| Vetor de Ataque | Componente | Mitigacao |
|----------------|-----------|-----------|
| Pod consumindo todos os recursos do node | Nodes | Resource requests e limits obrigatorios |
| Fork bomb em container | Container | LimitRange, ResourceQuota, PID limits |
| Flood de requisicoes ao API Server | API Server | API Priority and Fairness, rate limiting |
| Ataque a rede do cluster | Rede | Network Policies, CNI com rate limiting |
| Muitos objects no etcd | etcd | ResourceQuota por namespace |

**Controles Kubernetes:**
\`\`\`yaml
# LimitRange — define limites padrao por container no namespace
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: production
spec:
  limits:
  - default:
      cpu: 500m
      memory: 256Mi
    defaultRequest:
      cpu: 100m
      memory: 128Mi
    type: Container
\`\`\`

\`\`\`yaml
# ResourceQuota — limita recursos totais do namespace
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: production
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "50"
    services: "20"
    secrets: "100"
\`\`\`

### E — Elevation of Privilege (Escalacao de Privilegios)

| Vetor de Ataque | Componente | Mitigacao |
|----------------|-----------|-----------|
| Container privilegiado com acesso ao host | Container | Pod Security Standards (Restricted) |
| ServiceAccount com cluster-admin | RBAC | Principio do menor privilegio |
| Container escape via kernel exploit | Runtime | seccomp, AppArmor, runtime class (gVisor/Kata) |
| Montar hostPath com acesso ao node | Volumes | PSS Restricted (bloqueia hostPath) |
| Usar hostNetwork para acessar rede do node | Networking | PSS Baseline (bloqueia hostNetwork) |

**Controles Kubernetes:**
\`\`\`yaml
# RBAC com least privilege
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-role
  namespace: production
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list"]
  resourceNames: ["app-config"]  # restringe a recursos especificos
\`\`\`

\`\`\`yaml
# Pod com todas as protecoes contra escalacao
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: myapp:v1.0@sha256:abc123...
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]
      readOnlyRootFilesystem: true
    resources:
      limits:
        cpu: 500m
        memory: 256Mi
\`\`\`

---

## Threat Actors no Kubernetes

| Ator | Motivacao | Vetor Principal |
|------|-----------|----------------|
| **External Attacker** | Dados, crypto mining | Vulnerabilidades expostas, misconfigurations |
| **Malicious Insider** | Sabotagem, roubo de dados | Credenciais validas, RBAC excessivo |
| **Compromised Workload** | Pivot, lateral movement | Container escape, network access |
| **Supply Chain** | Backdoor, malware | Imagens maliciosas, dependencias comprometidas |

---

## Attack Surfaces do Kubernetes

\`\`\`
                    EXTERNAL
                       │
           ┌───────────▼───────────┐
           │    Ingress/LB         │ ← HTTP attacks, DDoS
           └───────────┬───────────┘
                       │
           ┌───────────▼───────────┐
           │    API Server          │ ← Auth bypass, RBAC issues
           └───┬──────┬──────┬─────┘
               │      │      │
          ┌────▼──┐ ┌─▼──┐ ┌─▼────┐
          │ etcd  │ │Node│ │Kubelet│ ← Direct access, kubelet API
          └───────┘ └────┘ └──┬────┘
                              │
                    ┌─────────▼─────────┐
                    │     Pods          │ ← Container escape,
                    │  ┌────┐ ┌────┐   │   lateral movement,
                    │  │App │ │App │   │   secrets access
                    │  └────┘ └────┘   │
                    └───────────────────┘
\`\`\`

### Superficie de Ataque por Componente

| Componente | Riscos Principais | Mitigacoes Essenciais |
|-----------|-------------------|----------------------|
| **API Server** | Acesso nao autorizado, token theft | RBAC, audit logging, OIDC, API rate limiting |
| **etcd** | Data exfiltration, tampering | mTLS, encryption at rest, backup |
| **Kubelet** | Pod creation, host access | Authentication, authorization, TLS |
| **Container Runtime** | Container escape | Patches, rootless, sandboxed runtime |
| **Network** | Lateral movement, sniffing | Network Policies, mTLS, CNI security |
| **Supply Chain** | Malicious images | Signing, scanning, admission control |

---

## Processo de Threat Modeling para Kubernetes

### Passo 1 — Identificar Assets

- Dados sensiveis (Secrets, ConfigMaps, volumes)
- Workloads criticos (Deployments, StatefulSets)
- Infraestrutura (nodes, etcd, API Server)
- Credenciais (ServiceAccount tokens, certificates)

### Passo 2 — Diagrama de Fluxo de Dados (DFD)

Mapear como dados fluem no cluster:
\`\`\`
User -> kubectl -> API Server -> etcd
                      ↕
              Controller Manager
              Scheduler
                      ↕
              kubelet -> Container Runtime -> Pod
                      ↕
              kube-proxy -> iptables/IPVS
\`\`\`

### Passo 3 — Aplicar STRIDE

Para cada componente e fluxo de dados, avaliar as 6 categorias STRIDE.

### Passo 4 — Priorizar (DREAD ou Risk Matrix)

| Fator | Pergunta |
|-------|----------|
| **Damage** | Qual o impacto se explorado? |
| **Reproducibility** | Quao facil e reproduzir? |
| **Exploitability** | Quao facil e explorar? |
| **Affected Users** | Quantos usuarios sao afetados? |
| **Discoverability** | Quao facil e descobrir a vulnerabilidade? |

### Passo 5 — Definir Mitigacoes

Mapear controles de seguranca do Kubernetes para cada ameaca identificada.

---

## Kubernetes Security Checklist (STRIDE-based)

| STRIDE | Controle | Status |
|--------|----------|--------|
| **S** | RBAC habilitado e configurado | ☐ |
| **S** | ServiceAccounts dedicadas por workload | ☐ |
| **S** | mTLS entre componentes do control plane | ☐ |
| **T** | Encryption at rest para etcd | ☐ |
| **T** | Image signing e verification | ☐ |
| **T** | readOnlyRootFilesystem habilitado | ☐ |
| **R** | Audit logging habilitado | ☐ |
| **R** | Logs enviados para SIEM externo | ☐ |
| **I** | Network Policies configuradas | ☐ |
| **I** | Secrets encriptados no etcd | ☐ |
| **I** | Metadata API bloqueado | ☐ |
| **D** | ResourceQuota por namespace | ☐ |
| **D** | LimitRange com defaults | ☐ |
| **D** | API Priority and Fairness | ☐ |
| **E** | Pod Security Standards (Restricted) | ☐ |
| **E** | Drop ALL capabilities | ☐ |
| **E** | seccomp profile habilitado | ☐ |

---

## Erros Comuns no KCSA

1. **Confundir STRIDE com 4C** — STRIDE e framework de ameacas, 4C e modelo de camadas de seguranca
2. **Esquecer Repudiation** — audit logging e frequentemente negligenciado
3. **Nao mapear ameaca ao componente correto** — saber qual componente K8s mitiga cada ameaca
4. **Achar que RBAC resolve tudo** — RBAC resolve S e parcialmente E, mas nao T, R, I ou D
5. **Ignorar supply chain** — image tampering e um vetor real e cobrado no KCSA
`,

  quiz: [
    {
      question: 'No framework STRIDE, qual categoria de ameaca e mitigada por audit logging no Kubernetes?',
      options: ['Spoofing', 'Tampering', 'Repudiation', 'Denial of Service'],
      correct: 2,
      explanation: 'Repudiation e a ameaca de negar ter realizado uma acao. Audit logging no API server registra todas as acoes com timestamp, usuario e detalhes, impedindo que alguem negue suas acoes.',
      reference: 'STRIDE R = Repudiation -> Mitigacao: Audit Logging. S = Spoofing -> Autenticacao. T = Tampering -> Integridade.'
    },
    {
      question: 'Um Pod rodando com privileged: true e um exemplo de qual categoria STRIDE?',
      options: ['Spoofing', 'Information Disclosure', 'Denial of Service', 'Elevation of Privilege'],
      correct: 3,
      explanation: 'Elevation of Privilege — um container privilegiado tem acesso completo ao host, permitindo escalar privilegios do container para o node. Mitigacao: Pod Security Standards (Restricted) bloqueia privileged: true.',
      reference: 'STRIDE E = Elevation of Privilege. Mitigacao: PSS Restricted, drop ALL caps, runAsNonRoot, seccomp.'
    },
    {
      question: 'Qual controle Kubernetes mitiga a ameaca STRIDE "Information Disclosure" para comunicacao entre pods?',
      options: ['ResourceQuota', 'Network Policies', 'LimitRange', 'PodDisruptionBudget'],
      correct: 1,
      explanation: 'Network Policies restringem o trafego de rede entre pods, prevenindo que pods nao autorizados acessem dados de outros pods (Information Disclosure). ResourceQuota e LimitRange sao controles contra DoS.',
      reference: 'STRIDE I = Information Disclosure -> Network Policies, mTLS, encryption. D = DoS -> ResourceQuota, LimitRange.'
    },
    {
      question: 'Qual ameaca STRIDE a assinatura de imagens de container (image signing) mitiga?',
      options: ['Spoofing e Tampering', 'Repudiation e DoS', 'Information Disclosure e DoS', 'Elevation of Privilege e Repudiation'],
      correct: 0,
      explanation: 'Image signing mitiga Spoofing (verificar que a imagem veio do autor correto) e Tampering (verificar que a imagem nao foi adulterada). Cosign/Notary assinam e verificam imagens OCI.',
      reference: 'Image signing: S (identidade do autor) + T (integridade da imagem). Cosign/Notary/TUF.'
    },
    {
      question: 'Qual vetor de ataque permite lateral movement entre pods no cluster?',
      options: [
        'Acesso direto ao etcd',
        'Falta de Network Policies permitindo trafego livre entre pods',
        'Audit logging desabilitado',
        'ResourceQuota nao configurado'
      ],
      correct: 1,
      explanation: 'Sem Network Policies, todos os pods podem se comunicar livremente. Um atacante que compromete um pod pode fazer lateral movement para outros pods. Network Policies implementam microsegmentacao.',
      reference: 'Lateral movement = STRIDE I + E. Mitigacao: Network Policies (default deny), mTLS, microsegmentacao.'
    },
    {
      question: 'No DREAD scoring, o que o fator "Exploitability" avalia?',
      options: [
        'Quantos usuarios sao afetados pelo ataque',
        'O impacto financeiro do ataque',
        'Quao facil e explorar a vulnerabilidade',
        'Quao facil e descobrir a vulnerabilidade'
      ],
      correct: 2,
      explanation: 'Exploitability avalia a facilidade de explorar a vulnerabilidade (ferramentas necessarias, nivel de skill). Affected Users = quantos afetados. Damage = impacto. Discoverability = facilidade de descobrir.',
      reference: 'DREAD: Damage, Reproducibility, Exploitability, Affected users, Discoverability.'
    },
    {
      question: 'Qual recurso Kubernetes protege contra Denial of Service (STRIDE D) limitando o consumo total de recursos em um namespace?',
      options: ['NetworkPolicy', 'LimitRange', 'ResourceQuota', 'PodSecurityPolicy'],
      correct: 2,
      explanation: 'ResourceQuota limita o consumo TOTAL de recursos (CPU, memoria, numero de pods, secrets) em um namespace. LimitRange define limites por CONTAINER (default e max/min). Ambos mitigam DoS, mas ResourceQuota e no nivel do namespace.',
      reference: 'ResourceQuota = limite total do namespace. LimitRange = limite por container. Ambos mitigam STRIDE D.'
    },
    {
      question: 'Qual e a primeira etapa do processo de threat modeling para Kubernetes?',
      options: [
        'Aplicar STRIDE a cada componente',
        'Identificar os assets (dados, workloads, infraestrutura)',
        'Implementar Network Policies',
        'Configurar audit logging'
      ],
      correct: 1,
      explanation: 'A primeira etapa e identificar os assets: o que precisa ser protegido (secrets, dados, workloads criticos, infraestrutura). Depois se cria o DFD, aplica STRIDE, prioriza com DREAD e define mitigacoes.',
      reference: 'Processo: 1. Assets -> 2. DFD -> 3. STRIDE -> 4. Priorizar (DREAD) -> 5. Mitigacoes.'
    },
    {
      question: 'Bloquear o metadata API endpoint (169.254.169.254) nos pods mitiga qual ameaca STRIDE?',
      options: ['Spoofing', 'Tampering', 'Information Disclosure', 'Elevation of Privilege'],
      correct: 2,
      explanation: 'O metadata API do cloud provider (169.254.169.254) pode expor credenciais IAM, tokens e informacoes sensiveis da instancia. Bloquear via Network Policy previne Information Disclosure.',
      reference: 'Metadata API = STRIDE I. Bloquear 169.254.169.254 via NetworkPolicy egress. Risco real: SSRF + metadata = credential theft.'
    },
    {
      question: 'Qual afirmacao sobre threat actors no Kubernetes e CORRETA?',
      options: [
        'Supply chain attacks sao irrelevantes para Kubernetes',
        'Apenas atacantes externos representam risco',
        'Um workload comprometido pode ser usado para lateral movement e pivot dentro do cluster',
        'RBAC elimina completamente o risco de insiders maliciosos'
      ],
      correct: 2,
      explanation: 'Um workload comprometido e um dos principais threat actors — pode fazer lateral movement via rede, acessar secrets montados, escalar privilegios se o container for mal configurado. RBAC nao elimina risco de insiders, e supply chain e um vetor real.',
      reference: 'Threat actors: External, Insider, Compromised Workload, Supply Chain. Todos sao relevantes e cobrados no KCSA.'
    }
  ],

  flashcards: [
    { front: 'O que significa cada letra do STRIDE?', back: 'S = Spoofing (identidade). T = Tampering (integridade). R = Repudiation (nao-repudio). I = Information Disclosure (confidencialidade). D = Denial of Service (disponibilidade). E = Elevation of Privilege (autorizacao).' },
    { front: 'Qual controle K8s mitiga cada letra do STRIDE?', back: 'S: RBAC, mTLS, OIDC. T: encryption at rest, image signing, readOnlyRootFilesystem. R: audit logging. I: Network Policies, encryption, RBAC para secrets. D: ResourceQuota, LimitRange, rate limiting. E: PSS Restricted, drop caps, seccomp.' },
    { front: 'O que e DREAD?', back: 'Framework de priorizacao de ameacas: Damage (impacto), Reproducibility (facilidade de reproduzir), Exploitability (facilidade de explorar), Affected Users (abrangencia), Discoverability (facilidade de descobrir). Score 1-10 para cada fator.' },
    { front: 'Quais sao os 4 threat actors em Kubernetes?', back: 'External Attacker (vuln/misconfig), Malicious Insider (credenciais validas), Compromised Workload (container escape, lateral movement), Supply Chain (imagens/dependencias maliciosas).' },
    { front: 'Quais sao as 5 etapas do threat modeling?', back: '1. Identificar assets. 2. Diagrama de fluxo de dados (DFD). 3. Aplicar STRIDE. 4. Priorizar (DREAD ou risk matrix). 5. Definir mitigacoes (controles K8s).' },
    { front: 'Por que bloquear 169.254.169.254 via NetworkPolicy?', back: 'O metadata API do cloud provider (169.254.169.254) pode expor credenciais IAM, tokens e informacoes sensiveis. Um pod comprometido pode acessar via SSRF. Bloquear com NetworkPolicy egress (STRIDE I).' },
    { front: 'Lateral movement: o que e e como mitigar?', back: 'Atacante se move de um pod comprometido para outros pods/servicos no cluster. Mitigacoes: Network Policies (default deny), mTLS (service mesh), RBAC restritivo, ServiceAccount dedicada, seccomp.' },
    { front: 'ResourceQuota vs LimitRange: qual a diferenca?', back: 'ResourceQuota = limita recursos TOTAIS do namespace (ex: max 20 pods, 10 CPU). LimitRange = define limites/defaults por CONTAINER (ex: max 500m CPU por container). Ambos mitigam STRIDE D (DoS).' },
    { front: 'Qual a diferenca entre STRIDE e o modelo 4C?', back: 'STRIDE = framework de AMEACAS (categoriza tipos de ataque). 4C = modelo de CAMADAS de seguranca (Cloud, Cluster, Container, Code). Sao complementares: use STRIDE para identificar ameacas em cada camada do 4C.' },
    { front: 'O que e supply chain attack em Kubernetes?', back: 'Ataque que compromete imagens de container, dependencias ou ferramentas de build antes do deploy. Mitigacoes: image signing (Cosign), scanning (Trivy), SBOM, admission control para verificar assinaturas, registries privados.' }
  ],

  lab: {
    scenario: 'Voce e um Security Architect e deve realizar um threat modeling do cluster Kubernetes usando STRIDE. Identifique ameacas, mapeie controles existentes e encontre gaps.',
    objective: 'Aplicar STRIDE ao cluster, identificar controles existentes e gaps de seguranca, e implementar mitigacoes.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Mapear assets e identificar RBAC gaps (STRIDE S+E)',
        instruction: 'Liste todos os ClusterRoleBindings que concedem cluster-admin e identifique ServiceAccounts com privilegios excessivos.',
        hints: ['kubectl get clusterrolebindings -o wide', 'Procure por ServiceAccounts com cluster-admin que nao sejam do sistema'],
        solution: '```bash\n# Listar ClusterRoleBindings com cluster-admin\nkubectl get clusterrolebindings -o custom-columns=NAME:.metadata.name,ROLE:.roleRef.name,SUBJECTS:.subjects[*].name | grep cluster-admin\n\n# Verificar ServiceAccounts em namespaces de app com roles amplas\nfor ns in $(kubectl get ns -o jsonpath=\'{.items[*].metadata.name}\' | tr \' \' \'\\n\' | grep -v kube); do\n  echo "=== Namespace: $ns ===" \n  kubectl get rolebindings,clusterrolebindings -n $ns -o wide 2>/dev/null\ndone\n\n# Verificar se ServiceAccounts tem token automontado (risco)\nkubectl get serviceaccounts --all-namespaces -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,AUTOMOUNT:.automountServiceAccountToken\n```',
        verify: '```bash\n# Deve listar ClusterRoleBindings\nkubectl get clusterrolebindings --no-headers | wc -l\n# Deve retornar > 0\n```'
      },
      {
        title: 'Verificar controles contra Information Disclosure (STRIDE I)',
        instruction: 'Verifique se Network Policies estao configuradas e se Secrets estao expostos desnecessariamente.',
        hints: ['kubectl get networkpolicies --all-namespaces', 'kubectl get secrets --all-namespaces --field-selector type=Opaque'],
        solution: '```bash\n# Verificar Network Policies\nkubectl get networkpolicies --all-namespaces\n\n# Listar secrets Opaque (potencialmente sensiveis)\nkubectl get secrets --all-namespaces --field-selector type=Opaque -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name\n\n# Verificar se pods tem acesso ao metadata API\nkubectl run test-metadata --image=alpine --restart=Never --rm -it -- wget -qO- --timeout=2 http://169.254.169.254/ 2>&1\n\n# Verificar se encryption at rest esta configurado\nkubectl -n kube-system get pod -l component=kube-apiserver -o jsonpath=\'{.items[0].spec.containers[0].command}\' | tr \' \' \'\\n\' | grep encryption\n```',
        verify: '```bash\n# Verificar existencia de Network Policies\nkubectl get networkpolicies --all-namespaces --no-headers 2>&1 | head -5\n```'
      },
      {
        title: 'Implementar controles contra DoS (STRIDE D)',
        instruction: 'Crie um namespace seguro com ResourceQuota e LimitRange para prevenir consumo excessivo de recursos.',
        hints: ['Crie ResourceQuota limitando CPU, memoria e numero de pods', 'Crie LimitRange com defaults e limites por container'],
        solution: '```bash\n# Criar namespace\nkubectl create namespace secure-ns\n\n# Aplicar ResourceQuota\nkubectl apply -f - <<EOF\napiVersion: v1\nkind: ResourceQuota\nmetadata:\n  name: compute-quota\n  namespace: secure-ns\nspec:\n  hard:\n    requests.cpu: "4"\n    requests.memory: 8Gi\n    limits.cpu: "8"\n    limits.memory: 16Gi\n    pods: "20"\n    secrets: "30"\nEOF\n\n# Aplicar LimitRange\nkubectl apply -f - <<EOF\napiVersion: v1\nkind: LimitRange\nmetadata:\n  name: default-limits\n  namespace: secure-ns\nspec:\n  limits:\n  - default:\n      cpu: 500m\n      memory: 256Mi\n    defaultRequest:\n      cpu: 100m\n      memory: 128Mi\n    max:\n      cpu: "2"\n      memory: 2Gi\n    type: Container\nEOF\n\n# Verificar\nkubectl describe quota -n secure-ns\nkubectl describe limitrange -n secure-ns\n```',
        verify: '```bash\n# ResourceQuota deve existir\nkubectl get resourcequota -n secure-ns --no-headers | wc -l\n# Deve retornar 1\n\n# LimitRange deve existir\nkubectl get limitrange -n secure-ns --no-headers | wc -l\n# Deve retornar 1\n```'
      },
      {
        title: 'Habilitar audit logging para Repudiation (STRIDE R)',
        instruction: 'Verifique se audit logging esta habilitado no API server e crie uma audit policy que registra acessos a Secrets e mudancas de RBAC.',
        hints: ['Verifique flags do kube-apiserver: --audit-policy-file e --audit-log-path', 'Audit policy deve cobrir secrets e rbac resources'],
        solution: '```bash\n# Verificar se audit logging esta habilitado\nkubectl -n kube-system get pod -l component=kube-apiserver -o jsonpath=\'{.items[0].spec.containers[0].command}\' | tr \' \' \'\\n\' | grep audit\n\n# Se nao estiver, criar a audit policy:\n# /etc/kubernetes/audit-policy.yaml (no control plane node)\ncat <<EOF\napiVersion: audit.k8s.io/v1\nkind: Policy\nrules:\n- level: Metadata\n  resources:\n  - group: ""\n    resources: ["secrets"]\n- level: RequestResponse\n  resources:\n  - group: "rbac.authorization.k8s.io"\n    resources: ["roles", "rolebindings", "clusterroles", "clusterrolebindings"]\n  verbs: ["create", "update", "delete", "patch"]\n- level: Metadata\n  resources:\n  - group: ""\n    resources: ["pods"]\n  verbs: ["create", "delete"]\n- level: None\n  resources:\n  - group: ""\n    resources: ["events", "endpoints"]\nEOF\n\n# Flags necessarias no kube-apiserver:\n# --audit-policy-file=/etc/kubernetes/audit-policy.yaml\n# --audit-log-path=/var/log/kubernetes/audit.log\n# --audit-log-maxsize=100\n# --audit-log-maxbackup=3\n```',
        verify: '```bash\n# Verificar flags de audit no apiserver\nkubectl -n kube-system get pod -l component=kube-apiserver -o jsonpath=\'{.items[0].spec.containers[0].command}\' | tr \' \' \'\\n\' | grep -c audit\n# Deve retornar >= 1 se audit esta habilitado\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod consegue acessar metadata API do cloud provider',
      difficulty: 'medium',
      symptom: 'Auditoria de seguranca revelou que pods no namespace `production` conseguem acessar o metadata API do cloud provider (169.254.169.254), expondo credenciais IAM temporarias do node.',
      diagnosis: '**1. Confirmar o acesso ao metadata API:**\n```bash\nkubectl run test-meta --image=alpine --namespace=production --restart=Never --rm -it -- wget -qO- --timeout=3 http://169.254.169.254/latest/meta-data/\n```\n\n**2. Verificar se existem Network Policies no namespace:**\n```bash\nkubectl get networkpolicies -n production\n```\n\n**3. Verificar se o CNI suporta Network Policies:**\n```bash\nkubectl get pods -n kube-system | grep -E "calico|cilium|weave"\n```\nSe o CNI e Flannel, ele NAO suporta Network Policies.\n\n**4. Classificar no STRIDE: Information Disclosure (I)**\nCredenciais IAM podem ser usadas para acessar recursos do cloud provider.',
      solution: '**Criar NetworkPolicy bloqueando acesso ao metadata API:**\n\n```bash\nkubectl apply -f - <<EOF\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: block-metadata-api\n  namespace: production\nspec:\n  podSelector: {}\n  policyTypes:\n  - Egress\n  egress:\n  - to:\n    - ipBlock:\n        cidr: 0.0.0.0/0\n        except:\n        - 169.254.169.254/32\nEOF\n```\n\n**Verificar que o bloqueio funciona:**\n```bash\nkubectl run test-block --image=alpine --namespace=production --restart=Never --rm -it -- wget -qO- --timeout=3 http://169.254.169.254/ 2>&1\n# Deve falhar com timeout\n```\n\n**Nota:** Se o CNI nao suporta Network Policies (ex: Flannel), considere migrar para Calico ou Cilium.'
    },
    {
      title: 'ServiceAccount com cluster-admin em namespace de aplicacao',
      difficulty: 'hard',
      symptom: 'Threat modeling identificou que uma ServiceAccount no namespace `app` tem ClusterRoleBinding para cluster-admin. Qualquer pod usando essa SA tem acesso total ao cluster, incluindo deletar namespaces e ler secrets de outros namespaces.',
      diagnosis: '**1. Identificar a ServiceAccount e o binding:**\n```bash\nkubectl get clusterrolebindings -o wide | grep app\nkubectl get clusterrolebinding <binding-name> -o yaml\n```\n\n**2. Verificar quais pods usam essa ServiceAccount:**\n```bash\nkubectl get pods -n app -o jsonpath=\'{range .items[*]}{.metadata.name}{" sa="}{.spec.serviceAccountName}{"\\n"}{end}\'\n```\n\n**3. Testar o que a SA pode fazer:**\n```bash\nkubectl auth can-i --list --as=system:serviceaccount:app:<sa-name>\n```\n\n**4. Classificar no STRIDE: Elevation of Privilege (E) + Spoofing (S)**\nA SA permite escalar privilegios para cluster-admin.',
      solution: '**1. Criar Role com privilegios minimos necessarios:**\n```bash\nkubectl apply -f - <<EOF\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: app-minimal\n  namespace: app\nrules:\n- apiGroups: [""]\n  resources: ["configmaps"]\n  verbs: ["get", "list"]\n- apiGroups: [""]\n  resources: ["secrets"]\n  verbs: ["get"]\n  resourceNames: ["app-secret"]\nEOF\n```\n\n**2. Criar RoleBinding (namespace-scoped, nao cluster):**\n```bash\nkubectl apply -f - <<EOF\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: app-binding\n  namespace: app\nroleRef:\n  apiGroup: rbac.authorization.k8s.io\n  kind: Role\n  name: app-minimal\nsubjects:\n- kind: ServiceAccount\n  name: app-sa\n  namespace: app\nEOF\n```\n\n**3. Remover o ClusterRoleBinding perigoso:**\n```bash\nkubectl delete clusterrolebinding <binding-name>\n```\n\n**4. Verificar que os privilegios foram reduzidos:**\n```bash\nkubectl auth can-i --list --as=system:serviceaccount:app:app-sa\n# Deve mostrar apenas get/list configmaps e get do secret especifico\n\nkubectl auth can-i delete namespaces --as=system:serviceaccount:app:app-sa\n# Deve retornar: no\n```'
    }
  ]
};
